import React from 'react';
import ReactDOM from 'react-dom/client';
import { onHostConfig } from './sdk/mnemo-sdk';
import App from './App';
import { adoptHostLang } from './i18n/useI18n';

/**
 * One subscription to the shell, for everything it broadcasts.
 *
 * The SDK applies what it can on its own: `data-theme` on <html> and the
 * host's computed design tokens as custom properties — which is what makes
 * index.html's `var(--bg-void, …)` more than a fallback. The language it
 * hands to us, because only Muse knows which locales it actually ships.
 *
 * Registered before render so the first paint is already themed.
 */
onHostConfig((cfg) => adoptHostLang(cfg.lang));

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
