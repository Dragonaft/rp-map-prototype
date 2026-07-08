import React, { useMemo, useState } from 'react';
import { Button, Chip, Dialog, DialogContent, DialogTitle, IconButton, Tab, Tabs } from '@mui/material';
import { useAppDispatch, useAppSelector } from '../../store/hooks';
import { diplomacyApi } from '../../api/diplomacy';
import { setRelations, setTreaties, setWars } from '../../store/slices/diplomacySlice';
import { Treaty, TreatyStatus } from '../../types';

interface Props {
  open: boolean;
  onClose: () => void;
}

const KIND_LABELS: Record<string, string> = {
  peace: 'Peace',
  alliance: 'Alliance',
  trade: 'Trade',
  troops_pass: 'Troops Pass',
  article: 'Article',
};

export const NotificationsModal: React.FC<Props> = ({ open, onClose }) => {
  const dispatch = useAppDispatch();
  const [tab, setTab] = useState<'treaties' | 'news' | 'system'>('treaties');
  const [busyId, setBusyId] = useState<string | null>(null);
  const currentUserId = useAppSelector((state) => state.user.id);
  const otherUsers = useAppSelector((state) => state.otherUsers.otherUsers);
  const treaties = useAppSelector((state) => state.diplomacy.treaties);
  const provinces = useAppSelector((state) => state.provinces.provinces);

  const nameFor = (userId: string): string => {
    if (userId === currentUserId) return 'You';
    return otherUsers.find((u) => u.id === userId)?.countryName ?? 'Unknown';
  };

  const provinceLabel = (provinceId: string): string => {
    const p = provinces.find((pp) => pp.id === provinceId);
    return p ? `${p.regionId} (${p.landscape})` : provinceId;
  };

  /** For a peace proposal: exactly what's being demanded/ceded/paid, so the receiver can review it in full before answering. */
  const renderArticlesSummary = (treaty: Treaty) => {
    if (!treaty.articles.length) return null;
    return (
      <ul className="text-xs text-white/70 list-disc list-inside">
        {treaty.articles.map((article, i) => {
          switch (article.type) {
            case 'cede_province':
              return <li key={i}>{nameFor(article.to)} annexes {provinceLabel(article.provinceId)} from {nameFor(article.from)}</li>;
            case 'money_tribute':
              return <li key={i}>{nameFor(article.from)} pays {article.amount} money to {nameFor(article.to)}</li>;
            case 'resource_tribute':
              return <li key={i}>{nameFor(article.from)} pays {article.amount} {article.resourceKey} to {nameFor(article.to)}</li>;
            case 'goods_tribute':
              return <li key={i}>{nameFor(article.from)} sends {article.amount} goods to {nameFor(article.to)}</li>;
            case 'grant_pass':
              return <li key={i}>{nameFor(article.from)} grants troop passage to {nameFor(article.to)}</li>;
            default:
              return null;
          }
        })}
      </ul>
    );
  };

  const { pending, log } = useMemo(() => {
    const pending: Treaty[] = [];
    const log: Treaty[] = [];
    for (const t of treaties) {
      if (t.status === TreatyStatus.PENDING) pending.push(t);
      else log.push(t);
    }
    pending.sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
    log.sort((a, b) => ((a.resolved_at ?? a.createdAt) < (b.resolved_at ?? b.createdAt) ? 1 : -1));
    return { pending, log };
  }, [treaties]);

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

  const withBusy = async (id: string, fn: () => Promise<unknown>) => {
    setBusyId(id);
    try {
      await fn();
      await refresh();
    } catch (e: any) {
      console.error(e?.response?.data?.message || 'Action failed');
    } finally {
      setBusyId(null);
    }
  };

  const renderTreatyRow = (treaty: Treaty, isPending: boolean) => {
    const iAmReceiver = treaty.receiver_id === currentUserId;
    const iAmProposer = treaty.proposer_id === currentUserId;
    const canRespond = isPending && iAmReceiver && !treaty.view_only;
    const canCancelProposal = isPending && iAmProposer;
    const canCancelSigned = !isPending && treaty.status === TreatyStatus.ACCEPTED
      && (iAmProposer || iAmReceiver)
      && (treaty.kind === 'alliance' || treaty.kind === 'troops_pass');

    return (
      <div
        key={treaty.id}
        className="flex flex-col gap-1 p-3 rounded border border-outline-variant/20 bg-surface-container"
      >
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <span className="font-headline font-bold text-white text-sm">{treaty.name}</span>
            <Chip label={KIND_LABELS[treaty.kind] ?? treaty.kind} size="small" />
            {treaty.visibility === 'public' && <Chip label="Public" size="small" color="info" />}
            {treaty.view_only && <Chip label="View only" size="small" color="default" />}
            {treaty.recurring && <Chip label="Recurring" size="small" color="secondary" />}
          </div>
          <span className="text-xs text-white/50 uppercase">{treaty.status}</span>
        </div>
        <div className="text-xs text-white/70">
          {nameFor(treaty.proposer_id)} → {nameFor(treaty.receiver_id)}
        </div>
        {treaty.note && <div className="text-xs text-white/60 whitespace-pre-wrap">{treaty.note}</div>}
        {renderArticlesSummary(treaty)}
        {(canRespond || canCancelProposal || canCancelSigned) && (
          <div className="flex gap-2 mt-1">
            {canRespond && (
              <>
                <Button
                  size="small" variant="contained" color="success" disabled={busyId === treaty.id}
                  onClick={() => withBusy(treaty.id, () => diplomacyApi.accept(treaty.id))}
                >
                  Accept
                </Button>
                <Button
                  size="small" variant="outlined" color="error" disabled={busyId === treaty.id}
                  onClick={() => withBusy(treaty.id, () => diplomacyApi.reject(treaty.id))}
                >
                  Reject
                </Button>
              </>
            )}
            {canCancelProposal && (
              <Button
                size="small" variant="outlined" disabled={busyId === treaty.id}
                onClick={() => withBusy(treaty.id, () => diplomacyApi.cancelProposal(treaty.id))}
              >
                Cancel
              </Button>
            )}
            {canCancelSigned && (
              <Button
                size="small" variant="outlined" color="warning" disabled={busyId === treaty.id}
                onClick={() => withBusy(treaty.id, () => diplomacyApi.cancelSigned(treaty.id))}
              >
                Cancel Treaty
              </Button>
            )}
          </div>
        )}
      </div>
    );
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        Notifications
        <IconButton onClick={onClose} size="small">
          <span className="material-symbols-outlined text-sm" data-icon="close">close</span>
        </IconButton>
      </DialogTitle>
      <Tabs value={tab} onChange={(_, v) => setTab(v)} sx={{ px: 2 }}>
        <Tab value="treaties" label={`Treaties${pending.length ? ` (${pending.length})` : ''}`} />
        <Tab value="news" label="News" />
        <Tab value="system" label="System" />
      </Tabs>
      <DialogContent dividers sx={{ display: 'flex', flexDirection: 'column', gap: 2, minHeight: 300 }}>
        {tab === 'treaties' && (
          <>
            {pending.length === 0 && log.length === 0 && (
              <div className="text-sm text-white/50 text-center py-8">No treaties yet</div>
            )}
            {pending.length > 0 && (
              <div className="flex flex-col gap-2">
                <div className="text-xs uppercase tracking-widest text-white/40">Awaiting response</div>
                {pending.map((t) => renderTreatyRow(t, true))}
              </div>
            )}
            {log.length > 0 && (
              <div className="flex flex-col gap-2">
                <div className="text-xs uppercase tracking-widest text-white/40">History</div>
                {log.map((t) => renderTreatyRow(t, false))}
              </div>
            )}
          </>
        )}
        {tab === 'news' && (
          <div className="text-sm text-white/50 text-center py-8">
            No news yet — coming soon.
          </div>
        )}
        {tab === 'system' && (
          <div className="text-sm text-white/50 text-center py-8">
            No system messages yet — coming soon.
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};
