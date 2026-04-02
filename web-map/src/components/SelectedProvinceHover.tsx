import { useAppSelector, useAppDispatch } from "../store/hooks.ts";
import { selectSelectedProvince, updateProvinceById } from "../store/slices/provincesSlice.ts";
import { setUser } from "../store/slices/userSlice.ts";
import type { RootState } from "../store/store.ts";
import { Button } from "@mui/material";
import { useMutation } from "../hooks/useApi.ts";
import { provincesApi } from "../api/provinces.ts";
import { useState } from "react";

export const SelectedProvinceHover = () => {
  const dispatch = useAppDispatch();
  const selectedProvince = useAppSelector(selectSelectedProvince);
  const user = useAppSelector((state: RootState) => state.user);
  const otherUsers = useAppSelector((state: RootState) => state.otherUsers.otherUsers);
  const { mutate } = useMutation(provincesApi.setupUser);
  const isUserOwner = user.id === selectedProvince?.userId;
  const [isOpenBuildMenu, setIsOpenBuildMenu] = useState<boolean>(false);
  const [isOpenDeployMenu, setIsOpenDeployMenu] = useState<boolean>(false);

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

  const DeployMenu = () => (<div></div>)
  const BuildMenu = () => (
    <div>

      <Button variant="contained" color="primary" onClick={() => setIsOpenBuildMenu(false)}>BACK</Button>
    </div>
  )

  if (!selectedProvince) return null;

  return (
    <div className="w-60 h-80 p-2 bg-white absolute right-1 top-1">
      {user.isNew && (
        <div className="flex flex-col justify-between h-full">
          <div>
            <span>Province Data</span>
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
            <span>Province Data</span>
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
              <span>Province Data</span>
              <p>Landscape: {selectedProvince.landscape}</p>
              <p>Resource: {selectedProvince.resourceType}</p>
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
