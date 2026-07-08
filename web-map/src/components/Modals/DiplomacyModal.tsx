import React, { useMemo, useState } from 'react';
import { Button, Chip, Dialog, DialogContent, DialogTitle, TextField } from '@mui/material';
import { useAppDispatch, useAppSelector } from '../../store/hooks';
import { diplomacyApi } from '../../api/diplomacy';
import { setRelations, setTreaties, setWars } from '../../store/slices/diplomacySlice';
import { DiplomaticState, TreatyKind } from '../../types';
import { TreatyNegotiationModal } from './TreatyNegotiationModal';
import { PeaceNegotiationModal } from './PeaceNegotiationModal';
import { PlayerTreatiesModal } from './PlayerTreatiesModal';

interface Props {
  open: boolean;
  onClose: () => void;
}

const STATE_COLORS: Record<DiplomaticState, 'default' | 'error' | 'success' | 'info'> = {
  [DiplomaticState.NEUTRAL]: 'default',
  [DiplomaticState.WAR]: 'error',
  [DiplomaticState.PEACE]: 'info',
  [DiplomaticState.ALLIANCE]: 'success',
};

export const DiplomacyModal: React.FC<Props> = ({ open, onClose }) => {
  const dispatch = useAppDispatch();
  const otherUsers = useAppSelector((state) => state.otherUsers.otherUsers);
  const relations = useAppSelector((state) => state.diplomacy.relations);
  const [negotiation, setNegotiation] = useState<{ receiverId: string; receiverName: string; kind: TreatyKind.ALLIANCE | TreatyKind.TRADE | TreatyKind.TROOPS_PASS | TreatyKind.ARTICLE } | null>(null);
  const [peaceTarget, setPeaceTarget] = useState<{ id: string; name: string } | null>(null);
  const [treatiesOf, setTreatiesOf] = useState<{ id: string; name: string } | null>(null);
  const [moneyTarget, setMoneyTarget] = useState<{ id: string; name: string } | null>(null);
  const [moneyAmount, setMoneyAmount] = useState(0);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const relationByUserId = useMemo(() => {
    const map = new Map(relations.map((r) => [r.otherUserId, r]));
    return map;
  }, [relations]);

  const refresh = async () => {
    const [relations, wars, treaties] = await Promise.all([
      diplomacyApi.getRelations(),
      diplomacyApi.getWars(),
      diplomacyApi.getTreaties(),
    ]);
    dispatch(setRelations(relations));
    dispatch(setWars(wars));
    dispatch(setTreaties(treaties));
  };

  const handleDeclareWar = async (targetId: string) => {
    setBusyId(targetId);
    setError(null);
    try {
      await diplomacyApi.declareWar(targetId);
      await refresh();
    } catch (e: any) {
      setError(e?.response?.data?.message || 'Failed to declare war');
    } finally {
      setBusyId(null);
    }
  };

  const handleSendMoney = async () => {
    if (!moneyTarget) return;
    setBusyId(moneyTarget.id);
    setError(null);
    try {
      await diplomacyApi.sendMoney(moneyTarget.id, moneyAmount);
      setMoneyTarget(null);
      setMoneyAmount(0);
    } catch (e: any) {
      setError(e?.response?.data?.message || 'Failed to send money');
    } finally {
      setBusyId(null);
    }
  };

  return (
    <>
      <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
        <DialogTitle>Diplomacy</DialogTitle>
        <DialogContent dividers sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          {error && <p className="text-xs text-red-500">{error}</p>}
          {otherUsers.length === 0 && <div className="text-sm text-white/50 text-center py-8">No other players yet</div>}
          {otherUsers.map((other) => {
            const relation = relationByUserId.get(other.id);
            const state = relation?.state ?? DiplomaticState.NEUTRAL;
            const busy = busyId === other.id;
            return (
              <div key={other.id} className="flex flex-col gap-2 p-3 rounded border border-outline-variant/20 bg-surface-container">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="w-3 h-3 rounded-full inline-block" style={{ backgroundColor: other.color }} />
                    <span className="font-headline font-bold text-white text-sm">{other.countryName}</span>
                  </div>
                  <Chip label={state.toUpperCase()} size="small" color={STATE_COLORS[state]} />
                </div>
                <div className="flex gap-2 flex-wrap">
                  {state === DiplomaticState.NEUTRAL && (
                    <Button size="small" color="error" variant="outlined" disabled={busy}
                      onClick={() => handleDeclareWar(other.id)}>
                      Declare War
                    </Button>
                  )}
                  {state === DiplomaticState.WAR && (
                    <Button size="small" variant="outlined" disabled={busy}
                      onClick={() => setPeaceTarget({ id: other.id, name: other.countryName })}>
                      Propose Peace
                    </Button>
                  )}
                  {(state === DiplomaticState.NEUTRAL || state === DiplomaticState.PEACE) && (
                    <Button size="small" variant="outlined" disabled={busy}
                      onClick={() => setNegotiation({ receiverId: other.id, receiverName: other.countryName, kind: TreatyKind.ALLIANCE })}>
                      Propose Alliance
                    </Button>
                  )}
                  {state !== DiplomaticState.ALLIANCE && (
                    <Button size="small" variant="outlined" disabled={busy}
                      onClick={() => setNegotiation({ receiverId: other.id, receiverName: other.countryName, kind: TreatyKind.TROOPS_PASS })}>
                      Propose Troops Pass
                    </Button>
                  )}
                  <Button size="small" variant="outlined" disabled={busy}
                    onClick={() => setNegotiation({ receiverId: other.id, receiverName: other.countryName, kind: TreatyKind.TRADE })}>
                    Propose Trade
                  </Button>
                  <Button size="small" variant="outlined" disabled={busy}
                    onClick={() => setNegotiation({ receiverId: other.id, receiverName: other.countryName, kind: TreatyKind.ARTICLE })}>
                    Propose Article
                  </Button>
                  <Button size="small" variant="outlined" disabled={busy}
                    onClick={() => setMoneyTarget({ id: other.id, name: other.countryName })}>
                    Send Money
                  </Button>
                  <Button size="small" onClick={() => setTreatiesOf({ id: other.id, name: other.countryName })}>
                    Player Treaties
                  </Button>
                </div>
              </div>
            );
          })}
        </DialogContent>
      </Dialog>

      {negotiation && (
        <TreatyNegotiationModal
          open={!!negotiation}
          onClose={() => setNegotiation(null)}
          receiverId={negotiation.receiverId}
          receiverName={negotiation.receiverName}
          kind={negotiation.kind}
          onProposed={refresh}
        />
      )}

      {peaceTarget && (
        <PeaceNegotiationModal
          open={!!peaceTarget}
          onClose={() => setPeaceTarget(null)}
          targetId={peaceTarget.id}
          targetName={peaceTarget.name}
          onProposed={refresh}
        />
      )}

      {treatiesOf && (
        <PlayerTreatiesModal
          open={!!treatiesOf}
          onClose={() => setTreatiesOf(null)}
          userId={treatiesOf.id}
          userName={treatiesOf.name}
        />
      )}

      <Dialog open={!!moneyTarget} onClose={() => setMoneyTarget(null)} maxWidth="xs" fullWidth>
        <DialogTitle>Send Money to {moneyTarget?.name}</DialogTitle>
        <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 2 }}>
          <TextField
            label="Amount" type="number" size="small" value={moneyAmount}
            onChange={(e) => setMoneyAmount(Math.max(0, Number(e.target.value)))}
          />
          <Button variant="contained" onClick={() => void handleSendMoney()} disabled={!moneyTarget || moneyAmount <= 0}>
            Send
          </Button>
        </DialogContent>
      </Dialog>
    </>
  );
};
