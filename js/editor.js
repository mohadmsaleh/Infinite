'use strict';
/* ===== In-place text editor overlay ===== */
const Ed = {
  cur: null,
  editing(o, part) { const c = Ed.cur; return !!c && c.o.id === o.id && (part === undefined || c.opts.key === part); },
  text(o, opts) {
    Ed.close();
    const host = U.$('#editor'); const ta = U.el('textarea', { class: 'ed-ta', spellcheck: 'false', autocapitalize: 'sentences', rows: 1 });
    const get = opts.get || (() => o[opts.key] || ''), set = opts.set || (v => { o[opts.key] = v; });
    ta.value = get() || ''; const before = ta.value;
    const c = Ed.cur = { o, opts, ta, before, get, set, t: T.get(o.type) };
    host.append(ta); if (opts.toolbar === 'md') Ed.mdBar(c, host);
    Ed.place();
    const commit = () => { if (Ed.cur === c) Ed.close(); };
    ta.addEventListener('input', () => { set(ta.value); if (c.t.fit) c.t.fit(o); Ed.place(); R.req(); });
    ta.addEventListener('keydown', e => {
      e.stopPropagation();
      if (e.key === 'Escape') { e.preventDefault(); Ed.close(); }
      else if (e.key === 'Enter' && (opts.single || opts.onEnter || e.ctrlKey || e.metaKey) && !e.shiftKey) { e.preventDefault(); if (opts.onEnter && !e.ctrlKey && !e.metaKey && !opts.single) { Ed.close(); const T_ = c.t; if (T_.key) T_.key(o, { key: 'Enter' }); } else Ed.close(); }
      else if (e.key === 'Tab' && opts.onTab) { e.preventDefault(); const f = opts.onTab; Ed.close(); f(e.shiftKey); }
    });
    ta.addEventListener('blur', () => setTimeout(() => { if (Ed.cur === c && document.activeElement !== ta && !(Ed.bar && Ed.bar.contains(document.activeElement))) commit(); }, 120));
    ta.addEventListener('pointerdown', e => e.stopPropagation());
    requestAnimationFrame(() => { ta.focus(); if (opts.selectAll) ta.select(); else ta.setSelectionRange(ta.value.length, ta.value.length); });
    R.req(); Bus.emit('editing');
    return c;
  },
  place() {
    const c = Ed.cur; if (!c) return; const { o, opts, ta } = c; const z = D.view.z;
    let fs = opts.fsFn ? opts.fsFn() : opts.fs || 16;
    const [wx, wy] = G.toWorld(o, opts.x, opts.y); const [sx, sy] = R.w2s(wx, wy);
    const w = opts.w * z, bold = opts.bold != null ? opts.bold : o.b;
    const fam = opts.mono ? U.FONTS.mono : U.FONTS[o.fnt || 'sans'];
    const font = `${o.i ? 'italic ' : ''}${bold ? '700 ' : '400 '}${fs}px ${fam}`;
    const lines = U.wrap(ta.value || ' ', font, opts.w).length, th = lines * fs * Txt.LH;
    let h = opts.h; if (opts.grow || opts.auto) h = Math.max(h, th);
    let pad = 0; if ((opts.va || 'top') === 'middle' && th < h) pad = (h - th) / 2; else if (opts.va === 'bottom' && th < h) pad = h - th;
    Object.assign(ta.style, {
      left: sx + 'px', top: sy + 'px', width: w + 'px', height: Math.max(h * z, fs * z * 1.3) + 'px', font: font.replace(/\d+(\.\d+)?px/, (fs * z) + 'px'),
      lineHeight: (Txt.LH) + '', textAlign: opts.al || 'left', color: opts.color || '#1f2430', paddingTop: (pad * z) + 'px', transform: o.rot ? `rotate(${o.rot}rad)` : '', transformOrigin: '0 0'
    });
    if (!opts.grow && !opts.auto) ta.style.height = (opts.h * z) + 'px';
    if (Ed.bar) { Ed.bar.style.left = sx + 'px'; Ed.bar.style.top = Math.max(4, sy - 44) + 'px'; }
  },
  close(discard) {
    const c = Ed.cur; if (!c) return; Ed.cur = null; const { o, opts, ta } = c;
    const val = ta.value; ta.remove(); if (Ed.bar) { Ed.bar.remove(); Ed.bar = null; }
    if (discard) { R.req(); Bus.emit('editing'); return; }
    c.set(val); if (c.t.fit) c.t.fit(o);
    if (opts.newObj && o.type === 'text' && !val.trim()) { D.remove([o]); Sel.ids = Sel.ids.filter(i => i !== o.id); R.req(); Bus.emit('sel'); Bus.emit('editing'); return; }
    if (val !== c.before || opts.newObj) D.commit(opts.newObj ? 'Create' : 'Edit text', o);
    R.req(); Bus.emit('editing'); Bus.emit('sel');
  },
  mdBar(c, host) {
    const ta = c.ta; const bar = Ed.bar = U.el('div', { class: 'ed-bar' });
    const wrap = (a, b = a) => { const s = ta.selectionStart, e = ta.selectionEnd, v = ta.value; ta.value = v.slice(0, s) + a + v.slice(s, e) + b + v.slice(e); ta.setSelectionRange(s + a.length, e + a.length); ta.dispatchEvent(new Event('input')); ta.focus(); };
    const line = p => { const s = ta.selectionStart, v = ta.value; const ls = v.lastIndexOf('\n', s - 1) + 1; ta.value = v.slice(0, ls) + p + v.slice(ls); ta.setSelectionRange(s + p.length, s + p.length); ta.dispatchEvent(new Event('input')); ta.focus(); };
    [['bold', 'Bold', () => wrap('**')], ['italic', 'Italic', () => wrap('*')], ['heading', 'Heading', () => line('## ')], ['list', 'Bullet', () => line('- ')], ['todo', 'Task', () => line('- [ ] ')], ['comment', 'Quote', () => line('> ')], ['browser', 'Code', () => wrap('`')]].forEach(([ic, t, fn]) => {
      const b = U.el('button', { class: 'ibtn', title: t, html: U.icon(ic, 16) }); b.addEventListener('pointerdown', e => { e.preventDefault(); fn(); }); bar.append(b);
    });
    host.append(bar);
  }
};
Bus.on('view', () => Ed.place());
