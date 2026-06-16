import React from 'react';

/**
 * PlayerCard — one row of the co-op archer list: a color dot (the player's
 * fletching-glow color), name, "TE" marker for the local player, and a slim HP
 * bar in the player's color. `down` greys the row out.
 */
export function PlayerCard({ name = 'Archer', color = '#36c5ff', hp = 100, you = false, down = false, style, ...rest }) {
  return (
    <div
      style={{
        display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px',
        borderRadius: 'var(--radius-lg)', fontFamily: 'var(--font-body)',
        background: 'var(--surface-panel)', border: '1px solid var(--line)',
        backdropFilter: 'var(--blur-glass)', WebkitBackdropFilter: 'var(--blur-glass)',
        opacity: down ? 0.42 : 1, ...style,
      }}
      {...rest}
    >
      <span style={{ width: 12, height: 12, borderRadius: '50%', background: color, boxShadow: `0 0 8px ${color}`, flexShrink: 0 }} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ fontWeight: 700, fontSize: 13, color: 'var(--ink)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{name}</span>
          {you ? <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--ink-faint)', border: '1px solid var(--line)', borderRadius: 4, padding: '1px 4px' }}>TE</span> : null}
          {down ? <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--danger)' }}>ELESETT</span> : null}
        </div>
        <div style={{ height: 5, marginTop: 5, borderRadius: 3, background: 'var(--surface-track)', overflow: 'hidden' }}>
          <div style={{ height: '100%', width: Math.max(0, Math.min(100, hp)) + '%', background: color, transition: 'width 0.2s' }} />
        </div>
      </div>
    </div>
  );
}
