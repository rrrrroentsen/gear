/* 我的装备 · app.js
 * 界面：页面、表单、点击处理。计算在 core.js，图表在 charts.js。
 * 这个文件由 dev/build.js 从 src/ 里的几段拼成（10-base.js、20-views.js、30-sheets.js、35-reorder.js、40-actions.js）。
 */
(function () {
'use strict';

/* ====================================================================== 基础：环境、工具、存储、状态 */

var C = window.MGCore, Charts = window.MGCharts;
var doc = document, rootEl = doc.documentElement;
var ENV = window.MYGEAR_ENV || {};            // 预览版会带 {preview: true, seed: {...}}
var LS_STATE = 'mygear:v1:state', LS_STASH = 'mygear:v1:stash', LS_BROKEN = 'mygear:v1:broken';

function $(sel, el) { return (el || doc).querySelector(sel); }
function $$(sel, el) { return [].slice.call((el || doc).querySelectorAll(sel)); }

function esc(s) {
  return String(s == null ? '' : s).replace(/[&<>"'`]/g, function (c) {
    return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;', '`': '&#96;' }[c];
  });
}

/* ---------- 图标（24×24，描边） ---------- */

var ICONS = {
  tag: '<path d="M3.5 12.2V5.5a2 2 0 0 1 2-2h6.7a2 2 0 0 1 1.4.6l6.8 6.8a2 2 0 0 1 0 2.8l-6.7 6.7a2 2 0 0 1-2.8 0l-6.8-6.8a2 2 0 0 1-.6-1.4z"/><circle cx="8" cy="8" r="1.3" fill="currentColor" stroke="none"/>',
  dive: '<path d="M4 4v16h16"/><path d="M7.5 5.5c.8 6.5 4 9.6 11.5 10.5"/>',
  time: '<path d="M4 6.5h9M8.5 12h11.5M4 17.5h6.5" stroke-width="3"/>',
  star: '<path d="M12 3.6l2.5 5.2 5.7.8-4.1 4 1 5.7-5.1-2.7-5.1 2.7 1-5.7-4.1-4 5.7-.8z"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  prefs: '<path d="M4 7h9M19 7h1M4 17h1M11 17h9"/><circle cx="16" cy="7" r="2.5"/><circle cx="8" cy="17" r="2.5"/>',
  back: '<path d="M14.5 5l-7 7 7 7"/>',
  right: '<path d="M9.5 5l7 7-7 7"/>',
  down: '<path d="M5 9.5l7 7 7-7"/>',
  list: '<path d="M9 6.5h11M9 12h11M9 17.5h11"/><path d="M4.5 6.5h.01M4.5 12h.01M4.5 17.5h.01" stroke-width="2.6"/>',
  wall: '<path d="M5 4h14a1 1 0 0 1 1 1v8.5L13.5 20H5a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1z"/><path d="M20 13.5h-4.5a2 2 0 0 0-2 2V20"/>',
  edit: '<path d="M4.5 19.5h3.8L19 8.8 15.2 5 4.5 15.7z"/><path d="M13.2 7l3.8 3.8"/>',
  trash: '<path d="M5 7h14M10 7V4.5h4V7M7 7l.9 12.5h8.2L17 7"/>',
  check: '<path d="M5 12.5l4.5 4.5L19 7.5"/>',
  x: '<path d="M6.5 6.5l11 11M17.5 6.5l-11 11"/>',
  share: '<path d="M12 15V4M8 7.5l4-4 4 4M5 12v7.5h14V12"/>',
  copy: '<path d="M9 9h10.5v11.5H9z"/><path d="M5 15V4h10"/>',
  link: '<path d="M14 5h5v5M19 5l-8.5 8.5M11 7H6v11h11v-5"/>',
  box: '<path d="M4.5 8.5h15v11h-15zM3.5 5h17v3.5h-17zM10 12.5h4"/>',
  sell: '<path d="M6 18L18 6M9.5 6H18v8.5"/>',
  undo: '<path d="M8 5L4 9l4 4"/><path d="M4 9h9.5a5.5 5.5 0 0 1 0 11H9"/>',
  file: '<path d="M7 3.5h7l4 4v13H7z"/><path d="M14 3.5v4h4"/>',
  paste: '<path d="M9 4.5h6v3H9zM9 6H6v14.5h12V6h-3"/>',
  info: '<circle cx="12" cy="12" r="8.5"/><path d="M12 11v5.5M12 7.8h.01" stroke-width="2"/>',
  cam: '<path d="M4 8h3.5l1.5-2.5h6L16.5 8H20v11H4z"/><circle cx="12" cy="13.2" r="3.4"/>',
  sort: '<path d="M7 5v14M7 19l-3-3M7 19l3-3M17 19V5M17 5l-3 3M17 5l3 3"/>',
  grip: '<path d="M6 8h12M6 12h12M6 16h12"/>',
  flag: '<path d="M6 21V4.5M6 4.5h11.5l-2.2 3.7 2.2 3.8H6"/>'
};

function ic(name, cls) {
  return '<svg class="ic' + (cls ? ' ' + cls : '') + '" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">' + ICONS[name] + '</svg>';
}

var CAT_CHOICES = ['手机', '平板', '笔记本', '电脑主机', '显示器', '掌机', '游戏机', '手表', '耳机', '相机', '外设', '游戏外设', '音箱', '智能家居', '汽车', '其他'];

/* ---------- 存储：localStorage 不可用时（无痕模式等）退到内存里，页面照常能用 ---------- */

var store = (function () {
  var ok = true, mem = {};
  return {
    get: function (k) { try { var v = localStorage.getItem(k); return v == null ? (mem[k] || null) : v; } catch (e) { ok = false; return mem[k] || null; } },
    set: function (k, v) { try { localStorage.setItem(k, v); ok = true; return true; } catch (e) { ok = false; mem[k] = v; return false; } },
    del: function (k) { delete mem[k]; try { localStorage.removeItem(k); } catch (e) { ok = false; } },
    ok: function () { return ok; },
    probe: function () { try { localStorage.setItem('mygear:probe', '1'); localStorage.removeItem('mygear:probe'); ok = true; } catch (e) { ok = false; } return ok; }
  };
})();

/* ---------- 状态 ---------- */

var S;                      // 当前数据（始终是 sanitizeState 清洗过的）
var notice = null;          // 启动时要告诉用户的事（比如存储里的数据读不出来）

function loadState() {
  var raw = store.get(LS_STATE), st = null;
  if (raw) {
    try { st = C.sanitizeState(JSON.parse(raw)).state; }
    catch (e) { store.set(LS_BROKEN, raw); notice = '上次保存的数据读不出来，已另存一份。可以从备份恢复。'; st = null; }
  }
  if (!st) {
    st = C.emptyState();
    if (ENV.seed) { try { st = C.sanitizeState(ENV.seed).state; } catch (e) { st = C.emptyState(); } }
  }
  return st;
}

function persist() {
  var okNow = store.set(LS_STATE, JSON.stringify(S));
  if (!okNow && !persist.warned) { persist.warned = true; toast('这个浏览器没让保存（可能是无痕模式），关掉页面后记录会丢。'); }
}

var undoSnap = null;

/**
 * 所有改动都从这里走：改完就存，然后重画。
 * opts.quiet: 不算进「备份后的改动次数」（排序、主题这类设置）
 * opts.undo:  提示文字；给了就弹出带「撤销」的提示条
 * opts.stay:  不重画（调用方自己处理）
 */
function mutate(fn, opts) {
  opts = opts || {};
  var before = opts.undo ? JSON.stringify(S) : null;
  fn(S);
  if (!opts.quiet) S.bk.n = (S.bk.n || 0) + 1;
  persist();
  if (!opts.stay) render();
  if (opts.undo) {
    undoSnap = before;
    toast(opts.undo, { label: '撤销', fn: function () {
      if (!undoSnap) return;
      S = C.sanitizeState(JSON.parse(undoSnap)).state; undoSnap = null;
      persist(); render(); toast('已撤销');
    } });
  }
}

function assetById(id) { for (var i = 0; i < S.assets.length; i++) if (S.assets[i].id === id) return S.assets[i]; return null; }
function wishById(id) { for (var i = 0; i < S.wishes.length; i++) if (S.wishes[i].id === id) return S.wishes[i]; return null; }

/* ---------- 今天 ---------- */

var todayCache = C.todayStr();
function today() { return todayCache; }
function refreshToday() {
  var t = C.todayStr();
  if (t !== todayCache) { todayCache = t; return true; }
  return false;
}

/* ---------- 显示用的小函数 ---------- */

function cur() { return S.settings.cur; }

/** 金额的价签排法：货币符号小、整数大、小数小。dec: 'auto' | 位数。 */
function mHTML(v, dec, cls) {
  var p = C.moneyParts(v, dec == null ? 'auto' : dec);
  return '<span class="m' + (cls ? ' ' + cls : '') + '">' + (p.neg ? '-' : '') + '<i>' + esc(cur()) + '</i>' + p.int +
    (p.frac ? '<small>.' + p.frac + '</small>' : '') + '</span>';
}
function dailyHTML(v, cls) { return mHTML(v, C.dailyDec(v), cls); }
function mTxt(v, dec) { return C.fmtMoney(v, cur(), dec == null ? 'auto' : dec); }
function dTxt(v) { return C.fmtDaily(v, cur()); }
function n(v) { return C.fmtNum(v); }

function relDays(k) {
  if (k === 0) return '今天';
  if (k === 1) return '明天';
  if (k === -1) return '昨天';
  return k > 0 ? k + ' 天后' : (-k) + ' 天前';
}

function goalText(g) {
  if (g.t === 'days') {
    var y = g.v / 365;
    return '用满 ' + (Math.abs(y - Math.round(y)) < 0.01 ? Math.round(y) + ' 年' : n(g.v) + ' 天');
  }
  return '日均降到 ' + dTxt(g.v);
}

/* ---------- 类别颜色 ---------- */

var PRESET_NAMES = ['蓝', '橙', '青绿', '黄', '粉', '绿', '紫', '红'];

/** 存下来的颜色（p1…p8 或 #rrggbb）→ 能写进样式里的值。预设色走 CSS 变量，浅色、深色模式各有一套色值。 */
function edgeCss(color) {
  var c = C.cleanColor(color);
  return !c ? '' : c.charAt(0) === 'p' ? 'var(--cat-' + c.slice(1) + ')' : c;
}
function colorName(color) {
  var c = C.cleanColor(color);
  return !c ? '' : c.charAt(0) === 'p' ? PRESET_NAMES[+c.slice(1) - 1] : c.toUpperCase();
}
/** 一个小圆点：有颜色就是实心的，没颜色是空心的。 */
function catDot(color, cls) {
  var c = edgeCss(color);
  return '<i class="catdot' + (c ? ' has-c' : '') + (cls ? ' ' + cls : '') + '"' + (c ? ' style="--cc:' + esc(c) + '"' : '') + ' aria-hidden="true"></i>';
}

/** 类别的先后（「按类别」排序用）：自己建的在前，其余按件数。 */
function catNames() { return C.catList(S).map(function (r) { return r.name; }); }

function stickerHTML(a, cls) {
  var img = photoCache[a.id], edge = edgeCss(C.catColor(S, a.cat));
  var inner = (a.photo && img)
    ? '<img class="stk-img" alt="" draggable="false" src="' + esc(img) + '">'
    : '<span class="stk-e emoji">' + esc(a.icon || '📦') + '</span>';
  return '<span class="stk' + (cls ? ' ' + cls : '') + '" data-stk="' + esc(a.id) + '"' + (edge ? ' style="--edge:' + esc(edge) + '"' : '') + '>' + inner + '</span>';
}

/* ---------- 提示条 ---------- */

var toastTimer = 0;
function toast(msg, action, ms) {
  var el = $('#toast');
  if (!el) return;
  clearTimeout(toastTimer);
  el.innerHTML = '<span class="toast-msg"></span>' + (action ? '<button class="toast-btn" type="button"></button>' : '');
  $('.toast-msg', el).textContent = msg;
  if (action) {
    var b = $('.toast-btn', el);
    b.textContent = action.label;
    b.addEventListener('click', function () { el.classList.remove('is-on'); action.fn(); });
  }
  el.classList.add('is-on');
  toastTimer = setTimeout(function () { el.classList.remove('is-on'); }, ms || (action ? 6500 : 2600));
}

/* ---------- 主题 ---------- */

function applyTheme() {
  var s = S.settings;
  if (s.theme === 'light' || s.theme === 'dark') rootEl.setAttribute('data-theme', s.theme);
  else if (!ENV.preview) rootEl.removeAttribute('data-theme');     // 预览版里「跟随系统」交给外面的页面决定
  if (s.accent && s.accent !== 'yellow') rootEl.setAttribute('data-accent', s.accent); else rootEl.removeAttribute('data-accent');
  // 贴纸边框：粗细，和没有单独设颜色时用的颜色
  if (s.edge && s.edge !== 'normal') rootEl.setAttribute('data-edge', s.edge); else rootEl.removeAttribute('data-edge');
  var def = edgeCss(s.edgeColor);
  if (def) rootEl.style.setProperty('--edge-def', def); else rootEl.style.removeProperty('--edge-def');
}

/* ---------- 剪贴板和文件 ---------- */

function copyText(text) {
  function fallback() {
    var ta = doc.createElement('textarea');
    ta.value = text; ta.setAttribute('readonly', ''); ta.style.cssText = 'position:fixed;left:0;top:0;opacity:0;font-size:16px';
    doc.body.appendChild(ta); ta.focus(); ta.select(); ta.setSelectionRange(0, text.length);
    var ok = false; try { ok = doc.execCommand('copy'); } catch (e) { ok = false; }
    doc.body.removeChild(ta);
    return ok;
  }
  try {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      return navigator.clipboard.writeText(text).then(function () { return true; }, function () { return fallback(); });
    }
  } catch (e) { /* 往下走 */ }
  return Promise.resolve(fallback());
}

/* 预览版嵌在 Claude 的页面里，自己不能下载文件；如果外面的页面提供了「保存文件」的能力就用它，没有就只给复制 */
var hostDownloads = null;
function initHostDownloads() {
  try {
    if (!ENV.preview || !window.claude || typeof window.claude.use !== 'function') return;
    window.claude.use('downloads').then(function (d) {
      hostDownloads = d || null;
      if (hostDownloads && S && !sheets.length) render();
    }, function () { hostDownloads = null; });
  } catch (e) { hostDownloads = null; }
}

/** 把内容交给用户保存：手机上走系统的分享面板（可以存到「文件」），电脑上直接下载。 */
function saveFile(name, mime, text) {
  if (hostDownloads) {
    return hostDownloads.save({ filename: name, data: text }).then(function () { return 'saved'; }, function (e) {
      return (e && e.code === 'declined') ? 'cancelled' : 'failed';
    });
  }
  if (ENV.preview) return Promise.resolve('failed');
  var blob = new Blob([text], { type: mime });
  var phone = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
  var standalone = navigator.standalone === true;            // iPhone 主屏幕 App：直接下载会跳到一个回不来的预览页，只走分享
  try {
    if (!ENV.preview && phone && navigator.canShare) {
      var kinds = [mime, 'text/plain'];
      for (var i = 0; i < kinds.length; i++) {
        var file = new File([blob], name, { type: kinds[i] });
        if (navigator.canShare({ files: [file] })) {
          return navigator.share({ files: [file], title: name }).then(function () { return 'shared'; }, function (e) {
            return (e && e.name === 'AbortError') ? 'cancelled' : (standalone ? 'failed' : download());
          });
        }
      }
    }
  } catch (e) { /* 不支持分享文件，往下走 */ }
  if (standalone) return Promise.resolve('failed');
  return Promise.resolve(download());
  function download() {
    /*@plain-download*/
    try {
      var url = URL.createObjectURL(blob), a = doc.createElement('a');
      a.href = url; a.download = name; a.style.display = 'none';
      doc.body.appendChild(a); a.click();
      setTimeout(function () { doc.body.removeChild(a); URL.revokeObjectURL(url); }, 1500);
      return 'downloaded';
    } catch (e) { return 'failed'; }
    /*@end*/
  }
}

/* ---------- 照片贴纸（存在 IndexedDB 里，不占 localStorage 的地方；没有它也不影响别的功能） ---------- */

var photoCache = {};        // id → data URL（已校验）
var Photos = (function () {
  var dbp = null;
  function open() {
    if (dbp) return dbp;
    dbp = new Promise(function (resolve, reject) {
      try {
        var req = indexedDB.open('mygear', 1);
        req.onupgradeneeded = function () { req.result.createObjectStore('photos'); };
        req.onsuccess = function () { resolve(req.result); };
        req.onerror = function () { reject(req.error); };
        req.onblocked = function () { reject(new Error('blocked')); };
      } catch (e) { reject(e); }
    });
    dbp.catch(function () { dbp = null; });
    return dbp;
  }
  function tx(mode, fn) {
    return open().then(function (db) {
      return new Promise(function (resolve, reject) {
        var t = db.transaction('photos', mode), r = fn(t.objectStore('photos'));
        t.oncomplete = function () { resolve(r && r.result); };
        t.onerror = t.onabort = function () { reject(t.error); };
      });
    });
  }
  function valid(u) { return typeof u === 'string' && u.length < 900000 && /^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+\/]+=*$/.test(u); }
  return {
    valid: valid,
    get: function (id) { return tx('readonly', function (s) { return s.get(id); }).then(function (v) { return valid(v) ? v : null; }, function () { return null; }); },
    put: function (id, url) { if (!valid(url)) return Promise.reject(new Error('bad image')); return tx('readwrite', function (s) { return s.put(url, id); }); },
    del: function (id) { return tx('readwrite', function (s) { return s.delete(id); }).catch(function () {}); },
    all: function () {
      return open().then(function (db) {
        return new Promise(function (resolve) {
          var out = {}, req = db.transaction('photos', 'readonly').objectStore('photos').openCursor();
          req.onsuccess = function () { var c = req.result; if (c) { if (valid(c.value)) out[c.key] = c.value; c.continue(); } else resolve(out); };
          req.onerror = function () { resolve(out); };
        });
      }).catch(function () { return {}; });
    }
  };
})();

function loadPhotos() {
  var need = S.assets.filter(function (a) { return a.photo && !photoCache[a.id]; });
  if (need.length) {
    Photos.all().then(function (all) {
      var changed = false;
      need.forEach(function (a) { if (all[a.id]) { photoCache[a.id] = all[a.id]; changed = true; } });
      if (changed) render();
    });
  }
  // 过几秒再清掉已经没有主人的照片（装备被删掉后留下的）。等一等是为了不抢在「撤销删除」前面。
  setTimeout(function () {
    Photos.all().then(function (all) {
      Object.keys(all).forEach(function (id) { if (!assetById(id) && !undoSnap) Photos.del(id); });
    });
  }, 8000);
}

/* ====================================================================== 路由和各个页面 */

var route = { name: 'gear', id: null };
var navDepth = 0;            // 在应用里往前走了几步：决定「返回」是退一步还是直接回首页
var fresh = true;            // 这次重画是不是刚进入页面（跳水图只在刚进入时播放入场动画）
var scrollMemo = {};
var charts = [];

function parseHash(h) {
  h = String(h || '').replace(/^#/, '');
  if (h === 'stats' || h === 'timeline' || h === 'wish' || h === 'prefs' || h === 'cats') return { name: h, id: null };
  var m = /^a-([A-Za-z0-9_-]{1,32})$/.exec(h);
  if (m) return { name: 'asset', id: m[1] };
  return { name: 'gear', id: null };
}
function hashOf(r) { return r.name === 'asset' ? '#a-' + r.id : '#' + r.name; }

/** 去某个页面。replace=true 用于底部标签之间的切换（不往历史里加记录）。 */
function nav(hash, replace) {
  var r = parseHash(hash);
  if (hashOf(r) === hashOf(route)) { window.scrollTo(0, 0); return; }
  scrollMemo[hashOf(route)] = window.pageYOffset || 0;
  route = r; fresh = true;
  if (!replace) navDepth++;
  try {
    if (replace) history.replaceState(null, '', hashOf(r)); else location.hash = hashOf(r);
  } catch (e) { /* 有些嵌入环境不让改地址，页面照常切换 */ }
  closeAllSheets();
  render();
  window.scrollTo(0, 0);
}

function goBack() {
  if (navDepth > 0) { try { history.back(); return; } catch (e) { /* 往下走 */ } }
  nav('#gear', true);
}

window.addEventListener('hashchange', function () {
  var r = parseHash(location.hash);
  if (hashOf(r) === hashOf(route)) return;                 // 是我们自己改的
  scrollMemo[hashOf(route)] = window.pageYOffset || 0;
  route = r; fresh = true; navDepth = Math.max(0, navDepth - 1);
  closeAllSheets();
  render();
  window.scrollTo(0, scrollMemo[hashOf(r)] || 0);
});

function destroyCharts() {
  charts.forEach(function (c) { try { c.destroy(); } catch (e) { /* 忽略 */ } });
  charts = [];
}

var VIEWS = {};

function render() {
  if (!S) return;
  abortReorder();
  refreshToday();
  destroyCharts();
  if (route.name === 'asset' && !assetById(route.id)) {
    route = { name: 'gear', id: null };
    try { history.replaceState(null, '', '#gear'); } catch (e) { /* 忽略 */ }
  }
  var out = (VIEWS[route.name] || VIEWS.gear)();
  $('#bar').innerHTML = out.bar;
  var view = $('#view');
  view.className = 'view view-' + (out.cls || route.name);
  view.innerHTML = out.body;
  renderTabs();
  rootEl.setAttribute('data-route', route.name);
  doc.title = out.title ? out.title + ' · 我的装备' : '我的装备';
  if (out.mount) out.mount(view);
  fresh = false;
}

function barHTML(title, opts) {
  opts = opts || {};
  return (opts.back ? '<button class="ibtn bar-back" type="button" data-act="back" aria-label="返回">' + ic('back') + '</button>' : '') +
    '<h1 class="bar-title' + (opts.back ? ' is-sub' : '') + '">' + esc(title) + '</h1>' +
    '<div class="bar-acts">' + (opts.acts || '') +
    (opts.noPrefs ? '' : '<button class="ibtn" type="button" data-act="go" data-to="#prefs" aria-label="设置">' + ic('prefs') + '</button>') + '</div>';
}

function renderTabs() {
  var cur0 = route.name === 'asset' || route.name === 'prefs' || route.name === 'cats' ? 'gear' : route.name;
  var tabs = [['gear', '装备', 'tag'], ['stats', '总览', 'dive'], null, ['timeline', '时间线', 'time'], ['wish', '心愿', 'star']];
  $('#tabs').innerHTML = tabs.map(function (t) {
    if (!t) return '<button class="tab-add" type="button" data-act="add" aria-label="' + (route.name === 'wish' ? '添加心愿' : '添加装备') + '">' + ic('plus') + '</button>';
    var on = t[0] === cur0;
    return '<button class="tab' + (on ? ' is-on' : '') + '" type="button" data-act="tab" data-to="#' + t[0] + '"' + (on ? ' aria-current="page"' : '') + '>' +
      '<span class="tab-ic">' + ic(t[2]) + '</span><span class="tab-tx">' + t[1] + '</span></button>';
  }).join('');
}

/* ---------- 列表里的一行 ---------- */

function statusChip(a) {
  if (a.status === 'retired') return '<span class="chip chip-off">已退役</span>';
  if (a.status === 'sold') return '<span class="chip chip-off">已卖出</span>';
  return '';
}

function goalLine(a, c) {
  if (c.future) return '<span class="goal-tx">还没到购入日</span>';
  if (a.status === 'sold') {
    return '<span class="goal-tx">回血 ' + esc(mTxt(a.sold || 0)) + '，' + (c.reached ? '<b class="ok">' + ic('check') + '算回本</b>' : '没回本') + '</span>';
  }
  if (a.status === 'retired') {
    return '<span class="goal-tx">' + (c.reached ? '<b class="ok">' + ic('check') + '退役前已回本</b>' : '退役时回本 ' + Math.floor(c.progress * 100) + '%') + '</span>';
  }
  if (c.reached) {
    return '<span class="goal-tx"><b class="ok">' + ic('check') + '已回本</b>' + (c.sinceGoal > 0 ? '，又用了 ' + n(c.sinceGoal) + ' 天' : '，就在今天') + '</span>';
  }
  return '<span class="goal-tx">回本 ' + Math.floor(c.progress * 100) + '%，还差 ' + n(c.daysLeft) + ' 天</span>';
}

function meterHTML(c, cls) {
  var pct = Math.max(2, Math.round(c.progress * 1000) / 10);
  return '<span class="meter' + (c.reached ? ' is-done' : '') + (cls ? ' ' + cls : '') + '" role="img" aria-label="回本进度 ' + Math.floor(c.progress * 100) + '%"><i style="width:' + pct + '%"></i></span>';
}

function itemHTML(a, c, grip) {
  var off = a.status !== 'active';
  return '<li class="item' + (off ? ' is-off' : '') + (grip ? ' has-grip' : '') + '" data-id="' + esc(a.id) + '">' +
    '<button class="item-main" type="button" data-act="open" data-id="' + esc(a.id) + '">' +
    stickerHTML(a) +
    '<span class="item-mid">' +
      '<span class="item-name">' + esc(a.name) + '</span>' +
      '<span class="item-meta">' + statusChip(a) + '<span>' + (c.future ? '未开始' : '第 <b class="num">' + n(c.days) + '</b> 天') + '</span>' +
        (a.cat ? '<span class="nb"><span class="sep">·</span><span>' + esc(a.cat) + '</span></span>' : '') +
        '<span class="nb"><span class="sep">·</span><span class="num">' + esc(mTxt(c.cost)) + '</span></span></span>' +
      meterHTML(c) + goalLine(a, c) +
    '</span>' +
    '<span class="tag' + (off ? ' tag-off' : '') + '"><b class="num">' + dailyHTML(c.shown) + '</b><em>/天</em></span>' +
    '</button>' +
    (grip ? '<button class="item-grip" type="button" data-act="grip" aria-label="' + esc('调整「' + a.name + '」的顺序：按住拖动，或者按上下方向键') + '">' + ic('grip') + '</button>' : '') +
    '</li>';
}

/* ---------- 贴纸墙 ---------- */

function hashInt(s) {
  var h = 2166136261;
  for (var i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}

function wallHTML(list, calcs) {
  return '<div class="wall" role="list">' + list.map(function (a) {
    var c = calcs[a.id], h = hashInt(a.id);
    var sz = Math.round(40 + 11.5 * Math.log10(Math.max(c.cost, 10)));
    var rot = (h % 15) - 7, dy = ((h >>> 8) % 11) - 5, trot = ((h >>> 16) % 7) - 3;
    var off = a.status !== 'active';
    return '<button class="wall-item' + (off ? ' is-off' : '') + '" type="button" role="listitem" data-act="open" data-id="' + esc(a.id) + '" ' +
      'style="--sz:' + sz + 'px;--rot:' + rot + 'deg;--dy:' + dy + 'px;--trot:' + trot + 'deg" aria-label="' + esc(a.name + '，日均 ' + dTxt(c.shown)) + '">' +
      stickerHTML(a, 'stk-wall') +
      '<span class="wall-tag num">' + dailyHTML(c.shown) + '</span>' +
      '<span class="wall-tape">' + esc(a.name) + '</span>' +
      (off ? '<span class="wall-stamp">' + (a.status === 'sold' ? '已售' : '退役') + '</span>' : '') +
      '</button>';
  }).join('') + '</div>';
}

/** 贴纸墙上面、列表下面的一行：哪个颜色的边是哪个类别，外加「类别和边框」的入口。 */
function catFootHTML(list, cls) {
  var seen = {}, out = '';
  list.forEach(function (a) {
    var c = a.cat ? C.catColor(S, a.cat) : '';
    if (!c || seen['$' + a.cat]) return;
    seen['$' + a.cat] = true;
    out += '<span class="lg-cat">' + catDot(c) + esc(a.cat) + '</span>';
  });
  return '<div class="catfoot' + (cls ? ' ' + cls : '') + '">' + (out ? '<div class="catfoot-lg" role="group" aria-label="边框颜色对应的类别">' + out + '</div>' : '') +
    '<button type="button" class="lnk" data-act="go" data-to="#cats">类别和边框' + ic('right') + '</button></div>';
}

/* ---------- 装备页 ---------- */

function bigToggleHTML(sum) {
  if (!sum.bigN) return '';
  return '<label class="swrow"><input type="checkbox" class="sw" id="incBigSw" data-on="incBig"' + (S.settings.incBig ? ' checked' : '') + '>' +
    '<span>合计里算上大件</span><small>' + esc(S.assets.filter(function (a) { return a.big; }).map(function (a) { return a.icon + ' ' + a.name; }).join('、')) + '</small></label>';
}

function heroHTML(sum) {
  var has = sum.counted > 0;
  return '<section class="hero" aria-label="合计日均">' +
    '<div class="pricetag"><span class="pricetag-hole" aria-hidden="true"></span>' +
    '<div class="hero-cap">' + (has ? n(sum.counted) + ' 件在役装备，今天每天的成本' : '现在没有在役的装备') + '</div>' +
    '<div class="hero-fig num">' + dailyHTML(has ? sum.daily : 0) + '<em>/天</em></div>' +
    (has ? '<div class="hero-sub"><span>明天再降 <b class="num">' + esc(C.fmtDrop(sum.drop, cur())) + '</b></span><span>总投入 <b class="num">' + esc(mTxt(sum.cost)) + '</b></span></div>' : '') +
    '</div>' + bigToggleHTML(sum) + '</section>';
}

function noticesHTML() {
  var s = '';
  if (notice) s += '<div class="note-bar is-warn">' + ic('info') + '<span>' + esc(notice) + '</span></div>';
  if (!store.ok()) s += '<div class="note-bar is-warn">' + ic('info') + '<span>这个浏览器没让保存数据（可能是无痕模式）。现在能用，但关掉页面后记录会丢。</span></div>';
  if (S.demo) {
    s += '<div class="note-bar">' + ic('info') + '<span>现在看到的是示例数据。</span><button type="button" class="lnk" data-act="demo-clear">清空，开始记我的</button></div>';
  } else if (ENV.preview) {
    s += '<div class="note-bar">' + ic('info') + '<span>这是预览版：改动只存在这个页面里。长期使用请部署到 GitHub Pages，再用「备份」把数据带过去。</span></div>';
  } else if ((S.bk.n || 0) >= 8) {
    s += '<div class="note-bar">' + ic('info') + '<span>有 ' + n(S.bk.n) + ' 处改动还没备份。</span><button type="button" class="lnk" data-act="export">去备份</button></div>';
  }
  return s;
}

function welcomeHTML() {
  return '<section class="welcome">' +
    '<div class="welcome-chart card"><div class="welcome-cap">一台 <b class="num">' + esc(mTxt(8999)) + '</b> 的手机，用到第 1,000 天</div><div data-chart="welcome"></div></div>' +
    '<h2 class="welcome-h">东西用得越久，每天越便宜</h2>' +
    '<p class="welcome-p">把手机、电脑、相机这些装备记下来，看它们的日均成本一天天往下掉；想买的新东西先放进心愿，冷静几天再决定。</p>' +
    '<div class="welcome-acts">' +
    '<button class="btn btn-primary" type="button" data-act="add">' + ic('plus') + '添加第一件装备</button>' +
    '<button class="btn" type="button" data-act="import">' + ic('paste') + '粘贴导入码 / 恢复备份</button>' +
    '<button class="btn btn-quiet" type="button" data-act="demo">先看看示例</button>' +
    '</div></section>';
}

VIEWS.gear = function () {
  var t = today(), set = S.settings;
  var bar = barHTML('我的装备');
  if (!S.assets.length && !S.wishes.length) {
    return { bar: bar, cls: 'gear is-welcome', body: noticesHTML() + welcomeHTML(), mount: function (view) {
      var host = $('[data-chart="welcome"]', view);
      var sample = { id: 'sample', name: '示例手机', buy: C.addDays(t, -999), price: 8999, extras: [], status: 'active' };
      charts.push(Charts.dive(host, sample, t, C.defaultSettings(), { cur: cur(), animate: fresh, height: 200 }));
    } };
  }
  var sum = C.summary(S.assets, t, set, { incBig: set.incBig });
  var all = C.summary(S.assets, t, set, { incBig: true });
  var filt = set.filt;
  if (filt !== 'all' && !all[filt]) filt = all.active ? 'active' : 'all';
  var list = S.assets.filter(function (a) { return filt === 'all' || a.status === filt; });
  list = C.sortAssets(list, set.sort, t, set, catNames());
  var calcs = {};
  list.forEach(function (a) { calcs[a.id] = C.calc(a, t, set); });

  var kinds = C.STATUSES.filter(function (k) { return all[k] > 0; });
  var seg = '';
  if (kinds.length > 1) {
    seg = '<div class="seg" role="group" aria-label="按状态筛选">' + kinds.concat(['all']).map(function (k) {
      var label = k === 'all' ? '全部' : C.STATUS_LABEL[k], cnt = k === 'all' ? all.n : all[k];
      return '<button type="button" class="seg-b' + (filt === k ? ' is-on' : '') + '" data-act="filt" data-v="' + k + '" aria-pressed="' + (filt === k) + '">' + label + '<i class="num">' + cnt + '</i></button>';
    }).join('') + '</div>';
  }
  var sorts = [['manual', '自定义顺序'], ['daily', '日均从高到低'], ['daily-asc', '日均从低到高'], ['new', '最近买的在前'], ['old', '最早买的在前'], ['price', '总成本从高到低'], ['goal', '回本进度'], ['name', '名称'], ['cat', '按类别']];
  var manual = set.sort === 'manual';
  var tools = '<div class="tools">' + seg + '<div class="tools-r">' +
    '<label class="pick">' + ic('sort') + '<span class="sr">排序</span><select data-on="sort" id="sortSel">' + sorts.map(function (o) {
      return '<option value="' + o[0] + '"' + (set.sort === o[0] ? ' selected' : '') + '>' + o[1] + '</option>';
    }).join('') + '</select></label>' +
    '<div class="viewsw" role="group" aria-label="显示方式">' +
    '<button type="button" class="ibtn' + (set.view === 'list' ? ' is-on' : '') + '" data-act="view" data-v="list" aria-pressed="' + (set.view === 'list') + '" aria-label="列表">' + ic('list') + '</button>' +
    '<button type="button" class="ibtn' + (set.view === 'wall' ? ' is-on' : '') + '" data-act="view" data-v="wall" aria-pressed="' + (set.view === 'wall') + '" aria-label="贴纸墙">' + ic('wall') + '</button>' +
    '</div></div></div>';

  var body;
  if (!list.length) {
    body = '<div class="empty"><p>还没有装备。</p><button class="btn btn-primary" type="button" data-act="add">' + ic('plus') + '添加装备</button></div>';
  } else if (set.view === 'wall') {
    body = catFootHTML(list, 'is-top') + wallHTML(list, calcs);            // 贴纸墙：颜色说明放在墙的上面
  } else {
    body = '<ul class="list">' + list.map(function (a) { return itemHTML(a, calcs[a.id], manual); }).join('') + '</ul>' + catFootHTML(list);
  }
  return { bar: bar, body: noticesHTML() + heroHTML(sum) + (S.assets.length ? tools : '') + body };
};

/* ---------- 单件详情 ---------- */

function badgeText(m) {
  switch (m.type) {
    case 'buy': return '入手';
    case 'days': return m.v >= 1000 ? String(m.v) : m.v + '天';
    case 'year': return m.v + '年';
    case 'below': return '↓' + (m.v >= 10000 ? (m.v / 10000) + '万' : m.v);
    case 'goal': return '回本';
    case 'retire': return '退役';
    case 'sold': return '卖出';
  }
  return '';
}

function msRowHTML(m, name, opts) {
  var tx = C.milestoneText(m, name, cur()), k = C.dayNum(m.date) - C.dayNum(today());
  if (!name) tx.title = tx.title.trim();
  var when = opts && opts.upcoming ? relDays(k) : m.date;
  return '<li class="ms' + (opts && opts.upcoming ? ' is-up' : '') + (m.type === 'goal' ? ' is-goal' : '') + '">' +
    '<span class="ms-badge num" aria-hidden="true">' + esc(badgeText(m)) + '</span>' +
    '<span class="ms-main"><span class="ms-title">' + esc(tx.title) + '</span>' +
    '<span class="ms-sub"><span class="num">' + esc(when) + '</span>' + (opts && opts.upcoming ? '<span class="sep">·</span><span class="num">' + esc(m.date) + '</span>' : '') +
    (tx.sub ? '<span class="sep">·</span>' + esc(tx.sub) : '') + '</span></span></li>';
}

function goalCardHTML(a, c) {
  var g = c.goal, head, text;
  var target = '目标是' + goalText(g) + '（' + (g.t === 'days' ? '日均 ≤ ' + dTxt(c.targetDaily) : '约 ' + n(c.targetDays) + ' 天') + '）';
  if (a.status === 'sold') {
    head = c.reached ? '<b class="ok">' + ic('check') + '卖出后算回本</b>' : '卖出后没回本';
    text = '卖出回血 ' + mTxt(a.sold || 0) + '，净花费 ' + mTxt(c.net) + '，持有 ' + n(c.days) + ' 天，实际日均 ' + dTxt(c.netDaily) + '。' + target + '。';
  } else if (a.status === 'retired') {
    head = c.reached ? '<b class="ok">' + ic('check') + '退役前已回本</b>' : '退役时回本 ' + Math.floor(c.progress * 100) + '%';
    text = target + '。服役 ' + n(c.days) + ' 天后退役，日均定格在 ' + dTxt(c.daily) + '。';
  } else if (c.future) {
    head = '还没到购入日'; text = target + '。';
  } else if (c.reached) {
    head = '<b class="ok">' + ic('check') + '已回本</b>';
    text = target + '。' + c.goalDate + ' 那天达到，之后' + (c.sinceGoal > 0 ? '又用了 ' + n(c.sinceGoal) + ' 天。' : '每多用一天都是赚的。');
  } else {
    head = '回本 ' + Math.floor(c.progress * 100) + '%';
    text = target + '。预计 ' + c.goalDate + ' 回本，还差 ' + n(c.daysLeft) + ' 天。';
  }
  return '<section class="card sec"><header class="sec-h"><h2>回本</h2><button type="button" class="lnk" data-act="goal" data-id="' + esc(a.id) + '">改目标</button></header>' +
    '<div class="goal-head">' + head + '</div>' + meterHTML(c, 'meter-lg') + '<p class="sec-p">' + esc(text) + '</p></section>';
}

VIEWS.asset = function () {
  var a = assetById(route.id), t = today(), set = S.settings, c = C.calc(a, t, set);
  var bar = barHTML(a.name, { back: true, noPrefs: true,
    acts: '<button class="ibtn" type="button" data-act="edit" data-id="' + esc(a.id) + '" aria-label="编辑">' + ic('edit') + '</button>' });
  var live = a.status === 'active';
  var extraSum = C.round2(c.cost - a.price);
  var s = '';

  // 标识卡
  s += '<section class="card idcard' + (live ? '' : ' is-off') + '">' +
    '<div class="id-top"><button type="button" class="id-stk" data-act="icon" data-id="' + esc(a.id) + '" aria-label="换图标">' + stickerHTML(a, 'stk-lg') + '</button>' +
    '<div class="id-names"><h2 class="id-name">' + esc(a.name) + '</h2>' +
    '<div class="id-meta">' + (a.cat ? '<span class="chip">' + esc(a.cat) + '</span>' : '') +
      '<span class="chip' + (live ? ' chip-on' : ' chip-off') + '">' + C.STATUS_LABEL[a.status] + '</span>' + (a.big ? '<span class="chip">大件</span>' : '') + '</div></div></div>' +
    '<div class="id-figs"><div class="pricetag pricetag-md"><span class="pricetag-hole" aria-hidden="true"></span>' +
      '<div class="hero-cap">' + (a.status === 'sold' ? '卖出后实际日均' : a.status === 'retired' ? '退役时日均' : '今天的日均') + '</div>' +
      '<div class="hero-fig num"><span id="heroFig">' + dailyHTML(c.shown) + '</span><em>/天</em></div></div>' +
    '<dl class="id-stats"><div><dt>' + (live ? '已服役' : '服役了') + '</dt><dd><b class="num">' + n(c.days) + '</b> 天</dd><dd class="id-small">' + esc(C.spanText(a.buy, c.days)) + '</dd></div>' +
      '<div><dt>总成本</dt><dd><b class="num">' + esc(mTxt(c.cost)) + '</b></dd><dd class="id-small">' + (extraSum > 0 ? '含追加 ' + esc(mTxt(extraSum)) : esc(a.buy) + ' 购入') + '</dd></div></dl></div>' +
    '</section>';

  // 跳水图 + 往后几个时间点（和原来表格里的几列一样）
  s += '<section class="card sec"><header class="sec-h"><h2>日均走势</h2><span class="sec-hint">左右拖动看每一天</span></header><div class="chart-box" data-chart="dive"></div>';
  if (live && !c.future) {
    var rows = [['明天', c.cost / (c.days + 1)], ['30 天后', c.p30], ['90 天后', c.p90], ['1 年后', c.p365]];
    s += '<table class="mini"><thead><tr><th scope="col">继续用到</th><th scope="col">日均</th><th scope="col">比今天少</th></tr></thead><tbody>' + rows.map(function (r) {
      return '<tr><th scope="row">' + r[0] + '</th><td class="num">' + esc(dTxt(r[1])) + '</td><td class="num">' + esc(C.fmtDrop(c.daily - r[1], cur())) + '</td></tr>';
    }).join('') + '</tbody></table>';
  }
  s += '</section>';

  s += goalCardHTML(a, c);

  // 追加花费
  s += '<section class="card sec"><header class="sec-h"><h2>追加花费</h2><button type="button" class="lnk" data-act="extra-add" data-id="' + esc(a.id) + '">' + ic('plus') + '记一笔</button></header>';
  if (a.extras.length) {
    s += '<ul class="rows">' + a.extras.slice().sort(function (p, q) { return p.date < q.date ? 1 : -1; }).map(function (x) {
      return '<li><button type="button" class="row" data-act="extra-edit" data-id="' + esc(a.id) + '" data-x="' + esc(x.id) + '"><span class="row-main"><span>' + esc(x.name) + '</span><small class="num">' + esc(x.date) + '</small></span>' +
        '<span class="row-val num">' + esc(mTxt(x.amt)) + '</span>' + ic('right', 'row-go') + '</button></li>';
    }).join('') + '</ul><p class="sec-p">购入 ' + esc(mTxt(a.price)) + ' + 追加 ' + esc(mTxt(extraSum)) + ' = 总成本 ' + esc(mTxt(c.cost)) + '</p>';
  } else {
    s += '<p class="sec-p">配件、维修、延保这些后来花的钱记在这里，会算进总成本和日均。</p>';
  }
  s += '</section>';

  // 二手估价
  if (a.status !== 'sold') {
    s += '<section class="card sec"><header class="sec-h"><h2>如果现在卖掉</h2><button type="button" class="lnk" data-act="resale" data-id="' + esc(a.id) + '">' + (a.resale != null ? '改估价' : '填估价') + '</button></header>';
    if (a.resale != null) {
      s += '<div class="kv3"><div><span>二手估价</span><b class="num">' + esc(mTxt(a.resale)) + '</b></div><div><span>净花费</span><b class="num">' + esc(mTxt(c.ifSoldNet)) + '</b></div>' +
        '<div><span>折合每天</span><b class="num">' + esc(dTxt(c.ifSoldDaily)) + '</b></div></div>';
    } else {
      s += '<p class="sec-p">估一个二手价，就能看到现在出手的话，这些日子实际每天花了多少。</p>';
    }
    s += '</section>';
  }

  // 里程碑
  var ms = C.assetMilestones(a, t, set, 3650), d0 = C.dayNum(t);
  var past = ms.filter(function (m) { return C.dayNum(m.date) <= d0; }).reverse();
  var up = ms.filter(function (m) { return C.dayNum(m.date) > d0; }).slice(0, 3);
  s += '<section class="card sec"><header class="sec-h"><h2>里程碑</h2></header>';
  if (up.length) s += '<ul class="mslist">' + up.map(function (m) { return msRowHTML(m, '', { upcoming: true }); }).join('') + '</ul>';
  s += '<ul class="mslist">' + past.slice(0, 4).map(function (m) { return msRowHTML(m, ''); }).join('') + '</ul>';
  if (past.length > 4) {
    s += '<details class="more"><summary>更早的 ' + (past.length - 4) + ' 条</summary><ul class="mslist">' + past.slice(4).map(function (m) { return msRowHTML(m, ''); }).join('') + '</ul></details>';
  }
  s += '</section>';

  // 明细
  var fxNote = a.fx ? esc(a.fx.s) + C.fmtNum(a.fx.a, 2) + ' × ' + a.fx.r : '';
  s += '<section class="card sec"><header class="sec-h"><h2>明细</h2></header><dl class="kv">' +
    '<div><dt>购入日期</dt><dd class="num">' + esc(a.buy) + '</dd></div>' +
    '<div><dt>购入金额</dt><dd class="num">' + esc(mTxt(a.price)) + (fxNote ? '<small>' + fxNote + '</small>' : '') + '</dd></div>' +
    (a.status !== 'active' ? '<div><dt>' + (a.status === 'sold' ? '卖出日期' : '退役日期') + '</dt><dd class="num">' + esc(a.end) + '</dd></div>' : '') +
    (a.status === 'sold' ? '<div><dt>卖出金额</dt><dd class="num">' + esc(mTxt(a.sold || 0)) + (a.soldFx ? '<small>' + esc(a.soldFx.s) + C.fmtNum(a.soldFx.a, 2) + ' × ' + a.soldFx.r + '</small>' : '') + '</dd></div>' : '') +
    '</dl>' + (a.note ? '<p class="note-tx">' + esc(a.note).replace(/\n/g, '<br>') + '</p>' : '') + '</section>';

  // 操作
  s += '<div class="acts">';
  if (a.status === 'active') {
    s += '<button class="btn" type="button" data-act="retire" data-id="' + esc(a.id) + '">' + ic('box') + '退役</button>' +
      '<button class="btn" type="button" data-act="sell" data-id="' + esc(a.id) + '">' + ic('sell') + '卖出</button>';
  } else if (a.status === 'retired') {
    s += '<button class="btn" type="button" data-act="revive" data-id="' + esc(a.id) + '">' + ic('undo') + '重新服役</button>' +
      '<button class="btn" type="button" data-act="sell" data-id="' + esc(a.id) + '">' + ic('sell') + '卖出</button>';
  } else {
    s += '<button class="btn" type="button" data-act="revive" data-id="' + esc(a.id) + '">' + ic('undo') + '撤销卖出</button>';
  }
  s += '</div><button class="btn btn-danger" type="button" data-act="del" data-id="' + esc(a.id) + '">' + ic('trash') + '删除这件装备</button>';

  return { bar: bar, title: a.name, body: s, mount: function (view) {
    var host = $('[data-chart="dive"]', view), fig = $('#heroFig', view);
    var useNet = a.status === 'sold';
    charts.push(Charts.dive(host, a, t, set, { cur: cur(), animate: fresh && !useNet, onFrame: function (v, done) {
      if (useNet) return;
      fig.innerHTML = dailyHTML(v);
    } }));
  } };
};

/* ---------- 总览 ---------- */

function barsHTML(rows, opts) {
  var max = Math.max.apply(null, rows.map(function (r) { return r.v; }).concat([1e-9]));
  return '<ul class="bars">' + rows.map(function (r) {
    var w = Math.max(0.6, r.v / max * 100);
    var inner = '<span class="bar-name">' + (r.icon ? '<span class="emoji">' + esc(r.icon) + '</span>' : '') + (r.dot || '') + '<span class="bar-nm">' + esc(r.name) + '</span></span>' +
      '<span class="bar-track"><i style="width:' + w.toFixed(2) + '%"></i></span><span class="bar-val num">' + esc(r.text) + '</span>';
    return '<li>' + (r.id ? '<button type="button" class="bar-row" data-act="open" data-id="' + esc(r.id) + '">' + inner + '</button>' : '<div class="bar-row">' + inner + '</div>') + '</li>';
  }).join('') + '</ul>';
}

VIEWS.stats = function () {
  var t = today(), set = S.settings, inc = set.incBig;
  var bar = barHTML('总览');
  var sum = C.summary(S.assets, t, set, { incBig: inc });
  if (!S.assets.length) {
    return { bar: bar, body: '<div class="empty"><p>添加装备以后，这里会有日均排行、各类别的投入和卖出复盘。</p><button class="btn btn-primary" type="button" data-act="add">' + ic('plus') + '添加装备</button></div>' };
  }
  var pool = S.assets.filter(function (a) { return inc || !a.big; });
  var act = pool.filter(function (a) { return a.status === 'active'; });
  var calcs = {}; pool.forEach(function (a) { calcs[a.id] = C.calc(a, t, set); });
  var liveCalc = act.filter(function (a) { return !calcs[a.id].future; });
  var s = '';
  if (sum.bigN) s += '<div class="filters">' + bigToggleHTML(sum) + '</div>';

  // 四个数字
  var avgDays = sum.counted ? sum.daysSum / sum.counted : 0;
  var yearLater = 0; liveCalc.forEach(function (a) { yearLater += calcs[a.id].p365; });
  s += '<section class="kpis">' +
    '<div class="kpi"><span class="kpi-l">在役装备</span><b class="kpi-v num">' + n(sum.counted) + '<small> 件</small></b><span class="kpi-s">投入 <span class="num">' + esc(mTxt(sum.cost, 0)) + '</span></span></div>' +
    '<div class="kpi"><span class="kpi-l">已回本</span><b class="kpi-v num">' + n(sum.reached) + '<small> / ' + n(sum.counted) + '</small></b>' +
      '<span class="meter' + (sum.counted && sum.reached === sum.counted ? ' is-done' : '') + '"><i style="width:' + (sum.counted ? Math.max(2, sum.reached / sum.counted * 100) : 0).toFixed(1) + '%"></i></span></div>' +
    '<div class="kpi"><span class="kpi-l">平均服役</span><b class="kpi-v num">' + (avgDays >= 365 ? (avgDays / 365).toFixed(1) + '<small> 年</small>' : n(Math.round(avgDays)) + '<small> 天</small>') + '</b><span class="kpi-s">合计 <span class="num">' + n(sum.daysSum) + '</span> 天</span></div>' +
    '<div class="kpi"><span class="kpi-l">一年后的合计日均</span><b class="kpi-v num">' + dailyHTML(yearLater) + '</b><span class="kpi-s">不再买新的话；今天 <span class="num">' + esc(dTxt(sum.daily)) + '</span></span></div>' +
    (sum.resaleN ? '<div class="kpi kpi-wide"><span class="kpi-l">二手估值合计</span><b class="kpi-v num">' + mHTML(sum.resale, 0) + '</b><span class="kpi-s">已估价 ' + sum.resaleN + ' 件' +
      (sum.resaleN < sum.counted ? '，还有 ' + (sum.counted - sum.resaleN) + ' 件没估' : '，相当于投入的 ' + Math.round(sum.resale / Math.max(sum.cost, 0.01) * 100) + '%') + '</span></div>' : '') +
    '</section>';

  // 日均排行
  var ranked = C.sortAssets(liveCalc, 'daily', t, set);
  if (ranked.length) {
    s += '<section class="card sec"><header class="sec-h"><h2>日均排行</h2><span class="sec-hint">在役 ' + ranked.length + ' 件</span></header>' +
      barsHTML(ranked.map(function (a) { return { id: a.id, icon: a.icon, name: a.name, v: calcs[a.id].daily, text: dTxt(calcs[a.id].daily) }; })) + '</section>';
  }

  // 各类别
  var cats = {};
  liveCalc.forEach(function (a) {
    var k = a.cat || '未分类';
    if (!cats[k]) cats[k] = { name: k, v: 0, cnt: 0 };
    cats[k].v += calcs[a.id].cost; cats[k].cnt++;
  });
  var catRows = Object.keys(cats).map(function (k) { return cats[k]; }).sort(function (p, q) { return q.v - p.v; });
  if (catRows.length > 1) {
    s += '<section class="card sec"><header class="sec-h"><h2>各类别投入</h2><span class="sec-hint">在役</span></header>' +
      barsHTML(catRows.map(function (r) {
        return { name: r.name + (r.cnt > 1 ? ' ×' + r.cnt : ''), v: r.v, text: mTxt(r.v, 0), dot: S.cats.length ? catDot(C.catColor(S, r.name)) : '' };
      })) + '</section>';
  }

  // 之最
  if (liveCalc.length > 1) {
    var by = function (f) { return liveCalc.slice().sort(f)[0]; };
    var hi = by(function (p, q) { return calcs[q.id].daily - calcs[p.id].daily; }), lo = by(function (p, q) { return calcs[p.id].daily - calcs[q.id].daily; });
    var old = by(function (p, q) { return calcs[q.id].days - calcs[p.id].days; }), neo = by(function (p, q) { return calcs[p.id].days - calcs[q.id].days; });
    var row = function (label, a, val) {
      return '<li><button type="button" class="row" data-act="open" data-id="' + esc(a.id) + '"><span class="row-k">' + label + '</span><span class="row-main"><span><span class="emoji">' + esc(a.icon) + '</span> ' + esc(a.name) + '</span></span><span class="row-val num">' + esc(val) + '</span>' + ic('right', 'row-go') + '</button></li>';
    };
    s += '<section class="card sec"><header class="sec-h"><h2>之最</h2></header><ul class="rows">' +
      row('日均最高', hi, dTxt(calcs[hi.id].daily)) + row('日均最低', lo, dTxt(calcs[lo.id].daily)) +
      row('服役最久', old, n(calcs[old.id].days) + ' 天') + row('最近入手', neo, n(calcs[neo.id].days) + ' 天') + '</ul></section>';
  }

  // 卖出复盘
  var sold = pool.filter(function (a) { return a.status === 'sold'; });
  if (sold.length) {
    s += '<section class="card sec"><header class="sec-h"><h2>卖出复盘</h2><span class="sec-hint">' + sold.length + ' 件</span></header><ul class="rows">' + sold.map(function (a) {
      var c = calcs[a.id];
      return '<li><button type="button" class="row" data-act="open" data-id="' + esc(a.id) + '"><span class="row-main"><span><span class="emoji">' + esc(a.icon) + '</span> ' + esc(a.name) + '</span>' +
        '<small class="num">' + esc(mTxt(c.cost)) + ' 买，' + esc(mTxt(a.sold || 0)) + ' 卖，用了 ' + n(c.days) + ' 天</small></span>' +
        '<span class="row-val"><b class="num">' + esc(dTxt(c.netDaily)) + '</b><small>实际日均</small></span>' + ic('right', 'row-go') + '</button></li>';
    }).join('') + '</ul><p class="sec-p">一共回血 ' + esc(mTxt(sum.soldBack)) + '，这几件的净花费是 ' + esc(mTxt(sum.soldNet)) + '。</p></section>';
  }
  var retired = pool.filter(function (a) { return a.status === 'retired'; });
  if (retired.length) {
    s += '<section class="card sec"><header class="sec-h"><h2>已退役</h2><span class="sec-hint">' + retired.length + ' 件</span></header><ul class="rows">' + retired.map(function (a) {
      var c = calcs[a.id];
      return '<li><button type="button" class="row" data-act="open" data-id="' + esc(a.id) + '"><span class="row-main"><span><span class="emoji">' + esc(a.icon) + '</span> ' + esc(a.name) + '</span>' +
        '<small class="num">' + esc(mTxt(c.cost)) + '，服役 ' + n(c.days) + ' 天</small></span>' +
        '<span class="row-val"><b class="num">' + esc(dTxt(c.daily)) + '</b><small>定格日均</small></span>' + ic('right', 'row-go') + '</button></li>';
    }).join('') + '</ul></section>';
  }

  return { bar: bar, title: '总览', body: s };
};

/* ---------- 时间线 ---------- */

function ganttHTML(list, t) {
  var d1 = C.dayNum(t), d0 = d1 - 60, set = S.settings;
  list.forEach(function (a) { var b = C.dayNum(a.buy); if (b < d0) d0 = b; });
  var span = Math.max(1, d1 - d0 + 1);
  function pct(d) { return Math.max(0, Math.min(100, (d - d0) / span * 100)); }
  var ticks = Charts.calTicks(d0, d1).filter(function (tk) { return pct(tk.d) > 4 && pct(tk.d) < 86; });
  var grid = ticks.map(function (tk) { return '<i class="g-grid" style="left:' + pct(tk.d).toFixed(2) + '%"></i>'; }).join('');
  var axis = '<div class="g-axis"><span class="g-lbl"></span><span class="g-track">' + ticks.map(function (tk) {
    return '<span class="g-tick num' + (tk.year ? ' is-year' : '') + '" style="left:' + pct(tk.d).toFixed(2) + '%">' + esc(tk.label) + '</span>';
  }).join('') + '<span class="g-tick g-now" style="left:100%">今天</span></span></div>';
  var rows = list.slice().sort(function (p, q) { return C.dayNum(p.buy) - C.dayNum(q.buy) || p.ct - q.ct; }).map(function (a) {
    var c = C.calc(a, t, set), b = Math.max(c.buyDay, d0), e = Math.min(c.endDay, d1);
    if (c.future) return '';
    var left = pct(b), width = Math.max(1.2, pct(e + 1) - left), bar;
    var goalDay = c.buyDay + c.targetDays - 1;
    if (a.status !== 'sold' && c.reached && goalDay > b && goalDay < e) {
      var split = (goalDay - b) / (e - b + 1) * 100;
      bar = '<i class="g-pre" style="width:calc(' + split.toFixed(2) + '% - 1px)"></i><i class="g-post" style="width:calc(' + (100 - split).toFixed(2) + '% - 1px)"></i>';
    } else {
      bar = '<i class="' + (c.reached && a.status !== 'sold' ? 'g-post' : 'g-pre') + '" style="width:100%"></i>';
    }
    var label = a.name + '：' + a.buy + ' 起，' + (a.status === 'active' ? '服役 ' : a.status === 'sold' ? '持有 ' : '服役了 ') + n(c.days) + ' 天' + (c.reached ? '，已回本' : '');
    return '<button type="button" class="g-row' + (a.status !== 'active' ? ' is-off' : '') + '" data-act="open" data-id="' + esc(a.id) + '" aria-label="' + esc(label) + '">' +
      '<span class="g-lbl"><span class="emoji">' + esc(a.icon) + '</span><span class="g-nm">' + esc(a.name) + '</span></span>' +
      '<span class="g-track">' + grid + '<span class="g-bar" style="left:' + left.toFixed(2) + '%;width:' + width.toFixed(2) + '%">' + bar + '</span>' +
      (a.status !== 'active' ? '<span class="g-end" style="left:' + pct(e + 1).toFixed(2) + '%">' + (a.status === 'sold' ? '售' : '退') + '</span>' : '') + '</span></button>';
  }).join('');
  return '<div class="gantt">' + axis + rows + '</div>' +
    '<div class="legend"><span><i class="lg lg-pre"></i>回本前</span><span><i class="lg lg-post"></i>回本后</span></div>';
}

VIEWS.timeline = function () {
  var t = today(), set = S.settings, bar = barHTML('时间线');
  if (!S.assets.length) {
    return { bar: bar, body: '<div class="empty"><p>添加装备以后，这里会排出它们的服役时间和里程碑。</p><button class="btn btn-primary" type="button" data-act="add">' + ic('plus') + '添加装备</button></div>' };
  }
  var names = {}; S.assets.forEach(function (a) { names[a.id] = a.name; });
  var ms = C.milestones(S.assets, t, set);
  var s = '<section class="card sec"><header class="sec-h"><h2>服役时间</h2><span class="sec-hint">' + S.assets.length + ' 件</span></header>' + ganttHTML(S.assets, t) + '</section>';

  var mark = C.nextTotalMark(S.assets, t, { incBig: set.incBig });
  s += '<section class="card sec"><header class="sec-h"><h2>即将到来</h2><span class="sec-hint">一年内</span></header>';
  if (mark) {
    s += '<div class="callout"><span class="ms-badge num is-total" aria-hidden="true">↓' + esc(String(mark.mark)) + '</span><span>不买新东西的话，<b>' + relDays(mark.inDays) + '</b>（' + esc(mark.date) + '）合计日均跌破 <b class="num">' + esc(mTxt(mark.mark)) + '</b>，现在是 <span class="num">' + esc(dTxt(mark.now)) + '</span>。</span></div>';
  }
  if (ms.upcoming.length) {
    s += '<ul class="mslist">' + ms.upcoming.slice(0, 8).map(function (m) { return msRowHTML(m, names[m.id], { upcoming: true }); }).join('') + '</ul>';
    if (ms.upcoming.length > 8) s += '<details class="more"><summary>再往后的 ' + (ms.upcoming.length - 8) + ' 条</summary><ul class="mslist">' + ms.upcoming.slice(8).map(function (m) { return msRowHTML(m, names[m.id], { upcoming: true }); }).join('') + '</ul></details>';
  } else if (!mark) s += '<p class="sec-p">一年内没有新的里程碑。</p>';
  s += '</section>';

  s += '<section class="card sec"><header class="sec-h"><h2>已经达成</h2><span class="sec-hint">' + ms.past.length + ' 条</span></header>';
  var year = '', first = ms.past.slice(0, 14), rest = ms.past.slice(14);
  function group(list) {
    var out = '', open = false;
    list.forEach(function (m) {
      var y = m.date.slice(0, 4);
      if (y !== year) { if (open) out += '</ul>'; out += '<h3 class="ms-year num">' + y + '</h3><ul class="mslist">'; open = true; year = y; }
      out += msRowHTML(m, names[m.id]);
    });
    return out + (open ? '</ul>' : '');
  }
  s += group(first);
  if (rest.length) { s += '<details class="more"><summary>更早的 ' + rest.length + ' 条</summary>' + group(rest) + '</details>'; }
  s += '</section>';
  return { bar: bar, title: '时间线', body: s };
};

/* ---------- 心愿 ---------- */

VIEWS.wish = function () {
  var t = today(), set = S.settings, bar = barHTML('心愿');
  if (!S.wishes.length) {
    return { bar: bar, body: '<div class="empty"><p>想买的东西先放在这儿。<br>看看它要用多久才回本，冷静几天再决定。</p><button class="btn btn-primary" type="button" data-act="wish-add">' + ic('plus') + '添加心愿</button></div>' };
  }
  var total = 0; S.wishes.forEach(function (w) { total += w.price; });
  var s = '<p class="lead">' + S.wishes.length + ' 个心愿，合计 <b class="num">' + esc(mTxt(total)) + '</b></p><ul class="wishes">';
  S.wishes.slice().sort(function (p, q) { return q.ct - p.ct; }).forEach(function (w) {
    var g = C.cleanGoal(w.goal) || set.goal, days = g.t === 'days' ? g.v : Math.max(1, Math.ceil(w.price / g.v - 1e-9));
    var daily = g.t === 'days' ? w.price / g.v : g.v;
    var waited = Math.max(0, Math.floor((Date.now() - w.ct) / 86400000));
    s += '<li class="wish"><div class="wish-top">' + stickerHTML(w) +
      '<div class="wish-names"><b class="wish-name">' + esc(w.name) + '</b><span class="item-meta"><span>' + (waited ? '想了 ' + n(waited) + ' 天' : '今天刚种草') + '</span>' +
      (w.cat ? '<span class="nb"><span class="sep">·</span><span>' + esc(w.cat) + '</span></span>' : '') + '</span></div>' +
      '<span class="tag tag-line"><b class="num">' + mHTML(w.price) + '</b></span></div>' +
      '<div class="kv3"><div><span>第一天</span><b class="num">' + esc(dTxt(w.price)) + '</b></div><div><span>用满一年</span><b class="num">' + esc(dTxt(w.price / 365)) + '</b></div>' +
      '<div><span>' + (g.t === 'days' ? esc(goalText(g)) : '回本要用') + '</span><b class="num">' + (g.t === 'days' ? esc(dTxt(daily)) : n(days) + ' 天') + '</b></div></div>' +
      (w.note ? '<p class="note-tx">' + esc(w.note).replace(/\n/g, '<br>') + '</p>' : '') +
      '<div class="wish-acts">' + (w.url ? '<a class="btn btn-sm" href="' + esc(w.url) + '" target="_blank" rel="noopener noreferrer">' + ic('link') + '<span>链接</span></a>' : '') +
      '<button type="button" class="btn btn-sm" data-act="wish-edit" data-id="' + esc(w.id) + '">' + ic('edit') + '<span>编辑</span></button>' +
      '<button type="button" class="btn btn-sm btn-primary" data-act="wish-buy" data-id="' + esc(w.id) + '">' + ic('check') + '<span>买了</span></button></div></li>';
  });
  s += '</ul>';
  return { bar: bar, title: '心愿', body: s };
};

/* ---------- 设置 ---------- */

VIEWS.prefs = function () {
  var set = S.settings, bar = barHTML('设置', { back: true, noPrefs: true });
  var g = set.goal;
  var segBtn = function (key, val, label, on) {
    return '<button type="button" class="seg-b' + (on ? ' is-on' : '') + '" data-act="set" data-k="' + key + '" data-v="' + val + '" aria-pressed="' + on + '">' + label + '</button>';
  };
  var accents = [['yellow', '黄'], ['mint', '薄荷'], ['sky', '天蓝'], ['pink', '粉'], ['orange', '橙']];
  var last = S.bk.t ? new Date(S.bk.t) : null;
  var lastTx = last ? C.todayStr(last) + (S.bk.n ? '，之后有 ' + n(S.bk.n) + ' 处改动' : '，之后没有改动') : (S.assets.length || S.wishes.length ? '还没有备份过' : '还没有数据');
  var s = '';

  s += '<section class="card sec"><header class="sec-h"><h2>外观</h2></header>' +
    '<div class="fld"><span class="fld-l">主题</span><div class="seg seg-full" role="group" aria-label="主题">' +
      segBtn('theme', 'auto', '跟随系统', set.theme === 'auto') + segBtn('theme', 'light', '浅色', set.theme === 'light') + segBtn('theme', 'dark', '深色', set.theme === 'dark') + '</div></div>' +
    '<div class="fld"><span class="fld-l">价签颜色</span><div class="swatches" role="group" aria-label="价签颜色">' + accents.map(function (a) {
      return '<button type="button" class="swatch sw-' + a[0] + (set.accent === a[0] ? ' is-on' : '') + '" data-act="set" data-k="accent" data-v="' + a[0] + '" aria-pressed="' + (set.accent === a[0]) + '" aria-label="' + a[1] + '">' + (set.accent === a[0] ? ic('check') : '') + '</button>';
    }).join('') + '</div></div>' +
    '<div class="fld"><span class="fld-l">贴纸</span><button type="button" class="btn" data-act="go" data-to="#cats">类别和边框颜色' + ic('right') + '</button></div></section>';

  s += '<section class="card sec"><header class="sec-h"><h2>怎么算</h2></header>' +
    '<div class="fld"><span class="fld-l">默认的回本目标</span><div class="seg seg-full" role="group" aria-label="默认的回本目标">' +
      segBtn('goalT', 'days', '用满几年', g.t === 'days') + segBtn('goalT', 'daily', '日均降到', g.t === 'daily') + '</div>' +
      '<div class="inl"><input class="inp inp-sm num" id="setGoalV" inputmode="decimal" autocomplete="off" data-on="goalV" value="' + (g.t === 'days' ? esc(String(Math.round(g.v / 365 * 100) / 100)) : esc(String(g.v))) + '" aria-label="' + (g.t === 'days' ? '年数' : '日均金额') + '">' +
      '<span>' + (g.t === 'days' ? '年' : esc(cur()) + ' / 天') + '</span></div>' +
      '<p class="fld-h">没有单独设目标的装备都按这个算。单件的目标在它的详情页里改。</p></div>' +
    '<div class="fld"><span class="fld-l">记账货币</span><div class="seg" role="group" aria-label="记账货币">' + ['¥', '$', '€', '£'].map(function (c0) {
      return segBtn('cur', c0, c0, set.cur === c0); }).join('') + '</div></div>' +
    '<div class="fld"><span class="fld-l">外币录入</span><div class="inl"><div class="seg" role="group" aria-label="外币">' + ['$', '¥', '€', '£', 'HK$'].filter(function (c0) { return c0 !== set.cur; }).map(function (c0) {
      return segBtn('fxSym', c0, c0, set.fxSym === c0); }).join('') + '</div></div>' +
      '<div class="inl"><span>1 ' + esc(set.fxSym) + ' =</span><input class="inp inp-sm num" id="setFxRate" inputmode="decimal" autocomplete="off" data-on="fxRate" value="' + esc(String(set.fxRate)) + '" aria-label="汇率"><span>' + esc(set.cur) + '</span></div>' +
      '<p class="fld-h">录入金额时点一下货币符号，就能按外币填、自动换算。每次用过的汇率会记在这里。</p></div></section>';

  s += '<section class="card sec"><header class="sec-h"><h2>数据</h2></header>' +
    '<p class="sec-p">数据只存在这台设备的这个浏览器里，不会上传到任何地方。换手机、清浏览器数据之前记得备份。</p>' +
    '<p class="sec-p">上次备份：<span class="num">' + esc(lastTx) + '</span></p>' +
    '<div class="btncol"><button class="btn btn-primary" type="button" data-act="export">' + ic('share') + '备份</button>' +
    '<button class="btn" type="button" data-act="import">' + ic('paste') + '恢复 / 导入</button>' +
    '<button class="btn" type="button" data-act="csv">' + ic('file') + '导出成表格（CSV）</button>' +
    (store.get(LS_STASH) ? '<button class="btn" type="button" data-act="unstash">' + ic('undo') + '撤销上一次导入</button>' : '') +
    '<button class="btn btn-danger" type="button" data-act="wipe">' + ic('trash') + '清空全部数据</button></div></section>';

  s += '<section class="card sec"><header class="sec-h"><h2>关于</h2></header>' +
    '<dl class="kv"><div><dt>版本</dt><dd class="num">' + esc(C.VERSION) + (ENV.preview ? '（预览）' : '') + '</dd></div>' +
    '<div><dt>数据</dt><dd>' + S.assets.length + ' 件装备，' + S.wishes.length + ' 个心愿</dd></div>' +
    '<div><dt>本机存储</dt><dd>' + (store.ok() ? '正常' : '不可用（无痕模式？）') + '</dd></div></dl>' +
    '<details class="more"><summary>日均是怎么算的</summary><div class="prose">' +
    '<p>持有天数从购入那天算第 1 天。日均 = 总成本 ÷ 持有天数，总成本 = 购入金额 + 追加花费。</p>' +
    '<p>服役中的装备算到今天；已退役和已卖出的停在那一天。已卖出的「实际日均」=（总成本 − 卖出金额）÷ 持有天数。</p>' +
    '<p>日均降到目标以下就算回本。目标写成「用满 N 年」和写成「日均降到多少」是一回事，只是换了个说法。</p>' +
    '<p>合计只算服役中的；标了「大件」的可以选择不算进合计。</p></div></details></section>';
  return { bar: bar, title: '设置', body: s };
};

/* ---------- 类别和边框 ---------- */

VIEWS.cats = function () {
  var set = S.settings, bar = barHTML('类别和边框', { back: true, noPrefs: true });
  var rows = C.catList(S), noCat = S.assets.filter(function (a) { return !a.cat; }).length;
  var segBtn = function (val, label) {
    var on = set.edge === val;
    return '<button type="button" class="seg-b' + (on ? ' is-on' : '') + '" data-act="set" data-k="edge" data-v="' + val + '" aria-pressed="' + on + '">' + label + '</button>';
  };
  // 拿几件装备当样品（尽量挑类别不同的），看得出粗细和颜色的效果
  var demo = [], seenCat = {};
  S.assets.forEach(function (a) { if (demo.length < 4 && !seenCat['$' + a.cat]) { seenCat['$' + a.cat] = true; demo.push(a); } });
  S.assets.forEach(function (a) { if (demo.length < 4 && demo.indexOf(a) < 0) demo.push(a); });
  if (!demo.length) demo = [{ id: 'sample-1', icon: '📱', cat: '' }, { id: 'sample-2', icon: '🎧', cat: '' }, { id: 'sample-3', icon: '🎮', cat: '' }];
  var rots = [-5, 4, -3, 6];
  var s = '<section class="card sec"><header class="sec-h"><h2>贴纸边框</h2></header>' +
    '<div class="edge-demo" aria-hidden="true">' + demo.map(function (a, i) {
      return '<span class="edge-demo-i" style="--sz:58px;--rot:' + rots[i % 4] + 'deg">' + stickerHTML(a, 'stk-wall') + '</span>';
    }).join('') + '</div>' +
    '<div class="fld"><span class="fld-l">粗细</span><div class="seg seg-full" role="group" aria-label="边框粗细">' + segBtn('thin', '细') + segBtn('normal', '标准') + segBtn('bold', '粗') + '</div></div>' +
    '<div class="fld"><span class="fld-l">没有单独设颜色的贴纸</span><button type="button" class="row" data-act="edge-color">' + catDot(set.edgeColor, 'catdot-lg') +
      '<span class="row-main"><span>' + (set.edgeColor ? esc(colorName(set.edgeColor)) : '白色') + '</span><small>没有类别、或者类别没设颜色时用这个颜色</small></span>' + ic('right', 'row-go') + '</button></div></section>';

  s += '<section class="card sec"><header class="sec-h"><h2>类别</h2><button type="button" class="lnk" data-act="cat-new">' + ic('plus') + '新建类别</button></header>';
  if (rows.length) {
    s += '<ul class="rows">' + rows.map(function (r) {
      var cnt = r.n ? r.n + ' 件装备' : '';
      if (r.w) cnt += (cnt ? '，' : '') + r.w + ' 个心愿';
      if (!cnt) cnt = '还没有装备';
      return '<li><button type="button" class="row" data-act="cat-edit" data-name="' + esc(r.name) + '">' + catDot(r.color, 'catdot-lg') +
        '<span class="row-main"><span>' + esc(r.name) + '</span><small>' + cnt + (r.color ? '，' + esc(colorName(r.color)) : '，没设颜色') + '</small></span>' + ic('right', 'row-go') + '</button></li>';
    }).join('') + '</ul>';
    if (rows.some(function (r) { return !r.color; })) {
      s += '<button type="button" class="btn" data-act="cat-auto">给没设颜色的类别一键配色</button>';
    }
  } else {
    s += '<p class="sec-p">还没有类别。新建一个，比如「外设」「游戏设备」，再勾选哪些装备属于它。</p>';
  }
  s += '<p class="sec-p">点一个类别可以改名字、换颜色、勾选哪些装备属于它。把一个类别改成和另一个同名，两个就合并了。' +
    (noCat ? '现在还有 ' + noCat + ' 件装备没有类别。' : '') + '</p></section>';
  return { bar: bar, title: '类别和边框', body: s };
};

/* ====================================================================== 弹出面板和表单 */

var sheets = [];

/**
 * 从底部滑上来的面板。
 * opts: { title, body, save: {label, fn(el) → true 表示可以关}, cancel, small, mount(el), onClose() }
 */
function openSheet(opts) {
  var wrap = doc.createElement('div');
  wrap.className = 'sheet-wrap' + (opts.small ? ' is-small' : '');
  wrap.innerHTML = '<div class="scrim" data-act="sheet-close"></div>' +
    '<div class="sheet" role="dialog" aria-modal="true" aria-label="' + esc(opts.title) + '" tabindex="-1">' +
    '<header class="sheet-h"><button type="button" class="sheet-x" data-act="sheet-close">' + esc(opts.cancel || '取消') + '</button>' +
    '<h2>' + esc(opts.title) + '</h2>' +
    (opts.save ? '<button type="button" class="sheet-ok" data-act="sheet-save">' + esc(opts.save.label || '保存') + '</button>' : '<span class="sheet-ok is-ghost"></span>') + '</header>' +
    '<div class="sheet-b">' + opts.body + '</div></div>';
  $('#sheets').appendChild(wrap);
  var sh = { el: wrap, opts: opts, prev: doc.activeElement };
  sheets.push(sh);
  rootEl.classList.add('has-sheet');
  if (opts.mount) opts.mount(wrap);
  fitSheets();
  requestAnimationFrame(function () { wrap.classList.add('is-in'); });
  var first = opts.focus ? $(opts.focus, wrap) : null;
  try { (first || $('.sheet', wrap)).focus({ preventScroll: true }); } catch (e) { /* 忽略 */ }
  return sh;
}

function closeSheet(sh) {
  sh = sh || sheets[sheets.length - 1];
  if (!sh) return;
  var i = sheets.indexOf(sh);
  if (i >= 0) sheets.splice(i, 1);
  if (!sheets.length) rootEl.classList.remove('has-sheet');
  sh.el.classList.remove('is-in');
  var el = sh.el;
  setTimeout(function () { if (el.parentNode) el.parentNode.removeChild(el); }, 220);
  if (sh.opts.onClose) sh.opts.onClose();
  try { if (sh.prev && doc.contains(sh.prev)) sh.prev.focus({ preventScroll: true }); } catch (e) { /* 忽略 */ }
}

function closeAllSheets() { while (sheets.length) closeSheet(sheets[sheets.length - 1]); }

/** 手机键盘弹出来时可视区域会变矮：让面板只占看得见的那一块，顶上的「取消 / 保存」始终够得着。 */
function fitSheets() {
  var vv = window.visualViewport;
  if (!vv) return;
  var squeezed = vv.height < window.innerHeight - 90;
  sheets.forEach(function (sh) {
    var st = sh.el.style;
    if (squeezed) { st.top = Math.max(0, vv.offsetTop) + 'px'; st.bottom = 'auto'; st.height = vv.height + 'px'; }
    else { st.top = ''; st.bottom = ''; st.height = ''; }
  });
}
if (window.visualViewport) {
  window.visualViewport.addEventListener('resize', fitSheets);
  window.visualViewport.addEventListener('scroll', fitSheets);
}

function saveSheet() {
  var sh = sheets[sheets.length - 1];
  if (!sh || !sh.opts.save) return;
  if (sh.opts.save.fn(sh.el) !== false) closeSheet(sh);
}

/** 页面里自己做的确认框（有些环境不显示浏览器自带的 confirm）。 */
function confirmBox(o, onOk) {
  openSheet({
    title: o.title, small: true, cancel: '取消',
    body: '<p class="confirm-tx">' + esc(o.text) + '</p><div class="btncol"><button type="button" class="btn ' + (o.danger ? 'btn-danger-solid' : 'btn-primary') + '" data-act="confirm-ok">' + esc(o.ok || '确定') + '</button>' +
      '<button type="button" class="btn" data-act="sheet-close">取消</button></div>',
    mount: function (el) { el._onOk = onOk; }
  });
}

/* ---------- 表单零件 ---------- */

function fieldError(el, msg) {
  var fld = el.closest ? el.closest('.fld') : null;
  if (!fld) return;
  var e = $('.fld-e', fld);
  if (!e) { e = doc.createElement('p'); e.className = 'fld-e'; fld.appendChild(e); }
  e.textContent = msg || ''; e.hidden = !msg;
  fld.classList.toggle('has-err', !!msg);
  el.setAttribute('aria-invalid', msg ? 'true' : 'false');
}

function clearErrors(root) {
  $$('.fld.has-err', root).forEach(function (f) { f.classList.remove('has-err'); var e = $('.fld-e', f); if (e) e.hidden = true; });
}

/** 金额输入框：左边的货币符号可以点，点一下切换成按外币填（带汇率，自动换算）。 */
function moneyFld(id, label, amt, fx, hint) {
  var set = S.settings, isFx = !!fx;
  var shown = isFx ? fx.a : amt;
  return '<div class="fld" data-money="' + id + '">' +
    '<label class="fld-l" for="' + id + '">' + esc(label) + '</label>' +
    '<div class="money" data-mode="' + (isFx ? 'fx' : 'base') + '">' +
    '<button type="button" class="money-cur num" data-act="fx-toggle" aria-label="切换币种">' + esc(isFx ? (fx.s || set.fxSym) : set.cur) + '</button>' +
    '<input class="inp num" id="' + id + '" inputmode="decimal" autocomplete="off" placeholder="0.00" data-on="money" value="' + (shown == null ? '' : esc(String(shown))) + '"></div>' +
    '<div class="fxrow"' + (isFx ? '' : ' hidden') + '><span>× 汇率</span>' +
    '<input class="inp inp-sm num" id="' + id + '-rate" inputmode="decimal" autocomplete="off" data-on="money" value="' + esc(String(isFx ? fx.r : set.fxRate)) + '" aria-label="汇率">' +
    '<span class="fx-out num"></span></div>' +
    (hint ? '<p class="fld-h">' + esc(hint) + '</p>' : '') + '</div>';
}

function readMoney(root, id, required) {
  var inp = $('#' + id, root), box = inp.closest('.money'), mode = box.getAttribute('data-mode');
  var raw = inp.value.trim();
  if (!raw) return required ? { err: '填一下金额', el: inp } : { amt: null, fx: null };
  var a = C.parseMoney(raw);
  if (!isFinite(a)) return { err: '金额看不懂，只填数字就行', el: inp };
  if (mode !== 'fx') return { amt: a, fx: null };
  var rEl = $('#' + id + '-rate', root), r = parseFloat(String(rEl.value).replace(/[,，\s]/g, ''));
  if (!(r > 0 && r < 1e6)) return { err: '汇率要是一个大于 0 的数', el: rEl };
  return { amt: C.round2(a * r), fx: { a: a, r: r, s: $('.money-cur', box).textContent }, rate: r };
}

function updateMoneyOut(fld) {
  var id = fld.getAttribute('data-money'), box = $('.money', fld), out = $('.fx-out', fld);
  if (box.getAttribute('data-mode') !== 'fx') { out.textContent = ''; return; }
  var a = C.parseMoney($('#' + id, fld).value), r = parseFloat($('#' + id + '-rate', fld).value);
  out.textContent = (isFinite(a) && r > 0) ? '= ' + mTxt(C.round2(a * r), 2) : '';
}

function dateFld(id, label, value, min, max) {
  return '<div class="fld"><label class="fld-l" for="' + id + '">' + esc(label) + '</label>' +
    '<input class="inp num" type="date" id="' + id + '" value="' + esc(value || '') + '"' + (min ? ' min="' + esc(min) + '"' : '') + (max ? ' max="' + esc(max) + '"' : '') + ' data-on="date"></div>';
}

function readDate(root, id) {
  var el = $('#' + id, root), v = C.looseDate(el.value);
  return v ? { v: v, el: el } : { err: '选一个日期', el: el };
}

/* 图标选择器：上面一排分类，下面是按分类排好的几百个表情（清单在 core.js 的 ICON_GROUPS）。
 * 表情到面板第一次展开时才画出来，不拖慢表单打开。 */
function iconPanelHTML() {
  return '<div class="iconpanel" hidden>' +
    '<div class="icontabs" role="group" aria-label="图标分类"></div>' +
    '<div class="icongrid" role="group" aria-label="选一个图标"></div>' +
    '<div class="inl"><input class="inp inp-sm" id="f-icon-custom" maxlength="16" autocomplete="off" placeholder="或者输入别的表情" data-on="icon-custom" aria-label="输入一个表情">' +
    '<label class="btn btn-sm">' + ic('cam') + '<span>用照片</span><input type="file" id="f-photo" accept="image/*" data-on="photo" class="sr"></label>' +
    '<button type="button" class="btn btn-sm" data-act="photo-clear" id="f-photo-clear" hidden>不用照片</button></div>' +
    '<p class="fld-h" id="f-photo-h">照片会缩小后只存在这台设备里。白底的产品图会自动去掉背景，变成贴纸。</p></div>';
}

function fillIconPanel(root) {
  var grid = $('.icongrid', root), tabs = $('.icontabs', root);
  if (!grid || grid.firstChild) return;
  var groups = C.ICON_GROUPS.slice();
  // 自己已经用过的图标放在最前面一组，用得多的在前
  var cnt = {}, mine = [];
  S.assets.concat(S.wishes).forEach(function (a) {
    if (!a.icon) return;
    if (!cnt[a.icon]) { cnt[a.icon] = 0; mine.push(a.icon); }
    cnt[a.icon]++;
  });
  if (mine.length) {
    var rank = {}; mine.forEach(function (e, i) { rank[e] = i; });
    mine.sort(function (p, q) { return cnt[q] - cnt[p] || rank[p] - rank[q]; });
    groups.unshift({ name: '用过', list: mine.slice(0, 21) });
  }
  tabs.innerHTML = groups.map(function (g, i) {
    return '<button type="button" class="icontab' + (i ? '' : ' is-on') + '" data-act="icon-jump" data-g="' + i + '" aria-pressed="' + (i ? 'false' : 'true') + '">' + esc(g.name) + '</button>';
  }).join('');
  grid.innerHTML = groups.map(function (g) {
    return '<div class="icong"><div class="icong-h">' + esc(g.name) + '</div><div class="icong-b">' + g.list.map(function (e) {
      return '<button type="button" class="iconopt emoji" data-act="icon-set" data-v="' + esc(e) + '">' + esc(e) + '</button>';
    }).join('') + '</div></div>';
  }).join('');
  grid.addEventListener('scroll', function () { spyIconTabs(root); }, { passive: true });
}

function markIconTab(root, i) {
  var tabs = $('.icontabs', root), bs = $$('.icontab', tabs), b = bs[i];
  if (!b) return;
  bs.forEach(function (x, k) { x.classList.toggle('is-on', k === i); x.setAttribute('aria-pressed', k === i ? 'true' : 'false'); });
  var l = b.offsetLeft, r = l + b.offsetWidth;                     // 让当前分类的按钮留在看得见的地方
  if (l < tabs.scrollLeft + 26) tabs.scrollLeft = Math.max(0, l - 26);
  else if (r > tabs.scrollLeft + tabs.clientWidth - 26) tabs.scrollLeft = r - tabs.clientWidth + 26;
}

/** 表情区滚到哪一组，上面那排分类就亮哪个。 */
function spyIconTabs(root) {
  var grid = $('.icongrid', root);
  if (!grid) return;
  if (grid._jump != null) { markIconTab(root, grid._jump); return; }   // 刚点了分类跳过来的：以点的那个为准
  var gs = $$('.icong', grid), top = grid.scrollTop + 6, cur = 0;
  for (var i = 0; i < gs.length; i++) if (gs[i].offsetTop <= top) cur = i;
  if (grid.scrollTop > 0 && grid.scrollTop + grid.clientHeight >= grid.scrollHeight - 2) cur = gs.length - 1;
  markIconTab(root, cur);
}

/** 展开面板时把当前选中的那个表情滚到看得见的地方。 */
function revealIcon(root) {
  var grid = $('.icongrid', root);
  if (!grid || !grid.firstChild) return;
  var on = $('.iconopt.is-on', grid);
  grid.scrollTop = on ? Math.max(0, on.offsetTop - (grid.clientHeight - on.offsetHeight) / 2) : 0;
  spyIconTabs(root);
}

function setFormIcon(root, icon, manual) {
  var el = $('#f-icon', root);
  if (el) el.textContent = icon;
  root._icon = icon;
  if (manual) root._iconManual = true;
  $$('.iconopt', root).forEach(function (b) { b.classList.toggle('is-on', b.getAttribute('data-v') === icon); });
}

function setFormPhoto(root, url) {
  root._photo = url;                       // null: 不用照片；字符串: 新选的照片；undefined: 没动
  var box = $('.iconpick .stk', root);
  box.innerHTML = url ? '<img class="stk-img" alt="" src="' + esc(url) + '">' : '<span class="stk-e emoji" id="f-icon">' + esc(root._icon || '📦') + '</span>';
  var clr = $('#f-photo-clear', root); if (clr) clr.hidden = !url;
}

function catChips() {
  // 自己建的类别全部列出来（按建的先后），然后是用过的（用得多的在前）。
  // 还没建过类别的时候，不够 14 个再拿常见的补上；建过以后就只列自己的
  var rows = C.catList(S), out = rows.filter(function (r) { return r.defined; }).map(function (r) { return r.name; });
  rows.forEach(function (r) { if (!r.defined && out.length < 14) out.push(r.name); });
  if (!S.cats.length) CAT_CHOICES.forEach(function (c0) { if (out.length < 14 && out.indexOf(c0) < 0) out.push(c0); });
  return '<div class="chips" role="group" aria-label="常用类别">' + out.slice(0, 30).map(function (c0) {
    var col = C.catColor(S, c0);
    return '<button type="button" class="chip chip-btn" data-act="cat-set" data-v="' + esc(c0) + '">' + (col ? catDot(col) : '') + esc(c0) + '</button>';
  }).join('') + '</div>';
}

function goalFld(goal) {
  var t = goal ? goal.t : 'def', def = S.settings.goal;
  var val = !goal ? '' : goal.t === 'days' ? String(Math.round(goal.v / 365 * 100) / 100) : String(goal.v);
  var b = function (v, label) { return '<button type="button" class="seg-b' + (t === v ? ' is-on' : '') + '" data-act="goal-t" data-v="' + v + '" aria-pressed="' + (t === v) + '">' + label + '</button>'; };
  return '<div class="fld" id="f-goal" data-t="' + t + '"><span class="fld-l">回本目标</span>' +
    '<div class="seg seg-full" role="group" aria-label="回本目标">' + b('def', '默认') + b('days', '用满几年') + b('daily', '日均降到') + '</div>' +
    '<div class="inl" id="f-goal-row"' + (t === 'def' ? ' hidden' : '') + '><input class="inp inp-sm num" id="f-goal-v" inputmode="decimal" autocomplete="off" data-on="goal-v" value="' + esc(val) + '" aria-label="目标数值">' +
    '<span id="f-goal-u">' + (t === 'daily' ? esc(cur()) + ' / 天' : '年') + '</span></div>' +
    '<p class="fld-h" id="f-goal-h">默认目标：' + esc(goalText(def)) + '</p></div>';
}

function readGoal(root) {
  var box = $('#f-goal', root), t = box.getAttribute('data-t');
  if (t === 'def') return { goal: null };
  var el = $('#f-goal-v', root), v = parseFloat(String(el.value).replace(/[,，\s¥￥$]/g, ''));
  if (!(v > 0)) return { err: t === 'days' ? '填一个大于 0 的年数' : '填一个大于 0 的金额', el: el };
  if (t === 'days') {
    var d = Math.round(v * 365);
    if (d < 1 || d > 36500) return { err: '年数在 0 到 100 之间', el: el };
    return { goal: { t: 'days', v: d } };
  }
  return { goal: { t: 'daily', v: v } };
}

function updateGoalHint(root) {
  var box = $('#f-goal', root); if (!box) return;
  var t = box.getAttribute('data-t'), h = $('#f-goal-h', root);
  var priceEl = root.querySelector('[data-money="f-price"]'), price = NaN;
  if (priceEl) { var m = readMoney(root, 'f-price', false); price = m.amt == null ? NaN : m.amt; }
  else if (root._cost != null) price = root._cost;
  var g = t === 'def' ? S.settings.goal : readGoal(root).goal;
  if (!g) { h.textContent = t === 'days' ? '比如 3，就是用满 3 年算回本。' : '比如 5，就是日均降到 ' + cur() + '5 算回本。'; return; }
  var tx = t === 'def' ? '默认目标：' + goalText(g) : '';
  if (isFinite(price) && price > 0) {
    if (g.t === 'days') tx += (tx ? '，' : '') + '相当于日均降到 ' + dTxt(price / g.v);
    else { var d = Math.max(1, Math.ceil(price / g.v - 1e-9)); tx += (tx ? '，' : '') + '大约要用 ' + n(d) + ' 天（' + (d / 365).toFixed(1) + ' 年）'; }
  }
  h.textContent = tx || '填上金额后会算出对应的数字。';
}

/* ---------- 添加 / 编辑装备 ---------- */

function assetForm(asset, preset, after) {
  var isEdit = !!asset;
  var a = asset || Object.assign({ name: '', cat: '', icon: '', buy: today(), price: null, status: 'active', note: '' }, preset || {});
  var advOpen = isEdit && (a.goal || a.status !== 'active' || a.big || a.resale != null || a.note);
  var st = a.status || 'active';
  var sb = function (v, label) { return '<button type="button" class="seg-b' + (st === v ? ' is-on' : '') + '" data-act="st" data-v="' + v + '" aria-pressed="' + (st === v) + '">' + label + '</button>'; };
  var body = '<div class="form">' +
    '<div class="fld fld-row"><button type="button" class="iconpick" data-act="pick-icon" aria-label="选图标" aria-expanded="false"><span class="stk stk-lg"><span class="stk-e emoji" id="f-icon">' + esc(a.icon || '📦') + '</span></span><small>换图标</small></button>' +
    '<div class="fld-grow"><label class="fld-l" for="f-name">名称</label><input class="inp" id="f-name" maxlength="60" autocomplete="off" enterkeyhint="next" placeholder="比如：iPhone 15 Pro" data-on="name" value="' + esc(a.name) + '"></div></div>' +
    iconPanelHTML() +
    '<div class="fld"><label class="fld-l" for="f-cat">类别</label><input class="inp" id="f-cat" maxlength="20" autocomplete="off" placeholder="比如：手机" data-on="name" value="' + esc(a.cat || '') + '">' + catChips() + '</div>' +
    '<div class="fld2">' + dateFld('f-buy', '购入日期', a.buy) + moneyFld('f-price', '购入金额', a.price, a.fx) + '</div>' +
    '<details class="adv"' + (advOpen ? ' open' : '') + '><summary>更多：目标、状态、估价、备注</summary><div class="adv-b">' +
    goalFld(a.goal) +
    '<div class="fld" id="f-st" data-v="' + st + '"><span class="fld-l">状态</span><div class="seg seg-full" role="group" aria-label="状态">' + sb('active', '服役中') + sb('retired', '已退役') + sb('sold', '已卖出') + '</div></div>' +
    '<div id="f-end-row"' + (st === 'active' ? ' hidden' : '') + '>' + dateFld('f-end', st === 'sold' ? '卖出日期' : '退役日期', a.end || today(), null, today()) + '</div>' +
    '<div id="f-sold-row"' + (st === 'sold' ? '' : ' hidden') + '>' + moneyFld('f-sold', '卖出金额', a.sold, a.soldFx) + '</div>' +
    '<div class="fld"><label class="swrow"><input type="checkbox" class="sw" id="f-big"' + (a.big ? ' checked' : '') + '><span>大件</span><small>比如汽车。合计里可以选择不算它，免得把别的都盖住</small></label></div>' +
    moneyFld('f-resale', '二手估价（可不填）', a.resale, null, '现在出手大概能卖多少。用来算「如果现在卖掉」。') +
    '<div class="fld"><label class="fld-l" for="f-note">备注</label><textarea class="inp inp-area" id="f-note" maxlength="500" rows="3">' + esc(a.note || '') + '</textarea></div>' +
    '</div></details></div>';

  openSheet({
    title: isEdit ? '编辑装备' : '添加装备', body: body, focus: isEdit ? null : '#f-name',
    mount: function (el) {
      el._icon = a.icon || '📦'; el._iconManual = isEdit || !!(preset && preset.icon); el._assetId = isEdit ? a.id : null;
      if (isEdit && a.photo && photoCache[a.id]) setFormPhoto(el, photoCache[a.id]), el._photo = undefined;
      $$('[data-money]', el).forEach(updateMoneyOut);
      updateGoalHint(el);
    },
    save: { label: isEdit ? '保存' : '添加', fn: function (el) {
      clearErrors(el);
      var errs = [];
      var name = C.cleanLine($('#f-name', el).value, 60);
      if (!name) errs.push({ el: $('#f-name', el), err: '起个名字' });
      var buy = readDate(el, 'f-buy'); if (buy.err) errs.push(buy);
      var price = readMoney(el, 'f-price', true); if (price.err) errs.push(price);
      var goal = readGoal(el); if (goal.err) errs.push(goal);
      var status = $('#f-st', el).getAttribute('data-v'), end = null, sold = null;
      if (status !== 'active') {
        end = readDate(el, 'f-end');
        if (end.err) errs.push(end);
        else if (!buy.err && end.v < buy.v) errs.push({ el: end.el, err: '不能早于购入日期' });
        else if (end.v > today()) errs.push({ el: end.el, err: '不能晚于今天' });
        if (status === 'sold') { sold = readMoney(el, 'f-sold', true); if (sold.err) errs.push(sold); }
      }
      var resale = readMoney(el, 'f-resale', false); if (resale.err) errs.push(resale);
      if (errs.length) {
        errs.forEach(function (e) { fieldError(e.el, e.err); });
        var adv = $('.adv', el); if (errs.some(function (e) { return adv.contains(e.el); })) adv.open = true;
        try { errs[0].el.focus(); } catch (e2) { /* 忽略 */ }
        return false;
      }
      var id = isEdit ? a.id : C.newId('a');
      var next = {
        id: id, name: name, cat: $('#f-cat', el).value, icon: el._icon, buy: buy.v, price: price.amt, fx: price.fx,
        extras: isEdit ? a.extras : [], status: status, end: end ? end.v : undefined, sold: sold ? sold.amt : undefined, soldFx: sold ? sold.fx : undefined,
        goal: goal.goal, resale: resale.amt, big: $('#f-big', el).checked, note: $('#f-note', el).value,
        photo: isEdit ? a.photo : 0, ct: isEdit ? a.ct : Date.now(), ut: Date.now()
      };
      if (el._photo === null) next.photo = 0;
      else if (typeof el._photo === 'string') next.photo = Date.now();
      var clean = C.sanitizeAsset(next, {});
      if (!clean) { toast('没保存上：数据不完整'); return false; }
      clean.id = id;
      var lastRate = price.rate || (sold && sold.rate) || 0;
      if (typeof el._photo === 'string') { photoCache[id] = el._photo; Photos.put(id, el._photo).catch(function () { toast('照片没存上，先用图标'); }); }
      else if (el._photo === null) { delete photoCache[id]; Photos.del(id); }
      mutate(function (s) {
        if (isEdit) { for (var i = 0; i < s.assets.length; i++) if (s.assets[i].id === id) s.assets[i] = clean; }
        else s.assets.push(clean);
        if (lastRate) s.settings.fxRate = lastRate;
        if (after) after(s, clean);
      }, { stay: !isEdit });
      if (!isEdit) { toast('已添加 ' + name); nav('#a-' + id); }
      return true;
    } }
  });
}

/* ---------- 追加花费 ---------- */

function extraForm(asset, extra) {
  var isEdit = !!extra, x = extra || { name: '', date: today(), amt: null };
  var body = '<div class="form">' +
    '<div class="fld"><label class="fld-l" for="x-name">这笔花在什么上</label><input class="inp" id="x-name" maxlength="40" autocomplete="off" placeholder="比如：保护壳、换电池、延保" value="' + esc(x.name) + '"></div>' +
    '<div class="fld2">' + dateFld('x-date', '日期', x.date, null, today()) + moneyFld('x-amt', '金额', x.amt, x.fx) + '</div>' +
    (isEdit ? '<button type="button" class="btn btn-danger" data-act="extra-del" data-id="' + esc(asset.id) + '" data-x="' + esc(x.id) + '">' + ic('trash') + '删除这一笔</button>' : '') + '</div>';
  openSheet({
    title: isEdit ? '改这一笔' : '记一笔追加花费', body: body, focus: isEdit ? null : '#x-name',
    mount: function (el) { $$('[data-money]', el).forEach(updateMoneyOut); },
    save: { label: '保存', fn: function (el) {
      clearErrors(el);
      var errs = [], d = readDate(el, 'x-date'), m = readMoney(el, 'x-amt', true);
      if (d.err) errs.push(d); else if (d.v > today()) errs.push({ el: d.el, err: '不能晚于今天' });
      if (m.err) errs.push(m); else if (!(m.amt > 0)) errs.push({ el: $('#x-amt', el), err: '金额要大于 0' });
      if (errs.length) { errs.forEach(function (e) { fieldError(e.el, e.err); }); try { errs[0].el.focus(); } catch (e2) { /* 忽略 */ } return false; }
      var item = { id: isEdit ? x.id : C.newId('x'), name: C.cleanLine($('#x-name', el).value, 40) || '追加花费', date: d.v, amt: m.amt };
      if (m.fx) item.fx = m.fx;
      mutate(function (s) {
        var a = assetById(asset.id); if (!a) return;
        if (isEdit) a.extras = a.extras.map(function (e) { return e.id === x.id ? item : e; }); else a.extras.push(item);
        a.ut = Date.now();
        if (m.rate) s.settings.fxRate = m.rate;
      });
      return true;
    } }
  });
}

/* ---------- 退役 / 卖出 / 估价 / 目标 ---------- */

function endPreview(el, asset, kind) {
  var out = $('#e-preview', el), d = C.looseDate($('#e-date', el).value);
  if (!d || d < asset.buy || d > today()) { out.textContent = ''; return; }
  var tmp = Object.assign({}, asset, { status: kind, end: d });
  if (kind === 'sold') { var m = readMoney(el, 'e-sold', false); tmp.sold = m.amt || 0; }
  var c = C.calc(tmp, today(), S.settings);
  out.textContent = kind === 'sold'
    ? '持有 ' + n(c.days) + ' 天，净花费 ' + mTxt(c.net) + '，实际日均 ' + dTxt(c.netDaily) + '。'
    : '服役 ' + n(c.days) + ' 天，日均定格在 ' + dTxt(c.daily) + '。';
}

function endForm(asset, kind) {
  var sold = kind === 'sold';
  var body = '<div class="form"><p class="sec-p">' + (sold ? '记下卖了多少钱，就能算出这段时间实际每天花了多少。' : '退役以后它的日均不再往下降，会停在退役那天。之后还可以再记卖出。') + '</p>' +
    '<div class="fld2">' + dateFld('e-date', sold ? '卖出日期' : '退役日期', asset.status === 'retired' && asset.end ? asset.end : today(), asset.buy, today()) +
    (sold ? moneyFld('e-sold', '卖出金额', asset.resale, null) : '') + '</div><p class="preview" id="e-preview" role="status"></p></div>';
  openSheet({
    title: sold ? '卖出' : '退役', body: body, focus: sold ? '#e-sold' : null,
    mount: function (el) { el._end = { asset: asset, kind: kind }; endPreview(el, asset, kind); },
    save: { label: sold ? '确认卖出' : '确认退役', fn: function (el) {
      clearErrors(el);
      var errs = [], d = readDate(el, 'e-date'), m = sold ? readMoney(el, 'e-sold', true) : null;
      if (d.err) errs.push(d);
      else if (d.v < asset.buy) errs.push({ el: d.el, err: '不能早于购入日期 ' + asset.buy });
      else if (d.v > today()) errs.push({ el: d.el, err: '不能晚于今天' });
      if (m && m.err) errs.push(m);
      if (errs.length) { errs.forEach(function (e) { fieldError(e.el, e.err); }); try { errs[0].el.focus(); } catch (e2) { /* 忽略 */ } return false; }
      mutate(function (s) {
        var a = assetById(asset.id); if (!a) return;
        a.status = kind; a.end = d.v; a.ut = Date.now();
        if (sold) { a.sold = m.amt; if (m.fx) a.soldFx = m.fx; else delete a.soldFx; if (m.rate) s.settings.fxRate = m.rate; }
        else { delete a.sold; delete a.soldFx; }
      });
      toast(sold ? '已记为卖出' : '已退役');
      return true;
    } }
  });
}

function resaleForm(asset) {
  var body = '<div class="form">' + moneyFld('r-amt', '现在大概能卖多少', asset.resale, null, '留空就是不估价。') + '</div>';
  openSheet({
    title: '二手估价', body: body, focus: '#r-amt',
    save: { label: '保存', fn: function (el) {
      clearErrors(el);
      var m = readMoney(el, 'r-amt', false);
      if (m.err) { fieldError(m.el, m.err); return false; }
      mutate(function () { var a = assetById(asset.id); if (!a) return; if (m.amt == null) delete a.resale; else a.resale = m.amt; a.ut = Date.now(); });
      return true;
    } }
  });
}

function goalForm(asset) {
  var body = '<div class="form">' + goalFld(asset.goal) + '</div>';
  openSheet({
    title: '回本目标', body: body,
    mount: function (el) { el._cost = C.totalCost(asset); updateGoalHint(el); },
    save: { label: '保存', fn: function (el) {
      clearErrors(el);
      var g = readGoal(el);
      if (g.err) { fieldError(g.el, g.err); return false; }
      mutate(function () { var a = assetById(asset.id); if (!a) return; if (g.goal) a.goal = g.goal; else delete a.goal; a.ut = Date.now(); });
      return true;
    } }
  });
}

/** 详情页点贴纸：只换图标 / 照片。 */
function iconForm(asset) {
  var body = '<div class="form"><div class="fld fld-row"><button type="button" class="iconpick" tabindex="-1"><span class="stk stk-lg"><span class="stk-e emoji" id="f-icon">' + esc(asset.icon) + '</span></span></button>' +
    '<p class="fld-h fld-grow">选一个表情，或者用照片做成贴纸。</p></div>' + iconPanelHTML() + '</div>';
  openSheet({
    title: '换图标', body: body,
    mount: function (el) {
      $('.iconpanel', el).hidden = false;
      fillIconPanel(el);
      el._icon = asset.icon; el._assetId = asset.id;
      setFormIcon(el, asset.icon, false);
      if (asset.photo && photoCache[asset.id]) { setFormPhoto(el, photoCache[asset.id]); el._photo = undefined; }
      revealIcon(el);
    },
    save: { label: '保存', fn: function (el) {
      var id = asset.id;
      if (typeof el._photo === 'string') { photoCache[id] = el._photo; Photos.put(id, el._photo).catch(function () { toast('照片没存上，先用图标'); }); }
      else if (el._photo === null) { delete photoCache[id]; Photos.del(id); }
      mutate(function () {
        var a = assetById(id); if (!a) return;
        a.icon = C.cleanIcon(el._icon) || a.icon; a.ut = Date.now();
        if (typeof el._photo === 'string') a.photo = Date.now(); else if (el._photo === null) delete a.photo;
      });
      return true;
    } }
  });
}

/* ---------- 心愿 ---------- */

function wishForm(wish) {
  var isEdit = !!wish, w = wish || { name: '', cat: '', icon: '', price: null, url: '', note: '' };
  var body = '<div class="form">' +
    '<div class="fld fld-row"><button type="button" class="iconpick" data-act="pick-icon" aria-label="选图标" aria-expanded="false"><span class="stk stk-lg"><span class="stk-e emoji" id="f-icon">' + esc(w.icon || '📦') + '</span></span><small>换图标</small></button>' +
    '<div class="fld-grow"><label class="fld-l" for="f-name">想买什么</label><input class="inp" id="f-name" maxlength="60" autocomplete="off" placeholder="比如：Steam Deck" data-on="name" value="' + esc(w.name) + '"></div></div>' +
    iconPanelHTML() +
    '<div class="fld"><label class="fld-l" for="f-cat">类别</label><input class="inp" id="f-cat" maxlength="20" autocomplete="off" data-on="name" value="' + esc(w.cat || '') + '">' + catChips() + '</div>' +
    moneyFld('f-price', '大概多少钱', w.price, w.fx) +
    '<div class="fld"><label class="fld-l" for="f-url">链接（可不填）</label><input class="inp" id="f-url" type="url" inputmode="url" maxlength="500" autocomplete="off" placeholder="https://" value="' + esc(w.url || '') + '"></div>' +
    '<div class="fld"><label class="fld-l" for="f-note">备注</label><textarea class="inp inp-area" id="f-note" maxlength="500" rows="2" placeholder="为什么想买，等什么时候买">' + esc(w.note || '') + '</textarea></div>' +
    (isEdit ? '<button type="button" class="btn btn-danger" data-act="wish-del" data-id="' + esc(w.id) + '">' + ic('trash') + '删除这个心愿</button>' : '') + '</div>';
  openSheet({
    title: isEdit ? '编辑心愿' : '添加心愿', body: body, focus: isEdit ? null : '#f-name',
    mount: function (el) {
      el._icon = w.icon || '📦'; el._iconManual = isEdit; el._noPhoto = true;
      var ph = $('#f-photo', el); if (ph) ph.closest('label').hidden = true;
      $('#f-photo-h', el).hidden = true;
      $$('[data-money]', el).forEach(updateMoneyOut);
    },
    save: { label: isEdit ? '保存' : '添加', fn: function (el) {
      clearErrors(el);
      var errs = [], name = C.cleanLine($('#f-name', el).value, 60), price = readMoney(el, 'f-price', true);
      if (!name) errs.push({ el: $('#f-name', el), err: '写一下想买什么' });
      if (price.err) errs.push(price);
      var urlRaw = $('#f-url', el).value.trim(), url = C.cleanUrl(urlRaw);
      if (urlRaw && !url) errs.push({ el: $('#f-url', el), err: '链接要以 http:// 或 https:// 开头' });
      if (errs.length) { errs.forEach(function (e) { fieldError(e.el, e.err); }); try { errs[0].el.focus(); } catch (e2) { /* 忽略 */ } return false; }
      var next = C.sanitizeWish({ id: isEdit ? w.id : C.newId('w'), name: name, cat: $('#f-cat', el).value, icon: el._icon, price: price.amt, fx: price.fx,
        url: url, note: $('#f-note', el).value, ct: isEdit ? w.ct : Date.now(), ut: Date.now() }, {});
      if (!next) { toast('没保存上：数据不完整'); return false; }
      mutate(function (s) {
        if (isEdit) s.wishes = s.wishes.map(function (x) { return x.id === w.id ? next : x; }); else s.wishes.push(next);
        if (price.rate) s.settings.fxRate = price.rate;
      });
      return true;
    } }
  });
}

/* ---------- 类别和边框颜色 ---------- */

/** 选颜色的那一排：不设、八个预设色、自定义（系统的取色器，旁边还能直接填色号）。选中的值记在 .colors 的 data-v 上。 */
function colorPickHTML(cur, noneLabel) {
  var html = '<div class="colors" role="group" aria-label="颜色" data-v="">' +
    '<button type="button" class="color color-none" data-act="color-set" data-v="" aria-label="' + esc(noneLabel) + '"></button>';
  for (var i = 1; i <= C.CAT_PRESET_N; i++) {
    html += '<button type="button" class="color" style="--cc:var(--cat-' + i + ')" data-act="color-set" data-v="p' + i + '" aria-label="' + PRESET_NAMES[i - 1] + '"></button>';
  }
  html += '<label class="color color-custom"><span class="sr">自定义颜色</span><input type="color" id="c-custom" value="#888888" data-on="color-custom"></label></div>' +
    '<div class="inl"><label class="inl-l" for="c-hex">色号</label><input class="inp inp-sm num" id="c-hex" maxlength="7" autocomplete="off" autocapitalize="off" spellcheck="false" placeholder="#RRGGBB" data-on="color-hex" aria-label="自定义颜色的色号">' +
    '<span class="fld-h" id="c-color-h"></span></div>';
  return html;
}

/** 把选中的颜色反映到那一排按钮上。fromHex：是用户正在色号框里打字，就不要去改那个框。 */
function setColorPick(root, value, fromHex) {
  var box = $('.colors', root), v = C.cleanColor(value), custom = v && v.charAt(0) === '#' ? v : '';
  box.setAttribute('data-v', v);
  $$('.color', box).forEach(function (b) {
    var mine = b.classList.contains('color-custom') ? !!custom : b.getAttribute('data-v') === v;
    b.classList.toggle('is-on', mine);
    if (b.tagName === 'BUTTON') { b.setAttribute('aria-pressed', mine ? 'true' : 'false'); b.innerHTML = mine ? ic('check') : ''; }
  });
  var cu = $('.color-custom', box), inp = $('#c-custom', box), hex = $('#c-hex', root);
  if (custom) { cu.style.setProperty('--cc', custom); inp.value = custom; } else cu.style.removeProperty('--cc');
  if (!fromHex) hex.value = custom ? custom.toUpperCase() : '';
  $('#c-color-h', root).textContent = v ? (custom ? '自定义' : PRESET_NAMES[+v.slice(1) - 1]) : box.querySelector('.color-none').getAttribute('aria-label');
  var demo = $('.c-demo .stk', root);
  if (demo) { var e = edgeCss(v); if (e) demo.style.setProperty('--edge', e); else demo.style.removeProperty('--edge'); }
}

/** 新建 / 编辑一个类别：名字、边框颜色、哪些装备属于它。name 为空是新建。 */
function catForm(name) {
  var isEdit = !!name, rows = C.catList(S), cur = null;
  rows.forEach(function (r) { if (r.name === name) cur = r; });
  if (isEdit && !cur) return;
  var color = cur ? cur.color : '';
  if (!isEdit) {
    // 新建的类别先替它选好一个还没人用的预设色，省一步；不想要可以改
    var used = {};
    S.cats.forEach(function (c) { used[c.color] = true; });
    for (var k = 1; k <= C.CAT_PRESET_N && !color; k++) if (!used['p' + k]) color = 'p' + k;
  }
  var members = S.assets.filter(function (a) { return isEdit && a.cat === name; });
  var others = S.assets.filter(function (a) { return !isEdit || a.cat !== name; });
  var pick = function (a, on) {
    return '<li><label class="pickrow"><input type="checkbox" class="chk" value="' + esc(a.id) + '"' + (on ? ' checked' : '') + '>' +
      '<span class="emoji">' + esc(a.icon) + '</span><span class="pick-nm">' + esc(a.name) + '</span>' +
      (!on && a.cat ? '<small>' + esc(a.cat) + '</small>' : '') + '</label></li>';
  };
  var sample = members[0] || { id: 'sample-c', icon: '🎮', cat: '' };
  var body = '<div class="form">' +
    '<div class="fld fld-row"><span class="iconpick c-demo" aria-hidden="true">' + stickerHTML({ id: sample.id, icon: sample.icon, photo: sample.photo, cat: '' }, 'stk-lg') + '</span>' +
    '<div class="fld-grow"><label class="fld-l" for="c-name">类别的名字</label><input class="inp" id="c-name" maxlength="20" autocomplete="off" placeholder="比如：外设、游戏设备" data-on="cat-name" value="' + esc(name || '') + '">' +
    '<p class="fld-h" id="c-name-h" hidden></p></div></div>' +
    '<div class="fld"><span class="fld-l">边框颜色</span>' + colorPickHTML(color, '不设颜色') + '</div>' +
    (S.assets.length ? '<div class="fld"><span class="fld-l">哪些装备属于这个类别</span><ul class="picklist">' +
      members.map(function (a) { return pick(a, true); }).join('') + others.map(function (a) { return pick(a, false); }).join('') + '</ul>' +
      '<p class="fld-h">勾上的归到这个类别。' + (isEdit ? '原来在这个类别、现在去掉勾的，会变成没有类别。' : '') + '一件装备只能属于一个类别。</p></div>' : '') +
    (isEdit ? '<button type="button" class="btn btn-danger" data-act="cat-del" data-name="' + esc(name) + '">' + ic('trash') + '删除这个类别</button>' : '') + '</div>';
  openSheet({
    title: isEdit ? '编辑类别' : '新建类别', body: body, focus: isEdit ? null : '#c-name',
    mount: function (el) { el._catFrom = name || ''; el._colorTouched = false; setColorPick(el, color); },
    save: { label: isEdit ? '保存' : '新建', fn: function (el) {
      clearErrors(el);
      var inp = $('#c-name', el), next = C.cleanLine(inp.value, 20);
      if (!next) { fieldError(inp, '起个名字'); try { inp.focus(); } catch (e) { /* 忽略 */ } return false; }
      var picked = $('.colors', el).getAttribute('data-v'), ids = $$('.picklist .chk', el).filter(function (c) { return c.checked; }).map(function (c) { return c.value; });
      var merging = next !== name && C.catList(S).some(function (r) { return r.name === next; });
      if (merging) {
        // 和已有的类别同名：合并。那个类别原来的装备留着；这边没动过颜色的话，沿用那边的颜色
        S.assets.forEach(function (a) { if (a.cat === next && ids.indexOf(a.id) < 0) ids.push(a.id); });
        if (!el._colorTouched) picked = C.catColor(S, next) || picked;
      }
      mutate(function (s) {
        if (isEdit && next !== name) C.renameCat(s, name, next);
        C.upsertCat(s, next, picked);
        C.setCatMembers(s, next, ids);
      });
      toast(merging ? '已合并到「' + next + '」' : isEdit ? '已保存' : '已新建「' + next + '」');
      return true;
    } }
  });
}

/** 没有单独设颜色的贴纸用什么颜色的边。 */
function edgeColorForm() {
  var body = '<div class="form"><p class="sec-p">没有类别的装备、类别没设颜色的装备，贴纸的边用这个颜色。</p>' +
    '<div class="fld"><span class="fld-l">颜色</span>' + colorPickHTML(S.settings.edgeColor, '白色') + '</div></div>';
  openSheet({
    title: '默认的边框颜色', body: body,
    mount: function (el) { setColorPick(el, S.settings.edgeColor); },
    save: { label: '保存', fn: function (el) {
      var v = $('.colors', el).getAttribute('data-v');
      mutate(function (s) { s.settings.edgeColor = C.cleanColor(v); }, { quiet: true, stay: true });
      applyTheme(); render();
      return true;
    } }
  });
}

/* ---------- 备份 ---------- */

function backupObj(withPhotos) {
  var o = C.exportObj(S);
  if (S.demo) {            // 示例数据不进备份
    o.assets = S.assets.filter(function (a) { return !/^demo/.test(a.id); });
    o.wishes = S.wishes.filter(function (w) { return !/^demo/.test(w.id); });
  }
  if (withPhotos) {
    var ph = {};
    S.assets.forEach(function (a) { if (a.photo && photoCache[a.id]) ph[a.id] = photoCache[a.id]; });
    if (Object.keys(ph).length) o.photos = ph;
  }
  return o;
}

function canSaveFiles() { return !ENV.preview || !!hostDownloads; }

function markBackedUp() { mutate(function (s) { s.bk = { t: Date.now(), n: 0 }; }, { quiet: true, stay: route.name !== 'prefs' && route.name !== 'gear' }); }

function exportSheet() {
  var code = C.encodeCode(backupObj(false));
  var nPhotos = S.assets.filter(function (a) { return a.photo && photoCache[a.id]; }).length;
  var body = '<div class="form"><p class="sec-p">备份里有全部装备、心愿和设置：' + S.assets.length + ' 件装备，' + S.wishes.length + ' 个心愿。' +
    (nPhotos ? '照片贴纸（' + nPhotos + ' 张）只在备份文件里，备份码里没有。' : '') + '</p>' +
    '<div class="btncol">' +
    (canSaveFiles() ? '<button type="button" class="btn btn-primary" data-act="exp-file">' + ic('share') + '保存备份文件</button>' : '') +
    '<button type="button" class="btn' + (canSaveFiles() ? '' : ' btn-primary') + '" data-act="exp-copy">' + ic('copy') + '复制备份码</button></div>' +
    '<div class="fld"><label class="fld-l" for="exp-code">备份码（可以粘贴到备忘录、微信里存着）</label>' +
    '<textarea class="inp inp-area inp-code" id="exp-code" readonly rows="4" data-act="select-all">' + esc(code) + '</textarea></div>' +
    '<p class="fld-h">恢复的时候，在「设置 → 恢复 / 导入」里粘贴这段码，或者选备份文件。</p></div>';
  openSheet({ title: '备份', body: body, cancel: '完成' });
}

/* ---------- 恢复 / 导入 ---------- */

var pendingImport = null;

function parseImport(text) {
  var s = String(text || '').trim();
  if (!s) return null;
  var looksTable = s[0] !== '{' && !/MG1\./.test(s) && (/\t/.test(s) || /\n/.test(s) && /,/.test(s));
  if (looksTable) {
    var tb = C.parseTable(s, today());
    if (tb.error && !tb.assets.length) return { error: tb.error };
    if (!tb.assets.length) return { error: '表头认出来了，但没有读到一行有效的数据。' };
    return { kind: 'table', state: C.sanitizeState({ assets: tb.assets }).state, skipped: tb.skipped, hasSettings: false };
  }
  try {
    var obj = C.decodeAny(s), res = C.sanitizeState(obj);
    var photos = {};
    if (obj.photos && typeof obj.photos === 'object') {
      Object.keys(obj.photos).forEach(function (k) { if (C.validId(k) && Photos.valid(obj.photos[k])) photos[k] = obj.photos[k]; });
    }
    if (!res.state.assets.length && !res.state.wishes.length) return { error: '这份备份里没有装备也没有心愿。' };
    return { kind: 'backup', state: res.state, dropped: res.dropped, photos: photos, hasSettings: !!obj.settings, hasCats: Array.isArray(obj.cats) };
  } catch (e) { return { error: e.message || '读不出来' }; }
}

function importPreview(el) {
  var out = $('#imp-preview', el), res = parseImport($('#imp-text', el).value), ok = $('.sheet-ok', el);
  pendingImport = null;
  ok.disabled = true;
  if (!res) { out.innerHTML = ''; return; }
  if (res.error) { out.innerHTML = '<p class="fld-e">' + esc(res.error) + '</p>'; return; }
  pendingImport = res; ok.disabled = false;
  var st = res.state, has = (S.assets.length || S.wishes.length) && !S.demo;
  var names = st.assets.slice(0, 6).map(function (a) { return a.icon + ' ' + a.name; }).join('、') + (st.assets.length > 6 ? ' 等' : '');
  var h = '<div class="preview"><b>读到 ' + st.assets.length + ' 件装备' + (st.wishes.length ? '、' + st.wishes.length + ' 个心愿' : '') + '</b>' +
    (names ? '<span>' + esc(names) + '</span>' : '');
  if (res.dropped) h += '<span>有 ' + res.dropped + ' 条不完整，已跳过。</span>';
  if (res.skipped && res.skipped.length) h += '<span>跳过 ' + res.skipped.length + ' 行：' + esc(res.skipped.slice(0, 3).map(function (k) { return k.name + '（' + k.why + '）'; }).join('、')) + '</span>';
  h += '</div>';
  if (has) {
    h += '<div class="fld"><span class="fld-l">现在已经有 ' + S.assets.length + ' 件装备</span><div class="seg seg-full" id="imp-mode" data-v="merge" role="group" aria-label="导入方式">' +
      '<button type="button" class="seg-b is-on" data-act="imp-mode" data-v="merge" aria-pressed="true">合并进来</button>' +
      '<button type="button" class="seg-b" data-act="imp-mode" data-v="replace" aria-pressed="false">换成这份</button></div>' +
      '<p class="fld-h">合并：新的加进来，同一件以后改的为准。换成这份：现有的全部换掉（设置里可以撤销）。</p></div>';
  }
  out.innerHTML = h;
}

function importSheet(prefill) {
  var canRead = !ENV.preview && navigator.clipboard && navigator.clipboard.readText;
  var body = '<div class="form"><p class="sec-p">把备份码或导入链接粘贴到下面，或者选一个备份文件。也可以直接粘贴从 Excel 里复制的几行（要带「名字、购买时间、购入金额」这样的表头）。</p>' +
    '<div class="fld"><label class="fld-l" for="imp-text">粘贴到这里</label><textarea class="inp inp-area inp-code" id="imp-text" rows="5" autocomplete="off" autocapitalize="off" spellcheck="false" placeholder="MG1.…" data-on="imp-text">' + esc(prefill || '') + '</textarea></div>' +
    '<div class="btnrow">' + (canRead ? '<button type="button" class="btn btn-sm" data-act="imp-paste">' + ic('paste') + '<span>从剪贴板粘贴</span></button>' : '') +
    '<label class="btn btn-sm">' + ic('file') + '<span>选择文件</span><input type="file" id="imp-file" accept=".json,.txt,.csv,application/json,text/plain,text/csv" data-on="imp-file" class="sr"></label></div>' +
    '<div id="imp-preview" role="status"></div></div>';
  openSheet({
    title: '恢复 / 导入', body: body,
    mount: function (el) { importPreview(el); },
    save: { label: '导入', fn: function (el) {
      var res = pendingImport;
      if (!res) return false;
      var modeEl = $('#imp-mode', el), mode = modeEl ? modeEl.getAttribute('data-v') : 'replace';
      var hadData = (S.assets.length || S.wishes.length) && !S.demo;
      if (hadData) store.set(LS_STASH, JSON.stringify(S));
      var added = res.state.assets.length;
      Object.keys(res.photos || {}).forEach(function (k) { photoCache[k] = res.photos[k]; Photos.put(k, res.photos[k]).catch(function () {}); });
      mutate(function (s) {
        var keep = s.settings, keepBk = s.bk;
        if (mode === 'merge' && hadData) {
          var r = C.mergeInto(s, res.state); added = r.added + r.updated;
        } else {
          s.assets = res.state.assets; s.wishes = res.state.wishes;
          if (res.hasCats) s.cats = res.state.cats;                 // 老版本的备份里没有类别这一项：现有的类别颜色留着
          s.settings = res.hasSettings ? res.state.settings : keep;
        }
        s.demo = false; s.bk = keepBk;
      }, { stay: true });
      applyTheme();
      pendingImport = null;
      toast(mode === 'merge' && hadData ? '已合并 ' + added + ' 条' : '已导入 ' + res.state.assets.length + ' 件装备');
      if (route.name !== 'gear') nav('#gear', true); else render();
      return true;
    } }
  });
}

/* ---------- 照片 → 贴纸 ---------- */

/**
 * 把用户选的照片缩成一张贴纸图。白底（或任何纯色底）的产品图会抠掉背景，输出透明 PNG；
 * 其他照片裁成圆角方块。全部在本机完成。
 */
function photoToSticker(file) {
  return new Promise(function (resolve, reject) {
    if (!file || !/^image\//.test(file.type || '')) { reject(new Error('这不是图片')); return; }
    var url = URL.createObjectURL(file), img = new Image();
    img.onload = function () {
      try { resolve(makeSticker(img)); } catch (e) { reject(e); }
      URL.revokeObjectURL(url);
    };
    img.onerror = function () { URL.revokeObjectURL(url); reject(new Error('这张图片打不开')); };
    img.src = url;
  });
}

function makeSticker(img) {
  var W = img.naturalWidth || img.width, H = img.naturalHeight || img.height;
  if (!W || !H) throw new Error('这张图片打不开');
  var k = Math.min(1, 320 / Math.max(W, H)), w = Math.max(1, Math.round(W * k)), h = Math.max(1, Math.round(H * k));
  var cv = doc.createElement('canvas'); cv.width = w; cv.height = h;
  var cx = cv.getContext('2d', { willReadFrequently: true });
  cx.drawImage(img, 0, 0, w, h);
  var data = cx.getImageData(0, 0, w, h), px = data.data, N = w * h, i;

  // 本来就带透明的图（已经抠好的 PNG）直接用
  var hasAlpha = false;
  for (i = 3; i < px.length; i += 4 * 7) if (px[i] < 250) { hasAlpha = true; break; }

  var cut = hasAlpha;
  if (!hasAlpha) {
    // 四条边上的像素大多是同一种颜色 → 认为是纯色背景
    var edge = [], x, y;
    for (x = 0; x < w; x++) { edge.push(x, (h - 1) * w + x); }
    for (y = 0; y < h; y++) { edge.push(y * w, y * w + w - 1); }
    var rs = [], gs = [], bs = [];
    edge.forEach(function (p) { rs.push(px[p * 4]); gs.push(px[p * 4 + 1]); bs.push(px[p * 4 + 2]); });
    var med = function (arr) { var s2 = arr.slice().sort(function (a, b) { return a - b; }); return s2[s2.length >> 1]; };
    var br = med(rs), bg = med(gs), bb = med(bs), TOL = 46, near = 0;
    var dist = function (p) { var dr = px[p * 4] - br, dg = px[p * 4 + 1] - bg, db = px[p * 4 + 2] - bb; return Math.sqrt(dr * dr + dg * dg + db * db); };
    edge.forEach(function (p) { if (dist(p) < TOL) near++; });
    if (near / edge.length > 0.82) {
      // 从边缘往里漫延，把和背景色接近的像素标成背景
      var mark = new Uint8Array(N), stack = [];
      edge.forEach(function (p) { if (!mark[p] && dist(p) < TOL) { mark[p] = 1; stack.push(p); } });
      while (stack.length) {
        var p = stack.pop(), pxx = p % w, pyy = (p - pxx) / w;
        var nb = [pxx > 0 ? p - 1 : -1, pxx < w - 1 ? p + 1 : -1, pyy > 0 ? p - w : -1, pyy < h - 1 ? p + w : -1];
        for (var j = 0; j < 4; j++) { var q = nb[j]; if (q >= 0 && !mark[q] && dist(q) < TOL) { mark[q] = 1; stack.push(q); } }
      }
      var bgCount = 0; for (i = 0; i < N; i++) if (mark[i]) bgCount++;
      if (bgCount > N * 0.08 && bgCount < N * 0.97) {
        for (i = 0; i < N; i++) {
          if (mark[i]) px[i * 4 + 3] = 0;
          else {
            // 紧挨着背景的一圈像素做半透明，边缘不发硬
            var ex = i % w, ey = (i - ex) / w;
            var touch = (ex > 0 && mark[i - 1]) || (ex < w - 1 && mark[i + 1]) || (ey > 0 && mark[i - w]) || (ey < h - 1 && mark[i + w]);
            if (touch) px[i * 4 + 3] = Math.max(60, Math.min(255, Math.round((dist(i) - TOL * 0.5) / (TOL * 1.2) * 255)));
          }
        }
        cut = true;
        cx.putImageData(data, 0, 0);
      }
    }
  }

  var out = doc.createElement('canvas'), ox;
  if (cut) {
    // 裁到主体的外框，留一点边
    var x0 = w, y0 = h, x1 = -1, y1 = -1;
    for (i = 0; i < N; i++) if (px[i * 4 + 3] > 24) { var xx = i % w, yy = (i - xx) / w; if (xx < x0) x0 = xx; if (xx > x1) x1 = xx; if (yy < y0) y0 = yy; if (yy > y1) y1 = yy; }
    if (x1 < 0) throw new Error('这张图里没看到东西');
    var bw = x1 - x0 + 1, bh = y1 - y0 + 1, side = Math.max(bw, bh), S2 = Math.min(256, side + 8), sc = (S2 - 8) / side;
    out.width = out.height = S2; ox = out.getContext('2d');
    ox.imageSmoothingQuality = 'high';
    ox.drawImage(cv, x0, y0, bw, bh, (S2 - bw * sc) / 2, (S2 - bh * sc) / 2, bw * sc, bh * sc);
    return out.toDataURL('image/png');
  }
  // 普通照片：居中裁成方块，圆角
  var side2 = Math.min(W, H), S3 = 224, r = S3 * 0.2;
  out.width = out.height = S3; ox = out.getContext('2d');
  ox.imageSmoothingQuality = 'high';
  ox.beginPath(); ox.moveTo(r, 0); ox.arcTo(S3, 0, S3, S3, r); ox.arcTo(S3, S3, 0, S3, r); ox.arcTo(0, S3, 0, 0, r); ox.arcTo(0, 0, S3, 0, r); ox.closePath(); ox.clip();
  ox.drawImage(img, (W - side2) / 2, (H - side2) / 2, side2, side2, 0, 0, S3, S3);
  return out.toDataURL('image/png');
}

/* ====================================================================== 拖动排序（自定义顺序） */

/* 在哪儿能拖
 *   装备页的列表和贴纸墙。两边用的是同一个顺序。
 * 怎么触发
 *   触屏：按住一件不动约半秒，它会「浮起来」，然后拖。
 *         列表里排序方式是「自定义顺序」时每行右边有个手柄，按住手柄可以马上拖，不用等。
 *   鼠标：按住直接拖。
 *   键盘：（列表）焦点在手柄上时按上下方向键。
 *   不拖：（列表）点一下手柄，弹出「移到最前面 / 上移一位 / 下移一位 / 移到最后面」几个按钮。
 * 顺序怎么存
 *   装备在 S.assets 里的先后就是自定义顺序（core.js 的 reorderSubset 负责挪位置）。
 * 什么时候能拖
 *   还没有手动排过序的时候，别的排序方式下也能拖：松手时把眼前的顺序定下来，排序方式切成「自定义顺序」。
 *   已经排过序以后，别的排序方式下就不能拖了，免得把排好的顺序冲掉。
 * 两种做法
 *   列表是一列，拖的时候不动 DOM，只给各行加位移，松手再改数据重画。
 *   贴纸墙是自动换行的，大小还不一样，挪一个别的都可能换行，所以拖的时候就真的在 DOM 里换位置，
 *   让浏览器重新排，再用过渡把别的贴纸从旧位置滑到新位置。 */

var reorder = null;          // 正在进行的一次拖动
var pressing = null;         // 按下了，还没确定是不是要拖
var swallowClick = false;    // 鼠标拖完松手，浏览器还会补一个 click，这一下不算数

var PRESS_MS = 450, TOUCH_SLOP = 8, MOUSE_SLOP = 5;

function reorderAllowed() {
  var set = S.settings;
  return route.name === 'gear' && !sheets.length && (set.sort === 'manual' || !set.custom);
}

/** 手指 / 鼠标按在了哪一件上：列表里的一行，或者贴纸墙上的一个贴纸。只有一件时没什么可排的。 */
function dragItemOf(target) {
  var el = target && target.closest ? (target.closest('.list > .item') || target.closest('.wall > .wall-item')) : null;
  return el && el.parentNode.children.length > 1 ? el : null;
}

function touchById(list, id) {
  for (var i = 0; i < list.length; i++) if (list[i].identifier === id) return list[i];
  return null;
}

/** 第一次手动排序：把眼前这个顺序（当前的排序方式排出来的）定下来，作为自定义顺序的起点。 */
function adoptOrder(s) {
  var st = s.settings;
  if (st.sort !== 'manual') {
    if (!st.custom) s.assets = C.sortAssets(s.assets, st.sort, today(), st, catNames());
    st.sort = 'manual';
  }
  st.custom = true;
}

function rowIds(rows) { return rows.map(function (r) { return r.getAttribute('data-id'); }); }

function itemById(sel, id) {
  return $$(sel).filter(function (r) { return r.getAttribute('data-id') === id; })[0] || null;
}
function rowById(id) { return itemById('#view .list > .item', id); }

/** 把新顺序存下来。第一次排序时顺带把排序方式切成「自定义顺序」，提示条上可以撤销。 */
function commitOrder(ids) {
  var first = S.settings.sort !== 'manual';
  mutate(function (s) { adoptOrder(s); s.assets = C.reorderSubset(s.assets, ids); },
    { quiet: true, undo: first ? '已切换到「自定义顺序」' : null });
}

/** 把一件挪到列表里的第 j 位（从 0 数）。键盘和「点手柄」都走这里。挪了返回 true。 */
function moveRowTo(id, j) {
  var ids = rowIds($$('#view .list > .item')), i = ids.indexOf(id);
  if (i < 0 || !reorderAllowed()) return false;
  j = Math.max(0, Math.min(ids.length - 1, j));
  if (j === i) return false;
  ids.splice(i, 1); ids.splice(j, 0, id);
  mutate(function (s) { adoptOrder(s); s.assets = C.reorderSubset(s.assets, ids); }, { quiet: true });
  var li = rowById(id), a = assetById(id);
  if (li) {
    try { li.scrollIntoView({ block: 'nearest' }); } catch (e) { /* 老浏览器不认这个参数，不滚也行 */ }
    li.classList.add('is-moved');
    setTimeout(function () { li.classList.remove('is-moved'); }, 1000);
  }
  toast((a ? a.name : '这一件') + ' 移到第 ' + (j + 1) + ' 位', null, 1600);
  return true;
}

/** 点一下手柄：不拖也能挪。拖动在某些设备上不好使、或者不方便拖的时候，还有这条路。 */
function moveSheet(id) {
  var a = assetById(id), ids = rowIds($$('#view .list > .item')), i = ids.indexOf(id), n = ids.length;
  if (!a || i < 0 || n < 2 || !reorderAllowed()) return;
  var b = function (to, label) { return '<button type="button" class="btn" data-act="move" data-id="' + esc(id) + '" data-to="' + to + '">' + label + '</button>'; };
  openSheet({
    title: '挪一下「' + a.name + '」', small: true,
    body: '<p class="confirm-tx">现在排在第 ' + (i + 1) + ' 位，一共 ' + n + ' 件。按住手柄上下拖动更快。</p><div class="btncol">' +
      (i > 0 ? b('top', '移到最前面') + b('up', '上移一位') : '') + (i < n - 1 ? b('down', '下移一位') + b('bottom', '移到最后面') : '') +
      '<button type="button" class="btn btn-quiet" data-act="sheet-close">取消</button></div>'
  });
}

/* ---------- 开始、移动、结束（列表和贴纸墙各有一套，这里分派） ---------- */

function startReorder(el, x, y, kind, tid, fromGrip) {
  var ok = el.classList.contains('wall-item') ? startWall(el, x, y, kind, tid) : startList(el, x, y, kind, tid, fromGrip);
  if (ok) reorder.raf = requestAnimationFrame(reorderTick);
  return ok;
}

function moveReorder(x, y) {
  if (!reorder) return;
  if (reorder.mode === 'wall') moveWall(x, y); else moveList(x, y);
}

function finishReorder(commit) {
  var d = reorder;
  if (!d) return;
  reorder = null;
  cancelAnimationFrame(d.raf);
  rootEl.classList.remove('is-reordering');
  if (!doc.contains(d.el)) return;
  if (d.mode === 'wall') finishWall(d, commit); else finishList(d, commit);
}

/** 拖到屏幕上下边缘附近时，页面自己慢慢滚。 */
function reorderTick() {
  var d = reorder;
  if (!d) return;
  var bar = $('#bar'), tabs = $('#tabs');
  var top = bar ? bar.getBoundingClientRect().bottom : 0, bot = tabs ? tabs.getBoundingClientRect().top : window.innerHeight;
  var zone = 56, v = 0;
  if (d.y < top + zone) v = -Math.ceil(Math.min(1, (top + zone - d.y) / zone) * 16);
  else if (d.y > bot - zone) v = Math.ceil(Math.min(1, (d.y - (bot - zone)) / zone) * 16);
  if (v) window.scrollBy(0, v);
  var now = window.pageYOffset || 0;
  if (now !== d.lastScroll) { d.lastScroll = now; moveReorder(d.x, d.y); }      // 页面滚了（自己滚的或者滚轮滚的），被拖的那一件要跟上
  d.raf = requestAnimationFrame(reorderTick);
}

/** 重画以后，让刚放下的那一件从松手的位置滑进它的新格子。withDy：贴纸墙上的贴纸本来就带一点上下错位。 */
function settleFrom(el, dx, dy, withDy) {
  if (Math.abs(dx) < 1 && Math.abs(dy) < 1) return;
  el.style.transition = 'none';
  el.style.transform = withDy ? 'translate3d(' + dx.toFixed(1) + 'px, calc(var(--dy, 0px) + ' + dy.toFixed(1) + 'px), 0)' : 'translate3d(' + dx.toFixed(1) + 'px,' + dy.toFixed(1) + 'px,0)';
  el.classList.add('is-drop');
  el.getBoundingClientRect();                        // 先按这个位置算一遍，下面的过渡才有起点
  el.style.transition = ''; el.style.transform = '';
  setTimeout(function () { el.classList.remove('is-drop'); }, 240);
}

/* ---------- 列表 ---------- */

function startList(li, x, y, kind, tid, fromGrip) {
  var ul = li.parentNode, rows = [].slice.call(ul.children), from = rows.indexOf(li);
  if (from < 0 || rows.length < 2) return false;
  var sy = window.pageYOffset || 0;
  var rects = rows.map(function (r) { var b = r.getBoundingClientRect(); return { top: b.top + sy, h: b.height }; });
  var gap = Math.max(0, rects[1].top - rects[0].top - rects[0].h);
  reorder = {
    mode: 'list', el: li, ul: ul, rows: rows, rects: rects, from: from, to: from, kind: kind, tid: tid, fromGrip: !!fromGrip,
    x0: x, y0: y, x: x, y: y, scroll0: sy, lastScroll: sy, step: rects[from].h + gap, far: 0, raf: 0, shift: rows.map(function () { return 0; })
  };
  ul.classList.add('is-sorting'); li.classList.add('is-drag'); rootEl.classList.add('is-reordering');
  moveList(x, y);
  return true;
}

function moveList(x, y) {
  var d = reorder;
  d.x = x; d.y = y;
  var n = d.rows.length, cur = d.rects[d.from], last = d.rects[n - 1], i;
  var dy = (y - d.y0) + ((window.pageYOffset || 0) - d.scroll0);
  d.far = Math.max(d.far, Math.abs(dy));
  dy = Math.max(d.rects[0].top - cur.top - 10, Math.min(last.top + last.h - cur.top - cur.h + 10, dy));   // 不拖出列表
  d.el.style.transform = 'translate3d(0,' + dy.toFixed(1) + 'px,0)';
  // 被拖的这一行的中线越过了谁的中线，就排到谁的前面 / 后面
  var center = cur.top + cur.h / 2 + dy, to = d.from;
  for (i = 0; i < d.from; i++) if (center < d.rects[i].top + d.rects[i].h / 2) { to = i; break; }
  if (to === d.from) for (i = n - 1; i > d.from; i--) if (center > d.rects[i].top + d.rects[i].h / 2) { to = i; break; }
  d.to = to;
  // 中间的几行让出位置
  for (i = 0; i < n; i++) {
    if (i === d.from) continue;
    var s = (to < d.from && i >= to && i < d.from) ? d.step : (to > d.from && i > d.from && i <= to) ? -d.step : 0;
    if (s !== d.shift[i]) { d.shift[i] = s; d.rows[i].style.transform = s ? 'translate3d(0,' + s.toFixed(1) + 'px,0)' : ''; }
  }
}

function finishList(d, commit) {
  if (!commit || d.to === d.from) {
    // 没换位置：滑回原处
    d.el.classList.remove('is-drag'); d.el.classList.add('is-drop');
    d.rows.forEach(function (r) { r.style.transform = ''; });
    setTimeout(function () { d.el.classList.remove('is-drop'); if (!reorder) d.ul.classList.remove('is-sorting'); }, 220);
    return;
  }
  var ids = rowIds(d.rows), id = ids.splice(d.from, 1)[0];
  ids.splice(d.to, 0, id);
  var oldTop = d.el.getBoundingClientRect().top;
  commitOrder(ids);
  var li2 = rowById(id);
  if (li2) settleFrom(li2, 0, oldTop - li2.getBoundingClientRect().top, false);
}

/* ---------- 贴纸墙 ---------- */

/** 贴纸现在的中心点（页面坐标）。 */
function centerOf(el) {
  var r = el.getBoundingClientRect();
  return { x: r.left + r.width / 2 + (window.pageXOffset || 0), y: r.top + r.height / 2 + (window.pageYOffset || 0) };
}

function startWall(el, x, y, kind, tid) {
  var wall = el.parentNode, items = [].slice.call(wall.children);
  if (items.length < 2) return false;
  var c = centerOf(el), sy = window.pageYOffset || 0;
  reorder = {
    mode: 'wall', el: el, ul: wall, kind: kind, tid: tid, fromGrip: false, startIds: rowIds(items),
    x0: x, y0: y, x: x, y: y, scroll0: sy, lastScroll: sy, far: 0, raf: 0, busy: false,
    base: c,                                                                   // 它自己那个格子的中心：换了位置以后会变
    gx: x + (window.pageXOffset || 0) - c.x, gy: y + sy - c.y                  // 手指按在离中心多远的地方
  };
  wall.classList.add('is-sorting'); el.classList.add('is-drag'); rootEl.classList.add('is-reordering');
  moveWall(x, y);
  return true;
}

/** 让被拖的贴纸待在手指底下（它在 DOM 里还占着自己的格子，只是画的位置挪开了）。 */
function placeWall(d) {
  var X = d.x + (window.pageXOffset || 0) - d.gx - d.base.x, Y = d.y + (window.pageYOffset || 0) - d.gy - d.base.y;
  d.el.style.transform = 'translate3d(' + X.toFixed(1) + 'px, calc(var(--dy, 0px) + ' + Y.toFixed(1) + 'px), 0)';
}

function moveWall(x, y) {
  var d = reorder;
  d.x = x; d.y = y;
  d.far = Math.max(d.far, Math.abs(x - d.x0), Math.abs(y - d.y0 + (window.pageYOffset || 0) - d.scroll0));
  placeWall(d);
  if (d.busy) return;                                  // 别的贴纸还在滑：等它们到位再看
  // 刚换过位置以后，手指要再挪开一点才会接着换。不然手指停着不动时，贴纸重新排了一遍、手指底下换了一个贴纸，
  // 又触发一次换位，有可能来回跳个不停
  var px = x + (window.pageXOffset || 0), py = y + (window.pageYOffset || 0);
  if (d.swapAt && Math.abs(px - d.swapAt.x) < 12 && Math.abs(py - d.swapAt.y) < 12) return;
  // 手指底下是哪个贴纸：压在它左半边就排到它前面，右半边就排到它后面
  var hit = doc.elementFromPoint(x, y), t = hit && hit.closest ? hit.closest('.wall-item') : null;
  if (!t || t === d.el || t.parentNode !== d.ul) return;
  var r = t.getBoundingClientRect(), after = x > r.left + r.width / 2;
  var ref = after ? t.nextElementSibling : t;
  if (ref === d.el || (!after && t.previousElementSibling === d.el)) return;        // 已经在那个位置了
  // 真的换位置：记下别的贴纸现在在哪 → 改 DOM → 把它们先挪回旧位置 → 放开，让它们滑到新位置
  var items = [].slice.call(d.ul.children).filter(function (it) { return it !== d.el; });
  var first = items.map(function (it) { return it.getBoundingClientRect(); });
  d.ul.insertBefore(d.el, ref);
  d.el.style.transform = '';
  d.base = centerOf(d.el);
  placeWall(d);
  items.forEach(function (it) { it.style.transition = 'none'; it.style.transform = ''; });
  var last = items.map(function (it) { return it.getBoundingClientRect(); });
  items.forEach(function (it, i) {
    var dx = first[i].left - last[i].left, dy = first[i].top - last[i].top;
    if (Math.abs(dx) > 0.5 || Math.abs(dy) > 0.5) it.style.transform = 'translate3d(' + dx.toFixed(1) + 'px, calc(var(--dy, 0px) + ' + dy.toFixed(1) + 'px), 0)';
  });
  void d.ul.offsetWidth;
  items.forEach(function (it) { it.style.transition = ''; it.style.transform = ''; });
  d.busy = true; d.swapAt = { x: px, y: py };
  setTimeout(function () { if (reorder === d) { d.busy = false; moveWall(d.x, d.y); } }, 200);
}

function finishWall(d, commit) {
  var id = d.el.getAttribute('data-id'), ids = rowIds([].slice.call(d.ul.children));
  var changed = ids.join(' ') !== d.startIds.join(' ');
  if (!changed) {
    // 没换位置：滑回原处
    d.el.classList.remove('is-drag'); d.el.classList.add('is-drop');
    d.el.style.transform = '';
    setTimeout(function () { d.el.classList.remove('is-drop'); if (!reorder) d.ul.classList.remove('is-sorting'); }, 220);
    return;
  }
  var old = centerOf(d.el);
  if (commit) commitOrder(ids); else render();           // 被取消了（比如来了电话）：按原来的数据重画，顺序复原
  var el2 = itemById('#view .wall > .wall-item', id);
  if (!el2) return;
  var now = centerOf(el2);
  settleFrom(el2, old.x - now.x, old.y - now.y, true);
}

/** 页面要重画了（跨了一天、另一个标签页改了数据……）：正在拖的这一次作废。 */
function abortReorder() {
  cancelPress();
  if (!reorder) return;
  var d = reorder;
  reorder = null;
  cancelAnimationFrame(d.raf);
  rootEl.classList.remove('is-reordering');
  dropPointerListeners();
}

function cancelPress() {
  if (!pressing) return;
  clearTimeout(pressing.timer);
  if (pressing.mouse) dropPointerListeners();
  pressing = null;
}

/* ---------- 触屏 ---------- */

function onTouchStart(ev) {
  if (reorder) { if (ev.touches.length > 1) finishReorder(false); return; }      // 又放上来一根手指：算了
  cancelPress();
  if (ev.touches.length !== 1 || !reorderAllowed()) return;
  var el = dragItemOf(ev.target);
  if (!el) return;
  var t = ev.touches[0];
  if (ev.target.closest('.item-grip')) { startReorder(el, t.clientX, t.clientY, 'touch', t.identifier, true); return; }
  pressing = { el: el, tid: t.identifier, x: t.clientX, y: t.clientY, timer: setTimeout(function () {
    var p = pressing;
    pressing = null;
    if (p && doc.contains(p.el) && reorderAllowed()) startReorder(p.el, p.x, p.y, 'touch', p.tid, false);
  }, PRESS_MS) };
}

function onTouchMove(ev) {
  if (reorder && reorder.kind === 'touch') {
    var t = touchById(ev.touches, reorder.tid);
    if (!t) return;
    if (ev.cancelable) ev.preventDefault();          // 拖动的时候页面不要跟着滚
    moveReorder(t.clientX, t.clientY);
    return;
  }
  if (pressing && !pressing.mouse) {
    var p = touchById(ev.touches, pressing.tid);
    if (!p || Math.abs(p.clientX - pressing.x) > TOUCH_SLOP || Math.abs(p.clientY - pressing.y) > TOUCH_SLOP) cancelPress();   // 手指动了：是在滚动页面
  }
}

function onTouchEnd(ev) {
  if (pressing && !pressing.mouse) cancelPress();
  if (!reorder || reorder.kind !== 'touch' || touchById(ev.touches, reorder.tid)) return;
  if (ev.cancelable) ev.preventDefault();            // 松手不算一次点击
  var tapped = ev.type === 'touchend' && reorder.fromGrip && reorder.far < 4 ? reorder.el.getAttribute('data-id') : null;   // 在手柄上点了一下，没拖
  finishReorder(ev.type === 'touchend');
  if (tapped) moveSheet(tapped);
}

/* ---------- 鼠标 ---------- */

function dropPointerListeners() {
  doc.removeEventListener('pointermove', onPointerMove);
  doc.removeEventListener('pointerup', onPointerUp);
  doc.removeEventListener('pointercancel', onPointerUp);
}

function onPointerDown(ev) {
  if (ev.pointerType !== 'mouse' || ev.button !== 0 || reorder || pressing || !reorderAllowed()) return;   // 手指和触控笔走上面的触屏那一套
  var el = dragItemOf(ev.target);
  if (!el) return;
  pressing = { el: el, mouse: true, tid: ev.pointerId, x: ev.clientX, y: ev.clientY, timer: 0, grip: !!ev.target.closest('.item-grip') };
  doc.addEventListener('pointermove', onPointerMove);
  doc.addEventListener('pointerup', onPointerUp);
  doc.addEventListener('pointercancel', onPointerUp);
}

function onPointerMove(ev) {
  if (reorder && reorder.kind === 'mouse') {
    if (ev.pointerId === reorder.tid) { ev.preventDefault(); moveReorder(ev.clientX, ev.clientY); }
    return;
  }
  if (!pressing || !pressing.mouse || ev.pointerId !== pressing.tid) return;
  if (Math.abs(ev.clientY - pressing.y) <= MOUSE_SLOP && Math.abs(ev.clientX - pressing.x) <= MOUSE_SLOP) return;
  var p = pressing;
  pressing = null;
  if (doc.contains(p.el) && reorderAllowed() && startReorder(p.el, p.x, p.y, 'mouse', p.tid, p.grip)) moveReorder(ev.clientX, ev.clientY);
  else dropPointerListeners();
}

function onPointerUp(ev) {
  dropPointerListeners();
  pressing = null;
  if (!reorder || reorder.kind !== 'mouse') return;
  swallowClick = true;
  setTimeout(function () { swallowClick = false; }, 350);
  finishReorder(ev.type === 'pointerup');
}

/* ---------- 键盘 ---------- */

function onGripKey(ev) {
  var grip = ev.target && ev.target.closest ? ev.target.closest('.item-grip') : null;
  if (!grip || (ev.key !== 'ArrowUp' && ev.key !== 'ArrowDown') || !reorderAllowed()) return;
  ev.preventDefault();
  var li = grip.closest('.item'), id = li.getAttribute('data-id');
  var i = [].indexOf.call(li.parentNode.children, li);
  if (moveRowTo(id, i + (ev.key === 'ArrowUp' ? -1 : 1))) focusGrip(id);
}

function focusGrip(id) {
  var li = rowById(id), g = li ? $('.item-grip', li) : null;
  if (g) { try { g.focus({ preventScroll: true }); } catch (e) { /* 忽略 */ } }
}

function initReorder() {
  var view = $('#view');
  view.addEventListener('touchstart', onTouchStart, { passive: true });
  view.addEventListener('touchmove', onTouchMove, { passive: false });
  view.addEventListener('touchend', onTouchEnd);
  view.addEventListener('touchcancel', onTouchEnd);
  view.addEventListener('pointerdown', onPointerDown);
  view.addEventListener('keydown', onGripKey);
  // 长按时有的系统会弹出菜单、或者把图片拖走：在列表和贴纸墙上都不要
  view.addEventListener('contextmenu', function (ev) { if (pressing || reorder) ev.preventDefault(); });
  view.addEventListener('dragstart', function (ev) { if (ev.target && ev.target.closest && ev.target.closest('.list, .wall')) ev.preventDefault(); });
  doc.addEventListener('click', function (ev) {
    if (!swallowClick) return;
    swallowClick = false;
    ev.stopPropagation(); ev.preventDefault();
  }, true);
}

/* ====================================================================== 点击和输入的处理、启动 */

function topSheet() { return sheets.length ? sheets[sheets.length - 1].el : null; }

function setSeg(btn) {
  var seg = btn.parentNode;
  $$('.seg-b', seg).forEach(function (b) { var on = b === btn; b.classList.toggle('is-on', on); b.setAttribute('aria-pressed', on ? 'true' : 'false'); });
}

function fileStamp() { return today(); }

var ACT = {
  tab: function (el) { nav(el.getAttribute('data-to'), true); },
  go: function (el) { nav(el.getAttribute('data-to')); },
  back: function () { goBack(); },
  open: function (el) { nav('#a-' + el.getAttribute('data-id')); },
  add: function () { if (route.name === 'wish') wishForm(null); else assetForm(null); },
  edit: function (el) { var a = assetById(el.getAttribute('data-id')); if (a) assetForm(a); },

  filt: function (el) { var v = el.getAttribute('data-v'); mutate(function (s) { s.settings.filt = v; }, { quiet: true }); },
  grip: function (el) { var li = el.closest('.item'); if (li) moveSheet(li.getAttribute('data-id')); },
  move: function (el) {
    var id = el.getAttribute('data-id'), to = el.getAttribute('data-to');
    closeSheet();
    var ids = rowIds($$('#view .list > .item')), i = ids.indexOf(id);
    var j = to === 'top' ? 0 : to === 'bottom' ? ids.length - 1 : to === 'up' ? i - 1 : i + 1;
    if (i >= 0 && moveRowTo(id, j)) focusGrip(id);
  },
  view: function (el) { var v = el.getAttribute('data-v'); mutate(function (s) { s.settings.view = v; }, { quiet: true }); },

  demo: function () {
    S = C.sanitizeState(C.demoState(today())).state; S.demo = true;
    persist(); render(); window.scrollTo(0, 0);
  },
  'demo-clear': function () {
    mutate(function (s) {
      s.assets = s.assets.filter(function (a) { return !/^demo/.test(a.id); });
      s.wishes = s.wishes.filter(function (w) { return !/^demo/.test(w.id); });
      s.demo = false; s.bk = { t: 0, n: 0 };
    }, { quiet: true });
  },

  /* ---- 面板 ---- */
  'sheet-close': function () { closeSheet(); },
  'sheet-save': function () { saveSheet(); },
  'confirm-ok': function () {
    var sh = sheets[sheets.length - 1]; if (!sh) return;
    var fn = sh.el._onOk; closeSheet(sh); if (fn) fn();
  },

  /* ---- 表单里的小动作 ---- */
  'fx-toggle': function (el) {
    var box = el.parentNode, fld = box.parentNode, toFx = box.getAttribute('data-mode') !== 'fx';
    box.setAttribute('data-mode', toFx ? 'fx' : 'base');
    el.textContent = toFx ? S.settings.fxSym : S.settings.cur;
    $('.fxrow', fld).hidden = !toFx;
    updateMoneyOut(fld);
    var root = topSheet(); if (root) { updateGoalHint(root); if (root._end) endPreview(root, root._end.asset, root._end.kind); }
    try { $('input', box).focus(); } catch (e) { /* 忽略 */ }
  },
  'pick-icon': function (el) {
    var root = topSheet(), p = $('.iconpanel', root);
    p.hidden = !p.hidden; el.setAttribute('aria-expanded', p.hidden ? 'false' : 'true');
    if (!p.hidden) { fillIconPanel(root); setFormIcon(root, root._icon, false); revealIcon(root); }
  },
  'icon-jump': function (el) {
    var root = topSheet(), grid = $('.icongrid', root), i = +el.getAttribute('data-g'), g = $$('.icong', grid)[i];
    if (!g) return;
    grid._jump = i;
    clearTimeout(grid._jumpT); grid._jumpT = setTimeout(function () { grid._jump = null; }, 250);
    grid.scrollTop = g.offsetTop;
    markIconTab(root, i);
  },
  'icon-set': function (el) {
    var root = topSheet();
    if (root._photo || (root._photo === undefined && $('.iconpick .stk-img', root))) setFormPhoto(root, null);
    setFormIcon(root, el.getAttribute('data-v'), true);
  },
  'photo-clear': function () { var root = topSheet(); setFormPhoto(root, null); setFormIcon(root, root._icon, false); },
  'cat-set': function (el) {
    var root = topSheet(), inp = $('#f-cat', root);
    inp.value = el.getAttribute('data-v');
    if (!root._iconManual) setFormIcon(root, C.guessIcon($('#f-name', root).value, inp.value), false);
  },
  'goal-t': function (el) {
    var root = topSheet(), box = $('#f-goal', root), t = el.getAttribute('data-v'), prev = box.getAttribute('data-t');
    setSeg(el); box.setAttribute('data-t', t);
    $('#f-goal-row', root).hidden = t === 'def';
    $('#f-goal-u', root).textContent = t === 'daily' ? cur() + ' / 天' : '年';
    var v = $('#f-goal-v', root);
    if (t !== prev) v.value = t === 'days' ? '3' : t === 'daily' ? '' : '';
    fieldError(v, '');
    updateGoalHint(root);
    if (t !== 'def') { try { v.focus(); } catch (e) { /* 忽略 */ } }
  },
  st: function (el) {
    var root = topSheet(), v = el.getAttribute('data-v');
    setSeg(el); $('#f-st', root).setAttribute('data-v', v);
    $('#f-end-row', root).hidden = v === 'active';
    $('#f-sold-row', root).hidden = v !== 'sold';
    var lbl = $('#f-end-row .fld-l', root); if (lbl) lbl.textContent = v === 'sold' ? '卖出日期' : '退役日期';
  },
  'select-all': function (el) { try { el.focus(); el.select(); el.setSelectionRange(0, el.value.length); } catch (e) { /* 忽略 */ } },

  /* ---- 单件装备 ---- */
  'extra-add': function (el) { var a = assetById(el.getAttribute('data-id')); if (a) extraForm(a, null); },
  'extra-edit': function (el) {
    var a = assetById(el.getAttribute('data-id')); if (!a) return;
    var x = a.extras.filter(function (e) { return e.id === el.getAttribute('data-x'); })[0];
    if (x) extraForm(a, x);
  },
  'extra-del': function (el) {
    var id = el.getAttribute('data-id'), xid = el.getAttribute('data-x');
    closeSheet();
    mutate(function () { var a = assetById(id); if (!a) return; a.extras = a.extras.filter(function (e) { return e.id !== xid; }); a.ut = Date.now(); }, { undo: '已删除这一笔' });
  },
  retire: function (el) { var a = assetById(el.getAttribute('data-id')); if (a) endForm(a, 'retired'); },
  sell: function (el) { var a = assetById(el.getAttribute('data-id')); if (a) endForm(a, 'sold'); },
  revive: function (el) {
    var id = el.getAttribute('data-id');
    mutate(function () { var a = assetById(id); if (!a) return; a.status = 'active'; delete a.end; delete a.sold; delete a.soldFx; a.ut = Date.now(); }, { undo: '已恢复为服役中' });
  },
  resale: function (el) { var a = assetById(el.getAttribute('data-id')); if (a) resaleForm(a); },
  goal: function (el) { var a = assetById(el.getAttribute('data-id')); if (a) goalForm(a); },
  icon: function (el) { var a = assetById(el.getAttribute('data-id')); if (a) iconForm(a); },
  del: function (el) {
    var a = assetById(el.getAttribute('data-id')); if (!a) return;
    confirmBox({ title: '删除装备', text: '删除「' + a.name + '」和它的追加花费记录？删除后几秒内可以撤销。', ok: '删除', danger: true }, function () {
      var id = a.id;
      route = { name: 'gear', id: null };
      try { history.replaceState(null, '', '#gear'); } catch (e) { /* 忽略 */ }
      navDepth = Math.max(0, navDepth - 1);
      mutate(function (s) { s.assets = s.assets.filter(function (x) { return x.id !== id; }); }, { undo: '已删除 ' + a.name });
      window.scrollTo(0, 0);
    });
  },

  /* ---- 类别和边框 ---- */
  'cat-new': function () { catForm(''); },
  'cat-edit': function (el) { catForm(el.getAttribute('data-name')); },
  'cat-del': function (el) {
    var name = el.getAttribute('data-name');
    closeSheet();
    mutate(function (s) { C.removeCat(s, name); }, { undo: '已删除类别「' + name + '」' });
  },
  'cat-auto': function () {
    var n = 0;
    mutate(function (s) { n = C.autoColorCats(s); });
    var left = C.catList(S).filter(function (r) { return !r.color; }).length;
    toast(n ? '给 ' + n + ' 个类别配了颜色' + (left ? '。预设色只有 ' + C.CAT_PRESET_N + ' 种，剩下的可以自己挑' : '') : '预设色已经用完了，剩下的类别可以自己挑颜色', null, 3600);
  },
  'edge-color': function () { edgeColorForm(); },
  'color-set': function (el) { var root = topSheet(); root._colorTouched = true; setColorPick(root, el.getAttribute('data-v')); },

  /* ---- 心愿 ---- */
  'wish-add': function () { wishForm(null); },
  'wish-edit': function (el) { var w = wishById(el.getAttribute('data-id')); if (w) wishForm(w); },
  'wish-del': function (el) {
    var id = el.getAttribute('data-id'), w = wishById(id);
    closeSheet();
    mutate(function (s) { s.wishes = s.wishes.filter(function (x) { return x.id !== id; }); }, { undo: '已删除心愿' + (w ? ' ' + w.name : '') });
  },
  'wish-buy': function (el) {
    var w = wishById(el.getAttribute('data-id')); if (!w) return;
    assetForm(null, { name: w.name, cat: w.cat, icon: w.icon, price: w.price, fx: w.fx, buy: today(), note: w.note },
      function (s) { s.wishes = s.wishes.filter(function (x) { return x.id !== w.id; }); });
  },

  /* ---- 设置和数据 ---- */
  set: function (el) {
    var k = el.getAttribute('data-k'), v = el.getAttribute('data-v');
    mutate(function (s) {
      var st = s.settings;
      if (k === 'theme' || k === 'accent' || k === 'edge') st[k] = v;
      else if (k === 'cur') { st.cur = v; if (st.fxSym === v) st.fxSym = v === '$' ? '¥' : '$'; }
      else if (k === 'fxSym') st.fxSym = v;
      else if (k === 'goalT' && st.goal.t !== v) st.goal = v === 'days' ? { t: 'days', v: 1095 } : { t: 'daily', v: 5 };
      s.settings = C.sanitizeSettings(st);
    }, { quiet: true, stay: true });
    applyTheme(); render();
  },
  'export': function () { exportSheet(); },
  'import': function () { importSheet(''); },
  'exp-copy': function () {
    var ta = $('#exp-code'), code = ta ? ta.value : C.encodeCode(backupObj(false));
    copyText(code).then(function (ok) {
      if (ok) { markBackedUp(); toast('备份码已复制'); }
      else { if (ta) ACT['select-all'](ta); toast('没复制上。文本框里已全选，手动复制一下。'); }
    });
  },
  'exp-file': function () {
    var text = JSON.stringify(backupObj(true));
    saveFile('mygear-backup-' + fileStamp() + '.json', 'application/json', text).then(function (r) {
      if (r === 'shared') { markBackedUp(); toast('已交给系统保存'); }
      else if (r === 'downloaded') { markBackedUp(); toast('备份文件已下载'); }
      else if (r === 'saved') { markBackedUp(); toast('备份文件已保存'); }
      else if (r === 'failed') toast('没存成，改用「复制备份码」。');
    });
  },
  csv: function () {
    var text = C.toCSV(S, today());
    if (!canSaveFiles()) {
      openSheet({ title: '导出成表格', cancel: '完成', body: '<div class="form"><p class="sec-p">这里不能直接下载文件。复制下面的内容，粘贴到 Excel 或 Google 表格里就行。</p>' +
        '<textarea class="inp inp-area inp-code" id="csv-out" readonly rows="8" data-act="select-all">' + esc(text.replace(/^\ufeff/, '')) + '</textarea>' +
        '<button type="button" class="btn btn-primary" data-act="csv-copy">' + ic('copy') + '复制</button></div>' });
      return;
    }
    saveFile('mygear-' + fileStamp() + '.csv', 'text/csv', text).then(function (r) {
      if (r === 'downloaded') toast('表格已下载'); else if (r === 'saved') toast('表格已保存'); else if (r === 'failed') toast('没存成');
    });
  },
  'csv-copy': function () { var ta = $('#csv-out'); copyText(ta.value).then(function (ok) { toast(ok ? '已复制' : '没复制上，手动全选复制一下'); if (!ok) ACT['select-all'](ta); }); },
  'imp-mode': function (el) { setSeg(el); el.parentNode.setAttribute('data-v', el.getAttribute('data-v')); },
  'imp-paste': function () {
    var root = topSheet();
    try {
      navigator.clipboard.readText().then(function (t) {
        if (!t) { toast('剪贴板是空的'); return; }
        $('#imp-text', root).value = t; importPreview(root);
      }, function () { toast('没拿到剪贴板，直接在文本框里长按粘贴。'); });
    } catch (e) { toast('没拿到剪贴板，直接在文本框里长按粘贴。'); }
  },
  wipe: function () {
    if (!S.assets.length && !S.wishes.length) { toast('本来就是空的'); return; }
    confirmBox({ title: '清空全部数据', text: '删掉这台设备上的 ' + S.assets.length + ' 件装备和 ' + S.wishes.length + ' 个心愿？清空后可以在设置里撤销一次。', ok: '清空', danger: true }, function () {
      store.set(LS_STASH, JSON.stringify(S));
      var keep = S.settings;
      S = C.emptyState(); S.settings = keep;
      persist(); nav('#gear', true); render(); toast('已清空');
    });
  },
  unstash: function () {
    var raw = store.get(LS_STASH); if (!raw) return;
    confirmBox({ title: '撤销上一次导入 / 清空', text: '把数据恢复到上一次导入或清空之前的样子？现在的数据会被换掉。', ok: '恢复' }, function () {
      try { S = C.sanitizeState(JSON.parse(raw)).state; } catch (e) { toast('那份数据读不出来'); return; }
      store.del(LS_STASH); persist(); applyTheme(); render(); toast('已恢复');
    });
  }
};

/* ---------- 输入类的事件 ---------- */

var impTimer = 0;
var ON = {
  sort: function (el) {
    var v = el.value;
    mutate(function (s) { if (v === 'manual') adoptOrder(s); else s.settings.sort = v; }, { quiet: true });
    if (v === 'manual') toast(S.settings.view === 'wall' ? '按住一个贴纸拖到别处，就能调整顺序' : '按住一行上下拖动，就能调整顺序', null, 3600);
  },
  incBig: function (el) { var v = el.checked; mutate(function (s) { s.settings.incBig = v; }, { quiet: true }); },
  goalV: function (el, ev) {
    if (ev.type !== 'change') return;
    var v = parseFloat(String(el.value).replace(/[,，\s¥￥$]/g, '')), g = S.settings.goal, next = null;
    if (v > 0) next = g.t === 'days' ? C.cleanGoal({ t: 'days', v: Math.round(v * 365) }) : C.cleanGoal({ t: 'daily', v: v });
    if (!next) { toast('填一个大于 0 的数'); render(); return; }
    mutate(function (s) { s.settings.goal = next; }, { quiet: true });
  },
  fxRate: function (el, ev) {
    if (ev.type !== 'change') return;
    var v = parseFloat(String(el.value).replace(/[,，\s]/g, ''));
    if (!(v > 0 && v < 1e6)) { toast('汇率要是一个大于 0 的数'); render(); return; }
    mutate(function (s) { s.settings.fxRate = v; }, { quiet: true });
  },
  money: function (el) {
    var fld = el.closest('[data-money]'), root = topSheet();
    if (fld) updateMoneyOut(fld);
    fieldError(el, '');
    if (root) { updateGoalHint(root); if (root._end) endPreview(root, root._end.asset, root._end.kind); }
  },
  date: function (el) { var root = topSheet(); fieldError(el, ''); if (root && root._end) endPreview(root, root._end.asset, root._end.kind); },
  name: function (el) {
    var root = topSheet(); fieldError(el, '');
    if (root && !root._iconManual && !$('.iconpick .stk-img', root)) setFormIcon(root, C.guessIcon($('#f-name', root).value, $('#f-cat', root).value), false);
  },
  'icon-custom': function (el) {
    var root = topSheet(), v = C.cleanIcon(el.value);
    if (v) { if ($('.iconpick .stk-img', root)) setFormPhoto(root, null); setFormIcon(root, v, true); }
  },
  'goal-v': function (el) { fieldError(el, ''); updateGoalHint(topSheet()); },
  'color-custom': function (el) { var root = topSheet(); root._colorTouched = true; setColorPick(root, el.value); },
  'color-hex': function (el) {
    var root = topSheet(), v = C.cleanColor(el.value);
    if (v && v.charAt(0) === '#') { root._colorTouched = true; setColorPick(root, v, true); }
  },
  'cat-name': function (el) {
    // 名字和别的类别撞上了：提前说一声保存后会合并
    var root = topSheet(), h = $('#c-name-h', root), next = C.cleanLine(el.value, 20);
    fieldError(el, '');
    var hit = next && next !== root._catFrom && C.catList(S).some(function (r) { return r.name === next; });
    h.hidden = !hit;
    h.textContent = hit ? '已经有「' + next + '」这个类别了，保存后会合并到一起。' : '';
  },
  'imp-text': function () { var root = topSheet(); clearTimeout(impTimer); impTimer = setTimeout(function () { if (root && doc.contains(root)) importPreview(root); }, 180); },
  'imp-file': function (el, ev) {
    if (ev.type !== 'change' || !el.files || !el.files[0]) return;
    var root = topSheet(), f = el.files[0];
    if (f.size > 12 * 1024 * 1024) { toast('这个文件太大了'); el.value = ''; return; }
    var rd = new FileReader();
    rd.onload = function () { $('#imp-text', root).value = String(rd.result || ''); importPreview(root); el.value = ''; };
    rd.onerror = function () { toast('这个文件读不出来'); };
    rd.readAsText(f);
  },
  photo: function (el, ev) {
    if (ev.type !== 'change' || !el.files || !el.files[0]) return;
    var root = topSheet(), f = el.files[0];
    el.value = '';
    photoToSticker(f).then(function (url) {
      if (!Photos.valid(url)) { toast('这张照片处理不了，换一张试试'); return; }
      if (doc.contains(root)) setFormPhoto(root, url);
    }, function (e) { toast((e && e.message) || '这张照片处理不了'); });
  }
};

function onInput(ev) {
  var el = ev.target, k = el && el.getAttribute && el.getAttribute('data-on');
  if (k && ON[k]) ON[k](el, ev);
}

/* ---------- 启动 ---------- */

function boot() {
  store.probe();
  S = loadState();
  applyTheme();

  var h = location.hash || '', imp = /import=([^&]+)/.exec(h);
  route = parseHash(imp ? '' : h);
  if (imp) { try { history.replaceState(null, '', '#gear'); } catch (e) { /* 忽略 */ } }

  doc.addEventListener('click', function (ev) {
    var el = ev.target.closest ? ev.target.closest('[data-act]') : null;
    if (!el || el.disabled) return;
    var k = el.getAttribute('data-act');
    if (ACT[k]) { if (el.tagName === 'A') return; ACT[k](el, ev); }
  });
  doc.addEventListener('input', onInput);
  doc.addEventListener('change', onInput);
  doc.addEventListener('keydown', function (ev) {
    if (ev.key === 'Escape' && sheets.length) { closeSheet(); ev.preventDefault(); return; }
    if (ev.key === 'Enter' && sheets.length && ev.target && ev.target.tagName === 'INPUT' && ev.target.type !== 'file' && ev.target.type !== 'checkbox' && !ev.isComposing) {
      // 回车：还有下一个输入框就跳过去，已经是最后一个就保存（手机键盘上的「换行」不会一下子把没填完的表单提交掉）
      var sh = sheets[sheets.length - 1];
      if (!sh.opts.save || !sh.el.contains(ev.target)) return;
      ev.preventDefault();
      var inputs = $$('input:not([type="file"]):not([type="checkbox"]):not([type="color"]), textarea', sh.el).filter(function (el) {
        return el.offsetParent !== null && !el.closest('details:not([open])') && !el.readOnly && !el.disabled;   // 收起来的「更多」里的不算
      });
      var i = inputs.indexOf(ev.target);
      if (i >= 0 && i < inputs.length - 1) { try { inputs[i + 1].focus(); } catch (e) { saveSheet(); } }
      else saveSheet();
    }
  });

  initReorder();
  render();
  loadPhotos();
  initHostDownloads();
  if (imp) importSheet(imp[1]);

  // 过了半夜 12 点、从后台切回来：日均要按新的一天重算
  doc.addEventListener('visibilitychange', function () { if (!doc.hidden && refreshToday() && !sheets.length) render(); });
  setInterval(function () { if (refreshToday() && !sheets.length) render(); }, 30000);
  // 另一个标签页改了数据
  window.addEventListener('storage', function (e) {
    if (e.key === LS_STATE && e.newValue && !sheets.length) { S = loadState(); applyTheme(); render(); }
  });
  // 屏幕宽度变了（横竖屏、拖窗口）：图要按新宽度重画
  var lastW = window.innerWidth, rt = 0;
  window.addEventListener('resize', function () {
    if (window.innerWidth === lastW) return;
    lastW = window.innerWidth; clearTimeout(rt);
    rt = setTimeout(function () { if (!sheets.length) render(); }, 180);
  });

  if (!ENV.preview) {
    try {
      if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost' || location.hostname === '127.0.0.1')) {
        navigator.serviceWorker.register('sw.js').catch(function () {});
      }
      if (navigator.storage && navigator.storage.persist) navigator.storage.persist().catch(function () {});
    } catch (e) { /* 忽略 */ }
  }
  rootEl.setAttribute('data-ready', '1');
}

window.MyGear = { version: C.VERSION, state: function () { return S; }, render: render };
if (doc.readyState === 'loading') doc.addEventListener('DOMContentLoaded', boot); else boot();

})();
