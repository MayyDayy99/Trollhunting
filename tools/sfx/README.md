## Újragenerálás / új hang hozzáadása

1. **Generálás** az ElevenLabs connectorral (Claude Code): egyetlen flow, `sfx` csomópont,
   `eleven_text_to_sound_v3` modell, `duration_seconds` = a táblázat szerinti hossz, `prompt_influence` 0,5,
   `loop` ki. A prompt a táblázatbeli leírás + a közös stílus-utótag:
   `, stylized fantasy game sound effect, punchy, close-mic, dry, no music`.
   Rövid, konkrét prompt, egy hang generálásonként, vizuális szavak nélkül. Előtte `estimate_only`
   becslés; egy generálást ne futtass újra „próbaképp”, mert minden futás kreditbe kerül.
2. **Letöltés** a kész generációk URL-jéről (`curl`), egy üres mappába.
3. **Feldolgozás** (`ffmpeg` kell a PATH-on): mono, 44,1 kHz, a csend levágása elöl (−30 dB a csúcshoz
   képest, 2 ms előtét) és hátul (−50 dB, +30 ms), 2 ms be- és 40 ms kiúsztatás, csúcs-normalizálás
   −1,2 dBFS-re, MP3 64 kbit/s:

   ```sh
   ffmpeg -i nyers.mp3 -ac 1 -ar 44100 -f f32le - | (Node: vágás + úsztatás + normalizálás) |
   ffmpeg -f f32le -ar 44100 -ac 1 -i - -c:a libmp3lame -b:a 64k src/assets/sfx/<név>[_<n>].mp3
   ```

   A szkript: `tools/sfx/sfx-tool.mjs` (`process <be> <ki.mp3>` és `analyze <fájlok…>`).
4. **Ellenőrzés** (hallgatás nélkül is): hossz, megszólalás ≤ 20 ms a fájl elejétől, nincs klippelés,
   értelmes RMS. Ha egy változat hibás (csend, túl hosszú lecsengés), csak azt az egy hangot generáld újra.
5. **Bekötés:** a `src/assets.js` automatikusan felveszi a `src/assets/sfx/*.mp3` fájlokat
   (`<név>_<n>.mp3` = a `<név>` hang n-edik változata). A `20-audio-input.js` `AUD` metódusa
   `play('<név>', hangerő, {vary, max, cd})`-del játssza; ha a minta nincs dekódolva, a régi
   szintetizált hang szól.

## Zene és atmoszféra (háttér-rétegek)

A `music.mp3` (ElevenLabs Music v2.5, hangszeres, 75 mp) és az `amb.mp3` (Sound Effects v3, `loop` be, 24 mp) végtelenítve szól
(`AUD.music(on)`, `AUD.amb(on)` a `20-audio-input.js`-ben). A varratmentes hurkot a `tools/sfx/loopify.mjs` készíti:
a fájl végét egyenletes-teljesítményű áttűnéssel az elejére keveri, majd csúcs-normalizál és kódol
(paraméterek a `sounds.json`-ban). A lejátszó a hurok határát a valódi hanganyaghoz igazítja (az MP3 néma kitöltése kimarad).
