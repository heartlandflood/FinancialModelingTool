// rules §4.1 (owner draw) and §9 (profit / cash reporting)
import { describe, it, expect } from 'vitest';
import { simulate } from '../src/engine/simulate';
import { minimalInputs, constantRng } from './fixtures';

describe('rules §4.1: owner draw as fixed expense', () => {
  it('ownerDrawTarget deducts from cash every month', () => {
    const inputs = minimalInputs();
    inputs.config.startingCash = 50000;
    inputs.config.months = 3;
    inputs.config.surplusPaydownFraction = 0;
    inputs.ownerDrawTarget = 5000;

    const r = simulate(inputs, constantRng(0));
    // No other inflows or outflows. cash = 50000 - 5000*month.
    expect(r[0]!.cash).toBeCloseTo(45000, 6);
    expect(r[1]!.cash).toBeCloseTo(40000, 6);
    expect(r[2]!.cash).toBeCloseTo(35000, 6);
    for (const m of r) expect(m.ownerDraw).toBe(5000);
  });
});

describe('rules §9: profit metrics are accrual; cash is cash', () => {
  it('operatingProfit excludes principal repayment but includes interest', () => {
    const inputs = minimalInputs();
    inputs.config.startingCash = 100000;
    inputs.config.surplusPaydownFraction = 0;
    inputs.config.months = 1;
    inputs.config.avgJobSize = 10000;
    inputs.config.minJobsPerMonth = 1;
    inputs.config.maxJobsPerMonth = 1;
    inputs.config.revenueVariation = 0;
    inputs.debts = [
      { id: 1, name: 'Loan', balance: 12000, payment: 1000, apr: 12, type: 'fixed' },
    ];

    const r = simulate(inputs, constantRng(0));
    // collections = 2000 (20% of 10000). allOpex = 0. interest = 120. ownerDraw=0.
    // operatingProfit = 2000 - 0 - 120 - 0 = 1880.
    // Note that the $1000 payment INCLUDES principal $880, which is NOT
    // subtracted from profit (only the $120 interest is).
    expect(r[0]!.operatingProfit).toBeCloseTo(1880, 6);
  });

  it('cumulativeNetCashChange equals cash − startingCash', () => {
    const inputs = minimalInputs();
    inputs.config.startingCash = 25000;
    inputs.config.months = 3;
    inputs.config.surplusPaydownFraction = 0;
    inputs.ownerDrawTarget = 1000;

    const r = simulate(inputs, constantRng(0));
    for (const m of r) {
      expect(m.cumulativeNetCashChange).toBeCloseTo(m.cash - 25000, 6);
    }
  });

  it('cumulativeOperatingProfit ≠ cumulativeNetCashChange when principal is paid', () => {
    // Sanity: with debt principal repayment, profit and cash should diverge.
    const inputs = minimalInputs();
    inputs.config.startingCash = 100000;
    inputs.config.months = 3;
    inputs.config.surplusPaydownFraction = 0;
    inputs.config.avgJobSize = 10000;
    inputs.config.minJobsPerMonth = 1;
    inputs.config.maxJobsPerMonth = 1;
    inputs.config.revenueVariation = 0;
    inputs.debts = [
      { id: 1, name: 'Loan', balance: 12000, payment: 1000, apr: 12, type: 'fixed' },
    ];

    const r = simulate(inputs, constantRng(0));
    const last = r[r.length - 1]!;
    // Principal got paid → cash decreased more than operatingProfit indicates.
    expect(last.cumulativeOperatingProfit).toBeGreaterThan(last.cumulativeNetCashChange);
  });
});
