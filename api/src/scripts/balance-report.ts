import * as fs from 'fs';
import * as path from 'path';
import { BATTLE_RESEARCH_EFFECTS } from '../techs/research-effects';
import {
  ARMY_MIN_SIZE,
  CASUALTY_FLOOR,
  DEFENSIVE_BUILDING_TYPES,
  CombatArmy,
  CombatArmyUnit,
  CombatBuilding,
  applyCasualties,
  armyAttackPower,
  armyDefensePower,
  armyTotalTroops,
  computeBuildModifier,
} from '../actions/combat-calculator';

interface TroopTypeRow {
  key: string;
  name: string;
  description: string;
  category: string;
  cost_per_100: number;
  attack: number;
  defense: number;
  upkeep_per_100: number;
  tech_requirement: string | null;
  building_requirement: string | null;
}

interface BuildingRow extends CombatBuilding {
  type: string;
  name: string;
  description: string;
  income: number | null;
  upkeep: number | null;
  modifier: string | null;
  cost: number | null;
  requirement_tech: string[] | null;
  upgrade_to: string | null;
  requirement_building: string | null;
}

interface SimUnit extends CombatArmyUnit {
  troopType: TroopTypeRow;
}

type SimArmy = CombatArmy<SimUnit>;

interface CliOptions {
  outPath?: string;
  attackerCounts: number[];
  defenderCounts: number[];
  compositionStep: number;
}

interface AttackTechScenario {
  key: string;
  name: string;
  techs: string[];
}

interface BuildingScenario {
  key: string;
  name: string;
  buildingTypes: string[];
}

interface MixedTemplate {
  key: string;
  name: string;
  ratios: Record<string, number>;
}

interface CompositionCandidate {
  key: string;
  ratios: Record<string, number>;
}

interface RosterScenario {
  key: string;
  name: string;
  troopTypes: TroopTypeRow[];
}

const API_ROOT = path.resolve(__dirname, '../..');
const DATA_DIR = path.join(API_ROOT, 'data');
const DEFAULT_ATTACKER_COUNTS = [100, 250, 500, 1000];
const DEFAULT_DEFENDER_COUNTS = [100, 250, 500, 1000];
const DEFAULT_COMPOSITION_STEP = 25;
const FOG_TOP_RESULTS_PER_ROLE = 5;
const CLASS_RESTRICTED_TROOP_KEYS = new Set(['noble_knights', 'paladins', 'mercenaries']);

const ATTACK_TECH_SCENARIOS: AttackTechScenario[] = [
  { key: 'none', name: 'No attack tech', techs: [] },
  { key: 'sword', name: 'Sword Training', techs: ['military.sword_training'] },
  {
    key: 'sword_veteran',
    name: 'Sword + Veteran Officers',
    techs: ['military.sword_training', 'military.veteran_officers'],
  },
  {
    key: 'full_attack_stack',
    name: 'Sword + Veteran + Noble Training',
    techs: ['military.sword_training', 'military.veteran_officers', 'noble.better_training'],
  },
];

const BUILDING_SCENARIOS: BuildingScenario[] = [
  { key: 'none', name: 'Open field', buildingTypes: [] },
  { key: 'capital', name: 'Capital', buildingTypes: ['CAPITAL'] },
  { key: 'fort', name: 'Fort', buildingTypes: ['FORT'] },
  { key: 'castle', name: 'Castle', buildingTypes: ['CASTLE'] },
  { key: 'cathedral', name: 'Cathedral', buildingTypes: ['CATHEDRAL'] },
  { key: 'capital_fort', name: 'Capital + Fort', buildingTypes: ['CAPITAL', 'FORT'] },
  { key: 'capital_castle', name: 'Capital + Castle', buildingTypes: ['CAPITAL', 'CASTLE'] },
  {
    key: 'capital_fort_cathedral',
    name: 'Capital + Fort + Cathedral',
    buildingTypes: ['CAPITAL', 'FORT', 'CATHEDRAL'],
  },
  {
    key: 'all_defensive_stack',
    name: 'Capital + Fort + Castle + Cathedral',
    buildingTypes: ['CAPITAL', 'FORT', 'CASTLE', 'CATHEDRAL'],
  },
];

const MIXED_TEMPLATES: MixedTemplate[] = [
  {
    key: 'cheap_skirmish',
    name: 'Cheap skirmish: 70% Peasants, 30% Archers',
    ratios: { peasants: 0.7, archers: 0.3 },
  },
  {
    key: 'basic_line',
    name: 'Basic line: 50% Infantry, 25% Archers, 25% Pikemen',
    ratios: { infantry: 0.5, archers: 0.25, pikemen: 0.25 },
  },
  {
    key: 'defensive_line',
    name: 'Defensive line: 70% Pikemen, 30% Infantry',
    ratios: { pikemen: 0.7, infantry: 0.3 },
  },
  {
    key: 'cavalry_punch',
    name: 'Cavalry punch: 50% Knights, 30% Infantry, 20% Archers',
    ratios: { knights: 0.5, infantry: 0.3, archers: 0.2 },
  },
  {
    key: 'noble_elite',
    name: 'Noble elite: 60% Noble Knights, 40% Pikemen',
    ratios: { noble_knights: 0.6, pikemen: 0.4 },
  },
  {
    key: 'holy_wall',
    name: 'Holy wall: 60% Paladins, 40% Pikemen',
    ratios: { paladins: 0.6, pikemen: 0.4 },
  },
  {
    key: 'guild_hired',
    name: 'Guild hired: 70% Mercenaries, 30% Archers',
    ratios: { mercenaries: 0.7, archers: 0.3 },
  },
];

function parseArgs(argv: string[]): CliOptions {
  const options: CliOptions = {
    attackerCounts: DEFAULT_ATTACKER_COUNTS,
    defenderCounts: DEFAULT_DEFENDER_COUNTS,
    compositionStep: DEFAULT_COMPOSITION_STEP,
  };

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    const next = argv[i + 1];

    if (arg === '--out' && next) {
      options.outPath = next;
      i++;
      continue;
    }
    if (arg === '--attacker-counts' && next) {
      options.attackerCounts = parseCountList(next, '--attacker-counts');
      i++;
      continue;
    }
    if (arg === '--defender-counts' && next) {
      options.defenderCounts = parseCountList(next, '--defender-counts');
      i++;
      continue;
    }
    if (arg === '--composition-step' && next) {
      const step = Number(next);
      if (!Number.isInteger(step) || step <= 0 || step > 100 || 100 % step !== 0) {
        throw new Error('--composition-step must be a positive divisor of 100, for example 25, 20, 10, or 5');
      }
      options.compositionStep = step;
      i++;
      continue;
    }
    if (arg === '--help') {
      printHelpAndExit();
    }
  }

  return options;
}

function printHelpAndExit(): never {
  console.log([
    'Usage: npm run balance:report -- [options]',
    '',
    'Options:',
    '  --out <path>                 Output txt path. Relative paths resolve from api/.',
    '  --attacker-counts <csv>      Equal-size simulations, default: 100,250,500,1000',
    '  --defender-counts <csv>      Threshold simulations, default: 100,250,500,1000',
    '  --composition-step <number>   Fog-of-war composition grid step, default: 25',
    '',
    'Example:',
    '  npm run balance:report -- --out logs/balance-report.txt --defender-counts 100,500',
  ].join('\n'));
  process.exit(0);
}

function parseCountList(value: string, label: string): number[] {
  const counts = value
    .split(',')
    .map((v) => Number(v.trim()))
    .filter((v) => Number.isInteger(v) && v > 0);

  if (!counts.length) {
    throw new Error(`${label} must contain at least one positive integer`);
  }

  return [...new Set(counts)].sort((a, b) => a - b);
}

function readJsonArray<T>(filePath: string): T[] {
  const raw = fs.readFileSync(filePath, 'utf-8');
  const parsed = JSON.parse(raw);
  if (!Array.isArray(parsed)) {
    throw new Error(`${filePath} must contain a JSON array`);
  }
  return parsed as T[];
}

function indexBy<T extends { key?: string; type?: string }>(
  rows: T[],
  field: 'key' | 'type',
): Map<string, T> {
  const map = new Map<string, T>();
  for (const row of rows) {
    const value = row[field];
    if (value) map.set(value, row);
  }
  return map;
}

function resolveOutputPath(cliPath: string | undefined): string {
  if (cliPath) {
    return path.isAbsolute(cliPath) ? cliPath : path.join(API_ROOT, cliPath);
  }

  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  return path.join(API_ROOT, 'logs', `balance-report-${stamp}.txt`);
}

function fmt(value: number | null | undefined, digits = 2): string {
  if (value == null || !Number.isFinite(value)) return 'n/a';
  return Number.isInteger(value) ? String(value) : value.toFixed(digits);
}

function pct(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return 'n/a';
  return `${(value * 100).toFixed(1)}%`;
}

function renderTable(headers: string[], rows: Array<Array<string | number | null | undefined>>): string[] {
  const allRows = [headers, ...rows.map((row) => row.map((cell) => String(cell ?? '')))];
  const widths = headers.map((_, col) => Math.max(...allRows.map((row) => String(row[col] ?? '').length)));
  const renderRow = (row: Array<string | number | null | undefined>) =>
    row.map((cell, col) => String(cell ?? '').padEnd(widths[col])).join(' | ');

  return [
    renderRow(headers),
    widths.map((width) => '-'.repeat(width)).join('-|-'),
    ...rows.map(renderRow),
  ];
}

function getScenarioBuildings(
  scenario: BuildingScenario,
  buildingByType: Map<string, BuildingRow>,
): BuildingRow[] {
  return scenario.buildingTypes
    .map((type) => buildingByType.get(type))
    .filter((building): building is BuildingRow => Boolean(building));
}

function applyAttackTechs(basePower: number, techs: string[]): number {
  const ctx = { attackingTroops: basePower };
  for (const techKey of techs) {
    BATTLE_RESEARCH_EFFECTS[techKey]?.(ctx);
  }
  return ctx.attackingTroops;
}

function makePureArmy(troopType: TroopTypeRow, count: number): SimArmy {
  return {
    units: [{
      count,
      troopType,
    }],
  };
}

function cloneArmy(army: SimArmy): SimArmy {
  return {
    units: army.units.map((unit) => ({
      count: unit.count,
      troopType: unit.troopType,
    })),
  };
}

function makeMixedArmy(template: MixedTemplate, totalCount: number, troopByKey: Map<string, TroopTypeRow>): SimArmy {
  const entries = Object.entries(template.ratios).filter(([key]) => troopByKey.has(key));
  if (!entries.length) {
    return { units: [] };
  }

  const units: SimUnit[] = entries.map(([key, ratio]) => ({
    troopType: troopByKey.get(key)!,
    count: Math.max(0, Math.round((totalCount * ratio) / 10) * 10),
  }));

  const diff = totalCount - units.reduce((sum, unit) => sum + unit.count, 0);
  units[0].count += diff;

  return { units: units.filter((unit) => unit.count > 0) };
}

function generateCompositionCandidates(troopTypes: TroopTypeRow[], stepPercent: number): CompositionCandidate[] {
  const units = 100 / stepPercent;
  const candidates: CompositionCandidate[] = [];
  const troopKeys = troopTypes.map((troopType) => troopType.key);

  const walk = (index: number, remainingUnits: number, current: number[]): void => {
    if (index === troopKeys.length - 1) {
      const finalParts = [...current, remainingUnits];
      const ratios: Record<string, number> = {};
      finalParts.forEach((part, partIndex) => {
        if (part > 0) {
          ratios[troopKeys[partIndex]] = part * stepPercent;
        }
      });
      candidates.push({
        key: describeCompositionRatios(ratios),
        ratios,
      });
      return;
    }

    for (let part = 0; part <= remainingUnits; part++) {
      walk(index + 1, remainingUnits - part, [...current, part]);
    }
  };

  walk(0, units, []);
  return candidates;
}

function buildRosterScenarios(troopTypes: TroopTypeRow[]): RosterScenario[] {
  const common = troopTypes.filter((troopType) => !CLASS_RESTRICTED_TROOP_KEYS.has(troopType.key));
  const withKeys = (specialKey: string) =>
    troopTypes.filter((troopType) => !CLASS_RESTRICTED_TROOP_KEYS.has(troopType.key) || troopType.key === specialKey);

  return [
    { key: 'common', name: 'Common roster', troopTypes: common },
    { key: 'guild', name: 'Guild roster', troopTypes: withKeys('mercenaries') },
    { key: 'noble', name: 'Noble roster', troopTypes: withKeys('noble_knights') },
    { key: 'holy', name: 'Holy roster', troopTypes: withKeys('paladins') },
  ];
}

function uniqueCompositionCandidates(candidates: CompositionCandidate[]): CompositionCandidate[] {
  const byKey = new Map<string, CompositionCandidate>();
  for (const candidate of candidates) {
    byKey.set(candidate.key, candidate);
  }
  return [...byKey.values()];
}

function describeCompositionRatios(ratios: Record<string, number>): string {
  return Object.entries(ratios)
    .filter(([, percent]) => percent > 0)
    .map(([key, percent]) => `${key}:${percent}%`)
    .join(' + ');
}

function makeCompositionArmy(
  candidate: CompositionCandidate,
  totalCount: number,
  troopByKey: Map<string, TroopTypeRow>,
): SimArmy {
  const entries = Object.entries(candidate.ratios).filter(([key]) => troopByKey.has(key));
  if (!entries.length) return { units: [] };

  const units: SimUnit[] = entries.map(([key, percent]) => ({
    troopType: troopByKey.get(key)!,
    count: Math.max(0, Math.round((totalCount * percent) / 100)),
  }));

  const diff = totalCount - units.reduce((sum, unit) => sum + unit.count, 0);
  units[0].count += diff;

  return { units: units.filter((unit) => unit.count > 0) };
}

function recruitmentCost(army: SimArmy): number {
  return army.units.reduce((sum, unit) => {
    const costPer100 = unit.troopType.cost_per_100 ?? 0;
    return sum + Math.ceil((unit.count / 100) * costPer100);
  }, 0);
}

function armyUpkeep(army: SimArmy): number {
  return army.units.reduce((sum, unit) => {
    const upkeepPer100 = unit.troopType.upkeep_per_100 ?? 0;
    return sum + Math.ceil(Math.max(0, unit.count) / 100) * upkeepPer100;
  }, 0);
}

function describeArmy(army: SimArmy): string {
  return army.units.map((unit) => `${unit.count} ${unit.troopType.key}`).join(', ');
}

function simulateArmyCombat(
  attackerInput: SimArmy,
  defenderInput: SimArmy,
  defenderBuildings: CombatBuilding[],
  attackerTechs: string[],
) {
  const attacker = cloneArmy(attackerInput);
  const defender = cloneArmy(defenderInput);

  const attackerBasePower = armyAttackPower(attacker);
  const attackerPower = applyAttackTechs(attackerBasePower, attackerTechs);
  const defenderBasePower = armyDefensePower(defender);
  const buildingModifier = computeBuildModifier(defenderBuildings);
  const defenderPower = defenderBasePower * buildingModifier;

  let attackerCasualtyRate = 0;
  let defenderCasualtyRate = 0;
  let winner: 'ATTACKER' | 'DEFENDER';
  let captured = false;

  if (attackerPower > defenderPower) {
    winner = 'ATTACKER';
    attackerCasualtyRate = Math.max(CASUALTY_FLOOR, defenderPower / (attackerPower + defenderPower));
    applyCasualties(attacker, attackerCasualtyRate);
    defender.units = [];
    captured = armyTotalTroops(attacker) >= ARMY_MIN_SIZE;
    if (!captured) {
      attacker.units = [];
    }
  } else {
    winner = 'DEFENDER';
    const maxAttackerLoseRate = 0.8;
    const baseAttackerRateCoeff = 1.4;
    const attackerRate = (defenderPower / (defenderPower + attackerPower)) * baseAttackerRateCoeff;

    attackerCasualtyRate = Math.min(maxAttackerLoseRate, Math.max(CASUALTY_FLOOR, attackerRate));
    applyCasualties(attacker, attackerCasualtyRate);
    if (armyTotalTroops(attacker) < ARMY_MIN_SIZE) {
      attacker.units = [];
    }

    const baseDefenderRateCoeff = 0.7;
    const baseDefenderRate = (attackerPower / (attackerPower + defenderPower)) * baseDefenderRateCoeff;
    defenderCasualtyRate = Math.max(CASUALTY_FLOOR, baseDefenderRate);
    applyCasualties(defender, defenderCasualtyRate);
    if (armyTotalTroops(defender) < ARMY_MIN_SIZE) {
      defender.units = [];
    }
  }

  return {
    winner,
    captured,
    attackerPower,
    defenderPower,
    buildingModifier,
    attackerCasualtyRate,
    defenderCasualtyRate,
    attackerAfter: armyTotalTroops(attacker),
    defenderAfter: armyTotalTroops(defender),
    attackerAfterArmy: attacker,
    defenderAfterArmy: defender,
  };
}

function minimumAttackersToWin(
  attackerType: TroopTypeRow,
  defenderType: TroopTypeRow,
  defenderCount: number,
  defenderBuildings: CombatBuilding[],
  attackerTechs: string[],
): number | null {
  const defenderPower = defenderCount * defenderType.defense * computeBuildModifier(defenderBuildings);

  const winsAt = (count: number): boolean => {
    const attackerPower = applyAttackTechs(count * attackerType.attack, attackerTechs);
    return attackerPower > defenderPower;
  };

  let high = 1;
  while (!winsAt(high)) {
    high *= 2;
    if (high > 10_000_000) return null;
  }

  let low = 1;
  while (low < high) {
    const mid = Math.floor((low + high) / 2);
    if (winsAt(mid)) {
      high = mid;
    } else {
      low = mid + 1;
    }
  }

  return low;
}

function simulateLegacyLocalCombat(
  attackerCount: number,
  defenderCount: number,
  defenderBuildings: CombatBuilding[],
  attackerTechs: string[],
) {
  const buildingModifier = computeBuildModifier(defenderBuildings);
  const attackingTroops = applyAttackTechs(attackerCount, attackerTechs);
  const battleResult = attackingTroops / buildingModifier - defenderCount;

  if (battleResult > 0) {
    return {
      winner: 'ATTACKER',
      attackerPower: attackingTroops,
      buildingModifier,
      targetTroopsAfter: Math.round(battleResult),
    };
  }

  if (battleResult < 0) {
    return {
      winner: 'DEFENDER',
      attackerPower: attackingTroops,
      buildingModifier,
      targetTroopsAfter: Math.round(-battleResult),
    };
  }

  return {
    winner: 'DRAW_DEFENDER_EMPTY',
    attackerPower: attackingTroops,
    buildingModifier,
    targetTroopsAfter: 0,
  };
}

function minimumLegacyAttackersToWin(
  defenderCount: number,
  defenderBuildings: CombatBuilding[],
  attackerTechs: string[],
): number | null {
  const modifier = computeBuildModifier(defenderBuildings);

  const winsAt = (attackerCount: number): boolean =>
    applyAttackTechs(attackerCount, attackerTechs) / modifier - defenderCount > 0;

  let high = 1;
  while (!winsAt(high)) {
    high *= 2;
    if (high > 10_000_000) return null;
  }

  let low = 1;
  while (low < high) {
    const mid = Math.floor((low + high) / 2);
    if (winsAt(mid)) high = mid;
    else low = mid + 1;
  }

  return low;
}

function fogOfWarRows(
  ownCandidates: CompositionCandidate[],
  enemyCandidates: CompositionCandidate[],
  totalCount: number,
  defenderBuildings: CombatBuilding[],
  attackerTechs: string[],
  troopByKey: Map<string, TroopTypeRow>,
) {
  const ownArmies = ownCandidates.map((candidate) => {
    const army = makeCompositionArmy(candidate, totalCount, troopByKey);
    return {
      candidate,
      army,
      attackPower: applyAttackTechs(armyAttackPower(army), attackerTechs),
      defensePower: armyDefensePower(army),
      cost: recruitmentCost(army),
      upkeep: armyUpkeep(army),
    };
  });

  const enemyArmies = enemyCandidates.map((candidate) => {
    const army = makeCompositionArmy(candidate, totalCount, troopByKey);
    return {
      attackPower: applyAttackTechs(armyAttackPower(army), attackerTechs),
      defensePower: armyDefensePower(army),
    };
  });

  const buildingModifier = computeBuildModifier(defenderBuildings);
  const maxEnemyDefense = Math.max(...enemyArmies.map((entry) => entry.defensePower * buildingModifier));
  const maxEnemyAttack = Math.max(...enemyArmies.map((entry) => entry.attackPower));

  return ownArmies.map((entry) => {
    const attackScore = maxEnemyDefense > 0 ? entry.attackPower / maxEnemyDefense : 0;
    const defenseScore = maxEnemyAttack > 0 ? (entry.defensePower * buildingModifier) / maxEnemyAttack : 0;
    const generalistScore = Math.min(attackScore, defenseScore);
    const upkeepAdjustedScore = generalistScore * 100 / Math.max(1, entry.upkeep);

    return {
      composition: entry.candidate.key,
      attackPower: entry.attackPower,
      defensePower: entry.defensePower * buildingModifier,
      cost: entry.cost,
      upkeep: entry.upkeep,
      attackScore,
      defenseScore,
      generalistScore,
      upkeepAdjustedScore,
    };
  });
}

function topFogRows(
  rows: ReturnType<typeof fogOfWarRows>,
  role: 'attacker' | 'defender' | 'generalist' | 'generalist_per_upkeep',
  limit: number,
) {
  const scoreKey =
    role === 'attacker'
      ? 'attackScore'
      : role === 'defender'
        ? 'defenseScore'
        : role === 'generalist'
          ? 'generalistScore'
          : 'upkeepAdjustedScore';

  return [...rows]
    .sort((a, b) => {
      const scoreDelta = b[scoreKey] - a[scoreKey];
      if (scoreDelta !== 0) return scoreDelta;
      const upkeepDelta = a.upkeep - b.upkeep;
      if (upkeepDelta !== 0) return upkeepDelta;
      return a.cost - b.cost;
    })
    .slice(0, limit)
    .map((row, index) => ({
      rank: index + 1,
      role,
      score: row[scoreKey],
      ...row,
    }));
}

function pushSection(lines: string[], title: string): void {
  lines.push('', '='.repeat(100), title, '='.repeat(100), '');
}

function buildReport(
  troopTypes: TroopTypeRow[],
  buildings: BuildingRow[],
  options: CliOptions,
): string {
  const troopByKey = indexBy(troopTypes, 'key') as Map<string, TroopTypeRow>;
  const buildingByType = indexBy(buildings, 'type') as Map<string, BuildingRow>;
  const rosterScenarios = buildRosterScenarios(troopTypes);
  const fogCandidatesByRoster = rosterScenarios.map((roster) => ({
    roster,
    candidates: generateCompositionCandidates(roster.troopTypes, options.compositionStep),
  }));
  const enemyFogCandidates = uniqueCompositionCandidates(
    fogCandidatesByRoster.flatMap((entry) => entry.candidates),
  );
  const lines: string[] = [];

  lines.push('RP Map Prototype - Balance Report');
  lines.push(`Generated at: ${new Date().toISOString()}`);
  lines.push(`Data source: ${path.relative(API_ROOT, path.join(DATA_DIR, 'troop-types.json'))}, ${path.relative(API_ROOT, path.join(DATA_DIR, 'buildings.json'))}`);
  lines.push('');
  lines.push('Combat formulas mirrored from api/src/actions/action-executor.service.ts via combat-calculator.ts.');
  lines.push('Army attacker wins when attackerPower > defenderPower.');
  lines.push('Defender building modifier is additive across defensive buildings, then multiplied into defender power.');
  lines.push(`Army minimum size after casualties: ${ARMY_MIN_SIZE}; casualty floor: ${pct(CASUALTY_FLOOR)}.`);
  lines.push(`Defensive building types: ${[...DEFENSIVE_BUILDING_TYPES].join(', ')}`);
  lines.push(`Fog-of-war composition grid: ${options.compositionStep}% step.`);
  lines.push(`Fog-of-war own rosters: ${fogCandidatesByRoster.map((entry) => `${entry.roster.key}=${entry.candidates.length}`).join(', ')}.`);
  lines.push(`Fog-of-war enemy pool: ${enemyFogCandidates.length} legal candidate compositions across all rosters.`);

  pushSection(lines, 'Unit Stats');
  lines.push(...renderTable(
    ['key', 'atk', 'def', 'cost100', 'upkeep100', 'atk/upkeep', 'def/upkeep', 'tech', 'building'],
    troopTypes.map((tt) => [
      tt.key,
      fmt(tt.attack),
      fmt(tt.defense),
      tt.cost_per_100,
      tt.upkeep_per_100,
      fmt((tt.attack * 100) / tt.upkeep_per_100, 3),
      fmt((tt.defense * 100) / tt.upkeep_per_100, 3),
      tt.tech_requirement ?? '',
      tt.building_requirement ?? '',
    ]),
  ));

  pushSection(lines, 'Building Defense Scenarios');
  lines.push(...renderTable(
    ['scenario', 'buildings', 'modifier'],
    BUILDING_SCENARIOS.map((scenario) => {
      const scenarioBuildings = getScenarioBuildings(scenario, buildingByType);
      return [
        scenario.key,
        scenarioBuildings.map((building) => `${building.type}(${building.modifier ?? '0'})`).join(', ') || 'none',
        fmt(computeBuildModifier(scenarioBuildings)),
      ];
    }),
  ));

  pushSection(lines, 'Attack Tech Scenarios');
  lines.push(...renderTable(
    ['scenario', 'techs', '100 base power becomes'],
    ATTACK_TECH_SCENARIOS.map((scenario) => [
      scenario.key,
      scenario.techs.join(', ') || 'none',
      fmt(applyAttackTechs(100, scenario.techs)),
    ]),
  ));

  pushSection(lines, 'Pure Unit Thresholds: Minimum Attackers Needed To Beat Defender');
  lines.push('legal_min_attackers is clamped to the current army minimum size.');
  lines.push(...renderTable(
    [
      'buildings',
      'tech',
      'def_count',
      'attacker',
      'defender',
      'min_attackers',
      'legal_min',
      'att_power_at_legal',
      'def_power',
      'att_left_after',
      'captured',
    ],
    BUILDING_SCENARIOS.flatMap((buildingScenario) => {
      const scenarioBuildings = getScenarioBuildings(buildingScenario, buildingByType);
      return ATTACK_TECH_SCENARIOS.flatMap((techScenario) =>
        options.defenderCounts.flatMap((defenderCount) =>
          troopTypes.flatMap((attackerType) =>
            troopTypes.map((defenderType) => {
              const minAttackers = minimumAttackersToWin(
                attackerType,
                defenderType,
                defenderCount,
                scenarioBuildings,
                techScenario.techs,
              );
              const legalMin = minAttackers == null ? null : Math.max(ARMY_MIN_SIZE, minAttackers);
              const result = legalMin == null
                ? null
                : simulateArmyCombat(
                  makePureArmy(attackerType, legalMin),
                  makePureArmy(defenderType, defenderCount),
                  scenarioBuildings,
                  techScenario.techs,
                );

              return [
                buildingScenario.key,
                techScenario.key,
                defenderCount,
                attackerType.key,
                defenderType.key,
                minAttackers ?? 'n/a',
                legalMin ?? 'n/a',
                result ? fmt(result.attackerPower) : 'n/a',
                result ? fmt(result.defenderPower) : 'n/a',
                result ? result.attackerAfter : 'n/a',
                result ? (result.captured ? 'yes' : 'no') : 'n/a',
              ];
            }),
          ),
        ),
      );
    }),
  ));

  pushSection(lines, 'Pure Unit Equal-Size Army Combat');
  lines.push(...renderTable(
    [
      'buildings',
      'tech',
      'count',
      'attacker',
      'defender',
      'winner',
      'captured',
      'att_power',
      'def_power',
      'att_loss',
      'def_loss',
      'att_after',
      'def_after',
    ],
    BUILDING_SCENARIOS.flatMap((buildingScenario) => {
      const scenarioBuildings = getScenarioBuildings(buildingScenario, buildingByType);
      return ATTACK_TECH_SCENARIOS.flatMap((techScenario) =>
        options.attackerCounts.flatMap((count) =>
          troopTypes.flatMap((attackerType) =>
            troopTypes.map((defenderType) => {
              const result = simulateArmyCombat(
                makePureArmy(attackerType, count),
                makePureArmy(defenderType, count),
                scenarioBuildings,
                techScenario.techs,
              );
              return [
                buildingScenario.key,
                techScenario.key,
                count,
                attackerType.key,
                defenderType.key,
                result.winner,
                result.captured ? 'yes' : 'no',
                fmt(result.attackerPower),
                fmt(result.defenderPower),
                pct(result.attackerCasualtyRate),
                pct(result.defenderCasualtyRate),
                result.attackerAfter,
                result.defenderAfter,
              ];
            }),
          ),
        ),
      );
    }),
  ));

  pushSection(lines, 'Mixed Army Equal-Size Combat');
  lines.push('Mixed armies are generated by current troop keys and rounded to 10 troops per unit type.');
  lines.push(...renderTable(
    [
      'buildings',
      'tech',
      'count',
      'attacker_mix',
      'defender_mix',
      'winner',
      'captured',
      'att_power',
      'def_power',
      'att_loss',
      'def_loss',
      'att_after',
      'def_after',
    ],
    ['none', 'fort', 'capital_fort', 'all_defensive_stack'].flatMap((scenarioKey) => {
      const buildingScenario = BUILDING_SCENARIOS.find((scenario) => scenario.key === scenarioKey)!;
      const scenarioBuildings = getScenarioBuildings(buildingScenario, buildingByType);
      return ATTACK_TECH_SCENARIOS.flatMap((techScenario) =>
        options.attackerCounts.flatMap((count) =>
          MIXED_TEMPLATES.flatMap((attackerTemplate) =>
            MIXED_TEMPLATES.map((defenderTemplate) => {
              const attackerArmy = makeMixedArmy(attackerTemplate, count, troopByKey);
              const defenderArmy = makeMixedArmy(defenderTemplate, count, troopByKey);
              const result = simulateArmyCombat(attackerArmy, defenderArmy, scenarioBuildings, techScenario.techs);
              return [
                buildingScenario.key,
                techScenario.key,
                count,
                attackerTemplate.key,
                defenderTemplate.key,
                result.winner,
                result.captured ? 'yes' : 'no',
                fmt(result.attackerPower),
                fmt(result.defenderPower),
                pct(result.attackerCasualtyRate),
                pct(result.defenderCasualtyRate),
                `${result.attackerAfter} (${describeArmy(result.attackerAfterArmy) || 'destroyed'})`,
                `${result.defenderAfter} (${describeArmy(result.defenderAfterArmy) || 'destroyed'})`,
              ];
            }),
          ),
        ),
      );
    }),
  ));

  pushSection(lines, 'Strict Fog Of War: Robust Composition Search');
  lines.push('Assumption: enemy composition is unknown, but total army size, tech scenario, and battlefield building scenario are known.');
  lines.push('Own candidates are restricted to legal rosters: common, guild, noble, holy. Enemy candidates are any legal roster composition, without impossible cross-class mixes.');
  lines.push('The search enumerates every composition on the configured percentage grid and scores each candidate against the strongest possible unknown enemy in the legal enemy pool.');
  lines.push('attack_score = own attack power / max enemy defense power. defense_score = own modified defense power / max enemy attack power.');
  lines.push('generalist_score = min(attack_score, defense_score). Values above 1 mean the army is robust against every equal-size generated enemy composition for that role.');
  lines.push(...renderTable(
    [
      'buildings',
      'tech',
      'count',
      'roster',
      'role',
      'rank',
      'score',
      'attack_score',
      'defense_score',
      'atk_power',
      'def_power',
      'cost',
      'upkeep',
      'composition',
    ],
    BUILDING_SCENARIOS.flatMap((buildingScenario) => {
      const scenarioBuildings = getScenarioBuildings(buildingScenario, buildingByType);
      return ATTACK_TECH_SCENARIOS.flatMap((techScenario) =>
        options.attackerCounts.flatMap((count) =>
          fogCandidatesByRoster.flatMap(({ roster, candidates }) => {
            const fogRows = fogOfWarRows(
              candidates,
              enemyFogCandidates,
              count,
              scenarioBuildings,
              techScenario.techs,
              troopByKey,
            );
            return (['attacker', 'defender', 'generalist', 'generalist_per_upkeep'] as const).flatMap((role) =>
              topFogRows(fogRows, role, FOG_TOP_RESULTS_PER_ROLE).map((row) => [
                buildingScenario.key,
                techScenario.key,
                count,
                roster.key,
                row.role,
                row.rank,
                fmt(row.score, 4),
                fmt(row.attackScore, 4),
                fmt(row.defenseScore, 4),
                fmt(row.attackPower),
                fmt(row.defensePower),
                row.cost,
                row.upkeep,
                row.composition,
              ]),
            );
          }),
        ),
      );
    }),
  ));

  pushSection(lines, 'Legacy Local-Troops INVADE Formula');
  lines.push('This covers the older province local_troops combat: result = attackingTroops / buildingModifier - defenderTroops.');
  lines.push('Local troops do not use troop type attack/defense stats.');
  lines.push(...renderTable(
    [
      'buildings',
      'tech',
      'def_count',
      'min_attackers',
      'result_at_min',
      'target_troops_after',
      'modifier',
    ],
    BUILDING_SCENARIOS.flatMap((buildingScenario) => {
      const scenarioBuildings = getScenarioBuildings(buildingScenario, buildingByType);
      return ATTACK_TECH_SCENARIOS.flatMap((techScenario) =>
        options.defenderCounts.map((defenderCount) => {
          const minAttackers = minimumLegacyAttackersToWin(defenderCount, scenarioBuildings, techScenario.techs);
          const result = minAttackers == null
            ? null
            : simulateLegacyLocalCombat(minAttackers, defenderCount, scenarioBuildings, techScenario.techs);
          return [
            buildingScenario.key,
            techScenario.key,
            defenderCount,
            minAttackers ?? 'n/a',
            result?.winner ?? 'n/a',
            result?.targetTroopsAfter ?? 'n/a',
            result ? fmt(result.buildingModifier) : 'n/a',
          ];
        }),
      );
    }),
  ));

  pushSection(lines, 'Reference: Mixed Army Templates');
  lines.push(...renderTable(
    ['key', 'name', 'example at 1000 troops'],
    MIXED_TEMPLATES.map((template) => {
      const army = makeMixedArmy(template, 1000, troopByKey);
      return [template.key, template.name, describeArmy(army)];
    }),
  ));

  return `${lines.join('\n')}\n`;
}

function main(): void {
  const options = parseArgs(process.argv.slice(2));
  const troopTypesPath = path.join(DATA_DIR, 'troop-types.json');
  const buildingsPath = path.join(DATA_DIR, 'buildings.json');
  const troopTypes = readJsonArray<TroopTypeRow>(troopTypesPath);
  const buildings = readJsonArray<BuildingRow>(buildingsPath);

  const report = buildReport(troopTypes, buildings, options);
  const outPath = resolveOutputPath(options.outPath);
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, report, 'utf-8');

  console.log(`Balance report written: ${outPath}`);
}

main();
