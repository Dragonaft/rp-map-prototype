import React, { useEffect, useMemo, useState } from 'react';
import { Dialog } from '@mui/material';
import MDEditor from '@uiw/react-md-editor';
import { knowledgeApi } from '../../api/knowledge';
import { KnowledgeArticle } from '../../types';

interface Props {
  open: boolean;
  onClose: () => void;
}

/**
 * The player-facing "Codex" — a category sidebar + markdown reading pane over the game's
 * mechanics articles. Chrome copied from NewsAgencyArticlesModal.tsx; fetched once per open into
 * local state (static content, no Redux slice needed — same approach that modal takes).
 */
export const KnowledgeModal: React.FC<Props> = ({ open, onClose }) => {
  const [articles, setArticles] = useState<KnowledgeArticle[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [filter, setFilter] = useState('');

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    knowledgeApi.getAll()
      .then((data) => {
        setArticles(data);
        setSelectedKey(data[0]?.key ?? null);
      })
      .finally(() => setLoading(false));
  }, [open]);

  const categories = useMemo(() => {
    const needle = filter.trim().toLowerCase();
    const filtered = needle
      ? articles.filter((a) => a.title.toLowerCase().includes(needle))
      : articles;

    const byCategory = new Map<string, KnowledgeArticle[]>();
    for (const article of filtered) {
      const list = byCategory.get(article.category) ?? [];
      list.push(article);
      byCategory.set(article.category, list);
    }
    // Categories inherit the sortOrder of their first (lowest-order) member — articles already
    // arrive sorted from the API, so the first push into each bucket is that category's minimum.
    return Array.from(byCategory.entries());
  }, [articles, filter]);

  const selected = articles.find((a) => a.key === selectedKey) ?? null;

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="lg"
      fullWidth
      disablePortal
      slotProps={{
        paper: {
          className: '!bg-surface-container !text-on-surface !shadow-2xl !rounded-sm !max-w-4xl !overflow-hidden !max-h-[85vh]',
        },
      }}
    >
      <div className="relative flex flex-col max-h-[85vh]">
        <div className="absolute top-0 left-0 h-[1px] w-full bg-gradient-to-r from-transparent via-primary/40 to-transparent" />

        <div className="px-6 py-5 border-b border-solid border-outline-variant/20 flex justify-between items-start shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <span className="material-symbols-outlined text-primary">menu_book</span>
            <h1 className="font-headline text-lg uppercase tracking-widest text-primary glow-text-primary truncate">Codex</h1>
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            className="bg-transparent border-none text-on-surface-variant hover:text-primary transition-colors cursor-pointer shrink-0"
          >
            <span className="material-symbols-outlined text-2xl">close</span>
          </button>
        </div>

        {loading && (
          <div className="font-headline text-xs uppercase tracking-widest text-on-surface-variant text-center py-16">Loading…</div>
        )}

        {!loading && (
          <div className="flex flex-1 min-h-0">
            <div className="w-60 shrink-0 border-r border-solid border-outline-variant/20 flex flex-col min-h-0">
              <div className="p-3 shrink-0">
                <input
                  type="text"
                  value={filter}
                  onChange={(e) => setFilter(e.target.value)}
                  placeholder="Filter articles…"
                  className="w-full bg-surface-container-lowest border border-solid border-outline-variant/20 rounded-sm px-3 py-1.5 text-sm text-white box-border focus:outline-none focus:border-primary/50"
                />
              </div>
              <div className="flex-1 overflow-y-auto custom-scrollbar px-3 pb-3 flex flex-col gap-4">
                {categories.length === 0 && (
                  <div className="font-body text-xs text-on-surface-variant/60 text-center py-6">No matches</div>
                )}
                {categories.map(([category, categoryArticles]) => (
                  <div key={category}>
                    <h2 className="font-headline text-[10px] uppercase tracking-widest text-on-surface-variant/70 mb-1.5">
                      {category}
                    </h2>
                    <div className="flex flex-col gap-0.5">
                      {categoryArticles.map((article) => {
                        const isSelected = article.key === selectedKey;
                        return (
                          <button
                            key={article.key}
                            onClick={() => setSelectedKey(article.key)}
                            className={`text-left bg-transparent border-none px-2 py-1.5 rounded-sm text-sm cursor-pointer transition-colors ${
                              isSelected
                                ? 'bg-primary/10 text-primary'
                                : 'text-on-surface-variant hover:text-on-surface hover:bg-surface-container-high'
                            }`}
                          >
                            {article.title}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex-1 overflow-y-auto custom-scrollbar p-6 min-w-0">
              {selected ? (
                <div data-color-mode="dark">
                  <MDEditor.Markdown source={selected.content} style={{ backgroundColor: 'transparent' }} />
                </div>
              ) : (
                <div className="font-headline text-xs uppercase tracking-widest text-on-surface-variant text-center py-16">
                  Select an article
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </Dialog>
  );
};
