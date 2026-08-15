import React, { useEffect, useMemo, useState } from 'react';
import { Dialog } from '@mui/material';
import { useAppDispatch, useAppSelector } from '../store/hooks';
import { addAction, removeActionById } from '../store/slices/actionsSlice';
import type { RootState } from '../store/store';
import { armiesApi } from '../api/armies';
import { actionsApi } from '../api/actions';
import { ARMY_LOCK_LABELS, getArmyLocks } from '../utils/armyLocks';
import { ActionButton } from './ActionButton';

/** Mirrors the backend's ARMY_MIN_SIZE (combat-calculator.ts) — neither army may end below this. */
const ARMY_MIN_SIZE = 100;

type Mode = 'transfer' | 'merge';

interface TypeRow {
  key: string;
  name: string;
  startA: number;
  startB: number;
}

interface Props {
  open: boolean;
  onClose: () => void;
  provinceId: string;
}

const selectClass =
  'box-border w-full bg-surface-container-lowest border border-solid border-outline-variant/20 rounded-sm px-2 py-1.5 text-xs text-white font-headline tracking-wider focus:outline-none focus:border-primary/50';

export const ManageArmiesModal: React.FC<Props> = ({ open, onClose, provinceId }) => {
  const dispatch = useAppDispatch();
  const userId = useAppSelector((state: RootState) => state.user.id);
  const armies = useAppSelector((state: RootState) => state.armies.armies);
  const actions = useAppSelector((state: RootState) => state.actions.actions);

  const armyLocks = useMemo(() => getArmyLocks(actions), [actions]);

  const armiesOwnedHere = useMemo(
    () => armies.filter((a) => a.province_id === provinceId && a.user_id === userId),
    [armies, provinceId, userId],
  );

  const lockedArmiesHere = useMemo(
    () => armiesOwnedHere.filter((a) => armyLocks.has(a.id)),
    [armiesOwnedHere, armyLocks],
  );

  const selectableArmies = useMemo(
    () =>
      armiesOwnedHere
        .filter((a) => !armyLocks.has(a.id))
        .sort((a, b) => (a.name ?? '').localeCompare(b.name ?? '')),
    [armiesOwnedHere, armyLocks],
  );

  const [mode, setMode] = useState<Mode>('transfer');
  const [cancellingLockId, setCancellingLockId] = useState<string | null>(null);
  const [armyAId, setArmyAId] = useState(selectableArmies[0]?.id ?? '');
  const [armyBId, setArmyBId] = useState(
    selectableArmies.find((a) => a.id !== selectableArmies[0]?.id)?.id ?? '',
  );
  const [mergeSourceIsA, setMergeSourceIsA] = useState(true);
  const [workingA, setWorkingA] = useState<Record<string, number>>({});
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const armyA = useMemo(() => selectableArmies.find((a) => a.id === armyAId), [selectableArmies, armyAId]);
  const armyB = useMemo(() => selectableArmies.find((a) => a.id === armyBId), [selectableArmies, armyBId]);

  const otherArmyOptions = useMemo(
    () => selectableArmies.filter((a) => a.id !== armyAId),
    [selectableArmies, armyAId],
  );

  // Keep A/B distinct if A changes onto B's current value.
  useEffect(() => {
    if (armyBId && armyBId === armyAId) {
      setArmyBId(selectableArmies.find((a) => a.id !== armyAId)?.id ?? '');
    }
  }, [armyAId, armyBId, selectableArmies]);

  const typeRows: TypeRow[] = useMemo(() => {
    if (!armyA || !armyB) return [];
    const map = new Map<string, TypeRow>();
    for (const u of armyA.units) {
      map.set(u.troopType.key, { key: u.troopType.key, name: u.troopType.name, startA: u.count, startB: 0 });
    }
    for (const u of armyB.units) {
      const existing = map.get(u.troopType.key);
      if (existing) existing.startB = u.count;
      else map.set(u.troopType.key, { key: u.troopType.key, name: u.troopType.name, startA: 0, startB: u.count });
    }
    return Array.from(map.values());
  }, [armyA, armyB]);

  // Reset the working transfer split whenever the selected pair changes.
  useEffect(() => {
    const initial: Record<string, number> = {};
    for (const row of typeRows) initial[row.key] = row.startA;
    setWorkingA(initial);
    setMergeSourceIsA(true);
    setError(null);
  }, [armyAId, armyBId]);

  const newTotalA = typeRows.reduce((sum, row) => sum + (workingA[row.key] ?? row.startA), 0);
  const newTotalB = typeRows.reduce((sum, row) => sum + (row.startA + row.startB - (workingA[row.key] ?? row.startA)), 0);
  const hasChanges = typeRows.some((row) => (workingA[row.key] ?? row.startA) !== row.startA);
  const canSubmitTransfer = hasChanges && newTotalA >= ARMY_MIN_SIZE && newTotalB >= ARMY_MIN_SIZE && !submitting;

  const handleTransfer = async () => {
    if (!armyA || !armyB) return;
    const transfers: { troop_type_key: string; from_army_id: string; to_army_id: string; count: number }[] = [];
    for (const row of typeRows) {
      const newA = workingA[row.key] ?? row.startA;
      const delta = newA - row.startA;
      if (delta > 0) transfers.push({ troop_type_key: row.key, from_army_id: armyB.id, to_army_id: armyA.id, count: delta });
      else if (delta < 0) transfers.push({ troop_type_key: row.key, from_army_id: armyA.id, to_army_id: armyB.id, count: -delta });
    }
    if (!transfers.length) {
      setError('No changes to transfer');
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const response = await armiesApi.transferTroops({ army_a_id: armyA.id, army_b_id: armyB.id, transfers });
      dispatch(addAction(response));
      onClose();
    } catch (e: any) {
      setError(e?.response?.data?.message || 'Failed to queue transfer');
    } finally {
      setSubmitting(false);
    }
  };

  const handleMerge = async () => {
    if (!armyA || !armyB) return;
    const sourceId = mergeSourceIsA ? armyA.id : armyB.id;
    const targetId = mergeSourceIsA ? armyB.id : armyA.id;
    setSubmitting(true);
    setError(null);
    try {
      const response = await armiesApi.mergeArmies({ source_army_id: sourceId, target_army_id: targetId });
      dispatch(addAction(response));
      onClose();
    } catch (e: any) {
      setError(e?.response?.data?.message || 'Failed to queue merge');
    } finally {
      setSubmitting(false);
    }
  };

  const dissolvingArmy = mergeSourceIsA ? armyA : armyB;
  const absorbingArmy = mergeSourceIsA ? armyB : armyA;

  const handleCancelLock = async (actionId: string) => {
    setCancellingLockId(actionId);
    try {
      await actionsApi.removeAction(actionId);
      dispatch(removeActionById(actionId));
    } catch (e: any) {
      setError(e?.response?.data?.message || 'Failed to cancel action');
    } finally {
      setCancellingLockId(null);
    }
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="sm"
      fullWidth
      disablePortal
      slotProps={{
        paper: {
          className: '!bg-surface-container !text-on-surface !shadow-2xl !rounded-sm !overflow-hidden',
        },
      }}
    >
      <div className="relative">
        <div className="absolute top-0 left-0 h-[1px] w-full bg-gradient-to-r from-transparent via-primary/40 to-transparent" />

        <button
          onClick={onClose}
          aria-label="Close"
          className="bg-transparent border-none absolute top-4 right-4 z-10 p-1 text-on-surface-variant hover:text-primary transition-colors cursor-pointer"
        >
          <span className="material-symbols-outlined text-2xl">close</span>
        </button>

        <div className="p-6 flex flex-col gap-5">
          <h1 className="font-headline text-xl tracking-[0.2em] uppercase text-primary pr-8">
            Manage Armies
          </h1>

          {lockedArmiesHere.length > 0 && (
            <div className="flex flex-col gap-1">
              <h2 className="font-headline text-[10px] tracking-widest uppercase text-on-surface-variant">
                Pending army actions
              </h2>
              {lockedArmiesHere.map((a) => {
                const lock = armyLocks.get(a.id)!;
                return (
                  <div
                    key={a.id}
                    className="flex items-center justify-between gap-2 text-xs bg-surface-container-lowest/50 border border-solid border-outline-variant/10 rounded-sm px-2 py-1.5"
                  >
                    <span className="text-on-surface-variant truncate">
                      <span className="text-white font-medium">{a.name ?? 'Unnamed Army'}</span>
                      {' '}— {ARMY_LOCK_LABELS[lock.kind]} queued
                    </span>
                    <button
                      type="button"
                      disabled={cancellingLockId === lock.actionId}
                      onClick={() => void handleCancelLock(lock.actionId)}
                      className="bg-transparent border-none text-primary underline text-xs cursor-pointer disabled:opacity-40 shrink-0"
                    >
                      {cancellingLockId === lock.actionId ? 'Cancelling…' : 'Cancel'}
                    </button>
                  </div>
                );
              })}
            </div>
          )}

          {selectableArmies.length < 2 ? (
            <p className="font-headline text-xs tracking-wide text-on-surface-variant">
              {armiesOwnedHere.length < 2
                ? 'You need at least two armies of your own in this province.'
                : 'Resolve the pending action(s) above to select these armies.'}
            </p>
          ) : (
            <>
              {/* Mode toggle */}
              <div className="flex border border-solid border-outline-variant/20 rounded-sm overflow-hidden w-fit">
                {(['transfer', 'merge'] as Mode[]).map((m) => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => setMode(m)}
                    className={`bg-transparent border-none px-4 py-1.5 font-headline text-[11px] tracking-widest uppercase cursor-pointer transition-colors ${
                      mode === m ? 'bg-primary/20 text-primary' : 'text-on-surface-variant hover:text-white'
                    }`}
                  >
                    {m === 'transfer' ? 'Transfer' : 'Merge'}
                  </button>
                ))}
              </div>

              {/* Army selects */}
              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col gap-1">
                  <label className="font-headline text-[10px] tracking-widest uppercase text-on-surface-variant">Army A</label>
                  <select className={selectClass} value={armyAId} onChange={(e) => setArmyAId(e.target.value)}>
                    {selectableArmies.map((a) => (
                      <option key={a.id} className="bg-surface-container-lowest" value={a.id}>
                        {a.name ?? 'Unnamed Army'}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="flex flex-col gap-1">
                  <label className="font-headline text-[10px] tracking-widest uppercase text-on-surface-variant">Army B</label>
                  <select className={selectClass} value={armyBId} onChange={(e) => setArmyBId(e.target.value)}>
                    {otherArmyOptions.map((a) => (
                      <option key={a.id} className="bg-surface-container-lowest" value={a.id}>
                        {a.name ?? 'Unnamed Army'}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {armyA && armyB && mode === 'transfer' && (
                <div className="flex flex-col gap-3">
                  <div className="flex justify-between font-headline text-[11px] tracking-widest uppercase">
                    <span className={newTotalA < ARMY_MIN_SIZE ? 'text-error' : 'text-on-surface-variant'}>
                      {armyA.name ?? 'Army A'}: {newTotalA}
                    </span>
                    <span className={newTotalB < ARMY_MIN_SIZE ? 'text-error' : 'text-on-surface-variant'}>
                      {armyB.name ?? 'Army B'}: {newTotalB}
                    </span>
                  </div>

                  <div className="flex flex-col gap-3 max-h-[40vh] overflow-y-auto pr-1 custom-scrollbar">
                    {typeRows.map((row) => {
                      const total = row.startA + row.startB;
                      const value = workingA[row.key] ?? row.startA;
                      return (
                        <div key={row.key} className="bg-surface-container-lowest/50 border border-solid border-outline-variant/10 rounded-sm p-2 flex flex-col gap-1">
                          <div className="flex justify-between text-xs">
                            <span className="font-medium">{row.name}</span>
                            <span className="tabular-nums text-on-surface-variant">
                              {value} / {total - value}
                            </span>
                          </div>
                          <input
                            type="range"
                            min={0}
                            max={total}
                            step={1}
                            value={value}
                            disabled={total === 0}
                            onChange={(e) => setWorkingA((prev) => ({ ...prev, [row.key]: Number(e.target.value) }))}
                            className="w-full accent-primary"
                          />
                        </div>
                      );
                    })}
                    {typeRows.length === 0 && (
                      <p className="text-xs text-on-surface-variant">Neither army has any troops.</p>
                    )}
                  </div>

                  {(newTotalA < ARMY_MIN_SIZE || newTotalB < ARMY_MIN_SIZE) && (
                    <p className="font-headline text-xs tracking-wide text-error">
                      Both armies must retain at least {ARMY_MIN_SIZE} troops.
                    </p>
                  )}
                </div>
              )}

              {armyA && armyB && mode === 'merge' && (
                <div className="flex flex-col gap-3">
                  <div className="flex items-center justify-center gap-3 font-headline text-xs tracking-widest uppercase">
                    <span className="text-error">{dissolvingArmy?.name ?? 'Unnamed Army'}</span>
                    <span className="text-on-surface-variant">dissolves into</span>
                    <span className="text-primary">{absorbingArmy?.name ?? 'Unnamed Army'}</span>
                    <button
                      type="button"
                      onClick={() => setMergeSourceIsA((prev) => !prev)}
                      aria-label="Swap merge direction"
                      className="bg-transparent border-none p-1 text-on-surface-variant hover:text-primary transition-colors cursor-pointer"
                    >
                      <span className="material-symbols-outlined text-lg">swap_horiz</span>
                    </button>
                  </div>
                  <p className="text-xs text-on-surface-variant">
                    {dissolvingArmy?.name ?? 'This army'} will be permanently disbanded; all of its troops join {absorbingArmy?.name ?? 'the other army'}.
                  </p>
                </div>
              )}

              {error && (
                <p className="font-headline text-xs tracking-wide text-error border border-solid border-error/30 bg-error/10 rounded-sm px-3 py-2">
                  {error}
                </p>
              )}

              <div className="flex gap-2 justify-end">
                <ActionButton
                  label="Cancel"
                  colorClass="border-outline-variant/40 text-on-surface-variant hover:bg-white/5"
                  onClick={onClose}
                />
                {mode === 'transfer' ? (
                  <ActionButton
                    label={submitting ? 'Queuing…' : 'Queue Transfer'}
                    colorClass="border-primary text-primary hover:bg-primary/10"
                    disabled={!canSubmitTransfer}
                    onClick={() => void handleTransfer()}
                  />
                ) : (
                  <ActionButton
                    label={submitting ? 'Queuing…' : 'Queue Merge'}
                    colorClass="border-primary text-primary hover:bg-primary/10"
                    disabled={submitting || !armyA || !armyB}
                    onClick={() => void handleMerge()}
                  />
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </Dialog>
  );
};
