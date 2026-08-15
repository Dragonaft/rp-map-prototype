import { useAppSelector } from '../store/hooks.ts';
import { apiBaseUrl } from '../api/config.ts';
import { GameIconKind } from '../types.ts';

export const PLACEHOLDER_ICON_URL = '/placeholder-icon.svg';

/** Resolves a building/landscape/resource icon to an absolute image URL, falling back to the
 *  local placeholder when no art has been uploaded for that (kind, key) yet. The URL embeds the
 *  stored content hash as a cache-busting token (`?v=hash`) — same convention as User.flagUrl —
 *  so a re-uploaded icon is never served stale from the browser cache. */
export const useGameIcon = (kind: GameIconKind, key: string): string => {
  const icons = useAppSelector((state) => state.icons.icons);
  const match = icons.find((i) => i.kind === kind && i.key === key);
  return match ? `${apiBaseUrl}/icons/${kind}/${key}?v=${match.hash}` : PLACEHOLDER_ICON_URL;
};
