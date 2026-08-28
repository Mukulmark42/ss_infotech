/**
 * ═══════════════════════════════════════════════════════════
 * MODERN REPORT GENERATOR  –  v2 Premium Design
 * Full-colour, section-divided, print-ready professional report
 * with gradient header, stat cards, timeline layout, and
 * proper page-break hints for multi-page print.
 * ═══════════════════════════════════════════════════════════
 */

const ReportModern = (() => {

  function generate(data) {
    const { client, computation, tds, bankInterest, banks,
            stcgDetails, adminConfig, turnover, compNo, balanceSheet } = data;
    const { fmtNum } = TaxEngine;
    const c         = computation;
    const cfg       = c.cfg || TaxEngine.getConfig(client.ay || '2026-27');

    const company   = (adminConfig && adminConfig.company)   || 'SS INFOTECH';
    const footer    = (adminConfig && adminConfig.footer)    || 'Professional Tax Computation Services';
    const signatory = (adminConfig && adminConfig.signatory) || 'Proprietor';
    const fy        = _getFY(client.ay);
    const filingDateObj = _getFilingDateObj(client);
    const today     = filingDateObj.toLocaleDateString('en-IN', { day:'2-digit', month:'long', year:'numeric' });
    const cmpNo     = compNo || data.compNo || 'CMP-' + new Date().getFullYear() + '-000001';
    const initials  = (client.name || 'C').split(' ').map(n => n[0]).join('').slice(0,2).toUpperCase();
    const profitPct = data.profitPct || 20;

    const isRefund  = c.refund > 0;
    const isNil     = !isRefund && c.taxDue === 0;
    const resultColor  = isRefund ? '#059669' : isNil ? '#4f46e5' : '#dc2626';
    const resultLabel  = isRefund ? 'REFUND DUE' : isNil ? 'NIL TAX' : 'TAX PAYABLE';
    const resultAmt    = isRefund ? c.refund : c.taxDue;

    const hasSTCG = c.stcg > 0;
    const hasPL   = c.pl   > 0;

    return `
<style>
/* ─── Modern Report Inline Styles ─────────────────────────── */
.mrpt { font-family: 'Segoe UI', Arial, sans-serif; color: #1e293b; font-size: 10pt; background:#fff; }

/* COVER HEADER */
.mrpt-cover {
  background: linear-gradient(135deg, #312e81 0%, #4f46e5 45%, #7c3aed 100%);
  color:#fff; padding:28px 32px 22px; position:relative; overflow:hidden;
  border-radius:0;
}
.mrpt-cover::before {
  content:''; position:absolute; top:-40px; right:-40px;
  width:220px; height:220px; border-radius:50%;
  background:rgba(255,255,255,.07);
}
.mrpt-cover::after {
  content:''; position:absolute; bottom:-60px; left:30%;
  width:300px; height:300px; border-radius:50%;
  background:rgba(255,255,255,.04);
}
.mrpt-cover-mid { margin-top:16px; display:flex; align-items:flex-end; gap:18px; }
.mrpt-avatar    {
  width:60px; height:60px; border-radius:50%;
  background:rgba(255,255,255,.18); display:flex; align-items:center;
  justify-content:center; font-size:22pt; font-weight:800; flex-shrink:0;
  border:2px solid rgba(255,255,255,.4);
}
.mrpt-client-name  { font-size:15pt; font-weight:700; line-height:1.2; }
.mrpt-client-pan   { font-size:9pt; opacity:.8; font-family:monospace; margin-top:3px; }
.mrpt-cover-right  { margin-left:auto; text-align:right; }
.mrpt-cover-chip   {
  display:inline-block; background:rgba(255,255,255,.15);
  border:1px solid rgba(255,255,255,.3); border-radius:20px;
  padding:3px 12px; font-size:8pt; margin-bottom:5px;
}

/* RESULT BANNER */
.mrpt-result-banner {
  display:flex; align-items:center; justify-content:space-between;
  padding:14px 28px; margin:0;
  border-left:6px solid var(--rc);
  background:linear-gradient(90deg, color-mix(in srgb, var(--rc) 12%, #fff), #fff);
}
.mrpt-result-lbl  { font-size:11pt; font-weight:700; color:var(--rc); }
.mrpt-result-amt  { font-size:22pt; font-weight:800; color:var(--rc); letter-spacing:-.02em; }
.mrpt-result-meta { font-size:8pt; color:#64748b; margin-top:2px; }

/* STAT CARDS ROW */
.mrpt-stats { display:grid; grid-template-columns:repeat(4,1fr); gap:10px; padding:14px 24px; background:#f8fafc; }
.mrpt-stat {
  background:#fff; border-radius:10px; padding:10px 14px;
  border-left:4px solid var(--sc); box-shadow:0 1px 4px rgba(0,0,0,.06);
}
.mrpt-stat-val  { font-size:12pt; font-weight:800; color:var(--sc); }
.mrpt-stat-lbl  { font-size:7.5pt; color:#64748b; margin-top:2px; text-transform:uppercase; letter-spacing:.05em; }

/* BODY */
.mrpt-body { padding:20px 24px; }
.mrpt-section-header {
  display:flex; align-items:center; gap:8px;
  font-size:9.5pt; font-weight:700; text-transform:uppercase; letter-spacing:.08em;
  color:#4f46e5; border-bottom:2px solid #4f46e5; padding-bottom:4px; margin:18px 0 10px;
}
.mrpt-section-header .icon { font-size:13pt; }

/* INFO GRID */
.mrpt-info-grid {
  display:grid; grid-template-columns:repeat(3,1fr); gap:6px 16px;
}
.mrpt-info-cell { padding:5px 0; border-bottom:1px solid #f1f5f9; }
.mrpt-info-lbl  { font-size:7.5pt; color:#94a3b8; text-transform:uppercase; letter-spacing:.05em; margin-bottom:2px; }
.mrpt-info-val  { font-size:9pt; font-weight:600; color:#1e293b; word-break:break-word; }

/* INCOME CARDS */
.mrpt-inc-grid { display:grid; grid-template-columns:repeat(2,1fr); gap:10px; }
.mrpt-inc-card {
  border-radius:10px; padding:12px 16px;
  display:flex; align-items:center; gap:12px;
  border:1px solid rgba(0,0,0,.06);
}
.mrpt-inc-icon { font-size:22pt; flex-shrink:0; }
.mrpt-inc-lbl  { font-size:8pt; color:#64748b; text-transform:uppercase; letter-spacing:.04em; }
.mrpt-inc-amt  { font-size:12pt; font-weight:800; margin-top:2px; }
.mrpt-inc-sub  { font-size:7.5pt; color:#94a3b8; margin-top:2px; }
.ic-biz   { background:linear-gradient(135deg,#ede9fe,#f5f3ff); }
.ic-biz .mrpt-inc-amt { color:#4f46e5; }
.ic-int   { background:linear-gradient(135deg,#d1fae5,#f0fdf4); }
.ic-int .mrpt-inc-amt { color:#059669; }
.ic-stcg  { background:linear-gradient(135deg,#fef3c7,#fffbeb); }
.ic-stcg .mrpt-inc-amt { color:#d97706; }
.ic-pl    { background:linear-gradient(135deg,#fce7f3,#fdf2f8); }
.ic-pl .mrpt-inc-amt  { color:#9d174d; }
.ic-tot   { background:linear-gradient(135deg,#e0e7ff,#eef2ff); grid-column:1/-1; }
.ic-tot .mrpt-inc-amt { color:#3730a3; font-size:15pt; }

/* TAX TIMELINE */
.mrpt-tax-steps { display:flex; flex-direction:column; gap:0; }
.mrpt-tax-step {
  display:flex; align-items:center; padding:8px 14px;
  border-left:3px solid #e2e8f0; margin-left:12px;
  position:relative;
}
.mrpt-tax-step::before {
  content:''; position:absolute; left:-7px; top:50%; transform:translateY(-50%);
  width:12px; height:12px; border-radius:50%;
  background:var(--dot); border:2px solid #fff;
  box-shadow:0 0 0 2px var(--dot);
}
.mrpt-tax-step.bold { border-left-color:#4f46e5; font-weight:700; background:#f8f9ff; border-radius:0 8px 8px 0; }
.mrpt-tax-step.bold::before { background:#4f46e5; box-shadow:0 0 0 2px #4f46e5; }
.mrpt-tax-step.green { color:#059669; }
.mrpt-tax-step.red   { color:#dc2626; }
.mrpt-tax-lbl { flex:1; font-size:9.5pt; }
.mrpt-tax-amt { font-size:10pt; font-weight:700; text-align:right; min-width:90px; }

/* TDS TABLE */
.mrpt-table { width:100%; border-collapse:collapse; font-size:8.5pt; }
.mrpt-table th { background:#312e81; color:#fff; padding:6px 10px; text-align:left; font-weight:600; }
.mrpt-table td { padding:5px 10px; border-bottom:1px solid #f1f5f9; }
.mrpt-table tr:last-child td { border-bottom:none; }
.mrpt-table tr.foot td { background:#eef2ff; font-weight:700; color:#3730a3; }
.mrpt-table .sec-badge {
  background:#ede9fe; color:#4f46e5; border-radius:4px;
  padding:1px 7px; font-size:7.5pt; font-weight:800; display:inline-block;
}
.mrpt-table .num { text-align:right; font-family:monospace; }

/* BALANCE SHEET TABLE */
.mrpt-bs-table th { background:#1e3a5f; }
.mrpt-bs-table td { font-size:8.5pt; }
.mrpt-bs-table tr:last-child td { border-top:2px solid #1e3a5f; font-weight:700; background:#f0f4ff; }

/* BANK CARDS */
.mrpt-bank-grid { display:grid; grid-template-columns:repeat(2,1fr); gap:10px; }
.mrpt-bank-card {
  border:1px solid #e2e8f0; border-radius:10px; padding:12px 14px;
  position:relative; overflow:hidden;
}
.mrpt-bank-card::before {
  content:''; position:absolute; top:0; left:0; right:0; height:3px;
  background:linear-gradient(90deg,#4f46e5,#7c3aed);
}
.mrpt-bank-name  { font-size:10pt; font-weight:700; margin-bottom:8px; color:#1e293b; }
.mrpt-bank-row   { display:flex; justify-content:space-between; font-size:8pt; padding:2px 0; border-bottom:1px solid #f8fafc; color:#64748b; }
.mrpt-bank-row span:last-child { font-weight:600; color:#334155; font-family:monospace; }
.mrpt-primary-chip {
  display:inline-block; background:#d1fae5; color:#065f46;
  border-radius:20px; padding:1px 8px; font-size:7pt; font-weight:700; margin-left:6px;
}

/* SIGNATURE */
.mrpt-sign-area {
  display:flex; justify-content:space-between; align-items:flex-end;
  margin-top:24px; padding:16px 20px; border:1px dashed #cbd5e1; border-radius:10px;
  background:#f8fafc;
}
.mrpt-sign-block { text-align:center; min-width:140px; }
.mrpt-sign-line  { border-top:1.5px solid #334155; width:130px; margin:0 auto 5px; }
.mrpt-sign-name  { font-size:9pt; font-weight:700; }
.mrpt-sign-sub   { font-size:8pt; color:#64748b; }

/* FOOTER BAR */
.mrpt-footer-bar {
  margin-top:16px; padding:10px 24px;
  background:linear-gradient(90deg,#312e81,#4f46e5);
  color:rgba(255,255,255,.85); font-size:8pt;
  display:flex; justify-content:space-between; align-items:center;
}

/* PAGE BREAKS */
.mrpt-page-break { page-break-after:always; break-after:page; border:none; height:0; margin:0; }
.mrpt-keep { page-break-inside:avoid; break-inside:avoid; }

@media print {
  .mrpt-cover { -webkit-print-color-adjust:exact; print-color-adjust:exact; }
  .mrpt-stats { -webkit-print-color-adjust:exact; print-color-adjust:exact; }
  .mrpt-table th { -webkit-print-color-adjust:exact; print-color-adjust:exact; }
  .mrpt-footer-bar { -webkit-print-color-adjust:exact; print-color-adjust:exact; }
  .mrpt-result-banner { -webkit-print-color-adjust:exact; print-color-adjust:exact; }
  .mrpt-inc-card { -webkit-print-color-adjust:exact; print-color-adjust:exact; }
}
</style>

<div class="mrpt">

<!-- ══════════ COVER HEADER ══════════ -->
<div class="mrpt-cover">
  <div style="text-align:center;position:relative;z-index:1;">
    <div class="mrpt-cover-chip">📋 Income Tax Computation</div>&nbsp;
    <div class="mrpt-cover-chip">🗓 AY ${client.ay || ''} &nbsp;|&nbsp; FY ${fy}</div>&nbsp;
    <div class="mrpt-cover-chip">🏛 ${cfg.regime || 'New'} Tax Regime &nbsp;|&nbsp; Section 44AD</div>
  </div>
  <div class="mrpt-cover-mid" style="position:relative;z-index:1;">
    <div class="mrpt-avatar">${initials}</div>
    <div>
      <div class="mrpt-client-name">${(client.name || '').toUpperCase()}</div>
      <div class="mrpt-client-pan">PAN: ${(client.pan || '').toUpperCase()} &nbsp;|&nbsp; ${client.mobile || ''} &nbsp;|&nbsp; ${client.status || 'Resident'}</div>
      <div style="font-size:8pt;opacity:.7;margin-top:4px;">${(client.address || '').toUpperCase()}</div>
    </div>
    <div class="mrpt-cover-right">
      <div style="font-size:8pt;opacity:.7;">Filed u/s: ${client.filing || '139(1)'} &nbsp;|&nbsp; Ward: ${client.ward || 'Ward-1(1)'}</div>
      <div style="font-size:8pt;opacity:.7;margin-top:3px;">Prepared: ${today}</div>
    </div>
  </div>
</div>

<!-- RESULT BANNER -->
<div class="mrpt-result-banner" style="--rc:${resultColor}">
  <div>
    <div class="mrpt-result-lbl">${resultLabel}</div>
    <div class="mrpt-result-meta">
      ${isRefund ? 'Refund will be credited to primary bank account' : isNil ? 'No tax payable — fully covered by rebate' : 'Balance tax payable before due date'}
    </div>
  </div>
  <div class="mrpt-result-amt">₹ ${fmtNum(resultAmt)}</div>
</div>

<!-- STAT CARDS -->
<div class="mrpt-stats">
  <div class="mrpt-stat" style="--sc:#4f46e5">
    <div class="mrpt-stat-val">₹ ${fmtNum(c.totalIncome)}</div>
    <div class="mrpt-stat-lbl">Total Income</div>
  </div>
  <div class="mrpt-stat" style="--sc:#0891b2">
    <div class="mrpt-stat-val">₹ ${fmtNum(turnover)}</div>
    <div class="mrpt-stat-lbl">Gross Turnover (44AD)</div>
  </div>
  <div class="mrpt-stat" style="--sc:#7c3aed">
    <div class="mrpt-stat-val">₹ ${fmtNum(c.totalTaxPayable)}</div>
    <div class="mrpt-stat-lbl">Tax Liability</div>
  </div>
  <div class="mrpt-stat" style="--sc:#059669">
    <div class="mrpt-stat-val">₹ ${fmtNum(tds.totalTDS)}</div>
    <div class="mrpt-stat-lbl">TDS Credit</div>
  </div>
</div>

<!-- ══════════ BODY ══════════ -->
<div class="mrpt-body">

  <!-- ASSESSEE DETAILS -->
  <div class="mrpt-section-header"><span class="icon">👤</span> Assessee Information</div>
  <div class="mrpt-info-grid mrpt-keep">
    ${_infoCell('Full Name',        (client.name||'').toUpperCase())}
    ${_infoCell('PAN',              `<span style="font-family:monospace;color:#4f46e5;font-weight:800">${(client.pan||'').toUpperCase()}</span>`)}
    ${_infoCell('Father\'s Name',   (client.father||'').toUpperCase())}
    ${_infoCell('Date of Birth',    _formatDate(client.dob))}
    ${_infoCell('Mobile',           client.mobile||'—')}
    ${_infoCell('Email',            client.email||'—')}
    ${_infoCell('Nature of Biz',    `${(client.bname || '').toUpperCase() ? (client.bname || '').toUpperCase() + ' - ' : ''}${(client.nature || 'Retail Trade').toUpperCase()} [${client.bcode||'0204'}]`)}
    ${_infoCell('Assessment Year',  client.ay||'')}
    ${_infoCell('Ward / Circle',    client.ward||'Ward-1(1)')}
    ${_infoCell('Filed u/s',        client.filing||'139(1)')}
    ${_infoCell('Tax Regime',       cfg.regime||'New')}
    ${_infoCell('Res. Status',      client.status||'Resident')}
  </div>

  <!-- INCOME SUMMARY -->
  <div class="mrpt-section-header"><span class="icon">💰</span> Income Summary</div>
  <div class="mrpt-inc-grid mrpt-keep">
    <div class="mrpt-inc-card ic-biz">
      <div class="mrpt-inc-icon">🏢</div>
      <div>
        <div class="mrpt-inc-lbl">Business Income${(client.bname || '').toUpperCase() ? ' - ' + (client.bname || '').toUpperCase() : ''} (Section 44AD)</div>
        <div class="mrpt-inc-amt">₹ ${fmtNum(c.businessIncome)}</div>
        <div class="mrpt-inc-sub">Turnover ₹${fmtNum(turnover)} @ ${profitPct}%</div>
      </div>
    </div>
    <div class="mrpt-inc-card ic-int">
      <div class="mrpt-inc-icon">🏦</div>
      <div>
        <div class="mrpt-inc-lbl">Savings Bank Interest (Other Sources)</div>
        <div class="mrpt-inc-amt">₹ ${fmtNum(c.savingsInterest)}</div>
        <div class="mrpt-inc-sub">From ${(banks||[]).length} bank account(s)</div>
      </div>
    </div>
    ${hasSTCG ? `
    <div class="mrpt-inc-card ic-stcg">
      <div class="mrpt-inc-icon">📈</div>
      <div>
        <div class="mrpt-inc-lbl">Short Term Capital Gain [u/s 111A]</div>
        <div class="mrpt-inc-amt">₹ ${fmtNum(c.stcg)}</div>
        <div class="mrpt-inc-sub">Taxed @ ${(cfg.stcgRate||.15)*100}% flat</div>
      </div>
    </div>` : ''}
    ${hasPL ? `
    <div class="mrpt-inc-card ic-pl">
      <div class="mrpt-inc-icon">📊</div>
      <div>
        <div class="mrpt-inc-lbl">P&amp;L / Other Income</div>
        <div class="mrpt-inc-amt">₹ ${fmtNum(c.pl)}</div>
        <div class="mrpt-inc-sub">Included in Other Sources</div>
      </div>
    </div>` : ''}
    <div class="mrpt-inc-card ic-tot">
      <div class="mrpt-inc-icon">💰</div>
      <div>
        <div class="mrpt-inc-lbl">Gross Total Income</div>
        <div class="mrpt-inc-amt">₹ ${fmtNum(c.grossTotalIncome)}</div>
        <div class="mrpt-inc-sub">
          Less: 80TTA ₹${fmtNum(c.deduction80TTA)} &nbsp;→&nbsp;
          <b>Total Income: ₹${fmtNum(c.totalIncome)}</b>
        </div>
      </div>
    </div>
  </div>

  <!-- TAX COMPUTATION -->
  <div class="mrpt-section-header mrpt-page-break" style="margin-top:0;"><span class="icon">🧮</span> Tax Computation — ${cfg.regime || 'New'} Regime AY ${client.ay||''}</div>
  <div class="mrpt-tax-steps mrpt-keep">
    <div class="mrpt-tax-step" style="--dot:#94a3b8">
      <span class="mrpt-tax-lbl">Gross Total Income</span>
      <span class="mrpt-tax-amt">₹ ${fmtNum(c.grossTotalIncome)}</span>
    </div>
    <div class="mrpt-tax-step green" style="--dot:#059669">
      <span class="mrpt-tax-lbl">Less: Deduction u/s 80TTA (Savings Interest)</span>
      <span class="mrpt-tax-amt" style="color:#059669">– ₹ ${fmtNum(c.deduction80TTA)}</span>
    </div>
    <div class="mrpt-tax-step bold" style="--dot:#4f46e5">
      <span class="mrpt-tax-lbl">Total Income [Rounded u/s 288A]</span>
      <span class="mrpt-tax-amt">₹ ${fmtNum(c.totalIncome)}</span>
    </div>
    ${_slabRows(c.regularIncome, cfg, fmtNum)}
    ${hasSTCG ? `<div class="mrpt-tax-step" style="--dot:#d97706">
      <span class="mrpt-tax-lbl">Tax on STCG u/s 111A [${(cfg.stcgRate||.15)*100}% on ₹${fmtNum(c.stcg)}]</span>
      <span class="mrpt-tax-amt">₹ ${fmtNum(c.taxOnSTCG)}</span>
    </div>` : ''}
    <div class="mrpt-tax-step bold" style="--dot:#4f46e5">
      <span class="mrpt-tax-lbl">Tax on Total Income</span>
      <span class="mrpt-tax-amt">₹ ${fmtNum(c.taxBeforeRebate)}</span>
    </div>
    <div class="mrpt-tax-step" style="--dot:#059669">
      <span class="mrpt-tax-lbl" style="color:#059669">Less: Rebate u/s 87A</span>
      <span class="mrpt-tax-amt" style="color:#059669">– ₹ ${fmtNum(c.rebate)}</span>
    </div>
    <div class="mrpt-tax-step" style="--dot:#64748b">
      <span class="mrpt-tax-lbl">Tax after Rebate</span>
      <span class="mrpt-tax-amt">₹ ${fmtNum(c.taxAfterRebate)}</span>
    </div>
    <div class="mrpt-tax-step" style="--dot:#0891b2">
      <span class="mrpt-tax-lbl">Add: Health &amp; Education Cess @ 4%</span>
      <span class="mrpt-tax-amt">₹ ${fmtNum(c.cess)}</span>
    </div>
    <div class="mrpt-tax-step bold" style="--dot:#312e81">
      <span class="mrpt-tax-lbl">Total Tax Liability [Rounded u/s 288B]</span>
      <span class="mrpt-tax-amt">₹ ${fmtNum(c.totalTaxPayable)}</span>
    </div>
    <div class="mrpt-tax-step" style="--dot:#059669">
      <span class="mrpt-tax-lbl" style="color:#059669">Less: TDS Deducted at Source (26AS)</span>
      <span class="mrpt-tax-amt" style="color:#059669">– ₹ ${fmtNum(c.tdsCredit)}</span>
    </div>
    <div class="mrpt-tax-step bold" style="--dot:${resultColor}; background:color-mix(in srgb, ${resultColor} 8%, #fff);">
      <span class="mrpt-tax-lbl" style="color:${resultColor}; font-size:11pt;">${resultLabel}</span>
      <span class="mrpt-tax-amt" style="color:${resultColor}; font-size:13pt;">₹ ${fmtNum(resultAmt)}</span>
    </div>
  </div>

  <!-- PROFIT & LOSS STATEMENT -->
  <div class="mrpt-section-header mrpt-keep"><span class="icon">📊</span> Profit &amp; Loss Statement (Estimated u/s 44AD)</div>
  <div class="mrpt-keep">
  <table class="mrpt-table">
    <thead><tr><th>Particulars</th><th class="num">Amount (₹)</th></tr></thead>
    <tbody>
      <tr><td>Gross Receipts / Turnover</td><td class="num">${fmtNum(turnover)}</td></tr>
      <tr><td>Less: Presumptive Expenses (80% of Turnover)</td><td class="num" style="color:#dc2626">(${fmtNum(Math.round(turnover - c.businessIncome))})</td></tr>
      <tr class="foot"><td><b>Net Profit — Section 44AD (Declared @ ${profitPct}%)</b></td><td class="num"><b>₹ ${fmtNum(c.businessIncome)}</b></td></tr>
      ${c.savingsInterest > 0 ? `<tr><td>Add: Savings Bank Interest</td><td class="num">${fmtNum(c.savingsInterest)}</td></tr>` : ''}
      ${c.stcg > 0 ? `<tr><td>Add: Short Term Capital Gain (u/s 111A)</td><td class="num">${fmtNum(c.stcg)}</td></tr>` : ''}
      ${(c.pl || 0) > 0 ? `<tr><td>Add: Other Income (P&amp;L)</td><td class="num">${fmtNum(c.pl)}</td></tr>` : ''}
      <tr style="background:#f8fafc;"><td><b>Total Income</b></td><td class="num"><b>₹ ${fmtNum(c.grossTotalIncome)}</b></td></tr>
    </tbody>
  </table>
  </div>

  <!-- BALANCE SHEET -->
  ${(() => {
    const bs = balanceSheet || {};
    const a = bs.assets || {};
    const l = bs.liabilities || {};
    const bankBal = a.bank ?? (banks || []).reduce((s, b) => s + (parseFloat(b.balance) || 0), 0);
    const tA = (a.cash||0) + (a.bank||0) + (a.stock||0) + (a.debtors||0) + (a.fixed||0);
    const tL = (l.capital||0) + (l.provtax||0) + (l.creditors||0) + (l.loan||0) + (l.netprofit||0);
    const totalA = tA > 0 ? tA : Math.round(turnover * 0.15 + turnover * 0.20 + bankBal + c.tdsCredit);
    const totalL = tL > 0 ? tL : Math.round(c.businessIncome + c.taxDue + turnover * 0.10);
    return `
  <div class="mrpt-section-header mrpt-keep" style="margin-top:18px;"><span class="icon">🏦</span> Balance Sheet (As on 31st March)</div>
  <div class="mrpt-keep">
  <table class="mrpt-table mrpt-bs-table">
    <thead><tr><th style="width:42%">Assets</th><th class="num" style="width:18%">Amount (₹)</th><th style="width:24%">Liabilities</th><th class="num" style="width:16%">Amount (₹)</th></tr></thead>
    <tbody>
      <tr>
        <td>Cash in Hand</td><td class="num">${fmtNum(a.cash || 0)}</td>
        <td>Capital Account</td><td class="num">${fmtNum(l.capital || c.businessIncome)}</td>
      </tr>
      <tr>
        <td>Bank Balance</td><td class="num">${fmtNum(bankBal)}</td>
        <td>Provision for Tax</td><td class="num">${fmtNum(l.provtax || (c.taxDue > 0 ? c.taxDue : 0))}</td>
      </tr>
      <tr>
        <td>Stock-in-Trade</td><td class="num">${fmtNum(a.stock || Math.round(turnover * 0.15))}</td>
        <td>Creditors</td><td class="num">${fmtNum(l.creditors || Math.round(turnover * 0.10))}</td>
      </tr>
      <tr>
        <td>Debtors</td><td class="num">${fmtNum(a.debtors || Math.round(turnover * 0.20))}</td>
        <td>Loan / Borrowings</td><td class="num">${fmtNum(l.loan || 0)}</td>
      </tr>
      <tr>
        <td>Fixed Assets</td><td class="num">${fmtNum(a.fixed || 0)}</td>
        <td>Net Profit</td><td class="num">${fmtNum(l.netprofit || c.businessIncome)}</td>
      </tr>
      <tr style="background:#f0f4ff;">
        <td><b>Total Assets</b></td><td class="num"><b>₹ ${fmtNum(totalA)}</b></td>
        <td><b>Total Liabilities</b></td><td class="num"><b>₹ ${fmtNum(totalL)}</b></td>
      </tr>
    </tbody>
  </table>
  </div>`;
  })()}

  <!-- TDS TABLE -->
  <div class="mrpt-section-header"><span class="icon">📋</span> TDS Deducted at Source — Form 26AS</div>
  <div class="mrpt-keep">
  <table class="mrpt-table">
    <thead>
      <tr>
        <th>Section</th>
        <th>Nature of Payment</th>
        <th>Deductor Name</th>
        <th>TAN</th>
        <th>Date</th>
        <th class="num">Amount Paid (₹)</th>
        <th class="num">TDS (₹)</th>
      </tr>
    </thead>
    <tbody>
      ${(tds.entries||[]).map(e => `
      <tr>
        <td><span class="sec-badge">${e.section}</span></td>
        <td>${_sectionName(e.section)}</td>
        <td style="font-size:8pt">${(e.deductorName || '').toUpperCase()}</td>
        <td style="font-family:monospace;font-size:7.5pt">${e.deductorTAN||'—'}</td>
        <td>${e.dateOfCredit}</td>
        <td class="num">${fmtNum(e.amountPaid)}</td>
        <td class="num"><b>${fmtNum(e.tdsClaimed)}</b></td>
      </tr>`).join('')}
      <tr class="foot">
        <td colspan="5"><b>TOTAL TDS CREDIT u/s 199</b></td>
        <td class="num">—</td>
        <td class="num"><b>₹ ${fmtNum(tds.totalTDS)}</b></td>
      </tr>
    </tbody>
  </table>
  </div>

  <!-- BANK ACCOUNTS -->
  <div class="mrpt-section-header"><span class="icon">🏦</span> Bank Account Details &amp; Interest Distribution</div>
  <div class="mrpt-bank-grid mrpt-keep">
    ${(banks||[]).map((b, i) => {
      const interest = (bankInterest||[]).find(bi => bi.accountNo === b.accountNo)?.interest || 0;
      return `
      <div class="mrpt-bank-card">
        <div class="mrpt-bank-name">
          ${(b.name||'').toUpperCase()}
          ${b.primary ? '<span class="mrpt-primary-chip">✓ Primary / Refund A/C</span>' : ''}
        </div>
        <div class="mrpt-bank-row"><span>Account Number</span><span>${b.accountNo||'—'}</span></div>
        <div class="mrpt-bank-row"><span>IFSC Code</span><span>${(b.ifsc||'').toUpperCase()}</span></div>
        <div class="mrpt-bank-row"><span>Account Type</span><span>${b.type==='SB'?'Savings':b.type==='CA'?'Current':b.type||'Savings'}</span></div>
        <div class="mrpt-bank-row" style="color:#4f46e5"><span>Interest Credited</span><span style="font-weight:700">₹ ${fmtNum(interest)}</span></div>
      </div>`;
    }).join('')}
  </div>

  ${hasSTCG ? `
  <!-- CAPITAL GAIN -->
  <div class="mrpt-section-header"><span class="icon">📈</span> Short Term Capital Gain — Section 111A</div>
  <div class="mrpt-keep">
  <table class="mrpt-table">
    <thead>
      <tr><th>Scrip / Asset</th><th>Purchase Date</th><th>Sale Date</th><th class="num">Cost (₹)</th><th class="num">Sale Price (₹)</th><th class="num">Net Gain (₹)</th></tr>
    </thead>
    <tbody>
      ${(stcgDetails||[]).map(s => `
      <tr>
        <td>${s.scrip}</td><td>${s.buyDate}</td><td>${s.sellDate}</td>
        <td class="num">${fmtNum(s.cost)}</td>
        <td class="num">${fmtNum(s.sale)}</td>
        <td class="num"><b>${fmtNum(s.gain)}</b></td>
      </tr>`).join('')}
      <tr class="foot">
        <td colspan="5"><b>Total Short Term Capital Gain</b></td>
        <td class="num"><b>₹ ${fmtNum(c.stcg)}</b></td>
      </tr>
    </tbody>
  </table>
  </div>` : ''}

  <!-- SIGNATURE -->
  <div class="mrpt-sign-area mrpt-keep" style="margin-top:24px; justify-content:flex-end;">
    <div class="mrpt-sign-block">
      <div class="mrpt-sign-line"></div>
      <div class="mrpt-sign-name">${(client.name||'').toUpperCase()}</div>
      <div class="mrpt-sign-sub">Assessee &nbsp;|&nbsp; PAN: ${(client.pan||'').toUpperCase()}</div>
      <div class="mrpt-sign-sub" style="margin-top:3px">Date: _____________</div>
    </div>
  </div>

</div><!-- /.mrpt-body -->

<!-- FOOTER BAR -->
<div class="mrpt-footer-bar">
  <span>${company} &nbsp;•&nbsp; ${footer}</span>
  <span>${cmpNo} &nbsp;|&nbsp; AY ${client.ay||''} &nbsp;|&nbsp; ${today}</span>
</div>

</div><!-- /.mrpt -->
`;
  }

  // ── Helpers ──────────────────────────────────────────────────

  function _infoCell(lbl, val) {
    return `<div class="mrpt-info-cell">
      <div class="mrpt-info-lbl">${lbl}</div>
      <div class="mrpt-info-val">${val || '—'}</div>
    </div>`;
  }

  function _slabRows(income, cfg, fmtNum) {
    if (!income || income <= 0) return `<div class="mrpt-tax-step" style="--dot:#94a3b8">
      <span class="mrpt-tax-lbl">Income below basic exemption — Nil</span>
      <span class="mrpt-tax-amt">₹ 0</span></div>`;
    const lines = TaxEngine.getSlabLines(income, cfg);
    return lines.map(l => `
      <div class="mrpt-tax-step" style="--dot:#94a3b8">
        <span class="mrpt-tax-lbl">${l.label}</span>
        <span class="mrpt-tax-amt">${l.tax > 0 ? '₹ '+fmtNum(l.tax) : 'Nil'}</span>
      </div>`).join('');
  }

  function _sectionName(s) {
    const m = {
      '194C': 'Contractor / Courier',
      '194H': 'Commission / Brokerage',
      '194J': 'Professional / Technical Services',
      '194N': 'Cash Withdrawal',
    };
    return m[s] || s;
  }

  function _formatDate(dob) {
    if (!dob) return '—';
    const d = new Date(dob);
    if (isNaN(d)) return dob;
    return `${String(d.getDate()).padStart(2,'0')}/${String(d.getMonth()+1).padStart(2,'0')}/${d.getFullYear()}`;
  }

  function _getFY(ay) {
    if (!ay) return '';
    const parts = ay.split('-');
    return `${parseInt(parts[0])-1}-${parts[1] ? parseInt(parts[1])-1 : ''}`;
  }

  function _getFilingDateObj(client) {
    if (client && client.filingDate) {
      if (typeof client.filingDate === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(client.filingDate)) {
        const [y, m, d] = client.filingDate.split('-').map(Number);
        return new Date(y, m - 1, d);
      }
      const d = new Date(client.filingDate);
      if (!isNaN(d.getTime())) return d;
    }
    if (client && client.createdAt) {
      const d = new Date(client.createdAt);
      if (!isNaN(d.getTime())) return d;
    }
    return new Date();
  }

  return { generate };
})();
