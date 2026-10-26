/* Teaser animation: paper Figure 4 and the README animation retold in four stages
   (Ask, Think implicitly, Answer, Decode). Plain DOM, no libraries.
   Test hook: window.__simcotDemo = { go(stageIndex), play(), pause(), state() }.
   URL parameter ?demo=N (0-3) renders stage N statically. */
(function () {
  'use strict';

  var fig = document.getElementById('demo');
  if (!fig) return;

  var SVGNS = 'http://www.w3.org/2000/svg';

  // Question text as printed in Figure 4. k = the decoded step whose evidence the span marks
  // (same colour in the figure: teal span -> first box, blue -> second, orange -> third).
  var QUESTION = [
    { text: 'A watermelon farm produced 120 baby watermelons... and found out that 30% of the watermelons were ready for harvest', k: 1 },
    { text: ', so she took them home. When she came back two weeks later, ' },
    { text: '3/4 of the remaining melons were ready', k: 2 },
    { text: ', so she harvested them. ' },
    { text: 'How many melons were not ready', k: 3 },
    { text: ' to be harvested after the two weeks?' }
  ];
  var PROMPTS = ['What\u2019s the answer?', 'Let\u2019s think implicitly.', 'Show me intermediate reasoning.'];
  var STEPS = ['0.3*120=36', '(120-36)*3/4=63', '84-63=21'];
  var STAGES = ['Ask', 'Think implicitly', 'Answer', 'Decode'];
  var ANNOUNCE = [
    'Stage 1 of 4, Ask: What\u2019s the answer?',
    'Stage 2 of 4, Think implicitly: the question is embedded, and the model produces implicit latent tokens one at a time, feeding each one back.',
    'Stage 3 of 4, Answer: the model switches back to explicit decoding. Answer: 21.',
    'Stage 4 of 4, Decode: the optional decoder reads the latents as 0.3*120=36, (120-36)*3/4=63 and 84-63=21.'
  ];

  // Timeline, in seconds.
  var START = [0, 1.9, 6.9, 8.1];          // stage starts
  var END = 11.2;
  var T_BUBBLE = [0.35, START[1], START[3]];
  var T_SEND = [2.2, 2.95];                 // question card glows while it is embedded
  var T_EMBED = 2.45, T_INTO = 2.6, T_LLM = 3.45;
  var T_Q = [2.75, 2.85, 2.95, 3.05, 3.15]; // question tokens
  var T_Z = [3.85, 4.6, 5.35, 6.1];         // implicit latents, one at a time
  var PULSE_DELAY = 0.15, PULSE_DUR = 0.5;  // each latent travels round the loop back into the model
  var T_ANSWER = 7.05;
  var T_LINK = 8.4, T_DEC = 8.5;
  var T_STEP = [9.0, 9.7, 10.4];

  function el(tag, cls, text) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = text;
    return n;
  }
  function svgEl(tag, attrs) {
    var n = document.createElementNS(SVGNS, tag);
    for (var a in attrs) {
      if (Object.prototype.hasOwnProperty.call(attrs, a)) n.setAttribute(a, String(attrs[a]));
    }
    return n;
  }
  function icon(parts, cls) {
    var s = svgEl('svg', { viewBox: '0 0 24 24', 'aria-hidden': 'true', focusable: 'false' });
    if (cls) s.setAttribute('class', cls);
    for (var i = 0; i < parts.length; i++) s.appendChild(svgEl(parts[i][0], parts[i][1]));
    return s;
  }
  function hidden(n) { n.setAttribute('aria-hidden', 'true'); return n; }
  function arrow(cls) { return hidden(el('span', 'sd-arrow ' + cls)); }
  function block(cls, label, extra) {
    var b = el('div', 'sd-block ' + cls);
    var l = el('span', 'sd-label', label);
    if (extra) { l.appendChild(document.createTextNode(' ')); l.appendChild(el('span', 'sd-opt', extra)); }
    b.appendChild(l);
    return b;
  }
  function clampStage(i) {
    i = Math.round(Number(i));
    if (!isFinite(i)) i = 0;
    return Math.max(0, Math.min(STAGES.length - 1, i));
  }
  function settled(i) { return i < STAGES.length - 1 ? START[i + 1] - 0.001 : END; }
  function stageAt(t) {
    var s = 0;
    for (var i = 1; i < START.length; i++) if (t >= START[i]) s = i;
    return s;
  }
  function easeInOut(p) { return p < 0.5 ? 2 * p * p : 1 - Math.pow(-2 * p + 2, 2) / 2; }

  function build() {
    var mq = window.matchMedia ? window.matchMedia('(prefers-reduced-motion: reduce)') : null;
    var reduced = !!(mq && mq.matches);
    var m = /[?&]demo=([0-3])(?:&|#|$)/.exec(window.location.search);
    var staticStage = m ? Number(m[1]) : null;

    var items = [];
    function at(node, on, off, aria) {
      items.push({ node: node, on: on, off: off == null ? Infinity : off, aria: !!aria, state: null });
      return node;
    }

    var root = el('div', 'sd');
    var scene = el('div', 'sd-scene');

    /* ---- left column: the question and the user's request ---- */
    var colq = el('div', 'sd-colq');
    var card = at(el('div', 'sd-card'), T_SEND[0], T_SEND[1]);
    var q = el('p', 'sd-q');
    q.appendChild(el('span', 'sd-qlabel', '[Question]'));
    q.appendChild(document.createTextNode(' '));
    var spans = [];
    for (var i = 0; i < QUESTION.length; i++) {
      var part = QUESTION[i];
      if (part.k) {
        var s = el('span', 'sd-ev sd-ev' + part.k, part.text);
        spans[part.k - 1] = s;
        q.appendChild(s);
      } else {
        q.appendChild(document.createTextNode(part.text));
      }
    }
    card.appendChild(q);
    colq.appendChild(card);

    var ask = el('div', 'sd-ask');
    var bubbles = el('div', 'sd-bubbles');
    for (i = 0; i < PROMPTS.length; i++) {
      bubbles.appendChild(at(el('p', 'sd-bubble', PROMPTS[i]), T_BUBBLE[i], i + 1 < T_BUBBLE.length ? T_BUBBLE[i + 1] : null, true));
    }
    ask.appendChild(bubbles);
    var avatar = hidden(el('span', 'sd-avatar'));
    avatar.appendChild(icon([
      ['circle', { cx: 12, cy: 8.6, r: 3.6, fill: 'none', stroke: 'currentColor', 'stroke-width': 1.7 }],
      ['path', { d: 'M5.4 19.6c1.1-3.5 3.7-5.3 6.6-5.3s5.5 1.8 6.6 5.3', fill: 'none', stroke: 'currentColor', 'stroke-width': 1.7, 'stroke-linecap': 'round' }]
    ]));
    ask.appendChild(avatar);
    colq.appendChild(ask);

    /* ---- right column: embed -> LLM with latent loop -> answer; optional decoder ---- */
    var colm = el('div', 'sd-colm');

    var ew = el('div', 'sd-embedwrap');
    ew.appendChild(at(arrow('sd-feed is-down'), T_SEND[0]));
    ew.appendChild(at(block('sd-embed', 'LLM Token Embed'), T_EMBED));
    ew.appendChild(at(arrow('sd-into is-down'), T_INTO));
    colm.appendChild(ew);

    var rowIn = el('div', 'sd-row sd-in');
    var qToks = hidden(el('span', 'sd-toks'));
    for (i = 0; i < T_Q.length; i++) qToks.appendChild(at(el('span', 'sd-tok sd-tok-q'), T_Q[i]));
    var gIn = el('span', 'sd-grp');
    gIn.appendChild(qToks);
    gIn.appendChild(el('span', 'sd-cap', 'Question tokens'));
    rowIn.appendChild(gIn);
    colm.appendChild(rowIn);

    var lw = el('div', 'sd-llmwrap');
    lw.appendChild(at(block('sd-llm', 'Large Language Model'), T_LLM));
    // Feedback loop: leaves the model at the bottom right and re-enters at the top right.
    var loop = svgEl('svg', { 'class': 'sd-loop', viewBox: '0 0 24 48', 'aria-hidden': 'true', focusable: 'false' });
    var loopPath = svgEl('path', { d: 'M1.5 39H8a10 10 0 0 0 10-10V19A10 10 0 0 0 8 9H4' });
    loop.appendChild(loopPath);
    loop.appendChild(svgEl('polyline', { points: '8 5.5 4 9 8 12.5' }));
    // a latent travelling round the loop, back into the model
    var dot = svgEl('rect', { 'class': 'sd-dot', x: -20, y: -20, width: 8, height: 8, rx: 2 });
    loop.appendChild(dot);
    lw.appendChild(at(loop, T_Z[0]));
    colm.appendChild(lw);

    var rowOut = el('div', 'sd-row sd-out');
    var zToks = hidden(el('span', 'sd-toks'));
    for (i = 0; i < T_Z.length; i++) zToks.appendChild(at(el('span', 'sd-tok sd-tok-z'), T_Z[i]));
    var gOut = el('span', 'sd-grp');
    gOut.appendChild(zToks);
    gOut.appendChild(el('span', 'sd-cap', 'Implicit tokens'));
    rowOut.appendChild(gOut);
    var ans = el('span', 'sd-ans');
    var ansText = el('span', 'sd-ans-x');
    ansText.appendChild(document.createTextNode('Answer: '));
    ansText.appendChild(el('b', null, '21'));
    ans.appendChild(ansText);
    rowOut.appendChild(at(ans, T_ANSWER, null, true));
    colm.appendChild(rowOut);

    var sep = hidden(el('div', 'sd-sep'));
    sep.appendChild(at(arrow('sd-link is-down'), T_LINK));
    colm.appendChild(sep);
    colm.appendChild(at(block('sd-dec', 'Decoder Model', '(Optional)'), T_DEC));

    var steps = el('ol', 'sd-steps');
    steps.setAttribute('aria-label', 'Decoded steps');
    for (i = 0; i < STEPS.length; i++) {
      var li = el('li', 'sd-step sd-step' + (i + 1));
      li.appendChild(el('span', 'sd-step-x', STEPS[i]));
      steps.appendChild(at(li, T_STEP[i], null, true));
      at(spans[i], T_STEP[i]);
    }
    colm.appendChild(steps);

    scene.appendChild(colq);
    scene.appendChild(colm);
    root.appendChild(scene);

    /* ---- controls ---- */
    var bar = el('div', 'sd-bar');
    bar.setAttribute('role', 'group');
    bar.setAttribute('aria-label', 'Animation controls');
    var btns = el('div', 'sd-btns');
    var playBtn = el('button', 'sd-btn sd-play');
    playBtn.type = 'button';
    playBtn.appendChild(icon([['path', { d: 'M8.2 5.6v12.8c0 .7.8 1.1 1.4.7l9.7-6.4a.8.8 0 0 0 0-1.4L9.6 4.9c-.6-.4-1.4 0-1.4.7z', fill: 'currentColor' }]], 'sd-i-play'));
    playBtn.appendChild(icon([
      ['rect', { x: 6.4, y: 5, width: 3.8, height: 14, rx: 1.2, fill: 'currentColor' }],
      ['rect', { x: 13.8, y: 5, width: 3.8, height: 14, rx: 1.2, fill: 'currentColor' }]
    ], 'sd-i-pause'));
    var replayBtn = el('button', 'sd-btn sd-replay');
    replayBtn.type = 'button';
    replayBtn.setAttribute('aria-label', 'Replay animation');
    replayBtn.title = 'Replay animation';
    replayBtn.appendChild(icon([
      ['path', { d: 'M5 12a7 7 0 1 0 2.05-4.95', fill: 'none', stroke: 'currentColor', 'stroke-width': 2, 'stroke-linecap': 'round' }],
      ['path', { d: 'M5.2 4.4v3.5h3.5', fill: 'none', stroke: 'currentColor', 'stroke-width': 2, 'stroke-linecap': 'round', 'stroke-linejoin': 'round' }]
    ]));
    btns.appendChild(playBtn);
    btns.appendChild(replayBtn);
    bar.appendChild(btns);

    var stepper = el('ol', 'sd-stepper');
    stepper.setAttribute('aria-label', 'Stages');
    var stepBtns = [];
    for (i = 0; i < STAGES.length; i++) {
      var item = el('li');
      var b = el('button', 'sd-stepbtn');
      b.type = 'button';
      b.setAttribute('data-stage', String(i));
      var track = hidden(el('span', 'sd-track'));
      var fill = el('span', 'sd-fill');
      track.appendChild(fill);
      b.appendChild(track);
      b.appendChild(el('span', 'sd-steplabel', STAGES[i]));
      item.appendChild(b);
      stepper.appendChild(item);
      stepBtns.push({ btn: b, fill: fill, p: -1 });
    }
    bar.appendChild(stepper);
    root.appendChild(bar);

    var live = el('p', 'sr-only');
    live.setAttribute('aria-live', 'polite');
    root.appendChild(live);

    /* ---- engine: the visual state is a function of the time t ---- */
    var t = 0, playing = false, raf = 0, last = 0, stage = -1, mounted = false;
    var autoArmed = !reduced && staticStage === null;
    var loopLen = 52.4, io = null, instantTimer = 0;

    function render(nt) {
      t = Math.max(0, Math.min(END, nt));
      for (var i = 0; i < items.length; i++) {
        var it = items[i];
        var on = t >= it.on && t < it.off;
        if (on !== it.state) {
          it.state = on;
          it.node.classList.toggle('is-on', on);
          if (it.aria) {
            if (on) it.node.removeAttribute('aria-hidden');
            else it.node.setAttribute('aria-hidden', 'true');
          }
        }
      }
      var pk = -1, pp = 0;
      for (var k = 0; k < T_Z.length; k++) {
        var s0 = T_Z[k] + PULSE_DELAY;
        if (t >= s0 && t < s0 + PULSE_DUR) { pk = k; pp = (t - s0) / PULSE_DUR; }
      }
      var shown = false;
      if (pk >= 0 && playing && !reduced) {
        try {
          var pt = loopPath.getPointAtLength(easeInOut(pp) * loopLen);
          dot.setAttribute('x', (pt.x - 4).toFixed(2));
          dot.setAttribute('y', (pt.y - 4).toFixed(2));
          dot.style.opacity = String(Math.max(0, Math.min(1, pp / 0.12, (1 - pp) / 0.12)));
          shown = true;
        } catch (e) { shown = false; }
      }
      if (!shown) dot.style.opacity = '0';
      var st = stageAt(t);
      if (st !== stage) {
        stage = st;
        root.setAttribute('data-stage', String(st));
        for (var j = 0; j < stepBtns.length; j++) {
          if (j === st) stepBtns[j].btn.setAttribute('aria-current', 'step');
          else stepBtns[j].btn.removeAttribute('aria-current');
        }
        if (mounted) live.textContent = ANNOUNCE[st];
      }
      for (var n = 0; n < stepBtns.length; n++) {
        var a = START[n], z = n + 1 < START.length ? START[n + 1] : END;
        var p = t <= a ? 0 : t >= z ? 1 : (t - a) / (z - a);
        p = Math.round(p * 1000) / 1000;
        if (p !== stepBtns[n].p) {
          stepBtns[n].p = p;
          stepBtns[n].fill.style.transform = 'scaleX(' + p + ')';
        }
      }
    }

    function seek(nt, instant) {
      if (instant || reduced) {
        root.classList.add('sd-instant');
        render(nt);
        void root.offsetWidth;
        clearTimeout(instantTimer);
        instantTimer = setTimeout(function () { root.classList.remove('sd-instant'); }, 50);
      } else {
        render(nt);
      }
    }

    function syncControls() {
      root.classList.toggle('is-playing', playing);
      var label = playing ? 'Pause animation' : 'Play animation';
      playBtn.setAttribute('aria-label', label);
      playBtn.title = label;
    }

    function frame(now) {
      raf = 0;
      if (!playing) return;
      if (last) render(t + Math.min(0.1, Math.max(0, (now - last) / 1000)));
      last = now;
      if (t >= END) {
        playing = false;
        render(t);
        syncControls();
        return;
      }
      raf = window.requestAnimationFrame(frame);
    }

    function disarm() {
      autoArmed = false;
      if (io) { io.disconnect(); io = null; }
    }

    function play() {
      disarm();
      if (playing) return;
      if (t >= END - 1e-6) seek(0, false);
      playing = true;
      last = 0;
      if (t === 0 && live.textContent !== ANNOUNCE[0]) live.textContent = ANNOUNCE[0];
      syncControls();
      raf = window.requestAnimationFrame(frame);
    }

    function pause() {
      disarm();
      if (!playing) return;
      playing = false;
      if (raf) window.cancelAnimationFrame(raf);
      raf = 0;
      render(t);
      syncControls();
    }

    function go(i) {
      disarm();
      i = clampStage(i);
      if (playing) { seek(START[i], false); last = 0; }
      else seek(settled(i), false);
    }

    function replay() {
      var was = playing;
      pause();
      seek(0, was ? false : reduced);
      play();
    }

    playBtn.addEventListener('click', function () { if (playing) pause(); else play(); });
    replayBtn.addEventListener('click', replay);
    stepBtns.forEach(function (s, idx) {
      s.btn.addEventListener('click', function () { go(idx); });
    });

    var api = {
      go: function (i) { go(i); return api.state(); },
      play: function () { play(); return api.state(); },
      pause: function () { pause(); return api.state(); },
      state: function () {
        return {
          stage: stage,
          stageName: STAGES[stage],
          playing: playing,
          time: Math.round(t * 1000) / 1000,
          duration: END,
          ended: t >= END,
          reducedMotion: reduced,
          staticStage: staticStage
        };
      }
    };

    function init() {
      try { loopLen = loopPath.getTotalLength() || loopLen; } catch (e) { /* keep the computed length */ }
      if (staticStage !== null) seek(settled(staticStage), true);
      else if (reduced) seek(settled(STAGES.length - 1), true);
      else seek(0, true);
      syncControls();
      mounted = true;

      if (mq) {
        var onChange = function () {
          reduced = mq.matches;
          if (reduced) {
            disarm();
            if (playing) pause();
            seek(settled(STAGES.length - 1), true);
          }
        };
        if (mq.addEventListener) mq.addEventListener('change', onChange);
        else if (mq.addListener) mq.addListener(onChange);
      }

      if (autoArmed) {
        if ('IntersectionObserver' in window) {
          io = new IntersectionObserver(function (entries) {
            for (var i = 0; i < entries.length; i++) {
              var e = entries[i];
              var tallEnough = e.rootBounds && e.intersectionRect.height >= 0.4 * e.rootBounds.height;
              if (e.isIntersecting && (e.intersectionRatio >= 0.4 || tallEnough)) {
                if (autoArmed) play();
                return;
              }
            }
          }, { threshold: [0, 0.2, 0.4, 0.6, 0.8, 1] });
          io.observe(root);
        } else {
          play();
        }
      }
    }

    return { root: root, api: api, init: init };
  }

  var fallback = fig.querySelector('.demo-fallback');
  var built = null;
  try {
    built = build();
    fig.appendChild(built.root);
    built.init();
    if (fallback && fallback.parentNode) fallback.parentNode.removeChild(fallback);
    fig.classList.add('sd-ready');
    window.__simcotDemo = built.api;
  } catch (err) {
    if (built && built.root && built.root.parentNode) built.root.parentNode.removeChild(built.root);
    fig.classList.remove('sd-ready');
  }
})();
