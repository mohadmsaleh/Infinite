'use strict';
/* ===== PDF Ultra Engine — Flexcil / Notein / Jnotes / Goodnotes / Notewise Pro Suite =====
   Features:
   1. High-DPI Adaptive Rendering + Adjacent Page Prefetching + Fast Lazy PDF Opening
   2. Reading Modes: Vertical, Two-Page Book Spread (LTR & RTL Arabic), Horizontal Page-Turn
   3. Eye-Care Color Themes: Original, Sepia Warm Paper, Eye-Care Green, Smart Dark Mode
   4. Margin Expansion (Right / Left / Both / Bottom) with Lined / Grid / Dotted patterns
   5. Visual Auto-Crop White Margins (0%–18%)
   6. Full PDF Page Management: Insert Note Page inside PDF, Rotate 90°, Duplicate, Reorder, Delete
   7. Clickable Internal PDF Hyperlinks & External URLs (page.getAnnotations)
   8. RTL / Arabic-Aware Text Selection Engine
   9. Study Tape (Active Recall Masking Strips — tap to peek, Hide/Reveal All)
  10. Zoom Writing Window (Goodnotes / Notewise magnified floating writing box with auto-advance)
  11. Dual-Pane Split-Screen Study Mode (Reference PDF + Side Notebook/PDF with draggable divider)
  12. Flashcards Review Mode (built from Highlights, Notes & Study Tape) + Rich HTML/MD Study Sheet Export
*/
(function () {
  if (typeof PDFS === 'undefined' || typeof Study === 'undefined' || typeof T === 'undefined') return;

  /* ---------- Extra icons ---------- */
  Object.assign(U.IC, {
    tape: '<rect x="3" y="8" width="18" height="8" rx="1.5"/><path d="M7 8l4 8M13 8l4 8" stroke-width="1.6"/>',
    split: '<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M12 4v16"/>',
    zoombox: '<rect x="3" y="4" width="18" height="11" rx="2"/><rect x="6" y="12" width="12" height="8" rx="1.5" fill="currentColor" fill-opacity=".12"/><path d="M9 16h6"/>',
    eye: '<path d="M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6-10-6-10-6z"/><circle cx="12" cy="12" r="3"/>',
    cards: '<rect x="5" y="6" width="14" height="12" rx="2"/><path d="M8 3h10a2 2 0 012 2v9"/>',
    margin: '<rect x="4" y="4" width="16" height="16" rx="2"/><path d="M14 4v16M16.5 9h2M16.5 12h2M16.5 15h2"/>',
    spread: '<path d="M12 5v14M3 6a2 2 0 012-2h7v15H5a2 2 0 01-2-2zM21 6a2 2 0 00-2-2h-7v15h7a2 2 0 002-2z"/>',
    rotateR: '<path d="M20 12a8 8 0 11-2.3-5.6"/><path d="M20 4v5h-5"/>'
  });

  /* ---------- Persistent Ultra PDF Preferences ---------- */
  const PDFU = window.PDFU = {
    cfg: Object.assign({
      theme: 'orig',       // orig | sepia | green | dark
      layout: 'single',    // single | spread-ltr | spread-rtl | horiz
      crop: 0,             // 0..0.16 visual white margin crop
      marginSide: 'none',  // none | right | left | both | bottom
      marginSize: 280,     // px in board coords
      marginTpl: 'lined',  // blank | lined | grid | dots
      showLinks: true,
      rtlSelect: true,
      tapeRevealAll: false
    }, JSON.parse(localStorage.getItem('ib.pdfu') || '{}')),
    saveCfg() { localStorage.setItem('ib.pdfu', JSON.stringify(PDFU.cfg)); },
    annCache: new Map(), // key: doc|pg -> [{rect:[x,y,w,h], dest, url}]
    annP: new Map(),
    splitOpen: false,
    zoomBoxOpen: false
  };

  /* =====================================================================
     1. HIGH-DPI ADAPTIVE RENDERING + ADJACENT PREFETCH + LAZY PDF OPEN
     ===================================================================== */
  PDFS.tiers = [.4, .75, 1.15, 1.65, 2.35, 3.2, 4.5, 6];
  const _origCapFor = PDFS.capFor;
  PDFS.capFor = function (o, hard) {
    const base = _origCapFor ? _origCapFor.call(PDFS, o, hard) : 4;
    return Math.min(hard || 6, Math.max(base, Math.min(5.5, 5120 / Math.max(o.w || 800, o.h || 1000))));
  };

  // Prefetch adjacent pages silently to eliminate blank-page flashes during fast scroll
  PDFU.prefetchAround = function (docId, pg, tier) {
    const d = Study.doc(docId); if (!d || d.kind !== 'pdf') return;
    const ps = Study.pagesOf(d);
    const t = Math.min(tier || 1.15, 1.65);
    [pg - 1, pg + 1, pg + 2].forEach(n => {
      if (n < 1 || n > d.pages) return;
      const key = docId + '|' + n;
      if (PDFS.cache.has(key) || PDFS.wants.has(key)) return;
      const o = ps.find(p => p.type === 'pdfpage' && p.pg === n);
      if (!o) return;
      PDFS.wants.set(key, { o: { doc: o.doc, pg: o.pg, w: o.w, h: o.h, pw: o.pw }, tier: Math.min(t, PDFS.capFor(o)), t: performance.now() - 250 });
    });
    if (!PDFS.busy && PDFS.wants.size) PDFS.pump();
  };

  // Fast Lazy PDF Opening (instant open even for 500+ page textbooks)
  Study.addPdf = async function (file, pt, name) {
    const toast = (m, t) => UI.toast(m, t || 2500);
    try {
      toast('Opening PDF…', 3000);
      await PDFS.lib();
      const id = await AS.add(file, file.name || 'document.pdf');
      const dd = await PDFS.open(id), pdf = dd.pdf, n = pdf.numPages;
      Study.ensureLayers();
      const x0 = pt && pt.x != null ? pt.x : Study.nextCol();
      let y = pt && pt.y != null ? pt.y : 0;
      const objs = [], W = 800, gap = 28;
      const info = await pdf.getMetadata().catch(() => null);
      const firstPage = await PDFS.page(id, 1);
      const vp1 = firstPage.getViewport({ scale: 1 });
      const defH = W * vp1.height / vp1.width;
      const eagerCount = Math.min(n, 24);
      for (let i = 1; i <= n; i++) {
        let pw = vp1.width, ph = vp1.height, h = defH;
        if (i <= eagerCount) {
          const page = i === 1 ? firstPage : await PDFS.page(id, i);
          const vp = page.getViewport({ scale: 1 });
          pw = vp.width; ph = vp.height; h = W * ph / pw;
        }
        const o = D.make('pdfpage', { doc: id, pg: i, pw, ph, w: W, h, x: x0, y, rot90: 0, layer: D.extra.pdfLayer, locked: true });
        objs.push(o);
        y += h + gap;
      }
      const title = (info && info.info && info.info.Title) || '';
      const rec = {
        id, kind: 'pdf',
        name: name || (file.name || 'Document').replace(/\.pdf$/i, ''),
        pages: n,
        meta: { title, author: (info && info.info && info.info.Author) || '', year: '', publisher: '', url: '', tags: '' },
        added: Date.now()
      };
      Study.docs().push(rec);
      objs.forEach(o => D.add(o));
      D.commit('Add PDF', objs);
      if (PDFU.cfg.layout !== 'single') PDFU.applyLayout(id, PDFU.cfg.layout);
      Study.goto(objs[0]);
      PDFU.prefetchAround(id, 1, 1.5);
      Bus.emit('struct');
      toast(`Added “${rec.name}” (${n} pages)`);
      // Background refine remaining page dimensions + text index
      (async () => {
        let changed = false;
        for (let i = eagerCount + 1; i <= n; i++) {
          try {
            const pg = await PDFS.page(id, i), vp = pg.getViewport({ scale: 1 });
            const o = objs[i - 1];
            const nh = W * vp.height / vp.width;
            if (Math.abs(nh - o.h) > 2) { o.pw = vp.width; o.ph = vp.height; o.h = nh; changed = true; }
          } catch (e) { }
        }
        if (changed) PDFU.applyLayout(id, PDFU.cfg.layout);
        PDFS.index(id, n).then(() => Bus.emit('index')).catch(() => { });
      })();
      return rec;
    } catch (e) {
      console.error(e);
      UI.toast('Could not open this PDF: ' + (e.message || e), 4500, 'err');
    }
  };

  /* =====================================================================
     2. RTL / ARABIC-AWARE TEXT SELECTION FIX
     ===================================================================== */
  const _origSelRects = PDFS.selRects;
  PDFS.selRects = function (items, a, b) {
    if (!PDFU.cfg.rtlSelect) return _origSelRects.call(PDFS, items, a, b);
    if (!a || !b) return { rects: [], text: '' };
    if (a.i > b.i || (a.i === b.i && a.c > b.c)) [a, b] = [b, a];
    const rects = [], parts = [];
    let last = null;
    for (let i = a.i; i <= b.i; i++) {
      const it = items[i]; if (!it || !it.s) continue;
      const n = it.s.length, s = i === a.i ? a.c : 0, e = i === b.i ? b.c : n;
      if (e <= s) continue;
      const isRTL = /[\u0590-\u08FF]/.test(it.s);
      const x0 = isRTL ? it.x + it.w * (n - e) / n : it.x + it.w * s / n;
      const x1 = isRTL ? it.x + it.w * (n - s) / n : it.x + it.w * e / n;
      const rx = Math.min(x0, x1), rw = Math.max(1, Math.abs(x1 - x0));
      parts.push(it.s.slice(s, e));
      const sameLine = last && Math.abs(last.y - it.y) < Math.max(last.h, it.h) * .55;
      const closeX = last && (rx <= last.x + last.w + it.h * 1.1 && rx + rw >= last.x - it.h * 1.1);
      if (sameLine && closeX) {
        const nx = Math.min(last.x, rx);
        const nx2 = Math.max(last.x + last.w, rx + rw);
        last.x = nx; last.w = nx2 - nx;
        last.y = Math.min(last.y, it.y);
        last.h = Math.max(last.h, it.h);
      } else {
        last = { x: rx, y: it.y, w: rw, h: it.h };
        rects.push(last);
      }
    }
    return { rects, text: parts.join(' ').replace(/\s+/g, ' ').trim() };
  };

  /* =====================================================================
     3. CLICKABLE INTERNAL PDF HYPERLINKS (page.getAnnotations)
     ===================================================================== */
  PDFU.getLinks = async function (docId, pg) {
    const key = docId + '|' + pg;
    if (PDFU.annCache.has(key)) return PDFU.annCache.get(key);
    if (PDFU.annP.has(key)) return PDFU.annP.get(key);
    const p = (async () => {
      try {
        const page = await PDFS.page(docId, pg);
        const vp = page.getViewport({ scale: 1 });
        const anns = await page.getAnnotations();
        const links = [];
        for (const a of anns) {
          if (a.subtype !== 'Link' || (!a.dest && !a.url)) continue;
          const r = vp.convertToViewportRectangle(a.rect);
          const x0 = Math.min(r[0], r[2]), y0 = Math.min(r[1], r[3]);
          const w = Math.abs(r[2] - r[0]), h = Math.abs(r[3] - r[1]);
          links.push({ x: x0, y: y0, w, h, dest: a.dest || null, url: a.url || null });
        }
        PDFU.annCache.set(key, links);
        PDFU.annP.delete(key);
        R.req();
        return links;
      } catch (e) {
        PDFU.annP.delete(key);
        return [];
      }
    })();
    PDFU.annP.set(key, p);
    return p;
  };

  /* =====================================================================
     4. ENHANCED PDF PAGE RENDERER (THEMES + MARGINS + AUTO-CROP + ROTATION + LINKS)
     ===================================================================== */
  function drawMarginPattern(ctx, x, y, w, h, tpl, dark) {
    ctx.save();
    ctx.fillStyle = dark ? '#181c24' : (PDFU.cfg.theme === 'sepia' ? '#f6ecd9' : PDFU.cfg.theme === 'green' ? '#e5f2e6' : '#fafbfc');
    ctx.fillRect(x, y, w, h);
    ctx.strokeStyle = dark ? 'rgba(255,255,255,.12)' : 'rgba(79,70,229,.16)';
    ctx.lineWidth = 1;
    const sp = 28;
    if (tpl === 'lined' || tpl === 'grid') {
      ctx.beginPath();
      for (let yy = y + sp; yy < y + h; yy += sp) { ctx.moveTo(x, yy); ctx.lineTo(x + w, yy); }
      if (tpl === 'grid') for (let xx = x + sp; xx < x + w; xx += sp) { ctx.moveTo(xx, y); ctx.lineTo(xx, y + h); }
      ctx.stroke();
    } else if (tpl === 'dots') {
      ctx.fillStyle = dark ? 'rgba(255,255,255,.22)' : 'rgba(79,70,229,.25)';
      for (let yy = y + sp; yy < y + h; yy += sp)
        for (let xx = x + sp; xx < x + w; xx += sp) { ctx.beginPath(); ctx.arc(xx, yy, 1.3, 0, 7); ctx.fill(); }
    }
    ctx.strokeStyle = dark ? 'rgba(255,255,255,.18)' : 'rgba(100,116,139,.25)';
    ctx.setLineDash([5, 4]);
    ctx.strokeRect(x, y, w, h);
    ctx.restore();
  }

  const origPdfPage = T.get('pdfpage');
  if (origPdfPage) {
    origPdfPage.draw = function (ctx, o, env) {
      const m = ctx.getTransform(), scr = Math.hypot(m.a, m.b), e = PDFS.get(o, scr, env.exporting);
      const cfg = PDFU.cfg;
      const dark = !env.exporting && cfg.theme === 'dark';

      // Margin expansion panels (drawn outside o.w/o.h in board coordinates)
      if (!env.exporting && cfg.marginSide !== 'none' && cfg.marginSize > 0) {
        const ms = cfg.marginSize;
        if (cfg.marginSide === 'right' || cfg.marginSide === 'both') drawMarginPattern(ctx, o.w, 0, ms, o.h, cfg.marginTpl, dark);
        if (cfg.marginSide === 'left' || cfg.marginSide === 'both') drawMarginPattern(ctx, -ms, 0, ms, o.h, cfg.marginTpl, dark);
        if (cfg.marginSide === 'bottom') drawMarginPattern(ctx, 0, o.h, o.w, ms, cfg.marginTpl, dark);
      }

      // Page shadow & base card
      if (!env.exporting) {
        ctx.save();
        ctx.shadowColor = dark ? 'rgba(0,0,0,.55)' : 'rgba(20,30,60,.22)';
        ctx.shadowBlur = 14 * env.k; ctx.shadowOffsetY = 3 * env.k;
        ctx.fillStyle = dark ? '#14171f' : '#fff';
        ctx.fillRect(0, 0, o.w, o.h);
        ctx.restore();
      } else {
        ctx.fillStyle = '#fff';
        ctx.fillRect(0, 0, o.w, o.h);
      }

      if (e) {
        ctx.save();
        ctx.beginPath(); ctx.rect(0, 0, o.w, o.h); ctx.clip();
        if (!env.exporting) {
          if (cfg.theme === 'dark') ctx.filter = 'invert(0.92) hue-rotate(180deg) contrast(0.95)';
          else if (cfg.theme === 'sepia') ctx.filter = 'sepia(0.32) brightness(0.98) contrast(0.98)';
          else if (cfg.theme === 'green') ctx.filter = 'sepia(0.18) hue-rotate(68deg) saturate(0.85) brightness(0.97)';
        }
        const rot = ((o.rot90 || 0) % 4 + 4) % 4;
        if (rot) {
          ctx.translate(o.w / 2, o.h / 2);
          ctx.rotate(rot * Math.PI / 2);
          ctx.translate(-o.w / 2, -o.h / 2);
        }
        const cr = env.exporting ? 0 : (cfg.crop || 0);
        const sx = e.cv.width * cr, sy = e.cv.height * cr;
        const sw = Math.max(1, e.cv.width * (1 - 2 * cr)), sh = Math.max(1, e.cv.height * (1 - 2 * cr));
        ctx.imageSmoothingQuality = 'high';
        ctx.drawImage(e.cv, sx, sy, sw, sh, 0, 0, o.w, o.h);
        ctx.restore();
      } else if (!env.exporting) {
        ctx.fillStyle = dark ? '#64748b' : '#c3c9d6';
        ctx.font = `600 ${22 / env.z}px ${U.FONTS.sans}`;
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText('Loading page ' + o.pg + '…', o.w / 2, o.h / 2);
      }

      // Draw subtle clickable PDF hyperlinks overlay
      if (!env.exporting && cfg.showLinks && env.z > .35) {
        const links = PDFU.annCache.get(o.doc + '|' + o.pg);
        if (!links && !PDFU.annP.has(o.doc + '|' + o.pg)) PDFU.getLinks(o.doc, o.pg);
        if (links && links.length) {
          const f = o.w / (o.pw || o.w);
          ctx.save();
          ctx.fillStyle = 'rgba(59,130,246,.08)';
          ctx.strokeStyle = 'rgba(59,130,246,.42)';
          ctx.lineWidth = Math.max(1, 1 / env.z);
          for (const lk of links) {
            ctx.fillRect(lk.x * f, lk.y * f, lk.w * f, lk.h * f);
            ctx.beginPath();
            ctx.moveTo(lk.x * f, (lk.y + lk.h) * f);
            ctx.lineTo((lk.x + lk.w) * f, (lk.y + lk.h) * f);
            ctx.stroke();
          }
          ctx.restore();
        }
      }

      if (!env.exporting && env.z > .25) {
        ctx.fillStyle = dark ? 'rgba(203,213,225,.8)' : 'rgba(100,110,130,.8)';
        ctx.font = `${12 / env.z}px ${U.FONTS.sans}`;
        ctx.textAlign = 'center'; ctx.textBaseline = 'top';
        ctx.fillText(o.pg, o.w / 2, o.h + 6 / env.z);
      }
    };
  }

  /* =====================================================================
     5. STUDY TAPE OBJECT & TOOL (Goodnotes / Notewise Active Recall)
     ===================================================================== */
  T.def('tape', {
    def: () => ({ x: 0, y: 0, w: 140, h: 28, color: '#6366f1', revealed: false, label: '', rot: 0 }),
    draw(ctx, o) {
      const rev = o.revealed || PDFU.cfg.tapeRevealAll;
      ctx.save();
      if (rev) {
        ctx.strokeStyle = o.color || '#6366f1';
        ctx.lineWidth = 1.5;
        ctx.setLineDash([5, 4]);
        ctx.fillStyle = 'rgba(99,102,241,.07)';
        ctx.beginPath(); rr(ctx, 0, 0, o.w, o.h, 5); ctx.fill(); ctx.stroke();
      } else {
        ctx.fillStyle = o.color || '#6366f1';
        ctx.beginPath(); rr(ctx, 0, 0, o.w, o.h, 5); ctx.fill();
        ctx.save();
        ctx.clip();
        ctx.strokeStyle = 'rgba(255,255,255,.26)';
        ctx.lineWidth = 6;
        for (let x = -o.h; x < o.w + o.h; x += 16) {
          ctx.beginPath(); ctx.moveTo(x, o.h + 2); ctx.lineTo(x + o.h, -2); ctx.stroke();
        }
        ctx.restore();
      }
      ctx.restore();
    },
    hit(o, lx, ly, tol) { return lx >= -tol && lx <= o.w + tol && ly >= -tol && ly <= o.h + tol; },
    text: o => [o.label || ''],
    ins: o => [
      { sec: 'Study Tape (Active Recall)' },
      { k: 'color', t: 'color', l: 'Tape colour', palette: ['#6366f1', '#ec4899', '#0ea5e9', '#10b981', '#f59e0b', '#334155'] },
      { k: 'label', t: 'text', l: 'Hint / answer note', ml: true },
      { t: 'btns', items: [{ l: o.revealed ? 'Hide tape' : 'Peek / Reveal', ic: 'eye', fn: ob => { ob.revealed = !ob.revealed; D.commit('Toggle tape', ob); R.req(); } }] }
    ]
  });

  Tools.H.tape = {
    down(pt) { Tools.st = { k: 'tape', x0: pt.x, y0: pt.y, x1: pt.x, y1: pt.y }; },
    move(pt) { if (!Tools.st) return; Tools.st.x1 = pt.x; Tools.st.y1 = pt.y; R.reqOv(); },
    up() {
      const s = Tools.st; if (!s || !Tools.moved) return;
      const x = Math.min(s.x0, s.x1), y = Math.min(s.y0, s.y1);
      const w = Math.max(24, Math.abs(s.x1 - s.x0)), h = Math.max(18, Math.abs(s.y1 - s.y0));
      const tp = D.make('tape', { x, y, w, h, color: PDFU.tapeColor || '#6366f1', layer: Study.annLayer ? Study.annLayer() : D.active });
      D.add(tp); D.commit('Study tape', tp); R.req();
    }
  };
  R.overlays.push(ctx => {
    const s = Tools.st;
    if (s && s.k === 'tape' && Tools.moved) {
      const p = R.w2s(Math.min(s.x0, s.x1), Math.min(s.y0, s.y1));
      const q = R.w2s(Math.max(s.x0, s.x1), Math.max(s.y0, s.y1));
      ctx.save(); ctx.fillStyle = 'rgba(99,102,241,.45)'; ctx.strokeStyle = '#4f46e5'; ctx.lineWidth = 2;
      ctx.fillRect(p[0], p[1], q[0] - p[0], q[1] - p[1]); ctx.strokeRect(p[0], p[1], q[0] - p[0], q[1] - p[1]);
      ctx.restore();
    }
  });

  // Tap on Study Tape or PDF Hyperlink when in Select / Hand mode
  document.addEventListener('click', async e => {
    if (!Study.on || !D.id || !R.ov) return;
    if (e.target !== R.ov) return;
    if (Tools.tool !== 'select' && Tools.tool !== 'hand') return;
    const rc = R.ov.getBoundingClientRect();
    const [wx, wy] = R.s2w(e.clientX - rc.left, e.clientY - rc.top);

    // 1. Tap Study Tape to toggle peek/hide
    for (let i = D.objs.length - 1; i >= 0; i--) {
      const o = D.objs[i];
      if (o.type === 'tape' && wx >= o.x && wx <= o.x + o.w && wy >= o.y && wy <= o.y + o.h) {
        o.revealed = !o.revealed;
        R.req();
        return;
      }
    }

    // 2. Tap PDF Hyperlink
    if (PDFU.cfg.showLinks) {
      const pg = Study.pageAt(wx, wy);
      if (pg) {
        const links = PDFU.annCache.get(pg.doc + '|' + pg.pg);
        if (links && links.length) {
          const f = pg.w / (pg.pw || pg.w);
          const lx = (wx - pg.x) / f, ly = (wy - pg.y) / f;
          const hit = links.find(l => lx >= l.x && lx <= l.x + l.w && ly >= l.y && ly <= l.y + l.h);
          if (hit) {
            if (hit.url) { window.open(hit.url, '_blank', 'noopener'); return; }
            if (hit.dest) {
              const targetPg = await Study.destPage(pg.doc, hit.dest);
              if (targetPg) { Study.gotoPage(pg.doc, targetPg); UI.toast('Jumped to page ' + targetPg, 1500); }
            }
          }
        }
      }
    }
  });

  /* =====================================================================
     6. READING LAYOUT ENGINE (SINGLE / TWO-PAGE SPREAD LTR & RTL / HORIZ)
     ===================================================================== */
  PDFU.applyLayout = function (docId, mode) {
    const d = Study.doc(docId); if (!d) return;
    const ps = Study.pagesOf(d); if (!ps.length) return;
    const x0 = Math.min(...ps.map(p => p.x)), y0 = Math.min(...ps.map(p => p.y));
    const gap = 28;
    const extraX = (PDFU.cfg.marginSide === 'right' || PDFU.cfg.marginSide === 'left') ? PDFU.cfg.marginSize : (PDFU.cfg.marginSide === 'both' ? PDFU.cfg.marginSize * 2 : 0);
    const extraY = PDFU.cfg.marginSide === 'bottom' ? PDFU.cfg.marginSize : 0;

    // Collect annotations belonging to each page before moving
    const attached = ps.map(p => ({
      p,
      ox: p.x, oy: p.y,
      kids: D.objs.filter(o => o !== p && o.type !== 'pdfpage' && o.type !== 'frame' && (() => {
        const c = G.center(o);
        return c[0] >= p.x - 10 && c[0] <= p.x + p.w + 10 && c[1] >= p.y - 10 && c[1] <= p.y + p.h + 10;
      })())
    }));

    if (mode === 'single') {
      let y = y0;
      attached.forEach(item => {
        const dx = x0 - item.ox, dy = y - item.oy;
        item.p.x = x0; item.p.y = y;
        item.kids.forEach(k => Act.translate(k, dx, dy));
        y += item.p.h + gap + extraY;
      });
    } else if (mode === 'horiz') {
      let x = x0;
      attached.forEach(item => {
        const dx = x - item.ox, dy = y0 - item.oy;
        item.p.x = x; item.p.y = y0;
        item.kids.forEach(k => Act.translate(k, dx, dy));
        x += item.p.w + gap + 24 + extraX;
      });
    } else if (mode === 'spread-ltr' || mode === 'spread-rtl') {
      const rtl = mode === 'spread-rtl';
      let y = y0;
      for (let i = 0; i < attached.length; i += 2) {
        const a = attached[i], b = attached[i + 1];
        const colW = Math.max(a.p.w, b ? b.p.w : 0) + gap + extraX;
        const leftItem = rtl && b ? b : a;
        const rightItem = rtl && b ? a : b;
        const dxL = x0 - leftItem.ox, dyL = y - leftItem.oy;
        leftItem.p.x = x0; leftItem.p.y = y;
        leftItem.kids.forEach(k => Act.translate(k, dxL, dyL));
        if (rightItem) {
          const rx = x0 + colW;
          const dxR = rx - rightItem.ox, dyR = y - rightItem.oy;
          rightItem.p.x = rx; rightItem.p.y = y;
          rightItem.kids.forEach(k => Act.translate(k, dxR, dyR));
        }
        y += Math.max(a.p.h, b ? b.p.h : 0) + gap + extraY;
      }
    }
    D.commit('PDF layout', []);
    R.req();
    Bus.emit('struct');
  };

  /* =====================================================================
     7. FULL PDF PAGE MANAGEMENT (INSERT NOTE INSIDE PDF, ROTATE, REORDER, DELETE)
     ===================================================================== */
  // Extend Study.pagesOf so inserted note pages belonging to a PDF stay interleaved in order!
  const _origPagesOf = Study.pagesOf;
  Study.pagesOf = function (doc) {
    if (!doc) return [];
    if (doc.kind === 'pdf') {
      return D.objs.filter(o => (o.type === 'pdfpage' && o.doc === doc.id) || (o.type === 'frame' && o.pdfDoc === doc.id))
        .sort((a, b) => (a.ord != null ? a.ord : a.pg * 1000) - (b.ord != null ? b.ord : b.pg * 1000));
    }
    return _origPagesOf.call(Study, doc);
  };
  const _origAllPages = Study.allPages;
  Study.allPages = function () {
    return D.objs.filter(o => o.type === 'pdfpage' || (o.type === 'frame' && (o.nb || o.pdfDoc)));
  };
  const _origDocOf = Study.docOf;
  Study.docOf = function (o) {
    if (!o) return null;
    if (o.type === 'frame' && o.pdfDoc) return Study.docs().find(d => d.id === o.pdfDoc);
    return _origDocOf.call(Study, o);
  };

  PDFU.insertNoteInPdf = function (docId, afterObj, tpl = 'lined') {
    const d = Study.doc(docId); if (!d) return;
    const ps = Study.pagesOf(d);
    const idx = ps.indexOf(afterObj);
    const base = afterObj || ps[ps.length - 1]; if (!base) return;
    // Normalize ord across all pages
    ps.forEach((p, i) => { p.ord = (i + 1) * 100; });
    const newOrd = base.ord + 50;
    const f = D.make('frame', {
      x: base.x, y: base.y + base.h + 28, w: base.w, h: base.h,
      name: 'Note page', pdfDoc: docId, ord: newOrd,
      bg: '#ffffff', tpl, tplc: '#aebbd8', tsp: 30, stroke: '#c9ced8'
    });
    D.add(f);
    d.pages = Study.pagesOf(d).length;
    PDFU.applyLayout(docId, PDFU.cfg.layout);
    Study.goto(f);
    UI.toast('Inserted note page inside PDF');
  };

  PDFU.rotatePdfPage = function (o) {
    o.rot90 = ((o.rot90 || 0) + 1) % 4;
    D.commit('Rotate PDF page', o);
    R.req();
    UI.toast('Rotated page 90°');
  };

  PDFU.duplicatePdfPage = function (docId, o) {
    const d = Study.doc(docId); if (!d) return;
    const ps = Study.pagesOf(d);
    ps.forEach((p, i) => { p.ord = (i + 1) * 100; });
    const clone = D.make(o.type, Object.assign({}, JSON.parse(JSON.stringify(o)), { id: U.uid(), ord: o.ord + 50 }));
    delete clone._j;
    D.add(clone);
    d.pages = Study.pagesOf(d).length;
    PDFU.applyLayout(docId, PDFU.cfg.layout);
    Study.goto(clone);
    UI.toast('Duplicated page');
  };

  PDFU.movePdfPage = function (docId, o, dir) {
    const d = Study.doc(docId); if (!d) return;
    const ps = Study.pagesOf(d);
    const i = ps.indexOf(o), j = i + dir;
    if (j < 0 || j >= ps.length) return;
    ps.forEach((p, idx) => { p.ord = (idx + 1) * 100; });
    const tmp = ps[i].ord; ps[i].ord = ps[j].ord; ps[j].ord = tmp;
    PDFU.applyLayout(docId, PDFU.cfg.layout);
  };

  PDFU.deletePdfPage = async function (docId, o) {
    const d = Study.doc(docId); if (!d) return;
    const ps = Study.pagesOf(d);
    if (ps.length < 2) { UI.toast('Document needs at least 1 page'); return; }
    if (!await UI.confirm('Delete this page and annotations on it?', 'Delete', true)) return;
    const kids = Study.NP ? Study.NP.content(o) : [];
    D.remove([o, ...kids]);
    d.pages = Study.pagesOf(d).length;
    PDFU.applyLayout(docId, PDFU.cfg.layout);
    UI.toast('Page deleted');
  };

  // Hook into Study.pageMenu to unlock all page operations for PDFs!
  const _origPageMenu = Study.pageMenu;
  Study.pageMenu = function (d, o, i) {
    const items = _origPageMenu ? _origPageMenu(d, o, i) : [];
    if (d.kind === 'pdf') {
      const ps = Study.pagesOf(d);
      items.push(
        { sep: true },
        { label: 'Insert lined note page after', icon: 'notebook', fn: () => PDFU.insertNoteInPdf(d.id, o, 'lined') },
        { label: 'Insert blank note page after', icon: 'plus', fn: () => PDFU.insertNoteInPdf(d.id, o, 'none') },
        { label: 'Insert grid note page after', icon: 'grid', fn: () => PDFU.insertNoteInPdf(d.id, o, 'grid') },
        { sep: true },
        { label: 'Rotate 90° clockwise', icon: 'rotateR', fn: () => PDFU.rotatePdfPage(o) },
        { label: 'Duplicate page', icon: 'duplicate', fn: () => PDFU.duplicatePdfPage(d.id, o) },
        { label: 'Move up', icon: 'up', disabled: i === 0, fn: () => PDFU.movePdfPage(d.id, o, -1) },
        { label: 'Move down', icon: 'down', disabled: i === ps.length - 1, fn: () => PDFU.movePdfPage(d.id, o, 1) },
        { label: 'Delete page', icon: 'trash', danger: true, fn: () => PDFU.deletePdfPage(d.id, o) }
      );
    }
    return items;
  };

  /* =====================================================================
     8. ZOOM WRITING WINDOW (Goodnotes / Notewise Magnified Writing Box)
     ===================================================================== */
  PDFU.toggleZoomBox = function () {
    const ex = document.getElementById('zoombox');
    if (ex) { ex.remove(); PDFU.zoomBoxOpen = false; PDFU.zb = null; R.reqOv(); return; }
    const c = Study.curPage();
    if (!c) { UI.toast('Open a PDF or notebook page first'); return; }
    PDFU.zoomBoxOpen = true;
    const zb = PDFU.zb = {
      x: c.x + 30, y: c.y + 80, w: Math.min(340, c.w - 60), h: 130,
      drawing: false, pts: []
    };
    const box = U.el('div', { id: 'zoombox', class: 'zoombox' });
    const head = U.el('div', { class: 'zb-head' },
      U.el('b', null, 'Zoom Writing Window'),
      U.el('span', { class: 'sp' }),
      UI.btn('←', null, () => { zb.x = Math.max(c.x, zb.x - zb.w * .7); PDFU.renderZoomBox(); R.reqOv(); }, 'sm'),
      UI.btn('→', null, () => { zb.x = Math.min(c.x + c.w - zb.w, zb.x + zb.w * .7); PDFU.renderZoomBox(); R.reqOv(); }, 'sm'),
      UI.btn('↵ New Line', null, () => { zb.x = c.x + 30; zb.y += zb.h * .85; PDFU.renderZoomBox(); R.reqOv(); }, 'sm'),
      UI.ibtn('close', 'Close Zoom Window', () => PDFU.toggleZoomBox())
    );
    const cv = U.el('canvas', { class: 'zb-cv', width: 960, height: 320 });
    box.append(head, cv);
    document.getElementById('board').append(box);
    zb.cv = cv; zb.ctx = cv.getContext('2d');

    const mapPt = e => {
      const r = cv.getBoundingClientRect();
      const nx = (e.clientX - r.left) / r.width, ny = (e.clientY - r.top) / r.height;
      return [zb.x + nx * zb.w, zb.y + ny * zb.h, e.pressure || .5];
    };
    cv.addEventListener('pointerdown', e => {
      cv.setPointerCapture(e.pointerId);
      zb.drawing = true;
      zb.pts = mapPt(e);
    });
    cv.addEventListener('pointermove', e => {
      if (!zb.drawing) return;
      const p = mapPt(e);
      zb.pts.push(p[0], p[1], p[2]);
      PDFU.renderZoomBox();
    });
    const finishStroke = () => {
      if (!zb.drawing) return;
      zb.drawing = false;
      if (zb.pts.length >= 6) {
        const po = Tools.opts.pen || { pen: 'pen', color: '#1f2430', size: 3 };
        let minX = 1e12, minY = 1e12, maxX = -1e12, maxY = -1e12;
        for (let i = 0; i < zb.pts.length; i += 3) {
          minX = Math.min(minX, zb.pts[i]); minY = Math.min(minY, zb.pts[i + 1]);
          maxX = Math.max(maxX, zb.pts[i]); maxY = Math.max(maxY, zb.pts[i + 1]);
        }
        const rel = [];
        for (let i = 0; i < zb.pts.length; i += 3) rel.push(zb.pts[i] - minX, zb.pts[i + 1] - minY, zb.pts[i + 2]);
        const stroke = D.make('ink', {
          x: minX, y: minY, w: Math.max(2, maxX - minX), h: Math.max(2, maxY - minY),
          pts: rel, pen: po.pen, color: po.color, size: po.size,
          layer: Study.annLayer ? Study.annLayer() : D.active
        });
        D.add(stroke); D.commit('Zoom write', stroke);
        // Auto-advance if writing near right 22% of box
        if (maxX > zb.x + zb.w * .82) {
          if (zb.x + zb.w * 1.45 < c.x + c.w) zb.x += zb.w * .65;
          else { zb.x = c.x + 30; zb.y += zb.h * .85; }
        }
      }
      zb.pts = [];
      R.req(); PDFU.renderZoomBox(); R.reqOv();
    };
    cv.addEventListener('pointerup', finishStroke);
    cv.addEventListener('pointercancel', finishStroke);
    PDFU.renderZoomBox();
    R.reqOv();
  };

  PDFU.renderZoomBox = function () {
    const zb = PDFU.zb; if (!zb || !zb.cv) return;
    const sc = zb.cv.width / zb.w;
    const snap = IO.renderCanvas({ area: { x: zb.x, y: zb.y, w: zb.w, h: zb.h }, all: true, scale: sc, bg: PDFU.cfg.theme === 'dark' ? '#14171f' : '#ffffff', clip: true });
    zb.ctx.clearRect(0, 0, zb.cv.width, zb.cv.height);
    zb.ctx.drawImage(snap, 0, 0, zb.cv.width, zb.cv.height);
    // Draw live stroke preview
    if (zb.drawing && zb.pts.length >= 6) {
      const po = Tools.opts.pen || { color: '#1f2430', size: 3 };
      zb.ctx.save();
      zb.ctx.strokeStyle = po.color;
      zb.ctx.lineWidth = Math.max(2, po.size * sc);
      zb.ctx.lineCap = 'round'; zb.ctx.lineJoin = 'round';
      zb.ctx.beginPath();
      for (let i = 0; i < zb.pts.length; i += 3) {
        const px = (zb.pts[i] - zb.x) * sc, py = (zb.pts[i + 1] - zb.y) * sc;
        i === 0 ? zb.ctx.moveTo(px, py) : zb.ctx.lineTo(px, py);
      }
      zb.ctx.stroke();
      zb.ctx.restore();
    }
    // Auto-advance zone guide
    zb.ctx.save();
    zb.ctx.fillStyle = 'rgba(79,70,229,.08)';
    zb.ctx.fillRect(zb.cv.width * .82, 0, zb.cv.width * .18, zb.cv.height);
    zb.ctx.restore();
  };

  R.overlays.push(ctx => {
    if (!Study.on || !PDFU.zb) return;
    const zb = PDFU.zb;
    const p = R.w2s(zb.x, zb.y), q = R.w2s(zb.x + zb.w, zb.y + zb.h);
    ctx.save();
    ctx.strokeStyle = '#4f46e5'; ctx.lineWidth = 2.5;
    ctx.fillStyle = 'rgba(79,70,229,.09)';
    ctx.fillRect(p[0], p[1], q[0] - p[0], q[1] - p[1]);
    ctx.strokeRect(p[0], p[1], q[0] - p[0], q[1] - p[1]);
    ctx.restore();
  });

  /* =====================================================================
     9. DUAL-PANE SPLIT-SCREEN STUDY MODE (Flexcil / Goodnotes / Notewise)
     ===================================================================== */
  PDFU.toggleSplit = function () {
    const ex = document.getElementById('splitpane');
    if (ex) { ex.remove(); PDFU.splitOpen = false; document.getElementById('stage').style.right = ''; R.resize(); return; }
    PDFU.splitOpen = true;
    const pane = U.el('div', { id: 'splitpane', class: 'splitpane' });
    const resizer = U.el('div', { class: 'split-resizer', title: 'Drag to resize' });
    const noteKey = 'ib.splitnote.' + (D.id || 'default');
    const ta = U.el('textarea', {
      class: 'split-editor',
      placeholder: 'Split Study Notes (Flexcil-style)…\n• Write summaries side-by-side\n• Click "Pull Highlights" to import all PDF highlights with page citations\n• Supports Arabic RTL & English automatically',
      value: localStorage.getItem(noteKey) || '',
      onkeydown: e => e.stopPropagation(),
      oninput: e => localStorage.setItem(noteKey, e.target.value)
    });
    const head = U.el('div', { class: 'split-head' },
      U.el('b', null, 'Split Study Note'),
      U.el('span', { class: 'sp' }),
      UI.btn('Pull Highlights', 'quote', () => {
        const hls = D.objs.filter(o => o.type === 'hl' && (o.text || o.note));
        if (!hls.length) { UI.toast('No highlights yet'); return; }
        const block = hls.map(h => `• [p.${h.pg}] "${(h.text || '').trim()}"${h.note ? ' — ' + h.note : ''}`).join('\n');
        ta.value = (ta.value ? ta.value + '\n\n' : '') + '--- Imported Highlights ---\n' + block;
        localStorage.setItem(noteKey, ta.value);
        UI.toast(`Imported ${hls.length} highlights`);
      }, 'sm'),
      UI.btn('RTL/LTR', null, () => { ta.dir = ta.dir === 'rtl' ? 'ltr' : 'rtl'; }, 'sm'),
      UI.ibtn('close', 'Close Split View', () => PDFU.toggleSplit())
    );
    pane.append(resizer, head, ta);
    document.getElementById('board').append(pane);
    const setW = w => {
      const cw = U.clamp(w, 240, Math.round(innerWidth * .62));
      pane.style.width = cw + 'px';
      document.getElementById('stage').style.right = cw + 'px';
      R.resize();
    };
    setW(Math.min(420, Math.round(innerWidth * .38)));
    resizer.addEventListener('pointerdown', e => {
      resizer.setPointerCapture(e.pointerId);
      const mv = ev => setW(innerWidth - ev.clientX);
      const up = () => { resizer.removeEventListener('pointermove', mv); resizer.removeEventListener('pointerup', up); };
      resizer.addEventListener('pointermove', mv);
      resizer.addEventListener('pointerup', up);
    });
  };

  /* =====================================================================
     10. FLASHCARDS ACTIVE RECALL REVIEW (Goodnotes / Flexcil)
     ===================================================================== */
  PDFU.openFlashcards = function () {
    const cards = [];
    D.objs.forEach(o => {
      if (o.type === 'hl' && (o.text || o.note)) {
        cards.push({ front: o.note || ('Highlight · Page ' + o.pg), back: o.text || '(Area highlight)', pg: o.pg, obj: o });
      } else if (o.type === 'tape') {
        cards.push({ front: 'Study Tape Clue', back: o.label || '(Tap Jump to view on page)', pg: 0, obj: o });
      }
    });
    if (!cards.length) {
      UI.toast('Add Highlights with notes or Study Tape strips to generate Flashcards!', 3500);
      return;
    }
    let idx = 0, flipped = false;
    const body = U.el('div', { class: 'fc-wrap' });
    const render = () => {
      const c = cards[idx];
      body.innerHTML = '';
      const cardEl = U.el('div', { class: 'fc-card' + (flipped ? ' flipped' : ''), onclick: () => { flipped = !flipped; render(); } },
        U.el('small', null, flipped ? 'ANSWER / EXCERPT' : `QUESTION / PROMPT (${idx + 1} / ${cards.length})`),
        U.el('div', { class: 'fc-txt' }, flipped ? c.back : c.front),
        U.el('small', { class: 'fc-hint' }, 'Tap card to flip')
      );
      const nav = U.el('div', { class: 'btnrow', style: 'justify-content:center;margin-top:12px' },
        UI.btn('Previous', null, () => { idx = (idx - 1 + cards.length) % cards.length; flipped = false; render(); }, 'sm'),
        UI.btn('Jump to source', 'pointer', () => { Study.jumpSrc && Study.jumpSrc(c.obj); }, 'sm'),
        UI.btn('Next', null, () => { idx = (idx + 1) % cards.length; flipped = false; render(); }, 'sm primary')
      );
      body.append(cardEl, nav);
    };
    render();
    UI.modal({ title: 'Active Recall Flashcards', body, width: 500, buttons: [{ label: 'Close', primary: true }] });
  };

  /* =====================================================================
     11. PDF PRO SETTINGS POPOVER & STUDY TOOLBAR INTEGRATION
     ===================================================================== */
  PDFU.openReaderModal = function () {
    const c = Study.curPage(), d = c && Study.docOf(c);
    const cfg = PDFU.cfg;
    const body = U.el('div', { class: 'pdfu-modal' });

    body.append(
      U.el('div', { class: 'psec' }, 'Reading & Eye-Care Theme (Notein / Jnotes)'),
      UI.seg([['orig', 'Original'], ['sepia', 'Sepia'], ['green', 'Eye-Care'], ['dark', 'Smart Dark']], cfg.theme, v => {
        cfg.theme = v; PDFU.saveCfg(); R.req();
      }),

      U.el('div', { class: 'psec' }, 'Page Layout Mode (Flexcil / Goodnotes)'),
      UI.seg([['single', 'Vertical'], ['spread-ltr', '2-Page LTR'], ['spread-rtl', '2-Page RTL عربي'], ['horiz', 'Horizontal']], cfg.layout, v => {
        cfg.layout = v; PDFU.saveCfg();
        if (d) PDFU.applyLayout(d.id, v);
      }),

      U.el('div', { class: 'psec' }, 'Margin Expansion for Side Notes (Notein / Jnotes)'),
      UI.seg([['none', 'Off'], ['right', 'Right'], ['left', 'Left'], ['both', 'Both'], ['bottom', 'Bottom']], cfg.marginSide, v => {
        cfg.marginSide = v; PDFU.saveCfg();
        if (d) PDFU.applyLayout(d.id, cfg.layout); else R.req();
      }),
      UI.field('Margin pattern', UI.seg([['blank', 'Blank'], ['lined', 'Lined'], ['grid', 'Grid'], ['dots', 'Dots']], cfg.marginTpl, v => {
        cfg.marginTpl = v; PDFU.saveCfg(); R.req();
      })),
      UI.field('Margin width', UI.range(160, 520, 20, cfg.marginSize, v => {
        cfg.marginSize = v; PDFU.saveCfg(); R.req();
      }, { fmt: v => v + ' px' })),

      U.el('div', { class: 'psec' }, 'Auto-Crop White Margins & Interactive Layer'),
      UI.field('Crop white margins', UI.range(0, 16, 1, Math.round(cfg.crop * 100), v => {
        cfg.crop = v / 100; PDFU.saveCfg(); R.req();
      }, { fmt: v => v + '%' })),
      UI.toggle('Clickable PDF internal links & footnotes', cfg.showLinks, v => { cfg.showLinks = v; PDFU.saveCfg(); R.req(); }),
      UI.toggle('Arabic / RTL smart text selection', cfg.rtlSelect, v => { cfg.rtlSelect = v; PDFU.saveCfg(); }),
      UI.toggle('Reveal all Study Tape strips', cfg.tapeRevealAll, v => { cfg.tapeRevealAll = v; PDFU.saveCfg(); R.req(); })
    );

    UI.modal({ title: 'PDF Reader Pro Settings', body, width: 520, buttons: [{ label: 'Done', primary: true }] });
  };

  // Inject Study Ultra tools into Study toolbar & topbar
  const _origEnter = Study.enter;
  Study.enter = function () {
    _origEnter.call(Study);
    const bar = U.$('#toolbar');
    if (bar && !bar.querySelector('.pdfu-btn')) {
      const mk = (title, ic, fn, toolId) => {
        const b = U.el('button', { class: 'tbtn study-only pdfu-btn', title, html: U.icon(ic, 22), 'data-pdfu': toolId || '' });
        b.addEventListener('click', fn);
        return b;
      };
      const und = TB.btns.undo;
      const tapeBtn = mk('Study Tape — Active Recall Masking (Goodnotes/Notewise)', 'tape', () => { Tools.set('tape'); }, 'tape');
      const zbBtn = mk('Zoom Writing Window (Goodnotes/Notewise)', 'zoombox', () => PDFU.toggleZoomBox());
      const spBtn = mk('Split-Screen Study View (Flexcil)', 'split', () => PDFU.toggleSplit());
      const rdBtn = mk('PDF Reader Pro: Dark Mode, 2-Page, Margins, Auto-Crop', 'spread', () => PDFU.openReaderModal());
      const fcBtn = mk('Active Recall Flashcards', 'cards', () => PDFU.openFlashcards());
      [tapeBtn, zbBtn, spBtn, rdBtn, fcBtn].forEach(b => bar.insertBefore(b, und || null));
      Bus.on('tool', () => { tapeBtn.classList.toggle('on', Tools.tool === 'tape'); });
    }
    // Prefetch around current page when view changes
    Bus.on('view', () => {
      if (!Study.on) return;
      const c = Study.curPage();
      if (c && c.type === 'pdfpage') PDFU.prefetchAround(c.doc, c.pg, Math.min(2, D.view.z));
    });
  };

  const _origLeave = Study.leave;
  Study.leave = function () {
    const zb = document.getElementById('zoombox'); if (zb) zb.remove();
    const sp = document.getElementById('splitpane'); if (sp) { sp.remove(); document.getElementById('stage').style.right = ''; }
    PDFU.zb = null; PDFU.zoomBoxOpen = false; PDFU.splitOpen = false;
    _origLeave.call(Study);
  };
})();
