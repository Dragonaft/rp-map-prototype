import React, { useEffect, useState } from 'react';
import { Button, Dialog, DialogActions, DialogContent, DialogTitle, TextField } from '@mui/material';
import { HexColorPicker } from 'react-colorful';
import { useAppDispatch, useAppSelector } from '../../store/hooks';
import { updateUserProfile, updateUserFlag } from '../../store/slices/userSlice';
import { usersApi } from '../../api/users';
import { CountryFlag } from '../CountryFlag';
import type { RootState } from '../../store/store';

interface Props {
  open: boolean;
  onClose: () => void;
}

// Mirrors FLAG_MAX_BYTES in api/src/users/users.service.ts — duplicated rather than shared
// across the two npm packages, matching this codebase's existing convention for client-side
// mirrors of server-side constants (see utils/supply.ts's comment on the same pattern). This
// is a fast-feedback check only; the server re-validates size and the actual image format
// (magic bytes, not extension) regardless.
const FLAG_MAX_BYTES = 256 * 1024;
const ACCEPTED_FLAG_TYPES = ['image/png', 'image/jpeg', 'image/webp'];

export const ProfileModal: React.FC<Props> = ({ open, onClose }) => {
  const dispatch = useAppDispatch();
  const user = useAppSelector((state: RootState) => state.user);

  const [countryName, setCountryName] = useState('');
  const [color, setColor] = useState('#000000');
  const [hexInput, setHexInput] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [flagBusy, setFlagBusy] = useState(false);
  const [flagError, setFlagError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setCountryName(user.countryName);
      setColor(user.color);
      setHexInput(user.color);
      setError(null);
      setFlagError(null);
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

  // Flag upload/removal are their own instant actions (own endpoints, own loading/error
  // state) rather than being folded into the Save button above, which only batches
  // countryName/color — same separation the backend draws between PATCH /users/:id and
  // POST|DELETE /users/:id/flag.
  const handleFlagChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = ''; // allow re-selecting the same file later
    if (!file) return;

    if (!ACCEPTED_FLAG_TYPES.includes(file.type)) {
      setFlagError('Flag must be a PNG, JPEG, or WebP image');
      return;
    }
    if (file.size > FLAG_MAX_BYTES) {
      setFlagError(`Flag image must be ${Math.floor(FLAG_MAX_BYTES / 1024)}KB or smaller`);
      return;
    }

    setFlagBusy(true);
    setFlagError(null);
    try {
      const { flagUrl } = await usersApi.uploadFlag(user.id, file);
      dispatch(updateUserFlag(flagUrl));
    } catch (err: any) {
      setFlagError(err?.response?.data?.message || 'Failed to upload flag');
    } finally {
      setFlagBusy(false);
    }
  };

  const handleFlagRemove = async () => {
    setFlagBusy(true);
    setFlagError(null);
    try {
      await usersApi.deleteFlag(user.id);
      dispatch(updateUserFlag(null));
    } catch (err: any) {
      setFlagError(err?.response?.data?.message || 'Failed to remove flag');
    } finally {
      setFlagBusy(false);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="xs" fullWidth disablePortal>
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
          <div className="text-sm font-medium mb-2 text-gray-700">Country flag</div>
          <div className="flex items-center gap-3">
            <CountryFlag flagUrl={user.flagUrl} color={color} countryName={countryName} size="md" />
            <input
              type="file"
              accept={ACCEPTED_FLAG_TYPES.join(',')}
              onChange={(e) => void handleFlagChange(e)}
              disabled={flagBusy}
              className="bg-transparent text-xs text-gray-700 flex-1"
            />
            {user.flagUrl && (
              <Button size="small" color="error" disabled={flagBusy} onClick={() => void handleFlagRemove()}>
                Remove
              </Button>
            )}
          </div>
          {flagError && <p className="text-xs text-red-600 mt-1">{flagError}</p>}
        </div>
        <div>
          <div className="text-sm font-medium mb-2 text-gray-700">Country color</div>
          <HexColorPicker color={color} onChange={handlePickerChange} style={{ width: '100%' }} />
          <div className="flex items-center gap-2 mt-2">
            <div
              className="w-8 h-8 rounded border border-solid border-gray-400 shrink-0"
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
