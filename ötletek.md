# Ötletek — Mohás Roham (későbbi fejlesztések)

Ezek nincsenek még megvalósítva, csak feljegyzés a jövőre.

## 1. Nyíl-gazdálkodás (nincs korlátlan lövés)
- A nyíl ne legyen végtelen — a játékosnak **szedegetnie** kelljen a nyilakat.
- A **trollok az elemüknek megfelelő nyilat "dobják"/ejtik** (pl. tűz-troll → tűz-nyíl, jég-troll → jég-nyíl), amit fel lehet venni.
- Így az elem-választás erőforrás-menedzsmentté válik: azt az elemet tudod lőni, amiből van muníciód.
- Megfontolandó: alap-nyílból lehessen több/korlátlan, az elemi nyilak legyenek a szűkös erőforrás; földről felszedés + esetleg a tegez kijelzése a HUD-on.

## 2. Kis, gyors trollok másszanak lépcsőt/rámpát
- Jelenleg a közelharcos trollok nem jutnak fel a rámpákra/lombház-fedélzetekre (a `mob` ütközők miatt a magas építmények alatt átmennek, de nem másznak fel).
- A **kicsi, gyors trollok (pl. kobold/scout)** tudjanak felfutni a lépcsőkön/rámpákon a játékos után — hogy a magaslat ne legyen teljesen biztonságos menedék.
- Technikai megjegyzés: a trollok jelenleg a `pushMob` alapján a talajon mozognak; kellene egy egyszerű "lépcső-mászó" AI a fürge típusoknak (a rámpák `climb` solidBox-tetejét követve, STEP-lépcsőzéssel), csak a könnyű/gyors típusokra korlátozva, hogy ne legyen túl nehéz.

## 3. VIHAR (ultimate) hasznosabbá tétele
- Az ötlet jó, de a jelenlegi VIHAR **túl gyenge/haszontalan** (fix 8 sebzés + 3 stack elem az egész pályára; a Vihar-Mester kártya emeli 35/62-re, de alapból lapos).
- Kapjon **boostot vagy extra funkciót**, hogy tényleg "ultimate" élmény legyen. Ötletek:
  - Rövid idejű **elemi túltöltés**: a VIHAR után pár másodpercig minden nyíl dupla elemi erővel / ingyen elemi lövés (kapcsolódik az 1. ponthoz — muníció nélkül is).
  - **Nagyobb, látványosabb becsapódás**: elemtől függő pálya-esemény (tűz: égő gyűrű terjed; jég: mindenki teljes fagy pár mp-re; villám: lánc mindenkin; méreg: tartós gázmező).
  - **Játékos-buff**: rövid sérthetetlenség / mozgás-sebesség / lassított idő a VIHAR alatt.
  - Skálázódjon a hullámmal vagy a betöltéskori elemmel, hogy késői hullámokban is releváns maradjon.
