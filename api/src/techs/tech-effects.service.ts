import { Injectable, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Tech } from './entities/tech.entity';
import { EffectCondition, EffectTarget, TechEffect } from './effect-types';

/**
 * Landscape base building caps. `coast` was a dead entry — no province in the current map data
 * carries that landscape (water provinces have no landscape at all; coastal land provinces are
 * just plains/forest/hills/etc.). `hills` and `swamp` were previously missing, so 150 of 532
 * land provinces (28%) silently fell through to DEFAULT_BUILDING_CAP instead of an intentional
 * value — both are filled in now rather than left to the default.
 */
export const DEFAULT_BUILDING_CAP = 3;
export const LANDSCAPE_BUILDING_CAPS: Record<string, number> = {
  plains: 4,
  mountain: 2,
  forest: 3,
  hills: 3,
  desert: 2,
  swamp: 2,
};
export const DEFAULT_ROAD_HOPS = 2;
/** Base number of consecutive turns an army may spend on a water province before being lost. */
export const DEFAULT_WATER_TURNS = 6;
/** Base tiles of penalty-free supply range — mirrors SUPPLY_FREE_RADIUS in supply-utils.ts. */
export const DEFAULT_SUPPLY_RANGE = 4;
/** Base flat troop-pool grant per BARRACKS/CAPITAL building each turn (see IncomeActionService). */
export const DEFAULT_TROOP_POOL_PER_BUILDING = 50;

/** Targets whose result is floored instead of rounded (money-like quantities). */
const FLOOR_TARGETS: EffectTarget[] = ['upkeep'];

/**
 * Interprets `Tech.effects` (see `effect-types.ts`) at every gameplay hook that used
 * to consult the hardcoded maps in `research-effects.ts`.
 *
 * Techs change rarely (admin edits only), so all effects are cached in memory after
 * load and re-fetched only when `invalidate()` is called (admin create/update/delete).
 * This avoids a DB round-trip on every turn/battle/build check.
 */
@Injectable()
export class TechEffectsService implements OnModuleInit {
  private effectsByTech = new Map<string, TechEffect[]>();

  constructor(
    @InjectRepository(Tech)
    private readonly techRepo: Repository<Tech>,
  ) {}

  async onModuleInit(): Promise<void> {
    await this.reload();
  }

  /** Call after any admin write (create/update/delete) that could change a Tech's `effects`. */
  async invalidate(): Promise<void> {
    await this.reload();
  }

  private async reload(): Promise<void> {
    const techs = await this.techRepo.find();
    const next = new Map<string, TechEffect[]>();
    for (const tech of techs) {
      if (tech.effects?.length) next.set(tech.key, tech.effects);
    }
    this.effectsByTech = next;
  }

  private effectsFor(target: EffectTarget, completedResearch: string[]): TechEffect[] {
    const result: TechEffect[] = [];
    for (const techKey of completedResearch) {
      const effects = this.effectsByTech.get(techKey);
      if (!effects) continue;
      for (const effect of effects) {
        if (effect.target === target) result.push(effect);
      }
    }
    return result;
  }

  private conditionMatches(when: EffectCondition | undefined, condition: EffectCondition): boolean {
    if (!when) return true;
    if (when.landscape && when.landscape.toLowerCase() !== condition.landscape?.toLowerCase()) return false;
    if (when.resource && when.resource.toLowerCase() !== condition.resource?.toLowerCase()) return false;
    return true;
  }

  private roundForTarget(target: EffectTarget, value: number): number {
    return FLOOR_TARGETS.includes(target) ? Math.floor(value) : Math.round(value);
  }

  /**
   * Generic interpreter, used for every target. Deterministic stacking order,
   * independent of tech ordering: last `set` wins -> sum all add/add_scaled ->
   * multiply (product of all `multiply` effects) -> round for the target.
   *
   * `condition` is only meaningful for `building_cap` — effects whose `when` doesn't
   * match are skipped.
   */
  apply(
    target: EffectTarget,
    base: number,
    ctx: Record<string, number>,
    completedResearch: string[],
    condition?: EffectCondition,
  ): number {
    let effects = this.effectsFor(target, completedResearch);
    if (condition) {
      effects = effects.filter((effect) => this.conditionMatches(effect.when, condition));
    }
    if (effects.length === 0) return this.roundForTarget(target, base);

    let result = base;
    for (const effect of effects) {
      if (effect.op === 'set') result = effect.value;
    }

    let additive = 0;
    for (const effect of effects) {
      if (effect.op === 'add') {
        additive += effect.value;
      } else if (effect.op === 'add_scaled') {
        const scale = effect.scaleBy ? (ctx[effect.scaleBy] ?? 0) : 0;
        additive += effect.value * scale;
      }
    }
    result += additive;

    for (const effect of effects) {
      if (effect.op === 'multiply') result *= effect.value;
    }

    return this.roundForTarget(target, result);
  }

  /** Max buildings allowed in a province, given its landscape/resource and the owner's completed research. */
  computeBuildingCap(landscape: string, resource: string | null, completedResearch: string[]): number {
    const base = LANDSCAPE_BUILDING_CAPS[landscape?.toLowerCase()] ?? DEFAULT_BUILDING_CAP;
    return this.apply('building_cap', base, {}, completedResearch, { landscape, resource });
  }

  /** Max road hops an army may move in one turn. */
  roadHops(completedResearch: string[]): number {
    return this.apply('road_hops', DEFAULT_ROAD_HOPS, {}, completedResearch);
  }

  /** Max consecutive turns an army may spend on water before being lost, given the owner's completed research. */
  waterTurnsAllowed(completedResearch: string[]): number {
    return this.apply('water_turns_bonus', DEFAULT_WATER_TURNS, {}, completedResearch);
  }

  /** Tiles of penalty-free supply range, given the owner's completed research. */
  supplyRange(completedResearch: string[]): number {
    return this.apply('supply_range', DEFAULT_SUPPLY_RANGE, {}, completedResearch);
  }

  /** Troop-pool grant per BARRACKS/CAPITAL building this turn, given the owner's completed research. */
  troopPoolPerBuilding(completedResearch: string[]): number {
    return this.apply('troop_pool', DEFAULT_TROOP_POOL_PER_BUILDING, {}, completedResearch);
  }
}
