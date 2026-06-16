import React from 'react';

/**
 * WaveBanner — top-center wave readout: big amber "HULLÁM N" + small troll count
 * (the real #wave). Center it at the top of the HUD.
 */
export function WaveBanner({ wave = 1, trollsLeft = 0, style, ...rest }) {
  return (
    <div style={{ textAlign: 'center', textShadow: 'var(--text-shadow-hud)', fontFamily: 'var(--font-display)', ...style }} {...rest}>
      <div style={{ fontWeight: 700, fontSize: 30, lineHeight: 1, color: 'var(--gold)', letterSpacing: '0.04em' }}>
        HULLÁM {wave}
      </div>
      <div style={{ fontFamily: 'var(--font-body)', fontWeight: 600, fontSize: 13, lineHeight: 1.4, color: 'var(--ink-sub)' }}>
        trollok: {trollsLeft}
      </div>
    </div>
  );
}
