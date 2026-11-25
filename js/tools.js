'use strict';
/* ===== Pointer interaction: tools, selection, transforms, snapping, overlay ===== */
const Units = {
  list: [['px', 'Pixels'], ['mm', 'Millimetres'], ['cm', 'Centimetres'], ['in', 'Inches']],
  toU(px, u = ST.v.units) { return u === 'mm' ? px * 25.4 / 96 : u === 'cm' ? px * 2.54 / 96 : u === 'in' ? px / 96 : px; },
  fromU(v, u = ST.v.units) { return u === 'mm' ? v * 96 / 25.4 : u === 'cm' ? v * 96 / 2.54 : u === 'in' ? v * 96 : v; },
  fmt(px, u = ST.v.units) { const v = Units.toU(px, u); return (u === 'px' ? Math.round(v) : u === 'mm' ? v.toFixed(0) : u === 'cm' ? v.toFixed(1) : v.toFixed(2)) + ' ' + u; }
};

const Snap = {
  xs: [], ys: [], guides: [],
  begin(excl) {
    Snap.xs = []; Snap.ys = []; Snap.guides = []; const vr = R.viewRect(), m = 400 / D.view.z; let n = 0;
    for (const o of R.visList) {
      if (excl.has(o.id) || o.type === 'connector' || o.type === 'stroke') continue; const b = G.aabb(o);
      if (b.x > vr.x + vr.w + m || b.x + b.w < vr.x - m || b.y > vr.y + vr.h + m || b.y + b.h < vr.y - m) continue; if (++n > 400) break;
      for (const v of [b.x, b.x + b.w / 2, b.x + b.w]) Snap.xs.push({ v, a: b.y, b: b.y + b.h });
      for (const v of [b.y, b.y + b.h / 2, b.y + b.h]) Snap.ys.push({ v, a: b.x, b: b.x + b.w });
    }
  },
  box(b, o = {}) {
    const thr = 7 / D.view.z; let dx = 0, dy = 0; Snap.guides = [];
    if (ST.v.snapObjects || ST.v.guides) {
      let bx = thr, by = thr, gx = null, gy = null;
      const cx = o.edges ? o.edges.x : [b.x, b.x + b.w / 2, b.x + b.w], cy = o.edges ? o.edges.y : [b.y, b.y + b.h / 2, b.y + b.h];
      for (const c of cx) for (const l of Snap.xs) { const d = l.v - c; if (Math.abs(d) < Math.abs(bx)) { bx = d; gx = l; } }
      for (const c of cy) for (const l of Snap.ys) { const d = l.v - c; if (Math.abs(d) < Math.abs(by)) { by = d; gy = l; } }
      if (gx) { dx = bx; Snap.guides.push({ v: 'x', at: gx.v, a: Math.min(gx.a, b.y + dy), b: Math.max(gx.b, b.y + b.h + dy) }); }
      if (gy) { dy = by; Snap.guides.push({ v: 'y', at: gy.v, a: Math.min(gy.a, b.x + dx), b: Math.max(gy.b, b.x + b.w + dx) }); }
    }
    if (ST.v.snapGrid) { if (!dx) { const gx = R.snapG(b.x); dx = gx - b.x; } if (!dy) { const gy = R.snapG(b.y); dy = gy - b.y; } }
    return { dx: ST.v.snapObjects || ST.v.snapGrid ? dx : 0, dy: ST.v.snapObjects || ST.v.snapGrid ? dy : 0 };
  },
  point(x, y) { // snap a single point (for resize / line ends)
    const r = Snap.box({ x, y, w: 0, h: 0 }); return [x + r.dx, y + r.dy];
  }
};

const HANDLES = [['nw', -1, -1], ['n', 0, -1], ['ne', 1, -1], ['e', 1, 0], ['se', 1, 1], ['s', 0, 1], ['sw', -1, 1], ['w', -1, 0]];
const CURS = { nw: 'nwse-resize', se: 'nwse-resize', ne: 'nesw-resize', sw: 'nesw-resize', n: 'ns-resize', s: 'ns-resize', e: 'ew-resize', w: 'ew-resize' };

const Tools = {
  tool: 'select', lock: false, ptrs: new Map(), st: null, spaceDown: false, lastPen: 0, lastDown: { t: 0, x: 0, y: 0 }, dbl: false, hover: null, lp: null,
  opts: {
    pen: { pen: 'pen', size: 4, color: '#1f2430', smart: true, memo: {} },
    eraser: { type: 'stroke', size: 26 },
    fill: { color: '#fde68a' },
    shape: { kind: 'rect', fill: '#ffffff', stroke: '#1f2430', sw: 2, mode: 'shape' },
    line: { kind: 'arrow', color: '#1f2430', sw: 3, dash: 'solid', style: 'elbow' },
    sticky: { color: '#fff176' },
    text: { fs: 28, tc: '#1f2430' },
    frame: { preset: 0 },
    cutout: { remove: false }
  },
  loadOpts() { try { const s = JSON.parse(localStorage.getItem('ib.tools') || '{}'); for (const k in s) Object.assign(Tools.opts[k] || (Tools.opts[k] = {}), s[k]); } catch (e) { } },
  saveOpts: U.debounce(() => { try { localStorage.setItem('ib.tools', JSON.stringify(Tools.opts)); } catch (e) { } }, 400),
  init() {
    Tools.loadOpts(); const ov = R.ov;
    ov.addEventListener('pointerdown', Tools.onDown); ov.addEventListener('pointermove', Tools.onMove);
    ov.addEventListener('pointerup', Tools.onUp); ov.addEventListener('pointercancel', Tools.onUp);
    ov.addEventListener('pointerleave', () => { if (!Tools.st) { Tools.lp = null; R.hover = null; R.reqOv(); } });
    ov.addEventListener('wheel', Tools.onWheel, { passive: false });
    ov.addEventListener('contextmenu', e => { e.preventDefault(); Tools.onContext(e); });
    ov.style.touchAction = 'none';
    R.overlays.push(Tools.overlay);
    window.addEventListener('blur', () => { Tools.spaceDown = false; });
    Bus.on('sel', () => R.reqOv()); Bus.on('settings', () => R.req());
  },
  set(tool, opts) {
    if (Ed.cur) Ed.close(); if (Embeds.active) Embeds.deactivate();
    if (tool !== 'pen') Ink.live = null;
    Tools.tool = tool; Tools.st = null; if (opts) Tools.lock = !!opts.lock; else Tools.lock = false;
    if (['select', 'marquee', 'lasso', 'cutout', 'hand'].includes(tool) === false && tool !== 'comment') { /* keep selection for context */ }
    Bus.emit('tool', tool); Tools.cursor(); R.reqOv();
  },
  done() { if (!Tools.lock) Tools.set(ST.v.handAfterShape ? 'hand' : 'select'); },
  pt(e) {
    const r = R.ov.getBoundingClientRect(), sx = e.clientX - r.left, sy = e.clientY - r.top, [x, y] = R.s2w(sx, sy);
    let p = e.pressure; if (e.pointerType === 'mouse' || !p) p = 0.5;
    return { sx, sy, x, y, p, raw: e.pressure, type: e.pointerType, shift: e.shiftKey, alt: e.altKey, ctrl: e.ctrlKey || e.metaKey, id: e.pointerId, t: e.timeStamp, btn: e.button, buttons: e.buttons };
  },
  cursor(c) {
    const t = Tools.tool; R.ov.style.cursor = c || (Tools.spaceDown || t === 'hand' ? 'grab' : ['pen', 'fill', 'shape', 'frame', 'connector', 'lasso', 'cutout', 'marquee', 'comment', 'sticky'].includes(t) ? 'crosshair' : t === 'text' ? 'text' : (t === 'eraser' || t === 'laser') ? 'none' : 'default');
  },
  /* ---------- picking ---------- */
  pick(wx, wy, skipFrames, alt, tol) {
    tol = tol == null ? 5 / D.view.z : tol; const hits = [];
    for (let i = R.visList.length - 1; i >= 0; i--) { const o = R.visList[i]; if (skipFrames && o.type === 'frame') continue; if (G.hit(o, wx, wy, tol)) { if (!alt) return o; hits.push(o); } }
    if (!alt) return null; const cur = Sel.one(); const i = cur ? hits.indexOf(cur) : -1; return hits[(i + 1) % Math.max(1, hits.length)] || null;
  },
  /* ---------- selection geometry (screen) ---------- */
  selInfo() {
    const objs = Sel.objs(); if (!objs.length) return null; const z = D.view.z;
    const one = objs.length === 1 ? objs[0] : null; const locked = objs.every(o => D.isLocked(o));
    if (one && (one.type === 'connector')) return { one, kind: 'conn', locked };
    if (one && T.get(one.type).ends) { const [a, b] = Lines.ends(one); return { one, kind: 'ends', a, b, locked }; }
    let corners, cx, cy, rot = 0, box;
    if (one) { corners = G.corners(one); rot = one.rot; box = { x: one.x, y: one.y, w: one.w, h: one.h }; }
    else { const u = G.union(objs); box = u; corners = [[u.x, u.y], [u.x + u.w, u.y], [u.x + u.w, u.y + u.h], [u.x, u.y + u.h]]; }
    const sc = corners.map(p => R.w2s(p[0], p[1]));
    const t = one ? T.get(one.type) : null; const rs = one ? (t.resize || 'free') : 'free';
    const noRot = one ? t.noRot : objs.some(o => T.get(o.type).noRot);
    const handles = [];
    if (!locked) {
      for (const [id, hx, hy] of HANDLES) {
        if (rs === 'none') break; if (rs === 'w' && hy !== 0) continue;
        const lx = box.w * (hx + 1) / 2, ly = box.h * (hy + 1) / 2;
        const w = one ? G.toWorld(one, lx, ly) : [box.x + lx, box.y + ly]; const s = R.w2s(w[0], w[1]); handles.push({ id, hx, hy, x: s[0], y: s[1] });
      }
    }
    // rotation knob: above top-centre
    let rotK = null;
    if (!locked && !noRot) {
      const top = one ? G.toWorld(one, box.w / 2, 0) : [box.x + box.w / 2, box.y]; const ang = rot - Math.PI / 2; const s = R.w2s(top[0], top[1]); rotK = { x: s[0] + Math.cos(ang) * 28, y: s[1] + Math.sin(ang) * 28, bx: s[0], by: s[1] };
    }
    const cs = R.w2s(box.x + box.w / 2, box.y + box.h / 2);
    return { one, objs, kind: 'box', sc, handles, rotK, box, rot, locked, center: [box.x + box.w / 2, box.y + box.h / 2], cs };
  },
  handleAt(pt) {
    const info = Tools.selInfo(); if (!info || info.locked) return null; const r = pt.type === 'touch' ? 20 : pt.type === 'pen' ? 15 : 10;
    if (info.kind === 'conn') {
      const c = info.one; for (const k of ['from', 'to']) { const p = Conn.endPoint(c, k), s = R.w2s(p.x, p.y); if (Math.hypot(pt.sx - s[0], pt.sy - s[1]) < r + 4) return { id: 'cend', k }; }
      return null;
    }
    if (info.kind === 'ends') { const A = R.w2s(...info.a), B = R.w2s(...info.b); if (Math.hypot(pt.sx - A[0], pt.sy - A[1]) < r + 4) return { id: 'lend', k: 0 }; if (Math.hypot(pt.sx - B[0], pt.sy - B[1]) < r + 4) return { id: 'lend', k: 1 }; return null; }
    if (info.rotK && Math.hypot(pt.sx - info.rotK.x, pt.sy - info.rotK.y) < r + 2) return { id: 'rot' };
    for (const h of info.handles) if (Math.hypot(pt.sx - h.x, pt.sy - h.y) < r) return h;
    return null;
  },
  flowAt(pt) {
    if (!ST.v.flow || Tools.tool !== 'select') return null; const cand = Sel.one() || R.hover; if (!cand || cand.type === 'connector' || T.get(cand.type).noConn || D.isLocked(cand) && false) return null;
    if (cand.type === 'frame' || (T.get(cand.type).ends)) return null; const r = pt.type === 'touch' ? 22 : 13;
    for (const side of ['t', 'r', 'b', 'l']) { const a = Conn.anchor(cand, side); const s = R.w2s(a.x + a.dx * 26 / D.view.z, a.y + a.dy * 26 / D.view.z); if (Math.hypot(pt.sx - s[0], pt.sy - s[1]) < r) return { o: cand, side, s }; }
    return null;
  },
  /* ---------- pointer events ---------- */
  onDown(e) {
    if (e.pointerType === 'touch' && performance.now() - Tools.lastPen < 700) return; // palm rejection
    if (e.pointerType === 'pen') Tools.lastPen = performance.now();
    if (Embeds.active) Embeds.deactivate();
    R.ov.setPointerCapture(e.pointerId); const pt = Tools.pt(e);
    Tools.ptrs.set(e.pointerId, { sx: pt.sx, sy: pt.sy, type: e.pointerType });
    if (Ed.cur) Ed.close();
    UI.closeAll();
    if (document.activeElement && document.activeElement !== document.body && !(document.activeElement.closest && document.activeElement.closest('#editor'))) document.activeElement.blur();
    if (Tools.ptrs.size >= 2) { Tools.endCurrent(true); Tools.startGesture(); return; }
    const now = e.timeStamp, ld = Tools.lastDown; Tools.dbl = now - ld.t < 380 && Math.hypot(pt.sx - ld.x, pt.sy - ld.y) < 14 && ld.tool === Tools.tool; Tools.lastDown = { t: now, x: pt.sx, y: pt.sy, tool: Tools.tool };
    Tools.startPt = pt; Tools.moved = false; Tools.lp = pt;
    if (e.button === 2) return;
    if (Ruler.on && Ruler.down(pt, e)) return;
    if (Rec.editing && Rec.down(pt, e)) return;
    let tool = Tools.tool;
    if (e.button === 1 || Tools.spaceDown) tool = 'hand';
    else if (pt.type === 'touch' && ST.v.penOnly && ['pen', 'eraser', 'fill', 'shape', 'connector', 'frame', 'sticky', 'text'].includes(tool)) tool = 'hand';
    Tools.curTool = tool;
    const h = Tools.H[tool]; if (h && h.down) h.down(pt, e);
  },
  onMove(e) {
    if (e.pointerType === 'touch' && performance.now() - Tools.lastPen < 700) return;
    if (e.pointerType === 'pen') Tools.lastPen = performance.now();
    const pt = Tools.pt(e); Tools.lp = pt;
    if (Tools.ptrs.has(e.pointerId)) Tools.ptrs.set(e.pointerId, { sx: pt.sx, sy: pt.sy, type: e.pointerType });
    if (Tools.gest) { Tools.moveGesture(); return; }
    if (!Tools.st && !(e.buttons & 1)) { Tools.hoverAt(pt); return; }
    if (!Tools.st) return;
    if (!Tools.moved && Math.hypot(pt.sx - Tools.startPt.sx, pt.sy - Tools.startPt.sy) > (pt.type === 'touch' ? 7 : 3)) Tools.moved = true;
    const evs = e.getCoalescedEvents ? e.getCoalescedEvents() : [e]; const h = Tools.H[Tools.curTool];
    if (h && h.move) { if (h.coalesce && evs.length > 1) evs.forEach(ce => h.move(Tools.pt(ce), ce)); else h.move(pt, e); }
  },
  onUp(e) {
    const pt = Tools.pt(e); const had = Tools.ptrs.has(e.pointerId); Tools.ptrs.delete(e.pointerId);
    if (Tools.gest) { if (Tools.ptrs.size < 2) { Tools.gest = null; Tools.st = null; Tools.ignoreUntilUp = true; } if (!Tools.ptrs.size) Tools.ignoreUntilUp = false; return; }
    if (Tools.ignoreUntilUp) { if (!Tools.ptrs.size) Tools.ignoreUntilUp = false; return; }
    if (!had) return;
    const h = Tools.H[Tools.curTool]; if (h && h.up) h.up(pt, e); Tools.st = null; Tools.cursor(); R.reqOv();
  },
  endCurrent(cancel) { const st = Tools.st; if (!st) return; if (st.k === 'pen') { Ink.live = null; } if (st.k === 'move' && st.applied && cancel) { st.items.forEach(it => Act.translate(it.o, -st.applied.dx, -st.applied.dy)); } if (st.o && st.added && cancel) D.remove([st.o]); Tools.st = null; R.req(); },
  startGesture() { const a = [...Tools.ptrs.values()]; const d = Math.hypot(a[0].sx - a[1].sx, a[0].sy - a[1].sy) || 1; const c = [(a[0].sx + a[1].sx) / 2, (a[0].sy + a[1].sy) / 2]; Tools.gest = { d, c, v: { x: D.view.x, y: D.view.y, z: D.view.z }, w: R.s2w(c[0], c[1]) }; Tools.st = null; },
  moveGesture() {
    const g = Tools.gest, a = [...Tools.ptrs.values()]; if (a.length < 2) return; const d = Math.hypot(a[0].sx - a[1].sx, a[0].sy - a[1].sy) || 1, c = [(a[0].sx + a[1].sx) / 2, (a[0].sy + a[1].sy) / 2];
    const z = U.clamp(g.v.z * d / g.d, .04, 16); D.view.z = z; D.view.x = g.w[0] - c[0] / z; D.view.y = g.w[1] - c[1] / z; R.req(); Bus.emit('view');
  },
  onWheel(e) {
    e.preventDefault(); const r = R.ov.getBoundingClientRect(), sx = e.clientX - r.left, sy = e.clientY - r.top;
    const mouseWheel = e.deltaMode === 1 || (Math.abs(e.deltaY) >= 50 && e.deltaX === 0 && Number.isInteger(e.deltaY));
    const rd = typeof Study !== 'undefined' && Study.on; const zoom = e.ctrlKey || e.metaKey || (!rd && ((ST.v.wheel === 'zoom') || (ST.v.wheel === 'auto' && mouseWheel)));
    if (zoom) { const k = Math.exp(-e.deltaY * (e.ctrlKey ? .01 : mouseWheel ? .0016 : .004)); R.zoomAt(k, sx, sy); }
    else if (e.shiftKey && !e.deltaX) R.pan(-e.deltaY, 0); else R.pan(-e.deltaX, -e.deltaY);
  },
  onContext(e) {
    const pt = Tools.pt(e); const o = Tools.pick(pt.x, pt.y);
    if (o && !Sel.has(o.id)) Sel.set([o.id]); Menus.context(e.clientX, e.clientY, o, pt);
  },
  hoverAt(pt) {
    if (Tools.tool === 'select' && pt.type !== 'touch') {
      const h = Tools.handleAt(pt); const fl = Tools.flowAt(pt); let hov = R.hover;
      const o = Tools.pick(pt.x, pt.y); if ((o && o.id) !== (R.hover && R.hover.id) && !fl) { R.hover = o; }
      if (h) Tools.cursor(h.id === 'rot' ? 'grab' : h.id === 'cend' || h.id === 'lend' ? 'move' : CURS[h.id]); else if (fl) Tools.cursor('crosshair'); else if (o && Comments.hitPin && false) { } else Tools.cursor(o ? (D.isLocked(o) ? 'not-allowed' : 'move') : 'default');
      if (Comments.pinAt(pt) ) Tools.cursor('pointer');
    }
    R.reqOv();
  },
  /* ---------- tool handlers ---------- */
  H: {}
};

/* hand / pan */
Tools.H.hand = {
  down(pt) { Tools.st = { k: 'pan', sx: pt.sx, sy: pt.sy, vx: D.view.x, vy: D.view.y }; Tools.cursor('grabbing'); },
  move(pt) { const s = Tools.st; D.view.x = s.vx - (pt.sx - s.sx) / D.view.z; D.view.y = s.vy - (pt.sy - s.sy) / D.view.z; R.req(); Bus.emit('view'); },
  up() { }
};

/* select */
Tools.H.select = {
  down(pt, e) {
    // comment pins
    const pin = Comments.pinAt(pt); if (pin) { Comments.open(pin.id); Tools.st = { k: 'none' }; return; }
    // connector / line ends & handles
    const h = Tools.handleAt(pt);
    if (h) {
      const info = Tools.selInfo();
      if (h.id === 'cend') { Tools.st = { k: 'cend', c: info.one, end: h.k }; return; }
      if (h.id === 'lend') { const o = info.one; Tools.st = { k: 'lend', o, end: h.k, ends: Lines.ends(o) }; return; }
      if (h.id === 'rot') { const objs = info.objs; Tools.st = { k: 'rot', objs, c: info.center, a0: Math.atan2(pt.y - info.center[1], pt.x - info.center[0]), orig: objs.map(o => ({ o, rot: o.rot, x: o.x, y: o.y, c: G.center(o) })) }; return; }
      Tools.startResize(h, info, pt); return;
    }
    const fl = Tools.flowAt(pt);
    if (fl) { const a = Conn.anchor(fl.o, fl.side); const c = Conn.make({ id: fl.o.id, side: fl.side }, { p: [pt.x, pt.y] }, { style: Tools.opts.line.style, color: Tools.opts.line.color, sw: Tools.opts.line.sw }); D.add(c); Tools.st = { k: 'cnew', c, added: true, from: fl.o.id }; return; }
    const o = Tools.pick(pt.x, pt.y, false, pt.alt && Sel.ids.length ? true : false);
    if (o && R.badgeHit(o, pt.x, pt.y, D.view.z)) { Act.follow(o); Tools.st = { k: 'none' }; return; }
    if (o) {
      if (pt.shift) { Sel.toggle(o); Tools.st = { k: 'none' }; return; }
      if (!Sel.has(o.id)) Sel.set([o.id]);
      // inner interaction
      const t = T.get(o.type);
      if (t.down && Sel.ids.length === 1) { const [lx, ly] = G.toLocal(o, pt.x, pt.y); const r = t.down(o, lx, ly, e); if (r && r.move) { Tools.st = { k: 'inner', o, h: r, tapCand: false }; return; } }
      if (D.isLocked(o) && Sel.ids.length === 1) { Tools.st = { k: 'none', o, tap: true }; return; }
      Tools.startMove(pt, o, pt.alt); return;
    }
    // empty canvas
    if (!pt.shift) { Sel.clear(); }
    if (pt.type === 'touch' && !pt.shift) { Tools.st = { k: 'pan', sx: pt.sx, sy: pt.sy, vx: D.view.x, vy: D.view.y, empty: true }; return; }
    Tools.st = { k: 'marquee', x0: pt.x, y0: pt.y, x1: pt.x, y1: pt.y, add: pt.shift, base: pt.shift ? Sel.ids.slice() : [], contain: ST.v.selectMode === 'contain' };
  },
  move(pt, e) {
    const s = Tools.st; if (!s) return;
    const k = s.k;
    if (k === 'pan') return Tools.H.hand.move(pt);
    if (k === 'marquee') { s.x1 = pt.x; s.y1 = pt.y; Tools.marqueeSelect(s, pt); R.reqOv(); return; }
    if (k === 'move') return Tools.doMove(pt);
    if (k === 'resize') return Tools.doResize(pt);
    if (k === 'rot') return Tools.doRotate(pt);
    if (k === 'inner') { const [lx, ly] = G.toLocal(s.o, pt.x, pt.y); s.h.move(lx, ly, e); if (s.h.cursor) Tools.cursor(s.h.cursor); return; }
    if (k === 'cend' || k === 'cnew') return Tools.doConnEnd(pt);
    if (k === 'lend') return Tools.doLineEnd(pt);
  },
  up(pt, e) {
    const s = Tools.st; if (!s) return; const k = s.k, moved = Tools.moved;
    if (k === 'move') { if (s.applied && (s.applied.dx || s.applied.dy)) { D.commit(s.dup ? 'Duplicate' : 'Move', s.items.map(i => i.o)); } Snap.guides = []; if (!moved) Tools.tap(pt, e, s.hit); }
    else if (k === 'resize') { D.commit('Resize', s.objs); Snap.guides = []; }
    else if (k === 'rot') D.commit('Rotate', s.objs);
    else if (k === 'inner') { if (moved) s.h.up && s.h.up(); else { Tools.tap(pt, e, s.o); } }
    else if (k === 'cend') { D.commit('Connect', s.c); }
    else if (k === 'cnew') { const c = s.c; const rt = Conn.route(c); if (!moved || Math.hypot(c.w, c.h) < 12) { D.remove([c]); } else D.commit('Connect', c); Sel.set([c.id]); }
    else if (k === 'lend') D.commit('Edit line', s.o);
    else if (k === 'marquee') { Bus.emit('sel'); }
    else if (k === 'none' && s.tap && !moved) Tools.tap(pt, e, s.o);
    else if (k === 'pan' && s.empty && !moved) { Sel.clear(); if (Tools.dbl) Tools.dblAt(pt); }
    else if (k === 'pan') { }
    if (!moved && (k === 'marquee') && Tools.dbl) Tools.dblAt(pt);
    Tools.snapOff();
  }
};
Tools.snapOff = () => { Snap.guides = []; Tools.dimLabel = null; };
Tools.tap = (pt, e, o) => {
  o = o || Tools.pick(pt.x, pt.y); if (!o) return;
  const t = T.get(o.type), [lx, ly] = G.toLocal(o, pt.x, pt.y);
  if (Tools.dbl) { Tools.dblAt(pt, o); return; }
  if (t.tap && Sel.ids.length === 1 && t.tap(o, lx, ly, e)) { R.req(); return; }
  if (!pt.shift && Sel.ids.length > 1 && Sel.has(o.id)) Sel.set([o.id]);
};
Tools.dblAt = (pt, o) => {
  o = o || Tools.pick(pt.x, pt.y);
  if (!o) { // empty: create text
    const t = D.make('text', { x: pt.x - 4, y: pt.y - 14, tc: Tools.opts.text.tc, fs: Tools.opts.text.fs }); t.h = t.fs * Txt.LH + 8; D.add(t); Sel.set([t.id]); Ed.text(t, { x: 6, y: 4, w: t.w - 12, h: t.h - 8, key: 'text', fs: t.fs, al: t.al, va: 'top', color: t.tc, grow: true, newObj: true, selectAll: true }); return;
  }
  const t = T.get(o.type); const [lx, ly] = G.toLocal(o, pt.x, pt.y);
  if (!Sel.has(o.id)) Sel.set([o.id]); if (t.edit && !D.isLocked(o)) t.edit(o, lx, ly); else if (t.edit && o.type === 'file') t.edit(o);
};

/* ---- moving ---- */
Tools.startMove = (pt, hit, dup) => {
  let objs = Sel.objs(); let items = [];
  if (dup) { const c = Act.clone(objs.concat(D.objs.filter(x => x.type === 'connector' && x.from.id && x.to.id && objs.some(a => a.id === x.from.id) && objs.some(a => a.id === x.to.id) && !objs.includes(x))), { dx: 0, dy: 0 }); c.forEach(o => D.add(o)); Sel.set(c.map(o => o.id)); objs = c; }
  const set = new Set(); const add = o => { if (!set.has(o.id) && !D.isLocked(o)) { set.add(o.id); items.push({ o }); } };
  objs.forEach(o => { add(o); if (o.type === 'frame') Act.frameChildren(o).forEach(add); });
  Snap.begin(set);
  Tools.st = { k: 'move', items, applied: { dx: 0, dy: 0 }, x0: pt.x, y0: pt.y, hit, dup, box: G.union(items.map(i => i.o).filter(o => o.type !== 'connector')) };
};
Tools.doMove = pt => {
  const s = Tools.st; if (!s.items.length) return; let dx = pt.x - s.x0, dy = pt.y - s.y0;
  if (pt.shift) { if (Math.abs(dx) > Math.abs(dy)) dy = 0; else dx = 0; }
  if (s.box && !pt.alt) { const b = { x: s.box.x + dx, y: s.box.y + dy, w: s.box.w, h: s.box.h }; const r = Snap.box(b); dx += r.dx; dy += r.dy; if (!ST.v.guides) Snap.guides = []; } else Snap.guides = [];
  const ddx = dx - s.applied.dx, ddy = dy - s.applied.dy; if (!ddx && !ddy) return;
  s.items.forEach(it => Act.translate(it.o, ddx, ddy)); s.applied = { dx, dy }; R.req();
};

/* ---- resize ---- */
Tools.startResize = (h, info, pt) => {
  const objs = info.objs, one = info.one; const hx = h.hx, hy = h.hy;
  const st = { k: 'resize', objs, hx, hy, one, info };
  if (one) {
    st.o0 = { x: one.x, y: one.y, w: one.w, h: one.h, rot: one.rot, fs: one.fs }; const ax = hx < 0 ? one.w : hx > 0 ? 0 : one.w / 2, ay = hy < 0 ? one.h : hy > 0 ? 0 : one.h / 2;
    st.A = [ax, ay]; st.Aw = G.toWorld(one, ax, ay);
  } else {
    const u = info.box; st.u = u; st.Aw = [hx < 0 ? u.x + u.w : hx > 0 ? u.x : u.x + u.w / 2, hy < 0 ? u.y + u.h : hy > 0 ? u.y : u.y + u.h / 2];
    st.orig = objs.map(o => ({ o, x: o.x, y: o.y, w: o.w, h: o.h, fs: o.fs, rot: o.rot, pts: o.type === 'connector' ? JSON.parse(JSON.stringify([o.from, o.to])) : null }));
  }
  const ex = new Set(objs.map(o => o.id)); Snap.begin(ex); Tools.st = st;
};
Tools.doResize = pt => {
  const s = Tools.st, { hx, hy } = s; let px = pt.x, py = pt.y;
  if (!pt.alt) { const r = Snap.box({ x: px, y: py, w: 0, h: 0 }); px += r.dx; py += r.dy; }
  if (s.one) {
    const o = s.one, o0 = s.o0, t = T.get(o.type);
    const [lx, ly] = (() => { const c = [o0.x + o0.w / 2, o0.y + o0.h / 2]; let q = o0.rot ? U.rotPt(px, py, c[0], c[1], -o0.rot) : [px, py]; return [q[0] - o0.x, q[1] - o0.y]; })();
    let nw = hx === 0 ? o0.w : (hx > 0 ? lx - s.A[0] : s.A[0] - lx), nh = hy === 0 ? o0.h : (hy > 0 ? ly - s.A[1] : s.A[1] - ly);
    const minS = 8; nw = Math.max(minS, nw); nh = Math.max(minS, nh);
    const ratio = (t.resize === 'ratio') !== pt.shift;
    if (ratio && t.resize !== 'w') { const k = hx === 0 ? nh / o0.h : hy === 0 ? nw / o0.w : Math.max(nw / o0.w, nh / o0.h); nw = Math.max(minS, o0.w * k); nh = Math.max(minS, o0.h * k); }
    if (t.resize === 'w') nh = o0.h;
    if (pt.alt && false) { }
    const A2 = [hx < 0 ? nw : hx > 0 ? 0 : nw / 2, hy < 0 ? nh : hy > 0 ? 0 : nh / 2];
    const dx = A2[0] - nw / 2, dy = A2[1] - nh / 2, c = Math.cos(o0.rot), sn = Math.sin(o0.rot);
    const cxw = s.Aw[0] - (dx * c - dy * sn), cyw = s.Aw[1] - (dx * sn + dy * c);
    const ow = o.w, oh = o.h; o.w = nw; o.h = nh; o.x = cxw - nw / 2; o.y = cyw - nh / 2;
    if (t.onResize) t.onResize(o, ow, oh); if (t.fit && o.type !== 'table') t.fit(o);
    // for auto-height objects keep the fixed anchor
    if ((t.resize === 'w') && hy === 0) { /* keep top-left for left handle */ if (hx < 0) { o.x = s.Aw[0] - o.w; } else o.x = s.Aw[0]; if (!o.rot) o.y = o0.y; }
    Tools.dimLabel = { o, text: Units.fmt(o.w) + ' × ' + Units.fmt(o.h) };
  } else {
    const u = s.u; let sx = hx === 0 ? 1 : (hx > 0 ? (px - s.Aw[0]) / u.w : (s.Aw[0] - px) / u.w), sy = hy === 0 ? 1 : (hy > 0 ? (py - s.Aw[1]) / u.h : (s.Aw[1] - py) / u.h);
    sx = Math.max(.05, sx); sy = Math.max(.05, sy); if (pt.shift || (hx !== 0 && hy !== 0 && !pt.alt)) { const k = hx === 0 ? sy : hy === 0 ? sx : Math.max(sx, sy); sx = sy = k; }
    s.orig.forEach(r => {
      const o = r.o, t = T.get(o.type); if (t.resize === 'none' || o.type === 'connector') { if (o.type === 'connector') { /* scale floating ends */ } return; }
      const c0 = [r.x + r.w / 2, r.y + r.h / 2]; const nc = [s.Aw[0] + (c0[0] - s.Aw[0]) * sx, s.Aw[1] + (c0[1] - s.Aw[1]) * sy];
      const uni = (sx + sy) / 2; const ow = o.w, oh = o.h; o.w = Math.max(6, r.w * (r.rot ? uni : sx)); o.h = Math.max(6, r.h * (r.rot ? uni : sy)); if (t.resize === 'w') o.h = oh;
      o.x = nc[0] - o.w / 2; o.y = nc[1] - o.h / 2; if (r.fs && (t.ratioFs || o.type === 'text' || o.type === 'sticky') && o.fs) o.fs = Math.max(6, r.fs * uni);
      if (t.onResize) t.onResize(o, ow, oh); if (t.fit) t.fit(o);
    });
    Tools.dimLabel = { box: { x: Math.min(s.Aw[0], px), y: Math.min(s.Aw[1], py), w: u.w * sx, h: u.h * sy }, text: Units.fmt(u.w * sx) + ' × ' + Units.fmt(u.h * sy) };
  }
  R.req();
};
Tools.doRotate = pt => {
  const s = Tools.st; let d = Math.atan2(pt.y - s.c[1], pt.x - s.c[0]) - s.a0;
  const single = s.orig.length === 1;
  if (single) { let r = s.orig[0].rot + d; const snap = pt.shift ? U.rad(15) : U.rad(45); const n = Math.round(r / snap) * snap; if (pt.shift || Math.abs(r - n) < U.rad(3)) r = n; d = r - s.orig[0].rot; }
  else if (pt.shift) d = Math.round(d / U.rad(15)) * U.rad(15);
  s.orig.forEach(r => { const o = r.o; if (T.get(o.type).noRot || o.type === 'connector') return; o.rot = r.rot + d; if (s.orig.length > 1) { const nc = U.rotPt(r.c[0], r.c[1], s.c[0], s.c[1], d); o.x = nc[0] - o.w / 2; o.y = nc[1] - o.h / 2; } });
  let deg = Math.round(U.deg(((s.orig[0].rot + d) % (2 * Math.PI) + 2 * Math.PI) % (2 * Math.PI))); Tools.dimLabel = { rot: true, text: deg + '°', at: s.c };
  R.req();
};
Tools.doLineEnd = pt => {
  const s = Tools.st; let [x, y] = Snap.point(pt.x, pt.y); const other = s.ends[1 - s.end];
  if (pt.shift) { const ang = Math.atan2(y - other[1], x - other[0]), sn = Math.round(ang / (Math.PI / 12)) * Math.PI / 12, l = Math.hypot(x - other[0], y - other[1]); x = other[0] + Math.cos(sn) * l; y = other[1] + Math.sin(sn) * l; }
  const a = s.end === 0 ? [x, y] : s.ends[0], b = s.end === 1 ? [x, y] : s.ends[1]; Lines.setEnds(s.o, a, b); Tools.dimLabel = { text: Units.fmt(Math.hypot(b[0] - a[0], b[1] - a[1])), at: [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2] }; R.req();
};
Tools.doConnEnd = pt => {
  const s = Tools.st, c = s.c, k = s.k === 'cnew' ? 'to' : s.end; const tg = Conn.snapTarget(pt.x, pt.y, s.k === 'cnew' ? s.from : (c[k === 'from' ? 'to' : 'from'].id), D.view.z);
  s.target = tg; if (tg && !(s.k === 'cnew' && tg.id === s.from)) c[k] = { id: tg.id, side: tg.side }; else { const [x, y] = Snap.point(pt.x, pt.y); c[k] = { p: [x, y] }; }
  delete c._rk; R.req();
};
Tools.marqueeSelect = (s, pt) => {
  const r = { x: Math.min(s.x0, s.x1), y: Math.min(s.y0, s.y1), w: Math.abs(s.x1 - s.x0), h: Math.abs(s.y1 - s.y0) }; const contain = s.contain || pt.alt;
  const ids = [];
  for (const o of R.visList) {
    if (o.type === 'frame') { if (G.inRect(o, r, true)) ids.push(o.id); continue; }
    if (contain) { if (G.inRect(o, r, true)) ids.push(o.id); }
    else if (o.type === 'stroke') { if (G.rectsHit(G.aabb(o), r) && Tools.strokeHitsRect(o, r)) ids.push(o.id); }
    else if (G.inRect(o, r, false)) ids.push(o.id);
  }
  Sel.set(s.base.concat(ids), true);
};
Tools.strokeHitsRect = (o, r) => {
  const W = Ink.worldPts(o), inside = p => p[0] >= r.x && p[0] <= r.x + r.w && p[1] >= r.y && p[1] <= r.y + r.h;
  if (W.length === 1) return inside(W[0]);
  for (let i = 0; i < W.length - 1; i++) { if (inside(W[i]) || inside(W[i + 1])) return true; if (Tools.segRect(W[i], W[i + 1], r)) return true; } return false;
};
Tools.segRect = (a, b, r) => {
  let t0 = 0, t1 = 1; const dx = b[0] - a[0], dy = b[1] - a[1]; const p = [-dx, dx, -dy, dy], q = [a[0] - r.x, r.x + r.w - a[0], a[1] - r.y, r.y + r.h - a[1]];
  for (let i = 0; i < 4; i++) { if (p[i] === 0) { if (q[i] < 0) return false; } else { const t = q[i] / p[i]; if (p[i] < 0) { if (t > t1) return false; if (t > t0) t0 = t; } else { if (t < t0) return false; if (t < t1) t1 = t; } } } return true;
};

/* marquee tool (always box select, even on touch) */
Tools.H.marquee = {
  down(pt) { if (!pt.shift) Sel.clear(); Tools.st = { k: 'marquee', x0: pt.x, y0: pt.y, x1: pt.x, y1: pt.y, base: pt.shift ? Sel.ids.slice() : [], contain: ST.v.selectMode === 'contain' }; },
  move(pt) { const s = Tools.st; s.x1 = pt.x; s.y1 = pt.y; Tools.marqueeSelect(s, pt); R.reqOv(); },
  up() { Bus.emit('sel'); }
};
/* lasso select */
Tools.H.lasso = {
  down(pt) { if (!pt.shift) Sel.clear(); Tools.st = { k: 'lasso', pts: [[pt.x, pt.y]], base: pt.shift ? Sel.ids.slice() : [] }; },
  move(pt) { const s = Tools.st; s.pts.push([pt.x, pt.y]); const ids = []; for (const o of R.visList) { if (o.type === 'frame') continue; const c = G.center(o); let inn = G.pointInPoly(c[0], c[1], s.pts); if (!inn && o.type === 'stroke') { inn = Ink.worldPts(o).some(p => G.pointInPoly(p[0], p[1], s.pts)); } if (!inn && ST.v.selectMode !== 'contain') inn = G.corners(o).some(p => G.pointInPoly(p[0], p[1], s.pts)); if (inn) ids.push(o.id); } Sel.set(s.base.concat(ids), true); R.reqOv(); },
  up() { Bus.emit('sel'); }
};
/* cutout */
Tools.H.cutout = {
  down(pt) { Tools.st = { k: 'cut', pts: [[pt.x, pt.y]] }; },
  move(pt) { Tools.st.pts.push([pt.x, pt.y]); R.reqOv(); },
  up() { const s = Tools.st; if (s.pts.length > 6) IO.cutout(s.pts, Tools.opts.cutout.remove); }
};

/* pen */
Tools.H.pen = {
  coalesce: true,
  down(pt) {
    const o = Tools.opts.pen; const st = { pen: o.pen, color: o.color, size: o.size, smart: o.smart && ST.v.smart !== 'off' };
    let p = ST.v.pressure && pt.type !== 'mouse' && pt.raw > 0 ? U.clamp(.5 + (pt.raw - .5) * ST.v.pressureSens * 1.2, .02, 1) : .5;
    const [x, y] = [pt.x, pt.y]; Tools.st = { k: 'pen', last: pt, vel: 0.5, ruler: null };
    if (Ruler.on && ST.v.rulerSnap) { const pr = Ruler.snapPoint(pt); if (pr) { Tools.st.ruler = { a: pr }; Ink.begin(pr[0], pr[1], .5, st); Ink.live.pts.push([pr[0], pr[1], .5]); return; } }
    Ink.begin(x, y, p, st); Tools.st.timer = null; R.reqOv();
  },
  move(pt) {
    const s = Tools.st; if (!s || !Ink.live) return;
    if (s.ruler) { const pr = Ruler.snapPoint(pt, true, s.ruler.a); if (pr) { Ink.live.pts[1] = [pr[0], pr[1], .5]; R.reqOv(); } return; }
    let p = .5;
    if (ST.v.pressure) { if (pt.type !== 'mouse' && pt.raw > 0 && pt.raw !== .5) p = U.clamp(.5 + (pt.raw - .5) * ST.v.pressureSens * 1.2, .02, 1); else { const dt = Math.max(1, pt.t - s.last.t), v = Math.hypot(pt.sx - s.last.sx, pt.sy - s.last.sy) / dt; s.vel = s.vel * .75 + U.clamp(1.0 - v * .35, .25, 1) * .25; p = s.vel; } }
    s.last = pt; const added = Ink.add(pt.x, pt.y, p);
    if (added) { clearTimeout(s.timer); if (ST.v.smart === 'hold' && Ink.live && Ink.live.st.smart) { s.timer = setTimeout(() => { if (Ink.live && Tools.st === s) { const r = Ink.recognizeObj(Ink.live.pts, Ink.live.st); if (r) { Ink.live.shape = r; R.reqOv(); } } }, 620); } R.reqOv(); }
  },
  up(pt) {
    const s = Tools.st; if (s) clearTimeout(s.timer); const L = Ink.live; if (!L) return;
    let o = Ink.finish(ST.v.smart === 'always');
    if (o) { if (o.type === 'stroke' && o.pts.length / 3 === 1 && L.pts.length === 1) { } D.add(o); const cl = o.type === 'stroke' && L.st.smart; D.commit('Draw', o); }
    Ink.live = null; R.req();
  }
};
/* eraser */
Tools.H.eraser = {
  coalesce: true,
  down(pt) {
    const o = Tools.opts.eraser; Erase.changed = false;
    if (o.type === 'area') { Tools.st = { k: 'eraseArea', pts: [[pt.x, pt.y]] }; return; }
    Tools.st = { k: 'erase', last: [pt.x, pt.y] }; Tools.H.eraser.at(pt.x, pt.y);
  },
  at(x, y) { const o = Tools.opts.eraser; Erase.at(x, y, o.size / 2 / D.view.z, o.type === 'pixel' ? 'pixel' : 'stroke', ST.v.eraseAll); },
  move(pt) {
    const s = Tools.st; if (!s) return; if (s.k === 'eraseArea') { s.pts.push([pt.x, pt.y]); R.reqOv(); return; }
    const [lx, ly] = s.last, d = Math.hypot(pt.x - lx, pt.y - ly), step = Math.max(1, Tools.opts.eraser.size / 4 / D.view.z), n = Math.ceil(d / step);
    for (let i = 1; i <= n; i++) Tools.H.eraser.at(lx + (pt.x - lx) * i / n, ly + (pt.y - ly) * i / n); s.last = [pt.x, pt.y];
  },
  up() { const s = Tools.st; if (!s) return; if (s.k === 'eraseArea') { if (s.pts.length > 3) Erase.lasso(s.pts, ST.v.eraseAll); } if (Erase.changed) { D.commit('Erase', 'all'.slice(0, 0) || []); Bus.emit('sel'); } Erase.changed = false; }
};
/* fill */
Tools.H.fill = { down(pt) { Act.fillAt(pt, Tools.opts.fill.color); Tools.st = { k: 'none' }; } };
/* comment */
Tools.H.comment = {
  down(pt) { const pin = Comments.pinAt(pt); if (pin) { Comments.open(pin.id); Tools.st = { k: 'none' }; return; } const o = Tools.pick(pt.x, pt.y, true); Act.addComment(pt.x, pt.y, o && o.id); Tools.st = { k: 'none' }; Tools.done(); }
};
/* laser */
Tools.H.laser = {
  coalesce: true,
  down(pt) { Tools.st = { k: 'laser' }; Laser.down(pt); },
  move(pt) { Laser.move(pt); },
  up() { Laser.up(); }
};
/* text */
Tools.H.text = {
  down(pt) {
    const o = Tools.pick(pt.x, pt.y, true);
    if (o && (o.type === 'text' || T.get(o.type).edit && ['shape', 'sticky', 'line', 'connector'].includes(o.type))) { Sel.set([o.id]); Tools.st = { k: 'none' }; const [lx, ly] = G.toLocal(o, pt.x, pt.y); setTimeout(() => T.get(o.type).edit(o, lx, ly), 10); Tools.done(); return; }
    Tools.st = { k: 'mk', kind: 'text', x0: pt.x, y0: pt.y };
  },
  move(pt) { },
  up(pt) {
    const s = Tools.st; if (!s || s.kind !== 'text') return; const op = Tools.opts.text; const w = Math.abs(pt.x - s.x0) > 40 ? Math.abs(pt.x - s.x0) : 260;
    const t = D.make('text', { x: Math.min(pt.x, s.x0) - 4, y: s.y0 - op.fs * .6, w, fs: op.fs, tc: op.tc }); t.h = t.fs * Txt.LH + 8; D.add(t); Sel.set([t.id]); Tools.done();
    Ed.text(t, { x: 6, y: 4, w: t.w - 12, h: t.h - 8, key: 'text', fs: t.fs, al: t.al, va: 'top', color: t.tc, grow: true, newObj: true, selectAll: true });
  }
};
/* sticky */
Tools.H.sticky = {
  down(pt) { Tools.st = { k: 'mk', x0: pt.x, y0: pt.y, o: null, added: false }; },
  move(pt) {
    const s = Tools.st; if (!Tools.moved) return; const w = Math.max(80, Math.abs(pt.x - s.x0)), h = Math.max(80, Math.abs(pt.y - s.y0));
    if (!s.o) { s.o = D.make('sticky', { color: Tools.opts.sticky.color, author: '' }); D.add(s.o); s.added = true; } s.o.x = Math.min(s.x0, pt.x); s.o.y = Math.min(s.y0, pt.y); s.o.w = pt.shift ? Math.max(w, h) : w; s.o.h = pt.shift ? Math.max(w, h) : h; R.req();
  },
  up(pt) {
    const s = Tools.st; let o = s.o; if (!o) { o = D.make('sticky', { color: Tools.opts.sticky.color }); o.x = s.x0 - o.w / 2; o.y = s.y0 - o.h / 2; D.add(o); }
    Sel.set([o.id]); Tools.done(); Ed.text(o, { x: 14, y: 14, w: o.w - 28, h: o.h - 28, key: 'text', fsFn: () => T.reg.sticky.autoFs(o), fs: 24, al: 'center', va: 'middle', color: o.tc, auto: true, newObj: true, selectAll: true });
  }
};
/* shapes / lines */
Tools.H.shape = {
  down(pt) {
    const op = Tools.opts.shape, lp = Tools.opts.line; let o;
    const lineMode = op.mode === 'line';
    if (lineMode) o = D.make('line', { color: lp.color, sw: lp.sw, dash: lp.dash, he: lp.kind === 'arrow' ? 'arrow' : 'none', hs: 'none' });
    else o = D.make('shape', { kind: op.kind, fill: op.fill, stroke: op.stroke, sw: op.sw, tc: U.isDark(op.fill) ? '#ffffff' : '#1f2430' });
    const [sx, sy] = ST.v.snapGrid ? [R.snapG(pt.x), R.snapG(pt.y)] : [pt.x, pt.y];
    Tools.st = { k: 'mk', o, added: false, x0: sx, y0: sy, line: lineMode }; Snap.begin(new Set());
  },
  move(pt) {
    const s = Tools.st; if (!Tools.moved) return; const o = s.o; let [x, y] = pt.alt ? [pt.x, pt.y] : Snap.point(pt.x, pt.y);
    if (!s.added) { D.add(o); s.added = true; }
    if (s.line) { if (pt.shift) { const ang = Math.atan2(y - s.y0, x - s.x0), sn = Math.round(ang / (Math.PI / 12)) * Math.PI / 12, l = Math.hypot(x - s.x0, y - s.y0); x = s.x0 + Math.cos(sn) * l; y = s.y0 + Math.sin(sn) * l; } Lines.setEnds(o, [s.x0, s.y0], [x, y]); Tools.dimLabel = { text: Units.fmt(Math.hypot(x - s.x0, y - s.y0)), at: [(x + s.x0) / 2, (y + s.y0) / 2] }; }
    else {
      let w = x - s.x0, h = y - s.y0; if (pt.shift) { const m = Math.max(Math.abs(w), Math.abs(h)); w = Math.sign(w || 1) * m; h = Math.sign(h || 1) * m; }
      if (pt.alt) { o.x = s.x0 - Math.abs(w); o.y = s.y0 - Math.abs(h); o.w = Math.abs(w) * 2; o.h = Math.abs(h) * 2; } else { o.x = Math.min(s.x0, s.x0 + w); o.y = Math.min(s.y0, s.y0 + h); o.w = Math.abs(w); o.h = Math.abs(h); }
      Tools.dimLabel = { o, text: Units.fmt(o.w) + ' × ' + Units.fmt(o.h) };
    }
    R.req();
  },
  up(pt) {
    const s = Tools.st; if (!s) return; const o = s.o;
    if (!s.added) { if (s.line) { Lines.setEnds(o, [s.x0 - 90, s.y0], [s.x0 + 90, s.y0]); } else { o.w = o.kind === 'ellipse' || o.kind === 'diamond' || o.kind === 'callout' ? 170 : 160; o.h = o.w * .7; if (['ellipse', 'plus', 'star', 'star4', 'star6', 'heart', 'octagon', 'connector', 'or', 'hexagon', 'pentagon'].includes(o.kind)) o.h = o.w = 130; o.x = s.x0 - o.w / 2; o.y = s.y0 - o.h / 2; } D.add(o); }
    else if (!s.line && (o.w < 8 || o.h < 8)) { o.w = Math.max(o.w, 30); o.h = Math.max(o.h, 30); }
    D.commit('Add shape', o); Sel.set([o.id]); Tools.dimLabel = null; Snap.guides = []; Tools.done();
  }
};
/* frame */
Tools.H.frame = {
  down(pt) { Tools.st = { k: 'mk', x0: pt.x, y0: pt.y, o: null }; },
  move(pt) { const s = Tools.st; if (!Tools.moved) return; if (!s.o) { s.o = D.make('frame', { name: 'Frame ' + (D.frames().length + 1) }); D.add(s.o); } s.o.x = Math.min(s.x0, pt.x); s.o.y = Math.min(s.y0, pt.y); s.o.w = Math.abs(pt.x - s.x0); s.o.h = Math.abs(pt.y - s.y0); Tools.dimLabel = { o: s.o, text: Units.fmt(s.o.w) + ' × ' + Units.fmt(s.o.h) }; R.req(); },
  up(pt) {
    const s = Tools.st; let f = s.o; if (!f) { const p = FRAME_PRESETS[Tools.opts.frame.preset] || FRAME_PRESETS[0]; f = D.make('frame', { name: 'Frame ' + (D.frames().length + 1), w: p[1], h: p[2] }); f.x = s.x0 - f.w / 2; f.y = s.y0 - f.h / 2; D.add(f); }
    f.ori = f.w >= f.h ? 'landscape' : 'portrait'; D.commit('Add frame', f); Sel.set([f.id]); Tools.dimLabel = null; Tools.done();
  }
};
/* connector tool */
Tools.H.connector = {
  down(pt) {
    const lp = Tools.opts.line; const tg = Conn.snapTarget(pt.x, pt.y, null, D.view.z);
    const c = Conn.make(tg ? { id: tg.id, side: tg.side } : { p: [pt.x, pt.y] }, { p: [pt.x, pt.y] }, { style: lp.style, color: lp.color, sw: lp.sw, dash: lp.dash, he: 'arrow' }); D.add(c);
    Tools.st = { k: 'cnew', c, added: true, from: tg && tg.id };
  },
  move(pt) { Tools.doConnEnd(pt); },
  up(pt) { const s = Tools.st; const c = s.c; Conn.route(c); if (!Tools.moved || Math.hypot(c.w, c.h) < 12) D.remove([c]); else { D.commit('Connect', c); Sel.set([c.id]); } Tools.done(); }
};

/* ---------- overlay painting ---------- */
Tools.overlay = ctx => {
  const z = D.view.z, rec = (typeof Rec !== 'undefined' && Rec) && Rec.on;
  // snap guides
  if (Snap.guides.length) { ctx.strokeStyle = '#ec4899'; ctx.lineWidth = 1; ctx.setLineDash([4, 3]); ctx.beginPath(); for (const g of Snap.guides) { if (g.v === 'x') { const a = R.w2s(g.at, g.a), b = R.w2s(g.at, g.b); ctx.moveTo(a[0], a[1] - 8); ctx.lineTo(b[0], b[1] + 8); } else { const a = R.w2s(g.a, g.at), b = R.w2s(g.b, g.at); ctx.moveTo(a[0] - 8, a[1]); ctx.lineTo(b[0] + 8, b[1]); } } ctx.stroke(); ctx.setLineDash([]); }
  // live pen stroke
  if (Ink.live) Ink.drawLive(ctx_w(ctx));
  function ctx_w(c) { c.setTransform(R.dpr, 0, 0, R.dpr, 0, 0); return c; }
  const T0 = Tools.tool, st = Tools.st;
  // hover outline
  if (!rec && T0 === 'select' && R.hover && !Sel.has(R.hover.id) && !st) { outlineObj(ctx, R.hover, 'rgba(79,70,229,.55)', 1.5); }
  // selection
  if (!rec) {
    const info = Tools.selInfo();
    if (info) {
      const col = '#4f46e5';
      if (info.kind === 'conn') {
        const c = info.one; const rt = Conn.route(c); ctx.strokeStyle = 'rgba(79,70,229,.35)'; ctx.lineWidth = c.sw * z + 6; ctx.lineCap = 'round'; ctx.beginPath(); rt.pts.forEach((p, i) => { const s = R.w2s(p[0], p[1]); i ? ctx.lineTo(s[0], s[1]) : ctx.moveTo(s[0], s[1]); }); ctx.stroke();
        if (!info.locked) for (const k of ['from', 'to']) { const p = Conn.endPoint(c, k), s = R.w2s(p.x, p.y); dot(ctx, s[0], s[1], 7, c[k].id ? '#22c55e' : '#fff', col); }
      } else if (info.kind === 'ends') {
        const A = R.w2s(...info.a), B = R.w2s(...info.b); ctx.strokeStyle = 'rgba(79,70,229,.3)'; ctx.lineWidth = info.one.sw * z + 6; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(A[0], A[1]); ctx.lineTo(B[0], B[1]); ctx.stroke(); if (!info.locked) { dot(ctx, A[0], A[1], 7, '#fff', col); dot(ctx, B[0], B[1], 7, '#fff', col); }
      } else {
        if (info.objs.length > 1) { for (const o of info.objs) outlineObj(ctx, o, 'rgba(79,70,229,.5)', 1.2); }
        ctx.strokeStyle = info.locked ? '#94a3b8' : col; ctx.lineWidth = 1.6; if (info.locked) ctx.setLineDash([5, 4]); ctx.beginPath(); info.sc.forEach((p, i) => i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1])); ctx.closePath(); ctx.stroke(); ctx.setLineDash([]);
        if (info.rotK && !st) { ctx.strokeStyle = col; ctx.lineWidth = 1.4; ctx.beginPath(); ctx.moveTo(info.rotK.bx, info.rotK.by); ctx.lineTo(info.rotK.x, info.rotK.y); ctx.stroke(); dot(ctx, info.rotK.x, info.rotK.y, 7.5, '#fff', col, 'rot'); }
        if (!st || st.k === 'resize') for (const h of info.handles) { ctx.fillStyle = '#fff'; ctx.strokeStyle = col; ctx.lineWidth = 1.8; ctx.beginPath(); ctx.rect(h.x - 5.5, h.y - 5.5, 11, 11); ctx.fill(); ctx.stroke(); }
        if (info.locked) { const p = info.sc[1]; ctx.fillStyle = '#64748b'; ctx.beginPath(); ctx.arc(p[0] + 10, p[1] - 10, 11, 0, 7); ctx.fill(); ctx.fillStyle = '#fff'; ctx.fillRect(p[0] + 5, p[1] - 11, 10, 8); ctx.strokeStyle = '#fff'; ctx.lineWidth = 1.6; ctx.beginPath(); ctx.arc(p[0] + 10, p[1] - 12, 3, Math.PI, 0); ctx.stroke(); }
        if (ST.v.dims && !info.locked && !Tools.dimLabel) { const b = info.box; const p = R.w2s(b.x + b.w / 2, b.y + b.h); label(ctx, p[0], p[1] + 22, Units.fmt(b.w) + ' × ' + Units.fmt(b.h)); }
      }
      // flow handles
    }
    if (T0 === 'select' && ST.v.flow && !st) {
      const cand = Sel.one() || R.hover; if (cand && cand.type !== 'connector' && !T.get(cand.type).noConn && !T.get(cand.type).ends && cand.type !== 'frame') {
        for (const side of ['t', 'r', 'b', 'l']) { const a = Conn.anchor(cand, side), s = R.w2s(a.x, a.y), s2 = R.w2s(a.x + a.dx * 26 / z, a.y + a.dy * 26 / z); ctx.fillStyle = 'rgba(99,102,241,.14)'; ctx.strokeStyle = '#6366f1'; ctx.lineWidth = 1.6; ctx.beginPath(); ctx.arc(s2[0], s2[1], 9, 0, 7); ctx.fill(); ctx.stroke(); ctx.beginPath(); const ang = Math.atan2(a.dy, a.dx); ctx.save(); ctx.translate(s2[0], s2[1]); ctx.rotate(ang); ctx.moveTo(-3.5, 0); ctx.lineTo(3.5, 0); ctx.moveTo(.5, -3); ctx.lineTo(3.5, 0); ctx.lineTo(.5, 3); ctx.stroke(); ctx.restore(); ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(s[0], s[1], 3.2, 0, 7); ctx.fill(); ctx.stroke(); }
      }
    }
  }
  // connection targets
  if (st && (st.k === 'cend' || st.k === 'cnew') && st.target) { const o = D.byId.get(st.target.id); if (o) { outlineObj(ctx, o, '#22c55e', 2.5); for (const side of ['t', 'r', 'b', 'l']) { const a = Conn.anchor(o, side), s = R.w2s(a.x, a.y); dot(ctx, s[0], s[1], side === st.target.side ? 6.5 : 4.5, side === st.target.side ? '#22c55e' : '#fff', '#22c55e'); } } }
  if (Tools.tool === 'connector' && !st && Tools.lp) { const tg = Conn.snapTarget(Tools.lp.x, Tools.lp.y, null, z); if (tg) { const o = D.byId.get(tg.id); if (o) { outlineObj(ctx, o, '#22c55e', 2); for (const side of ['t', 'r', 'b', 'l']) { const a = Conn.anchor(o, side), s = R.w2s(a.x, a.y); dot(ctx, s[0], s[1], 5, '#fff', '#22c55e'); } } } }
  // marquee / lasso / cutout / area eraser
  if (st && st.k === 'marquee') { const a = R.w2s(Math.min(st.x0, st.x1), Math.min(st.y0, st.y1)), b = R.w2s(Math.max(st.x0, st.x1), Math.max(st.y0, st.y1)); ctx.fillStyle = 'rgba(79,70,229,.08)'; ctx.strokeStyle = '#4f46e5'; ctx.lineWidth = 1.2; if (st.contain) ctx.setLineDash([5, 3]); ctx.fillRect(a[0], a[1], b[0] - a[0], b[1] - a[1]); ctx.strokeRect(a[0], a[1], b[0] - a[0], b[1] - a[1]); ctx.setLineDash([]); }
  if (st && (st.k === 'lasso' || st.k === 'cut' || st.k === 'eraseArea')) { ctx.strokeStyle = st.k === 'cut' ? '#ec4899' : st.k === 'eraseArea' ? '#ef4444' : '#4f46e5'; ctx.fillStyle = st.k === 'eraseArea' ? 'rgba(239,68,68,.1)' : 'rgba(79,70,229,.07)'; ctx.lineWidth = 1.8; ctx.setLineDash([6, 4]); ctx.beginPath(); st.pts.forEach((p, i) => { const s = R.w2s(p[0], p[1]); i ? ctx.lineTo(s[0], s[1]) : ctx.moveTo(s[0], s[1]); }); ctx.fill(); ctx.stroke(); ctx.setLineDash([]); }
  // eraser cursor
  if (T0 === 'eraser' && Tools.lp && !rec) { const r = Tools.opts.eraser.size / 2; ctx.strokeStyle = '#1f2430'; ctx.fillStyle = 'rgba(255,255,255,.35)'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(Tools.lp.sx, Tools.lp.sy, r, 0, 7); ctx.fill(); ctx.stroke(); }
  // pen cursor dot
  if (T0 === 'pen' && Tools.lp && Tools.lp.type === 'mouse' && !Ink.live && !rec) { const r = Math.max(2, Tools.opts.pen.size * (PENS[Tools.opts.pen.pen].m) * z / 2); ctx.strokeStyle = 'rgba(0,0,0,.5)'; ctx.lineWidth = 1; ctx.beginPath(); ctx.arc(Tools.lp.sx, Tools.lp.sy, Math.max(r, 2), 0, 7); ctx.stroke(); }
  // dimension label
  if (Tools.dimLabel && !rec) {
    const d = Tools.dimLabel; let p;
    if (d.at) p = R.w2s(d.at[0], d.at[1]); else if (d.o) { const b = G.aabb(d.o); p = R.w2s(b.x + b.w / 2, b.y + b.h); p[1] += 24; } else if (d.box) p = R.w2s(d.box.x + d.box.w / 2, d.box.y + d.box.h + 24);
    if (p) label(ctx, p[0], p[1], d.text);
  }
  // comments, ruler, recording area, laser spotlight
  Comments.draw(ctx); if (Ruler.on) Ruler.draw(ctx); if ((typeof Rec !== 'undefined' && Rec)) Rec.drawArea(ctx);
  function outlineObj(c, o, col, w) { const t = T.get(o.type); let pts; if (t.bounds && o.type === 'connector') { const rt = Conn.route(o); c.strokeStyle = col; c.lineWidth = w + 2; c.lineCap = 'round'; c.beginPath(); rt.pts.forEach((p, i) => { const s = R.w2s(p[0], p[1]); i ? c.lineTo(s[0], s[1]) : c.moveTo(s[0], s[1]); }); c.stroke(); return; } pts = G.corners(o).map(p => R.w2s(p[0], p[1])); c.strokeStyle = col; c.lineWidth = w; c.beginPath(); pts.forEach((p, i) => i ? c.lineTo(p[0], p[1]) : c.moveTo(p[0], p[1])); c.closePath(); c.stroke(); }
};
function dot(ctx, x, y, r, fill, stroke, kind) { ctx.fillStyle = fill; ctx.strokeStyle = stroke; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(x, y, r, 0, 7); ctx.fill(); ctx.stroke(); if (kind === 'rot') { ctx.beginPath(); ctx.arc(x, y, 3.3, -2.2, 1.4); ctx.stroke(); } }
function label(ctx, x, y, text) { ctx.font = '600 12px ' + U.FONTS.sans; const w = ctx.measureText(text).width + 14; ctx.fillStyle = 'rgba(31,36,48,.92)'; ctx.beginPath(); rr(ctx, x - w / 2, y - 11, w, 22, 6); ctx.fill(); ctx.fillStyle = '#fff'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(text, x, y + .5); }
