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
const newProg = () => ({ words: {}, xp: 0, coins: 0, streak: 0, bestStreak: 0, bestDays: 0, best: {}, sessions: [], days: {},
  counters: {}, badges: {}, owned: [], equip: { acc: null, decor: 'none' }, daily: null, bossBeaten: {} });
function fixProg(p) { const had = !!p && 'coins' in p; p = Object.assign(newProg(), p || {}); if (!had) p.coins = Math.floor((p.xp || 0) / 2); p.equip = Object.assign({ acc: null, decor: 'none' }, p.equip); return p; }
let data = migrateData(loadJSON(DATA_KEY) || buildDefaultData());
let prog = fixProg(loadJSON(PROG_KEY));
data.settings = Object.assign(defaultSettings(), data.settings || {});
function save() { try { localStorage.setItem(DATA_KEY, JSON.stringify(data)); localStorage.setItem(PROG_KEY, JSON.stringify(prog)); } catch (e) {} }

const S = { view: 'home', scope: { type: 'week' }, parentOk: false, editPeriod: null, openWeeks: new Set(), recWeek: null, sess: null, ch: null, dict: null, boss: null, timer: null, gen: 0, installEvt: null };

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

