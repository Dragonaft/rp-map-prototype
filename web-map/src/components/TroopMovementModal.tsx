import React, { useState } from 'react';
import { Modal, Box, Typography, Slider, Button, Alert } from '@mui/material';
import { ActionType } from '../types';
import { actionsApi } from '../api/actions';
import { useAppDispatch } from "../store/hooks.ts";
import { addAction } from "../store/slices/actionsSlice.ts";
import { updateProvinceById } from "../store/slices/provincesSlice.ts";

interface Props {
  open: boolean;
  onClose: () => void;
  fromProvinceId: string;
  toProvinceId: string;
  maxTroops: number;
  isInvasion: boolean;
}

const style = {
  position: 'absolute',
  top: '50%',
  left: '50%',
  transform: 'translate(-50%, -50%)',
  width: 400,
  bgcolor: 'background.paper',
  border: '2px solid #000',
  boxShadow: 24,
  p: 4,
};

export const TroopMovementModal: React.FC<Props> = ({
  open,
  onClose,
  fromProvinceId,
  toProvinceId,
  maxTroops,
  isInvasion,
}) => {
  const [troopCount, setTroopCount] = useState(Math.min(1, maxTroops));
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const dispatch = useAppDispatch();

  const handleConfirm = async () => {
    setLoading(true);
    setError(null);

    try {
      const actionType = isInvasion ? ActionType.INVADE : ActionType.TRANSFER_TROOPS;

      const response = await actionsApi.createAction({
        type: actionType,
        actionData: {
          from_province_id: fromProvinceId,
          to_province_id: toProvinceId,
          troops_number: troopCount,
        },
      });

      dispatch(addAction(response.action));
      dispatch(updateProvinceById({
        id: response.province.id,
        updates: {
          localTroops: response.province.localTroops,
        },
      }));

      onClose();
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to create action');
    } finally {
      setLoading(false);
    }
  };

  const handleSliderChange = (_event: Event, newValue: number | number[]) => {
    setTroopCount(newValue as number);
  };

  return (
    <Modal open={open} onClose={onClose}>
      <Box sx={style}>
        <Typography variant="h6" component="h2" gutterBottom>
          {isInvasion ? 'Invade Province' : 'Transfer Troops'}
        </Typography>

        <Typography sx={{ mt: 2, mb: 2 }}>
          Select how many troops to {isInvasion ? 'send for invasion' : 'transfer'}:
        </Typography>

        <Box sx={{ px: 2 }}>
          <Slider
            value={troopCount}
            onChange={handleSliderChange}
            min={1}
            max={maxTroops}
            marks
            valueLabelDisplay="on"
            disabled={loading}
          />
        </Box>

        <Typography variant="body2" sx={{ mt: 2, mb: 2, color: 'text.secondary' }}>
          Sending {troopCount} of {maxTroops} troops
        </Typography>

        {error && (
          <Alert severity="error" sx={{ mt: 2, mb: 2 }}>
            {error}
          </Alert>
        )}

        <Box sx={{ display: 'flex', gap: 2, mt: 3 }}>
          <Button
            variant="contained"
            onClick={handleConfirm}
            disabled={loading}
            fullWidth
          >
            {loading ? 'Processing...' : 'Confirm'}
          </Button>
          <Button
            variant="outlined"
            onClick={onClose}
            disabled={loading}
            fullWidth
          >
            Cancel
          </Button>
        </Box>
      </Box>
    </Modal>
  );
};
