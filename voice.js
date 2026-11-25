'use strict';
/* « Ma voix » : enregistrements des mots et phrases par un parent, gardés sur l'appareil (IndexedDB).
   Quand un enregistrement existe, il remplace la voix de synthèse. */
const Voice = {
  db: null, keys: new Set(), urls: {}, cur: null, rec: null,
  open() {
    return new Promise(res => {
      if (!('indexedDB' in window)) return res(null);
      try {
        const r = indexedDB.open('missionDicteeAudio', 1);
        r.onupgradeneeded = () => r.result.createObjectStore('clips');
        r.onsuccess = () => { this.db = r.result; res(this.db); };
        r.onerror = () => res(null);
      } catch (e) { res(null); }
    });
  },
  async init() {
    await this.open(); if (!this.db) return;
    await new Promise(res => {
      const req = this.db.transaction('clips').objectStore('clips').getAllKeys();
      req.onsuccess = () => { req.result.forEach(k => this.keys.add(k)); res(); };
      req.onerror = () => res();
    });
  },
  key: t => normAnswer(t),
  exists(t) { return this.keys.has(this.key(t)); },
  has(t) { return data.settings.useRecordings && this.exists(t); },
  get(t) {
    return new Promise(res => {
      if (!this.db) return res(null);
      const req = this.db.transaction('clips').objectStore('clips').get(this.key(t));
      req.onsuccess = () => res(req.result || null); req.onerror = () => res(null);
    });
  },
  put(t, blob) {
    return new Promise(res => {
      const k = this.key(t), tx = this.db.transaction('clips', 'readwrite');
      tx.objectStore('clips').put(blob, k);
      tx.oncomplete = () => { this.keys.add(k); if (this.urls[k]) { URL.revokeObjectURL(this.urls[k]); delete this.urls[k]; } res(true); };
      tx.onerror = () => res(false);
    });
  },
  del(t) {
    return new Promise(res => {
      const k = this.key(t), tx = this.db.transaction('clips', 'readwrite');
      tx.objectStore('clips').delete(k);
      tx.oncomplete = () => { this.keys.delete(k); delete this.urls[k]; res(true); };
      tx.onerror = () => res(false);
    });
  },
  async play(t, rate = 1) {
    const k = this.key(t); let url = this.urls[k];
    if (!url) { const b = await this.get(t); if (!b) return false; url = this.urls[k] = URL.createObjectURL(b); }
    this.stop();
    const a = new Audio(url); a.playbackRate = rate; this.cur = a;
    await new Promise(r => { a.onended = r; a.onerror = r; a.onpause = r; a.play().catch(r); });
    return true;
  },
  stop() { if (this.cur) { const a = this.cur; this.cur = null; a.pause(); } },
  /* Enregistrement : start() puis stop() → Blob. S'arrête tout seul après maxMs. */
  async start(maxMs = 8000, tag = '') {
    if (!navigator.mediaDevices || !window.MediaRecorder) throw new Error('unsupported');
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    const mr = new MediaRecorder(stream), chunks = [];
    mr.ondataavailable = e => { if (e.data.size) chunks.push(e.data); };
    const done = new Promise(res => { mr.onstop = () => { stream.getTracks().forEach(t => t.stop()); res(new Blob(chunks, { type: mr.mimeType || 'audio/webm' })); }; });
    mr.start(); this.rec = { mr, done, t: tag, timer: setTimeout(() => this.stopRec(), maxMs) };
    if (this.onchange) this.onchange();
    return done;
  },
  stopRec() { if (this.rec) { clearTimeout(this.rec.timer); if (this.rec.mr.state !== 'inactive') this.rec.mr.stop(); this.rec = null; } }
};
