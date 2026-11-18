// Game-ready version of a TRELLIS.2 GLB: weld + simplify, stylized PBR, small WebP textures,
// an emissive mask for the glowing cyan runes, quantized geometry.
// Usage: node optimize.mjs in.glb out.glb [targetTris=6000] [texSize=1024]
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { weld, simplify, prune, dedup, quantize, textureCompress } from '@gltf-transform/functions';
import { MeshoptSimplifier } from 'meshoptimizer';
import sharp from 'sharp';

const [inPath, outPath, tris = '6000', tex = '1024'] = process.argv.slice(2);
const targetTris = Number(tris), texSize = Number(tex);
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS);
const doc = await io.read(inPath);
const root = doc.getRoot();

const countTris = () => root.listMeshes().reduce((n, m) => n + m.listPrimitives()
  .reduce((k, p) => k + (p.getIndices() ? p.getIndices().getCount() : p.getAttribute('POSITION').getCount()) / 3, 0), 0);
const before = countTris();
const describe = () => root.listMaterials().map(m => ({
  name: m.getName(), base: !!m.getBaseColorTexture(), mr: !!m.getMetallicRoughnessTexture(),
  normal: !!m.getNormalTexture(), emissive: !!m.getEmissiveTexture(), alpha: m.getAlphaMode(),
  metal: m.getMetallicFactor(), rough: m.getRoughnessFactor(),
}));
console.log('in:', { tris: before, meshes: root.listMeshes().length, textures: root.listTextures().map(t => `${t.getMimeType()} ${t.getSize()}`) });
console.log('materials in:', describe());

await doc.transform(weld(), dedup());
await MeshoptSimplifier.ready;
await doc.transform(simplify({ simplifier: MeshoptSimplifier, ratio: Math.min(1, targetTris / countTris()), error: 0.01, lockBorder: false }));

for (const m of root.listMaterials()) {
  // Stone/moss look of the game: matte, non-metal. Drop the metal/roughness map (size), keep base color + normal.
  const mr = m.getMetallicRoughnessTexture();
  if (mr) m.setMetallicRoughnessTexture(null);
  m.setMetallicFactor(0).setRoughnessFactor(0.9);
  if (m.getAlphaMode() === 'BLEND') m.setAlphaMode('OPAQUE');

  // Emissive mask: saturated cyan pixels of the base color (the rune carvings) glow; everything else is black.
  const base = m.getBaseColorTexture();
  if (base && !m.getEmissiveTexture()) {
    const img = sharp(Buffer.from(base.getImage()));
    const { data, info } = await img.ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    const out = Buffer.alloc(info.width * info.height * 3);
    let lit = 0;
    for (let i = 0, j = 0; i < data.length; i += 4, j += 3) {
      const r = data[i], g = data[i + 1], b = data[i + 2];
      const cyan = g > 150 && b > 140 && r < 0.62 * Math.min(g, b) && Math.abs(g - b) < 90;
      if (cyan) { out[j] = r; out[j + 1] = g; out[j + 2] = b; lit++; }
    }
    if (lit > 0) {
      const png = await sharp(out, { raw: { width: info.width, height: info.height, channels: 3 } }).png().toBuffer();
      const em = doc.createTexture('runeEmissive').setImage(new Uint8Array(png)).setMimeType('image/png');
      m.setEmissiveTexture(em).setEmissiveFactor([1, 1, 1]);
      const ti = m.getBaseColorTextureInfo(), ei = m.getEmissiveTextureInfo();
      if (ti && ei) ei.setTexCoord(ti.getTexCoord());
    }
    console.log(`emissive rune pixels: ${lit} (${(100 * lit / (info.width * info.height)).toFixed(2)}%)`);
  }
}

await doc.transform(
  prune(),
  textureCompress({ encoder: sharp, targetFormat: 'webp', resize: [texSize, texSize], quality: 82 }),
  quantize(),
);
await io.write(outPath, doc);
console.log('out:', { tris: countTris(), textures: root.listTextures().map(t => `${t.getMimeType()} ${t.getSize()}`) });
console.log('materials out:', describe());
