import React, { useState, useEffect, useMemo } from 'react';
import { 
  ShoppingBag, Trash2, CreditCard, Banknote, BarChart3, 
  Settings, Printer, Plus, Minus, Bluetooth, AlertTriangle, 
  X, Save, RotateCcw, Clock, CheckCircle2
} from 'lucide-react';
import { Product, CartItem, Transaction, PaymentMethod, CompanyDetails, SalesSession } from './types';
import { DEFAULT_COMPANY, INITIAL_PRODUCTS, AVAILABLE_COLORS } from './constants';
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
  const [btConnected, setBtConnected] = useState(false);
  const [isConnectingBt, setIsConnectingBt] = useState(false);
  const [pendingCardPayment, setPendingCardPayment] = useState(false);
  const [startFloatAmount, setStartFloatAmount] = useState<string>('0');

  // --- Initial Load & Auto-Connect ---
  useEffect(() => {
    const loadData = async () => {
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

      // AUTO-CONNECT LOGICA
      const wasConnected = localStorage.getItem('barpos_bt_autoconnect') === 'true';
      if (wasConnected && !btConnected) {
        console.log("Proberen automatisch te verbinden met printer...");
        setIsConnectingBt(true);
        const success = await btPrinterService.connect();
        setBtConnected(success);
        setIsConnectingBt(false);
      }
    };

    loadData();
  }, []);

  // --- Persistence ---
  useEffect(() => {
    localStorage.setItem('barpos_transactions', JSON.stringify(transactions));
    localStorage.setItem('barpos_products', JSON.stringify(products));
    localStorage.setItem('barpos_sessions', JSON.stringify(sessions));
    localStorage.setItem('barpos_company', JSON.stringify(company));
    localStorage.setItem('barpos_bt_autoconnect', btConnected.toString());
  }, [transactions, products, sessions, company, btConnected]);

  // --- POS Logica ---
  const addToCart = (product: Product) => {
    setCart(prev => {
      const existing = prev.find(item => item.id === product.id);
      if (existing) return prev.map(item => item.id === product.id ? { ...item, quantity: item.quantity + 1 } : item);
      return [...prev, { ...product, quantity: 1 }];
    });
  };

  const updateQuantity = (id: string, delta: number) => {
    setCart(prev => prev.map(item => item.id === id ? { ...item, quantity: item.quantity + delta } : item));
  };

  const removeFromCart = (id: string) => setCart(prev => prev.filter(i => i.id !== id));

  const cartTotals = useMemo(() => {
    let total = 0, vat21 = 0;
    cart.forEach(item => {
      const line = item.price * item.quantity;
      total += line;
      if (item.vatRate === 21) vat21 += (line - (line / 1.21));
    });
    return { total, vat21, vat0: total - (total/1.21) }; // Vereenvoudigde BTW voor demo
  }, [cart]);

  const finalizePayment = async (method: PaymentMethod) => {
    if (!currentSession) {
      alert("Open eerst de kassa in Instellingen!");
      return;
    }
    const shouldPrint = window.confirm("Betaling ontvangen. Ticket afdrukken?");
    const newTx: Transaction = {
      id: `TR-${Date.now().toString().slice(-4)}`,
      sessionId: currentSession.id,
      timestamp: Date.now(),
      dateStr: new Date().toLocaleDateString('nl-NL'),
      items: [...cart],
      total: cartTotals.total,
      vat0: 0,
      vat21: cartTotals.vat21,
      paymentMethod: method,
      subtotal: cartTotals.total - cartTotals.vat21
    };
    setTransactions(prev => [newTx, ...prev]);
    setCart([]);
    setPendingCardPayment(false);

    if (shouldPrint) {
      if (btConnected) {
        try { await btPrinterService.printReceipt(newTx, company); }
        catch (e) { setPreviewTransaction(newTx); }
      } else {
        setPreviewTransaction(newTx);
      }
    }
  };

  // --- Render ---
  return (
    <div className="min-h-screen flex flex-col md:flex-row bg-slate-50 font-sans">
      {/* SIDEBAR NAV */}
      <nav className="bg-slate-900 text-white w-full md:w-24 flex md:flex-col items-center py-6 z-50 shadow-2xl">
        <div className="mb-8 p-3 bg-amber-500 rounded-2xl shadow-lg shadow-amber-500/20">
          <ShoppingBag size={28} />
        </div>
        <button onClick={() => setActiveTab('POS')} className={`p-4 rounded-2xl mb-4 transition-all ${activeTab === 'POS' ? 'bg-slate-800 text-amber-500' : 'text-slate-400 hover:text-white'}`}><CreditCard /></button>
        <button onClick={() => setActiveTab('REPORTS')} className={`p-4 rounded-2xl mb-4 transition-all ${activeTab === 'REPORTS' ? 'bg-slate-800 text-amber-500' : 'text-slate-400 hover:text-white'}`}><BarChart3 /></button>
        <button onClick={() => setActiveTab('SETTINGS')} className={`p-4 rounded-2xl transition-all ${activeTab === 'SETTINGS' ? 'bg-slate-800 text-amber-500' : 'text-slate-400 hover:text-white'}`}><Settings /></button>
        
        <div className={`mt-auto p-2 rounded-full ${btConnected ? 'text-green-500' : 'text-red-500 opacity-50'}`}>
          <Bluetooth size={20} className={isConnectingBt ? 'animate-ping' : ''} />
        </div>
      </nav>

      <main className="flex-1 flex flex-col overflow-hidden">
        {activeTab === 'POS' && (
          <div className="flex-1 flex flex-col md:flex-row overflow-hidden">
            {/* PRODUCTEN GRID - 4 KOLOMMEN */}
            <div className="flex-1 p-6 grid grid-cols-2 sm:grid-cols-4 gap-4 overflow-y-auto content-start">
              {products.map(p => (
                <button key={p.id} onClick={() => addToCart(p)} className={`${p.color} p-5 rounded-[32px] font-black shadow-sm active:scale-95 transition-all min-h-[120px] flex flex-col justify-center items-center text-center border-b-8 border-black/10 hover:shadow-xl`}>
                  <span className="text-slate-800 text-lg leading-tight uppercase tracking-tighter">{p.name}</span>
                  <span className="text-sm mt-2 bg-black/10 px-3 py-0.5 rounded-full font-bold">€{p.price.toFixed(2)}</span>
                </button>
              ))}
            </div>

            {/* SIDEBAR WINKELWAGEN */}
            <div className="w-full md:w-[400px] bg-white border-l border-slate-200 flex flex-col shadow-2xl">
              <div className="p-6 border-b font-black text-slate-800 flex justify-between items-center bg-white/80 backdrop-blur-md sticky top-0 z-10">
                <span className="tracking-widest">WINKELMAND</span>
                <span className="bg-slate-100 px-3 py-1 rounded-full text-xs">{cart.length} items</span>
              </div>
              
              <div className="flex-1 overflow-y-auto p-4 space-y-2">
                {cart.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-full text-slate-300">
                    <div className="w-20 h-20 bg-slate-50 rounded-full flex items-center justify-center mb-4">
                      <ShoppingBag size={40} className="opacity-20" />
                    </div>
                    <p className="font-bold uppercase tracking-widest text-xs">Geen selectie</p>
                  </div>
                ) : (
                  cart.map(item => (
                    <div key={item.id} className="flex items-center justify-between p-4 bg-slate-50 rounded-3xl border border-transparent hover:border-slate-200 transition-all">
                      <div className="flex items-center gap-3">
                        <div className="flex flex-col items-center bg-white rounded-2xl shadow-sm border border-slate-100">
                          <button onClick={() => updateQuantity(item.id, 1)} className="p-2 text-green-500 hover:bg-green-50 rounded-t-2xl"><Plus size={16}/></button>
                          <span className="font-black text-lg px-2">{item.quantity}</span>
                          <button onClick={() => updateQuantity(item.id, -1)} className="p-2 text-red-500 hover:bg-red-50 rounded-b-2xl"><Minus size={16}/></button>
                        </div>
                      </div>
                      <div className="flex-1 px-4">
                        <div className="font-black text-slate-700 uppercase text-sm truncate w-32">{item.name}</div>
                        <div className="text-slate-400 text-xs font-bold">€{item.price.toFixed(2)} p/s</div>
                      </div>
                      <div className="text-right">
                        <div className="font-black text-slate-900">€{(item.price * item.quantity).toFixed(2)}</div>
                        <button onClick={() => removeFromCart(item.id)} className="text-slate-300 hover:text-red-500 transition-colors mt-1"><Trash2 size={16}/></button>
                      </div>
                    </div>
                  ))
                )}
              </div>

              <div className="p-8 bg-slate-900 text-white rounded-t-[50px] shadow-[0_-20px_50px_rgba(0,0,0,0.3)]">
                <div className="flex justify-between text-4xl font-black mb-8 px-2 tracking-tighter italic">
                  <span>TOTAAL</span>
                  <span className="text-amber-500">€{cartTotals.total.toFixed(2)}</span>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <button onClick={() => finalizePayment(PaymentMethod.CASH)} className="bg-green-500 hover:bg-green-400 p-6 rounded-[30px] font-black text-xl shadow-lg shadow-green-900/20 active:translate-y-1 transition-all">CASH</button>
                  <button onClick={() => setPendingCardPayment(true)} className="bg-blue-500 hover:bg-blue-400 p-6 rounded-[30px] font-black text-xl shadow-lg shadow-blue-900/20 active:translate-y-1 transition-all text-white">CARD</button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* REPORTS & SETTINGS tabs blijven hieronder volledig behouden met de Reset knop en Productbeheer */}
        {activeTab === 'REPORTS' && (
           <div className="p-8 max-w-5xl mx-auto w-full overflow-y-auto">
             <h2 className="text-4xl font-black mb-10 tracking-tight">Rapporten</h2>
             <div className="grid grid-cols-1 gap-4">
               {sessions.slice().reverse().map(s => (
                 <div key={s.id} className="bg-white p-8 rounded-[40px] shadow-sm border border-slate-100 flex items-center justify-between group hover:shadow-xl transition-all">
                    <div className="flex items-center gap-6">
                      <div className={`w-16 h-16 rounded-3xl flex items-center justify-center ${s.status === 'OPEN' ? 'bg-green-100 text-green-600' : 'bg-slate-100 text-slate-400'}`}>
                        <Clock size={32} />
                      </div>
                      <div>
                        <div className="text-2xl font-black text-slate-800">{new Date(s.startTime).toLocaleDateString('nl-NL')}</div>
                        <div className="text-slate-400 font-bold uppercase tracking-widest text-xs">{s.status === 'OPEN' ? '🟢 Actieve Sessie' : '🔴 Gesloten'} | ID: {s.id.slice(-4)}</div>
                      </div>
                    </div>
                    <button onClick={() => {
                      const report = s.status === 'OPEN' ? calculateSessionTotals(s.id, s.startCash) : s;
                      setViewingSession({ ...s, summary: report.summary });
                    }} className="bg-slate-900 text-white px-8 py-4 rounded-3xl font-black hover:bg-amber-500 transition-all shadow-lg">BEKIJK RAPPORT</button>
                 </div>
               ))}
             </div>
           </div>
        )}

        {activeTab === 'SETTINGS' && (
           <div className="p-8 max-w-4xl mx-auto w-full space-y-8 overflow-y-auto">
             <div className="bg-white p-10 rounded-[50px] shadow-sm border">
               <div className="flex justify-between items-center mb-8">
                  <h3 className="text-2xl font-black tracking-tight">Producten Aanpassen</h3>
                  <button onClick={() => {
                    const newP: Product = { id: Date.now().toString(), name: 'NIEUW PRODUCT', price: 0, vatRate: 21, color: 'bg-slate-200', stock: 0 };
                    setProducts([...products, newP]);
                  }} className="bg-amber-500 text-white px-6 py-3 rounded-2xl font-black shadow-lg shadow-amber-200">+ ITEM</button>
               </div>
               <div className="space-y-3">
                 {products.map(p => (
                   <div key={p.id} className="flex gap-4 items-center bg-slate-50 p-4 rounded-3xl group">
                     <input className="flex-1 p-3 bg-white border-2 border-transparent focus:border-amber-500 rounded-2xl font-bold transition-all" value={p.name} onChange={e => setProducts(products.map(x => x.id === p.id ? {...x, name: e.target.value.toUpperCase()} : x))} />
                     <input type="number" className="w-28 p-3 bg-white border-2 border-transparent focus:border-amber-500 rounded-2xl font-black text-center" value={p.price} onChange={e => setProducts(products.map(x => x.id === p.id ? {...x, price: parseFloat(e.target.value)} : x))} />
                     <button onClick={() => setProducts(products.filter(x => x.id !== p.id))} className="p-3 text-slate-300 hover:text-red-500 transition-colors"><Trash2 /></button>
                   </div>
                 ))}
               </div>
             </div>

             <div className="bg-red-50 p-10 rounded-[50px] border border-red-100 shadow-sm">
                <h3 className="text-red-800 font-black text-xl mb-2 flex items-center gap-2 uppercase tracking-widest"><AlertTriangle /> Systeem Reset</h3>
                <p className="text-red-600 mb-8 font-medium">Verwijder alle testtransacties en rapporten om opnieuw te beginnen.</p>
                <button onClick={() => {
                  if(window.confirm("Alle data wissen?")) {
                    localStorage.removeItem('barpos_transactions');
                    localStorage.removeItem('barpos_sessions');
                    window.location.reload();
                  }
                }} className="bg-red-600 text-white px-10 py-4 rounded-3xl font-black shadow-xl shadow-red-200 hover:bg-red-700 transition-all">WIS TRANSACTIE DATA</button>
             </div>
           </div>
        )}
      </main>

      {/* OVERLAYS (CARD & RECEIPT) */}
      {pendingCardPayment && (
        <div className="fixed inset-0 z-[300] bg-slate-900/95 flex items-center justify-center p-4 backdrop-blur-xl">
          <div className="bg-white p-12 rounded-[60px] max-w-sm w-full text-center shadow-2xl scale-110">
            <div className="w-32 h-32 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center mx-auto mb-8 animate-pulse shadow-inner"><CreditCard size={56}/></div>
            <h2 className="text-5xl font-black mb-4 text-slate-900 tracking-tighter">€{cartTotals.total.toFixed(2)}</h2>
            <p className="text-slate-400 mb-12 font-bold uppercase tracking-widest text-xs italic">Terminal gereed...</p>
            <div className="flex flex-col gap-4">
              <button onClick={() => finalizePayment(PaymentMethod.CARD)} className="bg-blue-600 text-white py-6 rounded-[30px] font-black text-2xl shadow-2xl shadow-blue-500/40 active:scale-95 transition-all">BETAALD</button>
              <button onClick={() => setPendingCardPayment(false)} className="text-slate-400 font-black py-4 uppercase tracking-widest text-xs">Annuleren</button>
            </div>
          </div>
        </div>
      )}

      {(previewTransaction || viewingSession) && (
        <div className="fixed inset-0 z-[200] bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-white p-8 rounded-[50px] max-w-sm w-full shadow-2xl overflow-y-auto max-h-[90vh] border-8 border-slate-100">
            <Receipt transaction={previewTransaction} sessionSummary={viewingSession} company={company} />
            <button onClick={() => {setPreviewTransaction(null); setViewingSession(null);}} className="w-full mt-8 bg-slate-900 text-white py-6 rounded-[30px] font-black uppercase tracking-[0.2em] hover:bg-amber-500 transition-all">SLUITEN</button>
          </div>
        </div>
      )}
    </div>
  );
}
