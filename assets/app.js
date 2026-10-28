/* ============================================================
   app.js — 事件绑定 / 启动
   ============================================================ */
(function (root) {
  'use strict';
  const TL = root.TL;

  /* ---------------- 路径读写 ---------------- */
  function weekRec() {
    const wk = TL.isoWeekKey(TL.UI.date);
    return TL.DB.weeks[wk] || (TL.DB.weeks[wk] = {});
  }

  function monthRec() {
    const mk = TL.monthKey(TL.UI.date);
    return TL.DB.months[mk] || (TL.DB.months[mk] = {});
  }

  function rootFor(path) {
    if (path.indexOf('settings.') === 0) return TL.DB.settings;
    if (path.indexOf('week.') === 0) return weekRec();
    if (path.indexOf('month.') === 0) return monthRec();
    return TL.ensureDay(TL.UI.date);
  }

  function setPath(path, val) {
    const root = rootFor(path);
    const parts = path.split('.');
    let o = root;
    for (let i = 0; i < parts.length - 1; i++) {
      if (!o[parts[i]] || typeof o[parts[i]] !== 'object') o[parts[i]] = {};
      o = o[parts[i]];
    }
    o[parts[parts.length - 1]] = val;
  }

  function readValue(el) {
    if (el.type === 'checkbox') return el.checked;
    if (el.type === 'number') {
      const v = String(el.value).trim();
      if (v === '') return '';
      const n = Number(v);
      return isFinite(n) ? n : '';
    }
    return el.value;
  }

  /* ---------------- 局部刷新 ---------------- */
  function refreshCandidates() {
    const day = TL.day(TL.UI.date, false);
    if (!day) return;
    day.evening.candidates.forEach(function (c, i) {
      const el = document.getElementById('judge_' + i);
      if (el) {
        const j = TL.judgeCandidate(c);
        el.className = 'tag ' + (j.keep ? 'ok' : 'no');
        el.textContent = j.keep ? '保留' : '剔除';
      }
    });
    const wc = document.getElementById('watchCard');
    if (wc) wc.innerHTML = TL.watchCardHtml(day.evening, TL.DB.settings);
  }

  function refreshPositions() {
    const day = TL.day(TL.UI.date, false);
    if (!day) return;
    day.evening.positions.forEach(function (p, i) {
      const td = document.querySelector('[data-pos-act="' + i + '"]');
      if (!td) return;
      td.innerHTML = p.exitHit ? '<span class="tag no">次日平仓</span>'
        : (p.moveStop ? '<span class="tag accent">止损上移到成本价</span>' : '<span class="tag">持有观察</span>');
    });
  }

  /* ---------------- 输入处理 ---------------- */
  let saveTimer = null;
  function scheduleSave() {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(function () { TL.save(true); }, 350);
  }

  function onField(el) {
    /* 完成度勾选 */
    if (el.dataset.done) {
      const day = TL.ensureDay(TL.UI.date);
      day.evening.done[el.dataset.done] = el.checked;
      scheduleSave();
      return;
    }

    const val = readValue(el);

    if (el.dataset.arr) {
      const day = TL.ensureDay(TL.UI.date);
      const arrPath = el.dataset.arr;
      let arr;
      if (arrPath === 'trades') arr = day.trades;
      else arr = arrPath.split('.').reduce(function (o, k) { return o && o[k]; }, day);
      const idx = +el.dataset.idx;
      if (!arr || !arr[idx]) return;
      arr[idx][el.dataset.field] = val;
      scheduleSave();
      if (arrPath === 'evening.candidates') refreshCandidates();
      if (arrPath === 'evening.positions') refreshPositions();
      if (arrPath === 'trades') {
        clearTimeout(window.__tradeKpiTimer);
        window.__tradeKpiTimer = setTimeout(function () {
          const box = document.getElementById('tradeKpis');
          const dd = TL.day(TL.UI.date, false);
          if (box && dd) box.innerHTML = TL.tradeKpisHtml(dd.trades);
        }, 350);
      }
      return;
    }

    if (el.dataset.path) {
      setPath(el.dataset.path, val);
      scheduleSave();
      if (el.dataset.path.indexOf('week.') === 0 || el.dataset.path.indexOf('month.') === 0) {
        clearTimeout(window.__reRenderTimer);
        window.__reRenderTimer = setTimeout(function () {
          if (TL.UI.tab === 'weekly') TL.renderWeekly();
          if (TL.UI.tab === 'monthly') TL.renderMonthly();
        }, 600);
      }
    }
  }

  document.addEventListener('input', function (ev) {
    const el = ev.target;
    if (el.matches('[data-path],[data-arr],[data-done]')) onField(el);
  });

  document.addEventListener('change', function (ev) {
    const el = ev.target;
    if (el.matches('[data-path],[data-arr],[data-done]')) {
      onField(el);
      /* 设置页改动后刷新同步状态 */
      if (el.dataset.path && el.dataset.path.indexOf('settings.') === 0) {
        TL.updateSyncUI();
      }
    }
  });

  /* ---------------- 点击处理 ---------------- */
  document.addEventListener('click', function (ev) {
    /* 顶层页签 */
    const tabBtn = ev.target.closest('#mainTabs button');
    if (tabBtn) {
      TL.UI.tab = tabBtn.dataset.tab;
      TL.render();
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }

    /* 子页签 */
    const subBtn = ev.target.closest('#subTabs button');
    if (subBtn) {
      TL.UI.sub = subBtn.dataset.sub;
      TL.renderToday();
      return;
    }

    /* 三态/多态按钮组 */
    const segBtn = ev.target.closest('.seg button');
    if (segBtn) {
      const seg = segBtn.parentElement;
      const path = seg.dataset.seg;
      setPath(path, segBtn.dataset.val);
      seg.querySelectorAll('button').forEach(function (b) { b.classList.toggle('active', b === segBtn); });
      scheduleSave();
      return;
    }

    /* 动作 */
    const actEl = ev.target.closest('[data-act]');
    if (actEl) {
      handleAct(actEl.dataset.act, actEl, ev);
    }
  });

  async function handleAct(act, el, ev) {
    const day = function () { return TL.ensureDay(TL.UI.date); };
    const d = el.dataset;

    switch (act) {
      /* ---- 当晚清单 ---- */
      case 'add-cand':
        day().evening.candidates.push({ id: TL.uid(), symbol: '', dailyBull: false, deviation: '', m15: false, note: '' });
        TL.save(true); TL.renderToday(); break;

      case 'del-cand':
        day().evening.candidates.splice(+d.idx, 1);
        TL.save(true); TL.renderToday(); break;

      case 'toggle-watch': {
        const e = day().evening;
        const i = e.watch.indexOf(d.sym);
        if (i >= 0) e.watch.splice(i, 1);
        else {
          const lim = TL.DB.settings.watchlistMax || 3;
          if (e.watch.length >= lim) {
            TL.toast('最多 ' + lim + ' 个品种。先去掉一个再加。');
            return;
          }
          e.watch.push(d.sym);
        }
        TL.save(true); TL.renderToday(); break;
      }

      case 'add-order':
        day().evening.orders.push({ id: TL.uid(), symbol: '', direction: 'long', trigger: '', stop: '', lots: '', risk: '' });
        TL.save(true); TL.renderToday(); break;

      case 'del-order':
        day().evening.orders.splice(+d.idx, 1);
        TL.save(true); TL.renderToday(); break;

      case 'add-pos':
        day().evening.positions.push({ id: TL.uid(), symbol: '', avgPrice: '', lots: '', stop: '', exitHit: false, moveStop: false });
        TL.save(true); TL.renderToday(); break;

      case 'del-pos':
        day().evening.positions.splice(+d.idx, 1);
        TL.save(true); TL.renderToday(); break;

      /* ---- 盘中打卡 ---- */
      case 'check': {
        const it = day().intraday;
        const tm = d.time;
        if (!it.checks[tm]) it.checks[tm] = {};
        const cur = it.checks[tm][d.sym] || {};
        if (cur.state === d.state) delete cur.state;
        else cur.state = d.state;
        it.checks[tm][d.sym] = cur;
        TL.save(true); TL.renderToday(); break;
      }

      case 'toggle-viol': {
        const v = day().intraday.violations;
        v[d.key] = !v[d.key];
        TL.save(true); TL.renderToday(); break;
      }

      /* ---- 成交 ---- */
      case 'add-trade':
        day().trades.push({ id: TL.uid(), symbol: '', direction: 'long', entry: '', exit: '', lots: '', pnl: '', aligned: '', signalOk: '', note: '' });
        TL.save(true); TL.renderToday(); break;

      case 'del-trade':
        day().trades.splice(+d.idx, 1);
        TL.save(true); TL.renderToday(); break;

      case 'goto-trades':
        TL.UI.sub = 'trades';
        TL.renderToday(); break;

      /* ---- 周 / 月 ---- */
      case 'week-prev':
        TL.UI.date = TL.addDays(TL.UI.date, -7);
        TL.renderWeekly(); break;

      case 'week-next':
        TL.UI.date = TL.addDays(TL.UI.date, 7);
        TL.renderWeekly(); break;

      /* ---- 同步 ---- */
      case 'push': TL.push(false); break;
      case 'pull': TL.pull(false); break;
      case 'test-conn': TL.testConn(); break;

      case 'save-token': {
        const inp = document.getElementById('tokenInput');
        const v = (inp.value || '').trim();
        if (!v) { TL.toast('请先粘贴 Token'); return; }
        TL.setToken(v);
        inp.value = '';
        TL.updateSyncUI();
        TL.renderSettings();
        TL.toast('Token 已保存到本机');
        break;
      }

      case 'clear-token': {
        const ok = await TL.confirm('清除 Token？', '清除后本机无法再上传/拉取，数据仍保留在本机浏览器。', '清除', true);
        if (ok) { TL.setToken(''); TL.updateSyncUI(); TL.renderSettings(); TL.toast('已清除 Token'); }
        break;
      }

      /* ---- 导入导出 ---- */
      case 'export-json': TL.exportJSON(); break;
      case 'import-json': TL.importJSON(); break;
      case 'export-trades': TL.exportTradesCSV(); break;
      case 'export-rotation': TL.exportRotationCSV(); break;

      /* ---- 快照 ---- */
      case 'snap-now':
        TL.pushSnapshot('手动快照 ' + TL.dayCount() + ' 天');
        TL.renderSettings();
        TL.toast('已创建本地快照');
        break;

      case 'restore-snap': {
        const list = TL.getSnapshots();
        const s = list[+d.idx];
        if (!s) return;
        const ok = await TL.confirm('恢复这个快照？',
          '快照时间：' + TL.esc(s.at) + '<br>说明：' + TL.esc(s.label) + '<br><br>当前数据会被覆盖（会先自动留一份快照）。', '恢复');
        if (!ok) return;
        try {
          TL.pushSnapshot('恢复快照前 ' + TL.dayCount() + ' 天');
          TL.DB = TL.migrate(JSON.parse(s.data));
          TL.save(true);
          TL.markDirty(true);
          TL.render();
          TL.toast('已恢复快照');
        } catch (e) {
          TL.alert('恢复失败', '这个快照数据损坏了。');
        }
        break;
      }

      /* ---- 口令 ---- */
      case 'save-lock': {
        const inp = document.getElementById('lockCodeInput');
        const v = (inp.value || '').trim();
        TL.DB.settings.lockCode = v;
        TL.save(true);
        TL.renderSettings();
        TL.toast(v ? '口令已设置' : '口令已取消');
        break;
      }

      /* ---- 危险 ---- */
      case 'wipe': {
        const ok = await TL.confirm('清空本机数据？',
          '会删除本机浏览器里的 <b>' + TL.dayCount() + '</b> 天记录。<br>GitHub 上的数据不会动，之后可以点「拉取」恢复。<br><br>' +
          '<span style="color:var(--up)">建议先点「导出 JSON」备份。</span>', '确认清空', true);
        if (!ok) return;
        const ok2 = await TL.confirm('再确认一次', '这是不可撤销的本机操作。', '我确定清空', true);
        if (!ok2) return;
        localStorage.removeItem(TL.LS_DATA);
        localStorage.removeItem(TL.LS_META);
        location.reload();
        break;
      }
    }
  }

  /* ---------------- 日期栏 ---------------- */
  function bindDatebar() {
    document.getElementById('btnPrevDay').onclick = function () {
      TL.UI.date = TL.addDays(TL.UI.date, -1);
      TL.renderToday();
    };
    document.getElementById('btnNextDay').onclick = function () {
      TL.UI.date = TL.addDays(TL.UI.date, 1);
      TL.renderToday();
    };
    document.getElementById('btnToday').onclick = function () {
      TL.UI.date = TL.todayStr();
      TL.renderToday();
    };
    document.getElementById('datePicker').onchange = function (e) {
      if (e.target.value) { TL.UI.date = e.target.value; TL.renderToday(); }
    };
    document.getElementById('btnPrint').onclick = function () { TL.printToday(); };
    document.getElementById('btnQuickPush').onclick = function () { TL.push(false); };
    document.getElementById('btnQuickPull').onclick = function () { TL.pull(false); };
  }

  /* ---------------- 快捷键 ---------------- */
  function bindKeys() {
    document.addEventListener('keydown', function (e) {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
        e.preventDefault();
        TL.save(true);
        TL.toast('已保存到本机');
      }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'p') {
        /* 让浏览器自己打印，但先构建一页纸 */
        if (document.activeElement && document.activeElement.tagName !== 'INPUT' && document.activeElement.tagName !== 'TEXTAREA') {
          e.preventDefault();
          TL.printToday();
        }
      }
    });
  }

  /* ---------------- 口令锁 ---------------- */
  function bootLock() {
    const code = (TL.DB.settings.lockCode || '').trim();
    const lock = document.getElementById('lockScreen');
    if (!code || sessionStorage.getItem('tl-unlocked') === '1') {
      lock.hidden = true;
      return true;
    }
    lock.hidden = false;
    const input = document.getElementById('lockInput');
    const err = document.getElementById('lockErr');
    const submit = function () {
      if (input.value === code) {
        sessionStorage.setItem('tl-unlocked', '1');
        lock.hidden = true;
        err.textContent = '';
        start();
      } else {
        err.textContent = '口令不对';
        input.select();
      }
    };
    document.getElementById('lockBtn').onclick = submit;
    input.onkeydown = function (e) { if (e.key === 'Enter') submit(); };
    setTimeout(function () { input.focus(); }, 60);
    return false;
  }

  /* ---------------- 启动 ---------------- */
  let started = false;
  function start() {
    if (started) return;
    started = true;
    bindDatebar();
    bindKeys();
    TL.render();
    TL.updateSyncUI();
  }

  function init() {
    TL.load();

    /* 支持 ?date=2026-10-28 */
    try {
      const q = new URLSearchParams(location.search).get('date');
      if (q && /^\d{4}-\d{2}-\d{2}$/.test(q)) TL.UI.date = q;
    } catch (e) { /* 忽略 */ }

    /* 软提示：今天还没记当晚清单 */
    if (bootLock()) start();

    TL.onSaved = function () {
      if (!TL.DB.settings.autoUpload) return;
      if (!TL.getToken()) return;
      clearTimeout(window.__autoPushTimer);
      window.__autoPushTimer = setTimeout(function () { TL.push(true); }, 20000);
    };

    window.addEventListener('beforeunload', function (e) {
      if (TL.dirty && TL.getToken()) {
        e.preventDefault();
        e.returnValue = '';
      }
    });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();

})(window);
