'use strict';
/* ===== Renderer: viewport, grid, object painting, minimap, scrollbars ===== */
const R = {
  host: null, cv: null, ctx: null, ov: null, octx: null, lcv: null, lctx: null, W: 800, H: 600, dpr: 1,
  _c: true, _o: true, _raf: 0, overlays: [], visList: [], hover: null,
  get v() { return D.view; },
  init(host) {
    R.host = host;
    R.cv = U.$('#cv'); R.ctx = R.cv.getContext('2d', { alpha: false });
    R.ov = U.$('#ov'); R.octx = R.ov.getContext('2d');
    R.lcv = U.$('#lcv'); R.lctx = R.lcv.getContext('2d');
    new ResizeObserver(() => R.resize()).observe(host);
    R.resize();
    R.mm = U.$('#minimap canvas'); R.mmx = R.mm.getContext('2d');
    R.initMinimap(); SB.init();
  },
  resize() {
    const r = R.host.getBoundingClientRect();
    R.W = Math.max(50, Math.round(r.width)); R.H = Math.max(50, Math.round(r.height));
    R.dpr = Math.min(window.devicePixelRatio || 1, 2.5);
    for (const c of [R.cv, R.ov, R.lcv]) { c.width = Math.round(R.W * R.dpr); c.height = Math.round(R.H * R.dpr); c.style.width = R.W + 'px'; c.style.height = R.H + 'px'; }
    R.req(); Bus.emit('resize');
  },
  req() { R._c = R._o = true; R.sched(); },
  reqOv() { R._o = true; R.sched(); },
  sched() { if (!R._raf) R._raf = requestAnimationFrame(() => { R._raf = 0; R.frame(); }); },
  w2s(x, y) { const v = D.view; return [(x - v.x) * v.z, (y - v.y) * v.z]; },
  s2w(x, y) { const v = D.view; return [x / v.z + v.x, y / v.z + v.y]; },
  viewRect() { const v = D.view; return { x: v.x, y: v.y, w: R.W / v.z, h: R.H / v.z }; },
  frame() {
    if (!D.id) return;
    if (typeof Study !== 'undefined' && Study.on && !R.animating && Study.clamp()) { R._c = true; R._o = true; }
    if (R._c) {
      R._c = false;
      R.visList = D.sorted().filter(o => D.isVisible(o));
      R.paint(R.ctx, { view: D.view, W: R.W, H: R.H, dpr: R.dpr, objs: R.visList, bg: D.bg, grid: D.grid });
      SB.update(); try { Embeds.sync(); } catch (e) { console.error(e); } R.mmDirty = true;
    }
    if (R._o) {
      R._o = false;
      const c = R.octx; c.setTransform(1, 0, 0, 1, 0, 0); c.clearRect(0, 0, R.ov.width, R.ov.height);
      c.setTransform(R.dpr, 0, 0, R.dpr, 0, 0);
      for (const f of R.overlays) { c.save(); try { f(c); } catch (e) { console.error(e); } c.restore(); }
    }
    if (R.mmDirty) { R.mmDirty = false; R.drawMinimap(); }
    if (AS.playing.size || R.animating) R.req();
  },
  paint(ctx, o) {
    const v = o.view, W = o.W, H = o.H, dpr = o.dpr;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    if (o.transparent) ctx.clearRect(0, 0, W * dpr, H * dpr); else { ctx.fillStyle = o.bg; ctx.fillRect(0, 0, W * dpr, H * dpr); }
    if (o.grid && o.grid.type !== 'none' && !o.noGrid) R.drawGrid(ctx, v, W, H, dpr, o.grid, o.bg);
    const k = v.z * dpr; ctx.setTransform(k, 0, 0, k, -v.x * k, -v.y * k);
    const vr = { x: v.x - 20 / v.z, y: v.y - 20 / v.z, w: W / v.z + 40 / v.z, h: H / v.z + 40 / v.z };
    const env = { z: v.z, dpr, k, exporting: !!o.exporting, rect: vr };
    for (const ob of o.objs) {
      if (ob.type === 'connector' && !ST.v.showConn && !o.exporting) continue;
      const b = G.aabb(ob);
      if (b.x > vr.x + vr.w || b.x + b.w < vr.x || b.y > vr.y + vr.h || b.y + b.h < vr.y) continue;
      R.drawObj(ctx, ob, env);
    }
  },
  drawObj(ctx, o, env) {
    const t = T.get(o.type);
    ctx.save();
    if (o.op < 1) ctx.globalAlpha = o.op * ctx.globalAlpha;
    const lo = D.layerOf(o).o; if (lo < 1) ctx.globalAlpha *= lo;
    if (o.sh && o.sh.on !== false) { ctx.shadowColor = o.sh.c || 'rgba(0,0,0,.35)'; ctx.shadowBlur = (o.sh.b || 12) * env.k; ctx.shadowOffsetX = (o.sh.x || 0) * env.k; ctx.shadowOffsetY = (o.sh.y == null ? 4 : o.sh.y) * env.k; }
    if (!t.world) {
      if (o.rot) { const cx = o.x + o.w / 2, cy = o.y + o.h / 2; ctx.translate(cx, cy); ctx.rotate(o.rot); ctx.translate(-cx, -cy); }
      ctx.translate(o.x, o.y);
    }
    t.draw(ctx, o, env);
    ctx.restore();
    if (!env.exporting && o.link && !t.world) R.drawBadge(ctx, o, env, 'link');
  },
  drawBadge(ctx, o, env, kind) {
    ctx.save();
    if (o.rot) { const cx = o.x + o.w / 2, cy = o.y + o.h / 2; ctx.translate(cx, cy); ctx.rotate(o.rot); ctx.translate(-cx, -cy); }
    ctx.translate(o.x + o.w, o.y); const s = 1 / env.z;
    ctx.fillStyle = '#4f46e5'; ctx.beginPath(); ctx.arc(-4 * s, 4 * s, 10 * s, 0, 7); ctx.fill();
    ctx.strokeStyle = '#fff'; ctx.lineWidth = 1.6 * s; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(-8.5 * s, 4 * s); ctx.lineTo(-3.5 * s, 4 * s); ctx.moveTo(-4.5 * s, 4 * s); ctx.lineTo(-0.5 * s, 4 * s);
    ctx.moveTo(-7 * s, 6 * s); ctx.lineTo(-1 * s, 2 * s); ctx.stroke();
    ctx.restore();
  },
  badgeHit(o, wx, wy, z) {
    if (!o.link) return false;
    const [lx, ly] = G.toLocal(o, wx, wy);
    return Math.hypot(lx - (o.w - 4 / z), ly - 4 / z) < 12 / z;
  },
  gridColor(bg) { return U.isDark(bg) ? 'rgba(255,255,255,' : 'rgba(40,50,80,'; },
  drawGrid(ctx, v, W, H, dpr, g, bg) {
    let step = g.size || 24; while (step * v.z < (g.type === 'lines' ? 10 : 14)) step *= 2;
    const s = step * v.z, base = R.gridColor(bg);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const ox = -((v.x % step) + step) % step * v.z, oy = -((v.y % step) + step) % step * v.z;
    const fade = U.clamp((s - 8) / 20, 0.25, 1);
    if (g.type === 'dots') {
      ctx.fillStyle = base + (0.38 * fade) + ')'; const r = Math.max(0.9, Math.min(2, v.z * 1.1));
      for (let x = ox; x < W; x += s) for (let y = oy; y < H; y += s) ctx.fillRect(x - r / 2, y - r / 2, r, r);
    } else if (g.type === 'lines') {
      ctx.lineWidth = 1; const big = step * 5;
      ctx.strokeStyle = base + (0.10 * fade) + ')'; ctx.beginPath();
      for (let x = ox; x < W; x += s) { ctx.moveTo(Math.round(x) + .5, 0); ctx.lineTo(Math.round(x) + .5, H); }
      for (let y = oy; y < H; y += s) { ctx.moveTo(0, Math.round(y) + .5); ctx.lineTo(W, Math.round(y) + .5); }
      ctx.stroke();
      ctx.strokeStyle = base + (0.22 * fade) + ')'; ctx.beginPath();
      const bs = big * v.z, bx = -((v.x % big) + big) % big * v.z, by = -((v.y % big) + big) % big * v.z;
      for (let x = bx; x < W; x += bs) { ctx.moveTo(Math.round(x) + .5, 0); ctx.lineTo(Math.round(x) + .5, H); }
      for (let y = by; y < H; y += bs) { ctx.moveTo(0, Math.round(y) + .5); ctx.lineTo(W, Math.round(y) + .5); }
      ctx.stroke();
    } else if (g.type === 'cross') {
      ctx.strokeStyle = base + (0.4 * fade) + ')'; ctx.lineWidth = 1; ctx.beginPath(); const a = Math.min(4, s / 5);
      for (let x = ox; x < W; x += s) for (let y = oy; y < H; y += s) { ctx.moveTo(x - a, y); ctx.lineTo(x + a, y); ctx.moveTo(x, y - a); ctx.lineTo(x, y + a); }
      ctx.stroke();
    } else if (g.type === 'iso') {
      ctx.strokeStyle = base + (0.16 * fade) + ')'; ctx.lineWidth = 1; ctx.beginPath();
      const h = s * 0.866; for (let y = oy - h; y < H + h; y += h) { ctx.moveTo(0, y); ctx.lineTo(W, y); }
      const t = Math.tan(Math.PI / 6);
      for (let x = ox - H / t - s; x < W + s; x += s) { ctx.moveTo(x, 0); ctx.lineTo(x + H / t, H); ctx.moveTo(x, 0); ctx.lineTo(x - H / t, H); }
      ctx.stroke();
    }
  },
  gridStep() { return D.grid.size || 24; },
  snapG(v) { const s = R.gridStep(); return Math.round(v / s) * s; },
  /* view control */
  zoomAt(f, sx, sy) {
    const v = D.view; const nz = U.clamp(v.z * f, 0.04, 16);
    const [wx, wy] = R.s2w(sx, sy); v.z = nz; v.x = wx - sx / nz; v.y = wy - sy / nz; R.req(); Bus.emit('view');
  },
  setZoom(z, anim) { const t = { x: 0, y: 0, z }; const [wx, wy] = R.s2w(R.W / 2, R.H / 2); t.x = wx - R.W / 2 / z; t.y = wy - R.H / 2 / z; anim ? R.animate(t) : (Object.assign(D.view, t), R.req(), Bus.emit('view')); },
  pan(dx, dy) { const v = D.view; v.x -= dx / v.z; v.y -= dy / v.z; R.req(); Bus.emit('view'); },
  fitRect(b, pad = 60, anim = true, maxZ = 4) {
    if (!b || b.w <= 0 && b.h <= 0) b = { x: -400, y: -250, w: 800, h: 500 };
    const z = U.clamp(Math.min((R.W - 2 * pad) / Math.max(b.w, 1), (R.H - 2 * pad) / Math.max(b.h, 1)), 0.04, maxZ);
    const t = { z, x: b.x + b.w / 2 - R.W / 2 / z, y: b.y + b.h / 2 - R.H / 2 / z };
    anim ? R.animate(t) : (Object.assign(D.view, t), R.req(), Bus.emit('view'));
  },
  fitAll(anim = true) { const l = D.objs.filter(o => D.isVisible(o)); R.fitRect(l.length ? G.union(l) : null, 70, anim, 2); },
  fitSel() { const s = Sel.objs(); if (s.length) R.fitRect(G.union(s), 90, true, 3); },
  centerOn(o, zoom) { const b = G.aabb(o); const z = zoom || Math.max(D.view.z, 0.6); R.animate({ z, x: b.x + b.w / 2 - R.W / 2 / z, y: b.y + b.h / 2 - R.H / 2 / z }); },
  animate(t, ms = 320) {
    const v = D.view, a = { x: v.x, y: v.y, z: v.z }, t0 = performance.now(); R.animating = true;
    const lz0 = Math.log(a.z), lz1 = Math.log(t.z);
    const step = now => {
      let p = U.clamp((now - t0) / ms, 0, 1); const e = p < .5 ? 2 * p * p : 1 - Math.pow(-2 * p + 2, 2) / 2;
      v.z = Math.exp(U.lerp(lz0, lz1, e)); v.x = U.lerp(a.x, t.x, e); v.y = U.lerp(a.y, t.y, e);
      R.req(); Bus.emit('view');
      if (p < 1) requestAnimationFrame(step); else R.animating = false;
    };
    requestAnimationFrame(step);
  },
  contentBounds() { const l = D.objs.filter(o => D.isVisible(o)); return l.length ? G.union(l) : null; },
  /* minimap */
  initMinimap() {
    const box = U.$('#minimap'); let drag = false;
    const go = e => {
      const r = R.mm.getBoundingClientRect(); const m = R.mmMap; if (!m) return;
      const wx = (e.clientX - r.left - m.ox) / m.s + m.x0, wy = (e.clientY - r.top - m.oy) / m.s + m.y0;
      D.view.x = wx - R.W / 2 / D.view.z; D.view.y = wy - R.H / 2 / D.view.z; R.req(); Bus.emit('view');
    };
    R.mm.addEventListener('pointerdown', e => { drag = true; R.mm.setPointerCapture(e.pointerId); go(e); });
    R.mm.addEventListener('pointermove', e => { if (drag) go(e); });
    R.mm.addEventListener('pointerup', () => drag = false);
    R.mm.width = 360; R.mm.height = 240;
  },
  drawMinimap() {
    const box = U.$('#minimap'); box.style.display = ST.v.minimap ? '' : 'none'; if (!ST.v.minimap) return;
    const c = R.mmx, W = R.mm.width, H = R.mm.height; c.setTransform(1, 0, 0, 1, 0, 0);
    c.fillStyle = U.isDark(D.bg) ? '#1b1f2a' : '#f7f8fa'; c.fillRect(0, 0, W, H);
    const vr = R.viewRect(); const cb = R.contentBounds();
    let x0 = vr.x, y0 = vr.y, x1 = vr.x + vr.w, y1 = vr.y + vr.h;
    if (cb) { x0 = Math.min(x0, cb.x); y0 = Math.min(y0, cb.y); x1 = Math.max(x1, cb.x + cb.w); y1 = Math.max(y1, cb.y + cb.h); }
    const pad = Math.max(x1 - x0, y1 - y0) * 0.04; x0 -= pad; y0 -= pad; x1 += pad; y1 += pad;
    const s = Math.min(W / (x1 - x0), H / (y1 - y0)); const ox = (W - (x1 - x0) * s) / 2, oy = (H - (y1 - y0) * s) / 2;
    R.mmMap = { s, x0, y0, ox: ox * (R.mm.clientWidth / W), oy: oy * (R.mm.clientHeight / H), cs: R.mm.clientWidth / W };
    R.mmMap.s = s * R.mmMap.cs; // map css px -> world
    c.setTransform(s, 0, 0, s, ox - x0 * s, oy - y0 * s);
    let budget = 6000;
    for (const o of R.visList) {
      const t = o.type;
      if (t === 'connector') { continue; }
      if (t === 'frame') { c.fillStyle = 'rgba(255,255,255,.9)'; c.fillRect(o.x, o.y, o.w, o.h); c.strokeStyle = 'rgba(0,0,0,.18)'; c.lineWidth = 1 / s; c.strokeRect(o.x, o.y, o.w, o.h); continue; }
      c.save(); if (o.rot) { c.translate(o.x + o.w / 2, o.y + o.h / 2); c.rotate(o.rot); c.translate(-o.w / 2, -o.h / 2); } else c.translate(o.x, o.y);
      if (t === 'stroke') {
        c.strokeStyle = o.color; c.globalAlpha = o.pen === 'highlighter' ? .4 : 1; c.lineWidth = Math.max(o.size, 1.2 / s); c.lineCap = 'round'; c.beginPath();
        const p = o.pts, sx = o.w / (o.bw || 1), sy = o.h / (o.bh || 1), st = Math.max(3, Math.ceil(p.length / 3 / 40)) * 3;
        for (let i = 0; i < p.length && budget > 0; i += st, budget--) { const X = p[i] * sx, Y = p[i + 1] * sy; i === 0 ? c.moveTo(X, Y) : c.lineTo(X, Y); }
        c.stroke();
      } else {
        c.fillStyle = o.color && t === 'sticky' ? o.color : (o.fill && o.fill !== 'none' ? o.fill : (t === 'image' || t === 'video' ? '#9aa3b2' : 'rgba(120,130,150,.55)'));
        if (t === 'text') c.fillStyle = o.color || '#333';
        if (t === 'text') c.globalAlpha = .55;
        c.fillRect(0, 0, o.w, o.h);
      }
      c.restore(); budget--;
    }
    c.setTransform(1, 0, 0, 1, 0, 0);
    c.strokeStyle = '#4f46e5'; c.fillStyle = 'rgba(79,70,229,.12)'; c.lineWidth = 2;
    const rx = ox + (vr.x - x0) * s, ry = oy + (vr.y - y0) * s, rw = vr.w * s, rh = vr.h * s;
    c.fillRect(rx, ry, rw, rh); c.strokeRect(rx, ry, rw, rh);
  }
};

/* ---------- custom scrollbars ---------- */
const SB = {
  init() {
    SB.h = U.$('#sb-h'); SB.v = U.$('#sb-v'); SB.th = SB.h.firstElementChild; SB.tv = SB.v.firstElementChild;
    const drag = (el, th, axis) => {
      let start = null;
      th.addEventListener('pointerdown', e => { th.setPointerCapture(e.pointerId); start = { p: axis === 'x' ? e.clientX : e.clientY, v: axis === 'x' ? D.view.x : D.view.y }; e.preventDefault(); });
      th.addEventListener('pointermove', e => {
        if (!start || !SB.m) return; const d = (axis === 'x' ? e.clientX : e.clientY) - start.p; const m = SB.m;
        if (axis === 'x') D.view.x = start.v + d / (el.clientWidth) * m.tw; else D.view.y = start.v + d / (el.clientHeight) * m.th;
        R.req(); Bus.emit('view');
      });
      th.addEventListener('pointerup', () => start = null);
      el.addEventListener('pointerdown', e => { if (e.target !== el) return; const r = th.getBoundingClientRect(); const dir = (axis === 'x' ? e.clientX > r.right : e.clientY > r.bottom) ? 1 : -1; if (axis === 'x') D.view.x += dir * R.W / D.view.z * .8; else D.view.y += dir * R.H / D.view.z * .8; R.req(); });
    };
    drag(SB.h, SB.th, 'x'); drag(SB.v, SB.tv, 'y');
  },
  update() {
    const on = ST.v.scrollbars; SB.h.style.display = SB.v.style.display = on ? '' : 'none'; if (!on) return;
    const vr = R.viewRect(); const cb = R.contentBounds() || { x: vr.x, y: vr.y, w: vr.w, h: vr.h };
    const mx = vr.w * .5, my = vr.h * .5;
    const x0 = Math.min(cb.x - mx, vr.x), x1 = Math.max(cb.x + cb.w + mx, vr.x + vr.w), y0 = Math.min(cb.y - my, vr.y), y1 = Math.max(cb.y + cb.h + my, vr.y + vr.h);
    const tw = x1 - x0, th = y1 - y0; SB.m = { tw, th };
    const lw = SB.h.clientWidth, lh = SB.v.clientHeight;
    SB.th.style.width = Math.max(30, vr.w / tw * lw) + 'px'; SB.th.style.left = ((vr.x - x0) / tw * lw) + 'px';
    SB.tv.style.height = Math.max(30, vr.h / th * lh) + 'px'; SB.tv.style.top = ((vr.y - y0) / th * lh) + 'px';
  }
};
