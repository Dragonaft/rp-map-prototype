import { useState } from 'react';
import { Box, Tabs, Tab, AppBar, Toolbar, Typography, Button } from '@mui/material';
import { useAuth } from '../../context/AuthContext';
import { UsersTab } from './UsersTab';
import { BuildingsTab } from './BuildingsTab';
import { ArmiesTab } from './ArmiesTab';
import { TechsTab } from './TechsTab';
import { TroopTypesTab } from './TroopTypesTab';

export const DashboardPage = () => {
  const [tab, setTab] = useState(0);
  const { user, logout } = useAuth();

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '98vh' }}>
      <AppBar position="static">
        <Toolbar>
          <Typography variant="h6" sx={{ flexGrow: 1 }}>
            Admin Panel
          </Typography>
          <Typography variant="body2" sx={{ mr: 2, opacity: 0.8 }}>
            {user?.login}
          </Typography>
          <Button color="inherit" onClick={logout}>
            Logout
          </Button>
        </Toolbar>
      </AppBar>

      <Box sx={{ borderBottom: 1, borderColor: 'divider', bgcolor: 'background.paper' }}>
        <Tabs value={tab} onChange={(_, v) => setTab(v)}>
          <Tab label="Users" />
          <Tab label="Buildings" />
          <Tab label="Armies" />
          <Tab label="Techs" />
          <Tab label="Troop Types" />
        </Tabs>
      </Box>

      <Box sx={{ flex: 1, overflow: 'auto', p: 2 }}>
        {tab === 0 && <UsersTab />}
        {tab === 1 && <BuildingsTab />}
        {tab === 2 && <ArmiesTab />}
        {tab === 3 && <TechsTab />}
        {tab === 4 && <TroopTypesTab />}
      </Box>
    </Box>
  );
};
