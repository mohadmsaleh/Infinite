'use strict';
/* ===== Ruler, laser pointer, comments, screen recorder ===== */

/* ---------- Ruler ---------- */
const Ruler = {
  on: false, x: 0, y: 0, len: 720, ang: 0, wid: 78, edge: 1, init0: false,
  toggle(v) {
    Ruler.on = v == null ? !Ruler.on : v;
    if (Ruler.on && !Ruler.init0) { const [cx, cy] = Act.center(); Ruler.x = cx; Ruler.y = cy; Ruler.len = Math.min(900, R.W / D.view.z * .6); Ruler.init0 = true; }
    Bus.emit('ruler'); R.reqOv();
  },
  geom() { const u = [Math.cos(Ruler.ang), Math.sin(Ruler.ang)], n = [-u[1], u[0]]; return { u, n }; },
  local(pt) { const { u, n } = Ruler.geom(); const dx = pt.x - Ruler.x, dy = pt.y - Ruler.y; return [dx * u[0] + dy * u[1], dx * n[0] + dy * n[1]]; },
  knobs() { const { u } = Ruler.geom(), z = D.view.z; return { rot: R.w2s(Ruler.x + u[0] * (Ruler.len / 2 + 28 / z), Ruler.y + u[1] * (Ruler.len / 2 + 28 / z)), len: R.w2s(Ruler.x - u[0] * (Ruler.len / 2 + 28 / z), Ruler.y - u[1] * (Ruler.len / 2 + 28 / z)) }; },
  down(pt, e) {
    const k = Ruler.knobs(); const r = pt.type === 'touch' ? 22 : 14;
    if (Math.hypot(pt.sx - k.rot[0], pt.sy - k.rot[1]) < r) { Tools.curTool = 'ruler'; Tools.st = { k: 'ruler', mode: 'rot' }; return true; }
    if (Math.hypot(pt.sx - k.len[0], pt.sy - k.len[1]) < r) { Tools.curTool = 'ruler'; Tools.st = { k: 'ruler', mode: 'len' }; return true; }
    const [lx, ly] = Ruler.local(pt), z = D.view.z; const half = Ruler.wid / 2;
    if (Math.abs(lx) <= Ruler.len / 2 && Math.abs(ly) <= half) {
      if (Tools.tool === 'pen' && ST.v.rulerSnap && (half - Math.abs(ly)) * z < 20) return false; // pen draws along the edge
      if (Tools.tool === 'pen' || Tools.tool === 'select' || Tools.tool === 'hand' || true) { Tools.curTool = 'ruler'; Tools.st = { k: 'ruler', mode: 'move', dx: pt.x - Ruler.x, dy: pt.y - Ruler.y }; return true; }
    }
    return false;
  },
  snapPoint(pt, keep, a) {
    const { u, n } = Ruler.geom(), z = D.view.z, half = Ruler.wid / 2; const [lx, ly] = Ruler.local(pt);
    if (!keep) { if (Math.abs(lx) > Ruler.len / 2 + 14 / z) return null; const dTop = Math.abs(ly + half), dBot = Math.abs(ly - half); const d = Math.min(dTop, dBot); if (d * z > 24) return null; Ruler.edge = dTop < dBot ? -1 : 1; }
    const l = U.clamp(lx, -Ruler.len / 2, Ruler.len / 2), e = Ruler.edge * half;
    return [Ruler.x + u[0] * l + n[0] * e, Ruler.y + u[1] * l + n[1] * e];
  },
  draw(ctx) {
    const z = D.view.z, c = R.w2s(Ruler.x, Ruler.y), len = Ruler.len * z, wid = Ruler.wid * z; ctx.save(); ctx.translate(c[0], c[1]); ctx.rotate(Ruler.ang);
    ctx.fillStyle = 'rgba(255,236,160,.82)'; ctx.strokeStyle = 'rgba(160,120,0,.8)'; ctx.lineWidth = 1.4; ctx.beginPath(); rr(ctx, -len / 2, -wid / 2, len, wid, 6); ctx.fill(); ctx.stroke();
    const u = ST.v.units, unit = Units.fromU(1, u) * z; ctx.strokeStyle = 'rgba(90,70,0,.85)'; ctx.fillStyle = 'rgba(70,55,0,.95)'; ctx.font = '600 10px ' + U.FONTS.sans; ctx.textAlign = 'center'; ctx.textBaseline = 'top';
    let step = u === 'px' ? 10 : u === 'mm' ? 1 : u === 'cm' ? .1 : 1 / 8, major = u === 'px' ? 100 : u === 'mm' ? 10 : u === 'cm' ? 1 : 1;
    while (step * unit < 4) { step *= 2; if (u === 'px' && step >= 100) break; } let lbl = major; while (lbl * unit < 34) lbl *= u === 'px' ? 2 : (u === 'mm' ? 2 : 2);
    const nmax = Math.floor(Ruler.len / Units.fromU(step, u) / 2) + 1; ctx.beginPath();
    for (let i = -nmax; i <= nmax; i++) { const v = i * step, x = v * unit; if (Math.abs(x) > len / 2 - 2) continue; const isMaj = Math.abs(v / major - Math.round(v / major)) < 1e-6, isHalf = Math.abs(v / (major / 2) - Math.round(v / (major / 2))) < 1e-6; const h = isMaj ? 16 : isHalf ? 11 : 7; ctx.moveTo(x, -wid / 2); ctx.lineTo(x, -wid / 2 + h); }
    ctx.stroke(); for (let i = 0; i <= nmax; i++) { const v = i * lbl, x = v * unit; if (x > len / 2 - 14) break; ctx.fillText(+v.toFixed(2) + '', x - len / 2 + len / 2 - 0 + 0 * 1 + 0, -wid / 2 + 19); }
    ctx.restore();
    const k = Ruler.knobs(); for (const [p, ic] of [[k.rot, 'rotate'], [k.len, 'expand']]) { ctx.fillStyle = '#fff'; ctx.strokeStyle = '#a07800'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(p[0], p[1], 10, 0, 7); ctx.fill(); ctx.stroke(); ctx.beginPath(); ctx.arc(p[0], p[1], 3.5, 0, 7); ctx.stroke(); }
    const deg = Math.round((U.deg(Ruler.ang) % 360 + 360) % 360); if (Tools.st && Tools.st.k === 'ruler' || deg) { label(ctx, k.rot[0], k.rot[1] - 24, (deg > 180 ? deg - 360 : deg) + '°  ·  ' + Units.fmt(Ruler.len)); }
  }
};
Tools.H.ruler = {
  move(pt) {
    const s = Tools.st; if (s.mode === 'move') { Ruler.x = pt.x - s.dx; Ruler.y = pt.y - s.dy; } else if (s.mode === 'rot') { let a = Math.atan2(pt.y - Ruler.y, pt.x - Ruler.x); if (!pt.alt) { const q = Math.round(a / U.rad(15)) * U.rad(15); if (Math.abs(a - q) < U.rad(2.5) || pt.shift) a = q; } Ruler.ang = a; Ruler.len = Math.max(120, Math.hypot(pt.x - Ruler.x, pt.y - Ruler.y) * 2 - 56 / D.view.z); }
    else { const [lx] = Ruler.local(pt); Ruler.len = Math.max(120, Math.abs(lx) * 2 - 56 / D.view.z); }
    R.reqOv();
  },
  up() { }
};

/* ---------- Laser pointer ---------- */
const Laser = {
  pts: [], active: false, pos: null, raf: 0, lastUp: 0, t0: 0,
  types: [['dot', 'Dot', 'laser'], ['trail', 'Fading trail', 'pen'], ['highlight', 'Highlight', 'highlighter'], ['spot', 'Spotlight', 'eye'], ['ripple', 'Ripple', 'pointer'], ['draw', 'Laser ink', 'brush']],
  p(pt) { let y = pt.sy; if (ST.v.laserOffset && pt.type !== 'mouse') y -= ST.v.laserOffsetY; return [pt.sx, y]; },
  down(pt) { Laser.active = true; Laser.t0 = performance.now(); Laser.move(pt); },
  move(pt) { const [x, y] = Laser.p(pt); Laser.pos = [x, y]; Laser.pts.push({ x, y, t: performance.now() }); if (Laser.pts.length > 600) Laser.pts.shift(); Laser.run(); },
  up() { Laser.active = false; Laser.lastUp = performance.now(); Laser.run(); },
  hoverPos(pt) { },
  run() { if (!Laser.raf) Laser.raf = requestAnimationFrame(Laser.tick); },
  tick() {
    Laser.raf = 0; const now = performance.now(), ty = ST.v.laserType, c = R.lctx, col = ST.v.laserColor, sz = ST.v.laserSize;
    c.setTransform(R.dpr, 0, 0, R.dpr, 0, 0); c.clearRect(0, 0, R.W, R.H);
    const life = ty === 'draw' ? 3200 : ty === 'trail' ? 900 : 400; Laser.pts = Laser.pts.filter(p => now - p.t < life);
    const fade = Laser.active ? 1 : U.clamp(1 - (now - Laser.lastUp) / 350, 0, 1); const pos = Laser.pos;
    const glow = (x, y, r, a) => { const g = c.createRadialGradient(x, y, 0, x, y, r * 2.6); g.addColorStop(0, U.alpha(col, a)); g.addColorStop(.35, U.alpha(col, a * .55)); g.addColorStop(1, U.alpha(col, 0)); c.fillStyle = g; c.beginPath(); c.arc(x, y, r * 2.6, 0, 7); c.fill(); c.fillStyle = U.alpha('#ffffff', a); c.beginPath(); c.arc(x, y, r * .45, 0, 7); c.fill(); };
    if (pos && fade > 0 || Laser.pts.length) {
      if (ty === 'trail' || ty === 'draw') {
        c.lineCap = 'round'; c.lineJoin = 'round';
        for (let i = 1; i < Laser.pts.length; i++) { const a = Laser.pts[i - 1], b = Laser.pts[i], age = (now - b.t) / life, al = Math.pow(1 - age, 1.4); c.strokeStyle = U.alpha(col, al); c.lineWidth = ty === 'draw' ? sz * .5 * (.5 + al * .5) : sz * (.25 + al * .75); c.beginPath(); c.moveTo(a.x, a.y); c.lineTo(b.x, b.y); c.stroke(); }
        if (pos && fade > 0 && ty === 'trail') glow(pos[0], pos[1], sz * .9, fade);
      } else if (pos && fade > 0) {
        if (ty === 'dot') glow(pos[0], pos[1], sz, fade);
        else if (ty === 'highlight') { c.fillStyle = U.alpha('#ffe100', .32 * fade); c.beginPath(); c.arc(pos[0], pos[1], sz * 3.2, 0, 7); c.fill(); c.strokeStyle = U.alpha('#ffb300', .6 * fade); c.lineWidth = 2; c.stroke(); }
        else if (ty === 'spot') { c.fillStyle = `rgba(0,0,0,${.6 * fade})`; c.beginPath(); c.rect(0, 0, R.W, R.H); c.arc(pos[0], pos[1], sz * 7, 0, 7); c.fill('evenodd'); c.strokeStyle = U.alpha('#fff', .5 * fade); c.lineWidth = 2; c.beginPath(); c.arc(pos[0], pos[1], sz * 7, 0, 7); c.stroke(); }
        else if (ty === 'ripple') { glow(pos[0], pos[1], sz * .7, fade); for (let k = 0; k < 3; k++) { const ph = ((now - Laser.t0) / 1000 + k / 3) % 1; c.strokeStyle = U.alpha(col, (1 - ph) * .7 * fade); c.lineWidth = 3; c.beginPath(); c.arc(pos[0], pos[1], sz * (1 + ph * 4.5), 0, 7); c.stroke(); } }
      }
    }
    if (Laser.active || Laser.pts.length || fade > 0 && (now - Laser.lastUp) < 360) Laser.run(); else c.clearRect(0, 0, R.W, R.H);
  }
};

/* ---------- Comments ---------- */
const Comments = {
  pos(c) { const [x, y] = Act.commentPos(c); return R.w2s(x, y); },
  pinAt(pt) { if (!ST.v.comments) return null; for (let i = D.comments.length - 1; i >= 0; i--) { const c = D.comments[i]; const s = Comments.pos(c); if (Math.hypot(pt.sx - s[0], pt.sy - (s[1] - 14)) < 16) return c; } return null; },
  draw(ctx) {
    if (!ST.v.comments || (window.Rec && Rec.on)) return;
    D.comments.forEach((c, i) => {
      const [x, y] = Comments.pos(c); const open = Comments.cur === c.id; ctx.save(); ctx.translate(x, y);
      ctx.fillStyle = c.res ? '#94a3b8' : '#f59e0b'; ctx.strokeStyle = '#fff'; ctx.lineWidth = 2.2; ctx.shadowColor = 'rgba(0,0,0,.28)'; ctx.shadowBlur = 6; ctx.beginPath(); ctx.moveTo(0, 0); ctx.arc(0, -16, 14, Math.PI * .72, Math.PI * .28, true); ctx.closePath(); ctx.fill(); ctx.stroke(); ctx.shadowColor = 'transparent';
      ctx.fillStyle = '#fff'; ctx.font = '700 12px ' + U.FONTS.sans; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(c.res ? '✓' : (c.msgs.length || '+'), 0, -16); ctx.restore();
    });
  },
  open(id) {
    const c = D.comments.find(x => x.id === id); if (!c) return; Comments.cur = id; UI.closeAll(); const s = Comments.pos(c); const r = R.ov.getBoundingClientRect();
    const box = U.el('div', { class: 'cthread' }); const list = U.el('div', { class: 'cmsgs' });
    const render = () => {
      list.innerHTML = ''; c.msgs.forEach(m => list.append(U.el('div', { class: 'cmsg' }, U.el('div', { class: 'cmh' }, U.el('b', null, m.a), U.el('span', null, U.fmtDate(m.t))), U.el('div', null, m.m))));
      if (!c.msgs.length) list.append(U.el('div', { class: 'cempty' }, 'No messages yet — write the first comment'));
      list.scrollTop = 1e6;
    };
    const inp = U.el('textarea', { class: 'inp', rows: 2, placeholder: 'Write a comment…  (Enter to send)' });
    const send = () => { const v = inp.value.trim(); if (!v) return; c.msgs.push({ a: ST.v.author, t: Date.now(), m: v }); inp.value = ''; D.commit('Comment', []); render(); R.reqOv(); Bus.emit('comments'); };
    inp.addEventListener('keydown', e => { e.stopPropagation(); if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } });
    box.append(U.el('div', { class: 'cth' }, U.el('b', null, 'Comment'), U.el('span', { class: 'sp' }), UI.ibtn(c.res ? 'unlock' : 'check', c.res ? 'Re-open' : 'Resolve', () => { c.res = !c.res; D.commit('Resolve comment', []); UI.closeAll(); R.reqOv(); Bus.emit('comments'); }), UI.ibtn('trash', 'Delete', async () => { D.comments = D.comments.filter(x => x !== c); D.commit('Delete comment', []); UI.closeAll(); R.reqOv(); Bus.emit('comments'); })), list, inp, UI.btn('Send', 'share', send, 'primary sm'));
    render();
    UI.pop({ x: r.left + s[0] + 18, y: r.top + s[1] - 30 }, box, { cls: 'pop-comment', side: 'bottom', onClose: () => { Comments.cur = null; if (!c.msgs.length) { D.comments = D.comments.filter(x => x !== c); D.commit('Delete comment', []); } R.reqOv(); } }); setTimeout(() => inp.focus(), 80); R.reqOv();
  },
  goto(id) { const c = D.comments.find(x => x.id === id); if (!c) return; const [x, y] = Act.commentPos(c); R.animate({ z: Math.max(D.view.z, .8), x: x - R.W / 2 / Math.max(D.view.z, .8), y: y - R.H / 2 / Math.max(D.view.z, .8) }); setTimeout(() => Comments.open(id), 380); }
};

/* ---------- Screen recorder ---------- */
const Rec = {
  on: false, paused: false, editing: false, mr: null, chunks: [], t0: 0, acc: 0, tick: 0,
  cfg: { src: 'view', frameId: null, area: null, res: 720, fps: 30, mic: true, laser: true, countdown: 3, showArea: true },
  load() { try { Object.assign(Rec.cfg, JSON.parse(localStorage.getItem('ib.rec') || '{}')); } catch (e) { } },
  save() { try { localStorage.setItem('ib.rec', JSON.stringify(Rec.cfg)); } catch (e) { } },
  ensureArea() { if (!Rec.cfg.area || Rec.cfg.area.x + Rec.cfg.area.w > R.W + 5 || Rec.cfg.area.y + Rec.cfg.area.h > R.H + 5) { const w = Math.min(R.W - 60, 900), h = Math.min(R.H - 60, w * 9 / 16); Rec.cfg.area = { x: (R.W - w) / 2, y: (R.H - h) / 2, w, h }; } },
  rect() { // output rect in screen px
    const c = Rec.cfg; if (c.src === 'area') { Rec.ensureArea(); return c.area; } if (c.src === 'frame') { const f = D.byId.get(c.frameId); if (f) { const a = R.w2s(f.x, f.y); return { x: a[0], y: a[1], w: f.w * D.view.z, h: f.h * D.view.z }; } } return { x: 0, y: 0, w: R.W, h: R.H };
  },
  drawArea(ctx) {
    const c = Rec.cfg; if (!(Rec.editing || Rec.on) || !c.showArea || c.src === 'view') { if (Rec.on) { ctx.strokeStyle = '#ef4444'; ctx.lineWidth = 4; ctx.strokeRect(2, 2, R.W - 4, R.H - 4); } return; }
    const r = Rec.rect(); ctx.save(); ctx.fillStyle = 'rgba(15,20,35,.38)'; ctx.beginPath(); ctx.rect(0, 0, R.W, R.H); ctx.rect(r.x, r.y, r.w, r.h); ctx.fill('evenodd');
    ctx.strokeStyle = Rec.on ? '#ef4444' : '#f43f5e'; ctx.lineWidth = 2.5; ctx.setLineDash(Rec.on ? [] : [8, 5]); ctx.strokeRect(r.x, r.y, r.w, r.h); ctx.setLineDash([]);
    if (c.src === 'area' && !Rec.on) for (const [hx, hy] of [[0, 0], [.5, 0], [1, 0], [1, .5], [1, 1], [.5, 1], [0, 1], [0, .5]]) { ctx.fillStyle = '#fff'; ctx.strokeStyle = '#f43f5e'; ctx.beginPath(); ctx.rect(r.x + r.w * hx - 6, r.y + r.h * hy - 6, 12, 12); ctx.fill(); ctx.stroke(); }
    label(ctx, r.x + r.w / 2, r.y - 16, `${Math.round(r.w)} × ${Math.round(r.h)}  ·  ${c.res}p  ·  ${c.fps} fps`); ctx.restore();
  },
  down(pt, e) {
    const c = Rec.cfg; if (!Rec.editing || c.src !== 'area' || Rec.on) return false; const r = Rec.rect(); const H = [[0, 0, 'nw'], [.5, 0, 'n'], [1, 0, 'ne'], [1, .5, 'e'], [1, 1, 'se'], [.5, 1, 's'], [0, 1, 'sw'], [0, .5, 'w']];
    let hit = null; for (const [hx, hy, id] of H) if (Math.hypot(pt.sx - (r.x + r.w * hx), pt.sy - (r.y + r.h * hy)) < 14) hit = { hx, hy, id };
    const inside = pt.sx > r.x && pt.sx < r.x + r.w && pt.sy > r.y && pt.sy < r.y + r.h; if (!hit && !inside) return false;
    Tools.curTool = 'recarea'; Tools.st = { k: 'rec', hit, r: Object.assign({}, r), x0: pt.sx, y0: pt.sy }; return true;
  },
  start() {
    UI.closeAll(); Rec.save(); Rec.editing = false; const go = async () => {
      const c = Rec.cfg; let mic = null;
      if (c.mic && navigator.mediaDevices) { try { mic = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } }); } catch (e) { UI.toast('Microphone unavailable — recording without sound', 3000); } }
      const rect = Rec.rect(); const dpr = R.dpr; let ow, oh; const asp = rect.w / rect.h;
      oh = c.res === 'native' ? Math.round(rect.h * dpr) : Math.min(+c.res, Math.round(rect.h * dpr)); ow = Math.round(oh * asp); ow -= ow % 2; oh -= oh % 2; ow = Math.max(ow, 64); oh = Math.max(oh, 64);
      const cv = document.createElement('canvas'); cv.width = ow; cv.height = oh; const ctx = cv.getContext('2d'); Rec.cv = cv; Rec.ctx = ctx;
      const stream = cv.captureStream(c.fps); if (mic) mic.getAudioTracks().forEach(t => stream.addTrack(t)); Rec.mic = mic;
      const mimes = ['video/webm;codecs=vp9,opus', 'video/webm;codecs=vp8,opus', 'video/webm', 'video/mp4']; const mime = mimes.find(m => window.MediaRecorder && MediaRecorder.isTypeSupported(m)); if (!mime) { UI.toast('Recording is not supported in this browser', 3500, 'err'); return; }
      Rec.mime = mime; Rec.chunks = []; const mr = Rec.mr = new MediaRecorder(stream, { mimeType: mime, videoBitsPerSecond: Math.round(oh * ow * c.fps * .12) });
      mr.ondataavailable = e => { if (e.data && e.data.size) Rec.chunks.push(e.data); }; mr.onstop = () => Rec.finish();
      if (c.countdown > 0) await Rec.countdown(c.countdown);
      Rec.on = true; Rec.paused = false; Rec.acc = 0; Rec.t0 = performance.now(); mr.start(1000); Rec.bar(true); Rec.loop(); R.req(); Bus.emit('rec');
    }; go();
  },
  countdown(n) { return new Promise(res => { const d = U.el('div', { class: 'countdown' }, n); document.body.append(d); let k = n; const iv = setInterval(() => { k--; if (k <= 0) { clearInterval(iv); d.remove(); res(); } else d.textContent = k; }, 1000); }); },
  loop() {
    if (!Rec.on) return; const c = Rec.cfg, ctx = Rec.ctx, cv = Rec.cv;
    if (!Rec.paused) {
      ctx.fillStyle = D.bg; ctx.fillRect(0, 0, cv.width, cv.height);
      if (c.src === 'frame' && D.byId.get(c.frameId)) { const f = D.byId.get(c.frameId), z = cv.width / f.w; const sv = { view: { x: f.x, y: f.y, z }, W: cv.width / z, H: cv.height / z, dpr: z / z, objs: R.visList, bg: D.bg, grid: null, exporting: true }; const sub = { view: { x: f.x, y: f.y, z: 1 }, W: f.w, H: f.h, dpr: z, objs: R.visList, bg: f.bg, grid: null, exporting: true }; ctx.save(); R.paint(ctx, { view: { x: f.x, y: f.y, z }, W: cv.width, H: cv.height, dpr: 1, objs: R.visList.filter(o => o.type !== 'frame' || o === f), bg: f.bg, grid: null, exporting: true }); ctx.restore(); }
      else { const r = Rec.rect(), d = R.dpr; const sx = r.x * d, sy = r.y * d, sw = r.w * d, sh = r.h * d; ctx.drawImage(R.cv, sx, sy, sw, sh, 0, 0, cv.width, cv.height); ctx.drawImage(R.ov, sx, sy, sw, sh, 0, 0, cv.width, cv.height); if (c.laser) ctx.drawImage(R.lcv, sx, sy, sw, sh, 0, 0, cv.width, cv.height); }
    }
    Rec.tick = requestAnimationFrame(Rec.loop);
  },
  bar(show) {
    if (!show) { if (Rec.barEl) Rec.barEl.remove(); Rec.barEl = null; clearInterval(Rec.timer); return; }
    const t = U.el('span', { class: 'rtime' }, '0:00'); const pb = U.el('button', { class: 'ibtn', title: 'Pause', html: U.icon('pause', 18), onclick: () => Rec.pause() });
    Rec.pb = pb; Rec.barEl = U.el('div', { class: 'recbar' }, U.el('span', { class: 'recdot' }), t, pb, U.el('button', { class: 'ibtn stop', title: 'Stop & save', html: U.icon('stop', 18), onclick: () => Rec.stop() }));
    document.body.append(Rec.barEl); Rec.timer = setInterval(() => { const e = Rec.acc + (Rec.paused ? 0 : performance.now() - Rec.t0); t.textContent = U.fmtTime(e / 1000); }, 250);
  },
  pause() { if (!Rec.mr) return; if (Rec.paused) { Rec.mr.resume(); Rec.paused = false; Rec.t0 = performance.now(); Rec.pb.innerHTML = U.icon('pause', 18); } else { Rec.mr.pause(); Rec.paused = true; Rec.acc += performance.now() - Rec.t0; Rec.pb.innerHTML = U.icon('play', 18); } Rec.barEl.classList.toggle('paused', Rec.paused); },
  stop() { if (!Rec.on || !Rec.mr) return; Rec.on = false; cancelAnimationFrame(Rec.tick); try { Rec.mr.stop(); } catch (e) { } if (Rec.mic) Rec.mic.getTracks().forEach(t => t.stop()); Rec.bar(false); R.req(); Bus.emit('rec'); },
  finish() {
    const blob = new Blob(Rec.chunks, { type: Rec.mime.split(';')[0] }); const url = URL.createObjectURL(blob); const ext = Rec.mime.includes('mp4') ? 'mp4' : 'webm'; const name = (D.name || 'board') + ' recording.' + ext;
    const v = U.el('video', { src: url, controls: true, style: 'width:100%;border-radius:10px;background:#000;max-height:46vh' });
    UI.modal({ title: 'Recording ready', width: 560, body: U.el('div', null, v, U.el('p', { class: 'mtext' }, `${U.fmtBytes(blob.size)} · ${ext.toUpperCase()}`)), buttons: [{ label: 'Discard', danger: true, fn: () => { URL.revokeObjectURL(url); } }, { label: 'Insert into board', fn: async () => { const id = await AS.add(blob, name); const [x, y] = Act.free(480, 270); const o = D.make('video', { asset: id, name, x, y }); Act.insert(o, 'Insert recording'); } }, { label: 'Save to device', primary: true, fn: () => { U.download(blob, name); return true; } }] });
  },
  panel(anchor) {
    Rec.load(); const c = Rec.cfg; const frames = D.frames(); const box = U.el('div', { class: 'recpanel' }); Rec.editing = true; R.reqOv();
    const upd = () => { Rec.save(); R.reqOv(); };
    box.append(U.el('h4', null, 'Record the canvas'),
      UI.field('Area', UI.seg([['view', 'Whole view'], ['area', 'Custom area'], ['frame', 'Frame']], c.src, v => { c.src = v; if (v === 'frame' && !c.frameId && frames[0]) c.frameId = frames[0].id; if (v === 'area') Rec.ensureArea(); frameSel.style.display = v === 'frame' ? '' : 'none'; upd(); })));
    const frameSel = UI.select(frames.length ? frames.map(f => [f.id, f.name]) : [['', 'No frames on board']], c.frameId || '', v => { c.frameId = v; upd(); }); frameSel.style.display = c.src === 'frame' ? '' : 'none'; box.append(frameSel);
    box.append(UI.field('Show recording area on canvas', UI.toggle('Show outline', c.showArea, v => { c.showArea = v; upd(); })),
      UI.field('Aspect ratio (custom area)', UI.seg([['free', 'Free'], ['169', '16:9'], ['43', '4:3'], ['11', '1:1'], ['916', '9:16']], 'free', v => { Rec.ensureArea(); c.src = 'area'; const a = c.area, r = { 169: 16 / 9, 43: 4 / 3, 11: 1, 916: 9 / 16 }[v]; if (r) { const cx = a.x + a.w / 2, cy = a.y + a.h / 2; let w = a.w, h = w / r; if (h > R.H - 20) { h = R.H - 20; w = h * r; } a.w = w; a.h = h; a.x = U.clamp(cx - w / 2, 0, R.W - w); a.y = U.clamp(cy - h / 2, 0, R.H - h); } upd(); })),
      UI.field('Resolution', UI.seg([[480, '480p'], [720, '720p'], [1080, '1080p'], ['native', 'Native']], c.res, v => { c.res = v; upd(); })),
      UI.field('Frame rate', UI.seg([[15, '15'], [30, '30'], [60, '60']], c.fps, v => { c.fps = v; upd(); })),
      UI.toggle('Record microphone', c.mic, v => { c.mic = v; upd(); }), UI.toggle('Include laser pointer', c.laser, v => { c.laser = v; upd(); }),
      UI.field('Countdown', UI.seg([[0, 'Off'], [3, '3 s'], [5, '5 s']], c.countdown, v => { c.countdown = v; upd(); })),
      U.el('div', { class: 'row gap', style: 'margin-top:10px' }, UI.btn('Start recording', 'record', () => Rec.start(), 'primary danger')));
    UI.pop(anchor, box, { cls: 'pop-rec', side: 'bottom', align: 'end', onClose: () => { Rec.editing = false; R.reqOv(); } });
  }
};
Rec.load();
Tools.H.recarea = {
  move(pt) {
    const s = Tools.st, a = Rec.cfg.area, dx = pt.sx - s.x0, dy = pt.sy - s.y0, o = s.r;
    if (!s.hit) { a.x = U.clamp(o.x + dx, 0, R.W - o.w); a.y = U.clamp(o.y + dy, 0, R.H - o.h); }
    else { let { x, y, w, h } = o; const { hx, hy } = s.hit; if (hx === 0) { x = o.x + dx; w = o.w - dx; } if (hx === 1) w = o.w + dx; if (hy === 0) { y = o.y + dy; h = o.h - dy; } if (hy === 1) h = o.h + dy; if (w < 120) { if (hx === 0) x -= 120 - w; w = 120; } if (h < 80) { if (hy === 0) y -= 80 - h; h = 80; } a.x = x; a.y = y; a.w = w; a.h = h; }
    R.reqOv();
  },
  up() { Rec.save(); }
};
