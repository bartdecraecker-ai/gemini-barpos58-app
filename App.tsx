
import React, { useState, useEffect, useMemo } from 'react';
import { 
  ShoppingBag, 
  Trash2, 
  CreditCard, 
  Banknote, 
  BarChart3, 
  Settings, 
  Plus, 
  Minus, 
  X, 
  CheckCircle, 
  PlayCircle, 
  LogOut, 
  KeyRound, 
  RefreshCcw, 
  Archive,
  Loader2,
  Building2,
  User,
  Users,
  ChevronDown,
  UserPlus,
  Lock,
  History,
  Printer,
  Eye,
  Bluetooth,
  Palette
} from 'lucide-react';
import { Product, CartItem, Transaction, PaymentMethod, CompanyDetails, SalesSession, DailySummary } from './types';
import { DEFAULT_COMPANY, INITIAL_PRODUCTS, AVAILABLE_COLORS } from './constants';
import { Receipt } from './components/Receipt';
import { apiService } from './services/api';
import { btPrinterService } from './services/bluetoothPrinter';

export default function App() {
  // Authentication
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [loginInput, setLoginInput] = useState('');
  const [loginError, setLoginError] = useState(false);

  // App Data
  const [products, setProducts] = useState<Product[]>([]);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [sessions, setSessions] = useState<SalesSession[]>([]);
  const [company, setCompany] = useState<CompanyDetails>(DEFAULT_COMPANY);
  
  // Navigation & UI
  const [activeTab, setActiveTab] = useState<'POS' | 'REPORTS' | 'SETTINGS'>('POS');
  const [isInitialLoading, setIsInitialLoading] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);
  
  // Bluetooth State
  const [btConnected, setBtConnected] = useState(false);
  const [isConnectingBt, setIsConnectingBt] = useState(false);
  const [isPrintingBt, setIsPrintingBt] = useState(false);

  // Transactional States
  const [currentSession, setCurrentSession] = useState<SalesSession | null>(null);
  const [lastTransaction, setLastTransaction] = useState<Transaction | null>(null);
  const [showSuccess, setShowSuccess] = useState(false);
  const [isProcessingCard, setIsProcessingCard] = useState(false);
  const [showCardPrompt, setShowCardPrompt] = useState(false);
  const [previewTransaction, setPreviewTransaction] = useState<Transaction | null>(null);
  const [viewingSession, setViewingSession] = useState<SalesSession | null>(null);
  const [showSalesmanSelection, setShowSalesmanSelection] = useState(false);
  const [newSalesmanName, setNewSalesmanName] = useState('');

  // Form States
  const [startFloatAmount, setStartFloatAmount] = useState<string>('0');
  const [endCountAmount, setEndCountAmount] = useState<string>('');

  // Initial Data Fetch
  useEffect(() => {
    const init = async () => {
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
        setCompany(c || { ...DEFAULT_COMPANY, masterPassword: '1984', updatedAt: Date.now() });
        setSessions(s || []);
        const openS = s?.find(sess => sess.status === 'OPEN');
        setCurrentSession(openS || null);
        setBtConnected(btPrinterService.isConnected());
      } finally {
        setIsInitialLoading(false);
      }
    };
    init();
  }, []);

  // Background Sync
  useEffect(() => {
    if (isInitialLoading || !isAuthenticated) return;
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
    const timer = setTimeout(triggerSync, 1500);
    return () => clearTimeout(timer);
  }, [products, transactions, sessions, company, isAuthenticated, isInitialLoading]);

  // Security
  const handleLogin = (val: string) => {
    // Priority check: company data from server/localStorage, fallback to 1984
    const validPassword = company.masterPassword || '1984';
    if (val === validPassword) {
      setIsAuthenticated(true);
      setLoginInput('');
    } else {
      setLoginError(true);
      setLoginInput('');
      setTimeout(() => setLoginError(false), 500);
    }
  };

  // Salesman Logic
  const addSalesman = () => {
    const name = newSalesmanName.trim();
    if (!name || company.salesmen?.includes(name)) return;
    setCompany(prev => ({ ...prev, salesmen: [...(prev.salesmen || []), name], updatedAt: Date.now() }));
    setNewSalesmanName('');
  };
  const removeSalesman = (name: string) => setCompany(prev => ({ ...prev, salesmen: prev.salesmen?.filter(n => n !== name) || [], updatedAt: Date.now() }));
  const selectSalesman = (name: string) => { setCompany(prev => ({ ...prev, sellerName: name, updatedAt: Date.now() })); setShowSalesmanSelection(false); };

  // Bluetooth Logic
  const handleBluetoothConnect = async () => {
    setIsConnectingBt(true);
    try {
      const success = await btPrinterService.connect();
      setBtConnected(success);
    } catch (err) {
      alert("Printer verbinding mislukt.");
    } finally {
      setIsConnectingBt(false);
    }
  };

  const handleBtReceiptPrint = async (tx: Transaction) => {
    if (!btConnected && !btPrinterService.isConnected()) return;
    setIsPrintingBt(true);
    try {
      await btPrinterService.printReceipt(tx, company);
    } catch (e) {
      console.error("Print ticket failed", e);
    } finally {
      setIsPrintingBt(false);
    }
  };

  const handleBtSessionPrint = async (session: SalesSession) => {
    if (!btConnected && !btPrinterService.isConnected()) {
      alert("Printer niet verbonden.");
      return;
    }
    setIsPrintingBt(true);
    try {
      const sessionTx = transactions.filter(t => t.sessionId === session.id);
      await btPrinterService.printSessionReport(session, sessionTx, company);
    } catch (e) {
      alert("Afdrukken rapport mislukt.");
    } finally {
      setIsPrintingBt(false);
    }
  };

  // Session Logic
  const handleOpenSession = () => {
    const s: SalesSession = {
      id: `S${Date.now()}`,
      startTime: Date.now(),
      startCash: parseFloat(startFloatAmount) || 0,
      status: 'OPEN',
      updatedAt: Date.now()
    };
    setSessions(prev => [s, ...prev]);
    setCurrentSession(s);
  };

  const calculateSessionTotals = (sessionId: string, startCash: number) => {
    const sessionTx = transactions.filter(t => t.sessionId === sessionId);
    const summary: DailySummary = sessionTx.reduce((acc, tx) => ({
      totalSales: acc.totalSales + tx.total,
      transactionCount: acc.transactionCount + 1,
      cashTotal: acc.cashTotal + (tx.paymentMethod === PaymentMethod.CASH ? tx.total : 0),
      cardTotal: acc.cardTotal + (tx.paymentMethod === PaymentMethod.CARD ? tx.total : 0),
      vat0Total: acc.vat0Total + tx.vat0,
      vat21Total: acc.vat21Total + tx.vat21,
    }), { totalSales: 0, transactionCount: 0, cashTotal: 0, cardTotal: 0, vat0Total: 0, vat21Total: 0 });
    
    if (sessionTx.length > 0) {
      summary.firstTicketId = sessionTx[sessionTx.length - 1].id;
      summary.lastTicketId = sessionTx[0].id;
    }

    const expectedDrawer = startCash + summary.cashTotal;
    return { summary, expectedDrawer };
  };

  const handleCloseSession = () => {
    if (!currentSession) return;
    const endFloat = parseFloat(endCountAmount.replace(',', '.')) || 0;
    const { summary, expectedDrawer } = calculateSessionTotals(currentSession.id, currentSession.startCash);
    
    const closed: SalesSession = {
      ...currentSession,
      endTime: Date.now(),
      status: 'CLOSED',
      endCash: endFloat,
      expectedCash: expectedDrawer,
      summary: summary,
      updatedAt: Date.now()
    };
    
    setSessions(prev => prev.map(s => s.id === currentSession.id ? closed : s));
    setCurrentSession(null);
    setEndCountAmount('');
    setActiveTab('REPORTS');
  };

  // Viewing Session Product Breakdown
  const viewingSessionProductSales = useMemo(() => {
    if (!viewingSession) return [];
    const sales: Record<string, number> = {};
    transactions.filter(t => t.sessionId === viewingSession.id).forEach(tx => {
       tx.items.forEach(item => {
         sales[item.name] = (sales[item.name] || 0) + item.quantity;
       });
    });
    return Object.entries(sales).map(([name, qty]) => ({ name, qty })).sort((a, b) => b.qty - a.qty);
  }, [viewingSession, transactions]);

  // Cart & POS
  const addToCart = (product: Product) => {
    setCart(prev => {
      const ex = prev.find(i => i.id === product.id);
      if (ex) return prev.map(i => i.id === product.id ? { ...i, quantity: i.quantity + 1 } : i);
      return [...prev, { ...product, quantity: 1 }];
    });
  };
  const updateQty = (id: string, delta: number) => {
    setCart(prev => {
      const item = prev.find(i => i.id === id);
      if (!item) return prev;
      const nq = item.quantity + delta;
      return nq <= 0 ? prev.filter(i => i.id !== id) : prev.map(i => i.id === id ? { ...i, quantity: nq } : i);
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
      id: `AM${new Date().getFullYear()}-${String((parseInt(localStorage.getItem('seq') || '0')) + 1).padStart(4, '0')}`,
      sessionId: currentSession.id,
      timestamp: now,
      dateStr: new Date().toLocaleDateString('nl-NL'),
      items: [...cart],
      subtotal: totals.net,
      vat0: totals.v0,
      vat21: totals.v21,
      total: totals.total,
      paymentMethod: method,
      updatedAt: now
    };
    localStorage.setItem('seq', (parseInt(localStorage.getItem('seq') || '0') + 1).toString());
    setTransactions(prev => [tx, ...prev]);
    setProducts(prev => prev.map(p => {
      const ci = cart.find(c => c.id === p.id);
      return ci ? { ...p, stock: (p.stock || 0) - ci.quantity, updatedAt: now } : p;
    }));
    
    setLastTransaction(tx);
    setCart([]);
    setShowCardPrompt(false);
    setIsProcessingCard(false);
    setShowSuccess(true);
    
    // Auto-print if connected
    if (btConnected) handleBtReceiptPrint(tx);
    
    setTimeout(() => setShowSuccess(false), 2000);
    setPreviewTransaction(tx);
  };

  const updateProduct = (id: string, f: keyof Product, v: any) => setProducts(p => p.map(x => x.id === id ? { ...x, [f]: v, updatedAt: Date.now() } : x));
  const deleteProduct = (id: string) => setProducts(prev => prev.filter(p => p.id !== id));
  const addProduct = () => {
    if (products.length >= 10) return alert("Max 10.");
    const p: Product = { id: Date.now().toString(), name: "Nieuw", price: 0, vatRate: 21, color: AVAILABLE_COLORS[0], stock: 0, updatedAt: Date.now() };
    setProducts(prev => [...prev, p]);
  };

  if (!isAuthenticated) {
    return (
      <div className="fixed inset-0 z-[500] bg-slate-950 flex flex-col items-center justify-center p-4">
        <div className={`relative bg-white/5 backdrop-blur-2xl p-8 rounded-[3.5rem] border border-white/10 shadow-2xl w-full max-sm:max-w-xs max-w-sm text-center ${loginError ? 'animate-shake' : 'animate-in zoom-in-95'}`}>
          <div className="w-16 h-16 bg-amber-500 rounded-3xl flex items-center justify-center mx-auto mb-6 shadow-xl shadow-amber-500/20"><KeyRound size={32} className="text-white" /></div>
          <h1 className="text-2xl font-black text-white mb-2 tracking-tight uppercase">BAR POS</h1>
          <p className="text-slate-400 text-xs mb-8 font-bold uppercase tracking-widest">Toegangscode</p>
          <div className="flex justify-center gap-4 mb-10">
            {[...Array(4)].map((_, i) => (<div key={i} className={`w-3 h-3 rounded-full border-2 ${loginInput.length > i ? 'bg-amber-500 border-amber-500 scale-125 shadow-[0_0_10px_rgba(245,158,11,0.5)]' : 'bg-white/10 border-white/20'}`} />))}
          </div>
          <div className="grid grid-cols-3 gap-3">
            {['1','2','3','4','5','6','7','8','9','C','0','OK'].map(k => (
              <button key={k} onClick={() => {
                if(k === 'C') setLoginInput('');
                else if(k === 'OK') handleLogin(loginInput);
                else if(loginInput.length < 4) setLoginInput(loginInput + k);
              }} className={`h-14 rounded-2xl font-black text-xl flex items-center justify-center transition-all active:scale-90 ${k === 'OK' ? 'bg-amber-500 text-black shadow-lg shadow-amber-500/20' : 'bg-white/5 text-white border border-white/10'}`}>{k}</button>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 flex flex-col bg-slate-100 overflow-hidden font-sans">
      
      {/* --- TOP NAV --- */}
      <nav className="h-20 bg-slate-950 text-white flex items-center justify-around shrink-0 z-50 shadow-lg px-2 border-b border-white/5">
        <button onClick={() => setActiveTab('POS')} className={`flex flex-col items-center justify-center w-24 h-full transition-all gap-1 ${activeTab === 'POS' ? 'text-amber-500' : 'text-slate-400'}`}>
          <ShoppingBag size={24} className={activeTab === 'POS' ? 'scale-110' : ''} />
          <span className="text-[10px] font-black uppercase tracking-widest">Verkoop</span>
        </button>
        <button onClick={() => setActiveTab('REPORTS')} className={`flex flex-col items-center justify-center w-24 h-full transition-all gap-1 ${activeTab === 'REPORTS' ? 'text-amber-500' : 'text-slate-400'}`}>
          <BarChart3 size={24} className={activeTab === 'REPORTS' ? 'scale-110' : ''} />
          <span className="text-[10px] font-black uppercase tracking-widest">Status</span>
        </button>
        <button onClick={() => setActiveTab('SETTINGS')} className={`flex flex-col items-center justify-center w-24 h-full transition-all gap-1 ${activeTab === 'SETTINGS' ? 'text-amber-500' : 'text-slate-400'}`}>
          <Settings size={24} className={activeTab === 'SETTINGS' ? 'scale-110' : ''} />
          <span className="text-[10px] font-black uppercase tracking-widest">Opties</span>
        </button>
      </nav>

      {/* --- CONTENT --- */}
      <main className="flex-1 overflow-hidden flex flex-col relative">
        
        {activeTab === 'POS' && (
          <div className="h-full flex flex-col">
            {!currentSession ? (
              <div className="flex-1 flex items-center justify-center p-4">
                <div className="bg-white p-8 rounded-[2.5rem] shadow-xl border border-slate-200 text-center max-w-sm w-full animate-in zoom-in-95">
                   <div className="w-16 h-16 bg-amber-100 text-amber-600 rounded-3xl flex items-center justify-center mx-auto mb-6"><PlayCircle size={32} /></div>
                   <h3 className="font-black text-2xl mb-2 uppercase">Kassa Openen</h3>
                   <p className="text-slate-400 text-xs mb-8 uppercase font-bold tracking-widest">Klaar voor de dag?</p>
                   <div className="mb-8 text-left">
                     <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 block">Startgeld in lade (€)</label>
                     <input type="number" value={startFloatAmount} onChange={e=>setStartFloatAmount(e.target.value)} className="w-full bg-slate-50 border-2 border-slate-100 p-5 rounded-2xl text-center font-black text-2xl outline-none focus:border-amber-500 transition-all" />
                   </div>
                   <button onClick={handleOpenSession} className="w-full bg-slate-950 text-white py-5 rounded-2xl font-black uppercase tracking-widest shadow-xl shadow-slate-950/20 active:scale-95 transition-all">Sessie Starten</button>
                </div>
              </div>
            ) : (
              <>
                <div className="h-[38%] bg-white border-b border-slate-200 flex flex-col shadow-inner shrink-0">
                  <div className="px-4 py-3 bg-slate-50 border-b border-slate-100 flex justify-between items-center shrink-0">
                    <button onClick={() => setShowSalesmanSelection(true)} className="flex items-center gap-2 bg-white px-4 py-1.5 rounded-full border border-slate-200 shadow-sm text-[10px] font-black uppercase tracking-tight text-slate-700 active:scale-95 transition-all">
                      <User size={12} className="text-amber-500"/> {company.sellerName || "Kies verkoper"} <ChevronDown size={12}/>
                    </button>
                    <button onClick={()=>setCart([])} className="p-2 text-slate-300 hover:text-red-500 transition-colors"><Trash2 size={18}/></button>
                  </div>
                  <div className="flex-1 overflow-y-auto p-4 space-y-2 bg-white">
                    {cart.length === 0 ? (
                      <div className="h-full flex flex-col items-center justify-center opacity-10">
                        <ShoppingBag size={48}/>
                        <span className="text-[10px] font-black mt-2 uppercase tracking-widest">Selecteer Artikelen</span>
                      </div>
                    ) : cart.map(item => (
                      <div key={item.id} className="flex items-center justify-between p-3.5 bg-slate-50 rounded-2xl border border-slate-100 animate-in slide-in-from-bottom-2">
                        <div className="flex-1 min-w-0 pr-2 text-left">
                          <div className="font-black text-[12px] truncate uppercase text-slate-800">{item.name}</div>
                          <div className="text-[10px] text-slate-400 font-bold">€{item.price.toFixed(2)}</div>
                        </div>
                        <div className="flex items-center gap-3">
                          <button onClick={()=>updateQty(item.id,-1)} className="w-10 h-10 rounded-full bg-white shadow-md border border-slate-200 flex items-center justify-center text-slate-600 active:bg-red-500 active:text-white transition-all"><Minus size={16}/></button>
                          <span className="font-black text-sm w-6 text-center">{item.quantity}</span>
                          <button onClick={()=>updateQty(item.id,1)} className="w-10 h-10 rounded-full bg-white shadow-md border border-slate-200 flex items-center justify-center text-slate-600 active:bg-amber-500 active:text-white transition-all"><Plus size={16}/></button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="flex-1 overflow-y-auto p-3 bg-slate-100/50">
                   <div className="grid grid-cols-4 gap-3 pb-4">
                      {products.map(p => (
                        <button 
                          key={p.id} 
                          onClick={() => addToCart(p)} 
                          className={`${p.color || 'bg-white'} p-2 rounded-2xl border border-black/5 shadow-md active:scale-90 flex flex-col items-center justify-center text-center h-28 transition-all relative overflow-hidden`}
                        >
                          <span className="text-[11px] font-black leading-tight mb-2 line-clamp-2 uppercase tracking-tighter text-slate-900">{p.name}</span>
                          <span className="text-slate-900 bg-white/95 px-2 py-0.5 rounded-full text-[10px] font-black shadow-sm">€{p.price.toFixed(2)}</span>
                          <div className={`absolute bottom-1 right-1 text-[7px] font-black px-1.5 rounded shadow-inner ${(p.stock || 0) < 10 ? 'bg-red-500 text-white' : 'bg-black/5 text-slate-400'}`}>
                            {p.stock}
                          </div>
                        </button>
                      ))}
                   </div>
                </div>

                <div className="bg-[#020617] text-white p-7 space-y-6 shrink-0 shadow-[0_-10px_50px_rgba(0,0,0,0.5)] rounded-t-[3rem]">
                  <div className="flex justify-between items-center px-2">
                    <span className="text-slate-500 text-[12px] font-black uppercase tracking-widest">TOTAAL TE BETALEN</span>
                    <span className="text-5xl font-black tracking-tighter text-amber-500">€{totals.total.toFixed(2)}</span>
                  </div>
                  <div className="grid grid-cols-2 gap-5">
                    <button disabled={cart.length===0} onClick={()=>finalizePayment(PaymentMethod.CASH)} className="bg-[#064e3b]/40 hover:bg-[#064e3b]/60 h-16 rounded-2xl flex items-center justify-center gap-3 font-black text-sm uppercase disabled:opacity-10 active:scale-95 transition-all border border-[#064e3b]/50">
                       <Banknote size={26} className="text-emerald-500"/> <span className="text-emerald-50">CONTANT</span>
                    </button>
                    <button disabled={cart.length===0} onClick={() => { setIsProcessingCard(true); setTimeout(()=>{setIsProcessingCard(false); setShowCardPrompt(true)}, 1200); }} className="bg-[#1e3a8a]/40 hover:bg-[#1e3a8a]/60 h-16 rounded-2xl flex items-center justify-center gap-3 font-black text-sm uppercase disabled:opacity-10 active:scale-95 transition-all border border-[#1e3a8a]/50">
                       <CreditCard size={26} className="text-blue-500"/> <span className="text-blue-50">KAART</span>
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>
        )}

        {activeTab === 'REPORTS' && (
          <div className="h-full overflow-y-auto p-5 space-y-6">
             <h2 className="text-2xl font-black uppercase mt-2 tracking-tight">Kassa Status</h2>
             
             {currentSession ? (
               <div className="space-y-6">
                  <div className="grid grid-cols-2 gap-4">
                     <div className="bg-white p-6 rounded-[2rem] border border-slate-100 shadow-sm"><div className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Verkoop</div><div className="text-2xl font-black text-slate-900">€{transactions.filter(t=>t.sessionId===currentSession.id).reduce((a,b)=>a+b.total, 0).toFixed(2)}</div></div>
                     <div className="bg-white p-6 rounded-[2rem] border border-slate-100 shadow-sm"><div className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">In Lade (Verwacht)</div><div className="text-2xl font-black text-emerald-600">€{(currentSession.startCash + transactions.filter(t=>t.sessionId===currentSession.id && t.paymentMethod===PaymentMethod.CASH).reduce((a,b)=>a+b.total, 0)).toFixed(2)}</div></div>
                  </div>

                  <div className="bg-white p-8 rounded-[2.5rem] border-2 border-slate-100 shadow-xl space-y-6">
                     <h3 className="font-black text-sm uppercase tracking-widest text-slate-900 flex items-center gap-2"><Lock size={18} className="text-red-500"/> Kassa Afsluiten</h3>
                     <p className="text-slate-500 text-xs">Tel het geld in de lade en voer het totaalbedrag hieronder in om de sessie te beëindigen.</p>
                     <div>
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 block">Totaal geteld bedrag (€)</label>
                        <input type="number" placeholder="0.00" value={endCountAmount} onChange={e=>setEndCountAmount(e.target.value)} className="w-full bg-slate-50 border-2 border-slate-200 p-5 rounded-2xl font-black text-2xl outline-none focus:border-red-500 transition-all" />
                     </div>
                     <button onClick={handleCloseSession} className="w-full bg-red-600 text-white py-5 rounded-2xl font-black uppercase tracking-widest shadow-xl shadow-red-600/20 active:scale-95 transition-all">Sessie Beëindigen</button>
                  </div>
               </div>
             ) : (
               <div className="text-center py-20 bg-white rounded-[3rem] border-2 border-dashed border-slate-200 opacity-60">
                  <ShoppingBag size={48} className="mx-auto mb-4 text-slate-300"/>
                  <p className="font-black text-[10px] uppercase tracking-widest">Geen actieve sessie</p>
               </div>
             )}

             <div className="bg-white p-6 rounded-[2.5rem] border border-slate-100 shadow-sm">
                <h3 className="text-[11px] font-black uppercase tracking-widest mb-6 flex items-center gap-2 text-slate-400"><History size={16}/> Laatste Sessies</h3>
                <div className="space-y-3">
                  {sessions.filter(s=>s.status==='CLOSED').slice(0, 10).map(s => (
                     <div key={s.id} onClick={() => setViewingSession(s)} className="p-5 bg-slate-50 rounded-2xl flex justify-between items-center border border-slate-100 hover:border-amber-500 cursor-pointer active:scale-95 transition-all">
                        <div>
                          <div className="font-black text-[12px] uppercase">{new Date(s.startTime).toLocaleDateString('nl-NL')}</div>
                          <div className="text-[10px] text-slate-400 font-bold">{s.id.slice(-8)}</div>
                        </div>
                        <div className="font-black text-xl text-slate-800">€{s.summary?.totalSales.toFixed(2) || '0.00'}</div>
                     </div>
                  ))}
                </div>
             </div>
          </div>
        )}

        {activeTab === 'SETTINGS' && (
          <div className="h-full overflow-y-auto p-5 space-y-6 text-left">
            <h2 className="text-2xl font-black uppercase mt-2 tracking-tight">Opties</h2>
            
            <div className="bg-white p-7 rounded-[2.5rem] shadow-sm border border-slate-100 space-y-5">
              <h3 className="font-black text-[11px] uppercase tracking-widest text-emerald-600 flex items-center gap-2"><Bluetooth size={18}/> Printer Verbinding</h3>
              <div className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl border border-slate-100">
                <div className="flex flex-col">
                   <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Status</span>
                   <span className={`text-xs font-black uppercase ${btConnected ? 'text-emerald-500' : 'text-slate-400'}`}>{btConnected ? 'Verbonden' : 'Niet verbonden'}</span>
                </div>
                {!btConnected ? (
                  <button onClick={handleBluetoothConnect} disabled={isConnectingBt} className="bg-emerald-500 text-white px-5 py-2 rounded-xl font-black text-[10px] uppercase tracking-widest shadow-lg flex items-center gap-2">
                    {isConnectingBt ? <Loader2 size={14} className="animate-spin"/> : <Bluetooth size={14}/>} Zoek Printer
                  </button>
                ) : (
                  <button onClick={() => { btPrinterService.disconnect(); setBtConnected(false); }} className="bg-red-50 text-red-500 px-5 py-2 rounded-xl font-black text-[10px] uppercase tracking-widest border border-red-100">Koppel los</button>
                )}
              </div>
            </div>

            <div className="bg-white p-7 rounded-[2.5rem] shadow-sm border border-slate-100 space-y-5">
              <h3 className="font-black text-[11px] uppercase tracking-widest text-blue-600 flex items-center gap-2"><Building2 size={18}/> Bedrijfsgegevens</h3>
              <div className="space-y-4">
                <input type="text" placeholder="Bedrijfsnaam" value={company.name} onChange={e=>setCompany({...company, name: e.target.value, updatedAt: Date.now()})} className="w-full bg-slate-50 border p-4 rounded-2xl font-bold text-sm outline-none focus:border-blue-500" />
                <input type="text" placeholder="Adres regel 1" value={company.address} onChange={e=>setCompany({...company, address: e.target.value, updatedAt: Date.now()})} className="w-full bg-slate-50 border p-4 rounded-2xl font-bold text-sm outline-none focus:border-blue-500" />
                <input type="text" placeholder="Adres regel 2 (Stad/Postcode)" value={company.address2 || ''} onChange={e=>setCompany({...company, address2: e.target.value, updatedAt: Date.now()})} className="w-full bg-slate-50 border p-4 rounded-2xl font-bold text-sm outline-none focus:border-blue-500" />
                <input type="text" placeholder="Website" value={company.website || ''} onChange={e=>setCompany({...company, website: e.target.value, updatedAt: Date.now()})} className="w-full bg-slate-50 border p-4 rounded-2xl font-bold text-sm outline-none focus:border-blue-500" />
                <input type="text" placeholder="BTW Nummer" value={company.vatNumber} onChange={e=>setCompany({...company, vatNumber: e.target.value, updatedAt: Date.now()})} className="w-full bg-slate-50 border p-4 rounded-2xl font-bold text-sm outline-none focus:border-blue-500" />
                <textarea placeholder="Voettekst bon" value={company.footerMessage} onChange={e=>setCompany({...company, footerMessage: e.target.value, updatedAt: Date.now()})} className="w-full bg-slate-50 border p-4 rounded-2xl font-bold text-sm outline-none h-20" />
              </div>
            </div>

            <div className="bg-white p-7 rounded-[2.5rem] shadow-sm border border-slate-100 space-y-5 text-left">
              <h3 className="font-black text-[11px] uppercase tracking-widest text-amber-600 flex items-center gap-2"><Users size={18}/> Verkopers Beheren</h3>
              <div className="flex gap-3">
                <input type="text" placeholder="Nieuwe verkoper..." value={newSalesmanName} onChange={e=>setNewSalesmanName(e.target.value)} className="flex-1 bg-slate-50 border p-4 rounded-2xl font-bold text-sm outline-none focus:border-amber-500" />
                <button onClick={addSalesman} className="bg-slate-950 text-white px-6 rounded-2xl shadow-lg active:scale-95 transition-all"><UserPlus size={22}/></button>
              </div>
              <div className="flex flex-wrap gap-2 pt-2">
                {company.salesmen?.map(name => (
                  <div key={name} className="bg-slate-100 px-4 py-2.5 rounded-2xl flex items-center gap-3 font-black text-[11px] uppercase border border-slate-200">
                    {name} <button onClick={()=>removeSalesman(name)} className="text-red-400 ml-1"><X size={16}/></button>
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-white p-7 rounded-[2.5rem] shadow-sm border border-slate-100 space-y-6">
              <div className="flex justify-between items-center">
                 <h3 className="font-black text-[11px] uppercase tracking-widest text-slate-400">Assortiment</h3>
                 <button onClick={addProduct} className="bg-slate-900 text-white px-5 py-2.5 rounded-2xl text-[10px] font-black uppercase tracking-widest shadow-lg">+ Product</button>
              </div>
              <div className="space-y-5">
                {products.map(p => (
                  <div key={p.id} className="p-5 bg-slate-50 rounded-[2rem] border border-slate-100 space-y-5">
                     <div className="flex items-center gap-4">
                       <div className={`w-8 h-8 rounded-full ${p.color} border shadow-inner shrink-0`}></div>
                       <input type="text" value={p.name} onChange={e=>updateProduct(p.id,'name',e.target.value)} className="flex-1 bg-transparent border-b border-dashed border-slate-300 font-black text-sm outline-none" />
                       <button onClick={()=>deleteProduct(p.id)} className="text-red-400 p-1"><Trash2 size={20}/></button>
                     </div>
                     
                     <div className="flex flex-wrap gap-2 py-1">
                        {AVAILABLE_COLORS.map(color => (
                          <button 
                            key={color} 
                            onClick={() => updateProduct(p.id, 'color', color)}
                            className={`w-6 h-6 rounded-full ${color} border ${p.color === color ? 'border-slate-900 scale-110' : 'border-slate-200'} transition-all`}
                          />
                        ))}
                     </div>

                     <div className="grid grid-cols-3 gap-3">
                       <div><label className="text-[8px] font-black text-slate-400 uppercase tracking-widest block mb-1">Prijs €</label><input type="number" step="0.1" value={p.price} onChange={e=>updateProduct(p.id,'price',parseFloat(e.target.value))} className="w-full bg-white border border-slate-200 p-2.5 rounded-xl text-xs font-black text-center outline-none focus:border-amber-500" /></div>
                       <div><label className="text-[8px] font-black text-slate-400 uppercase tracking-widest block mb-1">Stock</label><input type="number" value={p.stock} onChange={e=>updateProduct(p.id,'stock',parseInt(e.target.value))} className="w-full bg-white border border-slate-200 p-2.5 rounded-xl text-xs font-black text-center outline-none focus:border-amber-500" /></div>
                       <div><label className="text-[8px] font-black text-slate-400 uppercase tracking-widest block mb-1">BTW %</label><select value={p.vatRate} onChange={e=>updateProduct(p.id,'vatRate',parseInt(e.target.value))} className="w-full bg-white border border-slate-200 p-2.5 rounded-xl text-xs font-black text-center outline-none"><option value={0}>0%</option><option value={21}>21%</option></select></div>
                     </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-slate-950 text-white p-8 rounded-[3rem] shadow-2xl space-y-6">
              <h3 className="text-xl font-black flex items-center gap-3 uppercase tracking-widest"><KeyRound size={24} className="text-amber-500" /> App Code</h3>
              <div className="space-y-2 text-left">
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest px-1">Code wijzigen (4 cijfers)</label>
                <input type="password" maxLength={4} value={company.masterPassword} onChange={e=>setCompany({...company, masterPassword: e.target.value.replace(/\D/g,''), updatedAt: Date.now()})} className="w-full bg-white/5 border border-white/10 rounded-2xl px-5 py-4 text-amber-500 font-black tracking-[1.2em] text-center outline-none focus:border-amber-500 transition-all text-xl" />
              </div>
              <button onClick={() => setIsAuthenticated(false)} className="w-full py-5 rounded-2xl bg-red-500/10 text-red-400 text-[11px] font-black uppercase tracking-widest active:scale-95 transition-all border border-red-500/20">Systeem Uitloggen</button>
            </div>
          </div>
        )}
      </main>

      {/* OVERLAYS */}

      {viewingSession && (
        <div className="fixed inset-0 z-[600] flex items-center justify-center bg-slate-950/90 backdrop-blur-xl p-4 animate-in fade-in duration-200">
           <div className="bg-white rounded-[3rem] shadow-2xl w-full max-lg max-h-[85vh] flex flex-col overflow-hidden animate-in zoom-in-95">
              <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50">
                 <div>
                   <h3 className="font-black text-lg text-slate-900 flex items-center gap-2"><History size={22} className="text-blue-500" /> Sessie {viewingSession.id.slice(-6)}</h3>
                   <div className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-0.5">{new Date(viewingSession.startTime).toLocaleDateString('nl-NL')}</div>
                 </div>
                 <div className="flex items-center gap-3">
                    <button 
                      onClick={() => handleBtSessionPrint(viewingSession)}
                      disabled={isPrintingBt}
                      title="Print sessie rapport"
                      className="p-3 bg-slate-100 hover:bg-amber-100 hover:text-amber-700 rounded-2xl transition-all disabled:opacity-30 active:scale-90"
                    >
                      {isPrintingBt ? <Loader2 size={24} className="animate-spin" /> : <Printer size={24} />}
                    </button>
                    <button onClick={() => setViewingSession(null)} className="p-3 hover:bg-slate-200 rounded-2xl transition-all"><X size={24} /></button>
                 </div>
              </div>
              <div className="flex-1 overflow-y-auto p-6 space-y-8">
                 <div className="grid grid-cols-2 gap-4">
                     <div className="bg-slate-50 p-4 rounded-3xl border border-slate-100 shadow-sm">
                        <div className="text-slate-400 uppercase font-black tracking-widest text-[9px] mb-2">Timing</div>
                        <div className="text-xs font-bold text-slate-700">Van: <span className="font-black text-slate-900">{new Date(viewingSession.startTime).toLocaleTimeString('nl-NL')}</span></div>
                        <div className="text-xs font-bold text-slate-700">Tot: <span className="font-black text-slate-900">{viewingSession.endTime ? new Date(viewingSession.endTime).toLocaleTimeString('nl-NL') : 'Actief'}</span></div>
                     </div>
                     <div className="bg-slate-50 p-4 rounded-3xl border border-slate-100 shadow-sm">
                        <div className="text-slate-400 uppercase font-black tracking-widest text-[9px] mb-2">Financieel</div>
                        <div className="text-xs font-bold text-slate-700">Omzet: <span className="font-black text-slate-900">€{viewingSession.summary?.totalSales.toFixed(2)}</span></div>
                        <div className="text-xs font-bold text-slate-700">Kas: <span className="font-black text-emerald-600">€{viewingSession.endCash?.toFixed(2) || '0,00'}</span></div>
                     </div>
                 </div>

                 {viewingSession.summary?.firstTicketId && viewingSession.summary?.lastTicketId && (
                    <div className="bg-amber-50 p-4 rounded-3xl border border-amber-100 flex items-center gap-4">
                       <History size={20} className="text-amber-500" />
                       <div className="text-[10px]">
                          <span className="text-slate-400 uppercase font-black tracking-widest text-[8px] block mb-1">Ticket Reeks</span>
                          <span className="font-black text-slate-800">{viewingSession.summary.firstTicketId}</span> 
                          <span className="mx-2 text-slate-300">→</span>
                          <span className="font-black text-slate-800">{viewingSession.summary.lastTicketId}</span>
                       </div>
                    </div>
                 )}

                 <div>
                    <h4 className="font-black text-[10px] uppercase tracking-widest mb-4 flex items-center gap-2 text-slate-400 border-b pb-3"><ShoppingBag size={18}/> Productverkoop</h4>
                    <div className="grid grid-cols-1 gap-2">
                       {viewingSessionProductSales.map(item => (
                         <div key={item.name} className="flex justify-between items-center p-4 bg-white border border-slate-100 rounded-2xl text-sm shadow-sm">
                            <span className="font-black text-[12px] uppercase text-slate-700">{item.name}</span>
                            <span className="bg-slate-100 px-4 py-1.5 rounded-full font-black text-[10px] uppercase text-slate-500">{item.qty}x</span>
                         </div>
                       ))}
                       {viewingSessionProductSales.length === 0 && <div className="text-center py-8 text-slate-300 italic text-[11px] font-bold uppercase tracking-widest">Geen verkopen.</div>}
                    </div>
                 </div>
              </div>
              <div className="p-6 bg-slate-50 border-t flex justify-center">
                 <button onClick={() => setViewingSession(null)} className="px-12 py-3 bg-slate-950 text-white rounded-2xl font-black uppercase text-[11px] tracking-widest transition-all active:scale-95 shadow-xl shadow-slate-900/20">Sluiten</button>
              </div>
           </div>
        </div>
      )}

      {/* SALESMAN SELECTION MODAL */}
      {showSalesmanSelection && (
        <div className="fixed inset-0 z-[600] bg-slate-950/90 backdrop-blur-xl flex items-center justify-center p-6">
          <div className="bg-white rounded-[3rem] w-full max-w-sm p-10 animate-in zoom-in-95 shadow-2xl">
            <h3 className="font-black uppercase tracking-widest mb-8 text-center text-slate-800">Wie is aan de slag?</h3>
            <div className="grid grid-cols-1 gap-4">
              {company.salesmen?.map(name => (
                <button key={name} onClick={()=>selectSalesman(name)} className={`w-full py-5 rounded-[1.8rem] font-black transition-all active:scale-95 ${company.sellerName === name ? 'bg-amber-500 text-black shadow-xl shadow-amber-500/20' : 'bg-slate-100 text-slate-600 border border-slate-200'}`}>{name}</button>
              ))}
              {(!company.salesmen || company.salesmen.length === 0) && <p className="text-slate-400 text-[10px] italic text-center py-6 font-bold uppercase tracking-widest">Voeg verkopers toe bij Opties</p>}
              <button onClick={()=>setShowSalesmanSelection(false)} className="mt-6 text-[11px] font-black text-slate-400 uppercase tracking-widest hover:text-slate-900 transition-colors">Sluiten</button>
            </div>
          </div>
        </div>
      )}

      {/* CARD PAYMENT WORKFLOW */}
      {isProcessingCard && (
        <div className="fixed inset-0 z-[600] bg-slate-950/90 backdrop-blur-md flex items-center justify-center text-center">
           <div className="animate-in zoom-in-95">
              <Loader2 size={72} className="text-blue-500 animate-spin mx-auto mb-8" />
              <h3 className="text-white font-black text-2xl uppercase tracking-widest">Wachten op Terminal...</h3>
           </div>
        </div>
      )}

      {showCardPrompt && (
        <div className="fixed inset-0 z-[600] bg-slate-950/90 backdrop-blur-md flex items-center justify-center p-6 text-center">
           <div className="bg-white rounded-[3rem] p-10 max-w-sm w-full animate-in zoom-in-95 shadow-2xl border border-white/20">
              <div className="w-20 h-20 bg-blue-100 text-blue-600 rounded-3xl flex items-center justify-center mx-auto mb-8 shadow-inner"><CreditCard size={40}/></div>
              <h3 className="font-black text-xl mb-3 uppercase tracking-tight text-slate-900">Betaling Gelukt?</h3>
              <p className="text-slate-500 text-sm mb-10 leading-relaxed font-medium">Controleer het pinapparaat en bevestig de transactie.</p>
              <div className="space-y-4">
                 <button onClick={()=>finalizePayment(PaymentMethod.CARD)} className="w-full bg-emerald-600 text-white py-5 rounded-2xl font-black uppercase tracking-widest flex items-center justify-center gap-3 shadow-xl shadow-emerald-600/20 active:scale-95 transition-all"><CheckCircle size={22}/> JA, BEVESTIGEN</button>
                 <div className="grid grid-cols-2 gap-4">
                   <button onClick={()=>finalizePayment(PaymentMethod.CASH)} className="bg-slate-100 text-slate-700 py-4 rounded-2xl font-black text-[10px] uppercase tracking-widest border border-slate-200 active:scale-95 transition-all shadow-sm">BETAAL CASH</button>
                   <button onClick={()=>setShowCardPrompt(false)} className="bg-white text-red-500 py-4 rounded-2xl font-black text-[10px] uppercase tracking-widest border border-red-100 active:scale-95 transition-all shadow-sm">ANULEREN</button>
                 </div>
              </div>
           </div>
        </div>
      )}

      {showSuccess && (
        <div className="fixed inset-0 z-[700] flex items-center justify-center p-4 pointer-events-none">
           <div className="bg-emerald-600 text-white px-12 py-8 rounded-[3.5rem] shadow-[0_20px_60px_rgba(5,150,105,0.4)] flex flex-col items-center gap-4 animate-in zoom-in-95 border-8 border-white">
              <CheckCircle size={64}/>
              <span className="font-black text-2xl uppercase tracking-widest">SUCCESVOL!</span>
           </div>
        </div>
      )}

      {/* SYNC INDICATOR */}
      {isSyncing && (
        <div className="fixed top-24 right-6 z-50 bg-slate-900/90 backdrop-blur-md text-amber-500 px-4 py-2 rounded-full border border-white/10 flex items-center gap-3 shadow-2xl animate-pulse pointer-events-none">
           <RefreshCcw size={12} className="animate-spin" />
           <span className="text-[10px] font-black uppercase tracking-widest">Cloud Sync...</span>
        </div>
      )}

      <Receipt transaction={lastTransaction} company={company} />
      
      {previewTransaction && (
        <div className="fixed inset-0 z-[450] bg-slate-950/90 flex flex-col items-center justify-center p-4 backdrop-blur-md">
           <div className="bg-white rounded-[3rem] max-w-xs w-full overflow-hidden shadow-2xl flex flex-col max-h-[90%] animate-in zoom-in-95">
              <div className="p-5 bg-slate-50 flex justify-between items-center border-b border-slate-200"><span className="font-black text-[11px] uppercase tracking-widest text-slate-400">Digitale Bon</span><button onClick={()=>setPreviewTransaction(null)} className="p-2.5 bg-slate-200 rounded-full hover:bg-slate-300 transition-all"><X size={18}/></button></div>
              <div className="flex-1 overflow-y-auto p-6 flex justify-center bg-white"><Receipt preview transaction={previewTransaction} company={company} /></div>
              <div className="p-6 flex flex-col gap-3 border-t bg-slate-50">
                 <button 
                   onClick={() => handleBtReceiptPrint(previewTransaction)} 
                   disabled={isPrintingBt}
                   className="w-full bg-amber-500 text-slate-950 py-4 rounded-2xl font-black text-[11px] uppercase tracking-widest shadow-xl shadow-amber-500/20 active:scale-95 transition-all flex items-center justify-center gap-2"
                 >
                   {isPrintingBt ? <Loader2 size={18} className="animate-spin" /> : <Printer size={18} />} BON AFDRUKKEN
                 </button>
                 <button onClick={()=>setPreviewTransaction(null)} className="w-full border-2 border-slate-200 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest text-slate-400 hover:bg-white transition-all">Sluiten</button>
              </div>
           </div>
        </div>
      )}
    </div>
  );
}
