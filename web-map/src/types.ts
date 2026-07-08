// TODO: sort types

export type ProvinceType = 'land' | 'water';

export type Landscape = 'plains' | 'forest' | 'mountain' | 'desert' | 'hills' | 'swamp';

export type MapMode = 'normal' | 'landscape' | 'resource' | 'economic' | 'army' | 'buildings';

export enum BuildingTypes {
  CAPITOL = 'CAPITOL',
  CAPITAL = 'CAPITAL',
  FARM = 'FARM',
  BARRACKS = 'BARRACKS',
  FORT = 'FORT',
  MARKET = 'MARKET',
  LIBRARY = 'LIBRARY',
  MINE = 'MINE',
  FORESTRY = 'FORESTRY',
  GARDEN = 'GARDEN',
  BAZAAR = 'BAZAAR',
  ARMORY = 'ARMORY',
  ROAD = 'ROAD',
  TEMPLE = 'TEMPLE',
  CATHEDRAL = 'CATHEDRAL',
  TRADE_HOUSE = 'TRADE_HOUSE',
  CASTLE = 'CASTLE',
  SAWMILL = 'SAWMILL',
  BRICKYARD = 'BRICKYARD',
  BARN = 'BARN',
}

export interface Tech {
  id: string;
  key: string;
  name: string;
  description: string;
  branch: string;
  isClassRoot: boolean;
  cost: number;
  prerequisites: string[];
}


export interface Resource {
  id: string;
  key: string;
  name: string;
  type: 'plain' | 'consumable';
  plainIncome: number;
}

export interface Good {
  id: string;
  name: string;
  type: 'civilian' | 'military';
  price_per_one: number;
}

/** A row from the player's goods inventory (GET /goods/mine). */
export interface UserGoodHolding {
  id: string;
  user_id: string;
  good_id: string;
  good: Good;
  quantity: number;
}

export interface Building {
  id: string;
  type: string;
  name: string;
  description: string;
  income: number | null;
  upkeep: number | null;
  modifier: string | null;
  cost: number;
  upgradeTo: string | null;
  requirementTech: string[] | null;
  requirementBuilding: string | null;
  buildable: boolean;
  destructible: boolean;
  uniquePerProvince: boolean;
  allowedProvinceResources: string[] | null;
  requirementResource: string | null;
  requirementResourceAmount: number | null;
  visible: boolean;
  canRecruit: boolean;
  isProduction: boolean;
  productionGood: string | null;
  productionRequirementResource: string | null;
  productionRequirementResourceAmount: number | null;
  productionAmount: number | null;
  resourceProductionAmount: number | null;
  requirementGood: string | null;
  requirementGoodAmount: number | null;
}

/** A building as it exists in a province — template fields plus the unique
 *  province_building instance id (multiple of the same type can coexist). */
export interface ProvinceBuilding extends Building {
  instanceId: string;
}

/** Static fields — never change after map import. Safe to cache in localStorage. */
export interface ProvinceLayout {
  id: string;
  polygon: string;
  type: ProvinceType;
  landscape: Landscape;
  resourceType: string;
  regionId: string;
  neighbors: string[] | null;
}

/** Dynamic fields — change only at turn end. Always fetched fresh. */
export interface ProvinceStateData {
  id: string;
  userId: string | null;
  localTroops: number | null;
  enemyHere?: boolean;
  buildings?: ProvinceBuilding[];
  buildingCap: number | null;
  /** Military controller when occupied (not the legal owner). Null = not occupied. */
  occupierId: string | null;
  occupationTurns: number;
}

export interface Province {
  id: string;
  type: ProvinceType;
  landscape: Landscape;
  polygon: string;
  resourceType: string;
  regionId: string;
  userId: string | null;
  localTroops: number;
  enemyHere?: boolean;
  buildings?: ProvinceBuilding[];
  neighbors?: string[] | null;
  buildingCap: number;
  occupierId: string | null;
  occupationTurns: number;
}

export enum UserClasses {
  GUILD = 'guild',
  HOLY = 'holy',
  NOBLE = 'noble',
}

/** A row from the player's resource ledger (GET /resources/mine). */
export interface UserResourceHolding {
  id: string;
  user_id: string;
  resource_id: string;
  resource: Resource;
  quantity: number;
}

export interface UserUpdate {
  id: string;
  color?: string;
  countryName?: string;
}

export interface User {
  id: string;
  login: string;
  countryName: string;
  color: string;
  troops: number;
  money: number;
  piety: number;
  class: string | null;
  isNew: boolean;
  provinces: Province[];
  researchPoints: number;
  completedResearch: string[];
}

export interface UserActive extends User {
  projectedIncome: number;
  projectedPiety: number | null;
  projectedResearch: number;
  projectedTroops: number;
}

export enum TroopCategory {
  INFANTRY = 'INFANTRY',
  RANGED = 'RANGED',
  CAVALRY = 'CAVALRY',
  SPECIAL = 'SPECIAL',
  PEASANT = 'PEASANT',
}

export interface TroopType {
  id: string;
  key: string;
  name: string;
  description: string;
  category: TroopCategory;
  cost_per_100: number;
  attack: number;
  defense: number;
  upkeep_per_100: number;
  tech_requirement: string | null;
  building_requirement: string | null;
  /** Good id, resolved against goods.mine for name/quantity. Null = no goods needed (money/pool only). */
  required_goods: string | null;
  /** Units of required_goods consumed per 100 troops recruited, one-time (not refunded on disband/removal). */
  goods_amount: number | null;
}

export interface ArmyUnit {
  id: string;
  army_id: string;
  troop_type_id: string;
  troopType: TroopType;
  count: number;
}

export interface Army {
  id: string;
  name: string | null;
  user_id: string;
  province_id: string;
  flat_upkeep: number;
  units: ArmyUnit[];
  /** Only present for enemy armies. null = present but count unknown; number = spy network revealed total. */
  totalTroops?: number | null;
}

export interface PartialUser {
  id: string;
  countryName: string;
  color: string;
}

export interface SetupUserResponse {
  user: {
    id: string;
    login: string;
    country_name: string;
    color: string;
    troops: number;
    money: number;
    is_new: boolean;
    provinces: Province[];
    researchPoints: number;
    projectedIncome: number,
    projectedPiety: number,
    projectedResearch: number,
    projectedTroops: number,
  };
  province: {
    id: string;
    type: ProvinceType;
    landscape: Landscape;
    polygon: string;
    resource_type: string;
    region_id: string;
    user_id: string;
    local_troops: number;
  };
}

export enum ActionType {
  BUILD = 'BUILD',
  UPGRADE = 'UPGRADE',
  TRANSFER_TROOPS = 'TRANSFER_TROOPS',
  RESEARCH = 'RESEARCH',
  REMOVE = 'REMOVE',
  ARMY_CREATE = 'ARMY_CREATE',
  ARMY_MOVE = 'ARMY_MOVE',
  ARMY_RECRUIT = 'ARMY_RECRUIT',
  ARMY_MERGE = 'ARMY_MERGE',
  ARMY_DISBAND = 'ARMY_DISBAND',
  ARMY_EDIT = 'ARMY_EDIT',
  COLONIZE = 'COLONIZE',
}

export interface ActionData {
  provinceId?: number;
  buildingType?: string;
  buildingId?: number;
  targetProvinceId?: number;
  troopCount?: number;
  upgradeLevel?: number;
  [key: string]: any; // Flexible for future action types
}

// ── Diplomacy ────────────────────────────────────────────────────────────

export enum DiplomaticState {
  NEUTRAL = 'neutral',
  WAR = 'war',
  PEACE = 'peace',
  ALLIANCE = 'alliance',
}

export enum TreatyKind {
  PEACE = 'peace',
  ALLIANCE = 'alliance',
  TRADE = 'trade',
  TROOPS_PASS = 'troops_pass',
  ARTICLE = 'article',
}

export enum TreatyVisibility {
  PUBLIC = 'public',
  PRIVATE = 'private',
}

export enum TreatyStatus {
  PENDING = 'pending',
  ACCEPTED = 'accepted',
  REJECTED = 'rejected',
  CANCELLED = 'cancelled',
}

export enum PeaceScope {
  LEADER = 'leader',
  SEPARATE = 'separate',
}

export enum WarSide {
  ATTACKER = 'attacker',
  DEFENDER = 'defender',
}

export type TreatyArticle =
  | { type: 'cede_province'; provinceId: string; from: string; to: string }
  | { type: 'money_tribute'; amount: number; from: string; to: string }
  | { type: 'resource_tribute'; resourceKey: string; amount: number; from: string; to: string }
  | { type: 'goods_tribute'; goodId: string; amount: number; from: string; to: string }
  | { type: 'set_state'; state: DiplomaticState }
  | { type: 'grant_pass'; from: string; to: string }
  | { type: 'trade_agreement' }
  | { type: 'text'; markdown: string };

/** Normalized, per-other-player view returned by GET /diplomacy/relations. */
export interface DiplomaticRelation {
  otherUserId: string;
  state: DiplomaticState;
  hasTrade: boolean;
  /** True if the other player has granted troops-pass to me. */
  passToOther: boolean;
  /** True if I have granted troops-pass to the other player. */
  passFromOther: boolean;
}

export interface WarParticipant {
  id: string;
  war_id: string;
  user_id: string;
  side: WarSide;
  is_leader: boolean;
}

export interface War {
  id: string;
  attacker_leader_id: string;
  defender_leader_id: string;
  status: 'active' | 'ended';
  participants: WarParticipant[];
  createdAt: string;
}

export interface Treaty {
  id: string;
  name: string;
  proposer_id: string;
  receiver_id: string;
  kind: TreatyKind;
  peace_scope: PeaceScope | null;
  visibility: TreatyVisibility;
  recurring: boolean;
  status: TreatyStatus;
  articles: TreatyArticle[];
  note: string | null;
  pending_turns: number;
  view_only: boolean;
  createdAt: string;
  resolved_at: string | null;
}

