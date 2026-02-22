import React from 'react';
import type { Province } from '../types';

interface Props {
  province: Province;
  isSelected: boolean;
  onSelect: (province: Province, multi: boolean) => void;
}

const WATER_COLOR = '#7ec8ff';

export const ProvinceShape: React.FC<Props> = ({ province, isSelected, onSelect }) => {
  const isWater = province.type === 'water';
  const fillColor = isWater ? WATER_COLOR : province.userColor ?? '#cccccc';
  const strokeColor = isSelected ? '#ffff00' : '#333333';
  const strokeWidth = isSelected ? 4 : 1.5;

  const handleClick: React.MouseEventHandler<SVGPathElement> = (e) => {
    e.stopPropagation();
    const multi = e.ctrlKey || e.metaKey || e.shiftKey;
    onSelect(province, multi);
  };

  return (
    <path
      d={province.polygon}
      fill={fillColor}
      stroke={strokeColor}
      strokeWidth={strokeWidth}
      onClick={handleClick}
      style={{ cursor: 'pointer', transition: 'stroke 0.2s, stroke-width 0.2s' }}
    />
  );
};
