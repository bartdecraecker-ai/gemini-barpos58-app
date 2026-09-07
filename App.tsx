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
  
  // Product Edit & Add Form State
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [newProductName, setNewProductName] = useState('');
  const [newProductPrice, setNewProductPrice] = useState('');
  const [newProductVat, setNewProductVat] = useState<number>(21);
  const [newProductColor, setNewProductColor] = useState('bg-white');

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

  const loadContextData = async () => {
    if (!activeMode) return;
    setIsInitialLoading(true);

    try {
      await apiService.hydrateInitialData();

      // Synchro tussen apparaten via delta pull
      const delta = await apiService.serverPullDelta();

      const [p, t, c, s] = await Promise.all([
        apiService.getProducts(),
        apiService.getTransactions(),
        apiService.getCompany(),
        apiService.getSessions(),
      ]);

      const mergedSessions = mergeByIdNewest(s || [], (delta?.sessions as SalesSession[]) || []);
      const mergedTx = mergeByIdNewest(t || [], (delta?.transactions as Transaction[]) || []);

      setProducts(delta?.products?.length ? delta.products : (p && p.length > 0 ? p : INITIAL_PRODUCTS));
      setTransactions(mergedTx);
      setSessions(mergedSessions);
      setCompany(delta?.company || c || DEFAULT_COMPANY);

      // Synchro actieve shift (OPEN status)
      const openS = mergedSessions.find(sess => sess.status === 'OPEN');
      setCurrentSession(openS || null);
    } catch (err) {
      console.error("Data Load Error:", err);
    } finally {
      setIsInitialLoading(false);
    }
  };

  useEffect(() => { loadContextData(); }, [activeMode]);

  // Automatische achtergrond synchronisatie voor actieve shifts tussen telefoon/laptop
  useEffect(() => {
    if (!isAuthenticated || !activeMode) return;

    const syncInterval = setInterval(async () => {
      try {
        const delta = await apiService.serverPullDelta();
        if (delta?.sessions?.length) {
          const merged = mergeByIdNewest(sessions, delta.sessions as SalesSession[]);
          setSessions(merged);
          const openS = merged.find(sess => sess.status === 'OPEN');
          setCurrentSession(openS || null);
        }
        if (delta?.transactions?.length) {
          setTransactions(prev => mergeByIdNewest(prev, delta.transactions as Transaction[]));
        }
      } catch (e) {
        console.warn("Background sync error", e);
      }
    }, 5000);

    return () => clearInterval(syncInterval);
  }, [isAuthenticated, activeMode, sessions]);

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
          setProducts(data.products || []);
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

  const handleBtDisconnect = async () => {
    try {
      await btPrinterService.disconnect();
    } catch (e) {
      console.warn("BT disconnect error", e);
    } finally {
      setBtConnected(false);
    }
  };

  const deleteSessionFromHistory = async (sessionId: string) => {
    const sess = sessions.find(x => x.id === sessionId);
    if (!sess) return;

    const ok = confirm(
      `Shift verwijderen?\n\nDatum: ${
        sess.endTime ? new Date(sess.endTime).toLocaleDateString('nl-NL') : ''
      }\n\nLet op: bijhorende tickets van deze shift worden in de cloud gewist.`
    );
    if (!ok) return;

    setSessions(prev => prev.filter(s => s.id !== sessionId));
    setTransactions(prev => prev.filter(t => t.sessionId !== sessionId));

    if (previewSession?.id === sessionId) setPreviewSession(null);

    try {
      setSyncStatus('SYNCING');
      await apiService.serverDeleteSession(sessionId);
      setSyncStatus('SUCCESS');
    } catch (e) {
      console.error("Server delete session failed", e);
      setSyncStatus('ERROR');
    } finally {
      setTimeout(() => setSyncStatus('IDLE'), 2000);
    }
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

    if (method === PaymentMethod.CARD) {
      setIsPendingCardConfirmation(true);
    } else {
      finalizePayment(PaymentMethod.CASH);
    }
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
    // Geen random ID voor het ticketnummer, maar een simpele leesbare tijdcode
    const dateObj = new Date(now);
    const formattedDate = dateObj.toLocaleDateString('nl-NL');
    const formattedTime = dateObj.toLocaleTimeString('nl-NL', { hour: '2-digit', minute: '2-digit' });

    const tx: Transaction = {
      id: `${formattedTime}`, // Alleen tijd op het ticket i.p.v. random string
      sessionId: currentSession!.id,
      timestamp: now,
      dateStr: formattedDate,
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

      if (delta?.products?.length) setProducts(prev => mergeByIdNewest(prev, delta.products));
      if (delta?.transactions?.length) setTransactions(prev => mergeByIdNewest(prev, delta.transactions as any));
      if (delta?.sessions?.length) setSessions(prev => mergeByIdNewest(prev, delta.sessions as any));
      if (delta?.company) setCompany(delta.company as any);
    } catch (e) {
      console.warn("Server sale sync failed", e);
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
    const cashTotal  = sessionTx.filter(t => t.paymentMethod === PaymentMethod.CASH).reduce((s, t) => s + (t.total || 0), 0);
    const cardTotal  = sessionTx.filter(t => t.paymentMethod === PaymentMethod.CARD).reduce((s, t) => s + (t.total || 0), 0);

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

  const handleSaveProduct = () => {
    if (!newProductName || !newProductPrice) return;

    const price = parseFloat(newProductPrice) || 0;
    if (editingProduct) {
      setProducts(products.map(p => p.id === editingProduct.id ? {
        ...p,
        name: newProductName,
        price,
        vatRate: newProductVat,
        color: newProductColor,
        updatedAt: Date.now()
      } : p));
      setEditingProduct(null);
    } else {
      const p: Product = {
        id: `PROD-${Date.now()}`,
        name: newProductName,
        price,
        vatRate: newProductVat,
        color: newProductColor,
        updatedAt: Date.now()
      };
      setProducts([...products, p]);
    }

    setNewProductName('');
    setNewProductPrice('');
    setNewProductVat(21);
    setNewProductColor('bg-white');
  };

  const handleEditProductClick = (p: Product) => {
    setEditingProduct(p);
    setNewProductName(p.name);
    setNewProductPrice(p.price.toString());
    setNewProductVat(p.vatRate);
    setNewProductColor(p.color || 'bg-white');
  };

  const handleDeleteProduct = (id: string) => {
    if (!confirm("Product verwijderen?")) return;
    setProducts(products.filter(p => p.id !== id));
  };

  const addStaff = () => {
    if (!newStaffName) return;
    setCompany({ ...company, salesmen: [...(company.salesmen || []), newStaffName], updatedAt: Date.now() });
    setNewStaffName('');
  };

  const removeStaff = (name: string) => {
    setCompany({ ...company, salesmen: (company.salesmen || []).filter(s => s !== name), updatedAt: Date.now() });
  };

  const handlePrintBrowserTicket = (tx: Transaction) => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    printWindow.document.write(`
      <html>
        <head>
          <title>Kassaticket</title>
          <style>
            body { font-family: monospace; padding: 20px; width: 280px; margin: 0 auto; text-align: center; }
            .header { font-weight: bold; font-size: 14px; margin-bottom: 3px; }
            .address { font-size: 11px; margin-bottom: 2px; }
            .info { font-size: 10px; margin-top: 8px; margin-bottom: 10px; border-bottom: 1px dashed #000; padding-bottom: 5px; }
            .item { display: flex; justify-content: space-between; font-size: 11px; margin: 3px 0; }
            .totals { border-top: 1px dashed #000; margin-top: 10px; padding-top: 5px; text-align: right; font-size: 12px; font-weight: bold; }
            .footer { margin-top: 15px; font-size: 10px; border-top: 1px dashed #000; padding-top: 5px; }
          </style>
        </head>
        <body>
          <div class="header">${company.name}</div>
          ${company.address ? `<div class="address">${company.address}</div>` : ''}
          ${company.address2 ? `<div class="address">${company.address2}</div>` : ''}
          ${company.vatNumber ? `<div class="address">BTW: ${company.vatNumber}</div>` : ''}
          ${company.receiptHeader ? `<div class="footer">${company.receiptHeader}</div>` : ''}
          <div class="info">
            <div>Datum: ${tx.dateStr} ${tx.id}</div>
            <div>Bediende: ${tx.salesmanName || 'Kassa'}</div>
          </div>
          ${tx.items.map(i => `<div class="item"><span>${i.quantity}x ${i.name}</span><span>€${(i.price * i.quantity).toFixed(2)}</span></div>`).join('')}
          <div class="totals">
            <div>Totaal: €${tx.total.toFixed(2)}</div>
            <div style="font-size: 10px; font-weight: normal;">Betaalmethode: ${tx.paymentMethod}</div>
          </div>
          <div class="footer">${company.receiptFooter || 'Bedankt voor uw bezoek!'}</div>
        </body>
      </html>
    `);
    printWindow.document.close();
    printWindow.print();
  };

  // MODE SELECTION
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

  // LOGIN
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

  // MAIN APP
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

        {/* TAB 1: POS / KASSA */}
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
                        <div className="text-[9px] text-slate-400 font-mono">€{item.price.toFixed(2)} | BTW {item.vatRate}%</div>
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
                  {products.map(p => (
                    <button
                      key={p.id}
                      onClick={() => {
                        const ex = cart.find(i => i.id === p.id);
                        if (ex) setCart(cart.map(i => i.id === p.id ? { ...i, quantity: i.quantity + 1 } : i));
                        else setCart([...cart, { ...p, quantity: 1, vatRate: p.vatRate }]);
                      }}
                      className={`${p.color || 'bg-white'} rounded-2xl border-b-2 border-black/10 p-2 h-24 flex flex-col items-center justify-center text-center active:scale-95 transition-all shadow-sm group relative overflow-hidden`}
                    >
                      <span className="text-[10px] font-black leading-tight text-slate-900 mb-1 line-clamp-2">{p.name}</span>
                      <span className="text-[9px] font-bold text-slate-950 bg-white/40 px-1.5 py-0.5 rounded-full font-mono border border-black/5">€{p.price.toFixed(2)}</span>
                    </button>
                  ))}
                </div>

                <div className="absolute bottom-0 inset-x-0 p-6 bg-slate-950/95 backdrop-blur-xl rounded-t-[3rem] shadow-2xl space-y-4 border-t border-white/5 z-[100]">
                  <div className="flex justify-between items-end text-white px-2">
                    <div className="flex flex-col">
                      <div className="text-[10px] text-white/40 font-black uppercase tracking-[0.2em] mb-1">Totaal</div>
                      <div className="text-4xl font-black font-mono tracking-tighter tabular-nums">€{totals.total.toFixed(2)}</div>
                    </div>
                    <div className="text-[10px] text-white/30 font-bold uppercase">BTW Incl.</div>
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

        {/* TAB 2: REPORTS / HISTORIEK */}
        {activeTab === 'REPORTS' && (
          <div className="h-full overflow-y-auto p-6 space-y-6 pb-24 custom-scrollbar">
            <h2 className="text-2xl font-black tracking-tighter">Shift Historiek</h2>

            {currentSession && (
              <div className="bg-white p-7 rounded-[2.5rem] shadow-xl border-l-[10px] border-amber-500 flex justify-between items-center">
                <div>
                  <div className="text-[10px] text-slate-400 font-black uppercase tracking-widest">Actieve Shift</div>
                  <div className="text-3xl font-black font-mono text-amber-500">
                    €{transactions.filter(t => t.sessionId === currentSession.id).reduce((s, t) => s + t.total, 0).toFixed(2)}
                  </div>
                </div>
                <button onClick={() => setIsClosingSession(true)} className="bg-rose-500 text-white px-6 py-4 rounded-2xl font-black text-xs uppercase shadow-lg active:scale-95 border-b-4 border-rose-700">
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
                        <div className="font-bold text-sm text-slate-800">{new Date(s.endTime!).toLocaleDateString('nl-NL')}</div>
                        <div className="text-[10px] text-slate-400 uppercase font-black tracking-tighter">Shift Afgesloten</div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="font-black text-emerald-600 font-mono text-xl">€{(s.summary?.totalSales || 0).toFixed(2)}</div>
                      <div className="text-[10px] text-slate-400 font-bold uppercase">{s.summary?.transactionCount} tickets</div>
                    </div>
                  </div>

                  <div className="flex justify-end gap-3 mt-5 pt-4 border-t border-slate-50">
                    <button onClick={() => setPreviewSession(s)} className="flex items-center gap-2 px-4 py-2 bg-slate-50 text-slate-600 rounded-xl font-bold text-[10px] uppercase hover:bg-indigo-50 hover:text-indigo-600 transition-all">
                      <ReceiptIcon size={14} /> Bekijk Rapport
                    </button>
                    <button onClick={() => deleteSessionFromHistory(s.id)} className="flex items-center gap-2 px-4 py-2 bg-rose-50 text-rose-600 rounded-xl font-bold text-[10px] uppercase hover:bg-rose-100 transition-all">
                      <Trash2 size={14} /> Wis
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* TAB 3: SETTINGS / BEHEER */}
        {activeTab === 'SETTINGS' && (
          <div className="h-full overflow-y-auto p-6 space-y-8 pb-32 custom-scrollbar">
            <h2 className="text-2xl font-black tracking-tighter">Systeem Beheer</h2>

            {/* PRODUCT BEHEER */}
            <div className="bg-white p-6 rounded-[2.5rem] border border-slate-100 shadow-sm space-y-6">
              <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                <Package size={20} className={themeAccent} /> {editingProduct ? "Product Bewerken" : "Nieuw Product Toevoegen"}
              </h3>

              <div className="grid grid-cols-1 gap-4">
                <input
                  type="text"
                  placeholder="Productnaam"
                  value={newProductName}
                  onChange={e => setNewProductName(e.target.value)}
                  className="bg-slate-50 border border-slate-200 p-4 rounded-2xl font-bold text-sm outline-none focus:border-indigo-500"
                />
                <div className="grid grid-cols-2 gap-4">
                  <input
                    type="number"
                    step="0.01"
                    placeholder="Prijs (€)"
                    value={newProductPrice}
                    onChange={e => setNewProductPrice(e.target.value)}
                    className="bg-slate-50 border border-slate-200 p-4 rounded-2xl font-bold text-sm outline-none focus:border-indigo-500"
                  />
                  <select
                    value={newProductVat}
                    onChange={e => setNewProductVat(Number(e.target.value))}
                    className="bg-slate-50 border border-slate-200 p-4 rounded-2xl font-bold text-sm outline-none focus:border-indigo-500"
                  >
                    <option value={21}>21% BTW</option>
                    <option value={0}>0% BTW</option>
                  </select>
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Kleur Kies</label>
                  <div className="flex gap-2 overflow-x-auto py-1">
                    {AVAILABLE_COLORS.map(c => (
                      <button
                        key={c}
                        onClick={() => setNewProductColor(c)}
                        className={`w-10 h-10 rounded-xl border-2 transition-all ${c} ${newProductColor === c ? 'border-indigo-600 scale-110 shadow-md' : 'border-slate-200'}`}
                      />
                    ))}
                  </div>
                </div>

                <button onClick={handleSaveProduct} className="bg-slate-950 text-white p-4 rounded-2xl font-bold uppercase text-xs flex items-center justify-center gap-2 shadow-lg active:scale-95 transition-all">
                  <PlusCircle size={16} /> {editingProduct ? "Opslaan" : "Product Toevoegen"}
                </button>
              </div>

              <div className="border-t border-slate-100 pt-4 space-y-2">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Bestaande Producten</label>
                <div className="space-y-2 max-h-60 overflow-y-auto">
                  {products.map(p => (
                    <div key={p.id} className="flex items-center justify-between p-3 bg-slate-50 rounded-2xl border border-slate-100">
                      <div>
                        <div className="font-bold text-xs">{p.name}</div>
                        <div className="text-[9px] text-slate-400">€{p.price.toFixed(2)} | {p.vatRate}% BTW</div>
                      </div>
                      <div className="flex gap-2">
                        <button onClick={() => handleEditProductClick(p)} className="p-2 text-slate-400 hover:text-indigo-600"><Edit2 size={16} /></button>
                        <button onClick={() => handleDeleteProduct(p.id)} className="p-2 text-slate-400 hover:text-rose-600"><Trash2 size={16} /></button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* TICKET BEHEER (Met Adresregel 1 & 2) */}
            <div className="bg-white p-6 rounded-[2.5rem] border border-slate-100 shadow-sm space-y-4">
              <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                <ReceiptIcon size={20} className={themeAccent} /> Ticket Instellingen
              </h3>
              <div className="space-y-3">
                <div>
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-1">Adresregel 1</label>
                  <input
                    type="text"
                    value={company.address || ''}
                    onChange={e => setCompany({ ...company, address: e.target.value, updatedAt: Date.now() })}
                    placeholder="Straat en huisnummer"
                    className="w-full bg-slate-50 border border-slate-200 p-4 rounded-2xl font-bold text-sm outline-none"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-1">Adresregel 2 (Postcode & Gemeente)</label>
                  <input
                    type="text"
                    value={company.address2 || ''}
                    onChange={e => setCompany({ ...company, address2: e.target.value, updatedAt: Date.now() })}
                    placeholder="bijv. 9300 Aalst"
                    className="w-full bg-slate-50 border border-slate-200 p-4 rounded-2xl font-bold text-sm outline-none"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-1">Header Tekst (Bovenaan Ticket)</label>
                  <input
                    type="text"
                    value={company.receiptHeader || ''}
                    onChange={e => setCompany({ ...company, receiptHeader: e.target.value, updatedAt: Date.now() })}
                    placeholder="bijv. Welkom bij Kraukerbier"
                    className="w-full bg-slate-50 border border-slate-200 p-4 rounded-2xl font-bold text-sm outline-none"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-1">Footer Tekst (Onderaan Ticket)</label>
                  <input
                    type="text"
                    value={company.receiptFooter || ''}
                    onChange={e => setCompany({ ...company, receiptFooter: e.target.value, updatedAt: Date.now() })}
                    placeholder="bijv. Bedankt voor uw bezoek!"
                    className="w-full bg-slate-50 border border-slate-200 p-4 rounded-2xl font-bold text-sm outline-none"
                  />
                </div>
              </div>
            </div>

            {/* MEDEWERKERS BEHEER */}
            <div className="bg-white p-6 rounded-[2.5rem] border border-slate-100 shadow-sm space-y-4">
              <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                <User size={20} className={themeAccent} /> Medewerkers
              </h3>
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="Naam medewerker"
                  value={newStaffName}
                  onChange={e => setNewStaffName(e.target.value)}
                  className="flex-1 bg-slate-50 border border-slate-200 p-4 rounded-2xl font-bold text-sm outline-none"
                />
                <button onClick={addStaff} className="bg-slate-950 text-white px-6 rounded-2xl font-bold uppercase text-xs">Toevoegen</button>
              </div>
              <div className="flex flex-wrap gap-2">
                {(company.salesmen || []).map(s => (
                  <span key={s} className="bg-slate-100 text-slate-800 text-xs font-bold px-4 py-2 rounded-xl flex items-center gap-2">
                    {s} <button onClick={() => removeStaff(s)} className="text-slate-400 hover:text-rose-500"><X size={14} /></button>
                  </span>
                ))}
              </div>
            </div>
          </div>
        )}
      </main>

      {/* MODAL: KAARTBETALING BEVESTIGING */}
      {isPendingCardConfirmation && (
        <div className="fixed inset-0 z-[600] bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-6 animate-in fade-in">
          <div className="bg-white p-8 rounded-[2.5rem] max-w-sm w-full text-center space-y-6 shadow-2xl animate-in zoom-in-95">
            <div className="w-16 h-16 bg-sky-100 text-sky-600 rounded-full flex items-center justify-center mx-auto">
              <CreditCard size={32} />
            </div>
            <div>
              <h3 className="text-2xl font-black text-slate-900">Kaartbetaling</h3>
              <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mt-1">Bied de terminal aan de klant aan</p>
            </div>
            <div className="bg-slate-50 p-6 rounded-3xl border border-slate-100">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-1">Te betalen bedrag</span>
              <span className="text-4xl font-black font-mono text-slate-900">€{totals.total.toFixed(2)}</span>
            </div>
            <div className="flex gap-3">
              <button 
                onClick={() => setIsPendingCardConfirmation(false)} 
                className="flex-1 bg-slate-100 text-slate-600 py-4 rounded-2xl font-bold text-xs uppercase hover:bg-slate-200 transition-all"
              >
                Annuleren
              </button>
              <button 
                onClick={() => finalizePayment(PaymentMethod.CARD)} 
                className="flex-1 bg-sky-600 text-white py-4 rounded-2xl font-bold text-xs uppercase shadow-lg border-b-4 border-sky-800 active:scale-95 transition-all"
              >
                Ontvangen
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: SHIFT SLUITEN */}
      {isClosingSession && (
        <div className="fixed inset-0 z-[600] bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-6">
          <div className="bg-white p-8 rounded-[2.5rem] max-w-sm w-full text-center space-y-6">
            <h3 className="text-2xl font-black">Shift Sluiten</h3>
            <div className="text-left space-y-2">
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block text-center">Geteld Kasgeld (€)</label>
              <input
                type="number"
                step="0.01"
                value={endCashInput}
                onChange={e => setEndCashInput(e.target.value)}
                className="w-full bg-slate-50 border-2 p-5 rounded-3xl font-bold text-3xl outline-none text-center"
              />
            </div>
            <div className="flex gap-3">
              <button onClick={() => setIsClosingSession(false)} className="flex-1 bg-slate-100 text-slate-600 py-4 rounded-2xl font-bold text-xs uppercase">Annuleren</button>
              <button onClick={() => closeSession(parseFloat(endCashInput) || 0)} className="flex-1 bg-rose-500 text-white py-4 rounded-2xl font-bold text-xs uppercase shadow-lg border-b-4 border-rose-700">Bevestigen</button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: VERKOPER SELECTIE */}
      {showSalesmanSelection && (
        <div className="fixed inset-0 z-[600] bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-6">
          <div className="bg-white p-8 rounded-[2.5rem] max-w-sm w-full text-center space-y-6">
            <h3 className="text-xl font-bold">Selecteer Medewerker</h3>
            <div className="grid grid-cols-1 gap-3">
              {(company.salesmen || []).map(s => (
                <button
                  key={s}
                  onClick={() => {
                    setCompany({ ...company, sellerName: s });
                    setShowSalesmanSelection(false);
                  }}
                  className="bg-slate-50 border p-4 rounded-2xl font-bold text-sm hover:bg-indigo-50 hover:border-indigo-200 transition-all"
                >
                  {s}
                </button>
              ))}
            </div>
            <button onClick={() => setShowSalesmanSelection(false)} className="text-slate-400 text-xs font-bold uppercase">Sluiten</button>
          </div>
        </div>
      )}

      {/* MODAL: TICKET PREVIEW & BROWSER PRINT */}
      {previewTransaction && (
        <div className="fixed inset-0 z-[600] bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-6">
          <div className="bg-white p-8 rounded-[2.5rem] max-w-sm w-full space-y-6">
            <Receipt transaction={previewTransaction} company={company} />
            <div className="flex gap-3">
              <button onClick={() => setPreviewTransaction(null)} className="flex-1 bg-slate-100 py-4 rounded-2xl font-bold text-xs uppercase">Sluiten</button>
              <button onClick={() => handlePrintBrowserTicket(previewTransaction)} className="flex-1 bg-slate-950 text-white py-4 rounded-2xl font-bold text-xs uppercase flex items-center justify-center gap-2">
                <Printer size={16} /> Print Ticket
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
