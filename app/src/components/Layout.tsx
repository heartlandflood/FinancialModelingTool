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
  children,
}: {
  tab: TabKey;
  onTab: (t: TabKey) => void;
  onImport: (file: File) => void;
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
            <FileActions onImport={onImport} />
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
