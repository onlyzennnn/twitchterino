// Avisos, cabeçalho da janela e painel Farm.
// ---------- Avisos ----------
const toasts = new Set();
function dismissToast(t) {
  if (t.leaving) return;
  t.leaving = true;
  clearTimeout(t.timer);
  t.el.classList.add('leaving');
  setTimeout(() => {
    const others = [...toasts].filter((x) => x !== t && !x.leaving);
    const before = reduceMotion.matches ? null : others.map((x) => x.el.offsetTop);
    t.el.remove();
    toasts.delete(t);
    if (before) others.forEach((x, i) => {
      const dy = before[i] - x.el.offsetTop;
      if (Math.abs(dy) > 1) anim(x.el, [{ transform: `translateY(${dy}px)` }, { transform: 'none' }], { duration: 300, easing: EIO });
    });
  }, 210);
}
function toast({ kind = 'info', title, text, action, onAction }) {
  if (document.hidden) return;
  const live = [...toasts].filter((x) => !x.leaving);
  if (live.length >= 3) dismissToast(live[0]);
  const t = { el: el('div', `toast ${kind}`), leaving: false };
  const body = el('div', 't-body');
  body.append(el('b', null, title));
  if (text) body.append(el('span', 't-text', text));
  t.el.append(body);
  if (action) {
    const b = el('button', null, action);
    b.onclick = () => { if (onAction) onAction(); dismissToast(t); };
    t.el.append(b);
  }
  $('#toasts').append(t.el);
  toasts.add(t);
  anim(t.el, [{ transform: 'translateX(-110%)', opacity: 0 }, { transform: 'none', opacity: 1 }], { duration: 340, easing: EO });
  t.timer = setTimeout(() => dismissToast(t), 5200);
}

// ---------- Cabeçalho e painel Farm ----------
function setToggle(id, on) { $(id).classList.toggle('on', !!on); $(id).setAttribute('aria-pressed', String(!!on)); }

const bonusCards = new Map();
function renderBonuses() {
  const now = Date.now();
  for (const b of state.bonuses || []) {
    let card = bonusCards.get(b.cost);
    if (!card) {
      card = { el: el('div', 'bonus') };
      const row = el('div', 'b-row');
      const name = el('div', 'b-name');
      name.append(el('b', null, shortName(b.name)), el('span', null, `${fmt(b.cost)} pts`));
      card.left = el('span', 'b-left');
      const add = el('button', 'b-add', '+1h');
      add.title = `Registrar uma compra de ${b.name} feita fora do app (o app percebe sozinho as compras pelo saldo)`;
      add.onclick = async () => applyState(await window.kick.addPurchase(b.cost));
      row.append(name, card.left, add);
      card.track = el('div', 'bar b2');
      card.fill = el('i');
      card.track.append(card.fill);
      card.el.append(row, card.track);
      bonusCards.set(b.cost, card);
      $('#bonus-box').append(card.el);
    }
    const left = b.endsAt && b.endsAt > now ? b.endsAt - now : 0;
    card.el.classList.toggle('on', !!left);
    setText(card.left, left ? clock(left) : 'inativo');
    card.track.hidden = !left;
    if (left) setStyle(card.fill, 'transform', `scaleX(${Math.min(1, left / 7200000).toFixed(3)})`);
  }
}

let purchasesKey = '';
function renderPurchases() {
  const list = state.purchases || [];
  const key = list.map((p) => p.t).join();
  if (key === purchasesKey) return;
  purchasesKey = key;
  const box = $('#purchases');
  box.hidden = !list.length;
  box.replaceChildren(...list.map((p) => {
    const ch = state.channels.find((c) => c.slug === p.slug);
    const row = el('div', 'purchase');
    row.append(el('span', null, `${shortName(BONUS_NAMES[p.cost] || `${p.cost} pts`)} · ${ch ? ch.displayName : 'registrado à mão'} · ${timeStr(new Date(p.t))}`));
    const x = el('button', null, '✕');
    x.title = 'Não foi uma compra de bônus? Remove do cronômetro e do relatório';
    x.onclick = async () => applyState(await window.kick.removePurchase(p.t));
    row.append(x);
    return row;
  }));
}

function renderLimit() {
  const t = state.limitTest, r = state.limitResult;
  const box = $('#limit-info');
  const btn = $('#btn-limit');
  setText(btn, t ? 'Cancelar teste' : 'Testar limite');
  btn.disabled = !t && !state.loggedIn;
  const lines = (list) => list.map((x) => el('div', null, `${x.lives} lives: ${x.counting} ganharam pontos (+${x.pts} em ${x.minutes} min)`));
  const key = JSON.stringify([t, r]);
  if (box._key === key) return;
  box._key = key;
  if (t) box.replaceChildren(el('div', 'now', `Etapa ${t.step}/${t.steps}: ${t.lives} lives, ${t.warming ? 'aquecendo' : 'medindo'}, ${t.leftMin} min`), ...lines(t.results));
  else if (r) box.replaceChildren(el('div', 'now', `Último teste (${new Date(r.at).toLocaleDateString('pt-BR')}): usando ${r.chosen} lives`), ...lines(r.results));
  box.hidden = !t && !r;
}

function renderHeader() {
  const list = state.channels;
  setToggle('#btn-farm', state.farming);
  setText($('#farm-label'), state.farming ? 'Farm ligado' : 'Farm pausado');
  setText($('#st-live'), list.filter((c) => c.live).length);
  setText($('#st-watching'), list.filter((c) => c.watching).length);
  setText($('#st-queued'), list.filter((c) => c.live && !c.watching).length);
  setText($('#st-total'), fmt(list.reduce((t, c) => t + (c.points || 0), 0)));
  const gained = list.reduce((t, c) => t + (c.gained || 0), 0);
  setText($('#st-gained'), gained ? `+${fmt(gained)} nesta sessão` : '');
  setText($('#st-memory'), state.memoryMB ? `${fmt(state.memoryMB)} MB` : '');
  const btn = $('#btn-account');
  btn.classList.toggle('signed', !!state.loggedIn);
  btn.title = state.loggedIn ? 'Conectado. Clique para sair da conta' : 'Abre a Twitch para você fazer login (uma vez só)';
  setText($('#account-name'), state.loggedIn ? (state.username || 'Conectado') : 'Login Twitch');
  const av = $('#account-avatar');
  av.hidden = !state.loggedIn;
  if (state.loggedIn) paintAvatar(av, state.username || '?', state.userAvatar);
}

function renderFarm() {
  setText($('#w-val'), state.maxWatchers);
  setToggle('#t-lowQuality', state.lowQuality);
  setToggle('#t-rotation', state.rotation);
  setToggle('#t-notifyBonus', state.notifyBonus);
  setToggle('#t-notifyChat', state.notifyChat);
  setToggle('#t-sleepMode', state.sleepMode);
  setToggle('#t-autostart', state.openAtLogin);
  $('#target-wrap').classList.toggle('off', !state.rotation);
  const values = [0, 300, 500, 1000];
  const i = Math.max(0, values.indexOf(state.bonusTarget || 0));
  setStyle($('#target .seg-ind'), 'transform', `translateX(${i * 100}%)`);
  document.querySelectorAll('#target button').forEach((b, n) => b.classList.toggle('sel', n === i));
  if (state.platform === 'linux') {
    setText($('#autostart-label'), 'Iniciar com o sistema');
    $('#t-autostart').title = 'Abre sozinho, direto na bandeja, quando você entra no computador';
    $('#btn-quit').hidden = false;
  }
  $('#btn-sleep').hidden = !state.sleepMode;
  const rich = state.channels.filter((c) => (c.points || 0) >= (state.bonusTarget || 300)).length;
  setText($('#sleep-count'), `${rich} ${rich === 1 ? 'loja' : 'lojas'}`);
  renderBonuses();
  renderPurchases();
  renderLimit();
}
