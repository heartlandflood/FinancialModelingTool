// rules §12 — Excel adapter mapping
// Reads the actual Heartland_Budget_Model_v1.2.xlsx from examples/.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';
import { importExcel } from '../src/excel/adapter';

function loadExcel() {
  const path = join(process.cwd(), 'examples', 'Heartland_Budget_Model_v1.2.xlsx');
  const buf = readFileSync(path);
  const ab = buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);
  return importExcel(ab as ArrayBuffer, 'Heartland_Budget_Model_v1.2.xlsx');
}

describe('rules §12: Excel adapter — Heartland_Budget_Model_v1.2.xlsx', () => {
  it('produces a sane result with no missing critical sheets', () => {
    const r = loadExcel();
    expect(r.inputs).toBeDefined();
    // The four sheets we read from must all exist.
    for (const w of r.warnings) {
      expect(w).not.toMatch(/^Sheet not found/);
    }
  });

  it('extracts owner draw target ($5,000/mo from overhead)', () => {
    const r = loadExcel();
    expect(r.inputs.ownerDrawTarget).toBe(5000);
  });

  it('extracts overhead expenses into critical/flexible buckets', () => {
    const r = loadExcel();
    const flexNames = r.inputs.flexibleOpex!.map((e) => e.name);
    const critNames = r.inputs.criticalOpex!.map((e) => e.name);

    // Marketing $5000 should be flexible.
    const marketing = r.inputs.flexibleOpex!.find((e) => e.name === 'Marketing');
    expect(marketing?.amount).toBe(5000);

    // Software $869 should be flexible.
    const software = r.inputs.flexibleOpex!.find((e) => e.name === 'Software');
    expect(software?.amount).toBe(869);

    // Insurance $375 should be critical.
    const ins = r.inputs.criticalOpex!.find((e) => e.name === 'Insurance — GL/property');
    expect(ins?.amount).toBe(375);

    // Owner draw must NOT appear as an expense (it's extracted as ownerDrawTarget).
    expect(flexNames).not.toContain('Owner draw / salary');
    expect(critNames).not.toContain('Owner draw / salary');
  });

  it('imports total labor cost as a single "Payroll" critical expense', () => {
    const r = loadExcel();
    const payroll = r.inputs.criticalOpex!.find((e) =>
      e.name.toLowerCase().startsWith('payroll'),
    );
    expect(payroll).toBeDefined();
    // The Excel labor sheet sums to ~$20,378.53.
    expect(payroll!.amount).toBeCloseTo(20378.53, 1);
  });

  it('warns about (and does NOT import) the Excel "Debt service" overhead line', () => {
    const r = loadExcel();
    const debtServiceWarning = r.warnings.find((w) =>
      w.includes('Debt service') && w.includes('NOT imported'),
    );
    expect(debtServiceWarning).toBeDefined();

    const debtSvcAsExpense =
      r.inputs.flexibleOpex!.find((e) => e.name.toLowerCase().includes('debt')) ||
      r.inputs.criticalOpex!.find((e) => e.name.toLowerCase().includes('debt'));
    expect(debtSvcAsExpense).toBeUndefined();
  });

  it('does not import zero-amount rows', () => {
    const r = loadExcel();
    // The Excel's "Office / shop rent" is $0 in the workbook — should be skipped.
    const rent = r.inputs.criticalOpex!.find((e) => e.name === 'Rent');
    expect(rent).toBeUndefined();
  });

  it('imports financed investments as fixed-payment debts', () => {
    // The default v1.2 workbook has financed rows but all $0 — so debts should
    // be empty. This validates the "skip zero-cost rows" branch.
    const r = loadExcel();
    expect(r.inputs.debts).toEqual([]);
  });

  it('imports the dashboard revenue total into avgJobSize', () => {
    const r = loadExcel();
    // The dashboard says $57,584/mo. Imported as deterministic (1 job × that amount).
    expect(r.inputs.config!.avgJobSize).toBeCloseTo(57584, 0);
    expect(r.inputs.config!.minJobsPerMonth).toBe(1);
    expect(r.inputs.config!.maxJobsPerMonth).toBe(1);
    // Should emit a warning explaining the deterministic substitution.
    expect(r.warnings.some((w) => w.includes('deterministic'))).toBe(true);
  });

  it('records source metadata', () => {
    const r = loadExcel();
    expect(r.source.fileName).toBe('Heartland_Budget_Model_v1.2.xlsx');
    expect(new Date(r.source.importedAt).toString()).not.toBe('Invalid Date');
  });

  it('extracts per-tech labor roster from the Labor sheet', () => {
    const r = loadExcel();
    expect(r.laborRoster.length).toBeGreaterThan(0);

    // The v1.2 workbook has these tech rows.
    const names = r.laborRoster.map((t) => t.name);
    expect(names).toEqual(expect.arrayContaining(['Tech 1 — Lead', 'Tech 2 — Mid']));

    // Tech 1 — Lead should have a loaded monthly cost matching the workbook.
    const lead = r.laborRoster.find((t) => t.name === 'Tech 1 — Lead')!;
    expect(lead.loadedMonthlyCost).toBeCloseTo(6343.51, 1);
    expect(lead.wagePerHour).toBe(30);

    // Roster aggregate should reconcile (within rounding) to the imported
    // "Payroll" critical-OpEx amount.
    const rosterTotal = r.laborRoster.reduce((s, t) => s + t.loadedMonthlyCost, 0);
    const payroll = r.inputs.criticalOpex!.find((e) => e.name.toLowerCase().startsWith('payroll'))!;
    expect(rosterTotal).toBeCloseTo(payroll.amount, 1);
  });
});
