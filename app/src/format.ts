// Currency / number formatting helpers shared across the UI.

const usd = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
});

const usdSign = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
  signDisplay: 'exceptZero',
});

const numFmt = new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 });
const num1 = new Intl.NumberFormat('en-US', { maximumFractionDigits: 1, minimumFractionDigits: 1 });

export function fmt(v: number | undefined | null): string {
  if (v == null || Number.isNaN(v)) return '—';
  return usd.format(v);
}

export function fmtSigned(v: number | undefined | null): string {
  if (v == null || Number.isNaN(v)) return '—';
  return usdSign.format(v);
}

export function fmtCompact(v: number | undefined | null): string {
  if (v == null || Number.isNaN(v)) return '—';
  const abs = Math.abs(v);
  if (abs >= 1_000_000) return `${num1.format(v / 1_000_000)}M`;
  if (abs >= 1_000) return `${Math.round(v / 1000)}K`;
  return numFmt.format(v);
}

export function fmtPct(v: number, digits = 1): string {
  return (v * 100).toFixed(digits) + '%';
}

export function fmtNum(v: number): string {
  return numFmt.format(v);
}
