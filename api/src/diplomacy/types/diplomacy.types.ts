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

export enum WarStatus {
  ACTIVE = 'active',
  ENDED = 'ended',
}

export enum WarSide {
  ATTACKER = 'attacker',
  DEFENDER = 'defender',
}

/** Turns a province must stay occupied before it auto-cores to the occupier. */
export const OCCUPATION_CORE_THRESHOLD = 10;
/** Turns a pending treaty proposal can wait before it is auto-rejected. */
export const TREATY_EXPIRY_TURNS = 4;
/** Turns a PEACE relation lasts as an enforced truce before decaying to NEUTRAL. */
export const PEACE_DURATION_TURNS = 4;

export type TreatyArticle =
  | { type: 'cede_province'; provinceId: string; from: string; to: string }
  | { type: 'money_tribute'; amount: number; from: string; to: string }
  | { type: 'resource_tribute'; resourceKey: string; amount: number; from: string; to: string }
  | { type: 'goods_tribute'; goodId: string; amount: number; from: string; to: string }
  | { type: 'set_state'; state: DiplomaticState }
  | { type: 'grant_pass'; from: string; to: string }
  | { type: 'trade_agreement' }
  | { type: 'text'; markdown: string };

/** Returns [smaller, larger] user ids so a pair always maps to one canonical relation row. */
export const canonicalPair = (a: string, b: string): [string, string] =>
  a < b ? [a, b] : [b, a];
