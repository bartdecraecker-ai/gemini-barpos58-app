import React, { useState, useEffect, useMemo } from 'react';
import { 
  ShoppingBag, Trash2, CreditCard, Banknote, BarChart3, 
  Settings, Printer, Plus, Minus, X, Building, Tag, Bluetooth, Circle
} from 'lucide-react';
import { Product, CartItem, Transaction, PaymentMethod, CompanyDetails, SalesSession } from './types';
import { DEFAULT_COMPANY, INITIAL_PRODUCTS } from './constants';
import { Receipt } from './components/Receipt.tsx';
import { btPrinterService } from './services/bluetoothPrinter';

export default function App() {
  // --- State ---
  const [products, setProducts] = useState<Product[]>(INITIAL_PRODUCTS);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [sessions, setSessions] = useState<SalesSession[]>([]);
  const [company, setCompany] = useState<CompanyDetails>(DEFAULT_COMPANY);
  const [activeTab, setActiveTab] = useState<'POS' | 'REPORTS' | 'SETTINGS'>('POS');
  const [currentSession, setCurrentSession] = useState<SalesSession | null>(null);
  const [previewTransaction, setPreviewTransaction] = useState<Transaction | null>(null);
  const [viewingSession, setViewingSession] = useState<SalesSession | null>(null);
  const [pendingCardPayment, setPendingCardPayment] = useState(false);
  const [startFloatAmount, setStartFloatAmount] = useState<string>('0');
  const [btConnected, setBtConnected] = useState(false);

  // --- Effect: Load & Save ---
  useEffect(() => {
    const savedTx = localStorage.getItem('barpos_transactions');
    const savedProducts = localStorage.getItem('barpos_products');
    const savedSessions = localStorage.getItem('barpos_sessions');
    const savedCompany = localStorage.getItem('barpos_company');
    if (savedTx) setTransactions(JSON.parse(savedTx));
    if (savedProducts) setProducts(JSON.parse(savedProducts));
    if (savedCompany) setCompany(JSON.parse(savedCompany));
    if (savedSessions) {
      const parsed = JSON.parse(savedSessions) as SalesSession[];
      setSessions(parsed);
      setCurrentSession(parsed.find(s => s.status === 'OPEN') || null);
    }
  }, []);

  useEffect(() => {
    localStorage.setItem('barpos_transactions', JSON.stringify(transactions));
    localStorage.setItem('barpos_products', JSON.stringify(products));
    localStorage.setItem('barpos_sessions', JSON.stringify(sessions));
    localStorage.setItem('barpos_company', JSON.stringify(company));
  }, [transactions, products, sessions, company]);

  // --- Logica ---
  const cartTotal = useMemo(() => cart.reduce((a, b) => a + (b.price * b.quantity), 0), [cart]);

  const addToCart = (product: Product) => {
    if (!currentSession) {
      alert("⚠️ KASSA IS GESLOTEN! Open de kassa bij Instellingen.");
      setActiveTab('SETTINGS');
      return;
    }
    setCart(prev => {
      const existing = prev.find(item => item.id === product.id);
      if (existing) return prev.map(item => item.id === product.id ? { ...item, quantity: item.quantity + 1 } : item);
      return [...prev, { ...product, quantity: 1 }];
    });
  };

  const finalizePayment = async (method: PaymentMethod) => {
    if (!currentSession) return;
    const vat21 = cart.reduce((a, b) => b.vatRate === 21 ? a + (b.price * b.quantity - (b.price * b.quantity / 1.21)) : a, 0);
    const newTx: Transaction = {
      id: `TR-${Date.now().toString().slice(-4)}`,
      sessionId: currentSession.id,
      timestamp: Date.now(),
      dateStr: new Date().toLocaleDateString('nl-NL'),
      items: [...cart],
      total: cartTotal,
      vat0: cartTotal - vat21,
      vat21: vat21,
      paymentMethod: method,
      subtotal: cartTotal - vat21
    };
    setTransactions([newTx, ...transactions]);
    setCart([]);
    setPendingCardPayment(false);
    setPreviewTransaction(newTx);
  };

  const calculateSessionTotals = (sessionId: string, startCash: number) => {
    const sessionTx = transactions.filter(t => t.sessionId === sessionId);
    const productSales: Record<string, number> = {};
    const summary = sessionTx.reduce((acc, tx) => {
      tx.items.forEach(item => { productSales[item.name] = (productSales[item.name] || 0) + item.quantity; });
      return {
        totalSales: acc.totalSales + tx.total,
        transactionCount: acc.transactionCount + 1,
        cashTotal: acc.cashTotal + (tx.paymentMethod === PaymentMethod.CASH ? tx.total : 0),
        cardTotal: acc.cardTotal + (tx.paymentMethod === PaymentMethod.CARD ? tx.total : 0),
        vat0Total: acc.vat0Total + (tx.vat0 || 0),
        vat21Total: acc.vat21Total + (tx.vat21 || 0),
      };
    }, { totalSales: 0, transactionCount: 0, cashTotal: 0, cardTotal: 0, vat0Total: 0, vat21Total: 0 });
    return { summary: { ...summary, productSales }, expectedDrawer: startCash + summary.cashTotal };
  };

  return (
    <div className="flex flex-col h-screen bg-slate-100 text-slate-900 font-sans overflow-hidden">
      
      {/* HEADER MENU (BOVENAAN) */}
      <header className="bg-slate-900 text-white p-4 shadow-xl flex items-center justify-between z-50">
        <div className="flex items-center gap-2">
          <div className="bg-amber-500 p-2 rounded-lg"><ShoppingBag size={20}/></div>
          <h1 className="font-black tracking-tighter hidden sm:block">BAR POS</h1>
        </div>
        
        <nav className="flex gap-2">
          <button onClick={() => setActiveTab('POS')} className={`px-4 py-2 rounded-xl font-bold flex items-center gap-2 transition-all ${activeTab === 'POS' ? 'bg-amber-500' : 'hover:bg-slate-800'}`}>
            <ShoppingBag size={18}/> <span className="hidden sm:inline">Kassa</span>
          </button>
          <button onClick={() => setActiveTab('REPORTS')} className={`px-4 py-2 rounded-xl font-bold flex items-center gap-2 transition-all ${activeTab === 'REPORTS' ? 'bg-amber-500' : 'hover:bg-slate-800'}`}>
            <BarChart3 size={18}/> <span className="hidden sm:inline">Rapport</span>
          </button>
          <button onClick={() => setActiveTab('SETTINGS')} className={`px-4 py-2 rounded-xl font-bold flex items-center gap-2 transition-all ${activeTab === 'SETTINGS' ? 'bg-amber-500' : 'hover:bg-slate-800'}`}>
            <Settings size={18}/> 
            <span className="hidden sm:inline">Instellingen</span>
            {currentSession && <span className="ml-1 text-[10px] text-green-400 flex items-center gap-1">● Open</span>}
          </button>
        </nav>
      </header>

      {/* MAIN CONTENT */}
      <main className="flex-1 overflow-hidden relative flex flex-col">
        
        {/* POS SCHERM */}
        {activeTab === 'POS' && (
          <div className="flex flex-col md:flex-row h-full overflow-hidden">
            {/* PRODUCTEN GRID */}
            <div className="flex-1 p-4 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 overflow-y-auto content-start pb-20">
              {products.map(p => (
                <button key={p.id} onClick={() => addToCart(p)} className={`${p.color} p-6 rounded-[2rem] font-black shadow-md hover:shadow-xl active:scale-95 transition-all flex flex-col items-center justify-center min-h-[120px] border-b-4 border-black/10`}>
                  <span className="text-sm uppercase text-center leading-tight mb-2">{p.name}</span>
                  <span className="text-base bg-white/40 px-4 py-1 rounded-full shadow-inner">€{p.price.toFixed(2)}</span>
                </button>
              ))}
            </div>

            {/* MANDJE (Desktop rechts, Mobiel onderaan) */}
            <div className="w-full md:w-[400px] bg-white border-t md:border-t-0 md:border-l flex flex-col h-[45%] md:h-full shadow-2xl z-40">
              <div className="p-4 bg-slate-50 border-b flex justify-between items-center">
                <span className="font-black text-xs tracking-widest uppercase text-slate-400">Winkelmand</span>
                <button onClick={() => setCart([])} className="text-red-500 font-bold text-[10px] hover:underline uppercase">Leegmaken</button>
              </div>
              <div className="flex-1 overflow-y-auto p-3 space-y-2">
                {cart.map(item => (
                  <div key={item.id} className="flex items-center justify-between p-3 bg-slate-50 rounded-2xl border border-slate-100 animate-in fade-in slide-in-from-right-2">
                    <div className="flex items-center gap-3">
                      <div className="flex flex-col items-center">
                        <button onClick={() => { const val = cart.find(i => i.id === item.id)?.quantity || 0; if (val > 0) setActiveTab('POS'); }} className="text-xs font-black">{item.quantity}x</button>
                      </div>
                      <span className="font-black text-xs uppercase truncate w-32">{item.name}</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="font-black text-sm">€{(item.price * item.quantity).toFixed(2)}</span>
                      <button onClick={() => setCart(cart.filter(i => i.id !== item.id))} className="text-slate-300 hover:text-red-500"><Trash2 size={16}/></button>
                    </div>
                  </div>
                ))}
              </div>
              {/* FIXED BETAAL ZONE */}
              <div className="p-6 bg-slate-900 text-white rounded-t-[3rem] md:rounded-none">
                <div className="flex justify-between text-3xl font-black mb-6 italic tracking-tighter">
                  <span className="text-slate-500 uppercase text-lg self-center">Totaal</span>
                  <span className="text-amber-500">€{cartTotal.toFixed(2)}</span>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <button onClick={() => finalizePayment(PaymentMethod.CASH)} className="bg-green-600 p-5 rounded-2xl font-black flex flex-col items-center shadow-lg active:scale-95 transition-all">
                    <Banknote className="mb-1"/> CASH
                  </button>
                  <button onClick={() => setPendingCardPayment(true)} className="bg-blue-600 p-5 rounded-2xl font-black flex flex-col items-center shadow-lg active:scale-95 transition-all">
                    <CreditCard className="mb-1"/> KAART
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* RAPPORTEN SCHERM */}
        {activeTab === 'REPORTS' && (
          <div className="p-6 overflow-y-auto h-full w-full max-w-4xl mx-auto space-y-4">
            <h2 className="text-3xl font-black italic mb-8">Dagrapporten</h2>
            {sessions.length === 0 && <div className="text-center p-20 text-slate-300 font-bold uppercase tracking-widest">Nog geen rapporten beschikbaar</div>}
            {sessions.slice().reverse().map(s => (
              <div key={s.id} className="bg-white p-6 rounded-[2rem] border-2 border-slate-100 flex items-center justify-between hover:border-amber-500 transition-all shadow-sm">
                <div className="flex items-center gap-4">
                  <div className={`p-4 rounded-2xl ${s.status === 'OPEN' ? 'bg-green-100 text-green-600' : 'bg-slate-100 text-slate-400'}`}><Printer size={24}/></div>
                  <div>
                    <div className="font-black text-lg">{new Date(s.startTime).toLocaleDateString('nl-NL')}</div>
                    <div className="text-[10px] font-black uppercase text-slate-400 tracking-widest">{s.status === 'OPEN' ? '🟢 Actieve Sessie' : '🔴 Afgesloten'}</div>
                  </div>
                </div>
                <button onClick={() => { const d = calculateSessionTotals(s.id, s.startCash); setViewingSession({ ...s, summary: d.summary }); }} className="bg-slate-900 text-white px-6 py-4 rounded-xl font-black shadow-lg">BEKIJK</button>
              </div>
            ))}
          </div>
        )}

        {/* INSTELLINGEN SCHERM */}
        {activeTab === 'SETTINGS' && (
          <div className="p-6 overflow-y-auto h-full w-full max-w-3xl mx-auto space-y-10 pb-20">
            {/* Kassa Beheer */}
            <section className="bg-white p-8 rounded-[2.5rem] shadow-sm border-2 border-slate-100">
              <h3 className="font-black uppercase text-xs tracking-[0.2em] text-slate-400 mb-6 flex items-center gap-2 italic underline underline-offset-8">Kassa Status</h3>
              {!currentSession ? (
                <div className="space-y-4">
                  <p className="text-sm font-bold text-slate-500">Voer het beginbedrag van de kassa in om te starten:</p>
                  <div className="flex gap-4">
                    <input type="number" value={startFloatAmount} onChange={e => setStartFloatAmount(e.target.value)} className="flex-1 p-5 bg-slate-50 rounded-2xl font-black text-3xl outline-none focus:ring-4 ring-amber-500/10" placeholder="0.00" />
                    <button onClick={() => {
                      const s = { id: Date.now().toString(), startTime: Date.now(), startCash: parseFloat(startFloatAmount) || 0, status: 'OPEN' as const };
                      setSessions([...sessions, s]); setCurrentSession(s); setActiveTab('POS');
                    }} className="bg-green-600 text-white px-10 py-5 rounded-2xl font-black text-lg shadow-xl shadow-green-100 active:scale-95 transition-all">START</button>
                  </div>
                </div>
              ) : (
                <div className="bg-green-50 p-6 rounded-[2rem] border-2 border-green-100 text-center">
                  <div className="text-green-600 font-black text-xl mb-4 uppercase tracking-widest">Kassa is momenteel OPEN</div>
                  <button onClick={() => {
                    if(window.confirm("Kassa afsluiten? Dit genereert een dagrapport.")) {
                      const res = calculateSessionTotals(currentSession.id, currentSession.startCash);
                      setSessions(sessions.map(s => s.id === currentSession.id ? {...s, status: 'CLOSED' as const, summary: res.summary, endTime: Date.now(), expectedCash: res.expectedDrawer} : s));
                      setCurrentSession(null);
                    }
                  }} className="w-full bg-red-500 text-white p-5 rounded-2xl font-black text-xl shadow-xl shadow-red-100 active:scale-95 transition-all">KASSA AFSLUITEN</button>
                </div>
              )}
            </section>

            {/* Producten & Bedrijf (Versimpeld & Groot) */}
            <section className="space-y-6">
               <div className="bg-white p-6 rounded-[2.5rem] border-2 border-slate-100">
                  <h3 className="font-black uppercase text-xs text-slate-400 mb-4">Bedrijfsgegevens</h3>
                  <input className="w-full p-4 bg-slate-50 rounded-xl font-bold mb-3" placeholder="Naam Zaak" value={company.name} onChange={e => setCompany({...company, name: e.target.value})} />
                  <input className="w-full p-4 bg-slate-50 rounded-xl font-bold" placeholder="Adres" value={company.address} onChange={e => setCompany({...company, address: e.target.value})} />
               </div>
               
               <div className="bg-white p-6 rounded-[2.5rem] border-2 border-slate-100">
                  <div className="flex justify-between items-center mb-4">
                    <h3 className="font-black uppercase text-xs text-slate-400">Producten</h3>
                    <button onClick={() => setProducts([...products, { id: Date.now().toString(), name: 'NIEUW', price: 0, vatRate: 21, color: 'bg-slate-200', stock: 100 }])} className="bg-slate-900 text-white px-4 py-2 rounded-xl text-xs font-black">+ TOEVOEGEN</button>
                  </div>
                  <div className="space-y-2">
                    {products.map(p => (
                      <div key={p.id} className="flex gap-2 items-center bg-slate-50 p-2 rounded-xl">
                        <input className="flex-1 p-2 bg-white rounded-lg font-bold uppercase text-xs" value={p.name} onChange={e => setProducts(products.map(x => x.id === p.id ? {...x, name: e.target.value} : x))} />
                        <input type="number" className="w-16 p-2 bg-white rounded-lg font-black text-center text-xs" value={p.price} onChange={e => setProducts(products.map(x => x.id === p.id ? {...x, price: parseFloat(e.target.value)} : x))} />
                        <button onClick={() => setProducts(products.filter(x => x.id !== p.id))} className="text-red-400 p-2"><Trash2 size={18}/></button>
                      </div>
                    ))}
                  </div>
               </div>
            </section>
          </div>
        )}
      </main>

      {/* POPUPS */}
      {(previewTransaction || viewingSession) && (
        <div className="fixed inset-0 z-[200] bg-black/80 flex items-center justify-center p-4 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white p-8 rounded-[3rem] max-w-sm w-full overflow-y-auto max-h-[90vh] shadow-2xl relative">
            <button onClick={() => {setPreviewTransaction(null); setViewingSession(null);}} className="absolute top-6 right-6 text-slate-300 hover:text-slate-900 transition-colors"><X size={28}/></button>
            <Receipt transaction={previewTransaction} sessionSummary={viewingSession} company={company} />
            <div className="mt-8 space-y-3">
              <button onClick={() => window.print()} className="w-full bg-slate-900 text-white py-5 rounded-2xl font-black uppercase flex items-center justify-center gap-3 shadow-xl hover:bg-amber-500 transition-all">
                <Printer size={24}/> PRINTEN
              </button>
              <button onClick={() => {setPreviewTransaction(null); setViewingSession(null);}} className="w-full bg-slate-100 text-slate-400 py-4 rounded-2xl font-black uppercase tracking-widest text-xs">SLUITEN</button>
            </div>
          </div>
        </div>
      )}

      {pendingCardPayment && (
        <div className="fixed inset-0 z-[300] bg-slate-900/90 flex items-center justify-center p-4">
          <div className="bg-white p-12 rounded-[3rem] text-center w-full max-w-sm">
            <CreditCard size={64} className="mx-auto mb-6 text-blue-600 animate-pulse" />
            <h2 className="text-5xl font-black mb-10 italic tracking-tighter">€{cartTotal.toFixed(2)}</h2>
            <button onClick={() => finalizePayment(PaymentMethod.CARD)} className="w-full bg-blue-600 text-white py-6 rounded-2xl font-black text-2xl shadow-xl hover:bg-blue-500 transition-all">VOLTOOID</button>
            <button onClick={() => setPendingCardPayment(false)} className="mt-6 text-slate-400 font-black uppercase text-xs tracking-widest">Annuleren</button>
          </div>
        </div>
      )}
    </div>
  );
}
