import React, { useMemo, useState } from 'react';
import { Dialog } from '@mui/material';
import { useAppDispatch, useAppSelector } from '../../store/hooks';
import { diplomacyApi } from '../../api/diplomacy';
import { setRelations, setTreaties, setWars } from '../../store/slices/diplomacySlice';
import { DiplomaticState, TreatyKind } from '../../types';
import { TreatyNegotiationModal } from './TreatyNegotiationModal';
import { PeaceNegotiationModal } from './PeaceNegotiationModal';
import { PlayerTreatiesModal } from './PlayerTreatiesModal';
import { ActionButton } from '../ActionButton.tsx';

interface Props {
  open: boolean;
  onClose: () => void;
}

/** Border/text color for the state badge — terminal aesthetic uses bare currentColor, no fills. */
const STATE_BADGE_CLASSES: Record<DiplomaticState, string> = {
  [DiplomaticState.NEUTRAL]: 'border-white/40 text-on-surface-variant',
  [DiplomaticState.WAR]: 'border-error/40 text-error',
  [DiplomaticState.PEACE]: 'border-primary/40 text-primary',
  [DiplomaticState.ALLIANCE]: 'border-secondary/40 text-secondary',
};

export const DiplomacyModal: React.FC<Props> = ({ open, onClose }) => {
  const dispatch = useAppDispatch();
  const currentUserId = useAppSelector((state) => state.user.id);
  const otherUsers = useAppSelector((state) => state.otherUsers.otherUsers);
  const relations = useAppSelector((state) => state.diplomacy.relations);
  const [negotiation, setNegotiation] = useState<{ receiverId: string; receiverName: string; kind: TreatyKind.ALLIANCE | TreatyKind.TRADE | TreatyKind.TROOPS_PASS | TreatyKind.ARTICLE } | null>(null);
  const [peaceTarget, setPeaceTarget] = useState<{ id: string; name: string } | null>(null);
  const [treatiesOf, setTreatiesOf] = useState<{ id: string; name: string } | null>(null);
  const [moneyTarget, setMoneyTarget] = useState<{ id: string; name: string } | null>(null);
  const [moneyAmount, setMoneyAmount] = useState(0);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  const relationByUserId = useMemo(() => {
    const map = new Map(relations.map((r) => [r.otherUserId, r]));
    return map;
  }, [relations]);

  // GET /users (the source of otherUsers) returns every account, including our own —
  // exclude ourselves here since we can't propose treaties/war/money to ourselves anyway.
  const othersExcludingSelf = useMemo(
    () => otherUsers.filter((u) => u.id !== currentUserId),
    [otherUsers, currentUserId],
  );

  const filteredUsers = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) return othersExcludingSelf;
    return othersExcludingSelf.filter((u) => u.countryName.toLowerCase().includes(query));
  }, [othersExcludingSelf, searchQuery]);

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
      <Dialog
        open={open}
        onClose={onClose}
        maxWidth="md"
        fullWidth
        disablePortal
        slotProps={{
          paper: {
            className: '!bg-surface-container !text-on-surface !shadow-2xl !rounded-sm !max-w-2xl !overflow-hidden',
          },
        }}
      >
        <div className="relative">
          {/* Top edge gradient hairline — terminal panel seam detail */}
          <div className="absolute top-0 left-0 h-[1px] w-full bg-gradient-to-r from-transparent via-primary/40 to-transparent" />

          <button
            onClick={onClose}
            aria-label="Close"
            className="bg-transparent border-none absolute top-4 right-4 z-10 p-1 text-on-surface-variant hover:text-primary transition-colors cursor-pointer"
          >
            <span className="material-symbols-outlined text-2xl">close</span>
          </button>

          <div className="p-6 flex flex-col gap-6">
            <div className="flex flex-col gap-1 pr-8">
              <h1 className="font-headline text-2xl tracking-[0.2em] uppercase glow-text-primary text-primary flex items-center gap-3">
                DIPLOMACY_NETWORK
                <span className="text-[10px] bg-error/20 text-error px-2 py-0.5 border border-solid border-error/30 tracking-normal leading-none rounded-sm">
                  v0.6.5_WAR
                </span>
              </h1>
              <p className="font-headline text-[10px] tracking-widest text-on-surface-variant uppercase">
                Status: encrypted_uplink_active
              </p>
            </div>

            {error && (
              <p className="font-headline text-xs tracking-wide text-error border border-solid border-error/30 bg-error/10 rounded-sm px-3 py-2">
                {error}
              </p>
            )}

            <div className="relative">
              <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant text-lg">
                search
              </span>
              <input
                type="text"
                placeholder="SEARCH_ENTITIES..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="box-border w-full bg-surface-container-lowest border border-outline-variant/20 rounded-sm py-2.5 pl-10 pr-4 text-sm text-white font-headline tracking-wider focus:outline-none focus:border-primary/50 transition-all placeholder:text-on-surface-variant/40"
              />
            </div>

            <div className="flex flex-col gap-8 max-h-[60vh] overflow-y-auto pr-2 custom-scrollbar">
              {filteredUsers.length === 0 && (
                <div className="font-headline text-xs uppercase tracking-widest text-on-surface-variant text-center py-8">
                  {othersExcludingSelf.length === 0 ? 'No other players yet' : 'No matching entities'}
                </div>
              )}
              {filteredUsers.map((other) => {
                const relation = relationByUserId.get(other.id);
                const state = relation?.state ?? DiplomaticState.NEUTRAL;
                const busy = busyId === other.id;
                return (
                  <div key={other.id} className="flex flex-col gap-3">
                    <div className="flex justify-between items-center pb-1 gap-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="w-2.5 h-2.5 rounded-full inline-block shrink-0" style={{ backgroundColor: other.color }} />
                        <h2 className="font-headline text-lg tracking-widest uppercase truncate">{other.countryName}</h2>
                      </div>
                      <span className={`font-headline text-[11px] tracking-widest border border-solid px-2 py-0.5 rounded-full shrink-0 ${STATE_BADGE_CLASSES[state]}`}>
                        {state.toUpperCase()}
                      </span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                      {state === DiplomaticState.NEUTRAL && (
                        <ActionButton
                          label="Declare War"
                          colorClass="border-error text-error hover:bg-error/10"
                          disabled={busy}
                          onClick={() => handleDeclareWar(other.id)}
                        />
                      )}
                      {state === DiplomaticState.WAR && (
                        <ActionButton
                          label="Propose Peace"
                          colorClass="border-primary text-primary hover:bg-primary/10"
                          disabled={busy}
                          onClick={() => setPeaceTarget({ id: other.id, name: other.countryName })}
                        />
                      )}
                      {(state === DiplomaticState.NEUTRAL || state === DiplomaticState.PEACE) && (
                        <ActionButton
                          label="Propose Alliance"
                          colorClass="border-primary text-primary hover:bg-primary/10"
                          disabled={busy}
                          onClick={() => setNegotiation({ receiverId: other.id, receiverName: other.countryName, kind: TreatyKind.ALLIANCE })}
                        />
                      )}
                      {/* Trade, troops pass, and money all require the pair not be at war — DESIGN.md/GAME-MECHANICS.md's
                          "money can be sent to anyone, anytime" was revised: sending money, trading, and passage all
                          now require making peace first, matching the alliance restriction just above. */}
                      {state !== DiplomaticState.ALLIANCE && state !== DiplomaticState.WAR && (
                        <ActionButton
                          label="Propose Troops Pass"
                          colorClass="border-primary text-primary hover:bg-primary/10"
                          disabled={busy}
                          onClick={() => setNegotiation({ receiverId: other.id, receiverName: other.countryName, kind: TreatyKind.TROOPS_PASS })}
                        />
                      )}
                      {state !== DiplomaticState.WAR && (
                        <ActionButton
                          label="Propose Trade"
                          colorClass="border-secondary text-secondary hover:bg-secondary/10"
                          disabled={busy}
                          onClick={() => setNegotiation({ receiverId: other.id, receiverName: other.countryName, kind: TreatyKind.TRADE })}
                        />
                      )}
                      <ActionButton
                        label="Propose Article"
                        colorClass="border-primary text-primary hover:bg-primary/10"
                        disabled={busy}
                        onClick={() => setNegotiation({ receiverId: other.id, receiverName: other.countryName, kind: TreatyKind.ARTICLE })}
                      />
                      {state !== DiplomaticState.WAR && (
                        <ActionButton
                          label="Send Money"
                          colorClass="border-primary text-primary hover:bg-primary/10"
                          disabled={busy}
                          onClick={() => setMoneyTarget({ id: other.id, name: other.countryName })}
                        />
                      )}
                      <button
                        onClick={() => setTreatiesOf({ id: other.id, name: other.countryName })}
                        className="bg-transparent col-span-full border border-primary text-primary py-1.5 font-headline text-[11px] tracking-[0.2em] uppercase hover:bg-primary/10 transition-all rounded-sm cursor-pointer"
                      >
                        Player Treaties
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
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

      <Dialog
        open={!!moneyTarget}
        onClose={() => setMoneyTarget(null)}
        maxWidth="xs"
        fullWidth
        disablePortal
        slotProps={{
          paper: {
            className: '!bg-surface-container !text-on-surface !shadow-2xl !rounded-sm !overflow-hidden',
          },
        }}
      >
        <div className="relative">
          <div className="absolute top-0 left-0 h-[1px] w-full bg-gradient-to-r from-transparent via-primary/40 to-transparent" />
          <div className="p-6 flex flex-col gap-4">
            <h2 className="font-headline text-sm tracking-[0.2em] uppercase text-primary">
              Send Money to {moneyTarget?.name}
            </h2>
            <input
              type="number"
              min={0}
              placeholder="AMOUNT"
              value={moneyAmount || ''}
              onChange={(e) => setMoneyAmount(Math.max(0, Number(e.target.value)))}
              className="box-border w-full bg-surface-container-lowest border border-outline-variant/20 rounded-sm py-2.5 px-4 text-sm text-white font-headline tracking-wider focus:outline-none focus:border-primary/50 transition-all placeholder:text-on-surface-variant/40"
            />
            <div className="flex gap-2 justify-end">
              <ActionButton
                label="Cancel"
                colorClass="border-outline-variant/40 text-on-surface-variant hover:bg-white/5"
                onClick={() => setMoneyTarget(null)}
              />
              <ActionButton
                label="Send"
                colorClass="border-primary text-primary hover:bg-primary/10"
                disabled={!moneyTarget || moneyAmount <= 0 || busyId === moneyTarget?.id}
                onClick={() => void handleSendMoney()}
              />
            </div>
          </div>
        </div>
      </Dialog>
    </>
  );
};
