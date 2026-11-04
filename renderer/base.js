// Twitchterino — interface. O estado chega por applyState; cada parte só escreve no DOM o que mudou,
// e com a janela escondida nada é desenhado: o app passa a maior parte do tempo na bandeja.
const MAX_MESSAGES = 200;
const EO = 'cubic-bezier(.23,1,.32,1)';
const EIO = 'cubic-bezier(.77,0,.175,1)';
const PTS_PER_MIN = 10 / 5 + 50 / 15; // +10 a cada 5 min e baú de +50 a cada 15 min
const GOAL_NAMES = { 300: 'XP', 500: 'Capture Boost', 1000: 'Secret Lure' };
const BONUS_NAMES = { 300: '+15% XP', 500: '+15% Capture Boost', 1000: '+15% Secret Lure' };
const ST = {
  age: { label: '+18', color: '#f5a524', ring: '#f5a524', bar: '#3a4050', bg: 'rgba(245,165,36,.14)' },
  streak: { label: 'Sequência', color: '#ffcf4a', ring: '#ffcf4a', bar: '#ffcf4a', bg: 'rgba(255,207,74,.12)' },
  earning: { label: 'Ganhando', color: '#bf94ff', ring: '#9146ff', bar: '#9146ff', bg: 'rgba(145,70,255,.16)' },
  warming: { label: 'Aquecendo', color: '#bf94ff', ring: '#4a3577', bar: '#9146ff', bg: 'rgba(145,70,255,.16)' },
  idle: { label: 'Sem pontos', color: '#8d93a3', ring: '#6b6b6b', bar: '#3a4050', bg: '#1e2129' },
  queue: { label: 'Na fila', color: '#c9ccd6', ring: '#e53935', bar: '#3a4050', bg: 'rgba(229,57,53,.14)' },
  offline: { label: 'Offline', color: '#8d93a3', ring: null, bar: '#3a4050', bg: '#1e2129' },
};
const statusOf = (c) => (c.ageGate ? 'age' : c.streakVisit ? 'streak' : c.earning === 'earning' ? 'earning'
  : c.earning === 'warming' ? 'warming' : c.earning === 'idle' ? 'idle' : c.live ? 'queue' : 'offline');

const $ = (sel) => document.querySelector(sel);
function el(tag, cls, text) {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text != null) e.textContent = text;
  return e;
}
const setText = (e, v) => { const s = String(v); if (e.textContent !== s) e.textContent = s; };
// Só toca no estilo quando o valor muda: escrever à toa invalida estilo e pinta de novo.
function setStyle(e, prop, v) {
  const memo = e._memo || (e._memo = {});
  if (memo[prop] !== v) { memo[prop] = v; e.style[prop] = v; }
}
const fmt = (n) => (n == null ? '—' : n.toLocaleString('pt-BR'));
const timeStr = (d = new Date()) => d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
const clock = (ms) => { const m = Math.max(0, Math.ceil(ms / 60000)); return m >= 60 ? `${Math.floor(m / 60)}h${String(m % 60).padStart(2, '0')}` : `${m} min`; };
const shortName = (n) => n.replace('+15% ', '');
const hue = (s) => { let h = 0; for (const ch of s) h = (h * 31 + ch.charCodeAt(0)) % 360; return h; };
const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

// Web Animations, só com a janela à vista. Com "reduzir movimento" sobra apenas a opacidade.
function anim(e, keyframes, options) {
  if (!e || document.hidden) return null;
  if (reduceMotion.matches) {
    if (keyframes.every((k) => k.opacity == null)) return null;
    keyframes = keyframes.map((k) => ({ opacity: k.opacity == null ? 1 : k.opacity }));
  }
  return e.animate(keyframes, options);
}

let state = { channels: [], favorites: [], bonuses: [], purchases: [] };
let active = null;
let dirty = false;
const feeds = new Map(); // slug -> mensagens em dados puros; o DOM só existe para o canal aberto

function paintAvatar(box, name, url) {
  const h = hue(name);
  setStyle(box, 'background', `oklch(0.34 0.07 ${h})`);
  setStyle(box, 'color', `oklch(0.92 0.06 ${h})`);
  if (box._key === `${name}|${url}`) return;
  box._key = `${name}|${url}`;
  box.replaceChildren();
  const initial = (name[0] || '?').toUpperCase();
  if (!url) { box.textContent = initial; return; }
  const img = el('img');
  img.alt = ''; img.loading = 'lazy'; img.decoding = 'async'; img.src = url;
  img.onerror = () => { box.textContent = initial; };
  box.append(img);
}
