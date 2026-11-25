'use strict';
/* ===== Utilities & icons ===== */
const U = {};
U._c = 0;
U.uid = (p = 'o') => p + Math.random().toString(36).slice(2, 7) + (++U._c).toString(36);
U.clamp = (v, a, b) => Math.min(b, Math.max(a, v));
U.lerp = (a, b, t) => a + (b - a) * t;
U.rad = d => d * Math.PI / 180;
U.deg = r => r * 180 / Math.PI;
U.dist = (ax, ay, bx, by) => Math.hypot(bx - ax, by - ay);
U.rotPt = (x, y, cx, cy, a) => { const c = Math.cos(a), s = Math.sin(a), dx = x - cx, dy = y - cy; return [cx + dx * c - dy * s, cy + dx * s + dy * c]; };
U.distSeg = (px, py, ax, ay, bx, by) => {
  const dx = bx - ax, dy = by - ay, l2 = dx * dx + dy * dy;
  let t = l2 ? ((px - ax) * dx + (py - ay) * dy) / l2 : 0; t = U.clamp(t, 0, 1);
  return Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
};
U.round = (v, s = 1) => Math.round(v / s) * s;
U.$ = (s, r = document) => r.querySelector(s);
U.$$ = (s, r = document) => Array.from(r.querySelectorAll(s));
U.el = (tag, props, ...kids) => {
  const e = document.createElement(tag);
  if (props) for (const k in props) {
    const v = props[k];
    if (v == null || v === false) continue;
    if (k === 'class') e.className = v;
    else if (k === 'style') { if (typeof v === 'string') e.style.cssText = v; else Object.assign(e.style, v); }
    else if (k === 'html') e.innerHTML = v;
    else if (k === 'text') e.textContent = v;
    else if (k.startsWith('on')) e.addEventListener(k.slice(2), v);
    else if (k === 'value') e.value = v;
    else if (k === 'checked') e.checked = !!v;
    else e.setAttribute(k, v === true ? '' : v);
  }
  for (const c of kids.flat()) if (c != null && c !== false) e.append(c.nodeType ? c : document.createTextNode(c));
  return e;
};
U.debounce = (fn, ms) => { let t; const f = (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); }; f.flush = () => { clearTimeout(t); fn(); }; f.cancel = () => clearTimeout(t); return f; };
U.throttleRaf = fn => { let q = false; return (...a) => { if (q) return; q = true; requestAnimationFrame(() => { q = false; fn(...a); }); }; };
U.esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
U.fmtBytes = n => n < 1024 ? n + ' B' : n < 1048576 ? (n / 1024).toFixed(1) + ' KB' : (n / 1048576).toFixed(1) + ' MB';
U.fmtTime = s => { s = Math.max(0, Math.floor(s)); return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0'); };
U.fmtDate = t => new Date(t).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
U.blobToDataURL = b => new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(r.result); r.onerror = rej; r.readAsDataURL(b); });
U.dataURLToBlob = d => { const [h, b] = d.split(','); const m = /:(.*?);/.exec(h)[1]; const bin = atob(b); const u = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i); return new Blob([u], { type: m }); };
U.loadImg = src => new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = src; });
U.download = (blob, name) => { const a = document.createElement('a'); const u = URL.createObjectURL(blob); a.href = u; a.download = name; document.body.append(a); a.click(); setTimeout(() => { a.remove(); URL.revokeObjectURL(u); }, 2000); };
U.canvasBlob = (cv, type = 'image/png', q = .92) => new Promise(res => cv.toBlob(res, type, q));
U.copy = async t => { try { await navigator.clipboard.writeText(t); return true; } catch (e) { const ta = U.el('textarea', { value: t, style: 'position:fixed;opacity:0' }); document.body.append(ta); ta.select(); let ok = false; try { ok = document.execCommand('copy'); } catch (_) { } ta.remove(); return ok; } };
// colour helpers
U.parseColor = c => {
  if (!c || c === 'none' || c === 'transparent') return [0, 0, 0, 0];
  if (c[0] === '#') { let h = c.slice(1); if (h.length === 3) h = h.split('').map(x => x + x).join(''); if (h.length === 4) h = h.split('').map(x => x + x).join(''); const n = parseInt(h.slice(0, 6), 16); const a = h.length === 8 ? parseInt(h.slice(6), 16) / 255 : 1; return [n >> 16 & 255, n >> 8 & 255, n & 255, a]; }
  const m = /rgba?\(([^)]+)\)/.exec(c); if (m) { const p = m[1].split(',').map(parseFloat); return [p[0], p[1], p[2], p[3] == null ? 1 : p[3]]; }
  return [0, 0, 0, 1];
};
U.toHex = ([r, g, b]) => '#' + [r, g, b].map(v => Math.round(v).toString(16).padStart(2, '0')).join('');
U.isDark = c => { const [r, g, b, a] = U.parseColor(c); return a > .3 && (0.299 * r + 0.587 * g + 0.114 * b) < 140; };
U.contrast = c => U.isDark(c) ? '#ffffff' : '#1f2430';
U.shade = (c, amt) => { const [r, g, b] = U.parseColor(c); const f = v => U.clamp(Math.round(v + (amt > 0 ? (255 - v) : v) * amt), 0, 255); return U.toHex([f(r), f(g), f(b)]); };
U.alpha = (c, a) => { const [r, g, b, al] = U.parseColor(c); return `rgba(${r},${g},${b},${+(al * a).toFixed(3)})`; };
// scratch contexts
U.mcv = document.createElement('canvas'); U.mcv.width = U.mcv.height = 4;
U.mctx = U.mcv.getContext('2d');
U.hctx = U.mctx;
// text wrapping with cache
U._wc = new Map();
U.wrap = (text, font, maxW) => {
  const key = font + '|' + Math.round(maxW) + '|' + text;
  let r = U._wc.get(key); if (r) return r;
  const ctx = U.mctx; ctx.font = font; const out = [];
  const widths = [];
  for (const para of String(text).split('\n')) {
    if (maxW <= 0 || !para) { out.push(para); continue; }
    let line = '';
    for (const word of para.split(/(\s+)/)) {
      if (!word) continue;
      const t = line + word;
      if (ctx.measureText(t).width <= maxW || !line.trim()) {
        if (ctx.measureText(t).width > maxW && !/\s/.test(word) && word.length > 1) { // break long word
          let cur = line;
          for (const ch of word) { if (ctx.measureText(cur + ch).width > maxW && cur) { out.push(cur); cur = ch; } else cur += ch; }
          line = cur;
        } else line = t;
      } else { out.push(line.replace(/\s+$/, '')); line = word.replace(/^\s+/, ''); }
    }
    out.push(line);
  }
  if (U._wc.size > 3000) U._wc.clear();
  U._wc.set(key, out); return out;
};
U.measure = (text, font) => { U.mctx.font = font; return U.mctx.measureText(text).width; };
U.fontStr = (o, fs, extra = {}) => `${(extra.italic ?? o.italic) ? 'italic ' : ''}${(extra.bold ?? o.bold) ? '700 ' : '400 '}${fs}px ${U.FONTS[o.font] || U.FONTS.sans}`;
U.FONTS = {
  sans: 'Inter, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
  serif: 'Georgia, "Times New Roman", serif',
  mono: '"SFMono-Regular", Consolas, "Courier New", monospace',
  hand: '"Segoe Print", "Bradley Hand", "Comic Sans MS", "Chalkboard SE", cursive',
  display: '"Arial Black", Impact, "Helvetica Neue", sans-serif'
};
U.PALETTE = ['#1f2430', '#6b7280', '#c7ccd6', '#ffffff', '#ef4444', '#f97316', '#f59e0b', '#eab308', '#84cc16', '#22c55e', '#10b981', '#14b8a6', '#06b6d4', '#0ea5e9', '#3b82f6', '#6366f1', '#8b5cf6', '#a855f7', '#d946ef', '#ec4899', '#f43f5e', '#7c4a2d', '#fde68a', '#bbf7d0'];
U.STICKY = ['#fff176', '#ffcc80', '#ef9a9a', '#f48fb1', '#ce93d8', '#9fa8da', '#90caf9', '#80deea', '#a5d6a7', '#e6ee9c', '#ffffff', '#cfd8dc'];

/* ---------- Icons ---------- */
U.IC = {
  select: '<path d="M5 3l14 8-6.2 1.6L9.8 19z"/>',
  marquee: '<path d="M4 8V5a1 1 0 011-1h3M16 4h3a1 1 0 011 1v3M20 16v3a1 1 0 01-1 1h-3M8 20H5a1 1 0 01-1-1v-3"/><path d="M12 8v8M8 12h8"/>',
  lasso: '<path d="M12 4c5 0 8 2 8 5s-3 5-8 5-8-2-8-5 3-5 8-5z"/><path d="M8 13.5c-1 2-.5 4 1.5 5 1.5.7 3 .2 3-1"/>',
  cutout: '<circle cx="6" cy="6" r="2.5"/><circle cx="6" cy="18" r="2.5"/><path d="M8 7.5L20 18M8 16.5L20 6"/>',
  hand: '<path d="M8 12V5.5a1.5 1.5 0 013 0V11m0-5.5a1.5 1.5 0 013 0V11m0-4a1.5 1.5 0 013 0v7a6 6 0 01-6 6h-.5a6 6 0 01-4.6-2.2L4.5 14.8a1.5 1.5 0 012.3-1.9L8 14.3"/>',
  pen: '<path d="M4 20l1-4.5L16.5 4a2.1 2.1 0 013 3L8 18.5z"/><path d="M14.5 6l3 3"/>',
  marker: '<path d="M6 18l1.5-4.5 8-8 3 3-8 8z"/><path d="M4 21h10"/><path d="M13 7l3 3"/>',
  highlighter: '<path d="M14 4l6 6-8 8-6-6z"/><path d="M9 15l-4 4h5l2-2"/>',
  pencil: '<path d="M4 20l1-4L16 5l3 3L8 19z"/><path d="M13 8l3 3M4 20l3.5-1"/>',
  brush: '<path d="M18.5 3.5a2 2 0 013 3L12 16l-3-3z"/><path d="M9 13c-3 0-4 2-4 3.5S4 20 3 20c3 2 8 1 8-3"/>',
  callig: '<path d="M5 20L16 4l3 2L8 22z" transform="translate(0 -2)"/><path d="M4 21h8"/>',
  ruler: '<rect x="2.5" y="8" width="19" height="8" rx="1.5" transform="rotate(-30 12 12)"/><path d="M8 13l1.5-.9M11 11.2l1 .1M14 9.5l1.5-.9" transform="rotate(0)"/>',
  eraser: '<path d="M8 20h12M5 15l9-9a2 2 0 013 0l3 3a2 2 0 010 3l-8 8H9a2 2 0 01-1.4-.6L5 17a2 2 0 010-2z"/><path d="M10 10l6 6"/>',
  bucket: '<path d="M4 12l8-8 8 8-7 7a2 2 0 01-3 0z"/><path d="M4 12h16"/><path d="M21 16c1 1.5 1.5 2.3 1.5 3a1.5 1.5 0 01-3 0c0-.7.5-1.5 1.5-3z"/>',
  shapes: '<rect x="3" y="3" width="9" height="9" rx="1.5"/><circle cx="17" cy="17" r="4.5"/><path d="M16 4l5 8h-10z" transform="translate(-0.5 0) scale(.9)"/>',
  text: '<path d="M5 6V4h14v2M12 4v16M9 20h6"/>',
  sticky: '<path d="M5 4h14a1 1 0 011 1v9l-6 6H5a1 1 0 01-1-1V5a1 1 0 011-1z"/><path d="M20 14h-5a1 1 0 00-1 1v5"/>',
  image: '<rect x="3" y="4" width="18" height="16" rx="2"/><circle cx="9" cy="10" r="2"/><path d="M21 16l-5-5-8 8"/>',
  video: '<rect x="3" y="6" width="13" height="12" rx="2"/><path d="M16 11l5-3v8l-5-3z"/>',
  file: '<path d="M14 3H7a2 2 0 00-2 2v14a2 2 0 002 2h10a2 2 0 002-2V8z"/><path d="M14 3v5h5M9 13h6M9 17h6"/>',
  browser: '<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c3 3 3 15 0 18M12 3c-3 3-3 15 0 18"/>',
  camera: '<path d="M4 8h3l2-3h6l2 3h3a1 1 0 011 1v9a1 1 0 01-1 1H4a1 1 0 01-1-1V9a1 1 0 011-1z"/><circle cx="12" cy="13" r="3.5"/>',
  videocam: '<circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="3" fill="currentColor"/>',
  mic: '<rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5 11a7 7 0 0014 0M12 18v3M9 21h6"/>',
  scan: '<path d="M4 8V5a1 1 0 011-1h3M16 4h3a1 1 0 011 1v3M20 16v3a1 1 0 01-1 1h-3M8 20H5a1 1 0 01-1-1v-3"/><path d="M4 12h16"/>',
  placeholder: '<rect x="3" y="4" width="18" height="16" rx="2" stroke-dasharray="3 3"/><path d="M12 9v6M9 12h6"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  minus: '<path d="M5 12h14"/>',
  table: '<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M3 10h18M3 15h18M9 4v16M15 4v16"/>',
  kanban: '<rect x="3" y="4" width="5" height="16" rx="1"/><rect x="9.5" y="4" width="5" height="10" rx="1"/><rect x="16" y="4" width="5" height="13" rx="1"/>',
  timeline: '<path d="M3 12h18"/><circle cx="6" cy="12" r="2" fill="currentColor"/><circle cx="12" cy="12" r="2" fill="currentColor"/><circle cx="18" cy="12" r="2" fill="currentColor"/><path d="M6 10V6M12 14v4M18 10V6"/>',
  matrix: '<rect x="3" y="3" width="18" height="18" rx="2"/><path d="M12 3v18M3 12h18"/>',
  doc: '<path d="M6 3h9l4 4v14H6z"/><path d="M14 3v5h5M9 12h7M9 15h7M9 18h4"/>',
  mindmap: '<circle cx="12" cy="12" r="3"/><circle cx="4.5" cy="6" r="1.8"/><circle cx="4.5" cy="18" r="1.8"/><circle cx="19.5" cy="7" r="1.8"/><circle cx="19.5" cy="17" r="1.8"/><path d="M9.2 10.8L6 7M9.2 13.2L6 17M14.8 10.8L18 8M14.8 13.2L18 16"/>',
  flowchart: '<rect x="8" y="2.5" width="8" height="5" rx="1"/><path d="M12 7.5v3M12 10.5L5 14M12 10.5l7 3.5"/><rect x="2" y="14" width="7" height="5" rx="1"/><path d="M19 13.5l3 3-3 3-3-3z"/>',
  laser: '<circle cx="12" cy="12" r="3" fill="currentColor"/><path d="M12 3v3M12 18v3M3 12h3M18 12h3M5.6 5.6l2 2M16.4 16.4l2 2M18.4 5.6l-2 2M7.6 16.4l-2 2"/>',
  undo: '<path d="M9 7L4 12l5 5"/><path d="M4 12h10a6 6 0 010 12" transform="translate(0 -6)"/>',
  redo: '<path d="M15 7l5 5-5 5"/><path d="M20 12H10a6 6 0 000 12" transform="translate(0 -6)"/>',
  zoomIn: '<circle cx="11" cy="11" r="7"/><path d="M21 21l-4.5-4.5M11 8v6M8 11h6"/>',
  zoomOut: '<circle cx="11" cy="11" r="7"/><path d="M21 21l-4.5-4.5M8 11h6"/>',
  fit: '<path d="M4 9V5a1 1 0 011-1h4M15 4h4a1 1 0 011 1v4M20 15v4a1 1 0 01-1 1h-4M9 20H5a1 1 0 01-1-1v-4"/><rect x="8" y="8" width="8" height="8" rx="1"/>',
  record: '<circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="4" fill="currentColor"/>',
  stop: '<rect x="6" y="6" width="12" height="12" rx="2" fill="currentColor"/>',
  pause: '<path d="M8 5v14M16 5v14" stroke-width="3"/>',
  play: '<path d="M7 4l13 8-13 8z" fill="currentColor"/>',
  layers: '<path d="M12 3l9 5-9 5-9-5z"/><path d="M3 12l9 5 9-5M3 16l9 5 9-5"/>',
  pages: '<rect x="4" y="3" width="12" height="16" rx="1.5"/><path d="M8 21h10a2 2 0 002-2V7"/>',
  comment: '<path d="M4 5a2 2 0 012-2h12a2 2 0 012 2v10a2 2 0 01-2 2h-7l-5 4v-4H6a2 2 0 01-2-2z"/>',
  history: '<path d="M3 12a9 9 0 109-9 9 9 0 00-7 3.5"/><path d="M3 4v4h4M12 7v5l3 2"/>',
  find: '<circle cx="11" cy="11" r="7"/><path d="M21 21l-4.5-4.5"/>',
  grid: '<path d="M4 4h16v16H4zM4 9.3h16M4 14.7h16M9.3 4v16M14.7 4v16"/>',
  settings: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 00.3 1.8l.1.1a2 2 0 11-2.8 2.8l-.1-.1a1.7 1.7 0 00-1.8-.3 1.7 1.7 0 00-1 1.5V21a2 2 0 11-4 0v-.1a1.7 1.7 0 00-1.1-1.5 1.7 1.7 0 00-1.8.3l-.1.1a2 2 0 11-2.8-2.8l.1-.1a1.7 1.7 0 00.3-1.8 1.7 1.7 0 00-1.5-1H3a2 2 0 110-4h.1a1.7 1.7 0 001.5-1.1 1.7 1.7 0 00-.3-1.8l-.1-.1a2 2 0 112.8-2.8l.1.1a1.7 1.7 0 001.8.3H9a1.7 1.7 0 001-1.5V3a2 2 0 114 0v.1a1.7 1.7 0 001 1.5 1.7 1.7 0 001.8-.3l.1-.1a2 2 0 112.8 2.8l-.1.1a1.7 1.7 0 00-.3 1.8V9a1.7 1.7 0 001.5 1H21a2 2 0 110 4h-.1a1.7 1.7 0 00-1.5 1z"/>',
  menu: '<path d="M4 6h16M4 12h16M4 18h16"/>',
  more: '<circle cx="5" cy="12" r="1.3" fill="currentColor"/><circle cx="12" cy="12" r="1.3" fill="currentColor"/><circle cx="19" cy="12" r="1.3" fill="currentColor"/>',
  trash: '<path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3"/>',
  copy: '<rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 8V6a2 2 0 00-2-2H6a2 2 0 00-2 2v8a2 2 0 002 2h2"/>',
  paste: '<rect x="5" y="4" width="14" height="17" rx="2"/><path d="M9 4h6v3H9z"/>',
  duplicate: '<rect x="3" y="3" width="12" height="12" rx="2"/><rect x="9" y="9" width="12" height="12" rx="2" fill="var(--bg,#fff)"/>',
  group: '<rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/><path d="M12 5h4a3 3 0 013 3v4M12 19H8a3 3 0 01-3-3v-4" stroke-dasharray="2 2"/>',
  ungroup: '<rect x="3" y="3" width="8" height="8" rx="1"/><rect x="13" y="13" width="8" height="8" rx="1"/>',
  front: '<rect x="3" y="9" width="12" height="12" rx="1.5"/><rect x="9" y="3" width="12" height="12" rx="1.5" fill="currentColor" fill-opacity=".25"/>',
  forward: '<rect x="3" y="9" width="12" height="12" rx="1.5"/><rect x="9" y="3" width="12" height="12" rx="1.5"/>',
  backward: '<rect x="9" y="3" width="12" height="12" rx="1.5"/><rect x="3" y="9" width="12" height="12" rx="1.5"/>',
  back: '<rect x="9" y="3" width="12" height="12" rx="1.5"/><rect x="3" y="9" width="12" height="12" rx="1.5" fill="currentColor" fill-opacity=".25"/>',
  alignL: '<path d="M4 3v18"/><rect x="7" y="6" width="13" height="4" rx="1"/><rect x="7" y="14" width="8" height="4" rx="1"/>',
  alignC: '<path d="M12 3v18"/><rect x="5" y="6" width="14" height="4" rx="1"/><rect x="8" y="14" width="8" height="4" rx="1"/>',
  alignR: '<path d="M20 3v18"/><rect x="4" y="6" width="13" height="4" rx="1"/><rect x="9" y="14" width="8" height="4" rx="1"/>',
  alignT: '<path d="M3 4h18"/><rect x="6" y="7" width="4" height="13" rx="1"/><rect x="14" y="7" width="4" height="8" rx="1"/>',
  alignM: '<path d="M3 12h18"/><rect x="6" y="5" width="4" height="14" rx="1"/><rect x="14" y="8" width="4" height="8" rx="1"/>',
  alignB: '<path d="M3 20h18"/><rect x="6" y="4" width="4" height="13" rx="1"/><rect x="14" y="9" width="4" height="8" rx="1"/>',
  distH: '<path d="M4 3v18M20 3v18"/><rect x="10" y="7" width="4" height="10" rx="1"/>',
  distV: '<path d="M3 4h18M3 20h18"/><rect x="7" y="10" width="10" height="4" rx="1"/>',
  flipH: '<path d="M12 3v18" stroke-dasharray="2 2"/><path d="M9 7L3 17h6zM15 7l6 10h-6z"/>',
  flipV: '<path d="M3 12h18" stroke-dasharray="2 2"/><path d="M7 9L17 3v6zM7 15l10 6v-6z" transform="rotate(0)"/>',
  straighten: '<path d="M4 18L20 6"/><path d="M4 18h6M20 6h-3"/><path d="M6 12c2-1 3 1 5 0" />',
  shadow: '<rect x="4" y="4" width="12" height="12" rx="2"/><path d="M19 8v10a1 1 0 01-1 1H8" opacity=".5"/>',
  opacity: '<path d="M12 3s6 6.5 6 11a6 6 0 01-12 0c0-4.5 6-11 6-11z"/><path d="M12 3v17" opacity=".4"/>',
  lock: '<rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V7a4 4 0 018 0v4"/>',
  unlock: '<rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V7a4 4 0 017.5-2"/>',
  link: '<path d="M10 14a4 4 0 005.7 0l3-3a4 4 0 00-5.7-5.7l-1 1"/><path d="M14 10a4 4 0 00-5.7 0l-3 3a4 4 0 005.7 5.7l1-1"/>',
  chevR: '<path d="M9 5l7 7-7 7"/>',
  chevD: '<path d="M5 9l7 7 7-7"/>',
  chevL: '<path d="M15 5l-7 7 7 7"/>',
  chevU: '<path d="M5 15l7-7 7 7"/>',
  close: '<path d="M6 6l12 12M18 6L6 18"/>',
  check: '<path d="M5 12l5 5 9-10"/>',
  home: '<path d="M4 11l8-7 8 7M6 10v10h4v-6h4v6h4V10"/>',
  download: '<path d="M12 3v12M7 11l5 5 5-5M5 21h14"/>',
  upload: '<path d="M12 17V5M7 9l5-5 5 5M5 21h14"/>',
  share: '<circle cx="18" cy="5" r="2.5"/><circle cx="6" cy="12" r="2.5"/><circle cx="18" cy="19" r="2.5"/><path d="M8.2 10.8l7.6-4.4M8.2 13.2l7.6 4.4"/>',
  eye: '<path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>',
  eyeOff: '<path d="M3 3l18 18M10.6 5.1A9 9 0 0112 5c6 0 10 7 10 7a17 17 0 01-3.2 4M6.3 6.4A16 16 0 002 12s4 7 10 7a9 9 0 004-1"/>',
  minimap: '<rect x="3" y="4" width="18" height="16" rx="2"/><rect x="12" y="11" width="7" height="6" rx="1" fill="currentColor" fill-opacity=".3"/>',
  snap: '<path d="M5 3v7a7 7 0 0014 0V3h-4v7a3 3 0 01-6 0V3z"/>',
  frame: '<path d="M7 3v18M17 3v18M3 7h18M3 17h18"/>',
  rotate: '<path d="M20 12a8 8 0 11-3-6.2M20 4v5h-5"/>',
  arrow: '<path d="M5 19L19 5M10 5h9v9"/>',
  line: '<path d="M5 19L19 5"/>',
  connector: '<circle cx="5" cy="18" r="2"/><circle cx="19" cy="6" r="2"/><path d="M7 18h5a3 3 0 003-3V9a3 3 0 013-3"/>',
  dims: '<path d="M3 8V4h4M21 8V4h-4M3 16v4h4M21 16v4h-4"/><path d="M8 12h8M8 10v4M16 10v4"/>',
  keyboard: '<rect x="2" y="6" width="20" height="12" rx="2"/><path d="M6 10h.01M10 10h.01M14 10h.01M18 10h.01M7 14h10"/>',
  save: '<path d="M5 3h11l4 4v13a1 1 0 01-1 1H5a1 1 0 01-1-1V4a1 1 0 011-1z"/><path d="M8 3v5h8M8 21v-7h8v7"/>',
  user: '<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0116 0"/>',
  palette: '<path d="M12 3a9 9 0 100 18c1.5 0 2-1 1.5-2s0-2 1.5-2h2a3 3 0 003-3c0-6-4-11-8-11z"/><circle cx="7.5" cy="11" r="1" fill="currentColor"/><circle cx="10" cy="7" r="1" fill="currentColor"/><circle cx="15" cy="7" r="1" fill="currentColor"/>',
  orient: '<rect x="3" y="7" width="12" height="9" rx="1.5"/><path d="M19 9v7a3 3 0 01-3 3h-3m0 0l2-2m-2 2l2 2"/>',
  nodeAdd: '<circle cx="8" cy="12" r="3"/><path d="M11 12h5M19 9v6M16 12h6"/>',
  sibling: '<circle cx="7" cy="7" r="2.5"/><circle cx="7" cy="17" r="2.5"/><path d="M12 7h8M12 17h8M17 14v6M14 17h6"/>',
  rowAdd: '<rect x="3" y="4" width="18" height="10" rx="1"/><path d="M3 9h18M12 17v4M10 19h4"/>',
  colAdd: '<rect x="4" y="3" width="10" height="18" rx="1"/><path d="M9 3v18M17 12h4M19 10v4"/>',
  pointer: '<circle cx="12" cy="12" r="2.5"/><circle cx="12" cy="12" r="7" opacity=".5"/>',
  drop: '<path d="M12 3s6 6.5 6 11a6 6 0 01-12 0c0-4.5 6-11 6-11z" fill="currentColor"/>',
  starSm: '<path d="M12 3l2.6 5.6 6.1.7-4.5 4.2 1.2 6L12 16.5 6.6 19.5l1.2-6L3.3 9.3l6.1-.7z"/>',
  mapPin: '<path d="M12 21s7-6 7-11a7 7 0 00-14 0c0 5 7 11 7 11z"/><circle cx="12" cy="10" r="2.5"/>',
  external: '<path d="M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 01-1 1H5a1 1 0 01-1-1V7a1 1 0 011-1h5"/>',
  bold: '<path d="M7 4h6a4 4 0 010 8H7zM7 12h7a4 4 0 010 8H7z"/>',
  italic: '<path d="M10 4h8M6 20h8M14 4l-4 16"/>',
  underline: '<path d="M7 4v8a5 5 0 0010 0V4M5 21h14"/>',
  alignLeftT: '<path d="M4 6h16M4 10h10M4 14h16M4 18h10"/>',
  alignCenterT: '<path d="M4 6h16M7 10h10M4 14h16M7 18h10"/>',
  alignRightT: '<path d="M4 6h16M10 10h10M4 14h16M10 18h10"/>',
  list: '<path d="M9 6h11M9 12h11M9 18h11M4 6h.01M4 12h.01M4 18h.01"/>',
  todo: '<rect x="4" y="4" width="6" height="6" rx="1"/><path d="M14 7h6M4 14h6v6H4zM14 17h6M5.5 7l1 1 2-2"/>',
  heading: '<path d="M6 4v16M18 4v16M6 12h12"/>',
  expand: '<path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5"/>',
  info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v6M12 7.5v.01"/>',
  theme: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M2 12h2M20 12h2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M19.1 4.9l-1.4 1.4M6.3 17.7l-1.4 1.4"/>',
  cloud: '<path d="M7 18a4 4 0 01-.5-8A6 6 0 0118 9a4.5 4.5 0 01-.5 9z"/>',
  swap: '<path d="M7 4L3 8l4 4M3 8h14M17 20l4-4-4-4M21 16H7"/>',
  align: '<path d="M4 4v16M20 4v16"/><rect x="8" y="6" width="8" height="4" rx="1"/><rect x="6" y="14" width="12" height="4" rx="1"/>',
  mask: '<circle cx="9" cy="12" r="6"/><circle cx="15" cy="12" r="6"/>',
  mic2: '<rect x="9" y="3" width="6" height="11" rx="3" fill="currentColor"/><path d="M5 11a7 7 0 0014 0M12 18v3"/>'
};
U.icon = (name, size = 20) => {
  const s = U.IC[name] || U.IC.info;
  return `<svg class="ic" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${s}</svg>`;
};
U.iconEl = (name, size = 20) => { const d = document.createElement('span'); d.className = 'icw'; d.innerHTML = U.icon(name, size); return d; };
