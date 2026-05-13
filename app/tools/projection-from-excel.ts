// Print the 18-month projection using the REAL Heartland_Budget_Model.
// Compares against the legacy v2 defaults so you can see what changed.

import { readFileSync } from 'fs';
import { join } from 'path';
import { simulate } from '../src/engine/simulate';
import { mulberry32 } from '../src/engine/prng';
import { importExcel } from '../src/excel/adapter';
import type { Inputs } from '../src/engine/types';

const xlsxPath = join(process.cwd(), 'examples', 'Heartland_Budget_Model_v1.2.xlsx');
const buf = readFileSync(xlsxPath);
const ab = buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);
const imp = importExcel(ab as ArrayBuffer, 'Heartland_Budget_Model_v1.2.xlsx');

console.log('\n=== Excel import warnings ===');
for (const w of imp.warnings) console.log(' • ' + w);

console.log('\n=== Imported inputs summary ===');
console.log('Starting cash:    $' + fmt(imp.inputs.config!.startingCash));
console.log('avgJobSize:       $' + fmt(imp.inputs.config!.avgJobSize) + ' (deterministic, 1 job/mo)');
console.log('Owner draw target: $' + fmt(imp.inputs.ownerDrawTarget!) + '/mo');
console.log('\nCritical OpEx:');
for (const e of imp.inputs.criticalOpex!) console.log(`  • ${e.name}: $${fmt(e.amount)}`);
console.log('Flexible OpEx:');
for (const e of imp.inputs.flexibleOpex!) console.log(`  • ${e.name}: $${fmt(e.amount)}`);
console.log('Debts:');
if (imp.inputs.debts!.length === 0) console.log('  (none imported — all financed investments are $0)');

// To run the engine we need a complete Inputs. Fill in app-only fields.
const inputs: Inputs = {
  ...(imp.inputs as Required<typeof imp.inputs>),
  config: imp.inputs.config!,
  criticalOpex: imp.inputs.criticalOpex!,
  flexibleOpex: imp.inputs.flexibleOpex!,
  oneTimeExpenses: imp.inputs.oneTimeExpenses ?? [],
  debts: imp.inputs.debts!,
  ownerDrawTarget: imp.inputs.ownerDrawTarget!,
  floatStrategy: {
    enabled: false,           // No float strategy by default with Excel import.
    primaryLocId: -1,
    secondaryLocId: -1,
    transferMonth: 0,
    dueMonth: 0,
  },
  revenueGoal: {
    enabled: false,
    annualTarget: imp.inputs.config!.avgJobSize * 12,
    targetProfitMargin: 0.25,
  },
  commission: {
    enabled: false,
    assigneeName: '',
    threshold: 5000,
    highRate: 0.12,
    lowRate: 0.07,
  },
};

console.log('\n=== 18-month projection (Excel inputs, seed 42) ===\n');
const results = simulate(inputs, mulberry32(42));

console.log(
  pad('M', 4, false) +
  pad('Rev', 10) +
  pad('Coll', 10) +
  pad('Critical', 10) +
  pad('Flex', 8) +
  pad('Cash', 10) +
  pad('Debt', 8) +
  pad('Profit', 10),
);
console.log('─'.repeat(74));

for (const m of results) {
  console.log(
    pad(m.month, 4, false) +
    pad(fmt(m.revenue), 10) +
    pad(fmt(m.collections), 10) +
    pad(fmt(m.criticalOpex), 10) +
    pad(fmt(m.flexibleOpex), 8) +
    pad(fmt(m.cash), 10) +
    pad(fmt(m.totalDebt), 8) +
    pad(fmt(m.operatingProfit), 10),
  );
}

const last = results[results.length - 1]!;
console.log('\n=== Summary at M18 ===');
console.log('Cash on hand:               $' + fmt(last.cash));
console.log('Total debt:                 $' + fmt(last.totalDebt));
console.log('Net position (cash − debt): $' + fmt(last.cash - last.totalDebt));
console.log('Cumulative operating profit: $' + fmt(last.cumulativeOperatingProfit));
console.log('Cumulative net cash change:  $' + fmt(last.cumulativeNetCashChange));
console.log('Ending accounts receivable:  $' + fmt(last.endingAccountsReceivable));

const shortages = results.filter((m) => m.cashShortage > 0);
if (shortages.length > 0) {
  console.log(`\n⚠ Cash shortages in months: ${shortages.map((m) => m.month).join(', ')}`);
  console.log(`   Total uncovered: $${fmt(shortages.reduce((s, m) => s + m.cashShortage, 0))}`);
} else {
  console.log('\n✓ No uncovered cash shortages over the horizon.');
}

function fmt(v: number): string {
  return v.toLocaleString('en-US', { maximumFractionDigits: 0 });
}

function pad(s: string | number, w: number, right = true): string {
  const str = typeof s === 'number' ? fmt(s) : s;
  return right ? str.padStart(w) : str.padEnd(w);
}
