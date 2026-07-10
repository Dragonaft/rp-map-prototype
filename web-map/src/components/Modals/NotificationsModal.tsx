import React, { useMemo, useState } from 'react';
import { Dialog } from '@mui/material';
import MDEditor from '@uiw/react-md-editor';
import { useAppDispatch, useAppSelector } from '../../store/hooks';
import { diplomacyApi } from '../../api/diplomacy';
import { setRelations, setTreaties, setWars } from '../../store/slices/diplomacySlice';
import { AppNotification, NotificationSeverity, NotificationType, Province, Treaty, TreatyArticle, TreatyStatus } from '../../types';
import { ActionButton } from '../ActionButton.tsx';
import { RESOURCE_ICONS } from '../../constants/buildingIcons.ts';
import { APP_VERSION } from '../../constants/appVersion.ts';
import { DEFAULT_MAP_LAND_COLOR, DEFAULT_MAP_WATER_COLOR } from '../../utils/mapModes.ts';
import { notificationsApi } from '../../api/notifications.ts';
import { setNotifications } from '../../store/slices/notificationsSlice.ts';
import { newsApi } from '../../api/news.ts';
import { setAgencies } from '../../store/slices/newsSlice.ts';
import { MyNewsAgency } from '../../types';
import { NewsAgencyArticlesModal } from './NewsAgencyArticlesModal.tsx';

const SEVERITY_ICON: Record<NotificationSeverity, string> = {
  [NotificationSeverity.ERROR]: 'error',
  [NotificationSeverity.WARNING]: 'warning',
  [NotificationSeverity.INFO]: 'info',
};
const SEVERITY_TEXT_CLASS: Record<NotificationSeverity, string> = {
  [NotificationSeverity.ERROR]: 'text-error',
  [NotificationSeverity.WARNING]: 'text-secondary',
  [NotificationSeverity.INFO]: 'text-primary',
};
const SEVERITY_UNREAD_BORDER_CLASS: Record<NotificationSeverity, string> = {
  [NotificationSeverity.ERROR]: 'border-l-4 border-l-error',
  [NotificationSeverity.WARNING]: 'border-l-4 border-l-secondary',
  [NotificationSeverity.INFO]: 'border-l-4 border-l-primary',
};

/** Fixed semantic colors for the "territory at stake" mini-map — see PeaceNegotiationModal for the sibling picker version. */
const CEDE_GAIN_COLOR = '#16a34a';
const CEDE_LOSS_COLOR = '#ef4444';

interface Props {
  open: boolean;
  onClose: () => void;
}

type Tab = 'treaties' | 'news' | 'system' | 'newswall';

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
  const currentUserColor = useAppSelector((state) => state.user.color);
  const otherUsers = useAppSelector((state) => state.otherUsers.otherUsers);
  const treaties = useAppSelector((state) => state.diplomacy.treaties);
  const provinces = useAppSelector((state) => state.provinces.provinces);
  const provinceBBoxById = useAppSelector((state) => state.provinces.provinceBBoxById);
  const notifications = useAppSelector((state) => state.notifications.mine);
  const agencies = useAppSelector((state) => state.news.agencies);
  const [myAgency, setMyAgency] = useState<MyNewsAgency | null>(null);
  const [agencyNameInput, setAgencyNameInput] = useState('');
  const [renaming, setRenaming] = useState(false);
  const [renameInput, setRenameInput] = useState('');
  const [composing, setComposing] = useState(false);
  const [articleTitle, setArticleTitle] = useState('');
  const [articleContent, setArticleContent] = useState('');
  const [newsBusy, setNewsBusy] = useState(false);
  const [newsError, setNewsError] = useState<string | null>(null);
  const [viewingAgency, setViewingAgency] = useState<{ id: string; name: string } | null>(null);

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

  const provinceOwnerColor = (p: Province): string => {
    if (p.type === 'water') return DEFAULT_MAP_WATER_COLOR;
    if (!p.userId) return DEFAULT_MAP_LAND_COLOR;
    if (p.userId === currentUserId) return currentUserColor;
    return otherUsers.find((u) => u.id === p.userId)?.color ?? DEFAULT_MAP_LAND_COLOR;
  };

  /**
   * A small read-only map of exactly the province(s) a pending peace proposal would cede,
   * plus their immediate neighbors for orientation, so the viewer can see at a glance what
   * territory they'd lose (red) or gain (green) before deciding — the real geometry, not a
   * schematic, same technique as PeaceNegotiationModal's interactive picker but static.
   */
  const renderCededProvincesMap = (treaty: Treaty) => {
    const cedeArticles = treaty.articles.filter(
      (a): a is Extract<TreatyArticle, { type: 'cede_province' }> => a.type === 'cede_province',
    );
    if (!cedeArticles.length) return null;

    const cededById = new Map(cedeArticles.map((a) => [a.provinceId, a]));
    const contextIds = new Set(cededById.keys());
    for (const id of cededById.keys()) {
      const p = provinces.find((pp) => pp.id === id);
      (p?.neighbors ?? []).forEach((n) => contextIds.add(n));
    }
    const mapProvinces = provinces.filter((p) => contextIds.has(p.id));
    if (!mapProvinces.length) return null;

    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const p of mapProvinces) {
      const bbox = provinceBBoxById[p.id];
      if (!bbox) continue;
      minX = Math.min(minX, bbox.x);
      minY = Math.min(minY, bbox.y);
      maxX = Math.max(maxX, bbox.x + bbox.width);
      maxY = Math.max(maxY, bbox.y + bbox.height);
    }
    if (!isFinite(minX)) return null;
    const pad = Math.max(20, (maxX - minX) * 0.08);
    const viewBox = `${minX - pad} ${minY - pad} ${(maxX - minX) + pad * 2} ${(maxY - minY) + pad * 2}`;

    return (
      <div className="mt-3">
        <div className="flex items-center justify-between mb-1.5 flex-wrap gap-2">
          <span className="font-headline text-[10px] uppercase tracking-widest text-on-surface-variant">Territory at stake</span>
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full inline-block" style={{ backgroundColor: CEDE_LOSS_COLOR }} />
              <span className="font-headline text-[9px] uppercase tracking-widest text-on-surface-variant">You lose</span>
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full inline-block" style={{ backgroundColor: CEDE_GAIN_COLOR }} />
              <span className="font-headline text-[9px] uppercase tracking-widest text-on-surface-variant">You gain</span>
            </span>
          </div>
        </div>
        <svg
          viewBox={viewBox}
          preserveAspectRatio="xMidYMid meet"
          className="w-full h-40 bg-black border border-solid border-outline-variant/20 rounded-sm"
        >
          {mapProvinces.map((p) => {
            const article = cededById.get(p.id);
            const fill = article
              ? (article.from === currentUserId ? CEDE_LOSS_COLOR : article.to === currentUserId ? CEDE_GAIN_COLOR : provinceOwnerColor(p))
              : provinceOwnerColor(p);
            return (
              <path
                key={p.id}
                d={p.polygon}
                fill={fill}
                stroke={article ? '#ffffff' : '#0e0e0e'}
                strokeWidth={article ? 2 : 1}
              >
                <title>
                  {p.regionId} ({p.landscape}){article ? ` — ${nameFor(article.to)} would gain this from ${nameFor(article.from)}` : ''}
                </title>
              </path>
            );
          })}
        </svg>
      </div>
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

  /** News = admin broadcasts; System Logs = auto-generated (failed actions, system messages). */
  const { newsItems, systemItems } = useMemo(() => {
    const newsItems: AppNotification[] = [];
    const systemItems: AppNotification[] = [];
    for (const n of notifications) {
      if (n.type === NotificationType.ADMIN) newsItems.push(n);
      else systemItems.push(n);
    }
    const byNewest = (a: AppNotification, b: AppNotification) => (a.createdAt < b.createdAt ? 1 : -1);
    newsItems.sort(byNewest);
    systemItems.sort(byNewest);
    return { newsItems, systemItems };
  }, [notifications]);

  const unreadNewsCount = useMemo(() => newsItems.filter((n) => !n.is_read).length, [newsItems]);
  const unreadSystemCount = useMemo(() => systemItems.filter((n) => !n.is_read).length, [systemItems]);

  const renderNotificationRow = (n: AppNotification) => (
    <div
      key={n.id}
      className={`flex items-start gap-3 bg-surface-container-low border border-solid border-outline-variant/20 p-4 ${!n.is_read ? SEVERITY_UNREAD_BORDER_CLASS[n.severity] : ''}`}
    >
      <span className={`material-symbols-outlined text-lg shrink-0 ${SEVERITY_TEXT_CLASS[n.severity]}`}>
        {SEVERITY_ICON[n.severity]}
      </span>
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <h3 className="font-headline text-sm uppercase tracking-wider text-on-surface">{n.title}</h3>
          <span className="font-body text-[10px] text-on-surface-variant/60 shrink-0">
            {new Date(n.createdAt).toLocaleString()}
          </span>
        </div>
        <p className="mt-1 font-body text-xs text-on-surface-variant whitespace-pre-wrap">{n.message}</p>
      </div>
    </div>
  );

  const handleTabClick = (t: Tab) => {
    setTab(t);
    if (t === 'news' && unreadNewsCount > 0) {
      void notificationsApi.markAllRead(NotificationType.ADMIN).catch(() => {});
      dispatch(setNotifications(notifications.map((n) => (n.type === NotificationType.ADMIN ? { ...n, is_read: true } : n))));
    }
    if (t === 'system' && unreadSystemCount > 0) {
      void Promise.all([
        notificationsApi.markAllRead(NotificationType.ACTION_FAILED),
        notificationsApi.markAllRead(NotificationType.SYSTEM),
      ]).catch(() => {});
      dispatch(setNotifications(notifications.map((n) => (n.type !== NotificationType.ADMIN ? { ...n, is_read: true } : n))));
    }
    if (t === 'newswall') {
      void refreshNewsWall();
    }
  };

  const refreshNewsWall = async () => {
    const [agencyList, mine] = await Promise.all([newsApi.getAgencies(), newsApi.getMine()]);
    dispatch(setAgencies(agencyList));
    setMyAgency(mine);
  };

  const handleCreateAgency = async () => {
    if (!agencyNameInput.trim()) return;
    setNewsBusy(true);
    setNewsError(null);
    try {
      await newsApi.createAgency(agencyNameInput.trim());
      setAgencyNameInput('');
      await refreshNewsWall();
    } catch (e: any) {
      setNewsError(e?.response?.data?.message || 'Failed to create agency');
    } finally {
      setNewsBusy(false);
    }
  };

  const handleRenameAgency = async () => {
    if (!renameInput.trim()) return;
    setNewsBusy(true);
    setNewsError(null);
    try {
      await newsApi.renameAgency(renameInput.trim());
      setRenaming(false);
      await refreshNewsWall();
    } catch (e: any) {
      setNewsError(e?.response?.data?.message || 'Failed to rename agency');
    } finally {
      setNewsBusy(false);
    }
  };

  const handlePublishArticle = async () => {
    if (!articleTitle.trim() || !articleContent.trim()) {
      setNewsError('Title and content are required');
      return;
    }
    setNewsBusy(true);
    setNewsError(null);
    try {
      await newsApi.createArticle(articleTitle.trim(), articleContent);
      setArticleTitle('');
      setArticleContent('');
      setComposing(false);
      await refreshNewsWall();
    } catch (e: any) {
      setNewsError(e?.response?.data?.message || 'Failed to publish article');
    } finally {
      setNewsBusy(false);
    }
  };

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

        {treaty.note && (
          treaty.kind === 'article' ? (
            <div className="mt-2" data-color-mode="dark">
              <MDEditor.Markdown source={treaty.note} style={{ backgroundColor: 'transparent', fontSize: '0.75rem' }} />
            </div>
          ) : (
            <div className="mt-2 font-body text-xs text-on-surface-variant/80 whitespace-pre-wrap">{treaty.note}</div>
          )
        )}
        {renderArticlesSummary(treaty)}
        {isPending && treaty.kind === 'peace' && renderCededProvincesMap(treaty)}

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
    { id: 'news', label: `NEWS${unreadNewsCount ? ` (${unreadNewsCount})` : ''}` },
    { id: 'system', label: `SYSTEM_LOGS${unreadSystemCount ? ` (${unreadSystemCount})` : ''}` },
    { id: 'newswall', label: 'NEWS_WALL' },
  ];

  return (
    <>
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
              onClick={() => handleTabClick(t.id)}
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
            <div className="flex flex-col gap-3">
              {newsItems.length === 0 && (
                <div className="font-headline text-xs uppercase tracking-widest text-on-surface-variant text-center py-16">
                  No news yet.
                </div>
              )}
              {newsItems.map(renderNotificationRow)}
            </div>
          )}
          {tab === 'system' && (
            <div className="flex flex-col gap-3">
              {systemItems.length === 0 && (
                <div className="font-headline text-xs uppercase tracking-widest text-on-surface-variant text-center py-16">
                  No system messages yet.
                </div>
              )}
              {systemItems.map(renderNotificationRow)}
            </div>
          )}
          {tab === 'newswall' && (
            <div className="flex flex-col gap-6">
              <div className="bg-surface-container-low border border-solid border-outline-variant/20 p-4">
                <div className="font-headline text-[10px] uppercase tracking-widest text-on-surface-variant mb-3">My_agency</div>

                {newsError && (
                  <p className="mb-3 font-headline text-xs tracking-wide text-error border border-solid border-error/30 bg-error/10 rounded-sm px-3 py-2">
                    {newsError}
                  </p>
                )}

                {!myAgency?.agency && (
                  <div className="flex gap-2 flex-wrap items-center">
                    <input
                      type="text"
                      value={agencyNameInput}
                      onChange={(e) => setAgencyNameInput(e.target.value)}
                      placeholder="ENTER_AGENCY_NAME..."
                      className="box-border flex-1 min-w-[180px] bg-surface-container-lowest border border-solid border-outline-variant/20 rounded-sm px-3 py-2 text-sm text-white font-headline tracking-wider focus:outline-none focus:border-primary/50 transition-all placeholder:text-on-surface-variant/40"
                    />
                    <ActionButton
                      label="Register_agency"
                      colorClass="border-primary text-primary hover:bg-primary/10"
                      disabled={newsBusy || !agencyNameInput.trim()}
                      onClick={() => void handleCreateAgency()}
                    />
                  </div>
                )}

                {myAgency?.agency && (
                  <div className="flex flex-col gap-3">
                    <div className="flex items-center justify-between gap-3 flex-wrap">
                      {!renaming ? (
                        <div className="flex items-center gap-2">
                          <h3 className="font-headline text-sm uppercase tracking-wider text-on-surface">{myAgency.agency.name}</h3>
                          <button
                            type="button"
                            onClick={() => { setRenameInput(myAgency.agency!.name); setRenaming(true); }}
                            className="bg-transparent border-none p-0.5 text-on-surface-variant/60 hover:text-primary transition-colors cursor-pointer"
                            aria-label="Rename agency"
                          >
                            <span className="material-symbols-outlined text-base">edit</span>
                          </button>
                        </div>
                      ) : (
                        <div className="flex items-center gap-2 flex-1 min-w-[200px]">
                          <input
                            type="text"
                            value={renameInput}
                            onChange={(e) => setRenameInput(e.target.value)}
                            className="box-border flex-1 bg-surface-container-lowest border border-solid border-outline-variant/20 rounded-sm px-3 py-1.5 text-sm text-white font-headline tracking-wider focus:outline-none focus:border-primary/50"
                          />
                          <ActionButton
                            label="Save"
                            colorClass="border-primary text-primary hover:bg-primary/10"
                            disabled={newsBusy || !renameInput.trim()}
                            onClick={() => void handleRenameAgency()}
                          />
                          <ActionButton
                            label="Cancel"
                            colorClass="border-outline-variant/40 text-on-surface-variant hover:bg-white/5"
                            disabled={newsBusy}
                            onClick={() => setRenaming(false)}
                          />
                        </div>
                      )}
                      <span className="font-headline text-[10px] uppercase tracking-widest text-on-surface-variant shrink-0">
                        {myAgency.articlesToday}/{myAgency.articlesToday + myAgency.remainingToday} articles_published_today
                      </span>
                    </div>

                    {!composing ? (
                      <ActionButton
                        label="Publish_article"
                        colorClass="border-primary text-primary hover:bg-primary/10"
                        disabled={myAgency.remainingToday <= 0}
                        onClick={() => setComposing(true)}
                      />
                    ) : (
                      <div className="flex flex-col gap-2 bg-surface-container-lowest/50 border border-solid border-outline-variant/10 p-3">
                        <input
                          type="text"
                          value={articleTitle}
                          onChange={(e) => setArticleTitle(e.target.value)}
                          placeholder="ENTER_ARTICLE_TITLE..."
                          className="box-border w-full bg-surface-container-lowest border border-solid border-outline-variant/20 rounded-sm px-3 py-2 text-sm text-white font-headline tracking-wider focus:outline-none focus:border-primary/50 transition-all placeholder:text-on-surface-variant/40"
                        />
                        <div data-color-mode="dark" className="rounded-sm overflow-hidden border border-solid border-outline-variant/20">
                          <MDEditor
                            value={articleContent}
                            onChange={(v) => setArticleContent(v ?? '')}
                            height={220}
                            preview="edit"
                            textareaProps={{ placeholder: 'ENTER_ARTICLE_TEXT_(MARKDOWN)...' }}
                          />
                        </div>
                        <div className="flex gap-2 justify-end">
                          <ActionButton
                            label="Cancel"
                            colorClass="border-outline-variant/40 text-on-surface-variant hover:bg-white/5"
                            disabled={newsBusy}
                            onClick={() => { setComposing(false); setArticleTitle(''); setArticleContent(''); }}
                          />
                          <ActionButton
                            label="Publish"
                            colorClass="border-primary text-primary hover:bg-primary/10"
                            disabled={newsBusy || !articleTitle.trim() || !articleContent.trim()}
                            onClick={() => void handlePublishArticle()}
                          />
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>

              <div className="flex flex-col gap-3">
                <div className="font-headline text-[10px] uppercase tracking-widest text-on-surface-variant">Agencies</div>
                {agencies.length === 0 && (
                  <div className="font-headline text-xs uppercase tracking-widest text-on-surface-variant text-center py-16">
                    No agencies registered yet
                  </div>
                )}
                {agencies.map((a) => (
                  <div
                    key={a.id}
                    className="flex items-center justify-between gap-3 bg-surface-container-low border border-solid border-outline-variant/20 p-4 cursor-pointer transition-colors hover:bg-surface-container-high"
                    onClick={() => setViewingAgency({ id: a.id, name: a.name })}
                  >
                    <div className="flex flex-col min-w-0">
                      <h3 className="font-headline text-sm uppercase tracking-wider text-on-surface truncate">{a.name}</h3>
                      <span className="font-body text-xs text-on-surface-variant">{nameFor(a.user_id)}</span>
                    </div>
                    <span className="material-symbols-outlined text-on-surface-variant/60">chevron_right</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </Dialog>
    {viewingAgency && (
      <NewsAgencyArticlesModal
        open={!!viewingAgency}
        onClose={() => setViewingAgency(null)}
        agencyId={viewingAgency.id}
        agencyName={viewingAgency.name}
      />
    )}
    </>
  );
};
