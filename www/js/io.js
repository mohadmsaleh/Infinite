'use strict';
/* ===== Import / export / camera / audio / scan / drag-and-drop ===== */
const IO = {
  pick(accept, multiple, capture) {
    return new Promise(res => {
      const i = U.el('input', { type: 'file', accept: accept || '*/*', multiple: !!multiple, style: 'position:fixed;left:-999px;opacity:0' }); if (capture) i.setAttribute('capture', capture);
      document.body.append(i); i.onchange = () => { res([...i.files]); i.remove(); }; i.oncancel = () => { res([]); i.remove(); }; i.click();
    });
  },
  at(pt) { return pt ? [pt[0], pt[1]] : Act.center(); },
  /* ---- images ---- */
  async prepImage(file) {
    // downscale very large photos to keep boards light
    if (!/^image\/(jpeg|png|webp)$/.test(file.type) || file.size < 900 * 1024) { const im = await U.loadImg(URL.createObjectURL(file)).catch(() => null); return { blob: file, w: im ? im.naturalWidth : 400, h: im ? im.naturalHeight : 300 }; }
    const url = URL.createObjectURL(file); const im = await U.loadImg(url); URL.revokeObjectURL(url); const max = 2800; const s = Math.min(1, max / Math.max(im.naturalWidth, im.naturalHeight));
    if (s === 1 && file.size < 4e6) return { blob: file, w: im.naturalWidth, h: im.naturalHeight };
    const cv = document.createElement('canvas'); cv.width = Math.round(im.naturalWidth * s); cv.height = Math.round(im.naturalHeight * s); cv.getContext('2d').drawImage(im, 0, 0, cv.width, cv.height);
    const blob = await U.canvasBlob(cv, file.type === 'image/png' ? 'image/png' : 'image/jpeg', .9); return { blob, w: cv.width, h: cv.height };
  },
  async addImage(file, pt, name) {
    const { blob, w, h } = await IO.prepImage(file); const id = await AS.add(blob, name || file.name || 'image.png'); const k = Math.min(1, 460 / Math.max(w, h)), [cx, cy] = IO.at(pt);
    const o = D.make('image', { asset: id, nw: w, nh: h, w: w * k, h: h * k, name: name || file.name || '' }); o.x = cx - o.w / 2; o.y = cy - o.h / 2; return o;
  },
  async addVideo(file, pt) {
    const id = await AS.add(file, file.name || 'video.webm'); const el = AS.media(id, 'video'); await new Promise(r => { el.onloadedmetadata = r; setTimeout(r, 2500); });
    const asp = el.videoWidth ? el.videoWidth / el.videoHeight : 16 / 9; const w = Math.min(520, Math.max(240, el.videoWidth || 480)), [cx, cy] = IO.at(pt);
    const o = D.make('video', { asset: id, name: file.name || 'video', w, h: w / asp }); o.x = cx - o.w / 2; o.y = cy - o.h / 2; return o;
  },
  async addAudio(file, pt) {
    const id = await AS.add(file, file.name || 'audio'); const el = AS.media(id, 'audio'); await new Promise(r => { el.onloadedmetadata = r; setTimeout(r, 1500); });
    const [cx, cy] = IO.at(pt); const o = D.make('audio', { asset: id, name: (file.name || 'Audio').replace(/\.[^.]+$/, ''), dur: isFinite(el.duration) ? el.duration : 0 }); o.x = cx - o.w / 2; o.y = cy - o.h / 2; return o;
  },
  async addFileCard(file, pt) { const id = await AS.add(file, file.name); const [cx, cy] = IO.at(pt); const o = D.make('file', { asset: id, name: file.name, mime: file.type, size: file.size }); o.x = cx - o.w / 2; o.y = cy - o.h / 2; return o; },
  async addText(file, pt) { const txt = (await file.text()).slice(0, 30000); const [cx, cy] = IO.at(pt); const o = D.make('doc', { title: file.name.replace(/\.[^.]+$/, ''), md: txt }); Md.layout(o); o.x = cx - o.w / 2; o.y = cy - 60; return o; },
  async addFiles(files, pt, target) {
    files = [...files]; if (!files.length) return; const out = []; let i = 0; const base = IO.at(pt);
    if (target && target.type === 'placeholder' && files.length) { await IO.fillPlaceholder(target, files[0]); return; }
    UI.toast('Adding ' + files.length + ' file' + (files.length > 1 ? 's' : '') + '…');
    for (const f of files) {
      const p = [base[0] + (i % 3) * 40 + 0, base[1] + Math.floor(i / 3) * 40 + i * 0]; if (files.length > 1) { p[0] = base[0] + (i % 3) * 340 - 340; p[1] = base[1] + Math.floor(i / 3) * 280; }
      try {
        const ext = (f.name.split('.').pop() || '').toLowerCase(); let o;
        if (/^image\//.test(f.type) || /^(png|jpe?g|gif|webp|bmp|svg)$/.test(ext)) o = await IO.addImage(f, p);
        else if (/^video\//.test(f.type)) o = await IO.addVideo(f, p);
        else if (/^audio\//.test(f.type)) o = await IO.addAudio(f, p);
        else if (/^(txt|md)$/.test(ext) && f.size < 200000) o = await IO.addText(f, p);
        else if ((ext === 'pdf' || f.type === 'application/pdf') && D.kind === 'study') { await Study.addPdf(f, files.length > 1 || pt ? { x: pt ? pt[0] : undefined, y: pt ? pt[1] : undefined } : null); i++; continue; }
        else if (ext === 'pdf' || f.type === 'application/pdf') { const ch = files.length === 1 ? await UI.choice('PDF', 'How would you like to add this PDF?', [{ label: 'File card', value: 'file' }, { label: 'Pages as images', value: 'pages', primary: true }]) : 'file'; if (ch === 'pages') { const pg = await IO.pdfPages(f, p); if (pg && pg.length) { out.push(...pg); i++; continue; } } if (ch === null) continue; o = await IO.addFileCard(f, p); if (ch === 'file') { o.prev = false; } }
        else o = await IO.addFileCard(f, p);
        if (o) out.push(o);
      } catch (e) { console.error(e); UI.toast('Could not add ' + f.name, 3000, 'err'); }
      i++;
    }
    if (out.length) { out.forEach(o => D.add(o)); Sel.set(out.map(o => o.id)); D.commit('Add files', out); const b = G.union(out), vr = R.viewRect(); if (b.x < vr.x || b.y < vr.y || b.x + b.w > vr.x + vr.w || b.y + b.h > vr.y + vr.h) R.fitRect(b, 100, true, 1.2); }
  },
  async pdfPages(file, p) {
    try {
      UI.toast('Loading PDF renderer…', 6000);
      const lib = await import('https://cdn.jsdelivr.net/npm/pdfjs-dist@4.4.168/build/pdf.min.mjs'); lib.GlobalWorkerOptions.workerSrc = 'https://cdn.jsdelivr.net/npm/pdfjs-dist@4.4.168/build/pdf.worker.min.mjs';
      const doc = await lib.getDocument({ data: new Uint8Array(await file.arrayBuffer()) }).promise; const out = []; const n = Math.min(doc.numPages, 40); let x = p[0];
      for (let i = 1; i <= n; i++) { const page = await doc.getPage(i); const vp = page.getViewport({ scale: 1.6 }); const cv = document.createElement('canvas'); cv.width = vp.width; cv.height = vp.height; await page.render({ canvasContext: cv.getContext('2d'), viewport: vp }).promise; const blob = await U.canvasBlob(cv, 'image/jpeg', .9); const id = await AS.add(blob, file.name + ' p' + i); const w = 560, h = w * vp.height / vp.width; const o = D.make('image', { asset: id, nw: cv.width, nh: cv.height, w, h, name: file.name + ' p' + i, bw: 1, bc: '#d6dae3' }); o.x = x; o.y = p[1] - h / 2; x += w + 40; out.push(o); }
      return out;
    } catch (e) { console.warn(e); UI.toast('Could not render PDF pages (offline?) — added as a file card', 3500); return null; }
  },
  async fillPlaceholder(o, file) {
    if (!file) { const acc = o.kind === 'image' ? 'image/*' : o.kind === 'video' ? 'video/*' : '*/*'; [file] = await IO.pick(acc, false); }
    if (!file) return; let n; const isImg = /^image\//.test(file.type), isVid = /^video\//.test(file.type);
    if (isImg) n = await IO.addImage(file, [0, 0]); else if (isVid) n = await IO.addVideo(file, [0, 0]); else n = await IO.addFileCard(file, [0, 0]);
    const fit = Math.min(o.w / n.w, o.h / n.h); if (isImg || isVid) { n.w *= fit; n.h *= fit; } n.x = o.x + (o.w - n.w) / 2; n.y = o.y + (o.h - n.h) / 2; n.rot = o.rot; n.layer = o.layer;
    const idx = D.objs.indexOf(o); D.remove([o]); D.add(n); D.objs.splice(D.objs.indexOf(n), 1); D.objs.splice(Math.max(0, idx), 0, n); D._ord = null; Sel.set([n.id]); D.commit('Fill placeholder', n);
  },
  /* ---- camera / mic / scan ---- */
  async stream(constraints) { if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) throw new Error('Camera access is not available in this browser/context (needs HTTPS).'); return navigator.mediaDevices.getUserMedia(constraints); },
  async camera(mode, then) {
    let facing = 'environment', stream = null, rec = null, chunks = [];
    const v = U.el('video', { autoplay: true, playsinline: true, muted: true, class: 'camv' }); const msg = U.el('div', { class: 'mtext' }, 'Starting camera…'); const rt = U.el('span', { class: 'rtime', style: 'display:none' }, '0:00');
    const start = async () => { if (stream) stream.getTracks().forEach(t => t.stop()); try { stream = await IO.stream({ video: { facingMode: facing, width: { ideal: 1920 }, height: { ideal: 1080 } }, audio: false }); v.srcObject = stream; msg.textContent = ''; } catch (e) { msg.textContent = e.message || 'Camera permission denied.'; msg.classList.add('err'); } };
    const stop = () => { if (stream) stream.getTracks().forEach(t => t.stop()); if (rec && rec.state !== 'inactive') rec.stop(); };
    const shot = U.el('button', { class: 'shutter', title: 'Capture', onclick: async () => {
      if (mode === 'video') {
        if (rec && rec.state === 'recording') { rec.stop(); return; }
        let ms = stream; try { const a = await IO.stream({ audio: true }); ms = new MediaStream([...stream.getVideoTracks(), ...a.getAudioTracks()]); } catch (e) { }
        chunks = []; const mime = ['video/webm;codecs=vp9,opus', 'video/webm;codecs=vp8,opus', 'video/webm', 'video/mp4'].find(m => MediaRecorder.isTypeSupported(m)); rec = new MediaRecorder(ms, { mimeType: mime }); rec.ondataavailable = e => e.data.size && chunks.push(e.data);
        rec.onstop = async () => { const blob = new Blob(chunks, { type: mime.split(';')[0] }); m.close(); const f = new File([blob], 'camera-' + Date.now() + '.webm', { type: blob.type }); const o = await IO.addVideo(f); Act.insert(o, 'Add video'); };
        rec.start(); shot.classList.add('rec'); rt.style.display = ''; const t0 = Date.now(); const iv = setInterval(() => { if (rec.state !== 'recording') return clearInterval(iv); rt.textContent = U.fmtTime((Date.now() - t0) / 1000); }, 300);
      } else {
        const cv = document.createElement('canvas'); cv.width = v.videoWidth; cv.height = v.videoHeight; cv.getContext('2d').drawImage(v, 0, 0); const blob = await U.canvasBlob(cv, 'image/jpeg', .92); m.close();
        if (then) then(blob); else { const o = await IO.addImage(new File([blob], 'photo-' + Date.now() + '.jpg', { type: 'image/jpeg' })); Act.insert(o, 'Add photo'); }
      }
    } });
    const body = U.el('div', { class: 'camwrap' }, v, msg, U.el('div', { class: 'camctl' }, UI.ibtn('swap', 'Switch camera', () => { facing = facing === 'user' ? 'environment' : 'user'; start(); }), shot, rt, UI.ibtn('upload', 'Choose from files', async () => { const [f] = await IO.pick(mode === 'video' ? 'video/*' : 'image/*', false, mode === 'video' ? 'environment' : 'environment'); if (f) { m.close(); if (mode === 'video') Act.insert(await IO.addVideo(f), 'Add video'); else if (then) then(f); else Act.insert(await IO.addImage(f), 'Add photo'); } })));
    const m = UI.modal({ title: mode === 'video' ? 'Record video' : mode === 'scan' ? 'Scan document' : 'Take photo', body, width: 620, cls: 'cam', onClose: stop }); start();
  },
  audio() {
    let stream, rec, chunks = [], t0 = 0, iv, an, ctxA; const bars = U.el('canvas', { width: 480, height: 70, style: 'width:100%;height:70px;background:#f3f4f8;border-radius:10px' }); const time = U.el('div', { class: 'bigtime' }, '0:00'); const msg = U.el('div', { class: 'mtext' }, 'Press record to start');
    const btn = U.el('button', { class: 'shutter', onclick: async () => {
      if (rec && rec.state === 'recording') { rec.stop(); return; }
      try { stream = await IO.stream({ audio: true }); } catch (e) { msg.textContent = e.message || 'Microphone permission denied.'; msg.classList.add('err'); return; }
      const mime = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4'].find(x => MediaRecorder.isTypeSupported(x)); chunks = []; rec = new MediaRecorder(stream, { mimeType: mime }); rec.ondataavailable = e => e.data.size && chunks.push(e.data);
      rec.onstop = async () => { clearInterval(iv); stream.getTracks().forEach(t => t.stop()); try { ctxA.close(); } catch (e) { } const blob = new Blob(chunks, { type: mime.split(';')[0] }); m.close(); const f = new File([blob], 'Recording ' + new Date().toLocaleTimeString() + '.webm', { type: blob.type }); Act.insert(await IO.addAudio(f), 'Add audio'); };
      ctxA = new (window.AudioContext || window.webkitAudioContext)(); an = ctxA.createAnalyser(); an.fftSize = 128; ctxA.createMediaStreamSource(stream).connect(an); const data = new Uint8Array(an.frequencyBinCount);
      rec.start(); btn.classList.add('rec'); msg.textContent = 'Recording… press again to stop and add to the board'; t0 = Date.now();
      iv = setInterval(() => { time.textContent = U.fmtTime((Date.now() - t0) / 1000); }, 300);
      const draw = () => { if (!rec || rec.state !== 'recording') return; an.getByteFrequencyData(data); const c = bars.getContext('2d'); c.clearRect(0, 0, 480, 70); c.fillStyle = '#6366f1'; const n = data.length; for (let i = 0; i < n; i++) { const h = data[i] / 255 * 62 + 3; c.fillRect(i * (480 / n) + 1, 35 - h / 2, 480 / n - 3, h); } requestAnimationFrame(draw); }; draw();
    } });
    const m = UI.modal({ title: 'Record audio', body: U.el('div', { class: 'camwrap' }, bars, time, msg, U.el('div', { class: 'camctl' }, btn)), width: 500, onClose: () => { try { if (rec && rec.state === 'recording') { rec.onstop = null; rec.stop(); } if (stream) stream.getTracks().forEach(t => t.stop()); clearInterval(iv); } catch (e) { } } });
  },
  scan() {
    const choose = U.el('div', { class: 'scanchoose' }, UI.btn('Use camera', 'camera', () => { m.close(); IO.camera('scan', blob => IO.scanEdit(blob)); }, 'primary'), UI.btn('Choose image', 'image', async () => { const [f] = await IO.pick('image/*', false, 'environment'); if (f) { m.close(); IO.scanEdit(f); } }));
    const m = UI.modal({ title: 'Scan a document', body: U.el('div', null, U.el('p', { class: 'mtext' }, 'Capture a page or pick a photo. The scan is cleaned up (flat lighting, crisp text) and added to the board.'), choose), width: 440 });
  },
  async scanEdit(blob) {
    const url = URL.createObjectURL(blob); const im = await U.loadImg(url); const s = Math.min(1, 1800 / Math.max(im.naturalWidth, im.naturalHeight)); const W = Math.round(im.naturalWidth * s), H = Math.round(im.naturalHeight * s);
    const src = document.createElement('canvas'); src.width = W; src.height = H; src.getContext('2d').drawImage(im, 0, 0, W, H); const state = { mode: 'enhanced', l: 0, r: 0, t: 0, b: 0, rot: 0 };
    const cv = U.el('canvas', { style: 'width:100%;max-height:50vh;object-fit:contain;background:#222;border-radius:8px' });
    const render = (full) => {
      const cw = Math.round(W * (100 - state.l - state.r) / 100), ch = Math.round(H * (100 - state.t - state.b) / 100); const k = full ? 1 : Math.min(1, 700 / Math.max(cw, ch)); const w = Math.max(8, Math.round(cw * k)), h = Math.max(8, Math.round(ch * k));
      const out = document.createElement('canvas'); const rot = state.rot % 2; out.width = rot ? h : w; out.height = rot ? w : h; const c = out.getContext('2d'); c.save(); c.translate(out.width / 2, out.height / 2); c.rotate(state.rot * Math.PI / 2); c.drawImage(src, W * state.l / 100, H * state.t / 100, cw, ch, -w / 2, -h / 2, w, h); c.restore();
      if (state.mode !== 'original') IO.scanFilter(out, state.mode);
      return out;
    };
    const draw = () => { const o = render(false); cv.width = o.width; cv.height = o.height; cv.getContext('2d').drawImage(o, 0, 0); };
    const mk = (k, l) => UI.field(l, UI.range(0, 40, 1, state[k], v => { state[k] = v; draw(); }, { fmt: v => v + '%' }));
    const body = U.el('div', null, cv, UI.field('Filter', UI.seg([['original', 'Original'], ['enhanced', 'Enhanced'], ['gray', 'Grey'], ['bw', 'Black & white']], state.mode, v => { state.mode = v; draw(); })), U.el('div', { class: 'grid2' }, mk('l', 'Crop left'), mk('r', 'Crop right'), mk('t', 'Crop top'), mk('b', 'Crop bottom')), UI.btn('Rotate 90°', 'rotate', () => { state.rot++; draw(); }));
    draw(); UI.modal({ title: 'Scan', body, width: 560, buttons: [{ label: 'Cancel' }, { label: 'Add to board', primary: true, fn: async () => { const out = render(true); const b = await U.canvasBlob(out, 'image/jpeg', .92); const o = await IO.addImage(new File([b], 'scan-' + Date.now() + '.jpg', { type: 'image/jpeg' })); Act.insert(o, 'Add scan'); } }], onClose: () => URL.revokeObjectURL(url) });
  },
  scanFilter(cv, mode) {
    const c = cv.getContext('2d'), w = cv.width, h = cv.height, id = c.getImageData(0, 0, w, h), d = id.data; const g = new Float32Array(w * h);
    for (let i = 0; i < w * h; i++) g[i] = .299 * d[i * 4] + .587 * d[i * 4 + 1] + .114 * d[i * 4 + 2];
    if (mode === 'gray') { for (let i = 0; i < w * h; i++) { const v = U.clamp((g[i] - 20) * 1.15, 0, 255); d[i * 4] = d[i * 4 + 1] = d[i * 4 + 2] = v; } c.putImageData(id, 0, 0); return; }
    // local mean via integral image
    const I = new Float64Array((w + 1) * (h + 1)); for (let y = 0; y < h; y++) { let row = 0; for (let x = 0; x < w; x++) { row += g[y * w + x]; I[(y + 1) * (w + 1) + x + 1] = I[y * (w + 1) + x + 1] + row; } }
    const r = Math.max(6, Math.round(Math.min(w, h) / 14));
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const x0 = Math.max(0, x - r), x1 = Math.min(w, x + r + 1), y0 = Math.max(0, y - r), y1 = Math.min(h, y + r + 1); const area = (x1 - x0) * (y1 - y0);
      const m = (I[y1 * (w + 1) + x1] - I[y0 * (w + 1) + x1] - I[y1 * (w + 1) + x0] + I[y0 * (w + 1) + x0]) / area; const i = (y * w + x) * 4;
      if (mode === 'bw') { const v = g[y * w + x] < m * .86 ? 0 : 255; d[i] = d[i + 1] = d[i + 2] = v; }
      else { const f = 238 / Math.max(m, 40); for (let k = 0; k < 3; k++) { let v = d[i + k] * f; v = v > 255 ? 255 : v; v = 255 * Math.pow(v / 255, 1.35) * 1.08; d[i + k] = v > 255 ? 255 : v; } }
    }
    c.putImageData(id, 0, 0);
  },
  /* ---- rendering / export ---- */
  renderCanvas(o = {}) {
    let objs = o.objs; let area = o.area;
    if (!objs) objs = D.sorted().filter(x => D.isVisible(x));
    if (!area) { const b = G.union(objs.filter(x => x.type !== 'connector' || true)); area = b ? { x: b.x - (o.pad ?? 40), y: b.y - (o.pad ?? 40), w: b.w + 2 * (o.pad ?? 40), h: b.h + 2 * (o.pad ?? 40) } : { x: 0, y: 0, w: 800, h: 600 }; }
    let sc = o.scale || 1; const max = 7000; if (area.w * sc > max || area.h * sc > max) sc = Math.min(max / area.w, max / area.h);
    const W = Math.max(1, Math.round(area.w * sc)), H = Math.max(1, Math.round(area.h * sc)); const cv = document.createElement('canvas'); cv.width = W; cv.height = H; const ctx = cv.getContext('2d');
    const list = D.sorted().filter(x => D.isVisible(x) && (o.all || objs.includes(x))); if (o.frame && !list.includes(o.frame)) list.unshift(o.frame);
    const frameBg = o.frame ? o.frame.bg : D.bg;
    R.paint(ctx, { view: { x: area.x, y: area.y, z: sc }, W, H, dpr: 1, objs: o.clip === false ? list : list.filter(x => G.rectsHit(G.aabb(x), area)), bg: o.bg === undefined ? D.bg : (o.bg || '#ffffff'), transparent: o.bg === null, grid: o.grid ? D.grid : null, exporting: true });
    return cv;
  },
  async renderBlob(o) { const cv = IO.renderCanvas(o); return U.canvasBlob(cv, o.type || 'image/png', o.q || .92); },
  async thumb() {
    const objs = D.sorted().filter(x => D.isVisible(x)); if (!objs.length) return ''; let b = G.union(objs); const pad = Math.max(b.w, b.h) * .05 + 20; const area = { x: b.x - pad, y: b.y - pad, w: b.w + 2 * pad, h: b.h + 2 * pad };
    const asp = 3 / 2; if (area.w / area.h > asp) { const nh = area.w / asp; area.y -= (nh - area.h) / 2; area.h = nh; } else { const nw = area.h * asp; area.x -= (nw - area.w) / 2; area.w = nw; }
    const cv = IO.renderCanvas({ objs, area, scale: 420 / area.w, bg: D.bg, clip: true }); return cv.toDataURL('image/jpeg', .72);
  },
  async cutout(poly, remove) {
    let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9; poly.forEach(p => { x0 = Math.min(x0, p[0]); y0 = Math.min(y0, p[1]); x1 = Math.max(x1, p[0]); y1 = Math.max(y1, p[1]); }); const area = { x: x0, y: y0, w: x1 - x0, h: y1 - y0 };
    if (area.w < 6 || area.h < 6) return; const sc = Math.min(3, 2400 / Math.max(area.w, area.h)); const list = R.visList.filter(o => o.type !== 'frame' && G.rectsHit(G.aabb(o), area));
    if (!list.length) { UI.toast('Nothing inside the selection'); return; }
    const base = IO.renderCanvas({ objs: list, area, scale: sc, bg: null, clip: true }); const cv = document.createElement('canvas'); cv.width = base.width; cv.height = base.height; const c = cv.getContext('2d'); c.beginPath(); poly.forEach((p, i) => { const x = (p[0] - area.x) * sc, y = (p[1] - area.y) * sc; i ? c.lineTo(x, y) : c.moveTo(x, y); }); c.closePath(); c.clip(); c.drawImage(base, 0, 0);
    const blob = await U.canvasBlob(cv, 'image/png'); const id = await AS.add(blob, 'cutout.png'); const o = D.make('image', { asset: id, nw: cv.width, nh: cv.height, x: area.x + (remove ? 0 : 30), y: area.y + (remove ? 0 : 30), w: area.w, h: area.h, name: 'cutout' });
    if (remove) Erase.lasso(poly, true); D.add(o); Sel.set([o.id]); D.commit('Cut out', o); UI.toast(remove ? 'Cut out and removed from board' : 'Copied cut-out as a new image');
  },
  /* ---- PDF writer ---- */
  async buildPdf(pages) {
    const enc = new TextEncoder(), parts = [], offs = []; let pos = 0; const push = x => { const b = typeof x === 'string' ? enc.encode(x) : x; parts.push(b); pos += b.length; };
    push('%PDF-1.4\n'); const n = pages.length; const obj = (id, body) => { offs[id] = pos; push(`${id} 0 obj\n`); if (typeof body === 'string') push(body); else body.forEach(push); push('\nendobj\n'); };
    obj(1, '<< /Type /Catalog /Pages 2 0 R >>'); obj(2, `<< /Type /Pages /Count ${n} /Kids [${pages.map((_, i) => (3 + i * 3) + ' 0 R').join(' ')}] >>`);
    pages.forEach((p, i) => {
      const pid = 3 + i * 3, cid = pid + 1, iid = pid + 2; obj(pid, `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${p.w.toFixed(2)} ${p.h.toFixed(2)}] /Resources << /XObject << /Im0 ${iid} 0 R >> >> /Contents ${cid} 0 R >>`);
      const cs = `q ${p.w.toFixed(2)} 0 0 ${p.h.toFixed(2)} 0 0 cm /Im0 Do Q`; obj(cid, `<< /Length ${cs.length} >>\nstream\n${cs}\nendstream`);
      obj(iid, [`<< /Type /XObject /Subtype /Image /Width ${p.iw} /Height ${p.ih} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${p.jpeg.length} >>\nstream\n`, p.jpeg, '\nendstream']);
    });
    const xref = pos; push(`xref\n0 ${3 + n * 3}\n0000000000 65535 f \n`); for (let i = 1; i < 3 + n * 3; i++) push(String(offs[i]).padStart(10, '0') + ' 00000 n \n');
    push(`trailer\n<< /Size ${3 + n * 3} /Root 1 0 R /Info << /Title (${(D.name || 'Board').replace(/[()\\]/g, '')}) /Producer (InfiniBoard) >> >>\nstartxref\n${xref}\n%%EOF`);
    return new Blob(parts, { type: 'application/pdf' });
  },
  async pdfPage(canvas, wpx, hpx) { const blob = await U.canvasBlob(canvas, 'image/jpeg', .92); const jpeg = new Uint8Array(await blob.arrayBuffer()); return { jpeg, iw: canvas.width, ih: canvas.height, w: Math.min(14400, wpx * .75), h: Math.min(14400, hpx * .75) }; },
  exportDialog(init = {}) {
    const S = { scope: init.frame ? 'frame' : init.scope || (Sel.ids.length ? 'sel' : 'board'), fmt: init.fmt || 'png', scale: 2, bg: 'board', grid: false, frameId: init.frame ? init.frame.id : (D.frames()[0] || {}).id, pages: 'frames' };
    const frames = D.frames(); const body = U.el('div', { class: 'expd' }); const scopeBox = U.el('div'), optBox = U.el('div');
    const render = () => {
      scopeBox.innerHTML = ''; optBox.innerHTML = '';
      const scopes = [['board', 'Whole board'], ['view', 'Current view']]; if (Sel.ids.length) scopes.push(['sel', 'Selection']); if (frames.length) scopes.push(['frame', 'One frame']); if (frames.length > 1 || (frames.length && S.fmt === 'pdf')) scopes.push(['frames', 'All frames']);
      scopeBox.append(UI.field('What to export', UI.seg(scopes, S.scope, v => { S.scope = v; render(); })));
      if (S.scope === 'frame') scopeBox.append(UI.select(frames.map(f => [f.id, f.name]), S.frameId, v => S.frameId = v));
      scopeBox.append(UI.field('Format', UI.seg([['png', 'PNG'], ['jpg', 'JPG'], ['pdf', 'PDF']], S.fmt, v => { S.fmt = v; render(); })));
      optBox.append(UI.field('Quality / scale', UI.seg([[1, '1×'], [2, '2×'], [3, '3×'], [4, '4×']], S.scale, v => S.scale = v)));
      optBox.append(UI.field('Background', UI.seg([['board', 'Board colour'], ['white', 'White'], ...(S.fmt === 'png' ? [['none', 'Transparent']] : [])], S.bg, v => S.bg = v)));
      optBox.append(UI.toggle('Include grid', S.grid, v => S.grid = v));
    };
    render(); body.append(scopeBox, optBox);
    const go = async copy => {
      UI.toast('Rendering…', 1500); if (D.kind === 'study') { try { await Study.warm(S.scope === 'board' ? null : (S.scope === 'view' ? [R.viewRect()] : S.scope === 'sel' ? [G.union(Sel.objs())] : frames.map(f => ({ x: f.x, y: f.y, w: f.w, h: f.h }))), S.scale); } catch (e) { console.warn(e); } } const bg = S.bg === 'none' ? null : S.bg === 'white' ? '#ffffff' : undefined; const base = { scale: S.scale, bg, grid: S.grid }; const targets = [];
      if (S.scope === 'board') targets.push({}); else if (S.scope === 'view') targets.push({ area: R.viewRect(), all: true, clip: true }); else if (S.scope === 'sel') targets.push({ objs: Sel.objs(), pad: 24 });
      else if (S.scope === 'frame') { const f = D.byId.get(S.frameId); targets.push({ area: { x: f.x, y: f.y, w: f.w, h: f.h }, all: true, frame: f, bg: bg === undefined ? f.bg : bg }); }
      else frames.forEach(f => targets.push({ area: { x: f.x, y: f.y, w: f.w, h: f.h }, all: true, frame: f, bg: bg === undefined ? f.bg : bg }));
      const name = (D.name || 'board').replace(/[\\/:*?"<>|]+/g, '_');
      if (S.fmt === 'pdf') {
        const pages = []; for (const t of targets) { const o = Object.assign({}, base, t); const cv = IO.renderCanvas(Object.assign(o, { bg: o.bg === null ? '#ffffff' : o.bg })); const a = o.area || { w: cv.width / S.scale, h: cv.height / S.scale }; pages.push(await IO.pdfPage(cv, a.w, a.h)); }
        U.download(await IO.buildPdf(pages), name + '.pdf'); UI.toast('PDF exported'); return;
      }
      const mime = S.fmt === 'jpg' ? 'image/jpeg' : 'image/png';
      if (targets.length === 1) { const o = Object.assign({}, base, targets[0]); if (S.fmt === 'jpg' && o.bg === null) o.bg = '#ffffff'; const blob = await U.canvasBlob(IO.renderCanvas(o), mime, .92); if (copy) { try { await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]); UI.toast('Copied to clipboard'); } catch (e) { UI.toast('Clipboard not available', 2500, 'err'); } } else { U.download(blob, name + '.' + S.fmt); UI.toast('Image exported'); } }
      else { let i = 1; for (const t of targets) { const o = Object.assign({}, base, t); if (S.fmt === 'jpg' && o.bg === null) o.bg = '#ffffff'; U.download(await U.canvasBlob(IO.renderCanvas(o), mime, .92), `${name}-${i++}.${S.fmt}`); await new Promise(r => setTimeout(r, 250)); } }
    };
    UI.modal({ title: 'Export board', body, width: 480, buttons: [{ label: 'Copy image', fn: () => { go(true); return true; } }, { label: 'Export', primary: true, fn: async () => { await go(false); } }] });
  },
  /* ---- board file ---- */
  async boardBlob() {
    await D.save(false); const assets = []; for (const e of AS.map.values()) assets.push({ id: e.id, name: e.name, mime: e.mime, data: await U.blobToDataURL(e.blob) });
    return new Blob([JSON.stringify({ format: 'infiniboard', v: 1, board: JSON.parse(D.toJSON()), assets })], { type: 'application/json' });
  },
  async importBoard(file) {
    const j = JSON.parse(await file.text()); if (j.format !== 'infiniboard') throw new Error('Not an InfiniBoard file'); const b = j.board; b.id = U.uid('b'); b.name = (b.name || 'Imported') + (App.boards.some(x => x.name === b.name) ? ' (imported)' : ''); b.modified = Date.now();
    for (const a of j.assets || []) await DB.put('assets', { key: b.id + '|' + a.id, bid: b.id, id: a.id, blob: U.dataURLToBlob(a.data), mime: a.mime, name: a.name, size: 0 });
    await DB.put('data', { id: b.id, json: JSON.stringify(b) }); await DB.put('meta', { id: b.id, name: b.name, modified: b.modified, created: b.created || Date.now(), count: (b.objs || []).length }); return b.id;
  },
  /* ---- drag & drop and paste ---- */
  initDnD() {
    const stage = U.$('#stage'); const dz = U.$('#dropzone');
    let depth = 0; const hasFiles = e => e.dataTransfer && [...(e.dataTransfer.types || [])].some(t => t === 'Files' || t === 'text/uri-list' || t === 'text/html' || t === 'text/plain');
    window.addEventListener('dragenter', e => { if (!D.id || !hasFiles(e)) return; depth++; dz.classList.add('on'); });
    window.addEventListener('dragleave', e => { if (!D.id) return; depth = Math.max(0, depth - 1); if (!depth) dz.classList.remove('on'); });
    window.addEventListener('dragover', e => { if (!D.id) return; e.preventDefault(); e.dataTransfer.dropEffect = 'copy'; });
    window.addEventListener('drop', async e => {
      if (!D.id) return; e.preventDefault(); depth = 0; dz.classList.remove('on'); const r = R.ov.getBoundingClientRect(); const [x, y] = R.s2w(e.clientX - r.left, e.clientY - r.top); const target = Tools.pick(x, y, true);
      const dt = e.dataTransfer; if (dt.files && dt.files.length) { await IO.addFiles(dt.files, [x, y], target); return; }
      await IO.addData(dt.getData('text/html'), dt.getData('text/uri-list') || '', dt.getData('text/plain') || '', [x, y], target);
    });
    window.addEventListener('paste', async e => {
      if (!D.id || (e.target && /^(INPUT|TEXTAREA)$/.test(e.target.tagName)) || Ed.cur) return; const cd = e.clipboardData; if (!cd) return; e.preventDefault();
      const files = [...(cd.files || [])]; if (files.length) { await IO.addFiles(files, null); return; }
      const txt = cd.getData('text/plain') || ''; if (Act.clip && (txt === Act.clipTxt || !txt)) { Act.paste(); return; }
      await IO.addData(cd.getData('text/html'), cd.getData('text/uri-list') || '', txt, null);
    });
    window.addEventListener('copy', e => { if (!D.id || (e.target && /^(INPUT|TEXTAREA)$/.test(e.target.tagName)) || Ed.cur) return; if (Sel.ids.length) { Act.copy(false); e.clipboardData.setData('text/plain', Act.clipTxt); e.preventDefault(); } });
    window.addEventListener('cut', e => { if (!D.id || (e.target && /^(INPUT|TEXTAREA)$/.test(e.target.tagName)) || Ed.cur) return; if (Sel.ids.length) { Act.copy(true); e.clipboardData.setData('text/plain', Act.clipTxt); e.preventDefault(); } });
  },
  async addData(html, uri, txt, pt, target) {
    let imgUrl = null; const m = /<img[^>]+src=["']([^"']+)["']/i.exec(html || ''); if (m) imgUrl = m[1];
    const url = (uri.split('\n').find(l => l && l[0] !== '#') || '').trim() || (/^https?:\/\/\S+$/.test((txt || '').trim()) ? txt.trim() : '');
    if (imgUrl || (url && /\.(png|jpe?g|gif|webp|svg)(\?|$)/i.test(url))) {
      const u = imgUrl || url; try { const blob = await (await fetch(u, { mode: 'cors' })).blob(); if (/^image\//.test(blob.type)) { await IO.addFiles([new File([blob], 'image.' + (blob.type.split('/')[1] || 'png'), { type: blob.type })], pt, target); return; } } catch (e) { }
      if (/^data:image/.test(u)) { const blob = U.dataURLToBlob(u); await IO.addFiles([new File([blob], 'image.png', { type: blob.type })], pt, target); return; }
      UI.toast('That app blocked reading the image — adding it as a link card', 3200);
    }
    const [cx, cy] = IO.at(pt);
    if (url) { const o = D.make('embed', { url: Embeds.norm(url).url, title: '', x: cx - 280, y: cy - 150, w: 560, h: 340 }); Act.insert(o, 'Add link'); return; }
    if (txt && txt.trim()) { const t = txt.trim(); const o = t.length < 280 ? D.make('sticky', { text: t, x: cx - 100, y: cy - 100 }) : D.make('doc', { title: 'Pasted text', md: t.slice(0, 30000), x: cx - 220, y: cy - 100 }); if (o.type === 'doc') Md.layout(o); Act.insert(o, 'Paste text'); }
  }
};
