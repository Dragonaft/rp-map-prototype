import { useAppDispatch, useAppSelector } from "../store/hooks.ts";
import { selectSelectedProvince, updateProvinceById } from "../store/slices/provincesSlice.ts";
import { setUser } from "../store/slices/userSlice.ts";
import type { RootState } from "../store/store.ts";
import { Box, Button, Slider, Tooltip } from "@mui/material";
import { useMutation, useQuery } from "../hooks/useApi.ts";
import { provincesApi } from "../api/provinces.ts";
import { useCallback, useEffect, useState } from "react";
import { buildingsApi } from "../api/buildings.ts";
import { ActionType, Building } from "../types.ts";
import { actionsApi } from "../api/actions.ts";
import { addAction } from "../store/slices/actionsSlice.ts";

export const SelectedProvinceHover = () => {
  const dispatch = useAppDispatch();
  const selectedProvince = useAppSelector(selectSelectedProvince);
  const user = useAppSelector((state: RootState) => state.user);
  const otherUsers = useAppSelector((state: RootState) => state.otherUsers.otherUsers);
  const { mutate } = useMutation(provincesApi.setupUser);
  const isUserOwner = user.id === selectedProvince?.userId;
  const [isOpenBuildMenu, setIsOpenBuildMenu] = useState<boolean>(false);
  const [isOpenDeployMenu, setIsOpenDeployMenu] = useState<boolean>(false);
  const [buildingsState, setBuildingsState] = useState<Building[]>([]);
  const fetchBuildings = useCallback(() => buildingsApi.getAll(), []);
  const { data: buildings, loading } = useQuery(fetchBuildings, []);
  const [troopCount, setTroopCount] = useState<number>(0);

  console.log(selectedProvince, 'PROV')

  useEffect(() => {
    if (buildings) {
      setBuildingsState(buildings);
    }
  }, [buildings]);

  useEffect(() => {
    setIsOpenBuildMenu(false);
    setIsOpenDeployMenu(false);
    setTroopCount(0);
  }, [selectedProvince]);

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
  const BuildMenu = () => (
    <div className="flex flex-col justify-between h-full">
      {loading && <p>Loading...</p>}
      <div className="flex flex-col gap-2">
        <h2 className="font-headline text-sm font-bold tracking-widest text-on-surface uppercase text-center">Build options</h2>
        {!loading && buildingsState.map((building) => (
          <Tooltip title={
            <>
              <p>Cost: {building.cost}</p>
              {building.modifier && <p>Modifier: {building.modifier}</p>}
              {building.income && <p>Income: {building.income}</p>}
              {building.upkeep && <p>Upkeep: {building.upkeep}</p>}
            </>
          }>
            <Button
              key={building.id}
              variant="contained"
              color="primary"
              disabled={!user.money || user.money < building.cost}
              onClick={() => handleBuildAction(building.id)}
            >
              {building.name}
            </Button>
          </Tooltip>
        ))}
      </div>
      <Button variant="contained" color="primary" onClick={() => setIsOpenBuildMenu(false)}>BACK</Button>
    </div>
  )

  if (!selectedProvince) return null;

  return (
    <div className="w-60 h-80 glass-panel rounded-lg border border-outline-variant/10 p-5 flex flex-col flex-1 absolute right-5 top-4">
      {user.isNew && (
        <div className="flex flex-col justify-between h-full">
          <div>
            <h2 className="font-headline text-sm font-bold tracking-widest text-on-surface uppercase text-center">Province Data</h2>
            <p>Landscape: {selectedProvince.landscape}</p>
            <p>Resource: {selectedProvince.resourceType}</p>
            <p>Type: {selectedProvince.type}</p>
          </div>
          <Button variant="contained" color="primary" onClick={handleOnSetupSelect}>SELECT</Button>
        </div>
      )}

      {!user.isNew && !isUserOwner && (
        <div className="flex flex-col justify-between h-full">
          <div>
            <h2 className="font-headline text-sm font-bold tracking-widest text-on-surface uppercase text-center">Province Data</h2>
            <p>Landscape: {selectedProvince.landscape}</p>
            <p>Resource: {selectedProvince.resourceType}</p>
            {handleGetProvinceOwner() && <p>Owner: {handleGetProvinceOwner()?.countryName}</p>}
          </div>
        </div>
      )}

      {!user.isNew && isUserOwner && (
        <div className="flex flex-col justify-between h-full">
          {isOpenDeployMenu && <DeployMenu />}
          {isOpenBuildMenu && <BuildMenu />}
          {!isOpenDeployMenu && !isOpenBuildMenu &&
          <>
            <div>
              <h2 className="font-headline text-sm font-bold tracking-widest text-on-surface uppercase text-center">Province Data</h2>
              <p>Landscape: {selectedProvince.landscape}</p>
              <p>Resource: {selectedProvince.resourceType}</p>
              <p>Local buildings: </p>
              {selectedProvince && selectedProvince.buildings && selectedProvince.buildings.map((building) => (
                <span key={building.id}>{building.name}</span>
              ))}
            </div>
            <div className="flex flex-col gap-2">
              <Button variant="contained" color="primary" onClick={() => setIsOpenDeployMenu(true)}>DEPLOY TROOPS</Button>
              <Button variant="contained" color="primary" onClick={() => setIsOpenBuildMenu(true)}>BUILD</Button>
            </div>
          </>
          }
        </div>
      )}
    </div>
  );
};
