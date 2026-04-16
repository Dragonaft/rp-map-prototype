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
}

export interface BattleContext {
  attackingTroops: number;
}

/** Applied per-user after base income is calculated. */
export const INCOME_RESEARCH_EFFECTS: Partial<Record<string, (ctx: IncomeContext) => void>> = {
  'economy.trade_routes': (ctx) => {
    ctx.incomeTotal = Math.round(ctx.incomeTotal * 1.2);
  },
};

/** Applied per-attacker before battle resolution. */
export const BATTLE_RESEARCH_EFFECTS: Partial<Record<string, (ctx: BattleContext) => void>> = {
  'military.sword_training': (ctx) => {
    ctx.attackingTroops = Math.round(ctx.attackingTroops * 1.15);
  },
};
