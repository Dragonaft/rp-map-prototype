import React, { useCallback, useEffect, useRef, useState } from 'react';
import { AppBar, Box, Button, IconButton, Modal, Toolbar, Typography } from "@mui/material";
import { MapView } from "../../components/MapView.tsx";
import { useAuth } from "../../context/AuthContext.tsx";
import { useQuery } from "../../hooks/useApi.ts";
import { usersApi } from "../../api/users.ts";
import { useAppDispatch } from "../../store/hooks.ts";
import { setUser } from "../../store/slices/userSlice.ts";
import { provincesApi } from "../../api/provinces.ts";
import { setProvinces } from "../../store/slices/provincesSlice.ts";

function MenuIcon() {
  return null;
}

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
  const fetchUser = useCallback(() => usersApi.getOne(authUser!.userId), []);
  const { data: userData } = useQuery(fetchUser);
  const dispatch = useAppDispatch();
  const [openIsNewModal, setOpenIsNewModal] = useState(false);
  const fetchProvinces = useCallback(() => provincesApi.getAll(), []);
  const { data: provinces, loading, error } = useQuery(fetchProvinces, []);

  useEffect(() => {
    if (!userData) return;

    setOpenIsNewModal(userData.isNew)
    dispatch(setUser(userData));
  }, [userData, fetchUser]);

  useEffect(() => {
    dispatch(setProvinces(provinces))
  }, [provinces]);

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
      <AppBar position="static">
        <Toolbar>
          <IconButton
            size="large"
            edge="start"
            color="inherit"
            aria-label="menu"
            sx={{ mr: 2 }}
          >
            <MenuIcon />
          </IconButton>
          <Typography variant="h6" component="div" sx={{ flexGrow: 1 }}>
            News
          </Typography>
          <Button color="inherit">Login</Button>
        </Toolbar>
      </AppBar>
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
