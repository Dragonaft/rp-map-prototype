import React, { useMemo, useState } from 'react';
import {
  Button, Checkbox, Dialog, DialogActions, DialogContent, DialogTitle,
  FormControlLabel, MenuItem, Select, TextField,
} from '@mui/material';
import { useAppSelector } from '../../store/hooks';
import { diplomacyApi } from '../../api/diplomacy';
import { PeaceScope, Province, TreatyArticle, TreatyVisibility } from '../../types';

interface Props {
  open: boolean;
  onClose: () => void;
  targetId: string;
  targetName: string;
  onProposed: () => void;
}

type TributeRow = { id: string; kind: 'money' | 'resource'; direction: 'demand' | 'offer'; resourceKey?: string; amount: number };

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
  const resources = useAppSelector((state) => state.resources.resources);

  const [name, setName] = useState('');
  const [visibility, setVisibility] = useState<TreatyVisibility>(TreatyVisibility.PRIVATE);
  const [selectedProvinceIds, setSelectedProvinceIds] = useState<Set<string>>(new Set());
  const [rows, setRows] = useState<TributeRow[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const scope = useMemo<PeaceScope | null>(() => {
    for (const war of wars) {
      if (war.status !== 'active') continue;
      const mine = war.participants.find((p) => p.user_id === currentUserId);
      const theirs = war.participants.find((p) => p.user_id === targetId);
      if (!mine || !theirs || mine.side === theirs.side) continue;
      if (mine.is_leader && theirs.is_leader) return PeaceScope.LEADER;
      if (mine.is_leader && !theirs.is_leader) return PeaceScope.SEPARATE;
      if (!mine.is_leader && theirs.is_leader) return PeaceScope.LEADER; // proposing to your own war's opposing leader
    }
    return null;
  }, [wars, currentUserId, targetId]);

  const eligibleProvinces = useMemo(() => {
    if (scope === PeaceScope.SEPARATE) {
      return provinces.filter((p) => p.userId === targetId && p.occupierId === currentUserId);
    }
    if (scope === PeaceScope.LEADER) {
      return provinces.filter((p) => p.userId === targetId);
    }
    return [];
  }, [provinces, scope, targetId, currentUserId]);

  const myOwnedIds = useMemo(
    () => new Set(provinces.filter((p) => p.userId === currentUserId).map((p) => p.id)),
    [provinces, currentUserId],
  );

  /** A demanded province is only paintable if it touches my territory or another already-selected province (EU4 contiguity). */
  const isConnected = (province: Province, selected: Set<string>): boolean => {
    return (province.neighbors ?? []).some((n) => myOwnedIds.has(n) || selected.has(n));
  };

  const toggleProvince = (id: string) => {
    setSelectedProvinceIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const addRow = () => setRows((r) => [...r, { id: `${Date.now()}-${r.length}`, kind: 'money', direction: 'demand', amount: 0 }]);
  const updateRow = (id: string, patch: Partial<TributeRow>) => setRows((r) => r.map((row) => (row.id === id ? { ...row, ...patch } : row)));
  const removeRow = (id: string) => setRows((r) => r.filter((row) => row.id !== id));

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

  const handleSubmit = async () => {
    if (!scope) { setError('No active war found with this player'); return; }
    if (!name.trim()) { setError('Name is required'); return; }

    setSaving(true);
    setError(null);
    try {
      await diplomacyApi.propose({
        name: name.trim(),
        receiverId: targetId,
        kind: 'peace' as any,
        peaceScope: scope,
        visibility,
        articles: buildArticles(),
      });
      onProposed();
      onClose();
    } catch (e: any) {
      setError(e?.response?.data?.message || 'Failed to propose peace');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle>Propose Peace — {targetName}</DialogTitle>
      <DialogContent dividers sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        {!scope && <p className="text-xs text-red-500">No active war with this player was found.</p>}
        {scope === PeaceScope.SEPARATE && (
          <p className="text-xs text-white/60">
            {targetName} is not a war leader — this is a separate peace. You may only demand provinces of
            theirs that you currently occupy; they will leave the war and break their alliance with their leader.
          </p>
        )}
        <TextField label="Treaty name" value={name} onChange={(e) => setName(e.target.value)} size="small" fullWidth />

        <div>
          <div className="text-sm font-medium mb-2 text-white/80">
            Demand provinces ({selectedProvinceIds.size} selected)
          </div>
          <div className="max-h-60 overflow-y-auto flex flex-col gap-1 border border-outline-variant/20 rounded p-2">
            {eligibleProvinces.length === 0 && (
              <div className="text-xs text-white/40 py-2">
                {scope === PeaceScope.SEPARATE ? 'You do not currently occupy any of their provinces.' : 'No provinces available.'}
              </div>
            )}
            {eligibleProvinces.map((p) => {
              const connected = isConnected(p, selectedProvinceIds);
              const checked = selectedProvinceIds.has(p.id);
              const disabled = !checked && !connected;
              return (
                <FormControlLabel
                  key={p.id}
                  control={
                    <Checkbox
                      size="small" checked={checked} disabled={disabled}
                      onChange={() => toggleProvince(p.id)}
                    />
                  }
                  label={
                    <span className={`text-xs ${disabled ? 'text-white/30' : 'text-white/80'}`}>
                      {p.regionId} ({p.landscape}){p.occupierId === currentUserId ? ' — occupied by you' : ''}
                      {disabled ? ' — not contiguous' : ''}
                    </span>
                  }
                />
              );
            })}
          </div>
        </div>

        <div className="flex flex-col gap-2">
          <div className="text-sm font-medium text-white/80">Tribute</div>
          {rows.map((row) => (
            <div key={row.id} className="flex items-center gap-2 flex-wrap">
              <Select size="small" value={row.direction} onChange={(e) => updateRow(row.id, { direction: e.target.value as any })}>
                <MenuItem value="demand">Demand from {targetName}</MenuItem>
                <MenuItem value="offer">Offer to {targetName}</MenuItem>
              </Select>
              <Select size="small" value={row.kind} onChange={(e) => updateRow(row.id, { kind: e.target.value as any })}>
                <MenuItem value="money">Money</MenuItem>
                <MenuItem value="resource">Resource</MenuItem>
              </Select>
              {row.kind === 'resource' && (
                <Select size="small" value={row.resourceKey ?? ''} onChange={(e) => updateRow(row.id, { resourceKey: e.target.value })} displayEmpty>
                  <MenuItem value="" disabled>Select resource</MenuItem>
                  {resources.map((r) => <MenuItem key={r.key} value={r.key}>{r.name}</MenuItem>)}
                </Select>
              )}
              <TextField
                size="small" type="number" label="Amount" sx={{ width: 100 }}
                value={row.amount} onChange={(e) => updateRow(row.id, { amount: Math.max(0, Number(e.target.value)) })}
              />
              <Button size="small" color="error" onClick={() => removeRow(row.id)}>Remove</Button>
            </div>
          ))}
          <Button size="small" variant="outlined" onClick={addRow}>+ Add tribute</Button>
        </div>

        <Select size="small" value={visibility} onChange={(e) => setVisibility(e.target.value as TreatyVisibility)}>
          <MenuItem value={TreatyVisibility.PRIVATE}>Private — only signatories can see this</MenuItem>
          <MenuItem value={TreatyVisibility.PUBLIC}>Public — any player can view this via "Player treaties"</MenuItem>
        </Select>

        {error && <p className="text-xs text-red-500">{error}</p>}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={saving}>Cancel</Button>
        <Button variant="contained" onClick={() => void handleSubmit()} disabled={saving || !scope}>
          {saving ? 'Sending…' : 'Send Peace Proposal'}
        </Button>
      </DialogActions>
    </Dialog>
  );
};
