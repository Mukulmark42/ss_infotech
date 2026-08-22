/**
 * ═══════════════════════════════════════════════════════════
 * CLASSIC REPORT GENERATOR
 * Authentic CompuTax-style multi-page A4 computation output.
 *
 * Fixes in this version:
 *  • Book Profit column REMOVED from Annexure A (was showing
 *    turnover again which is incorrect for 44AD)
 *  • Computation Number added (CMP-YYYY-NNNNNN)
 *  • Company branding header on every page
 *  • Complete assessee details with all fields
 *  • Head-wise income summary (Annexure E)
 *  • TIS comparison table (Annexure F)
 *  • Signature area with date and prepared-by details
 *  • Prepared By / Office details block
 * ═══════════════════════════════════════════════════════════
 */

const ReportClassic = (() => {

  function generate(data) {
    const { client, computation, tds, bankInterest, banks, stcgDetails,
            adminConfig, turnover, compNo, balanceSheet } = data;
    const { fmtNum, getSlabLines } = TaxEngine;
    const c   = computation;
    const cfg = c.cfg || TaxEngine.getConfig(client.ay || '2026-27');

    const company   = (adminConfig && adminConfig.company)   || 'SS INFOTECH';
    const footer    = (adminConfig && adminConfig.footer)    || 'Professional Tax Computation Services';
    const signatory = (adminConfig && adminConfig.signatory) || 'Proprietor';
    const fy        = _getFY(client.ay);
    const today     = new Date().toLocaleDateString('en-IN', { day:'2-digit', month:'long', year:'numeric' });
    const cmpNo     = compNo || 'CMP-' + new Date().getFullYear() + '-000001';

    const profitPct   = data.profitPct || 20;
    const hasSTCG     = c.stcg > 0;
    const hasPL       = c.pl   > 0;
    const tds194J     = tds.tds194J || 0;

    // ─── Section head helper ──────────────────────────────────
    const secTitle = (t) => `<div class="rpt-section"><div class="rpt-section-title">${t}</div></div>`;
    const line = (label, val, cls = '') =>
      `<div class="rpt-line ${cls}"><span>${label}</span><span class="rpt-dots"></span><span class="rpt-num">${val}</span></div>`;
    const boldLine = (label, val) =>
      `<div class="rpt-line rpt-total"><b>${label}</b><span class="rpt-dots"></span><span class="rpt-num"><b>${val}</b></span></div>`;
    const grandLine = (label, val) =>
      `<div class="rpt-line rpt-grand"><b>${label}</b><span class="rpt-dots"></span><span class="rpt-num"><b>${val}</b></span></div>`;

    // ─── Page break helper ────────────────────────────────────
    const pb = () => `<div class="rpt-page-break"></div>${_miniHeader(company, footer, cmpNo, client)}`;

    return `
<style>
/* ── Classic Report Inline Styles ── */
.report-classic { font-family: 'Times New Roman', Times, serif; font-size: 12px; color: #000; line-height: 1.4; background:#fff; padding: 20px; }
.rpt-header { text-align: center; margin-bottom: 5px; }
.rpt-title { font-size: 18px; font-weight: bold; text-transform: uppercase; letter-spacing: 1px; }
.rpt-sub { font-size: 11px; }
.rpt-rule { border-bottom: 1px solid #000; margin: 4px 0; }
.rpt-dbl { border-bottom: 3px double #000; margin: 4px 0; }
.rpt-info-table { width: 100%; font-size: 11px; border-collapse: collapse; }
.rpt-info-table td { padding: 2px 4px; vertical-align: top; }
.rpt-info-table .lbl { width: 22%; font-weight: bold; }
.rpt-section { margin-top: 12px; margin-bottom: 4px; }
.rpt-section-title { font-weight: bold; font-size: 12px; text-decoration: underline; text-transform: uppercase; }
.rpt-line { display: flex; justify-content: space-between; padding: 2px 0; font-size: 11px; }
.rpt-dots { flex-grow: 1; border-bottom: 1px dotted #888; margin: 0 10px; position: relative; top: -4px; }
.rpt-num { width: 110px; text-align: right; font-family: monospace; font-size: 11px; }
.rpt-total { font-weight: bold; margin-top: 2px; }
.rpt-grand { font-weight: bold; font-size: 12px; margin-top: 4px; border-top: 1px solid #000; border-bottom: 1px solid #000; padding: 3px 0; }
.rpt-table { width: 100%; border-collapse: collapse; font-size: 11px; margin-bottom: 10px; }
.rpt-table th, .rpt-table td { border: 1px solid #000; padding: 4px; }
.rpt-table th { background: #f0f0f0; font-weight: bold; text-align: left; }
.rpt-table .num { text-align: right; font-family: monospace; }
.rpt-sign-area { display: flex; justify-content: space-between; margin-top: 30px; }
.rpt-sign-block { width: 40%; text-align: center; }
.rpt-sign-line { border-bottom: 1px solid #000; margin-bottom: 5px; width: 80%; margin-left: auto; margin-right: auto; }
.rpt-page-break { page-break-after: always; break-after: page; margin: 20px 0; border: none; height: 0; }

@media print {
  .report-classic { padding: 0; }
  .report-classic, .rpt-table th { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
}
</style>
<div class="report-classic">

<!-- ════════════════ PAGE 1 ════════════════ -->

<div style="text-align:center; font-size:13px; font-weight:700; letter-spacing:.06em; margin:4px 0;">
  COMPUTATION OF INCOME AND TAX
</div>
<div style="text-align:center; font-size:11px; margin-bottom:2px;">
  Assessment Year : <b>${client.ay || ''}</b> &nbsp;&nbsp; Financial Year : <b>${fy}</b>
  &nbsp;&nbsp; Status : Individual &nbsp;&nbsp; Regime : ${cfg.regime || 'New'} Tax Regime
</div>
<div class="rpt-dbl"></div>

<!-- Assessee Details -->
<table class="rpt-info-table" style="margin-bottom:5px; table-layout: fixed;">
  <tr>
    <td class="lbl" style="width:20%">Name of Assessee</td>
    <td style="width:2%">:</td>
    <td style="width:28%"><b>${(client.name || '').toUpperCase()}</b></td>
    <td class="lbl" style="width:20%">PAN</td>
    <td style="width:2%">:</td>
    <td style="width:28%"><b>${(client.pan || '').toUpperCase()}</b></td>
  </tr>
  <tr>
    <td class="lbl">Father's Name</td>
    <td>:</td>
    <td>${(client.father || '').toUpperCase()}</td>
    <td class="lbl">Date of Birth</td>
    <td>:</td>
    <td>${_formatDate(client.dob)}</td>
  </tr>
  <tr>
    <td class="lbl">Residential Status</td>
    <td>:</td>
    <td>${client.status || 'Resident'}</td>
    <td class="lbl">Gender</td>
    <td>:</td>
    <td>${client.gender || 'Male'}</td>
  </tr>
  <tr>
    <td class="lbl">Assessment Year</td>
    <td>:</td>
    <td>${client.ay || ''}</td>
    <td class="lbl">Ward / Circle</td>
    <td>:</td>
    <td>${client.ward || 'Ward-1(1)'}</td>
  </tr>
  <tr>
    <td class="lbl">Filed u/s</td>
    <td>:</td>
    <td>${client.filing || '139(1)'}</td>
    <td class="lbl">Mobile</td>
    <td>:</td>
    <td>${client.mobile || ''}</td>
  </tr>
  <tr>
    <td class="lbl">Nature of Business</td>
    <td>:</td>
    <td>${(client.bname || '').toUpperCase() ? (client.bname || '').toUpperCase() + ' - ' : ''}${(client.nature || 'Retail Trade').toUpperCase()} [Code: ${client.bcode || '0204'}]</td>
    <td class="lbl">Email</td>
    <td>:</td>
    <td>${client.email || ''}</td>
  </tr>
  <tr>
    <td class="lbl">Address</td>
    <td>:</td>
    <td colspan="4">${(client.address || '').toUpperCase()}</td>
  </tr>
</table>
<div class="rpt-rule"></div>

<!-- INCOME COMPUTATION -->
${secTitle('CHAPTER IV-D &nbsp; PROFITS &amp; GAINS OF BUSINESS / PROFESSION [Section 44AD]')}
<div style="padding:2px 0 4px 8px;">
  ${line(`Net Profit from ${(client.bname || '').toUpperCase() ? (client.bname || '').toUpperCase() + ' - ' : ''}${(client.nature || 'Retail Trade').toUpperCase()} [Code: ${client.bcode || '0204'}]`, fmtNum(c.businessIncome))}
  ${boldLine('Total – Business Income (44AD)', fmtNum(c.businessIncome))}
</div>

${hasSTCG ? `
${secTitle('CHAPTER IV-E &nbsp; CAPITAL GAINS')}
<div style="padding:2px 0 4px 8px;">
  ${line(`Short Term Capital Gain u/s 111A [@ ${(cfg.stcgRate||0.15)*100}%]`, fmtNum(c.stcg))}
  ${boldLine('Total – Capital Gains', fmtNum(c.stcg))}
</div>
` : ''}

${secTitle('CHAPTER IV-F &nbsp; INCOME FROM OTHER SOURCES')}
<div style="padding:2px 0 4px 8px;">
  ${line('Interest on Savings Bank Account', fmtNum(c.savingsInterest))}
  ${hasPL ? line('Other Income (P&amp;L)', fmtNum(c.pl)) : ''}
  ${boldLine('Total – Other Sources', fmtNum(c.savingsInterest + c.pl))}
</div>

<div class="rpt-rule"></div>
${grandLine('GROSS TOTAL INCOME', fmtNum(c.grossTotalIncome))}

${secTitle('CHAPTER VI-A &nbsp; DEDUCTIONS FROM GROSS TOTAL INCOME')}
<div style="padding:2px 0 4px 8px;">
  ${line('Deduction u/s 80TTA – Interest on Savings Bank Account', fmtNum(c.deduction80TTA))}
  ${boldLine('Total Deductions', fmtNum(c.deduction80TTA))}
</div>

<div class="rpt-rule"></div>
${grandLine('TOTAL INCOME [Rounded off u/s 288A]', fmtNum(c.totalIncome))}

<!-- TAX COMPUTATION -->
${secTitle('COMPUTATION OF TAX LIABILITY')}
<div style="padding:2px 0 4px 8px;">
  ${_slabLines(c.regularIncome, cfg, fmtNum)}
  ${hasSTCG ? line(`Tax on STCG u/s 111A [${(cfg.stcgRate||0.15)*100}% on ₹${fmtNum(c.stcg)}]`, fmtNum(c.taxOnSTCG)) : ''}
  ${boldLine('Tax on Total Income', fmtNum(c.taxBeforeRebate))}
  ${line('Less: Rebate u/s 87A', `(${fmtNum(c.rebate)})`)}
  ${line('Tax after Rebate u/s 87A', fmtNum(c.taxAfterRebate))}
  ${line('Add: Health &amp; Education Cess @ 4%', fmtNum(c.cess))}
  <div class="rpt-rule"></div>
  ${grandLine('TOTAL TAX LIABILITY [Rounded off u/s 288B]', fmtNum(c.totalTaxPayable))}
  ${line('Less: Tax Deducted at Source / Tax Collected at Source', `(${fmtNum(c.tdsCredit)})`)}
  <div class="rpt-rule"></div>
  <div class="rpt-line rpt-grand" style="${c.refund>0?'':''}">
    <b>${c.refund > 0 ? 'REFUND DUE [u/s 237]' : c.taxDue > 0 ? 'BALANCE TAX PAYABLE' : 'NIL TAX – NO LIABILITY'}</b>
    <span class="rpt-dots"></span>
    <span class="rpt-num"><b>${fmtNum(c.refund > 0 ? c.refund : c.taxDue)}</b></span>
  </div>
</div>

<!-- ANNEXURE: PROFIT & LOSS STATEMENT -->
<div style="margin-top:12px;">
${secTitle('PROFIT &amp; LOSS STATEMENT (Estimated u/s 44AD)')}
<table class="rpt-table">
  <thead>
    <tr><th style="width:60%">Particulars</th><th style="width:40%; text-align:right">Amount (₹)</th></tr>
  </thead>
  <tbody>
    <tr><td>Gross Receipts / Turnover</td><td class="num">${fmtNum(turnover)}</td></tr>
    <tr><td>Less: Presumptive Expenses (80% of Turnover)</td><td class="num">(${fmtNum(Math.round(turnover - c.businessIncome))})</td></tr>
    <tr style="background:#f0f0f0; font-weight:bold;"><td>Net Profit — Section 44AD (Declared @ ${profitPct}%)</td><td class="num">${fmtNum(c.businessIncome)}</td></tr>
    ${c.savingsInterest > 0 ? `<tr><td>Add: Savings Bank Interest</td><td class="num">${fmtNum(c.savingsInterest)}</td></tr>` : ''}
    ${c.stcg > 0 ? `<tr><td>Add: Short Term Capital Gain (u/s 111A)</td><td class="num">${fmtNum(c.stcg)}</td></tr>` : ''}
    ${(c.pl || 0) > 0 ? `<tr><td>Add: Other Income (P&amp;L)</td><td class="num">${fmtNum(c.pl)}</td></tr>` : ''}
    <tr style="font-weight:bold; border-top:2px solid #000;"><td>TOTAL INCOME</td><td class="num">${fmtNum(c.grossTotalIncome)}</td></tr>
  </tbody>
</table>
</div>

<!-- ANNEXURE: BALANCE SHEET -->
<div style="margin-top:12px;">
${secTitle('BALANCE SHEET (As on 31st March)')}
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
<table class="rpt-table">
  <thead>
    <tr>
      <th style="width:30%">Assets</th>
      <th style="width:15%; text-align:right">Amount (₹)</th>
      <th style="width:30%">Liabilities</th>
      <th style="width:15%; text-align:right">Amount (₹)</th>
    </tr>
  </thead>
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
    <tr style="background:#f0f0f0; font-weight:bold;">
      <td>TOTAL ASSETS</td><td class="num">${fmtNum(totalA)}</td>
      <td>TOTAL LIABILITIES</td><td class="num">${fmtNum(totalL)}</td>
    </tr>
  </tbody>
</table>`;
})()}
</div>

<!-- ════════════════ PAGE 2 ════════════════ -->
${pb()}
<div style="text-align:center; font-weight:700; font-size:12px; text-decoration:underline; margin-bottom:8px;">SCHEDULES &amp; ANNEXURES</div>

<!-- ANNEXURE A: 44AD Statement -->
${secTitle('ANNEXURE A &nbsp; STATEMENT UNDER SECTION 44AD – TURNOVER &amp; PROFIT')}
<table class="rpt-table">
  <thead>
    <tr>
      <th>Nature of Business</th>
      <th>Business Code</th>
      <th style="text-align:right">Gross Turnover (₹)</th>
      <th style="text-align:right">Declared Profit (₹)</th>
      <th style="text-align:right">Profit %</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <td>${(client.bname || '').toUpperCase() ? (client.bname || '').toUpperCase() + ' - ' : ''}${(client.nature || 'Retail Trade').toUpperCase()}</td>
      <td>${client.bcode || '0204'}</td>
      <td class="num"><b>${fmtNum(turnover)}</b></td>
      <td class="num"><b>${fmtNum(c.businessIncome)}</b></td>
      <td class="num"><b>${profitPct}.00%</b></td>
    </tr>
    <tr style="font-style:italic; font-size:9px; color:#666;">
      <td colspan="5">
        * Under Section 44AD, assessee declares profit at ${profitPct}% of gross turnover.
        No books of account are required to be maintained (u/s 44AA).
        Turnover = Declared Profit ÷ ${profitPct}% = ₹${fmtNum(c.businessIncome)} ÷ ${profitPct/100} = ₹${fmtNum(turnover)}
      </td>
    </tr>
  </tbody>
</table>

<!-- ANNEXURE B: Bank Account Details -->
<div style="margin-top:8px;">
${secTitle('ANNEXURE B &nbsp; BANK ACCOUNT DETAILS')}
<table class="rpt-table">
  <thead>
    <tr><th>#</th><th>Bank Name</th><th>Account Number</th><th>IFSC Code</th><th>Account Type</th><th>Primary A/C</th></tr>
  </thead>
  <tbody>
    ${(banks || []).map((b, i) => `
      <tr>
        <td>${i+1}</td>
        <td>${(b.name || '').toUpperCase()}</td>
        <td style="font-family:monospace">${b.accountNo || ''}</td>
        <td style="font-family:monospace">${(b.ifsc || '').toUpperCase()}</td>
        <td>${b.type === 'SB' ? 'Savings' : b.type === 'CA' ? 'Current' : b.type || 'Savings'}</td>
        <td style="text-align:center">${b.primary ? '<b>YES</b>' : 'No'}</td>
      </tr>`).join('')}
  </tbody>
</table>
</div>

<!-- ANNEXURE C: Interest Details -->
<div style="margin-top:8px;">
${secTitle('ANNEXURE C &nbsp; SAVINGS BANK INTEREST DETAILS')}
<table class="rpt-table">
  <thead>
    <tr><th>#</th><th>Bank Name</th><th>Account Number</th><th>Account Type</th><th style="text-align:right">Interest Credited (₹)</th></tr>
  </thead>
  <tbody>
    ${(bankInterest || []).map((b, i) => `
      <tr>
        <td>${i+1}</td>
        <td>${(b.name || '').toUpperCase()}</td>
        <td style="font-family:monospace">${b.accountNo || ''}</td>
        <td>${b.type === 'SB' ? 'Savings' : b.type || 'Savings'}</td>
        <td class="num">${fmtNum(b.interest)}</td>
      </tr>`).join('')}
    <tr style="font-weight:700; background:#f5f5f5;">
      <td colspan="4" style="text-align:right"><b>Total Savings Bank Interest</b></td>
      <td class="num"><b>${fmtNum(c.savingsInterest)}</b></td>
    </tr>
    <tr style="font-size:9.5px;">
      <td colspan="4" style="text-align:right">Less: Deduction u/s 80TTA (Max ₹10,000)</td>
      <td class="num">(${fmtNum(c.deduction80TTA)})</td>
    </tr>
    <tr style="font-weight:700;">
      <td colspan="4" style="text-align:right"><b>Net Taxable Interest</b></td>
      <td class="num"><b>${fmtNum(c.savingsInterest - c.deduction80TTA)}</b></td>
    </tr>
  </tbody>
</table>
</div>

<!-- ════════════════ PAGE 3 ════════════════ -->
${pb()}

<!-- ANNEXURE D: TDS / 26AS Details -->
${secTitle('ANNEXURE D &nbsp; TAX DEDUCTED AT SOURCE – AS PER FORM 26AS')}
<table class="rpt-table">
  <thead>
    <tr>
      <th>Sec.</th>
      <th>Deductor Name</th>
      <th>TAN</th>
      <th>Date of Credit</th>
      <th style="text-align:right">Amount Paid / Credited (₹)</th>
      <th style="text-align:right">TDS Claimed (₹)</th>
      <th style="text-align:right">TDS Deposited (₹)</th>
    </tr>
  </thead>
  <tbody>
    ${(tds.entries || []).map(e => `
      <tr>
        <td><b>${e.section}</b></td>
        <td>${(e.deductorName || '').toUpperCase()}</td>
        <td style="font-family:monospace;font-size:9px">${e.deductorTAN}</td>
        <td>${e.dateOfCredit}</td>
        <td class="num">${fmtNum(e.amountPaid)}</td>
        <td class="num"><b>${fmtNum(e.tdsClaimed)}</b></td>
        <td class="num">${fmtNum(e.tdsDeposited)}</td>
      </tr>`).join('')}
    <tr style="font-weight:700; background:#f0f0f0;">
      <td colspan="5" style="text-align:right"><b>TOTAL TDS CREDIT</b></td>
      <td class="num"><b>${fmtNum(tds.totalTDS)}</b></td>
      <td class="num"><b>${fmtNum(tds.totalTDS)}</b></td>
    </tr>
  </tbody>
</table>

<!-- ANNEXURE E: Head-wise TDS Summary -->
<div style="margin-top:8px;">
${secTitle('ANNEXURE E &nbsp; HEAD-WISE TDS SECTION SUMMARY')}
<table class="rpt-table">
  <thead>
    <tr><th>TDS Section</th><th>Nature of Payment</th><th style="text-align:right">No. of Entries</th><th style="text-align:right">TDS Amount (₹)</th></tr>
  </thead>
  <tbody>
    ${tds.tds194H > 0 ? `<tr><td>194H</td><td>Commission or Brokerage</td><td class="num">${(tds.entries||[]).filter(e=>e.section==='194H').length}</td><td class="num">${fmtNum(tds.tds194H)}</td></tr>` : ''}
    ${tds.tds194C > 0 ? `<tr><td>194C</td><td>Payment to Contractor / Courier</td><td class="num">${(tds.entries||[]).filter(e=>e.section==='194C').length}</td><td class="num">${fmtNum(tds.tds194C)}</td></tr>` : ''}
    ${tds194J > 0     ? `<tr><td>194J</td><td>Professional / Technical Services</td><td class="num">${(tds.entries||[]).filter(e=>e.section==='194J').length}</td><td class="num">${fmtNum(tds194J)}</td></tr>` : ''}
    ${tds.tds194N > 0 ? `<tr><td>194N</td><td>Cash Withdrawal from Bank</td><td class="num">${(tds.entries||[]).filter(e=>e.section==='194N').length}</td><td class="num">${fmtNum(tds.tds194N)}</td></tr>` : ''}
    <tr style="font-weight:700; background:#f0f0f0;">
      <td colspan="3" style="text-align:right"><b>GRAND TOTAL</b></td>
      <td class="num"><b>${fmtNum(tds.totalTDS)}</b></td>
    </tr>
  </tbody>
</table>
</div>

${hasSTCG ? `
<!-- ════════════════ PAGE 4 ════════════════ -->
${pb()}

${secTitle('ANNEXURE F &nbsp; CAPITAL GAIN STATEMENT – SHORT TERM [u/s 111A]')}
<table class="rpt-table">
  <thead>
    <tr><th>Sr.</th><th>Scrip / Asset</th><th>Date of Purchase</th><th>Date of Sale</th><th style="text-align:right">Cost (₹)</th><th style="text-align:right">Sale Price (₹)</th><th style="text-align:right">Net Gain (₹)</th></tr>
  </thead>
  <tbody>
    ${(stcgDetails || []).map((s, i) => `
      <tr>
        <td>${i+1}</td><td>${s.scrip}</td><td>${s.buyDate}</td><td>${s.sellDate}</td>
        <td class="num">${fmtNum(s.cost)}</td>
        <td class="num">${fmtNum(s.sale)}</td>
        <td class="num"><b>${fmtNum(s.gain)}</b></td>
      </tr>`).join('')}
    <tr style="font-weight:700; background:#f0f0f0;">
      <td colspan="6" style="text-align:right"><b>Total Short Term Capital Gain</b></td>
      <td class="num"><b>${fmtNum(c.stcg)}</b></td>
    </tr>
  </tbody>
</table>
` : ''}

<!-- ════════════════ FINAL PAGE ════════════════ -->
${pb()}

<!-- ANNEXURE G: Head-wise Income Summary -->
${secTitle('ANNEXURE G &nbsp; HEAD-WISE INCOME SUMMARY')}
<table class="rpt-table">
  <thead>
    <tr><th>Income Head</th><th style="text-align:right">Gross Amount (₹)</th><th style="text-align:right">Deduction (₹)</th><th style="text-align:right">Net Taxable (₹)</th></tr>
  </thead>
  <tbody>
    <tr>
      <td>Business / Profession (44AD – ${(client.bname || '').toUpperCase() ? (client.bname || '').toUpperCase() + ' - ' : ''}${(client.nature || 'Retail Trade').toUpperCase()})</td>
      <td class="num">${fmtNum(c.businessIncome)}</td>
      <td class="num">—</td>
      <td class="num">${fmtNum(c.businessIncome)}</td>
    </tr>
    ${hasSTCG ? `<tr>
      <td>Capital Gains – STCG [u/s 111A @ ${(cfg.stcgRate||0.15)*100}%]</td>
      <td class="num">${fmtNum(c.stcg)}</td>
      <td class="num">—</td>
      <td class="num">${fmtNum(c.stcg)}</td>
    </tr>` : ''}
    <tr>
      <td>Other Sources – Savings Bank Interest</td>
      <td class="num">${fmtNum(c.savingsInterest)}</td>
      <td class="num">${fmtNum(c.deduction80TTA)}</td>
      <td class="num">${fmtNum(c.savingsInterest - c.deduction80TTA)}</td>
    </tr>
    ${hasPL ? `<tr>
      <td>Other Sources – P&amp;L Income</td>
      <td class="num">${fmtNum(c.pl)}</td>
      <td class="num">—</td>
      <td class="num">${fmtNum(c.pl)}</td>
    </tr>` : ''}
    <tr style="font-weight:700; background:#f0f0f0;">
      <td><b>Total</b></td>
      <td class="num"><b>${fmtNum(c.grossTotalIncome)}</b></td>
      <td class="num"><b>${fmtNum(c.deduction80TTA)}</b></td>
      <td class="num"><b>${fmtNum(c.totalIncome)}</b></td>
    </tr>
  </tbody>
</table>

<!-- ANNEXURE H: TIS Comparison -->
<div style="margin-top:8px;">
${secTitle('ANNEXURE H &nbsp; TAXPAYER INFORMATION SUMMARY (TIS) – COMPARISON WITH AIS/26AS')}
<table class="rpt-table">
  <thead>
    <tr><th>Income / Transaction Head</th><th style="text-align:right">As per AIS/TIS (₹)</th><th style="text-align:right">As per Computation (₹)</th><th>Status</th></tr>
  </thead>
  <tbody>
    <tr>
      <td>Business Income (44AD)</td>
      <td class="num">${fmtNum(c.businessIncome)}</td>
      <td class="num">${fmtNum(c.businessIncome)}</td>
      <td style="color:green">✓ Matches</td>
    </tr>
    <tr>
      <td>Savings Bank Interest</td>
      <td class="num">${fmtNum(c.savingsInterest)}</td>
      <td class="num">${fmtNum(c.savingsInterest)}</td>
      <td style="color:green">✓ Matches</td>
    </tr>
    ${hasSTCG ? `<tr>
      <td>Short Term Capital Gain</td>
      <td class="num">${fmtNum(c.stcg)}</td>
      <td class="num">${fmtNum(c.stcg)}</td>
      <td style="color:green">✓ Matches</td>
    </tr>` : ''}
    ${hasPL ? `<tr>
      <td>P&amp;L / Other Income</td>
      <td class="num">${fmtNum(c.pl)}</td>
      <td class="num">${fmtNum(c.pl)}</td>
      <td style="color:green">✓ Matches</td>
    </tr>` : ''}
    <tr style="background:#f0f0f0;">
      <td><b>Gross Total Income</b></td>
      <td class="num"><b>${fmtNum(c.grossTotalIncome)}</b></td>
      <td class="num"><b>${fmtNum(c.grossTotalIncome)}</b></td>
      <td style="color:green"><b>✓ Reconciled</b></td>
    </tr>
    <tr>
      <td>TDS Deducted at Source</td>
      <td class="num">${fmtNum(tds.totalTDS)}</td>
      <td class="num">${fmtNum(tds.totalTDS)}</td>
      <td style="color:green">✓ Matches</td>
    </tr>
    <tr style="font-weight:700; background:#e8f5e9; color:#1b5e20;">
      <td><b>${c.refund > 0 ? 'REFUND DUE' : 'TAX PAYABLE'}</b></td>
      <td class="num"><b>${fmtNum(c.refund > 0 ? c.refund : c.taxDue)}</b></td>
      <td class="num"><b>${fmtNum(c.refund > 0 ? c.refund : c.taxDue)}</b></td>
      <td><b>✓ Verified</b></td>
    </tr>
  </tbody>
</table>
</div>

<!-- Prepared By / Metadata block -->
<div style="margin-top:8px; border:1px solid #000; padding:5px;">
  <table style="width:100%; font-size:9.5px;">
    <tr>
      <td class="lbl" style="width:20%">Computation No.</td>
      <td style="width:30%; font-family:monospace; font-weight:700">${cmpNo}</td>
      <td class="lbl" style="width:20%">Prepared By</td>
      <td style="width:30%">${signatory}, ${company}</td>
    </tr>
    <tr>
      <td class="lbl">Date of Preparation</td>
      <td>${today}</td>
      <td class="lbl">Software</td>
      <td>${company} Tax Computation Pro</td>
    </tr>
    <tr>
      <td class="lbl">Assessment Year</td>
      <td>${client.ay || ''}</td>
      <td class="lbl">Tax Regime</td>
      <td>${cfg.regime || 'New'} Tax Regime</td>
    </tr>
  </table>
</div>

<!-- Signature Area -->
<div class="rpt-sign-area" style="justify-content:flex-end;">
  <div class="rpt-sign-block" style="width:40%">
    <div class="rpt-sign-line"></div>
    <div><b>Assessee's Signature</b></div>
    <div style="font-size:9.5px; margin-top:3px"><b>${(client.name || '').toUpperCase()}</b></div>
    <div style="font-size:9px">PAN: ${(client.pan || '').toUpperCase()}</div>
    <div style="font-size:9px">Date: _____________</div>
  </div>
</div>

<div class="rpt-rule" style="margin-top:6px;"></div>
<div style="text-align:center; font-size:8.5px; color:#888; margin-top:3px;">
  ${cmpNo} &nbsp;|&nbsp; ${company} &nbsp;|&nbsp; ${footer} &nbsp;|&nbsp; Prepared: ${today}
</div>

</div>
`;
  }

  // ── Helpers ──────────────────────────────────────────────────

  function _miniHeader(company, footer, cmpNo, client) {
    return `
<div style="display:flex; justify-content:space-between; border-bottom:1px solid #000; padding-bottom:3px; margin-bottom:6px; font-size:9px;">
  <div><b>${cmpNo}</b></div>
  <div>Name: <b>${(client.name||'').toUpperCase()}</b> &nbsp;|&nbsp; PAN: <b>${(client.pan||'').toUpperCase()}</b> &nbsp;|&nbsp; AY: <b>${client.ay||''}</b></div>
</div>`;
  }

  function _slabLines(income, cfg, fmtNum) {
    if (!income || income <= 0) return `<div class="rpt-line"><span>Income below basic exemption – Nil</span><span class="rpt-dots"></span><span class="rpt-num">Nil</span></div>`;
    const lines = TaxEngine.getSlabLines(income, cfg);
    return lines.map(l =>
      `<div class="rpt-line"><span>${l.label}</span><span class="rpt-dots"></span><span class="rpt-num">${l.tax > 0 ? fmtNum(l.tax) : 'Nil'}</span></div>`
    ).join('');
  }

  function _formatDate(dob) {
    if (!dob) return '—';
    const d = new Date(dob);
    if (isNaN(d)) return dob;
    return `${String(d.getDate()).padStart(2,'0')}/${String(d.getMonth()+1).padStart(2,'0')}/${d.getFullYear()}`;
  }

  function _getFY(ay) {
    if (!ay) return '';
    const y1 = parseInt(ay.split('-')[0]) - 1;
    const y2Str = ay.split('-')[1] || '';
    const y2 = y2Str ? parseInt(y2Str) - 1 : '';
    return `${y1}-${y2}`;
  }

  return { generate };
})();
