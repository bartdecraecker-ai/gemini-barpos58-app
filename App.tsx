import React, { useState, useEffect, useMemo } from 'react';
import { 
  ShoppingBag, Trash2, Banknote, BarChart3, Settings, Plus, Minus, X, 
  CheckCircle, PlayCircle, Lock, Loader2, User, ChevronDown, 
  Printer, Bluetooth, Store, MapPin, Delete, Calendar, AlertCircle, 
  LogOut, RefreshCcw, Building2, Save, Edit2, Globe, Cloud, PlusCircle, CreditCard, Download, Link as LinkIcon, Wifi, WifiOff,
  UserPlus, UserMinus, Receipt as ReceiptIcon, Package, RotateCcw, Share
} from 'lucide-react';
import { PaymentMethod, CloudConfig } from './types.ts';
import type { Product, CartItem, Transaction, CompanyDetails, SalesSession, DailySummary } from './types.ts';
import { DEFAULT_COMPANY, INITIAL_PRODUCTS, AVAILABLE_COLORS } from './constants.ts';
import { Receipt } from './components/Receipt.tsx';
import { apiService } from './services/api.ts';
import type { AppMode } from './services/api.ts';
import { btPrinterService } from './services/bluetoothPrinter.ts';

export default function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [activeMode, setActiveMode] = useState<AppMode | null>(null);
  const [pinInput, setPinInput] = useState('');
  const [loginError, setLoginError] = useState(false);

  const [products, setProducts] = useState<Product[]>([]);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [sessions, setSessions] = useState<SalesSession[]>([]);
  const [company, setCompany] = useState<CompanyDetails>(DEFAULT_COMPANY);

  // Cloud Sync State
  const [cloudConfig, setCloudConfig] = useState<CloudConfig>(() => apiService.getCloudConfig());
  const [syncStatus, setSyncStatus] = useState<'IDLE' | 'SYNCING' | 'SUCCESS' | 'ERROR'>('IDLE');

  const [activeTab, setActiveTab] = useState<'POS' | 'REPORTS' | 'SETTINGS'>('POS');
  const [isInitialLoading, setIsInitialLoading] = useState(false);
  const [btConnected, setBtConnected] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [previewTransaction, setPreviewTransaction] = useState<Transaction | null>(null);
  const [previewSession, setPreviewSession] = useState<SalesSession | null>(null);
  const [showSalesmanSelection, setShowSalesmanSelection] = useState(false);
  const [currentSession, setCurrentSession] = useState<SalesSession | null>(null);
  const [startFloatAmount, setStartFloatAmount] = useState<string>('0');

  const [isClosingSession, setIsClosingSession] = useState(false);
  const [isPendingCardConfirmation, setIsPendingCardConfirmation] = useState(false);
  const [endCashInput, setEndCashInput] = useState('');
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [newStaffName, setNewStaffName] = useState('');

  const themeBg = activeMode === 'SHOP' ? 'bg-amber-500' : 'bg-indigo-500';
  const themeAccent = activeMode === 'SHOP' ? 'text-amber-500' : 'text-indigo-500';

  useEffect(() => {
    // Always launch with startpage (mode selection)
    setActiveMode(null);

    const interval = setInterval(() => {
      setBtConnected(btPrinterService.isConnected());
    }, 1000);

    return () => clearInterval(interval);
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

  const loadContextData = async () => {
    if (!activeMode) return;
    setIsInitialLoading(true);

    try {
      await apiService.hydrateInitialData();

      const [p, t, c, s] = await Promise.all([
        apiService.getProducts(),
        apiService.getTransactions(),
        apiService.getCompany(),
        apiService.getSessions(),
      ]);

      setProducts(p && p.length > 0 ? p.slice(0, 10) : INITIAL_PRODUCTS.slice(0, 10));
      setTransactions(t || []);
      setSessions(s || []);
      setCompany(c || DEFAULT_COMPANY);

      const openS = s?.find(sess => sess.status === 'OPEN');
      setCurrentSession(openS || null);
    } catch (err) {
      console.error("Data Load Error:", err);
    } finally {
      setIsInitialLoading(false);
    }
  };

  useEffect(() => { loadContextData(); }, [activeMode]);

  useEffect(() => {
    if (isAuthenticated && activeMode && !isInitialLoading && (products.length > 0 || company.name)) {
      apiService.saveProducts(products);
      apiService.saveCompany(company);
      apiService.saveTransactions(transactions);
      apiService.saveSessions(sessions);
      apiService.setCloudConfig(cloudConfig);

      if (cloudConfig.isAutoSync && cloudConfig.syncId && syncStatus === 'IDLE') {
        performSync('PUSH');
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [products, company, transactions, sessions, cloudConfig, isAuthenticated, activeMode, isInitialLoading]);

  const performSync = async (type: 'PUSH' | 'PULL') => {
    if (!cloudConfig.syncId) return;
    setSyncStatus('SYNCING');

    try {
      if (type === 'PUSH') {
        const success = await apiService.pushToCloud(cloudConfig, products, company);
        setSyncStatus(success ? 'SUCCESS' : 'ERROR');
      } else {
        const data = await apiService.pullFromCloud(cloudConfig);
        if (data) {
          setProducts((data.products || []).slice(0, 10));
          setCompany(data.company);
          setSyncStatus('SUCCESS');
        } else {
          setSyncStatus('ERROR');
        }
      }
    } catch (e) {
      setSyncStatus('ERROR');
    }

    setTimeout(() => setSyncStatus('IDLE'), 3000);
  };

  const handleResetToDefaults = async () => {
    if (!confirm("Weet u zeker dat u de standaardgegevens voor deze modus wilt laden? Lokale aanpassingen gaan verloren.")) return;
    setIsInitialLoading(true);
    const data = await apiService.resetToDefaults();
    if (data) {
      setProducts(data.products.slice(0, 10));
      setCompany(data.company);
      setSyncStatus('SUCCESS');
      setTimeout(() => setSyncStatus('IDLE'), 2000);
    }
    setIsInitialLoading(false);
  };

  const exportData = (type: 'PRODUCTS' | 'COMPANY') => {
    const data = type === 'PRODUCTS' ? products : company;
    const fileName = type === 'PRODUCTS'
      ? `products_${activeMode?.toLowerCase()}.json`
      : `company_${activeMode?.toLowerCase()}.json`;

    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = fileName;
    link.click();
    URL.revokeObjectURL(url);
  };

  // ✅ Disconnect BT Printer (safe & minimal)
  const handleBtDisconnect = async () => {
    try {
      await btPrinterService.disconnect();
    } catch (e) {
      console.warn("BT disconnect error", e);
    } finally {
      setBtConnected(false);
    }
  };

  // ✅ Delete session from history (and its transactions)
  // IMPORTANT: keep it sync, and let your existing useEffect persist to localStorage
  const deleteSessionFromHistory = (sessionId: string) => {
    console.log("[DeleteShift] click", sessionId);

    const sess = sessions.find(x => x.id === sessionId);
    if (!sess) {
      console.warn("[DeleteShift] session not found", sessionId);
      alert("Shift niet gevonden (check console).");
      return;
    }

    const ok = confirm(
      `Shift verwijderen?\n\nID: ${sess.id.slice(-8)}\nDatum: ${
        sess.endTime ? new Date(sess.endTime).toLocaleDateString('nl-NL') : ''
      }\n\nLet op: bijhorende tickets van deze shift worden ook verwijderd.`
    );
    if (!ok) return;

    setSessions(prev => prev.filter(s => s.id !== sessionId));
    setTransactions(prev => prev.filter(t => t.sessionId !== sessionId));

    if (previewSession?.id === sessionId) setPreviewSession(null);
  };

  const totals = useMemo(() => {
    let total = 0, v0 = 0, vHigh = 0;
    cart.forEach(i => {
      const lineTotal = i.price * i.quantity;
      total += lineTotal;
      if (i.vatRate === 21) vHigh += lineTotal - (lineTotal / 1.21);
      else v0 += lineTotal;
    });
    return { total, v0, vHigh, sub: total - vHigh };
  }, [cart]);

  const initiatePayment = (method: PaymentMethod) => {
    if (!currentSession || cart.length === 0) return;
    if (!company.sellerName) { setShowSalesmanSelection(true); return; }

    if (method === PaymentMethod.CARD) setIsPendingCardConfirmation(true);
    else finalizePayment(PaymentMethod.CASH);
  };

// ✅ Stock verlagen op basis van verkochte items
const applyStockReduction = (items: CartItem[]) => {
  setProducts(prev =>
    prev.map(p => {
      const soldQty = items
        .filter(i => i.id === p.id)
        .reduce((sum, i) => sum + (i.quantity || 0), 0);

      if (soldQty <= 0) return p;

      const currentStock = Number.isFinite(p.stock as any) ? (p.stock as number) : 0;
      return {
        ...p,
        stock: Math.max(0, currentStock - soldQty),
        updatedAt: Date.now()
      };
    })
  );
};
  
const finalizePayment = async (method: PaymentMethod) => {
  setIsPendingCardConfirmation(false);

  // ✅ nieuw: voorraad verlagen op basis van huidige cart
  applyStockReduction(cart);

  const now = Date.now();

    const tx: Transaction = {
      id: `TX-${now}`,
      sessionId: currentSession!.id,
      timestamp: now,
      dateStr: new Date(now).toLocaleDateString('nl-NL'),
      items: [...cart],
      subtotal: totals.sub,
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

    if (btConnected) {
      try { await btPrinterService.printReceipt(tx, company); }
      catch (e) { console.warn("BT Print error", e); }
    }

    setTimeout(() => {
      setShowSuccess(false);
      setPreviewTransaction(tx);
    }, 1000);
  };

  const closeSession = (counted: number) => {
    if (!currentSession) return;
    const sessionTx = transactions.filter(t => t.sessionId === currentSession.id);

    const totalSales = sessionTx.reduce((s, t) => s + t.total, 0);
    const cashTotal = sessionTx.filter(t => t.paymentMethod === PaymentMethod.CASH).reduce((s, t) => s + t.total, 0);
    const cardTotal = sessionTx.filter(t => t.paymentMethod === PaymentMethod.CARD).reduce((s, t) => s + t.total, 0);

    const prodCounts: Record<string, number> = {};
    sessionTx.forEach(t => t.items.forEach(i => { prodCounts[i.name] = (prodCounts[i.name] || 0) + i.quantity; }));

    const summary: DailySummary = {
      totalSales,
      transactionCount: sessionTx.length,
      cashTotal,
      cardTotal,
      vat0Total: sessionTx.reduce((s, t) => s + t.vat0, 0),
      vatHighTotal: sessionTx.reduce((s, t) => s + t.vatHigh, 0),
      productSales: prodCounts
    };

    const closed: SalesSession = {
      ...currentSession,
      status: 'CLOSED',
      endTime: Date.now(),
      endCash: counted,
      expectedCash: currentSession.startCash + cashTotal,
      summary,
      updatedAt: Date.now()
    };

    setSessions(prev => [closed, ...prev.filter(s => s.id !== currentSession.id)]);
    if (btConnected) btPrinterService.printSessionReport(closed, sessionTx, company);

    setPreviewSession(closed);
    setCurrentSession(null);
    setIsClosingSession(false);
    setActiveTab('REPORTS');
  };

  const addStaff = () => {
    if (!newStaffName) return;
    setCompany({ ...company, salesmen: [...(company.salesmen || []), newStaffName], updatedAt: Date.now() });
    setNewStaffName('');
  };

  const removeStaff = (name: string) => {
    setCompany({ ...company, salesmen: (company.salesmen || []).filter(s => s !== name), updatedAt: Date.now() });
  };

  // -------------------------
  // UI: MODE SELECTION
  // -------------------------
  if (!activeMode) {
    return (
      <div className="fixed inset-0 bg-slate-950 flex flex-col items-center justify-center p-6 text-center space-y-12">
        <div className="w-24 h-24 bg-indigo-500 rounded-3xl flex items-center justify-center mx-auto shadow-2xl relative">
          <Cloud size={48} className="text-white absolute top-4 left-4 opacity-20" />
          <Store size={48} className="text-white relative z-10" />
        </div>
        <div>
          <h1 className="text-white text-4xl font-extrabold tracking-tighter">BarPOS <span className="text-indigo-500">Cloud</span></h1>
          <p className="text-slate-500 text-[10px] uppercase tracking-[0.3em] font-black mt-2">Simultaan Beheer</p>
        </div>
        <div className="grid grid-cols-1 gap-4 w-full max-w-xs">
          <button onClick={() => { apiService.setActiveMode('SHOP'); setActiveMode('SHOP'); }} className="bg-white p-7 rounded-3xl flex items-center justify-between shadow-2xl hover:bg-amber-500 group transition-all active:scale-95">
            <h3 className="font-bold text-xl text-slate-900 group-hover:text-white transition-colors">Shop</h3>
            <Store size={28} className="text-amber-500 group-hover:text-white transition-colors" />
          </button>
          <button onClick={() => { apiService.setActiveMode('TOUR'); setActiveMode('TOUR'); }} className="bg-white p-7 rounded-3xl flex items-center justify-between shadow-2xl hover:bg-indigo-500 group transition-all active:scale-95">
            <h3 className="font-bold text-xl text-slate-900 group-hover:text-white transition-colors">Event / Tour</h3>
            <MapPin size={28} className="text-indigo-500 group-hover:text-white transition-colors" />
          </button>
        </div>
      </div>
    );
  }

  // -------------------------
  // UI: LOGIN
  // -------------------------
  if (!isAuthenticated) {
    return (
      <div className="fixed inset-0 bg-white flex flex-col items-center justify-center p-6">
        {isInitialLoading && (
          <div className="absolute inset-0 z-50 bg-white/50 backdrop-blur-sm flex items-center justify-center">
            <Loader2 size={24} className="animate-spin text-indigo-500" />
          </div>
        )}

        <div className="max-w-xs w-full text-center space-y-8">
          <div className={`w-20 h-20 ${themeBg} rounded-2xl flex items-center justify-center mx-auto text-white shadow-xl relative`}>
            <Lock size={32} />
          </div>
          <div className="space-y-1">
            <h2 className="text-2xl font-bold text-slate-900">{company.name}</h2>
            <p className="text-slate-400 text-[10px] uppercase font-black tracking-widest">Login Beheer</p>
          </div>
          <div className="flex justify-center gap-4">
            {[0, 1, 2, 3].map(i => (
              <div key={i} className={`w-4 h-4 rounded-full border-2 transition-all duration-300 ${pinInput.length > i ? themeBg : 'border-slate-200'}`} />
            ))}
          </div>
          <div className={`grid grid-cols-3 gap-4 p-4 rounded-3xl bg-slate-50 border transition-all ${loginError ? 'animate-shake border-red-200' : 'border-slate-100'}`}>
            {['1', '2', '3', '4', '5', '6', '7', '8', '9', 'C', '0', 'X'].map(val => (
              <button
                key={val}
                onClick={() => {
                  if (val === 'C') setPinInput('');
                  else if (val === 'X') setPinInput(pinInput.slice(0, -1));
                  else handlePinDigit(val);
                }}
                className="h-16 rounded-2xl bg-white shadow-sm flex items-center justify-center font-bold text-xl active:scale-90 active:bg-slate-900 active:text-white transition-all"
              >
                {val === 'X' ? <Delete size={20} /> : val}
              </button>
            ))}
          </div>

          <button onClick={() => { apiService.setActiveMode(null); setIsAuthenticated(false); setActiveMode(null); }} className="text-slate-400 text-xs font-bold uppercase tracking-widest py-2">
            Terug naar Selectie
          </button>
        </div>
      </div>
    );
  }

  // -------------------------
  // UI: MAIN APP
  // -------------------------
  return (
    <div className="fixed inset-0 flex flex-col bg-slate-50 overflow-hidden font-sans select-none">
      <header className="h-14 bg-slate-950 flex items-center justify-between px-6 shrink-0 z-50">
        <div className="flex items-center gap-4">
          <button
            type="button"
            onClick={() => { if (btConnected) handleBtDisconnect(); else btPrinterService.connect(); }}
            className="flex items-center gap-2"
            title={btConnected ? "Verbreek printer verbinding" : "Verbind printer"}
          >
            <div className={`w-2 h-2 rounded-full ${btConnected ? 'bg-emerald-500' : 'bg-red-500 animate-pulse'}`} />
            <span className="text-white/50 text-[9px] font-bold uppercase tracking-widest hover:text-white transition-colors font-bold">
              {btConnected ? btPrinterService.getDeviceName() : "Printer Offline"}
            </span>
          </button>
        </div>

        <div className="flex items-center gap-4 text-white">
          <div className="flex items-center gap-3">
            <div className={`transition-all duration-500 p-1.5 rounded-full ${
              syncStatus === 'SYNCING' ? 'bg-indigo-500 sync-pulse' :
              syncStatus === 'SUCCESS' ? 'bg-emerald-500' :
              syncStatus === 'ERROR' ? 'bg-rose-500' : 'bg-white/10'
            }`}>
              <Cloud size={14} className={syncStatus === 'SYNCING' ? 'animate-pulse text-white' : 'text-white/40'} />
            </div>

            <div className="flex items-center gap-1.5 bg-white/10 px-2.5 py-1 rounded-full border border-white/10">
              <span className="text-[9px] font-bold uppercase tracking-widest font-bold">{activeMode}</span>
            </div>
          </div>

          <button onClick={() => { setActiveMode(null); setIsAuthenticated(false); }} className="text-white/20 hover:text-white transition-colors">
            <RefreshCcw size={14} />
          </button>
        </div>
      </header>

      <nav className="h-20 bg-white border-b flex items-center justify-around shrink-0 z-40 shadow-sm">
        <button onClick={() => setActiveTab('POS')} className={`flex flex-col items-center gap-1 transition-all ${activeTab === 'POS' ? themeAccent + ' scale-105 font-bold' : 'text-slate-300'}`}>
          <ShoppingBag size={24} /><span className="text-[9px] font-bold uppercase tracking-widest font-bold">Kassa</span>
        </button>
        <button onClick={() => setActiveTab('REPORTS')} className={`flex flex-col items-center gap-1 transition-all ${activeTab === 'REPORTS' ? themeAccent + ' scale-105 font-bold' : 'text-slate-300'}`}>
          <BarChart3 size={24} /><span className="text-[9px] font-bold uppercase tracking-widest font-bold">Historiek</span>
        </button>
        <button onClick={() => setActiveTab('SETTINGS')} className={`flex flex-col items-center gap-1 transition-all ${activeTab === 'SETTINGS' ? themeAccent + ' scale-105 font-bold' : 'text-slate-300'}`}>
          <Settings size={24} /><span className="text-[9px] font-bold uppercase tracking-widest font-bold">Beheer</span>
        </button>
      </nav>

      <main className="flex-1 overflow-hidden relative">
        {isInitialLoading && (
          <div className="absolute inset-0 z-[500] bg-white/80 backdrop-blur-sm flex items-center justify-center">
            <div className="flex flex-col items-center gap-3">
              <Loader2 size={32} className="animate-spin text-indigo-500" />
              <span className="text-[10px] font-black uppercase text-indigo-500 tracking-widest font-bold">Data Laden...</span>
            </div>
          </div>
        )}

        {activeTab === 'POS' && (
          <div className="h-full flex flex-col">
            {!currentSession ? (
              <div className="flex-1 flex items-center justify-center p-6">
                <div className="bg-white p-10 rounded-[2.5rem] shadow-2xl text-center max-w-sm w-full space-y-8 animate-in zoom-in-95">
                  <PlayCircle size={48} className={`${themeAccent} mx-auto`} />
                  <h3 className="font-bold text-2xl tracking-tighter">Nieuwe Shift</h3>
                  <div className="text-left space-y-2">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest text-center block font-bold">Startgeld Kassa (€)</label>
                    <input
                      type="number"
                      step="0.01"
                      value={startFloatAmount}
                      onChange={e => setStartFloatAmount(e.target.value)}
                      className="w-full bg-slate-50 border-2 p-5 rounded-3xl font-bold text-3xl outline-none focus:border-indigo-400 transition-all text-center"
                    />
                  </div>
                  <button
                    onClick={() => {
                      const sess = { id: `SES-${Date.now()}`, startTime: Date.now(), startCash: parseFloat(startFloatAmount) || 0, status: 'OPEN' as const, updatedAt: Date.now() };
                      setCurrentSession(sess);
                      setSessions(prev => [sess, ...prev]);
                    }}
                    className="w-full bg-slate-950 text-white py-5 rounded-3xl font-bold uppercase shadow-xl hover:bg-slate-800 active:scale-95 transition-all font-bold"
                  >
                    Start Shift
                  </button>
                </div>
              </div>
            ) : (
              <>
                <div className="h-[35%] bg-white border-b flex flex-col overflow-y-auto p-4 space-y-2 relative shadow-inner custom-scrollbar">
                  <div className="flex justify-between items-center mb-2 sticky top-0 bg-white z-10 py-1">
                    <button onClick={() => setShowSalesmanSelection(true)} className="flex items-center gap-2 text-[10px] font-black uppercase text-slate-600 bg-slate-100 px-4 py-2 rounded-full border border-slate-200 shadow-sm active:scale-95 transition-all font-bold">
                      <User size={12} /> {company.sellerName || "Selecteer Medewerker"} <ChevronDown size={12} />
                    </button>
                    {cart.length > 0 && <button onClick={() => setCart([])} className="text-slate-300 hover:text-red-500 transition-colors p-1"><Trash2 size={18} /></button>}
                  </div>

                  {cart.length === 0 ? (
                    <div className="h-full flex flex-col items-center justify-center opacity-10 py-10"><ShoppingBag size={48} /></div>
                  ) : cart.map(item => (
                    <div key={item.id} className="flex items-center justify-between p-3.5 bg-slate-50 rounded-[1.25rem] border border-slate-200 animate-in slide-in-from-right-4">
                      <div className="flex-1">
                        <div className="font-bold text-xs text-slate-800 font-bold">{item.name}</div>
                        <div className="text-[9px] text-slate-400 font-mono font-bold">€{item.price.toFixed(2)} | BTW {item.vatRate}%</div>
                      </div>
                      <div className="flex items-center gap-3 bg-white p-1 rounded-xl border shadow-sm">
                        <button onClick={() => {
                          const ex = cart.find(i => i.id === item.id);
                          if (ex?.quantity === 1) setCart(cart.filter(i => i.id !== item.id));
                          else setCart(cart.map(i => i.id === item.id ? { ...i, quantity: i.quantity - 1 } : i));
                        }} className="p-1.5"><Minus size={14} /></button>
                        <span className="font-bold text-xs w-5 text-center font-bold">{item.quantity}</span>
                        <button onClick={() => setCart(cart.map(i => i.id === item.id ? { ...i, quantity: i.quantity + 1 } : i))} className="p-1.5"><Plus size={14} /></button>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="flex-1 overflow-y-auto p-2 bg-slate-100 grid grid-cols-4 gap-2 pb-64 custom-scrollbar">
                  {products.slice(0, 10).map(p => (
                    <button
                      key={p.id}
                      onClick={() => {
                        const ex = cart.find(i => i.id === p.id);
                        if (ex) setCart(cart.map(i => i.id === p.id ? { ...i, quantity: i.quantity + 1 } : i));
                        else setCart([...cart, { ...p, quantity: 1 }]);
                      }}
                      className={`${p.color || 'bg-white'} rounded-2xl border-b-2 border-black/10 p-2 h-24 flex flex-col items-center justify-center text-center active:scale-95 transition-all shadow-sm group relative overflow-hidden`}
                    >
                      <span className="text-[10px] font-black leading-tight text-slate-900 mb-1 line-clamp-2 font-bold">{p.name}</span>
                      <span className="text-[9px] font-bold text-slate-950 bg-white/40 px-1.5 py-0.5 rounded-full font-mono border border-black/5 font-bold">€{p.price.toFixed(2)}</span>
                    </button>
                  ))}
                </div>

                <div className="absolute bottom-0 inset-x-0 p-6 bg-slate-950/95 backdrop-blur-xl rounded-t-[3rem] shadow-2xl space-y-4 border-t border-white/5 z-[100]">
                  <div className="flex justify-between items-end text-white px-2">
                    <div className="flex flex-col">
                      <div className="text-[10px] text-white/40 font-black uppercase tracking-[0.2em] mb-1 font-bold">Totaal</div>
                      <div className="text-4xl font-black font-mono tracking-tighter tabular-nums font-bold">€{totals.total.toFixed(2)}</div>
                    </div>
                    <div className="text-[10px] text-white/30 font-bold uppercase font-bold">BTW Incl.</div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <button onClick={() => initiatePayment(PaymentMethod.CASH)} disabled={cart.length === 0} className="bg-emerald-600 text-white h-16 rounded-2xl font-black uppercase text-sm flex items-center justify-center gap-3 shadow-xl active:scale-95 disabled:opacity-50 transition-all border-b-4 border-emerald-800 font-bold">
                      <Banknote size={20} /> Contant
                    </button>
                    <button onClick={() => initiatePayment(PaymentMethod.CARD)} disabled={cart.length === 0} className="bg-sky-600 text-white h-16 rounded-2xl font-black uppercase text-sm flex items-center justify-center gap-3 shadow-xl active:scale-95 disabled:opacity-50 transition-all border-b-4 border-sky-800 font-bold">
                      <CreditCard size={20} /> Kaart
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>
        )}

        {activeTab === 'REPORTS' && (
          <div className="h-full overflow-y-auto p-6 space-y-6 pb-24 custom-scrollbar">
            <h2 className="text-2xl font-black tracking-tighter font-bold">Shift Historiek</h2>

            {currentSession && (
              <div className="bg-white p-7 rounded-[2.5rem] shadow-xl border-l-[10px] border-amber-500 flex justify-between items-center">
                <div>
                  <div className="text-[10px] text-slate-400 font-black uppercase tracking-widest font-bold">Actieve Shift</div>
                  <div className="text-3xl font-black font-mono text-amber-500 font-bold">
                    €{transactions.filter(t => t.sessionId === currentSession.id).reduce((s, t) => s + t.total, 0).toFixed(2)}
                  </div>
                </div>
                <button onClick={() => setIsClosingSession(true)} className="bg-rose-500 text-white px-6 py-4 rounded-2xl font-black text-xs uppercase shadow-lg active:scale-95 border-b-4 border-rose-700 font-bold">
                  Sluiten
                </button>
              </div>
            )}

            <div className="space-y-4">
              {sessions.filter(s => s.status === 'CLOSED').map(s => (
                <div key={s.id} className="bg-white p-6 rounded-[2rem] flex flex-col shadow-sm border border-slate-100 group transition-all">
                  <div className="flex justify-between items-start">
                    <div className="flex gap-4 items-center">
                      <div className="bg-slate-100 p-3.5 rounded-2xl text-slate-400 group-hover:bg-indigo-50 group-hover:text-indigo-500 transition-all">
                        <Calendar size={20} />
                      </div>
                      <div>
                        <div className="font-bold text-sm text-slate-800 font-bold">{new Date(s.endTime!).toLocaleDateString('nl-NL')}</div>
                        <div className="text-[10px] text-slate-400 uppercase font-black tracking-tighter font-bold">ID: {s.id.slice(-8)}</div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="font-black text-emerald-600 font-mono text-xl font-bold">€{(s.summary?.totalSales || 0).toFixed(2)}</div>
                      <div className="text-[10px] text-slate-400 font-bold uppercase font-bold">{s.summary?.transactionCount} tickets</div>
                    </div>
                  </div>

                  <div className="flex justify-end gap-3 mt-5 pt-4 border-t border-slate-50">
                    <button onClick={() => setPreviewSession(s)} className="flex items-center gap-2 px-4 py-2 bg-slate-50 text-slate-600 rounded-xl font-bold text-[10px] uppercase hover:bg-indigo-50 hover:text-indigo-600 transition-all font-bold">
                      Rapport
                    </button>

                    <button onClick={() => btPrinterService.printSessionReport(s, transactions.filter(t => t.sessionId === s.id), company)} className="flex items-center gap-2 px-4 py-2 bg-slate-50 text-slate-600 rounded-xl font-bold text-[10px] uppercase hover:bg-emerald-50 hover:text-emerald-600 transition-all font-bold">
                      Print
                    </button>

                    {/* ✅ Verwijder: use onPointerUp + stopPropagation for mobile safety */}
                    <button
                      type="button"
                      onPointerUp={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        deleteSessionFromHistory(s.id);
                      }}
                      className="flex items-center gap-2 px-4 py-2 bg-slate-50 text-rose-600 rounded-xl font-bold text-[10px] uppercase hover:bg-rose-50 hover:text-rose-700 transition-all font-bold"
                      title="Verwijder shift"
                    >
                      <Trash2 size={14} /> Verwijder
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {activeTab === 'SETTINGS' && (
          <div className="h-full overflow-y-auto p-6 space-y-10 pb-32 custom-scrollbar">
            <h2 className="text-2xl font-black tracking-tighter font-bold">Beheer</h2>

            <section className="space-y-4">
              <div className="flex items-center gap-2 text-emerald-500"><Printer size={18} /><h3 className="text-[11px] font-black uppercase tracking-widest font-bold">Hardware</h3></div>
              <div className="bg-white p-6 rounded-[2rem] shadow-sm border border-slate-100 space-y-4">
                <div className="flex justify-between items-center">
                  <div className="flex flex-col">
                    <span className="text-xs font-bold text-slate-700 font-bold">Bluetooth Printer</span>
                    <span className="text-[9px] text-slate-400 uppercase font-black font-bold">{btConnected ? btPrinterService.getDeviceName() : "Niet verbonden"}</span>
                  </div>
                  <div className={`w-3 h-3 rounded-full ${btConnected ? 'bg-emerald-500' : 'bg-rose-500 animate-pulse'}`}></div>
                </div>

                <div className="grid grid-cols-3 gap-3">
                  <button onClick={() => btPrinterService.connect()} className="bg-indigo-50 text-indigo-600 py-3 rounded-xl font-bold text-[10px] uppercase border border-indigo-100 active:scale-95 font-bold">Verbinden</button>
                  <button onClick={handleBtDisconnect} disabled={!btConnected} className="bg-rose-50 text-rose-600 py-3 rounded-xl font-bold text-[10px] uppercase border border-rose-100 active:scale-95 disabled:opacity-50 font-bold">Disconnect</button>
                  <button onClick={() => btPrinterService.testPrint()} disabled={!btConnected} className="bg-slate-50 text-slate-400 py-3 rounded-xl font-bold text-[10px] uppercase border border-slate-200 active:scale-95 disabled:opacity-50 font-bold">Test Print</button>
                </div>
              </div>
            </section>

            <section className="space-y-4">
              <div className="flex items-center gap-2 text-indigo-500"><Cloud size={18} /><h3 className="text-[11px] font-black uppercase tracking-widest font-bold">Bestanden & Root Update</h3></div>
              <div className="bg-white p-6 rounded-[2rem] shadow-sm border border-slate-100 space-y-6">
                <div className="p-4 bg-slate-50 rounded-2xl border border-dashed border-slate-200">
                  <p className="text-[10px] leading-relaxed text-slate-500 font-bold uppercase tracking-tight">
                    <span className="text-indigo-600 font-black">BELANGRIJK:</span> Om de <span className="font-black italic">products_shop.json</span> in uw bronmap te wijzigen, moet u het bestand hieronder downloaden en de oude in uw projectmap vervangen.
                  </p>
                </div>

                <div className="grid grid-cols-1 gap-3">
                  <button onClick={() => exportData('PRODUCTS')} className="w-full bg-slate-950 text-white py-4 rounded-2xl font-black text-[10px] uppercase flex items-center justify-center gap-2 active:scale-95 transition-all border-b-4 border-slate-800 font-bold">
                    <Download size={16} /> Download products_{activeMode?.toLowerCase()}.json
                  </button>
                  <button onClick={() => exportData('COMPANY')} className="w-full bg-white border-2 border-slate-100 text-slate-600 py-4 rounded-2xl font-black text-[10px] uppercase flex items-center justify-center gap-2 active:scale-95 transition-all font-bold">
                    <Download size={16} /> Download company_{activeMode?.toLowerCase()}.json
                  </button>
                </div>

                <div className="pt-6 border-t space-y-4">
                  <div className="flex items-center gap-2"><Wifi size={14} className="text-slate-400" /><span className="text-[10px] font-black uppercase text-slate-400 tracking-widest font-bold">Cloud Sync (Simulatie)</span></div>
                  <div className="space-y-2">
                    <input
                      type="text"
                      value={cloudConfig.syncId}
                      onChange={e => setCloudConfig({ ...cloudConfig, syncId: e.target.value })}
                      className="w-full bg-slate-50 p-4 rounded-xl font-bold border-2 border-transparent focus:border-indigo-400 outline-none transition-all text-sm"
                      placeholder="Sync ID..."
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <button onClick={() => performSync('PUSH')} disabled={!cloudConfig.syncId || syncStatus === 'SYNCING'} className="bg-indigo-50 text-indigo-600 py-3 rounded-xl font-bold text-[10px] uppercase border border-indigo-100 active:scale-95 disabled:opacity-50 font-bold">Push</button>
                    <button onClick={() => performSync('PULL')} disabled={!cloudConfig.syncId || syncStatus === 'SYNCING'} className="bg-slate-50 text-slate-600 py-3 rounded-xl font-bold text-[10px] uppercase border border-slate-200 active:scale-95 disabled:opacity-50 font-bold">Pull</button>
                  </div>
                </div>
              </div>
            </section>

            <section className="space-y-4">
              <div className="flex items-center gap-2 text-indigo-500"><Building2 size={18} /><h3 className="text-[11px] font-black uppercase tracking-widest font-bold">Bedrijfsgegevens</h3></div>
              <div className="bg-white p-6 rounded-[2rem] shadow-sm border border-slate-100 space-y-4">
                <div className="grid grid-cols-1 gap-4">
                  <div className="space-y-1">
                    <label className="text-[10px] font-black text-slate-400 uppercase px-1 font-bold">Bedrijfsnaam</label>
                    <input type="text" value={company.name} onChange={e => setCompany({ ...company, name: e.target.value, updatedAt: Date.now() })} className="w-full bg-slate-50 p-4 rounded-xl font-bold border-2 border-transparent focus:border-indigo-400 outline-none text-sm" />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-black text-slate-400 uppercase px-1 font-bold">Adres Lijn 1</label>
                    <input type="text" value={company.address} onChange={e => setCompany({ ...company, address: e.target.value, updatedAt: Date.now() })} className="w-full bg-slate-50 p-4 rounded-xl font-bold border-2 border-transparent focus:border-indigo-400 outline-none text-sm" />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-black text-slate-400 uppercase px-1 font-bold">Adres Lijn 2 (Stad/Postcode)</label>
                    <input type="text" value={company.address2 || ''} onChange={e => setCompany({ ...company, address2: e.target.value, updatedAt: Date.now() })} className="w-full bg-slate-50 p-4 rounded-xl font-bold border-2 border-transparent focus:border-indigo-400 outline-none text-sm" />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-black text-slate-400 uppercase px-1 font-bold">BTW Nummer</label>
                    <input type="text" value={company.vatNumber} onChange={e => setCompany({ ...company, vatNumber: e.target.value, updatedAt: Date.now() })} className="w-full bg-slate-50 p-4 rounded-xl font-bold border-2 border-transparent focus:border-indigo-400 outline-none text-sm" />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-black text-slate-400 uppercase px-1 font-bold">Bon Footer Bericht</label>
                    <input type="text" value={company.footerMessage} onChange={e => setCompany({ ...company, footerMessage: e.target.value, updatedAt: Date.now() })} className="w-full bg-slate-50 p-4 rounded-xl font-bold border-2 border-transparent focus:border-indigo-400 outline-none text-sm" />
                  </div>
                  <div className="pt-2">
                    <button onClick={handleResetToDefaults} className="w-full flex items-center justify-center gap-2 border-2 border-slate-100 py-3 rounded-xl text-[10px] font-black uppercase text-slate-400 hover:bg-slate-50 hover:text-indigo-500 transition-all font-bold">
                      <RotateCcw size={14} /> Standaardgegevens Laden
                    </button>
                  </div>
                </div>
              </div>
            </section>

            <section className="space-y-4">
              <div className="flex items-center gap-2 text-rose-500"><User size={18} /><h3 className="text-[11px] font-black uppercase tracking-widest font-bold">Personeelsbeheer</h3></div>
              <div className="bg-white p-6 rounded-[2rem] shadow-sm border border-slate-100 space-y-4">
                <div className="flex gap-2">
                  <input type="text" value={newStaffName} onChange={e => setNewStaffName(e.target.value)} placeholder="Naam medewerker..." className="flex-1 bg-slate-50 p-4 rounded-xl font-bold text-sm" />
                  <button onClick={addStaff} className="bg-rose-500 text-white p-4 rounded-xl active:scale-95"><UserPlus size={20} /></button>
                </div>
                <div className="divide-y">
                  {(company.salesmen || []).map(name => (
                    <div key={name} className="py-3 flex justify-between items-center">
                      <span className="font-bold text-slate-700 font-bold">{name}</span>
                      <button onClick={() => removeStaff(name)} className="text-slate-300 hover:text-rose-500 p-2"><UserMinus size={18} /></button>
                    </div>
                  ))}
                </div>
              </div>
            </section>

            <section className="space-y-4">
              <div className="flex items-center justify-between pr-2">
                <div className="flex items-center gap-2 text-amber-500"><ShoppingBag size={18} /><h3 className="text-[11px] font-black uppercase tracking-widest font-bold">Producten ({products.length}/10)</h3></div>
                {products.length < 10 && (
                  <button onClick={() => setEditingProduct({ id: 'P-' + Date.now(), name: '', price: 0, vatRate: 21, color: 'bg-white', stock: 100, updatedAt: Date.now() })} className="text-[10px] font-black text-indigo-600 uppercase flex items-center gap-1.5 active:scale-95 bg-indigo-50 px-3 py-1.5 rounded-full border border-indigo-100 font-bold">
                    <PlusCircle size={14} /> Toevoegen
                  </button>
                )}
              </div>

              <div className="bg-white rounded-[2rem] shadow-sm border border-slate-100 overflow-hidden divide-y">
                {products.map(p => (
                  <div key={p.id} className="p-5 flex justify-between items-center hover:bg-slate-50 group transition-all">
                    <div className="flex items-center gap-4">
                      <div className={`w-3 h-3 rounded-full ${p.color || 'bg-slate-200'} border border-black/5`}></div>
                      <div>
                        <div className="font-bold text-sm text-slate-900 font-bold">{p.name}</div>
                        <div className="text-[10px] text-slate-400 font-mono font-bold">€{p.price.toFixed(2)} | BTW {p.vatRate}% | Stock: {p.stock || 0}</div>
                      </div>
                    </div>
                    <div className="flex items-center gap-1">
                      <button onClick={() => setEditingProduct(p)} className="p-3 text-slate-300 group-hover:text-amber-500 hover:bg-amber-50 rounded-2xl transition-all"><Edit2 size={18} /></button>
                      <button onClick={() => { if (confirm("Zeker?")) setProducts(prev => prev.filter(x => x.id !== p.id)); }} className="p-3 text-slate-300 hover:text-rose-500 hover:bg-rose-50 rounded-2xl transition-all"><Trash2 size={18} /></button>
                    </div>
                  </div>
                ))}
              </div>
            </section>

            <div className="pt-8">
              <button onClick={() => { setActiveMode(null); setIsAuthenticated(false); }} className="w-full py-5 rounded-2xl bg-slate-900 text-white font-black uppercase text-[10px] tracking-widest shadow-xl active:scale-95 transition-all flex items-center justify-center gap-2 font-bold font-bold">
                <LogOut size={16} /> Uitloggen
              </button>
            </div>
          </div>
        )}
      </main>

      {showSuccess && (
        <div className="fixed inset-0 z-[2000] flex items-center justify-center pointer-events-none animate-in zoom-in-50 fade-in duration-300">
          <div className="bg-emerald-500 text-white px-12 py-12 rounded-[4rem] shadow-2xl flex flex-col items-center gap-6 border-[12px] border-white/20">
            <CheckCircle size={80} strokeWidth={3} className="animate-bounce" />
            <span className="font-black text-4xl tracking-widest uppercase font-bold">BETAALD</span>
          </div>
        </div>
      )}

      {isPendingCardConfirmation && (
        <div className="fixed inset-0 z-[1500] bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-6 animate-in fade-in">
          <div className="bg-white rounded-[3rem] p-10 w-full max-w-sm text-center space-y-8 shadow-2xl border-8 border-sky-500/20">
            <div className="w-20 h-20 bg-sky-50 text-sky-500 rounded-3xl flex items-center justify-center mx-auto shadow-inner"><CreditCard size={40} /></div>
            <div className="space-y-1">
              <h3 className="font-black text-2xl tracking-tighter font-bold">Kaartbetaling</h3>
              <p className="text-slate-400 text-[10px] font-black uppercase tracking-widest font-bold">Bedrag: €{totals.total.toFixed(2)}</p>
            </div>
            <p className="text-slate-600 font-bold text-sm">Wacht op bevestiging van de terminal...</p>
            <div className="grid grid-cols-1 gap-3">
              <button onClick={() => finalizePayment(PaymentMethod.CARD)} className="w-full bg-sky-600 text-white py-6 rounded-[2rem] font-black uppercase text-sm shadow-2xl active:scale-95 border-b-4 border-sky-800 font-bold">
                Bevestig Betaling
              </button>
              <button onClick={() => setIsPendingCardConfirmation(false)} className="text-slate-400 text-[10px] font-black uppercase tracking-widest py-2 font-bold font-bold">
                Annuleren
              </button>
            </div>
          </div>
        </div>
      )}

      {editingProduct && (
        <div className="fixed inset-0 z-[1100] flex items-center justify-center bg-slate-950/90 backdrop-blur-md p-6 animate-in fade-in">
          <div className="bg-white rounded-[3rem] p-10 w-full max-w-sm space-y-8 shadow-2xl">
            <h3 className="font-black text-2xl tracking-tighter flex items-center gap-3 font-bold">
              <Edit2 size={24} className="text-amber-500" /> Product Aanpassen
            </h3>

            <div className="space-y-5">
              <div className="space-y-1.5">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest font-bold">Naam</label>
                <input type="text" value={editingProduct.name} onChange={e => setEditingProduct({ ...editingProduct, name: e.target.value })} className="w-full bg-slate-50 p-4 rounded-2xl border-2 border-transparent font-bold outline-none focus:border-amber-400 transition-all text-sm" placeholder="Naam..." />
              </div>

              <div className="grid grid-cols-2 gap-5">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest font-bold">Prijs (€)</label>
                  <input type="number" step="0.01" value={editingProduct.price} onChange={e => setEditingProduct({ ...editingProduct, price: parseFloat(e.target.value) || 0 })} className="w-full bg-slate-50 p-4 rounded-2xl border-2 border-transparent font-bold outline-none focus:border-amber-400 transition-all text-sm" />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest font-bold">BTW %</label>
                  <select value={editingProduct.vatRate} onChange={e => setEditingProduct({ ...editingProduct, vatRate: parseInt(e.target.value) })} className="w-full bg-slate-50 p-4 rounded-2xl border-2 border-transparent font-bold outline-none focus:border-amber-400 transition-all text-sm appearance-none cursor-pointer">
                    <option value={21}>21%</option>
                    <option value={0}>0%</option>
                  </select>
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest font-bold">Stock</label>
                <div className="flex gap-2">
                  <div className="bg-slate-100 p-4 rounded-xl flex items-center text-slate-400"><Package size={16} /></div>
                  <input type="number" value={editingProduct.stock || 0} onChange={e => setEditingProduct({ ...editingProduct, stock: parseInt(e.target.value) || 0 })} className="flex-1 bg-slate-50 p-4 rounded-xl font-bold border-2 border-transparent focus:border-amber-400 outline-none transition-all text-sm" />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest font-bold">Kleur</label>
                <div className="flex flex-wrap gap-2">
                  {AVAILABLE_COLORS.map(c => (
                    <button key={c} onClick={() => setEditingProduct({ ...editingProduct, color: c })} className={`w-8 h-8 rounded-full ${c} border-2 ${editingProduct.color === c ? 'border-slate-900 scale-110' : 'border-transparent'}`}></button>
                  ))}
                </div>
              </div>
            </div>

            <div className="flex gap-3 pt-4">
              <button
                onClick={() => {
                  if (!editingProduct.name) return;
                  setProducts(prev => {
                    const idx = prev.findIndex(p => p.id === editingProduct.id);
                    if (idx > -1) {
                      const next = [...prev];
                      next[idx] = { ...editingProduct, updatedAt: Date.now() };
                      return next;
                    }
                    return [...prev, { ...editingProduct, updatedAt: Date.now() }];
                  });
                  setEditingProduct(null);
                }}
                className="flex-1 bg-emerald-500 text-white py-5 rounded-2xl font-black uppercase text-xs tracking-widest shadow-xl active:scale-95 transition-all border-b-4 border-emerald-700 flex items-center justify-center gap-2 font-bold font-bold"
              >
                <Save size={18} /> Opslaan
              </button>
              <button onClick={() => setEditingProduct(null)} className="flex-1 bg-slate-100 text-slate-600 py-5 rounded-2xl font-black uppercase text-xs tracking-widest transition-all hover:bg-slate-200 active:scale-95 font-bold">
                Annuleer
              </button>
            </div>
          </div>
        </div>
      )}

      {showSalesmanSelection && (
        <div className="fixed inset-0 z-[1500] flex items-center justify-center bg-slate-950/80 backdrop-blur-md p-6 animate-in fade-in">
          <div className="bg-white rounded-[3rem] p-10 w-full max-w-sm space-y-8 shadow-2xl">
            <h3 className="font-black text-2xl text-center tracking-tighter font-bold">Selecteer Bediening</h3>
            <div className="grid grid-cols-1 gap-3 max-h-[40vh] overflow-y-auto pr-2 custom-scrollbar">
              {(company.salesmen || []).map(name => (
                <button key={name} onClick={() => { setCompany({ ...company, sellerName: name }); setShowSalesmanSelection(false); }} className={`w-full p-6 rounded-[2rem] font-black text-left border-2 flex justify-between items-center transition-all font-bold ${company.sellerName === name ? 'border-indigo-500 bg-indigo-50 text-indigo-700' : 'border-slate-100 text-slate-500 bg-slate-50'}`}>
                  <span className="text-lg font-bold">{name}</span>
                  {company.sellerName === name && <CheckCircle size={24} className="text-indigo-600" />}
                </button>
              ))}
              {(!company.salesmen || company.salesmen.length === 0) && (
                <div className="text-center p-6 text-slate-400 text-sm font-bold font-bold">Geen medewerkers ingesteld in beheer.</div>
              )}
            </div>
            <button onClick={() => setShowSalesmanSelection(false)} className="w-full bg-slate-950 text-white py-5 rounded-2xl font-bold uppercase active:scale-95 shadow-xl font-bold">
              Sluiten
            </button>
          </div>
        </div>
      )}

      {isClosingSession && (
        <div className="fixed inset-0 z-[1500] bg-slate-950/90 backdrop-blur-md flex items-center justify-center p-6 animate-in fade-in">
          <div className="bg-white rounded-[3rem] p-10 w-full max-w-sm text-center space-y-8 shadow-2xl">
            <div className="w-20 h-20 bg-rose-50 text-rose-500 rounded-3xl flex items-center justify-center mx-auto"><AlertCircle size={40} /></div>
            <div className="space-y-1">
              <h3 className="font-black text-2xl tracking-tighter font-bold">Shift Sluiten</h3>
              <p className="text-slate-400 text-[10px] font-black uppercase tracking-widest font-bold">Geteld bedrag in lade</p>
            </div>
            <div className="text-left space-y-2">
              <input type="number" step="0.01" value={endCashInput} onChange={e => setEndCashInput(e.target.value)} className="w-full bg-slate-50 border-2 border-slate-100 p-6 rounded-[2rem] font-black text-3xl text-center shadow-inner outline-none focus:border-rose-400 font-bold" autoFocus />
            </div>
            <button onClick={() => closeSession(parseFloat(endCashInput) || 0)} className="w-full bg-rose-500 text-white py-6 rounded-[2rem] font-black uppercase text-sm shadow-2xl active:scale-95 border-b-4 border-rose-700 font-bold">
              Bevestig Sluiting
            </button>
            <button onClick={() => setIsClosingSession(false)} className="text-slate-400 text-[10px] font-black uppercase tracking-widest py-2 font-bold font-bold">
              Annuleren
            </button>
          </div>
        </div>
      )}

      {(previewTransaction || previewSession) && (
        <div className="fixed inset-0 z-[1200] bg-slate-950/95 flex flex-col items-center justify-center p-6 backdrop-blur-xl animate-in fade-in">
          <div className="bg-white rounded-[3rem] max-w-sm w-full overflow-hidden shadow-2xl border-8 border-white">
            <div className="p-5 border-b flex justify-between items-center bg-slate-50/50">
              <span className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] font-bold">Bon Voorbeeld</span>
              <button onClick={() => { setPreviewTransaction(null); setPreviewSession(null); }} className="text-slate-400 hover:text-rose-500 transition-colors p-2 active:scale-90 font-bold"><X size={24} /></button>
            </div>
            <div className="p-8 bg-slate-100/40 overflow-y-auto max-h-[55vh] flex justify-center custom-scrollbar">
              {/* keep as-is with your existing Receipt implementation */}
              <Receipt preview transaction={previewTransaction} session={previewSession} company={company} />
            </div>
            <div className="p-8 border-t bg-white flex flex-col gap-3">
              <button onClick={() => { if (btConnected && previewTransaction) btPrinterService.printReceipt(previewTransaction, company); else window.print(); }} className="w-full bg-emerald-500 text-white py-5 rounded-2xl font-black uppercase text-xs tracking-widest shadow-xl active:scale-95 border-b-4 border-emerald-700 font-bold">
                Printen
              </button>
              <button onClick={() => { setPreviewTransaction(null); setPreviewSession(null); }} className="w-full bg-slate-950 text-white py-4 rounded-2xl font-black uppercase text-[10px] tracking-widest font-bold font-bold">
                Sluiten
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
