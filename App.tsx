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
  const [company, setCompany] = useState<CompanyDetails>({...DEFAULT_COMPANY, addressLine2: ''});
  const [activeTab, setActiveTab] = useState<'POS' | 'REPORTS' | 'SETTINGS'>('POS');
  const [currentSession, setCurrentSession] = useState<SalesSession | null>(null);
  const [previewTransaction, setPreviewTransaction] = useState<Transaction | null>(null);
  const [pendingCardPayment, setPendingCardPayment] = useState(false);
  const [startFloatAmount, setStartFloatAmount] = useState<string>('0');

  // Load & Save
  useEffect(() => {
    const data = localStorage.getItem('barpos_save');
    if (data) {
      const p = JSON.parse(data);
      setTransactions(p.transactions || []);
      setSessions(p.sessions || []);
      setProducts(p.products || INITIAL_PRODUCTS);
      setCompany(p.company || DEFAULT_COMPANY);
      const active = (p.sessions || []).find((s: any) => s.status === 'OPEN');
      if (active) setCurrentSession(active);
    }
  }, []);

  useEffect(() => {
    localStorage.setItem('barpos_save', JSON.stringify({ transactions, sessions, products, company }));
  }, [transactions, sessions, products, company]);

  const cartTotal = useMemo(() => cart.reduce((a, b) => a + (b.price * b.quantity), 0), [cart]);

  const addToCart = (product: Product) => {
    if (!currentSession) { alert("Open de kassa in Instellingen"); setActiveTab('SETTINGS'); return; }
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
    <div className="flex flex-col h-screen bg-slate-100 overflow-hidden font-sans">
      
      {/* MENU TOP */}
      <header className="bg-slate-900 text-white p-4 flex justify-between items-center shadow-md">
        <div className="flex items-center gap-2 font-black tracking-tighter text-xl text-amber-500">
          <ShoppingBag /> BAR POS
        </div>
        <nav className="flex gap-2">
          <button onClick={() => setActiveTab('POS')} className={`px-4 py-2 rounded-xl font-bold text-xs ${activeTab === 'POS' ? 'bg-amber-500' : 'hover:bg-slate-800'}`}>KASSA</button>
          <button onClick={() => setActiveTab('REPORTS')} className={`px-4 py-2 rounded-xl font-bold text-xs ${activeTab === 'REPORTS' ? 'bg-amber-500' : 'hover:bg-slate-800'}`}>RAPPORT</button>
          <button onClick={() => setActiveTab('SETTINGS')} className={`px-4 py-2 rounded-xl font-bold text-xs ${activeTab === 'SETTINGS' ? 'bg-amber-500' : 'hover:bg-slate-800'}`}>
            INSTELLINGEN {currentSession && <span className="ml-1 text-green-400">● Open</span>}
          </button>
        </nav>
      </header>

      <main className="flex-1 flex flex-col md:flex-row overflow-hidden">
        {activeTab === 'POS' && (
          <>
            <div className="flex-1 p-4 grid grid-cols-2 sm:grid-cols-4 gap-3 overflow-y-auto content-start">
              {products.map(p => (
                <button key={p.id} onClick={() => addToCart(p)} className={`${p.color} p-6 rounded-[2rem] font-black shadow-sm flex flex-col items-center justify-center min-h-[110px] active:scale-95 transition-all border-b-4 border-black/10`}>
                  <span className="text-[11px] uppercase text-center mb-1">{p.name}</span>
                  <span className="text-xs bg-white/40 px-3 py-0.5 rounded-full">€{p.price.toFixed(2)}</span>
                </button>
              ))}
            </div>

            <div className="w-full md:w-[380px] bg-white border-l flex flex-col shadow-2xl">
              <div className="p-4 bg-slate-50 border-b font-black text-xs uppercase text-slate-400 tracking-widest text-center">Winkelmand</div>
              <div className="flex-1 overflow-y-auto p-4 space-y-2">
                {cart.map(item => (
                  <div key={item.id} className="flex justify-between items-center p-3 bg-slate-100 rounded-2xl">
                    <span className="font-black text-[10px] uppercase truncate flex-1">{item.name}</span>
                    <div className="flex items-center gap-3">
                      <button onClick={() => setCart(cart.map(i => i.id === item.id ? {...i, quantity: i.quantity - 1} : i).filter(i => i.quantity > 0))} className="w-8 h-8 bg-white shadow rounded-lg text-red-500 font-bold">-</button>
                      <span className="font-black text-xs">{item.quantity}</span>
                      <button onClick={() => setCart(cart.map(i => i.id === item.id ? {...i, quantity: i.quantity + 1} : i))} className="w-8 h-8 bg-white shadow rounded-lg text-green-500 font-bold">+</button>
                    </div>
                  </div>
                ))}
              </div>
              <div className="p-6 bg-slate-900 text-white">
                <div className="flex justify-between text-3xl font-black mb-6 italic"><span className="text-slate-500 text-xs self-center">TOTAAL</span><span className="text-amber-500">€{cartTotal.toFixed(2)}</span></div>
                <div className="grid grid-cols-2 gap-4">
                  <button onClick={() => finalizePayment(PaymentMethod.CASH)} className="bg-green-600 p-5 rounded-2xl font-black flex flex-col items-center gap-1 uppercase text-[10px]"><Banknote size={24}/> Cash</button>
                  <button onClick={() => setPendingCardPayment(true)} className="bg-blue-600 p-5 rounded-2xl font-black flex flex-col items-center gap-1 uppercase text-[10px]"><CreditCard size={24}/> Kaart</button>
                </div>
              </div>
            </div>
          </>
        )}

        {activeTab === 'SETTINGS' && (
          <div className="flex-1 p-8 overflow-y-auto max-w-2xl mx-auto space-y-8">
            <section className="bg-white p-6 rounded-[2rem] shadow-sm border space-y-4">
              <h3 className="font-black text-xs text-slate-400 uppercase tracking-widest">Bedrijfsgegevens</h3>
              <input className="w-full p-4 bg-slate-50 rounded-xl font-bold" placeholder="Naam Zaak" value={company.name} onChange={e => setCompany({...company, name: e.target.value})} />
              <input className="w-full p-4 bg-slate-50 rounded-xl font-bold" placeholder="Adres Regel 1" value={company.address} onChange={e => setCompany({...company, address: e.target.value})} />
              <input className="w-full p-4 bg-slate-50 rounded-xl font-bold" placeholder="Adres Regel 2" value={company.addressLine2} onChange={e => setCompany({...company, addressLine2: e.target.value})} />
            </section>

            <section className="bg-slate-900 p-8 rounded-[2rem] text-white">
              {!currentSession ? (
                <div className="space-y-4">
                  <p className="text-center font-black text-xs uppercase text-slate-500">Kassa is gesloten</p>
                  <input type="number" value={startFloatAmount} onChange={e => setStartFloatAmount(e.target.value)} className="w-full p-4 bg-white/10 rounded-xl text-center text-2xl font-black outline-none" placeholder="0.00" />
                  <button onClick={() => {
                    const s = { id: Date.now().toString(), startTime: Date.now(), startCash: parseFloat(startFloatAmount) || 0, status: 'OPEN' as const };
                    setSessions([...sessions, s]); setCurrentSession(s); setActiveTab('POS');
                  }} className="w-full bg-green-600 py-4 rounded-xl font-black uppercase">Open Kassa</button>
                </div>
              ) : (
                <button onClick={() => { if(window.confirm("Kassa afsluiten?")) { setSessions(sessions.map(s => s.id === currentSession.id ? {...s, status: 'CLOSED' as const, endTime: Date.now()} : s)); setCurrentSession(null); } }} className="w-full bg-red-500 py-4 rounded-xl font-black uppercase">Sessie Sluiten</button>
              )}
            </section>
          </div>
        )}
      </main>

      {previewTransaction && (
        <div className="fixed inset-0 z-[100] bg-black/80 flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-white p-8 rounded-[2.5rem] w-full max-w-sm max-h-[85vh] overflow-y-auto">
            <Receipt transaction={previewTransaction} company={company} />
            <div className="mt-8 flex flex-col gap-2">
              <button onClick={() => window.print()} className="bg-slate-900 text-white py-4 rounded-xl font-black uppercase flex items-center justify-center gap-2"><Printer size={18}/> PRINTEN</button>
              <button onClick={() => setPreviewTransaction(null)} className="bg-slate-100 text-slate-400 py-4 rounded-xl font-black uppercase text-[10px]">SLUITEN</button>
            </div>
          </div>
        </div>
      )}

      {pendingCardPayment && (
        <div className="fixed inset-0 z-[200] bg-slate-900/95 flex items-center justify-center p-4">
          <div className="text-center text-white">
            <CreditCard size={64} className="mx-auto mb-6 text-blue-500 animate-pulse" />
            <h2 className="text-5xl font-black mb-10">€{cartTotal.toFixed(2)}</h2>
            <button onClick={() => finalizePayment(PaymentMethod.CARD)} className="bg-blue-600 px-12 py-5 rounded-2xl font-black text-xl">BETAALD</button>
            <button onClick={() => setPendingCardPayment(false)} className="block mx-auto mt-8 text-slate-500 uppercase font-black text-[10px] underline">Annuleren</button>
          </div>
        </div>
      )}
    </div>
  );
}
