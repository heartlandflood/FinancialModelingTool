// One-off CLI: print the 18-month projection for the legacy v2 default inputs.
// Used to eyeball the new engine's output vs the spreadsheet / vs v2's UI.
// Run: npx vitest run tools/projection.ts   (or wire as an npm script)

import { simulate } from '../src/engine/simulate';
import { mulberry32 } from '../src/engine/prng';
import { defaultInputs } from '../tests/fixtures';

const inputs = defaultInputs();
const results = simulate(inputs, mulberry32(42));

function pad(s: string | number, w: number, right = true): string {
  const str = typeof s === 'number' ? s.toFixed(0) : s;
  return right ? str.padStart(w) : str.padEnd(w);
}

function fmt(v: number): string {
  return v.toLocaleString('en-US', { maximumFractionDigits: 0 });
}

console.log('\nHeartland Cash Flow — 18-month projection (legacy v2 default inputs, seed 42)');
console.log('Float strategy: ENABLED   Owner draw: $5,000/mo\n');

console.log(
  pad('M', 4, false) +
  pad('Rev', 9) +
  pad('Coll', 9) +
  pad('Cash', 9) +
  pad('Debt', 9) +
  pad('Net', 10) +
  pad('Profit', 9) +
  pad('Events', 6, false),
);
console.log('─'.repeat(72));

for (const m of results) {
  const events = m.events
    .map((e) => e.type.replace('float_', 'f_').replace('_settled', '!'))
    .join(',');
  console.log(
    pad(m.month, 4, false) +
    pad(fmt(m.revenue), 9) +
    pad(fmt(m.collections), 9) +
    pad(fmt(m.cash), 9) +
    pad(fmt(m.totalDebt), 9) +
    pad(fmt(m.cash - m.totalDebt), 10) +
    pad(fmt(m.operatingProfit), 9) +
    '  ' + events,
  );
}

const last = results[results.length - 1]!;
console.log('\nFinal cash:        $' + fmt(last.cash));
console.log('Final total debt:  $' + fmt(last.totalDebt));
console.log('Final net position: $' + fmt(last.cash - last.totalDebt));
console.log('Cumulative op profit: $' + fmt(last.cumulativeOperatingProfit));
console.log('Cumulative net cash change: $' + fmt(last.cumulativeNetCashChange));
console.log('Ending A/R: $' + fmt(last.endingAccountsReceivable));

const shortages = results.filter((m) => m.cashShortage > 0);
if (shortages.length > 0) {
  console.log(`\n⚠ Cash shortages in months: ${shortages.map((m) => m.month).join(', ')}`);
  console.log(`   Total uncovered: $${fmt(shortages.reduce((s, m) => s + m.cashShortage, 0))}`);
} else {
  console.log('\n✓ No uncovered cash shortages over the horizon.');
}
