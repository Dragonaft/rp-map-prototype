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
import ArticleIcon from '@mui/icons-material/Article';
import { adminApi } from '../../api/admin';

const EMPTY_NEW_ARTICLE = {
  key: '', title: '', category: '', sort_order: 0, is_visible: true, content: '',
};

// Content is markdown and can run to several KB — it doesn't belong in a grid cell, so it's
// edited through this separate dialog (same "Edit X" action-column pattern TechsTab uses for
// EffectsEditorModal) rather than as an inline-editable column.
export const KnowledgeTab = () => {
  const [rows, setRows] = useState<any[]>([]);
  const [rowModesModel, setRowModesModel] = useState<GridRowModesModel>({});
  const [addOpen, setAddOpen] = useState(false);
  const [newArticle, setNewArticle] = useState({ ...EMPTY_NEW_ARTICLE });
  const [contentRow, setContentRow] = useState<any | null>(null);
  const [contentDraft, setContentDraft] = useState('');
  const [snackbar, setSnackbar] = useState<{ msg: string; severity: 'success' | 'error' } | null>(null);

  useEffect(() => {
    adminApi.getKnowledgeArticles().then((res) => setRows(res.data));
  }, []);

  const handleSaveClick = (id: GridRowId) => () =>
    setRowModesModel({ ...rowModesModel, [id]: { mode: GridRowModes.View } });

  const handleCancelClick = (id: GridRowId) => () =>
    setRowModesModel({ ...rowModesModel, [id]: { mode: GridRowModes.View, ignoreModifications: true } });

  const handleEditClick = (id: GridRowId) => () =>
    setRowModesModel({ ...rowModesModel, [id]: { mode: GridRowModes.Edit } });

  const handleDelete = async (id: string) => {
    if (!window.confirm('Delete this article?')) return;
    try {
      await adminApi.deleteKnowledgeArticle(id);
      setRows((prev) => prev.filter((r) => r.id !== id));
      setSnackbar({ msg: 'Article deleted', severity: 'success' });
    } catch {
      setSnackbar({ msg: 'Failed to delete article', severity: 'error' });
    }
  };

  const processRowUpdate = async (newRow: GridRowModel) => {
    const { id, ...dto } = newRow;
    await adminApi.updateKnowledgeArticle(id as string, dto);
    setSnackbar({ msg: 'Article saved', severity: 'success' });
    return newRow;
  };

  const handleProcessRowUpdateError = () =>
    setSnackbar({ msg: 'Failed to save changes', severity: 'error' });

  const handleAddArticle = async () => {
    try {
      const res = await adminApi.createKnowledgeArticle(newArticle);
      setRows((prev) => [...prev, res.data]);
      setAddOpen(false);
      setNewArticle({ ...EMPTY_NEW_ARTICLE });
      setSnackbar({ msg: 'Article created', severity: 'success' });
    } catch (err: any) {
      const msg = err?.response?.data?.message;
      setSnackbar({ msg: Array.isArray(msg) ? msg.join(', ') : (msg || 'Failed to create article'), severity: 'error' });
    }
  };

  const openContentEditor = (row: any) => {
    setContentRow(row);
    setContentDraft(row.content ?? '');
  };

  const handleSaveContent = async () => {
    if (!contentRow) return;
    try {
      await adminApi.updateKnowledgeArticle(contentRow.id, { content: contentDraft });
      setRows((prev) => prev.map((r) => (r.id === contentRow.id ? { ...r, content: contentDraft } : r)));
      setContentRow(null);
      setSnackbar({ msg: 'Content saved', severity: 'success' });
    } catch {
      setSnackbar({ msg: 'Failed to save content', severity: 'error' });
    }
  };

  const columns: GridColDef[] = [
    { field: 'id', headerName: 'ID', width: 100, editable: false },
    { field: 'key', headerName: 'Key', width: 180, editable: true },
    { field: 'title', headerName: 'Title', width: 220, editable: true },
    { field: 'category', headerName: 'Category', width: 140, editable: true },
    { field: 'sort_order', headerName: 'Order', type: 'number', width: 90, editable: true },
    { field: 'is_visible', headerName: 'Visible', type: 'boolean', width: 90, editable: true },
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
              <GridActionsCellItem icon={<ArticleIcon />} label="Edit Content" onClick={() => openContentEditor(row)} />,
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
          Add Article
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
        <DialogTitle>Add Article</DialogTitle>
        <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 1 }}>
          <TextField
            label="Key *"
            value={newArticle.key}
            onChange={(e) => setNewArticle((p) => ({ ...p, key: e.target.value }))}
            helperText="Unique identifier, e.g. supply-and-food"
          />
          <TextField label="Title *" value={newArticle.title} onChange={(e) => setNewArticle((p) => ({ ...p, title: e.target.value }))} />
          <TextField label="Category *" value={newArticle.category} onChange={(e) => setNewArticle((p) => ({ ...p, category: e.target.value }))} />
          <TextField
            label="Order"
            type="number"
            value={newArticle.sort_order}
            onChange={(e) => setNewArticle((p) => ({ ...p, sort_order: Number(e.target.value) }))}
          />
          <TextField
            label="Content"
            value={newArticle.content}
            onChange={(e) => setNewArticle((p) => ({ ...p, content: e.target.value }))}
            multiline
            minRows={4}
            helperText="Markdown, rendered as-is in the player's Codex"
          />
          <FormControlLabel
            control={
              <Checkbox
                checked={newArticle.is_visible}
                onChange={(e) => setNewArticle((p) => ({ ...p, is_visible: e.target.checked }))}
              />
            }
            label="Visible to players"
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setAddOpen(false)}>Cancel</Button>
          <Button
            variant="contained"
            onClick={handleAddArticle}
            disabled={!newArticle.key || !newArticle.title || !newArticle.category || !newArticle.content}
          >
            Create
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={!!contentRow} onClose={() => setContentRow(null)} maxWidth="md" fullWidth>
        <DialogTitle>Edit Content — {contentRow?.title}</DialogTitle>
        <DialogContent>
          <TextField
            value={contentDraft}
            onChange={(e) => setContentDraft(e.target.value)}
            multiline
            minRows={20}
            fullWidth
            sx={{ mt: 1, fontFamily: 'monospace' }}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setContentRow(null)}>Cancel</Button>
          <Button variant="contained" onClick={handleSaveContent}>Save</Button>
        </DialogActions>
      </Dialog>

      <Snackbar open={!!snackbar} autoHideDuration={3000} onClose={() => setSnackbar(null)}>
        <Alert severity={snackbar?.severity} onClose={() => setSnackbar(null)}>{snackbar?.msg}</Alert>
      </Snackbar>
    </Box>
  );
};
