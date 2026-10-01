// ---- homes: named places to teleport to (H) ---------------------------------------------
import { game, player } from './engine.js';
import { resumeGame } from './player.js';
import { resetMining } from './interact.js';
import { vehicles } from './vehicles.js';
import { audio } from './audio.js';
import { $, hud } from './hud.js';
import { fadeIn, setState } from './menus.js';
import { persist } from './persist.js';

const MAX_HOMES = 10;
let homes = [];   // [{ name, x, y, z, yaw }]
const homesEl = $('homes'), homesListEl = $('homesList'), homeNameEl = $('homeName');
function openHomes() {
  if (game.state !== 'playing' || player.dead) return;
  setState('homes');
  if (document.pointerLockElement) document.exitPointerLock();
  homeNameEl.value = '';
  renderHomes();
  audio.click();
}
function closeHomes(viaEsc) {
  if (game.state !== 'homes') return;
  homeNameEl.blur();
  resumeGame(viaEsc);
}
function homesKey(e) {
  const typing = document.activeElement === homeNameEl;
  if (e.code === 'Escape' || (e.code === 'KeyH' && !typing)) { e.preventDefault(); if (!e.repeat) closeHomes(e.code === 'Escape'); return; }
  if (e.code === 'Enter' && typing) setHome();
}
function setHome(name) {
  name = (name ?? homeNameEl.value).trim() || `Home ${homes.length + 1}`;
  let h = homes.find((o) => o.name === name);
  if (!h && homes.length >= MAX_HOMES) { hud.toast(`${MAX_HOMES} homes at most. Delete one first.`); return false; }
  if (!h) { h = { name }; homes.push(h); }
  const p = player.pos;
  Object.assign(h, { x: +p.x.toFixed(2), y: +p.y.toFixed(2), z: +p.z.toFixed(2), yaw: +player.yaw.toFixed(3) });
  homeNameEl.value = '';
  renderHomes(); persist.save(); audio.click();
  return true;
}
function goHome(h) {
  const p = player;
  if (p.vehicle) vehicles.dismount();
  p.pos.set(h.x, h.y, h.z); p.vel.set(0, 0, 0); p.yaw = h.yaw; p.pitch = 0;
  p.fallPeak = null; p.invuln = Math.max(p.invuln, 1);
  resetMining();
  fadeIn();
  closeHomes();
  hud.toast(`Welcome to ${h.name}`);
}
function renderHomes() {
  homesListEl.innerHTML = '';
  if (!homes.length) { homesListEl.innerHTML = '<div class="hint" style="text-align:center">No homes yet.</div>'; return; }
  for (const h of homes) {
    const row = document.createElement('div'); row.className = 'home';
    const name = document.createElement('span'); name.className = 'hname'; name.textContent = h.name;
    const pos = document.createElement('span'); pos.className = 'hpos'; pos.textContent = `${Math.floor(h.x)}, ${Math.floor(h.y)}, ${Math.floor(h.z)}`;
    const go = document.createElement('button'); go.className = 'btn'; go.textContent = 'Go';
    go.addEventListener('click', () => goHome(h));
    const del = document.createElement('button'); del.className = 'btn'; del.textContent = 'Delete';
    del.addEventListener('click', () => {   // the first click arms Delete; a second click within 3 s deletes (R8)
      audio.click();
      if (!del.classList.contains('armed')) {
        del.classList.add('armed'); del.textContent = 'Confirm';
        setTimeout(() => { del.classList.remove('armed'); del.textContent = 'Delete'; }, 3000);
        return;
      }
      homes.splice(homes.indexOf(h), 1); renderHomes(); persist.save();
    });
    row.append(name, pos, go, del);
    homesListEl.appendChild(row);
  }
}
$('homeSetBtn').addEventListener('click', () => setHome());

function setHomes(v) { homes = v; }

export { closeHomes, goHome, homes, homesEl, homesKey, openHomes, setHome, setHomes };
