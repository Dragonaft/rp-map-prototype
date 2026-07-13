import { useState, useEffect } from 'react';
import {
  DataGrid, GridRowModes, GridActionsCellItem, useGridApiContext,
  type GridColDef, type GridRowModesModel, type GridRowId, type GridRowModel,
  type GridRenderEditCellParams,
} from '@mui/x-data-grid';
import {
  Box, Button, Dialog, DialogTitle, DialogContent, DialogActions,
  TextField, Alert, Snackbar, Select, MenuItem, FormControl, InputLabel, Autocomplete,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import SaveIcon from '@mui/icons-material/Save';
import CancelIcon from '@mui/icons-material/Cancel';
import TuneIcon from '@mui/icons-material/Tune';
import { adminApi } from '../../api/admin';
import { EffectsEditorModal } from './EffectsEditorModal';
import { describeEffects } from './effectsSchema';

// Closed vocabulary — "economy"/"military" are always-common branches, the rest map to UserClasses (guild/holy/noble).
const BRANCH_OPTIONS = ['economy', 'military', 'guild', 'holy', 'noble'];

const EMPTY_NEW_TECH = {
  key: '', name: '', description: '', branch: '',
  isClassRoot: false, cost: 0, prerequisites: [] as string[],
};

interface TechOption { key: string; name: string; }

/** Custom inline-edit cell for `prerequisites`: a multi-select of other techs' keys instead of free-typed CSV. */
const PrerequisitesEditCell = (props: GridRenderEditCellParams & { allTechs: TechOption[] }) => {
  const { id, field, value, row, allTechs } = props;
  const apiRef = useGridApiContext();
  const options = allTechs.filter((t) => t.key !== row.key);
  const selected: TechOption[] = options.filter((o) => (value ?? []).includes(o.key));

  return (
    <Autocomplete
      multiple
      fullWidth
      size="small"
      options={options}
      value={selected}
      getOptionLabel={(o) => `${o.name} (${o.key})`}
      isOptionEqualToValue={(o, v) => o.key === v.key}
      onChange={(_, newValue) => {
        void apiRef.current.setEditCellValue({ id, field, value: newValue.map((v) => v.key) });
      }}
      renderInput={(params) => <TextField {...params} variant="standard" sx={{ px: 1 }} />}
      sx={{ width: '100%' }}
    />
  );
};

export const TechsTab = () => {
  const [rows, setRows] = useState<any[]>([]);
  const [rowModesModel, setRowModesModel] = useState<GridRowModesModel>({});
  const [addOpen, setAddOpen] = useState(false);
  const [newTech, setNewTech] = useState({ ...EMPTY_NEW_TECH });
  const [snackbar, setSnackbar] = useState<{ msg: string; severity: 'success' | 'error' } | null>(null);
  const [effectsTech, setEffectsTech] = useState<any | null>(null);

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
      const res = await adminApi.createTech(newTech);
      setRows((prev) => [...prev, res.data]);
      setAddOpen(false);
      setNewTech({ ...EMPTY_NEW_TECH });
      setSnackbar({ msg: 'Tech created', severity: 'success' });
    } catch (err: any) {
      const msg = err?.response?.data?.message;
      setSnackbar({ msg: Array.isArray(msg) ? msg.join(', ') : (msg || 'Failed to create tech'), severity: 'error' });
    }
  };

  const techOptions: TechOption[] = rows.map((r) => ({ key: r.key, name: r.name }));

  const columns: GridColDef[] = [
    { field: 'id', headerName: 'ID', width: 100, editable: false },
    { field: 'key', headerName: 'Key', width: 160, editable: true },
    { field: 'name', headerName: 'Name', width: 130, editable: true },
    { field: 'description', headerName: 'Description', width: 220, editable: true },
    { field: 'branch', headerName: 'Branch', width: 110, editable: true, type: 'singleSelect', valueOptions: BRANCH_OPTIONS },
    { field: 'isClassRoot', headerName: 'Class Root', type: 'boolean', width: 100, editable: true },
    { field: 'cost', headerName: 'Cost', type: 'number', width: 80, editable: true },
    {
      field: 'prerequisites', headerName: 'Prerequisites', width: 240, editable: true,
      valueGetter: (value: any) => (Array.isArray(value) ? value.join(', ') : (value ?? '')),
      renderEditCell: (params) => <PrerequisitesEditCell {...params} allTechs={techOptions} />,
    },
    {
      field: 'effects', headerName: 'Effects', width: 260, editable: false,
      valueGetter: (value: any) => describeEffects(value),
    },
    {
      field: 'actions',
      type: 'actions',
      headerName: '',
      width: 140,
      getActions: ({ id, row }) => {
        const isEditing = rowModesModel[id]?.mode === GridRowModes.Edit;
        return isEditing
          ? [
              <GridActionsCellItem icon={<SaveIcon />} label="Save" onClick={handleSaveClick(id)} />,
              <GridActionsCellItem icon={<CancelIcon />} label="Cancel" onClick={handleCancelClick(id)} color="inherit" />,
            ]
          : [
              <GridActionsCellItem icon={<TuneIcon />} label="Edit Effects" onClick={() => setEffectsTech(row)} />,
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
        <DialogTitle>Add Tech</DialogTitle>
        <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 1 }}>
          <TextField label="Key *" value={newTech.key} onChange={(e) => setNewTech((p) => ({ ...p, key: e.target.value }))} helperText="Unique identifier, e.g. economy.trade" />
          <TextField label="Name *" value={newTech.name} onChange={(e) => setNewTech((p) => ({ ...p, name: e.target.value }))} />
          <TextField label="Description *" multiline rows={2} value={newTech.description} onChange={(e) => setNewTech((p) => ({ ...p, description: e.target.value }))} />
          <FormControl fullWidth>
            <InputLabel id="new-tech-branch-label">Branch *</InputLabel>
            <Select
              labelId="new-tech-branch-label"
              label="Branch *"
              value={newTech.branch}
              onChange={(e) => setNewTech((p) => ({ ...p, branch: e.target.value }))}
            >
              {BRANCH_OPTIONS.map((b) => (
                <MenuItem key={b} value={b}>{b}</MenuItem>
              ))}
            </Select>
          </FormControl>
          <TextField label="Cost" type="number" value={newTech.cost} onChange={(e) => setNewTech((p) => ({ ...p, cost: Number(e.target.value) }))} />
          <Autocomplete
            multiple
            options={techOptions}
            value={techOptions.filter((o) => newTech.prerequisites.includes(o.key))}
            getOptionLabel={(o) => `${o.name} (${o.key})`}
            isOptionEqualToValue={(o, v) => o.key === v.key}
            onChange={(_, value) => setNewTech((p) => ({ ...p, prerequisites: value.map((v) => v.key) }))}
            renderInput={(params) => <TextField {...params} label="Prerequisites" />}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setAddOpen(false)}>Cancel</Button>
          <Button variant="contained" onClick={handleAddTech} disabled={!newTech.key || !newTech.name || !newTech.branch}>Create</Button>
        </DialogActions>
      </Dialog>

      <Snackbar open={!!snackbar} autoHideDuration={3000} onClose={() => setSnackbar(null)}>
        <Alert severity={snackbar?.severity} onClose={() => setSnackbar(null)}>{snackbar?.msg}</Alert>
      </Snackbar>

      <EffectsEditorModal
        open={!!effectsTech}
        tech={effectsTech}
        onClose={() => setEffectsTech(null)}
        onSaved={(updated) => {
          setRows((prev) => prev.map((r) => (r.id === updated.id ? updated : r)));
          setSnackbar({ msg: 'Effects saved', severity: 'success' });
        }}
      />
    </Box>
  );
};
