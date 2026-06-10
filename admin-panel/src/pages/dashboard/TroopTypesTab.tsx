import { useState, useEffect } from 'react';
import {
  DataGrid, GridRowModes, GridActionsCellItem,
  type GridColDef, type GridRowModesModel, type GridRowId, type GridRowModel,
} from '@mui/x-data-grid';
import {
  Box, Button, Dialog, DialogTitle, DialogContent, DialogActions,
  TextField, MenuItem, Alert, Snackbar,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import SaveIcon from '@mui/icons-material/Save';
import CancelIcon from '@mui/icons-material/Cancel';
import { adminApi } from '../../api/admin';

const CATEGORIES = ['INFANTRY', 'RANGED', 'CAVALRY', 'SPECIAL', 'PEASANT'];

const EMPTY_NEW_TROOP_TYPE = {
  key: '', name: '', description: '', category: 'INFANTRY',
  cost_per_100: 0, attack: 1, defense: 1, upkeep_per_100: 100,
  tech_requirement: '', building_requirement: '',
};

export const TroopTypesTab = () => {
  const [rows, setRows] = useState<any[]>([]);
  const [rowModesModel, setRowModesModel] = useState<GridRowModesModel>({});
  const [addOpen, setAddOpen] = useState(false);
  const [newTroopType, setNewTroopType] = useState({ ...EMPTY_NEW_TROOP_TYPE });
  const [snackbar, setSnackbar] = useState<{ msg: string; severity: 'success' | 'error' } | null>(null);

  useEffect(() => {
    adminApi.getTroopTypes().then((res) => setRows(res.data));
  }, []);

  const handleSaveClick = (id: GridRowId) => () =>
    setRowModesModel({ ...rowModesModel, [id]: { mode: GridRowModes.View } });

  const handleCancelClick = (id: GridRowId) => () =>
    setRowModesModel({ ...rowModesModel, [id]: { mode: GridRowModes.View, ignoreModifications: true } });

  const handleEditClick = (id: GridRowId) => () =>
    setRowModesModel({ ...rowModesModel, [id]: { mode: GridRowModes.Edit } });

  const handleDelete = async (id: string) => {
    if (!window.confirm('Delete this troop type?')) return;
    try {
      await adminApi.deleteTroopType(id);
      setRows((prev) => prev.filter((r) => r.id !== id));
      setSnackbar({ msg: 'Troop type deleted', severity: 'success' });
    } catch {
      setSnackbar({ msg: 'Failed to delete troop type', severity: 'error' });
    }
  };

  const processRowUpdate = async (newRow: GridRowModel) => {
    const { id, ...dto } = newRow;
    await adminApi.updateTroopType(id as string, dto);
    setSnackbar({ msg: 'Troop type saved', severity: 'success' });
    return newRow;
  };

  const handleProcessRowUpdateError = () =>
    setSnackbar({ msg: 'Failed to save changes', severity: 'error' });

  const handleAddTroopType = async () => {
    try {
      const res = await adminApi.createTroopType(newTroopType);
      setRows((prev) => [...prev, res.data]);
      setAddOpen(false);
      setNewTroopType({ ...EMPTY_NEW_TROOP_TYPE });
      setSnackbar({ msg: 'Troop type created', severity: 'success' });
    } catch (err: any) {
      const msg = err?.response?.data?.message;
      setSnackbar({ msg: Array.isArray(msg) ? msg.join(', ') : (msg || 'Failed to create troop type'), severity: 'error' });
    }
  };

  const columns: GridColDef[] = [
    { field: 'id', headerName: 'ID', width: 100, editable: false },
    { field: 'key', headerName: 'Key', width: 140, editable: true },
    { field: 'name', headerName: 'Name', width: 130, editable: true },
    { field: 'description', headerName: 'Description', width: 220, editable: true },
    { field: 'category', headerName: 'Category', width: 120, editable: true, type: 'singleSelect', valueOptions: CATEGORIES },
    { field: 'cost_per_100', headerName: 'Cost/100', type: 'number', width: 90, editable: true },
    { field: 'attack', headerName: 'Attack', type: 'number', width: 80, editable: true },
    { field: 'defense', headerName: 'Defense', type: 'number', width: 80, editable: true },
    { field: 'upkeep_per_100', headerName: 'Upkeep/100', type: 'number', width: 100, editable: true },
    { field: 'tech_requirement', headerName: 'Tech Req.', width: 160, editable: true },
    { field: 'building_requirement', headerName: 'Building Req.', width: 140, editable: true },
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
          Add Troop Type
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
        <DialogTitle>Add Troop Type</DialogTitle>
        <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 1 }}>
          <TextField label="Key *" value={newTroopType.key} onChange={(e) => setNewTroopType((p) => ({ ...p, key: e.target.value }))} helperText="Unique identifier, e.g. infantry" />
          <TextField label="Name *" value={newTroopType.name} onChange={(e) => setNewTroopType((p) => ({ ...p, name: e.target.value }))} />
          <TextField label="Description" multiline rows={2} value={newTroopType.description} onChange={(e) => setNewTroopType((p) => ({ ...p, description: e.target.value }))} />
          <TextField label="Category *" select value={newTroopType.category} onChange={(e) => setNewTroopType((p) => ({ ...p, category: e.target.value }))}>
            {CATEGORIES.map((c) => <MenuItem key={c} value={c}>{c}</MenuItem>)}
          </TextField>
          <TextField label="Cost / 100" type="number" value={newTroopType.cost_per_100} onChange={(e) => setNewTroopType((p) => ({ ...p, cost_per_100: Number(e.target.value) }))} />
          <TextField label="Attack" type="number" value={newTroopType.attack} onChange={(e) => setNewTroopType((p) => ({ ...p, attack: Number(e.target.value) }))} />
          <TextField label="Defense" type="number" value={newTroopType.defense} onChange={(e) => setNewTroopType((p) => ({ ...p, defense: Number(e.target.value) }))} />
          <TextField label="Upkeep / 100" type="number" value={newTroopType.upkeep_per_100} onChange={(e) => setNewTroopType((p) => ({ ...p, upkeep_per_100: Number(e.target.value) }))} />
          <TextField label="Tech Requirement" value={newTroopType.tech_requirement} onChange={(e) => setNewTroopType((p) => ({ ...p, tech_requirement: e.target.value }))} helperText="Tech key, e.g. military.archery" />
          <TextField label="Building Requirement" value={newTroopType.building_requirement} onChange={(e) => setNewTroopType((p) => ({ ...p, building_requirement: e.target.value }))} helperText="Building type, e.g. BARRACKS" />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setAddOpen(false)}>Cancel</Button>
          <Button variant="contained" onClick={handleAddTroopType} disabled={!newTroopType.key || !newTroopType.name || !newTroopType.category}>Create</Button>
        </DialogActions>
      </Dialog>

      <Snackbar open={!!snackbar} autoHideDuration={3000} onClose={() => setSnackbar(null)}>
        <Alert severity={snackbar?.severity} onClose={() => setSnackbar(null)}>{snackbar?.msg}</Alert>
      </Snackbar>
    </Box>
  );
};
