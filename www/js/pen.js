'use strict';
/* ===== Ink: pen types, stroke object, smart shape recognition, erasers ===== */
const PENS = {
  pen: { n: 'Pen', ic: 'pen', m: 1, press: true, alpha: 1 },
  marker: { n: 'Marker', ic: 'marker', m: 1.9, press: false, alpha: 1 },
  highlighter: { n: 'Highlighter', ic: 'highlighter', m: 4, press: false, alpha: .36, cap: 'butt' },
  pencil: { n: 'Pencil', ic: 'pencil', m: .9, press: true, alpha: .82 },
  brush: { n: 'Brush', ic: 'brush', m: 2.1, press: true, alpha: 1, strong: true },
  callig: { n: 'Calligraphy', ic: 'callig', m: 2.4, nib: true, alpha: 1 }
};

const Ink = {
  live: null,
  pf(pen, p) { return PENS[pen].strong ? U.lerp(.25, 1.7, p) : U.lerp(.5, 1.45, p); },
  /* render a flat [x,y,p,...] stroke in current ctx coords */
  render(ctx, pts, st, env) {
    const def = PENS[st.pen] || PENS.pen, n = pts.length / 3; if (!n) return;
    const base = st.size * def.m; ctx.save();
    ctx.lineJoin = 'round'; ctx.lineCap = def.cap || 'round';
    ctx.globalAlpha *= def.alpha; ctx.strokeStyle = st.color; ctx.fillStyle = st.color;
    if (def.blend) ctx.globalCompositeOperation = 'multiply';
    const X = i => pts[i * 3], Y = i => pts[i * 3 + 1], Pp = i => pts[i * 3 + 2];
    if (n === 1) { ctx.beginPath(); ctx.arc(X(0), Y(0), Math.max(.5, base * (def.press ? Ink.pf(st.pen, Pp(0)) : 1) / 2), 0, 7); ctx.fill(); ctx.restore(); return; }
    // closed fill
    if (st.fill && st.fill !== 'none') { ctx.save(); ctx.globalAlpha = 1; ctx.fillStyle = st.fill; ctx.beginPath(); ctx.moveTo(X(0), Y(0)); for (let i = 1; i < n; i++) ctx.lineTo(X(i), Y(i)); ctx.closePath(); ctx.fill(); ctx.restore(); }
    if (def.nib) { // flat nib calligraphy
      const a = -Math.PI / 4, nx = Math.cos(a) * base / 2, ny = Math.sin(a) * base / 2;
      ctx.beginPath();
      for (let i = 0; i < n - 1; i++) { const x1 = X(i), y1 = Y(i), x2 = X(i + 1), y2 = Y(i + 1); ctx.moveTo(x1 + nx, y1 + ny); ctx.lineTo(x2 + nx, y2 + ny); ctx.lineTo(x2 - nx, y2 - ny); ctx.lineTo(x1 - nx, y1 - ny); ctx.closePath(); }
      ctx.fill(); ctx.restore(); return;
    }
    if (!def.press) { // constant width – one path
      ctx.lineWidth = base; ctx.beginPath(); ctx.moveTo(X(0), Y(0));
      for (let i = 1; i < n - 1; i++) ctx.quadraticCurveTo(X(i), Y(i), (X(i) + X(i + 1)) / 2, (Y(i) + Y(i + 1)) / 2);
      ctx.lineTo(X(n - 1), Y(n - 1)); ctx.stroke(); ctx.restore(); return;
    }
    // variable width pieces
    for (let i = 0; i < n; i++) {
      const ax = i ? (X(i - 1) + X(i)) / 2 : X(i), ay = i ? (Y(i - 1) + Y(i)) / 2 : Y(i);
      const bx = i < n - 1 ? (X(i) + X(i + 1)) / 2 : X(i), by = i < n - 1 ? (Y(i) + Y(i + 1)) / 2 : Y(i);
      ctx.lineWidth = Math.max(.4, base * Ink.pf(st.pen, Pp(i)));
      ctx.beginPath(); ctx.moveTo(ax, ay); ctx.quadraticCurveTo(X(i), Y(i), bx, by); ctx.stroke();
    }
    if (st.pen === 'pencil') { // graphite grain
      ctx.globalAlpha *= .6; ctx.lineWidth = base * .5; ctx.setLineDash([base * .5, base * 1.4]); ctx.beginPath(); ctx.moveTo(X(0) + .4, Y(0) + .4);
      for (let i = 1; i < n; i++) ctx.lineTo(X(i) - .3, Y(i) + .5); ctx.stroke();
    }
    ctx.restore();
  },
  /* create stroke object from world points [[x,y,p]] */
  fromWorld(wp, st) {
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    for (const p of wp) { x0 = Math.min(x0, p[0]); y0 = Math.min(y0, p[1]); x1 = Math.max(x1, p[0]); y1 = Math.max(y1, p[1]); }
    const bw = Math.max(1, x1 - x0), bh = Math.max(1, y1 - y0), pts = [];
    for (const p of wp) pts.push(+(p[0] - x0).toFixed(1), +(p[1] - y0).toFixed(1), +(p[2] == null ? .5 : p[2]).toFixed(2));
    return D.make('stroke', { x: x0, y: y0, w: bw, h: bh, bw, bh, pts, pen: st.pen, color: st.color, size: st.size, fill: st.fill || null });
  },
  worldPts(o) {
    const sx = o.w / (o.bw || 1), sy = o.h / (o.bh || 1), out = [];
    for (let i = 0; i < o.pts.length; i += 3) {
      let lx = o.pts[i] * sx, ly = o.pts[i + 1] * sy; if (o.fx) lx = o.w - lx; if (o.fy) ly = o.h - ly;
      const [wx, wy] = G.toWorld(o, lx, ly); out.push([wx, wy, o.pts[i + 2]]);
    }
    return out;
  },
  widthOf(o) { return o.size * (PENS[o.pen] || PENS.pen).m; },
  /* ---- live stroke ---- */
  begin(x, y, p, st) { Ink.live = { pts: [[x, y, p]], st: Object.assign({}, st), t: performance.now(), shape: null, lastMove: performance.now() }; },
  add(x, y, p) {
    const L = Ink.live; if (!L) return false; const last = L.pts[L.pts.length - 1];
    const min = 0.9 / D.view.z; if (Math.hypot(x - last[0], y - last[1]) < min) return false;
    // light smoothing
    const a = 1 - ST.v.ptrSmooth * .45; const nx = last[0] + (x - last[0]) * a, ny = last[1] + (y - last[1]) * a;
    L.pts.push([nx, ny, p]); L.lastMove = performance.now(); L.shape = null; return true;
  },
  drawLive(ctx) {
    const L = Ink.live; if (!L) return; const v = D.view; ctx.save(); ctx.translate(-v.x * v.z, -v.y * v.z); ctx.scale(v.z, v.z);
    if (L.shape) { const o = L.shape; ctx.globalAlpha = .9; R.drawObj(ctx, o, { z: v.z, dpr: R.dpr, k: v.z * R.dpr }); }
    else { const flat = []; for (const p of L.pts) flat.push(p[0], p[1], p[2]); Ink.render(ctx, flat, L.st); }
    ctx.restore();
  },
  finish(smartNow) {
    const L = Ink.live; Ink.live = null; if (!L) return null;
    if (L.shape) return L.shape;
    if (smartNow && L.st.smart && L.pts.length > 5) { const s = Ink.recognizeObj(L.pts, L.st); if (s) return s; }
    const o = Ink.fromWorld(L.pts, L.st);
    // close detection for fill
    return o;
  },
  /* ---- shape recognition ---- */
  resample(P, n) {
    const L = [0]; for (let i = 1; i < P.length; i++) L.push(L[i - 1] + Math.hypot(P[i][0] - P[i - 1][0], P[i][1] - P[i - 1][1]));
    const tot = L[L.length - 1]; if (!tot) return P.slice(); const out = []; let j = 1;
    for (let k = 0; k < n; k++) { const d = tot * k / (n - 1); while (j < L.length - 1 && L[j] < d) j++; const t = (d - L[j - 1]) / ((L[j] - L[j - 1]) || 1); out.push([U.lerp(P[j - 1][0], P[j][0], t), U.lerp(P[j - 1][1], P[j][1], t)]); }
    return out;
  },
  dp(P, eps) {
    if (P.length < 3) return P.slice();
    let md = 0, mi = 0; const a = P[0], b = P[P.length - 1];
    for (let i = 1; i < P.length - 1; i++) { const d = U.distSeg(P[i][0], P[i][1], a[0], a[1], b[0], b[1]); if (d > md) { md = d; mi = i; } }
    if (md > eps) { const l = Ink.dp(P.slice(0, mi + 1), eps), r = Ink.dp(P.slice(mi), eps); return l.slice(0, -1).concat(r); }
    return [a, b];
  },
  recognize(pts) {
    if (pts.length < 6) return null;
    const P = Ink.resample(pts, 72); let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
    P.forEach(p => { x0 = Math.min(x0, p[0]); y0 = Math.min(y0, p[1]); x1 = Math.max(x1, p[0]); y1 = Math.max(y1, p[1]); });
    const bw = x1 - x0, bh = y1 - y0, diag = Math.hypot(bw, bh); if (diag < 24) return null;
    let len = 0; for (let i = 1; i < P.length; i++) len += Math.hypot(P[i][0] - P[i - 1][0], P[i][1] - P[i - 1][1]);
    const a = P[0], b = P[P.length - 1], chord = Math.hypot(b[0] - a[0], b[1] - a[1]);
    // straight line
    if (chord > .82 * len || chord > 0.9 * diag && len < 1.12 * chord) {
      let md = 0; for (const p of P) md = Math.max(md, U.distSeg(p[0], p[1], a[0], a[1], b[0], b[1]));
      if (md < Math.max(5, chord * .07)) {
        let [ax, ay, bx, by] = [a[0], a[1], b[0], b[1]]; const ang = Math.atan2(by - ay, bx - ax), snap = U.rad(6);
        for (const t of [0, Math.PI / 2, Math.PI, -Math.PI / 2, -Math.PI, Math.PI / 4, -Math.PI / 4, 3 * Math.PI / 4, -3 * Math.PI / 4]) if (Math.abs(ang - t) < snap) { const l = chord; bx = ax + Math.cos(t) * l; by = ay + Math.sin(t) * l; break; }
        return { kind: 'line', a: [ax, ay], b: [bx, by] };
      }
      return null;
    }
    if (chord > .2 * len) return null; // open arcs are not shapes
    const V = Ink.dp(P.concat([P[0]]), .05 * diag); const verts = V.slice(0, -1); const nv = verts.length;
    const cx = (x0 + x1) / 2, cy = (y0 + y1) / 2, ra = bw / 2, rb = bh / 2;
    let err = 0; P.forEach(p => { err += Math.abs(Math.hypot((p[0] - cx) / ra, (p[1] - cy) / rb) - 1); }); err /= P.length;
    if (err < .12 && nv >= 5) { let w = bw, h = bh; if (Math.abs(w - h) / Math.max(w, h) < .14) { w = h = (w + h) / 2; } return { kind: 'ellipse', x: cx - w / 2, y: cy - h / 2, w, h }; }
    if (nv === 3) {
      return { kind: 'triangle', x: x0, y: y0, w: bw, h: bh, fy: verts.filter(p => p[1] < cy).length !== 1 };
    }
    if (nv === 4 || nv === 5 && Math.hypot(verts[0][0] - verts[4][0], verts[0][1] - verts[4][1]) < .1 * diag) {
      const q = verts.slice(0, 4); const mids = [[cx, y0], [x1, cy], [cx, y1], [x0, cy]];
      const dm = q.every(p => mids.some(m => Math.hypot(p[0] - m[0], p[1] - m[1]) < .22 * diag));
      if (dm) return { kind: 'diamond', x: x0, y: y0, w: bw, h: bh };
      // right angles?
      let ok = true; for (let i = 0; i < 4; i++) { const p0 = q[(i + 3) % 4], p1 = q[i], p2 = q[(i + 1) % 4]; const v1 = [p0[0] - p1[0], p0[1] - p1[1]], v2 = [p2[0] - p1[0], p2[1] - p1[1]]; const c = (v1[0] * v2[0] + v1[1] * v2[1]) / (Math.hypot(...v1) * Math.hypot(...v2) || 1); if (Math.abs(c) > .42) ok = false; }
      if (ok) {
        const e = Math.atan2(q[1][1] - q[0][1], q[1][0] - q[0][0]); let rot = e; while (rot > Math.PI / 4) rot -= Math.PI / 2; while (rot < -Math.PI / 4) rot += Math.PI / 2;
        if (Math.abs(rot) < U.rad(9)) return { kind: 'rect', x: x0, y: y0, w: bw, h: bh };
        const w = Math.hypot(q[1][0] - q[0][0], q[1][1] - q[0][1]), h = Math.hypot(q[2][0] - q[1][0], q[2][1] - q[1][1]); const mx = q.reduce((s, p) => s + p[0], 0) / 4, my = q.reduce((s, p) => s + p[1], 0) / 4;
        return { kind: 'rect', x: mx - w / 2, y: my - h / 2, w, h, rot: Math.abs(rot) > Math.PI / 4 - .01 ? rot : rot };
      }
      return { kind: 'parallelogram', x: x0, y: y0, w: bw, h: bh };
    }
    if (nv === 5 || nv === 6) {
      const ed = []; for (let i = 0; i < nv; i++) { const p = verts[i], q = verts[(i + 1) % nv]; ed.push(Math.hypot(p[0] - q[0], p[1] - q[1])); }
      const m = ed.reduce((s, v) => s + v, 0) / nv, sd = Math.sqrt(ed.reduce((s, v) => s + (v - m) ** 2, 0) / nv);
      if (sd / m < .3) return { kind: nv === 5 ? 'pentagon' : 'hexagon', x: x0, y: y0, w: bw, h: bh };
    }
    if (err < .2 && nv >= 6) return { kind: 'ellipse', x: x0, y: y0, w: bw, h: bh };
    return null;
  },
  recognizeObj(pts, st) {
    const r = Ink.recognize(pts); if (!r) return null; return Ink.shapeObj(r, st);
  },
  shapeObj(r, st) {
    const sw = Math.max(2, Math.round(st.size * (st.pen === 'highlighter' ? 1.5 : 1)));
    if (r.kind === 'line') { const o = D.make('line', { color: st.color, sw, he: 'none', hs: 'none' }); Lines.setEnds(o, r.a, r.b); return o; }
    const o = D.make('shape', { kind: r.kind, x: r.x, y: r.y, w: Math.max(r.w, 6), h: Math.max(r.h, 6), rot: r.rot || 0, fy: !!r.fy, fill: 'none', stroke: st.color, sw, fs: 16, r: 0 });
    return o;
  }
};

/* ---- stroke object type ---- */
T.def('stroke', {
  def: () => ({ pen: 'pen', color: '#1f2430', size: 4, pts: [], bw: 1, bh: 1, w: 1, h: 1, fill: null }),
  flip: true, resize: 'free', noConn: true,
  pad: o => Ink.widthOf(o) * .8 + 1,
  draw(ctx, o, env) {
    const sx = o.w / (o.bw || 1), sy = o.h / (o.bh || 1);
    if (o.fx) { ctx.translate(o.w, 0); ctx.scale(-1, 1); } if (o.fy) { ctx.translate(0, o.h); ctx.scale(1, -1); }
    if (sx !== 1 || sy !== 1) ctx.scale(sx, sy);
    Ink.render(ctx, o.pts, o, env);
  },
  hit(o, lx, ly, tol) {
    const sx = o.w / (o.bw || 1), sy = o.h / (o.bh || 1); [lx, ly] = G.unflip(o, lx, ly); lx /= sx; ly /= sy;
    const r = Ink.widthOf(o) / 2 + 3 + tol / Math.min(sx, sy || 1), p = o.pts, n = p.length / 3;
    if (lx < -r || ly < -r || lx > o.bw + r || ly > o.bh + r) return false;
    if (n === 1) return Math.hypot(lx - p[0], ly - p[1]) <= r;
    if (o.fill && o.fill !== 'none' && Ink.closed(o)) { const poly = []; for (let i = 0; i < n; i += Math.max(1, n >> 6)) poly.push([p[i * 3], p[i * 3 + 1]]); if (G.pointInPoly(lx, ly, poly)) return true; }
    for (let i = 0; i < n - 1; i++) if (U.distSeg(lx, ly, p[i * 3], p[i * 3 + 1], p[i * 3 + 3], p[i * 3 + 4]) <= r) return true;
    return false;
  },
  ins: o => [
    { sec: 'Ink' },
    { k: 'pen', t: 'select', l: 'Pen type', opts: Object.entries(PENS).map(([k, v]) => [k, v.n]) },
    { k: 'color', t: 'color', l: 'Colour' },
    { k: 'size', t: 'range', l: 'Size', min: 1, max: 40, step: .5 },
    { k: 'fill', t: 'color', l: 'Fill (closed shapes)', none: true },
    { t: 'btns', items: [{ l: 'Recognise shape', ic: 'straighten', fn: o => Act.straighten([o]) }] }
  ]
});
Ink.closed = o => { const p = o.pts, n = p.length / 3; if (n < 4) return false; const d = Math.hypot(p[0] - p[(n - 1) * 3], p[1] - p[(n - 1) * 3 + 1]); return d < Math.max(o.bw, o.bh) * .25 + 6; };

/* ---- erasers ---- */
const Erase = {
  changed: false,
  /* split stroke by predicate (point inside erase region). returns pieces or null if untouched */
  split(o, inside, maxSeg) {
    const W = Ink.worldPts(o); const dense = [];
    for (let i = 0; i < W.length; i++) {
      dense.push(W[i]);
      if (i < W.length - 1) { const a = W[i], b = W[i + 1], d = Math.hypot(b[0] - a[0], b[1] - a[1]), k = Math.min(60, Math.floor(d / maxSeg)); for (let j = 1; j <= k; j++) { const t = j / (k + 1); dense.push([U.lerp(a[0], b[0], t), U.lerp(a[1], b[1], t), U.lerp(a[2], b[2], t)]); } }
    }
    const pieces = []; let cur = [], cut = false;
    for (const p of dense) { if (inside(p[0], p[1])) { cut = true; if (cur.length) { pieces.push(cur); cur = []; } } else cur.push(p); }
    if (cur.length) pieces.push(cur);
    return cut ? pieces : null;
  },
  at(wx, wy, r, type, all) {
    const rect = { x: wx - r - 40, y: wy - r - 40, w: 2 * r + 80, h: 2 * r + 80 }; let any = false;
    for (const o of D.objs.slice()) {
      if (!D.isVisible(o) || D.isLocked(o)) continue;
      if (o.type === 'stroke') {
        if (!G.rectsHit(G.aabb(o), rect)) continue;
        if (type === 'stroke') { if (Erase.touchesStroke(o, wx, wy, r)) { D.remove([o]); any = true; } }
        else { const pcs = Erase.split(o, (x, y) => Math.hypot(x - wx, y - wy) <= r, Math.max(1.2, r * .3)); if (pcs) { Erase.replace(o, pcs); any = true; } }
      } else if (all && o.type !== 'frame') {
        if (G.rectsHit(G.aabb(o), rect) && G.hit(o, wx, wy, r * .6)) { D.remove([o]); any = true; }
      }
    }
    if (any) { Erase.changed = true; Sel.ids = Sel.ids.filter(i => D.byId.has(i)); R.req(); }
  },
  touchesStroke(o, wx, wy, r) {
    const [lx0, ly0] = G.toLocal(o, wx, wy); const sx = o.w / (o.bw || 1), sy = o.h / (o.bh || 1);
    const [ux, uy] = G.unflip(o, lx0, ly0); const lx = ux / sx, ly = uy / sy, rr_ = r / Math.min(sx, sy) + Ink.widthOf(o) / 2, p = o.pts, n = p.length / 3;
    if (n === 1) return Math.hypot(lx - p[0], ly - p[1]) <= rr_;
    for (let i = 0; i < n - 1; i++) if (U.distSeg(lx, ly, p[i * 3], p[i * 3 + 1], p[i * 3 + 3], p[i * 3 + 4]) <= rr_) return true;
    return false;
  },
  replace(o, pieces) {
    const idx = D.objs.indexOf(o); D.remove([o]);
    const made = []; for (const pc of pieces) { if (pc.length < 2) continue; const n = Ink.fromWorld(pc, o); n.layer = o.layer; n.op = o.op; n.gid = o.gid; made.push(n); }
    made.forEach((n, i) => { D.objs.splice(Math.min(D.objs.length, idx + i), 0, n); D.byId.set(n.id, n); }); D._ord = null;
  },
  lasso(poly, all) {
    let any = false;
    for (const o of D.objs.slice()) {
      if (!D.isVisible(o) || D.isLocked(o)) continue;
      if (o.type === 'stroke') { const pcs = Erase.split(o, (x, y) => G.pointInPoly(x, y, poly), 2.5); if (pcs) { Erase.replace(o, pcs); any = true; } }
      else if (all && o.type !== 'frame') { const c = G.center(o); if (G.pointInPoly(c[0], c[1], poly)) { D.remove([o]); any = true; } }
    }
    if (any) { Erase.changed = true; R.req(); }
    return any;
  }
};
