// rules §2 — revenue generation
import { describe, it, expect } from 'vitest';
import { simulate } from '../src/engine/simulate';
import { mulberry32 } from '../src/engine/prng';
import { minimalInputs, constantRng } from './fixtures';

describe('rules §2: revenue', () => {
  it('avgJobSize × numJobs × (1 + variation) — zero variation', () => {
    const inputs = minimalInputs();
    inputs.config.avgJobSize = 6000;
    inputs.config.minJobsPerMonth = 4;
    inputs.config.maxJobsPerMonth = 4;
    inputs.config.revenueVariation = 0;
    inputs.config.months = 1;

    // With min===max, numJobs is always 4 regardless of rng value.
    // With variation 0, the variation draw is irrelevant.
    const r = simulate(inputs, constantRng(0.5));
    expect(r[0]!.revenue).toBeCloseTo(24000, 6);
    expect(r[0]!.jobCount).toBe(4);
  });

  it('numJobs and variation use independent draws', () => {
    const inputs = minimalInputs();
    inputs.config.avgJobSize = 1000;
    inputs.config.minJobsPerMonth = 1;
    inputs.config.maxJobsPerMonth = 5;
    inputs.config.revenueVariation = 0.5;
    inputs.config.months = 1;

    // Feed the RNG known values: first draw = 0.99 → 5 jobs.
    // Second draw = 0 → variation = -0.5 → revenue = 1000*5*0.5 = 2500.
    const r = simulate(inputs, mockSequence([0.99, 0]));
    expect(r[0]!.jobCount).toBe(5);
    expect(r[0]!.revenue).toBeCloseTo(2500, 6);
  });

  it('reproducible: same seed → same revenue sequence', () => {
    const inputs = minimalInputs();
    inputs.config.avgJobSize = 6000;
    inputs.config.minJobsPerMonth = 1;
    inputs.config.maxJobsPerMonth = 7;
    inputs.config.revenueVariation = 0.15;
    inputs.config.months = 6;

    const r1 = simulate(inputs, mulberry32(42));
    const r2 = simulate(inputs, mulberry32(42));
    expect(r1.map((m) => m.revenue)).toEqual(r2.map((m) => m.revenue));
  });

  it('seed 0 is not degenerate (mulberry32, unlike Math.sin)', () => {
    const inputs = minimalInputs();
    inputs.config.avgJobSize = 6000;
    inputs.config.minJobsPerMonth = 1;
    inputs.config.maxJobsPerMonth = 7;
    inputs.config.revenueVariation = 0.15;
    inputs.config.months = 1;

    const r = simulate(inputs, mulberry32(0));
    // With Math.sin(0)=0 in v2, this would always be 1 job at -15% variation.
    // mulberry32(0) gives a healthy non-zero first draw.
    expect(r[0]!.jobCount).toBeGreaterThan(0);
  });
});

function mockSequence(values: number[]): () => number {
  let i = 0;
  return () => values[i++] ?? 0;
}
