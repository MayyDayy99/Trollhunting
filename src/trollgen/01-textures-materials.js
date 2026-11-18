/* --------------------------------------------------- procedurális textúrák -- */
function glowTexture() {
  const c = document.createElement('canvas'); c.width = c.height = 64;
  const x = c.getContext('2d'), g = x.createRadialGradient(32, 32, 0, 32, 32, 32);
  g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(.35, 'rgba(255,255,255,.55)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  x.fillStyle = g; x.fillRect(0, 0, 64, 64); return new T3.CanvasTexture(c);
}
function noiseTexture(size, blobs) {
  const c = document.createElement('canvas'); c.width = c.height = size;
  const x = c.getContext('2d'); x.fillStyle = '#808080'; x.fillRect(0, 0, size, size);
  for (let i = 0; i < blobs; i++) {
    x.fillStyle = i % 2 ? '#aaaaaa' : '#555555'; x.globalAlpha = .5;
    x.beginPath(); x.arc(Math.random() * size, Math.random() * size, 1 + Math.random() * 4, 0, 6.3); x.fill();
  }
  const t = new T3.CanvasTexture(c); t.wrapS = t.wrapT = T3.RepeatWrapping; t.repeat.set(3, 3); return t;
}
function mossTexture() {
  const c = document.createElement('canvas'); c.width = c.height = 256;
  const x = c.getContext('2d'); x.fillStyle = '#41704e'; x.fillRect(0, 0, 256, 256);
  const cols = ['#4e8159', '#36603f', '#5d8f5f', '#3a6a48'];
  for (let i = 0; i < 900; i++) {
    x.fillStyle = cols[i % 4]; x.globalAlpha = .4;
    x.beginPath(); x.arc(Math.random() * 256, Math.random() * 256, 1 + Math.random() * 4, 0, 6.3); x.fill();
  }
  const t = new T3.CanvasTexture(c); t.wrapS = t.wrapT = T3.RepeatWrapping; t.repeat.set(10, 10); return t;
}
const GLOW   = H.GLOW   || glowTexture();
const SKIN_N = H.SKIN_N || noiseTexture(128, 500);
const MOSS_T = H.MOSS_T || (function () { const t = mossTexture(); t.encoding = T3.sRGBEncoding; return t; })();

/* -------------------------------------------------------------- anyagok ---- */
/* megosztott (a játékkal azonos hexek) */
const M = {
  skinDark: std({ color: 0x3f6250, bumpMap: SKIN_N, bumpScale: .015 }),
  belly:    std({ color: 0xe4d8b8 }),
  hair:     std({ color: 0x24402e, roughness: .97 }),
  tusk:     std({ color: 0xeee2cf, roughness: .5 }),
  tuskV:    std({ color: 0xeee2cf, roughness: .5, vertexColors: true }),
  cloth:    std({ color: 0x604028, roughness: 1 }),
  leather:  std({ color: 0x5a4030, roughness: .95 }),
  rope:     std({ color: 0x9a7b4f, roughness: 1 }),
  wood:     std({ color: 0x7b5433, roughness: .85, bumpMap: SKIN_N, bumpScale: .02 }),
  woodDark: std({ color: 0x3b2a1e, roughness: .95 }),
  woodDarkV:std({ color: 0x5c4430, roughness: .95, vertexColors: true }),
  rock:     std({ color: 0x59637a, roughness: .95, bumpMap: SKIN_N, bumpScale: .05 }),
  rockV:    std({ color: 0x59637a, roughness: .95, vertexColors: true }),
  moss:     std({ color: 0x93c584, roughness: .92, map: MOSS_T, bumpMap: MOSS_T, bumpScale: .06 }),
  mossV:    std({ color: 0x466b42, roughness: .92, vertexColors: true }),
  lichen:   std({ color: 0xbcd0c2, roughness: 1, map: MOSS_T, bumpMap: MOSS_T, bumpScale: .04 }),
  stem:     std({ color: 0xe8dcc2, roughness: .8 }),
  cap:      std({ color: 0xc44a43, roughness: .7 }),
  glowCap:  new T3.MeshStandardMaterial({ color: 0x16414f, emissive: 0x36c5ff, emissiveIntensity: 1.2, roughness: .6, flatShading: true }),
  metal:    new T3.MeshStandardMaterial({ color: 0xbfc6d2, metalness: .7, roughness: .3 }),
  gold:     new T3.MeshStandardMaterial({ color: 0xc9a14e, metalness: .65, roughness: .3 }),
  mouth:    std({ color: 0x3a1414, roughness: 1 }),
  tongue:   std({ color: 0xa8564f, roughness: .7 }),
  scar:     std({ color: 0xc8b596, roughness: .75 }),
  arrowWood:std({ color: 0x8a6a40, roughness: .7 }),
  feather:  std({ color: 0xd64b3a, roughness: .8, side: T3.DoubleSide }),
};

