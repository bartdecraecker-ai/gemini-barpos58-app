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

    setProducts(prev => prev.map(p => {
      const ci = cart.find(i => i.id === p.id);
      return ci ? { ...p, stock: p.stock - ci.quantity } : p;
    }));

    setTransactions([newTx, ...transactions]);
    setCart([]);
    setPendingCardPayment(false);
    setPreviewTransaction(newTx);
  };

  const connectBluetooth = async () => {
    const connected = await btPrinterService.connect();
    setBtConnected(connected);
  };

  const handlePrint = async () => {
    if (btConnected) {
      if (previewTransaction) await btPrinterService.printReceipt(previewTransaction, company);
      // Voor sessie rapporten voegen we hier de logica toe in de printerService
    } else {
      window.print();
    }
  };

  return (
    <div className="h-screen flex flex-col md:flex-row bg-slate-100 overflow-hidden text-slate-900">
      {/* NAVIGATIE (Mobiel onderaan) */}
      <nav className="bg-slate-900 text-white w-full md:w-20 flex md:flex-col items-center justify-around md:justify-start py-3 md:py-8 z-[100] order-last md:order-first shadow-2xl">
        <button onClick={() => setActiveTab('POS')} className={`p-4 rounded-2xl ${activeTab === 'POS' ? 'bg-amber-500 shadow-lg' : 'text-slate-500'}`}><ShoppingBag /></button>
        <button onClick={() => setActiveTab('REPORTS')} className={`p-4 rounded-2xl md:my-4 ${activeTab === 'REPORTS' ? 'bg-amber-500 shadow-lg' : 'text-slate-500'}`}><BarChart3 /></button>
        <button onClick={() => setActiveTab('SETTINGS')} className={`p-4 rounded-2xl ${activeTab === 'SETTINGS' ? 'bg-amber-500 shadow-lg' : 'text-slate-500'}`}><Settings /></button>
      </nav>

      <main className="flex-1 flex flex-col overflow-hidden relative">
        {activeTab === 'POS' && (
          <div className="flex-1 flex flex-col md:flex-row overflow-hidden">
            {/* GRID */}
            <div className="flex-1 p-4 grid grid-cols-2 sm:grid-cols-4 gap-3 overflow-y-auto content-start pb-24 md:pb-4">
              {products.map(p => (
                <button key={p.id} onClick={() => addToCart(p)} className={`${p.color} p-4 rounded-[2rem] font-black shadow-sm flex flex-col items-center justify-center min-h-[110px] active:scale-95 transition-all border-b-4 border-black/10`}>
                  <span className="text-xs uppercase text-center leading-tight mb-1">{p.name}</span>
                  <span className="text-sm bg-white/40 px-3 py-0.5 rounded-full">€{p.price.toFixed(2)}</span>
                </button>
              ))}
            </div>

            {/* MANDJE - FIXED LAYOUT */}
            <div className="w-full md:w-[380px] bg-white border-t md:border-t-0 md:border-l flex flex-col h-[45vh] md:h-full z-50">
              <div className="p-4 border-b font-black flex justify-between bg-slate-50 text-[10px] tracking-[0.2em] uppercase text-slate-400">
                <span>Winkelmand</span>
                <span className="text-amber-500">{cart.length} ITEMS</span>
              </div>
              <div className="flex-1 overflow-y-auto p-2 space-y-2">
                {cart.map(item => (
                  <div key={item.id} className="flex items-center justify-between p-3 bg-slate-50 rounded-2xl border border-slate-100">
                    <div className="flex items-center gap-2">
                      <button onClick={() => updateQuantity(item.id, -1)} className="p-1.5 bg-white rounded-lg shadow-sm text-red-500"><Minus size={14}/></button>
                      <span className="font-black w-4 text-center">{item.quantity}</span>
                      <button onClick={() => updateQuantity(item.id, 1)} className="p-1.5 bg-white rounded-lg shadow-sm text-green-500"><Plus size={14}/></button>
                    </div>
                    <span className="flex-1 px-3 text-[11px] font-black uppercase truncate">{item.name}</span>
                    <span className="font-black text-sm">€{(item.price * item.quantity).toFixed(2)}</span>
                  </div>
                ))}
              </div>
              <div className="p-6 bg-slate-900 text-white rounded-t-[2.5rem] md:rounded-none shadow-[0_-10px_40px_rgba(0,0,0,0.2)]">
                <div className="flex justify-between text-3xl font-black mb-6 italic tracking-tighter">
                  <span className="text-slate-500">TOTAAL</span>
                  <span className="text-amber-500">€{cartTotal.toFixed(2)}</span>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <button onClick={() => finalizePayment(PaymentMethod.CASH)} className="bg-green-600 p-5 rounded-2xl font-black flex flex-col items-center shadow-lg active:translate-y-1 transition-all"><Banknote className="mb-1"/> CASH</button>
                  <button onClick={() => setPendingCardPayment(true)} className="bg-blue-600 p-5 rounded-2xl font-black flex flex-col items-center shadow-lg active:translate-y-1 transition-all"><CreditCard className="mb-1"/> CARD</button>
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'REPORTS' && (
          <div className="p-6 overflow-y-auto h-full max-w-4xl mx-auto w-full space-y-4">
            <h2 className="text-3xl font-black tracking-tighter text-slate-800 mb-8 italic">Dagrapporten</h2>
            {sessions.slice().reverse().map(s => (
              <div key={s.id} className="bg-white p-6 rounded-[2rem] shadow-sm border border-slate-200 flex items-center justify-between hover:border-amber-400 transition-all">
                <div className="flex items-center gap-5">
                  <div className={`p-4 rounded-2xl ${s.status === 'OPEN' ? 'bg-green-100 text-green-600' : 'bg-slate-100 text-slate-400'}`}><Clock size={28}/></div>
                  <div>
                    <div className="font-black text-xl">{new Date(s.startTime).toLocaleDateString('nl-NL')}</div>
                    <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{s.status === 'OPEN' ? '🟢 Actief' : '🔴 Gesloten'}</div>
                  </div>
                </div>
                <button onClick={() => { const d = calculateSessionTotals(s.id, s.startCash); setViewingSession({ ...s, summary: d.summary }); }} 
                  className="bg-slate-900 text-white px-8 py-4 rounded-2xl font-black flex items-center gap-2 hover:bg-amber-500 transition-all shadow-lg">
                  <Printer size={20}/> RAPPORT
                </button>
              </div>
            ))}
          </div>
        )}

        {activeTab === 'SETTINGS' && (
          <div className="p-6 overflow-y-auto h-full max-w-5xl mx-auto w-full space-y-8 pb-32">
            {/* PRINTER CONNECT */}
            <button onClick={connectBluetooth} className={`w-full p-6 rounded-[2rem] font-black flex items-center justify-center gap-4 transition-all shadow-lg ${btConnected ? 'bg-green-100 text-green-700 border-2 border-green-200' : 'bg-blue-600 text-white shadow-blue-200'}`}>
              <Bluetooth size={28} /> {btConnected ? 'PRINTER VERBONDEN' : 'VERBIND BLUETOOTH PRINTER'}
            </button>

            <section className="bg-white p-8 rounded-[2.5rem] shadow-sm border border-slate-200 space-y-6">
              <h3 className="font-black uppercase tracking-widest text-slate-400 text-xs flex items-center gap-2 border-b pb-4"><Building size={18}/> Bedrijfsgegevens</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase ml-2">Naam</label>
                  <input className="w-full p-4 bg-slate-50 rounded-2xl font-bold border-none" value={company.name} onChange={e => setCompany({...company, name: e.target.value})} />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase ml-2">Adres</label>
                  <input className="w-full p-4 bg-slate-50 rounded-2xl font-bold border-none" value={company.address} onChange={e => setCompany({...company, address: e.target.value})} />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase ml-2">BTW</label>
                  <input className="w-full p-4 bg-slate-50 rounded-2xl font-bold border-none" value={company.vatNumber} onChange={e => setCompany({...company, vatNumber: e.target.value})} />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase ml-2">Verkoper</label>
                  <input className="w-full p-4 bg-slate-100 rounded-2xl font-black text-amber-600 border-none" value={company.sellerName || ''} onChange={e => setCompany({...company, sellerName: e.target.value})} />
                </div>
              </div>
            </section>

            <section className="bg-white p-8 rounded-[2.5rem] shadow-sm border border-slate-200">
              <div className="flex justify-between items-center mb-6 border-b pb-4">
                <h3 className="font-black uppercase tracking-widest text-slate-400 text-xs flex items-center gap-2"><Tag size={18}/> Producten</h3>
                <button onClick={() => setProducts([...products, { id: Date.now().toString(), name: 'NIEUW', price: 0, vatRate: 21, color: 'bg-slate-200', stock: 100 }])} className="bg-slate-900 text-white px-5 py-2 rounded-xl text-xs font-black">+ PRODUCT</button>
              </div>
              <div className="space-y-3">
                {products.map(p => (
                  <div key={p.id} className="flex flex-col sm:flex-row gap-3 bg-slate-50 p-4 rounded-2xl border border-slate-100 items-center">
                    <input className="w-full sm:flex-1 p-3 bg-white rounded-xl font-bold uppercase shadow-sm border-none" value={p.name} onChange={e => setProducts(products.map(x => x.id === p.id ? {...x, name: e.target.value} : x))} />
                    <div className="flex gap-3 w-full sm:w-auto">
                      <input type="number" className="flex-1 sm:w-24 p-3 bg-white rounded-xl font-black text-center shadow-sm border-none" value={p.price} onChange={e => setProducts(products.map(x => x.id === p.id ? {...x, price: parseFloat(e.target.value)} : x))} />
                      <select className="flex-1 sm:w-24 p-3 bg-white rounded-xl font-black shadow-sm border-none" value={p.vatRate} onChange={e => setProducts(products.map(x => x.id === p.id ? {...x, vatRate: parseInt(e.target.value) as 0|21} : x))}>
                        <option value={21}>21%</option>
                        <option value={0}>0%</option>
                      </select>
                      <button onClick={() => setProducts(products.filter(x => x.id !== p.id))} className="text-red-400 p-2 hover:text-red-600"><Trash2 size={24}/></button>
                    </div>
                  </div>
                ))}
              </div>
            </section>

            <section className="bg-white p-8 rounded-[2.5rem] shadow-sm border border-slate-200 space-y-6">
              <h3 className="font-black uppercase tracking-widest text-slate-400 text-xs italic border-b pb-4">Kassa Sessie</h3>
              {!currentSession ? (
                <div className="flex gap-4">
                  <input type="number" value={startFloatAmount} onChange={e => setStartFloatAmount(e.target.value)} className="flex-1 p-5 bg-slate-50 rounded-2xl font-black text-3xl outline-none" placeholder="0.00" />
                  <button onClick={() => {
                    const s = { id: Date.now().toString(), startTime: Date.now(), startCash: parseFloat(startFloatAmount) || 0, status: 'OPEN' as const };
                    setSessions([...sessions, s]); setCurrentSession(s); setActiveTab('POS');
                  }} className="bg-green-600 text-white px-10 py-5 rounded-2xl font-black shadow-lg shadow-green-100 hover:bg-green-500 transition-all">OPEN KASSA</button>
                </div>
              ) : (
                <button onClick={() => {
                  if(window.confirm("Kassa sluiten?")) {
                    const res = calculateSessionTotals(currentSession.id, currentSession.startCash);
                    setSessions(sessions.map(s => s.id === currentSession.id ? {...s, status: 'CLOSED' as const, summary: res.summary, endTime: Date.now(), expectedCash: res.expectedDrawer} : s));
                    setCurrentSession(null);
                  }
                }} className="w-full bg-red-500 text-white p-6 rounded-[2rem] font-black text-xl shadow-xl shadow-red-100 hover:bg-red-600 transition-all uppercase tracking-widest">SLUIT SESSIE & PRINT RAPPORT</button>
              )}
            </section>
          </div>
        )}
      </main>

      {/* MODALS */}
      {pendingCardPayment && (
        <div className="fixed inset-0 z-[300] bg-slate-900/90 flex items-center justify-center p-4">
          <div className="bg-white p-12 rounded-[3rem] text-center w-full max-w-sm shadow-2xl">
            <CreditCard size={64} className="mx-auto mb-6 text-blue-600 animate-pulse" />
            <h2 className="text-5xl font-black mb-10 italic tracking-tighter text-slate-800">€{cartTotal.toFixed(2)}</h2>
            <button onClick={() => finalizePayment(PaymentMethod.CARD)} className="w-full bg-blue-600 text-white py-6 rounded-2xl font-black text-2xl shadow-xl hover:bg-blue-500 transition-all">BETALING VOLTOOID</button>
            <button onClick={() => setPendingCardPayment(false)} className="mt-6 text-slate-400 font-black uppercase text-xs tracking-widest">Annuleren</button>
          </div>
        </div>
      )}

      {(previewTransaction || viewingSession) && (
        <div className="fixed inset-0 z-[200] bg-black/80 flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-white p-8 rounded-[3rem] max-w-sm w-full overflow-y-auto max-h-[90vh] shadow-2xl relative border-[12px] border-slate-50">
            <button onClick={() => {setPreviewTransaction(null); setViewingSession(null);}} className="absolute top-4 right-4 text-slate-300 hover:text-slate-900 transition-colors"><X size={28}/></button>
            <Receipt transaction={previewTransaction} sessionSummary={viewingSession} company={company} />
            <div className="mt-10 space-y-3">
              <button onClick={handlePrint} className="w-full bg-slate-900 text-white py-5 rounded-2xl font-black uppercase flex items-center justify-center gap-3 shadow-xl hover:bg-amber-500 transition-all">
                <Printer size={24}/> {btConnected ? 'PRINT VIA BLUETOOTH' : 'PRINT NU'}
              </button>
              <button onClick={() => {setPreviewTransaction(null); setViewingSession(null);}} className="w-full bg-slate-100 text-slate-400 py-4 rounded-2xl font-black uppercase tracking-widest">SLUITEN</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
