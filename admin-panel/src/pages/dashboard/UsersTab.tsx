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

const CLASS_OPTIONS = ['', 'guild', 'holy', 'noble'];
const ROLE_OPTIONS = ['', 'ADMIN', 'MODERATOR', 'PLAYER'];

const EMPTY_NEW_USER = {
  login: '', password: '', country_name: '', color: '',
  money: 0, troops: 0, role: 'PLAYER', class: '',
};

export const UsersTab = () => {
  const [rows, setRows] = useState<any[]>([]);
  const [rowModesModel, setRowModesModel] = useState<GridRowModesModel>({});
  const [addOpen, setAddOpen] = useState(false);
  const [newUser, setNewUser] = useState({ ...EMPTY_NEW_USER });
  const [snackbar, setSnackbar] = useState<{ msg: string; severity: 'success' | 'error' } | null>(null);

  useEffect(() => {
    adminApi.getUsers().then((res) => setRows(res.data));
  }, []);

  const handleSaveClick = (id: GridRowId) => () =>
    setRowModesModel({ ...rowModesModel, [id]: { mode: GridRowModes.View } });

  const handleCancelClick = (id: GridRowId) => () =>
    setRowModesModel({ ...rowModesModel, [id]: { mode: GridRowModes.View, ignoreModifications: true } });

  const handleEditClick = (id: GridRowId) => () =>
    setRowModesModel({ ...rowModesModel, [id]: { mode: GridRowModes.Edit } });

  const handleDelete = async (id: string) => {
    if (!window.confirm('Delete this user?')) return;
    try {
      await adminApi.deleteUser(id);
      setRows((prev) => prev.filter((r) => r.id !== id));
      setSnackbar({ msg: 'User deleted', severity: 'success' });
    } catch {
      setSnackbar({ msg: 'Failed to delete user', severity: 'error' });
    }
  };

  const processRowUpdate = async (newRow: GridRowModel) => {
    const { id, ...dto } = newRow;
    await adminApi.updateUser(id as string, dto);
    setSnackbar({ msg: 'User saved', severity: 'success' });
    return newRow;
  };

  const handleProcessRowUpdateError = () =>
    setSnackbar({ msg: 'Failed to save changes', severity: 'error' });

  const handleAddUser = async () => {
    try {
      const res = await adminApi.createUser(newUser);
      setRows((prev) => [...prev, res.data]);
      setAddOpen(false);
      setNewUser({ ...EMPTY_NEW_USER });
      setSnackbar({ msg: 'User created', severity: 'success' });
    } catch (err: any) {
      const msg = err?.response?.data?.message;
      setSnackbar({ msg: Array.isArray(msg) ? msg.join(', ') : (msg || 'Failed to create user'), severity: 'error' });
    }
  };

  const columns: GridColDef[] = [
    { field: 'id', headerName: 'ID', width: 100, editable: false },
    { field: 'login', headerName: 'Login', width: 120, editable: true },
    { field: 'is_new', headerName: 'New', type: 'boolean', width: 70, editable: true },
    { field: 'country_name', headerName: 'Country', width: 120, editable: true },
    { field: 'color', headerName: 'Color', width: 90, editable: true },
    { field: 'money', headerName: 'Money', type: 'number', width: 90, editable: true },
    { field: 'piety', headerName: 'Piety', type: 'number', width: 80, editable: true },
    { field: 'troops', headerName: 'Troops', type: 'number', width: 80, editable: true },
    { field: 'research_points', headerName: 'RP', type: 'number', width: 70, editable: true },
    {
      field: 'completed_research',
      headerName: 'Completed Research',
      width: 220,
      editable: true,
      valueGetter: (value: any) => (Array.isArray(value) ? value.join(', ') : (value ?? '')),
      valueSetter: (value: any, row: any) => ({
        ...row,
        completed_research: value ? String(value).split(',').map((s: string) => s.trim()).filter(Boolean) : [],
      }),
    },
    {
      field: 'class',
      headerName: 'Class',
      width: 90,
      editable: true,
      type: 'singleSelect',
      valueOptions: CLASS_OPTIONS,
    },
    {
      field: 'role',
      headerName: 'Role',
      width: 100,
      editable: true,
      type: 'singleSelect',
      valueOptions: ROLE_OPTIONS,
    },
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
          Add User
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
        <DialogTitle>Add User</DialogTitle>
        <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 1 }}>
          <TextField label="Login *" value={newUser.login} onChange={(e) => setNewUser((p) => ({ ...p, login: e.target.value }))} />
          <TextField label="Password *" type="password" value={newUser.password} onChange={(e) => setNewUser((p) => ({ ...p, password: e.target.value }))} />
          <TextField label="Country Name" value={newUser.country_name} onChange={(e) => setNewUser((p) => ({ ...p, country_name: e.target.value }))} />
          <TextField label="Color (hex)" value={newUser.color} onChange={(e) => setNewUser((p) => ({ ...p, color: e.target.value }))} />
          <TextField label="Money" type="number" value={newUser.money} onChange={(e) => setNewUser((p) => ({ ...p, money: Number(e.target.value) }))} />
          <TextField label="Troops" type="number" value={newUser.troops} onChange={(e) => setNewUser((p) => ({ ...p, troops: Number(e.target.value) }))} />
          <FormControl>
            <InputLabel>Role</InputLabel>
            <Select label="Role" value={newUser.role} onChange={(e) => setNewUser((p) => ({ ...p, role: e.target.value }))}>
              {ROLE_OPTIONS.filter(Boolean).map((o) => <MenuItem key={o} value={o}>{o}</MenuItem>)}
            </Select>
          </FormControl>
          <FormControl>
            <InputLabel>Class</InputLabel>
            <Select label="Class" value={newUser.class} onChange={(e) => setNewUser((p) => ({ ...p, class: e.target.value }))}>
              {CLASS_OPTIONS.map((o) => <MenuItem key={o} value={o}>{o || '(none)'}</MenuItem>)}
            </Select>
          </FormControl>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setAddOpen(false)}>Cancel</Button>
          <Button variant="contained" onClick={handleAddUser} disabled={!newUser.login || !newUser.password}>Create</Button>
        </DialogActions>
      </Dialog>

      <Snackbar open={!!snackbar} autoHideDuration={3000} onClose={() => setSnackbar(null)}>
        <Alert severity={snackbar?.severity} onClose={() => setSnackbar(null)}>{snackbar?.msg}</Alert>
      </Snackbar>
    </Box>
  );
};
