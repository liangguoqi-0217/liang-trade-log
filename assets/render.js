/* ============================================================
   render.js — 所有视图渲染
   ============================================================ */
(function (root) {
  'use strict';
  const TL = root.TL;
  TL.UI = TL.UI || { tab: 'today', sub: 'evening', date: TL.todayStr() };

  const H = TL.esc;

  /* ---------------- 小工具 ---------------- */
  function seg(path, opts, cur) {
    return '<div class="seg" data-seg="' + path + '">' +
      opts.map(function (o) {
        return '<button type="button" data-val="' + H(o.v) + '" class="' + (cur === o.v ? 'active' : '') + '">' + H(o.t) + '</button>';
      }).join('') + '</div>';
  }

  function inp(path, val, placeholder, cls, type) {
    return '<input type="' + (type || 'text') + '" data-path="' + path + '" value="' + H(val) + '" placeholder="' + H(placeholder || '') + '"' + (cls ? ' class="' + cls + '"' : '') + '>';
  }

  function ta(path, val, placeholder, rows) {
    return '<textarea data-path="' + path + '" rows="' + (rows || 2) + '" placeholder="' + H(placeholder || '') + '">' + H(val) + '</textarea>';
  }

  function pick(arr, v) {
    return '<option value="' + H(v) + '"' + (String(arr.map(function (x) { return x.v; }).indexOf(String(v))) >= 0 ? ' selected' : '') + '>' + H(v) + '</option>';
  }

  function sel(path, options, cur) {
    return '<select data-path="' + path + '">' + options.map(function (o) {
      const v = typeof o === 'string' ? o : o.v;
      const t = typeof o === 'string' ? o : (o.t || o.v);
      return '<option value="' + H(v) + '"' + (String(cur) === String(v) ? ' selected' : '') + '>' + H(t) + '</option>';
    }).join('') + '</select>';
  }

  function numCell(label, arrPath, idx, field, val, step) {
    return '<td class="num" data-label="' + H(label) + '">' +
      '<input type="number" step="' + (step || '1') + '" data-arr="' + arrPath + '" data-idx="' + idx + '" data-field="' + field + '" value="' + H(val) + '">' +
      '</td>';
  }

  function checkCell(label, arrPath, idx, field, val) {
    return '<td class="center" data-label="' + H(label) + '">' +
      '<input type="checkbox" data-arr="' + arrPath + '" data-idx="' + idx + '" data-field="' + field + '"' + (val ? ' checked' : '') + '>' +
      '</td>';
  }

  /* ---------------- 主渲染 ---------------- */
  TL.render = function () {
    const tab = TL.UI.tab;
    document.querySelectorAll('#mainTabs button').forEach(function (b) {
      b.classList.toggle('active', b.dataset.tab === tab);
    });
    document.querySelectorAll('.view').forEach(function (v) {
      v.classList.toggle('active', v.id === 'view-' + tab);
    });

    if (tab === 'today') TL.renderToday();
    else if (tab === 'rotation') TL.renderRotation();
    else if (tab === 'stats') TL.renderStats();
    else if (tab === 'weekly') TL.renderWeekly();
    else if (tab === 'monthly') TL.renderMonthly();
    else if (tab === 'settings') TL.renderSettings();

    TL.updateSyncUI();
    const fm = document.getElementById('footMeta');
    if (fm) fm.textContent = '共 ' + TL.dayCount() + ' 个交易日 · 数据更新于 ' + (TL.DB.updatedAt || '—');
  };

  /* ============================================================
     今日视图
     ============================================================ */
  TL.renderToday = function () {
    const dp = document.getElementById('datePicker');
    if (dp) dp.value = TL.UI.date;
    document.querySelectorAll('#subTabs button').forEach(function (b) {
      b.classList.toggle('active', b.dataset.sub === TL.UI.sub);
    });

    const hint = document.getElementById('dayHint');
    const day = TL.day(TL.UI.date, false);
    if (hint) {
      const w = TL.weekday(TL.UI.date);
      const isToday = TL.UI.date === TL.todayStr();
      hint.innerHTML = H(w) + (isToday ? ' · 今天' : '') +
        (day ? ' · <span class="tag accent">已记录</span>' : ' · <span class="tag">未记录</span>');
    }

    const box = document.getElementById('todayBody');
    if (TL.UI.sub === 'evening') box.innerHTML = viewEvening();
    else if (TL.UI.sub === 'intraday') box.innerHTML = viewIntraday();
    else if (TL.UI.sub === 'review') box.innerHTML = viewReview();
    else box.innerHTML = viewTrades();
  };

  /* ---------------- 观察清单卡片（独立函数，便于局部刷新） ---------------- */
  function watchCardHtml(e, st) {
    const keepList = e.candidates.filter(function (c) { return TL.judgeCandidate(c).keep && c.symbol; });
    const limit = st.watchlistMax || 3;
    const target = st.watchlistSize || 2;

    let h = '<div class="card"><div class="card-hd"><h3><span class="idx">4</span>确定次日观察清单</h3>' +
      '<span class="tip">只选 ' + target + '–' + limit + ' 个（小资金 ' + target + ' 个）· 优先主线板块 + 日线缓坡 30–60 度 + 靠近均线</span>' +
      '<span class="right"><span class="tag ' + (e.watch.length > limit ? 'warn' : 'accent') + '" id="watchCount">已选 ' + e.watch.length + ' / ' + limit + '</span>' +
      (e.done.c4 ? '<span class="tag ok">已完成</span>' : '') + '</span></div>';

    if (!keepList.length) {
      h += '<div class="empty">没有「保留」的品种。先在上一步补齐三条标准，或今天不做。</div>';
    } else {
      h += '<div class="chips" id="watchChips">';
      keepList.forEach(function (c) {
        const on = e.watch.indexOf(c.symbol) >= 0;
        h += '<span class="chip ' + (on ? 'on' : '') + '" data-act="toggle-watch" data-sym="' + H(c.symbol) + '">' +
          (on ? '✓ ' : '') + H(TL.symbolLabel(c.symbol)) + '</span>';
      });
      h += '</div>';
    }
    if (e.watch.length > limit) {
      h += '<div class="note warn" style="margin-top:10px;margin-bottom:0">超出上限：当晚只留 ' + limit + ' 个，多选等于没有重点。</div>';
    }
    h += '<div style="margin-top:10px"><label style="display:flex;align-items:center;gap:6px;font-size:12px;color:var(--muted)"><input type="checkbox" data-done="c4"' + (e.done.c4 ? ' checked' : '') + '>已确定清单</label></div></div>';
    return h;
  }
  TL.watchCardHtml = watchCardHtml;

  /* ---------------- 一、当晚清单 ---------------- */
  function viewEvening() {
    const day = TL.ensureDay(TL.UI.date);
    const e = day.evening;
    const st = TL.DB.settings;

    /* 1 指数状态 */
    let h = '<div class="card"><div class="card-hd"><h3><span class="idx">1</span>看文华指数状态</h3>' +
      '<span class="tip">MA20&gt;MA40&gt;MA60 = 多头 · MA60&gt;MA40&gt;MA20 = 空头 · 其余 = 震荡</span>' +
      '<span class="right">' + (e.done.c1 ? '<span class="tag ok">已完成</span>' : '') + '</span></div>' +
      '<div style="display:flex;gap:14px;align-items:center;flex-wrap:wrap">' +
      seg('evening.indexTrend', [{ v: '多头', t: '多头' }, { v: '空头', t: '空头' }, { v: '震荡', t: '震荡' }], e.indexTrend) +
      '<div style="flex:1;min-width:200px;max-width:380px">' + inp('evening.indexNote', e.indexNote, '备注：如「20日线上方，40/60走平」') + '</div>' +
      '<label style="display:flex;align-items:center;gap:6px;font-size:12px;color:var(--muted)"><input type="checkbox" data-done="c1"' + (e.done.c1 ? ' checked' : '') + '>已核对</label>' +
      '</div></div>';

    /* 2 日报主线 */
    const t = e.theme;
    h += '<div class="card"><div class="card-hd"><h3><span class="idx">2</span>抄日报主线</h3>' +
      '<span class="tip">只抄名字，不抄理由</span>' +
      '<span class="right">' + (e.done.c2 ? '<span class="tag ok">已完成</span>' : '') + '</span></div>' +
      '<div class="grid c4">' +
      '<div class="field"><label>主线板块</label>' + inp('evening.theme.mainSector', t.mainSector, '如 黑色系') + '</div>' +
      '<div class="field"><label>最强品种</label>' + inp('evening.theme.strongest', t.strongest, '如 铁矿') + '</div>' +
      '<div class="field"><label>最弱品种</label>' + inp('evening.theme.weakest', t.weakest, '如 玻璃') + '</div>' +
      '<div class="field"><label>由弱转强</label>' + inp('evening.theme.turning', t.turning, '如 纯碱') + '</div>' +
      '</div>' +
      '<div style="margin-top:10px;display:flex;align-items:center;gap:10px">' +
      '<label style="display:flex;align-items:center;gap:6px;font-size:12px;color:var(--muted)"><input type="checkbox" data-done="c2"' + (e.done.c2 ? ' checked' : '') + '>已抄录</label>' +
      '</div></div>';

    /* 3 品种筛选 */
    h += '<div class="card"><div class="card-hd"><h3><span class="idx">3</span>用自己系统筛品种</h3>' +
      '<span class="tip">① 日线多头排列 ② 偏离 5/20 日均线 &lt; 2% ③ 15 分钟粘合或即将粘合</span>' +
      '<span class="right"><button class="btn sm" data-act="add-cand">+ 添加品种</button>' +
      (e.done.c3 ? '<span class="tag ok">已完成</span>' : '') + '</span></div>';

    if (!e.candidates.length) {
      h += '<div class="empty">还没有品种。先点右上角「+ 添加品种」，把老师提到的品种逐个过一遍三条标准。</div>';
    } else {
      h += '<div class="tbl-wrap"><table class="mob"><thead><tr>' +
        '<th class="center" style="width:36px">#</th><th style="width:170px">品种</th>' +
        '<th class="center" style="width:110px">日线多头</th><th class="num" style="width:110px">偏离均线 %</th>' +
        '<th class="center" style="width:110px">15 分钟粘合</th><th class="center" style="width:80px">判定</th>' +
        '<th>备注</th><th class="center" style="width:56px">操作</th></tr></thead><tbody>';
      e.candidates.forEach(function (c, i) {
        const j = TL.judgeCandidate(c);
        h += '<tr>' +
          '<td class="center" data-label="#">' + (i + 1) + '</td>' +
          '<td data-label="品种"><select data-arr="evening.candidates" data-idx="' + i + '" data-field="symbol">' + TL.symbolOptions(c.symbol) + '</select></td>' +
          checkCell('日线多头', 'evening.candidates', i, 'dailyBull', c.dailyBull) +
          '<td class="num" data-label="偏离均线 %"><input type="number" step="0.1" data-arr="evening.candidates" data-idx="' + i + '" data-field="deviation" value="' + H(c.deviation) + '" placeholder="0.0"></td>' +
          checkCell('15分钟粘合', 'evening.candidates', i, 'm15', c.m15) +
          '<td class="center" data-label="判定"><span class="tag ' + (j.keep ? 'ok' : 'no') + '" id="judge_' + i + '">' + (j.keep ? '保留' : '剔除') + '</span></td>' +
          '<td data-label="备注"><input data-arr="evening.candidates" data-idx="' + i + '" data-field="note" value="' + H(c.note) + '" placeholder="如：刚突破／离均线远"></td>' +
          '<td class="center"><button class="btn sm ghost danger" data-act="del-cand" data-idx="' + i + '">删</button></td>' +
          '</tr>';
      });
      h += '</tbody></table></div>';
    }
    h += '<div class="rule">三条全满足 → 保留；任一条不满足 → 剔除。偏离填绝对值，超过 2% 自动剔除。</div></div>';

    /* 4 观察清单 */
    h += '<div id="watchCard">' + watchCardHtml(e, st) + '</div>';

    /* 5 条件单 */
    h += '<div class="card"><div class="card-hd"><h3><span class="idx">5</span>写「如果……就……」条件单</h3>' +
      '<span class="tip">格式：若 15 分钟回踩 60 均线 + 5 线粘合向上突破 → 做多，止损粘合区下方 0.5ATR，开 X 手</span>' +
      '<span class="right"><button class="btn sm" data-act="add-order">+ 添加条件单</button>' +
      (e.done.c5 ? '<span class="tag ok">已完成</span>' : '') + '</span></div>';

    if (!e.orders.length) {
      h += '<div class="empty">还没有条件单。每个观察品种写一条：什么信号做多/做空、止损在哪、开几手。</div>';
    } else {
      h += '<div class="tbl-wrap"><table class="mob"><thead><tr>' +
        '<th style="width:150px">品种</th><th style="width:80px">方向</th><th>触发信号</th>' +
        '<th style="width:160px">止损</th><th class="num" style="width:76px">手数</th>' +
        '<th class="num" style="width:110px">计划风险(元)</th><th class="center" style="width:56px">操作</th></tr></thead><tbody>';
      e.orders.forEach(function (o, i) {
        h += '<tr>' +
          '<td data-label="品种"><select data-arr="evening.orders" data-idx="' + i + '" data-field="symbol">' + TL.symbolOptions(o.symbol) + '</select></td>' +
          '<td data-label="方向">' + '<select data-arr="evening.orders" data-idx="' + i + '" data-field="direction">' +
          '<option value="long"' + (o.direction === 'long' ? ' selected' : '') + '>做多</option>' +
          '<option value="short"' + (o.direction === 'short' ? ' selected' : '') + '>做空</option></select></td>' +
          '<td data-label="触发信号"><input data-arr="evening.orders" data-idx="' + i + '" data-field="trigger" value="' + H(o.trigger) + '" placeholder="15分钟回踩60均线+5线粘合向上突破"></td>' +
          '<td data-label="止损"><input data-arr="evening.orders" data-idx="' + i + '" data-field="stop" value="' + H(o.stop) + '" placeholder="粘合区下方0.5ATR"></td>' +
          numCell('手数', 'evening.orders', i, 'lots', o.lots, '1') +
          numCell('计划风险(元)', 'evening.orders', i, 'risk', o.risk, '100') +
          '<td class="center"><button class="btn sm ghost danger" data-act="del-order" data-idx="' + i + '">删</button></td>' +
          '</tr>';
      });
      h += '</tbody></table></div>';
      const overRisk = e.orders.filter(function (o) { return TL.n(o.risk, 0) > st.maxSingleLoss; });
      if (overRisk.length) {
        h += '<div class="note danger" style="margin-top:10px;margin-bottom:0">有 ' + overRisk.length + ' 条条件单的计划风险超过单笔上限 ' + TL.fmt(st.maxSingleLoss) + ' 元，下单前先减手数。</div>';
      }
    }
    h += '<div style="margin-top:10px"><label style="display:flex;align-items:center;gap:6px;font-size:12px;color:var(--muted)"><input type="checkbox" data-done="c5"' + (e.done.c5 ? ' checked' : '') + '>已写完条件单</label></div></div>';

    /* 6 持仓检查 */
    h += '<div class="card"><div class="card-hd"><h3><span class="idx">6</span>检查持仓</h3>' +
      '<span class="tip">收盘价跌破 20 均线 → 次日平仓；浮盈 ≥ 2R → 止损上移到成本价</span>' +
      '<span class="right"><button class="btn sm" data-act="add-pos">+ 添加持仓</button>' +
      (e.done.c6 ? '<span class="tag ok">已完成</span>' : '') + '</span></div>';

    if (!e.positions.length) {
      h += '<div class="empty">当前无持仓（空仓也是一种状态，不用填）。</div>';
    } else {
      h += '<div class="tbl-wrap"><table class="mob"><thead><tr>' +
        '<th style="width:150px">品种</th><th class="num" style="width:110px">持仓均价</th>' +
        '<th class="num" style="width:76px">手数</th><th class="num" style="width:110px">移动止损价</th>' +
        '<th class="center" style="width:120px">收盘破 20 均线</th><th class="center" style="width:110px">浮盈 ≥ 2R</th>' +
        '<th>动作</th><th class="center" style="width:56px">操作</th></tr></thead><tbody>';
      e.positions.forEach(function (p, i) {
        const act = p.exitHit ? '<span class="tag no">次日平仓</span>'
          : (p.moveStop ? '<span class="tag accent">止损上移到成本价</span>' : '<span class="tag">持有观察</span>');
        h += '<tr>' +
          '<td data-label="品种"><select data-arr="evening.positions" data-idx="' + i + '" data-field="symbol">' + TL.symbolOptions(p.symbol) + '</select></td>' +
          numCell('持仓均价', 'evening.positions', i, 'avgPrice', p.avgPrice, '1') +
          numCell('手数', 'evening.positions', i, 'lots', p.lots, '1') +
          numCell('移动止损价', 'evening.positions', i, 'stop', p.stop, '1') +
          checkCell('收盘破20均线', 'evening.positions', i, 'exitHit', p.exitHit) +
          checkCell('浮盈≥2R', 'evening.positions', i, 'moveStop', p.moveStop) +
          '<td data-label="动作" data-pos-act="' + i + '">' + act + '</td>' +
          '<td class="center"><button class="btn sm ghost danger" data-act="del-pos" data-idx="' + i + '">删</button></td>' +
          '</tr>';
      });
      h += '</tbody></table></div>';
    }
    h += '<div style="margin-top:10px"><label style="display:flex;align-items:center;gap:6px;font-size:12px;color:var(--muted)"><input type="checkbox" data-done="c6"' + (e.done.c6 ? ' checked' : '') + '>已检查持仓</label></div></div>';

    /* 当日产出 */
    const doneCount = ['c1', 'c2', 'c3', 'c4', 'c5', 'c6'].filter(function (k) { return e.done[k]; }).length;
    h += '<div class="note"><b>当日产出：</b>一张纸 —— ' + e.watch.length + ' 个品种各自的条件、止损、仓位。' +
      '（完成 ' + doneCount + '/6）</div>';

    return h;
  }

  /* ---------------- 二、盘中打卡 ---------------- */
  function viewIntraday() {
    const day = TL.ensureDay(TL.UI.date);
    const e = day.evening;
    const it = day.intraday;
    const times = ['10:00', '13:30', '14:15'];
    const st = TL.DB.settings;

    let h = '<div class="note"><b>盘中铁律：</b>信号出现 → 按昨晚写好的止损和仓位执行，不临时改；信号没出现 → 不动；日报和你的系统冲突 → 以你的系统为准，或不做。' +
      '<br>每天只开图表三次，每次 5 分钟，' + st.noNewAfter + ' 后不开新仓。</div>';

    if (!e.watch.length) {
      h += '<div class="card"><div class="empty">观察清单是空的。先去「当晚清单」筛出 2–3 个品种，再回来打卡。</div></div>';
    } else {
      h += '<div class="check-grid">';
      times.forEach(function (tm) {
        const ck = it.checks[tm] || (it.checks[tm] = {});
        h += '<div class="check-block"><h4><span class="time">' + tm + '</span>' +
          (tm === '14:15' ? '<span style="font-size:11.5px;color:var(--muted);font-weight:400">收盘前最后一次</span>' : '') +
          '</h4>';
        e.watch.forEach(function (sym) {
          const cur = (ck[sym] && ck[sym].state) || '';
          h += '<div class="check-row"><div class="sym">' + H(TL.symbolLabel(sym)) +
            (cur === 'exec' ? '<span class="tag ok">已执行</span>' : '') +
            (cur === 'none' ? '<span class="tag">未动</span>' : '') +
            (cur === 'skip' ? '<span class="tag warn">漏做</span>' : '') +
            (cur === 'viol' ? '<span class="tag no">违规</span>' : '') +
            '</div><div class="state-btns">' +
            '<button data-act="check" data-time="' + tm + '" data-sym="' + H(sym) + '" data-state="exec" class="' + (cur === 'exec' ? 'on' : '') + '">有信号·执行</button>' +
            '<button data-act="check" data-time="' + tm + '" data-sym="' + H(sym) + '" data-state="skip" class="' + (cur === 'skip' ? 'on warn' : '') + '">有信号·没做</button>' +
            '<button data-act="check" data-time="' + tm + '" data-sym="' + H(sym) + '" data-state="none" class="' + (cur === 'none' ? 'on' : '') + '">无信号·不动</button>' +
            '<button data-act="check" data-time="' + tm + '" data-sym="' + H(sym) + '" data-state="viol" class="' + (cur === 'viol' ? 'on bad' : '') + '">违规操作</button>' +
            '</div></div>';
        });
        h += '</div>';
      });
      h += '</div>';
    }

    /* 违规登记 */
    const vios = [
      ['chase', '没信号就冲'],
      ['stop', '临时改止损'],
      ['size', '重仓 / 超手数'],
      ['late', st.noNewAfter + ' 后开新仓'],
      ['other', '其他违规']
    ];
    h += '<div class="card" style="margin-top:12px"><div class="card-hd"><h3>违规登记</h3><span class="tip">这里勾的每一条，周日会自动汇总进纪律检查</span></div>' +
      '<div class="chips">' + vios.map(function (v) {
        const on = it.violations[v[0]];
        return '<span class="chip ' + (on ? 'on' : '') + '" data-act="toggle-viol" data-key="' + v[0] + '">' + H(v[1]) + '</span>';
      }).join('') + '</div>' +
      '<div style="margin-top:10px">' + ta('intraday.note', it.note, '今天盘中的情况，一句话：如「10:00 螺纹出信号，按计划进 2 手」', 2) + '</div></div>';

    return h;
  }

  /* ---------------- 三、盘后复盘 ---------------- */
  function viewReview() {
    const day = TL.ensureDay(TL.UI.date);
    const r = day.review;
    const e = day.evening;

    let h = '<div class="note"><b>复盘只做三件事：</b>对答案（老师说的 vs 实际走的）、看自己（信号抓没抓到）、记一笔（板块轮动表新增一行）。</div>';

    h += '<div class="card"><div class="card-hd"><h3><span class="idx">1</span>对照老师昨日判断</h3><span class="tip">昨日最强品种：' + H(e.theme.strongest || '未记录') + '</span></div>' +
      '<div class="grid c2">' +
      '<div class="field"><label>今日走势</label>' + seg('review.strongestRun', [{ v: '延续', t: '延续强势' }, { v: '转弱', t: '转弱' }, { v: '震荡', t: '震荡无方向' }], r.strongestRun) + '</div>' +
      '<div class="field"><label>备注</label>' + inp('review.strongestRunNote', r.strongestRunNote, '如「冲高 2% 后回落收平」') + '</div>' +
      '</div></div>';

    h += '<div class="card"><div class="card-hd"><h3><span class="idx">2</span>对照「等信号」品种</h3><span class="tip">老师说等三线五线的品种，今天出信号了吗</span></div>' +
      '<div class="grid c3">' +
      '<div class="field"><label>是否出信号</label>' + seg('review.waitAppeared', [{ v: '出了', t: '出了' }, { v: '没出', t: '没出' }, { v: '没提', t: '老师没提' }], r.waitAppeared) + '</div>' +
      '<div class="field"><label>我抓到了吗</label>' + seg('review.waitCaught', [{ v: '抓到', t: '抓到' }, { v: '没盯', t: '没盯盘' }, { v: '犹豫', t: '犹豫没进' }, { v: '不信', t: '不信没做' }], r.waitCaught) + '</div>' +
      '<div class="field"><label>备注</label>' + inp('review.waitReason', r.waitReason, '没抓到就写清楚为什么') + '</div>' +
      '</div></div>';

    h += '<div class="card"><div class="card-hd"><h3><span class="idx">3</span>验证「不要做」的品种</h3><span class="tip">远离均线不要追 —— 今天是不是真的冲高回落了</span></div>' +
      '<div class="grid c2">' +
      '<div class="field"><label>结果</label>' + seg('review.noChaseFell', [{ v: '回落', t: '确实冲高回落' }, { v: '继续涨', t: '继续走强' }, { v: '没发生', t: '今天没这情况' }], r.noChaseFell) + '</div>' +
      '<div class="field"><label>备注</label>' + inp('review.noChaseNote', r.noChaseNote, '验证「不追远离均线」这条规则') + '</div>' +
      '</div></div>';

    h += '<div class="card"><div class="card-hd"><h3><span class="idx">4</span>记录自己信号的结果</h3><span class="tip">长期统计：一致时谁胜率高，不一致时谁胜率高</span></div>' +
      '<div class="grid c4">' +
      '<div class="field"><label>与老师判断</label>' + seg('review.align', [{ v: '一致', t: '一致' }, { v: '不一致', t: '不一致' }, { v: '老师未提', t: '老师未提' }], r.align) + '</div>' +
      '<div class="field"><label>结果</label>' + seg('review.result', [{ v: '盈利', t: '盈利' }, { v: '亏损', t: '亏损' }, { v: '持平', t: '持平' }], r.result) + '</div>' +
      '<div class="field"><label>说明</label>' + inp('review.resultNote', r.resultNote, '如「螺纹多单 +2800」') + '</div>' +
      '<div class="field"><label>是否已记成交</label>' +
      '<div style="display:flex;align-items:center;height:32px"><button class="btn sm" data-act="goto-trades">去记一笔成交 →</button></div></div>' +
      '</div>' +
      '<div class="rule">精确的胜率、盈亏比由「成交记录」的盈亏字段自动算，这里只记方向判断。</div></div>';

    h += '<div class="card"><div class="card-hd"><h3><span class="idx">5</span>更新板块轮动表</h3><span class="tip">月底回看，理解资金怎么在板块间流动</span></div>' +
      '<div class="grid c4">' +
      '<div class="field"><label>主线板块</label>' + inp('review.rotSector', r.rotSector || e.theme.mainSector, '如 黑色系') + '</div>' +
      '<div class="field"><label>最强品种</label>' + inp('review.rotStrong', r.rotStrong || e.theme.strongest, '') + '</div>' +
      '<div class="field"><label>最弱品种</label>' + inp('review.rotWeak', r.rotWeak || e.theme.weakest, '') + '</div>' +
      '<div class="field"><label>老师核心提醒</label>' + inp('review.rotNote', r.rotNote, '一句话') + '</div>' +
      '</div>' +
      '<div class="field" style="margin-top:10px"><label>复盘笔记（1–2 条）</label>' + ta('review.notes', r.notes, '如「1. 强势品种不追；2. 玻璃破位但没量，暂不做」', 3) + '</div></div>';

    h += '<div class="note"><b>当日产出：</b>板块轮动表新增 1 行 + 1–2 条复盘笔记。</div>';
    return h;
  }

  /* ---------------- 成交记录 ---------------- */
  function tradeKpisHtml(trades) {
    const s = TL.computeStats(trades);
    return kpi('本日盈亏', TL.money(s.total), '元', s.total) +
      kpi('笔数', s.count, '笔') +
      kpi('胜率', s.count ? s.winRate.toFixed(0) : '—', '%') +
      kpi('盈亏比', s.count ? TL.formatRatio(s.plRatio) : '—', '');
  }
  TL.tradeKpisHtml = tradeKpisHtml;

  function viewTrades() {
    const day = TL.ensureDay(TL.UI.date);
    const st = TL.DB.settings;
    const trades = day.trades || [];
    const stats = TL.computeStats(trades);

    let h = '<div class="kpis" id="tradeKpis" style="grid-template-columns:repeat(4,minmax(0,1fr))">' +
      tradeKpisHtml(trades) +
      '</div>';

    h += '<div class="card"><div class="card-hd"><h3>成交明细</h3>' +
      '<span class="tip">盈亏填已实现金额；「与老师一致」「按信号执行」用于长期对比</span>' +
      '<span class="right"><button class="btn sm" data-act="add-trade">+ 添加成交</button></span></div>';

    if (!trades.length) {
      h += '<div class="empty">今天还没有成交。没信号没做，就保持空着。</div>';
    } else {
      h += '<div class="tbl-wrap"><table class="mob"><thead><tr>' +
        '<th style="width:140px">品种</th><th style="width:76px">方向</th>' +
        '<th class="num" style="width:100px">开仓价</th><th class="num" style="width:100px">平仓价</th>' +
        '<th class="num" style="width:70px">手数</th><th class="num" style="width:104px">盈亏(元)</th>' +
        '<th class="center" style="width:104px">与老师一致</th><th class="center" style="width:104px">按信号执行</th>' +
        '<th>备注</th><th class="center" style="width:56px">操作</th></tr></thead><tbody>';
      trades.forEach(function (t, i) {
        h += '<tr>' +
          '<td data-label="品种"><select data-arr="trades" data-idx="' + i + '" data-field="symbol">' + TL.symbolOptions(t.symbol) + '</select></td>' +
          '<td data-label="方向"><select data-arr="trades" data-idx="' + i + '" data-field="direction">' +
          '<option value="long"' + (t.direction === 'long' ? ' selected' : '') + '>多</option>' +
          '<option value="short"' + (t.direction === 'short' ? ' selected' : '') + '>空</option></select></td>' +
          numCell('开仓价', 'trades', i, 'entry', t.entry, '1') +
          numCell('平仓价', 'trades', i, 'exit', t.exit, '1') +
          numCell('手数', 'trades', i, 'lots', t.lots, '1') +
          '<td class="num" data-label="盈亏(元)"><input type="number" step="10" data-arr="trades" data-idx="' + i + '" data-field="pnl" value="' + H(t.pnl) + '"></td>' +
          '<td class="center" data-label="与老师一致"><select data-arr="trades" data-idx="' + i + '" data-field="aligned" style="width:auto">' +
          '<option value=""' + (t.aligned === '' || t.aligned == null ? ' selected' : '') + '>—</option>' +
          '<option value="yes"' + (t.aligned === 'yes' ? ' selected' : '') + '>一致</option>' +
          '<option value="no"' + (t.aligned === 'no' ? ' selected' : '') + '>不一致</option></select></td>' +
          '<td class="center" data-label="按信号执行"><select data-arr="trades" data-idx="' + i + '" data-field="signalOk" style="width:auto">' +
          '<option value=""' + (t.signalOk === '' || t.signalOk == null ? ' selected' : '') + '>—</option>' +
          '<option value="yes"' + (t.signalOk === 'yes' ? ' selected' : '') + '>按信号</option>' +
          '<option value="no"' + (t.signalOk === 'no' ? ' selected' : '') + '>违规</option></select></td>' +
          '<td data-label="备注"><input data-arr="trades" data-idx="' + i + '" data-field="note" value="' + H(t.note) + '" placeholder="如：回踩60均线粘合突破"></td>' +
          '<td class="center"><button class="btn sm ghost danger" data-act="del-trade" data-idx="' + i + '">删</button></td>' +
          '</tr>';
      });
      h += '</tbody></table></div>';
      if (stats.maxLoss < -st.maxSingleLoss) {
        h += '<div class="note danger" style="margin-top:10px;margin-bottom:0">有一笔亏损 ' + TL.money(stats.maxLoss) + ' 元，超过单笔上限 ' + TL.fmt(st.maxSingleLoss) + ' 元。查一下是仓位过大还是止损没执行。</div>';
      }
    }
    h += '</div>';
    return h;
  }

  function kpi(k, v, u, colorVal) {
    let cls = '';
    if (colorVal !== undefined) cls = colorVal > 0 ? ' up' : (colorVal < 0 ? ' down' : '');
    return '<div class="kpi"><div class="k">' + H(k) + '</div><div class="v' + cls + '">' + H(v) +
      (u ? '<span class="u">' + H(u) + '</span>' : '') + '</div></div>';
  }

  TL.kpi = kpi;

  /* ============================================================
     板块轮动
     ============================================================ */
  TL.renderRotation = function () {
    const rows = [];
    Object.keys(TL.DB.days).sort().reverse().forEach(function (date) {
      const d = TL.DB.days[date];
      const r = d.review || {};
      const t = d.evening.theme || {};
      const sector = r.rotSector || t.mainSector || '';
      const strong = r.rotStrong || t.strongest || '';
      const weak = r.rotWeak || t.weakest || '';
      const note = r.rotNote || '';
      if (!sector && !strong && !weak && !note) return;
      rows.push({ date: date, sector: sector, strong: strong, weak: weak, turning: t.turning || '', note: note, trade: TL.computeStats(d.trades || []).total });
    });

    let h = '<div class="card"><div class="card-hd"><h3>板块轮动表</h3>' +
      '<span class="tip">数据来自每天「盘后复盘 · 第 5 项」，按日期倒序 · 共 ' + rows.length + ' 行</span>' +
      '<span class="right"><button class="btn sm" data-act="export-rotation">导出 CSV</button></span></div>';

    if (!rows.length) {
      h += '<div class="empty">还没有记录。每天盘后填一次「主线板块 / 最强 / 最弱 / 老师提醒」，这里会自动汇总。</div>';
    } else {
      h += '<div class="tbl-wrap"><table class="mob"><thead><tr>' +
        '<th style="width:110px">日期</th><th style="width:140px">主线板块</th><th style="width:120px">最强</th>' +
        '<th style="width:120px">最弱</th><th style="width:120px">由弱转强</th><th>老师核心提醒</th>' +
        '<th class="num" style="width:100px">当日盈亏</th></tr></thead><tbody>';
      rows.forEach(function (r) {
        h += '<tr>' +
          '<td data-label="日期">' + H(r.date) + ' <span style="color:var(--muted);font-size:11px">' + TL.weekday(r.date) + '</span></td>' +
          '<td data-label="主线板块">' + H(r.sector || '—') + '</td>' +
          '<td data-label="最强">' + H(r.strong || '—') + '</td>' +
          '<td data-label="最弱">' + H(r.weak || '—') + '</td>' +
          '<td data-label="由弱转强">' + H(r.turning || '—') + '</td>' +
          '<td data-label="老师提醒">' + H(r.note || '—') + '</td>' +
          '<td class="num" data-label="当日盈亏" style="color:' + (r.trade > 0 ? 'var(--up)' : (r.trade < 0 ? 'var(--down)' : 'inherit')) + '">' + (r.trade ? TL.money(r.trade) : '—') + '</td>' +
          '</tr>';
      });
      h += '</tbody></table></div>';
    }
    h += '</div>';
    document.getElementById('rotationBody').innerHTML = h;
  };

  /* ============================================================
     统计
     ============================================================ */
  TL.renderStats = function () {
    const st = TL.DB.settings;
    const all = TL.allTrades();
    const s = TL.computeStats(all);

    let h = '<div class="kpis">' +
      kpi('总笔数', s.count, '笔') +
      kpi('胜率', s.count ? s.winRate.toFixed(0) : '—', '%') +
      kpi('盈亏比', s.count ? TL.formatRatio(s.plRatio) : '—', '') +
      kpi('累计盈亏', TL.money(s.total), '元', s.total) +
      kpi('最大单笔亏损', s.maxLoss ? TL.money(s.maxLoss) : '—', '元', s.maxLoss) +
      kpi('最大回撤', s.maxDrawdown ? TL.money(-s.maxDrawdown) : '—', '元', -s.maxDrawdown) +
      '</div>';

    /* 告警 */
    if (s.streakLoss >= st.pauseAfterStreak) {
      h += '<div class="note danger"><b>连续 ' + s.streakLoss + ' 笔亏损</b>（阈值 ' + st.pauseAfterStreak + ' 笔）→ 按规则暂停 1 周，只复盘不下单。</div>';
    } else if (s.streakWin >= 3) {
      h += '<div class="note warn"><b>已连续 ' + s.streakWin + ' 笔盈利</b> → 注意别加仓、别放松止损，规则不变。</div>';
    }
    if (!all.length) {
      h += '<div class="card"><div class="empty">还没有成交数据。开始记录后，这里会自动算胜率、盈亏比、回撤和一致/不一致的对比。</div></div>';
    }

    /* 一致 vs 不一致 */
    const byAlign = TL.groupStats(all, function (t) { return t.aligned === 'yes' ? '与老师一致' : (t.aligned === 'no' ? '与老师不一致' : null); });
    const bySignal = TL.groupStats(all, function (t) { return t.signalOk === 'yes' ? '按信号执行' : (t.signalOk === 'no' ? '违规执行' : null); });

    h += '<div class="card"><div class="card-hd"><h3>日报 vs 我的系统</h3><span class="tip">长期统计，谁胜率高就用谁的规则</span></div>';
    h += '<div class="grid c2">';
    h += compareTable('与老师判断的关系', byAlign, st);
    h += compareTable('是否按信号执行', bySignal, st);
    h += '</div></div>';

    /* 资金曲线 */
    if (s.curve.length > 1) {
      h += '<div class="card"><div class="card-hd"><h3>资金曲线</h3><span class="tip">按已实现盈亏累计（元）</span></div>' +
        curveSvg(s.curve) + '</div>';
    }

    /* 月度汇总 */
    const ms = TL.monthlyStats();
    const mkeys = Object.keys(ms).sort().reverse();
    if (mkeys.length) {
      h += '<div class="card"><div class="card-hd"><h3>按月汇总</h3></div><div class="tbl-wrap"><table class="mob"><thead><tr>' +
        '<th>月份</th><th class="num">笔数</th><th class="num">胜率</th><th class="num">盈亏比</th>' +
        '<th class="num">盈亏</th><th class="num">最大回撤</th><th class="num">最大单笔亏损</th></tr></thead><tbody>';
      mkeys.forEach(function (m) {
        const x = TL.computeStats(ms[m]);
        h += '<tr><td data-label="月份">' + H(m) + '</td>' +
          '<td class="num" data-label="笔数">' + x.count + '</td>' +
          '<td class="num" data-label="胜率">' + x.winRate.toFixed(0) + '%</td>' +
          '<td class="num" data-label="盈亏比">' + TL.formatRatio(x.plRatio) + '</td>' +
          '<td class="num" data-label="盈亏" style="color:' + (x.total > 0 ? 'var(--up)' : (x.total < 0 ? 'var(--down)' : 'inherit')) + '">' + TL.money(x.total) + '</td>' +
          '<td class="num" data-label="最大回撤">' + TL.money(-x.maxDrawdown) + '</td>' +
          '<td class="num" data-label="最大单笔亏损">' + TL.money(x.maxLoss) + '</td></tr>';
      });
      h += '</tbody></table></div></div>';
    }

    document.getElementById('statsBody').innerHTML = h;
  };

  function compareTable(title, groups, st) {
    const keys = Object.keys(groups);
    let h = '<div><div style="font-size:12.5px;font-weight:600;margin-bottom:6px">' + H(title) + '</div>' +
      '<div class="tbl-wrap"><table><thead><tr><th>分组</th><th class="num">笔数</th><th class="num">胜率</th><th class="num">盈亏比</th><th class="num">盈亏</th></tr></thead><tbody>';
    if (!keys.length) {
      h += '<tr><td colspan="5" style="text-align:center;color:var(--muted);font-size:12px;padding:14px">暂无数据</td></tr>';
    }
    keys.forEach(function (k) {
      const g = groups[k];
      h += '<tr><td>' + H(k) + '</td><td class="num">' + g.count + '</td>' +
        '<td class="num">' + g.winRate.toFixed(0) + '%</td>' +
        '<td class="num">' + TL.formatRatio(g.plRatio) + '</td>' +
        '<td class="num" style="color:' + (g.total > 0 ? 'var(--up)' : (g.total < 0 ? 'var(--down)' : 'inherit')) + '">' + TL.money(g.total) + '</td></tr>';
    });
    h += '</tbody></table></div></div>';
    return h;
  }

  function curveSvg(curve) {
    const W = 900, Hh = 190, pad = 26;
    const min = Math.min(0, Math.min.apply(null, curve));
    const max = Math.max(0, Math.max.apply(null, curve));
    const range = (max - min) || 1;
    const x = function (i) { return pad + (i / Math.max(1, curve.length - 1)) * (W - pad * 2); };
    const y = function (v) { return Hh - pad - ((v - min) / range) * (Hh - pad * 2); };
    let d = '';
    curve.forEach(function (v, i) { d += (i ? ' L' : 'M') + x(i).toFixed(1) + ' ' + y(v).toFixed(1); });

    let grid = '';
    for (let i = 0; i <= 3; i++) {
      const v = min + range * i / 3;
      const yy = y(v).toFixed(1);
      grid += '<line class="grid-line" x1="' + pad + '" y1="' + yy + '" x2="' + (W - pad) + '" y2="' + yy + '"></line>' +
        '<text class="lbl" x="' + (W - pad + 4) + '" y="' + (+yy + 3) + '">' + Math.round(v) + '</text>';
    }
    return '<svg class="chart" viewBox="0 0 ' + W + ' ' + Hh + '" preserveAspectRatio="none">' + grid +
      '<line class="axis" x1="' + pad + '" y1="' + y(0).toFixed(1) + '" x2="' + (W - pad) + '" y2="' + y(0).toFixed(1) + '"></line>' +
      '<path class="ln" d="' + d + '"></path></svg>';
  }

  /* ============================================================
     周度
     ============================================================ */
  TL.renderWeekly = function () {
    const st = TL.DB.settings;
    const date = TL.UI.date;
    const wk = TL.isoWeekKey(date);
    const d = TL.parseDate(date);
    const day = (d.getDay() + 6) % 7;
    const from = TL.addDays(date, -day);
    const to = TL.addDays(from, 6);

    const trades = TL.tradesBetween(from, to);
    const s = TL.computeStats(trades);

    /* 违规汇总 */
    let vioCount = 0;
    const vioDetail = {};
    const vios = [['chase', '没信号就冲'], ['stop', '临时改止损'], ['size', '重仓/超手数'], ['late', '收盘前开新仓'], ['other', '其他']];
    for (let dd = from; dd <= to; dd = TL.addDays(dd, 1)) {
      const dayObj = TL.DB.days[dd];
      if (!dayObj) continue;
      const v = dayObj.intraday.violations || {};
      vios.forEach(function (it) { if (v[it[0]]) { vioCount++; vioDetail[it[1]] = (vioDetail[it[1]] || 0) + 1; } });
    }

    const rec = TL.DB.weeks[wk] || (TL.DB.weeks[wk] = {});

    let h = '<div class="card"><div class="card-hd"><h3>周度复盘 · ' + H(wk) + '</h3>' +
      '<span class="tip">' + from + ' ~ ' + to + ' · 周日 30 分钟</span>' +
      '<span class="right"><button class="btn sm ghost" data-act="week-prev">上一周</button><button class="btn sm ghost" data-act="week-next">下一周</button></span></div>' +
      '<div class="kpis" style="grid-template-columns:repeat(4,minmax(0,1fr));margin-bottom:0">' +
      kpi('交易次数', s.count, '笔') +
      kpi('胜率', s.count ? s.winRate.toFixed(0) : '—', '%') +
      kpi('盈亏比', s.count ? TL.formatRatio(s.plRatio) : '—', '') +
      kpi('最大单笔亏损', s.maxLoss ? TL.money(s.maxLoss) : '—', '元', s.maxLoss) +
      '</div></div>';

    /* 1 统计本周交易 */
    h += '<div class="card"><div class="card-hd"><h3><span class="idx">1</span>统计本周交易</h3><span class="tip">自动汇总，无需手填</span></div>' +
      '<div class="grid c4">' +
      '<div class="field"><label>本周盈亏</label><div style="font-size:16px;font-weight:650;color:' + (s.total > 0 ? 'var(--up)' : (s.total < 0 ? 'var(--down)' : 'inherit')) + '">' + TL.money(s.total) + ' 元</div></div>' +
      '<div class="field"><label>盈利笔数 / 亏损笔数</label><div style="font-size:16px;font-weight:650">' + s.wins + ' / ' + s.losses + '</div></div>' +
      '<div class="field"><label>平均盈利 / 平均亏损</label><div style="font-size:16px;font-weight:650">' + TL.fmt(s.avgWin) + ' / ' + TL.fmt(s.avgLoss) + '</div></div>' +
      '<div class="field"><label>当前连续亏损</label><div style="font-size:16px;font-weight:650">' + s.streakLoss + ' 笔</div></div>' +
      '</div></div>';

    /* 2 纪律 */
    h += '<div class="card"><div class="card-hd"><h3><span class="idx">2</span>检查纪律执行</h3>' +
      '<span class="tip">有没有「没信号就冲」「临时改止损」「重仓」</span>' +
      '<span class="right"><span class="tag ' + (vioCount ? 'no' : 'ok') + '">本周违规 ' + vioCount + ' 次</span></span></div>';
    if (vioCount) {
      h += '<div class="chips" style="margin-bottom:10px">';
      Object.keys(vioDetail).forEach(function (k) {
        h += '<span class="tag no">' + H(k) + ' × ' + vioDetail[k] + '</span>';
      });
      h += '</div>';
    } else {
      h += '<div class="rule" style="margin-top:0;margin-bottom:10px">本周没有违规记录。若确实有，去当天「盘中打卡 · 违规登记」补上。</div>';
    }
    h += '<div class="field"><label>纪律小结</label>' + ta('week.discipline', rec.discipline, '如「本周 2 次在没有信号时追单，都是因为看了日报」', 2) + '</div></div>';

    /* 3 品种池 */
    h += '<div class="card"><div class="card-hd"><h3><span class="idx">3</span>更新品种池</h3><span class="tip">根据本周板块轮动，调整下周重点关注的 2–3 个品种</span></div>' +
      '<div class="grid c2">' +
      '<div class="field"><label>下周重点关注</label>' + inp('week.pool', rec.pool, '如 螺纹、铁矿、纯碱') + '</div>' +
      '<div class="field"><label>移除 / 加入理由</label>' + inp('week.poolWhy', rec.poolWhy, '如 黑色系资金流出，换纯碱') + '</div>' +
      '</div></div>';

    /* 4 仓位 */
    const marginPct = rec.marginPct === '' || rec.marginPct == null ? '' : TL.n(rec.marginPct, 0);
    const posCount = rec.positions === '' || rec.positions == null ? '' : TL.n(rec.positions, 0);
    const marginBad = marginPct !== '' && marginPct > st.maxMarginPct;
    const posBad = posCount !== '' && posCount > st.maxPositions;
    h += '<div class="card"><div class="card-hd"><h3><span class="idx">4</span>检查仓位</h3>' +
      '<span class="tip">总保证金 ≤ ' + st.maxMarginPct + '% · 同时持仓 ≤ ' + st.maxPositions + ' 个品种</span></div>' +
      '<div class="grid c3">' +
      '<div class="field"><label>总保证金占用 %</label><input type="number" step="1" data-path="week.marginPct" value="' + H(rec.marginPct) + '" placeholder="如 45"><div class="rule">' + (marginBad ? '<span style="color:var(--up)">超出上限</span>' : '') + '</div></div>' +
      '<div class="field"><label>同时持仓品种数</label><input type="number" step="1" data-path="week.positions" value="' + H(rec.positions) + '" placeholder="如 2"><div class="rule">' + (posBad ? '<span style="color:var(--up)">超出上限</span>' : '') + '</div></div>' +
      '<div class="field"><label>本周最大回撤</label><div style="font-size:16px;font-weight:650">' + TL.money(-s.maxDrawdown) + ' 元</div></div>' +
      '</div></div>';

    document.getElementById('weeklyBody').innerHTML = h;
  };

  /* ============================================================
     月度
     ============================================================ */
  TL.renderMonthly = function () {
    const st = TL.DB.settings;
    const mk = TL.monthKey(TL.UI.date);
    const trades = TL.allTrades().filter(function (t) { return TL.monthKey(t.date) === mk; });
    const s = TL.computeStats(trades);
    const rec = TL.DB.months[mk] || (TL.DB.months[mk] = {});

    const align = TL.groupStats(trades, function (t) {
      return t.aligned === 'yes' ? '一致' : (t.aligned === 'no' ? '不一致' : null);
    });

    const pause = s.streakLoss >= st.pauseAfterStreak;
    const keep = s.winRate > st.goodWinRate && isFinite(s.plRatio) && s.plRatio > st.goodProfitFactor;

    let h = '<div class="card"><div class="card-hd"><h3>月度复盘 · ' + H(mk) + '</h3>' +
      '<span class="tip">月底 1 小时</span>' +
      '<span class="right"><span class="tag accent">' + s.count + ' 笔</span></span></div>' +
      '<div class="kpis" style="grid-template-columns:repeat(4,minmax(0,1fr));margin-bottom:0">' +
      kpi('月度盈亏', TL.money(s.total), '元', s.total) +
      kpi('胜率', s.count ? s.winRate.toFixed(0) : '—', '%') +
      kpi('盈亏比', s.count ? TL.formatRatio(s.plRatio) : '—', '') +
      kpi('最大回撤', TL.money(-s.maxDrawdown), '元', -s.maxDrawdown) +
      '</div></div>';

    /* 1 月度盈亏 */
    h += '<div class="card"><div class="card-hd"><h3><span class="idx">1</span>统计月度盈亏</h3><span class="tip">是否达到预期？最大回撤多少？</span></div>' +
      '<div class="grid c3">' +
      '<div class="field"><label>本月目标盈亏（元）</label>' + inp('month.targetPnl', rec.targetPnl, '如 20000', '', 'number') + '</div>' +
      '<div class="field"><label>实际 / 达成</label><div style="font-size:15px;font-weight:650;padding-top:4px">' + TL.money(s.total) + ' 元' +
      (TL.n(rec.targetPnl, 0) > 0 ? '（' + (s.total / TL.n(rec.targetPnl, 1) * 100).toFixed(0) + '%）' : '') + '</div></div>' +
      '<div class="field"><label>最大回撤</label><div style="font-size:15px;font-weight:650;padding-top:4px">' + TL.money(-s.maxDrawdown) + ' 元</div></div>' +
      '</div></div>';

    /* 2 日报使用效果 */
    h += '<div class="card"><div class="card-hd"><h3><span class="idx">2</span>复盘日报使用效果</h3><span class="tip">一致时胜率 vs 不一致时胜率</span></div>';
    h += '<div class="grid c2">';
    h += compareTable('与老师判断一致 / 不一致', align, st);
    h += '<div class="field"><label>结论（下月要不要更听日报，还是更信自己系统）</label>' +
      ta('month.effect', rec.effect, '如「一致时 6 笔 5 胜，不一致时 4 笔 1 胜 → 以后冲突就按系统做，但先小仓」', 4) + '</div>';
    h += '</div></div>';

    /* 3 规则调整 */
    h += '<div class="card"><div class="card-hd"><h3><span class="idx">3</span>检查规则是否需要调整</h3>' +
      '<span class="tip">连续 3 笔亏损 → 暂停 1 周；胜率 &gt; ' + st.goodWinRate + '% 且盈亏比 &gt; ' + st.goodProfitFactor + ' → 维持</span></div>';
    if (pause) {
      h += '<div class="note danger" style="margin-bottom:10px"><b>触发暂停条件：</b>当前连续 ' + s.streakLoss + ' 笔亏损 → 暂停 1 周，只做复盘和模拟。</div>';
    } else if (keep) {
      h += '<div class="note" style="margin-bottom:10px"><b>规则有效：</b>胜率 ' + s.winRate.toFixed(0) + '%、盈亏比 ' + TL.formatRatio(s.plRatio) + ' → 维持现有规则，不改参数。</div>';
    } else if (s.count) {
      h += '<div class="note warn" style="margin-bottom:10px">未达「维持」标准也未触发暂停：先看是执行问题还是系统问题，别急着改规则。</div>';
    }
    h += '<div class="field"><label>规则调整决定</label>' + ta('month.ruleAdjust', rec.ruleAdjust, '如「规则不变，只把观察清单从 3 个减到 2 个」', 2) + '</div></div>';

    /* 4 资金管理 */
    const singleBad = s.maxLoss < -st.maxSingleLoss;
    h += '<div class="card"><div class="card-hd"><h3><span class="idx">4</span>资金管理检查</h3>' +
      '<span class="tip">单笔亏损 ≤ ' + TL.fmt(st.maxSingleLoss) + ' 元 · 总资金 ≥ ' + TL.fmt(st.totalCapital) + ' 元</span>' +
      '<span class="right">' + (singleBad ? '<span class="tag no">单笔超限</span>' : '<span class="tag ok">单笔合规</span>') + '</span></div>' +
      '<div class="grid c3">' +
      '<div class="field"><label>本月最大单笔亏损</label><div style="font-size:15px;font-weight:650;padding-top:4px;color:' + (singleBad ? 'var(--up)' : 'inherit') + '">' + TL.money(s.maxLoss) + ' 元</div></div>' +
      '<div class="field"><label>当前总资金（元）</label>' + inp('month.capital', rec.capital || st.totalCapital, '', '', 'number') + '</div>' +
      '<div class="field"><label>是否还在 ' + TL.fmt(st.totalCapital) + ' 以上</label><div style="padding-top:6px">' +
      (TL.n(rec.capital || st.totalCapital, 0) >= st.totalCapital ? '<span class="tag ok">是</span>' : '<span class="tag no">已跌破，需减仓</span>') +
      '</div></div></div></div>';

    h += '<div class="note"><b>月度结论：</b>本月 ' + s.count + ' 笔 · 胜率 ' + (s.count ? s.winRate.toFixed(0) + '%' : '—') +
      ' · 盈亏比 ' + (s.count ? TL.formatRatio(s.plRatio) : '—') + ' · 盈亏 ' + TL.money(s.total) + ' 元。</div>';

    document.getElementById('monthlyBody').innerHTML = h;
  };

  /* ============================================================
     设置
     ============================================================ */
  TL.renderSettings = function () {
    const st = TL.DB.settings;
    const meta = TL.getMeta();
    const hasToken = !!TL.getToken();
    const snaps = TL.getSnapshots();

    let h = '<div class="card"><div class="card-hd"><h3>资金与规则参数</h3><span class="tip">改完立刻生效，全站统计按这里计算</span></div>' +
      '<div class="grid c4">' +
      '<div class="field"><label>总资金（元）</label><input type="number" step="10000" data-path="settings.totalCapital" value="' + H(st.totalCapital) + '"></div>' +
      '<div class="field"><label>单笔亏损上限（元）</label><input type="number" step="1000" data-path="settings.maxSingleLoss" value="' + H(st.maxSingleLoss) + '"></div>' +
      '<div class="field"><label>保证金占用上限（%）</label><input type="number" step="5" data-path="settings.maxMarginPct" value="' + H(st.maxMarginPct) + '"></div>' +
      '<div class="field"><label>同时持仓上限（品种）</label><input type="number" step="1" data-path="settings.maxPositions" value="' + H(st.maxPositions) + '"></div>' +
      '<div class="field"><label>观察清单默认个数</label><input type="number" step="1" data-path="settings.watchlistSize" value="' + H(st.watchlistSize) + '"></div>' +
      '<div class="field"><label>观察清单硬上限</label><input type="number" step="1" data-path="settings.watchlistMax" value="' + H(st.watchlistMax) + '"></div>' +
      '<div class="field"><label>不开新仓时间</label><input type="text" data-path="settings.noNewAfter" value="' + H(st.noNewAfter) + '"></div>' +
      '<div class="field"><label>连亏暂停阈值（笔）</label><input type="number" step="1" data-path="settings.pauseAfterStreak" value="' + H(st.pauseAfterStreak) + '"></div>' +
      '<div class="field"><label>维持规则：胜率 &gt;（%）</label><input type="number" step="5" data-path="settings.goodWinRate" value="' + H(st.goodWinRate) + '"></div>' +
      '<div class="field"><label>维持规则：盈亏比 &gt;</label><input type="number" step="0.5" data-path="settings.goodProfitFactor" value="' + H(st.goodProfitFactor) + '"></div>' +
      '</div></div>';

    /* 同步 */
    h += '<div class="card"><div class="card-hd"><h3>GitHub 同步</h3>' +
      '<span class="tip">数据存在你的私有仓库，换电脑填一次 Token 就能拉回来</span>' +
      '<span class="right">' + (hasToken ? '<span class="tag ok">已配置 Token</span>' : '<span class="tag warn">未配置</span>') + '</span></div>' +
      '<div class="grid c4">' +
      '<div class="field"><label>用户名 / 组织</label><input type="text" data-path="settings.owner" value="' + H(st.owner) + '"></div>' +
      '<div class="field"><label>数据仓库（私有）</label><input type="text" data-path="settings.repo" value="' + H(st.repo) + '"></div>' +
      '<div class="field"><label>分支</label><input type="text" data-path="settings.branch" value="' + H(st.branch) + '"></div>' +
      '<div class="field"><label>文件路径</label><input type="text" data-path="settings.path" value="' + H(st.path) + '"></div>' +
      '</div>' +
      '<div class="field" style="margin-top:10px"><label>Personal Access Token（只存在本机浏览器，不会写进数据文件）</label>' +
      '<div style="display:flex;gap:8px"><input type="password" id="tokenInput" placeholder="' + (hasToken ? '已保存，如需更换请重新粘贴' : 'github_pat_... 或 ghp_...') + '" autocomplete="off">' +
      '<button class="btn" data-act="save-token">保存</button>' +
      '<button class="btn ghost danger" data-act="clear-token">清除</button></div>' +
      '<div class="rule">权限只需 <b>这一个仓库</b> 的 Contents: Read and write。建议设 90 天有效期。</div></div>' +
      '<div style="display:flex;gap:8px;margin-top:12px;flex-wrap:wrap;align-items:center">' +
      '<button class="btn primary" data-act="push">上传到 GitHub</button>' +
      '<button class="btn" data-act="pull">从 GitHub 拉取</button>' +
      '<button class="btn ghost" data-act="test-conn">测试连接</button>' +
      '<label style="display:flex;align-items:center;gap:6px;font-size:12px;color:var(--muted);margin-left:auto"><input type="checkbox" data-path="settings.autoUpload" type="bool"' + (st.autoUpload ? ' checked' : '') + '>改完 20 秒后自动上传</label>' +
      '</div>' +
      '<div class="rule">最近上传：' + H(meta.lastPush || '从未') + ' · 最近拉取：' + H(meta.lastPull || '从未') + '</div></div>';

    /* 导入导出 */
    h += '<div class="card"><div class="card-hd"><h3>备份与导出</h3><span class="tip">Token 失效也不怕，JSON 文件能带走全部数据</span></div>' +
      '<div style="display:flex;gap:8px;flex-wrap:wrap">' +
      '<button class="btn" data-act="export-json">导出全部数据（JSON）</button>' +
      '<button class="btn" data-act="import-json">导入 JSON</button>' +
      '<button class="btn" data-act="export-trades">导出成交 CSV</button>' +
      '<button class="btn" data-act="export-rotation">导出轮动 CSV</button>' +
      '<input type="file" id="fileInput" accept=".json,application/json" hidden>' +
      '</div>' +
      '<div class="rule">换电脑第一步：新电脑打开网页 → 上传或导入这份 JSON → 之后继续用「上传/拉取」增量同步。</div></div>';

    /* 快照 */
    h += '<div class="card"><div class="card-hd"><h3>本地快照</h3><span class="tip">每次上传前自动留底，最多 8 份</span>' +
      '<span class="right"><button class="btn sm" data-act="snap-now">立即快照</button></span></div>';
    if (!snaps.length) {
      h += '<div class="empty">还没有快照。</div>';
    } else {
      h += '<div class="tbl-wrap"><table><thead><tr><th>时间</th><th>说明</th><th class="center" style="width:100px">操作</th></tr></thead><tbody>';
      snaps.forEach(function (s, i) {
        h += '<tr><td>' + H(s.at) + '</td><td>' + H(s.label) + '</td>' +
          '<td class="center"><button class="btn sm" data-act="restore-snap" data-idx="' + i + '">恢复</button></td></tr>';
      });
      h += '</tbody></table></div>';
    }
    h += '</div>';

    /* 口令 */
    h += '<div class="card"><div class="card-hd"><h3>进入口令</h3><span class="tip">防止别人打开你电脑看到记录（本地校验，非加密）</span></div>' +
      '<div style="display:flex;gap:8px;max-width:420px">' +
      '<input type="text" id="lockCodeInput" placeholder="' + (st.lockCodeHash ? '已设置，留空并点保存可取消' : '设一个口令，如 4 位数字') + '">' +
      '<button class="btn" data-act="save-lock">保存</button></div></div>';

    /* 危险 */
    h += '<div class="card"><div class="card-hd"><h3>危险操作</h3></div>' +
      '<div style="display:flex;gap:8px;flex-wrap:wrap">' +
      '<button class="btn danger" data-act="wipe">清空本机数据</button>' +
      '</div><div class="rule">只清本机浏览器里的数据，GitHub 上的不会动。</div></div>';

    document.getElementById('settingsBody').innerHTML = h;
  };

})(window);
