Frosted, translucent surface that floats over the live 3D game canvas — wrap any HUD chrome, start card, or score readout in it.

```jsx
<GlassPanel tone="panel" radius="xl" padding={32}>
  <Eyebrow>Motion Arcade</Eyebrow>
  <h1>SWORD DUEL</h1>
</GlassPanel>
```

Tones: `panel` (default light frost), `raised` (slightly more solid, for controls), `scrim` (heavy full-screen overlay gradient). Carries backdrop blur and the standard hairline border + shadow. Keep contents legible — text needs a shadow over busy scenes.
