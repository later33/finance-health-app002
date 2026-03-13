/* ============================================================
   js/quick-entry.js · 悬浮快速记账按钮（全页面通用）
   依赖：finance.js (CF_INCOME_CATS, CF_EXPENSE_CATS, fmt)
         supabase.js (dbAddCashflow, getUser)
   ============================================================ */

(function () {
  // ── 如果当前页面是 cashflow.html，直接复用已有 modal ──────
  const isCashflow = location.pathname.includes('cashflow');

  // ── CSS 注入 ──────────────────────────────────────────────
  const style = document.createElement('style');
  style.textContent = `
    /* ── 悬浮按钮 ── */
    .qe-fab {
      position: fixed;
      bottom: 94px;          /* 导航栏高度80px + 14px间距 */
      right: 24px;
      width: 52px;
      height: 52px;
      border-radius: 50%;
      background: var(--accent);
      color: #0a0a0e;
      border: none;
      font-size: 26px;
      font-weight: 300;
      line-height: 1;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      box-shadow: 0 4px 20px rgba(200,240,80,0.35), 0 2px 8px rgba(0,0,0,0.4);
      z-index: 80;
      transition: transform 0.2s cubic-bezier(0.34,1.56,0.64,1), opacity 0.15s, box-shadow 0.2s;
    }
    .qe-fab:hover  { box-shadow: 0 6px 28px rgba(200,240,80,0.5), 0 2px 8px rgba(0,0,0,0.4); }
    .qe-fab:active { transform: scale(0.9); }
    .qe-fab.open   { transform: rotate(45deg); }

    /* ── 弹窗遮罩 ── */
    .qe-overlay {
      display: none;
      position: fixed;
      inset: 0;
      background: rgba(0,0,0,0.72);
      z-index: 110;
      align-items: flex-end;
      justify-content: center;
      backdrop-filter: blur(3px);
      -webkit-backdrop-filter: blur(3px);
    }
    .qe-overlay.open { display: flex; }

    /* ── 弹窗主体 ── */
    .qe-modal {
      width: 375px;
      max-width: 100vw;
      background: var(--surface2, #141418);
      border-radius: 28px 28px 0 0;
      padding: 0 22px 40px;
      transform: translateY(100%);
      transition: transform 0.36s cubic-bezier(0.32,0.72,0,1);
      max-height: 88vh;
      overflow-y: auto;
    }
    .qe-overlay.open .qe-modal { transform: translateY(0); }

    .qe-handle {
      width: 36px; height: 4px;
      background: rgba(255,255,255,0.1);
      border-radius: 2px;
      margin: 12px auto 16px;
    }

    /* ── 类型切换 ── */
    .qe-type-row {
      display: flex; gap: 8px; margin-bottom: 18px;
    }
    .qe-type-btn {
      flex: 1; height: 40px; border-radius: 12px; border: 1.5px solid var(--border, rgba(255,255,255,0.07));
      background: var(--surface, rgba(255,255,255,0.04));
      color: var(--text-muted, rgba(240,240,248,0.45));
      font-size: 14px; font-weight: 600; font-family: inherit;
      cursor: pointer; transition: all 0.15s;
    }
    .qe-type-btn.income-active  { background: rgba(92,240,176,0.12); border-color: #5cf0b0; color: #5cf0b0; }
    .qe-type-btn.expense-active { background: rgba(200,240,80,0.1);  border-color: #c8f050; color: #c8f050; }

    /* ── 分类网格 ── */
    .qe-cat-grid {
      display: grid;
      grid-template-columns: repeat(4,1fr);
      gap: 7px;
      margin-bottom: 16px;
    }
    .qe-cat-btn {
      background: var(--surface, rgba(255,255,255,0.04));
      border: 1.5px solid var(--border, rgba(255,255,255,0.07));
      border-radius: 12px;
      padding: 9px 4px 7px;
      display: flex; flex-direction: column;
      align-items: center; gap: 4px;
      cursor: pointer; transition: all 0.15s;
    }
    .qe-cat-btn.selected { border-color: var(--accent, #c8f050); background: rgba(200,240,80,0.08); }
    .qe-cat-btn:active   { transform: scale(0.92); }
    .qe-cat-icon  { font-size: 19px; }
    .qe-cat-label { font-size: 9px; color: var(--text-muted, rgba(240,240,248,0.45)); }

    /* ── 输入字段 ── */
    .qe-field { margin-bottom: 13px; }
    .qe-field label {
      display: block; font-size: 11px;
      color: var(--text-muted, rgba(240,240,248,0.45));
      margin-bottom: 5px; letter-spacing: 0.03em;
    }
    .qe-input-wrap { position: relative; }
    .qe-prefix {
      position: absolute; left: 14px; top: 50%;
      transform: translateY(-50%);
      color: var(--text-muted, rgba(240,240,248,0.45));
      font-size: 15px;
    }
    .qe-input {
      width: 100%; height: 50px;
      background: var(--surface, rgba(255,255,255,0.04));
      border: 1.5px solid var(--border, rgba(255,255,255,0.07));
      border-radius: 14px;
      padding: 0 14px 0 30px;
      font-size: 18px; font-weight: 700;
      font-family: inherit; color: var(--text, #f0f0f8);
      outline: none; transition: border-color 0.15s;
    }
    .qe-input:focus { border-color: var(--accent, #c8f050); }
    .qe-input::placeholder { color: var(--text-muted, rgba(240,240,248,0.45)); font-weight: 400; font-size: 15px; }
    .qe-input-plain {
      width: 100%; height: 46px;
      background: var(--surface, rgba(255,255,255,0.04));
      border: 1.5px solid var(--border, rgba(255,255,255,0.07));
      border-radius: 14px;
      padding: 0 14px; font-size: 14px;
      font-family: inherit; color: var(--text, #f0f0f8);
      outline: none; transition: border-color 0.15s;
    }
    .qe-input-plain:focus { border-color: var(--accent, #c8f050); }
    .qe-input-plain::placeholder { color: var(--text-muted, rgba(240,240,248,0.45)); }
    .qe-select {
      width: 100%; height: 46px;
      background: var(--surface, rgba(255,255,255,0.04));
      border: 1.5px solid var(--border, rgba(255,255,255,0.07));
      border-radius: 14px;
      padding: 0 14px; font-size: 13px;
      font-family: inherit; color: var(--text, #f0f0f8);
      outline: none; appearance: none;
      background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='8' viewBox='0 0 12 8'%3E%3Cpath d='M1 1l5 5 5-5' stroke='rgba(240,240,248,0.35)' stroke-width='1.5' fill='none' stroke-linecap='round'/%3E%3C/svg%3E");
      background-repeat: no-repeat;
      background-position: right 14px center;
      cursor: pointer;
    }

    /* ── 保存按钮 ── */
    .qe-save-btn {
      width: 100%; height: 52px; border: none; border-radius: 16px;
      font-size: 16px; font-weight: 700; font-family: inherit;
      cursor: pointer; margin-top: 4px;
      transition: transform 0.12s, opacity 0.12s;
    }
    .qe-save-btn.income  { background: #5cf0b0; color: #071a10; }
    .qe-save-btn.expense { background: var(--accent, #c8f050); color: #0a0a0e; }
    .qe-save-btn:active  { transform: scale(0.97); opacity: 0.9; }
    .qe-save-btn:disabled { opacity: 0.5; cursor: not-allowed; }

    /* ── toast 提示 ── */
    .qe-toast {
      position: fixed; bottom: 110px; left: 50%; transform: translateX(-50%) translateY(10px);
      background: var(--surface2, #141418); border: 1px solid rgba(255,255,255,0.1);
      border-radius: 20px; padding: 10px 20px;
      font-size: 13px; color: var(--text, #f0f0f8);
      z-index: 200; opacity: 0;
      transition: opacity 0.2s, transform 0.2s;
      white-space: nowrap; pointer-events: none;
    }
    .qe-toast.show { opacity: 1; transform: translateX(-50%) translateY(0); }
  `;
  document.head.appendChild(style);

  // ── 工具函数 ──────────────────────────────────────────────
  function allMonths() {
    const months = [];
    const now = new Date();
    for (let i = 11; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      months.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
    }
    return months;
  }
  function fmtMonthLabel(ym) {
    if (!ym) return '—';
    const [y, m] = ym.split('-');
    return `${y}年 ${parseInt(m)}月`;
  }

  // ── toast ─────────────────────────────────────────────────
  function showToast(msg) {
    let t = document.querySelector('.qe-toast');
    if (!t) { t = document.createElement('div'); t.className = 'qe-toast'; document.body.appendChild(t); }
    t.textContent = msg;
    t.classList.add('show');
    setTimeout(() => t.classList.remove('show'), 2000);
  }

  // ── 注入 HTML ─────────────────────────────────────────────
  // FAB 按钮
  const fab = document.createElement('button');
  fab.className = 'qe-fab';
  fab.innerHTML = '+';
  fab.title = '快速记账';
  document.body.appendChild(fab);

  // 如果是 cashflow 页面，直接复用已有 modal
  if (isCashflow) {
    fab.addEventListener('click', () => {
      if (typeof openModal === 'function') openModal('expense');
    });
    return; // 不再注入新 modal
  }

  // 其他页面注入独立 modal
  const overlay = document.createElement('div');
  overlay.className = 'qe-overlay';
  overlay.id = 'qe-overlay';
  overlay.innerHTML = `
    <div class="qe-modal">
      <div class="qe-handle"></div>

      <div class="qe-type-row">
        <button class="qe-type-btn" id="qe-income-btn">＋ 收入</button>
        <button class="qe-type-btn expense-active" id="qe-expense-btn">－ 支出</button>
      </div>

      <div class="qe-field">
        <label>分类</label>
        <div class="qe-cat-grid" id="qe-cat-grid"></div>
      </div>

      <div class="qe-field">
        <label>备注（可选）</label>
        <input class="qe-input-plain" id="qe-name" type="text" placeholder="如：午饭、地铁" maxlength="20">
      </div>

      <div class="qe-field">
        <label>金额（元）</label>
        <div class="qe-input-wrap">
          <span class="qe-prefix">¥</span>
          <input class="qe-input" id="qe-amount" type="number" placeholder="0" min="0" inputmode="decimal">
        </div>
      </div>

      <div class="qe-field">
        <label>所属月份</label>
        <select class="qe-select" id="qe-month"></select>
      </div>

      <button class="qe-save-btn expense" id="qe-save-btn">保存支出</button>
    </div>`;
  document.body.appendChild(overlay);

  // ── 状态 ──────────────────────────────────────────────────
  let qeType = 'expense';
  let qeCat  = '';

  // ── 初始化月份下拉 ────────────────────────────────────────
  function initMonthSelect() {
    const sel = document.getElementById('qe-month');
    sel.innerHTML = '';
    const now = new Date();
    const cur = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    allMonths().reverse().forEach(m => {
      const opt = document.createElement('option');
      opt.value = m;
      opt.textContent = fmtMonthLabel(m);
      if (m === cur) opt.selected = true;
      sel.appendChild(opt);
    });
  }

  // ── 渲染分类网格 ──────────────────────────────────────────
  function renderCatGrid(type) {
    const grid = document.getElementById('qe-cat-grid');
    grid.innerHTML = '';
    const cats = type === 'income' ? CF_INCOME_CATS : CF_EXPENSE_CATS;
    qeCat = cats[0].id;
    cats.forEach((cat, i) => {
      const el = document.createElement('div');
      el.className = 'qe-cat-btn' + (i === 0 ? ' selected' : '');
      el.innerHTML = `<span class="qe-cat-icon">${cat.icon}</span><span class="qe-cat-label">${cat.label}</span>`;
      el.addEventListener('click', () => {
        qeCat = cat.id;
        grid.querySelectorAll('.qe-cat-btn').forEach(b => b.classList.remove('selected'));
        el.classList.add('selected');
      });
      grid.appendChild(el);
    });
  }

  // ── 切换类型 ──────────────────────────────────────────────
  function setType(type) {
    qeType = type;
    const incBtn = document.getElementById('qe-income-btn');
    const expBtn = document.getElementById('qe-expense-btn');
    const saveBtn = document.getElementById('qe-save-btn');
    incBtn.className = 'qe-type-btn' + (type === 'income'  ? ' income-active'  : '');
    expBtn.className = 'qe-type-btn' + (type === 'expense' ? ' expense-active' : '');
    saveBtn.className = 'qe-save-btn ' + type;
    saveBtn.textContent = type === 'income' ? '保存收入' : '保存支出';
    renderCatGrid(type);
  }

  document.getElementById('qe-income-btn').addEventListener('click',  () => setType('income'));
  document.getElementById('qe-expense-btn').addEventListener('click', () => setType('expense'));

  // ── 打开 / 关闭 modal ─────────────────────────────────────
  function openQE() {
    initMonthSelect();
    setType('expense');
    document.getElementById('qe-name').value   = '';
    document.getElementById('qe-amount').value = '';
    overlay.classList.add('open');
    fab.classList.add('open');
    setTimeout(() => document.getElementById('qe-amount').focus(), 360);
  }
  function closeQE() {
    overlay.classList.remove('open');
    fab.classList.remove('open');
  }

  fab.addEventListener('click', openQE);
  overlay.addEventListener('click', e => { if (e.target === overlay) closeQE(); });

  // ── 保存 ──────────────────────────────────────────────────
  document.getElementById('qe-save-btn').addEventListener('click', async () => {
    const amount = parseFloat(document.getElementById('qe-amount').value);
    if (!amount || amount <= 0) {
      document.getElementById('qe-amount').focus();
      document.getElementById('qe-amount').style.borderColor = 'var(--warn)';
      setTimeout(() => document.getElementById('qe-amount').style.borderColor = '', 1200);
      return;
    }
    const name  = document.getElementById('qe-name').value.trim();
    const month = document.getElementById('qe-month').value;
    const cat   = typeof getCfCat === 'function' ? getCfCat(qeType, qeCat) : { icon: '💰' };

    const btn = document.getElementById('qe-save-btn');
    btn.disabled = true;
    btn.textContent = '保存中…';

    const result = await dbAddCashflow({
      type:     qeType,
      category: qeCat,
      name:     name || (typeof getCfCat === 'function' ? getCfCat(qeType, qeCat).label : qeCat),
      amount:   amount,
      icon:     cat.icon || '💰',
      date:     month,
    });

    btn.disabled = false;

    if (result) {
      closeQE();
      const typeLabel = qeType === 'income' ? '收入' : '支出';
      showToast(`✅ 已记录 ${typeLabel} ¥${amount}`);
    } else {
      btn.textContent = qeType === 'income' ? '保存收入' : '保存支出';
      showToast('❌ 保存失败，请重试');
    }
  });

})();
