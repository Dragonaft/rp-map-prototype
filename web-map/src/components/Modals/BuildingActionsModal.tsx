import React from 'react';
import { Button, Dialog, DialogActions, DialogContent, DialogTitle, Tooltip } from '@mui/material';
import { Building } from '../../types.ts';
import { BUILDING_ICONS } from '../../constants/buildingIcons.ts';

interface Props {
  open: boolean;
  onClose: () => void;
  upgradeBuildingForTarget: Building | null;
  upgradeDisabledReason: string | null;
  isUpgrading: boolean;
  onRemove: () => void;
  onUpgrade: () => void;
}

export const BuildingActionsModal: React.FC<Props> = ({
  open,
  onClose,
  upgradeBuildingForTarget,
  upgradeDisabledReason,
  isUpgrading,
  onRemove,
  onUpgrade,
}) => (
  <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
    <DialogTitle>Building Actions</DialogTitle>
    <DialogContent dividers>
      <div style={{ display: 'flex', flexDirection: 'row', justifyContent: 'space-between', gap: 25 }}>
        <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', width: '90%' }}>
          <Button fullWidth variant="contained" color="error" onClick={onRemove}>
            Remove building
          </Button>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 2, width: '90%' }}>
          {upgradeBuildingForTarget && (
            <div className="mb-3 p-2 rounded bg-gray-100 text-sm">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-xl">{BUILDING_ICONS[upgradeBuildingForTarget.type] ?? '🏗️'}</span>
                <strong>{upgradeBuildingForTarget.name}</strong>
              </div>
              {upgradeBuildingForTarget.description && (
                <p className="text-gray-600">{upgradeBuildingForTarget.description}</p>
              )}
              <div className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 text-gray-700">
                <span>Cost: {upgradeBuildingForTarget.cost}</span>
                {upgradeBuildingForTarget.income != null && upgradeBuildingForTarget.income > 0 && (
                  <span>Income: {upgradeBuildingForTarget.income}</span>
                )}
                {upgradeBuildingForTarget.upkeep != null && upgradeBuildingForTarget.upkeep > 0 && (
                  <span>Upkeep: {upgradeBuildingForTarget.upkeep}</span>
                )}
              </div>
            </div>
          )}
          <Tooltip title={upgradeDisabledReason ?? ''}>
            <span style={{ flex: 1 }}>
              <Button
                fullWidth
                variant="contained"
                color="primary"
                disabled={!!upgradeDisabledReason || isUpgrading}
                onClick={onUpgrade}
              >
                {isUpgrading ? 'Queuing…' : 'Upgrade'}
              </Button>
            </span>
          </Tooltip>
        </div>
      </div>
    </DialogContent>
    <DialogActions>
      <Button onClick={onClose} disabled={isUpgrading}>Cancel</Button>
    </DialogActions>
  </Dialog>
);
