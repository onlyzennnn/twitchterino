// Chat do canal aberto, cabeçalho e estado vazio.
// ---------- Chat ----------
const BADGES = { broadcaster: 'BROADCASTER', moderator: 'MOD', vip: 'VIP', subscriber: 'SUB', founder: 'SUB' };
const GIVEAWAY = /\b(sorteio|sorteando|giveaway|!sorteio|!giveaway|!sortear)\b/i;
let mentionRe = null, mentionFor = null;
function chatFlags(data) {
  const text = String(data.content || '');
  const me = state.username && state.username.toLowerCase();
  if (me !== mentionFor) {
    mentionFor = me;
    mentionRe = me ? new RegExp(`(^|[^a-z0-9_])@?${me.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}([^a-z0-9_]|$)`, 'i') : null;
  }
  const mention = !!mentionRe && ((data.sender && data.sender.username) || '').toLowerCase() !== me && mentionRe.test(text);
  return { mention, giveaway: GIVEAWAY.test(text) };
}

function messageNode(item) {
  if (item.system) {
    const row = el('div', 'msg system');
    row.append(el('span', 'm-time', item.time), item.text);
    return row;
  }
  const { data, flags } = item;
  const row = el('div', 'msg' + (flags.mention ? ' mention' : '') + (flags.giveaway ? ' giveaway' : ''));
  row.append(el('span', 'm-time', timeStr(new Date(data.created_at || Date.now()))));
  if (flags.giveaway) row.append(el('span', 'm-badge b-giveaway', 'SORTEIO'));
  const identity = (data.sender && data.sender.identity) || {};
  for (const b of identity.badges || []) {
    if (BADGES[b.type]) row.append(el('span', `m-badge b-${b.type === 'founder' ? 'subscriber' : b.type}`, BADGES[b.type]));
  }
  const user = el('b', null, data.sender ? data.sender.username : '?');
  user.style.color = identity.color || '#c9ccd6';
  row.append(user, `: ${data.content || ''}`);
  return row;
}

function pushFeed(slug, item) {
  const feed = feeds.get(slug) || [];
  feed.push(item);
  if (feed.length > MAX_MESSAGES) feed.splice(0, feed.length - MAX_MESSAGES);
  feeds.set(slug, feed);
  if (slug === active && !document.hidden) queueMessage(item);
}
const systemItem = (text) => ({ system: true, text, time: timeStr() });

// Junta as mensagens em lotes: chat movimentado não pode custar um layout por mensagem.
let pendingMessages = [];
let flushTimer = null;
let lastFlushAt = 0;
function queueMessage(item) {
  pendingMessages.push(item);
  if (!flushTimer) flushTimer = setTimeout(flushMessages, 200);
}
function flushMessages() {
  flushTimer = null;
  const batch = pendingMessages;
  pendingMessages = [];
  const box = $('#messages');
  if (document.hidden || box.hidden || !batch.length) return;
  const atBottom = box.scrollHeight - box.scrollTop - box.clientHeight < 90;
  const nodes = batch.map(messageNode);
  box.append(...nodes);
  while (box.childElementCount > MAX_MESSAGES) box.firstElementChild.remove();
  if (atBottom) box.scrollTop = box.scrollHeight;
  // Só anima em chat calmo: em chat rápido sempre haveria uma animação rodando (~10% de GPU).
  const calm = batch.length === 1 && Date.now() - lastFlushAt > 1500;
  lastFlushAt = Date.now();
  if (calm) anim(nodes[0], [{ opacity: 0, transform: 'translateY(6px)' }, { opacity: 1, transform: 'none' }], { duration: 240, easing: EO });
}
function renderMessages() {
  pendingMessages = [];
  const box = $('#messages');
  box.replaceChildren(...(feeds.get(active) || []).map(messageNode));
  box.scrollTop = box.scrollHeight;
}

function chatAlert(slug, data, flags) {
  if (!state.notifyChat || (document.hasFocus() && slug === active)) return;
  if (flags.giveaway && !flags.mention) {
    if (Date.now() - (chatAlert.last.get(slug) || 0) < 5 * 60 * 1000) return;
    chatAlert.last.set(slug, Date.now());
  }
  const ch = state.channels.find((c) => c.slug === slug);
  const name = ch ? ch.displayName : slug;
  const n = new Notification(flags.mention ? `${data.sender.username} mencionou você em ${name}` : `Sorteio no chat de ${name}`,
    { body: String(data.content || '').slice(0, 140), icon: '../build/icon.png' });
  n.onclick = () => { window.focus(); select(slug); };
}
chatAlert.last = new Map();

// ---------- Cabeçalho do chat e estado vazio ----------
function renderSelected() {
  const c = state.channels.find((x) => x.slug === active);
  const hasChannel = !!c;
  $('#chat-head').style.visibility = hasChannel ? '' : 'hidden';
  $('#composer').style.visibility = hasChannel ? '' : 'hidden';
  if (!c) { $('#messages').hidden = true; $('#empty').hidden = true; return; }
  const key = statusOf(c);
  const st = ST[key];
  const fav = (state.favorites || []).includes(c.slug);
  const avatar = $('#sel-avatar');
  paintAvatar(avatar, c.displayName, c.avatar);
  setStyle(avatar, 'boxShadow', st.ring ? `0 0 0 2px #0e0f13, 0 0 0 4px ${st.ring}` : 'none');
  setText($('#sel-name'), c.displayName);
  const badge = $('#sel-badge');
  setText(badge, st.label);
  setStyle(badge, 'color', st.color);
  setStyle(badge, 'background', st.bg);
  const info = key === 'age' ? 'A Twitch pede confirmação: clique em Abrir live. Sem isso, ela não conta pontos.'
    : c.live ? `Ao vivo para ${fmt(c.viewers)} pessoas: ${c.title}` : 'Offline';
  setText($('#sel-text'), info);
  $('#sel-text').title = c.live ? c.title : '';
  setText($('#btn-fav'), fav ? '★ Favorito' : '☆ Favoritar');
  $('#btn-fav').classList.toggle('is-fav', fav);

  const goal = c.goal || 0;
  $('#messages').hidden = !c.watching;
  $('#empty').hidden = c.watching;
  if (!c.watching) {
    const names = state.channels.filter((x) => x.watching).map((x) => x.displayName).join(' e ');
    setText($('#empty-title'), c.live ? 'Na fila por uma vaga' : `${c.displayName} está offline`);
    setText($('#empty-body'), c.live
      ? (names ? `O chat aparece quando o canal ganhar uma vaga. Agora as vagas estão com ${names}, que estão mais perto do próximo bônus.` : 'O chat aparece quando o canal ganhar uma vaga.')
      : (fav ? 'Você recebe um aviso quando ele entrar ao vivo.' : 'Quando entrar ao vivo, ele ganha uma vaga por até 10 min para pegar a sequência de lives da Twitch.'));
    setText($('#goal-name'), `Até ${GOAL_NAMES[goal] || `${fmt(goal)} pontos`}`);
    setText($('#goal-pts'), fmt(c.points));
    setText($('#goal-of'), ` / ${fmt(goal)}`);
    setText($('#goal-left'), fmt(c.goalLeft));
    setText($('#goal-verb'), c.goalLeft === 1 ? 'Falta' : 'Faltam');
    setText($('#goal-unit'), c.goalLeft === 1 ? 'ponto' : 'pontos');
    setStyle($('#goal-bar'), 'transform', `scaleX(${goal ? Math.min(1, (c.points || 0) / goal).toFixed(3) : 0})`);
  }

  const input = $('#input');
  input.disabled = !c.watching;
  const placeholder = c.watching ? `Enviar mensagem em ${c.displayName}…` : 'O chat abre quando o canal estiver sendo assistido';
  if (input.placeholder !== placeholder) input.placeholder = placeholder;
  const pts = $('#points-val');
  const text = fmt(c.points);
  if (pts.textContent !== text) {
    if (pts._slug === c.slug && c.points > pts._v) anim(pts, [{ transform: 'scale(1)' }, { transform: 'scale(1.14)' }, { transform: 'scale(1)' }], { duration: 320, easing: EO });
    pts.textContent = text;
  }
  pts._slug = c.slug;
  pts._v = c.points;
}

function select(slug, force) {
  const changed = slug !== active;
  active = slug;
  for (const [s, r] of rows) r.el.classList.toggle('sel', s === slug);
  renderSelected();
  if (changed || force) {
    renderMessages();
    anim($('#chat-area'), [{ opacity: 0, transform: 'translateY(4px)' }, { opacity: 1, transform: 'none' }], { duration: 200, easing: EO });
  }
}

function floatChest() {
  const wrap = $('.points-wrap');
  const f = el('span', 'floater', '+50 baú');
  wrap.append(f);
  const a = anim(f, [{ transform: 'translate(-50%,0)', opacity: 0 }, { transform: 'translate(-50%,-10px)', opacity: 1, offset: 0.25 }, { transform: 'translate(-50%,-24px)', opacity: 0 }], { duration: 1100, easing: 'ease-out' });
  if (a) a.onfinish = () => f.remove(); else f.remove();
}
