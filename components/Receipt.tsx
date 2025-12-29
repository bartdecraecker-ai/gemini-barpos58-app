import React, { useState, useMemo } from 'react';
import { Receipt } from './components/Receipt'; // Zorg dat dit pad klopt

const PRODUCTEN = [
  { id: 1, naam: 'Pils / Bier', prijs: 2.50, kleur: 'bg-amber-100' },
  { id: 2, naam: 'Frisdrank', prijs: 2.20, kleur: 'bg-blue-100' },
  { id: 3, naam: 'Wijn Rood/Wit', prijs: 3.50, kleur: 'bg-red-100' },
  { id: 4, naam: 'Koffie / Thee', prijs: 2.00, kleur: 'bg-orange-100' },
  { id: 5, naam: 'Chips / Snacks', prijs: 1.50, kleur: 'bg-yellow-100' },
  { id: 6, naam: 'Zware Bieren', prijs: 4.00, kleur: 'bg-orange-200' },
  { id: 7, naam: 'Water', prijs: 2.00, kleur: 'bg-cyan-50' },
  { id: 8, naam: 'Specialty', prijs: 5.00, kleur: 'bg-purple-100' },
];

const COMPANY_DEFAULTS = {
  name: "MIJN BAR",
  address: "Kerkstraat 1",
  address2: "9000 Gent",
  vatNumber: "BE 0123.456.789",
  footerMessage: "Bedankt en tot ziens!"
};

export default function App() {
  const [mandje, setMandje] = useState([]);
  const [geschiedenis, setGeschiedenis] = useState([]);
  const [tab, setTab] = useState('KASSA');
  const [toonBon, setToonBon] = useState(null);

  const totaal = mandje.reduce((acc, item) => acc + (item.prijs * item.aantal), 0);

  // Rapportage berekeningen
  const rapport = useMemo(() => {
    const cash = geschiedenis.filter(t => t.methode === 'CASH').reduce((a, b) => a + b.totaal, 0);
    const kaart = geschiedenis.filter(t => t.methode === 'KAART').reduce((a, b) => a + b.totaal, 0);
    return { totalCash: cash, totalCard: kaart, totalRevenue: cash + kaart, id: "SESSIE-01" };
  }, [geschiedenis]);

  const voegToe = (p) => {
    setMandje(prev => {
      const bestaat = prev.find(i => i.id === p.id);
      if (bestaat) return prev.map(i => i.id === p.id ? { ...i, aantal: i.aantal + 1 } : i);
      return [...prev, { ...p, aantal: 1 }];
    });
  };

  const rekenAf = (methode) => {
    if (mandje.length === 0) return;
    const nieuweBon = {
      id: Math.random().toString(36).substr(2, 5).toUpperCase(),
      timestamp: Date.now(),
      dateStr: new Date().toLocaleDateString('nl-NL'),
      items: mandje.map(i => ({ ...i, name: i.naam, price: i.prijs, quantity: i.aantal })),
      total: totaal,
      subtotal: totaal / 1.21,
      vat21: totaal - (totaal / 1.21),
      paymentMethod: methode
    };
    setGeschiedenis([nieuweBon, ...geschiedenis]);
    setMandje([]);
    setToonBon(nieuweBon);
    // Op mobiel: direct print-dialoog openen? 
    // window.print(); 
  };

  return (
    <div className="flex flex-col h-screen bg-gray-100 text-gray-900 font-sans overflow-hidden">
      
      {/* HEADER - Grotere touch targets voor mobiel */}
      <header className="bg-white border-b p-4 flex justify-between items-center shadow-sm shrink-0">
        <h1 className="font-black text-xl tracking-tighter">BAR POS</h1>
        <div className="flex gap-2">
          <button onClick={() => setTab('KASSA')} className={`px-6 py-3 rounded-xl font-bold text-xs ${tab === 'KASSA' ? 'bg-black text-white' : 'bg-gray-200'}`}>KASSA</button>
          <button onClick={() => setTab('HIST')} className={`px-6 py-3 rounded-xl font-bold text-xs ${tab === 'HIST' ? 'bg-black text-white' : 'bg-gray-200'}`}>RAPPORT</button>
        </div>
      </header>

      <main className="flex-1 flex flex-col md:flex-row overflow-hidden">
        {tab === 'KASSA' ? (
          <>
            {/* PRODUCTEN - Geoptimaliseerd voor Touch */}
            <div className="flex-1 p-3 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 overflow-y-auto content-start">
              {PRODUCTEN.map(p => (
                <button 
                  key={p.id} 
                  onClick={() => voegToe(p)}
                  className={`${p.kleur} p-6 rounded-[1.5rem] font-black shadow-sm flex flex-col items-center justify-center active:scale-95 transition-all border-b-4 border-black/10 min-h-[100px]`}
                >
                  <span className="text-[10px] uppercase mb-1 text-center leading-tight">{p.naam}</span>
                  <span className="text-xs bg-white/50 px-3 py-1 rounded-full">€{p.prijs.toFixed(2)}</span>
                </button>
              ))}
            </div>

            {/* MANDJE - Onderaan op mobiel, rechts op desktop */}
            <div className="w-full md:w-80 bg-white border-t md:border-t-0 md:border-l flex flex-col shadow-xl max-h-[40vh] md:max-h-full">
              <div className="p-3 border-b font-black text-[10px] uppercase text-gray-400 text-center tracking-widest">Huidige Bestelling</div>
              <div className="flex-1 overflow-y-auto p-4 space-y-2">
                {mandje.map(item => (
                  <div key={item.id} className="flex justify-between items-center bg-gray-50 p-3 rounded-xl border border-gray-100">
                    <span className="font-bold text-[10px] uppercase truncate flex-1">{item.naam}</span>
                    <div className="flex items-center gap-3">
                      <button onClick={() => setMandje(mandje.map(i => i.id === item.id ? {...i, aantal: i.aantal - 1} : i).filter(i => i.aantal > 0))} className="w-8 h-8 bg-white border rounded-lg shadow-sm font-black text-red-500">-</button>
                      <span className="font-black text-xs w-4 text-center">{item.aantal}</span>
                      <button onClick={() => setMandje(mandje.map(i => i.id === item.id ? {...i, aantal: i.aantal + 1} : i))} className="w-8 h-8 bg-white border rounded-lg shadow-sm font-black text-green-500">+</button>
                    </div>
                  </div>
                ))}
              </div>
              <div className="p-4 bg-gray-900 text-white pb-6 md:pb-4">
                <div className="flex justify-between text-2xl font-black mb-4 italic text-amber-400">
                  <span className="text-gray-500 text-[10px] self-center not-italic uppercase tracking-widest">Totaal</span>
                  <span>€{totaal.toFixed(2).replace('.', ',')}</span>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <button onClick={() => rekenAf('CASH')} className="bg-green-600 py-4 rounded-xl font-black text-xs uppercase shadow-lg active:bg-green-700">CASH</button>
                  <button onClick={() => rekenAf('KAART')} className="bg-blue-600 py-4 rounded-xl font-black text-xs uppercase shadow-lg active:bg-blue-700">KAART</button>
                </div>
              </div>
            </div>
          </>
        ) : (
          /* RAPPORTAGE SCHERM */
          <div className="flex-1 p-6 overflow-y-auto space-y-6 max-w-xl mx-auto w-full">
            <div className="bg-white p-6 rounded-3xl shadow-sm border border-gray-200">
              <h2 className="font-black text-lg mb-4 uppercase tracking-tighter">Dagsamenvatting</h2>
              <div className="space-y-3">
                <div className="flex justify-between font-bold text-gray-600"><span>Cash:</span><span>€{rapport.totalCash.toFixed(2)}</span></div>
                <div className="flex justify-between font-bold text-gray-600"><span>Kaart:</span><span>€{rapport.totalCard.toFixed(2)}</span></div>
                <div className="flex justify-between font-black text-xl border-t pt-3 text-black"><span>TOTAAL:</span><span>€{rapport.totalRevenue.toFixed(2)}</span></div>
              </div>
              <button onClick={() => window.print()} className="w-full mt-6 bg-gray-100 py-3 rounded-xl font-black text-[10px] uppercase">Print Dagrapport</button>
            </div>

            <div className="space-y-2">
              <h3 className="font-black text-[10px] uppercase text-gray-400 ml-2">Recente Tickets</h3>
              {geschiedenis.map(h => (
                <div key={h.id} className="bg-white p-4 rounded-2xl border flex justify-between items-center shadow-sm active:bg-gray-50" onClick={() => setToonBon(h)}>
                  <div className="flex flex-col">
                    <span className="font-black text-xs">#{h.id}</span>
                    <span className="text-[10px] text-gray-400 uppercase font-bold">{h.paymentMethod}</span>
                  </div>
                  <span className="font-black">€{h.total.toFixed(2)}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </main>

      {/* BON PREVIEW & PRINT */}
      {toonBon && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center p-4 z-50 backdrop-blur-sm">
          <div className="bg-white p-4 rounded-[2rem] w-full max-w-xs shadow-2xl relative">
            <div className="max-h-[60vh] overflow-y-auto mb-4">
               <Receipt transaction={toonBon} company={COMPANY_DEFAULTS} preview={true} />
            </div>
            <div className="flex flex-col gap-2">
              <button onClick={() => window.print()} className="w-full bg-blue-600 text-white py-4 rounded-xl font-black text-xs uppercase">Print Ticket</button>
              <button onClick={() => setToonBon(null)} className="w-full bg-gray-100 text-gray-500 py-3 rounded-xl font-black text-xs uppercase">Sluiten</button>
            </div>
          </div>
        </div>
      )}

      {/* VERBORGEN PRINT AREA VOOR DE ECHTE BON */}
      <Receipt transaction={toonBon} sessionReport={tab === 'HIST' ? rapport : null} company={COMPANY_DEFAULTS} />
    </div>
  );
}
