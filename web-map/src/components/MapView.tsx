import React, { useState, useMemo } from 'react';
import type { Province } from '../types';
import provincesData from '../data/provinces.json';
import { ProvinceShape } from './ProvinceShape';
import { ProvinceEditor } from './ProvinceEditor';

const typedProvinces = provincesData as Province[];

export const MapView: React.FC = () => {
  const [provinces, setProvinces] = useState<Province[]>(typedProvinces);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

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

  return (
    <div style={{ position: 'relative', width: '100%', height: '100vh', background: '#0f172a' }}>
      <svg
        viewBox="0 0 800 600"
        style={{ width: '100%', height: '100%' }}
        onClick={(e) => {
          // клик по пустому месту снимает выделение
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
        provinces={provinces}
        selected={selectedProvinces}
        onUpdate={updateProvince}
        onMergeRegions={mergeSelectedRegions}
        onSplitRegions={splitSelectedRegions}
        onDownload={downloadJson}
      />
    </div>
  );
};
