import React, { useState, useMemo, useEffect } from 'react';
import type { Province } from '../types';
import { provincesApi } from '../api/provinces';
import { ProvinceShape } from './ProvinceShape';
import { ProvinceEditor } from './ProvinceEditor';

export const MapView: React.FC = () => {
  const [provinces, setProvinces] = useState<Province[]>([]);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchProvinces = async () => {
      try {
        setLoading(true);
        const data = await provincesApi.getAll();
        setProvinces(data);
        setError(null);
      } catch (err) {
        setError('Failed to load provinces');
        console.error('Error fetching provinces:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchProvinces();
  }, []);

  const selectedProvinces = useMemo(
    () => provinces.filter((p) => selectedIds.includes(p.id)),
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

  const downloadJson = () => {
    const blob = new Blob([JSON.stringify(provinces, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'provinces.json';
    a.click();
    URL.revokeObjectURL(url);
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
        {provinces.map((p) => (
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
        onDownload={downloadJson}
      />
    </div>
  );
};
