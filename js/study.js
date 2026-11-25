'use strict';
/* ===== PDF & Notes ("Study") — PDF engine, page objects, highlights, clips, notebooks ===== */
Object.assign(U.IC, {
  pdf: '<path d="M6 3h8l5 5v13H6z"/><path d="M14 3v5h5"/><path d="M8.5 16h1.8a1.3 1.3 0 000-2.6H8.5V18M13 13.4V18h1.2a2.3 2.3 0 000-4.6z" stroke-width="1.4"/>',
  notebook: '<rect x="5" y="3" width="14" height="18" rx="2"/><path d="M9 3v18M12 8h4M12 12h4"/>',
  clip: '<path d="M7 3v14a1 1 0 001 1h14"/><path d="M3 7h14a1 1 0 011 1v14"/>',
  bookmark: '<path d="M6 3h12v18l-6-4.5L6 21z"/>',
  book: '<path d="M4 5a2 2 0 012-2h13v16H6a2 2 0 00-2 2z"/><path d="M4 19V5M9 7h6"/>',
  quote: '<path d="M5 17c0-4 1-7 4-9M13 17c0-4 1-7 4-9"/><circle cx="6" cy="17" r="1.5"/><circle cx="14" cy="17" r="1.5"/>',
  sources: '<path d="M4 6h10M4 12h16M4 18h12"/><circle cx="19" cy="6" r="1.6"/><circle cx="19" cy="18" r="1.6"/>',
  hl: '<path d="M9 15l7-9 3 3-8 8H7z"/><path d="M4 20h16" stroke-width="3" opacity=".45"/>',
  study: '<path d="M3 9l9-5 9 5-9 5z"/><path d="M7 11.5V16c2.5 2 7.5 2 10 0v-4.5M21 9v6"/>'
});

/* ---------------- PDF engine ---------------- */
const PDFS = {
  docs: new Map(), cache: new Map(), px: 0, wants: new Map(), busy: false, txt: new Map(), txtP: new Map(), loadP: null, tiers: [.35, .6, 1, 1.5, 2.2, 3, 4],
  lib() {
    if (window.pdfjsLib) return Promise.resolve(window.pdfjsLib);
    if (!PDFS.loadP) PDFS.loadP = new Promise((res, rej) => {
      const inl = document.getElementById('pdfjs-lib'), s = document.createElement('script');
      s.src = inl ? URL.createObjectURL(new Blob([inl.textContent.replace(/<\\\/script/g, '</script')], { type: 'text/javascript' })) : 'js/vendor/pdf.min.js';
      s.onload = () => { const w = document.getElementById('pdfjs-worker'); pdfjsLib.GlobalWorkerOptions.workerSrc = w ? URL.createObjectURL(new Blob([w.textContent], { type: 'text/javascript' })) : 'js/vendor/pdf.worker.min.js'; res(pdfjsLib); };
      s.onerror = () => { PDFS.loadP = null; rej(new Error('Could not load the PDF engine')); };
      document.head.append(s);
    });
    return PDFS.loadP;
  },
  async open(id) {
    let d = PDFS.docs.get(id); if (d) return d.p || d;
    const p = (async () => {
      const e = AS.get(id); if (!e) throw new Error('PDF data missing'); const lib = await PDFS.lib(); const data = new Uint8Array(await e.blob.arrayBuffer());
      const pdf = await lib.getDocument({ data, cMapUrl: 'https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/cmaps/', cMapPacked: true }).promise; const dd = { pdf, pages: new Map() }; PDFS.docs.set(id, dd); return dd;
    })();
    PDFS.docs.set(id, { p }); try { return await p; } catch (e) { PDFS.docs.delete(id); throw e; }
  },
  async page(id, n) { const d = await PDFS.open(id); let p = d.pages.get(n); if (!p) { p = await d.pdf.getPage(n); d.pages.set(n, p); } return p; },
  reset() { PDFS.docs.forEach(d => { try { d.pdf && d.pdf.destroy(); } catch (e) { } }); PDFS.docs.clear(); PDFS.cache.clear(); PDFS.px = 0; PDFS.wants.clear(); PDFS.txt.clear(); PDFS.txtP.clear(); },
  capFor(o, hard) { return Math.max(.3, Math.min(hard || 4, 4096 / o.w, 4096 / o.h, Math.sqrt((hard ? 4e7 : 1.6e7) / (o.w * o.h)))); },
  get(o, scr, exporting) {
    const key = o.doc + '|' + o.pg, e = PDFS.cache.get(key); if (exporting) return e || null;
    let want = PDFS.tiers.find(t => t >= scr) || 4; want = Math.min(want, PDFS.capFor(o)); if (e) e.t = performance.now();
    if (!e || e.s < want * .999) { PDFS.wants.set(key, { o: { doc: o.doc, pg: o.pg, w: o.w, h: o.h, pw: o.pw }, tier: want, t: performance.now() }); if (!PDFS.busy) PDFS.pump(); }
    return e || null;
  },
  async pump() {
    PDFS.busy = true;
    try {
      while (PDFS.wants.size) {
        const now = performance.now(); let best = null;
        for (const [k, w] of PDFS.wants) { if (now - w.t > 900) { PDFS.wants.delete(k); continue; } if (!best || w.t > best[1].t) best = [k, w]; }
        if (!best) break; PDFS.wants.delete(best[0]); const cur = PDFS.cache.get(best[0]); if (cur && cur.s >= best[1].tier * .999) continue;
        try { await PDFS.renderNow(best[1].o, best[1].tier); } catch (e) { console.warn('pdf render', e); } R.req();
      }
    } finally { PDFS.busy = false; }
  },
  async renderNow(o, tier) {
    const page = await PDFS.page(o.doc, o.pg), vp = page.getViewport({ scale: tier * o.w / o.pw }); const cv = document.createElement('canvas'); cv.width = Math.ceil(vp.width); cv.height = Math.ceil(vp.height);
    const c = cv.getContext('2d'); c.fillStyle = '#fff'; c.fillRect(0, 0, cv.width, cv.height); await page.render({ canvasContext: c, viewport: vp }).promise;
    const key = o.doc + '|' + o.pg, old = PDFS.cache.get(key); if (old) PDFS.px -= old.cv.width * old.cv.height; PDFS.cache.set(key, { cv, s: tier, t: performance.now(), pin: old && old.pin }); PDFS.px += cv.width * cv.height; PDFS.evict(); return cv;
  },
  evict() { while (PDFS.px > 7e7 && PDFS.cache.size > 6) { let ok = null, ot = 1e18; for (const [k, e] of PDFS.cache) if (!e.pin && e.t < ot) { ok = k; ot = e.t; } if (!ok) break; const e = PDFS.cache.get(ok); PDFS.px -= e.cv.width * e.cv.height; PDFS.cache.delete(ok); } },
  async text(doc, pg) {
    const key = doc + '|' + pg; if (PDFS.txt.has(key)) return PDFS.txt.get(key); if (PDFS.txtP.has(key)) return PDFS.txtP.get(key);
    const p = (async () => {
      const lib = await PDFS.lib(), page = await PDFS.page(doc, pg), vp = page.getViewport({ scale: 1 }), tc = await page.getTextContent(), items = [];
      for (const it of tc.items) { if (!it.str || !it.str.trim()) continue; const t = lib.Util.transform(vp.transform, it.transform), h = Math.hypot(t[2], t[3]) || 10, w = (it.width || 0) * vp.scale; if (!w) continue; items.push({ s: it.str, x: t[4], y: t[5] - h * .86, w, h: h * 1.05 }); }
      PDFS.txt.set(key, items); PDFS.txtP.delete(key); return items;
    })(); PDFS.txtP.set(key, p); return p;
  },
  sync(doc, pg) { return PDFS.txt.get(doc + '|' + pg) || null; },
  /* position in text: nearest item + char */
  posAt(items, x, y) {
    let bi = -1, bd = 1e18; items.forEach((it, i) => { const dx = x < it.x ? it.x - x : x > it.x + it.w ? x - it.x - it.w : 0, dy = y < it.y ? it.y - y : y > it.y + it.h ? y - it.y - it.h : 0, d = dx * dx + dy * dy * 4; if (d < bd) { bd = d; bi = i; } });
    if (bi < 0) return null; const it = items[bi]; return { i: bi, c: U.clamp(Math.round((x - it.x) / it.w * it.s.length), 0, it.s.length) };
  },
  selRects(items, a, b) {
    if (!a || !b) return { rects: [], text: '' }; if (a.i > b.i || (a.i === b.i && a.c > b.c)) [a, b] = [b, a];
    const rects = [], parts = []; let last = null;
    for (let i = a.i; i <= b.i; i++) {
      const it = items[i], n = it.s.length, s = i === a.i ? a.c : 0, e = i === b.i ? b.c : n; if (e <= s) continue; const x0 = it.x + it.w * s / n, x1 = it.x + it.w * e / n; parts.push(it.s.slice(s, e));
      if (last && Math.abs(last.y - it.y) < it.h * .45 && x0 - (last.x + last.w) < it.h * .8 && x0 > last.x - 2) { last.w = Math.max(last.w, x1 - last.x); last.h = Math.max(last.h, it.h); } else { last = { x: x0, y: it.y, w: x1 - x0, h: it.h }; rects.push(last); }
    }
    return { rects, text: parts.join(' ').replace(/\s+/g, ' ').trim() };
  },
  async index(doc, n, onProg) { // full-text index (array of page strings)
    const key = 'txtidx|' + doc; if (PDFS.txt.has(key)) return PDFS.txt.get(key);
    const rec = await DB.get('data', 'txt|' + D.id + '|' + doc).catch(() => null); if (rec && rec.pages && rec.pages.length === n) { PDFS.txt.set(key, rec.pages); return rec.pages; }
    const pages = []; for (let i = 1; i <= n; i++) { try { const pg = await PDFS.page(doc, i), tc = await pg.getTextContent(); pages.push(tc.items.map(t => t.str).join(' ').replace(/\s+/g, ' ')); } catch (e) { pages.push(''); } if (onProg && i % 5 === 0) onProg(i, n); }
    PDFS.txt.set(key, pages); try { await DB.put('data', { id: 'txt|' + D.id + '|' + doc, pages }); } catch (e) { } return pages;
  }
};

/* ---------------- object types ---------------- */
T.def('pdfpage', {
  def: () => ({ doc: '', pg: 1, pw: 595, ph: 842, w: 800, h: 1131, locked: true }), resize: 'none', noRot: true, noConn: true,
  draw(ctx, o, env) {
    const m = ctx.getTransform(), scr = Math.hypot(m.a, m.b), e = PDFS.get(o, scr, env.exporting);
    if (!env.exporting) { ctx.save(); ctx.shadowColor = 'rgba(20,30,60,.22)'; ctx.shadowBlur = 14 * env.k; ctx.shadowOffsetY = 3 * env.k; ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, o.w, o.h); ctx.restore(); } else { ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, o.w, o.h); }
    if (e) { ctx.imageSmoothingQuality = 'high'; ctx.drawImage(e.cv, 0, 0, o.w, o.h); }
    else if (!env.exporting) { ctx.fillStyle = '#c3c9d6'; ctx.font = `600 ${22 / env.z}px ${U.FONTS.sans}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('Loading page ' + o.pg + '…', o.w / 2, o.h / 2); }
    if (!env.exporting && env.z > .25) { ctx.fillStyle = 'rgba(100,110,130,.8)'; ctx.font = `${12 / env.z}px ${U.FONTS.sans}`; ctx.textAlign = 'center'; ctx.textBaseline = 'top'; ctx.fillText(o.pg, o.w / 2, o.h + 6 / env.z); }
  },
  hit: () => false, text: () => []
});

T.def('hl', {
  def: () => ({ kind: 'hl', color: '#ffe14d', rects: [], text: '', note: '', doc: '', pg: 0, w: 10, h: 10 }), resize: 'none', noRot: true, noConn: false,
  draw(ctx, o) {
    const k = o.kind; ctx.save();
    for (const r of o.rects) {
      if (k === 'hl' || k === 'sq') { ctx.globalCompositeOperation = 'multiply'; ctx.globalAlpha *= k === 'hl' ? .55 : .35; ctx.fillStyle = o.color; ctx.beginPath(); rr(ctx, r.x - 1, r.y, r.w + 2, r.h, 3); ctx.fill(); ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over'; }
      if (k === 'ul' || k === 'sq') { ctx.strokeStyle = o.color; ctx.lineWidth = Math.max(1.6, r.h * .09); ctx.beginPath(); if (k === 'sq') { const y = r.y + r.h - 1; ctx.moveTo(r.x, y); for (let x = r.x; x < r.x + r.w; x += 4) ctx.lineTo(x + 2, y + ((x - r.x) / 4 % 2 ? -1.8 : 1.8)); } else { ctx.moveTo(r.x, r.y + r.h - 1); ctx.lineTo(r.x + r.w, r.y + r.h - 1); } ctx.stroke(); }
      if (k === 'st') { ctx.strokeStyle = o.color; ctx.lineWidth = Math.max(1.6, r.h * .09); ctx.beginPath(); ctx.moveTo(r.x, r.y + r.h * .55); ctx.lineTo(r.x + r.w, r.y + r.h * .55); ctx.stroke(); }
    }
    if (o.note) { const r = o.rects[0]; if (r) { ctx.fillStyle = '#f59e0b'; ctx.beginPath(); ctx.arc(o.w + 6, Math.max(6, r.y + 6), 6, 0, 7); ctx.fill(); ctx.fillStyle = '#fff'; ctx.font = 'bold 9px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('i', o.w + 6, Math.max(6, r.y + 6) + .5); } }
    ctx.restore();
  },
  hit(o, lx, ly, tol) { return o.rects.some(r => lx >= r.x - tol && lx <= r.x + r.w + tol && ly >= r.y - tol && ly <= r.y + r.h + tol); },
  text: o => [o.text, o.note],
  ins: o => [{ sec: 'Highlight' }, { k: 'kind', t: 'seg', l: 'Style', opts: [['hl', 'Highlight'], ['ul', 'Underline'], ['st', 'Strike'], ['sq', 'Squiggly']] }, { k: 'color', t: 'color', l: 'Colour', palette: Study.HL_COLORS },
    { k: 'note', t: 'text', l: 'Note', ml: true }, { t: 'btns', items: [{ l: 'Quote into note', ic: 'quote', fn: ob => Study.quote(ob) }, { l: 'Go to page', ic: 'pointer', fn: ob => Study.jumpSrc(ob) }] }]
});

/* ---------------- Study core ---------------- */
const Study = {
  HL_COLORS: ['#ffe14d', '#7ee787', '#6cb6ff', '#ff9ec6', '#ffa657', '#c8a2ff', '#ff6b6b', '#2dd4bf'],
  o: Object.assign({ kind: 'hl', color: '#ffe14d', clipInk: true, area: false, tpl: 'lined' }, JSON.parse(localStorage.getItem('ib.study') || '{}')),
  save() { localStorage.setItem('ib.study', JSON.stringify(Study.o)); },
  on: false, flash: null,
  docs() { return (D.extra.docs = D.extra.docs || []); },
  doc(id) { return Study.docs().find(d => d.id === id); },
  pdfLayer() { return D.extra.pdfLayer; },
  ensureLayers() {
    if (!D.extra.pdfLayer || !D.layers.find(l => l.id === D.extra.pdfLayer)) { const l = { id: U.uid('L'), n: 'PDF pages', v: true, l: true, o: 1 }; D.layers.unshift(l); D.extra.pdfLayer = l.id; }
    let a = D.layers.find(l => l.id !== D.extra.pdfLayer); if (!a) { a = { id: U.uid('L'), n: 'Annotations', v: true, l: false, o: 1 }; D.layers.push(a); } else if (a.n === 'Layer 1' && !D.objs.some(o => o.layer === a.id)) a.n = 'Annotations';
    if (D.active === D.extra.pdfLayer || !D.layers.find(l => l.id === D.active)) D.active = a.id;
  },
  /* ---- columns / geometry ---- */
  pagesOf(doc) {
    if (!doc) return []; if (doc.kind === 'pdf') return D.objs.filter(o => o.type === 'pdfpage' && o.doc === doc.id).sort((a, b) => a.pg - b.pg);
    return D.objs.filter(o => o.type === 'frame' && o.nb === doc.id).sort((a, b) => a.y - b.y);
  },
  allPages() { return D.objs.filter(o => o.type === 'pdfpage' || (o.type === 'frame' && o.nb)); },
  nextCol() { const p = Study.allPages(); if (!p.length) return 0; const ex = D.objs.filter(o => o.src || o.srcmark).map(o => o.x + o.w); return Math.max(...p.map(o => o.x + o.w), ...ex) + 160; },
  docOf(o) { return Study.docs().find(d => d.id === (o.type === 'pdfpage' ? o.doc : o.nb)); },
  pageAt(x, y) { for (let i = D.objs.length - 1; i >= 0; i--) { const o = D.objs[i]; if (o.type === 'pdfpage' && x >= o.x && x <= o.x + o.w && y >= o.y && y <= o.y + o.h) return o; } return null; },
  curPage() {
    const z = D.view.z, cx = D.view.x + R.W / 2 / z, cy = D.view.y + R.H * .38 / z; let best = null, bd = 1e18;
    for (const o of Study.allPages()) { const dx = cx < o.x ? o.x - cx : cx > o.x + o.w ? cx - o.x - o.w : 0, dy = cy < o.y ? o.y - cy : cy > o.y + o.h ? cy - o.y - o.h : 0, d = dx * dx + dy * dy; if (d < bd) { bd = d; best = o; } }
    return best;
  },
  pageNo(o) { const d = Study.docOf(o); if (!d) return 0; return o.type === 'pdfpage' ? o.pg : Study.pagesOf(d).indexOf(o) + 1; },
  goto(o, opts = {}) {
    if (!o) return; Study.free = false; const z = opts.z || U.clamp((R.W - 150) / o.w, .2, 4); R.animate({ x: o.x + o.w / 2 - R.W / 2 / z, y: o.y - 28 / z, z }); Sel.clear(); setTimeout(() => Bus.emit('view'), 400);
  },
  gotoPage(docId, pg, flash) { const d = Study.doc(docId); if (!d) return; const o = Study.pagesOf(d)[pg - 1]; if (o) { Study.goto(o); if (flash) Study.flashRects(o, flash); } },
  step(dlt) {
    Study.free = false; const c = Study.curPage(); if (!c) return; const d = Study.docOf(c), ps = Study.pagesOf(d), i = U.clamp(ps.indexOf(c) + dlt, 0, ps.length - 1); Study.goto(ps[i]);
  },
  flashRects(o, rects) { const f = o.w / (o.pw || o.w); Study.flash = { rects: rects.map(r => ({ x: o.x + r.x * f, y: o.y + r.y * f, w: r.w * f, h: r.h * f })), t: Date.now() }; R.reqOv(); setTimeout(() => { Study.flash = null; R.reqOv(); }, 3200); },
  /* ---- adding PDFs ---- */
  async addPdf(file, pt, name) {
    const toast = (m, t) => UI.toast(m, t || 2500);
    try {
      toast('Opening PDF…', 3500); await PDFS.lib();
      const id = await AS.add(file, file.name || 'document.pdf'); const dd = await PDFS.open(id), pdf = dd.pdf, n = pdf.numPages;
      Study.ensureLayers(); const x0 = pt && pt.x != null ? pt.x : Study.nextCol(); let y = pt && pt.y != null ? pt.y : 0; const objs = [], W = 800, gap = 28; const info = await pdf.getMetadata().catch(() => null);
      for (let i = 1; i <= n; i++) { const page = await PDFS.page(id, i), vp = page.getViewport({ scale: 1 }), h = W * vp.height / vp.width; const o = D.make('pdfpage', { doc: id, pg: i, pw: vp.width, ph: vp.height, w: W, h, x: x0, y, layer: D.extra.pdfLayer, locked: true }); objs.push(o); y += h + gap; if (i === 1 && n > 40) toast('Reading ' + n + ' pages…', 4000); }
      const title = (info && info.info && info.info.Title) || ''; const rec = { id, kind: 'pdf', name: name || (file.name || 'Document').replace(/\.pdf$/i, ''), pages: n, meta: { title, author: (info && info.info && info.info.Author) || '', year: '', publisher: '', url: '', tags: '' }, added: Date.now() };
      Study.docs().push(rec); objs.forEach(o => D.add(o)); D.commit('Add PDF', objs); Study.goto(objs[0]); Bus.emit('struct'); toast('Added “' + rec.name + '” (' + n + ' pages)');
      PDFS.index(id, n, (i, t) => { }).then(() => { Bus.emit('index'); }).catch(() => { });
      return rec;
    } catch (e) { console.error(e); UI.toast('Could not open this PDF: ' + (e.message || e), 4500, 'err'); }
  },
  async removeDoc(id) {
    const d = Study.doc(id); if (!d) return; if (!await UI.confirm(`Remove “${d.name}” from this space? Its pages and annotations on them are deleted.`, 'Remove', true)) return;
    const pages = Study.pagesOf(d), rm = new Set(pages); const rects = pages.map(p => ({ x: p.x, y: p.y, w: p.w, h: p.h }));
    for (const o of D.objs) { if (rm.has(o) || o.doc === id) { rm.add(o); continue; } const c = G.center(o); if (rects.some(r => c[0] >= r.x && c[0] <= r.x + r.w && c[1] >= r.y && c[1] <= r.y + r.h)) rm.add(o); }
    D.remove([...rm]); D.extra.docs = Study.docs().filter(x => x.id !== id); D.extra.bm = (D.extra.bm || []).filter(b => b.doc !== id); Sel.ids = []; D.commit('Remove document', []); [...PDFS.cache.keys()].filter(k => k.startsWith(id + '|')).forEach(k => PDFS.cache.delete(k)); Bus.emit('struct');
  },
  /* ---- notebooks ---- */
  PAGE_SIZES: [['A4 portrait', 794, 1123], ['A4 landscape', 1123, 794], ['A5 portrait', 559, 794], ['Letter portrait', 816, 1056], ['Square', 900, 900], ['Wide 16:9', 1280, 720], ['Tall (phone)', 600, 1200]],
  newNotebook(opts = {}) {
    const name = opts.name || 'Notebook ' + (Study.docs().filter(d => d.kind === 'note').length + 1); const id = U.uid('nb'); Study.ensureLayers(); const [, w, h] = opts.size || Study.PAGE_SIZES[0], x = Study.nextCol(); const objs = [];
    for (let i = 0; i < (opts.pages || 3); i++) objs.push(D.make('frame', { x, y: i * (h + 70), w, h, name: 'Page ' + (i + 1), nb: id, bg: opts.bg || '#ffffff', tpl: opts.tpl || 'lined', tplc: opts.tplc || '#aebbd8', tsp: opts.tsp || 32, ori: w >= h ? 'landscape' : 'portrait', stroke: '#c9ced8' }));
    Study.docs().push({ id, kind: 'note', name, pages: objs.length, meta: { title: '', author: '', year: '', publisher: '', url: '', tags: '' }, added: Date.now(), color: opts.cover || '#4f46e5' });
    objs.forEach(o => D.add(o)); D.commit('New notebook', objs); Study.goto(objs[0]); Bus.emit('struct'); return id;
  },
  addNotePage(docId, n = 1, after) {
    const d = Study.doc(docId); if (!d) return; const ps = Study.pagesOf(d); const base = after || ps[ps.length - 1]; if (!base) return; const out = [];
    let y = base.y + base.h + 70; const idx = ps.indexOf(base); const shift = (base.h + 70) * n; ps.slice(idx + 1).forEach(p => { Act.translate(p, 0, shift); });
    // also shift content below (annotations) belonging to later pages
    const later = ps.slice(idx + 1); const lr = later.map(p => ({ x: p.x - 40, y: p.y - shift, w: p.w + 80, h: p.h }));
    for (let i = 0; i < n; i++) { const f = D.make('frame', Object.assign({}, JSON.parse(JSON.stringify(base)), { id: U.uid(), x: base.x, y: y + i * (base.h + 70), name: '' })); out.push(f); }
    out.forEach(f => D.add(f)); Study.renumber(d); D.commit('Add page', out); Bus.emit('struct'); return out;
  },
  renumber(d) { Study.pagesOf(d).forEach((f, i) => { f.name = 'Page ' + (i + 1); delete f._j; }); d.pages = Study.pagesOf(d).length; },
  /* ---- clips: cut part of a PDF page, linked both ways ---- */
  async makeClip(area) {
    if (area.w < 8 || area.h < 8) return; const pages = D.objs.filter(o => o.type === 'pdfpage' && G.rectsHit(G.aabb(o), area));
    const home = pages.sort((a, b) => (Math.min(b.y + b.h, area.y + area.h) - Math.max(b.y, area.y)) - (Math.min(a.y + a.h, area.y + area.h) - Math.max(a.y, area.y)))[0] || Study.curPage();
    const sc = Math.min(4, Math.max(1.5, 2400 / Math.max(area.w, area.h))); UI.toast('Cutting…', 1200);
    await Study.warm([area], sc); const list = D.sorted().filter(o => D.isVisible(o) && !o.srcmark && !(o.type === 'image' && o.src) && (Study.o.clipInk || o.type === 'pdfpage' || o.type === 'frame'));
    const cv = IO.renderCanvas({ objs: list, area, scale: sc, bg: '#ffffff', clip: true }); Study.unpin(); const blob = await U.canvasBlob(cv, 'image/png'); const aid = await AS.add(blob, 'clip.png');
    const dw = Math.min(area.w, 720), k = dw / area.w; const doc = home ? (home.doc || home.nb) : ''; const pg = home ? Study.pageNo(home) : 0;
    let x = home ? home.x + home.w + 70 : area.x + area.w + 40, y = area.y; const pgs = Study.allPages(), box = () => ({ x: x - 10, y: y - 10, w: dw + 20, h: area.h * k + 20 });
    for (let i = 0; i < 60 && pgs.some(p => G.rectsHit(G.aabb(p), box())); i++) x += 60;
    const clip = D.make('image', { asset: aid, nw: cv.width, nh: cv.height, x, y, w: dw, h: area.h * k, name: 'Clip · p.' + pg, bw: 1.5, bc: '#4f46e5', src: { doc, pg, rect: [area.x, area.y, area.w, area.h] }, doc, layer: Study.annLayer() });
    const mk = D.make('shape', { kind: 'rect', x: area.x, y: area.y, w: area.w, h: area.h, fill: 'rgba(79,70,229,.07)', stroke: '#4f46e5', sw: 1.5, dash: 'dashed', r: 3, srcmark: true, doc, layer: Study.annLayer(), link: { k: 'obj', v: clip.id } });
    clip.link = { k: 'obj', v: mk.id }; D.add(mk); D.add(clip); Sel.set([clip.id]); D.commit('Clip from PDF', [mk, clip]); Bus.emit('struct'); UI.toast('Clip created — drag it anywhere; tap its link badge to jump to the source', 3500); return clip;
  },
  clamp() {
    if (Study.free || !(R.W > 0)) return false; const c = Study.curPage(); if (!c) return false; const v = D.view, ox = v.x, oy = v.y, oz = v.z; v.z = U.clamp(v.z, .15, 6);
    const id = c.type === 'pdfpage' ? c.doc : c.nb; let x0 = 1e12, y0 = 1e12, x1 = -1e12, y1 = -1e12;
    for (const o of D.objs) { if (!((o.type === 'pdfpage' && o.doc === id) || (o.type === 'frame' && o.nb === id) || ((o.src || o.srcmark) && o.doc === id))) continue; if (o.x < x0) x0 = o.x; if (o.y < y0) y0 = o.y; if (o.x + o.w > x1) x1 = o.x + o.w; if (o.y + o.h > y1) y1 = o.y + o.h; }
    if (x0 > x1) return false; const z = v.z, vw = R.W / z, vh = R.H / z, mx = 50 / z;
    if (x1 - x0 + 2 * mx <= vw) v.x = (x0 + x1) / 2 - vw / 2; else v.x = U.clamp(v.x, x0 - mx, x1 + mx - vw);
    const top = 70 / z, bot = 80 / z; if (y1 - y0 + top + bot <= vh) v.y = y0 - top - (vh - (y1 - y0 + top + bot)) / 2; else v.y = U.clamp(v.y, y0 - top, y1 + bot - vh);
    const ch = Math.abs(v.x - ox) > .01 || Math.abs(v.y - oy) > .01 || oz !== v.z; if (ch) Bus.emit('view'); return ch;
  },
  annLayer() { Study.ensureLayers(); return D.active; },
  jumpSrc(o) {
    if (o.src) { const t = o.link && D.byId.get(o.link.v); const r = o.src.rect; R.fitRect({ x: r[0], y: r[1], w: r[2], h: r[3] }, 120, true, 1.6); Study.flash = { rects: [{ x: r[0], y: r[1], w: r[2], h: r[3] }], t: Date.now(), raw: true }; R.reqOv(); setTimeout(() => { Study.flash = null; R.reqOv(); }, 2600); return; }
    if (o.type === 'hl') { const p = D.objs.find(x => x.type === 'pdfpage' && x.doc === o.doc && x.pg === o.pg); if (p) { Study.goto(p); R.fitRect({ x: o.x, y: o.y, w: o.w, h: o.h }, 160, true, 1.8); Study.flash = { rects: o.rects.map(r => ({ x: o.x + r.x, y: o.y + r.y, w: r.w, h: r.h })), t: Date.now(), raw: true }; R.reqOv(); setTimeout(() => { Study.flash = null; R.reqOv(); }, 2600); } }
  },
  quote(o) {
    const doc = Study.doc(o.doc), [cx, cy] = Act.center(); const txt = (o.text || '').trim(); const cite = doc ? ` — ${doc.meta && doc.meta.author ? doc.meta.author : doc.name}, p.${o.pg}` : '';
    const s = D.make('sticky', { text: '“' + txt + '”' + cite + (o.note ? '\n\n' + o.note : ''), color: o.color, x: cx - 110, y: cy - 110, w: 240, h: 200, link: { k: 'obj', v: o.id }, layer: Study.annLayer() }); Act.insert(s, 'Quote into note');
  },
  /* ---- export / warm ---- */
  async warm(areas, tier) {
    const pages = D.objs.filter(o => o.type === 'pdfpage' && (!areas || areas.some(a => G.rectsHit(G.aabb(o), a)))); let n = 0;
    for (const o of pages) { const t = Math.min(tier, PDFS.capFor(o, 6)), key = o.doc + '|' + o.pg, e = PDFS.cache.get(key); if (!e || e.s < t * .999) await PDFS.renderNow(o, t); const c = PDFS.cache.get(key); if (c) c.pin = true; if (++n % 6 === 0) UI.toast(`Rendering pages… ${n}/${pages.length}`, 1200); }
  },
  unpin() { PDFS.cache.forEach(e => e.pin = false); },
  async exportPdf(id) {
    const d = Study.doc(id); if (!d) return; const ps = Study.pagesOf(d); if (!ps.length) return; const sc = 2.2, out = [];
    UI.toast('Building PDF…', 6000); await Study.warm(ps.map(p => ({ x: p.x, y: p.y, w: p.w, h: p.h })), sc);
    for (const p of ps) { const area = { x: p.x, y: p.y, w: p.w, h: p.h }; const cv = IO.renderCanvas({ area, all: true, frame: p.type === 'frame' ? p : null, bg: p.type === 'frame' ? p.bg : '#ffffff', scale: sc, clip: true }); out.push(await IO.pdfPage(cv, p.pw ? p.pw / .75 : p.w, p.pw ? p.ph / .75 : p.h)); }
    Study.unpin(); U.download(await IO.buildPdf(out), d.name.replace(/[\\/:*?"<>|]+/g, '_') + (d.kind === 'pdf' ? ' (annotated).pdf' : '.pdf')); UI.toast('PDF exported');
  },
  /* ---- search ---- */
  async search(q) {
    const ql = q.toLowerCase().trim(), res = []; if (!ql) return res;
    for (const d of Study.docs()) {
      if (d.kind !== 'pdf') continue; const pages = PDFS.txt.get('txtidx|' + d.id); if (!pages) continue;
      pages.forEach((s, i) => { let ix = s.toLowerCase().indexOf(ql), c = 0; while (ix >= 0 && c < 3) { res.push({ type: 'pdf', doc: d, pg: i + 1, snip: (ix > 30 ? '…' : '') + s.slice(Math.max(0, ix - 30), ix + ql.length + 60), q }); ix = s.toLowerCase().indexOf(ql, ix + ql.length); c++; } });
    }
    for (const o of D.objs) { if (o.type === 'pdfpage') continue; const t = T.get(o.type); const strs = (t.text ? t.text(o) : []).filter(Boolean); const m = strs.find(s => String(s).toLowerCase().includes(ql)); if (m) res.push({ type: 'obj', o, snip: String(m).slice(0, 90), q }); }
    return res;
  },
  async showHit(h) {
    if (h.type === 'obj') { Sel.set([h.o.id]); R.fitRect(G.aabb(h.o), 140, true, 1.5); return; }
    const pageObj = Study.pagesOf(h.doc)[h.pg - 1]; if (!pageObj) return; Study.goto(pageObj);
    try { const items = await PDFS.text(h.doc.id, h.pg); const ql = h.q.toLowerCase(); const rects = []; items.forEach(it => { let ix = it.s.toLowerCase().indexOf(ql); while (ix >= 0) { rects.push({ x: it.x + it.w * ix / it.s.length, y: it.y, w: it.w * ql.length / it.s.length, h: it.h }); ix = it.s.toLowerCase().indexOf(ql, ix + 1); } }); if (rects.length) Study.flashRects(pageObj, rects); } catch (e) { }
  },
  async outline(docId) {
    const d = await PDFS.open(docId); const ol = await d.pdf.getOutline().catch(() => null); return ol || [];
  },
  async destPage(docId, dest) {
    const d = await PDFS.open(docId); if (typeof dest === 'string') dest = await d.pdf.getDestination(dest); if (!Array.isArray(dest)) return null; const ref = dest[0]; return typeof ref === 'object' ? (await d.pdf.getPageIndex(ref)) + 1 : ref + 1;
  },
  /* ---- overlay ---- */
  overlay(ctx) {
    if (!Study.on) return; const f = Study.flash;
    if (f) { const age = (Date.now() - f.t) / 3200, a = Math.max(0, 1 - age * age); ctx.save(); ctx.fillStyle = `rgba(245,158,11,${.4 * a})`; ctx.strokeStyle = `rgba(245,158,11,${.9 * a})`; ctx.lineWidth = 2; f.rects.forEach(r => { const p = R.w2s(r.x, r.y), q = R.w2s(r.x + r.w, r.y + r.h); ctx.beginPath(); ctx.rect(p[0] - 2, p[1] - 2, q[0] - p[0] + 4, q[1] - p[1] + 4); ctx.fill(); ctx.stroke(); }); ctx.restore(); if (a > 0) setTimeout(() => R.reqOv(), 80); }
    const st = Tools.st; if (!st) return;
    if (st.k === 'hl' && st.rectsW) { ctx.save(); ctx.fillStyle = st.sel ? 'rgba(59,130,246,.32)' : Study.o.color + '88'; st.rectsW.forEach(r => { const p = R.w2s(r.x, r.y), q = R.w2s(r.x + r.w, r.y + r.h); ctx.fillRect(p[0], p[1], q[0] - p[0], q[1] - p[1]); }); ctx.restore(); }
    if (st.k === 'clip' && Tools.moved) { const p = R.w2s(Math.min(st.x0, st.x1), Math.min(st.y0, st.y1)), q = R.w2s(Math.max(st.x0, st.x1), Math.max(st.y0, st.y1)); ctx.save(); ctx.fillStyle = 'rgba(79,70,229,.12)'; ctx.strokeStyle = '#4f46e5'; ctx.lineWidth = 2; ctx.setLineDash([7, 5]); ctx.fillRect(p[0], p[1], q[0] - p[0], q[1] - p[1]); ctx.strokeRect(p[0], p[1], q[0] - p[0], q[1] - p[1]); ctx.restore(); }
  }
};

/* ---- tools ---- */
Tools.H.hilite = {
  down(pt) {
    const o = Study.pageAt(pt.x, pt.y); Tools.st = { k: 'hl', o, items: null, a: null, rectsW: null, area: Study.o.area || pt.alt };
    if (!o) return; const f = o.w / o.pw, lx = (pt.x - o.x) / f, ly = (pt.y - o.y) / f; Tools.st.f = f; Tools.st.x0 = lx; Tools.st.y0 = ly;
    const items = PDFS.sync(o.doc, o.pg); if (items) { Tools.st.items = items; if (!items.length) Tools.st.area = true; else Tools.st.a = PDFS.posAt(items, lx, ly); } else { UI.toast('Reading page text…', 1200); PDFS.text(o.doc, o.pg).then(it => { if (Tools.st && Tools.st.o === o) { Tools.st.items = it; if (!it.length) Tools.st.area = true; else Tools.st.a = PDFS.posAt(it, Tools.st.x0, Tools.st.y0); } }); }
  },
  move(pt) {
    const s = Tools.st; if (!s || !s.o) return; const f = s.f, lx = U.clamp((pt.x - s.o.x) / f, 0, s.o.pw), ly = U.clamp((pt.y - s.o.y) / f, 0, s.o.ph);
    if (s.area) { s.rects = [{ x: Math.min(s.x0, lx), y: Math.min(s.y0, ly), w: Math.abs(lx - s.x0), h: Math.abs(ly - s.y0) }]; s.text = ''; }
    else if (s.items && s.a) { const r = PDFS.selRects(s.items, s.a, PDFS.posAt(s.items, lx, ly)); s.rects = r.rects; s.text = r.text; }
    else return; s.rectsW = s.rects.map(r => ({ x: s.o.x + r.x * f, y: s.o.y + r.y * f, w: r.w * f, h: r.h * f })); R.reqOv();
  },
  up() {
    const s = Tools.st; if (!s || !s.o || !s.rects || !s.rects.length || !Tools.moved) return; const f = s.f, o = s.o; const W = s.rects.map(r => ({ x: o.x + r.x * f, y: o.y + r.y * f, w: r.w * f, h: r.h * f }));
    const u = G.union(W.map(r => ({ x: r.x, y: r.y, w: r.w, h: r.h, rot: 0, type: 'shape' }))); if (u.w < 3 || u.h < 3) return;
    const hl = D.make('hl', { kind: Study.o.kind, color: Study.o.color, x: u.x, y: u.y, w: u.w, h: u.h, rects: W.map(r => ({ x: r.x - u.x, y: r.y - u.y, w: r.w, h: r.h })), text: s.text || '', doc: o.doc, pg: o.pg, layer: Study.annLayer() });
    D.add(hl); D.commit('Highlight', hl); Bus.emit('struct');
  }
};
Tools.H.clip = {
  down(pt) { Tools.st = { k: 'clip', x0: pt.x, y0: pt.y, x1: pt.x, y1: pt.y }; },
  move(pt) { const s = Tools.st; s.x1 = pt.x; s.y1 = pt.y; R.reqOv(); },
  up() { const s = Tools.st; if (!s || !Tools.moved) return; const a = { x: Math.min(s.x0, s.x1), y: Math.min(s.y0, s.y1), w: Math.abs(s.x1 - s.x0), h: Math.abs(s.y1 - s.y0) }; Tools.set('select'); Study.makeClip(a); }
};
R.overlays.push(ctx => Study.overlay(ctx));
