import { useState, useEffect } from 'react';
import {
  DataGrid, GridRowModes, GridActionsCellItem,
  type GridColDef, type GridRowModesModel, type GridRowId, type GridRowModel,
} from '@mui/x-data-grid';
import {
  Box, Button, Dialog, DialogTitle, DialogContent, DialogActions,
  TextField, Select, MenuItem, FormControl, InputLabel, Alert, Snackbar,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import SaveIcon from '@mui/icons-material/Save';
import CancelIcon from '@mui/icons-material/Cancel';
import { adminApi } from '../../api/admin';

const BUILDING_TYPES = [
  '', 'CAPITOL', 'CAPITAL', 'FARM', 'BARRACKS', 'FORT', 'MARKET', 'LIBRARY',
  'MINE', 'FORESTRY', 'GARDEN', 'BAZAAR', 'ARMORY', 'ROAD', 'TEMPLE',
  'CATHEDRAL', 'TRADE_HOUSE', 'CASTLE',
];

const RESOURCE_TYPES = ['', 'iron', 'gold', 'stone', 'wood', 'grain'];

const EMPTY_NEW_BUILDING = {
  type: '', name: '', description: '', income: 0, upkeep: 0,
  modifier: '', cost: 0, upgrade_to: '', requirement_tech: '', requirement_building: '',
  buildable: true, destructible: true, unique_per_province: false,
  allowed_province_resources: '', requirement_resource: '', requirement_resource_amount: 0,
  visible: false, can_recruit: false,
};

export const BuildingsTab = () => {
  const [rows, setRows] = useState<any[]>([]);
  const [rowModesModel, setRowModesModel] = useState<GridRowModesModel>({});
  const [addOpen, setAddOpen] = useState(false);
  const [newBuilding, setNewBuilding] = useState({ ...EMPTY_NEW_BUILDING });
  const [snackbar, setSnackbar] = useState<{ msg: string; severity: 'success' | 'error' } | null>(null);

  useEffect(() => {
    adminApi.getBuildings().then((res) => setRows(res.data));
  }, []);

  const handleSaveClick = (id: GridRowId) => () =>
    setRowModesModel({ ...rowModesModel, [id]: { mode: GridRowModes.View } });

  const handleCancelClick = (id: GridRowId) => () =>
    setRowModesModel({ ...rowModesModel, [id]: { mode: GridRowModes.View, ignoreModifications: true } });

  const handleEditClick = (id: GridRowId) => () =>
    setRowModesModel({ ...rowModesModel, [id]: { mode: GridRowModes.Edit } });

  const handleDelete = async (id: string) => {
    if (!window.confirm('Delete this building?')) return;
    try {
      await adminApi.deleteBuilding(id);
      setRows((prev) => prev.filter((r) => r.id !== id));
      setSnackbar({ msg: 'Building deleted', severity: 'success' });
    } catch {
      setSnackbar({ msg: 'Failed to delete building', severity: 'error' });
    }
  };

  const processRowUpdate = async (newRow: GridRowModel) => {
    const { id, ...dto } = newRow;
    await adminApi.updateBuilding(id as string, dto);
    setSnackbar({ msg: 'Building saved', severity: 'success' });
    return newRow;
  };

  const handleProcessRowUpdateError = () =>
    setSnackbar({ msg: 'Failed to save changes', severity: 'error' });

  const handleAddBuilding = async () => {
    try {
      const payload = {
        ...newBuilding,
        requirement_tech: newBuilding.requirement_tech
          ? newBuilding.requirement_tech.split(',').map((s) => s.trim()).filter(Boolean)
          : [],
        upgrade_to: newBuilding.upgrade_to || null,
        requirement_building: newBuilding.requirement_building || null,
        allowed_province_resources: newBuilding.allowed_province_resources
          ? newBuilding.allowed_province_resources.split(',').map((s) => s.trim()).filter(Boolean)
          : null,
        requirement_resource: newBuilding.requirement_resource || null,
        requirement_resource_amount: newBuilding.requirement_resource_amount || null,
      };
      const res = await adminApi.createBuilding(payload);
      setRows((prev) => [...prev, res.data]);
      setAddOpen(false);
      setNewBuilding({ ...EMPTY_NEW_BUILDING });
      setSnackbar({ msg: 'Building created', severity: 'success' });
    } catch (err: any) {
      const msg = err?.response?.data?.message;
      setSnackbar({ msg: Array.isArray(msg) ? msg.join(', ') : (msg || 'Failed to create building'), severity: 'error' });
    }
  };

  const arrCol = (field: string, headerName: string, width: number): GridColDef => ({
    field,
    headerName,
    width,
    editable: true,
    valueGetter: (value: any) => (Array.isArray(value) ? value.join(', ') : (value ?? '')),
    valueSetter: (value: any, row: any) => ({
      ...row,
      [field]: value ? String(value).split(',').map((s: string) => s.trim()).filter(Boolean) : [],
    }),
  });

  const columns: GridColDef[] = [
    { field: 'id', headerName: 'ID', width: 100, editable: false },
    { field: 'type', headerName: 'Type', width: 120, editable: true, type: 'singleSelect', valueOptions: BUILDING_TYPES.filter(Boolean) },
    { field: 'name', headerName: 'Name', width: 130, editable: true },
    { field: 'description', headerName: 'Description', width: 200, editable: true },
    { field: 'income', headerName: 'Income', type: 'number', width: 80, editable: true },
    { field: 'upkeep', headerName: 'Upkeep', type: 'number', width: 80, editable: true },
    { field: 'modifier', headerName: 'Modifier', width: 120, editable: true },
    { field: 'cost', headerName: 'Cost', type: 'number', width: 80, editable: true },
    { field: 'upgrade_to', headerName: 'Upgrade To', width: 120, editable: true, type: 'singleSelect', valueOptions: BUILDING_TYPES },
    arrCol('requirement_tech', 'Req. Tech', 180),
    { field: 'requirement_building', headerName: 'Req. Building', width: 130, editable: true, type: 'singleSelect', valueOptions: BUILDING_TYPES },
    { field: 'buildable', headerName: 'Buildable', width: 90, editable: true, type: 'boolean' },
    { field: 'destructible', headerName: 'Destructible', width: 100, editable: true, type: 'boolean' },
    { field: 'unique_per_province', headerName: 'Unique/Prov', width: 100, editable: true, type: 'boolean' },
    { field: 'visible', headerName: 'Visible', width: 90, editable: true, type: 'boolean' },
    { field: 'can_recruit', headerName: 'Can Recruit', width: 100, editable: true, type: 'boolean' },
    arrCol('allowed_province_resources', 'Allowed Resources', 160),
    { field: 'requirement_resource', headerName: 'Req. Resource', width: 120, editable: true, type: 'singleSelect', valueOptions: RESOURCE_TYPES },
    { field: 'requirement_resource_amount', headerName: 'Req. Amount', type: 'number', width: 100, editable: true },
    {
      field: 'actions',
      type: 'actions',
      headerName: '',
      width: 100,
      getActions: ({ id }) => {
        const isEditing = rowModesModel[id]?.mode === GridRowModes.Edit;
        return isEditing
          ? [
              <GridActionsCellItem icon={<SaveIcon />} label="Save" onClick={handleSaveClick(id)} />,
              <GridActionsCellItem icon={<CancelIcon />} label="Cancel" onClick={handleCancelClick(id)} color="inherit" />,
            ]
          : [
              <GridActionsCellItem icon={<EditIcon />} label="Edit" onClick={handleEditClick(id)} />,
              <GridActionsCellItem icon={<DeleteIcon />} label="Delete" onClick={() => handleDelete(id as string)} />,
            ];
      },
    },
  ];

  return (
    <Box>
      <Box mb={1}>
        <Button startIcon={<AddIcon />} variant="outlined" onClick={() => setAddOpen(true)}>
          Add Building
        </Button>
      </Box>

      <DataGrid
        style={{ maxHeight: 'calc(100vh - 220px)' }}
        rows={rows}
        columns={columns}
        editMode="row"
        rowModesModel={rowModesModel}
        onRowModesModelChange={setRowModesModel}
        processRowUpdate={processRowUpdate}
        onProcessRowUpdateError={handleProcessRowUpdateError}
        pageSizeOptions={[25, 50, 100]}
        initialState={{ pagination: { paginationModel: { pageSize: 25 } } }}
      />

      <Dialog open={addOpen} onClose={() => setAddOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Add Building</DialogTitle>
        <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 1 }}>
          <FormControl>
            <InputLabel>Type *</InputLabel>
            <Select label="Type *" value={newBuilding.type} onChange={(e) => setNewBuilding((p) => ({ ...p, type: e.target.value }))}>
              {BUILDING_TYPES.filter(Boolean).map((o) => <MenuItem key={o} value={o}>{o}</MenuItem>)}
            </Select>
          </FormControl>
          <TextField label="Name *" value={newBuilding.name} onChange={(e) => setNewBuilding((p) => ({ ...p, name: e.target.value }))} />
          <TextField label="Description *" multiline rows={2} value={newBuilding.description} onChange={(e) => setNewBuilding((p) => ({ ...p, description: e.target.value }))} />
          <TextField label="Income" type="number" value={newBuilding.income} onChange={(e) => setNewBuilding((p) => ({ ...p, income: Number(e.target.value) }))} />
          <TextField label="Upkeep" type="number" value={newBuilding.upkeep} onChange={(e) => setNewBuilding((p) => ({ ...p, upkeep: Number(e.target.value) }))} />
          <TextField label="Cost" type="number" value={newBuilding.cost} onChange={(e) => setNewBuilding((p) => ({ ...p, cost: Number(e.target.value) }))} />
          <TextField label="Modifier" value={newBuilding.modifier} onChange={(e) => setNewBuilding((p) => ({ ...p, modifier: e.target.value }))} />
          <FormControl>
            <InputLabel>Upgrade To</InputLabel>
            <Select label="Upgrade To" value={newBuilding.upgrade_to} onChange={(e) => setNewBuilding((p) => ({ ...p, upgrade_to: e.target.value }))}>
              {BUILDING_TYPES.map((o) => <MenuItem key={o} value={o}>{o || '(none)'}</MenuItem>)}
            </Select>
          </FormControl>
          <TextField label="Req. Tech (comma-separated)" value={newBuilding.requirement_tech} onChange={(e) => setNewBuilding((p) => ({ ...p, requirement_tech: e.target.value }))} />
          <FormControl>
            <InputLabel>Req. Building</InputLabel>
            <Select label="Req. Building" value={newBuilding.requirement_building} onChange={(e) => setNewBuilding((p) => ({ ...p, requirement_building: e.target.value }))}>
              {BUILDING_TYPES.map((o) => <MenuItem key={o} value={o}>{o || '(none)'}</MenuItem>)}
            </Select>
          </FormControl>
          <FormControl>
            <InputLabel>Buildable</InputLabel>
            <Select label="Buildable" value={newBuilding.buildable ? 'true' : 'false'} onChange={(e) => setNewBuilding((p) => ({ ...p, buildable: e.target.value === 'true' }))}>
              <MenuItem value="true">Yes</MenuItem>
              <MenuItem value="false">No</MenuItem>
            </Select>
          </FormControl>
          <FormControl>
            <InputLabel>Destructible</InputLabel>
            <Select label="Destructible" value={newBuilding.destructible ? 'true' : 'false'} onChange={(e) => setNewBuilding((p) => ({ ...p, destructible: e.target.value === 'true' }))}>
              <MenuItem value="true">Yes</MenuItem>
              <MenuItem value="false">No</MenuItem>
            </Select>
          </FormControl>
          <FormControl>
            <InputLabel>Unique per Province</InputLabel>
            <Select label="Unique per Province" value={newBuilding.unique_per_province ? 'true' : 'false'} onChange={(e) => setNewBuilding((p) => ({ ...p, unique_per_province: e.target.value === 'true' }))}>
              <MenuItem value="true">Yes</MenuItem>
              <MenuItem value="false">No</MenuItem>
            </Select>
          </FormControl>
          <FormControl>
            <InputLabel>Visible</InputLabel>
            <Select label="Visible" value={newBuilding.visible ? 'true' : 'false'} onChange={(e) => setNewBuilding((p) => ({ ...p, visible: e.target.value === 'true' }))}>
              <MenuItem value="true">Yes</MenuItem>
              <MenuItem value="false">No</MenuItem>
            </Select>
          </FormControl>
          <FormControl>
            <InputLabel>Can Recruit</InputLabel>
            <Select label="Can Recruit" value={newBuilding.can_recruit ? 'true' : 'false'} onChange={(e) => setNewBuilding((p) => ({ ...p, can_recruit: e.target.value === 'true' }))}>
              <MenuItem value="true">Yes</MenuItem>
              <MenuItem value="false">No</MenuItem>
            </Select>
          </FormControl>
          <TextField label="Allowed Resources (comma-separated)" value={newBuilding.allowed_province_resources} onChange={(e) => setNewBuilding((p) => ({ ...p, allowed_province_resources: e.target.value }))} />
          <FormControl>
            <InputLabel>Req. Resource</InputLabel>
            <Select label="Req. Resource" value={newBuilding.requirement_resource} onChange={(e) => setNewBuilding((p) => ({ ...p, requirement_resource: e.target.value }))}>
              {RESOURCE_TYPES.map((o) => <MenuItem key={o} value={o}>{o || '(none)'}</MenuItem>)}
            </Select>
          </FormControl>
          <TextField label="Req. Resource Amount" type="number" value={newBuilding.requirement_resource_amount} onChange={(e) => setNewBuilding((p) => ({ ...p, requirement_resource_amount: Number(e.target.value) }))} />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setAddOpen(false)}>Cancel</Button>
          <Button variant="contained" onClick={handleAddBuilding} disabled={!newBuilding.type || !newBuilding.name}>Create</Button>
        </DialogActions>
      </Dialog>

      <Snackbar open={!!snackbar} autoHideDuration={3000} onClose={() => setSnackbar(null)}>
        <Alert severity={snackbar?.severity} onClose={() => setSnackbar(null)}>{snackbar?.msg}</Alert>
      </Snackbar>
    </Box>
  );
};
