'use strict';
/* Nouveaux jeux : mot en morceaux, lettre manquante, tri des terminaisons, chasse aux fautes, boss de fin de période. */
const splitHead = w => { const sp = w.lastIndexOf(' '); return [w.slice(0, sp + 1), w.slice(sp + 1)]; };

/* ---------- 🧩 Mot en morceaux ---------- */
const piecesOk = it => Array.from(splitHead(it.w)[1]).length >= 3;
function renderPieces() {
  const s = S.sess, it = s.cur, [head, tail] = splitHead(it.w), letters = Array.from(tail);
  let order = shuffle(letters.map((c, i) => ({ c, i })));
  for (let n = 0; n < 8 && order.map(o => o.c).join('') === tail; n++) order = shuffle(order);
  const placed = [];
  V().innerHTML = playHead() + `<div class="card">${hintLine(it)}<div class="word slots">${head ? `<span class="fixed">${esc(head.trim())}</span>` : ''}<span id="slots"></span></div>
    <div class="hint" id="h2">Touche les lettres dans le bon ordre.</div>
    <div class="actions"><button class="btn yellow" id="listen">🔊 Réécouter</button><button class="btn" id="undo">↩️ Effacer</button></div></div>
  <div class="ltiles" id="ltiles"></div><div class="feedback" id="fb" aria-live="polite"></div>
  <div class="actions"><button class="btn green" id="next" style="display:none">Mot suivant ➜</button></div>`;
  const draw = () => {
    $('slots').innerHTML = letters.map((_, k) => placed[k] != null ? `<button class="slot filled" data-k="${k}">${esc(order[placed[k]].c)}</button>` : '<span class="slot"></span>').join('');
    $('ltiles').innerHTML = order.map((o, j) => `<button class="ltile" data-j="${j}" ${placed.includes(j) ? 'disabled' : ''}>${esc(o.c)}</button>`).join('');
  };
  const check = () => {
    s.locked = true; const ans = head + placed.map(j => order[j].c).join(''), ok = sameWord(ans, it.w);
    $('h2').innerHTML = colorWord(it);
    feedback(ok, ok ? `${cheer()} Le mot est reconstruit ! +15 ⭐` : 'Presque ! Compare bien :' + diffHTML(ans, it.w));
    if (ok) bumpCounter('pieces'), bumpDaily('pieces');
    answer(ok, 15, { el: $('slots') });
    $('undo').disabled = true; $('next').style.display = ''; $('next').focus();
  };
  $('ltiles').onclick = e => { const b = e.target.closest('.ltile'); if (!b || s.locked) return; placed.push(+b.dataset.j); Sfx.play('tap'); draw(); if (placed.length === letters.length) check(); };
  $('slots').onclick = e => { const b = e.target.closest('.slot.filled'); if (!b || s.locked) return; placed.splice(+b.dataset.k, 1); draw(); };
  $('undo').onclick = () => { if (!s.locked) { placed.pop(); draw(); } };
  $('listen').onclick = () => speak(it.w); $('next').onclick = nextItem;
  draw(); later(() => speak(it.w), 250);
}

/* ---------- 🔤 La lettre manquante ---------- */
const TRAPS = [
  [/aient$/, ['aient', 'ait', 'ais', 'ent']], [/ais$/, ['ais', 'ait', 'aient', 'é']], [/ait$/, ['ait', 'ais', 'aient', 'é']],
  [/ions$/, ['ions', 'ons', 'iont']], [/iez$/, ['iez', 'ier', 'ez']], [/eons$/, ['eons', 'ons', 'ont']], [/ons$/, ['ons', 'ont', 'on']],
  [/ez$/, ['ez', 'er', 'é']], [/ent$/, ['ent', 'e', 'es']], [/eaux$/, ['eaux', 'aux', 'eaus']], [/eau$/, ['eau', 'o', 'au']],
  [/é/, ['é', 'è', 'ê', 'e']], [/è/, ['è', 'é', 'ê', 'ai']], [/ê/, ['ê', 'è', 'é', 'e']], [/â/, ['â', 'a']], [/à/, ['à', 'a']], [/ç/, ['ç', 'c', 'ss']],
  [/ff/, ['ff', 'f']], [/mm/, ['mm', 'm']], [/nn/, ['nn', 'n']], [/ll/, ['ll', 'l']], [/tt/, ['tt', 't']], [/ss/, ['ss', 's', 'c']], [/rr/, ['rr', 'r']],
  [/an/, ['an', 'en', 'em']], [/en/, ['en', 'an', 'em']], [/qu/, ['qu', 'k', 'c']], [/s$/, ['s', 'x', '']], [/x$/, ['x', 's', '']], [/e$/, ['e', 'es', '']]
];
function trapsOf(w) {
  const [head, tail] = splitHead(w), out = [];
  TRAPS.forEach(([re, opts], ri) => { const m = re.exec(tail); if (m) out.push({ head, tail, idx: m.index, txt: m[0], opts, end: ri < 11 }); });
  return out;
}
const missingOk = it => trapsOf(it.w).length > 0;
function renderMissing() {
  const s = S.sess, it = s.cur, all = trapsOf(it.w), ends = all.filter(t => t.end);
  const t = ends.length && Math.random() < .6 ? pickOne(ends) : pickOne(all);
  const opts = shuffle([...new Set(t.opts)]).slice(0, 4); if (!opts.includes(t.txt)) opts[0] = t.txt;
  const before = t.head + t.tail.slice(0, t.idx), after = t.tail.slice(t.idx + t.txt.length);
  V().innerHTML = playHead() + `<div class="card">${hintLine(it)}<div class="word">${esc(before)}<span class="gap" id="gap">?</span>${esc(after)}</div>
    <div class="hint">Quelle(s) lettre(s) manque(nt) ?</div><div class="actions"><button class="btn yellow" id="listen">🔊 Réécouter</button></div></div>
  <div class="options" id="opts">${shuffle(opts).map(o => `<button class="option" data-o="${esc(o)}">${o ? esc(o) : '∅ rien'}</button>`).join('')}</div>
  <div class="feedback" id="fb" aria-live="polite"></div><div class="actions"><button class="btn primary" id="next" disabled>Mot suivant ➜</button></div>`;
  [...$('opts').children].forEach(b => b.onclick = () => {
    if (s.locked) return; s.locked = true; const ok = b.dataset.o === t.txt;
    b.classList.add(ok ? 'correct' : 'wrong'); [...$('opts').children].find(x => x.dataset.o === t.txt).classList.add('correct');
    $('gap').textContent = t.txt || '∅'; $('gap').classList.add(ok ? 'gap-ok' : 'gap-bad');
    feedback(ok, ok ? `${cheer()} C’est bien « ${esc(it.w)} » ! +10 ⭐` : `Le mot s’écrit : <b>${colorWord(it)}</b>`);
    if (ok) bumpCounter('missing'), bumpDaily('missing');
    answer(ok, 10, { el: b }); $('next').disabled = false; $('next').focus();
  });
  $('listen').onclick = () => speak(it.w); $('next').onclick = nextItem; later(() => speak(it.w), 250);
}

/* ---------- 📦 Le tri des terminaisons ---------- */
const PRON = /^(je |j'|tu |il |elle |on |nous |vous |ils |elles )/;
const BOXES = [['je', 'je / j’'], ['tu', 'tu'], ['il', 'il / elle'], ['nous', 'nous'], ['vous', 'vous'], ['ils', 'ils / elles']];
function triInfo(w) {
  const m = w.match(PRON); if (!m) return null;
  const verb = w.slice(m[0].length); if (!verb || /\s/.test(verb)) return null;
  let valid;
  if (/ons$/.test(verb)) valid = ['nous']; else if (/ez$/.test(verb)) valid = ['vous'];
  else if (/(ent|ont)$/.test(verb)) valid = ['ils']; else if (/(t|a)$/.test(verb)) valid = ['il'];
  else if (/(s|x)$/.test(verb)) valid = ['je', 'tu']; else if (/e$/.test(verb)) valid = ['je', 'il'];
  else { const p = m[0].trim().replace("j'", 'je').replace('elles', 'ils').replace('elle', 'il').replace('on', 'il'); valid = [p]; }
  return { verb, valid };
}
const triOk = it => it.k === 'verbe' && !!triInfo(it.w);
function renderTri() {
  const s = S.sess, it = s.cur, info = triInfo(it.w);
  s.boxes = s.boxes || {};
  V().innerHTML = playHead() + `<div class="card">${hintLine(it)}<div class="word" id="w">… ${esc(info.verb)}</div>
    <div class="hint" id="h2">Dans quelle boîte ranges-tu ce verbe ? Regarde bien la terminaison !</div></div>
  <div class="triboxes" id="boxes">${BOXES.map(([k, l]) => `<button class="tribox" data-b="${k}"><b>${l}</b><small>${(s.boxes[k] || []).slice(-2).map(esc).join('<br>') || '&nbsp;'}</small></button>`).join('')}</div>
  <div class="feedback" id="fb" aria-live="polite"></div><div class="actions"><button class="btn primary" id="next" disabled>Verbe suivant ➜</button></div>`;
  $('boxes').onclick = e => {
    const b = e.target.closest('.tribox'); if (!b || s.locked) return; s.locked = true;
    const k = b.dataset.b, ok = info.valid.includes(k);
    const full = ok ? (k === 'je' && /^[aeiouéèêh]/i.test(info.verb) ? "j'" : k + ' ') + info.verb : it.w;
    b.classList.add(ok ? 'correct' : 'wrong');
    if (!ok) $('boxes').querySelectorAll('.tribox').forEach(x => { if (info.valid.includes(x.dataset.b)) x.classList.add('correct'); });
    else { (s.boxes[k] = s.boxes[k] || []).push(info.verb); b.querySelector('small').innerHTML = s.boxes[k].slice(-2).map(esc).join('<br>'); }
    $('w').innerHTML = ok ? esc(full.slice(0, full.length - info.verb.length)) + colorWord({ ...it, w: info.verb, h: it.h, k: 'verbe-nu' }) : colorWord(it);
    feedback(ok, ok ? `${cheer()} « ${esc(full)} » +10 ⭐${info.valid.length > 1 ? ` <span class="muted small">(ça marche aussi avec « ${info.valid.filter(v => v !== k).join(', ')} »)</span>` : ''}` : `Avec cette terminaison, c’est : <b>${info.valid.join(' ou ')}</b> → ${colorWord(it)}`);
    if (ok) bumpCounter('tri'), bumpDaily('tri');
    answer(ok, 10, { el: b }); speak(full); $('next').disabled = false; $('next').focus();
  };
  $('next').onclick = nextItem;
}

/* ---------- 🔎 La chasse aux fautes ---------- */
function huntPool() {
  let ph = scopePhrases(); if (!ph.length) ph = curPeriod().weeks.flatMap(w => w.phrases);
  return [...new Set(ph)].map(p => ({ w: p, k: '', src: 'Phrase' }));
}
function buildHunt(phrase) {
  const tokens = phrase.split(' '), cand = [];
  tokens.forEach((t, i) => { const core = t.replace(/[.,!?;:«»]/g, ''); if (Array.from(core).length >= 2 && /\p{L}/u.test(core)) cand.push(i); });
  const nErr = Math.min(cand.length, tokens.length >= 5 ? 1 + rand(2) : 1), wrong = new Set(), shown = [...tokens];
  shuffle(cand).forEach(i => {
    if (wrong.size >= nErr) return;
    const t = tokens[i], m = t.match(/^([«"]?)(.*?)([.,!?;:»"]*)$/), core = m[2], cap = core[0] !== core[0].toLocaleLowerCase('fr-FR');
    const alts = makeChoices(core.toLocaleLowerCase('fr-FR')).slice(1); if (!alts.length) return;
    let alt = pickOne(alts); if (cap) alt = alt[0].toLocaleUpperCase('fr-FR') + alt.slice(1);
    shown[i] = m[1] + alt + m[3]; wrong.add(i);
  });
  return { tokens, shown, wrong };
}
function renderHunt() {
  const s = S.sess, it = s.cur, h = buildHunt(it.w), marked = new Set();
  const n = h.wrong.size;
  V().innerHTML = playHead() + `<div class="card"><div class="hint">🔎 Il y a <b>${n} faute${n > 1 ? 's' : ''}</b> cachée${n > 1 ? 's' : ''} dans cette phrase. Touche les mots mal écrits !</div>
    <div class="hunt" id="hunt">${h.shown.map((t, i) => `<button class="htok" data-i="${i}">${esc(t)}</button>`).join(' ')}</div>
    <div class="actions"><button class="btn yellow" id="listen">🔊 Écouter la phrase</button></div></div>
  <div class="feedback" id="fb" aria-live="polite"></div>
  <div class="actions"><button class="btn primary" id="check">J’ai fini ✓</button><button class="btn green" id="next" style="display:none">Phrase suivante ➜</button></div>`;
  $('hunt').onclick = e => { const b = e.target.closest('.htok'); if (!b || s.locked) return; const i = +b.dataset.i; marked.has(i) ? marked.delete(i) : marked.add(i); b.classList.toggle('marked'); Sfx.play('tap'); };
  $('check').onclick = () => {
    if (s.locked) return; s.locked = true;
    let found = 0, wrongTaps = 0;
    $('hunt').querySelectorAll('.htok').forEach(b => {
      const i = +b.dataset.i, isWrong = h.wrong.has(i), m = marked.has(i);
      if (isWrong && m) { found++; b.classList.add('found'); b.innerHTML = `<s>${esc(h.shown[i])}</s> ${esc(h.tokens[i])}`; }
      else if (isWrong) { b.classList.add('missed'); b.innerHTML = `<s>${esc(h.shown[i])}</s> ${esc(h.tokens[i])}`; }
      else if (m) { wrongTaps++; b.classList.add('falsetap'); }
    });
    const ok = found === n && wrongTaps === 0;
    feedback(ok, ok ? `${cheer()} Tu as trouvé toutes les fautes ! +${found * 10} ⭐` : `Tu as trouvé ${found} faute${found > 1 ? 's' : ''} sur ${n}${wrongTaps ? ` (et ${wrongTaps} mot${wrongTaps > 1 ? 's' : ''} étai${wrongTaps > 1 ? 'en' : ''}t bien écrit${wrongTaps > 1 ? 's' : ''})` : ''}.`);
    if (found) { bumpCounter('hunt', found); bumpDaily('hunt', found); }
    answer(ok, found * 10, { el: $('hunt'), noRecord: true });
    $('check').style.display = 'none'; $('next').style.display = ''; $('next').focus();
  };
  $('listen').onclick = () => speak(it.w); $('next').onclick = nextItem;
}

/* ---------- 🐲 Le boss de fin de période ---------- */
const BOSSES = [
  { e: '👾', n: 'le Gobe-Lettres' }, { e: '☃️', n: 'le Bonhomme des Neiges farceur' }, { e: '🦖', n: 'le Dino des Dictées' },
  { e: '🐙', n: 'la Pieuvre à Fautes' }, { e: '🧙', n: 'le Sorcier des Accents' }
];
const bossFor = p => BOSSES[Math.max(0, data.periods.indexOf(p)) % BOSSES.length];
function bossUnlocked() {
  const p = curPeriod(); if (data.settings.bossUnlocked) return true;
  const d = daysLeft(p); return curWeek() === p.weeks[p.weeks.length - 1] || (d !== null && d <= 14);
}
function bossCardHTML() {
  const p = curPeriod(), b = bossFor(p), d = daysLeft(p), unlocked = bossUnlocked(), beaten = prog.bossBeaten[p.id];
  return `<div class="bigmode boss ${unlocked ? '' : 'locked'}"><h3>${b.e} Le boss de la ${esc(p.name.toLowerCase())}</h3>
    <p>${unlocked ? `${esc(b.n[0].toUpperCase() + b.n.slice(1))} a volé tous les mots de la période ! Bats-le avant la grande dictée.` : `🔒 Il se réveille 14 jours avant la grande dictée${d !== null && d > 14 ? ` (dans ${d - 14} jour${d - 14 > 1 ? 's' : ''})` : ''} ou à la dernière semaine.`}</p>
    ${beaten ? '<p class="muted small">🏆 Déjà battu ! Tu peux le combattre encore.</p>' : ''}
    <button class="btn primary" id="goBoss" ${unlocked ? '' : 'disabled'}>Combattre ⚔️</button></div>`;
}
function startBoss() {
  const pool = scopePool({ type: 'period' }); if (pool.length < 4) { toast('Pas assez de mots dans cette période.'); return; }
  stopAll(); S.view = 'boss';
  const p = curPeriod(), b = bossFor(p);
  S.boss = { p, b, pool, hp: 150, max: 150, hearts: 5, count: 0, retry: [], recent: [], cur: null, locked: false, combo: 0 };
  V().innerHTML = topBar('⚔️ Le boss') + `<div class="card"><div class="bossface">${b.e}</div><h2>${esc(b.n[0].toUpperCase() + b.n.slice(1))}</h2>
    <p>Il a volé les mots de la ${esc(p.name.toLowerCase())} ! Chaque bonne réponse lui fait perdre des points de vie.<br>Attention : à chaque erreur, tu perds un ❤️ et il reprend des forces.</p></div>
    <div class="actions"><button class="btn primary" id="fight">Combattre ⚔️</button></div>`;
  $('fight').onclick = bossNext; say('Je suis avec toi, on va le battre !');
}
function bossHead() {
  const B = S.boss;
  return topBar('⚔️ ' + esc(B.b.n), '') + `<div class="bossbar"><span class="bossface small" id="bface">${B.b.e}</span><div class="hp"><span style="width:${B.hp / B.max * 100}%"></span></div><b>${Math.max(0, B.hp)} PV</b></div>
    <div class="hearts">${'❤️'.repeat(B.hearts)}${'🤍'.repeat(5 - B.hearts)}${B.combo >= 3 ? ` <span class="combo">🔥 Combo ×${B.combo}</span>` : ''}</div>`;
}
function bossNext() {
  stopAll(); freshView(); const B = S.boss;
  B.cur = pick(B); B.locked = false; const it = B.cur, typing = B.count % 3 === 2;
  const dmg = typing ? 25 : 12;
  if (typing) {
    V().innerHTML = bossHead() + `<div class="card">${hintLine(it)}<div class="word" id="w">🎧 ???</div><div class="hint">Attaque spéciale : écris le mot ! (${dmg} dégâts)</div><div class="actions"><button class="btn yellow" id="listen">🔊 Écouter</button></div></div>
      ${inputHTML('Écris le mot…')}<div class="feedback" id="fb"></div><div class="actions"><button class="btn primary" id="check">Attaquer ⚔️</button><button class="btn green" id="next" style="display:none">Continuer ➜</button></div>`;
    const go = () => { if (B.locked) return; const v = $('answer').value; if (!normAnswer(v)) { feedback(null, 'Écris d’abord le mot 🙂'); return; } bossResolve(sameWord(v, it.w), dmg, v); };
    $('check').onclick = go; $('answer').addEventListener('keydown', e => { if (e.key === 'Enter') (B.locked ? $('next') : $('check')).click(); });
    later(() => $('answer') && $('answer').focus(), 300);
  } else {
    V().innerHTML = bossHead() + `<div class="card">${hintLine(it)}<div class="word">🔊 ???</div><div class="actions"><button class="btn yellow" id="listen">🔊 Écouter</button></div></div>
      <div class="options" id="opts">${shuffle(makeChoices(it.w)).map(c => `<button class="option">${esc(c)}</button>`).join('')}</div>
      <div class="feedback" id="fb"></div><div class="actions"><button class="btn green" id="next" style="display:none">Continuer ➜</button></div>`;
    [...$('opts').children].forEach(b => b.onclick = () => {
      if (B.locked) return; const ok = b.textContent === it.w;
      b.classList.add(ok ? 'correct' : 'wrong'); [...$('opts').children].find(x => x.textContent === it.w).classList.add('correct');
      bossResolve(ok, dmg);
    });
  }
  $('listen').onclick = () => speak(it.w); $('next').onclick = bossNext; later(() => speak(it.w), 300);
}
function bossResolve(ok, dmg, typed) {
  const B = S.boss, it = B.cur; B.locked = true; B.count++; B.recent.push(it.w);
  record(it.w, ok); streakUpdate(ok);
  const face = $('bface');
  if (ok) {
    B.combo++; const hit = dmg + (B.combo >= 3 ? 5 : 0); B.hp -= hit;
    Sfx.play('hit'); face.classList.add('hit'); floatAt(face, '-' + hit + ' 💥');
    feedback(true, `${cheer()} −${hit} PV pour ${esc(B.b.n)} !`);
  } else {
    B.combo = 0; B.hearts--; B.hp = Math.min(B.max, B.hp + 10);
    B.retry.push({ item: { ...it, retry: false }, due: B.count + 3 });
    Sfx.play('hurt'); document.querySelector('.hearts').classList.add('shake');
    feedback(false, `Aïe ! Le mot était <b>${colorWord(it)}</b>${typed ? diffHTML(typed, it.w) : ''}`);
  }
  if ($('w')) $('w').innerHTML = colorWord(it);
  const hpb = document.querySelector('.hp span'); if (hpb) hpb.style.width = Math.max(0, B.hp / B.max * 100) + '%';
  const hb = document.querySelector('.bossbar b'); if (hb) hb.textContent = Math.max(0, B.hp) + ' PV';
  const hearts = document.querySelector('.hearts'); if (hearts) hearts.firstChild.textContent = '❤️'.repeat(B.hearts) + '🤍'.repeat(5 - B.hearts);
  updateHeader(); save();
  if (B.hp <= 0) return later(bossWin, 900);
  if (B.hearts <= 0) return later(bossLose, 1400);
  const ck = $('check'); if (ck) ck.style.display = 'none';
  $('next').style.display = ''; $('next').focus();
}
function bossWin() {
  const B = S.boss; stopAll();
  const first = !prog.bossBeaten[B.p.id]; prog.bossBeaten[B.p.id] = true; bumpCounter('bossWins');
  Sfx.play('win'); confetti(40);
  V().innerHTML = topBar('🏆 Victoire !') + `<div class="card"><div class="bossface defeated">${B.b.e}</div><h2>Tu as battu ${esc(B.b.n)} !</h2>
    <p>Les mots de la ${esc(B.p.name.toLowerCase())} sont sauvés. Tu es prêt pour la grande dictée ! ${first ? '<br><b>Bonus de première victoire : +150 ⭐</b>' : '+60 ⭐'}</p></div>
    <div class="actions"><button class="btn primary" id="again">Rejouer ⚔️</button><button class="btn" data-back>Menu</button></div>`;
  logSession('boss', 1, 1); gain(first ? 150 : 60, $('again')); checkBadges();
  say(`On a gagné ! Tu es un héros, ${data.settings.childName} !`);
  $('again').onclick = startBoss;
}
function bossLose() {
  const B = S.boss; stopAll(); Sfx.play('lose');
  V().innerHTML = topBar('⚔️ Le boss') + `<div class="card"><div class="bossface">${B.b.e}</div><h2>${esc(B.b.n[0].toUpperCase() + B.b.n.slice(1))} s’est enfui…</h2>
    <p>Il ne lui restait que <b>${B.hp} PV</b> ! Révise les mots ratés et reviens le battre.</p></div>
    <div class="actions"><button class="btn primary" id="again">Réessayer ⚔️</button><button class="btn" data-back>Menu</button></div>`;
  logSession('boss', 0, 1); gain(B.count * 3); checkBadges();
  say('Presque ! La prochaine fois, on l’aura.');
  $('again').onclick = startBoss;
}
function floatAt(el, txt) {
  const r = el.getBoundingClientRect(), f = mk('floatat', esc(txt));
  f.style.left = (r.left + r.width / 2) + 'px'; f.style.top = r.top + 'px'; fx(f, 1100);
}
