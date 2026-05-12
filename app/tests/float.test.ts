// rules §6 — float strategy: charges every month (v2 bug), transfer, due-settlement
import { describe, it, expect } from 'vitest';
import { simulate } from '../src/engine/simulate';
import { minimalInputs, constantRng } from './fixtures';

describe('rules §6.1: float charges every month (fixes v2 month-0-only bug)', () => {
  it('a recurring useFloat expense charges the primary LOC every month', () => {
    const inputs = minimalInputs();
    inputs.config.startingCash = 100000;
    inputs.config.months = 4;
    inputs.config.surplusPaydownFraction = 0;
    inputs.debts = [
      { id: 1, name: 'Primary',   balance: 0, limit: 100000, apr: 13,  type: 'loc', minPaymentPct: 2 },
      { id: 2, name: 'Secondary', balance: 0, limit: 100000, apr: 7.5, type: 'loc', minPaymentPct: 2 },
    ];
    inputs.criticalOpex = [
      { id: 1, name: 'Payroll', amount: 5000, months: [], useFloat: true, enabled: true },
    ];
    inputs.floatStrategy = {
      enabled: true,
      primaryLocId: 1,
      secondaryLocId: 2,
      transferMonth: 99, // never triggers
      dueMonth: 99,       // never triggers
    };

    const r = simulate(inputs, constantRng(0));
    // Each month: $5000 added to primary LOC. After 1 month: balance ≈ $5000
    // (plus a sliver of interest). After 4 months: ≈ $20000 + accumulated interest.
    // The exact end balance depends on min-payment offsets; assert that the
    // balance keeps growing month over month, which is the test for the
    // v2 bug (which would show $5000 flat).
    expect(r[1]!.debtBalances[1]).toBeGreaterThan(r[0]!.debtBalances[1]!);
    expect(r[2]!.debtBalances[1]).toBeGreaterThan(r[1]!.debtBalances[1]!);
    expect(r[3]!.debtBalances[1]).toBeGreaterThan(r[2]!.debtBalances[1]!);
    expect(r[3]!.debtBalances[1]).toBeGreaterThan(15000); // ≥ 3× $5000 floors
  });

  it('useFloat expenses do NOT come out of cash (only out of LOC)', () => {
    const inputs = minimalInputs();
    inputs.config.startingCash = 10000;
    inputs.config.months = 1;
    inputs.config.surplusPaydownFraction = 0;
    inputs.debts = [
      { id: 1, name: 'Primary', balance: 0, limit: 100000, apr: 0, type: 'loc', minPaymentPct: 0 },
    ];
    inputs.criticalOpex = [
      { id: 1, name: 'Payroll', amount: 5000, months: [], useFloat: true, enabled: true },
    ];
    inputs.floatStrategy = {
      enabled: true,
      primaryLocId: 1,
      secondaryLocId: 1,
      transferMonth: 99,
      dueMonth: 99,
    };

    const r = simulate(inputs, constantRng(0));
    // Cash should be untouched (no other expenses).
    expect(r[0]!.cash).toBeCloseTo(10000, 6);
    expect(r[0]!.debtBalances[1]).toBeCloseTo(5000, 6);
  });
});

describe('rules §6.2: float transfer', () => {
  it('transfers from primary to secondary, capped at secondary headroom', () => {
    const inputs = minimalInputs();
    inputs.config.startingCash = 100000;
    inputs.config.months = 2;
    inputs.config.surplusPaydownFraction = 0;
    inputs.debts = [
      { id: 1, name: 'Primary',   balance: 0, limit: 100000, apr: 0, type: 'loc', minPaymentPct: 0 },
      { id: 2, name: 'Secondary', balance: 0, limit: 3000,   apr: 0, type: 'loc', minPaymentPct: 0 },
    ];
    inputs.criticalOpex = [
      { id: 1, name: 'Payroll', amount: 5000, months: [], useFloat: true, enabled: true },
    ];
    inputs.floatStrategy = {
      enabled: true,
      primaryLocId: 1,
      secondaryLocId: 2,
      transferMonth: 2,
      dueMonth: 99,
    };

    const r = simulate(inputs, constantRng(0));
    // M1: primary=5000, secondary=0.
    // M2: primary gets another 5000 (=10000), then transfer caps at secondary
    // limit of 3000. Primary 10000 → 7000; secondary 0 → 3000.
    expect(r[1]!.debtBalances[1]).toBeCloseTo(7000, 6);
    expect(r[1]!.debtBalances[2]).toBeCloseTo(3000, 6);
  });
});

describe('rules §6.3: float due settlement (C-1 aggressive)', () => {
  it('at dueMonth, pays off secondary LOC balance from cash', () => {
    const inputs = minimalInputs();
    inputs.config.startingCash = 50000;
    inputs.config.months = 3;
    inputs.config.surplusPaydownFraction = 0;
    inputs.debts = [
      { id: 1, name: 'Primary',   balance: 0, limit: 100000, apr: 0, type: 'loc', minPaymentPct: 0 },
      { id: 2, name: 'Secondary', balance: 0, limit: 100000, apr: 0, type: 'loc', minPaymentPct: 0 },
    ];
    inputs.criticalOpex = [
      { id: 1, name: 'Payroll', amount: 10000, months: [], useFloat: true, enabled: true },
    ];
    inputs.floatStrategy = {
      enabled: true,
      primaryLocId: 1,
      secondaryLocId: 2,
      transferMonth: 2,
      dueMonth: 3,
    };

    const r = simulate(inputs, constantRng(0));
    // M1: primary=10000.
    // M2: primary=20000, then transfer all 20000 to secondary (headroom is huge).
    //     primary=0, secondary=20000. Then M2 charges another 10000 to primary.
    //     Order: charges first, THEN transfer. Re-reading rule §6.1 + §6.2:
    //     "in transferMonth, after the month's float charges are applied,
    //      transfer". So M2: charge 10000 to primary (primary=20000 now? No,
    //      M1 left primary=10000, M2 adds 10000 → primary=20000). Then transfer
    //      20000 to secondary. Primary=0, secondary=20000.
    // M3: dueMonth. Charge another 10000 to primary first. Then settlement:
    //     secondary balance (20000) settled from cash. Cash: 50000 − 10000
    //     (payroll? no, payroll is float-routed) = 50000. Then settlement
    //     deducts 20000 → cash = 30000.
    //     Wait, owner draw target is 0 in minimal inputs. So cash should be:
    //     starting 50000 − 0 (no non-float opex) − 20000 (settlement) = 30000.
    expect(r[2]!.debtBalances[2]).toBe(0);
    expect(r[2]!.cash).toBeCloseTo(30000, 6);
  });

  it('if cash insufficient, draws shortfall from other LOCs (cheapest first)', () => {
    const inputs = minimalInputs();
    inputs.config.startingCash = 5000;
    inputs.config.months = 3;
    inputs.config.surplusPaydownFraction = 0;
    inputs.debts = [
      { id: 1, name: 'Primary',   balance: 0, limit: 100000, apr: 13,  type: 'loc', minPaymentPct: 0 },
      { id: 2, name: 'Secondary', balance: 0, limit: 100000, apr: 7.5, type: 'loc', minPaymentPct: 0 },
      { id: 3, name: 'Cheap LOC', balance: 0, limit: 100000, apr: 5,   type: 'loc', minPaymentPct: 0 },
    ];
    inputs.criticalOpex = [
      { id: 1, name: 'Payroll', amount: 10000, months: [], useFloat: true, enabled: true },
    ];
    inputs.floatStrategy = {
      enabled: true,
      primaryLocId: 1,
      secondaryLocId: 2,
      transferMonth: 2,
      dueMonth: 3,
    };

    const r = simulate(inputs, constantRng(0));
    // By M3, secondary should have ~20000 from M1+M2 charges transferred over.
    // Cash is ~5000; settlement of 20000 requires 15000 more from other LOCs.
    // Cheapest available LOC is #3 (5% APR), so it should be drawn.
    expect(r[2]!.debtBalances[2]).toBe(0);
    expect(r[2]!.debtBalances[3]).toBeGreaterThan(0);
    expect(r[2]!.events.some((e) => e.type === 'float_due_settled')).toBe(true);
  });
});
