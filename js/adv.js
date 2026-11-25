'use strict';
/* ===== Advanced objects: table, kanban, timeline, matrix, doc, mindmap ===== */
const selInner = (o, k) => Sel.ids.length === 1 && Sel.ids[0] === o.id && Sel.inner && Sel.inner.k === k ? Sel.inner : null;
const ACC = '#6366f1';

/* ============ TABLE ============ */
const Tbl = {
  mk(rows, cols) {
    const cells = []; for (let r = 0; r < rows; r++) { cells.push([]); for (let c = 0; c < cols; c++) cells[r].push({ t: '', f: null, b: false, al: null }); }
    return { rows, cols, cw: Array(cols).fill(150), rh: Array(rows).fill(42), cells };
  },
  fit(o) {
    o.rows = o.cells.length; o.cols = o.cells[0].length;
    while (o.cw.length < o.cols) o.cw.push(150); o.cw.length = o.cols; while (o.rh.length < o.rows) o.rh.push(42); o.rh.length = o.rows;
    const rows = o.rh.map((m, r) => { let h = m; for (let c = 0; c < o.cols; c++) h = Math.max(h, Txt.height(o, o.cells[r][c].t, o.cw[c] - 18, o.fs) + 18); return h; });
    o._rows = rows; o.w = o.cw.reduce((a, b) => a + b, 0); o.h = rows.reduce((a, b) => a + b, 0);
  },
  cellAt(o, lx, ly) {
    let x = 0, c = -1; for (let i = 0; i < o.cols; i++) { if (lx >= x && lx < x + o.cw[i]) { c = i; break; } x += o.cw[i]; }
    let y = 0, r = -1; for (let i = 0; i < o.rows; i++) { if (ly >= y && ly < y + o._rows[i]) { r = i; break; } y += o._rows[i]; }
    return r < 0 || c < 0 ? null : { r, c };
  },
  rect(o, r, c) { let x = 0, y = 0; for (let i = 0; i < c; i++) x += o.cw[i]; for (let i = 0; i < r; i++) y += o._rows[i]; return { x, y, w: o.cw[c], h: o._rows[r] }; },
  edit(o, r, c) {
    Tbl.fit(o); const rc = Tbl.rect(o, r, c), cell = o.cells[r][c];
    Sel.inner = { k: 'cell', r, c }; Bus.emit('sel');
    Ed.text(o, {
      x: rc.x + 9, y: rc.y + 5, w: rc.w - 18, h: rc.h - 10, key: 'cell:' + r + ':' + c, fs: o.fs, al: cell.al || o.al, va: 'middle', color: o.tc, grow: false,
      get: () => cell.t, set: v => { cell.t = v; Tbl.fit(o); },
      onTab(back) { let nc = c + (back ? -1 : 1), nr = r; if (nc >= o.cols) { nc = 0; nr++; } if (nc < 0) { nc = o.cols - 1; nr--; } if (nr >= o.rows) { Act.tableAdd(o, 'row', o.rows); } if (nr >= 0) setTimeout(() => Tbl.edit(o, Math.min(nr, o.rows - 1), nc), 20); }
    });
  }
};
T.def('table', {
  def: () => Object.assign(Tbl.mk(3, 3), { w: 450, h: 126, hdr: true, hdrFill: '#e9ebff', zebra: false, line: '#c5cbdc', fs: 15, fnt: 'sans', b: false, i: false, u: false, al: 'left', tc: '#1f2430', fill: '#ffffff' }),
  conn: true, resize: 'free', noRot: false,
  fit: Tbl.fit,
  onResize(o, ow, oh) { const sx = o.w / ow, sy = o.h / oh; o.cw = o.cw.map(v => Math.max(40, v * sx)); o.rh = o._rows.map(v => Math.max(28, v * sy)); Tbl.fit(o); },
  draw(ctx, o, env) {
    if (!o._rows || o._rows.length !== o.rows) Tbl.fit(o);
    let y = 0; ctx.lineWidth = 1; ctx.strokeStyle = o.line;
    const inn = selInner(o, 'cell');
    for (let r = 0; r < o.rows; r++) {
      let x = 0; const h = o._rows[r];
      for (let c = 0; c < o.cols; c++) {
        const w = o.cw[c], cell = o.cells[r][c];
        ctx.fillStyle = cell.f || (o.hdr && r === 0 ? o.hdrFill : (o.zebra && r % 2 === 0 ? U.shade(o.fill, -.04) : o.fill)); ctx.fillRect(x, y, w, h);
        if (cell.t && !Ed.editing(o, 'cell:' + r + ':' + c)) { const hb = o.hdr && r === 0; const sv = o.b; o.b = o.b || cell.b || hb; Txt.draw(ctx, o, cell.t, x + 9, y + 5, w - 18, h - 10, { al: cell.al || o.al, va: 'middle' }); o.b = sv; }
        x += w;
      }
      y += h;
    }
    ctx.beginPath(); let yy = 0; for (let r = 0; r <= o.rows; r++) { ctx.moveTo(0, Math.round(yy) + .5); ctx.lineTo(o.w, Math.round(yy) + .5); yy += o._rows[r] || 0; }
    let xx = 0; for (let c = 0; c <= o.cols; c++) { ctx.moveTo(Math.round(xx) + .5, 0); ctx.lineTo(Math.round(xx) + .5, o.h); xx += o.cw[c] || 0; } ctx.stroke();
    if (inn && inn.r < o.rows && inn.c < o.cols && !env.exporting) { const rc = Tbl.rect(o, inn.r, inn.c); ctx.strokeStyle = ACC; ctx.lineWidth = 2.5 / env.z; ctx.strokeRect(rc.x, rc.y, rc.w, rc.h); }
  },
  down(o, lx, ly, ev) {
    const z = D.view.z, sel = Sel.ids.length === 1 && Sel.ids[0] === o.id;
    if (sel) {
      let x = 0; for (let c = 0; c < o.cols; c++) { x += o.cw[c]; if (Math.abs(lx - x) < 7 / z && ly > -4 && ly < o.h + 4) { const c0 = c, w0 = o.cw[c]; return { cursor: 'col-resize', move(mx) { o.cw[c0] = Math.max(40, w0 + mx - x); Tbl.fit(o); R.req(); }, up() { delete o._j; D.commit('Resize column', o); } }; } }
      let y = 0; for (let r = 0; r < o.rows; r++) { y += o._rows[r]; if (Math.abs(ly - y) < 7 / z && lx > -4 && lx < o.w + 4) { const r0 = r, h0 = o._rows[r]; return { cursor: 'row-resize', move(mx, my) { o.rh[r0] = Math.max(28, h0 + my - y); Tbl.fit(o); R.req(); }, up() { D.commit('Resize row', o); } }; } }
    }
    const ce = Tbl.cellAt(o, lx, ly); if (ce) { Sel.inner = { k: 'cell', r: ce.r, c: ce.c }; Bus.emit('sel'); R.reqOv(); }
    return false;
  },
  edit(o, lx, ly) { const ce = lx == null ? (selInner(o, 'cell') || { r: 0, c: 0 }) : Tbl.cellAt(o, lx, ly); if (ce) Tbl.edit(o, ce.r, ce.c); },
  text: o => o.cells.flat().map(c => c.t),
  ins: o => {
    const cell = () => { const i = Sel.inner && Sel.inner.k === 'cell' ? Sel.inner : { r: 0, c: 0 }; return (o.cells[i.r] || o.cells[0])[i.c] || o.cells[0][0]; };
    return [
      { sec: 'Table' },
      { t: 'btns', items: [{ l: 'Row above', ic: 'rowAdd', fn: o => Act.tableAdd(o, 'row', (Sel.inner && Sel.inner.r || 0)) }, { l: 'Row below', ic: 'rowAdd', fn: o => Act.tableAdd(o, 'row', (Sel.inner ? Sel.inner.r : o.rows - 1) + 1) }] },
      { t: 'btns', items: [{ l: 'Col left', ic: 'colAdd', fn: o => Act.tableAdd(o, 'col', (Sel.inner && Sel.inner.c || 0)) }, { l: 'Col right', ic: 'colAdd', fn: o => Act.tableAdd(o, 'col', (Sel.inner ? Sel.inner.c : o.cols - 1) + 1) }] },
      { t: 'btns', items: [{ l: 'Delete row', ic: 'trash', fn: o => Act.tableDel(o, 'row') }, { l: 'Delete column', ic: 'trash', fn: o => Act.tableDel(o, 'col') }] },
      { k: 'hdr', t: 'toggle', l: 'Header row' }, { k: 'zebra', t: 'toggle', l: 'Striped rows' },
      { k: 'fill', t: 'color', l: 'Cell background' }, { k: 'hdrFill', t: 'color', l: 'Header background', show: o => o.hdr }, { k: 'line', t: 'color', l: 'Grid colour' },
      { sec: 'Selected cell' },
      { t: 'color', l: 'Cell fill', none: true, get: () => cell().f || 'none', set: (o, v) => { cell().f = v === 'none' ? null : v; } },
      { t: 'seg', l: 'Cell align', opts: [['', 'Default'], ['left', 'L', 'alignLeftT'], ['center', 'C', 'alignCenterT'], ['right', 'R', 'alignRightT']], get: () => cell().al || '', set: (o, v) => { cell().al = v || null; } },
      { t: 'toggle', l: 'Cell bold', get: () => !!cell().b, set: (o, v) => { cell().b = v; } },
      { sec: 'Text' }, ...CTL.text({ noVa: true }).slice(1)
    ];
  }
});

/* ============ KANBAN ============ */
const Kb = {
  HH: 46, newCard: t => ({ id: U.uid('k'), t: t || '', c: null }),
  col(t, c, cards) { return { id: U.uid('c'), t, c, cards: cards || [] }; },
  lay(o) {
    const key = JSON.stringify(o.cols) + o.cw + o.fs + o.fnt + o.gap + o.pad; if (o._lk === key && o._lay) return o._lay;
    const pad = o.pad, cw = o.cw, hh = Kb.HH, cols = []; let x = pad, maxH = 0;
    o.cols.forEach((col, ci) => {
      let y = pad + hh + 10; const cards = [];
      col.cards.forEach((cd, ki) => { const th = Math.max(Txt.height(o, cd.t || ' ', cw - 44, o.fs) + 24, 44); cards.push({ id: cd.id, x: x + 10, y, w: cw - 20, h: th, ci, ki }); y += th + 10; });
      const add = { x: x + 10, y, w: cw - 20, h: 34 }; y += 34 + 10; cols.push({ x, w: cw, head: { x, y: pad, w: cw, h: hh }, cards, add, bottom: y }); x += cw + o.gap; maxH = Math.max(maxH, y);
    });
    const addCol = { x: x, y: pad, w: 44, h: hh };
    const lay = { cols, addCol, maxH: Math.max(maxH, pad + hh + 110) };
    o.w = x - o.gap + pad + 0; o.h = lay.maxH + pad - 10; o._lay = lay; o._lk = key; return lay;
  },
  fit(o) { delete o._lk; Kb.lay(o); },
  findCard(o, id) { for (const c of o.cols) { const i = c.cards.findIndex(k => k.id === id); if (i >= 0) return { col: c, i, card: c.cards[i] }; } return null; },
  hit(o, lx, ly) {
    const L = Kb.lay(o);
    for (let ci = 0; ci < L.cols.length; ci++) {
      const c = L.cols[ci]; for (const k of c.cards) if (lx >= k.x && lx <= k.x + k.w && ly >= k.y && ly <= k.y + k.h) return { t: 'card', ci, k, id: k.id };
      if (lx >= c.add.x && lx <= c.add.x + c.add.w && ly >= c.add.y && ly <= c.add.y + c.add.h) return { t: 'add', ci };
      if (lx >= c.head.x && lx <= c.head.x + c.head.w && ly >= c.head.y && ly <= c.head.y + c.head.h) return { t: 'head', ci, id: o.cols[ci].id };
    }
    const a = L.addCol; if (lx >= a.x && lx <= a.x + a.w && ly >= a.y && ly <= a.y + a.h) return { t: 'addcol' };
    return null;
  }
};
T.def('kanban', {
  def: () => ({ cols: [Kb.col('To do', '#6366f1', [Kb.newCard('First task'), Kb.newCard('Second task')]), Kb.col('In progress', '#f59e0b', [Kb.newCard('Working on…')]), Kb.col('Done', '#10b981', [])], cw: 250, gap: 14, pad: 14, fs: 15, fnt: 'sans', b: false, i: false, u: false, tc: '#1f2430', bg: '#eef0f6', cardc: '#ffffff', w: 800, h: 400 }),
  conn: true, resize: 'w',
  fit: Kb.fit,
  onResize(o, ow) { const n = o.cols.length; o.cw = Math.max(140, (o.w - 2 * o.pad - (n - 1) * o.gap) / n); Kb.fit(o); },
  draw(ctx, o, env) {
    const L = Kb.lay(o), inn = selInner(o, 'card'), inc = selInner(o, 'col'), dr = o._drag;
    ctx.fillStyle = o.bg; ctx.beginPath(); rr(ctx, 0, 0, o.w, o.h, 16); ctx.fill();
    L.cols.forEach((c, ci) => {
      const col = o.cols[ci];
      ctx.fillStyle = U.shade(o.bg, U.isDark(o.bg) ? .08 : -.035); ctx.beginPath(); rr(ctx, c.x, o.pad, c.w, o.h - 2 * o.pad + 10 - 10, 12); ctx.fill();
      ctx.fillStyle = col.c || ACC; ctx.beginPath(); rr(ctx, c.x + 10, o.pad + 12, 5, Kb.HH - 24, 3); ctx.fill();
      if (!Ed.editing(o, 'col:' + col.id)) { const sv = o.b; o.b = true; Txt.draw(ctx, o, col.t, c.x + 24, o.pad + 4, c.w - 70, Kb.HH - 8, { va: 'middle', al: 'left', fs: o.fs + 1 }); o.b = sv; }
      ctx.fillStyle = '#8a93a7'; ctx.font = '600 12px ' + U.FONTS.sans; ctx.textAlign = 'right'; ctx.textBaseline = 'middle'; ctx.fillText(col.cards.length, c.x + c.w - 14, o.pad + Kb.HH / 2);
      if (inc && inc.id === col.id && !env.exporting) { ctx.strokeStyle = ACC; ctx.lineWidth = 2 / env.z; ctx.beginPath(); rr(ctx, c.x, o.pad, c.w, Kb.HH, 10); ctx.stroke(); }
      c.cards.forEach(k => {
        if (dr && dr.id === k.id) return; const cd = col.cards[k.ki];
        ctx.save(); ctx.shadowColor = 'rgba(30,40,70,.16)'; ctx.shadowBlur = 6 * env.k; ctx.shadowOffsetY = 1.5 * env.k; ctx.fillStyle = cd.c || o.cardc; ctx.beginPath(); rr(ctx, k.x, k.y, k.w, k.h, 9); ctx.fill(); ctx.restore();
        if (!Ed.editing(o, 'card:' + cd.id)) Txt.draw(ctx, o, cd.t, k.x + 14, k.y + 6, k.w - 28, k.h - 12, { va: 'middle', al: 'left', color: cd.c && U.isDark(cd.c) ? '#fff' : o.tc });
        if (inn && inn.id === cd.id && !env.exporting) { ctx.strokeStyle = ACC; ctx.lineWidth = 2.5 / env.z; ctx.beginPath(); rr(ctx, k.x, k.y, k.w, k.h, 9); ctx.stroke(); }
      });
      if (!env.exporting) { ctx.fillStyle = '#8a93a7'; ctx.font = '600 13px ' + U.FONTS.sans; ctx.textAlign = 'left'; ctx.fillText('+  Add card', c.add.x + 10, c.add.y + c.add.h / 2); }
    });
    if (!env.exporting) { const a = L.addCol; ctx.strokeStyle = '#a5adc0'; ctx.setLineDash([5, 4]); ctx.lineWidth = 1.5; ctx.beginPath(); rr(ctx, a.x + 2, a.y, a.w - 4, a.h, 10); ctx.stroke(); ctx.setLineDash([]); ctx.fillStyle = '#7b8496'; ctx.font = '600 20px ' + U.FONTS.sans; ctx.textAlign = 'center'; ctx.fillText('+', a.x + a.w / 2, a.y + a.h / 2 + 1); }
    if (dr) {
      const c = L.cols[dr.ti]; if (c) { let iy; const tg = c.cards.filter(k => k.id !== dr.id); iy = dr.tk < tg.length ? tg[dr.tk].y - 5 : (tg.length ? tg[tg.length - 1].y + tg[tg.length - 1].h + 5 : o.pad + Kb.HH + 12); ctx.fillStyle = ACC; ctx.fillRect(c.x + 12, iy - 1.5, c.w - 24, 3); }
      ctx.save(); ctx.globalAlpha = .92; ctx.shadowColor = 'rgba(0,0,0,.3)'; ctx.shadowBlur = 14 * env.k; ctx.fillStyle = dr.color || o.cardc; ctx.translate(dr.x - dr.w / 2, dr.y - dr.h / 2); ctx.beginPath(); rr(ctx, 0, 0, dr.w, dr.h, 9); ctx.fill(); ctx.shadowColor = 'transparent'; Txt.draw(ctx, o, dr.t, 14, 6, dr.w - 28, dr.h - 12, { va: 'middle', al: 'left' }); ctx.restore();
    }
  },
  down(o, lx, ly, ev) {
    const sel = Sel.ids.length === 1 && Sel.ids[0] === o.id; const h = Kb.hit(o, lx, ly);
    if (!h) return false;
    if (h.t === 'card') {
      Sel.inner = { k: 'card', id: h.id }; Bus.emit('sel'); R.reqOv();
      if (!sel) return false;
      const f = Kb.findCard(o, h.id), k = h.k; let moved = false;
      return {
        cursor: 'grabbing', move(mx, my) {
          if (!moved && Math.hypot(mx - lx, my - ly) < 5) return; moved = true;
          const L = Kb.lay(o); let ti = 0; for (let i = 0; i < L.cols.length; i++) if (mx >= L.cols[i].x - o.gap / 2) ti = i;
          const c = L.cols[ti]; const tg = c.cards.filter(q => q.id !== h.id); let tk = tg.length; for (let i = 0; i < tg.length; i++) if (my < tg[i].y + tg[i].h / 2) { tk = i; break; }
          o._drag = { id: h.id, x: mx, y: my, w: k.w, h: k.h, t: f.card.t, color: f.card.c, ti, tk }; R.req();
        },
        up() { const d = o._drag; delete o._drag; if (d) { f.col.cards.splice(f.i, 1); o.cols[d.ti].cards.splice(d.tk, 0, f.card); Kb.fit(o); D.commit('Move card', o); } R.req(); }
      };
    }
    if (h.t === 'head') { Sel.inner = { k: 'col', id: h.id }; Bus.emit('sel'); R.reqOv(); return false; }
    return false;
  },
  tap(o, lx, ly) {
    const h = Kb.hit(o, lx, ly); if (!h) return false;
    if (h.t === 'add') { const c = o.cols[h.ci], cd = Kb.newCard(''); c.cards.push(cd); Kb.fit(o); Sel.inner = { k: 'card', id: cd.id }; D.commit('Add card', o); setTimeout(() => T.reg.kanban.editCard(o, cd.id), 30); return true; }
    if (h.t === 'addcol') { o.cols.push(Kb.col('New column', U.PALETTE[(o.cols.length * 3 + 4) % U.PALETTE.length], [])); Kb.fit(o); D.commit('Add column', o); return true; }
    return false;
  },
  editCard(o, id) {
    const f = Kb.findCard(o, id); if (!f) return; const L = Kb.lay(o); const k = L.cols.flatMap(c => c.cards).find(q => q.id === id); if (!k) return;
    Sel.inner = { k: 'card', id }; Ed.text(o, { x: k.x + 14, y: k.y + 6, w: k.w - 28, h: k.h - 12, key: 'card:' + id, fs: o.fs, al: 'left', va: 'middle', color: o.tc, grow: false, get: () => f.card.t, set: v => { f.card.t = v; Kb.fit(o); }, onTab() { } });
  },
  edit(o, lx, ly) {
    const h = lx == null ? null : Kb.hit(o, lx, ly); if (!h) { const i = selInner(o, 'card'); if (i) T.reg.kanban.editCard(o, i.id); return; }
    if (h.t === 'card') T.reg.kanban.editCard(o, h.id);
    else if (h.t === 'head') { const col = o.cols[h.ci], c = Kb.lay(o).cols[h.ci]; Sel.inner = { k: 'col', id: col.id }; Ed.text(o, { x: c.x + 22, y: o.pad + 6, w: c.w - 70, h: Kb.HH - 12, key: 'col:' + col.id, fs: o.fs + 1, al: 'left', va: 'middle', color: o.tc, bold: true, single: true, get: () => col.t, set: v => { col.t = v; } }); }
  },
  key(o, e) {
    const i = Sel.inner; if (!i) return false;
    if (i.k === 'card' && (e.key === 'Delete' || e.key === 'Backspace')) { const f = Kb.findCard(o, i.id); if (f) { f.col.cards.splice(f.i, 1); Sel.inner = null; Kb.fit(o); D.commit('Delete card', o); return true; } }
    if (i.k === 'card' && e.key === 'Enter') { T.reg.kanban.editCard(o, i.id); return true; }
    return false;
  },
  text: o => o.cols.flatMap(c => [c.t, ...c.cards.map(k => k.t)]),
  ins: o => [
    { sec: 'Kanban board' },
    { t: 'btns', items: [{ l: 'Add column', ic: 'plus', fn: o => { o.cols.push(Kb.col('New column', U.PALETTE[(o.cols.length * 3 + 4) % U.PALETTE.length], [])); } }, { l: 'Add card', ic: 'sticky', fn: o => { const i = selInner(o, 'col') || selInner(o, 'card'); let col = o.cols[0]; if (i && i.k === 'col') col = o.cols.find(c => c.id === i.id) || col; else if (i) { const f = Kb.findCard(o, i.id); if (f) col = f.col; } col.cards.push(Kb.newCard('New card')); } }] },
    { t: 'btns', items: [{ l: 'Delete column', ic: 'trash', fn: o => { const i = selInner(o, 'col') || (selInner(o, 'card') && { id: (Kb.findCard(o, Sel.inner.id) || {}).col && Kb.findCard(o, Sel.inner.id).col.id }); if (i && o.cols.length > 1) o.cols = o.cols.filter(c => c.id !== i.id); } }, { l: 'Delete card', ic: 'trash', fn: o => { const i = selInner(o, 'card'); if (i) { const f = Kb.findCard(o, i.id); if (f) f.col.cards.splice(f.i, 1); } } }] },
    { t: 'color', l: 'Selected column colour', get: o => { const i = selInner(o, 'col'); const c = i && o.cols.find(c => c.id === i.id); return c ? c.c : ACC; }, set: (o, v) => { const i = selInner(o, 'col'); const c = i && o.cols.find(c => c.id === i.id); if (c) c.c = v; } },
    { t: 'color', l: 'Selected card colour', none: true, palette: U.STICKY, get: o => { const i = selInner(o, 'card'); const f = i && Kb.findCard(o, i.id); return f && f.card.c || 'none'; }, set: (o, v) => { const i = selInner(o, 'card'); const f = i && Kb.findCard(o, i.id); if (f) f.card.c = v === 'none' ? null : v; } },
    { k: 'bg', t: 'color', l: 'Board colour' }, { k: 'cardc', t: 'color', l: 'Default card colour' },
    { k: 'cw', t: 'range', l: 'Column width', min: 160, max: 420, step: 5 }, { k: 'fs', t: 'range', l: 'Font size', min: 10, max: 28, step: 1 }
  ]
});

/* ============ TIMELINE ============ */
const Tl = {
  item: (t, d, n, c) => ({ id: U.uid('t'), t, d: d || '', n: n || '', c: c || null }),
  lay(o) {
    const key = JSON.stringify(o.items) + o.sp + o.dir + o.fs + o.fnt + o.h + o.w; if (o._lk === key && o._lay) return o._lay;
    const pad = 40, H = o.dir === 'h', n = o.items.length, cw = o.sp - 28; const out = [];
    if (H) { o.w = Math.max(200, pad * 2 + n * o.sp + 50); } else { o.h = Math.max(200, pad * 2 + n * o.sp + 50); }
    const axis = H ? o.h / 2 : o.w / 2;
    o.items.forEach((it, i) => {
      const pos = pad + o.sp * (i + .5), side = i % 2 ? 1 : -1;
      const th = Txt.height(o, it.t || ' ', cw - 20, o.fs + 1) + (it.d ? o.fs * 1.4 : 0) + (it.n ? Txt.height(o, it.n, cw - 20, o.fs - 2) + 4 : 0) + 22;
      const cardH = Math.max(54, th), gap = 34;
      let card;
      if (H) card = { x: pos - cw / 2, y: side < 0 ? axis - gap - cardH : axis + gap, w: cw, h: cardH };
      else card = { x: side < 0 ? axis - gap - cw : axis + gap, y: pos - cardH / 2, w: cw, h: cardH };
      out.push({ id: it.id, i, dot: H ? [pos, axis] : [axis, pos], card, side });
    });
    const maxExt = Math.max(0, ...out.map(l => H ? Math.max(axis - l.card.y, l.card.y + l.card.h - axis) : Math.max(axis - l.card.x, l.card.x + l.card.w - axis)));
    if (H) { o.h = Math.max(o.h, 2 * maxExt + 40); } else { o.w = Math.max(o.w, 2 * maxExt + 40); }
    const ax2 = H ? o.h / 2 : o.w / 2; if (ax2 !== axis) { out.forEach(l => { const dx = H ? 0 : ax2 - axis, dy = H ? ax2 - axis : 0; l.dot[0] += dx; l.dot[1] += dy; l.card.x += dx; l.card.y += dy; }); }
    const lay = { items: out, add: H ? [pad + o.sp * n + 24, ax2] : [ax2, pad + o.sp * n + 24], axis: ax2 }; o._lay = lay; o._lk = JSON.stringify(o.items) + o.sp + o.dir + o.fs + o.fnt + o.h + o.w; return lay;
  },
  fit(o) { delete o._lk; Tl.lay(o); },
  hit(o, lx, ly) {
    const L = Tl.lay(o);
    for (const l of L.items) { const c = l.card; if (lx >= c.x && lx <= c.x + c.w && ly >= c.y && ly <= c.y + c.h || Math.hypot(lx - l.dot[0], ly - l.dot[1]) < 14) return { t: 'item', id: l.id, l }; }
    if (Math.hypot(lx - L.add[0], ly - L.add[1]) < 16) return { t: 'add' };
    return null;
  }
};
T.def('timeline', {
  def: () => ({ items: [Tl.item('Kick-off', 'Jan', 'Project starts', '#6366f1'), Tl.item('Design', 'Feb', '', '#ec4899'), Tl.item('Build', 'Mar', '', '#f59e0b'), Tl.item('Launch', 'Apr', '', '#10b981')], dir: 'h', sp: 220, lc: '#9aa3b2', lw: 4, fs: 15, fnt: 'sans', b: false, i: false, u: false, tc: '#1f2430', cardc: '#ffffff', w: 960, h: 320 }),
  conn: true, resize: 'free', fit: Tl.fit,
  onResize(o, ow, oh) { if (o.dir === 'h') { o.sp = U.clamp(o.sp * o.w / ow, 120, 500); } else { o.sp = U.clamp(o.sp * o.h / oh, 90, 500); } Tl.fit(o); },
  draw(ctx, o, env) {
    const L = Tl.lay(o), H = o.dir === 'h', inn = selInner(o, 'item');
    ctx.strokeStyle = o.lc; ctx.lineWidth = o.lw; ctx.lineCap = 'round'; ctx.beginPath();
    if (H) { ctx.moveTo(10, L.axis); ctx.lineTo(o.w - 10, L.axis); } else { ctx.moveTo(L.axis, 10); ctx.lineTo(L.axis, o.h - 10); } ctx.stroke();
    L.items.forEach(l => {
      const it = o.items[l.i], col = it.c || ACC, c = l.card;
      ctx.strokeStyle = col; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(l.dot[0], l.dot[1]); if (H) ctx.lineTo(l.dot[0], l.side < 0 ? c.y + c.h : c.y); else ctx.lineTo(l.side < 0 ? c.x + c.w : c.x, l.dot[1]); ctx.stroke();
      ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(l.dot[0], l.dot[1], 11, 0, 7); ctx.fill(); ctx.fillStyle = col; ctx.beginPath(); ctx.arc(l.dot[0], l.dot[1], 7, 0, 7); ctx.fill();
      ctx.save(); ctx.shadowColor = 'rgba(30,40,70,.18)'; ctx.shadowBlur = 8 * env.k; ctx.shadowOffsetY = 2 * env.k; ctx.fillStyle = o.cardc; ctx.beginPath(); rr(ctx, c.x, c.y, c.w, c.h, 10); ctx.fill(); ctx.restore();
      ctx.fillStyle = col; ctx.beginPath(); ctx.save(); rr(ctx, c.x, c.y, c.w, c.h, 10); ctx.clip(); ctx.fillRect(c.x, c.y, 5, c.h); ctx.restore();
      let y = c.y + 8;
      if (it.d) { ctx.fillStyle = col; ctx.font = '700 ' + (o.fs - 2) + 'px ' + U.FONTS[o.fnt]; ctx.textAlign = 'left'; ctx.textBaseline = 'top'; ctx.fillText(it.d.toUpperCase(), c.x + 14, y); y += o.fs * 1.4; }
      const th = Txt.height(o, it.t || ' ', c.w - 20, o.fs + 1);
      if (!Ed.editing(o, 'item:' + it.id)) { const sv = o.b; o.b = true; Txt.draw(ctx, o, it.t, c.x + 14, y, c.w - 20, th, { va: 'top', al: 'left', fs: o.fs + 1 }); o.b = sv; }
      y += th; if (it.n) { Txt.draw(ctx, o, it.n, c.x + 14, y + 2, c.w - 20, 400, { va: 'top', al: 'left', fs: o.fs - 2, color: '#6b7280' }); }
      if (inn && inn.id === it.id && !env.exporting) { ctx.strokeStyle = ACC; ctx.lineWidth = 2.5 / env.z; ctx.beginPath(); rr(ctx, c.x, c.y, c.w, c.h, 10); ctx.stroke(); }
    });
    if (!env.exporting) { ctx.fillStyle = '#fff'; ctx.strokeStyle = '#a5adc0'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(L.add[0], L.add[1], 12, 0, 7); ctx.fill(); ctx.stroke(); ctx.fillStyle = '#7b8496'; ctx.font = '600 18px ' + U.FONTS.sans; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('+', L.add[0], L.add[1] + 1); }
  },
  down(o, lx, ly) { const h = Tl.hit(o, lx, ly); if (h && h.t === 'item') { Sel.inner = { k: 'item', id: h.id }; Bus.emit('sel'); R.reqOv(); } return false; },
  tap(o, lx, ly) { const h = Tl.hit(o, lx, ly); if (h && h.t === 'add') { const it = Tl.item('New milestone', '', '', U.PALETTE[(o.items.length * 3 + 4) % U.PALETTE.length]); o.items.push(it); Tl.fit(o); Sel.inner = { k: 'item', id: it.id }; D.commit('Add milestone', o); return true; } return false; },
  edit(o, lx, ly) {
    const h = lx == null ? (selInner(o, 'item') && { id: Sel.inner.id, l: Tl.lay(o).items.find(l => l.id === Sel.inner.id) }) : Tl.hit(o, lx, ly); if (!h || !h.l) return;
    const it = o.items.find(i => i.id === h.id), c = h.l.card; Sel.inner = { k: 'item', id: it.id };
    const yo = it.d ? o.fs * 1.4 : 0;
    Ed.text(o, { x: c.x + 12, y: c.y + 8 + yo, w: c.w - 20, h: Math.max(24, Txt.height(o, it.t || ' ', c.w - 20, o.fs + 1)), key: 'item:' + it.id, fs: o.fs + 1, al: 'left', va: 'top', color: o.tc, bold: true, get: () => it.t, set: v => { it.t = v; Tl.fit(o); }, grow: true });
  },
  key(o, e) { const i = selInner(o, 'item'); if (i && (e.key === 'Delete' || e.key === 'Backspace') && o.items.length > 1) { o.items = o.items.filter(x => x.id !== i.id); Sel.inner = null; Tl.fit(o); D.commit('Delete milestone', o); return true; } return false; },
  text: o => o.items.flatMap(i => [i.t, i.d, i.n]),
  ins: o => {
    const cur = () => { const i = selInner(o, 'item'); return o.items.find(x => x.id === (i && i.id)) || o.items[0]; };
    return [
      { sec: 'Timeline' },
      { k: 'dir', t: 'seg', l: 'Direction', opts: [['h', 'Horizontal'], ['v', 'Vertical']], after: o => { const t = o.w; if (o.dir === 'h') { o.w = o.h; o.h = t; } else { o.w = o.h; o.h = t; } o.w = Math.max(o.w, 300); o.h = Math.max(o.h, 300); } },
      { t: 'btns', items: [{ l: 'Add milestone', ic: 'plus', fn: o => { o.items.push(Tl.item('New milestone', '', '', U.PALETTE[(o.items.length * 3 + 4) % U.PALETTE.length])); } }, { l: 'Delete', ic: 'trash', fn: o => { const i = selInner(o, 'item'); if (i && o.items.length > 1) o.items = o.items.filter(x => x.id !== i.id); } }] },
      { t: 'btns', items: [{ l: 'Move earlier', ic: 'chevL', fn: o => { const i = o.items.indexOf(cur()); if (i > 0) [o.items[i - 1], o.items[i]] = [o.items[i], o.items[i - 1]]; } }, { l: 'Move later', ic: 'chevR', fn: o => { const i = o.items.indexOf(cur()); if (i < o.items.length - 1) [o.items[i + 1], o.items[i]] = [o.items[i], o.items[i + 1]]; } }] },
      { sec: 'Selected milestone' },
      { t: 'text', l: 'Title', get: () => cur().t, set: (o, v) => { cur().t = v; } }, { t: 'text', l: 'Date / label', get: () => cur().d, set: (o, v) => { cur().d = v; } }, { t: 'text', l: 'Notes', ml: true, get: () => cur().n, set: (o, v) => { cur().n = v; } },
      { t: 'color', l: 'Colour', get: () => cur().c || ACC, set: (o, v) => { cur().c = v; } },
      { sec: 'Style' }, { k: 'lc', t: 'color', l: 'Line colour' }, { k: 'lw', t: 'range', l: 'Line width', min: 1, max: 14, step: 1 }, { k: 'sp', t: 'range', l: 'Spacing', min: 120, max: 420, step: 5 }, { k: 'cardc', t: 'color', l: 'Card colour' }, { k: 'fs', t: 'range', l: 'Font size', min: 10, max: 28, step: 1 }
    ];
  }
});

/* ============ MATRIX ============ */
const MX_PRESETS = {
  'Impact / Effort': { rows: 2, cols: 2, xl: 'Effort', yl: 'Impact', xlo: 'Low', xhi: 'High', ylo: 'Low', yhi: 'High', title: 'Impact / Effort', cells: [['Big bets', '#fde68a'], ['Quick wins', '#bbf7d0'], ['Money pit', '#fecaca'], ['Fill-ins', '#e5e7eb']] },
  'Eisenhower': { rows: 2, cols: 2, xl: 'Urgent', yl: 'Important', xlo: 'No', xhi: 'Yes', ylo: 'No', yhi: 'Yes', title: 'Eisenhower matrix', cells: [['Schedule', '#bfdbfe'], ['Do first', '#fecaca'], ['Eliminate', '#e5e7eb'], ['Delegate', '#fde68a']] },
  'SWOT': { rows: 2, cols: 2, xl: '', yl: '', xlo: '', xhi: '', ylo: '', yhi: '', title: 'SWOT analysis', cells: [['Strengths', '#bbf7d0'], ['Weaknesses', '#fecaca'], ['Opportunities', '#bfdbfe'], ['Threats', '#fde68a']] },
  '3 × 3 Risk': { rows: 3, cols: 3, xl: 'Likelihood', yl: 'Impact', xlo: 'Low', xhi: 'High', ylo: 'Low', yhi: 'High', title: 'Risk matrix', cells: ['#bbf7d0', '#d9f99d', '#fde68a', '#d9f99d', '#fde68a', '#fed7aa', '#fde68a', '#fed7aa', '#fecaca'].map(c => ['', c]) },
  'Empty 2 × 2': { rows: 2, cols: 2, xl: 'X axis', yl: 'Y axis', xlo: 'Low', xhi: 'High', ylo: 'Low', yhi: 'High', title: 'Matrix', cells: [['', '#f3f4f8'], ['', '#eef0ff'], ['', '#eef0ff'], ['', '#f3f4f8']] }
};
const Mx = {
  apply(o, p) { Object.assign(o, { rows: p.rows, cols: p.cols, xl: p.xl, yl: p.yl, xlo: p.xlo, xhi: p.xhi, ylo: p.ylo, yhi: p.yhi, title: p.title, cells: p.cells.map(c => ({ t: c[0], c: c[1] })) }); },
  geo(o) { const lm = o.yl || o.ylo ? 54 : 16, bm = o.xl || o.xlo ? 54 : 16, tm = o.title ? 52 : 16; return { gx: lm, gy: tm, gw: o.w - lm - 16, gh: o.h - tm - bm, lm, bm, tm }; },
  rects(o) { const g = Mx.geo(o), cw = g.gw / o.cols, ch = g.gh / o.rows; return Array.from({ length: o.rows * o.cols }, (_, i) => ({ x: g.gx + (i % o.cols) * cw, y: g.gy + Math.floor(i / o.cols) * ch, w: cw, h: ch })); },
  hit(o, lx, ly) {
    const rs = Mx.rects(o); for (let i = 0; i < rs.length; i++) { const r = rs[i]; if (lx >= r.x && lx <= r.x + r.w && ly >= r.y && ly <= r.y + r.h) return { t: 'cell', i, r }; }
    const g = Mx.geo(o); if (ly < g.gy) return { t: 'title' }; if (ly > g.gy + g.gh && lx > g.gx) return { t: 'xl' }; if (lx < g.gx && ly > g.gy) return { t: 'yl' }; return null;
  }
};
T.def('matrix', {
  def: () => Object.assign({ w: 640, h: 520, fs: 16, fnt: 'sans', b: false, i: false, u: false, tc: '#1f2430', line: '#9aa3b2', ac: '#4b5563' }, (() => { const o = {}; Mx.apply(o, MX_PRESETS['Impact / Effort']); return o; })()),
  conn: true, resize: 'free',
  draw(ctx, o, env) {
    const g = Mx.geo(o), rs = Mx.rects(o), inn = selInner(o, 'cell');
    ctx.fillStyle = '#fff'; ctx.beginPath(); rr(ctx, 0, 0, o.w, o.h, 14); ctx.fill();
    if (o.title && !Ed.editing(o, 'title')) { const sv = o.b; o.b = true; Txt.draw(ctx, o, o.title, 16, 6, o.w - 32, 44, { va: 'middle', al: 'center', fs: o.fs + 6 }); o.b = sv; }
    rs.forEach((r, i) => {
      const cell = o.cells[i] || { t: '', c: '#f3f4f8' }; ctx.fillStyle = cell.c || '#f3f4f8'; ctx.fillRect(r.x, r.y, r.w, r.h);
      if (cell.t && !Ed.editing(o, 'cell:' + i)) { const sv = o.b; o.b = true; Txt.draw(ctx, o, cell.t, r.x + 12, r.y + 8, r.w - 24, 30, { va: 'top', al: 'left', color: U.isDark(cell.c) ? '#fff' : o.tc }); o.b = sv; }
    });
    ctx.strokeStyle = o.line; ctx.lineWidth = 2; ctx.strokeRect(g.gx, g.gy, g.gw, g.gh); ctx.lineWidth = 1.2; ctx.beginPath();
    for (let c = 1; c < o.cols; c++) { const x = g.gx + g.gw / o.cols * c; ctx.moveTo(x, g.gy); ctx.lineTo(x, g.gy + g.gh); } for (let r = 1; r < o.rows; r++) { const y = g.gy + g.gh / o.rows * r; ctx.moveTo(g.gx, y); ctx.lineTo(g.gx + g.gw, y); } ctx.stroke();
    ctx.fillStyle = o.ac; ctx.textBaseline = 'middle'; ctx.font = '600 ' + (o.fs - 2) + 'px ' + U.FONTS[o.fnt];
    if (o.xl || o.xlo) { ctx.textAlign = 'center'; ctx.font = '700 ' + o.fs + 'px ' + U.FONTS[o.fnt]; if (!Ed.editing(o, 'xl')) ctx.fillText(o.xl + (o.xl ? '  →' : ''), g.gx + g.gw / 2, g.gy + g.gh + 32); ctx.font = '600 ' + (o.fs - 3) + 'px ' + U.FONTS[o.fnt]; ctx.textAlign = 'left'; ctx.fillText(o.xlo, g.gx, g.gy + g.gh + 14); ctx.textAlign = 'right'; ctx.fillText(o.xhi, g.gx + g.gw, g.gy + g.gh + 14); }
    if (o.yl || o.ylo) { ctx.save(); ctx.translate(18, g.gy + g.gh / 2); ctx.rotate(-Math.PI / 2); ctx.textAlign = 'center'; ctx.font = '700 ' + o.fs + 'px ' + U.FONTS[o.fnt]; if (!Ed.editing(o, 'yl')) ctx.fillText(o.yl + (o.yl ? '  →' : ''), 0, 0); ctx.font = '600 ' + (o.fs - 3) + 'px ' + U.FONTS[o.fnt]; ctx.textAlign = 'left'; ctx.fillText(o.ylo, -g.gh / 2, 20); ctx.textAlign = 'right'; ctx.fillText(o.yhi, g.gh / 2, 20); ctx.restore(); }
    if (inn && rs[inn.i] && !env.exporting) { const r = rs[inn.i]; ctx.strokeStyle = ACC; ctx.lineWidth = 3 / env.z; ctx.strokeRect(r.x, r.y, r.w, r.h); }
  },
  down(o, lx, ly) { const h = Mx.hit(o, lx, ly); if (h && h.t === 'cell') { Sel.inner = { k: 'cell', i: h.i }; Bus.emit('sel'); R.reqOv(); } return false; },
  edit(o, lx, ly) {
    const h = lx == null ? (selInner(o, 'cell') ? { t: 'cell', i: Sel.inner.i, r: Mx.rects(o)[Sel.inner.i] } : { t: 'title' }) : Mx.hit(o, lx, ly); if (!h) return; const g = Mx.geo(o);
    const base = { fs: o.fs, color: o.tc, single: true, va: 'middle', al: 'center' };
    if (h.t === 'cell') { const cell = o.cells[h.i]; Sel.inner = { k: 'cell', i: h.i }; Ed.text(o, Object.assign({}, base, { x: h.r.x + 10, y: h.r.y + 6, w: h.r.w - 20, h: 32, key: 'cell:' + h.i, al: 'left', bold: true, get: () => cell.t, set: v => { cell.t = v; } })); }
    else if (h.t === 'title') Ed.text(o, Object.assign({}, base, { x: 16, y: 6, w: o.w - 32, h: 44, key: 'title', fs: o.fs + 6, bold: true, get: () => o.title, set: v => { o.title = v; } }));
    else if (h.t === 'xl') Ed.text(o, Object.assign({}, base, { x: g.gx + g.gw / 2 - 120, y: g.gy + g.gh + 20, w: 240, h: 26, key: 'xl', get: () => o.xl, set: v => { o.xl = v; } }));
    else if (h.t === 'yl') Ed.text(o, Object.assign({}, base, { x: 4, y: g.gy + g.gh / 2 - 13, w: 28, h: 26, key: 'yl', get: () => o.yl, set: v => { o.yl = v; } }));
  },
  text: o => [o.title, o.xl, o.yl, ...o.cells.map(c => c.t)],
  ins: o => [
    { sec: 'Matrix' },
    { t: 'select', l: 'Preset', opts: [['', 'Choose preset…'], ...Object.keys(MX_PRESETS).map(k => [k, k])], get: () => '', set: (o, v) => { if (v) Mx.apply(o, MX_PRESETS[v]); } },
    { k: 'title', t: 'text', l: 'Title' }, { k: 'xl', t: 'text', l: 'X axis label' }, { k: 'yl', t: 'text', l: 'Y axis label' },
    { k: 'xlo', t: 'text', l: 'X low' }, { k: 'xhi', t: 'text', l: 'X high' }, { k: 'ylo', t: 'text', l: 'Y low' }, { k: 'yhi', t: 'text', l: 'Y high' },
    { k: 'rows', t: 'num', l: 'Rows', min: 1, max: 6, after: o => Mx.resize(o) }, { k: 'cols', t: 'num', l: 'Columns', min: 1, max: 6, after: o => Mx.resize(o) },
    { t: 'color', l: 'Selected cell colour', get: o => { const i = selInner(o, 'cell'); return i && o.cells[i.i] ? o.cells[i.i].c : '#f3f4f8'; }, set: (o, v) => { const i = selInner(o, 'cell'); if (i && o.cells[i.i]) o.cells[i.i].c = v; } },
    { k: 'line', t: 'color', l: 'Grid colour' }, { k: 'ac', t: 'color', l: 'Axis text colour' }, { k: 'fs', t: 'range', l: 'Font size', min: 10, max: 30, step: 1 }
  ]
});
Mx.resize = o => { const n = o.rows * o.cols; while (o.cells.length < n) o.cells.push({ t: '', c: '#f3f4f8' }); o.cells.length = n; };

/* ============ DOC (markdown note) ============ */
const Md = {
  inline(s) {
    const runs = []; let re = /(\*\*[^*]+\*\*|\*[^*]+\*|`[^`]+`|~~[^~]+~~)/g, last = 0, m;
    while ((m = re.exec(s))) { if (m.index > last) runs.push({ t: s.slice(last, m.index) }); const tk = m[0]; if (tk.startsWith('**')) runs.push({ t: tk.slice(2, -2), b: 1 }); else if (tk.startsWith('~~')) runs.push({ t: tk.slice(2, -2), s: 1 }); else if (tk[0] === '*') runs.push({ t: tk.slice(1, -1), i: 1 }); else runs.push({ t: tk.slice(1, -1), c: 1 }); last = m.index + tk.length; }
    if (last < s.length) runs.push({ t: s.slice(last) }); return runs;
  },
  parse(md) {
    const out = []; let num = 0;
    for (const raw of String(md).split('\n')) {
      let m, line = raw;
      if ((m = /^(#{1,3})\s+(.*)$/.exec(line))) { out.push({ k: 'h' + m[1].length, runs: Md.inline(m[2]) }); num = 0; }
      else if ((m = /^\s*[-*]\s+\[( |x)\]\s+(.*)$/i.exec(line))) { out.push({ k: 'todo', done: m[1].toLowerCase() === 'x', runs: Md.inline(m[2]), src: raw }); }
      else if ((m = /^\s*[-*]\s+(.*)$/.exec(line))) { out.push({ k: 'li', runs: Md.inline(m[1]) }); num = 0; }
      else if ((m = /^\s*(\d+)[.)]\s+(.*)$/.exec(line))) { out.push({ k: 'ol', n: ++num, runs: Md.inline(m[2]) }); }
      else if ((m = /^>\s?(.*)$/.exec(line))) { out.push({ k: 'q', runs: Md.inline(m[1]) }); num = 0; }
      else if (/^-{3,}\s*$/.test(line)) { out.push({ k: 'hr', runs: [] }); num = 0; }
      else if (!line.trim()) { out.push({ k: 'sp', runs: [] }); num = 0; }
      else { out.push({ k: 'p', runs: Md.inline(line) }); num = 0; }
    }
    return out;
  },
  runFont(o, fs, r, base) { return `${r.i || o.i ? 'italic ' : ''}${(r.b || base.b || o.b) ? '700 ' : '400 '}${fs}px ${r.c ? U.FONTS.mono : U.FONTS[o.fnt]}`; },
  layout(o) {
    const key = o.md + o.fs + o.fnt + o.w + o.title + o.b + o.i; if (o._lk === key && o._lay) return o._lay;
    const pad = 22, W = o.w - pad * 2, ctx = U.mctx, blocks = []; let y = pad;
    if (o.title) { const fs = o.fs * 1.7; const lines = U.wrap(o.title, `700 ${fs}px ${U.FONTS[o.fnt]}`, W); blocks.push({ k: 'title', lines, y, fs, h: lines.length * fs * 1.25 }); y += lines.length * fs * 1.25 + 10; }
    for (const b of Md.parse(o.md)) {
      const fs = b.k === 'h1' ? o.fs * 1.6 : b.k === 'h2' ? o.fs * 1.35 : b.k === 'h3' ? o.fs * 1.15 : o.fs; const base = { b: /^h/.test(b.k) };
      const ind = b.k === 'li' || b.k === 'ol' || b.k === 'todo' ? 26 : b.k === 'q' ? 18 : 0; const lh = fs * 1.4;
      if (b.k === 'sp') { y += o.fs * .6; continue; } if (b.k === 'hr') { blocks.push({ k: 'hr', y: y + 6, h: 14 }); y += 14; continue; }
      // word wrap across runs
      const lines = [[]]; let x = 0; const avail = W - ind;
      for (const r of b.runs) for (const w of r.t.split(/(\s+)/)) { if (!w) continue; ctx.font = Md.runFont(o, fs, r, base); const ww = ctx.measureText(w).width; if (x + ww > avail && x > 0 && w.trim()) { lines.push([]); x = 0; } if (!(x === 0 && !w.trim())) { lines[lines.length - 1].push({ t: w, r, w: ww }); x += ww; } }
      blocks.push({ k: b.k, b, lines, y, fs, lh, ind, base, h: lines.length * lh }); y += lines.length * lh + (/^h/.test(b.k) ? 4 : 2);
    }
    y += pad - 6; const lay = { blocks, pad }; o.h = Math.max(160, y); o._lay = lay; o._lk = key; return lay;
  },
  edit(o) { return { md: o.md }; }
};
T.def('doc', {
  def: () => ({ w: 440, h: 300, title: 'Untitled doc', md: '## Notes\nWrite **bold**, *italic* or `code`.\n\n- Bullet one\n- Bullet two\n\n1. First\n2. Second\n\n- [ ] A task\n- [x] A finished task\n\n> A quote', fs: 16, fnt: 'sans', b: false, i: false, u: false, tc: '#1f2430', bgc: '#ffffff', border: '#d6dae3' }),
  conn: true, resize: 'w', fit(o) { delete o._lk; Md.layout(o); },
  draw(ctx, o, env) {
    const L = Md.layout(o); ctx.save(); ctx.shadowColor = 'rgba(30,40,70,.14)'; ctx.shadowBlur = 10 * env.k; ctx.shadowOffsetY = 2 * env.k; ctx.fillStyle = o.bgc; ctx.beginPath(); rr(ctx, 0, 0, o.w, o.h, 12); ctx.fill(); ctx.restore();
    ctx.strokeStyle = o.border; ctx.lineWidth = 1; ctx.beginPath(); rr(ctx, 0, 0, o.w, o.h, 12); ctx.stroke();
    ctx.textBaseline = 'middle'; ctx.textAlign = 'left';
    const editing = Ed.editing(o, 'md');
    for (const b of L.blocks) {
      if (b.k === 'title') { if (Ed.editing(o, 'title')) continue; ctx.font = `700 ${b.fs}px ${U.FONTS[o.fnt]}`; ctx.fillStyle = o.tc; b.lines.forEach((l, i) => ctx.fillText(l, L.pad, b.y + (i + .5) * b.fs * 1.25)); continue; }
      if (editing) continue;
      if (b.k === 'hr') { ctx.strokeStyle = '#d6dae3'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(L.pad, b.y); ctx.lineTo(o.w - L.pad, b.y); ctx.stroke(); continue; }
      const col = o.tc;
      if (b.k === 'q') { ctx.fillStyle = '#c7cbf7'; ctx.fillRect(L.pad, b.y, 4, b.h); }
      if (b.k === 'li') { ctx.fillStyle = col; ctx.beginPath(); ctx.arc(L.pad + 8, b.y + b.lh / 2, 3, 0, 7); ctx.fill(); }
      if (b.k === 'ol') { ctx.fillStyle = col; ctx.font = `${b.fs}px ${U.FONTS[o.fnt]}`; ctx.fillText(b.b.n + '.', L.pad + 2, b.y + b.lh / 2); }
      if (b.k === 'todo') { const s = b.fs * .8; ctx.strokeStyle = b.b.done ? ACC : '#9aa3b2'; ctx.lineWidth = 1.8; ctx.fillStyle = b.b.done ? ACC : '#fff'; ctx.beginPath(); rr(ctx, L.pad + 2, b.y + (b.lh - s) / 2, s, s, 3); ctx.fill(); ctx.stroke(); if (b.b.done) { ctx.strokeStyle = '#fff'; ctx.beginPath(); ctx.moveTo(L.pad + 2 + s * .22, b.y + b.lh / 2); ctx.lineTo(L.pad + 2 + s * .42, b.y + b.lh / 2 + s * .22); ctx.lineTo(L.pad + 2 + s * .78, b.y + b.lh / 2 - s * .2); ctx.stroke(); } }
      b.lines.forEach((ln, li) => {
        let x = L.pad + b.ind; const cy = b.y + (li + .5) * b.lh;
        for (const w of ln) {
          ctx.font = Md.runFont(o, b.fs, w.r, b.base); ctx.fillStyle = b.k === 'q' ? '#6b7280' : (b.k === 'todo' && b.b.done ? '#9aa3b2' : col);
          if (w.r.c) { ctx.fillStyle = '#eef0f6'; ctx.fillRect(x - 2, cy - b.fs * .6, w.w + 4, b.fs * 1.2); ctx.fillStyle = '#b4236c'; }
          ctx.fillText(w.t, x, cy);
          if (w.r.s || (b.k === 'todo' && b.b.done)) ctx.fillRect(x, cy, w.w, 1.4);
          x += w.w;
        }
      });
    }
  },
  tap(o, lx, ly) {
    const L = Md.layout(o);
    for (const b of L.blocks) if (b.k === 'todo' && ly >= b.y && ly <= b.y + b.h && lx < L.pad + b.fs + 10) {
      const lines = o.md.split('\n'); const i = lines.findIndex(l => l === b.b.src); if (i >= 0) { lines[i] = /\[x\]/i.test(lines[i]) ? lines[i].replace(/\[x\]/i, '[ ]') : lines[i].replace('[ ]', '[x]'); o.md = lines.join('\n'); Md.layout(o); D.commit('Toggle task', o); return true; }
    }
    return false;
  },
  edit(o, lx, ly) {
    const L = Md.layout(o);
    if (lx != null && o.title !== undefined) { const tb = L.blocks[0]; if (tb && tb.k === 'title' && ly < tb.y + tb.h + 6) { Ed.text(o, { x: L.pad, y: tb.y, w: o.w - 2 * L.pad, h: tb.h, key: 'title', fs: tb.fs, al: 'left', va: 'top', color: o.tc, bold: true, single: false, get: () => o.title, set: v => { o.title = v; Md.layout(o); } }); return; } }
    const tb = L.blocks[0] && L.blocks[0].k === 'title' ? L.blocks[0] : null; const y0 = tb ? tb.y + tb.h + 10 : L.pad;
    Ed.text(o, { x: L.pad - 4, y: y0, w: o.w - 2 * L.pad + 8, h: Math.max(80, o.h - y0 - 12), key: 'md', fs: o.fs, al: 'left', va: 'top', color: o.tc, grow: true, mono: true, toolbar: 'md', get: () => o.md, set: v => { o.md = v; Md.layout(o); } });
  },
  text: o => [o.title, o.md],
  ins: o => [{ sec: 'Document' }, { k: 'title', t: 'text', l: 'Title' }, { k: 'md', t: 'text', l: 'Content (markdown)', ml: true }, { k: 'bgc', t: 'color', l: 'Paper colour' }, { k: 'border', t: 'color', l: 'Border' }, ...CTL.text({ noVa: true })]
});

/* ============ MIND MAP ============ */
const MM_THEMES = {
  colorful: ['#6366f1', '#ec4899', '#f59e0b', '#10b981', '#0ea5e9', '#8b5cf6', '#ef4444', '#14b8a6'],
  ocean: ['#0369a1', '#0891b2', '#0d9488', '#2563eb', '#4f46e5', '#0284c7', '#0e7490', '#1d4ed8'],
  sunset: ['#dc2626', '#ea580c', '#d97706', '#db2777', '#9333ea', '#be123c', '#c2410c', '#a21caf'],
  mono: ['#475569', '#64748b', '#334155', '#52525b', '#57534e', '#44403c', '#3f3f46', '#1e293b']
};
const Mm = {
  node: (t, ch) => ({ id: U.uid('n'), t, ch: ch || [], col: false, c: null }),
  find(n, id, parent = null) { if (n.id === id) return { n, parent }; for (const c of n.ch) { const r = Mm.find(c, id, n); if (r) return r; } return null; },
  size(o, n, depth) {
    const fs = depth === 0 ? o.fs * 1.25 : o.fs; const font = `${depth === 0 ? '700 ' : '400 '}${fs}px ${U.FONTS[o.fnt]}`;
    const lines = U.wrap(n.t || ' ', font, 220); let w = 0; U.mctx.font = font; lines.forEach(l => w = Math.max(w, U.mctx.measureText(l).width));
    return { w: Math.max(depth === 0 ? 110 : 56, w + (depth === 0 ? 40 : 28)), h: lines.length * fs * 1.3 + (depth === 0 ? 26 : 16), lines, fs };
  },
  layout(o) {
    const key = JSON.stringify(o.root) + o.fs + o.fnt + o.dir + o.gx + o.gy; if (o._lk === key && o._lay) return o._lay;
    const nodes = []; const sizeMap = new Map();
    const measure = (n, d) => { sizeMap.set(n.id, Mm.size(o, n, d)); if (!n.col) n.ch.forEach(c => measure(c, d + 1)); };
    measure(o.root, 0);
    const sub = new Map(); // subtree height (vertical layout) / width (down layout)
    const down = o.dir === 'down';
    const span = n => { const s = sizeMap.get(n.id); let r; if (n.col || !n.ch.length) r = down ? s.w : s.h; else { const tot = n.ch.reduce((a, c) => a + span(c), 0) + (n.ch.length - 1) * o.gy; r = Math.max(down ? s.w : s.h, tot); } sub.set(n.id, r); return r; };
    span(o.root);
    const place = (n, depth, side, a, b, px) => { // a..b span along cross axis; px = position along main axis
      const s = sizeMap.get(n.id); const mid = (a + b) / 2;
      const rec = { n, depth, side, w: s.w, h: s.h, lines: s.lines, fs: s.fs, parent: null };
      if (down) { rec.x = mid - s.w / 2; rec.y = px; } else { rec.cy = mid; rec.x = side > 0 ? px : px - s.w; rec.y = mid - s.h / 2; }
      nodes.push(rec);
      if (n.col || !n.ch.length) return rec;
      const tot = n.ch.reduce((x, c) => x + sub.get(c.id), 0) + (n.ch.length - 1) * o.gy; let cur = mid - tot / 2;
      for (const c of n.ch) {
        const cs = sub.get(c.id), cr = place(c, depth + 1, side, cur, cur + cs, down ? px + s.h + o.gx : (side > 0 ? px + s.w + o.gx : px - s.w - o.gx));
        cr.parent = rec; cur += cs + o.gy;
      }
      return rec;
    };
    const root = o.root; const rs = sizeMap.get(root.id);
    let rec;
    if (o.dir === 'both' && root.ch.length > 1 && !root.col) {
      const half = Math.ceil(root.ch.length / 2), R_ = root.ch.slice(0, half), L_ = root.ch.slice(half);
      const hr = R_.reduce((a, c) => a + sub.get(c.id), 0) + (R_.length - 1) * o.gy, hl = L_.reduce((a, c) => a + sub.get(c.id), 0) + (L_.length - 1) * o.gy;
      const H = Math.max(hr, hl, rs.h); const rr0 = { n: root, depth: 0, side: 1, w: rs.w, h: rs.h, lines: rs.lines, fs: rs.fs, x: 0, y: H / 2 - rs.h / 2, parent: null }; nodes.push(rr0); rec = rr0;
      const doSide = (list, side, tot) => { let cur = H / 2 - tot / 2; for (const c of list) { const cs = sub.get(c.id); const cr = place(c, 1, side, cur, cur + cs, side > 0 ? rs.w + o.gx : -o.gx); cr.parent = rr0; cur += cs + o.gy; } };
      doSide(R_, 1, hr); doSide(L_, -1, hl);
    } else if (down) rec = place(root, 0, 1, 0, sub.get(root.id), 0);
    else rec = place(root, 0, o.dir === 'left' ? -1 : 1, 0, sub.get(root.id), o.dir === 'left' ? rs.w : 0);
    let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9; nodes.forEach(r => { x0 = Math.min(x0, r.x); y0 = Math.min(y0, r.y); x1 = Math.max(x1, r.x + r.w + 20); y1 = Math.max(y1, r.y + r.h); });
    const pad = 24; nodes.forEach(r => { r.x += pad - x0; r.y += pad - y0; });
    const rootRec = nodes.find(r => r.depth === 0);
    if (o._root) { o.x += o._root[0] - rootRec.x; o.y += o._root[1] - rootRec.y; } o._root = [rootRec.x, rootRec.y];
    o.w = x1 - x0 + 2 * pad; o.h = y1 - y0 + 2 * pad;
    // colour assignment
    const pal = MM_THEMES[o.theme] || MM_THEMES.colorful; const top = new Map(); root.ch.forEach((c, i) => top.set(c.id, c.c || pal[i % pal.length]));
    nodes.forEach(r => { let p = r; while (p.parent && p.parent.depth > 0) p = p.parent; r.color = r.n.c || (r.depth === 0 ? (o.rootc || '#1f2430') : (r.depth === 1 ? top.get(r.n.id) : (r.parent && r.parent.color) || '#6366f1')); if (r.depth > 1 && !r.n.c) { const tp = p; r.color = top.get(tp.n.id) || r.color; } });
    const lay = { nodes, byId: new Map(nodes.map(r => [r.n.id, r])) }; o._lay = lay; o._lk = key; return lay;
  },
  fit(o) { delete o._lk; Mm.layout(o); },
  hit(o, lx, ly) {
    const L = Mm.layout(o);
    for (let i = L.nodes.length - 1; i >= 0; i--) { const r = L.nodes[i]; if (r.n.ch.length) { const [cx, cy] = Mm.toggleXY(o, r); if (Math.hypot(lx - cx, ly - cy) < 10) return { t: 'toggle', r }; } }
    for (let i = L.nodes.length - 1; i >= 0; i--) { const r = L.nodes[i]; if (lx >= r.x && lx <= r.x + r.w && ly >= r.y && ly <= r.y + r.h) return { t: 'node', r }; }
    return null;
  },
  toggleXY(o, r) { return o.dir === 'down' ? [r.x + r.w / 2, r.y + r.h + 10] : [r.side > 0 ? r.x + r.w + 10 : r.x - 10, r.y + r.h / 2]; },
  anchorOut(o, r, toward) { if (o.dir === 'down') return [r.x + r.w / 2, r.y + r.h]; return r.depth === 0 ? [toward > 0 ? r.x + r.w : r.x, r.y + r.h / 2] : [r.side > 0 ? r.x + r.w : r.x, r.y + r.h / 2]; },
  anchorIn(o, r) { return o.dir === 'down' ? [r.x + r.w / 2, r.y] : [r.side > 0 ? r.x : r.x + r.w, r.y + r.h / 2]; },
  addChild(o, id) { const f = Mm.find(o.root, id || o.root.id); if (!f) return null; const c = Mm.node('New idea'); f.n.ch.push(c); f.n.col = false; Mm.fit(o); Sel.inner = { k: 'node', id: c.id }; return c; },
  addSibling(o, id) { const f = Mm.find(o.root, id); if (!f || !f.parent) return Mm.addChild(o, id); const c = Mm.node('New idea'); const i = f.parent.ch.indexOf(f.n); f.parent.ch.splice(i + 1, 0, c); Mm.fit(o); Sel.inner = { k: 'node', id: c.id }; return c; },
  del(o, id) { const f = Mm.find(o.root, id); if (!f || !f.parent) return false; f.parent.ch = f.parent.ch.filter(c => c.id !== id); Sel.inner = { k: 'node', id: f.parent.id }; Mm.fit(o); return true; },
  editNode(o, id) {
    const L = Mm.layout(o), r = L.byId.get(id); if (!r) return; const f = Mm.find(o.root, id); Sel.inner = { k: 'node', id };
    Ed.text(o, { x: r.x + 8, y: r.y + 4, w: Math.max(r.w - 16, 80), h: r.h - 8, key: 'node:' + id, fs: r.fs, al: 'center', va: 'middle', color: r.depth === 0 ? '#fff' : '#1f2430', bold: r.depth === 0, get: () => f.n.t, set: v => { f.n.t = v; Mm.fit(o); }, grow: true, onEnter: true, onTab() { const c = Mm.addChild(o, id); R.req(); D.commit('Add node', o); setTimeout(() => Mm.editNode(o, c.id), 30); } });
  }
};
T.def('mindmap', {
  def: () => ({ root: Mm.node('Central idea', [Mm.node('Topic A', [Mm.node('Detail 1'), Mm.node('Detail 2')]), Mm.node('Topic B', [Mm.node('Detail 3')]), Mm.node('Topic C'), Mm.node('Topic D')]), dir: 'both', branch: 'curve', nodeStyle: 'pill', theme: 'colorful', fs: 17, fnt: 'sans', gx: 70, gy: 14, lw: 3, rootc: '#1f2430', w: 600, h: 400 }),
  conn: true, resize: 'none', noRot: true, fit: Mm.fit,
  draw(ctx, o, env) {
    const L = Mm.layout(o), inn = selInner(o, 'node'), dr = o._drag;
    ctx.lineCap = 'round';
    for (const r of L.nodes) {
      if (!r.parent) continue; if (dr && dr.id === r.n.id) continue;
      const p = r.parent, a = Mm.anchorOut(o, p, r.side), b = Mm.anchorIn(o, r); const w = Math.max(1.6, o.lw - (r.depth - 1) * .7);
      ctx.strokeStyle = r.color; ctx.lineWidth = w; ctx.beginPath(); ctx.moveTo(a[0], a[1]);
      if (o.branch === 'line') ctx.lineTo(b[0], b[1]);
      else if (o.branch === 'elbow') { if (o.dir === 'down') { const my = (a[1] + b[1]) / 2; ctx.lineTo(a[0], my); ctx.lineTo(b[0], my); ctx.lineTo(b[0], b[1]); } else { const mx = (a[0] + b[0]) / 2; ctx.lineTo(mx, a[1]); ctx.lineTo(mx, b[1]); ctx.lineTo(b[0], b[1]); } }
      else if (o.dir === 'down') { const my = (a[1] + b[1]) / 2; ctx.bezierCurveTo(a[0], my, b[0], my, b[0], b[1]); } else { const mx = (a[0] + b[0]) / 2; ctx.bezierCurveTo(mx, a[1], mx, b[1], b[0], b[1]); }
      ctx.stroke();
    }
    for (const r of L.nodes) {
      if (dr && dr.id === r.n.id) continue;
      const root = r.depth === 0; ctx.save();
      if (o.nodeStyle === 'line' && !root) { ctx.strokeStyle = r.color; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(r.x, r.y + r.h); ctx.lineTo(r.x + r.w, r.y + r.h); ctx.stroke(); }
      else { ctx.beginPath(); const rad = o.nodeStyle === 'box' && !root ? 8 : r.h / 2; rr(ctx, r.x, r.y, r.w, r.h, root ? Math.min(28, r.h / 2) : rad);
        if (root) { ctx.fillStyle = r.color; ctx.shadowColor = 'rgba(0,0,0,.2)'; ctx.shadowBlur = 10 * env.k; ctx.shadowOffsetY = 2 * env.k; ctx.fill(); } else { ctx.fillStyle = U.alpha(r.color, .13); ctx.fill(); ctx.strokeStyle = r.color; ctx.lineWidth = 2; ctx.stroke(); } }
      ctx.restore();
      if (!Ed.editing(o, 'node:' + r.n.id)) { const sv = o.b; o.b = root; Txt.draw(ctx, o, r.n.t, r.x + 8, r.y + 4, r.w - 16, r.h - 8, { fs: r.fs, al: 'center', va: 'middle', color: root ? '#fff' : '#1f2430' }); o.b = sv; }
      if (inn && inn.id === r.n.id && !env.exporting) { ctx.strokeStyle = ACC; ctx.lineWidth = 2.5 / env.z; ctx.setLineDash([6 / env.z, 4 / env.z]); ctx.beginPath(); rr(ctx, r.x - 4, r.y - 4, r.w + 8, r.h + 8, r.h / 2 + 4); ctx.stroke(); ctx.setLineDash([]); }
      if (r.n.ch.length && !env.exporting) { const [cx, cy] = Mm.toggleXY(o, r); ctx.fillStyle = '#fff'; ctx.strokeStyle = r.color; ctx.lineWidth = 1.8; ctx.beginPath(); ctx.arc(cx, cy, 8, 0, 7); ctx.fill(); ctx.stroke(); ctx.fillStyle = r.color; ctx.fillRect(cx - 3.5, cy - .9, 7, 1.8); if (r.n.col) ctx.fillRect(cx - .9, cy - 3.5, 1.8, 7); }
    }
    if (dr) { ctx.save(); ctx.globalAlpha = .85; const r = dr.rec; ctx.translate(dr.x - r.w / 2 - r.x, dr.y - r.h / 2 - r.y); ctx.fillStyle = '#fff'; ctx.strokeStyle = r.color; ctx.lineWidth = 2; ctx.beginPath(); rr(ctx, r.x, r.y, r.w, r.h, r.h / 2); ctx.fill(); ctx.stroke(); Txt.draw(ctx, o, r.n.t, r.x + 8, r.y + 4, r.w - 16, r.h - 8, { fs: r.fs, al: 'center', va: 'middle', color: '#1f2430' }); ctx.restore(); if (dr.target) { const t = L.byId.get(dr.target); if (t) { ctx.strokeStyle = '#22c55e'; ctx.lineWidth = 3; ctx.beginPath(); rr(ctx, t.x - 4, t.y - 4, t.w + 8, t.h + 8, t.h / 2 + 4); ctx.stroke(); } } }
  },
  down(o, lx, ly) {
    const h = Mm.hit(o, lx, ly); if (!h) return false;
    if (h.t === 'toggle') return false;
    Sel.inner = { k: 'node', id: h.r.n.id }; Bus.emit('sel'); R.reqOv();
    if (h.r.depth === 0 || !(Sel.ids.length === 1 && Sel.ids[0] === o.id)) return false;
    let moved = false; const rec = h.r;
    return {
      cursor: 'grabbing', move(mx, my) {
        if (!moved && Math.hypot(mx - lx, my - ly) < 6) return; moved = true; const L = Mm.layout(o); let tg = null;
        const inSub = (n, id) => n.id === id || n.ch.some(c => inSub(c, id));
        for (const r of L.nodes) if (r.n.id !== rec.n.id && mx >= r.x && mx <= r.x + r.w && my >= r.y && my <= r.y + r.h && !inSub(rec.n, r.n.id)) tg = r.n.id;
        o._drag = { id: rec.n.id, x: mx, y: my, rec, target: tg }; R.req();
      },
      up() { const d = o._drag; delete o._drag; if (d && d.target) { const f = Mm.find(o.root, d.id), t = Mm.find(o.root, d.target); if (f && t && f.parent) { f.parent.ch = f.parent.ch.filter(c => c.id !== d.id); t.n.ch.push(f.n); t.n.col = false; Mm.fit(o); D.commit('Move node', o); } } R.req(); }
    };
  },
  tap(o, lx, ly) { const h = Mm.hit(o, lx, ly); if (h && h.t === 'toggle') { h.r.n.col = !h.r.n.col; Mm.fit(o); D.commit('Collapse', o); return true; } return false; },
  edit(o, lx, ly) { const h = lx == null ? (Sel.inner && Sel.inner.k === 'node' ? { r: { n: { id: Sel.inner.id } } } : { r: { n: { id: o.root.id } } }) : Mm.hit(o, lx, ly); if (h && h.r) Mm.editNode(o, h.r.n.id); },
  key(o, e) {
    const i = selInner(o, 'node'); if (!i) return false;
    if (e.key === 'Tab') { const c = Mm.addChild(o, i.id); D.commit('Add node', o); setTimeout(() => Mm.editNode(o, c.id), 30); return true; }
    if (e.key === 'Enter') { const c = Mm.addSibling(o, i.id); D.commit('Add node', o); setTimeout(() => Mm.editNode(o, c.id), 30); return true; }
    if (e.key === 'Delete' || e.key === 'Backspace') { if (Mm.del(o, i.id)) { D.commit('Delete node', o); return true; } }
    if (e.key === 'F2' || e.key === ' ') { Mm.editNode(o, i.id); return true; }
    if (e.key.startsWith('Arrow')) { const L = Mm.layout(o), r = L.byId.get(i.id); if (!r) return true; let t = null; const n = r.n; const f = Mm.find(o.root, i.id);
      if (e.key === 'ArrowRight') t = r.side > 0 || r.depth === 0 ? (n.ch[0] && !n.col ? n.ch[0] : null) : (f.parent); if (e.key === 'ArrowLeft') t = r.side < 0 && r.depth > 0 ? (n.ch[0] && !n.col ? n.ch[0] : null) : (f.parent && r.depth > 0 ? f.parent : (r.depth === 0 && o.dir === 'both' && o.root.ch[Math.ceil(o.root.ch.length / 2)] || null));
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') { if (f.parent) { const k = f.parent.ch.indexOf(n) + (e.key === 'ArrowDown' ? 1 : -1); t = f.parent.ch[k] || null; } }
      if (t) { Sel.inner = { k: 'node', id: t.id }; Bus.emit('sel'); R.req(); } return true; }
    return false;
  },
  text: o => { const a = []; const w = n => { a.push(n.t); n.ch.forEach(w); }; w(o.root); return a; },
  ins: o => [
    { sec: 'Mind map' },
    { t: 'btns', items: [{ l: 'Add child', ic: 'nodeAdd', fn: o => { Mm.addChild(o, selInner(o, 'node') ? Sel.inner.id : o.root.id); } }, { l: 'Add sibling', ic: 'sibling', fn: o => { Mm.addSibling(o, selInner(o, 'node') ? Sel.inner.id : o.root.id); } }] },
    { t: 'btns', items: [{ l: 'Delete node', ic: 'trash', fn: o => { if (selInner(o, 'node')) Mm.del(o, Sel.inner.id); } }, { l: 'Edit text', ic: 'text', fn: o => Mm.editNode(o, selInner(o, 'node') ? Sel.inner.id : o.root.id) }] },
    { t: 'color', l: 'Selected node colour', none: true, get: o => { const i = selInner(o, 'node'); const f = i && Mm.find(o.root, i.id); return f && f.n.c || 'none'; }, set: (o, v) => { const i = selInner(o, 'node'); const f = i && Mm.find(o.root, i.id); if (f) f.n.c = v === 'none' ? null : v; } },
    { k: 'dir', t: 'select', l: 'Layout', opts: [['both', 'Both sides'], ['right', 'Right'], ['left', 'Left'], ['down', 'Top-down']] },
    { k: 'branch', t: 'seg', l: 'Branches', opts: [['curve', 'Curve'], ['elbow', 'Elbow'], ['line', 'Line']] },
    { k: 'nodeStyle', t: 'seg', l: 'Nodes', opts: [['pill', 'Pill'], ['box', 'Box'], ['line', 'Underline']] },
    { k: 'theme', t: 'select', l: 'Theme', opts: [['colorful', 'Colourful'], ['ocean', 'Ocean'], ['sunset', 'Sunset'], ['mono', 'Mono']] },
    { k: 'rootc', t: 'color', l: 'Root colour' }, { k: 'fs', t: 'range', l: 'Font size', min: 10, max: 36, step: 1 }, { k: 'lw', t: 'range', l: 'Branch width', min: 1, max: 8, step: .5 },
    { k: 'gx', t: 'range', l: 'Level spacing', min: 30, max: 160, step: 2 }, { k: 'gy', t: 'range', l: 'Sibling spacing', min: 4, max: 60, step: 1 }
  ]
});
