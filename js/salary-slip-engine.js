/**
 * ═══════════════════════════════════════════════════════════
 * SALARY SLIP ENGINE – Classic Professional Payslip
 * Supports single & multi-month batch payslip generation
 * ═══════════════════════════════════════════════════════════
 */
const SalarySlipEngine = (() => {

  function fmt(n) {
    const v = parseFloat(n) || 0;
    return v.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }

  function _numToWords(n) {
    if (n === 0) return 'Zero';
    const ones = ['','One','Two','Three','Four','Five','Six','Seven','Eight','Nine','Ten','Eleven','Twelve','Thirteen','Fourteen','Fifteen','Sixteen','Seventeen','Eighteen','Nineteen'];
    const tens = ['','','Twenty','Thirty','Forty','Fifty','Sixty','Seventy','Eighty','Ninety'];
    let result = '';
    if (n >= 10000000) { result += _numToWords(Math.floor(n / 10000000)) + ' Crore '; n %= 10000000; }
    if (n >= 100000) { result += _numToWords(Math.floor(n / 100000)) + ' Lakh '; n %= 100000; }
    if (n >= 1000) { result += _numToWords(Math.floor(n / 1000)) + ' Thousand '; n %= 1000; }
    if (n >= 100) { result += ones[Math.floor(n / 100)] + ' Hundred '; n %= 100; }
    if (n >= 20) { result += tens[Math.floor(n / 10)]; n %= 10; if (n > 0) result += '-' + ones[n]; return result.trim(); }
    if (n > 0) result += ones[n];
    return result.trim();
  }

  function _esc(str) {
    const d = document.createElement('div');
    d.textContent = str || '';
    return d.innerHTML;
  }

  /**
   * Renders the HTML markup for a single payslip page
   */
  function renderSingleSlipPage(data) {
    const c = data.company || {};
    const e = data.employee || {};
    const att = data.attendance || {};
    const earnings = data.earnings || [];
    const deductions = data.deductions || { items: [], total: 0 };

    const totalEarn = earnings.reduce((s, r) => s + (parseFloat(r.salary) || 0), 0);
    const totalDed = deductions.total || 0;
    const netPay = totalEarn - totalDed;
    const monthYear = (data.month || 'April') + ' ' + (data.year || '2026');

    const logoText = (c.logoText || 'C').toUpperCase();
    const logoData = c.logoData || null;
    const compName = c.name || 'Company Name';
    const compAddr = c.address || '';
    const compPhone = c.phone || '';
    const compEmail = c.email || '';
    const compTagline = c.tagline || '';

    const netPayWhole = Math.floor(netPay);
    const netPayPaise = Math.round((netPay - netPayWhole) * 100);
    let netPayWords = 'Rupees ' + _numToWords(netPayWhole);
    if (netPayPaise > 0) netPayWords += ' and ' + _numToWords(netPayPaise) + ' Paise';
    netPayWords += ' Only';

    // Logo HTML
    let logoHtml;
    if (logoData) {
      logoHtml = `<div class="slip-logo"><img src="${logoData}" alt="Company Logo" /></div>`;
    } else {
      const colors = [
        ['#1a3c6e','#2a5298'],['#1a5632','#228b22'],['#8b1a1a','#b22222'],
        ['#6b4c00','#8b6914'],['#3b1a6e','#5b2d8e'],['#5a1a4e','#7b2d6e'],
        ['#1a3b6e','#2a5b9e'],['#6e1a4b','#8b2d6e'],
      ];
      const ci = (compName || '').charCodeAt(0) % colors.length;
      logoHtml = `<div class="slip-logo" style="background:${colors[ci][0]};color:#fff">${_esc(logoText)}</div>`;
    }

    // Employee details (all uppercase in print)
    const U = s => (s || '--').toUpperCase();
    const empLeft = [
      { label: 'Employee ID', value: U(e.id) },
      { label: 'Location', value: U(e.location) },
      { label: 'Date of Joining', value: U(e.doj) },
      { label: 'UAN', value: U(e.uan) },
      { label: 'ESIC No', value: U(e.esic) },
      { label: 'PAN No', value: U(e.pan) },
    ];
    const empRight = [
      { label: 'Employee Name', value: U(e.name) },
      { label: 'Division', value: U(e.division) },
      { label: 'Designation', value: U(e.designation) },
      { label: 'Bank Name', value: U(e.bankName) },
      { label: 'Bank A/c', value: U(e.acNo) },
      { label: 'IFSC Code', value: U(e.ifsc) },
    ];

    let empRows = '';
    for (let i = 0; i < Math.max(empLeft.length, empRight.length); i++) {
      const l = empLeft[i] || { label: '', value: '' };
      const r = empRight[i] || { label: '', value: '' };
      const stripe = i % 2 === 0 ? 'row-light' : 'row-white';
      empRows += `<tr class="${stripe}">
        <td class="emp-lbl">${l.label}</td>
        <td class="emp-val">${l.value}</td>
        <td class="emp-lbl">${r.label}</td>
        <td class="emp-val">${r.value}</td>
      </tr>`;
    }

    // Build earnings/deductions table rows
    const maxRows = Math.max(earnings.length, deductions.items.length);
    let tableRows = '';
    for (let i = 0; i < maxRows; i++) {
      const er = earnings[i] || {};
      const dr = deductions.items[i] || {};
      const stripe = i % 2 === 0 ? 'row-white' : 'row-light';
      tableRows += `<tr class="${stripe}">
        <td class="td-name">${_esc(U(er.name))}</td>
        <td class="td-num">${er.actual ? fmt(er.actual) : '&nbsp;'}</td>
        <td class="td-num">${er.salary ? fmt(er.salary) : '&nbsp;'}</td>
        <td class="td-name">${_esc(U(dr.name))}</td>
        <td class="td-num">${dr.amount ? fmt(dr.amount) : '&nbsp;'}</td>
      </tr>`;
    }

    // Address lines
    let addrLines = [];
    if (compAddr) addrLines.push(_esc(compAddr));
    let contactParts = [];
    if (compPhone) contactParts.push('Ph: ' + _esc(compPhone));
    if (compEmail) contactParts.push('Email: ' + _esc(compEmail));
    if (contactParts.length) addrLines.push(contactParts.join('  |  '));

    const taglineHtml = compTagline
      ? `<div class="slip-tagline">${_esc(compTagline)}</div>`
      : '';

    return `
    <div class="slip-page">
      <div class="top-rule"></div>

      <!-- ── HEADER ── -->
      <div class="slip-header">
        <div class="slip-hdr-left">
          ${logoHtml}
        </div>
        <div class="slip-hdr-info">
          <div class="slip-comp-name">${_esc(compName)}</div>
          ${taglineHtml}
          <div class="hdr-addr">${addrLines.join('<br>')}</div>
        </div>
      </div>

      <!-- ── TITLE BAR ── -->
      <div class="slip-title">
        <span class="slip-title-text">Payslip for the month of ${_esc(monthYear)}</span>
      </div>

      <!-- ── EMPLOYEE DETAILS ── -->
      <div class="slip-emp">
        <table>
          <tbody>
            ${empRows}
          </tbody>
        </table>
      </div>

      <!-- ── ATTENDANCE ── -->
      <div class="slip-att">
        <span>Total Days: <strong>${_esc(att.totalDays || '30')}</strong></span>
        <span>Days Paid: <strong>${_esc(att.daysPaid || '30')}</strong></span>
        <span>Loss of Pay: <strong>${_esc(att.lop || '0')}</strong></span>
      </div>

      <!-- ── EARNINGS & DEDUCTIONS TABLE ── -->
      <div class="slip-table-wrap">
        <table class="slip-table">
          <thead>
            <tr>
              <th style="width:34%">Earnings</th>
              <th style="width:16%;text-align:right">Actual (₹)</th>
              <th style="width:16%;text-align:right">Salary (₹)</th>
              <th style="width:18%">Deductions</th>
              <th style="width:16%;text-align:right">Amount (₹)</th>
            </tr>
          </thead>
          <tbody>
            ${tableRows}
          </tbody>
        </table>

        <div class="slip-totals">
          <div class="tot-cell">
            <span>Total Earnings</span>
            <span>₹ ${fmt(totalEarn)}</span>
          </div>
          <div class="tot-cell">
            <span>Total Deductions</span>
            <span>₹ ${fmt(totalDed)}</span>
          </div>
        </div>
      </div>

      <!-- ── NET PAY ── -->
      <div class="slip-net">
        <span class="slip-net-label">Net Pay</span>
        <span class="slip-net-amount">₹ ${fmt(netPay)}</span>
      </div>
      <div class="slip-net-words"><strong>In Words :</strong> ${_esc(netPayWords)}</div>

      <!-- ── BANK CREDIT ── -->
      <div class="slip-bank">
        Your net salary of <strong>Rs. ${fmt(netPay)}</strong> for <strong>${_esc(monthYear)}</strong> has been credited to your
        <strong>${U(e.bankName)}</strong> account no. <strong>${U(e.acNo)}</strong>
        (IFSC: <strong>${U(e.ifsc)}</strong>).
      </div>

      <!-- ── FOOTER ── -->
      <div class="slip-footer">
        <div class="slip-disclaimer">
          This is a computer-generated document and does not require a physical signature.<br>
          For any discrepancies, please contact the HR / Accounts department.
        </div>
      </div>

      <div class="bottom-rule"></div>
    </div>`;
  }

  /**
   * Generates full printable HTML for multiple payslips or single payslip
   */
  function generateMulti(dataList) {
    const list = Array.isArray(dataList) ? dataList : [dataList];
    if (!list.length) return '';

    const first = list[0];
    const c = first.company || {};
    const compName = c.name || 'Company';
    const isMulti = list.length > 1;
    const title = isMulti
      ? `${compName}_Payslips_${list[0].month}_to_${list[list.length - 1].month}_${list[0].year || ''}`
      : `${compName}_${first.month || ''}_${first.year || ''}_Slip`;

    const slipsHtml = list.map(d => renderSingleSlipPage(d)).join('\n');

    return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<title>${_esc(title)}</title>
<style>
  @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap');

  /* ── RESET ── */
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

  body {
    font-family: 'Inter', Arial, sans-serif;
    background: #d5d5d5;
    color: #111;
    padding: 20px;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }

  /* ── PRINT ── */
  @media print {
    body { background: #fff; padding: 0; margin: 0; }
    .slip-multi-wrap { gap: 0 !important; }
    .slip-page {
      box-shadow: none !important;
      margin: 0 auto !important;
      max-width: 100% !important;
      page-break-after: always !important;
      break-after: page !important;
    }
    .slip-page:last-child {
      page-break-after: auto !important;
      break-after: auto !important;
    }
    .no-print { display: none !important; }
    @page { margin: 8mm 10mm; size: A4 portrait; }
  }

  /* ── SCREEN WRAPPER ── */
  @media screen {
    .slip-multi-wrap {
      display: flex;
      flex-direction: column;
      gap: 32px;
      max-width: 800px;
      margin: 0 auto 60px auto;
    }
  }

  /* ── PAGE ── */
  .slip-page {
    max-width: 780px;
    margin: 0 auto;
    background: #fff;
    border: 2px solid #222;
    box-shadow: 0 4px 24px rgba(0,0,0,0.15);
  }

  /* ── TOP RULE ── */
  .top-rule { height: 3px; background: #222; }

  /* ══════════════════════════════════════════
     HEADER
     ══════════════════════════════════════════ */
  .slip-header {
    display: flex;
    align-items: center;
    gap: 20px;
    padding: 16px 28px 12px;
    border-bottom: 2px solid #222;
    background: #fafafa;
  }
  .slip-hdr-left { flex-shrink: 0; }
  .slip-logo {
    width: 64px;
    height: 64px;
    border-radius: 8px;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 24pt;
    font-weight: 900;
    overflow: hidden;
  }
  .slip-logo img { width: 100%; height: 100%; object-fit: contain; }
  .slip-hdr-info { flex: 1; }
  .slip-comp-name {
    font-size: 16pt;
    font-weight: 800;
    letter-spacing: 0.5px;
    text-transform: uppercase;
    color: #111;
    line-height: 1.15;
  }
  .slip-tagline {
    font-size: 8pt;
    font-weight: 600;
    color: #555;
    font-style: italic;
    letter-spacing: 0.3px;
    margin-bottom: 4px;
  }
  .slip-hdr-info .hdr-addr {
    font-size: 8.5pt;
    color: #444;
    line-height: 1.55;
  }

  /* ══════════════════════════════════════════
     TITLE BAR
     ══════════════════════════════════════════ */
  .slip-title {
    text-align: center;
    padding: 10px 28px;
    border-bottom: 1px solid #999;
    background: #f2f2f2;
  }
  .slip-title-text {
    font-size: 12pt;
    font-weight: 800;
    text-transform: uppercase;
    letter-spacing: 1.5px;
    color: #111;
    text-decoration: underline;
    text-underline-offset: 4px;
  }

  /* ══════════════════════════════════════════
     EMPLOYEE DETAILS
     ══════════════════════════════════════════ */
  .slip-emp { padding: 12px 28px; }
  .slip-emp table { width: 100%; border-collapse: collapse; }
  .slip-emp td {
    padding: 4px 8px;
    font-size: 8.5pt;
    border: 1px solid #bbb;
    vertical-align: top;
  }
  .emp-lbl {
    font-weight: 700;
    width: 14%;
    white-space: nowrap;
    color: #222;
  }
  .emp-val {
    width: 30%;
    font-weight: 500;
    color: #111;
  }
  .row-light td { background: #f7f7f7; }
  .row-light .emp-lbl { background: #eee; }
  .row-white td { background: #fff; }
  .row-white .emp-lbl { background: #f7f7f7; }

  /* ══════════════════════════════════════════
     ATTENDANCE
     ══════════════════════════════════════════ */
  .slip-att {
    display: flex;
    justify-content: center;
    gap: 32px;
    padding: 8px 28px 10px;
    font-size: 9pt;
    font-weight: 700;
    color: #222;
    border-top: 1px solid #ddd;
    border-bottom: 1px solid #ddd;
    background: #f9f9f9;
    letter-spacing: 0.3px;
  }

  /* ══════════════════════════════════════════
     EARNINGS & DEDUCTIONS TABLE
     ══════════════════════════════════════════ */
  .slip-table-wrap { padding: 12px 28px; }
  .slip-table {
    width: 100%;
    border-collapse: collapse;
    font-size: 8.5pt;
  }
  .slip-table th {
    background: #222;
    color: #fff;
    padding: 6px 8px;
    text-align: left;
    font-weight: 700;
    letter-spacing: 0.5px;
    border: 1px solid #222;
  }
  .slip-table td {
    padding: 4px 8px;
    border: 1px solid #bbb;
  }
  .td-name { font-weight: 600; color: #222; }
  .td-num { text-align: right; font-family: 'Courier New', monospace; font-size: 8.5pt; font-weight: 600; }

  .slip-totals {
    display: flex;
    border: 1px solid #222;
    border-top: 2px solid #222;
    background: #eee;
    font-weight: 800;
    font-size: 9pt;
  }
  .tot-cell {
    flex: 1;
    display: flex;
    justify-content: space-between;
    padding: 6px 10px;
  }
  .tot-cell:first-child { border-right: 1px solid #bbb; }

  /* ══════════════════════════════════════════
     NET PAY
     ══════════════════════════════════════════ */
  .slip-net {
    margin: 4px 28px;
    padding: 10px 16px;
    background: #f0f0f0;
    border: 2px solid #222;
    display: flex;
    justify-content: space-between;
    align-items: center;
  }
  .slip-net-label {
    font-size: 11pt;
    font-weight: 900;
    text-transform: uppercase;
    letter-spacing: 1px;
    color: #111;
  }
  .slip-net-amount {
    font-size: 14pt;
    font-weight: 900;
    color: #111;
    font-family: 'Courier New', monospace;
  }
  .slip-net-words {
    margin: 4px 28px 12px;
    font-size: 8.5pt;
    color: #333;
    line-height: 1.4;
    font-style: italic;
  }

  /* ══════════════════════════════════════════
     BANK CREDIT
     ══════════════════════════════════════════ */
  .slip-bank {
    margin: 0 28px 14px;
    padding: 8px 12px;
    background: #f9f9f9;
    border-left: 3px solid #222;
    font-size: 8.5pt;
    color: #333;
    line-height: 1.5;
  }

  /* ══════════════════════════════════════════
     FOOTER & DISCLAIMER
     ══════════════════════════════════════════ */
  .slip-footer {
    padding: 12px 28px 16px;
    border-top: 1px solid #ccc;
    background: #fafafa;
  }
  .slip-disclaimer {
    font-size: 7.5pt;
    color: #666;
    text-align: center;
    line-height: 1.5;
  }
  .bottom-rule { height: 3px; background: #222; }

  /* ══════════════════════════════════════════
     PRINT TOOLBAR (ON-SCREEN ONLY)
     ══════════════════════════════════════════ */
  .slip-print-bar {
    position: fixed;
    bottom: 20px;
    right: 20px;
    display: flex;
    gap: 10px;
    background: #222;
    padding: 10px 16px;
    border-radius: 8px;
    box-shadow: 0 4px 20px rgba(0,0,0,0.3);
    z-index: 9999;
  }
  .btn-print {
    background: #2563eb;
    color: #fff;
    border: none;
    padding: 8px 16px;
    border-radius: 6px;
    font-size: 13px;
    font-weight: 700;
    cursor: pointer;
    transition: background 0.15s ease;
  }
  .btn-print:hover { background: #1d4ed8; }
  .btn-close-slip {
    background: #4b5563;
    color: #fff;
    border: none;
    padding: 8px 14px;
    border-radius: 6px;
    font-size: 13px;
    font-weight: 600;
    cursor: pointer;
  }
  .btn-close-slip:hover { background: #374151; }
</style>
</head>
<body>

<div class="slip-multi-wrap">
  ${slipsHtml}
</div>

<div class="slip-print-bar no-print">
  <button class="btn-print" onclick="window.print()">${isMulti ? `Print All (${list.length}) Payslips` : 'Print Payslip'}</button>
  <button class="btn-close-slip" onclick="window.close()">Close</button>
</div>

</body>
</html>`;
  }

  function generate(data) {
    return generateMulti([data]);
  }

  return {
    generate,
    generateMulti,
    renderSingleSlipPage
  };
})();
