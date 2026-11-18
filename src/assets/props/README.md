# Generált 3D tereptárgyak

AI-val generált, játékra optimalizált glTF modellek. A build (`vite-plugin-singlefile`) a
`.glb` fájlokat data: URL-ként beágyazza a `dist/mohas-roham.html`-be, a játék a
`window.GAME_ASSETS`-ből tölti be őket (`src/assets.js`).

## troll_idol.glb — mohás kőtroll-bálvány

| | |
| --- | --- |
| Hely a játékban | `src/game/07-troll-idol.js` — az északi holdkapu előtt (x −6,5, z −39,5), 3,2 m magas, ütközik |
| Méret | 5999 háromszög, 4000 csúcspont, 170 KB (1024-es WebP alapszín + rúna-emisszív térkép) |
| Bemenő kép | Qwen-Image-Fast (Apache-2.0), Hugging Face Space `mcp-tools/Qwen-Image-Fast`, seed 4242, 1:1 |
| 3D modell | Tripo P2 Image to 3D a Higgsfield-en (34 kredit): `face_limit` 8000, textúra, PBR nélkül, `delight` (beégetett fény eltávolítva) |
| Optimalizálás | `tools/props/optimize.mjs` (lent) |

A kép promptja:

> Stylized 3D game asset: an ancient squat stone idol of a forest troll, carved from grey granite,
> heavy brow, wide nose and short tusks, arms folded over its belly, thick patches of bright green
> moss on the head and shoulders, faintly glowing cyan rune carvings on the chest, a few small
> orange mushrooms at its rocky base. Chunky readable shapes, hand-painted textures, stylized indie
> fantasy game look. Single object, fully visible and centered, three-quarter front view, plain
> flat light grey background, soft even studio lighting, no cast shadows, no text.

A modell eleje a +X irányba néz (Tripo alapértelmezés); a játék forgatja a helyére.

## Új tereptárgy hozzáadása

1. Kép: stilizált, egyetlen tárgy, egyszínű háttér, egyenletes fény, háromnegyedes nézet.
2. 3D: képből-3D modell (pl. Tripo P2 `delight`-tal, ~8000 lap, PBR nélkül).
3. Optimalizálás és előnézet (a `tools/props` saját függőségekkel, nem része a játék buildjének):

   ```powershell
   npm --prefix tools/props ci
   node tools/props/optimize.mjs nyers.glb src/assets/props/uj_targy.glb 6000 1024
   node tools/props/render.mjs src/assets/props/uj_targy.glb elonezet.png
   ```

   Az `optimize.mjs`: hegesztés + meshoptimizer-egyszerűsítés a cél háromszögszámra, matt nem-fém
   anyag (a fém/érdesség térkép elhagyva), a telített cián pixelekből emisszív (izzó) térkép,
   WebP textúrák a megadott méretre, kvantált geometria. A `render.mjs` a játék Three.js r128-as
   verziójával, fejetlen Edge-ben négy irányból renderel.
4. Az URL-t vedd fel a `src/assets.js`-be, a betöltést és az ütközőt a `07-troll-idol.js` mintájára
   írd meg, és a helyét tedd a `08-forest.js` `KEEP_CLEAR` listájába.
