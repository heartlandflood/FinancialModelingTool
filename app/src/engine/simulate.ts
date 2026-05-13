// Single canonical financial simulation engine.
// Pure function: same (inputs, rng) → same output. No React, no DOM, no I/O.
// Implements the rules in docs/rules.md. Every test in tests/ checks one rule.

import type {
  Inputs,
  MonthResult,
  DebtEvent,
  Rng,
  Expense,
  Debt,
} from './types';

interface PendingTranche {
  fromMonth: number;        // 1-indexed month the revenue was booked
  collectMonth: number;     // 1-indexed month this tranche pays out
  amount: number;
}

export function simulate(inputs: Inputs, rng: Rng): MonthResult[] {
  const { config, debts, floatStrategy } = inputs;

  const debtBalances: Record<number, number> = {};
  for (const d of debts) debtBalances[d.id] = d.balance;

  let cash = config.startingCash;
  const pending: PendingTranche[] = [];
  let cumulativeOperatingProfit = 0;
  let floatDueSettled = false;

  const results: MonthResult[] = [];

  for (let m = 1; m <= config.months; m++) {
    const result = simulateMonth({
      month: m,
      inputs,
      rng,
      debtBalances,
      pending,
      cashIn: cash,
      cumulativeOperatingProfitIn: cumulativeOperatingProfit,
      floatDueSettledIn: floatDueSettled,
    });
    cash = result.cashOut;
    cumulativeOperatingProfit = result.cumulativeOperatingProfitOut;
    floatDueSettled = result.floatDueSettledOut;
    results.push(result.monthResult);
  }

  return results;
}

interface MonthInputs {
  month: number;
  inputs: Inputs;
  rng: Rng;
  debtBalances: Record<number, number>;   // mutated in place
  pending: PendingTranche[];              // mutated in place
  cashIn: number;
  cumulativeOperatingProfitIn: number;
  floatDueSettledIn: boolean;
}

interface MonthOutputs {
  monthResult: MonthResult;
  cashOut: number;
  cumulativeOperatingProfitOut: number;
  floatDueSettledOut: boolean;
}

function simulateMonth(args: MonthInputs): MonthOutputs {
  const { month: m, inputs, rng, debtBalances, pending } = args;
  const { config, debts, floatStrategy } = inputs;
  let cash = args.cashIn;
  let floatDueSettled = args.floatDueSettledIn;
  const events: DebtEvent[] = [];

  // ─── §2  Revenue ─────────────────────────────────────────────────────────
  // Per rules §2 and §11: draw numJobs FIRST, then variation. Independent.
  const numJobs = drawJobs(rng, config.minJobsPerMonth, config.maxJobsPerMonth);
  const variation = drawVariation(rng, config.revenueVariation);
  const revenue = config.avgJobSize * numJobs * (1 + variation);

  // ─── §3  Collections ────────────────────────────────────────────────────
  // 20% this month, 40% next, 40% the month after.
  const immediate = revenue * 0.20;
  pending.push({ fromMonth: m, collectMonth: m + 1, amount: revenue * 0.40 });
  pending.push({ fromMonth: m, collectMonth: m + 2, amount: revenue * 0.40 });

  let collections = immediate;
  for (let i = pending.length - 1; i >= 0; i--) {
    const p = pending[i]!;
    if (p.collectMonth === m) {
      collections += p.amount;
      pending.splice(i, 1);
    }
  }
  cash += collections;

  // ─── §5  Debt service: interest + min/fixed payments on beginning balance ─
  let totalInterest = 0;
  let totalPrincipalPaid = 0;
  let totalDebtPayment = 0;

  for (const debt of debts) {
    const beginBalance = debtBalances[debt.id] ?? 0;
    const interest = beginBalance * (debt.apr / 100) / 12;
    totalInterest += interest;

    let stipulated = 0;
    if (debt.type === 'fixed') {
      stipulated = debt.payment ?? 0;
    } else {
      stipulated = beginBalance * ((debt.minPaymentPct ?? 0) / 100);
    }

    // Cap payment so we never pay more than (balance + interest).
    const actualPayment = Math.min(stipulated, beginBalance + interest);
    const principal = Math.max(0, actualPayment - interest);

    debtBalances[debt.id] = Math.max(0, beginBalance + interest - actualPayment);
    totalDebtPayment += actualPayment;
    totalPrincipalPaid += principal;
  }

  // ─── §6.1  Float charges (every month with useFloat expenses triggering) ──
  const triggersThisMonth = (e: Expense): boolean =>
    e.enabled && (e.months.length === 0 || e.months.includes(m));

  const floatCriticalTotal = inputs.criticalOpex
    .filter((e) => triggersThisMonth(e) && e.useFloat)
    .reduce((s, e) => s + e.amount, 0);

  const floatOneTimeTotal = inputs.oneTimeExpenses
    .filter((e) => triggersThisMonth(e) && e.useFloat)
    .reduce((s, e) => s + e.amount, 0);

  const floatChargeTotal = floatCriticalTotal + floatOneTimeTotal;

  if (floatStrategy.enabled && floatChargeTotal > 0) {
    const primaryId = floatStrategy.primaryLocId;
    debtBalances[primaryId] = (debtBalances[primaryId] ?? 0) + floatChargeTotal;
    events.push({
      type: 'float_charge',
      debtId: primaryId,
      debtName: debts.find((d) => d.id === primaryId)?.name,
      amount: floatChargeTotal,
      description: `Charged ${fmt(floatChargeTotal)} of float expenses to primary LOC`,
    });
  }

  // ─── §6.2  Float transfer (primary → secondary, capped at headroom) ──────
  if (floatStrategy.enabled && m === floatStrategy.transferMonth) {
    const primary = debts.find((d) => d.id === floatStrategy.primaryLocId);
    const secondary = debts.find((d) => d.id === floatStrategy.secondaryLocId);
    if (primary && secondary && secondary.type === 'loc') {
      const primaryBal = debtBalances[primary.id] ?? 0;
      const secondaryBal = debtBalances[secondary.id] ?? 0;
      const headroom = Math.max(0, (secondary.limit ?? 0) - secondaryBal);
      const transferAmount = Math.min(primaryBal, headroom);
      if (transferAmount > 0) {
        debtBalances[primary.id] = primaryBal - transferAmount;
        debtBalances[secondary.id] = secondaryBal + transferAmount;
        events.push({
          type: 'float_transfer',
          amount: transferAmount,
          description: `Transferred ${fmt(transferAmount)} from ${primary.name} to ${secondary.name}`,
        });
      } else if (primaryBal > 0) {
        events.push({
          type: 'float_transfer',
          amount: 0,
          description: `Could not transfer float — ${secondary.name} has no headroom`,
        });
      }
    }
  }

  // ─── §6.3  Float "due" settlement (C-1: aggressive) ──────────────────────
  // Settlement amount is the full secondary-LOC balance, paid from cash;
  // shortfall is covered by other LOCs (cheapest first) via the §7 shortage
  // mechanism below. Bundle into cashNeeded.
  let floatSettlementCash = 0;
  if (floatStrategy.enabled && m === floatStrategy.dueMonth && !floatDueSettled) {
    const secondary = debts.find((d) => d.id === floatStrategy.secondaryLocId);
    if (secondary) {
      floatSettlementCash = debtBalances[secondary.id] ?? 0;
    }
    floatDueSettled = true;
  }

  // ─── §4 + §7  Cash needs ─────────────────────────────────────────────────
  const nonFloatCritical = inputs.criticalOpex
    .filter((e) => triggersThisMonth(e) && !e.useFloat)
    .reduce((s, e) => s + e.amount, 0);

  const criticalTotal = inputs.criticalOpex
    .filter(triggersThisMonth)
    .reduce((s, e) => s + e.amount, 0);

  const flexibleTotal = inputs.flexibleOpex
    .filter((e) => e.enabled)
    .reduce((s, e) => s + e.amount, 0);

  const nonFloatOneTime = inputs.oneTimeExpenses
    .filter((e) => triggersThisMonth(e) && !e.useFloat)
    .reduce((s, e) => s + e.amount, 0);

  const oneTimeTotal = inputs.oneTimeExpenses
    .filter(triggersThisMonth)
    .reduce((s, e) => s + e.amount, 0);

  const ownerDraw = inputs.ownerDrawTarget;

  // Commission: per-job revenue → tier → rate × full month revenue.
  const perJobRevenue = numJobs > 0 ? revenue / numJobs : 0;
  const commissionRate = inputs.commission.enabled
    ? (perJobRevenue > inputs.commission.threshold ? inputs.commission.highRate : inputs.commission.lowRate)
    : 0;
  const commissionPaid = revenue * commissionRate;

  const cashNeeded =
    nonFloatCritical +
    flexibleTotal +
    nonFloatOneTime +
    ownerDraw +
    commissionPaid +
    totalDebtPayment +
    floatSettlementCash;

  // ─── §7  Apply cash needs, draw from LOCs if short ───────────────────────
  let cashShortage = 0;

  if (cash >= cashNeeded) {
    cash -= cashNeeded;
    if (floatSettlementCash > 0) {
      debtBalances[floatStrategy.secondaryLocId] = 0;
      events.push({
        type: 'float_due_settled',
        debtId: floatStrategy.secondaryLocId,
        debtName: debts.find((d) => d.id === floatStrategy.secondaryLocId)?.name,
        amount: floatSettlementCash,
        description: `Settled ${fmt(floatSettlementCash)} secondary-LOC balance from cash`,
      });
    }
  } else {
    const shortage = cashNeeded - cash;
    cash = 0;

    // Drain the secondary LOC if we're settling it. (Even if we then draw
    // from other LOCs to cover the gap.)
    if (floatSettlementCash > 0) {
      debtBalances[floatStrategy.secondaryLocId] = 0;
    }

    // Available LOCs to draw from: any LOC with headroom, except the secondary
    // if we're concurrently settling it.
    const drawableLocs = debts
      .filter((d): d is Debt => d.type === 'loc')
      .filter((d) => !(floatSettlementCash > 0 && d.id === floatStrategy.secondaryLocId))
      .filter((d) => (debtBalances[d.id] ?? 0) < (d.limit ?? 0))
      .sort((a, b) => a.apr - b.apr);

    let remaining = shortage;
    for (const loc of drawableLocs) {
      if (remaining <= 0) break;
      const headroom = (loc.limit ?? 0) - (debtBalances[loc.id] ?? 0);
      const draw = Math.min(remaining, headroom);
      if (draw > 0) {
        debtBalances[loc.id] = (debtBalances[loc.id] ?? 0) + draw;
        remaining -= draw;
        events.push({
          type: 'loc_draw',
          debtId: loc.id,
          debtName: loc.name,
          amount: draw,
          description: `Drew ${fmt(draw)} from ${loc.name} to cover shortage`,
        });
      }
    }

    cashShortage = Math.max(0, remaining);

    if (floatSettlementCash > 0) {
      if (cashShortage === 0) {
        events.push({
          type: 'float_due_settled',
          debtId: floatStrategy.secondaryLocId,
          amount: floatSettlementCash,
          description: `Settled ${fmt(floatSettlementCash)} secondary-LOC balance (cash + cheaper LOC draws)`,
        });
      } else {
        events.push({
          type: 'float_due_unpaid',
          debtId: floatStrategy.secondaryLocId,
          amount: cashShortage,
          description: `⚠ Could not fully settle secondary LOC; uncovered: ${fmt(cashShortage)}`,
          critical: true,
        });
      }
    } else if (cashShortage > 0) {
      events.push({
        type: 'shortage',
        amount: cashShortage,
        description: `⚠ Uncovered cash shortage: ${fmt(cashShortage)}`,
        critical: true,
      });
    }
  }

  // ─── §8  Surplus paydown ─────────────────────────────────────────────────
  if (cash > 0 && cashShortage === 0) {
    const surplus = cash * config.surplusPaydownFraction;
    if (surplus >= config.surplusPaydownFloor) {
      const payable = debts
        .filter((d) => (debtBalances[d.id] ?? 0) > 0)
        .sort((a, b) => b.apr - a.apr);

      let remaining = surplus;
      for (const debt of payable) {
        if (remaining <= 0) break;
        const balance = debtBalances[debt.id] ?? 0;
        const paydown = Math.min(remaining, balance);
        if (paydown > 0) {
          debtBalances[debt.id] = balance - paydown;
          cash -= paydown;
          remaining -= paydown;
          events.push({
            type: 'paydown',
            debtId: debt.id,
            debtName: debt.name,
            amount: paydown,
            description: `Paid down ${fmt(paydown)} on ${debt.name} with surplus`,
          });
        }
      }
    }
  }

  // ─── §9  Reporting metrics ───────────────────────────────────────────────
  const allOpex = criticalTotal + flexibleTotal + oneTimeTotal;
  // Commission is part of operating cost (accrual basis): subtract it
  // alongside opex/interest/owner draw.
  const operatingProfit = collections - allOpex - totalInterest - ownerDraw - commissionPaid;
  const cumulativeOperatingProfit = args.cumulativeOperatingProfitIn + operatingProfit;

  const totalDebt = Object.values(debtBalances).reduce((s, b) => s + b, 0);
  const endingAR = pending.reduce((s, p) => s + p.amount, 0);

  const monthResult: MonthResult = {
    month: m,
    monthLabel: `M${m}`,
    jobCount: numJobs,
    revenue,
    collections,
    criticalOpex: criticalTotal,
    flexibleOpex: flexibleTotal,
    oneTimeExpense: oneTimeTotal,
    ownerDraw,
    debtPayments: totalDebtPayment,
    interest: totalInterest,
    principalPaid: totalPrincipalPaid,
    cash,
    totalDebt,
    debtBalances: { ...debtBalances },
    cashShortage,
    commissionPaid,
    commissionRate,
    events,
    operatingProfit,
    cumulativeOperatingProfit,
    cumulativeNetCashChange: cash - config.startingCash,
    monthEndCashSurplus: cash,
    endingAccountsReceivable: endingAR,
  };

  return {
    monthResult,
    cashOut: cash,
    cumulativeOperatingProfitOut: cumulativeOperatingProfit,
    floatDueSettledOut: floatDueSettled,
  };
}

// Uniform integer in [min, max] inclusive.
function drawJobs(rng: Rng, min: number, max: number): number {
  return Math.floor(rng() * (max - min + 1)) + min;
}

// Uniform in [-range, +range].
function drawVariation(rng: Rng, range: number): number {
  return (rng() - 0.5) * 2 * range;
}

function fmt(v: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(v);
}
