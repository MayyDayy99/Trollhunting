import React from 'react';

/**
 * Eyebrow — the small, wide-tracked uppercase label that sits above titles.
 * `tone` tints it (faint blue by default, or gold/cyan/orange).
 */
export function Eyebrow({ children, tone = 'faint', style, ...rest }) {
  const tones = {
    faint: 'var(--ink-faint)',
    gold: 'var(--gold)',
    p1: 'var(--p1)',
    p2: 'var(--p2)',
  };
  return (
    <div
      style={{
        fontFamily: 'var(--font-body)',
        fontSize: 'var(--text-eyebrow)',
        fontWeight: 700,
        letterSpacing: 'var(--track-eyebrow)',
        textTransform: 'uppercase',
        color: tones[tone] || tones.faint,
        ...style,
      }}
      {...rest}
    >
      {children}
    </div>
  );
}
