import React from 'react';
import { Button, Dialog, DialogActions, DialogContent, DialogTitle, Tooltip } from '@mui/material';
import { Building, Tech } from '../../types.ts';
import { BUILDING_ICONS } from '../../constants/buildingIcons.ts';
import { evaluateBuildRequirements } from '../../utils/mapModes.ts';

interface Props {
  open: boolean;
  onClose: () => void;
  loading: boolean;
  buildings: Building[];
  hasWaterNeighbor: boolean;
  provinceResourceType: string;
  userMoney: number;
  userCompletedResearch: string[];
  pendingBuildTypes: Set<string>;
  techs: Tech[];
  /** Player's resource ledger (GET /resources/mine), keyed by resource key — already nets out everything built. */
  userResourcesByKey: Record<string, number>;
  pendingResourceUsage: Record<string, number>;
  /** Player's goods ledger (GET /goods/mine), keyed by good id — Good has no natural key like Resource does. */
  userGoodsById: Record<string, number>;
  pendingGoodUsage: Record<string, number>;
  /** Good id -> display name, for the "not enough goods" tooltip. */
  goodNameById: Record<string, string>;
  builtTypesInProvince: Set<string>;
  onBuild: (buildingId: string) => void;
}

export const BuildMenuModal: React.FC<Props> = ({
  open,
  onClose,
  loading,
  buildings,
  hasWaterNeighbor,
  provinceResourceType,
  userMoney,
  userCompletedResearch,
  pendingBuildTypes,
  techs,
  userResourcesByKey,
  pendingResourceUsage,
  userGoodsById,
  pendingGoodUsage,
  goodNameById,
  builtTypesInProvince,
  onBuild,
}) => {
  return (
    <Dialog open={open} onClose={onClose} maxWidth="xs" fullWidth>
      <DialogTitle>Build options</DialogTitle>
      <DialogContent dividers sx={{ display: 'flex', flexDirection: 'column', gap: 1, overflowY: 'auto', maxHeight: 320 }}>
        {loading && <p>Loading...</p>}
        {!loading && buildings.map((building) => {
          const { passes, reason: disabledReason } = evaluateBuildRequirements(
            building,
            provinceResourceType,
            builtTypesInProvince,
            hasWaterNeighbor,
            {
              userMoney,
              completedResearch: userCompletedResearch,
              userResourcesByKey,
              pendingResourceUsage,
              userGoodsById,
              pendingGoodUsage,
              goodNameById,
              techs,
            },
          );

          return (
            <Tooltip key={building.id} title={
              <>
                <p>Cost: {building.cost}</p>
                {building.modifier && <p>Modifier: {building.modifier}</p>}
                {building.income != null && building.income > 0 && <p>Income: {building.income}</p>}
                {building.upkeep != null && building.upkeep > 0 && <p>Upkeep: {building.upkeep}</p>}
                {building.description != null && <p>Description: {building.description}</p>}
                {disabledReason && <p style={{ color: '#ffb3b3' }}>{disabledReason}</p>}
              </>
            }>
              <span>
                <Button
                  fullWidth
                  variant="contained"
                  color="primary"
                  disabled={!passes || pendingBuildTypes.has(building.type)}
                  onClick={() => onBuild(building.id)}
                  startIcon={<span>{BUILDING_ICONS[building.type] ?? '🏗️'}</span>}
                >
                  {building.name}
                </Button>
              </span>
            </Tooltip>
          );
        })}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
      </DialogActions>
    </Dialog>
  );
};
