import React, { useState, useEffect, useMemo } from 'react';
import { 
  ShoppingBag, Trash2, CreditCard, Banknote, BarChart3, 
  Settings, Printer, Plus, Minus, X, Building, Tag, User, History
} from 'lucide-react';
import { Product, CartItem, Transaction, PaymentMethod, CompanyDetails, SalesSession } from './types';
import { DEFAULT_COMPANY, INITIAL_PRODUCTS } from './constants';
import { Receipt } from './components/Receipt.tsx';

export default function App() {
  const [products, setProducts] = useState<Product[]>(INITIAL_PRODUCTS);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [sessions, setSessions] = useState<SalesSession[]>([]);
  const [company, setCompany] = useState<CompanyDetails>({
    ...DEFAULT_COMPANY,
    addressLine2: '',
    sellers: ['Beheerder']
  });
  const [selectedSeller, setSelectedSeller] = useState('Beheerder');
  const [activeTab, setActiveTab] = useState<'POS' | 'REPORTS' | 'SETTINGS'>('POS');
  const [currentSession, setCurrentSession] = useState<SalesSession | null>(null);
  const [previewTransaction, setPreviewTransaction] = useState<Transaction | null>(null);
  const [viewingSession, setViewingSession] = useState<SalesSession | null>(null);
  const [pendingCardPayment, setPendingCardPayment] = useState(false);
  const [startFloatAmount, setStartFloatAmount] = useState<string>('0');

  // --- Opslag ---
  useEffect(() => {
    const saved = localStorage.getItem('barpos_final_stable');
    if (saved) {
      const d = JSON.parse(saved);
      setProducts(d.products || INITIAL_PRODUCTS);
      setTransactions(d.transactions || []);
      setSessions(d.sessions || []);
      setCompany(d.company || company);
    }
  }, []);

  useEffect(() => {
    localStorage.setItem('barpos_final_stable', JSON.stringify({ products, transactions, sessions, company }));
  }, [products, transactions, sessions, company]);

  const cartTotal = useMemo(() => cart.reduce((a, b) => a + (b.price * b.quantity), 0), [cart]);

  // --- Functies ---
  const addToCart = (product: Product) => {
    if (!currentSession) {
      alert("⚠️ Open de kassa bij Instellingen!");
      setActiveTab('SETTINGS');
      return;
    }
    setCart(prev => {
      const ex = prev.find(i => i.id === product.id);
      if (ex) return prev.map(i => i.id === product.id ? { ...i, quantity: i.quantity + 1 } : i);
      return [...prev, { ...product, quantity: 1 }];
    });
  };

  const finalizePayment = (method: PaymentMethod) => {
    if (!currentSession) return;
    const newTx: Transaction = {
      id: `TR-${Date.now().toString().slice(-4)}`,
      sessionId: currentSession.id,
      timestamp: Date.now(),
      dateStr: new Date().toLocaleDateString('nl-NL'),
      items: [...cart],
      total: cartTotal,
      paymentMethod: method,
      seller: selectedSeller,
      vat21: cartTotal * 0.21 
    };
    setTransactions(prev => [newTx, ...prev]);
    setCart([]);
    setPendingCardPayment(false);
    setPreviewTransaction(newTx);
  };

  return (
    <div className="flex flex-col h-screen bg-slate-100 text-slate-900 overflow-hidden font-sans">
      
      {/* MENU BOVENAAN */}
      <header className="bg-slate-900 text-white p-4 flex items-center justify-between shadow-lg z-50 shrink-0">
        <div className="flex items-center gap-2">
          <ShoppingBag className="text-amber-500" size={24} />
          <span className="font-black tracking-tighter text-xl">BAR POS</span>
        </div>
        <nav className="flex gap-1 sm:gap-2">
          <button onClick={() => setActiveTab('POS')} className={`px-4 py-2 rounded-xl font-black text-[10px] sm:text-xs transition-all ${activeTab === 'POS' ? 'bg-amber-500 text-white' : 'text-slate-400 hover:bg-slate-800'}`}>KASSA</button>
          <button onClick={() => setActiveTab('REPORTS')} className={`px-4 py-2 rounded-xl font-black text-[10px] sm:text-xs transition-all ${activeTab === 'REPORTS' ? 'bg-amber-500 text-white' : 'text-slate-400 hover:bg-slate-800'}`}>RAPPORT</button>
          <button onClick={() => setActiveTab('SETTINGS')} className={`px-4 py-2 rounded-xl font-black text-[10px] sm:text-xs transition-all ${activeTab === 'SETTINGS' ? 'bg-amber-500 text-white' : 'text-slate-400 hover:bg-slate-800'}`}>INSTELLINGEN</button>
        </nav>
      </header>

      <main className="flex-1 flex flex-col md:flex-row overflow-hidden relative">
        
        {/* KASSA SCHERM */}
        {activeTab === 'POS' && (
          <>
            {/* GRID: 4 OP EEN RIJ OP DESKTOP */}
            <div className="flex-1 p-4 grid grid-cols-2 sm:grid-cols-4 gap-3 overflow-y-auto content-start pb-24">
              {products.map(p => (
                <button key={p.id} onClick={() => addToCart(p)} className={`${p.color} p-6 rounded-[2rem] font-black shadow-sm flex flex-col items-center justify-center min-h-[110px] active:scale-95 transition-all border-b-4 border-black/10`}>
                  <span className="text-[11px] uppercase text-center mb-1 leading-tight">{p.name}</span>
                  <span className="text-xs bg-white/40 px-3 py-0.5 rounded-full">€{p.price.toFixed(2)}</span>
                </button>
              ))}
            </div>

            {/* MANDJE */}
            <div className="w-full md:w-[380px] bg-white border-t md:border-l flex flex-col h-[45%] md:h-full z-10 shadow-2xl">
              <div className="p-4 bg-slate-50 border-b">
                <label className="text-[9px] font-black text-slate-400 uppercase block mb-1">Huidige Verkoper</label>
                <select value={selectedSeller} onChange={(e) => setSelectedSeller(e.target.value)} className="w-full bg-white border p-3 rounded-xl font-black text-xs uppercase outline-none focus:ring-2 ring-amber-500/20">
                  {company.sellers?.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
              
              <div className="flex-1 overflow-y-auto p-4 space-y-2">
                {cart.length === 0 && <div className="h-full flex items-center justify-center text-slate-300 font-black text-xs uppercase tracking-widest">Mandje is leeg</div>}
                {cart.map(item => (
                  <div key={item.id} className="flex justify-between items-center p-3 bg-slate-50 rounded-2xl border border-slate-100">
                    <span className="font-black text-[10px] uppercase truncate flex-1 pr-2">{item.name}</span>
                    <div className="flex items-center gap-3">
                      <button onClick={() => setCart(cart.map(i => i.id === item.id ? {...i, quantity: i.quantity - 1} : i).filter(i => i.quantity > 0))} className="w-8 h-8 bg-white shadow rounded-lg text-red-500 font-bold">-</button>
                      <span className="font-bold text-sm min-w-[20px] text-center">{item.quantity}</span>
                      <button onClick={() => setCart(cart.map(i => i.id === item.id ? {...i, quantity: i.quantity + 1} : i))} className="w-8 h-8 bg-white shadow rounded-lg text-green-500 font-bold">+</button>
                    </div>
                  </div>
                ))}
              </div>

              <div className="p-6 bg-slate-900 text-white rounded-t-[3rem] md:rounded-none">
                <div className="flex justify-between text-3xl font-black mb-6 italic tracking-tighter">
                  <span className="text-slate-500 text-xs self-center uppercase tracking-widest">Totaal</span>
                  <span className="text-amber-500">€{cartTotal.toFixed(2)}</span>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <button onClick={() => finalizePayment(PaymentMethod.CASH)} className="bg-green-600 p-5 rounded-2xl font-black flex flex-col items-center gap-1 uppercase text-[10px] tracking-widest shadow-lg active:scale-95 transition-all"><Banknote size={24}/> Cash</button>
                  <button onClick={() => setPendingCardPayment(true)} className="bg-blue-600 p-5 rounded-2xl font-black flex flex-col items-center gap-1 uppercase text-[10px] tracking-widest shadow-lg active:scale-95 transition-all"><CreditCard size={24}/> Kaart</button>
                </div>
              </div>
            </div>
          </>
        )}

        {/* INSTELLINGEN SCHERM */}
        {activeTab === 'SETTINGS' && (
          <div className="absolute inset-0 overflow-y-auto p-4 sm:p-8 space-y-8 max-w-2xl mx-auto pb-32">
            
            {/* BEDRIJF */}
            <section className="bg-white p-6 rounded-[2.5rem] shadow-sm border space-y-4">
              <h3 className="font-black text-xs uppercase text-slate-400 flex items-center gap-2 mb-2"><Building size={16}/> Bedrijfsgegevens</h3>
              <div className="space-y-4">
                <div className="border-b"><label className="text-[9px] font-black text-slate-400 uppercase">Naam Zaak</label><input className="w-full py-2 bg-transparent font-bold text-sm outline-none" value={company.name} onChange={e => setCompany({...company, name: e.target.value})} /></div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="border-b"><label className="text-[9px] font-black text-slate-400 uppercase">Adres Lijn 1</label><input className="w-full py-2 bg-transparent font-bold text-sm outline-none" value={company.address} onChange={e => setCompany({...company, address: e.target.value})} /></div>
                  <div className="border-b"><label className="text-[9px] font-black text-slate-400 uppercase">Adres Lijn 2</label><input className="w-full py-2 bg-transparent font-bold text-sm outline-none" value={company.addressLine2} onChange={e => setCompany({...company, addressLine2: e.target.value})} /></div>
                </div>
                <div className="border-b"><label className="text-[9px] font-black text-slate-400 uppercase">BTW Nummer</label><input className="w-full py-2 bg-transparent font-bold text-sm outline-none" value={company.vatNumber} onChange={e => setCompany({...company, vatNumber: e.target.value})} /></div>
              </div>
            </section>

            {/* VERKOPERS */}
            <section className="bg-white p-6 rounded-[2.5rem] shadow-sm border">
              <h3 className="font-black text-xs uppercase text-slate-400 mb-4 flex items-center gap-2"><User size={16}/> Verkopers Beheren</h3>
              <div className="flex flex-wrap gap-2 mb-6">
                {company.sellers?.map(s => (
                  <span key={s} className="bg-slate-100 px-4 py-2 rounded-full font-black text-[10px] flex items-center gap-3">
                    {s} <button onClick={() => setCompany({...company, sellers: company.sellers?.filter(x => x !== s)})} className="text-red-500 hover:scale-125 transition-all"><X size={14}/></button>
                  </span>
                ))}
              </div>
              <div className="flex gap-2">
                <input id="seller-input" className="flex-1 p-4 bg-slate-50 rounded-2xl font-bold text-sm outline-none border focus:border-amber-500" placeholder="Naam nieuwe verkoper..." />
                <button onClick={() => {
                  const el = document.getElementById('seller-input') as HTMLInputElement;
                  if(el.value) { setCompany({...company, sellers: [...(company.sellers || []), el.value]}); el.value = ''; }
                }} className="bg-slate-900 text-white px-8 rounded-2xl font-black text-xs">VOEG TOE</button>
              </div>
            </section>

            {/* PRODUCTEN */}
            <section className="bg-white p-6 rounded-[2.5rem] shadow-sm border">
              <h3 className="font-black text-xs uppercase text-slate-400 mb-6 flex items-center gap-2"><Tag size={16}/> Productbeheer & BTW</h3>
              <div className="space-y-4">
                {products.map(p => (
                  <div key={p.id} className="p-5 bg-slate-50 rounded-[2rem] space-y-4 border border-slate-100">
                    <div className="flex gap-3">
                      <input className="flex-1 bg-transparent font-black uppercase text-xs border-b border-slate-200 outline-none focus:border-amber-500 py-1" value={p.name} onChange={e => setProducts(products.map(x => x.id === p.id ? {...x, name: e.target.value} : x))} />
                      <button onClick={() => setProducts(products.filter(x => x.id !== p.id))} className="text-red-300 hover:text-red-500 transition-colors"><Trash2 size={20}/></button>
                    </div>
                    <div className="flex flex-wrap items-center gap-4">
                      <div className="flex items-center gap-2 bg-white px-3 py-2 rounded-xl border shadow-sm">
                        <span className="text-[10px] font-black text-slate-400">€</span>
                        <input type="number" className="w-16 font-black text-sm outline-none" value={p.price} onChange={e => setProducts(products.map(x => x.id === p.id ? {...x, price: parseFloat(e.target.value)} : x))} />
                      </div>
                      <div className="flex gap-1 bg-white p-1 rounded-xl shadow-sm border">
                        {[0, 6, 12, 21].map(v => (
                          <button key={v} onClick={() => setProducts(products.map(x => x.id === p.id ? {...x, vatRate: v} : x))} className={`px-3 py-1.5 rounded-lg text-[10px] font-black transition-all ${p.vatRate === v ? 'bg-amber-500 text-white shadow-md' : 'text-slate-300 hover:bg-slate-50'}`}>{v}%</button>
                        ))}
                      </div>
                    </div>
                  </div>
                ))}
                <button onClick={() => setProducts([...products, { id: Date.now().toString(), name: 'NIEUW PRODUCT', price: 0, vatRate: 21, color: 'bg-slate-200', stock: 100 }])} className="w-full py-5 border-2 border-dashed border-slate-200 rounded-[2rem] font-black text-slate-400 text-xs hover:border-amber-500 hover:text-amber-500 transition-all">+ VOEG PRODUCT TOE</button>
              </div>
            </section>

            {/* KASSA SESSIE */}
            <section className="bg-slate-900 p-8 rounded-[3rem] text-white shadow-2xl">
              <h3 className="font-black text-xs uppercase text-slate-500 mb-6 text-center tracking-widest">Kassa Controle</h3>
              {!currentSession ? (
                <div className="space-y-4">
                  <input type="number" value={startFloatAmount} onChange={e => setStartFloatAmount(e.target.value)} className="w-full p-5 bg-white/10 rounded-2xl text-center font-black text-3xl outline-none" placeholder="0.00" />
                  <button onClick={() => {
                    const s = { id: Date.now().toString(), startTime: Date.now(), startCash: parseFloat(startFloatAmount) || 0, status: 'OPEN' as const };
                    setSessions([...sessions, s]); setCurrentSession(s); setActiveTab('POS');
                  }} className="w-full bg-green-600 py-5 rounded-2xl font-black uppercase text-sm tracking-widest shadow-xl shadow-green-900/20">Sessie Starten</button>
                </div>
              ) : (
                <button onClick={() => {
                  if(window.confirm("Dagrapport genereren en kassa sluiten?")) {
                    setSessions(sessions.map(s => s.id === currentSession.id ? {...s, status: 'CLOSED' as const, endTime: Date.now()} : s));
                    setCurrentSession(null);
                  }
                }} className="w-full bg-red-500 py-5 rounded-2xl font-black uppercase text-sm tracking-widest shadow-xl shadow-red-900/20">Kassa Afsluiten (Z-Rapport)</button>
              )}
            </section>
          </div>
        )}

        {/* RAPPORTEN SCHERM */}
        {activeTab === 'REPORTS' && (
          <div className="flex-1 p-6 overflow-y-auto space-y-6 max-w-3xl mx-auto pb-24">
            <h2 className="font-black text-2xl italic mb-8 flex items-center gap-3"><History /> Rapportage</h2>
            
            <div className="space-y-4">
              {sessions.length === 0 && <div className="text-center py-20 text-slate-300 font-black uppercase text-xs tracking-[0.2em]">Nog geen gegevens beschikbaar</div>}
              {sessions.slice().reverse().map(s => (
                <div key={s.id} className="bg-white p-6 rounded-[2rem] border-2 border-slate-50 flex items-center justify-between shadow-sm hover:border-amber-500 transition-all">
                  <div className="flex items-center gap-4">
                    <div className={`p-3 rounded-2xl ${s.status === 'OPEN' ? 'bg-green-100 text-green-600' : 'bg-slate-100 text-slate-400'}`}><Printer size={20}/></div>
                    <div>
                      <div className="font-black text-sm">{new Date(s.startTime).toLocaleDateString('nl-NL')}</div>
                      <div className="text-[10px] font-black uppercase text-slate-400">{s.status === 'OPEN' ? '🟢 Nu Actief' : '🔴 Afgesloten'}</div>
                    </div>
                  </div>
                  <button onClick={() => setViewingSession(s)} className="bg-slate-900 text-white px-6 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest shadow-lg">Bekijk</button>
                </div>
              ))}
            </div>
            
            <h3 className="font-black text-xs uppercase text-slate-400 mt-12 mb-4">Laatste 10 Verkopen</h3>
            <div className="space-y-2">
              {transactions.slice(0, 10).map(tx => (
                <div key={tx.id} className="bg-white/50 p-4 rounded-2xl border flex justify-between items-center">
                  <div className="text-[10px] font-bold">
                    <span className="text-slate-400 mr-2">{new Date(tx.timestamp).toLocaleTimeString()}</span>
                    <span className="uppercase">{tx.paymentMethod}</span>
                  </div>
                  <div className="font-black text-xs">€{tx.total.toFixed(2)}</div>
                  <button onClick={() => setPreviewTransaction(tx)} className="text-amber-500"><Printer size={16}/></button>
                </div>
              ))}
            </div>
          </div>
        )}
      </main>

      {/* POPUPS */}
      {(previewTransaction || viewingSession) && (
        <div className="fixed inset-0 z-[100] bg-black/80 flex items-center justify-center p-4 backdrop-blur-md animate-in fade-in">
          <div className="bg-white p-8 rounded-[3rem] w-full max-w-sm max-h-[85vh] overflow-y-auto shadow-2xl relative">
            <button onClick={() => {setPreviewTransaction(null); setViewingSession(null);}} className="absolute top-6 right-6 text-slate-300 hover:text-slate-900"><X size={24}/></button>
            <Receipt transaction={previewTransaction} sessionSummary={viewingSession} company={company} />
            <div className="mt-8 flex flex-col gap-2">
              <button onClick={() => window.print()} className="bg-slate-900 text-white py-5 rounded-2xl font-black uppercase text-xs flex items-center justify-center gap-3 shadow-xl active:scale-95 transition-all"><Printer size={20}/> Nu Printen</button>
              <button onClick={() => {setPreviewTransaction(null); setViewingSession(null);}} className="bg-slate-100 text-slate-400 py-4 rounded-2xl font-black uppercase text-[10px] tracking-widest">Sluiten</button>
            </div>
          </div>
        </div>
      )}

      {pendingCardPayment && (
        <div className="fixed inset-0 z-[200] bg-slate-900/95 flex items-center justify-center p-4 text-white animate-in zoom-in-95">
          <div className="text-center w-full max-w-xs">
            <CreditCard size={80} className="mx-auto mb-8 text-blue-500 animate-pulse" />
            <div className="text-xs font-black text-slate-500 uppercase tracking-[0.3em] mb-2">Totaal te betalen</div>
            <h2 className="text-6xl font-black mb-12 italic tracking-tighter text-blue-400">€{cartTotal.toFixed(2)}</h2>
            <button onClick={() => finalizePayment(PaymentMethod.CARD)} className="w-full bg-blue-600 py-6 rounded-[2rem] font-black text-2xl shadow-2xl shadow-blue-500/20 active:scale-95 transition-all">BETAALD</button>
            <button onClick={() => setPendingCardPayment(false)} className="block mx-auto mt-10 text-slate-500 font-black text-xs uppercase tracking-widest hover:text-white transition-colors">Annuleren</button>
          </div>
        </div>
      )}
    </div>
  );
}
