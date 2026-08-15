import React, { useMemo, useState } from 'react';
import { Dialog, Tooltip } from '@mui/material';
import MDEditor from '@uiw/react-md-editor';
import { useAppSelector } from '../../store/hooks';
import { diplomacyApi } from '../../api/diplomacy';
import { TreatyArticle, TreatyKind, TreatyVisibility } from '../../types';
import { ActionButton } from '../ActionButton.tsx';
import { GameIcon } from '../GameIcon.tsx';

interface Props {
  open: boolean;
  onClose: () => void;
  receiverId: string;
  receiverName: string;
  kind: TreatyKind.ALLIANCE | TreatyKind.TRADE | TreatyKind.TROOPS_PASS | TreatyKind.ARTICLE;
  onProposed: () => void;
}

type TributeRow = {
  id: string;
  kind: 'money' | 'resource' | 'goods';
  direction: 'send' | 'receive';
  resourceKey?: string;
  goodId?: string;
  amount: number;
};

const KIND_TITLES: Record<Props['kind'], string> = {
  [TreatyKind.ALLIANCE]: 'PROPOSE_ALLIANCE_PACT',
  [TreatyKind.TRADE]: 'INITIALIZE_TRADE_PROTOCOL',
  [TreatyKind.TROOPS_PASS]: 'PROPOSE_TROOPS_PASSAGE',
  [TreatyKind.ARTICLE]: 'DRAFT_ARTICLE',
};

/** Terminal-style text input — solid opaque field, explicit border-style and text color (see WEB-MAP.md Tailwind gotchas). */
const INPUT_CLASS = 'box-border w-full bg-surface-container-lowest border border-solid border-outline-variant/20 rounded-sm px-3 py-2 text-sm text-white font-headline tracking-wider focus:outline-none focus:border-primary/50 transition-all placeholder:text-on-surface-variant/40';

const goodIcon = (type: string | undefined): string => (type === 'military' ? '⚔️' : '📦');

export const TreatyNegotiationModal: React.FC<Props> = ({ open, onClose, receiverId, receiverName, kind, onProposed }) => {
  const currentUserId = useAppSelector((state) => state.user.id);
  const resources = useAppSelector((state) => state.resources.resources);
  const myGoods = useAppSelector((state) => state.goods.mine);
  const goodsCatalog = useMemo(() => {
    const seen = new Map<string, { name: string; type: string }>();
    for (const holding of myGoods) seen.set(holding.good.id, { name: holding.good.name, type: holding.good.type });
    return Array.from(seen.entries()).map(([id, g]) => ({ id, ...g }));
  }, [myGoods]);

  const [name, setName] = useState('');
  const [visibility, setVisibility] = useState<TreatyVisibility>(TreatyVisibility.PRIVATE);
  const [recurring, setRecurring] = useState(false);
  const [note, setNote] = useState('');
  const [passDirection, setPassDirection] = useState<'grant' | 'request'>('grant');
  const [rows, setRows] = useState<TributeRow[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reset = () => {
    setName(''); setVisibility(TreatyVisibility.PRIVATE); setRecurring(false);
    setNote(''); setPassDirection('grant'); setRows([]); setError(null);
  };

  const handleClose = () => { reset(); onClose(); };

  const addRow = (direction: 'send' | 'receive') => {
    setRows((r) => [...r, { id: `${Date.now()}-${r.length}`, kind: 'money', direction, amount: 0 }]);
  };
  const updateRow = (id: string, patch: Partial<TributeRow>) => {
    setRows((r) => r.map((row) => (row.id === id ? { ...row, ...patch } : row)));
  };
  const removeRow = (id: string) => setRows((r) => r.filter((row) => row.id !== id));

  const offerRows = useMemo(() => rows.filter((r) => r.direction === 'send'), [rows]);
  const demandRows = useMemo(() => rows.filter((r) => r.direction === 'receive'), [rows]);

  const buildArticles = (): TreatyArticle[] => {
    if (kind === TreatyKind.ALLIANCE) {
      return [{ type: 'set_state', state: 'alliance' as any }];
    }
    if (kind === TreatyKind.TROOPS_PASS) {
      const from = passDirection === 'grant' ? currentUserId : receiverId;
      const to = passDirection === 'grant' ? receiverId : currentUserId;
      return [{ type: 'grant_pass', from, to }];
    }
    if (kind === TreatyKind.ARTICLE) {
      return [{ type: 'text', markdown: note }];
    }
    // TRADE
    return rows
      .filter((r) => r.amount > 0)
      .map((r): TreatyArticle => {
        const from = r.direction === 'send' ? currentUserId : receiverId;
        const to = r.direction === 'send' ? receiverId : currentUserId;
        if (r.kind === 'money') return { type: 'money_tribute', amount: r.amount, from, to };
        if (r.kind === 'resource') return { type: 'resource_tribute', resourceKey: r.resourceKey ?? '', amount: r.amount, from, to };
        return { type: 'goods_tribute', goodId: r.goodId ?? '', amount: r.amount, from, to };
      });
  };

  const handleSubmit = async () => {
    if (!name.trim()) { setError('Name is required'); return; }
    if (kind === TreatyKind.ARTICLE && !note.trim()) { setError('Article text is required'); return; }
    if (kind === TreatyKind.TRADE && rows.filter((r) => r.amount > 0).length === 0) { setError('Add at least one transfer'); return; }

    setSaving(true);
    setError(null);
    try {
      await diplomacyApi.propose({
        name: name.trim(),
        receiverId,
        kind,
        visibility,
        recurring: kind === TreatyKind.TRADE ? recurring : undefined,
        articles: buildArticles(),
        note: note.trim() || undefined,
      });
      onProposed();
      handleClose();
    } catch (e: any) {
      setError(e?.response?.data?.message || 'Failed to propose treaty');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog
      open={open}
      onClose={handleClose}
      maxWidth="md"
      fullWidth
      disablePortal
      slotProps={{
        paper: {
          className: '!bg-surface-container !text-on-surface !shadow-2xl !rounded-sm !max-w-3xl !overflow-hidden',
        },
      }}
    >
      <div className="relative">
        {/* Top edge gradient hairline — terminal panel seam detail */}
        <div className="absolute top-0 left-0 h-[1px] w-full bg-gradient-to-r from-transparent via-primary/40 to-transparent" />

        <div className="max-h-[85vh] overflow-y-auto custom-scrollbar">
          <div className="p-6 flex flex-col gap-6">
            {/* Header */}
            <div className="flex justify-between items-start gap-4">
              <div className="flex flex-col gap-1 min-w-0">
                <h1 className="font-headline text-2xl tracking-[0.2em] uppercase glow-text-primary text-primary flex items-center gap-3 flex-wrap">
                  {KIND_TITLES[kind]}
                  <span className="text-[10px] bg-primary/10 text-primary px-2 py-0.5 border border-solid border-primary/30 tracking-normal leading-none rounded-sm">
                    UPLINK_SECURE
                  </span>
                </h1>
                <p className="font-headline text-[10px] tracking-widest text-on-surface-variant uppercase truncate">
                  Target_entity: {receiverName}
                </p>
              </div>
              <button
                onClick={handleClose}
                aria-label="Close"
                disabled={saving}
                className="bg-transparent border-none shrink-0 p-1 text-on-surface-variant hover:text-primary transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <span className="material-symbols-outlined text-2xl">close</span>
              </button>
            </div>

            {error && (
              <p className="font-headline text-xs tracking-wide text-error border border-solid border-error/30 bg-error/10 rounded-sm px-3 py-2">
                {error}
              </p>
            )}

            {/* Parameters row */}
            <div className="flex flex-wrap gap-4 items-end bg-surface-container-low/40 p-4 border border-solid border-outline-variant/10">
              <div className="flex flex-col gap-1.5 flex-1 min-w-[240px]">
                <label className="font-headline text-[10px] tracking-widest text-primary uppercase">Treaty_name</label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="ENTER_TREATY_NAME..."
                  className={INPUT_CLASS}
                />
              </div>
              {kind === TreatyKind.TRADE && (
                <div className="flex items-center gap-3 bg-surface-container-lowest border border-solid border-outline-variant/20 px-4 h-[42px] shrink-0">
                  <label className="font-headline text-[10px] tracking-widest text-on-surface-variant uppercase flex items-center gap-2">
                    Recurring_mode
                    <Tooltip
                      title="This trade transaction will trigger every turn, for as long as this treaty stays accepted."
                      arrow
                      placement="top"
                      slotProps={{ tooltip: { sx: { fontSize: '13px', p: 1 } } }}
                    >
                      <span className="material-symbols-outlined text-[14px] cursor-help">info</span>
                    </Tooltip>
                  </label>
                  <input
                    type="checkbox"
                    checked={recurring}
                    onChange={(e) => setRecurring(e.target.checked)}
                    className="w-4 h-4 accent-primary cursor-pointer"
                  />
                </div>
              )}
            </div>

            {/* Kind-specific content */}
            {kind === TreatyKind.TRADE && (
              <>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-px bg-outline-variant/20 border border-solid border-outline-variant/20">
                  <TradeColumn
                    label="Your_offer"
                    accent="primary"
                    rows={offerRows}
                    resources={resources}
                    goodsCatalog={goodsCatalog}
                    onAdd={() => addRow('send')}
                    onUpdate={updateRow}
                    onRemove={removeRow}
                  />
                  <TradeColumn
                    label="Their_demand"
                    accent="secondary"
                    rows={demandRows}
                    resources={resources}
                    goodsCatalog={goodsCatalog}
                    onAdd={() => addRow('receive')}
                    onUpdate={updateRow}
                    onRemove={removeRow}
                  />
                </div>
                <div className="flex items-start gap-2 border border-dashed border-error/60 rounded-sm px-3 py-2 bg-error/5">
                  <span className="material-symbols-outlined text-error text-base shrink-0">warning</span>
                  <p className="font-headline text-[10px] tracking-wide text-on-surface-variant leading-relaxed uppercase">
                    Goods and resources can only be traded between players who share a border, or who are linked by a troops-pass route. Money can be sent to anyone.
                  </p>
                </div>
              </>
            )}

            {kind === TreatyKind.ALLIANCE && (
              <p className="font-headline text-xs text-on-surface-variant leading-relaxed bg-surface-container-low/40 border border-solid border-outline-variant/10 p-4">
                Sets your relation with {receiverName} to <span className="text-secondary">ALLIANCE</span> — blocks attacks between you, grants mutual passage, and calls each side to the other's defense if attacked.
              </p>
            )}

            {kind === TreatyKind.TROOPS_PASS && (
              <div className="flex flex-col gap-2">
                <label className="font-headline text-[10px] tracking-widest text-primary uppercase">Direction</label>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => setPassDirection('grant')}
                    className={`bg-transparent border px-4 py-2 font-headline text-[11px] tracking-widest uppercase transition-all rounded-sm cursor-pointer ${passDirection === 'grant' ? 'border-primary text-primary bg-primary/10' : 'border-outline-variant/30 text-on-surface-variant hover:border-primary/50'}`}
                  >
                    I grant passage to {receiverName}
                  </button>
                  <button
                    type="button"
                    onClick={() => setPassDirection('request')}
                    className={`bg-transparent border px-4 py-2 font-headline text-[11px] tracking-widest uppercase transition-all rounded-sm cursor-pointer ${passDirection === 'request' ? 'border-primary text-primary bg-primary/10' : 'border-outline-variant/30 text-on-surface-variant hover:border-primary/50'}`}
                  >
                    Request passage from {receiverName}
                  </button>
                </div>
              </div>
            )}

            {/* Note / article text */}
            <div className="flex flex-col gap-2">
              <label className="font-headline text-[10px] tracking-widest text-on-surface-variant uppercase">
                {kind === TreatyKind.ARTICLE ? 'Article_text_(markdown)' : 'Optional_message'}
              </label>
              {kind === TreatyKind.ARTICLE ? (
                <div data-color-mode="dark" className="rounded-sm overflow-hidden border border-solid border-outline-variant/20">
                  <MDEditor
                    value={note}
                    onChange={(v) => setNote(v ?? '')}
                    height={200}
                    preview="edit"
                    textareaProps={{ placeholder: 'ENTER_ARTICLE_TERMS...' }}
                  />
                </div>
              ) : (
                <textarea
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="ENTER_ADDITIONAL_NOTES..."
                  className="box-border w-full h-24 bg-surface-container-lowest border border-solid border-outline-variant/20 rounded-sm p-3 text-sm text-white font-body focus:outline-none focus:border-primary/50 transition-all resize-none placeholder:text-on-surface-variant/30"
                />
              )}
            </div>

            {/* Footer */}
            <div className="flex flex-wrap justify-between items-center gap-4 pt-4">
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={visibility === TreatyVisibility.PUBLIC}
                  onChange={(e) => setVisibility(e.target.checked ? TreatyVisibility.PUBLIC : TreatyVisibility.PRIVATE)}
                  className="w-4 h-4 accent-primary cursor-pointer"
                />
                <span className="flex flex-col">
                  <span className="font-headline text-[10px] tracking-widest text-on-surface-variant uppercase">Public_visibility</span>
                  <span className="text-[10px] text-on-surface-variant/60">Any player can view this via "Player Treaties"</span>
                </span>
              </label>
              <div className="flex gap-3">
                <ActionButton
                  label="Cancel"
                  colorClass="border-outline-variant/40 text-on-surface-variant hover:bg-white/5"
                  disabled={saving}
                  onClick={handleClose}
                />
                <button
                  type="button"
                  onClick={() => void handleSubmit()}
                  disabled={saving}
                  className="bg-gradient-to-r from-primary to-primary-dim px-8 py-2.5 rounded-sm font-headline font-bold text-on-primary-fixed uppercase tracking-widest text-xs glow-primary hover:opacity-90 active:scale-[0.98] transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {saving ? 'Sending…' : 'Send_proposal'}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </Dialog>
  );
};

interface TradeColumnProps {
  label: string;
  accent: 'primary' | 'secondary';
  rows: TributeRow[];
  resources: { key: string; name: string }[];
  goodsCatalog: { id: string; name: string; type: string }[];
  onAdd: () => void;
  onUpdate: (id: string, patch: Partial<TributeRow>) => void;
  onRemove: (id: string) => void;
}

/** One side of the trade grid — offer (what you send) or demand (what you want back). */
const TradeColumn: React.FC<TradeColumnProps> = ({ label, accent, rows, resources, goodsCatalog, onAdd, onUpdate, onRemove }) => {
  const barClass = accent === 'primary' ? 'bg-primary' : 'bg-secondary';
  const textClass = accent === 'primary' ? 'text-primary' : 'text-secondary';
  const addHoverClass = accent === 'primary' ? 'hover:border-primary/50 hover:text-primary' : 'hover:border-secondary/50 hover:text-secondary';

  return (
    <div className="bg-surface-container p-4 flex flex-col gap-4">
      <h3 className={`font-headline text-xs tracking-[0.2em] uppercase flex items-center gap-2 ${textClass}`}>
        <span className={`w-1 h-3 ${barClass}`} /> {label}
      </h3>
      <div className="flex flex-col gap-2">
        {rows.map((row) => (
          <TradeRow key={row.id} row={row} resources={resources} goodsCatalog={goodsCatalog} onUpdate={onUpdate} onRemove={onRemove} />
        ))}
        <button
          type="button"
          onClick={onAdd}
          className={`bg-transparent border border-dashed border-outline-variant/40 py-2 font-headline text-[10px] tracking-widest text-on-surface-variant transition-all rounded-sm cursor-pointer ${addHoverClass}`}
        >
          + Add_resource_or_good
        </button>
      </div>
    </div>
  );
};

/** One transferable line item — money, a raw resource, or a manufactured good — with a quantity stepper. */
const TradeRow: React.FC<{
  row: TributeRow;
  resources: { key: string; name: string }[];
  goodsCatalog: { id: string; name: string; type: string }[];
  onUpdate: (id: string, patch: Partial<TributeRow>) => void;
  onRemove: (id: string) => void;
}> = ({ row, resources, goodsCatalog, onUpdate, onRemove }) => {
  return (
    <div className="bg-surface-container-lowest/50 border border-solid border-outline-variant/10 p-2 flex flex-col gap-2">
      <div className="flex items-center gap-2">
        <span className="text-xl shrink-0 inline-flex items-center">
          {row.kind === 'money'
            ? '💰'
            : row.kind === 'resource'
              ? <GameIcon kind="resource" iconKey={row.resourceKey ?? ''} className="w-5 h-5" />
              : goodIcon(goodsCatalog.find((g) => g.id === row.goodId)?.type)}
        </span>
        <select
          value={row.kind}
          onChange={(e) => onUpdate(row.id, { kind: e.target.value as TributeRow['kind'], resourceKey: undefined, goodId: undefined })}
          className="bg-transparent border-none text-[11px] font-headline tracking-widest uppercase text-white focus:outline-none cursor-pointer flex-1"
        >
          <option className="bg-surface-container-lowest" value="money">Money</option>
          <option className="bg-surface-container-lowest" value="resource">Resource</option>
          <option className="bg-surface-container-lowest" value="goods">Goods</option>
        </select>
        <button
          type="button"
          onClick={() => onRemove(row.id)}
          className="bg-transparent border-none p-1 text-on-surface-variant/40 hover:text-error transition-colors cursor-pointer shrink-0"
        >
          <span className="material-symbols-outlined text-base">close</span>
        </button>
      </div>

      {row.kind === 'resource' && (
        <select
          value={row.resourceKey ?? ''}
          onChange={(e) => onUpdate(row.id, { resourceKey: e.target.value })}
          className="box-border w-full bg-surface-container-lowest border border-solid border-outline-variant/20 rounded-sm px-2 py-1 text-xs text-white focus:outline-none focus:border-primary/50"
        >
          <option value="" disabled>Select resource</option>
          {resources.map((r) => <option key={r.key} value={r.key}>{r.name}</option>)}
        </select>
      )}
      {row.kind === 'goods' && (
        <select
          value={row.goodId ?? ''}
          onChange={(e) => onUpdate(row.id, { goodId: e.target.value })}
          className="box-border w-full bg-surface-container-lowest border border-solid border-outline-variant/20 rounded-sm px-2 py-1 text-xs text-white focus:outline-none focus:border-primary/50"
        >
          <option value="" disabled>Select good</option>
          {goodsCatalog.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
        </select>
      )}

      <div className="box-border flex items-center border border-solid border-outline-variant/20 bg-black self-start">
        <button
          type="button"
          onClick={() => onUpdate(row.id, { amount: Math.max(0, row.amount - 1) })}
          className="bg-transparent border-none px-2 py-1 text-on-surface-variant hover:text-primary cursor-pointer"
        >
          −
        </button>
        <input
          type="number"
          min={0}
          value={row.amount}
          onChange={(e) => onUpdate(row.id, { amount: Math.max(0, Number(e.target.value)) })}
          className="box-border w-16 bg-transparent text-center text-xs font-headline text-white focus:outline-none border-x border-solid border-outline-variant/20 py-1"
        />
        <button
          type="button"
          onClick={() => onUpdate(row.id, { amount: row.amount + 1 })}
          className="bg-transparent border-none px-2 py-1 text-on-surface-variant hover:text-primary cursor-pointer"
        >
          +
        </button>
      </div>
    </div>
  );
};
