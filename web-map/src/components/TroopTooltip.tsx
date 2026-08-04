import React from 'react';
import { Tooltip } from '@mui/material';
import { TroopType } from '../types';
import { PIETY_TROOPS, MONEY_TROOPS } from '../utils/armyUpkeep';

/**
 * Note: MUI Tooltip content is portaled outside `#root`, so Tailwind's `important: '#root'` scoping
 * means Tailwind classes here never apply — style with inline styles / plain strings only.
 */
export const TroopTooltipContent: React.FC<{ troopType: TroopType; goodName?: string }> = ({ troopType, goodName }) => (
  <div style={{ fontSize: '0.9rem' }}>
    <div style={{ marginBottom: 2, fontWeight: 700 }}>{troopType.name}</div>
    {troopType.description && <div style={{ marginBottom: 2, color: '#d1d5db' }}>{troopType.description}</div>}
    <div style={{ marginBottom: 2 }}>Category: {troopType.category}</div>
    <div style={{ marginBottom: 2 }}>Attack: {troopType.attack}</div>
    <div style={{ marginBottom: 2 }}>Defense: {troopType.defense}</div>
    <div style={{ marginBottom: 2 }}>
      Cost/100: {troopType.cost_per_100 > 0 ? `${troopType.cost_per_100} ${
        PIETY_TROOPS.has(troopType.key) ? 'piety' : MONEY_TROOPS.has(troopType.key) ? 'gold' : 'gold'
      }` : 'Free'}
    </div>
    {troopType.required_goods && troopType.goods_amount && (
      <div style={{ marginBottom: 2 }}>Goods/100: {troopType.goods_amount} {goodName ?? 'goods'}</div>
    )}
    <div style={{ marginBottom: 2 }}>Upkeep/100: {troopType.upkeep_per_100}</div>
    {troopType.supply_good_id && !!troopType.supply_per_100 && (
      <div>Food/100: {troopType.supply_per_100} (×more if far from supply)</div>
    )}
  </div>
);

interface TroopTooltipProps {
  troopType: TroopType;
  goodName?: string;
  children: React.ReactElement;
}

export const TroopTooltipWrapper: React.FC<TroopTooltipProps> = ({ troopType, goodName, children }) => (
  <Tooltip
    title={<TroopTooltipContent troopType={troopType} goodName={goodName} />}
    placement="left"
    arrow
  >
    {children}
  </Tooltip>
);
