/* Interpretability section ("Read every latent.").
   #case-explorer   the six Figure 7 cases: question with evidence spans, the decoded latent chain, the answer.
   #latent-geometry Table 4(b) as two horizontal bar charts (pairwise latent distance, distance to vocabulary center).
   Everything shown is read from window.SIMCOT_DATA. If a mount or its data is missing, the mount stays empty. */
(function () {
  'use strict';

  var SVGNS = 'http://www.w3.org/2000/svg';
  var uid = 0;

  function nextId(prefix) { uid += 1; return prefix + uid; }
  function el(tag, cls, text) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = text;
    return n;
  }
  function sv(tag, attrs, text) {
    var n = document.createElementNS(SVGNS, tag);
    if (attrs) {
      for (var a in attrs) {
        if (Object.prototype.hasOwnProperty.call(attrs, a)) n.setAttribute(a, String(attrs[a]));
      }
    }
    if (text != null) n.textContent = text;
    return n;
  }
  function each(list, fn) { for (var i = 0; i < list.length; i++) fn(list[i], i); }
  function isNum(v) { return typeof v === 'number' && isFinite(v); }
  function str(v) { return v == null ? '' : String(v); }

  /* ---------- colour: tints and accents derived from the paper's step colours ----------
     Tints share one OKLCH lightness so no step looks heavier than another, and text on them stays ink.
     The accent (underline, box edge) is the paper colour itself when it reaches 3:1 on its tint;
     otherwise (step 4, a light violet) it is darkened along its own hue, with a chroma floor so it stays violet. */
  var WHITE = [255, 255, 255];
  function parseHex(h) {
    var m = /^#([0-9a-f]{6})$/i.exec(str(h).trim());
    if (!m) return null;
    var n = parseInt(m[1], 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  }
  function toHex(c) {
    var s = '#';
    for (var i = 0; i < 3; i++) {
      var v = Math.max(0, Math.min(255, Math.round(c[i])));
      s += (v < 16 ? '0' : '') + v.toString(16);
    }
    return s;
  }
  function lin(v) { v /= 255; return v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); }
  function enc(v) { return 255 * (v <= 0.0031308 ? 12.92 * v : 1.055 * Math.pow(v, 1 / 2.4) - 0.055); }
  function luminance(c) { return 0.2126 * lin(c[0]) + 0.7152 * lin(c[1]) + 0.0722 * lin(c[2]); }
  function contrast(a, b) {
    var x = luminance(a), y = luminance(b);
    return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
  }
  function mix(a, b, t) { return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t]; }
  function toOklab(c) {
    var r = lin(c[0]), g = lin(c[1]), b = lin(c[2]);
    var l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
    var m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
    var s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
    return [
      0.2104542553 * l + 0.7936177850 * m - 0.0040720468 * s,
      1.9779984951 * l - 2.4285922050 * m + 0.4505937099 * s,
      0.0259040371 * l + 0.7827717662 * m - 0.8086757660 * s
    ];
  }
  // OKLCH -> sRGB; chroma is reduced until the colour fits the sRGB gamut.
  function oklch(L, C, H) {
    for (var k = 0; k < 200; k++) {
      var a = C * Math.cos(H), b = C * Math.sin(H);
      var l = Math.pow(L + 0.3963377774 * a + 0.2158037573 * b, 3);
      var m = Math.pow(L - 0.1055613458 * a - 0.0638541728 * b, 3);
      var s = Math.pow(L - 0.0894841775 * a - 1.2914855480 * b, 3);
      var rgb = [
        4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
        -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
        -0.0041960863 * l - 0.7034186147 * m + 1.7076147010 * s
      ];
      var ok = rgb[0] >= -1e-4 && rgb[0] <= 1.0001 && rgb[1] >= -1e-4 && rgb[1] <= 1.0001 && rgb[2] >= -1e-4 && rgb[2] <= 1.0001;
      if (ok || C < 0.002) {
        return [enc(Math.max(0, Math.min(1, rgb[0]))), enc(Math.max(0, Math.min(1, rgb[1]))), enc(Math.max(0, Math.min(1, rgb[2])))];
      }
      C *= 0.97;
    }
    return WHITE;
  }
  function stepPalette(hex) {
    var base = parseHex(hex);
    if (!base) return null;
    var lab = toOklab(base);
    var C0 = Math.sqrt(lab[1] * lab[1] + lab[2] * lab[2]);
    var H = Math.atan2(lab[2], lab[1]);
    var tint = oklch(0.945, Math.min(C0, 0.03), H);
    var hl = oklch(0.885, Math.min(C0, 0.06), H);
    var wash = oklch(0.977, Math.min(C0, 0.014), H);
    var accent = base;
    if (contrast(base, tint) < 3) {
      var C = Math.max(C0, 0.13);
      for (var L = lab[0]; L > 0.2; L -= 0.0025) {
        accent = oklch(L, C, H);
        if (contrast(accent, tint) >= 3) break;
      }
    }
    return { accent: toHex(accent), soft: toHex(mix(accent, WHITE, 0.6)), tint: toHex(tint), hl: toHex(hl), wash: toHex(wash) };
  }

  /* ---------- (1) Figure 7 case explorer ---------- */
  function stepOf(v) { return (typeof v === 'number' && v > 0 && Math.floor(v) === v) ? v : null; }
  function questionOf(c) {
    var s = '';
    each(c.segments, function (g) { if (g) s += str(g.text); });
    return s;
  }
  // Tab name = the word of the question that the case id names ("dvds" -> "DVDs", as printed).
  function shortName(c, i, question) {
    var id = str(c.id).trim();
    if (id) {
      var re = new RegExp('\\b' + id.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\w*', 'i');
      var m = re.exec(question);
      if (m) return m[0].charAt(0).toUpperCase() + m[0].slice(1);
    }
    return 'Case ' + (i + 1);
  }
  // "### Answer: 260" -> { word: "Answer", value: "260" }; the value shown is always case.answer.
  function answerOf(c) {
    var label = str(c.answer_label).replace(/^[#\s]+/, '');
    var m = /^([^:]+?)\s*:\s*(.*)$/.exec(label);
    var value = c.answer != null ? str(c.answer).trim() : (m ? m[2].trim() : '');
    return { word: m ? m[1] : 'Answer', value: value };
  }
  function linkArrow() {
    var a = el('span', 'cx-link');
    a.setAttribute('aria-hidden', 'true');
    return a;
  }
  function checkIcon() {
    var s = sv('svg', { class: 'cx-check', viewBox: '0 0 16 16', 'aria-hidden': 'true', focusable: 'false' });
    s.appendChild(sv('path', { d: 'M3.2 8.4 6.5 11.6 12.8 4.6', fill: 'none', stroke: 'currentColor', 'stroke-width': 2, 'stroke-linecap': 'round', 'stroke-linejoin': 'round' }));
    return s;
  }

  function buildCases(mount, data) {
    var cases = (Array.isArray(data.cases) ? data.cases : []).filter(function (c) {
      return c && c.figure === 'Figure 7' && Array.isArray(c.segments) && Array.isArray(c.latents) && c.latents.length > 0;
    });
    if (!cases.length) return null;

    var colours = data.stepColors && typeof data.stepColors === 'object' ? data.stepColors : {};
    var palettes = {};
    function paint(node, k) {
      if (!Object.prototype.hasOwnProperty.call(palettes, k)) palettes[k] = stepPalette(colours[k]);
      var p = palettes[k];
      if (!p) return;
      node.style.setProperty('--cx-c', p.accent);
      node.style.setProperty('--cx-c-soft', p.soft);
      node.style.setProperty('--cx-tint', p.tint);
      node.style.setProperty('--cx-hl', p.hl);
      node.style.setProperty('--cx-wash', p.wash);
    }

    var root = el('div', 'cx');
    var controls = el('div', 'controls cx-controls');
    var seg = el('div', 'seg cx-seg');
    seg.setAttribute('role', 'tablist');
    seg.setAttribute('aria-label', 'Case');
    controls.appendChild(seg);
    var card = el('div', 'card cx-card');
    var stack = el('div', 'cx-panels');
    card.appendChild(stack);
    root.appendChild(controls);
    root.appendChild(card);

    var lastPointer = 'mouse';
    var tabs = [];
    var panels = [];

    function buildPanel(c, pid, tid) {
      var node = el('div', 'cx-panel');
      node.id = pid;
      node.setAttribute('role', 'tabpanel');
      node.setAttribute('aria-labelledby', tid);
      var state = { hover: null, focus: null, touch: null };
      var evs = [];
      var boxes = [];

      var q = el('p', 'cx-q');
      each(c.segments, function (g, j) {
        var text = g ? str(g.text) : '';
        if (!text) return;
        var k = stepOf(g.step);
        if (k == null) { q.appendChild(document.createTextNode(text)); return; }
        var span = el('span', 'cx-ev', text);
        span.id = pid + '-e' + j;
        span.setAttribute('data-step', String(k));
        paint(span, k);
        evs.push({ node: span, step: k });
        q.appendChild(span);
      });

      var chain = el('div', 'cx-chain');
      var list = el('ol', 'cx-latents');
      each(c.latents, function (lt, j) {
        if (!lt) return;
        var k = stepOf(lt.step);
        var item = el('li', 'cx-item');
        if (list.children.length) item.appendChild(linkArrow());
        var box = el('div', 'cx-box');
        box.tabIndex = 0;
        if (lt.label != null && str(lt.label) !== '') box.appendChild(el('span', 'cx-label', str(lt.label)));
        box.appendChild(el('code', 'cx-expr', str(lt.expr)));
        if (k != null) {
          box.setAttribute('data-step', String(k));
          paint(box, k);
          var ids = evs.filter(function (e) { return e.step === k; }).map(function (e) { return e.node.id; });
          if (ids.length) box.setAttribute('aria-describedby', ids.join(' '));
        }
        boxes.push({ node: box, step: k });
        item.appendChild(box);
        list.appendChild(item);
      });
      chain.appendChild(list);

      var ans = answerOf(c);
      if (ans.value) {
        var result = el('div', 'cx-result');
        result.appendChild(linkArrow());
        var chip = el('p', 'cx-answer');
        var words = el('span', 'cx-answer-text', ans.word + ' ');
        words.appendChild(el('b', null, ans.value));
        chip.appendChild(checkIcon());
        chip.appendChild(words);
        result.appendChild(chip);
        chain.appendChild(result);
      }
      node.appendChild(q);
      node.appendChild(chain);

      function refresh() {
        var k = state.hover != null ? state.hover : (state.focus != null ? state.focus : state.touch);
        node.classList.toggle('has-active', k != null);
        var mark = function (item) {
          item.node.classList.toggle('is-on', k != null && item.step === k);
          item.node.classList.toggle('is-off', k != null && item.step !== k);
        };
        each(evs, mark);
        each(boxes, mark);
      }
      function bind(target, k) {
        target.addEventListener('pointerenter', function (e) {
          if (e.pointerType === 'touch') return;
          state.hover = k;
          refresh();
        });
        target.addEventListener('pointerleave', function (e) {
          if (e.pointerType === 'touch') return;
          if (state.hover === k) state.hover = null;
          refresh();
        });
        target.addEventListener('click', function () {
          if (lastPointer !== 'touch') return;
          state.touch = state.touch === k ? null : k;
          refresh();
        });
      }
      each(evs, function (e) { bind(e.node, e.step); });
      each(boxes, function (b) {
        if (b.step == null) return;
        bind(b.node, b.step);
        b.node.addEventListener('focus', function () { state.focus = b.step; refresh(); });
        b.node.addEventListener('blur', function () { if (state.focus === b.step) state.focus = null; refresh(); });
      });

      return {
        node: node,
        clearTouch: function () { if (state.touch != null) { state.touch = null; refresh(); } },
        reset: function () { state.hover = null; state.focus = null; state.touch = null; refresh(); }
      };
    }

    each(cases, function (c, i) {
      var base = nextId('cx');
      var tid = base + '-tab';
      var pid = base + '-panel';
      var tab = el('button', null, shortName(c, i, questionOf(c)));
      tab.type = 'button';
      tab.id = tid;
      tab.setAttribute('role', 'tab');
      tab.setAttribute('aria-controls', pid);
      tab.setAttribute('aria-selected', 'false');
      tab.tabIndex = -1;
      seg.appendChild(tab);
      tabs.push(tab);
      var panel = buildPanel(c, pid, tid);
      stack.appendChild(panel.node);
      panels.push(panel);
    });

    var current = -1;
    function select(i, focus) {
      if (i !== current) {
        each(tabs, function (t, j) {
          var on = j === i;
          t.setAttribute('aria-selected', on ? 'true' : 'false');
          t.tabIndex = on ? 0 : -1;
        });
        each(panels, function (p, j) {
          var on = j === i;
          p.node.classList.toggle('is-active', on);
          p.node.hidden = !on;
          p.reset();
        });
        current = i;
      }
      if (focus) tabs[i].focus();
    }
    each(tabs, function (t, i) {
      t.addEventListener('click', function () { select(i, false); });
      t.addEventListener('keydown', function (e) {
        var j = null;
        if (e.key === 'ArrowRight' || e.key === 'ArrowDown') j = (i + 1) % tabs.length;
        else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') j = (i - 1 + tabs.length) % tabs.length;
        else if (e.key === 'Home') j = 0;
        else if (e.key === 'End') j = tabs.length - 1;
        if (j !== null) { e.preventDefault(); select(j, true); }
      });
    });

    root.addEventListener('pointerdown', function (e) { lastPointer = e.pointerType || 'mouse'; }, true);
    document.addEventListener('pointerdown', function (e) {
      if (!root.contains(e.target)) each(panels, function (p) { p.clearTouch(); });
    });

    select(0, false);
    return root;
  }

  /* ---------- (2) Table 4(b): latent geometry ---------- */
  var METRICS = [
    { key: 'dist', title: 'Pairwise latent distance' },
    { key: 'dist_to_vc', title: 'Distance to vocabulary center' }
  ];
  var BAND = 30, BAND_ABOVE = 40, BAR = 16, TOP = 2, AXIS = 24, RADIUS = 4;

  function plural(n) { return n + (n === '1' ? ' latent' : ' latents'); }
  // "2 latent" -> "2 latents", "Fail 5 latent" -> "Failed, 5 latents", anything else as printed.
  function settingName(s) {
    s = str(s).trim();
    var m = /^(\d+)\s+latents?$/i.exec(s);
    if (m) return plural(m[1]);
    m = /^fail(?:ed)?\s+(\d+)\s+latents?$/i.exec(s);
    if (m) return 'Failed, ' + plural(m[1]);
    return s;
  }
  function settingKind(s) {
    s = str(s);
    if (/sim-?cot/i.test(s)) return 'simcot';
    if (/^\s*fail/i.test(s)) return 'fail';
    return 'other';
  }
  function fmt(v) { return v.toFixed(2); }
  function niceStep(max, count) {
    var raw = max / count;
    var p = Math.pow(10, Math.floor(Math.log(raw) / Math.LN10));
    var f = raw / p;
    return (f <= 1 ? 1 : f <= 2 ? 2 : f <= 2.5 ? 2.5 : f <= 5 ? 5 : 10) * p;
  }
  function ticksFor(max, plotW) {
    if (!(max > 0)) return [0, 1];
    var step = niceStep(max, plotW < 170 ? 2 : plotW < 280 ? 3 : 4);
    var top = Math.ceil(max / step - 1e-9) * step;
    var out = [];
    for (var i = 0; i * step <= top + step * 1e-6; i++) out.push(Math.round(i * step * 1e6) / 1e6);
    return out;
  }
  function barPath(x, y, w, h, r) {
    w = Math.max(0, w);
    r = Math.min(r, w, h / 2);
    return 'M' + x + ',' + y + 'H' + (x + w - r) +
      'A' + r + ',' + r + ' 0 0 1 ' + (x + w) + ',' + (y + r) +
      'V' + (y + h - r) +
      'A' + r + ',' + r + ' 0 0 1 ' + (x + w - r) + ',' + (y + h) +
      'H' + x + 'Z';
  }
  function textLen(node, fallback) {
    var w = 0;
    try { w = node.getComputedTextLength(); } catch (e) { w = 0; }
    return w > 0 ? w : fallback;
  }

  function buildGeometry(mount, data) {
    var src = data.latentDistance;
    var rows = src && Array.isArray(src.rows) ? src.rows.filter(function (r) { return r && str(r.setting).trim() !== ''; }) : [];
    var metrics = METRICS.filter(function (m) {
      return rows.length > 0 && rows.every(function (r) { return isNum(r[m.key]) && r[m.key] >= 0; });
    });
    if (!rows.length || !metrics.length) return null;
    var items = rows.map(function (r) { return { name: settingName(r.setting), kind: settingKind(r.setting), row: r }; });

    var root = el('div', 'lg');
    var card = el('div', 'card lg-card');
    root.appendChild(card);
    var charts = [];
    function linkRows(i) { each(charts, function (ch) { ch.mark(i); }); }

    each(metrics, function (m) {
      var ch = makeChart(m, items, linkRows);
      charts.push(ch);
      card.appendChild(ch.node);
    });

    function renderAll(force) { each(charts, function (ch) { ch.render(force); }); }
    root._render = renderAll;
    return root;
  }

  function makeChart(metric, items, linkRows) {
    var n = items.length;
    var fig = el('figure', 'lg-chart');
    var tid = nextId('lg-title');
    var title = el('figcaption', 'lg-title', metric.title);
    title.id = tid;
    var viz = el('div', 'viz lg-viz');
    viz.style.height = (TOP + n * BAND + AXIS) + 'px'; // final height is set by render()
    var svg = sv('svg', { class: 'lg-svg', role: 'list', 'aria-labelledby': tid });
    var tip = el('div', 'viz-tooltip lg-tip');
    tip.setAttribute('aria-hidden', 'true');
    var ttTitle = el('div', 'tt-title');
    var ttRow = el('div', 'tt-row');
    var ttKey = el('span', 'tt-key');
    var ttVal = el('b');
    var ttName = el('span', null, metric.title);
    ttRow.appendChild(ttKey);
    ttRow.appendChild(ttVal);
    ttRow.appendChild(ttName);
    tip.appendChild(ttTitle);
    tip.appendChild(ttRow);
    viz.appendChild(svg);
    viz.appendChild(tip);
    fig.appendChild(title);
    fig.appendChild(viz);

    var maxVal = 0;
    each(items, function (it) { maxVal = Math.max(maxVal, it.row[metric.key]); });

    var rowsEls = [], bandEls = [], barEls = [];
    var geom = null;
    var lastW = -1;
    var roving = 0;
    var tipFor = null;
    var touchTip = false;

    function render(force) {
      var W = Math.floor(viz.clientWidth);
      if (W < 40 || (W === lastW && !force)) return;
      lastW = W;
      var hadFocus = rowsEls.indexOf(document.activeElement);
      while (svg.firstChild) svg.removeChild(svg.firstChild);
      svg.setAttribute('width', W);

      var bands = sv('g', { class: 'lg-bands', 'aria-hidden': 'true' });
      var grid = sv('g', { class: 'lg-gridlines', 'aria-hidden': 'true' });
      var marks = sv('g', { class: 'lg-rows' });
      svg.appendChild(bands);
      svg.appendChild(grid);
      svg.appendChild(marks);
      rowsEls = []; bandEls = []; barEls = [];

      // Pass 1: labels in the DOM so they can be measured with the font actually in use.
      var cats = [], vals = [], catW = 0, valW = 0;
      each(items, function (it, i) {
        var v = it.row[metric.key];
        var row = sv('g', { class: 'lg-row is-' + it.kind, role: 'listitem', tabindex: i === roving ? 0 : -1, 'data-i': i, 'aria-label': it.name + ': ' + fmt(v) });
        var cat = sv('text', { class: 'lg-cat', dy: '0.35em' }, it.name);
        var val = sv('text', { class: 'lg-val', dy: '0.35em' }, fmt(v));
        row.appendChild(cat);
        row.appendChild(val);
        marks.appendChild(row);
        rowsEls.push(row);
        cats.push(cat);
        vals.push(val);
        catW = Math.max(catW, textLen(cat, it.name.length * 7));
        valW = Math.max(valW, textLen(val, fmt(v).length * 7.2));
      });

      // Pass 2: layout. Labels sit beside the bars unless that squeezes the plot; then they sit above them.
      var labW = Math.ceil(catW) + 14;
      var right = Math.ceil(valW) + 10;
      var above = W - labW - right < Math.max(130, W * 0.42);
      var band = above ? BAND_ABOVE : BAND;
      var x0 = above ? 0 : labW;
      var plotW = Math.max(30, W - x0 - right);
      var ticks = ticksFor(maxVal, plotW);
      var dmax = ticks[ticks.length - 1] || 1;
      var xOf = function (v) { return x0 + (v / dmax) * plotW; };
      var yTop = function (i) { return TOP + i * band; };
      var barMid = function (i) { return yTop(i) + (above ? band - 4 - BAR / 2 : band / 2); };
      var plotBottom = TOP + n * band;
      var H = plotBottom + AXIS;
      geom = { x: xOf, top: yTop, band: band };
      svg.setAttribute('height', H);
      svg.setAttribute('viewBox', '0 0 ' + W + ' ' + H);
      viz.style.height = H + 'px';
      svg.setAttribute('class', 'lg-svg' + (above ? ' is-above' : ''));

      each(ticks, function (t) {
        var xx = Math.round(xOf(t)) + 0.5;
        if (!above) grid.appendChild(sv('line', { class: t === 0 ? 'lg-axis' : 'lg-grid', x1: xx, x2: xx, y1: TOP, y2: plotBottom }));
        grid.appendChild(sv('text', { class: 'lg-tick', x: xx, y: plotBottom + 16, 'text-anchor': t === 0 && above ? 'start' : 'middle' }, String(t)));
      });
      if (above) grid.appendChild(sv('line', { class: 'lg-axis', x1: 0, x2: x0 + plotW, y1: plotBottom + 0.5, y2: plotBottom + 0.5 }));

      each(items, function (it, i) {
        var v = it.row[metric.key];
        var y = yTop(i), cy = barMid(i);
        var bandRect = sv('rect', { class: 'lg-band', x: 0, y: y + 1, width: W, height: band - 2, rx: 6 });
        bands.appendChild(bandRect);
        bandEls.push(bandRect);
        var row = rowsEls[i];
        var hit = sv('rect', { class: 'lg-hit', x: 0, y: y, width: W, height: band });
        var bar = sv('path', { class: 'lg-bar', d: barPath(x0, cy - BAR / 2, xOf(v) - x0, BAR, RADIUS) });
        var ring = sv('rect', { class: 'lg-focus', x: 1, y: y + 1, width: W - 2, height: band - 2, rx: 6 });
        row.insertBefore(hit, row.firstChild);
        row.insertBefore(bar, cats[i].nextSibling);
        row.appendChild(ring);
        barEls.push(bar);
        if (above) {
          cats[i].setAttribute('x', 0);
          cats[i].setAttribute('y', y + 11);
          cats[i].setAttribute('text-anchor', 'start');
        } else {
          cats[i].setAttribute('x', labW - 12);
          cats[i].setAttribute('y', cy);
          cats[i].setAttribute('text-anchor', 'end');
        }
        vals[i].setAttribute('x', xOf(v) + 6);
        vals[i].setAttribute('y', cy);
      });

      if (hadFocus >= 0 && rowsEls[hadFocus]) {
        try { rowsEls[hadFocus].focus({ preventScroll: true }); } catch (e) { rowsEls[hadFocus].focus(); }
      }
      if (tipFor != null) showTip(tipFor);
    }

    function mark(i) {
      each(bandEls, function (b, j) { b.classList.toggle('is-on', j === i); });
    }
    function showTip(i) {
      if (!geom || !items[i]) return;
      var it = items[i];
      var v = it.row[metric.key];
      tipFor = i;
      ttTitle.textContent = it.name;
      ttVal.textContent = fmt(v);
      var fill = barEls[i] ? window.getComputedStyle(barEls[i]).fill : '';
      ttKey.style.background = fill && fill !== 'none' ? fill : '';
      tip.classList.add('is-on');
      var vw = viz.clientWidth, tw = tip.offsetWidth, th = tip.offsetHeight;
      var top = geom.top(i) - th - 6;
      if (top < -title.offsetHeight) top = geom.top(i) + geom.band + 4;
      var left = Math.max(0, Math.min(vw - tw, geom.x(v) - tw / 2));
      tip.style.left = Math.round(left) + 'px';
      tip.style.top = Math.round(top) + 'px';
    }
    function hideTip() {
      tipFor = null;
      tip.classList.remove('is-on');
    }
    function rowIndex(target) {
      var r = target && target.closest ? target.closest('.lg-row') : null;
      if (!r) return -1;
      var i = Number(r.getAttribute('data-i'));
      return isFinite(i) ? i : -1;
    }
    function setRoving(i) {
      roving = i;
      each(rowsEls, function (r, j) { r.setAttribute('tabindex', j === i ? 0 : -1); });
    }

    svg.addEventListener('pointermove', function (e) {
      if (e.pointerType === 'touch') return;
      var i = rowIndex(e.target);
      if (i < 0) return;
      if (i !== tipFor) { linkRows(i); showTip(i); }
    });
    svg.addEventListener('pointerleave', function (e) {
      if (e.pointerType === 'touch') return;
      var f = rowsEls.indexOf(document.activeElement);
      if (f >= 0) { linkRows(f); showTip(f); } else { linkRows(-1); hideTip(); }
    });
    svg.addEventListener('pointerdown', function (e) {
      if (e.pointerType !== 'touch') return;
      var i = rowIndex(e.target);
      if (i < 0) return;
      touchTip = true;
      linkRows(i);
      showTip(i);
    });
    document.addEventListener('pointerdown', function (e) {
      if (touchTip && !svg.contains(e.target)) { touchTip = false; linkRows(-1); hideTip(); }
    });
    svg.addEventListener('focusin', function (e) {
      var i = rowIndex(e.target);
      if (i < 0) return;
      setRoving(i);
      linkRows(i);
      showTip(i);
    });
    svg.addEventListener('focusout', function (e) {
      if (e.relatedTarget && svg.contains(e.relatedTarget)) return;
      linkRows(-1);
      hideTip();
    });
    svg.addEventListener('keydown', function (e) {
      var i = rowIndex(e.target);
      if (i < 0) return;
      var j = null;
      if (e.key === 'ArrowDown' || e.key === 'ArrowRight') j = Math.min(n - 1, i + 1);
      else if (e.key === 'ArrowUp' || e.key === 'ArrowLeft') j = Math.max(0, i - 1);
      else if (e.key === 'Home') j = 0;
      else if (e.key === 'End') j = n - 1;
      else if (e.key === 'Escape') { hideTip(); return; }
      if (j === null) return;
      e.preventDefault();
      setRoving(j);
      rowsEls[j].focus();
    });

    return { node: fig, render: render, mark: mark };
  }

  /* ---------- mount ---------- */
  function mountInto(id, build) {
    var mount = document.getElementById(id);
    if (!mount) return null;
    var data = window.SIMCOT_DATA;
    var node = null;
    try { node = data && typeof data === 'object' ? build(mount, data) : null; } catch (e) { node = null; }
    if (!node) { mount.setAttribute('data-empty', ''); return null; }
    mount.appendChild(node);
    return node;
  }

  mountInto('case-explorer', buildCases);

  var geo = mountInto('latent-geometry', buildGeometry);
  if (geo && geo._render) {
    var draw = geo._render;
    try { draw(false); } catch (e) { /* keep the page alive */ }
    if ('ResizeObserver' in window) {
      new ResizeObserver(function () { try { draw(false); } catch (e) { /* ignore */ } }).observe(geo);
    } else {
      window.addEventListener('resize', function () { draw(false); });
    }
    if (document.fonts && document.fonts.ready) {
      document.fonts.ready.then(function () { draw(true); }, function () {});
    }
  }
})();
