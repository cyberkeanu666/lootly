import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import { LanguageProvider } from './i18n/LanguageContext.tsx';
import { LootlyUIProvider } from './components/LootlyUI.tsx';
import './index.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <LanguageProvider>
      <LootlyUIProvider>
        <App />
      </LootlyUIProvider>
    </LanguageProvider>
  </StrictMode>,
);
