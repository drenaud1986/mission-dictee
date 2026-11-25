'use strict';
/* Draco et les récompenses : évolutions, flammes, badges, missions du jour, boutique. */

/* ---------- Évolutions ---------- */
const STAGES = [
  { lvl: 1, e: '🥚', n: 'un œuf mystérieux', cls: '' },
  { lvl: 2, e: '🦎', n: 'un bébé dragon', cls: '' },
  { lvl: 4, e: '🐲', n: 'un dragon curieux', cls: 'st-small' },
  { lvl: 6, e: '🐲', n: 'un jeune dragon', cls: '' },
  { lvl: 8, e: '🐉', n: 'un dragon puissant', cls: '' },
  { lvl: 11, e: '🐉', n: 'un dragon de feu', cls: 'st-fire' },
  { lvl: 14, e: '🐉', n: 'le roi des dragons', cls: 'st-fire st-king' },
  { lvl: 18, e: '🐉', n: 'un dragon légendaire', cls: 'st-legend st-king' }
];
const stage = L => STAGES.filter(s => L >= s.lvl).pop();
const level = xp => { let L = 1; while (xp >= 50 * L * (L + 1)) L++; return L; };

/* ---------- Flammes : jours d'entraînement d'affilée ---------- */
function dayStreak() {
  let n = 0; const d = new Date();
  if (!prog.days[dayKey(d)]) d.setDate(d.getDate() - 1);
  while (prog.days[dayKey(d)]) { n++; d.setDate(d.getDate() - 1); }
  return n;
}
function isSleepy() {
  if (!Object.keys(prog.days).length) return false;
  const t = new Date(), y = new Date(); y.setDate(y.getDate() - 1);
  return !prog.days[dayKey(t)] && !prog.days[dayKey(y)];
}

/* ---------- Draco parle ---------- */
function dracoTip(it) {
  const w = it.w;
  if (it.k === 'invariable') return 'Mot invariable : il ne change jamais !';
  if (it.k === 'verbe' && /^nous .*ions$/.test(w)) return 'Nous … -ions : c’est l’imparfait !';
  if (it.k === 'verbe' && /^vous .*iez$/.test(w)) return 'Vous … -iez : c’est l’imparfait !';
  if (it.k === 'verbe' && /(ais|ait|aient)$/.test(w)) return 'Imparfait : -ais, -ait, -aient… regarde le pronom !';
  if (/^nous /.test(w)) return 'Avec « nous », ça finit par -ons !';
  if (/^vous /.test(w)) return 'Avec « vous », ça finit par -ez !';
  if (/^(ils|elles) /.test(w)) return 'Avec « ils », le -ent ne s’entend pas !';
  if (/^tu /.test(w)) return 'Avec « tu », pense au -s à la fin !';
  if (/^(des|les|mes|ses|tes|nos|vos) /.test(w)) return /x$/.test(w) ? 'Pluriel en -x, comme des gâteaux !' : 'Pluriel : n’oublie pas le s !';
  if (/[éèêâîôûç]/.test(w)) return 'Attention aux accents !';
  if (/([bcdfglmnprst])\1/.test(w)) return 'Il y a une lettre double dans ce mot…';
  return pickOne([`Tu peux le faire, ${data.settings.childName} !`, 'Écoute bien chaque son…', 'Prends ton temps.']);
}
function cheer() {
  const n = data.settings.childName;
  return pickOne(['Bravo !', 'Super !', 'Génial !', 'Excellent !', 'Trop fort !', 'Parfait !', `Bravo ${n} !`, `Champion, ${n} !`, 'Waouh !']);
}

/* ---------- Compteurs ---------- */
function bumpCounter(k, n = 1) { prog.counters[k] = (prog.counters[k] || 0) + n; }

/* ---------- Missions du jour ---------- */
const MISSION_TYPES = [
  { id: 'ok15', t: 'Réussis 15 mots', k: 'ok', n: 15, base: true },
  { id: 'ok25', t: 'Réussis 25 mots', k: 'ok', n: 25, base: true },
  { id: 'streak5', t: 'Fais 5 bonnes réponses d’affilée', k: 'streakMax', n: 5 },
  { id: 'dict', t: 'Termine une dictée complète', k: 'dict', n: 1 },
  { id: 'pieces', t: 'Reconstruis 5 mots en morceaux', k: 'pieces', n: 5 },
  { id: 'missing', t: 'Trouve 5 lettres manquantes', k: 'missing', n: 5 },
  { id: 'tri', t: 'Range 8 verbes dans le tri', k: 'tri', n: 8 },
  { id: 'hunt', t: 'Trouve 3 fautes cachées', k: 'hunt', n: 3 },
  { id: 'chal', t: 'Trouve au moins 8 mots au défi chrono', k: 'chal', n: 8 },
  { id: 'weak', t: 'Réussis 3 mots « à retravailler »', k: 'weakOk', n: 3 }
];
function seeded(str) { let h = 1779033703 ^ str.length; for (let i = 0; i < str.length; i++) { h = Math.imul(h ^ str.charCodeAt(i), 3432918353); h = h << 13 | h >>> 19; } return () => { h = Math.imul(h ^ h >>> 16, 2246822507); h = Math.imul(h ^ h >>> 13, 3266489909); return ((h ^= h >>> 16) >>> 0) / 4294967296; }; }
function todayMissions() {
  const r = seeded('missions-' + dayKey());
  const base = MISSION_TYPES.filter(m => m.base), rest = MISSION_TYPES.filter(m => !m.base);
  const pick = [base[Math.floor(r() * base.length)]];
  while (pick.length < 3) { const m = rest[Math.floor(r() * rest.length)]; if (!pick.includes(m)) pick.push(m); }
  return pick;
}
function daily() {
  if (!prog.daily || prog.daily.day !== dayKey()) prog.daily = { day: dayKey(), c: {}, done: {} };
  return prog.daily;
}
function bumpDaily(k, n = 1) { const d = daily(); d.c[k] = (d.c[k] || 0) + n; checkMissions(); }
function maxDaily(k, v) { const d = daily(); if (v > (d.c[k] || 0)) { d.c[k] = v; checkMissions(); } }
function checkMissions() {
  const d = daily(), ms = todayMissions();
  ms.forEach(m => {
    if (!d.done[m.id] && (d.c[m.k] || 0) >= m.n) {
      d.done[m.id] = true; Sfx.play('coin'); popInfo('🎯', 'Mission réussie !', m.t + ' · +30 ⭐');
      later0(() => gain(30), 50);
    }
  });
  if (!d.done.all && ms.every(m => d.done[m.id])) {
    d.done.all = true; bumpCounter('missionDays');
    later0(() => { gain(50); confetti(); popInfo('🕵️', 'Toutes les missions du jour !', 'Bonus +50 ⭐'); }, 900);
  }
  save();
}
const later0 = (fn, ms) => setTimeout(fn, ms);
function missionsHTML() {
  const d = daily(), ms = todayMissions();
  return `<div class="missions"><h3>🎯 Missions du jour ${d.done.all ? '· toutes réussies ! 🎉' : ''}</h3>${ms.map(m => {
    const v = Math.min(m.n, d.c[m.k] || 0), ok = d.done[m.id];
    return `<div class="mission ${ok ? 'done' : ''}"><span>${ok ? '✅' : '⬜'} ${esc(m.t)}</span><div class="mtrack"><span style="width:${v / m.n * 100}%"></span></div><b>${v}/${m.n}</b></div>`;
  }).join('')}</div>`;
}

/* ---------- Badges ---------- */
const C = () => prog.counters;
const BADGES = [
  { id: 'first', e: '🌱', n: 'Premier pas', d: 'Réussir son premier mot', c: () => C().ok >= 1 },
  { id: 'ok100', e: '💯', n: 'Cent mots', d: 'Réussir 100 mots', c: () => C().ok >= 100 },
  { id: 'ok500', e: '🚀', n: 'Fusée des mots', d: 'Réussir 500 mots', c: () => C().ok >= 500 },
  { id: 'streak10', e: '🔥', n: 'En feu', d: '10 bonnes réponses d’affilée', c: () => prog.bestStreak >= 10 },
  { id: 'streak25', e: '☄️', n: 'Inarrêtable', d: '25 bonnes réponses d’affilée', c: () => prog.bestStreak >= 25 },
  { id: 'days3', e: '📅', n: 'Régulier', d: 'S’entraîner 3 jours d’affilée', c: () => prog.bestDays >= 3 },
  { id: 'days7', e: '🗓️', n: 'Semaine de feu', d: 'S’entraîner 7 jours d’affilée', c: () => prog.bestDays >= 7 },
  { id: 'days14', e: '🏃', n: 'Marathonien', d: 'S’entraîner 14 jours d’affilée', c: () => prog.bestDays >= 14 },
  { id: 'perfect', e: '📝', n: 'Dictée parfaite', d: 'Une dictée complète sans faute', c: () => C().perfectDict >= 1 },
  { id: 'imparfait', e: '⏳', n: 'Maître de l’imparfait', d: 'Maîtriser tous les verbes à l’imparfait', c: () => { const v = allItems().filter(x => x.k === 'verbe' && /(ais|ait|aient|ions|iez)$/.test(x.w)); return v.length >= 5 && v.every(x => status(x.w) === 'ok'); } },
  { id: 'invariants', e: '✨', n: 'Pas touche !', d: 'Maîtriser tous les mots invariables', c: () => data.invariants.length > 0 && data.invariants.every(w => status(w) === 'ok') },
  { id: 'week', e: '⭐', n: 'Semaine maîtrisée', d: 'Maîtriser tous les mots d’une semaine', c: () => data.periods.some(p => p.weeks.some(w => w.words.length && w.words.every(x => status(x.w) === 'ok'))) },
  { id: 'period', e: '🌟', n: 'Période maîtrisée', d: 'Maîtriser tous les mots d’une période', c: () => data.periods.some(p => p.weeks.length && p.weeks.every(w => w.words.every(x => status(x.w) === 'ok'))) },
  { id: 'boss', e: '⚔️', n: 'Vainqueur du boss', d: 'Battre un boss de fin de période', c: () => C().bossWins >= 1 },
  { id: 'chal15', e: '⚡', n: 'Éclair', d: '15 mots au défi chronométré', c: () => Math.max(0, ...Object.values(prog.best)) >= 15 },
  { id: 'hunter', e: '🔎', n: 'Détective', d: 'Trouver 20 fautes cachées', c: () => C().hunt >= 20 },
  { id: 'builder', e: '🧩', n: 'Architecte', d: 'Reconstruire 20 mots en morceaux', c: () => C().pieces >= 20 },
  { id: 'letters', e: '🔤', n: 'Œil de lynx', d: 'Trouver 30 lettres manquantes', c: () => C().missing >= 30 },
  { id: 'sorter', e: '📦', n: 'Roi du tri', d: 'Ranger 50 verbes', c: () => C().tri >= 50 },
  { id: 'missions', e: '🎯', n: 'Agent secret', d: 'Réussir les 3 missions d’une journée', c: () => C().missionDays >= 1 },
  { id: 'missions10', e: '🕵️', n: 'Super agent', d: 'Réussir toutes les missions 10 jours', c: () => C().missionDays >= 10 },
  { id: 'shop3', e: '🛍️', n: 'Collectionneur', d: 'Acheter 3 objets à la boutique', c: () => prog.owned.length >= 3 },
  { id: 'lvl5', e: '🐲', n: 'Dresseur de dragon', d: 'Atteindre le niveau 5', c: () => level(prog.xp) >= 5 },
  { id: 'lvl10', e: '👑', n: 'Ami des rois', d: 'Atteindre le niveau 10', c: () => level(prog.xp) >= 10 }
];
let badgeQueue = [], badgeShowing = false;
function checkBadges() {
  BADGES.forEach(b => {
    if (prog.badges[b.id]) return;
    let ok = false; try { ok = b.c(); } catch (e) {}
    if (ok) { prog.badges[b.id] = Date.now(); badgeQueue.push(b); }
  });
  save(); showNextBadge();
}
function showNextBadge() {
  if (badgeShowing || !badgeQueue.length) return;
  badgeShowing = true; const b = badgeQueue.shift();
  Sfx.play('badge'); popInfo(b.e, 'Nouveau badge : ' + b.n, b.d, 'badgepop');
  setTimeout(() => { badgeShowing = false; showNextBadge(); }, 2800);
}
function popInfo(ico, title, sub, cls = '') {
  const el = mk('pop ' + cls, `<span class="pico">${ico}</span><div><b>${esc(title)}</b><small>${esc(sub || '')}</small></div>`);
  fx(el, 2700);
}

/* ---------- Boutique ---------- */
const SHOP = {
  acc: [
    { id: 'bow', e: '🎀', n: 'Nœud', p: 60 },
    { id: 'cap', e: '🧢', n: 'Casquette', p: 80 },
    { id: 'glasses', e: '🕶️', n: 'Lunettes de soleil', p: 100 },
    { id: 'tree', e: '🎄', n: 'Petit sapin de Noël', p: 100 },
    { id: 'star', e: '🌟', n: 'Étoile magique', p: 120 },
    { id: 'hat', e: '🎩', n: 'Chapeau de magicien', p: 150 },
    { id: 'wand', e: '🪄', n: 'Baguette magique', p: 180 },
    { id: 'crown', e: '👑', n: 'Couronne', p: 300 }
  ],
  decor: [
    { id: 'none', e: '⬜', n: 'Classique', p: 0 },
    { id: 'snow', e: '❄️', n: 'Noël enneigé', p: 120 },
    { id: 'space', e: '🪐', n: 'Espace', p: 150 },
    { id: 'jungle', e: '🌴', n: 'Jungle', p: 150 },
    { id: 'sea', e: '🐠', n: 'Océan', p: 150 },
    { id: 'castle', e: '🏰', n: 'Château', p: 200 }
  ]
};
const owns = id => id === 'none' || prog.owned.includes(id);
function buyOrEquip(type, id) {
  const item = SHOP[type].find(x => x.id === id); if (!item) return;
  if (!owns(id)) {
    if (prog.coins < item.p) { Sfx.play('bad'); toast(`Il te manque ${item.p - prog.coins} 🪙. Continue à jouer !`); return; }
    prog.coins -= item.p; prog.owned.push(id); Sfx.play('coin'); confetti(14);
    popInfo(item.e, 'Acheté : ' + item.n, `${data.settings.buddyName} adore !`);
  }
  if (type === 'acc') prog.equip.acc = prog.equip.acc === id ? null : id; else prog.equip.decor = id;
  save(); updateHeader(); checkBadges(); renderDraco();
}

/* ---------- Page « Draco » ---------- */
function renderDraco() {
  const L = level(prog.xp), st = stage(L), a = 50 * (L - 1) * L, b = 50 * L * (L + 1), name = esc(data.settings.buddyName);
  const days = [...Array(28)].map((_, i) => { const d = new Date(); d.setDate(d.getDate() - 27 + i); return { k: dayKey(d), d }; });
  const nb = Object.keys(prog.badges).length;
  V().innerHTML = `<h2>🐉 ${name}, ton compagnon</h2>
  <div class="draco-card"><div class="draco-big ${st.cls}">${st.e}${prog.equip.acc ? `<span class="acc">${SHOP.acc.find(x => x.id === prog.equip.acc).e}</span>` : ''}</div>
    <div><b>Niveau ${L}</b> · ${esc(st.n)}<div class="xpbar"><span style="width:${(prog.xp - a) / (b - a) * 100}%"></span></div><small class="muted">Encore ${b - prog.xp} ⭐ avant le niveau ${L + 1}</small></div></div>
  <div class="stages">${STAGES.map(s => `<div class="stagebox ${L >= s.lvl ? 'on' : ''}"><span class="${L >= s.lvl ? s.cls : ''}">${L >= s.lvl ? s.e : '❓'}</span><small>niv. ${s.lvl}</small></div>`).join('')}</div>

  <div class="section"><h3>🔥 Mes flammes : ${dayStreak()} jour${dayStreak() > 1 ? 's' : ''} d’affilée <span class="muted small">(record : ${prog.bestDays})</span></h3>
    <div class="flames">${days.map(x => `<div class="${prog.days[x.k] ? 'lit' : ''} ${x.k === dayKey() ? 'today' : ''}" title="${x.d.toLocaleDateString('fr-FR')}">${prog.days[x.k] ? '🔥' : ''}<small>${x.d.getDate()}</small></div>`).join('')}</div>
    <p class="muted small">Une flamme par jour d’entraînement. ${isSleepy() ? `${name} s’est un peu endormi… réveille-le avec un mot ! 💤` : 'Garde ta flamme allumée !'}</p></div>

  <div class="section"><h3>🏅 Mes badges (${nb}/${BADGES.length})</h3>
    <div class="badges">${BADGES.map(b => `<div class="badge ${prog.badges[b.id] ? 'got' : ''}"><span>${prog.badges[b.id] ? b.e : '🔒'}</span><b>${esc(b.n)}</b><small>${esc(b.d)}</small></div>`).join('')}</div></div>

  <div class="section"><h3>🛍️ La boutique de ${name} <span class="coins">🪙 ${prog.coins}</span></h3>
    <p class="muted small">Gagne des pièces en jouant (1 pièce pour 2 étoiles) et offre des cadeaux à ${name} !</p>
    <h4>Accessoires</h4><div class="shop">${SHOP.acc.map(x => shopCard('acc', x)).join('')}</div>
    <h4>Décors</h4><div class="shop">${SHOP.decor.map(x => shopCard('decor', x)).join('')}</div></div>`;
  V().querySelectorAll('[data-buy]').forEach(bt => bt.onclick = () => buyOrEquip(bt.dataset.type, bt.dataset.buy));
}
function shopCard(type, x) {
  const own = owns(x.id), on = type === 'acc' ? prog.equip.acc === x.id : prog.equip.decor === x.id;
  const label = !own ? `${x.p} 🪙` : on ? (type === 'acc' ? 'Enlever' : 'Choisi ✓') : 'Mettre';
  return `<div class="shopitem ${on ? 'on' : ''}"><span class="sico">${x.e}</span><b>${esc(x.n)}</b><button class="btn small ${!own ? (prog.coins >= x.p ? 'primary' : '') : on ? 'green' : 'yellow'}" data-type="${type}" data-buy="${x.id}">${label}</button></div>`;
}
