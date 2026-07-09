import React from 'react';

/** Bare-outline, currentColor action button — the recurring diplomacy-network control shape. */
export const ActionButton: React.FC<{
  label: string;
  colorClass: string;
  disabled?: boolean;
  onClick: () => void;
}> = ({ label, colorClass, disabled, onClick }) => (
  <button
    type="button"
    disabled={disabled}
    onClick={onClick}
    className={`bg-transparent border py-1.5 px-2 font-headline text-[11px] tracking-widest uppercase transition-all rounded-sm cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed ${colorClass}`}
  >
    {label}
  </button>
);