import React, { useCallback, useEffect, useState } from 'react';
import { Button, Dialog, DialogActions, DialogContent, DialogTitle, TextField, Typography } from '@mui/material';
import { modApi } from '../../api/mod.ts';
import { goodsApi } from '../../api/goods.ts';
import { resourcesApi } from '../../api/resources.ts';
import { useQuery } from '../../hooks/useApi.ts';

interface Props {
  open: boolean;
  onClose: () => void;
  userId: string;
  userName: string;
}

export const ModStocksModal: React.FC<Props> = ({ open, onClose, userId, userName }) => {
  const fetchGoods = useCallback(() => goodsApi.getAll(), []);
  const { data: goods } = useQuery(fetchGoods, []);
  const fetchResources = useCallback(() => resourcesApi.getAll(), []);
  const { data: resources } = useQuery(fetchResources, []);

  const [money, setMoney] = useState('');
  const [troops, setTroops] = useState('');
  const [piety, setPiety] = useState('');
  const [goodQuantities, setGoodQuantities] = useState<Record<string, string>>({});
  const [resourceQuantities, setResourceQuantities] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setMoney('');
      setTroops('');
      setPiety('');
      setGoodQuantities({});
      setResourceQuantities({});
      setError(null);
    }
  }, [open]);

  // Blank fields are left untouched server-side — only fields the mod actually typed into
  // are sent, so leaving most of the form empty doesn't zero out everything else.
  const handleSave = async () => {
    setSaving(true);
    setError(null);
    try {
      await modApi.setStocks(userId, {
        money: money !== '' ? Number(money) : undefined,
        troops: troops !== '' ? Number(troops) : undefined,
        piety: piety !== '' ? Number(piety) : undefined,
        goods: Object.entries(goodQuantities)
          .filter(([, v]) => v !== '')
          .map(([goodId, v]) => ({ goodId, quantity: Number(v) })),
        resources: Object.entries(resourceQuantities)
          .filter(([, v]) => v !== '')
          .map(([resourceKey, v]) => ({ resourceKey, quantity: Number(v) })),
      });
      window.location.reload();
    } catch (e: any) {
      setError(e?.response?.data?.message || 'Failed to update stocks');
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="xs" fullWidth>
      <DialogTitle>Edit Stocks — {userName}</DialogTitle>
      <DialogContent dividers sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 1 }}>
        <Typography variant="caption" color="text.secondary">
          Leave a field blank to leave it unchanged. Values set here are exact (not added).
        </Typography>
        <TextField label="Money" type="number" size="small" fullWidth value={money} onChange={(e) => setMoney(e.target.value)} />
        <TextField label="Troops" type="number" size="small" fullWidth value={troops} onChange={(e) => setTroops(e.target.value)} />
        <TextField label="Piety" type="number" size="small" fullWidth value={piety} onChange={(e) => setPiety(e.target.value)} />

        {(resources ?? []).length > 0 && (
          <>
            <Typography variant="subtitle2">Resources</Typography>
            {resources!.map((r) => (
              <TextField
                key={r.id}
                label={r.name}
                type="number"
                size="small"
                fullWidth
                value={resourceQuantities[r.key] ?? ''}
                onChange={(e) => setResourceQuantities((p) => ({ ...p, [r.key]: e.target.value }))}
              />
            ))}
          </>
        )}

        {(goods ?? []).length > 0 && (
          <>
            <Typography variant="subtitle2">Goods</Typography>
            {goods!.map((g) => (
              <TextField
                key={g.id}
                label={g.name}
                type="number"
                size="small"
                fullWidth
                value={goodQuantities[g.id] ?? ''}
                onChange={(e) => setGoodQuantities((p) => ({ ...p, [g.id]: e.target.value }))}
              />
            ))}
          </>
        )}

        {error && <p className="text-xs text-red-600">{error}</p>}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={saving}>Cancel</Button>
        <Button variant="contained" onClick={() => void handleSave()} disabled={saving}>
          {saving ? 'Saving…' : 'Save'}
        </Button>
      </DialogActions>
    </Dialog>
  );
};
