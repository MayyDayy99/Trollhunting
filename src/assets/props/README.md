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

## old_well.glb — öreg kút

| | |
| --- | --- |
| Hely a játékban | `src/game/07-troll-idol.js` (`OLD_WELL`) — a tisztáson a középponttól keletre (x 11,55, z 7,90), 2,9 m magas; az ütköző a régi helyén marad |
| Méret | 7001 háromszög, 420 KB (1024-es WebP alapszín + emisszív térkép a víz cián gyűrűjének) |
| Bemenő kép | Qwen-Image-Fast, Hugging Face Space `mcp-tools/Qwen-Image-Fast`, seed 5101, 1:1 |
| 3D modell | Meshy 7 Image to 3D a Higgsfield-en (38 kredit): `should_texture`, PBR nélkül, `target_polycount` 8000 |
| Optimalizálás | `node tools/props/optimize.mjs nyers.glb src/assets/props/old_well.glb 6000 1024` (a sok UV-varrat miatt 7001-nél állt meg) |
| Összehasonlítás | Tripo P2 ugyanebből a képből (34 kredit, `face_limit` 8000, `delight`): lágyabb, elkentebb textúra, hátul sötét tetőoromzat, a víz cián derengése elveszett. A Meshy élesebb (fa-erezet, kötél, vödör-abroncsok), ezért az került a játékba. |

A kép promptja:

> Stylized 3D game asset: an old round stone well built from two courses of stacked mossy grey carved
> stones, low circular wall about knee height, dark water inside with a faint cyan glow, a small wooden
> peaked roof on two thick wooden posts with a crossbeam, a rope and a small wooden bucket hanging from
> the beam, patches of bright green moss, two small orange mushrooms at the base. Chunky readable shapes,
> hand-painted textures, stylized indie fantasy game look. Single object, fully visible and centered,
> three-quarter front view, plain flat light grey background, soft even studio lighting, no cast
> shadows, no text.

A modell eleje a +Z irányba néz (a játék ennek megfelelően forgatja). Ismert hiba: a kút belseje inkább barnás
földnek tűnik, mint sötét víznek; a vékony cián gyűrű izzik.

## altar_dais.glb — középső oltár-emelvény

| | |
| --- | --- |
| Hely a játékban | `src/game/07-troll-idol.js` (`ALTAR`) — a kezdőpont közepén (0, 0), 8,4 m átmérőre nagyítva és legfeljebb 0,30 m magasra lapítva (a modell saját aránya kb. 1 : 0,2) |
| Méret | 4081 háromszög, 7151 csúcspont, 239 KB (1024-es WebP alapszín) |
| Bemenő kép | Qwen-Image-Fast, Hugging Face Space `mcp-tools/Qwen-Image-Fast`, seed 5201, 1:1 |
| 3D modell | Tripo P2 Image to 3D a Higgsfield-en (34 kredit): `face_limit` 8000, textúra, PBR nélkül, `delight` |
| Optimalizálás | `node tools/props/optimize.mjs nyers.glb src/assets/props/altar_dais.glb 4000 1024` (a 0,01-es egyszerűsítési hibahatár miatt 4081-nél állt meg) |

A kép promptja:

> Stylized 3D game asset: a wide, very low circular ritual platform, only one shallow step high, made of
> fitted flat grey flagstones, a ring of rounded carved rim stones around its edge, bright green moss
> growing in the gaps, the flat top is clear and walkable with a shallow carved circular groove near the
> edge, ancient forest shrine floor. Chunky readable shapes, hand-painted textures, stylized indie
> fantasy game look. Single object, fully visible and centered, three-quarter view from above, plain
> flat light grey background, soft even studio lighting, no cast shadows, no text.

A kép a prompttól eltérően 2–3 kősor magas peremet és a +X oldalon egy rövid lépcsőt rajzolt (ott a
peremgyűrű nyitott); a faragott kör a közepén van, nem a szélén (sugara a modell sugarának kb. harmada).

## moss_rock.glb — mohás szikla

| | |
| --- | --- |
| Hely a játékban | `src/game/07-troll-idol.js` — egyetlen instanced háló az aréna összes `rock()` kövének helyén (`ROCK_SPOTS`), a régi kő-geometriák átlagos befoglaló dobozára nyújtva; az ütközők változatlanok |
| Méret | 2056 háromszög, 3423 csúcspont, 104 KB (512-es WebP alapszín) |
| Bemenő kép | Qwen-Image-Fast, Hugging Face Space `mcp-tools/Qwen-Image-Fast`, seed 5301, 1:1 |
| 3D modell | Tripo P2 Image to 3D a Higgsfield-en (34 kredit): `face_limit` 4000, textúra, PBR nélkül, `delight` |
| Optimalizálás | `node tools/props/optimize.mjs nyers.glb src/assets/props/moss_rock.glb 1500 512` (a 0,01-es hibahatár miatt 2056-nál állt meg; 0,05-tel 1553 lenne, de akkor a varratoknál zöld szilánkok jelennek meg) |

A kép promptja:

> Stylized 3D game asset: a single chunky rounded grey granite boulder, wider than tall, a thick soft cap
> of bright green moss on top spilling over one side, a few cracks and chips, no grass. Chunky readable
> shapes, hand-painted textures, stylized indie fantasy game look. Single object, fully visible and
> centered, three-quarter front view, plain flat light grey background, soft even studio lighting, no
> cast shadows, no text.

A kép a prompttól eltérően kb. olyan magas, mint széles, és a tövénél fűcsomók vannak (ezek vékony
geometriaként a modellben maradtak). A repedezett, részletes oldal a +X felé néz, a hátoldal simább;
a játék a köveket véletlenszerűen forgatja.

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
