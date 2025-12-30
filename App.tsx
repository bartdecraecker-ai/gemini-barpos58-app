import React, { useState, useEffect, useMemo } from 'react';
import { 
  ShoppingBag, Trash2, CreditCard, Banknote, BarChart3, Settings, Plus, Minus, X, 
  CheckCircle, PlayCircle, KeyRound, RefreshCcw, Archive, Loader2, Building2, 
  User, Users, ChevronDown, UserPlus, Lock, History, Printer, Bluetooth, 
  Store, MapPin, Beer, Coffee, Wine, GlassWater, Utensils, Delete, ArrowRight, Save,
  ChevronRight, Calendar, UserMinus, Check, AlertCircle, TrendingUp, Package, BluetoothConnected
} from 'lucide-react';
import { Product, CartItem, Transaction, PaymentMethod, CompanyDetails, SalesSession, DailySummary } from './types';
import { DEFAULT_COMPANY, INITIAL_PRODUCTS, AVAILABLE_COLORS } from './constants';
import { Receipt } from './components/Receipt';
import { apiService, AppMode } from './services/api';
import { btPrinterService } from './services/bluetoothPrinter';

export default function App() {
  // Authentication & Mode State
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [activeMode, setActiveMode] = useState<AppMode | null>(null);
  const [pinInput, setPinInput] = useState('');
  const [loginError, setLoginError] = useState(false);

  // App Data (Context-specific)
  const [products, setProducts] = useState<Product[]>([]);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [sessions, setSessions] = useState<SalesSession[]>([]);
  const [company, setCompany] = useState<CompanyDetails>(DEFAULT_COMPANY);
  
  // UI State
  const [activeTab, setActiveTab] = useState<'POS' | 'REPORTS' | 'SETTINGS'>('POS');
  const [isInitialLoading, setIsInitialLoading] = useState(false);
  const [btConnected, setBtConnected] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [showCardPrompt, setShowCardPrompt] = useState(false);
  const [previewTransaction, setPreviewTransaction] = useState<Transaction | null>(null);
  const [showSalesmanSelection, setShowSalesmanSelection] = useState(false);
  const [currentSession, setCurrentSession] = useState<SalesSession | null>(null);
  const [startFloatAmount, setStartFloatAmount] = useState<string>('0');
  const [selectedHistorySession, setSelectedHistorySession] = useState<SalesSession | null>(null);

  // 1. PIN Login Handling
  const handlePinDigit = (digit: string) => {
    if (pinInput.length < 4) {
      const newVal = pinInput + digit;
      setPinInput(newVal);
      if (newVal.length === 4) {
        if (newVal === (company.masterPassword || '1984')) {
          setIsAuthenticated(true);
          setPinInput('');
        } else {
          setLoginError(true);
          setTimeout(() => { setLoginError(false); setPinInput(''); }, 500);
        }
      }
    }
  };

  // 2. Initial Mode Fetch
  useEffect(() => {
    const savedMode = apiService.getActiveMode();
    if (savedMode) setActiveMode(savedMode);
  }, []);

  // 3. Contextual Data Loading
  useEffect(() => {
    if (!isAuthenticated || !activeMode) return;
    const loadData = async () => {
      setIsInitialLoading(true);
      const [p, t, c, s] = await Promise.all([
        apiService.getProducts(),
        apiService.getTransactions(),
        apiService.getCompany(),
        apiService.getSessions()
      ]);
      setProducts(p.length > 0 ? p : INITIAL_PRODUCTS);
      setTransactions(t || []);
      setCompany(c || DEFAULT_COMPANY);
      setSessions(s || []);
      setCurrentSession(s?.find(sess => sess.status === 'OPEN') || null);
      setBtConnected(btPrinterService.isConnected());
      setIsInitialLoading(false);
    };
    loadData();
  }, [isAuthenticated, activeMode]);

  // 4. Persistence Sync (Debounced)
  useEffect(() => {
    if (!isAuthenticated || !activeMode || isInitialLoading) return;
    const timer = setTimeout(() => {
      apiService.saveProducts(products);
      apiService.saveTransactions(transactions);
      apiService.saveSessions(sessions);
      apiService.saveCompany(company);
    }, 1000);
    return () => clearTimeout(timer);
  }, [products, transactions, sessions, company]);

  const addToCart = (product: Product) => {
    setCart(prev => {
      const ex = prev.find(i => i.id === product.id);
      return ex ? prev.map(i => i.id === product.id ? { ...i, quantity: i.quantity + 1 } : i) : [...prev, { ...product, quantity: 1 }];
    });
  };

  const totals = useMemo(() => {
    const total = cart.reduce((acc, i) => acc + (i.price * i.quantity), 0);
    const v21 = cart.filter(i => i.vatRate === 21).reduce((acc, i) => acc + ((i.price * i.quantity) - ((i.price * i.quantity) / 1.21)), 0);
    return { total, v21, net: total - v21 };
  }, [cart]);

  const finalizePayment = async (method: PaymentMethod) => {
    if (!currentSession || cart.length === 0) return;
    const now = Date.now();
    const tx: Transaction = {
      id: `TX-${now}`,
      sessionId: currentSession.id,
      timestamp: now,
      dateStr: new Date(now).toLocaleDateString('nl-NL'),
      items: [...cart],
      subtotal: totals.net,
      vat0: 0,
      vat21: totals.v21,
      total: totals.total,
      paymentMethod: method,
      updatedAt: now
    };
    setTransactions([tx, ...transactions]);
    setCart([]);
    setShowSuccess(true);
    if (btConnected) btPrinterService.printReceipt(tx, company);
    setTimeout(() => setShowSuccess(false), 2000);
    setPreviewTransaction(tx);
  };

  const themeColor = activeMode === 'SHOP' ? 'amber' : 'indigo';

  // --- LOGIN SCREEN ---
  if (!isAuthenticated) {
    return (
      <div className="fixed inset-0 bg-slate-950 flex flex-col items-center justify-center p-6 text-white z-[1000]">
        <div className={`w-full max-w-xs space-y-10 text-center ${loginError ? 'animate-bounce' : ''}`}>
          <div className="space-y-4">
            <div className="w-16 h-16 bg-slate-900 rounded-3xl flex items-center justify-center mx-auto border border-white/5">
              <Lock size={28} className="text-amber-500" />
            </div>
            <h1 className="text-xl font-black uppercase italic">BarPOS Login</h1>
          </div>
          <div className="flex justify-center gap-4">
            {[...Array(4)].map((_, i) => (
              <div key={i} className={`w-3.5 h-3.5 rounded-full border-2 transition-all ${pinInput.length > i ? 'bg-amber-500 border-amber-500 scale-125' : 'border-slate-800'}`} />
            ))}
          </div>
          <div className="grid grid-cols-3 gap-3">
            {[1, 2, 3, 4, 5, 6, 7, 8, 9, '', 0].map((digit, i) => (
              digit !== '' ? (
                <button key={i} onClick={() => handlePinDigit(digit.toString())} className="w-full aspect-square rounded-2xl bg-slate-900 border border-white/5 text-xl font-black active:bg-amber-500 active:text-black transition-all">{digit}</button>
              ) : <div key={i} />
            ))}
            <button onClick={() => setPinInput(pinInput.slice(0, -1))} className="w-full aspect-square rounded-2xl bg-slate-900/50 flex items-center justify-center"><Delete size={20} /></button>
          </div>
        </div>
      </div>
    );
  }

  // --- MODE SELECTION ---
  if (!activeMode) {
    return (
      <div className="fixed inset-0 bg-slate-50 flex flex-col items-center justify-center p-6 z-[900]">
        <div className="w-full max-w-sm space-y-8">
          <div className="text-center"><h2 className="text-2xl font-black uppercase italic text-slate-950">Bar Omgeving</h2></div>
          <div className="grid grid-cols-1 gap-4">
            <button onClick={() => { apiService.setActiveMode('SHOP'); setActiveMode('SHOP'); }} className="bg-white p-6 rounded-[2rem] shadow-lg flex items-center gap-6 text-left border-2 border-transparent active:border-amber-500">
              <div className="w-14 h-14 rounded-2xl bg-amber-100 text-amber-600 flex items-center justify-center"><Store size={28} /></div>
              <div><h3 className="text-lg font-black uppercase italic">SHOP MODUS</h3><p className="text-slate-400 text-[9px] font-bold uppercase">Vaste bar</p></div>
            </button>
            <button onClick={() => { apiService.setActiveMode('TOUR'); setActiveMode('TOUR'); }} className="bg-white p-6 rounded-[2rem] shadow-lg flex items-center gap-6 text-left border-2 border-transparent active:border-indigo-500">
              <div className="w-14 h-14 rounded-2xl bg-indigo-100 text-indigo-600 flex items-center justify-center"><MapPin size={28} /></div>
              <div><h3 className="text-lg font-black uppercase italic">TOUR MODUS</h3><p className="text-slate-400 text-[9px] font-bold uppercase">Mobiele verkoop</p></div>
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 flex flex-col bg-slate-50 overflow-hidden font-sans select-none">
      
      {/* Navigation */}
      <nav className="h-20 bg-slate-950 text-white flex items-center justify-around shrink-0 z-50 px-2">
        <button onClick={() => setActiveTab('POS')} className={`flex flex-col items-center gap-1 w-24 ${activeTab === 'POS' ? `text-${themeColor}-500` : 'text-slate-400'}`}>
          <ShoppingBag size={20} /><span className="text-[9px] font-black uppercase tracking-widest">Kassa</span>
        </button>
        <button onClick={() => setActiveTab('REPORTS')} className={`flex flex-col items-center gap-1 w-24 ${activeTab === 'REPORTS' ? `text-${themeColor}-500` : 'text-slate-400'}`}>
          <BarChart3 size={20} /><span className="text-[9px] font-black uppercase tracking-widest">Rapport</span>
        </button>
        <button onClick={() => setActiveTab('SETTINGS')} className={`flex flex-col items-center gap-1 w-24 ${activeTab === 'SETTINGS' ? `text-${themeColor}-500` : 'text-slate-400'}`}>
          <Settings size={20} /><span className="text-[9px] font-black uppercase tracking-widest">Beheer</span>
        </button>
      </nav>

      <main className="flex-1 overflow-hidden relative">
        {activeTab === 'POS' && (
          <div className="h-full flex flex-col">
            {!currentSession ? (
              <div className="flex-1 flex items-center justify-center p-4">
                <div className="bg-white p-8 rounded-[3rem] shadow-2xl text-center max-w-sm w-full border border-slate-200">
                  <div className={`w-14 h-14 bg-${themeColor}-100 text-${themeColor}-600 rounded-2xl flex items-center justify-center mx-auto mb-6`}><PlayCircle size={28} /></div>
                  <h3 className="font-black text-lg mb-6 uppercase italic">{activeMode} SESSIE</h3>
                  <input type="number" value={startFloatAmount} onChange={e=>setStartFloatAmount(e.target.value)} className="w-full bg-slate-50 border-2 p-5 rounded-[1.5rem] text-center font-black text-2xl mb-6 outline-none focus:border-amber-500" />
                  <button onClick={() => {
                    const newS = { id: `SES-${Date.now()}`, startTime: Date.now(), startCash: parseFloat(startFloatAmount) || 0, status: 'OPEN' as const, updatedAt: Date.now() };
                    setCurrentSession(newS); setSessions([newS, ...sessions]);
                  }} className="w-full bg-slate-950 text-white py-5 rounded-[1.5rem] font-black uppercase">STARTEN</button>
                </div>
              </div>
            ) : (
              <>
                {/* CART SECTION */}
                <div className="h-[35%] bg-white border-b flex flex-col shrink-0 overflow-hidden">
                  <div className="px-4 py-2 bg-slate-50 border-b flex justify-between items-center">
                    <div className="flex gap-2">
                      {/* MODUS BADGE */}
                      <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full border-2 font-black text-[9px] uppercase ${activeMode === 'SHOP' ? 'bg-amber-50 border-amber-500 text-amber-700' : 'bg-indigo-50 border-indigo-500 text-indigo-700'}`}>
                        {activeMode === 'SHOP' ? <Store size={12}/> : <MapPin size={12}/>} {activeMode}
                      </div>
                      <button onClick={() => setShowSalesmanSelection(true)} className="flex items-center gap-2 px-4 py-1.5 rounded-full border-2 bg-white text-[9px] font-black uppercase text-slate-900 border-slate-300">
                        <User size={12}/> {company.sellerName || "Verkoper"}
                      </button>
                    </div>
                    <button onClick={()=>setCart([])} className="p-2 text-slate-300"><Trash2 size={18}/></button>
                  </div>
                  <div className="flex-1 overflow-y-auto p-2 space-y-1.5">
                    {cart.map(item => (
                      <div key={item.id} className="flex items-center justify-between p-2.5 bg-slate-50 rounded-[1rem] border border-slate-100">
                        <div className="flex-1 min-w-0 pr-3"><div className="font-black text-[10px] truncate text-slate-800">{item.name}</div></div>
                        <div className="flex items-center gap-2 bg-white p-0.5 rounded-full border border-slate-200">
                          <button onClick={()=>setCart(cart.map(x => x.id === item.id ? {...x, quantity: x.quantity - 1} : x).filter(x => x.quantity > 0))} className="w-7 h-7 flex items-center justify-center text-slate-400"><Minus size={12}/></button>
                          <span className="font-black text-[10px] w-3 text-center italic">{item.quantity}</span>
                          <button onClick={()=>addToCart(item)} className="w-7 h-7 flex items-center justify-center text-slate-400"><Plus size={12}/></button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* PRODUCT GRID - 4 COLUMNS - NO UPPERCASE */}
                <div className="flex-1 overflow-y-auto p-3 bg-slate-100/30">
                  <div className="grid grid-cols-4 gap-2 pb-6">
                    {products.map(p => (
                      <button key={p.id} onClick={() => addToCart(p)} className={`${p.color || 'bg-white'} p-2 rounded-[1rem] border border-black/5 shadow-sm active:scale-95 flex flex-col items-center justify-center text-center h-20 overflow-hidden`}>
                        <span className="text-[8px] font-black leading-tight mb-1 line-clamp-2 tracking-tighter text-slate-900">{p.name}</span>
                        <span className="text-slate-950 bg-white/80 px-1.5 py-0.5 rounded-full text-[7px] font-black italic shadow-sm">€{p.price.toFixed(2)}</span>
                      </button>
                    ))}
                  </div>
                </div>

                {/* PAYMENT SECTION */}
                <div className="bg-slate-950 text-white p-5 space-y-4 rounded-t-[2.5rem] shadow-2xl">
                  <div className="flex justify-between items-center px-1">
                    <span className="text-slate-500 text-[9px] font-black uppercase">Totaal</span>
                    <span className={`text-3xl font-black italic text-${themeColor}-500`}>€{totals.total.toFixed(2)}</span>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <button disabled={cart.length===0} onClick={()=>finalizePayment(PaymentMethod.CASH)} className="bg-emerald-500/10 h-12 rounded-[1.2rem] flex items-center justify-center gap-2 font-black text-[9px] uppercase border border-emerald-500/30 text-emerald-50">CONTANT</button>
                    <button disabled={cart.length===0} onClick={()=>finalizePayment(PaymentMethod.CARD)} className="bg-blue-500/10 h-12 rounded-[1.2rem] flex items-center justify-center gap-2 font-black text-[9px] uppercase border border-blue-500/30 text-blue-50">KAART</button>
                  </div>
                </div>
              </>
            )}
          </div>
        )}

        {/* ... (REPORTS & SETTINGS TABS follow same pattern, removed for brevity but essential to keep your versions) ... */}
        {activeTab === 'SETTINGS' && (
          <div className="p-6 space-y-6 overflow-y-auto h-full pb-20">
             <h2 className="text-2xl font-black uppercase italic">Producten Beheren</h2>
             <div className="grid grid-cols-1 gap-2">
                {products.map(p => (
                  <div key={p.id} className="flex gap-2 bg-white p-3 rounded-2xl border items-center">
                    <input className="flex-1 font-bold text-sm bg-transparent outline-none" value={p.name} onChange={e => setProducts(products.map(x => x.id === p.id ? {...x, name: e.target.value} : x))} />
                    <input type="number" className="w-16 font-black text-sm bg-slate-50 p-2 rounded-lg" value={p.price} onChange={e => setProducts(products.map(x => x.id === p.id ? {...x, price: parseFloat(e.target.value)} : x))} />
                    <button onClick={() => setProducts(products.filter(x => x.id !== p.id))} className="text-red-500"><X size={20}/></button>
                  </div>
                ))}
                <button onClick={() => setProducts([...products, { id: Date.now().toString(), name: "Nieuw Product", price: 0, vatRate: 21, color: 'bg-white', updatedAt: Date.now() }])} className="p-4 border-2 border-dashed rounded-2xl flex items-center justify-center gap-2 font-bold text-slate-400"><Plus/> Product Toevoegen</button>
             </div>
          </div>
        )}
      </main>

      {/* SUCCESS OVERLAY */}
      {showSuccess && (
        <div className="fixed inset-0 bg-emerald-500/90 flex flex-col items-center justify-center z-[2000] animate-in fade-in duration-300">
           <div className="bg-white text-emerald-600 p-8 rounded-[3rem] shadow-2xl scale-125 animate-in zoom-in-50">
              <CheckCircle size={64} />
           </div>
           <h2 className="text-white font-black text-2xl mt-12 uppercase italic tracking-widest">BETAALD!</h2>
        </div>
      )}
    </div>
  );
}
