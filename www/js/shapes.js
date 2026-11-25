'use strict';
/* ===== Text helper, shape library, and basic object types: shape, line, text, sticky, frame ===== */
const Txt = {
  font(o, fs) { return `${o.i ? 'italic ' : ''}${o.b ? '700 ' : '400 '}${fs || o.fs || 16}px ${U.FONTS[o.fnt || 'sans']}`; },
  LH: 1.28,
  lines(o, text, w, fs) { return U.wrap(text || '', Txt.font(o, fs), w); },
  height(o, text, w, fs) { return Txt.lines(o, text, w, fs).length * fs * Txt.LH; },
  draw(ctx, o, text, x, y, w, h, opt = {}) {
    if (!text) return;
    const fs = opt.fs || o.fs || 16, font = Txt.font(o, fs), lines = U.wrap(text, font, w), lh = fs * Txt.LH, th = lines.length * lh;
    const va = opt.va || o.va || 'middle', al = opt.al || o.al || 'center';
    let ty = va === 'middle' ? y + (h - th) / 2 : va === 'bottom' ? y + h - th : y;
    if (th > h && va !== 'top') ty = y + (va === 'middle' ? (h - th) / 2 : h - th);
    ctx.font = font; ctx.fillStyle = opt.color || o.tc || '#1f2430'; ctx.textBaseline = 'middle'; ctx.textAlign = al;
    const px = al === 'left' ? x : al === 'right' ? x + w : x + w / 2;
    for (let i = 0; i < lines.length; i++) {
      const ly = ty + (i + .5) * lh; ctx.fillText(lines[i], px, ly);
      if (o.u && lines[i]) { const tw = ctx.measureText(lines[i]).width; const sx = al === 'left' ? px : al === 'right' ? px - tw : px - tw / 2; ctx.fillRect(sx, ly + fs * .42, tw, Math.max(1, fs / 14)); }
    }
  }
};

const rr = (c, x, y, w, h, r) => {
  r = Math.max(0, Math.min(r, w / 2, h / 2));
  c.moveTo(x + r, y); c.lineTo(x + w - r, y); c.arcTo(x + w, y, x + w, y + r, r); c.lineTo(x + w, y + h - r); c.arcTo(x + w, y + h, x + w - r, y + h, r);
  c.lineTo(x + r, y + h); c.arcTo(x, y + h, x, y + h - r, r); c.lineTo(x, y + r); c.arcTo(x, y, x + r, y, r); c.closePath();
};
const poly = (c, pts, w, h) => { pts.forEach((p, i) => i ? c.lineTo(p[0] * w, p[1] * h) : c.moveTo(p[0] * w, p[1] * h)); c.closePath(); };
const fitPoly = pts => { const xs = pts.map(p => p[0]), ys = pts.map(p => p[1]); const x0 = Math.min(...xs), x1 = Math.max(...xs), y0 = Math.min(...ys), y1 = Math.max(...ys); return pts.map(p => [(p[0] - x0) / (x1 - x0), (p[1] - y0) / (y1 - y0)]); };
const regPoly = (n, rot = -Math.PI / 2, inner) => { const pts = []; const m = inner ? n * 2 : n; for (let i = 0; i < m; i++) { const a = rot + i * Math.PI * 2 / m, r = inner && i % 2 ? inner : 1; pts.push([Math.cos(a) * r, Math.sin(a) * r]); } return fitPoly(pts); };
const P_STAR5 = regPoly(5, -Math.PI / 2, .42), P_STAR4 = regPoly(4, -Math.PI / 2, .38), P_STAR6 = regPoly(6, -Math.PI / 2, .55), P_PENT = regPoly(5), P_HEX = regPoly(6, 0), P_OCT = regPoly(8, Math.PI / 8);

const SHAPES = {
  rect: { n: 'Rectangle', f: (c, w, h) => c.rect(0, 0, w, h) },
  round: { n: 'Rounded', f: (c, w, h, o) => rr(c, 0, 0, w, h, o.r == null ? 16 : o.r) },
  ellipse: { n: 'Ellipse', f: (c, w, h) => { c.moveTo(w, h / 2); c.ellipse(w / 2, h / 2, w / 2, h / 2, 0, 0, Math.PI * 2); c.closePath(); }, ins: [.146, .146, .146, .146] },
  triangle: { n: 'Triangle', f: (c, w, h) => poly(c, [[.5, 0], [1, 1], [0, 1]], w, h), ins: [.25, .4, .25, .02] },
  rtriangle: { n: 'Right triangle', f: (c, w, h) => poly(c, [[0, 0], [1, 1], [0, 1]], w, h), ins: [.05, .4, .4, .02] },
  diamond: { n: 'Diamond', f: (c, w, h) => poly(c, [[.5, 0], [1, .5], [.5, 1], [0, .5]], w, h), ins: [.25, .25, .25, .25] },
  parallelogram: { n: 'Parallelogram', f: (c, w, h) => poly(c, [[.2, 0], [1, 0], [.8, 1], [0, 1]], w, h), ins: [.15, 0, .15, 0] },
  trapezoid: { n: 'Trapezoid', f: (c, w, h) => poly(c, [[.2, 0], [.8, 0], [1, 1], [0, 1]], w, h), ins: [.12, 0, .12, 0] },
  pentagon: { n: 'Pentagon', f: (c, w, h) => poly(c, P_PENT, w, h), ins: [.12, .12, .12, .05] },
  hexagon: { n: 'Hexagon', f: (c, w, h) => poly(c, P_HEX, w, h), ins: [.15, .05, .15, .05] },
  octagon: { n: 'Octagon', f: (c, w, h) => poly(c, P_OCT, w, h), ins: [.1, .1, .1, .1] },
  star: { n: 'Star', f: (c, w, h) => poly(c, P_STAR5, w, h), ins: [.3, .35, .3, .15] },
  star4: { n: '4-point star', f: (c, w, h) => poly(c, P_STAR4, w, h), ins: [.3, .3, .3, .3] },
  star6: { n: '6-point star', f: (c, w, h) => poly(c, P_STAR6, w, h), ins: [.25, .25, .25, .25] },
  heart: { n: 'Heart', f: (c, w, h) => { c.moveTo(w * .5, h * .95); c.bezierCurveTo(w * .08, h * .65, 0, h * .35, w * .2, h * .15); c.bezierCurveTo(w * .35, 0, w * .5, h * .1, w * .5, h * .25); c.bezierCurveTo(w * .5, h * .1, w * .65, 0, w * .8, h * .15); c.bezierCurveTo(w, h * .35, w * .92, h * .65, w * .5, h * .95); c.closePath(); }, ins: [.2, .2, .2, .25] },
  cloud: { n: 'Cloud', f: (c, w, h) => { c.moveTo(w * .25, h * .88); c.bezierCurveTo(-w * .02, h * .88, -w * .02, h * .45, w * .22, h * .46); c.bezierCurveTo(w * .16, h * .1, w * .55, h * .0, w * .6, h * .3); c.bezierCurveTo(w * .72, h * .08, w * 1.0, h * .2, w * .9, h * .5); c.bezierCurveTo(w * 1.04, h * .52, w * 1.02, h * .9, w * .78, h * .88); c.closePath(); }, ins: [.15, .25, .15, .15] },
  arrowR: { n: 'Arrow right', f: (c, w, h) => poly(c, [[0, .3], [.6, .3], [.6, 0], [1, .5], [.6, 1], [.6, .7], [0, .7]], w, h), ins: [.05, .3, .25, .3] },
  arrowL: { n: 'Arrow left', f: (c, w, h) => poly(c, [[1, .3], [.4, .3], [.4, 0], [0, .5], [.4, 1], [.4, .7], [1, .7]], w, h), ins: [.25, .3, .05, .3] },
  arrowU: { n: 'Arrow up', f: (c, w, h) => poly(c, [[.3, 1], [.3, .4], [0, .4], [.5, 0], [1, .4], [.7, .4], [.7, 1]], w, h), ins: [.3, .4, .3, .05] },
  arrowD: { n: 'Arrow down', f: (c, w, h) => poly(c, [[.3, 0], [.3, .6], [0, .6], [.5, 1], [1, .6], [.7, .6], [.7, 0]], w, h), ins: [.3, .05, .3, .4] },
  arrowLR: { n: 'Double arrow', f: (c, w, h) => poly(c, [[0, .5], [.25, 0], [.25, .3], [.75, .3], [.75, 0], [1, .5], [.75, 1], [.75, .7], [.25, .7], [.25, 1]], w, h), ins: [.25, .3, .25, .3] },
  chevron: { n: 'Chevron', f: (c, w, h) => poly(c, [[0, 0], [.7, 0], [1, .5], [.7, 1], [0, 1], [.3, .5]], w, h), ins: [.3, 0, .3, 0] },
  plus: { n: 'Cross', f: (c, w, h) => poly(c, [[.33, 0], [.67, 0], [.67, .33], [1, .33], [1, .67], [.67, .67], [.67, 1], [.33, 1], [.33, .67], [0, .67], [0, .33], [.33, .33]], w, h), ins: [.33, .33, .33, .33] },
  cylinder: { n: 'Cylinder', f: (c, w, h) => { const e = Math.min(h * .2, w * .25); c.moveTo(0, e); c.ellipse(w / 2, e, w / 2, e, 0, Math.PI, Math.PI * 2); c.lineTo(w, h - e); c.ellipse(w / 2, h - e, w / 2, e, 0, 0, Math.PI); c.closePath(); c.moveTo(w, e); c.ellipse(w / 2, e, w / 2, e, 0, 0, Math.PI); }, ins: [.05, .25, .05, .2] },
  callout: { n: 'Speech bubble', f: (c, w, h, o) => { const bh = h * .8, r = Math.min(14, w / 4, bh / 3); c.moveTo(r, 0); c.lineTo(w - r, 0); c.arcTo(w, 0, w, r, r); c.lineTo(w, bh - r); c.arcTo(w, bh, w - r, bh, r); c.lineTo(w * .4, bh); c.lineTo(w * .15, h); c.lineTo(w * .2, bh); c.lineTo(r, bh); c.arcTo(0, bh, 0, bh - r, r); c.lineTo(0, r); c.arcTo(0, 0, r, 0, r); c.closePath(); }, ins: [.04, .04, .04, .24] },
  /* flowchart set */
  terminator: { n: 'Terminator', f: (c, w, h) => rr(c, 0, 0, w, h, h / 2), ins: [.1, 0, .1, 0] },
  process: { n: 'Process', f: (c, w, h) => c.rect(0, 0, w, h) },
  decision: { n: 'Decision', f: (c, w, h) => poly(c, [[.5, 0], [1, .5], [.5, 1], [0, .5]], w, h), ins: [.22, .22, .22, .22] },
  data: { n: 'Data (I/O)', f: (c, w, h) => poly(c, [[.18, 0], [1, 0], [.82, 1], [0, 1]], w, h), ins: [.15, 0, .15, 0] },
  predefined: { n: 'Predefined', f: (c, w, h) => { c.rect(0, 0, w, h); c.moveTo(w * .1, 0); c.lineTo(w * .1, h); c.moveTo(w * .9, 0); c.lineTo(w * .9, h); }, ins: [.12, 0, .12, 0] },
  document: { n: 'Document', f: (c, w, h) => { c.moveTo(0, 0); c.lineTo(w, 0); c.lineTo(w, h * .85); c.bezierCurveTo(w * .78, h * .72, w * .62, h * .72, w * .5, h * .86); c.bezierCurveTo(w * .38, h, w * .2, h, 0, h * .86); c.closePath(); }, ins: [0, 0, 0, .15] },
  manual: { n: 'Manual input', f: (c, w, h) => poly(c, [[0, .2], [1, 0], [1, 1], [0, 1]], w, h), ins: [0, .2, 0, 0] },
  delay: { n: 'Delay', f: (c, w, h) => { c.moveTo(0, 0); c.lineTo(w / 2, 0); c.ellipse(w / 2, h / 2, w / 2, h / 2, 0, -Math.PI / 2, Math.PI / 2); c.lineTo(0, h); c.closePath(); }, ins: [0, 0, .15, 0] },
  display: { n: 'Display', f: (c, w, h) => { c.moveTo(0, h / 2); c.lineTo(w * .15, 0); c.lineTo(w * .8, 0); c.bezierCurveTo(w * 1.04, h * .1, w * 1.04, h * .9, w * .8, h); c.lineTo(w * .15, h); c.closePath(); }, ins: [.15, 0, .15, 0] },
  connector: { n: 'Connector', f: (c, w, h) => { c.moveTo(w, h / 2); c.ellipse(w / 2, h / 2, w / 2, h / 2, 0, 0, Math.PI * 2); c.closePath(); }, ins: [.15, .15, .15, .15] },
  offpage: { n: 'Off-page', f: (c, w, h) => poly(c, [[0, 0], [1, 0], [1, .65], [.5, 1], [0, .65]], w, h), ins: [0, 0, 0, .25] },
  or: { n: 'Or', f: (c, w, h) => { c.moveTo(w, h / 2); c.ellipse(w / 2, h / 2, w / 2, h / 2, 0, 0, Math.PI * 2); c.closePath(); c.moveTo(w / 2, 0); c.lineTo(w / 2, h); c.moveTo(0, h / 2); c.lineTo(w, h / 2); }, ins: [.2, .2, .2, .2] }
};
const SHAPE_GROUPS = [
  ['Basic', ['rect', 'round', 'ellipse', 'triangle', 'rtriangle', 'diamond', 'parallelogram', 'trapezoid', 'pentagon', 'hexagon', 'octagon', 'star', 'star4', 'star6', 'heart', 'cloud', 'callout', 'cylinder', 'plus']],
  ['Arrows', ['arrowR', 'arrowL', 'arrowU', 'arrowD', 'arrowLR', 'chevron']],
  ['Flowchart', ['terminator', 'process', 'decision', 'data', 'predefined', 'document', 'manual', 'delay', 'display', 'connector', 'offpage', 'or']]
];
SHAPES.preview = (kind, w = 34, h = 26, color = 'currentColor') => {
  const cv = document.createElement('canvas'); cv.width = w * 2; cv.height = h * 2; cv.style.width = w + 'px'; cv.style.height = h + 'px';
  const c = cv.getContext('2d'); c.scale(2, 2); c.translate(3, 3); const s = SHAPES[kind];
  c.beginPath(); s.f(c, w - 6, h - 6, { r: 6 }); c.lineWidth = 1.6; c.lineJoin = 'round'; c.strokeStyle = color; c.stroke();
  cv.dataset.kind = kind; return cv;
};
const DASH = { solid: () => [], dashed: s => [s * 3 + 4, s * 2 + 3], dotted: s => [Math.max(1, s * .1), s * 2 + 3] };

/* ---------- arrow heads ---------- */
const Heads = {
  kinds: [['none', 'None'], ['arrow', 'Arrow'], ['triangle', 'Triangle'], ['open', 'Open'], ['dot', 'Dot'], ['diamond', 'Diamond'], ['bar', 'Bar']],
  size: sw => 9 + sw * 3.2,
  back(kind, sw) { const L = Heads.size(sw); return kind === 'arrow' ? L * .75 : kind === 'triangle' ? L * .95 : kind === 'dot' ? L * .6 : kind === 'diamond' ? L * .9 : 0; },
  draw(ctx, kind, x, y, ang, sw, color) {
    if (!kind || kind === 'none') return;
    const L = Heads.size(sw); ctx.save(); ctx.translate(x, y); ctx.rotate(ang); ctx.fillStyle = ctx.strokeStyle = color; ctx.lineWidth = sw; ctx.lineJoin = 'round'; ctx.lineCap = 'round'; ctx.setLineDash([]);
    ctx.beginPath();
    if (kind === 'arrow') { ctx.moveTo(0, 0); ctx.lineTo(-L, -L * .5); ctx.lineTo(-L * .75, 0); ctx.lineTo(-L, L * .5); ctx.closePath(); ctx.fill(); }
    else if (kind === 'triangle') { ctx.moveTo(0, 0); ctx.lineTo(-L, -L * .5); ctx.lineTo(-L, L * .5); ctx.closePath(); ctx.fill(); }
    else if (kind === 'open') { ctx.moveTo(-L * .9, -L * .5); ctx.lineTo(0, 0); ctx.lineTo(-L * .9, L * .5); ctx.stroke(); }
    else if (kind === 'dot') { ctx.arc(-L * .3, 0, L * .3, 0, 7); ctx.fill(); }
    else if (kind === 'diamond') { ctx.moveTo(0, 0); ctx.lineTo(-L * .45, -L * .3); ctx.lineTo(-L * .9, 0); ctx.lineTo(-L * .45, L * .3); ctx.closePath(); ctx.fill(); }
    else if (kind === 'bar') { ctx.moveTo(0, -L * .5); ctx.lineTo(0, L * .5); ctx.stroke(); }
    ctx.restore();
  }
};

/* ---------- shared inspector snippets ---------- */
const CTL = {
  text: (extra = {}) => [
    { sec: 'Text' },
    { k: 'fnt', t: 'select', l: 'Font', opts: [['sans', 'Sans'], ['serif', 'Serif'], ['mono', 'Mono'], ['hand', 'Handwriting'], ['display', 'Display']] },
    { k: 'fs', t: 'num', l: 'Size', min: 6, max: 400, ...(extra.fs || {}) },
    { t: 'row', items: [{ k: 'b', t: 'tbtn', ic: 'bold', title: 'Bold' }, { k: 'i', t: 'tbtn', ic: 'italic', title: 'Italic' }, { k: 'u', t: 'tbtn', ic: 'underline', title: 'Underline' }] },
    { k: 'al', t: 'seg', l: 'Align', opts: [['left', 'Left', 'alignLeftT'], ['center', 'Center', 'alignCenterT'], ['right', 'Right', 'alignRightT']] },
    ...(extra.noVa ? [] : [{ k: 'va', t: 'seg', l: 'Vertical', opts: [['top', 'Top', 'alignT'], ['middle', 'Middle', 'alignM'], ['bottom', 'Bottom', 'alignB']] }]),
    { k: 'tc', t: 'color', l: 'Text colour' }
  ]
};

/* ---------- shape ---------- */
T.def('shape', {
  def: () => ({ kind: 'rect', w: 160, h: 110, fill: '#ffffff', stroke: '#1f2430', sw: 2, dash: 'solid', r: 16, text: '', fs: 18, fnt: 'sans', b: false, i: false, u: false, al: 'center', va: 'middle', tc: '#1f2430' }),
  conn: true, flip: true, resize: 'free',
  path(ctx, o) { ctx.save(); if (o.fx) { ctx.translate(o.w, 0); ctx.scale(-1, 1); } if (o.fy) { ctx.translate(0, o.h); ctx.scale(1, -1); } ctx.beginPath(); (SHAPES[o.kind] || SHAPES.rect).f(ctx, o.w, o.h, o); ctx.restore(); },
  draw(ctx, o, env) {
    T.reg.shape.path(ctx, o);
    if (o.fill && o.fill !== 'none') { ctx.fillStyle = o.fill; ctx.fill(); }
    if (o.sw > 0 && o.stroke !== 'none') { ctx.strokeStyle = o.stroke; ctx.lineWidth = o.sw; ctx.lineJoin = 'round'; ctx.lineCap = 'round'; ctx.setLineDash(DASH[o.dash || 'solid'](o.sw)); ctx.stroke(); ctx.setLineDash([]); }
    if (o.text && !Ed.editing(o)) { const r = T.reg.shape.textRect(o); ctx.shadowColor = 'transparent'; Txt.draw(ctx, o, o.text, r.x, r.y, r.w, r.h); }
  },
  textRect(o) { const s = SHAPES[o.kind] || SHAPES.rect, i = s.ins || [0, 0, 0, 0], p = 6; return { x: o.w * i[0] + p, y: o.h * i[1] + p, w: Math.max(10, o.w * (1 - i[0] - i[2]) - 2 * p), h: Math.max(10, o.h * (1 - i[1] - i[3]) - 2 * p) }; },
  hit(o, lx, ly, tol) {
    const [x, y] = G.unflip(o, lx, ly); const c = U.hctx; c.save(); c.setTransform(1, 0, 0, 1, 0, 0); c.beginPath(); (SHAPES[o.kind] || SHAPES.rect).f(c, o.w, o.h, o);
    let r = c.isPointInPath(x, y);
    if (!r && (o.fill === 'none' || !o.fill)) r = false; // hollow shapes: border only (below)
    if (!r) { c.lineWidth = Math.max(o.sw, 1) + tol * 2 + 4; r = c.isPointInStroke(x, y); }
    else if (o.fill === 'none' || !o.fill) { c.lineWidth = Math.max(o.sw, 1) + tol * 2 + 6; r = c.isPointInStroke(x, y) || !!o.text; }
    c.restore(); return r;
  },
  edit(o) { const r = T.reg.shape.textRect(o); Ed.text(o, { x: r.x, y: r.y, w: r.w, h: r.h, key: 'text', fs: o.fs, al: o.al, va: o.va, color: o.tc }); },
  text: o => [o.text],
  ins: o => [
    { sec: 'Shape' },
    { k: 'kind', t: 'shapepick', l: 'Shape' },
    { k: 'fill', t: 'color', l: 'Fill', none: true, alpha: true },
    { k: 'stroke', t: 'color', l: 'Border', none: true },
    { k: 'sw', t: 'range', l: 'Border width', min: 0, max: 24, step: 1 },
    { k: 'dash', t: 'seg', l: 'Border style', opts: [['solid', 'Solid'], ['dashed', 'Dashed'], ['dotted', 'Dotted']] },
    { k: 'r', t: 'range', l: 'Corner radius', min: 0, max: 100, step: 1, show: o => o.kind === 'round' },
    ...CTL.text()
  ]
});

/* ---------- line / arrow ---------- */
const Lines = {
  ends(o) { const a = G.toWorld(o, o.fx ? o.w : 0, o.fy ? o.h : 0), b = G.toWorld(o, o.fx ? 0 : o.w, o.fy ? 0 : o.h); return [a, b]; },
  setEnds(o, a, b) {
    o.rot = 0; o.x = Math.min(a[0], b[0]); o.y = Math.min(a[1], b[1]); o.w = Math.abs(a[0] - b[0]); o.h = Math.abs(a[1] - b[1]);
    o.fx = a[0] > b[0]; o.fy = a[1] > b[1]; delete o._j;
  }
};
T.def('line', {
  def: () => ({ w: 200, h: 0, color: '#1f2430', sw: 3, dash: 'solid', hs: 'none', he: 'arrow', lbl: '' }),
  flip: true, resize: 'free', ends: true,
  pad: o => o.sw + 6,
  draw(ctx, o, env) {
    const x1 = o.fx ? o.w : 0, y1 = o.fy ? o.h : 0, x2 = o.fx ? 0 : o.w, y2 = o.fy ? 0 : o.h;
    const ang = Math.atan2(y2 - y1, x2 - x1), bs = Heads.back(o.hs, o.sw), be = Heads.back(o.he, o.sw);
    ctx.strokeStyle = o.color; ctx.lineWidth = o.sw; ctx.lineCap = 'round'; ctx.setLineDash(DASH[o.dash](o.sw));
    ctx.beginPath(); ctx.moveTo(x1 + Math.cos(ang) * bs, y1 + Math.sin(ang) * bs); ctx.lineTo(x2 - Math.cos(ang) * be, y2 - Math.sin(ang) * be); ctx.stroke(); ctx.setLineDash([]);
    Heads.draw(ctx, o.hs, x1, y1, ang + Math.PI, o.sw, o.color); Heads.draw(ctx, o.he, x2, y2, ang, o.sw, o.color);
    if (o.lbl && !Ed.editing(o)) {
      const mx = (x1 + x2) / 2, my = (y1 + y2) / 2; ctx.font = '14px ' + U.FONTS.sans; const tw = ctx.measureText(o.lbl).width + 12;
      ctx.fillStyle = D.bg; ctx.fillRect(mx - tw / 2, my - 11, tw, 22); ctx.fillStyle = o.color; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(o.lbl, mx, my);
    }
  },
  hit(o, lx, ly, tol) { const x1 = o.fx ? o.w : 0, y1 = o.fy ? o.h : 0, x2 = o.fx ? 0 : o.w, y2 = o.fy ? 0 : o.h; return U.distSeg(lx, ly, x1, y1, x2, y2) <= o.sw / 2 + 5 + tol; },
  edit(o) { Ed.text(o, { x: o.w / 2 - 70, y: o.h / 2 - 14, w: 140, h: 28, key: 'lbl', fs: 14, al: 'center', va: 'middle', color: o.color, single: true }); },
  text: o => [o.lbl],
  ins: o => [
    { sec: 'Line' },
    { k: 'color', t: 'color', l: 'Colour' },
    { k: 'sw', t: 'range', l: 'Width', min: 1, max: 24, step: 1 },
    { k: 'dash', t: 'seg', l: 'Style', opts: [['solid', 'Solid'], ['dashed', 'Dashed'], ['dotted', 'Dotted']] },
    { k: 'hs', t: 'select', l: 'Start', opts: Heads.kinds }, { k: 'he', t: 'select', l: 'End', opts: Heads.kinds },
    { k: 'lbl', t: 'text', l: 'Label' }
  ]
});

/* ---------- text ---------- */
T.def('text', {
  def: () => ({ w: 260, h: 40, text: '', fs: 28, fnt: 'sans', b: false, i: false, u: false, al: 'left', va: 'top', tc: '#1f2430', bgc: 'none' }),
  conn: true, resize: 'w', ratioFs: true,
  fit(o) { o.h = Math.max(o.fs * Txt.LH + 8, Txt.height(o, o.text, o.w - 12, o.fs) + 8); },
  draw(ctx, o) {
    if (o.bgc && o.bgc !== 'none') { ctx.fillStyle = o.bgc; ctx.fillRect(0, 0, o.w, o.h); }
    if (!Ed.editing(o)) Txt.draw(ctx, o, o.text, 6, 4, o.w - 12, o.h - 8, { va: 'top' });
    else if (!o.text) { }
    if (!o.text && !Ed.editing(o) && !(arguments[2] && arguments[2].exporting)) { ctx.fillStyle = 'rgba(120,130,150,.6)'; ctx.font = Txt.font(o, o.fs); ctx.textBaseline = 'top'; ctx.textAlign = 'left'; ctx.fillText('Type here', 6, 4 + (o.fs * Txt.LH - o.fs) / 2); }
  },
  edit(o) { Ed.text(o, { x: 6, y: 4, w: o.w - 12, h: o.h - 8, key: 'text', fs: o.fs, al: o.al, va: 'top', color: o.tc, grow: true }); },
  text: o => [o.text],
  ins: o => [{ sec: 'Appearance' }, { k: 'bgc', t: 'color', l: 'Background', none: true, alpha: true }, ...CTL.text({ noVa: true })]
});

/* ---------- sticky note ---------- */
T.def('sticky', {
  def: () => ({ w: 200, h: 200, color: '#fff176', text: '', fs: 0, fnt: 'hand', b: false, i: false, u: false, al: 'center', va: 'middle', tc: '#1f2430', round: false, author: '' }),
  conn: true, resize: 'free',
  autoFs(o) {
    if (o.fs > 0) return o.fs;
    const key = o.text + '|' + o.w + '|' + o.h + '|' + o.fnt + o.b; if (o._fk === key) return o._fs;
    const w = o.w - 28, h = o.h - 28; let fs = 11;
    for (let f = 44; f >= 11; f -= 1) { if (Txt.height(o, o.text, w, f) <= h) { fs = f; break; } }
    o._fk = key; o._fs = fs; return fs;
  },
  draw(ctx, o, env) {
    ctx.save(); ctx.shadowColor = 'rgba(0,0,0,.22)'; ctx.shadowBlur = 10 * env.k; ctx.shadowOffsetY = 3 * env.k;
    ctx.fillStyle = o.color; ctx.beginPath(); if (o.round) ctx.ellipse(o.w / 2, o.h / 2, o.w / 2, o.h / 2, 0, 0, 7); else ctx.rect(0, 0, o.w, o.h); ctx.fill(); ctx.restore();
    if (!o.round) { const g = ctx.createLinearGradient(0, 0, 0, o.h); g.addColorStop(0, 'rgba(255,255,255,.18)'); g.addColorStop(1, 'rgba(0,0,0,.05)'); ctx.fillStyle = g; ctx.fillRect(0, 0, o.w, o.h); }
    if (!Ed.editing(o)) Txt.draw(ctx, o, o.text, 14, 14, o.w - 28, o.h - 28, { fs: T.reg.sticky.autoFs(o) });
    if (o.author && !env.exporting) { ctx.font = '600 11px ' + U.FONTS.sans; ctx.fillStyle = 'rgba(0,0,0,.45)'; ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic'; ctx.fillText(o.author, 10, o.h - 7); }
  },
  hit: (o, lx, ly, tol) => o.round ? Math.hypot((lx - o.w / 2) / (o.w / 2), (ly - o.h / 2) / (o.h / 2)) <= 1 : (lx >= -tol && ly >= -tol && lx <= o.w + tol && ly <= o.h + tol),
  edit(o) { Ed.text(o, { x: 14, y: 14, w: o.w - 28, h: o.h - 28, key: 'text', fs: T.reg.sticky.autoFs(o) || 20, al: o.al, va: o.va, color: o.tc, auto: true }); },
  text: o => [o.text],
  ins: o => [{ sec: 'Sticky note' }, { k: 'color', t: 'color', l: 'Colour', palette: U.STICKY }, { k: 'round', t: 'toggle', l: 'Round' }, { k: 'fs', t: 'num', l: 'Font size (0 = auto)', min: 0, max: 200 },
  ...CTL.text({ fs: { min: 0 } }).slice(2)]
});

/* ---------- frame (work area / page) ---------- */
T.def('frame', {
  def: () => ({ w: 1122, h: 794, name: 'Frame', bg: '#ffffff', stroke: '#c9ced8', ori: 'landscape', tpl: 'blank', tplc: '#aebbd8', tsp: 32 }),
  resize: 'free', conn: true,
  draw(ctx, o, env) {
    ctx.save(); if (!env.exporting) { ctx.shadowColor = 'rgba(20,30,60,.18)'; ctx.shadowBlur = 16 * env.k; ctx.shadowOffsetY = 3 * env.k; }
    ctx.fillStyle = o.bg; ctx.fillRect(0, 0, o.w, o.h); ctx.restore();
    if (o.tpl && o.tpl !== 'blank') Paper.draw(ctx, o, env);
    if (!env.exporting) {
      ctx.strokeStyle = o.stroke; ctx.lineWidth = 1 / env.z; ctx.strokeRect(0, 0, o.w, o.h);
      const s = 1 / env.z; ctx.font = `600 ${13 * s}px ${U.FONTS.sans}`; ctx.fillStyle = U.isDark(D.bg) ? '#cfd5e3' : '#5b6475'; ctx.textBaseline = 'bottom'; ctx.textAlign = 'left';
      if (!Ed.editing(o)) ctx.fillText(o.name, 0, -6 * s);
    }
  },
  hit(o, lx, ly, tol) {
    const z = D.view.z, b = 10 / z + tol;
    if (lx >= -b && lx <= o.w + b && ly >= -b && ly <= o.h + b && (lx < b || lx > o.w - b || ly < b || ly > o.h - b)) return true;
    ctxFont(); const tw = U.measure(o.name, `600 ${13 / z}px ${U.FONTS.sans}`);
    return lx >= -2 && lx <= tw + 8 / z && ly >= -28 / z && ly <= 0;
    function ctxFont() { }
  },
  bounds: o => { const z = D.view.z; const x = o.x, y = o.y - 24 / z; const c = o.rot ? G.corners(o) : null; return { x: o.x, y: o.y - 24 / z, w: o.w, h: o.h + 24 / z }; },
  edit(o) { const z = D.view.z; Ed.text(o, { x: 0, y: -26 / z, w: Math.max(160, o.w * .5), h: 22 / z, key: 'name', fs: 13 / z, al: 'left', va: 'middle', color: '#333', single: true }); },
  text: o => [o.name],
  ins: o => [
    { sec: 'Frame' }, { k: 'name', t: 'text', l: 'Name' }, { k: 'bg', t: 'color', l: 'Background', none: false },
    { t: 'btns', items: [{ l: 'Swap orientation', ic: 'orient', fn: o => Act.orientFrame(o) }] },
    { t: 'btns', items: [{ l: 'Fit to content', ic: 'expand', fn: o => Act.fitFrame(o) }, { l: 'Export frame', ic: 'download', fn: o => IO.exportDialog({ frame: o }) }] },
    { sec: 'Paper' }, { k: 'tpl', t: 'select', l: 'Template', opts: [['blank', 'Blank'], ['lined', 'Lined'], ['grid', 'Grid'], ['dots', 'Dotted'], ['cornell', 'Cornell notes'], ['music', 'Music staff'], ['isometric', 'Isometric']] },
    { k: 'tsp', t: 'range', l: 'Line spacing', min: 14, max: 80, step: 2, show: o => o.tpl !== 'blank' }, { k: 'tplc', t: 'color', l: 'Line colour', show: o => o.tpl !== 'blank' },
    { t: 'frameSizes' }
  ]
});
const Paper = {
  draw(ctx, o, env) {
    const w = o.w, h = o.h, sp = o.tsp || 32, z = env.z; ctx.save(); ctx.beginPath(); ctx.rect(0, 0, w, h); ctx.clip(); ctx.strokeStyle = o.tplc; ctx.fillStyle = o.tplc; ctx.lineWidth = Math.max(1 / z, 1);
    const L = (x1, y1, x2, y2) => { ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); };
    ctx.beginPath();
    switch (o.tpl) {
      case 'lined': for (let y = sp * 1.6; y < h; y += sp) L(0, y, w, y); break;
      case 'grid': for (let x = sp; x < w; x += sp) L(x, 0, x, h); for (let y = sp; y < h; y += sp) L(0, y, w, y); break;
      case 'dots': ctx.stroke(); ctx.beginPath(); for (let x = sp; x < w; x += sp) for (let y = sp; y < h; y += sp) { ctx.moveTo(x + 1.6, y); ctx.arc(x, y, 1.6, 0, 7); } ctx.fill(); ctx.restore(); return;
      case 'cornell': { const cx = w * .28, top = h * .12, bot = h * .82; for (let y = top + sp; y < bot; y += sp) L(cx, y, w, y); ctx.stroke(); ctx.beginPath(); ctx.lineWidth = 2 / z; L(cx, top, cx, bot); L(0, top, w, top); L(0, bot, w, bot); break; }
      case 'music': for (let y = sp * 2; y < h - sp * 2; y += sp * 3.2) for (let k = 0; k < 5; k++) L(sp, y + k * sp * .32, w - sp, y + k * sp * .32); break;
      case 'isometric': { const dx = sp * .866 * 1.2; for (let x = 0; x < w; x += dx) L(x, 0, x, h); const t = Math.tan(Math.PI / 6); for (let c = -h / t; c < w + h / t; c += dx * 2) { L(c, 0, c + h / t, h); L(c + h / t, 0, c, h); } break; }
    }
    ctx.stroke(); ctx.restore();
  }
};
