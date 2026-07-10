import React, { useEffect, useState } from 'react';
import { Dialog } from '@mui/material';
import MDEditor from '@uiw/react-md-editor';
import { newsApi } from '../../api/news';
import { NewsArticle } from '../../types';

interface Props {
  open: boolean;
  onClose: () => void;
  agencyId: string;
  agencyName: string;
}

/** Read-only per-agency article browser — opened from the News Wall directory, mirrors PlayerTreatiesModal's pattern. */
export const NewsAgencyArticlesModal: React.FC<Props> = ({ open, onClose, agencyId, agencyName }) => {
  const [articles, setArticles] = useState<NewsArticle[]>([]);
  const [loading, setLoading] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setExpandedId(null);
    setLoading(true);
    newsApi.getArticles(agencyId)
      .then(setArticles)
      .finally(() => setLoading(false));
  }, [open, agencyId]);

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="sm"
      fullWidth
      disablePortal
      slotProps={{
        paper: {
          className: '!bg-surface-container !text-on-surface !shadow-2xl !rounded-sm !max-w-xl !overflow-hidden !max-h-[85vh]',
        },
      }}
    >
      <div className="relative flex flex-col max-h-[85vh]">
        <div className="absolute top-0 left-0 h-[1px] w-full bg-gradient-to-r from-transparent via-primary/40 to-transparent" />

        <div className="px-6 py-5 border-b border-solid border-outline-variant/20 flex justify-between items-start shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <span className="material-symbols-outlined text-primary">newspaper</span>
            <h1 className="font-headline text-lg uppercase tracking-widest text-primary glow-text-primary truncate">{agencyName}</h1>
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            className="bg-transparent border-none text-on-surface-variant hover:text-primary transition-colors cursor-pointer shrink-0"
          >
            <span className="material-symbols-outlined text-2xl">close</span>
          </button>
        </div>

        <div className="flex-1 overflow-y-auto custom-scrollbar p-6 flex flex-col gap-3">
          {loading && (
            <div className="font-headline text-xs uppercase tracking-widest text-on-surface-variant text-center py-16">Loading…</div>
          )}
          {!loading && articles.length === 0 && (
            <div className="font-headline text-xs uppercase tracking-widest text-on-surface-variant text-center py-16">
              No articles published yet
            </div>
          )}
          {!loading && articles.map((a) => {
            const expanded = expandedId === a.id;
            return (
              <div
                key={a.id}
                className="bg-surface-container-low border border-solid border-outline-variant/20 p-4 cursor-pointer transition-colors hover:bg-surface-container-high"
                onClick={() => setExpandedId(expanded ? null : a.id)}
              >
                <div className="flex justify-between items-start gap-3">
                  <h3 className="font-headline text-sm uppercase tracking-wider text-on-surface">{a.title}</h3>
                  <span className="font-body text-[10px] text-on-surface-variant/60 shrink-0">
                    {new Date(a.createdAt).toLocaleString()}
                  </span>
                </div>
                {expanded && (
                  <div className="mt-3" data-color-mode="dark" onClick={(e) => e.stopPropagation()}>
                    <MDEditor.Markdown source={a.content} style={{ backgroundColor: 'transparent', fontSize: '0.8rem' }} />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </Dialog>
  );
};
