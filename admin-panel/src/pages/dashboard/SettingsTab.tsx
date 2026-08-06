import { useEffect, useState } from 'react';
import {
  Alert, Box, Button, FormControlLabel, Paper, Snackbar, Switch, TextField, Typography,
} from '@mui/material';
import SaveIcon from '@mui/icons-material/Save';
import { adminApi } from '../../api/admin';

interface GameSettingsForm {
  is_paused: boolean;
  pause_message: string;
  turns_enabled: boolean;
}

const EMPTY_FORM: GameSettingsForm = { is_paused: false, pause_message: '', turns_enabled: true };

export const SettingsTab = () => {
  const [form, setForm] = useState<GameSettingsForm>({ ...EMPTY_FORM });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [snackbar, setSnackbar] = useState<{ msg: string; severity: 'success' | 'error' } | null>(null);

  useEffect(() => {
    adminApi.getGameSettings()
      .then((res) => setForm({
        is_paused: !!res.data.is_paused,
        pause_message: res.data.pause_message ?? '',
        turns_enabled: !!res.data.turns_enabled,
      }))
      .catch(() => setSnackbar({ msg: 'Failed to load game settings', severity: 'error' }))
      .finally(() => setLoading(false));
  }, []);

  const handleSave = async () => {
    setSaving(true);
    try {
      await adminApi.updateGameSettings({
        is_paused: form.is_paused,
        pause_message: form.pause_message.trim() || null,
        turns_enabled: form.turns_enabled,
      });
      setSnackbar({ msg: 'Game settings saved', severity: 'success' });
    } catch (err: any) {
      const msg = err?.response?.data?.message;
      setSnackbar({ msg: Array.isArray(msg) ? msg.join(', ') : (msg || 'Failed to save game settings'), severity: 'error' });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <Typography color="text.secondary">Loading…</Typography>;
  }

  return (
    <Box maxWidth={520}>
      <Paper sx={{ p: 3, display: 'flex', flexDirection: 'column', gap: 2 }}>
        <Typography variant="h6">Global Game Settings</Typography>

        <Box>
          <FormControlLabel
            control={
              <Switch
                checked={form.is_paused}
                onChange={(e) => setForm((p) => ({ ...p, is_paused: e.target.checked }))}
                color="error"
              />
            }
            label="Pause Game"
          />
          <Typography variant="body2" color="text.secondary">
            When on: PLAYER accounts cannot log in and are logged out of any active session
            immediately. Registration stays open. ADMIN and MODERATOR accounts are unaffected.
          </Typography>
        </Box>

        <TextField
          label="Pause Message"
          value={form.pause_message}
          onChange={(e) => setForm((p) => ({ ...p, pause_message: e.target.value }))}
          multiline
          minRows={2}
          disabled={!form.is_paused}
          helperText="Shown to players on the login screen while the game is paused. Leave blank for the default message."
        />

        <Box>
          <FormControlLabel
            control={
              <Switch
                checked={form.turns_enabled}
                onChange={(e) => setForm((p) => ({ ...p, turns_enabled: e.target.checked }))}
              />
            }
            label="Turn Execution Enabled"
          />
          <Typography variant="body2" color="text.secondary">
            When off, the scheduled turn tick (income/production/upkeep/actions) is skipped
            entirely — independent of Pause Game, so you can freeze the world without locking
            players out, or vice versa.
          </Typography>
        </Box>

        <Button
          startIcon={<SaveIcon />}
          variant="contained"
          onClick={handleSave}
          disabled={saving}
        >
          Save Settings
        </Button>
      </Paper>

      <Snackbar open={!!snackbar} autoHideDuration={4000} onClose={() => setSnackbar(null)}>
        <Alert severity={snackbar?.severity} onClose={() => setSnackbar(null)}>{snackbar?.msg}</Alert>
      </Snackbar>
    </Box>
  );
};
