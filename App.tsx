import React, { useState, useEffect, useMemo } from 'react';
import { 
  ShoppingBag, Trash2, Banknote, BarChart3, Settings, Plus, Minus, X, 
  CheckCircle, PlayCircle, Lock, Loader2, User, ChevronDown, 
  Printer, Store, MapPin, Delete, Calendar, AlertCircle, 
  RefreshCcw, UserPlus, UserMinus, Receipt as ReceiptIcon, Package, Edit2, Save, CreditCard
} from 'lucide-react';
import { PaymentMethod } from './types.ts';
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

  // Core App State
  const [products, setProducts] = useState<Product[]>([]);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [sessions, setSessions] = useState<SalesSession[]>([]);
  const [company, setCompany] = useState<CompanyDetails>(DEFAULT_COMPANY);

  // Navigation & UI States
  const [activeTab, setActiveTab] = useState<'POS' | 'REPORTS' | 'SETTINGS'>('POS');
  const [isInitialLoading, setIsInitialLoading] = useState(false);
  const [btConnected, setBtConnected] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  
  // Modals & Selection States
  const [previewTransaction, setPreviewTransaction] = useState<Transaction | null>(null);
  const [previewSession, setPreviewSession] = useState<SalesSession | null>(null);
  const [showSalesmanSelection, setShowSalesmanSelection] = useState(false);
  const [currentSession, setCurrentSession] = useState<SalesSession | null>(null);
  const [startFloatAmount, setStartFloatAmount] = useState<string>('0');
  const [isClosingSession, setIsClosingSession] = useState(false);
  const [isPendingCardConfirmation, setIsPendingCardConfirmation] = useState(false);
  const [endCashInput, setEndCashInput] = useState('');
  
  // Product Management State
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [isAddingProduct, setIsAddingProduct] = useState(false);
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

      setProducts(p && p.length > 0 ? p : INITIAL_PRODUCTS);
      setTransactions(t || []);
      setSessions(s || []);
      setCompany(c || DEFAULT_COMPANY);

      const openS = s?.find(sess => sess.status === 'OPEN');
      setCurrentSession(openS || null);
    } catch (err) {
      console.error("Data Load Error:", err);
    } font-bold {
      setIsInitialLoading(false);
    }
  };

  useEffect(() => { loadContextData(); }, [activeMode]);

  // Bewaar gegevens lokaal bij wijzigingen
  useEffect(() => {
    if (isAuthenticated && activeMode && !isInitialLoading) {
      apiService.saveProducts(products);
      apiService.saveCompany(company);
      apiService.saveTransactions(transactions);
      apiService.saveSessions(sessions);
    }
  }, [products, company, transactions, sessions, isAuthenticated, activeMode, isInitialLoading]);

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

    if (btConnected) {
      try {
        btPrinterService.printSessionReport(closed, sessionTx, company);
      } catch (e) {
        console.warn("BT session print failed", e);
      }
    }
  };

  // Productbeheer Logica
  const handleSaveProduct = (prod: Product) => {
    if (products.some(p => p.id === prod.id)) {
      setProducts(products.map(p => p.id === prod.id ? { ...prod, updatedAt: Date.now() } : p));
    } else {
      setProducts([...products, { ...prod, updatedAt: Date.now() }]);
    }
    setEditingProduct(null);
    setIsAddingProduct(false);
  };

  const handleDeleteProduct = (id: string) => {
    if (confirm("Weet je zeker dat je dit product wilt verwijderen?")) {
      setProducts(products.filter(p => p.id !== id));
    }
  };

  const deleteSessionFromHistory = (sessionId: string) => {
    const sess = sessions.find(x => x.id === sessionId);
    if (!sess) return;

    if (confirm(`Shift verwijderen?\nID: ${sess.id.slice(-8)}\nBijhorende tickets worden ook gewist.`)) {
      setSessions(prev => prev.filter(s => s.id !== sessionId));
      setTransactions(prev => prev.filter(t => t.sessionId !== sessionId));
      if (previewSession?.id === sessionId) setPreviewSession(null);
    }
  };

  // Mode Selection Window
  if (!activeMode) {
    return (
      <div className="fixed inset-0 bg-slate-950 flex flex-col items-center justify-center p-6 text-center space-y-12">
        <div className="w-24 h-24 bg-indigo-500 rounded-3xl flex items-center justify-center mx-auto shadow-2xl">
          <Store size={48} className="text-white" />
        </div>
        <div>
          <h1 className="text-white text-4xl font-extrabold tracking-tighter">BarPOS</h1>
          <p className="text-slate-500 text-[10px] uppercase tracking-[0.3em] font-black mt-2">Kassa Systeem</p>
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

  // Login PIN Window
  if (!isAuthenticated) {
    return (
      <div className="fixed inset-0 bg-white flex flex-col items-center justify-center p-6">
        <div className="max-w-xs w-full text-center space-y-8">
          <div className={`w-20 h-20 ${themeBg} rounded-2xl flex items-center justify-center mx-auto text-white shadow-xl`}>
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
                className="h-16 rounded-2xl bg-white shadow-sm flex items-center justify-center font-bold text-xl active:scale-90 transition-all"
              >
                {val === 'X' ? <Delete size={20} /> : val}
              </button>
            ))}
          </div>
          <button onClick={() => { setActiveMode(null); setIsAuthenticated(false); }} className="text-slate-400 text-xs font-bold uppercase tracking-widest py-2">
            Terug naar Selectie
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 flex flex-col bg-slate-50 overflow-hidden font-sans select-none">
      {/* Top Header */}
      <header className="h-14 bg-slate-950 flex items-center justify-between px-6 shrink-0 z-50">
        <button
          type="button"
          onClick={() => { if (btConnected) btPrinterService.disconnect(); else btPrinterService.connect(); }}
          className="flex items-center gap-2"
        >
          <div className={`w-2.5 h-2.5 rounded-full ${btConnected ? 'bg-emerald-500' : 'bg-red-500 animate-pulse'}`} />
          <span className="text-white/60 text-[10px] font-bold uppercase tracking-widest hover:text-white">
            {btConnected ? btPrinterService.getDeviceName() : "Printer Verbinden"}
          </span>
        </button>

        <div className="flex items-center gap-3">
          <span className="text-white/40 text-[10px] font-bold uppercase tracking-widest bg-white/10 px-3 py-1 rounded-full">{activeMode}</span>
          <button onClick={() => { setActiveMode(null); setIsAuthenticated(false); }} className="text-white/40 hover:text-white">
            <RefreshCcw size={16} />
          </button>
        </div>
      </header>

      {/* Navigation Tabs */}
      <nav className="h-20 bg-white border-b flex items-center justify-around shrink-0 z-40 shadow-sm">
        <button onClick={() => setActiveTab('POS')} className={`flex flex-col items-center gap-1 transition-all ${activeTab === 'POS' ? themeAccent + ' font-bold scale-105' : 'text-slate-300'}`}>
          <ShoppingBag size={24} /><span className="text-[9px] font-bold uppercase tracking-widest">Kassa</span>
        </button>
        <button onClick={() => setActiveTab('REPORTS')} className={`flex flex-col items-center gap-1 transition-all ${activeTab === 'REPORTS' ? themeAccent + ' font-bold scale-105' : 'text-slate-300'}`}>
          <BarChart3 size={24} /><span className="text-[9px] font-bold uppercase tracking-widest">Historiek</span>
        </button>
        <button onClick={() => setActiveTab('SETTINGS')} className={`flex flex-col items-center gap-1 transition-all ${activeTab === 'SETTINGS' ? themeAccent + ' font-bold scale-105' : 'text-slate-300'}`}>
          <Settings size={24} /><span className="text-[9px] font-bold uppercase tracking-widest">Beheer</span>
        </button>
      </nav>

      <main className="flex-1 overflow-hidden relative">
        {/* TAB 1: POS (KASSA) */}
        {activeTab === 'POS' && (
          <div className="h-full flex flex-col">
            {!currentSession ? (
              <div className="flex-1 flex items-center justify-center p-6">
                <div className="bg-white p-10 rounded-[2.5rem] shadow-2xl text-center max-w-sm w-full space-y-8">
                  <PlayCircle size={48} className={`${themeAccent} mx-auto`} />
                  <h3 className="font-bold text-2xl tracking-tighter">Nieuwe Shift Starten</h3>
                  <div className="text-left space-y-2">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block text-center">Startgeld Kassa (€)</label>
                    <input
                      type="number"
                      step="0.01"
                      value={startFloatAmount}
                      onChange={e => setStartFloatAmount(e.target.value)}
                      className="w-full bg-slate-50 border-2 p-4 rounded-2xl font-bold text-3xl text-center outline-none"
                    />
                  </div>
                  <button
                    onClick={() => {
                      const sess: SalesSession = {
                        id: `SES-${Date.now()}`,
                        startTime: Date.now(),
                        startCash: parseFloat(startFloatAmount) || 0,
                        status: 'OPEN',
                        updatedAt: Date.now()
                      };
                      setCurrentSession(sess);
                      setSessions(prev => [sess, ...prev]);
                    }}
                    className="w-full bg-slate-950 text-white py-5 rounded-2xl font-bold uppercase shadow-xl hover:bg-slate-800 transition-all"
                  >
                    Start Shift
                  </button>
                </div>
              </div>
            ) : (
              <>
                {/* Cart Area */}
                <div className="h-[35%] bg-white border-b flex flex-col overflow-y-auto p-4 space-y-2 shadow-inner">
                  <div className="flex justify-between items-center mb-2 sticky top-0 bg-white z-10 py-1">
                    <button onClick={() => setShowSalesmanSelection(true)} className="flex items-center gap-2 text-[10px] font-black uppercase text-slate-600 bg-slate-100 px-4 py-2 rounded-full border">
                      <User size={12} /> {company.sellerName || "Selecteer Medewerker"} <ChevronDown size={12} />
                    </button>
                    {cart.length > 0 && <button onClick={() => setCart([])} className="text-slate-300 hover:text-red-500"><Trash2 size={18} /></button>}
                  </div>

                  {cart.length === 0 ? (
                    <div className="h-full flex items-center justify-center opacity-20 text-xs font-bold uppercase tracking-widest">Wacht op artikelen...</div>
                  ) : cart.map(item => (
                    <div key={item.id} className="flex items-center justify-between p-3 bg-slate-50 rounded-2xl border">
                      <div>
                        <div className="font-bold text-xs text-slate-800">{item.name}</div>
                        <div className="text-[9px] text-slate-400 font-mono font-bold">€{item.price.toFixed(2)} | BTW {item.vatRate}%</div>
                      </div>
                      <div className="flex items-center gap-3 bg-white p-1 rounded-xl border">
                        <button onClick={() => {
                          const ex = cart.find(i => i.id === item.id);
                          if (ex?.quantity === 1) setCart(cart.filter(i => i.id !== item.id));
                          else setCart(cart.map(i => i.id === item.id ? { ...i, quantity: i.quantity - 1 } : i));
                        }} className="p-1.5"><Minus size={14} /></button>
                        <span className="font-bold text-xs w-4 text-center">{item.quantity}</span>
                        <button onClick={() => setCart(cart.map(i => i.id === item.id ? { ...i, quantity: i.quantity + 1 } : i))} className="p-1.5"><Plus size={14} /></button>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Product Grid */}
                <div className="flex-1 overflow-y-auto p-3 bg-slate-100 grid grid-cols-3 sm:grid-cols-4 gap-2.5 pb-36">
                  {products.map(p => (
                    <button
                      key={p.id}
                      onClick={() => {
                        const ex = cart.find(i => i.id === p.id);
                        if (ex) setCart(cart.map(i => i.id === p.id ? { ...i, quantity: i.quantity + 1 } : i));
                        else setCart([...cart, { ...p, quantity: 1 }]);
                      }}
                      className={`${p.color || 'bg-white'} rounded-2xl border p-3 h-24 flex flex-col items-center justify-center text-center shadow-sm active:scale-95 transition-all`}
                    >
                      <span className="text-[11px] font-bold leading-tight text-slate-900 mb-1 line-clamp-2">{p.name}</span>
                      <span className="text-[10px] font-bold text-slate-950 bg-white/50 px-2 py-0.5 rounded-full font-mono">€{p.price.toFixed(2)}</span>
                      {p.stock !== undefined && <span className="text-[8px] text-slate-500 font-bold mt-1">Voorraad: {p.stock}</span>}
                    </button>
                  ))}
                </div>

                {/* Bottom Checkout Bar */}
                <div className="absolute bottom-0 inset-x-0 p-5 bg-slate-950/95 backdrop-blur-xl rounded-t-[2.5rem] shadow-2xl space-y-3 z-[100]">
                  <div className="flex justify-between items-end text-white px-2">
                    <div>
                      <div className="text-[9px] text-white/40 font-bold uppercase tracking-widest">Totaal</div>
                      <div className="text-3xl font-black font-mono">€{totals.total.toFixed(2)}</div>
                    </div>
                    <div className="text-[9px] text-white/40 font-bold uppercase">BTW Inbegrepen</div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <button onClick={() => initiatePayment(PaymentMethod.CASH)} disabled={cart.length === 0} className="bg-emerald-600 text-white h-14 rounded-2xl font-bold uppercase text-xs flex items-center justify-center gap-2 shadow-lg disabled:opacity-40">
                      <Banknote size={18} /> Contant
                    </button>
                    <button onClick={() => initiatePayment(PaymentMethod.CARD)} disabled={cart.length === 0} className="bg-sky-600 text-white h-14 rounded-2xl font-bold uppercase text-xs flex items-center justify-center gap-2 shadow-lg disabled:opacity-40">
                      <CreditCard size={18} /> Kaart
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>
        )}

        {/* TAB 2: REPORTS (HISTORIEK & SHIFT DETAILS) */}
        {activeTab === 'REPORTS' && (
          <div className="h-full overflow-y-auto p-6 space-y-6 pb-24">
            <h2 className="text-2xl font-extrabold tracking-tight">Shift Historiek</h2>

            {currentSession && (
              <div className="bg-white p-6 rounded-3xl shadow-md border-l-8 border-amber-500 flex justify-between items-center">
                <div>
                  <div className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Lopende Shift</div>
                  <div className="text-2xl font-bold font-mono text-amber-500">
                    €{transactions.filter(t => t.sessionId === currentSession.id).reduce((s, t) => s + t.total, 0).toFixed(2)}
                  </div>
                </div>
                <button onClick={() => setIsClosingSession(true)} className="bg-rose-500 text-white px-5 py-3 rounded-2xl font-bold text-xs uppercase shadow-md">
                  Shift Sluiten
                </button>
              </div>
            )}

            <div className="space-y-3">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block">Afgesloten Shifts</span>
              {sessions.filter(s => s.status === 'CLOSED').length === 0 ? (
                <div className="p-8 text-center bg-white rounded-3xl text-slate-400 text-xs font-bold">Geen historie beschikbaar</div>
              ) : (
                sessions.filter(s => s.status === 'CLOSED').map(sess => (
                  <div key={sess.id} className="bg-white p-5 rounded-3xl border shadow-sm flex items-center justify-between">
                    <div>
                      <div className="font-bold text-slate-800 text-sm">Shift {sess.id.slice(-6)}</div>
                      <div className="text-[10px] text-slate-400 font-bold">
                        {sess.endTime ? new Date(sess.endTime).toLocaleString('nl-NL') : ''}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-bold text-slate-900 text-sm mr-2">€{sess.summary?.totalSales?.toFixed(2) || '0.00'}</span>
                      <button onClick={() => setPreviewSession(sess)} className="p-2 bg-slate-100 text-slate-600 rounded-xl hover:bg-slate-200" title="Rapport Bekijken/Afdrukken">
                        <ReceiptIcon size={16} />
                      </button>
                      <button onClick={() => deleteSessionFromHistory(sess.id)} className="p-2 bg-rose-50 text-rose-500 rounded-xl hover:bg-rose-100" title="Verwijderen">
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {/* TAB 3: SETTINGS (INCLUSIEF PRODUCTBEHEER) */}
        {activeTab === 'SETTINGS' && (
          <div className="h-full overflow-y-auto p-6 space-y-6 pb-24">
            <h2 className="text-2xl font-extrabold tracking-tight">Beheer & Instellingen</h2>

            {/* Productbeheer */}
            <div className="bg-white p-6 rounded-3xl border shadow-sm space-y-4">
              <div className="flex justify-between items-center">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Producten Beheren</span>
                <button
                  onClick={() => {
                    setEditingProduct({ id: `PROD-${Date.now()}`, name: '', price: 0, vatRate: 21, stock: 0, color: 'bg-white' });
                    setIsAddingProduct(true);
                  }}
                  className="bg-indigo-600 text-white px-3 py-1.5 rounded-xl font-bold text-xs flex items-center gap-1"
                >
                  <Plus size={14} /> Nieuw Product
                </button>
              </div>

              <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                {products.map(p => (
                  <div key={p.id} className="flex items-center justify-between p-3 bg-slate-50 rounded-2xl border">
                    <div>
                      <div className="font-bold text-xs text-slate-800">{p.name}</div>
                      <div className="text-[9px] text-slate-400 font-mono">€{p.price.toFixed(2)} | BTW {p.vatRate}% | Voorraad: {p.stock ?? 0}</div>
                    </div>
                    <div className="flex gap-1">
                      <button onClick={() => setEditingProduct(p)} className="p-2 text-slate-600 hover:bg-slate-200 rounded-lg"><Edit2 size={14} /></button>
                      <button onClick={() => handleDeleteProduct(p.id)} className="p-2 text-rose-500 hover:bg-rose-100 rounded-lg"><Trash2 size={14} /></button>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Bedrijfsgegevens */}
            <div className="bg-white p-6 rounded-3xl border shadow-sm space-y-3">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block">Bedrijfsgegevens</span>
              <input
                type="text"
                value={company.name}
                onChange={e => setCompany({ ...company, name: e.target.value, updatedAt: Date.now() })}
                placeholder="Bedrijfsnaam"
                className="w-full bg-slate-50 border p-3 rounded-xl font-bold text-xs"
              />
              <input
                type="text"
                value={company.vatNumber}
                onChange={e => setCompany({ ...company, vatNumber: e.target.value, updatedAt: Date.now() })}
                placeholder="BTW Nummer"
                className="w-full bg-slate-50 border p-3 rounded-xl font-bold text-xs"
              />
            </div>

            {/* Medewerkers */}
            <div className="bg-white p-6 rounded-3xl border shadow-sm space-y-3">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block">Medewerkers</span>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={newStaffName}
                  onChange={e => setNewStaffName(e.target.value)}
                  placeholder="Naam medewerker"
                  className="flex-1 bg-slate-50 border p-3 rounded-xl font-bold text-xs"
                />
                <button onClick={() => {
                  if (!newStaffName) return;
                  setCompany({ ...company, salesmen: [...(company.salesmen || []), newStaffName], updatedAt: Date.now() });
                  setNewStaffName('');
                }} className="bg-indigo-600 text-white px-4 rounded-xl font-bold text-xs">
                  <UserPlus size={16} />
                </button>
              </div>
              <div className="flex flex-wrap gap-2 pt-2">
                {(company.salesmen || []).map(s => (
                  <span key={s} className="bg-slate-100 px-3 py-1 rounded-xl text-xs font-bold text-slate-700 flex items-center gap-2">
                    {s}
                    <button onClick={() => setCompany({ ...company, salesmen: company.salesmen.filter(x => x !== s) })} className="text-slate-400 hover:text-red-500"><UserMinus size={12} /></button>
                  </span>
                ))}
              </div>
            </div>
          </div>
        )}
      </main>

      {/* MODAL: PRODUCT EDIT / ADD */}
      {editingProduct && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md z-[500] flex items-center justify-center p-6">
          <div className="bg-white rounded-[2.5rem] p-6 max-w-sm w-full space-y-4">
            <h3 className="font-extrabold text-lg">{isAddingProduct ? "Nieuw Product" : "Product Bewerken"}</h3>
            <div className="space-y-3">
              <input
                type="text"
                placeholder="Naam"
                value={editingProduct.name}
                onChange={e => setEditingProduct({ ...editingProduct, name: e.target.value })}
                className="w-full bg-slate-50 border p-3 rounded-xl font-bold text-xs"
              />
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[9px] font-bold text-slate-400">Prijs (€)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={editingProduct.price}
                    onChange={e => setEditingProduct({ ...editingProduct, price: parseFloat(e.target.value) || 0 })}
                    className="w-full bg-slate-50 border p-3 rounded-xl font-bold text-xs"
                  />
                </div>
                <div>
                  <label className="text-[9px] font-bold text-slate-400">BTW %</label>
                  <select
                    value={editingProduct.vatRate}
                    onChange={e => setEditingProduct({ ...editingProduct, vatRate: parseInt(e.target.value) })}
                    className="w-full bg-slate-50 border p-3 rounded-xl font-bold text-xs"
                  >
                    <option value={0}>0%</option>
                    <option value={6}>6%</option>
                    <option value={21}>21%</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="text-[9px] font-bold text-slate-400">Voorraad</label>
                <input
                  type="number"
                  value={editingProduct.stock ?? 0}
                  onChange={e => setEditingProduct({ ...editingProduct, stock: parseInt(e.target.value) || 0 })}
                  className="w-full bg-slate-50 border p-3 rounded-xl font-bold text-xs"
                />
              </div>
            </div>
            <div className="flex gap-2 pt-2">
              <button onClick={() => { setEditingProduct(null); setIsAddingProduct(false); }} className="flex-1 py-3 bg-slate-100 rounded-xl font-bold text-xs">Annuleren</button>
              <button onClick={() => handleSaveProduct(editingProduct)} className="flex-1 py-3 bg-indigo-600 text-white rounded-xl font-bold text-xs">Opslaan</button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: SHIFT DETAILS & PRINT PREVIEW */}
      {previewSession && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md z-[500] flex items-center justify-center p-6">
          <div className="bg-white rounded-[2.5rem] p-6 max-w-sm w-full space-y-4">
            <h3 className="font-extrabold text-lg">Shift Rapport</h3>
            <div className="bg-slate-50 p-4 rounded-2xl space-y-2 text-xs font-mono">
              <div className="flex justify-between"><span>Totale Omzet:</span><span className="font-bold">€{previewSession.summary?.totalSales?.toFixed(2)}</span></div>
              <div className="flex justify-between text-slate-500"><span>Contant:</span><span>€{previewSession.summary?.cashTotal?.toFixed(2)}</span></div>
              <div className="flex justify-between text-slate-500"><span>Kaart:</span><span>€{previewSession.summary?.cardTotal?.toFixed(2)}</span></div>
              <div className="border-t pt-2 flex justify-between"><span>Geteld Kasgeld:</span><span className="font-bold">€{previewSession.endCash?.toFixed(2)}</span></div>
            </div>
            <div className="flex gap-2">
              <button onClick={() => setPreviewSession(null)} className="flex-1 py-3 bg-slate-100 rounded-xl font-bold text-xs">Sluiten</button>
              {btConnected && (
                <button onClick={() => {
                  const sessionTx = transactions.filter(t => t.sessionId === previewSession.id);
                  btPrinterService.printSessionReport(previewSession, sessionTx, company);
                }} className="flex-1 py-3 bg-emerald-600 text-white rounded-xl font-bold text-xs flex items-center justify-center gap-1">
                  <Printer size={14} /> Afdrukken
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* MODAL: MEDEWERKER SELECTIE */}
      {showSalesmanSelection && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md z-[500] flex items-center justify-center p-6">
          <div className="bg-white rounded-[2.5rem] p-8 max-w-sm w-full space-y-4">
            <h3 className="font-extrabold text-lg">Selecteer Medewerker</h3>
            <div className="space-y-2">
              {(company.salesmen || ['Kassa Medewerker']).map(name => (
                <button
                  key={name}
                  onClick={() => { setCompany({ ...company, sellerName: name }); setShowSalesmanSelection(false); }}
                  className="w-full p-4 bg-slate-50 border rounded-2xl text-left font-bold text-sm hover:bg-indigo-50 transition-colors"
                >
                  {name}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* MODAL: SHIFT SLUITEN */}
      {isClosingSession && currentSession && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md z-[500] flex items-center justify-center p-6">
          <div className="bg-white rounded-[2.5rem] p-8 max-w-sm w-full space-y-6">
            <h3 className="font-extrabold text-lg">Shift Sluiten</h3>
            <div>
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-2">Geteld Contant Geld (€)</label>
              <input
                type="number"
                step="0.01"
                value={endCashInput}
                onChange={e => setEndCashInput(e.target.value)}
                className="w-full bg-slate-50 border p-4 rounded-2xl font-bold text-2xl outline-none"
                placeholder="0.00"
              />
            </div>
            <div className="flex gap-3">
              <button onClick={() => setIsClosingSession(false)} className="flex-1 py-4 bg-slate-100 text-slate-600 rounded-2xl font-bold text-xs uppercase">Annuleren</button>
              <button onClick={() => closeSession(parseFloat(endCashInput) || 0)} className="flex-1 py-4 bg-rose-600 text-white rounded-2xl font-bold text-xs uppercase shadow-lg">Sluiten & Printen</button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: KAARTBEVESTIGING */}
      {isPendingCardConfirmation && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md z-[500] flex items-center justify-center p-6">
          <div className="bg-white rounded-[2.5rem] p-8 max-w-sm w-full space-y-6 text-center">
            <CreditCard size={48} className="mx-auto text-sky-600" />
            <h3 className="font-extrabold text-lg">Kaartbetaling Bevestigen</h3>
            <p className="text-slate-400 text-xs font-bold">Totaal: €{totals.total.toFixed(2)}</p>
            <div className="flex gap-3">
              <button onClick={() => setIsPendingCardConfirmation(false)} className="flex-1 py-4 bg-slate-100 text-slate-600 rounded-2xl font-bold text-xs uppercase">Annuleren</button>
              <button onClick={() => finalizePayment(PaymentMethod.CARD)} className="flex-1 py-4 bg-sky-600 text-white rounded-2xl font-bold text-xs uppercase shadow-lg">Betaald</button>
            </div>
          </div>
        </div>
      )}

      {/* RECEIPT PREVIEW */}
      {previewTransaction && (
        <Receipt
          transaction={previewTransaction}
          company={company}
          onClose={() => setPreviewTransaction(null)}
        />
      )}
    </div>
  );
}
