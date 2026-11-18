// Convert a rendered PNG (e.g. a Blender flipbook atlas) to WebP for the game, keeping alpha.
// Usage: node tools/props/to-webp.mjs in.png out.webp [quality=90]
import sharp from 'sharp';

const [input, output, quality = '90'] = process.argv.slice(2);
const info = await sharp(input).webp({ quality: Number(quality), alphaQuality: 90, effort: 6 }).toFile(output);
console.log(`${output}: ${info.width}x${info.height}, ${(info.size / 1024).toFixed(0)} KB`);
