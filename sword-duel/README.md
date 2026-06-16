# Sword Duel ⚔️

1v1 **kézkövetéses** kardpárbaj — **egy kamera, két játékos**, böngészőben.
Three.js (render) + TensorFlow.js MediaPipe Hands (kézkövetés), Vite-tal bundle-ölve,
Dockerben kiszolgálva. Nincs hálózat, nincs szerver-szinkron: minden egy kliensen fut
(így illik a Huawei IdeaHub egy beépített kamerájához).

## Hogyan kell játszani
- Két játékos áll a kamera elé egymás mellé. **Bal oldali = Játékos 1 (cián)**, **jobb oldali = Játékos 2 (narancs)**.
- Mindenki **egy keze** vezet egy kardot: a penge a csuklótól a mutatóujj felé mutat.
- **Gyors suhintással** sebzel (lassú "belesétálás" nem ér); a **pengék összeérve blokkolnak** (szikra, nincs sebzés).
- 2 perc a meccs. KO-val (0 HP) vagy időtúllépésnél a több életűé a győzelem. Döntetlen → hirtelen halál.
- Visszavágóhoz a győzelmi képernyő után emeljétek fel újra mindketten a kezeteket.

---

## Fejlesztés (lokálisan)

```bash
cd sword-duel
npm install
npm run dev
```

Nyisd meg: **http://localhost:5173** (a Vite kiírja a pontos portot).
> A `localhost` *secure context*, így a kamera engedélyezett. Engedélyezd a kamerát a böngészőben.

Első indításkor a TF.js letölti a kéz-modellt (kell internet); utána a böngésző gyorsítótárazza.

Build próbája:
```bash
npm run build      # -> dist/
npm run preview    # a buildet szolgálja ki (localhost)
```

---

## Futtatás Dockerben (IdeaHub / kiszolgálás)

1. **Self-signed cert generálása** (egyszer, a projekt gyökeréből):

   - Windows (PowerShell, openssl a Git for Windowsból):
     ```powershell
     powershell -ExecutionPolicy Bypass -File deploy\gen-cert.ps1
     ```
   - Linux/macOS/Git-Bash:
     ```bash
     bash deploy/gen-cert.sh
     ```
   Ez létrehozza a `deploy/certs/server.crt` + `server.key` fájlokat.

2. **Build és indítás**:
   ```bash
   docker compose up -d --build
   ```

3. **Megnyitás**:
   - **Ugyanazon a gépen** (a böngésző a containerrel egy gépen): `http://localhost:8088` → kamera azonnal megy (loopback = secure context, nincs cert-figyelmeztetés).
   - **LAN-on / IdeaHubon másik gépről**: `https://<gép-IP>` (443-as port) → a böngésző egyszer figyelmeztet a self-signed certre (Speciális → Tovább), utána a kamera megy.

### 🔧 Hibaelhárítás: „nem látom Dockerben"
1. **Fut egyáltalán a konténer?** `docker compose ps` — ha üres vagy a státusz nem `Up`, a konténer nem indult el.
2. **Leggyakoribb ok: port-ütközés.** Ha ezt látod: `bind: Only one usage of each socket address` vagy `ports are not available`, akkor a host-port foglalt. Windowson a 8080-at gyakran lefoglalja a WinNAT — ezért a HTTP-fallback itt **8088**. Ha 8088 is ütközik, írd át a `docker-compose.yml`-ben (pl. 8090-re), vagy nézd meg: `netstat -ano | findstr :8088`. A 443 ütközését is ellenőrizd, ha a HTTPS nem jön be.
3. **Hiányzó cert.** Ha az nginx logban `cannot load certificate /etc/nginx/certs/server.crt`, akkor nem futott le a `gen-cert`. Generáld (1. lépés), majd `docker compose up -d`.
4. **Rossz URL.** A 80-as port NINCS kitéve a hostra — `http://localhost` (port 80) nem megy. Használd: `http://localhost:8088` vagy `https://localhost`.
5. Logok: `docker logs sword-duel`.

### ⚠️ Fontos: a kamera secure contextet igényel
A `getUserMedia` (webkamera) **csak HTTPS-en vagy `localhost`/`127.0.0.1`-en** működik.
Sima `http://<LAN-IP>` esetén a `navigator.mediaDevices` **`undefined`**, és a kamera **némán** nem indul (nincs is engedélykérő ablak) — az app feltöltő képernyője ezt jelzi is.
Ezért:
- ugyanazon a gépen → `http://localhost:8080` **vagy** `https://localhost` jó,
- bármely más eszközről → **HTTPS** kell (`https://...`, 443-as port).

A `docker-compose.yml` a HTTP portot szándékosan csak `127.0.0.1`-re köti, hogy senki ne fusson bele a LAN-on a „némán nem megy a kamera" csapdába.

> Tipp: ha fix IP/hostnév van, generáld a certet azzal a SAN-nal (lásd `deploy/gen-cert.*`), vagy telepítsd a `.crt`-t az IdeaHub trust store-jába, hogy eltűnjön a figyelmeztetés.

---

## Hangolás
Minden szám egy helyen: [`src/config.js`](src/config.js).
Gyakori csavarok:
- `HIT_SPEED` / `REF_SPEED` / `DMG_BASE` — mennyire könnyű/erős a találat.
- `HURT_R` / `CLASH_R` — találati / blokk-távolság.
- `ONE_EURO` — jitter-simítás (ha „rángat", emeld a `minCutoff`-ot; ha „úszik/késik", csökkentsd).
- `BLADE_LEN`, `MATCH_SEC`, `MAX_HP`.

## Modulok
| fájl | felelősség |
|------|-----------|
| `src/main.js` | belépő, render-ciklus, belépő-képernyő, secure-context check |
| `src/handTracking.js` | kamera + TF.js detektor, normalizálás, tükrözés, simítás |
| `src/handAssignment.js` | 0..N kéz → P1/P2 slot (pozíció + követés + grace) |
| `src/smoothing.js` | 1€ (One-Euro) szűrő a jitter ellen |
| `src/sword.js` | kard-mesh, hegysebesség, neon-glow, nyomvonal |
| `src/scene.js` | Three.js jelenet, ortho kamera, részecskék, screen shake |
| `src/collision.js` | szakasz-geometria: találat + pengeváltás |
| `src/game.js` | állapotgép, szabályok, sebzés, győzelem |
| `src/ui.js` | DOM HUD (életcsík, idő, banner, kéz-állapot) |
| `src/audio.js` | szintetizált hangok (WebAudio, nincs mp3) |

## Ismert korlátok / következő lépések
- A TF.js kéz-modell az első betöltéskor netet igényel (utána cache-elt). Teljes offline kiosk-hoz a modellt self-hostolni kell.
- 2.5D mechanika (a kéz-keypointok ~2D-sek): a mélység nincs használva, minden egy síkon.
- A felismerés ~30 FPS; a render ettől függ (egy szálon, await-tel). Ha kell, a detektálás külön loopba tehető.
