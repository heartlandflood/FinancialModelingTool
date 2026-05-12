// Scenarios tab — Monte Carlo runner. Renders coherent p10/p50/p90 scenario
// traces and marginal histogram of final outcomes.

import { useState } from 'react';
import {
  ResponsiveContainer, LineChart, BarChart, Bar, Line,
  CartesianGrid, XAxis, YAxis, Tooltip, Legend,
} from 'recharts';
import { Section, Field, NumberInput, Button, Pill } from '../ui';
import { fmt, fmtCompact, fmtSigned } from '../../format';
import { tokens } from '../../theme';
import type { useAppState } from '../../state/useAppState';

export function ScenariosTab({ state }: { state: ReturnType<typeof useAppState> }) {
  const [simCount, setSimCount] = useState(100);
  const r = state.mcResult;

  const lastByPercentile = r ? {
    p10: r.rankedScenarios[10]?.[r.rankedScenarios[10]!.length - 1],
    p50: r.rankedScenarios[50]?.[r.rankedScenarios[50]!.length - 1],
    p90: r.rankedScenarios[90]?.[r.rankedScenarios[90]!.length - 1],
  } : null;

  return (
    <>
      <div className="hero fade-in">
        <div>
          <div className="hero-kicker">Stress test</div>
          <h1 className="hero-title">
            How <em>resilient</em> is the plan?
          </h1>
        </div>
        <div className="hero-meta">
          Monte Carlo over revenue volatility.<br />
          <span style={{ color: tokens.color.muted }}>Scenarios are coherent — each is a real run.</span>
        </div>
      </div>

      <Section title="Run" titleEm="parameters">
        <div className="card">
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: 24, flexWrap: 'wrap' }}>
            <Field label="Simulations" hint="100 is a good default">
              <NumberInput
                value={simCount}
                onChange={(v) => setSimCount(Math.max(10, Math.min(1000, Math.round(v))))}
                step={50}
                min={10}
              />
            </Field>
            <Button variant="primary" onClick={() => state.runMonteCarlo(simCount)}>
              Run {simCount} simulations
            </Button>
            {r && (
              <Button variant="ghost" onClick={() => state.resetMC()}>
                Clear results
              </Button>
            )}
            <div style={{ flex: 1, minWidth: 200 }} />
            <div style={{ fontSize: 12, color: tokens.color.muted, lineHeight: 1.6 }}>
              <strong style={{ color: tokens.color.ink }}>Scenarios</strong> are ranked by net position (cash − debt).
              <br />
              <strong style={{ color: tokens.color.ink }}>Bands</strong> are marginal percentile traces per month.
            </div>
          </div>
        </div>
      </Section>

      {!r ? (
        <div className="empty" style={{ marginTop: 32 }}>
          <div className="icon">▶</div>
          <h2>Run a simulation</h2>
          <p>Each run plays revenue volatility forward and records what cash and debt look like across many possible futures.</p>
        </div>
      ) : (
        <>
          <Section title="Scenario" titleEm="outcomes" sub={`${r.runs.length} runs`}>
            <div className="kpi-grid" style={{ gridTemplateColumns: 'repeat(3, 1fr)' }}>
              <ScenarioStat
                label="10th percentile (worst)"
                tone="negative"
                cash={lastByPercentile!.p10!.cash}
                debt={lastByPercentile!.p10!.totalDebt}
              />
              <ScenarioStat
                label="Median (most likely)"
                tone="default"
                cash={lastByPercentile!.p50!.cash}
                debt={lastByPercentile!.p50!.totalDebt}
              />
              <ScenarioStat
                label="90th percentile (best)"
                tone="positive"
                cash={lastByPercentile!.p90!.cash}
                debt={lastByPercentile!.p90!.totalDebt}
              />
            </div>
          </Section>

          <Section title="Cash" titleEm="trajectories" sub="Coherent scenario paths">
            <div className="chart-wrap flush">
              <ResponsiveContainer width="100%" height={360}>
                <LineChart
                  data={buildScenarioChartData(r)}
                  margin={{ top: 16, right: 24, left: 24, bottom: 8 }}
                >
                  <CartesianGrid stroke={tokens.color.border} strokeDasharray="2 4" vertical={false} />
                  <XAxis dataKey="month" stroke={tokens.color.muted} tickLine={false} axisLine={false} />
                  <YAxis
                    stroke={tokens.color.muted}
                    tickLine={false}
                    axisLine={false}
                    tickFormatter={(v) => fmtCompact(v)}
                    width={64}
                  />
                  <Tooltip formatter={(v: number) => fmt(v)} />
                  <Legend wrapperStyle={{ paddingTop: 12 }} iconType="circle" />
                  <Line type="monotone" dataKey="p90" stroke={tokens.color.positive} strokeWidth={2}    dot={false} name="P90 — best" />
                  <Line type="monotone" dataKey="p50" stroke={tokens.color.blue}     strokeWidth={2.5}  dot={false} name="P50 — median" />
                  <Line type="monotone" dataKey="p10" stroke={tokens.color.negative} strokeWidth={2}    dot={false} name="P10 — worst" />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </Section>

          <Section title="Final" titleEm="cash distribution" sub={`${r.runs.length} simulations`}>
            <div className="chart-wrap flush">
              <ResponsiveContainer width="100%" height={300}>
                <BarChart
                  data={r.histograms.finalCash}
                  margin={{ top: 16, right: 24, left: 24, bottom: 8 }}
                >
                  <CartesianGrid stroke={tokens.color.border} strokeDasharray="2 4" vertical={false} />
                  <XAxis dataKey="binLabel" stroke={tokens.color.muted} tickLine={false} axisLine={false} />
                  <YAxis
                    stroke={tokens.color.muted}
                    tickLine={false}
                    axisLine={false}
                    tickFormatter={(v) => `${v.toFixed(0)}%`}
                    width={48}
                  />
                  <Tooltip
                    formatter={(v: number) => `${v.toFixed(1)}% of runs`}
                  />
                  <Bar dataKey="percentage" fill={tokens.color.blue} radius={[3, 3, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Section>

          <Section title="Net" titleEm="position distribution" sub="Cash − debt">
            <div className="chart-wrap flush">
              <ResponsiveContainer width="100%" height={300}>
                <BarChart
                  data={r.histograms.finalNetPosition}
                  margin={{ top: 16, right: 24, left: 24, bottom: 8 }}
                >
                  <CartesianGrid stroke={tokens.color.border} strokeDasharray="2 4" vertical={false} />
                  <XAxis dataKey="binLabel" stroke={tokens.color.muted} tickLine={false} axisLine={false} />
                  <YAxis
                    stroke={tokens.color.muted}
                    tickLine={false}
                    axisLine={false}
                    tickFormatter={(v) => `${v.toFixed(0)}%`}
                    width={48}
                  />
                  <Tooltip
                    formatter={(v: number) => `${v.toFixed(1)}% of runs`}
                  />
                  <Bar dataKey="percentage" fill={tokens.color.orange} radius={[3, 3, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Section>
        </>
      )}
    </>
  );
}

function ScenarioStat({
  label,
  cash,
  debt,
  tone,
}: {
  label: string;
  cash: number;
  debt: number;
  tone: 'default' | 'positive' | 'negative';
}) {
  const net = cash - debt;
  const toneClass = tone === 'default' ? '' : tone;
  return (
    <div className="kpi">
      <div className="kpi-label">{label}</div>
      <div className={`kpi-value ${toneClass}`}>{fmtCompact(net)}</div>
      <div className="kpi-sub">
        Cash {fmt(cash)} · Debt {fmt(debt)}
      </div>
    </div>
  );
}

function buildScenarioChartData(r: ReturnType<typeof useAppState>['mcResult']) {
  if (!r) return [];
  const months = r.rankedScenarios[50]?.length ?? 0;
  const data: { month: string; p10: number; p50: number; p90: number }[] = [];
  for (let i = 0; i < months; i++) {
    data.push({
      month: r.rankedScenarios[50]![i]!.monthLabel,
      p10: Math.round(r.rankedScenarios[10]![i]!.cash),
      p50: Math.round(r.rankedScenarios[50]![i]!.cash),
      p90: Math.round(r.rankedScenarios[90]![i]!.cash),
    });
  }
  return data;
}

// Suppress unused-import warning in case fmtSigned isn't referenced
void fmtSigned;
