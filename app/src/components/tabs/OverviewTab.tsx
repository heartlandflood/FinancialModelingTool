// The headline dashboard. Editorial hero, four KPIs, a hero chart of cash vs
// debt over the horizon, and a month-by-month statement.

import {
  ResponsiveContainer, ComposedChart, CartesianGrid, XAxis, YAxis, Tooltip,
  Legend, Line, Area, ReferenceLine, Bar,
} from 'recharts';
import { Section, Pill } from '../ui';
import { fmt, fmtCompact, fmtSigned } from '../../format';
import { tokens } from '../../theme';
import type { MonthResult } from '../../engine/types';
import type { ImportInfo } from '../../state/useAppState';

export function OverviewTab({
  projection,
  startingCash,
  importInfo,
}: {
  projection: MonthResult[];
  startingCash: number;
  importInfo: ImportInfo | null;
}) {
  if (projection.length === 0) {
    return (
      <div className="empty">
        <div className="icon">◇</div>
        <h2>No projection yet</h2>
        <p>Add debts and expenses on the Inputs tab — or import your Excel budget — to see your cash flow forecast.</p>
      </div>
    );
  }

  const last = projection[projection.length - 1]!;
  const peakDebt = Math.max(...projection.map((m) => m.totalDebt));
  const avgProfit =
    projection.reduce((s, m) => s + m.operatingProfit, 0) / projection.length;
  const shortageMonths = projection.filter((m) => m.cashShortage > 0);
  const netPosition = last.cash - last.totalDebt;
  const lowestCash = Math.min(...projection.map((m) => m.cash));

  return (
    <>
      <div className="hero fade-in">
        <div>
          <div className="hero-kicker">
            {projection.length}-month outlook · seed 42
          </div>
          <h1 className="hero-title">
            Your cash <em>position</em>, month&nbsp;by&nbsp;month.
          </h1>
        </div>
        <div className="hero-meta">
          {importInfo ? (
            <>
              Source · <strong>{importInfo.fileName}</strong>
              <br />
              Imported {formatDate(importInfo.importedAt)}
              {importInfo.warnings.length > 0 && (
                <>
                  <br />
                  <Pill tone="orange">{importInfo.warnings.length} warning{importInfo.warnings.length === 1 ? '' : 's'}</Pill>
                </>
              )}
            </>
          ) : (
            <>
              Source · <strong>Manual inputs</strong>
              <br />
              <span style={{ color: tokens.color.muted }}>Import a workbook to populate.</span>
            </>
          )}
        </div>
      </div>

      <div className="kpi-grid">
        <KpiStat
          label="Final cash"
          value={fmtCompact(last.cash)}
          sub={`From ${fmt(startingCash)} starting`}
          tone={last.cash > startingCash ? 'positive' : last.cash < startingCash / 2 ? 'negative' : 'default'}
          delay={1}
        />
        <KpiStat
          label="Peak debt"
          value={fmtCompact(peakDebt)}
          sub={`Ending: ${fmt(last.totalDebt)}`}
          tone={peakDebt > startingCash * 2 ? 'negative' : 'muted'}
          delay={2}
        />
        <KpiStat
          label="Net position"
          value={fmtCompact(netPosition)}
          sub="Cash minus debt at M-final"
          tone={netPosition > 0 ? 'positive' : 'negative'}
          delay={3}
        />
        <KpiStat
          label="Avg op profit / mo"
          value={fmtCompact(avgProfit)}
          sub={`Cumulative ${fmtSigned(last.cumulativeOperatingProfit)}`}
          tone={avgProfit > 0 ? 'accent' : 'negative'}
          delay={4}
        />
      </div>

      {shortageMonths.length > 0 && (
        <div className="card warm fade-in d3" style={{ borderColor: tokens.color.negative, marginBottom: 32 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <Pill tone="negative">Critical</Pill>
            <strong>{shortageMonths.length} month{shortageMonths.length === 1 ? '' : 's'} short on cash</strong>
            <span style={{ color: tokens.color.muted }}>
              · M{shortageMonths.map((m) => m.month).join(', M')}
            </span>
          </div>
          <div style={{ marginTop: 8, color: tokens.color.muted, fontSize: 13 }}>
            LOC capacity exhausted. Review the float strategy, expense schedule, or starting cash.
          </div>
        </div>
      )}

      <Section title="Cash &" titleEm="debt" sub="18-month line">
        <CashDebtChart projection={projection} startingCash={startingCash} />
      </Section>

      <Section title="Monthly" titleEm="statement" sub="What happens, when">
        <MonthTable projection={projection} />
      </Section>

      <div style={{ marginTop: 56, fontSize: 12, color: tokens.color.muted, textAlign: 'center' }}>
        Lowest cash trough: <strong style={{ color: tokens.color.ink }}>{fmt(lowestCash)}</strong>
        {' · '}
        Ending A/R: <strong style={{ color: tokens.color.ink }}>{fmt(last.endingAccountsReceivable)}</strong>
        {' · '}
        Cumulative net cash change: <strong style={{ color: tokens.color.ink }}>{fmtSigned(last.cumulativeNetCashChange)}</strong>
      </div>
    </>
  );
}

// ─── Subcomponents ──────────────────────────────────────────────────────────

function KpiStat({
  label, value, sub, tone, delay,
}: {
  label: string;
  value: string;
  sub?: string;
  tone: 'default' | 'muted' | 'positive' | 'negative' | 'accent';
  delay: 1 | 2 | 3 | 4;
}) {
  return (
    <div className={`kpi fade-in d${delay}`}>
      <div className="kpi-label">{label}</div>
      <div className={`kpi-value ${tone === 'default' ? '' : tone}`}>{value}</div>
      {sub && <div className="kpi-sub">{sub}</div>}
    </div>
  );
}

function CashDebtChart({
  projection,
  startingCash,
}: {
  projection: MonthResult[];
  startingCash: number;
}) {
  const data = projection.map((m) => ({
    month: m.monthLabel,
    cash: Math.round(m.cash),
    debt: Math.round(m.totalDebt),
    net: Math.round(m.cash - m.totalDebt),
  }));

  return (
    <div className="chart-wrap flush">
      <ResponsiveContainer width="100%" height={360}>
        <ComposedChart data={data} margin={{ top: 16, right: 24, left: 24, bottom: 8 }}>
          <defs>
            <linearGradient id="cashFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%"  stopColor={tokens.color.blue} stopOpacity={0.18} />
              <stop offset="100%" stopColor={tokens.color.blue} stopOpacity={0.0} />
            </linearGradient>
            <linearGradient id="debtFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%"  stopColor={tokens.color.orange} stopOpacity={0.16} />
              <stop offset="100%" stopColor={tokens.color.orange} stopOpacity={0.0} />
            </linearGradient>
          </defs>
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
          <ReferenceLine y={startingCash} stroke={tokens.color.muted} strokeDasharray="3 4">
          </ReferenceLine>
          <Area type="monotone" dataKey="cash" stroke="none" fill="url(#cashFill)" name=" " legendType="none" />
          <Area type="monotone" dataKey="debt" stroke="none" fill="url(#debtFill)" name=" " legendType="none" />
          <Line type="monotone" dataKey="cash" stroke={tokens.color.blue}   strokeWidth={2.5} dot={false} name="Cash" />
          <Line type="monotone" dataKey="debt" stroke={tokens.color.orange} strokeWidth={2.5} dot={false} name="Total debt" />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}

function MonthTable({ projection }: { projection: MonthResult[] }) {
  return (
    <div className="card flush">
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontVariantNumeric: 'tabular-nums' }}>
          <thead>
            <tr style={{ borderBottom: `1px solid ${tokens.color.border}` }}>
              {['Month','Revenue','Collected','Critical','Flexible','Debt pay','Cash','Total debt','Events'].map((h) => (
                <th key={h} style={thStyle}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {projection.map((m) => (
              <tr key={m.month} style={{ borderBottom: `1px solid ${tokens.color.borderSoft}` }}>
                <td style={{ ...tdStyle, fontFamily: tokens.font.display, fontStyle: 'italic', color: tokens.color.orangeDeep }}>{m.monthLabel}</td>
                <td style={tdRight}>{fmt(m.revenue)}</td>
                <td style={tdRight}>{fmt(m.collections)}</td>
                <td style={tdRight}>{fmt(m.criticalOpex)}</td>
                <td style={tdRight}>{fmt(m.flexibleOpex)}</td>
                <td style={tdRight}>{fmt(m.debtPayments)}</td>
                <td style={{ ...tdRight, color: m.cash < 5000 ? tokens.color.negative : tokens.color.ink, fontWeight: 600 }}>{fmt(m.cash)}</td>
                <td style={tdRight}>{fmt(m.totalDebt)}</td>
                <td style={tdStyle}>
                  <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                    {m.events.length === 0 ? (
                      <span style={{ color: tokens.color.mutedSoft }}>—</span>
                    ) : (
                      m.events.map((e, i) => <EventChip key={i} type={e.type} />)
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

const thStyle: React.CSSProperties = {
  textAlign: 'left',
  padding: '14px 16px',
  fontSize: 10,
  fontWeight: 600,
  textTransform: 'uppercase',
  letterSpacing: '0.14em',
  color: tokens.color.muted,
};

const tdStyle: React.CSSProperties = {
  padding: '14px 16px',
  fontSize: 13,
  color: tokens.color.inkSoft,
};

const tdRight: React.CSSProperties = {
  ...tdStyle,
  textAlign: 'right',
  fontFamily: tokens.font.mono,
};

function EventChip({ type }: { type: string }) {
  const map: Record<string, { tone: 'blue' | 'orange' | 'positive' | 'negative' | 'muted'; label: string }> = {
    float_charge:        { tone: 'orange',   label: 'Float +' },
    float_transfer:      { tone: 'blue',     label: 'Transfer' },
    float_due_settled:   { tone: 'positive', label: 'Settled' },
    float_due_unpaid:    { tone: 'negative', label: 'Unpaid' },
    loc_draw:            { tone: 'orange',   label: 'LOC draw' },
    paydown:             { tone: 'blue',     label: 'Paydown' },
    shortage:            { tone: 'negative', label: 'Shortage' },
  };
  const m = map[type] ?? { tone: 'muted' as const, label: type };
  return <Pill tone={m.tone}>{m.label}</Pill>;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleString(undefined, {
    month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
  });
}
