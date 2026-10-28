/* ============================================================
   core.js — 常量 / 工具 / 数据模型 / 存储 / 统计
   ============================================================ */
(function (root) {
  'use strict';

  const TL = root.TL || (root.TL = {});

  /* ---------------- 版本 ---------------- */
  TL.VERSION = 1;
  TL.LS_DATA = 'liang-trade-log:v1';
  TL.LS_TOKEN = 'liang-trade-log:token';
  TL.LS_META = 'liang-trade-log:meta';
  TL.LS_SNAP = 'liang-trade-log:snapshots';

  /* ---------------- 品种表 ---------------- */
  TL.SYMBOL_GROUPS = [
    { g: '黑色', items: [['RB', '螺纹钢'], ['HC', '热卷'], ['I', '铁矿石'], ['J', '焦炭'], ['JM', '焦煤'], ['SF', '硅铁'], ['SM', '锰硅'], ['SS', '不锈钢']] },
    { g: '有色', items: [['CU', '铜'], ['AL', '铝'], ['ZN', '锌'], ['PB', '铅'], ['NI', '镍'], ['SN', '锡'], ['AO', '氧化铝']] },
    { g: '能化', items: [['SC', '原油'], ['FU', '燃油'], ['LU', '低硫燃油'], ['BU', '沥青'], ['TA', 'PTA'], ['PF', '短纤'], ['EG', '乙二醇'], ['L', '塑料'], ['PP', '聚丙烯'], ['V', 'PVC'], ['MA', '甲醇'], ['UR', '尿素'], ['SA', '纯碱'], ['FG', '玻璃'], ['EB', '苯乙烯'], ['PG', '液化气'], ['SH', '烧碱'], ['PX', '对二甲苯']] },
    { g: '农产品', items: [['M', '豆粕'], ['Y', '豆油'], ['P', '棕榈油'], ['RM', '菜粕'], ['OI', '菜油'], ['A', '豆一'], ['B', '豆二'], ['C', '玉米'], ['CS', '淀粉'], ['JD', '鸡蛋'], ['LH', '生猪'], ['SR', '白糖'], ['CF', '棉花'], ['CY', '棉纱'], ['AP', '苹果'], ['CJ', '红枣'], ['PK', '花生'], ['RU', '橡胶'], ['NR', '20号胶'], ['SP', '纸浆'], ['LG', '原木']] },
    { g: '贵金属', items: [['AU', '黄金'], ['AG', '白银']] }
  ];

  TL.symbolName = function (code) {
    if (!code) return '';
    for (const g of TL.SYMBOL_GROUPS) {
      for (const it of g.items) if (it[0] === code) return it[1];
    }
    return code;
  };

  TL.symbolLabel = function (code) {
    if (!code) return '';
    const n = TL.symbolName(code);
    return n === code ? code : code + ' ' + n;
  };

  TL.symbolOptions = function (selected) {
    let html = '<option value="">选择品种</option>';
    for (const g of TL.SYMBOL_GROUPS) {
      html += '<optgroup label="' + g.g + '">';
      for (const it of g.items) {
        html += '<option value="' + it[0] + '"' + (it[0] === selected ? ' selected' : '') + '>' +
          it[0] + ' ' + it[1] + '</option>';
      }
      html += '</optgroup>';
    }
    if (selected && !TL.symbolName(selected)) {
      html += '<option value="' + TL.esc(selected) + '" selected>' + TL.esc(selected) + '</option>';
    }
    return html;
  };

  /* ---------------- 工具 ---------------- */
  TL.esc = function (s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  };

  TL.uid = function () {
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  };

  TL.n = function (v, d) {
    const x = parseFloat(v);
    return isFinite(x) ? x : (d === undefined ? 0 : d);
  };

  TL.fmt = function (v, digits) {
    const x = TL.n(v, 0);
    const d = digits === undefined ? 0 : digits;
    return x.toLocaleString('zh-CN', { minimumFractionDigits: d, maximumFractionDigits: d });
  };

  TL.money = function (v) {
    const x = TL.n(v, 0);
    const sign = x > 0 ? '+' : '';
    return sign + x.toLocaleString('zh-CN', { maximumFractionDigits: 0 });
  };

  TL.pad = function (n) { return (n < 10 ? '0' : '') + n; };

  TL.todayStr = function () {
    const d = new Date();
    return d.getFullYear() + '-' + TL.pad(d.getMonth() + 1) + '-' + TL.pad(d.getDate());
  };

  TL.dateStr = function (d) {
    return d.getFullYear() + '-' + TL.pad(d.getMonth() + 1) + '-' + TL.pad(d.getDate());
  };

  TL.parseDate = function (s) {
    const p = String(s || '').split('-');
    return new Date(+p[0], (+p[1] || 1) - 1, +p[2] || 1);
  };

  TL.addDays = function (s, n) {
    const d = TL.parseDate(s);
    d.setDate(d.getDate() + n);
    return TL.dateStr(d);
  };

  TL.weekday = function (s) {
    const w = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'][TL.parseDate(s).getDay()];
    return w;
  };

  TL.isoWeekKey = function (s) {
    const d = TL.parseDate(s);
    const t = new Date(d.getFullYear(), d.getMonth(), d.getDate());
    const day = (t.getDay() + 6) % 7;
    t.setDate(t.getDate() - day + 3);
    const firstThu = new Date(t.getFullYear(), 0, 4);
    const fday = (firstThu.getDay() + 6) % 7;
    firstThu.setDate(firstThu.getDate() - fday + 3);
    const week = 1 + Math.round((t - firstThu) / 604800000);
    return t.getFullYear() + '-W' + TL.pad(week);
  };

  TL.monthKey = function (s) { return String(s || '').slice(0, 7); };

  TL.nowStamp = function () {
    const d = new Date();
    return TL.dateStr(d) + ' ' + TL.pad(d.getHours()) + ':' + TL.pad(d.getMinutes());
  };

  /* ---------------- 默认数据结构 ---------------- */
  TL.defaultSettings = function () {
    return {
      totalCapital: 400000,
      maxSingleLoss: 10000,
      maxMarginPct: 60,
      maxPositions: 2,
      watchlistSize: 2,
      watchlistMax: 3,
      noNewAfter: '14:30',
      pauseAfterStreak: 3,
      goodWinRate: 50,
      goodProfitFactor: 2,
      autoUpload: false,
      lockCode: '',
      owner: 'liangguoqi-0217',
      repo: 'liang-trade-log-data',
      branch: 'main',
      path: 'journal.json'
    };
  };

  TL.defaultDay = function (date) {
    return {
      date: date,
      evening: {
        indexTrend: '',
        indexNote: '',
        theme: { mainSector: '', strongest: '', weakest: '', turning: '' },
        candidates: [],
        watch: [],
        orders: [],
        positions: [],
        done: {}
      },
      intraday: {
        checks: { '10:00': {}, '13:30': {}, '14:15': {} },
        violations: {},
        note: ''
      },
      review: {
        strongestRun: '', waitAppeared: '', waitCaught: '', waitReason: '',
        noChaseFell: '', align: '', result: '', rotationNote: '', notes: ''
      },
      trades: [],
      updatedAt: ''
    };
  };

  TL.defaultDB = function () {
    return {
      version: TL.VERSION,
      createdAt: TL.nowStamp(),
      updatedAt: TL.nowStamp(),
      settings: TL.defaultSettings(),
      days: {},
      weeks: {},
      months: {}
    };
  };

  /* ---------------- 存储 ---------------- */
  TL.DB = null;
  TL.dirty = false;

  TL.load = function () {
    try {
      const raw = localStorage.getItem(TL.LS_DATA);
      if (!raw) { TL.DB = TL.defaultDB(); return TL.DB; }
      const obj = JSON.parse(raw);
      TL.DB = TL.migrate(obj);
    } catch (e) {
      console.error('读取本地数据失败', e);
      TL.DB = TL.defaultDB();
    }
    return TL.DB;
  };

  TL.migrate = function (obj) {
    const base = TL.defaultDB();
    if (!obj || typeof obj !== 'object') return base;
    obj.version = TL.VERSION;
    obj.settings = Object.assign({}, base.settings, obj.settings || {});
    obj.days = obj.days || {};
    obj.weeks = obj.weeks || {};
    obj.months = obj.months || {};
    for (const k of Object.keys(obj.days)) {
      const d = obj.days[k];
      const def = TL.defaultDay(k);
      d.date = k;
      d.evening = Object.assign(def.evening, d.evening || {});
      d.evening.theme = Object.assign(def.evening.theme, (d.evening && d.evening.theme) || {});
      d.evening.candidates = d.evening.candidates || [];
      d.evening.watch = d.evening.watch || [];
      d.evening.orders = d.evening.orders || [];
      d.evening.positions = d.evening.positions || [];
      d.evening.done = d.evening.done || {};
      d.intraday = Object.assign(def.intraday, d.intraday || {});
      d.intraday.checks = Object.assign({ '10:00': {}, '13:30': {}, '14:15': {} }, d.intraday.checks || {});
      d.intraday.violations = d.intraday.violations || {};
      d.review = Object.assign(def.review, d.review || {});
      d.trades = d.trades || [];
    }
    return obj;
  };

  /* 判断某一天是否完全为空（用于自动清理，避免统计天数虚高） */
  TL.isEmptyDay = function (d) {
    const e = d.evening || {};
    const themeEmpty = !Object.keys(e.theme || {}).some(function (k) { return e.theme[k]; });
    const hasEvening = !!(e.indexTrend || e.indexNote ||
      !themeEmpty ||
      (e.candidates || []).length || (e.watch || []).length ||
      (e.orders || []).length || (e.positions || []).length ||
      Object.keys(e.done || {}).length);
    if (hasEvening) return false;
    if ((d.trades || []).length) return false;
    const it = d.intraday || {};
    const checks = it.checks || {};
    const hasChecks = Object.keys(checks).some(function (k) { return Object.keys(checks[k] || {}).length > 0; });
    if (hasChecks) return false;
    if (Object.keys(it.violations || {}).some(function (k) { return it.violations[k]; })) return false;
    if (it.note) return false;
    const r = d.review || {};
    if (Object.keys(r).some(function (k) { return r[k]; })) return false;
    return true;
  };

  TL.prune = function () {
    Object.keys(TL.DB.days).forEach(function (k) {
      if (TL.isEmptyDay(TL.DB.days[k])) delete TL.DB.days[k];
    });
  };

  TL.save = function (silent) {
    TL.DB.updatedAt = TL.nowStamp();
    TL.prune();
    try {
      localStorage.setItem(TL.LS_DATA, JSON.stringify(TL.DB));
      TL.markDirty(true);
    } catch (e) {
      console.error('保存失败', e);
      TL.toast('保存失败：浏览器存储空间不足或被禁用');
      return;
    }
    if (!silent && TL.onSaved) TL.onSaved();
  };

  TL.markDirty = function (on) {
    TL.dirty = !!on;
    const dot = document.getElementById('dirtyDot');
    if (dot) dot.classList.toggle('on', !!on);
  };

  TL.getToken = function () { return localStorage.getItem(TL.LS_TOKEN) || ''; };
  TL.setToken = function (t) {
    if (t) localStorage.setItem(TL.LS_TOKEN, t);
    else localStorage.removeItem(TL.LS_TOKEN);
  };

  TL.getMeta = function () {
    try { return JSON.parse(localStorage.getItem(TL.LS_META) || '{}'); } catch (e) { return {}; }
  };
  TL.setMeta = function (m) {
    localStorage.setItem(TL.LS_META, JSON.stringify(m));
  };

  /* 本地快照（上传前留底） */
  TL.pushSnapshot = function (label) {
    let list = [];
    try { list = JSON.parse(localStorage.getItem(TL.LS_SNAP) || '[]'); } catch (e) { list = []; }
    list.unshift({ at: TL.nowStamp(), label: label || '手动快照', data: JSON.stringify(TL.DB) });
    list = list.slice(0, 8);
    try { localStorage.setItem(TL.LS_SNAP, JSON.stringify(list)); } catch (e) { /* 空间不足忽略 */ }
  };

  TL.getSnapshots = function () {
    try { return JSON.parse(localStorage.getItem(TL.LS_SNAP) || '[]'); } catch (e) { return []; }
  };

  /* ---------------- 日期数据访问 ---------------- */
  TL.day = function (date, create) {
    if (!date) date = TL.todayStr();
    if (!TL.DB.days[date]) {
      if (!create) return null;
      TL.DB.days[date] = TL.defaultDay(date);
    }
    return TL.DB.days[date];
  };

  TL.ensureDay = function (date) { return TL.day(date, true); };

  TL.dayCount = function () { return Object.keys(TL.DB.days).length; };

  /* ---------------- 判定逻辑 ---------------- */
  /* 三条件：日线多头排列 + 偏离均线<2% + 15分钟粘合 */
  TL.judgeCandidate = function (c) {
    const bull = !!c.dailyBull;
    const near = c.deviation !== '' && c.deviation != null && Math.abs(TL.n(c.deviation, 99)) < 2;
    const conv = !!c.m15;
    return { bull: bull, near: near, conv: conv, keep: bull && near && conv };
  };

  /* ---------------- 统计 ---------------- */
  TL.allTrades = function () {
    const out = [];
    for (const date of Object.keys(TL.DB.days).sort()) {
      const d = TL.DB.days[date];
      (d.trades || []).forEach(function (t) {
        if (t.pnl === '' || t.pnl == null) return;
        out.push(Object.assign({ date: date }, t));
      });
    }
    return out;
  };

  TL.tradesBetween = function (from, to) {
    return TL.allTrades().filter(function (t) { return t.date >= from && t.date <= to; });
  };

  TL.computeStats = function (trades) {
    const list = (trades || []).filter(function (t) { return t.pnl !== '' && t.pnl != null; });
    const pnls = list.map(function (t) { return TL.n(t.pnl, 0); });
    const wins = pnls.filter(function (x) { return x > 0; });
    const losses = pnls.filter(function (x) { return x < 0; });
    const sumWin = wins.reduce(function (a, b) { return a + b; }, 0);
    const sumLoss = Math.abs(losses.reduce(function (a, b) { return a + b; }, 0));
    const total = pnls.reduce(function (a, b) { return a + b; }, 0);

    const avgWin = wins.length ? sumWin / wins.length : 0;
    const avgLoss = losses.length ? sumLoss / losses.length : 0;
    const plRatio = avgLoss > 0 ? avgWin / avgLoss : (avgWin > 0 ? Infinity : 0);
    const profitFactor = sumLoss > 0 ? sumWin / sumLoss : (sumWin > 0 ? Infinity : 0);
    const winRate = list.length ? (wins.length / list.length) * 100 : 0;
    const maxLoss = losses.length ? Math.min.apply(null, losses) : 0;

    /* 资金曲线与最大回撤 */
    let eq = 0, peak = 0, mdd = 0;
    const curve = [];
    for (const x of pnls) {
      eq += x;
      if (eq > peak) peak = eq;
      const dd = peak - eq;
      if (dd > mdd) mdd = dd;
      curve.push(eq);
    }

    /* 当前连亏 / 连盈 */
    let streakLoss = 0, streakWin = 0;
    for (let i = pnls.length - 1; i >= 0; i--) {
      if (pnls[i] < 0) { if (streakWin) break; streakLoss++; }
      else if (pnls[i] > 0) { if (streakLoss) break; streakWin++; }
      else break;
    }

    return {
      count: list.length,
      wins: wins.length,
      losses: losses.length,
      winRate: winRate,
      avgWin: avgWin,
      avgLoss: avgLoss,
      plRatio: plRatio,
      profitFactor: profitFactor,
      total: total,
      maxLoss: maxLoss,
      maxDrawdown: mdd,
      streakLoss: streakLoss,
      streakWin: streakWin,
      curve: curve
    };
  };

  TL.groupStats = function (trades, keyFn) {
    const map = {};
    for (const t of trades) {
      const k = keyFn(t);
      if (k === null || k === undefined || k === '') continue;
      (map[k] = map[k] || []).push(t);
    }
    const out = {};
    for (const k of Object.keys(map)) out[k] = TL.computeStats(map[k]);
    return out;
  };

  /* 按月聚合 */
  TL.monthlyStats = function () {
    const trades = TL.allTrades();
    const map = {};
    for (const t of trades) {
      const k = TL.monthKey(t.date);
      (map[k] = map[k] || []).push(t);
    }
    return map;
  };

  TL.formatRatio = function (v) {
    if (!isFinite(v)) return '∞';
    return v.toFixed(2);
  };

})(window);
