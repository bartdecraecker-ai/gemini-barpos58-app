import React, { useState, useEffect, useMemo } from 'react';
import { 
  ShoppingBag, Trash2, CreditCard, Banknote, BarChart3, Settings, Plus, Minus, X, 
  PlayCircle, Lock, Loader2, User, ChevronDown, Printer, Bluetooth, 
  Store, MapPin, Delete, ArrowRight, Edit3, Package, Check, LogOut
} from 'lucide-react';
import { Product, CartItem, Transaction, PaymentMethod, CompanyDetails, SalesSession, DailySummary } from './types';
import { apiService, AppMode } from './services/api';
import { btPrinterService } from './services/bluetoothPrinter';

// Constanten direct uit jouw originele omgeving
const DEFAULT_COMPANY = {
  name: "KRAUKERBIER", address: "Kerkstraat 1", address2: "9000 Gent",
  vatNumber: "BE 0123.456.789", website: "www.krauker.be", footerMessage: "Bedankt!",
  managerPin: "1984", salesmen: []
};

const AVAILABLE_COLORS = ['bg-amber-100', 'bg-blue-100', 'bg-emerald-100', 'bg-rose-100', 'bg-slate-100'];

export default function App() {
  // --- AUTH & MODE ---
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [activeMode, setActiveMode] = useState<AppMode | null>(null);
  const [pinInput, setPinInput] = useState('');
  const [loginError, setLoginError] = useState(false);

  // --- DATA STATES (EXACT ZOALS ORIGINEEL) ---
  const [products, setProducts] = useState<Product[]>([]);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [sessions, setSessions] = useState<SalesSession[]>([]);
  const [company, setCompany] = useState<CompanyDetails>(DEFAULT_COMPANY as any);
  
  // --- UI STATES ---
  const [activeTab, setActiveTab] = useState<'POS' | 'REPORTS' | 'SETTINGS' | 'MANAGE'>('POS');
  const [isInitialLoading, setIsInitialLoading] = useState(false);
  const [btConnected, setBtConnected] = useState(false);
  const [currentSession, setCurrentSession] = useState<SalesSession | null>(null);
  const [startFloatAmount, setStartFloatAmount] = useState<string>('50');
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);

  // --- FILTER LOGICA VOOR SHOP/TOUR ---
  // Dit is de gevraagde toevoeging op je originele script
  const filteredProducts = useMemo(() => {
    if (!activeMode) return [];
    const prefix = activeMode === 'SHOP' ? 'S' : 'T';
    return products.filter(p => p.id.startsWith(prefix));
  }, [products, activeMode]);

  // --- INITIALISATIE & SYNC (ORIGINEEL) ---
  useEffect(() => {
    const savedMode = apiService.getActiveMode();
    if (savedMode) setActiveMode(savedMode);
  }, []);

  useEffect(() => {
    if (!isAuthenticated || !activeMode) return;
    const loadData = async () => {
      setIsInitialLoading(true);
      const [p, t, c, s] = await Promise.all([
        apiService.getProducts(), apiService.getTransactions(),
        apiService.getCompany(), apiService.getSessions()
      ]);
      setProducts(p || []);
      setTransactions(t || []);
      setCompany(c || DEFAULT_COMPANY as any);
      setSessions(s || []);
      setCurrentSession(s?.find(sess => sess.status === 'OPEN') || null);
      setBtConnected(btPrinterService.isConnected());
      setIsInitialLoading(false);
    };
    loadData();
  }, [isAuthenticated, activeMode]);

  // --- PIN LOGICA (ORIGINEEL) ---
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

  // --- AFREKENEN & PRINTER (ORIGINEEL) ---
  const finalizePayment = async (method: PaymentMethod) => {
    if (!currentSession || cart.length === 0) return;
    const total = cart.reduce((s, i) => s + (i.price * i.quantity), 0);
    const v21 = cart.reduce((s, i) => i.vatRate === 21 ? s + (i.price * i.quantity * 0.21 / 1.21) : s, 0);

    const tx: Transaction = {
      id: `TX-${Date.now()}`,
      sessionId: currentSession.id,
      timestamp: Date.now(),
      dateStr: new Date().toLocaleDateString('nl-BE'),
      items: [...cart],
      subtotal: total - v21,
      vat0: total - (cart.filter(i => i.vatRate === 21).reduce((s,i) => s+(i.price*i.quantity), 0)),
      vat21: v21,
      total: total,
      paymentMethod: method,
      updatedAt: Date.now()
    };

    setTransactions(prev => [tx, ...prev]);
    setCart([]);
    if (btConnected) btPrinterService.printReceipt(tx, company);
    
    // Update Stock
    setProducts(prev => prev.map(p => {
      const item = cart.find(c => c.id === p.id);
      return item ? { ...p, stock: Math.max(0, (p.stock || 0) - item.quantity) } : p;
    }));
  };

  // --- PRODUCT BEHEER (FIX: BTW Behoud) ---
  const saveProduct = (p: Product) => {
    if (products.find(x => x.id === p.id)) {
      setProducts(products.map(x => x.id === p.id ? p : x));
    } else {
      setProducts([...products, p]);
    }
    setEditingProduct(null);
  };

  const themeColor = activeMode === 'SHOP' ? 'amber' : 'indigo';

  if (!isAuthenticated) {
    return (
      <div className="fixed inset-0 bg-slate-950 flex flex-col items-center justify-center p-6 text-white z-[1000]">
        <h1 className="text-xl font-black uppercase italic mb-8">BarPOS Login</h1>
        <div className="flex gap-4 mb-10">
          {[...Array(4)].map((_, i) => (
            <div key={i} className={`w-4 h-4 rounded-full border-2 ${pinInput.length > i ? 'bg-amber-500 border-amber-500' : 'border-slate-800'}`} />
          ))}
        </div>
        <div className="grid grid-cols-3 gap-3 w-64">
          {[1,2,3,4,5,6,7,8,9,0].map(n => (
            <button key={n} onClick={() => handlePinDigit(n.toString())} className="aspect-square bg-slate-900 rounded-2xl text-xl font-black border border-white/5 active:bg-amber-500">{n}</button>
          ))}
        </div>
      </div>
    );
  }

  if (!activeMode) {
    return (
      <div className="fixed inset-0 bg-slate-50 flex flex-col items-center justify-center p-6">
        <div className="space-y-4 w-full max-w-xs">
          <button onClick={() => { setActiveMode('SHOP'); apiService.setActiveMode('SHOP'); }} className="w-full bg-white p-6 rounded-[2rem] shadow-lg flex items-center gap-4 border-2 border-transparent active:border-amber-500">
            <Store className="text-amber-500" /> <span className="font-black italic">SHOP MODUS</span>
          </button>
          <button onClick={() => { setActiveMode('TOUR'); apiService.setActiveMode('TOUR'); }} className="w-full bg-white p-6 rounded-[2rem] shadow-lg flex items-center gap-4 border-2 border-transparent active:border-indigo-500">
            <MapPin className="text-indigo-500" /> <span className="font-black italic">TOUR MODUS</span>
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 flex flex-col bg-slate-50 overflow-hidden font-sans">
      {/* NAV (ORIGINEEL) */}
      <nav className="h-20 bg-slate-950 text-white flex items-center justify-around shrink-0 z-50 px-2">
        <button onClick={() => setActiveTab('POS')} className={`flex flex-col items-center gap-1 ${activeTab === 'POS' ? `text-${themeColor}-500` : 'text-slate-400'}`}>
          <ShoppingBag size={20} /> <span className="text-[9px] font-black uppercase">Kassa</span>
        </button>
        <button onClick={() => setActiveTab('REPORTS')} className={`flex flex-col items-center gap-1 ${activeTab === 'REPORTS' ? `text-${themeColor}-500` : 'text-slate-400'}`}>
          <BarChart3 size={20} /> <span className="text-[9px] font-black uppercase">Rapport</span>
        </button>
        <button onClick={() => setActiveTab('MANAGE')} className={`flex flex-col items-center gap-1 ${activeTab === 'MANAGE' ? `text-${themeColor}-500` : 'text-slate-400'}`}>
          <Package size={20} /> <span className="text-[9px] font-black uppercase">Producten</span>
        </button>
        <button onClick={() => setActiveTab('SETTINGS')} className={`flex flex-col items-center gap-1 ${activeTab === 'SETTINGS' ? `text-${themeColor}-500` : 'text-slate-400'}`}>
          <Settings size={20} /> <span className="text-[9px] font-black uppercase">Instellen</span>
        </button>
      </nav>

      <main className="flex-1 overflow-hidden relative">
        {activeTab === 'POS' && (
          <div className="h-full flex flex-col">
            {!currentSession ? (
              <div className="flex-1 flex items-center justify-center p-4">
                <div className="bg-white p-8 rounded-[3rem] shadow-2xl text-center w-full max-w-xs">
                  <h3 className="font-black mb-6 uppercase italic">{activeMode} SESSIE STARTEN</h3>
                  <input type="number" value={startFloatAmount} onChange={e=>setStartFloatAmount(e.target.value)} className="w-full bg-slate-50 p-5 rounded-2xl text-center font-black text-2xl mb-4 outline-none" />
                  <button onClick={() => {
                    const s = { id: `SES-${Date.now()}`, startTime: Date.now(), startCash: parseFloat(startFloatAmount), status: 'OPEN' as const, updatedAt: Date.now() };
                    setCurrentSession(s);
                    setSessions([s, ...sessions]);
                  }} className={`w-full bg-slate-950 text-white py-5 rounded-2xl font-black`}>START</button>
                </div>
              </div>
            ) : (
              <>
                {/* CART (35%) */}
                <div className="h-[35%] bg-white border-b overflow-y-auto p-2">
                  {cart.map(item => (
                    <div key={item.id} className="flex justify-between items-center p-2 bg-slate-50 rounded-xl mb-1">
                      <span className="font-black text-[10px] uppercase truncate">{item.name}</span>
                      <div className="flex items-center gap-3">
                        <button onClick={() => setCart(cart.filter(x => x.id !== item.id))}><Trash2 size={14} className="text-slate-300"/></button>
                        <span className="font-black italic">x{item.quantity}</span>
                      </div>
                    </div>
                  ))}
                </div>
                {/* GRID (ORIGINELE 4 KOLOMMEN) */}
                <div className="flex-1 overflow-y-auto p-3 bg-slate-100/30">
                  <div className="grid grid-cols-4 gap-2">
                    {filteredProducts.map(p => (
                      <button key={p.id} onClick={() => {
                        const ex = cart.find(x => x.id === p.id);
                        if (ex) setCart(cart.map(x => x.id === p.id ? {...x, quantity: x.quantity + 1} : x));
                        else setCart([...cart, {...p, quantity: 1}]);
                      }} className={`${p.color} h-20 rounded-2xl border border-black/5 shadow-sm flex flex-col items-center justify-center p-1 active:scale-90`}>
                        <span className="text-[8px] font-black uppercase text-center leading-tight">{p.name}</span>
                        <span className="text-[7px] font-black bg-white/50 px-1 rounded-full mt-1 italic">€{p.price.toFixed(2)}</span>
                      </button>
                    ))}
                  </div>
                </div>
                {/* TOTAAL & PAY */}
                <div className="bg-slate-950 p-5 rounded-t-[2.5rem]">
                  <div className="flex justify-between text-white mb-4 px-2">
                    <span className="text-[9px] font-black opacity-50">TOTAAL</span>
                    <span className="text-2xl font-black italic text-amber-500">€{cart.reduce((s,i)=>s+(i.price*i.quantity),0).toFixed(2)}</span>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <button onClick={() => finalizePayment(PaymentMethod.CASH)} className="bg-emerald-500/10 border border-emerald-500/30 text-emerald-500 py-4 rounded-xl font-black text-[10px]">CONTANT</button>
                    <button onClick={() => finalizePayment(PaymentMethod.CARD)} className="bg-blue-500/10 border border-blue-500/30 text-blue-500 py-4 rounded-xl font-black text-[10px]">KAART</button>
                  </div>
                </div>
              </>
            )}
          </div>
        )}

        {/* PRODUCT MANAGEMENT (BTW OPTIE TERUGGEZET) */}
        {activeTab === 'MANAGE' && (
          <div className="p-4 space-y-4 overflow-y-auto h-full">
            <button onClick={() => setEditingProduct({ id: (activeMode === 'SHOP' ? 'S' : 'T') + Date.now(), name: '', price: 0, vatRate: 21, color: 'bg-slate-100', stock: 100, updatedAt: 0 })} className="w-full bg-slate-950 text-white p-4 rounded-2xl font-black text-[10px]">NIEUW PRODUCT ({activeMode})</button>
            {filteredProducts.map(p => (
              <div key={p.id} className="bg-white p-4 rounded-2xl border flex justify-between items-center">
                <div>
                  <div className="font-black italic text-sm">{p.name}</div>
                  <div className="text-[9px] font-bold text-slate-400">€{p.price.toFixed(2)} | {p.vatRate}% BTW | ST: {p.stock}</div>
                </div>
                <button onClick={() => setEditingProduct(p)} className="p-2 text-slate-300"><Edit3 size={18}/></button>
              </div>
            ))}
          </div>
        )}

        {/* SETTINGS (PRINTER) */}
        {activeTab === 'SETTINGS' && (
          <div className="p-6 space-y-4">
             <button onClick={async () => { const ok = await btPrinterService.connect(); setBtConnected(ok); }} className={`w-full p-6 rounded-3xl font-black italic flex items-center justify-between ${btConnected ? 'bg-emerald-500 text-white' : 'bg-slate-900 text-white'}`}>
               {btConnected ? 'PRINTER VERBONDEN' : 'VERBIND PRINTER'}
               {btConnected ? <BluetoothConnected /> : <Bluetooth />}
             </button>
             <button onClick={() => setActiveMode(null)} className="w-full bg-slate-100 p-4 rounded-2xl font-black text-slate-400 text-[10px]">WISSEL MODUS (SHOP/TOUR)</button>
             <button onClick={() => setIsAuthenticated(false)} className="w-full text-red-500 font-black text-[10px] mt-10">UITLOGGEN</button>
          </div>
        )}
      </main>

      {/* EDIT MODAL (MET BTW) */}
      {editingProduct && (
        <div className="fixed inset-0 bg-white z-[200] p-6">
          <div className="max-w-xs mx-auto space-y-4">
            <h2 className="font-black italic uppercase">Product Aanpassen</h2>
            <input className="w-full bg-slate-50 p-4 rounded-xl font-bold" placeholder="Naam" value={editingProduct.name} onChange={e=>setEditingProduct({...editingProduct, name: e.target.value})} />
            <input type="number" className="w-full bg-slate-50 p-4 rounded-xl font-bold" placeholder="Prijs" value={editingProduct.price} onChange={e=>setEditingProduct({...editingProduct, price: parseFloat(e.target.value)})} />
            <div className="flex gap-2">
              <button onClick={()=>setEditingProduct({...editingProduct, vatRate: 21})} className={`flex-1 p-4 rounded-xl font-black ${editingProduct.vatRate === 21 ? 'bg-slate-900 text-white' : 'bg-slate-50'}`}>21% BTW</button>
              <button onClick={()=>setEditingProduct({...editingProduct, vatRate: 0})} className={`flex-1 p-4 rounded-xl font-black ${editingProduct.vatRate === 0 ? 'bg-slate-900 text-white' : 'bg-slate-50'}`}>0% BTW</button>
            </div>
            <button onClick={() => saveProduct(editingProduct)} className="w-full bg-emerald-500 text-white p-5 rounded-2xl font-black italic">OPSLAAN</button>
            <button onClick={() => setEditingProduct(null)} className="w-full text-slate-300 font-bold text-[10px]">ANNULEREN</button>
          </div>
        </div>
      )}
    </div>
  );
}
