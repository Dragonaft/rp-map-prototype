/**
 * Effect maps for researched techs.
 * Each map key is a tech key (matching Tech.key in the DB).
 * Each value is a function that mutates the provided context object.
 *
 * To add a new tech effect: add one entry to the relevant map below.
 */

export interface IncomeContext {
  incomeTotal: number;
  barracksCount: number;
  farmGardenIncome: number;
  provinceCount: number;
  capitalCount: number;
}

export interface BattleContext {
  attackingTroops: number;
}

export interface UpkeepContext {
  totalUpkeep: number;
}

export interface ResearchPointContext {
  researchTotal: number;
  capitalCount: number;
}

/** Applied per-user after base income is calculated. */
export const INCOME_RESEARCH_EFFECTS: Partial<Record<string, (ctx: IncomeContext) => void>> = {
  'economy.trade_routes': (ctx) => {
    ctx.incomeTotal = Math.round(ctx.incomeTotal * 1.2);
  },
  'economy.agriculture': (ctx) => {
    ctx.incomeTotal += Math.round(ctx.farmGardenIncome * 0.15);
  },
  'economy.advanced_taxation': (ctx) => {
    ctx.incomeTotal += ctx.provinceCount * 10;
  },
  'economy.monopoly': (ctx) => {
    ctx.incomeTotal = Math.round(ctx.incomeTotal * 1.6);
  },
};

/** Applied per-user after base upkeep is calculated. */
export const UPKEEP_RESEARCH_EFFECTS: Partial<Record<string, (ctx: UpkeepContext) => void>> = {
  'guild.merchant_guilds': (ctx) => {
    ctx.totalUpkeep = Math.floor(ctx.totalUpkeep * 0.85);
  },
  /** Professional supply chains reduce total army upkeep by 20%. */
  'military.army_logistics': (ctx) => {
    ctx.totalUpkeep = Math.floor(ctx.totalUpkeep * 0.8);
  },
};

/** Applied per-user after base research points are calculated. */
export const RESEARCH_POINT_EFFECTS: Partial<Record<string, (ctx: ResearchPointContext) => void>> = {
  'economy.record_keeping': (ctx) => {
  },
};

/** Applied per-attacker before battle resolution. */
export const BATTLE_RESEARCH_EFFECTS: Partial<Record<string, (ctx: BattleContext) => void>> = {
  'military.sword_training': (ctx) => {
    ctx.attackingTroops = Math.round(ctx.attackingTroops * 1.15);
  },
  /** Veteran officers improve all unit effectiveness by 10% when attacking. */
  'military.veteran_officers': (ctx) => {
    ctx.attackingTroops = Math.round(ctx.attackingTroops * 1.1);
  },
};

// ---------------------------------------------------------------------------
// Building cap
// ---------------------------------------------------------------------------

const DEFAULT_BUILDING_CAP = 3;

const LANDSCAPE_BUILDING_CAPS: Record<string, number> = {
  plains:   4,
  mountain: 2,
  forest:   3,
  coast:    3,
  desert:   2,
};

/** Tech modifiers to the province building cap. Return the new cap value. */
export const CAP_RESEARCH_EFFECTS: Partial<Record<string, (cap: number) => number>> = {
  // example: 'economy.urban_planning': (cap) => cap + 1,
};

/** Returns the maximum number of buildings allowed in a province. */
export function computeBuildingCap(landscape: string, completedResearch: string[]): number {
  let cap = LANDSCAPE_BUILDING_CAPS[landscape?.toLowerCase()] ?? DEFAULT_BUILDING_CAP;
  for (const techKey of completedResearch) {
    const effect = CAP_RESEARCH_EFFECTS[techKey];
    if (effect) cap = effect(cap);
  }
  return cap;
}
