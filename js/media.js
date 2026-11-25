'use strict';
/* ===== Media objects: image, video, audio, file, embed (browser), placeholder ===== */
const MEDIA_PH = (ctx, o, label, icon) => {
  ctx.fillStyle = '#e8ebf1'; ctx.fillRect(0, 0, o.w, o.h); ctx.fillStyle = '#9aa3b2'; ctx.font = '600 14px ' + U.FONTS.sans; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(label, o.w / 2, o.h / 2);
};
const filterStr = f => f ? `brightness(${f.br ?? 100}%) contrast(${f.ct ?? 100}%) saturate(${f.sa ?? 100}%) grayscale(${f.gr ?? 0}%) sepia(${f.se ?? 0}%) blur(${f.bl ?? 0}px)` : 'none';

T.def('image', {
  def: () => ({ asset: '', nw: 1, nh: 1, crop: null, r: 0, bw: 0, bc: '#ffffff', filt: null, w: 320, h: 220, name: '' }),
  flip: true, resize: 'ratio', conn: true,
  draw(ctx, o, env) {
    const img = AS.img(o.asset); ctx.save();
    if (o.r) { ctx.beginPath(); rr(ctx, 0, 0, o.w, o.h, o.r); ctx.clip(); }
    if (o.fx) { ctx.translate(o.w, 0); ctx.scale(-1, 1); } if (o.fy) { ctx.translate(0, o.h); ctx.scale(1, -1); }
    if (img) {
      if (o.filt) ctx.filter = filterStr(o.filt);
      const c = o.crop || { x: 0, y: 0, w: img.naturalWidth, h: img.naturalHeight };
      ctx.imageSmoothingQuality = 'high'; ctx.drawImage(img, c.x, c.y, c.w, c.h, 0, 0, o.w, o.h); ctx.filter = 'none';
    } else MEDIA_PH(ctx, o, 'Loading image…');
    ctx.restore();
    if (o.bw > 0) { ctx.strokeStyle = o.bc; ctx.lineWidth = o.bw; ctx.beginPath(); rr(ctx, 0, 0, o.w, o.h, o.r || 0); ctx.stroke(); }
  },
  text: o => [o.name],
  ins: o => [
    { sec: 'Image' },
    { k: 'r', t: 'range', l: 'Corner radius', min: 0, max: 200, step: 1 },
    { k: 'bw', t: 'range', l: 'Border', min: 0, max: 30, step: 1 }, { k: 'bc', t: 'color', l: 'Border colour', show: o => o.bw > 0 },
    { sec: 'Adjust' },
    { k: 'filt.br', t: 'range', l: 'Brightness', min: 20, max: 200, step: 1, def: 100 }, { k: 'filt.ct', t: 'range', l: 'Contrast', min: 20, max: 250, step: 1, def: 100 },
    { k: 'filt.sa', t: 'range', l: 'Saturation', min: 0, max: 300, step: 1, def: 100 }, { k: 'filt.gr', t: 'range', l: 'Greyscale', min: 0, max: 100, step: 1, def: 0 },
    { k: 'filt.se', t: 'range', l: 'Sepia', min: 0, max: 100, step: 1, def: 0 },
    { t: 'btns', items: [{ l: 'Reset adjust', ic: 'rotate', fn: o => { o.filt = null; } }, { l: 'Original ratio', ic: 'expand', fn: o => { const c = o.crop || { w: o.nw, h: o.nh }; o.h = o.w * c.h / c.w; } }] },
    { t: 'btns', items: [{ l: 'Crop…', ic: 'cutout', fn: o => Act.cropImage(o) }, { l: 'Download', ic: 'download', fn: o => U.download(AS.get(o.asset).blob, o.name || 'image.png') }] }
  ]
});

const fmtT = s => isFinite(s) ? U.fmtTime(s) : '0:00';
T.def('video', {
  def: () => ({ asset: '', w: 480, h: 270, name: '', loop: false }),
  resize: 'ratio', conn: true,
  draw(ctx, o, env) {
    const el = AS.media(o.asset, 'video'); ctx.fillStyle = '#10131a'; ctx.fillRect(0, 0, o.w, o.h);
    if (el && el.readyState >= 2 && el.videoWidth) { const r = Math.min(o.w / el.videoWidth, o.h / el.videoHeight), dw = el.videoWidth * r, dh = el.videoHeight * r; ctx.drawImage(el, (o.w - dw) / 2, (o.h - dh) / 2, dw, dh); }
    else { ctx.fillStyle = '#6b7280'; ctx.font = '600 14px ' + U.FONTS.sans; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('Loading video…', o.w / 2, o.h / 2 + 40); }
    if (env.exporting) return;
    const playing = el && !el.paused && !el.ended; const s = Math.min(1 / env.z * 1.4, 3) * Math.max(1, Math.min(o.w, o.h) / 260);
    if (!playing) { ctx.fillStyle = 'rgba(0,0,0,.55)'; ctx.beginPath(); ctx.arc(o.w / 2, o.h / 2, 30 * s * env.z, 0, 7); ctx.fill(); ctx.fillStyle = '#fff'; ctx.beginPath(); const r = 30 * s * env.z; ctx.moveTo(o.w / 2 - r * .3, o.h / 2 - r * .45); ctx.lineTo(o.w / 2 + r * .5, o.h / 2); ctx.lineTo(o.w / 2 - r * .3, o.h / 2 + r * .45); ctx.fill(); }
    if (el && el.duration) { const bh = 6 / env.z * 1.2; ctx.fillStyle = 'rgba(0,0,0,.5)'; ctx.fillRect(0, o.h - bh * 2, o.w, bh * 2); ctx.fillStyle = 'rgba(255,255,255,.35)'; ctx.fillRect(10, o.h - bh * 1.4, o.w - 20, bh * .8); ctx.fillStyle = '#6366f1'; ctx.fillRect(10, o.h - bh * 1.4, (o.w - 20) * (el.currentTime / el.duration), bh * .8); }
  },
  tap(o, lx, ly, ev) {
    const el = AS.media(o.asset, 'video'); if (!el) return false;
    if (ly > o.h - 22 / D.view.z && el.duration) { el.currentTime = U.clamp((lx - 10) / (o.w - 20), 0, 1) * el.duration; R.req(); return true; }
    const s = 30 * Math.max(1, Math.min(o.w, o.h) / 260) * 1.4; if (Math.hypot(lx - o.w / 2, ly - o.h / 2) < Math.max(s, 40 / D.view.z) || el.paused === false) { el.paused ? el.play().catch(() => { }) : el.pause(); R.req(); return true; }
    return false;
  },
  text: o => [o.name],
  ins: o => [{ sec: 'Video' }, { k: 'loop', t: 'toggle', l: 'Loop', after: o => { const e = AS.media(o.asset, 'video'); if (e) e.loop = o.loop; } },
  { t: 'btns', items: [{ l: 'Play / pause', ic: 'play', fn: o => T.reg.video.tap(o, o.w / 2, o.h / 2) }, { l: 'Download', ic: 'download', fn: o => U.download(AS.get(o.asset).blob, o.name || 'video.webm') }] }]
});

T.def('audio', {
  def: () => ({ asset: '', w: 300, h: 84, name: 'Audio', dur: 0 }),
  resize: 'w', conn: true,
  draw(ctx, o, env) {
    ctx.fillStyle = '#ffffff'; ctx.strokeStyle = '#d6dae3'; ctx.lineWidth = 1.5; ctx.beginPath(); rr(ctx, 0, 0, o.w, o.h, 14); ctx.fill(); ctx.stroke();
    const el = AS.media(o.asset, 'audio'); const playing = el && !el.paused && !el.ended; const dur = (el && isFinite(el.duration) && el.duration) || o.dur || 0, cur = el ? el.currentTime : 0;
    ctx.fillStyle = '#6366f1'; ctx.beginPath(); ctx.arc(40, o.h / 2, 22, 0, 7); ctx.fill(); ctx.fillStyle = '#fff';
    if (playing) { ctx.fillRect(33, o.h / 2 - 8, 5, 16); ctx.fillRect(42, o.h / 2 - 8, 5, 16); } else { ctx.beginPath(); ctx.moveTo(35, o.h / 2 - 9); ctx.lineTo(48, o.h / 2); ctx.lineTo(35, o.h / 2 + 9); ctx.fill(); }
    const x0 = 76, w = o.w - 90, n = Math.max(8, Math.floor(w / 5)); let seed = 0; for (const ch of o.asset) seed = (seed * 31 + ch.charCodeAt(0)) >>> 0;
    for (let i = 0; i < n; i++) { seed = (seed * 1664525 + 1013904223) >>> 0; const hh = 6 + (seed / 4294967296) * (o.h * .36); const prog = dur ? i / n < cur / dur : false; ctx.fillStyle = prog ? '#6366f1' : '#c4c9d6'; ctx.fillRect(x0 + i * (w / n), o.h * .42 - hh / 2, 3, hh); }
    ctx.fillStyle = '#374151'; ctx.font = '600 12px ' + U.FONTS.sans; ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic'; ctx.fillText((o.name || 'Audio').slice(0, 28), x0, o.h - 14);
    ctx.fillStyle = '#6b7280'; ctx.textAlign = 'right'; ctx.fillText(fmtT(cur) + ' / ' + fmtT(dur), o.w - 14, o.h - 14);
  },
  tap(o, lx, ly) {
    const el = AS.media(o.asset, 'audio'); if (!el) return false;
    if (lx < 70) { el.paused ? el.play().catch(() => { }) : el.pause(); R.req(); return true; }
    if (ly < o.h * .7 && el.duration) { el.currentTime = U.clamp((lx - 76) / (o.w - 90), 0, 1) * el.duration; R.req(); return true; } return false;
  },
  text: o => [o.name],
  ins: o => [{ sec: 'Audio' }, { k: 'name', t: 'text', l: 'Title' }, { t: 'btns', items: [{ l: 'Download', ic: 'download', fn: o => U.download(AS.get(o.asset).blob, (o.name || 'audio') + '.webm') }] }]
});

const FILE_KINDS = { pdf: ['PDF', '#e5484d'], doc: ['DOC', '#2b6cde'], docx: ['DOC', '#2b6cde'], xls: ['XLS', '#1f9d55'], xlsx: ['XLS', '#1f9d55'], csv: ['CSV', '#1f9d55'], ppt: ['PPT', '#e8710a'], pptx: ['PPT', '#e8710a'], zip: ['ZIP', '#6b7280'], txt: ['TXT', '#6b7280'], md: ['MD', '#6b7280'], json: ['JSON', '#8b5cf6'] };
T.def('file', {
  def: () => ({ asset: '', name: 'file', mime: '', size: 0, w: 290, h: 92, prev: false }),
  conn: true, resize: 'free',
  kind(o) { const ext = (o.name.split('.').pop() || '').toLowerCase(); return FILE_KINDS[ext] || [ext.slice(0, 4).toUpperCase() || 'FILE', '#64748b']; },
  isPdf: o => /pdf/i.test(o.mime) || /\.pdf$/i.test(o.name),
  draw(ctx, o, env) {
    const [lab, col] = T.reg.file.kind(o); const head = o.prev ? 54 : o.h;
    ctx.fillStyle = '#fff'; ctx.strokeStyle = '#d6dae3'; ctx.lineWidth = 1.5; ctx.beginPath(); rr(ctx, 0, 0, o.w, o.h, 14); ctx.fill(); ctx.stroke();
    const ih = Math.min(54, head - 20); const y0 = (head - ih) / 2;
    ctx.fillStyle = col; ctx.beginPath(); rr(ctx, 14, y0, ih * .8, ih, 8); ctx.fill(); ctx.fillStyle = '#fff'; ctx.font = '700 12px ' + U.FONTS.sans; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(lab, 14 + ih * .4, y0 + ih / 2);
    const tx = 14 + ih * .8 + 14; ctx.textAlign = 'left'; ctx.fillStyle = '#1f2430'; ctx.font = '600 15px ' + U.FONTS.sans;
    let nm = o.name; const maxw = o.w - tx - 14; while (nm.length > 4 && ctx.measureText(nm).width > maxw) nm = nm.slice(0, -2); if (nm !== o.name) nm += '…';
    ctx.textBaseline = 'alphabetic'; ctx.fillText(nm, tx, head / 2 - 2); ctx.fillStyle = '#7b8496'; ctx.font = '12px ' + U.FONTS.sans; ctx.fillText(U.fmtBytes(o.size) + (o.prev ? '' : '  ·  double-click to open'), tx, head / 2 + 16);
    if (o.prev && !env.exporting) { ctx.fillStyle = '#f3f4f7'; ctx.fillRect(1, 54, o.w - 2, o.h - 55); ctx.fillStyle = '#9aa3b2'; ctx.textAlign = 'center'; ctx.fillText('Loading preview…', o.w / 2, o.h / 2 + 20); }
  },
  open(o) {
    const a = AS.get(o.asset); if (!a) return; const url = AS.url(o.asset);
    if (/pdf|image|text|video|audio/.test(a.mime)) window.open(url, '_blank'); else U.download(a.blob, o.name);
  },
  edit(o) { T.reg.file.open(o); },
  text: o => [o.name],
  ins: o => [{ sec: 'File' }, { k: 'name', t: 'text', l: 'File name' },
  { k: 'prev', t: 'toggle', l: 'Inline preview (PDF)', show: o => T.reg.file.isPdf(o), after: o => { if (o.prev && o.h < 300) { o.h = 420; o.w = Math.max(o.w, 360); } else if (!o.prev) { o.h = 92; } } },
  { t: 'btns', items: [{ l: 'Open', ic: 'external', fn: o => T.reg.file.open(o) }, { l: 'Download', ic: 'download', fn: o => U.download(AS.get(o.asset).blob, o.name) }] }]
});

/* ---- embedded web page ("browser") ---- */
const HEAD = 36;
const Embeds = {
  items: new Map(), active: null,
  init() { Embeds.box = U.$('#embeds'); },
  norm(u) {
    u = (u || '').trim(); if (!u) return { url: '', src: '' };
    if (!/^[a-z][a-z0-9+.-]*:/i.test(u)) u = 'https://' + u;
    let src = u, m;
    if ((m = /(?:youtube\.com\/watch\?v=|youtu\.be\/)([\w-]{6,})/.exec(u))) src = 'https://www.youtube.com/embed/' + m[1];
    else if ((m = /vimeo\.com\/(\d+)/.exec(u))) src = 'https://player.vimeo.com/video/' + m[1];
    else if ((m = /docs\.google\.com\/(document|spreadsheets|presentation)\/d\/([\w-]+)/.exec(u))) src = `https://docs.google.com/${m[1]}/d/${m[2]}/preview`;
    return { url: u, src };
  },
  wants(o) { return o.type === 'embed' ? !!o.url : (o.type === 'file' && o.prev && T.reg.file.isPdf(o)); },
  sync() {
    if (!Embeds.box) return;
    const want = []; const v = D.view, cx = R.W / 2, cy = R.H / 2;
    if (v.z >= .1) for (const o of R.visList) {
      if (!Embeds.wants(o)) continue; const b = G.aabb(o);
      const sx = (b.x - v.x) * v.z, sy = (b.y - v.y) * v.z; if (sx > R.W || sy > R.H || sx + b.w * v.z < 0 || sy + b.h * v.z < 0) continue;
      want.push([o, Math.hypot(sx + b.w * v.z / 2 - cx, sy + b.h * v.z / 2 - cy)]);
    }
    want.sort((a, b) => a[1] - b[1]); const keep = new Set();
    for (const [o] of want.slice(0, 5)) {
      keep.add(o.id); let it = Embeds.items.get(o.id);
      const src = o.type === 'embed' ? Embeds.norm(o.url).src : AS.url(o.asset) + '#toolbar=0&navpanes=0';
      if (!it) {
        const wrap = U.el('div', { class: 'embed' }); const fr = document.createElement('iframe');
        fr.setAttribute('sandbox', 'allow-scripts allow-same-origin allow-forms allow-popups allow-presentation allow-downloads');
        fr.setAttribute('allow', 'fullscreen; autoplay; clipboard-write; encrypted-media; picture-in-picture; camera; microphone'); fr.setAttribute('referrerpolicy', 'no-referrer'); fr.setAttribute('loading', 'lazy');
        fr.src = src; wrap.append(fr); Embeds.box.append(wrap); it = { wrap, fr, src }; Embeds.items.set(o.id, it);
      } else if (it.src !== src) { it.src = src; it.fr.src = src; }
      const top = o.type === 'embed' ? HEAD : 54; const [cxw, cyw] = G.center(o); const [scx, scy] = R.w2s(cxw, cyw);
      it.wrap.style.width = o.w + 'px'; it.wrap.style.height = o.h + 'px'; it.fr.style.top = top + 'px'; it.fr.style.height = (o.h - top) + 'px';
      it.wrap.style.transform = `translate(${scx}px,${scy}px) rotate(${o.rot}rad) scale(${v.z}) translate(${-o.w / 2}px,${-o.h / 2}px)`;
      const act = Embeds.active === o.id; it.fr.style.pointerEvents = act ? 'auto' : 'none'; it.wrap.classList.toggle('active', act);
    }
    for (const [id, it] of [...Embeds.items]) if (!keep.has(id)) { it.wrap.remove(); Embeds.items.delete(id); if (Embeds.active === id) Embeds.deactivate(); }
  },
  activate(id) { Embeds.active = id; U.$('#ov').style.pointerEvents = 'none'; Embeds.sync(); UI.toast('Interacting with page — press Esc or click outside to return', 2600); },
  deactivate() { if (!Embeds.active) return; Embeds.active = null; U.$('#ov').style.pointerEvents = ''; Embeds.sync(); }
};
T.def('embed', {
  def: () => ({ url: '', title: '', w: 560, h: 420 }),
  conn: true, resize: 'free',
  draw(ctx, o, env) {
    ctx.fillStyle = '#fff'; ctx.strokeStyle = '#cfd5e1'; ctx.lineWidth = 1.5; ctx.beginPath(); rr(ctx, 0, 0, o.w, o.h, 12); ctx.fill(); ctx.stroke();
    ctx.save(); ctx.beginPath(); rr(ctx, 0, 0, o.w, HEAD, 12); ctx.rect(0, 12, o.w, HEAD - 12); ctx.clip(); ctx.fillStyle = '#eef0f6'; ctx.fillRect(0, 0, o.w, HEAD); ctx.restore();
    ctx.fillStyle = '#6366f1'; ctx.beginPath(); ctx.arc(20, HEAD / 2, 7, 0, 7); ctx.fill();
    const u = Embeds.norm(o.url).url; let host = u; try { host = new URL(u).host; } catch (e) { }
    ctx.fillStyle = '#374151'; ctx.font = '600 13px ' + U.FONTS.sans; ctx.textAlign = 'left'; ctx.textBaseline = 'middle'; ctx.fillText((o.title || host || 'Empty page').slice(0, Math.floor(o.w / 8)), 36, HEAD / 2);
    if (!env.exporting) { ctx.strokeStyle = '#6b7280'; ctx.lineWidth = 1.6; ctx.beginPath(); const x = o.w - 26, y = HEAD / 2; ctx.moveTo(x - 5, y + 5); ctx.lineTo(x + 5, y - 5); ctx.moveTo(x - 1, y - 5); ctx.lineTo(x + 5, y - 5); ctx.lineTo(x + 5, y + 1); ctx.stroke(); }
    ctx.fillStyle = '#9aa3b2'; ctx.textAlign = 'center'; ctx.font = '600 15px ' + U.FONTS.sans;
    ctx.fillText(o.url ? host : 'Set a web address in the panel', o.w / 2, o.h / 2 + 4);
    if (o.url) { ctx.font = '12px ' + U.FONTS.sans; ctx.fillText(env.z < .1 ? 'Zoom in to load the live page' : 'Double-click to interact · some sites block embedding', o.w / 2, o.h / 2 + 26); }
  },
  tap(o, lx, ly) { if (ly < HEAD && lx > o.w - 48) { window.open(Embeds.norm(o.url).url, '_blank'); return true; } return false; },
  edit(o) { if (!o.url) { Act.askEmbedUrl(o); return; } Embeds.activate(o.id); },
  text: o => [o.title, o.url],
  ins: o => [{ sec: 'Web page' }, { k: 'url', t: 'text', l: 'Address (URL)', after: o => { o.url = Embeds.norm(o.url).url; } }, { k: 'title', t: 'text', l: 'Title' },
  { t: 'btns', items: [{ l: 'Open in browser', ic: 'external', fn: o => window.open(Embeds.norm(o.url).url, '_blank') }, { l: 'Interact', ic: 'pointer', fn: o => Embeds.activate(o.id) }] }]
});

/* ---- placeholder ---- */
T.def('placeholder', {
  def: () => ({ w: 300, h: 200, kind: 'image', label: 'Image placeholder' }),
  conn: true, resize: 'free',
  draw(ctx, o, env) {
    ctx.fillStyle = 'rgba(99,102,241,.07)'; ctx.beginPath(); rr(ctx, 0, 0, o.w, o.h, 14); ctx.fill();
    if (!env.exporting) {
      ctx.strokeStyle = 'rgba(99,102,241,.7)'; ctx.lineWidth = 2; ctx.setLineDash([9, 7]); ctx.stroke(); ctx.setLineDash([]);
      const c = ctx; const cx = o.w / 2, cy = o.h / 2 - 12; c.strokeStyle = '#6366f1'; c.lineWidth = 2; c.beginPath(); rr(c, cx - 22, cy - 16, 44, 32, 5); c.stroke();
      c.beginPath(); c.arc(cx - 9, cy - 4, 4, 0, 7); c.stroke(); c.beginPath(); c.moveTo(cx - 22, cy + 12); c.lineTo(cx - 6, cy); c.lineTo(cx + 4, cy + 8); c.lineTo(cx + 12, cy + 2); c.lineTo(cx + 22, cy + 10); c.stroke();
      c.fillStyle = '#4f46e5'; c.font = '600 14px ' + U.FONTS.sans; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText(o.label, cx, cy + 40);
      c.fillStyle = '#7a82a0'; c.font = '12px ' + U.FONTS.sans; c.fillText('Tap to add or drop a file here', cx, cy + 60);
    }
  },
  tap(o) { IO.fillPlaceholder(o); return true; },
  edit(o) { IO.fillPlaceholder(o); },
  text: o => [o.label],
  ins: o => [{ sec: 'Placeholder' }, { k: 'kind', t: 'select', l: 'Accepts', opts: [['image', 'Image'], ['video', 'Video'], ['any', 'Any file']] }, { k: 'label', t: 'text', l: 'Label' }, { t: 'btns', items: [{ l: 'Fill…', ic: 'upload', fn: o => IO.fillPlaceholder(o) }] }]
});
