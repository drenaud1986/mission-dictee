'use strict';
/* Cœur de l'appli : voix, sélection des mots, progression, écrans. (Fonctions utilitaires dans core.js) */

/* ============ Voix ============ */
let voices = [];
function loadVoices() { voices = ('speechSynthesis' in window) ? speechSynthesis.getVoices().filter(v => /^fr/i.test(v.lang)) : []; }
if ('speechSynthesis' in window) { loadVoices(); speechSynthesis.onvoiceschanged = () => { loadVoices(); if (S.view === 'settings' && S.parentOk) renderSettings(); }; }
function bestVoice() {
  const n = data.settings.voice; if (n) { const v = voices.find(v => v.name === n); if (v) return v; }
  const fr = voices.filter(v => /fr[-_]FR/i.test(v.lang));
  for (const r of [/google/i, /amélie|amelie/i, /audrey/i, /thomas/i, /denise|henri|vivienne|remy/i, /natural|online/i]) { const v = fr.find(v => r.test(v.name)); if (v) return v; }
  return fr[0] || voices[0] || null;
}
function utter(text, rate) { const u = new SpeechSynthesisUtterance(text); u.lang = 'fr-FR'; const v = bestVoice(); if (v) u.voice = v; u.rate = rate || data.settings.rate; return u; }
function speakTTS(text, rate) {
  return new Promise(res => {
    const u = utter(text, rate), t = setTimeout(res, 1800 + text.length * 140);
    u.onend = u.onerror = () => { clearTimeout(t); res(); };
    speechSynthesis.speak(u);
  });
}
let speechGen = 0;
/* Lit une suite de textes : l'enregistrement du parent s'il existe, sinon la voix de synthèse. */
async function speakSeq(texts, rate) {
  const g = ++speechGen; Voice.stop(); if ('speechSynthesis' in window) speechSynthesis.cancel();
  for (const t of texts) {
    if (g !== speechGen) return;
    if (Voice.has(t)) await Voice.play(t, rate && rate < data.settings.rate ? 0.75 : 1);
    else if ('speechSynthesis' in window) await speakTTS(t, rate);
    else { toast('La lecture audio n’est pas disponible sur ce navigateur.'); return; }
  }
}
const speak = (text, rate) => speakSeq([text], rate);
const ctxOf = w => (data.ctx || {})[normAnswer(w)] || '';
/* Le mot, puis la phrase indice, puis encore le mot : « à… Je vais à l'école… à ». */
const speakCtx = w => ctxOf(w) ? speakSeq([w, ctxOf(w), w]) : speak(w);
function speakSlow(text) {
  if (Voice.has(text)) return speakSeq([text], data.settings.rate * 0.7);
  const words = text.replace(/[.!?]$/, '').split(/\s+/), groups = [];
  for (let i = 0; i < words.length; i += 2) groups.push(words.slice(i, i + 2).join(' '));
  speakSeq(groups, data.settings.rate * 0.85);
}
function cancelSpeech() { speechGen++; Voice.stop(); if ('speechSynthesis' in window) speechSynthesis.cancel(); }

/* ============ Listes & sélection des mots ============ */
const curPeriod = () => data.periods.find(p => p.id === data.current.period) || data.periods[0];
function curWeek() { const p = curPeriod(); return p.weeks.find(w => w.id === data.current.week) || p.weeks[p.weeks.length - 1] || { id: '', title: '—', words: [], phrases: [] }; }
const weekNum = (p, w) => p.weeks.indexOf(w) + 1;
function findWeek(id) { for (const p of data.periods) { const w = p.weeks.find(w => w.id === id); if (w) return { p, w }; } return null; }
const weekItems = (p, w) => w.words.map(x => ({ ...x, src: `${p.name} · S${weekNum(p, w)} · ${w.title}` }));
const invItems = () => data.invariants.map(w => ({ w, k: 'invariable', src: 'Mots invariables' }));
function dedupe(items) { const seen = new Set(); return items.filter(x => { const k = normAnswer(x.w); if (!k || seen.has(k)) return false; seen.add(k); return true; }); }
function allItems() { const a = []; data.periods.forEach(p => p.weeks.forEach(w => a.push(...weekItems(p, w)))); a.push(...invItems()); return dedupe(a); }

function wp(w) { const k = normAnswer(w); return prog.words[k] || (prog.words[k] = { ok: 0, ko: 0, box: 0, last: 0 }); }
function status(w) {
  const p = prog.words[normAnswer(w)];
  if (!p || (!p.ok && !p.ko)) return 'new';
  if (p.box >= 4) return 'ok';
  if (p.ko && p.box <= 1) return 'weak';
  return 'learning';
}
const weakItems = () => allItems().filter(x => status(x.w) === 'weak');

function scopePool(scope = S.scope) {
  let items = []; const p = curPeriod();
  if (scope.type === 'week') items = weekItems(p, curWeek());
  else if (scope.type === 'period') p.weeks.forEach(w => items.push(...weekItems(p, w)));
  else if (scope.type === 'pick') { const f = findWeek(scope.weekId); if (f) items = weekItems(f.p, f.w); }
  else if (scope.type === 'invariants') items = invItems();
  else if (scope.type === 'weak') return weakItems();
  else if (scope.type === 'all') return allItems();
  if (data.settings.includeInvariants && scope.type !== 'invariants') items.push(...invItems());
  return dedupe(items);
}
function scopePhrases() {
  const s = S.scope, p = curPeriod();
  if (s.type === 'week') return curWeek().phrases;
  if (s.type === 'pick') { const f = findWeek(s.weekId); return f ? f.w.phrases : []; }
  if (s.type === 'all') return data.periods.flatMap(p => p.weeks.flatMap(w => w.phrases));
  return p.weeks.flatMap(w => w.phrases);
}
function scopeLabel(scope = S.scope) {
  const p = curPeriod(), w = curWeek();
  switch (scope.type) {
    case 'week': return `Semaine ${weekNum(p, w)} · ${w.title}`;
    case 'period': return `Toute la ${p.name.toLowerCase()}`;
    case 'pick': { const f = findWeek(scope.weekId); return f ? `${f.p.name} · S${weekNum(f.p, f.w)} · ${f.w.title}` : '—'; }
    case 'weak': return 'Mots à retravailler';
    case 'invariants': return 'Mots invariables';
    default: return 'Toutes les listes';
  }
}
/* Jours restants avant la dictée bilan de la période. */
function daysLeft(p) {
  if (!p || !p.bilan) return null;
  const [y, m, d] = p.bilan.split('-').map(Number), t = new Date(), today = new Date(t.getFullYear(), t.getMonth(), t.getDate());
  return Math.round((new Date(y, m - 1, d) - today) / 86400000);
}

/* Répétition intelligente : les mots ratés ou jamais vus sortent plus souvent,
   et un mot raté revient 3 questions plus tard. */
const BOX_WEIGHT = [6, 9, 5, 3, 2, 1];
function pick(st) {
  const i = st.retry.findIndex(r => r.due <= st.count);
  if (i >= 0) { const r = st.retry.splice(i, 1)[0]; return { ...r.item, retry: true }; }
  const avoid = st.recent.slice(-Math.min(3, st.pool.length - 1));
  let c = st.pool.filter(p => !avoid.includes(p.w)); if (!c.length) c = st.pool;
  const ws = c.map(p => BOX_WEIGHT[(prog.words[normAnswer(p.w)] || {}).box || 0]);
  let r = Math.random() * ws.reduce((a, b) => a + b, 0);
  for (let k = 0; k < c.length; k++) { r -= ws[k]; if (r <= 0) return { ...c[k] }; }
  return { ...c[c.length - 1] };
}
function weightedSample(pool, n) {
  const left = [...pool], out = [];
  while (out.length < n && left.length) {
    const ws = left.map(p => BOX_WEIGHT[(prog.words[normAnswer(p.w)] || {}).box || 0]);
    let r = Math.random() * ws.reduce((a, b) => a + b, 0), k = 0;
    for (; k < left.length - 1; k++) { r -= ws[k]; if (r <= 0) break; }
    out.push(left.splice(k, 1)[0]);
  }
  return out;
}

/* ============ Mots en couleur : terminaison des verbes en rouge, comme sur la fiche ============ */
const ENDINGS = /^(e|es|ent|ons|eons|ez|ais|ait|ions|iez|aient|ra|ras|ront|rons)$/;
function endingSplit(w, h) {
  if (!h || /^(être|avoir)$/.test(h)) return null;
  const m = w.match(/^(je |j'|tu |il |elle |on |nous |vous |ils |elles )/), verb = m ? w.slice(m[0].length) : w;
  const stem = h.slice(0, -2);
  if (!stem || /\s/.test(verb) || !verb.startsWith(stem)) return null;
  const end = verb.slice(stem.length);
  return ENDINGS.test(end) ? [w.slice(0, w.length - end.length), end] : null;
}
function colorWord(it) { const sp = it.h ? endingSplit(it.w, it.h) : null; return sp ? `${esc(sp[0])}<span class="end">${esc(sp[1])}</span>` : esc(it.w); }

/* ============ Progression, compagnon, XP ============ */
const dayKey = (d = new Date()) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
function record(w, ok) {
  const p = wp(w), wasWeak = status(w) === 'weak';
  if (ok) { p.ok++; p.box = Math.min(5, (p.box || 0) + 1); bumpCounter('ok'); bumpDaily('ok'); if (wasWeak) bumpDaily('weakOk'); }
  else { p.ko++; p.box = 1; }
  p.last = Date.now();
  const first = !prog.days[dayKey()];
  const d = prog.days[dayKey()] || (prog.days[dayKey()] = { n: 0, ok: 0 }); d.n++; if (ok) d.ok++;
  prog.bestDays = Math.max(prog.bestDays || 0, dayStreak());
  if (first) { updateHeader(); if (dayStreak() > 1) popInfo('🔥', `${dayStreak()} jours d’affilée !`, `${data.settings.buddyName} est tout content.`); }
  save();
}
function streakUpdate(ok) {
  if (ok) {
    prog.streak++; prog.bestStreak = Math.max(prog.bestStreak, prog.streak); maxDaily('streakMax', prog.streak);
    if (prog.streak % 5 === 0) { Sfx.play('streak'); floatText(`🔥 ${prog.streak} d’affilée !`); if (prog.streak >= 10) confetti(10, ['🔥']); say(`${prog.streak} bonnes réponses d’affilée, je crache du feu !`); }
  } else prog.streak = 0;
}
const BUDDY_TALK = ['On révise ensemble ?', 'Chaque mot me fait grandir !', 'Miam, des étoiles !', 'Tu es un champion des mots !', 'Écoute bien chaque son…', 'Attention aux accents !', 'Les mots invariables ne changent jamais !', 'Tu m’offres un cadeau à la boutique ?'];
function say(msg) { $('bubble').textContent = msg; }
function bounce() { const b = $('buddy'); b.classList.remove('bounce'); void b.offsetWidth; b.classList.add('bounce'); }
function updateHeader() {
  const L = level(prog.xp), st = stage(L), s = data.settings, b = $('buddy');
  b.textContent = st.e; b.className = 'buddy ' + st.cls;
  const acc = SHOP.acc.find(x => x.id === prog.equip.acc); $('acc').textContent = acc ? acc.e : '';
  $('zzz').hidden = !isSleepy();
  document.querySelector('.hero').className = 'hero decor-' + (prog.equip.decor || 'none');
  $('buddyName').textContent = s.buddyName; $('level').textContent = L; $('stageName').textContent = '· ' + st.n;
  const a = 50 * (L - 1) * L, bb = 50 * L * (L + 1); $('xpFill').style.width = ((prog.xp - a) / (bb - a) * 100) + '%';
  $('xp').textContent = prog.xp; $('coins').textContent = prog.coins; $('flames').textContent = dayStreak();
  $('title').textContent = 'La mission Dictée de ' + s.childName;
  const p = curPeriod(), w = curWeek(); $('ctxPill').textContent = `CE1 · ${p.name} · Semaine ${weekNum(p, w)}`;
  document.title = 'Mission Dictée · ' + s.childName;
}
function gain(n, fromEl) {
  if (n <= 0) return;
  const L0 = level(prog.xp); prog.xp += n; prog.coins += Math.ceil(n / 2); save();
  if (fromEl) flyStars(fromEl, Math.min(8, 2 + Math.round(n / 10))); else floatText('+' + n + ' ⭐');
  setTimeout(() => { updateHeader(); bounce(); }, fromEl ? 750 : 0);
  const L1 = level(prog.xp); if (L1 > L0) setTimeout(() => levelUp(L0, L1), 900);
}
function logSession(m, score, total) { prog.sessions.unshift({ d: Date.now(), m, s: score, t: total, sc: scopeLabel() }); prog.sessions = prog.sessions.slice(0, 60); save(); }

/* ============ Effets ============ */
function fx(el, ms) { $('fx').appendChild(el); if (ms) setTimeout(() => el.remove(), ms); return el; }
function mk(cls, html) { const d = document.createElement('div'); d.className = cls; d.innerHTML = html; return d; }
function floatText(t) { fx(mk('float', esc(t)), 1100); }
function toast(t) { fx(mk('toast', esc(t)), 2600); }
function confetti(n = 26, set = ['⭐', '🎉', '✨', '🌟', '🎈']) { for (let i = 0; i < n; i++) { const c = mk('confetti', pickOne(set)); c.style.left = rand(100) + 'vw'; c.style.animationDelay = (Math.random() * .5) + 's'; fx(c, 2600); } }
function levelUp(L0, L) {
  const st0 = stage(L0), st = stage(L), name = esc(data.settings.buddyName), evolved = st0 !== st, hatch = st0.lvl === 1 && evolved;
  const m = fx(mk('modal', `<div><div class="big ${hatch ? 'egg-shake' : ''}" id="lvBig">${evolved ? st0.e : st.e}</div><h2>Niveau ${L} !</h2><p id="lvTxt">${evolved ? (hatch ? 'Oh… l’œuf bouge !' : `${name} se transforme…`) : `${name} grandit grâce à toi !`}</p><button class="btn primary">Super ! ➜</button></div>`));
  m.querySelector('button').onclick = () => m.remove();
  if (evolved) {
    Sfx.play(hatch ? 'hatch' : 'level');
    setTimeout(() => { const bg = $('lvBig'); if (!bg) return; bg.className = 'big poof'; bg.textContent = hatch ? '💥' : '✨'; }, hatch ? 1400 : 700);
    setTimeout(() => { const bg = $('lvBig'); if (!bg) return; bg.className = 'big born ' + st.cls; bg.textContent = st.e; $('lvTxt').textContent = `Incroyable ! ${data.settings.buddyName} devient ${st.n} !`; Sfx.play('level'); confetti(); }, hatch ? 1800 : 1100);
  } else { Sfx.play('level'); confetti(); }
  say(`Merci ! Je suis niveau ${L} !`); checkBadges();
}

/* ============ Navigation ============ */
function stopAll() { S.gen++; clearInterval(S.timer); S.timer = null; if (S.ch) S.ch.running = false; cancelSpeech(); }
function later(fn, ms) { const g = S.gen; setTimeout(() => { if (g === S.gen) fn(); }, ms); }
function freshView() { const v = V(); v.classList.remove('fade'); void v.offsetWidth; v.classList.add('fade'); }
/* Garde la question à l'écran : si le haut du panneau est sorti de l'écran, on y revient, sinon on ne bouge pas. */
function keepPanelInView() { const r = V().getBoundingClientRect(); if (r.top < 0) window.scrollTo({ top: window.scrollY + r.top - 8 }); }
const PLAY_VIEWS = ['play', 'challenge', 'dict', 'boss'];
function go(view) {
  stopAll(); S.view = view;
  document.querySelectorAll('.tab').forEach(b => b.classList.toggle('active', b.dataset.view === view || PLAY_VIEWS.includes(view) && b.dataset.view === 'home'));
  ({ home: renderHome, lists: renderLists, draco: renderDraco, stats: renderStats, settings: renderSettings }[view] || renderHome)();
  freshView(); window.scrollTo({ top: 0, behavior: 'smooth' });
}
const topBar = (title, sub) => `<div class="topbar"><button class="btn small" data-back>← Menu</button><h2>${title}</h2>${sub ? `<span class="pill">${sub}</span>` : ''}</div>`;
const bar = (v, cls = '') => `<div class="progress ${cls}"><span style="width:${Math.max(0, Math.min(100, v))}%"></span></div>`;
const hintLine = it => `<div class="hint">${esc(it.src || '')}${it.k ? ' · ' + (KINDS[it.k] || it.k) : ''}${it.h ? ' « ' + esc(it.h) + ' »' : ''}${it.retry ? ' · 🔁 on le revoit' : ''}</div>`;
const ctxBtn = it => ctxOf(it.w) ? '<button class="btn" id="ctx">💬 Dans une phrase</button>' : '';
function bindCtx(it) { const b = $('ctx'); if (b) b.onclick = () => speakCtx(it.w); }
function feedback(ok, html) { const f = $('fb'); if (!f) return; f.className = 'feedback ' + (ok === true ? 'good' : ok === false ? 'bad' : ''); f.innerHTML = html; }
const ACCENTS = ['é', 'è', 'ê', 'à', 'â', 'ù', 'î', 'ô', 'ç', "'"];
const inputHTML = (ph, multi) => (multi
  ? `<textarea id="answer" class="answer" rows="3" autocomplete="off" autocapitalize="sentences" autocorrect="off" spellcheck="false" placeholder="${ph}"></textarea>`
  : `<input id="answer" class="answer" type="text" autocomplete="off" autocapitalize="none" autocorrect="off" spellcheck="false" placeholder="${ph}" aria-label="${ph}">`)
  + `<div class="accents">${ACCENTS.map(a => `<button class="key" type="button" data-k="${esc(a)}">${esc(a)}</button>`).join('')}</div>`;

/* ============ Accueil ============ */
function weekMastery(w) { const n = w.words.length; return n ? w.words.filter(x => status(x.w) === 'ok').length / n : 1; }
function countdownHTML() {
  const p = curPeriod(), d = daysLeft(p);
  if (d === null || d < 0) return '';
  const upTo = p.weeks.slice(0, Math.max(1, weekNum(p, curWeek())));
  let advice, btn;
  if (d <= 3) { advice = 'Révision générale : toute la période, puis le boss !'; btn = `<button class="btn primary small" data-plan="period">Réviser toute la période</button>`; }
  else {
    const w = upTo.reduce((a, b) => weekMastery(b) < weekMastery(a) ? b : a);
    advice = `Semaine ${weekNum(p, w)} · ${esc(w.title)} <span class="muted small">(${Math.round(weekMastery(w) * 100)} % maîtrisé)</span>`;
    btn = `<button class="btn primary small" data-plan="${w.id}">Réviser cette semaine</button>`;
  }
  return `<div class="countdown"><div class="cd-num">${d === 0 ? '🍀' : d}</div><div><b>${d === 0 ? 'C’est le jour de la grande dictée ! Bonne chance !' : `jour${d > 1 ? 's' : ''} avant la grande dictée de la ${esc(p.name.toLowerCase())} 🎄`}</b>
    <div class="small">🐉 Le conseil de ${esc(data.settings.buddyName)} pour aujourd’hui : ${advice}</div><div class="actions left" style="margin-top:6px">${btn}</div></div></div>`;
}
function renderHome() {
  const p = curPeriod(), w = curWeek(), weakN = weakItems().length, s = data.settings;
  if (S.scope.type === 'weak' && !weakN) S.scope = { type: 'week' };
  const pool = scopePool(), chips = [
    ['week', `📅 Semaine ${weekNum(p, w)} · ${w.title}`],
    ['period', `🎄 Toute la ${p.name.toLowerCase()}`],
    ['weak', `🔁 À retravailler (${weakN})`, !weakN],
    ['invariants', '✨ Mots invariables'],
    ['all', '📚 Tout']
  ];
  const opts = data.periods.map(pp => `<optgroup label="${esc(pp.name)}">${pp.weeks.map((ww, i) => `<option value="${ww.id}" ${S.scope.type === 'pick' && S.scope.weekId === ww.id ? 'selected' : ''}>Semaine ${i + 1} · ${esc(ww.title)}</option>`).join('')}</optgroup>`).join('');
  const best = prog.best['ch' + s.challengeSeconds] || 0;
  const tile = (m, ico, t, sub) => `<button class="mode" data-mode="${m}"><span class="ico">${ico}</span><b>${t}</b><small>${sub}</small></button>`;
  V().innerHTML = `${countdownHTML()}${missionsHTML()}
  <h2>Que veux-tu réviser, ${esc(s.childName)} ?</h2>
  <div class="scope" id="scope">
    <div class="chips">${chips.map(([t, l, dis]) => `<button class="chip ${S.scope.type === t ? 'selected' : ''}" data-scope="${t}" ${dis ? 'disabled' : ''}>${esc(l)}</button>`).join('')}</div>
    <label>Ou une autre semaine :<select id="pickWeek"><option value="">— choisir —</option>${opts}</select></label>
    <p class="muted small" style="margin:6px 0 0">${pool.length} mots dans « ${esc(scopeLabel())} »${s.includeInvariants && !['weak', 'all', 'invariants'].includes(S.scope.type) ? ' (avec les mots invariables)' : ''}.</p>
  </div>
  <h3>🏋️ Entraînement</h3>
  <div class="modes">${tile('quiz', '🎯', 'Quiz', 'Écoute et choisis')}${tile('spell', '✍️', 'Écris le mot', 'Regarde, cache, écris')}${tile('audio', '🔊', 'Dictée audio', 'Écoute et écris')}${tile('cards', '🃏', 'Cartes mémo', 'Réfléchis dans ta tête')}</div>
  <h3>🧠 Les défis malins</h3>
  <div class="modes">${tile('pieces', '🧩', 'Mot en morceaux', 'Remets les lettres')}${tile('missing', '🔤', 'Lettre manquante', 'Trouve le piège')}${tile('tri', '📦', 'Tri des verbes', 'Range les terminaisons')}${tile('hunt', '🔎', 'Chasse aux fautes', 'Trouve les erreurs')}</div>
  <div class="bigmodes">
    <div class="bigmode"><h3>⏱️ Défi chronométré</h3><p>${s.challengeSeconds} secondes pour trouver un maximum de mots !</p><p class="muted small">🏆 Record : ${best} mot${best > 1 ? 's' : ''}</p><button class="btn primary" id="goChallenge">Relever le défi ⚡</button></div>
    <div class="bigmode dict"><h3>📝 Dictée complète</h3><p>Comme en classe : on écrit tout, on corrige à la fin.</p><div class="actions left"><button class="btn primary" id="goDictW">${s.dictationLength} mots</button><button class="btn green" id="goDictP">Des phrases</button></div></div>
    ${bossCardHTML()}
  </div>`;
  V().querySelectorAll('[data-scope]').forEach(b => b.onclick = () => { S.scope = { type: b.dataset.scope }; renderHome(); });
  $('pickWeek').onchange = e => { if (e.target.value) { S.scope = { type: 'pick', weekId: e.target.value }; renderHome(); } };
  V().querySelectorAll('[data-mode]').forEach(b => b.onclick = () => startSession(b.dataset.mode));
  V().querySelectorAll('[data-plan]').forEach(b => b.onclick = () => {
    S.scope = b.dataset.plan === 'period' ? { type: 'period' } : { type: 'pick', weekId: b.dataset.plan }; renderHome();
    $('scope').scrollIntoView({ behavior: 'smooth', block: 'start' }); say('Super ! Choisis un jeu pour réviser.');
  });
  $('goChallenge').onclick = startChallenge; $('goDictW').onclick = () => startDictation('words'); $('goDictP').onclick = () => startDictation('phrases');
  $('goBoss').onclick = startBoss;
}

/* ============ Entraînement et défis malins (même moteur de session) ============ */
const MODE_TITLES = { quiz: '🎯 Quiz', spell: '✍️ Écris le mot', audio: '🔊 Dictée audio', cards: '🃏 Cartes mémo', pieces: '🧩 Mot en morceaux', missing: '🔤 La lettre manquante', tri: '📦 Le tri des verbes', hunt: '🔎 La chasse aux fautes' };
const RENDER = { quiz: () => renderQuiz(), spell: () => renderSpell(), audio: () => renderAudio(), cards: () => renderCards(), pieces: () => renderPieces(), missing: () => renderMissing(), tri: () => renderTri(), hunt: () => renderHunt() };
const POOL_FILTER = { pieces: it => piecesOk(it), missing: it => missingOk(it), tri: it => triOk(it) };
const EMPTY_MSG = { tri: 'Pas de verbes avec un pronom dans cette sélection : choisis une autre semaine.', hunt: 'Pas encore de phrases pour cette sélection : ajoute-en dans Réglages.' };
function startSession(mode, poolOverride) {
  let pool = poolOverride || (mode === 'hunt' ? huntPool() : scopePool());
  if (POOL_FILTER[mode]) pool = pool.filter(POOL_FILTER[mode]);
  if (!pool.length) { toast(EMPTY_MSG[mode] || 'Aucun mot dans cette sélection.'); return; }
  stopAll(); S.view = 'play';
  const total = mode === 'hunt' ? Math.min(5, pool.length * 2) : data.settings.sessionLength;
  S.sess = { mode, pool, count: 0, good: 0, total, retry: [], recent: [], missed: [], cur: null, locked: false, boxes: {} };
  nextItem(true);
}
function nextItem(first) {
  stopAll(); const s = S.sess;
  if (s.count >= s.total) return sessionEnd();
  s.cur = pick(s); s.locked = false;
  RENDER[s.mode](); freshView();
  if (first) window.scrollTo({ top: Math.max(0, V().getBoundingClientRect().top + window.scrollY - 8), behavior: 'smooth' }); else keepPanelInView();
  if (s.mode !== 'hunt' && s.mode !== 'cards' && Math.random() < .5) say(dracoTip(s.cur));
}
function answer(ok, pts, opts = {}) {
  const s = S.sess, it = s.cur;
  if (!opts.noRecord) record(it.w, ok);
  streakUpdate(ok); s.count++; s.recent.push(it.w);
  if (ok) { s.good++; Sfx.play('good'); gain(pts, opts.el); say(cheer()); }
  else {
    Sfx.play('bad'); if (pts > 0) gain(pts, opts.el);
    s.retry.push({ item: { ...it, retry: false }, due: s.count + 3 }); if (!s.missed.some(m => m.w === it.w)) s.missed.push(it);
    say(s.mode === 'hunt' ? 'Regarde bien chaque mot, lettre par lettre !' : dracoTip(it)); updateHeader(); save();
  }
  checkBadges();
}
const playHead = () => { const s = S.sess; return topBar(MODE_TITLES[s.mode], `${s.mode === 'hunt' ? 'Phrase' : s.mode === 'tri' ? 'Verbe' : 'Mot'} ${Math.min(s.count + 1, s.total)}/${s.total}`) + bar(s.count / s.total * 100); };

function renderQuiz() {
  const s = S.sess, it = s.cur, ch = shuffle(makeChoices(it.w));
  V().innerHTML = playHead() + `<div class="card">${hintLine(it)}<div class="word" id="w">🔊 ???</div><div class="hint">Écoute, puis trouve la bonne orthographe parmi 4 mots très proches.</div><div class="actions"><button class="btn yellow" id="listen">🔊 Réécouter</button>${ctxBtn(it)}</div></div>
  <div class="options" id="opts">${ch.map(c => `<button class="option">${esc(c)}</button>`).join('')}</div>
  <div class="feedback" id="fb" aria-live="polite"></div><div class="actions"><button class="btn primary" id="next" disabled>Mot suivant ➜</button></div>`;
  $('listen').onclick = () => speak(it.w); bindCtx(it);
  [...$('opts').children].forEach(b => b.onclick = () => {
    if (s.locked) return; s.locked = true; const ok = b.textContent === it.w;
    b.classList.add(ok ? 'correct' : 'wrong'); [...$('opts').children].find(x => x.textContent === it.w).classList.add('correct');
    $('w').innerHTML = colorWord(it);
    feedback(ok, ok ? cheer() + ' Tu as repéré la bonne orthographe ! +10 ⭐' : 'Presque ! Le mot attendu était : <b>' + colorWord(it) + '</b>');
    answer(ok, 10, { el: b }); $('next').disabled = false; $('next').focus({ preventScroll: true });
  });
  $('next').onclick = () => nextItem();
  // Pour les mots qui se prononcent pareil (à / a…), on lit aussi la phrase indice.
  later(() => it.k === 'invariable' || /^(c'est|il a|il est|ses |mes |son |mon )/.test(it.w) ? speakCtx(it.w) : speak(it.w), 250);
}

function renderSpell() {
  const s = S.sess, it = s.cur; let peeked = false;
  V().innerHTML = playHead() + `<div class="card">${hintLine(it)}<div class="word" id="w">${colorWord(it)}</div><div class="hint" id="h2">Observe bien le mot : il va se cacher dans 3 secondes !</div></div>
  ${inputHTML('Écris le mot ici…')}<div class="feedback" id="fb" aria-live="polite"></div>
  <div class="actions"><button class="btn yellow" id="show">👀 Revoir 2 secondes</button><button class="btn primary" id="check">Vérifier ✓</button><button class="btn green" id="next" style="display:none">Mot suivant ➜</button></div>`;
  const hide = () => { if (s.locked) return; $('w').textContent = '🤔 À toi !'; $('h2').textContent = 'Écris le mot de mémoire.'; $('show').disabled = false; $('answer').focus({ preventScroll: true }); };
  $('show').disabled = true; speak(it.w); later(hide, 3000);
  $('show').onclick = () => { peeked = true; $('w').innerHTML = colorWord(it); $('h2').textContent = 'Regarde vite…'; $('show').disabled = true; later(hide, 2000); };
  $('check').onclick = () => checkTyped(() => peeked ? 10 : 15);
  $('next').onclick = () => nextItem(); $('answer').addEventListener('keydown', e => { if (e.key === 'Enter') (s.locked ? $('next') : $('check')).click(); });
}

function renderAudio() {
  const s = S.sess, it = s.cur;
  V().innerHTML = playHead() + `<div class="card">${hintLine(it)}<div class="word" id="w">🎧 ???</div><div class="hint" id="h2">Le mot reste caché : écoute-le autant de fois que tu veux.</div><div class="actions"><button class="btn yellow" id="listen">🔊 Écouter</button><button class="btn" id="slow">🐢 Plus lentement</button>${ctxBtn(it)}</div></div>
  ${inputHTML('Écris le mot entendu…')}<div class="feedback" id="fb" aria-live="polite"></div>
  <div class="actions"><button class="btn primary" id="check">Vérifier ✓</button><button class="btn green" id="next" style="display:none">Mot suivant ➜</button></div>`;
  $('listen').onclick = () => speak(it.w); $('slow').onclick = () => speak(it.w, data.settings.rate * 0.65); bindCtx(it);
  $('check').onclick = () => checkTyped(() => 20);
  $('next').onclick = () => nextItem(); $('answer').addEventListener('keydown', e => { if (e.key === 'Enter') (s.locked ? $('next') : $('check')).click(); });
  later(() => it.k === 'invariable' ? speakCtx(it.w) : speak(it.w), 250); later(() => $('answer') && $('answer').focus({ preventScroll: true }), 300);
}

function checkTyped(ptsFn) {
  const s = S.sess, it = s.cur, val = $('answer').value;
  if (s.locked) return;
  if (!normAnswer(val)) { feedback(null, 'Écris d’abord ta réponse 🙂'); return; }
  s.locked = true; const ok = sameWord(val, it.w), pts = ptsFn();
  $('w').innerHTML = colorWord(it); $('h2').textContent = ok ? 'C’est exactement ça !' : 'Observe bien les lettres en jaune.';
  feedback(ok, ok ? `${cheer()} Aucune faute ! +${pts} ⭐ 🎉` : 'Pas tout à fait… regarde :' + diffHTML(val, it.w));
  answer(ok, pts, { el: $('answer') });
  $('check').style.display = 'none'; const sh = $('show'); if (sh) sh.style.display = 'none';
  $('next').style.display = ''; $('next').focus({ preventScroll: true });
}

function renderCards() {
  const s = S.sess, it = s.cur;
  V().innerHTML = playHead() + `<div class="card">${hintLine(it)}<div class="word" id="w">🎧 Écoute et réfléchis…</div><div class="hint" id="h2">Épelle le mot dans ta tête. Il apparaîtra dans 5 secondes.</div><div class="actions"><button class="btn yellow" id="listen">🔊 Réécouter</button><button class="btn" id="flip">👀 Voir tout de suite</button>${ctxBtn(it)}</div></div>
  <div class="actions"><button class="btn yellow" id="again">🔁 Je me suis trompé</button><button class="btn green" id="know">⭐ Je le savais !</button></div><div class="feedback" id="fb"></div>`;
  const show = () => { $('w').innerHTML = colorWord(it); $('h2').textContent = 'Avais-tu la bonne orthographe ?'; $('flip').disabled = true; };
  $('listen').onclick = () => speak(it.w); $('flip').onclick = show; bindCtx(it);
  speak(it.w); later(show, 5000);
  const done = (ok, el) => { if (s.locked) return; s.locked = true; show(); feedback(ok, ok ? '+5 ⭐, bien joué !' : 'Pas grave : tu la reverras bientôt !'); answer(ok, 5, { el }); later(() => nextItem(), 900); };
  $('again').onclick = () => done(false); $('know').onclick = e => done(true, e.currentTarget);
}

function sessionEnd() {
  const s = S.sess, pct = s.good / s.total;
  logSession(s.mode, s.good, s.total);
  if (s.good === s.total) gain(30);
  if (pct >= .8) { confetti(); Sfx.play('win'); }
  const stars = pct >= .9 ? '⭐⭐⭐' : pct >= .6 ? '⭐⭐' : '⭐';
  V().innerHTML = topBar(MODE_TITLES[s.mode] + ' · bilan') + `<div class="bigscore">${s.good}/${s.total}</div><p class="center" style="font-size:2rem;margin:0">${stars}</p>
  <p class="center"><b>${pct === 1 ? 'Sans faute ! Bonus +30 ⭐' : pct >= .8 ? 'Superbe série !' : pct >= .5 ? 'Bien joué, continue comme ça !' : 'Chaque essai te fait progresser 💪'}</b></p>
  ${s.missed.length && s.mode !== 'hunt' ? `<h3>🔁 Les mots à retravailler</h3><div class="wchips">${s.missed.map(m => `<button class="wchip weak" data-say="${esc(m.w)}">${colorWord(m)}</button>`).join('')}</div>` : ''}
  <div class="actions"><button class="btn primary" id="again">Rejouer ➜</button>${s.missed.length && s.mode !== 'hunt' ? '<button class="btn yellow" id="redo">Retravailler ces mots</button>' : ''}<button class="btn" data-back>Menu</button></div>`;
  freshView(); keepPanelInView();
  say(pct >= .8 ? `Waouh ${data.settings.childName}, quelle session !` : 'On continue ? Je grandis à chaque mot !');
  $('again').onclick = () => startSession(s.mode);
  if ($('redo')) $('redo').onclick = () => { const pool = s.missed.map(m => ({ ...m, retry: false })); startSession('audio', pool); S.sess.total = Math.max(pool.length * 2, 4); };
  checkBadges();
}

/* ============ Défi chronométré ============ */
function startChallenge() {
  const pool = scopePool(); if (pool.length < 2) { toast('Il faut au moins 2 mots pour le défi.'); return; }
  stopAll(); S.view = 'challenge'; const secs = data.settings.challengeSeconds;
  S.ch = { pool, secs, score: 0, count: 0, missed: [], retry: [], recent: [], running: false, cur: null, locked: false };
  const best = prog.best['ch' + secs] || 0;
  V().innerHTML = topBar('⏱️ Défi chronométré') + `<div class="card"><div class="word">⏱️ ${secs} s</div><p>Écoute chaque mot et touche la bonne orthographe le plus vite possible !</p><p class="muted">🏆 Ton record : <b>${best}</b></p></div><div class="actions"><button class="btn primary" id="start">C'est parti ! 🚀</button></div>`;
  freshView(); keepPanelInView();
  $('start').onclick = () => {
    speak('Prêt ?'); let n = 3;
    const step = () => { if (n === 0) return runChallenge(); Sfx.play('tick'); V().innerHTML = topBar('⏱️ Défi chronométré') + `<div class="count">${n}</div>`; n--; later(step, 800); };
    step();
  };
}
function runChallenge() {
  const c = S.ch; c.running = true; c.end = Date.now() + c.secs * 1000; let lastSec = c.secs;
  S.timer = setInterval(() => {
    const left = Math.max(0, c.end - Date.now()), t = $('timer'), tl = $('tleft'), sec = Math.ceil(left / 1000);
    if (t) t.style.width = (left / (c.secs * 1000) * 100) + '%'; if (tl) tl.textContent = sec + ' s';
    if (sec !== lastSec) { lastSec = sec; if (sec <= 5 && sec > 0) Sfx.play('tick'); }
    if (left <= 0) endChallenge();
  }, 200);
  chNext();
}
function chNext() {
  const c = S.ch; if (!c.running) return;
  c.cur = pick(c); c.locked = false; const it = c.cur, ch = shuffle(makeChoices(it.w));
  const left = Math.max(0, c.end - Date.now());
  V().innerHTML = topBar('⏱️ Défi', `⏳ <span id="tleft">${Math.ceil(left / 1000)} s</span> · ✅ ${c.score}`) + `<div class="progress timer"><span id="timer" style="width:${left / (c.secs * 1000) * 100}%"></span></div>
  <div class="card">${hintLine(it)}<div class="word">🔊</div><div class="actions"><button class="btn yellow" id="listen">🔊 Réécouter</button></div></div>
  <div class="options" id="opts">${ch.map(x => `<button class="option">${esc(x)}</button>`).join('')}</div><div class="feedback" id="fb"></div>`;
  keepPanelInView();
  $('listen').onclick = () => speak(it.w); speak(it.w);
  [...$('opts').children].forEach(b => b.onclick = () => {
    if (c.locked || !c.running) return; c.locked = true; const ok = b.textContent === it.w;
    b.classList.add(ok ? 'correct' : 'wrong'); if (!ok) [...$('opts').children].find(x => x.textContent === it.w).classList.add('correct');
    record(it.w, ok); streakUpdate(ok); updateHeader(); c.count++; c.recent.push(it.w); Sfx.play(ok ? 'good' : 'bad');
    if (ok) c.score++; else { c.retry.push({ item: it, due: c.count + 3 }); if (!c.missed.some(m => m.w === it.w)) c.missed.push(it); }
    feedback(ok, ok ? '✅' : 'C’était : <b>' + colorWord(it) + '</b>');
    later(chNext, ok ? 450 : 1300);
  });
}
function endChallenge() {
  const c = S.ch; if (!c.running) return; stopAll();
  const key = 'ch' + c.secs, old = prog.best[key] || 0, rec = c.score > old;
  if (rec) prog.best[key] = c.score;
  logSession('challenge', c.score, c.count); maxDaily('chal', c.score);
  if (rec && c.score > 0) { confetti(); Sfx.play('win'); }
  V().innerHTML = topBar('⏱️ Défi terminé !') + `<div class="bigscore" id="score">${c.score}</div><p class="center"><b>mot${c.score > 1 ? 's' : ''} trouvé${c.score > 1 ? 's' : ''} en ${c.secs} secondes</b></p>
  <p class="center">${rec ? `🏆 Nouveau record ! (ancien : ${old}) · bonus +25 ⭐` : `🏆 Record à battre : ${old}`}</p>
  ${c.missed.length ? `<h3>🔁 À revoir</h3><div class="wchips">${c.missed.map(m => `<button class="wchip weak" data-say="${esc(m.w)}">${colorWord(m)}</button>`).join('')}</div>` : ''}
  <div class="actions"><button class="btn primary" id="again">Rejouer ⚡</button><button class="btn" data-back>Menu</button></div>`;
  gain(c.score * 5 + (rec ? 25 : 0), $('score')); checkBadges();
  say(rec ? 'Nouveau record, trop fort !' : 'Encore un essai pour battre le record ?');
  $('again').onclick = startChallenge;
}

/* ============ Dictée complète ============ */
function startDictation(kind) {
  let items;
  if (kind === 'words') { const pool = scopePool(); items = weightedSample(pool, Math.min(data.settings.dictationLength, pool.length)); }
  else items = shuffle([...new Set(scopePhrases())]).slice(0, 5).map(p => ({ w: p, k: '', src: 'Phrase' }));
  if (!items.length) { toast(kind === 'words' ? 'Aucun mot dans cette sélection.' : 'Pas encore de phrases pour cette sélection : ajoute-en dans Réglages.'); return; }
  stopAll(); S.view = 'dict'; S.dict = { kind, items, i: 0, answers: [] }; renderDict(true);
}
function renderDict(first) {
  stopAll(); const d = S.dict, it = d.items[d.i], phrase = d.kind === 'phrases', last = d.i === d.items.length - 1;
  V().innerHTML = topBar('📝 Dictée complète', `${phrase ? 'Phrase' : 'Mot'} ${d.i + 1}/${d.items.length}`) + bar(d.i / d.items.length * 100) + `
  <div class="card"><div class="hint">${phrase ? 'Écoute toute la phrase, puis écris-la. N’oublie pas la majuscule et le point !' : esc(it.src) + (it.k ? ' · ' + KINDS[it.k] : '')}</div><div class="word">🎧</div>
  <div class="actions"><button class="btn yellow" id="listen">🔊 Écouter</button><button class="btn" id="slow">🐢 ${phrase ? 'Mot à mot' : 'Plus lentement'}</button>${phrase ? '' : ctxBtn(it)}</div></div>
  ${inputHTML(phrase ? 'Écris la phrase…' : 'Écris le mot…', phrase)}<div class="feedback" id="fb"></div>
  <div class="actions">${d.i > 0 ? '<button class="btn" id="prev">⬅ Précédent</button>' : ''}<button class="btn primary" id="nextD">${last ? 'Terminer et corriger ✓' : 'Suivant ➜'}</button></div>`;
  freshView(); if (first) window.scrollTo({ top: Math.max(0, V().getBoundingClientRect().top + window.scrollY - 8), behavior: 'smooth' }); else keepPanelInView();
  const inp = $('answer'); inp.value = d.answers[d.i] || '';
  $('listen').onclick = () => speak(it.w); $('slow').onclick = () => phrase ? speakSlow(it.w) : speak(it.w, data.settings.rate * 0.65); bindCtx(it);
  const go2 = dir => { d.answers[d.i] = inp.value; if (dir > 0 && !normAnswer(inp.value)) { feedback(null, 'Écris quelque chose avant de continuer 🙂'); return; } Sfx.play('tap'); d.i += dir; if (d.i >= d.items.length) finishDict(); else renderDict(); };
  $('nextD').onclick = () => go2(1); if ($('prev')) $('prev').onclick = () => go2(-1);
  inp.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); go2(1); } });
  later(() => speak(it.w), 300); later(() => inp.focus({ preventScroll: true }), 350);
}
function finishDict() {
  const d = S.dict, phrase = d.kind === 'phrases'; let good = 0, xp = 0, totalErr = 0;
  const rows = d.items.map((it, i) => {
    const a = d.answers[i] || '';
    if (!phrase) {
      const ok = sameWord(a, it.w); record(it.w, ok); if (ok) { good++; xp += 20; }
      return `<li class="${ok ? 'ok' : ''}">${ok ? '✅' : '❌'} <b>${colorWord(it)}</b> <button class="btn small yellow" data-say="${esc(it.w)}">🔊</button>${ok ? '' : diffHTML(a, it.w)}</li>`;
    }
    const r = comparePhrase(a, it.w); totalErr += r.errors; if (r.ok) { good++; xp += 40; } xp += Math.max(0, r.words - r.errors) * 2;
    return `<li class="${r.ok ? 'ok' : ''}">${r.ok ? '✅' : '❌ ' + r.errors + ' faute' + (r.errors > 1 ? 's' : '')} <button class="btn small yellow" data-say="${esc(it.w)}">🔊</button>${diffHTML(a, it.w, true)}${r.notes.length ? `<div class="muted small">✏️ Pense ${r.notes.join(' et ')}.</div>` : ''}</li>`;
  });
  const n = d.items.length, perfect = good === n;
  streakUpdate(perfect); logSession(phrase ? 'dictPhrases' : 'dictWords', good, n); bumpDaily('dict');
  if (perfect) { xp += 50; bumpCounter('perfectDict'); confetti(); Sfx.play('win'); } else Sfx.play(good / n >= .6 ? 'good' : 'bad');
  V().innerHTML = topBar('📝 Correction de la dictée') + `<div class="bigscore" id="score">${good}/${n}</div>
  <p class="center"><b>${phrase ? (totalErr === 0 ? 'Aucune faute, bravo ! 🏆' : `${totalErr} faute${totalErr > 1 ? 's' : ''} au total`) : perfect ? 'Dictée parfaite ! 🏆' : `${n - good} mot${n - good > 1 ? 's' : ''} à revoir`}</b> · +${xp} ⭐</p>
  <ul class="result-list">${rows.join('')}</ul>
  <div class="actions"><button class="btn primary" id="again">Nouvelle dictée</button><button class="btn" data-back>Menu</button></div>`;
  freshView(); keepPanelInView(); gain(xp, $('score')); checkBadges();
  say(perfect ? 'Une dictée parfaite !' : 'Regarde bien les lettres en jaune 👀');
  $('again').onclick = () => startDictation(d.kind);
}

/* ============ Mes listes (vue enfant) ============ */
let listPeriod = null;
function renderLists() {
  if (!listPeriod || !data.periods.some(p => p.id === listPeriod)) listPeriod = data.current.period;
  const p = data.periods.find(x => x.id === listPeriod), cw = curWeek();
  const chip = it => `<button class="wchip ${status(it.w)}" data-say="${esc(it.w)}">${colorWord(it)}</button>`;
  V().innerHTML = `<h2>📋 Mes listes de mots</h2><p class="muted">Touche un mot pour l’écouter. Les terminaisons des verbes sont en <span class="end">rouge</span>.</p>
  <div class="chips">${data.periods.map(pp => `<button class="chip ${pp.id === listPeriod ? 'selected' : ''}" data-lp="${pp.id}">${esc(pp.name)}</button>`).join('')}</div>
  <div class="legend"><span class="wchip">pas encore vu</span><span class="wchip learning">en cours</span><span class="wchip weak">à retravailler</span><span class="wchip ok">maîtrisé</span></div>
  <div class="listgrid">${p.weeks.map((w, i) => `<div class="listbox ${w.id === cw.id ? 'current' : ''}" style="border-left-color:${['#ff9b54', '#ed80ad', '#64b77b', '#e45d54', '#f5a044', '#5ba8e3', '#9b7be8'][i % 7]}">
    <strong>Semaine ${i + 1} · ${esc(w.title)}${w.id === cw.id ? ' 📍' : ''}</strong><div class="wchips">${w.words.map(chip).join('')}</div>
    ${w.phrases.length ? `<p class="phr">${w.phrases.map(esc).join('<br>')}</p>` : ''}</div>`).join('')}
    <div class="listbox" style="border-left-color:#f5a044"><strong>✨ Mots invariables « Pas touche ! »</strong><div class="wchips">${invItems().map(chip).join('')}</div></div>
  </div>`;
  V().querySelectorAll('[data-lp]').forEach(b => b.onclick = () => { listPeriod = b.dataset.lp; renderLists(); });
}

/* ============ Progrès ============ */
const MODE_NAMES = { quiz: '🎯 Quiz', spell: '✍️ Écris', audio: '🔊 Audio', cards: '🃏 Cartes', challenge: '⏱️ Défi', dictWords: '📝 Dictée mots', dictPhrases: '📝 Dictée phrases', pieces: '🧩 Morceaux', missing: '🔤 Lettre', tri: '📦 Tri', hunt: '🔎 Chasse', boss: '⚔️ Boss' };
function renderStats() {
  const p = curPeriod(), pool = scopePool({ type: 'period' }), mastered = pool.filter(x => status(x.w) === 'ok').length;
  const days = Object.keys(prog.days).length, L = level(prog.xp);
  const last7 = [...Array(7)].map((_, i) => { const d = new Date(); d.setDate(d.getDate() - 6 + i); const k = dayKey(d); return { l: d.toLocaleDateString('fr-FR', { weekday: 'short' }), n: (prog.days[k] || {}).n || 0 }; });
  const max7 = Math.max(5, ...last7.map(x => x.n));
  const hard = Object.entries(prog.words).filter(([, v]) => v.ko > 0 && v.box < 4).sort((a, b) => (b[1].ko - b[1].ok / 2) - (a[1].ko - a[1].ok / 2)).slice(0, 10);
  V().innerHTML = `<h2>📊 Les progrès de ${esc(data.settings.childName)}</h2>
  <div class="tiles"><div class="tile"><b>${mastered}/${pool.length}</b>mots maîtrisés (${esc(p.name)})</div><div class="tile"><b>${L}</b>niveau de ${esc(data.settings.buddyName)}</div><div class="tile"><b>${days}</b>jour${days > 1 ? 's' : ''} d’entraînement</div><div class="tile"><b>${prog.bestStreak}</b>meilleure série de bonnes réponses</div></div>
  <div class="section"><h3>📅 Semaine par semaine (${esc(p.name)})</h3>${p.weeks.map((w, i) => { const n = w.words.length, ok = w.words.filter(x => status(x.w) === 'ok').length; return `<div class="wbar"><span>S${i + 1} · ${esc(w.title)}</span><div class="track"><span style="width:${n ? ok / n * 100 : 0}%"></span></div><b>${ok}/${n}</b></div>`; }).join('')}
  <div class="wbar"><span>✨ Invariables</span><div class="track"><span style="width:${data.invariants.length ? data.invariants.filter(w => status(w) === 'ok').length / data.invariants.length * 100 : 0}%"></span></div><b>${data.invariants.filter(w => status(w) === 'ok').length}/${data.invariants.length}</b></div>
  <p class="muted small">Un mot est « maîtrisé » ⭐ après 4 bonnes réponses d’affilée.</p></div>
  <div class="section"><h3>🗓️ Les 7 derniers jours</h3><div class="week7">${last7.map(x => `<div><span>${x.n || ''}</span><i style="height:${x.n / max7 * 80}%"></i>${esc(x.l)}</div>`).join('')}</div></div>
  <div class="section"><h3>🧩 Les mots les plus difficiles</h3>${hard.length ? `<div class="wchips">${hard.map(([k, v]) => `<button class="wchip weak" data-say="${esc(k)}">${esc(k)} · ${v.ko}✗</button>`).join('')}</div>` : '<p class="muted">Pas encore d’erreurs enregistrées. 👍</p>'}</div>
  <div class="section"><h3>🕑 Dernières sessions</h3>${prog.sessions.length ? `<ul class="result-list">${prog.sessions.slice(0, 10).map(x => `<li>${new Date(x.d).toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short' })} · ${MODE_NAMES[x.m] || x.m} · <b>${x.m === 'boss' ? (x.s ? 'victoire 🏆' : 'perdu') : x.s + '/' + x.t}</b> <span class="muted small">(${esc(x.sc || '')})</span></li>`).join('')}</ul>` : '<p class="muted">Aucune session pour l’instant.</p>'}</div>`;
}

/* ============ Réglages (espace parents) ============ */
const kindOpts = k => Object.entries(KINDS).map(([v, l]) => `<option value="${v}" ${v === k ? 'selected' : ''}>${l}</option>`).join('');
function recPanelHTML(w) {
  const rows = [...w.words.map(x => x.w), ...w.phrases];
  return `<div class="recpanel"><p class="muted small">🎙️ Touche « Enregistrer », dis le mot (ou la phrase), puis « Stop ». Ta voix remplacera la voix de synthèse. Les enregistrements restent sur cet appareil.</p>
    ${rows.map(t => `<div class="recrow" data-t="${esc(t)}"><span>${esc(t)}</span><span class="recbtns">${Voice.exists(t) ? '<button class="btn small yellow" data-r="play">▶️</button>' : ''}<button class="btn small ${Voice.rec && Voice.rec.t === t ? 'danger' : 'primary'}" data-r="rec">${Voice.rec && Voice.rec.t === t ? '⏹️ Stop' : Voice.exists(t) ? '🎙️ Refaire' : '🎙️ Enregistrer'}</button>${Voice.exists(t) ? '<button class="iconbtn" data-r="del" title="Supprimer">🗑️</button>' : ''}</span></div>`).join('')}</div>`;
}
function renderSettings() {
  const st = data.settings;
  if (st.parentGate && !S.parentOk) {
    const a = 3 + rand(7), b = 3 + rand(7);
    V().innerHTML = `<h2>⚙️ Espace parents</h2><p class="muted">Pour modifier les listes et les réglages, réponds à cette question :</p><label>Combien font ${a} × ${b} ?<input id="gate" type="number" inputmode="numeric" style="max-width:160px"></label><div class="feedback" id="fb"></div><div class="actions left"><button class="btn primary" id="gateOk">Entrer</button></div>`;
    const ok = () => { if (+$('gate').value === a * b) { S.parentOk = true; renderSettings(); } else feedback(false, 'Ce n’est pas ça 🙂'); };
    $('gateOk').onclick = ok; $('gate').addEventListener('keydown', e => { if (e.key === 'Enter') ok(); }); return;
  }
  if (!S.editPeriod || !data.periods.some(p => p.id === S.editPeriod)) S.editPeriod = data.current.period;
  const ep = data.periods.find(p => p.id === S.editPeriod), cp = curPeriod(), cw = curWeek();
  const sel = (id, vals, cur, fmt = v => v) => `<select id="${id}">${vals.map(v => `<option value="${v}" ${v == cur ? 'selected' : ''}>${fmt(v)}</option>`).join('')}</select>`;
  V().innerHTML = `<h2>⚙️ Réglages <span class="muted small">(espace parents)</span></h2>
  <div class="setgroup"><h3>📍 Où en est ${esc(st.childName)} ?</h3><div class="row">
    <label>Période<select id="curP">${data.periods.map(p => `<option value="${p.id}" ${p.id === cp.id ? 'selected' : ''}>${esc(p.name)}</option>`).join('')}</select></label>
    <label>Semaine en cours<select id="curW">${cp.weeks.map((w, i) => `<option value="${w.id}" ${w.id === cw.id ? 'selected' : ''}>Semaine ${i + 1} · ${esc(w.title)}</option>`).join('')}</select></label>
    <label>Date de la dictée bilan<input type="date" id="curBilan" value="${esc(cp.bilan || '')}"></label></div>
    <p class="muted small">« Semaine » est la révision proposée par défaut ; « Toute la période » prépare la dictée bilan. La date sert au compte à rebours, et le boss se réveille 14 jours avant.</p></div>
  <div class="setgroup"><h3>🧒 Profil</h3><div class="row"><label>Prénom<input id="sName" value="${esc(st.childName)}"></label><label>Nom du compagnon<input id="sBuddy" value="${esc(st.buddyName)}"></label></div></div>
  <div class="setgroup"><h3>🔊 Voix et sons</h3><div class="row">
    <label>Voix française<select id="sVoice"><option value="">Automatique${bestVoice() ? ' (' + esc(bestVoice().name) + ')' : ''}</option>${voices.map(v => `<option value="${esc(v.name)}" ${v.name === st.voice ? 'selected' : ''}>${esc(v.name)} (${esc(v.lang)})</option>`).join('')}</select></label>
    <label>Vitesse : <span id="rateVal">${st.rate}</span><input type="range" id="sRate" min="0.5" max="1.2" step="0.05" value="${st.rate}"></label></div>
    <button class="btn yellow small" id="testVoice">🔊 Tester : « nous envoyions »</button>${voices.length ? '' : '<p class="muted small">Aucune voix française détectée pour l’instant (elles peuvent mettre quelques secondes à charger).</p>'}
    <label class="check"><input type="checkbox" id="sSounds" ${st.sounds ? 'checked' : ''}> Petits sons du jeu (bonne réponse, erreur, niveau…)</label>
    <label class="check"><input type="checkbox" id="sRecOn" ${st.useRecordings ? 'checked' : ''}> Utiliser mes enregistrements quand ils existent (${Voice.keys.size} enregistré${Voice.keys.size > 1 ? 's' : ''})</label></div>
  <div class="setgroup"><h3>🎮 Exercices</h3>
    <label class="check"><input type="checkbox" id="sInvOn" ${st.includeInvariants ? 'checked' : ''}> Ajouter les mots invariables aux révisions de semaine / période</label>
    <div class="row"><label>Mots par entraînement${sel('sLen', [5, 10, 15, 20], st.sessionLength)}</label><label>Mots dans la dictée complète${sel('sDict', [5, 10, 15, 20, 30], st.dictationLength)}</label><label>Durée du défi${sel('sCh', [45, 60, 90, 120], st.challengeSeconds, v => v + ' secondes')}</label></div>
    <label class="check"><input type="checkbox" id="sBoss" ${st.bossUnlocked ? 'checked' : ''}> Débloquer le boss tout de suite</label>
    <label class="check"><input type="checkbox" id="sGate" ${st.parentGate ? 'checked' : ''}> Protéger les réglages par une multiplication</label></div>
  <div class="setgroup"><h3>📚 Listes de mots</h3>
    <div class="chips">${data.periods.map(p => `<button class="chip ${p.id === ep.id ? 'selected' : ''}" data-ep="${p.id}">${esc(p.name)}</button>`).join('')}<button class="chip" id="addPeriod">➕ Nouvelle période</button></div>
    <div class="row"><label>Nom de la période<input id="pName" value="${esc(ep.name)}"></label><label>Date de sa dictée bilan<input type="date" id="pBilan" value="${esc(ep.bilan || '')}"></label></div>
    ${ep.weeks.map((w, i) => `<details class="week" data-w="${w.id}" ${S.openWeeks.has(w.id) ? 'open' : ''}><summary>Semaine ${i + 1} · ${esc(w.title)} <span class="muted small">(${w.words.length} mots, ${w.phrases.length} phrases)</span></summary>
      <label>Titre<input data-f="title" value="${esc(w.title)}"></label>
      <div class="muted small">Mot · type · infinitif (verbes) · phrase indice (pour les mots qui se prononcent pareil)</div>
      ${w.words.map((x, j) => `<div class="wordrow" data-j="${j}"><input data-f="w" value="${esc(x.w)}"><select data-f="k">${kindOpts(x.k)}</select><input data-f="h" placeholder="infinitif" value="${esc(x.h || '')}"><input data-f="ctx" placeholder="phrase indice" value="${esc(ctxOf(x.w))}"><button class="iconbtn" data-a="delw" title="Supprimer">🗑️</button></div>`).join('')}
      <div class="addrow"><textarea data-f="bulk" rows="2" placeholder="Ajouter des mots : un par ligne"></textarea><select data-f="bulkK">${kindOpts('nom')}</select><input data-f="bulkH" placeholder="infinitif"><button class="btn green small" data-a="addw">➕ Ajouter</button></div>
      <label>Phrases de dictée (une par ligne)<textarea data-f="phrases" rows="3">${esc(w.phrases.join('\n'))}</textarea></label>
      <div class="actions left"><button class="btn small yellow" data-a="rec">🎙️ ${S.recWeek === w.id ? 'Fermer les enregistrements' : 'Enregistrer ma voix'}</button><button class="btn small" data-a="up">⬆️ Monter</button><button class="btn small" data-a="down">⬇️ Descendre</button><button class="btn small danger" data-a="delweek">Supprimer la semaine</button></div>
      ${S.recWeek === w.id ? recPanelHTML(w) : ''}</details>`).join('')}
    <div class="actions left"><button class="btn green" id="addWeek">➕ Ajouter une semaine</button>${data.periods.length > 1 ? '<button class="btn danger small" id="delPeriod">Supprimer cette période</button>' : ''}</div></div>
  <div class="setgroup"><h3>✨ Mots invariables (« Pas touche ! »)</h3><textarea id="sInv" rows="4" style="width:100%">${esc(data.invariants.join('\n'))}</textarea><p class="muted small">Un mot par ligne (ou séparés par des virgules).</p>
    <div class="actions left"><button class="btn small yellow" id="recInv">🎙️ ${S.recWeek === 'inv' ? 'Fermer les enregistrements' : 'Enregistrer ma voix'}</button></div>${S.recWeek === 'inv' ? recPanelHTML({ words: data.invariants.map(w => ({ w })), phrases: [] }) : ''}</div>
  <div class="setgroup"><h3>💾 Sauvegarde</h3><p class="muted small">Les listes et la progression sont enregistrées sur cet appareil. Exporte une sauvegarde pour les transférer sur une autre tablette (les enregistrements de voix ne sont pas inclus).</p>
    <div class="actions left"><button class="btn" id="exp">⬇️ Exporter</button><label class="btn" style="margin:0;flex-direction:row">⬆️ Importer<input type="file" id="imp" accept=".json,application/json" hidden></label>${S.installEvt ? '<button class="btn primary" id="install">📲 Installer l’application</button>' : ''}</div>
    <div class="actions left"><button class="btn danger small" id="resetLists">Remettre les listes d’origine</button><button class="btn danger small" id="resetProg">Effacer la progression</button></div></div>`;
  bindSettings(ep);
}
async function recAction(row, act) {
  const t = row.dataset.t;
  if (act === 'play') return Voice.play(t);
  if (act === 'del') { if (!confirm(`Supprimer l’enregistrement de « ${t} » ?`)) return; await Voice.del(t); return renderSettings(); }
  if (Voice.rec) { const same = Voice.rec.t === t; Voice.stopRec(); if (same) return; }
  try {
    Voice.onchange = () => { if (S.view === 'settings') renderSettings(); };
    const blob = await Voice.start(t.split(' ').length > 3 ? 12000 : 6000, t);
    if (blob && blob.size > 500) { await Voice.put(t, blob); toast('Enregistré ✅'); Voice.play(t); }
    renderSettings();
  } catch (e) { Voice.rec = null; toast('Micro indisponible : autorise le micro pour ce site.'); renderSettings(); }
}
function bindSettings(ep) {
  const st = data.settings, ch = (id, fn) => { const el = $(id); if (el) el.onchange = e => { fn(e.target); save(); updateHeader(); }; };
  ch('curP', t => { data.current.period = t.value; const p = curPeriod(); data.current.week = (p.weeks[0] || {}).id; S.editPeriod = t.value; renderSettings(); });
  ch('curW', t => data.current.week = t.value);
  ch('curBilan', t => { curPeriod().bilan = t.value; renderSettings(); });
  ch('sName', t => st.childName = t.value.trim() || 'Valentin'); ch('sBuddy', t => st.buddyName = t.value.trim() || 'Draco');
  ch('sVoice', t => st.voice = t.value); ch('sInvOn', t => st.includeInvariants = t.checked); ch('sGate', t => st.parentGate = t.checked);
  ch('sSounds', t => { st.sounds = t.checked; Sfx.play('good'); }); ch('sRecOn', t => st.useRecordings = t.checked); ch('sBoss', t => st.bossUnlocked = t.checked);
  ch('sLen', t => st.sessionLength = +t.value); ch('sDict', t => st.dictationLength = +t.value); ch('sCh', t => st.challengeSeconds = +t.value);
  $('sRate').oninput = e => { st.rate = +e.target.value; $('rateVal').textContent = st.rate; save(); };
  $('testVoice').onclick = () => speak('nous envoyions');
  ch('pName', t => { ep.name = t.value.trim() || ep.name; renderSettings(); });
  ch('pBilan', t => { ep.bilan = t.value; renderSettings(); });
  ch('sInv', t => { data.invariants = [...new Set(t.value.split(/[\n,]+/).map(s => s.trim()).filter(Boolean))]; });
  $('recInv').onclick = () => { S.recWeek = S.recWeek === 'inv' ? null : 'inv'; renderSettings(); };
  V().querySelectorAll('[data-ep]').forEach(b => b.onclick = () => { S.editPeriod = b.dataset.ep; renderSettings(); });
  $('addPeriod').onclick = () => { const p = { id: uid(), name: 'Période ' + (data.periods.length + 1), bilan: '', weeks: [{ id: uid(), title: 'Nouvelle liste', words: [], phrases: [] }] }; data.periods.push(p); S.editPeriod = p.id; S.openWeeks.add(p.weeks[0].id); save(); renderSettings(); };
  $('addWeek').onclick = () => { const w = { id: uid(), title: 'Nouvelle liste', words: [], phrases: [] }; ep.weeks.push(w); S.openWeeks.add(w.id); save(); renderSettings(); };
  if ($('delPeriod')) $('delPeriod').onclick = () => { if (!confirm(`Supprimer « ${ep.name} » et toutes ses semaines ?`)) return; data.periods = data.periods.filter(p => p !== ep); if (data.current.period === ep.id) { data.current.period = data.periods[0].id; data.current.week = (data.periods[0].weeks[0] || {}).id; } S.editPeriod = null; save(); updateHeader(); renderSettings(); };
  V().querySelectorAll('.recrow [data-r]').forEach(b => b.onclick = () => recAction(b.closest('.recrow'), b.dataset.r));
  V().querySelectorAll('details.week').forEach(det => {
    const w = ep.weeks.find(x => x.id === det.dataset.w);
    det.addEventListener('toggle', () => det.open ? S.openWeeks.add(w.id) : S.openWeeks.delete(w.id));
    det.addEventListener('change', e => {
      const f = e.target.dataset.f, row = e.target.closest('.wordrow');
      if (row) {
        const x = w.words[+row.dataset.j], v = e.target.value.trim();
        if (f === 'w') { if (v) { const c = ctxOf(x.w); if (c) { delete data.ctx[normAnswer(x.w)]; data.ctx[normAnswer(v)] = c; } x.w = v; } }
        else if (f === 'k') x.k = e.target.value;
        else if (f === 'h') { if (v) x.h = v; else delete x.h; }
        else if (f === 'ctx') { if (v) data.ctx[normAnswer(x.w)] = v; else delete data.ctx[normAnswer(x.w)]; }
      }
      else if (f === 'title') { w.title = e.target.value.trim() || w.title; save(); updateHeader(); return renderSettings(); }
      else if (f === 'phrases') w.phrases = e.target.value.split('\n').map(s => s.trim()).filter(Boolean);
      else return;
      save();
    });
    det.addEventListener('click', e => {
      const a = e.target.closest('[data-a]'); if (!a) return; const act = a.dataset.a, i = ep.weeks.indexOf(w);
      if (act === 'delw') w.words.splice(+a.closest('.wordrow').dataset.j, 1);
      else if (act === 'addw') {
        const txt = det.querySelector('[data-f=bulk]').value, k = det.querySelector('[data-f=bulkK]').value, h = det.querySelector('[data-f=bulkH]').value.trim();
        const list = txt.split('\n').map(s => s.trim()).filter(Boolean); if (!list.length) return toast('Écris au moins un mot.');
        list.forEach(v => w.words.push(h && k === 'verbe' ? { w: v, k, h } : { w: v, k }));
      }
      else if (act === 'rec') S.recWeek = S.recWeek === w.id ? null : w.id;
      else if (act === 'up' && i > 0) [ep.weeks[i - 1], ep.weeks[i]] = [ep.weeks[i], ep.weeks[i - 1]];
      else if (act === 'down' && i < ep.weeks.length - 1) [ep.weeks[i + 1], ep.weeks[i]] = [ep.weeks[i], ep.weeks[i + 1]];
      else if (act === 'delweek') { if (ep.weeks.length < 2) return toast('Une période garde au moins une semaine.'); if (!confirm(`Supprimer la semaine « ${w.title} » ?`)) return; ep.weeks.splice(i, 1); if (data.current.week === w.id) data.current.week = ep.weeks[0].id; }
      else return;
      save(); updateHeader(); renderSettings();
    });
  });
  $('exp').onclick = () => {
    const blob = new Blob([JSON.stringify({ app: 'mission-dictee', version: 5, exported: new Date().toISOString(), data, prog }, null, 2)], { type: 'application/json' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `mission-dictee-sauvegarde-${dayKey()}.json`; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  };
  $('imp').onchange = e => {
    const f = e.target.files[0]; if (!f) return; const r = new FileReader();
    r.onload = () => { try { const j = JSON.parse(r.result); if (!j.data || !Array.isArray(j.data.periods)) throw 0; if (!confirm('Remplacer les listes et la progression par cette sauvegarde ?')) return; data = migrateData(j.data); data.settings = Object.assign(defaultSettings(), data.settings || {}); if (j.prog) prog = fixProg(j.prog); save(); updateHeader(); renderSettings(); toast('Sauvegarde importée ✅'); } catch (err) { toast('Fichier de sauvegarde invalide.'); } };
    r.readAsText(f);
  };
  if ($('install')) $('install').onclick = async () => { S.installEvt.prompt(); await S.installEvt.userChoice; S.installEvt = null; renderSettings(); };
  $('resetLists').onclick = () => { if (!confirm('Remplacer toutes les listes par celles d’origine (périodes 1 et 2) ? La progression est conservée.')) return; const keep = data.settings; data = buildDefaultData(); data.settings = keep; S.editPeriod = null; save(); updateHeader(); renderSettings(); };
  $('resetProg').onclick = () => { if (!confirm('Effacer toute la progression (étoiles, pièces, badges, niveau, statistiques) ? Cette action est définitive.')) return; prog = newProg(); save(); updateHeader(); toast('Progression effacée.'); };
}

/* ============ Démarrage ============ */
document.querySelectorAll('.tab').forEach(b => b.onclick = () => go(b.dataset.view));
V().addEventListener('click', e => {
  if (e.target.closest('[data-back]')) { go('home'); return; }
  const s = e.target.closest('[data-say]'); if (s) speak(s.dataset.say);
});
document.addEventListener('pointerdown', e => {
  Sfx.ensure && data.settings.sounds && Sfx.ensure();
  // Clavier d'accents : insère la lettre sans faire perdre le focus au champ.
  const k = e.target.closest('.key'); if (!k) return; e.preventDefault();
  const inp = $('answer'); if (!inp) return;
  const a = inp.selectionStart ?? inp.value.length, b = inp.selectionEnd ?? a;
  inp.value = inp.value.slice(0, a) + k.dataset.k + inp.value.slice(b); inp.focus({ preventScroll: true }); inp.setSelectionRange(a + 1, a + 1);
});
$('buddy').onclick = () => { bounce(); const m = isSleepy() ? 'Hein ? Je dormais… on révise ?' : pickOne(BUDDY_TALK); say(m); speak(m); };
window.addEventListener('beforeinstallprompt', e => { e.preventDefault(); S.installEvt = e; });
if ('serviceWorker' in navigator && location.protocol.startsWith('http')) navigator.serviceWorker.register('sw.js').catch(() => {});
prog.bestDays = Math.max(prog.bestDays || 0, dayStreak());
save(); updateHeader(); go('home');
if (isSleepy()) say(`Zzz… ${data.settings.childName}, tu me réveilles avec un mot ?`);
else if (daily() && Object.keys(daily().c).length === 0) say(`Bonjour ${data.settings.childName} ! 3 nouvelles missions t’attendent.`);
Voice.init().then(() => { if (S.view === 'settings') renderSettings(); });
