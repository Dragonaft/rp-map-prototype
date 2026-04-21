import React, { useState } from 'react';
import { Modal, Box, Typography, Slider, Button, Alert, Tabs, Tab } from '@mui/material';
import { ActionType } from '../types';
import { actionsApi } from '../api/actions';
import { useAppDispatch } from "../store/hooks.ts";
import { addAction } from "../store/slices/actionsSlice.ts";
import { updateProvinceById } from "../store/slices/provincesSlice.ts";

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
  height: '79%',
  bgcolor: 'lightGray',
  border: '2px solid #000',
  boxShadow: 24,
  p: 4,
};

interface TabPanelProps {
  children?: React.ReactNode;
  index: number;
  value: number;
}

function a11yProps(index: number) {
  return {
    id: `simple-tab-${index}`,
    'aria-controls': `simple-tabpanel-${index}`,
  };
}

function CustomTabPanel(props: TabPanelProps) {
  const { children, value, index, ...other } = props;

  return (
    <div
      role="tabpanel"
      hidden={value !== index}
      id={`simple-tabpanel-${index}`}
      aria-labelledby={`simple-tab-${index}`}
      {...other}
    >
      {value === index && <Box sx={{ p: 3 }}>{children}</Box>}
    </div>
  );
}

export const TechsModal: React.FC<Props> = ({
  open,
  onClose,
}) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tabValue, setTabValue] = useState(0);
  const dispatch = useAppDispatch();

  const handleChange = (event: React.SyntheticEvent, newValue: number) => {
    setTabValue(newValue);
  };

  const handleConfirm = async () => {
    setLoading(true);
    setError(null);

    try {
      const actionType = ActionType.UPGRADE;

      // const response = await actionsApi.createAction({
      //   type: actionType,
      //   actionData: {
      //     from_province_id: fromProvinceId,
      //     to_province_id: toProvinceId,
      //     troops_number: troopCount,
      //   },
      // });
      //
      // dispatch(addAction(response.action));
      // dispatch(updateProvinceById({
      //   id: response.province.id,
      //   updates: {
      //     localTroops: response.province.localTroops,
      //   },
      // }));

      onClose();
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to create action');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose}>
      <Box sx={style}>
        <Box sx={{ width: '100%' }}>
          <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
            <Tabs value={tabValue} onChange={handleChange} aria-label="basic tabs example">
              <Tab label="Item One" {...a11yProps(0)} />
              <Tab label="Item Two" {...a11yProps(1)} />
              <Tab label="Item Three" {...a11yProps(2)} />
            </Tabs>
          </Box>
          <CustomTabPanel value={tabValue} index={0}>
            Item One
          </CustomTabPanel>
          <CustomTabPanel value={tabValue} index={1}>
            Item Two
          </CustomTabPanel>
          <CustomTabPanel value={tabValue} index={2}>
            Item Three
          </CustomTabPanel>
        </Box>
        <Box sx={{ display: 'flex', gap: 2, mt: 3 }}>
          <Button
            variant="outlined"
            onClick={onClose}
            disabled={loading}
            fullWidth
          >
            Cancel
          </Button>
        </Box>
      </Box>
    </Modal>
  );
};
