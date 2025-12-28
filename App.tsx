import React, { useState, useEffect, useMemo } from 'react';
import { ShoppingBag, Trash2, CreditCard, Banknote, BarChart3, Settings, Printer, X } from 'lucide-react';
import { Product, CartItem, Transaction, PaymentMethod, CompanyDetails, SalesSession } from './types';
import { DEFAULT_COMPANY, INITIAL_PRODUCTS } from './constants';
import { Receipt } from './components/Receipt.tsx';

export default function App() {
  const [products, setProducts] = useState<Product[]>(INITIAL_PRODUCTS);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [sessions, setSessions] = useState<SalesSession[]>([]);
  const [company, setCompany] = useState<CompanyDetails>(DEFAULT_COMPANY);
  const [activeTab, setActiveTab] = useState<'POS' | 'REPORTS' | 'SETTINGS'>('POS');
  const [currentSession, setCurrentSession] = useState<SalesSession | null>(null);
  const [previewTransaction, setPreviewTransaction] = useState<Transaction | null>(null);
  const [pendingCardPayment, setPendingCardPayment] = useState(false);

  // Simpele opslag
  useEffect(() => {
    const saved = localStorage.getItem('barpos_simple_v1');
    if (saved) {
      const data = JSON.parse(saved);
      setTransactions(data.transactions || []);
      setSessions(data.sessions || []);
      setProducts(data.products || INITIAL_PRODUCTS);
      const active = data.sessions?.find((s: any) => s.status === 'OPEN');
      if (active) setCurrentSession(active);
    }
  }, []);

  useEffect(() => {
    localStorage.setItem('barpos_simple_v1', JSON.stringify({ transactions, sessions, products }));
  }, [transactions, sessions, products]);

  const cartTotal = useMemo(() => cart.reduce((a, b) => a + (b.price * b.quantity), 0), [cart]);

  const addToCart = (product: Product) => {
    if (!currentSession) {
      const start = prompt("Voer startbedrag kassa in:", "0");
      const newSession = { id: Date.now().toString(), startTime: Date.now(), startCash: parseFloat(start || "0"), status: 'OPEN' as const };
      setSessions([...sessions, newSession]);
      setCurrentSession(newSession);
    }
    setCart(prev => {
      const ex = prev.find(i => i.id === product.id);
      if (ex) return prev.map(i => i.id === product.id ? { ...i, quantity: i.quantity + 1 } : i);
      return [...prev, { ...product, quantity: 1 }];
    });
  };

  const finalizePayment = (method: PaymentMethod) => {
    const newTx: Transaction = {
      id: `TR-${Date.now().toString().slice(-4)}`,
      sessionId: currentSession!.id,
      timestamp: Date.now(),
      items: [...cart],
      total: cartTotal,
      paymentMethod: method,
      vat21: cartTotal * 0.21
    };
    setTransactions([newTx, ...transactions]);
    setCart([]);
    setPendingCardPayment(false);
    setPreviewTransaction(newTx);
  };

  return (
    <div className="flex flex-col h-screen bg-slate-50 overflow-hidden font-sans text-slate-900">
      
      {/* HEADER */}
      <header className="bg-white border-b p-4 flex justify-between items-center shadow-sm">
        <div className="flex items-center gap-2 font-black text-xl tracking-tighter">
          <div className="bg-slate-900 text-white p-1.5 rounded-lg"><ShoppingBag size={20}/></div>
          POS
        </div>
        <nav className="flex gap-1 bg-slate-100 p-1 rounded-xl">
          <button onClick={() => setActiveTab('POS')} className={`px-4 py-2 rounded-lg font-bold text-xs ${activeTab === 'POS' ? 'bg-white shadow-sm text-amber-600' : 'text-slate-500'}`}>KASSA</button>
          <button onClick={() => setActiveTab('REPORTS')} className={`px-4 py-2 rounded-lg font-bold text-xs ${activeTab === 'REPORTS' ? 'bg-white shadow-sm text-amber-600' : 'text-slate-500'}`}>RAPPORT</button>
        </nav>
      </header>

      <main className="flex-1 flex overflow-hidden">
        {activeTab === 'POS' && (
          <>
            {/* PRODUCTEN GRID */}
            <div className="flex-1 p-4 grid grid-cols-2 sm:grid-cols-4 gap-4 overflow-y-auto content-start">
              {products.map(p => (
                <button key={p.id} onClick={() => addToCart(p)} className={`${p.color} p-6 rounded-[2.5rem] font-black shadow-sm flex flex-col items-center justify-center min-h-[120px] active:scale-95 transition-all border-2 border-black/5`}>
                  <span className="text-xs uppercase mb-1">{p.name}</span>
                  <span className="text-sm bg-white/50 px-3 py-0.5 rounded-full font-bold">€{p.price.toFixed(2)}</span>
                </button>
              ))}
            </div>

            {/* MANDJE */}
            <div className="w-[350px] bg-white border-l flex flex-col shadow-xl">
              <div className="p-6 border-b font-black text-xs uppercase tracking-widest text-slate-400">Mandje</div>
              <div className="flex-1 overflow-y-auto p-4 space-y-3">
                {cart.map(item => (
                  <div key={item.id} className="flex justify-between items-center bg-slate-50 p-3 rounded-2xl">
                    <span className="font-bold text-xs uppercase">{item.name}</span>
                    <div className="flex items-center gap-3">
                      <button onClick={() => setCart(cart.map(i => i.id === item.id ? {...i, quantity: i.quantity - 1} : i).filter(i => i.quantity > 0))} className="w-8 h-8 bg-white shadow rounded-lg text-red-500 font-bold">-</button>
                      <span className="font-bold">{item.quantity}</span>
                      <button onClick={() => setCart(cart.map(i => i.id === item.id ? {...i, quantity: i.quantity + 1} : i))} className="w-8 h-8 bg-white shadow rounded-lg text-green-500 font-bold">+</button>
                    </div>
                  </div>
                ))}
              </div>
              <div className="p-6 bg-slate-900 text-white rounded-t-[3rem]">
                <div className="flex justify-between text-3xl font-black mb-6 italic"><span className="text-slate-500 text-xs self-center">TOTAAL</span><span className="text-amber-500">€{cartTotal.toFixed(2)}</span></div>
                <div className="grid grid-cols-2 gap-4">
                  <button onClick={() => finalizePayment(PaymentMethod.CASH)} className="bg-green-600 p-5 rounded-2xl font-black flex flex-col items-center gap-1 uppercase text-[10px]"><Banknote size={24}/> Cash</button>
                  <button onClick={() => setPendingCardPayment(true)} className="bg-blue-600 p-5 rounded-2xl font-black flex flex-col items-center gap-1 uppercase text-[10px]"><CreditCard size={24}/> Kaart</button>
                </div>
              </div>
            </div>
          </>
        )}

        {activeTab === 'REPORTS' && (
          <div className="flex-1 p-8 overflow-y-auto space-y-4">
            <h2 className="font-black text-2xl italic mb-6">Rapportage</h2>
            {sessions.map(s => (
              <div key={s.id} className="bg-white p-6 rounded-3xl border flex justify-between items-center shadow-sm">
                <span className="font-black">{new Date(s.startTime).toLocaleDateString()}</span>
                <button onClick={() => {
                  if(window.confirm("Sessie sluiten?")) {
                    setSessions(sessions.map(x => x.id === s.id ? {...x, status: 'CLOSED' as const} : x));
                    setCurrentSession(null);
                  }
                }} className="bg-red-50 text-red-600 px-4 py-2 rounded-xl font-bold text-xs uppercase">{s.status === 'OPEN' ? 'Sluit Kassa' : 'Gesloten'}</button>
              </div>
            ))}
          </div>
        )}
      </main>

      {/* BON MODAL */}
      {previewTransaction && (
        <div className="fixed inset-0 z-[100] bg-black/80 flex items-center justify-center p-4">
          <div className="bg-white p-8 rounded-[3rem] w-full max-w-sm overflow-y-auto">
            <Receipt transaction={previewTransaction} company={company} />
            <button onClick={() => setPreviewTransaction(null)} className="w-full mt-6 bg-slate-900 text-white py-4 rounded-2xl font-black uppercase text-xs">Sluiten</button>
          </div>
        </div>
      )}

      {/* KAART MODAL */}
      {pendingCardPayment && (
        <div className="fixed inset-0 z-[200] bg-slate-900 flex items-center justify-center">
          <div className="text-center text-white">
            <CreditCard size={80} className="mx-auto mb-8 text-blue-500 animate-pulse" />
            <h2 className="text-6xl font-black mb-12 italic text-blue-400">€{cartTotal.toFixed(2)}</h2>
            <button onClick={() => finalizePayment(PaymentMethod.CARD)} className="bg-blue-600 px-12 py-6 rounded-3xl font-black text-2xl">BETAALD</button>
            <button onClick={() => setPendingCardPayment(false)} className="block mx-auto mt-10 text-slate-500 uppercase font-black text-xs underline">Annuleren</button>
          </div>
        </div>
      )}
    </div>
  );
}
