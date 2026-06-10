import React from 'react';
import { Button, Dialog, DialogActions, DialogContent, DialogTitle, Tooltip } from '@mui/material';
import { Building, Province, Tech, UserResources } from '../../types.ts';
import { BUILDING_ICONS } from '../../constants/buildingIcons.ts';

interface Props {
  open: boolean;
  onClose: () => void;
  loading: boolean;
  buildings: Building[];
  provinceResourceType: string;
  userMoney: number;
  userCompletedResearch: string[];
  pendingBuildTypes: Set<string>;
  techs: Tech[];
  userResources: UserResources;
  userProvinces: Province[];
  pendingResourceUsage: Record<string, number>;
  builtTypesInProvince: Set<string>;
  onBuild: (buildingId: string) => void;
}

export const BuildMenuModal: React.FC<Props> = ({
  open,
  onClose,
  loading,
  buildings,
  provinceResourceType,
  userMoney,
  userCompletedResearch,
  pendingBuildTypes,
  techs,
  userResources,
  userProvinces,
  pendingResourceUsage,
  builtTypesInProvince,
  onBuild,
}) => {
  // Resources committed by all currently built buildings across all user provinces
  const builtResourceUsage = React.useMemo(() => {
    const used: Record<string, number> = {};
    for (const province of userProvinces) {
      for (const b of province.buildings ?? []) {
        if (b.requirementResource && b.requirementResourceAmount) {
          used[b.requirementResource] = (used[b.requirementResource] ?? 0) + b.requirementResourceAmount;
        }
      }
    }
    return used;
  }, [userProvinces]);

  return (
    <Dialog open={open} onClose={onClose} maxWidth="xs" fullWidth>
      <DialogTitle>Build options</DialogTitle>
      <DialogContent dividers sx={{ display: 'flex', flexDirection: 'column', gap: 1, overflowY: 'auto', maxHeight: 320 }}>
        {loading && <p>Loading...</p>}
        {!loading && buildings.map((building) => {
          const allowedResources = building.allowedProvinceResources;
          const resourceMismatch = allowedResources?.length
            ? !allowedResources.includes(provinceResourceType)
            : false;
          const missingTechKey = (building.requirementTech ?? []).find(
            t => !userCompletedResearch.includes(t),
          );
          const missingTechName = missingTechKey
            ? (techs.find(t => t.key === missingTechKey)?.name ?? missingTechKey)
            : null;

          const resourceCost = building.requirementResource;
          const resourceAmount = building.requirementResourceAmount ?? 1;
          const totalResourceUsed = resourceCost
            ? (builtResourceUsage[resourceCost] ?? 0) + (pendingResourceUsage[resourceCost] ?? 0)
            : 0;
          const resourceAvailable = resourceCost
            ? (userResources[resourceCost as keyof UserResources] ?? 0) - totalResourceUsed
            : Infinity;
          const resourceInsufficient = resourceCost ? resourceAvailable < resourceAmount : false;

          const uniqueAlreadyBuilt = building.uniquePerProvince && builtTypesInProvince.has(building.type);

          const disabledReason = resourceMismatch
            ? `Requires a province with ${allowedResources!.join(' or ')} resource (this province: ${provinceResourceType || 'none'})`
            : uniqueAlreadyBuilt
              ? `Only one ${building.name} allowed per province`
              : resourceInsufficient
                ? `Not enough ${resourceCost}: ${userResources[resourceCost as keyof UserResources] ?? 0} total, ${totalResourceUsed} already used, ${Math.max(0, resourceAvailable)} free`
                : missingTechName
                  ? `Missing required technology: ${missingTechName}`
                  : null;

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
                  disabled={
                    !userMoney || userMoney < building.cost ||
                    pendingBuildTypes.has(building.type) ||
                    resourceMismatch ||
                    resourceInsufficient ||
                    uniqueAlreadyBuilt ||
                    !!missingTechKey
                  }
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
