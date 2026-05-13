// Step-by-step tour. A floating card anchored to a target element on the
// page, with a dim backdrop so the target is visually highlighted. Prev /
// Next / Close controls. Tour steps know which tab to be on, so we drive
// tab state from here.

import { useState, useLayoutEffect } from 'react';
import type { TabKey } from './Layout';

// How many times to retry finding/measuring the target before giving up.
// 30 × 50ms = 1.5s total — plenty for a parent tab switch + DOM mount.
const MAX_MEASURE_ATTEMPTS = 30;

export interface TourStep {
  id: string;
  tab: TabKey;
  targetSelector: string;
  title: string;
  body: React.ReactNode;
  placement?: 'bottom' | 'top' | 'left' | 'right';
}

export function Tour({
  steps,
  onTab,
  onClose,
}: {
  steps: TourStep[];
  onTab: (t: TabKey) => void;
  onClose: () => void;
}) {
  const [index, setIndex] = useState(0);
  const [rect, setRect] = useState<DOMRect | null>(null);
  const current = steps[index]!;

  // Drive the active tab to whatever the current step wants.
  // useLayoutEffect (not useEffect) so the tab switch is scheduled in the
  // same commit phase as the measurement below — avoids a one-frame window
  // where the user sees the new tour card over the old tab's content.
  useLayoutEffect(() => {
    onTab(current.tab);
  }, [current.tab, onTab]);

  // Measure the target element. There's a race when a step changes the
  // active tab: this layout effect fires synchronously after Tour's commit,
  // but the parent's tab switch is a queued state update that hasn't been
  // applied yet — so the new tab's DOM isn't mounted and querySelector
  // returns null. We poll with a retry budget to wait for the target to
  // appear (and for it to be actually sized — zero-size rects mean the
  // element is in the tree but not laid out yet).
  useLayoutEffect(() => {
    let timer: ReturnType<typeof setTimeout> | null = null;
    let cancelled = false;

    const tryMeasure = (attempt: number) => {
      if (cancelled) return;
      const el = document.querySelector(current.targetSelector);
      const r = el?.getBoundingClientRect();
      if (el && r && r.width > 0 && r.height > 0) {
        setRect(r);
        if (r.top < 80 || r.bottom > window.innerHeight - 40) {
          el.scrollIntoView({ behavior: 'smooth', block: 'center' });
          timer = setTimeout(() => tryMeasure(0), 350);
        }
        return;
      }
      // Target not in DOM or not yet sized. Poll up to ~1.5s.
      if (attempt < MAX_MEASURE_ATTEMPTS) {
        timer = setTimeout(() => tryMeasure(attempt + 1), 50);
      } else {
        // Give up and fall back to a fixed-position card; spotlight hides.
        setRect(null);
      }
    };
    tryMeasure(0);

    const onViewportChange = () => tryMeasure(0);
    window.addEventListener('resize', onViewportChange);
    window.addEventListener('scroll', onViewportChange, true);
    return () => {
      cancelled = true;
      window.removeEventListener('resize', onViewportChange);
      window.removeEventListener('scroll', onViewportChange, true);
      if (timer) clearTimeout(timer);
    };
  }, [current.targetSelector, index]);

  const prev = () => setIndex((i) => Math.max(0, i - 1));
  const next = () => {
    if (index >= steps.length - 1) onClose();
    else setIndex((i) => i + 1);
  };

  // Position the card. Default below the target; flip above if there's no
  // room.
  const cardStyle: React.CSSProperties = (() => {
    if (!rect) return { right: 32, bottom: 32, top: 'auto', left: 'auto' };
    const placement = current.placement ?? 'bottom';
    const margin = 16;
    if (placement === 'bottom') {
      const top = rect.bottom + margin;
      if (top + 280 > window.innerHeight) {
        return { left: rect.left, top: Math.max(80, rect.top - 280 - margin) };
      }
      return { left: rect.left, top };
    }
    if (placement === 'top') return { left: rect.left, top: Math.max(80, rect.top - 280 - margin) };
    if (placement === 'right') return { left: rect.right + margin, top: rect.top };
    return { left: Math.max(16, rect.left - 380 - margin), top: rect.top };
  })();

  return (
    <>
      {/* Spotlight backdrop — cuts out the target rect. */}
      <div className="tour-backdrop" onClick={onClose} aria-hidden="true">
        {rect && (
          <div
            className="tour-spotlight"
            style={{
              left: rect.left - 8,
              top: rect.top - 8,
              width: rect.width + 16,
              height: rect.height + 16,
            }}
          />
        )}
      </div>

      <div className="tour-card" style={cardStyle} role="dialog" aria-labelledby="tour-title">
        <div className="tour-card-head">
          <span className="tour-step">Step {index + 1} / {steps.length}</span>
          <button className="tour-close" onClick={onClose} aria-label="Close tour">
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
              <path d="M3 3l6 6M9 3l-6 6" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
            </svg>
          </button>
        </div>

        <h3 id="tour-title" className="tour-title">{current.title}</h3>
        <div className="tour-body">{current.body}</div>

        <div className="tour-actions">
          <button
            className="btn ghost"
            onClick={prev}
            disabled={index === 0}
            style={{ visibility: index === 0 ? 'hidden' : 'visible' }}
          >
            ← Back
          </button>
          <div className="tour-dots">
            {steps.map((_, i) => (
              <span key={i} className={`tour-dot ${i === index ? 'is-active' : ''}`} />
            ))}
          </div>
          <button className="btn primary" onClick={next}>
            {index >= steps.length - 1 ? 'Finish' : 'Next →'}
          </button>
        </div>
      </div>
    </>
  );
}

// The actual tour script. Selectors target stable data-tour attributes
// rendered by the components, so we don't depend on class names.
export const TOUR_STEPS: TourStep[] = [
  {
    id: 'use-template',
    tab: 'overview',
    targetSelector: '[data-tour="use-template"]',
    title: 'Start here',
    body: (
      <>
        <em>Use template</em> loads the bundled Heartland budget workbook directly into
        the app — one click, no file picker. Operators with their own filled-in
        copy can use <em>Import</em> instead.
      </>
    ),
    placement: 'bottom',
  },
  {
    id: 'kpis',
    tab: 'overview',
    targetSelector: '[data-tour="kpi-strip"]',
    title: 'The four headline numbers',
    body: (
      <>
        Final cash · Peak debt · Net position · Average operating profit.
        These summarize the entire horizon. Green is good, red signals
        trouble worth examining.
      </>
    ),
    placement: 'bottom',
  },
  {
    id: 'summary',
    tab: 'overview',
    targetSelector: '[data-tour="horizon-summary"]',
    title: 'Where the money goes',
    body: (
      <>
        Inflows on the left, outflows on the right. The reconciliation row
        proves the math: <em>starting + collected − outflows = final cash</em>.
        If reality differs from your gut, this is where you'll see why.
      </>
    ),
    placement: 'top',
  },
  {
    id: 'chart',
    tab: 'overview',
    targetSelector: '[data-tour="cash-chart"]',
    title: 'Month-by-month trajectory',
    body: (
      <>
        Cash in navy, debt in orange. A growing cash line and a flat (or
        falling) debt line means the business is compounding wealth.
      </>
    ),
    placement: 'top',
  },
  {
    id: 'inputs',
    tab: 'inputs',
    targetSelector: '[data-tour="inputs-revenue"]',
    title: 'Tune any assumption',
    body: (
      <>
        Every number on the Overview comes from these inputs. Edit a wage,
        add a debt, flip commission — the projection updates the moment
        you change a value. Refreshing the page resets everything.
      </>
    ),
    placement: 'bottom',
  },
  {
    id: 'scenarios',
    tab: 'scenarios',
    targetSelector: '[data-tour="scenarios-run"]',
    title: 'Stress test the plan',
    body: (
      <>
        Monte Carlo runs 100+ simulations against revenue volatility. The
        P10 path is your worst-case ranking by net position — the question
        is whether you can survive it.
      </>
    ),
    placement: 'bottom',
  },
];
