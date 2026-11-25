'use strict';
/* ===== Canvas Pro Suite — Miro & Explain Everything Upgrade =====
   Features:
   1. Miro Presentation Mode (Frame-by-Frame smooth animated slide show + Laser HUD)
   2. Miro Facilitator Toolkit: Countdown Timer (WebAudio chime), Dot Voting (live badges + leaderboard), Sticky Clustering by Color
   3. Miro Pro Templates Gallery (SWOT, Eisenhower Matrix, Retrospective, User Journey, Cornell Board, Product Roadmap)
   4. Explain Everything Spotlight Mode (live movable focus beam dimming the rest of the canvas)
   5. Explain Everything Infinite Cloner (mark any object as master cloner with ∞ badge)
   6. Explain Everything Direct Canvas + Audio Video Studio (30fps composited WebM recorder — works on mobile/WebView)
*/
(function () {
  if (typeof R === 'undefined' || typeof D === 'undefined' || typeof Menus === 'undefined') return;

  Object.assign(U.IC, {
    present: '<rect x="3" y="4" width="18" height="12" rx="2"/><path d="M12 16v4M8 20h8M10 8l4 2.5-4 2.5z"/>',
    timer: '<circle cx="12" cy="13" r="8"/><path d="M12 9v4l2.5 2M9 2h6"/>',
    vote: '<path d="M12 2l2.9 6.2 6.8.9-5 4.8 1.2 6.8L12 17.5 6.1 20.7l1.2-6.8-5-4.8 6.8-.9z"/>',
    spotlight: '<circle cx="12" cy="12" r="9" stroke-dasharray="3 3"/><circle cx="12" cy="12" r="4"/>',
    templates: '<rect x="3" y="3" width="8" height="8" rx="1.5"/><rect x="13" y="3" width="8" height="5" rx="1.5"/><rect x="13" y="10" width="8" height="11" rx="1.5"/><rect x="3" y="13" width="8" height="8" rx="1.5"/>',
    cloner: '<path d="M8 12c0-2.2 1.8-4 4-4 1.5 0 2.8.8 3.5 2 .7-1.2 2-2 3.5-2 2.2 0 4 1.8 4 4s-1.8 4-4 4c-1.5 0-2.8-.8-3.5-2-.7 1.2-2 2-3.5 2-2.2 0-4-1.8-4-4z" transform="translate(-3.5 0)"/>',
    studio: '<circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="3.5" fill="currentColor"/>'
  });

  const CPro = window.CPro = {
    presentOn: false,
    presentIdx: 0,
    votingOn: false,
    spotlightOn: false,
    spotPos: [400, 300],
    spotRadius: 140,
    timerState: { sec: 300, rem: 300, running: false, iv: null },
    studio: { on: false, mr: null, chunks: [], raf: 0, t0: 0, iv: null, stream: null }
  };

  /* =====================================================================
     1. MIRO PRESENTATION MODE (FRAME-BY-FRAME ANIMATED SLIDES)
     ===================================================================== */
  CPro.startPresent = function () {
    const frames = D.frames();
    if (!frames.length) {
      UI.toast('Add at least one Frame (F) to start Presentation Mode!', 3500);
      return;
    }
    CPro.presentOn = true;
    CPro.presentIdx = 0;
    document.getElementById('app').classList.add('presenting');
    CPro.showSlide(0);
    CPro.mountPresentHud();
  };

  CPro.showSlide = function (idx) {
    const frames = D.frames(); if (!frames.length) return;
    CPro.presentIdx = U.clamp(idx, 0, frames.length - 1);
    const f = frames[CPro.presentIdx];
    R.fitRect({ x: f.x, y: f.y, w: f.w, h: f.h }, 36, true, 4);
    const lbl = document.getElementById('pres-count');
    if (lbl) lbl.textContent = `${CPro.presentIdx + 1} / ${frames.length} · ${f.name || 'Slide'}`;
  };

  CPro.stopPresent = function () {
    CPro.presentOn = false;
    document.getElementById('app').classList.remove('presenting');
    const h = document.getElementById('pres-hud'); if (h) h.remove();
  };

  CPro.mountPresentHud = function () {
    const old = document.getElementById('pres-hud'); if (old) old.remove();
    const hud = U.el('div', { id: 'pres-hud', class: 'pres-hud' },
      UI.btn('← Prev', null, () => CPro.showSlide(CPro.presentIdx - 1), 'sm'),
      U.el('span', { id: 'pres-count', class: 'pres-count' }, ''),
      UI.btn('Next →', null, () => CPro.showSlide(CPro.presentIdx + 1), 'sm primary'),
      UI.ibtn('laser', 'Laser Pointer', () => Tools.set(Tools.tool === 'laser' ? 'hand' : 'laser')),
      UI.ibtn('spotlight', 'Toggle Spotlight', () => CPro.toggleSpotlight()),
      UI.ibtn('close', 'Exit Presentation (Esc)', () => CPro.stopPresent())
    );
    document.getElementById('board').append(hud);
    CPro.showSlide(CPro.presentIdx);
  };

  document.addEventListener('keydown', e => {
    if (!CPro.presentOn) return;
    if (e.key === 'Escape') CPro.stopPresent();
    else if (e.key === 'ArrowRight' || e.key === ' ' || e.key === 'PageDown') { e.preventDefault(); CPro.showSlide(CPro.presentIdx + 1); }
    else if (e.key === 'ArrowLeft' || e.key === 'PageUp') { e.preventDefault(); CPro.showSlide(CPro.presentIdx - 1); }
  });

  /* =====================================================================
     2. MIRO FACILITATOR TOOLKIT (TIMER, DOT VOTING, STICKY CLUSTERING)
     ===================================================================== */
  function beepDone() {
    try {
      const ac = new (window.AudioContext || window.webkitAudioContext)();
      [523.25, 659.25, 783.99].forEach((freq, i) => {
        const osc = ac.createOscillator(), g = ac.createGain();
        osc.type = 'sine'; osc.frequency.value = freq;
        g.gain.setValueAtTime(0.14, ac.currentTime + i * 0.16);
        g.gain.exponentialRampToValueAtTime(0.001, ac.currentTime + i * 0.16 + 0.35);
        osc.connect(g); g.connect(ac.destination);
        osc.start(ac.currentTime + i * 0.16); osc.stop(ac.currentTime + i * 0.16 + 0.36);
      });
    } catch (e) { }
  }

  CPro.toggleTimer = function () {
    const ex = document.getElementById('cpro-timer');
    if (ex) { ex.remove(); clearInterval(CPro.timerState.iv); CPro.timerState.running = false; return; }
    const st = CPro.timerState;
    const pill = U.el('div', { id: 'cpro-timer', class: 'cpro-pill' });
    const disp = U.el('b', { class: 'cpro-tdisp' }, '05:00');
    const fmt = s => `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
    const upd = () => { disp.textContent = fmt(st.rem); pill.classList.toggle('done', st.rem === 0); };
    const startStop = () => {
      if (st.running) { clearInterval(st.iv); st.running = false; playBtn.textContent = 'Start'; }
      else {
        if (st.rem <= 0) st.rem = st.sec;
        st.running = true; playBtn.textContent = 'Pause';
        st.iv = setInterval(() => {
          st.rem = Math.max(0, st.rem - 1); upd();
          if (st.rem === 0) { clearInterval(st.iv); st.running = false; playBtn.textContent = 'Start'; beepDone(); UI.toast('Time is up!'); }
        }, 1000);
      }
    };
    const playBtn = UI.btn('Start', null, startStop, 'sm primary');
    const addM = m => { st.sec = Math.max(60, st.rem + m * 60); st.rem = st.sec; upd(); };
    pill.append(
      U.el('span', { html: U.icon('timer', 18) }),
      disp,
      UI.btn('+1m', null, () => addM(1), 'sm'),
      UI.btn('+5m', null, () => addM(5), 'sm'),
      playBtn,
      UI.btn('Reset', null, () => { clearInterval(st.iv); st.running = false; st.rem = st.sec; playBtn.textContent = 'Start'; upd(); }, 'sm'),
      UI.ibtn('close', 'Close timer', () => CPro.toggleTimer())
    );
    document.getElementById('board').append(pill);
    upd();
  };

  // Dot Voting Mode
  CPro.toggleVoting = function () {
    CPro.votingOn = !CPro.votingOn;
    UI.toast(CPro.votingOn ? 'Dot Voting ON — click any sticky or shape to cast a vote' : 'Dot Voting OFF', 3000);
    R.reqOv();
    const b = document.getElementById('cpro-vote-bar');
    if (CPro.votingOn && !b) {
      const bar = U.el('div', { id: 'cpro-vote-bar', class: 'cpro-pill vote-bar' },
        U.el('b', null, 'Dot Voting Active'),
        UI.btn('Leaderboard', 'vote', () => CPro.showVoteResults(), 'sm primary'),
        UI.btn('Reset Votes', null, () => { D.objs.forEach(o => { if (o.votes) delete o.votes; }); D.commit('Reset votes', []); R.reqOv(); UI.toast('All votes cleared'); }, 'sm'),
        UI.ibtn('close', 'Stop voting', () => CPro.toggleVoting())
      );
      document.getElementById('board').append(bar);
    } else if (!CPro.votingOn && b) b.remove();
  };

  CPro.showVoteResults = function () {
    const ranked = D.objs.filter(o => o.votes > 0).sort((a, b) => b.votes - a.votes);
    const body = U.el('div', null);
    if (!ranked.length) body.append(U.el('div', { class: 'hint' }, 'No votes cast yet. Click objects while Dot Voting is active.'));
    else ranked.forEach((o, i) => {
      const txt = (o.text || o.name || o.type).slice(0, 60);
      body.append(U.el('div', { class: 'frow', onclick: () => { Sel.set([o.id]); R.fitRect(G.aabb(o), 140, true, 1.5); } },
        U.el('span', { class: 'pgbadge' }, `#${i + 1}`),
        U.el('span', { class: 'sp' }, txt),
        U.el('b', { style: 'color:var(--ac)' }, `${o.votes} ★`)
      ));
    });
    UI.modal({ title: 'Dot Voting Results', body, width: 440, buttons: [{ label: 'Close', primary: true }] });
  };

  document.addEventListener('click', e => {
    if (!CPro.votingOn || !D.id || e.target !== R.ov) return;
    const rc = R.ov.getBoundingClientRect();
    const [wx, wy] = R.s2w(e.clientX - rc.left, e.clientY - rc.top);
    for (let i = D.objs.length - 1; i >= 0; i--) {
      const o = D.objs[i];
      if (o.type === 'pdfpage' || o.type === 'frame') continue;
      const b = G.aabb(o);
      if (wx >= b.x && wx <= b.x + b.w && wy >= b.y && wy <= b.y + b.h) {
        o.votes = (o.votes || 0) + 1;
        D.commit('Vote', o);
        R.reqOv();
        return;
      }
    }
  });

  // Auto-Cluster Sticky Notes by Color (Miro feature)
  CPro.clusterStickies = function () {
    const stickies = D.objs.filter(o => o.type === 'sticky' && !o.locked);
    if (stickies.length < 2) { UI.toast('Need at least 2 unlocked sticky notes to cluster'); return; }
    const groups = new Map();
    stickies.forEach(s => {
      const col = s.color || '#ffe14d';
      if (!groups.has(col)) groups.set(col, []);
      groups.get(col).push(s);
    });
    const [cx, cy] = Act.center();
    const cols = [...groups.values()];
    const startX = cx - (cols.length * 240) / 2;
    cols.forEach((arr, ci) => {
      arr.forEach((s, ri) => {
        s.x = startX + ci * 240;
        s.y = cy - 220 + ri * (s.h + 20);
      });
    });
    D.commit('Cluster stickies by colour', stickies);
    R.req();
    UI.toast(`Clustered ${stickies.length} sticky notes into ${cols.length} colour groups`);
  };

  /* =====================================================================
     3. MIRO PRO TEMPLATES GALLERY
     ===================================================================== */
  CPro.insertTemplate = function (kind) {
    const [cx, cy] = Act.center();
    const created = [];
    const add = (type, props) => { const o = D.make(type, props); D.add(o); created.push(o); return o; };

    if (kind === 'swot') {
      const boxes = [
        ['Strengths', '#dcfce7', '#16a34a', -330, -230],
        ['Weaknesses', '#fee2e2', '#dc2626', 10, -230],
        ['Opportunities', '#dbeafe', '#2563eb', -330, 10],
        ['Threats', '#fef3c7', '#d97706', 10, 10]
      ];
      boxes.forEach(([t, fill, stroke, dx, dy]) => {
        add('shape', { kind: 'rect', x: cx + dx, y: cy + dy, w: 320, h: 220, fill, stroke, sw: 2, r: 12, text: t });
        add('sticky', { x: cx + dx + 24, y: cy + dy + 56, w: 130, h: 110, color: '#fff9c4', text: 'Add point…' });
      });
    } else if (kind === 'eisenhower') {
      const quads = [
        ['Do First (Urgent + Important)', '#fee2e2', '#ef4444', -330, -230],
        ['Schedule (Important)', '#dbeafe', '#3b82f6', 10, -230],
        ['Delegate (Urgent)', '#fef3c7', '#f59e0b', -330, 10],
        ['Eliminate (Neither)', '#f1f5f9', '#64748b', 10, 10]
      ];
      quads.forEach(([t, fill, stroke, dx, dy]) => {
        add('shape', { kind: 'rect', x: cx + dx, y: cy + dy, w: 320, h: 220, fill, stroke, sw: 2, r: 12, text: t });
      });
    } else if (kind === 'retro') {
      const cols = [['Start Doing', '#dcfce7', '#16a34a'], ['Stop Doing', '#fee2e2', '#dc2626'], ['Continue Doing', '#dbeafe', '#2563eb']];
      cols.forEach(([t, fill, stroke], i) => {
        const x = cx - 480 + i * 330;
        add('shape', { kind: 'rect', x, y: cy - 220, w: 300, h: 440, fill, stroke, sw: 2, r: 14, text: t });
        add('sticky', { x: x + 30, y: cy - 140, w: 240, h: 110, color: '#ffffff', text: 'Team note…' });
      });
    } else if (kind === 'cornell') {
      add('frame', { x: cx - 400, y: cy - 520, w: 800, h: 1040, name: 'Cornell Study Page', bg: '#ffffff', tpl: 'lined', tplc: '#cbd5e1', tsp: 30, stroke: '#94a3b8' });
      add('shape', { kind: 'rect', x: cx - 380, y: cy - 500, w: 760, h: 80, fill: '#eef2ff', stroke: '#4f46e5', sw: 1.5, r: 8, text: 'Topic / Title & Date' });
      add('shape', { kind: 'rect', x: cx - 380, y: cy - 405, w: 220, h: 720, fill: 'rgba(241,245,249,.65)', stroke: '#94a3b8', sw: 1.5, r: 8, text: 'Cues & Questions' });
      add('shape', { kind: 'rect', x: cx - 145, y: cy - 405, w: 525, h: 720, fill: 'rgba(255,255,255,.3)', stroke: '#94a3b8', sw: 1.5, r: 8, text: 'Main Notes' });
      add('shape', { kind: 'rect', x: cx - 380, y: cy + 330, w: 760, h: 170, fill: '#fef9c3', stroke: '#eab308', sw: 1.5, r: 8, text: 'Summary (Key Takeaways)' });
    } else if (kind === 'roadmap') {
      const phases = ['Q1 · Discovery', 'Q2 · Build', 'Q3 · Launch', 'Q4 · Scale'];
      phases.forEach((p, i) => {
        const x = cx - 540 + i * 280;
        add('shape', { kind: 'rect', x, y: cy - 180, w: 250, h: 60, fill: '#4f46e5', stroke: '#3730a3', sw: 1.5, r: 10, text: p, tc: '#ffffff' });
        add('sticky', { x: x + 15, y: cy - 95, w: 220, h: 110, color: ['#dbeafe', '#dcfce7', '#fef3c7', '#fce7f3'][i], text: 'Milestone 1…' });
        add('sticky', { x: x + 15, y: cy + 35, w: 220, h: 110, color: '#ffffff', text: 'Milestone 2…' });
      });
    }

    if (created.length) {
      Sel.set(created.map(o => o.id));
      D.commit('Insert Miro template', created);
      R.fitRect(G.union(created), 100, true, 1.2);
      UI.toast('Template inserted');
    }
  };

  CPro.openTemplatesModal = function () {
    const items = [
      ['swot', 'SWOT Analysis', '4-quadrant strategic analysis with starter stickies'],
      ['eisenhower', 'Eisenhower Matrix', 'Urgent vs. Important task prioritization'],
      ['retro', 'Team Retrospective', 'Start / Stop / Continue workshop columns'],
      ['cornell', 'Cornell Study Board', 'Structured academic notes + cues + summary'],
      ['roadmap', 'Quarterly Roadmap', '4-phase product & milestone timeline']
    ];
    const body = U.el('div', { class: 'cpro-grid' });
    items.forEach(([k, title, desc]) => {
      body.append(U.el('button', { class: 'cpro-tcard', onclick: () => { CPro.insertTemplate(k); document.querySelector('.modal-bg')?.remove(); } },
        U.el('b', null, title),
        U.el('small', null, desc)
      ));
    });
    UI.modal({ title: 'Miro Pro Templates', body, width: 520, buttons: [{ label: 'Close' }] });
  };

  /* =====================================================================
     4. EXPLAIN EVERYTHING: SPOTLIGHT & INFINITE CLONER
     ===================================================================== */
  CPro.toggleSpotlight = function () {
    CPro.spotlightOn = !CPro.spotlightOn;
    UI.toast(CPro.spotlightOn ? 'Spotlight ON — move pointer to illuminate' : 'Spotlight OFF', 2200);
    R.reqOv();
  };

  document.addEventListener('pointermove', e => {
    if (!CPro.spotlightOn || !R.ov) return;
    const rc = R.ov.getBoundingClientRect();
    CPro.spotPos = [e.clientX - rc.left, e.clientY - rc.top];
    R.reqOv();
  });

  // Infinite Cloner hook: clicking a cloner spawns a fresh movable copy
  document.addEventListener('pointerdown', e => {
    if (!D.id || e.target !== R.ov || Tools.tool !== 'select') return;
    const rc = R.ov.getBoundingClientRect();
    const [wx, wy] = R.s2w(e.clientX - rc.left, e.clientY - rc.top);
    for (let i = D.objs.length - 1; i >= 0; i--) {
      const o = D.objs[i];
      if (!o.cloner) continue;
      const b = G.aabb(o);
      if (wx >= b.x && wx <= b.x + b.w && wy >= b.y && wy <= b.y + b.h) {
        const clone = D.make(o.type, Object.assign({}, JSON.parse(JSON.stringify(o)), { id: U.uid(), x: o.x + 24, y: o.y + 24, cloner: false, locked: false }));
        delete clone._j;
        D.add(clone);
        Sel.set([clone.id]);
        D.commit('Infinite clone', clone);
        R.req();
        UI.toast('Cloned from Infinite Cloner', 1200);
        return;
      }
    }
  }, true);

  // Render overlays: Vote badges, Infinite Cloner ∞ badge, and Spotlight beam
  R.overlays.push(ctx => {
    if (!D.id) return;
    // Vote badges & cloner indicators
    for (const o of D.objs) {
      if (!D.isVisible(o)) continue;
      if (o.votes > 0) {
        const b = G.aabb(o);
        const p = R.w2s(b.x + b.w, b.y);
        ctx.save();
        ctx.fillStyle = '#4f46e5';
        ctx.beginPath(); ctx.arc(p[0], p[1], 13, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#fff'; ctx.font = 'bold 11px sans-serif';
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText(String(o.votes), p[0], p[1] + .5);
        ctx.restore();
      }
      if (o.cloner) {
        const b = G.aabb(o);
        const p = R.w2s(b.x + 12, b.y + 12);
        ctx.save();
        ctx.fillStyle = '#0ea5e9';
        ctx.beginPath(); ctx.arc(p[0], p[1], 11, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#fff'; ctx.font = 'bold 13px sans-serif';
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText('∞', p[0], p[1] + .5);
        ctx.restore();
      }
    }

    // Explain Everything Spotlight overlay
    if (CPro.spotlightOn) {
      const [sx, sy] = CPro.spotPos;
      ctx.save();
      ctx.fillStyle = 'rgba(10,14,26,0.72)';
      ctx.beginPath();
      ctx.rect(0, 0, R.W, R.H);
      ctx.arc(sx, sy, CPro.spotRadius, 0, Math.PI * 2, true);
      ctx.fill('evenodd');
      ctx.strokeStyle = 'rgba(255,255,255,.55)';
      ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(sx, sy, CPro.spotRadius, 0, Math.PI * 2); ctx.stroke();
      ctx.restore();
    }
  });

  /* =====================================================================
     5. EXPLAIN EVERYTHING: DIRECT CANVAS + AUDIO VIDEO STUDIO (WebM)
     ===================================================================== */
  CPro.toggleStudioRec = async function () {
    const st = CPro.studio;
    if (st.on) {
      st.on = false;
      cancelAnimationFrame(st.raf);
      clearInterval(st.iv);
      try { st.mr && st.mr.stop(); } catch (e) { }
      const pill = document.getElementById('studio-pill'); if (pill) pill.remove();
      return;
    }
    if (!window.MediaRecorder || !HTMLCanvasElement.prototype.captureStream) {
      UI.toast('Video recording is not supported in this WebView/browser', 3500, 'err');
      return;
    }
    const comp = document.createElement('canvas');
    comp.width = Math.min(1920, R.cv.width);
    comp.height = Math.min(1080, R.cv.height);
    const cctx = comp.getContext('2d');
    const pump = () => {
      if (!st.on) return;
      cctx.clearRect(0, 0, comp.width, comp.height);
      cctx.drawImage(R.cv, 0, 0, comp.width, comp.height);
      cctx.drawImage(R.ov, 0, 0, comp.width, comp.height);
      cctx.drawImage(R.lcv, 0, 0, comp.width, comp.height);
      st.raf = requestAnimationFrame(pump);
    };
    const vStream = comp.captureStream(30);
    let aStream = null;
    try { aStream = await navigator.mediaDevices.getUserMedia({ audio: true }); } catch (e) { }
    const tracks = [...vStream.getVideoTracks(), ...(aStream ? aStream.getAudioTracks() : [])];
    const combined = new MediaStream(tracks);
    st.chunks = [];
    const mr = new MediaRecorder(combined, { mimeType: MediaRecorder.isTypeSupported('video/webm;codecs=vp9,opus') ? 'video/webm;codecs=vp9,opus' : 'video/webm' });
    st.mr = mr; st.t0 = Date.now(); st.on = true;
    mr.ondataavailable = e => e.data && e.data.size && st.chunks.push(e.data);
    mr.onstop = () => {
      tracks.forEach(t => t.stop());
      const blob = new Blob(st.chunks, { type: 'video/webm' });
      const name = (D.name || 'explanation').replace(/[\\/:*?"<>|]+/g, '_') + '-video.webm';
      U.download(blob, name);
      UI.toast('Explanation video saved (' + name + ')', 3500);
    };
    mr.start(1000);
    pump();
    const tm = U.el('b', null, '00:00');
    const pill = U.el('div', { id: 'studio-pill', class: 'cpro-pill studio-rec' },
      U.el('span', { class: 'rec-dot' }),
      U.el('span', null, 'Recording Explanation'),
      tm,
      UI.btn('Stop & Save', null, () => CPro.toggleStudioRec(), 'sm danger')
    );
    document.getElementById('board').append(pill);
    st.iv = setInterval(() => {
      const s = Math.floor((Date.now() - st.t0) / 1000);
      tm.textContent = `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
    }, 500);
    UI.toast('Canvas + Audio recording started', 2000);
  };

  /* =====================================================================
     6. HOOK INTO BOARD MENU, CONTEXT MENU & TOOLBAR
     ===================================================================== */
  const _origBoardMenu = Menus.board;
  Menus.board = function () {
    const items = _origBoardMenu.call(Menus);
    items.unshift(
      { header: 'Miro & Explain Everything Pro' },
      { label: 'Presentation Mode (Frames)', icon: 'present', fn: () => CPro.startPresent() },
      { label: 'Miro Pro Templates…', icon: 'templates', fn: () => CPro.openTemplatesModal() },
      { label: 'Record Explanation Video (WebM)', icon: 'studio', fn: () => CPro.toggleStudioRec() },
      { label: 'Spotlight Focus Beam', icon: 'spotlight', checked: CPro.spotlightOn, fn: () => CPro.toggleSpotlight() },
      { label: 'Facilitator Countdown Timer', icon: 'timer', fn: () => CPro.toggleTimer() },
      { label: 'Dot Voting Mode', icon: 'vote', checked: CPro.votingOn, fn: () => CPro.toggleVoting() },
      { label: 'Cluster Sticky Notes by Colour', icon: 'sticky', fn: () => CPro.clusterStickies() },
      { sep: true }
    );
    return items;
  };

  // Add Infinite Cloner toggle to object context menu
  const _origCtxMenu = Menus.context;
  Menus.context = function (x, y, o, pt) {
    _origCtxMenu.call(Menus, x, y, o, pt);
    const s = Sel.objs();
    if (s.length === 1 && s[0].type !== 'pdfpage' && s[0].type !== 'frame') {
      const one = s[0];
      const menuEl = document.querySelector('.menu');
      if (menuEl && !menuEl.querySelector('.cpro-clone-item')) {
        const btn = U.el('button', {
          class: 'mi cpro-clone-item',
          html: `<span class="ic">${U.icon('cloner', 16)}</span><span>${one.cloner ? 'Disable Infinite Cloner' : 'Enable Infinite Cloner (∞)'}</span>`,
          onclick: () => {
            one.cloner = !one.cloner;
            if (one.cloner) one.locked = true;
            D.commit('Toggle Infinite Cloner', one);
            R.reqOv();
            UI.toast(one.cloner ? 'Infinite Cloner ON — click & drag to spawn copies' : 'Infinite Cloner OFF');
            menuEl.remove();
          }
        });
        menuEl.append(btn);
      }
    }
  };

  // Inject quick Miro/Explain Everything buttons into whiteboard topbar when opening a board
  const _origOpen = App.open;
  App.open = async function (id, silent) {
    const res = await _origOpen.call(App, id, silent);
    if (!silent && D.kind !== 'study') {
      const tb = U.$('#topbar');
      if (tb && !tb.querySelector('.cpro-tb-btn')) {
        const mk = (ic, title, fn) => {
          const b = UI.ibtn(ic, title, fn);
          b.classList.add('cpro-tb-btn');
          return b;
        };
        const sp = tb.querySelector('.sp');
        const btns = [
          mk('present', 'Presentation Mode (Miro Frames)', () => CPro.startPresent()),
          mk('templates', 'Miro Pro Templates', () => CPro.openTemplatesModal()),
          mk('studio', 'Record Explanation Video (Explain Everything)', () => CPro.toggleStudioRec()),
          mk('spotlight', 'Spotlight Focus Beam', () => CPro.toggleSpotlight()),
          mk('timer', 'Facilitator Countdown Timer', () => CPro.toggleTimer()),
          mk('vote', 'Dot Voting Mode', () => CPro.toggleVoting())
        ];
        if (sp && sp.nextSibling) btns.forEach(b => tb.insertBefore(b, sp.nextSibling));
        else btns.forEach(b => tb.append(b));
      }
    }
    return res;
  };
})();
