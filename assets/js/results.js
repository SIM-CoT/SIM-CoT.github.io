/* SIM-CoT project page: results charts (inline SVG, no libraries).
   #results-chart   What SIM-CoT adds to each base implicit method on the backbone picked in the Results tabs.
                    Follows the [data-tabs] container: data-selected and the "tabchange" event from main.js.
   #latent-scaling  Figure 3 as small multiples: SIM-CoT and Coconut on GPT-2 by number of latents.
   Every number and name is read from window.SIMCOT_DATA; a missing mount or missing data leaves the mount empty. */
(function () {
  'use strict';

  var SVGNS = 'http://www.w3.org/2000/svg';
  var DATA = window.SIMCOT_DATA;

  /* ---------- helpers ---------- */
  function el(tag, cls, text) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = text;
    return n;
  }
  function svg(tag, attrs, parent) {
    var n = document.createElementNS(SVGNS, tag);
    if (attrs) {
      for (var a in attrs) {
        if (Object.prototype.hasOwnProperty.call(attrs, a) && attrs[a] != null) n.setAttribute(a, String(attrs[a]));
      }
    }
    if (parent) parent.appendChild(n);
    return n;
  }
  function clear(n) { while (n.firstChild) n.removeChild(n.firstChild); }
  function isNum(v) { return typeof v === 'number' && isFinite(v); }
  // Tables 1-3 and Figure 3 print one decimal; JSON drops trailing zeros (42.0 -> 42).
  function fmt(v) { return v.toFixed(1); }
  function px(v) { return Math.round(v) + 0.5; } // crisp 1px hairlines
  function maxOf(list) { return list.length ? Math.max.apply(null, list) : 0; }

  var canvasCtx = null;
  function textWidth(str, size, weight, family) {
    if (canvasCtx === null) {
      var c = document.createElement('canvas');
      canvasCtx = (c.getContext && c.getContext('2d')) || false;
    }
    if (!canvasCtx) return String(str).length * size * 0.58;
    canvasCtx.font = (weight || 400) + ' ' + size + 'px ' + family;
    return canvasCtx.measureText(String(str)).width;
  }

  // Clean ticks for an accuracy axis: the smallest step whose ticks stay >= minGap px apart (at most maxCount ticks),
  // domain snapped outward to that step and kept inside [0, 100].
  var STEPS = [0.1, 0.2, 0.5, 1, 2, 5, 10, 20, 25, 50, 100];
  function niceScale(lo, hi, length, minGap, maxCount) {
    if (!(hi - lo > 1e-9)) { lo -= 1; hi += 1; }
    var pick = null;
    for (var i = 0; i < STEPS.length; i++) {
      var s = STEPS[i];
      var k0 = Math.floor(lo / s + 1e-9), k1 = Math.ceil(hi / s - 1e-9);
      if (k0 * s < 0 && lo >= 0) k0 = 0;
      if (k1 * s > 100 && hi <= 100) k1 = Math.floor(100 / s + 1e-9);
      if (k1 <= k0) k1 = k0 + 1;
      pick = { k0: k0, k1: k1, step: s };
      var count = k1 - k0 + 1;
      if (count <= maxCount && length / (count - 1) >= minGap) break;
    }
    var ticks = [];
    for (var k = pick.k0; k <= pick.k1; k++) ticks.push(Math.round(k * pick.step * 1000) / 1000);
    var dec = pick.step >= 1 ? 0 : 1;
    return { d0: ticks[0], d1: ticks[ticks.length - 1], ticks: ticks, label: function (v) { return v.toFixed(dec); } };
  }

  // One tooltip per chart, positioned inside `host` (a .viz) and kept inside the viewport.
  function makeTooltip(host) {
    var tip = el('div', 'viz-tooltip rs-tip');
    tip.setAttribute('aria-hidden', 'true');
    host.appendChild(tip);
    function show(title, rows, ax, ay, opts) {
      opts = opts || {};
      clear(tip);
      tip.appendChild(el('div', 'tt-title', title));
      for (var i = 0; i < rows.length; i++) {
        var r = rows[i];
        var row = el('div', 'tt-row');
        var key = el('span', 'tt-key');
        if (r.color) key.style.background = r.color;
        row.appendChild(key);
        row.appendChild(el('span', 'tt-l', r.label));
        row.appendChild(el('b', r.gain ? 'is-gain' : null, r.value));
        tip.appendChild(row);
      }
      var hostBox = host.getBoundingClientRect();
      var vw = document.documentElement.clientWidth || window.innerWidth;
      var tw = tip.offsetWidth, th = tip.offsetHeight;
      var left;
      if (opts.side) {
        left = ax + 14;
        if (hostBox.left + left + tw > vw - 8) left = ax - 14 - tw;
      } else {
        left = ax - tw / 2;
      }
      left = Math.min(left, vw - 8 - tw - hostBox.left);
      left = Math.max(left, 8 - hostBox.left);
      var top = opts.top != null ? opts.top : ay - th - 12;
      if (opts.top == null && top < -24) top = ay + 16;
      tip.style.left = Math.round(left) + 'px';
      tip.style.top = Math.round(top) + 'px';
      tip.classList.add('is-on');
    }
    function hide() {
      tip.classList.remove('is-on');
      tip.style.left = '0px';
      tip.style.top = '0px';
    }
    return { show: show, hide: hide };
  }

  // A legend entry; `short` (optional) replaces the label on very narrow screens (see results.css).
  function legendKey(legend, cls, color, label, short) {
    var k = el('span', 'key');
    var sw = el('span', cls);
    sw.style.background = color;
    sw.setAttribute('aria-hidden', 'true');
    k.appendChild(sw);
    if (short) {
      k.appendChild(el('span', 'rs-long', label));
      k.appendChild(el('span', 'rs-short', short));
    } else {
      k.appendChild(document.createTextNode(label));
    }
    legend.appendChild(k);
  }

  function hasKeyboardFocus(node) {
    if (document.activeElement !== node) return false;
    try { return node.matches(':focus-visible'); } catch (e) { return true; }
  }

  // Re-render when the element's width changes (not on height changes caused by the render itself).
  function onWidthChange(node, fn) {
    var last = Math.floor(node.clientWidth), raf = 0;
    function check() {
      raf = 0;
      var w = Math.floor(node.clientWidth);
      if (w !== last) { last = w; fn(); }
    }
    function schedule() { if (!raf) raf = window.requestAnimationFrame(check); }
    if ('ResizeObserver' in window) new window.ResizeObserver(schedule).observe(node);
    else window.addEventListener('resize', schedule);
    return function force() { last = -1; schedule(); };
  }

  var VIZ = {
    simcot: 'var(--viz-simcot)',
    explicit: 'var(--viz-explicit)',
    base: 'var(--viz-base)'
  };

  /* ---------- #results-chart: dumbbell per base method ---------- */
  function initResultsChart() {
    var mount = document.getElementById('results-chart');
    var main = DATA && DATA.main;
    if (!mount || !main || typeof main !== 'object') return;
    var keys = Object.keys(main).filter(function (k) { return main[k] && Array.isArray(main[k].rows); });
    if (!keys.length) return;
    var box = mount.closest ? mount.closest('[data-tabs]') : null;

    var bench = {};
    (DATA.benchmarks || []).forEach(function (b) { if (b && b.id) bench[b.id] = b.label; });
    var METRICS = [
      { label: bench.gsm8k || 'In-domain', short: 'In-domain', value: 'gsm8k', tokens: 'gsm8k_tokens', gain: 'gain_id' },
      { label: 'Out-of-domain avg.', short: 'Out-of-domain', value: 'ood_avg', tokens: 'ood_tokens', gain: 'gain_ood' }
    ];

    function referenceRow(rows, name) {
      for (var i = 0; i < rows.length; i++) {
        var r = rows[i];
        if (r && r.simcot !== true && String(r.method).toLowerCase() === name) return r;
      }
      return null;
    }
    function model(key, metric) {
      var b = main[key];
      if (!b || !Array.isArray(b.rows)) return null;
      var rows = b.rows, pairs = [], refs = [];
      rows.forEach(function (r) {
        if (!r || r.simcot !== true) return;
        var base = null;
        for (var i = 0; i < rows.length; i++) {
          if (rows[i] && rows[i].simcot === false && rows[i].method === r.method) { base = rows[i]; break; }
        }
        if (!base || !isNum(base[metric.value]) || !isNum(r[metric.value])) return;
        pairs.push({
          method: String(r.method),
          base: base[metric.value],
          sim: r[metric.value],
          gain: typeof r[metric.gain] === 'string' && r[metric.gain] ? r[metric.gain] : null,
          tok0: base[metric.tokens],
          tok1: r[metric.tokens]
        });
      });
      [['sft-cot', 'explicit'], ['no-cot', 'none']].forEach(function (d) {
        var r = referenceRow(rows, d[0]);
        if (r && isNum(r[metric.value])) {
          refs.push({ kind: d[1], name: String(r.method), value: r[metric.value], tokens: r[metric.tokens] });
        }
      });
      return { label: b.label, pairs: pairs, refs: refs };
    }
    function tokenText(p) {
      if (!isNum(p.tok0) && !isNum(p.tok1)) return '';
      if (isNum(p.tok0) && isNum(p.tok1) && p.tok0 !== p.tok1) return fmt(p.tok0) + ' / ' + fmt(p.tok1);
      return fmt(isNum(p.tok0) ? p.tok0 : p.tok1);
    }

    // Same height for every backbone (the most rows any backbone has), so switching tabs never moves the table.
    var slots = 1;
    keys.forEach(function (k) {
      METRICS.forEach(function (mt) {
        var m = model(k, mt);
        if (m) slots = Math.max(slots, m.pairs.length);
      });
    });

    function selectedKey() {
      var k = box && box.getAttribute('data-selected');
      if (k && main[k]) return k;
      var tab = box && box.querySelector('[role=tab][aria-selected=true]');
      k = tab && tab.getAttribute('data-backbone');
      return k && main[k] ? k : keys[0];
    }
    var state = { key: selectedKey(), metric: 0 };

    var card = el('div', 'card rc');
    var head = el('div', 'rc-head');
    var seg = el('div', 'seg');
    seg.setAttribute('role', 'group');
    seg.setAttribute('aria-label', 'Accuracy shown in the chart');
    var buttons = METRICS.map(function (mt, i) {
      var b = el('button');
      b.type = 'button';
      b.appendChild(el('span', 'rs-long', mt.label));
      b.appendChild(el('span', 'rs-short', mt.short));
      b.setAttribute('aria-pressed', i === state.metric ? 'true' : 'false');
      b.addEventListener('click', function () {
        if (state.metric === i) return;
        state.metric = i;
        buttons.forEach(function (x, j) { x.setAttribute('aria-pressed', j === i ? 'true' : 'false'); });
        render(true);
      });
      seg.appendChild(b);
      return b;
    });
    var legend = el('div', 'legend rc-legend');
    legendKey(legend, 'key-dot', VIZ.base, 'Base method', 'Base');
    legendKey(legend, 'key-dot', VIZ.simcot, '+ SIM-CoT');
    legendKey(legend, 'rc-key-rule', VIZ.explicit, 'Explicit CoT');
    head.appendChild(seg);
    head.appendChild(legend);

    var viz = el('div', 'viz rc-viz');
    var layer = el('div', 'rc-layer');
    viz.appendChild(layer);
    var tip = makeTooltip(viz);
    card.appendChild(head);
    card.appendChild(viz);
    mount.appendChild(card);

    var DOT = 6, TOP = 26, ROW = 64, AXIS = 28;
    var current = null; // the hit target whose tooltip is showing

    function render(animate) {
      var W = Math.floor(viz.clientWidth);
      if (W < 60) return;
      var metric = METRICS[state.metric];
      var m = model(state.key, metric);
      var refocus = null;
      if (current && document.activeElement === current.node) refocus = current.id;
      tip.hide();
      current = null;
      clear(layer);
      if (!m || !m.pairs.length) { viz.style.height = '0px'; return; }

      var family = window.getComputedStyle(viz).fontFamily;
      // Narrow cards keep the label column but print the gain above the SIM-CoT dot and shorten the explicit-CoT flag
      // to its value (the legend names it), so the plot keeps most of the width.
      var narrow = W < 520;
      var axisTitle = 'Accuracy (%)';
      var H = TOP + slots * ROW + AXIS;
      viz.style.height = H + 'px';

      var pairs = m.pairs;
      var toks = pairs.map(function (p) { var t = tokenText(p); return t ? t + ' tokens' : ''; });
      var nameW = maxOf(pairs.map(function (p) { return textWidth(p.method, 14, 500, family); }));
      var tokW = maxOf(toks.map(function (t) { return textWidth(t, 12, 400, family); }));
      var gainW = maxOf(pairs.map(function (p) { return p.gain ? textWidth(p.gain, 13, 600, family) : 0; }));
      var labelCol = Math.ceil(Math.max(nameW, tokW, textWidth(axisTitle, 12, 400, family)) + (narrow ? 14 : 22));
      var x0 = labelCol + DOT + 4;
      var x1 = W - (narrow ? Math.max(DOT, gainW / 2) + 4 : (gainW ? gainW + DOT + 14 : DOT + 4));

      var vals = [];
      pairs.forEach(function (p) { vals.push(p.base, p.sim); });
      m.refs.forEach(function (r) { vals.push(r.value); });
      var sc = niceScale(Math.min.apply(null, vals), Math.max.apply(null, vals), x1 - x0, 34, 9);
      function X(v) { return x0 + (v - sc.d0) / (sc.d1 - sc.d0) * (x1 - x0); }
      var plotTop = TOP, plotBottom = TOP + slots * ROW;
      var offset = (slots - pairs.length) * ROW / 2;

      var s = svg('svg', { width: W, height: H, viewBox: '0 0 ' + W + ' ' + H, 'aria-hidden': 'true', focusable: 'false', 'class': animate ? 'is-fresh' : null });
      var gHot = svg('g', null, s);
      var gGrid = svg('g', { 'class': 'tick' }, s);
      var gRef = svg('g', null, s);
      var gMarks = svg('g', null, s);
      var gText = svg('g', null, s);

      // grid + axis
      sc.ticks.forEach(function (t) {
        var x = px(X(t));
        svg('line', { x1: x, x2: x, y1: plotTop, y2: plotBottom, 'class': 'rc-grid' }, gGrid);
        svg('text', { x: X(t), y: plotBottom + 18, 'text-anchor': 'middle', 'class': 'rc-tick' }, gGrid).textContent = sc.label(t);
      });
      svg('line', { x1: X(sc.d0), x2: X(sc.d1), y1: px(plotBottom) - 1, y2: px(plotBottom) - 1, 'class': 'rc-axis' }, gGrid);
      svg('text', { x: 0, y: plotBottom + 18, 'class': 'rc-axis-title' }, gGrid).textContent = axisTitle;

      var hits = [];

      // Reference rules with flag labels beside their top end. Flags are placed right to left: each goes to the
      // right of its rule when it fits before the next rule/flag, otherwise to the left.
      var flags = m.refs.map(function (r) {
        var name = r.kind === 'explicit' ? (narrow ? '' : 'Explicit CoT') : r.name;
        var w = (name ? textWidth(name + ' ', 12, 400, family) : 0) + textWidth(fmt(r.value), 12, 600, family);
        return { ref: r, name: name, x: X(r.value), w: w };
      }).sort(function (a, b) { return a.x - b.x; });
      var limit = W;
      for (var i = flags.length - 1; i >= 0; i--) {
        var f = flags[i];
        if (f.x + 6 + f.w <= limit) f.left = f.x + 6;
        else f.left = Math.max(0, Math.min(f.x - 6, limit) - f.w);
        limit = Math.min(f.left, f.x) - 10;
      }
      flags.forEach(function (f) {
        var r = f.ref;
        svg('line', { x1: f.x, x2: f.x, y1: 5, y2: plotBottom - 1, 'class': 'rc-ref ' + (r.kind === 'explicit' ? 'is-explicit' : 'is-none') }, gRef);
        var t = svg('text', { x: f.left, y: 15, 'class': 'rc-flag halo' }, gText);
        if (f.name) t.appendChild(document.createTextNode(f.name + ' '));
        svg('tspan', { 'class': 'rc-flag-v' }, t).textContent = fmt(r.value);
        var tokens = isNum(r.tokens) ? fmt(r.tokens) : null;
        var title = r.kind === 'explicit' ? r.name + ' · explicit CoT' : r.name;
        var rows = [{ label: metric.label, value: fmt(r.value), color: r.kind === 'explicit' ? VIZ.explicit : VIZ.base }];
        if (tokens) rows.push({ label: 'Tokens', value: tokens });
        hits.push({
          id: 'ref-' + r.kind,
          box: { left: f.left - 6, top: 1, width: f.w + 12, height: TOP - 2 },
          aria: metric.label + ', ' + title + ': ' + fmt(r.value) + (tokens ? ', ' + tokens + ' tokens' : ''),
          title: title, rows: rows,
          anchor: { x: f.left + f.w / 2, y: TOP }, below: true
        });
      });

      // dumbbells
      pairs.forEach(function (p, i) {
        var top = plotTop + offset + i * ROW;
        var cy = top + ROW / 2;
        var xb = X(p.base), xs = X(p.sim);
        var hot = svg('rect', { x: 0, y: top + 3, width: W, height: ROW - 6, rx: 8, 'class': 'rc-hot' }, gHot);
        if (Math.abs(xs - xb) > 0.5) svg('line', { x1: xb, x2: xs, y1: cy, y2: cy, 'class': 'rc-bar' }, gMarks);
        svg('circle', { cx: xb, cy: cy, r: DOT, 'class': 'rc-dot is-base' }, gMarks);
        svg('circle', { cx: xs, cy: cy, r: DOT, 'class': 'rc-dot is-sim' }, gMarks);
        if (p.gain) {
          var g;
          if (narrow) {
            g = { x: xs, y: cy - DOT - 7, 'text-anchor': 'middle' };
          } else {
            var right = xs >= xb;
            g = { x: right ? xs + DOT + 7 : xs - DOT - 7, y: cy + 4.5, 'text-anchor': right ? 'start' : 'end' };
          }
          g['class'] = 'rc-gain halo';
          svg('text', g, gText).textContent = p.gain;
        }
        svg('text', { x: 0, y: cy - 3, 'class': 'rc-name' }, gText).textContent = p.method;
        if (toks[i]) svg('text', { x: 0, y: cy + 14, 'class': 'rc-tok' }, gText).textContent = toks[i];
        var rows = [
          { label: '+ SIM-CoT', value: fmt(p.sim), color: VIZ.simcot },
          { label: p.method, value: fmt(p.base), color: VIZ.base }
        ];
        if (p.gain) rows.push({ label: 'Gain', value: p.gain, gain: true });
        var tt = tokenText(p);
        if (tt) rows.push({ label: 'Tokens', value: tt });
        hits.push({
          id: 'row-' + i,
          box: { left: 0, top: top, width: W, height: ROW },
          aria: metric.label + ', ' + p.method + ': ' + fmt(p.base) + '; with SIM-CoT: ' + fmt(p.sim) +
            (p.gain ? ' (' + p.gain + ')' : '') + (tt ? '; ' + tt + ' tokens' : ''),
          title: p.method + ' · ' + metric.label, rows: rows,
          anchor: { x: (xb + xs) / 2, y: cy - DOT },
          hot: hot
        });
      });

      layer.appendChild(s);

      // hit targets: real elements so they take keyboard focus and show the site's focus ring
      var order = hits.filter(function (h) { return h.id.indexOf('row-') === 0; })
        .concat(hits.filter(function (h) { return h.id.indexOf('ref-') === 0; }));
      order.forEach(function (h) {
        var n = el('div', 'rc-hit');
        n.tabIndex = 0;
        n.setAttribute('role', 'img');
        n.setAttribute('aria-label', h.aria);
        n.style.left = h.box.left + 'px';
        n.style.top = h.box.top + 'px';
        n.style.width = h.box.width + 'px';
        n.style.height = h.box.height + 'px';
        h.node = n;
        n.addEventListener('pointerenter', function (e) { if (e.pointerType !== 'touch') show(h); });
        n.addEventListener('pointerleave', function (e) {
          if (e.pointerType === 'touch') return;
          if (current === h && !hasKeyboardFocus(n)) hide();
        });
        n.addEventListener('focus', function () { show(h); });
        n.addEventListener('blur', function () { if (current === h) hide(); });
        n.addEventListener('keydown', function (e) { if (e.key === 'Escape' && current === h) hide(); });
        layer.appendChild(n);
        if (refocus === h.id) {
          try { n.focus({ preventScroll: true }); } catch (err) { n.focus(); }
        }
      });
    }
    function show(h) {
      if (current && current !== h && current.hot) current.hot.classList.remove('is-on');
      current = h;
      if (h.hot) h.hot.classList.add('is-on');
      tip.show(h.title, h.rows, h.anchor.x, h.anchor.y, h.below ? { top: h.anchor.y + 6 } : null);
    }
    function hide() {
      if (current && current.hot) current.hot.classList.remove('is-on');
      current = null;
      tip.hide();
    }

    if (box) box.addEventListener('tabchange', function (e) {
      var k = e && e.detail && e.detail.key;
      if (!k || !main[k] || k === state.key) return;
      state.key = k;
      render(true);
    });
    var force = onWidthChange(viz, function () { render(false); });
    render(false);
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(force);
  }

  /* ---------- #latent-scaling: Figure 3 small multiples ---------- */
  function initLatentScaling() {
    var mount = document.getElementById('latent-scaling');
    var ls = DATA && DATA.latentScaling;
    if (!mount || !ls || !Array.isArray(ls.panels) || !Array.isArray(ls.latents)) return;
    var latents = ls.latents;
    var n = latents.length;
    if (n < 2 || !latents.every(isNum)) return;
    function series(a) { return Array.isArray(a) && a.length === n && a.every(isNum); }
    var panels = ls.panels.filter(function (p) { return p && series(p.simcot) && series(p.coconut); });
    if (!panels.length) return;

    // "5-10" = 5 latents, 10 implicit tokens (each latent is two tokens).
    var tokens = latents.map(function (l, i) {
      var parts = String((ls.x || [])[i] || '').split('-');
      var t = parts.length === 2 ? Number(parts[1]) : NaN;
      return isFinite(t) && Number(parts[0]) === l ? t : l * 2;
    });
    function latentLabel(i) {
      return latents[i] + (latents[i] === 1 ? ' latent' : ' latents') + ' · ' + tokens[i] + (tokens[i] === 1 ? ' token' : ' tokens');
    }
    // series names: SIM-CoT, and the base method as it is printed in the tables
    var baseName = 'Coconut';
    Object.keys(DATA.main || {}).some(function (k) {
      var rows = (DATA.main[k] && DATA.main[k].rows) || [];
      for (var i = 0; i < rows.length; i++) {
        if (rows[i] && String(rows[i].method).toLowerCase() === 'coconut') { baseName = String(rows[i].method); return true; }
      }
      return false;
    });
    var SERIES = [
      { key: 'coconut', name: baseName, cls: 'is-base', color: VIZ.base },
      { key: 'simcot', name: 'SIM-CoT', cls: 'is-sim', color: VIZ.simcot }
    ];

    var card = el('div', 'card ls');
    var head = el('div', 'ls-head');
    var title = el('p', 'ls-title');
    var src = [ls.source, ls.backbone].filter(function (x) { return typeof x === 'string' && x; }).join(' · ');
    if (src) { title.appendChild(el('b', null, src + '.')); title.appendChild(document.createTextNode(' ')); }
    title.appendChild(document.createTextNode('Accuracy (%) by number of latents.'));
    var legend = el('div', 'legend');
    legendKey(legend, 'key-line', VIZ.simcot, 'SIM-CoT');
    legendKey(legend, 'key-line', VIZ.base, baseName);
    head.appendChild(title);
    head.appendChild(legend);
    var grid = el('div', 'ls-grid');
    card.appendChild(head);
    card.appendChild(grid);

    var P = panels.map(function (p) {
      var wrap = el('div', 'ls-panel');
      var name = String(p.label || p.id || '');
      wrap.appendChild(el('p', 'ls-name', name));
      var viz = el('div', 'viz ls-viz');
      viz.tabIndex = 0;
      viz.setAttribute('role', 'img');
      viz.setAttribute('aria-label', name + ', accuracy (%) at ' + latents.join(', ') + ' latents. SIM-CoT: ' +
        p.simcot.map(fmt).join(', ') + '. ' + baseName + ': ' + p.coconut.map(fmt).join(', ') + '.');
      var layer = el('div', 'ls-layer');
      viz.appendChild(layer);
      wrap.appendChild(viz);
      grid.appendChild(wrap);
      var o = { data: p, viz: viz, layer: layer, tip: makeTooltip(viz), idx: n - 1, on: false, geo: null };
      bindPanel(o);
      return o;
    });
    mount.appendChild(card);

    // Each panel has its own y scale; the margins are shared so the five settings line up across panels.
    var TOP_PAD = 8, BOTTOM_PAD = 24;
    function layoutAll() {
      var family = window.getComputedStyle(grid).fontFamily;
      var left = 0, right = 0;
      P.forEach(function (o) {
        var d = o.data, all = d.simcot.concat(d.coconut);
        var plotH = Math.max(40, Math.floor(o.viz.clientHeight) - TOP_PAD - BOTTOM_PAD);
        o.sc = niceScale(Math.min.apply(null, all), Math.max.apply(null, all), plotH, 22, 5);
        sc = o.sc;
        left = Math.max(left, maxOf(sc.ticks.map(function (t) { return textWidth(sc.label(t), 12, 400, family); })));
        right = Math.max(right, textWidth(fmt(d.simcot[n - 1]), 12, 600, family), textWidth(fmt(d.coconut[n - 1]), 12, 400, family));
      });
      var sc;
      return { left: Math.ceil(left) + 8, right: Math.ceil(right) + 12 };
    }

    function renderPanel(o, margins) {
      var W = Math.floor(o.viz.clientWidth);
      var H = Math.floor(o.viz.clientHeight);
      if (W < 60 || H < 60 || !o.sc) return;
      var d = o.data;
      var top = TOP_PAD;
      var plotH = H - TOP_PAD - BOTTOM_PAD;
      var sc = o.sc;
      var left = margins.left, right = margins.right;
      var endS = d.simcot[n - 1], endB = d.coconut[n - 1];
      var x0 = left + 10, x1 = W - right - 6;
      function X(i) { return x0 + i * (x1 - x0) / (n - 1); }
      function Y(v) { return top + (sc.d1 - v) / (sc.d1 - sc.d0) * plotH; }

      clear(o.layer);
      var s = svg('svg', { width: W, height: H, viewBox: '0 0 ' + W + ' ' + H, 'aria-hidden': 'true', focusable: 'false' });
      var g = svg('g', { 'class': 'tick' }, s);
      sc.ticks.forEach(function (t) {
        var y = px(Y(t));
        svg('line', { x1: left, x2: x1 + 6, y1: y, y2: y, 'class': 'ls-grid-line' }, g);
        svg('text', { x: left - 6, y: Y(t) + 4, 'text-anchor': 'end', 'class': 'ls-tick' }, g).textContent = sc.label(t);
      });
      latents.forEach(function (l, i) {
        svg('text', { x: X(i), y: H - 6, 'text-anchor': 'middle', 'class': 'ls-tick' }, g).textContent = String(l);
      });
      var cross = svg('line', { x1: 0, x2: 0, y1: top - 2, y2: top + plotH, 'class': 'ls-cross' }, s);
      var dots = {};
      SERIES.forEach(function (se) {
        var vals = d[se.key];
        var path = vals.map(function (v, i) { return (i ? 'L' : 'M') + X(i).toFixed(1) + ' ' + Y(v).toFixed(1); }).join(' ');
        svg('path', { d: path, 'class': 'ls-line ' + se.cls }, s);
      });
      SERIES.forEach(function (se) {
        dots[se.key] = d[se.key].map(function (v, i) {
          return svg('circle', { cx: X(i), cy: Y(v), r: 4, 'class': 'ls-dot ' + se.cls }, s);
        });
      });
      // direct labels at the line ends only
      var yS = Y(endS) + 4, yB = Y(endB) + 4;
      if (Math.abs(yS - yB) < 13) {
        var mid = (yS + yB) / 2, up = endS >= endB ? -1 : 1;
        yS = mid + up * 6.5;
        yB = mid - up * 6.5;
      }
      svg('text', { x: X(n - 1) + 9, y: yS, 'class': 'ls-end is-sim' }, s).textContent = fmt(endS);
      svg('text', { x: X(n - 1) + 9, y: yB, 'class': 'ls-end is-base' }, s).textContent = fmt(endB);
      o.layer.appendChild(s);
      o.geo = { X: X, Y: Y, x0: x0, x1: x1, top: top, cross: cross, dots: dots };
      if (o.on) showAt(o, o.idx);
    }

    function showAt(o, i) {
      if (!o.geo) return;
      i = Math.max(0, Math.min(n - 1, i));
      o.idx = i;
      o.on = true;
      var G = o.geo, x = G.X(i);
      G.cross.setAttribute('x1', px(x));
      G.cross.setAttribute('x2', px(x));
      G.cross.classList.add('is-on');
      SERIES.forEach(function (se) {
        G.dots[se.key].forEach(function (c, j) { c.setAttribute('r', j === i ? 5.5 : 4); });
      });
      var rows = SERIES.slice().reverse().map(function (se) {
        return { label: se.name, value: fmt(o.data[se.key][i]), color: se.color };
      });
      o.tip.show(latentLabel(i), rows, x, 0, { side: true, top: G.top });
    }
    function hideTip(o) {
      o.on = false;
      o.tip.hide();
      if (!o.geo) return;
      o.geo.cross.classList.remove('is-on');
      SERIES.forEach(function (se) { o.geo.dots[se.key].forEach(function (c) { c.setAttribute('r', 4); }); });
    }
    function bindPanel(o) {
      function nearest(e) {
        if (!o.geo) return o.idx;
        var r = o.viz.getBoundingClientRect();
        var x = e.clientX - r.left;
        var step = (o.geo.x1 - o.geo.x0) / (n - 1);
        return Math.round((x - o.geo.x0) / step);
      }
      o.viz.addEventListener('pointermove', function (e) {
        var i = Math.max(0, Math.min(n - 1, nearest(e)));
        if (!o.on || i !== o.idx) showAt(o, i);
      });
      o.viz.addEventListener('pointerdown', function (e) { showAt(o, nearest(e)); });
      o.viz.addEventListener('pointerleave', function (e) {
        if (e.pointerType === 'touch') return;
        if (!hasKeyboardFocus(o.viz)) hideTip(o);
      });
      o.viz.addEventListener('focus', function () { showAt(o, o.idx); });
      o.viz.addEventListener('blur', function () { hideTip(o); });
      o.viz.addEventListener('keydown', function (e) {
        var i = null;
        if (e.key === 'ArrowRight' || e.key === 'ArrowUp') i = o.idx + 1;
        else if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') i = o.idx - 1;
        else if (e.key === 'Home') i = 0;
        else if (e.key === 'End') i = n - 1;
        else if (e.key === 'Escape') { hideTip(o); return; }
        if (i === null) return;
        e.preventDefault();
        showAt(o, i);
      });
    }

    function renderAll() {
      var margins = layoutAll();
      P.forEach(function (o) { renderPanel(o, margins); });
    }
    var force = onWidthChange(grid, renderAll);
    renderAll();
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(force);
  }

  function safely(fn, id) {
    try { fn(); } catch (err) {
      var m = document.getElementById(id);
      if (m) clear(m);
    }
  }
  safely(initResultsChart, 'results-chart');
  safely(initLatentScaling, 'latent-scaling');
})();
