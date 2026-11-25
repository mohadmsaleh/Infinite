'use strict';
/* ===== Object type registry, geometry, document model, history, selection ===== */
const T = {
  reg: {},
  def(name, spec) { spec.name = name; this.reg[name] = spec; return spec; },
  get(t) { return this.reg[t] || this.reg.shape; }
};

const G = {
  center: o => [o.x + o.w / 2, o.y + o.h / 2],
  toLocal(o, wx, wy) {
    const cx = o.x + o.w / 2, cy = o.y + o.h / 2;
    if (!o.rot) return [wx - o.x, wy - o.y];
    const [rx, ry] = U.rotPt(wx, wy, cx, cy, -o.rot);
    return [rx - o.x, ry - o.y];
  },
  toWorld(o, lx, ly) {
    const cx = o.x + o.w / 2, cy = o.y + o.h / 2;
    if (!o.rot) return [o.x + lx, o.y + ly];
    return U.rotPt(o.x + lx, o.y + ly, cx, cy, o.rot);
  },
  corners(o) { return [[0, 0], [o.w, 0], [o.w, o.h], [0, o.h]].map(p => G.toWorld(o, p[0], p[1])); },
  aabb(o) {
    const t = T.get(o.type);
    if (t.bounds) return t.bounds(o);
    const pad = t.pad ? t.pad(o) : 0;
    if (!o.rot) return { x: o.x - pad, y: o.y - pad, w: o.w + 2 * pad, h: o.h + 2 * pad };
    const c = G.corners(o); const xs = c.map(p => p[0]), ys = c.map(p => p[1]);
    const x0 = Math.min(...xs), y0 = Math.min(...ys);
    return { x: x0 - pad, y: y0 - pad, w: Math.max(...xs) - x0 + 2 * pad, h: Math.max(...ys) - y0 + 2 * pad };
  },
  union(objs) {
    if (!objs.length) return null;
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    for (const o of objs) { const b = G.aabb(o); x0 = Math.min(x0, b.x); y0 = Math.min(y0, b.y); x1 = Math.max(x1, b.x + b.w); y1 = Math.max(y1, b.y + b.h); }
    return { x: x0, y: y0, w: x1 - x0, h: y1 - y0 };
  },
  hit(o, wx, wy, tol = 0) {
    const t = T.get(o.type);
    if (t.hitWorld) return t.hitWorld(o, wx, wy, tol);
    const [lx, ly] = G.toLocal(o, wx, wy);
    if (t.hit) return t.hit(o, lx, ly, tol);
    return lx >= -tol && ly >= -tol && lx <= o.w + tol && ly <= o.h + tol;
  },
  unflip(o, lx, ly) { return [o.fx ? o.w - lx : lx, o.fy ? o.h - ly : ly]; },
  inRect(o, r, contain) {
    const b = G.aabb(o);
    if (contain) return b.x >= r.x && b.y >= r.y && b.x + b.w <= r.x + r.w && b.y + b.h <= r.y + r.h;
    return !(b.x > r.x + r.w || b.x + b.w < r.x || b.y > r.y + r.h || b.y + b.h < r.y);
  },
  rectsHit: (a, b) => !(a.x > b.x + b.w || a.x + a.w < b.x || a.y > b.y + b.h || a.y + a.h < b.y),
  pointInPoly(x, y, poly) {
    let c = false;
    for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
      const [xi, yi] = poly[i], [xj, yj] = poly[j];
      if ((yi > y) !== (yj > y) && x < (xj - xi) * (y - yi) / (yj - yi) + xi) c = !c;
    }
    return c;
  }
};

const COMMON = { x: 0, y: 0, w: 100, h: 100, rot: 0, fx: false, fy: false, layer: null, locked: false, op: 1, sh: null, link: null, gid: null };

const D = {
  id: null, name: 'Untitled', created: 0, modified: 0, bg: '#ffffff', grid: { type: 'dots', size: 24 },
  layers: [], active: null, objs: [], byId: new Map(), comments: [], view: { x: -200, y: -150, z: 1 },
  hist: [], hi: -1, dirty: false, _ord: null, openJson: null, kind: 'board', extra: {},

  reset(name, kind) {
    D.kind = kind || 'board'; D.extra = {};
    D.id = U.uid('b'); D.name = name || 'Untitled board'; D.created = D.modified = Date.now();
    D.bg = D.kind === 'study' ? '#e8ebf1' : '#ffffff'; D.grid = { type: D.kind === 'study' ? 'none' : 'dots', size: 24 };
    const l = { id: U.uid('L'), n: 'Layer 1', v: true, l: false, o: 1 };
    D.layers = [l]; D.active = l.id; D.objs = []; D.byId = new Map(); D.comments = []; D.view = { x: -300, y: -200, z: 1 };
    D._ord = null; D.hist = []; D.hi = -1; D.dirty = false;
  },
  make(type, props = {}) {
    const t = T.reg[type]; if (!t) throw new Error('Unknown type ' + type);
    const o = Object.assign({ id: U.uid(), type }, JSON.parse(JSON.stringify(COMMON)), t.def ? JSON.parse(JSON.stringify(t.def())) : {}, props);
    if (!o.layer) o.layer = D.active;
    return o;
  },
  add(o, at) { D.objs.push(o); D.byId.set(o.id, o); D._ord = null; return o; },
  addAll(l) { l.forEach(o => D.add(o)); return l; },
  remove(list) {
    const ids = new Set(list.map(o => typeof o === 'string' ? o : o.id));
    // detach connectors
    for (const o of D.objs) if (o.type === 'connector' && !ids.has(o.id)) {
      for (const k of ['from', 'to']) if (o[k] && o[k].id && ids.has(o[k].id)) {
        const p = Conn.endPoint(o, k); o[k] = { p: [p.x, p.y] }; delete o._j;
      }
    }
    D.objs = D.objs.filter(o => !ids.has(o.id)); ids.forEach(id => D.byId.delete(id));
    D.comments = D.comments.filter(c => !ids.has(c.obj));
    D._ord = null;
  },
  layerOf(o) { return D.layers.find(l => l.id === o.layer) || D.layers[0]; },
  layerIdx(o) { const i = D.layers.findIndex(l => l.id === o.layer); return i < 0 ? 0 : i; },
  isVisible(o) { return D.layerOf(o).v !== false; },
  isLocked(o) { return o.locked || D.layerOf(o).l; },
  invalidate() { D._ord = null; },
  sorted() {
    if (D._ord) return D._ord;
    const fr = [], rest = [];
    D.objs.forEach((o, i) => { (o.type === 'frame' ? fr : rest).push([o, i]); });
    rest.sort((a, b) => (D.layerIdx(a[0]) - D.layerIdx(b[0])) || (a[1] - b[1]));
    D._ord = fr.map(x => x[0]).concat(rest.map(x => x[0]));
    return D._ord;
  },
  members(o) { return o.gid ? D.objs.filter(x => x.gid === o.gid) : [o]; },
  frames() { return D.objs.filter(o => o.type === 'frame'); },
  oj(o) { return o._j || (o._j = JSON.stringify(o, (k, v) => k[0] === '_' ? undefined : v)); },
  metaJSON() { return JSON.stringify({ bg: D.bg, grid: D.grid, layers: D.layers, active: D.active, comments: D.comments }); },
  snapshot(label) { return { label, t: Date.now(), objs: D.objs.map(o => [o.id, D.oj(o)]), meta: D.metaJSON() }; },
  commit(label = 'Edit', touched) {
    if (touched === 'all') D.objs.forEach(o => delete o._j);
    else if (touched) [].concat(touched).forEach(o => { if (o) delete o._j; });
    D._ord = null;
    const s = D.snapshot(label);
    D.hist.length = D.hi + 1; D.hist.push(s);
    if (D.hist.length > 300) D.hist.shift();
    D.hi = D.hist.length - 1;
    D.modified = Date.now(); D.dirty = true; D.queueSave();
    R.req(); Bus.emit('commit', label); Bus.emit('struct');
  },
  restore(s) {
    const old = D.byId; const list = [];
    for (const [id, json] of s.objs) {
      const ex = old.get(id);
      if (ex && ex._j === json) list.push(ex); else { const o = JSON.parse(json); o._j = json; list.push(o); }
    }
    D.objs = list; D.byId = new Map(list.map(o => [o.id, o])); D._ord = null;
    const m = JSON.parse(s.meta); D.bg = m.bg; D.grid = m.grid; D.layers = m.layers; D.active = m.active; D.comments = m.comments;
    Sel.ids = Sel.ids.filter(id => D.byId.has(id));
    if ((typeof Ed !== 'undefined' && Ed)) Ed.close(true);
    D.modified = Date.now(); D.dirty = true; D.queueSave(); R.req(); Bus.emit('sel'); Bus.emit('struct'); Bus.emit('restored');
  },
  undo() { if (D.hi > 0) { D.hi--; D.restore(D.hist[D.hi]); } },
  redo() { if (D.hi < D.hist.length - 1) { D.hi++; D.restore(D.hist[D.hi]); } },
  jump(i) { if (i >= 0 && i < D.hist.length) { D.hi = i; D.restore(D.hist[i]); } },
  canUndo: () => D.hi > 0, canRedo: () => D.hi < D.hist.length - 1,
  initHistory() { D.hist = [D.snapshot('Open')]; D.hi = 0; },
  toJSON() {
    const head = JSON.stringify({ v: 1, id: D.id, name: D.name, created: D.created, modified: D.modified, bg: D.bg, grid: D.grid, layers: D.layers, active: D.active, comments: D.comments, view: D.view, kind: D.kind, extra: D.extra });
    return head.slice(0, -1) + ',"objs":[' + D.objs.map(D.oj).join(',') + ']}';
  },
  fromJSON(str) {
    const j = typeof str === 'string' ? JSON.parse(str) : str;
    D.id = j.id; D.name = j.name; D.created = j.created; D.modified = j.modified; D.bg = j.bg || '#ffffff';
    D.grid = j.grid || { type: 'dots', size: 24 }; D.layers = j.layers && j.layers.length ? j.layers : [{ id: U.uid('L'), n: 'Layer 1', v: true, l: false, o: 1 }];
    D.kind = j.kind || 'board'; D.extra = j.extra || {}; D.active = j.active || D.layers[0].id; D.comments = j.comments || []; D.view = j.view || { x: -300, y: -200, z: 1 };
    D.objs = (j.objs || []).filter(o => T.reg[o.type]); D.byId = new Map(D.objs.map(o => [o.id, o])); D._ord = null; D.dirty = false;
  },
  queueSave: U.debounce(() => D.save(), 1500),
  async save(thumb) {
    if (!D.id) return;
    try {
      await AS.saveDirty(D.id);
      const json = D.toJSON();
      let meta = (await DB.get('meta', D.id)) || {};
      if (thumb !== false && typeof IO !== 'undefined' && IO && (thumb === true || Date.now() - (meta.thumbT || 0) > 15000)) { try { meta.thumb = await IO.thumb(); meta.thumbT = Date.now(); } catch (e) { } }
      await DB.put('data', { id: D.id, json });
      await DB.put('meta', Object.assign(meta, { id: D.id, name: D.name, modified: D.modified, created: D.created, count: D.objs.length, kind: D.kind, pages: (D.kind === 'study' && typeof Study !== 'undefined' && Study) ? Study.docs().reduce((n, x) => n + (x.pages || 0), 0) : undefined }));
      D.lastSaved = Date.now(); Bus.emit('saved');
      if (Date.now() - (D.lastVersion || 0) > 5 * 60 * 1000 && D.objs.length) D.saveVersion('Auto-save', true);
    } catch (e) { console.error('save failed', e); UI.toast('Could not save: ' + e.message, 4000, 'err'); }
  },
  async saveVersion(name, auto) {
    D.lastVersion = Date.now();
    await DB.put('versions', { id: U.uid('v'), bid: D.id, t: Date.now(), name: name || 'Version', auto: !!auto, json: D.toJSON() });
    const l = (await DB.byIndex('versions', 'bid', D.id)).sort((a, b) => b.t - a.t);
    const autos = l.filter(x => x.auto); for (const x of autos.slice(20)) await DB.del('versions', x.id);
    Bus.emit('versions');
  },
  order(objs, mode) {
    const ids = new Set(objs.map(o => o.id)); let a = D.objs.slice();
    if (mode === 'front') a = a.filter(o => !ids.has(o.id)).concat(a.filter(o => ids.has(o.id)));
    else if (mode === 'back') a = a.filter(o => ids.has(o.id)).concat(a.filter(o => !ids.has(o.id)));
    else if (mode === 'fwd') { for (let i = a.length - 2; i >= 0; i--) if (ids.has(a[i].id) && !ids.has(a[i + 1].id)) [a[i], a[i + 1]] = [a[i + 1], a[i]]; }
    else if (mode === 'bwd') { for (let i = 1; i < a.length; i++) if (ids.has(a[i].id) && !ids.has(a[i - 1].id)) [a[i], a[i - 1]] = [a[i - 1], a[i]]; }
    D.objs = a; D._ord = null;
  }
};

/* ---------- Selection ---------- */
const Sel = {
  ids: [], inner: null,
  objs() { return this.ids.map(id => D.byId.get(id)).filter(Boolean); },
  has(id) { return this.ids.includes(id); },
  expand(ids) { const s = new Set(); ids.forEach(id => { const o = D.byId.get(id); if (!o) return; if (o.gid) D.members(o).forEach(m => s.add(m.id)); else s.add(id); }); return [...s]; },
  set(ids, silent) { ids = this.expand(ids); const same = ids.length === this.ids.length && ids.every((v, i) => v === this.ids[i]); this.ids = ids; if (!same) this.inner = null; if (!same || !silent) { R.req(); Bus.emit('sel'); } },
  add(ids) { this.set(this.ids.concat(ids)); },
  toggle(o) { if (this.has(o.id)) { const rm = new Set(D.members(o).map(m => m.id)); this.set(this.ids.filter(i => !rm.has(i))); } else this.add([o.id]); },
  clear() { if (this.ids.length) this.set([]); },
  one() { return this.ids.length === 1 ? D.byId.get(this.ids[0]) : null; },
  all() { return D.sorted().filter(o => D.isVisible(o)); }
};
