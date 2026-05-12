# Heartland Cash Flow Model — Rules of operation

This document is the **single source of truth** for what the simulation does.
Every test in `tests/` will check one of the rules below. Every line of engine
code in `src/engine/` will implement one of these rules. If the rules and the
code disagree, the rules win — change the code.

Anything marked **OPEN** below is a model decision that needs your sign-off
before milestone 3 begins. Anything marked **CHANGE vs v2** is different from
the current `cashflow-model-pro-v2.jsx` and is a deliberate fix.

---

## 1. Time and indexing

- The model runs for `config.months` discrete monthly periods (default 18).
- Months are **1-indexed** everywhere a human sees them (M1, M2, ...).
  Internally the loop variable is 0-indexed; the public API exposes 1-indexed.
- All cash flows for a month are computed in a fixed order (§ 5–8) before the
  next month begins. There is no intra-month time.

---

## 2. Revenue generation

- Each month `m` generates `numJobs(m)` jobs, each producing
  `avgJobSize × (1 + variation(m))` of revenue.
- `numJobs(m)` is a uniform integer draw on `[minJobsPerMonth, maxJobsPerMonth]`.
- `variation(m)` is a uniform draw on `[−revenueVariation, +revenueVariation]`.
- **CHANGE vs v2**: `numJobs` and `variation` draw from **independent** PRNG
  calls. In v2 the interactive simulator shared one draw, making them
  perfectly correlated within a month.
- **CHANGE vs v2**: PRNG is `mulberry32`, not `Math.sin`. Seed 0 is no longer
  degenerate.

---

## 3. Collections (cash receipts)

For revenue `R(m)` booked in month `m`, cash is received as:

| Share | Received in |
|------:|:------------|
| 20%   | month `m`     |
| 40%   | month `m+1`   |
| 40%   | month `m+2`   |

- Total receipts equal total revenue across the full collection horizon.
- Revenue booked in the last 2 months of the simulation has uncollected
  tranches that fall outside the horizon. These are reported as
  `endingAccountsReceivable` on the final month and are **not** counted as cash.
- **OPEN-A**: the 20/40/40 split is hard-coded today. Should it be configurable
  on the Model tab (e.g. for businesses with different invoicing terms)?
  Default proposal: leave hard-coded for v1, add a setting in v2.

---

## 4. Operating expenses

Three buckets, all configurable per row (`name`, `amount`, `enabled`,
optional `months`):

- **Critical OpEx** — payroll, rent, insurance, etc. Each row can be flagged
  `useFloat` (see §6). Recurring by default; setting `months` restricts to
  specific 1-indexed months.
- **Flexible OpEx** — marketing, software, discretionary. Recurring; no
  per-month restriction, no float flag.
- **One-time expenses** — must specify the month(s) charged.
  Each can be flagged `useFloat`.

### 4.1 Owner draw

- **CHANGE vs v2**: Owner draw is now an **input** — `ownerDrawTarget` (monthly
  dollar amount) — that is **treated as a fixed monthly cash expense** in the
  simulation. Default $5,000/mo (matches the Excel "Owner draw / salary" row).
- If you want to see "could I take a bigger draw?", run the simulation with
  the larger target and check whether `cashShortage` events appear. Owner
  draw is no longer a derived/computed quantity.
- **OPEN-B**: Do you also want a *secondary* "discretionary draw" output that
  reports "extra cash available at month-end after every other obligation is
  met"? It's a useful planning number but distinct from the input target.
  Default proposal: yes, report as `monthEndCashSurplus` on each MonthResult
  (purely informational; doesn't affect simulation). ANSWER (YES)

---

## 5. Debts

Two types:

### 5.1 Fixed-payment debt (term loan, equipment loan)

For each month:
1. `interest = balance × (apr / 100) / 12`
2. `principalPaid = max(0, payment − interest)`
3. `balanceNext = max(0, balance − principalPaid)`
4. Cash decreases by `min(payment, balance + interest)` — i.e. the final
   payment doesn't overshoot the remaining balance.
   - **CHANGE vs v2**: v2 always deducted the full `payment` even after the
     debt was paid off, drifting `cash` slightly low.

### 5.2 Line of credit (LOC)

Each LOC has `limit`, `apr`, and `minPaymentPct`. For each month:
1. `interest = balance × (apr / 100) / 12`
2. `minPayment = balance × (minPaymentPct / 100)`
3. `principalPaid = max(0, minPayment − interest)`
4. `balanceNext = max(0, balance − principalPaid)`
5. Cash decreases by `minPayment`.

LOC balances can grow via:
- Shortage cover draws (§7)
- Float strategy charges (§6)

LOC balances can shrink via:
- Min payments above
- Surplus paydown (§8)
- Float strategy transfers (§6) — moves balance, doesn't reduce total debt

---

## 6. Float strategy

The float strategy lets you defer paying certain expenses using a 90-day
LOC-to-LOC chain. It has three knobs: `primaryLocId`, `secondaryLocId`,
`transferMonth`, `dueMonth`. Default: charge to primary, transfer to
secondary in month 2, settle in month 3.

### 6.1 Float charges *(CHANGE vs v2)*

- **v2 bug**: float-routed expenses were charged to the primary LOC **only
  in month 0**, then in months 1+ they vanished entirely from the model.
- **New rule**: in every month, **every enabled expense flagged `useFloat`
  that triggers that month** is added to the primary LOC balance (instead
  of deducting from cash).
- This means a recurring "Payroll: $6,800 useFloat" charges $6,800 to the
  primary LOC every month.

### 6.2 Float transfer

- In `transferMonth`, after the month's float charges are applied, transfer
  `min(primaryLOC.balance, secondaryLOC.availableHeadroom)` from primary to
  secondary. Reduces primary balance, increases secondary balance.
- If `secondaryLOC` has no headroom, no transfer happens; emit a warning event.

### 6.3 Float "due" — does it actually settle?

- **v2 bug**: "due" was a notification only. No cash moved. The floated
  balance carried the entire 18-month simulation, accruing interest, and
  because the surplus-paydown rule prioritizes high APR, the lowest-APR
  secondary LOC was paid down last.
- **New rule (OPEN-C — pick one)**:

  **(C-1) Aggressive settlement.** At `dueMonth`, pay off the full
  secondary-LOC balance from cash. If insufficient cash, draw the
  remainder from other LOCs (cheapest APR first); if still short,
  emit a `float_due_unpaid` shortage event but do NOT auto-roll.
  Default proposal — most consistent with "due means due."

  **(C-2) Priority paydown.** At `dueMonth`, the secondary LOC moves
  to the **top** of the surplus-paydown sort for the remainder of the
  simulation, regardless of APR. The full balance gets paid down as
  cash allows. Softer, doesn't trigger artificial shortages.

  **(C-3) Notification only (current behavior).** Reject — the v2 bug.

---

## 7. Shortage handling (LOC draws to cover cash needs)

Computed once per month, after expenses + debt payments + float charges:
1. `cashNeeded = nonFloatCritical + flexibleOpex + nonFloatOneTime + ownerDrawTarget + debtPayments`
2. If `cash ≥ cashNeeded`, deduct and continue to surplus (§8).
3. Otherwise, `shortage = cashNeeded − cash`. Draw from available LOCs
   sorted by **ascending APR** (cheapest first), up to each LOC's headroom.
4. If LOCs cover the full shortage: `cash = 0`. Emit a `loc_draw` event
   for each LOC tapped.
5. If LOCs cannot cover the full shortage: `cash = 0`, `cashShortage =
   uncoveredAmount`. Emit a `shortage` event with `critical: true`.
6. **CHANGE vs v2**: `cashShortage` is initialized to `0` on every month,
   never `undefined`.

---

## 8. Surplus paydown

After expenses are paid (when there's no shortage):
1. `surplus = remainingCash × surplusPaydownFraction` (default 0.5).
2. If `surplus < surplusPaydownFloor` (default $500), skip (avoid noise).
3. Sort debts by **descending APR** (most expensive first), with the
   floated secondary LOC promoted to the top from `dueMonth` onward if
   rule C-2 is selected.
4. For each debt: pay `min(surplus, balance)`, decrement cash, advance to
   the next debt until `surplus = 0`.
5. **OPEN-D**: `surplusPaydownFraction` (currently 0.5 hard-coded) — leave
   as a settings knob? Default proposal: yes, expose on the Model tab.

---

## 9. Profit, cash, and reporting

Three different numbers, all reported on each `MonthResult`:

| Metric | Formula | Interpretation |
|---|---|---|
| `operatingProfit` | `collections − allOpex − interest − ownerDraw` | Accrual-style: what the business *earned* this month |
| `cumulativeOperatingProfit` | running sum of above | "Earnings since month 1" |
| `cumulativeNetCashChange` | `cash(t) − startingCash` | "How much more cash do I have than I started with?" (real cash) |

- **CHANGE vs v2**: v2's "Cumulative Profit" mixed accrual basis (used
  interest, not principal) with displays alongside cash-basis numbers
  without labeling. v2's `ownerDraw = max(0, actualProfit − totalDebt)`
  is removed; that formula is dimensionally incoherent.
- Principal repayment is **not** an expense — it's a reduction in
  liabilities, not a cost. Interest **is** an expense.

---

## 10. Monte Carlo

- Run `N` simulations (default 100) with PRNG seeds `1, 2, …, N`. Seed 0
  is reserved for the deterministic default-view simulation.
- For each month, report `p10 / p50 / p90` percentiles for cash and total
  debt **for the marginal distribution** (purely descriptive bands).
- **CHANGE vs v2**: "scenarios" (p10 / p50 / p90 traces) are now **whole
  simulation runs**, not independent percentile slices. To pick the p10
  scenario:
  1. Rank all `N` runs by **final cash position** (ascending).
  2. The p10 scenario is the run at index `floor(0.10 × N)`.
  3. Report **all** of that run's per-month data — debt breakdown,
     events, everything. It traces a coherent path.
- Median (p50): `floor(0.5 × N)`. For `N=100`, that's the 51st sorted
  value. (True median would average indices 49 and 50; the floor variant
  is conventional and acceptable here.)
- Histogram bins: include the maximum value in the last bin
  (`v >= binStart && v <= binEnd` for the final bin; v2 used `<` and
  dropped the max).
- **OPEN-E**: rank by final cash, by `cash − totalDebt` (net position), or
  by some other metric? Default proposal: net position (`cash − totalDebt`)
  — captures "how healthy is the business" better than cash alone. AGREED. cash-totalDebt is the right answer.

---

## 11. Randomness

- One `Rng` instance per simulation. Seeded from `mulberry32(seed)`.
- The order of PRNG draws inside `simulate()` is fixed and documented
  in code, so reseeding produces identical output. This is required
  for tests and for reproducible Monte Carlo runs.
- Per-month draw order: `numJobs`, then `variation`. No other random
  decisions (collections, expenses, debt math are deterministic given
  revenue).

---

## 12. Excel adapter mapping (forward reference to milestone 4)

The Excel `Heartland_Budget_Model_v1.2.xlsx` is mapped into `Inputs` as:

| Excel | Inputs field | Notes |
|---|---|---|
| `1. Overhead` row "Office / shop rent" | criticalOpex item "Rent" | one-to-one |
| `1. Overhead` row "Property / liability insurance" | criticalOpex item "Insurance" | sum with workers comp |
| `1. Overhead` row "Marketing & advertising" | flexibleOpex item "Marketing" |  |
| `1. Overhead` row "Software (CRM, accounting, etc.)" | flexibleOpex item "Software" |  |
| `1. Overhead` row "Owner draw / salary" | `ownerDrawTarget` | extracted, NOT also added as expense |
| `1. Overhead` row "Debt service (loans not on Investments tab)" | flexibleOpex item "Debt service" OR ignored | **OPEN-F** |
| `2. Labor` "Total monthly labor cost" | criticalOpex item "Payroll" | aggregated; per-tech detail lost |
| `3. Equipment` "EQUIPMENT TOTALS / Mo Profit" | informational only | not modeled as cash flow |
| `4. Investments` rows with "Financed" + Monthly Loan/Dep | debt entries (type `fixed`) | one per financed row |
| `5. Packaged Items` | informational only | not modeled |
| `6. DASHBOARD` "TOTAL MONTHLY REVENUE" | derives `avgJobSize × midpoint(min,max)` | back-solved |

- **OPEN-F**: The Excel has a $3,800/mo "Debt service" line in overhead. The
  app has explicit debts with their own payments. Pulling both would
  double-count. Default proposal: import as a comment/note only, do NOT
  add to expenses or debts; let the user decide how to split.
- **OPEN-G**: The Excel models labor at a per-tech level (wage × hours ×
  billable %). The app aggregates to "Payroll: $X/mo". The richer per-tech
  view is lost on import. Acceptable trade-off, or do you want it preserved
  (which would require redesigning the app's labor model)? Default
  proposal: aggregate for v1, revisit if you find yourself wanting it. PRESERVE THE RICHER VIEW.

---

## Open items — summary

You need to sign off on these before milestone 3 starts:

- **OPEN-A** — Make 20/40/40 collections schedule configurable? *Proposed: no for v1.* YES.
- **OPEN-B** — Report `monthEndCashSurplus` alongside fixed owner-draw target? *Proposed: yes.* YES
- **OPEN-C** — Float "due" behavior. *Proposed: C-1 (aggressive settlement).* YES
- **OPEN-D** — Surplus paydown fraction configurable? *Proposed: yes (default 0.5).* YES
- **OPEN-E** — Monte Carlo scenario ranking metric. *Proposed: net position (`cash − totalDebt`).* YES
- **OPEN-F** — Excel "Debt service $3,800" line. *Proposed: import as note only.* YES
- **OPEN-G** — Per-tech labor detail preservation. *Proposed: aggregate to "Payroll".* YES

Tell me which proposals you accept and which you want changed.
