import { useAppDispatch, useAppSelector } from "../store/hooks.ts";
import { selectSelectedProvince, updateProvinceById } from "../store/slices/provincesSlice.ts";
import { setUser } from "../store/slices/userSlice.ts";
import type { RootState } from "../store/store.ts";
import { Box, Button, Slider } from "@mui/material";
import { useMutation, useQuery } from "../hooks/useApi.ts";
import { provincesApi } from "../api/provinces.ts";
import { useCallback, useEffect, useMemo, useState } from "react";
import { buildingsApi } from "../api/buildings.ts";
import { ActionType, Army, Building, BuildingTypes, RESOURCE_BUILDING_REQUIREMENTS } from "../types.ts";
import { actionsApi } from "../api/actions.ts";
import { addAction, removeActionById } from "../store/slices/actionsSlice.ts";
import { BUILDING_ICONS } from "../constants/buildingIcons.ts";
import { BuildMenuModal } from "./Modals/BuildMenuModal.tsx";
import { BuildingActionsModal } from "./Modals/BuildingActionsModal.tsx";
import { CancelActionModal } from "./Modals/CancelActionModal.tsx";
import { DeleteBuildingModal } from "./Modals/DeleteBuildingModal.tsx";

interface Props {
  onSelectArmy?: (armyId: string | null) => void;
  onCreateArmy?: () => void;
  selectedArmyId?: string | null;
}

export const SelectedProvinceHover = ({ onSelectArmy, onCreateArmy, selectedArmyId }: Props) => {
  const dispatch = useAppDispatch();
  const selectedProvince = useAppSelector(selectSelectedProvince);
  const user = useAppSelector((state: RootState) => state.user);
  const otherUsers = useAppSelector((state: RootState) => state.otherUsers.otherUsers);
  const actions = useAppSelector((state: RootState) => state.actions.actions);
  const techs = useAppSelector((state: RootState) => state.techs.techs);
  const armies = useAppSelector((state: RootState) => state.armies.armies);
  const { mutate } = useMutation(provincesApi.setupUser);
  const isUserOwner = user.id === selectedProvince?.userId;

  const [isOpenBuildMenu, setIsOpenBuildMenu] = useState(false);
  const [isOpenDeployMenu, setIsOpenDeployMenu] = useState(false);
  const [buildingsState, setBuildingsState] = useState<Building[]>([]);
  const [troopCount, setTroopCount] = useState(0);
  const [deleteTarget, setDeleteTarget] = useState<Building | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [actionSelectTarget, setActionSelectTarget] = useState<Building | null>(null);
  const [isUpgrading, setIsUpgrading] = useState(false);
  const [cancelPendingTarget, setCancelPendingTarget] = useState<{ id: string; type: string } | null>(null);
  const [isCancelling, setIsCancelling] = useState(false);

  const fetchBuildings = useCallback(() => buildingsApi.getAll(), []);
  const { data: buildings, loading } = useQuery(fetchBuildings, []);

  useEffect(() => {
    if (buildings) {
      setBuildingsState(buildings.filter(b => b.type !== BuildingTypes.CAPITAL));
    }
  }, [buildings]);

  useEffect(() => {
    setIsOpenBuildMenu(false);
    setIsOpenDeployMenu(false);
    setTroopCount(0);
  }, [selectedProvince]);

  const buildingById = useMemo(() =>
    buildingsState.reduce<Record<string, Building>>((acc, b) => { acc[b.id] = b; return acc; }, {}),
    [buildingsState],
  );

  const pendingBuildActionsInProvince = useMemo(() => {
    if (!actions.length || !selectedProvince) return [];
    return actions
      .filter(a => a.actionType === ActionType.BUILD &&
        (a.actionData?.province_id ?? a.actionData?.provinceId) === selectedProvince.id)
      .map(a => ({
        id: a.id,
        type: buildingById[a.actionData?.building_id ?? a.actionData?.buildingId]?.type ?? '',
      }))
      .filter(a => a.type);
  }, [actions, selectedProvince, buildingById]);

  const pendingBuildTypesInProvince = useMemo(
    () => new Set(pendingBuildActionsInProvince.map(a => a.type)),
    [pendingBuildActionsInProvince],
  );

  const pendingRemoveActionsInProvince = useMemo(() => {
    if (!actions.length || !selectedProvince) return [];
    return actions
      .filter(a => a.actionType === ActionType.REMOVE &&
        (a.actionData?.province_id ?? a.actionData?.provinceId) === selectedProvince.id)
      .map(a => ({
        id: a.id,
        buildingId: (a.actionData?.building_id ?? a.actionData?.buildingId) as string,
      }))
      .filter(a => a.buildingId);
  }, [actions, selectedProvince]);

  const pendingRemoveBuildingIds = useMemo(
    () => new Set(pendingRemoveActionsInProvince.map(a => a.buildingId)),
    [pendingRemoveActionsInProvince],
  );

  const pendingUpgradeActionsInProvince = useMemo(() => {
    if (!actions.length || !selectedProvince) return [];
    return actions
      .filter(a => a.actionType === ActionType.UPGRADE &&
        (a.actionData?.province_id ?? a.actionData?.provinceId) === selectedProvince.id)
      .map(a => ({
        id: a.id,
        buildingId: (a.actionData?.building_id ?? a.actionData?.buildingId) as string,
      }))
      .filter(a => a.buildingId);
  }, [actions, selectedProvince]);

  const pendingUpgradeBuildingIds = useMemo(
    () => new Set(pendingUpgradeActionsInProvince.map(a => a.buildingId)),
    [pendingUpgradeActionsInProvince],
  );

  const upgradeBuildingForTarget = useMemo(() => {
    if (!actionSelectTarget?.upgradeTo) return null;
    return buildingsState.find(b => b.type === actionSelectTarget.upgradeTo) ?? null;
  }, [actionSelectTarget, buildingsState]);

  const upgradeDisabledReason = useMemo(() => {
    if (!upgradeBuildingForTarget) return null;
    const cost = (upgradeBuildingForTarget.cost ?? 0) + 100;
    if (!user.money || user.money < cost) {
      return `Not enough money (need ${cost}, have ${user.money ?? 0})`;
    }
    const resourceRequirement = RESOURCE_BUILDING_REQUIREMENTS[upgradeBuildingForTarget.type as BuildingTypes];
    if (resourceRequirement && selectedProvince && !resourceRequirement.includes(selectedProvince.resourceType)) {
      return `Requires a province with ${resourceRequirement.join(' or ')} resource (this province: ${selectedProvince.resourceType || 'none'})`;
    }
    const missing = (upgradeBuildingForTarget.requirementTech ?? []).find(
      t => !user.completedResearch.includes(t),
    );
    if (missing) {
      const techName = techs.find(t => t.key === missing)?.name ?? missing;
      return `Missing required technology: ${techName}`;
    }
    return null;
  }, [upgradeBuildingForTarget, user.money, user.completedResearch, techs, selectedProvince]);

  const directlyBuildableBuildings = useMemo(
    () => buildingsState.filter(b => !b.requirementBuilding),
    [buildingsState],
  );

  const isNeighborOfUser = useMemo(() => {
    if (!selectedProvince?.neighbors) return false;
    const userProvinceIds = new Set(user.provinces.map(p => p.id));
    return selectedProvince.neighbors.some(nId => userProvinceIds.has(nId));
  }, [selectedProvince, user.provinces]);

  const pendingColonizeAction = useMemo(
    () => selectedProvince
      ? actions.find(a => a.actionType === ActionType.COLONIZE && a.actionData?.province_id === selectedProvince.id)
      : undefined,
    [actions, selectedProvince],
  );

  // --- Handlers ---

  const handleOnSetupSelect = async () => {
    if (!selectedProvince) return;
    const response = await mutate(selectedProvince.id);
    if (response?.user) {
      dispatch(setUser({
        id: response.user.id,
        login: response.user.login,
        countryName: response.user.country_name,
        color: response.user.color,
        money: response.user.money,
        troops: response.user.troops,
        isNew: response.user.is_new,
        provinces: response.user.provinces,
        completedResearch: [],
        researchPoints: response.user.researchPoints,
        piety: 0,
        class: null,
        projectedIncome: response.user.projectedIncome,
        projectedPiety: response.user.projectedPiety,
        projectedResearch: response.user.projectedResearch,
        projectedTroops: response.user.projectedTroops,
        resources: response.user.resources,
      }));
    }
    if (response?.province) {
      dispatch(updateProvinceById({ id: response.province.id, updates: { ...response.province } }));
    }
  };

  const handleBuildAction = async (buildingId: string) => {
    if (!selectedProvince || !user.id) return;
    try {
      const response = await actionsApi.createAction({
        type: ActionType.BUILD,
        actionData: { province_id: selectedProvince.id, building_id: buildingId },
      });
      dispatch(addAction(response));
    } catch (err: any) {
      console.log(err.response?.data?.message || 'Failed to create action');
    }
  };

  const handleColonize = async () => {
    if (!selectedProvince) return;
    const response = await actionsApi.createAction({
      type: ActionType.COLONIZE,
      actionData: { province_id: selectedProvince.id },
    });
    dispatch(addAction(response));
  };

  const handleCancelColonize = async (actionId: string) => {
    await actionsApi.removeAction(actionId);
    dispatch(removeActionById(actionId));
  };

  const handleCancelAction = async () => {
    if (!cancelPendingTarget) return;
    setIsCancelling(true);
    try {
      await actionsApi.removeAction(cancelPendingTarget.id);
      dispatch(removeActionById(cancelPendingTarget.id));
      setCancelPendingTarget(null);
    } catch (err: any) {
      console.log(err.response?.data?.message || 'Failed to cancel action');
    } finally {
      setIsCancelling(false);
    }
  };

  const handleDeleteAction = async () => {
    if (!deleteTarget || !selectedProvince) return;
    setIsDeleting(true);
    try {
      const response = await actionsApi.createAction({
        type: ActionType.REMOVE,
        actionData: { province_id: selectedProvince.id, building_id: deleteTarget.id },
      });
      dispatch(addAction(response));
      setDeleteTarget(null);
    } catch (err: any) {
      console.log(err.response?.data?.message || 'Failed to create remove action');
    } finally {
      setIsDeleting(false);
    }
  };

  const handleUpgradeAction = async () => {
    if (!actionSelectTarget || !selectedProvince) return;
    setIsUpgrading(true);
    try {
      const response = await actionsApi.createAction({
        type: ActionType.UPGRADE,
        actionData: { province_id: selectedProvince.id, building_id: actionSelectTarget.id },
      });
      dispatch(addAction(response));
      setActionSelectTarget(null);
    } catch (err: any) {
      console.log(err.response?.data?.message || 'Failed to create upgrade action');
    } finally {
      setIsUpgrading(false);
    }
  };

  const handleDeployAction = async () => {
    if (!selectedProvince || !user.id) return;
    try {
      const response = await actionsApi.createAction({
        type: ActionType.DEPLOY,
        actionData: { province_id: selectedProvince.id, troops_number: troopCount },
      });
      dispatch(addAction(response));
    } catch (err: any) {
      console.log(err.response?.data?.message || 'Failed to create action');
    }
  };

  const handleBuiltBuildingClick = (b: Building) => {
    if (b.type === BuildingTypes.CAPITAL) return;
    const template = buildingById[b.id] ?? b;

    if (pendingRemoveBuildingIds.has(b.id)) {
      const action = pendingRemoveActionsInProvince.find(a => a.buildingId === b.id)!;
      setCancelPendingTarget({ id: action.id, type: b.type });
      return;
    }
    if (pendingUpgradeBuildingIds.has(b.id)) {
      const action = pendingUpgradeActionsInProvince.find(a => a.buildingId === b.id)!;
      setCancelPendingTarget({ id: action.id, type: b.type });
      return;
    }
    if (template.upgradeTo) {
      setActionSelectTarget(template);
    } else {
      setDeleteTarget(b);
    }
  };

  const builtInProvince = selectedProvince?.buildings ?? [];
  const usedSlots = builtInProvince.length + pendingBuildActionsInProvince.length;
  const emptySlotCount = Math.max(0, (selectedProvince?.buildingCap ?? 0) - usedSlots);
  const provinceOwner = otherUsers.find(u => u.id === selectedProvince?.userId);

  const armiesInProvince = useMemo(() => {
    if (!selectedProvince) return [];
    return armies.filter((a) => a.province_id === selectedProvince.id);
  }, [armies, selectedProvince]);

  const pendingCreateArmyActions = useMemo(() => {
    if (!selectedProvince) return [];
    return actions.filter(
      (a) => a.actionType === ActionType.ARMY_CREATE &&
        (a.actionData?.province_id ?? a.actionData?.provinceId) === selectedProvince.id,
    );
  }, [actions, selectedProvince]);

  const pendingDisbandArmyIds = useMemo(
    () => new Set(
      actions
        .filter((a) => a.actionType === ActionType.ARMY_DISBAND)
        .map((a) => a.actionData?.army_id as string)
        .filter(Boolean),
    ),
    [actions],
  );

  const armyTotalTroops = (army: Army) => army.units.reduce((s, u) => s + u.count, 0);

  if (!selectedProvince) return null;

  const DeployMenu = () => (
    <div className="flex flex-col justify-between h-full">
      <div className="flex flex-col gap-2">
        <h2 className="font-headline text-sm font-bold tracking-widest text-on-surface uppercase text-center">Reserve troops</h2>
        <p>Troops deploy</p>
        <Box sx={{ px: 2 }}>
          <Slider
            value={troopCount}
            onChange={(_e, v) => setTroopCount(v as number)}
            min={1}
            max={user.troops}
            marks
            valueLabelDisplay="on"
            disabled={loading}
          />
        </Box>
        <Button variant="contained" color="primary" onClick={handleDeployAction}>DEPLOY</Button>
      </div>
      <Button variant="contained" color="primary" onClick={() => setIsOpenDeployMenu(false)}>BACK</Button>
    </div>
  );

  return (
    <div className="w-60 bg-gray-400 rounded-lg border border-outline-variant/10 p-5 flex flex-col flex-1 absolute right-5 top-4 max-h-[90vh] overflow-y-auto">

      {/* New user — pick starting province */}
      {user.isNew && (
        <div className="flex flex-col justify-between h-full">
          <div>
            <h2 className="font-headline text-sm font-bold tracking-widest text-on-surface uppercase text-center">Province Data</h2>
            <p>Landscape: {selectedProvince.landscape}</p>
            <p>Resource: {selectedProvince.resourceType}</p>
            <p>Type: {selectedProvince.type}</p>
          </div>
          <Button
            variant="contained"
            color="primary"
            disabled={selectedProvince.type === 'water'}
            onClick={handleOnSetupSelect}
          >
            SELECT
          </Button>
        </div>
      )}

      {/* Non-owner view */}
      {!user.isNew && !isUserOwner && (
        <div className="flex flex-col gap-2">
          <h2 className="font-headline text-sm font-bold tracking-widest text-on-surface uppercase text-center">Province Data</h2>
          <p className="mb-0 mt-1">Landscape: {selectedProvince.landscape}</p>
          <p className="mb-0 mt-1">Resource: {selectedProvince.resourceType}</p>
          {provinceOwner && <p className="mb-0 mt-1">Owner: {provinceOwner.countryName}</p>}
          {builtInProvince.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-1">
              {builtInProvince.map((b) => (
                <div
                  key={b.id}
                  className="w-10 h-10 text-lg border border-gray-400 rounded bg-gray-200/40 flex items-center justify-center cursor-default"
                  title={b.name}
                >
                  {BUILDING_ICONS[b.type] ?? '🏗️'}
                </div>
              ))}
            </div>
          )}
          {(() => {
            const enemyArmies = armies.filter((a) => a.province_id === selectedProvince.id && a.user_id !== user.id);
            if (!enemyArmies.length) return null;
            return (
              <div className="flex flex-col gap-1 mt-1">
                <h3 className="text-xs font-bold uppercase text-gray-600 tracking-wide">Armies</h3>
                {enemyArmies.map((army) => (
                  <div
                    key={army.id}
                    className="w-full text-xs px-2 py-1.5 rounded border border-red-300 bg-red-50 flex items-center justify-between"
                  >
                    <span className="font-medium truncate">⚔ {army.name ?? 'Unknown Army'}</span>
                    {army.totalTroops != null && (
                      <span className="font-bold tabular-nums ml-2 shrink-0">{army.totalTroops}</span>
                    )}
                  </div>
                ))}
              </div>
            );
          })()}

          {!selectedProvince.userId && isNeighborOfUser && (
            <div className="mt-2">
              {pendingColonizeAction ? (
                <div className="flex items-center justify-between text-xs bg-yellow-100 border border-yellow-400 rounded px-2 py-1.5">
                  <span className="text-yellow-800 font-semibold">⏳ Colonization queued</span>
                  <button
                    className="text-yellow-700 underline"
                    onClick={() => void handleCancelColonize(pendingColonizeAction.id)}
                  >
                    Cancel
                  </button>
                </div>
              ) : (
                <Button
                  variant="contained"
                  size="small"
                  color="success"
                  fullWidth
                  disabled={user.money < 500}
                  title={user.money < 500 ? 'Not enough money (need 500)' : 'Colonize this province for 500 gold'}
                  onClick={() => void handleColonize()}
                >
                  Colonize (500 💰)
                </Button>
              )}
            </div>
          )}
        </div>
      )}

      {/* Owner view */}
      {!user.isNew && isUserOwner && (
        <div className="flex flex-col gap-2">
          {isOpenDeployMenu && <DeployMenu />}
          {!isOpenDeployMenu && (
            <>
              <div>
                <h2 className="font-headline text-sm font-bold tracking-widest text-on-surface uppercase text-center">Province Data</h2>
                <p>Landscape: {selectedProvince.landscape}</p>
                <p>Resource: {selectedProvince.resourceType}</p>
                <div className="flex flex-wrap gap-1 mt-2">
                  {builtInProvince.map((b) => {
                    const hasPendingRemove = pendingRemoveBuildingIds.has(b.id);
                    const hasPendingUpgrade = pendingUpgradeBuildingIds.has(b.id);
                    let slotClass = 'border-gray-600 bg-gray-200 hover:bg-red-100 cursor-pointer';
                    if (b.type === BuildingTypes.CAPITAL) {
                      slotClass = 'border-gray-600 bg-gray-200 cursor-default';
                    } else if (hasPendingRemove) {
                      slotClass = 'border-red-500 bg-red-200/50 hover:bg-red-300/50 cursor-pointer';
                    } else if (hasPendingUpgrade) {
                      slotClass = 'border-blue-500 bg-blue-200/50 hover:bg-blue-300/50 cursor-pointer';
                    }
                    const title = hasPendingRemove
                      ? 'Queued for removal — click to cancel'
                      : hasPendingUpgrade
                        ? 'Queued for upgrade — click to cancel'
                        : b.name;
                    return (
                      <button
                        key={b.id}
                        className={`w-10 h-10 text-lg border rounded flex items-center justify-center ${slotClass}`}
                        onClick={() => handleBuiltBuildingClick(b)}
                        title={title}
                      >
                        {BUILDING_ICONS[b.type] ?? '🏗️'}
                      </button>
                    );
                  })}
                  {pendingBuildActionsInProvince.map((a) => (
                    <button
                      key={a.id}
                      className="w-10 h-10 text-lg border border-yellow-500 rounded bg-yellow-50 hover:bg-yellow-100 flex items-center justify-center opacity-60"
                      onClick={() => setCancelPendingTarget(a)}
                      title="Pending — click to cancel"
                    >
                      {BUILDING_ICONS[a.type] ?? '🏗️'}
                    </button>
                  ))}
                  {Array.from({ length: emptySlotCount }).map((_, i) => (
                    <button
                      key={`empty-${i}`}
                      className="w-10 h-10 text-lg border border-dashed border-gray-500 rounded bg-gray-100 hover:bg-gray-200 flex items-center justify-center"
                      onClick={() => setIsOpenBuildMenu(true)}
                    >
                      +
                    </button>
                  ))}
                </div>
              </div>
              {/* Army list */}
              {(armiesInProvince.length > 0 || pendingCreateArmyActions.length > 0) && (
                <div className="flex flex-col gap-1 mt-2">
                  <h3 className="text-xs font-bold uppercase text-gray-600 tracking-wide">Armies</h3>
                  {armiesInProvince.map((army) => {
                    const total = armyTotalTroops(army);
                    const isSelected = selectedArmyId === army.id;
                    const isDisbanding = pendingDisbandArmyIds.has(army.id);
                    return (
                      <button
                        key={army.id}
                        className={`w-full text-left text-xs px-2 py-1.5 rounded border flex items-center justify-between transition-colors ${
                          isSelected
                            ? 'bg-blue-200 border-blue-500'
                            : isDisbanding
                              ? 'bg-red-100 border-red-400 opacity-70'
                              : 'bg-gray-200 border-gray-400 hover:bg-gray-300'
                        }`}
                        onClick={() => onSelectArmy?.(isSelected ? null : army.id)}
                        title={isDisbanding ? 'Disbanding queued' : 'Click to manage army'}
                      >
                        <span className="font-medium truncate">{army.name ?? 'Unnamed Army'}</span>
                        <span className="font-bold tabular-nums ml-2 shrink-0">{total}</span>
                      </button>
                    );
                  })}
                  {pendingCreateArmyActions.map((a) => (
                    <div key={a.id} className="w-full text-xs px-2 py-1.5 rounded border border-green-500 bg-green-50 flex items-center justify-between">
                      <span className="text-green-700 truncate">⏳ {a.actionData?.name ?? 'New Army'} (queued)</span>
                      <button
                        className="text-green-700 underline shrink-0 ml-2"
                        onClick={async () => {
                          try {
                            await actionsApi.removeAction(a.id);
                            dispatch(removeActionById(a.id));
                          } catch { /* ignore */ }
                        }}
                      >Cancel</button>
                    </div>
                  ))}
                </div>
              )}

              <div className="flex flex-col gap-2 mt-2">
                <Button variant="contained" color="primary" size="small" onClick={() => onCreateArmy?.()}>
                  Create Army
                </Button>
              </div>
            </>
          )}
        </div>
      )}

      <BuildMenuModal
        open={isOpenBuildMenu}
        onClose={() => setIsOpenBuildMenu(false)}
        loading={loading}
        buildings={directlyBuildableBuildings}
        provinceResourceType={selectedProvince.resourceType}
        userMoney={user.money}
        userCompletedResearch={user.completedResearch}
        pendingBuildTypes={pendingBuildTypesInProvince}
        techs={techs}
        userResources={user.resources}
        userProvinces={user.provinces}
        onBuild={(id) => { void handleBuildAction(id); setIsOpenBuildMenu(false); }}
      />

      <BuildingActionsModal
        open={!!actionSelectTarget}
        onClose={() => !isUpgrading && setActionSelectTarget(null)}
        upgradeBuildingForTarget={upgradeBuildingForTarget}
        upgradeDisabledReason={upgradeDisabledReason}
        isUpgrading={isUpgrading}
        onRemove={() => { const b = actionSelectTarget!; setActionSelectTarget(null); setDeleteTarget(b); }}
        onUpgrade={handleUpgradeAction}
      />

      <CancelActionModal
        open={!!cancelPendingTarget}
        onClose={() => !isCancelling && setCancelPendingTarget(null)}
        isCancelling={isCancelling}
        onConfirm={handleCancelAction}
      />

      <DeleteBuildingModal
        open={!!deleteTarget}
        onClose={() => !isDeleting && setDeleteTarget(null)}
        buildingName={deleteTarget?.name}
        isDeleting={isDeleting}
        onConfirm={handleDeleteAction}
      />
    </div>
  );
};
