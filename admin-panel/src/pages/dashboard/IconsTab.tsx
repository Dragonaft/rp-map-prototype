import { useEffect, useMemo, useState } from 'react';
import { Box, Typography, Button, Alert, Snackbar, CircularProgress } from '@mui/material';
import UploadIcon from '@mui/icons-material/Upload';
import DeleteIcon from '@mui/icons-material/Delete';
import { adminApi } from '../../api/admin';
import { apiBaseUrl } from '../../api/config';

type IconKind = 'building' | 'landscape' | 'resource';

interface IconMeta {
  kind: IconKind;
  key: string;
  hash: string;
}

// Landscapes have no backing DB entity (unlike buildings/resources, which are admin-extensible
// via their own tabs) — this is the one hardcoded key list, mirroring web-map/src/types.ts's
// Landscape union. Update both if a 7th landscape is ever added.
const LANDSCAPES = ['plains', 'forest', 'mountain', 'desert', 'hills', 'swamp'];

const KIND_LABELS: Record<IconKind, string> = {
  building: 'Buildings',
  landscape: 'Landscapes',
  resource: 'Resources',
};

const iconUrl = (kind: IconKind, key: string, hash: string) => `${apiBaseUrl}/icons/${kind}/${key}?v=${hash}`;

export const IconsTab = () => {
  const [icons, setIcons] = useState<IconMeta[]>([]);
  const [buildingTypes, setBuildingTypes] = useState<string[]>([]);
  const [resourceKeys, setResourceKeys] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [busySlot, setBusySlot] = useState<string | null>(null);
  const [snackbar, setSnackbar] = useState<{ msg: string; severity: 'success' | 'error' } | null>(null);

  const load = async () => {
    setLoading(true);
    const [iconsRes, buildingsRes, resourcesRes] = await Promise.all([
      adminApi.getIcons(),
      adminApi.getBuildings(),
      adminApi.getResources(),
    ]);
    setIcons(iconsRes.data);
    setBuildingTypes([...new Set(buildingsRes.data.map((b: any) => b.type as string))].sort());
    setResourceKeys([...new Set(resourcesRes.data.map((r: any) => r.key as string))].sort());
    setLoading(false);
  };

  useEffect(() => { void load(); }, []);

  // Every valid (kind, key) slot, merged with whatever already has art — a slot with no live
  // building/resource behind it anymore (deleted since an icon was uploaded) still shows up so
  // it can be cleaned up, rather than silently disappearing.
  const slotsByKind = useMemo(() => {
    const iconKeys = (kind: IconKind) => icons.filter((i) => i.kind === kind).map((i) => i.key);
    const merge = (known: string[], kind: IconKind) => [...new Set([...known, ...iconKeys(kind)])].sort();
    return {
      building: merge(buildingTypes, 'building'),
      landscape: merge(LANDSCAPES, 'landscape'),
      resource: merge(resourceKeys, 'resource'),
    } satisfies Record<IconKind, string[]>;
  }, [icons, buildingTypes, resourceKeys]);

  const findIcon = (kind: IconKind, key: string) => icons.find((i) => i.kind === kind && i.key === key);

  const handleUpload = async (kind: IconKind, key: string, file: File) => {
    const slot = `${kind}/${key}`;
    setBusySlot(slot);
    try {
      await adminApi.uploadIcon(kind, key, file);
      await load();
      setSnackbar({ msg: `Icon uploaded for ${key}`, severity: 'success' });
    } catch (err: any) {
      const msg = err?.response?.data?.message;
      setSnackbar({ msg: Array.isArray(msg) ? msg.join(', ') : (msg || 'Failed to upload icon'), severity: 'error' });
    } finally {
      setBusySlot(null);
    }
  };

  const handleDelete = async (kind: IconKind, key: string) => {
    const slot = `${kind}/${key}`;
    setBusySlot(slot);
    try {
      await adminApi.deleteIcon(kind, key);
      await load();
      setSnackbar({ msg: `Icon removed for ${key}`, severity: 'success' });
    } catch {
      setSnackbar({ msg: 'Failed to remove icon', severity: 'error' });
    } finally {
      setBusySlot(null);
    }
  };

  if (loading) {
    return <Box display="flex" justifyContent="center" p={4}><CircularProgress /></Box>;
  }

  return (
    <Box>
      {(Object.keys(slotsByKind) as IconKind[]).map((kind) => (
        <Box key={kind} mb={4}>
          <Typography variant="h6" gutterBottom>{KIND_LABELS[kind]}</Typography>
          <Box display="flex" flexWrap="wrap" gap={2}>
            {slotsByKind[kind].map((key) => {
              const icon = findIcon(kind, key);
              const slot = `${kind}/${key}`;
              const busy = busySlot === slot;
              const inputId = `icon-upload-${slot}`;
              return (
                <Box
                  key={key}
                  sx={{
                    width: 130, border: '1px solid', borderColor: 'divider', borderRadius: 1,
                    p: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 0.5,
                  }}
                >
                  <Box
                    sx={{
                      width: 48, height: 48, display: 'flex', alignItems: 'center', justifyContent: 'center',
                      border: '1px dashed', borderColor: 'divider', borderRadius: 1, overflow: 'hidden',
                      bgcolor: 'action.hover',
                    }}
                  >
                    {icon ? (
                      <img src={iconUrl(kind, key, icon.hash)} alt={key} style={{ width: 40, height: 40, objectFit: 'contain' }} />
                    ) : (
                      <Typography variant="caption" color="text.secondary">No icon</Typography>
                    )}
                  </Box>
                  <Typography variant="caption" align="center" sx={{ wordBreak: 'break-word' }}>{key}</Typography>
                  <input
                    id={inputId}
                    type="file"
                    accept="image/png,image/jpeg,image/webp"
                    style={{ display: 'none' }}
                    disabled={busy}
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      e.target.value = '';
                      if (file) void handleUpload(kind, key, file);
                    }}
                  />
                  <label htmlFor={inputId}>
                    <Button
                      component="span"
                      size="small"
                      startIcon={<UploadIcon fontSize="small" />}
                      disabled={busy}
                    >
                      {icon ? 'Replace' : 'Upload'}
                    </Button>
                  </label>
                  {icon && (
                    <Button
                      size="small"
                      color="error"
                      startIcon={<DeleteIcon fontSize="small" />}
                      disabled={busy}
                      onClick={() => void handleDelete(kind, key)}
                    >
                      Remove
                    </Button>
                  )}
                </Box>
              );
            })}
          </Box>
        </Box>
      ))}

      <Snackbar open={!!snackbar} autoHideDuration={3000} onClose={() => setSnackbar(null)}>
        <Alert severity={snackbar?.severity} onClose={() => setSnackbar(null)}>{snackbar?.msg}</Alert>
      </Snackbar>
    </Box>
  );
};
