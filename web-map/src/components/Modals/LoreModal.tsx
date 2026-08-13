import React, { useEffect, useState } from 'react';
import { Dialog } from '@mui/material';
import MDEditor from '@uiw/react-md-editor';
import { usersApi } from '../../api/users';

interface Props {
  open: boolean;
  onClose: () => void;
  userId: string;
  userName: string;
}

/** Read-only view of another player's markdown RP lore, opened from the Diplomacy modal's
 *  "Lore" button. Modeled on NewsAgencyArticlesModal.tsx's dark `surface-container` Paper
 *  styling — not PlayerTreatiesModal.tsx's plain default-MUI-white Dialog, which pairs badly
 *  with `data-color-mode="dark"` markdown content: without a dark Paper background behind it,
 *  the dark-mode-styled (light-colored) markdown text and any `text-white/*` labels end up
 *  low-contrast-to-invisible against the Dialog's default white background. */
export const LoreModal: React.FC<Props> = ({ open, onClose, userId, userName }) => {
  const [lore, setLore] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    usersApi.getLore(userId)
      .then(({ lore }) => setLore(lore))
      .finally(() => setLoading(false));
  }, [open, userId]);

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
            <span className="material-symbols-outlined text-primary">auto_stories</span>
            <h1 className="font-headline text-lg uppercase tracking-widest text-primary glow-text-primary truncate">{userName}'s Lore</h1>
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            className="bg-transparent border-none text-on-surface-variant hover:text-primary transition-colors cursor-pointer shrink-0"
          >
            <span className="material-symbols-outlined text-2xl">close</span>
          </button>
        </div>

        <div className="flex-1 overflow-y-auto custom-scrollbar p-6">
          {loading && (
            <div className="font-headline text-xs uppercase tracking-widest text-on-surface-variant text-center py-16">Loading…</div>
          )}
          {!loading && !lore && (
            <div className="font-headline text-xs uppercase tracking-widest text-on-surface-variant text-center py-16">
              This player hasn't written any lore yet
            </div>
          )}
          {!loading && lore && (
            <div data-color-mode="dark">
              <MDEditor.Markdown source={lore} style={{ backgroundColor: 'transparent', fontSize: '0.875rem' }} />
            </div>
          )}
        </div>
      </div>
    </Dialog>
  );
};
