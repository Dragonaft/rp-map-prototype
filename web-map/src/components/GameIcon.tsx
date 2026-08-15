import React, { useEffect, useState } from 'react';
import { useGameIcon, PLACEHOLDER_ICON_URL } from '../hooks/useGameIcon.ts';
import { GameIconKind } from '../types.ts';

interface Props {
  kind: GameIconKind;
  iconKey: string;
  alt?: string;
  className?: string;
}

/** Shared building/landscape/resource icon renderer, replacing the old emoji maps. Modeled on
 *  CountryFlag.tsx's fallback pattern: resolves a URL via useGameIcon (DB-backed, admin-
 *  uploadable) and falls back to the local placeholder both when no art exists for this slot
 *  and, belt-and-braces, if the resolved URL 404s (e.g. a stale hash). */
export const GameIcon: React.FC<Props> = ({ kind, iconKey, alt = '', className = '' }) => {
  const src = useGameIcon(kind, iconKey);
  const [errored, setErrored] = useState(false);

  useEffect(() => {
    setErrored(false);
  }, [src]);

  return (
    <img
      src={errored ? PLACEHOLDER_ICON_URL : src}
      alt={alt}
      draggable={false}
      className={`inline-block object-contain ${className}`}
      onError={() => setErrored(true)}
    />
  );
};
