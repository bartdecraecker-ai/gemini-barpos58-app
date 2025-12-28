import React, { useState, useEffect, useMemo } from 'react';
import { 
  ShoppingBag, Trash2, CreditCard, Banknote, BarChart3, 
  Settings, Printer, Plus, Minus, X, Building, Tag, Package, Clock, Bluetooth
} from 'lucide-react';
import { Product, CartItem, Transaction, PaymentMethod, CompanyDetails, SalesSession } from './types';
import { DEFAULT_COMPANY, INITIAL_PRODUCTS } from './constants';
import { Receipt } from './components/Receipt.tsx';
import { btPrinterService } from './services/bluetoothPrinter';

export default function App() {
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

  // --- Persistence ---
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

  // --- Functies ---
  const addToCart = (product: Product) => {
    if (!currentSession) {
      alert("⚠️ KASSA GESLOTEN! Open eerst een sessie bij Instellingen.");
      setActiveTab('SETTINGS');
      return;
    }
    setCart(prev => {
      const existing = prev.find(item => item.id === product.id);
      if (existing) return prev.map(item => item.id === product.id ? { ...item, quantity: item.quantity + 1 } : item);
      return [...prev, { ...product, quantity: 1 }];
    });
  };

  const updateQuantity = (id: string, delta: number) => {
    setCart(prev => prev.map(item => item.id === id ? { ...item, quantity: item.quantity + delta } : item).filter(i => i.quantity > 0));
  };

  const cartTotal = useMemo(() => cart.reduce((a, b) => a + (b.price * b.quantity), 0), [cart]);

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

  return (
    <div className="fixed inset-0 flex flex-col md:flex-row bg-slate-100 overflow-hidden font-sans">
      
      {/* NAVIGATIE BALK (MOBIELE ONDERKANT) */}
      <nav className="h-16 md:h-full w-full md:w-20 bg-slate-900 flex md:flex-col items-center justify-around md:justify-start md:py-8 z-[100] order-last md:order-first shrink-0">
        <button onClick={() => setActiveTab('POS')} className={`p-3 rounded-xl ${activeTab === 'POS' ? 'bg-amber-500 text-white' : 'text-slate-400'}`}><ShoppingBag /></button>
        <button onClick={() => setActiveTab('REPORTS')} className={`p-3 rounded-xl md:my-4 ${activeTab === 'REPORTS' ? 'bg-amber-500 text-white' : 'text-slate-400'}`}><BarChart3 /></button>
        <button onClick={() => setActiveTab('SETTINGS')} className={`p-3 rounded-xl ${activeTab === 'SETTINGS' ? 'bg-amber-500 text-white' : 'text-slate-400'}`}><Settings /></button>
      </nav>

      {/* HOOFD CONTENT GEBIED */}
      <main className="flex-1 relative flex flex-col overflow-hidden h-[calc(100vh-64px)] md:h-screen">
        
        {/* --- POS SECTIE --- */}
        {activeTab === 'POS' && (
          <div className="flex-1 flex flex-col md:flex-row overflow-hidden">
            <div className="flex-1 p-3 grid grid-cols-2 sm:grid-cols-4 gap-2 overflow-y-auto content-start">
              {products.map(p => (
                <button key={p.id} onClick={() => addToCart(p)} className={`${p.color} p-4 rounded-[2rem] font-black shadow-sm flex flex-col items-center justify-center min-h-[110px] active:scale-95 transition-all`}>
                  <span className="text-xs uppercase text-center leading-tight mb-1">{p.name}</span>
                  <span className="text-xs bg-white/40 px-2 rounded-full">€{p.price.toFixed(2)}</span>
                </button>
              ))}
            </div>
            {/* MANDJE */}
            <div className="w-full md:w-[360px] bg-white border-t md:border-t-0 md:border-l flex flex-col h-[40%] md:h-full">
               <div className="p-3 bg-slate-50 border-b font-black text-[10px] tracking-widest flex justify-between">
                 <span>MANDJE</span>
                 <span>{cart.length} ITEMS</span>
               </div>
               <div className="flex-1 overflow-y-auto p-2">
                 {cart.map(item => (
                   <div key={item.id} className="flex items-center justify-between p-2 mb-2 bg-slate-50 rounded-xl border border-slate-100">
                     <span className="flex-1 text-[11px] font-black uppercase truncate">{item.name}</span>
                     <div className="flex items-center gap-2">
                       <button onClick={() => updateQuantity(item.id, -1)} className="p-1 bg-white rounded shadow text-red-500"><Minus size={14}/></button>
                       <span className="font-bold text-xs">{item.quantity}</span>
                       <button onClick={() => updateQuantity(item.id, 1)} className="p-1 bg-white rounded shadow text-green-500"><Plus size={14}/></button>
                       <span className="font-black text-xs ml-2">€{(item.price * item.quantity).toFixed(2)}</span>
                     </div>
                   </div>
                 ))}
               </div>
               <div className="p-4 bg-slate-900 text-white md:rounded-none">
                 <div className="flex justify-between text-2xl font-black mb-3 italic">
                   <span>TOTAAL</span>
                   <span className="text-amber-500">€{cartTotal.toFixed(2)}</span>
                 </div>
                 <div className="grid grid-cols-2 gap-2">
                   <button onClick={() => finalizePayment(PaymentMethod.CASH)} className="bg-green-600 p-3 rounded-xl font-black text-sm flex items-center justify-center gap-2"><Banknote size={18}/> CASH</button>
                   <button onClick={() => setPendingCardPayment(true)} className="bg-blue-600 p-3 rounded-xl font-black text-sm flex items-center justify-center gap-2"><CreditCard size={18}/> CARD</button>
                 </div>
               </div>
            </div>
          </div>
        )}

        {/* --- RAPPORTEN SECTIE --- */}
        {activeTab === 'REPORTS' && (
          <div className="absolute inset-0 bg-slate-50 overflow-y-auto p-6">
            <h2 className="text-2xl font-black mb-6 uppercase tracking-widest">Dagrapporten</h2>
            <div className="space-y-4">
              {sessions.slice().reverse().map(s => (
                <div key={s.id} className="bg-white p-5 rounded-3xl shadow-sm border border-slate-200 flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <Clock size={24} className="text-slate-300"/>
                    <span className="font-black">{new Date(s.startTime).toLocaleDateString('nl-NL')}</span>
                  </div>
                  <button onClick={() => { const d = calculateSessionTotals(s.id, s.startCash); setViewingSession({ ...s, summary: d.summary }); }} 
                    className="bg-slate-900 text-white px-5 py-3 rounded-xl font-black text-xs flex items-center gap-2 shadow-lg">
                    <Printer size={16}/> RAPPORT
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* --- INSTELLINGEN SECTIE --- */}
        {activeTab === 'SETTINGS' && (
          <div className="absolute inset-0 bg-slate-50 overflow-y-auto p-6 pb-20">
            <h2 className="text-2xl font-black mb-6 uppercase tracking-widest">Instellingen</h2>
            <div className="space-y-6 max-w-2xl">
              
              {/* Bluetooth */}
              <button onClick={async () => setBtConnected(await btPrinterService.connect())} 
                className={`w-full p-5 rounded-3xl font-black flex items-center justify-center gap-4 shadow-lg ${btConnected ? 'bg-green-100 text-green-700' : 'bg-blue-600 text-white'}`}>
                <Bluetooth size={24} /> {btConnected ? 'PRINTER VERBONDEN' : 'VERBIND PRINTER'}
              </button>

              {/* Bedrijf */}
              <div className="bg-white p-6 rounded-3xl border space-y-4">
                <h3 className="text-xs font-black text-slate-400 uppercase">Bedrijfsgegevens</h3>
                <input className="w-full p-4 bg-slate-50 rounded-xl font-bold border-none" placeholder="Naam" value={company.name} onChange={e => setCompany({...company, name: e.target.value})} />
                <input className="w-full p-4 bg-slate-50 rounded-xl font-bold border-none" placeholder="Adres" value={company.address} onChange={e => setCompany({...company, address: e.target.value})} />
              </div>

              {/* Producten */}
              <div className="bg-white p-6 rounded-3xl border">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="text-xs font-black text-slate-400 uppercase">Producten</h3>
                  <button onClick={() => setProducts([...products, { id: Date.now().toString(), name: 'NIEUW', price: 0, vatRate: 21, color: 'bg-slate-200', stock: 100 }])} className="text-[10px] bg-slate-900 text-white px-3 py-1 rounded-lg font-black">+ VOEG TOE</button>
                </div>
                <div className="space-y-3">
                  {products.map(p => (
                    <div key={p.id} className="flex gap-2 items-center bg-slate-50 p-2 rounded-xl">
                      <input className="flex-1 p-2 bg-white rounded-lg font-bold text-sm" value={p.name} onChange={e => setProducts(products.map(x => x.id === p.id ? {...x, name: e.target.value} : x))} />
                      <input type="number" className="w-16 p-2 bg-white rounded-lg font-black text-center text-sm" value={p.price} onChange={e => setProducts(products.map(x => x.id === p.id ? {...x, price: parseFloat(e.target.value)} : x))} />
                      <button onClick={() => setProducts(products.filter(x => x.id !== p.id))} className="text-red-400"><Trash2 size={18}/></button>
                    </div>
                  ))}
                </div>
              </div>

              {/* Kassa */}
              <div className="bg-white p-6 rounded-3xl border">
                 <h3 className="text-xs font-black text-slate-400 uppercase mb-4 tracking-widest">Kassa Sessie</h3>
                 {!currentSession ? (
                   <div className="flex gap-2">
                     <input type="number" value={startFloatAmount} onChange={e => setStartFloatAmount(e.target.value)} className="flex-1 p-4 bg-slate-50 rounded-xl font-black text-xl" placeholder="0.00" />
                     <button onClick={() => {
                       const s = { id: Date.now().toString(), startTime: Date.now(), startCash: parseFloat(startFloatAmount) || 0, status: 'OPEN' as const };
                       setSessions([...sessions, s]); setCurrentSession(s); setActiveTab('POS');
                     }} className="bg-green-600 text-white px-6 py-4 rounded-xl font-black">OPEN</button>
                   </div>
                 ) : (
                   <button onClick={() => {
                     if(window.confirm("Kassa sluiten?")) {
                       const res = calculateSessionTotals(currentSession.id, currentSession.startCash);
                       setSessions(sessions.map(s => s.id === currentSession.id ? {...s, status: 'CLOSED' as const, summary: res.summary, endTime: Date.now(), expectedCash: res.expectedDrawer} : s));
                       setCurrentSession(null);
                     }
                   }} className="w-full bg-red-500 text-white p-5 rounded-2xl font-black uppercase text-sm">SLUIT KASSA & PRINT RAPPORT</button>
                 )}
              </div>
            </div>
          </div>
        )}
      </main>

      {/* POPUPS (Hogere z-index) */}
      {(previewTransaction || viewingSession) && (
        <div className="fixed inset-0 z-[200] bg-black/80 flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-white p-6 rounded-[2.5rem] max-w-sm w-full overflow-y-auto max-h-[80vh] shadow-2xl relative">
            <button onClick={() => {setPreviewTransaction(null); setViewingSession(null);}} className="absolute top-4 right-4 text-slate-300"><X size={24}/></button>
            <Receipt transaction={previewTransaction} sessionSummary={viewingSession} company={company} />
            <div className="mt-6 space-y-2">
              <button onClick={() => window.print()} className="w-full bg-slate-900 text-white py-4 rounded-xl font-black uppercase flex items-center justify-center gap-2">
                <Printer size={18}/> PRINT NU
              </button>
              <button onClick={() => {setPreviewTransaction(null); setViewingSession(null);}} className="w-full bg-slate-100 text-slate-400 py-4 rounded-xl font-black uppercase text-xs">SLUITEN</button>
            </div>
          </div>
        </div>
      )}
      
      {pendingCardPayment && (
        <div className="fixed inset-0 z-[300] bg-slate-900/90 flex items-center justify-center p-4">
          <div className="bg-white p-8 rounded-[3rem] text-center w-full max-w-sm">
            <CreditCard size={48} className="mx-auto mb-4 text-blue-600 animate-pulse" />
            <h2 className="text-4xl font-black mb-8 italic">€{cartTotal.toFixed(2)}</h2>
            <button onClick={() => finalizePayment(PaymentMethod.CARD)} className="w-full bg-blue-600 text-white py-5 rounded-2xl font-black text-xl shadow-lg">BETAALD</button>
            <button onClick={() => setPendingCardPayment(false)} className="mt-4 text-slate-400 font-bold uppercase text-[10px]">Annuleren</button>
          </div>
        </div>
      )}
    </div>
  );
}
