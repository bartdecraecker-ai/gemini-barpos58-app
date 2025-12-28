import React, { useState, useEffect, useMemo } from 'react';
import { 
  ShoppingBag, Trash2, CreditCard, Banknote, BarChart3, 
  Settings, Printer, Plus, Minus, Bluetooth, AlertTriangle, 
  X, RotateCcw, Clock, User
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
  const [btConnected, setBtConnected] = useState(false);
  const [pendingCardPayment, setPendingCardPayment] = useState(false);

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

  // --- POS Functies ---
  const addToCart = (product: Product) => {
    setCart(prev => {
      const existing = prev.find(item => item.id === product.id);
      if (existing) return prev.map(item => item.id === product.id ? { ...item, quantity: item.quantity + 1 } : item);
      return [...prev, { ...product, quantity: 1 }];
    });
  };

  const updateQuantity = (id: string, delta: number) => {
    setCart(prev => prev.map(item => item.id === id ? { ...item, quantity: item.quantity + delta } : item).filter(i => i.quantity > 0));
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

  const finalizePayment = async (method: PaymentMethod) => {
    if (!currentSession) return alert("Open eerst een kassa sessie!");
    const total = cart.reduce((a, b) => a + (b.price * b.quantity), 0);
    const newTx: Transaction = {
      id: `TR-${Date.now().toString().slice(-4)}`,
      sessionId: currentSession.id,
      timestamp: Date.now(),
      dateStr: new Date().toLocaleDateString('nl-NL'),
      items: [...cart],
      total,
      vat0: 0, vat21: 0, paymentMethod: method, subtotal: 0
    };
    setTransactions([newTx, ...transactions]);
    setCart([]);
    setPendingCardPayment(false);
    
    if (window.confirm("Ticket afdrukken?")) {
      if (btConnected) await btPrinterService.printReceipt(newTx, company);
      else setPreviewTransaction(newTx);
    }
  };

  return (
    <div className="min-h-screen flex flex-col md:flex-row bg-slate-100">
      <nav className="bg-slate-900 text-white w-full md:w-20 flex md:flex-col items-center py-4 z-50">
        <button onClick={() => setActiveTab('POS')} className={`p-4 rounded-xl mb-4 ${activeTab === 'POS' ? 'bg-amber-500' : ''}`}><ShoppingBag /></button>
        <button onClick={() => setActiveTab('REPORTS')} className={`p-4 rounded-xl mb-4 ${activeTab === 'REPORTS' ? 'bg-amber-500' : ''}`}><BarChart3 /></button>
        <button onClick={() => setActiveTab('SETTINGS')} className={`p-4 rounded-xl ${activeTab === 'SETTINGS' ? 'bg-amber-500' : ''}`}><Settings /></button>
      </nav>

      <main className="flex-1 flex flex-col overflow-hidden">
        {activeTab === 'POS' && (
          <div className="flex-1 flex flex-col md:flex-row overflow-hidden">
            {/* PRODUCTEN GRID - 4 KOLOMMEN */}
            <div className="flex-1 p-4 grid grid-cols-4 gap-3 overflow-y-auto content-start">
              {products.map(p => (
                <button key={p.id} onClick={() => addToCart(p)} className={`${p.color} p-4 rounded-2xl font-bold shadow text-center flex flex-col items-center justify-center min-h-[100px]`}>
                  <span className="text-sm uppercase tracking-tighter">{p.name}</span>
                  <span className="text-xs opacity-70">€{p.price.toFixed(2)}</span>
                </button>
              ))}
            </div>

            {/* ZIJBALK - MANDJE BOVEN, BETALEN ONDER */}
            <div className="w-full md:w-96 bg-white border-l flex flex-col shadow-xl">
              <div className="p-4 border-b font-black text-slate-700 bg-slate-50 uppercase tracking-widest text-xs">Geselecteerd</div>
              
              {/* MANDJE BOVENAAN */}
              <div className="flex-1 overflow-y-auto p-2">
                {cart.map(item => (
                  <div key={item.id} className="flex items-center justify-between p-2 border-b">
                    <div className="flex items-center gap-2">
                      <button onClick={() => updateQuantity(item.id, -1)} className="p-1 bg-slate-100 rounded text-red-500"><Minus size={14}/></button>
                      <span className="font-bold w-4 text-center">{item.quantity}</span>
                      <button onClick={() => updateQuantity(item.id, 1)} className="p-1 bg-slate-100 rounded text-green-500"><Plus size={14}/></button>
                    </div>
                    <span className="flex-1 px-3 text-sm font-bold uppercase truncate">{item.name}</span>
                    <span className="font-black">€{(item.price * item.quantity).toFixed(2)}</span>
                  </div>
                ))}
              </div>

              {/* BETALEN ALTIJD ONDERAAN */}
              <div className="p-6 bg-slate-900 text-white shadow-[0_-4px_20px_rgba(0,0,0,0.2)]">
                <div className="flex justify-between text-2xl font-black mb-4">
                  <span>TOTAAL</span>
                  <span className="text-amber-500">€{cart.reduce((a, b) => a + (b.price * b.quantity), 0).toFixed(2)}</span>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <button onClick={() => finalizePayment(PaymentMethod.CASH)} className="bg-green-600 p-4 rounded-xl font-black uppercase text-sm">Cash</button>
                  <button onClick={() => setPendingCardPayment(true)} className="bg-blue-600 p-4 rounded-xl font-black uppercase text-sm">Card</button>
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'REPORTS' && (
          <div className="p-6 overflow-y-auto h-full">
            <h2 className="text-2xl font-black mb-6 uppercase tracking-tight">Rapporten</h2>
            <div className="space-y-4">
              {sessions.slice().reverse().map(s => (
                <div key={s.id} className="bg-white p-6 rounded-2xl border shadow-sm flex items-center justify-between">
                  <div>
                    <div className="font-black text-lg">{new Date(s.startTime).toLocaleDateString()}</div>
                    <div className="text-xs font-bold text-slate-400 uppercase tracking-widest">{s.status === 'OPEN' ? '🟢 Actief' : '🔴 Gesloten'} | ID: {s.id.slice(-4)}</div>
                  </div>
                  {/* PRINT KNOP BIJ RAPPORTEN */}
                  <button 
                    onClick={() => {
                      const res = s.status === 'OPEN' ? calculateSessionTotals(s.id, s.startCash) : s;
                      setViewingSession({ ...s, summary: res.summary });
                    }} 
                    className="bg-slate-900 text-white px-6 py-3 rounded-xl font-black flex items-center gap-2 hover:bg-amber-500 transition-colors"
                  >
                    <Printer size={18}/> PRINT RAPPORT
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {activeTab === 'SETTINGS' && (
          <div className="p-6 overflow-y-auto h-full space-y-8">
             {/* PRODUCTBEHEER IS HIER OOK AANWEZIG */}
             <div className="bg-white p-6 rounded-3xl border shadow-sm">
                <h3 className="font-black mb-4 text-slate-700 uppercase">Productbeheer</h3>
                <div className="space-y-2">
                  {products.map(p => (
                    <div key={p.id} className="flex gap-2 items-center">
                      <input className="flex-1 p-2 border rounded-lg font-bold" value={p.name} onChange={e => setProducts(products.map(x => x.id === p.id ? {...x, name: e.target.value.toUpperCase()} : x))} />
                      <input type="number" className="w-24 p-2 border rounded-lg font-black text-center" value={p.price} onChange={e => setProducts(products.map(x => x.id === p.id ? {...x, price: parseFloat(e.target.value)} : x))} />
                      <button onClick={() => setProducts(products.filter(x => x.id !== p.id))} className="text-red-500 p-2"><Trash2 size={20}/></button>
                    </div>
                  ))}
                  <button onClick={() => setProducts([...products, { id: Date.now().toString(), name: 'NIEUW', price: 0, vatRate: 21, color: 'bg-slate-200', stock: 0 }])} className="w-full mt-2 bg-amber-500 text-white p-3 rounded-xl font-black uppercase">+ Product Toevoegen</button>
                </div>
             </div>
          </div>
        )}
      </main>

      {/* OVERLAYS */}
      {pendingCardPayment && (
        <div className="fixed inset-0 z-[300] bg-slate-900/95 flex items-center justify-center p-4 backdrop-blur-md">
          <div className="bg-white p-10 rounded-[40px] text-center max-w-sm w-full">
            <CreditCard size={64} className="mx-auto mb-6 text-blue-600" />
            <h2 className="text-4xl font-black mb-10 text-slate-900">€{cart.reduce((a, b) => a + (b.price * b.quantity), 0).toFixed(2)}</h2>
            <button onClick={() => finalizePayment(PaymentMethod.CARD)} className="w-full bg-blue-600 text-white py-5 rounded-2xl font-black text-xl mb-4">BETALING VOLTOOID</button>
            <button onClick={() => setPendingCardPayment(false)} className="text-slate-400 font-bold uppercase text-xs">Annuleren</button>
          </div>
        </div>
      )}

      {(previewTransaction || viewingSession) && (
        <div className="fixed inset-0 z-[200] bg-black/80 flex items-center justify-center p-4">
          <div className="bg-white p-8 rounded-[40px] max-w-sm w-full shadow-2xl overflow-y-auto max-h-[90vh]">
            <Receipt transaction={previewTransaction} sessionSummary={viewingSession} company={company} />
            <button onClick={() => {setPreviewTransaction(null); setViewingSession(null);}} className="w-full mt-6 bg-slate-900 text-white py-4 rounded-2xl font-black uppercase">Sluiten</button>
          </div>
        </div>
      )}
    </div>
  );
}
