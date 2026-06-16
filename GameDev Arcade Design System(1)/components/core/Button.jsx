import React from 'react';

/**
 * Button — the arcade call-to-action.
 * Variants map to the real games: `primary` (cyan CTA gradient with neon glow),
 * `p2` (orange), `glass` (frosted), `ghost` (text-only). Press = shrink + brighten.
 */
export function Button({
  children,
  variant = 'primary',
  size = 'md',
  disabled = false,
  type = 'button',
  onClick,
  style,
  ...rest
}) {
  const [pressed, setPressed] = React.useState(false);

  const sizes = {
    sm: { padding: '10px 20px', fontSize: '14px' },
    md: { padding: '14px 30px', fontSize: '18px' },
    lg: { padding: '16px 38px', fontSize: '22px' },
  };

  const variants = {
    primary: {
      background: 'var(--grad-cta)',
      color: '#061018',
      boxShadow: 'var(--glow-p1)',
      border: 'none',
    },
    p2: {
      background: 'linear-gradient(90deg, #ffa15f, #ff7a3d)',
      color: '#1a0c04',
      boxShadow: 'var(--glow-p2)',
      border: 'none',
    },
    glass: {
      background: 'var(--surface-raised)',
      color: 'var(--ink)',
      border: '1px solid var(--line-strong)',
      backdropFilter: 'var(--blur-glass)',
      WebkitBackdropFilter: 'var(--blur-glass)',
      boxShadow: 'var(--shadow-glass)',
    },
    ghost: {
      background: 'transparent',
      color: 'var(--ink-bright)',
      border: '1px solid var(--line)',
    },
  };

  return (
    <button
      type={type}
      disabled={disabled}
      onClick={onClick}
      onPointerDown={() => setPressed(true)}
      onPointerUp={() => setPressed(false)}
      onPointerLeave={() => setPressed(false)}
      style={{
        fontFamily: 'var(--font-display)',
        fontWeight: 700,
        letterSpacing: '0.05em',
        borderRadius: 'var(--radius-lg)',
        cursor: disabled ? 'default' : 'pointer',
        transition: 'transform var(--dur-press) var(--ease-snap), filter var(--dur-fast)',
        transform: pressed && !disabled ? 'scale(var(--press-scale))' : 'scale(1)',
        filter: disabled ? 'grayscale(0.7) brightness(0.7)' : pressed ? 'brightness(var(--press-bright))' : 'none',
        ...sizes[size],
        ...variants[variant],
        ...style,
      }}
      {...rest}
    >
      {children}
    </button>
  );
}
