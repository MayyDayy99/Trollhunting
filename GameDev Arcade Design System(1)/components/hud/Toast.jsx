import React from 'react';

/**
 * Toast — the big centered amber announcement (the real #toast: wave cleared,
 * "FEJLÖVÉS!", etc.). Pops in with a scale + fade. Auto-hide on a timer yourself.
 */
export function Toast({ children, show = true, style, ...rest }) {
  return (
    <div
      style={{
        fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 60, lineHeight: 1,
        color: 'var(--gold)', textShadow: 'var(--text-shadow-big)', textAlign: 'center',
        opacity: show ? 1 : 0,
        transform: show ? 'scale(1)' : 'scale(0.6)',
        transition: 'opacity 0.3s, transform 0.3s',
        ...style,
      }}
      {...rest}
    >
      {children}
    </div>
  );
}
