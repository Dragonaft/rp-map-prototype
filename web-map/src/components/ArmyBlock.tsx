import React, { useCallback, useMemo, useState } from 'react';
import { Tooltip } from '@mui/material';
import { useAppDispatch, useAppSelector } from '../store/hooks';
import { addAction, removeActionById } from '../store/slices/actionsSlice';
import { updateArmy } from '../store/slices/armiesSlice';
import type { RootState } from '../store/store';
import { ActionType, Army, TroopType } from '../types';
import { armiesApi } from '../api/armies';
import { actionsApi } from '../api/actions';
import { SUPPLY_FREE_RADIUS, supplyMultiplierForDistance } from '../utils/supply';
import {
  applyPendingToComposition,
  adjustComposition,
  calcArmyUpkeep,
  calcMaxAdd,
  calcUpkeepForComposition,
  subtractTotals,
  MONEY_TROOPS,
  PIETY_RECRUIT_TROOPS,
  UpkeepTotals,
} from '../utils/armyUpkeep';
import { TroopTooltipWrapper } from './TroopTooltip';
import { DisabledHint } from './DisabledHint';

// Light-panel class vocabulary — DESIGN.md's HUD language (Space Grotesk, uppercase tracked
// labels, tight radii, M3 semantic tokens) applied to a light/gray surface instead of the dark
// glass-panel treatment, so this stays readable over the map and matches SelectedProvinceHover.
const PANEL = 'relative w-[480px] max-h-[90vh] flex flex-col overflow-hidden bg-gray-300 text-gray-900 rounded-lg border border-solid border-gray-500/40 shadow-xl';
const SEAM = 'absolute top-0 left-0 h-[1px] w-full bg-gradient-to-r from-transparent via-inverse-primary/70 to-transparent';
const TITLE = 'font-headline text-base tracking-[0.15em] uppercase text-gray-900 truncate';
const SECTION = 'font-headline text-[10px] tracking-widest uppercase text-gray-600';

const CARD = 'bg-gray-100 border border-solid border-gray-500/30 rounded-sm p-2 flex flex-col gap-1';
const CARD_MUTED = 'bg-gray-200/70 border border-solid border-gray-500/25 rounded-sm p-2 flex flex-col gap-1';

const STAT_TILE = 'flex-1 flex flex-col gap-0.5 bg-gray-100 border border-solid border-gray-500/25 rounded-sm px-2 py-1 min-w-0';
const STAT_LABEL = 'font-headline text-[9px] tracking-widest uppercase text-gray-600 truncate';
const STAT_VALUE = 'font-headline text-sm tabular-nums text-gray-900 truncate';

const BTN_BASE = 'bg-transparent border border-solid py-1.5 px-3 font-headline text-[11px] tracking-widest uppercase rounded-sm cursor-pointer transition-all disabled:opacity-40 disabled:cursor-not-allowed';
const BTN_PRIMARY = `${BTN_BASE} border-inverse-primary text-on-primary-fixed hover:bg-inverse-primary/10`;
const BTN_DANGER = `${BTN_BASE} border-error-container/70 text-error-container hover:bg-error-container/10`;
const BTN_NEUTRAL = `${BTN_BASE} border-gray-600/40 text-gray-700 hover:bg-gray-900/5`;

// Square icon buttons (+ / − on a troop row)
const BTN_ICON = 'bg-transparent border border-solid rounded-sm w-6 h-6 leading-none flex items-center justify-center text-xs font-headline cursor-pointer transition-all disabled:opacity-40 disabled:cursor-not-allowed shrink-0';
const BTN_ICON_ADD = `${BTN_ICON} border-inverse-primary/60 text-on-primary-fixed hover:bg-inverse-primary/10`;
const BTN_ICON_REMOVE = `${BTN_ICON} border-error-container/50 text-error-container hover:bg-error-container/10`;

// Pending-action pills (queued recruit/removal on a troop row)
const PILL = 'inline-flex items-center gap-1.5 font-headline text-[10px] tracking-wider uppercase border border-solid rounded-sm px-1.5 py-0.5 tabular-nums';
const PILL_ADD = `${PILL} bg-inverse-primary/10 border-inverse-primary/40 text-on-primary-fixed`;
const PILL_REMOVE = `${PILL} bg-error-container/10 border-error-container/40 text-error-container`;
const PILL_X = 'bg-transparent border-none cursor-pointer leading-none text-[13px] disabled:opacity-40 disabled:cursor-not-allowed';

const TYPE_ROW_BTN = 'w-full text-left font-headline text-[11px] tracking-wide px-2 py-1.5 rounded-sm border border-solid border-gray-500/25 bg-gray-100 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed flex flex-col gap-0.5';

const INPUT_NUM = 'box-border w-16 bg-gray-50 border border-solid border-gray-500/40 rounded-sm px-1.5 py-1 text-xs text-gray-900 tabular-nums focus:outline-none focus:border-inverse-primary';
const RANGE = 'w-full accent-inverse-primary';

// Roster is the only scrolling region — header/projection/stat-strip/footer stay fixed. `min-h-0`
// is required: without it a flex child refuses to shrink below its content and the panel blows
// past max-h-[90vh], pushing the footer below the fold.
const SCROLL = 'flex-1 min-h-0 overflow-y-auto custom-scrollbar flex flex-col gap-2';

interface Props {
  army: Army;
  onClose: () => void;
}

export const ArmyBlock: React.FC<Props> = ({ army, onClose }) => {
  const dispatch = useAppDispatch();
  const user = useAppSelector((state: RootState) => state.user);
  const troopTypes = useAppSelector((state: RootState) => state.armies.troopTypes);
  const armies = useAppSelector((state: RootState) => state.armies.armies);
  const actions = useAppSelector((state: RootState) => state.actions.actions);
  const provinces = useAppSelector((state: RootState) => state.provinces.provinces);
  const otherUsers = useAppSelector((state) => state.otherUsers.otherUsers);
  const myGoods = useAppSelector((state: RootState) => state.goods.mine);
  const goodsById = useMemo(
    () => new Map(myGoods.map((g) => [g.good_id, g])),
    [myGoods],
  );
  const troopTypeByKey = useMemo(
    () => new Map(troopTypes.map((tt) => [tt.key, tt])),
    [troopTypes],
  );

  const [editingName, setEditingName] = useState(false);
  const [nameValue, setNameValue] = useState(army.name ?? '');
  const [addSliderOpen, setAddSliderOpen] = useState<string | null>(null);
  const [removeSliderOpen, setRemoveSliderOpen] = useState<string | null>(null);
  const [addCount, setAddCount] = useState(100);
  const [removeCount, setRemoveCount] = useState(100);
  const [showAddType, setShowAddType] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const upkeep = useMemo(() => calcArmyUpkeep(army), [army]);  // { money, piety, food } — "now" stage
  const totalArmy = useMemo(() => army.units.reduce((s, u) => s + u.count, 0), [army.units]);
  const isOwnerArmy = user.id === army.user_id;
  const armyOwner = useMemo(() => otherUsers.find((u) => u.id === army.user_id), [otherUsers, army.user_id]);

  const currentProvince = useMemo(
    () => provinces.find((p) => p.id === army.province_id),
    [provinces, army.province_id],
  );
  const isAtSea = currentProvince?.type === 'water';

  const userBuildingTypes = useMemo(
    () => new Set(provinces.flatMap((p) => p.buildings?.map((b) => b.type) ?? [])),
    [provinces],
  );

  const hasRecruitBuilding = useMemo(() => {
    const province = provinces.find((p) => p.id === army.province_id);
    return (province?.buildings ?? []).some((b) => b.canRecruit);
  }, [provinces, army.province_id]);

  // Pending actions for this army
  const pendingRecruitByKey = useMemo(() => {
    const map: Record<string, { id: string; count: number }[]> = {};
    for (const a of actions) {
      if (a.actionType !== ActionType.ARMY_RECRUIT) continue;
      if (a.actionData?.army_id !== army.id) continue;
      for (const u of (a.actionData?.units ?? []) as { troop_type_key: string; count: number }[]) {
        if (!map[u.troop_type_key]) map[u.troop_type_key] = [];
        map[u.troop_type_key].push({ id: a.id, count: u.count });
      }
    }
    return map;
  }, [actions, army.id]);

  const pendingEditByKey = useMemo(() => {
    const map: Record<string, { id: string; count: number }[]> = {};
    for (const a of actions) {
      if (a.actionType !== ActionType.ARMY_EDIT) continue;
      if (a.actionData?.army_id !== army.id) continue;
      const key = a.actionData?.troop_type_key as string;
      if (!map[key]) map[key] = [];
      map[key].push({ id: a.id, count: a.actionData?.count });
    }
    return map;
  }, [actions, army.id]);

  // Three-stage upkeep projection: now -> after already-queued recruits/removals -> after
  // whatever add/remove slider is currently open (if any). Every stage recomputes upkeep from a
  // full hypothetical composition — see armyUpkeep.ts's warning about the ceil(count/100) step
  // function, which makes a per-troop delta meaningless.
  const queuedComposition = useMemo(
    () => applyPendingToComposition(army.units, pendingRecruitByKey, pendingEditByKey, troopTypeByKey),
    [army.units, pendingRecruitByKey, pendingEditByKey, troopTypeByKey],
  );
  const preview = addSliderOpen
    ? { key: addSliderOpen, delta: addCount }
    : removeSliderOpen
      ? { key: removeSliderOpen, delta: -removeCount }
      : null;
  const previewComposition = useMemo(
    () => (preview ? adjustComposition(queuedComposition, preview.key, preview.delta, troopTypeByKey) : null),
    [queuedComposition, preview?.key, preview?.delta, troopTypeByKey],
  );
  const upkeepQueued = useMemo(
    () => calcUpkeepForComposition(queuedComposition, army.flat_upkeep, army.supply_distance ?? null),
    [queuedComposition, army.flat_upkeep, army.supply_distance],
  );
  const upkeepPreview = useMemo(
    () => (previewComposition ? calcUpkeepForComposition(previewComposition, army.flat_upkeep, army.supply_distance ?? null) : null),
    [previewComposition, army.flat_upkeep, army.supply_distance],
  );
  const hasQueuedChange = upkeepQueued.money !== upkeep.money || upkeepQueued.piety !== upkeep.piety || upkeepQueued.food !== upkeep.food;
  // What every already-queued ARMY_RECRUIT/ARMY_EDIT for this army adds/removes vs the army as it
  // stands right now — shown as "(+n)" next to the "Queued" column so the effect of recruiting is
  // visible the moment the action is queued, not only while a slider happens to be open.
  const queuedDelta: UpkeepTotals = subtractTotals(upkeepQueued, upkeep);
  // Delta shown for the "PENDING" stage is against the last visible column (QUEUED if shown, else NOW).
  const previewDelta: UpkeepTotals | null = upkeepPreview
    ? subtractTotals(upkeepPreview, hasQueuedChange ? upkeepQueued : upkeep)
    : null;

  // Inline delta-only echo shown inside whichever add/remove slider is open — same previewDelta
  // as the header projection's PENDING column, just deltas (the absolutes already live there).
  const upkeepEcho = previewDelta && preview ? (
    <p className="font-headline text-[10px] tracking-wide text-gray-600">
      Upkeep after this {preview.delta > 0 ? 'recruit' : 'removal'}:{' '}
      {previewDelta.money === 0 && previewDelta.piety === 0 && previewDelta.food === 0 ? (
        <span className="text-gray-500">no change</span>
      ) : (
        <>
          {previewDelta.money !== 0 && (
            <span className={previewDelta.money > 0 ? 'text-error-container' : 'text-green-800'}>⚔ {previewDelta.money > 0 ? '+' : ''}{previewDelta.money}{'  '}</span>
          )}
          {previewDelta.piety !== 0 && (
            <span className={previewDelta.piety > 0 ? 'text-error-container' : 'text-green-800'}>✝ {previewDelta.piety > 0 ? '+' : ''}{previewDelta.piety}{'  '}</span>
          )}
          {previewDelta.food !== 0 && (
            <span className={previewDelta.food > 0 ? 'text-error-container' : 'text-green-800'}>🌾 {previewDelta.food > 0 ? '+' : ''}{previewDelta.food}</span>
          )}
        </>
      )}
    </p>
  ) : null;

  const pendingDisbandAction = useMemo(
    () => actions.find((a) => a.actionType === ActionType.ARMY_DISBAND && a.actionData?.army_id === army.id),
    [actions, army.id],
  );

  // Pending ARMY_MERGE/ARMY_TRANSFER involving this army (see armyLocks.ts — the two action
  // types that mutually lock an army alongside ARMY_MOVE, which already has its own on-map
  // arrow overlay + cancel, so it isn't surfaced again here).
  const pendingMergeOrTransferAction = useMemo(
    () => actions.find((a) => {
      if (a.actionType === ActionType.ARMY_MERGE) {
        return a.actionData?.source_army_id === army.id || a.actionData?.target_army_id === army.id;
      }
      if (a.actionType === ActionType.ARMY_TRANSFER) {
        return a.actionData?.army_a_id === army.id || a.actionData?.army_b_id === army.id;
      }
      return false;
    }),
    [actions, army.id],
  );

  const pendingMergeOrTransferOtherArmyName = useMemo(() => {
    if (!pendingMergeOrTransferAction) return null;
    const data = pendingMergeOrTransferAction.actionData;
    const otherId = pendingMergeOrTransferAction.actionType === ActionType.ARMY_MERGE
      ? (data?.source_army_id === army.id ? data?.target_army_id : data?.source_army_id)
      : (data?.army_a_id === army.id ? data?.army_b_id : data?.army_a_id);
    return armies.find((a) => a.id === otherId)?.name ?? 'Unnamed Army';
  }, [pendingMergeOrTransferAction, armies, army.id]);

  // Shared gate reasons: recruiting into, or disbanding, an army that's about to dissolve into
  // another (merge) or already has a disband queued doesn't make sense — block it with an
  // explanation rather than letting the player queue something self-contradictory.
  const disbandGateReason = pendingDisbandAction
    ? 'This army is queued to disband — cancel the disband first.'
    : null;
  const mergeOrTransferGateReason = pendingMergeOrTransferAction
    ? `This army is queued for a ${pendingMergeOrTransferAction.actionType === ActionType.ARMY_MERGE ? 'merge' : 'transfer'} with ${pendingMergeOrTransferOtherArmyName} — cancel it first.`
    : null;

  // Troop types already in army
  const unitKeys = useMemo(() => new Set(army.units.map((u) => u.troopType.key)), [army.units]);

  // Types not in army yet (available to add) — also exclude those with a pending recruit action
  const addableTypes = useMemo(
    () => troopTypes.filter((tt) => !unitKeys.has(tt.key) && !pendingRecruitByKey[tt.key]),
    [troopTypes, unitKeys, pendingRecruitByKey],
  );

  // Pending recruits for troop types not yet in the army
  const pendingNewTypeRows = useMemo(
    () => Object.entries(pendingRecruitByKey)
      .filter(([key]) => !unitKeys.has(key))
      .map(([key, entries]) => ({ tt: troopTypes.find((t) => t.key === key), entries }))
      .filter((row): row is { tt: TroopType; entries: { id: string; count: number }[] } => !!row.tt),
    [pendingRecruitByKey, unitKeys, troopTypes],
  );

  const getBuildingDisabledReason = useCallback(
    (tt: TroopType): string | null => {
      if (tt.building_requirement && !userBuildingTypes.has(tt.building_requirement)) {
        return `No ${tt.building_requirement.toLowerCase().replace('_', ' ')}`;
      }
      return null;
    },
    [userBuildingTypes],
  );

  const getAffordDisabledReason = useCallback(
    (tt: TroopType, count: number): string | null => {
      if (!count) return 'Amount must be > 0';
      const cost = Math.ceil((count / 100) * tt.cost_per_100);
      if (PIETY_RECRUIT_TROOPS.has(tt.key) && user.piety < cost) return `Not enough piety (need ${cost})`;
      if (MONEY_TROOPS.has(tt.key) && user.money < cost) return `Not enough money (need ${cost})`;
      if (!MONEY_TROOPS.has(tt.key) && !PIETY_RECRUIT_TROOPS.has(tt.key) && user.troops < count)
        return `Not enough troops in pool (have ${user.troops})`;
      if (tt.required_goods && tt.goods_amount) {
        const goodsNeeded = Math.ceil((count / 100) * tt.goods_amount);
        const holding = goodsById.get(tt.required_goods);
        if ((holding?.quantity ?? 0) < goodsNeeded) {
          return `Not enough ${holding?.good.name ?? 'goods'} (need ${goodsNeeded}, have ${holding?.quantity ?? 0})`;
        }
      }
      if (tt.required_goods_2 && tt.goods_amount_2) {
        const goodsNeeded = Math.ceil((count / 100) * tt.goods_amount_2);
        const holding = goodsById.get(tt.required_goods_2);
        if ((holding?.quantity ?? 0) < goodsNeeded) {
          return `Not enough ${holding?.good.name ?? 'goods'} (need ${goodsNeeded}, have ${holding?.quantity ?? 0})`;
        }
      }
      return null;
    },
    [user, goodsById],
  );

  const nameEditDisabledReason = !isOwnerArmy
    ? `This army belongs to ${armyOwner?.countryName ?? 'another player'} — you cannot rename it.`
    : null;

  const getAddButtonDisabledReason = useCallback(
    (tt: TroopType, maxAdd: number): string | null => {
      if (disbandGateReason) return disbandGateReason;
      if (mergeOrTransferGateReason) return mergeOrTransferGateReason;
      if (!hasRecruitBuilding) return 'No recruitment building in this province. Build a Barracks (or another recruiting building) here to recruit.';
      if (maxAdd < 100) return getAffordDisabledReason(tt, 100);
      return null;
    },
    [disbandGateReason, mergeOrTransferGateReason, hasRecruitBuilding, getAffordDisabledReason],
  );

  const getRemoveButtonDisabledReason = useCallback(
    (tt: TroopType, count: number): string | null => {
      if (count <= 0) return `No ${tt.name} in this army to remove.`;
      if (totalArmy <= 100) return 'This army is already at the 100-troop minimum.';
      return null;
    },
    [totalArmy],
  );

  const addTypeButtonDisabledReason = disbandGateReason
    ?? mergeOrTransferGateReason
    ?? (!hasRecruitBuilding ? 'No recruitment building in this province. Build a Barracks (or another recruiting building) here to recruit.' : null)
    ?? (addableTypes.length === 0 ? 'Every troop type available to you is already in this army or has a queued recruit.' : null);

  const disbandButtonDisabledReason = submitting
    ? 'Queuing the previous action — one moment.'
    : (!pendingDisbandAction ? mergeOrTransferGateReason : null);

  const handleSaveName = async () => {
    if (!nameValue.trim()) return;
    try {
      const updated = await armiesApi.updateArmyName(army.id, nameValue.trim());
      dispatch(updateArmy(updated));
      setEditingName(false);
    } catch {
      setError('Failed to update name');
    }
  };

  const handleRecruit = async (troopTypeKey: string, count: number) => {
    setSubmitting(true);
    setError(null);
    try {
      const response = await armiesApi.recruitTroops({ army_id: army.id, units: [{ troop_type_key: troopTypeKey, count }] });
      dispatch(addAction(response));
      setAddSliderOpen(null);
      setShowAddType(false);
    } catch (e: any) {
      setError(e?.response?.data?.message || 'Failed to create recruit action');
    } finally {
      setSubmitting(false);
    }
  };

  const handleRemove = async (troopTypeKey: string, count: number) => {
    if (totalArmy - count < 100) {
      setError('Army size cannot drop below 100 troops');
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const response = await armiesApi.removeTroops({ army_id: army.id, troop_type_key: troopTypeKey, count });
      dispatch(addAction(response));
      setRemoveSliderOpen(null);
    } catch (e: any) {
      setError(e?.response?.data?.message || 'Failed to create remove action');
    } finally {
      setSubmitting(false);
    }
  };

  const handleCancelAction = async (actionId: string) => {
    try {
      await actionsApi.removeAction(actionId);
      dispatch(removeActionById(actionId));
    } catch (e: any) {
      setError(e?.response?.data?.message || 'Failed to cancel action');
    }
  };

  const handleDisband = async () => {
    if (pendingDisbandAction) {
      await handleCancelAction(pendingDisbandAction.id);
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const response = await armiesApi.disbandArmy(army.id);
      dispatch(addAction(response.action));
    } catch (e: any) {
      setError(e?.response?.data?.message || 'Failed to create disband action');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className={PANEL}>
      <div className={SEAM} />

      {/* Fixed top section: header, upkeep projection, stat strip, status banners */}
      <div className="flex flex-col gap-3 pt-4 pb-3">
        {/* Header */}
        <div className="flex items-start justify-between gap-2 px-4">
          <div className="flex-1 min-w-0">
            {editingName ? (
              <div className="flex items-center gap-1">
                <input
                  className="box-border flex-1 min-w-0 bg-gray-50 border border-solid border-gray-500/40 rounded-sm px-2 py-1 text-sm font-headline text-gray-900 tracking-wide focus:outline-none focus:border-inverse-primary"
                  value={nameValue}
                  onChange={(e) => setNameValue(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') void handleSaveName(); if (e.key === 'Escape') setEditingName(false); }}
                  autoFocus
                />
                <button className="bg-transparent border-none text-inverse-primary text-sm px-1 cursor-pointer" onClick={() => void handleSaveName()}>✓</button>
                <button className="bg-transparent border-none text-gray-600 text-sm px-1 cursor-pointer" onClick={() => setEditingName(false)}>✕</button>
              </div>
            ) : (
              <DisabledHint reason={nameEditDisabledReason} hint="Click to edit name" wrapperClassName="w-full">
                <button
                  className={`${TITLE} w-full text-left hover:text-inverse-primary transition-colors disabled:hover:text-gray-900 disabled:cursor-not-allowed`}
                  disabled={!isOwnerArmy}
                  onClick={() => { setNameValue(army.name ?? ''); setEditingName(true); }}
                >
                  {army.name ?? 'Unnamed Army'}
                </button>
              </DisabledHint>
            )}
            {!isOwnerArmy && (
              <div className={`${SECTION} mt-0.5`}>Owned by {armyOwner?.countryName ?? 'Unknown'}</div>
            )}
          </div>
          <button
            className="bg-transparent border-none text-gray-600 hover:text-gray-900 transition-colors cursor-pointer p-0.5"
            onClick={onClose}
          >
            <span className="material-symbols-outlined text-xl leading-none">close</span>
          </button>
        </div>

        {/* Upkeep projection — three stages: now / after already-queued recruits+removals / after
            whatever add/remove slider is currently open. Never shows a per-troop delta: the ceil()
            step in the cost formula means upkeep is a step function, not a rate — see armyUpkeep.ts. */}
        {isOwnerArmy && (
          <div className="mx-4 bg-gray-100 border border-solid border-gray-500/30 rounded-sm px-3 py-2 flex flex-col gap-1.5">
            <Tooltip title="Upkeep is charged at the start of each turn, before queued actions resolve — a recruit queued now first costs upkeep the following turn. Food scales with distance from supply.">
              <div className={`${SECTION} w-fit`}>Upkeep / turn</div>
            </Tooltip>
            <div
              className="grid gap-x-3 gap-y-1 items-baseline"
              style={{ gridTemplateColumns: `auto repeat(${1 + (hasQueuedChange ? 1 : 0) + (upkeepPreview ? 1 : 0)}, minmax(2.5rem, auto))` }}
            >
              <span />
              <span className={SECTION} style={{ textAlign: 'right' }}>Now</span>
              {hasQueuedChange && <span className={SECTION} style={{ textAlign: 'right' }}>Queued</span>}
              {upkeepPreview && <span className="font-headline text-[9px] tracking-widest uppercase text-on-primary-fixed text-right">Pending</span>}

              {(() => {
                const rows: { icon: string; label: string; now: number; queued: number; queuedDelta: number; preview: number | null; delta: number | null }[] = [
                  { icon: '⚔', label: 'Money', now: upkeep.money, queued: upkeepQueued.money, queuedDelta: queuedDelta.money, preview: upkeepPreview?.money ?? null, delta: previewDelta?.money ?? null },
                ];
                if (upkeep.piety > 0 || upkeepQueued.piety > 0 || (upkeepPreview?.piety ?? 0) > 0) {
                  rows.push({ icon: '✝', label: 'Piety', now: upkeep.piety, queued: upkeepQueued.piety, queuedDelta: queuedDelta.piety, preview: upkeepPreview?.piety ?? null, delta: previewDelta?.piety ?? null });
                }
                if (upkeep.food > 0 || upkeepQueued.food > 0 || (upkeepPreview?.food ?? 0) > 0) {
                  rows.push({ icon: '🌾', label: 'Food', now: upkeep.food, queued: upkeepQueued.food, queuedDelta: queuedDelta.food, preview: upkeepPreview?.food ?? null, delta: previewDelta?.food ?? null });
                }
                return rows.map((row) => (
                  <React.Fragment key={row.label}>
                    <span className="font-headline text-xs text-gray-700">{row.icon} {row.label}</span>
                    <span className="font-headline text-xs tabular-nums text-gray-800 text-right">{row.now}</span>
                    {hasQueuedChange && (
                      <span className="font-headline text-xs tabular-nums text-gray-800 text-right">
                        {row.queued}
                        {row.queuedDelta !== 0 && (
                          <span className={row.queuedDelta > 0 ? 'text-error-container' : 'text-green-800'}> ({row.queuedDelta > 0 ? '+' : ''}{row.queuedDelta})</span>
                        )}
                      </span>
                    )}
                    {upkeepPreview && (
                      <span className="font-headline text-xs tabular-nums text-on-primary-fixed font-bold text-right">
                        {row.preview}
                        {row.delta !== null && row.delta !== 0 && (
                          <span className={row.delta > 0 ? 'text-error-container' : 'text-green-800'}> ({row.delta > 0 ? '+' : ''}{row.delta})</span>
                        )}
                      </span>
                    )}
                  </React.Fragment>
                ));
              })()}
            </div>
          </div>
        )}

        {/* Stat strip — troop total, distinct types, supply range (if paying food), water countdown */}
        <div className="flex flex-wrap gap-2 px-4">
          <Tooltip title="Total troops across every unit type in this army.">
            <div className={STAT_TILE}>
              <span className={STAT_LABEL}>Troops</span>
              <span className={STAT_VALUE}>{totalArmy.toLocaleString()}</span>
            </div>
          </Tooltip>
          <Tooltip title="Number of distinct troop types in this army.">
            <div className={STAT_TILE}>
              <span className={STAT_LABEL}>Types</span>
              <span className={STAT_VALUE}>{army.units.length}</span>
            </div>
          </Tooltip>
          {isOwnerArmy && upkeep.food > 0 && (() => {
            const distance = army.supply_distance;
            const multiplier = supplyMultiplierForDistance(distance ?? null);
            const unsupplied = distance === null || distance > SUPPLY_FREE_RADIUS;
            return (
              <Tooltip title="Armies more than 4 tiles from a Fort, Castle, or Capital pay extra food upkeep, scaling with distance. Unfed armies lose troops to attrition each turn.">
                <div className={`${STAT_TILE} ${unsupplied ? 'border-error-container/50' : 'border-inverse-primary/40'}`}>
                  <span className={STAT_LABEL}>Supply</span>
                  <span className={`${STAT_VALUE} ${unsupplied ? 'text-error-container' : 'text-on-primary-fixed'}`}>
                    {distance === null ? 'unreachable' : `${distance} tile${distance === 1 ? '' : 's'}`} ×{multiplier.toFixed(2)}
                  </span>
                </div>
              </Tooltip>
            );
          })()}
          {isAtSea && (
            <Tooltip title="Armies lost at sea after too many turns on water (base 6 turns; some techs extend this). Return to land to reset the counter.">
              <div className={STAT_TILE}>
                <span className={STAT_LABEL}>At sea</span>
                <span className={STAT_VALUE}>{army.water_turns} turn{army.water_turns === 1 ? '' : 's'}</span>
              </div>
            </Tooltip>
          )}
        </div>

        {/* Disband indicator */}
        {isOwnerArmy && pendingDisbandAction && (
          <div className="mx-4 flex items-center justify-between gap-2 bg-error-container/10 border border-solid border-error-container/40 rounded-sm px-2 py-1.5">
            <span className="font-headline text-[11px] tracking-widest uppercase text-error-container">⏳ Disbanding queued</span>
            <button className="bg-transparent border-none text-error-container underline text-xs cursor-pointer" onClick={() => void handleCancelAction(pendingDisbandAction.id)}>Cancel</button>
          </div>
        )}

        {/* Merge/transfer indicator — while pending, this army can't be queued to move
            (and vice versa: it can't be re-queued into another merge/transfer either). */}
        {isOwnerArmy && pendingMergeOrTransferAction && (
          <div className="mx-4 flex items-center justify-between gap-2 bg-secondary-container/10 border border-solid border-secondary-container/40 rounded-sm px-2 py-1.5">
            <span className="font-headline text-[11px] tracking-widest uppercase text-secondary-container">
              ⏳ {pendingMergeOrTransferAction.actionType === ActionType.ARMY_MERGE ? 'Merge' : 'Transfer'} queued with {pendingMergeOrTransferOtherArmyName}
            </span>
            <button className="bg-transparent border-none text-secondary-container underline text-xs cursor-pointer" onClick={() => void handleCancelAction(pendingMergeOrTransferAction.id)}>Cancel</button>
          </div>
        )}
      </div>

      {/* Scrolling roster: troop-type rows, pending new-type rows, add-type picker, new-type slider */}
      <div className={`${SCROLL} px-4`}>
        <div className="flex flex-col gap-1.5">
          {army.units.map((unit) => {
            const tt = unit.troopType;
            const recruits = pendingRecruitByKey[tt.key] ?? [];
            const removals = pendingEditByKey[tt.key] ?? [];
            const isAddOpen = addSliderOpen === tt.key;
            const isRemoveOpen = removeSliderOpen === tt.key;
            const goodHolding = tt.required_goods ? goodsById.get(tt.required_goods) : undefined;
            const goodHolding2 = tt.required_goods_2 ? goodsById.get(tt.required_goods_2) : undefined;
            const maxAdd = calcMaxAdd(tt, user.troops, user.money, user.piety, goodHolding?.quantity ?? 0, goodHolding2?.quantity ?? 0);
            const maxRemove = unit.count;
            const addReason = getAddButtonDisabledReason(tt, maxAdd);
            const removeReason = getRemoveButtonDisabledReason(tt, unit.count);

            return (
              <div key={unit.id} className={CARD}>
                <TroopTooltipWrapper troopType={tt} goodName={goodHolding?.good.name} supplyGoodName2={tt.supply_good_2_id ? goodsById.get(tt.supply_good_2_id)?.good.name : undefined}>
                  <div className="flex items-center gap-2 cursor-default">
                    <span className="flex-1 font-medium text-sm truncate text-gray-900">{tt.name}</span>
                    <span className="font-headline text-sm tabular-nums text-gray-900">{unit.count.toLocaleString()}</span>
                    {isOwnerArmy && !isAddOpen && !isRemoveOpen && (
                      <div className="flex gap-1">
                        <DisabledHint reason={addReason} hint={`Recruit more ${tt.name}`}>
                          <button
                            className={BTN_ICON_ADD}
                            disabled={!!addReason}
                            onClick={() => { setAddCount(Math.min(100, maxAdd)); setAddSliderOpen(tt.key); setRemoveSliderOpen(null); }}
                          >+</button>
                        </DisabledHint>
                        <DisabledHint reason={removeReason} hint={`Remove ${tt.name} from this army`}>
                          <button
                            className={BTN_ICON_REMOVE}
                            disabled={!!removeReason}
                            onClick={() => { setRemoveCount(Math.min(100, unit.count)); setRemoveSliderOpen(tt.key); setAddSliderOpen(null); }}
                          >−</button>
                        </DisabledHint>
                      </div>
                    )}
                  </div>
                </TroopTooltipWrapper>

                {/* Pending actions — inline wrapping chips */}
                {(recruits.length > 0 || removals.length > 0) && isOwnerArmy && (
                  <div className="flex flex-wrap gap-1">
                    {recruits.map((r) => (
                      <span key={r.id} className={PILL_ADD}>
                        +{r.count}
                        <button className={PILL_X} onClick={() => void handleCancelAction(r.id)} title="Cancel queued recruit">×</button>
                      </span>
                    ))}
                    {removals.map((r) => (
                      <span key={r.id} className={PILL_REMOVE}>
                        -{r.count}
                        <button className={PILL_X} onClick={() => void handleCancelAction(r.id)} title="Cancel queued removal">×</button>
                      </span>
                    ))}
                  </div>
                )}

                {/* Add inline slider */}
                {isOwnerArmy && isAddOpen && (
                  <div className="flex flex-col gap-1.5 pt-1.5 mt-1 border-t border-solid border-gray-500/20">
                    <div className="flex items-center gap-2">
                      <input
                        type="range"
                        className={RANGE}
                        value={addCount}
                        onChange={(e) => setAddCount(Number(e.target.value))}
                        min={100}
                        max={Math.max(100, maxAdd)}
                        step={10}
                      />
                      <input
                        type="number"
                        className={INPUT_NUM}
                        value={addCount}
                        min={100}
                        max={Math.max(100, maxAdd)}
                        step={10}
                        onChange={(e) => setAddCount(Math.max(100, Math.min(Math.max(100, maxAdd), Number(e.target.value))))}
                      />
                    </div>
                    {upkeepEcho}
                    {getAffordDisabledReason(tt, addCount) && (
                      <p className="font-headline text-[10px] tracking-wide text-error-container">{getAffordDisabledReason(tt, addCount)}</p>
                    )}
                    <div className="flex gap-1.5">
                      <DisabledHint
                        wrapperClassName="flex-1"
                        reason={submitting ? 'Queuing the previous action — one moment.' : getAffordDisabledReason(tt, addCount)}
                      >
                        <button
                          className={`${BTN_PRIMARY} w-full`}
                          disabled={submitting || !!getAffordDisabledReason(tt, addCount)}
                          onClick={() => void handleRecruit(tt.key, addCount)}
                        >
                          Confirm
                        </button>
                      </DisabledHint>
                      <button className={`${BTN_NEUTRAL} flex-1`} onClick={() => setAddSliderOpen(null)}>Cancel</button>
                    </div>
                  </div>
                )}

                {/* Remove inline slider */}
                {isOwnerArmy && isRemoveOpen && (
                  <div className="flex flex-col gap-1.5 pt-1.5 mt-1 border-t border-solid border-gray-500/20">
                    <div className="flex items-center gap-2">
                      <input
                        type="range"
                        className={RANGE}
                        value={removeCount}
                        onChange={(e) => setRemoveCount(Number(e.target.value))}
                        min={10}
                        max={maxRemove}
                        step={10}
                      />
                      <input
                        type="number"
                        className={INPUT_NUM}
                        value={removeCount}
                        min={10}
                        max={maxRemove}
                        step={10}
                        onChange={(e) => setRemoveCount(Math.max(10, Math.min(maxRemove, Number(e.target.value))))}
                      />
                    </div>
                    {upkeepEcho}
                    {totalArmy - removeCount < 100 && (
                      <p className="font-headline text-[10px] tracking-wide text-error-container">Army cannot drop below 100 troops (would be {totalArmy - removeCount})</p>
                    )}
                    <div className="flex gap-1.5">
                      <DisabledHint
                        wrapperClassName="flex-1"
                        reason={submitting
                          ? 'Queuing the previous action — one moment.'
                          : (totalArmy - removeCount < 100 ? `An army cannot drop below 100 troops (this would leave ${totalArmy - removeCount}). Disband it instead.` : null)}
                      >
                        <button
                          className={`${BTN_DANGER} w-full`}
                          disabled={submitting || totalArmy - removeCount < 100}
                          onClick={() => void handleRemove(tt.key, removeCount)}
                        >
                          Confirm
                        </button>
                      </DisabledHint>
                      <button className={`${BTN_NEUTRAL} flex-1`} onClick={() => setRemoveSliderOpen(null)}>Cancel</button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Pending new troop types (not yet in army) */}
        {pendingNewTypeRows.length > 0 && (
          <div className="flex flex-col gap-1.5">
            {pendingNewTypeRows.map(({ tt, entries }) => (
              <div key={tt.key} className={CARD_MUTED}>
                <TroopTooltipWrapper troopType={tt} goodName={tt.required_goods ? goodsById.get(tt.required_goods)?.good.name : undefined} supplyGoodName2={tt.supply_good_2_id ? goodsById.get(tt.supply_good_2_id)?.good.name : undefined}>
                  <div className="flex items-center gap-2 cursor-default">
                    <span className="flex-1 font-medium text-sm truncate text-gray-500 italic">{tt.name}</span>
                    <span className="font-headline text-sm tabular-nums text-gray-400">0</span>
                  </div>
                </TroopTooltipWrapper>
                <div className="flex flex-wrap gap-1">
                  {entries.map((r) => (
                    <span key={r.id} className={PILL_ADD}>
                      +{r.count}
                      <button className={PILL_X} onClick={() => void handleCancelAction(r.id)} title="Cancel queued recruit">×</button>
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Add troop type section */}
        {showAddType && (
          <div className="flex flex-col gap-1.5">
            <div className={SECTION}>Select troop type to recruit</div>
            {addableTypes.length === 0 && (
              <p className="text-xs text-gray-600">All available types already in army</p>
            )}
            <div className="grid grid-cols-2 gap-1.5">
              {addableTypes.map((tt) => {
                const buildingReason = getBuildingDisabledReason(tt);
                const disabled = !!buildingReason;
                // Affordability is a non-blocking note here — the row stays clickable so the slider
                // can still open (the slider's own Confirm button is what actually blocks on cost).
                const affordNote = !disabled ? getAffordDisabledReason(tt, 100) : null;
                const tooltipText = buildingReason ?? (affordNote ? `Selectable, but: ${affordNote}` : '');
                return (
                  <TroopTooltipWrapper key={tt.key} troopType={tt} goodName={tt.required_goods ? goodsById.get(tt.required_goods)?.good.name : undefined} supplyGoodName2={tt.supply_good_2_id ? goodsById.get(tt.supply_good_2_id)?.good.name : undefined}>
                    <Tooltip title={tooltipText} placement="top" disableHoverListener={!tooltipText}>
                      <span>
                        <button
                          className={TYPE_ROW_BTN}
                          disabled={disabled}
                          onClick={() => { setAddSliderOpen(tt.key); setShowAddType(false); setAddCount(100); }}
                        >
                          <span className="truncate">{tt.name}</span>
                          {buildingReason && <span className="text-error-container text-[10px] normal-case tracking-normal">{buildingReason}</span>}
                        </button>
                      </span>
                    </Tooltip>
                  </TroopTooltipWrapper>
                );
              })}
            </div>
            <button className="bg-transparent border-none text-xs text-gray-600 mt-1 underline cursor-pointer self-start" onClick={() => setShowAddType(false)}>Cancel</button>
          </div>
        )}

        {/* Add troop type slider if selected from addable types (when key is not already in units) */}
        {addSliderOpen && !unitKeys.has(addSliderOpen) && (() => {
          const tt = troopTypes.find((t) => t.key === addSliderOpen);
          if (!tt) return null;
          const goodHolding = tt.required_goods ? goodsById.get(tt.required_goods) : undefined;
          const goodHolding2 = tt.required_goods_2 ? goodsById.get(tt.required_goods_2) : undefined;
          const maxAdd = calcMaxAdd(tt, user.troops, user.money, user.piety, goodHolding?.quantity ?? 0, goodHolding2?.quantity ?? 0);
          return (
            <div className={CARD_MUTED}>
              <div className="font-headline text-sm text-gray-900">{tt.name}</div>
              <div className="flex items-center gap-2">
                <input
                  type="range"
                  className={RANGE}
                  value={addCount}
                  onChange={(e) => setAddCount(Number(e.target.value))}
                  min={100}
                  max={Math.max(100, maxAdd)}
                  step={10}
                />
                <input
                  type="number"
                  className={INPUT_NUM}
                  value={addCount}
                  min={100}
                  max={Math.max(100, maxAdd)}
                  step={10}
                  onChange={(e) => setAddCount(Math.max(100, Math.min(Math.max(100, maxAdd), Number(e.target.value))))}
                />
              </div>
              {upkeepEcho}
              {getAffordDisabledReason(tt, addCount) && (
                <p className="font-headline text-[10px] tracking-wide text-error-container">{getAffordDisabledReason(tt, addCount)}</p>
              )}
              <div className="flex gap-1.5">
                <DisabledHint
                  wrapperClassName="flex-1"
                  reason={submitting ? 'Queuing the previous action — one moment.' : getAffordDisabledReason(tt, addCount)}
                >
                  <button
                    className={`${BTN_PRIMARY} w-full`}
                    disabled={submitting || !!getAffordDisabledReason(tt, addCount)}
                    onClick={() => void handleRecruit(tt.key, addCount)}
                  >
                    Confirm
                  </button>
                </DisabledHint>
                <button className={`${BTN_NEUTRAL} flex-1`} onClick={() => setAddSliderOpen(null)}>Cancel</button>
              </div>
            </div>
          );
        })()}
      </div>

      {/* Fixed footer */}
      <div className="flex flex-col gap-2 px-4 pt-3 pb-4 border-t border-solid border-gray-500/30">
        {isOwnerArmy && !showAddType && (
          <DisabledHint reason={addTypeButtonDisabledReason} hint="Recruit a troop type not yet in this army" wrapperClassName="w-full">
            <button
              className={`${BTN_PRIMARY} w-full`}
              disabled={!!addTypeButtonDisabledReason}
              onClick={() => { setShowAddType(true); setAddSliderOpen(null); }}
            >
              + Add troop type
            </button>
          </DisabledHint>
        )}
        {isOwnerArmy && (
          <DisabledHint
            reason={disbandButtonDisabledReason}
            hint={pendingDisbandAction ? 'Removes the queued disband action.' : "Queues this army's disbandment for the next turn. Its troops are lost."}
            wrapperClassName="w-full"
          >
            <button
              className={`${pendingDisbandAction ? BTN_NEUTRAL : BTN_DANGER} w-full`}
              disabled={!!disbandButtonDisabledReason}
              onClick={() => void handleDisband()}
            >
              {pendingDisbandAction ? '⏳ Cancel Disband' : 'Disband Army'}
            </button>
          </DisabledHint>
        )}

        {error && (
          <div className="font-headline text-[11px] tracking-wide text-error-container bg-error-container/10 border border-solid border-error-container/30 rounded-sm px-2 py-1.5">
            {error}
          </div>
        )}
      </div>
    </div>
  );
};
