import { useState } from 'react';
import { Layout, type TabKey } from './components/Layout';
import { OverviewTab } from './components/tabs/OverviewTab';
import { InputsTab } from './components/tabs/InputsTab';
import { ScenariosTab } from './components/tabs/ScenariosTab';
import { useAppState } from './state/useAppState';

export function App() {
  const [tab, setTab] = useState<TabKey>('overview');
  const state = useAppState();

  return (
    <>
      <Layout tab={tab} onTab={setTab} onImport={state.importFromFile}>
        {tab === 'overview'  && (
          <OverviewTab
            projection={state.projection}
            startingCash={state.inputs.config.startingCash}
            importInfo={state.importInfo}
          />
        )}
        {tab === 'inputs'    && <InputsTab    state={state} importInfo={state.importInfo} />}
        {tab === 'scenarios' && <ScenariosTab state={state} />}
      </Layout>

      {state.toasts.map((t) => (
        <div key={t.key} className={`toast ${t.kind === 'info' ? '' : t.kind}`}>
          {t.text}
        </div>
      ))}
    </>
  );
}
