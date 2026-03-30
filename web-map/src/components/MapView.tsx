import React, { useState, useCallback, useRef, useEffect } from 'react';
import type { Province } from '../types';
import { ProvinceShape } from './ProvinceShape';
import { SelectedProvinceHover } from "./SelectedProvinceHover.tsx";
import { TroopMovementModal } from './TroopMovementModal';
import { setSelectedProvinceId, setSelectedTroops } from '../store/slices/provincesSlice';
import type { RootState } from '../store/store';
import { useAppDispatch, useAppSelector } from "../store/hooks.ts";

export const MapView = ({ loading, error }: { loading: boolean, error: string | null }) => {
  const dispatch = useAppDispatch();
  const provinces = useAppSelector((state: RootState) => state.provinces.provinces);
  const selectedProvinceId = useAppSelector((state: RootState) => state.provinces.selectedProvinceId);
  const selectedTroops = useAppSelector((state: RootState) => state.provinces.selectedTroops);
  const currentUserId = useAppSelector((state: RootState) => state.user.id);

  // Camera state
  const [viewBox, setViewBox] = useState({ x: 0, y: 0, width: 800, height: 600 });
  const [isDragging, setIsDragging] = useState(false);
  const dragStartRef = useRef<{ x: number; y: number } | null>(null);
  const lastMousePosRef = useRef<{ x: number; y: number } | null>(null);
  const hasDraggedRef = useRef(false);
  const svgRef = useRef<SVGSVGElement>(null);

  // Troop movement modal state
  const [modalState, setModalState] = useState<{
    open: boolean;
    fromProvinceId: string;
    toProvinceId: string;
    maxTroops: number;
    isInvasion: boolean;
  } | null>(null);

  const toggleSelect = useCallback((prov: Province) => {
    // Prevent selection if we just finished dragging
    if (hasDraggedRef.current) {
      return;
    }

    if (selectedProvinceId === prov.id) {
      dispatch(setSelectedProvinceId(null));
    } else {
      dispatch(setSelectedProvinceId(prov.id));
    }
  }, [dispatch, selectedProvinceId]);

  const handleProvinceRightClick = useCallback((targetProvince: Province) => {
    // Check if troops are selected
    if (!selectedTroops) return;

    // Find the source province
    const sourceProvince = provinces.find(p => p.id === selectedTroops.provinceId);
    if (!sourceProvince) return;

    // Check if target province is a neighbor
    if (!sourceProvince.neighbors?.includes(targetProvince.id)) {
      return; // Not a neighbor, do nothing
    }

    // Determine if it's an invasion or transfer
    const isInvasion = targetProvince.userId !== currentUserId;

    // Open modal
    setModalState({
      open: true,
      fromProvinceId: sourceProvince.id,
      toProvinceId: targetProvince.id,
      maxTroops: selectedTroops.troopCount,
      isInvasion,
    });
  }, [selectedTroops, provinces, currentUserId]);

  const handleCloseModal = useCallback(() => {
    setModalState(null);
  }, []);

  // Add/remove event listeners for wheel zoom
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

      setViewBox((prev) => {
        const mouseXInViewBox = prev.x + (mouseX / rect.width) * prev.width;
        const mouseYInViewBox = prev.y + (mouseY / rect.height) * prev.height;

        const newWidth = prev.width * zoomFactor;
        const newHeight = prev.height * zoomFactor;

        const newX = mouseXInViewBox - (mouseX / rect.width) * newWidth;
        const newY = mouseYInViewBox - (mouseY / rect.height) * newHeight;

        return { x: newX, y: newY, width: newWidth, height: newHeight };
      });
    };

    svg.addEventListener('wheel', handleWheel, { passive: false });
    return () => svg.removeEventListener('wheel', handleWheel);
  }, [loading]);

  // Handle dragging with document-level listeners
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isDragging || !lastMousePosRef.current || !svgRef.current) return;

      const deltaX = e.clientX - lastMousePosRef.current.x;
      const deltaY = e.clientY - lastMousePosRef.current.y;

      // Mark as dragged if moved more than threshold
      if (!hasDraggedRef.current && (Math.abs(deltaX) > 3 || Math.abs(deltaY) > 3)) {
        hasDraggedRef.current = true;
      }

      if (hasDraggedRef.current) {
        const rect = svgRef.current.getBoundingClientRect();
        const scaleX = viewBox.width / rect.width;
        const scaleY = viewBox.height / rect.height;

        setViewBox((prev) => ({
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

        // Reset drag flag after a short delay
        setTimeout(() => {
          hasDraggedRef.current = false;
        }, 50);
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
    if (e.button !== 0) return; // Only left button

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
    <div style={{ position: 'relative', width: '100%', height: '100vh', background: '#1e293b' }}>
      <SelectedProvinceHover />

      {/* Troop Movement Modal */}
      {modalState && (
        <TroopMovementModal
          open={modalState.open}
          onClose={handleCloseModal}
          fromProvinceId={modalState.fromProvinceId}
          toProvinceId={modalState.toProvinceId}
          maxTroops={modalState.maxTroops}
          isInvasion={modalState.isInvasion}
        />
      )}

      <svg
        ref={svgRef}
        viewBox={`${viewBox.x} ${viewBox.y} ${viewBox.width} ${viewBox.height}`}
        style={{
          width: '100%',
          height: '100%',
          cursor: isDragging ? 'grabbing' : 'grab',
          background: '#334155' // Lighter background for better province visibility
        }}
        onMouseDown={handleSvgMouseDown}
        onClick={(e) => {
          // remove selection by click on background
          if (e.target instanceof SVGSVGElement) {
            dispatch(setSelectedProvinceId(null));
            dispatch(setSelectedTroops(null));
          }
        }}
      >
        {/* Render provinces first */}
        {provinces?.map((p) => (
          <ProvinceShape
            key={p.id}
            province={p}
            isSelected={selectedProvinceId === p.id}
            onSelect={(prov) => toggleSelect(prov)}
            onRightClick={(prov) => handleProvinceRightClick(prov)}
            renderTroopBox={false}
          />
        ))}

        {/* Render troop boxes on top layer */}
        {provinces?.map((p) => (
          <ProvinceShape
            key={`${p.id}-troops`}
            province={p}
            isSelected={selectedProvinceId === p.id}
            onSelect={(prov) => toggleSelect(prov)}
            onRightClick={(prov) => handleProvinceRightClick(prov)}
            renderTroopBox={true}
          />
        ))}
      </svg>
    </div>
  );
};
