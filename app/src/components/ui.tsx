// Small set of reusable visual atoms. Lean on styles.css for the look.

import type { ReactNode, InputHTMLAttributes, ButtonHTMLAttributes } from 'react';

export function Button({
  variant = 'default',
  className = '',
  children,
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'default' | 'primary' | 'accent' | 'ghost' | 'danger';
}) {
  const variantClass = variant === 'default' ? '' : variant;
  return (
    <button className={`btn ${variantClass} ${className}`} {...rest}>
      {children}
    </button>
  );
}

export function Stat({
  label,
  value,
  sub,
  tone = 'default',
  delay = 0,
}: {
  label: string;
  value: ReactNode;
  sub?: ReactNode;
  tone?: 'default' | 'muted' | 'positive' | 'negative' | 'accent';
  delay?: 1 | 2 | 3 | 4 | 5 | 6 | 0;
}) {
  return (
    <div className={`kpi fade-in ${delay ? `d${delay}` : ''}`}>
      <div className="kpi-label">{label}</div>
      <div className={`kpi-value ${tone === 'default' ? '' : tone}`}>{value}</div>
      {sub && <div className="kpi-sub">{sub}</div>}
    </div>
  );
}

export function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <label className="field">
      <span className="field-label">{label}</span>
      {children}
      {hint && <span className="field-hint">{hint}</span>}
    </label>
  );
}

export function NumberInput({
  value,
  onChange,
  step = 1,
  min,
  ...rest
}: Omit<InputHTMLAttributes<HTMLInputElement>, 'onChange' | 'value' | 'type'> & {
  value: number;
  onChange: (v: number) => void;
  step?: number;
  min?: number;
}) {
  return (
    <input
      type="number"
      className="field-input"
      value={Number.isFinite(value) ? value : ''}
      step={step}
      min={min}
      onChange={(e) => {
        const parsed = parseFloat(e.target.value);
        onChange(Number.isFinite(parsed) ? parsed : 0);
      }}
      {...rest}
    />
  );
}

export function TextInput({
  value,
  onChange,
  ...rest
}: Omit<InputHTMLAttributes<HTMLInputElement>, 'onChange' | 'value' | 'type'> & {
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <input
      type="text"
      className="field-input text"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      {...rest}
    />
  );
}

export function Toggle({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
}) {
  return (
    <label className="toggle">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      <span>{label}</span>
    </label>
  );
}

export function Pill({
  tone,
  children,
}: {
  tone: 'blue' | 'orange' | 'positive' | 'negative' | 'muted';
  children: ReactNode;
}) {
  return <span className={`pill ${tone}`}>{children}</span>;
}

export function Section({
  title,
  titleEm,
  sub,
  children,
}: {
  title: string;
  titleEm?: string;
  sub?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="section">
      <div className="section-head">
        <h2 className="heading">
          {title}
          {titleEm && <> <em>{titleEm}</em></>}
        </h2>
        {sub && <div className="sub">{sub}</div>}
      </div>
      {children}
    </section>
  );
}
