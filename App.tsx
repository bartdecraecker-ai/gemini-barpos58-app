import React, { useState, useMemo } from 'react';

// --- CONFIGURATIE ---
const PRODUCTEN = [
  { id: 1, naam: 'Pils / Bier', prijs: 2.50, kleur: 'bg-amber-200' },
  { id: 2, naam: 'Frisdrank', prijs: 2.20, kleur: 'bg-blue-200' },
  { id: 3, naam: 'Wijn Rood/Wit', prijs: 3.50, kleur: 'bg-red-200' },
  { id: 4, naam: 'Koffie / Thee', prijs: 2.00, kleur: 'bg-orange-200' },
  { id: 5, naam: 'Chips / Snacks', prijs: 1.50, kleur: 'bg-yellow-200' },
  { id: 6, naam: 'Zware Bieren', prijs: 4.00, kleur: 'bg-orange-300' },
  { id: 7, naam: 'Water', prijs: 2.00, kleur: 'bg-cyan-100' },
  { id: 8, naam: 'Specialty', prijs: 5.00, kleur: 'bg-purple-200' },
];

export default function App() {
  const [mandje, setMandje] = useState([]);
  const [geschiedenis, setGeschiedenis] = useState([]);
  const [tab, setTab] = useState('KASSA');
  const [toonBon, setToonBon] = useState(null);

  // Bereken totaal
  const totaal = useMemo(() => {
    return mandje.reduce((acc, item) => acc + (item.prijs * item.aantal), 0);
  }, [mandje]);

  // PRODUCT TOEVOEGEN (Extra simpel voor Android)
  function voegToe(p) {
    setMandje(currentMandje => {
      const itemIndex = currentMandje.findIndex(item => item.id === p.id);
      if (itemIndex > -1) {
        const nieuwMandje = [...currentMandje];
        nieuwMandje[itemIndex] = { ...nieuwMandje[itemIndex], aantal: nieuwMandje[itemIndex].aantal + 1 };
        return nieuwMandje;
      }
      return [...currentMandje, { ...p, aantal: 1 }];
    });
  }

  // AFREKENEN
  function rekenAf(methode) {
    if (mandje.length === 0) return;
    const nieuweBon = {
      id: Math.random().toString(36).substr(2, 5).toUpperCase(),
      tijd: new Date().toLocaleTimeString('nl-NL'),
      items: [...mandje],
      totaal: totaal,
      methode: methode
    };
    setGeschiedenis([nieuweBon, ...geschiedenis]);
    setMandje([]);
    setToonBon(nieuweBon);
  }

  return (
    <div className="flex flex-col h-screen bg-gray-50 text-gray-900 font-sans overflow-hidden select-none">
      
      {/* HEADER */}
      <header className="bg-white border-b px-4 py-3 flex justify-between items-center shadow-sm shrink-0">
        <h1 className="font-black text-xl tracking-tighter">BAR POS</h1>
        <div className="flex gap-2">
          <button onClick={() => setTab('KASSA')} className={`px-5 py-2 rounded-xl font-bold text-xs ${tab === 'KASSA' ? 'bg-black text-white' : 'bg-gray-200'}`}>KASSA</button>
          <button onClick={() => setTab('RAPPORT')} className={`px-5 py-2 rounded-xl font-bold text-xs ${tab === 'RAPPORT' ? 'bg-black text-white' : 'bg-gray-200'}`}>RAPPORT</button>
        </div>
      </header>

      <main className="flex-1 flex flex-col md:flex-row overflow-hidden">
        {tab === 'KASSA' ? (
          <>
            {/* PRODUCTEN GRID - 2 kolommen op mobiel, 4 op desktop */}
            <div className="flex-1 p-3 grid grid-cols-2 md:grid-cols-4 gap-3 overflow-y-auto content-start">
              {PRODUCTEN.map(p => (
                <button 
                  key={p.id} 
                  onClick={() => voegToe(p)}
                  className={`${p.kleur} p-6 rounded-[2rem] font-black shadow-sm flex flex-col items-center justify-center active:bg-white/50 transition-colors border-b-4 border-black/10 min-h-[120px]`}
                >
                  <span className="text-xs uppercase mb-1 text-center">{p.naam}</span>
                  <span className="text-sm bg-white/60 px-3 py-1 rounded-full">€{p.prijs.toFixed(2)}</span>
                </button>
              ))}
            </div>

            {/* MANDJE */}
            <div className="w-full md:w-80 bg-white border-t md:border-t-0 md:border-l flex flex-col shadow-2xl shrink-0">
              <div className="p-3 border-b font-black text-[10px] uppercase text-gray-400 text-center tracking-widest">Winkelmandje</div>
              <div className="flex-1 overflow-y-auto p-4 space-y-2 max-h-[30vh] md:max-h-full">
                {mandje.length === 0 && <p className="text-center text-gray-300 mt-4 text-xs font-bold uppercase">Leeg</p>}
                {mandje.map(item => (
                  <div key={item.id} className="flex justify-between items-center bg-gray-50 p-3 rounded-2xl border border-gray-100">
                    <span className="font-bold text-[10px] uppercase truncate flex-1">{item.naam}</span>
                    <div className="flex items-center gap-4">
                      <button onClick={() => setMandje(mandje.map(i => i.id === item.id ? {...i, aantal: i.aantal - 1} : i).filter(i => i.aantal > 0))} className="w-8 h-8 bg-white border rounded-lg shadow-sm font-black text-red-500 text-xl">-</button>
                      <span className="font-black text-sm">{item.aantal}</span>
                      <button onClick={() => setMandje(mandje.map(i => i.id === item.id ? {...i, aantal: i.aantal + 1} : i))} className="w-8 h-8 bg-white border rounded-lg shadow-sm font-black text-green-500 text-xl">+</button>
                    </div>
                  </div>
                ))}
              </div>
              <div className="p-4 bg-black text-white pb-8 md:pb-4">
                <div className="flex justify-between text-3xl font-black mb-4 italic text-yellow-400">
                  <span className="text-gray-500 text-[10px] self-center not-italic uppercase">Totaal</span>
                  <span>€{totaal.toFixed(2)}</span>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <button onClick={() => rekenAf('CASH')} className="bg-green-600 py-4 rounded-2xl font-black text-xs uppercase shadow-lg">CASH</button>
                  <button onClick={() => rekenAf('KAART')} className="bg-blue-600 py-4 rounded-2xl font-black text-xs uppercase shadow-lg">KAART</button>
                </div>
              </div>
            </div>
          </>
        ) : (
          /* RAPPORTAGE */
          <div className="flex-1 p-6 overflow-y-auto space-y-4 max-w-xl mx-auto w-full">
            <h2 className="font-black text-xl italic uppercase">Verkopen van vandaag</h2>
            <div className="grid grid-cols-2 gap-3 mb-6">
                <div className="bg-white p-4 rounded-2xl border shadow-sm">
                    <p className="text-[10px] font-bold text-gray-400 uppercase">Cash</p>
                    <p className="font-black text-lg">€{geschiedenis.filter(h=>h.methode==='CASH').reduce((a,b)=>a+b.totaal, 0).toFixed(2)}</p>
                </div>
                <div className="bg-white p-4 rounded-2xl border shadow-sm">
                    <p className="text-[10px] font-bold text-gray-400 uppercase">Kaart</p>
                    <p className="font-black text-lg">€{geschiedenis.filter(h=>h.methode==='KAART').reduce((a,b)=>a+b.totaal, 0).toFixed(2)}</p>
                </div>
            </div>
            {geschiedenis.map(h => (
              <div key={h.id} className="bg-white p-4 rounded-2xl border flex justify-between items-center shadow-sm">
                <div>
                    <p className="font-black text-xs">#{h.id}</p>
                    <p className="text-[9px] text-gray-400 uppercase font-bold">{h.tijd} - {h.methode}</p>
                </div>
                <span className="font-black">€{h.totaal.toFixed(2)}</span>
              </div>
            ))}
          </div>
        )}
      </main>

      {/* BON MODAL */}
      {toonBon && (
        <div className="fixed inset-0 bg-black/90 flex items-center justify-center p-4 z-50">
          <div className="bg-white p-8 rounded-[2rem] w-full max-w-xs text-center shadow-2xl">
            <h2 className="font-black text-xl mb-4 italic uppercase">Ticket #{toonBon.id}</h2>
            <div className="text-left text-[11px] font-bold space-y-2 border-y border-dashed py-4 mb-4">
              {toonBon.items.map((i, idx) => (
                <div key={idx} className="flex justify-between uppercase">
                  <span>{i.aantal}x {i.naam}</span>
                  <span>€{(i.prijs * i.aantal).toFixed(2)}</span>
                </div>
              ))}
            </div>
            <div className="flex justify-between font-black text-xl mb-6">
              <span>TOTAAL</span>
              <span>€{toonBon.totaal.toFixed(2)}</span>
            </div>
            <button onClick={() => setToonBon(null)} className="w-full bg-black text-white py-4 rounded-2xl font-black text-xs uppercase tracking-widest">SLUITEN</button>
          </div>
        </div>
      )}
    </div>
  );
}
