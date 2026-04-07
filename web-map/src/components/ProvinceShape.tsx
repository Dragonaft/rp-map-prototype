import React, { useMemo } from 'react';
import { Building, Province } from '../types';
import { useAppSelector, useAppDispatch } from '../store/hooks';
import { setProvinceCenter, setSelectedTroops } from '../store/slices/provincesSlice';

interface PendingBuildAction {
  id: string;
  buildingType: string;
}

interface PendingDeployAction {
  id: string;
  troopsNumber: number;
}

interface Props {
  province: Province;
  isSelected: boolean;
  onSelect: (province: Province, multi: boolean) => void;
  onRightClick: (province: Province) => void;
  renderTroopBox?: boolean;
  pendingBuildActions?: PendingBuildAction[];
  pendingDeployAction?: PendingDeployAction;
  onCancelAction?: (actionId: string) => void;
}

const buildingIcons: Record<string, string> = {
  CAPITAL: '🏰',
  FARM: '🌾',
  BARRACKS: '⚔️',
  FORT: '🛡️',
  MARKET: '💰',
};

const WATER_COLOR = 'rgb(174, 226, 255)'; // Match the PNG color rgb(174,226,255)
const DEFAULT_LAND_COLOR = 'rgb(255, 255, 255)'; // White for unclaimed land provinces

const ProvinceShapeComponent: React.FC<Props> = ({ province, isSelected, onSelect, onRightClick, renderTroopBox = false, pendingBuildActions = [], pendingDeployAction, onCancelAction }) => {
  const dispatch = useAppDispatch();
  const otherUsers = useAppSelector((state) => state.otherUsers.otherUsers);
  const currentUserId = useAppSelector((state) => state.user.id);
  const currentUserColor = useAppSelector((state) => state.user.color);
  const selectedTroops = useAppSelector((state) => state.provinces.selectedTroops);
  const provincesLayoutVersion = useAppSelector((state) => state.provinces.provincesLayoutVersion);

  const isWater = province.type === 'water';

  // Find the owner of this province
  const provinceOwnerColor = useMemo(() => {
    if (!province.userId) return null;

    // Check if it's the current user's province
    if (province.userId === currentUserId) {
      return currentUserColor;
    }

    // Check if it's another user's province
    const owner = otherUsers.find(user => user.id === province.userId);
    return owner?.color;
  }, [province.userId, currentUserId, currentUserColor, otherUsers]);

  const fillColor = isWater ? WATER_COLOR : (provinceOwnerColor || DEFAULT_LAND_COLOR);
  const strokeColor = isSelected ? 'rgb(255, 255, 0)' : 'rgb(0, 0, 0)'; // Yellow selection, black borders
  const strokeWidth = isSelected ? 4 : 2; // Thicker borders for visibility

  const handleClick: React.MouseEventHandler<SVGPathElement> = React.useCallback((e) => {
    e.stopPropagation();

    // Deselect troops when clicking on a province
    dispatch(setSelectedTroops(null));

    const multi = e.ctrlKey || e.metaKey || e.shiftKey;
    onSelect(province, multi);
  }, [onSelect, province, dispatch]);

  const handleRightClick: React.MouseEventHandler<SVGPathElement> = React.useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();

    onRightClick(province);
  }, [onRightClick, province]);

  // Don't add any mousedown handler - let it naturally bubble to SVG

  // Calculate the bounding box to position text near the bottom
  const [pathBBox, setPathBBox] = React.useState<DOMRect | null>(null);
  const pathRef = React.useRef<SVGPathElement>(null);

  React.useEffect(() => {
    if (!pathRef.current) return;
    const bbox = pathRef.current.getBBox();
    setPathBBox(bbox as DOMRect);
    if (!renderTroopBox) {
      dispatch(
        setProvinceCenter({
          id: province.id,
          x: bbox.x + bbox.width / 2,
          y: bbox.y + bbox.height / 2,
        }),
      );
    }
  }, [province.polygon, provincesLayoutVersion, renderTroopBox, province.id, dispatch]);

  const isCurrentUserProvince = province.userId === currentUserId;
  const isTroopSelected = selectedTroops?.provinceId === province.id;

  // Handle troop box click
  const handleTroopClick = React.useCallback((e: React.MouseEvent) => {
    e.stopPropagation();

    if (isTroopSelected) {
      // Deselect if already selected
      dispatch(setSelectedTroops(null));
    } else {
      // Select this troop
      dispatch(setSelectedTroops({
        provinceId: province.id,
        troopCount: province.localTroops || 0,
      }));
    }
  }, [dispatch, province.id, province.localTroops, isTroopSelected]);

  const renderBuildingIcon = (building: Building, index: number) => {
    if (!pathBBox) return null;

    const icon = buildingIcons[building.type] ?? '🏗️';

    const centerX = pathBBox.x + pathBBox.width / 2;
    const centerY = pathBBox.y + pathBBox.height / 2;
    const offsetX = (index % 2) * 15 - 7.5;
    const offsetY = Math.floor(index / 2) * 15 - 7.5;

    return (
      <text
        key={building.id}
        x={centerX + offsetX}
        y={centerY + offsetY}
        fontSize="16"
        textAnchor="middle"
        dominantBaseline="middle"
        pointerEvents="none"
        style={{ userSelect: 'none' }}
      >
        {icon}
      </text>
    );
  };

  const renderPendingBuildIcon = (action: PendingBuildAction, index: number) => {
    if (!pathBBox) return null;

    const icon = (action.buildingType ? buildingIcons[action.buildingType] : undefined) ?? '🏗️';

    const centerX = pathBBox.x + pathBBox.width / 2;
    const centerY = pathBBox.y + pathBBox.height / 2;
    const offsetX = (index % 2) * 15 - 7.5;
    const offsetY = Math.floor(index / 2) * 15 - 7.5;

    return (
      <text
        key={action.id}
        x={centerX + offsetX}
        y={centerY + offsetY}
        fontSize="16"
        textAnchor="middle"
        dominantBaseline="middle"
        opacity={0.5}
        style={{ userSelect: 'none', cursor: 'pointer' }}
        onMouseDown={(e) => e.stopPropagation()}
        onClick={(e) => {
          e.stopPropagation();
          onCancelAction?.(action.id);
        }}
      >
        {icon}
      </text>
    );
  };

  return (
    <g>
      <path
        ref={pathRef}
        d={province.polygon}
        fill={renderTroopBox ? 'none' : fillColor}
        stroke={renderTroopBox ? 'none' : strokeColor}
        strokeWidth={renderTroopBox ? 0 : strokeWidth}
        onClick={renderTroopBox ? undefined : handleClick}
        onContextMenu={renderTroopBox ? undefined : handleRightClick}
        style={renderTroopBox ? { pointerEvents: 'none' } : { cursor: 'pointer', transition: 'stroke 0.2s, stroke-width 0.2s' }}
      />

      {!renderTroopBox && (
        <>
          {/* Show building icons if province has buildings */}
          {province.buildings && province.buildings.length > 0 &&
            province.buildings.map((building, index) => renderBuildingIcon(building, index))
          }
          {/* Show half-transparent pending build icons */}
          {pendingBuildActions.map((action, i) =>
            renderPendingBuildIcon(action, (province.buildings?.length ?? 0) + i)
          )}
        </>
      )}

      {/* Show soldier icon on non-user provinces that have enemy troops */}
      {renderTroopBox && !isCurrentUserProvince && province.enemyHere && pathBBox && (
        <g>
          <rect
            x={pathBBox.x + pathBBox.width / 2 - 20}
            y={pathBBox.y + pathBBox.height / 2 + (province.buildings && province.buildings.length > 0 ? 25 : 0) - 10}
            width="40"
            height="20"
            fill="white"
            stroke="rgb(0, 0, 0)"
            strokeWidth={1}
            rx="3"
            ry="3"
          />
          <text
            x={pathBBox.x + pathBBox.width / 2}
            y={pathBBox.y + pathBBox.height / 2 + (province.buildings && province.buildings.length > 0 ? 25 : 0)}
            fontSize="12"
            textAnchor="middle"
            dominantBaseline="middle"
            pointerEvents="none"
            style={{ userSelect: 'none' }}
          >
            🪖
          </text>
        </g>
      )}

      {/* Show local troops count for current user's provinces in a white box */}
      {renderTroopBox && isCurrentUserProvince && pathBBox && (() => {
        const cx = pathBBox.x + pathBBox.width / 2;
        const troopY = pathBBox.y + pathBBox.height / 2 + (province.buildings && province.buildings.length > 0 ? 25 : 0);
        const hasLocalTroops = province.localTroops != null && province.localTroops > 0;
        const deployLabel = pendingDeployAction ? `+${pendingDeployAction.troopsNumber}` : null;

        return (
          <>
            {hasLocalTroops && (
              <g onClick={handleTroopClick} style={{ cursor: 'pointer' }}>
                <rect
                  x={cx - 20}
                  y={troopY - 10}
                  width="40"
                  height="20"
                  fill="white"
                  stroke={isTroopSelected ? 'rgb(255, 215, 0)' : 'rgb(0, 0, 0)'}
                  strokeWidth={isTroopSelected ? 3 : 1}
                  rx="3"
                  ry="3"
                />
                <text
                  x={cx}
                  y={troopY}
                  fontSize="12"
                  fill="#000"
                  textAnchor="middle"
                  dominantBaseline="middle"
                  fontWeight="bold"
                  pointerEvents="none"
                  style={{ userSelect: 'none' }}
                >
                  {province.localTroops}
                </text>
              </g>
            )}

            {deployLabel && (
              <g
                onMouseDown={(e) => e.stopPropagation()}
                onClick={(e) => { e.stopPropagation(); onCancelAction?.(pendingDeployAction!.id); }}
                style={{ cursor: 'pointer' }}
              >
                <rect
                  x={cx - 20}
                  y={hasLocalTroops ? troopY + 12 : troopY - 10}
                  width="40"
                  height="20"
                  fill="white"
                  stroke="rgb(34, 197, 94)"
                  strokeWidth={1}
                  rx="3"
                  ry="3"
                />
                <text
                  x={cx}
                  y={hasLocalTroops ? troopY + 22 : troopY}
                  fontSize="12"
                  fill="rgb(34, 197, 94)"
                  textAnchor="middle"
                  dominantBaseline="middle"
                  fontWeight="bold"
                  pointerEvents="none"
                  style={{ userSelect: 'none' }}
                >
                  {deployLabel}
                </text>
              </g>
            )}
          </>
        );
      })()}
    </g>
  );
};

export const ProvinceShape = React.memo(ProvinceShapeComponent);
