import React, { useMemo } from 'react';
import { Building, Province } from '../types';
import { useAppSelector } from '../store/hooks';

interface Props {
  province: Province;
  isSelected: boolean;
  onSelect: (province: Province, multi: boolean) => void;
}

const WATER_COLOR = '#7ec8ff';
const DEFAULT_LAND_COLOR = '#cccccc';

const ProvinceShapeComponent: React.FC<Props> = ({ province, isSelected, onSelect }) => {
  const otherUsers = useAppSelector((state) => state.otherUsers.otherUsers);
  const currentUserId = useAppSelector((state) => state.user.id);
  const currentUserColor = useAppSelector((state) => state.user.color);

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
  const strokeColor = isSelected ? '#ffff00' : '#333333';
  const strokeWidth = isSelected ? 4 : 1.5;

  const handleClick: React.MouseEventHandler<SVGPathElement> = React.useCallback((e) => {
    e.stopPropagation();
    const multi = e.ctrlKey || e.metaKey || e.shiftKey;
    onSelect(province, multi);
  }, [onSelect, province]);

  // Calculate the bounding box to position text near the bottom
  const [pathBBox, setPathBBox] = React.useState<DOMRect | null>(null);
  const pathRef = React.useRef<SVGPathElement>(null);

  React.useEffect(() => {
    if (pathRef.current && !pathBBox) {
      const bbox = pathRef.current.getBBox();
      setPathBBox(bbox as DOMRect);
    }
  }, [pathBBox]);

  const isCurrentUserProvince = province.userId === currentUserId;

  // Building icons (simple shapes for different building types)
  const buildingIcons = ['🏰', '⚔️', '🏭', '🌾', '⛏️', '🏛️', '🛡️', '💰'];

  const renderBuildingIcon = (building: Building, index: number) => {
    if (!pathBBox) return null;

    // Pick a deterministic icon based on the building type
    // @ts-ignore
    const iconIndex = building.type.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0) % buildingIcons.length;
    const icon = buildingIcons[iconIndex];

    // Position multiple buildings in a grid around a center
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

  return (
    <g>
      <path
        ref={pathRef}
        d={province.polygon}
        fill={fillColor}
        stroke={strokeColor}
        strokeWidth={strokeWidth}
        onClick={handleClick}
        style={{ cursor: 'pointer', transition: 'stroke 0.2s, stroke-width 0.2s' }}
      />

      {/* Show building icons if province has buildings */}
      {province.buildings && province.buildings.length > 0 &&
        province.buildings.map((building, index) => renderBuildingIcon(building, index))
      }

      {/* Show local troops count for current user's provinces */}
      {isCurrentUserProvince && pathBBox && (
        <text
          x={pathBBox.x + pathBBox.width / 2}
          y={pathBBox.y + pathBBox.height / 2 + (province.buildings && province.buildings.length > 0 ? 25 : 0)}
          fontSize="12"
          fill="#000"
          textAnchor="middle"
          fontWeight="bold"
          pointerEvents="none"
          style={{ userSelect: 'none' }}
        >
          {province.localTroops}
        </text>
      )}
    </g>
  );
};

export const ProvinceShape = React.memo(ProvinceShapeComponent, (prevProps, nextProps) => {
  return (
    prevProps.province.id === nextProps.province.id &&
    prevProps.isSelected === nextProps.isSelected &&
    prevProps.province.userId === nextProps.province.userId &&
    prevProps.province.localTroops === nextProps.province.localTroops &&
    prevProps.province.buildings?.length === nextProps.province.buildings?.length
  );
});
