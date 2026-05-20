import React, { useEffect, useState } from 'react';
import { Button, Dialog, DialogActions, DialogContent, DialogTitle, TextField } from '@mui/material';
import { HexColorPicker } from 'react-colorful';
import { useAppDispatch, useAppSelector } from '../../store/hooks';
import { updateUserProfile } from '../../store/slices/userSlice';
import { usersApi } from '../../api/users';
import type { RootState } from '../../store/store';

interface Props {
  open: boolean;
  onClose: () => void;
}

export const ProfileModal: React.FC<Props> = ({ open, onClose }) => {
  const dispatch = useAppDispatch();
  const user = useAppSelector((state: RootState) => state.user);

  const [countryName, setCountryName] = useState('');
  const [color, setColor] = useState('#000000');
  const [hexInput, setHexInput] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setCountryName(user.countryName);
      setColor(user.color);
      setHexInput(user.color);
      setError(null);
    }
  }, [open, user.countryName, user.color]);

  const handleHexInputChange = (value: string) => {
    setHexInput(value);
    if (/^#[0-9a-fA-F]{6}$/.test(value)) {
      setColor(value);
    }
  };

  const handlePickerChange = (value: string) => {
    setColor(value);
    setHexInput(value);
  };

  const handleSave = async () => {
    if (!countryName.trim()) {
      setError('Country name cannot be empty');
      return;
    }
    if (!/^#[0-9a-fA-F]{6}$/.test(color)) {
      setError('Color must be a valid hex (e.g. #a3b2c1)');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await usersApi.update(user.id, { countryName: countryName.trim(), color });
      dispatch(updateUserProfile({ countryName: countryName.trim(), color }));
      onClose();
    } catch (e: any) {
      setError(e?.response?.data?.message || 'Failed to save profile');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="xs" fullWidth>
      <DialogTitle>Edit Profile</DialogTitle>
      <DialogContent dividers sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        <TextField
          label="Country name"
          value={countryName}
          onChange={(e) => setCountryName(e.target.value)}
          size="small"
          fullWidth
        />
        <div>
          <div className="text-sm font-medium mb-2 text-gray-700">Country color</div>
          <HexColorPicker color={color} onChange={handlePickerChange} style={{ width: '100%' }} />
          <div className="flex items-center gap-2 mt-2">
            <div
              className="w-8 h-8 rounded border border-gray-400 shrink-0"
              style={{ backgroundColor: color }}
            />
            <TextField
              value={hexInput}
              onChange={(e) => handleHexInputChange(e.target.value)}
              size="small"
              inputProps={{ maxLength: 7, style: { fontFamily: 'monospace' } }}
              placeholder="#rrggbb"
              sx={{ flex: 1, marginTop: 2, width: '100%' }}
            />
          </div>
        </div>
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
