import { useAppDispatch, useAppSelector } from "../store/hooks.ts";
import { selectSelectedProvince, updateProvinceById } from "../store/slices/provincesSlice.ts";
import { setUser } from "../store/slices/userSlice.ts";
import type { RootState } from "../store/store.ts";
import { Box, Button, Dialog, DialogActions, DialogContent, DialogTitle, Slider, Tooltip } from "@mui/material";
import { useMutation, useQuery } from "../hooks/useApi.ts";
import { provincesApi } from "../api/provinces.ts";
import { useCallback, useEffect, useMemo, useState } from "react";
import { buildingsApi } from "../api/buildings.ts";
import { ActionType, Building, BuildingTypes } from "../types.ts";
import { actionsApi } from "../api/actions.ts";
import { addAction, removeActionById } from "../store/slices/actionsSlice.ts";
import { BUILDING_ICONS } from "../constants/buildingIcons.ts";

const RESOURCE_BUILDING_REQUIREMENTS: Partial<Record<BuildingTypes, string[]>> = {
  [BuildingTypes.MINE]: ['iron', 'gold', 'stone'],
  [BuildingTypes.FORESTRY]: ['wood'],
  [BuildingTypes.FARM]: ['grain'],
};

export const SelectedProvinceHover = () => {
  const dispatch = useAppDispatch();
  const selectedProvince = useAppSelector(selectSelectedProvince);
  const user = useAppSelector((state: RootState) => state.user);
  const otherUsers = useAppSelector((state: RootState) => state.otherUsers.otherUsers);
  const actions = useAppSelector((state: RootState) => state.actions.actions);
  const { mutate } = useMutation(provincesApi.setupUser);
  const isUserOwner = user.id === selectedProvince?.userId;
  const [isOpenBuildMenu, setIsOpenBuildMenu] = useState<boolean>(false);
  const [isOpenDeployMenu, setIsOpenDeployMenu] = useState<boolean>(false);
  const [buildingsState, setBuildingsState] = useState<Building[]>([]);
  const fetchBuildings = useCallback(() => buildingsApi.getAll(), []);
  const { data: buildings, loading } = useQuery(fetchBuildings, []);
  const [troopCount, setTroopCount] = useState<number>(0);
  const [deleteTarget, setDeleteTarget] = useState<Building | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [cancelPendingTarget, setCancelPendingTarget] = useState<{ id: string; type: string } | null>(null);
  const [isCancelling, setIsCancelling] = useState(false);

  useEffect(() => {
    if (buildings) {
      const buildingsWithoutCapital = buildings.filter(building => building.type !== BuildingTypes.CAPITAL);
      setBuildingsState(buildingsWithoutCapital);
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

  const handleGetProvinceOwner = () => {
   return otherUsers.find((user) => user.id === selectedProvince?.userId);
  }

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
        researchPoints: response.user.researchPoints
      }));
    }

    if (response?.province) {
      dispatch(updateProvinceById({
        id: response.province.id,
        updates: {
          ...response?.province,
        },
      }));
    }
  };

  const handleBuildAction = async (buildingId: string) => {
    if (!selectedProvince || !user.id) return;

    try {
      const response = await actionsApi.createAction({
        type: ActionType.BUILD,
        actionData: {
          province_id: selectedProvince.id,
          building_id: buildingId,
        },
      });

      dispatch(addAction(response));
    } catch (err: any) {
      console.log(err.response?.data?.message || 'Failed to create action');
    }
  }

  const handleCancelBuildAction = async () => {
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
        actionData: {
          province_id: selectedProvince.id,
          building_id: deleteTarget.id,
        },
      });
      dispatch(addAction(response));
      setDeleteTarget(null);
    } catch (err: any) {
      console.log(err.response?.data?.message || 'Failed to create remove action');
    } finally {
      setIsDeleting(false);
    }
  };

  const handleDeployAction = async () => {
    if (!selectedProvince || !user.id) return;

    try {
      const response = await actionsApi.createAction({
        type: ActionType.DEPLOY,
        actionData: {
          province_id: selectedProvince.id,
          troops_number: troopCount,
        },
      });

      dispatch(addAction(response));
    } catch (err: any) {
      console.log(err.response?.data?.message || 'Failed to create action');
    }
  }

  const handleSliderChange = (_event: Event, newValue: number | number[]) => {
    setTroopCount(newValue as number);
  };

  const DeployMenu = () => (
    <div className="flex flex-col justify-between h-full">
      <div className="flex flex-col gap-2">
        <h2 className="font-headline text-sm font-bold tracking-widest text-on-surface uppercase text-center">Reserve troops</h2>
        <p>Troops deploy</p>
        <Box sx={{ px: 2 }}>
          <Slider
            value={troopCount}
            onChange={handleSliderChange}
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
  )

  const builtInProvince = selectedProvince?.buildings ?? [];
  const usedSlots = builtInProvince.length + pendingBuildActionsInProvince.length;
  const emptySlotCount = Math.max(0, (selectedProvince?.buildingCap ?? 0) - usedSlots);

  if (!selectedProvince) return null;

  return (
    <div className="w-60 h-80 bg-gray-400 rounded-lg border border-outline-variant/10 p-5 flex flex-col flex-1 absolute right-5 top-4">
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

      {!user.isNew && !isUserOwner && (
        <div className="flex flex-col justify-between h-full">
          <div>
            <h2 className="font-headline text-sm font-bold tracking-widest text-on-surface uppercase text-center">Province Data</h2>
            <p>Landscape: {selectedProvince.landscape}</p>
            <p>Resource: {selectedProvince.resourceType}</p>
            {handleGetProvinceOwner() && <p>Owner: {handleGetProvinceOwner()?.countryName}</p>}
            {builtInProvince.length > 0 && (
              <div className="flex flex-wrap gap-1 mt-2">
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
          </div>
        </div>
      )}

      {!user.isNew && isUserOwner && (
        <div className="flex flex-col justify-between h-full">
          {isOpenDeployMenu && <DeployMenu />}
          {!isOpenDeployMenu &&
          <>
            <div>
              <h2 className="font-headline text-sm font-bold tracking-widest text-on-surface uppercase text-center">Province Data</h2>
              <p>Landscape: {selectedProvince.landscape}</p>
              <p>Resource: {selectedProvince.resourceType}</p>
              <div className="flex flex-wrap gap-1 mt-2">
                {/* Built buildings */}
                {builtInProvince.map((b) => {
                  const hasPendingRemove = pendingRemoveBuildingIds.has(b.id);
                  const removeAction = hasPendingRemove
                    ? pendingRemoveActionsInProvince.find(a => a.buildingId === b.id)
                    : null;
                  return (
                    <button
                      key={b.id}
                      className={`w-10 h-10 text-lg border rounded flex items-center justify-center ${
                        b.type === BuildingTypes.CAPITAL
                          ? 'border-gray-600 bg-gray-200 cursor-default'
                          : hasPendingRemove
                            ? 'border-red-500 bg-red-200/50 hover:bg-red-300/50 cursor-pointer'
                            : 'border-gray-600 bg-gray-200 hover:bg-red-100 cursor-pointer'
                      }`}
                      onClick={() => {
                        if (b.type === BuildingTypes.CAPITAL) return;
                        if (hasPendingRemove && removeAction) {
                          setCancelPendingTarget({ id: removeAction.id, type: b.type });
                        } else {
                          setDeleteTarget(b);
                        }
                      }}
                      title={hasPendingRemove ? 'Queued for removal — click to cancel' : b.name}
                    >
                      {BUILDING_ICONS[b.type] ?? '🏗️'}
                    </button>
                  );
                })}
                {/* Pending build slots */}
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
                {/* Empty slots */}
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
            <div className="flex flex-col gap-2">
              <Button variant="contained" color="primary" onClick={() => setIsOpenDeployMenu(true)}>DEPLOY TROOPS</Button>
            </div>
          </>
          }
        </div>
      )}

      {/* Build menu dialog */}
      <Dialog open={isOpenBuildMenu} onClose={() => setIsOpenBuildMenu(false)} maxWidth="xs" fullWidth>
        <DialogTitle>Build options</DialogTitle>
        <DialogContent dividers sx={{ display: 'flex', flexDirection: 'column', gap: 1, overflowY: 'auto', maxHeight: 320 }}>
          {loading && <p>Loading...</p>}
          {!loading && buildingsState.map((building) => {
            const resourceRequirement = RESOURCE_BUILDING_REQUIREMENTS[building.type as BuildingTypes];
            const resourceMismatch = resourceRequirement
              ? !resourceRequirement.includes(selectedProvince.resourceType)
              : false;
            const disabledReason = resourceMismatch
              ? `Requires a province with ${resourceRequirement!.join(' or ')} resource (this province: ${selectedProvince.resourceType || 'none'})`
              : null;

            return (
              <Tooltip key={building.id} title={
                <>
                  <p>Cost: {building.cost}</p>
                  {building.modifier && <p>Modifier: {building.modifier}</p>}
                  {building.income && <p>Income: {building.income}</p>}
                  {building.upkeep && <p>Upkeep: {building.upkeep}</p>}
                  {disabledReason && <p style={{ color: '#ffb3b3' }}>{disabledReason}</p>}
                </>
              }>
                <span>
                  <Button
                    fullWidth
                    variant="contained"
                    color="primary"
                    disabled={
                      !user.money || user.money < building.cost ||
                      pendingBuildTypesInProvince.has(building.type) ||
                      resourceMismatch
                    }
                    onClick={() => { handleBuildAction(building.id); setIsOpenBuildMenu(false); }}
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
          <Button onClick={() => setIsOpenBuildMenu(false)}>Cancel</Button>
        </DialogActions>
      </Dialog>

      {/* Cancel pending action dialog (build or remove) */}
      <Dialog open={!!cancelPendingTarget} onClose={() => !isCancelling && setCancelPendingTarget(null)}>
        <DialogTitle>Cancel Action</DialogTitle>
        <DialogContent>
          <p>Are you sure you want to cancel this action?</p>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setCancelPendingTarget(null)} disabled={isCancelling}>No</Button>
          <Button color="error" onClick={handleCancelBuildAction} disabled={isCancelling}>
            {isCancelling ? 'Cancelling...' : 'Yes'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Delete building confirmation dialog */}
      <Dialog open={!!deleteTarget} onClose={() => !isDeleting && setDeleteTarget(null)}>
        <DialogTitle>Delete Building</DialogTitle>
        <DialogContent>
          <p>Are you sure you want to queue removal of <strong>{deleteTarget?.name}</strong>?</p>
          <p style={{ color: '#888', fontSize: '0.85em', marginTop: 4 }}>Cost: 100 money</p>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteTarget(null)} disabled={isDeleting}>Cancel</Button>
          <Button color="error" onClick={handleDeleteAction} disabled={isDeleting}>
            {isDeleting ? 'Queuing...' : 'Delete'}
          </Button>
        </DialogActions>
      </Dialog>
    </div>
  );
};
