'use strict';
/* ===== Side toolbar, top bar, flyouts, menus ===== */
const Menus = {
  arrange() { return [{ label: 'Bring to front', icon: 'front', key: 'Ctrl+Shift+]', fn: () => Act.order('front') }, { label: 'Bring forward', icon: 'forward', key: 'Ctrl+]', fn: () => Act.order('fwd') }, { label: 'Send backward', icon: 'backward', key: 'Ctrl+[', fn: () => Act.order('bwd') }, { label: 'Send to back', icon: 'back', key: 'Ctrl+Shift+[', fn: () => Act.order('back') }, { sep: true }, { label: 'Flip horizontal', icon: 'flipH', key: 'Shift+H', fn: () => Act.flip('h') }, { label: 'Flip vertical', icon: 'flipV', key: 'Shift+V', fn: () => Act.flip('v') }, { label: 'Straighten', icon: 'straighten', fn: () => Act.straighten() }, { label: 'Reset rotation', icon: 'rotate', fn: () => Act.apply(Sel.objs(), o => { if (!T.get(o.type).noRot) o.rot = 0; }, 'Reset rotation') }]; },
  alignItems() {
    const a = (l, ic, m) => ({ label: l, icon: ic, fn: () => Act.align(m) });
    return [a('Align left', 'alignL', 'left'), a('Align centre', 'alignC', 'hcenter'), a('Align right', 'alignR', 'right'), a('Align top', 'alignT', 'top'), a('Align middle', 'alignM', 'vcenter'), a('Align bottom', 'alignB', 'bottom'), { sep: true },
      { label: 'Distribute horizontally', icon: 'distH', fn: () => Act.distribute('h') }, { label: 'Distribute vertically', icon: 'distV', fn: () => Act.distribute('v') }, { sep: true },
      { label: 'Align relative to…', icon: 'align', sub: () => [{ label: 'Selection', fn: () => ST.set('alignTo', 'selection'), checked: (ST.v.alignTo || 'selection') === 'selection', keep: true }, { label: 'First selected (key object)', fn: () => ST.set('alignTo', 'key'), checked: ST.v.alignTo === 'key' }, { label: 'Frame', fn: () => ST.set('alignTo', 'frame'), checked: ST.v.alignTo === 'frame' }, { label: 'Viewport', fn: () => ST.set('alignTo', 'viewport'), checked: ST.v.alignTo === 'viewport' }] },
      { label: 'Match width', fn: () => Act.matchSize('w') }, { label: 'Match height', fn: () => Act.matchSize('h') }, { label: 'Stack horizontally', fn: () => Act.stack('h') }, { label: 'Stack vertically', fn: () => Act.stack('v') }, { label: 'Tidy into grid', fn: () => Act.tidy() }];
  },
  context(x, y, o, pt) {
    const s = Sel.objs(); const anchor = { x, y }; const items = [];
    if (!s.length && typeof Study !== 'undefined' && Study.on) {
      items.push({ label: 'Paste', icon: 'paste', key: 'Ctrl+V', disabled: !Act.clip, fn: () => Act.paste(pt ? [pt.x, pt.y] : null) }, { label: 'Add text', icon: 'text', fn: () => Act.make('text', pt ? { x: pt.x, y: pt.y } : null) }, { label: 'Add image…', icon: 'image', fn: async () => { const f = await IO.pick('image/*', true); IO.addFiles(f, pt ? [pt.x, pt.y] : null); } }, { sep: true }, { label: 'Fit page width', icon: 'fit', fn: () => { const c = Study.curPage(); c && Study.goto(c); } }, { label: 'Open PDF…', icon: 'pdf', fn: async () => { const f = await IO.pick('application/pdf,.pdf', true); for (const x of f) await Study.addPdf(x); } });
    } else if (!s.length) {
      items.push({ label: 'Paste', icon: 'paste', key: 'Ctrl+V', disabled: !Act.clip, fn: () => Act.paste(pt ? [pt.x, pt.y] : null) }, { label: 'Select all', key: 'Ctrl+A', fn: () => Act.selectAll() }, { sep: true },
        { label: 'Add sticky note', icon: 'sticky', fn: () => { const o = Act.make('sticky', pt ? { x: pt.x - 100, y: pt.y - 100 } : null); } }, { label: 'Add text', icon: 'text', fn: () => Act.make('text', pt ? { x: pt.x, y: pt.y } : null) }, { label: 'Add comment here', icon: 'comment', fn: () => pt && Act.addComment(pt.x, pt.y) }, { label: 'Add frame', icon: 'frame', fn: () => Act.addFramePreset(FRAME_PRESETS[0]) }, { sep: true },
        { label: 'Fit all content', icon: 'fit', key: 'Shift+1', fn: () => R.fitAll() }, { label: 'Board menu', icon: 'menu', sub: () => Menus.board() });
    } else {
      const one = s.length === 1 ? s[0] : null; const t = one && T.get(one.type);
      items.push({ label: 'Cut', icon: 'copy', key: 'Ctrl+X', fn: () => Act.copy(true) }, { label: 'Copy', icon: 'copy', key: 'Ctrl+C', fn: () => Act.copy(false) }, { label: 'Paste', icon: 'paste', key: 'Ctrl+V', disabled: !Act.clip, fn: () => Act.paste() }, { label: 'Duplicate', icon: 'duplicate', key: 'Ctrl+D', fn: () => Act.duplicate() }, { label: 'Copy as image', icon: 'image', fn: () => Act.copyImage() }, { label: 'Copy link to object', icon: 'share', fn: () => Act.copyLink(one) }, { sep: true });
      if (one && t.edit) items.push({ label: 'Edit', icon: 'text', key: 'Enter', fn: () => t.edit(one) });
      if (one && one.type === 'table') items.push({ label: 'Table', icon: 'table', sub: () => [{ label: 'Add row below', fn: () => Act.tableAdd(one, 'row') }, { label: 'Add column right', fn: () => Act.tableAdd(one, 'col') }, { label: 'Delete last row', fn: () => Act.tableDel(one, 'row') }, { label: 'Delete last column', fn: () => Act.tableDel(one, 'col') }] });
      if (one && (one.src || one.type === 'hl')) items.push({ label: 'Go to source', icon: 'link', fn: () => Study.jumpSrc(one) });
      if (one && one.type === 'image') items.push({ label: 'Crop…', icon: 'mask', fn: () => Act.cropImage(one) });
      if (one && one.type === 'frame') items.push({ label: 'Swap orientation', icon: 'orient', fn: () => { Act.orientFrame(one); D.commit('Orientation', one); } }, { label: 'Export frame…', icon: 'download', fn: () => IO.exportDialog({ frame: one }) });
      items.push({ label: 'Group', icon: 'group', key: 'Ctrl+G', disabled: s.length < 2, fn: () => Act.group() }, { label: 'Ungroup', icon: 'ungroup', key: 'Ctrl+Shift+G', disabled: !s.some(o => o.gid), fn: () => Act.ungroup() },
        { label: 'Arrange', icon: 'layers', sub: () => Menus.arrange() }, { label: 'Align', icon: 'align', sub: () => Menus.alignItems() },
        { label: 'Layer', icon: 'layers', sub: () => D.layers.map(l => ({ label: l.n, checked: s[0].layer === l.id, fn: () => Act.toLayer(l.id) })) }, { sep: true },
        { label: s.every(o => o.locked) ? 'Unlock' : 'Lock', icon: s.every(o => o.locked) ? 'unlock' : 'lock', key: 'Ctrl+L', fn: () => Act.lock() },
        { label: 'Add link…', icon: 'link', key: 'Ctrl+K', fn: () => Act.setLink() }, one && one.link ? { label: 'Open link', icon: 'external', fn: () => Act.follow(one) } : null,
        { label: 'Add comment', icon: 'comment', fn: () => { const c = pt ? [pt.x, pt.y] : G.center(s[0]); Act.addComment(c[0], c[1], s[0].id); } },
        { label: 'Properties', icon: 'settings', fn: () => Panels.show('design') }, { label: 'Zoom to selection', icon: 'fit', key: 'Shift+2', fn: () => R.fitSel() }, { sep: true }, { label: 'Delete', icon: 'trash', danger: true, key: 'Del', fn: () => Act.del() });
    }
    if (typeof Study !== 'undefined' && Study.on) { const bad = ['Layer', 'Add comment']; for (let i = items.length - 1; i >= 0; i--) if (items[i] && bad.includes(items[i].label)) items.splice(i, 1); }
    UI.menu(anchor, items.filter(Boolean), { side: 'bottom', key: 'ctx', toggle: false });
  },
  board() {
    const g = D.grid; const gt = (t, l) => ({ label: l, checked: g.type === t, fn: () => { g.type = t; D.commit('Grid', []); R.req(); } });
    return [
      { label: 'Duplicate board', icon: 'duplicate', fn: () => App.duplicate() }, { label: 'Rename…', icon: 'text', fn: async () => { const v = await UI.prompt('Board name', D.name); if (v) { D.name = v; U.$('#boardname').value = v; D.queueSave(); } } },
      { label: 'Export…', icon: 'download', key: 'Ctrl+Shift+E', sub: () => [{ label: 'Image / PDF…', icon: 'image', fn: () => IO.exportDialog() }, { label: 'PDF (all frames)', icon: 'file', fn: () => IO.exportDialog({ scope: D.frames().length ? 'frames' : 'board', fmt: 'pdf' }) }, { label: 'Board file (.infiniboard.json)', icon: 'save', fn: async () => U.download(await IO.boardBlob(), (D.name || 'board').replace(/[\\/:*?"<>|]+/g, '_') + '.infiniboard.json') }] },
      { label: 'Delete board', icon: 'trash', danger: true, fn: () => App.removeCurrent() }, { sep: true },
      { label: 'Background colour', icon: 'palette', sub: () => ['#ffffff', '#f8f9fb', '#f3f0e8', '#fff8e1', '#e8f5e9', '#e3f2fd', '#fce4ec', '#eceff1', '#1f2430', '#11151c', '#0f3d3e'].map(c => ({ label: c, swatch: c, checked: D.bg === c, fn: () => { D.bg = c; D.commit('Background', []); R.req(); } })) },
      { label: 'Grid', icon: 'grid', sub: () => [gt('none', 'No grid'), gt('dots', 'Dots'), gt('lines', 'Lines'), gt('cross', 'Crosses'), gt('iso', 'Isometric'), { sep: true }, { label: 'Snap to grid', checked: ST.v.snapGrid, fn: () => ST.set('snapGrid', !ST.v.snapGrid) }, { label: 'Smaller grid', fn: () => { g.size = Math.max(8, g.size / 2); R.req(); }, keep: true }, { label: 'Larger grid', fn: () => { g.size = Math.min(160, g.size * 2); R.req(); }, keep: true }] },
      { label: 'History', icon: 'history', key: 'Ctrl+H', fn: () => Panels.show('history') }, { label: 'Find', icon: 'find', key: 'Ctrl+F', fn: () => Panels.show('find') }, { label: 'Comments', icon: 'comment', fn: () => Panels.show('comments') }, { sep: true },
      { label: 'Show comments', checked: ST.v.comments, fn: () => { ST.set('comments', !ST.v.comments); R.reqOv(); } }, { label: 'Scroll bars', checked: ST.v.scrollbars, fn: () => { ST.set('scrollbars', !ST.v.scrollbars); R.reqOv(); } }, { label: 'Object dimensions', checked: ST.v.dims, fn: () => { ST.set('dims', !ST.v.dims); R.reqOv(); } },
      { label: 'Flow connectors', checked: ST.v.flow, fn: () => { ST.set('flow', !ST.v.flow); R.reqOv(); } }, { label: 'Show connectors', checked: ST.v.showConn !== false, fn: () => { ST.set('showConn', ST.v.showConn === false); R.req(); } }, { label: 'Mini-map', checked: ST.v.minimap, fn: () => { ST.set('minimap', !ST.v.minimap); R.reqOv(); } },
      { label: 'Snap to objects', checked: ST.v.snapObjects, fn: () => ST.set('snapObjects', !ST.v.snapObjects) }, { label: 'Alignment guides', checked: ST.v.guides, fn: () => ST.set('guides', !ST.v.guides) }, { sep: true },
      { label: 'Fit all content', icon: 'fit', fn: () => R.fitAll() }, { label: 'Reset zoom to 100%', fn: () => R.setZoom(1) }, { sep: true }, { label: 'Keyboard shortcuts', icon: 'keyboard', key: '?', fn: () => App.shortcuts() }, { label: 'Settings', icon: 'settings', key: 'Ctrl+,', fn: () => App.settings() }, { label: 'All boards', icon: 'home', fn: () => App.close() }];
  },
  add() {
    return [{ header: 'Add to board' }, { label: 'Photo', icon: 'image', fn: async () => { const f = await IO.pick('image/*', true); IO.addFiles(f); } }, { label: 'Video', icon: 'video', fn: async () => { const f = await IO.pick('video/*', true); IO.addFiles(f); } }, { label: 'File (PDF, doc…)', icon: 'file', fn: async () => { const f = await IO.pick('*/*', true); IO.addFiles(f); } }, { label: 'Sticky note', icon: 'sticky', key: 'N', fn: () => Tools.set('sticky') }, { label: 'Browser / web page', icon: 'browser', fn: () => Act.make('embed', { url: '' }) }, { sep: true },
      { label: 'Take photo', icon: 'camera', fn: () => IO.camera('photo') }, { label: 'Record video', icon: 'videocam', fn: () => IO.camera('video') }, { label: 'Record audio', icon: 'mic', fn: () => IO.audio() }, { label: 'Scan document', icon: 'scan', fn: () => IO.scan() }, { sep: true },
      { label: 'Placeholder', icon: 'placeholder', sub: () => [['image', 'Image'], ['video', 'Video'], ['any', 'File']].map(([k, l]) => ({ label: l + ' placeholder', fn: () => Act.make('placeholder', { kind: k }) })) }, { label: 'Frame / page', icon: 'frame', key: 'F', fn: () => Tools.set('frame') }];
  },
  objects() {
    const m = (l, ic, type) => ({ label: l, icon: ic, fn: () => Act.make(type) });
    return [{ header: 'Advanced objects' }, m('Table', 'table', 'table'), m('Kanban board', 'kanban', 'kanban'), m('Timeline', 'timeline', 'timeline'), m('Matrix / quadrant', 'matrix', 'matrix'), m('Document', 'doc', 'doc'), m('Mind map', 'mindmap', 'mindmap'), { sep: true },
      { header: 'Diagram templates' }, { label: 'Flowchart', icon: 'flowchart', fn: () => Act.diagram('flowchart') }, { label: 'Org chart', icon: 'group', fn: () => Act.diagram('org') }, { label: 'Cycle', icon: 'rotate', fn: () => Act.diagram('cycle') }, { label: 'Venn diagram', icon: 'shapes', fn: () => Act.diagram('venn') }, { label: 'Process steps', icon: 'arrow', fn: () => Act.diagram('process') }];
  }
};

/* ---------- toolbar ---------- */
const TB = {
  tools: [
    ['select', 'Select (V)', 'select', 'sel'], ['hand', 'Hand (H)', 'hand'], ['pen', 'Pen (P)', 'pen', 'fly'], ['eraser', 'Eraser (E)', 'eraser', 'fly'], ['shape', 'Shapes (S)', 'shapes', 'fly'],
    ['line', 'Connector & lines (L)', 'connector', 'fly'], ['text', 'Text (T)', 'text', 'fly'], ['sticky', 'Sticky note (N)', 'sticky', 'fly'], ['fill', 'Fill with colour (G)', 'bucket', 'fly'], ['add', 'Add media…', 'plus', 'fly'], ['objects', 'Tables, boards, mind maps…', 'kanban', 'fly'], ['ruler', 'Ruler (R)', 'ruler'], ['laser', 'Laser pointer (Z)', 'laser', 'fly'], ['comment', 'Comment (C)', 'comment']
  ],
  btns: {},
  init() {
    const bar = U.$('#toolbar'); bar.innerHTML = '';
    TB.tools.forEach(([id, title, ic, kind]) => {
      const b = U.el('button', { class: 'tbtn', title, 'data-tool': id, html: U.icon(ic, 22) + (kind ? '<i class="corner"></i>' : '') });
      b.addEventListener('click', e => TB.click(id, b)); if (kind === 'fly' || kind === 'sel') { let t; b.addEventListener('contextmenu', e => { e.preventDefault(); TB.fly(id, b); }); b.addEventListener('pointerdown', e => { if (e.pointerType !== 'mouse') t = setTimeout(() => TB.fly(id, b), 450); }); b.addEventListener('pointerup', () => clearTimeout(t)); b.addEventListener('pointerleave', () => clearTimeout(t)); }
      TB.btns[id] = b; bar.append(b);
    });
    bar.append(U.el('div', { class: 'tsep' }), TB.mk('undo', 'Undo (Ctrl+Z)', 'undo', () => D.undo()), TB.mk('redo', 'Redo (Ctrl+Shift+Z)', 'redo', () => D.redo()));
    Bus.on('tool', TB.sync); Bus.on('commit', TB.sync); Bus.on('settings', TB.sync); TB.sync();
    TB.top(); TB.bottom();
  },
  mk(id, title, ic, fn) { const b = U.el('button', { class: 'tbtn', title, 'data-id': id, html: U.icon(ic, 22), onclick: fn }); TB.btns[id] = b; return b; },
  sync() {
    const t = Tools.tool; const grp = { marquee: 'select', lasso: 'select', cutout: 'select', connector: 'line', recarea: 'select' }; let cur = grp[t] || t; if (t === 'shape' && Tools.opts.shape.mode === 'line') cur = 'line';
    for (const id in TB.btns) TB.btns[id].classList.toggle('on', id === cur || (id === 'ruler' && Ruler.on));
    const sb = TB.btns.select; if (sb) { const ic = { select: 'select', marquee: 'marquee', lasso: 'lasso', cutout: 'cutout' }[t]; if (ic) sb.querySelector('svg').outerHTML = U.icon(ic, 22); }
    const lb = TB.btns.laser; if (lb) lb.classList.toggle('on', t === 'laser');
    if (TB.btns.undo) { TB.btns.undo.disabled = D.hi <= 0; TB.btns.redo.disabled = D.hi >= D.hist.length - 1; }
    const pb = TB.btns.pen; if (pb) pb.style.setProperty('--c', Tools.opts.pen.color);
    const opt = TB.btns.fill; if (opt) opt.style.setProperty('--c', Tools.opts.fill.color);
  },
  click(id, b) {
    if (id === 'add') return TB.fly('add', b); if (id === 'objects') return TB.fly('objects', b);
    if (id === 'ruler') { Ruler.toggle(); TB.sync(); return; }
    if (id === 'line') { if (Tools.tool === 'shape' && Tools.opts.shape.mode === 'line') return TB.fly('line', b); Tools.opts.shape.mode = 'line'; Tools.set('shape', { lock: false }); TB.sync(); return; }
    if (id === 'shape') { if (Tools.tool === 'shape' && Tools.opts.shape.mode === 'shape') return TB.fly('shape', b); Tools.opts.shape.mode = 'shape'; }
    if (id === 'select') { const m = ST.v.lastSel || 'select'; if (Tools.tool === 'select' && m === 'select') { TB.fly(id, b); return; } Tools.set(m); return; }
    if (Tools.tool === id && !Tools.lock && id !== 'hand' && id !== 'comment') { TB.fly(id, b); return; }
    Tools.set(id);
  },
  fly(id, b) {
    const box = U.el('div', { class: 'fly' }); const F = TB.flies[id]; if (!F) return; F(box, b);
    UI.pop(b, box, { key: 'fly', side: document.getElementById('app').classList.contains('study') ? 'bottom' : 'right', cls: 'pop-fly' });
  },
  flies: {
    select(box) {
      [['select', 'Select', 'select', 'Click or drag to select. Alt-drag duplicates.'], ['marquee', 'Box select', 'marquee', 'Drag a rectangle; selects what it touches/contains.'], ['lasso', 'Lasso select', 'lasso', 'Draw around objects to select them.'], ['cutout', 'Cut-out', 'cutout', 'Draw around part of the board to copy it as an image.']].forEach(([k, l, ic, d]) => box.append(U.el('button', { class: 'frow2', onclick: () => { ST.set('lastSel', k); UI.closeAll(); Tools.set(k); } }, U.el('span', { html: U.icon(ic, 22) }), U.el('span', null, U.el('b', null, l), U.el('small', null, d)))));
      box.append(UI.field('Selection precision', UI.seg([['touch', 'Touch (partly inside)'], ['contain', 'Fully inside']], ST.v.selectMode, v => ST.set('selectMode', v))), UI.toggle('Cut-out removes original', Tools.opts.cutout.remove, v => { Tools.opts.cutout.remove = v; Tools.saveOpts(); }), UI.toggle('Pen-only drawing (touch pans)', ST.v.penOnly, v => ST.set('penOnly', v)));
    },
    pen(box) {
      const o = Tools.opts.pen; const prev = U.el('canvas', { width: 220, height: 54, class: 'penprev' });
      const draw = () => { const c = prev.getContext('2d'); c.clearRect(0, 0, 220, 54); const pts = []; for (let i = 0; i <= 40; i++) { const t = i / 40; pts.push(10 + t * 200, 27 + Math.sin(t * Math.PI * 2) * 12, .3 + .6 * Math.sin(t * Math.PI)); } try { Ink.render(c, pts, { pen: o.pen, color: o.color, size: o.size }, {}); } catch (e) { c.strokeStyle = o.color; c.lineWidth = o.size; c.beginPath(); for (let i = 0; i < pts.length; i += 3) i ? c.lineTo(pts[i], pts[i + 1]) : c.moveTo(pts[i], pts[i + 1]); c.stroke(); } };
      const types = U.el('div', { class: 'ptypes' }); Object.entries(PENS).forEach(([k, p]) => types.append(U.el('button', { class: 'ptype' + (o.pen === k ? ' on' : ''), title: p.n, html: U.icon(p.ic, 22) + `<small>${p.n}</small>`, onclick: e => { o.pen = k; if (o.memo && o.memo[k]) { o.size = o.memo[k].size; } Tools.saveOpts(); U.$$('.ptype', types).forEach(x => x.classList.remove('on')); e.currentTarget.classList.add('on'); draw(); TB.sync(); Tools.set('pen'); } })));
      box.append(types, prev, UI.field('Size', UI.range(1, 60, 1, o.size, v => { o.size = v; (o.memo ||= {})[o.pen] = { size: v }; Tools.saveOpts(); draw(); }, { fmt: v => v + ' px' })), UI.colorBox(o.color, c => { o.color = c; Tools.saveOpts(); draw(); TB.sync(); }),
        UI.field('Smart shape recognition', UI.seg([['hold', 'Hold'], ['always', 'Always'], ['off', 'Off']], ST.v.smart, v => ST.set('smart', v))), UI.toggle('Pressure sensitivity', ST.v.pressure, v => ST.set('pressure', v)), UI.field('Smoothing', UI.range(0, 1, .05, ST.v.ptrSmooth, v => ST.set('ptrSmooth', v), { fmt: v => Math.round(v * 100) + '%' })), U.el('div', { class: 'hint' }, 'Hold still at the end of a stroke to snap it to a clean shape.')); draw(); Tools.set('pen');
    },
    eraser(box) {
      const o = Tools.opts.eraser; box.append(U.el('div', { class: 'lbl' }, 'Eraser type'));
      [['stroke', 'Stroke eraser', 'Removes whole strokes you touch'], ['pixel', 'Pixel eraser', 'Erases only the part you rub (splits strokes)'], ['area', 'Area eraser', 'Draw a lasso — everything inside goes']].forEach(([k, l, d]) => box.append(U.el('button', { class: 'frow2' + (o.type === k ? ' on' : ''), onclick: e => { o.type = k; Tools.saveOpts(); U.$$('.frow2', box).forEach(x => x.classList.remove('on')); e.currentTarget.classList.add('on'); Tools.set('eraser'); } }, U.el('span', { html: U.icon('eraser', 20) }), U.el('span', null, U.el('b', null, l), U.el('small', null, d)))));
      box.append(UI.field('Size', UI.range(6, 140, 2, o.size, v => { o.size = v; Tools.saveOpts(); }, { fmt: v => v + ' px' })), UI.toggle('Erase every object (not only ink)', ST.v.eraseAll, v => ST.set('eraseAll', v)), UI.btn('Clear all ink', 'trash', async () => { UI.closeAll(); if (await UI.confirm('Remove all pen strokes from the board?', 'Clear ink', true)) { D.remove(D.objs.filter(x => x.type === 'stroke' && !D.isLocked(x))); Sel.ids = []; D.commit('Clear ink', []); } }, 'sm danger')); Tools.set('eraser');
    },
    shape(box) {
      const o = Tools.opts.shape; o.mode = 'shape'; SHAPE_GROUPS.forEach(([n, kinds]) => { box.append(U.el('div', { class: 'lbl' }, n)); const g = U.el('div', { class: 'sg' }); kinds.forEach(k => g.append(U.el('button', { class: 'shapebtn' + (o.kind === k ? ' on' : ''), title: SHAPES[k].n, onclick: () => { o.kind = k; Tools.saveOpts(); Tools.set('shape'); UI.closeAll(); }, ondblclick: () => { o.kind = k; Tools.set('shape', { lock: true }); UI.closeAll(); UI.toast('Shape tool locked — press Esc to stop'); } }, SHAPES.preview(k, 40, 30)))); box.append(g); });
      box.append(U.el('div', { class: 'row gap' }, UI.field('Fill', UI.swatchBtn(o.fill, c => { o.fill = c; Tools.saveOpts(); }, { none: true }), 'inline'), UI.field('Line', UI.swatchBtn(o.stroke, c => { o.stroke = c; Tools.saveOpts(); }), 'inline'), UI.field('Width', UI.num(o.sw, v => { o.sw = U.clamp(v, 0, 40); Tools.saveOpts(); }, { min: 0, max: 40 }), 'inline')), UI.toggle('Switch to hand after drawing a shape', ST.v.handAfterShape, v => ST.set('handAfterShape', v)));
    },
    line(box) {
      const o = Tools.opts.line; o.mode = 'line'; const kinds = [['arrow', 'Arrow'], ['line', 'Line'], ['double', 'Double arrow'], ['dot', 'Dot end']]; const sel = Object.keys(Heads || {}).length ? null : null;
      box.append(U.el('div', { class: 'lbl' }, 'Type'), UI.seg([['elbow', 'Elbow'], ['straight', 'Straight'], ['curve', 'Curve']], o.style, v => { o.style = v; Tools.saveOpts(); }), UI.seg([['arrow', 'Arrow'], ['line', 'Line'], ['double', 'Double'], ['dot', 'Dot']], o.kind, v => { o.kind = v; Tools.saveOpts(); }),
        UI.field('Line style', UI.seg([['solid', 'Solid'], ['dashed', 'Dashed'], ['dotted', 'Dotted']], o.dash, v => { o.dash = v; Tools.saveOpts(); })), UI.field('Width', UI.range(1, 16, 1, o.sw, v => { o.sw = v; Tools.saveOpts(); }, { fmt: v => v + ' px' })), UI.field('Colour', UI.swatchBtn(o.color, c => { o.color = c; Tools.saveOpts(); }), 'inline'),
        U.el('div', { class: 'hint' }, 'Drag between two objects to attach a dynamic connector. Drag from the blue handles on a selected object. Attach to any side (top/right/bottom/left) or let it pick automatically.'), UI.btn('Draw connector', 'connector', () => { UI.closeAll(); Tools.set('connector'); }, 'sm primary')); Tools.set('shape');
    },
    text(box) { const o = Tools.opts.text; box.append(UI.field('Font size', UI.range(10, 160, 1, o.fs, v => { o.fs = v; Tools.saveOpts(); }, { fmt: v => v + ' px' })), UI.field('Colour', UI.swatchBtn(o.tc, c => { o.tc = c; Tools.saveOpts(); }), 'inline'), U.el('div', { class: 'hint' }, 'Click the board to type. Double-click any shape or note to edit its text.')); Tools.set('text'); },
    sticky(box) { const o = Tools.opts.sticky; box.append(U.el('div', { class: 'lbl' }, 'Colour'), (() => { const g = U.el('div', { class: 'swatches' }); U.STICKY.forEach(c => g.append(U.el('button', { class: 'sw' + (o.color === c ? ' sel' : ''), style: 'background:' + c, onclick: e => { o.color = c; Tools.saveOpts(); U.$$('.sw', g).forEach(x => x.classList.remove('sel')); e.currentTarget.classList.add('sel'); Tools.set('sticky'); } }))); return g; })(), U.el('div', { class: 'hint' }, 'Click the board to drop a note.')); Tools.set('sticky'); },
    fill(box) { const o = Tools.opts.fill; box.append(UI.colorBox(o.color, c => { o.color = c; Tools.saveOpts(); TB.sync(); }), U.el('div', { class: 'hint' }, 'Tap a shape, text box or closed outline to fill it. Tap empty space to colour a frame or the board.')); Tools.set('fill'); },
    add(box) { box.append(U.el('div', { class: 'menu' }, ...Menus.add().filter(x => !x.sep && !x.header).map(it => { const r = U.el('div', { class: 'mi', onclick: () => { UI.closeAll(); it.fn(); } }, U.el('span', { class: 'mi-ic', html: U.icon(it.icon, 18) }), U.el('span', { class: 'mi-l' }, it.label)); if (it.sub) { r.onclick = e => { UI.menu(r, it.sub(), { side: 'right', child: true, key: 'sub' }); }; r.append(U.el('span', { class: 'mi-sub', html: U.icon('chevR', 14) })); } return r; }))); },
    objects(box) { box.append(U.el('div', { class: 'menu' }, ...Menus.objects().map(it => it.header ? U.el('div', { class: 'mhead' }, it.header) : it.sep ? U.el('div', { class: 'msep' }) : U.el('div', { class: 'mi', onclick: () => { UI.closeAll(); it.fn(); } }, U.el('span', { class: 'mi-ic', html: U.icon(it.icon, 18) }), U.el('span', { class: 'mi-l' }, it.label))))); },
    laser(box) {
      box.append(U.el('div', { class: 'lbl' }, 'Laser pointer type')); const g = U.el('div', { class: 'ptypes' }); Laser.types.forEach(([k, l, ic]) => g.append(U.el('button', { class: 'ptype' + (ST.v.laserType === k ? ' on' : ''), html: U.icon(ic, 22) + `<small>${l}</small>`, onclick: e => { ST.set('laserType', k); U.$$('.ptype', g).forEach(x => x.classList.remove('on')); e.currentTarget.classList.add('on'); Tools.set('laser'); } }))); box.append(g,
        UI.field('Colour', UI.swatchBtn(ST.v.laserColor, c => ST.set('laserColor', c), { palette: ['#ff3b30', '#ff9500', '#ffcc00', '#34c759', '#00c7be', '#0a84ff', '#bf5af2', '#ffffff', '#000000'] }), 'inline'), UI.field('Size', UI.range(4, 40, 1, ST.v.laserSize, v => ST.set('laserSize', v), { fmt: v => v + ' px' })), UI.toggle('Offset above finger (touch)', ST.v.laserOffset, v => ST.set('laserOffset', v)), UI.field('Offset distance', UI.range(20, 140, 2, ST.v.laserOffsetY, v => ST.set('laserOffsetY', v), { fmt: v => v + ' px' }))); Tools.set('laser');
    }
  },
  /* ---------- top bar ---------- */
  top() {
    const t = U.$('#topbar'); t.innerHTML = '';
    const name = U.el('input', { id: 'boardname', class: 'bname', value: D.name, title: 'Board name', spellcheck: false, onchange: e => { D.name = e.target.value.trim() || 'Untitled board'; D.modified = Date.now(); D.queueSave(); }, onkeydown: e => { e.stopPropagation(); if (e.key === 'Enter') e.target.blur(); } });
    const rec = U.el('button', { class: 'tbtn rec', id: 'recbtn', title: 'Record canvas (screen recording of the board)', html: U.icon('record', 20), onclick: e => Rec.panel(e.currentTarget) });
    const save = U.el('span', { id: 'savestate', class: 'savestate' }, 'Saved');
    t.append(UI.ibtn('home', 'All boards', () => App.close()), name, save, U.el('span', { class: 'sp' }),
      UI.ibtn('frame', 'Frames / pages', () => Panels.toggle('pages')), UI.ibtn('layers', 'Layers', () => Panels.toggle('layers')), UI.ibtn('comment', 'Comments', () => Panels.toggle('comments')), UI.ibtn('history', 'History', () => Panels.toggle('history')), UI.ibtn('find', 'Find (Ctrl+F)', () => Panels.toggle('find')), U.el('span', { class: 'tsep h' }),
      rec, UI.ibtn('download', 'Export', () => IO.exportDialog()), UI.ibtn('grid', 'Grid & snapping', e => UI.menu(e.currentTarget, TB.gridMenu(), { side: 'bottom', align: 'end' })), UI.ibtn('settings', 'Properties', () => Panels.toggle('design')), UI.ibtn('menu', 'Board menu', e => UI.menu(e.currentTarget, Menus.board(), { side: 'bottom', align: 'end' })));
    Bus.on('saved', s => { save.textContent = s === 'saving' ? 'Saving…' : 'Saved'; save.classList.toggle('busy', s === 'saving'); });
  },
  gridMenu() { const g = D.grid; const gt = (tp, l) => ({ label: l, checked: g.type === tp, fn: () => { g.type = tp; D.commit('Grid', []); R.req(); } }); return [{ header: 'Grid type' }, gt('none', 'None'), gt('dots', 'Dots'), gt('lines', 'Lines'), gt('cross', 'Crosses'), gt('iso', 'Isometric'), { sep: true }, { label: 'Snap to grid', checked: ST.v.snapGrid, fn: () => ST.set('snapGrid', !ST.v.snapGrid) }, { label: 'Snap to objects', checked: ST.v.snapObjects, fn: () => ST.set('snapObjects', !ST.v.snapObjects) }, { label: 'Alignment guides', checked: ST.v.guides, fn: () => ST.set('guides', !ST.v.guides) }, { sep: true }, { label: 'Smaller grid', fn: () => { g.size = Math.max(8, Math.round(g.size / 1.5)); R.req(); }, keep: true }, { label: 'Larger grid', fn: () => { g.size = Math.min(200, Math.round(g.size * 1.5)); R.req(); }, keep: true }]; },
  /* ---------- bottom zoom bar ---------- */
  bottom() {
    const z = U.$('#zoombar'); z.innerHTML = ''; const pct = U.el('button', { class: 'zpct', title: 'Zoom options', onclick: e => UI.menu(e.currentTarget, [{ label: 'Zoom to fit', icon: 'fit', key: 'Shift+1', fn: () => R.fitAll() }, { label: 'Zoom to selection', key: 'Shift+2', disabled: !Sel.ids.length, fn: () => R.fitSel() }, { label: '50%', fn: () => R.setZoom(.5) }, { label: '100%', key: 'Ctrl+0', fn: () => R.setZoom(1) }, { label: '200%', fn: () => R.setZoom(2) }, { label: '400%', fn: () => R.setZoom(4) }], { side: 'top' }) }, '100%');
    z.append(UI.ibtn('minus', 'Zoom out (-)', () => R.setZoom(D.view.z / 1.25)), pct, UI.ibtn('plus', 'Zoom in (+)', () => R.setZoom(D.view.z * 1.25)), UI.ibtn('fit', 'Fit all (Shift+1)', () => R.fitAll()), UI.ibtn('minimap', 'Mini-map', () => { ST.set('minimap', !ST.v.minimap); R.reqOv(); }));
    Bus.on('view', () => { pct.textContent = Math.round(D.view.z * 100) + '%'; }); pct.textContent = Math.round(D.view.z * 100) + '%';
  }
};
