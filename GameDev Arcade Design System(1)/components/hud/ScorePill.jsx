import React from 'react';

/**
 * ScorePill — the score readout (the real #score): big cyan number + small
 * uppercase caption. Right-aligned in the top corner by default.
 */
export function ScorePill({ value = 0, label = 'pont', align = 'right', style, ...rest }) {
  return (
    <div style={{ textAlign: align, textShadow: 'var(--text-shadow-hud)', fontFamily: 'var(--font-display)', ...style }} {...rest}>
      <div style={{ fontWeight: 700, fontSize: 26, lineHeight: 1, color: 'var(--cyan)' }}>{value}</div>
      <small style={{ fontFamily: 'var(--font-body)', fontWeight: 600, fontSize: 10, lineHeight: 1.2, letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--ink-muted)' }}>{label}</small>
    </div>
  );
}
