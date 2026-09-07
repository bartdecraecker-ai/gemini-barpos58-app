import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.tsx';

// Typings voor het synchronisatiescript
declare global {
  interface Window {
    POS_API_URL?: string;
    fetchPOSData?: () => Promise<any>;
    savePOSData?: (data: any) => Promise<void>;
  }
}

const rootElement = document.getElementById('root');

if (rootElement) {
  try {
    const root = ReactDOM.createRoot(rootElement);
    root.render(
      <React.StrictMode>
        <App />
      </React.StrictMode>
    );
  } catch (error) {
    console.error("Fout bij het starten van de app:", error);
  }
}
