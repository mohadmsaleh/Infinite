'use strict';
/* ===== PDF & Notes — pro layer: pen presets, text-selection menu, audio recording, page management, library covers ===== */
Object.assign(U.IC, {
  textsel: '<path d="M4 5h9M4 10h6M4 15h9"/><path d="M15 9l5 5-2.2.5 1.5 3-1.6.8-1.5-3-1.7 1.6z"/>',
  up: '<path d="M6 14l6-6 6 6"/>', down: '<path d="M6 10l6 6 6-6"/>'
});
const SP = {
  PRE0: [{ pen: 'pen', color: '#1f2430', size: 3 }, { pen: 'pen', color: '#2563eb', size: 3 }, { pen: 'brush', color: '#dc2626', size: 5 }, { pen: 'highlighter', color: '#ffe14d', size: 16 }],
  slots: null, cur: 0, btns: [],
  load() { try { SP.slots = JSON.parse(localStorage.getItem('ib.slots') || 'null'); } catch (e) { } if (!Array.isArray(SP.slots) || SP.slots.length !== 4) SP.slots = JSON.parse(JSON.stringify(SP.PRE0)); },
  save() { localStorage.setItem('ib.slots', JSON.stringify(SP.slots)); },
  use(i) { const s = SP.slots[i]; Object.assign(Tools.opts.pen, { pen: s.pen, color: s.color, size: s.size }); Tools.saveOpts && Tools.saveOpts(); SP.cur = i; Tools.set('pen'); SP.sync(); },
  icon(i) { const s = SP.slots[i]; return U.icon(PENS[s.pen].ic, 22) + '<i class="pdot"></i>'; },
  sync() {
    SP.btns.forEach((b, i) => { b.classList.toggle('on', Tools.tool === 'pen' && SP.cur === i); b.style.setProperty('--c', SP.slots[i].color); });
    ['lasso', 'tsel', 'mic'].forEach(k => { const b = SP.extra && SP.extra[k]; if (b) b.classList.toggle('on', k === 'mic' ? !!ARec.on : Tools.tool === k); });
  },
  pop(i, anchor) {
    const s = SP.slots[i], box = U.el('div', { class: 'fly ppop' }), prev = U.el('canvas', { width: 220, height: 54, class: 'penprev' });
    const draw = () => { const c = prev.getContext('2d'); c.clearRect(0, 0, 220, 54); const pts = []; for (let k = 0; k <= 40; k++) { const t = k / 40; pts.push(10 + t * 200, 27 + Math.sin(t * Math.PI * 2) * 12, .3 + .6 * Math.sin(t * Math.PI)); } try { Ink.render(c, pts, { pen: s.pen, color: s.color, size: s.size }, {}); } catch (e) { } };
    const apply = () => { Object.assign(Tools.opts.pen, { pen: s.pen, color: s.color, size: s.size }); Tools.saveOpts && Tools.saveOpts(); SP.save(); anchor.innerHTML = SP.icon(i); SP.sync(); draw(); };
    const types = U.el('div', { class: 'ptypes' }); Object.entries(PENS).forEach(([k, p]) => types.append(U.el('button', { class: 'ptype' + (s.pen === k ? ' on' : ''), title: p.n, html: U.icon(p.ic, 22) + `<small>${p.n}</small>`, onclick: e => { s.pen = k; U.$$('.ptype', types).forEach(x => x.classList.remove('on')); e.currentTarget.classList.add('on'); apply(); } })));
    box.append(types, prev, UI.field('Thickness', UI.range(1, 60, 1, s.size, v => { s.size = v; apply(); }, { fmt: v => v + ' px' })), UI.colorBox(s.color, c => { s.color = c; apply(); }), UI.field('Smart shapes', UI.seg([['hold', 'Hold'], ['always', 'Always'], ['off', 'Off']], ST.v.smart, v => ST.set('smart', v))));
    draw(); UI.pop(anchor, box, { key: 'fly', side: 'bottom', cls: 'pop-fly' });
  }
};
SP.load();

/* ---------- dock ---------- */
const SPro = {
  enter() {
    const bar = U.$('#toolbar'); if (!bar || bar.querySelector('.pslot')) return; SP.btns = []; SP.extra = {};
    const mk = (title, html, fn, cls = '') => { const b = U.el('button', { class: 'tbtn study-only ' + cls, title, html }); b.addEventListener('click', fn); return b; };
    const ref = TB.btns.eraser || TB.btns.pen;
    for (let i = 0; i < 4; i++) { const b = mk(['Pen 1', 'Pen 2', 'Brush', 'Highlighter pen'][i] + ' — tap again to edit', SP.icon(i), () => { if (Tools.tool === 'pen' && SP.cur === i) SP.pop(i, b); else SP.use(i); }, 'pslot'); SP.btns.push(b); bar.insertBefore(b, ref); }
    const hide = TB.btns.pen; if (hide) hide.classList.add('study-hide');
    SP.extra.lasso = mk('Lasso — select, move & resize handwriting', U.icon('lasso', 22), () => { Tools.set('lasso'); SP.sync(); }); bar.insertBefore(SP.extra.lasso, TB.btns.select ? TB.btns.select.nextSibling : bar.firstChild);
    SP.extra.tsel = mk('Select text (T) — then highlight, underline, copy', U.icon('textsel', 22), () => { Tools.set('tsel'); SP.sync(); }); bar.insertBefore(SP.extra.tsel, TB.btns.hilite || ref);
    SP.extra.mic = mk('Record audio with your notes', U.icon('mic', 22) + '<i class="rdot"></i>', e => ARec.click(e.currentTarget)); const und = TB.btns.undo; bar.insertBefore(SP.extra.mic, und ? und : null);
    Bus.on('tool', SP.sync); SP.sync(); ARec.restore();
  },
  leave() { ARec.stop(true); ARec.closeBar(); SP.btns = []; SP.extra = {}; Study.ts = null; SPro.hidePop(); },
  hidePop() { const e = document.getElementById('stpop'); e && e.remove(); }
};

/* ---------- select-text tool + floating menu ---------- */
Tools.H.tsel = {
  down(pt) { Study.ts = null; SPro.hidePop(); Tools.H.hilite.down(pt); if (Tools.st) Tools.st.sel = true; },
  move(pt) { Tools.H.hilite.move(pt); },
  up() {
    const s = Tools.st; if (!s || !s.o || !s.rects || !s.rects.length || !Tools.moved) return; const f = s.f, o = s.o;
    const W = s.rects.map(r => ({ x: o.x + r.x * f, y: o.y + r.y * f, w: r.w * f, h: r.h * f })); Study.ts = { doc: o.doc, pg: o.pg, W, text: s.text || '', area: !!s.area }; SPro.showPop(); R.reqOv();
  }
};
SPro.showPop = () => {
  SPro.hidePop(); const ts = Study.ts; if (!ts) return; const u = G.union(ts.W.map(r => ({ x: r.x, y: r.y, w: r.w, h: r.h, rot: 0, type: 'shape' })));
  const a = R.w2s(u.x + u.w / 2, u.y), b = R.w2s(u.x + u.w / 2, u.y + u.h), rc = R.ov.getBoundingClientRect(); const box = U.el('div', { id: 'stpop', class: 'stpop' });
  const make = (kind, color) => { const hl = D.make('hl', { kind, color, x: u.x, y: u.y, w: u.w, h: u.h, rects: ts.W.map(r => ({ x: r.x - u.x, y: r.y - u.y, w: r.w, h: r.h })), text: ts.text, doc: ts.doc, pg: ts.pg, layer: Study.annLayer() }); D.add(hl); D.commit('Highlight', hl); Bus.emit('struct'); Study.ts = null; SPro.hidePop(); R.reqOv(); return hl; };
  (Study.HL_COLORS || ['#ffe14d', '#a7f3d0', '#fbcfe8', '#bae6fd', '#fed7aa']).slice(0, 5).forEach(c => box.append(U.el('button', { class: 'sdot', style: 'background:' + c, title: 'Highlight', onclick: () => { Study.o.color = c; Study.o.kind = 'hl'; Study.save && Study.save(); make('hl', c); } })));
  const cur = Study.o.color || '#ffe14d';
  box.append(U.el('i', { class: 'vsep' }), U.el('button', { class: 'sbtn', title: 'Underline', html: U.icon('underline', 18), onclick: () => make('ul', cur) }), U.el('button', { class: 'sbtn', title: 'Strikethrough', html: '<b style="text-decoration:line-through;font-size:16px">S</b>', onclick: () => make('st', cur) }),
    U.el('i', { class: 'vsep' }), U.el('button', { class: 'sbtn', title: 'Copy text', html: U.icon('copy', 18), onclick: async () => { try { await navigator.clipboard.writeText(ts.text); UI.toast('Copied'); } catch (e) { UI.toast('Copy not allowed here', 2000, 'err'); } SPro.hidePop(); } }),
    U.el('button', { class: 'sbtn', title: 'Highlight & quote into a note', html: U.icon('quote', 18), onclick: () => { const hl = make('hl', cur); Study.quote(hl); } }));
  document.body.append(box); const w = box.offsetWidth, h = box.offsetHeight; let x = rc.left + a[0] - w / 2, y = rc.top + a[1] - h - 10; if (y < 56) y = rc.top + b[1] + 10; box.style.left = U.clamp(x, 6, innerWidth - w - 6) + 'px'; box.style.top = U.clamp(y, 6, innerHeight - h - 6) + 'px';
};
R.overlays.push(ctx => {
  if (!Study.on || !Study.ts) return; ctx.save(); ctx.fillStyle = 'rgba(59,130,246,.32)'; Study.ts.W.forEach(r => { const p = R.w2s(r.x, r.y), q = R.w2s(r.x + r.w, r.y + r.h); ctx.fillRect(p[0], p[1], q[0] - p[0], q[1] - p[1]); }); ctx.restore();
});
Bus.on('tool', () => { if (Tools.tool !== 'tsel' && Study.ts) { Study.ts = null; SPro.hidePop(); } });
document.addEventListener('pointerdown', e => { if (Study.ts && !e.target.closest('#stpop') && !(e.target.closest && e.target.closest('#ov'))) { Study.ts = null; SPro.hidePop(); R.reqOv && R.reqOv(); } }, true);

/* ---------- audio recording synced with writing (Notability style) ---------- */
const ARec = {
  on: false, mr: null, chunks: [], t0: 0, id: null, timer: null, pb: null, bar: null,
  recs() { return D.extra.recs || (D.extra.recs = []); },
  fmt(t) { t = Math.max(0, Math.floor(t)); return Math.floor(t / 60) + ':' + String(t % 60).padStart(2, '0'); },
  async click(b) {
    if (ARec.on) { ARec.stop(); return; }
    const items = [{ label: 'Start recording', icon: 'record', fn: () => ARec.start() }];
    const rs = ARec.recs(); if (rs.length) { items.push({ sep: true }, { header: 'Recordings' }); rs.forEach(r => items.push({ label: `${r.name} · ${ARec.fmt(r.dur)}`, icon: 'play', fn: () => ARec.play(r.id, 0), sub: undefined }, { label: '   Delete “' + r.name + '”', icon: 'trash', danger: true, fn: () => ARec.del(r.id) })); }
    UI.menu(b, items, { side: 'bottom' });
  },
  async start() {
    if (!navigator.mediaDevices || !window.MediaRecorder) { UI.toast('Recording is not supported in this browser', 3000, 'err'); return; }
    let stream; try { stream = await navigator.mediaDevices.getUserMedia({ audio: true }); } catch (e) { UI.toast('Microphone permission was denied', 3000, 'err'); return; }
    ARec.closeBar(); ARec.chunks = []; ARec.id = U.uid('rc'); const mr = new MediaRecorder(stream); ARec.mr = mr; ARec.t0 = Date.now(); ARec.on = true;
    mr.ondataavailable = e => e.data && e.data.size && ARec.chunks.push(e.data);
    mr.onstop = async () => { stream.getTracks().forEach(t => t.stop()); const dur = (Date.now() - ARec.t0) / 1000, blob = new Blob(ARec.chunks, { type: mr.mimeType || 'audio/webm' }); if (ARec.discard) { ARec.discard = false; return; } const aid = await AS.add(blob, 'recording.webm'); ARec.recs().push({ id: ARec.id, asset: aid, dur, t: ARec.t0, name: 'Recording ' + (ARec.recs().length + 1) }); D.dirty = true; D.queueSave(); UI.toast('Recording saved — tap any writing made during it to replay'); };
    mr.start(1000); ARec.tick(); SP.sync(); document.getElementById('app').classList.add('arec');
  },
  tick() { const b = SP.extra && SP.extra.mic; if (!b) return; clearInterval(ARec.timer); const upd = () => { b.dataset.t = ARec.on ? ARec.fmt((Date.now() - ARec.t0) / 1000) : ''; }; upd(); ARec.timer = setInterval(() => { if (!ARec.on) { clearInterval(ARec.timer); upd(); return; } upd(); }, 500); },
  stop(discard) { if (!ARec.on) return; ARec.on = false; ARec.discard = !!discard; try { ARec.mr.stop(); } catch (e) { } clearInterval(ARec.timer); const b = SP.extra && SP.extra.mic; if (b) b.dataset.t = ''; document.getElementById('app').classList.remove('arec'); SP.sync(); },
  async del(id) { if (!await UI.confirm('Delete this recording? Writing made during it stays.', 'Delete', true)) return; D.extra.recs = ARec.recs().filter(r => r.id !== id); D.objs.forEach(o => { if (o.rid === id) { delete o.rid; delete o.rt; delete o._j; } }); if (ARec.pb && ARec.pb.rec.id === id) ARec.closeBar(); D.dirty = true; D.queueSave(); },
  restore() { },
  play(id, from) {
    const r = ARec.recs().find(x => x.id === id); if (!r) return; ARec.closeBar(); const au = new Audio(AS.url(r.asset)); const pb = ARec.pb = { rec: r, au, t: from || 0, hide: false, last: -1 }; au.currentTime = from || 0; au.play().catch(() => { }); ARec.mkBar(); ARec.loop();
  },
  loop() { const pb = ARec.pb; if (!pb) return; pb.t = pb.au.currentTime; if (pb.hide && Math.abs(pb.t - pb.last) > .12) { pb.last = pb.t; R.req(); } ARec.syncBar(); if (!pb.au.ended) requestAnimationFrame(ARec.loop); else { pb.t = Infinity; R.req(); ARec.syncBar(); } },
  mkBar() {
    const pb = ARec.pb, bar = ARec.bar = U.el('div', { id: 'abar', class: 'abar' });
    const playB = UI.ibtn('play', 'Play / pause', () => { pb.au.paused ? (pb.au.ended && (pb.au.currentTime = 0), pb.au.play(), ARec.loop()) : pb.au.pause(); ARec.syncBar(); });
    const rng = U.el('input', { type: 'range', min: 0, max: 1000, value: 0, oninput: e => { pb.au.currentTime = pb.rec.dur * e.target.value / 1000; pb.t = pb.au.currentTime; if (pb.hide) R.req(); } });
    const tm = U.el('span', { class: 'abtime' }, '0:00'); const spd = U.el('button', { class: 'abspd', onclick: () => { const v = { 1: 1.5, 1.5: 2, 2: 1 }[pb.au.playbackRate] || 1; pb.au.playbackRate = v; spd.textContent = v + '×'; } }, '1×');
    const rep = U.el('label', { class: 'abrep', title: 'Writing appears as it was written' }, U.el('input', { type: 'checkbox', onchange: e => { pb.hide = e.target.checked; D.byId && R.req(); } }), 'Replay writing');
    bar.append(playB, rng, tm, spd, rep, UI.ibtn('close', 'Close', () => ARec.closeBar())); bar._p = playB; bar._r = rng; bar._t = tm; document.getElementById('app').append(bar);
  },
  syncBar() { const b = ARec.bar, pb = ARec.pb; if (!b || !pb) return; const t = Math.min(pb.au.currentTime, pb.rec.dur); b._t.textContent = ARec.fmt(t) + ' / ' + ARec.fmt(pb.rec.dur); if (document.activeElement !== b._r) b._r.value = Math.round(t / Math.max(.1, pb.rec.dur) * 1000); b._p.innerHTML = U.icon(pb.au.paused ? 'play' : 'pause', 20); },
  closeBar() { if (ARec.pb) { try { ARec.pb.au.pause(); } catch (e) { } ARec.pb = null; R.req && R.req(); } if (ARec.bar) { ARec.bar.remove(); ARec.bar = null; } }
};
{ const v0 = D.isVisible.bind(D); D.isVisible = o => v0(o) && !(ARec.pb && ARec.pb.hide && o.rid === ARec.pb.rec.id && o.rt > ARec.pb.t); }
{ const a0 = D.add.bind(D); D.add = function (o, at) { if (ARec.on && Study.on && o && o.rt === undefined && o.type !== 'pdfpage' && o.type !== 'frame') { o.rt = (Date.now() - ARec.t0) / 1000; o.rid = ARec.id; } return a0(o, at); }; }
{ const c0 = Menus.context.bind(Menus); Menus.context = function (x, y, o, pt) { const items = c0(x, y, o, pt) || []; const s = Sel.objs().find(q => q.rt !== undefined && q.rid && ARec.recs().some(r => r.id === q.rid)); if (s && Study.on) items.unshift({ label: 'Play recording from here', icon: 'play', fn: () => ARec.play(s.rid, Math.max(0, s.rt - 1)) }, { sep: true }); return items; }; }

/* ---------- notebook pages: correct insert / duplicate / delete / move ---------- */
const NP = {
  content(f) { return D.objs.filter(o => o !== f && o.type !== 'frame' && o.type !== 'pdfpage' && (() => { const c = G.center(o); return c[0] >= f.x && c[0] <= f.x + f.w && c[1] >= f.y && c[1] <= f.y + f.h; })()); },
  shift(pages, dy) { pages.forEach(p => { NP.content(p).forEach(o => Act.translate(o, 0, dy)); Act.translate(p, 0, dy); }); },
  insert(docId, n = 1, after, dup) {
    const d = Study.doc(docId); if (!d) return []; const ps = Study.pagesOf(d), base = after || ps[ps.length - 1]; if (!base) return [];
    const idx = ps.indexOf(base), step = base.h + 70, out = []; NP.shift(ps.slice(idx + 1).reverse(), step * n);
    for (let i = 0; i < n; i++) {
      const f = D.make('frame', Object.assign({}, JSON.parse(JSON.stringify(base)), { id: U.uid(), x: base.x, y: base.y + step * (i + 1), name: '' })); delete f._j; out.push(f); D.add(f);
      if (dup) NP.content(base).forEach(o => { if (o.rt !== undefined) return; const c = JSON.parse(JSON.stringify(o)); c.id = U.uid(); delete c._j; const k = D.make(o.type, c); k.x = o.x; k.y = o.y + step * (i + 1); D.add(k); out.push(k); });
    }
    Study.renumber(d); D.commit(dup ? 'Duplicate page' : 'Add page', out); Bus.emit('struct'); return out;
  },
  remove(docId, f) {
    const d = Study.doc(docId); if (!d) return; const ps = Study.pagesOf(d); if (ps.length < 2) { UI.toast('A notebook needs at least one page'); return; }
    const idx = ps.indexOf(f), step = f.h + 70, gone = [f, ...NP.content(f)]; D.remove(gone); NP.shift(ps.slice(idx + 1), -step); Study.renumber(d); Sel.ids = []; D.commit('Delete page', []); Bus.emit('struct');
  },
  move(docId, f, dir) {
    const d = Study.doc(docId); const ps = Study.pagesOf(d), i = ps.indexOf(f), j = i + dir; if (j < 0 || j >= ps.length) return; const g = ps[j], dy = g.y - f.y;
    const a = [f, ...NP.content(f)], b = [g, ...NP.content(g)]; a.forEach(o => Act.translate(o, 0, dy)); b.forEach(o => Act.translate(o, 0, -dy)); Study.renumber(d); D.commit('Move page', []); Bus.emit('struct');
  }
};
Study.addNotePage = (docId, n = 1, after) => NP.insert(docId, n, after, false);
Study.NP = NP;
{
  const th0 = Study.thumbs;
  Study.thumbs = function (box, d) {
    th0.call(Study, box, d); const ths = box.querySelectorAll('.th'), ps = Study.pagesOf(d);
    ths.forEach((t, i) => {
      const o = ps[i]; t.oncontextmenu = e => { e.preventDefault(); e.stopPropagation(); UI.menu({ x: e.clientX, y: e.clientY }, Study.pageMenu(d, o, i), { side: 'bottom' }); };
      const mb = U.el('button', { class: 'thm', title: 'Page options', html: U.icon('more', 14), onclick: e => { e.stopPropagation(); UI.menu(e.currentTarget, Study.pageMenu(d, o, i), { side: 'bottom', align: 'end' }); } }); t.append(mb);
    });
  };
  Study.pageMenu = (d, o, i) => {
    const items = [{ label: 'Go to page ' + (i + 1), icon: 'pointer', fn: () => Study.goto(o) }, { label: 'Bookmark this page', icon: 'bookmark', fn: () => { Study.goto(o); Study.toggleBm && Study.toggleBm(); } }];
    if (d.kind === 'note') items.push({ sep: true }, { label: 'Insert page after', icon: 'plus', fn: () => { const n = NP.insert(d.id, 1, o); n[0] && Study.goto(n[0]); } }, { label: 'Duplicate page', icon: 'duplicate', fn: () => { const n = NP.insert(d.id, 1, o, true); n[0] && Study.goto(n[0]); } }, { label: 'Move up', icon: 'up', disabled: i === 0, fn: () => NP.move(d.id, o, -1) }, { label: 'Move down', icon: 'down', disabled: i === Study.pagesOf(d).length - 1, fn: () => NP.move(d.id, o, 1) }, { label: 'Delete page', icon: 'trash', danger: true, fn: async () => { if (await UI.confirm('Delete this page and everything on it?', 'Delete', true)) NP.remove(d.id, o); } });
    return items;
  };
}

/* ---------- library: first-page covers ---------- */
{
  const t0 = IO.thumb.bind(IO);
  IO.thumb = async function () {
    if (D.kind !== 'study') return t0();
    let r = null; const docs = Study.docs(); const first = docs[0];
    if (first) { const p = Study.pagesOf(first)[0]; if (p) r = { x: p.x, y: p.y, w: p.w, h: p.h }; }
    if (!r) return '';
    try { await Study.warm([r], 1); const cv = IO.renderCanvas({ area: r, all: true, scale: 360 / r.w, bg: '#ffffff', clip: true }); Study.unpin(); return cv.toDataURL('image/jpeg', .8); } catch (e) { Study.unpin && Study.unpin(); return ''; }
  };
}

/* ---------- hook into enter / leave ---------- */
{
  const e0 = Study.enter, l0 = Study.leave;
  Study.enter = function () { const was = Study.on; e0.call(Study); if (!was) SPro.enter(); };
  Study.leave = function () { const was = Study.on; if (was) SPro.leave(); l0.call(Study); };
  const k0 = Study.key; Study.key = function (K, e) { if (Study.on && e && !e.ctrlKey && !e.metaKey && !e.altKey && e.key && e.key.toLowerCase() === 't') { Tools.set('tsel'); SP.sync(); return true; } return k0 ? k0.call(Study, K, e) : false; };
}
