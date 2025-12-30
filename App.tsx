
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
  const [isSyncing, setIsSyncing] = useState(false);
  const [btConnected, setBtConnected] = useState(false);
  const [isConnectingPrinter, setIsConnectingPrinter] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [showCardPrompt, setShowCardPrompt] = useState(false);
  const [previewTransaction, setPreviewTransaction] = useState<Transaction | null>(null);
  const [showSalesmanSelection, setShowSalesmanSelection] = useState(false);
  const [currentSession, setCurrentSession] = useState<SalesSession | null>(null);
  const [startFloatAmount, setStartFloatAmount] = useState<string>('0');
  const [selectedHistorySession, setSelectedHistorySession] = useState<SalesSession | null>(null);
  const [newSalesmanName, setNewSalesmanName] = useState('');
  
  // Session Closing State
  const [isClosingSession, setIsClosingSession] = useState(false);
  const [endCashInput, setEndCashInput] = useState('');

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
          setTimeout(() => { 
            setLoginError(false); 
            setPinInput(''); 
          }, 500);
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

    const loadContextData = async () => {
      setIsInitialLoading(true);
      try {
        const [p, t, c, s] = await Promise.all([
          apiService.getProducts(),
          apiService.getTransactions(),
          apiService.getCompany(),
          apiService.getSessions()
        ]);

        setProducts(p.length > 0 ? p.slice(0, 10) : INITIAL_PRODUCTS.slice(0, 10));
        setTransactions(t || []);
        setCompany(c || { ...DEFAULT_COMPANY, updatedAt: Date.now() });
        setSessions(s || []);

        const openS = s?.find(sess => sess.status === 'OPEN');
        setCurrentSession(openS || null);
        setBtConnected(btPrinterService.isConnected());
      } catch (err) {
        console.error("Data load failed", err);
      } finally {
        setIsInitialLoading(false);
      }
    };

    loadContextData();
  }, [isAuthenticated, activeMode]);

  // 4. Persistence Sync
  useEffect(() => {
    if (!isAuthenticated || !activeMode || isInitialLoading) return;
    
    const triggerSync = async () => {
      setIsSyncing(true);
      await Promise.all([
        apiService.saveProducts(products),
        apiService.saveTransactions(transactions),
        apiService.saveSessions(sessions),
        apiService.saveCompany(company)
      ]);
      setIsSyncing(false);
    };

    const timer = setTimeout(triggerSync, 1000);
    return () => clearTimeout(timer);
  }, [products, transactions, sessions, company, isAuthenticated, activeMode, isInitialLoading]);

  const handleModeSelect = (mode: AppMode) => {
    apiService.setActiveMode(mode);
    setActiveMode(mode);
  };

  // --- Printer Logic ---
  const handleConnectPrinter = async () => {
    setIsConnectingPrinter(true);
    try {
      const success = await btPrinterService.connect();
      setBtConnected(success);
      if (success) {
        await btPrinterService.testPrint();
      }
    } catch (err: any) {
      alert("Printer koppelen mislukt: " + err.message);
    } finally {
      setIsConnectingPrinter(false);
    }
  };

  const handleDisconnectPrinter = () => {
    btPrinterService.disconnect();
    setBtConnected(false);
  };

  // --- POS & Session Logic ---

  const addToCart = (product: Product) => {
    setCart(prev => {
      const ex = prev.find(i => i.id === product.id);
      return ex ? prev.map(i => i.id === product.id ? { ...i, quantity: i.quantity + 1 } : i) : [...prev, { ...product, quantity: 1 }];
    });
  };

  const totals = useMemo(() => {
    let total = 0, v0 = 0, v21 = 0;
    cart.forEach(i => {
      const line = i.price * i.quantity;
      total += line;
      if (i.vatRate === 21) v21 += (line - (line / 1.21));
      else v0 += line;
    });
    return { total, v0, v21, net: total - v21 };
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
    setTransactions(prev => [tx, ...prev]);
    setCart([]);
    setShowSuccess(true);
    setShowCardPrompt(false);
    if (btConnected) btPrinterService.printReceipt(tx, company);
    setTimeout(() => setShowSuccess(false), 2000);
    setPreviewTransaction(tx);
  };

  const closeSession = async (endCashAmount: number) => {
    if (!currentSession) return;
    
    const sessionTx = transactions.filter(t => t.sessionId === currentSession.id);
    const cashSales = sessionTx.filter(t => t.paymentMethod === PaymentMethod.CASH).reduce((sum, t) => sum + t.total, 0);
    const cardSales = sessionTx.filter(t => t.paymentMethod === PaymentMethod.CARD).reduce((sum, t) => sum + t.total, 0);

    const summary: DailySummary = {
      totalSales: sessionTx.reduce((a, b) => a + b.total, 0),
      transactionCount: sessionTx.length,
      cashTotal: cashSales,
      cardTotal: cardSales,
      vat0Total: sessionTx.reduce((a, b) => a + b.vat0, 0),
      vat21Total: sessionTx.reduce((a, b) => a + b.vat21, 0),
      firstTicketId: sessionTx.length > 0 ? sessionTx[sessionTx.length - 1].id : undefined,
      lastTicketId: sessionTx.length > 0 ? sessionTx[0].id : undefined,
    };

    const expectedCash = currentSession.startCash + cashSales;

    const closedSession: SalesSession = {
      ...currentSession,
      status: 'CLOSED',
      endTime: Date.now(),
      endCash: endCashAmount,
      expectedCash: expectedCash,
      summary,
      updatedAt: Date.now(),
    };

    setSessions(prev => [closedSession, ...prev.filter(s => s.id !== currentSession.id)]);
    
    if (btConnected) {
      try {
        await btPrinterService.printSessionReport(closedSession, sessionTx, company);
      } catch (err) {
        console.error("Print report failed", err);
      }
    }

    setCurrentSession(null);
    setIsClosingSession(false);
    setEndCashInput('');
    setActiveTab('REPORTS');
    setSelectedHistorySession(closedSession); 
  };

  // --- Product Management Logic ---

  const updateProduct = (id: string, field: keyof Product, value: any) => {
    setProducts(prev => prev.map(p => p.id === id ? { ...p, [field]: value, updatedAt: Date.now() } : p));
  };

  const deleteProduct = (id: string) => {
    if (window.confirm("Dit product definitief verwijderen?")) {
      setProducts(prev => prev.filter(p => p.id !== id));
    }
  };

  const addProduct = () => {
    if (products.length >= 10) return alert("Maximaal 10 producten.");
    const prefix = activeMode === 'TOUR' ? 'T' : 'S';
    const newP: Product = { 
      id: `${prefix}${Date.now()}`, 
      name: "NIEUW PRODUCT", 
      price: 0, 
      vatRate: 21, 
      color: AVAILABLE_COLORS[0], 
      stock: 0, 
      updatedAt: Date.now() 
    };
    setProducts(prev => [...prev, newP]);
  };

  // --- Salesman Management Logic ---

  const addSalesman = () => {
    const name = newSalesmanName.trim();
    if (!name) return;
    const currentSalesmen = company.salesmen || [];
    if (currentSalesmen.includes(name)) return alert("Deze verkoper bestaat al.");
    
    setCompany(prev => ({
      ...prev,
      salesmen: [...(prev.salesmen || []), name],
      updatedAt: Date.now()
    }));
    setNewSalesmanName('');
  };

  const removeSalesman = (nameToRemove: string) => {
    if (!nameToRemove) return;
    
    if (window.confirm(`Verkoper "${nameToRemove}" definitief verwijderen?`)) {
      setCompany(prev => {
        const currentSalesmen = prev.salesmen || [];
        const updatedSalesmen = currentSalesmen.filter(n => n !== nameToRemove);
        
        // Reset sellerName if the deleted person was selected
        const updatedSelected = prev.sellerName === nameToRemove 
          ? (updatedSalesmen.length > 0 ? updatedSalesmen[0] : '') 
          : prev.sellerName;
        
        return {
          ...prev,
          salesmen: updatedSalesmen,
          sellerName: updatedSelected,
          updatedAt: Date.now()
        };
      });
    }
  };

  const getSessionProductBreakdown = (sessionId: string) => {
    const sessionTx = transactions.filter(t => t.sessionId === sessionId);
    const breakdown: Record<string, { name: string, qty: number, total: number }> = {};
    sessionTx.forEach(tx => {
      tx.items.forEach(item => {
        if (!breakdown[item.name]) {
          breakdown[item.name] = { name: item.name, qty: 0, total: 0 };
        }
        breakdown[item.name].qty += item.quantity;
        breakdown[item.name].total += item.price * item.quantity;
      });
    });
    return Object.values(breakdown).sort((a, b) => b.qty - a.qty);
  };

  const themeColor = activeMode === 'SHOP' ? 'amber' : 'indigo';

  if (!isAuthenticated) {
    return (
      <div className="fixed inset-0 bg-slate-950 flex flex-col items-center justify-center p-6 text-white z-[1000] font-sans overflow-hidden">
        <div className={`w-full max-sm space-y-10 text-center animate-in zoom-in-95 ${loginError ? 'animate-shake' : ''}`}>
          <div className="space-y-4">
             <div className="w-16 h-16 bg-slate-900 rounded-[1.5rem] flex items-center justify-center mx-auto shadow-2xl border border-white/5">
                <Lock size={28} className="text-amber-500" />
             </div>
             <h1 className="text-xl font-black uppercase tracking-widest italic">BarPOS Login</h1>
             <p className="text-slate-500 text-[9px] font-black uppercase tracking-[0.3em]">Code invoeren</p>
          </div>
          <div className="flex justify-center gap-4">
            {[...Array(4)].map((_, i) => (
              <div key={i} className={`w-3.5 h-3.5 rounded-full border-2 transition-all duration-300 ${pinInput.length > i ? 'bg-amber-500 border-amber-500 scale-125 shadow-[0_0_10px_rgba(245,158,11,0.5)]' : 'border-slate-800'}`} />
            ))}
          </div>
          <div className="grid grid-cols-3 gap-3">
            {[1, 2, 3, 4, 5, 6, 7, 8, 9, '', 0].map((digit, i) => (
              digit !== '' ? (
                <button key={i} onClick={() => handlePinDigit(digit.toString())} className="w-full aspect-square rounded-[1rem] bg-slate-900 border border-white/5 text-xl font-black active:bg-amber-500 active:text-black active:scale-90 transition-all shadow-lg flex items-center justify-center">{digit}</button>
              ) : <div key={i} />
            ))}
            <button onClick={() => setPinInput(pinInput.slice(0, -1))} className="w-full aspect-square rounded-[1rem] bg-slate-900/50 border border-white/5 text-slate-500 flex items-center justify-center active:scale-90 transition-all"><Delete size={20} /></button>
          </div>
        </div>
      </div>
    );
  }

  if (!activeMode) {
    return (
      <div className="fixed inset-0 bg-slate-50 flex flex-col items-center justify-center p-6 z-[900] font-sans">
        <div className="w-full max-w-sm space-y-8 animate-in zoom-in-95">
          <div className="text-center space-y-2">
            <h2 className="text-2xl font-black uppercase italic tracking-tighter text-slate-950">Bar Omgeving</h2>
            <p className="text-slate-400 font-bold uppercase text-[9px] tracking-widest">Kies een kassa-modus voor deze sessie</p>
          </div>
          <div className="grid grid-cols-1 gap-4">
            <button onClick={() => handleModeSelect('SHOP')} className="bg-white p-6 rounded-[2rem] shadow-lg border-2 border-transparent hover:border-amber-500 active:scale-95 transition-all flex items-center gap-6 text-left group">
              <div className="w-14 h-14 rounded-2xl bg-amber-100 text-amber-600 flex items-center justify-center shrink-0 shadow-inner group-hover:scale-110 transition-transform"><Store size={28} /></div>
              <div className="flex-1">
                <h3 className="text-lg font-black uppercase italic tracking-tighter">SHOP MODUS</h3>
                <p className="text-slate-400 text-[9px] font-bold uppercase tracking-widest">Vaste bar & catering</p>
              </div>
              <ArrowRight size={20} className="text-slate-200" />
            </button>
            <button onClick={() => handleModeSelect('TOUR')} className="bg-white p-6 rounded-[2rem] shadow-lg border-2 border-transparent hover:border-indigo-500 active:scale-95 transition-all flex items-center gap-6 text-left group">
              <div className="w-14 h-14 rounded-2xl bg-indigo-100 text-indigo-600 flex items-center justify-center shrink-0 shadow-inner group-hover:scale-110 transition-transform"><MapPin size={28} /></div>
              <div className="flex-1">
                <h3 className="text-lg font-black uppercase italic tracking-tighter">TOUR MODUS</h3>
                <p className="text-slate-400 text-[9px] font-bold uppercase tracking-widest">Mobiele verkoop & Merchandising</p>
              </div>
              <ArrowRight size={20} className="text-slate-200" />
            </button>
          </div>
          <button onClick={() => setIsAuthenticated(false)} className="w-full py-4 text-slate-400 font-black uppercase text-[9px] tracking-[0.4em] hover:text-slate-950 transition-colors text-center">Uitloggen</button>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 flex flex-col bg-slate-50 overflow-hidden font-sans select-none">
      
      {/* Tab Navigation */}
      <nav className="h-20 bg-slate-950 text-white flex items-center justify-around shrink-0 z-50 px-2 border-b border-white/5 shadow-2xl">
        <button onClick={() => setActiveTab('POS')} className={`flex flex-col items-center justify-center w-24 h-full transition-all gap-1 ${activeTab === 'POS' ? `text-${themeColor}-500` : 'text-slate-400'}`}>
          <ShoppingBag size={20} />
          <span className="text-[9px] font-black uppercase tracking-[0.2em]">Kassa</span>
        </button>
        <button onClick={() => setActiveTab('REPORTS')} className={`flex flex-col items-center justify-center w-24 h-full transition-all gap-1 ${activeTab === 'REPORTS' ? `text-${themeColor}-500` : 'text-slate-400'}`}>
          <BarChart3 size={20} />
          <span className="text-[9px] font-black uppercase tracking-[0.2em]">Rapport</span>
        </button>
        <button onClick={() => setActiveTab('SETTINGS')} className={`flex flex-col items-center justify-center w-24 h-full transition-all gap-1 ${activeTab === 'SETTINGS' ? `text-${themeColor}-500` : 'text-slate-400'}`}>
          <Settings size={20} />
          <span className="text-[9px] font-black uppercase tracking-[0.2em]">Instellen</span>
        </button>
      </nav>

      <main className="flex-1 overflow-hidden flex flex-col relative">
        {isInitialLoading && (
          <div className="absolute inset-0 bg-slate-50/80 backdrop-blur-sm z-[200] flex flex-col items-center justify-center gap-4">
             <Loader2 size={32} className={`animate-spin text-${themeColor}-500`} />
             <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Data Laden...</span>
          </div>
        )}

        {activeTab === 'POS' && (
          <div className="h-full flex flex-col">
            {!currentSession ? (
              <div className="flex-1 flex items-center justify-center p-4 bg-slate-50">
                <div className="bg-white p-8 rounded-[3rem] shadow-2xl border border-slate-200 text-center max-w-sm w-full animate-in zoom-in-95">
                   <div className={`w-14 h-14 bg-${themeColor}-100 text-${themeColor}-600 rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-inner`}><PlayCircle size={28} /></div>
                   <h3 className="font-black text-lg mb-6 uppercase italic tracking-tighter text-slate-900">{activeMode} SESSIE</h3>
                   <div className="mb-6 text-left space-y-3">
                     <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest block text-center">Startgeld lade (€)</label>
                     <input 
                      type="number" 
                      value={startFloatAmount} 
                      onChange={e=>setStartFloatAmount(e.target.value)} 
                      className={`w-full bg-slate-50 border-2 border-slate-100 p-5 rounded-[1.5rem] text-center font-black text-2xl outline-none focus:border-${themeColor}-500 shadow-sm`} 
                     />
                   </div>
                   <button onClick={() => {
                     const now = Date.now();
                     const newSession: SalesSession = { 
                      id: `SES-${now}`, 
                      startTime: now, 
                      startCash: parseFloat(startFloatAmount) || 0, 
                      status: 'OPEN', 
                      updatedAt: now 
                     };
                     setCurrentSession(newSession);
                     setSessions(prev => [newSession, ...prev]);
                   }} className={`w-full bg-slate-950 text-white py-5 rounded-[1.5rem] font-black uppercase tracking-widest active:scale-95 transition-all shadow-xl shadow-${themeColor}-500/10`}>SESSIE STARTEN</button>
                </div>
              </div>
            ) : (
              <>
                {/* --- CART TOP --- */}
                <div className="h-[35%] bg-white border-b border-slate-200 flex flex-col shadow-inner shrink-0 overflow-hidden">
                   <div className="px-4 py-2 bg-slate-50 border-b border-slate-100 flex justify-between items-center shrink-0">
                      <div className="flex gap-2">
                        <button onClick={() => setShowSalesmanSelection(true)} className={`flex items-center gap-2 px-4 py-1.5 rounded-full border-2 transition-all text-[9px] font-black uppercase tracking-tight shadow-sm active:scale-95 ${company.sellerName ? `bg-${themeColor}-50 border-${themeColor}-500 text-${themeColor}-950` : 'bg-white border-slate-200 text-slate-600'}`}>
                          <User size={12} className={company.sellerName ? `text-${themeColor}-500` : 'text-slate-400'}/> {company.sellerName || "Verkoper"} <ChevronDown size={12}/>
                        </button>
                        {btConnected && (
                          <div className="flex items-center gap-1 bg-emerald-50 text-emerald-600 px-3 py-1.5 rounded-full border border-emerald-100 animate-pulse">
                             <Bluetooth size={10}/> <span className="text-[7px] font-black uppercase">Online</span>
                          </div>
                        )}
                      </div>
                      <button onClick={()=>setCart([])} className="p-2 text-slate-300 hover:text-red-500 transition-colors"><Trash2 size={18}/></button>
                   </div>
                   <div className="flex-1 overflow-y-auto p-2 space-y-1.5 bg-white custom-scrollbar">
                     {cart.length === 0 ? (
                       <div className="h-full flex flex-col items-center justify-center opacity-10"><ShoppingBag size={40}/><span className="text-[8px] font-black mt-2 uppercase tracking-widest">Leeg</span></div>
                     ) : cart.map(item => (
                       <div key={item.id} className="flex items-center justify-between p-2.5 bg-slate-50 rounded-[1rem] border border-slate-100 animate-in slide-in-from-bottom-2">
                         <div className="flex-1 min-w-0 pr-3 text-left">
                           <div className="font-black text-[10px] truncate uppercase text-slate-800 tracking-tight">{item.name}</div>
                           <div className="text-[8px] text-slate-400 font-bold">€{item.price.toFixed(2)}</div>
                         </div>
                         <div className="flex items-center gap-2 bg-white p-0.5 rounded-full border border-slate-200 shadow-sm">
                           <button onClick={()=>{
                             const i = cart.find(x => x.id === item.id);
                             if (i?.quantity === 1) setCart(cart.filter(x => x.id !== item.id));
                             else setCart(cart.map(x => x.id === item.id ? {...x, quantity: x.quantity - 1} : x));
                           }} className="w-7 h-7 rounded-full flex items-center justify-center text-slate-400 active:text-red-500"><Minus size={12}/></button>
                           <span className="font-black text-[10px] w-3 text-center text-slate-800 italic">{item.quantity}</span>
                           <button onClick={()=>addToCart(item)} className={`w-7 h-7 rounded-full flex items-center justify-center text-slate-400 active:text-${themeColor}-500`}><Plus size={12}/></button>
                         </div>
                       </div>
                     ))}
                   </div>
                </div>
                
                {/* --- PRODUCT GRID (4 COLUMNS) --- */}
                <div className="flex-1 overflow-y-auto p-3 bg-slate-100/30 custom-scrollbar">
                   <div className="grid grid-cols-4 gap-2 pb-6">
                      {products.map(p => (
                        <button 
                          key={p.id} 
                          onClick={() => addToCart(p)} 
                          className={`${p.color || 'bg-white'} p-2 rounded-[1rem] border border-black/5 shadow-sm active:scale-90 flex flex-col items-center justify-center text-center h-20 transition-all overflow-hidden`}
                        >
                          <span className="text-[8px] font-black leading-tight mb-1 line-clamp-2 uppercase tracking-tighter text-slate-900">{p.name}</span>
                          <span className="text-slate-950 bg-white/80 px-1.5 py-0.5 rounded-full text-[7px] font-black shadow-sm italic">€{p.price.toFixed(2)}</span>
                        </button>
                      ))}
                   </div>
                </div>

                {/* --- PAYMENTS BOTTOM --- */}
                <div className="bg-slate-950 text-white p-5 space-y-4 shrink-0 shadow-[0_-10px_40px_rgba(0,0,0,0.5)] rounded-t-[2.5rem]">
                  <div className="flex justify-between items-center px-1">
                    <span className="text-slate-500 text-[9px] font-black uppercase tracking-[0.2em]">TOTAAL</span>
                    <span className={`text-3xl font-black tracking-tighter text-${themeColor}-500 italic`}>€{totals.total.toFixed(2)}</span>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <button disabled={cart.length===0} onClick={()=>finalizePayment(PaymentMethod.CASH)} className="bg-emerald-500/10 active:bg-emerald-500/20 h-12 rounded-[1.2rem] flex items-center justify-center gap-2 font-black text-[9px] uppercase disabled:opacity-10 transition-all border border-emerald-500/30">
                       <Banknote size={20} className="text-emerald-500"/> <span className="text-emerald-50">CONTANT</span>
                    </button>
                    <button disabled={cart.length===0} onClick={() => setShowCardPrompt(true)} className="bg-blue-500/10 active:bg-blue-500/20 h-12 rounded-[1.2rem] flex items-center justify-center gap-2 font-black text-[9px] uppercase disabled:opacity-10 transition-all border border-blue-500/30">
                       <CreditCard size={20} className="text-blue-500"/> <span className="text-blue-50">KAART</span>
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>
        )}

        {activeTab === 'REPORTS' && (
           <div className="h-full overflow-y-auto p-4 space-y-6 bg-slate-50 custom-scrollbar">
              <div className="flex justify-between items-center">
                 <h2 className="text-2xl font-black uppercase italic tracking-tighter text-slate-900">Overzicht</h2>
                 {selectedHistorySession && (
                   <button onClick={() => setSelectedHistorySession(null)} className="text-[10px] font-black uppercase tracking-widest text-slate-900 flex items-center gap-1">
                     <ArrowRight size={14} className="rotate-180"/> Terug
                   </button>
                 )}
              </div>

              {selectedHistorySession ? (
                <div className="space-y-6 animate-in slide-in-from-bottom-2 pb-12">
                   <div className="bg-white p-6 rounded-[2rem] shadow-xl border border-slate-100 space-y-4">
                      <div className="flex items-center justify-between">
                         <div className="flex items-center gap-3 text-slate-400">
                            <Calendar size={16}/>
                            <span className="text-[10px] font-black uppercase tracking-widest">{new Date(selectedHistorySession.startTime).toLocaleDateString('nl-NL')}</span>
                         </div>
                         <span className={`px-3 py-1 rounded-full text-[8px] font-black uppercase tracking-widest bg-slate-100 text-slate-500`}>
                            {selectedHistorySession.status}
                         </span>
                      </div>
                      <div className="grid grid-cols-2 gap-4 pt-2 border-t border-slate-50">
                         <div>
                            <div className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Omzet</div>
                            <div className="text-2xl font-black italic text-slate-950">€{selectedHistorySession.summary?.totalSales.toFixed(2)}</div>
                         </div>
                         <div className="text-right">
                            <div className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Tickets</div>
                            <div className="text-2xl font-black italic text-slate-950">{selectedHistorySession.summary?.transactionCount}</div>
                         </div>
                      </div>
                   </div>

                   <div className="bg-slate-950 text-white p-6 rounded-[2rem] shadow-2xl space-y-4">
                     <h3 className="font-black text-[10px] uppercase tracking-[0.2em] text-slate-500 border-b border-white/5 pb-3">Kastoestand</h3>
                     <div className="grid grid-cols-2 gap-y-4 gap-x-6">
                       <div className="space-y-1">
                         <span className="text-[8px] font-bold text-slate-500 uppercase tracking-widest block">Start</span>
                         <span className="font-black italic">€{selectedHistorySession.startCash.toFixed(2)}</span>
                       </div>
                       <div className="text-right space-y-1">
                         <span className="text-[8px] font-bold text-slate-500 uppercase tracking-widest block">Verwacht</span>
                         <span className="font-black italic text-slate-400">€{selectedHistorySession.expectedCash?.toFixed(2)}</span>
                       </div>
                       <div className="space-y-1">
                         <span className="text-[8px] font-bold text-slate-500 uppercase tracking-widest block">Geteld</span>
                         <span className="font-black italic text-emerald-400">€{selectedHistorySession.endCash?.toFixed(2)}</span>
                       </div>
                       <div className="text-right space-y-1">
                         <span className="text-[8px] font-bold text-slate-500 uppercase tracking-widest block">Verschil</span>
                         <span className={`font-black italic ${((selectedHistorySession.endCash || 0) - (selectedHistorySession.expectedCash || 0)) < 0 ? 'text-red-400' : 'text-emerald-400'}`}>
                           €{((selectedHistorySession.endCash || 0) - (selectedHistorySession.expectedCash || 0)).toFixed(2)}
                         </span>
                       </div>
                     </div>
                   </div>

                   <div className="bg-white rounded-[2rem] shadow-xl border border-slate-100 overflow-hidden">
                      <div className="p-5 border-b border-slate-50 bg-slate-50/50 flex justify-between items-center">
                         <h3 className="font-black text-[9px] uppercase tracking-widest">Artikelen</h3>
                         <button onClick={() => btPrinterService.printSessionReport(selectedHistorySession, transactions.filter(t => t.sessionId === selectedHistorySession.id), company)} className="bg-slate-900 text-white p-2 rounded-xl active:scale-95">
                            <Printer size={16}/>
                         </button>
                      </div>
                      <div className="divide-y divide-slate-50">
                         {getSessionProductBreakdown(selectedHistorySession.id).map(item => (
                           <div key={item.name} className="p-4 flex items-center justify-between">
                              <div className="flex flex-col">
                                 <span className="text-[11px] font-black uppercase tracking-tight text-slate-800">{item.name}</span>
                                 <span className="text-[8px] text-slate-400 font-bold uppercase">{item.qty} verkocht</span>
                              </div>
                              <span className="text-xs font-black italic text-slate-950">€{item.total.toFixed(2)}</span>
                           </div>
                         ))}
                      </div>
                   </div>
                </div>
              ) : (
                <div className="space-y-8 pb-12">
                   {currentSession ? (
                     <div className="bg-white p-6 rounded-[2rem] shadow-xl border-l-8 border-amber-500 space-y-6 animate-in slide-in-from-top-2">
                        <div className="flex justify-between items-start">
                           <div>
                              <h3 className="font-black text-xs uppercase tracking-widest text-amber-600">Actieve Shift</h3>
                              <p className="text-[8px] text-slate-400 font-bold uppercase">Sinds {new Date(currentSession.startTime).toLocaleTimeString('nl-NL', {hour:'2-digit', minute:'2-digit'})}</p>
                           </div>
                           <button 
                             onClick={() => {
                               setIsClosingSession(true);
                               setEndCashInput('');
                             }} 
                             className="bg-red-500 text-white px-4 py-2 rounded-xl font-black text-[8px] uppercase shadow-lg active:scale-95"
                           >
                             Afsluiten
                           </button>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                           <div>
                              <span className="text-[8px] font-black text-slate-400 uppercase block mb-1">Verkoop Nu</span>
                              <div className="text-2xl font-black italic">€{transactions.filter(t=>t.sessionId===currentSession.id).reduce((a,b)=>a+b.total, 0).toFixed(2)}</div>
                           </div>
                           <div>
                              <span className="text-[8px] font-black text-slate-400 uppercase block mb-1">In Lade</span>
                              <div className="text-2xl font-black text-emerald-600 italic">€{(currentSession.startCash + transactions.filter(t=>t.sessionId===currentSession.id && t.paymentMethod===PaymentMethod.CASH).reduce((a,b)=>a+b.total, 0)).toFixed(2)}</div>
                           </div>
                        </div>
                     </div>
                   ) : (
                     <div className="bg-white p-10 rounded-[2rem] border-2 border-dashed border-slate-100 text-center space-y-3 opacity-60">
                        <PlayCircle size={40} className="mx-auto text-slate-200"/>
                        <p className="text-[9px] font-black uppercase tracking-widest text-slate-400">Geen actieve shift.</p>
                     </div>
                   )}

                   <div className="space-y-4">
                      <h3 className="font-black text-[10px] uppercase tracking-[0.3em] text-slate-400 flex items-center gap-2 px-2">
                         <History size={14}/> GESLOTEN SESSIES
                      </h3>
                      <div className="space-y-3">
                         {sessions.filter(s => s.status === 'CLOSED').length === 0 ? (
                           <div className="text-center py-10 opacity-30 text-[9px] font-black uppercase tracking-widest">Nog geen data</div>
                         ) : sessions.filter(s => s.status === 'CLOSED').map(s => (
                           <button key={s.id} onClick={() => setSelectedHistorySession(s)} className="w-full bg-white p-5 rounded-[1.8rem] shadow-sm border border-slate-100 flex items-center justify-between active:scale-[0.98] transition-all group">
                              <div className="text-left">
                                 <div className="text-[11px] font-black uppercase tracking-tight text-slate-900">{new Date(s.startTime).toLocaleDateString('nl-NL')}</div>
                                 <div className="text-[8px] text-slate-400 font-bold uppercase">{new Date(s.startTime).toLocaleTimeString('nl-NL', {hour:'2-digit', minute:'2-digit'})} - {new Date(s.endTime!).toLocaleTimeString('nl-NL', {hour:'2-digit', minute:'2-digit'})}</div>
                              </div>
                              <div className="flex items-center gap-4">
                                 <div className="text-right">
                                    <div className="text-xs font-black italic text-slate-950">€{s.summary?.totalSales.toFixed(2)}</div>
                                    <div className="text-[7px] text-slate-400 font-black uppercase">{s.summary?.transactionCount} tickets</div>
                                 </div>
                                 <ChevronRight size={16} className="text-slate-200 group-active:translate-x-1 transition-transform"/>
                              </div>
                           </button>
                         ))}
                      </div>
                   </div>
                </div>
              )}
           </div>
        )}

        {activeTab === 'SETTINGS' && (
          <div className="h-full overflow-y-auto p-4 space-y-8 bg-slate-50 custom-scrollbar pb-32">
             <div className="flex justify-between items-center px-2">
                <h2 className="text-2xl font-black uppercase tracking-tight text-slate-900 italic">Beheer</h2>
                <div className="flex gap-2">
                   <button onClick={() => setActiveMode(null)} className="bg-slate-900 text-white px-4 py-2 rounded-full text-[8px] font-black uppercase tracking-widest shadow-lg">MODUS</button>
                   <button onClick={() => setIsAuthenticated(false)} className="bg-white border border-slate-200 px-4 py-2 rounded-full text-[8px] font-black uppercase tracking-widest text-slate-400">LOCK</button>
                </div>
             </div>

             {/* Printer management */}
             <div className="bg-white p-6 rounded-[2rem] shadow-sm border border-slate-100 space-y-6">
                <div className="flex items-center gap-3 border-b border-slate-50 pb-4">
                   <Bluetooth size={16} className={btConnected ? 'text-emerald-500' : 'text-slate-400'}/>
                   <h3 className="font-black text-[11px] uppercase tracking-widest text-slate-800">Bluetooth Printer</h3>
                </div>
                <div className="flex flex-col gap-4">
                   {btConnected ? (
                     <div className="bg-emerald-50 p-6 rounded-[1.5rem] border border-emerald-100 flex items-center justify-between">
                        <div className="flex items-center gap-4">
                           <div className="w-10 h-10 bg-emerald-500 text-white rounded-full flex items-center justify-center shadow-lg"><BluetoothConnected size={20}/></div>
                           <div>
                              <div className="text-xs font-black uppercase text-emerald-950">Verbonden</div>
                              <div className="text-[9px] text-emerald-600 font-bold uppercase tracking-widest">{btPrinterService.getDeviceName()}</div>
                           </div>
                        </div>
                        <div className="flex gap-2">
                          <button onClick={() => btPrinterService.testPrint()} className="p-3 bg-white text-emerald-600 rounded-xl border border-emerald-200 shadow-sm active:scale-95"><Printer size={18}/></button>
                          <button onClick={handleDisconnectPrinter} className="p-3 bg-red-50 text-red-600 rounded-xl border border-red-100 shadow-sm active:scale-95"><Trash2 size={18}/></button>
                        </div>
                     </div>
                   ) : (
                     <button 
                       onClick={handleConnectPrinter} 
                       disabled={isConnectingPrinter}
                       className="w-full bg-slate-950 text-white py-5 rounded-[1.5rem] font-black uppercase text-xs tracking-widest shadow-xl flex items-center justify-center gap-3 active:scale-95 disabled:opacity-50"
                     >
                       {isConnectingPrinter ? <Loader2 size={18} className="animate-spin"/> : <Bluetooth size={18}/>}
                       {isConnectingPrinter ? 'ZOEKEN...' : 'PRINTER KOPPELEN'}
                     </button>
                   )}
                </div>
             </div>

             {/* Salesman management */}
             <div className="bg-white p-6 rounded-[2rem] shadow-sm border border-slate-100 space-y-6">
                <div className="flex items-center gap-3 border-b border-slate-50 pb-4">
                   <Users size={16} className={`text-${themeColor}-500`}/>
                   <h3 className="font-black text-[11px] uppercase tracking-widest text-slate-800">Verkopers</h3>
                </div>
                <div className="space-y-4">
                   <div className="flex gap-2">
                      <input 
                        type="text" 
                        placeholder="Naam..." 
                        value={newSalesmanName} 
                        onChange={e => setNewSalesmanName(e.target.value)}
                        className="flex-1 bg-slate-50 border border-slate-100 p-4 rounded-2xl font-black text-xs outline-none focus:border-slate-950 shadow-inner"
                      />
                      <button onClick={addSalesman} className="bg-slate-950 text-white px-4 rounded-2xl active:scale-95 transition-all">
                        <UserPlus size={20}/>
                      </button>
                   </div>
                   <div className="grid grid-cols-1 gap-2">
                      {(company.salesmen || []).map(name => (
                        <div key={name} className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl border border-slate-100">
                           <div className="flex items-center gap-3 flex-1 min-w-0">
                              <span className="text-xs font-black uppercase tracking-tight truncate">{name}</span>
                           </div>
                           <button 
                             type="button"
                             onClick={(e) => {
                               e.stopPropagation();
                               e.preventDefault();
                               removeSalesman(name);
                             }} 
                             className="flex items-center justify-center w-12 h-12 bg-white text-slate-300 hover:text-red-600 hover:bg-red-50 active:bg-red-100 border border-slate-100 rounded-xl transition-all cursor-pointer shadow-sm group"
                             aria-label={`Verwijder ${name}`}
                           >
                              <Trash2 size={18} className="group-hover:scale-110 transition-transform" />
                           </button>
                        </div>
                      ))}
                   </div>
                </div>
             </div>

             {/* Product management */}
             <div className="bg-white p-6 rounded-[2rem] shadow-sm border border-slate-100 space-y-8">
                <div className="flex justify-between items-center border-b border-slate-50 pb-4">
                   <h3 className="font-black text-[11px] uppercase tracking-widest text-slate-800 flex items-center gap-3"><ShoppingBag size={16}/> Artikelen ({activeMode})</h3>
                   <button onClick={addProduct} className="bg-slate-950 text-white px-4 py-2 rounded-2xl text-[9px] font-black uppercase tracking-widest active:scale-95">+ ARTIKEL</button>
                </div>
                
                <div className="space-y-6">
                  {products.map(p => (
                    <div key={p.id} className="p-5 bg-white rounded-[2rem] border border-slate-200 flex flex-col gap-5 shadow-lg relative animate-in zoom-in-95 group">
                       <div className="flex items-center justify-between gap-3">
                          <div className="flex-1">
                             <label className="text-[7px] font-black text-slate-400 uppercase tracking-widest ml-1">Artikelnaam</label>
                             <input 
                               type="text" 
                               value={p.name} 
                               onChange={e=>updateProduct(p.id,'name',e.target.value.toUpperCase())} 
                               className="w-full bg-transparent font-black text-lg outline-none text-slate-900 uppercase italic tracking-tighter border-b border-slate-100 focus:border-slate-950 transition-all" 
                             />
                          </div>
                          <button onClick={()=>deleteProduct(p.id)} className="text-red-300 hover:text-red-500 p-2 transition-colors"><Trash2 size={22}/></button>
                       </div>

                       <div className="grid grid-cols-3 gap-3">
                          <div className="flex flex-col bg-slate-50 p-3 rounded-2xl border border-slate-100">
                             <label className="text-[7px] font-black text-slate-400 uppercase tracking-widest text-center mb-1">Prijs (€)</label>
                             <input 
                               type="number" step="0.01" value={p.price} 
                               onChange={e=>updateProduct(p.id,'price',parseFloat(e.target.value) || 0)} 
                               className="w-full bg-transparent font-black text-center outline-none italic text-slate-950" 
                             />
                          </div>
                          <div className="flex flex-col bg-slate-50 p-3 rounded-2xl border border-slate-100">
                             <label className="text-[7px] font-black text-slate-400 uppercase tracking-widest text-center mb-1">Stock</label>
                             <input 
                               type="number" value={p.stock || 0} 
                               onChange={e=>updateProduct(p.id,'stock',parseInt(e.target.value) || 0)} 
                               className="w-full bg-transparent font-black text-center outline-none italic text-slate-950" 
                             />
                          </div>
                          <div className="flex flex-col bg-slate-50 p-3 rounded-2xl border border-slate-100">
                             <label className="text-[7px] font-black text-slate-400 uppercase tracking-widest text-center mb-1">BTW (%)</label>
                             <select 
                               value={p.vatRate} 
                               onChange={e=>updateProduct(p.id,'vatRate',parseInt(e.target.value))} 
                               className="w-full bg-transparent font-black text-center outline-none cursor-pointer appearance-none italic text-slate-950"
                             >
                               <option value={0}>0%</option>
                               <option value={21}>21%</option>
                             </select>
                          </div>
                       </div>

                       <div className="pt-2">
                          <label className="text-[7px] font-black text-slate-400 uppercase tracking-widest ml-1 mb-2 block">Knopkleur (POS)</label>
                          <div className="flex justify-between items-center gap-2">
                             {AVAILABLE_COLORS.map(colorClass => (
                               <button 
                                 key={colorClass}
                                 onClick={() => updateProduct(p.id, 'color', colorClass)}
                                 className={`w-8 h-8 rounded-full border-2 transition-all ${colorClass} ${p.color === colorClass ? 'border-slate-950 scale-125 shadow-md' : 'border-white'}`}
                               />
                             ))}
                          </div>
                       </div>
                    </div>
                  ))}
                </div>
             </div>

             <div className="bg-white p-6 rounded-[2rem] shadow-sm border border-slate-100 space-y-6">
                <h3 className="font-black text-[11px] uppercase tracking-widest text-slate-800 flex items-center gap-3"><Building2 size={16}/> Bedrijfsgegevens ({activeMode})</h3>
                <div className="space-y-4">
                   <div className="space-y-1">
                      <label className="text-[8px] font-black text-slate-400 uppercase tracking-widest ml-4">BEDRIJFSNAAM</label>
                      <input type="text" value={company.name} onChange={e=>setCompany({...company, name: e.target.value, updatedAt: Date.now()})} className="w-full bg-slate-50 border border-slate-100 p-4 rounded-2xl font-black text-xs outline-none focus:border-slate-950 shadow-inner" />
                   </div>
                   <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-1">
                        <label className="text-[8px] font-black text-slate-400 uppercase tracking-widest ml-4">ADRES REGEL 1</label>
                        <input type="text" value={company.address} onChange={e=>setCompany({...company, address: e.target.value, updatedAt: Date.now()})} className="w-full bg-slate-50 border border-slate-100 p-4 rounded-2xl font-black text-xs outline-none focus:border-slate-950 shadow-inner" />
                      </div>
                      <div className="space-y-1">
                        <label className="text-[8px] font-black text-slate-400 uppercase tracking-widest ml-4">ADRES REGEL 2</label>
                        <input type="text" value={company.address2 || ''} onChange={e=>setCompany({...company, address2: e.target.value, updatedAt: Date.now()})} className="w-full bg-slate-50 border border-slate-100 p-4 rounded-2xl font-black text-xs outline-none focus:border-slate-950 shadow-inner" />
                      </div>
                   </div>
                   <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-1">
                        <label className="text-[8px] font-black text-slate-400 uppercase tracking-widest ml-4">BTW NUMMER</label>
                        <input type="text" value={company.vatNumber} onChange={e=>setCompany({...company, vatNumber: e.target.value, updatedAt: Date.now()})} className="w-full bg-slate-50 border border-slate-100 p-4 rounded-2xl font-black text-xs outline-none focus:border-slate-950 shadow-inner" />
                      </div>
                      <div className="space-y-1">
                        <label className="text-[8px] font-black text-slate-400 uppercase tracking-widest ml-4">WEBSITE</label>
                        <input type="text" value={company.website || ''} onChange={e=>setCompany({...company, website: e.target.value, updatedAt: Date.now()})} className="w-full bg-slate-50 border border-slate-100 p-4 rounded-2xl font-black text-xs outline-none focus:border-slate-950 shadow-inner" />
                      </div>
                   </div>
                   <div className="space-y-1">
                      <label className="text-[8px] font-black text-slate-400 uppercase tracking-widest ml-4">BON VOETTEKST</label>
                      <input type="text" value={company.footerMessage} onChange={e=>setCompany({...company, footerMessage: e.target.value, updatedAt: Date.now()})} className="w-full bg-slate-50 border border-slate-100 p-4 rounded-2xl font-black text-xs outline-none focus:border-slate-950 shadow-inner" />
                   </div>
                   <div className="space-y-1">
                      <label className="text-[8px] font-black text-slate-400 uppercase tracking-widest ml-4">PIN WIJZIGEN (GLOBAL)</label>
                      <input type="password" placeholder="****" value={company.masterPassword} onChange={e=>setCompany({...company, masterPassword: e.target.value, updatedAt: Date.now()})} className="w-full bg-slate-50 border border-slate-100 p-4 rounded-2xl font-black text-xs outline-none focus:border-slate-950 shadow-inner" />
                   </div>
                </div>
             </div>
          </div>
        )}
      </main>

      {/* --- OVERLAYS --- */}

      {showSuccess && (
        <div className="fixed inset-0 z-[1100] flex items-center justify-center p-4 pointer-events-none">
           <div className="bg-emerald-600 text-white px-12 py-8 rounded-[3rem] shadow-2xl flex flex-col items-center gap-4 animate-in zoom-in-95 border-[10px] border-white">
              <CheckCircle size={64}/>
              <span className="font-black text-xl uppercase tracking-widest italic">BETAALD!</span>
           </div>
        </div>
      )}

      {isClosingSession && (
        <div className="fixed inset-0 z-[1200] flex items-center justify-center bg-slate-950/80 backdrop-blur-xl p-6 animate-in fade-in">
           <div className="bg-white rounded-[2.5rem] shadow-2xl w-full max-sm p-8 flex flex-col items-center text-center gap-6 animate-in zoom-in-95">
              <div className="w-16 h-16 bg-red-100 text-red-600 rounded-[1.5rem] flex items-center justify-center shadow-inner">
                <AlertCircle size={32}/>
              </div>
              <div className="space-y-2">
                <h3 className="font-black text-xl uppercase tracking-tight italic">Einde Shift</h3>
                <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Cash geteld in de lade?</p>
              </div>
              <div className="w-full space-y-4">
                <div className="relative">
                   <span className="absolute left-6 top-1/2 -translate-y-1/2 font-black text-slate-300">€</span>
                   <input 
                    type="number" 
                    autoFocus
                    placeholder="0.00"
                    value={endCashInput}
                    onChange={e => setEndCashInput(e.target.value)}
                    className="w-full bg-slate-50 border-2 border-slate-100 py-6 px-12 rounded-[1.5rem] font-black text-3xl outline-none focus:border-red-500 transition-all text-center"
                   />
                </div>
                <div className="flex flex-col gap-3">
                  <button 
                    onClick={() => closeSession(parseFloat(endCashInput) || 0)}
                    disabled={endCashInput === ''}
                    className="w-full bg-red-500 text-white py-5 rounded-[1.5rem] font-black uppercase text-xs tracking-widest shadow-xl shadow-red-500/20 active:scale-95 disabled:opacity-20 transition-all"
                  >
                    BEVESTIG & SLUIT
                  </button>
                  <button onClick={() => setIsClosingSession(false)} className="w-full py-3 text-slate-400 font-black uppercase text-[9px] tracking-widest active:scale-95">TERUG</button>
                </div>
              </div>
           </div>
        </div>
      )}

      {showCardPrompt && (
        <div className="fixed inset-0 z-[1050] flex items-center justify-center bg-slate-950/80 backdrop-blur-xl p-6 animate-in fade-in">
           <div className="bg-white rounded-[2.5rem] shadow-2xl w-full max-sm p-10 flex flex-col items-center text-center gap-6 animate-in zoom-in-95">
              <div className="w-20 h-20 bg-blue-100 text-blue-600 rounded-[2rem] flex items-center justify-center shadow-inner mb-2"><CreditCard size={40}/></div>
              <h3 className="font-black text-xl uppercase tracking-tight italic">Kaartbetaling</h3>
              <div className="text-4xl font-black text-slate-950 my-2 tracking-tighter italic">€{totals.total.toFixed(2)}</div>
              <div className="flex flex-col w-full gap-3">
                <button onClick={() => finalizePayment(PaymentMethod.CARD)} className={`w-full bg-slate-950 text-white py-5 rounded-[1.5rem] font-black uppercase text-xs tracking-widest shadow-2xl active:scale-95 shadow-${themeColor}-500/20`}>BEVESTIG</button>
                <button onClick={() => setShowCardPrompt(false)} className="w-full bg-slate-100 text-slate-400 py-3 rounded-[1.2rem] font-black uppercase text-[9px] tracking-widest active:scale-95">ANNULEER</button>
              </div>
           </div>
        </div>
      )}

      {showSalesmanSelection && (
        <div className="fixed inset-0 z-[1000] flex items-center justify-center bg-slate-950/90 backdrop-blur-xl p-6 animate-in fade-in">
          <div className="bg-white rounded-[2rem] shadow-2xl w-full max-sm overflow-hidden flex flex-col animate-in zoom-in-95">
            <div className="p-6 border-b border-slate-100 bg-slate-50 flex justify-between items-center">
              <div className="flex items-center gap-3">
                <Users size={20} className={`text-${themeColor}-500`}/>
                <h3 className="font-black text-lg uppercase tracking-tight italic text-slate-950">Verkoper</h3>
              </div>
              <button onClick={() => setShowSalesmanSelection(false)} className="p-2 text-slate-400"><X size={24}/></button>
            </div>
            <div className="p-6 space-y-3 overflow-y-auto max-h-[60vh] bg-slate-50/30">
              {(company.salesmen || []).length === 0 ? (
                <div className="text-center py-10 text-slate-400 text-[10px] font-black uppercase tracking-widest">Geen verkopers geconfigureerd</div>
              ) : (company.salesmen || []).map(name => (
                <button 
                  key={name} 
                  onClick={() => { 
                    setCompany(prev => ({ ...prev, sellerName: name, updatedAt: Date.now() })); 
                    setTimeout(() => setShowSalesmanSelection(false), 200);
                  }}
                  className={`w-full p-6 rounded-[2rem] border-2 font-black uppercase text-xs tracking-widest transition-all flex items-center justify-between shadow-sm active:scale-95 ${company.sellerName === name ? `border-${themeColor}-500 bg-${themeColor}-50 text-${themeColor}-950` : 'border-white bg-white hover:border-slate-100 text-slate-600'}`}
                >
                  <div className="flex items-center gap-4">
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center font-black ${company.sellerName === name ? `bg-${themeColor}-200 text-${themeColor}-950` : 'bg-slate-100 text-slate-400'}`}>
                      {name.charAt(0).toUpperCase()}
                    </div>
                    {name}
                  </div>
                  {company.sellerName === name && <Check size={20} className={`text-${themeColor}-500`} />}
                </button>
              ))}
              <div className="pt-4">
                <button onClick={() => { setShowSalesmanSelection(false); setActiveTab('SETTINGS'); }} className="w-full py-4 text-[9px] font-black uppercase tracking-widest text-slate-400 hover:text-slate-900 transition-colors">Beheer verkopers</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {previewTransaction && (
        <div className="fixed inset-0 z-[1100] bg-slate-950/90 flex flex-col items-center justify-center p-6 backdrop-blur-md">
           <div className="bg-white rounded-[2.5rem] max-w-xs w-full overflow-hidden shadow-2xl flex flex-col animate-in zoom-in-95">
              <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50">
                <h3 className="font-black text-[9px] uppercase tracking-widest text-slate-400">Factuur</h3>
                <button onClick={() => setPreviewTransaction(null)} className="p-2 text-slate-400"><X size={20}/></button>
              </div>
              <div className="flex-1 overflow-y-auto p-6 flex justify-center bg-white">
                <Receipt preview transaction={previewTransaction} company={company} />
              </div>
              <div className="p-6 bg-slate-50 border-t border-slate-100">
                <button onClick={() => setPreviewTransaction(null)} className="w-full bg-slate-950 text-white py-4 rounded-[1.5rem] font-black uppercase text-[9px] tracking-widest active:scale-95">SLUITEN</button>
              </div>
           </div>
        </div>
      )}
    </div>
  );
}
