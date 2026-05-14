import React from 'react';
import { Button, Dialog, DialogActions, DialogContent, DialogTitle } from '@mui/material';

interface Props {
  open: boolean;
  onClose: () => void;
  isCancelling: boolean;
  onConfirm: () => void;
}

export const CancelActionModal: React.FC<Props> = ({ open, onClose, isCancelling, onConfirm }) => (
  <Dialog open={open} onClose={onClose}>
    <DialogTitle>Cancel Action</DialogTitle>
    <DialogContent>
      <p>Are you sure you want to cancel this action?</p>
    </DialogContent>
    <DialogActions>
      <Button onClick={onClose} disabled={isCancelling}>No</Button>
      <Button color="error" onClick={onConfirm} disabled={isCancelling}>
        {isCancelling ? 'Cancelling...' : 'Yes'}
      </Button>
    </DialogActions>
  </Dialog>
);
