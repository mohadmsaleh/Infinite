'use strict';
/* ===== Dynamic connectors (flow links between objects) ===== */
const Conn = {
  SIDES: { t: [.5, 0, 0, -1], r: [1, .5, 1, 0], b: [.5, 1, 0, 1], l: [0, .5, -1, 0] },
  anchor(o, side) {
    const s = Conn.SIDES[side] || Conn.SIDES.r; const [wx, wy] = G.toWorld(o, s[0] * o.w, s[1] * o.h);
    let dx = s[2], dy = s[3]; if (o.rot) { const c = Math.cos(o.rot), sn = Math.sin(o.rot); [dx, dy] = [dx * c - dy * sn, dx * sn + dy * c]; dx = Math.round(dx * 1000) / 1000; dy = Math.round(dy * 1000) / 1000; if (Math.abs(dx) > Math.abs(dy)) { dx = Math.sign(dx); dy = 0; } else { dy = Math.sign(dy); dx = 0; } }
    return { x: wx, y: wy, dx, dy, side };
  },
  autoSide(o, pt) {
    const [lx, ly] = G.toLocal(o, pt[0], pt[1]); const ax = (lx - o.w / 2) / (o.w / 2 || 1), ay = (ly - o.h / 2) / (o.h / 2 || 1);
    return Math.abs(ax) > Math.abs(ay) ? (ax > 0 ? 'r' : 'l') : (ay > 0 ? 'b' : 't');
  },
  raw(e) { if (e.id) { const o = D.byId.get(e.id); if (o) return G.center(o); } return e.p || [0, 0]; },
  endPoint(c, k) {
    const e = c[k] || { p: [0, 0] };
    if (e.id) {
      const o = D.byId.get(e.id);
      if (o) {
        let side = e.side || 'auto';
        if (side === 'auto') { const other = c[k === 'from' ? 'to' : 'from']; side = Conn.autoSide(o, Conn.raw(other)); }
        const a = Conn.anchor(o, side); a.obj = o; return a;
      }
    }
    const p = e.p || [0, 0]; return { x: p[0], y: p[1], dx: 0, dy: 0, side: null };
  },
  route(c) {
    const s = Conn.endPoint(c, 'from'), e = Conn.endPoint(c, 'to');
    const key = [s.x, s.y, s.dx, s.dy, e.x, e.y, e.dx, e.dy, c.style].join(',');
    if (c._rk === key && c._rt) return c._rt;
    let rt;
    if (c.style === 'straight') rt = { type: 'poly', pts: [[s.x, s.y], [e.x, e.y]] };
    else if (c.style === 'curve') {
      const d = Math.hypot(e.x - s.x, e.y - s.y), k = Math.max(30, d * .4);
      const sd = (s.dx || s.dy) ? [s.dx, s.dy] : Conn.guess(s, e), ed = (e.dx || e.dy) ? [e.dx, e.dy] : Conn.guess(e, s);
      const p = [[s.x, s.y], [s.x + sd[0] * k, s.y + sd[1] * k], [e.x + ed[0] * k, e.y + ed[1] * k], [e.x, e.y]];
      const pts = []; for (let i = 0; i <= 28; i++) { const t = i / 28, u = 1 - t; pts.push([u * u * u * p[0][0] + 3 * u * u * t * p[1][0] + 3 * u * t * t * p[2][0] + t * t * t * p[3][0], u * u * u * p[0][1] + 3 * u * u * t * p[1][1] + 3 * u * t * t * p[2][1] + t * t * t * p[3][1]]); }
      rt = { type: 'bez', p, pts };
    } else rt = { type: 'poly', pts: Conn.elbow(s, e) };
    c._rk = key; c._rt = rt;
    let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9; rt.pts.forEach(p => { x0 = Math.min(x0, p[0]); y0 = Math.min(y0, p[1]); x1 = Math.max(x1, p[0]); y1 = Math.max(y1, p[1]); });
    c.x = x0; c.y = y0; c.w = x1 - x0; c.h = y1 - y0; c.rot = 0;
    return rt;
  },
  guess(a, b) { const dx = b.x - a.x, dy = b.y - a.y; return Math.abs(dx) > Math.abs(dy) ? [Math.sign(dx) || 1, 0] : [0, Math.sign(dy) || 1]; },
  elbow(s, e) {
    const g = 22; let sd = (s.dx || s.dy) ? [s.dx, s.dy] : Conn.guess(s, e), ed = (e.dx || e.dy) ? [e.dx, e.dy] : Conn.guess(e, s);
    if (!(e.dx || e.dy)) ed = [-sd[0] * (Math.abs(sd[0])), -sd[1] * Math.abs(sd[1])], ed = (Math.abs(e.x - s.x) > Math.abs(e.y - s.y)) ? [Math.sign(s.x - e.x) || 1, 0] : [0, Math.sign(s.y - e.y) || 1];
    const p1 = [s.x + sd[0] * g, s.y + sd[1] * g], p3 = [e.x + ed[0] * g, e.y + ed[1] * g];
    const pts = [[s.x, s.y], p1];
    const sH = sd[0] !== 0, eH = ed[0] !== 0;
    if (sH && eH) {
      let mx; if (sd[0] * (p3[0] - p1[0]) > 0 && ed[0] * (p1[0] - p3[0]) > 0) mx = (p1[0] + p3[0]) / 2; else mx = sd[0] > 0 ? Math.max(p1[0], p3[0]) : Math.min(p1[0], p3[0]);
      pts.push([mx, p1[1]], [mx, p3[1]]);
    } else if (!sH && !eH) {
      let my; if (sd[1] * (p3[1] - p1[1]) > 0 && ed[1] * (p1[1] - p3[1]) > 0) my = (p1[1] + p3[1]) / 2; else my = sd[1] > 0 ? Math.max(p1[1], p3[1]) : Math.min(p1[1], p3[1]);
      pts.push([p1[0], my], [p3[0], my]);
    } else if (sH && !eH) {
      if (sd[0] * (p3[0] - p1[0]) > 0 && ed[1] * (p1[1] - p3[1]) > 0) pts.push([p3[0], p1[1]]); else pts.push([p1[0], (p1[1] + p3[1]) / 2], [p3[0], (p1[1] + p3[1]) / 2]);
    } else {
      if (sd[1] * (p3[1] - p1[1]) > 0 && ed[0] * (p1[0] - p3[0]) > 0) pts.push([p1[0], p3[1]]); else pts.push([(p1[0] + p3[0]) / 2, p1[1]], [(p1[0] + p3[0]) / 2, p3[1]]);
    }
    pts.push(p3, [e.x, e.y]);
    // clean duplicates and collinear points
    const out = [pts[0]]; for (let i = 1; i < pts.length; i++) { const p = pts[i], q = out[out.length - 1]; if (Math.hypot(p[0] - q[0], p[1] - q[1]) > .5) out.push(p); }
    for (let i = out.length - 2; i > 0; i--) { const a = out[i - 1], b = out[i], c = out[i + 1]; if ((Math.abs(a[0] - b[0]) < .5 && Math.abs(b[0] - c[0]) < .5) || (Math.abs(a[1] - b[1]) < .5 && Math.abs(b[1] - c[1]) < .5)) out.splice(i, 1); }
    return out;
  },
  tangent(rt, atEnd) {
    const p = rt.pts; const n = p.length; if (n < 2) return 0;
    let a, b; if (atEnd) { b = p[n - 1]; a = p[n - 2]; let k = n - 2; while (k > 0 && Math.hypot(b[0] - a[0], b[1] - a[1]) < .5) a = p[--k]; return Math.atan2(b[1] - a[1], b[0] - a[0]); }
    a = p[0]; b = p[1]; let k = 1; while (k < n - 1 && Math.hypot(b[0] - a[0], b[1] - a[1]) < .5) b = p[++k]; return Math.atan2(a[1] - b[1], a[0] - b[0]);
  },
  mid(rt) {
    const p = rt.pts; let L = 0; const ls = []; for (let i = 1; i < p.length; i++) { const d = Math.hypot(p[i][0] - p[i - 1][0], p[i][1] - p[i - 1][1]); ls.push(d); L += d; }
    let t = L / 2; for (let i = 0; i < ls.length; i++) { if (t <= ls[i] || i === ls.length - 1) { const f = ls[i] ? t / ls[i] : 0; return [U.lerp(p[i][0], p[i + 1][0], f), U.lerp(p[i][1], p[i + 1][1], f)]; } t -= ls[i]; }
    return p[0];
  },
  /* find best anchor near a world point; returns {id, side} or null */
  snapTarget(wx, wy, exclude, z) {
    const R_ = 22 / z; let best = null, bd = R_;
    for (const o of R.visList) {
      if (o.type === 'connector' || o.type === 'stroke' || o.type === 'frame' && false || exclude === o.id) continue;
      if (T.get(o.type).noConn) continue;
      const b = G.aabb(o); if (wx < b.x - R_ || wx > b.x + b.w + R_ || wy < b.y - R_ || wy > b.y + b.h + R_) continue;
      for (const side of ['t', 'r', 'b', 'l']) { const a = Conn.anchor(o, side); const d = Math.hypot(a.x - wx, a.y - wy); if (d < bd) { bd = d; best = { id: o.id, side }; } }
    }
    if (best) return best;
    // inside an object -> auto
    for (let i = R.visList.length - 1; i >= 0; i--) { const o = R.visList[i]; if (o.type === 'connector' || o.type === 'stroke' || T.get(o.type).noConn || exclude === o.id) continue; if (o.type === 'frame') continue; if (G.hit(o, wx, wy, 0)) return { id: o.id, side: 'auto' }; }
    return null;
  },
  make(from, to, props) {
    return D.make('connector', Object.assign({ from, to }, props || {}));
  }
};

T.def('connector', {
  def: () => ({ from: { p: [0, 0] }, to: { p: [100, 0] }, style: 'elbow', color: '#1f2430', sw: 2.5, dash: 'solid', hs: 'none', he: 'arrow', lbl: '', w: 1, h: 1 }),
  world: true, noConn: true, noRot: true,
  bounds(o) { Conn.route(o); const p = 8 + o.sw; return { x: o.x - p, y: o.y - p, w: o.w + 2 * p, h: o.h + 2 * p }; },
  draw(ctx, o, env) {
    const rt = Conn.route(o), pts = rt.pts;
    const sTan = Conn.tangent(rt, false), eTan = Conn.tangent(rt, true);
    const bs = Heads.back(o.hs, o.sw), be = Heads.back(o.he, o.sw);
    ctx.strokeStyle = o.color; ctx.lineWidth = o.sw; ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.setLineDash(DASH[o.dash](o.sw));
    ctx.beginPath();
    if (rt.type === 'bez') {
      const p = rt.p.map(q => q.slice()); p[0][0] += Math.cos(sTan + Math.PI) * bs; p[0][1] += Math.sin(sTan + Math.PI) * bs; p[3][0] -= Math.cos(eTan) * be; p[3][1] -= Math.sin(eTan) * be;
      ctx.moveTo(p[0][0], p[0][1]); ctx.bezierCurveTo(p[1][0], p[1][1], p[2][0], p[2][1], p[3][0], p[3][1]);
    } else {
      const q = pts.map(p => p.slice()); const n = q.length;
      if (n >= 2) { q[0][0] += Math.cos(sTan + Math.PI) * bs; q[0][1] += Math.sin(sTan + Math.PI) * bs; q[n - 1][0] -= Math.cos(eTan) * be; q[n - 1][1] -= Math.sin(eTan) * be; }
      ctx.moveTo(q[0][0], q[0][1]);
      if (o.style === 'elbow' && n > 2) { for (let i = 1; i < n - 1; i++) ctx.arcTo(q[i][0], q[i][1], q[i + 1][0], q[i + 1][1], Math.min(12, Math.hypot(q[i][0] - q[i - 1][0], q[i][1] - q[i - 1][1]) / 2, Math.hypot(q[i + 1][0] - q[i][0], q[i + 1][1] - q[i][1]) / 2)); ctx.lineTo(q[n - 1][0], q[n - 1][1]); }
      else for (let i = 1; i < n; i++) ctx.lineTo(q[i][0], q[i][1]);
    }
    ctx.stroke(); ctx.setLineDash([]);
    Heads.draw(ctx, o.hs, pts[0][0], pts[0][1], sTan, o.sw, o.color); Heads.draw(ctx, o.he, pts[pts.length - 1][0], pts[pts.length - 1][1], eTan, o.sw, o.color);
    if (o.lbl && !Ed.editing(o)) {
      const [mx, my] = Conn.mid(rt); ctx.font = '14px ' + U.FONTS.sans; const tw = ctx.measureText(o.lbl).width + 14;
      ctx.fillStyle = D.bg; ctx.beginPath(); rr(ctx, mx - tw / 2, my - 12, tw, 24, 8); ctx.fill(); ctx.fillStyle = o.color; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(o.lbl, mx, my + 1);
    }
  },
  hitWorld(o, wx, wy, tol) {
    const rt = Conn.route(o), p = rt.pts, r = o.sw / 2 + 6 + tol;
    for (let i = 0; i < p.length - 1; i++) if (U.distSeg(wx, wy, p[i][0], p[i][1], p[i + 1][0], p[i + 1][1]) <= r) return true;
    return false;
  },
  edit(o) { const [mx, my] = Conn.mid(Conn.route(o)); Ed.text(o, { x: mx - o.x - 70, y: my - o.y - 14, w: 140, h: 28, key: 'lbl', fs: 14, al: 'center', va: 'middle', color: o.color, single: true }); },
  text: o => [o.lbl],
  ins: o => [
    { sec: 'Connector' },
    { k: 'style', t: 'seg', l: 'Routing', opts: [['elbow', 'Elbow'], ['straight', 'Straight'], ['curve', 'Curved']] },
    { k: 'color', t: 'color', l: 'Colour' },
    { k: 'sw', t: 'range', l: 'Width', min: 1, max: 20, step: .5 },
    { k: 'dash', t: 'seg', l: 'Line style', opts: [['solid', 'Solid'], ['dashed', 'Dashed'], ['dotted', 'Dotted']] },
    { k: 'hs', t: 'select', l: 'Start cap', opts: Heads.kinds }, { k: 'he', t: 'select', l: 'End cap', opts: Heads.kinds },
    { k: 'lbl', t: 'text', l: 'Label' },
    { t: 'btns', items: [{ l: 'Reverse', ic: 'swap', fn: o => { [o.from, o.to] = [o.to, o.from]; [o.hs, o.he] = [o.he, o.hs]; delete o._rk; } }, { l: 'Detach ends', ic: 'unlock', fn: o => { for (const k of ['from', 'to']) { const p = Conn.endPoint(o, k); o[k] = { p: [p.x, p.y] }; } delete o._rk; } }] }
  ]
});
