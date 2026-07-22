import { ActionType, Building, BuildingTypes, MapMode, Province, ProvinceBuilding, ProvinceType } from '../types';

export const MAP_MODE_OPTIONS: { value: MapMode; label: string }[] = [
  { value: 'normal', label: 'Normal' },
  { value: 'landscape', label: 'Landscape' },
  { value: 'resource', label: 'Resource' },
  { value: 'economic', label: 'Economic' },
  { value: 'army', label: 'Army' },
  { value: 'buildings', label: 'Buildings' },
];

export interface ProvinceEconomy {
  income: number;
  upkeep: number;
  net: number;
}

export interface ProvinceBuildingSlots {
  cap: number;
  used: number;
  free: number;
  pendingBuilds: number;
  pendingUpgrades: number;
  availableUpgrades: number;
}

/** One province's status while a specific building is selected in fast-build mode. */
export interface FastBuildCell {
  status: 'green' | 'red' | 'yellow';
  /** Whether clicking this province would actually queue an action right now — independent
   *  of `status`: a yellow (already-pending) province can still accept another click if a
   *  slot remains, a red one never can. Drives the click handler, not just the tint. */
  canQueue: boolean;
  /** Upgrade mode only — the built ProvinceBuilding instance that would be upgraded. */
  upgradeInstanceId?: string;
  /** Set only when `status === 'yellow'` — the pending action id a right-click here cancels. */
  cancelActionId?: string;
}

export interface MapModeRenderData {
  mode: MapMode;
  filterValue: string | null;
  economyByProvinceId: Record<string, ProvinceEconomy>;
  economyMaxAbs: number;
  recruitsByProvinceId: Record<string, number>;
  recruitsMax: number;
  buildingSlotsByProvinceId: Record<string, ProvinceBuildingSlots>;
  fastBuildByProvinceId: Record<string, FastBuildCell>;
}

interface MinimalAction {
  id: string;
  actionType: ActionType;
  actionData?: Record<string, unknown> | null;
}

const BUILDING_UPKEEP_TYPES = new Set<string>([
  BuildingTypes.FORT,
  BuildingTypes.BARRACKS,
  BuildingTypes.ARMORY,
]);

const LANDSCAPE_MODE_COLORS: Record<string, string> = {
  plains: '#87c66b',
  forest: '#2f855a',
  mountain: '#a1a1aa',
  desert: '#eabf5e',
  hills: '#b7793f',
  swamp: '#4f9f8c',
};

const RESOURCE_MODE_COLORS: Record<string, string> = {
  fish: '#38a6c9',
  grain: '#d8b84f',
  gold: '#f4c542',
  iron: '#9ca3af',
  stone: '#7c8798',
  wood: '#5f9f4f',
};

export const DEFAULT_MAP_LAND_COLOR = 'rgb(255, 255, 255)';
export const DEFAULT_MAP_WATER_COLOR = 'rgb(174, 226, 255)';
export const BUILDING_PENDING_COLOR = '#facc15';
export const BUILDING_UPGRADE_AVAILABLE_COLOR = '#a855f7';

// Fast-build mode: black = not a candidate province at all (unowned/water), green/red/yellow
// reuse the yellow "pending" color above so "already queued" reads consistently everywhere.
export const FASTBUILD_BLACK = '#000000';
export const FASTBUILD_GREEN = '#16a34a';
export const FASTBUILD_RED = '#dc2626';

const ZERO_HEAT_COLOR = '#fde68a';

function positiveNumber(value: number | null | undefined): number {
  return Number.isFinite(Number(value)) && Number(value) >= 0 ? Number(value) : 0;
}

function getActionProvinceId(action: MinimalAction): string | null {
  const rawId = action.actionData?.province_id ?? action.actionData?.provinceId;
  return rawId == null ? null : String(rawId);
}

function getActionProvinceBuildingId(action: MinimalAction): string | null {
  const rawId = action.actionData?.province_building_id ?? action.actionData?.provinceBuildingId;
  return rawId == null ? null : String(rawId);
}

function mixColor(from: [number, number, number], to: [number, number, number], amount: number): string {
  const clamped = Math.max(0, Math.min(1, amount));
  const [r1, g1, b1] = from;
  const [r2, g2, b2] = to;
  const r = Math.round(r1 + (r2 - r1) * clamped);
  const g = Math.round(g1 + (g2 - g1) * clamped);
  const b = Math.round(b1 + (b2 - b1) * clamped);
  return `rgb(${r}, ${g}, ${b})`;
}

export function heatColor(value: number, maxAbs: number): string {
  if (value === 0 || maxAbs <= 0) return ZERO_HEAT_COLOR;
  const intensity = Math.max(0.18, Math.min(1, Math.abs(value) / maxAbs));
  if (value > 0) {
    return mixColor([220, 252, 231], [22, 163, 74], intensity);
  }
  return mixColor([254, 226, 226], [220, 38, 38], intensity);
}

export function positiveScaleColor(value: number, maxValue: number): string {
  if (value <= 0 || maxValue <= 0) return ZERO_HEAT_COLOR;
  const intensity = Math.max(0.18, Math.min(1, value / maxValue));
  return mixColor([220, 252, 231], [22, 163, 74], intensity);
}

export function getProvinceEconomy(
  province: Province,
  completedResearch: string[],
  plainIncomeByResourceKey: Record<string, number> = {},
): ProvinceEconomy {
  let income = 0;
  let upkeep = 0;
  let farmGardenIncome = 0;

  for (const building of province.buildings ?? []) {
    switch (building.type) {
      case BuildingTypes.MINE:
        income += plainIncomeByResourceKey[province.resourceType] ?? 0;
        break;
      case BuildingTypes.FARM:
      case BuildingTypes.GARDEN: {
        const buildingIncome = positiveNumber(building.income);
        farmGardenIncome += buildingIncome;
        income += buildingIncome;
        break;
      }
      default:
        income += positiveNumber(building.income);
    }

    if (BUILDING_UPKEEP_TYPES.has(building.type)) {
      upkeep += positiveNumber(building.upkeep);
    }
  }

  for (const techKey of completedResearch) {
    if (techKey === 'economy.trade_routes') {
      income = Math.round(income * 1.2);
    } else if (techKey === 'economy.agriculture') {
      income += Math.round(farmGardenIncome * 0.15);
    } else if (techKey === 'economy.advanced_taxation') {
      income += 10;
    } else if (techKey === 'economy.monopoly') {
      income = Math.round(income * 1.1);
    } else if (techKey === 'guild.merchant_guilds') {
      upkeep = Math.floor(upkeep * 0.85);
    } else if (techKey === 'military.army_logistics') {
      upkeep = Math.floor(upkeep * 0.8);
    }
  }

  return { income, upkeep, net: income - upkeep };
}

export function getProvinceRecruits(province: Province): number {
  let recruitBuildings = 0;
  for (const building of province.buildings ?? []) {
    if (building.type === BuildingTypes.BARRACKS || building.type === BuildingTypes.CAPITAL) {
      recruitBuildings += 1;
    }
  }
  return recruitBuildings * 50;
}

export function getPendingBuildCountsByProvinceId(actions: MinimalAction[]): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const action of actions) {
    if (action.actionType !== ActionType.BUILD) continue;
    const provinceId = getActionProvinceId(action);
    if (!provinceId) continue;
    counts[provinceId] = (counts[provinceId] ?? 0) + 1;
  }
  return counts;
}

/** A pending BUILD action, reduced to what fast-build mode needs: which building type it's
 *  for, and the action id to cancel it (right-click on a yellow province). */
export interface PendingBuildAction {
  id: string;
  type: string;
}

/** Pending BUILD actions (id + building type) queued this turn, per province — used by
 *  fast-build mode to decide "yellow" (already building at least one of this type) and to
 *  resolve which action a right-click on that province should cancel. */
export function getPendingBuildActionsByProvinceId(
  actions: MinimalAction[],
  buildingTemplates: Building[],
): Record<string, PendingBuildAction[]> {
  const templateById = new Map(buildingTemplates.map((b) => [b.id, b]));
  const result: Record<string, PendingBuildAction[]> = {};
  for (const action of actions) {
    if (action.actionType !== ActionType.BUILD) continue;
    const provinceId = getActionProvinceId(action);
    if (!provinceId) continue;
    const bid = action.actionData?.building_id ?? action.actionData?.buildingId;
    const type = templateById.get(String(bid))?.type;
    if (!type) continue;
    if (!result[provinceId]) result[provinceId] = [];
    result[provinceId].push({ id: action.id, type });
  }
  return result;
}

/** Action id for every pending UPGRADE action, keyed by the built ProvinceBuilding instance
 *  it targets — lets fast-build mode resolve which action a right-click cancel should hit. */
export function getPendingUpgradeActionIdByInstanceId(actions: MinimalAction[]): Record<string, string> {
  const result: Record<string, string> = {};
  for (const action of actions) {
    if (action.actionType !== ActionType.UPGRADE) continue;
    const provinceBuildingId = getActionProvinceBuildingId(action);
    if (!provinceBuildingId) continue;
    result[provinceBuildingId] = action.id;
  }
  return result;
}

export function getPendingProvinceBuildingIdsByProvinceId(
  actions: MinimalAction[],
  actionType: ActionType.UPGRADE | ActionType.REMOVE,
): Record<string, Set<string>> {
  const idsByProvinceId: Record<string, Set<string>> = {};
  for (const action of actions) {
    if (action.actionType !== actionType) continue;
    const provinceId = getActionProvinceId(action);
    const provinceBuildingId = getActionProvinceBuildingId(action);
    if (!provinceId || !provinceBuildingId) continue;
    if (!idsByProvinceId[provinceId]) idsByProvinceId[provinceId] = new Set<string>();
    idsByProvinceId[provinceId].add(provinceBuildingId);
  }
  return idsByProvinceId;
}

/** Total requirement_resource reserved by every pending BUILD action across all of the
 *  player's provinces (not scoped to one province) — used to net out what's actually
 *  still free in the stockpile, same convention as the build menu's inline computation. */
export function getPendingResourceUsage(
  actions: MinimalAction[],
  buildingTemplates: Building[],
): Record<string, number> {
  const used: Record<string, number> = {};
  const templateById = new Map(buildingTemplates.map((b) => [b.id, b]));
  for (const action of actions) {
    if (action.actionType !== ActionType.BUILD) continue;
    const bid = action.actionData?.building_id ?? action.actionData?.buildingId;
    const template = templateById.get(String(bid));
    if (template?.requirementResource && template?.requirementResourceAmount) {
      used[template.requirementResource] = (used[template.requirementResource] ?? 0) + template.requirementResourceAmount;
    }
  }
  return used;
}

/** Same as {@link getPendingResourceUsage}, but for requirement_good costs. */
export function getPendingGoodUsage(
  actions: MinimalAction[],
  buildingTemplates: Building[],
): Record<string, number> {
  const used: Record<string, number> = {};
  const templateById = new Map(buildingTemplates.map((b) => [b.id, b]));
  for (const action of actions) {
    if (action.actionType !== ActionType.BUILD) continue;
    const bid = action.actionData?.building_id ?? action.actionData?.buildingId;
    const template = templateById.get(String(bid));
    if (template?.requirementGood && template?.requirementGoodAmount) {
      used[template.requirementGood] = (used[template.requirementGood] ?? 0) + template.requirementGoodAmount;
    }
  }
  return used;
}

/** Client-side hint only — the backend (BuildActionHandler) is the source of truth for
 *  whether a building requiring a neighboring water province can actually be built. */
export function provinceHasWaterNeighbor(
  province: Province,
  provinceTypeById: Map<string, ProvinceType>,
): boolean {
  if (!province.neighbors) return false;
  return province.neighbors.some((nId) => provinceTypeById.get(nId) === 'water');
}

export interface BuildRequirementContext {
  userMoney: number;
  completedResearch: string[];
  /** Player's resource ledger (GET /resources/mine), keyed by resource key. */
  userResourcesByKey: Record<string, number>;
  pendingResourceUsage: Record<string, number>;
  /** Player's goods ledger (GET /goods/mine), keyed by good id. */
  userGoodsById: Record<string, number>;
  pendingGoodUsage: Record<string, number>;
  /** Optional — resolves a missing tech key to its display name in `reason`. */
  techs?: { key: string; name: string }[];
}

export interface BuildRequirementResult {
  /** True only if every requirement, including money, is satisfied. */
  passes: boolean;
  /** Human-readable reason a requirement failed (money is not surfaced here, matching
   *  the build menu's existing tooltip, which shows cost separately). Null if `passes`. */
  reason: string | null;
}

/** The single source of truth for "can this building be built in this province" —
 *  shared by the build menu and fast-build mode so they can't drift. Does NOT check
 *  building-cap/slot availability or whether one is already queued here — those are
 *  caller-specific (the modal disables on pending, fast-build colors it yellow). */
export function evaluateBuildRequirements(
  building: Building,
  provinceResourceType: string,
  builtTypesInProvince: Set<string>,
  hasWaterNeighbor: boolean,
  ctx: BuildRequirementContext,
): BuildRequirementResult {
  const allowedResources = building.allowedProvinceResources;
  const resourceMismatch = allowedResources?.length
    ? !allowedResources.includes(provinceResourceType)
    : false;

  const uniqueAlreadyBuilt = building.uniquePerProvince && builtTypesInProvince.has(building.type);
  const missingWaterNeighbor = building.requiresNeighborWater && !hasWaterNeighbor;

  const resourceCost = building.requirementResource;
  const resourceAmount = building.requirementResourceAmount ?? 1;
  const totalResourceUsed = resourceCost ? (ctx.pendingResourceUsage[resourceCost] ?? 0) : 0;
  const resourceAvailable = resourceCost
    ? (ctx.userResourcesByKey[resourceCost] ?? 0) - totalResourceUsed
    : Infinity;
  const resourceInsufficient = resourceCost ? resourceAvailable < resourceAmount : false;

  const goodCost = building.requirementGood;
  const goodAmount = building.requirementGoodAmount ?? 1;
  const totalGoodUsed = goodCost ? (ctx.pendingGoodUsage[goodCost] ?? 0) : 0;
  const goodAvailable = goodCost
    ? (ctx.userGoodsById[goodCost] ?? 0) - totalGoodUsed
    : Infinity;
  const goodInsufficient = goodCost ? goodAvailable < goodAmount : false;

  const missingTechKey = (building.requirementTech ?? []).find(
    (t) => !ctx.completedResearch.includes(t),
  );
  const missingTechName = missingTechKey
    ? (ctx.techs?.find((t) => t.key === missingTechKey)?.name ?? missingTechKey)
    : null;

  const moneyInsufficient = !ctx.userMoney || ctx.userMoney < building.cost;

  const reason = resourceMismatch
    ? `Requires a province with ${allowedResources!.join(' or ')} resource (this province: ${provinceResourceType || 'none'})`
    : uniqueAlreadyBuilt
      ? `Only one ${building.name} allowed per province`
      : missingWaterNeighbor
        ? 'Requires a province adjacent to water'
        : resourceInsufficient
          ? `Not enough ${resourceCost}: ${(resourceCost && ctx.userResourcesByKey[resourceCost]) ?? 0} available, ${totalResourceUsed} queued, ${Math.max(0, resourceAvailable)} free`
          : goodInsufficient
            ? `Not enough of the required good: ${(goodCost && ctx.userGoodsById[goodCost]) ?? 0} available, ${totalGoodUsed} queued, ${Math.max(0, goodAvailable)} free`
            : missingTechName
              ? `Missing required technology: ${missingTechName}`
              : null;

  const passes = !resourceMismatch && !uniqueAlreadyBuilt && !missingWaterNeighbor &&
    !resourceInsufficient && !goodInsufficient && !missingTechKey && !moneyInsufficient;

  return { passes, reason };
}

interface ProvinceBuildingSlotOptions {
  pendingUpgradeBuildingIds?: Set<string>;
  pendingRemoveBuildingIds?: Set<string>;
  buildingTemplates?: Building[];
  userMoney?: number;
  completedResearch?: string[];
}

export function canUpgradeProvinceBuilding(
  province: Province,
  building: ProvinceBuilding,
  buildingByType: Map<string, Building>,
  options: ProvinceBuildingSlotOptions,
): boolean {
  if (!building.upgradeTo) return false;
  if (options.pendingUpgradeBuildingIds?.has(building.instanceId)) return false;
  if (options.pendingRemoveBuildingIds?.has(building.instanceId)) return false;

  const upgradeBuilding = buildingByType.get(building.upgradeTo);
  if (!upgradeBuilding) return false;
  if (upgradeBuilding.requirementBuilding && upgradeBuilding.requirementBuilding !== building.type) return false;

  const cost = Number(upgradeBuilding.cost ?? 0) + 100;
  if (!Number.isFinite(cost) || !options.userMoney || options.userMoney < cost) return false;

  const allowedResources = upgradeBuilding.allowedProvinceResources;
  if (allowedResources?.length && !allowedResources.includes(province.resourceType)) return false;

  const completedResearch = options.completedResearch ?? [];
  const missingTech = (upgradeBuilding.requirementTech ?? []).some(
    (techKey) => !completedResearch.includes(techKey),
  );
  return !missingTech;
}

export function getProvinceBuildingSlots(
  province: Province,
  pendingBuildCount: number,
  options: ProvinceBuildingSlotOptions = {},
): ProvinceBuildingSlots {
  const cap = Math.max(0, province.buildingCap ?? 0);
  const used = Math.max(0, (province.buildings?.length ?? 0) + pendingBuildCount);
  const pendingUpgrades = Math.max(0, options.pendingUpgradeBuildingIds?.size ?? 0);
  const buildingByType = new Map((options.buildingTemplates ?? []).map((building) => [building.type, building]));
  const availableUpgrades = (province.buildings ?? []).filter((building) =>
    canUpgradeProvinceBuilding(province, building, buildingByType, options),
  ).length;

  return {
    cap,
    used,
    free: Math.max(0, cap - used),
    pendingBuilds: Math.max(0, pendingBuildCount),
    pendingUpgrades,
    availableUpgrades,
  };
}

export interface FastBuildEvalOptions {
  buildingTemplates: Building[];
  /** Pending BUILD actions already queued in this province this turn. */
  pendingBuildActionsInProvince: PendingBuildAction[];
  pendingUpgradeBuildingIds?: Set<string>;
  pendingRemoveBuildingIds?: Set<string>;
  /** Action id per pending-upgrade instance id (global, not province-scoped) — lets a
   *  right-click on a yellow upgrade cell resolve which action to cancel. */
  pendingUpgradeActionIdByInstanceId?: Record<string, string>;
  /** From getProvinceBuildingSlots(province, ...).free — already nets out pending builds. */
  freeSlots: number;
  buildRequirementCtx: BuildRequirementContext;
}

/** Fast-build mode's per-province verdict for one selected building — the single source of
 *  truth for both the map tint (green/red/yellow) and whether a click should actually queue
 *  anything. Reuses {@link evaluateBuildRequirements} (BUILD) and
 *  {@link canUpgradeProvinceBuilding} (UPGRADE) so eligibility can't drift from the existing
 *  build menu / province inspector. */
export function getFastBuildCell(
  province: Province,
  targetBuilding: Building,
  action: 'build' | 'upgrade',
  hasWaterNeighbor: boolean,
  options: FastBuildEvalOptions,
): FastBuildCell {
  if (action === 'build') {
    const pendingActionsOfType = options.pendingBuildActionsInProvince.filter((a) => a.type === targetBuilding.type);
    const pendingSameType = pendingActionsOfType.length > 0;
    const builtTypesInProvince = new Set((province.buildings ?? []).map((b) => b.type));
    const { passes } = evaluateBuildRequirements(
      targetBuilding,
      province.resourceType,
      builtTypesInProvince,
      hasWaterNeighbor,
      options.buildRequirementCtx,
    );
    const canQueue = options.freeSlots > 0 && passes;
    return {
      status: pendingSameType ? 'yellow' : (canQueue ? 'green' : 'red'),
      canQueue,
      cancelActionId: pendingSameType ? pendingActionsOfType[0].id : undefined,
    };
  }

  // Upgrade: targetBuilding is the upgrade *result* (e.g. Castle) — find every built
  // instance in this province whose upgrade path leads there (e.g. a Fort).
  const buildingByType = new Map(options.buildingTemplates.map((b) => [b.type, b]));
  const matchingSourceBuildings = (province.buildings ?? []).filter((b) => b.upgradeTo === targetBuilding.type);
  if (!matchingSourceBuildings.length) return { status: 'red', canQueue: false };

  let sawPending = false;
  let pendingCancelActionId: string | undefined;
  for (const source of matchingSourceBuildings) {
    if (options.pendingUpgradeBuildingIds?.has(source.instanceId)) {
      sawPending = true;
      pendingCancelActionId = options.pendingUpgradeActionIdByInstanceId?.[source.instanceId];
      continue;
    }
    const canUpgrade = canUpgradeProvinceBuilding(province, source, buildingByType, {
      pendingUpgradeBuildingIds: options.pendingUpgradeBuildingIds,
      pendingRemoveBuildingIds: options.pendingRemoveBuildingIds,
      buildingTemplates: options.buildingTemplates,
      userMoney: options.buildRequirementCtx.userMoney,
      completedResearch: options.buildRequirementCtx.completedResearch,
    });
    if (canUpgrade) {
      return { status: 'green', canQueue: true, upgradeInstanceId: source.instanceId };
    }
  }
  return { status: sawPending ? 'yellow' : 'red', canQueue: false, cancelActionId: pendingCancelActionId };
}

export function getCategoryModeColor(
  province: Province,
  mode: MapMode,
  filterValue: string | null,
): string | null {
  if (province.type === 'water') return DEFAULT_MAP_WATER_COLOR;
  const value = mode === 'landscape' ? province.landscape : province.resourceType;
  if (!value) return DEFAULT_MAP_LAND_COLOR;
  if (filterValue && value !== filterValue) return DEFAULT_MAP_LAND_COLOR;
  const palette = mode === 'landscape' ? LANDSCAPE_MODE_COLORS : RESOURCE_MODE_COLORS;
  return palette[value] ?? '#c084fc';
}

export function getMapModeTooltip(
  province: Province,
  renderData: MapModeRenderData,
): string | null {
  if (province.type === 'water') return null;

  if (renderData.mode === 'economic') {
    const economy = renderData.economyByProvinceId[province.id];
    if (!economy) return null;
    const prefix = economy.net > 0 ? '+' : '';
    return `Net income: ${prefix}${economy.net} (income ${economy.income}, upkeep ${economy.upkeep})`;
  }

  if (renderData.mode === 'army') {
    const recruits = renderData.recruitsByProvinceId[province.id];
    if (recruits == null) return null;
    return `Recruits: ${recruits}`;
  }

  if (renderData.mode === 'buildings') {
    const slots = renderData.buildingSlotsByProvinceId[province.id];
    if (!slots) return null;
    const details = [`${slots.free} free`];
    if (slots.pendingBuilds > 0) details.push(`${slots.pendingBuilds} pending build`);
    if (slots.availableUpgrades > 0) details.push(`${slots.availableUpgrades} upgrade available`);
    if (slots.pendingUpgrades > 0) details.push(`${slots.pendingUpgrades} pending upgrade`);
    return `Building slots: ${slots.used}/${slots.cap} (${details.join(', ')})`;
  }

  if (renderData.mode === 'fastbuild') {
    const cell = renderData.fastBuildByProvinceId[province.id];
    if (!cell) return 'Not your territory';
    if (cell.status === 'green') return 'Click to queue here';
    if (cell.status === 'yellow') return 'Already queued this turn — click to queue another, right-click to cancel';
    return 'Requirements not met';
  }

  return null;
}
