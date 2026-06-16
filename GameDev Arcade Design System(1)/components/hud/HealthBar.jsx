import React from 'react';

/**
 * HealthBar — generic HP bar (the real #hpwrap). Orange→amber fill on a dark
 * track, optional uppercase label above. Use for the player or, smaller, for an
 * enemy. `value` is 0–100; `color` overrides the fill (e.g. a co-op player tint).
 */
export function HealthBar({ value = 100, label, width = 280, height = 20, color, style, ...rest }) {
  const pct = Math.max(0, Math.min(100, value));
  return (
    <div style={{ width, fontFamily: 'var(--font-body)', ...style }} {...rest}>
      {label ? (
        <div style={{ fontWeight: 700, fontSize: 12, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--ink-bright)', marginBottom: 6, textShadow: 'var(--text-shadow-hud)' }}>{label}</div>
      ) : null}
      <div style={{ height, borderRadius: 'var(--radius-sm)', background: 'var(--surface-track)', border: '2px solid var(--line-strong)', overflow: 'hidden' }}>
        <div style={{ height: '100%', width: pct + '%', background: color || 'var(--fill-hp)', transition: 'width 0.2s' }} />
      </div>
    </div>
  );
}
