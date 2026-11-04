// Janelas flutuantes: relatório da semana, antes de dormir e boas-vindas. Só existem enquanto abertas.
window.modalKind = null;
window.introShown = false;
const POP = [{ opacity: 0, transform: 'translateY(8px) scale(.97)' }, { opacity: 1, transform: 'none' }];

function openModal(kind, cls, ...nodes) {
  const card = $('#modal-card');
  window.modalKind = kind;
  card.className = cls || '';
  card.replaceChildren(...nodes);
  const wasHidden = $('#modal').hidden;
  $('#modal').hidden = false;
  if (wasHidden) anim(card, POP, { duration: 320, easing: EO });
}
function closeModal() {
  if (window.modalKind === 'intro') window.kick.introDone().then(applyState);
  window.modalKind = null;
  $('#modal').hidden = true;
  $('#modal-card').replaceChildren(); // sem nós guardados enquanto o modal está fechado
}
$('#modal').onclick = (e) => { if (e.target.id === 'modal') closeModal(); };
document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !$('#modal').hidden) closeModal(); });
const btn = (text, cls, onclick) => { const b = el('button', cls, text); b.type = 'button'; b.onclick = onclick; return b; };
const stagger = (nodes, kf, duration, delay, gap) => nodes.forEach((n, i) => anim(n, kf, { duration, delay: delay + i * gap, easing: EO, fill: 'backwards' }));

// ---------- Relatório da semana ----------
async function showReport() {
  const r = await window.kick.getReport();
  const short = (k) => { const [, m, d] = k.split('-'); return `${d}/${m}`; };
  const head = el('div', 'r-head');
  head.append($('#header .brand').cloneNode(true), el('b', null, 'Minha semana'));
  if (r.days.length) head.append(el('span', 'r-date', `${short(r.days[0].day)} a ${short(r.days[r.days.length - 1].day)}/${r.days[0].day.slice(0, 4)}`));

  const bought = r.bought.reduce((t, b) => t + b.count, 0);
  const stats = el('div', 'r-stats');
  for (const [value, label, color] of [[fmt(r.gained), 'pontos ganhos', '#bf94ff'], [String(bought), 'bônus comprados', '#ffcf4a'], [`${r.bonusHours} h`, 'com bônus ativo'], [`${r.coverage}%`, 'do tempo com bônus']]) {
    const s = el('div', 'r-stat');
    const b = el('b', null, value);
    if (color) b.style.color = color;
    s.append(b, el('span', null, label));
    stats.append(s);
  }

  const max = Math.max(1, ...r.days.map((d) => d.gained));
  const days = el('div', 'r-days');
  const bars = [];
  r.days.forEach((d, i) => {
    const col = el('div', 'r-day' + (i === r.days.length - 1 ? ' today' : ''));
    col.title = `${d.day}: ${d.gained} pts · ${d.bought.map((n, j) => `${n}× ${shortName(Object.values(BONUS_NAMES)[j])}`).join(', ')}`;
    const bar = el('i');
    bar.style.height = `${Math.round((d.gained / max) * 100)}%`;
    bars.push(bar);
    const slot = el('div', 'r-slot');
    slot.append(bar);
    col.append(el('small', null, d.gained ? fmt(d.gained) : ''), slot, el('span', null, d.weekday.replace('.', '')));
    days.append(col);
  });
  const sec = el('div', 'r-sec');
  sec.append(el('span', 'area-title', 'Pontos por dia'), days);

  const periods = el('div', 'r-col');
  periods.append(el('span', 'area-title', 'Bônus ativo por período'));
  const fills = [];
  for (const p of r.periods) {
    const row = el('div', 'r-period');
    const track = el('div', 'r-track');
    const fill = el('i');
    fill.style.width = `${p.pct}%`;
    fills.push(fill);
    track.append(fill);
    row.append(el('span', null, p.name), track, el('b', null, `${p.pct}%`));
    periods.append(row);
  }

  const line = el('div', 'r-line');
  line.title = 'Últimas 24 horas: roxo = algum bônus ativo';
  const cells = r.timeline.map((on) => { const c = el('i', on ? 'on' : ''); line.append(c); return c; });
  const ends = el('div', 'r-ends');
  ends.append(el('span', null, r.timelineStart ? `ontem ${new Date(r.timelineStart).getHours()}h` : ''), el('span', null, 'agora'));
  const col24 = el('div', 'r-col');
  col24.append(el('span', 'area-title', 'Últimas 24 h'), line, ends,
    el('span', 'r-bought', r.bought.map((b) => `${b.count}× ${shortName(b.name)}`).join(', ') + (r.channels ? ` em ${r.channels} canais` : '')));
  const cols = el('div', 'r-cols');
  cols.append(periods, col24);

  const actions = el('div', 'm-actions');
  actions.append(btn('Fechar', 'plain', closeModal), btn('Salvar imagem', 'primary', async () => {
    const card = $('#modal-card');
    const rect = card.getBoundingClientRect();
    const file = await window.kick.saveReport({ x: rect.x, y: rect.y, width: rect.width, height: rect.height });
    if (file) actions.replaceChildren(el('span', 'saved', `Imagem salva em ${file}`), btn('Fechar', 'plain', closeModal));
  }));
  openModal('report', 'report', head, stats, sec, cols, actions);
  stagger(bars, [{ transform: 'scaleY(0)' }, { transform: 'scaleY(1)' }], 560, 160, 45);
  stagger(fills, [{ transform: 'scaleX(0)' }, { transform: 'scaleX(1)' }], 560, 300, 60);
  stagger(cells, [{ opacity: 0 }, { opacity: 1 }], 200, 360, 8);
}

// ---------- Antes de dormir ----------
const sleepPicked = new Set();
let sleepCost = 300;
function openSleep() {
  sleepCost = state.bonusTarget || 300;
  window.modalKind = 'sleep';
  renderSleep(true);
}
function renderSleep(animateIn) {
  const seq = state.storeSequence;
  const head = el('div', 'm-head');
  head.append(el('b', 'm-title', 'Antes de dormir'));
  if (seq) {
    head.append(el('p', 'm-text', `Loja ${seq.done} de ${seq.total} aberta. Compre o bônus e feche a janela da loja: a próxima abre sozinha.`));
    const actions = el('div', 'm-actions');
    actions.append(btn('Parar sequência', 'plain', async () => applyState(await window.kick.cancelStoreSequence())));
    openModal('sleep', '', head, actions);
    return;
  }
  const rich = state.channels.filter((c) => (c.points || 0) >= sleepCost);
  const total = rich.reduce((t, c) => t + Math.floor(c.points / sleepCost), 0);
  head.append(el('p', 'm-text', `Dá para comprar ${total} × ${GOAL_NAMES[sleepCost]} (${total} h de bônus). Escolha os canais e as lojas abrem uma de cada vez: você compra e fecha a janela, e a próxima aparece.`));

  const seg = el('div', 'segmented s3');
  const ind = el('span', 'seg-ind');
  const options = [300, 500, 1000];
  ind.style.transform = `translateX(${options.indexOf(sleepCost) * 100}%)`;
  seg.append(ind);
  for (const cost of options) {
    const b = btn('', cost === sleepCost ? 'sel' : '', () => { sleepCost = cost; renderSleep(); });
    b.append(el('b', null, GOAL_NAMES[cost]), el('span', null, `${fmt(cost)} pts`));
    seg.append(b);
  }

  const list = el('div', 'sl-list');
  const candidates = state.channels.filter((c) => (c.points || 0) >= sleepCost - 80).sort((a, b) => b.points - a.points);
  for (const s of [...sleepPicked]) if (!rich.some((c) => c.slug === s)) sleepPicked.delete(s);
  for (const c of candidates) {
    const ok = c.points >= sleepCost;
    const row = btn('', 'sl-row' + (sleepPicked.has(c.slug) ? ' on' : ''), () => {
      if (sleepPicked.has(c.slug)) sleepPicked.delete(c.slug); else sleepPicked.add(c.slug);
      renderSleep();
    });
    row.disabled = !ok;
    const box = el('span', 'sl-box');
    box.append(el('span', null, '✓'));
    row.append(box, el('span', null, c.displayName), el('span', 'sl-info', ok ? `${fmt(c.points)} pts, ${Math.floor(c.points / sleepCost)}×` : `faltam ${fmt(sleepCost - c.points)}`));
    list.append(row);
  }
  if (!candidates.length) list.append(el('p', 'm-text', `Nenhum canal perto de ${fmt(sleepCost)} pts agora.`));

  const n = sleepPicked.size;
  const go = btn(n ? `Abrir ${n} ${n === 1 ? 'loja' : 'lojas'}` : 'Nenhum canal escolhido', 'primary', async () => {
    applyState(await window.kick.openStoreSequence(state.channels.filter((c) => sleepPicked.has(c.slug)).map((c) => c.slug)));
  });
  go.disabled = !n;
  const actions = el('div', 'm-actions');
  actions.append(btn('Cancelar', 'plain', closeModal), go);
  if (animateIn) $('#modal').hidden = true;
  openModal('sleep', '', head, seg, list, actions);
}

// ---------- Boas-vindas e novidades ----------
const INTRO_STEPS = [
  ['Faça login', 'Clique em Login Twitch e entre com sua conta. Depois, adicione os canais em + Adicionar, na lista de canais.'],
  ['Escolha seu bônus', 'Em Bônus buscado, no painel Farm, deixe Auto ou escolha XP, Capture Boost ou Secret Lure.'],
  ['Acompanhe na lista', 'Cada canal mostra o saldo, a previsão do próximo bônus e quanto falta. O painel Farm mostra quanto tempo resta no seu bônus ativo.'],
  ['Compre na loja', 'O ícone de pontos ao lado do chat abre a loja do canal. A compra é sempre feita por você.'],
];
const NEWS = [
  'Visual novo: lista de canais por situação, painel Farm e bônus ativos em destaque.',
  'Mais leve: as lives escondidas gastam bem menos CPU e memória.',
];
function showIntro(kind) {
  const nodes = [];
  const actions = el('div', 'm-actions');
  if (kind === 'welcome') {
    const head = el('div', 'in-head');
    head.append($('#header .brand').cloneNode(true), el('b', null, 'Bem-vindo ao Twitchterino'));
    nodes.push(head);
    const steps = INTRO_STEPS.map(([title, text], i) => {
      const s = el('div', 'in-step');
      const body = el('div', 'in-body');
      body.append(el('b', null, title), el('span', null, text));
      s.append(el('span', 'in-n', i + 1), body);
      return s;
    });
    const wrap = el('div');
    wrap.append(...steps);
    nodes.push(wrap);
    actions.style.borderTop = '0';
    actions.style.paddingTop = '0';
    actions.append(state.loggedIn ? btn('Entendi', 'primary', closeModal) : btn('Fazer login na Twitch', 'primary', () => { window.kick.showLogin(); closeModal(); }));
    nodes.push(actions);
    openModal('intro', 'intro', ...nodes);
    stagger(steps, [{ opacity: 0, transform: 'translateY(6px)' }, { opacity: 1, transform: 'none' }], 300, 140, 60);
    return;
  }
  nodes.push(el('b', 'm-title', `Novidades da versão ${state.version}`));
  const ul = el('ul', 'in-list');
  for (const n of NEWS) ul.append(el('li', null, n));
  nodes.push(ul);
  actions.append(btn('Entendi', 'primary', closeModal));
  nodes.push(actions);
  openModal('intro', 'intro', ...nodes);
}

// ---------- Confete: comemoração rara, com canvas vazio no resto do tempo ----------
const CONFETTI_COLORS = ['#9146ff', '#ffcf4a', '#bf94ff', '#ffffff', '#d9c2ff'];
function confetti() {
  if (document.hidden || reduceMotion.matches) return;
  const c = $('#confetti');
  const ctx = c.getContext('2d');
  c.hidden = false;
  c.width = innerWidth; c.height = innerHeight;
  const parts = Array.from({ length: 80 }, () => ({
    x: innerWidth / 2 + (Math.random() - .5) * 200, y: innerHeight * .35,
    vx: (Math.random() - .5) * 14, vy: -Math.random() * 12 - 4, r: Math.random() * 6 + 3,
    rot: Math.random() * 6, vr: (Math.random() - .5) * .3, color: CONFETTI_COLORS[Math.floor(Math.random() * CONFETTI_COLORS.length)],
  }));
  const start = performance.now();
  const frame = (t) => {
    const life = (t - start) / 2000;
    ctx.clearRect(0, 0, c.width, c.height);
    if (life >= 1 || document.hidden) { c.width = c.height = 0; c.hidden = true; return; }
    for (const p of parts) {
      p.vy += .35; p.vx *= .99; p.x += p.vx; p.y += p.vy; p.rot += p.vr;
      ctx.save(); ctx.globalAlpha = 1 - life; ctx.translate(p.x, p.y); ctx.rotate(p.rot);
      ctx.fillStyle = p.color; ctx.fillRect(-p.r / 2, -p.r / 4, p.r, p.r / 2); ctx.restore();
    }
    requestAnimationFrame(frame);
  };
  requestAnimationFrame(frame);
}
