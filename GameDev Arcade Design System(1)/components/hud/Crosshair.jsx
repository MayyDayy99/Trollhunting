import React from 'react';

/**
 * Crosshair — the first-person reticle. A center dot + four ticks that push
 * OUTWARD as the bow draws (`spread` 0→1, like the real #cross expanding while
 * charging). Ticks tint to the equipped element; white for base.
 */
export function Crosshair({ spread = 0, element = 'base', size = 22, style, ...rest }) {
  const tint = { base: 'rgba(255,255,255,0.9)', fire: '#ff7a3d', ice: '#7fd0ff', poison: '#9fdc4a', lightning: '#c8b4ff' }[element] || 'rgba(255,255,255,0.9)';
  const gap = 4 + spread * (size * 0.7);   // ticks fly apart as you draw
  const len = 7;
  const line = (extra) => ({ position: 'absolute', left: '50%', top: '50%', background: tint, boxShadow: '0 0 4px rgba(0,0,0,0.8)', ...extra });
  return (
    <div style={{ position: 'relative', width: size * 3, height: size * 3, ...style }} {...rest}>
      <div style={{ position: 'absolute', left: '50%', top: '50%', width: 4, height: 4, borderRadius: '50%', background: '#fff', boxShadow: '0 0 6px rgba(0,0,0,0.8)', transform: 'translate(-50%,-50%)' }} />
      {/* top / bottom */}
      <div style={line({ width: 2, height: len, transform: `translate(-50%, calc(-50% - ${gap + len}px))` })} />
      <div style={line({ width: 2, height: len, transform: `translate(-50%, calc(-50% + ${gap}px))` })} />
      {/* left / right */}
      <div style={line({ width: len, height: 2, transform: `translate(calc(-50% - ${gap + len}px), -50%)` })} />
      <div style={line({ width: len, height: 2, transform: `translate(calc(-50% + ${gap}px), -50%)` })} />
    </div>
  );
}
