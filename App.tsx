import React, { useState, useEffect, useMemo } from 'react';
import { 
  ShoppingBag, Trash2, CreditCard, Banknote, BarChart3, 
  Settings, Printer, Plus, Minus, Bluetooth, AlertTriangle, 
  X, User, Building, Tag, Package, Clock, ChevronRight
} from 'lucide-react';
import { Product, CartItem, Transaction, PaymentMethod, CompanyDetails, SalesSession } from './types';
import { DEFAULT_COMPANY, INITIAL_PRODUCTS } from './constants';
import { Receipt } from './components/Receipt.tsx';
import { btPrinterService } from './services/bluetoothPrinter';

export default function App() {
  // --- State Management ---
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
  const [pendingCardPayment, setPendingCardPayment] = useState(false);
  const [startFloatAmount, setStartFloatAmount] = useState<string>('0');

  // --- Data Persistence ---
  useEffect(() => {
    const loadData = () => {
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
        const active = parsed.find(s => s.status === 'OPEN');
        if (active) setCurrentSession(active);
      }
    };
    loadData();
  }, []);

  useEffect(() => {
    localStorage.setItem('barpos_transactions', JSON.stringify(transactions));
    localStorage.setItem('barpos_products', JSON.stringify(products));
    localStorage.setItem('barpos_sessions', JSON.stringify(sessions));
    localStorage.setItem('barpos_company', JSON.stringify(company));
  }, [transactions, products, sessions, company]);

  // --- Logic ---
  const addToCart = (product: Product) => {
    if (!currentSession) {
      alert("⚠️ OPEN EERST DE KASSA BIJ INSTELLINGEN!");
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

  const cartTotals = useMemo(() => {
    const total = cart.reduce((a, b) => a + (b.price * b.quantity), 0);
    const vat21 = cart.reduce((a, b) => b.vatRate === 21 ? a + (b.price * b.quantity - (b.price * b.quantity / 1.21)) : a, 0);
    return { total, vat21, vat0: total - vat21 };
  }, [cart]);

  const finalizePayment = async (method: PaymentMethod) => {
    if (!currentSession) return;
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

    setProducts(prev => prev.map(p => {
      const ci = cart.find(i => i.id === p.id);
      return ci ? { ...p, stock: p.stock - ci.quantity } : p;
    }));

    setTransactions([newTx, ...transactions]);
    setCart([]);
    setPendingCardPayment(false);
    
    if (window.confirm("Betaling geslaagd. Ticket afdrukken?")) {
      if (btConnected) await btPrinterService.printReceipt(newTx, company);
      else setPreviewTransaction(newTx);
    }
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
        vat0Total: acc.vat0Total + tx.vat0,
        vat21Total: acc.vat21Total + tx.vat21,
      };
    }, { totalSales: 0, transactionCount: 0, cashTotal: 0, cardTotal: 0, vat0Total: 0, vat21Total: 0 });
    return { summary: { ...summary, productSales }, expectedDrawer: startCash + summary.cashTotal };
  };

  return (
    <div className="min-h-screen flex flex-col md:flex-row bg-slate-100 font-sans text-slate-900">
      {/* SIDE NAVIGATION */}
      <nav className="bg-slate-900 text-white w-full md:w-24 flex md:flex-col items-center py-8 z-50 shadow-2xl">
        <div className="mb-10 text-amber-500"><Package size={32} /></div>
        <button onClick={() => setActiveTab('POS')} className={`p-5 rounded-3xl mb-6 transition-all ${activeTab === 'POS' ? 'bg-amber-500 shadow-lg scale-110' : 'text-slate-500 hover:text-white'}`}><ShoppingBag size={28}/></button>
        <button onClick={() => setActiveTab('REPORTS')} className={`p-5 rounded-3xl mb-6 transition-all ${activeTab === 'REPORTS' ? 'bg-amber-500 shadow-lg scale-110' : 'text-slate-500 hover:text-white'}`}><BarChart3 size={28}/></button>
        <button onClick={() => setActiveTab('SETTINGS')} className={`p-5 rounded-3xl transition-all ${activeTab === 'SETTINGS' ? 'bg-amber-500 shadow-lg scale-110' : 'text-slate-500 hover:text-white'}`}><Settings size={28}/></button>
      </nav>

      <main className="flex-1 flex flex-col overflow-hidden">
        {activeTab === 'POS' && (
          <div className="flex-1 flex flex-col md:flex-row overflow-hidden">
            {/* 4-COLUMN PRODUCT GRID */}
            <div className="flex-1 p-6 grid grid-cols-4 gap-4 overflow-y-auto content-start">
              {products.map(p => (
                <button key={p.id} onClick={() => addToCart(p)} className={`${p.color} p-6 rounded-[32px] font-black shadow-sm hover:shadow-xl active:scale-95 transition-all text-center flex flex-col items-center justify-center min-h-[140px] border-b-8 border-black/10`}>
                  <span className="text-base uppercase leading-tight mb-2">{p.name}</span>
                  <div className="bg-white/40 px-3 py-1 rounded-full text-sm">€{p.price.toFixed(2)}</div>
                  <div className="text-[10px] mt-2 opacity-60 font-bold uppercase tracking-tighter">Stock: {p.stock}</div>
                </button>
              ))}
            </div>

            {/* SHOPPING CART SIDEBAR */}
            <div className="w-full md:w-[400px] bg-white border-l shadow-2xl flex flex-col overflow-hidden">
              <div className="p-6 border-b font-black text-slate-800 bg-slate-50 flex justify-between items-center tracking-widest text-sm">
                <span>WINKELMAND</span>
                <span className="bg-amber-500 text-white px-2 py-1 rounded-lg text-xs">{cart.length} items</span>
              </div>
              
              {/* CART ITEMS - TOP */}
              <div className="flex-1 overflow-y-auto p-4 space-y-2">
                {cart.length === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center text-slate-300 font-black uppercase tracking-widest opacity-50">Mandje leeg</div>
                ) : (
                  cart.map(item => (
                    <div key={item.id} className="flex items-center justify-between p-4 bg-slate-50 rounded-3xl border border-slate-100">
                      <div className="flex items-center gap-3">
                        <button onClick={() => updateQuantity(item.id, -1)} className="p-2 bg-white rounded-xl text-red-500 shadow-sm hover:bg-red-50"><Minus size={16}/></button>
                        <span className="font-black text-lg w-6 text-center">{item.quantity}</span>
                        <button onClick={() => updateQuantity(item.id, 1)} className="p-2 bg-white rounded-xl text-green-500 shadow-sm hover:bg-green-50"><Plus size={16}/></button>
                      </div>
                      <span className="flex-1 px-4 text-sm font-black uppercase truncate text-slate-700">{item.name}</span>
                      <span className="font-black text-slate-900">€{(item.price * item.quantity).toFixed(2)}</span>
                    </div>
                  ))
                )}
              </div>

              {/* PAYMENT - FIXED BOTTOM */}
              <div className="p-8 bg-slate-900 text-white rounded-t-[50px] shadow-[0_-20px_50px_rgba(0,0,0,0.2)]">
                <div className="flex justify-between text-4xl font-black mb-8 px-2 tracking-tighter italic">
                  <span className="text-slate-400">TOTAAL</span>
                  <span className="text-amber-500">€{cartTotals.total.toFixed(2)}</span>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <button onClick={() => finalizePayment(PaymentMethod.CASH)} className="bg-green-600 hover:bg-green-500 p-6 rounded-[30px] font-black text-xl shadow-lg active:translate-y-1 transition-all flex flex-col items-center">
                    <Banknote className="mb-1" /> CASH
                  </button>
                  <button onClick={() => setPendingCardPayment(true)} className="bg-blue-600 hover:bg-blue-500 p-6 rounded-[30px] font-black text-xl shadow-lg active:translate-y-1 transition-all flex flex-col items-center">
                    <CreditCard className="mb-1" /> CARD
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'REPORTS' && (
          <div className="p-10 overflow-y-auto h-full max-w-5xl mx-auto w-full">
            <h2 className="text-4xl font-black mb-10 tracking-tighter text-slate-800">DAGRAPPORTEN</h2>
            <div className="grid gap-6">
              {sessions.slice().reverse().map(s => (
                <div key={s.id} className="bg-white p-8 rounded-[40px] border shadow-sm flex items-center justify-between hover:border-amber-400 transition-all group">
                  <div className="flex items-center gap-8">
                    <div className={`w-20 h-20 rounded-[30px] flex items-center justify-center ${s.status === 'OPEN' ? 'bg-green-100 text-green-600' : 'bg-slate-100 text-slate-400'}`}>
                      <Clock size={32}/>
                    </div>
                    <div>
                      <div className="font-black text-2xl text-slate-800">{new Date(s.startTime).toLocaleDateString('nl-NL')}</div>
                      <div className="text-sm font-bold text-slate-400 uppercase tracking-[0.2em]">{s.status === 'OPEN' ? '🟢 Actieve Verkoopsessie' : '🔴 Afgesloten'}</div>
                    </div>
                  </div>
                  <button onClick={() => {
                    const data = calculateSessionTotals(s.id, s.startCash);
                    setViewingSession({ ...s, summary: data.summary });
                  }} className="bg-slate-900 text-white px-10 py-5 rounded-[25px] font-black flex items-center gap-3 hover:bg-amber-500 transition-all shadow-xl active:scale-95">
                    <Printer size={24}/> RAPPORT BEKIJKEN
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {activeTab === 'SETTINGS' && (
          <div className="p-10 overflow-y-auto h-full max-w-6xl mx-auto w-full space-y-12 pb-24">
            {/* COMPANY DATA */}
            <section className="bg-white p-10 rounded-[50px] border shadow-sm relative overflow-hidden">
              <div className="absolute top-0 left-0 w-2 h-full bg-amber-500"></div>
              <h3 className="text-2xl font-black mb-8 uppercase tracking-widest flex items-center gap-4 text-slate-800">
                <Building size={28} className="text-amber-500"/> Bedrijfsinstellingen
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div className="space-y-3">
                  <label className="text-xs font-black text-slate-400 uppercase ml-2">Naam Zaak</label>
                  <input className="w-full p-5 bg-slate-50 border-2 border-transparent focus:border-amber-400 focus:bg-white rounded-[25px] font-bold outline-none transition-all text-lg" value={company.name} onChange={e => setCompany({...company, name: e.target.value})} />
                </div>
                <div className="space-y-3">
                  <label className="text-xs font-black text-slate-400 uppercase ml-2">Adres</label>
                  <input className="w-full p-5 bg-slate-50 border-2 border-transparent focus:border-amber-400 focus:bg-white rounded-[25px] font-bold outline-none transition-all text-lg" value={company.address} onChange={e => setCompany({...company, address: e.target.value})} />
                </div>
                <div className="space-y-3">
                  <label className="text-xs font-black text-slate-400 uppercase ml-2">BTW-Nummer</label>
                  <input className="w-full p-5 bg-slate-50 border-2 border-transparent focus:border-amber-400 focus:bg-white rounded-[25px] font-bold outline-none transition-all text-lg" value={company.vatNumber} onChange={e => setCompany({...company, vatNumber: e.target.value})} />
                </div>
                <div className="space-y-3">
                  <label className="text-xs font-black text-slate-400 uppercase ml-2">Verkoper Naam</label>
                  <input className="w-full p-5 bg-slate-100 border-2 border-transparent rounded-[25px] font-black text-amber-600 outline-none text-lg" value={company.sellerName || ''} onChange={e => setCompany({...company, sellerName: e.target.value})} />
                </div>
              </div>
            </section>

            {/* PRODUCT MANAGEMENT - FULL WIDTH ROWS */}
            <section className="bg-white p-10 rounded-[50px] border shadow-sm relative overflow-hidden">
              <div className="absolute top-0 left-0 w-2 h-full bg-blue-500"></div>
              <div className="flex justify-between items-center mb-10">
                <h3 className="text-2xl font-black uppercase tracking-widest flex items-center gap-4 text-slate-800">
                  <Tag size={28} className="text-blue-500"/> Producten & Voorraad
                </h3>
                <button onClick={() => setProducts([...products, { id: Date.now().toString(), name: 'NIEUW PRODUCT', price: 0, vatRate: 21, color: 'bg-slate-200', stock: 100 }])} className="bg-blue-600 text-white px-10 py-4 rounded-[25px] font-black hover:bg-blue-700 transition-all shadow-xl active:scale-95 flex items-center gap-3">
                  <Plus size={24}/> NIEUW PRODUCT
                </button>
              </div>

              <div className="space-y-4">
                {products.map(p => (
                  <div key={p.id} className="grid grid-cols-12 gap-4 items-center bg-slate-50 p-4 rounded-[30px] border border-slate-100 hover:bg-white hover:shadow-xl transition-all group">
                    <div className="col-span-5 px-2">
                      <label className="text-[10px] font-black text-slate-400 uppercase mb-1 block">Naam</label>
                      <input className="w-full p-4 bg-white rounded-2xl font-black text-slate-700 border-2 border-transparent focus:border-blue-400 outline-none uppercase" value={p.name} onChange={e => setProducts(products.map(x => x.id === p.id ? {...x, name: e.target.value} : x))} />
                    </div>
                    <div className="col-span-2">
                      <label className="text-[10px] font-black text-slate-400 uppercase mb-1 block text-center">Prijs (€)</label>
                      <input type="number" className="w-full p-4 bg-white rounded-2xl font-black text-center border-2 border-transparent focus:border-blue-400 outline-none" value={p.price} onChange={e => setProducts(products.map(x => x.id === p.id ? {...x, price: parseFloat(e.target.value)} : x))} />
                    </div>
                    <div className="col-span-2">
                      <label className="text-[10px] font-black text-slate-400 uppercase mb-1 block text-center">BTW</label>
                      <select className="w-full p-4 bg-white rounded-2xl font-black text-center outline-none border-2 border-transparent focus:border-blue-400 appearance-none cursor-pointer" value={p.vatRate} onChange={e => setProducts(products.map(x => x.id === p.id ? {...x, vatRate: parseInt(e.target.value) as 0|21} : x))}>
                        <option value={21}>21%</option>
                        <option value={0}>0%</option>
                      </select>
                    </div>
                    <div className="col-span-2">
                      <label className="text-[10px] font-black text-slate-400 uppercase mb-1 block text-center">Stock</label>
                      <input type="number" className="w-full p-4 bg-white rounded-2xl font-black text-center border-2 border-transparent focus:border-blue-400 outline-none" value={p.stock} onChange={e => setProducts(products.map(x => x.id === p.id ? {...x, stock: parseInt(e.target.value)} : x))} />
                    </div>
                    <div className="col-span-1 flex justify-center pt-5">
                      <button onClick={() => setProducts(products.filter(x => x.id !== p.id))} className="text-slate-300 hover:text-red-500 p-2 transition-colors">
                        <Trash2 size={24}/>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </section>

            {/* CASH SESSION MANAGEMENT */}
            <section className="bg-white p-10 rounded-[50px] border shadow-sm relative overflow-hidden">
              <div className="absolute top-0 left-0 w-2 h-full bg-green-500"></div>
              <h3 className="text-2xl font-black mb-8 uppercase tracking-widest text-slate-800 flex items-center gap-4 italic">
                <Clock size={28} className="text-green-500" /> Kassasessie
              </h3>
              {!currentSession ? (
                <div className="flex flex-col md:flex-row gap-8 items-end">
                  <div className="flex-1 w-full">
                    <label className="block text-xs font-black text-slate-400 mb-3 uppercase ml-2 tracking-widest">Inhoud kassa bij start (€)</label>
                    <input type="number" value={startFloatAmount} onChange={e => setStartFloatAmount(e.target.value)} className="w-full p-6 bg-slate-50 rounded-[30px] font-black text-4xl outline-none focus:bg-white focus:ring-4 ring-green-500/10 transition-all" placeholder="0.00" />
                  </div>
                  <button onClick={() => {
                    const s = { id: Date.now().toString(), startTime: Date.now(), startCash: parseFloat(startFloatAmount) || 0, status: 'OPEN' as const };
                    setSessions([...sessions, s]); setCurrentSession(s); setActiveTab('POS');
                  }} className="w-full md:w-auto bg-green-600 text-white px-16 py-7 rounded-[30px] font-black shadow-2xl shadow-green-200 hover:bg-green-500 transition-all uppercase tracking-widest text-xl">
                    OPEN KASSA
                  </button>
                </div>
              ) : (
                <div className="space-y-6">
                  <div className="p-6 bg-green-50 text-green-700 rounded-[30px] font-black text-center border-2 border-green-200 uppercase tracking-widest">
                    ✅ KASSA IS OPEN (Sinds {new Date(currentSession.startTime).toLocaleTimeString()})
                  </div>
                  <button onClick={() => {
                    if(window.confirm("Wil je de kassa definitief sluiten? Er wordt een dagrapport gegenereerd.")) {
                      const res = calculateSessionTotals(currentSession.id, currentSession.startCash);
                      setSessions(sessions.map(s => s.id === currentSession.id ? {...s, status: 'CLOSED' as const, summary: res.summary, endTime: Date.now(), expectedCash: res.expectedDrawer} : s));
                      setCurrentSession(null);
                      setCart([]);
                    }
                  }} className="w-full bg-red-500 text-white p-8 rounded-[40px] font-black text-2xl shadow-2xl shadow-red-200 hover:bg-red-600 transition-all uppercase tracking-widest">
                    SLUIT SESSIE & GENEREER RAPPORT
                  </button>
                </div>
              )}
            </section>
          </div>
        )}
      </main>

      {/* PAYMENT MODAL */}
      {pendingCardPayment && (
        <div className="fixed inset-0 z-[300] bg-slate-900/95 flex items-center justify-center p-4 backdrop-blur-xl">
          <div className="bg-white p-14 rounded-[60px] text-center max-w-sm w-full shadow-2xl scale-110">
            <div className="w-32 h-32 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center mx-auto mb-8 animate-pulse shadow-inner"><CreditCard size={64}/></div>
            <h2 className="text-6xl font-black mb-12 tracking-tighter text-slate-900">€{cartTotals.total.toFixed(2)}</h2>
            <button onClick={() => finalizePayment(PaymentMethod.CARD)} className="w-full bg-blue-600 text-white py-8 rounded-[35px] font-black text-3xl shadow-2xl active:scale-95 transition-all">KAART OK</button>
            <button onClick={() => setPendingCardPayment(false)} className="mt-8 text-slate-400 font-black uppercase text-sm tracking-[0.3em] hover:text-slate-600 transition-colors">Annuleren</button>
          </div>
        </div>
      )}

      {/* RECEIPT VIEW */}
      {(previewTransaction || viewingSession) && (
        <div className="fixed inset-0 z-[200] bg-black/80 flex items-center justify-center p-4 backdrop-blur-md">
          <div className="bg-white p-12 rounded-[60px] max-w-md w-full shadow-2xl overflow-y-auto max-h-[90vh] relative border-[12px] border-slate-100">
            <button onClick={() => {setPreviewTransaction(null); setViewingSession(null);}} className="absolute top-6 right-6 bg-slate-100 p-3 rounded-full text-slate-400 hover:text-slate-900 transition-all"><X size={24}/></button>
            <Receipt transaction={previewTransaction} sessionSummary={viewingSession} company={company} />
            <button onClick={() => {setPreviewTransaction(null); setViewingSession(null);}} className="w-full mt-10 bg-slate-900 text-white py-6 rounded-[30px] font-black uppercase tracking-widest text-lg hover:bg-amber-500 transition-all">SLUITEN</button>
          </div>
        </div>
      )}
    </div>
  );
}
