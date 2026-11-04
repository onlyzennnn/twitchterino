// Lista de canais, aplicação do estado e eventos. Carregado por último.
// ---------- Lista de canais: um nó por canal, reaproveitado entre as atualizações ----------
const rows = new Map();
const GROUPS = { watching: $('#g-watching'), queue: $('#g-queue'), offline: $('#g-offline') };

function makeRow(slug) {
  const r = { el: el('div', 'row') };
  r.el.dataset.slug = slug;
  const wrap = el('span', 'avatar-wrap');
  r.pulse = el('span', 'pulse');
  r.avatar = el('span', 'avatar');
  wrap.append(r.pulse, r.avatar);
  const body = el('div', 'r-body');
  const top = el('div', 'r-top');
  r.name = el('span', 'r-name');
  r.sub = el('span', 'r-sub', 'SUB'); r.sub.title = 'Você é sub: pontos extras neste canal'; r.sub.hidden = true;
  r.fav = el('span', 'r-fav', '★'); r.fav.title = 'Favorito'; r.fav.hidden = true;
  r.pts = el('span', 'r-pts');
  top.append(r.name, r.sub, r.fav, r.pts);
  r.info = el('div', 'r-info');
  r.label = el('span');
  r.eta = el('span', 'r-eta');
  r.info.append(r.label, r.eta);
  r.track = el('div', 'bar b3');
  r.fill = el('i');
  r.track.append(r.fill);
  body.append(top, r.info, r.track);
  r.el.append(wrap, body);
  r.el.onclick = () => select(slug);
  return r;
}

// Um pulso só, quando a live ganha pontos: em loop infinito ele custava ~20% de GPU com a janela aberta.
function pulseOnce(r) {
  if (!reduceMotion.matches) anim(r.pulse, [{ transform: 'scale(1)', opacity: 0.6 }, { transform: 'scale(1.7)', opacity: 0 }], { duration: 2000, easing: EO });
}

function etaOf(c) {
  if (c.goal == null) return '';
  if (!c.watching || c.earning === 'idle') return `meta ${fmt(c.goal)}`;
  const min = Math.ceil(c.goalLeft / (PTS_PER_MIN * (c.subscribed ? 1.2 : 1)));
  return `${clock(min * 60000)} até ${fmt(c.goal)}`;
}

function updateRow(r, c, favs) {
  const key = statusOf(c);
  const st = ST[key];
  const off = key === 'offline';
  r.el.classList.toggle('offline', off);
  r.el.classList.toggle('sel', c.slug === active);
  paintAvatar(r.avatar, c.displayName, c.avatar);
  r.avatar.classList.toggle('off', off);
  setStyle(r.avatar, 'boxShadow', st.ring ? `0 0 0 2px #111318, 0 0 0 3.5px ${st.ring}` : 'none');
  setText(r.name, c.displayName);
  r.sub.hidden = !c.subscribed;
  r.fav.hidden = !favs.has(c.slug);
  setText(r.pts, fmt(c.points));
  const rose = r.lastPts != null && c.points > r.lastPts;
  if (rose) anim(r.pts, [{ color: '#ffffff', transform: 'translateY(-2px)' }, { color: '#c9ccd6', transform: 'none' }], { duration: 600, easing: EO });
  if (key === 'earning' && (rose || r.lastKey !== 'earning')) pulseOnce(r);
  r.lastPts = c.points;
  r.lastKey = key;
  r.info.hidden = off;
  r.track.hidden = off;
  if (off) return;
  setText(r.label, st.label + (c.gained ? `  +${fmt(c.gained)}` : ''));
  setStyle(r.label, 'color', st.color);
  setText(r.eta, etaOf(c));
  setStyle(r.fill, 'background', st.bar);
  setStyle(r.fill, 'transform', `scaleX(${c.goal ? Math.min(1, (c.points || 0) / c.goal).toFixed(3) : 0})`);
}

let listSignature = '';
function renderList() {
  const favs = new Set(state.favorites || []);
  const groups = { watching: [], queue: [], offline: [] };
  for (const c of state.channels) groups[c.watching ? 'watching' : c.live ? 'queue' : 'offline'].push(c);
  groups.queue.sort((a, b) => favs.has(b.slug) - favs.has(a.slug));

  for (const [slug, r] of rows) {
    if (state.channels.some((c) => c.slug === slug)) continue;
    r.el.remove();
    rows.delete(slug);
  }
  for (const c of state.channels) if (!rows.has(c.slug)) rows.set(c.slug, makeRow(c.slug));

  // Medir e mover só quando a ordem muda: ler offsetTop a cada atualização forçaria layout à toa.
  const signature = Object.values(groups).map((g) => g.map((c) => c.slug).join()).join('|');
  if (signature !== listSignature) {
    const first = listSignature && !reduceMotion.matches ? new Map([...rows].map(([slug, r]) => [slug, r.el.isConnected ? r.el.offsetTop : null])) : null;
    listSignature = signature;
    for (const [name, list] of Object.entries(groups)) {
      const box = GROUPS[name];
      box.hidden = !list.length;
      setText(box.querySelector('.count'), list.length);
      const holder = box.querySelector('.group-rows');
      list.forEach((c, i) => { const node = rows.get(c.slug).el; if (holder.children[i] !== node) holder.insertBefore(node, holder.children[i] || null); });
    }
    if (first) for (const [slug, r] of rows) {
      const was = first.get(slug);
      if (was == null) continue;
      const dy = was - r.el.offsetTop;
      if (Math.abs(dy) > 1) anim(r.el, [{ transform: `translateY(${dy}px)` }, { transform: 'none' }], { duration: 420, easing: EIO });
    }
  }
  for (const c of state.channels) updateRow(rows.get(c.slug), c, favs);
}

function renderAll() {
  dirty = false;
  if (active && !state.channels.some((c) => c.slug === active)) active = null;
  const first = !active && state.channels.length;
  if (first) active = state.channels[0].slug;
  renderHeader();
  renderList();
  renderSelected();
  if (first) renderMessages();
  renderFarm();
  if (state.intro && !window.introShown) { window.introShown = true; showIntro(state.intro); }
  if (window.modalKind === 'sleep') renderSleep();
}

// Eventos que nascem da diferença entre dois estados: mensagens de sistema sempre; avisos só à vista.
const warnedEnds = new Set();
function diffEvents(prev, next) {
  if (!prev.channels.length) return;
  const before = new Map(prev.channels.map((c) => [c.slug, c]));
  for (const c of next.channels) {
    const was = before.get(c.slug);
    if (!was) continue;
    if (!was.live && c.live) {
      pushFeed(c.slug, systemItem(`${c.displayName} entrou ao vivo.`));
      toast({ kind: 'live', title: `${c.displayName} entrou ao vivo`, text: c.streakVisit ? 'Ganhou uma vaga por até 10 min para a sequência de lives.' : undefined });
    }
    if (was.live && !c.live) pushFeed(c.slug, systemItem(`${c.displayName} está offline.`));
    if (!was.watching && c.watching && !(feeds.get(c.slug) || []).length) pushFeed(c.slug, systemItem('Ganhou uma vaga. O chat começa agora.'));
    if (was.points == null || c.points == null || c.points <= was.points) continue;
    const gain = c.points - was.points;
    if (c.watching && gain >= 50 && gain < 300) {
      pushFeed(c.slug, systemItem('Baú de +50 coletado sozinho.'));
      if (c.slug === active && !document.hidden) floatChest();
    }
    const reached = [300, 500, 1000].filter((g) => was.points < g && c.points >= g).pop()
      || (Math.floor(c.points / 1000) > Math.floor(was.points / 1000) ? Math.floor(c.points / 1000) * 1000 : 0);
    if (!reached) continue;
    if (next.notifyBonus) toast({ kind: 'gold', title: `${c.displayName} chegou a ${fmt(reached)} pontos`, text: `Já dá para resgatar +15% ${GOAL_NAMES[reached] || 'bônus'}.`, action: 'Abrir loja', onAction: () => window.kick.openStore(c.slug) });
    if (reached >= 1000) confetti(); // comemoração rara
  }
  const lastBefore = (prev.purchases || [])[0];
  for (const p of next.purchases || []) {
    if (lastBefore && p.t <= lastBefore.t) break;
    const ch = next.channels.find((c) => c.slug === p.slug);
    toast({ title: `+1h de ${BONUS_NAMES[p.cost] || 'bônus'}`, text: ch ? `Comprado em ${ch.displayName}.` : 'Registrado à mão.' });
  }
  for (const b of next.bonuses || []) {
    if (!b.endsAt || b.endsAt - Date.now() > 300000 || warnedEnds.has(b.endsAt)) continue;
    warnedEnds.add(b.endsAt);
    toast({ title: `${shortName(b.name)} acaba em ${clock(b.endsAt - Date.now())}`, text: 'Abra a loja de um canal com pontos para renovar.', action: 'Ok' });
  }
}

function applyState(s) {
  const prev = state;
  state = s;
  diffEvents(prev, s);
  if (document.hidden) { dirty = true; return; }
  renderAll();
}

// Janela escondida: nada de animação nem de relógio. Ao voltar, redesenha uma vez com o estado atual.
let bonusTimer = null;
function onVisibility() {
  if (document.hidden) {
    clearInterval(bonusTimer);
    bonusTimer = null;
    return;
  }
  bonusTimer = setInterval(renderBonuses, 30000);
  if (dirty) renderAll();
  renderMessages();
}
document.addEventListener('visibilitychange', onVisibility);
if (!document.hidden) bonusTimer = setInterval(renderBonuses, 30000);

// ---------- Eventos ----------
const applyAfter = (promise) => promise.then(applyState);
$('#btn-farm').onclick = () => applyAfter(window.kick.setFarming(!state.farming));
$('#btn-refresh').onclick = () => applyAfter(window.kick.refresh());
$('#btn-account').onclick = (e) => {
  if (!state.loggedIn) { window.kick.showLogin(); return; }
  e.stopPropagation();
  $('#account-menu').hidden = !$('#account-menu').hidden;
};
document.addEventListener('click', () => { $('#account-menu').hidden = true; });
$('#btn-logout').onclick = () => applyAfter(window.kick.logout());
$('#btn-quit').onclick = () => window.kick.quit();
$('#btn-report').onclick = () => showReport();
$('#btn-sleep').onclick = () => openSleep();
$('#btn-limit').onclick = () => applyAfter(state.limitTest ? window.kick.stopLimitTest() : window.kick.startLimitTest());
$('#w-dec').onclick = () => applyAfter(window.kick.setMaxWatchers(state.maxWatchers - 1));
$('#w-inc').onclick = () => applyAfter(window.kick.setMaxWatchers(state.maxWatchers + 1));
$('#t-lowQuality').onclick = () => applyAfter(window.kick.setLowQuality(!state.lowQuality));
$('#t-rotation').onclick = () => applyAfter(window.kick.setRotation(!state.rotation));
$('#t-notifyBonus').onclick = () => applyAfter(window.kick.setNotifyBonus(!state.notifyBonus));
$('#t-notifyChat').onclick = () => applyAfter(window.kick.setNotifyChat(!state.notifyChat));
$('#t-sleepMode').onclick = () => applyAfter(window.kick.setSleepMode(!state.sleepMode));
$('#t-autostart').onclick = () => applyAfter(window.kick.setAutostart(!state.openAtLogin));
document.querySelectorAll('#target button').forEach((b) => { b.onclick = () => applyAfter(window.kick.setBonusTarget(Number(b.dataset.v))); });
$('#btn-fav').onclick = () => active && applyAfter(window.kick.toggleFavorite(active));
$('#btn-show').onclick = () => active && window.kick.showChannel(active);
$('#btn-points').onclick = () => active && window.kick.openStore(active);
$('#btn-remove').onclick = async () => {
  if (!active) return;
  const slug = active;
  feeds.delete(slug);
  active = null;
  applyState(await window.kick.removeChannel(slug));
  renderMessages();
};
$('#btn-add').onclick = () => {
  const slot = $('#add-slot');
  const button = slot.firstElementChild;
  const input = el('input');
  input.placeholder = 'nome do canal';
  slot.replaceChildren(input);
  input.focus();
  const done = async (commit) => {
    if (!input.isConnected) return;
    const value = input.value.trim();
    slot.replaceChildren(button);
    if (!commit || !value) return;
    const s = await window.kick.addChannel(value);
    applyState(s);
    const added = s.channels[s.channels.length - 1];
    if (added) select(added.slug);
  };
  input.onkeydown = (e) => { if (e.key === 'Enter') done(true); if (e.key === 'Escape') done(false); };
  input.onblur = () => done(false);
};
$('#composer').onsubmit = async (e) => {
  e.preventDefault();
  const input = $('#input');
  const ch = state.channels.find((c) => c.slug === active);
  const text = input.value.trim();
  if (!ch || !ch.chatroomId || !text) return;
  input.value = '';
  const res = await window.kick.sendChat(ch.chatroomId, text);
  if (!res.ok) pushFeed(ch.slug, systemItem(`Falha ao enviar${res.message ? `: ${res.message}` : ''}. Você fez login?`));
};

window.kick.onStatus(applyState);
window.kick.onSelect((slug) => select(slug, true));
window.kick.onChat(({ slug, kind, data }) => {
  if (kind !== 'message') return;
  const flags = chatFlags(data);
  pushFeed(slug, { data, flags });
  if (flags.mention || flags.giveaway) chatAlert(slug, data, flags);
});
window.kick.getState().then(applyState);
