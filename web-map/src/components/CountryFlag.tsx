import React, { useEffect, useState } from 'react';
import { apiBaseUrl } from '../api/config';

interface Props {
  /** API-relative path from PartialUser/User.flagUrl (e.g. `/users/{id}/flag?v={hash}`), or null. */
  flagUrl: string | null;
  /** Country color, used as the fallback swatch when there's no flag (or it fails to load). */
  color: string;
  countryName?: string;
  /** 'sm' for inline use next to text (province inspector); 'md' for the top bar, sized to
   *  match the ~33.5px-tall Research/Diplomacy buttons it sits alongside (measured via
   *  getComputedStyle — px-4 py-2 + the headline font's line-height). */
  size?: 'sm' | 'md';
  className?: string;
}

const SIZE_CLASSES: Record<'sm' | 'md', string> = {
  sm: 'w-5 h-3.5',
  md: 'w-12 h-8',
};

/** Shared flag display used by both the top bar (own country) and the province inspector
 *  (another player's country) so the image-vs-color-swatch fallback can never drift between
 *  the two sites. Falls back to the country's color swatch when there's no flag, and also
 *  on a load error — the flag endpoint 503s during turn execution and 403s while the game is
 *  paused (see GAME-MECHANICS.md), so a broken-image icon is an expected transient case, not
 *  a bug to chase. */
export const CountryFlag: React.FC<Props> = ({ flagUrl, color, countryName, size = 'sm', className = '' }) => {
  const [errored, setErrored] = useState(false);

  // Reset the error flag when the URL itself changes (e.g. the top bar re-renders with a
  // freshly uploaded flag) — otherwise a stale failure would pin the fallback forever.
  useEffect(() => {
    setErrored(false);
  }, [flagUrl]);

  // box-border: without Tailwind preflight (see DESIGN.md's Tailwind-gotchas note), an
  // element defaults to content-box, so the 1px border would otherwise add on top of the
  // fixed w-*/h-* size instead of being included in it.
  const base = `${SIZE_CLASSES[size]} box-border rounded border border-solid border-outline-variant/20 shrink-0 overflow-hidden`;

  if (flagUrl && !errored) {
    return (
      <img
        src={`${apiBaseUrl}${flagUrl}`}
        alt={countryName ? `${countryName} flag` : 'Country flag'}
        title={countryName}
        className={`${base} object-cover ${className}`}
        onError={() => setErrored(true)}
      />
    );
  }

  return (
    <div
      className={`${base} ${className}`}
      style={{ backgroundColor: color }}
      title={countryName}
    />
  );
};
