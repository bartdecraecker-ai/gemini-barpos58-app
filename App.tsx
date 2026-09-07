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

  const handleBtDisconnect = async () => {
    try {
      await btPrinterService.disconnect();
    } catch (e) {
      console.warn("BT disconnect error", e);
    } finally {
      setBtConnected(false);
    }
  };

  const deleteSessionFromHistory = (sessionId: string) => {
    const sess = sessions.find(x => x.id === sessionId);
    if (!sess) {
      alert("Shift niet gevonden.");
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

  const mergeByIdNewest = <T extends { id: string; updatedAt?: number }>(local: T[], incoming: T[]) => {
    const map = new Map<string, T>();
    for (const x of local) map.set(x.id, x);
    for (const x of incoming) {
      const prev = map.get(x.id);
      const a = prev?.updatedAt || 0;
      const b = x?.updatedAt || 0;
      if (!prev || b >= a) map.set(x.id, x);
    }
    return Array.from(map.values()).sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
  };

  const finalizePayment = async (method: PaymentMethod) => {
    setIsPendingCardConfirmation(false);

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

    applyStockReduction(cart);

    setTransactions(prev => [tx, ...prev]);
    setCart([]);
    setShowSuccess(true);

    try {
      await apiService.serverPushSale(tx);
      const delta = await apiService.serverPullDelta();

      if (delta?.products?.length) setProducts(prev => mergeByIdNewest(prev, delta.products).slice(0, 10));
      if (delta?.transactions?.length) setTransactions(prev => mergeByIdNewest(prev, delta.transactions as any));
      if (delta?.sessions?.length) setSessions(prev => mergeByIdNewest(prev, delta.sessions as any));
      if (delta?.company) setCompany(delta.company as any);
    } catch (e) {
      console.warn("Server sale sync/pull failed", e);
    }

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

    const totalSales = sessionTx.reduce((s, t) => s + (t.total || 0), 0);
    const cashTotal = sessionTx.filter(t => t.paymentMethod === PaymentMethod.CASH).reduce((s, t) => s + (t.total || 0), 0);
    const cardTotal = sessionTx.filter(t => t.paymentMethod === PaymentMethod.CARD).reduce((s, t) => s + (t.total || 0), 0);

    const prodCounts: Record<string, number> = {};
    sessionTx.forEach(t => {
      (t.items || []).forEach(i => {
        const name = i?.name || 'Onbekend';
        const qty = Number(i?.quantity || 0);
        prodCounts[name] = (prodCounts[name] || 0) + qty;
      });
    });

    const summary: DailySummary = {
      totalSales,
      transactionCount: sessionTx.length,
      cashTotal,
      cardTotal,
      vat0Total: sessionTx.reduce((s, t) => s + (t.vat0 || 0), 0),
      vatHighTotal: sessionTx.reduce((s, t) => s + (t.vatHigh || 0), 0),
      productSales: prodCounts,
    };

    const closed: SalesSession = {
      ...currentSession,
      status: 'CLOSED',
      endTime: Date.now(),
      endCash: counted,
      expectedCash: (currentSession.startCash || 0) + cashTotal,
      summary,
      updatedAt: Date.now(),
    };

    setSessions(prev => [closed, ...prev.filter(s => s.id !== currentSession.id)]);
    setPreviewSession(closed);
    setCurrentSession(null);
    setIsClosingSession(false);
    setActiveTab('REPORTS');

    (async () => {
      try {
        await apiService.serverPushSession(closed as any);
      } catch (e) {
        console.warn("Server session CLOSE sync failed", e);
      }

      if (btConnected) {
        try {
          await btPrinterService.printSessionReport(closed, sessionTx, company);
        } catch (e) {
          console.warn("BT session print failed", e);
        }
      }
    })();
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
            <span className="text-white/50 text-[9px] font-bold uppercase tracking-widest hover:text-white transition-colors">
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
              <span className="text-[9px] font-bold uppercase tracking-widest">{activeMode}</span>
            </div>
          </div>

          <button onClick={() => { setActiveMode(null); setIsAuthenticated(false); }} className="text-white/20 hover:text-white transition-colors">
            <RefreshCcw size={14} />
          </button>
        </div>
      </header>

      <nav className="h-20 bg-white border-b flex items-center justify-around shrink-0 z-40 shadow-sm">
        <button onClick={() => setActiveTab('POS')} className={`flex flex-col items-center gap-1 transition-all ${activeTab === 'POS' ? themeAccent + ' scale-105 font-bold' : 'text-slate-300'}`}>
          <ShoppingBag size={24} /><span className="text-[9px] font-bold uppercase tracking-widest">Kassa</span>
        </button>
        <button onClick={() => setActiveTab('REPORTS')} className={`flex flex-col items-center gap-1 transition-all ${activeTab === 'REPORTS' ? themeAccent + ' scale-105 font-bold' : 'text-slate-300'}`}>
          <BarChart3 size={24} /><span className="text-[9px] font-bold uppercase tracking-widest">Historiek</span>
        </button>
        <button onClick={() => setActiveTab('SETTINGS')} className={`flex flex-col items-center gap-1 transition-all ${activeTab === 'SETTINGS' ? themeAccent + ' scale-105 font-bold' : 'text-slate-300'}`}>
          <Settings size={24} /><span className="text-[9px] font-bold uppercase tracking-widest">Beheer</span>
        </button>
      </nav>

      <main className="flex-1 overflow-hidden relative">
        {isInitialLoading && (
          <div className="absolute inset-0 z-[500] bg-white/80 backdrop-blur-sm flex items-center justify-center">
            <div className="flex flex-col items-center gap-3">
              <Loader2 size={32} className="animate-spin text-indigo-500" />
              <span className="text-[10px] font-black uppercase text-indigo-500 tracking-widest">Data Laden...</span>
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
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest text-center block">Startgeld Kassa (€)</label>
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
                      const sess = {
                        id: `SES-${Date.now()}`,
                        startTime: Date.now(),
                        startCash: parseFloat(startFloatAmount) || 0,
                        status: 'OPEN' as const,
                        updatedAt: Date.now()
                      };

                      setCurrentSession(sess);
                      setSessions(prev => [sess, ...prev]);

                      try {
                        apiService.serverPushSession(sess as any);
                      } catch (e) {
                        console.warn("Server session OPEN sync failed", e);
                      }
                    }}
                    className="w-full bg-slate-950 text-white py-5 rounded-3xl font-bold uppercase shadow-xl hover:bg-slate-800 active:scale-95 transition-all"
                  >
                    Start Shift
                  </button>
                </div>
              </div>
            ) : (
              <>
                <div className="h-[35%] bg-white border-b flex flex-col overflow-y-auto p-4 space-y-2 relative shadow-inner custom-scrollbar">
                  <div className="flex justify-between items-center mb-2 sticky top-0 bg-white z-10 py-1">
                    <button onClick={() => setShowSalesmanSelection(true)} className="flex items-center gap-2 text-[10px] font-black uppercase text-slate-600 bg-slate-100 px-4 py-2 rounded-full border border-slate-200 shadow-sm active:scale-95 transition-all">
                      <User size={12} /> {company.sellerName || "Selecteer Medewerker"} <ChevronDown size={12} />
                    </button>
                    {cart.length > 0 && <button onClick={() => setCart([])} className="text-slate-300 hover:text-red-500 transition-colors p-1"><Trash2 size={18} /></button>}
                  </div>

                  {cart.length === 0 ? (
                    <div className="h-full flex flex-col items-center justify-center opacity-10 py-10"><ShoppingBag size={48} /></div>
                  ) : cart.map(item => (
                    <div key={item.id} className="flex items-center justify-between p-3.5 bg-slate-50 rounded-[1.25rem] border border-slate-200 animate-in slide-in-from-right-4">
                      <div className="flex-1">
                        <div className="font-bold text-xs text-slate-800">{item.name}</div>
                        <div className="text-[9px] text-slate-400 font-mono font-bold">€{item.price.toFixed(2)} | BTW {item.vatRate}%</div>
                      </div>
                      <div className="flex items-center gap-3 bg-white p-1 rounded-xl border shadow-sm">
                        <button onClick={() => {
                          const ex = cart.find(i => i.id === item.id);
                          if (ex?.quantity === 1) setCart(cart.filter(i => i.id !== item.id));
                          else setCart(cart.map(i => i.id === item.id ? { ...i, quantity: i.quantity - 1 } : i));
                        }} className="p-1.5"><Minus size={14} /></button>
                        <span className="font-bold text-xs w-5 text-center">{item.quantity}</span>
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
                      <span className="text-[9px] font-bold text-slate-950 bg-white/40 px-1.5 py-0.5 rounded-full font-mono border border-black/5">€{p.price.toFixed(2)}</span>
                    </button>
                  ))}
                </div>

                <div className="absolute bottom-0 inset-x-0 p-6 bg-slate-950/95 backdrop-blur-xl rounded-t-[3rem] shadow-2xl space-y-4 border-t border-white/5 z-[100]">
                  <div className="flex justify-between items-end text-white px-2">
                    <div className="flex flex-col">
                      <div className="text-[10px] text-white/40 font-black uppercase tracking-[0.2em] mb-1 font-bold">Totaal</div>
                      <div className="text-4xl font-black font-mono tracking-tighter tabular-nums">€{totals.total.toFixed(2)}</div>
                    </div>
                    <div className="text-[10px] text-white/30 font-bold uppercase font-bold">BTW Incl.</div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <button onClick={() => initiatePayment(PaymentMethod.CASH)} disabled={cart.length === 0} className="bg-emerald-600 text-white h-16 rounded-2xl font-black uppercase text-sm flex items-center justify-center gap-3 shadow-xl active:scale-95 disabled:opacity-50 transition-all border-b-4 border-emerald-800">
                      <Banknote size={20} /> Contant
                    </button>
                    <button onClick={() => initiatePayment(PaymentMethod.CARD)} disabled={cart.length === 0} className="bg-sky-600 text-white h-16 rounded-2xl font-black uppercase text-sm flex items-center justify-center gap-3 shadow-xl active:scale-95 disabled:opacity-50 transition-all border-b-4 border-sky-800">
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
                      <ReceiptIcon size={14} /> Rapport
                    </button>
                    <button onClick={() => deleteSessionFromHistory(s.id)} className="flex items-center gap-2 px-4 py-2 bg-rose-50 text-rose-600 rounded-xl font-bold text-[10px] uppercase hover:bg-rose-500 hover:text-white transition-all font-bold">
                      <Trash2 size={14} /> Verwijder
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {activeTab === 'SETTINGS' && (
          <div className="h-full overflow-y-auto p-6 space-y-8 pb-32 custom-scrollbar">
            <h2 className="text-2xl font-black tracking-tighter font-bold">Beheer & Instellingen</h2>

            {/* Bedrijfsgegevens */}
            <div className="bg-white p-6 rounded-[2rem] shadow-sm border border-slate-100 space-y-4">
              <div className="flex items-center gap-3">
                <Building2 className={themeAccent} size={20} />
                <h3 className="font-bold text-lg">Bedrijfsgegevens</h3>
              </div>
              <div className="space-y-3">
                <input
                  type="text"
                  placeholder="Bedrijfsnaam"
                  value={company.name}
                  onChange={e => setCompany({ ...company, name: e.target.value, updatedAt: Date.now() })}
                  className="w-full bg-slate-50 border border-slate-200 p-3 rounded-xl font-bold text-sm"
                />
                <input
                  type="text"
                  placeholder="Adres"
                  value={company.address || ''}
                  onChange={e => setCompany({ ...company, address: e.target.value, updatedAt: Date.now() })}
                  className="w-full bg-slate-50 border border-slate-200 p-3 rounded-xl font-bold text-sm"
                />
                <input
                  type="text"
                  placeholder="BTW-nummer"
                  value={company.vatNumber || ''}
                  onChange={e => setCompany({ ...company, vatNumber: e.target.value, updatedAt: Date.now() })}
                  className="w-full bg-slate-50 border border-slate-200 p-3 rounded-xl font-bold text-sm"
                />
              </div>
            </div>

            {/* Cloud Synchronisatie Instellingen */}
            <div className="bg-white p-6 rounded-[2rem] shadow-sm border border-slate-100 space-y-4">
              <div className="flex items-center gap-3">
                <Cloud className={themeAccent} size={20} />
                <h3 className="font-bold text-lg">Cloud Sync Config</h3>
              </div>
              <div className="space-y-3">
                <div>
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-1">Sync Key / ID</label>
                  <input
                    type="text"
                    placeholder="Sync ID (bijv. krauker-main)"
                    value={cloudConfig.syncId || ''}
                    onChange={e => setCloudConfig({ ...cloudConfig, syncId: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-200 p-3 rounded-xl font-bold text-sm"
                  />
                </div>
                <div className="flex items-center justify-between pt-2">
                  <span className="text-xs font-bold text-slate-700">Automatische Sync</span>
                  <button
                    type="button"
                    onClick={() => setCloudConfig({ ...cloudConfig, isAutoSync: !cloudConfig.isAutoSync })}
                    className={`w-12 h-6 rounded-full transition-colors relative ${cloudConfig.isAutoSync ? 'bg-emerald-500' : 'bg-slate-300'}`}
                  >
                    <div className={`w-5 h-5 bg-white rounded-full absolute top-0.5 transition-transform ${cloudConfig.isAutoSync ? 'translate-x-6' : 'translate-x-0.5'}`} />
                  </button>
                </div>
              </div>
            </div>

            {/* Medewerkers */}
            <div className="bg-white p-6 rounded-[2rem] shadow-sm border border-slate-100 space-y-4">
              <div className="flex items-center gap-3">
                <User className={themeAccent} size={20} />
                <h3 className="font-bold text-lg">Medewerkers</h3>
              </div>
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="Naam medewerker"
                  value={newStaffName}
                  onChange={e => setNewStaffName(e.target.value)}
                  className="flex-1 bg-slate-50 border border-slate-200 p-3 rounded-xl font-bold text-sm"
                />
                <button onClick={addStaff} className="bg-slate-900 text-white px-4 rounded-xl font-bold">
                  <PlusCircle size={20} />
                </button>
              </div>
              <div className="flex flex-wrap gap-2">
                {(company.salesmen || []).map(staff => (
                  <span key={staff} className="bg-slate-100 text-slate-800 px-3 py-1.5 rounded-full text-xs font-bold flex items-center gap-2">
                    {staff}
                    <button onClick={() => removeStaff(staff)} className="text-slate-400 hover:text-red-500"><X size={14} /></button>
                  </span>
                ))}
              </div>
            </div>

            {/* Producten Beheer */}
            <div className="bg-white p-6 rounded-[2rem] shadow-sm border border-slate-100 space-y-4">
              <div className="flex justify-between items-center">
                <div className="flex items-center gap-3">
                  <Package className={themeAccent} size={20} />
                  <h3 className="font-bold text-lg">Producten (Max 10)</h3>
                </div>
              </div>
              <div className="space-y-2">
                {products.map(p => (
                  <div key={p.id} className="flex justify-between items-center p-3 bg-slate-50 rounded-xl border border-slate-200">
                    <div>
                      <div className="font-bold text-sm">{p.name}</div>
                      <div className="text-xs text-slate-400">€{p.price.toFixed(2)} - Voorraad: {p.stock ?? '∞'}</div>
                    </div>
                    <button onClick={() => setEditingProduct(p)} className="p-2 text-slate-500 hover:text-indigo-600">
                      <Edit2 size={16} />
                    </button>
                  </div>
                ))}
              </div>
            </div>

            {/* Acties */}
            <div className="bg-white p-6 rounded-[2rem] shadow-sm border border-slate-100 space-y-4">
              <h3 className="font-bold text-lg">Data & Synchronisatie</h3>
              <div className="grid grid-cols-2 gap-3">
                <button onClick={() => performSync('PUSH')} className="bg-indigo-50 text-indigo-600 p-3 rounded-xl font-bold text-xs flex items-center justify-center gap-2">
                  <Cloud size={16} /> Push naar Cloud
                </button>
                <button onClick={() => performSync('PULL')} className="bg-indigo-50 text-indigo-600 p-3 rounded-xl font-bold text-xs flex items-center justify-center gap-2">
                  <Download size={16} /> Pull van Cloud
                </button>
                <button onClick={() => exportData('PRODUCTS')} className="bg-slate-100 text-slate-700 p-3 rounded-xl font-bold text-xs flex items-center justify-center gap-2">
                  <Download size={16} /> Export Producten
                </button>
                <button onClick={handleResetToDefaults} className="bg-rose-50 text-rose-600 p-3 rounded-xl font-bold text-xs flex items-center justify-center gap-2">
                  <RotateCcw size={16} /> Reset Standaard
                </button>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* ------------------------- MODALS ------------------------- */}

      {/* Modal: Sluiten van de Shift */}
      {isClosingSession && (
        <div className="fixed inset-0 z-[200] bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-6">
          <div className="bg-white p-8 rounded-[2.5rem] max-w-sm w-full space-y-6 text-center animate-in zoom-in-95">
            <AlertCircle size={48} className="text-rose-500 mx-auto" />
            <h3 className="font-bold text-2xl">Shift Sluiten</h3>
            <p className="text-xs text-slate-500 font-bold">Tel het contant geld in de kassa en voer hieronder het bedrag in.</p>
            <input
              type="number"
              step="0.01"
              placeholder="Geteld contant bedrag (€)"
              value={endCashInput}
              onChange={e => setEndCashInput(e.target.value)}
              className="w-full bg-slate-50 border-2 p-4 rounded-2xl font-bold text-2xl text-center outline-none focus:border-rose-500"
            />
            <div className="grid grid-cols-2 gap-3">
              <button onClick={() => setIsClosingSession(false)} className="bg-slate-100 text-slate-600 py-4 rounded-xl font-bold text-xs uppercase">
                Annuleren
              </button>
              <button onClick={() => closeSession(parseFloat(endCashInput) || 0)} className="bg-rose-500 text-white py-4 rounded-xl font-bold text-xs uppercase shadow-lg">
                Bevestigen
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Selecteer verkoper */}
      {showSalesmanSelection && (
        <div className="fixed inset-0 z-[200] bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-6">
          <div className="bg-white p-8 rounded-[2.5rem] max-w-sm w-full space-y-6 text-center animate-in zoom-in-95">
            <User size={48} className={`${themeAccent} mx-auto`} />
            <h3 className="font-bold text-2xl">Selecteer Medewerker</h3>
            <div className="space-y-2 max-h-60 overflow-y-auto">
              {(company.salesmen || []).map(s => (
                <button
                  key={s}
                  onClick={() => {
                    setCompany({ ...company, sellerName: s });
                    setShowSalesmanSelection(false);
                  }}
                  className="w-full bg-slate-50 p-4 rounded-2xl font-bold text-sm text-slate-800 hover:bg-indigo-50 hover:text-indigo-600 active:scale-95 transition-all text-left flex justify-between items-center"
                >
                  {s}
                  {company.sellerName === s && <CheckCircle size={16} className="text-indigo-600" />}
                </button>
              ))}
            </div>
            <button onClick={() => setShowSalesmanSelection(false)} className="w-full bg-slate-100 text-slate-500 py-3 rounded-xl font-bold text-xs uppercase">
              Sluiten
            </button>
          </div>
        </div>
      )}

      {/* Modal: Wachten op kaartbetaling */}
      {isPendingCardConfirmation && (
        <div className="fixed inset-0 z-[200] bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-6">
          <div className="bg-white p-8 rounded-[2.5rem] max-w-sm w-full space-y-6 text-center animate-in zoom-in-95">
            <CreditCard size={48} className="text-sky-600 mx-auto animate-bounce" />
            <h3 className="font-bold text-2xl">Kaartbetaling</h3>
            <p className="text-xs text-slate-500 font-bold">Laat de klant de betaling uitvoeren op de Bancontact terminal.</p>
            <div className="grid grid-cols-2 gap-3 pt-4">
              <button onClick={() => setIsPendingCardConfirmation(false)} className="bg-slate-100 text-slate-600 py-4 rounded-xl font-bold text-xs uppercase">
                Annuleren
              </button>
              <button onClick={() => finalizePayment(PaymentMethod.CARD)} className="bg-sky-600 text-white py-4 rounded-xl font-bold text-xs uppercase shadow-lg">
                Betaald
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Product Bewerken */}
      {editingProduct && (
        <div className="fixed inset-0 z-[200] bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-6">
          <div className="bg-white p-8 rounded-[2.5rem] max-w-sm w-full space-y-4 animate-in zoom-in-95">
            <h3 className="font-bold text-xl">Product Bewerken</h3>
            <input
              type="text"
              value={editingProduct.name}
              onChange={e => setEditingProduct({ ...editingProduct, name: e.target.value })}
              className="w-full bg-slate-50 border p-3 rounded-xl font-bold text-sm"
              placeholder="Naam"
            />
            <input
              type="number"
              step="0.01"
              value={editingProduct.price}
              onChange={e => setEditingProduct({ ...editingProduct, price: parseFloat(e.target.value) || 0 })}
              className="w-full bg-slate-50 border p-3 rounded-xl font-bold text-sm"
              placeholder="Prijs"
            />
            <input
              type="number"
              value={editingProduct.stock ?? ''}
              onChange={e => setEditingProduct({ ...editingProduct, stock: parseInt(e.target.value) || 0 })}
              className="w-full bg-slate-50 border p-3 rounded-xl font-bold text-sm"
              placeholder="Voorraad"
            />
            <div className="flex gap-2 pt-2">
              <button onClick={() => setEditingProduct(null)} className="flex-1 bg-slate-100 py-3 rounded-xl font-bold text-xs uppercase">
                Annuleren
              </button>
              <button
                onClick={() => {
                  setProducts(products.map(p => p.id === editingProduct.id ? { ...editingProduct, updatedAt: Date.now() } : p));
                  setEditingProduct(null);
                }}
                className="flex-1 bg-slate-900 text-white py-3 rounded-xl font-bold text-xs uppercase"
              >
                Opslaan
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Overlay: Gelukt melding */}
      {showSuccess && (
        <div className="fixed inset-0 z-[300] bg-emerald-500/90 backdrop-blur-md flex items-center justify-center text-white">
          <div className="text-center space-y-4 animate-in zoom-in-50">
            <CheckCircle size={80} className="mx-auto" />
            <h2 className="text-3xl font-black uppercase tracking-tight">Verkocht!</h2>
          </div>
        </div>
      )}

      {/* Modal: Ticket Preview */}
      {previewTransaction && (
        <div className="fixed inset-0 z-[200] bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-6">
          <div className="bg-white p-6 rounded-[2.5rem] max-w-sm w-full space-y-4 animate-in zoom-in-95 max-h-[90vh] overflow-y-auto">
            <Receipt transaction={previewTransaction} company={company} />
            <button onClick={() => setPreviewTransaction(null)} className="w-full bg-slate-900 text-white py-3 rounded-xl font-bold text-xs uppercase">
              Sluiten
            </button>
          </div>
        </div>
      )}

      {/* Modal: Session Report Preview */}
      {previewSession && (
        <div className="fixed inset-0 z-[200] bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-6">
          <div className="bg-white p-6 rounded-[2.5rem] max-w-sm w-full space-y-4 animate-in zoom-in-95 max-h-[90vh] overflow-y-auto">
            <h3 className="font-bold text-xl text-center">Shift Rapport</h3>
            <div className="text-xs space-y-2 bg-slate-50 p-4 rounded-2xl font-mono">
              <div><strong>Shift ID:</strong> {previewSession.id}</div>
              <div><strong>Einde:</strong> {new Date(previewSession.endTime!).toLocaleString('nl-NL')}</div>
              <hr className="my-2 border-slate-200" />
              <div><strong>Totale Verkoop:</strong> €{(previewSession.summary?.totalSales || 0).toFixed(2)}</div>
              <div><strong>Contant:</strong> €{(previewSession.summary?.cashTotal || 0).toFixed(2)}</div>
              <div><strong>Kaart:</strong> €{(previewSession.summary?.cardTotal || 0).toFixed(2)}</div>
              <div><strong>Aantal Transacties:</strong> {previewSession.summary?.transactionCount}</div>
            </div>
            <button onClick={() => setPreviewSession(null)} className="w-full bg-slate-900 text-white py-3 rounded-xl font-bold text-xs uppercase">
              Sluiten
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
