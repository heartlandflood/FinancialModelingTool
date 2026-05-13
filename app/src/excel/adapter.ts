// Reads Heartland_Budget_Model_v*.xlsx and produces a partial Inputs object.
// Rules: looks up rows by LABEL in column B; values in column C. This means
// users can add/reorder rows in the spreadsheet without breaking the import.
//
// Mapping is defined in docs/rules.md §12. Any row we expect but don't find,
// or any imported value that needs clarification, becomes a warning.

import * as XLSX from 'xlsx';
import type { Inputs, Debt, Expense } from '../engine/types';

export interface TechRow {
  name: string;
  wagePerHour: number | null;
  hoursPerWeek: number | null;
  paidHoursPerMonth: number | null;
  billableTimePct: number | null;
  billableHoursPerMonth: number | null;
  benefitsPerMonth: number | null;
  loadedMonthlyCost: number;
  costPerBillableHour: number | null;
  notes: string | null;
}

export interface ExcelImportResult {
  inputs: Partial<Inputs>;
  laborRoster: TechRow[];
  warnings: string[];
  source: {
    fileName: string;
    importedAt: string;  // ISO timestamp
  };
}

interface SheetRow {
  rowNum: number;                       // 1-indexed
  cells: (string | number | null)[];    // 0-indexed; cells[0] = column A
}

export function importExcel(
  file: ArrayBuffer | Uint8Array,
  fileName: string,
): ExcelImportResult {
  const wb = XLSX.read(file, { type: 'array' });
  const warnings: string[] = [];

  const sheetRows = (sheetName: string): SheetRow[] => {
    const ws = wb.Sheets[sheetName];
    if (!ws) {
      warnings.push(`Sheet not found: "${sheetName}"`);
      return [];
    }
    const json = XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1, defval: null });
    return json.map((cells, i) => ({
      rowNum: i + 1,
      cells: cells as (string | number | null)[],
    }));
  };

  const findRow = (
    rows: SheetRow[],
    labelPrefix: string,
    labelCol = 1,
  ): SheetRow | null => {
    for (const row of rows) {
      const cell = row.cells[labelCol];
      if (typeof cell === 'string' && cell.trim().startsWith(labelPrefix)) return row;
    }
    return null;
  };

  const numAt = (row: SheetRow | null, col: number): number | null => {
    if (!row) return null;
    const v = row.cells[col];
    return typeof v === 'number' ? v : null;
  };

  // ─── Overhead → criticalOpex / flexibleOpex / ownerDrawTarget ──────────────
  const overheadRows = sheetRows('1. Overhead');

  type Rule =
    | { label: string; bucket: 'critical' | 'flexible'; name: string }
    | { label: string; bucket: 'ownerDraw' }
    | { label: string; bucket: 'note' };

  const overheadRules: Rule[] = [
    { label: 'Office / shop rent',                    bucket: 'critical', name: 'Rent' },
    { label: 'Property / liability insurance',        bucket: 'critical', name: 'Insurance — GL/property' },
    { label: 'Workers comp insurance',                bucket: 'critical', name: 'Insurance — workers comp' },
    { label: 'Software',                               bucket: 'flexible', name: 'Software' },
    { label: 'Phones & internet',                      bucket: 'flexible', name: 'Phones & internet' },
    { label: 'Marketing & advertising',                bucket: 'flexible', name: 'Marketing' },
    { label: 'Office utilities',                       bucket: 'critical', name: 'Utilities' },
    { label: 'Accounting / bookkeeping',               bucket: 'flexible', name: 'Accounting' },
    { label: 'Legal / professional fees',              bucket: 'flexible', name: 'Legal' },
    { label: 'Office supplies',                        bucket: 'flexible', name: 'Office supplies' },
    { label: 'Bank / merchant fees',                   bucket: 'flexible', name: 'Bank fees' },
    { label: 'Subscriptions & memberships',            bucket: 'flexible', name: 'Subscriptions' },
    { label: 'Owner draw / salary',                    bucket: 'ownerDraw' },
    { label: 'Debt service (loans not on Investments', bucket: 'note' },
    { label: 'Training & certifications',              bucket: 'flexible', name: 'Training' },
  ];

  const criticalOpex: Expense[] = [];
  const flexibleOpex: Expense[] = [];
  let ownerDrawTarget = 0;
  let nextExpId = 1;

  for (const rule of overheadRules) {
    const row = findRow(overheadRows, rule.label);
    const amount = numAt(row, 2);
    if (!row) {
      warnings.push(`Overhead row not found: "${rule.label}"`);
      continue;
    }
    if (amount === null || amount === 0) continue;

    if (rule.bucket === 'ownerDraw') {
      ownerDrawTarget = amount;
    } else if (rule.bucket === 'note') {
      warnings.push(
        `Excel has "Debt service (loans not on Investments tab)" $${amount}/mo — ` +
        `NOT imported. Configure debts explicitly on the Debts tab to avoid double-counting.`,
      );
    } else if (rule.bucket === 'critical') {
      criticalOpex.push({
        id: nextExpId++, name: rule.name, amount,
        months: [], useFloat: false, enabled: true,
      });
    } else if (rule.bucket === 'flexible') {
      flexibleOpex.push({
        id: nextExpId++, name: rule.name, amount,
        months: [], useFloat: false, enabled: true,
      });
    }
  }

  // "Other 1..5" free-form overhead lines
  for (let i = 1; i <= 5; i++) {
    const row = findRow(overheadRows, `Other ${i}`);
    const amount = numAt(row, 2);
    if (amount !== null && amount > 0) {
      flexibleOpex.push({
        id: nextExpId++, name: `Other ${i}`, amount,
        months: [], useFloat: false, enabled: true,
      });
    }
  }

  // ─── Labor → criticalOpex "Payroll (all techs)" + roster reference ────────
  const laborRows = sheetRows('2. Labor');
  const totalLaborRow = findRow(laborRows, 'Total monthly labor cost');
  const totalLabor = numAt(totalLaborRow, 2);
  if (totalLabor !== null && totalLabor > 0) {
    criticalOpex.push({
      id: nextExpId++,
      name: 'Payroll (all techs, from Labor sheet)',
      amount: totalLabor,
      months: [],
      useFloat: false,
      enabled: true,
    });
  } else {
    warnings.push(
      'Labor sheet: "Total monthly labor cost" not found or zero. ' +
      'No payroll expense imported.',
    );
  }

  // Extract the per-tech roster as a reference (not as model inputs — the
  // engine sees one aggregated payroll line). Used by the UI to show
  // per-person annual cost on the Overview tab.
  const laborRoster = extractLaborRoster(laborRows);

  // ─── Investments → debts (financed rows only) ─────────────────────────────
  const investRows = sheetRows('4. Investments');
  const debts: Debt[] = [];
  let nextDebtId = 1;

  for (const row of investRows) {
    const name = row.cells[1];
    const type = row.cells[2];
    const totalCost = row.cells[3];
    const downPayment = row.cells[4];
    const apr = row.cells[5];
    const monthlyPayment = row.cells[8];

    if (typeof name !== 'string' || !name.trim()) continue;
    // Skip headers and totals.
    if (name.startsWith('Investment Name') || name.startsWith('INVESTMENTS')) continue;
    if (type !== 'Financed') continue;
    if (typeof totalCost !== 'number' || totalCost <= 0) continue;
    if (typeof monthlyPayment !== 'number' || monthlyPayment <= 0) {
      warnings.push(
        `Investment "${name.trim()}" is marked Financed but has no monthly payment — skipped.`,
      );
      continue;
    }

    const down = typeof downPayment === 'number' ? downPayment : 0;
    const principal = totalCost - down;
    debts.push({
      id: nextDebtId++,
      name: name.trim(),
      balance: principal,
      payment: monthlyPayment,
      apr: typeof apr === 'number' ? apr : 0,
      type: 'fixed',
    });
  }

  // ─── Revenue (back-solved from dashboard total) ───────────────────────────
  // The Excel models revenue as hours × rate + equipment + packages. The app
  // models revenue as avgJobSize × jobs/month. We import as DETERMINISTIC:
  // min=max=1 job, avgJobSize = dashboard total. Variation kept at 15% for
  // realistic month-to-month noise around the imported mean.
  const dashRows = sheetRows('6. DASHBOARD');
  // Dashboard has a two-column layout: costs on the left (label B / value C),
  // revenue on the right (label E / value F). Look for the label in col E.
  const totalRevRow = findRow(dashRows, 'TOTAL MONTHLY REVENUE', 4);
  const totalRev = numAt(totalRevRow, 5);

  let avgJobSize = 6000;
  let minJobs = 1;
  let maxJobs = 1;
  if (totalRev !== null && totalRev > 0) {
    avgJobSize = totalRev;
    warnings.push(
      `Revenue imported as $${Math.round(totalRev).toLocaleString()}/mo deterministic ` +
      `(from Dashboard TOTAL MONTHLY REVENUE). To model volatility around this mean, ` +
      `set min/max jobs and avgJobSize on the Model tab.`,
    );
  } else {
    warnings.push(
      'Dashboard: TOTAL MONTHLY REVENUE not found. Using $6,000 avgJobSize × ' +
      '[1,7] jobs default — revenue assumptions are NOT from your Excel.',
    );
    avgJobSize = 6000;
    minJobs = 1;
    maxJobs = 7;
  }

  return {
    inputs: {
      config: {
        startingCash: 47000,  // not in Excel; reasonable default, user can edit
        months: 18,
        avgJobSize,
        minJobsPerMonth: minJobs,
        maxJobsPerMonth: maxJobs,
        revenueVariation: 0.15,
        surplusPaydownFraction: 0.5,
        surplusPaydownFloor: 500,
      },
      criticalOpex,
      flexibleOpex,
      oneTimeExpenses: [],
      debts,
      ownerDrawTarget,
    },
    laborRoster,
    warnings,
    source: {
      fileName,
      importedAt: new Date().toISOString(),
    },
  };
}

// ─── Labor roster extraction ────────────────────────────────────────────────
// Layout on the Labor sheet (col indices, 0-based):
//   B(1) Name · C(2) Wage $/hr · D(3) Hrs/wk · E(4) Paid hrs/mo
//   F(5) Billable Time % · G(6) Billable hrs/mo · H(7) Benefits $/mo
//   I(8) Loaded $/mo · J(9) Cost / billable hr · K(10) Notes
// The roster sits between the "Tech Name" header row and "ROSTER TOTALS" row.
function extractLaborRoster(
  rows: { rowNum: number; cells: (string | number | null)[] }[],
): TechRow[] {
  // Locate the "Tech Name" header to anchor where rows start.
  const headerIdx = rows.findIndex(
    (r) => typeof r.cells[1] === 'string' && r.cells[1].trim().toLowerCase() === 'tech name',
  );
  if (headerIdx === -1) return [];

  const result: TechRow[] = [];
  for (let i = headerIdx + 1; i < rows.length; i++) {
    const cells = rows[i]!.cells;
    const name = cells[1];
    if (typeof name !== 'string') continue;
    const trimmed = name.trim();
    if (trimmed === '') continue;
    // Stop at the totals row or any clearly non-tech row.
    if (/^(ROSTER TOTALS|TEAM SUMMARY|Number of techs|Total monthly|Weighted)/i.test(trimmed)) break;

    const loaded = cells[8];
    if (typeof loaded !== 'number' || loaded <= 0) continue;

    result.push({
      name: trimmed,
      wagePerHour:          numOrNull(cells[2]),
      hoursPerWeek:         numOrNull(cells[3]),
      paidHoursPerMonth:    numOrNull(cells[4]),
      billableTimePct:      numOrNull(cells[5]),
      billableHoursPerMonth:numOrNull(cells[6]),
      benefitsPerMonth:     numOrNull(cells[7]),
      loadedMonthlyCost:    loaded,
      costPerBillableHour:  numOrNull(cells[9]),
      notes:                typeof cells[10] === 'string' ? (cells[10] as string).trim() || null : null,
    });
  }
  return result;
}

function numOrNull(v: unknown): number | null {
  return typeof v === 'number' ? v : null;
}
