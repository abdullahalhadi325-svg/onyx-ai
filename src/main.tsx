import { applyCustomizationToDom, loadCustomization } from "./lib/customization";
applyCustomizationToDom(loadCustomization());
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import './index.css';

if (
  typeof window !== 'undefined' &&
  'serviceWorker' in navigator &&
  window.location.protocol !== 'capacitor:'
) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => {
      // Service worker registration is optional in constrained preview iframes
    });
  });
}

createRoot(document.getElementById('root')!).render(<App />);
