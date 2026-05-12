// Monte Carlo wrapper around simulate().
// Per rules §10: rank whole runs by net position (cash − totalDebt) at the
// final month; scenarios are coherent simulation paths, not independent
// percentile slices.

import { simulate } from './simulate';
import { mulberry32 } from './prng';
import type { Inputs, MonthResult } from './types';

export interface MonteCarloOptions {
  simulations: number;          // N runs (default 100)
  percentiles: number[];        // e.g. [10, 50, 90]
  rankBy?: 'netPosition' | 'finalCash';   // default 'netPosition'
  baseSeed?: number;            // starting seed; runs use baseSeed+1 .. baseSeed+N
}

export interface PercentileBand {
  cash: number;
  totalDebt: number;
}

export interface MonteCarloResult {
  runs: MonthResult[][];                                  // all N runs
  rankedScenarios: Record<number, MonthResult[]>;          // p10/p50/p90 → that run's path
  marginalBands: Record<number, PercentileBand[]>;        // per-month marginal percentiles
  histograms: {
    finalCash: HistogramBin[];
    finalDebt: HistogramBin[];
    finalNetPosition: HistogramBin[];
  };
}

export interface HistogramBin {
  binStart: number;
  binEnd: number;
  binLabel: string;
  count: number;
  percentage: number;
}

const HISTOGRAM_BINS = 20;

export function runMonteCarlo(inputs: Inputs, opts: MonteCarloOptions): MonteCarloResult {
  const { simulations: n, percentiles, baseSeed = 0 } = opts;
  const rankBy = opts.rankBy ?? 'netPosition';

  // Run all simulations. Seeds baseSeed+1..baseSeed+N. Seed baseSeed reserved
  // for the deterministic default-view simulation.
  const runs: MonthResult[][] = [];
  for (let i = 0; i < n; i++) {
    const rng = mulberry32(baseSeed + 1 + i);
    runs.push(simulate(inputs, rng));
  }

  // Rank whole runs by final-month metric.
  const indexed = runs.map((run, i) => ({
    i,
    metric: scoreRun(run, rankBy),
    finalCash: lastCash(run),
    finalDebt: lastDebt(run),
  }));
  const sortedByMetric = [...indexed].sort((a, b) => a.metric - b.metric);

  const rankedScenarios: Record<number, MonthResult[]> = {};
  for (const p of percentiles) {
    const idx = Math.min(n - 1, Math.floor((p / 100) * n));
    rankedScenarios[p] = runs[sortedByMetric[idx]!.i]!;
  }

  // Marginal percentile bands per month (independent sort — these are
  // descriptive distributions, NOT scenarios).
  const monthCount = runs[0]?.length ?? 0;
  const marginalBands: Record<number, PercentileBand[]> = {};
  for (const p of percentiles) marginalBands[p] = [];

  for (let mIdx = 0; mIdx < monthCount; mIdx++) {
    const cashSorted = runs.map((r) => r[mIdx]!.cash).sort((a, b) => a - b);
    const debtSorted = runs.map((r) => r[mIdx]!.totalDebt).sort((a, b) => a - b);
    for (const p of percentiles) {
      const idx = Math.min(n - 1, Math.floor((p / 100) * n));
      marginalBands[p]!.push({
        cash: cashSorted[idx]!,
        totalDebt: debtSorted[idx]!,
      });
    }
  }

  // Histograms of final-month outcomes.
  const finalCashValues = indexed.map((x) => x.finalCash);
  const finalDebtValues = indexed.map((x) => x.finalDebt);
  const finalNetValues = indexed.map((x) => x.finalCash - x.finalDebt);

  return {
    runs,
    rankedScenarios,
    marginalBands,
    histograms: {
      finalCash: histogram(finalCashValues, HISTOGRAM_BINS),
      finalDebt: histogram(finalDebtValues, HISTOGRAM_BINS),
      finalNetPosition: histogram(finalNetValues, HISTOGRAM_BINS),
    },
  };
}

function scoreRun(run: MonthResult[], rankBy: 'netPosition' | 'finalCash'): number {
  const last = run[run.length - 1]!;
  return rankBy === 'netPosition' ? last.cash - last.totalDebt : last.cash;
}

function lastCash(run: MonthResult[]): number {
  return run[run.length - 1]!.cash;
}

function lastDebt(run: MonthResult[]): number {
  return run[run.length - 1]!.totalDebt;
}

function histogram(values: number[], bins: number): HistogramBin[] {
  if (values.length === 0) return [];
  const min = Math.min(...values);
  const max = Math.max(...values);
  if (min === max) {
    return [
      {
        binStart: min,
        binEnd: max,
        binLabel: shortLabel(min),
        count: values.length,
        percentage: 100,
      },
    ];
  }

  const size = (max - min) / bins;
  const out: HistogramBin[] = [];
  for (let i = 0; i < bins; i++) {
    const start = min + i * size;
    const end = start + size;
    // Last bin is inclusive on the right per rules §10.
    const isLast = i === bins - 1;
    const count = values.filter((v) =>
      isLast ? v >= start && v <= end : v >= start && v < end,
    ).length;
    out.push({
      binStart: start,
      binEnd: end,
      binLabel: shortLabel(start),
      count,
      percentage: (count / values.length) * 100,
    });
  }
  return out;
}

function shortLabel(v: number): string {
  if (Math.abs(v) >= 1000) return `${Math.round(v / 1000)}k`;
  return Math.round(v).toString();
}
