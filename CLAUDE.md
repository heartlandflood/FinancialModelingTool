# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Repository layout

- **`app/`** — the Vite + React + TypeScript + Vitest project. This is the codebase. See `app/docs/rules.md` for the canonical specification of what the financial model does.
- **`Heartland_Budget_Model_v1.2.xlsx`** — the operator-facing budget template that users download, fill in, and re-upload to the app. A copy lives at `app/public/Heartland_Budget_Model_Template.xlsx` (served as a static asset) and `app/examples/` (used by the adapter tests).

## Working in `app/`

From `app/`:
- `npm install` — first time only (deps include `xlsx` for parsing the budget workbook).
- `npm run dev` — start Vite dev server on http://localhost:5173.
- `npm test` — run Vitest in watch mode.
- `npm run test:run` — single test pass (for CI / quick check).
- `npm run typecheck` — strict TypeScript check without emit.
- `npm run build` — type-check then produce a production bundle into `dist/`.
- `npx tsx tools/projection.ts` / `tools/projection-from-excel.ts` — CLI projection inspectors.

## Static assets in `public/`

- `public/logo.png` — Heartland brand mark, served at `/logo.png`.
- `public/Heartland_Budget_Model_Template.xlsx` — the operator download. The "Template" header button serves this file. Update it by copying a new workbook to that path.

## Design language

Editorial mid-century financial publication aesthetic:
- **Fraunces** (variable serif) for display, frequently in italics for emphasis. Pair italicized words with the brand orange for headline accents.
- **DM Sans** for body / UI text.
- **JetBrains Mono** for numerals — financial UIs need tabular alignment.
- Palette in `src/theme.ts` and `src/styles.css` `:root`: deep navy `#1E3A5F`, brand orange `#EB9939`, cream paper `#FAF6F0`. Positive `#2E9E5C`, negative `#C84545`.
- Sticky 4px gradient brand strip at the very top of every page.

## Architecture (target state)

- **`src/engine/`** is a pure module — no React, no DOM, no I/O, no `Date.now()` baked in. `simulate(inputs, rng)` is the only public entrypoint. All financial math lives here.
- **`src/excel/`** is the import adapter. Reads the budget workbook by **label**, not by index, so users adding rows or reordering doesn't break it.
- **`src/components/`** is presentation only — reads from app state, calls engine via state, renders charts. No financial logic.
- **`src/state/`** is the single store. Default inputs come from a JSON snapshot of the Excel; the "Import" button replaces them at runtime.
- **`tests/`** mirrors `src/`. Every rule in `docs/rules.md` has at least one test.

## Two non-negotiables

1. **`docs/rules.md` is the source of truth** for what the simulation does. If code and rules disagree, change the code. If you're tempted to change a rule because the code is hard to fit, write down the proposed change in rules.md and stop for review — don't change behavior silently.
2. **There is one simulation engine.** The legacy file had two parallel engines (`calculateSimulation` and `advanceMonth`) that drifted apart. The rebuild's "interactive simulator" tab calls `simulate()` one month at a time on the same code path as the static projection. Do not introduce a parallel engine.

## Deployment

The app is purely client-side — no server, no database, no persistence. State lives in React `useState` only; refreshing the page drops everything. Deploy by running `npm run build` and serving `app/dist/` from any static host (Vercel, Netlify, S3+CloudFront, plain nginx). The Excel template in `public/` becomes a static file at `/Heartland_Budget_Model_Template.xlsx`.
