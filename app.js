'use strict';
/* ============ Stockage ============ */
const DATA_KEY = 'missionDictee.data.v4', PROG_KEY = 'missionDictee.progress.v4';
const KINDS = { nom: 'Nom', verbe: 'Verbe', adjectif: 'Adjectif', invariable: 'Mot invariable', autre: 'Autre' };
const $ = id => document.getElementById(id);
const V = () => $('view');
const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const uid = () => Math.random().toString(36).slice(2, 9);
const rand = n => Math.floor(Math.random() * n);
const shuffle = a => { a = [...a]; for (let i = a.length - 1; i > 0; i--) { const j = rand(i + 1); [a[i], a[j]] = [a[j], a[i]]; } return a; };
const pickOne = a => a[rand(a.length)];

function loadJSON(k) { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : null; } catch (e) { return null; } }
let data = loadJSON(DATA_KEY) || buildDefaultData();
let prog = Object.assign({ words: {}, xp: 0, streak: 0, bestStreak: 0, best: {}, sessions: [], days: {} }, loadJSON(PROG_KEY) || {});
data.settings = Object.assign(defaultSettings(), data.settings || {});
function save() { try { localStorage.setItem(DATA_KEY, JSON.stringify(data)); localStorage.setItem(PROG_KEY, JSON.stringify(prog)); } catch (e) {} }

const S = { view: 'home', scope: { type: 'week' }, parentOk: false, editPeriod: null, openWeeks: new Set(), sess: null, ch: null, dict: null, timer: null, gen: 0, installEvt: null };

/* ============ Comparaison des réponses ============ */
function normAnswer(s) { return String(s).replace(/[’‘`´]/g, "'").replace(/\s*'\s*/g, "'").replace(/\s+/g, ' ').trim().toLocaleLowerCase('fr-FR'); }
const relax = s => s.replace(/î/g, 'i').replace(/û/g, 'u'); // rectifications de 1990 : maître = maitre
const strip = s => s.normalize('NFD').replace(/[̀-ͯ]/g, '');
function sameWord(a, b) { a = normAnswer(a); b = normAnswer(b); return a === b || relax(a) === relax(b); }
const tok = s => String(s).replace(/[’‘]/g, "'").replace(/[.,!?;:«»"]/g, ' ').split(/\s+/).filter(Boolean);
const tkey = t => relax(t.toLocaleLowerCase('fr-FR'));

function lcsOps(A, B, eq) {
  const n = A.length, m = B.length, dp = Array.from({ length: n + 1 }, () => new Array(m + 1).fill(0));
  for (let i = n - 1; i >= 0; i--) for (let j = m - 1; j >= 0; j--) dp[i][j] = eq(A[i], B[j]) ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]);
  const ops = []; let i = 0, j = 0;
  while (i < n && j < m) {
    if (eq(A[i], B[j])) { ops.push(['=', A[i], B[j]]); i++; j++; }
    else if (dp[i + 1][j] >= dp[i][j + 1]) ops.push(['-', A[i++]]);
    else ops.push(['+', B[j++]]);
  }
  while (i < n) ops.push(['-', A[i++]]);
  while (j < m) ops.push(['+', B[j++]]);
  return ops;
}
function diffHTML(ans, ref, byWord) {
  const clean = String(ans).replace(/[’‘]/g, "'").replace(/\s+/g, ' ').trim();
  const A = byWord ? tok(clean) : Array.from(clean), B = byWord ? tok(ref) : Array.from(ref);
  const eq = byWord ? (a, b) => tkey(a) === tkey(b) : (a, b) => tkey(a) === tkey(b);
  const ops = lcsOps(A, B, eq), sep = byWord ? ' ' : '';
  const top = ops.filter(o => o[0] !== '+').map(o => `<span class="${o[0] === '=' ? 'd-ok' : 'd-bad'}">${esc(o[1])}</span>`).join(sep) || '—';
  const bot = ops.filter(o => o[0] !== '-').map(o => o[0] === '=' ? `<span>${esc(o[2])}</span>` : `<span class="d-miss">${esc(o[1])}</span>`).join(sep);
  return `<div class="diff"><div><small>Tu as écrit :</small><div class="line">${top}</div></div><div><small>Il fallait écrire :</small><div class="line">${byWord ? esc(ref) : bot}</div></div></div>`;
}
function comparePhrase(ans, ref) {
  const ops = lcsOps(tok(ans), tok(ref), (a, b) => tkey(a) === tkey(b));
  const minus = ops.filter(o => o[0] === '-').length, plus = ops.filter(o => o[0] === '+').length;
  const errors = Math.max(minus, plus), a = ans.trim();
  const notes = [];
  if (/^[A-ZÀ-Ý]/.test(ref) && a && a[0] !== a[0].toLocaleUpperCase('fr-FR')) notes.push('à la majuscule au début');
  if (/[.!?]$/.test(ref.trim()) && !/[.!?]$/.test(a)) notes.push('au point à la fin');
  return { ok: errors === 0, errors, words: tok(ref).length, notes };
}

/* ============ Choix très proches pour le quiz ============ */
const CURATED = {
  "nous mémorisons": ["nous mémorisont", "nous mémorisson", "nous maimorisons"],
  "elle mémorise": ["elle mémorisse", "elle mémorize", "elle mémorises"],
  "ils mémorisent": ["ils mémorise", "ils mémoriscent", "ils mémorissent"],
  "nous calculons": ["nous calculont", "nous calculon", "nous calcullons"],
  "nous écrivons": ["nous écrivont", "nous écrivon", "nous écrrivons"],
  "nous soulignons": ["nous soulignont", "nous soulignon", "nous soullignons"],
  "nous entourons": ["nous entouront", "nous entouron", "nous enttourons"],
  "ils feront": ["ils ferons", "ils ferontt", "ils feron"],
  "elle fera": ["elle feras", "elle faira", "elle ferra"],
  "elle écrira": ["elle écriras", "elle écrirra", "elle écrira"],
  "il est": ["il et", "il es", "ils est"],
  "c'est": ["ses", "s'est", "cest"],
  "il a": ["il à", "ils a", "il as"],
  "ils écrivent": ["ils écrive", "ils écriventt", "ils écrives"],
  "elle note": ["elle notes", "elle notte", "elles note"],
  "la rentrée": ["la rentré", "la rentrèe", "les rentrée"],
  "le français": ["le francais", "les français", "le françai"],
  "les mathématiques": ["les mathématique", "les mathémathiques", "les mathématiqes"],
  "à": ["a", "as", "â"], "là": ["la", "làa", "las"], "déjà": ["déja", "déjàa", "desjà"],
  "jusqu'à": ["jusqu'a", "jusqua", "jusqu'àa"], "en": ["an", "ens", "ent"], "entre": ["entrent", "antre", "entres"],
  "encore": ["encor", "encorre", "ancore"], "ensuite": ["ensuitte", "ensuitee", "ansuite"], "enfin": ["en fin", "enfain", "anfin"],
  "comme": ["come", "commes", "comm"], "comment": ["coment", "commant", "commen"], "vraiment": ["vraiement", "vraimant", "vraimment"],
  "souvent": ["souvan", "souvant", "souvents"], "mais": ["mes", "mai", "mait"], "jamais": ["jamai", "jammais", "jamait"], "bien": ["biens", "bient", "bein"],
  "nous envoyions": ["nous envoyons", "nous envoyiont", "nous envoiions"],
  "j'aimais": ["jaimais", "j'aimait", "j'émais"], "les émotions": ["les émotion", "les émossions", "les émotiont"],
  "ses amis": ["ses ami", "ses amies", "sais amis"], "mes amis": ["mes ami", "mé amis", "mes amie"],
  "il y a": ["il i a", "il y à", "il ya"], "joyeux": ["joyeu", "joyeus", "joieux"], "joyeuse": ["joyeuze", "joieuse", "joyeuses"],
  "la joie": ["la joi", "la joix", "la joies"], "forte": ["forre", "fortes", "fort"]
};
function makeChoices(word) {
  const out = [];
  const add = s => { if (!s) return; s = s.replace(/\s+/g, ' ').trim(); if (!s || sameWord(s, word) || out.some(x => sameWord(x, s))) return; out.push(s); };
  const R = (re, to) => { if (re.test(word)) add(word.replace(re, to)); };
  // Terminaisons des verbes
  R(/ons$/, 'ont'); R(/ont$/, 'ons'); R(/ent$/, 'e'); R(/ent$/, 'es'); R(/ent$/, 'ant');
  R(/ais$/, 'ait'); R(/ais$/, 'ai'); R(/ais$/, 'é'); R(/ait$/, 'ais'); R(/ait$/, 'è'); R(/ait$/, 'aient');
  R(/aient$/, 'ait'); R(/aient$/, 'ais'); R(/aient$/, 'ent'); R(/ions$/, 'iont'); R(/ions$/, 'ion'); R(/yions$/, 'yons');
  R(/iez$/, 'ier'); R(/iez$/, 'ié'); R(/ez$/, 'er'); R(/ez$/, 'é'); R(/eons$/, 'ons'); R(/era$/, 'eras'); R(/ira$/, 'iras');
  if (/^tu .*s$/.test(word)) add(word.replace(/s$/, ''));
  if (/^(je|il|elle|on) .*e$/.test(word)) { add(word + 's'); add(word + 'nt'); }
  if (/^(il|elle) /.test(word)) add(word.replace(/^(il|elle) /, '$1s '));
  // Noms : pluriel et déterminants
  if (/^(des|les|mes|ses|tes|nos|vos) /.test(word)) { add(word.replace(/[sx]$/, '')); R(/x$/, 's'); if (!/[sx]$/.test(word)) add(word + 's'); }
  else if (/^(un|une|le|la|l'|du|mon|ton|son|notre) ?/.test(word) && /\s/.test(word)) { add(word + 's'); R(/^(un|une) /, 'des '); R(/^(le|la) /, 'les '); }
  R(/eau$/, 'o'); R(/eaux$/, 'eaus'); R(/ée$/, 'é');
  // Accents, sons et consonnes : seulement sur le dernier mot (pas sur « une », « des », « il »…)
  const sp = word.lastIndexOf(' '), head = word.slice(0, sp + 1), tail = word.slice(sp + 1);
  const RL = (re, to) => { if (re.test(tail)) add(head + tail.replace(re, to)); };
  RL(/é/, 'è'); RL(/é/, 'e'); RL(/è/, 'é'); RL(/è/, 'ai'); RL(/ê/, 'è'); RL(/ê/, 'e'); RL(/â/, 'a'); RL(/ç/, 'c'); RL(/ai/, 'é'); RL(/ai/, 'è');
  RL(/([aeiouyéèê])s([aeiouyéèê])/, '$1z$2'); RL(/([aeiouyéè])s([aeiouyéè])/, '$1ss$2'); RL(/ss/, 's'); RL(/([aeiouéè])c([eiéè])/, '$1ss$2');
  RL(/([bcdfglmnprt])\1/, '$1'); RL(/([aeiouéè])([fmnlrt])([aeiouéè])/, '$1$2$2$3');
  RL(/an/, 'en'); RL(/en/, 'an'); RL(/au/, 'o'); RL(/qu/, 'k'); RL(/ph/, 'f'); R(/'/, '');
  if (/[tdsx]$/.test(word)) add(word.slice(0, -1));
  const ranked = out.map(v => ({ v, s: Math.abs(v.length - word.length) + (strip(v) === strip(word) ? -0.7 : 0) + Math.random() * 1.2 }))
    .sort((a, b) => a.s - b.s).map(x => x.v);
  const curated = shuffle((CURATED[normAnswer(word)] || []).filter(s => !sameWord(s, word)));
  const res = [word];
  for (const c of [...curated.slice(0, 2), ...ranked, ...curated]) { if (res.length >= 4) break; if (!res.some(r => sameWord(r, c))) res.push(c); }
  const ch = Array.from(tail); let i = 1;
  while (res.length < 4 && i < ch.length * 2) { const k = i % ch.length; if (k > 0 && /[bcdfglmnprst]/.test(ch[k])) { const c = head + ch.slice(0, k + 1).join('') + ch[k] + ch.slice(k + 1).join(''); if (!res.some(r => sameWord(r, c))) res.push(c); } i++; }
  return res;
}

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
function speak(text, rate) {
  if (!('speechSynthesis' in window)) { toast('La lecture audio n’est pas disponible sur ce navigateur.'); return; }
  speechSynthesis.cancel(); speechSynthesis.speak(utter(text, rate));
}
function speakSlow(text) {
  if (!('speechSynthesis' in window)) return;
  speechSynthesis.cancel();
  // Lecture par petits groupes de mots, comme en classe.
  const words = text.replace(/[.!?]$/, '').split(/\s+/), groups = [];
  for (let i = 0; i < words.length; i += 2) groups.push(words.slice(i, i + 2).join(' '));
  groups.forEach(g => speechSynthesis.speak(utter(g, data.settings.rate * 0.85)));
}
function cancelSpeech() { if ('speechSynthesis' in window) speechSynthesis.cancel(); }

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

/* ============ Progression, compagnon, XP ============ */
const dayKey = (d = new Date()) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
function record(w, ok) {
  const p = wp(w);
  if (ok) { p.ok++; p.box = Math.min(5, (p.box || 0) + 1); } else { p.ko++; p.box = 1; }
  p.last = Date.now();
  const d = prog.days[dayKey()] || (prog.days[dayKey()] = { n: 0, ok: 0 }); d.n++; if (ok) d.ok++;
  save();
}
function streakUpdate(ok) { if (ok) { prog.streak++; prog.bestStreak = Math.max(prog.bestStreak, prog.streak); } else prog.streak = 0; }
const level = xp => { let L = 1; while (xp >= 50 * L * (L + 1)) L++; return L; };
const STAGES = [[1, '🥚', 'un œuf mystérieux'], [2, '🦎', 'un bébé dragon'], [4, '🐲', 'un jeune dragon'], [7, '🐉', 'un dragon puissant'], [10, '🐉', 'le roi des dragons']];
const stage = L => STAGES.filter(s => L >= s[0]).pop();
const CHEERS = ['Bravo !', 'Super !', 'Génial !', 'Excellent !', 'Trop fort !', 'Parfait !', 'Champion !'];
const BUDDY_TALK = ['On révise ensemble ?', 'Chaque mot me fait grandir !', 'Miam, des étoiles !', 'Tu es un champion des mots !', 'Écoute bien chaque son…', 'Attention aux accents !', 'Les mots invariables ne changent jamais !'];
function say(msg) { $('bubble').textContent = msg; }
function bounce() { const b = $('buddy'); b.classList.remove('bounce'); void b.offsetWidth; b.classList.add('bounce'); }
function updateHeader() {
  const L = level(prog.xp), st = stage(L), s = data.settings;
  $('buddy').textContent = st[1]; $('buddy').classList.toggle('crown', L >= 10);
  $('buddyName').textContent = s.buddyName; $('level').textContent = L; $('stageName').textContent = '· ' + st[2];
  const a = 50 * (L - 1) * L, b = 50 * L * (L + 1); $('xpFill').style.width = ((prog.xp - a) / (b - a) * 100) + '%';
  $('xp').textContent = prog.xp; $('streak').textContent = prog.streak;
  $('title').textContent = 'La mission Dictée de ' + s.childName;
  const p = curPeriod(), w = curWeek(); $('ctxPill').textContent = `CE1 · ${p.name} · Semaine ${weekNum(p, w)}`;
  document.title = 'Mission Dictée · ' + s.childName;
}
function gain(n) {
  if (n <= 0) return;
  const L0 = level(prog.xp); prog.xp += n; save(); updateHeader(); bounce(); floatText('+' + n + ' ⭐');
  const L1 = level(prog.xp); if (L1 > L0) levelUp(L1, stage(L0) !== stage(L1));
}
function logSession(m, score, total) { prog.sessions.unshift({ d: Date.now(), m, s: score, t: total, sc: scopeLabel() }); prog.sessions = prog.sessions.slice(0, 60); save(); }

/* ============ Effets ============ */
function fx(el, ms) { $('fx').appendChild(el); if (ms) setTimeout(() => el.remove(), ms); return el; }
function mk(cls, html) { const d = document.createElement('div'); d.className = cls; d.innerHTML = html; return d; }
function floatText(t) { fx(mk('float', esc(t)), 1100); }
function toast(t) { fx(mk('toast', esc(t)), 2600); }
function confetti(n = 26) { for (let i = 0; i < n; i++) { const c = mk('confetti', pickOne(['⭐', '🎉', '✨', '🌟', '🎈'])); c.style.left = rand(100) + 'vw'; c.style.animationDelay = (Math.random() * .5) + 's'; fx(c, 2600); } }
function levelUp(L, evolved) {
  const st = stage(L), name = esc(data.settings.buddyName);
  const m = fx(mk('modal', `<div><div class="big">${st[1]}${L >= 10 ? '👑' : ''}</div><h2>Niveau ${L} !</h2><p>${evolved ? `Incroyable ! ${name} devient ${esc(st[2])} !` : `${name} grandit grâce à toi !`}</p><button class="btn primary">Super ! ➜</button></div>`));
  m.querySelector('button').onclick = () => m.remove(); confetti(); say(`Merci ! Je suis niveau ${L} !`);
}

/* ============ Navigation ============ */
function stopAll() { S.gen++; clearInterval(S.timer); S.timer = null; if (S.ch) S.ch.running = false; cancelSpeech(); }
function later(fn, ms) { const g = S.gen; setTimeout(() => { if (g === S.gen) fn(); }, ms); }
function go(view) {
  stopAll(); S.view = view;
  document.querySelectorAll('.tab').forEach(b => b.classList.toggle('active', b.dataset.view === view || (view === 'play' || view === 'challenge' || view === 'dict') && b.dataset.view === 'home'));
  ({ home: renderHome, lists: renderLists, stats: renderStats, settings: renderSettings }[view] || renderHome)();
  window.scrollTo({ top: 0, behavior: 'smooth' });
}
const topBar = (title, sub) => `<div class="topbar"><button class="btn small" data-back>← Menu</button><h2>${title}</h2>${sub ? `<span class="pill">${sub}</span>` : ''}</div>`;
const bar = (v, cls = '') => `<div class="progress ${cls}"><span style="width:${Math.max(0, Math.min(100, v))}%"></span></div>`;
const hintLine = it => `<div class="hint">${esc(it.src || '')}${it.k ? ' · ' + (KINDS[it.k] || it.k) : ''}${it.h ? ' « ' + esc(it.h) + ' »' : ''}${it.retry ? ' · 🔁 on le revoit' : ''}</div>`;
function feedback(ok, html) { const f = $('fb'); if (!f) return; f.className = 'feedback ' + (ok === true ? 'good' : ok === false ? 'bad' : ''); f.innerHTML = html; }
const ACCENTS = ['é', 'è', 'ê', 'à', 'â', 'ù', 'î', 'ô', 'ç', "'"];
const inputHTML = (ph, multi) => (multi
  ? `<textarea id="answer" class="answer" rows="3" autocomplete="off" autocapitalize="sentences" autocorrect="off" spellcheck="false" placeholder="${ph}"></textarea>`
  : `<input id="answer" class="answer" type="text" autocomplete="off" autocapitalize="none" autocorrect="off" spellcheck="false" placeholder="${ph}" aria-label="${ph}">`)
  + `<div class="accents">${ACCENTS.map(a => `<button class="key" type="button" data-k="${esc(a)}">${esc(a)}</button>`).join('')}</div>`;

/* ============ Accueil ============ */
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
  V().innerHTML = `<h2>Que veux-tu réviser, ${esc(s.childName)} ?</h2>
  <div class="scope">
    <div class="chips">${chips.map(([t, l, dis]) => `<button class="chip ${S.scope.type === t ? 'selected' : ''}" data-scope="${t}" ${dis ? 'disabled' : ''}>${esc(l)}</button>`).join('')}</div>
    <label>Ou une autre semaine :<select id="pickWeek"><option value="">— choisir —</option>${opts}</select></label>
    <p class="muted small" style="margin:6px 0 0">${pool.length} mots dans « ${esc(scopeLabel())} »${s.includeInvariants && !['weak', 'all', 'invariants'].includes(S.scope.type) ? ' (avec les mots invariables)' : ''}.</p>
  </div>
  <h3>🏋️ Entraînement</h3>
  <div class="modes">
    <button class="mode" data-mode="quiz"><span class="ico">🎯</span><b>Quiz</b><small>Écoute et choisis</small></button>
    <button class="mode" data-mode="spell"><span class="ico">✍️</span><b>Écris le mot</b><small>Regarde, cache, écris</small></button>
    <button class="mode" data-mode="audio"><span class="ico">🔊</span><b>Dictée audio</b><small>Écoute et écris</small></button>
    <button class="mode" data-mode="cards"><span class="ico">🃏</span><b>Cartes mémo</b><small>Réfléchis dans ta tête</small></button>
  </div>
  <div class="bigmodes">
    <div class="bigmode"><h3>⏱️ Défi chronométré</h3><p>${s.challengeSeconds} secondes pour trouver un maximum de mots !</p><p class="muted small">🏆 Record : ${best} mot${best > 1 ? 's' : ''}</p><button class="btn primary" id="goChallenge">Relever le défi ⚡</button></div>
    <div class="bigmode dict"><h3>📝 Dictée complète</h3><p>Comme en classe : on écrit tout, on corrige à la fin.</p><div class="actions left"><button class="btn primary" id="goDictW">${s.dictationLength} mots</button><button class="btn green" id="goDictP">Des phrases</button></div></div>
  </div>`;
  V().querySelectorAll('[data-scope]').forEach(b => b.onclick = () => { S.scope = { type: b.dataset.scope }; renderHome(); });
  $('pickWeek').onchange = e => { if (e.target.value) { S.scope = { type: 'pick', weekId: e.target.value }; renderHome(); } };
  V().querySelectorAll('[data-mode]').forEach(b => b.onclick = () => startSession(b.dataset.mode));
  $('goChallenge').onclick = startChallenge; $('goDictW').onclick = () => startDictation('words'); $('goDictP').onclick = () => startDictation('phrases');
}

/* ============ Entraînement (quiz, écris, audio, cartes) ============ */
const MODE_TITLES = { quiz: '🎯 Quiz', spell: '✍️ Écris le mot', audio: '🔊 Dictée audio', cards: '🃏 Cartes mémo' };
function startSession(mode) {
  const pool = scopePool(); if (!pool.length) { toast('Aucun mot dans cette sélection.'); return; }
  stopAll(); S.view = 'play';
  S.sess = { mode, pool, count: 0, good: 0, total: data.settings.sessionLength, retry: [], recent: [], missed: [], cur: null, locked: false };
  nextItem();
}
function nextItem() {
  stopAll(); const s = S.sess;
  if (s.count >= s.total) return sessionEnd();
  s.cur = pick(s); s.locked = false;
  ({ quiz: renderQuiz, spell: renderSpell, audio: renderAudio, cards: renderCards })[s.mode]();
  window.scrollTo({ top: 0 });
}
function answer(ok, pts) {
  const s = S.sess, it = s.cur;
  record(it.w, ok); streakUpdate(ok); s.count++; s.recent.push(it.w);
  if (ok) { s.good++; gain(pts); say(pickOne(CHEERS)); }
  else { s.retry.push({ item: { ...it, retry: false }, due: s.count + 3 }); if (!s.missed.some(m => m.w === it.w)) s.missed.push(it); say('Pas grave, on le reverra bientôt !'); updateHeader(); save(); }
}
const playHead = () => { const s = S.sess; return topBar(MODE_TITLES[s.mode], `Mot ${Math.min(s.count + 1, s.total)}/${s.total}`) + bar(s.count / s.total * 100); };

function renderQuiz() {
  const s = S.sess, it = s.cur, ch = shuffle(makeChoices(it.w));
  V().innerHTML = playHead() + `<div class="card">${hintLine(it)}<div class="word">🔊 ???</div><div class="hint">Écoute, puis trouve la bonne orthographe parmi 4 mots très proches.</div><div class="actions"><button class="btn yellow" id="listen">🔊 Réécouter</button></div></div>
  <div class="options" id="opts">${ch.map(c => `<button class="option">${esc(c)}</button>`).join('')}</div>
  <div class="feedback" id="fb" aria-live="polite"></div><div class="actions"><button class="btn primary" id="next" disabled>Mot suivant ➜</button></div>`;
  $('listen').onclick = () => speak(it.w);
  [...$('opts').children].forEach(b => b.onclick = () => {
    if (s.locked) return; s.locked = true; const ok = b.textContent === it.w;
    b.classList.add(ok ? 'correct' : 'wrong'); [...$('opts').children].find(x => x.textContent === it.w).classList.add('correct');
    feedback(ok, ok ? pickOne(CHEERS) + ' Tu as repéré la bonne orthographe ! 🌟 +10' : 'Presque ! Le mot attendu était : <b>' + esc(it.w) + '</b>');
    answer(ok, 10); $('next').disabled = false; $('next').focus();
  });
  $('next').onclick = nextItem; later(() => speak(it.w), 250);
}

function renderSpell() {
  const s = S.sess, it = s.cur; let peeked = false;
  V().innerHTML = playHead() + `<div class="card">${hintLine(it)}<div class="word" id="w">${esc(it.w)}</div><div class="hint" id="h2">Observe bien le mot : il va se cacher dans 3 secondes !</div></div>
  ${inputHTML('Écris le mot ici…')}<div class="feedback" id="fb" aria-live="polite"></div>
  <div class="actions"><button class="btn yellow" id="show">👀 Revoir 2 secondes</button><button class="btn primary" id="check">Vérifier ✓</button><button class="btn green" id="next" style="display:none">Mot suivant ➜</button></div>`;
  const hide = () => { if (s.locked) return; $('w').textContent = '🤔 À toi !'; $('h2').textContent = 'Écris le mot de mémoire.'; $('show').disabled = false; $('answer').focus(); };
  $('show').disabled = true; speak(it.w); later(hide, 3000);
  $('show').onclick = () => { peeked = true; $('w').textContent = it.w; $('h2').textContent = 'Regarde vite…'; $('show').disabled = true; later(hide, 2000); };
  $('check').onclick = () => checkTyped(() => peeked ? 10 : 15);
  $('next').onclick = nextItem; $('answer').addEventListener('keydown', e => { if (e.key === 'Enter') (s.locked ? $('next') : $('check')).click(); });
}

function renderAudio() {
  const s = S.sess, it = s.cur;
  V().innerHTML = playHead() + `<div class="card">${hintLine(it)}<div class="word" id="w">🎧 ???</div><div class="hint" id="h2">Le mot reste caché : écoute-le autant de fois que tu veux.</div><div class="actions"><button class="btn yellow" id="listen">🔊 Écouter</button><button class="btn" id="slow">🐢 Plus lentement</button></div></div>
  ${inputHTML('Écris le mot entendu…')}<div class="feedback" id="fb" aria-live="polite"></div>
  <div class="actions"><button class="btn primary" id="check">Vérifier ✓</button><button class="btn green" id="next" style="display:none">Mot suivant ➜</button></div>`;
  $('listen').onclick = () => speak(it.w); $('slow').onclick = () => speak(it.w, data.settings.rate * 0.65);
  $('check').onclick = () => checkTyped(() => 20);
  $('next').onclick = nextItem; $('answer').addEventListener('keydown', e => { if (e.key === 'Enter') (s.locked ? $('next') : $('check')).click(); });
  later(() => speak(it.w), 250); later(() => $('answer') && $('answer').focus(), 300);
}

function checkTyped(ptsFn) {
  const s = S.sess, it = s.cur, val = $('answer').value;
  if (s.locked) return;
  if (!normAnswer(val)) { feedback(null, 'Écris d’abord ta réponse 🙂'); return; }
  s.locked = true; const ok = sameWord(val, it.w), pts = ptsFn();
  $('w').textContent = it.w; $('h2').textContent = ok ? 'C’est exactement ça !' : 'Observe bien les lettres en jaune.';
  feedback(ok, ok ? `${pickOne(CHEERS)} Aucune faute ! +${pts} ⭐ 🎉` : 'Pas tout à fait… regarde :' + diffHTML(val, it.w));
  answer(ok, pts);
  $('check').style.display = 'none'; const sh = $('show'); if (sh) sh.style.display = 'none';
  $('next').style.display = ''; $('next').focus();
}

function renderCards() {
  const s = S.sess, it = s.cur;
  V().innerHTML = playHead() + `<div class="card">${hintLine(it)}<div class="word" id="w">🎧 Écoute et réfléchis…</div><div class="hint" id="h2">Épelle le mot dans ta tête. Il apparaîtra dans 5 secondes.</div><div class="actions"><button class="btn yellow" id="listen">🔊 Réécouter</button><button class="btn" id="flip">👀 Voir tout de suite</button></div></div>
  <div class="actions"><button class="btn yellow" id="again">🔁 Je me suis trompé</button><button class="btn green" id="know">⭐ Je le savais !</button></div><div class="feedback" id="fb"></div>`;
  const show = () => { $('w').textContent = it.w; $('h2').textContent = 'Avais-tu la bonne orthographe ?'; $('flip').disabled = true; };
  $('listen').onclick = () => speak(it.w); $('flip').onclick = show;
  speak(it.w); later(show, 5000);
  const done = ok => { if (s.locked) return; s.locked = true; show(); feedback(ok, ok ? '+5 ⭐, bien joué !' : 'Pas grave : tu la reverras bientôt !'); answer(ok, 5); later(nextItem, 800); };
  $('again').onclick = () => done(false); $('know').onclick = () => done(true);
}

function sessionEnd() {
  const s = S.sess, pct = s.good / s.total;
  logSession(s.mode, s.good, s.total);
  if (s.good === s.total) gain(30);
  if (pct >= .8) confetti();
  const stars = pct >= .9 ? '⭐⭐⭐' : pct >= .6 ? '⭐⭐' : '⭐';
  V().innerHTML = topBar(MODE_TITLES[s.mode] + ' · bilan') + `<div class="bigscore">${s.good}/${s.total}</div><p class="center" style="font-size:2rem;margin:0">${stars}</p>
  <p class="center"><b>${pct === 1 ? 'Sans faute ! Bonus +30 ⭐' : pct >= .8 ? 'Superbe série !' : pct >= .5 ? 'Bien joué, continue comme ça !' : 'Chaque essai te fait progresser 💪'}</b></p>
  ${s.missed.length ? `<h3>🔁 Les mots à retravailler</h3><div class="wchips">${s.missed.map(m => `<button class="wchip weak" data-say="${esc(m.w)}">${esc(m.w)}</button>`).join('')}</div>` : ''}
  <div class="actions"><button class="btn primary" id="again">Rejouer ➜</button>${s.missed.length ? '<button class="btn yellow" id="redo">Retravailler ces mots</button>' : ''}<button class="btn" data-back>Menu</button></div>`;
  say(pct >= .8 ? 'Waouh, quelle session !' : 'On continue ? Je grandis à chaque mot !');
  $('again').onclick = () => startSession(s.mode);
  if ($('redo')) $('redo').onclick = () => { const pool = s.missed.map(m => ({ ...m, retry: false })); stopAll(); S.sess = { mode: 'audio', pool, count: 0, good: 0, total: Math.max(pool.length * 2, 4), retry: [], recent: [], missed: [], locked: false }; S.view = 'play'; nextItem(); };
}

/* ============ Défi chronométré ============ */
function startChallenge() {
  const pool = scopePool(); if (pool.length < 2) { toast('Il faut au moins 2 mots pour le défi.'); return; }
  stopAll(); S.view = 'challenge'; const secs = data.settings.challengeSeconds;
  S.ch = { pool, secs, score: 0, count: 0, missed: [], retry: [], recent: [], running: false, cur: null, locked: false };
  const best = prog.best['ch' + secs] || 0;
  V().innerHTML = topBar('⏱️ Défi chronométré') + `<div class="card"><div class="word">⏱️ ${secs} s</div><p>Écoute chaque mot et touche la bonne orthographe le plus vite possible !</p><p class="muted">🏆 Ton record : <b>${best}</b></p></div><div class="actions"><button class="btn primary" id="start">C'est parti ! 🚀</button></div>`;
  $('start').onclick = () => {
    speak('Prêt ?'); let n = 3;
    const step = () => { if (n === 0) return runChallenge(); V().innerHTML = topBar('⏱️ Défi chronométré') + `<div class="count">${n}</div>`; n--; later(step, 800); };
    step();
  };
}
function runChallenge() {
  const c = S.ch; c.running = true; c.end = Date.now() + c.secs * 1000;
  S.timer = setInterval(() => {
    const left = Math.max(0, c.end - Date.now()), t = $('timer'), tl = $('tleft');
    if (t) t.style.width = (left / (c.secs * 1000) * 100) + '%'; if (tl) tl.textContent = Math.ceil(left / 1000) + ' s';
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
  $('listen').onclick = () => speak(it.w); speak(it.w);
  [...$('opts').children].forEach(b => b.onclick = () => {
    if (c.locked || !c.running) return; c.locked = true; const ok = b.textContent === it.w;
    b.classList.add(ok ? 'correct' : 'wrong'); if (!ok) [...$('opts').children].find(x => x.textContent === it.w).classList.add('correct');
    record(it.w, ok); streakUpdate(ok); updateHeader(); c.count++; c.recent.push(it.w);
    if (ok) c.score++; else { c.retry.push({ item: it, due: c.count + 3 }); if (!c.missed.some(m => m.w === it.w)) c.missed.push(it); }
    feedback(ok, ok ? '✅' : 'C’était : <b>' + esc(it.w) + '</b>');
    later(chNext, ok ? 450 : 1300);
  });
}
function endChallenge() {
  const c = S.ch; if (!c.running) return; stopAll();
  const key = 'ch' + c.secs, old = prog.best[key] || 0, rec = c.score > old;
  if (rec) prog.best[key] = c.score;
  logSession('challenge', c.score, c.count); gain(c.score * 5 + (rec ? 25 : 0));
  if (rec && c.score > 0) confetti();
  V().innerHTML = topBar('⏱️ Défi terminé !') + `<div class="bigscore">${c.score}</div><p class="center"><b>mot${c.score > 1 ? 's' : ''} trouvé${c.score > 1 ? 's' : ''} en ${c.secs} secondes</b></p>
  <p class="center">${rec ? `🏆 Nouveau record ! (ancien : ${old}) · bonus +25 ⭐` : `🏆 Record à battre : ${old}`}</p>
  ${c.missed.length ? `<h3>🔁 À revoir</h3><div class="wchips">${c.missed.map(m => `<button class="wchip weak" data-say="${esc(m.w)}">${esc(m.w)}</button>`).join('')}</div>` : ''}
  <div class="actions"><button class="btn primary" id="again">Rejouer ⚡</button><button class="btn" data-back>Menu</button></div>`;
  say(rec ? 'Nouveau record, trop fort !' : 'Encore un essai pour battre le record ?');
  $('again').onclick = startChallenge;
}

/* ============ Dictée complète ============ */
function startDictation(kind) {
  let items;
  if (kind === 'words') { const pool = scopePool(); items = weightedSample(pool, Math.min(data.settings.dictationLength, pool.length)); }
  else items = shuffle([...new Set(scopePhrases())]).slice(0, 5).map(p => ({ w: p, k: '', src: 'Phrase' }));
  if (!items.length) { toast(kind === 'words' ? 'Aucun mot dans cette sélection.' : 'Pas encore de phrases pour cette sélection : ajoute-en dans Réglages.'); return; }
  stopAll(); S.view = 'dict'; S.dict = { kind, items, i: 0, answers: [] }; renderDict();
}
function renderDict() {
  stopAll(); const d = S.dict, it = d.items[d.i], phrase = d.kind === 'phrases', last = d.i === d.items.length - 1;
  V().innerHTML = topBar('📝 Dictée complète', `${phrase ? 'Phrase' : 'Mot'} ${d.i + 1}/${d.items.length}`) + bar(d.i / d.items.length * 100) + `
  <div class="card"><div class="hint">${phrase ? 'Écoute toute la phrase, puis écris-la. N’oublie pas la majuscule et le point !' : esc(it.src) + (it.k ? ' · ' + KINDS[it.k] : '')}</div><div class="word">🎧</div>
  <div class="actions"><button class="btn yellow" id="listen">🔊 Écouter</button><button class="btn" id="slow">🐢 ${phrase ? 'Mot à mot' : 'Plus lentement'}</button></div></div>
  ${inputHTML(phrase ? 'Écris la phrase…' : 'Écris le mot…', phrase)}<div class="feedback" id="fb"></div>
  <div class="actions">${d.i > 0 ? '<button class="btn" id="prev">⬅ Précédent</button>' : ''}<button class="btn primary" id="nextD">${last ? 'Terminer et corriger ✓' : 'Suivant ➜'}</button></div>`;
  const inp = $('answer'); inp.value = d.answers[d.i] || '';
  $('listen').onclick = () => speak(it.w); $('slow').onclick = () => phrase ? speakSlow(it.w) : speak(it.w, data.settings.rate * 0.65);
  const go2 = dir => { d.answers[d.i] = inp.value; if (dir > 0 && !normAnswer(inp.value)) { feedback(null, 'Écris quelque chose avant de continuer 🙂'); return; } d.i += dir; if (d.i >= d.items.length) finishDict(); else renderDict(); };
  $('nextD').onclick = () => go2(1); if ($('prev')) $('prev').onclick = () => go2(-1);
  inp.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); go2(1); } });
  later(() => speak(it.w), 300); later(() => inp.focus(), 350);
}
function finishDict() {
  const d = S.dict, phrase = d.kind === 'phrases'; let good = 0, xp = 0, totalErr = 0;
  const rows = d.items.map((it, i) => {
    const a = d.answers[i] || '';
    if (!phrase) {
      const ok = sameWord(a, it.w); record(it.w, ok); if (ok) { good++; xp += 20; }
      return `<li class="${ok ? 'ok' : ''}">${ok ? '✅' : '❌'} <b>${esc(it.w)}</b> <button class="btn small yellow" data-say="${esc(it.w)}">🔊</button>${ok ? '' : diffHTML(a, it.w)}</li>`;
    }
    const r = comparePhrase(a, it.w); totalErr += r.errors; if (r.ok) { good++; xp += 40; } xp += Math.max(0, r.words - r.errors) * 2;
    return `<li class="${r.ok ? 'ok' : ''}">${r.ok ? '✅' : '❌ ' + r.errors + ' faute' + (r.errors > 1 ? 's' : '')} <button class="btn small yellow" data-say="${esc(it.w)}">🔊</button>${diffHTML(a, it.w, true)}${r.notes.length ? `<div class="muted small">✏️ Pense ${r.notes.join(' et ')}.</div>` : ''}</li>`;
  });
  streakUpdate(good === d.items.length); logSession(phrase ? 'dictPhrases' : 'dictWords', good, d.items.length);
  if (good === d.items.length) { xp += 50; confetti(); }
  gain(xp);
  const n = d.items.length;
  V().innerHTML = topBar('📝 Correction de la dictée') + `<div class="bigscore">${good}/${n}</div>
  <p class="center"><b>${phrase ? (totalErr === 0 ? 'Aucune faute, bravo ! 🏆' : `${totalErr} faute${totalErr > 1 ? 's' : ''} au total`) : good === n ? 'Dictée parfaite ! 🏆' : `${n - good} mot${n - good > 1 ? 's' : ''} à revoir`}</b> · +${xp} ⭐</p>
  <ul class="result-list">${rows.join('')}</ul>
  <div class="actions"><button class="btn primary" id="again">Nouvelle dictée</button><button class="btn" data-back>Menu</button></div>`;
  say(good === n ? 'Une dictée parfaite !' : 'Regarde bien les lettres en jaune 👀');
  $('again').onclick = () => startDictation(d.kind);
}

/* ============ Mes listes (vue enfant) ============ */
let listPeriod = null;
function renderLists() {
  if (!listPeriod || !data.periods.some(p => p.id === listPeriod)) listPeriod = data.current.period;
  const p = data.periods.find(x => x.id === listPeriod), cw = curWeek();
  const chip = w => `<button class="wchip ${status(w)}" data-say="${esc(w)}">${esc(w)}</button>`;
  V().innerHTML = `<h2>📋 Mes listes de mots</h2><p class="muted">Touche un mot pour l’écouter.</p>
  <div class="chips">${data.periods.map(pp => `<button class="chip ${pp.id === listPeriod ? 'selected' : ''}" data-lp="${pp.id}">${esc(pp.name)}</button>`).join('')}</div>
  <div class="legend"><span class="wchip">pas encore vu</span><span class="wchip learning">en cours</span><span class="wchip weak">à retravailler</span><span class="wchip ok">maîtrisé</span></div>
  <div class="listgrid">${p.weeks.map((w, i) => `<div class="listbox ${w.id === cw.id ? 'current' : ''}" style="border-left-color:${['#ff9b54', '#ed80ad', '#64b77b', '#e45d54', '#f5a044', '#5ba8e3', '#9b7be8'][i % 7]}">
    <strong>Semaine ${i + 1} · ${esc(w.title)}${w.id === cw.id ? ' 📍' : ''}</strong><div class="wchips">${w.words.map(x => chip(x.w)).join('')}</div>
    ${w.phrases.length ? `<p class="phr">${w.phrases.map(esc).join('<br>')}</p>` : ''}</div>`).join('')}
    <div class="listbox" style="border-left-color:#f5a044"><strong>✨ Mots invariables « Pas touche ! »</strong><div class="wchips">${data.invariants.map(chip).join('')}</div></div>
  </div>`;
  V().querySelectorAll('[data-lp]').forEach(b => b.onclick = () => { listPeriod = b.dataset.lp; renderLists(); });
}

/* ============ Progrès ============ */
const MODE_NAMES = { quiz: '🎯 Quiz', spell: '✍️ Écris', audio: '🔊 Audio', cards: '🃏 Cartes', challenge: '⏱️ Défi', dictWords: '📝 Dictée mots', dictPhrases: '📝 Dictée phrases' };
function renderStats() {
  const p = curPeriod(), pool = scopePool({ type: 'period' }), mastered = pool.filter(x => status(x.w) === 'ok').length;
  const days = Object.keys(prog.days).length, L = level(prog.xp);
  const last7 = [...Array(7)].map((_, i) => { const d = new Date(); d.setDate(d.getDate() - 6 + i); const k = dayKey(d); return { l: d.toLocaleDateString('fr-FR', { weekday: 'short' }), n: (prog.days[k] || {}).n || 0 }; });
  const max7 = Math.max(5, ...last7.map(x => x.n));
  const hard = Object.entries(prog.words).filter(([, v]) => v.ko > 0 && v.box < 4).sort((a, b) => (b[1].ko - b[1].ok / 2) - (a[1].ko - a[1].ok / 2)).slice(0, 10);
  V().innerHTML = `<h2>📊 Les progrès de ${esc(data.settings.childName)}</h2>
  <div class="tiles"><div class="tile"><b>${mastered}/${pool.length}</b>mots maîtrisés (${esc(p.name)})</div><div class="tile"><b>${L}</b>niveau de ${esc(data.settings.buddyName)}</div><div class="tile"><b>${days}</b>jour${days > 1 ? 's' : ''} d’entraînement</div><div class="tile"><b>${prog.bestStreak}</b>meilleure série 🔥</div></div>
  <div class="section"><h3>📅 Semaine par semaine (${esc(p.name)})</h3>${p.weeks.map((w, i) => { const n = w.words.length, ok = w.words.filter(x => status(x.w) === 'ok').length; return `<div class="wbar"><span>S${i + 1} · ${esc(w.title)}</span><div class="track"><span style="width:${n ? ok / n * 100 : 0}%"></span></div><b>${ok}/${n}</b></div>`; }).join('')}
  <div class="wbar"><span>✨ Invariables</span><div class="track"><span style="width:${data.invariants.length ? data.invariants.filter(w => status(w) === 'ok').length / data.invariants.length * 100 : 0}%"></span></div><b>${data.invariants.filter(w => status(w) === 'ok').length}/${data.invariants.length}</b></div>
  <p class="muted small">Un mot est « maîtrisé » ⭐ après 4 bonnes réponses d’affilée.</p></div>
  <div class="section"><h3>🗓️ Les 7 derniers jours</h3><div class="week7">${last7.map(x => `<div><span>${x.n || ''}</span><i style="height:${x.n / max7 * 80}%"></i>${esc(x.l)}</div>`).join('')}</div></div>
  <div class="section"><h3>🧩 Les mots les plus difficiles</h3>${hard.length ? `<div class="wchips">${hard.map(([k, v]) => `<button class="wchip weak" data-say="${esc(k)}">${esc(k)} · ${v.ko}✗</button>`).join('')}</div>` : '<p class="muted">Pas encore d’erreurs enregistrées. 👍</p>'}</div>
  <div class="section"><h3>🕑 Dernières sessions</h3>${prog.sessions.length ? `<ul class="result-list">${prog.sessions.slice(0, 10).map(x => `<li>${new Date(x.d).toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short' })} · ${MODE_NAMES[x.m] || x.m} · <b>${x.s}/${x.t}</b> <span class="muted small">(${esc(x.sc || '')})</span></li>`).join('')}</ul>` : '<p class="muted">Aucune session pour l’instant.</p>'}</div>`;
}

/* ============ Réglages (espace parents) ============ */
const kindOpts = k => Object.entries(KINDS).map(([v, l]) => `<option value="${v}" ${v === k ? 'selected' : ''}>${l}</option>`).join('');
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
    <label>Semaine en cours<select id="curW">${cp.weeks.map((w, i) => `<option value="${w.id}" ${w.id === cw.id ? 'selected' : ''}>Semaine ${i + 1} · ${esc(w.title)}</option>`).join('')}</select></label></div>
    <p class="muted small">« Semaine » est la révision proposée par défaut ; « Toute la période » prépare la dictée bilan avant les vacances.</p></div>
  <div class="setgroup"><h3>🧒 Profil</h3><div class="row"><label>Prénom<input id="sName" value="${esc(st.childName)}"></label><label>Nom du compagnon<input id="sBuddy" value="${esc(st.buddyName)}"></label></div></div>
  <div class="setgroup"><h3>🔊 Voix</h3><div class="row">
    <label>Voix française<select id="sVoice"><option value="">Automatique${bestVoice() ? ' (' + esc(bestVoice().name) + ')' : ''}</option>${voices.map(v => `<option value="${esc(v.name)}" ${v.name === st.voice ? 'selected' : ''}>${esc(v.name)} (${esc(v.lang)})</option>`).join('')}</select></label>
    <label>Vitesse : <span id="rateVal">${st.rate}</span><input type="range" id="sRate" min="0.5" max="1.2" step="0.05" value="${st.rate}"></label></div>
    <button class="btn yellow small" id="testVoice">🔊 Tester : « nous envoyions »</button>${voices.length ? '' : '<p class="muted small">Aucune voix française détectée pour l’instant (elles peuvent mettre quelques secondes à charger).</p>'}</div>
  <div class="setgroup"><h3>🎮 Exercices</h3>
    <label class="check"><input type="checkbox" id="sInvOn" ${st.includeInvariants ? 'checked' : ''}> Ajouter les mots invariables aux révisions de semaine / période</label>
    <div class="row"><label>Mots par entraînement${sel('sLen', [5, 10, 15, 20], st.sessionLength)}</label><label>Mots dans la dictée complète${sel('sDict', [5, 10, 15, 20, 30], st.dictationLength)}</label><label>Durée du défi${sel('sCh', [45, 60, 90, 120], st.challengeSeconds, v => v + ' secondes')}</label></div>
    <label class="check"><input type="checkbox" id="sGate" ${st.parentGate ? 'checked' : ''}> Protéger les réglages par une multiplication</label></div>
  <div class="setgroup"><h3>📚 Listes de mots</h3>
    <div class="chips">${data.periods.map(p => `<button class="chip ${p.id === ep.id ? 'selected' : ''}" data-ep="${p.id}">${esc(p.name)}</button>`).join('')}<button class="chip" id="addPeriod">➕ Nouvelle période</button></div>
    <div class="row"><label>Nom de la période<input id="pName" value="${esc(ep.name)}"></label></div>
    ${ep.weeks.map((w, i) => `<details class="week" data-w="${w.id}" ${S.openWeeks.has(w.id) ? 'open' : ''}><summary>Semaine ${i + 1} · ${esc(w.title)} <span class="muted small">(${w.words.length} mots, ${w.phrases.length} phrases)</span></summary>
      <label>Titre<input data-f="title" value="${esc(w.title)}"></label>
      <div class="muted small">Mot · type · infinitif (pour les verbes)</div>
      ${w.words.map((x, j) => `<div class="wordrow" data-j="${j}"><input data-f="w" value="${esc(x.w)}"><select data-f="k">${kindOpts(x.k)}</select><input data-f="h" placeholder="infinitif" value="${esc(x.h || '')}"><button class="iconbtn" data-a="delw" title="Supprimer">🗑️</button></div>`).join('')}
      <div class="addrow"><textarea data-f="bulk" rows="2" placeholder="Ajouter des mots : un par ligne"></textarea><select data-f="bulkK">${kindOpts('nom')}</select><input data-f="bulkH" placeholder="infinitif"><button class="btn green small" data-a="addw">➕ Ajouter</button></div>
      <label>Phrases de dictée (une par ligne)<textarea data-f="phrases" rows="3">${esc(w.phrases.join('\n'))}</textarea></label>
      <div class="actions left"><button class="btn small" data-a="up">⬆️ Monter</button><button class="btn small" data-a="down">⬇️ Descendre</button><button class="btn small danger" data-a="delweek">Supprimer la semaine</button></div></details>`).join('')}
    <div class="actions left"><button class="btn green" id="addWeek">➕ Ajouter une semaine</button>${data.periods.length > 1 ? '<button class="btn danger small" id="delPeriod">Supprimer cette période</button>' : ''}</div></div>
  <div class="setgroup"><h3>✨ Mots invariables (« Pas touche ! »)</h3><textarea id="sInv" rows="4" style="width:100%">${esc(data.invariants.join('\n'))}</textarea><p class="muted small">Un mot par ligne (ou séparés par des virgules).</p></div>
  <div class="setgroup"><h3>💾 Sauvegarde</h3><p class="muted small">Les listes et la progression sont enregistrées sur cet appareil. Exporte une sauvegarde pour les transférer sur une autre tablette.</p>
    <div class="actions left"><button class="btn" id="exp">⬇️ Exporter</button><label class="btn" style="margin:0;flex-direction:row">⬆️ Importer<input type="file" id="imp" accept=".json,application/json" hidden></label>${S.installEvt ? '<button class="btn primary" id="install">📲 Installer l’application</button>' : ''}</div>
    <div class="actions left"><button class="btn danger small" id="resetLists">Remettre les listes d’origine</button><button class="btn danger small" id="resetProg">Effacer la progression</button></div></div>`;
  bindSettings(ep);
}
function bindSettings(ep) {
  const st = data.settings, ch = (id, fn) => { const el = $(id); if (el) el.onchange = e => { fn(e.target); save(); updateHeader(); }; };
  ch('curP', t => { data.current.period = t.value; const p = curPeriod(); data.current.week = (p.weeks[0] || {}).id; S.editPeriod = t.value; renderSettings(); });
  ch('curW', t => data.current.week = t.value);
  ch('sName', t => st.childName = t.value.trim() || 'Valentin'); ch('sBuddy', t => st.buddyName = t.value.trim() || 'Draco');
  ch('sVoice', t => st.voice = t.value); ch('sInvOn', t => st.includeInvariants = t.checked); ch('sGate', t => st.parentGate = t.checked);
  ch('sLen', t => st.sessionLength = +t.value); ch('sDict', t => st.dictationLength = +t.value); ch('sCh', t => st.challengeSeconds = +t.value);
  $('sRate').oninput = e => { st.rate = +e.target.value; $('rateVal').textContent = st.rate; save(); };
  $('testVoice').onclick = () => speak('nous envoyions');
  ch('pName', t => { ep.name = t.value.trim() || ep.name; renderSettings(); });
  ch('sInv', t => { data.invariants = [...new Set(t.value.split(/[\n,]+/).map(s => s.trim()).filter(Boolean))]; });
  V().querySelectorAll('[data-ep]').forEach(b => b.onclick = () => { S.editPeriod = b.dataset.ep; renderSettings(); });
  $('addPeriod').onclick = () => { const p = { id: uid(), name: 'Période ' + (data.periods.length + 1), weeks: [{ id: uid(), title: 'Nouvelle liste', words: [], phrases: [] }] }; data.periods.push(p); S.editPeriod = p.id; S.openWeeks.add(p.weeks[0].id); save(); renderSettings(); };
  $('addWeek').onclick = () => { const w = { id: uid(), title: 'Nouvelle liste', words: [], phrases: [] }; ep.weeks.push(w); S.openWeeks.add(w.id); save(); renderSettings(); };
  if ($('delPeriod')) $('delPeriod').onclick = () => { if (!confirm(`Supprimer « ${ep.name} » et toutes ses semaines ?`)) return; data.periods = data.periods.filter(p => p !== ep); if (data.current.period === ep.id) { data.current.period = data.periods[0].id; data.current.week = (data.periods[0].weeks[0] || {}).id; } S.editPeriod = null; save(); updateHeader(); renderSettings(); };
  V().querySelectorAll('details.week').forEach(det => {
    const w = ep.weeks.find(x => x.id === det.dataset.w);
    det.addEventListener('toggle', () => det.open ? S.openWeeks.add(w.id) : S.openWeeks.delete(w.id));
    det.addEventListener('change', e => {
      const f = e.target.dataset.f, row = e.target.closest('.wordrow');
      if (row) { const x = w.words[+row.dataset.j]; if (f === 'w') { const v = e.target.value.trim(); if (v) x.w = v; } else if (f === 'k') x.k = e.target.value; else if (f === 'h') { const v = e.target.value.trim(); if (v) x.h = v; else delete x.h; } }
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
      else if (act === 'up' && i > 0) [ep.weeks[i - 1], ep.weeks[i]] = [ep.weeks[i], ep.weeks[i - 1]];
      else if (act === 'down' && i < ep.weeks.length - 1) [ep.weeks[i + 1], ep.weeks[i]] = [ep.weeks[i], ep.weeks[i + 1]];
      else if (act === 'delweek') { if (ep.weeks.length < 2) return toast('Une période garde au moins une semaine.'); if (!confirm(`Supprimer la semaine « ${w.title} » ?`)) return; ep.weeks.splice(i, 1); if (data.current.week === w.id) data.current.week = ep.weeks[0].id; }
      else return;
      save(); updateHeader(); renderSettings();
    });
  });
  $('exp').onclick = () => {
    const blob = new Blob([JSON.stringify({ app: 'mission-dictee', version: 4, exported: new Date().toISOString(), data, prog }, null, 2)], { type: 'application/json' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `mission-dictee-sauvegarde-${dayKey()}.json`; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  };
  $('imp').onchange = e => {
    const f = e.target.files[0]; if (!f) return; const r = new FileReader();
    r.onload = () => { try { const j = JSON.parse(r.result); if (!j.data || !Array.isArray(j.data.periods)) throw 0; if (!confirm('Remplacer les listes et la progression par cette sauvegarde ?')) return; data = j.data; data.settings = Object.assign(defaultSettings(), data.settings || {}); if (j.prog) prog = Object.assign({ words: {}, xp: 0, streak: 0, bestStreak: 0, best: {}, sessions: [], days: {} }, j.prog); save(); updateHeader(); renderSettings(); toast('Sauvegarde importée ✅'); } catch (err) { toast('Fichier de sauvegarde invalide.'); } };
    r.readAsText(f);
  };
  if ($('install')) $('install').onclick = async () => { S.installEvt.prompt(); await S.installEvt.userChoice; S.installEvt = null; renderSettings(); };
  $('resetLists').onclick = () => { if (!confirm('Remplacer toutes les listes par celles d’origine (périodes 1 et 2) ? La progression est conservée.')) return; const keep = data.settings; data = buildDefaultData(); data.settings = keep; S.editPeriod = null; save(); updateHeader(); renderSettings(); };
  $('resetProg').onclick = () => { if (!confirm('Effacer toute la progression (étoiles, niveau, statistiques) ? Cette action est définitive.')) return; prog = { words: {}, xp: 0, streak: 0, bestStreak: 0, best: {}, sessions: [], days: {} }; save(); updateHeader(); toast('Progression effacée.'); };
}

/* ============ Démarrage ============ */
document.querySelectorAll('.tab').forEach(b => b.onclick = () => go(b.dataset.view));
V().addEventListener('click', e => {
  if (e.target.closest('[data-back]')) { go('home'); return; }
  const s = e.target.closest('[data-say]'); if (s) speak(s.dataset.say);
});
// Clavier d'accents : insère la lettre sans faire perdre le focus au champ.
document.addEventListener('pointerdown', e => {
  const k = e.target.closest('.key'); if (!k) return; e.preventDefault();
  const inp = $('answer'); if (!inp) return;
  const a = inp.selectionStart ?? inp.value.length, b = inp.selectionEnd ?? a;
  inp.value = inp.value.slice(0, a) + k.dataset.k + inp.value.slice(b); inp.focus(); inp.setSelectionRange(a + 1, a + 1);
});
$('buddy').onclick = () => { bounce(); const m = pickOne(BUDDY_TALK); say(m); speak(m); };
window.addEventListener('beforeinstallprompt', e => { e.preventDefault(); S.installEvt = e; });
if ('serviceWorker' in navigator && location.protocol.startsWith('http')) navigator.serviceWorker.register('sw.js').catch(() => {});
save(); updateHeader(); go('home');
