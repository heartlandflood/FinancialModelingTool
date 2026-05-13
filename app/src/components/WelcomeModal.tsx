// First-visit welcome. Editorial single-column layout — feels like the
// opening page of a small financial publication. Dismisses to either the
// tour or directly into the app.

import { markWelcomeSeen } from '../auth';

export function WelcomeModal({
  onTour,
  onSkip,
}: {
  onTour: () => void;
  onSkip: () => void;
}) {
  const dismiss = (next: () => void) => () => {
    markWelcomeSeen();
    next();
  };

  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="welcome-title">
      <div className="modal welcome">
        <div className="welcome-eyebrow">
          <span className="welcome-eyebrow-rule" />
          A FIRST READ
        </div>

        <h1 id="welcome-title" className="welcome-title">
          Cash flow,<br /><em>made readable.</em>
        </h1>

        <div className="welcome-prose">
          <p>
            This is a month-by-month forecast of cash, debt, and operating profit
            for the next 6&nbsp;to&nbsp;36&nbsp;months of your restoration business.
            It runs entirely in your browser — your numbers never leave.
          </p>

          <hr className="welcome-rule" />

          <div className="welcome-step">
            <span className="welcome-step-num">01</span>
            <div>
              <strong>Load your data.</strong> Click <em>Use template</em> in the
              top right to pull from the bundled budget workbook. Or upload your
              own filled-in copy with <em>Import</em>.
            </div>
          </div>

          <div className="welcome-step">
            <span className="welcome-step-num">02</span>
            <div>
              <strong>Read the Overview.</strong> Four headline numbers, then a
              full breakdown of where the final cash position comes from —
              every dollar accounted for.
            </div>
          </div>

          <div className="welcome-step">
            <span className="welcome-step-num">03</span>
            <div>
              <strong>Tune any assumption.</strong> Inputs tab. Change a wage,
              add a debt, enable commission — the projection updates instantly.
            </div>
          </div>

          <div className="welcome-step">
            <span className="welcome-step-num">04</span>
            <div>
              <strong>Stress test.</strong> Scenarios tab. Run a hundred
              simulations against revenue volatility, see worst- and best-case
              paths.
            </div>
          </div>
        </div>

        <div className="welcome-actions">
          <button className="btn primary" onClick={dismiss(onTour)}>
            Take the tour
          </button>
          <button className="btn ghost" onClick={dismiss(onSkip)}>
            Skip — just let me in
          </button>
        </div>

        <div className="welcome-foot">
          Nothing here is uploaded. Refresh the page to discard everything.
        </div>
      </div>
    </div>
  );
}
