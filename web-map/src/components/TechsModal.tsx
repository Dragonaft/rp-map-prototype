import React, { useState } from 'react';
import { Modal, Box, Button, Tabs, Tab, Alert } from '@mui/material';
import { useAppDispatch, useAppSelector } from "../store/hooks.ts";
import type { RootState } from "../store/store.ts";
import { TechTree } from './TechTree';
import { Tech, ActionType } from '../types';
import { actionsApi } from '../api/actions';
import { addAction, removeActionById } from '../store/slices/actionsSlice.ts';

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
  const [selectedTech, setSelectedTech] = useState<Tech | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const dispatch = useAppDispatch();
  const techs = useAppSelector((state: RootState) => state.techs.techs);
  const completedResearch = useAppSelector((state: RootState) => state.user.completedResearch);
  const userActions = useAppSelector((state: RootState) => state.actions.actions);

  const pendingResearchByKey = Object.fromEntries(
    userActions
      .filter(a => a.actionType === ActionType.RESEARCH)
      .map(a => [a.actionData?.tech_key, a.id])
  );

  const branches = [...new Set(techs.map(t => t.branch))];
  const safeTabValue = Math.min(tabValue, Math.max(0, branches.length - 1));
  const currentBranch = branches[safeTabValue] ?? null;
  const branchTechs = currentBranch ? techs.filter(t => t.branch === currentBranch) : [];

  const handleTechClick = (tech: Tech) => {
    setSelectedTech(tech);
    setError(null);
  };

  const prerequisitesMet = selectedTech
    ? selectedTech.prerequisites.every(p => completedResearch.includes(p))
    : false;

  const isResearched = selectedTech ? completedResearch.includes(selectedTech.key) : false;
  const pendingActionId = selectedTech ? (pendingResearchByKey[selectedTech.key] ?? null) : null;

  const handleResearch = async () => {
    if (!selectedTech) return;
    setLoading(true);
    setError(null);

    try {
      const response = await actionsApi.createAction({
        type: ActionType.RESEARCH,
        actionData: { tech_key: selectedTech.key },
      });

      dispatch(addAction(response));
      setSelectedTech(null);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to queue research');
    } finally {
      setLoading(false);
    }
  };

  const handleCancelResearch = async () => {
    if (!pendingActionId) return;
    setLoading(true);
    setError(null);

    try {
      await actionsApi.removeAction(pendingActionId);
      dispatch(removeActionById(pendingActionId));
      setSelectedTech(null);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to cancel research');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose}>
      <Box sx={style}>
        <Box sx={{ display: 'flex', alignItems: 'center', width: '100%' }}>
          <div style={{ display: 'flex', width: '100%', alignItems: 'center', justifyContent: 'space-between' }}>
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
        <Box sx={{ flex: 1, overflow: 'hidden', display: 'flex', gap: 2 }}>
          <Box sx={{ flex: 1, overflow: 'auto' }}>
            <TechTree
              techs={branchTechs}
              completedResearch={completedResearch}
              pendingResearchKeys={Object.keys(pendingResearchByKey)}
              onTechClick={handleTechClick}
            />
          </Box>
          {selectedTech && (
            <Box sx={{
              width: 220,
              flexShrink: 0,
              border: '2px solid black',
              bgcolor: 'white',
              p: 2,
              display: 'flex',
              flexDirection: 'column',
              gap: 1,
            }}>
              <span style={{ fontWeight: 'bold', fontSize: 14 }}>{selectedTech.name}</span>
              <span style={{ fontSize: 12, color: '#444' }}>{selectedTech.description}</span>
              <span style={{ fontSize: 12 }}>Cost: <b>{selectedTech.cost}</b> research points</span>
              {error && <Alert severity="error" sx={{ fontSize: 11, p: '2px 8px' }}>{error}</Alert>}
              {pendingActionId ? (
                <Button
                  variant="contained"
                  color="warning"
                  size="small"
                  onClick={handleCancelResearch}
                  disabled={loading}
                  sx={{ mt: 'auto' }}
                >
                  {loading ? 'Processing...' : 'CANCEL'}
                </Button>
              ) : (
                <Button
                  variant="contained"
                  size="small"
                  onClick={handleResearch}
                  disabled={loading || !prerequisitesMet || isResearched}
                  sx={{ mt: 'auto' }}
                >
                  {loading ? 'Processing...' : 'RESEARCH'}
                </Button>
              )}
            </Box>
          )}
        </Box>
      </Box>
    </Modal>
  );
};
