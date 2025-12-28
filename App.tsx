import React, { useState, useEffect, useMemo } from 'react';
import { ShoppingBag, Trash2, CreditCard, Banknote, BarChart3, Settings, Printer, X } from 'lucide-react';
import { initializeApp } from "firebase/app";
import { getFirestore, doc, onSnapshot, setDoc, updateDoc, getDoc } from "firebase/firestore";
import { Product, CartItem, Transaction, PaymentMethod, CompanyDetails, SalesSession } from './types';
import { DEFAULT_COMPANY, INITIAL_PRODUCTS } from './constants';
import { Receipt } from './components/Receipt.tsx';

// --- VUL HIER JE FIREBASE CONFIG IN ---
const firebaseConfig = {
  apiKey: "JOUW_API_KEY",
  authDomain: "JOUW_PROJECT.firebaseapp.com",
  projectId: "JOUW_PROJECT",
  storageBucket: "JOUW_PROJECT.appspot.com",
  messagingSenderId: "...",
  appId: "..."
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

export default function App() {
  const [products, setProducts] = useState<Product[]>([]);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [sessions, setSessions] = useState<SalesSession[]>([]);
  const [company, setCompany] = useState<CompanyDetails>(DEFAULT_COMPANY);
  const [activeTab, setActiveTab] = useState<'POS' | 'REPORTS' | 'SETTINGS'>('POS');
  const [currentSession, setCurrentSession] = useState<SalesSession | null>(null);
  const [previewTransaction, setPreviewTransaction] = useState<Transaction | null>(null);
  const [pendingCardPayment, setPendingCardPayment] = useState(false);
  const [loading, setLoading] = useState(true);

  // --- LIVE SYNCHRONISATIE ---
  useEffect(() => {
    const docRef = doc(db, "pos_system", "live_data");

    const unsub = onSnapshot(docRef, (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.data();
        setProducts(data.products || INITIAL_PRODUCTS);
        setTransactions(data.transactions || []);
        setSessions(data.sessions || []);
        setCompany(data.company || DEFAULT_COMPANY);
        
        const active = data.sessions?.find((s: any) => s.status === 'OPEN');
        setCurrentSession(active || null);
      } else {
        // Eerste keer opzetten als database leeg is
        setDoc(docRef, {
          products: INITIAL_PRODUCTS,
          transactions: [],
          sessions: [],
          company: DEFAULT_COMPANY
        });
      }
      setLoading(false);
    });

    return () => unsub();
  }, []);

  const cartTotal = useMemo(() => cart.reduce((a, b) => a + (b.price * b.quantity), 0), [cart]);

  // --- ONLINE OPSLAAN ---
  const updateFirebase = async (updates: any) => {
    const docRef = doc(db, "pos_system", "live_data");
    await updateDoc(docRef, updates);
  };

  const addToCart = (product: Product) => {
    if (!currentSession) {
      alert("Open eerst de kassa via Instellingen of begin een sessie.");
      setActiveTab('SETTINGS');
      return;
    }
    setCart(prev => {
      const ex = prev.find(i => i.id === product.id);
      if (ex) return prev.map(i => i.id === product.id ? { ...i, quantity: i.quantity + 1 } : i);
      return [...prev, { ...product, quantity: 1 }];
    });
  };

  const finalizePayment = async (method: PaymentMethod) => {
    const newTx: Transaction = {
      id: `TR-${Date.now().toString().slice(-4)}`,
      sessionId: currentSession!.id,
      timestamp: Date.now(),
      items: [...cart],
      total: cartTotal,
      paymentMethod: method,
      vat21: cartTotal * 0.21
    };

    const newTransactions = [newTx, ...transactions];
    await updateFirebase({ transactions: newTransactions });
    
    setCart([]);
    setPendingCardPayment(false);
    setPreviewTransaction(newTx);
  };

  if (loading) return <div className="h-screen flex items-center justify-center font-black animate-pulse">VERBINDEN MET DATABASE...</div>;

  return (
    <div className="flex flex-col h-screen bg-slate-50 overflow-hidden font-sans">
      
      {/* HEADER */}
      <header className="bg-slate-900 text-white p-4 flex justify-between items-center shadow-lg">
        <div className="flex items-center gap-2 font-black text-xl text-amber-500">
          <ShoppingBag /> BAR POS ONLINE
        </div>
        <nav className="flex gap-2">
          <button onClick={() => setActiveTab('POS')} className={`px-4 py-2 rounded-xl font-bold text-xs ${activeTab === 'POS' ? 'bg-amber-500' : 'text-slate-400'}`}>KASSA</button>
          <button onClick={() => setActiveTab('REPORTS')} className={`px-4 py-2 rounded-xl font-bold text-xs ${activeTab === 'REPORTS' ? 'bg-amber-500' : 'text-slate-400'}`}>RAPPORT</button>
          <button onClick={() => setActiveTab('SETTINGS')} className={`px-4 py-2 rounded-xl font-bold text-xs ${activeTab === 'SETTINGS' ? 'bg-amber-500' : 'text-slate-400'}`}>INSTELLINGEN</button>
        </nav>
      </header>

      <main className="flex-1 flex overflow-hidden">
        {activeTab === 'POS' && (
          <>
            {/* PRODUCT GRID: 4 OP EEN RIJ */}
            <div className="flex-1 p-4 grid grid-cols-2 sm:grid-cols-4 gap-4 overflow-y-auto content-start">
              {products.map(p => (
                <button key={p.id} onClick={() => addToCart(p)} className={`${p.color} p-6 rounded-[2.5rem] font-black shadow-sm flex flex-col items-center justify-center min-h-[110px] active:scale-95 transition-all`}>
                  <span className="text-[11px] uppercase mb-1">{p.name}</span>
                  <span className="text-xs bg-white/40 px-3 py-0.5 rounded-full">€{p.price.toFixed(2)}</span>
                </button>
              ))}
            </div>

            {/* MANDJE */}
            <div className="w-[350px] bg-white border-l flex flex-col shadow-2xl">
              <div className="p-4 border-b font-black text-xs uppercase text-slate-400 text-center tracking-widest">Winkelmand</div>
              <div className="flex-1 overflow-y-auto p-4 space-y-2">
                {cart.map(item => (
                  <div key={item.id} className="flex justify-between items-center bg-slate-100 p-3 rounded-2xl">
                    <span className="font-black text-[10px] uppercase truncate flex-1">{item.name}</span>
                    <div className="flex items-center gap-2">
                      <button onClick={() => setCart(cart.map(i => i.id === item.id ? {...i, quantity: i.quantity - 1} : i).filter(i => i.quantity > 0))} className="w-8 h-8 bg-white shadow rounded-lg text-red-500 font-bold">-</button>
                      <span className="font-black text-xs">{item.quantity}</span>
                      <button onClick={() => setCart(cart.map(i => i.id === item.id ? {...i, quantity: i.quantity + 1} : i))} className="w-8 h-8 bg-white shadow rounded-lg text-green-500 font-bold">+</button>
                    </div>
                  </div>
                ))}
              </div>
              <div className="p-6 bg-slate-900 text-white">
                <div className="flex justify-between text-2xl font-black mb-6 italic"><span className="text-slate-500 text-xs">TOTAAL</span><span className="text-amber-500">€{cartTotal.toFixed(2)}</span></div>
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
            <div className="bg-slate-900 p-8 rounded-[2rem] text-white">
              {!currentSession ? (
                <button onClick={() => {
                  const s = { id: Date.now().toString(), startTime: Date.now(), startCash: 0, status: 'OPEN' as const };
                  updateFirebase({ sessions: [...sessions, s] });
                }} className="w-full bg-green-600 py-4 rounded-xl font-black uppercase">Open Kassa Voor Iedereen</button>
              ) : (
                <button onClick={() => {
                  if(window.confirm("Sessie sluiten voor alle gebruikers?")) {
                    const updated = sessions.map(s => s.id === currentSession.id ? {...s, status: 'CLOSED' as const} : s);
                    updateFirebase({ sessions: updated });
                  }
                }} className="w-full bg-red-500 py-4 rounded-xl font-black uppercase">Sessie Overal Sluiten</button>
              )}
            </div>
          </div>
        )}
      </main>

      {/* MODALS (Zelfde als stabiele versie) */}
      {previewTransaction && (
        <div className="fixed inset-0 z-[100] bg-black/80 flex items-center justify-center p-4">
          <div className="bg-white p-8 rounded-[2.5rem] w-full max-w-sm">
            <Receipt transaction={previewTransaction} company={company} />
            <button onClick={() => setPreviewTransaction(null)} className="w-full mt-6 bg-slate-900 text-white py-4 rounded-xl font-black text-xs uppercase">Sluiten</button>
          </div>
        </div>
      )}
    </div>
  );
}
