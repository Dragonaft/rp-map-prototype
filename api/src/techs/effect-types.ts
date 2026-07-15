/**
 * Data-driven tech effect schema.
 *
 * Replaces the old hardcoded effect maps in `research-effects.ts` — a tech's
 * mechanical effect is now stored as JSON on `Tech.effects` and interpreted
 * generically by `TechEffectsService`. Admins edit this array via the admin
 * panel; `validateEffects` is the single gate both the admin write path and
 * the seed script run every effect payload through.
 */

export type EffectTarget =
  | 'income'
  | 'upkeep'
  | 'research_points'
  | 'building_cap'
  | 'army_attack'
  | 'army_defense'
  | 'road_hops'
  | 'water_turns_bonus';

export type EffectOp = 'add' | 'add_scaled' | 'multiply' | 'set';

/** Only `building_cap` effects are filtered by condition today. */
export interface EffectCondition {
  landscape?: string;
  resource?: string;
}

export interface TechEffect {
  target: EffectTarget;
  op: EffectOp;
  value: number;
  /** Required iff op === 'add_scaled'; must be one of TARGET_SCALE_OPTIONS[target]. */
  scaleBy?: string;
  when?: EffectCondition;
  /** Admin-facing label only, no mechanical effect. */
  note?: string;
}

export const EFFECT_TARGETS: EffectTarget[] = [
  'income',
  'upkeep',
  'research_points',
  'building_cap',
  'army_attack',
  'army_defense',
  'road_hops',
  'water_turns_bonus',
];

export const EFFECT_OPS: EffectOp[] = ['add', 'add_scaled', 'multiply', 'set'];

/**
 * Whitelist of context quantities each target may scale by (used with
 * op: 'add_scaled'). Mirrors the ctx shapes the engine builds per hook.
 */
export const TARGET_SCALE_OPTIONS: Partial<Record<EffectTarget, string[]>> = {
  income: ['provinceCount', 'capitalCount', 'barracksCount', 'farmGardenIncome'],
  research_points: ['capitalCount'],
};

const CONDITION_KEYS = ['landscape', 'resource'];

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * Validates and normalizes a raw `effects` payload (as received from the
 * admin panel or a seed file). Throws with a descriptive message on the
 * first invalid entry rather than silently dropping bad data.
 */
export function validateEffects(raw: unknown): TechEffect[] {
  if (raw === null || raw === undefined) return [];
  if (!Array.isArray(raw)) {
    throw new Error('effects must be an array');
  }

  return raw.map((entry, index) => {
    const prefix = `effects[${index}]`;
    if (!isPlainObject(entry)) {
      throw new Error(`${prefix} must be an object`);
    }

    const { target, op, value, scaleBy, when, note } = entry as Record<string, unknown>;

    if (typeof target !== 'string' || !EFFECT_TARGETS.includes(target as EffectTarget)) {
      throw new Error(`${prefix}.target must be one of: ${EFFECT_TARGETS.join(', ')}`);
    }
    if (typeof op !== 'string' || !EFFECT_OPS.includes(op as EffectOp)) {
      throw new Error(`${prefix}.op must be one of: ${EFFECT_OPS.join(', ')}`);
    }
    if (typeof value !== 'number' || !Number.isFinite(value)) {
      throw new Error(`${prefix}.value must be a finite number`);
    }

    const effect: TechEffect = { target: target as EffectTarget, op: op as EffectOp, value };

    if (op === 'add_scaled') {
      const allowed = TARGET_SCALE_OPTIONS[effect.target] ?? [];
      if (typeof scaleBy !== 'string' || !allowed.includes(scaleBy)) {
        throw new Error(
          `${prefix}.scaleBy is required for op "add_scaled" on target "${effect.target}" and must be one of: ${allowed.join(', ') || '(none available)'}`,
        );
      }
      effect.scaleBy = scaleBy;
    } else if (scaleBy !== undefined) {
      throw new Error(`${prefix}.scaleBy is only valid when op is "add_scaled"`);
    }

    if (when !== undefined) {
      if (!isPlainObject(when)) {
        throw new Error(`${prefix}.when must be an object`);
      }
      if (effect.target !== 'building_cap') {
        throw new Error(`${prefix}.when is only supported for target "building_cap"`);
      }
      for (const key of Object.keys(when)) {
        if (!CONDITION_KEYS.includes(key)) {
          throw new Error(`${prefix}.when has unknown key "${key}" (allowed: ${CONDITION_KEYS.join(', ')})`);
        }
        if (when[key] !== undefined && typeof when[key] !== 'string') {
          throw new Error(`${prefix}.when.${key} must be a string`);
        }
      }
      effect.when = when as EffectCondition;
    }

    if (note !== undefined) {
      if (typeof note !== 'string') {
        throw new Error(`${prefix}.note must be a string`);
      }
      effect.note = note;
    }

    return effect;
  });
}
