import React from 'react';
import { Tooltip } from '@mui/material';
import { TroopType } from '../types';
import { PIETY_RECRUIT_TROOPS, MONEY_TROOPS } from '../utils/armyUpkeep';

/** Mirrors TROOP_COUNTER_MATRIX in api/src/actions/combat-calculator.ts — one-line flavor text
 *  only, not used for any calculation here. SPECIAL/PEASANT (the class units + basic militia)
 *  are absent, matching the backend: they never dilute or benefit from composition. */
const COUNTER_BLURB: Partial<Record<string, string>> = {
  INFANTRY: 'Strong vs Cavalry, weak vs Ranged',
  RANGED: 'Strong vs Infantry, weak vs Cavalry',
  CAVALRY: 'Strong vs Ranged, weak vs Infantry',
};

/**
 * Note: MUI Tooltip content is portaled outside `#root`, so Tailwind's `important: '#root'` scoping
 * means Tailwind classes here never apply — style with inline styles / plain strings only.
 */
export const TroopTooltipContent: React.FC<{ troopType: TroopType; goodName?: string; goodName2?: string; supplyGoodName2?: string }> = ({ troopType, goodName, goodName2, supplyGoodName2 }) => (
  <div style={{ fontSize: '0.9rem' }}>
    <div style={{ marginBottom: 2, fontWeight: 700 }}>{troopType.name}</div>
    {troopType.description && <div style={{ marginBottom: 2, color: '#d1d5db' }}>{troopType.description}</div>}
    <div style={{ marginBottom: 2 }}>
      Category: {troopType.category}
      {COUNTER_BLURB[troopType.category] && <span style={{ color: '#9ca3af' }}> — {COUNTER_BLURB[troopType.category]}</span>}
    </div>
    <div style={{ marginBottom: 2 }}>Attack: {troopType.attack}</div>
    <div style={{ marginBottom: 2 }}>Defense: {troopType.defense}</div>
    <div style={{ marginBottom: 2 }}>
      Cost/100: {troopType.cost_per_100 > 0 ? `${troopType.cost_per_100} ${
        PIETY_RECRUIT_TROOPS.has(troopType.key) ? 'piety' : MONEY_TROOPS.has(troopType.key) ? 'gold' : 'gold'
      }` : 'Free'}
    </div>
    {troopType.required_goods && troopType.goods_amount && (
      <div style={{ marginBottom: 2 }}>Goods/100: {troopType.goods_amount} {goodName ?? 'goods'}</div>
    )}
    {troopType.required_goods_2 && troopType.goods_amount_2 && (
      <div style={{ marginBottom: 2 }}>Goods/100: {troopType.goods_amount_2} {goodName2 ?? 'goods'}</div>
    )}
    <div style={{ marginBottom: 2 }}>Upkeep/100: {troopType.upkeep_per_100}</div>
    {troopType.supply_good_id && !!troopType.supply_per_100 && (
      <div style={{ marginBottom: 2 }}>Food/100/turn: {troopType.supply_per_100} (×more if far from supply)</div>
    )}
    {troopType.supply_good_2_id && !!troopType.supply_per_100_2 && (
      <div>{supplyGoodName2 ?? 'Goods'}/100/turn: {troopType.supply_per_100_2} (×more if far from supply — trade for this or the army starves)</div>
    )}
  </div>
);

interface TroopTooltipProps {
  troopType: TroopType;
  goodName?: string;
  goodName2?: string;
  supplyGoodName2?: string;
  children: React.ReactElement;
}

export const TroopTooltipWrapper: React.FC<TroopTooltipProps> = ({ troopType, goodName, goodName2, supplyGoodName2, children }) => (
  <Tooltip
    title={<TroopTooltipContent troopType={troopType} goodName={goodName} goodName2={goodName2} supplyGoodName2={supplyGoodName2} />}
    placement="left"
    arrow
  >
    {children}
  </Tooltip>
);
