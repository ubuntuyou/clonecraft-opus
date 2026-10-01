// ---- post-processing: bloom and light shafts ------------------------------------------
// `post.render()` draws the world. With CONFIG.bloom off it renders straight to the screen.
// Otherwise it renders into `sceneRT` (HDR half float when the GPU allows, with a depth
// texture), then composites to the screen:
//   bloom:  bright pass into a 5-level mip chain (1/2 .. 1/32), 4-tap box downsample,
//           9-tap tent upsample added back up the chain.
//   shafts: a quarter-size mask of open sky around the sun (or moon), from the depth
//           texture (terrain opens with fog, clouds above the world top open 30%), then two radial
//           blur passes toward the light's screen position. Shafts fade out when the light
//           is off-screen, below the horizon, or the head is underwater.
// The composite adds both, rolls off the brightest channel above 0.9 (the hue stays), and dithers. The held item renders
// after it, so it neither blooms nor catches shafts. In HDR, `glowGain` 2 pushes the sun,
// moon, flames, and water glint above 1.0; only those cross the bloom threshold.
// G3: the sun (or moon) shadow map. An orthographic camera on the light direction renders a
// 2048² depth map, 128 blocks wide, centred on the camera and snapped to whole texels so the
// edges do not crawl. Casters: opaque terrain (leaves keep their holes), mobs, block drops,
// vehicles, and arrows. The pass hides water, transparent and alpha-tested materials, points,
// lines, and every ShaderMaterial but the terrain (the sky). Off when Shadows is off and while the
// light is below the horizon. TERRAIN_FS reads it through uShadowMap and uShadowMat.
import { THREE } from './three.js';
import { CONFIG } from './config.js';
import { atlasTexture } from './atlas.js';
import { terrainMaterial, terrainUniforms } from './terrain-material.js';
import { camera, game, renderer, scene } from './engine.js';

const shadows = (() => {
  const SIZE = 2048, HALF = 64, DEPTH = 320;
  const rt = new THREE.WebGLRenderTarget(SIZE, SIZE, { depthBuffer: true, stencilBuffer: false });
  rt.depthTexture = new THREE.DepthTexture(SIZE, SIZE);
  rt.depthTexture.compareFunction = THREE.LessEqualCompare;   // P2: sampler2DShadow, hardware-filtered compares
  rt.depthTexture.minFilter = rt.depthTexture.magFilter = THREE.LinearFilter;
  const cam = new THREE.OrthographicCamera(-HALF, HALF, HALF, -HALF, 0.5, DEPTH);
  const VS = (uv) => `${uv ? 'attribute vec2 aUv; attribute vec4 aTint; varying vec2 vUv; varying float vLeaf;' : ''} void main() { ${uv ? 'vUv = aUv / 4096.0; vLeaf = step(0.45, aTint.a) * step(aTint.a, 0.55);' : ''} gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`;
  // Leaf faces (sway alpha 128) drop half of their 4x4-texel cells, so light dapples through a canopy.
  const cutMat = new THREE.ShaderMaterial({ uniforms: { map: { value: atlasTexture } }, side: THREE.DoubleSide, vertexShader: VS(true),
    fragmentShader: `uniform sampler2D map; varying vec2 vUv; varying float vLeaf;
      void main() {
        if (texture2D(map, vUv).a < 0.5) discard;
        if (vLeaf > 0.5 && fract(sin(dot(floor(vUv * 64.0), vec2(12.9898, 78.233))) * 43758.5453) < 0.5) discard;
        gl_FragColor = vec4(1.0);
      }` });
  const solidMat = new THREE.ShaderMaterial({ side: THREE.DoubleSide, vertexShader: VS(false), fragmentShader: 'void main() { gl_FragColor = vec4(1.0); }' });
  const right = new THREE.Vector3(), up = new THREE.Vector3(), L = new THREE.Vector3(), c = new THREE.Vector3();
  const swapped = [], hidden = [];
  let inited = false;
  const texel = (2 * HALF) / SIZE;
  terrainUniforms.uShadowMap.value = rt.depthTexture;
  terrainUniforms.uShadowTexel.value = 1 / SIZE;
  terrainUniforms.uShadowBias.value = 0.1 / DEPTH;
  const caster = (o) => {
    const m = o.material;
    if (!m || Array.isArray(m)) return null;
    if (m === terrainMaterial) return cutMat;
    if (m.isShaderMaterial || m.transparent || m.alphaTest > 0 || m.fog === false) return null;
    return solidMat;
  };
  return {
    render() {
      // a sampler2DShadow needs a real depth texture from the first frame (menu, loading, Shadows off):
      // clear the target once so three.js allocates it instead of binding a colour placeholder
      if (!inited) { renderer.setRenderTarget(rt); renderer.clear(); renderer.setRenderTarget(null); inited = true; }
      const on = CONFIG.shadows && game.state !== 'loading' && terrainUniforms.uSunAmt.value > 0.01;
      terrainUniforms.uShadowOn.value = CONFIG.shadows ? 1 : 0;
      if (!on) return;
      // light basis; snap the centre to whole texels in light space
      L.copy(terrainUniforms.uSunDir.value).normalize();
      cam.up.set(0, 1, 0);
      if (Math.abs(L.y) > 0.99) cam.up.set(0, 0, 1);
      cam.position.copy(L); cam.lookAt(0, 0, 0); cam.updateMatrixWorld();
      right.setFromMatrixColumn(cam.matrixWorld, 0); up.setFromMatrixColumn(cam.matrixWorld, 1);
      const p = camera.position;
      const cr = Math.round(p.dot(right) / texel) * texel, cu = Math.round(p.dot(up) / texel) * texel;
      c.copy(right).multiplyScalar(cr).addScaledVector(up, cu).addScaledVector(L, p.dot(L));
      cam.position.copy(c).addScaledVector(L, DEPTH * 0.5);
      cam.updateMatrixWorld();
      terrainUniforms.uShadowMat.value.multiplyMatrices(cam.projectionMatrix, cam.matrixWorldInverse);
      // swap caster materials, hide the rest
      scene.traverseVisible((o) => {
        if (o.isPoints || o.isLine || o.isSprite) { hidden.push(o); return; }
        if (!o.isMesh) return;
        const m = caster(o);
        if (m) { swapped.push(o, o.material); o.material = m; } else hidden.push(o);
      });
      for (const o of hidden) o.visible = false;
      const bg = scene.background, fog = scene.fog;
      scene.background = null; scene.fog = null;
      renderer.setRenderTarget(rt);
      renderer.clear();
      renderer.render(scene, cam);
      renderer.setRenderTarget(null);
      scene.background = bg; scene.fog = fog;
      for (const o of hidden) o.visible = true;
      for (let i = 0; i < swapped.length; i += 2) swapped[i].material = swapped[i + 1];
      hidden.length = 0; swapped.length = 0;
    },
    get camera() { return cam; },
  };
})();

export { shadows };
