import React, { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import type { Province } from '../types';
import { ActionType, BuildingTypes } from '../types';
import { Box, Button, Modal, Typography } from '@mui/material';
import { ProvinceShape } from './ProvinceShape';
import { SelectedProvinceHover } from "./SelectedProvinceHover.tsx";
import { TroopMovementModal } from './TroopMovementModal';
import { ArmyBlock } from './ArmyBlock.tsx';
import { CreateArmyModal } from './CreateArmyModal.tsx';
import { setSelectedProvinceId, setSelectedTroops, updateProvinceById } from '../store/slices/provincesSlice';
import type { RootState } from '../store/store';
import { useAppDispatch, useAppSelector } from "../store/hooks.ts";
import { actionsApi } from '../api/actions.ts';
import { removeActionById } from '../store/slices/actionsSlice.ts';

export const MapView = ({ loading, error }: { loading: boolean, error: string | null }) => {
  const dispatch = useAppDispatch();
  const provinces = useAppSelector((state: RootState) => state.provinces.provinces);
  const selectedProvinceId = useAppSelector((state: RootState) => state.provinces.selectedProvinceId);
  const userActions = useAppSelector((state: RootState) => state.actions.actions);
  const provinceCentersById = useAppSelector((state: RootState) => state.provinces.provinceCentersById);
  const provinceBBoxById = useAppSelector((state: RootState) => state.provinces.provinceBBoxById);
  const armies = useAppSelector((state: RootState) => state.armies.armies);
  const currentUserId = useAppSelector((state: RootState) => state.user.id);
  const completedResearch = useAppSelector((state: RootState) => state.user.completedResearch);
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
    armyId: string;
    armyName: string;
    toProvinceId: string;
  } | null>(null);
  const [cancelActionId, setCancelActionId] = useState<string | null>(null);
  const [isCancellingAction, setIsCancellingAction] = useState(false);
  const [cancelError, setCancelError] = useState<string | null>(null);
  const [selectedArmyId, setSelectedArmyId] = useState<string | null>(null);
  const [showCreateArmy, setShowCreateArmy] = useState(false);

  const toggleSelect = useCallback((prov: Province) => {
    if (hasDraggedRef.current) return;
    dispatch(setSelectedProvinceId(selectedProvinceId === prov.id ? null : prov.id));
    setSelectedArmyId(null);
  }, [dispatch, selectedProvinceId]);

  // ── Reachable provinces from selected army (BFS matching BE logic) ────────
  const reachableFromSelectedArmy = useMemo((): Set<string> | null => {
    if (!selectedArmyId) return null;
    const army = armies.find(a => a.id === selectedArmyId);
    if (!army) return null;
    const fromProvince = provinces.find(p => p.id === army.province_id);
    if (!fromProvince) return null;

    const reachable = new Set<string>();
    // Direct neighbors always reachable
    for (const nId of (fromProvince.neighbors ?? [])) reachable.add(nId);

    // Road extension
    const hasRoad = fromProvince.buildings?.some(b => b.type === BuildingTypes.ROAD);
    if (hasRoad) {
      const maxHops = completedResearch.includes('military.best_logistics') ? 3 : 2;
      const visited = new Set<string>([fromProvince.id]);
      let frontier: Province[] = [fromProvince];
      for (let hop = 0; hop < maxHops; hop++) {
        const nextFrontier: Province[] = [];
        for (const current of frontier) {
          for (const neighborId of (current.neighbors ?? [])) {
            if (visited.has(neighborId)) continue;
            visited.add(neighborId);
            const neighbor = provinces.find(p => p.id === neighborId);
            const neighborHasRoad = neighbor?.buildings?.some(b => b.type === BuildingTypes.ROAD) ?? false;
            if (neighborHasRoad && neighbor?.userId === currentUserId) {
              reachable.add(neighborId);
              if (hop < maxHops - 1) {
                nextFrontier.push(neighbor);
              }
            }
          }
        }
        frontier = nextFrontier;
        if (!frontier.length) break;
      }
    }
    reachable.delete(army.province_id);
    return reachable;
  }, [selectedArmyId, armies, provinces, currentUserId, completedResearch]);

  const handleProvinceRightClick = useCallback((targetProvince: Province) => {
    if (!selectedArmyId || !reachableFromSelectedArmy) return;
    if (!reachableFromSelectedArmy.has(targetProvince.id)) return;
    const army = armies.find(a => a.id === selectedArmyId);
    if (!army) return;
    setModalState({
      open: true,
      armyId: selectedArmyId,
      armyName: army.name ?? 'Unnamed Army',
      toProvinceId: targetProvince.id,
    });
  }, [selectedArmyId, armies, reachableFromSelectedArmy]);

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
    return userActions.filter(a => a.actionType === ActionType.ARMY_MOVE);
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

  // ── Army troop counts per province ───────────────────────────────────────
  const armyTroopsByProvinceId = useMemo(() => {
    const map: Record<string, number> = {};
    for (const army of armies) {
      const total = army.units.reduce((s, u) => s + u.count, 0);
      map[army.province_id] = (map[army.province_id] ?? 0) + total;
    }
    return map;
  }, [armies]);

  const armiesByProvinceId = useMemo(() => {
    const map: Record<string, typeof armies> = {};
    for (const army of armies) {
      if (!map[army.province_id]) map[army.province_id] = [];
      map[army.province_id].push(army);
    }
    return map;
  }, [armies]);

  // Enemy army presence per province: null = present/unknown count, number = spy-revealed total
  const enemyArmyInfoByProvinceId = useMemo(() => {
    const map: Record<string, number | null> = {};
    for (const army of armies) {
      if (army.user_id === currentUserId) continue;
      const prev = map[army.province_id];
      if (army.totalTroops != null) {
        map[army.province_id] = prev === undefined ? army.totalTroops : (prev === null ? null : prev + army.totalTroops);
      } else {
        map[army.province_id] = null; // present but count unknown
      }
    }
    return map;
  }, [armies, currentUserId]);

  // ── Road lines (center-to-center for neighboring road provinces) ─────────
  const roadLines = useMemo(() => {
    const roadProvinceIds = new Set(
      provinces
        .filter(p => p.buildings?.some(b => b.type === BuildingTypes.ROAD))
        .map(p => p.id),
    );
    const lines: { x1: number; y1: number; x2: number; y2: number; key: string }[] = [];
    const drawn = new Set<string>();
    for (const p of provinces) {
      if (!roadProvinceIds.has(p.id)) continue;
      for (const neighborId of (p.neighbors ?? [])) {
        if (!roadProvinceIds.has(neighborId)) continue;
        const key = [p.id, neighborId].sort().join('|');
        if (drawn.has(key)) continue;
        drawn.add(key);
        const c1 = provinceCentersById[p.id];
        const c2 = provinceCentersById[neighborId];
        if (!c1 || !c2) continue;
        lines.push({ x1: c1.x, y1: c1.y, x2: c2.x, y2: c2.y, key });
      }
    }
    return lines;
  }, [provinces, provinceCentersById]);

  const handleArmyCountClick = useCallback((provinceId: string) => {
    dispatch(setSelectedProvinceId(provinceId));
    const provincArmies = armiesByProvinceId[provinceId] ?? [];
    if (provincArmies.length === 1) {
      setSelectedArmyId(provincArmies[0].id);
    } else {
      setSelectedArmyId(null);
    }
  }, [dispatch, armiesByProvinceId]);

  const selectedArmy = useMemo(
    () => (selectedArmyId ? armies.find((a) => a.id === selectedArmyId) ?? null : null),
    [selectedArmyId, armies],
  );

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
      <SelectedProvinceHover
        selectedArmyId={selectedArmyId}
        onSelectArmy={(id) => setSelectedArmyId(id)}
        onCreateArmy={() => setShowCreateArmy(true)}
      />
      {selectedArmy && (
        <div style={{ position: 'absolute', top: '1rem', right: '310px' }}>
          <ArmyBlock army={selectedArmy} onClose={() => setSelectedArmyId(null)} />
        </div>
      )}
      {showCreateArmy && selectedProvinceId && (
        <CreateArmyModal
          open={showCreateArmy}
          provinceId={selectedProvinceId}
          onClose={() => setShowCreateArmy(false)}
          onCreated={() => setShowCreateArmy(false)}
        />
      )}

      {modalState && (
        <TroopMovementModal
          open={modalState.open}
          onClose={handleCloseModal}
          armyId={modalState.armyId}
          armyName={modalState.armyName}
          toProvinceId={modalState.toProvinceId}
          onConfirmed={() => setSelectedArmyId(null)}
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
            setSelectedArmyId(null);
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
            armyTroopCount={armyTroopsByProvinceId[p.id]}
            onArmyCountClick={handleArmyCountClick}
            enemyArmyTroopCount={enemyArmyInfoByProvinceId[p.id]}
          />
        ))}

        {/* Road lines */}
        <g pointerEvents="none">
          {roadLines.map(l => (
            <line key={l.key}
              x1={l.x1} y1={l.y1} x2={l.x2} y2={l.y2}
              stroke="#92400e" strokeWidth={3} strokeDasharray="6 4" opacity={0.7}
            />
          ))}
        </g>

        {/* Army move arrows */}
        <g>
          {troopMovementOverlays.map(action => {
            const raw = action.actionData as {
              army_id?: string; to_province_id?: string;
            } | undefined;
            const toId = raw?.to_province_id;
            const army = armies.find(a => a.id === raw?.army_id);
            const fromId = army?.province_id;
            if (!fromId || !toId) return null;
            const fromC = provinceCentersById[fromId];
            const toC   = provinceCentersById[toId];
            if (!fromC || !toC) return null;
            const mx = (fromC.x + toC.x) / 2;
            const my = (fromC.y + toC.y) / 2;
            const label = army?.name ?? '⚔';
            const boxW = Math.max(28, 8 + label.length * 7);
            return (
              <g key={action.id}>
                <line x1={fromC.x} y1={fromC.y} x2={toC.x} y2={toC.y}
                  stroke="#fbbf24" strokeWidth={2}
                  markerEnd="url(#troop-action-arrowhead)"
                  style={{ pointerEvents: 'none' }} />
                <rect x={mx - boxW / 2} y={my - 10} width={boxW} height={20}
                  fill="#fbbf24" stroke="#92400e" strokeWidth={1} rx={3} ry={3}
                  style={{ cursor: 'pointer' }}
                  onMouseDown={e => e.stopPropagation()}
                  onClick={e => { e.stopPropagation(); handleOpenCancelModal(action.id); }} />
                <text x={mx} y={my} fontSize={11} fill="#1c1917"
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
