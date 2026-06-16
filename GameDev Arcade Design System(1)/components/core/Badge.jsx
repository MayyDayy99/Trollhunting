import React from 'react';

/**
 * Badge — a small pill for status / labels. Includes the four elemental status
 * tones (burning / frozen / poisoned / shocked) plus neutral, danger, warn,
 * success. Use the element tones to mark afflicted enemies or the active arrow.
 */
export function Badge({ children, tone = 'neutral', style, ...rest }) {
  const tones = {
    neutral: { background: 'var(--surface-panel)', color: 'var(--ink-soft)', border: '1px solid var(--line)' },
    danger: { background: 'rgba(60,14,14,0.7)', color: 'var(--danger-soft)', border: '1px solid rgba(255,107,107,0.4)' },
    warn: { background: 'rgba(60,50,14,0.6)', color: 'var(--cream)', border: '1px solid rgba(255,210,122,0.3)' },
    success: { background: 'rgba(14,40,30,0.6)', color: 'var(--success)', border: '1px solid rgba(120,200,170,0.35)' },
    // elemental status tones
    fire: { background: 'rgba(255,90,42,0.16)', color: '#ffb27a', border: '1px solid rgba(255,122,61,0.45)' },
    ice: { background: 'rgba(111,216,255,0.14)', color: '#bfeaff', border: '1px solid rgba(111,216,255,0.45)' },
    poison: { background: 'rgba(159,220,74,0.14)', color: '#cde98a', border: '1px solid rgba(159,220,74,0.45)' },
    lightning: { background: 'rgba(180,140,255,0.16)', color: '#d8c8ff', border: '1px solid rgba(180,140,255,0.5)' },
  };
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '6px',
        fontFamily: 'var(--font-body)',
        fontWeight: 700,
        fontSize: 'var(--text-xs)',
        letterSpacing: '0.04em',
        padding: '6px 14px',
        borderRadius: 'var(--radius-pill)',
        backdropFilter: 'var(--blur-glass)',
        WebkitBackdropFilter: 'var(--blur-glass)',
        ...(tones[tone] || tones.neutral),
        ...style,
      }}
      {...rest}
    >
      {children}
    </span>
  );
}
