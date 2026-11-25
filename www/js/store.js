'use strict';
/* ===== Event bus, settings, IndexedDB storage, assets ===== */
const Bus = {
  m: {},
  on(n, f) { (this.m[n] ||= []).push(f); return f; },
  off(n, f) { const a = this.m[n]; if (a) { const i = a.indexOf(f); if (i >= 0) a.splice(i, 1); } },
  emit(n, ...a) { (this.m[n] || []).slice().forEach(f => { try { f(...a); } catch (e) { console.error('bus', n, e); } }); }
};

const ST = {
  D: {
    saveDialog: true, pressure: true, pressureSens: 1, laserOffset: false, laserOffsetY: 56, minimap: true,
    units: 'cm', handAfterShape: false, snapObjects: true, snapGrid: false, guides: true, scrollbars: true,
    dims: false, flow: true, showConn: true, penOnly: false, theme: 'light', author: 'Me', smart: 'hold',
    autosave: true, comments: true, wheel: 'auto', rulerSnap: true, laserType: 'trail', laserColor: '#ff3b30', laserSize: 10,
    selectMode: 'touch', eraseAll: false, autoSwitchSelect: false, ptrSmooth: 0.5
  },
  v: {},
  load() { let s = {}; try { s = JSON.parse(localStorage.getItem('ib.settings') || '{}'); } catch (e) { } this.v = Object.assign({}, this.D, s); },
  save() { try { localStorage.setItem('ib.settings', JSON.stringify(this.v)); } catch (e) { } },
  set(k, val) { this.v[k] = val; this.save(); Bus.emit('settings', k, val); },
  reset() { this.v = Object.assign({}, this.D); this.save(); Bus.emit('settings', '*'); }
};
ST.load();

/* ---------- IndexedDB ---------- */
const DB = {
  db: null, mem: { meta: new Map(), data: new Map(), assets: new Map(), versions: new Map() }, ok: false,
  open() {
    return new Promise(res => {
      if (!window.indexedDB) return res(false);
      let req; try { req = indexedDB.open('infiniboard', 1); } catch (e) { return res(false); }
      req.onupgradeneeded = () => {
        const d = req.result;
        d.createObjectStore('meta', { keyPath: 'id' });
        d.createObjectStore('data', { keyPath: 'id' });
        d.createObjectStore('assets', { keyPath: 'key' }).createIndex('bid', 'bid');
        d.createObjectStore('versions', { keyPath: 'id' }).createIndex('bid', 'bid');
      };
      req.onsuccess = () => { this.db = req.result; this.ok = true; res(true); };
      req.onerror = () => res(false);
    });
  },
  _r(rq) { return new Promise((res, rej) => { rq.onsuccess = () => res(rq.result); rq.onerror = () => rej(rq.error); }); },
  async put(store, val) { if (!this.ok) { this.mem[store].set(val.id || val.key, val); return; } const t = this.db.transaction(store, 'readwrite'); t.objectStore(store).put(val); return new Promise((r, j) => { t.oncomplete = r; t.onerror = () => j(t.error); }); },
  async get(store, key) { if (!this.ok) return this.mem[store].get(key); return this._r(this.db.transaction(store).objectStore(store).get(key)); },
  async del(store, key) { if (!this.ok) { this.mem[store].delete(key); return; } const t = this.db.transaction(store, 'readwrite'); t.objectStore(store).delete(key); return new Promise(r => t.oncomplete = r); },
  async all(store) { if (!this.ok) return [...this.mem[store].values()]; return this._r(this.db.transaction(store).objectStore(store).getAll()); },
  async byIndex(store, idx, key) { if (!this.ok) return [...this.mem[store].values()].filter(x => x[idx] === key); return this._r(this.db.transaction(store).objectStore(store).index(idx).getAll(key)); },
  async delByIndex(store, idx, key) { const l = await this.byIndex(store, idx, key); for (const x of l) await this.del(store, x.key || x.id); }
};

/* ---------- Assets (blobs referenced by objects) ---------- */
const AS = {
  map: new Map(),
  async add(blob, name) {
    const id = U.uid('a');
    this.map.set(id, { id, blob, mime: blob.type || 'application/octet-stream', name: name || 'file', size: blob.size, dirty: true });
    Bus.emit('assets'); return id;
  },
  get(id) { return this.map.get(id); },
  url(id) { const e = this.map.get(id); if (!e) return ''; if (!e.url) e.url = URL.createObjectURL(e.blob); return e.url; },
  img(id) {
    const e = this.map.get(id); if (!e) return null;
    if (!e.img) { e.img = new Image(); e.img.onload = () => { if ((typeof R !== 'undefined' && R)) R.req(); }; e.img.src = this.url(id); }
    return e.img.complete && e.img.naturalWidth ? e.img : null;
  },
  media(id, kind) {
    const e = this.map.get(id); if (!e) return null;
    if (!e.el) {
      const m = document.createElement(kind); m.preload = 'auto'; m.playsInline = true; m.src = this.url(id);
      m.addEventListener('loadeddata', () => R.req()); m.addEventListener('seeked', () => R.req()); m.addEventListener('timeupdate', () => R.req());
      m.addEventListener('play', () => { this.playing.add(id); R.req(); }); m.addEventListener('pause', () => { this.playing.delete(id); R.req(); });
      m.addEventListener('ended', () => { this.playing.delete(id); R.req(); });
      e.el = m;
    }
    return e.el;
  },
  playing: new Set(),
  async saveDirty(bid) {
    for (const e of this.map.values()) if (e.dirty) { await DB.put('assets', { key: bid + '|' + e.id, bid, id: e.id, blob: e.blob, mime: e.mime, name: e.name, size: e.size }); e.dirty = false; }
  },
  async loadAll(bid) {
    this.clear();
    const l = await DB.byIndex('assets', 'bid', bid);
    l.forEach(x => this.map.set(x.id, { id: x.id, blob: x.blob, mime: x.mime, name: x.name, size: x.size }));
  },
  clear() { this.map.forEach(e => { if (e.url) URL.revokeObjectURL(e.url); if (e.el) { try { e.el.pause(); } catch (_) { } e.el.removeAttribute('src'); } }); this.map.clear(); this.playing.clear(); },
  async gc(bid, used) {
    for (const e of [...this.map.values()]) if (!used.has(e.id) && !e.keep) { /* keep until reload: undo may need it */ }
  }
};
