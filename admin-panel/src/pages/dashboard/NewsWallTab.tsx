import { useState, useEffect } from 'react';
import { DataGrid, GridActionsCellItem, type GridColDef } from '@mui/x-data-grid';
import { Box, Typography, Alert, Snackbar } from '@mui/material';
import DeleteIcon from '@mui/icons-material/Delete';
import { adminApi } from '../../api/admin';

export const NewsWallTab = () => {
  const [agencies, setAgencies] = useState<any[]>([]);
  const [articles, setArticles] = useState<any[]>([]);
  const [snackbar, setSnackbar] = useState<{ msg: string; severity: 'success' | 'error' } | null>(null);

  const loadAgencies = () => adminApi.getNewsAgencies().then((res) => setAgencies(res.data));
  const loadArticles = () => adminApi.getNewsArticles().then((res) => setArticles(res.data));

  useEffect(() => {
    loadAgencies();
    loadArticles();
  }, []);

  const handleDeleteAgency = async (id: string) => {
    if (!window.confirm('Delete this agency? All of its articles will be deleted too.')) return;
    try {
      await adminApi.deleteNewsAgency(id);
      setAgencies((prev) => prev.filter((r) => r.id !== id));
      loadArticles();
      setSnackbar({ msg: 'Agency deleted', severity: 'success' });
    } catch {
      setSnackbar({ msg: 'Failed to delete agency', severity: 'error' });
    }
  };

  const handleDeleteArticle = async (id: string) => {
    if (!window.confirm('Delete this article?')) return;
    try {
      await adminApi.deleteNewsArticle(id);
      setArticles((prev) => prev.filter((r) => r.id !== id));
      setSnackbar({ msg: 'Article deleted', severity: 'success' });
    } catch {
      setSnackbar({ msg: 'Failed to delete article', severity: 'error' });
    }
  };

  const agencyColumns: GridColDef[] = [
    { field: 'id', headerName: 'ID', width: 100 },
    { field: 'name', headerName: 'Agency Name', width: 220 },
    { field: 'countryName', headerName: 'Owner', width: 180, valueGetter: (_, row) => row.user?.country_name ?? '' },
    { field: 'login', headerName: 'Owner Login', width: 150, valueGetter: (_, row) => row.user?.login ?? '' },
    { field: 'createdAt', headerName: 'Created', width: 200, valueGetter: (_, row) => new Date(row.createdAt).toLocaleString() },
    {
      field: 'actions',
      type: 'actions',
      headerName: '',
      width: 60,
      getActions: ({ id }) => [
        <GridActionsCellItem icon={<DeleteIcon />} label="Delete" onClick={() => handleDeleteAgency(id as string)} />,
      ],
    },
  ];

  const articleColumns: GridColDef[] = [
    { field: 'id', headerName: 'ID', width: 100 },
    { field: 'title', headerName: 'Title', width: 220 },
    { field: 'agencyName', headerName: 'Agency', width: 180, valueGetter: (_, row) => row.agency?.name ?? '' },
    { field: 'countryName', headerName: 'Owner', width: 150, valueGetter: (_, row) => row.agency?.user?.country_name ?? '' },
    { field: 'content', headerName: 'Content', width: 320 },
    { field: 'createdAt', headerName: 'Published', width: 200, valueGetter: (_, row) => new Date(row.createdAt).toLocaleString() },
    {
      field: 'actions',
      type: 'actions',
      headerName: '',
      width: 60,
      getActions: ({ id }) => [
        <GridActionsCellItem icon={<DeleteIcon />} label="Delete" onClick={() => handleDeleteArticle(id as string)} />,
      ],
    },
  ];

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
      <Box>
        <Typography variant="h6" mb={1}>News Agencies</Typography>
        <DataGrid
          style={{ maxHeight: 'calc(50vh - 140px)' }}
          rows={agencies}
          columns={agencyColumns}
          pageSizeOptions={[25, 50, 100]}
          initialState={{ pagination: { paginationModel: { pageSize: 25 } } }}
        />
      </Box>

      <Box>
        <Typography variant="h6" mb={1}>Articles</Typography>
        <DataGrid
          style={{ maxHeight: 'calc(50vh - 140px)' }}
          rows={articles}
          columns={articleColumns}
          pageSizeOptions={[25, 50, 100]}
          initialState={{ pagination: { paginationModel: { pageSize: 25 } } }}
        />
      </Box>

      <Snackbar open={!!snackbar} autoHideDuration={3000} onClose={() => setSnackbar(null)}>
        <Alert severity={snackbar?.severity} onClose={() => setSnackbar(null)}>{snackbar?.msg}</Alert>
      </Snackbar>
    </Box>
  );
};
