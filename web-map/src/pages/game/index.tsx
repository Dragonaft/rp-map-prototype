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
  const [isMapHovered, setIsMapHovered] = useState(false);
  const { user: authUser } = useAuth();
  const dispatch = useAppDispatch();
  const [openIsNewModal, setOpenIsNewModal] = useState(false);

  // TODO: Fix auth context and this abomination
  const userId = authUser?.userId || authUser?.id || "";
  const fetchUser = useCallback(() => usersApi.getOne(userId), [userId]);
  const { data: userData } = useQuery(fetchUser);
  const fetchOtherUsers = useCallback(() => usersApi.getAll(), []);
  const { data: otherUsersData } = useQuery(fetchOtherUsers);
  const fetchProvinces = useCallback(() => provincesApi.getAll(), []);
  const { data: provinces, loading, error } = useQuery(fetchProvinces, []);

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
    const handleWheel = (e: WheelEvent) => {
      if (isMapHovered && e.ctrlKey) {
        e.preventDefault();
      }
    };

    // Prevent browser zoom when hovering over map
    document.addEventListener('wheel', handleWheel, { passive: false });

    return () => {
      document.removeEventListener('wheel', handleWheel);
    };
  }, [isMapHovered]);

  return (
    <div>
      <Modal
        open={openIsNewModal}
        aria-labelledby="modal-modal-title"
        aria-describedby="modal-modal-description"
      >
        <Box sx={style}>
          <Typography id="modal-modal-title" variant="h6" component="h2">
            Welcome to the game!
          </Typography>
          <Typography id="modal-modal-description" sx={{ mt: 2 }}>
            This is welcome window! After pressing Select chose starting province!
          </Typography>
          <Button variant="contained" color="primary" onClick={() => setOpenIsNewModal(false)}>
            Select
          </Button>
        </Box>
      </Modal>
      <TopBar />
      <div
        ref={mapContainerRef}
        onMouseEnter={() => setIsMapHovered(true)}
        onMouseLeave={() => setIsMapHovered(false)}
      >
        <MapView
          loading={loading}
          error={error}
        />
      </div>
    </div>
  );
};
