'use strict';
/* ===== App shell: home gallery, open/close boards, settings, boot ===== */
const App = {
  boards: [], view: 'home',
  async boot() {
    ST.load(); await DB.open(); UI.init(); App.theme();
    R.init(U.$('#stage')); Tools.init(); Embeds.init(); Ctx.init(); Panels.init(); TB.init(); Keys.init(); IO.initDnD(); try { Rec.load(); } catch (e) { }
    Bus.on('settings', k => { if (k === 'theme' || k === '*') App.theme(); R.req(); });
    Bus.on('commit', () => { D.dirty = true; D.modified = Date.now(); Bus.emit('saved', 'saving'); D.queueSave(); });
    window.addEventListener('hashchange', App.route); window.addEventListener('beforeunload', e => { if (D.id && D.dirty) { D.save(false); } });
    document.addEventListener('visibilitychange', () => { if (document.hidden && D.id) D.save(false); });
    window.addEventListener('pagehide', () => { if (D.id) D.save(false); });
    document.addEventListener('contextmenu', e => { if (!e.target.closest('input,textarea')) e.preventDefault(); });
    if ('serviceWorker' in navigator && location.protocol.startsWith('http')) navigator.serviceWorker.register('sw.js').catch(() => { });
    await App.route(); U.$('#splash') && U.$('#splash').remove();
  },
  theme() { const t = ST.v.theme === 'auto' ? (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light') : ST.v.theme; document.documentElement.dataset.theme = t; },
  async route() {
    const h = location.hash.replace(/^#\/?/, ''); const m = /^b\/([\w-]+)(?:\/(.*))?$/.exec(h);
    // share target: ?title=&text=&url=
    const q = new URLSearchParams(location.search); const shared = q.get('url') || q.get('text');
    if (m) { if (D.id !== m[1]) await App.open(m[1]); if (m[2]) App.goLink(m[2]); }
    else if (D.id) await App.close(true); else await App.home();
    if (shared && !m) { history.replaceState(null, '', location.pathname); const id = await App.create('Shared'); await App.open(id); setTimeout(() => IO.addData('', q.get('url') || '', q.get('text') || '', null), 300); }
  },
  goLink(s) { // #/b/<id>/o/<objid>  or  /v/x,y,z
    const [k, v] = s.split('/'); if (k === 'o') { const o = D.byId.get(v); if (o) { Sel.set([o.id]); R.fitRect(G.aabb(o), 120, true, 1.5); } } else if (k === 'v') { const [x, y, z] = v.split(',').map(Number); if (isFinite(x + y + z)) R.animate({ x, y, z }); }
  },
  async list() { const m = await DB.all('meta'); App.boards = m.sort((a, b) => b.modified - a.modified); return App.boards; },
  async create(name) { D.reset(name); D.initHistory(); await D.save(false); const id = D.id; D.id = null; return id; },
  /* ---- home ---- */
  async home() {
    App.view = 'home'; U.$('#app').classList.remove('editing'); U.$('#home').classList.add('on'); const root = U.$('#home'); const boards = await App.list(); root.innerHTML = '';
    const q = { v: '' }, sortBy = { v: localStorage.getItem('ib.sort') || 'modified' };
    const grid = U.el('div', { class: 'cards' });
    const draw = () => {
      grid.innerHTML = ''; let list = boards.filter(b => b.name.toLowerCase().includes(q.v.toLowerCase())); list.sort((a, b) => sortBy.v === 'name' ? a.name.localeCompare(b.name) : sortBy.v === 'created' ? b.created - a.created : b.modified - a.modified);
      grid.append(U.el('button', { class: 'card new', onclick: () => App.newBoard() }, U.el('div', { class: 'plus', html: U.icon('plus', 40) }), U.el('b', null, 'New board')));
      list.forEach(b => {
        const c = U.el('div', { class: 'card', tabindex: 0, onclick: () => { location.hash = '#/b/' + b.id; } }, U.el('div', { class: 'thumb', style: b.thumb ? `background-image:url(${b.thumb})` : '' }, b.thumb ? null : U.el('span', { html: U.icon('pointer', 36) })), U.el('div', { class: 'cinfo' }, U.el('b', null, b.name), U.el('small', null, `${b.count || 0} objects · ${U.fmtDate(b.modified)}`)),
          U.el('button', { class: 'ibtn cm', title: 'Options', html: U.icon('more', 18), onclick: e => { e.stopPropagation(); UI.menu(e.currentTarget, [{ label: 'Open', icon: 'pointer', fn: () => location.hash = '#/b/' + b.id }, { label: 'Rename…', icon: 'text', fn: async () => { const v = await UI.prompt('Board name', b.name); if (v) { const d = await DB.get('data', b.id); const j = JSON.parse(d.json); j.name = v; await DB.put('data', { id: b.id, json: JSON.stringify(j) }); b.name = v; await DB.put('meta', b); draw(); } } }, { label: 'Duplicate', icon: 'duplicate', fn: async () => { await App.dup(b.id); App.home(); } }, { label: 'Export board file', icon: 'download', fn: async () => { await App.open(b.id, true); U.download(await IO.boardBlob(), b.name.replace(/[\\/:*?"<>|]+/g, '_') + '.infiniboard.json'); await App.close(true, true); } }, { sep: true }, { label: 'Delete', icon: 'trash', danger: true, fn: async () => { if (await UI.confirm(`Delete “${b.name}”? This cannot be undone.`, 'Delete', true)) { await App.del(b.id); App.home(); } } }], { side: 'bottom', align: 'end' }); } }));
        grid.append(c);
      });
      if (!list.length && q.v) grid.append(U.el('div', { class: 'empty' }, 'No boards match your search.'));
    };
    const search = U.el('input', { class: 'inp search', type: 'search', placeholder: 'Search boards…', oninput: e => { q.v = e.target.value; draw(); } });
    root.append(U.el('div', { class: 'htop' }, U.el('div', { class: 'logo' }, U.el('span', { html: U.icon('pointer', 26) }), U.el('b', null, 'InfiniBoard')), search, U.el('span', { class: 'sp' }), UI.select([['modified', 'Last modified'], ['created', 'Newest'], ['name', 'Name']], sortBy.v, v => { sortBy.v = v; localStorage.setItem('ib.sort', v); draw(); }), UI.btn('Import', 'upload', async () => { const [f] = await IO.pick('.json,application/json'); if (!f) return; try { await IO.importBoard(f); UI.toast('Imported'); App.home(); } catch (e) { UI.toast(e.message, 3500, 'err'); } }), UI.ibtn('settings', 'Settings', () => App.settings())),
      U.el('div', { class: 'hbody' }, U.el('h2', null, 'Your boards'), grid, U.el('div', { class: 'foot' }, 'Boards are stored on this device (IndexedDB) and saved automatically. Use Export to back up or move a board.'))); draw();
  },
  async newBoard() {
    const t = [['blank', 'Blank infinite canvas', 'pointer'], ['slides', 'Whiteboard with A4 pages', 'pages'], ['brain', 'Brainstorm (sticky notes)', 'sticky'], ['kanban', 'Kanban planner', 'kanban']];
    const body = U.el('div', null, UI.field('Name', U.el('input', { class: 'inp', id: 'nbn', value: 'Untitled board', onkeydown: e => e.stopPropagation() })), U.el('div', { class: 'lbl' }, 'Start from'), U.el('div', { class: 'tpls' }, ...t.map(([k, l, ic], i) => U.el('label', { class: 'tpl' }, U.el('input', { type: 'radio', name: 'tpl', value: k, checked: i === 0 }), U.el('span', { html: U.icon(ic, 26) }), U.el('b', null, l)))));
    UI.modal({ title: 'New board', body, width: 480, buttons: [{ label: 'Cancel' }, { label: 'Create', primary: true, fn: async () => { const name = U.$('#nbn').value.trim() || 'Untitled board'; const tpl = (document.querySelector('input[name=tpl]:checked') || {}).value || 'blank'; const id = await App.create(name); location.hash = '#/b/' + id + (tpl !== 'blank' ? '' : ''); App.tpl = tpl; } }] });
  },
  applyTemplate(k) {
    if (k === 'slides') { Act.addFramePreset(FRAME_PRESETS[0]); } else if (k === 'brain') { for (let i = 0; i < 4; i++) { const o = D.make('sticky', { x: -280 + i * 190, y: -120 + (i % 2) * 40, color: U.STICKY[i % U.STICKY.length], text: ['Idea', 'Question', 'Risk', 'Next step'][i] }); D.add(o); } } else if (k === 'kanban') { const o = D.make('kanban', {}); o.x = -420; o.y = -220; D.add(o); }
    D.commit('Template', 'all'); R.fitAll(true);
  },
  async dup(id) { const d = await DB.get('data', id), m = await DB.get('meta', id); const nid = U.uid('b'); const j = JSON.parse(d.json); j.id = nid; j.name = j.name + ' copy'; j.created = j.modified = Date.now(); await DB.put('data', { id: nid, json: JSON.stringify(j) }); await DB.put('meta', Object.assign({}, m, { id: nid, name: j.name, created: j.created, modified: j.modified })); const as = await DB.byIndex('assets', 'bid', id); for (const a of as) await DB.put('assets', Object.assign({}, a, { key: nid + '|' + a.id, bid: nid })); return nid; },
  async del(id) { await DB.del('data', id); await DB.del('meta', id); await DB.delByIndex('assets', 'bid', id); await DB.delByIndex('versions', 'bid', id); },
  async duplicate() { await D.save(true); const id = await App.dup(D.id); UI.toast('Duplicated — opening copy'); location.hash = '#/b/' + id; },
  async removeCurrent() { if (await UI.confirm(`Delete “${D.name}” permanently?`, 'Delete board', true)) { const id = D.id; D.dirty = false; await App.close(true, true); await App.del(id); location.hash = ''; } },
  /* ---- open / close ---- */
  async open(id, silent) {
    const d = await DB.get('data', id); if (!d) { UI.toast('Board not found', 3000, 'err'); location.hash = ''; return; }
    if (D.id && D.id !== id) await App.close(true, true);
    AS.clear(); D.fromJSON(d.json); await AS.loadAll(id); Sel.ids = []; D.initHistory(); D.openJson = D.toJSON(); D.dirty = false; D.lastVersion = Date.now();
    if (!silent) { U.$('#home').classList.remove('on'); U.$('#home').innerHTML = ''; U.$('#app').classList.add('editing'); App.view = 'board'; U.$('#boardname').value = D.name; Tools.set('select'); R.resize(); R.req(); Bus.emit('view'); Bus.emit('sel'); Bus.emit('struct'); TB.sync(); if (App.tpl) { App.applyTemplate(App.tpl); App.tpl = null; } else if (!D.objs.length) R.reqOv(); }
  },
  async close(skipDialog, silent) {
    if (!D.id) return true;
    if (!skipDialog && ST.v.saveDialog && D.dirty && App.view === 'board') {
      const r = await UI.choice('Leave this board?', 'You have changes since you opened it. They are auto-saved — choose what to do:', [{ label: 'Keep editing', value: 'stay' }, { label: 'Discard changes', value: 'discard', danger: true }, { label: 'Save & close', value: 'save', primary: true }]);
      if (r === 'stay' || r === null) { if (location.hash !== '#/b/' + D.id) location.hash = '#/b/' + D.id; return false; }
      if (r === 'discard') { D.fromJSON(D.openJson); D.dirty = false; }
    }
    if (Rec.on) Rec.stop(); if (Embeds.active) Embeds.deactivate(); Ed.cur && Ed.close();
    await D.save(true); const wasId = D.id; D.id = null; D.objs = []; D.byId = new Map(); AS.clear(); Panels.tab && Panels.hide(); Sel.ids = []; Ctx.el.classList.remove('on'); R.req();
    if (!silent) { if (location.hash) history.replaceState(null, '', location.pathname + location.search); await App.home(); }
    return true;
  },
  /* ---- dialogs ---- */
  settings() {
    const v = ST.v, set = (k) => x => ST.set(k, x); const body = U.el('div', { class: 'settings' });
    const sec = (t, ...c) => body.append(U.el('div', { class: 'ssec' }, U.el('h4', null, t), ...c));
    sec('Drawing', UI.toggle('Pressure sensitivity (stylus)', v.pressure, set('pressure')), UI.field('Pressure strength', UI.range(.3, 2, .1, v.pressureSens, set('pressureSens'), { fmt: x => x.toFixed(1) + '×' })), UI.field('Smart shape recognition', UI.seg([['hold', 'Hold'], ['always', 'Always'], ['off', 'Off']], v.smart, set('smart'))), UI.field('Stroke smoothing', UI.range(0, 1, .05, v.ptrSmooth, set('ptrSmooth'), { fmt: x => Math.round(x * 100) + '%' })), UI.toggle('Only pen/mouse draws — touch pans & zooms', v.penOnly, set('penOnly')));
    sec('Laser pointer', UI.toggle('Offset laser above finger', v.laserOffset, set('laserOffset')), UI.field('Offset distance', UI.range(20, 140, 2, v.laserOffsetY, set('laserOffsetY'), { fmt: x => x + ' px' })));
    sec('Canvas', UI.toggle('Mini-map', v.minimap, set('minimap')), UI.toggle('Scroll bars', v.scrollbars, set('scrollbars')), UI.toggle('Show object dimensions', v.dims, set('dims')), UI.toggle('Show flow connector handles', v.flow, set('flow')), UI.toggle('Show comments', v.comments, set('comments')), UI.field('Mouse wheel', UI.seg([['auto', 'Auto'], ['zoom', 'Zoom'], ['pan', 'Pan']], v.wheel, set('wheel'))));
    sec('Snapping & tools', UI.toggle('Snap to objects', v.snapObjects, set('snapObjects')), UI.toggle('Snap to grid', v.snapGrid, set('snapGrid')), UI.toggle('Alignment guides', v.guides, set('guides')), UI.toggle('Switch to hand tool after creating a shape', v.handAfterShape, set('handAfterShape')), UI.toggle('Ruler snaps drawing to its edge', v.rulerSnap, set('rulerSnap')), UI.field('Selection', UI.seg([['touch', 'Touching'], ['contain', 'Fully inside']], v.selectMode, set('selectMode'))), UI.field('Math tool units', UI.seg([['cm', 'cm'], ['in', 'in'], ['mm', 'mm'], ['px', 'px']], v.units, x => { ST.set('units', x); Bus.emit('commit'); R.reqOv(); })));
    sec('General', UI.toggle('Ask before leaving a board with changes', v.saveDialog, set('saveDialog')), UI.field('Author name (comments)', U.el('input', { class: 'inp', value: v.author, onkeydown: e => e.stopPropagation(), oninput: e => ST.set('author', e.target.value || 'Me') })), UI.field('Theme', UI.seg([['light', 'Light'], ['dark', 'Dark'], ['auto', 'Auto']], v.theme, set('theme'))), U.el('div', { class: 'btnrow' }, UI.btn('Keyboard shortcuts', 'keyboard', () => App.shortcuts(), 'sm'), UI.btn('Reset settings', 'rotate', async () => { if (await UI.confirm('Restore all settings to defaults?', 'Reset')) ST.reset(); }, 'sm')));
    UI.modal({ title: 'Settings', body, width: 520, cls: 'tall', buttons: [{ label: 'Done', primary: true }] });
  },
  shortcuts() {
    const body = U.el('div', { class: 'keys' }); Keys.list.forEach(([t, items]) => { body.append(U.el('h4', null, t)); items.forEach(([k, d]) => body.append(U.el('div', { class: 'krow' }, U.el('span', null, d), U.el('span', { class: 'kbd' }, ...k.split(/ ?\/ ?/).flatMap((p, i) => i ? [U.el('i', null, 'or'), U.el('kbd', null, p)] : [U.el('kbd', null, p)]))))); });
    UI.modal({ title: 'Keyboard shortcuts', body, width: 560, cls: 'tall', buttons: [{ label: 'Close', primary: true }] });
  }
};
window.addEventListener('DOMContentLoaded', () => App.boot().catch(e => { console.error(e); document.body.insertAdjacentHTML('beforeend', '<pre style="position:fixed;inset:0;background:#fff;color:#b00;padding:20px;z-index:99999;white-space:pre-wrap">Startup error: ' + (e && e.stack || e) + '</pre>'); }));
