import React, { useState, useCallback, useRef, useEffect } from 'react';
import type { Province } from '../types';
import { ProvinceShape } from './ProvinceShape';
import { SelectedProvinceHover } from "./SelectedProvinceHover.tsx";
import { setSelectedProvinceId } from '../store/slices/provincesSlice';
import type { RootState } from '../store/store';
import { useAppDispatch, useAppSelector } from "../store/hooks.ts";

export const MapView = ({ loading, error }: { loading: boolean, error: string | null }) => {
  const dispatch = useAppDispatch();
  const provinces = useAppSelector((state: RootState) => state.provinces.provinces);
  const selectedProvinceId = useAppSelector((state: RootState) => state.provinces.selectedProvinceId);

  // Camera state
  const [viewBox, setViewBox] = useState({ x: 0, y: 0, width: 800, height: 600 });
  const [isPanning, setIsPanning] = useState(false);
  const [startPan, setStartPan] = useState({ x: 0, y: 0 });
  const svgRef = useRef<SVGSVGElement>(null);

  const toggleSelect = (prov: Province) => {
    if (selectedProvinceId === prov.id) {
      dispatch(setSelectedProvinceId(null));
    } else {
      dispatch(setSelectedProvinceId(prov.id));
    }
  };

  // Handle mouse wheel zoom with Ctrl
  const handleWheel = useCallback((e: WheelEvent) => {
    if (!e.ctrlKey) return;

    e.preventDefault();

    const zoomFactor = e.deltaY > 0 ? 1.1 : 0.9;
    const svg = svgRef.current;
    if (!svg) return;

    // Get mouse position relative to SVG
    const rect = svg.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    // Convert to viewBox coordinates
    const mouseXInViewBox = viewBox.x + (mouseX / rect.width) * viewBox.width;
    const mouseYInViewBox = viewBox.y + (mouseY / rect.height) * viewBox.height;

    setViewBox((prev) => {
      const newWidth = prev.width * zoomFactor;
      const newHeight = prev.height * zoomFactor;

      // Zoom towards mouse position
      const newX = mouseXInViewBox - (mouseX / rect.width) * newWidth;
      const newY = mouseYInViewBox - (mouseY / rect.height) * newHeight;

      return {
        x: newX,
        y: newY,
        width: newWidth,
        height: newHeight,
      };
    });
  }, [viewBox]);

  // Handle mouse down for panning
  const handleMouseDown = useCallback((e: React.MouseEvent<SVGSVGElement>) => {
    if (e.button !== 0) return; // Only left mouse button
    if (e.target !== svgRef.current) return; // Only when clicking on background

    setIsPanning(true);
    setStartPan({ x: e.clientX, y: e.clientY });
  }, []);

  // Handle mouse move for panning
  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (!isPanning || !svgRef.current) return;

    const rect = svgRef.current.getBoundingClientRect();
    const dx = (e.clientX - startPan.x) * (viewBox.width / rect.width);
    const dy = (e.clientY - startPan.y) * (viewBox.height / rect.height);

    setViewBox((prev) => ({
      ...prev,
      x: prev.x - dx,
      y: prev.y - dy,
    }));

    setStartPan({ x: e.clientX, y: e.clientY });
  }, [isPanning, startPan, viewBox.width, viewBox.height]);

  // Handle mouse up for panning
  const handleMouseUp = useCallback(() => {
    setIsPanning(false);
  }, []);

  // Add/remove event listeners
  useEffect(() => {
    const svg = svgRef.current;
    if (!svg) return;

    svg.addEventListener('wheel', handleWheel, { passive: false });
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);

    return () => {
      svg.removeEventListener('wheel', handleWheel);
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [handleWheel, handleMouseMove, handleMouseUp]);

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
    <div style={{ position: 'relative', width: '100%', height: '100vh', background: '#0f172a' }}>
      <SelectedProvinceHover />
      <svg
        ref={svgRef}
        viewBox={`${viewBox.x} ${viewBox.y} ${viewBox.width} ${viewBox.height}`}
        style={{
          width: '100%',
          height: '100%',
          cursor: isPanning ? 'grabbing' : 'grab'
        }}
        onMouseDown={handleMouseDown}
        onClick={(e) => {
          // remove selection by click
          if (e.target instanceof SVGSVGElement) {
            dispatch(setSelectedProvinceId(null));
          }
        }}
      >
        {provinces?.map((p) => (
          <ProvinceShape
            key={p.id}
            province={p}
            isSelected={selectedProvinceId === p.id}
            onSelect={(prov) => toggleSelect(prov)}
          />
        ))}
      </svg>
    </div>
  );
};
