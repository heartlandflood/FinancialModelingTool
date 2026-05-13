// App shell: thin brand strip + sticky header (logo + tabs + Excel actions) +
// content area + footer. Editorial mid-century brand expression.

import type { ReactNode } from 'react';
import { FileActions } from './FileActions';

export type TabKey = 'overview' | 'inputs' | 'scenarios';

const TABS: { key: TabKey; label: string }[] = [
  { key: 'overview',  label: 'Overview' },
  { key: 'inputs',    label: 'Inputs' },
  { key: 'scenarios', label: 'Scenarios' },
];

export function Layout({
  tab,
  onTab,
  onImport,
  onUseTemplate,
  onTour,
  children,
}: {
  tab: TabKey;
  onTab: (t: TabKey) => void;
  onImport: (file: File) => void;
  onUseTemplate: () => void;
  onTour: () => void;
  children: ReactNode;
}) {
  return (
    <div className="app">
      <div className="brand-strip" />

      <header className="header">
        <div className="header-inner">
          <div className="brand">
            <img src="/logo.png" alt="Heartland Restoration" className="brand-mark" />
            <div className="brand-text">
              <span className="eyebrow">Heartland Restoration</span>
              <span className="wordmark">Cash Flow <em>Pro</em></span>
            </div>
          </div>

          <nav className="tabnav">
            {TABS.map((t) => (
              <button
                key={t.key}
                className={`tab ${tab === t.key ? 'is-active' : ''}`}
                onClick={() => onTab(t.key)}
              >
                {t.label}
              </button>
            ))}
          </nav>

          <div className="header-actions">
            <button
              className="help-btn"
              onClick={onTour}
              aria-label="Take the tour"
              title="Take the tour"
            >
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                <circle cx="7" cy="7" r="5.6" stroke="currentColor" strokeWidth="1.3" />
                <path
                  d="M5.4 5.6c0-.9.7-1.6 1.6-1.6s1.6.7 1.6 1.6c0 .7-.4 1.1-1 1.4-.4.2-.6.5-.6.9v.2M7 10.1v.05"
                  stroke="currentColor"
                  strokeWidth="1.3"
                  strokeLinecap="round"
                />
              </svg>
            </button>
            <FileActions onImport={onImport} onUseTemplate={onUseTemplate} />
          </div>
        </div>
      </header>

      <main className="main">{children}</main>

      <footer className="footer">
        Built for restoration operators. Numbers don't lie — but they do <em>round</em>.
      </footer>
    </div>
  );
}
