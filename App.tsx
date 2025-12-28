import React, { useState } from 'react';

// --- VOLLEDIG ZELFSTANDIGE APP (GEEN ANDERE BESTANDEN NODIG) ---

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

export default function App() {
  const [mandje, setMandje] = useState([]);
  const [geschiedenis, setGeschiedenis] = useState([]);
  const [tab, setTab] = useState('KASSA');
  const [toonBon, setToonBon] = useState(null);

  const totaal = mandje.reduce((acc, item) => acc + (item.prijs * item.aantal), 0);

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
      tijd: new Date().toLocaleTimeString(),
      items: [...mandje],
      totaal: totaal,
      methode: methode
    };
    setGeschiedenis([nieuweBon, ...geschiedenis]);
    setMandje([]);
    setToonBon(nieuweBon);
  };

  return (
    <div className="flex flex-col h-screen bg-gray-100 text-gray-900 font-sans overflow-hidden">
      
      {/* HEADER */}
      <header className="bg-white border-b p-4 flex justify-between items-center shadow-sm">
        <h1 className="font-black text-xl tracking-tighter">BAR POS</h1>
        <div className="flex gap-2">
          <button onClick={() => setTab('KASSA')} className={`px-4 py-2 rounded-lg font-bold text-xs ${tab === 'KASSA' ? 'bg-black text-white' : 'bg-gray-200'}`}>KASSA</button>
          <button onClick={() => setTab('HIST')} className={`px-4 py-2 rounded-lg font-bold text-xs ${tab === 'HIST' ? 'bg-black text-white' : 'bg-gray-200'}`}>HISTORIEK</button>
        </div>
      </header>

      <main className="flex-1 flex overflow-hidden">
        {tab === 'KASSA' ? (
          <>
            {/* PRODUCTEN - 4 OP EEN RIJ */}
            <div className="flex-1 p-4 grid grid-cols-2 md:grid-cols-4 gap-4 overflow-y-auto content-start">
              {PRODUCTEN.map(p => (
                <button 
                  key={p.id} 
                  onClick={() => voegToe(p)}
                  className={`${p.kleur} p-8 rounded-[2rem] font-black shadow-sm flex flex-col items-center justify-center active:scale-95 transition-all border-b-4 border-black/10`}
                >
                  <span className="text-[11px] uppercase mb-1">{p.naam}</span>
                  <span className="text-xs bg-white/40 px-3 py-1 rounded-full">€{p.prijs.toFixed(2)}</span>
                </button>
              ))}
            </div>

            {/* MANDJE */}
            <div className="w-80 bg-white border-l flex flex-col shadow-xl">
              <div className="p-4 border-b font-black text-xs uppercase text-gray-400 text-center">Mandje</div>
              <div className="flex-1 overflow-y-auto p-4 space-y-2">
                {mandje.map(item => (
                  <div key={item.id} className="flex justify-between items-center bg-gray-50 p-3 rounded-xl">
                    <span className="font-bold text-[10px] uppercase truncate flex-1">{item.naam}</span>
                    <div className="flex items-center gap-2 font-black text-xs">
                      <button onClick={() => setMandje(mandje.map(i => i.id === item.id ? {...i, aantal: i.aantal - 1} : i).filter(i => i.aantal > 0))} className="w-6 h-6 bg-white border rounded">-</button>
                      <span>{item.aantal}</span>
                      <button onClick={() => setMandje(mandje.map(i => i.id === item.id ? {...i, aantal: i.aantal + 1} : i))} className="w-6 h-6 bg-white border rounded">+</button>
                    </div>
                  </div>
                ))}
              </div>
              <div className="p-6 bg-black text-white">
                <div className="flex justify-between text-2xl font-black mb-4 italic text-yellow-400">
                  <span className="text-gray-500 text-xs self-center">TOTAAL</span>
                  <span>€{totaal.toFixed(2)}</span>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <button onClick={() => rekenAf('CASH')} className="bg-green-600 p-4 rounded-xl font-black text-[10px] uppercase">CASH</button>
                  <button onClick={() => rekenAf('KAART')} className="bg-blue-600 p-4 rounded-xl font-black text-[10px] uppercase">KAART</button>
                </div>
              </div>
            </div>
          </>
        ) : (
          /* HISTORIEK */
          <div className="flex-1 p-8 overflow-y-auto space-y-2 max-w-xl mx-auto">
            <h2 className="font-black text-xl mb-4 italic">Verkopen</h2>
            {geschiedenis.map(h => (
              <div key={h.id} className="bg-white p-4 rounded-xl border flex justify-between font-bold text-xs shadow-sm">
                <span>{h.tijd} - {h.methode}</span>
                <span>€{h.totaal.toFixed(2)}</span>
              </div>
            ))}
          </div>
        )}
      </main>

      {/* BON MODAL */}
      {toonBon && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center p-4 z-50">
          <div className="bg-white p-8 rounded-[2rem] w-full max-w-xs text-center">
            <h2 className="font-black text-xl mb-4 italic">TICKET</h2>
            <div className="text-left text-xs font-bold space-y-1 border-y border-dashed py-4 mb-4">
              {toonBon.items.map(i => (
                <div key={i.id} className="flex justify-between">
                  <span>{i.aantal}x {i.naam}</span>
                  <span>€{(i.prijs * i.aantal).toFixed(2)}</span>
                </div>
              ))}
            </div>
            <div className="flex justify-between font-black text-lg mb-6">
              <span>TOTAAL</span>
              <span>€{toonBon.totaal.toFixed(2)}</span>
            </div>
            <button onClick={() => setToonBon(null)} className="w-full bg-black text-white py-3 rounded-xl font-black text-xs uppercase">SLUITEN</button>
          </div>
        </div>
      )}
    </div>
  );
}
