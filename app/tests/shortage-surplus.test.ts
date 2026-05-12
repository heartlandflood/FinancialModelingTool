// rules §7 (shortage handling) and §8 (surplus paydown)
import { describe, it, expect } from 'vitest';
import { simulate } from '../src/engine/simulate';
import { minimalInputs, constantRng } from './fixtures';

describe('rules §7: shortage handling', () => {
  it('shortage draws from cheapest-APR LOC first', () => {
    const inputs = minimalInputs();
    inputs.config.startingCash = 0;
    inputs.config.months = 1;
    inputs.config.surplusPaydownFraction = 0;
    inputs.debts = [
      { id: 1, name: 'Expensive', balance: 0, limit: 50000, apr: 20, type: 'loc', minPaymentPct: 0 },
      { id: 2, name: 'Cheap',     balance: 0, limit: 50000, apr: 5,  type: 'loc', minPaymentPct: 0 },
    ];
    inputs.flexibleOpex = [
      { id: 1, name: 'Rent', amount: 1000, months: [], useFloat: false, enabled: true },
    ];

    const r = simulate(inputs, constantRng(0));
    // Need $1000, cash=0. Cheap LOC should be drawn.
    expect(r[0]!.debtBalances[2]).toBeCloseTo(1000, 6);
    expect(r[0]!.debtBalances[1]).toBe(0);
    expect(r[0]!.cashShortage).toBe(0);
  });

  it('overflows to the next-cheapest LOC when the first runs out', () => {
    const inputs = minimalInputs();
    inputs.config.startingCash = 0;
    inputs.config.months = 1;
    inputs.config.surplusPaydownFraction = 0;
    inputs.debts = [
      { id: 1, name: 'Expensive', balance: 0, limit: 50000, apr: 20, type: 'loc', minPaymentPct: 0 },
      { id: 2, name: 'Cheap',     balance: 0, limit: 1000,  apr: 5,  type: 'loc', minPaymentPct: 0 },
    ];
    inputs.flexibleOpex = [
      { id: 1, name: 'Rent', amount: 3000, months: [], useFloat: false, enabled: true },
    ];

    const r = simulate(inputs, constantRng(0));
    // Cheap LOC fills to its $1000 limit, then expensive picks up the rest ($2000).
    expect(r[0]!.debtBalances[2]).toBeCloseTo(1000, 6);
    expect(r[0]!.debtBalances[1]).toBeCloseTo(2000, 6);
    expect(r[0]!.cashShortage).toBe(0);
  });

  it('emits cashShortage when LOCs cannot cover', () => {
    const inputs = minimalInputs();
    inputs.config.startingCash = 0;
    inputs.config.months = 1;
    inputs.config.surplusPaydownFraction = 0;
    inputs.debts = [
      { id: 1, name: 'Small LOC', balance: 0, limit: 500, apr: 5, type: 'loc', minPaymentPct: 0 },
    ];
    inputs.flexibleOpex = [
      { id: 1, name: 'Rent', amount: 2000, months: [], useFloat: false, enabled: true },
    ];

    const r = simulate(inputs, constantRng(0));
    expect(r[0]!.debtBalances[1]).toBeCloseTo(500, 6);
    expect(r[0]!.cashShortage).toBeCloseTo(1500, 6);
    expect(r[0]!.events.some((e) => e.type === 'shortage' && e.critical)).toBe(true);
  });

  it('cashShortage is always defined (initialized to 0)', () => {
    const inputs = minimalInputs();
    inputs.config.startingCash = 100000;
    inputs.config.months = 3;
    const r = simulate(inputs, constantRng(0));
    for (const month of r) {
      expect(month.cashShortage).toBe(0);
    }
  });
});

describe('rules §8: surplus paydown', () => {
  it('pays down highest-APR debt first', () => {
    const inputs = minimalInputs();
    inputs.config.startingCash = 100000;
    inputs.config.months = 1;
    inputs.config.surplusPaydownFraction = 0.5;
    inputs.config.surplusPaydownFloor = 500;
    inputs.debts = [
      { id: 1, name: 'Cheap',     balance: 5000, limit: 50000, apr: 5,  type: 'loc', minPaymentPct: 0 },
      { id: 2, name: 'Expensive', balance: 5000, limit: 50000, apr: 20, type: 'loc', minPaymentPct: 0 },
    ];

    const r = simulate(inputs, constantRng(0));
    // After expenses & debt min payments (all 0): cash ≈ 100000.
    // Surplus = 50000. First target is APR-20 LOC ($5000), then APR-5 LOC.
    // 50000 covers both balances entirely. Both should be $0.
    expect(r[0]!.debtBalances[1]).toBe(0);
    expect(r[0]!.debtBalances[2]).toBe(0);
  });

  it('skips paydown when below the floor', () => {
    const inputs = minimalInputs();
    inputs.config.startingCash = 800; // surplus would be 400, below floor of 500
    inputs.config.months = 1;
    inputs.config.surplusPaydownFraction = 0.5;
    inputs.config.surplusPaydownFloor = 500;
    inputs.debts = [
      // apr=0 so interest doesn't perturb the balance assertion.
      { id: 1, name: 'LOC', balance: 1000, limit: 50000, apr: 0, type: 'loc', minPaymentPct: 0 },
    ];

    const r = simulate(inputs, constantRng(0));
    expect(r[0]!.debtBalances[1]).toBeCloseTo(1000, 6);
    expect(r[0]!.events.some((e) => e.type === 'paydown')).toBe(false);
  });

  it('respects surplusPaydownFraction (0.25 means a quarter goes to paydown)', () => {
    const inputs = minimalInputs();
    inputs.config.startingCash = 10000;
    inputs.config.months = 1;
    inputs.config.surplusPaydownFraction = 0.25;
    inputs.config.surplusPaydownFloor = 100;
    inputs.debts = [
      // apr=0 so interest doesn't perturb the balance assertion.
      { id: 1, name: 'LOC', balance: 50000, limit: 100000, apr: 0, type: 'loc', minPaymentPct: 0 },
    ];

    const r = simulate(inputs, constantRng(0));
    // 25% of 10000 = 2500 paydown. LOC drops from 50000 to 47500.
    expect(r[0]!.debtBalances[1]).toBeCloseTo(47500, 6);
    expect(r[0]!.cash).toBeCloseTo(7500, 6);
  });
});
