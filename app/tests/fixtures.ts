// Shared input fixtures for tests. Matches the legacy v2 defaults where
// reasonable, but encoded so individual tests can override only the fields
// they exercise.

import type { Inputs } from '../src/engine/types';

export function defaultInputs(): Inputs {
  return {
    config: {
      startingCash: 47000,
      months: 18,
      avgJobSize: 6000,
      minJobsPerMonth: 1,
      maxJobsPerMonth: 7,
      revenueVariation: 0.15,
      surplusPaydownFraction: 0.5,
      surplusPaydownFloor: 500,
    },
    debts: [
      { id: 1, name: 'QB Equipment Loan', balance: 17000, payment: 3333.31, apr: 19.99, type: 'fixed' },
      { id: 2, name: 'QB LOC',            balance: 0,     limit: 76000, apr: 13,   type: 'loc', minPaymentPct: 2 },
      { id: 3, name: 'Southern Bank LOC', balance: 0,     limit: 40000, apr: 7.5,  type: 'loc', minPaymentPct: 2 },
    ],
    criticalOpex: [
      { id: 1, name: 'Payroll (Part-time)', amount: 6800, months: [], useFloat: true,  enabled: true },
      { id: 2, name: 'Payroll (Full-time)', amount: 7000, months: [], useFloat: true,  enabled: false },
      { id: 3, name: 'Rent',                amount: 2500, months: [], useFloat: false, enabled: true },
      { id: 4, name: 'Insurance',           amount: 1200, months: [], useFloat: false, enabled: true },
    ],
    flexibleOpex: [
      { id: 1, name: 'Marketing',         amount: 3000, months: [], useFloat: false, enabled: true },
      { id: 2, name: 'Software/Services', amount: 2500, months: [], useFloat: false, enabled: true },
      { id: 3, name: 'Misc Debt',         amount: 2000, months: [], useFloat: false, enabled: true },
    ],
    oneTimeExpenses: [
      { id: 1, name: 'Development Payment', amount: 11000, months: [1], useFloat: true, enabled: true },
    ],
    floatStrategy: {
      enabled: true,
      primaryLocId: 2,
      secondaryLocId: 3,
      transferMonth: 2,
      dueMonth: 3,
    },
    ownerDrawTarget: 5000,
    revenueGoal: {
      enabled: true,
      annualTarget: 750000,
      targetProfitMargin: 0.25,
    },
  };
}

// A minimal inputs object for unit-style tests where we want to isolate a
// single rule. No expenses, no float, single fixed debt, zero starting cash.
export function minimalInputs(): Inputs {
  return {
    config: {
      startingCash: 0,
      months: 3,
      avgJobSize: 0,            // zero revenue by default; tests can override
      minJobsPerMonth: 0,
      maxJobsPerMonth: 0,
      revenueVariation: 0,
      surplusPaydownFraction: 0,
      surplusPaydownFloor: 0,
    },
    debts: [],
    criticalOpex: [],
    flexibleOpex: [],
    oneTimeExpenses: [],
    floatStrategy: {
      enabled: false,
      primaryLocId: -1,
      secondaryLocId: -1,
      transferMonth: 0,
      dueMonth: 0,
    },
    ownerDrawTarget: 0,
    revenueGoal: { enabled: false, annualTarget: 0, targetProfitMargin: 0 },
  };
}

// A deterministic RNG that returns a fixed sequence. Used to remove revenue
// randomness from tests that target debt/expense math.
export function fixedRng(values: number[]): () => number {
  let i = 0;
  return () => {
    const v = values[i % values.length] ?? 0;
    i++;
    return v;
  };
}

// A constant RNG — every draw returns the same value. Combined with
// min===max revenue settings, makes revenue fully deterministic.
export function constantRng(v: number): () => number {
  return () => v;
}
