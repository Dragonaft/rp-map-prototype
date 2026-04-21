import React, { useState } from 'react';
import { Modal, Box, Button, Tabs, Tab } from '@mui/material';
import { useAppSelector } from "../store/hooks.ts";
import type { RootState } from "../store/store.ts";
import { TechTree } from './TechTree';

interface Props {
  open: boolean;
  onClose: () => void;
}

const style = {
  position: 'absolute',
  top: '50%',
  left: '50%',
  transform: 'translate(-50%, -50%)',
  width: '80%',
  height: '80%',
  bgcolor: 'lightGray',
  border: '2px solid #000',
  boxShadow: 24,
  p: 4,
  display: 'flex',
  flexDirection: 'column',
};

export const TechsModal: React.FC<Props> = ({ open, onClose }) => {
  const [tabValue, setTabValue] = useState(0);
  const techs = useAppSelector((state: RootState) => state.techs.techs);

  const branches = [...new Set(techs.map(t => t.branch))];
  const safeTabValue = Math.min(tabValue, Math.max(0, branches.length - 1));
  const currentBranch = branches[safeTabValue] ?? null;
  const branchTechs = currentBranch ? techs.filter(t => t.branch === currentBranch) : [];

  return (
    <Modal open={open} onClose={onClose}>
      <Box sx={style}>
        <Box sx={{ display: 'flex', alignItems: 'center', width: '100%' }}>
          <div style={{ display: 'flex', width: '100%', alignItems: 'center', justifyContent: 'space-between'}}>
            <span style={{ fontSize: '20px' }}>Research</span>
            <div style={{ cursor: 'pointer' }} onClick={onClose}>X</div>
          </div>
        </Box>
        <Box sx={{ borderBottom: 1, borderColor: 'divider', flexShrink: 0 }}>
          <Tabs value={safeTabValue} onChange={(_, v) => setTabValue(v)} aria-label="tech branches">
            {branches.map((branch, i) => (
              <Tab key={branch} label={branch} id={`tech-tab-${i}`} aria-controls={`tech-tabpanel-${i}`} />
            ))}
          </Tabs>
        </Box>
        <Box sx={{ flex: 1, overflow: 'auto' }}>
          <TechTree techs={branchTechs} />
        </Box>
      </Box>
    </Modal>
  );
};
