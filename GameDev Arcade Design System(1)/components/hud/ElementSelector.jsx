import React from 'react';

/**
 * ElementSelector — the arrow-type picker HUD. Five chips (base + 4 elements),
 * each showing its gradient swatch, number key, and Hungarian label; the active
 * one is highlighted with a glow. Wire `onSelect` to the game's `currentElement`
 * and the 1–5 keys / mouse-wheel cycling.
 */
export const ELEMENTS = [
  { id: 'base', label: 'ALAP', key: '1', grad: 'var(--grad-base)', color: '#cfe0ff' },
  { id: 'fire', label: 'TŰZ', key: '2', grad: 'var(--grad-fire)', color: '#ff7a3d' },
  { id: 'ice', label: 'JÉG', key: '3', grad: 'var(--grad-ice)', color: '#7fd0ff' },
  { id: 'poison', label: 'MÉREG', key: '4', grad: 'var(--grad-poison)', color: '#9fdc4a' },
  { id: 'lightning', label: 'VILLÁM', key: '5', grad: 'var(--grad-lightning)', color: '#b48cff' },
];

export function ElementSelector({ current = 'base', onSelect, style, ...rest }) {
  return (
    <div style={{ display: 'flex', gap: 8, fontFamily: 'var(--font-body)', ...style }} {...rest}>
      {ELEMENTS.map((el) => {
        const active = el.id === current;
        return (
          <button
            key={el.id}
            type="button"
            onClick={() => onSelect && onSelect(el.id)}
            style={{
              width: 60, padding: '7px 6px 8px', borderRadius: 'var(--radius-lg)', cursor: 'pointer',
              background: active ? 'var(--surface-active)' : 'var(--surface-panel)',
              border: active ? `1px solid ${el.color}` : '1px solid var(--line)',
              boxShadow: active ? `0 0 16px ${el.color}66` : 'none',
              backdropFilter: 'var(--blur-glass)', WebkitBackdropFilter: 'var(--blur-glass)',
              transition: 'all 0.12s', opacity: active ? 1 : 0.7,
            }}
          >
            <div style={{ height: 18, borderRadius: 5, background: el.grad, boxShadow: active ? `0 0 8px ${el.color}` : 'none' }} />
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4, marginTop: 6 }}>
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--ink-faint)' }}>{el.key}</span>
              <span style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 11, letterSpacing: '0.03em', color: active ? el.color : 'var(--ink-muted)' }}>{el.label}</span>
            </div>
          </button>
        );
      })}
    </div>
  );
}
