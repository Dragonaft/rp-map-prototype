import React, { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import type { Province } from '../types';
import { ActionType } from '../types';
import { Box, Button, Modal, Typography } from '@mui/material';
import { ProvinceShape } from './ProvinceShape';
import { SelectedProvinceHover } from "./SelectedProvinceHover.tsx";
import { TroopMovementModal } from './TroopMovementModal';
import { setSelectedProvinceId, setSelectedTroops, updateProvinceById } from '../store/slices/provincesSlice';
import type { RootState } from '../store/store';
import { useAppDispatch, useAppSelector } from "../store/hooks.ts";
import { actionsApi } from '../api/actions.ts';
import { removeActionById } from '../store/slices/actionsSlice.ts';

export const MapView = ({ loading, error }: { loading: boolean, error: string | null }) => {
  const dispatch = useAppDispatch();
  const provinces = useAppSelector((state: RootState) => state.provinces.provinces);
  const selectedProvinceId = useAppSelector((state: RootState) => state.provinces.selectedProvinceId);
  const selectedTroops = useAppSelector((state: RootState) => state.provinces.selectedTroops);
  const userActions = useAppSelector((state: RootState) => state.actions.actions);
  const provinceCentersById = useAppSelector((state: RootState) => state.provinces.provinceCentersById);
  const provinceBBoxById = useAppSelector((state: RootState) => state.provinces.provinceBBoxById);
  // Camera state
  const [viewBox, setViewBox] = useState({ x: 0, y: 0, width: 800, height: 600 });
  const [isDragging, setIsDragging] = useState(false);
  const dragStartRef = useRef<{ x: number; y: number } | null>(null);
  const lastMousePosRef = useRef<{ x: number; y: number } | null>(null);
  const hasDraggedRef = useRef(false);
  const svgRef = useRef<SVGSVGElement>(null);

  // Modal state
  const [modalState, setModalState] = useState<{
    open: boolean;
    fromProvinceId: string;
    toProvinceId: string;
    maxTroops: number;
    isInvasion: boolean;
  } | null>(null);
  const [cancelActionId, setCancelActionId] = useState<string | null>(null);
  const [isCancellingAction, setIsCancellingAction] = useState(false);
  const [cancelError, setCancelError] = useState<string | null>(null);

  const toggleSelect = useCallback((prov: Province) => {
    if (hasDraggedRef.current) return;
    dispatch(setSelectedProvinceId(selectedProvinceId === prov.id ? null : prov.id));
  }, [dispatch, selectedProvinceId]);

  const handleProvinceRightClick = useCallback((targetProvince: Province) => {
    if (!selectedTroops) return;
    const sourceProvince = provinces.find(p => p.id === selectedTroops.provinceId);
    if (!sourceProvince) return;
    if (!sourceProvince.neighbors?.includes(targetProvince.id)) return;
    setModalState({
      open: true,
      fromProvinceId: sourceProvince.id,
      toProvinceId: targetProvince.id,
      maxTroops: selectedTroops.troopCount,
      isInvasion: true,
    });
  }, [selectedTroops, provinces]);

  const handleCloseModal = useCallback(() => setModalState(null), []);

  const handleOpenCancelModal = useCallback((actionId: string) => {
    setCancelError(null);
    setCancelActionId(actionId);
  }, []);

  const handleCloseCancelModal = useCallback(() => {
    if (isCancellingAction) return;
    setCancelActionId(null);
    setCancelError(null);
  }, [isCancellingAction]);

  const handleConfirmCancelAction = useCallback(async () => {
    if (!cancelActionId) return;
    setIsCancellingAction(true);
    setCancelError(null);
    try {
      const response = await actionsApi.removeAction(cancelActionId);
      dispatch(removeActionById(cancelActionId));
      if (response?.province?.id != null) {
        dispatch(updateProvinceById({
          id: response.province.id,
          updates: { localTroops: response.province.localTroops },
        }));
      }
      setCancelActionId(null);
    } catch (err: any) {
      setCancelError(err?.response?.data?.message || 'Failed to cancel action');
    } finally {
      setIsCancellingAction(false);
    }
  }, [cancelActionId, dispatch]);

  // ── Action index lookups ──────────────────────────────────────────────────

  const troopMovementOverlays = useMemo(() => {
    if (!userActions?.length) return [];
    console.log(userActions, 'userActions_TEST')
    return userActions.filter(a => a.actionType === ActionType.INVADE);
  }, [userActions]);

  const deployActionByProvinceId = useMemo(() => {
    if (!userActions?.length) return {} as Record<string, { id: string; troopsNumber: number }>;
    return userActions
      .filter(a => a.actionType === ActionType.DEPLOY)
      .reduce<Record<string, { id: string; troopsNumber: number }>>((acc, a) => {
        const provinceId: string | undefined = a.actionData?.province_id ?? a.actionData?.provinceId;
        const troopsNumber: number | undefined = a.actionData?.troops_number ?? a.actionData?.troopCount;
        if (!provinceId || troopsNumber == null) return acc;
        acc[provinceId] = { id: a.id, troopsNumber };
        return acc;
      }, {});
  }, [userActions]);

  // ── Viewport culling ──────────────────────────────────────────────────────
  // Only passes provinces whose bbox intersects the current SVG viewBox.
  // Reduces active DOM nodes from N to ~50–150 at typical zoom levels.
  const visibleProvinces = useMemo(() => {
    if (!provinces?.length) return [];
    return provinces.filter(p => {
      const bb = provinceBBoxById[p.id];
      if (!bb) return true;
      return !(
        bb.x + bb.width  < viewBox.x ||
        bb.x             > viewBox.x + viewBox.width ||
        bb.y + bb.height < viewBox.y ||
        bb.y             > viewBox.y + viewBox.height
      );
    });
  }, [provinces, provinceBBoxById, viewBox]);

  // ── Wheel zoom ────────────────────────────────────────────────────────────
  useEffect(() => {
    const svg = svgRef.current;
    if (!svg || loading) return;

    const handleWheel = (e: WheelEvent) => {
      if (!e.ctrlKey) return;
      e.preventDefault();
      e.stopPropagation();
      const zoomFactor = e.deltaY > 0 ? 1.1 : 0.9;
      const rect = svg.getBoundingClientRect();
      const mouseX = e.clientX - rect.left;
      const mouseY = e.clientY - rect.top;
      setViewBox(prev => {
        const mouseXInViewBox = prev.x + (mouseX / rect.width) * prev.width;
        const mouseYInViewBox = prev.y + (mouseY / rect.height) * prev.height;
        const newWidth = prev.width * zoomFactor;
        const newHeight = prev.height * zoomFactor;
        return {
          x: mouseXInViewBox - (mouseX / rect.width) * newWidth,
          y: mouseYInViewBox - (mouseY / rect.height) * newHeight,
          width: newWidth,
          height: newHeight,
        };
      });
    };

    svg.addEventListener('wheel', handleWheel, { passive: false });
    return () => svg.removeEventListener('wheel', handleWheel);
  }, [loading]);

  // ── Drag-to-pan ───────────────────────────────────────────────────────────
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isDragging || !lastMousePosRef.current || !svgRef.current) return;
      const deltaX = e.clientX - lastMousePosRef.current.x;
      const deltaY = e.clientY - lastMousePosRef.current.y;

      if (!hasDraggedRef.current && (Math.abs(deltaX) > 3 || Math.abs(deltaY) > 3)) {
        hasDraggedRef.current = true;
      }

      if (hasDraggedRef.current) {
        const rect = svgRef.current.getBoundingClientRect();
        const scaleX = viewBox.width / rect.width;
        const scaleY = viewBox.height / rect.height;
        setViewBox(prev => ({
          ...prev,
          x: prev.x - deltaX * scaleX,
          y: prev.y - deltaY * scaleY,
        }));
      }
      lastMousePosRef.current = { x: e.clientX, y: e.clientY };
    };

    const handleMouseUp = () => {
      if (isDragging) {
        setIsDragging(false);
        dragStartRef.current = null;
        lastMousePosRef.current = null;
        setTimeout(() => { hasDraggedRef.current = false; }, 50);
      }
    };

    if (isDragging) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
      return () => {
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
      };
    }
  }, [isDragging, viewBox.width, viewBox.height]);

  const handleSvgMouseDown = (e: React.MouseEvent<SVGSVGElement>) => {
    if (e.button !== 0) return;
    setIsDragging(true);
    dragStartRef.current = { x: e.clientX, y: e.clientY };
    lastMousePosRef.current = { x: e.clientX, y: e.clientY };
    hasDraggedRef.current = false;
  };

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', background: '#0f172a', color: 'white' }}>
        Loading provinces...
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', background: '#0f172a', color: 'red' }}>
        {error}
      </div>
    );
  }

  return (
    <div style={{ position: 'relative', width: '100%', height: '93vh', marginTop: '65px', background: '#1e293b' }}>
      <SelectedProvinceHover />

      {modalState && (
        <TroopMovementModal
          open={modalState.open}
          onClose={handleCloseModal}
          fromProvinceId={modalState.fromProvinceId}
          toProvinceId={modalState.toProvinceId}
          maxTroops={modalState.maxTroops}
          isInvasion={modalState.isInvasion}
          unSelectTroops={() => dispatch(setSelectedTroops(null))}
        />
      )}

      <Modal open={Boolean(cancelActionId)} onClose={handleCloseCancelModal}>
        <Box sx={{
          position: 'absolute', top: '50%', left: '50%',
          transform: 'translate(-50%, -50%)',
          width: 360, bgcolor: 'background.paper',
          border: '2px solid #000', boxShadow: 24, p: 3,
        }}>
          <Typography variant="h6" component="h2" gutterBottom>
            Are you sure you want to cancel this action?
          </Typography>
          {cancelError && (
            <Typography sx={{ color: 'error.main', mt: 1 }}>{cancelError}</Typography>
          )}
          <Box sx={{ display: 'flex', gap: 2, mt: 3 }}>
            <Button variant="contained" color="error" onClick={handleConfirmCancelAction}
              disabled={isCancellingAction} fullWidth>
              {isCancellingAction ? 'Cancelling...' : 'Yes'}
            </Button>
            <Button variant="outlined" onClick={handleCloseCancelModal}
              disabled={isCancellingAction} fullWidth>
              No
            </Button>
          </Box>
        </Box>
      </Modal>

      <svg
        ref={svgRef}
        viewBox={`${viewBox.x} ${viewBox.y} ${viewBox.width} ${viewBox.height}`}
        style={{
          width: '100%', height: '100%',
          cursor: isDragging ? 'grabbing' : 'grab',
          background: '#334155',
        }}
        onMouseDown={handleSvgMouseDown}
        onClick={(e) => {
          if (e.target instanceof SVGSVGElement) {
            dispatch(setSelectedProvinceId(null));
            dispatch(setSelectedTroops(null));
          }
        }}
      >
        <defs>
          <marker id="troop-action-arrowhead" markerWidth="10" markerHeight="10"
            refX="9" refY="3" orient="auto" markerUnits="strokeWidth">
            <path d="M0,0 L0,6 L9,3 z" fill="#ffffff" />
          </marker>
        </defs>

        {/* Single render pass — viewport-culled provinces only */}
        {visibleProvinces.map(p => (
          <ProvinceShape
            key={p.id}
            province={p}
            bbox={provinceBBoxById[p.id] ?? { x: 0, y: 0, width: 0, height: 0 }}
            isSelected={selectedProvinceId === p.id}
            onSelect={toggleSelect}
            onRightClick={handleProvinceRightClick}
            pendingDeployAction={deployActionByProvinceId[p.id]}
            onCancelAction={handleOpenCancelModal}
          />
        ))}

        {/* Troop movement arrows */}
        <g>
          {troopMovementOverlays.map(action => {
            const raw = action.actionData as {
              from_province_id?: string; to_province_id?: string; troops_number?: number;
              fromProvinceId?: string; toProvinceId?: string; troopCount?: number;
            } | undefined;
            const fromId = raw?.from_province_id ?? raw?.fromProvinceId;
            const toId   = raw?.to_province_id   ?? raw?.toProvinceId;
            const troops = raw?.troops_number     ?? raw?.troopCount;
            if (fromId == null || toId == null || troops == null) return null;
            const fromC = provinceCentersById[fromId];
            const toC   = provinceCentersById[toId];
            if (!fromC || !toC) return null;
            const mx = (fromC.x + toC.x) / 2;
            const my = (fromC.y + toC.y) / 2;
            const label = String(troops);
            const boxW = Math.max(28, 8 + label.length * 8);
            return (
              <g key={action.id}>
                <line x1={fromC.x} y1={fromC.y} x2={toC.x} y2={toC.y}
                  stroke="#ffffff" strokeWidth={2}
                  markerEnd="url(#troop-action-arrowhead)"
                  style={{ pointerEvents: 'none' }} />
                <rect x={mx - boxW / 2} y={my - 10} width={boxW} height={20}
                  fill="#ffffff" stroke="#000000" strokeWidth={1} rx={3} ry={3}
                  style={{ cursor: 'pointer' }}
                  onMouseDown={e => e.stopPropagation()}
                  onClick={e => { e.stopPropagation(); handleOpenCancelModal(action.id); }} />
                <text x={mx} y={my} fontSize={12} fill="#000000"
                  textAnchor="middle" dominantBaseline="middle" fontWeight="bold"
                  style={{ userSelect: 'none', cursor: 'pointer' }}
                  onMouseDown={e => e.stopPropagation()}
                  onClick={e => { e.stopPropagation(); handleOpenCancelModal(action.id); }}>
                  {label}
                </text>
              </g>
            );
          })}
        </g>
      </svg>
    </div>
  );
};
