      import React, { useState, useEffect, useMemo } from 'react';
import { 
  ShoppingBag, Trash2, CreditCard, Banknote, BarChart3, Settings, Plus, Minus, X, 
  CheckCircle, PlayCircle, KeyRound, RefreshCcw, Archive, Loader2, Building2, 
  User, Users, ChevronDown, UserPlus, Lock, History, Printer, Bluetooth, 
  Store, MapPin, Beer, Coffee, Wine, GlassWater, Utensils, Delete, ArrowRight, Save,
  ChevronRight, Calendar, UserMinus, Check, AlertCircle, TrendingUp, Package, BluetoothConnected, LogOut
} from 'lucide-react';
import { Product, CartItem, Transaction, PaymentMethod, CompanyDetails, SalesSession } from './types';
import { DEFAULT_COMPANY, INITIAL_PRODUCTS, AVAILABLE_COLORS } from './constants';
import { Receipt } from './components/Receipt';
import { apiService, AppMode } from './services/api';
import { btPrinterService } from './services/bluetoothPrinter';

export default function App() {
  // --- STATES ---
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [activeMode, setActiveMode] = useState<AppMode | null>(null);
  const [pinInput, setPinInput] = useState('');
  const [loginError, setLoginError] = useState(false);

  const [products, setProducts] = useState<Product[]>([]);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [sessions, setSessions] = useState<SalesSession[]>([]);
  const [company, setCompany] = useState<CompanyDetails>(DEFAULT_COMPANY);
  
  const [activeTab, setActiveTab] = useState<'POS' | 'REPORTS' | 'SETTINGS'>('POS');
  const [isInitialLoading, setIsInitialLoading] = useState(false);
  const [btConnected, setBtConnected] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [showCardPrompt, setShowCardPrompt] = useState(false);
  const [previewTransaction, setPreviewTransaction] = useState<Transaction | null>(null);
  const [currentSession, setCurrentSession] = useState<SalesSession | null>(null);
  const [startFloatAmount, setStartFloatAmount] = useState<string>('0');
  const [isClosingSession, setIsClosingSession] = useState(false);
  const [endCashInput, setEndCashInput] = useState('');
  const [showSalesmanSelection, setShowSalesmanSelection] = useState(false);

  // --- LOGICA ---
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

  useEffect(() => {
    if (!isAuthenticated || !activeMode || isInitialLoading) return;
    apiService.saveProducts(products);
    apiService.saveTransactions(transactions);
    apiService.saveSessions(sessions);
    apiService.saveCompany(company);
  }, [products, transactions, sessions, company]);

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
    setShowCardPrompt(false);
    setPreviewTransaction(tx); // Open de preview
    setShowSuccess(true);
    setTimeout(() => setShowSuccess(false), 1500);
  };

  const closeSession = () => {
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

  // --- RENDER LOGIN / MODE SELECT ---
  if (!isAuthenticated) return (
    <div className="fixed inset-0 bg-slate-950 flex flex-col items-center justify-center p-6 text-white z-[1000]">
      <div className={`w-full max-w-xs text-center ${loginError ? 'animate-shake' : ''}`}>
        <div className="mb-8"><Lock size={48} className="mx-auto text-amber-500" /></div>
        <div className="flex justify-center gap-4 mb-10">
          {[...Array(4)].map((_, i) => (
            <div key={i} className={`w-4 h-4 rounded-full border-2 ${pinInput.length > i ? 'bg-amber-500 border-amber-500' : 'border-slate-800'}`} />
          ))}
        </div>
        <div className="grid grid-cols-3 gap-4">
          {[1, 2, 3, 4, 5, 6, 7, 8, 9, 'C', 0, 'del'].map((d) => (
            <button key={d} onClick={() => d === 'del' ? setPinInput(pinInput.slice(0,-1)) : d === 'C' ? setPinInput('') : handlePinDigit(d.toString())} className="h-16 rounded-2xl bg-slate-900 text-xl font-black active:bg-amber-500">
              {d === 'del' ? <Delete className="mx-auto"/> : d}
            </button>
          ))}
        </div>
      </div>
    </div>
  );

  if (!activeMode) return (
    <div className="fixed inset-0 bg-slate-50 flex items-center justify-center p-6">
      <div className="w-full max-w-sm space-y-4">
        <button onClick={() => { apiService.setActiveMode('SHOP'); setActiveMode('SHOP'); }} className="w-full bg-white p-8 rounded-[2rem] shadow-xl flex items-center gap-6 border-4 border-transparent active:border-amber-500">
          <Store size={40} className="text-amber-500"/> <div><h2 className="font-black text-xl uppercase">SHOP MODUS</h2></div>
        </button>
        <button onClick={() => { apiService.setActiveMode('TOUR'); setActiveMode('TOUR'); }} className="w-full bg-white p-8 rounded-[2rem] shadow-xl flex items-center gap-6 border-4 border-transparent active:border-indigo-500">
          <MapPin size={40} className="text-indigo-500"/> <div><h2 className="font-black text-xl uppercase">TOUR MODUS</h2></div>
        </button>
      </div>
    </div>
  );

  return (
    <div className="fixed inset-0 flex flex-col bg-slate-50 overflow-hidden">
      {/* NAVIGATION */}
      <nav className="h-20 bg-slate-950 text-white flex items-center justify-around shrink-0 z-50">
        <button onClick={() => setActiveTab('POS')} className={`flex flex-col items-center gap-1 ${activeTab === 'POS' ? `text-${themeColor}-500` : 'text-slate-500'}`}><ShoppingBag size={20}/><span className="text-[9px] font-black uppercase">Kassa</span></button>
        <button onClick={() => setActiveTab('REPORTS')} className={`flex flex-col items-center gap-1 ${activeTab === 'REPORTS' ? `text-${themeColor}-500` : 'text-slate-500'}`}><BarChart3 size={20}/><span className="text-[9px] font-black uppercase">Rapport</span></button>
        <button onClick={() => setActiveTab('SETTINGS')} className={`flex flex-col items-center gap-1 ${activeTab === 'SETTINGS' ? `text-${themeColor}-500` : 'text-slate-500'}`}><Settings size={20}/><span className="text-[9px] font-black uppercase">Beheer</span></button>
      </nav>

      <main className="flex-1 overflow-hidden relative">
        {activeTab === 'POS' && (
          <div className="h-full flex flex-col">
            {!currentSession ? (
              <div className="flex-1 flex items-center justify-center p-6">
                <div className="bg-white p-8 rounded-[3rem] shadow-2xl w-full max-w-sm text-center">
                  <PlayCircle size={48} className={`mx-auto mb-4 text-${themeColor}-500`}/>
                  <h2 className="font-black text-lg mb-6 uppercase italic">{activeMode} SESSIE OPENEN</h2>
                  <input type="number" value={startFloatAmount} onChange={e=>setStartFloatAmount(e.target.value)} className="w-full bg-slate-50 p-5 rounded-2xl text-center text-2xl font-black mb-6" placeholder="Wisselgeld €"/>
                  <button onClick={() => { const s = { id: `SES-${Date.now()}`, startTime: Date.now(), startCash: parseFloat(startFloatAmount)||0, status: 'OPEN' as const, updatedAt: Date.now() }; setCurrentSession(s); setSessions([s, ...sessions]); }} className="w-full bg-slate-950 text-white py-5 rounded-2xl font-black">START SESSIE</button>
                </div>
              </div>
            ) : (
              <>
                {/* CART */}
                <div className="h-[35%] bg-white border-b flex flex-col shrink-0">
                  <div className="px-4 py-2 bg-slate-50 border-b flex justify-between items-center">
                    <div className="flex gap-2">
                      <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full border-2 font-black text-[9px] uppercase ${activeMode === 'SHOP' ? 'bg-amber-50 border-amber-500 text-amber-700' : 'bg-indigo-50 border-indigo-500 text-indigo-700'}`}>
                        {activeMode === 'SHOP' ? <Store size={12}/> : <MapPin size={12}/>} {activeMode}
                      </div>
                      <button onClick={() => setShowSalesmanSelection(true)} className="flex items-center gap-2 px-4 py-1.5 rounded-full border-2 bg-white text-[9px] font-black uppercase border-slate-300">
                        <User size={12}/> {company.sellerName || "Verkoper"}
                      </button>
                    </div>
                    <button onClick={()=>setIsClosingSession(true)} className="flex items-center gap-1 px-3 py-1.5 rounded-full border-2 border-red-200 text-red-600 text-[9px] font-black"><LogOut size={12}/> SLUITEN</button>
                  </div>
                  <div className="flex-1 overflow-y-auto p-2 space-y-1">
                    {cart.map(item => (
                      <div key={item.id} className="flex items-center justify-between p-2.5 bg-slate-50 rounded-xl border border-slate-100">
                        <span className="font-black text-[11px] truncate flex-1">{item.name}</span>
                        <div className="flex items-center gap-3 bg-white px-2 py-1 rounded-full border shadow-sm">
                          <button onClick={()=>setCart(cart.map(x=>x.id===item.id?{...x, quantity:x.quantity-1}:x).filter(x=>x.quantity>0))}><Minus size={14}/></button>
                          <span className="font-black text-xs">{item.quantity}</span>
                          <button onClick={()=>setCart(cart.map(x=>x.id===item.id?{...x, quantity:x.quantity+1}:x))}><Plus size={14}/></button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
                {/* PRODUCTS */}
                <div className="flex-1 overflow-y-auto p-3 bg-slate-100/50">
                  <div className="grid grid-cols-4 gap-2 pb-8">
                    {products.map(p => (
                      <button key={p.id} onClick={() => { const ex=cart.find(i=>i.id===p.id); setCart(ex?cart.map(i=>i.id===p.id?{...i, quantity:i.quantity+1}:i):[...cart,{...p, quantity:1}]); }} className={`${p.color || 'bg-white'} h-20 rounded-2xl border border-black/5 shadow-sm active:scale-95 flex flex-col items-center justify-center p-2`}>
                        <span className="text-[9px] font-black leading-tight text-center line-clamp-2">{p.name}</span>
                        <span className="text-[10px] font-black italic mt-1">€{p.price.toFixed(2)}</span>
                      </button>
                    ))}
                  </div>
                </div>
                {/* FOOTER */}
                <div className="bg-slate-950 text-white p-5 rounded-t-[2.5rem]">
                  <div className="flex justify-between items-center mb-4">
                    <span className="text-slate-500 font-black text-[10px] uppercase">Totaal</span>
                    <span className={`text-3xl font-black italic text-${themeColor}-500`}>€{totals.total.toFixed(2)}</span>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <button disabled={cart.length===0} onClick={()=>finalizePayment(PaymentMethod.CASH)} className="bg-emerald-500/20 border border-emerald-500/50 h-14 rounded-2xl font-black text-[10px] text-emerald-500">CONTANT</button>
                    <button disabled={cart.length===0} onClick={()=>setShowCardPrompt(true)} className="bg-blue-500/20 border border-blue-500/50 h-14 rounded-2xl font-black text-[10px] text-blue-500">KAART</button>
                  </div>
                </div>
              </>
            )}
          </div>
        )}

        {/* --- SETTINGS TAB --- */}
        {activeTab === 'SETTINGS' && (
          <div className="p-4 h-full overflow-y-auto pb-24 space-y-8">
            <section>
              <h2 className="text-xl font-black uppercase italic mb-4">Bedrijfsgegevens</h2>
              <div className="bg-white p-4 rounded-[2rem] shadow-sm space-y-3">
                <input className="w-full border-b p-2 font-bold" value={company.name} onChange={e=>setCompany({...company, name: e.target.value})} placeholder="Bedrijfsnaam"/>
                <input className="w-full border-b p-2 text-sm" value={company.address} onChange={e=>setCompany({...company, address: e.target.value})} placeholder="Adres regel 1"/>
                <input className="w-full border-b p-2 text-sm" value={company.address2} onChange={e=>setCompany({...company, address2: e.target.value})} placeholder="Adres regel 2 (Stad/Postcode)"/>
                <input className="w-full border-b p-2 text-sm" value={company.vatNumber} onChange={e=>setCompany({...company, vatNumber: e.target.value})} placeholder="BTW nummer"/>
                <input className="w-full border-b p-2 text-sm" value={company.website} onChange={e=>setCompany({...company, website: e.target.value})} placeholder="Website"/>
                <textarea className="w-full border-b p-2 text-sm" value={company.footerMessage} onChange={e=>setCompany({...company, footerMessage: e.target.value})} placeholder="Voettekst ticket"/>
              </div>
            </section>

            <section>
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-xl font-black uppercase italic">Producten</h2>
                <div className="flex gap-2">
                  <button onClick={() => { const m = activeMode === 'SHOP' ? 'TOUR' : 'SHOP'; apiService.setActiveMode(m); setActiveMode(m); }} className={`px-3 py-1 rounded-full text-[10px] font-black border-2 ${activeMode === 'SHOP' ? 'border-amber-500 text-amber-500' : 'border-indigo-500 text-indigo-500'}`}>WISSEL MODUS</button>
                </div>
              </div>
              <div className="space-y-3">
                {products.map(p => (
                  <div key={p.id} className="bg-white p-4 rounded-2xl border shadow-sm">
                    <div className="flex gap-2 mb-3">
                      <input className="flex-1 font-bold text-sm" value={p.name} onChange={e=>setProducts(products.map(x=>x.id===p.id?{...x, name:e.target.value}:x))}/>
                      <button onClick={()=>setProducts(products.filter(x=>x.id!==p.id))} className="text-red-400"><Trash2 size={18}/></button>
                    </div>
                    <div className="grid grid-cols-3 gap-2">
                      <input type="number" className="bg-slate-50 p-2 rounded-lg font-black text-xs" value={p.price} onChange={e=>setProducts(products.map(x=>x.id===p.id?{...x, price:parseFloat(e.target.value)}:x))}/>
                      <input type="number" className="bg-slate-50 p-2 rounded-lg font-black text-xs" value={p.stock || 0} onChange={e=>setProducts(products.map(x=>x.id===p.id?{...x, stock:parseInt(e.target.value)}:x))} placeholder="Stock"/>
                      <select className="bg-slate-50 p-2 rounded-lg font-black text-xs" value={p.vatRate} onChange={e=>setProducts(products.map(x=>x.id===p.id?{...x, vatRate:parseInt(e.target.value)}:x))}>
                        <option value={21}>21%</option>
                        <option value={0}>0%</option>
                      </select>
                    </div>
                  </div>
                ))}
                <button onClick={()=>setProducts([...products, {id:Date.now().toString(), name:"Nieuw Product", price:0, vatRate:21, color:'bg-white', stock:0, updatedAt:Date.now()}])} className="w-full p-4 border-2 border-dashed rounded-2xl font-bold text-slate-400 flex items-center justify-center gap-2"><Plus/> Nieuw Product</button>
              </div>
            </section>

            <section>
              <h2 className="text-xl font-black uppercase italic mb-4">Verkopers</h2>
              <div className="bg-white p-4 rounded-2xl shadow-sm space-y-2">
                {company.salesmen?.map((s, idx) => (
                  <div key={idx} className="flex justify-between items-center p-2 border-b">
                    <span className="font-bold">{s}</span>
                    <button onClick={() => setCompany({...company, salesmen: company.salesmen?.filter((_, i) => i !== idx)})} className="text-red-400"><X size={16}/></button>
                  </div>
                ))}
                <button onClick={() => { const n = prompt("Naam verkoper:"); if(n) setCompany({...company, salesmen: [...(company.salesmen || []), n]}); }} className="w-full py-2 text-sm font-black text-slate-400">+ VERKOPER TOEVOEGEN</button>
              </div>
            </section>
          </div>
        )}
      </main>

      {/* --- OVERLAYS --- */}

      {/* CARD PROMPT */}
      {showCardPrompt && (
        <div className="fixed inset-0 bg-slate-950/90 z-[2000] flex items-center justify-center p-6">
          <div className="bg-white p-8 rounded-[3rem] w-full max-w-xs text-center">
            <CreditCard size={48} className="mx-auto text-blue-500 mb-4"/>
            <h3 className="font-black text-lg mb-2">KAARTBETALING</h3>
            <p className="text-sm text-slate-400 mb-6 font-medium">Is de transactie op de terminal voltooid?</p>
            <div className="space-y-3">
              <button onClick={()=>finalizePayment(PaymentMethod.CARD)} className="w-full bg-blue-600 text-white py-4 rounded-2xl font-black">JA, GELUKT</button>
              <button onClick={()=>setShowCardPrompt(false)} className="w-full bg-slate-100 text-slate-400 py-4 rounded-2xl font-black">ANNULEREN</button>
            </div>
          </div>
        </div>
      )}

      {/* TICKET PREVIEW & PRINT */}
      {previewTransaction && (
        <div className="fixed inset-0 bg-slate-950/90 z-[3000] flex items-center justify-center p-4">
          <div className="bg-white rounded-[2rem] w-full max-w-xs flex flex-col max-h-[90vh]">
            <div className="p-4 border-b flex justify-between items-center">
              <span className="font-black text-xs uppercase">Ticket Preview</span>
              <button onClick={()=>setPreviewTransaction(null)}><X/></button>
            </div>
            <div className="flex-1 overflow-y-auto p-4 flex justify-center bg-slate-100">
              <Receipt transaction={previewTransaction} company={company} preview={true} />
            </div>
            <div className="p-4 bg-white border-t space-y-3">
              <button onClick={() => { btPrinterService.printReceipt(previewTransaction, company); setPreviewTransaction(null); }} className="w-full bg-slate-950 text-white py-4 rounded-2xl font-black flex items-center justify-center gap-2">
                <Printer size={18}/> AFDRUKKEN
              </button>
              <button onClick={()=>setPreviewTransaction(null)} className="w-full text-slate-400 font-black text-xs py-2">SLUITEN</button>
            </div>
          </div>
        </div>
      )}

      {/* SALESMAN SELECTION */}
      {showSalesmanSelection && (
        <div className="fixed inset-0 bg-slate-950/90 z-[2000] flex items-center justify-center p-6">
          <div className="bg-white p-6 rounded-[2.5rem] w-full max-w-xs">
             <h3 className="font-black text-center mb-4 uppercase">Selecteer Verkoper</h3>
             <div className="grid gap-2">
               {company.salesmen?.map(s => (
                 <button key={s} onClick={()=>{setCompany({...company, sellerName: s}); setShowSalesmanSelection(false);}} className={`p-4 rounded-xl font-black border-2 ${company.sellerName === s ? 'border-amber-500 bg-amber-50' : 'border-slate-100'}`}>{s}</button>
               ))}
               <button onClick={()=>setShowSalesmanSelection(false)} className="mt-4 text-slate-400 font-bold">Annuleren</button>
             </div>
          </div>
        </div>
      )}

      {/* CLOSE SESSION POPUP */}
      {isClosingSession && (
        <div className="fixed inset-0 bg-slate-950/90 z-[2000] flex items-center justify-center p-6 text-white">
          <div className="w-full max-w-xs text-center space-y-6">
            <h3 className="font-black text-xl uppercase">Sessie Afsluiten</h3>
            <div className="space-y-2">
              <p className="text-xs text-slate-500 font-black">CASH IN LADE (€)</p>
              <input type="number" value={endCashInput} onChange={e=>setEndCashInput(e.target.value)} className="w-full bg-slate-900 p-5 rounded-2xl text-center text-2xl font-black border-2 border-slate-800 outline-none" placeholder="0.00"/>
            </div>
            <div className="grid gap-3">
              <button onClick={closeSession} className="bg-red-600 text-white py-5 rounded-2xl font-black uppercase">AFSLUITEN & RAPPORT</button>
              <button onClick={()=>setIsClosingSession(false)} className="text-slate-500 font-black">TERUG</button>
            </div>
          </div>
        </div>
      )}

      {/* SUCCESS MESSAGE */}
      {showSuccess && (
        <div className="fixed inset-0 bg-emerald-500 z-[4000] flex flex-col items-center justify-center animate-in fade-in duration-300">
           <CheckCircle size={80} className="text-white animate-bounce"/>
           <h2 className="text-white font-black text-3xl mt-4 italic uppercase">Betaald!</h2>
        </div>
      )}
    </div>
  );
} 
