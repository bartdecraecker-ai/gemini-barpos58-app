import React, { useState, useEffect, useMemo } from 'react';
import { 
  ShoppingBag, Trash2, CreditCard, Banknote, BarChart3, 
  Settings, Printer, Plus, Minus, Bluetooth, AlertTriangle, 
  X, Save, RotateCcw
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
    let total = 0, vat21 = 0, vat0 = 0;
    cart.forEach(item => {
      const line = item.price * item.quantity;
      total += line;
      if (item.vatRate === 21) vat21 += (line - (line / 1.21));
      else vat0 += line;
    });
    return { total, vat21, vat0 };
  }, [cart]);

  // --- Sessies & Rapporten ---
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
        vat0Total: acc.vat0Total + tx.vat0,
        vat21Total: acc.vat21Total + tx.vat21,
      };
    }, { totalSales: 0, transactionCount: 0, cashTotal: 0, cardTotal: 0, vat0Total: 0, vat21Total: 0 });
    return { summary: { ...summary, productSales }, expectedDrawer: startCash + summary.cashTotal };
  };

  const finalizePayment = async (method: PaymentMethod) => {
    if (!currentSession) return;
    const shouldPrint = window.confirm("Betaling geregistreerd. Ticket afdrukken?");
    const newTx: Transaction = {
      id: `TR-${Date.now().toString().slice(-4)}`,
      sessionId: currentSession.id,
      timestamp: Date.now(),
      dateStr: new Date().toLocaleDateString('nl-NL'),
      items: [...cart],
      total: cartTotals.total,
      vat0: cartTotals.vat0,
      vat21: cartTotals.vat21,
      paymentMethod: method,
      subtotal: cartTotals.total - cartTotals.vat21
    };
    setTransactions(prev => [newTx, ...prev]);
    setCart([]);
    setPendingCardPayment(false);
    if (shouldPrint) {
      if (btConnected) await btPrinterService.printReceipt(newTx, company);
      else setPreviewTransaction(newTx);
    }
  };

  // --- Productbeheer ---
  const updateProduct = (id: string, field: keyof Product, value: any) => {
    setProducts(prev => prev.map(p => p.id === id ? { ...p, [field]: value } : p));
  };
  const addProduct = () => {
    const newP: Product = { id: Date.now().toString(), name: 'Nieuw Item', price: 0, vatRate: 21, color: 'bg-slate-200', stock: 0 };
    setProducts([...products, newP]);
  };
  const deleteProduct = (id: string) => {
    if(window.confirm("Product verwijderen?")) setProducts(products.filter(p => p.id !== id));
  };

  return (
    <div className="min-h-screen flex flex-col md:flex-row bg-slate-50">
      <nav className="bg-slate-900 text-white w-full md:w-20 flex md:flex-col items-center py-4 z-50 shadow-2xl">
        <button onClick={() => setActiveTab('POS')} className={`p-4 rounded-2xl mb-4 transition-all ${activeTab === 'POS' ? 'bg-amber-500 shadow-lg scale-110' : 'hover:bg-slate-800'}`}><ShoppingBag /></button>
        <button onClick={() => setActiveTab('REPORTS')} className={`p-4 rounded-2xl mb-4 transition-all ${activeTab === 'REPORTS' ? 'bg-amber-500 shadow-lg scale-110' : 'hover:bg-slate-800'}`}><BarChart3 /></button>
        <button onClick={() => setActiveTab('SETTINGS')} className={`p-4 rounded-2xl transition-all ${activeTab === 'SETTINGS' ? 'bg-amber-500 shadow-lg scale-110' : 'hover:bg-slate-800'}`}><Settings /></button>
      </nav>

      <main className="flex-1 flex flex-col overflow-hidden">
        {activeTab === 'POS' && (
          <div className="flex-1 flex flex-col md:flex-row overflow-hidden">
            {/* PRODUCTEN GRID: 4 KOLOMMEN */}
            <div className="flex-1 p-4 grid grid-cols-2 sm:grid-cols-4 gap-3 overflow-y-auto content-start">
              {products.map(p => (
                <button key={p.id} onClick={() => addToCart(p)} className={`${p.color} p-4 rounded-3xl font-bold shadow-sm active:scale-95 transition-all min-h-[110px] flex flex-col justify-center items-center text-center border-b-4 border-black/10`}>
                  <span className="text-slate-800 leading-tight">{p.name}</span>
                  <span className="text-sm mt-1 bg-white/40 px-2 rounded-full">€{p.price.toFixed(2)}</span>
                </button>
              ))}
            </div>

            {/* SIDEBAR: WINKELWAGEN BOVENAAN */}
            <div className="w-full md:w-96 bg-white border-l flex flex-col shadow-2xl">
              <div className="p-4 border-b font-black bg-slate-50 flex justify-between items-center text-slate-700">
                GESELECTEERD
                <button onClick={() => setCart([])} className="text-slate-400 hover:text-red-500"><RotateCcw size={18}/></button>
              </div>
              
              <div className="flex-1 overflow-y-auto p-2">
                {cart.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-40 text-slate-300">
                    <ShoppingBag size={48} className="mb-2 opacity-20" />
                    <p className="italic">Kies een product</p>
                  </div>
                ) : (
                  cart.map(item => (
                    <div key={item.id} className="flex items-center justify-between p-3 border-b hover:bg-slate-50 transition-colors">
                      <div className="flex items-center gap-3">
                        <div className="flex items-center bg-slate-100 rounded-lg p-1">
                          <button onClick={() => updateQuantity(item.id, -1)} className="p-1 text-red-500 hover:bg-white rounded shadow-sm"><Minus size={14}/></button>
                          <span className="font-bold w-6 text-center">{item.quantity}</span>
                          <button onClick={() => updateQuantity(item.id, 1)} className="p-1 text-green-500 hover:bg-white rounded shadow-sm"><Plus size={14}/></button>
                        </div>
                      </div>
                      <span className="flex-1 px-3 text-sm font-medium truncate text-slate-700">{item.name}</span>
                      <div className="flex items-center gap-2">
                        <span className="font-bold">€{(item.price * item.quantity).toFixed(2)}</span>
                        <button onClick={() => removeFromCart(item.id)} className="text-slate-300 hover:text-red-500"><Trash2 size={16}/></button>
                      </div>
                    </div>
                  ))
                )}
              </div>

              {/* TOTAAL EN BETALEN ONDERAAN */}
              <div className="p-6 bg-slate-900 text-white rounded-t-[40px] shadow-[0_-10px_40px_rgba(0,0,0,0.2)]">
                <div className="flex justify-between text-3xl font-black mb-6 px-2"><span>TOTAAL</span><span>€{cartTotals.total.toFixed(2)}</span></div>
                <div className="grid grid-cols-2 gap-4">
                  <button onClick={() => finalizePayment(PaymentMethod.CASH)} className="bg-green-600 hover:bg-green-500 p-5 rounded-3xl font-black text-lg shadow-lg active:translate-y-1 transition-all">CASH</button>
                  <button onClick={() => setPendingCardPayment(true)} className="bg-blue-600 hover:bg-blue-500 p-5 rounded-3xl font-black text-lg shadow-lg active:translate-y-1 transition-all">CARD</button>
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'REPORTS' && (
          <div className="p-6 overflow-y-auto h-full max-w-4xl mx-auto w-full">
            <h2 className="text-3xl font-black mb-8 text-slate-800">Rapporten</h2>
            <div className="grid gap-4">
              {sessions.slice().reverse().map(s => (
                <div key={s.id} className="bg-white p-6 rounded-[32px] border shadow-sm flex items-center justify-between hover:border-amber-200 transition-all">
                  <div className="flex items-center gap-4">
                    <div className={`p-3 rounded-2xl ${s.status === 'OPEN' ? 'bg-green-100 text-green-600' : 'bg-slate-100 text-slate-500'}`}><Clock size={24}/></div>
                    <div>
                      <div className="font-black text-lg text-slate-800">{new Date(s.startTime).toLocaleDateString('nl-NL')}</div>
                      <div className="text-slate-500 font-medium">{s.status === 'OPEN' ? 'Huidige Sessie' : 'Gesloten'} | ID: {s.id.slice(-4)}</div>
                    </div>
                  </div>
                  <button onClick={() => {
                    const report = s.status === 'OPEN' ? calculateSessionTotals(s.id, s.startCash) : s;
                    setViewingSession({ ...s, summary: report.summary });
                  }} className="bg-slate-900 text-white px-6 py-3 rounded-2xl font-bold flex items-center gap-2 hover:bg-amber-500 transition-colors"><Printer size={18}/> Rapport</button>
                </div>
              ))}
            </div>
          </div>
        )}

        {activeTab === 'SETTINGS' && (
          <div className="p-6 overflow-y-auto h-full max-w-4xl mx-auto w-full space-y-8">
            <div className="bg-white p-8 rounded-[40px] border shadow-sm">
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-xl font-black text-slate-800">Productbeheer</h3>
                <button onClick={addProduct} className="bg-amber-500 text-white px-4 py-2 rounded-xl font-bold text-sm hover:bg-amber-600">+ Product</button>
              </div>
              <div className="grid gap-3">
                {products.map(p => (
                  <div key={p.id} className="flex gap-3 items-center bg-slate-50 p-3 rounded-2xl border border-slate-100">
                    <input className="flex-1 p-2 bg-white border rounded-xl font-medium" value={p.name} onChange={e => updateProduct(p.id, 'name', e.target.value)} />
                    <div className="relative">
                      <span className="absolute left-3 top-2 text-slate-400">€</span>
                      <input type="number" className="w-24 p-2 pl-7 bg-white border rounded-xl font-bold" value={p.price} onChange={e => updateProduct(p.id, 'price', parseFloat(e.target.value))} />
                    </div>
                    <select className="p-2 bg-white border rounded-xl text-sm" value={p.color} onChange={e => updateProduct(p.id, 'color', e.target.value)}>
                      {AVAILABLE_COLORS.map(c => <option key={c} value={c}>{c.replace('bg-', '')}</option>)}
                    </select>
                    <button onClick={() => deleteProduct(p.id)} className="p-2 text-red-400 hover:bg-red-50 rounded-xl"><Trash2 size={20}/></button>
                  </div>
                ))}
              </div>
            </div>
            
            <div className="bg-white p-8 rounded-[40px] border shadow-sm">
              <h3 className="text-xl font-black text-slate-800 mb-6">Kassa Sessie</h3>
              {!currentSession ? (
                <div className="flex gap-4">
                   <div className="flex-1">
                     <label className="block text-xs font-bold text-slate-400 mb-1 ml-2">STARTBEDRAG CASH</label>
                     <input type="number" value={startFloatAmount} onChange={e => setStartFloatAmount(e.target.value)} className="w-full p-4 border rounded-2xl font-bold" placeholder="0.00" />
                   </div>
                   <button onClick={() => {
                     const s: SalesSession = { id: Date.now().toString(), startTime: Date.now(), startCash: parseFloat(startFloatAmount) || 0, status: 'OPEN' };
                     setSessions([...sessions, s]); setCurrentSession(s); setActiveTab('POS');
                   }} className="bg-amber-500 text-white px-8 rounded-2xl font-black mt-5 shadow-lg shadow-amber-200">OPEN KASSA</button>
                </div>
              ) : (
                <button onClick={() => {
                  if(window.confirm("Wil je de kassa definitief sluiten?")) {
                    const {summary, expectedDrawer} = calculateSessionTotals(currentSession.id, currentSession.startCash);
                    const closed = {...currentSession, status: 'CLOSED' as const, summary, endTime: Date.now(), expectedCash: expectedDrawer};
                    setSessions(sessions.map(s => s.id === currentSession.id ? closed : s)); setCurrentSession(null);
                  }
                }} className="w-full bg-red-500 text-white p-5 rounded-3xl font-black text-lg shadow-lg shadow-red-100">SLUIT SESSIE & PRINT DAGRAPPORT</button>
              )}
            </div>

            <div className="bg-red-50 p-8 rounded-[40px] border border-red-100">
               <h3 className="text-red-800 font-black mb-2 flex items-center gap-2"><AlertTriangle size={20}/> Gevarenzone</h3>
               <p className="text-red-600 text-sm mb-6 font-medium">Wis alle test-transacties en rapporten om met een schone lei te beginnen.</p>
               <button onClick={() => {
                 if(window.confirm("⚠️ WEET JE HET ZEKER? Alle transacties en rapporten worden definitief verwijderd.")) {
                   if(window.confirm("LAATSTE WAARSCHUWING: Alles wissen?")) {
                     setTransactions([]); setSessions([]);
                     localStorage.removeItem('barpos_transactions'); localStorage.removeItem('barpos_sessions');
                     window.location.reload();
                   }
                 }
               }} className="bg-red-600 text-white px-8 py-4 rounded-2xl font-black hover:bg-red-700 transition-colors shadow-lg shadow-red-200">WIS ALLE DATA</button>
            </div>
          </div>
        )}
      </main>

      {/* OVERLAYS */}
      {pendingCardPayment && (
        <div className="fixed inset-0 z-[300] bg-slate-900/90 flex items-center justify-center p-4 backdrop-blur-md">
          <div className="bg-white p-10 rounded-[50px] max-w-sm w-full text-center shadow-2xl">
            <div className="w-24 h-24 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center mx-auto mb-6 animate-pulse"><CreditCard size={48}/></div>
            <h2 className="text-4xl font-black mb-2">€{cartTotals.total.toFixed(2)}</h2>
            <p className="text-slate-500 mb-10 font-medium">Volg de instructies op de terminal...</p>
            <div className="flex flex-col gap-4">
              <button onClick={() => finalizePayment(PaymentMethod.CARD)} className="bg-blue-600 text-white py-5 rounded-3xl font-black text-xl shadow-xl shadow-blue-200">BETALING GESLAAGD</button>
              <button onClick={() => setPendingCardPayment(false)} className="text-slate-400 font-bold py-2 hover:text-slate-600 transition-colors">ANNULEREN</button>
            </div>
          </div>
        </div>
      )}

      {(previewTransaction || viewingSession) && (
        <div className="fixed inset-0 z-[200] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white p-8 rounded-[40px] max-w-sm w-full shadow-2xl overflow-y-auto max-h-[90vh] relative">
            <button onClick={() => {setPreviewTransaction(null); setViewingSession(null);}} className="absolute top-4 right-4 p-2 bg-slate-100 rounded-full"><X size={20}/></button>
            <Receipt transaction={previewTransaction} sessionSummary={viewingSession} company={company} />
            <button onClick={() => {setPreviewTransaction(null); setViewingSession(null);}} className="w-full mt-8 bg-slate-900 text-white py-5 rounded-3xl font-black uppercase tracking-widest hover:bg-amber-500 transition-colors shadow-xl">Sluiten</button>
          </div>
        </div>
      )}
    </div>
  );
}
