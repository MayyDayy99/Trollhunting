import React from 'react';

/**
 * GlassPanel — the frosted, translucent surface that floats over the 3D canvas.
 * Used for the start card, score readout, HUD chrome. `tone="scrim"` gives the
 * heavier full-screen overlay look; `padding` and `radius` are tunable.
 */
export function GlassPanel({
  children,
  tone = 'panel',
  radius = 'xl',
  padding = 24,
  style,
  ...rest
}) {
  const radii = {
    md: 'var(--radius-md)',
    lg: 'var(--radius-lg)',
    xl: 'var(--radius-xl)',
    pill: 'var(--radius-pill)',
  };

  const tones = {
    panel: {
      background: 'var(--surface-panel)',
      border: '1px solid var(--line)',
      boxShadow: 'var(--shadow-glass)',
    },
    raised: {
      background: 'var(--surface-raised)',
      border: '1px solid var(--line)',
      boxShadow: 'var(--shadow-raised)',
    },
    scrim: {
      background: 'var(--bg-overlay)',
      border: '1px solid var(--line)',
      boxShadow: 'var(--shadow-card)',
    },
  };

  return (
    <div
      style={{
        borderRadius: radii[radius] || radii.xl,
        padding,
        color: 'var(--ink)',
        fontFamily: 'var(--font-body)',
        backdropFilter: 'var(--blur-glass)',
        WebkitBackdropFilter: 'var(--blur-glass)',
        ...(tones[tone] || tones.panel),
        ...style,
      }}
      {...rest}
    >
      {children}
    </div>
  );
}
