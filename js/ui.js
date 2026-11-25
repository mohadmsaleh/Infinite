'use strict';
/* ===== Small UI kit: popovers, menus, modals, toasts, pickers ===== */
const UI = { pops: [], root: null };
UI.init = () => {
  UI.root = U.el('div', { id: 'ui-root' }); document.body.append(UI.root);
  UI.toastBox = U.el('div', { id: 'toasts' }); document.body.append(UI.toastBox);
  document.addEventListener('pointerdown', e => {
    if (!UI.pops.length) return;
    const t = e.target;
    for (let i = UI.pops.length - 1; i >= 0; i--) {
      const p = UI.pops[i];
      if (p.el.contains(t) || (p.anchor && p.anchor.contains && p.anchor.contains(t))) { // keep this one and parents
        while (UI.pops.length > i + 1) UI.pops[UI.pops.length - 1].close();
        return;
      }
    }
    UI.closeAll();
  }, true);
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') { if (UI.modals.length) UI.modals[UI.modals.length - 1].close(); else if (UI.pops.length) { UI.pops[UI.pops.length - 1].close(); e.stopPropagation(); } }
  }, true);
};
UI.modals = [];
UI.toast = (msg, ms = 2400, kind) => {
  const t = U.el('div', { class: 'toast ' + (kind || '') }, msg);
  UI.toastBox.append(t); requestAnimationFrame(() => t.classList.add('in'));
  setTimeout(() => { t.classList.remove('in'); setTimeout(() => t.remove(), 300); }, ms);
  return t;
};
UI.closeAll = () => { while (UI.pops.length) UI.pops[UI.pops.length - 1].close(); };
UI.isOpen = key => UI.pops.some(p => p.key === key);
UI.pop = (anchor, content, o = {}) => {
  if (o.key) { const ex = UI.pops.find(p => p.key === o.key); if (ex) { ex.close(); if (o.toggle !== false) return null; } }
  const el = U.el('div', { class: 'pop ' + (o.cls || '') }, content);
  UI.root.append(el);
  const p = {
    el, anchor: anchor && anchor.getBoundingClientRect ? anchor : null, key: o.key,
    close() { const i = UI.pops.indexOf(p); if (i < 0) return; UI.pops.splice(i, 1); el.remove(); while (UI.pops.length > i && UI.pops[i].parent === p) UI.pops[i].close(); o.onClose && o.onClose(); },
    place() { UI.place(el, anchor, o); }
  };
  p.parent = UI.pops[UI.pops.length - 1] && o.child ? UI.pops[UI.pops.length - 1] : null;
  UI.pops.push(p); p.place();
  requestAnimationFrame(() => { p.place(); el.classList.add('in'); });
  return p;
};
UI.place = (el, anchor, o = {}) => {
  const vw = innerWidth, vh = innerHeight, m = 8;
  const r = anchor && anchor.getBoundingClientRect ? anchor.getBoundingClientRect() : { left: anchor.x, top: anchor.y, right: anchor.x, bottom: anchor.y, width: 0, height: 0 };
  el.style.maxHeight = (vh - 2 * m) + 'px';
  const w = el.offsetWidth, h = el.offsetHeight;
  let side = o.side || 'bottom', x, y;
  const pos = s => {
    if (s === 'right') { x = r.right + 8; y = r.top; }
    else if (s === 'left') { x = r.left - w - 8; y = r.top; }
    else if (s === 'top') { x = r.left; y = r.top - h - 8; }
    else { x = r.left; y = r.bottom + 8; }
  };
  pos(side);
  if (side === 'right' && x + w > vw - m) pos('left');
  else if (side === 'left' && x < m) pos('right');
  else if (side === 'bottom' && y + h > vh - m && r.top - h - 8 > m) pos('top');
  else if (side === 'top' && y < m) pos('bottom');
  if (o.align === 'end' && (side === 'bottom' || side === 'top')) x = r.right - w;
  if (o.align === 'center' && (side === 'bottom' || side === 'top')) x = r.left + r.width / 2 - w / 2;
  el.style.left = U.clamp(x, m, Math.max(m, vw - w - m)) + 'px';
  el.style.top = U.clamp(y, m, Math.max(m, vh - h - m)) + 'px';
};
/* menu: items [{label, icon, key, fn, checked, disabled, sep, header, sub, danger, swatch}] */
UI.menu = (anchor, items, o = {}) => {
  const box = U.el('div', { class: 'menu' });
  let p;
  items.filter(Boolean).forEach(it => {
    if (it.sep) { box.append(U.el('div', { class: 'msep' })); return; }
    if (it.header) { box.append(U.el('div', { class: 'mhead' }, it.header)); return; }
    const row = U.el('div', { class: 'mi' + (it.disabled ? ' dis' : '') + (it.danger ? ' danger' : '') + (it.checked ? ' on' : '') });
    row.append(U.el('span', { class: 'mi-ic', html: it.icon ? U.icon(it.icon, 18) : (it.checked !== undefined ? (it.checked ? U.icon('check', 16) : '') : '') }));
    row.append(U.el('span', { class: 'mi-l' }, it.label));
    if (it.swatch) row.append(U.el('span', { class: 'mi-sw', style: 'background:' + it.swatch }));
    if (it.key) row.append(U.el('span', { class: 'mi-k' }, it.key));
    if (it.sub) row.append(U.el('span', { class: 'mi-sub', html: U.icon('chevR', 14) }));
    row.addEventListener('click', e => {
      if (it.disabled) return;
      if (it.sub) { UI.menu(row, typeof it.sub === 'function' ? it.sub() : it.sub, { side: 'right', child: true, key: 'sub' }); return; }
      if (!it.keep) UI.closeAll();
      it.fn && it.fn(e);
    });
    if (it.sub) row.addEventListener('pointerenter', () => { if (!UI.isOpen('sub')) UI.menu(row, typeof it.sub === 'function' ? it.sub() : it.sub, { side: 'right', child: true, key: 'sub' }); });
    box.append(row);
  });
  return UI.pop(anchor, box, Object.assign({ cls: 'menu-pop' }, o));
};
UI.modal = ({ title, body, buttons = [], width = 460, cls = '', onClose, noClose }) => {
  const back = U.el('div', { class: 'modal-back' });
  const box = U.el('div', { class: 'modal ' + cls, style: { width: width + 'px' } });
  const head = U.el('div', { class: 'modal-h' }, U.el('h3', null, title || ''));
  if (!noClose) head.append(U.el('button', { class: 'ibtn', html: U.icon('close', 18), onclick: () => m.close() }));
  const foot = U.el('div', { class: 'modal-f' });
  const m = {
    el: box, back,
    close(v) { const i = UI.modals.indexOf(m); if (i >= 0) UI.modals.splice(i, 1); back.classList.remove('in'); setTimeout(() => back.remove(), 150); onClose && onClose(v); }
  };
  buttons.forEach(b => foot.append(U.el('button', {
    class: 'btn ' + (b.primary ? 'primary' : '') + (b.danger ? ' danger' : ''), text: b.label,
    onclick: async () => { const r = b.fn ? await b.fn(m) : undefined; if (r !== false) m.close(b.label); }
  })));
  box.append(head, U.el('div', { class: 'modal-b' }, body), buttons.length ? foot : null);
  back.append(box); UI.root.append(back); UI.modals.push(m);
  requestAnimationFrame(() => back.classList.add('in'));
  if (!noClose) back.addEventListener('pointerdown', e => { if (e.target === back) m.close(); });
  const f = box.querySelector('input,textarea'); if (f) setTimeout(() => { f.focus(); f.select && f.select(); }, 60);
  return m;
};
UI.confirm = (msg, ok = 'OK', danger = false, title = 'Confirm') => new Promise(res => {
  let done = false;
  UI.modal({ title, body: U.el('p', { class: 'mtext' }, msg), width: 400, buttons: [{ label: 'Cancel', fn: () => { done = true; res(false); } }, { label: ok, primary: !danger, danger, fn: () => { done = true; res(true); } }], onClose: () => { if (!done) res(false); } });
});
UI.choice = (title, msg, buttons) => new Promise(res => {
  let done = false;
  UI.modal({ title, body: U.el('p', { class: 'mtext' }, msg), width: 420, buttons: buttons.map(b => Object.assign({}, b, { fn: () => { done = true; res(b.value); } })), onClose: () => { if (!done) res(null); }, noClose: false });
});
UI.prompt = (title, value = '', o = {}) => new Promise(res => {
  const inp = o.multiline ? U.el('textarea', { class: 'inp', rows: 5, value }) : U.el('input', { class: 'inp', type: 'text', value, placeholder: o.placeholder || '' });
  let done = false;
  const m = UI.modal({
    title, body: U.el('div', null, o.label ? U.el('label', { class: 'lbl' }, o.label) : null, inp), width: 420,
    buttons: [{ label: 'Cancel', fn: () => { done = true; res(null); } }, { label: o.ok || 'OK', primary: true, fn: () => { done = true; res(inp.value); } }],
    onClose: () => { if (!done) res(null); }
  });
  if (!o.multiline) inp.addEventListener('keydown', e => { if (e.key === 'Enter') { done = true; res(inp.value); m.close(); } });
});
/* colour picker */
UI.recent = () => { try { return JSON.parse(localStorage.getItem('ib.recent') || '[]'); } catch (e) { return []; } };
UI.pushRecent = c => { if (!c || c === 'none') return; const r = UI.recent().filter(x => x !== c); r.unshift(c); localStorage.setItem('ib.recent', JSON.stringify(r.slice(0, 10))); };
UI.colorBox = (value, cb, o = {}) => {
  const box = U.el('div', { class: 'cpick' });
  const cur = { v: value };
  const apply = (c, final) => { cur.v = c; cb(c); if (final) UI.pushRecent(c); sync(); };
  const grid = U.el('div', { class: 'swatches' });
  const pal = o.palette || U.PALETTE;
  if (o.none) grid.append(U.el('button', { class: 'sw none', title: 'None', onclick: () => apply('none', true) }));
  pal.forEach(c => grid.append(U.el('button', { class: 'sw', style: 'background:' + c, title: c, 'data-c': c, onclick: () => apply(c, true) })));
  const hex = U.el('input', { class: 'inp sm', type: 'text', value: value && value !== 'none' ? U.toHex(U.parseColor(value)) : '', placeholder: '#rrggbb', onchange: e => { let v = e.target.value.trim(); if (/^[0-9a-f]{6}$/i.test(v)) v = '#' + v; if (/^#[0-9a-f]{3,8}$/i.test(v)) apply(v, true); } });
  const nat = U.el('input', { type: 'color', class: 'natcolor', value: value && value !== 'none' ? U.toHex(U.parseColor(value)) : '#000000', oninput: e => apply(e.target.value, false), onchange: e => apply(e.target.value, true) });
  box.append(grid);
  const rec = UI.recent();
  if (rec.length) { box.append(U.el('div', { class: 'lbl' }, 'Recent')); const rg = U.el('div', { class: 'swatches' }); rec.forEach(c => rg.append(U.el('button', { class: 'sw', style: 'background:' + c, onclick: () => apply(c, true) }))); box.append(rg); }
  box.append(U.el('div', { class: 'row gap' }, U.el('label', { class: 'natwrap', title: 'Custom colour' }, nat, U.el('span', { html: U.icon('palette', 16) }), 'Custom'), hex));
  let alpha;
  if (o.alpha) {
    alpha = U.el('input', { type: 'range', min: 0, max: 100, value: Math.round(U.parseColor(value)[3] * 100), oninput: e => { const [r, g, b] = U.parseColor(cur.v === 'none' ? '#000000' : cur.v); apply(`rgba(${r},${g},${b},${e.target.value / 100})`, false); } });
    box.append(U.el('div', { class: 'row gap' }, U.el('span', { class: 'lbl' }, 'Opacity'), alpha));
  }
  function sync() { U.$$('.sw', box).forEach(s => s.classList.toggle('sel', s.dataset.c && cur.v && U.toHex(U.parseColor(s.dataset.c)) === U.toHex(U.parseColor(cur.v)) && cur.v !== 'none')); }
  sync();
  return box;
};
UI.color = (anchor, value, cb, o = {}) => UI.pop(anchor, UI.colorBox(value, cb, o), Object.assign({ cls: 'pop-color', side: 'bottom', child: true }, o.pop || {}));
/* form controls */
UI.field = (label, ctl, cls = '') => U.el('div', { class: 'fld ' + cls }, label ? U.el('label', { class: 'lbl' }, label) : null, ctl);
UI.swatchBtn = (value, cb, o = {}) => {
  const b = U.el('button', { class: 'swbtn' + (!value || value === 'none' ? ' none' : ''), style: value && value !== 'none' ? 'background:' + value : '', title: o.title || '' });
  b.addEventListener('click', () => UI.color(b, value, c => { value = c; b.style.background = c === 'none' ? '' : c; b.classList.toggle('none', c === 'none'); cb(c); }, o));
  return b;
};
UI.range = (min, max, step, value, cb, o = {}) => {
  const out = U.el('span', { class: 'rval' }, (o.fmt ? o.fmt(value) : value));
  const r = U.el('input', { type: 'range', min, max, step, value, oninput: e => { const v = +e.target.value; out.textContent = o.fmt ? o.fmt(v) : v; cb(v, false); }, onchange: e => cb(+e.target.value, true) });
  return U.el('div', { class: 'rng' }, r, out);
};
UI.num = (value, cb, o = {}) => U.el('input', { class: 'inp sm num', type: 'number', value: value == null ? '' : +(+value).toFixed(2), step: o.step || 1, min: o.min, max: o.max, onchange: e => { if (e.target.value !== '') cb(+e.target.value); } });
UI.select = (options, value, cb) => {
  const s = U.el('select', { class: 'inp sm', onchange: e => cb(e.target.value) });
  options.forEach(op => { const [v, l] = Array.isArray(op) ? op : [op, op]; s.append(U.el('option', { value: v, selected: v === value }, l)); });
  return s;
};
UI.seg = (options, value, cb) => {
  const w = U.el('div', { class: 'seg' });
  options.forEach(op => {
    const [v, l, ic] = Array.isArray(op) ? op : [op, op];
    const b = U.el('button', { class: v === value ? 'on' : '', title: l, onclick: () => { U.$$('button', w).forEach(x => x.classList.remove('on')); b.classList.add('on'); cb(v); } });
    b.innerHTML = ic ? U.icon(ic, 16) : U.esc(l); w.append(b);
  });
  return w;
};
UI.toggle = (label, value, cb) => {
  const c = U.el('input', { type: 'checkbox', checked: !!value, onchange: e => cb(e.target.checked) });
  return U.el('label', { class: 'tog' }, c, U.el('span', { class: 'track' }), U.el('span', { class: 'tl' }, label));
};
UI.btn = (label, icon, fn, cls = '') => U.el('button', { class: 'btn ' + cls, html: (icon ? U.icon(icon, 16) : '') + `<span>${U.esc(label)}</span>`, onclick: fn });
UI.ibtn = (icon, title, fn, cls = '') => U.el('button', { class: 'ibtn ' + cls, title, html: U.icon(icon, 18), onclick: fn });
