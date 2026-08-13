import { useState, useEffect } from 'react';
import {
  DataGrid, GridRowModes, GridActionsCellItem,
  type GridColDef, type GridRowModesModel, type GridRowId, type GridRowModel,
} from '@mui/x-data-grid';
import {
  Box, Button, Dialog, DialogTitle, DialogContent, DialogActions,
  TextField, Select, MenuItem, FormControl, InputLabel, Checkbox, ListItemText, Alert, Snackbar,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import SaveIcon from '@mui/icons-material/Save';
import CancelIcon from '@mui/icons-material/Cancel';
import { adminApi } from '../../api/admin';

const BUILDING_TYPES = [
  '', 'CAPITOL', 'CAPITAL', 'FARM', 'BARRACKS', 'FORT', 'MARKET', 'LIBRARY',
  'MINE', 'FORESTRY', 'SAWMILL', 'BRICKYARD', 'BARN', 'GARDEN', 'BAZAAR', 'ARMORY', 'ROAD', 'TEMPLE',
  'CATHEDRAL', 'TRADE_HOUSE', 'CASTLE', 'PORT', 'STUD_FARM', 'RELIQUARY', 'SPICE_WHARF',
];

const EMPTY_NEW_BUILDING = {
  type: '', name: '', description: '', income: 0, upkeep: 0,
  modifier: '', cost: 0, upgrade_to: '', requirement_tech: '', requirement_building: '',
  buildable: true, destructible: true, unique_per_province: false, requires_neighbor_water: false,
  supply_building: false,
  allowed_province_resources: [] as string[], requirement_resource: '', requirement_resource_amount: 0,
  visible: false, can_recruit: false, isProduction: false,
  production_good_id: '', production_requirement_resource: '', production_requirement_resource_amount: 0,
  production_amount: 1, resource_production_amount: 0, resource_production_key: '',
  requirement_good_id: '', requirement_good_amount: 0,
  requirement_good_2_id: '', requirement_good_2_amount: 0,
};

export const BuildingsTab = () => {
  const [rows, setRows] = useState<any[]>([]);
  const [resourceKeys, setResourceKeys] = useState<string[]>([]);
  const [goods, setGoods] = useState<{ id: string; name: string }[]>([]);
  const [rowModesModel, setRowModesModel] = useState<GridRowModesModel>({});
  const [addOpen, setAddOpen] = useState(false);
  const [newBuilding, setNewBuilding] = useState({ ...EMPTY_NEW_BUILDING });
  const [snackbar, setSnackbar] = useState<{ msg: string; severity: 'success' | 'error' } | null>(null);

  useEffect(() => {
    adminApi.getBuildings().then((res) => setRows(res.data));
    adminApi.getResources().then((res) => setResourceKeys(res.data.map((r: any) => r.key)));
    adminApi.getGoods().then((res) => setGoods(res.data));
  }, []);

  const REQ_RESOURCE_OPTIONS = ['', ...resourceKeys];
  const GOOD_OPTIONS = [{ value: '', label: '(none)' }, ...goods.map((g) => ({ value: g.id, label: g.name }))];

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
        allowed_province_resources: newBuilding.allowed_province_resources.length
          ? newBuilding.allowed_province_resources
          : null,
        requirement_resource: newBuilding.requirement_resource || null,
        requirement_resource_amount: newBuilding.requirement_resource_amount || null,
        production_good_id: newBuilding.production_good_id || null,
        production_requirement_resource: newBuilding.production_requirement_resource || null,
        production_requirement_resource_amount: newBuilding.production_requirement_resource_amount || null,
        production_amount: newBuilding.production_amount || null,
        resource_production_amount: newBuilding.resource_production_amount || null,
        resource_production_key: newBuilding.resource_production_key || null,
        requirement_good_id: newBuilding.requirement_good_id || null,
        requirement_good_amount: newBuilding.requirement_good_amount || null,
        requirement_good_2_id: newBuilding.requirement_good_2_id || null,
        requirement_good_2_amount: newBuilding.requirement_good_2_amount || null,
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
    { field: 'requires_neighbor_water', headerName: 'Needs Water Neighbor', width: 160, editable: true, type: 'boolean' },
    { field: 'supply_building', headerName: 'Supply Building', width: 130, editable: true, type: 'boolean' },
    { field: 'visible', headerName: 'Visible', width: 90, editable: true, type: 'boolean' },
    { field: 'can_recruit', headerName: 'Can Recruit', width: 100, editable: true, type: 'boolean' },
    { field: 'isProduction', headerName: 'Production', width: 100, editable: true, type: 'boolean' },
    { field: 'production_good_id', headerName: 'Production Good', width: 150, editable: true, type: 'singleSelect', valueOptions: GOOD_OPTIONS },
    { field: 'production_requirement_resource', headerName: 'Prod. Req. Resource', width: 150, editable: true, type: 'singleSelect', valueOptions: REQ_RESOURCE_OPTIONS },
    { field: 'production_requirement_resource_amount', headerName: 'Prod. Req. Amount', type: 'number', width: 140, editable: true },
    { field: 'production_amount', headerName: 'Prod. Amount', type: 'number', width: 120, editable: true },
    { field: 'resource_production_amount', headerName: 'Resource Prod. Amount', type: 'number', width: 160, editable: true },
    { field: 'resource_production_key', headerName: 'Resource Prod. Key Override', width: 180, editable: true, type: 'singleSelect', valueOptions: REQ_RESOURCE_OPTIONS },
    arrCol('allowed_province_resources', 'Allowed Resources', 160),
    { field: 'requirement_resource', headerName: 'Req. Resource', width: 120, editable: true, type: 'singleSelect', valueOptions: REQ_RESOURCE_OPTIONS },
    { field: 'requirement_resource_amount', headerName: 'Req. Amount', type: 'number', width: 100, editable: true },
    { field: 'requirement_good_id', headerName: 'Req. Good', width: 150, editable: true, type: 'singleSelect', valueOptions: GOOD_OPTIONS },
    { field: 'requirement_good_amount', headerName: 'Req. Good Amount', type: 'number', width: 140, editable: true },
    { field: 'requirement_good_2_id', headerName: 'Req. Good 2', width: 150, editable: true, type: 'singleSelect', valueOptions: GOOD_OPTIONS },
    { field: 'requirement_good_2_amount', headerName: 'Req. Good 2 Amount', type: 'number', width: 150, editable: true },
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
            <InputLabel>Needs Water Neighbor</InputLabel>
            <Select label="Needs Water Neighbor" value={newBuilding.requires_neighbor_water ? 'true' : 'false'} onChange={(e) => setNewBuilding((p) => ({ ...p, requires_neighbor_water: e.target.value === 'true' }))}>
              <MenuItem value="true">Yes</MenuItem>
              <MenuItem value="false">No</MenuItem>
            </Select>
          </FormControl>
          <FormControl>
            <InputLabel>Supply Building</InputLabel>
            <Select label="Supply Building" value={newBuilding.supply_building ? 'true' : 'false'} onChange={(e) => setNewBuilding((p) => ({ ...p, supply_building: e.target.value === 'true' }))}>
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
          <FormControl>
            <InputLabel>Production</InputLabel>
            <Select label="Production" value={newBuilding.isProduction ? 'true' : 'false'} onChange={(e) => setNewBuilding((p) => ({ ...p, isProduction: e.target.value === 'true' }))}>
              <MenuItem value="true">Yes</MenuItem>
              <MenuItem value="false">No</MenuItem>
            </Select>
          </FormControl>
          <FormControl>
            <InputLabel>Production Good</InputLabel>
            <Select label="Production Good" value={newBuilding.production_good_id} onChange={(e) => setNewBuilding((p) => ({ ...p, production_good_id: e.target.value }))}>
              {GOOD_OPTIONS.map((o) => <MenuItem key={o.value} value={o.value}>{o.label}</MenuItem>)}
            </Select>
          </FormControl>
          <FormControl>
            <InputLabel>Production Req. Resource</InputLabel>
            <Select label="Production Req. Resource" value={newBuilding.production_requirement_resource} onChange={(e) => setNewBuilding((p) => ({ ...p, production_requirement_resource: e.target.value }))}>
              {REQ_RESOURCE_OPTIONS.map((o) => <MenuItem key={o} value={o}>{o || '(none)'}</MenuItem>)}
            </Select>
          </FormControl>
          <TextField label="Production Req. Resource Amount" type="number" value={newBuilding.production_requirement_resource_amount} onChange={(e) => setNewBuilding((p) => ({ ...p, production_requirement_resource_amount: Number(e.target.value) }))} />
          <TextField label="Production Amount" type="number" value={newBuilding.production_amount} onChange={(e) => setNewBuilding((p) => ({ ...p, production_amount: Number(e.target.value) }))} />
          <TextField label="Resource Production Amount (MINE/FORESTRY)" type="number" value={newBuilding.resource_production_amount} onChange={(e) => setNewBuilding((p) => ({ ...p, resource_production_amount: Number(e.target.value) }))} />
          <FormControl>
            <InputLabel>Resource Prod. Key Override</InputLabel>
            <Select label="Resource Prod. Key Override" value={newBuilding.resource_production_key} onChange={(e) => setNewBuilding((p) => ({ ...p, resource_production_key: e.target.value }))}>
              {REQ_RESOURCE_OPTIONS.map((o) => <MenuItem key={o} value={o}>{o || "(none — province's own resource)"}</MenuItem>)}
            </Select>
          </FormControl>
          <FormControl>
            <InputLabel>Req. Good</InputLabel>
            <Select label="Req. Good" value={newBuilding.requirement_good_id} onChange={(e) => setNewBuilding((p) => ({ ...p, requirement_good_id: e.target.value }))}>
              {GOOD_OPTIONS.map((o) => <MenuItem key={o.value} value={o.value}>{o.label}</MenuItem>)}
            </Select>
          </FormControl>
          <TextField label="Req. Good Amount" type="number" value={newBuilding.requirement_good_amount} onChange={(e) => setNewBuilding((p) => ({ ...p, requirement_good_amount: Number(e.target.value) }))} />
          <FormControl>
            <InputLabel>Req. Good 2</InputLabel>
            <Select label="Req. Good 2" value={newBuilding.requirement_good_2_id} onChange={(e) => setNewBuilding((p) => ({ ...p, requirement_good_2_id: e.target.value }))}>
              {GOOD_OPTIONS.map((o) => <MenuItem key={o.value} value={o.value}>{o.label}</MenuItem>)}
            </Select>
          </FormControl>
          <TextField label="Req. Good 2 Amount" type="number" value={newBuilding.requirement_good_2_amount} onChange={(e) => setNewBuilding((p) => ({ ...p, requirement_good_2_amount: Number(e.target.value) }))} helperText="A second, independent one-time goods cost — e.g. Lumber alongside Bricks/Weapons" />
          <FormControl>
            <InputLabel>Allowed Resources</InputLabel>
            <Select
              multiple
              label="Allowed Resources"
              value={newBuilding.allowed_province_resources}
              onChange={(e) => {
                const value = e.target.value;
                setNewBuilding((p) => ({
                  ...p,
                  allowed_province_resources: typeof value === 'string' ? value.split(',') : value,
                }));
              }}
              renderValue={(selected) => (selected as string[]).join(', ')}
            >
              {resourceKeys.map((key) => (
                <MenuItem key={key} value={key}>
                  <Checkbox checked={newBuilding.allowed_province_resources.includes(key)} />
                  <ListItemText primary={key} />
                </MenuItem>
              ))}
            </Select>
          </FormControl>
          <FormControl>
            <InputLabel>Req. Resource</InputLabel>
            <Select label="Req. Resource" value={newBuilding.requirement_resource} onChange={(e) => setNewBuilding((p) => ({ ...p, requirement_resource: e.target.value }))}>
              {REQ_RESOURCE_OPTIONS.map((o) => <MenuItem key={o} value={o}>{o || '(none)'}</MenuItem>)}
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
