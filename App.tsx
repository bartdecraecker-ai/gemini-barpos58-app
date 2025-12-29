import React, { useState, useMemo, useEffect } from 'react';

export default function App() {
  // --- STATE ---
  const [products, setProducts] = useState([
    { id: 1, naam: 'Pils / Bier', prijs: 2.50, kleur: 'bg-amber-200' },
    { id: 2, naam: 'Frisdrank', prijs: 2.20, kleur: 'bg-blue-200' },
    { id: 3, naam: 'Wijn Rood/Wit', prijs: 3.50, kleur: 'bg-red-200' },
    { id: 4, naam: 'Koffie / Thee', prijs: 2.00, kleur: 'bg-orange-200' },
    { id: 5, naam: 'Chips / Snacks', prijs: 1.50, kleur: 'bg-yellow-200' },
    { id: 6, naam: 'Zware Bieren', prijs: 4.00, kleur: 'bg-orange-300' },
    { id: 7, naam: 'Water', prijs: 2.00, kleur: 'bg-cyan-100' },
    { id: 8, naam: 'Specialty', prijs: 5.00, kleur: 'bg-purple-200' },
  ]);

  const [company, setCompany] = useState({
    name: "MIJN BAR",
    address: "Dorpstraat 1",
    vat: "BE 0123.456.789",
    seller: "Verkoper 1"
  });

  const [mandje, setMandje] = useState([]);
  const [geschiedenis, setGeschiedenis] = useState([]);
  const [tab, setTab] = useState('KASSA'); // KASSA, RAPPORT, SETTINGS
  const [toonBon, setToonBon] = useState(null);

  // --- LOGICA ---
  const totaal = useMemo(() => mandje.reduce((acc, item) => acc + (item.prijs * item.aantal), 0), [mandje]);

  function voegToe(p) {
    setMandje(curr => {
      const idx = curr.findIndex(i => i.id === p.id);
      if (idx > -1) {
        const nieuw = [...curr];
        nieuw[idx] = { ...nieuw[idx], aantal: nieuw[idx].aantal + 1 };
        return nieuw;
      }
      return [...curr, { ...p, aantal: 1 }];
    });
  }

  function rekenAf(methode) {
    if (mandje.length === 0) return;
    const nieuweBon = {
      id: Math.random().toString(36).substr(2, 5).toUpperCase(),
      tijd: new Date().toLocaleTimeString('nl-NL'),
      datum: new Date().toLocaleDateString('nl-NL'),
      items: [...mandje],
      totaal: totaal,
      methode: methode,
      verkoper: company.seller
    };
    setGeschiedenis([nieuweBon, ...geschiedenis]);
    setMandje([]);
    setToonBon(nieuweBon);
  }

  return (
    <div className="flex flex-col h-screen bg-gray-50 text-gray-900 font-sans overflow-hidden select-none">
      
      {/* HEADER */}
      <header className="bg-white border-b px-4 py-3 flex justify-between items-center shadow-sm shrink-0">
        <div className="flex flex-col">
          <h1 className="font-black text-xl tracking-tighter leading-none">BAR POS</h1>
          <span className="text-[10px] text-gray-400 font-bold uppercase">{company.name}</span>
        </div>
        <div className="flex gap-1 bg-gray-100 p-1 rounded-xl">
          <button onClick={() => setTab('KASSA')} className={`px-4 py-2 rounded-lg font-bold text-[10px] ${tab === 'KASSA' ? 'bg-white shadow text-black' : 'text-gray-500'}`}>KASSA</button>
          <button onClick={() => setTab('RAPPORT')} className={`px-4 py-2 rounded-lg font-bold text-[10px] ${tab === 'RAPPORT' ? 'bg-white shadow text-black' : 'text-gray-500'}`}>RAPPORT</button>
          <button onClick={() => setTab('SETTINGS')} className={`px-4 py-2 rounded-lg font-bold text-[10px] ${tab === 'SETTINGS' ? 'bg-white shadow text-black' : 'text-gray-500'}`}>ADMIN</button>
        </div>
      </header>

      <main className="flex-1 flex flex-col md:flex-row overflow-hidden">
        {tab === 'KASSA' && (
          <>
            {/* GRID - FORCEER 4 KOLOMMEN OP SCHERMEN VANAF 'SM' */}
            <div className="flex-1 p-3 grid grid-cols-2 sm:grid-cols-4 gap-3 overflow-y-auto content-start">
              {products.map(p => (
                <button 
                  key={p.id} 
                  onClick={() => voegToe(p)}
                  className={`${p.kleur} p-6 rounded-[2rem] font-black shadow-sm flex flex-col items-center justify-center active:opacity-50 border-b-4 border-black/10 min-h-[110px]`}
                >
                  <span className="text-[10px] uppercase mb-1 text-center">{p.naam}</span>
                  <span className="text-xs bg-white/60 px-3 py-1 rounded-full">€{p.prijs.toFixed(2)}</span>
                </button>
              ))}
            </div>

            {/* MANDJE */}
            <div className="w-full md:w-80 bg-white border-t md:border-t-0 md:border-l flex flex-col shadow-2xl shrink-0">
              <div className="p-3 border-b font-black text-[10px] uppercase text-gray-400 text-center">Mandje</div>
              <div className="flex-1 overflow-y-auto p-4 space-y-2 max-h-[25vh] md:max-h-full">
                {mandje.map(item => (
                  <div key={item.id} className="flex justify-between items-center bg-gray-50 p-3 rounded-2xl border border-gray-100 text-xs font-bold">
                    <span className="truncate flex-1">{item.naam}</span>
                    <div className="flex items-center gap-3 ml-2">
                      <button onClick={() => setMandje(mandje.map(i => i.id === item.id ? {...i, aantal: i.aantal - 1} : i).filter(i => i.aantal > 0))} className="w-8 h-8 bg-white border rounded-lg shadow-sm text-red-500">-</button>
                      <span>{item.aantal}</span>
                      <button onClick={() => setMandje(mandje.map(i => i.id === item.id ? {...i, aantal: i.aantal + 1} : i))} className="w-8 h-8 bg-white border rounded-lg shadow-sm text-green-500">+</button>
                    </div>
                  </div>
                ))}
              </div>
              <div className="p-4 bg-black text-white">
                <div className="flex justify-between text-2xl font-black mb-4 italic text-yellow-400">
                  <span className="text-gray-500 text-[10px] self-center not-italic uppercase">Totaal</span>
                  <span>€{totaal.toFixed(2)}</span>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <button onClick={() => rekenAf('CASH')} className="bg-green-600 py-5 rounded-2xl font-black text-xs uppercase shadow-lg">CASH</button>
                  <button onClick={() => rekenAf('KAART')} className="bg-blue-600 py-5 rounded-2xl font-black text-xs uppercase shadow-lg">KAART</button>
                </div>
              </div>
            </div>
          </>
        )}

        {tab === 'RAPPORT' && (
          <div className="flex-1 p-6 overflow-y-auto max-w-xl mx-auto w-full">
             <h2 className="font-black text-xl mb-6 uppercase italic">Dagsamenvatting</h2>
             <div className="grid grid-cols-2 gap-4 mb-8">
                <div className="bg-white p-5 rounded-3xl border shadow-sm">
                   <p className="text-[10px] font-bold text-gray-400 uppercase">Cash Totaal</p>
                   <p className="font-black text-xl">€{geschiedenis.filter(h=>h.methode==='CASH').reduce((a,b)=>a+b.totaal, 0).toFixed(2)}</p>
                </div>
                <div className="bg-white p-5 rounded-3xl border shadow-sm">
                   <p className="text-[10px] font-bold text-gray-400 uppercase">Kaart Totaal</p>
                   <p className="font-black text-xl">€{geschiedenis.filter(h=>h.methode==='KAART').reduce((a,b)=>a+b.totaal, 0).toFixed(2)}</p>
                </div>
             </div>
             <div className="space-y-2">
                {geschiedenis.map(h => (
                  <div key={h.id} className="bg-white p-4 rounded-2xl border flex justify-between items-center text-xs font-bold" onClick={() => setToonBon(h)}>
                    <span>{h.tijd} - {h.methode}</span>
                    <span className="font-black">€{h.totaal.toFixed(2)}</span>
                  </div>
                ))}
             </div>
          </div>
        )}

        {tab === 'SETTINGS' && (
          <div className="flex-1 p-6 overflow-y-auto max-w-xl mx-auto w-full space-y-6">
            <h2 className="font-black text-xl uppercase italic">Instellingen</h2>
            
            <div className="bg-white p-6 rounded-3xl border shadow-sm space-y-4">
              <h3 className="font-black text-xs uppercase text-gray-400">Bedrijfsgegevens</h3>
              <input className="w-full p-3 bg-gray-50 rounded-xl border text-sm font-bold" value={company.name} onChange={(e)=>setCompany({...company, name: e.target.value})} placeholder="Bedrijfsnaam" />
              <input className="w-full p-3 bg-gray-50 rounded-xl border text-sm font-bold" value={company.address} onChange={(e)=>setCompany({...company, address: e.target.value})} placeholder="Adres" />
              <input className="w-full p-3 bg-gray-50 rounded-xl border text-sm font-bold" value={company.vat} onChange={(e)=>setCompany({...company, vat: e.target.value})} placeholder="BTW Nummer" />
              <input className="w-full p-3 bg-gray-50 rounded-xl border text-sm font-bold" value={company.seller} onChange={(e)=>setCompany({...company, seller: e.target.value})} placeholder="Naam Verkoper" />
            </div>

            <div className="bg-white p-6 rounded-3xl border shadow-sm">
              <h3 className="font-black text-xs uppercase text-gray-400 mb-4">Producten Beheren</h3>
              <div className="space-y-2">
                {products.map(p => (
                  <div key={p.id} className="flex gap-2">
                    <input className="flex-1 p-2 bg-gray-50 rounded-lg border text-[10px] font-bold" value={p.naam} onChange={(e) => {
                      const n = [...products];
                      n.find(x => x.id === p.id).naam = e.target.value;
                      setProducts(n);
                    }} />
                    <input className="w-20 p-2 bg-gray-50 rounded-lg border text-[10px] font-bold" type="number" value={p.prijs} onChange={(e) => {
                      const n = [...products];
                      n.find(x => x.id === p.id).prijs = parseFloat(e.target.value);
                      setProducts(n);
                    }} />
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </main>

      {/* BON MODAL */}
      {toonBon && (
        <div className="fixed inset-0 bg-black/90 flex items-center justify-center p-4 z-50">
          <div className="bg-white p-8 rounded-[2rem] w-full max-w-xs shadow-2xl">
            <div className="text-center border-b border-dashed pb-4 mb-4">
              <h2 className="font-black text-lg uppercase">{company.name}</h2>
              <p className="text-[9px] font-bold text-gray-400">{company.address} <br/> {company.vat}</p>
            </div>
            <div className="text-[10px] font-bold space-y-1 mb-4">
              {toonBon.items.map((i, idx) => (
                <div key={idx} className="flex justify-between uppercase">
                  <span>{i.aantal}x {i.naam}</span>
                  <span>€{(i.prijs * i.aantal).toFixed(2)}</span>
                </div>
              ))}
            </div>
            <div className="flex justify-between font-black text-xl mb-6 border-t pt-4">
              <span>TOTAAL</span>
              <span>€{toonBon.totaal.toFixed(2)}</span>
            </div>
            <div className="text-[9px] text-center text-gray-400 mb-6 uppercase">
               Verkoper: {toonBon.verkoper} <br/> {toonBon.datum} {toonBon.tijd}
            </div>
            <button onClick={() => setToonBon(null)} className="w-full bg-black text-white py-4 rounded-2xl font-black text-xs uppercase">SLUITEN</button>
          </div>
        </div>
      )}
    </div>
  );
}
