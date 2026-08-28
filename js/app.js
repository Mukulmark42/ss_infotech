/**
 * ═══════════════════════════════════════════════════════════
 * APP.JS – Main Application Controller (MVC)
 * Handles navigation, wizard, income computation, client DB,
 * admin panel, chart, and report generation.
 * ═══════════════════════════════════════════════════════════
 */

const App = (() => {

  // ── State ──────────────────────────────────────────────────
  let currentStep   = 1;
  const TOTAL_STEPS = 5;
  let banks         = [];
  let selectedIncome = { savings: true, stcg: false, pl: false, bs: false };
  let selectedReport = 'classic';
  let editingClientId = null;
  let activePrintData = null;
  let chartAY = null;

  // ── Init ───────────────────────────────────────────────────
  function init() {
    _bindNav();
    _bindTheme();
    _bindSidebar();
    _initBanks();
    _initBankAutocomplete();
    navTo('dashboard');
    _refreshDashboard();
    _initAdminPanel();
  }

  // ── Navigation ─────────────────────────────────────────────
  function navTo(page) {
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
    const el = document.getElementById(`page-${page}`);
    if (el) el.classList.add('active');
    const nav = document.querySelector(`.nav-item[data-page="${page}"]`);
    if (nav) nav.classList.add('active');
    const topTitleEl = document.getElementById('topbarTitleText');
    if (topTitleEl) topTitleEl.textContent = _pageTitle(page);
    const topIconEl = document.querySelector('.topbar-page-icon i');
    if (topIconEl) topIconEl.className = `bi ${_pageIcon(page)}`;

    if (page === 'clients')    _renderClientTable();
    if (page === 'dashboard')  _refreshDashboard();
    if (page === 'new-computation') _resetWizard();
    if (page === 'salary-slip') _initSlipPage();
    if (page === 'bank-statement') {
      setBankStatementPersona(_currentStatementPersona);
    }
    if (page === 'admin') _initAdminPanel();
  }

  function _bindNav() {
    document.querySelectorAll('.nav-item').forEach(n => {
      n.addEventListener('click', e => {
        e.preventDefault();
        navTo(n.dataset.page);
      });
    });
  }

  function _bindSidebar() {
    const btn = document.getElementById('sidebarToggle');
    const sb  = document.getElementById('sidebar');
    const mw  = document.querySelector('.main-wrapper');
    if (btn) {
      btn.addEventListener('click', () => {
        sb.classList.toggle('open');
        sb.classList.toggle('collapsed');
        mw.classList.toggle('sidebar-collapsed');
        
        const overlay = document.getElementById('sidebarOverlay');
        if(overlay) overlay.classList.toggle('active');
      });
    }
  }

  function _pageTitle(page) {
    return { dashboard: 'Dashboard', 'new-computation': 'New Computation', clients: 'Client Database', admin: 'Admin Panel', 'salary-slip': 'Salary Slip', 'bank-statement': 'Bank Statement' }[page] || page;
  }

  function _pageIcon(page) {
    return { dashboard: 'bi-grid-1x2-fill', 'new-computation': 'bi-file-earmark-plus-fill', clients: 'bi-people-fill', admin: 'bi-sliders', 'salary-slip': 'bi-file-earmark-person-fill', 'bank-statement': 'bi-bank' }[page] || 'bi-circle-fill';
  }

  // ── Theme ──────────────────────────────────────────────────
  function _bindTheme() {
    const t = document.getElementById('themeToggle');
    if (!t) return;
    const saved = localStorage.getItem('theme') || 'light';
    document.documentElement.setAttribute('data-theme', saved);
    t.addEventListener('click', () => {
      const current = document.documentElement.getAttribute('data-theme');
      const next = current === 'dark' ? 'light' : 'dark';
      document.documentElement.setAttribute('data-theme', next);
      localStorage.setItem('theme', next);
    });
  }

  // ── Wizard ─────────────────────────────────────────────────
  function _resetWizard() {
    currentStep = 1;
    banks = [{ id: _uid(), name: '', accountNo: '', ifsc: '', type: 'SB', primary: true }];
    editingClientId = null;
    selectedIncome = { savings: true, stcg: false, pl: false, bs: true };
    selectedReport = 'classic';
    _renderBanks();
    _renderIncomeInputs();
    _renderBalanceSheet();
    _goToStep(1);
    _clearForm();
  }

  function nextStep() {
    if (!_validateStep(currentStep)) return;
    if (currentStep < TOTAL_STEPS) {
      currentStep++;
      _goToStep(currentStep);
    }
  }

  function prevStep() {
    if (currentStep > 1) {
      currentStep--;
      _goToStep(currentStep);
    }
  }

  function _goToStep(step) {
    document.querySelectorAll('.wizard-panel').forEach(p => p.classList.remove('active'));
    document.querySelectorAll('.step').forEach(s => {
      const n = parseInt(s.dataset.step);
      s.classList.remove('active', 'done');
      if (n === step) s.classList.add('active');
      if (n < step)  s.classList.add('done');
    });
    const panel = document.getElementById(`step-panel-${step}`);
    if (panel) panel.classList.add('active');

    document.getElementById('btnPrev').style.display = step > 1 ? 'inline-flex' : 'none';
    const btnNext = document.getElementById('btnNext');
    btnNext.textContent = step === TOTAL_STEPS ? '' : 'Next ›';
    if (step === TOTAL_STEPS) {
      btnNext.innerHTML = '';
      btnNext.style.display = 'none';
      _buildPreview();
    } else {
      btnNext.style.display = 'inline-flex';
    }

    if (step === 4) recalcIncome();
  }

  function _validateStep(step) {
    const errs = [];
    if (step === 1) {
      if (!_v('f-name'))   errs.push('Full Name');
      if (!_v('f-pan'))    errs.push('PAN');
      if (!_v('f-mobile')) errs.push('Mobile Number');
      if (!_v('f-address'))errs.push('Address');
      if (errs.length) { alert('Please fill: ' + errs.join(', ')); return false; }
      const pan = _v('f-pan');
      if (!/^[A-Z]{5}[0-9]{4}[A-Z]{1}$/i.test(pan)) { alert('Invalid PAN format! Example: ABCDE1234F'); return false; }
    }
    if (step === 2) {
      if (!_v('f-nature')) { alert('Please select Nature of Business'); return false; }
    }
    if (step === 3) {
      _syncBanks(); // Read DOM input values into banks array before validating
      const missing = banks.map((b, i) => {
        const errs = [];
        if (!b.name)      errs.push('Bank Name');
        if (!b.accountNo) errs.push('Account Number');
        if (!b.ifsc)      errs.push('IFSC Code');
        return errs.length ? `Bank ${i + 1}: ${errs.join(', ')}` : null;
      }).filter(Boolean);
      if (missing.length) {
        alert('Please complete the following:\n\n' + missing.join('\n'));
        return false;
      }
    }
    if (step === 4) {
      if (!_v('f-income') || parseFloat(_v('f-income')) <= 0) { alert('Please enter desired total income'); return false; }
    }
    return true;
  }

  function _v(id) {
    const el = document.getElementById(id);
    return el ? el.value.trim() : '';
  }

  function _clearForm() {
    ['f-name','f-father','f-pan','f-dob','f-mobile','f-email','f-address','f-ward','f-income','f-bname'].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.value = '';
    });
    const g = document.getElementById('f-gender'); if (g) g.value = 'Male';
    const s = document.getElementById('f-status'); if (s) s.value = 'Resident';
    const a = document.getElementById('f-ay');     if (a) a.value = '2026-27';
    const f = document.getElementById('f-filing'); if (f) f.value = '139(1)';
    const n = document.getElementById('f-nature'); if (n) n.value = '';
    const bc= document.getElementById('f-bcode'); if (bc) bc.value = '';
  }

  // ── Nature of Business ─────────────────────────────────────
  function onNatureChange() {
    const sel = document.getElementById('f-nature');
    const opt = sel.options[sel.selectedIndex];
    const code = opt.dataset.code || '';
    document.getElementById('f-bcode').value = code;
  }

  // ── Deductors ──────────────────────────────────────────────
  function onDeductorChange(el) {
    const isAuto = el.dataset.value === 'auto';
    const wasSelected = el.classList.contains('selected');

    if (isAuto) {
      document.querySelectorAll('.ded-card').forEach(c => c.classList.remove('selected'));
      if (!wasSelected) el.classList.add('selected');
    } else {
      const autoCard = document.querySelector('.ded-card.auto-card');
      if (autoCard) autoCard.classList.remove('selected');
      el.classList.toggle('selected');
    }

    const anySelected = document.querySelectorAll('.ded-card.selected').length > 0;
    if (!anySelected) {
      const autoCard = document.querySelector('.ded-card.auto-card');
      if (autoCard) autoCard.classList.add('selected');
    }

    _populateDynamicDropdowns();
  }

  // ── Banks ──────────────────────────────────────────────────
  function _initBanks() {
    banks = [{ id: _uid(), name: '', accountNo: '', ifsc: '', type: 'SB', primary: true }];
    _renderBanks();
  }

  function addBank() {
    _syncBanks();
    banks.push({ id: _uid(), name: '', accountNo: '', ifsc: '', type: 'SB', primary: false });
    _renderBanks();
  }

  function removeBank(id) {
    if (banks.length <= 1) { alert('At least one bank account is required'); return; }
    _syncBanks();
    banks = banks.filter(b => b.id !== id);
    // Ensure one primary
    if (!banks.find(b => b.primary)) banks[0].primary = true;
    _renderBanks();
  }

  function setPrimary(id) {
    _syncBanks();
    banks.forEach(b => b.primary = (b.id === id));
    _renderBanks();
  }

  function _syncBanks() {
    banks.forEach(b => {
      b.name      = (document.getElementById(`bank-name-${b.id}`)?.value || '').trim();
      b.accountNo = (document.getElementById(`bank-acc-${b.id}`)?.value  || '').trim();
      b.ifsc      = (document.getElementById(`bank-ifsc-${b.id}`)?.value || '').trim().toUpperCase();
      b.type      = (document.getElementById(`bank-type-${b.id}`)?.value || 'SB');
    });
  }

  function _renderBanks() {
    const list = document.getElementById('bank-list');
    if (!list) return;
    list.innerHTML = banks.map((b, i) => `
      <div class="bank-card">
        <div class="bank-card-header">
          <span class="bank-badge">Bank ${i+1}</span>
          <div class="d-flex align-items-center gap-2">
            ${b.primary ? '<span class="bank-primary-badge">✓ Primary (Refund A/C)</span>' : `<button class="btn btn-outline-success btn-sm" onclick="App.setPrimary('${_esc(b.id)}')">Set Primary</button>`}
            <button class="btn btn-outline-danger btn-sm" onclick="App.removeBank('${_esc(b.id)}')"><i class="bi bi-trash"></i></button>
          </div>
        </div>
        <div class="row g-2">
          <div class="col-md-4">
            <input type="text" class="form-control text-uppercase" id="bank-name-${_esc(b.id)}" placeholder="Bank Name *" value="${_esc(b.name)}" oninput="App.syncBanks()" />
          </div>
          <div class="col-md-4">
            <input type="text" class="form-control" id="bank-acc-${_esc(b.id)}" placeholder="Account Number *" value="${_esc(b.accountNo)}" oninput="App.syncBanks()" />
          </div>
          <div class="col-md-2">
            <input type="text" class="form-control text-uppercase" id="bank-ifsc-${_esc(b.id)}" placeholder="IFSC *" value="${_esc(b.ifsc)}" maxlength="11" oninput="App.syncBanks()" />
          </div>
          <div class="col-md-2">
            <select class="form-select" id="bank-type-${_esc(b.id)}" onchange="App.syncBanks()">
              <option value="SB" ${b.type==='SB'?'selected':''}>Savings</option>
              <option value="CA" ${b.type==='CA'?'selected':''}>Current</option>
              <option value="OD" ${b.type==='OD'?'selected':''}>OD</option>
            </select>
          </div>
        </div>
      </div>
    `).join('');
  }

  // ── Income ─────────────────────────────────────────────────
  function toggleIncome(type) {
    if (type === 'savings') return; // Mandatory, cannot toggle
    if (type === 'bs') return; // Mandatory, cannot toggle
    selectedIncome[type] = !selectedIncome[type];
    const card = document.getElementById(`toggle-${type}`);
    if (card) {
      card.classList.toggle('selected', selectedIncome[type]);
      card.querySelector('.itc-check').innerHTML = selectedIncome[type]
        ? '<i class="bi bi-check-circle-fill"></i>'
        : '<i class="bi bi-circle"></i>';
    }
    if (type === 'bs') {
      _renderBalanceSheet();
    } else {
      _renderIncomeInputs();
    }
    recalcIncome();
  }

  function _renderIncomeInputs() {
    const container = document.getElementById('income-inputs');
    if (!container) return;

    // Always mark savings as selected
    const savCard = document.getElementById('toggle-savings');
    if (savCard) savCard.classList.add('selected');

    let html = '';
    if (selectedIncome.savings) {
      html += `
        <div class="row g-3 mb-3">
          <div class="col-md-5">
            <label class="form-label">Savings Bank Interest (₹)</label>
            <div class="input-group">
              <span class="input-group-text">₹</span>
              <input type="number" class="form-control" id="f-savings" placeholder="Leave blank to auto-generate" oninput="App.recalcIncome()" />
            </div>
            <div class="form-text">Auto-generated if left blank based on total income</div>
          </div>
        </div>
      `;
    }
    if (selectedIncome.stcg) {
      html += `
        <div class="row g-3 mb-3">
          <div class="col-md-5">
            <label class="form-label">Short Term Capital Gain (₹)</label>
            <div class="input-group">
              <span class="input-group-text">₹</span>
              <input type="number" class="form-control" id="f-stcg" placeholder="e.g. 8000" oninput="App.recalcIncome()" />
            </div>
          </div>
        </div>
      `;
    }
    if (selectedIncome.pl) {
      html += `
        <div class="row g-3 mb-3">
          <div class="col-md-5">
            <label class="form-label">P&L / Other Income (₹)</label>
            <div class="input-group">
              <span class="input-group-text">₹</span>
              <input type="number" class="form-control" id="f-pl" placeholder="e.g. 35000" oninput="App.recalcIncome()" />
            </div>
          </div>
        </div>
      `;
    }
    container.innerHTML = html;
  }

  function recalcIncome() {
    const total   = parseFloat(_v('f-income')) || 0;
    const stcg    = parseFloat(_v('f-stcg'))   || 0;
    const pl      = parseFloat(_v('f-pl'))      || 0;
    const admin   = DB.getAdmin();
    let savings   = parseFloat(_v('f-savings')) || 0;

    // Auto-generate savings if not specified
    if (!savings || savings <= 0) {
      savings = InterestEngine.autoGenerate(total, { minInterest: admin.intMin || 1200, maxInterest: admin.intMax || 8000 });
    }

    const business = Math.max(0, total - savings - stcg - pl);

    // Update display
    document.getElementById('brk-business').textContent = '₹ ' + Math.round(business).toLocaleString('en-IN');
    document.getElementById('brk-savings').textContent  = '₹ ' + Math.round(savings).toLocaleString('en-IN');
    document.getElementById('brk-total').textContent    = '₹ ' + Math.round(total).toLocaleString('en-IN');

    const stcgRow = document.getElementById('brk-stcg-row');
    const plRow   = document.getElementById('brk-pl-row');
    if (stcgRow) { stcgRow.style.display = stcg > 0 ? 'flex' : 'none'; document.getElementById('brk-stcg').textContent = '₹ ' + stcg.toLocaleString('en-IN'); }
    if (plRow)   { plRow.style.display   = pl   > 0 ? 'flex' : 'none'; document.getElementById('brk-pl').textContent   = '₹ ' + pl.toLocaleString('en-IN');   }
  }

  // ── Balance Sheet ────────────────────────────────────────
  function _renderBalanceSheet() {
    const container = document.getElementById('balance-sheet-inputs');
    if (!container) return;

    if (!selectedIncome.bs) {
      container.style.display = 'none';
      container.innerHTML = '';
      return;
    }

    container.style.display = 'block';
    container.innerHTML = `
      <div class="bs-wrapper">
        <div class="bs-header">
          <h6 class="section-sub-heading" style="margin-bottom:0"><i class="bi bi-balance-scale me-2"></i>Balance Sheet (Estimated — As on 31st March)</h6>
          <div class="bs-actions">
            <button type="button" class="btn btn-sm btn-outline-primary" onclick="App.autoGenerateBS()"><i class="bi bi-magic me-1"></i>Auto-generate</button>
            <span class="bs-status" id="bal-status"></span>
          </div>
        </div>
        <div class="bs-grid">
          <div class="bs-col">
            <div class="bs-col-header">Assets</div>
            <div class="bs-field"><label>Cash in Hand</label><div class="input-group input-group-sm"><span class="input-group-text">₹</span><input type="number" class="form-control bs-input" id="bal-cash" value="0" oninput="App.recalcBS()" /></div></div>
            <div class="bs-field"><label>Bank Balance</label><div class="input-group input-group-sm"><span class="input-group-text">₹</span><input type="number" class="form-control bs-input" id="bal-bank" value="0" oninput="App.recalcBS()" /></div></div>
            <div class="bs-field"><label>Stock-in-Trade</label><div class="input-group input-group-sm"><span class="input-group-text">₹</span><input type="number" class="form-control bs-input" id="bal-stock" value="0" oninput="App.recalcBS()" /></div></div>
            <div class="bs-field"><label>Debtors</label><div class="input-group input-group-sm"><span class="input-group-text">₹</span><input type="number" class="form-control bs-input" id="bal-debtors" value="0" oninput="App.recalcBS()" /></div></div>
            <div class="bs-field"><label>Fixed Assets</label><div class="input-group input-group-sm"><span class="input-group-text">₹</span><input type="number" class="form-control bs-input" id="bal-fixed" value="0" oninput="App.recalcBS()" /></div></div>
            <div class="bs-total"><span>Total Assets</span><span id="bal-total-assets">₹ 0</span></div>
          </div>
          <div class="bs-col">
            <div class="bs-col-header">Liabilities &amp; Capital</div>
            <div class="bs-field"><label>Capital Account</label><div class="input-group input-group-sm"><span class="input-group-text">₹</span><input type="number" class="form-control bs-input" id="bal-capital" value="0" oninput="App.recalcBS()" /></div></div>
            <div class="bs-field"><label>Provision for Tax</label><div class="input-group input-group-sm"><span class="input-group-text">₹</span><input type="number" class="form-control bs-input" id="bal-provtax" value="0" oninput="App.recalcBS()" /></div></div>
            <div class="bs-field"><label>Creditors</label><div class="input-group input-group-sm"><span class="input-group-text">₹</span><input type="number" class="form-control bs-input" id="bal-creditors" value="0" oninput="App.recalcBS()" /></div></div>
            <div class="bs-field"><label>Loan / Borrowings</label><div class="input-group input-group-sm"><span class="input-group-text">₹</span><input type="number" class="form-control bs-input" id="bal-loan" value="0" oninput="App.recalcBS()" /></div></div>
            <div class="bs-field"><label>Net Profit</label><div class="input-group input-group-sm"><span class="input-group-text">₹</span><input type="number" class="form-control bs-input" id="bal-netprofit" value="0" oninput="App.recalcBS()" /></div></div>
            <div class="bs-total"><span>Total Liabilities</span><span id="bal-total-liabilities">₹ 0</span></div>
          </div>
        </div>
      </div>
    `;
    recalcBS();
  }

  function autoGenerateBS() {
    const total   = parseFloat(_v('f-income')) || 0;
    const stcg    = parseFloat(_v('f-stcg'))   || 0;
    const pl      = parseFloat(_v('f-pl'))      || 0;
    const admin   = DB.getAdmin();
    let savings   = parseFloat(_v('f-savings')) || 0;
    if (!savings || savings <= 0) {
      savings = InterestEngine.autoGenerate(total, { minInterest: admin.intMin || 1200, maxInterest: admin.intMax || 8000 });
    }
    const businessIncome = Math.max(0, total - savings - stcg - pl);
    const profitPct = admin.profitPct || 20;
    const turnover = profitPct > 0 ? Math.round(businessIncome / (profitPct / 100)) : 0;

    const taxDue = Math.max(0, businessIncome * 0.05);

    const assets = {
      cash: Math.round((10000 + Math.random() * 40000) / 100) * 100,   // 10k to 50k
      bank: Math.round((30000 + Math.random() * 70000) / 100) * 100,  // 30k to 1 lakh
      stock: Math.round(turnover * 0.15),
      debtors: Math.round(turnover * 0.20),
      fixed: Math.round(turnover * 0.05),
    };
    const totalAssets = Object.values(assets).reduce((a, b) => a + b, 0);

    const liabilities = {
      capital: businessIncome,
      provtax: Math.round(taxDue),
      creditors: 0,
      loan: 0,
      netprofit: businessIncome,
    };

    liabilities.creditors = Math.max(0, totalAssets - liabilities.capital - liabilities.provtax - liabilities.loan - liabilities.netprofit);

    const el = (id, v) => { const e = document.getElementById(id); if (e) e.value = v; };
    el('bal-cash', assets.cash);
    el('bal-bank', assets.bank);
    el('bal-stock', assets.stock);
    el('bal-debtors', assets.debtors);
    el('bal-fixed', assets.fixed);
    el('bal-capital', liabilities.capital);
    el('bal-provtax', liabilities.provtax);
    el('bal-creditors', liabilities.creditors);
    el('bal-loan', liabilities.loan);
    el('bal-netprofit', liabilities.netprofit);

    recalcBS();
  }

  function recalcBS() {
    const g = (id) => parseFloat(document.getElementById(id)?.value) || 0;
    const totalAssets = g('bal-cash') + g('bal-bank') + g('bal-stock') + g('bal-debtors') + g('bal-fixed');
    const totalLiab = g('bal-capital') + g('bal-provtax') + g('bal-creditors') + g('bal-loan') + g('bal-netprofit');

    const fmtINR = (n) => '₹ ' + Math.round(n).toLocaleString('en-IN');
    const tA = document.getElementById('bal-total-assets');
    const tL = document.getElementById('bal-total-liabilities');
    if (tA) tA.textContent = fmtINR(totalAssets);
    if (tL) tL.textContent = fmtINR(totalLiab);

    const status = document.getElementById('bal-status');
    if (status) {
      if (totalAssets === totalLiab) {
        status.innerHTML = '<i class="bi bi-check-circle-fill text-success"></i> Balanced';
        status.className = 'bs-status balanced';
      } else {
        const diff = Math.abs(totalAssets - totalLiab);
        status.innerHTML = `<i class="bi bi-exclamation-triangle-fill text-warning"></i> Diff: ${fmtINR(diff)}`;
        status.className = 'bs-status unbalanced';
      }
    }
  }

  function _getBalanceSheet() {
    if (!selectedIncome.bs) return null;
    const g = (id) => parseFloat(document.getElementById(id)?.value) || 0;
    return {
      assets: { cash: g('bal-cash'), bank: g('bal-bank'), stock: g('bal-stock'), debtors: g('bal-debtors'), fixed: g('bal-fixed') },
      liabilities: { capital: g('bal-capital'), provtax: g('bal-provtax'), creditors: g('bal-creditors'), loan: g('bal-loan'), netprofit: g('bal-netprofit') },
    };
  }

  // ── Report rendering & print ────────────────────────────────
  function _renderReportHTML(data) {
    const d = data || activePrintData || _buildComputationData();
    activePrintData = d;
    let html = '';
    if (selectedReport === 'ack') {
      html = ReportAck.generate(d);
    } else if (selectedReport === 'modern') {
      html = ReportModern.generate(d);
    } else {
      html = ReportClassic.generate(d);
    }

    const body = document.getElementById('reportBody');
    if (body) body.innerHTML = html;

    const printArea = document.getElementById('print-area');
    if (printArea) printArea.innerHTML = html;

    const titleEl = document.getElementById('reportModalTitle');
    if (titleEl) {
      if (selectedReport === 'ack') {
        titleEl.innerHTML = '<i class="bi bi-file-earmark-check-fill me-2 text-primary" aria-hidden="true"></i>Income Tax Return Acknowledgement (ITR-V)';
      } else {
        titleEl.innerHTML = '<i class="bi bi-file-earmark-text-fill me-2" aria-hidden="true"></i>Income Tax Computation';
      }
    }

    return html;
  }

  function triggerPrint() {
    _renderReportHTML(activePrintData);
    const printArea = document.getElementById('print-area');
    const modal = document.getElementById('reportModal');
    if (printArea) {
      printArea.style.display = 'block';
      printArea.style.position = 'static';
      printArea.style.left = '0';
      printArea.style.width = '100%';
    }
    if (modal) modal.style.display = 'none';

    // Set filename: NAME_AY_Computation or NAME_AY_ITR_Acknowledgement
    const d = activePrintData || {};
    const clientName = ((d.client && d.client.name) || 'CLIENT').toUpperCase().replace(/[^A-Z0-9]/g, '_');
    const ay = (d.client && d.client.ay) || 'AY';
    const suffix = selectedReport === 'ack' ? 'ITR_Acknowledgement' : 'Computation';
    const prevTitle = document.title;
    document.title = `${clientName}_${ay}_${suffix}`;

    setTimeout(() => {
      window.print();
      document.title = prevTitle;
      if (printArea) {
        printArea.style.display = 'none';
        printArea.style.position = 'absolute';
        printArea.style.left = '-9999px';
        printArea.style.width = '';
      }
      if (modal) modal.style.display = '';
    }, 300);
  }

  function selectReport(type) {
    selectedReport = type;
    const btnC = document.getElementById('rt-classic');
    const btnM = document.getElementById('rt-modern');
    const btnA = document.getElementById('rt-ack');
    if (btnC) btnC.classList.toggle('active', type === 'classic');
    if (btnM) btnM.classList.toggle('active', type === 'modern');
    if (btnA) btnA.classList.toggle('active', type === 'ack');

    const mBtnC = document.getElementById('modal-rt-classic');
    const mBtnM = document.getElementById('modal-rt-modern');
    const mBtnA = document.getElementById('modal-rt-ack');
    if (mBtnC) { mBtnC.classList.toggle('btn-primary', type === 'classic'); mBtnC.classList.toggle('btn-outline-secondary', type !== 'classic'); }
    if (mBtnM) { mBtnM.classList.toggle('btn-primary', type === 'modern'); mBtnM.classList.toggle('btn-outline-primary', type !== 'modern'); }
    if (mBtnA) { mBtnA.classList.toggle('btn-primary', type === 'ack'); mBtnA.classList.toggle('btn-outline-info', type !== 'ack'); }

    _renderReportHTML(activePrintData);
  }

  function generateAck() {
    selectedReport = 'ack';
    const btnC = document.getElementById('rt-classic');
    const btnM = document.getElementById('rt-modern');
    const btnA = document.getElementById('rt-ack');
    if (btnC) btnC.classList.toggle('active', false);
    if (btnM) btnM.classList.toggle('active', false);
    if (btnA) btnA.classList.toggle('active', true);
    generateReport();
  }

  // ── Compute all data ────────────────────────────────────────
  function _buildComputationData() {
    _syncBanks();
    const admin    = DB.getAdmin();
    const ay       = _v('f-ay') || '2025-26';
    const total    = parseFloat(_v('f-income')) || 0;
    const stcg     = parseFloat(_v('f-stcg'))   || 0;
    const pl       = parseFloat(_v('f-pl'))      || 0;
    let savings    = parseFloat(_v('f-savings')) || 0;

    if (!savings || savings <= 0) {
      savings = InterestEngine.autoGenerate(total, { minInterest: admin.intMin || 1200, maxInterest: admin.intMax || 8000 });
    }

    const businessIncome = Math.max(0, total - savings - stcg - pl);
    const profitPct      = admin.profitPct || 20;
    const profitDec      = profitPct / 100;
    const turnover       = profitDec > 0 ? Math.round(businessIncome / profitDec) : 0;
    const natureOfBiz    = _v('f-nature');

    // Parse Deductors
    const selectedCards = document.querySelectorAll('.ded-card.selected:not(.auto-card)');
    let selectedDeductors = [];
    if (selectedCards.length > 0) {
      selectedCards.forEach(card => {
        const idx = parseInt(card.dataset.value, 10);
        if (!isNaN(idx) && admin.deductors && admin.deductors[idx]) {
          selectedDeductors.push(admin.deductors[idx]);
        }
      });
    }

    // TDS – pass business nature for type-aware generation
    const tdsData = TDSEngine.generate(turnover, natureOfBiz, {
      rate194H:  admin.rate194H,
      rate194C:  admin.rate194C,
      selectedDeductors: selectedDeductors
    }, banks);

    // Compute tax
    const computation = TaxEngine.compute({
      ay,
      businessIncome,
      savingsInterest: savings,
      stcg,
      pl,
      tds: tdsData.totalTDS,
    });

    // Bank interest distribution
    const bankInterest = InterestEngine.distribute(savings, banks);

    // STCG Details (generate realistic entries)
    const stcgDetails = stcg > 0 ? _generateSTCGDetails(stcg) : [];

    const formNo = _v('f-form-no') || (natureOfBiz ? 'ITR-4' : 'ITR-1');

    const client = {
      name:        _v('f-name'),
      father:      _v('f-father'),
      pan:         _v('f-pan').toUpperCase(),
      dob:         _v('f-dob'),
      gender:      _v('f-gender'),
      mobile:      _v('f-mobile'),
      email:       _v('f-email'),
      address:     _v('f-address'),
      ay,
      ward:        _v('f-ward'),
      filing:      _v('f-filing'),
      status:      _v('f-status'),
      nature:      natureOfBiz,
      bcode:       _v('f-bcode'),
      bname:       _v('f-bname'),
      formNumber:  formNo,
      ackNo:       _v('f-ack-no'),
      filingDate:  _v('f-filing-date'),
      evcMode:     _v('f-evc-mode') || 'Aadhaar OTP',
    };

    return {
      client, computation, tds: tdsData, bankInterest,
      banks: [...banks], stcgDetails, turnover,
      profitPct, adminConfig: admin,
      balanceSheet: _getBalanceSheet(),
    };
  }

  // ── Build Full Preview (Step 5) ────────────────────────────
  function _buildPreview() {
    const data = _buildComputationData();
    const c    = data.computation;
    const { fmtNum } = TaxEngine;
    const compNo = _peekCompNumber();

    const pr = (lbl, val, bold = false) =>
      `<div class="preview-row"><span>${lbl}</span><span ${bold?'class="fw-bold"':''}>${val}</span></div>`;
    const prTotal = (lbl, val, color) =>
      `<div class="preview-row preview-total" style="color:${color}">
         <span>${lbl}</span><span>₹ ${fmtNum(val)}</span>
       </div>`;

    // Left panel: Client + Business + Banks
    document.getElementById('preview-summary').innerHTML = `
      <h6 class="mb-2" style="color:var(--primary); font-size:.8rem;">📋 CLIENT &amp; BUSINESS DETAILS</h6>
      <div style="font-size:.72rem; background:var(--surface2); border-radius:6px; padding:4px 8px; margin-bottom:8px; font-family:monospace; color:var(--primary);">${compNo}</div>
      ${pr('Name', `<strong>${data.client.name}</strong>`)}
      ${pr('PAN', `<code>${data.client.pan}</code>`)}
      ${pr('Mobile', data.client.mobile || '—')}
      ${pr('Date of Birth', data.client.dob ? new Date(data.client.dob).toLocaleDateString('en-IN') : '—')}
      ${pr('Assessment Year', `<strong>${data.client.ay}</strong>`)}
      ${data.client.bname ? pr('Business Name', data.client.bname) : ''}
      ${pr('Nature of Business', data.client.nature || '—')}
      ${pr('Business Code', data.client.bcode || '—')}
      ${pr('Filed u/s', data.client.filing || '—')}
      <hr style="margin:6px 0; border-color:var(--border)" />
      <div class="preview-row" style="font-size:.75rem; font-weight:700; color:var(--text-muted); margin-bottom:4px;">BUSINESS SUMMARY (44AD)</div>
      ${pr('Declared Profit %', `${data.profitPct || 20}%`)}
      ${pr('Gross Turnover', `₹ ${fmtNum(data.turnover)}`, true)}
      ${pr('Declared Business Income', `₹ ${fmtNum(c.businessIncome)}`, true)}
      ${pr('Savings Interest', `₹ ${fmtNum(c.savingsInterest)}`)}
      ${c.stcg > 0 ? pr('Short Term Capital Gain', `₹ ${fmtNum(c.stcg)}`) : ''}
      ${c.pl   > 0 ? pr('P&amp;L Income', `₹ ${fmtNum(c.pl)}`) : ''}
      <hr style="margin:6px 0; border-color:var(--border)" />
      <div class="preview-row" style="font-size:.75rem; font-weight:700; color:var(--text-muted); margin-bottom:4px;">BANK ACCOUNTS (${data.banks.length})</div>
      ${data.banks.map(b => pr(b.name, `A/C ...${(b.accountNo||'').slice(-4)} ${b.primary?'<span style="color:#059669">●Primary</span>':''}`)).join('')}
      <hr style="margin:6px 0; border-color:var(--border)" />
      <div class="preview-row" style="font-size:.75rem; font-weight:700; color:var(--text-muted); margin-bottom:4px;">TDS DEDUCTED</div>
      ${data.tds.tds194H > 0 ? pr('194H Commission', `₹ ${fmtNum(data.tds.tds194H)}`) : ''}
      ${data.tds.tds194C > 0 ? pr('194C Contractor', `₹ ${fmtNum(data.tds.tds194C)}`) : ''}
      ${(data.tds.tds194J||0) > 0 ? pr('194J Professional', `₹ ${fmtNum(data.tds.tds194J)}`) : ''}
      ${data.tds.tds194N > 0 ? pr('194N Cash Withdrawal', `₹ ${fmtNum(data.tds.tds194N)}`) : ''}
      ${pr('Total TDS Credit', `<strong>₹ ${fmtNum(data.tds.totalTDS)}</strong>`)}
    `;

    // Right panel: Income summary + Tax computation
    const statusColor = c.refund > 0 ? '#059669' : c.taxDue > 0 ? '#dc2626' : '#4f46e5';
    const statusLabel = c.refund > 0 ? '✅ Refund Due' : c.taxDue > 0 ? '⚠️ Tax Payable' : '✅ Nil';
    document.getElementById('preview-tax').innerHTML = `
      <h6 class="mb-2" style="color:var(--primary); font-size:.8rem;">🧾 TAX COMPUTATION</h6>
      <div class="preview-row" style="font-size:.75rem; font-weight:700; color:var(--text-muted); margin-bottom:4px;">INCOME SUMMARY</div>
      ${pr('Business Income (44AD)', `₹ ${fmtNum(c.businessIncome)}`)}
      ${pr('Savings Bank Interest', `₹ ${fmtNum(c.savingsInterest)}`)}
      ${c.stcg > 0 ? pr('Short Term Capital Gain', `₹ ${fmtNum(c.stcg)}`) : ''}
      ${c.pl   > 0 ? pr('P&amp;L Income', `₹ ${fmtNum(c.pl)}`) : ''}
      ${pr('Gross Total Income', `<strong>₹ ${fmtNum(c.grossTotalIncome)}</strong>`, true)}
      ${pr('Less: 80TTA Deduction', `– ₹ ${fmtNum(c.deduction80TTA)}`)}
      ${pr('Total Income (u/s 288A)', `<strong>₹ ${fmtNum(c.totalIncome)}</strong>`, true)}
      <hr style="margin:6px 0; border-color:var(--border)" />
      <div class="preview-row" style="font-size:.75rem; font-weight:700; color:var(--text-muted); margin-bottom:4px;">TAX CALCULATION</div>
      ${pr('Tax on Income (slab)', `₹ ${fmtNum(c.taxBeforeRebate)}`)}
      ${pr('Less: Rebate u/s 87A', `– ₹ ${fmtNum(c.rebate)}`)}
      ${pr('Tax after Rebate', `₹ ${fmtNum(c.taxAfterRebate)}`)}
      ${pr('Health &amp; Education Cess @ 4%', `₹ ${fmtNum(c.cess)}`)}
      ${pr('Total Tax Liability', `<strong>₹ ${fmtNum(c.totalTaxPayable)}</strong>`, true)}
      ${pr('Less: TDS Credit', `– ₹ ${fmtNum(c.tdsCredit)}`)}
      <hr style="margin:6px 0; border-color:var(--border)" />
      <div class="preview-row preview-total" style="color:${statusColor}; font-size:.95rem;">
        <span>${statusLabel}</span>
        <span>₹ ${fmtNum(c.refund > 0 ? c.refund : c.taxDue)}</span>
      </div>
    `;
  }

  // ── Generate Report (with AI Validation) ──────────────────
  function generateReport() {
    const data = _buildComputationData();

    // ── Run AI validation ────────────────────────────────────
    const validation = _runValidation(data);

    if (validation.errors.length > 0) {
      const msg = '❌ VALIDATION ERRORS:\n\n' + validation.errors.join('\n')
        + (validation.warnings.length ? '\n\n⚠️ WARNINGS:\n\n' + validation.warnings.join('\n') : '')
        + '\n\nPlease correct these before generating.';
      alert(msg);
      return;
    }

    if (validation.warnings.length > 0) {
      const msg = '⚠️ Validation Warnings:\n\n' + validation.warnings.join('\n')
        + '\n\nDo you want to continue generating the report?';
      if (!confirm(msg)) return;
    }

    // ── Assign computation number & Auto-Save Client ──────────
    if (!data.compNo) {
      data.compNo = _getNextCompNumber();
    }
    data.profitPct = data.profitPct || 20;

    // Automatically save/update client in database
    _saveClientRecord(data);

    _renderReportHTML(data);

    const modal = new bootstrap.Modal(document.getElementById('reportModal'));
    modal.show();
  }

  // ── AI Validation Engine ────────────────────────────────────
  function _runValidation(data) {
    const errors   = [];
    const warnings = [];
    const c        = data.computation;
    const tds      = data.tds;
    const admin    = DB.getAdmin();
    const profitPct = (admin.profitPct || 20) / 100;
    const cfg       = TaxEngine.getConfig(data.client.ay || '2025-26');

    // 1. Profit % check
    if (data.turnover > 0) {
      const actualPct = c.businessIncome / data.turnover;
      if (Math.abs(actualPct - profitPct) > 0.001) {
        errors.push(`Profit % mismatch: Expected ${(profitPct*100).toFixed(0)}%, got ${(actualPct*100).toFixed(2)}%.`);
      }
    }

    // 2. Turnover formula check
    const expectedTurnover = profitPct > 0 ? Math.round(c.businessIncome / profitPct) : 0;
    if (Math.abs((data.turnover || 0) - expectedTurnover) > 10) {
      errors.push(`Turnover mismatch: Expected ₹${expectedTurnover.toLocaleString('en-IN')}, computed ₹${(data.turnover||0).toLocaleString('en-IN')}.`);
    }

    // 3. GTI reconciliation
    const expectedGTI = c.businessIncome + c.savingsInterest + c.stcg + c.pl;
    if (Math.abs(c.grossTotalIncome - expectedGTI) > 5) {
      errors.push(`Gross Total Income does not reconcile. Sum of heads = ₹${expectedGTI.toLocaleString('en-IN')}, GTI = ₹${c.grossTotalIncome.toLocaleString('en-IN')}.`);
    }

    // 4. Tax slab check
    const expectedTax = TaxEngine.computeSlabTax(Math.max(0, c.totalIncome - c.stcg), cfg.slabs)
                        + Math.round(c.stcg * (cfg.stcgRate || 0.15));
    if (Math.abs(c.taxBeforeRebate - expectedTax) > 20) {
      errors.push(`Tax calculation error: Expected ₹${expectedTax.toLocaleString('en-IN')}, got ₹${c.taxBeforeRebate.toLocaleString('en-IN')}.`);
    }

    // 5. Rebate 87A check
    if (c.totalIncome <= cfg.rebateLimit && c.rebate === 0 && c.taxBeforeRebate > 0) {
      errors.push(`Rebate u/s 87A should apply (income ₹${c.totalIncome.toLocaleString('en-IN')} ≤ ₹${cfg.rebateLimit.toLocaleString('en-IN')}) but is ₹0.`);
    }
    if (c.totalIncome > cfg.rebateLimit && c.rebate > 0) {
      errors.push(`Rebate u/s 87A applied but income ₹${c.totalIncome.toLocaleString('en-IN')} exceeds limit ₹${cfg.rebateLimit.toLocaleString('en-IN')}.`);
    }

    // 6. TDS reasonableness
    if (data.turnover > 0 && tds.totalTDS > 0) {
      const tdsRatio = (tds.totalTDS / data.turnover) * 100;
      if (tdsRatio > 3) {
        warnings.push(`TDS appears high (${tdsRatio.toFixed(2)}% of turnover = ₹${tds.totalTDS.toLocaleString('en-IN')}). Typical range: 0.10–0.50% of turnover.`);
      }
    }

    // 7. Savings interest reasonableness
    if (c.savingsInterest > 50000) {
      warnings.push(`Savings Bank Interest ₹${c.savingsInterest.toLocaleString('en-IN')} is unusually high. Verify bank statements.`);
    }
    if (c.savingsInterest > cfg.tttaLimit) {
      warnings.push(`Savings interest ₹${c.savingsInterest.toLocaleString('en-IN')} exceeds 80TTA deduction limit of ₹${cfg.tttaLimit.toLocaleString('en-IN')}. Excess is fully taxable.`);
    }

    return { errors, warnings, valid: errors.length === 0 };
  }

  // ── Computation Number Generator ───────────────────────────
  function _getNextCompNumber() {
    const year = new Date().getFullYear();
    const key  = `ssinfotech_comp_seq_${year}`;
    const seq  = (parseInt(localStorage.getItem(key) || '0')) + 1;
    localStorage.setItem(key, seq.toString());
    return `CMP-${year}-${String(seq).padStart(6, '0')}`;
  }

  /** Peek at next number without incrementing (for preview display) */
  function _peekCompNumber() {
    const year = new Date().getFullYear();
    const key  = `ssinfotech_comp_seq_${year}`;
    const seq  = (parseInt(localStorage.getItem(key) || '0')) + 1;
    return `CMP-${year}-${String(seq).padStart(6, '0')}`;
  }

  // ── Save Client Record Helper ──────────────────────────────
  function _saveClientRecord(data) {
    if (!data || !data.client || !data.client.name || !data.client.pan) return null;
    if (!data.compNo) {
      data.compNo = _getNextCompNumber();
    }
    const record = {
      id:           editingClientId || undefined,
      compNo:       data.compNo,
      ...data.client,
      banks:        data.banks,
      computation:  data.computation,
      tds:          data.tds,
      turnover:     data.turnover,
      profitPct:    data.profitPct || 20,
      stcgDetails:  data.stcgDetails || [],
      bankInterest: data.bankInterest || [],
      incomeInputs: {
        desiredIncome: parseFloat(_v('f-income')) || 0,
        savings:       parseFloat(_v('f-savings')) || 0,
        stcg:          parseFloat(_v('f-stcg'))   || 0,
        pl:            parseFloat(_v('f-pl'))      || 0,
        balanceSheet:  data.balanceSheet || null,
      },
    };
    const saved = DB.save(record);
    if (saved && saved.id) {
      editingClientId = saved.id;
    }
    _refreshDashboard();
    _renderClientTable();
    return saved;
  }

  // ── Save Client (Manual Button) ────────────────────────────
  function saveClient() {
    const data = _buildComputationData();
    if (!data.client.name || !data.client.pan) {
      alert('⚠️ Please fill in Client Name and PAN before saving.');
      return;
    }
    const saved = _saveClientRecord(data);
    if (saved) {
      alert(`✅ Client "${data.client.name}" saved successfully to Client Database!`);
    }
  }

  // ── Client Table ────────────────────────────────────────────
  function _renderClientTable(data) {
    const clients = data || DB.all();
    const grid    = document.getElementById('clientGrid');
    const noMsg   = document.getElementById('no-clients');
    const tbody   = document.getElementById('clientTbody');

    // Update stats
    const allClients = DB.all();
    const csTotal = document.getElementById('cs-total');
    const csRefund = document.getElementById('cs-refund');
    const csPayable = document.getElementById('cs-payable');
    const csNil = document.getElementById('cs-nil');
    if (csTotal) csTotal.textContent = allClients.length;
    if (csRefund) csRefund.textContent = allClients.filter(c => (c.computation?.refund || 0) > 0).length;
    if (csPayable) csPayable.textContent = allClients.filter(c => (c.computation?.taxDue || 0) > 0).length;
    if (csNil) csNil.textContent = allClients.filter(c => (c.computation?.refund || 0) === 0 && (c.computation?.taxDue || 0) === 0).length;

    if (!clients.length) {
      if (grid) grid.innerHTML = '';
      if (noMsg) noMsg.style.display = 'block';
      if (tbody) tbody.innerHTML = '';
      return;
    }
    if (noMsg) noMsg.style.display = 'none';

    // Render cards
    if (grid) {
      grid.innerHTML = clients.map((c, i) => {
        const comp = c.computation || {};
        const name = (c.name || 'C').toUpperCase();
        const initials = name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase();
        const isRefund = (comp.refund || 0) > 0;
        const isPayable = (comp.taxDue || 0) > 0;
        const isNil = !isRefund && !isPayable;
        const statusClass = isRefund ? 'success' : isPayable ? 'danger' : 'primary';
        const statusLabel = isRefund ? 'Refund' : isPayable ? 'Payable' : 'Nil';
        const statusAmt = isRefund ? comp.refund : isPayable ? comp.taxDue : 0;
        const compNo = c.compNo || '—';
        const date = c.createdAt ? new Date(c.createdAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';

        return `
          <div class="client-card" id="client-card-${c.id}">
            <div class="cc-header">
              <div class="cc-avatar" style="background:var(--primary);color:#fff">${initials}</div>
              <div class="cc-info">
                <div class="cc-name">${_esc(name)}</div>
                <div class="cc-pan"><code>${_esc(c.pan) || '—'}</code></div>
              </div>
              <div class="cc-badge badge-${statusClass}">
                <i class="bi ${isRefund ? 'bi-arrow-down-left' : isPayable ? 'bi-arrow-up-right' : 'bi-check-circle'}"></i>
                ${statusLabel}
                ${statusAmt > 0 ? ' ₹' + statusAmt.toLocaleString('en-IN') : ''}
              </div>
            </div>
            <div class="cc-body">
              <div class="cc-row"><span class="cc-label">AY</span><span class="cc-val">${_esc(c.ay) || '—'}</span></div>
              <div class="cc-row"><span class="cc-label">Income</span><span class="cc-val">₹ ${((comp.totalIncome)||0).toLocaleString('en-IN')}</span></div>
              <div class="cc-row"><span class="cc-label">Mobile</span><span class="cc-val">${_esc(c.mobile) || '—'}</span></div>
              <div class="cc-row"><span class="cc-label">Filed</span><span class="cc-val">${_esc(c.filing) || '139(1)'}</span></div>
              <div class="cc-row"><span class="cc-label">Ref No</span><span class="cc-val" style="font-size:10px;color:var(--text-muted)">${_esc(compNo)}</span></div>
              <div class="cc-row"><span class="cc-label">Date</span><span class="cc-val" style="font-size:10px;color:var(--text-muted)">${date}</span></div>
            </div>
            <div class="cc-footer">
              <button class="cc-action" title="Edit" onclick="App.editClient('${_esc(c.id)}')"><i class="bi bi-pencil-fill"></i></button>
              <button class="cc-action" title="Print Computation" onclick="App.printClient('${_esc(c.id)}')"><i class="bi bi-printer-fill"></i></button>
              <button class="cc-action" title="Print ITR Acknowledgement" onclick="App.printClientAck('${_esc(c.id)}')"><i class="bi bi-file-earmark-check-fill" style="color:var(--primary)"></i></button>
              <button class="cc-action" title="Download JSON" onclick="App.downloadClientRecord('${_esc(c.id)}')"><i class="bi bi-download"></i></button>
              <button class="cc-action" title="Duplicate" onclick="App.duplicateClient('${_esc(c.id)}')"><i class="bi bi-copy"></i></button>
              <button class="cc-action cc-danger" title="Delete" onclick="App.deleteClient('${_esc(c.id)}')"><i class="bi bi-trash-fill"></i></button>
            </div>
          </div>
        `;
      }).join('');
    }

    // Keep hidden tbody in sync for compatibility
    if (tbody) {
      tbody.innerHTML = clients.map((c, i) => {
        const comp = c.computation || {};
        return `<tr><td>${i+1}</td><td>${_esc(c.name)}</td><td>${_esc(c.pan)}</td><td>${_esc(c.mobile)}</td><td>${_esc(c.ay)}</td><td>${(comp.totalIncome)||0}</td><td></td><td></td></tr>`;
      }).join('');
    }
  }

  function searchClients() {
    const q = document.getElementById('clientSearch')?.value || '';
    _renderClientTable(DB.search(q));
  }

  function editClient(id) {
    const c = DB.findById(id);
    if (!c) return;
    editingClientId = id;
    navTo('new-computation');

    setTimeout(() => {
      _setVal('f-name',    c.name);
      _setVal('f-father',  c.father);
      _setVal('f-pan',     c.pan);
      _setVal('f-dob',     c.dob);
      _setVal('f-mobile',  c.mobile);
      _setVal('f-email',   c.email);
      _setVal('f-address', c.address);
      _setVal('f-ward',    c.ward);
      _setSelect('f-gender',  c.gender);
      _setSelect('f-status',  c.status);
      _setSelect('f-ay',      c.ay);
      _setSelect('f-filing',  c.filing);
      _setSelect('f-nature',  c.nature);
      _setVal('f-bcode',   c.bcode);
      _setVal('f-bname',   c.bname);
      _setSelect('f-form-no', c.formNumber || (c.nature ? 'ITR-4' : 'ITR-1'));
      _setVal('f-ack-no',     c.ackNo || '');
      _setVal('f-filing-date', c.filingDate || '');
      _setSelect('f-evc-mode', c.evcMode || 'Aadhaar OTP');

      if (c.banks) { banks = c.banks; _renderBanks(); }
      if (c.incomeInputs) {
        _setVal('f-income',  c.incomeInputs.desiredIncome);
        _setVal('f-savings', c.incomeInputs.savings);
        _setVal('f-stcg',    c.incomeInputs.stcg);
        _setVal('f-pl',      c.incomeInputs.pl);
        if (c.incomeInputs.stcg > 0) { selectedIncome.stcg = true; }
        if (c.incomeInputs.pl   > 0) { selectedIncome.pl   = true; }
        _renderIncomeInputs();
        recalcIncome();

        if (c.incomeInputs.balanceSheet) {
          selectedIncome.bs = true;
          const bsCard = document.getElementById('toggle-bs');
          if (bsCard) {
            bsCard.classList.add('selected');
            bsCard.querySelector('.itc-check').innerHTML = '<i class="bi bi-check-circle-fill"></i>';
          }
          _renderBalanceSheet();
          const bs = c.incomeInputs.balanceSheet;
          const el = (id, v) => { const e = document.getElementById(id); if (e) e.value = v || 0; };
          el('bal-cash', bs.assets?.cash);
          el('bal-bank', bs.assets?.bank);
          el('bal-stock', bs.assets?.stock);
          el('bal-debtors', bs.assets?.debtors);
          el('bal-fixed', bs.assets?.fixed);
          el('bal-capital', bs.liabilities?.capital);
          el('bal-provtax', bs.liabilities?.provtax);
          el('bal-creditors', bs.liabilities?.creditors);
          el('bal-loan', bs.liabilities?.loan);
          el('bal-netprofit', bs.liabilities?.netprofit);
          recalcBS();
        }
      }
    }, 100);
  }

  function deleteClient(id) {
    if (!confirm('Are you sure you want to delete this client?')) return;
    DB.remove(id);
    _renderClientTable();
    _refreshDashboard();
  }

  function duplicateClient(id) {
    DB.duplicate(id);
    _renderClientTable();
    _refreshDashboard();
  }

  function printClient(id) {
    const c = DB.findById(id);
    if (!c) return;

    editingClientId = id;
    const admin = DB.getAdmin();

    const stcgAmt    = c.computation?.stcg || 0;
    const stcgDetails = (c.stcgDetails && c.stcgDetails.length)
      ? c.stcgDetails
      : (stcgAmt > 0 ? _generateSTCGDetails(stcgAmt) : []);

    const bankInterest = (c.bankInterest && c.bankInterest.length)
      ? c.bankInterest
      : InterestEngine.distribute(c.computation?.savingsInterest || 0, c.banks || []);

    const data = {
      client:       c,
      computation:  c.computation,
      tds:          c.tds || { totalTDS:0, entries:[] },
      bankInterest,
      banks:        c.banks || [],
      stcgDetails,
      turnover:     c.turnover || 0,
      profitPct:    c.profitPct || 20,
      compNo:       c.compNo || ('CMP-' + new Date().getFullYear() + '-000001'),
      adminConfig:  admin,
    };

    _renderReportHTML(data);

    const modalEl = document.getElementById('reportModal');
    const modal = new bootstrap.Modal(modalEl);
    modal.show();

    // Auto-trigger print after modal is shown
    modalEl.addEventListener('shown.bs.modal', function handler() {
      modalEl.removeEventListener('shown.bs.modal', handler);
      setTimeout(() => triggerPrint(), 200);
    });
  }

  function printClientAck(id) {
    selectedReport = 'ack';
    const btnC = document.getElementById('rt-classic');
    const btnM = document.getElementById('rt-modern');
    const btnA = document.getElementById('rt-ack');
    if (btnC) btnC.classList.toggle('active', false);
    if (btnM) btnM.classList.toggle('active', false);
    if (btnA) btnA.classList.toggle('active', true);
    printClient(id);
  }

  function _setVal(id, v)    { const el = document.getElementById(id); if (el) el.value = v || ''; }
  function _setSelect(id, v) { const el = document.getElementById(id); if (el && v) el.value = v; }

  // ── Dashboard ───────────────────────────────────────────────
  function _refreshDashboard() {
    const s = DB.stats();
    _setText('stat-today',   s.today);
    _setText('stat-clients', s.total);
    _setText('stat-refund',  s.refund);
    _setText('stat-payable', s.payable);
    _renderRecentClients(s.recent);
    _renderAYChart(s.byAY);
    const dashDate = document.getElementById('dashDate');
    if (dashDate) {
      const now = new Date();
      const options = { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' };
      dashDate.textContent = now.toLocaleDateString('en-IN', options);
    }
    const ayBadge = document.getElementById('currentAY');
    if (ayBadge) {
      const ayVal = _v('f-ay') || '2026-27';
      const label = ayVal === '2026-27' ? ayVal + ' (Current A.Y.)' : ayVal;
      ayBadge.innerHTML = '<i class="bi bi-calendar3"></i> AY ' + label;
    }
  }

  function _renderRecentClients(list) {
    const el = document.getElementById('recentClients');
    if (!el) return;
    if (!list || !list.length) {
      el.innerHTML = '<div class="text-center text-muted py-4">No clients yet</div>';
      return;
    }
    el.innerHTML = list.map(c => `
      <div class="recent-item" onclick="App.editClient('${_esc(c.id)}')">
        <div class="recent-avatar">${_esc((c.name||'C').split(' ').map(n=>n[0]).join('').slice(0,2).toUpperCase())}</div>
        <div>
          <div class="recent-name">${_esc(c.name) || '—'}</div>
          <div class="recent-pan">${_esc(c.pan) || '—'} &nbsp;|&nbsp; ${_esc(c.mobile) || ''}</div>
        </div>
        <div class="recent-ay">AY ${_esc(c.ay) || '—'}</div>
      </div>
    `).join('');
  }

  function _renderAYChart(byAY) {
    const canvas = document.getElementById('chartAY');
    if (!canvas) return;
    const labels = Object.keys(byAY);
    const values = Object.values(byAY);

    if (chartAY) chartAY.destroy();
    chartAY = new Chart(canvas, {
      type: 'bar',
      data: {
        labels,
        datasets: [{
          label: 'Clients',
          data: values,
          backgroundColor: ['#4f46e5','#7c3aed','#059669','#d97706'].slice(0, labels.length),
          borderRadius: 6,
        }],
      },
      options: {
        responsive: true,
        plugins: { legend: { display: false } },
        scales: {
          y: { beginAtZero: true, ticks: { stepSize: 1 } },
        },
      },
    });
  }

  function _setText(id, val) {
    const el = document.getElementById(id);
    if (el) el.textContent = val;
  }

  // ── Admin Panel ─────────────────────────────────────────────
  function _initAdminPanel() {
    const admin = DB.getAdmin();
    _setVal('admin-profit',  admin.profitPct  || 20);
    _setVal('admin-int-min', admin.intMin     || 1200);
    _setVal('admin-int-max', admin.intMax     || 8000);
    _setVal('admin-194h',    admin.rate194H   || 0.20);
    _setVal('admin-194c',    admin.rate194C   || 0.05);
    _setVal('admin-194nf',   admin.rate194NF  || 0.012);
    _setVal('admin-company', admin.company    || 'SS INFOTECH');
    _setVal('admin-footer',  admin.footer     || 'Professional Tax Computation Services');
    _setVal('admin-signatory', admin.signatory || 'Proprietor');

    _renderAYTable();
    _renderCustomAYs();
    _renderDeductors();
    _renderBankConfigs();
    _renderNatureCodes();
    _renderSlipCompanies();
    _populateDynamicDropdowns();
    updateProjectStorageStats();
  }

  function saveAdminConfig() {
    const oldAdmin = DB.getAdmin();
    const admin = {
      ...oldAdmin,
      profitPct:  parseFloat(document.getElementById('admin-profit')?.value)  || 20,
      intMin:     parseFloat(document.getElementById('admin-int-min')?.value) || 1200,
      intMax:     parseFloat(document.getElementById('admin-int-max')?.value) || 8000,
      rate194H:   parseFloat(document.getElementById('admin-194h')?.value)    || 0.20,
      rate194C:   parseFloat(document.getElementById('admin-194c')?.value)    || 0.05,
      rate194NF:  parseFloat(document.getElementById('admin-194nf')?.value)   || 0.012,
      company:    document.getElementById('admin-company')?.value    || 'SS INFOTECH',
      footer:     document.getElementById('admin-footer')?.value     || 'Professional Tax Computation Services',
      signatory:  document.getElementById('admin-signatory')?.value  || 'Proprietor',
    };
    DB.saveAdmin(admin);
    alert('✅ Configuration saved successfully!');
  }

  const BACKUP_FORMAT = 'ss-infotech-local-backup';
  const BACKUP_VERSION = 1;
  const BACKUP_JSON_KEYS = {
    ssinfotech_clients: 'array',
    ssinfotech_admin: 'object',
    ssinfotech_slip_companies: 'array',
    ssinfotech_slip_records: 'array',
    ssinfotech_statement_records: 'array',
  };

  function _backupKeys() {
    return Object.keys(localStorage).filter(key =>
      key === 'theme' || key.startsWith('ssinfotech_')
    ).sort();
  }

  function downloadLocalBackup() {
    try {
      const data = {};
      _backupKeys().forEach(key => { data[key] = localStorage.getItem(key); });
      const backup = {
        format: BACKUP_FORMAT,
        version: BACKUP_VERSION,
        createdAt: new Date().toISOString(),
        data,
      };
      const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      const date = new Date().toISOString().slice(0, 10);
      link.href = url;
      link.download = `ss-infotech-backup-${date}.json`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
    } catch (error) {
      alert(`Backup could not be created. ${error.message}`);
    }
  }

  function _validateBackup(backup) {
    if (!backup || backup.format !== BACKUP_FORMAT || backup.version !== BACKUP_VERSION) {
      throw new Error('This is not a supported SS INFOTECH backup file.');
    }
    if (!backup.data || Array.isArray(backup.data) || typeof backup.data !== 'object') {
      throw new Error('The backup data is missing or invalid.');
    }

    Object.entries(backup.data).forEach(([key, value]) => {
      if (key !== 'theme' && !key.startsWith('ssinfotech_')) {
        throw new Error(`The backup contains an unsupported storage key: ${key}`);
      }
      if (typeof value !== 'string') {
        throw new Error(`The backup value for ${key} is invalid.`);
      }
      if (/^ssinfotech_comp_seq_\d{4}$/.test(key)) {
        if (!/^\d+$/.test(value)) throw new Error(`The employee sequence ${key} is invalid.`);
        return;
      }
      if (key === 'theme') {
        if (!['light', 'dark'].includes(value)) throw new Error('The saved theme is invalid.');
        return;
      }
      if (!(key in BACKUP_JSON_KEYS)) {
        throw new Error(`The backup contains an unsupported application key: ${key}`);
      }
      let parsed;
      try { parsed = JSON.parse(value); }
      catch { throw new Error(`The stored JSON for ${key} is invalid.`); }
      const expected = BACKUP_JSON_KEYS[key];
      if (expected === 'array' && !Array.isArray(parsed)) {
        throw new Error(`${key} must contain a list.`);
      }
      if (expected === 'object' && (!parsed || Array.isArray(parsed) || typeof parsed !== 'object')) {
        throw new Error(`${key} must contain an object.`);
      }
    });
  }

  function restoreLocalBackup(input) {
    const file = input?.files?.[0];
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) {
      alert('The selected backup is larger than the supported 10 MB limit.');
      input.value = '';
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      try {
        const backup = JSON.parse(reader.result);
        _validateBackup(backup);
        const created = backup.createdAt ? new Date(backup.createdAt).toLocaleString('en-IN') : 'unknown date';
        if (!confirm(`Restore backup from ${created}?\n\nThis will replace all current local application data. This action cannot be undone.`)) return;

        const current = {};
        _backupKeys().forEach(key => { current[key] = localStorage.getItem(key); });
        try {
          _backupKeys().forEach(key => localStorage.removeItem(key));
          Object.entries(backup.data).forEach(([key, value]) => localStorage.setItem(key, value));
        } catch (storageError) {
          _backupKeys().forEach(key => localStorage.removeItem(key));
          Object.entries(current).forEach(([key, value]) => localStorage.setItem(key, value));
          throw storageError;
        }

        alert('Backup restored successfully. The application will now reload.');
        window.location.reload();
      } catch (error) {
        alert(`Backup could not be restored. ${error.message}`);
      } finally {
        input.value = '';
      }
    };
    reader.onerror = () => {
      alert('The selected backup file could not be read.');
      input.value = '';
    };
    reader.readAsText(file);
  }

  // ── Project Data Export & Storage Helpers ───────────────────
  function _downloadFile(filename, content, mimeType = 'application/json') {
    try {
      const blob = new Blob([typeof content === 'string' ? content : JSON.stringify(content, null, 2)], { type: mimeType });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
    } catch (e) {
      alert(`Could not download file: ${e.message}`);
    }
  }

  function downloadClientRecord(id) {
    const client = DB.findById(id);
    if (!client) {
      alert('Client record not found.');
      return;
    }
    const safeName = (client.name || 'Client').replace(/[^a-zA-Z0-9_-]/g, '_');
    const ay = (client.ay || 'AY').replace(/[^a-zA-Z0-9_-]/g, '_');
    _downloadFile(`ITR_${safeName}_${ay}.json`, client);
  }

  function downloadAllClients() {
    const clients = DB.all();
    if (!clients.length) {
      alert('No saved client ITR records to export.');
      return;
    }
    const date = new Date().toISOString().slice(0, 10);
    _downloadFile(`ss-infotech-itr-clients-${date}.json`, clients);
  }

  function downloadSlipRecord(id) {
    const r = DB.getSlipRecords().find(rec => rec.id === id);
    if (!r) {
      alert('Salary slip record not found.');
      return;
    }
    const safeName = (r.empName || 'Employee').replace(/[^a-zA-Z0-9_-]/g, '_');
    const month = (r.month || 'Month').replace(/[^a-zA-Z0-9_-]/g, '_');
    const year = r.year || '2026';
    _downloadFile(`Payslip_${safeName}_${month}_${year}.json`, r);
  }

  function downloadAllSlips() {
    const slips = DB.getSlipRecords();
    if (!slips.length) {
      alert('No saved salary slips to export.');
      return;
    }
    const date = new Date().toISOString().slice(0, 10);
    _downloadFile(`ss-infotech-salary-slips-${date}.json`, slips);
  }

  function downloadStatementRecord(id) {
    const r = DB.getStatementRecords().find(rec => rec.id === id);
    if (!r) {
      alert('Statement record not found.');
      return;
    }
    const safeHolder = (r.holder || 'Account').replace(/[^a-zA-Z0-9_-]/g, '_');
    const safeBank = (r.bankName || 'Bank').replace(/[^a-zA-Z0-9_-]/g, '_');
    _downloadFile(`Statement_${safeBank}_${safeHolder}.json`, r);
  }

  function downloadAllStatements() {
    const stmts = DB.getStatementRecords();
    if (!stmts.length) {
      alert('No saved bank statements to export.');
      return;
    }
    const date = new Date().toISOString().slice(0, 10);
    _downloadFile(`ss-infotech-bank-statements-${date}.json`, stmts);
  }

  function downloadAllCompanies() {
    const companies = DB.getSlipCompanies();
    if (!companies.length) {
      alert('No saved company profiles to export.');
      return;
    }
    const date = new Date().toISOString().slice(0, 10);
    _downloadFile(`ss-infotech-companies-${date}.json`, companies);
  }

  function updateProjectStorageStats() {
    const itrs = DB.all().length;
    const stmts = DB.getStatementRecords().length;
    const slips = DB.getSlipRecords().length;
    const comps = DB.getSlipCompanies().length;

    const elItr = document.getElementById('store-itr-count');
    const elStmt = document.getElementById('store-stmt-count');
    const elSlip = document.getElementById('store-slip-count');
    const elComp = document.getElementById('store-comp-count');

    if (elItr) elItr.textContent = itrs;
    if (elStmt) elStmt.textContent = stmts;
    if (elSlip) elSlip.textContent = slips;
    if (elComp) elComp.textContent = comps;
  }

  function filterAdminSection(sec) {
    const nav = document.getElementById('admin-tab-nav');
    if (nav) {
      nav.querySelectorAll('.admin-tab-btn').forEach(btn => {
        if (btn.dataset.sec === sec) {
          btn.classList.add('active');
        } else {
          btn.classList.remove('active');
        }
      });
    }

    const cards = document.querySelectorAll('.admin-card-item');
    cards.forEach(card => {
      if (sec === 'all' || card.dataset.adminSec === sec) {
        card.style.display = '';
      } else {
        card.style.display = 'none';
      }
    });
  }

  function _renderAYTable() {
    const tbody = document.getElementById('ayTbody');
    if (!tbody) return;
    const ays = TaxEngine.AY_CONFIG;
    tbody.innerHTML = Object.entries(ays).map(([ay, cfg]) => {
      const isNew = (cfg.regime || '').toLowerCase().includes('new');
      const badgeClass = isNew ? 'badge bg-success-subtle text-success border border-success-subtle' : 'badge bg-secondary-subtle text-secondary border';
      return `
      <tr>
        <td class="fw-semibold font-monospace">AY ${ay}</td>
        <td><span class="${badgeClass}">${cfg.regime || 'New Default'}</span></td>
        <td class="text-success font-monospace">₹ ${(cfg.rebateLimit||0).toLocaleString('en-IN')}</td>
        <td class="font-monospace">₹ ${(cfg.basicExemption||0).toLocaleString('en-IN')}</td>
      </tr>
    `;
    }).join('');
  }

  function _renderCustomAYs() {
    const admin = DB.getAdmin();
    const list = document.getElementById('admin-ay-list');
    if (!list) return;
    const ays = admin.customAYs || [];
    if (ays.length === 0) {
      list.innerHTML = '<li class="text-muted small">No custom AYs added yet.</li>';
      return;
    }
    list.innerHTML = ays.map((ay, i) => `
      <li class="admin-ay-item">
        <span class="font-monospace">AY ${ay}</span>
        <button type="button" onclick="App.removeCustomAY(${i})" title="Remove AY"><i class="bi bi-x-circle-fill"></i></button>
      </li>
    `).join('');
  }

  function addCustomAY() {
    const el = document.getElementById('admin-new-ay');
    const val = (el?.value || '').trim();
    if (!val) return;
    const admin = DB.getAdmin();
    admin.customAYs = admin.customAYs || [];
    if (!admin.customAYs.includes(val)) {
      admin.customAYs.push(val);
      DB.saveAdmin(admin);
      _renderCustomAYs();
      _populateDynamicDropdowns();
    }
    if (el) el.value = '';
  }

  function removeCustomAY(index) {
    const admin = DB.getAdmin();
    if (admin.customAYs && admin.customAYs[index]) {
      admin.customAYs.splice(index, 1);
      DB.saveAdmin(admin);
      _renderCustomAYs();
      _populateDynamicDropdowns();
    }
  }

  const DED_ICONS = {
    'Bank': 'bi-bank',
    'Payment Gateway': 'bi-credit-card',
    'Company': 'bi-building',
    'Government': 'bi-flag',
    'Logistics': 'bi-truck',
    'Other': 'bi-person-badge'
  };

  const PRESET_DEDUCTORS = [
    { name: 'Razorpay Payments Pvt Ltd', tan: 'DELR12345E', category: 'Payment Gateway' },
    { name: 'Paytm Payments Bank Ltd', tan: 'NOIM12345E', category: 'Payment Gateway' },
    { name: 'PhonePe Private Limited', tan: 'BANP12345E', category: 'Payment Gateway' },
    { name: 'State Bank of India', tan: 'MUMS12345E', category: 'Bank' },
    { name: 'HDFC Bank Ltd', tan: 'MUMH12345E', category: 'Bank' },
    { name: 'ICICI Bank Ltd', tan: 'MUMI12345E', category: 'Bank' },
    { name: 'Delhivery Limited', tan: 'GREP12345E', category: 'Logistics' },
    { name: 'BlueDart Express Limited', tan: 'CHEP12345E', category: 'Logistics' },
  ];

  function _getDedIcon(cat) {
    return DED_ICONS[cat] || 'bi-person-badge';
  }

  function _renderDeductors() {
    const admin = DB.getAdmin();
    const list = document.getElementById('admin-deductor-list');
    if (!list) return;
    const deds = admin.deductors || [];
    if (deds.length === 0) {
      list.innerHTML = '<div class="ded-empty-msg">No deductors added yet. Click <i class="bi bi-lightning-fill"></i> to add presets.</div>';
      return;
    }
    const searchVal = (document.getElementById('admin-deductor-search')?.value || '').toLowerCase();
    const filtered = deds.map((d, i) => ({ ...d, idx: i })).filter(d => {
      if (!searchVal) return true;
      return d.name.toLowerCase().includes(searchVal) || d.tan.toLowerCase().includes(searchVal) || (d.category || '').toLowerCase().includes(searchVal);
    });
    if (filtered.length === 0) {
      list.innerHTML = '<div class="ded-empty-msg">No matching deductors found.</div>';
      return;
    }
    list.innerHTML = filtered.map(d => `
      <div class="ded-admin-card" id="ded-admin-${d.idx}">
        <div class="ded-card-icon"><i class="bi ${_getDedIcon(d.category)}"></i></div>
        <div class="ded-admin-info">
          <div class="ded-admin-name">${d.name}</div>
          <div class="ded-admin-tan">${d.tan}</div>
        </div>
        <span class="ded-admin-cat">${d.category || 'Other'}</span>
        <div class="ded-admin-actions">
          <button class="btn btn-sm btn-outline-primary" onclick="App.editCustomDeductor(${d.idx})" title="Edit"><i class="bi bi-pencil"></i></button>
          <button class="btn btn-sm btn-danger" onclick="App.removeCustomDeductor(${d.idx})" title="Delete"><i class="bi bi-trash"></i></button>
        </div>
      </div>
    `).join('');
  }

  function filterDeductors() {
    _renderDeductors();
  }

  function editCustomDeductor(index) {
    const admin = DB.getAdmin();
    const d = admin.deductors[index];
    if (!d) return;
    const container = document.getElementById(`ded-admin-${index}`);
    if (!container) return;
    container.outerHTML = `
      <div class="ded-admin-edit-row" id="ded-admin-${index}">
        <input type="text" class="form-control form-control-sm" id="edit-ded-name-${index}" value="${d.name}" placeholder="Name" />
        <input type="text" class="form-control form-control-sm text-uppercase" id="edit-ded-tan-${index}" value="${d.tan}" placeholder="TAN" maxlength="10" />
        <select class="form-select form-select-sm" id="edit-ded-cat-${index}">
          ${['Company','Bank','Payment Gateway','Government','Logistics','Other'].map(c => `<option value="${c}" ${c === (d.category||'Other') ? 'selected' : ''}>${c}</option>`).join('')}
        </select>
        <button class="btn btn-sm btn-success" onclick="App.saveEditDeductor(${index})" title="Save"><i class="bi bi-check-lg"></i></button>
        <button class="btn btn-sm btn-secondary" onclick="App._renderDeductors()" title="Cancel"><i class="bi bi-x-lg"></i></button>
      </div>
    `;
  }

  function saveEditDeductor(index) {
    const name = document.getElementById(`edit-ded-name-${index}`)?.value.trim();
    const tan = document.getElementById(`edit-ded-tan-${index}`)?.value.trim().toUpperCase();
    const category = document.getElementById(`edit-ded-cat-${index}`)?.value;
    if (!name || !tan) return alert('Both Name and TAN are required.');
    const admin = DB.getAdmin();
    if (admin.deductors[index]) {
      admin.deductors[index] = { name, tan, category: category || 'Other' };
      DB.saveAdmin(admin);
      _renderDeductors();
      _populateDynamicDropdowns();
    }
  }

  function addCustomDeductor() {
    const nameEl = document.getElementById('admin-new-deductor-name');
    const tanEl = document.getElementById('admin-new-deductor-tan');
    const catEl = document.getElementById('admin-new-deductor-cat');
    const name = nameEl.value.trim();
    const tan = tanEl.value.trim().toUpperCase();
    const category = catEl?.value || 'Other';
    if (!name || !tan) return alert('Both Name and TAN are required.');
    const admin = DB.getAdmin();
    admin.deductors = admin.deductors || [];
    admin.deductors.push({ name, tan, category });
    DB.saveAdmin(admin);
    _renderDeductors();
    _populateDynamicDropdowns();
    nameEl.value = '';
    tanEl.value = '';
  }

  function addPresetDeductors() {
    const admin = DB.getAdmin();
    admin.deductors = admin.deductors || [];
    const existingTANs = new Set(admin.deductors.map(d => d.tan));
    let added = 0;
    PRESET_DEDUCTORS.forEach(p => {
      if (!existingTANs.has(p.tan)) {
        admin.deductors.push({ ...p });
        added++;
      }
    });
    if (added === 0) return alert('All preset deductors already exist.');
    DB.saveAdmin(admin);
    _renderDeductors();
    _populateDynamicDropdowns();
    alert(`${added} preset deductor(s) added.`);
  }

  function removeCustomDeductor(index) {
    const admin = DB.getAdmin();
    if (admin.deductors && admin.deductors[index]) {
      admin.deductors.splice(index, 1);
      DB.saveAdmin(admin);
      _renderDeductors();
      _populateDynamicDropdowns();
    }
  }

  // ── Bank Configurations ──────────────────────────────────────
  const PRESET_BANKS = [
    'STATE BANK OF INDIA',
    'HDFC BANK LTD',
    'ICICI BANK LTD',
    'AXIS BANK LTD',
    'KOTAK MAHINDRA BANK LTD',
    'PUNJAB NATIONAL BANK',
    'BANK OF BARODA',
    'CANARA BANK',
    'UNION BANK OF INDIA',
    'BANK OF INDIA',
    'INDIAN OVERSEAS BANK',
    'UCO BANK',
    'CENTRAL BANK OF INDIA',
    'IDBI BANK LTD',
    'INDUSIND BANK LTD',
    'YES BANK LTD',
    'FEDERAL BANK LTD',
    'SOUTH INDIAN BANK LTD',
    'KARUR VYSYA BANK',
    'CITY UNION BANK LTD',
    'BANDHAN BANK LTD',
    'PAYTM PAYMENTS BANK LTD',
    'AIRTEL PAYMENTS BANK LTD',
    'INDIA POST PAYMENTS BANK',
    'RBL BANK LTD',
    'AU SMALL FINANCE BANK',
    'EQUITAS SMALL FINANCE BANK'
  ];

  function _resolveBankLogo(bankName, savedLogoData) {
    if (!bankName) return null;
    // 1. Check local offline BankLogos repository first for authentic official logos
    if (typeof BankLogos !== 'undefined' && BankLogos.hasLogo && BankLogos.hasLogo(bankName)) {
      return BankLogos.getLogo(bankName);
    }
    // 2. If savedLogoData is a valid base64 data URL (custom upload), use it
    if (savedLogoData && typeof savedLogoData === 'string' && savedLogoData.startsWith('data:image/')) {
      return savedLogoData;
    }
    // 3. Fallback to BankLogos getLogo
    if (typeof BankLogos !== 'undefined' && BankLogos.getLogo) {
      const repoLogo = BankLogos.getLogo(bankName);
      if (repoLogo) return repoLogo;
    }
    // 4. If savedLogoData is a valid external URL (not broken cdn.brandfetch.io)
    if (savedLogoData && typeof savedLogoData === 'string' && !savedLogoData.includes('cdn.brandfetch.io')) {
      return savedLogoData;
    }
    return null;
  }

  function _bankName(b) {
    return (typeof b === 'string') ? b : (b.name || '');
  }

  function _matchBank(bankName, bankList) {
    if (!bankName || !Array.isArray(bankList) || bankList.length === 0) return null;
    const clean = bankName.trim().toUpperCase();
    if (!clean) return null;

    // 1. Exact match
    const exact = bankList.find(b => _bankName(b).trim().toUpperCase() === clean);
    if (exact) return exact;

    // 2. Normalized key match via BankLogos
    if (typeof BankLogos !== 'undefined' && BankLogos.normalizeKey) {
      const targetKey = BankLogos.normalizeKey(clean);
      if (targetKey && targetKey !== 'DEFAULT' && targetKey.length > 1) {
        const keyMatch = bankList.find(b => {
          const bKey = BankLogos.normalizeKey(_bankName(b));
          return bKey === targetKey;
        });
        if (keyMatch) return keyMatch;
      }
    }

    // 3. Exact stripped word match (without LTD, LIMITED, BANK, PVT, PRIVATE, CO, CORP)
    const strippedClean = clean.replace(/\s+(LIMITED|LTD|PVT|PRIVATE|BANK|CO|CORP)\b/g, '').trim();
    if (strippedClean.length > 2) {
      const strippedMatch = bankList.find(b => {
        const bStripped = _bankName(b).trim().toUpperCase().replace(/\s+(LIMITED|LTD|PVT|PRIVATE|BANK|CO|CORP)\b/g, '').trim();
        return bStripped === strippedClean;
      });
      if (strippedMatch) return strippedMatch;
    }

    return null;
  }

  function _getBankConfigs() {
    const admin = DB.getAdmin();
    const list = admin.bankConfigs;
    if (Array.isArray(list) && list.length > 0) {
      let needsSave = false;
      const repaired = list.map(b => {
        if (typeof b === 'string') {
          needsSave = true;
          const logoData = _resolveBankLogo(b, null);
          return { name: b, logoData, logoText: b.slice(0, 2) };
        }
        const name = b.name || '';
        const logoData = _resolveBankLogo(name, b.logoData);
        if (b.logoData !== logoData) {
          needsSave = true;
          return { ...b, logoData };
        }
        return b;
      });
      if (needsSave) {
        admin.bankConfigs = repaired;
        DB.saveAdmin(admin);
      }
      return repaired;
    }
    return PRESET_BANKS.map(name => {
      const logoData = _resolveBankLogo(name, null);
      return { name, logoData, logoText: name.slice(0, 2) };
    });
  }

  function _getBankConfigObjects() {
    return _getBankConfigs().map(b => {
      const name = typeof b === 'string' ? b : (b.name || '');
      const logoData = _resolveBankLogo(name, typeof b === 'object' ? b.logoData : null);
      return {
        name,
        ifsc: b.ifsc || '',
        branch: b.branch || '',
        logoData,
        logoText: b.logoText || name.slice(0, 2),
        address: b.address || ''
      };
    });
  }

  const BRANDFETCH_API_KEY = 'lJ4dlae8YLrTAa4ueHBuIHSocbZFY7V4Wh5QmB402s_vUAfl-VC6fVNwIGIc7qyCYP42a-6mWMgvQdlcbG7pcQ';
  let _bankLogoData = null;

  function previewBankLogo(name, previewId) {
    const el = document.getElementById(previewId);
    if (!el) return;
    if (!name) {
      el.innerHTML = `<span>B</span>`;
      el.style.background = '';
      el.style.color = '';
      el.style.border = '';
      if (previewId === 'bs-logo-preview') _statementBankLogoData = null;
      if (previewId === 'bss-logo-preview') _salaryStatementBankLogoData = null;
      return;
    }
    const initial = name.trim().toUpperCase().slice(0, 2) || 'B';
    const bankConfigs = _getBankConfigObjects();
    const matchedBank = _matchBank(name, bankConfigs);
    const savedLogo = matchedBank ? matchedBank.logoData : null;
    const localLogo = _resolveBankLogo(name, savedLogo);
    if (localLogo) {
      if (previewId === 'bs-logo-preview') {
        _statementBankLogoData = localLogo;
      } else if (previewId === 'bss-logo-preview') {
        _salaryStatementBankLogoData = localLogo;
      }
      el.style.background = '#fff';
      el.style.border = '1px solid #e2e8f0';
      el.innerHTML = `<img src="${localLogo}" alt="${initial}" style="width:100%;height:100%;object-fit:contain;" />`;
      return;
    }
    if (previewId === 'bs-logo-preview') {
      _statementBankLogoData = null;
    } else if (previewId === 'bss-logo-preview') {
      _salaryStatementBankLogoData = null;
    }
    el.style.background = '#1a3c6e';
    el.style.color = '#fff';
    el.style.border = '1px solid #e2e8f0';
    el.innerHTML = `<span style="font-weight:800;font-size:14px;color:#fff;">${initial}</span>`;
  }

  // ── IFSC & Bank Auto-Lookup Engine (Razorpay IFSC API + Brandfetch) ──
  async function fetchBankDetailsByIFSC(ifscCode, options = {}) {
    const ifsc = (ifscCode || '').trim().toUpperCase();
    if (ifsc.length !== 11) {
      if (options.manualAlert) alert('Please enter a valid 11-character IFSC code (e.g. SBIN0011371).');
      return null;
    }

    const statusEl = options.statusElId ? document.getElementById(options.statusElId) : null;
    if (statusEl) {
      statusEl.innerHTML = `<span class="spinner-border spinner-border-sm text-primary"></span> Fetching branch & address...`;
    }

    try {
      const res = await fetch(`https://ifsc.razorpay.com/${ifsc}`);
      if (!res.ok) throw new Error('Bank details not found for this IFSC code.');
      const data = await res.json();

      // Auto-fill bank name / select bank dropdown
      if (options.bankNameElId) {
        const nameEl = document.getElementById(options.bankNameElId);
        if (nameEl) {
          const rawBank = (data.BANK || '').trim();
          const cleanBank = rawBank.toUpperCase();
          if (nameEl.tagName === 'SELECT') {
            let opt = Array.from(nameEl.options).find(o => {
              if (!o.value) return false;
              const ov = o.value.toUpperCase().trim();
              if (ov === cleanBank) return true;
              if (typeof BankLogos !== 'undefined' && BankLogos.normalizeKey) {
                const k1 = BankLogos.normalizeKey(cleanBank);
                const k2 = BankLogos.normalizeKey(ov);
                if (k1 && k1 !== 'DEFAULT' && k1 === k2) return true;
              }
              const s1 = cleanBank.replace(/\s+(LIMITED|LTD|PVT|PRIVATE|BANK)\b/g, '').trim();
              const s2 = ov.replace(/\s+(LIMITED|LTD|PVT|PRIVATE|BANK)\b/g, '').trim();
              if (s1.length > 2 && s1 === s2) return true;
              return false;
            });
            if (!opt && rawBank) {
              opt = document.createElement('option');
              opt.value = rawBank.toUpperCase();
              opt.textContent = rawBank.toUpperCase();
              nameEl.appendChild(opt);
            }
            if (opt) {
              nameEl.value = opt.value;
            } else if (rawBank) {
              nameEl.value = rawBank.toUpperCase();
            }
          } else {
            // For INPUT elements
            nameEl.value = cleanBank;
          }

          if (options.bankNameElId === 'bs-bank') {
            const styleEl = document.getElementById('bs-style');
            if (styleEl && cleanBank.includes('ICICI')) {
              styleEl.value = 'icici';
            }
          }
        }
      }

      // Auto-fill branch (ONLY the concise branch name)
      if (options.branchElId) {
        const branchEl = document.getElementById(options.branchElId);
        if (branchEl && data.BRANCH) {
          branchEl.value = data.BRANCH.trim().toUpperCase();
        }
      }

      // Auto-fill branch code (last 4 digits of IFSC)
      if (options.codeElId) {
        const codeEl = document.getElementById(options.codeElId);
        if (codeEl && data.IFSC) {
          codeEl.value = data.IFSC.slice(-4);
        }
      }

      // Auto-fill full address
      if (options.addressElId) {
        const addrEl = document.getElementById(options.addressElId);
        if (addrEl) {
          const parts = [data.ADDRESS, data.CITY, data.STATE].filter(Boolean);
          addrEl.value = parts.join(', ').toUpperCase();
        }
      }

      // Auto-fetch Brandfetch logo
      if (options.previewId && data.BANK) {
        await fetchBrandfetchBankLogo(data.BANK, options.previewId);
      }

      if (statusEl) {
        statusEl.innerHTML = `<span class="text-success fw-semibold"><i class="bi bi-check-circle-fill"></i> ${data.BANK} — Branch: ${data.BRANCH}</span>`;
      }
      return data;
    } catch (err) {
      console.warn('Razorpay IFSC API error:', err);
      if (statusEl) {
        statusEl.innerHTML = `<span class="text-danger"><i class="bi bi-exclamation-triangle-fill"></i> ${err.message || 'IFSC not found'}</span>`;
      }
      if (options.manualAlert) alert(err.message || 'IFSC code not found.');
      return null;
    }
  }

  function onAdminIFSCInput(val) {
    const clean = (val || '').trim().toUpperCase();
    if (clean.length === 11) {
      fetchBankDetailsByIFSC(clean, {
        bankNameElId: 'admin-new-bank-name',
        branchElId: 'admin-new-bank-branch',
        addressElId: 'admin-new-bank-address',
        statusElId: 'admin-ifsc-status',
        previewId: 'bank-logo-preview',
        overwriteName: true
      });
    } else {
      const statusEl = document.getElementById('admin-ifsc-status');
      if (statusEl) statusEl.innerHTML = '';
    }
  }

  function lookupAdminIFSC() {
    const ifsc = document.getElementById('admin-new-bank-ifsc')?.value.trim();
    fetchBankDetailsByIFSC(ifsc, {
      bankNameElId: 'admin-new-bank-name',
      branchElId: 'admin-new-bank-branch',
      addressElId: 'admin-new-bank-address',
      statusElId: 'admin-ifsc-status',
      previewId: 'bank-logo-preview',
      manualAlert: true,
      overwriteName: true
    });
  }

  function onEditBankIFSCInput(index, val) {
    const clean = (val || '').trim().toUpperCase();
    if (clean.length === 11) {
      fetchBankDetailsByIFSC(clean, {
        bankNameElId: `edit-bank-name-${index}`,
        branchElId: `edit-bank-branch-${index}`,
        addressElId: `edit-bank-address-${index}`,
        previewId: `edit-bank-logo-preview-${index}`,
        overwriteName: true
      });
    }
  }

  function lookupEditBankIFSC(index) {
    const ifsc = document.getElementById(`edit-bank-ifsc-${index}`)?.value.trim();
    fetchBankDetailsByIFSC(ifsc, {
      bankNameElId: `edit-bank-name-${index}`,
      branchElId: `edit-bank-branch-${index}`,
      addressElId: `edit-bank-address-${index}`,
      previewId: `edit-bank-logo-preview-${index}`,
      manualAlert: true,
      overwriteName: true
    });
  }

  function onStatementIFSCInput(val) {
    const clean = (val || '').replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
    if (clean.length === 11) {
      // First check if an existing admin config matches this IFSC
      const banks = _getBankConfigObjects();
      const matched = banks.find(b => b.ifsc && b.ifsc.toUpperCase() === clean);
      if (matched) {
        // Only populate branch & address - make NO effect on bank name or bank logo
        const branchEl = document.getElementById('bs-branch');
        if (branchEl && matched.branch) branchEl.value = (matched.branch || matched.name).toUpperCase();
        const codeEl = document.getElementById('bs-branchcode');
        if (codeEl) codeEl.value = clean.slice(-4);
        const addrEl = document.getElementById('bs-branchaddress');
        if (addrEl && matched.address) addrEl.value = matched.address.toUpperCase();
        return;
      }

      // Auto-fetch branch & address from Razorpay IFSC API (make NO effect on bank name or logo)
      fetchBankDetailsByIFSC(clean, {
        branchElId: 'bs-branch',
        codeElId: 'bs-branchcode',
        addressElId: 'bs-branchaddress'
      });
    }
  }

  function lookupStatementIFSC() {
    const ifsc = document.getElementById('bs-ifsc')?.value.trim();
    if (!ifsc) {
      alert('Please enter an 11-character IFSC code first.');
      return;
    }
    const clean = ifsc.replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
    if (clean.length !== 11) {
      alert('Please enter a valid 11-character IFSC code.');
      return;
    }
    const banks = _getBankConfigObjects();
    const matched = banks.find(b => b.ifsc && b.ifsc.toUpperCase() === clean);
    if (matched) {
      const branchEl = document.getElementById('bs-branch');
      if (branchEl && matched.branch) branchEl.value = (matched.branch || matched.name).toUpperCase();
      const codeEl = document.getElementById('bs-branchcode');
      if (codeEl) codeEl.value = clean.slice(-4);
      const addrEl = document.getElementById('bs-branchaddress');
      if (addrEl && matched.address) addrEl.value = matched.address.toUpperCase();
      return;
    }

    fetchBankDetailsByIFSC(clean, {
      branchElId: 'bs-branch',
      codeElId: 'bs-branchcode',
      addressElId: 'bs-branchaddress',
      manualAlert: true
    });
  }

  async function fetchBrandfetchBankLogo(name, previewId = 'bank-logo-preview') {
    const inputName = name || document.getElementById('admin-new-bank-name')?.value.trim();
    if (!inputName) { alert('Enter bank name first.'); return; }
    const preview = document.getElementById(previewId);
    if (preview) {
      preview.innerHTML = `<span class="spinner-border spinner-border-sm text-primary" style="width:16px;height:16px;"></span>`;
    }

    if (typeof BankLogos !== 'undefined' && BankLogos.fetchFromBrandfetch) {
      const res = await BankLogos.fetchFromBrandfetch(inputName);
      if (res && res.dataUrl) {
        if (previewId === 'bs-logo-preview') {
          _statementBankLogoData = res.dataUrl;
        } else if (previewId.startsWith('edit-bank-logo-preview')) {
          _editBankLogoData = res.dataUrl;
        } else {
          _bankLogoData = res.dataUrl;
        }
        if (preview) {
          preview.innerHTML = `<img src="${res.dataUrl}" alt="Logo" style="width:100%;height:100%;object-fit:contain;" />`;
          preview.style.background = '#fff';
        }
        return;
      }
    }

    const domain = (typeof BankStatementEngine !== 'undefined' && BankStatementEngine.getBankDomain)
      ? BankStatementEngine.getBankDomain(inputName)
      : 'bank.com';
    const bfUrl = (typeof BankLogos !== 'undefined' && BankLogos.getLogo(inputName))
      || `https://cdn.brandfetch.io/${domain}/w/400/h/400?c=${encodeURIComponent(BRANDFETCH_API_KEY)}`;
    if (previewId === 'bs-logo-preview') {
      _statementBankLogoData = bfUrl;
    } else if (previewId.startsWith('edit-bank-logo-preview')) {
      _editBankLogoData = bfUrl;
    } else {
      _bankLogoData = bfUrl;
    }
    if (preview) {
      preview.innerHTML = `<img src="${bfUrl}" alt="Logo" style="width:100%;height:100%;object-fit:contain;" onerror="this.onerror=null;this.src='https://www.google.com/s2/favicons?domain=${domain}&sz=128';" />`;
      preview.style.background = '#fff';
    }
  }

  function uploadBankLogo(input) {
    const file = input.files[0];
    if (!file) return;
    if (file.size > 500 * 1024) { alert('Image must be under 500KB.'); input.value = ''; return; }
    const reader = new FileReader();
    reader.onload = function(e) {
      _bankLogoData = e.target.result;
      const preview = document.getElementById('bank-logo-preview');
      if (preview) {
        preview.innerHTML = `<img src="${_bankLogoData}" alt="Logo" style="width:100%;height:100%;object-fit:contain;" />`;
        preview.style.background = 'transparent';
      }
    };
    reader.readAsDataURL(file);
  }

  function addBankConfig() {
    const nameEl = document.getElementById('admin-new-bank-name');
    const name = (nameEl?.value || '').trim().toUpperCase();
    if (!name) return alert('Bank name is required.');
    const ifscEl = document.getElementById('admin-new-bank-ifsc');
    const ifsc = (ifscEl?.value || '').trim().toUpperCase();
    const branchEl = document.getElementById('admin-new-bank-branch');
    const branch = (branchEl?.value || '').trim().toUpperCase();
    const address = document.getElementById('admin-new-bank-address')?.value.trim() || '';
    const admin = DB.getAdmin();
    admin.bankConfigs = _getBankConfigs();
    if (admin.bankConfigs.some(b => _bankName(b) === name)) return alert('Bank already exists.');
    
    let logoData = _resolveBankLogo(name, _bankLogoData);
    let logoText = name.toUpperCase().slice(0, 2);
    admin.bankConfigs.push({ name, ifsc, branch, logoData, logoText, address });
    DB.saveAdmin(admin);
    _renderBankConfigs();
    _populateBankStatementDropdown();
    nameEl.value = '';
    if (ifscEl) ifscEl.value = '';
    if (branchEl) branchEl.value = '';
    const addrEl = document.getElementById('admin-new-bank-address'); if (addrEl) addrEl.value = '';
    const uploadEl = document.getElementById('bank-logo-upload'); if (uploadEl) uploadEl.value = '';
    const statusEl = document.getElementById('admin-ifsc-status'); if (statusEl) statusEl.innerHTML = '';
    _bankLogoData = null;
    const lp = document.getElementById('bank-logo-preview');
    if (lp) { lp.innerHTML = '<span>B</span>'; lp.style.background = ''; }
  }

  function removeBankConfig(index) {
    const admin = DB.getAdmin();
    admin.bankConfigs = _getBankConfigs();
    if (admin.bankConfigs[index]) {
      admin.bankConfigs.splice(index, 1);
      DB.saveAdmin(admin);
      _renderBankConfigs();
    }
  }

  function filterBankConfigs() {
    _renderBankConfigs();
  }

  function _renderBankConfigs() {
    const list = document.getElementById('admin-bank-list');
    if (!list) return;
    const banks = _getBankConfigObjects();
    if (banks.length === 0) {
      list.innerHTML = '<div class="ded-empty-msg">No banks added yet. Click <i class="bi bi-lightning-fill"></i> to add presets.</div>';
      return;
    }
    const searchVal = (document.getElementById('admin-bank-search')?.value || '').toLowerCase();
    const filtered = banks.map((b, i) => ({ bank: b, idx: i })).filter(b => {
      if (!searchVal) return true;
      const combined = `${b.bank.name} ${b.bank.branch || ''} ${b.bank.address || ''} ${b.bank.ifsc || ''}`.toLowerCase();
      return combined.includes(searchVal);
    });
    if (filtered.length === 0) {
      list.innerHTML = '<div class="ded-empty-msg">No matching banks found.</div>';
      return;
    }
    list.innerHTML = filtered.map(({ bank, idx }) => {
      const initial = (bank.logoText || bank.name.slice(0, 2) || 'B').toUpperCase();
      const resolvedLogo = _resolveBankLogo(bank.name, bank.logoData);

      const logoHtml = resolvedLogo
        ? `<img src="${resolvedLogo}" alt="${initial}" style="width:100%;height:100%;object-fit:contain;" onerror="this.onerror=null;this.parentElement.style.background='#1a3c6e';this.parentElement.innerHTML='<span style=\\'font-weight:800;color:#fff;\\'>${initial}</span>';" />`
        : `<span style="font-weight:800;color:#fff;font-size:14px;">${initial}</span>`;
      const gradStyle = resolvedLogo ? 'background:#fff;border:1px solid #e2e8f0;' : 'background:linear-gradient(135deg,#1a3c6e,#2a5298);border:1px solid #e2e8f0;display:flex;align-items:center;justify-content:center;';
      return `
      <div class="ded-admin-card" id="bank-admin-${idx}">
        <div class="slip-comp-card-logo" style="${gradStyle}">${logoHtml}</div>
        <div class="ded-admin-info">
          <div class="ded-admin-name d-flex align-items-center gap-2 flex-wrap">
            <span>${_esc(bank.name)}</span>
            ${bank.ifsc ? `<span class="badge bg-light text-primary border font-monospace" style="font-size:10px;">${_esc(bank.ifsc)}</span>` : ''}
            ${bank.branch ? `<span class="badge bg-info-subtle text-info border" style="font-size:10px;"><i class="bi bi-geo-alt me-1"></i>${_esc(bank.branch)}</span>` : ''}
          </div>
          ${bank.address ? `<div class="ded-admin-tan" style="font-family:inherit;font-size:11px"><i class="bi bi-geo-alt-fill text-danger me-1"></i>${_esc(bank.address)}</div>` : ''}
        </div>
        <div class="ded-admin-actions">
          <button class="btn btn-sm btn-outline-primary" onclick="App.editBankConfig(${idx})" title="Edit"><i class="bi bi-pencil"></i></button>
          <button class="btn btn-sm btn-danger" onclick="App.removeBankConfig(${idx})" title="Delete"><i class="bi bi-trash"></i></button>
        </div>
      </div>
    `;
    }).join('');
  }

  let _editBankLogoData = null;

  function uploadEditBankLogo(index, input) {
    const file = input.files[0];
    if (!file) return;
    if (file.size > 500 * 1024) { alert('Image must be under 500KB.'); input.value = ''; return; }
    const reader = new FileReader();
    reader.onload = function(e) {
      _editBankLogoData = e.target.result;
      const preview = document.getElementById(`edit-bank-logo-preview-${index}`);
      if (preview) {
        preview.innerHTML = `<img src="${_editBankLogoData}" alt="Logo" style="width:100%;height:100%;object-fit:contain;" />`;
        preview.style.background = 'transparent';
      }
    };
    reader.readAsDataURL(file);
  }

  async function fetchBrandfetchEditBankLogo(index) {
    const name = document.getElementById(`edit-bank-name-${index}`)?.value.trim();
    if (!name) { alert('Enter bank name first.'); return; }
    const preview = document.getElementById(`edit-bank-logo-preview-${index}`);
    if (preview) {
      preview.innerHTML = `<span class="spinner-border spinner-border-sm text-primary" style="width:14px;height:14px;"></span>`;
    }

    if (typeof BankLogos !== 'undefined' && BankLogos.fetchFromBrandfetch) {
      const res = await BankLogos.fetchFromBrandfetch(name);
      if (res && res.dataUrl) {
        _editBankLogoData = res.dataUrl;
        if (preview) {
          preview.innerHTML = `<img src="${res.dataUrl}" alt="Logo" style="width:100%;height:100%;object-fit:contain;" />`;
          preview.style.background = '#fff';
        }
        return;
      }
    }

    const domain = (typeof BankStatementEngine !== 'undefined' && BankStatementEngine.getBankDomain)
      ? BankStatementEngine.getBankDomain(name)
      : 'bank.com';
    const bfUrl = (typeof BankLogos !== 'undefined' && BankLogos.getLogo(name))
      || `https://cdn.brandfetch.io/${domain}/w/400/h/400?c=${encodeURIComponent(BRANDFETCH_API_KEY)}`;
    _editBankLogoData = bfUrl;
    if (preview) {
      preview.innerHTML = `<img src="${bfUrl}" alt="Logo" style="width:100%;height:100%;object-fit:contain;" onerror="this.onerror=null;this.src='https://www.google.com/s2/favicons?domain=${domain}&sz=128';" />`;
      preview.style.background = '#fff';
    }
  }

  function editBankConfig(index) {
    const admin = DB.getAdmin();
    const banks = _getBankConfigs();
    const raw = banks[index];
    if (!raw) return;
    const bank = typeof raw === 'string' ? { name: raw } : raw;
    const container = document.getElementById(`bank-admin-${index}`);
    if (!container) return;
    const resolvedLogo = _resolveBankLogo(bank.name, bank.logoData);
    _editBankLogoData = resolvedLogo;
    const initial = (bank.logoText || bank.name.slice(0, 2) || 'B').toUpperCase();
    const logoHtml = resolvedLogo
      ? `<img src="${resolvedLogo}" alt="${initial}" style="width:100%;height:100%;object-fit:contain;" onerror="this.onerror=null;this.parentElement.style.background='#1a3c6e';this.parentElement.innerHTML='<span style=\\'font-weight:800;color:#fff;\\'>${initial}</span>';" />`
      : `<span style="font-weight:800;color:#fff;font-size:14px;">${initial}</span>`;
    container.outerHTML = `
      <div class="ded-admin-edit-row" id="bank-admin-${index}">
        <div class="slip-comp-logo-preview" id="edit-bank-logo-preview-${index}">${logoHtml}</div>
        <input type="text" class="form-control form-control-sm text-uppercase font-monospace" id="edit-bank-ifsc-${index}" value="${_esc(bank.ifsc || '')}" placeholder="IFSC" style="width:105px" oninput="App.onEditBankIFSCInput(${index}, this.value)" />
        <button class="btn btn-outline-primary btn-sm px-2" type="button" onclick="App.lookupEditBankIFSC(${index})" title="Fetch by IFSC"><i class="bi bi-search"></i></button>
        <input type="text" class="form-control form-control-sm text-uppercase" id="edit-bank-name-${index}" value="${_esc(bank.name)}" placeholder="Bank Name" style="width:140px" oninput="App.previewBankLogo(this.value, 'edit-bank-logo-preview-${index}')" />
        <input type="text" class="form-control form-control-sm text-uppercase" id="edit-bank-branch-${index}" value="${_esc(bank.branch || '')}" placeholder="Branch Name" style="width:120px" />
        <input type="text" class="form-control form-control-sm text-uppercase" id="edit-bank-address-${index}" value="${_esc(bank.address || '')}" placeholder="Branch Address" style="width:150px" />
        <button class="btn btn-outline-info btn-sm px-2" onclick="App.fetchBrandfetchEditBankLogo(${index})" title="Fetch official logo from Brandfetch"><i class="bi bi-cloud-arrow-down-fill"></i></button>
        <label class="btn btn-outline-secondary btn-sm mb-0 px-2" title="Upload Logo Image"><i class="bi bi-image"></i><input type="file" accept="image/*" hidden onchange="App.uploadEditBankLogo(${index}, this)" /></label>
        <button class="btn btn-sm btn-success" onclick="App.saveEditBankConfig(${index})" title="Save"><i class="bi bi-check-lg"></i></button>
        <button class="btn btn-sm btn-secondary" onclick="App._renderBankConfigs()" title="Cancel"><i class="bi bi-x-lg"></i></button>
      </div>
    `;
  }

  function saveEditBankConfig(index) {
    const name = document.getElementById(`edit-bank-name-${index}`)?.value.trim().toUpperCase();
    if (!name) return alert('Bank name is required.');
    const ifsc = document.getElementById(`edit-bank-ifsc-${index}`)?.value.trim().toUpperCase() || '';
    const branch = document.getElementById(`edit-bank-branch-${index}`)?.value.trim().toUpperCase() || '';
    const address = document.getElementById(`edit-bank-address-${index}`)?.value.trim() || '';
    const admin = DB.getAdmin();
    const banks = _getBankConfigs();
    const raw = banks[index];
    const existing = (typeof raw === 'string') ? { name: raw } : raw;
    admin.bankConfigs = banks;
    let logoData = _resolveBankLogo(name, _editBankLogoData !== null ? _editBankLogoData : existing.logoData);
    const logoText = name.slice(0, 2);
    admin.bankConfigs[index] = { ...existing, name, ifsc, branch, address, logoData, logoText };
    DB.saveAdmin(admin);
    _renderBankConfigs();
    _populateBankStatementDropdown();
  }

  function addPresetBanks() {
    const admin = DB.getAdmin();
    admin.bankConfigs = _getBankConfigs();
    const existing = new Set(admin.bankConfigs.map(b => _bankName(b)));
    let added = 0;
    PRESET_BANKS.forEach(name => {
      if (!existing.has(name)) {
        const logoData = (typeof BankLogos !== 'undefined' && BankLogos.getLogo(name)) || null;
        admin.bankConfigs.push({ name, logoData, logoText: name.slice(0, 2) });
        added++;
      }
    });
    if (added === 0) return alert('All preset banks already exist.');
    DB.saveAdmin(admin);
    _renderBankConfigs();
    alert(`${added} preset bank(s) added with official Brandfetch repository logos.`);
  }

  // Bank name autocomplete for wizard
  function _showBankSuggestions(inputEl) {
    _hideBankSuggestions();
    const val = (inputEl.value || '').trim().toUpperCase();
    if (val.length < 1) return;
    const bankConfigs = _getBankConfigObjects();
    if (!bankConfigs.length) return;
    const matches = bankConfigs.filter(b => b.name.includes(val)).slice(0, 8);
    if (!matches.length) return;

    const wrapper = document.createElement('div');
    wrapper.className = 'bank-suggestions';
    wrapper.id = 'bank-suggestions-list';
    matches.forEach(m => {
      const item = document.createElement('div');
      item.className = 'bank-suggestion-item';
      item.textContent = m.name;
      item.addEventListener('mousedown', (e) => {
        e.preventDefault();
        inputEl.value = m.name;
        _hideBankSuggestions();
      });
      wrapper.appendChild(item);
    });
    inputEl.parentNode.style.position = 'relative';
    inputEl.parentNode.appendChild(wrapper);
  }

  function _hideBankSuggestions() {
    const existing = document.getElementById('bank-suggestions-list');
    if (existing) existing.remove();
  }

  function _initBankAutocomplete() {
    document.addEventListener('input', (e) => {
      if (e.target.id && e.target.id.startsWith('bank-name-')) {
        _showBankSuggestions(e.target);
      }
    });
    document.addEventListener('focus', (e) => {
      if (e.target.id && e.target.id.startsWith('bank-name-')) {
        _showBankSuggestions(e.target);
      }
    });
    document.addEventListener('blur', (e) => {
      if (e.target.id && e.target.id.startsWith('bank-name-')) {
        setTimeout(() => _hideBankSuggestions(), 150);
      }
    });
  }

  const DEFAULT_NATURE_CODES = [
    { nature: "Mobile Retail", code: "0201" },
    { nature: "Retail Trade", code: "0204" },
    { nature: "General Trading", code: "0202" },
    { nature: "Electronics", code: "0203" },
    { nature: "Grocery", code: "0205" },
    { nature: "Other Services", code: "0714" },
    { nature: "Others", code: "0715" }
  ];

  const PRESET_NATURE_CODES = [
    { nature: "MOBILE RETAIL", code: "0201" },
    { nature: "RETAIL TRADE", code: "0204" },
    { nature: "GENERAL TRADING", code: "0202" },
    { nature: "ELECTRONICS", code: "0203" },
    { nature: "GROCERY", code: "0205" },
    { nature: "WHOLESALE TRADE", code: "0101" },
    { nature: "COMMISSION AGENTS", code: "0206" },
    { nature: "HOTEL AND RESTAURANT", code: "5010" },
    { nature: "TRANSPORT", code: "6010" },
    { nature: "IT SOFTWARE SERVICES", code: "0713" },
    { nature: "OTHER SERVICES", code: "0714" },
    { nature: "OTHERS", code: "0715" },
    { nature: "CONTRACTOR", code: "0711" },
    { nature: "PROFESSIONAL SERVICES", code: "0712" },
    { nature: "REAL ESTATE", code: "0104" },
    { nature: "MANUFACTURING", code: "0102" },
  ];

  function _getNatureCodes() {
    const admin = DB.getAdmin();
    return admin.natureCodes && admin.natureCodes.length ? admin.natureCodes : DEFAULT_NATURE_CODES;
  }

  function _renderNatureCodes() {
    const list = document.getElementById('admin-nature-list');
    if (!list) return;
    const codes = _getNatureCodes();
    if (codes.length === 0) {
      list.innerHTML = '<div class="ded-empty-msg">No nature codes added yet. Click <i class="bi bi-lightning-fill"></i> to add presets.</div>';
      return;
    }
    const searchVal = (document.getElementById('admin-nature-search')?.value || '').toLowerCase();
    const filtered = codes.map((c, i) => ({ ...c, idx: i })).filter(c => {
      if (!searchVal) return true;
      return c.nature.toLowerCase().includes(searchVal) || c.code.toLowerCase().includes(searchVal);
    });
    if (filtered.length === 0) {
      list.innerHTML = '<div class="ded-empty-msg">No matching nature codes found.</div>';
      return;
    }
    list.innerHTML = filtered.map(c => `
      <div class="ded-admin-card" id="nature-admin-${c.idx}">
        <div class="ded-card-icon"><i class="bi bi-sliders"></i></div>
        <div class="ded-admin-info">
          <div class="ded-admin-name">${c.nature}</div>
          <div class="ded-admin-tan">${c.code}</div>
        </div>
        <div class="ded-admin-actions">
          <button class="btn btn-sm btn-outline-primary" onclick="App.editNatureCode(${c.idx})" title="Edit"><i class="bi bi-pencil"></i></button>
          <button class="btn btn-sm btn-danger" onclick="App.removeNatureCode(${c.idx})" title="Delete"><i class="bi bi-trash"></i></button>
        </div>
      </div>
    `).join('');
  }

  function filterNatureCodes() {
    _renderNatureCodes();
  }

  function addNatureCode() {
    const natureEl = document.getElementById('admin-new-nature');
    const codeEl = document.getElementById('admin-new-nature-code');
    const nature = (natureEl.value || '').trim().toUpperCase();
    const code = (codeEl.value || '').trim();
    if (!nature || !code) return alert('Both Nature and Code are required.');
    const admin = DB.getAdmin();
    admin.natureCodes = _getNatureCodes();
    const exists = admin.natureCodes.some(c => c.nature.toUpperCase() === nature && c.code === code);
    if (exists) return alert('This nature code combination already exists.');
    admin.natureCodes.push({ nature, code });
    DB.saveAdmin(admin);
    _renderNatureCodes();
    _populateDynamicDropdowns();
    natureEl.value = '';
    codeEl.value = '';
  }

  function removeNatureCode(index) {
    const admin = DB.getAdmin();
    admin.natureCodes = _getNatureCodes();
    if (admin.natureCodes[index]) {
      admin.natureCodes.splice(index, 1);
      DB.saveAdmin(admin);
      _renderNatureCodes();
      _populateDynamicDropdowns();
    }
  }

  function editNatureCode(index) {
    const admin = DB.getAdmin();
    const codes = _getNatureCodes();
    const c = codes[index];
    if (!c) return;
    const container = document.getElementById(`nature-admin-${index}`);
    if (!container) return;
    container.outerHTML = `
      <div class="ded-admin-edit-row" id="nature-admin-${index}">
        <input type="text" class="form-control form-control-sm text-uppercase" id="edit-nature-name-${index}" value="${c.nature}" placeholder="Nature" />
        <input type="text" class="form-control form-control-sm" id="edit-nature-code-${index}" value="${c.code}" placeholder="Code" />
        <button class="btn btn-sm btn-success" onclick="App.saveEditNatureCode(${index})" title="Save"><i class="bi bi-check-lg"></i></button>
        <button class="btn btn-sm btn-secondary" onclick="App._renderNatureCodes()" title="Cancel"><i class="bi bi-x-lg"></i></button>
      </div>
    `;
  }

  function saveEditNatureCode(index) {
    const nature = document.getElementById(`edit-nature-name-${index}`)?.value.trim().toUpperCase();
    const code = document.getElementById(`edit-nature-code-${index}`)?.value.trim();
    if (!nature || !code) return alert('Both Nature and Code are required.');
    const admin = DB.getAdmin();
    admin.natureCodes = _getNatureCodes();
    if (admin.natureCodes[index]) {
      admin.natureCodes[index] = { nature, code };
      DB.saveAdmin(admin);
      _renderNatureCodes();
      _populateDynamicDropdowns();
    }
  }

  function addPresetNatureCodes() {
    const admin = DB.getAdmin();
    admin.natureCodes = _getNatureCodes();
    const existing = new Set(admin.natureCodes.map(c => c.nature + '|' + c.code));
    let added = 0;
    PRESET_NATURE_CODES.forEach(c => {
      if (!existing.has(c.nature + '|' + c.code)) {
        admin.natureCodes.push({ ...c });
        added++;
      }
    });
    if (added === 0) return alert('All preset nature codes already exist.');
    DB.saveAdmin(admin);
    _renderNatureCodes();
    _populateDynamicDropdowns();
    alert(`${added} preset nature code(s) added.`);
  }

  function _populateDynamicDropdowns() {
    const admin = DB.getAdmin();
    
    const aySelect = document.getElementById('f-ay');
    if (aySelect) {
      const currentVal = aySelect.value;
      aySelect.innerHTML = `
        <option value="2023-24">AY 2023-24</option>
        <option value="2024-25">AY 2024-25</option>
        <option value="2025-26">AY 2025-26</option>
        <option value="2026-27" selected>AY 2026-27 (Current A.Y.)</option>
      `;
      (admin.customAYs || []).forEach(ay => {
        aySelect.innerHTML += `<option value="${ay}">AY ${ay}</option>`;
      });
      if (currentVal) aySelect.value = currentVal;
    }

    const dedContainer = document.getElementById('f-deductor-container');
    if (dedContainer) {
      const selectedVals = Array.from(document.querySelectorAll('.ded-card.selected')).map(c => c.dataset.value);
      const isAutoSelected = selectedVals.includes('auto') || selectedVals.length === 0;

      const autoCard = `
        <div class="ded-card auto-card ${isAutoSelected ? 'selected' : ''}" data-value="auto" onclick="App.onDeductorChange(this)">
          <div class="ded-card-icon"><i class="bi bi-magic"></i></div>
          <div class="ded-card-body">
            <div class="ded-card-name">Auto-generate</div>
            <div class="ded-card-tan">Random deductors for 26AS</div>
          </div>
          <div class="ded-card-check"><i class="bi ${isAutoSelected ? 'bi-check-circle-fill' : 'bi-circle'}"></i></div>
        </div>
      `;

      let customCards = '';
      (admin.deductors || []).forEach((d, i) => {
        const isSelected = selectedVals.includes(String(i));
        customCards += `
          <div class="ded-card ${isSelected ? 'selected' : ''}" data-value="${i}" onclick="App.onDeductorChange(this)">
            <div class="ded-card-icon"><i class="bi ${_getDedIcon(d.category)}"></i></div>
            <div class="ded-card-body">
              <div class="ded-card-name">${d.name}</div>
              <div class="ded-card-tan">${d.tan}</div>
            </div>
            <div class="ded-card-check"><i class="bi ${isSelected ? 'bi-check-circle-fill' : 'bi-circle'}"></i></div>
          </div>
        `;
      });

      dedContainer.innerHTML = autoCard + customCards;
    }

    const natureSelect = document.getElementById('f-nature');
    if (natureSelect) {
      const currentVal = natureSelect.value;
      natureSelect.innerHTML = `<option value="">-- Select --</option>`;
      const codes = _getNatureCodes();
      codes.forEach(c => {
        natureSelect.innerHTML += `<option value="${c.nature}" data-code="${c.code}">${c.nature}</option>`;
      });
      if (currentVal) natureSelect.value = currentVal;
    }
  }

  // ── STCG Detail Generator ───────────────────────────────────
  function _generateSTCGDetails(totalSTCG) {
    const scrips = ['RELIANCE INDUSTRIES', 'TCS LTD', 'HDFC BANK', 'INFOSYS LTD', 'ICICI BANK'];
    const n = Math.min(3, Math.ceil(totalSTCG / 5000));
    const entries = [];
    let rem = totalSTCG;

    for (let i = 0; i < n; i++) {
      const gain = i < n-1 ? Math.round(rem * (0.3 + Math.random() * 0.3) / 10) * 10 : rem;
      const cost  = Math.round((Math.random() * 50000 + 10000) / 100) * 100;
      const sale  = cost + gain;
      const buyM  = Math.floor(Math.random() * 6) + 4; // Apr–Sep
      const sellM = buyM + Math.floor(Math.random() * 3) + 1;
      const buyD  = Math.floor(Math.random() * 28) + 1;
      const sellD = Math.floor(Math.random() * 28) + 1;
      const y     = 2024;

      entries.push({
        scrip:    scrips[i % scrips.length],
        buyDate:  `${String(buyD).padStart(2,'0')}/${String(buyM).padStart(2,'0')}/${y}`,
        sellDate: `${String(sellD).padStart(2,'0')}/${String(sellM > 12 ? 12 : sellM).padStart(2,'0')}/${sellM > 12 ? y+1 : y}`,
        cost, sale, gain,
      });
      rem -= gain;
    }
    return entries;
  }

  // ── Salary Slip Companies (Admin) ─────────────────────────
  let _slipLogoData = null; // stores base64 logo during add

  function previewAutoLogo(name, previewId) {
    const el = document.getElementById(previewId);
    if (!el || !name) return;
    const initial = name.trim().toUpperCase().slice(0, 2) || 'C';
    const colors = [
      ['#6366f1','#8b5cf6'],['#059669','#10b981'],['#dc2626','#ef4444'],
      ['#d97706','#f59e0b'],['#0891b2','#06b6d4'],['#7c3aed','#a855f7'],
      ['#2563eb','#3b82f6'],['#c026d3','#d946ef'],
    ];
    const ci = name.charCodeAt(0) % colors.length;
    const grad = `linear-gradient(135deg, ${colors[ci][0]}, ${colors[ci][1]})`;
    el.style.background = grad;
    el.innerHTML = `<span>${initial}</span>`;
    el.dataset.autoGen = 'true';
  }

  function autoGenSlipLogo() {
    const name = document.getElementById('admin-new-slip-comp-name')?.value.trim();
    if (!name) { alert('Enter company name first.'); return; }
    _slipLogoData = null;
    previewAutoLogo(name, 'slip-logo-preview');
  }

  function uploadSlipLogo(input) {
    const file = input.files[0];
    if (!file) return;
    if (file.size > 500 * 1024) { alert('Image must be under 500KB.'); input.value = ''; return; }
    const reader = new FileReader();
    reader.onload = function(e) {
      _slipLogoData = e.target.result;
      const preview = document.getElementById('slip-logo-preview');
      if (preview) {
        preview.innerHTML = `<img src="${_slipLogoData}" alt="Logo" />`;
        preview.style.background = 'transparent';
        delete preview.dataset.autoGen;
      }
    };
    reader.readAsDataURL(file);
  }

  function _renderSlipCompanies() {
    const list = document.getElementById('admin-slip-comp-list');
    if (!list) return;
    const comps = DB.getSlipCompanies();
    if (!comps.length) {
      list.innerHTML = '<div class="text-center text-muted py-3" style="font-size:12px">No companies added yet. Add a company above to use in Salary Slip generator.</div>';
      return;
    }
    list.innerHTML = comps.map((c, i) => {
      const logoHtml = c.logoData
        ? `<img src="${c.logoData}" alt="Logo" />`
        : `<span>${(c.logoText || c.name[0] || 'C').toUpperCase()}</span>`;
      const gradStyle = c.logoData ? 'background:transparent' : '';
      return `
      <div class="ded-admin-card" id="slip-comp-${i}">
        <div class="slip-comp-card-logo" style="${gradStyle}">${logoHtml}</div>
        <div class="ded-admin-info">
          <div class="ded-admin-name">${_esc(c.name)}${c.tagline ? ' <small style="color:#888;font-weight:400">— ' + _esc(c.tagline) + '</small>' : ''}</div>
          <div class="ded-admin-tan" style="font-family:inherit;font-size:11px">${_esc(c.address || 'No address')}</div>
        </div>
        <div class="ded-admin-actions">
          <button class="btn btn-sm btn-outline-primary" onclick="App.editSlipCompany(${i})"><i class="bi bi-pencil"></i></button>
          <button class="btn btn-sm btn-outline-danger" onclick="App.removeSlipCompany(${i})"><i class="bi bi-trash"></i></button>
        </div>
      </div>`;
    }).join('');
  }

  function addSlipCompany() {
    const name = document.getElementById('admin-new-slip-comp-name')?.value.trim();
    const addr = document.getElementById('admin-new-slip-comp-addr')?.value.trim();
    const phone = document.getElementById('admin-new-slip-comp-phone')?.value.trim();
    const email = document.getElementById('admin-new-slip-comp-email')?.value.trim();
    const tagline = document.getElementById('admin-new-slip-comp-tagline')?.value.trim();
    if (!name) { alert('Please enter a company name.'); return; }

    // Determine logo: uploaded base64 > auto-gen from name
    let logoData = _slipLogoData || null;
    let logoText = name.toUpperCase().slice(0, 2);
    const preview = document.getElementById('slip-logo-preview');
    if (!logoData && preview?.dataset.autoGen === 'true') {
      // auto-gen: we store logoText, the engine renders gradient+initial
      logoText = name.toUpperCase().slice(0, 2);
    }

    DB.saveSlipCompany({ name, address: addr, logoText, phone, email, tagline, logoData });
    _slipLogoData = null;
    ['admin-new-slip-comp-name','admin-new-slip-comp-addr','admin-new-slip-comp-phone','admin-new-slip-comp-email','admin-new-slip-comp-tagline'].forEach(id => {
      const el = document.getElementById(id); if (el) el.value = '';
    });
    const lp = document.getElementById('slip-logo-preview');
    if (lp) { lp.innerHTML = '<span>C</span>'; lp.style.background = ''; delete lp.dataset.autoGen; }
    const uploadEl = document.getElementById('slip-comp-logo-upload');
    if (uploadEl) uploadEl.value = '';
    _renderSlipCompanies();
    _populateSlipCompanyDropdown();
  }

  function removeSlipCompany(i) {
    if (!confirm('Delete this company?')) return;
    const comps = DB.getSlipCompanies();
    if (comps[i]) { DB.removeSlipCompany(comps[i].id); }
    _renderSlipCompanies();
    _populateSlipCompanyDropdown();
  }

  function editSlipCompany(i) {
    const comps = DB.getSlipCompanies();
    const c = comps[i];
    if (!c) return;
    const card = document.getElementById(`slip-comp-${i}`);
    if (!card) return;
    const logoHtml = c.logoData
      ? `<img src="${c.logoData}" alt="Logo" style="width:100%;height:100%;object-fit:cover" />`
      : `<span>${(c.logoText || 'C').toUpperCase()}</span>`;
    card.innerHTML = `
      <div class="slip-comp-card-logo" style="${c.logoData ? 'background:transparent' : ''}">${logoHtml}</div>
      <div class="ded-admin-info" style="flex:1;display:flex;gap:6px;flex-wrap:wrap">
        <input type="text" class="form-control form-control-sm text-uppercase" value="${_esc(c.name)}" id="slip-edit-name-${i}" style="width:140px" placeholder="Name" />
        <input type="text" class="form-control form-control-sm" value="${_esc(c.address || '')}" id="slip-edit-addr-${i}" style="width:200px" placeholder="Address" />
        <input type="text" class="form-control form-control-sm" value="${_esc(c.phone || '')}" id="slip-edit-phone-${i}" style="width:100px" placeholder="Phone" />
        <input type="text" class="form-control form-control-sm" value="${_esc(c.email || '')}" id="slip-edit-email-${i}" style="width:130px" placeholder="Email" />
        <input type="text" class="form-control form-control-sm" value="${_esc(c.tagline || '')}" id="slip-edit-tagline-${i}" style="width:160px" placeholder="Tagline (optional)" />
      </div>
      <div class="ded-admin-actions" style="gap:4px">
        <button class="btn btn-sm btn-outline-success" onclick="App.autoGenEditSlipLogo(${i})" title="Auto-generate logo"><i class="bi bi-magic"></i></button>
        <label class="btn btn-sm btn-outline-primary mb-0" title="Upload logo"><i class="bi bi-image"></i><input type="file" accept="image/*" hidden onchange="App.uploadEditSlipLogo(${i},this)" /></label>
        <button class="btn btn-sm btn-success" onclick="App.saveEditSlipCompany(${i})"><i class="bi bi-check-lg"></i></button>
        <button class="btn btn-sm btn-outline-secondary" onclick="App._renderSlipCompanies()"><i class="bi bi-x-lg"></i></button>
      </div>`;
  }

  function saveEditSlipCompany(i) {
    const comps = DB.getSlipCompanies();
    const c = comps[i];
    if (!c) return;
    c.name = document.getElementById(`slip-edit-name-${i}`)?.value.trim() || c.name;
    c.address = document.getElementById(`slip-edit-addr-${i}`)?.value.trim();
    c.phone = document.getElementById(`slip-edit-phone-${i}`)?.value.trim();
    c.email = document.getElementById(`slip-edit-email-${i}`)?.value.trim();
    c.tagline = document.getElementById(`slip-edit-tagline-${i}`)?.value.trim();
    DB.saveSlipCompany(c);
    _renderSlipCompanies();
    _populateSlipCompanyDropdown();
  }

  let _editSlipLogoData = null;

  function autoGenEditSlipLogo(i) {
    const comps = DB.getSlipCompanies();
    const c = comps[i];
    if (!c) return;
    const colors = [
      ['#6366f1','#8b5cf6'],['#059669','#10b981'],['#dc2626','#ef4444'],
      ['#d97706','#f59e0b'],['#0891b2','#06b6d4'],['#7c3aed','#a855f7'],
      ['#2563eb','#3b82f6'],['#c026d3','#d946ef'],
    ];
    const ci = (c.name || '').charCodeAt(0) % colors.length;
    // Generate canvas logo
    const canvas = document.createElement('canvas');
    canvas.width = 200; canvas.height = 200;
    const ctx = canvas.getContext('2d');
    const grad = ctx.createLinearGradient(0, 0, 200, 200);
    grad.addColorStop(0, colors[ci][0]);
    grad.addColorStop(1, colors[ci][1]);
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.roundRect(0, 0, 200, 200, 24);
    ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 90px Inter, Arial, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText((c.name || 'C').toUpperCase().slice(0, 2), 100, 105);
    c.logoData = canvas.toDataURL('image/png');
    c.logoText = (c.name || 'C').toUpperCase().slice(0, 2);
    DB.saveSlipCompany(c);
    _renderSlipCompanies();
  }

  function uploadEditSlipLogo(i, input) {
    const file = input.files[0];
    if (!file) return;
    if (file.size > 500 * 1024) { alert('Image must be under 500KB.'); input.value = ''; return; }
    const comps = DB.getSlipCompanies();
    const c = comps[i];
    if (!c) return;
    const reader = new FileReader();
    reader.onload = function(e) {
      c.logoData = e.target.result;
      DB.saveSlipCompany(c);
      _renderSlipCompanies();
    };
    reader.readAsDataURL(file);
  }

  function _populateSlipCompanyDropdown() {
    const sel = document.getElementById('ss-company');
    if (!sel) return;
    const comps = DB.getSlipCompanies();
    const cur = sel.value;
    sel.innerHTML = '<option value="">— Select Company —</option>' +
      comps.map(c => `<option value="${c.id}">${_esc(c.name)}</option>`).join('');
    if (cur) sel.value = cur;
  }

  // ── Salary Slip Mode & Auto-fill ──────────────────────────
  function setSlipMode(mode) {
    const autoBtn = document.getElementById('ss-mode-auto');
    const manualBtn = document.getElementById('ss-mode-manual');
    const autoPanel = document.getElementById('ss-auto-panel');
    const manualPanel = document.getElementById('ss-manual-panel');
    if (mode === 'auto') {
      autoBtn?.classList.add('active');
      manualBtn?.classList.remove('active');
      autoPanel?.classList.add('active');
      manualPanel?.classList.remove('active');
    } else {
      autoBtn?.classList.remove('active');
      manualBtn?.classList.add('active');
      autoPanel?.classList.remove('active');
      manualPanel?.classList.add('active');
    }
  }

  function _calcAutoBreakdown(gross, cityType, pfApplicable) {
    const basic = Math.round(gross * 0.40);
    const hraRate = cityType === 'metro' ? 0.50 : 0.40;
    const hra = Math.round(basic * hraRate);
    const pf = pfApplicable === 'yes' ? Math.round(basic * 0.12) : 0;
    const special = gross - basic - hra;

    // Professional Tax (monthly) - West Bengal slab
    let pt = 0;
    if (gross >= 30000) pt = 200;
    else if (gross >= 25000) pt = 150;
    else if (gross >= 20000) pt = 100;
    else if (gross >= 15000) pt = 50;
    else pt = 0;

    const totalDed = pf + pt;
    const net = gross - totalDed;
    return { basic, hra, special, pf, pt, totalDed, net };
  }

  function previewSlipAuto() {
    const gross = parseFloat(document.getElementById('ss-gross-salary')?.value) || 0;
    const cityType = document.getElementById('ss-city-type')?.value || 'metro';
    const pfApplicable = document.getElementById('ss-pf-applicable')?.value || 'yes';

    if (gross <= 0) {
      ['ss-auto-basic','ss-auto-hra','ss-auto-special','ss-auto-pf','ss-auto-pt','ss-auto-net'].forEach(id => {
        const el = document.getElementById(id); if (el) el.textContent = '₹ 0';
      });
      return;
    }

    const b = _calcAutoBreakdown(gross, cityType, pfApplicable);
    const fmt = n => '₹ ' + n.toLocaleString('en-IN');
    document.getElementById('ss-auto-basic').textContent = fmt(b.basic);
    document.getElementById('ss-auto-hra').textContent = fmt(b.hra);
    document.getElementById('ss-auto-special').textContent = fmt(b.special);
    document.getElementById('ss-auto-pf').textContent = fmt(b.pf);
    document.getElementById('ss-auto-pt').textContent = fmt(b.pt);
    document.getElementById('ss-auto-net').textContent = fmt(b.net);
  }

  function applyAutoFill() {
    const gross = parseFloat(document.getElementById('ss-gross-salary')?.value) || 0;
    if (gross <= 0) { alert('Enter gross salary first.'); return; }
    const cityType = document.getElementById('ss-city-type')?.value || 'metro';
    const pfApplicable = document.getElementById('ss-pf-applicable')?.value || 'yes';
    const b = _calcAutoBreakdown(gross, cityType, pfApplicable);

    // Set earnings
    const earnContainer = document.getElementById('ss-earnings-list');
    earnContainer.innerHTML = `
      <div class="ss-earn-row" data-type="basic">
        <input type="text" class="form-control form-control-sm" value="Basic" readonly />
        <input type="number" class="form-control form-control-sm ss-earning-actual" value="${b.basic}" min="0" oninput="App.calcSlipNet()" placeholder="Actual" />
        <input type="number" class="form-control form-control-sm ss-earning-salary" value="${b.basic}" min="0" oninput="App.calcSlipNet()" placeholder="Salary" />
      </div>
      <div class="ss-earn-row" data-type="hra">
        <input type="text" class="form-control form-control-sm" value="HRA" readonly />
        <input type="number" class="form-control form-control-sm ss-earning-actual" value="${b.hra}" min="0" oninput="App.calcSlipNet()" placeholder="Actual" />
        <input type="number" class="form-control form-control-sm ss-earning-salary" value="${b.hra}" min="0" oninput="App.calcSlipNet()" placeholder="Salary" />
      </div>
      <div class="ss-earn-row" data-type="special">
        <input type="text" class="form-control form-control-sm" value="Special Allowance" readonly />
        <input type="number" class="form-control form-control-sm ss-earning-actual" value="${b.special}" min="0" oninput="App.calcSlipNet()" placeholder="Actual" />
        <input type="number" class="form-control form-control-sm ss-earning-salary" value="${b.special}" min="0" oninput="App.calcSlipNet()" placeholder="Salary" />
      </div>`;

    // Set deductions
    const dedContainer = document.getElementById('ss-deductions-list');
    let dedHtml = '';
    if (b.pf > 0) {
      dedHtml += `
      <div class="ss-ded-row" data-type="pf">
        <input type="text" class="form-control form-control-sm" value="Employee PF" readonly />
        <input type="number" class="form-control form-control-sm ss-deduction-amt" value="${b.pf}" min="0" oninput="App.calcSlipNet()" placeholder="Deducted" />
      </div>`;
    }
    if (b.pt > 0) {
      dedHtml += `
      <div class="ss-ded-row" data-type="pt">
        <input type="text" class="form-control form-control-sm" value="Professional Tax" readonly />
        <input type="number" class="form-control form-control-sm ss-deduction-amt" value="${b.pt}" min="0" oninput="App.calcSlipNet()" placeholder="Deducted" />
      </div>`;
    }
    dedContainer.innerHTML = dedHtml;

    calcSlipNet();

    // Switch to manual mode so user can see/edit the values
    setSlipMode('manual');
  }

  // ── Salary Slip Multi-Month State & Logic ───────────────────
  const SLIP_MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];
  let _selectedSlipMonths = ['April'];

  function _getDaysInMonth(monthName, year) {
    const mi = SLIP_MONTHS.indexOf(monthName);
    if (mi === -1) return 30;
    const y = parseInt(year, 10) || new Date().getFullYear();
    return new Date(y, mi + 1, 0).getDate();
  }

  function _renderSlipMonthChips() {
    const container = document.getElementById('ss-months-grid');
    if (!container) return;
    const abbrs = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    container.innerHTML = SLIP_MONTHS.map((m, i) => {
      const active = _selectedSlipMonths.includes(m) ? 'active' : '';
      return `
        <div class="ss-month-chip ${active}" data-month="${m}" onclick="App.toggleSlipMonth('${m}')" title="${m}">
          <span class="mc-abbr">${abbrs[i]}</span>
          <span class="mc-full">${m}</span>
        </div>`;
    }).join('');
    _updateSlipMonthsBadge();
  }

  function _updateSlipMonthsBadge() {
    const badge = document.getElementById('ss-months-badge');
    if (!badge) return;
    const count = _selectedSlipMonths.length;
    if (count === 0) {
      badge.className = 'badge bg-danger-subtle text-danger fw-semibold';
      badge.textContent = 'No Month Selected';
    } else if (count === 1) {
      badge.className = 'badge bg-primary-subtle text-primary fw-semibold';
      badge.textContent = `1 Month Selected (${_selectedSlipMonths[0]})`;
    } else if (count === 12) {
      badge.className = 'badge bg-success-subtle text-success fw-semibold';
      badge.textContent = `All 12 Months Selected (Full Year)`;
    } else {
      badge.className = 'badge bg-primary-subtle text-primary fw-semibold';
      badge.textContent = `${count} Months Selected (${_selectedSlipMonths.join(', ')})`;
    }
  }

  function toggleSlipMonth(monthName) {
    if (_selectedSlipMonths.includes(monthName)) {
      if (_selectedSlipMonths.length === 1) {
        _selectedSlipMonths = [];
      } else {
        _selectedSlipMonths = _selectedSlipMonths.filter(m => m !== monthName);
      }
    } else {
      _selectedSlipMonths.push(monthName);
    }
    const monthSel = document.getElementById('ss-month');
    if (monthSel && _selectedSlipMonths.length > 0) {
      monthSel.value = _selectedSlipMonths[0];
    }
    _renderSlipMonthChips();
    _updateDaysInMonth();
  }

  function selectSlipMonthsPreset(preset) {
    if (preset === 'all') {
      _selectedSlipMonths = [...SLIP_MONTHS];
    } else if (preset === 'last3') {
      const curMonthIdx = new Date().getMonth();
      const m1 = SLIP_MONTHS[(curMonthIdx - 2 + 12) % 12];
      const m2 = SLIP_MONTHS[(curMonthIdx - 1 + 12) % 12];
      const m3 = SLIP_MONTHS[curMonthIdx];
      _selectedSlipMonths = [m1, m2, m3];
    } else if (preset === 'last6') {
      const curMonthIdx = new Date().getMonth();
      const list = [];
      for (let i = 5; i >= 0; i--) {
        list.push(SLIP_MONTHS[(curMonthIdx - i + 12) % 12]);
      }
      _selectedSlipMonths = list;
    } else if (preset === 'fy') {
      _selectedSlipMonths = ['April','May','June','July','August','September','October','November','December','January','February','March'];
    } else if (preset === 'clear') {
      _selectedSlipMonths = [];
    }
    const monthSel = document.getElementById('ss-month');
    if (monthSel && _selectedSlipMonths.length > 0) {
      monthSel.value = _selectedSlipMonths[0];
    }
    _renderSlipMonthChips();
    _updateDaysInMonth();
  }

  function getSelectedSlipMonths() {
    if (!_selectedSlipMonths || !_selectedSlipMonths.length) {
      const single = document.getElementById('ss-month')?.value;
      return single ? [single] : ['April'];
    }
    return [..._selectedSlipMonths];
  }

  // ── Salary Slip Page Logic ─────────────────────────────────
  function _initSlipPage() {
    _populateSlipCompanyDropdown();
    _populateSlipYearDropdown();
    _renderSlipMonthChips();
    _renderSlipCompanies();
    _renderSavedSlipFilters();
    renderSavedSlips();
    _updateDaysInMonth();

    // Auto-generate emp code when company changes
    const compSel = document.getElementById('ss-company');
    if (compSel && !compSel.dataset.bound) {
      compSel.dataset.bound = '1';
      compSel.addEventListener('change', () => {
        const compId = compSel.value;
        const comps = DB.getSlipCompanies();
        const comp = comps.find(c => c.id === compId);
        if (comp) {
          const code = DB.generateEmpCode(comp.name);
          const empIdEl = document.getElementById('ss-emp-id');
          if (empIdEl) empIdEl.value = code;
        }
      });
    }

    // Auto-set days when month or year changes
    const monthSel = document.getElementById('ss-month');
    const yearSel = document.getElementById('ss-year');
    if (monthSel && !monthSel.dataset.bound) {
      monthSel.dataset.bound = '1';
      monthSel.addEventListener('change', _updateDaysInMonth);
    }
    if (yearSel && !yearSel.dataset.bound) {
      yearSel.dataset.bound = '1';
      yearSel.addEventListener('change', _updateDaysInMonth);
    }
  }

  function _updateDaysInMonth() {
    const activeMonth = _selectedSlipMonths.length ? _selectedSlipMonths[0] : (document.getElementById('ss-month')?.value || 'April');
    const year = parseInt(document.getElementById('ss-year')?.value) || new Date().getFullYear();
    const days = _getDaysInMonth(activeMonth, year);
    const totalEl = document.getElementById('ss-total-days');
    const paidEl = document.getElementById('ss-days-paid');
    if (totalEl) totalEl.value = days;
    if (paidEl && (!paidEl.dataset.userEdited || paidEl.dataset.userEdited !== '1')) {
      paidEl.value = days;
    }
  }

  function _renderSavedSlipFilters() {
    const sel = document.getElementById('ss-filter-comp');
    if (!sel) return;
    const comps = DB.getSlipCompanies();
    const cur = sel.value;
    sel.innerHTML = '<option value="">All Companies</option>' +
      comps.map(c => `<option value="${c.id}">${_esc(c.name)}</option>`).join('');
    if (cur) sel.value = cur;
  }

  function renderSavedSlips() {
    const container = document.getElementById('ss-saved-list');
    if (!container) return;
    const filterComp = document.getElementById('ss-filter-comp')?.value || '';
    const filterSearch = (document.getElementById('ss-filter-search')?.value || '').toLowerCase();

    let records = DB.getSlipRecords();
    if (filterComp) records = records.filter(r => r.companyId === filterComp);
    if (filterSearch) {
      records = records.filter(r =>
        (r.empName || '').toLowerCase().includes(filterSearch) ||
        (r.empCode || '').toLowerCase().includes(filterSearch) ||
        (r.companyName || '').toLowerCase().includes(filterSearch)
      );
    }

    if (!records.length) {
      container.innerHTML = '<div class="text-center text-muted py-4" style="font-size:12px">No saved salary slips yet.</div>';
      return;
    }

    container.innerHTML = records.map(r => {
      const initials = (r.empName || 'E').split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase();
      const slipMonth = r.month || '';
      const slipYear = r.year || '';
      const netPay = parseFloat(r.netPay) || 0;
      const statusClass = netPay > 0 ? 'nil' : 'nil';
      const date = r.createdAt ? new Date(r.createdAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '';
      return `
      <div class="ss-saved-card">
        <div class="ss-saved-avatar">${initials}</div>
        <div class="ss-saved-info">
          <div class="ss-saved-name">${_esc(r.empName || 'Unknown')}</div>
          <div class="ss-saved-meta">
            <code>${_esc(r.empCode || '--')}</code> &nbsp;|&nbsp;
            ${_esc(r.companyName || '')} &nbsp;|&nbsp;
            ${slipMonth} ${slipYear} &nbsp;|&nbsp;
            ${date}
          </div>
        </div>
        <div class="ss-saved-amount">₹ ${(netPay).toLocaleString('en-IN', {minimumFractionDigits:2})}</div>
        <div class="ss-saved-actions">
          <button class="btn btn-sm btn-outline-primary" onclick="App.editSlipRecord('${r.id}')" title="Edit"><i class="bi bi-pencil"></i></button>
          <button class="btn btn-sm btn-outline-success" onclick="App.reprintSlipRecord('${r.id}')" title="Reprint"><i class="bi bi-printer"></i></button>
          <button class="btn btn-sm btn-outline-secondary" onclick="App.downloadSlipRecord('${r.id}')" title="Download JSON"><i class="bi bi-download"></i></button>
          <button class="btn btn-sm btn-outline-danger" onclick="App.deleteSlipRecord('${r.id}')" title="Delete"><i class="bi bi-trash"></i></button>
        </div>
      </div>`;
    }).join('');
    updateProjectStorageStats();
  }

  function editSlipRecord(id) {
    const records = DB.getSlipRecords();
    const r = records.find(rec => rec.id === id);
    if (!r) return;
    if (r.month) {
      _selectedSlipMonths = [r.month];
      _renderSlipMonthChips();
      const monthSel = document.getElementById('ss-month');
      if (monthSel) monthSel.value = r.month;
    }
    if (r.year) document.getElementById('ss-year').value = r.year;
    _setVal('ss-emp-id', r.empCode);
    _setVal('ss-emp-name', r.empName);
    _setVal('ss-emp-location', r.location);
    _setVal('ss-emp-division', r.division);
    _setVal('ss-emp-designation', r.designation);
    _setVal('ss-emp-doj', r.doj);
    _setVal('ss-emp-uan', r.uan);
    _setVal('ss-emp-esic', r.esic);
    _setVal('ss-emp-pan', r.pan);
    _setVal('ss-emp-bank', r.bankName);
    _setVal('ss-emp-acno', r.acNo);
    _setVal('ss-emp-ifsc', r.ifsc);
    if (r.totalDays) _setVal('ss-total-days', r.totalDays);
    if (r.daysPaid) _setVal('ss-days-paid', r.daysPaid);
    if (r.lop !== undefined) _setVal('ss-lop', r.lop);
    // Load earnings
    if (r.earnings && r.earnings.length) {
      const container = document.getElementById('ss-earnings-list');
      container.innerHTML = r.earnings.map(er => `
        <div class="ss-earn-row">
          <input type="text" class="form-control form-control-sm" value="${_esc(er.name)}" readonly />
          <input type="number" class="form-control form-control-sm ss-earning-actual" value="${er.actual || 0}" min="0" oninput="App.calcSlipNet()" placeholder="Actual" />
          <input type="number" class="form-control form-control-sm ss-earning-salary" value="${er.salary || 0}" min="0" oninput="App.calcSlipNet()" placeholder="Salary" />
          <button class="btn btn-sm btn-outline-danger" onclick="this.closest('.ss-earn-row').remove();App.calcSlipNet()"><i class="bi bi-trash"></i></button>
        </div>`).join('');
    }
    // Load deductions
    if (r.deductions && r.deductions.length) {
      const container = document.getElementById('ss-deductions-list');
      container.innerHTML = r.deductions.map(dr => `
        <div class="ss-ded-row">
          <input type="text" class="form-control form-control-sm" value="${_esc(dr.name)}" readonly />
          <input type="number" class="form-control form-control-sm ss-deduction-amt" value="${dr.amount || 0}" min="0" oninput="App.calcSlipNet()" placeholder="Deducted" />
          <button class="btn btn-sm btn-outline-danger" onclick="this.closest('.ss-ded-row').remove();App.calcSlipNet()"><i class="bi bi-trash"></i></button>
        </div>`).join('');
    }
    setSlipMode('manual');
    calcSlipNet();
    // Remove old record and let save create new
    DB.removeSlipRecord(id);
    renderSavedSlips();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function reprintSlipRecord(id) {
    const records = DB.getSlipRecords();
    const r = records.find(rec => rec.id === id);
    if (!r) return;
    const html = SalarySlipEngine.generate({
      company: { name: r.companyName, address: r.companyAddress, logoData: r.companyLogo, logoText: r.companyLogoText, phone: r.companyPhone, email: r.companyEmail },
      month: r.month, year: r.year,
      employee: { id: r.empCode, name: r.empName, location: r.location, division: r.division, designation: r.designation, doj: r.doj, uan: r.uan, esic: r.esic, pan: r.pan, bankName: r.bankName, acNo: r.acNo, ifsc: r.ifsc },
      attendance: { totalDays: r.totalDays, daysPaid: r.daysPaid, lop: r.lop },
      earnings: r.earnings || [],
      deductions: { items: r.deductions || [], total: r.totalDeduction || 0 },
    });
    const title = `${r.companyName}_${r.month}_${r.year}_Slip`;
    const win = window.open('', '_blank', 'width=900,height=700');
    if (win) {
      win.document.title = title;
      win.document.write(html);
      win.document.close();
    }
  }

  function deleteSlipRecord(id) {
    if (!confirm('Delete this salary slip record?')) return;
    DB.removeSlipRecord(id);
    renderSavedSlips();
  }

  function _populateSlipYearDropdown() {
    const sel = document.getElementById('ss-year');
    if (!sel) return;
    const curYear = new Date().getFullYear();
    let html = '';
    for (let y = curYear - 2; y <= curYear + 1; y++) {
      html += `<option value="${y}" ${y === curYear ? 'selected' : ''}>${y}</option>`;
    }
    sel.innerHTML = html;
  }

  function _collectSlipData() {
    const compId = document.getElementById('ss-company')?.value;
    const comps = DB.getSlipCompanies();
    const company = comps.find(c => c.id === compId) || {};

    // Earnings
    const earnRows = document.querySelectorAll('#ss-earnings-list .ss-earn-row');
    const earnings = [];
    earnRows.forEach(row => {
      const inputs = row.querySelectorAll('input');
      const name = inputs[0]?.value.trim();
      const actual = parseFloat(inputs[1]?.value) || 0;
      const salary = parseFloat(inputs[2]?.value) || 0;
      if (name) earnings.push({ name, actual, salary });
    });

    // Deductions
    const dedRows = document.querySelectorAll('#ss-deductions-list .ss-ded-row');
    const dedItems = [];
    dedRows.forEach(row => {
      const inputs = row.querySelectorAll('input');
      const name = inputs[0]?.value.trim();
      const amount = parseFloat(inputs[1]?.value) || 0;
      if (name) dedItems.push({ name, amount });
    });

    const totalDed = dedItems.reduce((s, r) => s + r.amount, 0);

    return {
      company,
      month: document.getElementById('ss-month')?.value || 'April',
      year: document.getElementById('ss-year')?.value || new Date().getFullYear(),
      employee: {
        id: document.getElementById('ss-emp-id')?.value.trim() || '',
        name: document.getElementById('ss-emp-name')?.value.trim() || '',
        location: document.getElementById('ss-emp-location')?.value.trim() || '',
        division: document.getElementById('ss-emp-division')?.value.trim() || '',
        designation: document.getElementById('ss-emp-designation')?.value.trim() || '',
        doj: document.getElementById('ss-emp-doj')?.value || '',
        uan: document.getElementById('ss-emp-uan')?.value.trim() || '',
        esic: document.getElementById('ss-emp-esic')?.value.trim() || '',
        pan: document.getElementById('ss-emp-pan')?.value.trim() || '',
        bankName: document.getElementById('ss-emp-bank')?.value.trim() || '',
        acNo: document.getElementById('ss-emp-acno')?.value.trim() || '',
        ifsc: document.getElementById('ss-emp-ifsc')?.value.trim() || '',
      },
      attendance: {
        totalDays: document.getElementById('ss-total-days')?.value || '30',
        daysPaid: document.getElementById('ss-days-paid')?.value || '30',
        lop: document.getElementById('ss-lop')?.value || '0',
      },
      earnings,
      deductions: { items: dedItems, total: totalDed },
    };
  }

  function calcSlipNet() {
    const earnRows = document.querySelectorAll('#ss-earnings-list .ss-earn-row');
    let totalEarn = 0;
    earnRows.forEach(row => {
      const inputs = row.querySelectorAll('input');
      totalEarn += parseFloat(inputs[2]?.value) || 0;
    });
    const dedRows = document.querySelectorAll('#ss-deductions-list .ss-ded-row');
    let totalDed = 0;
    dedRows.forEach(row => {
      const inputs = row.querySelectorAll('input');
      totalDed += parseFloat(inputs[1]?.value) || 0;
    });
    const net = totalEarn - totalDed;
    const fmtN = n => '₹ ' + n.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    const te = document.getElementById('ss-total-earning');
    const td = document.getElementById('ss-total-deduction');
    const np = document.getElementById('ss-net-pay');
    if (te) te.textContent = fmtN(totalEarn);
    if (td) td.textContent = fmtN(totalDed);
    if (np) np.textContent = fmtN(net);
  }

  function addSlipEarning() {
    const name = document.getElementById('ss-new-earn-name')?.value.trim();
    const actual = document.getElementById('ss-new-earn-actual')?.value || '0';
    const salary = document.getElementById('ss-new-earn-salary')?.value || '0';
    if (!name) return;
    const container = document.getElementById('ss-earnings-list');
    const row = document.createElement('div');
    row.className = 'ss-earn-row';
    row.innerHTML = `
      <input type="text" class="form-control form-control-sm" value="${_esc(name)}" readonly />
      <input type="number" class="form-control form-control-sm ss-earning-actual" value="${actual}" min="0" oninput="App.calcSlipNet()" placeholder="Actual" />
      <input type="number" class="form-control form-control-sm ss-earning-salary" value="${salary}" min="0" oninput="App.calcSlipNet()" placeholder="Salary" />
      <button class="btn btn-sm btn-outline-danger" onclick="this.closest('.ss-earn-row').remove();App.calcSlipNet()"><i class="bi bi-trash"></i></button>`;
    container.appendChild(row);
    ['ss-new-earn-name','ss-new-earn-actual','ss-new-earn-salary'].forEach(id => {
      const el = document.getElementById(id); if (el) el.value = '';
    });
    calcSlipNet();
  }

  function addSlipDeduction() {
    const name = document.getElementById('ss-new-ded-name')?.value.trim();
    const amt = document.getElementById('ss-new-ded-amt')?.value || '0';
    if (!name) return;
    const container = document.getElementById('ss-deductions-list');
    const row = document.createElement('div');
    row.className = 'ss-ded-row';
    row.innerHTML = `
      <input type="text" class="form-control form-control-sm" value="${_esc(name)}" readonly />
      <input type="number" class="form-control form-control-sm ss-deduction-amt" value="${amt}" min="0" oninput="App.calcSlipNet()" placeholder="Deducted" />
      <button class="btn btn-sm btn-outline-danger" onclick="this.closest('.ss-ded-row').remove();App.calcSlipNet()"><i class="bi bi-trash"></i></button>`;
    container.appendChild(row);
    ['ss-new-ded-name','ss-new-ded-amt'].forEach(id => {
      const el = document.getElementById(id); if (el) el.value = '';
    });
    calcSlipNet();
  }

  function resetSlipForm() {
    if (!confirm('Reset all salary slip fields?')) return;
    ['ss-emp-id','ss-emp-name','ss-emp-location','ss-emp-division','ss-emp-designation',
     'ss-emp-doj','ss-emp-uan','ss-emp-esic','ss-emp-pan','ss-emp-bank','ss-emp-acno','ss-emp-ifsc'].forEach(id => {
      const el = document.getElementById(id); if (el) el.value = '';
    });
    document.getElementById('ss-total-days').value = '30';
    document.getElementById('ss-days-paid').value = '30';
    delete document.getElementById('ss-days-paid')?.dataset.userEdited;
    document.getElementById('ss-lop').value = '0';
    document.getElementById('ss-company').value = '';
    _selectedSlipMonths = ['April'];
    _renderSlipMonthChips();
    _updateDaysInMonth();
    // Reset auto-fill
    document.getElementById('ss-gross-salary').value = '';
    document.getElementById('ss-city-type').value = 'metro';
    document.getElementById('ss-pf-applicable').value = 'yes';
    ['ss-auto-basic','ss-auto-hra','ss-auto-special','ss-auto-pf','ss-auto-pt','ss-auto-net'].forEach(id => {
      const el = document.getElementById(id); if (el) el.textContent = '₹ 0';
    });
    setSlipMode('auto');
    // Reset earnings to default 3 rows
    document.getElementById('ss-earnings-list').innerHTML = `
      <div class="ss-earn-row" data-type="basic"><input type="text" class="form-control form-control-sm" value="Basic" readonly /><input type="number" class="form-control form-control-sm" value="0" min="0" oninput="App.calcSlipNet()" placeholder="Actual" /><input type="number" class="form-control form-control-sm" value="0" min="0" oninput="App.calcSlipNet()" placeholder="Salary" /></div>
      <div class="ss-earn-row" data-type="hra"><input type="text" class="form-control form-control-sm" value="HRA" readonly /><input type="number" class="form-control form-control-sm" value="0" min="0" oninput="App.calcSlipNet()" placeholder="Actual" /><input type="number" class="form-control form-control-sm" value="0" min="0" oninput="App.calcSlipNet()" placeholder="Salary" /></div>
      <div class="ss-earn-row" data-type="special"><input type="text" class="form-control form-control-sm" value="Special Allowance" readonly /><input type="number" class="form-control form-control-sm" value="0" min="0" oninput="App.calcSlipNet()" placeholder="Actual" /><input type="number" class="form-control form-control-sm" value="0" min="0" oninput="App.calcSlipNet()" placeholder="Salary" /></div>`;
    document.getElementById('ss-deductions-list').innerHTML = `
      <div class="ss-ded-row" data-type="pf"><input type="text" class="form-control form-control-sm" value="Employee PF" readonly /><input type="number" class="form-control form-control-sm" value="0" min="0" oninput="App.calcSlipNet()" placeholder="Deducted" /></div>`;
    calcSlipNet();
  }

  function saveSlipEmployee() {
    const baseData = _collectSlipData();
    if (!baseData.company.name) { alert('Please select a company.'); return; }
    if (!baseData.employee.name) { alert('Please enter employee name.'); return; }

    const selectedMonths = getSelectedSlipMonths();
    if (!selectedMonths.length) {
      alert('Please select at least one month.');
      return;
    }

    const year = baseData.year || new Date().getFullYear();
    const lop = parseFloat(baseData.attendance.lop) || 0;

    selectedMonths.forEach(month => {
      const totalDays = _getDaysInMonth(month, year);
      const daysPaid = Math.max(0, totalDays - lop);
      const record = {
        companyId: baseData.company.id,
        companyName: baseData.company.name,
        companyAddress: baseData.company.address || '',
        companyLogo: baseData.company.logoData || null,
        companyLogoText: baseData.company.logoText || '',
        companyPhone: baseData.company.phone || '',
        companyEmail: baseData.company.email || '',
        empCode: baseData.employee.id,
        empName: baseData.employee.name,
        location: baseData.employee.location,
        division: baseData.employee.division,
        designation: baseData.employee.designation,
        doj: baseData.employee.doj,
        uan: baseData.employee.uan,
        esic: baseData.employee.esic,
        pan: baseData.employee.pan,
        bankName: baseData.employee.bankName,
        acNo: baseData.employee.acNo,
        ifsc: baseData.employee.ifsc,
        totalDays: String(totalDays),
        daysPaid: String(daysPaid),
        lop: String(lop),
        earnings: baseData.earnings,
        deductions: baseData.deductions.items,
        totalEarning: baseData.earnings.reduce((s, r) => s + (parseFloat(r.salary) || 0), 0),
        totalDeduction: baseData.deductions.total,
        netPay: baseData.earnings.reduce((s, r) => s + (parseFloat(r.salary) || 0), 0) - baseData.deductions.total,
        month,
        year,
      };
      DB.saveSlipRecord(record);
    });

    alert(`✅ Successfully saved ${selectedMonths.length} payslip record(s) for ${selectedMonths.join(', ')}!`);
    renderSavedSlips();
    updateProjectStorageStats();
  }

  function generateSalarySlip() {
    const baseData = _collectSlipData();
    if (!baseData.company.name) { alert('Please select a company.'); return; }
    if (!baseData.employee.name) { alert('Please enter employee name.'); return; }

    const selectedMonths = getSelectedSlipMonths();
    if (!selectedMonths.length) {
      alert('Please select at least one month for salary slip generation.');
      return;
    }

    const year = baseData.year || new Date().getFullYear();
    const lop = parseFloat(baseData.attendance.lop) || 0;

    const dataList = selectedMonths.map(month => {
      const totalDays = _getDaysInMonth(month, year);
      const daysPaid = Math.max(0, totalDays - lop);
      return {
        ...baseData,
        month,
        year,
        attendance: {
          totalDays: String(totalDays),
          daysPaid: String(daysPaid),
          lop: String(lop)
        }
      };
    });

    // Save each month's payslip record in database
    dataList.forEach(data => {
      const record = {
        companyId: data.company.id,
        companyName: data.company.name,
        companyAddress: data.company.address || '',
        companyLogo: data.company.logoData || null,
        companyLogoText: data.company.logoText || '',
        companyPhone: data.company.phone || '',
        companyEmail: data.company.email || '',
        empCode: data.employee.id,
        empName: data.employee.name,
        location: data.employee.location,
        division: data.employee.division,
        designation: data.employee.designation,
        doj: data.employee.doj,
        uan: data.employee.uan,
        esic: data.employee.esic,
        pan: data.employee.pan,
        bankName: data.employee.bankName,
        acNo: data.employee.acNo,
        ifsc: data.employee.ifsc,
        totalDays: data.attendance.totalDays,
        daysPaid: data.attendance.daysPaid,
        lop: data.attendance.lop,
        earnings: data.earnings,
        deductions: data.deductions.items,
        totalEarning: data.earnings.reduce((s, r) => s + (parseFloat(r.salary) || 0), 0),
        totalDeduction: data.deductions.total,
        netPay: data.earnings.reduce((s, r) => s + (parseFloat(r.salary) || 0), 0) - data.deductions.total,
        month: data.month,
        year: data.year,
      };
      DB.saveSlipRecord(record);
    });

    const html = SalarySlipEngine.generateMulti(dataList);

    const isMulti = dataList.length > 1;
    const title = isMulti
      ? `${baseData.company.name}_Payslips_${selectedMonths[0]}_to_${selectedMonths[selectedMonths.length - 1]}_${year}`
      : `${baseData.company.name}_${selectedMonths[0]}_${year}_Slip`;

    const win = window.open('', '_blank', 'width=920,height=750');
    if (win) {
      win.document.title = title;
      win.document.write(html);
      win.document.close();
    } else {
      alert('Please allow popups to print the salary slip.');
    }

    renderSavedSlips();
    updateProjectStorageStats();
  }

  // ── Bank Statement Page ──────────────────────────────────────
  const STMT_MIN_BALANCE = 25000;

  let _statementBankLogoData = null;
  let _salaryStatementBankLogoData = null;

  function uploadStatementBankLogo(input, type = 'business') {
    const file = input.files[0];
    if (!file) return;
    if (file.size > 500 * 1024) { alert('Image must be under 500KB.'); input.value = ''; return; }
    const reader = new FileReader();
    reader.onload = function(e) {
      if (type === 'salary') {
        _salaryStatementBankLogoData = e.target.result;
        const preview = document.getElementById('bss-logo-preview');
        if (preview) {
          preview.innerHTML = `<img src="${_salaryStatementBankLogoData}" alt="Logo" style="width:100%;height:100%;object-fit:contain;" />`;
          preview.style.background = 'transparent';
        }
      } else {
        _statementBankLogoData = e.target.result;
        const preview = document.getElementById('bs-logo-preview');
        if (preview) {
          preview.innerHTML = `<img src="${_statementBankLogoData}" alt="Logo" style="width:100%;height:100%;object-fit:contain;" />`;
          preview.style.background = 'transparent';
        }
      }
    };
    reader.readAsDataURL(file);
  }

  function _updateStatementBankLogoPreview(bank) {
    const preview = document.getElementById('bs-logo-preview');
    if (!preview) return;
    if (_statementBankLogoData) {
      preview.innerHTML = `<img src="${_statementBankLogoData}" alt="Logo" style="width:100%;height:100%;object-fit:contain;" />`;
      preview.style.background = '#fff';
      preview.style.border = '1px solid #e2e8f0';
      return;
    }
    const resolvedLogo = bank ? _resolveBankLogo(bank.name, bank.logoData) : null;
    if (resolvedLogo) {
      _statementBankLogoData = resolvedLogo;
      preview.innerHTML = `<img src="${resolvedLogo}" alt="Logo" style="width:100%;height:100%;object-fit:contain;" />`;
      preview.style.background = '#fff';
      preview.style.border = '1px solid #e2e8f0';
    } else if (bank && bank.name) {
      _statementBankLogoData = null;
      const initial = (bank.name || 'B').trim().toUpperCase().slice(0, 2) || 'B';
      preview.style.background = '#1a3c6e';
      preview.style.color = '#fff';
      preview.style.border = '1px solid #e2e8f0';
      preview.innerHTML = `<span style="font-weight:800;font-size:14px;color:#fff;">${initial}</span>`;
    } else {
      _statementBankLogoData = null;
      preview.innerHTML = `<span>B</span>`;
      preview.style.background = '';
      preview.style.color = '';
      preview.style.border = '';
    }
  }

  function _updateSalaryStatementBankLogoPreview(bank) {
    const preview = document.getElementById('bss-logo-preview');
    if (!preview) return;
    if (_salaryStatementBankLogoData) {
      preview.innerHTML = `<img src="${_salaryStatementBankLogoData}" alt="Logo" style="width:100%;height:100%;object-fit:contain;" />`;
      preview.style.background = '#fff';
      preview.style.border = '1px solid #e2e8f0';
      return;
    }
    const resolvedLogo = bank ? _resolveBankLogo(bank.name, bank.logoData) : null;
    if (resolvedLogo) {
      _salaryStatementBankLogoData = resolvedLogo;
      preview.innerHTML = `<img src="${resolvedLogo}" alt="Logo" style="width:100%;height:100%;object-fit:contain;" />`;
      preview.style.background = '#fff';
      preview.style.border = '1px solid #e2e8f0';
    } else if (bank && bank.name) {
      _salaryStatementBankLogoData = null;
      const initial = (bank.name || 'B').trim().toUpperCase().slice(0, 2) || 'B';
      preview.style.background = '#1a3c6e';
      preview.style.color = '#fff';
      preview.style.border = '1px solid #e2e8f0';
      preview.innerHTML = `<span style="font-weight:800;font-size:14px;color:#fff;">${initial}</span>`;
    } else {
      _salaryStatementBankLogoData = null;
      preview.innerHTML = `<span>B</span>`;
      preview.style.background = '';
      preview.style.color = '';
      preview.style.border = '';
    }
  }

  // ── Bank Statement Persona Switcher ──────────────────────────
  let _currentStatementPersona = 'business';

  function setBankStatementPersona(persona) {
    _currentStatementPersona = persona;
    const bizBtn = document.getElementById('bs-persona-business');
    const salBtn = document.getElementById('bs-persona-salary');
    const bizPanel = document.getElementById('bs-panel-business');
    const salPanel = document.getElementById('bs-panel-salary');

    if (persona === 'business') {
      bizBtn?.classList.add('active');
      salBtn?.classList.remove('active');
      bizPanel?.classList.add('active');
      salPanel?.classList.remove('active');
      _initBankStatementPage();
    } else {
      bizBtn?.classList.remove('active');
      salBtn?.classList.add('active');
      bizPanel?.classList.remove('active');
      salPanel?.classList.add('active');
      _initSalaryBankStatementPage();
    }
  }

  // ── 1. Business Person Statement Page Logic ──────────────────
  function _initBankStatementPage() {
    _populateBankStatementDropdown();
    _populateStatementDates();
    renderSavedStatements();
    _renderStatementTx();

    const bankSel = document.getElementById('bs-bank');
    if (bankSel && !bankSel.dataset.bound) {
      bankSel.dataset.bound = '1';
      const handleBankSelect = () => {
        const banks = _getBankConfigObjects();
        const bVal = (bankSel.value || '').trim();
        const bank = _matchBank(bVal, banks);
        _statementBankLogoData = null;
        const uploadEl = document.getElementById('bs-logo-upload'); if (uploadEl) uploadEl.value = '';
        if (bank) {
          _updateStatementBankLogoPreview(bank);
          const branchEl = document.getElementById('bs-branch');
          if (branchEl && bank.branch) {
            branchEl.value = (bank.branch || (bank.address ? bank.address.split(',')[0].trim() : '') || 'MAIN BRANCH').toUpperCase();
          }
          const branchAddrEl = document.getElementById('bs-branchaddress');
          if (branchAddrEl && bank.address) {
            branchAddrEl.value = bank.address ? bank.address.toUpperCase() : '';
          }
          const ifscEl = document.getElementById('bs-ifsc');
          if (ifscEl && bank.ifsc) {
            ifscEl.value = bank.ifsc.toUpperCase();
            const codeEl = document.getElementById('bs-branchcode');
            if (codeEl) codeEl.value = bank.ifsc.slice(-4);
          }
        } else if (bVal) {
          previewBankLogo(bVal, 'bs-logo-preview');
        } else {
          _updateStatementBankLogoPreview(null);
        }

        if (bVal.toUpperCase().includes('ICICI')) {
          const ifscEl = document.getElementById('bs-ifsc');
          if (ifscEl && !ifscEl.value) ifscEl.value = 'ICIC0000914';
          const codeEl = document.getElementById('bs-branchcode');
          if (codeEl && !codeEl.value) codeEl.value = '0914';
          const styleEl = document.getElementById('bs-style');
          if (styleEl) styleEl.value = 'icici';
        }
      };

      bankSel.addEventListener('change', handleBankSelect);
      bankSel.addEventListener('input', handleBankSelect);
    }

    const fromEl = document.getElementById('bs-from');
    if (fromEl && !fromEl.dataset.bound) {
      fromEl.dataset.bound = '1';
      fromEl.addEventListener('change', _renderStatementTx);
    }
    const toEl = document.getElementById('bs-to');
    if (toEl && !toEl.dataset.bound) {
      toEl.dataset.bound = '1';
      toEl.addEventListener('change', _renderStatementTx);
    }
    const densityEl = document.getElementById('bs-density');
    if (densityEl && !densityEl.dataset.bound) {
      densityEl.dataset.bound = '1';
      densityEl.addEventListener('change', autoGenStatementTxs);
    }
    const openEl = document.getElementById('bs-opening');
    if (openEl && !openEl.dataset.bound) {
      openEl.dataset.bound = '1';
      openEl.addEventListener('input', recalcStatement);
    }
    const minEl = document.getElementById('bs-min-balance');
    if (minEl && !minEl.dataset.bound) {
      minEl.dataset.bound = '1';
      minEl.addEventListener('input', recalcStatement);
    }
    const stmtIfscEl = document.getElementById('bs-ifsc');
    if (stmtIfscEl && !stmtIfscEl.dataset.bound) {
      stmtIfscEl.dataset.bound = '1';
      stmtIfscEl.addEventListener('input', () => onStatementIFSCInput(stmtIfscEl.value));
      stmtIfscEl.addEventListener('change', () => onStatementIFSCInput(stmtIfscEl.value));
      stmtIfscEl.addEventListener('paste', () => setTimeout(() => onStatementIFSCInput(stmtIfscEl.value), 10));
    }
  }

  function _populateBankStatementDropdown() {
    const sel = document.getElementById('bs-bank');
    const dl = document.getElementById('bs-bank-list');
    const banks = _getBankConfigObjects();

    if (dl) {
      dl.innerHTML = banks.map(b => `<option value="${_esc(b.name)}">${_esc(b.name)}</option>`).join('');
    }

    if (!sel) return;

    if (sel.tagName === 'SELECT') {
      sel.innerHTML = '<option value="">— Select Bank —</option>' +
        banks.map(b => `<option value="${_esc(b.name)}">${_esc(b.name)}</option>`).join('');

      if (!sel.value) {
        const icici = _matchBank('ICICI', banks);
        if (icici) {
          sel.value = icici.name;
          _updateStatementBankLogoPreview(icici);
        } else if (banks.length > 0) {
          sel.value = banks[0].name;
          _updateStatementBankLogoPreview(banks[0]);
        }
      } else {
        const currentBank = _matchBank(sel.value, banks) || { name: sel.value };
        _updateStatementBankLogoPreview(currentBank);
      }
    } else {
      if (!sel.value) {
        const icici = _matchBank('ICICI', banks);
        if (icici) {
          sel.value = icici.name;
          _updateStatementBankLogoPreview(icici);
        } else if (banks.length > 0) {
          sel.value = banks[0].name;
          _updateStatementBankLogoPreview(banks[0]);
        }
      } else {
        const currentBank = _matchBank(sel.value, banks) || { name: sel.value };
        _updateStatementBankLogoPreview(currentBank);
      }
    }
  }

  function _populateStatementDates() {
    const fromEl = document.getElementById('bs-from');
    const toEl = document.getElementById('bs-to');
    if (!fromEl || !toEl) return;
    if (!fromEl.value || !toEl.value) {
      const today = new Date();
      const to = today.toISOString().slice(0, 10);
      const from = new Date(today.getFullYear(), today.getMonth() - 2, 1).toISOString().slice(0, 10);
      fromEl.value = from;
      toEl.value = to;
    }
  }

  function _statementDates() {
    const from = document.getElementById('bs-from')?.value || '';
    const to = document.getElementById('bs-to')?.value || '';
    return { from, to };
  }

  function autoGenStatementTxs() {
    const { from, to } = _statementDates();
    if (!from || !to) return;
    const density = parseInt(document.getElementById('bs-density')?.value, 10) || 30;
    const opening = parseFloat(document.getElementById('bs-opening')?.value) || 30211;
    const minBalance = parseFloat(document.getElementById('bs-min-balance')?.value) || STMT_MIN_BALANCE;
    const txs = BankStatementEngine.generateHighDensityTransactions(from, to, density, opening, minBalance);
    const container = document.getElementById('stmt-tx-list');
    if (!container) return;
    container.innerHTML = '';
    txs.forEach(t => _appendTxnRow(t));
    recalcStatement();
  }

  function addStatementTxnRow() {
    const { from } = _statementDates();
    const tranSeq = Math.floor(10000000 + Math.random() * 80000000);
    _appendTxnRow({
      tranId: `S${tranSeq}`,
      txnDate: from || new Date().toISOString().slice(0, 10),
      valueDate: from || new Date().toISOString().slice(0, 10),
      description: 'UPI/Payment/Transfer',
      debit: '',
      credit: ''
    });
    recalcStatement();
  }

  function clearStatementTxns() {
    const container = document.getElementById('stmt-tx-list');
    if (container) container.innerHTML = '';
    recalcStatement();
  }

  function _appendTxnRow(tx) {
    const container = document.getElementById('stmt-tx-list');
    if (!container) return;
    const row = document.createElement('div');
    row.className = 'stmt-tx-row';
    row.dataset.postedDate = tx.postedDate || '';
    row.dataset.valueDate = tx.valueDate || tx.txnDate || '';
    row.innerHTML = `
      <input type="text" class="form-control form-control-sm stmt-tx-tranid" value="${_esc(tx.tranId || '')}" placeholder="Tran ID" title="Transaction ID" oninput="App.recalcStatement()" />
      <input type="date" class="form-control form-control-sm stmt-tx-date" value="${_esc(tx.txnDate || '')}" title="Transaction Date" oninput="App.recalcStatement()" />
      <input type="text" class="form-control form-control-sm stmt-tx-desc" value="${_esc(tx.description || '')}" placeholder="Description / Remark Narration" title="${_esc(tx.description || '')}" oninput="App.recalcStatement()" />
      <input type="number" step="0.01" class="form-control form-control-sm stmt-tx-dr" value="${_esc(tx.debit || '')}" min="0" placeholder="Dr" oninput="App.recalcStatement()" />
      <input type="number" step="0.01" class="form-control form-control-sm stmt-tx-cr" value="${_esc(tx.credit || '')}" min="0" placeholder="Cr" oninput="App.recalcStatement()" />
      <div class="stmt-tx-bal">&nbsp;</div>
      <button class="btn btn-sm btn-outline-danger" title="Remove" onclick="this.closest('.stmt-tx-row').remove();App.recalcStatement()"><i class="bi bi-trash"></i></button>
    `;
    container.appendChild(row);
  }

  function _renderStatementTx() {
    const container = document.getElementById('stmt-tx-list');
    if (!container) return;
    if (container.children.length === 0) autoGenStatementTxs();
    recalcStatement();
  }

  function recalcStatement() {
    const minBalance = parseFloat(document.getElementById('bs-min-balance')?.value) > 0
      ? parseFloat(document.getElementById('bs-min-balance')?.value)
      : STMT_MIN_BALANCE;
    const opening = parseFloat(document.getElementById('bs-opening')?.value) || 0;
    const rows = document.querySelectorAll('#stmt-tx-list .stmt-tx-row');
    let balance = opening;
    let totalDr = 0;
    let totalCr = 0;
    let breachCount = 0;

    const countEl = document.getElementById('stmt-tx-count');
    if (countEl) countEl.textContent = rows.length;

    rows.forEach(row => {
      const dr = parseFloat(row.querySelector('.stmt-tx-dr')?.value) || 0;
      const cr = parseFloat(row.querySelector('.stmt-tx-cr')?.value) || 0;
      balance = balance - dr + cr;
      totalDr += dr;
      totalCr += cr;
      const balEl = row.querySelector('.stmt-tx-bal');
      if (balEl) {
        balEl.textContent = '₹ ' + (balance.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }));
        row.classList.toggle('stmt-low-row', balance < minBalance);
        if (balance < minBalance) breachCount++;
      }
    });

    const closing = balance;
    _setText('stmt-open-total', '₹ ' + opening.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }));
    _setText('stmt-dr-total', '₹ ' + totalDr.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }));
    _setText('stmt-cr-total', '₹ ' + totalCr.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }));
    _setText('stmt-close-total', '₹ ' + closing.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }));
    _setText('stmt-min-note', breachCount > 0
      ? `Notice: ${breachCount} transaction(s) dropped below the minimum balance of ₹ ${minBalance.toLocaleString('en-IN')}.`
      : `Minimum balance of ₹ ${minBalance.toLocaleString('en-IN')} maintained throughout the period.`);
    const noteEl = document.getElementById('stmt-min-note');
    if (noteEl) noteEl.classList.toggle('warn', breachCount > 0);
  }

  function _setText(id, text) {
    const el = document.getElementById(id);
    if (el) el.textContent = text;
  }

  function _collectStatementData() {
    const bankName = (document.getElementById('bs-bank')?.value || '').trim();
    const banks = _getBankConfigObjects();
    const bank = _matchBank(bankName, banks) || { name: bankName };
    const savedLogo = bank.logoData || _resolveBankLogo(bank.name || bankName, null);
    const effectiveLogo = _statementBankLogoData || savedLogo || null;
    const rows = document.querySelectorAll('#stmt-tx-list .stmt-tx-row');
    const transactions = [];
    rows.forEach(row => {
      transactions.push({
        tranId: row.querySelector('.stmt-tx-tranid')?.value.trim() || '',
        txnDate: row.querySelector('.stmt-tx-date')?.value || '',
        valueDate: row.dataset.valueDate || row.querySelector('.stmt-tx-date')?.value || '',
        postedDate: row.dataset.postedDate || '',
        description: row.querySelector('.stmt-tx-desc')?.value.trim() || '',
        debit: row.querySelector('.stmt-tx-dr')?.value || '',
        credit: row.querySelector('.stmt-tx-cr')?.value || '',
      });
    });
    return {
      persona: 'business',
      style: document.getElementById('bs-style')?.value || 'icici',
      bank: {
        name: bank.name || bankName,
        logoData: effectiveLogo,
        logoText: bank.logoText || (bankName ? bankName.slice(0, 2) : ''),
        address: document.getElementById('bs-branchaddress')?.value.trim() || bank.address || ''
      },
      account: {
        holder: document.getElementById('bs-holder')?.value.trim() || '',
        accountNo: document.getElementById('bs-acno')?.value.trim() || '',
        accountType: document.getElementById('bs-actype')?.value || 'CAA',
        custId: document.getElementById('bs-custid')?.value.trim() || '',
        ifsc: document.getElementById('bs-ifsc')?.value.trim() || '',
        branch: document.getElementById('bs-branch')?.value.trim() || '',
        branchCode: document.getElementById('bs-branchcode')?.value.trim() || '',
        address: document.getElementById('bs-holderaddress')?.value.trim() || '',
        branchAddress: document.getElementById('bs-branchaddress')?.value.trim() || '',
        openingBalance: parseFloat(document.getElementById('bs-opening')?.value) || 0,
      },
      fromDate: document.getElementById('bs-from')?.value || '',
      toDate: document.getElementById('bs-to')?.value || '',
      minBalance: parseFloat(document.getElementById('bs-min-balance')?.value) > 0
        ? parseFloat(document.getElementById('bs-min-balance')?.value)
        : STMT_MIN_BALANCE,
      transactions,
    };
  }

  let _editingStatementId = null;

  function editStatementRecord(id) {
    const r = DB.getStatementRecords().find(rec => rec.id === id);
    if (!r) return;

    _editingStatementId = r.id;
    setBankStatementPersona('business');

    const bankEl = document.getElementById('bs-bank');
    if (bankEl) bankEl.value = r.bankName || '';

    _statementBankLogoData = r.bankLogo || null;
    const preview = document.getElementById('bs-logo-preview');
    if (preview) {
      if (r.bankLogo) {
        preview.innerHTML = `<img src="${r.bankLogo}" alt="Logo" style="width:100%;height:100%;object-fit:contain;" />`;
        preview.style.background = 'transparent';
      } else {
        previewBankLogo(r.bankName || 'B', 'bs-logo-preview');
      }
    }

    const styleEl = document.getElementById('bs-style');
    if (styleEl) styleEl.value = r.style || 'icici';

    const acTypeEl = document.getElementById('bs-actype');
    if (acTypeEl) acTypeEl.value = r.accountType || 'CAA';

    const holderEl = document.getElementById('bs-holder');
    if (holderEl) holderEl.value = r.holder || '';

    const acnoEl = document.getElementById('bs-acno');
    if (acnoEl) acnoEl.value = r.accountNo || '';

    const custEl = document.getElementById('bs-custid');
    if (custEl) custEl.value = r.custId || '';

    const ifscEl = document.getElementById('bs-ifsc');
    if (ifscEl) ifscEl.value = r.ifsc || '';

    const branchEl = document.getElementById('bs-branch');
    if (branchEl) branchEl.value = r.branch || '';

    const branchCodeEl = document.getElementById('bs-branchcode');
    if (branchCodeEl) branchCodeEl.value = r.branchCode || '';

    const hAddrEl = document.getElementById('bs-holderaddress');
    if (hAddrEl) hAddrEl.value = r.holderAddress || '';

    const bAddrEl = document.getElementById('bs-branchaddress');
    if (bAddrEl) bAddrEl.value = r.branchAddress || '';

    const fromEl = document.getElementById('bs-from');
    if (fromEl) fromEl.value = r.fromDate || '';

    const toEl = document.getElementById('bs-to');
    if (toEl) toEl.value = r.toDate || '';

    const openEl = document.getElementById('bs-opening');
    if (openEl) openEl.value = r.openingBalance !== undefined ? r.openingBalance : 30211;

    const minEl = document.getElementById('bs-min-balance');
    if (minEl) minEl.value = r.minBalance || STMT_MIN_BALANCE;

    const container = document.getElementById('stmt-tx-list');
    if (container) {
      container.innerHTML = '';
      const txs = r.transactions || [];
      if (txs.length > 0) {
        txs.forEach(t => _appendTxnRow(t));
      } else {
        autoGenStatementTxs();
      }
    }

    recalcStatement();
    document.getElementById('bs-panel-business')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  function generateBankStatement() {
    if (_currentStatementPersona === 'salary') {
      return generateSalaryBankStatement();
    }

    const data = _collectStatementData();
    if (!data.bank.name) { alert('Please select a bank.'); return; }
    if (!data.account.holder) { alert('Please enter account holder name.'); return; }
    if (!data.fromDate || !data.toDate) { alert('Please select a date range.'); return; }
    if (data.fromDate > data.toDate) { alert('From date must be before To date.'); return; }
    if (!data.account.accountNo) { alert('Please enter account number.'); return; }

    const html = BankStatementEngine.generate(data);

    // Save record
    const record = {
      ...( _editingStatementId ? { id: _editingStatementId } : {} ),
      persona: 'business',
      style: data.style,
      bankName: data.bank.name,
      bankLogo: data.bank.logoData || null,
      bankLogoText: data.bank.logoText || '',
      bankAddress: data.bank.address || '',
      holder: data.account.holder,
      accountNo: data.account.accountNo,
      accountType: data.account.accountType,
      custId: data.account.custId,
      branchCode: data.account.branchCode,
      holderAddress: data.account.address,
      branchAddress: data.account.branchAddress,
      ifsc: data.account.ifsc,
      branch: data.account.branch,
      openingBalance: data.account.openingBalance,
      fromDate: data.fromDate,
      toDate: data.toDate,
      minBalance: data.minBalance,
      transactions: data.transactions,
    };
    DB.saveStatementRecord(record);

    const title = `${data.bank.name}_Statement`;
    const win = window.open('', '_blank', 'width=950,height=800');
    if (win) {
      win.document.title = title;
      win.document.write(html);
      win.document.close();
    } else {
      alert('Please allow popups to print the bank statement.');
    }

    renderSavedStatements();
  }

  function resetBankStatementForm() {
    if (_currentStatementPersona === 'salary') {
      return resetSalaryStatementForm();
    }

    _editingStatementId = null;

    ['bs-bank','bs-holder','bs-acno','bs-ifsc','bs-branch','bs-branchcode','bs-custid','bs-holderaddress','bs-branchaddress','bs-from','bs-to'].forEach(id => {
      const el = document.getElementById(id); if (el) el.value = '';
    });
    _statementBankLogoData = null;
    const logoUploadEl = document.getElementById('bs-logo-upload'); if (logoUploadEl) logoUploadEl.value = '';
    _updateStatementBankLogoPreview(null);
    const holderEl = document.getElementById('bs-holder'); if (holderEl) holderEl.value = 'MUKUL RAHAMAN';
    const acnoEl = document.getElementById('bs-acno'); if (acnoEl) acnoEl.value = '091405003332';
    const custEl = document.getElementById('bs-custid'); if (custEl) custEl.value = '573886835';
    const ifscEl = document.getElementById('bs-ifsc'); if (ifscEl) ifscEl.value = 'ICIC0000914';
    const brEl = document.getElementById('bs-branch'); if (brEl) brEl.value = 'BASIRHAT';
    const brCodeEl = document.getElementById('bs-branchcode'); if (brCodeEl) brCodeEl.value = '0914';
    const hAddrEl = document.getElementById('bs-holderaddress'); if (hAddrEl) hAddrEl.value = 'CHOWRASHI, DEGANGA, CHAURASHI, NORTH 24 PARGANAS, 743424, WEST BENGAL, INDIA';
    const bAddrEl = document.getElementById('bs-branchaddress'); if (bAddrEl) bAddrEl.value = 'ICICI BANK LTD., BASIRHAT BRANCH, BHAWANIPUR, PO.-BASIRHAT COLLEGE, DIST.- 24 PARGANAS (NORTH).743 412, NORTH 24 PARGANAS, WEST BENGAL, INDIA';
    const openingEl = document.getElementById('bs-opening'); if (openingEl) openingEl.value = '30211';
    const minEl = document.getElementById('bs-min-balance'); if (minEl) minEl.value = String(STMT_MIN_BALANCE);
    const container = document.getElementById('stmt-tx-list');
    if (container) container.innerHTML = '';
    _populateBankStatementDropdown();
    _populateStatementDates();
    _renderStatementTx();
  }

  function renderSavedStatements() {
    const container = document.getElementById('stmt-saved-list');
    if (!container) return;
    const records = DB.getStatementRecords().filter(r => !r.persona || r.persona === 'business');
    if (!records.length) {
      container.innerHTML = '<div class="text-center text-muted py-4" style="font-size:12px">No saved business statements yet.</div>';
      return;
    }
    container.innerHTML = records.map(r => {
      const initials = (r.holder || 'A').split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase();
      const date = r.createdAt ? new Date(r.createdAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '';
      return `
      <div class="ss-saved-card">
        <div class="ss-saved-avatar business">${initials}</div>
        <div class="ss-saved-info">
          <div class="ss-saved-title-row">
            <span class="ss-saved-name">${_esc(r.holder || 'Unknown')}</span>
            <span class="ss-badge-business"><i class="bi bi-briefcase-fill"></i> Business</span>
          </div>
          <div class="ss-saved-meta">
            <span class="ss-saved-meta-item"><strong>${_esc(r.bankName || 'Bank')}</strong></span>
            <span>•</span>
            <span class="ss-saved-meta-item">A/c: <code>${_esc(r.accountNo || '--')}</code></span>
            <span>•</span>
            <span class="ss-saved-meta-item"><i class="bi bi-calendar-event"></i> ${r.fromDate} → ${r.toDate}</span>
            <span>•</span>
            <span class="ss-saved-meta-item">${r.transactions?.length || 0} txns</span>
            <span>•</span>
            <span class="ss-saved-meta-item"><i class="bi bi-clock-history"></i> ${date}</span>
          </div>
        </div>
        <div class="ss-saved-actions">
          <button class="btn btn-sm btn-outline-warning" onclick="App.editStatementRecord('${r.id}')" title="Edit Statement"><i class="bi bi-pencil-square me-1"></i>Edit</button>
          <button class="btn btn-sm btn-outline-primary" onclick="App.reprintStatementRecord('${r.id}')" title="Reprint"><i class="bi bi-printer-fill me-1"></i>Print</button>
          <button class="btn btn-sm btn-outline-secondary" onclick="App.downloadStatementRecord('${r.id}')" title="Download JSON"><i class="bi bi-download"></i></button>
          <button class="btn btn-sm btn-outline-danger" onclick="App.deleteStatementRecord('${r.id}')" title="Delete"><i class="bi bi-trash"></i></button>
        </div>
      </div>`;
    }).join('');
    updateProjectStorageStats();
  }

  // ── 2. Salaried Person Statement Page Logic ──────────────────
  function _initSalaryBankStatementPage() {
    _populateSalaryBankStatementDropdown();
    _populateSalaryStatementDates();
    _populateSalaryCompanyList();
    renderSavedSalaryStatements();
    _renderSalaryStatementTx();

    const bankSel = document.getElementById('bss-bank');
    if (bankSel && !bankSel.dataset.bound) {
      bankSel.dataset.bound = '1';
      const handleBankSelect = () => {
        const banks = _getBankConfigObjects();
        const bVal = (bankSel.value || '').trim();
        const bank = _matchBank(bVal, banks);
        _salaryStatementBankLogoData = null;
        const uploadEl = document.getElementById('bss-logo-upload'); if (uploadEl) uploadEl.value = '';
        if (bank) {
          _updateSalaryStatementBankLogoPreview(bank);
          const branchEl = document.getElementById('bss-branch');
          if (branchEl && bank.branch) {
            branchEl.value = (bank.branch || (bank.address ? bank.address.split(',')[0].trim() : '') || 'MAIN BRANCH').toUpperCase();
          }
          const branchAddrEl = document.getElementById('bss-branchaddress');
          if (branchAddrEl && bank.address) {
            branchAddrEl.value = bank.address ? bank.address.toUpperCase() : '';
          }
          const ifscEl = document.getElementById('bss-ifsc');
          if (ifscEl && bank.ifsc) {
            ifscEl.value = bank.ifsc.toUpperCase();
            const codeEl = document.getElementById('bss-branchcode');
            if (codeEl) codeEl.value = bank.ifsc.slice(-4);
          }
        } else if (bVal) {
          previewBankLogo(bVal, 'bss-logo-preview');
        } else {
          _updateSalaryStatementBankLogoPreview(null);
        }

        if (bVal.toUpperCase().includes('ICICI')) {
          const ifscEl = document.getElementById('bss-ifsc');
          if (ifscEl && !ifscEl.value) ifscEl.value = 'ICIC0000914';
          const codeEl = document.getElementById('bss-branchcode');
          if (codeEl && !codeEl.value) codeEl.value = '0914';
          const styleEl = document.getElementById('bss-style');
          if (styleEl) styleEl.value = 'icici';
        }
      };

      bankSel.addEventListener('change', handleBankSelect);
      bankSel.addEventListener('input', handleBankSelect);
    }

    const fromEl = document.getElementById('bss-from');
    if (fromEl && !fromEl.dataset.bound) {
      fromEl.dataset.bound = '1';
      fromEl.addEventListener('change', autoGenSalaryStatementTxs);
    }
    const toEl = document.getElementById('bss-to');
    if (toEl && !toEl.dataset.bound) {
      toEl.dataset.bound = '1';
      toEl.addEventListener('change', autoGenSalaryStatementTxs);
    }
    const densityEl = document.getElementById('bss-density');
    if (densityEl && !densityEl.dataset.bound) {
      densityEl.dataset.bound = '1';
      densityEl.addEventListener('change', autoGenSalaryStatementTxs);
    }
    const openEl = document.getElementById('bss-opening');
    if (openEl && !openEl.dataset.bound) {
      openEl.dataset.bound = '1';
      openEl.addEventListener('input', recalcSalaryStatement);
    }
    const minEl = document.getElementById('bss-min-balance');
    if (minEl && !minEl.dataset.bound) {
      minEl.dataset.bound = '1';
      minEl.addEventListener('input', recalcSalaryStatement);
    }
    const avgEl = document.getElementById('bss-avg-balance');
    if (avgEl && !avgEl.dataset.bound) {
      avgEl.dataset.bound = '1';
      avgEl.addEventListener('input', autoGenSalaryStatementTxs);
    }
    const salAmtEl = document.getElementById('bss-salary-amount');
    if (salAmtEl && !salAmtEl.dataset.bound) {
      salAmtEl.dataset.bound = '1';
      salAmtEl.addEventListener('input', autoGenSalaryStatementTxs);
    }
    const compEl = document.getElementById('bss-company');
    if (compEl && !compEl.dataset.bound) {
      compEl.dataset.bound = '1';
      compEl.addEventListener('input', autoGenSalaryStatementTxs);
      compEl.addEventListener('change', autoGenSalaryStatementTxs);
    }
    const stmtIfscEl = document.getElementById('bss-ifsc');
    if (stmtIfscEl && !stmtIfscEl.dataset.bound) {
      stmtIfscEl.dataset.bound = '1';
      stmtIfscEl.addEventListener('input', () => onSalaryStatementIFSCInput(stmtIfscEl.value));
      stmtIfscEl.addEventListener('change', () => onSalaryStatementIFSCInput(stmtIfscEl.value));
      stmtIfscEl.addEventListener('paste', () => setTimeout(() => onSalaryStatementIFSCInput(stmtIfscEl.value), 10));
    }
  }

  function _populateSalaryBankStatementDropdown() {
    const sel = document.getElementById('bss-bank');
    const dl = document.getElementById('bss-bank-list');
    const banks = _getBankConfigObjects();

    if (dl) {
      dl.innerHTML = banks.map(b => `<option value="${_esc(b.name)}">${_esc(b.name)}</option>`).join('');
    }

    if (!sel) return;

    if (!sel.value) {
      const icici = _matchBank('ICICI', banks);
      if (icici) {
        sel.value = icici.name;
        _updateSalaryStatementBankLogoPreview(icici);
      } else if (banks.length > 0) {
        sel.value = banks[0].name;
        _updateSalaryStatementBankLogoPreview(banks[0]);
      }
    } else {
      const currentBank = _matchBank(sel.value, banks) || { name: sel.value };
      _updateSalaryStatementBankLogoPreview(currentBank);
    }
  }

  function _populateSalaryStatementDates() {
    const fromEl = document.getElementById('bss-from');
    const toEl = document.getElementById('bss-to');
    if (!fromEl || !toEl) return;
    if (!fromEl.value || !toEl.value) {
      const today = new Date();
      const to = today.toISOString().slice(0, 10);
      const from = new Date(today.getFullYear(), today.getMonth() - 2, 1).toISOString().slice(0, 10);
      fromEl.value = from;
      toEl.value = to;
    }
  }

  function _populateSalaryCompanyList() {
    const dl = document.getElementById('bss-company-list');
    if (!dl) return;
    const comps = DB.getSlipCompanies();
    dl.innerHTML = comps.map(c => `<option value="${_esc(c.name)}">${_esc(c.name)}</option>`).join('');
  }

  function onSalaryStatementIFSCInput(ifsc) {
    const code = (ifsc || '').trim().toUpperCase();
    if (code.length === 11) {
      lookupSalaryStatementIFSC();
    }
  }

  async function lookupSalaryStatementIFSC() {
    const ifscInput = document.getElementById('bss-ifsc');
    const ifsc = (ifscInput?.value || '').trim().toUpperCase();
    if (!ifsc || ifsc.length !== 11) {
      alert('Please enter a valid 11-character IFSC code.');
      return;
    }
    const clean = ifsc.replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
    const banks = _getBankConfigObjects();
    const matched = banks.find(b => b.ifsc && b.ifsc.toUpperCase() === clean);
    if (matched) {
      // Only populate branch & address - make NO effect on bank name or logo
      const branchInput = document.getElementById('bss-branch');
      if (branchInput && matched.branch) branchInput.value = (matched.branch || matched.name).toUpperCase();
      const branchCodeInput = document.getElementById('bss-branchcode');
      if (branchCodeInput) branchCodeInput.value = clean.slice(-4);
      const branchAddrInput = document.getElementById('bss-branchaddress');
      if (branchAddrInput && matched.address) branchAddrInput.value = matched.address.toUpperCase();
      return;
    }

    await fetchBankDetailsByIFSC(clean, {
      branchElId: 'bss-branch',
      codeElId: 'bss-branchcode',
      addressElId: 'bss-branchaddress',
      manualAlert: true
    });
  }

  function _salaryStatementDates() {
    const from = document.getElementById('bss-from')?.value || '';
    const to = document.getElementById('bss-to')?.value || '';
    return { from, to };
  }

  function autoGenSalaryStatementTxs() {
    const { from, to } = _salaryStatementDates();
    if (!from || !to) return;
    const density = parseInt(document.getElementById('bss-density')?.value, 10) || 25;
    const opening = parseFloat(document.getElementById('bss-opening')?.value) || 150000;
    const minBalance = parseFloat(document.getElementById('bss-min-balance')?.value) || STMT_MIN_BALANCE;
    const targetAvgBalance = parseFloat(document.getElementById('bss-avg-balance')?.value) || 150000;
    const salaryAmount = parseFloat(document.getElementById('bss-salary-amount')?.value) || 65000;
    const companyName = document.getElementById('bss-company')?.value || 'TECH MAHINDRA LTD';
    const salaryDay = parseInt(document.getElementById('bss-salary-day')?.value, 10) || 5;

    const txs = BankStatementEngine.generateSalariedTransactions({
      fromDate: from,
      toDate: to,
      density,
      openingBalance: opening,
      minBalance,
      targetAvgBalance,
      salaryAmount,
      companyName,
      salaryDay
    });

    const container = document.getElementById('stmt-salary-tx-list');
    if (!container) return;
    container.innerHTML = '';
    txs.forEach(t => _appendSalaryTxnRow(t));
    recalcSalaryStatement();
  }

  function addSalaryStatementTxnRow() {
    const { from } = _salaryStatementDates();
    const tranSeq = Math.floor(10000000 + Math.random() * 80000000);
    _appendSalaryTxnRow({
      tranId: `S${tranSeq}`,
      txnDate: from || new Date().toISOString().slice(0, 10),
      valueDate: from || new Date().toISOString().slice(0, 10),
      description: 'UPI/Personal Expense/Transfer',
      debit: '',
      credit: ''
    });
    recalcSalaryStatement();
  }

  function clearSalaryStatementTxns() {
    const container = document.getElementById('stmt-salary-tx-list');
    if (container) container.innerHTML = '';
    recalcSalaryStatement();
  }

  function _appendSalaryTxnRow(tx) {
    const container = document.getElementById('stmt-salary-tx-list');
    if (!container) return;
    const row = document.createElement('div');
    row.className = 'stmt-tx-row';
    if (tx.isSalary) row.classList.add('stmt-salary-row');
    row.dataset.postedDate = tx.postedDate || '';
    row.dataset.valueDate = tx.valueDate || tx.txnDate || '';
    row.innerHTML = `
      <input type="text" class="form-control form-control-sm stmt-tx-tranid" value="${_esc(tx.tranId || '')}" placeholder="Tran ID" title="Transaction ID" oninput="App.recalcSalaryStatement()" />
      <input type="date" class="form-control form-control-sm stmt-tx-date" value="${_esc(tx.txnDate || '')}" title="Transaction Date" oninput="App.recalcSalaryStatement()" />
      <input type="text" class="form-control form-control-sm stmt-tx-desc" value="${_esc(tx.description || '')}" placeholder="Description / Remark Narration" title="${_esc(tx.description || '')}" oninput="App.recalcSalaryStatement()" />
      <input type="number" step="0.01" class="form-control form-control-sm stmt-tx-dr" value="${_esc(tx.debit || '')}" min="0" placeholder="Dr" oninput="App.recalcSalaryStatement()" />
      <input type="number" step="0.01" class="form-control form-control-sm stmt-tx-cr" value="${_esc(tx.credit || '')}" min="0" placeholder="Cr" oninput="App.recalcSalaryStatement()" />
      <div class="stmt-tx-bal">&nbsp;</div>
      <button class="btn btn-sm btn-outline-danger" title="Remove" onclick="this.closest('.stmt-tx-row').remove();App.recalcSalaryStatement()"><i class="bi bi-trash"></i></button>
    `;
    container.appendChild(row);
  }

  function _renderSalaryStatementTx() {
    const container = document.getElementById('stmt-salary-tx-list');
    if (!container) return;
    if (container.children.length === 0) autoGenSalaryStatementTxs();
    recalcSalaryStatement();
  }

  function recalcSalaryStatement() {
    const minBalance = parseFloat(document.getElementById('bss-min-balance')?.value) > 0
      ? parseFloat(document.getElementById('bss-min-balance')?.value)
      : STMT_MIN_BALANCE;
    const targetAvg = parseFloat(document.getElementById('bss-avg-balance')?.value) > 0
      ? parseFloat(document.getElementById('bss-avg-balance')?.value)
      : 150000;
    const opening = parseFloat(document.getElementById('bss-opening')?.value) || 0;
    const rows = document.querySelectorAll('#stmt-salary-tx-list .stmt-tx-row');
    let balance = opening;
    let totalDr = 0;
    let totalCr = 0;
    let breachCount = 0;
    let balSum = 0;

    const countEl = document.getElementById('stmt-salary-tx-count');
    if (countEl) countEl.textContent = rows.length;

    rows.forEach(row => {
      const dr = parseFloat(row.querySelector('.stmt-tx-dr')?.value) || 0;
      const cr = parseFloat(row.querySelector('.stmt-tx-cr')?.value) || 0;
      balance = balance - dr + cr;
      totalDr += dr;
      totalCr += cr;
      balSum += balance;
      const balEl = row.querySelector('.stmt-tx-bal');
      if (balEl) {
        balEl.textContent = '₹ ' + (balance.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }));
        row.classList.toggle('stmt-low-row', balance < minBalance);
        if (balance < minBalance) breachCount++;
      }
    });

    const closing = balance;
    const avgBal = rows.length > 0 ? (balSum / rows.length) : opening;

    _setText('stmt-salary-open-total', '₹ ' + opening.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }));
    _setText('stmt-salary-dr-total', '₹ ' + totalDr.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }));
    _setText('stmt-salary-cr-total', '₹ ' + totalCr.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }));
    _setText('stmt-salary-close-total', '₹ ' + closing.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }));

    const noteEl = document.getElementById('stmt-salary-avg-note');
    if (noteEl) {
      noteEl.innerHTML = `
        <div class="d-flex justify-content-between align-items-center flex-wrap gap-2">
          <span><strong>Average Daily Account Balance:</strong> ₹ ${avgBal.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} (Target: ₹ ${targetAvg.toLocaleString('en-IN', { minimumFractionDigits: 2 })} maintained)</span>
          <span><i class="bi bi-shield-check text-success me-1"></i> Minimum Balance Safeguard: ₹ ${minBalance.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
        </div>
      `;
      noteEl.classList.toggle('warn', breachCount > 0);
    }
  }

  function _collectSalaryStatementData() {
    const bankName = (document.getElementById('bss-bank')?.value || '').trim();
    const banks = _getBankConfigObjects();
    const bank = _matchBank(bankName, banks) || { name: bankName };
    const savedLogo = bank.logoData || _resolveBankLogo(bank.name || bankName, null);
    const effectiveLogo = _salaryStatementBankLogoData || savedLogo || null;
    const rows = document.querySelectorAll('#stmt-salary-tx-list .stmt-tx-row');
    const transactions = [];
    rows.forEach(row => {
      transactions.push({
        tranId: row.querySelector('.stmt-tx-tranid')?.value.trim() || '',
        txnDate: row.querySelector('.stmt-tx-date')?.value || '',
        valueDate: row.dataset.valueDate || row.querySelector('.stmt-tx-date')?.value || '',
        postedDate: row.dataset.postedDate || '',
        description: row.querySelector('.stmt-tx-desc')?.value.trim() || '',
        debit: row.querySelector('.stmt-tx-dr')?.value || '',
        credit: row.querySelector('.stmt-tx-cr')?.value || '',
      });
    });
    return {
      persona: 'salary',
      style: document.getElementById('bss-style')?.value || 'icici',
      companyName: document.getElementById('bss-company')?.value || 'TECH MAHINDRA LTD',
      salaryAmount: parseFloat(document.getElementById('bss-salary-amount')?.value) || 65000,
      bank: {
        name: bank.name || bankName,
        logoData: effectiveLogo,
        logoText: bank.logoText || (bankName ? bankName.slice(0, 2) : ''),
        address: document.getElementById('bss-branchaddress')?.value.trim() || bank.address || ''
      },
      account: {
        holder: document.getElementById('bss-holder')?.value.trim() || '',
        accountNo: document.getElementById('bss-acno')?.value.trim() || '',
        accountType: document.getElementById('bss-actype')?.value || 'SALARY',
        custId: document.getElementById('bss-custid')?.value.trim() || '',
        ifsc: document.getElementById('bss-ifsc')?.value.trim() || '',
        branch: document.getElementById('bss-branch')?.value.trim() || '',
        branchCode: document.getElementById('bss-branchcode')?.value.trim() || '',
        address: document.getElementById('bss-holderaddress')?.value.trim() || '',
        branchAddress: document.getElementById('bss-branchaddress')?.value.trim() || '',
        openingBalance: parseFloat(document.getElementById('bss-opening')?.value) || 150000,
      },
      fromDate: document.getElementById('bss-from')?.value || '',
      toDate: document.getElementById('bss-to')?.value || '',
      minBalance: parseFloat(document.getElementById('bss-min-balance')?.value) > 0
        ? parseFloat(document.getElementById('bss-min-balance')?.value)
        : STMT_MIN_BALANCE,
      targetAvgBalance: parseFloat(document.getElementById('bss-avg-balance')?.value) || 150000,
      transactions,
    };
  }

  let _editingSalaryStatementId = null;

  function editSalaryStatementRecord(id) {
    const r = DB.getStatementRecords().find(rec => rec.id === id);
    if (!r) return;

    _editingSalaryStatementId = r.id;
    setBankStatementPersona('salary');

    const bankEl = document.getElementById('bss-bank');
    if (bankEl) bankEl.value = r.bankName || '';

    _salaryStatementBankLogoData = r.bankLogo || null;
    const preview = document.getElementById('bss-logo-preview');
    if (preview) {
      if (r.bankLogo) {
        preview.innerHTML = `<img src="${r.bankLogo}" alt="Logo" style="width:100%;height:100%;object-fit:contain;" />`;
        preview.style.background = 'transparent';
      } else {
        previewBankLogo(r.bankName || 'B', 'bss-logo-preview');
      }
    }

    const styleEl = document.getElementById('bss-style');
    if (styleEl) styleEl.value = r.style || 'icici';

    const acTypeEl = document.getElementById('bss-actype');
    if (acTypeEl) acTypeEl.value = r.accountType || 'SALARY';

    const holderEl = document.getElementById('bss-holder');
    if (holderEl) holderEl.value = r.holder || '';

    const acnoEl = document.getElementById('bss-acno');
    if (acnoEl) acnoEl.value = r.accountNo || '';

    const custEl = document.getElementById('bss-custid');
    if (custEl) custEl.value = r.custId || '';

    const ifscEl = document.getElementById('bss-ifsc');
    if (ifscEl) ifscEl.value = r.ifsc || '';

    const branchEl = document.getElementById('bss-branch');
    if (branchEl) branchEl.value = r.branch || '';

    const branchCodeEl = document.getElementById('bss-branchcode');
    if (branchCodeEl) branchCodeEl.value = r.branchCode || '';

    const hAddrEl = document.getElementById('bss-holderaddress');
    if (hAddrEl) hAddrEl.value = r.holderAddress || '';

    const bAddrEl = document.getElementById('bss-branchaddress');
    if (bAddrEl) bAddrEl.value = r.branchAddress || '';

    const compEl = document.getElementById('bss-company');
    if (compEl) compEl.value = r.companyName || '';

    const salAmtEl = document.getElementById('bss-salary-amount');
    if (salAmtEl) salAmtEl.value = r.salaryAmount || 65000;

    const fromEl = document.getElementById('bss-from');
    if (fromEl) fromEl.value = r.fromDate || '';

    const toEl = document.getElementById('bss-to');
    if (toEl) toEl.value = r.toDate || '';

    const openEl = document.getElementById('bss-opening');
    if (openEl) openEl.value = r.openingBalance !== undefined ? r.openingBalance : 150000;

    const minEl = document.getElementById('bss-min-balance');
    if (minEl) minEl.value = r.minBalance || STMT_MIN_BALANCE;

    const avgEl = document.getElementById('bss-avg-balance');
    if (avgEl) avgEl.value = r.targetAvgBalance || 150000;

    const container = document.getElementById('stmt-salary-tx-list');
    if (container) {
      container.innerHTML = '';
      const txs = r.transactions || [];
      if (txs.length > 0) {
        txs.forEach(t => _appendSalaryTxnRow(t));
      } else {
        autoGenSalaryStatementTxs();
      }
    }

    recalcSalaryStatement();
    document.getElementById('bs-panel-salary')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  function generateSalaryBankStatement() {
    const data = _collectSalaryStatementData();
    if (!data.bank.name) { alert('Please select a bank.'); return; }
    if (!data.account.holder) { alert('Please enter account holder name.'); return; }
    if (!data.fromDate || !data.toDate) { alert('Please select a date range.'); return; }
    if (data.fromDate > data.toDate) { alert('From date must be before To date.'); return; }
    if (!data.account.accountNo) { alert('Please enter account number.'); return; }

    const html = BankStatementEngine.generate(data);

    // Save record
    const record = {
      ...( _editingSalaryStatementId ? { id: _editingSalaryStatementId } : {} ),
      persona: 'salary',
      style: data.style,
      bankName: data.bank.name,
      bankLogo: data.bank.logoData || null,
      bankLogoText: data.bank.logoText || '',
      bankAddress: data.bank.address || '',
      holder: data.account.holder,
      accountNo: data.account.accountNo,
      accountType: data.account.accountType,
      custId: data.account.custId,
      branchCode: data.account.branchCode,
      holderAddress: data.account.address,
      branchAddress: data.account.branchAddress,
      ifsc: data.account.ifsc,
      branch: data.account.branch,
      openingBalance: data.account.openingBalance,
      fromDate: data.fromDate,
      toDate: data.toDate,
      minBalance: data.minBalance,
      targetAvgBalance: data.targetAvgBalance,
      companyName: data.companyName,
      salaryAmount: data.salaryAmount,
      transactions: data.transactions,
    };
    DB.saveStatementRecord(record);

    const title = `${data.bank.name}_Salary_Statement`;
    const win = window.open('', '_blank', 'width=950,height=800');
    if (win) {
      win.document.title = title;
      win.document.write(html);
      win.document.close();
    } else {
      alert('Please allow popups to print the bank statement.');
    }

    renderSavedSalaryStatements();
  }

  function resetSalaryStatementForm() {
    _editingSalaryStatementId = null;

    ['bss-bank','bss-holder','bss-acno','bss-ifsc','bss-branch','bss-branchcode','bss-custid','bss-holderaddress','bss-branchaddress','bss-from','bss-to'].forEach(id => {
      const el = document.getElementById(id); if (el) el.value = '';
    });
    _salaryStatementBankLogoData = null;
    const logoUploadEl = document.getElementById('bss-logo-upload'); if (logoUploadEl) logoUploadEl.value = '';
    _updateSalaryStatementBankLogoPreview(null);
    const holderEl = document.getElementById('bss-holder'); if (holderEl) holderEl.value = 'MUKUL RAHAMAN';
    const acnoEl = document.getElementById('bss-acno'); if (acnoEl) acnoEl.value = '091405003332';
    const custEl = document.getElementById('bss-custid'); if (custEl) custEl.value = '573886835';
    const ifscEl = document.getElementById('bss-ifsc'); if (ifscEl) ifscEl.value = 'ICIC0000914';
    const brEl = document.getElementById('bss-branch'); if (brEl) brEl.value = 'BASIRHAT';
    const brCodeEl = document.getElementById('bss-branchcode'); if (brCodeEl) brCodeEl.value = '0914';
    const hAddrEl = document.getElementById('bss-holderaddress'); if (hAddrEl) hAddrEl.value = 'CHOWRASHI, DEGANGA, CHAURASHI, NORTH 24 PARGANAS, 743424, WEST BENGAL, INDIA';
    const bAddrEl = document.getElementById('bss-branchaddress'); if (bAddrEl) bAddrEl.value = 'ICICI BANK LTD., BASIRHAT BRANCH, BHAWANIPUR, PO.-BASIRHAT COLLEGE, DIST.- 24 PARGANAS (NORTH).743 412, NORTH 24 PARGANAS, WEST BENGAL, INDIA';
    const actypeEl = document.getElementById('bss-actype'); if (actypeEl) actypeEl.value = 'SALARY';
    const compEl = document.getElementById('bss-company'); if (compEl) compEl.value = 'TECH MAHINDRA LTD';
    const salAmtEl = document.getElementById('bss-salary-amount'); if (salAmtEl) salAmtEl.value = '65000';
    const avgEl = document.getElementById('bss-avg-balance'); if (avgEl) avgEl.value = '150000';
    const openingEl = document.getElementById('bss-opening'); if (openingEl) openingEl.value = '150000';
    const minEl = document.getElementById('bss-min-balance'); if (minEl) minEl.value = String(STMT_MIN_BALANCE);
    const container = document.getElementById('stmt-salary-tx-list');
    if (container) container.innerHTML = '';
    _populateSalaryBankStatementDropdown();
    _populateSalaryStatementDates();
    _populateSalaryCompanyList();
    _renderSalaryStatementTx();
  }

  function renderSavedSalaryStatements() {
    const container = document.getElementById('stmt-salary-saved-list');
    if (!container) return;
    const records = DB.getStatementRecords().filter(r => r.persona === 'salary');
    if (!records.length) {
      container.innerHTML = '<div class="text-center text-muted py-4" style="font-size:12px">No saved salaried statements yet.</div>';
      return;
    }
    container.innerHTML = records.map(r => {
      const initials = (r.holder || 'A').split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase();
      const date = r.createdAt ? new Date(r.createdAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '';
      const salaryAmt = parseFloat(r.salaryAmount) || 0;
      const compName = r.companyName || 'Corporate Employer';
      return `
      <div class="ss-saved-card">
        <div class="ss-saved-avatar salaried">${initials}</div>
        <div class="ss-saved-info">
          <div class="ss-saved-title-row">
            <span class="ss-saved-name">${_esc(r.holder || 'Unknown')}</span>
            <span class="ss-badge-salaried"><i class="bi bi-person-check-fill"></i> Salaried</span>
            <span class="ss-badge-company" title="${_esc(compName)}"><i class="bi bi-building"></i> ${_esc(compName)}</span>
          </div>
          <div class="ss-saved-meta">
            <span class="ss-saved-meta-item"><strong>${_esc(r.bankName || 'Bank')}</strong></span>
            <span>•</span>
            <span class="ss-saved-meta-item">A/c: <code>${_esc(r.accountNo || '--')}</code></span>
            <span>•</span>
            <span class="ss-saved-meta-item ss-saved-salary-tag"><i class="bi bi-cash-stack"></i> Salary: ₹${salaryAmt.toLocaleString('en-IN')}</span>
            <span>•</span>
            <span class="ss-saved-meta-item"><i class="bi bi-calendar-event"></i> ${r.fromDate} → ${r.toDate}</span>
            <span>•</span>
            <span class="ss-saved-meta-item">${r.transactions?.length || 0} txns</span>
            <span>•</span>
            <span class="ss-saved-meta-item"><i class="bi bi-clock-history"></i> ${date}</span>
          </div>
        </div>
        <div class="ss-saved-actions">
          <button class="btn btn-sm btn-outline-warning" onclick="App.editSalaryStatementRecord('${r.id}')" title="Edit Statement"><i class="bi bi-pencil-square me-1"></i>Edit</button>
          <button class="btn btn-sm btn-outline-primary" onclick="App.reprintStatementRecord('${r.id}')" title="Reprint"><i class="bi bi-printer-fill me-1"></i>Print</button>
          <button class="btn btn-sm btn-outline-secondary" onclick="App.downloadStatementRecord('${r.id}')" title="Download JSON"><i class="bi bi-download"></i></button>
          <button class="btn btn-sm btn-outline-danger" onclick="App.deleteStatementRecord('${r.id}')" title="Delete"><i class="bi bi-trash"></i></button>
        </div>
      </div>`;
    }).join('');
    updateProjectStorageStats();
  }

  function reprintStatementRecord(id) {
    const r = DB.getStatementRecords().find(rec => rec.id === id);
    if (!r) return;
    const resolvedLogo = _resolveBankLogo(r.bankName, r.bankLogo);
    const html = BankStatementEngine.generate({
      style: r.style || 'icici',
      bank: { name: r.bankName, logoData: resolvedLogo, logoText: r.bankLogoText, address: r.branchAddress || r.bankAddress },
      account: {
        holder: r.holder,
        accountNo: r.accountNo,
        accountType: r.accountType || (r.persona === 'salary' ? 'SB' : 'CAA'),
        custId: r.custId || '573886835',
        branchCode: r.branchCode || '0914',
        address: r.holderAddress || '',
        branchAddress: r.branchAddress || '',
        ifsc: r.ifsc,
        branch: r.branch,
        openingBalance: r.openingBalance
      },
      fromDate: r.fromDate,
      toDate: r.toDate,
      minBalance: r.minBalance,
      transactions: r.transactions || [],
    });
    const win = window.open('', '_blank', 'width=950,height=800');
    if (win) {
      win.document.title = `${r.bankName}_Statement`;
      win.document.write(html);
      win.document.close();
    }
  }

  function deleteStatementRecord(id) {
    if (!confirm('Delete this bank statement record?')) return;
    DB.removeStatementRecord(id);
    renderSavedStatements();
    renderSavedSalaryStatements();
  }

  // ── Utils ───────────────────────────────────────────────────
  function _uid() {
    return Math.random().toString(36).slice(2, 9);
  }

  function _esc(str) {
    if (!str) return '';
    return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');
  }

  // ── Public API ──────────────────────────────────────────────
  const appInstance = {
    init, navTo,
    nextStep, prevStep,
    addBank, removeBank, setPrimary, syncBanks: _syncBanks,
    onNatureChange, onDeductorChange,
    toggleIncome, recalcIncome,
    selectReport, generateReport, generateAck, triggerPrint,
    saveClient,
    searchClients, editClient, deleteClient, duplicateClient, printClient, printClientAck,
    saveAdminConfig, downloadLocalBackup, restoreLocalBackup, filterAdminSection,
    addCustomAY, removeCustomAY,
    addCustomDeductor, removeCustomDeductor, editCustomDeductor, saveEditDeductor,
    addPresetDeductors, filterDeductors, _renderDeductors,
    addBankConfig, removeBankConfig, editBankConfig, saveEditBankConfig, filterBankConfigs, addPresetBanks,
    fetchBankDetailsByIFSC, onAdminIFSCInput, lookupAdminIFSC, onEditBankIFSCInput, lookupEditBankIFSC,
    onStatementIFSCInput, lookupStatementIFSC,
    previewBankLogo, uploadBankLogo, uploadEditBankLogo,
    fetchBrandfetchBankLogo, fetchBrandfetchEditBankLogo,
    autoGenerateBS, recalcBS,
    addNatureCode, removeNatureCode, editNatureCode, saveEditNatureCode, filterNatureCodes, addPresetNatureCodes,
    addSlipCompany, removeSlipCompany, editSlipCompany, saveEditSlipCompany, _renderSlipCompanies,
    previewAutoLogo, autoGenSlipLogo, uploadSlipLogo, autoGenEditSlipLogo, uploadEditSlipLogo,
    setSlipMode, previewSlipAuto, applyAutoFill,
    toggleSlipMonth, selectSlipMonthsPreset, getSelectedSlipMonths,
    calcSlipNet, addSlipEarning, addSlipDeduction, resetSlipForm, saveSlipEmployee, generateSalarySlip,
    renderSavedSlips, editSlipRecord, reprintSlipRecord, deleteSlipRecord,
    autoGenStatementTxs, addStatementTxnRow, clearStatementTxns, recalcStatement,
    autoGenSalaryStatementTxs, addSalaryStatementTxnRow, clearSalaryStatementTxns, recalcSalaryStatement,
    onSalaryStatementIFSCInput, lookupSalaryStatementIFSC,
    uploadStatementBankLogo, setBankStatementPersona,
    generateBankStatement, resetBankStatementForm, renderSavedStatements, editStatementRecord, reprintStatementRecord, deleteStatementRecord,
    generateSalaryBankStatement, resetSalaryStatementForm, renderSavedSalaryStatements, editSalaryStatementRecord,
    downloadClientRecord, downloadAllClients,
    downloadSlipRecord, downloadAllSlips,
    downloadStatementRecord, downloadAllStatements,
    downloadAllCompanies, updateProjectStorageStats,
  };

  if (typeof window !== 'undefined') {
    window.App = appInstance;
  }

  return appInstance;
})();

// ── Bootstrap ─────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => App.init());
