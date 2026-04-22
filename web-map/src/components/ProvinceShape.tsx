import React, { useMemo } from 'react';
import { Building, Province } from '../types';
import { useAppSelector, useAppDispatch } from '../store/hooks';
import { setSelectedTroops } from '../store/slices/provincesSlice';
import type { BBox } from '../store/slices/provincesSlice';
import { BUILDING_ICONS, LANDSCAPE_ICONS, RESOURCE_ICONS } from '../constants/buildingIcons';

interface PendingDeployAction {
  id: string;
  troopsNumber: number;
}

interface Props {
  province: Province;
  isSelected: boolean;
  onSelect: (province: Province, multi: boolean) => void;
  onRightClick: (province: Province) => void;
  pendingDeployAction?: PendingDeployAction;
  onCancelAction?: (actionId: string) => void;
  bbox: BBox;
}

const MAP_VISIBLE_BUILDINGS = new Set(['CAPITAL', 'CAPITOL', 'FORT', 'FORESTRY', 'MINE']);

const WATER_COLOR = 'rgb(174, 226, 255)';
const DEFAULT_LAND_COLOR = 'rgb(255, 255, 255)';

const ProvinceShapeComponent: React.FC<Props> = ({
  province,
  isSelected,
  onSelect,
  onRightClick,
  pendingDeployAction,
  onCancelAction,
  bbox,
}) => {
  const dispatch = useAppDispatch();
  const otherUsers = useAppSelector((state) => state.otherUsers.otherUsers);
  const currentUserId = useAppSelector((state) => state.user.id);
  const currentUserColor = useAppSelector((state) => state.user.color);
  const selectedTroops = useAppSelector((state) => state.provinces.selectedTroops);

  const isWater = province.type === 'water';
  const isCurrentUserProvince = province.userId === currentUserId;
  const isTroopSelected = selectedTroops?.provinceId === province.id;

  const provinceOwnerColor = useMemo(() => {
    if (!province.userId) return null;
    if (province.userId === currentUserId) return currentUserColor;
    return otherUsers.find(u => u.id === province.userId)?.color ?? null;
  }, [province.userId, currentUserId, currentUserColor, otherUsers]);

  const fillColor = isWater ? WATER_COLOR : (provinceOwnerColor || DEFAULT_LAND_COLOR);
  const strokeColor = isSelected ? 'rgb(255, 255, 0)' : 'rgb(0, 0, 0)';
  const strokeWidth = isSelected ? 4 : 2;

  const cx = bbox.x + bbox.width / 2;
  const cy = bbox.y + bbox.height / 2;

  const visibleBuildings = useMemo(() =>
    (province.buildings ?? []).filter(b => MAP_VISIBLE_BUILDINGS.has(b.type)),
    [province.buildings],
  );

  const hasVisibleBuildings = visibleBuildings.length > 0;
  const troopY = cy + (hasVisibleBuildings ? 25 : 0);

  const handleClick: React.MouseEventHandler<SVGPathElement> = React.useCallback((e) => {
    e.stopPropagation();
    dispatch(setSelectedTroops(null));
    onSelect(province, e.ctrlKey || e.metaKey || e.shiftKey);
  }, [onSelect, province, dispatch]);

  const handleRightClick: React.MouseEventHandler<SVGPathElement> = React.useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    onRightClick(province);
  }, [onRightClick, province]);

  const handleTroopClick = React.useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    dispatch(setSelectedTroops(
      isTroopSelected ? null : { provinceId: province.id, troopCount: province.localTroops || 0 }
    ));
  }, [dispatch, province.id, province.localTroops, isTroopSelected]);

  const renderBuildingIcon = (building: Building, index: number) => {
    const icon = BUILDING_ICONS[building.type] ?? '🏗️';
    const offsetX = (index % 2) * 15 - 7.5;
    const offsetY = Math.floor(index / 2) * 15 - 7.5;
    return (
      <text
        key={building.id}
        x={cx + offsetX} y={cy + offsetY}
        fontSize="16" textAnchor="middle" dominantBaseline="middle"
        pointerEvents="none" style={{ userSelect: 'none' }}
      >
        {icon}
      </text>
    );
  };

  const hasLocalTroops = isCurrentUserProvince && province.localTroops != null && province.localTroops > 0;
  const deployLabel = (pendingDeployAction && isCurrentUserProvince) ? `+${pendingDeployAction.troopsNumber}` : null;

  const landscapeIcon = LANDSCAPE_ICONS[province.landscape];
  const resourceIcon = RESOURCE_ICONS[province.resourceType];

  return (
    <g>
      {/* Base shape */}
      <path
        d={province.polygon}
        fill={fillColor}
        stroke={strokeColor}
        strokeWidth={strokeWidth}
        onClick={handleClick}
        onContextMenu={handleRightClick}
        style={{ cursor: 'pointer', transition: 'stroke 0.2s, stroke-width 0.2s' }}
      />

      {/* Landscape icon — top-left corner */}
      {!isWater && landscapeIcon && (
        <text
          x={bbox.x + 6} y={bbox.y + 10}
          fontSize="10" textAnchor="start" dominantBaseline="middle"
          pointerEvents="none" style={{ userSelect: 'none' }}
        >
          {landscapeIcon}
        </text>
      )}

      {/* Resource icon — next to landscape icon */}
      {!isWater && resourceIcon && (
        <text
          x={bbox.x + 20} y={bbox.y + 10}
          fontSize="10" textAnchor="start" dominantBaseline="middle"
          pointerEvents="none" style={{ userSelect: 'none' }}
        >
          {resourceIcon}
        </text>
      )}

      {/* Building icons (map-visible only) */}
      {visibleBuildings.map((b, i) => renderBuildingIcon(b, i))}

      {/* Enemy troops indicator */}
      {!isCurrentUserProvince && province.enemyHere && (
        <g>
          <rect x={cx - 20} y={troopY - 10} width="40" height="20"
            fill="white" stroke="rgb(0,0,0)" strokeWidth={1} rx="3" ry="3" />
          <text x={cx} y={troopY} fontSize="12" textAnchor="middle" dominantBaseline="middle"
            pointerEvents="none" style={{ userSelect: 'none' }}>
            🪖
          </text>
        </g>
      )}

      {/* Own troops count */}
      {hasLocalTroops && (
        <g onClick={handleTroopClick} style={{ cursor: 'pointer' }}>
          <rect x={cx - 20} y={troopY - 10} width="40" height="20"
            fill="white"
            stroke={isTroopSelected ? 'rgb(255,215,0)' : 'rgb(0,0,0)'}
            strokeWidth={isTroopSelected ? 3 : 1}
            rx="3" ry="3" />
          <text x={cx} y={troopY} fontSize="12" fill="#000"
            textAnchor="middle" dominantBaseline="middle" fontWeight="bold"
            pointerEvents="none" style={{ userSelect: 'none' }}>
            {province.localTroops}
          </text>
        </g>
      )}

      {/* Pending deploy indicator */}
      {deployLabel && (
        <g
          onMouseDown={(e) => e.stopPropagation()}
          onClick={(e) => { e.stopPropagation(); onCancelAction?.(pendingDeployAction!.id); }}
          style={{ cursor: 'pointer' }}
        >
          <rect
            x={cx - 20} y={hasLocalTroops ? troopY + 12 : troopY - 10}
            width="40" height="20"
            fill="white" stroke="rgb(34,197,94)" strokeWidth={1} rx="3" ry="3" />
          <text
            x={cx} y={hasLocalTroops ? troopY + 22 : troopY}
            fontSize="12" fill="rgb(34,197,94)" textAnchor="middle" dominantBaseline="middle"
            fontWeight="bold" pointerEvents="none" style={{ userSelect: 'none' }}>
            {deployLabel}
          </text>
        </g>
      )}
    </g>
  );
};

export const ProvinceShape = React.memo(ProvinceShapeComponent);
