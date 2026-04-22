import React from 'react';
import { Button, Dialog, DialogActions, DialogContent, DialogTitle } from '@mui/material';

interface Props {
  open: boolean;
  onClose: () => void;
  buildingName?: string;
  isDeleting: boolean;
  onConfirm: () => void;
}

export const DeleteBuildingModal: React.FC<Props> = ({ open, onClose, buildingName, isDeleting, onConfirm }) => (
  <Dialog open={open} onClose={onClose}>
    <DialogTitle>Delete Building</DialogTitle>
    <DialogContent>
      <p>Are you sure you want to queue removal of <strong>{buildingName}</strong>?</p>
      <p style={{ color: '#888', fontSize: '0.85em', marginTop: 4 }}>Cost: 100</p>
    </DialogContent>
    <DialogActions>
      <Button onClick={onClose} disabled={isDeleting}>Cancel</Button>
      <Button color="error" onClick={onConfirm} disabled={isDeleting}>
        {isDeleting ? 'Queuing...' : 'Delete'}
      </Button>
    </DialogActions>
  </Dialog>
);
