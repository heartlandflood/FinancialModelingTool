// Sales commission: tiered % of revenue based on per-job size.
import { describe, it, expect } from 'vitest';
import { simulate } from '../src/engine/simulate';
import { minimalInputs, constantRng, defaultCommission } from './fixtures';

describe('commission: tiered per-job rate', () => {
  it('applies high rate when avg per-job revenue > threshold', () => {
    const inputs = minimalInputs();
    inputs.config.startingCash = 100_000;
    inputs.config.months = 1;
    inputs.config.avgJobSize = 10_000;     // each job is $10k, above $5k threshold
    inputs.config.minJobsPerMonth = 1;
    inputs.config.maxJobsPerMonth = 1;
    inputs.config.revenueVariation = 0;
    inputs.commission = { ...defaultCommission(), enabled: true };

    const r = simulate(inputs, constantRng(0));
    // Revenue = $10,000. Per-job = $10,000 > $5,000 → high rate (12%).
    // Commission = 0.12 × 10,000 = $1,200.
    expect(r[0]!.commissionPaid).toBeCloseTo(1200, 6);
    expect(r[0]!.commissionRate).toBe(0.12);
  });

  it('applies low rate when per-job revenue ≤ threshold', () => {
    const inputs = minimalInputs();
    inputs.config.startingCash = 100_000;
    inputs.config.months = 1;
    inputs.config.avgJobSize = 3_000;
    inputs.config.minJobsPerMonth = 1;
    inputs.config.maxJobsPerMonth = 1;
    inputs.config.revenueVariation = 0;
    inputs.commission = { ...defaultCommission(), enabled: true };

    const r = simulate(inputs, constantRng(0));
    // Revenue = $3,000. Per-job ≤ $5,000 → low rate (7%).
    // Commission = 0.07 × 3,000 = $210.
    expect(r[0]!.commissionPaid).toBeCloseTo(210, 6);
    expect(r[0]!.commissionRate).toBe(0.07);
  });

  it('zero commission when disabled', () => {
    const inputs = minimalInputs();
    inputs.config.startingCash = 100_000;
    inputs.config.months = 2;
    inputs.config.avgJobSize = 10_000;
    inputs.config.minJobsPerMonth = 1;
    inputs.config.maxJobsPerMonth = 1;
    inputs.config.revenueVariation = 0;
    inputs.commission = { ...defaultCommission(), enabled: false };

    const r = simulate(inputs, constantRng(0));
    for (const m of r) {
      expect(m.commissionPaid).toBe(0);
      expect(m.commissionRate).toBe(0);
    }
  });

  it('commission is part of cash outflows (operating profit drops accordingly)', () => {
    const inputs = minimalInputs();
    inputs.config.startingCash = 100_000;
    inputs.config.months = 1;
    inputs.config.avgJobSize = 10_000;
    inputs.config.minJobsPerMonth = 1;
    inputs.config.maxJobsPerMonth = 1;
    inputs.config.revenueVariation = 0;
    inputs.config.surplusPaydownFraction = 0;
    inputs.commission = { ...defaultCommission(), enabled: true };

    const r = simulate(inputs, constantRng(0));
    // M1 collections = 20% × $10,000 = $2,000. No opex/interest/owner draw.
    // Commission = $1,200. operatingProfit = 2000 - 0 - 0 - 0 - 1200 = $800.
    expect(r[0]!.operatingProfit).toBeCloseTo(800, 6);

    // Cash at end of M1: starting 100,000 + collected 2,000 - commission 1,200 = 100,800.
    expect(r[0]!.cash).toBeCloseTo(100_800, 6);
  });

  it('custom rates respected', () => {
    const inputs = minimalInputs();
    inputs.config.startingCash = 100_000;
    inputs.config.months = 1;
    inputs.config.avgJobSize = 8_000;
    inputs.config.minJobsPerMonth = 1;
    inputs.config.maxJobsPerMonth = 1;
    inputs.config.revenueVariation = 0;
    inputs.commission = {
      enabled: true,
      assigneeName: 'Test',
      threshold: 6_000,
      highRate: 0.15,
      lowRate: 0.05,
    };

    const r = simulate(inputs, constantRng(0));
    // Per-job $8,000 > $6,000 → high (15%). Commission = 0.15 × 8,000 = $1,200.
    expect(r[0]!.commissionPaid).toBeCloseTo(1200, 6);
    expect(r[0]!.commissionRate).toBe(0.15);
  });
});
