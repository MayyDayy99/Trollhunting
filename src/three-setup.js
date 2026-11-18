// three.js r128 (the same version the game used to load from the CDN) plus the post-processing
// add-ons the bloom path needs. The game and the troll generator read a global `THREE`
// namespace (THREE.EffectComposer, THREE.UnrealBloomPass, ...), exactly like the old
// examples/js scripts provided, so this module builds that namespace and publishes it.
import * as THREE_NS from 'three';
import { EffectComposer, Pass, FullScreenQuad } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js';
import { MaskPass, ClearMaskPass } from 'three/examples/jsm/postprocessing/MaskPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { CopyShader } from 'three/examples/jsm/shaders/CopyShader.js';
import { LuminosityHighPassShader } from 'three/examples/jsm/shaders/LuminosityHighPassShader.js';
import { GammaCorrectionShader } from 'three/examples/jsm/shaders/GammaCorrectionShader.js';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';   // generated props (src/assets/props)

export const THREE = Object.assign({}, THREE_NS, {
  EffectComposer, Pass, FullScreenQuad, RenderPass, ShaderPass, MaskPass, ClearMaskPass,
  UnrealBloomPass, CopyShader, LuminosityHighPassShader, GammaCorrectionShader, GLTFLoader,
});
window.THREE = THREE;
