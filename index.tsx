import React, { useState, useEffect } from 'react';

export default function App() {
  const [orders, setOrders] = useState<any[]>([]);

  // 1. Luister automatisch elke 2 seconden naar updates van krauker.be
  useEffect(() => {
    const handleSync = (event: CustomEvent) => {
      if (event.detail && Array.isArray(event.detail)) {
        setOrders(event.detail);
      }
    };

    // Luister naar het event uit index.html
    window.addEventListener('pos-data-sync', handleSync as EventListener);

    // Haal de eerste keer meteen data op bij het laden van de pagina
    if (window.fetchPOSData) {
      window.fetchPOSData();
    }

    return () => {
      window.removeEventListener('pos-data-sync', handleSync as EventListener);
    };
  }, []);

  // 2. Gebruik deze functie wanneer een gebruiker een bestelling toevoegt of aanpast
  const handleSaveOrders = (updatedOrders: any[]) => {
    setOrders(updatedOrders);

    // Stuur direct door naar www.krauker.be
    if (window.savePOSData) {
      window.savePOSData(updatedOrders);
    }
  };

  return (
    <div>
      {/* Jouw POS interface componenten */}
    </div>
  );
}
