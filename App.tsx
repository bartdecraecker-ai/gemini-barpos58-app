import React, { useState, useEffect, useMemo } from 'react';
import { ShoppingBag, Trash2, CreditCard, Banknote, Printer, X } from 'lucide-react';
import { Product, CartItem, Transaction, PaymentMethod, CompanyDetails, SalesSession } from './types';
import { DEFAULT_COMPANY, INITIAL_PRODUCTS } from './constants';
import { Receipt } from './components/Receipt.tsx';

export default function App() {
  const [products, setProducts] = useState<Product[]>(INITIAL_PRODUCTS);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [sessions, setSessions] = useState<SalesSession[]>([]);
  const [activeTab, setActiveTab] = useState<'POS' | 'REPORTS'>('POS');
  const [currentSession, setCurrentSession] = useState<SalesSession | null>(null);
  const [previewTransaction, setPreviewTransaction] = useState<Transaction | null>(null);
  const [pendingCardPayment, setPendingCardPayment] = useState(false);

  // Sla gegevens op in de browser zelf (simpel & robuust)
  useEffect(() => {
    const saved = localStorage.getItem('barpos_last_stable_version');
    if (saved) {
      const data = JSON.parse(saved);
      setTransactions(data.transactions || []);
      setSessions(data.sessions || []);
      const active = data.sessions?.find((s: any) => s.status === 'OPEN');
      if (active) setCurrentSession(active);
    }
  }, []);

  useEffect(() => {
    localStorage.setItem('barpos_last_stable_version', JSON.stringify({ transactions, sessions }));
  }, [transactions, sessions]);

  const cartTotal = useMemo(() => cart.reduce((a, b) => a + (b.price * b.quantity), 0), [cart]);

  const addToCart = (product: Product) => {
    // Start sessie automatisch als die er niet is
    if (!currentSession) {
      const newS = { id: Date.now().toString(), startTime: Date.now(), startCash: 0, status: 'OPEN' as const };
      setSessions([...sessions, newS]);
      setCurrentSession(newS);
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
    <div className="flex flex-col h-screen bg-slate-100 overflow-hidden font-sans text-slate-900">
      
      {/* HEADER */}
      <header className="bg-white border-b p-4 flex justify-between items-center shadow-sm shrink-0">
        <div className="flex items-center gap-2 font-black text-xl tracking-tighter">
          <div className="bg-slate-900 text-white p-1.5 rounded-lg"><ShoppingBag size={20}/></div>
          BAR POS
        </div>
        <nav className="flex gap-2">
          <button onClick={() => setActiveTab('POS')} className={`px-4 py-2 rounded-xl font-bold text-xs ${activeTab === 'POS' ? 'bg-amber-500 text-white' : 'bg-slate-100 text-slate-500'}`}>KASSA</button>
          <button onClick={() => setActiveTab('REPORTS')} className={`px-4 py-2 rounded-xl font-bold text-xs ${activeTab === 'REPORTS' ? 'bg-amber-500 text-white' : 'bg-slate-100 text-slate-500'}`}>HISTORIEK</button>
        </nav>
      </header>

      <main className="flex-1 flex overflow-hidden">
        {activeTab === 'POS' && (
          <>
            {/* PRODUCT GRID */}
            <div className="flex-1 p-4 grid grid-cols-2 sm:grid-cols-4 gap-4 overflow-y-auto content-start">
              {products.map(p => (
                <button key={p.id} onClick={() => addToCart(p)} className={`${p.color} p-6 rounded-[2.5rem] font-black shadow-sm flex flex-col items-center justify-center min-h-[120px] active:scale-95 transition-all border-2 border-black/5 hover:border-black/20`}>
                  <span className="text-[11px] uppercase text-center mb-1">{p.name}</span>
                  <span className="text-xs bg-white/40 px-3 py-0.5 rounded-full">€{p.price.toFixed(2)}</span>
                </button>
              ))}
            </div>

            {/* WINKELMAND */}
            <div className="w-[350px] bg-white border-l flex flex-col shadow-2xl">
              <div className="p-6 border-b font-black text-xs uppercase tracking-widest text-slate-400 text-center">Winkelmand</div>
              <div className="flex-1 overflow-y-auto p-4 space-y-3">
                {cart.length === 0 && <div className="h-full flex items-center justify-center text-slate-300 font-bold uppercase text-[10px] tracking-widest">Leeg</div>}
                {cart.map(item => (
                  <div key={item.id} className="flex justify-between items-center bg-slate-50 p-3 rounded-2xl border border-slate-100">
                    <span className="font-bold text-[10px] uppercase truncate flex-1 pr-2">{item.name}</span>
                    <div className="flex items-center gap-3">
                      <button onClick={() => setCart(cart.map(i => i.id === item.id ? {...i, quantity: i.quantity - 1} : i).filter(i => i.quantity > 0))} className="w-8 h-8 bg-white shadow-sm rounded-lg text-red-500 font-black">-</button>
                      <span className="font-black text-sm">{item.quantity}</span>
                      <button onClick={() => setCart(cart.map(i => i.id === item.id ? {...i, quantity: i.quantity + 1} : i))} className="w-8 h-8 bg-white shadow-sm rounded-lg text-green-500 font-black">+</button>
                    </div>
                  </div>
                ))}
              </div>
              <div className="p-6 bg-slate-900 text-white rounded-t-[3rem]">
                <div className="flex justify-between text-3xl font-black mb-6 italic tracking-tighter">
                  <span className="text-slate-500 text-xs self-center">TOTAAL</span>
                  <span className="text-amber-500">€{cartTotal.toFixed(2)}</span>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <button onClick={() => finalizePayment(PaymentMethod.CASH)} className="bg-green-600 p-5 rounded-2xl font-black flex flex-col items-center gap-1 uppercase text-[10px]"><Banknote size={24}/> Cash</button>
                  <button onClick={() => setPendingCardPayment(true)} className="bg-blue-600 p-5 rounded-2xl font-black flex flex-col items-center gap-1 uppercase text-[10px]"><CreditCard size={24}/> Kaart</button>
                </div>
              </div>
            </div>
          </>
        )}

        {activeTab === 'REPORTS' && (
          <div className="flex-1 p-8 overflow-y-auto space-y-4 max-w-2xl mx-auto">
            <h2 className="font-black text-2xl italic mb-6">Verleden</h2>
            {transactions.map(tx => (
              <div key={tx.id} className="bg-white p-4 rounded-2xl border flex justify-between items-center shadow-sm">
                <div className="text-[10px] font-bold">
                  <span className="text-slate-400 mr-2">{new Date(tx.timestamp).toLocaleTimeString()}</span>
                  <span className="uppercase text-slate-900">{tx.paymentMethod}</span>
                </div>
                <div className="font-black">€{tx.total.toFixed(2)}</div>
                <button onClick={() => setPreviewTransaction(tx)} className="text-amber-500"><Printer size={18}/></button>
              </div>
            ))}
          </div>
        )}
      </main>

      {/* BON POPUP */}
      {previewTransaction && (
        <div className="fixed inset-0 z-[100] bg-black/80 flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-white p-8 rounded-[2.5rem] w-full max-w-sm max-h-[85vh] overflow-y-auto">
            <Receipt transaction={previewTransaction} company={DEFAULT_COMPANY} />
            <button onClick={() => setPreviewTransaction(null)} className="w-full mt-8 bg-slate-900 text-white py-4 rounded-2xl font-black uppercase text-xs">Sluiten</button>
          </div>
        </div>
      )}

      {/* KAART BETALING POPUP */}
      {pendingCardPayment && (
        <div className="fixed inset-0 z-[200] bg-slate-900 flex items-center justify-center p-6 text-white">
          <div className="text-center w-full max-w-xs">
            <CreditCard size={80} className="mx-auto mb-8 text-blue-500 animate-pulse" />
            <h2 className="text-6xl font-black mb-12 italic text-blue-400">€{cartTotal.toFixed(2)}</h2>
            <button onClick={() => finalizePayment(PaymentMethod.CARD)} className="w-full bg-blue-600 py-6 rounded-[2rem] font-black text-2xl shadow-2xl active:scale-95 transition-all uppercase">Betaald</button>
            <button onClick={() => setPendingCardPayment(false)} className="block mx-auto mt-10 text-slate-500 font-bold uppercase text-[10px] underline">Annuleren</button>
          </div>
        </div>
      )}
    </div>
  );
}
