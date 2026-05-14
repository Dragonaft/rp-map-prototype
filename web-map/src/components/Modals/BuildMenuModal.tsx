import React from 'react';
import { Button, Dialog, DialogActions, DialogContent, DialogTitle, Tooltip } from '@mui/material';
import { Building, BUILDING_RESOURCE_COSTS, BuildingTypes, Province, RESOURCE_BUILDING_REQUIREMENTS, Tech, UserResources } from '../../types.ts';
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
  onBuild,
}) => {
  const existingBuildingCounts = React.useMemo(() => {
    const counts: Partial<Record<BuildingTypes, number>> = {};
    for (const province of userProvinces) {
      for (const b of province.buildings ?? []) {
        const t = b.type as BuildingTypes;
        counts[t] = (counts[t] ?? 0) + 1;
      }
    }
    return counts;
  }, [userProvinces]);

  return (
    <Dialog open={open} onClose={onClose} maxWidth="xs" fullWidth>
      <DialogTitle>Build options</DialogTitle>
      <DialogContent dividers sx={{ display: 'flex', flexDirection: 'column', gap: 1, overflowY: 'auto', maxHeight: 320 }}>
        {loading && <p>Loading...</p>}
        {!loading && buildings.map((building) => {
          const resourceRequirement = RESOURCE_BUILDING_REQUIREMENTS[building.type as BuildingTypes];
          const resourceMismatch = resourceRequirement
            ? !resourceRequirement.includes(provinceResourceType)
            : false;
          const missingTechKey = (building.requirementTech ?? []).find(
            t => !userCompletedResearch.includes(t),
          );
          const missingTechName = missingTechKey
            ? (techs.find(t => t.key === missingTechKey)?.name ?? missingTechKey)
            : null;

          const resourceCost = BUILDING_RESOURCE_COSTS[building.type as BuildingTypes];
          const resourceInsufficient = resourceCost
            ? (existingBuildingCounts[building.type as BuildingTypes] ?? 0) >= (userResources[resourceCost] ?? 0)
            : false;

          const disabledReason = resourceMismatch
            ? `Requires a province with ${resourceRequirement!.join(' or ')} resource (this province: ${provinceResourceType || 'none'})`
            : resourceInsufficient
              ? `Not enough ${resourceCost}: you have ${userResources[resourceCost!] ?? 0} but already have ${existingBuildingCounts[building.type as BuildingTypes] ?? 0} ${building.name}(s)`
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
