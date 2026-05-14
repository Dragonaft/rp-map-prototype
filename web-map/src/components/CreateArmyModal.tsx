import React, { useMemo, useState } from 'react';
import { Box, Button, Modal, Slider, Tooltip, Typography } from '@mui/material';
import { useAppDispatch, useAppSelector } from '../store/hooks';
import { addAction } from '../store/slices/actionsSlice';
import type { RootState } from '../store/store';
import { TroopType } from '../types';
import { armiesApi } from '../api/armies';

const PIETY_TROOPS = new Set(['paladins']);
const MONEY_TROOPS = new Set(['mercenaries']);

function calcMaxAdd(troopType: TroopType, userTroops: number, userMoney: number, userPiety: number): number {
  if (MONEY_TROOPS.has(troopType.key)) {
    if (!troopType.cost_per_100) return 0;
    return Math.floor(userMoney * 10 / troopType.cost_per_100) * 10;
  }
  if (PIETY_TROOPS.has(troopType.key)) {
    if (!troopType.cost_per_100) return userTroops;
    return Math.floor(userPiety * 10 / troopType.cost_per_100) * 10;
  }
  return userTroops;
}

const TroopTooltipContent: React.FC<{ troopType: TroopType }> = ({ troopType }) => (
  <div style={{ fontSize: '0.9rem' }}>
    <div style={{ marginBottom: 2 }} className="font-bold">{troopType.name}</div>
    {troopType.description && <div style={{ marginBottom: 2 }} className="mb-1 text-gray-300">{troopType.description}</div>}
    <div style={{ marginBottom: 2 }}>Category: {troopType.category}</div>
    <div style={{ marginBottom: 2 }}>Attack: {troopType.attack}</div>
    <div style={{ marginBottom: 2 }}>Defense: {troopType.defense}</div>
    <div style={{ marginBottom: 2 }}>
      Cost per 100: {troopType.cost_per_100 > 0 ? `${troopType.cost_per_100} ${
        PIETY_TROOPS.has(troopType.key) ? 'piety' : 'gold'
      }` : 'Free'}
    </div>
    <div style={{ marginBottom: 2 }}>Upkeep per 100: {troopType.upkeep_per_100}</div>
  </div>
);

interface Props {
  open: boolean;
  provinceId: string;
  onClose: () => void;
  onCreated: () => void;
}

export const CreateArmyModal: React.FC<Props> = ({ open, provinceId, onClose, onCreated }) => {
  const dispatch = useAppDispatch();
  const user = useAppSelector((state: RootState) => state.user);
  const troopTypes = useAppSelector((state: RootState) => state.armies.troopTypes);
  const provinces = useAppSelector((state: RootState) => state.provinces.provinces);

  const [armyName, setArmyName] = useState('');
  const [selectedCounts, setSelectedCounts] = useState<Record<string, number>>({});
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const userBuildingTypes = useMemo(
    () => new Set(provinces.flatMap((p) => p.buildings?.map((b) => b.type) ?? [])),
    [provinces],
  );

  const totalCount = useMemo(
    () => Object.values(selectedCounts).reduce((s, c) => s + c, 0),
    [selectedCounts],
  );

  const getBuildingDisabledReason = (tt: TroopType): string | null => {
    if (tt.building_requirement && !userBuildingTypes.has(tt.building_requirement)) {
      return `No ${tt.building_requirement.toLowerCase().replace('_', ' ')}`;
    }
    return null;
  };

  const handleSubmit = async () => {
    const units = Object.entries(selectedCounts)
      .filter(([, count]) => count > 0)
      .map(([troop_type_key, count]) => ({ troop_type_key, count }));

    if (units.length === 0) {
      setError('Add at least one troop type');
      return;
    }
    if (totalCount < 100) {
      setError('Army must have at least 100 troops');
      return;
    }

    setSubmitting(true);
    setError(null);
    try {
      const response = await armiesApi.createArmy({
        province_id: provinceId,
        name: armyName.trim() || undefined,
        units,
      });
      dispatch(addAction(response.action));
      setSelectedCounts({});
      setArmyName('');
      onCreated();
      onClose();
    } catch (e: any) {
      setError(e?.response?.data?.message || 'Failed to create army');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose}>
      <Box sx={{
        position: 'absolute', top: '50%', left: '50%',
        transform: 'translate(-50%, -50%)',
        width: 440, bgcolor: 'background.paper',
        border: '2px solid #555', boxShadow: 24, p: 3,
        borderRadius: 2, maxHeight: '80vh', overflowY: 'auto',
      }}>
        <Typography variant="h6" gutterBottom>Create Army</Typography>

        {/* Army name */}
        <div className="mb-3">
          <label className="text-sm font-semibold block mb-1">Army Name (optional)</label>
          <input
            className="w-full text-sm border rounded px-2 py-1"
            value={armyName}
            onChange={(e) => setArmyName(e.target.value)}
            placeholder="e.g. First Legion"
          />
        </div>

        {/* Troop type selection */}
        <div className="mb-3">
          <label className="text-sm font-semibold block mb-1">Select Troops</label>
          <div className="flex flex-col gap-2">
            {troopTypes.map((tt) => {
              const buildingReason = getBuildingDisabledReason(tt);
              const disabled = !!buildingReason;
              const maxAdd = calcMaxAdd(tt, user.troops, user.money, user.piety);
              const count = selectedCounts[tt.key] ?? 0;

              return (
                <Tooltip
                  key={tt.key}
                  title={<TroopTooltipContent troopType={tt} />}
                  placement="left"
                  arrow
                >
                  <div className={`bg-gray-100 rounded p-2 ${disabled ? 'opacity-50' : ''}`}>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm font-medium">{tt.name}</span>
                      {buildingReason && <span className="text-xs text-orange-600">{buildingReason}</span>}
                      <span className="text-sm font-bold tabular-nums ml-auto">{count > 0 ? count : ''}</span>
                    </div>
                    {!disabled && (
                      <Box sx={{ px: 1 }}>
                        <Slider
                          value={count}
                          onChange={(_e, v) => setSelectedCounts((prev) => ({ ...prev, [tt.key]: v as number }))}
                          min={0}
                          max={Math.max(0, maxAdd)}
                          step={10}
                          size="small"
                          valueLabelDisplay="auto"
                          disabled={maxAdd < 10}
                        />
                      </Box>
                    )}
                  </div>
                </Tooltip>
              );
            })}
          </div>
        </div>

        <Typography variant="caption" sx={{ display: 'block', mb: 1 }}>
          Total troops: <strong>{totalCount}</strong>
          {totalCount > 0 && totalCount < 100 && (
            <span className="text-red-500 ml-2"> (minimum 100 required)</span>
          )}
        </Typography>

        {error && <Typography color="error" variant="caption" sx={{ display: 'block', mb: 1 }}>{error}</Typography>}

        <Box sx={{ display: 'flex', gap: 1 }}>
          <Button
            variant="contained"
            color="primary"
            fullWidth
            disabled={submitting || totalCount < 100}
            onClick={() => void handleSubmit()}
          >
            {submitting ? 'Creating…' : 'Create Army'}
          </Button>
          <Button variant="outlined" fullWidth onClick={onClose} disabled={submitting}>
            Cancel
          </Button>
        </Box>
      </Box>
    </Modal>
  );
};
