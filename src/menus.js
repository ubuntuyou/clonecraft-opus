// ---- menus and settings -------------------------------------------------------------
import { CONFIG, saveSettings, SEED } from './config.js';
import { game, input } from './engine.js';
import { requestLock, respawn, resumeEl, setEscLock, setPausedAt } from './player.js';
import { resetMining } from './interact.js';
import { invEl } from './inventory-ui.js';
import { audio } from './audio.js';
import { $, hud, SPLASHES } from './hud.js';
import { persist, homesEl } from './order.js';

const overlayEl = $('overlay'), deathEl = $('death'), travelEl = $('travel'), playBtn = $('playBtn');
$('splash').textContent = SPLASHES[Math.floor(Math.random() * SPLASHES.length)];
$('seedText').textContent = `Seed ${SEED} · the world saves itself · ?seed=${SEED} reopens it`;

function setState(s) {
  game.state = s;
  overlayEl.classList.toggle('show', s === 'loading' || s === 'menu' || s === 'paused');
  invEl.classList.toggle('show', s === 'inventory');
  homesEl.classList.toggle('show', s === 'homes');
  deathEl.classList.toggle('show', s === 'dead');
  travelEl.classList.toggle('show', s === 'travel');
  $('crosshair').style.display = s === 'playing' ? 'block' : 'none';
  if (s !== 'playing') { resumeEl.style.display = 'none'; setEscLock(false); }
  $('hud').style.display = game.started ? 'block' : 'none';
  if (s === 'paused') { playBtn.textContent = 'Resume'; playBtn.disabled = false; }
  if (s === 'menu' || s === 'paused') syncTimeSetting();
  if (s !== 'playing') { input.keys.clear(); input.mouseL = input.mouseR = false; resetMining(); }
}
function showPause() {
  if (!game.started || game.state === 'dead' || game.state === 'inventory' || game.state === 'homes' || game.state === 'travel') return;
  setState('paused');
  setPausedAt(performance.now());
  persist.save();
}
// Fades the view in from black (first start and respawn).
function fadeIn() {
  const el = $('fade');
  el.style.transition = 'none'; el.style.opacity = 1;
  void el.offsetWidth;
  el.style.transition = 'opacity .7s ease-out'; el.style.opacity = 0;
}
function startOrResume() {
  if (playBtn.disabled) return;
  audio.init();
  if (!game.started) fadeIn();
  game.started = true;
  if (game.state === 'menu') { setState('paused'); hud.dirtyHotbar = hud.dirtyHearts = true; hud.showItemName(); }
  requestLock();
}
playBtn.addEventListener('click', (e) => { e.stopPropagation(); startOrResume(); });
overlayEl.addEventListener('click', (e) => { if (e.target === overlayEl) startOrResume(); });
$('respawnBtn').addEventListener('click', () => { audio.init(); respawn(); });

function bindSetting(id, valId, key, fmt, apply) {
  const el = $(id), val = $(valId);
  el.value = CONFIG[key]; val.textContent = fmt(CONFIG[key]);
  el.addEventListener('input', () => {
    CONFIG[key] = +el.value; val.textContent = fmt(CONFIG[key]);
    if (apply) apply(CONFIG[key]);
    saveSettings();
  });
}
bindSetting('setRd', 'valRd', 'renderDistance', (v) => `${v} chunks`);
bindSetting('setFov', 'valFov', 'fov', (v) => `${v}°`);
bindSetting('setSens', 'valSens', 'sensitivity', (v) => `${(+v).toFixed(2)}×`);
bindSetting('setVol', 'valVol', 'volume', (v) => `${Math.round(v * 100)}%`, (v) => audio.setVolume(v));
// The window resize handler (main.js) applies the new pixel ratio and resizes the post-processing targets.
bindSetting('setScale', 'valScale', 'renderScale', (v) => `${Math.round(v * 100)}%`, () => dispatchEvent(new Event('resize')));
for (const [id, key] of [['setShadows', 'shadows'], ['setBloom', 'bloom']]) {
  const el = $(id);
  el.checked = CONFIG[key];
  el.addEventListener('change', () => { CONFIG[key] = el.checked; saveSettings(); });
}

// Time of day: the slider shows the clock in hours (0-24). dayTime 0 is sunrise at 06:00.
// The world save holds dayTime, so a new time saves with the world. Freeze time is a setting for all worlds.
function clockText(dayTime) {
  const mins = Math.floor(((dayTime + 0.25) % 1) * 24 * 60);
  return `${String(Math.floor(mins / 60)).padStart(2, '0')}:${String(mins % 60).padStart(2, '0')}`;
}
const timeEl = $('setTime'), timeVal = $('valTime'), freezeEl = $('setFreeze'), freezeVal = $('valFreeze');
function syncTimeSetting() {
  timeEl.value = ((game.dayTime + 0.25) % 1) * 24;
  timeVal.textContent = clockText(game.dayTime);
}
timeEl.addEventListener('input', () => {
  game.dayTime = (+timeEl.value / 24 + 0.75) % 1;
  timeVal.textContent = clockText(game.dayTime);
});
freezeEl.checked = CONFIG.freezeTime; freezeVal.textContent = CONFIG.freezeTime ? 'On' : 'Off';
freezeEl.addEventListener('change', () => {
  CONFIG.freezeTime = freezeEl.checked; freezeVal.textContent = CONFIG.freezeTime ? 'On' : 'Off';
  saveSettings();
});

export { clockText, fadeIn, playBtn, setState, showPause };
