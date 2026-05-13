import React, { useState } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import { PasswordGate } from './components/PasswordGate';
import { isAuthenticated } from './auth';
import './styles.css';

function Root() {
  const [authed, setAuthed] = useState(() => isAuthenticated());
  if (!authed) return <PasswordGate onSuccess={() => setAuthed(true)} />;
  return <App />;
}

const root = document.getElementById('root');
if (!root) throw new Error('Missing #root element in index.html');
createRoot(root).render(
  <React.StrictMode>
    <Root />
  </React.StrictMode>,
);
