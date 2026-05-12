// rules §5 — debt service: fixed-payment amortization and LOC min payments
import { describe, it, expect } from 'vitest';
import { simulate } from '../src/engine/simulate';
import { minimalInputs, constantRng } from './fixtures';

describe('rules §5.1: fixed-payment amortization', () => {
  it('balance reduces by (payment − interest) each month, interest correct', () => {
    const inputs = minimalInputs();
    inputs.config.startingCash = 100000; // plenty of cash, no shortage logic
    inputs.config.months = 3;
    inputs.debts = [
      { id: 1, name: 'Test loan', balance: 10000, payment: 500, apr: 12, type: 'fixed' },
    ];

    const r = simulate(inputs, constantRng(0));
    // Month 1: interest = 10000 × 0.12/12 = 100. principal = 500−100 = 400.
    expect(r[0]!.interest).toBeCloseTo(100, 6);
    expect(r[0]!.debtBalances[1]).toBeCloseTo(9600, 6);
    // Month 2: interest = 9600 × 0.01 = 96. principal = 404. new bal = 9196.
    expect(r[1]!.interest).toBeCloseTo(96, 6);
    expect(r[1]!.debtBalances[1]).toBeCloseTo(9196, 6);
  });

  it('final payment is capped — never overshoots balance', () => {
    const inputs = minimalInputs();
    inputs.config.startingCash = 100000;
    inputs.config.surplusPaydownFraction = 0; // disable surplus paydown
    inputs.config.months = 2;
    inputs.debts = [
      { id: 1, name: 'Tiny loan', balance: 50, payment: 500, apr: 0, type: 'fixed' },
    ];

    const r = simulate(inputs, constantRng(0));
    // Balance only $50 + $0 interest, payment is $500 stipulated, but actual
    // payment should cap at $50. Balance ends at 0. debtPayments = $50.
    expect(r[0]!.debtBalances[1]).toBe(0);
    expect(r[0]!.debtPayments).toBeCloseTo(50, 6);
  });
});

describe('rules §5.2: LOC interest + min payment', () => {
  it('min payment = balance × minPaymentPct; balance reduces by principal', () => {
    const inputs = minimalInputs();
    inputs.config.startingCash = 100000;
    inputs.config.surplusPaydownFraction = 0;
    inputs.config.months = 1;
    inputs.debts = [
      { id: 1, name: 'Test LOC', balance: 10000, limit: 20000, apr: 12, type: 'loc', minPaymentPct: 5 },
    ];

    const r = simulate(inputs, constantRng(0));
    // Interest = 10000 × 0.01 = 100. min payment = 500. principal = 400. balance = 9600.
    expect(r[0]!.interest).toBeCloseTo(100, 6);
    expect(r[0]!.debtPayments).toBeCloseTo(500, 6);
    expect(r[0]!.debtBalances[1]).toBeCloseTo(9600, 6);
  });

  it('zero-balance LOC: no interest, no payment', () => {
    const inputs = minimalInputs();
    inputs.config.startingCash = 100000;
    inputs.config.surplusPaydownFraction = 0;
    inputs.config.months = 1;
    inputs.debts = [
      { id: 1, name: 'Idle LOC', balance: 0, limit: 50000, apr: 13, type: 'loc', minPaymentPct: 2 },
    ];

    const r = simulate(inputs, constantRng(0));
    expect(r[0]!.interest).toBe(0);
    expect(r[0]!.debtPayments).toBe(0);
    expect(r[0]!.debtBalances[1]).toBe(0);
  });
});
