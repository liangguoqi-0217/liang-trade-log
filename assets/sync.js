/* ============================================================
   sync.js — GitHub 同步 / 导入导出 / 打印
   ============================================================ */
(function (root) {
  'use strict';
  const TL = root.TL;
  const H = TL.esc;
  const API = 'https://api.github.com';

  /* ---------------- 提示 ---------------- */
  let toastTimer = null;
  TL.toast = function (msg, ms) {
    const el = document.getElementById('toast');
    if (!el) return;
    el.textContent = msg;
    el.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { el.classList.remove('show'); }, ms || 2400);
  };

  /* ---------------- 通用弹窗 ---------------- */
  TL.modal = function (opt) {
    const box = document.getElementById('modal');
    document.getElementById('modalTitle').textContent = opt.title || '提示';
    document.getElementById('modalBody').innerHTML = opt.body || '';
    const foot = document.getElementById('modalFoot');
    foot.innerHTML = '';
    const actions = opt.actions || [{ t: '知道了', v: true, primary: true }];
    const close = function (val) {
      box.hidden = true;
      if (opt.resolve) opt.resolve(val);
    };
    actions.forEach(function (a) {
      const b = document.createElement('button');
      b.className = 'btn' + (a.primary ? ' primary' : '') + (a.danger ? ' danger' : '');
      b.textContent = a.t;
      b.onclick = function () { close(a.v); };
      foot.appendChild(b);
    });
    box.hidden = false;
    box.onclick = function (e) { if (e.target === box) close(false); };
  };

  TL.confirm = function (title, body, okText, danger) {
    return new Promise(function (resolve) {
      TL.modal({
        title: title,
        body: body,
        actions: [
          { t: '取消', v: false },
          { t: okText || '确定', v: true, primary: !danger, danger: danger }
        ],
        resolve: resolve
      });
    });
  };

  TL.alert = function (title, body) {
    return new Promise(function (resolve) {
      TL.modal({ title: title, body: body, actions: [{ t: '知道了', v: true, primary: true }], resolve: resolve });
    });
  };

  /* ---------------- base64（UTF-8 安全） ---------------- */
  function b64encode(str) {
    const bytes = new TextEncoder().encode(str);
    let bin = '';
    const chunk = 0x8000;
    for (let i = 0; i < bytes.length; i += chunk) {
      bin += String.fromCharCode.apply(null, bytes.subarray(i, i + chunk));
    }
    return btoa(bin);
  }

  function b64decode(b64) {
    const clean = String(b64 || '').replace(/[\r\n\s]/g, '');
    const bin = atob(clean);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return new TextDecoder('utf-8').decode(bytes);
  }

  /* ---------------- GitHub API ---------------- */
  async function gh(method, path, body) {
    const token = TL.getToken();
    if (!token) throw new Error('NO_TOKEN');
    const opt = {
      method: method,
      headers: {
        'Accept': 'application/vnd.github+json',
        'Authorization': 'Bearer ' + token,
        'X-GitHub-Api-Version': '2022-11-28'
      },
      cache: 'no-store'
    };
    if (body) {
      opt.headers['Content-Type'] = 'application/json';
      opt.body = JSON.stringify(body);
    }
    const res = await fetch(API + path, opt);
    let data = null;
    const text = await res.text();
    try { data = text ? JSON.parse(text) : null; } catch (e) { data = { raw: text }; }
    if (!res.ok) {
      const err = new Error((data && data.message) || ('HTTP ' + res.status));
      err.status = res.status;
      err.data = data;
      throw err;
    }
    return data;
  }

  function repoPath() {
    const s = TL.DB.settings;
    return '/repos/' + encodeURIComponent(s.owner) + '/' + encodeURIComponent(s.repo) + '/contents/' +
      String(s.path || 'journal.json').split('/').map(encodeURIComponent).join('/');
  }

  function errText(e) {
    if (e.message === 'NO_TOKEN') return '还没有填写 Token。到「设置 → GitHub 同步」粘贴一个 Token。';
    if (e.status === 401) return 'Token 无效或已过期（401）。重新生成一个再粘贴。';
    if (e.status === 403) return 'Token 没有这个仓库的权限（403）。检查 Fine-grained Token 是否授权了数据仓库的 Contents: Read and write。';
    if (e.status === 404) return '找不到仓库或文件（404）。检查用户名 / 仓库名 / 分支 / 路径是否正确，私有仓库需要 Token 有权限。';
    if (e.status === 409) return '云端文件已更新（409 冲突）。先点「拉取」把最新数据取回来，再重新上传。';
    return (e.message || '未知错误') + (e.status ? '（HTTP ' + e.status + '）' : '');
  }

  /* ---------------- 连接状态 ---------------- */
  TL.updateSyncUI = function () {
    const el = document.getElementById('syncText');
    if (!el) return;
    const s = TL.DB.settings;
    const has = !!TL.getToken();
    el.textContent = has ? ('已连接 · ' + s.owner + '/' + s.repo) : '本地模式';
    el.title = has ? (s.owner + '/' + s.repo + ' · ' + s.path) : '未配置 Token，数据只存在本机浏览器';
  };

  /* ---------------- 拉取 ---------------- */
  TL.pull = async function (silent) {
    if (!TL.getToken()) {
      TL.alert('未配置 Token', '要先在「设置 → GitHub 同步」填一个 Token，才能从云端拉取。<br><br>如果只是想换电脑，也可以直接用「导出 / 导入 JSON」。');
      return false;
    }
    try {
      TL.toast('正在从 GitHub 拉取…');
      const info = await gh('GET', repoPath() + '?ref=' + encodeURIComponent(TL.DB.settings.branch || 'main'));
      if (!info || !info.content) {
        TL.alert('云端没有数据文件', '仓库里还没有 ' + H(TL.DB.settings.path) + '，先在这台电脑点一次「上传」。');
        return false;
      }
      const json = b64decode(info.content);
      let remote;
      try { remote = JSON.parse(json); } catch (e) {
        TL.alert('数据格式错误', '云端文件不是合法 JSON，可能是手动改坏了。可以到 GitHub 提交记录里找回上一版。');
        return false;
      }
      const remoteDays = Object.keys(remote.days || {}).length;
      const localDays = TL.dayCount();

      if (!silent && localDays > 0) {
        const ok = await TL.confirm('用云端数据覆盖本地？', 
          '<div style="line-height:1.9">本机：<b>' + localDays + '</b> 天的记录，更新于 ' + H(TL.DB.updatedAt || '—') + '<br>' +
          '云端：<b>' + remoteDays + '</b> 天的记录，更新于 ' + H(remote.updatedAt || '—') + '</div>' +
          '<div style="margin-top:10px;color:var(--muted)">覆盖后本机数据会变成云端版本，上传前的本地版本仍可在「本地快照」里恢复。</div>',
          '用云端覆盖');
        if (!ok) return false;
      }

      TL.pushSnapshot('拉取前快照');
      TL.DB = TL.migrate(remote);
      TL.save(true);
      TL.markDirty(false);
      const meta = TL.getMeta();
      meta.lastPull = TL.nowStamp();
      TL.setMeta(meta);
      TL.render();
      if (!silent) TL.toast('拉取成功：' + TL.dayCount() + ' 天记录');
      return true;
    } catch (e) {
      TL.alert('拉取失败', errText(e));
      return false;
    }
  };

  /* ---------------- 上传 ---------------- */
  let pushing = false;
  TL.push = async function (silent) {
    if (!TL.getToken()) {
      TL.alert('未配置 Token', '要先在「设置 → GitHub 同步」填一个 Token，才能把数据存到 GitHub。<br><br>不填也能用，数据只存在这台电脑，用「导出 JSON」备份。');
      return false;
    }
    if (pushing) { TL.toast('正在上传中…'); return false; }
    pushing = true;
    try {
      TL.toast('正在上传…');
      let sha = null;
      try {
        const info = await gh('GET', repoPath() + '?ref=' + encodeURIComponent(TL.DB.settings.branch || 'main'));
        if (info && info.sha) sha = info.sha;
      } catch (e) {
        if (e.status !== 404) throw e;
      }

      TL.pushSnapshot('上传前快照 ' + TL.dayCount() + ' 天');

      const payload = JSON.stringify(TL.DB, null, 1);
      const body = {
        message: 'chore: sync ' + TL.UI.date + ' · ' + TL.dayCount() + ' 天记录 (' + TL.nowStamp() + ')',
        content: b64encode(payload),
        branch: TL.DB.settings.branch || 'main'
      };
      if (sha) body.sha = sha;

      await gh('PUT', repoPath(), body);
      TL.markDirty(false);
      const meta = TL.getMeta();
      meta.lastPush = TL.nowStamp();
      TL.setMeta(meta);
      TL.updateSyncUI();
      const fm = document.getElementById('footMeta');
      if (fm) fm.textContent = '共 ' + TL.dayCount() + ' 个交易日 · 数据更新于 ' + (TL.DB.updatedAt || '—');
      TL.toast('已上传到 GitHub（' + TL.dayCount() + ' 天记录）');
      return true;
    } catch (e) {
      if (silent) TL.toast('自动上传失败：' + errText(e), 4000);
      else TL.alert('上传失败', errText(e));
      return false;
    } finally {
      pushing = false;
    }
  };

  /* ---------------- 测试连接 ---------------- */
  TL.testConn = async function () {
    if (!TL.getToken()) { TL.alert('未配置 Token', '先粘贴一个 Token 再测试。'); return; }
    try {
      const s = TL.DB.settings;
      const info = await gh('GET', '/repos/' + encodeURIComponent(s.owner) + '/' + encodeURIComponent(s.repo));
      let fileState = '文件还不存在（第一次上传会自动创建）';
      try {
        const f = await gh('GET', repoPath() + '?ref=' + encodeURIComponent(s.branch || 'main'));
        fileState = '数据文件已存在（' + Math.round((f.size || 0) / 1024 * 10) / 10 + ' KB）';
      } catch (e) {
        if (e.status !== 404) fileState = '读取文件失败：' + errText(e);
      }
      TL.alert('连接正常',
        '<div style="line-height:1.9">' +
        '仓库：<b>' + H(info.full_name) + '</b>（' + (info.private ? '私有' : '<span style="color:var(--up)">公开</span>') + '）<br>' +
        '默认分支：' + H(info.default_branch) + '<br>' +
        '数据文件：' + H(fileState) + '</div>' +
        (info.private ? '' : '<div style="margin-top:8px;color:var(--up)">注意：这个仓库是公开的，你的交易记录会被人看到，建议换成私有仓库。</div>'));
    } catch (e) {
      TL.alert('连接失败', errText(e));
    }
  };

  /* ---------------- 导出 JSON ---------------- */
  function download(filename, content, mime) {
    const blob = new Blob([content], { type: mime || 'application/octet-stream' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
  }
  TL.download = download;

  TL.exportJSON = function () {
    const name = 'liang-trade-log-' + TL.todayStr().replace(/-/g, '') + '.json';
    download(name, JSON.stringify(TL.DB, null, 1), 'application/json');
    TL.toast('已导出 ' + name);
  };

  TL.importJSON = function () {
    const input = document.getElementById('fileInput');
    if (!input) return;
    input.value = '';
    input.onchange = function () {
      const f = input.files && input.files[0];
      if (!f) return;
      const reader = new FileReader();
      reader.onload = async function () {
        try {
          const obj = JSON.parse(String(reader.result));
          if (!obj || typeof obj !== 'object' || !obj.days) throw new Error('bad');
          const n = Object.keys(obj.days).length;
          const ok = await TL.confirm('导入这份数据？',
            '文件里有 <b>' + n + '</b> 天记录' + (obj.updatedAt ? '，更新于 ' + H(obj.updatedAt) : '') + '。<br>' +
            '导入会覆盖本机现在的 <b>' + TL.dayCount() + '</b> 天记录（上传前的版本仍可在「本地快照」恢复）。',
            '导入并覆盖');
          if (!ok) return;
          TL.pushSnapshot('导入前快照');
          TL.DB = TL.migrate(obj);
          TL.save(true);
          TL.markDirty(true);
          TL.render();
          TL.toast('导入成功：' + TL.dayCount() + ' 天记录');
        } catch (e) {
          TL.alert('导入失败', '这个文件不是本记录本导出的 JSON，或者内容损坏了。');
        }
      };
      reader.readAsText(f, 'utf-8');
    };
    input.click();
  };

  /* ---------------- 导出 CSV ---------------- */
  function csvCell(v) {
    const s = String(v == null ? '' : v);
    return /[",\n\r]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
  }

  function toCSV(headers, rows) {
    const lines = [headers.map(csvCell).join(',')];
    rows.forEach(function (r) { lines.push(r.map(csvCell).join(',')); });
    return '\ufeff' + lines.join('\r\n');
  }

  TL.exportTradesCSV = function () {
    const rows = TL.allTrades().map(function (t) {
      return [
        t.date, TL.symbolLabel(t.symbol), t.direction === 'short' ? '空' : '多',
        t.entry, t.exit, t.lots, t.pnl,
        t.aligned === 'yes' ? '一致' : (t.aligned === 'no' ? '不一致' : ''),
        t.signalOk === 'yes' ? '按信号' : (t.signalOk === 'no' ? '违规' : ''),
        t.note || ''
      ];
    });
    if (!rows.length) { TL.toast('还没有成交记录'); return; }
    download('trades-' + TL.todayStr().replace(/-/g, '') + '.csv',
      toCSV(['日期', '品种', '方向', '开仓价', '平仓价', '手数', '盈亏', '与老师一致', '按信号执行', '备注'], rows), 'text/csv');
    TL.toast('已导出成交 CSV');
  };

  TL.exportRotationCSV = function () {
    const rows = [];
    Object.keys(TL.DB.days).sort().forEach(function (date) {
      const d = TL.DB.days[date];
      const r = d.review || {};
      const t = d.evening.theme || {};
      const sector = r.rotSector || t.mainSector || '';
      const strong = r.rotStrong || t.strongest || '';
      const weak = r.rotWeak || t.weakest || '';
      if (!sector && !strong && !weak && !r.rotNote) return;
      rows.push([date, sector, strong, weak, t.turning || '', r.rotNote || '', TL.computeStats(d.trades || []).total]);
    });
    if (!rows.length) { TL.toast('还没有板块轮动记录'); return; }
    download('rotation-' + TL.todayStr().replace(/-/g, '') + '.csv',
      toCSV(['日期', '主线板块', '最强', '最弱', '由弱转强', '老师核心提醒', '当日盈亏'], rows), 'text/csv');
    TL.toast('已导出轮动 CSV');
  };

  /* ---------------- 打印一页纸 ---------------- */
  TL.buildPrint = function () {
    const date = TL.UI.date;
    const day = TL.day(date, false) || TL.defaultDay(date);
    const e = day.evening;
    const it = day.intraday;
    const st = TL.DB.settings;
    const trendMap = { '多头': '多头排列', '空头': '空头排列', '震荡': '震荡' };

    let h = '<h1>每日交易执行清单</h1>' +
      '<div class="p-sub">' + H(date) + ' ' + TL.weekday(date) +
      ' &nbsp;|&nbsp; 文华指数：' + H(trendMap[e.indexTrend] || '＿＿＿') +
      ' &nbsp;|&nbsp; 主线板块：' + H(e.theme.mainSector || '＿＿＿') +
      ' &nbsp;|&nbsp; 观察品种：' + H(e.watch.length ? e.watch.map(TL.symbolLabel).join('、') : '＿＿＿') +
      '</div>';

    /* 一、条件单 */
    h += '<h2>一、今晚定的条件单（只执行这些，不临时改）</h2>';
    h += '<table><thead><tr><th style="width:19%">品种</th><th style="width:9%">方向</th><th>触发信号</th><th style="width:21%">止损</th><th style="width:8%">手数</th><th style="width:13%">风险(元)</th></tr></thead><tbody>';
    if (e.orders.length) {
      e.orders.forEach(function (o) {
        h += '<tr><td>' + H(TL.symbolLabel(o.symbol) || '—') + '</td><td>' + (o.direction === 'short' ? '空' : '多') + '</td>' +
          '<td>' + H(o.trigger || '') + '</td><td>' + H(o.stop || '') + '</td>' +
          '<td>' + H(o.lots || '') + '</td><td>' + H(o.risk || '') + '</td></tr>';
      });
    } else {
      for (let i = 0; i < 3; i++) h += '<tr><td>&nbsp;</td><td></td><td></td><td></td><td></td><td></td></tr>';
    }
    h += '</tbody></table>';

    /* 持仓 */
    h += '<h2>二、持仓检查（移动止损 / 平仓条件）</h2>';
    h += '<table><thead><tr><th style="width:22%">品种</th><th style="width:16%">持仓均价</th><th style="width:12%">手数</th><th style="width:18%">移动止损价</th><th>动作</th></tr></thead><tbody>';
    if (e.positions.length) {
      e.positions.forEach(function (p) {
        const act = p.exitHit ? '次日平仓（收盘破 20 均线）' : (p.moveStop ? '止损上移到成本价（浮盈≥2R）' : '持有观察');
        h += '<tr><td>' + H(TL.symbolLabel(p.symbol) || '—') + '</td><td>' + H(p.avgPrice || '') + '</td><td>' + H(p.lots || '') +
          '</td><td>' + H(p.stop || '') + '</td><td>' + H(act) + '</td></tr>';
      });
    } else {
      h += '<tr><td colspan="5">当前无持仓</td></tr>';
    }
    h += '</tbody></table>';

    /* 盘中打卡 */
    h += '<h2>三、次日盘中打卡（只看 3 次，每次 5 分钟）</h2>';
    h += '<table><thead><tr><th style="width:26%">品种</th><th>10:00</th><th>13:30</th><th>14:15</th></tr></thead><tbody>';
    const syms = e.watch.length ? e.watch : ['', '', ''];
    syms.forEach(function (sym) {
      h += '<tr><td>' + H(TL.symbolLabel(sym) || '&nbsp;') + '</td><td>&nbsp;</td><td>&nbsp;</td><td>&nbsp;</td></tr>';
    });
    h += '</tbody></table>';
    h += '<div style="margin-top:2mm;font-size:9pt">信号出现 → 按昨晚的止损和仓位执行，不临时改 ｜ 信号没出现 → 不动 ｜ 日报和系统冲突 → 以系统为准 ｜ ' + H(st.noNewAfter) + ' 后不开新仓</div>';

    /* 盘后复盘 */
    h += '<h2>四、盘后复盘（16:00–16:15）</h2>';
    h += '<div class="two">' +
      '<div>1. 老师昨日最强（' + H(e.theme.strongest || '＿＿') + '）今日走势：<div class="box"></div></div>' +
      '<div>2. 等信号的品种，今天出了吗？我抓到了吗？<div class="box"></div></div>' +
      '</div>' +
      '<div class="two" style="margin-top:3mm">' +
      '<div>3. 「远离均线不要追」验证：<div class="box"></div></div>' +
      '<div>4. 我的信号 vs 老师判断（一致 / 不一致 → 结果）：<div class="box"></div></div>' +
      '</div>' +
      '<div style="margin-top:3mm">5. 板块轮动：主线 <span class="fill"></span> 最强 <span class="fill"></span> 最弱 <span class="fill"></span></div>' +
      '<div class="box" style="min-height:22mm">复盘笔记（1–2 条）</div>';

    /* 速查 */
    h += '<h2>五、一页纸速查</h2>' +
      '<table><thead><tr><th style="width:26%">时段</th><th style="width:32%">做什么</th><th>一句话标准</th></tr></thead><tbody>' +
      '<tr><td>收盘后 15 分钟</td><td>筛 2–3 个品种 + 写条件单</td><td>日线多头 + 靠近均线 + 15 分钟粘合</td></tr>' +
      '<tr><td>次日 10:00 / 13:30 / 14:15</td><td>看有没有信号</td><td>有 → 执行；没有 → 不动</td></tr>' +
      '<tr><td>收盘后 15 分钟</td><td>对照复盘 + 记轮动表</td><td>一致 / 不一致，各记一笔</td></tr>' +
      '<tr><td>周日 30 分钟</td><td>统计 + 检查纪律</td><td>胜率、盈亏比、有没有违规</td></tr>' +
      '<tr><td>月底 1 小时</td><td>统计 + 调整</td><td>连续 3 亏暂停，胜率高维持</td></tr>' +
      '</tbody></table>' +
      '<div style="margin-top:4mm;font-size:9pt;text-align:center">当晚筛品种写条件，次日只等触发，盘后对照记一笔。日报是参考答案，你的系统是答题规则。</div>';

    return h;
  };

  TL.printToday = function () {
    document.getElementById('printArea').innerHTML = TL.buildPrint();
    window.print();
  };

})(window);
