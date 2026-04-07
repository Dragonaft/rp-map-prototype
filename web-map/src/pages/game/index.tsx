import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Box, Button, Modal, Typography } from "@mui/material";
import { MapView } from "../../components/MapView.tsx";
import { useAuth } from "../../context/AuthContext.tsx";
import { useQuery } from "../../hooks/useApi.ts";
import { usersApi } from "../../api/users.ts";
import { useAppDispatch } from "../../store/hooks.ts";
import { setUser } from "../../store/slices/userSlice.ts";
import { provincesApi } from "../../api/provinces.ts";
import { setProvinces } from "../../store/slices/provincesSlice.ts";
import { setOtherUsers } from "../../store/slices/otherUsersSlice.ts";
import { TopBar } from "../../components/TopBar.tsx";
import { actionsApi } from "../../api/actions.ts";
import { useActionExecutionReload } from "../../hooks/useActionExecutionReload.ts";
import { setActions } from "../../store/slices/actionsSlice.ts";
import { buildingsApi } from "../../api/buildings.ts";
import { setBuildings } from "../../store/slices/buildingsSlice.ts";


const style = {
  position: 'absolute',
  top: '50%',
  left: '50%',
  transform: 'translate(-50%, -50%)',
  width: 400,
  bgcolor: 'background.paper',
  border: '2px solid #000',
  boxShadow: 24,
  p: 4,
};

export const GamePage: React.FC = () => {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const { user: authUser } = useAuth();
  const dispatch = useAppDispatch();
  useActionExecutionReload();
  const [openIsNewModal, setOpenIsNewModal] = useState(false);

  const userId = authUser?.id || "";
  const fetchUser = useCallback(() => usersApi.getOne(userId), [userId]);
  const { data: userData } = useQuery(fetchUser);
  const fetchOtherUsers = useCallback(() => usersApi.getAll(), []);
  const { data: otherUsersData } = useQuery(fetchOtherUsers);
  const fetchProvinces = useCallback(() => provincesApi.getAll(), []);
  const { data: provinces, loading, error } = useQuery(fetchProvinces, []);
  const fetchUserActions = useCallback(() => actionsApi.getUserActions(), []);
  const { data: actions } = useQuery(fetchUserActions, []);
  const fetchBuildings = useCallback(() => buildingsApi.getAll(), []);
  const { data: buildingsData } = useQuery(fetchBuildings, []);

  useEffect(() => {
    if (!userData) return;

    setOpenIsNewModal(userData.isNew)
    dispatch(setUser(userData));
  }, [userData, dispatch]);

  useEffect(() => {
    if (!otherUsersData) return;

    dispatch(setOtherUsers(otherUsersData));
  }, [otherUsersData, dispatch]);

  useEffect(() => {
    dispatch(setProvinces(provinces))
  }, [provinces, dispatch]);

  useEffect(() => {
    dispatch(setActions(actions))
  }, [actions, dispatch]);

  useEffect(() => {
    if (!buildingsData) return;
    dispatch(setBuildings(buildingsData));
  }, [buildingsData, dispatch]);

  // Prevent browser zoom when Ctrl+wheel anywhere on the page
  useEffect(() => {
    const handleWheel = (e: WheelEvent) => {
      if (e.ctrlKey) {
        e.preventDefault();
      }
    };

    document.addEventListener('wheel', handleWheel, { passive: false });
    return () => document.removeEventListener('wheel', handleWheel);
  }, []);

  return (
    <div>
      <Modal
        open={openIsNewModal}
      >
        <Box sx={style}
          // className="flex flex-col bg-surface-container p-4 rounded border border-outline-variant/10"
        >
          <h1
            className="font-headline text-4xl font-bold tracking-tighter text-primary glow-text-primary uppercase mb-2">
            WELCOME TO THE GAME
          </h1>
          <Typography id="modal-modal-description" sx={{mt: 2}}>
            This is welcome window! After pressing Select chose starting province!
          </Typography>
          <Button
            variant="contained"
            color="primary"
            sx={{mt: 2}}
            className="!w-full !bg-gradient-to-r from-primary to-primary-dim py-4 rounded-lg font-headline font-bold text-on-primary-fixed uppercase tracking-widest text-sm glow-primary hover:opacity-90 active:scale-[0.98] transition-all flex items-center justify-center gap-3"
            onClick={() => setOpenIsNewModal(false)}
          >
            SELECT
          </Button>
        </Box>
      </Modal>
      <TopBar/>
      <div ref={mapContainerRef}>
        <MapView
          loading={loading}
          error={error}
        />
      </div>
    </div>
  );
};
