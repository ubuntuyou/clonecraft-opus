/* =====================================================================================
 * === 9. PLAYER CONTROLS AND HEALTH
 * -------------------------------------------------------------------------------------
 * The renderer, scene, camera, and world live here because the player owns the view.
 * Game states: 'loading' -> 'menu' -> 'playing' <-> 'paused' | 'inventory' | 'homes' | 'dead'.
 * K toggles flight (setFlying). Flight stays on when the player touches the ground.
 * Only 'playing' holds pointer lock. The simulation runs in 'playing', 'inventory', 'homes',
 * and 'dead'; it freezes in 'paused' and before the first start.
 * ===================================================================================== */
import { THREE } from './three.js';
import { CONFIG, PLAYER_H, PLAYER_W, SEA } from './config.js';
import { World } from './world.js';

const canvas = document.getElementById('view');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance' });
renderer.outputColorSpace = THREE.LinearSRGBColorSpace;
// Drawing-buffer pixels per CSS pixel: the device ratio (capped at 1.5) times the render scale setting.
// The canvas CSS fills the window, so the browser stretches a smaller buffer to fit.
const viewPixelRatio = () => Math.min(devicePixelRatio || 1, 1.5) * CONFIG.renderScale;
renderer.setPixelRatio(viewPixelRatio());
renderer.setSize(innerWidth, innerHeight, false);
renderer.autoClear = false;
renderer.info.autoReset = false;   // the main loop resets it once per frame (two render passes)
const scene = new THREE.Scene();
scene.fog = new THREE.Fog(0x9cc4ff, 80, 120);
const camera = new THREE.PerspectiveCamera(CONFIG.fov, innerWidth / innerHeight, 0.05, 1400);
camera.rotation.order = 'YXZ';
const world = new World(scene);

const game = {
  state: 'loading', started: false, debug: false,
  dayTime: 0.02,          // 0 = sunrise, 0.25 = noon, 0.5 = sunset, 0.75 = midnight
  daylight: 1,            // sky light multiplier, 4.5/15 at night .. 1 at day, dimmed by the weather
  clearDaylight: 1,       // daylight before the weather dims it (mobs burn by this)
  clock: 0,               // simulated seconds
  simulating() { return this.state === 'playing' || this.state === 'inventory' || this.state === 'dead' || this.state === 'homes'; },
};

const player = {
  pos: new THREE.Vector3(0.5, SEA + 32, 0.5), vel: new THREE.Vector3(), w: PLAYER_W, h: PLAYER_H,
  yaw: 0, pitch: 0, onGround: false, hitWall: false, inWater: false, headInWater: false,
  health: 20, maxHealth: 20, dead: false, invuln: 0, lastHurt: -99, regenT: 0, regenLeft: 0, fallPeak: null,
  passLeaves: true, climbing: false, sinking: false,   // leaves: see solidBoxes and updatePlayer
  trapNear: false, trapScanT: 0,                       // temple trap warning: see updatePlayer
  sprinting: false, flying: false, spawn: new THREE.Vector3(0.5, SEA + 32, 0.5),
  walkPhase: 0, bob: 0, hurtTilt: 0, cactusT: 0, jumpCD: 0, fovMul: 1, stepH: 0.6, stepRise: 0,
  inLava: false, headInLava: false, lavaT: 0, vehicle: null,   // vehicle: the boat or cart the player rides
  mouseDX: 0, mouseDY: 0,   // look deltas this frame (view model sway)
};
const input = { keys: new Set(), mouseL: false, mouseR: false, lastWTap: 0, wSprint: false, rightRepeat: 0 };

export { camera, canvas, game, input, player, renderer, scene, viewPixelRatio, world };
