'use strict';
/* ===== PDF & Notes UI: page bar, documents / research / search panels, notebook dialogs ===== */
Object.assign(Study, {
  sel: null, tabSel: 'pages', rf: { type: 'all', color: '', doc: '', q: '' },
  enter() {
    if (Study.on) return; Study.on = true; document.getElementById('app').classList.add('study');
    // toolbar tools
    const bar = U.$('#toolbar'), sep = bar.querySelector('.tsep');
    [['hilite', 'Highlight text (U)', 'hl'], ['clip', 'Clip a region & link it (O)', 'clip']].forEach(([id, title, ic]) => {
      const b = U.el('button', { class: 'tbtn study-only', title, 'data-tool': id, html: U.icon(ic, 22) + '<i class="corner"></i>' }); b.addEventListener('click', () => TB.click(id, b)); b.addEventListener('contextmenu', e => { e.preventDefault(); TB.fly(id, b); }); TB.btns[id] = b; bar.insertBefore(b, TB.btns.pen || sep);
    });
    Study._tabs0 = Panels.tabs.slice(); Panels.tabs = [['docs', 'Documents', 'book'], ['research', 'Research', 'sources'], ['find', 'Search', 'find'], ['design', 'Properties', 'settings'], ['history', 'History', 'history']];
    if (!D.docs0) { D.bg = D.bg === '#ffffff' ? '#e8ebf1' : D.bg; D.grid.type = 'none'; }
    Study.buildTop(); Study._board0 = Menus.board; Menus.board = () => Study.menuItems();
    Panels.ext = { docs: b => Study.docsPanel(b), research: b => Study.researchPanel(b), find: b => Study.searchPanel(b) };
    Menus._add = Menus.add; Menus.add = () => [{ header: 'PDF & notes' }, { label: 'Open PDF…', icon: 'pdf', fn: async () => { const f = await IO.pick('application/pdf,.pdf', true); for (const x of f) await Study.addPdf(x); } }, { label: 'New notebook…', icon: 'notebook', fn: () => Study.notebookDialog() }, { label: 'Add notebook page', icon: 'plus', fn: () => { const c = Study.curPage(); const d = c && Study.docOf(c); if (d && d.kind === 'note') Study.addNotePage(d.id, 1, c); else { const n = Study.docs().find(x => x.kind === 'note'); n ? Study.addNotePage(n.id) : Study.notebookDialog(); } } }, { sep: true }, ...Menus._add()];
    Study.mkBar(); Study.syncBar(); Study.syncTabs(); Study.ensureLayers();
    Bus.on('view', Study.syncBarD); Bus.on('struct', Study.syncBarD); Bus.on('index', () => { if (Panels.tab === 'find' && Study.q) Panels.render(); });
    if (innerWidth > 1150 && Study.docs().length) Panels.show('docs');
  },
  leave() {
    if (!Study.on) return; Study.on = false; document.getElementById('app').classList.remove('study'); U.$$('.study-only').forEach(e => e.remove()); delete TB.btns.hilite; delete TB.btns.clip;
    if (Study._tabs0) Panels.tabs = Study._tabs0; Panels.ext = {}; if (Study._board0) { Menus.board = Study._board0; Study._board0 = null; } TB.top(); U.$('#boardname').value = D.name; if (Menus._add) { Menus.add = Menus._add; Menus._add = null; }
    const b = U.$('#pagebar'); b && b.remove(); Bus.off && (Bus.off('view', Study.syncBarD), Bus.off('struct', Study.syncBarD)); PDFS.reset(); Study.sel = null; Study.flash = null;
  },
  /* ---- top bar (study) ---- */
  buildTop() {
    const t = U.$('#topbar'); t.innerHTML = ''; Study.tabsEl = U.el('div', { class: 'dtabs' });
    t.append(UI.ibtn('home', 'Library', () => App.close()), U.el('input', { id: 'boardname', value: D.name, style: 'display:none' }), Study.tabsEl, UI.ibtn('plus', 'Open PDF or new notebook', e => UI.menu(e.currentTarget, [{ label: 'Open PDF…', icon: 'pdf', fn: async () => { const f = await IO.pick('application/pdf,.pdf', true); for (const x of f) await Study.addPdf(x); } }, { label: 'New notebook…', icon: 'notebook', fn: () => Study.notebookDialog() }, { label: 'Add notebook page', icon: 'plus', fn: () => { const c = Study.curPage(), d = c && Study.docOf(c); if (d && d.kind === 'note') Study.addNotePage(d.id, 1, c); else UI.toast('Open a notebook page first'); } }], { side: 'bottom' })), U.el('span', { class: 'sp' }), U.el('span', { id: 'savestate', class: 'savestate' }, 'Saved'),
      UI.ibtn('find', 'Search (Ctrl+F)', () => Panels.toggle('find')), UI.ibtn('book', 'Pages & outline', () => Panels.toggle('docs')), UI.ibtn('sources', 'Research: highlights & clips', () => Panels.toggle('research')), UI.ibtn('settings', 'Properties', () => Panels.toggle('design')), UI.ibtn('download', 'Export', () => { const c = Study.curPage(), d = c && Study.docOf(c); d ? Study.exportPdf(d.id) : UI.toast('Nothing to export yet'); }), UI.ibtn('menu', 'Menu', e => UI.menu(e.currentTarget, Study.menuItems(), { side: 'bottom', align: 'end' })));
    const sv = U.$('#savestate'); Bus.on('saved', s => { if (sv.isConnected) { sv.textContent = s === 'saving' ? 'Saving…' : 'Saved'; sv.classList.toggle('busy', s === 'saving'); } });
  },
  syncTabs() {
    const el = Study.tabsEl; if (!el || !el.isConnected) return; const cur = Study.curPage(), cd = cur && Study.docOf(cur); el.innerHTML = '';
    Study.docs().forEach(d => { const b = U.el('button', { class: 'dtab' + (cd && cd.id === d.id ? ' on' : ''), title: d.name, onclick: () => { const ps = Study.pagesOf(d); if (cd && cd.id === d.id) Study.goto(cur); else Study.goto((Study.last && Study.last[d.id]) || ps[0]); }, oncontextmenu: e => { e.preventDefault(); UI.menu(e.currentTarget, Study.docMenuItems(d), { side: 'bottom' }); } }, U.el('span', { html: U.icon(d.kind === 'pdf' ? 'pdf' : 'notebook', 15) }), U.el('span', { class: 'dtn' }, d.name)); if (cd && cd.id === d.id) b.append(UI.ibtn('more', 'Document options', e => { e.stopPropagation(); UI.menu(e.currentTarget, Study.docMenuItems(d), { side: 'bottom' }); })); el.append(b); });
    if (!Study.docs().length) el.append(U.el('span', { class: 'dtn', style: 'padding:0 12px;color:var(--tx2)' }, 'Open a PDF or create a notebook with +'));
    const on = el.querySelector('.on'); on && on.scrollIntoView({ inline: 'nearest', block: 'nearest' });
  },
  menuItems() {
    return [{ label: 'Rename space…', icon: 'text', fn: async () => { const v = await UI.prompt('Name', D.name); if (v) { D.name = v; U.$('#boardname').value = v; D.queueSave(); UI.toast('Renamed'); } } }, { label: 'Open PDF…', icon: 'pdf', fn: async () => { const f = await IO.pick('application/pdf,.pdf', true); for (const x of f) await Study.addPdf(x); } }, { label: 'New notebook…', icon: 'notebook', fn: () => Study.notebookDialog() }, { sep: true },
      { label: 'Export current document as PDF', icon: 'download', fn: () => { const c = Study.curPage(), d = c && Study.docOf(c); d && Study.exportPdf(d.id); } }, { label: 'Export notes (Markdown)', icon: 'file', fn: () => Study.exportMd(Study.researchItems()) }, { label: 'Duplicate space', icon: 'duplicate', fn: () => App.duplicate() }, { label: 'Save version', icon: 'save', fn: async () => { await D.saveVersion('Version ' + new Date().toLocaleTimeString()); UI.toast('Version saved'); } }, { label: 'History', icon: 'history', fn: () => Panels.show('history') }, { sep: true },
      { label: 'Page colour', icon: 'palette', sub: () => ['#e8ebf1', '#f4f1ea', '#ffffff', '#1b1e26'].map(c => ({ label: c, swatch: c, checked: D.bg === c, fn: () => { D.bg = c; D.commit('Background', []); R.req(); } })) }, { label: 'Keyboard shortcuts', icon: 'keyboard', fn: () => App.shortcuts() }, { label: 'Settings', icon: 'settings', fn: () => App.settings() }, { sep: true }, { label: 'Delete this space', icon: 'trash', danger: true, fn: () => App.removeCurrent() }, { label: 'Library', icon: 'home', fn: () => App.close() }];
  },
  /* ---- page bar ---- */
  mkBar() {
    U.$('#pagebar') && U.$('#pagebar').remove(); const bar = U.el('div', { id: 'pagebar' }); U.$('#stage').append(bar); Study.bar = bar;
  },
  syncBarD: U.debounce(() => Study.syncBar(), 90),
  syncBar() {
    const bar = Study.bar; if (!bar || !Study.on) return; bar.innerHTML = ''; const cur = Study.curPage(); if (!cur) { bar.style.display = 'none'; Study.syncTabs(); return; } bar.style.display = '';
    const d = Study.docOf(cur), ps = Study.pagesOf(d), no = ps.indexOf(cur) + 1; (Study.last = Study.last || {})[d.id] = cur; if (d) Study.sel = d.id; Study.syncTabs(); if (cur.type === 'pdfpage') { PDFS.text(cur.doc, cur.pg).catch(() => { }); const nx = ps[ps.indexOf(cur) + 1]; nx && PDFS.text(nx.doc, nx.pg).catch(() => { }); }
    const inp = U.el('input', { class: 'pgin', value: no, inputmode: 'numeric', onkeydown: e => { e.stopPropagation(); if (e.key === 'Enter') { const p = ps[U.clamp((parseInt(inp.value) || 1) - 1, 0, ps.length - 1)]; Study.goto(p); inp.blur(); } }, onfocus: e => e.target.select() });
    const isBm = (D.extra.bm || []).some(b => b.doc === d.id && b.pg === no);
    bar.append(UI.ibtn('chevL', 'Previous page (PageUp)', () => Study.step(-1)), U.el('button', { class: 'pgdoc', title: 'Switch document', onclick: e => UI.menu(e.currentTarget, Study.docs().map(x => ({ label: x.name, icon: x.kind === 'pdf' ? 'pdf' : 'notebook', checked: x.id === d.id, fn: () => { const p = Study.pagesOf(x)[0]; Study.goto(p); } })), { side: 'top' }) }, U.el('span', { html: U.icon(d.kind === 'pdf' ? 'pdf' : 'notebook', 16) }), d.name), inp, U.el('span', { class: 'pgof' }, '/ ' + ps.length), UI.ibtn('chevR', 'Next page (PageDown)', () => Study.step(1)),
      UI.ibtn('expand', 'Fit page width', () => Study.goto(cur)), UI.ibtn('bookmark', isBm ? 'Remove bookmark' : 'Bookmark this page', () => { Study.toggleBm(d.id, no); }));
    if (isBm) bar.querySelector('[title^="Remove bookmark"]').classList.add('on');
  },
  toggleBm(doc, pg) { const l = (D.extra.bm = D.extra.bm || []); const i = l.findIndex(b => b.doc === doc && b.pg === pg); if (i >= 0) l.splice(i, 1); else l.push({ id: U.uid(), doc, pg, label: '', t: Date.now() }); D.commit('Bookmark', []); Study.syncBar(); if (Panels.tab === 'docs') Panels.render(); },
  key(K, e) {
    if (!Study.on) return false;
    if (K === 'u') { Tools.set('hilite'); return true; } if (K === 'o') { Tools.set('clip'); return true; }
    if (e.key === 'PageDown') { Study.step(1); return true; } if (e.key === 'PageUp') { Study.step(-1); return true; }
    if (e.key === 'Home' && !Sel.ids.length) { const c = Study.curPage(); const p = c && Study.pagesOf(Study.docOf(c))[0]; Study.goto(p); return true; }
    if (e.key === 'End' && !Sel.ids.length) { const c = Study.curPage(), ps = c && Study.pagesOf(Study.docOf(c)); ps && Study.goto(ps[ps.length - 1]); return true; }
    return false;
  },
  /* ---- notebook dialog ---- */
  notebookDialog() {
    const S = { name: 'Notebook ' + (Study.docs().filter(d => d.kind === 'note').length + 1), size: 0, tpl: Study.o.tpl || 'lined', bg: '#ffffff', pages: 5, tplc: '#aebbd8' };
    const tpls = [['blank', 'Blank'], ['lined', 'Lined'], ['grid', 'Grid'], ['dots', 'Dotted'], ['cornell', 'Cornell'], ['music', 'Music'], ['isometric', 'Isometric']], papers = [['#ffffff', '#aebbd8'], ['#fffaf0', '#d9c9a8'], ['#fff9c4', '#d6c875'], ['#eef7ee', '#a8c9a8'], ['#eef3ff', '#aebbd8'], ['#1f2430', '#4b5470']];
    const grid = U.el('div', { class: 'tplgrid' }); const draw = () => {
      grid.innerHTML = ''; tpls.forEach(([k, l]) => { const cv = U.el('canvas', { width: 90, height: 120 }), c = cv.getContext('2d'); c.fillStyle = S.bg; c.fillRect(0, 0, 90, 120); Paper.draw(c, { w: 90, h: 120, tsp: 11, tplc: S.tplc, tpl: k }, { z: 1 }); grid.append(U.el('button', { class: 'tplb' + (S.tpl === k ? ' on' : ''), onclick: () => { S.tpl = k; draw(); } }, cv, U.el('small', null, l))); });
    }; draw();
    const pap = U.el('div', { class: 'swatches' }); papers.forEach(([bg, lc]) => pap.append(U.el('button', { class: 'sw', style: 'background:' + bg, onclick: e => { S.bg = bg; S.tplc = lc; U.$$('.sw', pap).forEach(x => x.classList.remove('sel')); e.currentTarget.classList.add('sel'); draw(); } })));
    const body = U.el('div', null, UI.field('Name', U.el('input', { class: 'inp', value: S.name, oninput: e => S.name = e.target.value, onkeydown: e => e.stopPropagation() })), UI.field('Page size', UI.select(Study.PAGE_SIZES.map((p, i) => [i, p[0]]), S.size, v => S.size = +v)), UI.field('Paper', pap), U.el('div', { class: 'lbl' }, 'Page template'), grid, UI.field('Pages', UI.range(1, 50, 1, S.pages, v => S.pages = v)));
    UI.modal({ title: 'New notebook', body, width: 500, cls: 'tall', buttons: [{ label: 'Cancel' }, { label: 'Create', primary: true, fn: () => { Study.o.tpl = S.tpl; Study.save(); Study.newNotebook({ name: S.name.trim() || 'Notebook', size: Study.PAGE_SIZES[S.size], tpl: S.tpl, bg: S.bg, tplc: S.tplc, pages: S.pages }); } }] });
  },
  detailsDialog(d) {
    const m = d.meta || (d.meta = {}), f = (l, k, ph) => UI.field(l, U.el('input', { class: 'inp', value: m[k] || '', placeholder: ph || '', oninput: e => m[k] = e.target.value, onkeydown: e => e.stopPropagation() }));
    const body = U.el('div', null, UI.field('Display name', U.el('input', { class: 'inp', value: d.name, oninput: e => d.name = e.target.value, onkeydown: e => e.stopPropagation() })), f('Title', 'title'), f('Author(s)', 'author'), U.el('div', { class: 'grid2' }, f('Year', 'year'), f('Publisher / journal', 'publisher')), f('URL / DOI', 'url'), f('Tags (comma separated)', 'tags', 'e.g. biology, exam'));
    UI.modal({ title: 'Source details', body, width: 460, buttons: [{ label: 'Close', primary: true, fn: () => { D.commit('Source details', []); Study.syncBar(); Panels.tab && Panels.render(); } }] });
  },
  cite(d) { const m = d.meta || {}; return `${m.author || 'Unknown author'}${m.year ? ' (' + m.year + ')' : ''}. ${m.title || d.name}.${m.publisher ? ' ' + m.publisher + '.' : ''}${m.url ? ' ' + m.url : ''}`; },
  /* ---- documents panel ---- */
  docsPanel(root) {
    root.append(U.el('div', { class: 'btnrow' }, UI.btn('Open PDF', 'pdf', async () => { const f = await IO.pick('application/pdf,.pdf', true); for (const x of f) await Study.addPdf(x); }, 'sm primary'), UI.btn('New notebook', 'notebook', () => Study.notebookDialog(), 'sm')));
    const docs = Study.docs(); const cur = Study.curPage(); const curDoc = cur && Study.docOf(cur);
    if (!docs.length) { root.append(U.el('div', { class: 'hint' }, 'Open a PDF or create a notebook. You can open several PDFs in the same space, clip parts between them and keep everything linked. You can also drop PDF files onto the board.')); return; }
    const list = U.el('div', { class: 'dlist' });
    docs.forEach(d => {
      const m = d.meta || {}, row = U.el('div', { class: 'drow' + (curDoc && curDoc.id === d.id ? ' on' : ''), onclick: () => { Study.sel = d.id; Study.goto(Study.pagesOf(d)[0]); Panels.render(); } }, U.el('span', { class: 'dic', style: d.kind === 'note' ? `background:${d.color || '#4f46e5'}` : '', html: U.icon(d.kind === 'pdf' ? 'pdf' : 'notebook', 20) }), U.el('div', { class: 'dinfo' }, U.el('b', null, d.name), U.el('small', null, `${d.pages} page${d.pages === 1 ? '' : 's'}${m.author ? ' · ' + m.author : ''}${m.year ? ' · ' + m.year : ''}`), m.tags ? U.el('small', { class: 'dtags' }, m.tags) : null),
        UI.ibtn('more', 'Options', e => {
          e.stopPropagation(); UI.menu(e.currentTarget, Study.docMenuItems(d), { side: 'bottom', align: 'end' });
        })); list.append(row);
    });
    root.append(list);
    const d = Study.doc(Study.sel) || curDoc || docs[0]; if (!d) return; root.append(U.el('div', { class: 'psec' }, d.name), UI.seg([['pages', 'Pages'], ...(d.kind === 'pdf' ? [['outline', 'Outline']] : []), ['bm', 'Bookmarks']], Study.tabSel === 'outline' && d.kind !== 'pdf' ? 'pages' : Study.tabSel, v => { Study.tabSel = v; Panels.render(); }));
    const box = U.el('div', { class: 'dbox' }); root.append(box);
    if (Study.tabSel === 'pages' || (Study.tabSel === 'outline' && d.kind !== 'pdf')) Study.thumbs(box, d); else if (Study.tabSel === 'outline') Study.outlineList(box, d); else Study.bmList(box, d);
  },
  docMenuItems(d) { const docs = Study.docs(); return [{ label: 'Go to start', icon: 'pointer', fn: () => Study.goto(Study.pagesOf(d)[0]) }, { label: 'Details & citation…', icon: 'info', fn: () => Study.detailsDialog(d) }, { label: 'Insert citation on board', icon: 'quote', fn: () => { const [cx, cy] = Act.center(); const t = D.make('text', { text: Study.cite(d), x: cx - 200, y: cy, w: 400, fs: 16, layer: Study.annLayer() }); t.h = t.fs * Txt.LH + 8; Act.insert(t, 'Insert citation'); } },
            { label: 'Show side by side with…', icon: 'layers', sub: () => docs.filter(x => x.id !== d.id).map(x => ({ label: x.name, fn: () => Study.together(d, x) })) }, d.kind === 'note' ? { label: 'Add page', icon: 'plus', fn: () => { const c = Study.curPage(); Study.addNotePage(d.id, 1, c && c.nb === d.id ? c : undefined); } } : null,
            { label: 'Export as PDF' + (d.kind === 'pdf' ? ' (with annotations)' : ''), icon: 'download', fn: () => Study.exportPdf(d.id) }, { sep: true }, { label: 'Remove from space', icon: 'trash', danger: true, fn: () => Study.removeDoc(d.id) }].filter(Boolean); },
  together(a, b) {
    const pa = Study.curOf(a), pb = Study.curOf(b); const u = G.union([pa, pb]); R.fitRect(u, 40); Study.free = true; UI.toast('Showing “' + a.name + '” and “' + b.name + '” together');
  },
  curOf(d) { const c = Study.curPage(); const ps = Study.pagesOf(d); return c && ps.includes(c) ? c : ps[0]; },
  thumbs(box, d) {
    const grid = U.el('div', { class: 'thgrid' }); box.append(grid); const ps = Study.pagesOf(d), cur = Study.curPage();
    const io = new IntersectionObserver(es => es.forEach(en => { if (!en.isIntersecting) return; io.unobserve(en.target); const i = +en.target.dataset.i, o = ps[i], cv = en.target.querySelector('canvas'); Study.thumb(o, cv); }), { root: box.closest('.pscroll'), rootMargin: '200px' });
    ps.forEach((o, i) => { const w = 120, h = Math.round(w * o.h / o.w), cv = U.el('canvas', { width: w * 2 > 240 ? 240 : w * 2, height: Math.round((w * 2 > 240 ? 240 : w * 2) * o.h / o.w), style: `width:${w}px;height:${h}px` }); const t = U.el('div', { class: 'th' + (o === cur ? ' on' : ''), 'data-i': i, onclick: () => Study.goto(o), oncontextmenu: e => { e.preventDefault(); } }, cv, U.el('small', null, i + 1)); grid.append(t); io.observe(t); });
    if (d.kind === 'note') box.append(UI.btn('Add page at end', 'plus', () => Study.addNotePage(d.id), 'sm'));
    setTimeout(() => { const on = grid.querySelector('.on'); on && on.scrollIntoView({ block: 'nearest' }); }, 30);
  },
  async thumb(o, cv) {
    const c = cv.getContext('2d'); c.fillStyle = '#fff'; c.fillRect(0, 0, cv.width, cv.height);
    try {
      if (o.type === 'pdfpage') { const page = await PDFS.page(o.doc, o.pg), vp = page.getViewport({ scale: cv.width / o.pw }); await page.render({ canvasContext: c, viewport: vp }).promise; }
      else { const t = IO.renderCanvas({ area: { x: o.x, y: o.y, w: o.w, h: o.h }, all: true, frame: o, scale: cv.width / o.w, bg: o.bg, clip: true }); c.drawImage(t, 0, 0, cv.width, cv.height); }
    } catch (e) { }
  },
  outlineList(box, d) {
    box.append(U.el('div', { class: 'hint' }, 'Loading outline…')); Study.outline(d.id).then(ol => {
      box.innerHTML = ''; if (!ol.length) { box.append(U.el('div', { class: 'hint' }, 'This PDF has no outline (table of contents).')); return; }
      const draw = (items, host, lvl) => items.forEach(it => { const r = U.el('div', { class: 'orow', style: `padding-left:${8 + lvl * 14}px`, onclick: async () => { const pg = await Study.destPage(d.id, it.dest); if (pg) Study.gotoPage(d.id, pg); } }, it.title || '(untitled)'); host.append(r); if (it.items && it.items.length) draw(it.items, host, lvl + 1); }); draw(ol, box, 0);
    }).catch(() => { box.innerHTML = ''; box.append(U.el('div', { class: 'hint' }, 'Could not read the outline.')); });
  },
  bmList(box, d) {
    const cur = Study.curPage(), no = cur ? Study.pageNo(cur) : 1; box.append(UI.btn('Bookmark page ' + no, 'bookmark', () => Study.toggleBm(d.id, no), 'sm'));
    (D.extra.bm || []).filter(b => b.doc === d.id).sort((a, b) => a.pg - b.pg).forEach(b => box.append(U.el('div', { class: 'orow bm', onclick: () => Study.gotoPage(d.id, b.pg) }, U.el('span', { html: U.icon('bookmark', 14) }), 'Page ' + b.pg, U.el('span', { class: 'sp' }), UI.ibtn('close', 'Remove', e => { e.stopPropagation(); Study.toggleBm(d.id, b.pg); }))));
    if (!(D.extra.bm || []).some(b => b.doc === d.id)) box.append(U.el('div', { class: 'hint' }, 'No bookmarks yet.'));
  },
  /* ---- research panel ---- */
  researchItems() {
    const f = Study.rf, order = new Map(Study.docs().map((d, i) => [d.id, i])); let l = D.objs.filter(o => o.type === 'hl' || (o.type === 'image' && o.src));
    if (f.type === 'hl') l = l.filter(o => o.type === 'hl'); if (f.type === 'clip') l = l.filter(o => o.type === 'image'); if (f.color) l = l.filter(o => o.color === f.color); if (f.doc) l = l.filter(o => o.doc === f.doc);
    if (f.q) { const q = f.q.toLowerCase(); l = l.filter(o => [(o.text || ''), (o.note || ''), (o.name || '')].some(s => s.toLowerCase().includes(q))); }
    return l.sort((a, b) => (order.get(a.doc) ?? 99) - (order.get(b.doc) ?? 99) || ((a.pg || (a.src && a.src.pg) || 0) - (b.pg || (b.src && b.src.pg) || 0)) || a.y - b.y);
  },
  researchPanel(root) {
    const f = Study.rf, items = Study.researchItems();
    const q = U.el('input', { class: 'inp', type: 'search', placeholder: 'Filter notes…', value: f.q, oninput: e => { f.q = e.target.value; clearTimeout(Study._rt); Study._rt = setTimeout(() => { Panels.render(); const i = U.$('#panel .inp[type=search]'); i && (i.focus(), i.setSelectionRange(99, 99)); }, 250); }, onkeydown: e => e.stopPropagation() });
    root.append(q, UI.seg([['all', 'All'], ['hl', 'Highlights'], ['clip', 'Clips']], f.type, v => { f.type = v; Panels.render(); }));
    const cs = U.el('div', { class: 'swatches' }); [''].concat(Study.HL_COLORS).forEach(c => cs.append(U.el('button', { class: 'sw' + (c === f.color ? ' sel' : '') + (c ? '' : ' none'), style: c ? 'background:' + c : '', title: c ? 'Filter by colour' : 'All colours', onclick: () => { f.color = c; Panels.render(); } }))); root.append(cs);
    if (Study.docs().length > 1) root.append(UI.select([['', 'All documents'], ...Study.docs().map(d => [d.id, d.name])], f.doc, v => { f.doc = v; Panels.render(); }));
    root.append(U.el('div', { class: 'btnrow' }, UI.btn('Export notes (.md)', 'download', () => Study.exportMd(items), 'sm'), UI.btn('Link 2 selected', 'connector', () => Study.linkSel(), 'sm')));
    if (!items.length) { root.append(U.el('div', { class: 'hint' }, 'No highlights or clips yet. Use the highlighter (U) on PDF text, or the clip tool (O) to cut out a region and keep it linked to its source.')); return; }
    let last = null;
    items.forEach(o => {
      if (o.doc !== last) { last = o.doc; const d = Study.doc(o.doc); root.append(U.el('div', { class: 'psec' }, d ? d.name : 'Other')); }
      const pg = o.pg || (o.src && o.src.pg) || '';
      const row = U.el('div', { class: 'rrow' + (Sel.has(o.id) ? ' on' : '') }, U.el('div', { class: 'rbar', style: 'background:' + (o.color || o.bc || '#4f46e5') }),
        U.el('div', { class: 'rmain' }, o.type === 'hl' ? U.el('div', { class: 'rtxt', onclick: () => { Sel.set([o.id]); Study.jumpSrc(o); } }, o.text || '(area highlight)') : U.el('img', { class: 'rimg', src: AS.url(o.asset), onclick: () => { Sel.set([o.id]); R.fitRect(G.aabb(o), 120, true, 1.4); } }),
          U.el('textarea', { class: 'inp rnote', rows: 1, placeholder: 'Add a note…', value: o.note || '', oninput: e => { o.note = e.target.value; Insp.touch([o], 'Edit note'); }, onkeydown: e => e.stopPropagation() }), U.el('div', { class: 'rmeta' }, U.el('small', null, 'p.' + pg + (o.type === 'hl' ? ' · ' + ({ hl: 'highlight', ul: 'underline', st: 'strike', sq: 'squiggly' })[o.kind] : ' · clip')), U.el('span', { class: 'sp' }), o.type === 'hl' ? UI.ibtn('quote', 'Quote into a note', () => Study.quote(o)) : null, UI.ibtn('pointer', 'Go to source', () => Study.jumpSrc(o)), UI.ibtn('trash', 'Delete', () => { D.remove([o]); Sel.clear(); D.commit('Delete', []); Bus.emit('struct'); Panels.render(); }))));
      root.append(row);
    });
  },
  exportMd(items) {
    let md = '# Research notes\n\n_' + (D.name || '') + '_\n', last = null;
    items.forEach(o => { if (o.doc !== last) { last = o.doc; const d = Study.doc(o.doc); md += `\n## ${d ? d.name : 'Other'}\n` + (d ? `_${Study.cite(d)}_\n\n` : '\n'); } const pg = o.pg || (o.src && o.src.pg) || ''; md += o.type === 'hl' ? `- (p.${pg}) “${o.text || 'area highlight'}”${o.note ? '\n  - ' + o.note.replace(/\n/g, '\n    ') : ''}\n` : `- (p.${pg}) [image clip]${o.note ? ' — ' + o.note : ''}\n`; });
    U.download(new Blob([md], { type: 'text/markdown' }), 'research-notes.md'); UI.toast('Notes exported');
  },
  async linkSel() {
    const s = Sel.objs().filter(o => o.type !== 'connector'); if (s.length !== 2) { UI.toast('Select exactly two items on the board to link them'); return; } const lbl = await UI.prompt('Relationship label (optional)', ''); if (lbl === null) return;
    const c = Conn.make({ id: s[0].id, side: 'auto' }, { id: s[1].id, side: 'auto' }, { lbl: lbl || '', color: '#4f46e5', style: 'curve', layer: Study.annLayer() }); D.add(c); D.commit('Link items', c); Bus.emit('struct');
  },
  /* ---- search panel (PDF text + notes) ---- */
  q: '', hits: [],
  searchPanel(root) {
    const inp = U.el('input', { class: 'inp', type: 'search', placeholder: 'Search PDFs, notes, highlights…', value: Study.q, onkeydown: e => { e.stopPropagation(); } }), list = U.el('div', { class: 'flist' }), info = U.el('div', { class: 'hint' });
    const unindexed = Study.docs().filter(d => d.kind === 'pdf' && !PDFS.txt.get('txtidx|' + d.id));
    const run = async () => {
      Study.q = inp.value; const hits = await Study.search(Study.q); Study.hits = hits; list.innerHTML = ''; info.textContent = Study.q ? `${hits.length} result${hits.length === 1 ? '' : 's'}${unindexed.length ? ' — still indexing ' + unindexed.length + ' PDF(s)…' : ''}` : 'Searches the full text of every PDF in this space, plus your notes, highlights and comments.';
      let lastD = null; hits.slice(0, 300).forEach(h => { const dn = h.type === 'pdf' ? h.doc.name : 'Notes & annotations'; if (dn !== lastD) { lastD = dn; list.append(U.el('div', { class: 'psec' }, dn)); } const ql = h.q.toLowerCase(), ix = h.snip.toLowerCase().indexOf(ql); const sn = U.el('span', { class: 'fsn wrap' }); sn.append(document.createTextNode(h.snip.slice(0, ix)), U.el('mark', null, h.snip.slice(ix, ix + h.q.length)), document.createTextNode(h.snip.slice(ix + h.q.length))); list.append(U.el('div', { class: 'frow', onclick: () => Study.showHit(h) }, U.el('span', { class: 'pgbadge' }, h.type === 'pdf' ? 'p.' + h.pg : ''), sn)); });
    }; let t; inp.addEventListener('input', () => { clearTimeout(t); t = setTimeout(run, 180); });
    root.append(inp, info, list); if (Study.q) run(); else run(); setTimeout(() => inp.focus(), 50);
  }
});
/* toolbar flyouts for study tools */
Object.assign(TB.flies, {
  hilite(box) {
    const o = Study.o; box.append(U.el('div', { class: 'lbl' }, 'Markup style'), UI.seg([['hl', 'Highlight'], ['ul', 'Underline'], ['st', 'Strike'], ['sq', 'Squiggly']], o.kind, v => { o.kind = v; Study.save(); Tools.set('hilite'); }));
    const g = U.el('div', { class: 'swatches' }); Study.HL_COLORS.forEach(c => g.append(U.el('button', { class: 'sw' + (o.color === c ? ' sel' : ''), style: 'background:' + c, onclick: e => { o.color = c; Study.save(); U.$$('.sw', g).forEach(x => x.classList.remove('sel')); e.currentTarget.classList.add('sel'); Tools.set('hilite'); } }))); box.append(U.el('div', { class: 'lbl' }, 'Colour'), g, UI.toggle('Area highlight (draw a box instead of selecting text)', o.area, v => { o.area = v; Study.save(); }), U.el('div', { class: 'hint' }, 'Drag across PDF text. Scanned pages without text fall back to area highlight automatically. Tap a highlight to add a note.')); Tools.set('hilite');
  },
  clip(box) { const o = Study.o; box.append(UI.toggle('Include my ink & shapes in the clip', o.clipInk, v => { o.clipInk = v; Study.save(); }), U.el('div', { class: 'hint' }, 'Drag a rectangle over any PDF area. A linked copy appears beside the page: tap the link badge on the clip to jump to its source, and the dashed frame on the page jumps back to the clip. Drag the clip onto another PDF or note.')); Tools.set('clip'); }
});
