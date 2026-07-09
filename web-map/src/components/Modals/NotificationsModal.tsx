import React, { useMemo, useState } from 'react';
import { Dialog } from '@mui/material';
import { useAppDispatch, useAppSelector } from '../../store/hooks';
import { diplomacyApi } from '../../api/diplomacy';
import { setRelations, setTreaties, setWars } from '../../store/slices/diplomacySlice';
import { Treaty, TreatyStatus } from '../../types';
import { ActionButton } from '../ActionButton.tsx';
import { RESOURCE_ICONS } from '../../constants/buildingIcons.ts';
import { APP_VERSION } from '../../constants/appVersion.ts';

interface Props {
  open: boolean;
  onClose: () => void;
}

type Tab = 'treaties' | 'news' | 'system';

const KIND_LABELS: Record<string, string> = {
  peace: 'Peace',
  alliance: 'Alliance',
  trade: 'Trade',
  troops_pass: 'Troops Pass',
  article: 'Article',
};

/** Neutral, always-gray badge shape shared by every small tag on a treaty card. */
const TAG_CLASS = 'px-2 py-0.5 border border-solid text-[10px] font-headline font-bold uppercase rounded-sm leading-none';

export const NotificationsModal: React.FC<Props> = ({ open, onClose }) => {
  const dispatch = useAppDispatch();
  const [tab, setTab] = useState<Tab>('treaties');
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
      <ul className="mt-3 list-disc list-inside pl-2 space-y-1.5 font-body text-xs text-on-surface-variant">
        {treaty.articles.map((article, i) => {
          switch (article.type) {
            case 'cede_province':
              return (
                <li key={i}>
                  {nameFor(article.to)} annexes{' '}
                  <span className="font-mono text-secondary text-[13px]">{provinceLabel(article.provinceId)}</span>
                  {' '}from {nameFor(article.from)}
                </li>
              );
            case 'money_tribute':
              return (
                <li key={i}>
                  {nameFor(article.from)} pays <span className="text-secondary font-bold">💰 {article.amount} money</span> to {nameFor(article.to)}
                </li>
              );
            case 'resource_tribute':
              return (
                <li key={i}>
                  {nameFor(article.from)} pays{' '}
                  <span className="text-secondary font-bold">{RESOURCE_ICONS[article.resourceKey] ?? '📦'} {article.amount} {article.resourceKey}</span>
                  {' '}to {nameFor(article.to)}
                </li>
              );
            case 'goods_tribute':
              return (
                <li key={i}>
                  {nameFor(article.from)} sends <span className="text-secondary font-bold">📦 {article.amount} goods</span> to {nameFor(article.to)}
                </li>
              );
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

  /** Status dot + tag color — pulses only while a response from *me* is actually pending, matching the app's existing "pulse = needs attention now" convention (see LoginPage's queue-status dot). */
  const statusVisual = (treaty: Treaty, isPending: boolean, iAmReceiver: boolean): { dot: string; pulse: boolean; tagClass: string; label: string } => {
    if (isPending) {
      return iAmReceiver
        ? { dot: 'bg-secondary', pulse: true, tagClass: 'bg-secondary/10 border-secondary/30 text-secondary', label: 'Pending' }
        : { dot: 'bg-on-surface-variant', pulse: false, tagClass: 'bg-surface-container-highest border-outline-variant/30 text-on-surface-variant', label: 'Pending' };
    }
    switch (treaty.status) {
      case TreatyStatus.ACCEPTED:
        return { dot: 'bg-green-500', pulse: false, tagClass: 'bg-green-500/10 border-green-500/30 text-green-500', label: 'Accepted' };
      case TreatyStatus.REJECTED:
        return { dot: 'bg-error', pulse: false, tagClass: 'bg-error/10 border-error/30 text-error', label: 'Rejected' };
      case TreatyStatus.CANCELLED:
        return { dot: 'bg-error', pulse: false, tagClass: 'bg-error/20 border-error/40 text-error', label: 'Cancelled' };
      default:
        return { dot: 'bg-on-surface-variant', pulse: false, tagClass: 'bg-surface-container-highest border-outline-variant/30 text-on-surface-variant', label: treaty.status };
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
    const busy = busyId === treaty.id;
    const visual = statusVisual(treaty, isPending, iAmReceiver);

    return (
      <div
        key={treaty.id}
        className="bg-surface-container-low border border-solid border-outline-variant/20 p-4 transition-colors hover:bg-surface-container-high"
      >
        <div className="flex justify-between items-start gap-3 mb-3 flex-wrap">
          <div className="flex items-center gap-3 min-w-0">
            <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${visual.dot} ${visual.pulse ? 'animate-pulse' : ''}`} />
            <h3 className="font-headline text-sm uppercase tracking-wider text-on-surface truncate">{treaty.name}</h3>
          </div>
          <div className="flex gap-2 flex-wrap shrink-0">
            <span className={`${TAG_CLASS} bg-surface-container-highest border-outline-variant/30 text-on-surface-variant`}>
              {KIND_LABELS[treaty.kind] ?? treaty.kind}
            </span>
            {treaty.visibility === 'public' && (
              <span className={`${TAG_CLASS} bg-primary-dim border-primary-dim text-on-primary-fixed`}>Public</span>
            )}
            {treaty.view_only && (
              <span className={`${TAG_CLASS} bg-surface-container-highest border-outline-variant/30 text-on-surface-variant`}>View only</span>
            )}
            {treaty.recurring && (
              <span className={`${TAG_CLASS} bg-secondary/10 border-secondary/30 text-secondary`}>Recurring</span>
            )}
            <span className={`${TAG_CLASS} ${visual.tagClass}`}>{visual.label}</span>
          </div>
        </div>

        <div className="flex items-center gap-2 font-body text-sm text-on-surface-variant">
          <span className={iAmProposer ? 'text-primary font-bold uppercase' : 'text-secondary'}>{nameFor(treaty.proposer_id)}</span>
          <span className="material-symbols-outlined text-[14px]">arrow_forward</span>
          <span className={iAmReceiver ? 'text-primary font-bold uppercase' : 'text-secondary'}>{nameFor(treaty.receiver_id)}</span>
        </div>

        {treaty.note && <div className="mt-2 font-body text-xs text-on-surface-variant/80 whitespace-pre-wrap">{treaty.note}</div>}
        {renderArticlesSummary(treaty)}

        {(canRespond || canCancelProposal || canCancelSigned) && (
          <div className="flex gap-2 mt-3 flex-wrap">
            {canRespond && (
              <>
                <ActionButton
                  label="Accept"
                  colorClass="border-green-500 text-green-500 hover:bg-green-500/10"
                  disabled={busy}
                  onClick={() => withBusy(treaty.id, () => diplomacyApi.accept(treaty.id))}
                />
                <ActionButton
                  label="Reject"
                  colorClass="border-error text-error hover:bg-error/10"
                  disabled={busy}
                  onClick={() => withBusy(treaty.id, () => diplomacyApi.reject(treaty.id))}
                />
              </>
            )}
            {canCancelProposal && (
              <ActionButton
                label="Cancel"
                colorClass="border-outline-variant/40 text-on-surface-variant hover:bg-white/5"
                disabled={busy}
                onClick={() => withBusy(treaty.id, () => diplomacyApi.cancelProposal(treaty.id))}
              />
            )}
            {canCancelSigned && (
              <ActionButton
                label="Cancel Treaty"
                colorClass="border-secondary text-secondary hover:bg-secondary/10"
                disabled={busy}
                onClick={() => withBusy(treaty.id, () => diplomacyApi.cancelSigned(treaty.id))}
              />
            )}
          </div>
        )}
      </div>
    );
  };

  const tabs: { id: Tab; label: string }[] = [
    { id: 'treaties', label: `TREATIES${pending.length ? ` (${pending.length})` : ''}` },
    { id: 'news', label: 'NEWS' },
    { id: 'system', label: 'SYSTEM_LOGS' },
  ];

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="sm"
      fullWidth
      disablePortal
      slotProps={{
        paper: {
          className: '!bg-surface-container !text-on-surface !shadow-2xl !rounded-sm !max-w-xl !overflow-hidden !h-[720px] !max-h-[85vh]',
        },
      }}
    >
      <div className="relative flex flex-col h-full">
        <div className="absolute top-0 left-0 h-[1px] w-full bg-gradient-to-r from-transparent via-primary/40 to-transparent" />

        {/* Header */}
        <div className="px-6 py-5 border-b border-solid border-outline-variant/20 flex justify-between items-start shrink-0">
          <div className="flex flex-col gap-1">
            <div className="flex items-center gap-3">
              <span className="material-symbols-outlined text-primary" style={{ fontVariationSettings: "'FILL' 1" }}>notifications_active</span>
              <h1 className="font-headline text-xl uppercase tracking-widest text-primary glow-text-primary">Notifications_center</h1>
            </div>
            <div className="flex items-center gap-4 mt-1">
              <span className="font-body text-[10px] text-on-surface-variant tracking-tighter">{APP_VERSION}</span>
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                <span className="font-headline text-[10px] text-green-500 tracking-widest font-bold uppercase">Status: monitoring</span>
              </div>
            </div>
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            className="bg-transparent border-none text-on-surface-variant hover:text-primary transition-colors cursor-pointer"
          >
            <span className="material-symbols-outlined text-2xl">close</span>
          </button>
        </div>

        {/* Tabs */}
        <nav className="flex border-b border-solid border-outline-variant/20 px-6 shrink-0">
          {tabs.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              className={`bg-transparent border-none border-b-2 py-3 px-5 font-headline text-xs uppercase tracking-widest transition-all cursor-pointer ${
                tab === t.id ? 'text-primary border-primary glow-text-primary' : 'border-transparent text-on-surface-variant hover:text-on-surface'
              }`}
            >
              {t.label}
            </button>
          ))}
        </nav>

        {/* Feed */}
        <div className="flex-1 overflow-y-auto custom-scrollbar p-6">
          {tab === 'treaties' && (
            <div className="flex flex-col gap-6">
              {pending.length === 0 && log.length === 0 && (
                <div className="font-headline text-xs uppercase tracking-widest text-on-surface-variant text-center py-16">
                  No treaties yet
                </div>
              )}
              {pending.length > 0 && (
                <div className="flex flex-col gap-3">
                  <div className="font-headline text-[10px] uppercase tracking-widest text-on-surface-variant">Awaiting response</div>
                  {pending.map((t) => renderTreatyRow(t, true))}
                </div>
              )}
              {log.length > 0 && (
                <div className="flex flex-col gap-3">
                  <div className="font-headline text-[10px] uppercase tracking-widest text-on-surface-variant">History</div>
                  {log.map((t) => renderTreatyRow(t, false))}
                </div>
              )}
            </div>
          )}
          {tab === 'news' && (
            <div className="font-headline text-xs uppercase tracking-widest text-on-surface-variant text-center py-16">
              No news yet — coming soon.
            </div>
          )}
          {tab === 'system' && (
            <div className="font-headline text-xs uppercase tracking-widest text-on-surface-variant text-center py-16">
              No system messages yet — coming soon.
            </div>
          )}
        </div>
      </div>
    </Dialog>
  );
};
