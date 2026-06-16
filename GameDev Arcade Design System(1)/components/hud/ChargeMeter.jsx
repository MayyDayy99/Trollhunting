import React from 'react';

/**
 * ChargeMeter — the bow draw-power bar (the real #powwrap). Fades in while
 * drawing; fill is the cyan→white charge gradient. `value` is 0–1.
 */
export function ChargeMeter({ value = 0, show = true, width = 170, style, ...rest }) {
  const pct = Math.max(0, Math.min(1, value)) * 100;
  return (
    <div
      style={{
        width, height: 8, borderRadius: 6,
        background: 'var(--surface-track)',
        border: '1px solid var(--line-strong)',
        opacity: show ? 1 : 0,
        transition: 'opacity 0.15s',
        overflow: 'hidden',
        ...style,
      }}
      {...rest}
    >
      <div style={{ height: '100%', width: pct + '%', borderRadius: 6, background: 'var(--fill-charge)' }} />
    </div>
  );
}
