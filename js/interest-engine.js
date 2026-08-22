/**
 * ═══════════════════════════════════════════════════════════
 * INTEREST ENGINE – Savings Bank Interest Distributor
 * Distributes total savings interest across bank accounts
 * realistically and differently each generation.
 * ═══════════════════════════════════════════════════════════
 */

const InterestEngine = (() => {

  /**
   * Distribute savings interest across multiple bank accounts.
   * Each run produces a different valid distribution.
   *
   * @param {number} totalInterest   Total interest to distribute
   * @param {Array}  banks           Bank account list [{name, accountNo, ...}]
   * @returns {Array}                [{bankName, accountNo, interest}, ...]
   */
  function distribute(totalInterest, banks) {
    if (!banks || banks.length === 0) return [];

    // Current accounts (CA) do not earn interest – they are always 0.
    const interestable = banks.filter(b => (b.type || 'SB') !== 'CA');
    const caOnly       = banks.filter(b => (b.type || 'SB') === 'CA');

    if (interestable.length === 0) return banks.map(b => ({ ...b, interest: 0 }));

    let allocation = [];

    if (totalInterest <= 0) {
      allocation = interestable.map(b => ({ ...b, interest: 0 }));
    } else if (interestable.length === 1) {
      allocation = [{ ...interestable[0], interest: totalInterest }];
    } else {
      // Generate random weights (different each time)
      // Use a seeded variation to ensure realistic distribution
      const weights = _generateWeights(interestable.length);

      // Distribute with weights
      let assigned = 0;

      for (let i = 0; i < interestable.length - 1; i++) {
        const share = Math.round(totalInterest * weights[i]);
        const realistic = _roundInterest(share);
        allocation.push({ ...interestable[i], interest: realistic });
        assigned += realistic;
      }

      // Last bank gets the remainder (ensures exact total)
      const remainder = totalInterest - assigned;
      allocation.push({ ...interestable[interestable.length - 1], interest: Math.max(0, remainder) });
    }

    // Zero out current accounts and preserve the original bank order
    const allocByKey = new Map(allocation.map(d => [_bankKey(d), d.interest]));
    caOnly.forEach(b => allocByKey.set(_bankKey(b), 0));

    return banks.map(b => ({ ...b, interest: allocByKey.get(_bankKey(b)) || 0 }));
  }

  /**
   * Stable identity key for a bank account entry.
   */
  function _bankKey(b) {
    return b.id || b.accountNo || (b.name + '|' + (b.type || ''));
  }

  /**
   * Generate n random weights that sum to 1.
   * Weights vary between 0.08 and 0.50 to ensure realistic distribution.
   */
  function _generateWeights(n) {
    const raw = [];
    for (let i = 0; i < n; i++) {
      // Random between 0.10 and 0.40 with some variation
      raw.push(0.10 + Math.random() * 0.30);
    }
    const total = raw.reduce((a, b) => a + b, 0);
    return raw.map(w => w / total);
  }

  /**
   * Round interest to a realistic bank-statement-like figure.
   * e.g. 1234.56 → 1235 or 1234
   */
  function _roundInterest(n) {
    if (n <= 0) return 0;
    return Math.round(n); // Bank rounds to nearest rupee
  }

  /**
   * Auto-generate a sensible savings interest amount
   * based on total income if user doesn't specify.
   * Returns a value between 1200 and 8000.
   *
   * @param {number} totalIncome
   * @param {Object} adminConfig   {minInterest, maxInterest}
   * @returns {number}
   */
  function autoGenerate(totalIncome, adminConfig = {}) {
    const min = adminConfig.minInterest || 1200;
    const max = adminConfig.maxInterest || 8000;
    // Generate a pseudo-realistic interest: roughly 0.04% of income, capped
    const base = Math.round(totalIncome * 0.0004);
    const clamped = Math.max(min, Math.min(max, base));
    // Round to nearest 50
    return Math.round(clamped / 50) * 50;
  }

  return { distribute, autoGenerate };
})();
