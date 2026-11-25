'use strict';
/* ===== Keyboard shortcuts ===== */
const Keys = {
  list: [
    ['Tools', [['V', 'Select'], ['H', 'Hand (or hold Space)'], ['P', 'Pen'], ['E', 'Eraser'], ['S', 'Shapes'], ['L', 'Line / connector'], ['K', 'Connector tool'], ['T', 'Text'], ['N', 'Sticky note'], ['F', 'Frame'], ['G', 'Fill'], ['R', 'Ruler'], ['Z', 'Laser pointer'], ['C', 'Comment'], ['M', 'Box select'], ['Q', 'Lasso select'], ['X', 'Cut-out']]],
    ['Edit', [['Ctrl+Z', 'Undo'], ['Ctrl+Shift+Z / Ctrl+Y', 'Redo'], ['Ctrl+C / X / V', 'Copy / cut / paste'], ['Ctrl+D', 'Duplicate'], ['Del / Backspace', 'Delete'], ['Ctrl+A', 'Select all'], ['Ctrl+Shift+A', 'Invert selection'], ['Esc', 'Deselect / cancel'], ['Arrows', 'Nudge (Shift = 10×)'], ['Enter / F2', 'Edit text']]],
    ['Arrange', [['Ctrl+G', 'Group'], ['Ctrl+Shift+G', 'Ungroup'], ['Ctrl+L', 'Lock / unlock'], ['Ctrl+]  /  Ctrl+[', 'Forward / backward'], ['Ctrl+Shift+]  /  [', 'To front / back'], ['Shift+H / Shift+V', 'Flip horizontal / vertical'], ['Ctrl+K', 'Add link'], ['Alt+drag', 'Duplicate while moving'], ['Shift+drag', 'Constrain / keep ratio'], ['Ctrl+drag', 'Disable snapping']]],
    ['View', [['+ / -', 'Zoom in / out'], ['Ctrl+0', 'Zoom 100%'], ['Shift+1', 'Fit all'], ['Shift+2', 'Zoom to selection'], ['Space+drag', 'Pan'], ['Ctrl+wheel', 'Zoom'], ["Ctrl+'", 'Toggle grid'], ['Ctrl+;', 'Toggle snap to grid'], ['Shift+M', 'Toggle mini-map'], ['Shift+D', 'Toggle dimensions']]],
    ['Board', [['Ctrl+F', 'Find'], ['Ctrl+H', 'History'], ['Ctrl+S', 'Save version'], ['Ctrl+Shift+E', 'Export'], ['Ctrl+,', 'Settings'], ['Alt+R', 'Record canvas'], ['?', 'This help']]]
  ],
  init() {
    window.addEventListener('keydown', Keys.down, true); window.addEventListener('keyup', e => { if (e.code === 'Space') { Tools.spaceDown = false; Tools.cursor(); } });
  },
  typing(e) { const t = e.target; return t && (/^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName) || t.isContentEditable); },
  down(e) {
    if (!D.id) return; if (Keys.typing(e) || Ed.cur) return; if (UI.modals.length) return;
    const k = e.key, K = k.length === 1 ? k.toLowerCase() : k, ctrl = e.ctrlKey || e.metaKey, sh = e.shiftKey, alt = e.altKey; let used = true;
    if (e.code === 'Space' && !ctrl) { if (!Tools.spaceDown) { Tools.spaceDown = true; Tools.cursor(); } e.preventDefault(); return; }
    if (ctrl) {
      switch (K) {
        case 'z': sh ? D.redo() : D.undo(); break; case 'y': D.redo(); break;
        case 'c': return; case 'x': return; case 'v': return; // handled via clipboard events
        case 'd': Act.duplicate(); break; case 'a': sh ? Act.invert() : Act.selectAll(); break; case 'g': sh ? Act.ungroup() : Act.group(); break; case 'l': Act.lock(); break;
        case 'k': Act.setLink(); break; case ']': Act.order(sh ? 'front' : 'fwd'); break; case '[': Act.order(sh ? 'back' : 'bwd'); break; case '}': Act.order('front'); break; case '{': Act.order('back'); break;
        case 'f': Panels.show('find'); break; case 'h': Panels.toggle('history'); break; case 'e': if (sh) IO.exportDialog(); else used = false; break;
        case 's': D.saveVersion('Version ' + new Date().toLocaleTimeString()).then(() => UI.toast('Version saved')); break;
        case ',': App.settings(); break; case '0': R.setZoom(1); break; case '=': case '+': R.setZoom(D.view.z * 1.25); break; case '-': R.setZoom(D.view.z / 1.25); break;
        case "'": D.grid.type = D.grid.type === 'none' ? 'dots' : 'none'; D.commit('Grid', []); R.req(); break; case ';': ST.set('snapGrid', !ST.v.snapGrid); UI.toast('Snap to grid ' + (ST.v.snapGrid ? 'on' : 'off')); break;
        default: used = false;
      }
      if (used) e.preventDefault(); return;
    }
    if (typeof Study !== 'undefined' && Study && Study.on && !sh && (e.key === 'PageDown' || e.key === 'PageUp') && Study.key(K, e)) { e.preventDefault(); return; }
    if (alt && K === 'r') { Rec.panel(U.$('#recbtn')); e.preventDefault(); return; }
    if (alt) return;
    if (typeof Study !== 'undefined' && Study && Study.on && Study.key(K, e)) { e.preventDefault(); return; }
    const tool = { v: 'select', h: 'hand', p: 'pen', e: 'eraser', t: 'text', n: 'sticky', f: 'frame', g: 'fill', z: 'laser', c: 'comment', m: 'marquee', q: 'lasso', x: 'cutout', k: 'connector' }[K];
    if (sh && K === 'h') { Act.flip('h'); e.preventDefault(); return; } if (sh && K === 'v') { Act.flip('v'); e.preventDefault(); return; }
    if (sh && K === 'm') { ST.set('minimap', !ST.v.minimap); R.reqOv(); return; } if (sh && K === 'd') { ST.set('dims', !ST.v.dims); R.reqOv(); return; }
    if (sh && (k === '!' || K === '1')) { R.fitAll(); return; } if (sh && (k === '@' || K === '2')) { R.fitSel(); return; }
    if (k === '?') { App.shortcuts(); return; }
    if (!sh && tool) { Tools.set(tool); e.preventDefault(); return; }
    if (K === 's' && !sh) { Tools.opts.shape.mode = 'shape'; Tools.set('shape'); return; } if (K === 'l' && !sh) { Tools.opts.shape.mode = 'line'; Tools.set('shape'); return; } if (K === 'r' && !sh) { Ruler.toggle(); TB.sync(); return; }
    switch (k) {
      case 'Delete': case 'Backspace': if (Sel.ids.length) { Act.del(); } else used = false; break;
      case 'Escape': if (Rec.on) { used = false; break; } if (Tools.tool !== 'select' && Tools.tool !== 'hand') Tools.set('select'); else if (Sel.ids.length) Sel.clear(); else if (Panels.tab) Panels.hide(); break;
      case 'Enter': case 'F2': { const o = Sel.one(); if (o) { const t = T.get(o.type); (t.edit || (() => { }))(o); } else used = false; break; }
      case 'Tab': { const o = Sel.one(); if (o && T.get(o.type).key) { used = T.get(o.type).key(o, e) !== false; } else used = false; break; }
      case 'ArrowLeft': case 'ArrowRight': case 'ArrowUp': case 'ArrowDown': { if (!Sel.ids.length) { used = false; break; } const o = Sel.one(); if (o && T.get(o.type).key && T.get(o.type).key(o, e) === true) break; const st = sh ? 10 : 1; Act.nudge(k === 'ArrowLeft' ? -st : k === 'ArrowRight' ? st : 0, k === 'ArrowUp' ? -st : k === 'ArrowDown' ? st : 0); break; }
      case '+': case '=': R.setZoom(D.view.z * 1.25); break; case '-': case '_': R.setZoom(D.view.z / 1.25); break;
      case 'PageUp': R.pan(0, R.H * .7); break; case 'PageDown': R.pan(0, -R.H * .7); break;
      default: { const o = Sel.one(); if (o && T.get(o.type).key && k.length === 1 && T.get(o.type).key(o, e) !== false) break; used = false; }
    }
    if (used) e.preventDefault();
  }
};
