import { useState } from 'react';
import {
  Alert, Box, Button, FormControl, InputLabel, MenuItem, Paper, Select, Snackbar, TextField, Typography,
} from '@mui/material';
import SendIcon from '@mui/icons-material/Send';
import { adminApi } from '../../api/admin';

const SEVERITIES = ['info', 'warning', 'error'];

const EMPTY_FORM = { title: '', message: '', severity: 'info' };

export const NotificationsTab = () => {
  const [form, setForm] = useState({ ...EMPTY_FORM });
  const [sending, setSending] = useState(false);
  const [snackbar, setSnackbar] = useState<{ msg: string; severity: 'success' | 'error' } | null>(null);

  const handleSend = async () => {
    setSending(true);
    try {
      const res = await adminApi.broadcastNotification(form);
      setSnackbar({ msg: `Sent to ${res.data.sentTo} player(s)`, severity: 'success' });
      setForm({ ...EMPTY_FORM });
    } catch (err: any) {
      const msg = err?.response?.data?.message;
      setSnackbar({ msg: Array.isArray(msg) ? msg.join(', ') : (msg || 'Failed to send notification'), severity: 'error' });
    } finally {
      setSending(false);
    }
  };

  return (
    <Box maxWidth={520}>
      <Paper sx={{ p: 3, display: 'flex', flexDirection: 'column', gap: 2 }}>
        <Typography variant="h6">Broadcast Notification</Typography>
        <Typography variant="body2" color="text.secondary">
          Sends a notification to every registered player. It appears in their Notifications Center under the News tab.
        </Typography>
        <TextField
          label="Title *"
          value={form.title}
          onChange={(e) => setForm((p) => ({ ...p, title: e.target.value }))}
        />
        <TextField
          label="Message *"
          value={form.message}
          onChange={(e) => setForm((p) => ({ ...p, message: e.target.value }))}
          multiline
          minRows={4}
        />
        <FormControl>
          <InputLabel>Severity</InputLabel>
          <Select
            label="Severity"
            value={form.severity}
            onChange={(e) => setForm((p) => ({ ...p, severity: e.target.value }))}
          >
            {SEVERITIES.map((s) => <MenuItem key={s} value={s}>{s}</MenuItem>)}
          </Select>
        </FormControl>
        <Button
          startIcon={<SendIcon />}
          variant="contained"
          onClick={handleSend}
          disabled={sending || !form.title.trim() || !form.message.trim()}
        >
          Send to All Players
        </Button>
      </Paper>

      <Snackbar open={!!snackbar} autoHideDuration={4000} onClose={() => setSnackbar(null)}>
        <Alert severity={snackbar?.severity} onClose={() => setSnackbar(null)}>{snackbar?.msg}</Alert>
      </Snackbar>
    </Box>
  );
};
