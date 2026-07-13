/**
 * Frontend mirror of api/src/techs/effect-types.ts — keep in sync with the backend schema.
 */

export type EffectTarget =
  | 'income'
  | 'upkeep'
  | 'research_points'
  | 'building_cap'
  | 'army_attack'
  | 'army_defense'
  | 'road_hops';

export type EffectOp = 'add' | 'add_scaled' | 'multiply' | 'set';

export interface EffectCondition {
  landscape?: string;
  resource?: string;
}

export interface TechEffect {
  target: EffectTarget;
  op: EffectOp;
  value: number;
  scaleBy?: string;
  when?: EffectCondition;
  note?: string;
}

export const EFFECT_TARGETS: { value: EffectTarget; label: string }[] = [
  { value: 'income', label: 'Income' },
  { value: 'upkeep', label: 'Upkeep' },
  { value: 'research_points', label: 'Research Points' },
  { value: 'building_cap', label: 'Building Cap' },
  { value: 'army_attack', label: 'Army Attack' },
  { value: 'army_defense', label: 'Army Defense' },
  { value: 'road_hops', label: 'Road Hops' },
];

export const EFFECT_OPS: { value: EffectOp; label: string }[] = [
  { value: 'add', label: 'Add (+N)' },
  { value: 'add_scaled', label: 'Add scaled (+N × quantity)' },
  { value: 'multiply', label: 'Multiply (×N)' },
  { value: 'set', label: 'Set (= N)' },
];

/** Only targets present here support op: 'add_scaled'; the value is the list of valid `scaleBy` quantities. */
export const TARGET_SCALE_OPTIONS: Partial<Record<EffectTarget, string[]>> = {
  income: ['provinceCount', 'capitalCount', 'barracksCount', 'farmGardenIncome'],
  research_points: ['capitalCount'],
};

/** Only 'building_cap' effects support a `when` condition. */
export const CONDITIONAL_TARGETS: EffectTarget[] = ['building_cap'];

/** Known landscape values across the map generator + seed data; the field also accepts free text. */
export const LANDSCAPE_OPTIONS = ['plains', 'forest', 'mountain', 'desert', 'hills', 'swamp', 'coast'];

export function emptyEffect(): TechEffect {
  return { target: 'income', op: 'add', value: 0 };
}

/** Short one-line summary for a table cell, e.g. "income ×1.1" or "building_cap +1 (plains)". */
export function describeEffect(effect: TechEffect): string {
  const targetLabel = EFFECT_TARGETS.find((t) => t.value === effect.target)?.label ?? effect.target;
  let opText: string;
  switch (effect.op) {
    case 'multiply':
      opText = `×${effect.value}`;
      break;
    case 'set':
      opText = `=${effect.value}`;
      break;
    case 'add_scaled':
      opText = `+${effect.value}×${effect.scaleBy ?? '?'}`;
      break;
    default:
      opText = effect.value >= 0 ? `+${effect.value}` : `${effect.value}`;
  }
  const condition = effect.when
    ? ` (${[effect.when.landscape, effect.when.resource].filter(Boolean).join(', ')})`
    : '';
  return `${targetLabel} ${opText}${condition}`;
}

export function describeEffects(effects: TechEffect[] | null | undefined): string {
  if (!effects || effects.length === 0) return '';
  return effects.map(describeEffect).join('; ');
}
