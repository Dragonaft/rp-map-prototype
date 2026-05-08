import React, { useCallback, useMemo, useState } from 'react';
import { Box, Button, Slider, Tooltip, Typography } from '@mui/material';
import { useAppDispatch, useAppSelector } from '../store/hooks';
import { addAction, removeActionById } from '../store/slices/actionsSlice';
import { updateArmy } from '../store/slices/armiesSlice';
import type { RootState } from '../store/store';
import { ActionType, Army, TroopType } from '../types';
import { armiesApi } from '../api/armies';
import { actionsApi } from '../api/actions';

const PIETY_TROOPS = new Set(['paladins']);
const MONEY_TROOPS = new Set(['mercenaries']);

function calcArmyUpkeep(army: Army): { money: number; piety: number } {
  let money = army.flat_upkeep;
  let piety = 0;
  for (const unit of army.units) {
    const cost = Math.ceil(Math.max(0, unit.count) / 100) * unit.troopType.upkeep_per_100;
    if (PIETY_TROOPS.has(unit.troopType.key)) {
      piety += cost;
    } else {
      money += cost;
    }
  }
  return { money, piety };
}

const calcMaxAdd = (troopType: TroopType, userTroops: number, userMoney: number, userPiety: number): number => {
  if (MONEY_TROOPS.has(troopType.key)) {
    if (!troopType.cost_per_100) return 0;
    return Math.floor(userMoney * 10 / troopType.cost_per_100) * 10;
  }
  if (PIETY_TROOPS.has(troopType.key)) {
    if (!troopType.cost_per_100) return userTroops;
    return Math.floor(userPiety * 10 / troopType.cost_per_100) * 10;
  }
  return userTroops;
}

interface TroopTooltipProps {
  troopType: TroopType;
  children: React.ReactElement;
}

const TroopTooltipContent: React.FC<{ troopType: TroopType }> = ({ troopType }) => (
  <div className="text-xs">
    <div className="font-bold mb-1">{troopType.name}</div>
    {troopType.description && <div className="mb-1 text-gray-300">{troopType.description}</div>}
    <div>Category: {troopType.category}</div>
    <div>Attack: {troopType.attack}</div>
    <div>Defense: {troopType.defense}</div>
    <div>
      Cost/100: {troopType.cost_per_100 > 0 ? `${troopType.cost_per_100} ${
        PIETY_TROOPS.has(troopType.key) ? 'piety' : MONEY_TROOPS.has(troopType.key) ? 'gold' : 'gold'
      }` : 'Free'}
    </div>
    <div>Upkeep/100: {troopType.upkeep_per_100}</div>
  </div>
);

const TroopTooltipWrapper: React.FC<TroopTooltipProps> = ({ troopType, children }) => (
  <Tooltip
    title={<TroopTooltipContent troopType={troopType} />}
    placement="left"
    arrow
  >
    {children}
  </Tooltip>
);

interface Props {
  army: Army;
  onClose: () => void;
}

export const ArmyBlock: React.FC<Props> = ({ army, onClose }) => {
  const dispatch = useAppDispatch();
  const user = useAppSelector((state: RootState) => state.user);
  const troopTypes = useAppSelector((state: RootState) => state.armies.troopTypes);
  const actions = useAppSelector((state: RootState) => state.actions.actions);
  const provinces = useAppSelector((state: RootState) => state.provinces.provinces);

  const [editingName, setEditingName] = useState(false);
  const [nameValue, setNameValue] = useState(army.name ?? '');
  const [addSliderOpen, setAddSliderOpen] = useState<string | null>(null);
  const [removeSliderOpen, setRemoveSliderOpen] = useState<string | null>(null);
  const [addCount, setAddCount] = useState(100);
  const [removeCount, setRemoveCount] = useState(100);
  const [showAddType, setShowAddType] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const upkeep = useMemo(() => calcArmyUpkeep(army), [army]);  // { money, piety }
  const totalArmy = useMemo(() => army.units.reduce((s, u) => s + u.count, 0), [army.units]);

  const userBuildingTypes = useMemo(
    () => new Set(provinces.flatMap((p) => p.buildings?.map((b) => b.type) ?? [])),
    [provinces],
  );

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

  const pendingDisbandAction = useMemo(
    () => actions.find((a) => a.actionType === ActionType.ARMY_DISBAND && a.actionData?.army_id === army.id),
    [actions, army.id],
  );

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
      if (PIETY_TROOPS.has(tt.key) && user.piety < cost) return `Not enough piety (need ${cost})`;
      if (MONEY_TROOPS.has(tt.key) && user.money < cost) return `Not enough money (need ${cost})`;
      if (!MONEY_TROOPS.has(tt.key) && !PIETY_TROOPS.has(tt.key) && user.troops < count)
        return `Not enough troops in pool (have ${user.troops})`;
      return null;
    },
    [user],
  );

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
    <div className="w-80 bg-gray-400 rounded-lg border border-outline-variant/10 p-4 flex flex-col gap-3 overflow-y-auto max-h-[90vh]">
      {/* Header: name + upkeep */}
      <div className="flex items-center gap-2">
        {editingName ? (
          <div className="flex items-center gap-1 flex-1">
            <input
              className="flex-1 text-sm font-bold bg-gray-200 rounded px-2 py-1 border border-gray-500"
              value={nameValue}
              onChange={(e) => setNameValue(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') void handleSaveName(); if (e.key === 'Escape') setEditingName(false); }}
              autoFocus
            />
            <button className="text-xs px-2 py-1 bg-blue-500 text-white rounded" onClick={() => void handleSaveName()}>✓</button>
            <button className="text-xs px-2 py-1 bg-gray-500 text-white rounded" onClick={() => setEditingName(false)}>✕</button>
          </div>
        ) : (
          <button
            className="flex-1 text-left font-bold text-sm truncate hover:underline"
            onClick={() => { setNameValue(army.name ?? ''); setEditingName(true); }}
            title="Click to edit name"
          >
            {army.name ?? 'Unnamed Army'}
          </button>
        )}
        <div className="flex flex-col items-end text-xs text-gray-700 whitespace-nowrap">
          <span>⚔ {upkeep.money}g/turn</span>
          {upkeep.piety > 0 && <span>✝ {upkeep.piety}p/turn</span>}
        </div>
        <button className="text-gray-600 hover:text-gray-900 text-lg leading-none ml-1" onClick={onClose}>✕</button>
      </div>

      {/* Disband indicator */}
      {pendingDisbandAction && (
        <div className="text-xs bg-red-100 border border-red-400 rounded px-2 py-1 flex justify-between items-center">
          <span className="text-red-700 font-semibold">⏳ Disbanding queued</span>
          <button className="text-red-600 underline text-xs" onClick={() => void handleCancelAction(pendingDisbandAction.id)}>Cancel</button>
        </div>
      )}

      {/* Troop type rows */}
      <div className="flex flex-col gap-1">
        {army.units.map((unit) => {
          const tt = unit.troopType;
          const recruits = pendingRecruitByKey[tt.key] ?? [];
          const removals = pendingEditByKey[tt.key] ?? [];
          const isAddOpen = addSliderOpen === tt.key;
          const isRemoveOpen = removeSliderOpen === tt.key;
          const maxAdd = calcMaxAdd(tt, user.troops, user.money, user.piety);
          const maxRemove = unit.count;

          return (
            <div key={unit.id} className="bg-gray-200 rounded p-2 text-sm">
              <TroopTooltipWrapper troopType={tt}>
                <div className="flex items-center gap-1 cursor-default">
                  <span className="flex-1 font-medium truncate">{tt.name}</span>
                  <span className="font-bold tabular-nums">{unit.count}</span>
                </div>
              </TroopTooltipWrapper>

              {/* Pending actions */}
              {recruits.map((r) => (
                <div key={r.id} className="flex items-center gap-1 mt-1 text-xs bg-green-100 border border-green-400 rounded px-1 py-0.5">
                  <span className="text-green-700 flex-1">+{r.count} queued</span>
                  <button className="text-green-700 underline" onClick={() => void handleCancelAction(r.id)}>Cancel</button>
                </div>
              ))}
              {removals.map((r) => (
                <div key={r.id} className="flex items-center gap-1 mt-1 text-xs bg-red-100 border border-red-400 rounded px-1 py-0.5">
                  <span className="text-red-700 flex-1">-{r.count} queued</span>
                  <button className="text-red-700 underline" onClick={() => void handleCancelAction(r.id)}>Cancel</button>
                </div>
              ))}

              {/* Add inline slider */}
              {isAddOpen && (
                <div className="mt-2 flex flex-col gap-1">
                  <div className="flex items-center gap-1">
                    <span className="text-xs w-8">Add:</span>
                    <Box sx={{ flex: 1, px: 1 }}>
                      <Slider
                        value={addCount}
                        onChange={(_e, v) => setAddCount(v as number)}
                        min={100}
                        max={Math.max(100, maxAdd)}
                        step={10}
                        size="small"
                        valueLabelDisplay="auto"
                      />
                    </Box>
                    <input
                      type="number"
                      className="w-16 text-xs border rounded px-1 py-0.5"
                      value={addCount}
                      min={100}
                      max={Math.max(100, maxAdd)}
                      step={10}
                      onChange={(e) => setAddCount(Math.max(100, Math.min(Math.max(100, maxAdd), Number(e.target.value))))}
                    />
                  </div>
                  {getAffordDisabledReason(tt, addCount) && (
                    <p className="text-xs text-red-600">{getAffordDisabledReason(tt, addCount)}</p>
                  )}
                  <div className="flex gap-1">
                    <button
                      className="flex-1 text-xs bg-green-500 text-white rounded py-0.5 disabled:opacity-50"
                      disabled={submitting || !!getAffordDisabledReason(tt, addCount)}
                      onClick={() => void handleRecruit(tt.key, addCount)}
                    >
                      Confirm
                    </button>
                    <button className="flex-1 text-xs bg-gray-400 text-white rounded py-0.5" onClick={() => setAddSliderOpen(null)}>Cancel</button>
                  </div>
                </div>
              )}

              {/* Remove inline slider */}
              {isRemoveOpen && (
                <div className="mt-2 flex flex-col gap-1">
                  <div className="flex items-center gap-1">
                    <span className="text-xs w-8">Rem:</span>
                    <Box sx={{ flex: 1, px: 1 }}>
                      <Slider
                        value={removeCount}
                        onChange={(_e, v) => setRemoveCount(v as number)}
                        min={10}
                        max={maxRemove}
                        step={10}
                        size="small"
                        valueLabelDisplay="auto"
                      />
                    </Box>
                    <input
                      type="number"
                      className="w-16 text-xs border rounded px-1 py-0.5"
                      value={removeCount}
                      min={10}
                      max={maxRemove}
                      step={10}
                      onChange={(e) => setRemoveCount(Math.max(10, Math.min(maxRemove, Number(e.target.value))))}
                    />
                  </div>
                  {totalArmy - removeCount < 100 && (
                    <p className="text-xs text-red-600">Army cannot drop below 100 troops (would be {totalArmy - removeCount})</p>
                  )}
                  <div className="flex gap-1">
                    <button
                      className="flex-1 text-xs bg-red-500 text-white rounded py-0.5 disabled:opacity-50"
                      disabled={submitting || totalArmy - removeCount < 100}
                      onClick={() => void handleRemove(tt.key, removeCount)}
                    >
                      Confirm
                    </button>
                    <button className="flex-1 text-xs bg-gray-400 text-white rounded py-0.5" onClick={() => setRemoveSliderOpen(null)}>Cancel</button>
                  </div>
                </div>
              )}

              {/* Add / Remove buttons */}
              {!isAddOpen && !isRemoveOpen && (
                <div className="flex gap-1 mt-1">
                  <button
                    className="text-xs px-2 py-0.5 bg-green-500 text-white rounded disabled:opacity-40"
                    disabled={maxAdd < 100}
                    title={maxAdd < 100 ? 'Not enough resources' : 'Add troops'}
                    onClick={() => { setAddCount(Math.min(100, maxAdd)); setAddSliderOpen(tt.key); setRemoveSliderOpen(null); }}
                  >+</button>
                  <button
                    className="text-xs px-2 py-0.5 bg-red-500 text-white rounded disabled:opacity-40"
                    disabled={unit.count <= 0}
                    title="Remove troops"
                    onClick={() => { setRemoveCount(Math.min(100, unit.count)); setRemoveSliderOpen(tt.key); setAddSliderOpen(null); }}
                  >−</button>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Pending new troop types (not yet in army) */}
      {pendingNewTypeRows.map(({ tt, entries }) => (
        <div key={tt.key} className="bg-gray-200 rounded p-2 text-sm">
          <TroopTooltipWrapper troopType={tt}>
            <div className="flex items-center gap-1 cursor-default">
              <span className="flex-1 font-medium truncate text-gray-500 italic">{tt.name}</span>
              <span className="font-bold tabular-nums text-gray-400">0</span>
            </div>
          </TroopTooltipWrapper>
          {entries.map((r) => (
            <div key={r.id} className="flex items-center gap-1 mt-1 text-xs bg-green-100 border border-green-400 rounded px-1 py-0.5">
              <span className="text-green-700 flex-1">+{r.count} queued</span>
              <button className="text-green-700 underline" onClick={() => void handleCancelAction(r.id)}>Cancel</button>
            </div>
          ))}
        </div>
      ))}

      {/* Add troop type section */}
      {showAddType ? (
        <div className="flex flex-col gap-1">
          <div className="text-xs font-semibold text-gray-700 mb-1">Select troop type to recruit:</div>
          {addableTypes.length === 0 && (
            <p className="text-xs text-gray-500">All available types already in army</p>
          )}
          {addableTypes.map((tt) => {
            const buildingReason = getBuildingDisabledReason(tt);
            const disabled = !!buildingReason;
            return (
              <TroopTooltipWrapper key={tt.key} troopType={tt}>
                <Tooltip title={buildingReason ?? ''} placement="left" disableHoverListener={!disabled}>
                  <span>
                    <button
                      className="w-full text-left text-xs px-2 py-1 rounded bg-gray-200 hover:bg-gray-300 disabled:opacity-50 disabled:cursor-not-allowed flex justify-between"
                      disabled={disabled}
                      onClick={() => { setAddSliderOpen(tt.key); setShowAddType(false); setAddCount(100); }}
                    >
                      <span>{tt.name}</span>
                      {buildingReason && <span className="text-orange-600 text-xs">{buildingReason}</span>}
                    </button>
                  </span>
                </Tooltip>
              </TroopTooltipWrapper>
            );
          })}
          <button className="text-xs text-gray-600 mt-1 underline" onClick={() => setShowAddType(false)}>Cancel</button>
        </div>
      ) : null}

      {/* Add troop type slider if selected from addable types (when key is not already in units) */}
      {addSliderOpen && !unitKeys.has(addSliderOpen) && (() => {
        const tt = troopTypes.find((t) => t.key === addSliderOpen);
        if (!tt) return null;
        const maxAdd = calcMaxAdd(tt, user.troops, user.money, user.piety);
        return (
          <div className="flex flex-col gap-1 bg-gray-200 rounded p-2">
            <div className="text-xs font-semibold">{tt.name}</div>
            <div className="flex items-center gap-1">
              <Box sx={{ flex: 1, px: 1 }}>
                <Slider value={addCount} onChange={(_e, v) => setAddCount(v as number)}
                  min={100} max={Math.max(100, maxAdd)} step={10} size="small" valueLabelDisplay="auto" />
              </Box>
              <input type="number" className="w-16 text-xs border rounded px-1 py-0.5"
                value={addCount} min={100} max={Math.max(100, maxAdd)} step={10}
                onChange={(e) => setAddCount(Math.max(100, Math.min(Math.max(100, maxAdd), Number(e.target.value))))} />
            </div>
            {getAffordDisabledReason(tt, addCount) && (
              <p className="text-xs text-red-600">{getAffordDisabledReason(tt, addCount)}</p>
            )}
            <div className="flex gap-1">
              <button className="flex-1 text-xs bg-green-500 text-white rounded py-0.5 disabled:opacity-50"
                disabled={submitting || !!getAffordDisabledReason(tt, addCount)}
                onClick={() => void handleRecruit(tt.key, addCount)}>Confirm</button>
              <button className="flex-1 text-xs bg-gray-400 text-white rounded py-0.5"
                onClick={() => setAddSliderOpen(null)}>Cancel</button>
            </div>
          </div>
        );
      })()}

      {/* Bottom buttons */}
      <div className="flex flex-col gap-2 mt-auto pt-2 border-t border-gray-500">
        {!showAddType && addableTypes.length > 0 && (
          <Button variant="outlined" size="small" onClick={() => { setShowAddType(true); setAddSliderOpen(null); }}>
            + Add troop type
          </Button>
        )}
        <Button
          variant="contained"
          size="small"
          color={pendingDisbandAction ? 'inherit' : 'error'}
          disabled={submitting}
          onClick={() => void handleDisband()}
        >
          {pendingDisbandAction ? '⏳ Cancel Disband' : 'Disband Army'}
        </Button>
      </div>

      {error && (
        <Typography variant="caption" color="error">{error}</Typography>
      )}
    </div>
  );
};
