import React from 'react';

/**
 * StatusPip — a small glowing dot marking an enemy's active elemental status
 * (burning / frozen / poisoned / shocked). Float it over a troll or list it in
 * the HUD. Optional `label` shows the Hungarian status word.
 */
export const STATUS = {
  fire: { color: '#ff7a3d', label: 'ÉGŐ' },
  ice: { color: '#7fd0ff', label: 'FAGYOTT' },
  poison: { color: '#9fdc4a', label: 'MÉRGEZETT' },
  lightning: { color: '#c8b4ff', label: 'SOKKOLT' },
};

export function StatusPip({ status = 'fire', size = 12, label = false, style, ...rest }) {
  const s = STATUS[status] || STATUS.fire;
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontFamily: 'var(--font-body)', ...style }} {...rest}>
      <span style={{
        width: size, height: size, borderRadius: '50%', background: s.color,
        boxShadow: `0 0 ${size * 0.7}px ${s.color}, 0 0 ${size * 1.6}px ${s.color}88`,
        animation: 'gd-pulse 1.1s ease-in-out infinite',
      }} />
      {label ? <span style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 11, letterSpacing: '0.04em', color: s.color }}>{s.label}</span> : null}
    </span>
  );
}
