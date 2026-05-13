// Small "?" affordance that toggles an inline explanation panel below a
// section heading. Designed to read like an editorial sidebar — not a
// generic SaaS tooltip. Click toggles; doesn't disappear on mouseout.

import { useState, useId, type ReactNode } from 'react';

export function InfoToggle({
  open,
  onToggle,
  size = 'sm',
  label = 'Show explanation',
}: {
  open: boolean;
  onToggle: () => void;
  size?: 'sm' | 'md';
  label?: string;
}) {
  return (
    <button
      type="button"
      className={`info-toggle ${size} ${open ? 'is-open' : ''}`}
      onClick={onToggle}
      aria-label={label}
      aria-expanded={open}
    >
      {open ? <CloseGlyph /> : <QuestionGlyph />}
    </button>
  );
}

// Inline explanation that expands below a section heading. Has a quiet
// italic intro line + body. Reads like a magazine pull-quote.
export function InfoPanel({
  intro,
  children,
}: {
  intro?: string;
  children: ReactNode;
}) {
  return (
    <div className="info-panel" role="region">
      {intro && <div className="info-panel-intro">{intro}</div>}
      <div className="info-panel-body">{children}</div>
    </div>
  );
}

// Convenience wrapper: keeps the toggle state internally so callers don't
// have to manage it. Use this when the explanation lives inline near the
// toggle.
export function InfoBlock({
  intro,
  children,
  label,
}: {
  intro?: string;
  children: ReactNode;
  label?: string;
}) {
  const [open, setOpen] = useState(false);
  const id = useId();
  return (
    <>
      <InfoToggle open={open} onToggle={() => setOpen((o) => !o)} label={label} />
      {open && (
        <div id={id}>
          <InfoPanel intro={intro}>{children}</InfoPanel>
        </div>
      )}
    </>
  );
}

function QuestionGlyph() {
  return (
    <svg width="11" height="11" viewBox="0 0 12 12" fill="none">
      <path
        d="M4.2 4.5c0-1 .8-1.8 1.8-1.8s1.8.8 1.8 1.8c0 .8-.5 1.2-1.1 1.5-.5.3-.7.6-.7 1.1v.3M6 8.9v.1"
        stroke="currentColor"
        strokeWidth="1.3"
        strokeLinecap="round"
      />
    </svg>
  );
}

function CloseGlyph() {
  return (
    <svg width="11" height="11" viewBox="0 0 12 12" fill="none">
      <path d="M3 3l6 6M9 3l-6 6" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
    </svg>
  );
}
