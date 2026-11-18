# src/game — a játék magja (egy közös hatókör)

Az itteni `NN-név.js` fájlok **nem** önálló ES modulok. A build (`build/concat-modules.js`)
a fájlnév szerinti sorrendben egyetlen modullá fűzi őket (`virtual:game`), pontosan úgy,
ahogy régen egymás után álltak a `mohas-roham.html` nagy függvényében.

Szabályok:

- **Közös hatókör.** Minden fájl látja a többi fájl felső szintű `const`/`let`/`function`
  deklarációit. Nincs `import` / `export`.
- **A sorrend a fájlnév.** A felső szintű kód (jelenet-építés, `const` értékek) fentről lefelé
  fut le. Egy `const`-ot csak olyan fájl használhat *betöltéskor*, amelyik utána jön; függvény
  belsejében (futásidőben) bármelyik hivatkozhat bármelyikre.
- **Új fájl:** válassz olyan számot, hogy a helyére kerüljön (pl. `23-…` és `24-…` közé ne kelljen
  átszámozni: használd a következő szabad nevet a csoporton belül, vagy nevezd át a szomszédokat).
- A `src/trollgen/` ugyanígy működik (`virtual:trollgen`), `const global = window;` előtaggal.

A tesztek (`tests/source.cjs`) ugyanígy fűzik össze a fájlokat, így a szöveges jelölőkkel
kivágott kódrészek akkor is működnek, ha egy függvény fájlhatáron átnyúlik.

| Fájl | Tartalom |
| --- | --- |
| 00-core | alap konstansok, eszköz-felismerés, feliratok (HU/EN) |
| 01-settings-stats | mentett beállítások, futam-statisztika |
| 02-bloom | renderer, szelektív bloom, `renderFrame` |
| 03-textures-lights-gfx | procedurális textúrák, fények, grafikai fokozatok |
| 04-materials, 05-model-kit | anyagok, modell-készlet (sziklák, fák, menhirek) |
| 06–11 | aréna, látványelemek, erdő, növényzet, égbolt, környezet |
| 07-troll-idol | generált glTF tereptárgy (kőtroll-bálvány) betöltése, `PROPS_READY` |
| 12-camera-collision | kamera, ütközés, hidak, fakunyhó, barlangok |
| 12-world-batch | a kész statikus világ összevonása anyagonként + 24 m-es cellánként (draw-call) — utolsó világ-építő lépés, ezért fut a 12-camera-collision után |
| 13-bow, 14-arrows | íj nézet-modell, nyíl-pool |
| 15-fire-burst | Blender adat-atlasz betöltő (`loadDataAtlas`) és a tűz-robbanás flipbook (`FIREBURST`) |
| 15-vfx | effekt-rétegek és VFX-készlet; az `SMK` füst a Blender füstpamacs-atlaszból rajzol |
| 16-elements, 17-freeze-reactions | elemi rendszer, fagyás, zónák, reakciók |
| 18-troll-projectiles, 19-troll-looks | troll-lövedékek, sámán, HP-csíkok, troll-megjelenés, `makeMonster` |
| 20-audio-input | hang, bemenet (egér, billentyű, érintés) |
| 21-hud-mechanics | HUD, kitérés, Troll Király veszélyzónái |
| 22-radar | minitérkép |
| 23-waves-shop-spells | hullámok, bolt, íjak, Elemi Ébredés varázslatok |
| 24-damage-kills | élet-gömbök, sebzés, `killMonster` |
| 25-main-loop | `update()` |
| 26-troll-ai | troll AI és animáció |
| 27-frame-warmup | képkocka-ciklus, shader-előmelegítés |
| 28-dev-shot | `?shot=1` fejlesztői képernyőkép-mód |
| 29-coop | co-op (csak `?room=KÓD` esetén) |
| 30-game-flow | játékállapot, menü, bolt-logika, `#dev` hook |
