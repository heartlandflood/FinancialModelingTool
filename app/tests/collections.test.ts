// rules §3 — collections schedule (20% / 40% / 40%)
import { describe, it, expect } from 'vitest';
import { simulate } from '../src/engine/simulate';
import { minimalInputs, constantRng } from './fixtures';

describe('rules §3: collections', () => {
  it('M1 receives 20% of M1 revenue, M2 +40% of M1, M3 +40% of M1', () => {
    const inputs = minimalInputs();
    inputs.config.avgJobSize = 10000;
    inputs.config.minJobsPerMonth = 1;
    inputs.config.maxJobsPerMonth = 1;
    inputs.config.revenueVariation = 0;
    inputs.config.months = 3;

    const r = simulate(inputs, constantRng(0));
    expect(r[0]!.revenue).toBeCloseTo(10000, 6);
    expect(r[0]!.collections).toBeCloseTo(2000, 6); // 20% of M1
    expect(r[1]!.collections).toBeCloseTo(2000 + 4000, 6); // 20% M2 + 40% M1
    expect(r[2]!.collections).toBeCloseTo(2000 + 4000 + 4000, 6); // 20% M3 + 40% M2 + 40% M1
  });

  it('total collected over horizon + ending AR = total revenue', () => {
    const inputs = minimalInputs();
    inputs.config.avgJobSize = 8000;
    inputs.config.minJobsPerMonth = 2;
    inputs.config.maxJobsPerMonth = 2;
    inputs.config.revenueVariation = 0;
    inputs.config.months = 5;

    const r = simulate(inputs, constantRng(0));
    const totalCollected = r.reduce((s, m) => s + m.collections, 0);
    const totalRevenue = r.reduce((s, m) => s + m.revenue, 0);
    const endingAR = r[r.length - 1]!.endingAccountsReceivable;
    expect(totalCollected + endingAR).toBeCloseTo(totalRevenue, 4);
  });

  it('last 2 months have non-zero ending accounts receivable', () => {
    const inputs = minimalInputs();
    inputs.config.avgJobSize = 5000;
    inputs.config.minJobsPerMonth = 1;
    inputs.config.maxJobsPerMonth = 1;
    inputs.config.revenueVariation = 0;
    inputs.config.months = 4;

    const r = simulate(inputs, constantRng(0));
    // M4's revenue: 40% expected in M5 + 40% in M6 = 80% still outstanding
    // M3's revenue: 40% expected in M5 = 40% still outstanding
    // Final ending AR ≈ 0.8 × 5000 + 0.4 × 5000 = 6000
    expect(r[3]!.endingAccountsReceivable).toBeCloseTo(6000, 4);
  });
});
