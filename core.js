/* 我的装备 · core.js
 * 数据模型和全部计算。不碰界面，浏览器和 Node 都能直接用（测试就是在 Node 里跑的）。
 *
 * 口径（和原来的 Excel 表一致）：
 *   持有天数 = MAX(1, 截止日 - 购入日 + 1)      购入当天算第 1 天
 *   日均     = 总成本 ÷ 持有天数                 总成本 = 购入金额 + 追加花费
 *   服役中的截止日是今天；已退役 / 已卖出的截止日是退役 / 卖出那天，之后不再变化
 *   已卖出的「实际日均」= (总成本 - 卖出金额) ÷ 持有天数
 *   回本：日均 ≤ 目标日均。目标可以写成「用满 N 天」或「日均 ≤ X」，两种写法等价
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.MGCore = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var VERSION = '1.2.0';
  var SCHEMA = 1;
  var DAY_MS = 86400000;
  var MAX_MONEY = 1e10;
  var MIN_YEAR = 1970, MAX_YEAR = 2100;
  var DEFAULT_GOAL = { t: 'days', v: 1095 };
  var STATUSES = ['active', 'retired', 'sold'];
  var STATUS_LABEL = { active: '服役中', retired: '已退役', sold: '已卖出' };
  var SORTS = ['manual', 'daily', 'daily-asc', 'new', 'old', 'price', 'goal', 'name', 'cat'];      // manual = 自己拖出来的顺序；cat = 按类别
  var ACCENTS = ['yellow', 'mint', 'sky', 'pink', 'orange'];
  var EDGES = ['thin', 'normal', 'bold'];                     // 贴纸边框的粗细
  var CAT_PRESET_N = 8;                                       // 预设的类别颜色 p1…p8（色值在 styles.css 里，浅色、深色各一套）

  /* ------------------------------------------------------------------ 日期 */

  function pad2(n) { return n < 10 ? '0' + n : '' + n; }

  function validYMD(y, m, d) {
    if (!(y >= MIN_YEAR && y <= MAX_YEAR && m >= 1 && m <= 12 && d >= 1 && d <= 31)) return false;
    var t = new Date(Date.UTC(y, m - 1, d));
    return t.getUTCFullYear() === y && t.getUTCMonth() === m - 1 && t.getUTCDate() === d;
  }

  /** 'YYYY-MM-DD' → 从 1970-01-01 起的天数；格式不对返回 NaN。全程用 UTC 算，夏令时不会多一天少一天。 */
  function dayNum(s) {
    if (typeof s !== 'string') return NaN;
    var m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
    if (!m) return NaN;
    var y = +m[1], mo = +m[2], d = +m[3];
    if (!validYMD(y, mo, d)) return NaN;
    return Math.round(Date.UTC(y, mo - 1, d) / DAY_MS);
  }

  function dayStr(n) {
    var t = new Date(n * DAY_MS);
    return t.getUTCFullYear() + '-' + pad2(t.getUTCMonth() + 1) + '-' + pad2(t.getUTCDate());
  }

  /** 设备本地时间的今天。 */
  function todayStr(now) {
    var t = now || new Date();
    return t.getFullYear() + '-' + pad2(t.getMonth() + 1) + '-' + pad2(t.getDate());
  }

  function addDays(s, n) { return dayStr(dayNum(s) + n); }

  /** 往后推 k 年的同月同日（2 月 29 日遇到平年取 2 月 28 日）。 */
  function addYears(s, k) {
    var m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
    var y = +m[1] + k, mo = +m[2], d = +m[3];
    if (!validYMD(y, mo, d)) d = 28;
    return y + '-' + pad2(mo) + '-' + pad2(d);
  }

  /** 宽松识别日期：2025-03-08、2025/3/8、2025.03.08、2025年3月8日、3/8/2025、Excel 序列号。 */
  function looseDate(v) {
    if (v == null) return null;
    if (typeof v === 'number' && isFinite(v)) {
      if (v > 20000 && v < 80000) return dayStr(Math.round(v) - 25569); // Excel 序列号
      return null;
    }
    var s = String(v).trim().replace(/[０-９]/g, function (c) { return String.fromCharCode(c.charCodeAt(0) - 65248); });
    if (!s) return null;
    var m = /^(\d{4})\s*[-\/.年]\s*(\d{1,2})\s*[-\/.月]\s*(\d{1,2})\s*日?(?:[ T].*)?$/.exec(s);
    if (m) return validYMD(+m[1], +m[2], +m[3]) ? m[1] + '-' + pad2(+m[2]) + '-' + pad2(+m[3]) : null;
    m = /^(\d{1,2})\s*[-\/.]\s*(\d{1,2})\s*[-\/.]\s*(\d{4})$/.exec(s);
    if (m) {
      var a = +m[1], b = +m[2], y = +m[3];
      var mo = a, d = b;
      if (a > 12 && b <= 12) { mo = b; d = a; }       // 明显是 日/月/年
      return validYMD(y, mo, d) ? y + '-' + pad2(mo) + '-' + pad2(d) : null;
    }
    if (/^\d{5}(\.\d+)?$/.test(s)) return looseDate(parseFloat(s));
    return null;
  }

  function addMonthsClamped(y, m, d, k) {
    var idx = (m - 1) + k, yy = y + Math.floor(idx / 12), mm = ((idx % 12) + 12) % 12 + 1;
    var dim = new Date(Date.UTC(yy, mm, 0)).getUTCDate();
    return Math.round(Date.UTC(yy, mm - 1, Math.min(d, dim)) / DAY_MS);
  }

  /** 两个日期之间按日历算的「几年几个月几天」：先数整月（月底日期自动收到当月最后一天），剩下的算天。 */
  function calDiff(a, b) {
    var pa = a.split('-').map(Number), pb = b.split('-').map(Number), nb = dayNum(b);
    if (!(nb >= dayNum(a))) return { y: 0, m: 0, d: 0 };
    var k = (pb[0] - pa[0]) * 12 + (pb[1] - pa[1]);
    if (addMonthsClamped(pa[0], pa[1], pa[2], k) > nb) k--;
    return { y: Math.floor(k / 12), m: k % 12, d: nb - addMonthsClamped(pa[0], pa[1], pa[2], k) };
  }

  /** 持有时长的口语写法：3 天 / 5 个月 12 天 / 4 年 1 个月。days 是含购入当天的天数。 */
  function spanText(buy, days) {
    if (days < 31) return days + ' 天';
    var c = calDiff(buy, dayStr(dayNum(buy) + days));
    if (c.y === 0) return c.m + ' 个月' + (c.d ? ' ' + c.d + ' 天' : '');
    return c.y + ' 年' + (c.m ? ' ' + c.m + ' 个月' : '');
  }

  /* ------------------------------------------------------------------ 数字和金额 */

  function round2(v) { return Math.round((v + Number.EPSILON) * 100) / 100; }

  function group(intStr) { return intStr.replace(/\B(?=(\d{3})+$)/g, ','); }

  function fmtNum(v, dec) {
    if (!isFinite(v)) return '—';
    var neg = v < 0; v = Math.abs(v);
    var s = v.toFixed(dec || 0), i = s.indexOf('.');
    var out = i < 0 ? group(s) : group(s.slice(0, i)) + s.slice(i);
    return (neg ? '-' : '') + out;
  }

  /** 金额拆成整数和小数两段，界面上把小数排小一号（价签的排法）。dec: 'auto' 表示整数不带小数。 */
  function moneyParts(v, dec) {
    if (!isFinite(v)) return { neg: false, int: '—', frac: '' };
    var neg = v < -1e-9; v = Math.abs(v);
    var d = dec;
    if (d == null || d === 'auto') d = Math.abs(v - Math.round(v)) < 0.005 ? 0 : 2;
    var s = v.toFixed(d), i = s.indexOf('.');
    return { neg: neg, int: group(i < 0 ? s : s.slice(0, i)), frac: i < 0 ? '' : s.slice(i + 1) };
  }

  function fmtMoney(v, cur, dec) {
    var p = moneyParts(v, dec);
    return (p.neg ? '-' : '') + (cur || '') + p.int + (p.frac ? '.' + p.frac : '');
  }

  /** 日均该保留几位小数：上千不留，常规两位，不到一毛的多留一位。 */
  function dailyDec(v) {
    v = Math.abs(v);
    if (v >= 1000) return 0;
    if (v >= 0.1 || v === 0) return 2;
    if (v >= 0.01) return 3;
    return 4;
  }

  function fmtDaily(v, cur) { return fmtMoney(v, cur, dailyDec(v)); }

  /** 「明天再降多少」：金额很小，人民币下不到一毛的用「分」来说。 */
  function fmtDrop(v, cur) {
    if (!isFinite(v)) return '—';
    v = Math.abs(v);
    if (cur === '¥' && v < 0.1) {
      var fen = v * 100;
      return (fen >= 1 ? fen.toFixed(1) : fen >= 0.1 ? fen.toFixed(2) : fen.toFixed(3)) + ' 分';
    }
    return fmtMoney(v, cur, dailyDec(v));
  }

  /** 把用户输入的金额读成数字：允许 ¥ $ 逗号 空格 全角数字，以及 1.2万 / 3k 这种写法。读不出返回 NaN。 */
  function parseMoney(input) {
    if (typeof input === 'number') return isFinite(input) && input >= 0 ? round2(input) : NaN;
    if (input == null) return NaN;
    var s = String(input).trim()
      .replace(/[０-９．，]/g, function (c) { return String.fromCharCode(c.charCodeAt(0) - 65248); })
      .replace(/[¥￥$€£\s元块]/g, '');
    // 有些键盘的小数点是逗号：「12,5」「12,50」当成 12.5；「1,234」这种三位一组的才是千分位
    if (s.indexOf('.') < 0 && /^\d+,\d{1,2}$/.test(s)) s = s.replace(',', '.');
    s = s.replace(/,/g, '');
    if (!s) return NaN;
    var mul = 1;
    var m = /^(.*?)(万|w|W|k|K|千)$/.exec(s);
    if (m) { s = m[1]; mul = /万|w|W/.test(m[2]) ? 10000 : 1000; }
    if (!/^\d*\.?\d+$|^\d+\.$/.test(s)) return NaN;
    var v = parseFloat(s) * mul;
    if (!isFinite(v) || v < 0 || v > MAX_MONEY) return NaN;
    return round2(v);
  }

  /* ------------------------------------------------------------------ 字符串清洗 */

  var hasSegmenter = typeof Intl !== 'undefined' && typeof Intl.Segmenter === 'function';

  /** 按「看起来的一个字」切分，表情不会被切成两半。 */
  function graphemes(s) {
    if (hasSegmenter) {
      var out = [], it = new Intl.Segmenter(undefined, { granularity: 'grapheme' }).segment(s);
      for (var x of it) out.push(x.segment);
      return out;
    }
    // 退路：按码点切，并把零宽连接符、变体选择符、肤色、旗帜的后半个并回前一个
    var cps = Array.from(s), res = [];
    for (var i = 0; i < cps.length; i++) {
      var c = cps[i], code = c.codePointAt(0);
      var joinPrev = res.length && (code === 0x200d || code === 0xfe0f || code === 0x20e3 ||
        (code >= 0x1f3fb && code <= 0x1f3ff) || (code >= 0xe0020 && code <= 0xe007f) ||
        /\u200d$/.test(res[res.length - 1]));
      if (!joinPrev && res.length && code >= 0x1f1e6 && code <= 0x1f1ff) {
        var prev = Array.from(res[res.length - 1]);
        if (prev.length === 1 && prev[0].codePointAt(0) >= 0x1f1e6 && prev[0].codePointAt(0) <= 0x1f1ff) joinPrev = true;
      }
      if (joinPrev) res[res.length - 1] += c; else res.push(c);
    }
    return res;
  }

  function cleanStr(v, max) {
    if (v == null) return '';
    var s = String(v).replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f\u2028\u2029]/g, '').replace(/\r\n?/g, '\n').trim();
    var g = graphemes(s);
    if (g.length > max) s = g.slice(0, max).join('').trim();
    return s;
  }

  function cleanLine(v, max) { return cleanStr(v, max).replace(/\s*\n\s*/g, ' '); }

  /** 图标只留第一个「字」，并且限制长度（表情最长也就十几个编码单元）。 */
  function cleanIcon(v) {
    var s = cleanLine(v, 4);
    if (!s) return '';
    var g = graphemes(s)[0] || '';
    return g.length <= 16 ? g : '';
  }

  /** 颜色：预设色写成 p1…p8；自己挑的写成 #rrggbb（也认 #rgb）。认不出来返回空串。 */
  function cleanColor(v) {
    var s = String(v == null ? '' : v).trim().toLowerCase();
    if (/^p[1-8]$/.test(s)) return s;
    var m = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/.exec(s);
    if (!m) return '';
    var h = m[1];
    if (h.length === 3) h = h.charAt(0) + h.charAt(0) + h.charAt(1) + h.charAt(1) + h.charAt(2) + h.charAt(2);
    return '#' + h;
  }

  function cleanMoney(v) {
    var n = typeof v === 'number' ? v : parseMoney(v);
    if (!isFinite(n) || n < 0 || n > MAX_MONEY) return null;
    return round2(n);
  }

  function cleanDate(v) {
    if (typeof v !== 'string') return null;
    return isFinite(dayNum(v)) ? v : null;
  }

  function cleanUrl(v) {
    var s = cleanLine(v, 500);
    if (!s) return '';
    if (!/^https?:\/\//i.test(s)) {
      if (/^[\w-]+(\.[\w-]+)+(\/|$)/.test(s)) s = 'https://' + s; else return '';
    }
    try {
      var u = new URL(s);
      return (u.protocol === 'http:' || u.protocol === 'https:') ? u.href : '';
    } catch (e) { return ''; }
  }

  function cleanGoal(g) {
    if (!g || typeof g !== 'object') return null;
    var v = Number(g.v);
    if (g.t === 'days') return (isFinite(v) && v >= 1 && v <= 36500) ? { t: 'days', v: Math.round(v) } : null;
    if (g.t === 'daily') return (isFinite(v) && v > 0 && v <= MAX_MONEY) ? { t: 'daily', v: Math.round(v * 10000) / 10000 } : null;
    return null;
  }

  function cleanFx(f) {
    if (!f || typeof f !== 'object') return null;
    var a = Number(f.a), r = Number(f.r);
    if (!(isFinite(a) && a >= 0 && a <= MAX_MONEY && isFinite(r) && r > 0 && r < 1e6)) return null;
    return { a: round2(a), r: Math.round(r * 1e6) / 1e6, s: cleanLine(f.s, 3) || '$' };
  }

  var idSeq = 0;
  function newId(prefix) {
    var r = '';
    try {
      var c = (typeof crypto !== 'undefined' && crypto.getRandomValues) ? crypto : null;
      if (c) {
        var a = new Uint32Array(2); c.getRandomValues(a);
        r = a[0].toString(36) + a[1].toString(36);
      }
    } catch (e) { r = ''; }
    if (!r) r = Math.floor(Math.random() * 1e12).toString(36) + Date.now().toString(36);
    idSeq = (idSeq + 1) % 1296;
    return (prefix || 'a') + (r + idSeq.toString(36)).slice(0, 11);
  }

  function validId(s) { return typeof s === 'string' && /^[A-Za-z0-9_-]{1,32}$/.test(s); }

  /* ------------------------------------------------------------------ 图标猜测 */

  // 顺序有讲究：先具体（手柄、键盘）后笼统（游戏、电脑）
  var ICON_RULES = [
    [/手柄|摇杆|controller|gamepad|joy-?con/i, '🕹️'],
    [/键盘|keyboard/i, '⌨️'],
    [/鼠标|mouse/i, '🖱️'],
    [/耳机|耳塞|airpods|buds|headphone|headset|earphone/i, '🎧'],
    [/手表|手环|watch|band/i, '⌚'],
    [/无人机|drone|mavic|dji\s?(mini|air|avata)/i, '🚁'],
    [/摄像|action|gopro|pocket|摄影机|camcorder/i, '📹'],
    [/相机|镜头|camera|lens|单反|微单/i, '📷'],
    [/掌机|steam\s?deck|rog\s?ally|legion\s?go|ayn|ayaneo|retroid/i, '👾'],
    [/switch|playstation|ps[45]|xbox|游戏机|游戏主机/i, '🎮'],
    [/显示器|monitor|屏幕/i, '🖥️'],
    [/主机|台式|desktop|工作站|\b\d0[5-9]0(\s?ti)?\b|nuc|mac\s?(mini|studio|pro)/i, '🖥️'],
    [/笔记本|macbook|laptop|thinkpad|小新|轻薄本|游戏本/i, '💻'],
    [/平板|ipad|tablet|pad|y700/i, '📱'],
    [/手机|iphone|phone|pixel|galaxy|小米|华为|一加|\d{2}\s?p(ro)?\s?m(ax)?\b/i, '📱'],
    [/电视|tv|投影/i, '📺'],
    [/音箱|音响|speaker|homepod|soundbar/i, '🔊'],
    [/麦克风|话筒|mic/i, '🎙️'],
    [/路由|router|wifi|nas|交换机/i, '📡'],
    [/硬盘|ssd|hdd|固态|u盘|存储卡/i, '💾'],
    [/充电宝|电池|battery|移动电源/i, '🔋'],
    [/充电|电源|adapter|charger|插座|扩展坞|dock|hub|线/i, '🔌'],
    [/打印|printer/i, '🖨️'],
    [/vr|quest|vision\s?pro|头显/i, '🥽'],
    [/kindle|阅读器|电纸书|墨水屏/i, '📖'],
    [/灯|light|lamp/i, '💡'],
    [/吸尘|扫地|洗地|机器人/i, '🤖'],
    [/自行车|单车|bike/i, '🚲'],
    [/电动车|滑板车|摩托/i, '🛵'],
    [/suv|越野|rogue|rav4|cr-?v|汉兰达|model\s?[yx]/i, '🚙'],
    [/汽车|轿车|车$|car\b|tesla|model\s?[s3]/i, '🚗'],
    [/游戏外设/i, '🕹️'],
    [/外设/i, '⌨️'],
    [/游戏/i, '🎮'],
    [/电脑|pc\b/i, '🖥️']
  ];

  /* 图标选择器里的表情，按类别分组。都是 2020 年（Emoji 13.0）及以前就有的，现在各家系统都能显示。
   * 改完跑一下 python3 dev/check-emoji.py（会检查有没有重复、有没有太新的、写法对不对）。 */
  /*@icons*/
  var ICON_GROUPS = [
    ['数码', '📱 📲 💻 🖥️ ⌨️ 🖱️ 🖲️ 🖨️ ⌚ 📟 📠 ☎️ 📞 🔋 🔌 💾 💿 📀 💽 📡 🛰️ 🤖 🥽 🧮 💡 🔦 🎮 🕹️ 👾 📶 🌐 ⚡ 🔗 🧲 🔭 🔬'],
    ['影音', '🎧 🎤 🎙️ 🎚️ 🎛️ 📻 🔈 🔊 📢 📣 🔔 📺 📷 📸 📹 🎥 📽️ 🎞️ 🎬 📼 🎵 🎶 🎼 🎹 🎸 🎻 🎺 🎷 🪕 🪗 🥁 🪘'],
    ['玩具', '🎲 ♟️ 🧩 🧸 🪀 🪁 🎯 🎰 🎳 🃏 🀄 🎴 🪄 🪅 🪆 🎈 🎁 🎀 🎏 🎎 🎐 🔮 🧿 🎠 🎡 🎢 🎪 🎭 🎨'],
    ['家居', '🏠 🏡 🛋️ 🛏️ 🪑 🚪 🪟 🪞 🖼️ 🕰️ ⏰ ⏱️ ⏲️ ⌛ ⏳ 🕯️ 🪔 🧹 🧺 🪣 🧻 🧼 🧽 🧴 🪥 🪒 🚿 🛁 🚽 🧯 🌡️ 🪴 🏺 🔑 🗝️ 🔒 🔓 🔐 🛎️ 🧷 🧵 🧶 🪡 🪜 🧱 🪵'],
    ['厨房', '🍳 🥘 🍲 🥣 🍽️ 🍴 🥄 🔪 🥢 🥡 ☕ 🍵 🫖 🧋 🥤 🧃 🧉 🍶 🍼 🥛 🍾 🍷 🍸 🍹 🍺 🍻 🥂 🥃 🧊 🧂 🫕 🥫'],
    ['出行', '🚗 🚙 🚕 🚓 🏎️ 🚌 🚎 🚐 🚑 🚒 🛻 🚚 🚛 🚜 🏍️ 🛵 🛺 🚲 🛴 🛹 🛼 🦽 🦼 🚂 🚆 🚄 🚅 🚇 🚊 🚉 ✈️ 🛩️ 🚁 🚀 🛸 ⛵ 🚤 🛥️ 🛳️ ⛴️ 🚢 🛶 ⚓ ⛽ 🚦 🚥 🚧 🗺️ 🧭 🎫 🎟️ 🧳 ⛺ 🏕️ 🪂'],
    ['穿戴', '👓 🕶️ 👔 👕 👖 🧣 🧤 🧥 🧦 👗 👘 🥻 🩱 🩲 🩳 👙 👚 🥼 🦺 👛 👜 👝 🛍️ 🎒 👞 👟 🥾 🥿 👠 👡 🩰 👢 🩴 👑 👒 🎩 🎓 🧢 🪖 ⛑️ 📿 💄 💍 💎 🌂 ☂️'],
    ['运动', '⚽ 🏀 🏈 ⚾ 🥎 🎾 🏐 🏉 🥏 🎱 🏓 🏸 🏒 🏑 🥍 🏏 🥅 ⛳ 🏹 🎣 🤿 🥊 🥋 🎽 🛷 ⛸️ 🥌 🎿 🏆 🥇 🥈 🥉 🏅 🎖️'],
    ['工具', '🔧 🔨 🪛 🪚 ⚒️ 🛠️ ⛏️ 🪓 🔩 ⚙️ 🗜️ ⚖️ ⛓️ 🪝 🧰 🧪 🧫 🧬 💉 💊 🩹 🩺 🦯 🪤 🪠 📏 📐 ✂️ 🛡️'],
    ['办公', '📚 📖 📕 📗 📘 📙 📓 📔 📒 📃 📜 📄 📰 🗞️ 📑 🔖 🏷️ ✉️ 📧 📦 📫 📮 ✏️ ✒️ 🖋️ 🖊️ 🖌️ 🖍️ 📝 💼 📁 📂 🗂️ 📅 📆 🗒️ 🗓️ 📇 📈 📉 📊 📋 📌 📍 📎 🖇️ 🗃️ 🗄️ 🗑️ 🔍 🔎 💰 🪙 💴 💵 💶 💷 💸 💳 🧾'],
    ['动物', '🐶 🐱 🐭 🐹 🐰 🦊 🐻 🐼 🐨 🐯 🦁 🐮 🐷 🐸 🐵 🐔 🐧 🐦 🐤 🦆 🦉 🐴 🦄 🐝 🦋 🐢 🐍 🐙 🐠 🐟 🐬 🐳 🦈 🐊 🦖 🦕 🐘 🦒 🐑 🐕 🐈 🐇 🐿️ 🦔 🦜 🦩 🐾'],
    ['自然', '🌵 🎄 🌲 🌳 🌴 🌱 🌿 ☘️ 🍀 🎍 🎋 🍃 🍂 🍁 🍄 🌾 💐 🌷 🌹 🥀 🌺 🌸 🌼 🌻 🌙 ⭐ 🌟 ✨ 🔥 🌈 ☀️ ⛅ ☁️ ❄️ ☃️ 💧 🌊 🌍 🪐'],
    ['吃的', '🍎 🍊 🍋 🍌 🍉 🍇 🍓 🍑 🍒 🍍 🥝 🥥 🍅 🥑 🌽 🥕 🍞 🥐 🥖 🧀 🥚 🍔 🍟 🍕 🌭 🥪 🌮 🍜 🍝 🍣 🍱 🍙 🍚 🍛 🥟 🍤 🍰 🎂 🧁 🍩 🍪 🍫 🍬 🍭 🍦 🍿'],
    ['符号', '❤️ 🧡 💛 💚 💙 💜 🖤 🤍 🤎 💯 ✅ ❌ ⭕ ❗ ❓ ⚠️ ♻️ 🔴 🟠 🟡 🟢 🔵 🟣 ⚫ ⚪ 🟤 🔶 🔷 🆕 🆒 🆓 🔝 💤 💥 💫 💦 🎉 🎊 🏁 🚩 🏴 🏳️']
  ].map(function (g) { return { name: g[0], list: g[1].split(' ') }; });
  /*@end*/

  function guessIcon(name, cat) {
    var a = String(name || ''), b = String(cat || '');
    for (var i = 0; i < ICON_RULES.length; i++) if (ICON_RULES[i][0].test(a)) return ICON_RULES[i][1];
    for (var j = 0; j < ICON_RULES.length; j++) if (ICON_RULES[j][0].test(b)) return ICON_RULES[j][1];
    return '📦';
  }

  /* ------------------------------------------------------------------ 数据清洗 */

  function sanitizeExtra(x, seen) {
    if (!x || typeof x !== 'object') return null;
    var amt = cleanMoney(x.amt), date = cleanDate(x.date);
    if (amt == null || !date) return null;
    var id = validId(x.id) && !seen[x.id] ? x.id : newId('x');
    seen[id] = 1;
    var out = { id: id, name: cleanLine(x.name, 40) || '追加花费', date: date, amt: amt };
    var fx = cleanFx(x.fx); if (fx) out.fx = fx;
    return out;
  }

  function sanitizeAsset(a, seen) {
    if (!a || typeof a !== 'object') return null;
    var name = cleanLine(a.name, 60), buy = cleanDate(a.buy), price = cleanMoney(a.price);
    if (!name || !buy || price == null) return null;
    var id = validId(a.id) && !seen[a.id] ? a.id : newId('a');
    seen[id] = 1;
    var out = {
      id: id, name: name, cat: cleanLine(a.cat, 20),
      icon: cleanIcon(a.icon) || guessIcon(name, a.cat),
      buy: buy, price: price, extras: [], status: 'active', note: cleanStr(a.note, 500),
      ct: isFinite(a.ct) ? +a.ct : Date.now(), ut: isFinite(a.ut) ? +a.ut : Date.now()
    };
    var fx = cleanFx(a.fx); if (fx) out.fx = fx;
    if (Array.isArray(a.extras)) {
      var xs = {};
      for (var i = 0; i < a.extras.length && out.extras.length < 200; i++) {
        var x = sanitizeExtra(a.extras[i], xs); if (x) out.extras.push(x);
      }
    }
    var end = cleanDate(a.end);
    if ((a.status === 'retired' || a.status === 'sold') && end && dayNum(end) >= dayNum(buy)) {
      out.status = a.status; out.end = end;
      if (a.status === 'sold') {
        out.sold = cleanMoney(a.sold); if (out.sold == null) out.sold = 0;
        var sfx = cleanFx(a.soldFx); if (sfx) out.soldFx = sfx;
      }
    }
    var goal = cleanGoal(a.goal); if (goal) out.goal = goal;
    var resale = cleanMoney(a.resale); if (resale != null) out.resale = resale;
    if (a.big === true) out.big = true;
    if (isFinite(a.photo) && +a.photo > 0) out.photo = +a.photo;
    return out;
  }

  function sanitizeWish(w, seen) {
    if (!w || typeof w !== 'object') return null;
    var name = cleanLine(w.name, 60), price = cleanMoney(w.price);
    if (!name || price == null) return null;
    var id = validId(w.id) && !seen[w.id] ? w.id : newId('w');
    seen[id] = 1;
    var out = {
      id: id, name: name, cat: cleanLine(w.cat, 20), icon: cleanIcon(w.icon) || guessIcon(name, w.cat),
      price: price, url: cleanUrl(w.url), note: cleanStr(w.note, 500),
      ct: isFinite(w.ct) ? +w.ct : Date.now(), ut: isFinite(w.ut) ? +w.ut : Date.now()
    };
    var fx = cleanFx(w.fx); if (fx) out.fx = fx;
    var goal = cleanGoal(w.goal); if (goal) out.goal = goal;
    return out;
  }

  function defaultSettings() {
    return { cur: '¥', fxSym: '$', fxRate: 7.1, goal: { t: 'days', v: 1095 }, theme: 'auto', accent: 'yellow',
      incBig: false, sort: 'daily', custom: false, view: 'list', filt: 'active', edge: 'normal', edgeColor: '' };
  }

  function sanitizeSettings(s) {
    var d = defaultSettings();
    if (!s || typeof s !== 'object') return d;
    var cur = cleanLine(s.cur, 3); if (cur) d.cur = cur;
    var fs = cleanLine(s.fxSym, 3); if (fs) d.fxSym = fs;
    var r = Number(s.fxRate); if (isFinite(r) && r > 0 && r < 1e6) d.fxRate = Math.round(r * 1e6) / 1e6;
    var g = cleanGoal(s.goal); if (g) d.goal = g;
    if (s.theme === 'light' || s.theme === 'dark' || s.theme === 'auto') d.theme = s.theme;
    if (ACCENTS.indexOf(s.accent) >= 0) d.accent = s.accent;
    d.incBig = s.incBig === true;
    if (SORTS.indexOf(s.sort) >= 0) d.sort = s.sort;
    d.custom = s.custom === true;                 // 有没有手动排过顺序（排过以后，装备在数组里的先后就是那个顺序）
    if (s.view === 'wall' || s.view === 'list') d.view = s.view;
    if (s.filt === 'all' || STATUSES.indexOf(s.filt) >= 0) d.filt = s.filt;
    if (EDGES.indexOf(s.edge) >= 0) d.edge = s.edge;
    d.edgeColor = cleanColor(s.edgeColor);            // 没有单独设颜色的贴纸用这个颜色做边；'' 就是白色
    return d;
  }

  /** 类别清单：[{name, color}]。名字不重复，最多 60 个。 */
  function sanitizeCats(list) {
    var out = [], seen = {};
    if (!Array.isArray(list)) return out;
    for (var i = 0; i < list.length && out.length < 60; i++) {
      var c = list[i];
      if (!c || typeof c !== 'object') continue;
      var name = cleanLine(c.name, 20);
      if (!name || seen['$' + name]) continue;
      seen['$' + name] = true;
      out.push({ name: name, color: cleanColor(c.color) });
    }
    return out;
  }

  function emptyState() {
    return { v: SCHEMA, assets: [], wishes: [], cats: [], settings: defaultSettings(), demo: false, bk: { t: 0, n: 0 } };
  }

  /** 任何来源的数据（本地存储、备份文件、导入码）都先过这一道。返回 {state, dropped}。 */
  function sanitizeState(obj) {
    var st = emptyState(), dropped = 0;
    if (!obj || typeof obj !== 'object') return { state: st, dropped: 0 };
    var seenA = {}, seenW = {}, i;
    if (Array.isArray(obj.assets)) {
      for (i = 0; i < obj.assets.length && st.assets.length < 2000; i++) {
        var a = sanitizeAsset(obj.assets[i], seenA);
        if (a) st.assets.push(a); else dropped++;
      }
    }
    if (Array.isArray(obj.wishes)) {
      for (i = 0; i < obj.wishes.length && st.wishes.length < 1000; i++) {
        var w = sanitizeWish(obj.wishes[i], seenW);
        if (w) st.wishes.push(w); else dropped++;
      }
    }
    st.cats = sanitizeCats(obj.cats);
    st.settings = sanitizeSettings(obj.settings);
    st.demo = obj.demo === true;
    if (obj.bk && typeof obj.bk === 'object') {
      st.bk = { t: isFinite(obj.bk.t) ? +obj.bk.t : 0, n: isFinite(obj.bk.n) ? Math.max(0, +obj.bk.n | 0) : 0 };
    }
    return { state: st, dropped: dropped };
  }

  /* ------------------------------------------------------------------ 类别和类别颜色 */

  /* 装备上记的类别就是一个名字（asset.cat）。state.cats 是「自己建的类别」清单，记着每个类别的边框颜色。
   * 两边靠名字对上：改名、合并、删除时这里负责把装备和心愿上的名字一起改掉。 */

  function catIndex(state, name) {
    for (var i = 0; i < state.cats.length; i++) if (state.cats[i].name === name) return i;
    return -1;
  }

  /** 这个类别的边框颜色；没设返回 ''。 */
  function catColor(state, name) {
    var i = name ? catIndex(state, name) : -1;
    return i < 0 ? '' : state.cats[i].color;
  }

  /** 所有类别：自己建的在前（按建的先后），后面是装备、心愿上用到但没建的（按件数从多到少）。 */
  function catList(state) {
    var rows = [], at = {};
    function row(name) {
      var k = '$' + name;
      if (at[k] == null) { at[k] = rows.length; rows.push({ name: name, color: '', n: 0, w: 0, defined: false, seq: rows.length }); }
      return rows[at[k]];
    }
    state.cats.forEach(function (c) { var r = row(c.name); r.color = c.color; r.defined = true; });
    var nDef = rows.length;
    state.assets.forEach(function (a) { if (a.cat) row(a.cat).n++; });
    state.wishes.forEach(function (w) { if (w.cat) row(w.cat).w++; });
    var tail = rows.slice(nDef).sort(function (p, q) { return (q.n + q.w) - (p.n + p.w) || p.seq - q.seq; });
    return rows.slice(0, nDef).concat(tail);
  }

  /** 新建类别，或者改已有类别的颜色。返回清洗后的名字（名字是空的返回 ''）。 */
  function upsertCat(state, name, color) {
    name = cleanLine(name, 20);
    if (!name) return '';
    var i = catIndex(state, name), c = cleanColor(color);
    if (i >= 0) state.cats[i].color = c;
    else if (state.cats.length < 60) state.cats.push({ name: name, color: c });
    return name;
  }

  /** 改名。新名字已经有了就是合并：东西都归到那个类别下，颜色跟那个类别。返回动了几件。 */
  function renameCat(state, from, to, now) {
    to = cleanLine(to, 20);
    if (!from || !to || from === to) return 0;
    var n = 0, t = now || Date.now();
    state.assets.concat(state.wishes).forEach(function (x) { if (x.cat === from) { x.cat = to; x.ut = t; n++; } });
    var i = catIndex(state, from), j = catIndex(state, to);
    if (i >= 0) { if (j >= 0) state.cats.splice(i, 1); else state.cats[i].name = to; }
    return n;
  }

  /** 删掉一个类别：原来属于它的装备和心愿变成没有类别。返回动了几件。 */
  function removeCat(state, name, now) {
    if (!name) return 0;
    var n = 0, t = now || Date.now(), i = catIndex(state, name);
    state.assets.concat(state.wishes).forEach(function (x) { if (x.cat === name) { x.cat = ''; x.ut = t; n++; } });
    if (i >= 0) state.cats.splice(i, 1);
    return n;
  }

  /** 指定哪些装备属于这个类别：ids 里的归进来；原来在里面、但不在 ids 里的变成没有类别。返回动了几件。 */
  function setCatMembers(state, name, ids, now) {
    if (!name) return 0;
    var want = {}, n = 0, t = now || Date.now();
    (ids || []).forEach(function (id) { want['$' + id] = true; });
    state.assets.forEach(function (a) {
      if (want['$' + a.id]) { if (a.cat !== name) { a.cat = name; a.ut = t; n++; } }
      else if (a.cat === name) { a.cat = ''; a.ut = t; n++; }
    });
    return n;
  }

  /** 一键配色：还没有颜色的类别，按清单的先后依次分到还没被用掉的预设色；预设色用完就不再分。返回分了几个。 */
  function autoColorCats(state) {
    var used = {}, free = [], n = 0, i;
    state.cats.forEach(function (c) { if (c.color) used[c.color] = true; });
    for (i = 1; i <= CAT_PRESET_N; i++) if (!used['p' + i]) free.push('p' + i);
    catList(state).forEach(function (r) {
      if (r.color || !free.length) return;
      if (upsertCat(state, r.name, free[0])) { free.shift(); n++; }
    });
    return n;
  }

  /* ------------------------------------------------------------------ 单件装备的计算 */

  function goalOf(asset, settings) {
    return cleanGoal(asset && asset.goal) || cleanGoal(settings && settings.goal) || DEFAULT_GOAL;
  }

  /** 成本随时间的台阶：[{t: 第几天起, c: 累计成本}]，t 从 1 开始。追加花费记在它发生的那一天。 */
  function costSteps(asset) {
    var buy = dayNum(asset.buy), steps = [{ t: 1, c: asset.price }];
    var xs = (asset.extras || []).map(function (x) {
      return { t: Math.max(1, dayNum(x.date) - buy + 1), amt: x.amt };
    }).sort(function (p, q) { return p.t - q.t; });
    for (var i = 0; i < xs.length; i++) {
      var last = steps[steps.length - 1];
      if (xs[i].t === last.t) last.c = round2(last.c + xs[i].amt);
      else steps.push({ t: xs[i].t, c: round2(last.c + xs[i].amt) });
    }
    return steps;
  }

  function costAt(steps, t) {
    var c = steps[0].c;
    for (var i = 1; i < steps.length && steps[i].t <= t; i++) c = steps[i].c;
    return c;
  }

  function totalCost(asset) {
    var c = asset.price, xs = asset.extras || [];
    for (var i = 0; i < xs.length; i++) c += xs[i].amt;
    return round2(c);
  }

  /** 日均最后一次跌到 theta 以下（之后不再回到上面）是第几天。 */
  function thresholdDay(steps, theta) {
    if (!(theta > 0)) return null;
    var ans = null;
    for (var j = steps.length - 1; j >= 0; j--) {
      var a = steps[j].t, b = j < steps.length - 1 ? steps[j + 1].t - 1 : Infinity, c = steps[j].c;
      if (b < a) continue;
      var t0 = Math.max(a, Math.ceil(c / theta - 1e-9));
      if (t0 > b) break;
      ans = t0;
      if (t0 > a) break;
    }
    return ans;
  }

  /**
   * 一件装备在 today 这天的全部数字。
   * @returns {{days, cost, daily, endDay, buyDay, future, net, netDaily, goal, targetDaily, targetDays,
   *            reached, progress, goalDate, daysLeft, sinceGoal, drop, p30, p90, p365, ifSoldNet, ifSoldDaily, shown}}
   */
  function calc(asset, today, settings) {
    var buyDay = dayNum(asset.buy), todayDay = dayNum(today);
    var active = asset.status === 'active' || !asset.end;
    var endDay = active ? todayDay : Math.min(dayNum(asset.end), Math.max(todayDay, buyDay));
    var future = buyDay > todayDay;
    var days = Math.max(1, endDay - buyDay + 1);
    var cost = totalCost(asset);
    var daily = cost / days;
    var sold = asset.status === 'sold' && !active;
    var net = sold ? round2(cost - (asset.sold || 0)) : cost;
    var netDaily = net / days;

    var goal = goalOf(asset, settings), targetDaily, targetDays;
    if (goal.t === 'days') { targetDays = goal.v; targetDaily = cost / goal.v; }
    else { targetDaily = goal.v; targetDays = Math.max(1, Math.ceil(cost / goal.v - 1e-9)); }

    var shown = sold ? netDaily : daily;              // 列表和排行里用的「日均」
    var reached = sold ? (netDaily <= targetDaily + 1e-9) : days >= targetDays;
    var progress = cost <= 0 ? 1 : sold ? Math.min(1, targetDaily / Math.max(netDaily, 1e-12)) : Math.min(1, days / targetDays);
    if (reached) progress = 1;
    var goalDay = buyDay + targetDays - 1;

    var out = {
      buyDay: buyDay, endDay: endDay, future: future, active: active, days: days, cost: cost, daily: daily,
      net: net, netDaily: netDaily, shown: shown,
      goal: goal, targetDaily: targetDaily, targetDays: targetDays,
      reached: reached, progress: progress, goalDate: dayStr(goalDay),
      daysLeft: Math.max(0, targetDays - days), sinceGoal: Math.max(0, days - targetDays),
      drop: active ? daily - cost / (days + 1) : 0,
      p30: cost / (days + 30), p90: cost / (days + 90), p365: cost / (days + 365)
    };
    if (asset.resale != null && !sold) {
      out.ifSoldNet = round2(cost - asset.resale);
      out.ifSoldDaily = out.ifSoldNet / days;
    }
    return out;
  }

  /* ------------------------------------------------------------------ 合计 */

  /** 某一天（绝对天数）有哪些装备在服役，以及那天的合计日均。 */
  function totalDailyAt(prepared, day) {
    var sum = 0;
    for (var i = 0; i < prepared.length; i++) {
      var p = prepared[i];
      if (day < p.buyDay || day > p.lastDay) continue;
      var t = day - p.buyDay + 1;
      sum += costAt(p.steps, t) / t;
    }
    return sum;
  }

  /** 给合计 / 图表用的预处理：每件装备的购入日、最后服役日、成本台阶。 */
  function prepare(assets, today, opts) {
    var todayDay = dayNum(today), incBig = !opts || opts.incBig !== false, out = [];
    for (var i = 0; i < assets.length; i++) {
      var a = assets[i];
      if (!incBig && a.big) continue;
      var buyDay = dayNum(a.buy);
      if (buyDay > todayDay) continue;
      var act = a.status === 'active' || !a.end;
      out.push({ asset: a, buyDay: buyDay, lastDay: act ? Infinity : dayNum(a.end), active: act, steps: costSteps(a) });
    }
    return out;
  }

  function summary(assets, today, settings, opts) {
    var incBig = !opts || opts.incBig !== false;
    var s = { n: 0, active: 0, retired: 0, sold: 0, cost: 0, costAll: 0, daily: 0, drop: 0, reached: 0, counted: 0,
      resale: 0, resaleN: 0, bigN: 0, bigNames: [], soldNet: 0, soldBack: 0, daysSum: 0, future: 0 };
    for (var i = 0; i < assets.length; i++) {
      var a = assets[i];
      if (a.big) { s.bigN++; if (a.status === 'active') s.bigNames.push(a.name); }
      if (!incBig && a.big) continue;
      var c = calc(a, today, settings);
      s.n++; s[a.status]++; s.costAll += c.cost;
      if (a.status === 'active') {
        if (c.future) { s.future++; continue; }
        s.cost += c.cost; s.daily += c.daily; s.drop += c.drop; s.daysSum += c.days;
        s.counted++; if (c.reached) s.reached++;
        if (a.resale != null) { s.resale += a.resale; s.resaleN++; }
      } else if (a.status === 'sold') {
        s.soldNet += c.net; s.soldBack += (a.sold || 0);
      }
    }
    s.cost = round2(s.cost); s.costAll = round2(s.costAll);
    return s;
  }

  /** catOrder：按类别排的时候，类别的先后（名字的数组，一般是 catList 的顺序）。没有类别的排在最后。 */
  function sortAssets(list, key, today, settings, catOrder) {
    if (key === 'manual') return list.slice();                 // 自定义顺序：就是数组里的先后
    var c = {}, rank = {};
    (catOrder || []).forEach(function (name, i) { if (rank['$' + name] == null) rank['$' + name] = i; });
    function k(a) { return c[a.id] || (c[a.id] = calc(a, today, settings)); }
    function r(a) { if (!a.cat) return 1e9; var v = rank['$' + a.cat]; return v == null ? 1e8 : v; }
    var cmp = {
      'daily': function (a, b) { return k(b).shown - k(a).shown; },
      'daily-asc': function (a, b) { return k(a).shown - k(b).shown; },
      'new': function (a, b) { return dayNum(b.buy) - dayNum(a.buy); },
      'old': function (a, b) { return dayNum(a.buy) - dayNum(b.buy); },
      'price': function (a, b) { return k(b).cost - k(a).cost; },
      'goal': function (a, b) { return k(b).progress - k(a).progress || k(a).daysLeft - k(b).daysLeft; },
      'name': function (a, b) { return a.name.localeCompare(b.name, 'zh-Hans-CN'); },
      // 同一个类别的挨在一起；类别之间按 catOrder；类别里面日均高的在前
      'cat': function (a, b) { return r(a) - r(b) || (a.cat || '').localeCompare(b.cat || '', 'zh-Hans-CN') || k(b).shown - k(a).shown; }
    }[key] || function () { return 0; };
    return list.slice().sort(function (a, b) { return cmp(a, b) || (a.ct - b.ct) || (a.id < b.id ? -1 : 1); });
  }

  /**
   * 自定义顺序。all 是全部装备，ids 是其中一部分（比如只看「服役中」时屏幕上的那几件）的新顺序：
   * 这几件原来占着哪几个位置，就按新顺序重新填进那几个位置；没出现在 ids 里的原地不动。返回新数组。
   */
  function reorderSubset(all, ids) {
    var byId = {}, want = [], seen = {}, i;
    for (i = 0; i < all.length; i++) byId[all[i].id] = all[i];
    for (i = 0; i < (ids || []).length; i++) {
      var id = ids[i];
      if (byId[id] && !seen[id]) { seen[id] = true; want.push(byId[id]); }
    }
    var out = all.slice(), k = 0;
    for (i = 0; i < out.length && k < want.length; i++) if (seen[out[i].id]) out[i] = want[k++];
    return out;
  }

  /* ------------------------------------------------------------------ 里程碑 */

  var DAY_MARKS = [100, 500, 1000, 1500, 2000, 2500, 3000, 3500, 4000, 5000, 6000, 7000, 8000, 9000, 10000];

  function thresholds(maxV, minV) {
    var out = [], e = Math.floor(Math.log10(maxV));
    for (; e >= -3; e--) {
      var base = Math.pow(10, e);
      [5, 2, 1].forEach(function (m) {
        var v = Math.round(m * base * 1e6) / 1e6;
        if (v < maxV && v >= minV) out.push(v);
      });
    }
    return out;
  }

  /**
   * 一件装备的全部里程碑（已经过去的和将来的），按日期排好。
   * 每条：{date, day, type, id, v}，type ∈ buy | days | year | below | goal | retire | sold
   * 将来的只算到 horizon 天以后为止（默认 20 年）。
   */
  function assetMilestones(asset, today, settings, horizon) {
    var c = calc(asset, today, settings), steps = costSteps(asset), list = [];
    var limit = c.active ? c.days + (horizon || 7300) : c.days;       // 以「第几天」计
    function push(t, type, v) {
      if (t < 1 || t > limit) return;
      list.push({ date: dayStr(c.buyDay + t - 1), day: t, type: type, id: asset.id, v: v });
    }
    push(1, 'buy', asset.price);
    DAY_MARKS.forEach(function (n) { push(n, 'days', n); });
    for (var k = 1; k <= 60; k++) {
      var t = dayNum(addYears(asset.buy, k)) - c.buyDay + 1;
      if (t > limit) break;
      push(t, 'year', k);
    }
    var first30 = costAt(steps, 30) / 30;
    thresholds(first30, 0.001).forEach(function (th) {
      var t = thresholdDay(steps, th);
      if (t != null && t >= 30) push(t, 'below', th);
    });
    if (asset.status !== 'sold' && c.cost > 0) push(c.targetDays, 'goal', c.targetDaily);
    if (asset.status === 'retired' && !c.active) list.push({ date: asset.end, day: c.days, type: 'retire', id: asset.id, v: c.daily });
    if (asset.status === 'sold' && !c.active) list.push({ date: asset.end, day: c.days, type: 'sold', id: asset.id, v: asset.sold || 0 });
    var order = { buy: 0, days: 1, year: 2, below: 3, goal: 4, retire: 5, sold: 6 };
    list.sort(function (a, b) { return a.day - b.day || order[a.type] - order[b.type]; });
    return list;
  }

  /** 合计日均下一个整数关口，以及不再买新东西的话哪天跌破它。找不到（两年内到不了）返回 null。 */
  function nextTotalMark(assets, today, opts) {
    var prep = prepare(assets, today, opts).filter(function (p) { return p.active; });
    if (!prep.length) return null;
    var d0 = dayNum(today), now = totalDailyAt(prep, d0);
    if (!(now > 0)) return null;
    var step = Math.pow(10, Math.floor(Math.log10(now)));
    var mark = Math.floor((now - 1e-9) / step) * step;
    if (mark <= 0) { step /= 10; mark = Math.floor((now - 1e-9) / step) * step; }
    if (mark <= 0) return null;
    mark = Math.round(mark * 1e6) / 1e6;
    // 合计只会越来越小，二分找第一天 ≤ mark
    var lo = 1, hi = 731;
    if (totalDailyAt(prep, d0 + hi) > mark) return null;
    while (lo < hi) {
      var mid = (lo + hi) >> 1;
      if (totalDailyAt(prep, d0 + mid) <= mark) hi = mid; else lo = mid + 1;
    }
    return { mark: mark, inDays: lo, date: dayStr(d0 + lo), now: now };
  }

  /** 所有装备的里程碑汇总：{past: 新的在前, upcoming: 近的在前}。 */
  function milestones(assets, today, settings, opts) {
    var d0 = dayNum(today), past = [], up = [];
    var within = (opts && opts.within) || 366;
    for (var i = 0; i < assets.length; i++) {
      var ms = assetMilestones(assets[i], today, settings, within);
      for (var j = 0; j < ms.length; j++) {
        var m = ms[j], d = dayNum(m.date);
        if (d <= d0) past.push(m); else if (d - d0 <= within) up.push(m);
      }
    }
    var order = { sold: 0, retire: 1, goal: 2, below: 3, year: 4, days: 5, buy: 6 };
    past.sort(function (a, b) { return dayNum(b.date) - dayNum(a.date) || order[a.type] - order[b.type]; });
    up.sort(function (a, b) { return dayNum(a.date) - dayNum(b.date) || order[a.type] - order[b.type]; });
    return { past: past, upcoming: up };
  }

  /** 里程碑的中文标题。name 传装备名；cur 传货币符号。 */
  function milestoneText(m, name, cur) {
    switch (m.type) {
      case 'buy': return { title: '入手 ' + name, sub: fmtMoney(m.v, cur) };
      case 'days': return { title: name + ' 服役满 ' + fmtNum(m.v) + ' 天', sub: '' };
      case 'year': return { title: name + ' 服役满 ' + m.v + ' 年', sub: '' };
      case 'below': return { title: name + ' 日均跌破 ' + fmtMoney(m.v, cur), sub: '第 ' + fmtNum(m.day) + ' 天' };
      case 'goal': return { title: name + ' 回本', sub: '日均降到目标 ' + fmtDaily(m.v, cur) };
      case 'retire': return { title: name + ' 退役', sub: '服役 ' + fmtNum(m.day) + ' 天，日均定格在 ' + fmtDaily(m.v, cur) };
      case 'sold': return { title: '卖出 ' + name, sub: '回血 ' + fmtMoney(m.v, cur) };
    }
    return { title: name, sub: '' };
  }

  /* ------------------------------------------------------------------ 备份码 */

  var B64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';

  function utf8Encode(str) {
    if (typeof TextEncoder !== 'undefined') return new TextEncoder().encode(str);
    var s = unescape(encodeURIComponent(str)), out = new Uint8Array(s.length);
    for (var i = 0; i < s.length; i++) out[i] = s.charCodeAt(i);
    return out;
  }

  function utf8Decode(bytes) {
    if (typeof TextDecoder !== 'undefined') return new TextDecoder('utf-8', { fatal: true }).decode(bytes);
    var s = '';
    for (var i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]);
    return decodeURIComponent(escape(s));
  }

  function b64uEncode(bytes) {
    var out = '', i = 0, n = bytes.length;
    for (; i + 2 < n; i += 3) {
      var v = (bytes[i] << 16) | (bytes[i + 1] << 8) | bytes[i + 2];
      out += B64[v >> 18] + B64[(v >> 12) & 63] + B64[(v >> 6) & 63] + B64[v & 63];
    }
    if (n - i === 1) { var a = bytes[i]; out += B64[a >> 2] + B64[(a & 3) << 4]; }
    else if (n - i === 2) { var b = (bytes[i] << 8) | bytes[i + 1]; out += B64[b >> 10] + B64[(b >> 4) & 63] + B64[(b & 15) << 2]; }
    return out;
  }

  function b64uDecode(str) {
    var s = str.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
    if (!/^[A-Za-z0-9_-]*$/.test(s) || s.length % 4 === 1) throw new Error('bad base64');
    var n = Math.floor(s.length * 3 / 4), out = new Uint8Array(n), o = 0, acc = 0, bits = 0;
    for (var i = 0; i < s.length; i++) {
      acc = (acc << 6) | B64.indexOf(s[i]); bits += 6;
      if (bits >= 8) { bits -= 8; out[o++] = (acc >> bits) & 255; }
    }
    return out;
  }

  /** 导出用的干净对象：不带演示标记、不带照片内容。 */
  function exportObj(state, now) {
    return {
      app: 'mygear', v: SCHEMA, at: new Date(now || Date.now()).toISOString(),
      assets: state.assets, wishes: state.wishes, cats: state.cats || [], settings: state.settings
    };
  }

  /** 备份码里省掉取默认值的字段（空的追加花费、空备注、「服役中」），码能短一截；读回来时会自动补上。 */
  function compactObj(obj) {
    function slim(x) {
      var o = {};
      Object.keys(x).forEach(function (k) {
        var v = x[k];
        if (v === '' || v == null || v === false) return;
        if (k === 'extras' && Array.isArray(v) && !v.length) return;
        if (k === 'status' && v === 'active') return;
        o[k] = v;
      });
      return o;
    }
    var out = {};
    Object.keys(obj).forEach(function (k) { out[k] = obj[k]; });
    if (Array.isArray(obj.assets)) out.assets = obj.assets.map(slim);
    if (Array.isArray(obj.wishes)) out.wishes = obj.wishes.map(slim);
    if (Array.isArray(out.cats) && !out.cats.length) delete out.cats;
    return out;
  }

  function encodeCode(obj) { return 'MG1.' + b64uEncode(utf8Encode(JSON.stringify(compactObj(obj)))); }

  /**
   * 读备份：可以是备份码（MG1.xxxx）、带 #import= 的链接、或者备份文件里的 JSON 文本。
   * 读不出来抛 Error（message 是给用户看的中文）。
   */
  function decodeAny(input) {
    var s = String(input == null ? '' : input).trim();
    if (!s) throw new Error('没有内容。把备份码或导入链接粘贴进来。');
    var obj = null;
    if (s[0] === '{') {
      try { obj = JSON.parse(s); } catch (e) { throw new Error('这段 JSON 不完整，可能没复制全。'); }
    } else {
      var i = s.indexOf('import=');
      if (i >= 0) s = s.slice(i + 7);
      try { s = decodeURIComponent(s); } catch (e) { /* 保持原样 */ }
      s = s.replace(/\s+/g, '');
      var m = /MG1\.([A-Za-z0-9_\-+\/=]+)/.exec(s);
      if (!m) throw new Error('没认出备份码。备份码以 MG1. 开头。');
      try { obj = JSON.parse(utf8Decode(b64uDecode(m[1]))); }
      catch (e) { throw new Error('备份码不完整，可能没复制全。'); }
    }
    if (!obj || typeof obj !== 'object' || (!Array.isArray(obj.assets) && !Array.isArray(obj.wishes))) {
      throw new Error('这不是「我的装备」的备份。');
    }
    if (isFinite(obj.v) && obj.v > SCHEMA) throw new Error('这份备份来自更新的版本，请先更新网页再导入。');
    return obj;
  }

  /** 把导入的数据并进现有数据：同一个 id 以更新时间晚的为准，其余追加。返回 {added, updated}。 */
  function mergeInto(state, incoming) {
    var res = { added: 0, updated: 0 };
    ['assets', 'wishes'].forEach(function (key) {
      var byId = {};
      state[key].forEach(function (x, i) { byId[x.id] = i; });
      incoming[key].forEach(function (x) {
        if (byId[x.id] != null) {
          var cur = state[key][byId[x.id]];
          if ((x.ut || 0) > (cur.ut || 0)) { state[key][byId[x.id]] = x; res.updated++; }
        } else { state[key].push(x); byId[x.id] = state[key].length - 1; res.added++; }
      });
    });
    // 类别：对方有、这边没有的加进来；这边已经有的（连同颜色）不动
    (incoming.cats || []).forEach(function (c) { if (catIndex(state, c.name) < 0 && state.cats.length < 60) state.cats.push({ name: c.name, color: c.color }); });
    return res;
  }

  /* ------------------------------------------------------------------ 表格粘贴 / CSV */

  function splitTable(text) {
    var t = String(text || '').replace(/^\ufeff/, '').replace(/\r\n?/g, '\n');
    var delim = t.indexOf('\t') >= 0 ? '\t' : ',';
    var rows = [], row = [], cell = '', q = false;
    for (var i = 0; i < t.length; i++) {
      var ch = t[i];
      if (q) {
        if (ch === '"') { if (t[i + 1] === '"') { cell += '"'; i++; } else q = false; }
        else cell += ch;
      } else if (ch === '"' && cell === '') q = true;
      else if (ch === delim) { row.push(cell); cell = ''; }
      else if (ch === '\n') { row.push(cell); rows.push(row); row = []; cell = ''; }
      else cell += ch;
    }
    if (cell !== '' || row.length) { row.push(cell); rows.push(row); }
    return rows.map(function (r) { return r.map(function (c) { return c.trim(); }); })
      .filter(function (r) { return r.some(function (c) { return c !== ''; }); });
  }

  var HEADERS = [
    ['name', /^(名字|名称|品名|物品|资产|设备|装备|name|item)/i],
    ['cat', /^(类别|分类|类型|种类|category|type)/i],
    ['buy', /^(购买时间|购买日期|购入日期|购入时间|买入日期|买入时间|入手日期|入手时间|购置日期|purchase|buy|date|日期)/i],
    ['price', /^(购入金额|购买金额|购入价|购买价|买入价|买入金额|入手价|价格|金额|原价|price|cost)/i],
    ['extra', /^(追加花费|追加|附加费用|extra)/i],
    ['status', /^(状态|status)/i],
    ['end', /^(退役日期|卖出日期|出售日期|结束日期|退役时间|卖出时间|end)/i],
    ['sold', /^(卖出金额|卖出价|出售价|出售金额|二手价|回血|sold)/i],
    ['goalDaily', /^(目标日均|目标价|目标)/i],
    ['note', /^(备注|说明|note|remark)/i],
    ['icon', /^(图标|icon|emoji)/i]
  ];

  function mapHeader(cells) {
    var map = {}, hits = 0;
    cells.forEach(function (h, idx) {
      var s = h.replace(/\s+/g, '');
      if (/日均|天后|持有|截止|下降|天数|总成本|回本/.test(s) && !/^目标日均/.test(s)) return;   // 表里算出来的列，不读
      for (var i = 0; i < HEADERS.length; i++) {
        var key = HEADERS[i][0];
        if (map[key] == null && HEADERS[i][1].test(s)) { map[key] = idx; hits++; break; }
      }
      if (/^状态\/?备注/.test(s) && map.note == null) map.note = idx;
    });
    return (map.name != null && hits >= 2) ? map : null;
  }

  function statusFromText(s) {
    if (/卖|售|出手|sold/i.test(s)) return 'sold';
    if (/退役|淘汰|闲置|报废|retired/i.test(s)) return 'retired';
    return 'active';
  }

  /**
   * 读从 Excel / Google 表格里复制出来的几行（制表符分隔）或者 CSV。
   * 第一行要有表头，至少能认出「名字」和另一列。返回 {assets: [...], skipped: [{row, why}], header}
   */
  function parseTable(text, today) {
    var rows = splitTable(text), out = { assets: [], skipped: [], header: null };
    if (!rows.length) return out;
    var hi = -1, map = null;
    for (var i = 0; i < Math.min(rows.length, 8); i++) { map = mapHeader(rows[i]); if (map) { hi = i; break; } }
    if (!map) { out.error = '没找到表头。第一行需要有「名字」「购买时间」「购入金额」这样的列名。'; return out; }
    out.header = rows[hi];
    var row;
    function cell(k) { return map[k] != null && row[map[k]] != null ? row[map[k]] : ''; }
    for (var r = hi + 1; r < rows.length; r++) {
      row = rows[r];
      var name = cleanLine(cell('name'), 60);
      if (!name) continue;
      var buy = looseDate(cell('buy')), price = parseMoney(cell('price'));
      if (!buy) { out.skipped.push({ row: r + 1, name: name, why: '购买日期认不出来' }); continue; }
      if (!isFinite(price)) { out.skipped.push({ row: r + 1, name: name, why: '金额认不出来' }); continue; }
      var a = { name: name, cat: cell('cat'), buy: buy, price: price, icon: cell('icon') };
      var stText = cell('status') || (map.status == null ? cell('note') : '');
      var st = statusFromText(stText), end = looseDate(cell('end'));
      if (st !== 'active') {
        a.status = st; a.end = end || today;
        if (st === 'sold') { var sp = parseMoney(cell('sold')); a.sold = isFinite(sp) ? sp : 0; }
      }
      var note = cell('note');
      if (note && !/^(服役中|已退役|已卖出|退役|卖出|在用)$/.test(note)) a.note = note;
      var gd = parseMoney(cell('goalDaily')); if (isFinite(gd) && gd > 0) a.goal = { t: 'daily', v: gd };
      var ex = parseMoney(cell('extra'));
      if (isFinite(ex) && ex > 0) a.extras = [{ name: '追加花费', date: buy, amt: ex }];
      var clean = sanitizeAsset(a, {});
      if (clean) out.assets.push(clean); else out.skipped.push({ row: r + 1, name: name, why: '数据不完整' });
    }
    return out;
  }

  function csvCell(v) {
    var s = v == null ? '' : String(v);
    if (/^[=+\-@\t\r]/.test(s) && !/^-?\d+(\.\d+)?$/.test(s)) s = "'" + s;     // 防止被表格软件当成公式
    return /[",\n\r]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
  }

  /** 导出成 Excel 能直接打开的 CSV（带 BOM）。列名和「从表格粘贴」认得的一致，可以原样导回来。 */
  function toCSV(state, today) {
    var head = ['类别', '名字', '购买日期', '购入金额', '追加花费', '总成本', '状态', '结束日期', '卖出金额',
      '持有天数', '日均成本', '目标日均', '回本日期', '备注'];
    var lines = [head.join(',')];
    state.assets.forEach(function (a) {
      var c = calc(a, today, state.settings);
      lines.push([
        a.cat, a.name, a.buy, a.price.toFixed(2), round2(c.cost - a.price).toFixed(2), c.cost.toFixed(2),
        STATUS_LABEL[a.status], a.end || '', a.status === 'sold' ? (a.sold || 0).toFixed(2) : '',
        c.days, c.shown.toFixed(4), a.goal && a.goal.t === 'daily' ? String(a.goal.v) : '', c.goalDate, a.note || ''
      ].map(csvCell).join(','));
    });
    return '\ufeff' + lines.join('\r\n') + '\r\n';
  }

  /* ------------------------------------------------------------------ 示例数据 */

  /** 第一次打开时「先看看示例」用的假数据，日期都按今天往回推，所以什么时候看都像样。 */
  function demoState(today) {
    var st = emptyState(), t = dayNum(today);
    function d(n) { return dayStr(t - n); }
    var rows = [
      ['旗舰手机', '手机', '📱', 1130, 7999],
      ['轻薄本', '笔记本', '💻', 842, 6499],
      ['降噪耳机', '耳机', '🎧', 655, 1899],
      ['智能手表', '手表', '⌚', 420, 2999],
      ['机械键盘', '外设', '⌨️', 300, 899],
      ['游戏主机', '游戏机', '🎮', 205, 3899],
      ['运动相机', '相机', '📹', 96, 2498],
      ['显示器', '显示器', '🖥️', 31, 2299]
    ];
    rows.forEach(function (r, i) {
      st.assets.push({ id: 'demo' + i, name: r[0], cat: r[1], icon: r[2], buy: d(r[3]), price: r[4],
        extras: [], status: 'active', note: '', ct: i, ut: i });
    });
    st.assets[1].extras.push({ id: 'dx1', name: '扩展坞', date: d(700), amt: 399 });
    st.assets.push({ id: 'demo8', name: '旧平板', cat: '平板', icon: '📱', buy: d(1900), price: 3299, extras: [],
      status: 'sold', end: d(400), sold: 900, note: '', ct: 8, ut: 8 });
    st.assets.push({ id: 'demo9', name: '旧路由器', cat: '网络', icon: '📡', buy: d(2300), price: 399, extras: [],
      status: 'retired', end: d(260), note: '', ct: 9, ut: 9 });
    st.wishes.push({ id: 'demow0', name: '掌机', cat: '掌机', icon: '👾', price: 3299, url: '', note: '等降价', ct: Date.now() - 23 * DAY_MS, ut: 0 });
    st.wishes.push({ id: 'demow1', name: '新款耳机', cat: '耳机', icon: '🎧', price: 1899, url: '', note: '', ct: Date.now() - 5 * DAY_MS, ut: 0 });
    st.demo = true;
    return st;
  }

  return {
    VERSION: VERSION, SCHEMA: SCHEMA, STATUSES: STATUSES, STATUS_LABEL: STATUS_LABEL, SORTS: SORTS, ACCENTS: ACCENTS,
    EDGES: EDGES, CAT_PRESET_N: CAT_PRESET_N, cleanColor: cleanColor, sanitizeCats: sanitizeCats,
    catColor: catColor, catList: catList, upsertCat: upsertCat, renameCat: renameCat, removeCat: removeCat,
    setCatMembers: setCatMembers, autoColorCats: autoColorCats,
    DEFAULT_GOAL: DEFAULT_GOAL,
    dayNum: dayNum, dayStr: dayStr, todayStr: todayStr, addDays: addDays, addYears: addYears, looseDate: looseDate,
    calDiff: calDiff, spanText: spanText,
    round2: round2, fmtNum: fmtNum, moneyParts: moneyParts, fmtMoney: fmtMoney, fmtDaily: fmtDaily, dailyDec: dailyDec,
    fmtDrop: fmtDrop, parseMoney: parseMoney,
    graphemes: graphemes, cleanStr: cleanStr, cleanLine: cleanLine, cleanIcon: cleanIcon, cleanMoney: cleanMoney,
    cleanDate: cleanDate, cleanUrl: cleanUrl, cleanGoal: cleanGoal, cleanFx: cleanFx, newId: newId, validId: validId,
    guessIcon: guessIcon, ICON_GROUPS: ICON_GROUPS,
    sanitizeAsset: sanitizeAsset, sanitizeWish: sanitizeWish, sanitizeSettings: sanitizeSettings,
    sanitizeState: sanitizeState, defaultSettings: defaultSettings, emptyState: emptyState,
    goalOf: goalOf, costSteps: costSteps, costAt: costAt, totalCost: totalCost, thresholdDay: thresholdDay, calc: calc,
    prepare: prepare, totalDailyAt: totalDailyAt, summary: summary, sortAssets: sortAssets, reorderSubset: reorderSubset,
    assetMilestones: assetMilestones, milestones: milestones, milestoneText: milestoneText, nextTotalMark: nextTotalMark,
    exportObj: exportObj, compactObj: compactObj, encodeCode: encodeCode, decodeAny: decodeAny, mergeInto: mergeInto,
    b64uEncode: b64uEncode, b64uDecode: b64uDecode,
    splitTable: splitTable, parseTable: parseTable, toCSV: toCSV, demoState: demoState
  };
});
