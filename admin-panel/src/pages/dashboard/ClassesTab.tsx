import { useState, useEffect } from 'react';
import {
  DataGrid, GridRowModes, GridActionsCellItem,
  type GridColDef, type GridRowModesModel, type GridRowId, type GridRowModel,
} from '@mui/x-data-grid';
import {
  Box, Button, Dialog, DialogTitle, DialogContent, DialogActions,
  TextField, Checkbox, FormControlLabel, Alert, Snackbar,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import SaveIcon from '@mui/icons-material/Save';
import CancelIcon from '@mui/icons-material/Cancel';
import { adminApi } from '../../api/admin';

const EMPTY_NEW_CLASS = {
  key: '', name: '', is_visible: true,
};

export const ClassesTab = () => {
  const [rows, setRows] = useState<any[]>([]);
  const [rowModesModel, setRowModesModel] = useState<GridRowModesModel>({});
  const [addOpen, setAddOpen] = useState(false);
  const [newClass, setNewClass] = useState({ ...EMPTY_NEW_CLASS });
  const [snackbar, setSnackbar] = useState<{ msg: string; severity: 'success' | 'error' } | null>(null);

  useEffect(() => {
    adminApi.getClasses().then((res) => setRows(res.data));
  }, []);

  const handleSaveClick = (id: GridRowId) => () =>
    setRowModesModel({ ...rowModesModel, [id]: { mode: GridRowModes.View } });

  const handleCancelClick = (id: GridRowId) => () =>
    setRowModesModel({ ...rowModesModel, [id]: { mode: GridRowModes.View, ignoreModifications: true } });

  const handleEditClick = (id: GridRowId) => () =>
    setRowModesModel({ ...rowModesModel, [id]: { mode: GridRowModes.Edit } });

  const handleDelete = async (id: string) => {
    if (!window.confirm('Delete this class?')) return;
    try {
      await adminApi.deleteClass(id);
      setRows((prev) => prev.filter((r) => r.id !== id));
      setSnackbar({ msg: 'Class deleted', severity: 'success' });
    } catch {
      setSnackbar({ msg: 'Failed to delete class', severity: 'error' });
    }
  };

  const processRowUpdate = async (newRow: GridRowModel) => {
    const { id, ...dto } = newRow;
    await adminApi.updateClass(id as string, dto);
    setSnackbar({ msg: 'Class saved', severity: 'success' });
    return newRow;
  };

  const handleProcessRowUpdateError = () =>
    setSnackbar({ msg: 'Failed to save changes', severity: 'error' });

  const handleAddClass = async () => {
    try {
      const res = await adminApi.createClass(newClass);
      setRows((prev) => [...prev, res.data]);
      setAddOpen(false);
      setNewClass({ ...EMPTY_NEW_CLASS });
      setSnackbar({ msg: 'Class created', severity: 'success' });
    } catch (err: any) {
      const msg = err?.response?.data?.message;
      setSnackbar({ msg: Array.isArray(msg) ? msg.join(', ') : (msg || 'Failed to create class'), severity: 'error' });
    }
  };

  const columns: GridColDef[] = [
    { field: 'id', headerName: 'ID', width: 100, editable: false },
    { field: 'key', headerName: 'Key', width: 140, editable: true },
    { field: 'name', headerName: 'Name', width: 160, editable: true },
    { field: 'is_visible', headerName: 'Visible', type: 'boolean', width: 90, editable: true },
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
          Add Class
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
        <DialogTitle>Add Class</DialogTitle>
        <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 1 }}>
          <TextField
            label="Key *"
            value={newClass.key}
            onChange={(e) => setNewClass((p) => ({ ...p, key: e.target.value }))}
            helperText="Unique identifier, also the Tech branch it gates, e.g. noble"
          />
          <TextField label="Name *" value={newClass.name} onChange={(e) => setNewClass((p) => ({ ...p, name: e.target.value }))} />
          <FormControlLabel
            control={
              <Checkbox
                checked={newClass.is_visible}
                onChange={(e) => setNewClass((p) => ({ ...p, is_visible: e.target.checked }))}
              />
            }
            label="Visible to players"
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setAddOpen(false)}>Cancel</Button>
          <Button variant="contained" onClick={handleAddClass} disabled={!newClass.key || !newClass.name}>Create</Button>
        </DialogActions>
      </Dialog>

      <Snackbar open={!!snackbar} autoHideDuration={3000} onClose={() => setSnackbar(null)}>
        <Alert severity={snackbar?.severity} onClose={() => setSnackbar(null)}>{snackbar?.msg}</Alert>
      </Snackbar>
    </Box>
  );
};
