import React, { useMemo, useState } from 'react';
import {
  Button, Dialog, DialogActions, DialogContent, DialogTitle, FormControlLabel,
  MenuItem, Select, Switch, TextField, ToggleButton, ToggleButtonGroup,
} from '@mui/material';
import { useAppSelector } from '../../store/hooks';
import { diplomacyApi } from '../../api/diplomacy';
import { TreatyArticle, TreatyKind, TreatyVisibility } from '../../types';

interface Props {
  open: boolean;
  onClose: () => void;
  receiverId: string;
  receiverName: string;
  kind: TreatyKind.ALLIANCE | TreatyKind.TRADE | TreatyKind.TROOPS_PASS | TreatyKind.ARTICLE;
  onProposed: () => void;
}

type TributeRow = {
  id: string;
  kind: 'money' | 'resource' | 'goods';
  direction: 'send' | 'receive';
  resourceKey?: string;
  goodId?: string;
  amount: number;
};

const KIND_TITLES: Record<Props['kind'], string> = {
  [TreatyKind.ALLIANCE]: 'Propose Alliance',
  [TreatyKind.TRADE]: 'Propose Trade',
  [TreatyKind.TROOPS_PASS]: 'Propose Troops Pass',
  [TreatyKind.ARTICLE]: 'Propose Article',
};

export const TreatyNegotiationModal: React.FC<Props> = ({ open, onClose, receiverId, receiverName, kind, onProposed }) => {
  const currentUserId = useAppSelector((state) => state.user.id);
  const resources = useAppSelector((state) => state.resources.resources);
  const myGoods = useAppSelector((state) => state.goods.mine);
  const goodsCatalog = useMemo(() => {
    const seen = new Map<string, string>();
    for (const holding of myGoods) seen.set(holding.good.id, holding.good.name);
    return Array.from(seen.entries()).map(([id, name]) => ({ id, name }));
  }, [myGoods]);

  const [name, setName] = useState('');
  const [visibility, setVisibility] = useState<TreatyVisibility>(TreatyVisibility.PRIVATE);
  const [recurring, setRecurring] = useState(false);
  const [note, setNote] = useState('');
  const [passDirection, setPassDirection] = useState<'grant' | 'request'>('grant');
  const [rows, setRows] = useState<TributeRow[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reset = () => {
    setName(''); setVisibility(TreatyVisibility.PRIVATE); setRecurring(false);
    setNote(''); setPassDirection('grant'); setRows([]); setError(null);
  };

  const handleClose = () => { reset(); onClose(); };

  const addRow = () => {
    setRows((r) => [...r, { id: `${Date.now()}-${r.length}`, kind: 'money', direction: 'send', amount: 0 }]);
  };
  const updateRow = (id: string, patch: Partial<TributeRow>) => {
    setRows((r) => r.map((row) => (row.id === id ? { ...row, ...patch } : row)));
  };
  const removeRow = (id: string) => setRows((r) => r.filter((row) => row.id !== id));

  const buildArticles = (): TreatyArticle[] => {
    if (kind === TreatyKind.ALLIANCE) {
      return [{ type: 'set_state', state: 'alliance' as any }];
    }
    if (kind === TreatyKind.TROOPS_PASS) {
      const from = passDirection === 'grant' ? currentUserId : receiverId;
      const to = passDirection === 'grant' ? receiverId : currentUserId;
      return [{ type: 'grant_pass', from, to }];
    }
    if (kind === TreatyKind.ARTICLE) {
      return [{ type: 'text', markdown: note }];
    }
    // TRADE
    return rows
      .filter((r) => r.amount > 0)
      .map((r): TreatyArticle => {
        const from = r.direction === 'send' ? currentUserId : receiverId;
        const to = r.direction === 'send' ? receiverId : currentUserId;
        if (r.kind === 'money') return { type: 'money_tribute', amount: r.amount, from, to };
        if (r.kind === 'resource') return { type: 'resource_tribute', resourceKey: r.resourceKey ?? '', amount: r.amount, from, to };
        return { type: 'goods_tribute', goodId: r.goodId ?? '', amount: r.amount, from, to };
      });
  };

  const handleSubmit = async () => {
    if (!name.trim()) { setError('Name is required'); return; }
    if (kind === TreatyKind.ARTICLE && !note.trim()) { setError('Article text is required'); return; }
    if (kind === TreatyKind.TRADE && rows.length === 0) { setError('Add at least one transfer'); return; }

    setSaving(true);
    setError(null);
    try {
      await diplomacyApi.propose({
        name: name.trim(),
        receiverId,
        kind,
        visibility,
        recurring: kind === TreatyKind.TRADE ? recurring : undefined,
        articles: buildArticles(),
        note: note.trim() || undefined,
      });
      onProposed();
      handleClose();
    } catch (e: any) {
      setError(e?.response?.data?.message || 'Failed to propose treaty');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="sm" fullWidth>
      <DialogTitle>{KIND_TITLES[kind]} — {receiverName}</DialogTitle>
      <DialogContent dividers sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        <TextField label="Treaty name" value={name} onChange={(e) => setName(e.target.value)} size="small" fullWidth />

        {kind === TreatyKind.TROOPS_PASS && (
          <div>
            <div className="text-sm font-medium mb-2 text-white/80">Direction</div>
            <ToggleButtonGroup
              value={passDirection}
              exclusive
              onChange={(_, v) => v && setPassDirection(v)}
              size="small"
            >
              <ToggleButton value="grant">I grant passage to {receiverName}</ToggleButton>
              <ToggleButton value="request">Request passage from {receiverName}</ToggleButton>
            </ToggleButtonGroup>
          </div>
        )}

        {kind === TreatyKind.TRADE && (
          <div className="flex flex-col gap-2">
            <div className="text-sm font-medium text-white/80">Transfers</div>
            {rows.map((row) => (
              <div key={row.id} className="flex items-center gap-2 flex-wrap">
                <Select size="small" value={row.direction} onChange={(e) => updateRow(row.id, { direction: e.target.value as any })}>
                  <MenuItem value="send">I send</MenuItem>
                  <MenuItem value="receive">They send</MenuItem>
                </Select>
                <Select size="small" value={row.kind} onChange={(e) => updateRow(row.id, { kind: e.target.value as any })}>
                  <MenuItem value="money">Money</MenuItem>
                  <MenuItem value="resource">Resource</MenuItem>
                  <MenuItem value="goods">Goods</MenuItem>
                </Select>
                {row.kind === 'resource' && (
                  <Select size="small" value={row.resourceKey ?? ''} onChange={(e) => updateRow(row.id, { resourceKey: e.target.value })} displayEmpty>
                    <MenuItem value="" disabled>Select resource</MenuItem>
                    {resources.map((r) => <MenuItem key={r.key} value={r.key}>{r.name}</MenuItem>)}
                  </Select>
                )}
                {row.kind === 'goods' && (
                  <Select size="small" value={row.goodId ?? ''} onChange={(e) => updateRow(row.id, { goodId: e.target.value })} displayEmpty>
                    <MenuItem value="" disabled>Select good</MenuItem>
                    {goodsCatalog.map((g) => <MenuItem key={g.id} value={g.id}>{g.name}</MenuItem>)}
                  </Select>
                )}
                <TextField
                  size="small" type="number" label="Amount" sx={{ width: 100 }}
                  value={row.amount} onChange={(e) => updateRow(row.id, { amount: Math.max(0, Number(e.target.value)) })}
                />
                <Button size="small" color="error" onClick={() => removeRow(row.id)}>Remove</Button>
              </div>
            ))}
            <Button size="small" variant="outlined" onClick={addRow}>+ Add transfer</Button>
            <FormControlLabel
              control={<Switch checked={recurring} onChange={(e) => setRecurring(e.target.checked)} />}
              label="Recurring — repeats every turn"
            />
            <div className="text-xs text-white/50">
              Goods and resources can only be traded between players who share a border, or who are linked by a troops-pass route. Money can be sent to anyone.
            </div>
          </div>
        )}

        {kind === TreatyKind.ARTICLE && (
          <TextField
            label="Article text (Markdown)" value={note} onChange={(e) => setNote(e.target.value)}
            multiline minRows={4} fullWidth
          />
        )}
        {kind !== TreatyKind.ARTICLE && (
          <TextField
            label="Message (optional)" value={note} onChange={(e) => setNote(e.target.value)}
            multiline minRows={2} fullWidth
          />
        )}

        <Select size="small" value={visibility} onChange={(e) => setVisibility(e.target.value as TreatyVisibility)}>
          <MenuItem value={TreatyVisibility.PRIVATE}>Private — only signatories can see this</MenuItem>
          <MenuItem value={TreatyVisibility.PUBLIC}>Public — any player can view this via "Player treaties"</MenuItem>
        </Select>

        {error && <p className="text-xs text-red-500">{error}</p>}
      </DialogContent>
      <DialogActions>
        <Button onClick={handleClose} disabled={saving}>Cancel</Button>
        <Button variant="contained" onClick={() => void handleSubmit()} disabled={saving}>
          {saving ? 'Sending…' : 'Send Proposal'}
        </Button>
      </DialogActions>
    </Dialog>
  );
};
