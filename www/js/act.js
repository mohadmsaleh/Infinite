'use strict';
/* ===== Actions: everything you can do to objects ===== */
const FRAME_PRESETS = [['A4 landscape', 1123, 794], ['A4 portrait', 794, 1123], ['Letter landscape', 1056, 816], ['Letter portrait', 816, 1056], ['16:9 slide', 1280, 720], ['4:3 slide', 1024, 768], ['Square', 800, 800], ['Phone', 390, 844], ['Tablet', 820, 1180], ['Full HD', 1920, 1080]];
const Act = {
  clip: null, clipTxt: '',
  sel() { return Sel.objs(); },
  center() { const v = D.view; return [v.x + R.W / 2 / v.z, v.y + R.H / 2 / v.z]; },
  free(w, h) { // a free spot near view centre
    let [cx, cy] = Act.center(); let x = cx - w / 2, y = cy - h / 2;
    for (let i = 0; i < 30; i++) { if (!D.objs.some(o => o.type !== 'frame' && o.type !== 'connector' && Math.abs(o.x - x) < 12 && Math.abs(o.y - y) < 12)) break; x += 26; y += 26; }
    return [x, y];
  },
  translate(o, dx, dy) {
    if (o.type === 'connector') { for (const k of ['from', 'to']) if (o[k] && o[k].p) o[k].p = [o[k].p[0] + dx, o[k].p[1] + dy]; delete o._rk; return; }
    o.x += dx; o.y += dy;
  },
  insert(objs, label = 'Add') {
    objs = [].concat(objs); objs.forEach(o => D.add(o)); Sel.set(objs.map(o => o.id)); D.commit(label, objs);
    const b = G.union(objs), vr = R.viewRect(); if (b && (b.x < vr.x || b.y < vr.y || b.x + b.w > vr.x + vr.w || b.y + b.h > vr.y + vr.h)) R.fitRect(b, 120, true, 1.2);
    return objs;
  },
  make(type, props, label) { const t = T.reg[type]; const o = D.make(type, props || {}); if (props == null || props.x == null) { const [x, y] = Act.free(o.w, o.h); o.x = x; o.y = y; } return Act.insert(o, label || 'Add ' + type)[0]; },
  apply(objs, fn, label = 'Edit') { objs.forEach(o => { fn(o); const t = T.get(o.type); if (t.fit) t.fit(o); delete o._rk; }); D.commit(label, objs); Bus.emit('sel'); },
  del(objs) {
    objs = objs || Sel.objs(); objs = objs.filter(o => !D.isLocked(o) || true); if (!objs.length) return;
    D.remove(objs); Sel.ids = []; Bus.emit('sel'); D.commit('Delete', 'all'.slice(0, 0) || []);
  },
  /* ---- clipboard ---- */
  clone(objs, opt = {}) {
    const map = new Map(), gmap = new Map(), out = [];
    for (const o of objs) { const c = JSON.parse(D.oj(o)); c.id = U.uid(); map.set(o.id, c.id); if (c.gid) { if (!gmap.has(c.gid)) gmap.set(c.gid, U.uid('g')); c.gid = gmap.get(c.gid); } out.push(c); }
    for (const c of out) {
      if (c.type === 'connector') for (const k of ['from', 'to']) if (c[k].id) { if (map.has(c[k].id)) c[k].id = map.get(c[k].id); else if (opt.detach) { const o = D.byId.get(c[k].id); const p = o ? Conn.endPoint({ from: c.from, to: c.to }, k) : { x: 0, y: 0 }; c[k] = { p: [p.x, p.y] }; } }
      if (opt.dx || opt.dy) { if (c.type === 'connector') { for (const k of ['from', 'to']) if (c[k].p) c[k].p = [c[k].p[0] + opt.dx, c[k].p[1] + opt.dy]; } else { c.x += opt.dx; c.y += opt.dy; } }
      delete c._j;
    }
    return out;
  },
  copy(cut) {
    let objs = Sel.objs(); if (!objs.length) return false;
    objs = Sel.expand(objs.map(o => o.id)).map(id => D.byId.get(id)); const ids = new Set(objs.map(o => o.id));
    D.objs.forEach(o => { if (o.type === 'connector' && o.from.id && o.to.id && ids.has(o.from.id) && ids.has(o.to.id)) objs.push(o); });
    Act.clip = { objs: objs.map(o => JSON.parse(D.oj(o))), bid: D.id, n: 0, assets: [...new Set(objs.map(o => o.asset).filter(Boolean))] };
    Act.clipTxt = 'IB-CLIP-' + Date.now(); try { navigator.clipboard && navigator.clipboard.writeText(Act.clipTxt); } catch (e) { }
    if (cut) { D.remove(objs.filter(o => !o.locked)); Sel.ids = []; D.commit('Cut', []); Bus.emit('sel'); } else UI.toast('Copied');
    return true;
  },
  paste(at) {
    const c = Act.clip; if (!c) return false; c.n++;
    const tmp = c.objs.map(o => JSON.parse(JSON.stringify(o))); const b = G.union(tmp.filter(o => o.type !== 'connector'));
    let dx = 24 * c.n, dy = 24 * c.n; if (at && b) { dx = at[0] - (b.x + b.w / 2); dy = at[1] - (b.y + b.h / 2); }
    const objs = Act.clone(tmp.map(o => Object.assign(o)), { dx, dy, detach: true });
    objs.forEach(o => { o.layer = D.layers.some(l => l.id === o.layer) ? o.layer : D.active; });
    if (c.bid !== D.id) objs.forEach(o => { if (o.asset && !AS.get(o.asset)) { /* asset from another board is unavailable */ } });
    objs.forEach(o => D.add(o)); Sel.set(objs.map(o => o.id)); D.commit('Paste', objs); return true;
  },
  duplicate(objs) {
    objs = objs || Sel.objs(); if (!objs.length) return; objs = Sel.expand(objs.map(o => o.id)).map(id => D.byId.get(id)); const ids = new Set(objs.map(o => o.id));
    D.objs.forEach(o => { if (o.type === 'connector' && o.from.id && o.to.id && ids.has(o.from.id) && ids.has(o.to.id) && !ids.has(o.id)) objs.push(o); });
    const n = Act.clone(objs, { dx: 28, dy: 28 }); n.forEach(o => D.add(o)); Sel.set(n.map(o => o.id)); D.commit('Duplicate', n);
  },
  async copyImage() {
    const objs = Sel.objs(); if (!objs.length) return; try { const blob = await IO.renderBlob({ objs, scale: 2, pad: 12, bg: null }); await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]); UI.toast('Copied as image'); } catch (e) { UI.toast('Clipboard image not supported here', 3000, 'err'); }
  },
  copyLink(o) {
    o = o || Sel.one(); const url = `${location.href.split('#')[0]}#b=${D.id}${o ? '&o=' + o.id : ''}`; U.copy(url).then(() => UI.toast('Link copied'));
  },
  /* ---- structure ---- */
  group() { const s = Sel.objs().filter(o => o.type !== 'connector' || true); if (s.length < 2) return; const g = U.uid('g'); s.forEach(o => o.gid = g); D.commit('Group', s); Sel.set(s.map(o => o.id)); },
  ungroup() { const s = Sel.objs(); if (!s.some(o => o.gid)) return; s.forEach(o => o.gid = null); D.commit('Ungroup', s); Sel.set(s.map(o => o.id)); },
  order(mode) { const s = Sel.objs(); if (!s.length) return; D.order(s, mode); D.commit({ front: 'Bring to front', back: 'Send to back', fwd: 'Bring forward', bwd: 'Send backward' }[mode], []); Bus.emit('struct'); },
  lock(v) { const s = Sel.objs(); if (!s.length) return; const nv = v == null ? !s.every(o => o.locked) : v; s.forEach(o => o.locked = nv); D.commit(nv ? 'Lock' : 'Unlock', s); Bus.emit('sel'); },
  flip(ax) { const s = Sel.objs().filter(o => T.get(o.type).flip || true); if (!s.length) return; const u = G.union(s); s.forEach(o => { const t = T.get(o.type); if (o.type === 'connector') return; const c = G.center(o); if (s.length > 1) { if (ax === 'h') o.x = 2 * (u.x + u.w / 2) - c[0] - o.w / 2; else o.y = 2 * (u.y + u.h / 2) - c[1] - o.h / 2; } if (t.flip) { if (ax === 'h') o.fx = !o.fx; else o.fy = !o.fy; } if (o.rot) o.rot = -o.rot; if (!t.flip && ax === 'h' && s.length === 1) { /* nothing */ } }); D.commit('Flip', s); },
  straighten(objs) {
    objs = objs || Sel.objs(); if (!objs.length) return; const add = [], rem = [], out = [];
    for (const o of objs) {
      if (o.type === 'stroke') {
        const wp = Ink.worldPts(o); let r = Ink.recognize(wp);
        if (!r) { const a = wp[0], b = wp[wp.length - 1]; r = { kind: 'line', a: [a[0], a[1]], b: [b[0], b[1]] }; }
        const n = Ink.shapeObj(r, o); n.layer = o.layer; add.push(n); rem.push(o); out.push(n.id);
      } else if (o.type === 'line') { const [a, b] = Lines.ends(o); const ang = Math.atan2(b[1] - a[1], b[0] - a[0]); const sn = Math.round(ang / (Math.PI / 4)) * Math.PI / 4; const l = Math.hypot(b[0] - a[0], b[1] - a[1]); Lines.setEnds(o, a, [a[0] + Math.cos(sn) * l, a[1] + Math.sin(sn) * l]); out.push(o.id); }
      else if (o.type !== 'connector') { const q = Math.PI / 2; o.rot = Math.round(o.rot / q) * q; if (Math.abs(o.rot) > 6.2) o.rot = 0; out.push(o.id); }
    }
    if (rem.length) D.remove(rem); add.forEach(o => D.add(o)); Sel.ids = out.filter(i => D.byId.has(i)); D.commit('Straighten', objs.concat(add)); Bus.emit('sel');
  },
  setShadow(on) { const s = Sel.objs(); s.forEach(o => { o.sh = on ? { on: true, c: 'rgba(0,0,0,.35)', b: 14, x: 0, y: 5 } : null; }); D.commit('Shadow', s); Bus.emit('sel'); },
  selectAll() { Sel.set(D.objs.filter(o => D.isVisible(o)).map(o => o.id)); },
  invert() { const cur = new Set(Sel.ids); Sel.set(D.objs.filter(o => D.isVisible(o) && !cur.has(o.id)).map(o => o.id)); },
  selectSame() { const s = Sel.one(); if (s) Sel.set(D.objs.filter(o => o.type === s.type && D.isVisible(o)).map(o => o.id)); },
  toLayer(id) { const s = Sel.objs(); s.forEach(o => o.layer = id); D.invalidate(); D.commit('Move to layer', s); },
  /* ---- align & arrange ---- */
  align(mode, to) {
    const s = Sel.objs().filter(o => o.type !== 'connector'); if (!s.length) return; to = to || ST.v.alignTo || (s.length > 1 ? 'selection' : 'frame'); if (to === 'key' && s.length < 2) to = 'frame';
    let ref;
    if (to === 'selection') ref = G.union(s);
    else if (to === 'key') ref = G.aabb(s[0]);
    else if (to === 'viewport') ref = R.viewRect();
    else { const c = G.center(s[0]); const f = D.frames().filter(f => c[0] >= f.x && c[0] <= f.x + f.w && c[1] >= f.y && c[1] <= f.y + f.h).pop(); ref = f ? { x: f.x, y: f.y, w: f.w, h: f.h } : R.viewRect(); }
    s.forEach(o => {
      if (to === 'key' && o === s[0]) return; const b = G.aabb(o); let dx = 0, dy = 0;
      if (mode === 'left') dx = ref.x - b.x; else if (mode === 'right') dx = ref.x + ref.w - b.x - b.w; else if (mode === 'hcenter') dx = ref.x + ref.w / 2 - b.x - b.w / 2;
      else if (mode === 'top') dy = ref.y - b.y; else if (mode === 'bottom') dy = ref.y + ref.h - b.y - b.h; else if (mode === 'vcenter') dy = ref.y + ref.h / 2 - b.y - b.h / 2;
      Act.translate(o, dx, dy);
    });
    D.commit('Align', s);
  },
  distribute(axis, centers) {
    const s = Sel.objs().filter(o => o.type !== 'connector'); if (s.length < 3) { UI.toast('Select 3 or more objects'); return; }
    const H = axis === 'h'; const items = s.map(o => ({ o, b: G.aabb(o) })).sort((a, b) => H ? a.b.x - b.b.x : a.b.y - b.b.y);
    const first = items[0].b, last = items[items.length - 1].b;
    if (centers) { const c0 = H ? first.x + first.w / 2 : first.y + first.h / 2, c1 = H ? last.x + last.w / 2 : last.y + last.h / 2; items.forEach((it, i) => { const t = c0 + (c1 - c0) * i / (items.length - 1); const c = H ? it.b.x + it.b.w / 2 : it.b.y + it.b.h / 2; Act.translate(it.o, H ? t - c : 0, H ? 0 : t - c); }); }
    else { const total = H ? last.x + last.w - first.x : last.y + last.h - first.y; const sum = items.reduce((a, it) => a + (H ? it.b.w : it.b.h), 0); const gap = (total - sum) / (items.length - 1); let p = H ? first.x : first.y; items.forEach(it => { Act.translate(it.o, H ? p - it.b.x : 0, H ? 0 : p - it.b.y); p += (H ? it.b.w : it.b.h) + gap; }); }
    D.commit('Distribute', s);
  },
  matchSize(dim) { const s = Sel.objs().filter(o => o.type !== 'connector' && T.get(o.type).resize !== 'none'); if (s.length < 2) return; const k = s[0]; s.slice(1).forEach(o => { if (dim !== 'h') o.w = k.w; if (dim !== 'w') o.h = k.h; const t = T.get(o.type); if (t.onResize) t.onResize(o, o.w, o.h); if (t.fit) t.fit(o); }); D.commit('Match size', s); },
  stack(axis, gap = 24) {
    const s = Sel.objs().filter(o => o.type !== 'connector'); if (s.length < 2) return; const H = axis === 'h'; const items = s.map(o => ({ o, b: G.aabb(o) })).sort((a, b) => H ? a.b.x - b.b.x : a.b.y - b.b.y);
    let p = H ? items[0].b.x : items[0].b.y; const ref = H ? items[0].b.y : items[0].b.x; items.forEach(it => { Act.translate(it.o, H ? p - it.b.x : ref - it.b.x, H ? ref - it.b.y : p - it.b.y); p += (H ? it.b.w : it.b.h) + gap; }); D.commit('Stack', s);
  },
  tidy(gap = 24) {
    const s = Sel.objs().filter(o => o.type !== 'connector'); if (s.length < 2) return; const u = G.union(s); const cols = Math.ceil(Math.sqrt(s.length)); const items = s.map(o => ({ o, b: G.aabb(o) })).sort((a, b) => (Math.round(a.b.y / 50) - Math.round(b.b.y / 50)) || a.b.x - b.b.x);
    const cw = Math.max(...items.map(i => i.b.w)), ch = Math.max(...items.map(i => i.b.h)); items.forEach((it, i) => { const c = i % cols, r = Math.floor(i / cols); Act.translate(it.o, u.x + c * (cw + gap) - it.b.x, u.y + r * (ch + gap) - it.b.y); }); D.commit('Tidy up', s);
  },
  nudge(dx, dy) { const s = Sel.objs().filter(o => !D.isLocked(o)); if (!s.length) return; s.forEach(o => Act.translate(o, dx, dy)); D.commit('Nudge', s); },
  /* ---- link ---- */
  setLink(objs) {
    objs = objs || Sel.objs(); if (!objs.length) return; const cur = objs[0].link || {};
    const urlI = U.el('input', { class: 'inp', value: cur.k === 'url' ? cur.v : '', placeholder: 'https://example.com' });
    const frs = D.frames(); const frS = U.el('select', { class: 'inp' }, U.el('option', { value: '' }, '— choose frame —'), frs.map(f => U.el('option', { value: f.id, selected: cur.k === 'obj' && cur.v === f.id }, f.name)));
    const others = D.objs.filter(o => o.type !== 'connector' && o.type !== 'stroke' && o.type !== 'frame' && !objs.includes(o)).slice(0, 80);
    const obS = U.el('select', { class: 'inp' }, U.el('option', { value: '' }, '— choose object —'), others.map(o => U.el('option', { value: o.id, selected: cur.k === 'obj' && cur.v === o.id }, (T.get(o.type).text ? (T.get(o.type).text(o)[0] || '').slice(0, 24) : '') + ' (' + o.type + ')')));
    const body = U.el('div', null, U.el('label', { class: 'lbl' }, 'Web address'), urlI, U.el('label', { class: 'lbl' }, 'Or jump to a frame / page'), frS, U.el('label', { class: 'lbl' }, 'Or jump to another object'), obS);
    UI.modal({ title: 'Link', body, width: 440, buttons: [{ label: 'Remove link', danger: true, fn: () => { objs.forEach(o => o.link = null); D.commit('Remove link', objs); Bus.emit('sel'); } }, { label: 'Cancel' }, { label: 'Save', primary: true, fn: () => { let l = null; if (urlI.value.trim()) l = { k: 'url', v: Embeds.norm(urlI.value).url }; else if (frS.value) l = { k: 'obj', v: frS.value }; else if (obS.value) l = { k: 'obj', v: obS.value }; objs.forEach(o => o.link = l); D.commit('Set link', objs); Bus.emit('sel'); } }] });
  },
  follow(o) {
    const l = o.link; if (!l) return; if (l.k === 'url') window.open(l.v, '_blank', 'noopener'); else { const t = D.byId.get(l.v); if (t) { Sel.set([t.id]); R.fitRect(G.aabb(t), 80, true, 2); } else UI.toast('Link target no longer exists'); }
  },
  /* ---- frames ---- */
  newFrame(x, y, w, h, name) {
    const n = D.frames().length + 1; const f = D.make('frame', { x, y, w, h, name: name || 'Frame ' + n, ori: w >= h ? 'landscape' : 'portrait' });
    Act.insert(f, 'Add frame'); return f;
  },
  addFramePreset(p) { const [n, w, h] = p; const [cx, cy] = Act.center(); const f = D.frames(); let x = cx - w / 2, y = cy - h / 2; if (f.length) { const last = f[f.length - 1]; if (Math.abs(last.x - x) < w && Math.abs(last.y - y) < h) { x = last.x + last.w + 80; y = last.y; } } return Act.newFrame(x, y, w, h, 'Frame ' + (f.length + 1)); },
  orientFrame(f) { const c = G.center(f); [f.w, f.h] = [f.h, f.w]; f.x = c[0] - f.w / 2; f.y = c[1] - f.h / 2; f.ori = f.w >= f.h ? 'landscape' : 'portrait'; Bus.emit('sel'); },
  fitFrame(f) { const inside = D.objs.filter(o => o !== f && o.type !== 'frame' && Act.inFrame(f, o)); if (!inside.length) return; const b = G.union(inside); f.x = b.x - 40; f.y = b.y - 40; f.w = b.w + 80; f.h = b.h + 80; },
  inFrame(f, o) { const c = G.center(o); return c[0] >= f.x && c[0] <= f.x + f.w && c[1] >= f.y && c[1] <= f.y + f.h; },
  frameChildren(f) { return D.objs.filter(o => o !== f && o.type !== 'frame' && Act.inFrame(f, o)); },
  /* ---- type specific ---- */
  tableAdd(o, what, at) {
    if (what === 'row') { at = U.clamp(at, 0, o.rows); o.cells.splice(at, 0, Array.from({ length: o.cols }, () => ({ t: '', f: null, b: false, al: null }))); o.rh.splice(at, 0, 42); }
    else { at = U.clamp(at, 0, o.cols); o.cells.forEach(r => r.splice(at, 0, { t: '', f: null, b: false, al: null })); o.cw.splice(at, 0, 150); }
    Tbl.fit(o); delete o._j; D.commit('Edit table', o); Bus.emit('sel');
  },
  tableDel(o, what) {
    const i = Sel.inner && Sel.inner.k === 'cell' ? Sel.inner : { r: o.rows - 1, c: o.cols - 1 };
    if (what === 'row') { if (o.rows < 2) return; o.cells.splice(i.r, 1); o.rh.splice(i.r, 1); } else { if (o.cols < 2) return; o.cells.forEach(r => r.splice(i.c, 1)); o.cw.splice(i.c, 1); }
    Sel.inner = null; Tbl.fit(o); D.commit('Edit table', o); Bus.emit('sel');
  },
  askEmbedUrl(o) { UI.prompt('Web page address', o.url || 'https://', { ok: 'Embed', label: 'Enter a URL (YouTube, Vimeo, Google Docs and most sites work)' }).then(v => { if (v) { o.url = Embeds.norm(v).url; D.commit('Set URL', o); R.req(); Bus.emit('sel'); } }); },
  cropImage(o) {
    const img = AS.img(o.asset); if (!img) return; const c0 = o.crop || { x: 0, y: 0, w: img.naturalWidth, h: img.naturalHeight }; const NW = img.naturalWidth, NH = img.naturalHeight;
    const v = { l: c0.x / NW * 100, t: c0.y / NH * 100, r: 100 - (c0.x + c0.w) / NW * 100, b: 100 - (c0.y + c0.h) / NH * 100 };
    const cv = U.el('canvas', { width: 420, height: 300, style: 'width:100%;border-radius:8px;background:#222' });
    const draw = () => { const c = cv.getContext('2d'); c.clearRect(0, 0, 420, 300); const s = Math.min(400 / NW, 280 / NH), w = NW * s, h = NH * s, x = (420 - w) / 2, y = (300 - h) / 2; c.drawImage(img, x, y, w, h); c.fillStyle = 'rgba(0,0,0,.55)'; c.fillRect(x, y, w, h); const cx = x + w * v.l / 100, cy = y + h * v.t / 100, cw = w * (100 - v.l - v.r) / 100, ch = h * (100 - v.t - v.b) / 100; c.save(); c.beginPath(); c.rect(cx, cy, cw, ch); c.clip(); c.drawImage(img, x, y, w, h); c.restore(); c.strokeStyle = '#fff'; c.lineWidth = 2; c.strokeRect(cx, cy, cw, ch); };
    const mk = (k, l) => UI.field(l, UI.range(0, 90, 1, v[k], x => { v[k] = x; draw(); }, { fmt: x => x + '%' }));
    draw(); UI.modal({ title: 'Crop image', body: U.el('div', null, cv, mk('l', 'Left'), mk('r', 'Right'), mk('t', 'Top'), mk('b', 'Bottom')), width: 480, buttons: [{ label: 'Reset', fn: () => { o.crop = null; o.h = o.w * NH / NW; D.commit('Crop', o); } }, { label: 'Cancel' }, { label: 'Apply', primary: true, fn: () => { const x = NW * v.l / 100, y = NH * v.t / 100, w = Math.max(8, NW * (100 - v.l - v.r) / 100), h = Math.max(8, NH * (100 - v.t - v.b) / 100); o.crop = { x, y, w, h }; o.h = o.w * h / w; D.commit('Crop', o); } }] });
  },
  fillAt(pt, color) {
    const hit = Tools.pick(pt.x, pt.y, true); const c = color;
    if (!hit) { const f = D.frames().filter(f => pt.x >= f.x && pt.x <= f.x + f.w && pt.y >= f.y && pt.y <= f.y + f.h).pop(); if (f) { f.bg = c; D.commit('Fill', f); return; } UI.toast('Tap a shape, note or frame to fill it'); return; }
    const o = hit; const lx = G.toLocal(o, pt.x, pt.y);
    if (o.type === 'shape' || o.type === 'text') { o[o.type === 'text' ? 'bgc' : 'fill'] = c; if (o.type === 'shape' && U.isDark(c) && U.parseColor(o.tc)[0] < 100) o.tc = '#ffffff'; }
    else if (o.type === 'sticky') o.color = c; else if (o.type === 'frame') o.bg = c; else if (o.type === 'stroke') o.fill = c;
    else if (o.type === 'table') { const ce = Tbl.cellAt(o, lx[0], lx[1]); if (ce) o.cells[ce.r][ce.c].f = c; }
    else if (o.type === 'matrix') { const h = Mx.hit(o, lx[0], lx[1]); if (h && h.t === 'cell') o.cells[h.i].c = c; }
    else if (o.type === 'kanban') { const h = Kb.hit(o, lx[0], lx[1]); if (h && h.t === 'card') Kb.findCard(o, h.id).card.c = c; else if (h && h.t === 'head') o.cols[h.ci].c = c; else o.bg = c; }
    else if (o.type === 'mindmap') { const h = Mm.hit(o, lx[0], lx[1]); if (h && h.t === 'node') Mm.find(o.root, h.r.n.id).n.c = c; }
    else if (o.type === 'doc') o.bgc = c; else if (o.type === 'timeline') o.cardc = c; else if (o.type === 'line' || o.type === 'connector') o.color = c; else { UI.toast('This object can’t be filled'); return; }
    const t = T.get(o.type); if (t.fit) t.fit(o); D.commit('Fill', o);
  },
  /* ---- layers & comments ---- */
  addLayer() { const l = { id: U.uid('L'), n: 'Layer ' + (D.layers.length + 1), v: true, l: false, o: 1 }; D.layers.push(l); D.active = l.id; D.commit('Add layer', []); return l; },
  addComment(x, y, objId) {
    const c = { id: U.uid('c'), x, y, obj: objId || null, a: ST.v.author, t: Date.now(), res: false, msgs: [] };
    if (objId) { const o = D.byId.get(objId); if (o) { const [lx, ly] = G.toLocal(o, x, y); c.ox = lx / (o.w || 1); c.oy = ly / (o.h || 1); } }
    D.comments.push(c); D.commit('Add comment', []); Comments.open(c.id); return c;
  },
  commentPos(c) { if (c.obj) { const o = D.byId.get(c.obj); if (o) return G.toWorld(o, c.ox * o.w, c.oy * o.h); } return [c.x, c.y]; },
  /* ---- templates / diagrams ---- */
  diagram(kind) {
    const [cx, cy] = Act.center(); const out = []; const S = (k, x, y, w, h, t, extra) => { const o = D.make('shape', Object.assign({ kind: k, x: cx + x - w / 2, y: cy + y - h / 2, w, h, text: t, fill: '#ffffff', stroke: '#4f46e5', sw: 2.5 }, extra || {})); out.push(o); return o; };
    const C = (a, as, b, bs, extra) => { const c = Conn.make({ id: a.id, side: as }, { id: b.id, side: bs }, extra); out.push(c); return c; };
    if (kind === 'flowchart') {
      const a = S('terminator', 0, -280, 170, 64, 'Start', { fill: '#dcfce7', stroke: '#16a34a' }), b = S('process', 0, -150, 190, 80, 'Do something'), d = S('decision', 0, 0, 200, 130, 'Done?', { fill: '#fef3c7', stroke: '#d97706' }), e = S('process', 260, 0, 170, 70, 'Fix it'), f = S('terminator', 0, 150, 170, 64, 'End', { fill: '#fee2e2', stroke: '#dc2626' });
      C(a, 'b', b, 't'); C(b, 'b', d, 't'); const c1 = C(d, 'r', e, 'l'); c1.lbl = 'No'; const c2 = C(d, 'b', f, 't'); c2.lbl = 'Yes'; C(e, 't', b, 'r');
    } else if (kind === 'org') {
      const r = S('round', 0, -170, 190, 70, 'CEO', { fill: '#4f46e5', stroke: '#4f46e5', tc: '#fff', b: true });
      [-280, 0, 280].forEach((x, i) => { const c = S('round', x, -20, 170, 64, ['Engineering', 'Product', 'Sales'][i]); C(r, 'b', c, 't'); [-90, 90].forEach((dx, j) => { const g = S('round', x + dx, 130, 140, 54, 'Team ' + (i * 2 + j + 1), { fill: '#eef0ff', sw: 1.5 }); C(c, 'b', g, 't'); }); });
    } else if (kind === 'cycle') {
      const n = [S('round', 0, -170, 170, 64, 'Plan'), S('round', 230, 0, 170, 64, 'Do'), S('round', 0, 170, 170, 64, 'Check'), S('round', -230, 0, 170, 64, 'Act')]; const sides = [['r', 't'], ['b', 'r'], ['l', 'b'], ['t', 'l']];
      n.forEach((a, i) => C(a, sides[i][0], n[(i + 1) % 4], sides[i][1], { style: 'curve' }));
    } else if (kind === 'venn') {
      [['#ef4444', -90, -50, 'A'], ['#3b82f6', 90, -50, 'B'], ['#22c55e', 0, 100, 'C']].forEach(([c, x, y, t]) => S('ellipse', x, y, 280, 280, t, { fill: U.alpha(c, .28), stroke: c, sw: 2, fs: 28, b: true, tc: c }));
    } else if (kind === 'process') {
      ['Discover', 'Define', 'Design', 'Deliver'].forEach((t, i) => S('chevron', -405 + i * 270, 0, 270, 110, t, { fill: ['#e0e7ff', '#c7d2fe', '#a5b4fc', '#818cf8'][i], stroke: '#4f46e5', b: true, fs: 20 }));
    }
    return Act.insert(out, 'Insert diagram');
  }
};
