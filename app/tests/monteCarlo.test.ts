// rules §10 — Monte Carlo: coherent scenarios + marginal bands
import { describe, it, expect } from 'vitest';
import { runMonteCarlo } from '../src/engine/monteCarlo';
import { defaultInputs } from './fixtures';

describe('rules §10: Monte Carlo', () => {
  it('runs N simulations and returns N runs', () => {
    const r = runMonteCarlo(defaultInputs(), {
      simulations: 50,
      percentiles: [10, 50, 90],
    });
    expect(r.runs).toHaveLength(50);
    for (const run of r.runs) expect(run).toHaveLength(18);
  });

  it('rankedScenarios are coherent — each is a real simulation run', () => {
    const r = runMonteCarlo(defaultInputs(), {
      simulations: 100,
      percentiles: [10, 50, 90],
    });
    // Each ranked scenario must be a member of r.runs (not a synthetic frankenstein).
    for (const p of [10, 50, 90]) {
      const scenario = r.rankedScenarios[p];
      expect(scenario).toBeDefined();
      const matched = r.runs.some((run) =>
        run.length === scenario!.length &&
        run.every((m, i) => m.cash === scenario![i]!.cash && m.totalDebt === scenario![i]!.totalDebt),
      );
      expect(matched).toBe(true);
    }
  });

  it('scenarios are ordered: p10 has the worst net position, p90 the best', () => {
    const r = runMonteCarlo(defaultInputs(), {
      simulations: 100,
      percentiles: [10, 50, 90],
    });
    const netAt = (run: any) => {
      const last = run[run.length - 1];
      return last.cash - last.totalDebt;
    };
    expect(netAt(r.rankedScenarios[10])).toBeLessThanOrEqual(netAt(r.rankedScenarios[50]));
    expect(netAt(r.rankedScenarios[50])).toBeLessThanOrEqual(netAt(r.rankedScenarios[90]));
  });

  it('marginal bands are monotone within a month: cash p10 ≤ p50 ≤ p90', () => {
    const r = runMonteCarlo(defaultInputs(), {
      simulations: 100,
      percentiles: [10, 50, 90],
    });
    for (let m = 0; m < 18; m++) {
      expect(r.marginalBands[10]![m]!.cash).toBeLessThanOrEqual(r.marginalBands[50]![m]!.cash);
      expect(r.marginalBands[50]![m]!.cash).toBeLessThanOrEqual(r.marginalBands[90]![m]!.cash);
    }
  });

  it('histogram includes the maximum value', () => {
    const r = runMonteCarlo(defaultInputs(), {
      simulations: 100,
      percentiles: [10, 50, 90],
    });
    const totalInFinalCashHist = r.histograms.finalCash.reduce((s, b) => s + b.count, 0);
    expect(totalInFinalCashHist).toBe(100);
  });

  it('reproducibility: same baseSeed → identical results', () => {
    const inputs = defaultInputs();
    const a = runMonteCarlo(inputs, { simulations: 30, percentiles: [50], baseSeed: 7 });
    const b = runMonteCarlo(inputs, { simulations: 30, percentiles: [50], baseSeed: 7 });
    for (let i = 0; i < 30; i++) {
      for (let m = 0; m < 18; m++) {
        expect(a.runs[i]![m]!.cash).toBe(b.runs[i]![m]!.cash);
        expect(a.runs[i]![m]!.totalDebt).toBe(b.runs[i]![m]!.totalDebt);
      }
    }
  });
});
