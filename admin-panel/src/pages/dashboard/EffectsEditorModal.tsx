import { useEffect, useState } from 'react';
import {
  Dialog, DialogTitle, DialogContent, DialogActions, Button, Box, Tabs, Tab,
  Select, MenuItem, TextField, IconButton, Typography, Alert, Autocomplete,
  type SelectChangeEvent,
} from '@mui/material';
import DeleteIcon from '@mui/icons-material/Delete';
import AddIcon from '@mui/icons-material/Add';
import { adminApi } from '../../api/admin';
import {
  type TechEffect, type EffectTarget, type EffectOp,
  EFFECT_TARGETS, EFFECT_OPS, TARGET_SCALE_OPTIONS, CONDITIONAL_TARGETS, LANDSCAPE_OPTIONS,
  emptyEffect,
} from './effectsSchema';

interface EffectsEditorModalProps {
  open: boolean;
  tech: { id: string; key: string; name: string; effects?: TechEffect[] | null } | null;
  onClose: () => void;
  onSaved: (updatedTech: any) => void;
}

export const EffectsEditorModal = ({ open, tech, onClose, onSaved }: EffectsEditorModalProps) => {
  const [tab, setTab] = useState<'builder' | 'json'>('builder');
  const [effects, setEffects] = useState<TechEffect[]>([]);
  const [jsonText, setJsonText] = useState('');
  const [jsonError, setJsonError] = useState<string | null>(null);
  const [resourceKeys, setResourceKeys] = useState<string[]>([]);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open || !tech) return;
    const initial = tech.effects ?? [];
    setEffects(initial);
    setJsonText(JSON.stringify(initial, null, 2));
    setJsonError(null);
    setSaveError(null);
    setTab('builder');
  }, [open, tech]);

  useEffect(() => {
    if (!open) return;
    adminApi.getResources().then((res) => setResourceKeys(res.data.map((r: any) => r.key))).catch(() => {});
  }, [open]);

  const switchTab = (next: 'builder' | 'json') => {
    if (next === 'json') {
      setJsonText(JSON.stringify(effects, null, 2));
      setJsonError(null);
    } else {
      try {
        const parsed = JSON.parse(jsonText);
        if (!Array.isArray(parsed)) throw new Error('Must be a JSON array of effects');
        setEffects(parsed);
        setJsonError(null);
      } catch (e: any) {
        setJsonError(e?.message ?? 'Invalid JSON');
        return; // stay on JSON tab until it's valid or the user discards changes
      }
    }
    setTab(next);
  };

  const updateEffect = (index: number, patch: Partial<TechEffect>) => {
    setEffects((prev) => prev.map((eff, i) => (i === index ? { ...eff, ...patch } : eff)));
  };

  const removeEffect = (index: number) => {
    setEffects((prev) => prev.filter((_, i) => i !== index));
  };

  const addEffect = () => {
    setEffects((prev) => [...prev, emptyEffect()]);
  };

  const handleTargetChange = (index: number, target: EffectTarget) => {
    // Reset op-specific / condition fields that no longer apply to the new target.
    const scaleOptions = TARGET_SCALE_OPTIONS[target] ?? [];
    const patch: Partial<TechEffect> = { target };
    if (!scaleOptions.length) patch.scaleBy = undefined;
    if (!CONDITIONAL_TARGETS.includes(target)) patch.when = undefined;
    updateEffect(index, patch);
  };

  const handleOpChange = (index: number, op: EffectOp) => {
    const patch: Partial<TechEffect> = { op };
    if (op !== 'add_scaled') patch.scaleBy = undefined;
    updateEffect(index, patch);
  };

  const handleSave = async () => {
    if (!tech) return;
    let payload: TechEffect[];

    if (tab === 'json') {
      try {
        const parsed = JSON.parse(jsonText);
        if (!Array.isArray(parsed)) throw new Error('Must be a JSON array of effects');
        payload = parsed;
      } catch (e: any) {
        setJsonError(e?.message ?? 'Invalid JSON');
        return;
      }
    } else {
      payload = effects;
    }

    setSaving(true);
    setSaveError(null);
    try {
      const res = await adminApi.updateTech(tech.id, { effects: payload });
      onSaved(res.data);
      onClose();
    } catch (err: any) {
      const msg = err?.response?.data?.message;
      setSaveError(Array.isArray(msg) ? msg.join(', ') : (msg || 'Failed to save effects'));
    } finally {
      setSaving(false);
    }
  };

  if (!tech) return null;

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth disablePortal>
      <DialogTitle>Edit Effects — {tech.name}</DialogTitle>
      <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 1 }}>
        <Tabs value={tab} onChange={(_, v) => switchTab(v)}>
          <Tab label="Builder" value="builder" />
          <Tab label="Advanced (JSON)" value="json" />
        </Tabs>

        {saveError && <Alert severity="error">{saveError}</Alert>}

        {tab === 'builder' ? (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            {effects.length === 0 && (
              <Typography color="text.secondary" variant="body2">
                No effects yet. Add one below.
              </Typography>
            )}
            {effects.map((effect, index) => {
              const scaleOptions = TARGET_SCALE_OPTIONS[effect.target] ?? [];
              const supportsCondition = CONDITIONAL_TARGETS.includes(effect.target);
              return (
                <Box
                  key={index}
                  sx={{
                    display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 1.5,
                    p: 1.5, border: '1px solid', borderColor: 'divider', borderRadius: 1,
                  }}
                >
                  <Select
                    size="small"
                    value={effect.target}
                    onChange={(e: SelectChangeEvent) => handleTargetChange(index, e.target.value as EffectTarget)}
                    sx={{ minWidth: 160 }}
                  >
                    {EFFECT_TARGETS.map((t) => (
                      <MenuItem key={t.value} value={t.value}>{t.label}</MenuItem>
                    ))}
                  </Select>

                  <Select
                    size="small"
                    value={effect.op}
                    onChange={(e: SelectChangeEvent) => handleOpChange(index, e.target.value as EffectOp)}
                    sx={{ minWidth: 190 }}
                  >
                    {EFFECT_OPS.map((o) => (
                      <MenuItem key={o.value} value={o.value}>{o.label}</MenuItem>
                    ))}
                  </Select>

                  <TextField
                    size="small"
                    type="number"
                    label="Value"
                    value={effect.value}
                    onChange={(e) => updateEffect(index, { value: Number(e.target.value) })}
                    sx={{ width: 110 }}
                  />

                  {effect.op === 'add_scaled' && (
                    <Select
                      size="small"
                      displayEmpty
                      value={effect.scaleBy ?? ''}
                      onChange={(e: SelectChangeEvent) => updateEffect(index, { scaleBy: e.target.value || undefined })}
                      sx={{ minWidth: 180 }}
                    >
                      <MenuItem value="" disabled>Scale by...</MenuItem>
                      {scaleOptions.map((opt) => (
                        <MenuItem key={opt} value={opt}>{opt}</MenuItem>
                      ))}
                    </Select>
                  )}

                  {supportsCondition && (
                    <>
                      <Autocomplete
                        size="small"
                        freeSolo
                        options={LANDSCAPE_OPTIONS}
                        value={effect.when?.landscape ?? ''}
                        onInputChange={(_, value) =>
                          updateEffect(index, { when: { ...effect.when, landscape: value || undefined } })
                        }
                        sx={{ minWidth: 160 }}
                        renderInput={(params) => <TextField {...params} label="When landscape" />}
                      />
                      <Select
                        size="small"
                        displayEmpty
                        value={effect.when?.resource ?? ''}
                        onChange={(e: SelectChangeEvent) =>
                          updateEffect(index, { when: { ...effect.when, resource: e.target.value || undefined } })
                        }
                        sx={{ minWidth: 160 }}
                      >
                        <MenuItem value="">(any resource)</MenuItem>
                        {resourceKeys.map((key) => (
                          <MenuItem key={key} value={key}>{key}</MenuItem>
                        ))}
                      </Select>
                    </>
                  )}

                  <Box sx={{ flexGrow: 1 }} />
                  <IconButton size="small" onClick={() => removeEffect(index)} aria-label="Remove effect">
                    <DeleteIcon fontSize="small" />
                  </IconButton>
                </Box>
              );
            })}
            <Button startIcon={<AddIcon />} onClick={addEffect} sx={{ alignSelf: 'flex-start' }}>
              Add effect
            </Button>
          </Box>
        ) : (
          <TextField
            multiline
            minRows={12}
            fullWidth
            value={jsonText}
            onChange={(e) => { setJsonText(e.target.value); setJsonError(null); }}
            error={!!jsonError}
            helperText={jsonError ?? 'Array of { target, op, value, scaleBy?, when?, note? }'}
            sx={{ fontFamily: 'monospace' }}
            slotProps={{ input: { style: { fontFamily: 'monospace', fontSize: 13 } } }}
          />
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button variant="contained" onClick={handleSave} disabled={saving}>Save</Button>
      </DialogActions>
    </Dialog>
  );
};
