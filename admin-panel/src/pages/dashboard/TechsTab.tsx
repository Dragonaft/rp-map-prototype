import { useState, useEffect } from 'react';
import {
  DataGrid, GridRowModes, GridActionsCellItem,
  type GridColDef, type GridRowModesModel, type GridRowId, type GridRowModel,
} from '@mui/x-data-grid';
import {
  Box, Button, Dialog, DialogTitle, DialogContent, DialogActions,
  TextField, Alert, Snackbar,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import SaveIcon from '@mui/icons-material/Save';
import CancelIcon from '@mui/icons-material/Cancel';
import { adminApi } from '../../api/admin';

const EMPTY_NEW_TECH = {
  key: '', name: '', description: '', branch: '',
  isClassRoot: false, cost: 0, prerequisites: '',
};

export const TechsTab = () => {
  const [rows, setRows] = useState<any[]>([]);
  const [rowModesModel, setRowModesModel] = useState<GridRowModesModel>({});
  const [addOpen, setAddOpen] = useState(false);
  const [newTech, setNewTech] = useState({ ...EMPTY_NEW_TECH });
  const [snackbar, setSnackbar] = useState<{ msg: string; severity: 'success' | 'error' } | null>(null);

  useEffect(() => {
    adminApi.getTechs().then((res) => setRows(res.data));
  }, []);

  const handleSaveClick = (id: GridRowId) => () =>
    setRowModesModel({ ...rowModesModel, [id]: { mode: GridRowModes.View } });

  const handleCancelClick = (id: GridRowId) => () =>
    setRowModesModel({ ...rowModesModel, [id]: { mode: GridRowModes.View, ignoreModifications: true } });

  const handleEditClick = (id: GridRowId) => () =>
    setRowModesModel({ ...rowModesModel, [id]: { mode: GridRowModes.Edit } });

  const handleDelete = async (id: string) => {
    if (!window.confirm('Delete this tech?')) return;
    try {
      await adminApi.deleteTech(id);
      setRows((prev) => prev.filter((r) => r.id !== id));
      setSnackbar({ msg: 'Tech deleted', severity: 'success' });
    } catch {
      setSnackbar({ msg: 'Failed to delete tech', severity: 'error' });
    }
  };

  const processRowUpdate = async (newRow: GridRowModel) => {
    const { id, ...dto } = newRow;
    await adminApi.updateTech(id as string, dto);
    setSnackbar({ msg: 'Tech saved', severity: 'success' });
    return newRow;
  };

  const handleProcessRowUpdateError = () =>
    setSnackbar({ msg: 'Failed to save changes', severity: 'error' });

  const handleAddTech = async () => {
    try {
      const payload = {
        ...newTech,
        prerequisites: newTech.prerequisites
          ? newTech.prerequisites.split(',').map((s) => s.trim()).filter(Boolean)
          : [],
      };
      const res = await adminApi.createTech(payload);
      setRows((prev) => [...prev, res.data]);
      setAddOpen(false);
      setNewTech({ ...EMPTY_NEW_TECH });
      setSnackbar({ msg: 'Tech created', severity: 'success' });
    } catch (err: any) {
      const msg = err?.response?.data?.message;
      setSnackbar({ msg: Array.isArray(msg) ? msg.join(', ') : (msg || 'Failed to create tech'), severity: 'error' });
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
    { field: 'key', headerName: 'Key', width: 160, editable: true },
    { field: 'name', headerName: 'Name', width: 130, editable: true },
    { field: 'description', headerName: 'Description', width: 220, editable: true },
    { field: 'branch', headerName: 'Branch', width: 100, editable: true },
    { field: 'isClassRoot', headerName: 'Class Root', type: 'boolean', width: 100, editable: true },
    { field: 'cost', headerName: 'Cost', type: 'number', width: 80, editable: true },
    arrCol('prerequisites', 'Prerequisites', 200),
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
          Add Tech
        </Button>
      </Box>

      <DataGrid
        rows={rows}
        columns={columns}
        editMode="row"
        rowModesModel={rowModesModel}
        onRowModesModelChange={setRowModesModel}
        processRowUpdate={processRowUpdate}
        onProcessRowUpdateError={handleProcessRowUpdateError}
        autoHeight
        pageSizeOptions={[25, 50, 100]}
        initialState={{ pagination: { paginationModel: { pageSize: 25 } } }}
      />

      <Dialog open={addOpen} onClose={() => setAddOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Add Tech</DialogTitle>
        <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 1 }}>
          <TextField label="Key *" value={newTech.key} onChange={(e) => setNewTech((p) => ({ ...p, key: e.target.value }))} helperText="Unique identifier, e.g. economy.trade" />
          <TextField label="Name *" value={newTech.name} onChange={(e) => setNewTech((p) => ({ ...p, name: e.target.value }))} />
          <TextField label="Description *" multiline rows={2} value={newTech.description} onChange={(e) => setNewTech((p) => ({ ...p, description: e.target.value }))} />
          <TextField label="Branch *" value={newTech.branch} onChange={(e) => setNewTech((p) => ({ ...p, branch: e.target.value }))} helperText="economy / military / guild / holy / noble" />
          <TextField label="Cost" type="number" value={newTech.cost} onChange={(e) => setNewTech((p) => ({ ...p, cost: Number(e.target.value) }))} />
          <TextField label="Prerequisites (comma-separated)" value={newTech.prerequisites} onChange={(e) => setNewTech((p) => ({ ...p, prerequisites: e.target.value }))} />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setAddOpen(false)}>Cancel</Button>
          <Button variant="contained" onClick={handleAddTech} disabled={!newTech.key || !newTech.name || !newTech.branch}>Create</Button>
        </DialogActions>
      </Dialog>

      <Snackbar open={!!snackbar} autoHideDuration={3000} onClose={() => setSnackbar(null)}>
        <Alert severity={snackbar?.severity} onClose={() => setSnackbar(null)}>{snackbar?.msg}</Alert>
      </Snackbar>
    </Box>
  );
};
