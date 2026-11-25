'use strict';
/* ===== Inspector, floating context bar, layers, pages, comments, history, find ===== */
const getPath = (o, k) => k == null ? undefined : k.split('.').reduce((a, p) => (a == null ? a : a[p]), o);
const setPath = (o, k, v, def) => { const ps = k.split('.'); let t = o; for (let i = 0; i < ps.length - 1; i++) { if (t[ps[i]] == null) t[ps[i]] = {}; t = t[ps[i]]; } t[ps[ps.length - 1]] = v; };

const Insp = {
  pend: new Set(), plabel: 'Edit',
  touch(objs, label) { objs.forEach(o => { delete o._rk; this.pend.add(o); }); this.plabel = label || 'Edit'; Insp.flush(); R.req(); },
  flush: U.debounce(() => { const l = [...Insp.pend]; Insp.pend.clear(); if (l.length) D.commit(Insp.plabel, l); }, 450),
  ctl(c, objs, rebuild) {
    const o = objs[0], t = T.get(o.type);
    if (c.show && !c.show(o)) return null;
    if (c.sec) return U.el('div', { class: 'psec' }, c.sec);
    const val = () => c.get ? c.get(o) : getPath(o, c.k);
    const apply = (v, label) => { objs.forEach(ob => { if (c.set) c.set(ob, v); else setPath(ob, c.k, v); const tt = T.get(ob.type); if (tt.fit) tt.fit(ob); c.after && c.after(ob); }); Insp.touch(objs, label || ('Edit ' + (c.l || c.k || 'object'))); if (c.rebuild) rebuild(); };
    let v = val(); if (v === undefined && c.def !== undefined) v = c.def;
    switch (c.t) {
      case 'color': { const b = UI.swatchBtn(v, col => apply(col), { none: c.none, alpha: c.alpha, palette: c.palette }); return UI.field(c.l, b, 'inline'); }
      case 'num': return UI.field(c.l, UI.num(v, x => apply(U.clamp(x, c.min ?? -1e9, c.max ?? 1e9))), 'inline');
      case 'range': return UI.field(c.l, UI.range(c.min, c.max, c.step || 1, v, x => apply(x), { fmt: c.fmt }));
      case 'select': return UI.field(c.l, UI.select(c.opts, v, x => { apply(x); if (c.rebuild !== false) rebuild(); }), 'inline');
      case 'seg': return UI.field(c.l, UI.seg(c.opts, v, x => { apply(x); rebuild(); }));
      case 'toggle': return UI.toggle(c.l, !!v, x => { apply(x); rebuild(); });
      case 'text': { const i = c.ml ? U.el('textarea', { class: 'inp', rows: 4, value: v ?? '' }) : U.el('input', { class: 'inp', type: 'text', value: v ?? '' }); i.addEventListener('input', () => apply(i.value)); i.addEventListener('keydown', e => e.stopPropagation()); return UI.field(c.l, i); }
      case 'tbtn': { const b = U.el('button', { class: 'ibtn tb' + (v ? ' on' : ''), title: c.title, html: U.icon(c.ic, 17), onclick: () => { v = !v; b.classList.toggle('on', v); apply(v); } }); return b; }
      case 'row': { const w = U.el('div', { class: 'row gap' }); c.items.forEach(it => { const e = Insp.ctl(it, objs, rebuild); if (e) w.append(e); }); return w; }
      case 'btns': { const w = U.el('div', { class: 'btnrow' }); c.items.forEach(it => w.append(U.el('button', { class: 'btn sm', html: (it.ic ? U.icon(it.ic, 15) : '') + `<span>${U.esc(it.l)}</span>`, onclick: () => { objs.forEach(ob => { it.fn(ob); const tt = T.get(ob.type); if (tt.fit) tt.fit(ob); delete ob._rk; }); D.commit(it.l, objs); R.req(); rebuild(); } }))); return w; }
      case 'shapepick': { const b = U.el('button', { class: 'shapebtn' }, SHAPES.preview(v, 40, 30)); b.onclick = () => Insp.shapeMenu(b, k => { objs.forEach(ob => ob.kind = k); Insp.touch(objs, 'Change shape'); rebuild(); }); return UI.field(c.l, b, 'inline'); }
      case 'frameSizes': { return UI.field('Preset size', UI.select([['', 'Choose…'], ...FRAME_PRESETS.map((p, i) => [i, `${p[0]} (${p[1]}×${p[2]})`])], '', i => { if (i === '') return; const p = FRAME_PRESETS[+i]; const c0 = G.center(o); o.w = p[1]; o.h = p[2]; o.x = c0[0] - o.w / 2; o.y = c0[1] - o.h / 2; Insp.touch([o], 'Resize frame'); rebuild(); })); }
    }
    return null;
  },
  shapeMenu(anchor, pick) {
    const box = U.el('div', { class: 'shapegrid' });
    SHAPE_GROUPS.forEach(([n, kinds]) => { box.append(U.el('div', { class: 'lbl' }, n)); const g = U.el('div', { class: 'sg' }); kinds.forEach(k => g.append(U.el('button', { class: 'shapebtn', title: SHAPES[k].n, onclick: () => { UI.closeAll(); pick(k); } }, SHAPES.preview(k, 40, 30)))); box.append(g); });
    UI.pop(anchor, box, { cls: 'pop-shapes', side: 'left', child: true });
  },
  design(root) {
    root.innerHTML = ''; const objs = Sel.objs(); const rebuild = () => { Insp.design(root); };
    if (!objs.length) { Insp.boardProps(root); return; }
    const one = objs.length === 1 ? objs[0] : null, same = objs.every(o => o.type === objs[0].type), t = T.get(objs[0].type);
    root.append(U.el('div', { class: 'ptitle' }, U.el('span', { html: U.icon(Insp.icon(objs[0].type), 18) }), one ? Insp.name(one) : objs.length + ' objects' + (same ? ' · ' + Insp.name(objs[0]) : '')));
    if (same && t.ins) { const body = U.el('div', { class: 'pbody' }); t.ins(objs[0]).forEach(c => { const e = Insp.ctl(c, objs, rebuild); if (e) body.append(e); }); root.append(body); }
    // common
    const com = U.el('div', { class: 'pbody' }); com.append(U.el('div', { class: 'psec' }, 'Position & size'));
    if (one && one.type !== 'connector') {
      const u = ST.v.units, f = v => Units.toU(v, u), g = v => Units.fromU(v, u);
      const mk = (l, k, get, set) => UI.field(l, UI.num(get(), v => { set(v); const tt = T.get(one.type); if (tt.onResize && (k === 'w' || k === 'h')) tt.onResize(one, one.w, one.h); if (tt.fit) tt.fit(one); Insp.touch([one], 'Set ' + l); rebuild(); }, { step: u === 'px' ? 1 : .1 }), 'xy');
      com.append(U.el('div', { class: 'grid2' }, mk('X', 'x', () => f(one.x), v => one.x = g(v)), mk('Y', 'y', () => f(one.y), v => one.y = g(v)), mk('W', 'w', () => f(one.w), v => one.w = Math.max(1, g(v))), mk('H', 'h', () => f(one.h), v => one.h = Math.max(1, g(v)))));
      if (!t.noRot) com.append(UI.field('Rotation (°)', UI.num(Math.round(U.deg(one.rot) * 10) / 10, v => { one.rot = U.rad(v); Insp.touch([one], 'Rotate'); R.req(); }), 'inline'));
      com.append(U.el('div', { class: 'hint' }, 'Units: ' + u + ' (change in Settings)'));
    }
    com.append(U.el('div', { class: 'psec' }, 'Appearance'), UI.field('Opacity', UI.range(5, 100, 1, Math.round(objs[0].op * 100), v => { objs.forEach(o => o.op = v / 100); Insp.touch(objs, 'Opacity'); }, { fmt: v => v + '%' })));
    const sh = objs[0].sh; com.append(UI.toggle('Shadow', !!sh, v => { Act.setShadow(v); rebuild(); }));
    if (sh) { com.append(UI.field('Shadow blur', UI.range(0, 60, 1, sh.b, v => { objs.forEach(o => o.sh && (o.sh.b = v)); Insp.touch(objs, 'Shadow'); })), UI.field('Shadow offset', UI.range(0, 40, 1, sh.y, v => { objs.forEach(o => o.sh && (o.sh.y = v)); Insp.touch(objs, 'Shadow'); })), UI.field('Shadow colour', UI.swatchBtn(sh.c, c => { objs.forEach(o => o.sh && (o.sh.c = c)); Insp.touch(objs, 'Shadow'); }, { alpha: true }), 'inline')); }
    com.append(UI.toggle('Lock', objs.every(o => o.locked), v => { Act.lock(v); rebuild(); }));
    com.append(UI.field('Layer', UI.select(D.layers.map(l => [l.id, l.n]), objs[0].layer, v => { Act.toLayer(v); }), 'inline'));
    com.append(U.el('div', { class: 'psec' }, 'Arrange'));
    const row = (items) => { const w = U.el('div', { class: 'iconrow' }); items.forEach(([ic, tt, fn, dis]) => w.append(U.el('button', { class: 'ibtn', title: tt, disabled: dis, html: U.icon(ic, 18), onclick: () => { fn(); setTimeout(rebuild, 30); } }))); return w; };
    com.append(row([['front', 'Bring to front', () => Act.order('front')], ['forward', 'Bring forward', () => Act.order('fwd')], ['backward', 'Send backward', () => Act.order('bwd')], ['back', 'Send to back', () => Act.order('back')], ['flipH', 'Flip horizontal', () => Act.flip('h')], ['flipV', 'Flip vertical', () => Act.flip('v')], ['straighten', 'Straighten', () => Act.straighten()]]));
    com.append(row([['alignL', 'Align left', () => Act.align('left')], ['alignC', 'Align centre', () => Act.align('hcenter')], ['alignR', 'Align right', () => Act.align('right')], ['alignT', 'Align top', () => Act.align('top')], ['alignM', 'Align middle', () => Act.align('vcenter')], ['alignB', 'Align bottom', () => Act.align('bottom')]]));
    if (objs.length > 1) com.append(row([['distH', 'Distribute horizontally', () => Act.distribute('h')], ['distV', 'Distribute vertically', () => Act.distribute('v')], ['group', 'Group', () => Act.group()], ['ungroup', 'Ungroup', () => Act.ungroup()]]));
    else com.append(row([['group', 'Group', () => Act.group(), true], ['ungroup', 'Ungroup', () => Act.ungroup(), !objs[0].gid]]));
    com.append(U.el('div', { class: 'psec' }, 'Actions'));
    const ab = U.el('div', { class: 'btnrow' }); [['Link', 'link', () => Act.setLink()], ['Comment', 'comment', () => { const c = G.center(objs[0]); Act.addComment(c[0], c[1], objs[0].id); }], ['Duplicate', 'duplicate', () => Act.duplicate()], ['Copy link', 'share', () => Act.copyLink()], ['Copy as image', 'image', () => Act.copyImage()], ['Delete', 'trash', () => Act.del()]].forEach(([l, ic, fn]) => ab.append(U.el('button', { class: 'btn sm' + (l === 'Delete' ? ' danger' : ''), html: U.icon(ic, 15) + `<span>${l}</span>`, onclick: fn })));
    com.append(ab); root.append(com);
  },
  boardProps(root) {
    const b = U.el('div', { class: 'pbody' }); b.append(U.el('div', { class: 'ptitle' }, U.el('span', { html: U.icon('settings', 18) }), 'Board'),
      UI.field('Name', U.el('input', { class: 'inp', value: D.name, oninput: e => { D.name = e.target.value; D.modified = Date.now(); D.queueSave(); U.$('#boardname').value = D.name; } })),
      UI.field('Background', UI.swatchBtn(D.bg, c => { D.bg = c; D.commit('Background', []); R.req(); }, { palette: ['#ffffff', '#f8f9fb', '#f3f0e8', '#fff8e1', '#e8f5e9', '#e3f2fd', '#fce4ec', '#eceff1', '#1f2430', '#11151c', '#0f3d3e', '#2d1b4e'] }), 'inline'),
      UI.field('Grid', UI.seg([['none', 'None'], ['dots', 'Dots'], ['lines', 'Lines'], ['cross', 'Cross'], ['iso', 'Iso']], D.grid.type, v => { D.grid.type = v; D.commit('Grid', []); R.req(); })),
      UI.field('Grid size', UI.range(8, 120, 2, D.grid.size, v => { D.grid.size = v; R.req(); }, { fmt: v => v + ' px' })), U.el('button', { class: 'btn sm', style: 'display:none' }),
      UI.toggle('Snap to grid', ST.v.snapGrid, v => ST.set('snapGrid', v)), UI.toggle('Snap to objects', ST.v.snapObjects, v => ST.set('snapObjects', v)), UI.toggle('Alignment guides', ST.v.guides, v => ST.set('guides', v)),
      UI.toggle('Show object dimensions', ST.v.dims, v => { ST.set('dims', v); R.reqOv(); }), UI.toggle('Show connection handles', ST.v.flow, v => { ST.set('flow', v); R.reqOv(); }),
      U.el('div', { class: 'hint' }, 'Select an object to see its properties. Right-click (or long-press) for the full menu.'));
    root.append(b);
  },
  name(o) { return ({ stroke: 'Ink stroke', shape: 'Shape · ' + ((SHAPES[o.kind] || {}).n || ''), line: 'Line', connector: 'Connector', text: 'Text', sticky: 'Sticky note', frame: 'Frame', image: 'Image', video: 'Video', audio: 'Audio', file: 'File', embed: 'Web page', placeholder: 'Placeholder', table: 'Table', kanban: 'Kanban board', timeline: 'Timeline', matrix: 'Matrix', doc: 'Document', mindmap: 'Mind map' })[o.type] || o.type; },
  icon(t) { return ({ stroke: 'pen', shape: 'shapes', line: 'line', connector: 'connector', text: 'text', sticky: 'sticky', frame: 'frame', image: 'image', video: 'video', audio: 'mic', file: 'file', embed: 'browser', placeholder: 'placeholder', table: 'table', kanban: 'kanban', timeline: 'timeline', matrix: 'matrix', doc: 'doc', mindmap: 'mindmap' })[t] || 'shapes'; }
};

/* ---------- floating context bar ---------- */
const Ctx = {
  init() { Ctx.el = U.$('#ctxbar'); Bus.on('sel', Ctx.update); Bus.on('view', Ctx.pos); Bus.on('commit', Ctx.update); Bus.on('editing', Ctx.update); R.overlays.push(() => Ctx.pos()); },
  main(o) { const t = o.type; return { shape: ['fill', 'Fill'], sticky: ['color', 'Colour'], text: ['tc', 'Text colour'], line: ['color', 'Colour'], connector: ['color', 'Colour'], stroke: ['color', 'Colour'], frame: ['bg', 'Background'], doc: ['bgc', 'Paper'], kanban: ['bg', 'Board'], timeline: ['cardc', 'Cards'], table: ['fill', 'Cells'] }[t]; },
  update() {
    const el = Ctx.el, objs = Sel.objs(); if (!objs.length || Ed.cur || (Rec && Rec.on)) { el.classList.remove('on'); return; }
    el.innerHTML = ''; const one = objs.length === 1 ? objs[0] : null; const b = (ic, title, fn, cls = '') => el.append(U.el('button', { class: 'ibtn ' + cls, title, html: U.icon(ic, 18), onclick: fn }));
    const m = one && Ctx.main(one);
    if (m) { const sw = UI.swatchBtn(one[m[0]], c => { one[m[0]] = c; if (one.type === 'shape' && m[0] === 'fill' && c !== 'none') one.tc = U.isDark(c) ? '#ffffff' : '#1f2430'; const tt = T.get(one.type); if (tt.fit) tt.fit(one); Insp.touch([one], 'Colour'); }, { none: one.type === 'shape', title: m[1], palette: one.type === 'sticky' ? U.STICKY : undefined }); el.append(sw); }
    if (one && ['shape', 'line', 'connector'].includes(one.type)) { const k = one.type === 'shape' ? 'stroke' : 'color'; el.append(UI.swatchBtn(one[k], c => { one[k] = c; Insp.touch([one], 'Colour'); }, { title: 'Border / line colour' })); }
    if (objs.length > 1) { b('group', 'Group', () => Act.group()); }
    else if (one && one.gid) b('ungroup', 'Ungroup', () => Act.ungroup());
    b('duplicate', 'Duplicate (Ctrl+D)', () => Act.duplicate());
    b('layers', 'Arrange', e => UI.menu(e.currentTarget, Menus.arrange(), { side: 'bottom' }));
    if (objs.length > 1) b('align', 'Align & distribute', e => UI.menu(e.currentTarget, Menus.alignItems(), { side: 'bottom' }));
    b(objs.every(o => o.locked) ? 'lock' : 'unlock', 'Lock / unlock', () => Act.lock(), objs.every(o => o.locked) ? 'on' : '');
    b('link', 'Link', () => Act.setLink()); b('comment', 'Add comment', () => { const c = G.center(objs[0]); Act.addComment(c[0], c[1], objs[0].id); });
    b('settings', 'Properties', () => Panels.show('design')); b('trash', 'Delete', () => Act.del(), 'danger'); b('more', 'More', e => { const r = e.currentTarget.getBoundingClientRect(); Menus.context(r.left, r.bottom + 6, one, null); });
    el.classList.add('on'); Ctx.pos();
  },
  pos() {
    const el = Ctx.el; if (!el.classList.contains('on')) return; const st = Tools.st; if (st && ['move', 'resize', 'rot', 'lend', 'cend', 'cnew', 'marquee', 'inner', 'pan'].includes(st.k) && Tools.moved) { el.style.opacity = 0; el.style.pointerEvents = 'none'; return; }
    el.style.opacity = 1; el.style.pointerEvents = '';
    const objs = Sel.objs(); if (!objs.length) return; const u = G.union(objs); const a = R.w2s(u.x, u.y), b = R.w2s(u.x + u.w, u.y + u.h); const w = el.offsetWidth, h = el.offsetHeight;
    let x = (a[0] + b[0]) / 2 - w / 2, y = a[1] - h - 46; if (y < 8) y = b[1] + 46; if (y + h > R.H - 8) y = Math.max(8, a[1] + 12);
    el.style.left = U.clamp(x, 8, Math.max(8, R.W - w - 8)) + 'px'; el.style.top = U.clamp(y, 8, Math.max(8, R.H - h - 8)) + 'px';
  }
};

/* ---------- panels dock ---------- */
const Panels = {
  ext: {}, tab: null, tabs: [['design', 'Properties', 'settings'], ['layers', 'Layers', 'layers'], ['pages', 'Pages', 'pages'], ['comments', 'Comments', 'comment'], ['history', 'History', 'history'], ['find', 'Find', 'find']],
  init() {
    Panels.el = U.$('#panel'); Bus.on('sel', () => { if (Panels.tab === 'design') Panels.render(); else if (ST.v.autoPanel !== false && Sel.ids.length && !Panels.tab && innerWidth > 1100 && !Panels.dismissed) Panels.show('design'); });
    Bus.on('struct', U.debounce(() => { if (Panels.tab && Panels.tab !== 'design' && Panels.tab !== 'find') Panels.render(); }, 120)); Bus.on('comments', () => { if (Panels.tab === 'comments') Panels.render(); }); Bus.on('versions', () => { if (Panels.tab === 'history') Panels.render(); });
    Bus.on('commit', U.debounce(() => { if (Panels.tab === 'design' && !Panels.busy) { const a = document.activeElement; if (!(a && Panels.el.contains(a) && /INPUT|TEXTAREA|SELECT/.test(a.tagName))) Panels.render(); } }, 250));
  },
  show(tab) { Panels.tab = tab; Panels.dismissed = false; Panels.el.classList.add('on'); Panels.render(); Bus.emit('panel'); },
  hide() { Panels.tab = null; Panels.dismissed = true; Panels.el.classList.remove('on'); Bus.emit('panel'); },
  toggle(tab) { if (Panels.tab === tab) Panels.hide(); else Panels.show(tab); },
  render() {
    const el = Panels.el, tab = Panels.tab; if (!tab) return; el.innerHTML = '';
    const head = U.el('div', { class: 'phead' }); Panels.tabs.forEach(([k, l, ic]) => head.append(U.el('button', { class: 'ptab' + (k === tab ? ' on' : ''), title: l, html: U.icon(ic, 18), onclick: () => Panels.show(k) }))); head.append(U.el('span', { class: 'sp' }), UI.ibtn('close', 'Close panel', () => Panels.hide()));
    const body = U.el('div', { class: 'pscroll' }); el.append(head, U.el('div', { class: 'pname' }, (Panels.tabs.find(t => t[0] === tab) || [0, ''])[1]), body);
    const map = { design: () => Insp.design(body), layers: () => LayersP.render(body), pages: () => PagesP.render(body), comments: () => CommentsP.render(body), history: () => HistoryP.render(body), find: () => FindP.render(body) }; for (const k in Panels.ext) map[k] = () => Panels.ext[k](body); map[tab]();
  }
};

const LayersP = {
  render(root) {
    root.append(U.el('div', { class: 'btnrow' }, UI.btn('New layer', 'plus', () => { Act.addLayer(); }, 'sm primary'), UI.btn('Move selection here', 'layers', () => { if (Sel.ids.length) Act.toLayer(D.active); else UI.toast('Select objects first'); }, 'sm')));
    const list = U.el('div', { class: 'llist' });
    [...D.layers].reverse().forEach(l => {
      const cnt = D.objs.filter(o => o.layer === l.id).length; const row = U.el('div', { class: 'lrow' + (l.id === D.active ? ' on' : '') });
      const name = U.el('span', { class: 'lname', ondblclick: async () => { const v = await UI.prompt('Rename layer', l.n); if (v) { l.n = v; D.commit('Rename layer', []); } } }, l.n);
      row.append(UI.ibtn(l.v ? 'eye' : 'eyeOff', 'Show / hide', e => { e.stopPropagation(); l.v = !l.v; D.invalidate(); D.commit('Layer visibility', []); }), UI.ibtn(l.l ? 'lock' : 'unlock', 'Lock / unlock', e => { e.stopPropagation(); l.l = !l.l; D.commit('Layer lock', []); }), name, U.el('span', { class: 'lcnt' }, cnt),
        UI.ibtn('more', 'Layer options', e => { e.stopPropagation(); UI.menu(e.currentTarget, [{ label: 'Select all in layer', icon: 'select', fn: () => Sel.set(D.objs.filter(o => o.layer === l.id).map(o => o.id)) }, { label: 'Rename', icon: 'text', fn: async () => { const v = await UI.prompt('Rename layer', l.n); if (v) { l.n = v; D.commit('Rename layer', []); } } }, { label: 'Move up', icon: 'chevU', fn: () => { const i = D.layers.indexOf(l); if (i < D.layers.length - 1) { [D.layers[i], D.layers[i + 1]] = [D.layers[i + 1], D.layers[i]]; D.invalidate(); D.commit('Reorder layers', []); } } }, { label: 'Move down', icon: 'chevD', fn: () => { const i = D.layers.indexOf(l); if (i > 0) { [D.layers[i], D.layers[i - 1]] = [D.layers[i - 1], D.layers[i]]; D.invalidate(); D.commit('Reorder layers', []); } } }, { label: 'Merge down', icon: 'layers', disabled: D.layers.indexOf(l) === 0, fn: () => { const i = D.layers.indexOf(l); D.objs.forEach(o => { if (o.layer === l.id) { o.layer = D.layers[i - 1].id; delete o._j; } }); D.layers.splice(i, 1); if (D.active === l.id) D.active = D.layers[i - 1].id; D.invalidate(); D.commit('Merge layer', []); } }, { sep: true }, { label: 'Delete layer', icon: 'trash', danger: true, disabled: D.layers.length < 2, fn: async () => { if (await UI.confirm('Delete this layer and its ' + cnt + ' objects?', 'Delete', true)) { D.remove(D.objs.filter(o => o.layer === l.id)); D.layers = D.layers.filter(x => x !== l); if (D.active === l.id) D.active = D.layers[0].id; D.commit('Delete layer', []); } } }]); }));
      row.addEventListener('click', () => { D.active = l.id; Panels.render(); });
      const op = UI.range(0, 100, 1, Math.round(l.o * 100), v => { l.o = v / 100; R.req(); }, { fmt: v => v + '%' }); op.classList.add('lop'); op.addEventListener('change', () => D.commit('Layer opacity', [])); op.addEventListener('click', e => e.stopPropagation());
      list.append(row, op);
    });
    root.append(list, U.el('div', { class: 'hint' }, 'New objects are created on the highlighted layer. Layers higher in the list are drawn on top.'));
  }
};
const PagesP = {
  render(root) {
    root.append(U.el('div', { class: 'btnrow' }, UI.btn('Add frame', 'plus', e => UI.menu(e.currentTarget, FRAME_PRESETS.map(p => ({ label: `${p[0]}  ·  ${p[1]}×${p[2]}`, fn: () => Act.addFramePreset(p) })), { side: 'bottom' }), 'sm primary'), UI.btn('Export all', 'download', () => IO.exportDialog({ scope: 'frames', fmt: 'pdf' }), 'sm')));
    const fr = D.frames(); if (!fr.length) root.append(U.el('div', { class: 'hint' }, 'Frames are pages / work areas. Add one, then organise your content inside it. Each frame can be exported as an image or a PDF page.'));
    fr.forEach((f, i) => {
      const cv = document.createElement('canvas'); const ar = f.w / f.h; cv.width = 220; cv.height = Math.round(220 / ar); cv.className = 'pthumb';
      try { const t = IO.renderCanvas({ area: { x: f.x, y: f.y, w: f.w, h: f.h }, all: true, frame: f, scale: 220 / f.w, bg: f.bg, clip: true }); cv.getContext('2d').drawImage(t, 0, 0, cv.width, cv.height); } catch (e) { }
      const row = U.el('div', { class: 'prow' + (Sel.has(f.id) ? ' on' : '') }, U.el('div', { class: 'pnum' }, i + 1), cv, U.el('div', { class: 'pinfo' }, U.el('b', null, f.name), U.el('span', null, `${Units.fmt(f.w)} × ${Units.fmt(f.h)} · ${f.ori}`)),
        UI.ibtn('more', 'Frame options', e => { e.stopPropagation(); UI.menu(e.currentTarget, [{ label: 'Go to', icon: 'fit', fn: () => { Sel.set([f.id]); R.fitRect(G.aabb(f), 60); } }, { label: 'Rename', icon: 'text', fn: async () => { const v = await UI.prompt('Frame name', f.name); if (v) { f.name = v; D.commit('Rename frame', f); } } }, { label: 'Swap orientation', icon: 'orient', fn: () => { Act.orientFrame(f); D.commit('Orientation', f); } }, { label: 'Duplicate with content', icon: 'duplicate', fn: () => { const kids = Act.frameChildren(f); const n = Act.clone([f, ...kids], { dx: f.w + 80, dy: 0 }); n[0].name = f.name + ' copy'; n.forEach(o => D.add(o)); Sel.set([n[0].id]); D.commit('Duplicate frame', n); } }, { label: 'Move up', icon: 'chevU', disabled: i === 0, fn: () => { const a = D.objs.indexOf(f), b = D.objs.indexOf(fr[i - 1]); [D.objs[a], D.objs[b]] = [D.objs[b], D.objs[a]]; D._ord = null; D.commit('Reorder frames', []); } }, { label: 'Move down', icon: 'chevD', disabled: i === fr.length - 1, fn: () => { const a = D.objs.indexOf(f), b = D.objs.indexOf(fr[i + 1]); [D.objs[a], D.objs[b]] = [D.objs[b], D.objs[a]]; D._ord = null; D.commit('Reorder frames', []); } }, { label: 'Export…', icon: 'download', fn: () => IO.exportDialog({ frame: f }) }, { sep: true }, { label: 'Delete frame', icon: 'trash', danger: true, fn: () => { D.remove([f]); Sel.ids = []; D.commit('Delete frame', []); } }]); }));
      row.addEventListener('click', () => { Sel.set([f.id]); R.fitRect(G.aabb(f), 60); }); root.append(row);
    });
  }
};
const CommentsP = {
  render(root) {
    root.append(U.el('div', { class: 'btnrow' }, UI.btn('Add comment', 'comment', () => { Tools.set('comment'); UI.toast('Click anywhere on the board'); }, 'sm primary'), UI.toggle('Show pins', ST.v.comments, v => { ST.set('comments', v); R.reqOv(); })));
    if (!D.comments.length) root.append(U.el('div', { class: 'hint' }, 'No comments yet. Use the comment tool or the comment button on any selected object.'));
    D.comments.forEach(c => { const f = c.msgs[0]; root.append(U.el('div', { class: 'crow' + (c.res ? ' res' : ''), onclick: () => Comments.goto(c.id) }, U.el('div', { class: 'avatar' }, (c.a || '?')[0].toUpperCase()), U.el('div', { class: 'cinfo' }, U.el('b', null, c.a), U.el('span', null, f ? f.m.slice(0, 80) : '(empty)'), U.el('small', null, `${c.msgs.length} message${c.msgs.length === 1 ? '' : 's'} · ${U.fmtDate(c.t)}${c.res ? ' · resolved' : ''}`)))); });
  }
};
const HistoryP = {
  mode: 'steps',
  render(root) {
    root.append(UI.seg([['steps', 'Undo steps'], ['versions', 'Saved versions']], HistoryP.mode, v => { HistoryP.mode = v; Panels.render(); }));
    if (HistoryP.mode === 'steps') {
      root.append(U.el('div', { class: 'btnrow' }, UI.btn('Undo', 'undo', () => D.undo(), 'sm'), UI.btn('Redo', 'redo', () => D.redo(), 'sm')));
      const l = U.el('div', { class: 'hlist' }); D.hist.forEach((h, i) => l.append(U.el('div', { class: 'hrow' + (i === D.hi ? ' on' : '') + (i > D.hi ? ' future' : ''), onclick: () => D.jump(i) }, U.el('span', null, h.label), U.el('small', null, U.fmtDate(h.t))))); root.append(l); setTimeout(() => { const on = l.querySelector('.on'); on && on.scrollIntoView({ block: 'nearest' }); }, 20);
    } else {
      root.append(U.el('div', { class: 'btnrow' }, UI.btn('Save version now', 'save', async () => { const n = await UI.prompt('Version name', 'Version ' + new Date().toLocaleTimeString()); if (n) { await D.saveVersion(n); UI.toast('Version saved'); } }, 'sm primary')));
      const l = U.el('div', { class: 'hlist' }); root.append(l);
      DB.byIndex('versions', 'bid', D.id).then(vs => { vs.sort((a, b) => b.t - a.t); if (!vs.length) l.append(U.el('div', { class: 'hint' }, 'No saved versions yet. Versions are also saved automatically every few minutes while you edit.')); vs.forEach(v => l.append(U.el('div', { class: 'hrow' }, U.el('span', null, v.name + (v.auto ? ' (auto)' : '')), U.el('small', null, U.fmtDate(v.t)), U.el('span', { class: 'sp' }), UI.btn('Restore', 'history', async () => { if (await UI.confirm('Restore this version? Your current state is kept in the undo history.', 'Restore')) { const j = JSON.parse(v.json); D.objs = j.objs.filter(o => T.reg[o.type]); D.byId = new Map(D.objs.map(o => [o.id, o])); D.bg = j.bg; D.grid = j.grid; D.layers = j.layers; D.active = j.active; D.comments = j.comments || []; D._ord = null; Sel.ids = []; D.commit('Restore version', 'all'); Bus.emit('sel'); } }, 'sm'), UI.ibtn('trash', 'Delete version', async () => { await DB.del('versions', v.id); Panels.render(); })))); });
    }
  }
};
const FindP = {
  q: '', hits: [], idx: 0,
  search(q) {
    FindP.q = q; const ql = q.toLowerCase(); FindP.hits = []; if (!ql) { R.reqOv(); return; }
    for (const o of D.objs) { const t = T.get(o.type); const strs = (t.text ? t.text(o) : []).filter(Boolean); const m = strs.find(s => String(s).toLowerCase().includes(ql)); if (m) FindP.hits.push({ o, s: String(m) }); }
    D.comments.forEach(c => { const m = c.msgs.find(x => x.m.toLowerCase().includes(ql)); if (m) FindP.hits.push({ c, s: m.m }); });
    FindP.idx = 0; R.reqOv();
  },
  go(i) { if (!FindP.hits.length) return; FindP.idx = (i + FindP.hits.length) % FindP.hits.length; const h = FindP.hits[FindP.idx]; if (h.o) { Sel.set([h.o.id]); R.fitRect(G.aabb(h.o), 140, true, 1.5); } else Comments.goto(h.c.id); FindP.mark(); },
  mark() { U.$$('.frow').forEach((r, i) => r.classList.toggle('on', i === FindP.idx)); },
  render(root) {
    const inp = U.el('input', { class: 'inp', type: 'search', placeholder: 'Find text on the board…', value: FindP.q }); const list = U.el('div', { class: 'flist' }); const info = U.el('div', { class: 'hint' });
    const draw = () => { list.innerHTML = ''; info.textContent = FindP.q ? `${FindP.hits.length} result${FindP.hits.length === 1 ? '' : 's'}` : 'Searches text in notes, shapes, tables, boards, mind maps, docs, file names and comments.'; FindP.hits.slice(0, 200).forEach((h, i) => { const s = h.s, ix = s.toLowerCase().indexOf(FindP.q.toLowerCase()); const sn = s.slice(Math.max(0, ix - 24), ix + 60); list.append(U.el('div', { class: 'frow' + (i === FindP.idx ? ' on' : ''), onclick: () => FindP.go(i) }, U.el('span', { html: U.icon(h.o ? Insp.icon(h.o.type) : 'comment', 16) }), U.el('span', { class: 'fsn' }, sn))); }); };
    inp.addEventListener('input', () => { FindP.search(inp.value); draw(); if (FindP.hits.length) FindP.go(0); });
    inp.addEventListener('keydown', e => { e.stopPropagation(); if (e.key === 'Enter') FindP.go(FindP.idx + (e.shiftKey ? -1 : 1)); });
    root.append(U.el('div', { class: 'row gap' }, inp, UI.ibtn('chevU', 'Previous', () => FindP.go(FindP.idx - 1)), UI.ibtn('chevD', 'Next', () => FindP.go(FindP.idx + 1))), info, list); draw(); setTimeout(() => inp.focus(), 50);
  },
  draw(ctx) { if (Panels.tab !== 'find' || !FindP.hits.length) return; FindP.hits.forEach((h, i) => { if (!h.o) return; const pts = G.corners(h.o).map(p => R.w2s(p[0], p[1])); ctx.strokeStyle = i === FindP.idx ? '#f59e0b' : 'rgba(245,158,11,.6)'; ctx.fillStyle = i === FindP.idx ? 'rgba(245,158,11,.22)' : 'rgba(245,158,11,.1)'; ctx.lineWidth = i === FindP.idx ? 3 : 1.5; ctx.beginPath(); pts.forEach((p, k) => k ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1])); ctx.closePath(); ctx.fill(); ctx.stroke(); }); }
};
R.overlays.push(ctx => FindP.draw(ctx));
