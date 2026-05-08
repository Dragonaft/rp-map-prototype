import React, { useState } from 'react';
import { Modal, Box, Typography, Button, Alert } from '@mui/material';
import { armiesApi } from '../api/armies';
import { useAppDispatch } from '../store/hooks.ts';
import { addAction } from '../store/slices/actionsSlice.ts';

interface Props {
  open: boolean;
  onClose: () => void;
  armyId: string;
  armyName: string;
  toProvinceId: string;
  onConfirmed: () => void;
}

const style = {
  position: 'absolute',
  top: '50%',
  left: '50%',
  transform: 'translate(-50%, -50%)',
  width: 360,
  bgcolor: 'background.paper',
  border: '2px solid #000',
  boxShadow: 24,
  p: 4,
};

export const TroopMovementModal: React.FC<Props> = ({
  open,
  onClose,
  armyId,
  armyName,
  toProvinceId,
  onConfirmed,
}) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const dispatch = useAppDispatch();

  const handleConfirm = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await armiesApi.moveArmy({ army_id: armyId, to_province_id: toProvinceId });
      dispatch(addAction(response));
      onConfirmed();
      onClose();
    } catch (err: any) {
      setError(err?.response?.data?.message || 'Failed to queue move action');
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    if (loading) return;
    setError(null);
    onClose();
  };

  return (
    <Modal open={open} onClose={handleClose}>
      <Box sx={style}>
        <Typography variant="h6" component="h2" gutterBottom>
          Move Army
        </Typography>

        <Typography sx={{ mt: 2, mb: 2 }}>
          Queue move for <strong>{armyName}</strong> to the selected province?
        </Typography>

        {error && (
          <Alert severity="error" sx={{ mt: 1, mb: 2 }}>
            {error}
          </Alert>
        )}

        <Box sx={{ display: 'flex', gap: 2, mt: 3 }}>
          <Button variant="contained" onClick={handleConfirm} disabled={loading} fullWidth>
            {loading ? 'Queuing...' : 'Confirm'}
          </Button>
          <Button variant="outlined" onClick={handleClose} disabled={loading} fullWidth>
            Cancel
          </Button>
        </Box>
      </Box>
    </Modal>
  );
};
