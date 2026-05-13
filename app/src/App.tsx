import { useState } from 'react';
import { Layout, type TabKey } from './components/Layout';
import { OverviewTab } from './components/tabs/OverviewTab';
import { InputsTab } from './components/tabs/InputsTab';
import { ScenariosTab } from './components/tabs/ScenariosTab';
import { WelcomeModal } from './components/WelcomeModal';
import { Tour, TOUR_STEPS } from './components/Tour';
import { useAppState } from './state/useAppState';
import { hasSeenWelcome } from './auth';

export function App() {
  const [tab, setTab] = useState<TabKey>('overview');
  const state = useAppState();

  // First-visit experience: show the welcome modal once per browser tab.
  const [showWelcome, setShowWelcome] = useState(() => !hasSeenWelcome());
  const [showTour, setShowTour] = useState(false);

  const restartTour = () => {
    setShowWelcome(false);
    setShowTour(true);
  };

  return (
    <>
      <Layout
        tab={tab}
        onTab={setTab}
        onImport={state.importFromFile}
        onUseTemplate={state.useTemplateDefaults}
        onTour={restartTour}
      >
        {tab === 'overview'  && (
          <OverviewTab
            projection={state.projection}
            startingCash={state.inputs.config.startingCash}
            importInfo={state.importInfo}
            laborRoster={state.laborRoster}
            ownerDrawTarget={state.inputs.ownerDrawTarget}
            commission={state.inputs.commission}
          />
        )}
        {tab === 'inputs'    && <InputsTab    state={state} importInfo={state.importInfo} laborRoster={state.laborRoster} />}
        {tab === 'scenarios' && <ScenariosTab state={state} />}
      </Layout>

      {showWelcome && (
        <WelcomeModal
          onTour={() => { setShowWelcome(false); setShowTour(true); }}
          onSkip={() => setShowWelcome(false)}
        />
      )}

      {showTour && (
        <Tour
          steps={TOUR_STEPS}
          onTab={setTab}
          onClose={() => setShowTour(false)}
        />
      )}

      {state.toasts.map((t) => (
        <div key={t.key} className={`toast ${t.kind === 'info' ? '' : t.kind}`}>
          {t.text}
        </div>
      ))}
    </>
  );
}
