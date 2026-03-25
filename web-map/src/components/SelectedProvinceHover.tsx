import { useAppSelector, useAppDispatch } from "../store/hooks.ts";
import { selectSelectedProvince, updateProvinceById } from "../store/slices/provincesSlice.ts";
import { setUser } from "../store/slices/userSlice.ts";
import type { RootState } from "../store/store.ts";
import { Button } from "@mui/material";
import { useMutation } from "../hooks/useApi.ts";
import { provincesApi } from "../api/provinces.ts";

export const SelectedProvinceHover = () => {
  const dispatch = useAppDispatch();
  const selectedProvince = useAppSelector(selectSelectedProvince);
  const user = useAppSelector((state: RootState) => state.user);
  const { mutate } = useMutation(provincesApi.setupUser);

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
      }));
    }

    if (response?.province) {
      dispatch(updateProvinceById({
        id: response.province.id,
        updates: {
          localTroops: response.province.local_troops,
          userId: response.province.user_id,
        },
      }));
    }
  };

  if (!selectedProvince) return null;

  return (
    <div className="w-60 h-80 p-2 bg-white absolute right-1 top-1">
      {user.isNew ? (
        <div className="flex flex-col justify-between h-full">
          <div>
            <span>Province Data</span>
            <p>Landscape: {selectedProvince.landscape}</p>
            <p>Resource: {selectedProvince.resourceType}</p>
            <p>Type: {selectedProvince.type}</p>
          </div>
          <Button variant="contained" color="primary" onClick={handleOnSetupSelect}>SELECT</Button>
        </div>
      ) : (
        <div></div>
      )}
    </div>
  );
};
