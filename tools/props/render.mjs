// Render a GLB with three.js r128 (the game's version) in headless Edge, from several angles, into one PNG.
// Usage: node render.mjs model.glb out.png
import { chromium } from 'playwright-core';
import fs from 'node:fs';
import path from 'node:path';

const [glbPath, outPath] = process.argv.slice(2);
const html = `<!doctype html><html><body style="margin:0;background:#0a1018">
<canvas id="c" width="1600" height="560"></canvas>
<script src="https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js"></script>
<script src="https://cdn.jsdelivr.net/npm/three@0.128.0/examples/js/loaders/GLTFLoader.js"></script>
<script>
const cv=document.getElementById('c');
const r=new THREE.WebGLRenderer({canvas:cv,antialias:true}); r.outputEncoding=THREE.sRGBEncoding; r.setScissorTest(true);
const scene=new THREE.Scene(); scene.background=new THREE.Color(0x16233a); scene.fog=new THREE.Fog(0x16233a,8,20);
scene.add(new THREE.HemisphereLight(0xbfd7ff,0x2d3a22,0.75));
const sun=new THREE.DirectionalLight(0xffe2b8,1.15); sun.position.set(3,5,4); scene.add(sun);
const ground=new THREE.Mesh(new THREE.CircleGeometry(3,48),new THREE.MeshStandardMaterial({color:0x3c5a2c,roughness:1}));
ground.rotation.x=-Math.PI/2; scene.add(ground);
const cam=new THREE.PerspectiveCamera(32,400/560,0.05,50);
new THREE.GLTFLoader().load('http://prop.local/model.glb', g=>{
  const o=g.scene, box=new THREE.Box3().setFromObject(o), s=new THREE.Vector3(); box.getSize(s);
  const k=1.8/s.y; o.scale.setScalar(k); box.setFromObject(o); o.position.y-=box.min.y; scene.add(o);
  let tris=0; o.traverse(m=>{ if(m.isMesh) tris+=(m.geometry.index?m.geometry.index.count:m.geometry.attributes.position.count)/3; });
  const views=[0.35,1.9,Math.PI,-1.9];
  views.forEach((a,i)=>{ cam.position.set(Math.sin(a)*4.6,1.55,Math.cos(a)*4.6); cam.lookAt(0,0.9,0);
    r.setViewport(i*400,0,400,560); r.setScissor(i*400,0,400,560); r.render(scene,cam); });
  window.__done={tris, programs:r.info.programs.length};
}, undefined, e=>{ window.__done={error:String(e)}; });
</script></body></html>`;

const browser = await chromium.launch({ channel: 'msedge', headless: true, args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const page = await browser.newPage({ viewport: { width: 1600, height: 560 } });
const errors = [];
page.on('pageerror', e => errors.push(e.message));
page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
await page.route('http://prop.local/**', route => {
  const url = new URL(route.request().url());
  if (url.pathname === '/') return route.fulfill({ contentType: 'text/html', body: html });
  if (url.pathname === '/model.glb') return route.fulfill({ contentType: 'model/gltf-binary', body: fs.readFileSync(glbPath) });
  return route.fulfill({ status: 404 });
});
await page.goto('http://prop.local/');
await page.waitForFunction(() => window.__done, null, { timeout: 60000 });
const done = await page.evaluate(() => window.__done);
await page.locator('#c').screenshot({ path: outPath });
await browser.close();
console.log(JSON.stringify({ ...done, errors, out: path.basename(outPath) }));
