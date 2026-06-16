import React from 'react';

/**
 * IconButton — round game control (emote / action), as in Mohás Berci.
 * `tone` colors the fill: `glass` (frosted), `smash` (orange radial),
 * `roar` (blue radial), or any custom background via `background`.
 * Pass an emoji or icon node as children. Press = shrink + brighten.
 */
export function IconButton({
  children,
  tone = 'glass',
  size = 'md',
  label,
  background,
  onClick,
  style,
  ...rest
}) {
  const [pressed, setPressed] = React.useState(false);

  const sizes = { sm: 42, md: 62, lg: 92 };
  const dim = sizes[size] || sizes.md;

  const tones = {
    glass: {
      background: 'var(--surface-raised)',
      border: '1px solid var(--line)',
      color: 'var(--ink-soft)',
      backdropFilter: 'var(--blur-glass)',
      WebkitBackdropFilter: 'var(--blur-glass)',
      boxShadow: 'var(--shadow-glass)',
    },
    smash: {
      background: 'radial-gradient(circle at 50% 35%, #cf6a33, #7e2f1c)',
      border: '1px solid var(--line-oncolor)',
      color: '#fff',
      boxShadow: 'var(--shadow-round)',
    },
    roar: {
      background: 'radial-gradient(circle at 50% 35%, #4f70da, #2a3f96)',
      border: '1px solid var(--line-oncolor)',
      color: '#fff',
      boxShadow: 'var(--shadow-round)',
    },
  };

  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      onPointerDown={() => setPressed(true)}
      onPointerUp={() => setPressed(false)}
      onPointerLeave={() => setPressed(false)}
      style={{
        width: dim,
        height: dim,
        borderRadius: '50%',
        display: 'inline-flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '1px',
        fontSize: dim * 0.36,
        lineHeight: 1,
        cursor: 'pointer',
        fontFamily: 'var(--font-body)',
        transition: 'transform var(--dur-press) var(--ease-snap), filter var(--dur-fast), background var(--dur-fast)',
        transform: pressed ? 'scale(0.88)' : 'scale(1)',
        filter: pressed ? 'brightness(1.18)' : 'none',
        ...(tones[tone] || tones.glass),
        ...(background ? { background } : {}),
        ...style,
      }}
      {...rest}
    >
      <span style={{ lineHeight: 1 }}>{children}</span>
      {label ? (
        <small style={{ fontSize: '8px', fontWeight: 700, letterSpacing: '0.05em', textTransform: 'uppercase' }}>{label}</small>
      ) : null}
    </button>
  );
}
