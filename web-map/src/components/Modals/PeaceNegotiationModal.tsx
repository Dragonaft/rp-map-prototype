import React, { useMemo, useState } from 'react';
import { Dialog } from '@mui/material';
import { useAppSelector } from '../../store/hooks';
import { diplomacyApi } from '../../api/diplomacy';
import { PeaceScope, Province, TreatyArticle, TreatyKind, TreatyVisibility } from '../../types';
import { ActionButton } from '../ActionButton.tsx';
import { GameIcon } from '../GameIcon.tsx';

interface Props {
  open: boolean;
  onClose: () => void;
  targetId: string;
  targetName: string;
  onProposed: () => void;
}

type TributeRow = { id: string; kind: 'money' | 'resource'; direction: 'demand' | 'offer'; resourceKey?: string; amount: number };

const INPUT_CLASS = 'box-border w-full bg-surface-container-lowest border border-solid border-outline-variant/20 rounded-sm px-3 py-2 text-sm text-white font-headline tracking-wider focus:outline-none focus:border-primary/50 transition-all placeholder:text-on-surface-variant/40';

/** Fixed semantic map colors — this mini-map communicates province *status*, not each country's own chosen color. */
const MAP_COLOR_MINE = '#16a34a';
const MAP_COLOR_ALLY = '#3b82f6';
const MAP_COLOR_AVAILABLE = '#ef4444';
const MAP_COLOR_UNAVAILABLE = '#7f1d1d';
const MAP_COLOR_SELECTED = '#81ecff';

/**
 * EU4-style peace proposal: pick which of the opponent's provinces to demand
 * (contiguity-restricted, like painting a border on the map) plus optional
 * money/resource tribute. Leader peace can demand any of the target's
 * provinces; a separate peace with a non-leader enemy ally is restricted to
 * provinces of theirs that you currently occupy.
 */
export const PeaceNegotiationModal: React.FC<Props> = ({ open, onClose, targetId, targetName, onProposed }) => {
  const currentUserId = useAppSelector((state) => state.user.id);
  const wars = useAppSelector((state) => state.diplomacy.wars);
  const provinces = useAppSelector((state) => state.provinces.provinces);
  const provinceBBoxById = useAppSelector((state) => state.provinces.provinceBBoxById);
  const otherUsers = useAppSelector((state) => state.otherUsers.otherUsers);
  const resources = useAppSelector((state) => state.resources.resources);

  const [name, setName] = useState('');
  const [visibility, setVisibility] = useState<TreatyVisibility>(TreatyVisibility.PRIVATE);
  const [selectedProvinceIds, setSelectedProvinceIds] = useState<Set<string>>(new Set());
  const [rows, setRows] = useState<TributeRow[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const nameFor = (userId: string): string => {
    if (userId === currentUserId) return 'You';
    return otherUsers.find((u) => u.id === userId)?.countryName ?? 'Unknown';
  };

  const war = useMemo(() => {
    return wars.find((w) => {
      if (w.status !== 'active') return false;
      const mine = w.participants.find((p) => p.user_id === currentUserId);
      const theirs = w.participants.find((p) => p.user_id === targetId);
      return !!mine && !!theirs && mine.side !== theirs.side;
    }) ?? null;
  }, [wars, currentUserId, targetId]);

  const scope = useMemo<PeaceScope | null>(() => {
    if (!war) return null;
    const mine = war.participants.find((p) => p.user_id === currentUserId)!;
    const theirs = war.participants.find((p) => p.user_id === targetId)!;
    if (mine.is_leader && theirs.is_leader) return PeaceScope.LEADER;
    if (mine.is_leader && !theirs.is_leader) return PeaceScope.SEPARATE;
    if (!mine.is_leader && theirs.is_leader) return PeaceScope.LEADER; // proposing to your own war's opposing leader
    return null;
  }, [war, currentUserId, targetId]);

  /** Everyone fighting on my side of this war, excluding me — rendered blue on the map. */
  const allyIds = useMemo(() => {
    const mySide = war?.participants.find((p) => p.user_id === currentUserId)?.side;
    if (!mySide) return new Set<string>();
    return new Set(
      war!.participants.filter((p) => p.side === mySide && p.user_id !== currentUserId).map((p) => p.user_id),
    );
  }, [war, currentUserId]);

  /** Everyone fighting on the opposing side, including the target — rendered red/dark-red on the map. */
  const enemyIds = useMemo(() => {
    const theirSide = war?.participants.find((p) => p.user_id === targetId)?.side;
    if (!theirSide) return new Set<string>();
    return new Set(war!.participants.filter((p) => p.side === theirSide).map((p) => p.user_id));
  }, [war, targetId]);

  const eligibleProvinces = useMemo(() => {
    if (scope === PeaceScope.SEPARATE) {
      return provinces.filter((p) => p.userId === targetId && p.occupierId === currentUserId);
    }
    if (scope === PeaceScope.LEADER) {
      return provinces.filter((p) => p.userId === targetId);
    }
    return [];
  }, [provinces, scope, targetId, currentUserId]);
  const eligibleProvinceIds = useMemo(() => new Set(eligibleProvinces.map((p) => p.id)), [eligibleProvinces]);

  const myOwnedIds = useMemo(
    () => new Set(provinces.filter((p) => p.userId === currentUserId).map((p) => p.id)),
    [provinces, currentUserId],
  );

  /** A demanded province is only paintable if it touches my territory or another already-selected province (EU4 contiguity). */
  const isConnected = (province: Province, selected: Set<string>): boolean => {
    return (province.neighbors ?? []).some((n) => myOwnedIds.has(n) || selected.has(n));
  };

  /**
   * Drops any selected province that no longer chains back to my own territory —
   * same fixed-point walk the API re-runs on submit (see treaty.service.ts
   * `isContiguous`), applied here too so deselecting a "stepping stone" province
   * can never leave an orphaned, non-contiguous demand silently selected.
   */
  const pruneDisconnected = (ids: Set<string>): Set<string> => {
    const provinceById = new Map(eligibleProvinces.map((p) => [p.id, p]));
    const connected = new Set(myOwnedIds);
    const pending = new Set(ids);
    let changed = true;
    while (changed) {
      changed = false;
      for (const id of Array.from(pending)) {
        const province = provinceById.get(id);
        if (province && (province.neighbors ?? []).some((n) => connected.has(n))) {
          connected.add(id);
          pending.delete(id);
          changed = true;
        }
      }
    }
    return new Set(Array.from(ids).filter((id) => !pending.has(id)));
  };

  /** Every province belonging to me, my war-side allies, or the enemy side — the full extent of the mini-map. */
  const mapProvinces = useMemo(
    () => provinces.filter((p) => p.userId && (p.userId === currentUserId || allyIds.has(p.userId) || enemyIds.has(p.userId))),
    [provinces, currentUserId, allyIds, enemyIds],
  );

  const viewBox = useMemo(() => {
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const p of mapProvinces) {
      const bbox = provinceBBoxById[p.id];
      if (!bbox) continue;
      minX = Math.min(minX, bbox.x);
      minY = Math.min(minY, bbox.y);
      maxX = Math.max(maxX, bbox.x + bbox.width);
      maxY = Math.max(maxY, bbox.y + bbox.height);
    }
    if (!isFinite(minX)) return '0 0 100 100';
    const pad = Math.max(20, (maxX - minX) * 0.05);
    return `${minX - pad} ${minY - pad} ${(maxX - minX) + pad * 2} ${(maxY - minY) + pad * 2}`;
  }, [mapProvinces, provinceBBoxById]);

  const toggleProvince = (id: string) => {
    setSelectedProvinceIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      // Deselecting a stepping-stone province can orphan others further down
      // the chain — prune anything that's no longer contiguous as a result.
      return pruneDisconnected(next);
    });
  };

  const addRow = (direction: 'demand' | 'offer') => setRows((r) => [...r, { id: `${Date.now()}-${r.length}`, kind: 'money', direction, amount: 0 }]);
  const updateRow = (id: string, patch: Partial<TributeRow>) => setRows((r) => r.map((row) => (row.id === id ? { ...row, ...patch } : row)));
  const removeRow = (id: string) => setRows((r) => r.filter((row) => row.id !== id));
  const demandRows = useMemo(() => rows.filter((r) => r.direction === 'demand'), [rows]);
  const offerRows = useMemo(() => rows.filter((r) => r.direction === 'offer'), [rows]);

  const buildArticles = (): TreatyArticle[] => {
    const articles: TreatyArticle[] = [];
    for (const id of selectedProvinceIds) {
      articles.push({ type: 'cede_province', provinceId: id, from: targetId, to: currentUserId });
    }
    for (const row of rows) {
      if (row.amount <= 0) continue;
      const from = row.direction === 'demand' ? targetId : currentUserId;
      const to = row.direction === 'demand' ? currentUserId : targetId;
      if (row.kind === 'money') articles.push({ type: 'money_tribute', amount: row.amount, from, to });
      else articles.push({ type: 'resource_tribute', resourceKey: row.resourceKey ?? '', amount: row.amount, from, to });
    }
    return articles;
  };

  const handleClose = () => {
    setName(''); setVisibility(TreatyVisibility.PRIVATE); setSelectedProvinceIds(new Set());
    setRows([]); setError(null);
    onClose();
  };

  const handleSubmit = async () => {
    if (!scope) { setError('No active war found with this player'); return; }
    if (!name.trim()) { setError('Name is required'); return; }

    setSaving(true);
    setError(null);
    try {
      await diplomacyApi.propose({
        name: name.trim(),
        receiverId: targetId,
        kind: TreatyKind.PEACE,
        peaceScope: scope,
        visibility,
        articles: buildArticles(),
      });
      onProposed();
      handleClose();
    } catch (e: any) {
      setError(e?.response?.data?.message || 'Failed to propose peace');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog
      open={open}
      onClose={handleClose}
      maxWidth="md"
      fullWidth
      disablePortal
      slotProps={{
        paper: {
          className: '!bg-surface-container !text-on-surface !shadow-2xl !rounded-sm !max-w-3xl !overflow-hidden',
        },
      }}
    >
      <div className="relative">
        <div className="absolute top-0 left-0 h-[1px] w-full bg-gradient-to-r from-transparent via-primary/40 to-transparent" />

        <div className="max-h-[85vh] overflow-y-auto custom-scrollbar">
          <div className="p-6 flex flex-col gap-6">
            {/* Header */}
            <div className="flex justify-between items-start gap-4">
              <div className="flex flex-col gap-1 min-w-0">
                <h1 className="font-headline text-2xl tracking-[0.2em] uppercase glow-text-primary text-primary flex items-center gap-3 flex-wrap">
                  INITIATE_PEACE_ACCORD
                  <span className="text-[10px] bg-primary/10 text-primary px-2 py-0.5 border border-solid border-primary/30 tracking-normal leading-none rounded-sm">
                    UPLINK_SECURE
                  </span>
                </h1>
                <p className="font-headline text-[10px] tracking-widest text-on-surface-variant uppercase truncate">
                  Target_entity: {targetName}
                </p>
              </div>
              <button
                onClick={handleClose}
                aria-label="Close"
                disabled={saving}
                className="bg-transparent border-none shrink-0 p-1 text-on-surface-variant hover:text-primary transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <span className="material-symbols-outlined text-2xl">close</span>
              </button>
            </div>

            {!scope && (
              <div className="flex items-start gap-2 border border-dashed border-error/60 rounded-sm px-3 py-2 bg-error/5">
                <span className="material-symbols-outlined text-error text-base shrink-0">warning</span>
                <p className="font-headline text-[10px] tracking-wide text-on-surface-variant leading-relaxed uppercase">
                  No active war with this player was found.
                </p>
              </div>
            )}
            {scope === PeaceScope.SEPARATE && (
              <p className="font-headline text-xs text-on-surface-variant leading-relaxed bg-surface-container-low/40 border border-solid border-outline-variant/10 p-4">
                {targetName} is not a war leader — this is a <span className="text-secondary">separate peace</span>. You may
                only demand provinces of theirs that you currently occupy; they will leave the war and break their
                alliance with their leader.
              </p>
            )}

            {error && (
              <p className="font-headline text-xs tracking-wide text-error border border-solid border-error/30 bg-error/10 rounded-sm px-3 py-2">
                {error}
              </p>
            )}

            {/* Treaty name */}
            <div className="flex flex-col gap-1.5">
              <label className="font-headline text-[10px] tracking-widest text-primary uppercase">Treaty_name</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="ENTER_TREATY_NAME..."
                className={INPUT_CLASS}
              />
            </div>

            {/* Province map */}
            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <label className="font-headline text-[10px] tracking-widest text-primary uppercase">
                  Demand_provinces ({selectedProvinceIds.size} selected)
                </label>
                <div className="flex items-center gap-4 flex-wrap">
                  <Legend color={MAP_COLOR_MINE} label="Your provinces" />
                  <Legend color={MAP_COLOR_ALLY} label="Allied provinces" />
                  <Legend color={MAP_COLOR_AVAILABLE} label="Available" />
                  <Legend color={MAP_COLOR_UNAVAILABLE} label="Unavailable" />
                </div>
              </div>

              {mapProvinces.length === 0 ? (
                <div className="font-headline text-xs uppercase tracking-widest text-on-surface-variant text-center py-8 border border-solid border-outline-variant/20 rounded-sm bg-black">
                  No provinces to display.
                </div>
              ) : (
                <svg
                  viewBox={viewBox}
                  preserveAspectRatio="xMidYMid meet"
                  className="w-full h-72 bg-black border border-solid border-outline-variant/20 rounded-sm"
                >
                  {mapProvinces.map((p) => {
                    const isMine = p.userId === currentUserId;
                    const isAlly = !!p.userId && allyIds.has(p.userId);
                    const isSelected = selectedProvinceIds.has(p.id);
                    const isEligibleTarget = p.userId === targetId && eligibleProvinceIds.has(p.id);
                    const connected = isEligibleTarget && (isSelected || isConnected(p, selectedProvinceIds));
                    const clickable = isEligibleTarget && connected;

                    let fill = MAP_COLOR_UNAVAILABLE;
                    if (isMine) fill = MAP_COLOR_MINE;
                    else if (isAlly) fill = MAP_COLOR_ALLY;
                    else if (connected) fill = MAP_COLOR_AVAILABLE;
                    if (isSelected) fill = MAP_COLOR_SELECTED;

                    return (
                      <path
                        key={p.id}
                        d={p.polygon}
                        fill={fill}
                        stroke="#0e0e0e"
                        strokeWidth={isSelected ? 2 : 1}
                        className={clickable ? 'cursor-pointer hover:opacity-80 transition-opacity' : 'cursor-not-allowed'}
                        onClick={clickable ? () => toggleProvince(p.id) : undefined}
                      >
                        <title>
                          {p.regionId} ({p.landscape}) — {nameFor(p.userId!)}
                          {p.occupierId === currentUserId ? ' — occupied by you' : ''}
                          {isEligibleTarget && !connected ? ' — not contiguous' : ''}
                        </title>
                      </path>
                    );
                  })}
                </svg>
              )}
              {scope === PeaceScope.SEPARATE && eligibleProvinces.length === 0 && (
                <p className="font-headline text-[10px] uppercase tracking-widest text-on-surface-variant">
                  You do not currently occupy any of their provinces.
                </p>
              )}
            </div>

            {/* Tribute */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-px bg-outline-variant/20 border border-solid border-outline-variant/20">
              <TributeColumn
                label="Additional_demands"
                accent="primary"
                rows={demandRows}
                resources={resources}
                onAdd={() => addRow('demand')}
                onUpdate={updateRow}
                onRemove={removeRow}
              />
              <TributeColumn
                label="Additional_offers"
                accent="secondary"
                rows={offerRows}
                resources={resources}
                onAdd={() => addRow('offer')}
                onUpdate={updateRow}
                onRemove={removeRow}
              />
            </div>

            {/* Footer */}
            <div className="flex flex-wrap justify-between items-center gap-4 pt-4">
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={visibility === TreatyVisibility.PUBLIC}
                  onChange={(e) => setVisibility(e.target.checked ? TreatyVisibility.PUBLIC : TreatyVisibility.PRIVATE)}
                  className="w-4 h-4 accent-primary cursor-pointer"
                />
                <span className="flex flex-col">
                  <span className="font-headline text-[10px] tracking-widest text-on-surface-variant uppercase">Public_visibility</span>
                  <span className="text-[10px] text-on-surface-variant/60">Any player can view this via "Player Treaties"</span>
                </span>
              </label>
              <div className="flex gap-3">
                <ActionButton
                  label="Cancel"
                  colorClass="border-outline-variant/40 text-on-surface-variant hover:bg-white/5"
                  disabled={saving}
                  onClick={handleClose}
                />
                <button
                  type="button"
                  onClick={() => void handleSubmit()}
                  disabled={saving || !scope}
                  className="bg-gradient-to-r from-primary to-primary-dim px-8 py-2.5 rounded-sm font-headline font-bold text-on-primary-fixed uppercase tracking-widest text-xs glow-primary hover:opacity-90 active:scale-[0.98] transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {saving ? 'Sending…' : 'Send_peace_proposal'}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </Dialog>
  );
};

const Legend: React.FC<{ color: string; label: string }> = ({ color, label }) => (
  <div className="flex items-center gap-1.5">
    <span className="w-2.5 h-2.5 rounded-full inline-block shrink-0" style={{ backgroundColor: color }} />
    <span className="font-headline text-[9px] tracking-widest text-on-surface-variant uppercase">{label}</span>
  </div>
);

interface TributeColumnProps {
  label: string;
  accent: 'primary' | 'secondary';
  rows: TributeRow[];
  resources: { key: string; name: string }[];
  onAdd: () => void;
  onUpdate: (id: string, patch: Partial<TributeRow>) => void;
  onRemove: (id: string) => void;
}

const TributeColumn: React.FC<TributeColumnProps> = ({ label, accent, rows, resources, onAdd, onUpdate, onRemove }) => {
  const barClass = accent === 'primary' ? 'bg-primary' : 'bg-secondary';
  const textClass = accent === 'primary' ? 'text-primary' : 'text-secondary';
  const addHoverClass = accent === 'primary' ? 'hover:border-primary/50 hover:text-primary' : 'hover:border-secondary/50 hover:text-secondary';

  return (
    <div className="bg-surface-container p-4 flex flex-col gap-4">
      <h3 className={`font-headline text-xs tracking-[0.2em] uppercase flex items-center gap-2 ${textClass}`}>
        <span className={`w-1 h-3 ${barClass}`} /> {label}
      </h3>
      <div className="flex flex-col gap-2">
        {rows.map((row) => (
          <TributeRowView key={row.id} row={row} resources={resources} onUpdate={onUpdate} onRemove={onRemove} />
        ))}
        <button
          type="button"
          onClick={onAdd}
          className={`bg-transparent border border-dashed border-outline-variant/40 py-2 font-headline text-[10px] tracking-widest text-on-surface-variant transition-all rounded-sm cursor-pointer ${addHoverClass}`}
        >
          + Add_money_or_resource
        </button>
      </div>
    </div>
  );
};

const TributeRowView: React.FC<{
  row: TributeRow;
  resources: { key: string; name: string }[];
  onUpdate: (id: string, patch: Partial<TributeRow>) => void;
  onRemove: (id: string) => void;
}> = ({ row, resources, onUpdate, onRemove }) => {
  return (
    <div className="bg-surface-container-lowest/50 border border-solid border-outline-variant/10 p-2 flex flex-col gap-2">
      <div className="flex items-center gap-2">
        <span className="text-xl shrink-0 inline-flex items-center">
          {row.kind === 'money' ? '💰' : <GameIcon kind="resource" iconKey={row.resourceKey ?? ''} className="w-5 h-5" />}
        </span>
        <select
          value={row.kind}
          onChange={(e) => onUpdate(row.id, { kind: e.target.value as TributeRow['kind'], resourceKey: undefined })}
          className="bg-transparent border-none text-[11px] font-headline tracking-widest uppercase text-white focus:outline-none cursor-pointer flex-1"
        >
          <option className="bg-surface-container-lowest" value="money">Money</option>
          <option className="bg-surface-container-lowest" value="resource">Resource</option>
        </select>
        <button
          type="button"
          onClick={() => onRemove(row.id)}
          className="bg-transparent border-none p-1 text-on-surface-variant/40 hover:text-error transition-colors cursor-pointer shrink-0"
        >
          <span className="material-symbols-outlined text-base">close</span>
        </button>
      </div>

      {row.kind === 'resource' && (
        <select
          value={row.resourceKey ?? ''}
          onChange={(e) => onUpdate(row.id, { resourceKey: e.target.value })}
          className="box-border w-full bg-surface-container-lowest border border-solid border-outline-variant/20 rounded-sm px-2 py-1 text-xs text-white focus:outline-none focus:border-primary/50"
        >
          <option value="" disabled>Select resource</option>
          {resources.map((r) => <option key={r.key} value={r.key}>{r.name}</option>)}
        </select>
      )}

      <div className="box-border flex items-center border border-solid border-outline-variant/20 bg-black self-start">
        <button
          type="button"
          onClick={() => onUpdate(row.id, { amount: Math.max(0, row.amount - 1) })}
          className="bg-transparent border-none px-2 py-1 text-on-surface-variant hover:text-primary cursor-pointer"
        >
          −
        </button>
        <input
          type="number"
          min={0}
          value={row.amount}
          onChange={(e) => onUpdate(row.id, { amount: Math.max(0, Number(e.target.value)) })}
          className="box-border w-16 bg-transparent text-center text-xs font-headline text-white focus:outline-none border-x border-solid border-outline-variant/20 py-1"
        />
        <button
          type="button"
          onClick={() => onUpdate(row.id, { amount: row.amount + 1 })}
          className="bg-transparent border-none px-2 py-1 text-on-surface-variant hover:text-primary cursor-pointer"
        >
          +
        </button>
      </div>
    </div>
  );
};
