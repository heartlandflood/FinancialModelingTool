// Inputs tab — every editable parameter the engine consumes, organized into
// sections: Revenue/Model · Expenses · Debts · Float strategy · Owner draw.

import { Section, Field, NumberInput, TextInput, Toggle, Button, Pill } from '../ui';
import { fmt, fmtPct } from '../../format';
import { tokens } from '../../theme';
import type { useAppState, ImportInfo } from '../../state/useAppState';
import type { Expense, Debt } from '../../engine/types';
import type { TechRow } from '../../excel/adapter';

type Bucket = 'criticalOpex' | 'flexibleOpex' | 'oneTimeExpenses';

export function InputsTab({
  state,
  importInfo,
  laborRoster,
}: {
  state: ReturnType<typeof useAppState>;
  importInfo: ImportInfo | null;
  laborRoster: TechRow[];
}) {
  const { inputs } = state;

  return (
    <>
      <div className="hero fade-in">
        <div>
          <div className="hero-kicker">Edit assumptions</div>
          <h1 className="hero-title">Your <em>inputs</em>.</h1>
        </div>
        <div className="hero-meta">
          Changes apply to the projection immediately.<br />
          <span style={{ color: tokens.color.muted }}>Refresh the page to discard everything.</span>
        </div>
      </div>

      {importInfo && importInfo.warnings.length > 0 && (
        <div className="card warm fade-in" style={{ borderColor: tokens.color.orange, marginBottom: 32 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 10 }}>
            <Pill tone="orange">Import notes</Pill>
            <strong>From {importInfo.fileName}</strong>
          </div>
          <ul style={{ margin: 0, paddingLeft: 18, color: tokens.color.muted, fontSize: 13, lineHeight: 1.7 }}>
            {importInfo.warnings.map((w, i) => (
              <li key={i}>{w}</li>
            ))}
          </ul>
        </div>
      )}

      <Section
        title="Revenue &"
        titleEm="model"
        sub="How months unfold"
        dataTour="inputs-revenue"
        infoIntro="The dials that drive every projected number."
        info={
          <>
            <p>
              <strong>Starting cash</strong> is your bank balance on day 1.{' '}
              <strong>Projection months</strong> sets the horizon (6–36).
            </p>
            <p>
              Revenue each month = <code>avgJobSize × jobs × (1 + variation)</code>.{' '}
              <em>Jobs</em> is drawn uniformly from <code>[min, max]</code>;{' '}
              <em>variation</em> is uniform on <code>[−v, +v]</code>. Set min = max to model a
              steady revenue line; widen the range for volatility.
            </p>
            <p>
              <strong>Surplus paydown fraction</strong> is what share of leftover cash each
              month gets applied to debt (highest-APR first). 0.5 = pay down half your
              surplus; 0 = never pay down.
            </p>
            <p>
              <strong>Owner draw</strong> is a fixed monthly cash expense — the simulation
              treats it like any other bill. If you want to see whether you can sustain a
              bigger draw, raise this number and watch for shortage events.
            </p>
          </>
        }
      >
        <div className="card">
          <div className="field-grid">
            <Field label="Starting cash" hint="Bank balance on day 1">
              <NumberInput
                value={inputs.config.startingCash}
                onChange={(v) => state.updateConfig({ startingCash: v })}
                step={1000}
              />
            </Field>
            <Field label="Projection months" hint="6 – 36">
              <NumberInput
                value={inputs.config.months}
                onChange={(v) => state.updateConfig({ months: Math.max(1, Math.min(36, Math.round(v))) })}
                min={1}
              />
            </Field>
            <Field label="Avg job size" hint="Or total monthly revenue if jobs=1">
              <NumberInput
                value={inputs.config.avgJobSize}
                onChange={(v) => state.updateConfig({ avgJobSize: v })}
                step={500}
              />
            </Field>
            <Field label="Min jobs / mo" hint="Lower bound">
              <NumberInput
                value={inputs.config.minJobsPerMonth}
                onChange={(v) => state.updateConfig({ minJobsPerMonth: Math.max(0, Math.round(v)) })}
                min={0}
              />
            </Field>
            <Field label="Max jobs / mo" hint="Upper bound">
              <NumberInput
                value={inputs.config.maxJobsPerMonth}
                onChange={(v) => state.updateConfig({ maxJobsPerMonth: Math.max(0, Math.round(v)) })}
                min={0}
              />
            </Field>
            <Field label="Revenue variation (±%)" hint={`Currently ±${fmtPct(inputs.config.revenueVariation)}`}>
              <NumberInput
                value={Number((inputs.config.revenueVariation * 100).toFixed(1))}
                onChange={(v) => state.updateConfig({ revenueVariation: Math.max(0, v / 100) })}
                step={1}
              />
            </Field>
            <Field label="Surplus paydown fraction (0–1)" hint="How much surplus cash goes to debt each month">
              <NumberInput
                value={inputs.config.surplusPaydownFraction}
                onChange={(v) => state.updateConfig({ surplusPaydownFraction: Math.max(0, Math.min(1, v)) })}
                step={0.05}
              />
            </Field>
            <Field label="Paydown floor ($)" hint="Skip paydown below this">
              <NumberInput
                value={inputs.config.surplusPaydownFloor}
                onChange={(v) => state.updateConfig({ surplusPaydownFloor: Math.max(0, v) })}
                step={100}
              />
            </Field>
            <Field label="Owner draw target / mo" hint="Treated as a fixed monthly expense">
              <NumberInput
                value={inputs.ownerDrawTarget}
                onChange={(v) => state.updateOwnerDraw(Math.max(0, v))}
                step={250}
              />
            </Field>
          </div>
        </div>
      </Section>

      <Section
        title="Critical"
        titleEm="expenses"
        sub={`${inputs.criticalOpex.length} items`}
      >
        <ExpenseList
          rows={inputs.criticalOpex}
          bucket="criticalOpex"
          onUpdate={state.updateExpense}
          onRemove={state.removeExpense}
          onAdd={() => state.addExpense('criticalOpex')}
          allowFloat
          allowMonths
        />
      </Section>

      <Section
        title="Flexible"
        titleEm="expenses"
        sub={`${inputs.flexibleOpex.length} items`}
      >
        <ExpenseList
          rows={inputs.flexibleOpex}
          bucket="flexibleOpex"
          onUpdate={state.updateExpense}
          onRemove={state.removeExpense}
          onAdd={() => state.addExpense('flexibleOpex')}
        />
      </Section>

      <Section
        title="One-time"
        titleEm="expenses"
        sub={`${inputs.oneTimeExpenses.length} items`}
      >
        <ExpenseList
          rows={inputs.oneTimeExpenses}
          bucket="oneTimeExpenses"
          onUpdate={state.updateExpense}
          onRemove={state.removeExpense}
          onAdd={() => state.addExpense('oneTimeExpenses')}
          allowFloat
          allowMonths
          requireMonths
        />
      </Section>

      <Section
        title="Debts &"
        titleEm="lines of credit"
        sub={`${inputs.debts.length} accounts`}
      >
        <DebtList
          rows={inputs.debts}
          onUpdate={state.updateDebt}
          onRemove={state.removeDebt}
          onAdd={state.addDebt}
        />
      </Section>

      <Section
        title="Sales"
        titleEm="commission"
        sub="Tiered % of revenue"
        infoIntro="Pay a sales rep a slice of revenue, with a different rate above and below a job-size cutoff."
        info={
          <>
            <p>
              Each month: per-job revenue = monthly revenue ÷ jobs. If it's{' '}
              <strong>above the threshold</strong> the high rate applies to that whole
              month's revenue; otherwise the low rate.
            </p>
            <p>
              Defaults reflect the rule "12% above $5,000, 7% at or below." Edit
              freely. The commission cost lands in <em>Outflows</em> on Overview and reduces
              operating profit.
            </p>
            <p>
              The <strong>assignee</strong> is only used for attribution — the engine pays
              commission regardless of who gets credit. Pick a roster name to see this
              person's annual pay include the bonus.
            </p>
          </>
        }
      >
        <div className="card">
          <Toggle
            label="Enable sales commission"
            checked={inputs.commission.enabled}
            onChange={(v) => state.updateCommission({ enabled: v })}
          />
          {inputs.commission.enabled && (
            <>
              <div className="field-grid" style={{ marginTop: 20 }}>
                <Field label="Assignee" hint="Whose annual pay this stacks onto">
                  {laborRoster.length > 0 ? (
                    <select
                      className="field-input text"
                      value={inputs.commission.assigneeName}
                      onChange={(e) => state.updateCommission({ assigneeName: e.target.value })}
                    >
                      <option value="">— pick a tech —</option>
                      {laborRoster.map((t) => (
                        <option key={t.name} value={t.name}>{t.name}</option>
                      ))}
                    </select>
                  ) : (
                    <TextInput
                      value={inputs.commission.assigneeName}
                      onChange={(v) => state.updateCommission({ assigneeName: v })}
                      placeholder="Sales rep name (free text)"
                    />
                  )}
                </Field>
                <Field label="Job-size threshold ($)" hint="Above this → high rate">
                  <NumberInput
                    value={inputs.commission.threshold}
                    onChange={(v) => state.updateCommission({ threshold: Math.max(0, v) })}
                    step={500}
                  />
                </Field>
                <Field label="High rate (%) — above threshold" hint={`Currently ${fmtPct(inputs.commission.highRate)}`}>
                  <NumberInput
                    value={Number((inputs.commission.highRate * 100).toFixed(2))}
                    onChange={(v) => state.updateCommission({ highRate: Math.max(0, v / 100) })}
                    step={0.5}
                  />
                </Field>
                <Field label="Low rate (%) — at/below threshold" hint={`Currently ${fmtPct(inputs.commission.lowRate)}`}>
                  <NumberInput
                    value={Number((inputs.commission.lowRate * 100).toFixed(2))}
                    onChange={(v) => state.updateCommission({ lowRate: Math.max(0, v / 100) })}
                    step={0.5}
                  />
                </Field>
              </div>
              <div style={{
                marginTop: 16,
                fontSize: 12,
                color: tokens.color.muted,
                lineHeight: 1.6,
              }}>
                Commission is computed each month as <strong style={{ color: tokens.color.ink }}>rate × monthly revenue</strong>,
                where the rate is the <em>high</em> rate if average per-job revenue exceeds the threshold for that month,
                otherwise the <em>low</em> rate.
              </div>
            </>
          )}
        </div>
      </Section>

      <Section
        title="Float"
        titleEm="strategy"
        sub="90-day LOC chain"
        infoIntro="Defer cash outlays by routing certain expenses through your credit lines."
        info={
          <>
            <p>
              Mark a critical expense as <em>useFloat</em> on its row above. When the float
              strategy is enabled, those expenses charge to the <strong>primary LOC</strong>{' '}
              every month instead of leaving cash.
            </p>
            <p>
              In the <strong>transfer month</strong>, the accumulated primary-LOC balance
              moves to the <strong>secondary LOC</strong> (typically cheaper APR). In the{' '}
              <strong>due month</strong>, the engine settles the secondary balance from cash
              (drawing from other LOCs if cash is short).
            </p>
            <p>
              Used carefully, this lets a profitable but cash-tight business survive
              expensive months. Used carelessly, it pushes a real problem 90 days into the
              future and adds interest cost.
            </p>
          </>
        }
      >
        <div className="card">
          <Toggle
            label="Enable float strategy"
            checked={inputs.floatStrategy.enabled}
            onChange={(v) => state.updateFloat({ enabled: v })}
          />
          {inputs.floatStrategy.enabled && (
            <div className="field-grid" style={{ marginTop: 20 }}>
              <Field label="Primary LOC (initial charge)">
                <select
                  className="field-input text"
                  value={inputs.floatStrategy.primaryLocId}
                  onChange={(e) => state.updateFloat({ primaryLocId: parseInt(e.target.value, 10) })}
                >
                  <option value={-1}>— pick a LOC —</option>
                  {inputs.debts.filter((d) => d.type === 'loc').map((d) => (
                    <option key={d.id} value={d.id}>{d.name}</option>
                  ))}
                </select>
              </Field>
              <Field label="Secondary LOC (transfer target)">
                <select
                  className="field-input text"
                  value={inputs.floatStrategy.secondaryLocId}
                  onChange={(e) => state.updateFloat({ secondaryLocId: parseInt(e.target.value, 10) })}
                >
                  <option value={-1}>— pick a LOC —</option>
                  {inputs.debts.filter((d) => d.type === 'loc').map((d) => (
                    <option key={d.id} value={d.id}>{d.name}</option>
                  ))}
                </select>
              </Field>
              <Field label="Transfer month" hint="Move primary → secondary in this month">
                <NumberInput
                  value={inputs.floatStrategy.transferMonth}
                  onChange={(v) => state.updateFloat({ transferMonth: Math.max(1, Math.round(v)) })}
                  min={1}
                />
              </Field>
              <Field label="Due month" hint="Secondary LOC settles in this month">
                <NumberInput
                  value={inputs.floatStrategy.dueMonth}
                  onChange={(v) => state.updateFloat({ dueMonth: Math.max(1, Math.round(v)) })}
                  min={1}
                />
              </Field>
            </div>
          )}
        </div>
      </Section>
    </>
  );
}

// ─── Expense rows ───────────────────────────────────────────────────────────

function ExpenseList({
  rows,
  bucket,
  onUpdate,
  onRemove,
  onAdd,
  allowFloat = false,
  allowMonths = false,
  requireMonths = false,
}: {
  rows: Expense[];
  bucket: Bucket;
  onUpdate: (b: Bucket, id: number, patch: Partial<Expense>) => void;
  onRemove: (b: Bucket, id: number) => void;
  onAdd: () => void;
  allowFloat?: boolean;
  allowMonths?: boolean;
  requireMonths?: boolean;
}) {
  const total = rows.filter((r) => r.enabled).reduce((s, r) => s + r.amount, 0);
  return (
    <div className="card flush">
      <div className="row-list" style={{ padding: '0 28px' }}>
        {rows.map((row) => (
          <ExpenseRow
            key={row.id}
            row={row}
            allowFloat={allowFloat}
            allowMonths={allowMonths}
            requireMonths={requireMonths}
            onUpdate={(patch) => onUpdate(bucket, row.id, patch)}
            onRemove={() => onRemove(bucket, row.id)}
          />
        ))}
        {rows.length === 0 && (
          <div style={{ padding: '24px 0', color: tokens.color.muted, fontSize: 13 }}>
            No items yet — click <em>Add row</em> below.
          </div>
        )}
      </div>
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: '16px 28px',
        borderTop: `1px solid ${tokens.color.border}`,
        background: tokens.color.cream,
      }}>
        <Button variant="ghost" onClick={onAdd}>+ Add row</Button>
        <div style={{ fontSize: 12, color: tokens.color.muted }}>
          Active total · <strong style={{ color: tokens.color.ink, fontFamily: tokens.font.mono }}>{fmt(total)}</strong>/mo
        </div>
      </div>
    </div>
  );
}

function ExpenseRow({
  row,
  onUpdate,
  onRemove,
  allowFloat,
  allowMonths,
  requireMonths,
}: {
  row: Expense;
  onUpdate: (patch: Partial<Expense>) => void;
  onRemove: () => void;
  allowFloat: boolean;
  allowMonths: boolean;
  requireMonths: boolean;
}) {
  const monthsStr = row.months.join(', ');
  return (
    <div className="row" style={{
      gridTemplateColumns: allowMonths
        ? '2.2fr 1fr 1.4fr auto auto auto'
        : '2.2fr 1fr auto auto',
    }}>
      <TextInput value={row.name} onChange={(v) => onUpdate({ name: v })} />
      <NumberInput value={row.amount} onChange={(v) => onUpdate({ amount: v })} step={50} />
      {allowMonths && (
        <input
          type="text"
          className="field-input"
          placeholder={requireMonths ? 'e.g. 1,6,12' : 'all months (blank)'}
          value={monthsStr}
          onChange={(e) => {
            const parsed = e.target.value
              .split(',')
              .map((s) => parseInt(s.trim(), 10))
              .filter((n) => Number.isFinite(n) && n > 0);
            onUpdate({ months: parsed });
          }}
          style={{ fontFamily: tokens.font.mono }}
        />
      )}
      <Toggle label="On" checked={row.enabled} onChange={(v) => onUpdate({ enabled: v })} />
      {allowFloat && <Toggle label="Float" checked={row.useFloat} onChange={(v) => onUpdate({ useFloat: v })} />}
      <Button variant="danger" onClick={onRemove}>×</Button>
    </div>
  );
}

// ─── Debt rows ──────────────────────────────────────────────────────────────

function DebtList({
  rows,
  onUpdate,
  onRemove,
  onAdd,
}: {
  rows: Debt[];
  onUpdate: (id: number, patch: Partial<Debt>) => void;
  onRemove: (id: number) => void;
  onAdd: () => void;
}) {
  return (
    <div className="card flush">
      <div style={{ padding: '0 28px' }}>
        {rows.map((d) => (
          <DebtRow key={d.id} row={d} onUpdate={(p) => onUpdate(d.id, p)} onRemove={() => onRemove(d.id)} />
        ))}
        {rows.length === 0 && (
          <div style={{ padding: '24px 0', color: tokens.color.muted, fontSize: 13 }}>
            No debts configured. Add a debt or LOC to enable the float strategy.
          </div>
        )}
      </div>
      <div style={{
        padding: '16px 28px',
        borderTop: `1px solid ${tokens.color.border}`,
        background: tokens.color.cream,
      }}>
        <Button variant="ghost" onClick={onAdd}>+ Add debt</Button>
      </div>
    </div>
  );
}

function DebtRow({
  row,
  onUpdate,
  onRemove,
}: {
  row: Debt;
  onUpdate: (patch: Partial<Debt>) => void;
  onRemove: () => void;
}) {
  return (
    <div style={{
      borderBottom: `1px solid ${tokens.color.borderSoft}`,
      padding: '18px 0',
    }}>
      <div style={{
        display: 'grid',
        gridTemplateColumns: '2fr 1.2fr 1fr 1fr 1fr 1fr auto',
        gap: 12,
        alignItems: 'end',
      }}>
        <Field label="Name">
          <TextInput value={row.name} onChange={(v) => onUpdate({ name: v })} />
        </Field>
        <Field label="Type">
          <select
            className="field-input text"
            value={row.type}
            onChange={(e) => onUpdate({ type: e.target.value as 'fixed' | 'loc' })}
          >
            <option value="fixed">Fixed payment</option>
            <option value="loc">Line of credit</option>
          </select>
        </Field>
        <Field label="Balance">
          <NumberInput value={row.balance} onChange={(v) => onUpdate({ balance: v })} step={500} />
        </Field>
        <Field label="APR %">
          <NumberInput value={row.apr} onChange={(v) => onUpdate({ apr: v })} step={0.25} />
        </Field>
        {row.type === 'fixed' ? (
          <Field label="Payment / mo">
            <NumberInput value={row.payment ?? 0} onChange={(v) => onUpdate({ payment: v })} step={50} />
          </Field>
        ) : (
          <Field label="Limit">
            <NumberInput value={row.limit ?? 0} onChange={(v) => onUpdate({ limit: v })} step={1000} />
          </Field>
        )}
        {row.type === 'loc' ? (
          <Field label="Min pay %">
            <NumberInput value={row.minPaymentPct ?? 0} onChange={(v) => onUpdate({ minPaymentPct: v })} step={0.5} />
          </Field>
        ) : (
          <div />
        )}
        <Button variant="danger" onClick={onRemove}>×</Button>
      </div>
    </div>
  );
}
