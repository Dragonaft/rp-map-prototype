import React, { useEffect, useState } from 'react';
import { Chip, Dialog, DialogContent, DialogTitle } from '@mui/material';
import MDEditor from '@uiw/react-md-editor';
import { useAppSelector } from '../../store/hooks';
import { diplomacyApi } from '../../api/diplomacy';
import { Treaty } from '../../types';

interface Props {
  open: boolean;
  onClose: () => void;
  userId: string;
  userName: string;
}

const KIND_LABELS: Record<string, string> = {
  peace: 'Peace',
  alliance: 'Alliance',
  trade: 'Trade',
  troops_pass: 'Troops Pass',
  article: 'Article',
};

/** Read-only view of another player's public accepted treaties, opened from their province panel. */
export const PlayerTreatiesModal: React.FC<Props> = ({ open, onClose, userId, userName }) => {
  const currentUserId = useAppSelector((state) => state.user.id);
  const otherUsers = useAppSelector((state) => state.otherUsers.otherUsers);
  const [treaties, setTreaties] = useState<Treaty[]>([]);
  const [loading, setLoading] = useState(false);

  const nameFor = (id: string): string => {
    if (id === currentUserId) return 'You';
    if (id === userId) return userName;
    return otherUsers.find((u) => u.id === id)?.countryName ?? 'Unknown';
  };

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    diplomacyApi.getPublicTreaties(userId)
      .then(setTreaties)
      .finally(() => setLoading(false));
  }, [open, userId]);

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>{userName}'s Public Treaties</DialogTitle>
      <DialogContent dividers sx={{ display: 'flex', flexDirection: 'column', gap: 2, minHeight: 200 }}>
        {loading && <div className="text-sm text-white/50 text-center py-8">Loading…</div>}
        {!loading && treaties.length === 0 && (
          <div className="text-sm text-white/50 text-center py-8">No public treaties</div>
        )}
        {treaties.map((t) => (
          <div key={t.id} className="flex flex-col gap-1 p-3 rounded border border-outline-variant/20 bg-surface-container">
            <div className="flex items-center gap-2">
              <span className="font-headline font-bold text-white text-sm">{t.name}</span>
              <Chip label={KIND_LABELS[t.kind] ?? t.kind} size="small" />
            </div>
            <div className="text-xs text-white/70">{nameFor(t.proposer_id)} → {nameFor(t.receiver_id)}</div>
            {t.note && (
              t.kind === 'article' ? (
                <div data-color-mode="dark">
                  <MDEditor.Markdown source={t.note} style={{ backgroundColor: 'transparent', fontSize: '0.75rem' }} />
                </div>
              ) : (
                <div className="text-xs text-white/60 whitespace-pre-wrap">{t.note}</div>
              )
            )}
          </div>
        ))}
      </DialogContent>
    </Dialog>
  );
};
