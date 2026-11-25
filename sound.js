'use strict';
/* Petits sons synthétisés (aucun fichier à télécharger) + étoiles qui volent vers le compteur. */
const Sfx = {
  ctx: null,
  ensure() {
    if (!this.ctx) { const A = window.AudioContext || window.webkitAudioContext; if (!A) return null; this.ctx = new A(); }
    if (this.ctx.state === 'suspended') this.ctx.resume();
    return this.ctx;
  },
  tone(f, t0, d, type = 'sine', g = 0.16, f2) {
    const c = this.ctx, t = c.currentTime + t0, o = c.createOscillator(), v = c.createGain();
    o.type = type; o.frequency.setValueAtTime(f, t); if (f2) o.frequency.exponentialRampToValueAtTime(f2, t + d);
    v.gain.setValueAtTime(0.0001, t); v.gain.exponentialRampToValueAtTime(g, t + 0.02); v.gain.exponentialRampToValueAtTime(0.0001, t + d);
    o.connect(v).connect(c.destination); o.start(t); o.stop(t + d + 0.05);
  },
  play(name) {
    if (!data.settings.sounds) return;
    const c = this.ensure(); if (!c) return;
    const T = this.tone.bind(this);
    switch (name) {
      case 'good': T(660, 0, .14); T(990, .09, .28); break;
      case 'bad': T(330, 0, .3, 'triangle', .14, 210); break;
      case 'tap': T(760, 0, .05, 'square', .04); break;
      case 'coin': T(988, 0, .08, 'square', .06); T(1319, .07, .22, 'square', .06); break;
      case 'streak': [784, 988, 1175, 1568].forEach((f, i) => T(f, i * .07, .16, 'sine', .14)); break;
      case 'level': [523, 659, 784, 1047].forEach((f, i) => T(f, i * .13, .3, 'triangle', .17)); T(1319, .55, .6, 'triangle', .14); break;
      case 'badge': [880, 1109, 1319, 1760].forEach((f, i) => T(f, i * .09, .26, 'sine', .13)); break;
      case 'hit': T(220, 0, .22, 'sawtooth', .1, 70); T(1100, 0, .07, 'square', .05); break;
      case 'hurt': T(280, 0, .4, 'triangle', .15, 120); break;
      case 'tick': T(1250, 0, .04, 'square', .035); break;
      case 'win': [523, 523, 523, 659, 784, 659, 784, 1047].forEach((f, i) => T(f, [0, .12, .24, .36, .6, .78, .9, 1.05][i], .22, 'triangle', .16)); break;
      case 'lose': [440, 392, 349, 262].forEach((f, i) => T(f, i * .2, .3, 'triangle', .13)); break;
      case 'hatch': T(300, 0, .08, 'square', .05); T(340, .25, .08, 'square', .05); T(380, .5, .08, 'square', .05); T(200, .9, .3, 'sawtooth', .08, 900); break;
    }
  }
};

function flyStars(from, n = 5) {
  const target = document.getElementById('xp');
  if (!from || !target) return;
  const a = from.getBoundingClientRect(), b = target.getBoundingClientRect();
  for (let i = 0; i < n; i++) {
    const s = document.createElement('span');
    s.className = 'flystar'; s.textContent = '⭐';
    const x = a.left + a.width / 2 + (Math.random() - .5) * a.width * .6, y = a.top + a.height / 2 + (Math.random() - .5) * 10;
    s.style.left = x + 'px'; s.style.top = y + 'px'; s.style.transitionDelay = (i * 70) + 'ms';
    document.getElementById('fx').appendChild(s);
    void s.offsetWidth;
    s.style.transform = `translate(${b.left + b.width / 2 - x}px, ${b.top + b.height / 2 - y}px) scale(.55)`;
    s.style.opacity = '.25';
    setTimeout(() => s.remove(), 1000 + i * 70);
  }
  setTimeout(() => { const st = target.parentElement; st.classList.remove('pulse'); void st.offsetWidth; st.classList.add('pulse'); }, 750);
}
