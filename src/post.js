// ---- post-processing (section 18) -------------------------------------------------------
// `post` renders the scene into an offscreen target, then adds bloom (a 5-level blur chain)
// and light shafts toward the sun or the moon. It uses half-float targets when the GPU has
// them. glowGain sets the bloom strength; post writes it through setGlowGain().
import { THREE } from './three.js';
import { CONFIG, glowGain, setGlowGain } from './config.js';
import { CLOUD_GLSL, cloudUniforms } from './clouds.js';
import { terrainUniforms } from './terrain-material.js';
import { camera, player, renderer, scene } from './engine.js';
import { sky } from './sky.js';
import { weather } from './weather.js';

const post = (() => {
  const hdr = renderer.capabilities.isWebGL2 &&
    (renderer.extensions.has('EXT_color_buffer_float') || renderer.extensions.has('EXT_color_buffer_half_float'));
  const TYPE = hdr ? THREE.HalfFloatType : THREE.UnsignedByteType;
  const LEVELS = 5;
  const makeRT = (depth) => {
    const t = new THREE.WebGLRenderTarget(1, 1, {
      type: TYPE, minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter, depthBuffer: depth, stencilBuffer: false });
    if (depth) t.depthTexture = new THREE.DepthTexture(1, 1);
    return t;
  };
  const sceneRT = makeRT(true), mips = [], shaftA = makeRT(false), shaftB = makeRT(false);
  for (let i = 0; i < LEVELS; i++) mips.push(makeRT(false));

  // one full-screen triangle
  const tri = new THREE.BufferGeometry();
  tri.setAttribute('position', new THREE.Float32BufferAttribute([-1, -1, 0, 3, -1, 0, -1, 3, 0], 3));
  tri.setAttribute('uv', new THREE.Float32BufferAttribute([0, 0, 2, 0, 0, 2], 2));
  const quad = new THREE.Mesh(tri);
  quad.frustumCulled = false;
  const qScene = new THREE.Scene(), qCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  qScene.add(quad);
  const VS = `varying vec2 vUv; void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }`;
  const material = (uniforms, fs, blending = THREE.NoBlending) => new THREE.ShaderMaterial({
    uniforms, vertexShader: VS, fragmentShader: fs, blending, depthTest: false, depthWrite: false });
  function pass(mat, target) { quad.material = mat; renderer.setRenderTarget(target); renderer.render(qScene, qCam); }

  const BOX4 = `
    vec3 box4(sampler2D t, vec2 uv, vec2 px) {
      return (texture2D(t, uv + px * vec2(-1.0, -1.0)).rgb + texture2D(t, uv + px * vec2(1.0, -1.0)).rgb +
              texture2D(t, uv + px * vec2(-1.0, 1.0)).rgb + texture2D(t, uv + px * vec2(1.0, 1.0)).rgb) * 0.25;
    }`;
  const bright = material({ tSrc: { value: null }, uTexel: { value: new THREE.Vector2() }, uThresh: { value: 1 }, uKnee: { value: 0.2 } }, `
    uniform sampler2D tSrc; uniform vec2 uTexel; uniform float uThresh; uniform float uKnee; varying vec2 vUv;
    ${BOX4}
    void main() {
      vec3 c = min(box4(tSrc, vUv, uTexel), vec3(16.0));
      float br = max(c.r, max(c.g, c.b));
      float s = clamp(br - uThresh + uKnee, 0.0, 2.0 * uKnee);
      s = s * s / (4.0 * uKnee + 1e-4);
      gl_FragColor = vec4(c * max(s, br - uThresh) / max(br, 1e-4), 1.0);
    }`);
  const down = material({ tSrc: { value: null }, uTexel: { value: new THREE.Vector2() } }, `
    uniform sampler2D tSrc; uniform vec2 uTexel; varying vec2 vUv;
    ${BOX4}
    void main() { gl_FragColor = vec4(box4(tSrc, vUv, uTexel), 1.0); }`);
  const up = material({ tSrc: { value: null }, uTexel: { value: new THREE.Vector2() } }, `
    uniform sampler2D tSrc; uniform vec2 uTexel; varying vec2 vUv;
    vec3 s(float x, float y) { return texture2D(tSrc, vUv + uTexel * vec2(x, y)).rgb; }
    void main() {
      vec3 c = s(0.0, 0.0) * 4.0 + (s(-1.0, 0.0) + s(1.0, 0.0) + s(0.0, -1.0) + s(0.0, 1.0)) * 2.0 +
               s(-1.0, -1.0) + s(1.0, -1.0) + s(-1.0, 1.0) + s(1.0, 1.0);
      gl_FragColor = vec4(c / 16.0, 1.0);
    }`, THREE.AdditiveBlending);

  const lightUv = { value: new THREE.Vector2() };
  const mask = material({
    tDepth: { value: sceneRT.depthTexture }, uInvProj: { value: camera.projectionMatrixInverse },
    uCamWorld: { value: camera.matrixWorld }, uLight: lightUv, uAspect: { value: 1 },
    uFogNear: terrainUniforms.uFogNear, uFogFar: terrainUniforms.uFogFar,
    ...cloudUniforms, uCloudNear: sky.cloudNear, uCloudFar: sky.cloudFar,
  }, `
    uniform sampler2D tDepth; uniform mat4 uInvProj; uniform mat4 uCamWorld;
    uniform vec2 uLight; uniform float uAspect; uniform float uFogNear; uniform float uFogFar;
    uniform float uCloudNear; uniform float uCloudFar;
    varying vec2 vUv;
    ${CLOUD_GLSL}
    void main() {
      float d = texture2D(tDepth, vUv).x, open = 1.0;
      vec4 v = uInvProj * vec4(vUv * 2.0 - 1.0, d * 2.0 - 1.0, 1.0);   // d = 1 (sky): a point on the far plane
      v /= v.w;
      if (d < 1.0) open = smoothstep(uFogNear, uFogFar, length(v.xyz));
      // G5: where the ray from the eye to this pixel crosses the cloud layer, the cloud there dims it
      vec3 eye = uCamWorld[3].xyz, wp = (uCamWorld * vec4(v.xyz, 1.0)).xyz;
      if ((eye.y - CLOUD_Y) * (wp.y - CLOUD_Y) < 0.0) {
        float t = (CLOUD_Y - eye.y) / (wp.y - eye.y);
        float fade = 1.0 - smoothstep(uCloudNear, uCloudFar, t * length(v.xyz));
        open *= 1.0 - 0.75 * cloudDensity(mix(eye.xz, wp.xz, t)) * fade;
      }
      vec2 dv = (vUv - uLight) * vec2(uAspect, 1.0);
      float r2 = dot(dv, dv);
      gl_FragColor = vec4(vec3(open * (exp(-r2 * 40.0) * 1.6 + exp(-r2 * 5.0) * 0.4)), 1.0);
    }`);
  const radial = material({ tSrc: { value: null }, uLight: lightUv, uLen: { value: 1 }, uDecay: { value: 0.97 } }, `
    uniform sampler2D tSrc; uniform vec2 uLight; uniform float uLen; uniform float uDecay; varying vec2 vUv;
    void main() {
      vec2 dstep = (uLight - vUv) * uLen / 32.0;
      float j = fract(52.9829189 * fract(dot(gl_FragCoord.xy, vec2(0.06711056, 0.00583715))));
      vec2 uv = vUv + dstep * j;
      float w = 1.0, sum = 0.0, acc = 0.0;
      for (int i = 0; i < 32; i++) { acc += texture2D(tSrc, uv).r * w; sum += w; w *= uDecay; uv += dstep; }
      gl_FragColor = vec4(vec3(acc / sum), 1.0);
    }`);
  const composite = material({
    tScene: { value: sceneRT.texture }, tBloom: { value: mips[0].texture }, tShaft: { value: shaftA.texture },
    uBloom: { value: 0 }, uShaft: { value: new THREE.Color() },
  }, `
    uniform sampler2D tScene; uniform sampler2D tBloom; uniform sampler2D tShaft;
    uniform float uBloom; uniform vec3 uShaft; varying vec2 vUv;
    void main() {
      vec3 c = texture2D(tScene, vUv).rgb + texture2D(tBloom, vUv).rgb * uBloom + texture2D(tShaft, vUv).r * uShaft;
      float m = max(c.r, max(c.g, c.b));                                      // roll off above 0.9, keep the hue
      if (m > 0.9) c *= (0.9 + 0.1 * (1.0 - exp(-(m - 0.9) * 10.0))) / m;
      float n = fract(52.9829189 * fract(dot(gl_FragCoord.xy, vec2(0.06711056, 0.00583715))));
      gl_FragColor = vec4(c + (n - 0.5) / 255.0, 1.0);
    }`);

  const size = new THREE.Vector2();
  function resize() {
    renderer.getDrawingBufferSize(size);
    const w = Math.max(1, size.x), h = Math.max(1, size.y);
    sceneRT.setSize(w, h);
    for (let i = 0; i < LEVELS; i++) mips[i].setSize(Math.max(1, w >> (i + 1)), Math.max(1, h >> (i + 1)));
    shaftA.setSize(Math.max(1, w >> 2), Math.max(1, h >> 2)); shaftB.setSize(Math.max(1, w >> 2), Math.max(1, h >> 2));
    mask.uniforms.uAspect.value = w / h;
  }
  resize();

  const lightDir = new THREE.Vector3(), tmp = new THREE.Vector3(), camDir = new THREE.Vector3();
  const DAY_TINT = new THREE.Color(1, 0.9, 0.72), DUSK_TINT = new THREE.Color(1, 0.55, 0.25), MOON_TINT = new THREE.Color(0.55, 0.65, 1);

  // Shaft color times strength for this frame; black when shafts should not show.
  function shaftColor(out) {
    out.setRGB(0, 0, 0);
    if (!CONFIG.bloom || player.headInWater || player.headInLava) return out;
    const elev = sky.sunDir.y, dusk = Math.max(0, 1 - Math.abs(elev) / 0.3);
    let amt;
    if (elev > -0.04) {
      lightDir.copy(sky.sunDir);
      amt = THREE.MathUtils.smoothstep(elev, -0.04, 0.06) * (0.16 + 0.3 * dusk);
      out.copy(DAY_TINT).lerp(DUSK_TINT, dusk * 0.8);
    } else {
      lightDir.copy(sky.sunDir).negate();
      amt = 0.14 * THREE.MathUtils.smoothstep(-elev, 0.04, 0.15);
      out.copy(MOON_TINT);
    }
    const facing = camera.getWorldDirection(camDir).dot(lightDir);
    amt *= THREE.MathUtils.smoothstep(facing, 0.15, 0.6) * (1 - weather.k);
    if (amt < 0.003) return out.setRGB(0, 0, 0);
    tmp.copy(lightDir).multiplyScalar(700).add(camera.position).project(camera);
    lightUv.value.set(tmp.x * 0.5 + 0.5, tmp.y * 0.5 + 0.5);
    return out.multiplyScalar(amt);
  }

  function render() {
    setGlowGain(CONFIG.bloom && hdr ? 2 : 1);
    terrainUniforms.uGlow.value = glowGain;
    if (!CONFIG.bloom) {
      renderer.setRenderTarget(null);
      renderer.clear();
      renderer.render(scene, camera);
      return;
    }
    renderer.setRenderTarget(sceneRT);
    renderer.clear();
    renderer.render(scene, camera);

    // bloom chain
    bright.uniforms.tSrc.value = sceneRT.texture;
    bright.uniforms.uTexel.value.set(1 / sceneRT.width, 1 / sceneRT.height);
    bright.uniforms.uThresh.value = hdr ? 1.0 : 0.88;
    pass(bright, mips[0]);
    for (let i = 1; i < LEVELS; i++) {
      down.uniforms.tSrc.value = mips[i - 1].texture;
      down.uniforms.uTexel.value.set(1 / mips[i - 1].width, 1 / mips[i - 1].height);
      pass(down, mips[i]);
    }
    for (let i = LEVELS - 1; i > 0; i--) {
      up.uniforms.tSrc.value = mips[i].texture;
      up.uniforms.uTexel.value.set(1 / mips[i].width, 1 / mips[i].height);
      pass(up, mips[i - 1]);
    }
    composite.uniforms.uBloom.value = hdr ? 0.14 : 0.1;

    // light shafts
    const sc = shaftColor(composite.uniforms.uShaft.value);
    if (sc.r + sc.g + sc.b > 0) {
      pass(mask, shaftB);
      radial.uniforms.tSrc.value = shaftB.texture; radial.uniforms.uLen.value = 1; radial.uniforms.uDecay.value = 0.97;
      pass(radial, shaftA);
      radial.uniforms.tSrc.value = shaftA.texture; radial.uniforms.uLen.value = 0.25; radial.uniforms.uDecay.value = 1;
      pass(radial, shaftB);
      composite.uniforms.tShaft.value = shaftB.texture;
    }
    pass(composite, null);
  }
  return { render, resize, hdr };
})();

export { post };
