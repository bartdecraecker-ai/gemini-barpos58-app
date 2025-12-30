import React, { useState, useEffect, useMemo } from 'react';
import { 
  ShoppingBag, Trash2, CreditCard, Banknote, BarChart3, Settings, Plus, Minus, X, 
  CheckCircle, PlayCircle, KeyRound, RefreshCcw, Archive, Loader2, Building2, 
  User, Users, ChevronDown, UserPlus, Lock, History, Printer, Bluetooth, 
  Store, MapPin, Beer, Coffee, Wine, GlassWater, Utensils, Delete, ArrowRight, Save,
  ChevronRight, Calendar, UserMinus, Check, AlertCircle, TrendingUp, Package, BluetoothConnected, LogOut
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

  // App Data
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
  const [currentSession, setCurrentSession] = useState<SalesSession | null>(null);
  const [startFloatAmount, setStartFloatAmount] = useState<string>('0');
  const [isClosingSession, setIsClosingSession] = useState(false);
  const [endCashInput, setEndCashInput] = useState('');
  const [showSalesmanSelection, setShowSalesmanSelection] = useState(false);

  // 1. PIN Login
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

  // 2. Data Loading
  useEffect(() => {
    const savedMode = apiService.getActiveMode();
    if (savedMode) setActiveMode(savedMode);
  }, []);

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

  // 3. Sync
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
    const v21 = cart.reduce((acc, i) => i.vatRate === 21 ? acc + ((i.price * i.quantity) - ((i.price * i.quantity) / 1.21)) : acc, 0);
    const v0 = cart.reduce((acc, i) => i.vatRate === 0 ? acc + (i.price * i.quantity) : acc, 0);
    return { total, v21, v0, net: total - v21 };
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
      vat0: totals.v0,
      vat21: totals.v21,
      total: totals.total,
      paymentMethod: method,
      updatedAt: now
    };
    setTransactions([tx, ...transactions]);
    setCart([]);
    setShowSuccess(true);
    setShowCardPrompt(false);
    if (btConnected) btPrinterService.printReceipt(tx, company);
    setTimeout(() => setShowSuccess(false), 2000);
  };

  const closeSession = async () => {
    if (!currentSession) return;
    const endCash = parseFloat(endCashInput) || 0;
    const sessionTx = transactions.filter(t => t.sessionId === currentSession.id);
    const cashSales = sessionTx.filter(t => t.paymentMethod === PaymentMethod.CASH).reduce((a, b) => a + b.total, 0);
    
    const closed: SalesSession = {
      ...currentSession,
      status: 'CLOSED',
      endTime: Date.now(),
      endCash,
      expectedCash: currentSession.startCash + cashSales,
      summary: {
        totalSales: sessionTx.reduce((a, b) => a + b.total, 0),
        transactionCount: sessionTx.length,
        cashTotal: cashSales,
        cardTotal: sessionTx.filter(t => t.paymentMethod === PaymentMethod.CARD).reduce((a, b) => a + b.total, 0),
        vat0Total: sessionTx.reduce((a, b) => a + b.vat0, 0),
        vat21Total: sessionTx.reduce((a, b) => a + b.vat21, 0),
      },
      updatedAt: Date.now()
    };
    setSessions(sessions.map(s => s.id === closed.id ? closed : s));
    setCurrentSession(null);
    setIsClosingSession(false);
    setActiveTab('REPORTS');
  };

  const themeColor = activeMode === 'SHOP' ? 'amber' : 'indigo';

  if (!isAuthenticated) {
    return (
      <div className="fixed inset-0 bg-slate-950 flex flex-col items-center justify-center p-6 text-white z-[1000]">
        <div className={`w-full max-w-xs space-y-10 text-center ${loginError ? 'animate-bounce' : ''}`}>
          <div className="space-y-4">
            <div className="w-16 h-16 bg-slate-900 rounded-3xl flex items-center justify-center mx-auto border border-white/5"><Lock size={28} className="text-amber-500" /></div>
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
                <button key={i} onClick={() => handlePinDigit(digit.toString())} className="w-full aspect-square rounded-2xl bg-slate-900 border border-white/5 text-xl font-black active:bg-amber-500 transition-all">{digit}</button>
              ) : <div key={i} />
            ))}
            <button onClick={() => setPinInput(pinInput.slice(0, -1))} className="w-full aspect-square rounded-2xl bg-slate-900/50 flex items-center justify-center"><Delete size={20} /></button>
          </div>
        </div>
      </div>
    );
  }

  if (!activeMode) {
    return (
      <div className="fixed inset-0 bg-slate-50 flex flex-col items-center justify-center p-6">
        <div className="w-full max-w-sm space-y-8">
          <div className="text-center font-black text-2xl uppercase italic">Selecteer Modus</div>
          <div className="grid gap-4">
            <button onClick={() => { apiService.setActiveMode('SHOP'); setActiveMode('SHOP'); }} className="bg-white p-6 rounded-3xl shadow-lg flex items-center gap-4 border-2 border-transparent active:border-amber-500">
              <Store className="text-amber-500" size={32} /> <div><h3 className="font-black">SHOP MODUS</h3><p className="text-xs text-slate-400">Vaste bar</p></div>
            </button>
            <button onClick={() => { apiService.setActiveMode('TOUR'); setActiveMode('TOUR'); }} className="bg-white p-6 rounded-3xl shadow-lg flex items-center gap-4 border-2 border-transparent active:border-indigo-500">
              <MapPin className="text-indigo-500" size={32} /> <div><h3 className="font-black">TOUR MODUS</h3><p className="text-xs text-slate-400">Verkoop onderweg</p></div>
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 flex flex-col bg-slate-50 overflow-hidden font-sans select-none">
      <nav className="h-20 bg-slate-950 text-white flex items-center justify-around shrink-0 z-50">
        <button onClick={() => setActiveTab('POS')} className={`flex flex-col items-center gap-1 w-24 ${activeTab === 'POS' ? `text-${themeColor}-500` : 'text-slate-400'}`}>
          <ShoppingBag size={20} /><span className="text-[9px] font-black uppercase">Kassa</span>
        </button>
        <button onClick={() => setActiveTab('REPORTS')} className={`flex flex-col items-center gap-1 w-24 ${activeTab === 'REPORTS' ? `text-${themeColor}-500` : 'text-slate-400'}`}>
          <BarChart3 size={20} /><span className="text-[9px] font-black uppercase">Rapport</span>
        </button>
        <button onClick={() => setActiveTab('SETTINGS')} className={`flex flex-col items-center gap-1 w-24 ${activeTab === 'SETTINGS' ? `text-${themeColor}-500` : 'text-slate-400'}`}>
          <Settings size={20} /><span className="text-[9px] font-black uppercase">Beheer</span>
        </button>
      </nav>

      <main className="flex-1 overflow-hidden relative">
        {activeTab === 'POS' && (
          <div className="h-full flex flex-col">
            {!currentSession ? (
              <div className="flex-1 flex items-center justify-center p-4">
                <div className="bg-white p-8 rounded-[3rem] shadow-2xl text-center max-w-sm w-full border">
                  <PlayCircle size={40} className={`mx-auto mb-4 text-${themeColor}-500`} />
                  <h3 className="font-black text-lg mb-4 uppercase">{activeMode} SESSIE STARTEN</h3>
                  <label className="text-[10px] font-bold text-slate-400 uppercase">Wisselgeld in lade (€)</label>
                  <input type="number" value={startFloatAmount} onChange={e=>setStartFloatAmount(e.target.value)} className="w-full bg-slate-50 border-2 p-4 rounded-2xl text-center font-black text-2xl mb-6 outline-none" />
                  <button onClick={() => {
                    const newS = { id: `SES-${Date.now()}`, startTime: Date.now(), startCash: parseFloat(startFloatAmount) || 0, status: 'OPEN' as const, updatedAt: Date.now() };
                    setCurrentSession(newS); setSessions([newS, ...sessions]);
                  }} className="w-full bg-slate-950 text-white py-5 rounded-2xl font-black uppercase">OPEN KASSA</button>
                </div>
              </div>
            ) : (
              <>
                <div className="h-[35%] bg-white border-b flex flex-col shrink-0">
                  <div className="px-4 py-2 bg-slate-50 border-b flex justify-between items-center">
                    <div className="flex gap-2">
                      <div className={`flex items-center gap-1 px-3 py-1 rounded-full border-2 text-[9px] font-black ${activeMode === 'SHOP' ? 'bg-amber-50 border-amber-500' : 'bg-indigo-50 border-indigo-500'}`}>{activeMode}</div>
                      <button onClick={()=>setIsClosingSession(true)} className="flex items-center gap-1 px-3 py-1 rounded-full border-2 border-red-200 text-red-600 text-[9px] font-black bg-white"><LogOut size={10}/> SLUITEN</button>
                    </div>
                    <button onClick={()=>setCart([])} className="p-2 text-slate-300"><Trash2 size={18}/></button>
                  </div>
                  <div className="flex-1 overflow-y-auto p-2">
                    {cart.map(item => (
                      <div key={item.id} className="flex items-center justify-between p-2 bg-slate-50 rounded-xl mb-1 border border-slate-100">
                        <div className="flex-1 truncate font-black text-[10px]">{item.name}</div>
                        <div className="flex items-center gap-2 bg-white px-2 py-1 rounded-full border">
                          <button onClick={()=>setCart(cart.map(x => x.id === item.id ? {...x, quantity: x.quantity - 1} : x).filter(x => x.quantity > 0))}><Minus size={12}/></button>
                          <span className="font-black text-xs">{item.quantity}</span>
                          <button onClick={()=>addToCart(item)}><Plus size={12}/></button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="flex-1 overflow-y-auto p-3">
                  <div className="grid grid-cols-4 gap-2">
                    {products.map(p => (
                      <button key={p.id} onClick={() => addToCart(p)} className={`${p.color || 'bg-white'} p-2 rounded-2xl border border-black/5 shadow-sm active:scale-95 h-20 flex flex-col items-center justify-center`}>
                        <span className="text-[8px] font-black leading-tight text-center">{p.name}</span>
                        <span className="text-[10px] font-black mt-1 italic">€{p.price.toFixed(2)}</span>
                      </button>
                    ))}
                  </div>
                </div>

                <div className="bg-slate-950 text-white p-5 rounded-t-[2.5rem]">
                  <div className="flex justify-between items-center mb-4">
                    <span className="text-slate-500 text-[10px] font-black">TOTAAL</span>
                    <span className={`text-3xl font-black text-${themeColor}-500 italic`}>€{totals.total.toFixed(2)}</span>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <button disabled={cart.length===0} onClick={()=>finalizePayment(PaymentMethod.CASH)} className="bg-emerald-500/20 border border-emerald-500/50 h-12 rounded-xl font-black text-[10px] text-emerald-500 uppercase">CONTANT</button>
                    <button disabled={cart.length===0} onClick={()=>setShowCardPrompt(true)} className="bg-blue-500/20 border border-blue-500/50 h-12 rounded-xl font-black text-[10px] text-blue-500 uppercase">KAART</button>
                  </div>
                </div>
              </>
            )}
          </div>
        )}

        {/* --- PRODUCT MANAGEMENT (MET STOCK & BTW) --- */}
        {activeTab === 'SETTINGS' && (
          <div className="p-4 h-full overflow-y-auto pb-20">
            <h2 className="text-xl font-black mb-4 italic uppercase">Productbeheer ({activeMode})</h2>
            <div className="space-y-3">
              {products.map(p => (
                <div key={p.id} className="bg-white p-4 rounded-2xl border shadow-sm space-y-3">
                  <div className="flex gap-2">
                    <input className="flex-1 font-bold border-b p-1 text-sm outline-none" value={p.name} onChange={e => setProducts(products.map(x => x.id === p.id ? {...x, name: e.target.value} : x))} placeholder="Naam" />
                    <button onClick={() => setProducts(products.filter(x => x.id !== p.id))} className="text-red-400"><Trash2 size={18}/></button>
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    <div>
                      <label className="text-[8px] font-black text-slate-400 uppercase">Prijs (€)</label>
                      <input type="number" className="w-full bg-slate-50 p-2 rounded-lg font-black text-xs" value={p.price} onChange={e => setProducts(products.map(x => x.id === p.id ? {...x, price: parseFloat(e.target.value)} : x))} />
                    </div>
                    <div>
                      <label className="text-[8px] font-black text-slate-400 uppercase">Stock</label>
                      <input type="number" className="w-full bg-slate-50 p-2 rounded-lg font-black text-xs" value={p.stock || 0} onChange={e => setProducts(products.map(x => x.id === p.id ? {...x, stock: parseInt(e.target.value)} : x))} />
                    </div>
                    <div>
                      <label className="text-[8px] font-black text-slate-400 uppercase">BTW %</label>
                      <select className="w-full bg-slate-50 p-2 rounded-lg font-black text-xs" value={p.vatRate} onChange={e => setProducts(products.map(x => x.id === p.id ? {...x, vatRate: parseInt(e.target.value)} : x))}>
                        <option value={21}>21%</option>
                        <option value={0}>0%</option>
                      </select>
                    </div>
                  </div>
                </div>
              ))}
              <button onClick={() => setProducts([...products, { id: Date.now().toString(), name: "Nieuw Product", price: 0, vatRate: 21, color: 'bg-white', stock: 0, updatedAt: Date.now() }])} className="w-full p-4 border-2 border-dashed rounded-2xl text-slate-400 font-bold flex items-center justify-center gap-2"><Plus/> Product Toevoegen</button>
            </div>
          </div>
        )}

        {/* --- REPORTS --- */}
        {activeTab === 'REPORTS' && (
          <div className="p-4 h-full overflow-y-auto pb-20">
            <h2 className="text-xl font-black mb-4 uppercase italic">Sessie Historie</h2>
            <div className="space-y-4">
              {sessions.filter(s => s.status === 'CLOSED').map(s => (
                <div key={s.id} className="bg-white p-4 rounded-2xl border shadow-sm">
                  <div className="flex justify-between items-center mb-2">
                    <span className="font-black text-xs">{new Date(s.startTime).toLocaleDateString()}</span>
                    <span className="bg-slate-100 px-2 py-1 rounded text-[8px] font-black">GESLOTEN</span>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div>Omzet: <span className="font-black">€{s.summary?.totalSales.toFixed(2)}</span></div>
                    <div className="text-right">Cash: <span className="font-black">€{s.summary?.cashTotal.toFixed(2)}</span></div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </main>

      {/* --- POPUPS & OVERLAYS --- */}

      {/* KAART BETALING BEVESTIGING */}
      {showCardPrompt && (
        <div className="fixed inset-0 bg-slate-950/90 backdrop-blur-sm z-[2100] flex items-center justify-center p-6">
          <div className="bg-white p-8 rounded-[3rem] w-full max-w-xs text-center space-y-6">
            <div className="w-16 h-16 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center mx-auto"><CreditCard size={32}/></div>
            <h3 className="font-black text-lg">KAARTBETALING</h3>
            <p className="text-sm text-slate-500 font-medium">Bevestig dat de betaling op de terminal is geslaagd.</p>
            <div className="grid gap-3">
              <button onClick={()=>finalizePayment(PaymentMethod.CARD)} className="bg-blue-600 text-white py-4 rounded-2xl font-black uppercase">JA, GELUKT</button>
              <button onClick={()=>setShowCardPrompt(false)} className="bg-slate-100 text-slate-400 py-4 rounded-2xl font-black uppercase">ANNULEREN</button>
            </div>
          </div>
        </div>
      )}

      {/* SESSIE SLUITEN OVERLAY */}
      {isClosingSession && (
        <div className="fixed inset-0 bg-slate-950/90 backdrop-blur-sm z-[2100] flex items-center justify-center p-6 text-white">
          <div className="w-full max-w-xs space-y-6">
            <h3 className="text-xl font-black text-center uppercase">Sessie Afsluiten</h3>
            <div className="space-y-2">
              <label className="text-[10px] font-black text-slate-500 uppercase block text-center">Totaal cash in lade (€)</label>
              <input type="number" value={endCashInput} onChange={e=>setEndCashInput(e.target.value)} className="w-full bg-slate-900 border-2 border-slate-800 p-5 rounded-2xl text-center font-black text-2xl outline-none" placeholder="0.00" />
            </div>
            <div className="grid gap-3">
              <button onClick={closeSession} className="bg-red-600 text-white py-5 rounded-2xl font-black uppercase">AFSLUITEN & RAPPORT</button>
              <button onClick={()=>setIsClosingSession(false)} className="bg-slate-800 text-slate-400 py-5 rounded-2xl font-black uppercase">TERUG</button>
            </div>
          </div>
        </div>
      )}

      {/* SUCCESS OVERLAY */}
      {showSuccess && (
        <div className="fixed inset-0 bg-emerald-500 flex flex-col items-center justify-center z-[2500]">
           <CheckCircle size={80} className="text-white animate-bounce" />
           <h2 className="text-white font-black text-3xl mt-6 uppercase italic">GELUKT!</h2>
        </div>
      )}
    </div>
  );
}
