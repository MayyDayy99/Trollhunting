Arcade call-to-action button — use for any primary action (start a match, confirm, rematch); pick the variant that fits the surface.

```jsx
<Button variant="primary" size="lg" onClick={start}>BELÉPÉS ▶</Button>
```

Variants: `primary` (cyan CTA gradient + neon glow — the default), `p2` (orange, for Player-2-themed actions), `glass` (frosted, sits over the 3D canvas), `ghost` (low-emphasis outline). Sizes `sm | md | lg`. Press feedback (shrink + brighten) is built in; `disabled` desaturates. Label is rendered in Chakra Petch — keep it short and confident, often with a ▶ glyph.
