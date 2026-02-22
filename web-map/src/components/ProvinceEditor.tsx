import React from 'react';
import type { Province, ProvinceType, Landscape } from '../types';

interface Props {
  provinces: Province[];
  selected: Province[];
  onUpdate: (province: Province) => void;
  onMergeRegions: () => void;
  onSplitRegions: () => void;
  onDownload: () => void;
}

const landscapes: Landscape[] = ['plains', 'forest', 'mountain', 'desert', 'hills', 'swamp'];
const types: ProvinceType[] = ['land', 'coastal', 'water'];

export const ProvinceEditor: React.FC<Props> = ({
  provinces,
  selected,
  onUpdate,
  onMergeRegions,
  onSplitRegions,
  onDownload,
}) => {
  const first = selected[0];
  const isWater = first?.type === 'water';

  const handleFieldChange = (field: keyof Province, value: any) => {
    if (!first) return;
    const updated: Province = { ...first, [field]: value };
    onUpdate(updated);
  };

  return (
    <div
      style={{
        position: 'fixed',
        top: 16,
        right: 16,
        width: 320,
        background: '#1e293b',
        color: 'white',
        borderRadius: 8,
        padding: 16,
        boxShadow: '0 10px 30px rgba(0,0,0,0.4)',
        zIndex: 1000,
        fontSize: 14,
      }}
    >
      <div style={{ marginBottom: 8, display: 'flex', justifyContent: 'space-between' }}>
        <div>
          <div style={{ fontWeight: 600 }}>Редактор карты</div>
          <div style={{ fontSize: 12, opacity: 0.8 }}>
            Выделено: {selected.length}
          </div>
        </div>
        <button
          style={{
            background: '#0f172a',
            color: 'white',
            border: '1px solid #64748b',
            borderRadius: 4,
            padding: '4px 8px',
            fontSize: 12,
          }}
          onClick={onDownload}
        >
          Сохранить JSON
        </button>
      </div>

      {!first && <div>Кликните по провинции, чтобы редактировать.</div>}

      {first && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div>
            <div>ID: {first.id}</div>
            <div>Регион: {first.regionId}</div>
          </div>

          <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            Тип
            <select
              value={first.type}
              onChange={(e) => handleFieldChange('type', e.target.value as ProvinceType)}
              style={{ padding: 4, borderRadius: 4, border: '1px solid #64748b', background: '#0f172a', color: 'white' }}
            >
              {types.map((t) => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
          </label>

          <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            Ландшафт
            <select
              value={first.landscape}
              onChange={(e) => handleFieldChange('landscape', e.target.value as Landscape)}
              style={{ padding: 4, borderRadius: 4, border: '1px solid #64748b', background: '#0f172a', color: 'white' }}
            >
              {landscapes.map((l) => (
                <option key={l} value={l}>{l}</option>
              ))}
            </select>
          </label>

          {first.type !== 'water' && (
            <>
              <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                Владелец (userId)
                <input
                  value={first.ownerId ?? ''}
                  onChange={(e) => handleFieldChange('ownerId', e.target.value || null)}
                  style={{ padding: 4, borderRadius: 4, border: '1px solid #64748b', background: '#0f172a', color: 'white' }}
                />
              </label>

              <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                Ресурс (resourceId)
                <input
                  value={first.resourceId ?? ''}
                  onChange={(e) => handleFieldChange('resourceId', e.target.value || null)}
                  style={{ padding: 4, borderRadius: 4, border: '1px solid #64748b', background: '#0f172a', color: 'white' }}
                />
              </label>

              <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                Цвет провинции (hex)
                <input
                  value={first.userColor ?? ''}
                  onChange={(e) => handleFieldChange('userColor', e.target.value || null)}
                  style={{ padding: 4, borderRadius: 4, border: '1px solid #64748b', background: '#0f172a', color: 'white' }}
                />
              </label>
            </>
          )}

          <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            Войска
            <input
              type="number"
              value={first.troops}
              onChange={(e) => handleFieldChange('troops', Number(e.target.value) || 0)}
              style={{ padding: 4, borderRadius: 4, border: '1px solid #64748b', background: '#0f172a', color: 'white' }}
            />
          </label>

          <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
            <button
              style={{ flex: 1, padding: '6px 10px', borderRadius: 4, border: '1px solid #64748b', background: '#0f172a', color: 'white' }}
              onClick={onMergeRegions}
              disabled={selected.length < 2}
            >
              Объединить регионы
            </button>
            <button
              style={{ flex: 1, padding: '6px 10px', borderRadius: 4, border: '1px solid #64748b', background: '#0f172a', color: 'white' }}
              onClick={onSplitRegions}
              disabled={selected.length === 0}
            >
              Разделить регионы
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
