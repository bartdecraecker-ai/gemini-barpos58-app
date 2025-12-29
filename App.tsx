import React, { useState, useMemo } from 'react';

// --- INITIAL DATA ---
const INITIAL_PRODUCTS = [
  { id: 1, name: 'Pils / Bier', price: 2.50, color: 'bg-amber-100' },
  { id: 2, name: 'Frisdrank', price: 2.20, color: 'bg-blue-100' },
  { id: 3, name: 'Wijn Rood/Wit', price: 3.50, color: 'bg-red-100' },
  { id: 4, name: 'Koffie / Thee', price: 2.00, color: 'bg-orange-100' },
  { id: 5, name: 'Chips / Snacks', price: 1.50, color: 'bg-yellow-100' },
  { id: 6, name: 'Zware Bieren', price: 4.00, color: 'bg-orange-200' },
  { id: 7, name: 'Water', price: 2.00, color: 'bg-cyan-50' },
  { id: 8, name: 'Specialty', price: 5.00, color: 'bg-purple-100' },
];

export default function App() {
  const [products, setProducts] = useState(INITIAL_PRODUCTS);
  const [company, setCompany] = useState({
    name: "MIJN BAR",
    address: "Dorpstraat 1",
    address2: "9000 Gent",
    vatNumber: "BE 0123.456.789",
    sellerName: "Beheerder",
    footerMessage: "Bedankt voor je bezoek!"
  });

  const [cart, setCart] = useState([]);
  const [transactions, setTransactions] = useState([]);
  const [activeTab, setActiveTab] = useState('KASSA'); 
  const [selectedTx, setSelectedTx] = useState(null);

  // --- CALCULATIONS (ORIGINAL SPEC) ---
  const totals = useMemo(() => {
    const total = cart.reduce((acc, item) => acc + (item.price * item.quantity), 0);
    const subtotal = total / 1.21;
    const vat21 = total - subtotal;
    return { total, subtotal, vat21 };
  }, [cart]);

  const addToCart = (p) => {
    setCart(curr => {
      const exists = curr.find(i => i.id === p.id);
      if (exists) return curr.map(i => i.id === p.id ? { ...i, quantity: i.quantity + 1 } : i);
      return [...curr, { ...p, quantity: 1 }];
    });
  };

  const finalizeTransaction = (method) => {
    if (cart.length === 0) return;
    const newTx = {
      id: `TR-${Math.random().toString(36).substr(2, 4).toUpperCase()}`,
      timestamp: Date.now(),
      dateStr: new Date().toLocaleDateString('nl-NL'),
      items: [...cart],
      total: totals.total,
      subtotal: totals.subtotal,
      vat21: totals.vat21,
      paymentMethod: method,
      sellerName: company.sellerName
    };
    setTransactions([newTx, ...transactions]);
    setCart([]);
    setSelectedTx(newTx);
  };

  return (
    <div className="flex flex-col h-screen bg-slate-100 text-slate-900 font-sans overflow-hidden">
      
      {/* HEADER */}
      <header className="bg-white border-b px-6 py-4 flex justify-between items-center shadow-sm shrink-0">
        <div>
          <h1 className="font-black text-2xl tracking-tighter text-slate-900">BAR<span className="text-amber-500">POS</span></h1>
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{company.name}</p>
        </div>
        <nav className="flex gap-2 bg-slate-100 p-1.5 rounded-2xl">
          <button onClick={() => setActiveTab('KASSA')} className={`px-6 py-2.5 rounded-xl font-black text-xs transition-all ${activeTab === 'KASSA' ? 'bg-white shadow-md text-slate-900' : 'text-slate-500'}`}>KASSA</button>
          <button onClick={() => setActiveTab('RAPPORT')} className={`px-6 py-2.5 rounded-xl font-black text-xs transition-all ${activeTab === 'RAPPORT' ? 'bg-white shadow-md text-slate-900' : 'text-slate-500'}`}>RAPPORT</button>
          <button onClick={() => setActiveTab('ADMIN')} className={`px-6 py-2.5 rounded-xl font-black text-xs transition-all ${activeTab === 'ADMIN' ? 'bg-white shadow-md text-slate-900' : 'text-slate-500'}`}>ADMIN</button>
        </nav>
      </header>

      <main className="flex-1 flex flex-col md:flex-row overflow-hidden">
        {activeTab === 'KASSA' && (
          <>
            {/* GRID - EXACT 4 COLUMNS AS REQUESTED */}
            <div className="flex-1 p-4 grid grid-cols-4 gap-4 overflow-y-auto content-start">
              {products.map(p => (
                <button 
                  key={p.id} 
                  onClick={() => addToCart(p)}
                  className={`${p.color} p-4 rounded-[2.5rem] font-black shadow-sm flex flex-col items-center justify-center active:scale-95 transition-all border-b-4 border-black/10 min-h-[140px]`}
                >
                  <span className="text-[11px] uppercase mb-2 text-center leading-tight">{p.name}</span>
                  <span className="text-xs bg-white/50 px-4 py-1.5 rounded-full ring-1 ring-black/5">€{p.price.toFixed(2).replace('.', ',')}</span>
                </button>
              ))}
            </div>

            {/* CART - RIGHT SIDE */}
            <div className="w-full md:w-[400px] bg-white border-l flex flex-col shadow-2xl shrink-0 font-mono">
              <div className="p-4 border-b font-black text-xs uppercase text-slate-400 text-center tracking-[0.2em]">Huidige Bestelling</div>
              <div className="flex-1 overflow-y-auto p-4 space-y-3">
                {cart.map(item => (
                  <div key={item.id} className="flex justify-between items-center bg-slate-50 p-4 rounded-2xl border border-slate-100">
                    <div className="flex flex-col">
                      <span className="font-bold text-xs uppercase">{item.name}</span>
                      <span className="text-[10px] text-slate-400">€{item.price.toFixed(2)} p.st.</span>
                    </div>
                    <div className="flex items-center gap-4">
                      <button onClick={() => setCart(cart.map(i => i.id === item.id ? {...i, quantity: i.quantity - 1} : i).filter(i => i.quantity > 0))} className="w-10 h-10 bg-white border-2 rounded-xl shadow-sm text-red-500 font-black text-xl">-</button>
                      <span className="font-black text-base w-6 text-center">{item.quantity}</span>
                      <button onClick={() => setCart(cart.map(i => i.id === item.id ? {...i, quantity: i.quantity + 1} : i))} className="w-10 h-10 bg-white border-2 rounded-xl shadow-sm text-green-500 font-black text-xl">+</button>
                    </div>
                  </div>
                ))}
              </div>
              
              {/* TOTALS & PAY */}
              <div className="p-6 bg-slate-900 text-white rounded-t-[3rem] shadow-[0_-10px_40px_rgba(0,0,0,0.2)]">
                <div className="space-y-1 mb-6">
                  <div className="flex justify-between text-slate-500 text-[10px] uppercase font-bold px-1">
                    <span>Excl. BTW</span>
                    <span>€{totals.subtotal.toFixed(2).replace('.', ',')}</span>
                  </div>
                  <div className="flex justify-between text-amber-500 text-3xl font-black italic tracking-tighter">
                    <span className="text-xs self-center not-italic uppercase text-slate-400">Totaal</span>
                    <span>€{totals.total.toFixed(2).replace('.', ',')}</span>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <button onClick={() => finalizeTransaction('CASH')} className="bg-emerald-600 py-5 rounded-2xl font-black text-xs uppercase shadow-lg active:bg-emerald-700 transition-colors tracking-widest">Contant</button>
                  <button onClick={() => finalizeTransaction('KAART')} className="bg-blue-600 py-5 rounded-2xl font-black text-xs uppercase shadow-lg active:bg-blue-700 transition-colors tracking-widest">Bankkaart</button>
                </div>
              </div>
            </div>
          </>
        )}

        {/* ... RAPPORT & ADMIN TABS (Vergelijkbaar met professionele opzet) ... */}
        {activeTab === 'ADMIN' && (
          <div className="flex-1 p-8 overflow-y-auto max-w-2xl mx-auto w-full space-y-8">
            <h2 className="font-black text-3xl uppercase italic tracking-tighter">Beheer</h2>
            <div className="bg-white p-8 rounded-[2.5rem] border shadow-sm space-y-4">
              <h3 className="font-black text-xs uppercase text-slate-400 mb-4 tracking-widest">Bedrijfsgegevens</h3>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-[10px] font-black ml-2 uppercase">Bedrijfsnaam</label>
                  <input className="w-full p-4 bg-slate-50 rounded-2xl border-2 border-slate-100 font-bold text-sm focus:border-amber-500 outline-none" value={company.name} onChange={(e)=>setCompany({...company, name: e.target.value})} />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-black ml-2 uppercase">BTW Nummer</label>
                  <input className="w-full p-4 bg-slate-50 rounded-2xl border-2 border-slate-100 font-bold text-sm" value={company.vatNumber} onChange={(e)=>setCompany({...company, vatNumber: e.target.value})} />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-black ml-2 uppercase">Adres Lijn 1</label>
                  <input className="w-full p-4 bg-slate-50 rounded-2xl border-2 border-slate-100 font-bold text-sm" value={company.address} onChange={(e)=>setCompany({...company, address: e.target.value})} />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-black ml-2 uppercase">Adres Lijn 2</label>
                  <input className="w-full p-4 bg-slate-50 rounded-2xl border-2 border-slate-100 font-bold text-sm" value={company.address2} onChange={(e)=>setCompany({...company, address2: e.target.value})} />
                </div>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* MODAL RECEIPT (EXACT ORIGINAL STYLE) */}
      {selectedTx && (
        <div className="fixed inset-0 bg-slate-900/90 flex items-center justify-center p-4 z-50 backdrop-blur-sm">
          <div className="bg-white p-8 rounded-[2.5rem] w-full max-w-[320px] shadow-2xl font-mono text-xs">
            <div className="text-center border-b-2 border-black pb-4 mb-4">
              <p className="font-black text-lg uppercase leading-none mb-1">{company.name}</p>
              <p className="text-[9px]">{company.address}<br/>{company.address2}<br/>BTW: {company.vatNumber}</p>
            </div>
            <div className="space-y-1 mb-4 border-b border-dashed pb-4">
              {selectedTx.items.map((i, idx) => (
                <div key={idx} className="flex justify-between uppercase font-bold text-[10px]">
                  <span>{i.quantity}x {i.name}</span>
                  <span>€{(i.price * i.quantity).toFixed(2).replace('.', ',')}</span>
                </div>
              ))}
            </div>
            <div className="flex justify-between font-black text-lg mb-2">
              <span>TOTAAL</span>
              <span>€{selectedTx.total.toFixed(2).replace('.', ',')}</span>
            </div>
            <div className="text-[9px] text-slate-500 uppercase">
              <div className="flex justify-between border-t pt-2"><span>Betaald via:</span><span>{selectedTx.paymentMethod}</span></div>
              <div className="flex justify-between"><span>Verkoper:</span><span>{selectedTx.sellerName}</span></div>
              <div className="flex justify-between"><span>Datum:</span><span>{selectedTx.dateStr} {selectedTx.id}</span></div>
            </div>
            <button onClick={() => setSelectedTx(null)} className="w-full mt-8 bg-slate-900 text-white py-5 rounded-2xl font-black text-xs uppercase tracking-widest active:scale-95 transition-all">Sluiten</button>
          </div>
        </div>
      )}
    </div>
  );
}
