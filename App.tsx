import React, { useState, useEffect, useMemo } from 'react';
import { 
  ShoppingBag, Trash2, CreditCard, Banknote, BarChart3, 
  Settings, Printer, Plus, Minus, Bluetooth, AlertTriangle, 
  X, User, Building, Tag, Package
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
    setCart(prev => prev.map(item => item.id === id ? { ...item, quantity: item.quantity + delta } : item).filter(i => i.quantity !== 0));
  };

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

  // --- Betaling & Sessies ---
  const finalizePayment = async (method: PaymentMethod) => {
    if (!currentSession) return alert("Open eerst een kassa sessie in de instellingen!");
    
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

    // Update voorraad
    setProducts(prev => prev.map(p => {
      const cartItem = cart.find(ci => ci.id === p.id);
      return cartItem ? { ...p, stock: p.stock - cartItem.quantity } : p;
    }));

    setTransactions([newTx, ...transactions]);
    setCart([]);
    setPendingCardPayment(false);
    
    if (window.confirm("Ticket afdrukken?")) {
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
    <div className="min-h-screen flex flex-col md:flex-row bg-slate-100">
      <nav className="bg-slate-900 text-white w-full md:w-20 flex md:flex-col items-center py-4 z-50 shadow-2xl">
        <button onClick={() => setActiveTab('POS')} className={`p-4 rounded-xl mb-4 ${activeTab === 'POS' ? 'bg-amber-500 shadow-lg' : 'hover:bg-slate-800'}`}><ShoppingBag /></button>
        <button onClick={() => setActiveTab('REPORTS')} className={`p-4 rounded-xl mb-4 ${activeTab === 'REPORTS' ? 'bg-amber-500 shadow-lg' : 'hover:bg-slate-800'}`}><BarChart3 /></button>
        <button onClick={() => setActiveTab('SETTINGS')} className={`p-4 rounded-xl ${activeTab === 'SETTINGS' ? 'bg-amber-500 shadow-lg' : 'hover:bg-slate-800'}`}><Settings /></button>
      </nav>

      <main className="flex-1 flex flex-col overflow-hidden">
        {activeTab === 'POS' && (
          <div className="flex-1 flex flex-col md:flex-row overflow-hidden">
            {/* GRID 4 KOLOMMEN */}
            <div className="flex-1 p-4 grid grid-cols-4 gap-3 overflow-y-auto content-start">
              {products.map(p => (
                <button key={p.id} onClick={() => addToCart(p)} className={`${p.color} p-4 rounded-2xl font-bold shadow-md hover:brightness-95 transition-all flex flex-col items-center justify-center min-h-[100px] border-b-4 border-black/10`}>
                  <span className="text-sm uppercase leading-tight">{p.name}</span>
                  <div className="flex flex-col text-[10px] opacity-70 mt-1">
                    <span>€{p.price.toFixed(2)}</span>
                    <span>Voorraad: {p.stock}</span>
                  </div>
                </button>
              ))}
            </div>

            {/* ZIJBALK */}
            <div className="w-full md:w-96 bg-white border-l shadow-2xl flex flex-col">
              {/* LIJST BOVENAAN */}
              <div className="p-4 border-b font-black text-slate-700 bg-slate-50 uppercase text-xs tracking-widest">Winkelmand</div>
              <div className="flex-1 overflow-y-auto p-2">
                {cart.map(item => (
                  <div key={item.id} className="flex items-center justify-between p-3 border-b hover:bg-slate-50 rounded-xl">
                    <div className="flex items-center gap-2">
                      <button onClick={() => updateQuantity(item.id, -1)} className="p-1 bg-slate-200 rounded text-red-600"><Minus size={14}/></button>
                      <span className="font-bold w-4 text-center">{item.quantity}</span>
                      <button onClick={() => updateQuantity(item.id, 1)} className="p-1 bg-slate-200 rounded text-green-600"><Plus size={14}/></button>
                    </div>
                    <span className="flex-1 px-3 text-sm font-bold truncate">{item.name}</span>
                    <span className="font-black">€{(item.price * item.quantity).toFixed(2)}</span>
                  </div>
                ))}
              </div>

              {/* TOTAAL & AFREKENEN ONDERAAN */}
              <div className="p-6 bg-slate-900 text-white rounded-t-[40px] shadow-[0_-10px_30px_rgba(0,0,0,0.3)]">
                <div className="flex justify-between text-3xl font-black mb-6 px-2 italic">
                  <span>TOTAAL</span>
                  <span className="text-amber-500">€{cartTotals.total.toFixed(2)}</span>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <button onClick={() => finalizePayment(PaymentMethod.CASH)} className="bg-green-600 p-5 rounded-3xl font-black text-lg hover:bg-green-500 active:translate-y-1 transition-all">CASH</button>
                  <button onClick={() => setPendingCardPayment(true)} className="bg-blue-600 p-5 rounded-3xl font-black text-lg hover:bg-blue-500 active:translate-y-1 transition-all">CARD</button>
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'REPORTS' && (
          <div className="p-8 overflow-y-auto h-full max-w-4xl mx-auto w-full">
            <h2 className="text-3xl font-black mb-8">Rapporten</h2>
            <div className="space-y-4">
              {sessions.slice().reverse().map(s => (
                <div key={s.id} className="bg-white p-6 rounded-3xl border shadow-sm flex items-center justify-between">
                  <div>
                    <div className="font-black text-xl">{new Date(s.startTime).toLocaleDateString()}</div>
                    <div className="text-sm font-bold text-slate-400">{s.status === 'OPEN' ? '🟢 ACTIEF' : '🔴 GESLOTEN'} | ID: {s.id.slice(-4)}</div>
                  </div>
                  <button onClick={() => {
                    const res = s.status === 'OPEN' ? calculateSessionTotals(s.id, s.startCash) : s;
                    setViewingSession({ ...s, summary: res.summary });
                  }} className="bg-slate-900 text-white px-8 py-4 rounded-2xl font-black flex items-center gap-2 hover:bg-amber-500 transition-all">
                    <Printer size={20}/> PRINT RAPPORT
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {activeTab === 'SETTINGS' && (
          <div className="p-8 overflow-y-auto h-full max-w-4xl mx-auto w-full space-y-8">
            {/* BEDRIJF BEHEER */}
            <div className="bg-white p-8 rounded-[40px] border shadow-sm">
              <h3 className="text-xl font-black mb-6 flex items-center gap-2 uppercase tracking-tighter"><Building size={20}/> Bedrijf & Verkoper</h3>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-4">
                  <input className="w-full p-3 border rounded-xl" placeholder="Bedrijfsnaam" value={company.name} onChange={e => setCompany({...company, name: e.target.value})} />
                  <input className="w-full p-3 border rounded-xl" placeholder="Adres" value={company.address} onChange={e => setCompany({...company, address: e.target.value})} />
                </div>
                <div className="space-y-4">
                  <input className="w-full p-3 border rounded-xl" placeholder="BTW Nummer" value={company.vatNumber} onChange={e => setCompany({...company, vatNumber: e.target.value})} />
                  <input className="w-full p-3 border rounded-xl font-bold text-amber-600" placeholder="Naam Verkoper" value={company.sellerName || ''} onChange={e => setCompany({...company, sellerName: e.target.value})} />
                </div>
              </div>
            </div>

            {/* PRODUCT BEHEER */}
            <div className="bg-white p-8 rounded-[40px] border shadow-sm">
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-xl font-black uppercase tracking-tighter flex items-center gap-2"><Tag size={20}/> Producten & Voorraad</h3>
                <button onClick={() => setProducts([...products, { id: Date.now().toString(), name: 'NIEUW', price: 0, vatRate: 21, color: 'bg-slate-200', stock: 100 }])} className="bg-amber-500 text-white px-6 py-2 rounded-xl font-black">+ PRODUCT</button>
              </div>
              <div className="space-y-3">
                {products.map(p => (
                  <div key={p.id} className="flex gap-3 bg-slate-50 p-4 rounded-2xl border items-center">
                    <input className="flex-1 p-2 border rounded-lg font-bold" value={p.name} onChange={e => setProducts(products.map(x => x.id === p.id ? {...x, name: e.target.value.toUpperCase()} : x))} />
                    <input type="number" className="w-24 p-2 border rounded-lg font-black text-center" value={p.price} onChange={e => setProducts(products.map(x => x.id === p.id ? {...x, price: parseFloat(e.target.value)} : x))} />
                    <div className="flex items-center gap-1 bg-white p-2 border rounded-lg">
                      <Package size={14} className="text-slate-400"/>
                      <input type="number" className="w-16 font-bold text-center" value={p.stock} onChange={e => setProducts(products.map(x => x.id === p.id ? {...x, stock: parseInt(e.target.value)} : x))} />
                    </div>
                    <button onClick={() => setProducts(products.filter(x => x.id !== p.id))} className="text-red-500 p-2"><Trash2 size={20}/></button>
                  </div>
                ))}
              </div>
            </div>

            {/* KASSA SESSIE */}
            <div className="bg-white p-8 rounded-[40px] border shadow-sm">
              <h3 className="text-xl font-black mb-4 uppercase tracking-tighter">Kassa Sessie</h3>
              {!currentSession ? (
                <div className="flex gap-4">
                  <input type="number" value={startFloatAmount} onChange={e => setStartFloatAmount(e.target.value)} className="w-32 p-4 border rounded-2xl font-black" placeholder="0.00" />
                  <button onClick={() => {
                    const s = { id: Date.now().toString(), startTime: Date.now(), startCash: parseFloat(startFloatAmount) || 0, status: 'OPEN' as const };
                    setSessions([...sessions, s]); setCurrentSession(s); setActiveTab('POS');
                  }} className="bg-green-600 text-white px-8 py-4 rounded-2xl font-black shadow-lg">OPEN KASSA</button>
                </div>
              ) : (
                <button onClick={() => {
                  if(window.confirm("Sessie sluiten en rapport genereren?")) {
                    const {summary, expectedDrawer} = calculateSessionTotals(currentSession.id, currentSession.startCash);
                    setSessions(sessions.map(s => s.id === currentSession.id ? {...s, status: 'CLOSED' as const, summary, endTime: Date.now(), expectedCash: expectedDrawer} : s));
                    setCurrentSession(null);
                  }
                }} className="w-full bg-red-600 text-white p-5 rounded-3xl font-black text-lg shadow-lg shadow-red-100">SLUIT SESSIE & PRINT DAGRAPPORT</button>
              )}
            </div>
          </div>
        )}
      </main>

      {/* OVERLAYS */}
      {pendingCardPayment && (
        <div className="fixed inset-0 z-[300] bg-slate-900/95 flex items-center justify-center p-4 backdrop-blur-md">
          <div className="bg-white p-12 rounded-[50px] text-center max-w-sm w-full shadow-2xl">
            <CreditCard size={64} className="mx-auto mb-6 text-blue-600" />
            <h2 className="text-5xl font-black mb-10 tracking-tighter text-slate-900">€{cartTotals.total.toFixed(2)}</h2>
            <button onClick={() => finalizePayment(PaymentMethod.CARD)} className="w-full bg-blue-600 text-white py-6 rounded-3xl font-black text-2xl shadow-xl active:scale-95 transition-all">BETALING OK</button>
            <button onClick={() => setPendingCardPayment(false)} className="mt-4 text-slate-400 font-bold uppercase text-xs tracking-widest">Annuleren</button>
          </div>
        </div>
      )}

      {(previewTransaction || viewingSession) && (
        <div className="fixed inset-0 z-[200] bg-black/80 flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-white p-10 rounded-[50px] max-w-sm w-full shadow-2xl overflow-y-auto max-h-[90vh] relative border-8 border-slate-200">
            <button onClick={() => {setPreviewTransaction(null); setViewingSession(null);}} className="absolute top-4 right-4 bg-slate-100 p-2 rounded-full text-slate-400"><X size={20}/></button>
            <Receipt transaction={previewTransaction} sessionSummary={viewingSession} company={company} />
            <button onClick={() => {setPreviewTransaction(null); setViewingSession(null);}} className="w-full mt-10 bg-slate-900 text-white py-5 rounded-3xl font-black uppercase tracking-widest">SLUITEN</button>
          </div>
        </div>
      )}
    </div>
  );
}
