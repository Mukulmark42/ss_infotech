/**
 * ═══════════════════════════════════════════════════════════
 * CLIENT DATABASE  –  localStorage-backed client store
 * Full CRUD with PAN / mobile search
 * ═══════════════════════════════════════════════════════════
 */

const DB = (() => {
  const KEY = 'ssinfotech_clients';
  const ADMIN_KEY = 'ssinfotech_admin';

  /** Load all clients */
  function all() {
    try { return JSON.parse(localStorage.getItem(KEY) || '[]'); }
    catch { return []; }
  }

  /** Save client (create or update by ID) */
  function save(client) {
    const clients = all();
    const idx = clients.findIndex(c => c.id === client.id);
    if (idx >= 0) {
      clients[idx] = { ...clients[idx], ...client, updatedAt: Date.now() };
    } else {
      client.id = _uid();
      client.createdAt = Date.now();
      client.updatedAt = Date.now();
      clients.unshift(client);
    }
    _persist(clients);
    return client;
  }

  /** Delete client by ID */
  function remove(id) {
    const clients = all().filter(c => c.id !== id);
    _persist(clients);
  }

  /** Find client by ID */
  function findById(id) {
    return all().find(c => c.id === id) || null;
  }

  /** Search by name, PAN, or mobile */
  function search(query) {
    if (!query) return all();
    const q = query.toLowerCase().trim();
    return all().filter(c =>
      (c.name   || '').toLowerCase().includes(q) ||
      (c.pan    || '').toLowerCase().includes(q) ||
      (c.mobile || '').includes(q)
    );
  }

  /** Duplicate a client (creates new with same data, fresh ID) */
  function duplicate(id) {
    const src = findById(id);
    if (!src) return null;
    const copy = { ...src, id: _uid(), name: src.name + ' (Copy)', createdAt: Date.now(), updatedAt: Date.now() };
    const clients = all();
    clients.unshift(copy);
    _persist(clients);
    return copy;
  }

  /** Stats */
  function stats() {
    const clients = all();
    const today = new Date().toDateString();
    return {
      total:   clients.length,
      today:   clients.filter(c => new Date(c.createdAt).toDateString() === today).length,
      refund:  clients.filter(c => c.computation && c.computation.refund > 0).length,
      payable: clients.filter(c => c.computation && c.computation.taxDue > 0).length,
      recent:  clients.slice(0, 8),
      byAY:    _groupByAY(clients),
    };
  }

  function _groupByAY(clients) {
    const map = {};
    clients.forEach(c => {
      const ay = c.ay || 'Unknown';
      map[ay] = (map[ay] || 0) + 1;
    });
    return map;
  }

  function _persist(clients) {
    localStorage.setItem(KEY, JSON.stringify(clients));
  }

  function _uid() {
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  }

  // ── Admin Config ──────────────────────────────────────────
  function getAdmin() {
    try { return JSON.parse(localStorage.getItem(ADMIN_KEY) || '{}'); }
    catch { return {}; }
  }

  function saveAdmin(config) {
    localStorage.setItem(ADMIN_KEY, JSON.stringify(config));
  }

  // ── Salary Slip Companies ──────────────────────────────────
  const SLIP_COMP_KEY = 'ssinfotech_slip_companies';

  function getSlipCompanies() {
    try { return JSON.parse(localStorage.getItem(SLIP_COMP_KEY) || '[]'); }
    catch { return []; }
  }

  function saveSlipCompany(company) {
    const list = getSlipCompanies();
    const idx = list.findIndex(c => c.id === company.id);
    if (idx >= 0) {
      list[idx] = { ...list[idx], ...company };
    } else {
      company.id = _uid();
      company.createdAt = Date.now();
      list.unshift(company);
    }
    localStorage.setItem(SLIP_COMP_KEY, JSON.stringify(list));
    return company;
  }

  function removeSlipCompany(id) {
    const list = getSlipCompanies().filter(c => c.id !== id);
    localStorage.setItem(SLIP_COMP_KEY, JSON.stringify(list));
  }

  // ── Salary Slip Records ──────────────────────────────────
  const SLIP_REC_KEY = 'ssinfotech_slip_records';

  function getSlipRecords() {
    try { return JSON.parse(localStorage.getItem(SLIP_REC_KEY) || '[]'); }
    catch { return []; }
  }

  function getSlipRecordsByEmployee(empId) {
    return getSlipRecords().filter(r => r.employeeId === empId);
  }

  function getSlipRecordsByCompany(compId) {
    return getSlipRecords().filter(r => r.companyId === compId);
  }

  function saveSlipRecord(record) {
    const list = getSlipRecords();
    const idx = list.findIndex(r => r.id === record.id);
    if (idx >= 0) {
      list[idx] = { ...list[idx], ...record, updatedAt: Date.now() };
    } else {
      record.id = _uid();
      record.createdAt = Date.now();
      record.updatedAt = Date.now();
      list.unshift(record);
    }
    localStorage.setItem(SLIP_REC_KEY, JSON.stringify(list));
    return record;
  }

  function removeSlipRecord(id) {
    const list = getSlipRecords().filter(r => r.id !== id);
    localStorage.setItem(SLIP_REC_KEY, JSON.stringify(list));
  }

  function generateEmpCode(companyName) {
    const records = getSlipRecords();
    const prefix = companyName.replace(/[^A-Z]/gi, '').toUpperCase().slice(0, 3);
    let max = 0;
    records.forEach(r => {
      if (r.empCode && r.empCode.startsWith(prefix)) {
        const num = parseInt(r.empCode.slice(prefix.length), 10);
        if (num > max) max = num;
      }
    });
    return prefix + String(max + 1).padStart(3, '0');
  }

  // ── Bank Statement Records ────────────────────────────────
  const STMT_REC_KEY = 'ssinfotech_statement_records';

  function getStatementRecords() {
    try { return JSON.parse(localStorage.getItem(STMT_REC_KEY) || '[]'); }
    catch { return []; }
  }

  function saveStatementRecord(record) {
    const list = getStatementRecords();
    const idx = list.findIndex(r => r.id === record.id);
    if (idx >= 0) {
      list[idx] = { ...list[idx], ...record, updatedAt: Date.now() };
    } else {
      record.id = _uid();
      record.createdAt = Date.now();
      record.updatedAt = Date.now();
      list.unshift(record);
    }
    localStorage.setItem(STMT_REC_KEY, JSON.stringify(list));
    return record;
  }

  function removeStatementRecord(id) {
    const list = getStatementRecords().filter(r => r.id !== id);
    localStorage.setItem(STMT_REC_KEY, JSON.stringify(list));
  }

  return { all, save, remove, findById, search, duplicate, stats, getAdmin, saveAdmin,
           getSlipCompanies, saveSlipCompany, removeSlipCompany,
           getSlipRecords, getSlipRecordsByEmployee, getSlipRecordsByCompany,
           saveSlipRecord, removeSlipRecord, generateEmpCode,
           getStatementRecords, saveStatementRecord, removeStatementRecord };
})();
