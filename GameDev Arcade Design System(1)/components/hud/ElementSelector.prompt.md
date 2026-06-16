The arrow-type picker HUD — five chips (ALAP/TŰZ/JÉG/MÉREG/VILLÁM) with their gradients and number keys; the active one glows. Bind to the game's `currentElement` and 1–5 / wheel cycling.

```jsx
<ElementSelector current={el} onSelect={setEl} />
```
Exports `ELEMENTS` (id/label/key/grad/color) for reuse. Place bottom-center.
