import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { ActiveSessionProvider } from './context/ActiveSessionContext';
import { PreferencesProvider } from './context/PreferencesContext';
import './styles/global.css';
import App from './App';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <PreferencesProvider>
      <ActiveSessionProvider>
        <App />
      </ActiveSessionProvider>
    </PreferencesProvider>
  </StrictMode>
);
