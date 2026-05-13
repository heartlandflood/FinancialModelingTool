// The headline dashboard. Editorial hero, four KPIs, a hero chart of cash vs
// debt over the horizon, and a month-by-month statement.

import {
  ResponsiveContainer, ComposedChart, CartesianGrid, XAxis, YAxis, Tooltip,
  Legend, Line, Area, ReferenceLine, Bar,
} from 'recharts';
import { Section, Pill } from '../ui';
import { fmt, fmtCompact, fmtSigned } from '../../format';
import { tokens } from '../../theme';
import type { MonthResult, Commission } from '../../engine/types';
import type { ImportInfo } from '../../state/useAppState';
import type { TechRow } from '../../excel/adapter';

export function OverviewTab({
  projection,
  startingCash,
  importInfo,
  laborRoster,
  ownerDrawTarget,
  commission,
}: {
  projection: MonthResult[];
  startingCash: number;
  importInfo: ImportInfo | null;
  laborRoster: TechRow[];
  ownerDrawTarget: number;
  commission: Commission;
}) {
  if (projection.length === 0) {
    return (
      <div className="empty">
        <div className="icon">◇</div>
        <h2>No projection yet</h2>
        <p>
          Click <strong>Use template</strong> in the header to load your pre-filled budget, or use{' '}
          <strong>Import</strong> to upload a workbook. You can also enter numbers directly on the Inputs tab.
        </p>
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

      <Section title="Horizon" titleEm="summary" sub={`Where the ${fmtCompact(last.cash)} comes from`}>
        <HorizonSummary
          projection={projection}
          startingCash={startingCash}
          ownerDrawTarget={ownerDrawTarget}
        />
      </Section>

      {commission.enabled && (
        <Section title="Sales" titleEm="commission" sub={commission.assigneeName || 'Unassigned'}>
          <CommissionSummary projection={projection} commission={commission} />
        </Section>
      )}

      <Section title="Cash &" titleEm="debt" sub="18-month line">
        <CashDebtChart projection={projection} startingCash={startingCash} />
      </Section>

      {laborRoster.length > 0 && (
        <Section
          title="Labor"
          titleEm="cost by person"
          sub="From the imported roster"
        >
          <LaborRoster
            roster={laborRoster}
            horizonMonths={projection.length}
            commission={commission}
            totalCommissionPaid={sum(projection, (m) => m.commissionPaid)}
          />
        </Section>
      )}

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

function HorizonSummary({
  projection,
  startingCash,
  ownerDrawTarget,
}: {
  projection: MonthResult[];
  startingCash: number;
  ownerDrawTarget: number;
}) {
  // Aggregate the horizon. Revenue and operating profit are accrual basis;
  // collections and outflows are cash basis. We surface both views so the
  // user can see why final cash differs from accrual profit.
  const totalRevenue    = sum(projection, (m) => m.revenue);
  const totalCollections = sum(projection, (m) => m.collections);
  const totalCritical   = sum(projection, (m) => m.criticalOpex);
  const totalFlexible   = sum(projection, (m) => m.flexibleOpex);
  const totalOneTime    = sum(projection, (m) => m.oneTimeExpense);
  const totalDebtPay    = sum(projection, (m) => m.debtPayments);
  const totalInterest   = sum(projection, (m) => m.interest);
  const totalPrincipal  = sum(projection, (m) => m.principalPaid);
  const totalOwnerDraw  = ownerDrawTarget * projection.length;
  const totalCommission = sum(projection, (m) => m.commissionPaid);
  const totalJobs       = sum(projection, (m) => m.jobCount);
  const last            = projection[projection.length - 1]!;
  const endingAR        = last.endingAccountsReceivable;
  const finalCash       = last.cash;

  // Cash reconciliation: starting + collections − all cash outflows = final cash
  const cashOut = totalCritical + totalFlexible + totalOneTime + totalDebtPay + totalOwnerDraw + totalCommission;
  const reconciled = startingCash + totalCollections - cashOut;

  const months = projection.length;
  const avgJobsPerMonth = totalJobs / months;
  const avgRevPerMonth = totalRevenue / months;

  return (
    <div className="card">
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 40 }}>
        <div>
          <div style={{ fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.16em', color: tokens.color.positive, marginBottom: 14 }}>
            Inflows
          </div>
          <SumRow label="Jobs completed" value={`${totalJobs}`} sub={`${avgJobsPerMonth.toFixed(1)}/mo avg`} />
          <SumRow label="Revenue booked" value={fmt(totalRevenue)} sub={`${fmt(avgRevPerMonth)}/mo avg`} />
          <SumRow label="Cash collected" value={fmt(totalCollections)} sub="Per 20/40/40 schedule" />
          <SumRow label="Ending A/R" value={fmt(endingAR)} sub="Uncollected at horizon end" muted />
        </div>
        <div>
          <div style={{ fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.16em', color: tokens.color.negative, marginBottom: 14 }}>
            Outflows
          </div>
          <SumRow label="Critical OpEx" value={fmt(totalCritical)} sub={`${fmt(totalCritical / months)}/mo avg`} />
          <SumRow label="Flexible OpEx" value={fmt(totalFlexible)} sub={`${fmt(totalFlexible / months)}/mo avg`} />
          {totalOneTime > 0 && <SumRow label="One-time expenses" value={fmt(totalOneTime)} />}
          {totalDebtPay > 0 && (
            <SumRow
              label="Debt service"
              value={fmt(totalDebtPay)}
              sub={`Interest ${fmt(totalInterest)} · Principal ${fmt(totalPrincipal)}`}
            />
          )}
          <SumRow label="Owner draws" value={fmt(totalOwnerDraw)} sub={`${fmt(ownerDrawTarget)}/mo × ${months}`} />
          {totalCommission > 0 && (
            <SumRow label="Sales commission" value={fmt(totalCommission)} sub={`${fmt(totalCommission / months)}/mo avg`} />
          )}
        </div>
      </div>

      <div style={{
        marginTop: 32,
        paddingTop: 20,
        borderTop: `1px solid ${tokens.color.border}`,
      }}>
        <div style={{ fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.16em', color: tokens.color.muted, marginBottom: 14 }}>
          Reconciliation
        </div>
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(5, 1fr)',
          gap: 12,
          alignItems: 'baseline',
          fontFamily: tokens.font.mono,
          fontVariantNumeric: 'tabular-nums',
        }}>
          <ReconCell label="Starting cash" value={fmt(startingCash)} />
          <ReconCell label="+ collected" value={fmt(totalCollections)} tone="positive" />
          <ReconCell label="− outflows" value={fmt(cashOut)} tone="negative" />
          <ReconCell label="= final cash" value={fmt(reconciled)} tone="strong" />
          <ReconCell label="engine reports" value={fmt(finalCash)} muted />
        </div>
        {Math.abs(reconciled - finalCash) > 1 && (
          <div style={{ marginTop: 10, fontSize: 12, color: tokens.color.warning, fontFamily: tokens.font.body }}>
            Note: reconciliation differs from engine final cash by {fmt(reconciled - finalCash)}.
            This usually means surplus paydown moved cash to principal (it shows as
            "principal paid" in debt service rather than as cash held).
          </div>
        )}
      </div>
    </div>
  );
}

function SumRow({
  label,
  value,
  sub,
  muted,
}: {
  label: string;
  value: string;
  sub?: string;
  muted?: boolean;
}) {
  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: '1fr auto',
      alignItems: 'baseline',
      padding: '10px 0',
      borderBottom: `1px solid ${tokens.color.borderSoft}`,
    }}>
      <div>
        <div style={{ fontSize: 13, color: muted ? tokens.color.muted : tokens.color.ink, fontWeight: 500 }}>{label}</div>
        {sub && <div style={{ fontSize: 11, color: tokens.color.muted, marginTop: 2 }}>{sub}</div>}
      </div>
      <div style={{
        fontFamily: tokens.font.mono,
        fontVariantNumeric: 'tabular-nums',
        fontSize: 15,
        color: muted ? tokens.color.muted : tokens.color.ink,
      }}>
        {value}
      </div>
    </div>
  );
}

function ReconCell({
  label,
  value,
  tone = 'default',
  muted,
}: {
  label: string;
  value: string;
  tone?: 'default' | 'positive' | 'negative' | 'strong';
  muted?: boolean;
}) {
  const color =
    muted ? tokens.color.mutedSoft :
    tone === 'positive' ? tokens.color.positive :
    tone === 'negative' ? tokens.color.negative :
    tone === 'strong'   ? tokens.color.ink :
    tokens.color.ink;
  return (
    <div>
      <div style={{
        fontSize: 10,
        fontWeight: 600,
        textTransform: 'uppercase',
        letterSpacing: '0.1em',
        color: tokens.color.muted,
        fontFamily: tokens.font.body,
        marginBottom: 4,
      }}>{label}</div>
      <div style={{ fontSize: tone === 'strong' ? 20 : 16, fontWeight: tone === 'strong' ? 600 : 500, color }}>
        {value}
      </div>
    </div>
  );
}

function LaborRoster({
  roster,
  horizonMonths,
  commission,
  totalCommissionPaid,
}: {
  roster: TechRow[];
  horizonMonths: number;
  commission: Commission;
  totalCommissionPaid: number;
}) {
  const totalMonthly = roster.reduce((s, r) => s + r.loadedMonthlyCost, 0);

  // Average monthly commission for the assignee (if commission is on and matches a roster row).
  const commissionPerMonth = horizonMonths > 0 ? totalCommissionPaid / horizonMonths : 0;
  const matchAssignee = (name: string) =>
    commission.enabled &&
    commission.assigneeName.trim() !== '' &&
    name === commission.assigneeName;

  return (
    <div className="card flush">
      <div style={{ overflowX: 'auto' }}>
        <table style={{
          width: '100%',
          borderCollapse: 'collapse',
          fontVariantNumeric: 'tabular-nums',
        }}>
          <thead>
            <tr style={{ borderBottom: `1px solid ${tokens.color.border}` }}>
              <th style={rosterTh}>Tech</th>
              <th style={rosterTh}>Wage</th>
              <th style={rosterTh}>Billable hrs/mo</th>
              <th style={rosterTh}>Base monthly</th>
              <th style={rosterTh}>+ Commission</th>
              <th style={rosterTh}>Annual (12 mo)</th>
              <th style={rosterTh}>Over horizon ({horizonMonths} mo)</th>
            </tr>
          </thead>
          <tbody>
            {roster.map((t) => {
              const hasCommission = matchAssignee(t.name);
              const monthlyCommission = hasCommission ? commissionPerMonth : 0;
              const monthlyTotal = t.loadedMonthlyCost + monthlyCommission;
              return (
                <tr key={t.name} style={{ borderBottom: `1px solid ${tokens.color.borderSoft}` }}>
                  <td style={rosterTd}>
                    <div style={{ fontWeight: 500, color: tokens.color.ink, display: 'flex', alignItems: 'center', gap: 8 }}>
                      {t.name}
                      {hasCommission && <Pill tone="orange">Commission</Pill>}
                    </div>
                    {t.notes && (
                      <div style={{ fontSize: 11, color: tokens.color.muted, marginTop: 2 }}>{t.notes}</div>
                    )}
                  </td>
                  <td style={rosterTdMono}>
                    {t.wagePerHour !== null ? `$${t.wagePerHour.toFixed(0)}/hr` : '—'}
                  </td>
                  <td style={rosterTdMono}>
                    {t.billableHoursPerMonth !== null ? t.billableHoursPerMonth.toFixed(0) : '—'}
                  </td>
                  <td style={rosterTdMono}>{fmt(t.loadedMonthlyCost)}</td>
                  <td style={{ ...rosterTdMono, color: hasCommission ? tokens.color.orangeDeep : tokens.color.mutedSoft }}>
                    {hasCommission ? fmt(monthlyCommission) : '—'}
                  </td>
                  <td style={{ ...rosterTdMono, color: tokens.color.inkSoft }}>{fmt(monthlyTotal * 12)}</td>
                  <td style={{ ...rosterTdMono, fontWeight: 600 }}>{fmt(monthlyTotal * horizonMonths)}</td>
                </tr>
              );
            })}
            <tr style={{
              background: tokens.color.cream,
              borderTop: `2px solid ${tokens.color.border}`,
            }}>
              <td style={{ ...rosterTd, fontWeight: 600, fontStyle: 'italic', color: tokens.color.orangeDeep, fontFamily: tokens.font.display }}>
                Roster total
              </td>
              <td style={rosterTd} />
              <td style={rosterTd} />
              <td style={{ ...rosterTdMono, fontWeight: 600 }}>{fmt(totalMonthly)}</td>
              <td style={{ ...rosterTdMono, fontWeight: 600, color: tokens.color.orangeDeep }}>
                {commission.enabled ? fmt(commissionPerMonth) : '—'}
              </td>
              <td style={{ ...rosterTdMono, fontWeight: 600 }}>
                {fmt((totalMonthly + commissionPerMonth) * 12)}
              </td>
              <td style={{ ...rosterTdMono, fontWeight: 700, color: tokens.color.blue }}>
                {fmt(totalMonthly * horizonMonths + totalCommissionPaid)}
              </td>
            </tr>
          </tbody>
        </table>
      </div>
      {commission.enabled && commission.assigneeName.trim() === '' && (
        <div style={{
          padding: '14px 28px',
          borderTop: `1px solid ${tokens.color.border}`,
          fontSize: 12,
          color: tokens.color.warning,
          background: tokens.color.cream,
        }}>
          Commission is enabled but no assignee is selected — commission paid (
          {fmt(totalCommissionPaid)}) is in the cash outflows but not attributed to any tech above.
          Pick an assignee on the Inputs tab.
        </div>
      )}
    </div>
  );
}

function CommissionSummary({
  projection,
  commission,
}: {
  projection: MonthResult[];
  commission: Commission;
}) {
  const total = projection.reduce((s, m) => s + m.commissionPaid, 0);
  const monthsAtHigh = projection.filter((m) => m.commissionRate === commission.highRate).length;
  const monthsAtLow  = projection.filter((m) => m.commissionRate === commission.lowRate).length;

  return (
    <div className="card">
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 24 }}>
        <Stat
          label="Total over horizon"
          value={fmt(total)}
          sub={`${fmt(total / projection.length)}/mo avg`}
        />
        <Stat
          label="Months at high rate"
          value={`${monthsAtHigh}`}
          sub={`${(commission.highRate * 100).toFixed(1)}% × revenue when avg job > ${fmt(commission.threshold)}`}
        />
        <Stat
          label="Months at low rate"
          value={`${monthsAtLow}`}
          sub={`${(commission.lowRate * 100).toFixed(1)}% × revenue otherwise`}
        />
        <Stat
          label="Assignee"
          value={commission.assigneeName || '—'}
          sub={commission.assigneeName ? 'See roster table for breakdown' : 'Set on Inputs tab'}
        />
      </div>
    </div>
  );
}

function Stat({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div>
      <div style={{ fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.14em', color: tokens.color.muted, marginBottom: 8 }}>
        {label}
      </div>
      <div style={{ fontFamily: tokens.font.display, fontSize: 28, fontWeight: 500, letterSpacing: '-0.02em', color: tokens.color.ink, fontVariantNumeric: 'tabular-nums' }}>
        {value}
      </div>
      {sub && <div style={{ fontSize: 12, color: tokens.color.muted, marginTop: 4 }}>{sub}</div>}
    </div>
  );
}

const rosterTh: React.CSSProperties = {
  textAlign: 'left',
  padding: '14px 20px',
  fontSize: 10,
  fontWeight: 600,
  textTransform: 'uppercase',
  letterSpacing: '0.14em',
  color: tokens.color.muted,
  fontFamily: tokens.font.body,
};

const rosterTd: React.CSSProperties = {
  padding: '14px 20px',
  fontSize: 13,
};

const rosterTdMono: React.CSSProperties = {
  ...rosterTd,
  fontFamily: tokens.font.mono,
};

function sum<T>(arr: T[], pick: (x: T) => number): number {
  return arr.reduce((s, x) => s + pick(x), 0);
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
