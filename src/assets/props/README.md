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

## megalith_arch.glb — megalit holdkapu

| | |
| --- | --- |
| Hely a játékban | Még nincs bekötve. Cél: szabadon álló holdkapu átjárható nyílással, kb. 7,6 m magas és 7 m széles |
| Méret | 6000 háromszög, 7468 csúcspont, 229 KB (1024-es WebP alapszín + rúna-emisszív térkép) |
| Bemenő kép | Z-Image (Tongyi-MAI) a Higgsfield-en (0,15 kredit), 1:1; seed nem állítható, job `997cf635-6b1b-4830-9a2b-86dac029443a`. A `mcp-tools/Qwen-Image-Fast` Space ZeroGPU-kvótája elfogyott, ezért nem azzal készült |
| 3D modell | Tripo P2 Image to 3D a Higgsfield-en (34 kredit): `face_limit` 8000, textúra, PBR nélkül, `delight` |
| Optimalizálás | `node tools/props/optimize.mjs nyers.glb src/assets/props/megalith_arch.glb 6000 1024` (nyersen 6248 háromszög; emisszív pixelek: 1,20%) |

A kép promptja:

> Stylized 3D game asset: an ancient megalithic moon-gate, two tall rough-hewn grey standing stones with
> one heavy lintel stone laid across their tops, a carved circular rune in the middle of the lintel
> glowing bright cyan, patches of bright green moss, a few small ferns at the base. Chunky readable
> shapes, hand-painted textures, stylized indie fantasy game look. Single object, fully visible and
> centered, three-quarter front view, plain flat light grey background, soft even studio lighting, no
> cast shadows, no text.

A modell eleje a +X irányba néz (Tripo alapértelmezés), az átjáró az X tengely mentén vezet át, a kapu
szélessége a Z tengelyen van; a cián rúnakorong mindkét oldalon (±X) izzik. Modellegységben 0,85 (X) ×
0,76 (Y) × 1,00 (Z). Ismert hibák: a kép a prompttól eltérően lapos kőalapzatot és fűcsomókat is rajzolt
a kapu alá; a kapu a célnál szélesebb (szélesség : magasság ≈ 1,31 a kért 0,92 helyett), 7,6 m magasra
nagyítva kb. 10 m széles; a két oszlop közti szabad nyílás a teljes szélesség kb. 26%-a; a „rúna” sima
izzó korong egy szögletes kőblokkon, nem faragott jel.

## fallen_tree.glb — kidőlt ősfa

| | |
| --- | --- |
| Hely a játékban | Még nincs bekötve. Cél: kb. 11 m hosszú kidőlt törzs, a gyökértányér kb. 3,5 m magas |
| Méret | 6769 háromszög, 14012 csúcspont, 442 KB (1024-es WebP alapszín) |
| Bemenő kép | FLUX.2 Pro a Higgsfield-en (1 kredit), 1:1; seed nem állítható, job `f2089513-1c80-4ea5-852e-81034ca061f6`. Előtte 4 Z-Image-kép és 1 FLUX-kép el lett dobva (álló fa nőtt ki a törzsből, ill. nem volt gyökértányér); a képekre összesen 2,6 kredit ment |
| 3D modell | Meshy 7 Image to 3D a Higgsfield-en (38 kredit): `should_texture`, PBR nélkül, `target_polycount` 8000 |
| Optimalizálás | `node tools/props/optimize.mjs nyers.glb src/assets/props/fallen_tree.glb 6000 1024` (nyersen 8162; a sok UV-varrat miatt 6769-nél állt meg) |

A kép promptja:

> Stylized 3D game asset: a huge fallen ancient tree trunk lying flat on the ground, gnarled deeply
> furrowed bark, a broken splintered end, a big upturned root ball with tangled roots and clumps of earth
> at the other end, thick soft moss cushions along the top, a few small orange mushrooms. Chunky readable
> shapes, hand-painted textures, stylized indie fantasy game look. Single object, fully visible and
> centered, side view, slightly from above, plain flat light grey background, soft even studio lighting,
> no cast shadows, no text.

A törzs az X tengely mentén fekszik: a gyökértányér a +X, a szilánkos törött vég a −X végén van; a kép
oldalnézete a +Z felé néz (Meshy alapértelmezés). Modellegységben 1,90 (X) × 0,72 (Y) × 1,00 (Z); 11 m
hosszra nagyítva kb. 4,1 m magas és a szétterülő gyökerek miatt 5,8 m széles. Ismert hibák: a
gyökértányér nem magas, felálló korong, hanem a törzsvég alatti sötét föld- és kőcsomó szétterülő
gyökerekkel; a kéreg inkább egymásra rakott deszkáknak, a törött vég deszkakötegnek hat.

## broken_pillars.glb — törött oszlopcsoport

| | |
| --- | --- |
| Hely a játékban | Még nincs bekötve. Cél: kb. 4,5 m magas oszlopcsoport |
| Méret | 4999 háromszög, 7671 csúcspont, 220 KB (1024-es WebP alapszín) |
| Bemenő kép | FLUX.2 Pro a Higgsfield-en (1 kredit), 1:1; seed nem állítható, job `30211225-2fa0-48c0-9c6e-c74e0e3a774a`. Előtte 3 Z-Image-kép (ép oszlopfők, a ledőlt dob dobhangszernek rajzolva) és 1 FLUX-kép (négy oszlop) el lett dobva; a képekre összesen 2,45 kredit ment |
| 3D modell | Tripo P2 Image to 3D a Higgsfield-en (34 kredit): `face_limit` 8000, textúra, PBR nélkül, `delight` |
| Optimalizálás | `node tools/props/optimize.mjs nyers.glb src/assets/props/broken_pillars.glb 5000 1024` (nyersen 7539) |

A kép promptja:

> Stylized 3D game asset: a cluster of three ancient fluted grey stone columns of different heights
> standing on square plinths, their tops broken off and jagged, one fallen column drum lying beside
> them, small rubble, patches of moss. Chunky readable shapes, hand-painted textures, stylized indie
> fantasy game look. Single object, fully visible and centered, three-quarter front view, plain flat
> light grey background, soft even studio lighting, no cast shadows, no text.

A modell eleje (a ledőlt oszlopdobbal) a +X irányba néz. Modellegységben 0,64 (X) × 0,91 (Y) × 1,00 (Z);
4,5 m magasra nagyítva kb. 5 m széles. Ismert hibák: a legmagasabb oszlop megtartotta az ión oszlopfőt
(csak a másik kettő törött); a hornyolás nagyrészt csak festett vonal, nem geometria; a talapzatok egy
közös, lépcsős alapba olvadtak; a tövüknél két apró, vékony lapka-hiba (zöld rombusz) látszik.

## cairn_shrine.glb — rúnás kőhalom-szentély

| | |
| --- | --- |
| Hely a játékban | Még nincs bekötve. Cél: kb. 2 m magas kőhalom; fölötte a játék saját lebegő kristálya marad |
| Méret | 3999 háromszög, 3252 csúcspont, 144 KB (1024-es WebP alapszín + rúna-emisszív térkép) |
| Bemenő kép | Z-Image (Tongyi-MAI) a Higgsfield-en (0,15 kredit), 1:1; seed nem állítható, job `9cd92e1c-a9aa-4484-ae31-48fe754c0a83` |
| 3D modell | Tripo P2 Image to 3D a Higgsfield-en (34 kredit): `face_limit` 8000, textúra, PBR nélkül, `delight` |
| Optimalizálás | `node tools/props/optimize.mjs nyers.glb src/assets/props/cairn_shrine.glb 4000 1024` (nyersen 8268; emisszív pixelek: 1,92%) |

A kép promptja:

> Stylized 3D game asset: a small forest shrine cairn of flat carved grey stones stacked in a tapering
> pile, engraved spiral runes glowing faint cyan, moss in the gaps, a flat top stone. Chunky readable
> shapes, hand-painted textures, stylized indie fantasy game look. Single object, fully visible and
> centered, three-quarter front view, plain flat light grey background, soft even studio lighting, no
> cast shadows, no text.

A modell eleje a +X irányba néz (az egyik oldalán külön kőkupac). Modellegységben 0,91 (X) × 0,94 (Y)
× 1,00 (Z). A teteje két egymásra rakott lapos kő, felül sík, csak néhány apró mohacsomóval; a
kristálynak ezek fölött kell lebegnie. Ismert hibák: a kövek inkább lekerekített görgetegek, mint lapos
faragott lapok; a spirálrúnák szinte minden kövön izzanak, erősebben, mint a promptbeli „faint”.

## brazier.glb — kő tűztartó

| | |
| --- | --- |
| Hely a játékban | Még nincs bekötve. Cél: 4 db, kb. 1,3 m magas; a lángot a játék rajzolja |
| Méret | 7314 háromszög, 15207 csúcspont, 403 KB (512-es WebP alapszín) |
| Bemenő kép | FLUX.2 Pro a Higgsfield-en (1 kredit), 1:1; seed nem állítható, job `95b8a8de-6dc5-480b-b9d4-b25a2f826cf4`. Előtte 4 Z-Image-kép (mindegyiken láng volt) és 1 FLUX-kép (kis lángnyelvek) el lett dobva; a képekre összesen 2,6 kredit ment |
| 3D modell | Meshy 7 Image to 3D a Higgsfield-en (38 kredit): `should_texture`, PBR nélkül, `target_polycount` 8000 |
| Optimalizálás | `node tools/props/optimize.mjs nyers.glb src/assets/props/brazier.glb 3000 512` (nyersen 8252; a 3000-es cél elérhetetlen: a UV-varratok és a sok különálló parázsdarab miatt 7314-nél állt meg, 0,06-os hibahatárral is csak 7070) |

A kép promptja:

> Stylized 3D game asset: a fantasy stone pedestal brazier, a carved octagonal grey stone pillar about
> waist high holding a wide shallow dark iron fire bowl filled with glowing orange embers, no flames, no
> smoke. Chunky readable shapes, hand-painted textures, stylized indie fantasy game look. Single object,
> fully visible and centered, three-quarter front view, plain flat light grey background, soft even
> studio lighting, no cast shadows, no text.

Közel forgásszimmetrikus nyolcszögletű talapzat, az eleje a Meshy szerint a +Z (a játékban mindegy).
Modellegységben 1,81 (X) × 1,90 (Y) × 1,84 (Z): a tál pereme majdnem olyan széles, mint a tárgy magassága
(1,3 m magasra nagyítva kb. 1,24 m átmérő). A parázs a tálban külön geometria-darabok narancs textúrával,
de nem izzik (az `optimize.mjs` csak a cián pixelekből készít emisszív térképet). Ismert hibák: négy
példánnyal kb. 29 000 háromszög; a parázs vöröse csíkokban a kő repedéseibe is átfolyt.

## cave_mouth_a.glb — magas barlangszáj

| | |
| --- | --- |
| Hely a játékban | 4 barlang a 7 troll-spawnpontból (`CAVE_MODEL`, `src/game/06-arena.js`): 16,8 m magas, 19,2 m széles, 14,2 m mély sziklatömb a peremfalba ágyazva, a nyílás a tisztás közepe felé. Az eleje `R_CAVE − 3`-nál van, így a trollok a száj belsejéből lépnek ki |
| Méret | 4999 háromszög, 7257 csúcspont, 214 KB (1024-es WebP alapszín) |
| Bemenő kép | FLUX.2 Pro a Higgsfield-en (1 kredit), 1:1; seed nem állítható, job `3ccbd8ef-179e-45d7-ad7e-c1c935ff7bdd`. Előtte 3 Z-Image-kép el lett dobva (a barlang belseje csak sötétszürke); a képekre összesen 1,45 kredit ment |
| 3D modell | Tripo P2 Image to 3D a Higgsfield-en (34 kredit): `face_limit` 8000, textúra, PBR nélkül, `delight` |
| Optimalizálás | `node tools/props/optimize.mjs nyers.glb src/assets/props/cave_mouth_a.glb 5000 1024` (nyersen 5980) |

A kép promptja:

> Stylized 3D game asset: a large mossy grey rock outcrop with a tall arched cave entrance in its front
> face, rough boulders framing the opening, the inside of the cave pitch black, small ferns and moss.
> Chunky readable shapes, hand-painted textures, stylized indie fantasy game look. Single object, fully
> visible and centered, three-quarter front view, plain flat light grey background, soft even studio
> lighting, no cast shadows, no text.

A nyílás a +X irányba néz. Modellegységben 0,74 (X) × 0,88 (Y) × 1,00 (Z); 4 m magasra nagyítva csak
kb. 4,6 m széles. Ismert hibák: a nyílás belseje sötét szürkésbarna, nem koromfekete (a `delight`
kivilágosította); a Tripo a hátoldalra (−X) is rajzolt egy vak boltívet (tömör, nem lehet átlátni); a
boltív illesztett kőtömbökből áll, inkább falazatnak, mint természetes sziklának hat; a tetején barna
földpárkányok és egy kőcsúcs vannak.

## cave_mouth_b.glb — alacsony barlangszáj

| | |
| --- | --- |
| Hely a játékban | 3 barlang a 7 troll-spawnpontból (`CAVE_MODEL`, `src/game/06-arena.js`): 11,4 m magas, 30 m széles, 28 m mély sziklahalom a peremfalba ágyazva, a nyílás a tisztás közepe felé. A déli holdkapu melletti helyen (5,0 rad) nem fér el, ott A-típus áll |
| Méret | 4944 háromszög, 7452 csúcspont, 220 KB (1024-es WebP alapszín) |
| Bemenő kép | FLUX.2 Pro a Higgsfield-en (1 kredit), 1:1; seed nem állítható, job `8c549be3-e554-41d7-9ff6-0096527cca77`. Előtte 3 Z-Image-kép el lett dobva (a barlang belseje csak sötétszürke); a képekre összesen 1,45 kredit ment |
| 3D modell | Tripo P2 Image to 3D a Higgsfield-en (34 kredit): `face_limit` 8000, textúra, PBR nélkül, `delight` |
| Optimalizálás | `node tools/props/optimize.mjs nyers.glb src/assets/props/cave_mouth_b.glb 5000 1024` (nyersen már 4944 volt, nem egyszerűsített) |

A kép promptja:

> Stylized 3D game asset: a low wide mossy grey rocky mound with a wide low cave entrance in its front
> face, rough boulders framing the opening, the inside of the cave pitch black, small ferns and moss.
> Chunky readable shapes, hand-painted textures, stylized indie fantasy game look. Single object, fully
> visible and centered, three-quarter front view, plain flat light grey background, soft even studio
> lighting, no cast shadows, no text.

A nyílás a +X irányba néz; a hátoldal tömör. Modellegységben 0,93 (X) × 0,38 (Y) × 1,00 (Z). A nyílás
belseje majdnem fekete, sekély mélyedés. Ismert hibák: a talpán lapos fűszoknya (talajfolt páfrányokkal)
van, ezt a terepbe kell süllyeszteni.

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
