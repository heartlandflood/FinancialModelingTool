// Splash screen shown before the app loads. Editorial cover treatment:
// big serif headline, single input, single CTA. Brand-consistent.

import { useState } from 'react';
import { tryAuthenticate } from '../auth';

export function PasswordGate({ onSuccess }: { onSuccess: () => void }) {
  const [value, setValue] = useState('');
  const [error, setError] = useState(false);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (tryAuthenticate(value)) {
      onSuccess();
    } else {
      setError(true);
      setValue('');
    }
  };

  return (
    <div className="gate">
      <div className="gate-strip" />
      <div className="gate-content">
        <div className="gate-mark-row">
          <img src="/logo.png" alt="" className="gate-mark" />
          <div>
            <div className="gate-eyebrow">Heartland Restoration</div>
            <div className="gate-wordmark">Cash Flow <em>Pro</em></div>
          </div>
        </div>

        <h1 className="gate-headline">
          A private financial<br /><em>workspace.</em>
        </h1>

        <p className="gate-lede">
          Operator-only forecasting. Your data stays in your browser —
          nothing is uploaded, nothing is stored beyond this session.
        </p>

        <form onSubmit={submit} className="gate-form">
          <label className="gate-label" htmlFor="gate-pw">Access code</label>
          <input
            id="gate-pw"
            type="password"
            value={value}
            onChange={(e) => { setValue(e.target.value); setError(false); }}
            autoFocus
            autoComplete="off"
            className={`gate-input ${error ? 'is-error' : ''}`}
            placeholder="Enter password"
          />
          {error && <div className="gate-error">That code doesn't match. Try again.</div>}
          <button type="submit" className="btn primary gate-submit">
            Enter
          </button>
        </form>

        <div className="gate-foot">
          Private to Heartland Restoration. If you don't have the code, you
          shouldn't be here.
        </div>
      </div>
    </div>
  );
}
