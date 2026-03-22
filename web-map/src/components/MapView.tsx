import React, { useState, useMemo, useCallback } from 'react';
import type { Province } from '../types';
import { provincesApi } from '../api/provinces';
import { ProvinceShape } from './ProvinceShape';
import { ProvinceEditor } from './ProvinceEditor';
import { useQuery } from '../hooks/useApi';

export const MapView: React.FC = () => {
  const fetchProvinces = useCallback(() => provincesApi.getAll(), []);
  const { data: provinces, loading, error, setData: setProvinces } = useQuery(fetchProvinces, []);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  const selectedProvinces = useMemo(
    () => provinces?.filter((p) => selectedIds.includes(p.id)) ?? [],
    [provinces, selectedIds]
  );

  const toggleSelect = (prov: Province, multi: boolean) => {
    setSelectedIds((prev) => {
      if (multi) {
        if (prev.includes(prov.id)) {
          return prev.filter((id) => id !== prov.id);
        }
        return [...prev, prov.id];
      } else {
        if (prev.length === 1 && prev[0] === prov.id) return [];
        return [prov.id];
      }
    });
  };

  const updateProvince = (updated: Province) => {
    setProvinces((prev) => prev.map((p) => (p.id === updated.id ? updated : p)));
  };

  const mergeSelectedRegions = () => {
    if (selectedIds.length < 2) return;
    const mainId = selectedIds[0];
    setProvinces((prev) =>
      prev.map((p) =>
        selectedIds.includes(p.id)
          ? { ...p, regionId: mainId }
          : p
      )
    );
  };

  const splitSelectedRegions = () => {
    setProvinces((prev) =>
      prev.map((p) =>
        selectedIds.includes(p.id)
          ? { ...p, regionId: p.id }
          : p
      )
    );
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
    <div style={{ position: 'relative', width: '100%', height: '100vh', background: '#0f172a' }}>
      <svg
        viewBox="0 0 800 600"
        style={{ width: '100%', height: '100%' }}
        onClick={(e) => {
          // remove selection by click
          if (e.target instanceof SVGSVGElement) {
            setSelectedIds([]);
          }
        }}
      >
        {provinces?.map((p) => (
          <ProvinceShape
            key={p.id}
            province={p}
            isSelected={selectedIds.includes(p.id)}
            onSelect={(prov, multi) => toggleSelect(prov, multi)}
          />
        ))}
      </svg>

      <ProvinceEditor
        selected={selectedProvinces}
        onUpdate={updateProvince}
        onMergeRegions={mergeSelectedRegions}
        onSplitRegions={splitSelectedRegions}
      />
    </div>
  );
};
