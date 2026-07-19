import React, { useState } from 'react';
import { Button, Dialog, DialogActions, DialogContent, DialogTitle, TextField } from '@mui/material';
import { HexColorPicker } from 'react-colorful';
import { modApi, ModNpc } from '../../api/mod.ts';

interface Props {
  open: boolean;
  onClose: () => void;
  onCreated: (npc: ModNpc) => void;
}

const EMPTY = { login: '', country_name: '', money: 0, troops: 0 };

/** Mod-layer tool: creates a non-playable NPC "DM" country (see /mod/npc). */
export const CreateNpcModal: React.FC<Props> = ({ open, onClose, onCreated }) => {
  const [form, setForm] = useState({ ...EMPTY });
  const [color, setColor] = useState('#666666');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleClose = () => {
    setForm({ ...EMPTY });
    setColor('#666666');
    setError(null);
    onClose();
  };

  const handleCreate = async () => {
    if (!form.login.trim() || !form.country_name.trim()) {
      setError('Login and country name are required');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const npc = await modApi.createNpc({
        login: form.login.trim(),
        country_name: form.country_name.trim(),
        color,
        money: Number(form.money) || 0,
        troops: Number(form.troops) || 0,
      });
      onCreated(npc);
      handleClose();
    } catch (e: any) {
      setError(e?.response?.data?.message || 'Failed to create NPC country');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="xs" fullWidth>
      <DialogTitle>Create NPC Country</DialogTitle>
      <DialogContent dividers sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 1 }}>
        <TextField
          label="Login (internal, cannot log in)"
          value={form.login}
          onChange={(e) => setForm((p) => ({ ...p, login: e.target.value }))}
          size="small"
          fullWidth
        />
        <TextField
          label="Country name"
          value={form.country_name}
          onChange={(e) => setForm((p) => ({ ...p, country_name: e.target.value }))}
          size="small"
          fullWidth
        />
        <TextField
          label="Starting money"
          type="number"
          value={form.money}
          onChange={(e) => setForm((p) => ({ ...p, money: Number(e.target.value) }))}
          size="small"
          fullWidth
        />
        <TextField
          label="Starting troops"
          type="number"
          value={form.troops}
          onChange={(e) => setForm((p) => ({ ...p, troops: Number(e.target.value) }))}
          size="small"
          fullWidth
        />
        <div>
          <div style={{ fontSize: 13, fontWeight: 500, marginBottom: 8 }}>Country color</div>
          <HexColorPicker color={color} onChange={setColor} style={{ width: '100%' }} />
        </div>
        {error && <p style={{ color: '#dc2626', fontSize: 12 }}>{error}</p>}
      </DialogContent>
      <DialogActions>
        <Button onClick={handleClose} disabled={saving}>Cancel</Button>
        <Button variant="contained" onClick={() => void handleCreate()} disabled={saving}>
          {saving ? 'Creating…' : 'Create'}
        </Button>
      </DialogActions>
    </Dialog>
  );
};
