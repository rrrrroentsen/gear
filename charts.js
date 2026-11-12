/* 我的装备 · charts.js
 * 手写的 SVG 图：
 *   dive —— 单件装备的「跳水图」：日均随持有天数下降的曲线，今天在哪、回本线在哪、往后会到哪
 * 另外带一个日历时间轴的刻度函数 calTicks，时间线页的服役条在用。
 * 颜色全部走 CSS 变量（见 styles.css 里的 .ch-*），换主题不用重画。
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(require('./core.js'));
  else root.MGCharts = factory(root.MGCore);
})(typeof self !== 'undefined' ? self : this, function (C) {
  'use strict';

  var uid = 0;
  var SVGNS = 'http://www.w3.org/2000/svg';

  /* ------------------------------------------------------------------ 小工具 */

  function f1(n) { return String(Math.round(n * 10) / 10); }

  function esc(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  /** 粗略估计一段文字画出来有多宽（中文按整字宽，数字字母按半字多一点）。只用来避让标签。 */
  function textW(str, size) {
    var w = 0;
    for (var ch of String(str)) {
      var code = ch.codePointAt(0);
      if (code > 0x2e7f) w += 1;
      else if (ch === ' ') w += 0.28;
      else if (ch === '.' || ch === ',' || ch === ':' || ch === '·') w += 0.27;
      else w += 0.54;
    }
    return w * size;
  }

  /** 线性轴的刻度间隔：从 1-2-5 序列里挑，让刻度数落在 3 到 5 之间。 */
  function niceStep(max) {
    if (!(max > 0)) return 1;
    var e = Math.floor(Math.log10(max)), cands = [];
    for (var k = e + 1; k >= e - 2; k--) [5, 2, 1].forEach(function (m) { cands.push(m * Math.pow(10, k)); });
    for (var i = 0; i < cands.length; i++) if (max / cands[i] >= 3) return cands[i];
    return cands[cands.length - 1];
  }

  /** 坐标轴上的金额。wan=true 时整根轴都用「万」（一根轴只用一种写法）；小于 1 的间隔带小数。 */
  function axisMoney(v, cur, step, wan) {
    if (wan) return cur + String(Math.round(v / 100) / 100) + '万';
    var dec = step < 1 ? Math.min(3, Math.max(0, -Math.floor(Math.log10(step) + 1e-9))) : 0;
    return cur + C.fmtNum(v, dec);
  }

  /** 从 from 到 to 的取样点：前面逐天，后面间隔慢慢拉大；成本台阶的前后一天一定取到。 */
  function sampleTs(from, to, steps) {
    var seen = {}, out = [], t = from;
    function add(v) { if (v >= from && v <= to && !seen[v]) { seen[v] = 1; out.push(v); } }
    while (t < to) { add(t); t = Math.max(t + 1, Math.round(t * 1.03)); }
    add(to);
    for (var i = 1; i < steps.length; i++) { add(steps[i].t - 1); add(steps[i].t); }
    out.sort(function (a, b) { return a - b; });
    return out;
  }

  function pathOf(pts) {
    var d = '';
    for (var i = 0; i < pts.length; i++) d += (i ? 'L' : 'M') + f1(pts[i][0]) + ' ' + f1(pts[i][1]);
    return d;
  }

  function reducedMotion() {
    try { return typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches; }
    catch (e) { return false; }
  }

  function ease(p) { return 1 - Math.pow(1 - p, 3); }

  /* ------------------------------------------------------------------ 跳水图：几何 */

  /** 持有时间轴的刻度：短的按天，长的按年。 */
  function spanTicks(H) {
    var out = [], i;
    if (H <= 130) { for (i = 30; i < H; i += 30) out.push({ t: i, label: i + ' 天' }); return out; }
    if (H <= 420) { for (i = 100; i < H; i += 100) out.push({ t: i, label: i + ' 天' }); return out; }
    if (H <= 800) {
      for (i = 1; i * 182.625 < H; i++) out.push({ t: Math.round(i * 182.625) + 1, label: i % 2 ? (i === 1 ? '半年' : ((i - 1) / 2) + ' 年半') : (i / 2) + ' 年' });
      return out;
    }
    var years = H / 365.25, stepY = years <= 6.5 ? 1 : years <= 13 ? 2 : years <= 32 ? 5 : 10;
    for (i = stepY; i * 365.25 < H; i += stepY) out.push({ t: Math.round(i * 365.25) + 1, label: i + ' 年' });
    return out;
  }

  /**
   * 算出跳水图要画的一切（不碰 DOM，方便测试）。
   * 纵轴是线性的，但只画到「前 1/8 时间那天的日均」为止：再往上的陡坡出框，这样今天附近看得清。
   */
  function diveGeom(asset, today, settings, W, Hpx) {
    var c = C.calc(asset, today, settings), steps = C.costSteps(asset);
    var T = c.days, live = c.active;
    var hasGoal = asset.status !== 'sold' && c.cost > 0;
    var goalInView = hasGoal && (c.targetDays <= Math.max(T * 4, 400));
    var Hd = live
      ? Math.max(Math.ceil(T * 1.5), 90, goalInView ? Math.ceil(c.targetDays * 1.12) : 0)
      : Math.max(Math.ceil(T * 1.08), T + 3, 30);
    function daily(t) { return C.costAt(steps, t) / t; }
    var vT = daily(T), tClip = Math.max(1, Hd / 8);
    var yMax = Math.max(C.costAt(steps, Math.ceil(tClip)) / tClip, vT * 1.3, goalInView ? c.targetDaily * 1.25 : 0);
    if (!(yMax > 0)) yMax = 1;

    var px0 = 6, px1 = W - 46, py0 = 28, py1 = Hpx - 24;
    function x(t) { return px0 + (t - 1) / (Hd - 1) * (px1 - px0); }
    function y(v) { return py1 - v / yMax * (py1 - py0); }
    function tAt(px) { return Math.max(1, Math.min(Hd, Math.round(1 + (px - px0) / (px1 - px0) * (Hd - 1)))); }

    var solid = sampleTs(1, T, steps).map(function (t) { return [x(t), y(daily(t))]; });
    var proj = live ? sampleTs(T, Hd, steps).map(function (t) { return [x(t), y(daily(t))]; }) : [];

    var step = niceStep(yMax), ticksY = [];
    for (var v = step; v < yMax * 0.985; v += step) ticksY.push({ v: v, y: y(v) });

    var marks = { today: { t: T, x: x(T), y: y(vT), v: vT }, goal: null, extras: [], sold: null };
    if (hasGoal && c.targetDaily <= yMax * 0.96 && (goalInView || !live)) {
      marks.goal = { t: c.targetDays, x: x(c.targetDays), y: y(c.targetDaily), v: c.targetDaily, reached: c.reached,
        dot: c.targetDays <= Hd && Math.abs(x(c.targetDays) - x(T)) > 13 };
    }
    for (var i = 1; i < steps.length; i++) {
      if (steps[i].t <= Hd) marks.extras.push({ t: steps[i].t, x: x(steps[i].t), y: y(daily(steps[i].t)), amt: C.round2(steps[i].c - steps[i - 1].c) });
    }
    if (asset.status === 'sold' && !live) {
      marks.sold = { t: T, x: x(T), y: y(Math.max(0, c.netDaily)), v: c.netDaily };
    }
    var tTop = steps[0].c / yMax;          // 第一段曲线从上边框进来的位置（可能小于 1：那就是从第 1 天就在框里）
    return {
      W: W, H: Hpx, px0: px0, px1: px1, py0: py0, py1: py1, T: T, Hd: Hd, yMax: yMax, step: step, c: c, steps: steps,
      live: live, x: x, y: y, tAt: tAt, daily: daily, solid: solid, proj: proj, ticksY: ticksY, ticksX: spanTicks(Hd),
      marks: marks, tTop: tTop, offTop: daily(1) > yMax
    };
  }

  /* ------------------------------------------------------------------ 跳水图：绘制 */

  /**
   * 在 host 里画一件装备的跳水图。
   * opts: { cur, animate, onFrame(value), onDone() }
   * 返回 { destroy(), geom }
   */
  function dive(host, asset, today, settings, opts) {
    opts = opts || {};
    var cur = opts.cur || '¥';
    var W = Math.max(260, Math.round(host.clientWidth || 340)), Hpx = opts.height || 230;
    var g = diveGeom(asset, today, settings, W, Hpx), c = g.c, id = 'dv' + (++uid);
    var buy = asset.buy, m = g.marks;
    var s = '';

    s += '<svg class="ch ch-dive" viewBox="0 0 ' + W + ' ' + Hpx + '" width="' + W + '" height="' + Hpx + '" role="img" aria-label="' +
      esc(asset.name + ' 的日均下降曲线：第 ' + g.T + ' 天，日均 ' + C.fmtDaily(m.today.v, cur)) + '">';
    s += '<defs><clipPath id="' + id + 'p"><rect x="' + g.px0 + '" y="' + (g.py0 - 4) + '" width="' + (g.px1 - g.px0 + 2) + '" height="' + (g.py1 - g.py0 + 4) + '"/></clipPath>' +
      '<clipPath id="' + id + 'r"><rect class="ch-reveal" x="' + g.px0 + '" y="0" width="' + (g.px1 - g.px0 + 2) + '" height="' + Hpx + '"/></clipPath></defs>';

    // 网格和纵轴刻度（刻度写在右边，左边留给陡坡）
    var wan = g.ticksY.length > 0 && g.ticksY[g.ticksY.length - 1].v >= 10000;
    g.ticksY.forEach(function (tk) {
      s += '<line class="ch-grid" x1="' + g.px0 + '" x2="' + g.px1 + '" y1="' + f1(tk.y) + '" y2="' + f1(tk.y) + '"/>' +
        '<text class="ch-tick" x="' + (g.px1 + 6) + '" y="' + f1(tk.y + 3.5) + '">' + esc(axisMoney(tk.v, cur, g.step, wan)) + '</text>';
    });

    // 回本线
    if (m.goal) {
      s += '<line class="ch-goal' + (m.goal.reached ? ' is-done' : '') + '" x1="' + g.px0 + '" x2="' + g.px1 + '" y1="' + f1(m.goal.y) + '" y2="' + f1(m.goal.y) + '"/>';
    }

    // 曲线：已经走过的是实线加底色，往后的是虚线
    var area = pathOf(g.solid) + 'L' + f1(m.today.x) + ' ' + g.py1 + 'L' + f1(g.solid[0][0]) + ' ' + g.py1 + 'Z';
    s += '<g clip-path="url(#' + id + 'p)"><g clip-path="url(#' + id + 'r)">' +
      '<path class="ch-wash" d="' + area + '"/><path class="ch-line" d="' + pathOf(g.solid) + '"/></g>';
    if (g.proj.length > 1) s += '<path class="ch-proj" d="' + pathOf(g.proj) + '"/>';
    s += '</g>';

    // 横轴
    s += '<line class="ch-axis" x1="' + g.px0 + '" x2="' + g.px1 + '" y1="' + g.py1 + '" y2="' + g.py1 + '"/>';
    g.ticksX.forEach(function (tk) {
      var tx = g.x(tk.t);
      if (tx > g.px1 - 8) return;
      s += '<line class="ch-axis" x1="' + f1(tx) + '" x2="' + f1(tx) + '" y1="' + g.py1 + '" y2="' + (g.py1 + 4) + '"/>' +
        '<text class="ch-tick" text-anchor="middle" x="' + f1(tx) + '" y="' + (g.py1 + 17) + '">' + esc(tk.label) + '</text>';
    });
    s += '<text class="ch-tick" x="' + g.px0 + '" y="' + (g.py1 + 17) + '">购入</text>';

    // 标签的避让：先摆「今天」的标签，其他的躲开它
    var boxes = [];
    function hit(b) {
      for (var i = 0; i < boxes.length; i++) {
        var o = boxes[i];
        if (b.x < o.x + o.w + 4 && b.x + b.w + 4 > o.x && b.y < o.y + o.h + 3 && b.y + b.h + 3 > o.y) return true;
      }
      return false;
    }

    var tagText = (asset.status === 'retired' && !g.live) ? '退役时 ' : (asset.status === 'sold' && !g.live) ? '卖出时 ' : c.future ? '购入日 ' : '今天 ';
    tagText += C.fmtDaily(m.today.v, cur);
    var tagW = textW(tagText, 12) + 14, tagH = 22;
    var tagX = Math.min(g.px1 - tagW, Math.max(g.px0, m.today.x - 9)), tagY = m.today.y - 11 - tagH;
    if (tagY < 2) { tagY = Math.max(2, m.today.y - tagH / 2); tagX = Math.min(g.px1 - tagW, m.today.x + 12); }
    boxes.push({ x: tagX, y: tagY, w: tagW, h: tagH });
    boxes.push({ x: m.today.x - 7, y: m.today.y - 7, w: 14, h: 14 });

    var soldTag = null;
    if (m.sold) {
      var st = '回血后 ' + C.fmtDaily(m.sold.v, cur), sw = textW(st, 11) + 12;
      soldTag = { text: st, w: sw, x: Math.max(g.px0, m.sold.x - sw - 10), y: Math.min(g.py1 - 20, Math.max(m.sold.y - 9, tagY + tagH + 4)) };
      boxes.push({ x: soldTag.x, y: soldTag.y, w: sw, h: 18 });
    }

    if (m.goal) {
      var gl = (m.goal.reached ? '已过回本线 ' : !g.live ? '没到回本线 ' : '回本线 ') + C.fmtDaily(m.goal.v, cur), glW = textW(gl, 11);
      var gb = { x: g.px0 + 5, y: m.goal.y - 16, w: glW, h: 12 };
      if (hit(gb)) gb.x = g.px1 - glW - 4;
      if (hit(gb)) gb.y = m.goal.y + 5;
      boxes.push(gb);
      if (m.goal.dot) boxes.push({ x: m.goal.x - 8, y: m.goal.y - 8, w: 16, h: 16 });
      s += '<text class="ch-lab" x="' + f1(gb.x) + '" y="' + f1(gb.y + 10) + '">' + esc(gl) + '</text>';
    }

    if (g.offTop) {
      var note = '第 1 天 ' + C.fmtMoney(g.steps[0].c, cur), nx = Math.max(g.px0 + 4, g.x(Math.max(1, g.tTop)) + 9);
      var nb = { x: nx, y: g.py0 - 1, w: textW(note, 11) + 12, h: 12 };
      if (!hit(nb) && nb.x + nb.w < g.px1) {
        boxes.push(nb);
        s += '<path class="ch-arrow" d="M' + f1(nx + 3.5) + ' ' + (g.py0 + 9) + 'v-8m-3 3l3 -3l3 3"/>' +
          '<text class="ch-lab" x="' + f1(nx + 11) + '" y="' + (g.py0 + 9) + '">' + esc(note) + '</text>';
      }
    }

    if (g.proj.length > 1) {
      var endV = g.daily(g.Hd), et = C.fmtDaily(endV, cur), eb = { x: g.px1 - textW(et, 11) - 3, y: g.y(endV) - 18, w: textW(et, 11), h: 12 };
      var onGoalLine = m.goal && m.goal.y > eb.y - 3 && m.goal.y < eb.y + eb.h + 3;
      if (!onGoalLine && !hit(eb)) { boxes.push(eb); s += '<text class="ch-lab" x="' + f1(eb.x) + '" y="' + f1(eb.y + 10) + '">' + esc(et) + '</text>'; }
    }

    // 追加花费的跳点
    m.extras.forEach(function (e) {
      if (e.y < g.py0 + 6) return;
      s += '<circle class="ch-extra" cx="' + f1(e.x) + '" cy="' + f1(e.y) + '" r="3.5"/>';
    });

    // 回本点
    if (m.goal && m.goal.dot) {
      s += '<circle class="ch-goaldot' + (m.goal.reached ? ' is-done' : '') + '" cx="' + f1(m.goal.x) + '" cy="' + f1(m.goal.y) + '" r="4.5"/>';
    }

    // 卖出后的回血
    if (soldTag) {
      s += '<line class="ch-drop" x1="' + f1(m.sold.x) + '" x2="' + f1(m.sold.x) + '" y1="' + f1(m.today.y) + '" y2="' + f1(m.sold.y) + '"/>' +
        '<circle class="ch-solddot" cx="' + f1(m.sold.x) + '" cy="' + f1(m.sold.y) + '" r="5"/>' +
        '<g class="ch-tag2"><rect x="' + f1(soldTag.x) + '" y="' + f1(soldTag.y) + '" width="' + f1(soldTag.w) + '" height="18" rx="4"/>' +
        '<text x="' + f1(soldTag.x + 6) + '" y="' + f1(soldTag.y + 13) + '">' + esc(soldTag.text) + '</text></g>';
    }

    // 今天的点和标签
    s += '<g class="ch-now">';
    s += '<line class="ch-lead" x1="' + f1(m.today.x) + '" y1="' + f1(m.today.y) + '" x2="' + f1(Math.min(tagX + tagW - 6, Math.max(tagX + 6, m.today.x))) + '" y2="' + f1(Math.min(m.today.y, tagY + tagH)) + '"/>';
    s += '<g class="ch-tag"><rect x="' + f1(tagX) + '" y="' + f1(tagY) + '" width="' + f1(tagW) + '" height="' + tagH + '" rx="5"/>' +
      '<text x="' + f1(tagX + 7) + '" y="' + f1(tagY + 15.5) + '">' + esc(tagText) + '</text></g></g>';
    s += '<circle class="ch-dot ch-diver" cx="' + f1(m.today.x) + '" cy="' + f1(m.today.y) + '" r="5.5"/>';

    // 手指 / 鼠标拖动查看
    s += '<g class="ch-scrub" visibility="hidden"><line class="ch-cross" y1="' + g.py0 + '" y2="' + g.py1 + '"/><circle class="ch-crossdot" r="5"/></g>' +
      '<rect class="ch-hit" x="0" y="0" width="' + W + '" height="' + Hpx + '" tabindex="0" aria-label="拖动查看每一天的日均"/>';
    s += '</svg><div class="ch-tip" role="status" hidden></div>';

    host.innerHTML = s;
    host.classList.add('ch-host');

    var svg = host.querySelector('svg'), tip = host.querySelector('.ch-tip'), scrub = host.querySelector('.ch-scrub');
    var cross = host.querySelector('.ch-cross'), cdot = host.querySelector('.ch-crossdot'), hitEl = host.querySelector('.ch-hit');
    var kbT = null, raf = 0, alive = true;

    function show(t) {
      var v = g.daily(t), px = g.x(t), py = Math.max(g.py0 - 3, g.y(v));
      scrub.setAttribute('visibility', 'visible');
      cross.setAttribute('x1', f1(px)); cross.setAttribute('x2', f1(px));
      cdot.setAttribute('cx', f1(px)); cdot.setAttribute('cy', f1(py));
      tip.textContent = '';
      var b = document.createElement('b'), sp = document.createElement('span');
      b.textContent = C.fmtDaily(v, cur);
      sp.textContent = '第 ' + C.fmtNum(t) + ' 天 · ' + C.addDays(buy, t - 1) + (t > g.T && g.live ? ' · 预计' : '');
      tip.appendChild(b); tip.appendChild(sp);
      tip.hidden = false;
      var tw = tip.offsetWidth || 150, left = Math.min(W - tw - 2, Math.max(2, px - tw / 2));
      tip.style.left = left + 'px';
      tip.style.top = (py > g.py0 + 60 ? Math.max(0, py - 58) : Math.min(Hpx - 50, py + 14)) + 'px';
    }
    function hide() { scrub.setAttribute('visibility', 'hidden'); tip.hidden = true; kbT = null; }
    function fromEvent(ev) {
      var r = svg.getBoundingClientRect();
      return g.tAt((ev.clientX - r.left) * (W / (r.width || W)));
    }
    hitEl.addEventListener('pointerdown', function (ev) { show(kbT = fromEvent(ev)); });
    hitEl.addEventListener('pointermove', function (ev) {
      if (ev.pointerType === 'mouse' || ev.buttons || ev.pressure > 0) show(kbT = fromEvent(ev));
    });
    hitEl.addEventListener('pointerleave', function (ev) { if (ev.pointerType === 'mouse') hide(); });
    hitEl.addEventListener('pointerup', function (ev) { if (ev.pointerType !== 'mouse') setTimeout(function () { if (alive) hide(); }, 1600); });
    hitEl.addEventListener('pointercancel', hide);
    hitEl.addEventListener('blur', hide);
    hitEl.addEventListener('keydown', function (ev) {
      var k = ev.key, stepT = Math.max(1, Math.round(g.Hd / 60));
      if (k === 'ArrowLeft' || k === 'ArrowRight') {
        kbT = Math.max(1, Math.min(g.Hd, (kbT == null ? g.T : kbT) + (k === 'ArrowRight' ? stepT : -stepT)));
        show(kbT); ev.preventDefault();
      } else if (k === 'Home') { show(kbT = 1); ev.preventDefault(); }
      else if (k === 'End') { show(kbT = g.Hd); ev.preventDefault(); }
      else if (k === 'Escape') hide();
    });

    // 入场动画：线从左往右画出来，圆点沿着曲线落到今天的位置，数字跟着往下掉
    var reveal = host.querySelector('.ch-reveal'), diver = host.querySelector('.ch-diver'), now = host.querySelector('.ch-now');
    var projEl = host.querySelector('.ch-proj');
    function settle() {
      reveal.setAttribute('width', g.px1 - g.px0 + 2);
      diver.setAttribute('cx', f1(m.today.x)); diver.setAttribute('cy', f1(m.today.y));
      now.style.opacity = ''; if (projEl) projEl.style.opacity = '';
      if (opts.onFrame) opts.onFrame(m.today.v, true);
      if (opts.onDone) opts.onDone();
    }
    if (opts.animate && !reducedMotion() && typeof requestAnimationFrame === 'function' && m.today.x - g.px0 > 12) {
      var t0 = 0, dur = 950, span = m.today.x - g.px0;
      now.style.opacity = '0'; if (projEl) projEl.style.opacity = '0';
      reveal.setAttribute('width', '0');
      var tick = function (ts) {
        if (!alive) return;
        if (!t0) t0 = ts;
        var p = Math.min(1, (ts - t0) / dur), px = g.px0 + span * ease(p);
        var t = Math.max(1, 1 + (px - g.px0) / (g.px1 - g.px0) * (g.Hd - 1)), v = C.costAt(g.steps, Math.floor(t)) / t;
        reveal.setAttribute('width', f1(px - g.px0 + 1));
        diver.setAttribute('cx', f1(px)); diver.setAttribute('cy', f1(Math.max(g.py0 - 3, g.y(v))));
        if (opts.onFrame) opts.onFrame(v, false);
        if (p < 1) raf = requestAnimationFrame(tick); else settle();
      };
      raf = requestAnimationFrame(tick);
    } else if (opts.onFrame) {
      opts.onFrame(m.today.v, true);
    }

    return {
      geom: g,
      destroy: function () { alive = false; if (raf && typeof cancelAnimationFrame === 'function') cancelAnimationFrame(raf); host.innerHTML = ''; }
    };
  }

  /* ------------------------------------------------------------------ 日历时间轴（时间线页的服役条用） */

  /** 日历时间轴的刻度：跨度长按年，短按月。 */
  function calTicks(d0, d1) {
    var out = [], a = C.dayStr(d0).split('-').map(Number), span = d1 - d0;
    var y = a[0], mo = a[1], stepM = span > 2600 ? 24 : span > 900 ? 12 : span > 420 ? 6 : span > 200 ? 3 : span > 70 ? 1 : 0;
    if (!stepM) return out;
    // 从对齐到 stepM 的下一个月初开始
    mo += 1; if (mo > 12) { mo = 1; y++; }
    while ((mo - 1) % Math.min(stepM, 12) !== 0 || (stepM === 24 && y % 2)) { mo++; if (mo > 12) { mo = 1; y++; } }
    for (var guard = 0; guard < 400; guard++) {
      var d = C.dayNum(y + '-' + (mo < 10 ? '0' : '') + mo + '-01');
      if (d > d1) break;
      out.push({ d: d, label: mo === 1 ? String(y) : mo + '月', year: mo === 1 });
      mo += stepM; while (mo > 12) { mo -= 12; y++; }
    }
    return out;
  }

  return {
    dive: dive, diveGeom: diveGeom,
    niceStep: niceStep, axisMoney: axisMoney, sampleTs: sampleTs, spanTicks: spanTicks, calTicks: calTicks,
    textW: textW
  };
});
