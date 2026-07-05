import React, { useMemo } from 'react';
import { ActionType, ProvinceBuilding, Province } from '../types';
import { useAppSelector, useAppDispatch } from '../store/hooks';
import { setSelectedTroops } from '../store/slices/provincesSlice';
import type { BBox } from '../store/slices/provincesSlice';
import { BUILDING_ICONS, LANDSCAPE_ICONS, RESOURCE_ICONS } from '../constants/buildingIcons';
import type { RootState } from "../store/store.ts";
import {
  BUILDING_PENDING_COLOR,
  BUILDING_UPGRADE_AVAILABLE_COLOR,
  DEFAULT_MAP_LAND_COLOR,
  DEFAULT_MAP_WATER_COLOR,
  getCategoryModeColor,
  getMapModeTooltip,
  heatColor,
  positiveScaleColor,
} from '../utils/mapModes.ts';
import type { MapModeRenderData } from '../utils/mapModes.ts';

interface Props {
  province: Province;
  isSelected: boolean;
  onSelect: (province: Province, multi: boolean) => void;
  onRightClick: (province: Province) => void;
  bbox: BBox;
  armyTroopCount?: number;
  onArmyCountClick?: (provinceId: string) => void;
  /** undefined = no enemy armies; null = present but count unknown; number = spy-revealed total */
  enemyArmyTroopCount?: number | null;
  enemyArmyOwnerId?: string;
  mapModeRenderData: MapModeRenderData;
}

const MAP_VISIBLE_BUILDINGS = new Set(['CAPITAL', 'CAPITOL', 'FORT', 'FORESTRY', 'MINE']);

const ProvinceShapeComponent: React.FC<Props> = ({
  province,
  isSelected,
  onSelect,
  onRightClick,
  bbox,
  armyTroopCount,
  onArmyCountClick,
  enemyArmyTroopCount,
  enemyArmyOwnerId,
  mapModeRenderData,
}) => {
  const dispatch = useAppDispatch();
  const otherUsers = useAppSelector((state) => state.otherUsers.otherUsers);
  const currentUserId = useAppSelector((state) => state.user.id);
  const currentUserColor = useAppSelector((state) => state.user.color);
  const selectedTroops = useAppSelector((state) => state.provinces.selectedTroops);
  const actions = useAppSelector((state: RootState) => state.actions.actions);

  const isWater = province.type === 'water';
  const isCurrentUserProvince = province.userId === currentUserId;
  const isTroopSelected = selectedTroops?.provinceId === province.id;

  const pendingColonizeActions = useMemo(
    () => actions.filter(a => a.actionType === ActionType.COLONIZE),
    [actions],
  );

  const isColonizing = pendingColonizeActions.find((action) => action.actionData?.province_id === province.id);

  const provinceOwnerColor = useMemo(() => {
    if (!province.userId) return null;
    if (province.userId === currentUserId) return currentUserColor;
    return otherUsers.find(u => u.id === province.userId)?.color ?? null;
  }, [province.userId, currentUserId, currentUserColor, otherUsers]);

  // Color of the player whose army is stationed here (falls back to province owner).
  const enemyArmyOwnerColor = useMemo(() => {
    if (enemyArmyOwnerId) {
      return otherUsers.find(u => u.id === enemyArmyOwnerId)?.color ?? provinceOwnerColor;
    }
    return provinceOwnerColor;
  }, [enemyArmyOwnerId, otherUsers, provinceOwnerColor]);

  const normalFillColor = isWater ? DEFAULT_MAP_WATER_COLOR : (provinceOwnerColor || DEFAULT_MAP_LAND_COLOR);
  const fillColor = useMemo(() => {
    switch (mapModeRenderData.mode) {
      case 'landscape':
      case 'resource':
        return getCategoryModeColor(province, mapModeRenderData.mode, mapModeRenderData.filterValue) ?? normalFillColor;
      case 'economic': {
        if (isWater) return DEFAULT_MAP_WATER_COLOR;
        if (!isCurrentUserProvince) return DEFAULT_MAP_LAND_COLOR;
        const economy = mapModeRenderData.economyByProvinceId[province.id];
        return heatColor(economy?.net ?? 0, mapModeRenderData.economyMaxAbs);
      }
      case 'army': {
        if (isWater) return DEFAULT_MAP_WATER_COLOR;
        if (!isCurrentUserProvince) return DEFAULT_MAP_LAND_COLOR;
        const recruits = mapModeRenderData.recruitsByProvinceId[province.id] ?? 0;
        return positiveScaleColor(recruits, mapModeRenderData.recruitsMax);
      }
      case 'buildings': {
        if (isWater) return DEFAULT_MAP_WATER_COLOR;
        if (!isCurrentUserProvince) return DEFAULT_MAP_LAND_COLOR;
        const slots = mapModeRenderData.buildingSlotsByProvinceId[province.id];
        if (!slots) return DEFAULT_MAP_LAND_COLOR;
        if (slots.pendingBuilds > 0) return BUILDING_PENDING_COLOR;
        if (slots.availableUpgrades > 0) return BUILDING_UPGRADE_AVAILABLE_COLOR;
        return slots.free > 0
          ? positiveScaleColor(slots.free, Math.max(1, slots.cap))
          : heatColor(-1, 1);
      }
      case 'normal':
      default:
        return normalFillColor;
    }
  }, [mapModeRenderData, province, normalFillColor, isWater, isCurrentUserProvince]);

  const mapModeTooltip = useMemo(
    () => getMapModeTooltip(province, mapModeRenderData),
    [province, mapModeRenderData],
  );
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

  const displayTroopCount = armyTroopCount != null ? armyTroopCount : (province.localTroops ?? 0);

  const handleTroopClick = React.useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    dispatch(setSelectedTroops(
      isTroopSelected ? null : { provinceId: province.id, troopCount: displayTroopCount }
    ));
    if (!isTroopSelected) {
      onArmyCountClick?.(province.id);
    }
  }, [dispatch, province.id, displayTroopCount, isTroopSelected, onArmyCountClick]);

  const renderBuildingIcon = (building: ProvinceBuilding, index: number) => {
    const icon = BUILDING_ICONS[building.type] ?? '🏗️';
    const offsetX = (index % 2) * 15 - 7.5;
    const offsetY = Math.floor(index / 2) * 15 - 7.5;
    return (
      <text
        key={building.instanceId}
        x={cx + offsetX} y={cy + offsetY}
        fontSize="16" textAnchor="middle" dominantBaseline="middle"
        pointerEvents="none" style={{ userSelect: 'none' }}
      >
        {icon}
      </text>
    );
  };

  // Show the badge when the province is owned and has troops, OR when there are
  // army troops present regardless of ownership (e.g. naval armies on water tiles).
  const hasLocalTroops = displayTroopCount > 0 && (isCurrentUserProvince || armyTroopCount != null);

  const landscapeIcon = LANDSCAPE_ICONS[province.landscape];
  const resourceIcon = RESOURCE_ICONS[province.resourceType];

  return (
    <g>
      {mapModeTooltip && <title>{mapModeTooltip}</title>}
      {/* Base shape */}
      <path
        d={province.polygon}
        fill={isColonizing ? "#a3a3a3" : fillColor}
        stroke={strokeColor}
        strokeWidth={strokeWidth}
        onClick={handleClick}
        onContextMenu={handleRightClick}
        style={{ cursor: 'pointer', transition: 'fill 0.2s, stroke 0.2s, stroke-width 0.2s' }}
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

      {/* Enemy army indicator */}
      {!isCurrentUserProvince && enemyArmyTroopCount !== undefined && (() => {
        const armyY = troopY + (province.enemyHere ? 1 : 0);
        const hasCount = typeof enemyArmyTroopCount === 'number';
        const boxW = hasCount ? Math.max(36, 8 + String(enemyArmyTroopCount).length * 8) : 36;
        const boxX = cx - boxW / 2;
        const boxY = armyY - 10;
        const clipId = `army-badge-${province.id}`;
        return (
          <g onClick={handleTroopClick} style={{ cursor: 'pointer' }}>
            <clipPath id={clipId}>
              <rect x={boxX} y={boxY} width={boxW} height={20} rx="3" ry="3" />
            </clipPath>
            {/* Base fill */}
            <rect x={boxX} y={boxY} width={boxW} height={20}
              fill="rgb(254,202,202)" rx="3" ry="3" />
            {/* Owner color occupies the left 10% of the fill, clipped to the badge shape */}
            {enemyArmyOwnerColor && (
              <rect x={boxX} y={boxY} width={boxW * 0.1} height={20}
                fill={enemyArmyOwnerColor} clipPath={`url(#${clipId})`} pointerEvents="none" />
            )}
            {/* Border drawn last so it frames both fills */}
            <rect x={boxX} y={boxY} width={boxW} height={20}
              fill="none" stroke="rgb(153,27,27)" strokeWidth={1} rx="3" ry="3" />
            <text x={cx} y={armyY} fontSize="12" textAnchor="middle" dominantBaseline="middle"
              pointerEvents="none" style={{ userSelect: 'none' }}>
              {hasCount ? `${enemyArmyTroopCount}` : ''}
            </text>
          </g>
        );
      })()}

      {/* Own troops count */}
      {isCurrentUserProvince && hasLocalTroops && (
        <g onClick={handleTroopClick} style={{ cursor: 'pointer' }}>
          <rect x={cx - 20} y={troopY - 10} width="40" height="20"
            fill="white"
            stroke={isTroopSelected ? 'rgb(255,215,0)' : 'rgb(0,0,0)'}
            strokeWidth={isTroopSelected ? 3 : 1}
            rx="3" ry="3" />
          <text x={cx} y={troopY} fontSize="12" fill="#000"
            textAnchor="middle" dominantBaseline="middle" fontWeight="bold"
            pointerEvents="none" style={{ userSelect: 'none' }}>
            {displayTroopCount}
          </text>
        </g>
      )}

    </g>
  );
};

export const ProvinceShape = React.memo(ProvinceShapeComponent);
