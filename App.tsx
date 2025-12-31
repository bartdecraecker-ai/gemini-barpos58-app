
import React, { useState, useEffect, useMemo } from 'react';
import { 
  ShoppingBag, Trash2, CreditCard, Banknote, BarChart3, Settings, Plus, Minus, X, 
  CheckCircle, PlayCircle, Lock, Loader2, User, ChevronDown, 
  Printer, Bluetooth, Store, MapPin, Delete, Calendar, Check, AlertCircle, 
  BluetoothConnected, LogOut, RefreshCcw, Package, Building2, Users, ShieldCheck, Database, Sparkles, Eye,
  Save
} from 'lucide-react';
import { PaymentMethod } from './types.ts';
import type { Product, CartItem, Transaction, CompanyDetails, SalesSession, DailySummary, CloudConfig } from './types.ts';
import { DEFAULT_COMPANY, INITIAL_PRODUCTS, AVAILABLE_COLORS } from './constants.ts';
import { Receipt } from './components/Receipt.tsx';
import { apiService } from './services/api.ts';
import type { AppMode } from './services/api.ts';
import { btPrinterService } from './services/bluetoothPrinter.ts';
import { generateDailyInsight } from './services/geminiService.ts';

const APP_VERSION = "1.0.3-PROD";

export default function App() {
  // Authentication & Mode State
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [activeMode, setActiveMode] = useState<AppMode | null>(null);
  const [pinInput, setPinInput] = useState('');
  const [loginError, setLoginError] = useState(false);
  const [isOnline, setIsOnline] = useState(navigator.onLine);

  // App Data
  const [products, setProducts] = useState<Product[]>([]);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [sessions, setSessions] = useState<SalesSession[]>([]);
  const [company, setCompany] = useState<CompanyDetails>(DEFAULT_COMPANY);
  
  // Cloud & Sync State
  const [cloudConfig, setCloudConfig] = useState<CloudConfig>({ syncId: '', isAutoSync: false });
  const [isSyncing, setIsSyncing] = useState(false);

  // UI State
  const [activeTab, setActiveTab] = useState<'POS' | 'REPORTS' | 'SETTINGS'>('POS');
  const [isInitialLoading, setIsInitialLoading] = useState(false);
  const [btConnected, setBtConnected] = useState(false);
  const [isConnectingPrinter, setIsConnectingPrinter] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [showCardPrompt, setShowCardPrompt] = useState(false);
  const [previewTransaction, setPreviewTransaction] = useState<Transaction | null>(null);
  const [previewSession, setPreviewSession] = useState<SalesSession | null>(null);
  const [showSalesmanSelection, setShowSalesmanSelection] = useState(false);
  const [currentSession, setCurrentSession] = useState<SalesSession | null>(null);
  const [startFloatAmount, setStartFloatAmount] = useState<string>('0');
  const [newSalesmanName, setNewSalesmanName] = useState('');
  
  // Gemini AI State
  const [aiInsight, setAiInsight] = useState<string | null>(null);
  const [isGeneratingInsight, setIsGeneratingInsight] = useState(false);

  // Modals & Guards
  const [isClosingSession, setIsClosingSession] = useState(false);
  const [endCashInput, setEndCashInput] = useState('');

  const themeAccent = activeMode === 'SHOP' ? 'text-amber-500' : 'text-indigo-500';
  const themeBg = activeMode === 'SHOP' ? 'bg-amber-500' : 'bg-indigo-500';

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

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
          }, 400);
        }
      }
    }
  };

  useEffect(() => {
    const savedMode = apiService.getActiveMode();
    if (savedMode) setActiveMode(savedMode);
    setCloudConfig(apiService.getCloudConfig());
  }, []);

  const loadContextData = async () => {
    if (!isAuthenticated || !activeMode) return;
    setIsInitialLoading(true);
    try {
      await apiService.hydrateInitialData();
      const [p, t, c, s] = await Promise.all([
        apiService.getProducts(),
        apiService.getTransactions(),
        apiService.getCompany(),
        apiService.getSessions()
      ]);

      setProducts(p && p.length > 0 ? p.slice(0, 10) : INITIAL_PRODUCTS.slice(0, 10));
      setTransactions(t || []);
      setCompany(c || { ...DEFAULT_COMPANY, updatedAt: Date.now() });
      setSessions(s || []);

      const openS = s?.find(sess => sess.status === 'OPEN');
      setCurrentSession(openS || null);
      setBtConnected(btPrinterService.isConnected());
    } catch (err) {
      console.error("Critical Data Load Error:", err);
    } finally {
      setIsInitialLoading(false);
    }
  };

  useEffect(() => {
    loadContextData();
  }, [isAuthenticated, activeMode]);

  useEffect(() => {
    const interval = setInterval(() => {
      setBtConnected(btPrinterService.isConnected());
    }, 2500);
    return () => clearInterval(interval);
  }, []);

  const forceSync = async () => {
    if (!activeMode || isInitialLoading) return;
    setIsSyncing(true);
    try {
      await Promise.all([
        apiService.saveProducts(products),
        apiService.saveTransactions(transactions),
        apiService.saveSessions(sessions),
        apiService.saveCompany(company)
      ]);
      
      if (cloudConfig.syncId && cloudConfig.isAutoSync && isOnline) {
        await apiService.pushToCloud();
      }
    } catch (e) {
      console.error("Sync pipeline error:", e);
    } finally {
      setTimeout(() => setIsSyncing(false), 800);
    }
  };

  useEffect(() => {
    if (!isAuthenticated || !activeMode || isInitialLoading) return;
    const timer = setTimeout(forceSync, 3000);
    return () => clearTimeout(timer);
  }, [products, transactions, sessions, company, isAuthenticated, activeMode, isInitialLoading]);

  const handleModeSelect = (mode: AppMode) => {
    apiService.setActiveMode(mode);
    setActiveMode(mode);
  };

  const handleConnectPrinter = async () => {
    setIsConnectingPrinter(true);
    try {
      const success = await btPrinterService.connect();
      setBtConnected(success);
      if (success) await btPrinterService.testPrint();
    } catch (err: any) {
      alert("Printer Fout: " + err.message);
    } finally {
      setIsConnectingPrinter(false);
    }
  };

  const handleFactoryReset = () => {
    if (confirm("GEVAAR: Dit verwijdert alle transacties, sessies en instellingen permanent.")) {
      localStorage.clear();
      window.location.reload();
    }
  };

  const addToCart = (product: Product) => {
    setCart(prev => {
      const ex = prev.find(i => i.id === product.id);
      return ex ? prev.map(i => i.id === product.id ? { ...i, quantity: i.quantity + 1 } : i) : [...prev, { ...product, quantity: 1 }];
    });
  };

  const totals = useMemo(() => {
    let total = 0, v0 = 0, vHigh = 0;
    cart.forEach(i => {
      const line = (i.price || 0) * (i.quantity || 0);
      total += line;
      if (i.vatRate > 0) {
        const vatFactor = i.vatRate / 100;
        vHigh += (line - (line / (1 + vatFactor)));
      } else {
        v0 += line;
      }
    });
    return { total, v0, vHigh, net: total - vHigh };
  }, [cart]);

  const finalizePayment = async (method: PaymentMethod) => {
    if (!currentSession || cart.length === 0) return;
    if (!company.sellerName) {
      setShowSalesmanSelection(true);
      return;
    }

    const now = Date.now();
    const tx: Transaction = {
      id: `TX-${now}`,
      sessionId: currentSession.id,
      timestamp: now,
      dateStr: new Date(now).toLocaleDateString('nl-NL'),
      items: [...cart],
      subtotal: totals.net,
      vat0: totals.v0,
      vatHigh: totals.vHigh,
      total: totals.total,
      paymentMethod: method,
      salesmanName: company.sellerName,
      updatedAt: now
    };
    
    setTransactions(prev => [tx, ...prev]);
    setCart([]);
    setShowSuccess(true);
    setShowCardPrompt(false);
    
    if (btConnected) {
      try { await btPrinterService.printReceipt(tx, company); } catch(e) { console.warn("Print skipped", e); }
    }
    
    setTimeout(() => setShowSuccess(false), 1500);
    setPreviewTransaction(tx);
  };

  const calculateSessionSummary = (sessionId: string): DailySummary => {
    const sessionTx = transactions.filter(t => t.sessionId === sessionId);
    const cashSales = sessionTx.filter(t => t.paymentMethod === PaymentMethod.CASH).reduce((sum, t) => sum + t.total, 0);
    const cardSales = sessionTx.filter(t => t.paymentMethod === PaymentMethod.CARD).reduce((sum, t) => sum + t.total, 0);
    
    return {
      totalSales: sessionTx.reduce((sum, b) => sum + b.total, 0),
      transactionCount: sessionTx.length,
      cashTotal: cashSales,
      cardTotal: cardSales,
      vat0Total: sessionTx.reduce((sum, b) => sum + b.vat0, 0),
      vatHighTotal: sessionTx.reduce((sum, b) => sum + b.vatHigh, 0),
      firstTicketId: sessionTx.length > 0 ? sessionTx[sessionTx.length - 1].id : undefined,
      lastTicketId: sessionTx.length > 0 ? sessionTx[0].id : undefined
    };
  };

  const closeSession = async (endCashAmount: number) => {
    if (!currentSession) return;
    const summary = calculateSessionSummary(currentSession.id);
    const expectedCash = (currentSession.startCash || 0) + summary.cashTotal;
    
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
    setPreviewSession(closedSession);
    setCurrentSession(null);
    setIsClosingSession(false);
    setEndCashInput('');
    setActiveTab('REPORTS');
  };

  const handlePrintSession = async (session: SalesSession) => {
    if (!btConnected) return alert("Printer niet verbonden.");
    const sessionTx = transactions.filter(t => t.sessionId === session.id);
    try {
      await btPrinterService.printSessionReport(session, sessionTx, company);
    } catch (e: any) {
      alert("Print Fout: " + e.message);
    }
  };

  const runAiAnalysis = async () => {
    const sessionToAnalyze = currentSession || sessions.find(s => s.status === 'CLOSED');
    if (!sessionToAnalyze) return alert("Geen sessie data.");
    
    const summary = sessionToAnalyze.summary || calculateSessionSummary(sessionToAnalyze.id);
    const sessionTx = transactions.filter(t => t.sessionId === sessionToAnalyze.id);
    
    setIsGeneratingInsight(true);
    try {
      const insight = await generateDailyInsight(sessionTx, summary, activeMode!);
      setAiInsight(insight);
    } catch (e) {
      alert("AI Analyse mislukt.");
    } finally {
      setIsGeneratingInsight(false);
    }
  };

  if (!activeMode) {
    return (
      <div className="fixed inset-0 bg-slate-950 flex flex-col items-center justify-center p-6 animate-in fade-in">
        <div className="max-w-md w-full text-center space-y-12">
           <div className="space-y-4">
              <div className="w-24 h-24 bg-indigo-500 rounded-[2.5rem] flex items-center justify-center mx-auto shadow-2xl animate-bounce">
                 <Store size={48} className="text-white" />
              </div>
              <h1 className="text-white text-4xl font-black tracking-tighter">BarPOS <span className="text-indigo-500">Cloud</span></h1>
              <p className="text-slate-400 font-bold uppercase tracking-[0.3em] text-[10px]">Selecteer Systeem Modus</p>
           </div>
           <div className="grid grid-cols-1 gap-4">
              <button onClick={() => handleModeSelect('SHOP')} className="bg-white hover:bg-amber-500 p-8 rounded-[2.5rem] flex items-center justify-between transition-all active:scale-95 shadow-2xl group">
                 <div className="text-left">
                    <h3 className="font-black text-xl text-slate-950 group-hover:text-white">Vaste Bar</h3>
                    <p className="text-slate-400 text-xs font-bold group-hover:text-amber-100">Dagelijkse bar verkoop</p>
                 </div>
                 <Store size={32} className="text-amber-500 group-hover:text-white" />
              </button>
              <button onClick={() => handleModeSelect('TOUR')} className="bg-white hover:bg-indigo-500 p-8 rounded-[2.5rem] flex items-center justify-between transition-all active:scale-95 shadow-2xl group">
                 <div className="text-left">
                    <h3 className="font-black text-xl text-slate-950 group-hover:text-white">Tournee / Event</h3>
                    <p className="text-slate-400 text-xs font-bold group-hover:text-indigo-100">Mobiele merchandise & drinks</p>
                 </div>
                 <MapPin size={32} className="text-indigo-500 group-hover:text-white" />
              </button>
           </div>
           <div className="pt-10">
              <span className="text-slate-600 font-black text-[9px] uppercase tracking-[0.4em]">Version {APP_VERSION}</span>
           </div>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="fixed inset-0 bg-white flex flex-col items-center justify-center p-6 animate-in fade-in">
         <div className="max-w-xs w-full space-y-12">
            <div className="text-center space-y-4">
               <div className={`w-20 h-20 ${themeBg} rounded-[2rem] flex items-center justify-center mx-auto text-white shadow-xl`}>
                  <Lock size={32} />
               </div>
               <h2 className="text-2xl font-black tracking-tight text-slate-950">Toegang Verplicht</h2>
               <p className="text-slate-400 font-bold uppercase tracking-widest text-[9px]">Voer de 4-cijferige pincode in</p>
            </div>
            <div className="flex justify-center gap-4">
               {[0,1,2,3].map(i => (
                 <div key={i} className={`w-5 h-5 rounded-full border-2 transition-all ${pinInput.length > i ? `${themeBg} border-transparent scale-125` : 'border-slate-200'}`} />
               ))}
            </div>
            <div className={`grid grid-cols-3 gap-4 p-4 rounded-[3rem] bg-slate-50 border border-slate-100 ${loginError ? 'animate-shake border-rose-200 bg-rose-50' : ''}`}>
               {['1','2','3','4','5','6','7','8','9','C','0','X'].map(val => (
                 <button 
                  key={val} 
                  onClick={() => {
                    if (val === 'C') setPinInput('');
                    else if (val === 'X') setPinInput(pinInput.slice(0, -1));
                    else handlePinDigit(val);
                  }}
                  className="h-16 w-16 rounded-2xl bg-white shadow-sm flex items-center justify-center font-black text-xl text-slate-900 active:bg-slate-900 active:text-white transition-all"
                 >
                   {val === 'X' ? <Delete size={20}/> : val}
                 </button>
               ))}
            </div>
         </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 flex flex-col bg-slate-50 overflow-hidden font-sans select-none">
      <header className="h-14 bg-slate-950 flex items-center justify-between px-6 shrink-0 z-50">
         <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
               <div className={`w-2 h-2 rounded-full ${btConnected ? 'bg-emerald-500' : 'bg-rose-500 animate-pulse'}`} />
               <span className="text-white font-black text-[8px] uppercase tracking-widest opacity-70">Printer</span>
            </div>
         </div>
         <div className="flex items-center gap-3">
            <span className="text-white/40 font-black text-[9px] uppercase tracking-widest">{activeMode}</span>
            <button onClick={() => setActiveMode(null)} className="text-white/20 hover:text-white"><RefreshCcw size={14} /></button>
         </div>
      </header>

      <nav className="h-20 bg-white border-b border-slate-100 flex items-center justify-around shrink-0 z-40">
        {[
          { id: 'POS', label: 'Kassa', icon: ShoppingBag },
          { id: 'REPORTS', label: 'Rapport', icon: BarChart3 },
          { id: 'SETTINGS', label: 'Beheer', icon: Settings }
        ].map(tab => (
          <button 
            key={tab.id}
            onClick={() => setActiveTab(tab.id as any)} 
            className={`flex flex-col items-center justify-center h-full gap-1 px-8 ${activeTab === tab.id ? themeAccent : 'text-slate-300'}`}
          >
            <tab.icon size={22} strokeWidth={activeTab === tab.id ? 2.5 : 2} />
            <span className="text-[9px] font-extrabold uppercase tracking-widest">{tab.label}</span>
          </button>
        ))}
      </nav>

      <main className="flex-1 overflow-hidden relative">
        {activeTab === 'POS' && (
          <div className="h-full flex flex-col">
            {!currentSession ? (
              <div className="flex-1 flex items-center justify-center p-6 bg-slate-50">
                <div className="bg-white p-10 rounded-[3rem] shadow-2xl border border-slate-100 text-center max-w-sm w-full animate-in zoom-in-95">
                   <div className={`w-16 h-16 ${themeBg} bg-opacity-10 text-slate-900 rounded-3xl flex items-center justify-center mx-auto mb-8 shadow-inner`}><PlayCircle size={32} /></div>
                   <h3 className="font-black text-2xl mb-2 text-slate-900">{activeMode} Sessie</h3>
                   <input type="number" value={startFloatAmount} onChange={e=>setStartFloatAmount(e.target.value)} className="w-full bg-slate-50 border-2 border-slate-100 p-6 rounded-3xl text-center font-black text-3xl mb-8 outline-none" placeholder="Start Cash" />
                   <button onClick={() => {
                     const now = Date.now();
                     const newSession: SalesSession = { id: `SES-${now}`, startTime: now, startCash: parseFloat(startFloatAmount) || 0, status: 'OPEN', updatedAt: now };
                     setCurrentSession(newSession);
                     setSessions(prev => [newSession, ...prev]);
                   }} className="w-full bg-slate-950 text-white py-6 rounded-[2rem] font-black uppercase text-sm tracking-widest shadow-2xl">Start Shift</button>
                </div>
              </div>
            ) : (
              <>
                <div className="h-[40%] bg-white border-b border-slate-200 flex flex-col shrink-0 overflow-hidden relative">
                   <div className="px-6 py-4 bg-slate-50/50 backdrop-blur border-b border-slate-100 flex justify-between items-center shrink-0">
                      <button onClick={() => setShowSalesmanSelection(true)} className={`flex items-center gap-2 px-4 py-2 rounded-full border-2 transition-all text-[10px] font-bold uppercase tracking-tight shadow-sm ${company.sellerName ? `bg-white border-slate-900 text-slate-900` : 'bg-white border-rose-200 text-rose-500 animate-pulse'}`}>
                        <User size={12}/> {company.sellerName || "Verkoper"} <ChevronDown size={12}/>
                      </button>
                      <button onClick={()=>setCart([])} className="p-2 text-slate-300 hover:text-red-500"><Trash2 size={20}/></button>
                   </div>
                   <div className="flex-1 overflow-y-auto p-4 space-y-2 bg-white custom-scrollbar">
                     {cart.length === 0 ? (
                       <div className="h-full flex flex-col items-center justify-center opacity-10"><ShoppingBag size={60}/></div>
                     ) : cart.map(item => (
                       <div key={item.id} className="flex items-center justify-between p-3 bg-white rounded-2xl border border-slate-100 shadow-sm">
                         <div className="flex-1 min-w-0 pr-4">
                           <div className="font-black text-[12px] truncate text-slate-900 tracking-tight">{item.name}</div>
                           <div className="text-[9px] text-slate-400 font-bold font-mono">€{item.price.toFixed(2)}</div>
                         </div>
                         <div className="flex items-center gap-3 bg-slate-50 p-1 rounded-full">
                           <button onClick={()=>{
                             const i = cart.find(x => x.id === item.id);
                             if (i?.quantity === 1) setCart(cart.filter(x => x.id !== item.id));
                             else setCart(cart.map(x => x.id === item.id ? {...x, quantity: x.quantity - 1} : x));
                           }} className="w-8 h-8 bg-white rounded-full flex items-center justify-center text-slate-400"><Minus size={12}/></button>
                           <span className="font-black text-[12px] w-4 text-center text-slate-900 font-mono">{item.quantity}</span>
                           <button onClick={()=>addToCart(item)} className="w-8 h-8 bg-white rounded-full flex items-center justify-center text-slate-400"><Plus size={12}/></button>
                         </div>
                       </div>
                     ))}
                   </div>
                </div>
                <div className="flex-1 overflow-y-auto p-4 bg-slate-50 custom-scrollbar pb-32">
                   <div className="grid grid-cols-4 gap-3">
                      {products.map(p => (
                        <button key={p.id} onClick={() => addToCart(p)} className={`${p.color || 'bg-white'} rounded-[1.5rem] border border-black/5 pos-shadow flex flex-col items-center justify-center text-center p-2 h-24 transition-all active:scale-90`}>
                          <span className="text-[9px] font-black leading-tight mb-2 line-clamp-2 text-slate-900">{p.name}</span>
                          <span className="text-slate-950 bg-white/95 px-2.5 py-1 rounded-full text-[10px] font-black shadow-sm font-mono">€{p.price.toFixed(2)}</span>
                        </button>
                      ))}
                   </div>
                </div>
                <div className="absolute bottom-0 inset-x-0 bg-slate-950 text-white p-6 pb-8 space-y-5 rounded-t-[2.5rem] shadow-2xl">
                  <div className="flex justify-between items-center">
                    <span className="text-slate-500 text-[9px] font-black uppercase tracking-widest">Totaal Ticket</span>
                    <span className={`text-4xl font-black tracking-tighter ${themeAccent} font-mono`}>€{totals.total.toFixed(2)}</span>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <button disabled={cart.length===0} onClick={()=>finalizePayment(PaymentMethod.CASH)} className="bg-emerald-600 text-white h-14 rounded-2xl flex items-center justify-center gap-2 font-black text-[10px] uppercase shadow-xl"><Banknote size={20}/> Contant</button>
                    <button disabled={cart.length===0} onClick={() => setShowCardPrompt(true)} className="bg-blue-600 text-white h-14 rounded-2xl flex items-center justify-center gap-2 font-black text-[10px] uppercase shadow-xl"><CreditCard size={20}/> Kaart</button>
                  </div>
                </div>
              </>
            )}
          </div>
        )}

        {activeTab === 'REPORTS' && (
           <div className="h-full overflow-y-auto p-6 space-y-8 bg-slate-50 custom-scrollbar pb-32">
              <div className="flex justify-between items-end">
                 <div>
                    <h2 className="text-2xl font-black tracking-tighter text-slate-950">Statistieken</h2>
                 </div>
                 <button onClick={runAiAnalysis} disabled={isGeneratingInsight} className="bg-indigo-600 text-white p-3.5 rounded-xl shadow-lg flex items-center gap-2 font-black text-[9px] uppercase tracking-widest disabled:opacity-50">
                   {isGeneratingInsight ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14}/>} Analyseer
                 </button>
              </div>
              {aiInsight && (
                <div className="bg-white p-6 rounded-[2rem] shadow-sm border border-indigo-100 animate-in fade-in relative">
                   <button onClick={() => setAiInsight(null)} className="absolute top-4 right-4 text-slate-300"><X size={16}/></button>
                   <div className="flex items-center gap-2 mb-4">
                      <Sparkles size={16} className="text-indigo-500"/>
                      <span className="text-[10px] font-black text-indigo-500 uppercase tracking-widest">AI Consultant</span>
                   </div>
                   <div className="prose prose-sm text-slate-600 font-medium text-[12px] leading-relaxed whitespace-pre-wrap">
                      {aiInsight}
                   </div>
                </div>
              )}
              <div className="space-y-4">
                 {currentSession && (
                    <div className="bg-white p-6 rounded-[2rem] shadow-sm border-l-8 border-amber-500">
                       <div className="flex justify-between items-center mb-6">
                          <span className="text-[10px] font-black text-amber-600 uppercase tracking-widest">Actieve Shift</span>
                          <div className="flex gap-2">
                             <button onClick={() => setPreviewSession(currentSession)} className="p-2 text-slate-400"><Eye size={18}/></button>
                             <button onClick={() => setIsClosingSession(true)} className="bg-rose-500 text-white px-4 py-2 rounded-xl text-[9px] font-black uppercase">Sluiten</button>
                          </div>
                       </div>
                       <div className="grid grid-cols-2 gap-6 font-mono font-black text-xl">
                          <div>€{transactions.filter(t => t.sessionId === currentSession.id).reduce((s,t)=>s+t.total, 0).toFixed(2)}</div>
                          <div>{transactions.filter(t => t.sessionId === currentSession.id).length} Tks</div>
                       </div>
                    </div>
                 )}
                 {sessions.filter(s => s.status === 'CLOSED').map(session => (
                    <div key={session.id} className="bg-white p-5 rounded-[1.5rem] shadow-sm flex justify-between items-center">
                       <div className="flex items-center gap-4">
                          <Calendar size={18} className="text-slate-400" />
                          <div>
                             <h4 className="font-black text-xs">{new Date(session.endTime!).toLocaleDateString('nl-NL')}</h4>
                             <p className="text-[8px] font-bold text-slate-400 uppercase tracking-widest">€{(session.summary?.totalSales || 0).toFixed(2)}</p>
                          </div>
                       </div>
                       <div className="flex gap-1">
                          <button onClick={() => setPreviewSession(session)} className="p-2 text-slate-300 hover:text-indigo-600"><Eye size={18}/></button>
                          <button onClick={() => handlePrintSession(session)} className="p-2 text-slate-300 hover:text-emerald-600"><Printer size={18}/></button>
                       </div>
                    </div>
                 ))}
              </div>
           </div>
        )}

        {activeTab === 'SETTINGS' && (
          <div className="h-full overflow-y-auto p-6 space-y-12 bg-slate-50 custom-scrollbar pb-32">
             <div className="flex justify-between items-end">
                <h2 className="text-2xl font-black tracking-tighter text-slate-950">Beheer</h2>
                <div className="flex gap-2">
                   <button onClick={forceSync} className={`p-3 rounded-xl transition-all ${isSyncing ? 'bg-emerald-500 text-white' : 'bg-white text-slate-400 border'}`}>
                      {isSyncing ? <Loader2 size={16} className="animate-spin" /> : <Save size={16}/>}
                   </button>
                   <button onClick={() => setIsAuthenticated(false)} className="bg-white border text-slate-400 p-3 rounded-xl"><LogOut size={16}/></button>
                </div>
             </div>
             <div className="bg-white p-8 rounded-[2.5rem] border shadow-sm space-y-8">
                <div className="flex items-center gap-3"><Building2 size={20} className="text-blue-600"/><h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Bedrijf</h3></div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                   <input type="text" value={company.name} onChange={e=>setCompany({...company, name: e.target.value})} className="bg-slate-50 p-4 rounded-2xl font-bold text-xs" placeholder="Naam" />
                   <input type="text" value={company.vatNumber} onChange={e=>setCompany({...company, vatNumber: e.target.value})} className="bg-slate-50 p-4 rounded-2xl font-bold text-xs" placeholder="BTW" />
                   <textarea value={company.footerMessage} onChange={e=>setCompany({...company, footerMessage: e.target.value})} className="bg-slate-50 p-4 rounded-2xl font-bold text-xs h-20 md:col-span-2" placeholder="Bon Footer" />
                </div>
             </div>
             <div className="bg-slate-950 p-8 rounded-[3rem] text-white space-y-8 shadow-2xl">
                <div className="flex items-center justify-between"><ShieldCheck className="text-emerald-500"/><span className="text-[8px] font-black opacity-50">{APP_VERSION}</span></div>
                <div className="grid grid-cols-1 gap-4">
                   {btConnected ? (
                      <div className="flex items-center justify-between bg-emerald-500/10 p-4 rounded-2xl border border-emerald-500/20 text-emerald-500">
                         <span className="text-[10px] font-black uppercase tracking-widest">Printer Verbonden</span>
                         <button onClick={() => btPrinterService.disconnect()} className="p-2"><X size={16}/></button>
                      </div>
                   ) : (
                      <button onClick={handleConnectPrinter} disabled={isConnectingPrinter} className="w-full bg-white/5 text-white py-5 rounded-2xl font-black uppercase text-[10px] tracking-widest flex items-center justify-center gap-2 border border-white/10">
                         {isConnectingPrinter ? <Loader2 size={16} className="animate-spin"/> : <Bluetooth size={16}/>} Hardware Sync
                      </button>
                   )}
                   <button onClick={handleFactoryReset} className="w-full bg-rose-500/10 text-rose-500 py-5 rounded-2xl font-black uppercase text-[10px] tracking-widest flex items-center justify-center gap-2 border border-rose-500/20">
                      <Database size={16}/> Data Reset
                   </button>
                </div>
             </div>
          </div>
        )}
      </main>

      {/* MODALS */}
      {showSalesmanSelection && (
        <div className="fixed inset-0 z-[1200] flex items-center justify-center bg-slate-950/90 backdrop-blur-xl p-6 animate-in fade-in">
           <div className="bg-white rounded-[3rem] shadow-2xl w-full max-w-sm p-10 flex flex-col gap-8 animate-in zoom-in-95">
              <h3 className="font-black text-xl text-center">Wie werkt er?</h3>
              <div className="grid grid-cols-1 gap-3 max-h-[40vh] overflow-y-auto p-1">
                 {(company.salesmen || []).map(name => (
                   <button key={name} onClick={() => { setCompany({...company, sellerName: name}); setShowSalesmanSelection(false); }} className={`p-5 rounded-2xl font-black text-sm border-2 flex items-center justify-between ${company.sellerName === name ? `${themeAccent} border-slate-900 bg-slate-50` : 'border-slate-100 text-slate-600'}`}>{name}{company.sellerName === name && <Check size={18}/>}</button>
                 ))}
              </div>
              <button onClick={() => setShowSalesmanSelection(false)} className="w-full bg-slate-950 text-white py-5 rounded-2xl font-black uppercase text-[10px] tracking-widest">Bevestigen</button>
           </div>
        </div>
      )}

      {showCardPrompt && (
        <div className="fixed inset-0 z-[1050] flex items-center justify-center bg-slate-950/80 backdrop-blur-md p-6 animate-in fade-in">
           <div className="bg-white rounded-[2.5rem] shadow-2xl w-full max-w-xs p-10 flex flex-col items-center text-center gap-8 animate-in zoom-in-95">
              <div className="w-20 h-20 bg-blue-50 text-blue-600 rounded-3xl flex items-center justify-center shadow-inner"><CreditCard size={40}/></div>
              <div className="text-4xl font-black font-mono">€{totals.total.toFixed(2)}</div>
              <button onClick={() => finalizePayment(PaymentMethod.CARD)} className="w-full bg-blue-600 text-white py-5 rounded-2xl font-black uppercase text-xs tracking-[0.2em]">Bevestig Kaart</button>
              <button onClick={() => setShowCardPrompt(false)} className="text-slate-400 font-bold uppercase text-[9px]">Annuleren</button>
           </div>
        </div>
      )}

      {isClosingSession && (
        <div className="fixed inset-0 z-[1200] flex items-center justify-center bg-slate-950/90 backdrop-blur-xl p-6 animate-in fade-in">
           <div className="bg-white rounded-[3rem] shadow-2xl w-full max-w-sm p-10 flex flex-col items-center text-center gap-8 animate-in zoom-in-95">
              <AlertCircle size={40} className="text-rose-500" />
              <div className="w-full space-y-4">
                <input type="number" placeholder="Geteld Cash" value={endCashInput} onChange={e => setEndCashInput(e.target.value)} className="w-full bg-slate-50 border-2 border-slate-100 p-6 rounded-2xl font-black text-2xl outline-none text-center" />
                <button onClick={() => closeSession(parseFloat(endCashInput) || 0)} className="w-full bg-rose-500 text-white py-5 rounded-2xl font-black uppercase text-xs">Shift Sluiten</button>
                <button onClick={() => setIsClosingSession(false)} className="text-slate-400 font-bold uppercase text-[9px]">Terug</button>
              </div>
           </div>
        </div>
      )}

      {showSuccess && (
        <div className="fixed inset-0 z-[2000] flex items-center justify-center pointer-events-none">
           <div className="bg-emerald-600 text-white px-12 py-8 rounded-[3rem] shadow-2xl flex flex-col items-center gap-4 animate-in zoom-in-95 border-8 border-white/20">
              <CheckCircle size={60} strokeWidth={3}/>
              <span className="font-black text-xl uppercase tracking-widest">Betaald</span>
           </div>
        </div>
      )}

      {(previewTransaction || previewSession) && (
        <div className="fixed inset-0 z-[1100] bg-slate-950/95 flex flex-col items-center justify-center p-6 backdrop-blur-xl animate-in fade-in">
           <div className="bg-white rounded-[2rem] max-w-xs w-full overflow-hidden shadow-2xl animate-in zoom-in-95 border-4 border-white">
              <div className="p-4 border-b flex justify-between items-center bg-slate-50/50">
                <span className="text-[9px] font-black text-slate-400 uppercase">Bon Preview</span>
                <button onClick={() => {setPreviewTransaction(null); setPreviewSession(null);}} className="text-slate-400"><X size={18}/></button>
              </div>
              <div className="p-6 bg-white overflow-y-auto max-h-[60vh] flex justify-center">
                <Receipt preview transaction={previewTransaction} session={previewSession} company={company} />
              </div>
              <div className="p-6 border-t bg-slate-50 flex gap-2">
                <button onClick={() => {
                  if (previewTransaction) finalizePayment(previewTransaction.paymentMethod);
                  if (previewSession) handlePrintSession(previewSession);
                  setPreviewTransaction(null);
                  setPreviewSession(null);
                }} className="flex-1 bg-emerald-600 text-white py-4 rounded-xl font-black uppercase text-[10px] flex items-center justify-center gap-2">
                  <Printer size={16}/> Print
                </button>
                <button onClick={() => {setPreviewTransaction(null); setPreviewSession(null);}} className="flex-1 bg-slate-950 text-white py-4 rounded-xl font-black uppercase text-[10px]">Sluiten</button>
              </div>
           </div>
        </div>
      )}
    </div>
  );
}
