
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { 
  ShoppingBag, Trash2, CreditCard, Banknote, BarChart3, Settings, Plus, Minus, X, 
  CheckCircle, PlayCircle, Lock, Loader2, User, ChevronDown, 
  Printer, Bluetooth, Store, MapPin, Delete, ArrowRight, 
  ChevronRight, Calendar, Check, AlertCircle, BluetoothConnected, LogOut, RefreshCcw,
  Package, Euro, Percent, Tag, Database, Download, Upload, Layers, Building2, Globe, MessageSquare, UserPlus, Clock, Save, HelpCircle,
  Sparkles, FileText, Eye
} from 'lucide-react';
import { Product, CartItem, Transaction, PaymentMethod, CompanyDetails, SalesSession, DailySummary } from './types';
import { DEFAULT_COMPANY, INITIAL_PRODUCTS, AVAILABLE_COLORS } from './constants';
import { Receipt } from './components/Receipt';
import { apiService, AppMode } from './services/api';
import { btPrinterService } from './services/bluetoothPrinter';
import { generateDailyInsight } from './services/geminiService';

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
  const [isConnectingPrinter, setIsConnectingPrinter] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [showCardPrompt, setShowCardPrompt] = useState(false);
  const [previewTransaction, setPreviewTransaction] = useState<Transaction | null>(null);
  const [previewSession, setPreviewSession] = useState<SalesSession | null>(null);
  const [showSalesmanSelection, setShowSalesmanSelection] = useState(false);
  const [currentSession, setCurrentSession] = useState<SalesSession | null>(null);
  const [startFloatAmount, setStartFloatAmount] = useState<string>('0');
  const [newSalesmanName, setNewSalesmanName] = useState('');
  const [isSyncing, setIsSyncing] = useState(false);

  // Gemini AI State
  const [aiInsight, setAiInsight] = useState<string | null>(null);
  const [isGeneratingInsight, setIsGeneratingInsight] = useState(false);

  // Navigation Guard State
  const [showTabLeaveWarning, setShowTabLeaveWarning] = useState(false);
  const [pendingTab, setPendingTab] = useState<'POS' | 'REPORTS' | 'SETTINGS' | null>(null);
  
  // Session Closing State
  const [isClosingSession, setIsClosingSession] = useState(false);
  const [endCashInput, setEndCashInput] = useState('');

  const fileInputRef = useRef<HTMLInputElement>(null);

  const themeAccent = activeMode === 'SHOP' ? 'text-amber-500' : 'text-indigo-500';
  const themeBg = activeMode === 'SHOP' ? 'bg-amber-500' : 'bg-indigo-500';

  // PIN Login Handling
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

  // Initial Mode Fetch
  useEffect(() => {
    const savedMode = apiService.getActiveMode();
    if (savedMode) setActiveMode(savedMode);
  }, []);

  const loadContextData = async () => {
    if (!isAuthenticated || !activeMode) return;
    setIsInitialLoading(true);
    try {
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
      console.error("Data load failed", err);
    } finally {
      setIsInitialLoading(false);
    }
  };

  // Contextual Data Loading
  useEffect(() => {
    loadContextData();
  }, [isAuthenticated, activeMode]);

  useEffect(() => {
    const interval = setInterval(() => {
      setBtConnected(btPrinterService.isConnected());
    }, 2000);
    return () => clearInterval(interval);
  }, []);

  // Global Sync logic
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
    } catch (e) {
      console.error("Auto-sync failed", e);
    } finally {
      setTimeout(() => setIsSyncing(false), 500);
    }
  };

  useEffect(() => {
    if (!isAuthenticated || !activeMode || isInitialLoading) return;
    const timer = setTimeout(forceSync, 2000);
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
      alert("Printer fout: " + err.message);
    } finally {
      setIsConnectingPrinter(false);
    }
  };

  const handleDisconnectPrinter = () => {
    btPrinterService.disconnect();
    setBtConnected(false);
  };

  // Tab Navigation with Guard
  const requestTabChange = (tab: 'POS' | 'REPORTS' | 'SETTINGS') => {
    if (activeTab === tab) return;
    if (activeTab === 'POS' && currentSession) {
      setPendingTab(tab);
      setShowTabLeaveWarning(true);
    } else {
      setActiveTab(tab);
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
      const line = i.price * i.quantity;
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
      updatedAt: now
    };
    const newTxList = [tx, ...transactions];
    setTransactions(newTxList);
    setCart([]);
    setShowSuccess(true);
    setShowCardPrompt(false);
    if (btConnected) btPrinterService.printReceipt(tx, company);
    setTimeout(() => setShowSuccess(false), 1500);
    setPreviewTransaction(tx);
    apiService.saveTransactions(newTxList);
  };

  const closeSession = async (endCashAmount: number) => {
    if (!currentSession) return;
    const sessionTx = transactions.filter(t => t.sessionId === currentSession.id);
    const cashSales = sessionTx.filter(t => t.paymentMethod === PaymentMethod.CASH).reduce((sum, t) => sum + t.total, 0);
    const cardSales = sessionTx.filter(t => t.paymentMethod === PaymentMethod.CARD).reduce((sum, t) => sum + t.total, 0);
    
    const summary: DailySummary = {
      totalSales: sessionTx.reduce((sum, b) => sum + b.total, 0),
      transactionCount: sessionTx.length,
      cashTotal: cashSales,
      cardTotal: cardSales,
      vat0Total: sessionTx.reduce((sum, b) => sum + b.vat0, 0),
      vatHighTotal: sessionTx.reduce((sum, b) => sum + b.vatHigh, 0),
      firstTicketId: sessionTx.length > 0 ? sessionTx[sessionTx.length - 1].id : undefined,
      lastTicketId: sessionTx.length > 0 ? sessionTx[0].id : undefined
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
    
    const updatedSessions = [closedSession, ...sessions.filter(s => s.id !== currentSession.id)];
    setSessions(updatedSessions);
    apiService.saveSessions(updatedSessions);
    
    // Auto preview closed session
    setPreviewSession(closedSession);

    setCurrentSession(null);
    setIsClosingSession(false);
    setEndCashInput('');
    if (pendingTab) {
      setActiveTab(pendingTab);
      setPendingTab(null);
    } else {
      setActiveTab('REPORTS');
    }
  };

  const handleGetAIInsight = async () => {
    if (!currentSession && sessions.filter(s => s.status === 'CLOSED').length === 0) return;
    
    setIsGeneratingInsight(true);
    setAiInsight(null);
    try {
      const relevantTransactions = currentSession 
        ? transactions.filter(t => t.sessionId === currentSession.id)
        : transactions.filter(t => t.sessionId === sessions.find(s => s.status === 'CLOSED')?.id);
      
      const sessionSummary: DailySummary = currentSession?.summary || {
        totalSales: relevantTransactions.reduce((s,t)=>s+t.total,0),
        transactionCount: relevantTransactions.length,
        cashTotal: relevantTransactions.filter(t=>t.paymentMethod===PaymentMethod.CASH).reduce((s,t)=>s+t.total,0),
        cardTotal: relevantTransactions.filter(t=>t.paymentMethod===PaymentMethod.CARD).reduce((s,t)=>s+t.total,0),
        vat0Total: relevantTransactions.reduce((s,t)=>s+t.vat0,0),
        vatHighTotal: relevantTransactions.reduce((s,t)=>s+t.vatHigh,0)
      };

      const result = await generateDailyInsight(relevantTransactions, sessionSummary, activeMode!);
      setAiInsight(result);
    } catch (err) {
      setAiInsight("Analyse mislukt. Probeer het later opnieuw.");
    } finally {
      setIsGeneratingInsight(false);
    }
  };

  const printHistoricalReport = async (session: SalesSession) => {
    if (!btConnected) return alert("Verbind eerst met de printer.");
    const sessionTx = transactions.filter(t => t.sessionId === session.id);
    try {
      await btPrinterService.printSessionReport(session, sessionTx, company);
    } catch (err: any) {
      alert("Printen mislukt: " + err.message);
    }
  };

  const updateProduct = (id: string, field: keyof Product, value: any) => {
    setProducts(prev => prev.map(p => p.id === id ? { ...p, [field]: value, updatedAt: Date.now() } : p));
  };

  const deleteProduct = (id: string) => {
    if (window.confirm("Product verwijderen?")) {
      setProducts(prev => prev.filter(p => p.id !== id));
    }
  };

  const addProduct = () => {
    if (products.length >= 10) return alert("Maximaal 10 producten toegestaan.");
    const prefix = activeMode === 'TOUR' ? 'T' : 'S';
    const newP: Product = { 
      id: `${prefix}${Date.now()}`, 
      name: "Nieuw product", 
      price: 0, 
      vatRate: 21.5,
      color: AVAILABLE_COLORS[0], 
      stock: 0, 
      updatedAt: Date.now() 
    };
    setProducts(prev => [...prev, newP]);
  };

  const downloadFullBackup = () => {
    const backupData = {
      version: "1.0",
      timestamp: Date.now(),
      mode: activeMode,
      data: { products, transactions, sessions, company }
    };
    const blob = new Blob([JSON.stringify(backupData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `barpos-backup-${activeMode}-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleImportBackup = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const raw = e.target?.result as string;
        const content = JSON.parse(raw);
        
        if (Array.isArray(content)) {
          if (window.confirm("Lijst met producten importeren?")) {
            const importedProducts = content.slice(0, 10);
            setProducts(importedProducts);
            await apiService.saveProducts(importedProducts);
            alert("Producten succesvol hersteld!");
          }
          return;
        }

        const data = content.data || content;
        const backupMode = content.mode || activeMode;
        
        if (data && (data.products || data.company)) {
          const msg = backupMode !== activeMode 
            ? `Let op: Backup is van "${backupMode}". Laden in huidige "${activeMode}" omgeving?`
            : "Backup volledig herstellen? Huidige data wordt overschreven.";

          if (window.confirm(msg)) {
            const productsToSet = data.products ? data.products.slice(0, 10) : products;
            const companyToSet = data.company || company;
            const transactionsToSet = data.transactions || [];
            const sessionsToSet = data.sessions || [];

            setProducts(productsToSet);
            setCompany(companyToSet);
            setTransactions(transactionsToSet);
            setSessions(sessionsToSet);

            localStorage.setItem(`barpos_${activeMode}_products`, JSON.stringify(productsToSet));
            localStorage.setItem(`barpos_${activeMode}_company`, JSON.stringify(companyToSet));
            localStorage.setItem(`barpos_${activeMode}_transactions`, JSON.stringify(transactionsToSet));
            localStorage.setItem(`barpos_${activeMode}_sessions`, JSON.stringify(sessionsToSet));

            alert("Systeemgegevens succesvol hersteld!");
            loadContextData();
          }
        } else {
          alert("Ongeldig bestandsformaat.");
        }
      } catch (err) {
        alert("Fout bij importeren.");
      } finally {
        if (fileInputRef.current) fileInputRef.current.value = '';
      }
    };
    reader.readAsText(file);
  };

  const addSalesman = () => {
    if (!newSalesmanName.trim()) return;
    setCompany(prev => ({
      ...prev,
      salesmen: [...(prev.salesmen || []), newSalesmanName.trim()],
      updatedAt: Date.now()
    }));
    setNewSalesmanName('');
  };

  const deleteSalesman = (name: string) => {
    if (window.confirm(`Verkoper "${name}" verwijderen?`)) {
      setCompany(prev => ({
        ...prev,
        salesmen: (prev.salesmen || []).filter(s => s !== name),
        sellerName: prev.sellerName === name ? '' : prev.sellerName,
        updatedAt: Date.now()
      }));
    }
  };

  // Helper for Session Aggregation Breakdown
  const getSessionBreakdown = (session: SalesSession) => {
    if (!session || !session.id) return [];
    const sessionTx = transactions.filter(t => t.sessionId === session.id);
    const productBreakdown: Record<string, { name: string, qty: number, total: number }> = {};
    
    sessionTx.forEach(tx => {
      if (!tx.items) return;
      tx.items.forEach(item => {
        const key = item.id;
        if (!productBreakdown[key]) {
          productBreakdown[key] = { name: item.name || 'Onbekend', qty: 0, total: 0 };
        }
        productBreakdown[key].qty += (item.quantity || 0);
        productBreakdown[key].total += (item.quantity || 0) * (item.price || 0);
      });
    });

    return Object.values(productBreakdown).sort((a,b) => b.total - a.total);
  };

  // Auth Screen
  if (!isAuthenticated) {
    return (
      <div className="fixed inset-0 bg-slate-950 flex flex-col items-center justify-center p-6 text-white z-[1000] overflow-hidden">
        <div className={`w-full max-w-xs space-y-12 text-center animate-in zoom-in-95 ${loginError ? 'animate-shake' : ''}`}>
          <div className="space-y-4">
             <div className="w-20 h-20 bg-slate-900 rounded-[2rem] flex items-center justify-center mx-auto shadow-2xl border border-white/5">
                <Lock size={32} className="text-amber-500" />
             </div>
             <h1 className="text-2xl font-extrabold tracking-tight">BarPOS Login</h1>
             <p className="text-slate-500 text-[10px] font-bold uppercase tracking-[0.3em]">Toegangscode Vereist</p>
          </div>
          <div className="flex justify-center gap-5">
            {[...Array(4)].map((_, i) => (
              <div key={i} className={`w-4 h-4 rounded-full border-2 transition-all duration-300 ${pinInput.length > i ? 'bg-amber-500 border-amber-500 scale-125 shadow-[0_0_15px_rgba(245,158,11,0.6)]' : 'border-slate-800'}`} />
            ))}
          </div>
          <div className="grid grid-cols-3 gap-4">
            {[1, 2, 3, 4, 5, 6, 7, 8, 9, '', 0].map((digit, i) => (
              digit !== '' ? (
                <button key={i} onClick={() => handlePinDigit(digit.toString())} className="w-full aspect-square rounded-2xl bg-slate-900 border border-white/5 text-2xl font-bold active:bg-amber-500 active:text-black transition-all shadow-lg flex items-center justify-center">{digit}</button>
              ) : <div key={i} />
            ))}
            <button onClick={() => setPinInput(pinInput.slice(0, -1))} className="w-full aspect-square rounded-2xl bg-slate-900/50 border border-white/5 text-slate-500 flex items-center justify-center active:bg-slate-800 transition-all"><Delete size={24} /></button>
          </div>
        </div>
      </div>
    );
  }

  // Mode Selection
  if (!activeMode) {
    return (
      <div className="fixed inset-0 bg-slate-50 flex flex-col items-center justify-center p-6 z-[900]">
        <div className="w-full max-w-sm space-y-10 animate-in zoom-in-95">
          <div className="text-center space-y-3">
            <h2 className="text-3xl font-black tracking-tighter text-slate-950">Omgeving Kiezen</h2>
          </div>
          <div className="grid grid-cols-1 gap-5">
            <button onClick={() => handleModeSelect('SHOP')} className="bg-white p-8 rounded-[2.5rem] shadow-xl border-2 border-transparent hover:border-amber-500 transition-all flex items-center gap-6 text-left group">
              <div className="w-16 h-16 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center shrink-0 shadow-inner group-hover:scale-110 transition-transform"><Store size={32} /></div>
              <div className="flex-1">
                <h3 className="text-xl font-bold tracking-tighter">Kassa Shop</h3>
                <p className="text-slate-400 text-[10px] font-bold uppercase tracking-widest">Vaste bar instellingen</p>
              </div>
              <ChevronRight size={24} className="text-slate-200" />
            </button>
            <button onClick={() => handleModeSelect('TOUR')} className="bg-white p-8 rounded-[2.5rem] shadow-xl border-2 border-transparent hover:border-indigo-500 transition-all flex items-center gap-6 text-left group">
              <div className="w-16 h-16 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center shrink-0 shadow-inner group-hover:scale-110 transition-transform"><MapPin size={32} /></div>
              <div className="flex-1">
                <h3 className="text-xl font-bold tracking-tighter">Kassa tour</h3>
                <p className="text-slate-400 text-[10px] font-bold uppercase tracking-widest">Tour/Event modus</p>
              </div>
              <ChevronRight size={24} className="text-slate-200" />
            </button>
          </div>
          <button onClick={() => setIsAuthenticated(false)} className="w-full py-4 text-slate-400 font-bold uppercase text-[10px] tracking-[0.4em] hover:text-slate-950 transition-colors text-center">Afmelden</button>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 flex flex-col bg-slate-50 overflow-hidden font-sans select-none">
      
      {/* Visual Header Indicator */}
      <header className="h-16 bg-slate-950 flex items-center justify-between px-6 shrink-0 z-50">
         <div className="flex items-center gap-3">
            <div className={`w-3 h-3 rounded-full ${btConnected ? 'bg-emerald-500 animate-pulse shadow-[0_0_10px_rgba(16,185,129,0.8)]' : 'bg-rose-500 shadow-[0_0_10px_rgba(225,29,72,0.4)]'} transition-all duration-500`} />
            <span className="text-white font-black text-[10px] uppercase tracking-[0.2em]">{activeMode} {btConnected ? '- PRINTER OK' : '- PRINTER NO'}</span>
         </div>
         <div className="flex items-center gap-4">
            {isSyncing && <Loader2 size={16} className="text-slate-500 animate-spin" />}
            <button onClick={() => setActiveMode(null)} className="text-slate-400 hover:text-white"><RefreshCcw size={18} /></button>
         </div>
      </header>

      {/* Tabs */}
      <nav className="h-20 bg-white border-b border-slate-100 flex items-center justify-around shrink-0 z-40">
        <button onClick={() => requestTabChange('POS')} className={`flex flex-col items-center justify-center h-full transition-all gap-1 px-4 ${activeTab === 'POS' ? themeAccent : 'text-slate-400'}`}>
          <ShoppingBag size={22} strokeWidth={activeTab === 'POS' ? 2.5 : 2} />
          <span className="text-[9px] font-extrabold uppercase tracking-widest">Kassa</span>
        </button>
        <button onClick={() => requestTabChange('REPORTS')} className={`flex flex-col items-center justify-center h-full transition-all gap-1 px-4 ${activeTab === 'REPORTS' ? themeAccent : 'text-slate-400'}`}>
          <BarChart3 size={22} strokeWidth={activeTab === 'REPORTS' ? 2.5 : 2} />
          <span className="text-[9px] font-extrabold uppercase tracking-widest">Rapport</span>
        </button>
        <button onClick={() => requestTabChange('SETTINGS')} className={`flex flex-col items-center justify-center h-full transition-all gap-1 px-4 ${activeTab === 'SETTINGS' ? themeAccent : 'text-slate-400'}`}>
          <Settings size={22} strokeWidth={activeTab === 'SETTINGS' ? 2.5 : 2} />
          <span className="text-[9px] font-extrabold uppercase tracking-widest">Beheer</span>
        </button>
      </nav>

      <main className="flex-1 overflow-hidden flex flex-col relative">
        {isInitialLoading && (
          <div className="absolute inset-0 bg-slate-50/90 backdrop-blur-md z-[200] flex flex-col items-center justify-center gap-5">
             <Loader2 size={48} className={`animate-spin ${themeAccent}`} />
             <span className="text-[12px] font-bold uppercase tracking-[0.4em] text-slate-400">Database laden...</span>
          </div>
        )}

        {activeTab === 'POS' && (
          <div className="h-full flex flex-col">
            {!currentSession ? (
              <div className="flex-1 flex items-center justify-center p-6 bg-slate-50">
                <div className="bg-white p-10 rounded-[3rem] shadow-2xl border border-slate-100 text-center max-w-sm w-full animate-in zoom-in-95">
                   <div className={`w-16 h-16 ${activeMode === 'SHOP' ? 'bg-amber-100 text-amber-600' : 'bg-indigo-100 text-indigo-600'} rounded-3xl flex items-center justify-center mx-auto mb-8 shadow-inner`}><PlayCircle size={32} /></div>
                   <h3 className="font-black text-2xl mb-2 tracking-tighter text-slate-900">{activeMode} Sessie</h3>
                   <div className="mb-10 text-left space-y-3">
                     <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block text-center">Startbedrag cash (€)</label>
                     <input type="number" value={startFloatAmount} onChange={e=>setStartFloatAmount(e.target.value)} className="w-full bg-slate-50 border-2 border-slate-100 p-6 rounded-3xl text-center font-black text-3xl outline-none focus:border-slate-900 shadow-inner transition-all" />
                   </div>
                   <button onClick={() => {
                     const now = Date.now();
                     const newSession: SalesSession = { id: `SES-${now}`, startTime: now, startCash: parseFloat(startFloatAmount) || 0, status: 'OPEN', updatedAt: now };
                     setCurrentSession(newSession);
                     const updatedS = [newSession, ...sessions];
                     setSessions(updatedS);
                     apiService.saveSessions(updatedS);
                   }} className="w-full bg-slate-950 text-white py-6 rounded-[2rem] font-black uppercase text-sm tracking-[0.2em] shadow-2xl active:scale-95 transition-all">Sessie Openen</button>
                </div>
              </div>
            ) : (
              <>
                <div className="h-[38%] bg-white border-b border-slate-200 flex flex-col shrink-0 overflow-hidden shadow-sm relative">
                   <div className="px-6 py-4 bg-slate-50/50 backdrop-blur border-b border-slate-100 flex justify-between items-center shrink-0">
                      <button onClick={() => setShowSalesmanSelection(true)} className={`flex items-center gap-2.5 px-5 py-2.5 rounded-full border-2 transition-all text-[11px] font-bold uppercase tracking-tight shadow-sm ${company.sellerName ? `bg-white border-slate-900 text-slate-900` : 'bg-white border-slate-200 text-slate-400'}`}>
                        <User size={14} className={company.sellerName ? themeAccent : 'text-slate-300'}/> {company.sellerName || "Verkoper"} <ChevronDown size={14}/>
                      </button>
                      <button onClick={()=>setCart([])} className="p-2.5 text-slate-300 hover:text-red-500 transition-colors"><Trash2 size={22}/></button>
                   </div>
                   <div className="flex-1 overflow-y-auto p-4 space-y-2 bg-white custom-scrollbar">
                     {cart.length === 0 ? (
                       <div className="h-full flex flex-col items-center justify-center opacity-[0.05] grayscale"><ShoppingBag size={80}/><span className="text-[14px] font-black mt-4 uppercase tracking-[0.5em]">Leeg Ticket</span></div>
                     ) : cart.map(item => (
                       <div key={item.id} className="flex items-center justify-between p-4 bg-white rounded-[1.25rem] border border-slate-100 shadow-sm animate-in slide-in-from-bottom">
                         <div className="flex-1 min-w-0 pr-4 text-left">
                           <div className="font-black text-[13px] truncate text-slate-900 tracking-tight">{item.name}</div>
                           <div className="text-[10px] text-slate-400 font-bold font-mono">€{item.price.toFixed(2)}</div>
                         </div>
                         <div className="flex items-center gap-3 bg-slate-50 p-1.5 rounded-full border border-slate-200">
                           <button onClick={()=>{
                             const i = cart.find(x => x.id === item.id);
                             if (i?.quantity === 1) setCart(cart.filter(x => x.id !== item.id));
                             else setCart(cart.map(x => x.id === item.id ? {...x, quantity: x.quantity - 1} : x));
                           }} className="w-8 h-8 bg-white rounded-full flex items-center justify-center text-slate-400"><Minus size={14}/></button>
                           <span className="font-black text-[13px] w-5 text-center text-slate-900 font-mono">{item.quantity}</span>
                           <button onClick={()=>addToCart(item)} className="w-8 h-8 bg-white rounded-full flex items-center justify-center text-slate-400"><Plus size={14}/></button>
                         </div>
                       </div>
                     ))}
                   </div>
                </div>
                
                <div className="flex-1 overflow-y-auto p-4 bg-slate-50 custom-scrollbar">
                   <div className="grid grid-cols-4 gap-3 pb-8">
                      {products.map(p => (
                        <button key={p.id} onClick={() => addToCart(p)} className={`${p.color || 'bg-white'} rounded-[1.5rem] border border-black/5 pos-shadow flex flex-col items-center justify-center text-center p-3 h-28 transition-all active:scale-90 hover:brightness-95`}>
                          <span className="text-[10px] font-black leading-tight mb-2 line-clamp-2 text-slate-900">{p.name}</span>
                          <span className="text-slate-950 bg-white/90 px-3 py-1 rounded-full text-[11px] font-black shadow-sm font-mono">€{p.price.toFixed(2)}</span>
                        </button>
                      ))}
                   </div>
                </div>

                <div className="bg-slate-950 text-white p-6 pb-8 space-y-5 shrink-0 shadow-[0_-20px_50px_rgba(0,0,0,0.3)] rounded-t-[3rem] border-t border-white/5">
                  <div className="flex justify-between items-center px-2">
                    <div className="flex flex-col">
                       <span className="text-slate-500 text-[10px] font-black uppercase tracking-[0.2em]">Totaalbedrag</span>
                       {cart.length > 0 && <span className="text-[10px] text-slate-400 font-mono">Excl. BTW €{totals.net.toFixed(2)}</span>}
                    </div>
                    <span className={`text-4xl font-black tracking-tighter ${themeAccent} drop-shadow-[0_0_15px_rgba(255,255,255,0.1)] font-mono`}>€{totals.total.toFixed(2)}</span>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <button disabled={cart.length===0} onClick={()=>finalizePayment(PaymentMethod.CASH)} className="bg-emerald-500 text-white h-16 rounded-[1.5rem] flex items-center justify-center gap-3 font-black text-xs uppercase shadow-xl shadow-emerald-500/10"><Banknote size={24}/> <span>Contant</span></button>
                    <button disabled={cart.length===0} onClick={() => setShowCardPrompt(true)} className="bg-blue-600 text-white h-16 rounded-[1.5rem] flex items-center justify-center gap-3 font-black text-xs uppercase shadow-xl shadow-blue-600/10"><CreditCard size={24}/> <span>Kaart</span></button>
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
                    <h2 className="text-3xl font-black tracking-tighter text-slate-950">Rapportage</h2>
                    <p className="text-slate-400 text-[10px] font-bold uppercase tracking-[0.3em]">Overzicht & Geschiedenis</p>
                 </div>
                 <button 
                  onClick={handleGetAIInsight} 
                  disabled={isGeneratingInsight}
                  className="bg-indigo-600 text-white p-4 rounded-2xl shadow-xl flex items-center gap-2 font-black text-[10px] uppercase tracking-widest disabled:opacity-50 active:scale-95 transition-all"
                 >
                   {isGeneratingInsight ? <Loader2 size={18} className="animate-spin"/> : <Sparkles size={18}/>}
                   AI Analyse
                 </button>
              </div>

              {aiInsight && (
                <div className="bg-indigo-50 border border-indigo-100 p-8 rounded-[2.5rem] space-y-4 animate-in zoom-in-95 relative overflow-hidden group">
                  <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity"><Sparkles size={120} className="text-indigo-900"/></div>
                  <div className="flex justify-between items-center relative z-10">
                    <h3 className="font-black text-xs uppercase tracking-widest text-indigo-600 flex items-center gap-2"><FileText size={16}/> Gemini Business Insight</h3>
                    <button onClick={() => setAiInsight(null)} className="text-indigo-300 hover:text-indigo-600"><X size={18}/></button>
                  </div>
                  <div className="prose prose-sm prose-indigo max-w-none text-indigo-900 font-medium leading-relaxed relative z-10">
                     {aiInsight.split('\n').map((line, i) => (
                       <p key={i} className="mb-2 last:mb-0">
                         {line.startsWith('**') ? <strong className="font-black text-indigo-950">{line.replace(/\*\*/g, '')}</strong> : line}
                       </p>
                     ))}
                  </div>
                </div>
              )}
              
              <div className="space-y-4">
                 <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-2">Actieve Sessie</h3>
                 {currentSession ? (
                    <div className="bg-white p-8 rounded-[2.5rem] shadow-xl border-l-[12px] border-amber-500 space-y-8 animate-in slide-in-from-bottom">
                       <div className="flex justify-between items-start">
                          <div>
                             <h3 className="font-black text-xs uppercase tracking-widest text-amber-600 flex items-center gap-2">
                               <div className="w-2 h-2 rounded-full bg-amber-500 animate-pulse"></div> Live Shift
                             </h3>
                             <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-1">Gestart: {new Date(currentSession.startTime).toLocaleString('nl-NL')}</p>
                          </div>
                          <button onClick={() => setIsClosingSession(true)} className="bg-rose-500 text-white px-6 py-3 rounded-2xl font-black text-xs uppercase shadow-xl active:scale-95 transition-all">Sessie Sluiten</button>
                       </div>
                       <div className="grid grid-cols-3 gap-4 border-t border-slate-50 pt-6">
                          <div className="flex flex-col">
                             <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Huidige Verkoop</span>
                             <span className="font-black text-lg text-slate-900 font-mono">€{transactions.filter(t => t.sessionId === (currentSession?.id || '')).reduce((s,t)=>s+t.total, 0).toFixed(2)}</span>
                          </div>
                          <div className="flex flex-col">
                             <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Tickets</span>
                             <span className="font-black text-lg text-slate-900 font-mono">{transactions.filter(t => t.sessionId === (currentSession?.id || '')).length}</span>
                          </div>
                          <div className="flex flex-col">
                             <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest">In Kas (Verwacht)</span>
                             <span className="font-black text-lg text-slate-900 font-mono">€{((currentSession?.startCash || 0) + transactions.filter(t => t.sessionId === (currentSession?.id || '') && t.paymentMethod === PaymentMethod.CASH).reduce((s,t)=>s+t.total, 0)).toFixed(2)}</span>
                          </div>
                       </div>
                    </div>
                 ) : (
                    <div className="bg-white/50 border-2 border-dashed border-slate-200 p-8 rounded-[2.5rem] flex flex-col items-center justify-center text-center gap-3">
                       <Clock size={24} className="text-slate-300" />
                       <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Geen sessie actief</span>
                    </div>
                 )}
              </div>

              <div className="space-y-6">
                 <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-2">Sessie Historiek</h3>
                 <div className="space-y-4">
                    {sessions.filter(s => s.status === 'CLOSED').length === 0 ? (
                       <div className="text-center py-12 text-slate-300 italic text-sm">Nog geen gesloten sessies</div>
                    ) : (
                       sessions
                        .filter(s => s.status === 'CLOSED')
                        .sort((a,b) => (b.endTime || 0) - (a.endTime || 0))
                        .map(session => (
                           <div key={session.id} className="bg-white p-6 rounded-[2rem] shadow-sm border border-slate-100 space-y-4 hover:shadow-md transition-all group">
                              <div className="flex justify-between items-start">
                                 <div className="flex items-center gap-4">
                                    <div className="w-12 h-12 rounded-2xl bg-slate-50 flex items-center justify-center text-slate-400">
                                       <Calendar size={20} />
                                    </div>
                                    <div>
                                       <h4 className="font-black text-sm text-slate-900">{new Date(session.endTime || Date.now()).toLocaleDateString('nl-NL')}</h4>
                                       <p className="text-[9px] text-slate-400 font-bold uppercase tracking-widest">
                                          {new Date(session.startTime).toLocaleTimeString('nl-NL', {hour:'2-digit', minute:'2-digit'})} - {new Date(session.endTime || Date.now()).toLocaleTimeString('nl-NL', {hour:'2-digit', minute:'2-digit'})}
                                       </p>
                                    </div>
                                 </div>
                                 <button 
                                    onClick={() => setPreviewSession(session)}
                                    className="flex items-center gap-2 bg-slate-950 text-white px-4 py-2.5 rounded-xl font-black text-[9px] uppercase tracking-widest active:scale-95 transition-all shadow-lg group-hover:bg-indigo-600"
                                 >
                                    <Eye size={12}/> Bekijk Rapport
                                 </button>
                              </div>
                              <div className="grid grid-cols-4 gap-2 pt-2 border-t border-slate-50">
                                 <div className="bg-slate-50/50 p-3 rounded-xl flex flex-col border border-slate-100">
                                    <span className="text-[7px] font-black text-slate-400 uppercase tracking-widest">Totaal</span>
                                    <span className="font-bold text-xs text-slate-900 font-mono">€{(session.summary?.totalSales || 0).toFixed(2)}</span>
                                 </div>
                                 <div className="bg-slate-50/50 p-3 rounded-xl flex flex-col border border-slate-100">
                                    <span className="text-[7px] font-black text-slate-400 uppercase tracking-widest">Cash</span>
                                    <span className="font-bold text-xs text-slate-900 font-mono">€{(session.summary?.cashTotal || 0).toFixed(2)}</span>
                                 </div>
                                 <div className="bg-slate-50/50 p-3 rounded-xl flex flex-col border border-slate-100">
                                    <span className="text-[7px] font-black text-slate-400 uppercase tracking-widest">Kaart</span>
                                    <span className="font-bold text-xs text-slate-900 font-mono">€{(session.summary?.cardTotal || 0).toFixed(2)}</span>
                                 </div>
                                 <div className="bg-slate-50/50 p-3 rounded-xl flex flex-col border border-slate-100">
                                    <span className="text-[7px] font-black text-slate-400 uppercase tracking-widest">Tickets</span>
                                    <span className="font-bold text-xs text-slate-900 font-mono">{session.summary?.transactionCount || 0}</span>
                                 </div>
                              </div>
                           </div>
                        ))
                    )}
                 </div>
              </div>
           </div>
        )}

        {activeTab === 'SETTINGS' && (
          <div className="h-full overflow-y-auto p-6 space-y-12 bg-slate-50 custom-scrollbar pb-32">
             <div className="flex justify-between items-end px-2">
                <div>
                  <h2 className="text-3xl font-black tracking-tighter text-slate-950">Beheer</h2>
                  <p className="text-slate-400 text-[10px] font-bold uppercase tracking-[0.3em]">Instellingen & Assortiment</p>
                </div>
                <div className="flex gap-3">
                   <button onClick={loadContextData} className="w-12 h-12 bg-white border border-slate-200 text-slate-400 rounded-2xl flex items-center justify-center shadow-sm active:rotate-180 transition-all duration-500"><RefreshCcw size={20}/></button>
                   <button onClick={forceSync} disabled={isSyncing} className={`w-12 h-12 rounded-2xl flex items-center justify-center transition-all ${isSyncing ? 'bg-emerald-500 text-white shadow-emerald-500/20' : 'bg-white border border-slate-200 text-slate-400'}`}>
                      {isSyncing ? <Loader2 size={20} className="animate-spin" /> : <Save size={20}/>}
                   </button>
                   <button onClick={() => setIsAuthenticated(false)} className="bg-white border border-slate-200 text-slate-400 w-12 h-12 rounded-2xl flex items-center justify-center shadow-sm"><LogOut size={20}/></button>
                </div>
             </div>

             <div className="bg-white p-8 rounded-[2.5rem] shadow-sm border border-slate-100 space-y-8 animate-in zoom-in-95">
                <div className="flex items-center gap-4 border-b border-slate-50 pb-6">
                   <div className="w-12 h-12 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center shadow-inner">
                      <Building2 size={24} />
                   </div>
                   <div>
                      <h3 className="font-black text-[12px] uppercase tracking-widest text-slate-900">Bedrijfsgegevens</h3>
                      <p className="text-[9px] text-slate-400 font-bold uppercase tracking-widest">Opmaak van het ticket</p>
                   </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                   <div className="space-y-2">
                      <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Bedrijfsnaam</label>
                      <input type="text" value={company.name} onChange={e=>setCompany({...company, name: e.target.value})} className="w-full bg-slate-50 border-2 border-slate-100 p-4 rounded-2xl font-bold text-sm outline-none focus:border-slate-900 transition-all" />
                   </div>
                   <div className="space-y-2">
                      <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest">BTW Nummer</label>
                      <input type="text" value={company.vatNumber} onChange={e=>setCompany({...company, vatNumber: e.target.value})} className="w-full bg-slate-50 border-2 border-slate-100 p-4 rounded-2xl font-bold text-sm outline-none focus:border-slate-900 transition-all" />
                   </div>
                   <div className="space-y-2">
                      <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Adres Lijn 1</label>
                      <input type="text" value={company.address} onChange={e=>setCompany({...company, address: e.target.value})} className="w-full bg-slate-50 border-2 border-slate-100 p-4 rounded-2xl font-bold text-sm outline-none focus:border-slate-900 transition-all" />
                   </div>
                   <div className="space-y-2">
                      <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Adres Lijn 2</label>
                      <input type="text" value={company.address2 || ''} onChange={e=>setCompany({...company, address2: e.target.value})} className="w-full bg-slate-50 border-2 border-slate-100 p-4 rounded-2xl font-bold text-sm outline-none focus:border-slate-900 transition-all" />
                   </div>
                   <div className="space-y-2">
                      <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Website</label>
                      <div className="relative">
                        <Globe size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" />
                        <input type="text" value={company.website || ''} onChange={e=>setCompany({...company, website: e.target.value})} className="w-full bg-slate-50 border-2 border-slate-100 p-4 pl-12 rounded-2xl font-bold text-sm outline-none focus:border-slate-900 transition-all" />
                      </div>
                   </div>
                   <div className="space-y-2">
                      <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Bon Tekst (Footer)</label>
                      <div className="relative">
                        <MessageSquare size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" />
                        <input type="text" value={company.footerMessage} onChange={e=>setCompany({...company, footerMessage: e.target.value})} className="w-full bg-slate-50 border-2 border-slate-100 p-4 pl-12 rounded-2xl font-bold text-sm outline-none focus:border-slate-900 transition-all" />
                      </div>
                   </div>
                </div>
             </div>

             <div className="bg-white p-8 rounded-[2.5rem] shadow-sm border border-slate-100 space-y-8 animate-in zoom-in-95">
                <div className="flex items-center gap-4 border-b border-slate-50 pb-6">
                   <div className="w-12 h-12 rounded-2xl bg-orange-50 text-orange-600 flex items-center justify-center shadow-inner">
                      <User size={24} />
                   </div>
                   <div>
                      <h3 className="font-black text-[12px] uppercase tracking-widest text-slate-900">Beheer Verkopers</h3>
                      <p className="text-[9px] text-slate-400 font-bold uppercase tracking-widest">Lijst van personeel</p>
                   </div>
                </div>
                
                <div className="space-y-4">
                  <div className="flex gap-3">
                    <input 
                      type="text" 
                      placeholder="Naam verkoper..." 
                      value={newSalesmanName}
                      onChange={e => setNewSalesmanName(e.target.value)}
                      onKeyDown={e => e.key === 'Enter' && addSalesman()}
                      className="flex-1 bg-slate-50 border-2 border-slate-100 p-4 rounded-2xl font-bold text-sm outline-none focus:border-orange-500 transition-all"
                    />
                    <button onClick={addSalesman} className="bg-orange-500 text-white w-14 h-14 rounded-2xl flex items-center justify-center shadow-lg active:scale-90 transition-all">
                      <Plus size={24}/>
                    </button>
                  </div>
                  
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {(company.salesmen || []).map(name => (
                      <div key={name} className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl border border-slate-100">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 bg-orange-100 text-orange-600 rounded-full flex items-center justify-center font-black text-xs">{name.charAt(0).toUpperCase()}</div>
                          <span className="font-bold text-sm text-slate-700">{name}</span>
                        </div>
                        <button onClick={() => deleteSalesman(name)} className="p-2 text-slate-300 hover:text-rose-500 transition-colors">
                          <Trash2 size={18}/>
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
             </div>

             <div className="bg-white p-8 rounded-[2.5rem] shadow-sm border border-slate-100 space-y-8 animate-in zoom-in-95">
                <div className="flex items-center gap-4 border-b border-slate-50 pb-6">
                   <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shadow-inner ${btConnected ? 'bg-emerald-50 text-emerald-600' : 'bg-slate-50 text-slate-400'}`}>
                      <Bluetooth size={24} className={btConnected ? 'animate-pulse' : ''}/>
                   </div>
                   <div>
                      <h3 className="font-black text-[12px] uppercase tracking-widest text-slate-900">Printer Koppeling</h3>
                      <p className="text-[9px] text-slate-400 font-bold uppercase tracking-widest">Bluetooth Thermische Printer</p>
                   </div>
                </div>
                {btConnected ? (
                  <div className="bg-emerald-50/50 p-6 rounded-[2rem] border border-emerald-100 flex items-center justify-between">
                     <div className="flex items-center gap-5">
                        <div className="w-14 h-14 bg-emerald-500 text-white rounded-full flex items-center justify-center shadow-xl shadow-emerald-500/20"><BluetoothConnected size={28}/></div>
                        <div>
                           <div className="text-sm font-black text-emerald-950">Verbonden</div>
                           <div className="text-[10px] text-emerald-600 font-bold uppercase tracking-widest font-mono truncate max-w-[120px]">{btPrinterService.getDeviceName()}</div>
                        </div>
                     </div>
                     <div className="flex gap-3">
                       <button onClick={() => btPrinterService.testPrint()} className="w-12 h-12 bg-white text-emerald-600 rounded-2xl border border-emerald-200 shadow-sm flex items-center justify-center active:scale-90 transition-all"><Printer size={20}/></button>
                       <button onClick={handleDisconnectPrinter} className="w-12 h-12 bg-rose-50 text-rose-600 rounded-2xl border border-rose-100 shadow-sm flex items-center justify-center active:scale-90 transition-all"><Trash2 size={20}/></button>
                     </div>
                  </div>
                ) : (
                  <button 
                    onClick={handleConnectPrinter} 
                    disabled={isConnectingPrinter}
                    className="w-full bg-slate-950 text-white py-6 rounded-[2rem] font-black uppercase text-xs tracking-[0.2em] shadow-2xl flex items-center justify-center gap-4 active:scale-95 disabled:opacity-50 transition-all"
                  >
                    {isConnectingPrinter ? <Loader2 size={22} className="animate-spin"/> : <Bluetooth size={22}/>}
                    {isConnectingPrinter ? 'Zoeken...' : 'Printer Instellen'}
                  </button>
                )}
             </div>

             <div className="space-y-10">
                <div className="flex items-center gap-3 px-4">
                  <div className="w-10 h-10 bg-slate-900 rounded-2xl flex items-center justify-center text-white shadow-xl"><Layers size={20}/></div>
                  <h3 className="font-black text-xl tracking-tight text-slate-900">Productenbeheer</h3>
                </div>
                
                <div className="space-y-12">
                  {products.map(p => (
                    <div key={p.id} className="p-8 bg-white rounded-[3.5rem] border border-slate-100 flex flex-col gap-10 shadow-[0_25px_60px_-15px_rgba(0,0,0,0.08)] relative animate-in zoom-in-95 overflow-hidden">
                       <div className="flex items-start justify-between gap-6 relative z-10">
                          <div className="flex-1">
                             <div className="flex items-center gap-2 mb-3">
                                <Tag size={14} className="text-slate-400"/>
                                <label className="text-[9px] font-black text-slate-400 uppercase tracking-[0.2em]">Product Naam</label>
                             </div>
                             <input 
                               type="text" 
                               value={p.name} 
                               onChange={e=>updateProduct(p.id,'name',e.target.value)} 
                               className="w-full bg-transparent font-black text-3xl outline-none text-slate-900 tracking-tighter border-b-2 border-slate-100 focus:border-slate-900 transition-all pb-3" 
                             />
                          </div>
                          <button onClick={()=>deleteProduct(p.id)} className="bg-rose-50 text-rose-500 w-14 h-14 rounded-[1.75rem] flex items-center justify-center hover:bg-rose-500 hover:text-white transition-all active:scale-90 shadow-sm border border-rose-100/50"><Trash2 size={24}/></button>
                       </div>

                       <div className="grid grid-cols-2 gap-6 relative z-10">
                          <div className="bg-slate-50 p-6 rounded-[2.5rem] border border-slate-100 flex flex-col items-center shadow-inner transition-all hover:bg-white hover:shadow-lg">
                             <div className="flex items-center gap-2 mb-4">
                                <Euro size={16} className="text-emerald-500" strokeWidth={3}/>
                                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Prijs</span>
                             </div>
                             <div className="relative flex items-center w-full justify-center">
                                <span className="text-slate-300 font-black text-xl mr-2">€</span>
                                <input 
                                  type="number" step="0.01" value={p.price} 
                                  onChange={e=>updateProduct(p.id,'price',parseFloat(e.target.value) || 0)} 
                                  className="w-full bg-transparent font-black text-center text-4xl outline-none text-slate-900 font-mono tracking-tighter" 
                                />
                             </div>
                          </div>

                          <div className="bg-slate-50 p-6 rounded-[2.5rem] border border-slate-100 flex flex-col items-center shadow-inner transition-all hover:bg-white hover:shadow-lg">
                             <div className="flex items-center gap-2 mb-4">
                                <Package size={16} className="text-blue-500" strokeWidth={3}/>
                                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Stock</span>
                             </div>
                             <input 
                               type="number" value={p.stock || 0} 
                               onChange={e=>updateProduct(p.id,'stock',parseInt(e.target.value) || 0)} 
                               className="w-full bg-transparent font-black text-center text-4xl outline-none text-slate-900 font-mono tracking-tighter" 
                             />
                          </div>
                       </div>

                       <div className="space-y-4 relative z-10">
                          <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] block text-center">BTW Selectie</label>
                          <div className="grid grid-cols-2 gap-4 bg-slate-50 p-2 rounded-[2.5rem] border border-slate-100">
                             <button 
                               onClick={() => updateProduct(p.id, 'vatRate', 0)}
                               className={`py-6 rounded-[2rem] font-black text-xl transition-all flex items-center justify-center gap-3 ${p.vatRate === 0 ? 'bg-slate-900 text-white shadow-xl scale-[1.02]' : 'bg-transparent text-slate-400 hover:text-slate-600'}`}
                             >
                                <Percent size={20} strokeWidth={3}/> 0%
                             </button>
                             <button 
                               onClick={() => updateProduct(p.id, 'vatRate', 21.5)}
                               className={`py-6 rounded-[2rem] font-black text-xl transition-all flex items-center justify-center gap-3 ${p.vatRate > 0 ? 'bg-slate-900 text-white shadow-xl scale-[1.02]' : 'bg-transparent text-slate-400 hover:text-slate-600'}`}
                             >
                                <Percent size={20} strokeWidth={3}/> {p.vatRate > 0 ? p.vatRate.toString().replace('.', ',') : '21,5'}%
                             </button>
                          </div>
                       </div>

                       <div className="space-y-6 relative z-10">
                          <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em] block text-center">Knop Kleur</label>
                          <div className="flex justify-between items-center bg-slate-50/50 p-4 rounded-[2rem] border border-slate-100 max-w-md mx-auto w-full">
                             {AVAILABLE_COLORS.map(colorClass => (
                               <button 
                                 key={colorClass}
                                 onClick={() => updateProduct(p.id, 'color', colorClass)}
                                 className={`w-12 h-12 rounded-full border-4 transition-all ${colorClass} ${p.color === colorClass ? 'border-slate-900 scale-110 shadow-xl' : 'border-white shadow-sm hover:scale-105'}`}
                               />
                             ))}
                          </div>
                       </div>
                    </div>
                  ))}

                  <div className="relative pt-6 pb-24 overflow-hidden -mx-6 px-6 group">
                     <div className="absolute inset-0 bg-gradient-to-t from-slate-50 via-slate-50/95 to-transparent z-20 pointer-events-none h-64 bottom-0" />
                     <button 
                       onClick={addProduct}
                       disabled={products.length >= 10}
                       className="w-full bg-slate-200/50 border-4 border-dashed border-slate-300 py-24 rounded-[4rem] flex flex-col items-center justify-center gap-5 transition-all hover:bg-slate-300/50 active:scale-95 disabled:opacity-20 translate-y-16 hover:translate-y-10 relative z-10"
                     >
                       <div className="bg-white p-6 rounded-full shadow-2xl text-slate-900"><Plus size={40} strokeWidth={3}/></div>
                       <div className="space-y-1">
                          <span className="font-black text-[14px] uppercase tracking-[0.4em] text-slate-600">Artikel Toevoegen</span>
                          <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">{products.length}/10 slots gebruikt</p>
                       </div>
                     </button>
                  </div>
                </div>
             </div>

             <div className="bg-white p-8 rounded-[2.5rem] shadow-sm border border-slate-100 space-y-8">
                <div className="flex items-center gap-4 border-b border-slate-50 pb-6">
                   <div className="w-12 h-12 bg-indigo-50 rounded-2xl flex items-center justify-center shadow-inner text-indigo-600"><Database size={24}/></div>
                   <div>
                      <h3 className="font-black text-[12px] uppercase tracking-widest text-slate-900">Systeem Backup</h3>
                   </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <button onClick={downloadFullBackup} className="flex items-center justify-center gap-3 bg-slate-900 text-white py-5 rounded-[1.5rem] font-black text-[11px] uppercase tracking-widest shadow-lg"><Download size={18}/> Export</button>
                  <button onClick={() => fileInputRef.current?.click()} className="flex items-center justify-center gap-3 bg-white border-2 border-slate-900 text-slate-900 py-5 rounded-[1.5rem] font-black text-[11px] uppercase tracking-widest"><Upload size={18}/> Import</button>
                  <input type="file" ref={fileInputRef} onChange={handleImportBackup} accept=".json" className="hidden" />
                </div>
             </div>
          </div>
        )}
      </main>

      {/* MODALS */}
      {showTabLeaveWarning && (
        <div className="fixed inset-0 z-[1200] flex items-center justify-center bg-slate-950/90 backdrop-blur-2xl p-6 animate-in fade-in">
           <div className="bg-white rounded-[3rem] shadow-2xl w-full max-w-sm p-10 flex flex-col items-center text-center gap-8 animate-in zoom-in-95">
              <div className="w-20 h-20 bg-amber-50 text-amber-500 rounded-[2rem] flex items-center justify-center border border-amber-100"><HelpCircle size={40}/></div>
              <div className="space-y-3">
                <h3 className="font-black text-2xl tracking-tight text-slate-900">Sessie Actief</h3>
                <p className="text-[11px] text-slate-400 font-bold uppercase tracking-widest leading-relaxed">U verlaat de kassa. Wilt u de huidige sessie eerst afsluiten?</p>
              </div>
              <div className="w-full space-y-4">
                <button 
                  onClick={() => {
                    setShowTabLeaveWarning(false);
                    setIsClosingSession(true);
                  }}
                  className="w-full bg-slate-950 text-white py-5 rounded-[1.5rem] font-black uppercase text-xs tracking-[0.2em] shadow-2xl active:scale-95 transition-all"
                >
                  Sessie Afsluiten
                </button>
                <button 
                  onClick={() => {
                    setShowTabLeaveWarning(false);
                    if (pendingTab) setActiveTab(pendingTab);
                    setPendingTab(null);
                  }}
                  className="w-full bg-slate-50 text-slate-900 border border-slate-200 py-5 rounded-[1.5rem] font-black uppercase text-xs tracking-[0.2em] active:scale-95 transition-all"
                >
                  Sessie Open Houden
                </button>
                <button 
                  onClick={() => {
                    setShowTabLeaveWarning(false);
                    setPendingTab(null);
                  }}
                  className="w-full py-4 text-slate-400 font-bold uppercase text-[10px] tracking-[0.3em] hover:text-slate-900"
                >
                  In Kassa Blijven
                </button>
              </div>
           </div>
        </div>
      )}

      {showSuccess && (
        <div className="fixed inset-0 z-[1100] flex items-center justify-center p-6 pointer-events-none">
           <div className="bg-emerald-600 text-white px-16 py-10 rounded-[4rem] shadow-2xl flex flex-col items-center gap-6 animate-in zoom-in-95 border-[12px] border-white/20 backdrop-blur-xl">
              <CheckCircle size={80} strokeWidth={3} className="drop-shadow-lg"/>
              <span className="font-black text-2xl uppercase tracking-[0.3em]">Betaald</span>
           </div>
        </div>
      )}

      {showCardPrompt && (
        <div className="fixed inset-0 z-[1050] flex items-center justify-center bg-slate-950/90 backdrop-blur-2xl p-6 animate-in fade-in">
           <div className="bg-white rounded-[3rem] shadow-2xl w-full max-w-sm p-12 flex flex-col items-center text-center gap-10 animate-in zoom-in-95">
              <div className="w-24 h-24 bg-blue-50 text-blue-600 rounded-[2.5rem] flex items-center justify-center border border-blue-100 shadow-inner"><CreditCard size={48}/></div>
              <div className="space-y-3">
                 <h3 className="font-black text-2xl tracking-tight text-slate-900">Pinbetaling</h3>
                 <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Terminal Activeren</p>
              </div>
              <div className="text-5xl font-black text-slate-950 tracking-tighter font-mono">€{totals.total.toFixed(2)}</div>
              <button onClick={() => finalizePayment(PaymentMethod.CARD)} className={`w-full ${themeBg} text-white py-6 rounded-[2rem] font-black uppercase text-sm tracking-[0.2em] shadow-2xl shadow-blue-500/20 active:scale-95 transition-all`}>Geregistreerd</button>
              <button onClick={() => setShowCardPrompt(false)} className="w-full text-slate-400 font-bold uppercase text-[10px] tracking-[0.3em]">Annuleren</button>
           </div>
        </div>
      )}

      {isClosingSession && (
        <div className="fixed inset-0 z-[1200] flex items-center justify-center bg-slate-950/90 backdrop-blur-2xl p-6 animate-in fade-in">
           <div className="bg-white rounded-[3rem] shadow-2xl w-full max-w-sm p-10 flex flex-col items-center text-center gap-8 animate-in zoom-in-95">
              <div className="w-20 h-20 bg-rose-50 text-rose-500 rounded-[2rem] flex items-center justify-center border border-rose-100"><AlertCircle size={40}/></div>
              <div className="space-y-2">
                <h3 className="font-black text-2xl tracking-tight text-slate-900">Shift Beëindigen</h3>
                <p className="text-[11px] text-slate-400 font-bold uppercase tracking-widest">Controleer de lade inhoud</p>
              </div>
              <div className="w-full space-y-6">
                <div className="relative">
                   <span className="absolute left-8 top-1/2 -translate-y-1/2 font-black text-slate-300 text-2xl font-mono">€</span>
                   <input 
                    type="number" autoFocus placeholder="0.00" value={endCashInput}
                    onChange={e => setEndCashInput(e.target.value)}
                    className="w-full bg-slate-50 border-2 border-slate-100 py-8 px-14 rounded-[2rem] font-black text-4xl outline-none focus:border-rose-500 transition-all text-center font-mono shadow-inner"
                   />
                </div>
                <button 
                  onClick={() => closeSession(parseFloat(endCashInput) || 0)}
                  disabled={endCashInput === ''}
                  className="w-full bg-rose-500 text-white py-6 rounded-[2rem] font-black uppercase text-sm tracking-[0.2em] shadow-2xl active:scale-95 disabled:opacity-20 transition-all"
                >
                  Nu Afsluiten
                </button>
                <button 
                  onClick={() => {
                    setIsClosingSession(false);
                    setPendingTab(null);
                  }} 
                  className="w-full py-4 text-slate-400 font-bold uppercase text-[10px] tracking-[0.3em]"
                >
                  Annuleren
                </button>
              </div>
           </div>
        </div>
      )}

      {showSalesmanSelection && (
        <div className="fixed inset-0 z-[1000] flex items-center justify-center bg-slate-950/90 backdrop-blur-2xl p-6 animate-in fade-in">
          <div className="bg-white rounded-[3rem] shadow-2xl w-full max-w-sm overflow-hidden flex flex-col animate-in zoom-in-95">
            <div className="p-8 border-b border-slate-100 bg-slate-50 flex justify-between items-center">
              <h3 className="font-black text-xl tracking-tight text-slate-900">Verkoper</h3>
              <button onClick={() => setShowSalesmanSelection(false)} className="p-3 text-slate-400 hover:text-slate-900"><X size={28}/></button>
            </div>
            <div className="p-8 space-y-4 overflow-y-auto max-h-[60vh] bg-white custom-scrollbar">
              {(company.salesmen || []).map(name => (
                <button 
                  key={name} 
                  onClick={() => { setCompany(prev => ({ ...prev, sellerName: name, updatedAt: Date.now() })); setShowSalesmanSelection(false); }}
                  className={`w-full p-6 rounded-[2rem] border-2 font-black text-sm tracking-widest transition-all flex items-center justify-between shadow-sm ${company.sellerName === name ? `border-slate-950 bg-slate-50 text-slate-950` : 'border-slate-100 bg-white text-slate-400'}`}
                >
                  <div className="flex items-center gap-5">
                    <div className={`w-12 h-12 rounded-full flex items-center justify-center font-black text-lg ${company.sellerName === name ? `${themeBg} text-white` : 'bg-slate-100 text-slate-400'}`}>{name.charAt(0).toUpperCase()}</div>
                    {name}
                  </div>
                  {company.sellerName === name && <Check size={24} strokeWidth={4} className={themeAccent} />}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {previewTransaction && (
        <div className="fixed inset-0 z-[1100] bg-slate-950/95 flex flex-col items-center justify-center p-6 backdrop-blur-xl animate-in fade-in">
           <div className="bg-white rounded-[3rem] max-w-xs w-full overflow-hidden shadow-2xl flex flex-col animate-in zoom-in-95 border-8 border-white">
              <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50/50 backdrop-blur">
                <h3 className="font-bold text-[10px] uppercase tracking-[0.3em] text-slate-400">Bon Voorbeeld</h3>
                <button onClick={() => setPreviewTransaction(null)} className="p-2 text-slate-400 hover:text-slate-950"><X size={22}/></button>
              </div>
              <div className="flex-1 overflow-y-auto p-8 flex justify-center bg-white custom-scrollbar">
                <Receipt preview transaction={previewTransaction} company={company} />
              </div>
              <div className="p-8 bg-slate-50 border-t border-slate-100">
                <button onClick={() => setPreviewTransaction(null)} className="w-full bg-slate-950 text-white py-5 rounded-[1.5rem] font-black uppercase text-[11px] tracking-[0.4em] active:scale-95 transition-all">Sluiten</button>
              </div>
           </div>
        </div>
      )}

      {previewSession && (
        <div className="fixed inset-0 z-[1100] bg-slate-950/95 flex flex-col items-center justify-center p-6 backdrop-blur-xl animate-in fade-in">
           <div className="bg-white rounded-[3rem] max-w-md w-full overflow-hidden shadow-2xl flex flex-col animate-in zoom-in-95 border-8 border-white max-h-[90vh]">
              <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50/50 backdrop-blur shrink-0">
                <div className="flex items-center gap-2">
                  <BarChart3 size={18} className="text-slate-400"/>
                  <h3 className="font-bold text-[10px] uppercase tracking-[0.3em] text-slate-400">Rapport Preview</h3>
                </div>
                <button onClick={() => setPreviewSession(null)} className="p-2 text-slate-400 hover:text-slate-950"><X size={22}/></button>
              </div>
              <div className="flex-1 overflow-y-auto p-8 bg-white custom-scrollbar space-y-8">
                <div className="text-center space-y-1">
                  <h4 className="font-black text-xl uppercase tracking-widest">{company.name}</h4>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Sessie Rapportage</p>
                </div>
                
                <div className="grid grid-cols-2 gap-4 border-y border-slate-100 py-6">
                   <div>
                     <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest block mb-1">Periode</span>
                     <p className="font-bold text-xs">{new Date(previewSession.startTime).toLocaleString('nl-NL', {month:'short', day:'numeric', hour:'2-digit', minute:'2-digit'})} - {previewSession.endTime ? new Date(previewSession.endTime).toLocaleTimeString('nl-NL', {hour:'2-digit', minute:'2-digit'}) : 'Open'}</p>
                   </div>
                   <div className="text-right">
                     <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest block mb-1">Tickets</span>
                     <p className="font-bold text-xs">{previewSession.summary?.transactionCount || 0}</p>
                   </div>
                </div>

                <div className="space-y-4">
                  <h5 className="text-[10px] font-black text-slate-900 uppercase tracking-[0.2em] border-b border-slate-50 pb-2">Financieel</h5>
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-slate-400 font-medium">Totale Omzet</span>
                      <span className="font-black">€{(previewSession.summary?.totalSales || 0).toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between text-xs">
                      <span className="text-slate-400">Via Kaart</span>
                      <span className="font-bold">€{(previewSession.summary?.cardTotal || 0).toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between text-xs">
                      <span className="text-slate-400">Via Contant</span>
                      <span className="font-bold">€{(previewSession.summary?.cashTotal || 0).toFixed(2)}</span>
                    </div>
                  </div>
                </div>

                <div className="space-y-4">
                  <h5 className="text-[10px] font-black text-slate-900 uppercase tracking-[0.2em] border-b border-slate-50 pb-2">Kas Controle</h5>
                  <div className="space-y-2">
                    <div className="flex justify-between text-xs">
                      <span className="text-slate-400">Beginsaldo</span>
                      <span className="font-bold">€{(previewSession.startCash || 0).toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between text-xs">
                      <span className="text-slate-400">Verwacht in Kas</span>
                      <span className="font-bold">€{(previewSession.expectedCash || 0).toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-slate-400 font-medium">Geteld Saldo</span>
                      <span className="font-black">€{(previewSession.endCash || 0).toFixed(2)}</span>
                    </div>
                    <div className={`flex justify-between text-sm font-black p-3 rounded-xl ${((previewSession.endCash || 0) - (previewSession.expectedCash || 0)) < 0 ? 'bg-rose-50 text-rose-600' : 'bg-emerald-50 text-emerald-600'}`}>
                      <span>Verschil</span>
                      <span>€{((previewSession.endCash || 0) - (previewSession.expectedCash || 0)).toFixed(2)}</span>
                    </div>
                  </div>
                </div>

                <div className="space-y-4">
                  <h5 className="text-[10px] font-black text-slate-900 uppercase tracking-[0.2em] border-b border-slate-50 pb-2">BTW Opsplitsing</h5>
                  <div className="space-y-2">
                    <div className="flex justify-between text-xs">
                      <span className="text-slate-400">BTW 0%</span>
                      <span className="font-bold font-mono">€{(previewSession.summary?.vat0Total || 0).toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between text-xs">
                      <span className="text-slate-400">BTW Hoog ({activeMode === 'SHOP' ? '21,5' : '21'}%)</span>
                      <span className="font-bold font-mono">€{(previewSession.summary?.vatHighTotal || 0).toFixed(2)}</span>
                    </div>
                  </div>
                </div>

                <div className="space-y-4">
                  <h5 className="text-[10px] font-black text-slate-900 uppercase tracking-[0.2em] border-b border-slate-50 pb-2">Product Verkoop</h5>
                  <div className="space-y-3">
                    {getSessionBreakdown(previewSession).map(item => (
                      <div key={item.name} className="flex justify-between items-center group">
                        <div className="flex flex-col">
                          <span className="text-xs font-bold text-slate-900">{item.name}</span>
                          <span className="text-[9px] text-slate-400 font-bold uppercase tracking-widest">{(item.qty || 0)} verkocht</span>
                        </div>
                        <span className="text-xs font-black font-mono">€{(item.total || 0).toFixed(2)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
              <div className="p-8 bg-slate-50 border-t border-slate-100 flex gap-4 shrink-0">
                <button 
                  onClick={() => printHistoricalReport(previewSession)} 
                  className="flex-1 bg-slate-950 text-white py-5 rounded-[1.5rem] font-black uppercase text-[11px] tracking-[0.4em] active:scale-95 transition-all flex items-center justify-center gap-3 shadow-xl"
                >
                  <Printer size={16}/> Print Rapport
                </button>
                <button onClick={() => setPreviewSession(null)} className="px-6 bg-white border border-slate-200 text-slate-400 rounded-[1.5rem] font-black uppercase text-[11px] tracking-[0.2em]">Sluiten</button>
              </div>
           </div>
        </div>
      )}
    </div>
  );
}
