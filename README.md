# Heartland Cash Flow

A purely client-side cash-flow forecasting tool for restoration contractors. Operators download an Excel template, fill in their own overhead, labor, debts, and revenue, then upload the workbook to see a month-by-month projection of cash, debt, and net position over the next 6–36 months. State lives in memory only — refreshing the page resets everything, so no data ever leaves the browser.

Live tool: deploy `app/dist/` to any static host (Vercel, Netlify, S3+CloudFront, plain nginx).

## What it does

- Imports the **Heartland Budget Model** workbook by label (resilient to row reordering).
- Runs an 18-month deterministic projection with collections lagged 20% / 40% / 40% over three months.
- Models fixed-payment debts (amortized) and lines of credit (interest-bearing with min-payment floors).
- Optional **90-day float strategy**: charge expenses to a primary LOC, transfer to a cheaper secondary LOC mid-stream, settle in cash on the due month.
- Monte Carlo: 100+ simulations across revenue volatility, with coherent p10 / p50 / p90 scenario traces (not independently sorted slices — see `app/docs/rules.md` §10).
- Editorial financial-publication design language — Fraunces serif italics for emphasis, JetBrains Mono for numerals, deep navy + brand orange + cream paper.

## Quick start

```bash
cd app
npm install
npm run dev          # http://localhost:5173
npm test             # 42 unit tests over the engine, adapter, and Monte Carlo
npm run build        # production bundle into app/dist/
```

## Architecture in one paragraph

`src/engine/` is a pure TypeScript module — no React, no DOM, no I/O. Its single public entrypoint, `simulate(inputs, rng)`, implements every financial rule documented in `app/docs/rules.md`. `src/excel/adapter.ts` reads `.xlsx` workbooks by label and produces a `Partial<Inputs>` for the engine. `src/components/` is presentation only — it reads from `useAppState()` and renders the three tabs (Overview, Inputs, Scenarios). `src/state/` is the single in-memory store. The engine is exercised by 42 unit tests in `tests/`; nothing else has tests because nothing else has logic.

See `app/docs/rules.md` for the canonical specification of the financial model. If code and rules disagree, the rules win.

## Operator flow

1. Open the deployed URL → empty Overview, defaults loaded.
2. Click **Template** in the header → downloads `Heartland_Budget_Model_Template.xlsx`.
3. Fill in your own overhead, labor, investments, dashboard totals.
4. Click **Import workbook** → drop the filled-in `.xlsx` → KPIs and chart update immediately.
5. Tune inputs on the **Inputs** tab if needed. Run stress tests on **Scenarios**.
6. Refresh = clean slate. No persistence, no backend, no Firebase.

## License

Proprietary — internal Heartland Restoration tool. All rights reserved.
