import { ActionType, BuildingTypes, MapMode, Province } from '../types';

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
}

export interface MapModeRenderData {
  mode: MapMode;
  filterValue: string | null;
  economyByProvinceId: Record<string, ProvinceEconomy>;
  economyMaxAbs: number;
  recruitsByProvinceId: Record<string, number>;
  recruitsMax: number;
  buildingSlotsByProvinceId: Record<string, ProvinceBuildingSlots>;
}

interface MinimalAction {
  actionType: ActionType;
  actionData?: Record<string, unknown> | null;
}

const MINE_INCOME_BY_RESOURCE: Record<string, number> = {
  stone: 75,
  iron: 125,
  gold: 300,
};

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

const ZERO_HEAT_COLOR = '#fde68a';

function positiveNumber(value: number | null | undefined): number {
  return Number.isFinite(Number(value)) && Number(value) >= 0 ? Number(value) : 0;
}

function getActionProvinceId(action: MinimalAction): string | null {
  const rawId = action.actionData?.province_id ?? action.actionData?.provinceId;
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

export function getProvinceEconomy(province: Province, completedResearch: string[]): ProvinceEconomy {
  let income = 0;
  let upkeep = 0;
  let farmGardenIncome = 0;

  for (const building of province.buildings ?? []) {
    switch (building.type) {
      case BuildingTypes.MINE:
        income += MINE_INCOME_BY_RESOURCE[province.resourceType] ?? 0;
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

export function getProvinceBuildingSlots(
  province: Province,
  pendingBuildCount: number,
): ProvinceBuildingSlots {
  const cap = Math.max(0, province.buildingCap ?? 0);
  const used = Math.max(0, (province.buildings?.length ?? 0) + pendingBuildCount);
  return { cap, used, free: Math.max(0, cap - used) };
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
    return `Building slots: ${slots.used}/${slots.cap} (${slots.free} free)`;
  }

  return null;
}
