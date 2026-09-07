import React, { useState, useEffect } from 'react';
import { 
  Trash2, 
  Edit2, 
  Plus, 
  X, 
  Download, 
  CreditCard, 
  CheckCircle,
  ShoppingBag,
  History,
  Settings,
  Users,
  RefreshCw,
  LogOut,
  Banknote,
  Lock,
  Compass,
  Store,
  MapPin,
  Calendar,
  ArrowLeft
} from 'lucide-react';

// ==========================================
// TYPES & ENUMS
// ==========================================

export enum PaymentMethod {
  CASH = 'CASH',
  CARD = 'CARD'
}

export interface Product {
  id: string;
  name: string;
  price: number;
  vatRate: number;
  stock?: number;
  color?: string;
}

export interface Company {
  name: string;
  sellerName: string;
  salesmen: string[];
}

export interface CartItem {
  product: Product;
  quantity: number;
}

export interface Transaction {
  id: string;
  total: number;
  method: PaymentMethod;
  timestamp: number;
  items: CartItem[];
}

export interface Session {
  id: string;
  startTime: number;
  endTime?: number;
  startCash: number;
  endCash?: number;
  transactions: Transaction[];
}

// ==========================================
// RECEIPT COMPONENT
// ==========================================

const Receipt = ({ 
  company, 
  transaction, 
  session 
}: { 
  company: Company; 
  transaction?: Transaction | null; 
  session?: Session | null 
}) => (
  <div className="p-4 bg-white rounded-lg text-slate-800 font-mono text-xs space-y-2 border border-slate-200">
    <div className="text-center font-bold text-sm uppercase tracking-wide">{company.name}</div>
    <div className="text-center text-[10px] text-slate-500">Bediend door: {company.sellerName}</div>
    <hr className="my-2 border-dashed border-slate-300" />
    
    {transaction && (
      <div className="space-y-2">
        <div className="space-y-1">
          {transaction.items.map((item, idx) => (
            <div key={idx} className="flex justify-between text-[11px]">
              <span>{item.quantity}x {item.product.name}</span>
              <span>€{(item.product.price * item.quantity).toFixed(2)}</span>
            </div>
          ))}
        </div>
        <hr className="my-1 border-dashed border-slate-200" />
        <div className="flex justify-between font-bold text-sm pt-1">
          <span>TOTAAL</span>
          <span>€{transaction.total.toFixed(2)}</span>
        </div>
        <div className="text-[10px] text-slate-500 text-right">
          Betaalmethode: {transaction.method === PaymentMethod.CARD ? 'Kaart' : 'Contant'}
        </div>
      </div>
    )}

    {session && (
      <div className="space-y-1.5 pt-1">
        <div className="font-bold border-b border-slate-200 pb-1 text-center uppercase tracking-wider text-[11px]">
          Shift Rapport ({session.id})
        </div>
        <div className="flex justify-between"><span>Start contant:</span><span>€{session.startCash.toFixed(2)}</span></div>
        {session.endCash !== undefined && (
          <div className="flex justify-between"><span>Eind contant:</span><span>€{session.endCash.toFixed(2)}</span></div>
        )}
        <div className="flex justify-between font-bold text-indigo-600 pt-1 border-t border-slate-100">
          <span>Totale omzet:</span>
          <span>€{session.transactions.reduce((acc, t) => acc + t.total, 0).toFixed(2)}</span>
        </div>
      </div>
    )}
  </div>
);

// ==========================================
// MAIN APP COMPONENT
// ==========================================

export default function App() {
  // App Mode State ('SELECT', 'SHOP', 'TOUR')
  const [appMode, setAppMode] = useState<'SELECT' | 'SHOP' | 'TOUR'>('SELECT');
  const [activeTab, setActiveTab] = useState<'POS' | 'HISTORY' | 'SETTINGS'>('POS');
  
  // Password Protection State
  const [pinInput, setPinInput] = useState('');
  const [isPinAuthenticated, setIsPinAuthenticated] = useState(false);
  const [pinError, setPinError] = useState(false);
  const ADMIN_PIN = '1234'; // Wachtwoord / PIN voor instellingen

  const [isSyncing, setIsSyncing] = useState(false);

  // Persistent LocalStorage State
  const [company, setCompany] = useState<Company>(() => {
    const saved = localStorage.getItem('krauker_company');
    return saved ? JSON.parse(saved) : {
      name: 'Krauker Anijs',
      sellerName: 'Beheerder',
      salesmen: ['Beheerder', 'Medewerker 1']
    };
  });

  const [products, setProducts] = useState<Product[]>(() => {
    const saved = localStorage.getItem('krauker_products');
    return saved ? JSON.parse(saved) : [
      { id: '1', name: 'Krauker Anijs 33cl', price: 2.50, vatRate: 21, stock: 120, color: 'bg-amber-500' },
      { id: '2', name: 'Krauker Glas', price: 3.00, vatRate: 21, stock: 45, color: 'bg-sky-500' },
      { id: '3', name: 'Krauker Giftbox', price: 12.50, vatRate: 21, stock: 15, color: 'bg-indigo-500' }
    ];
  });

  const [sessions, setSessions] = useState<Session[]>(() => {
    const saved = localStorage.getItem('krauker_sessions');
    return saved ? JSON.parse(saved) : [];
  });

  const [cart, setCart] = useState<CartItem[]>([]);
  const [currentSession, setCurrentSession] = useState<Session | null>(sessions[0] || null);
  
  // UI States
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [newStaffName, setNewStaffName] = useState('');
  const [showSalesmanSelection, setShowSalesmanSelection] = useState(false);
  const [isPendingPayment, setIsPendingPayment] = useState<PaymentMethod | null>(null);
  const [isClosingSession, setIsClosingSession] = useState(false);
  const [endCashInput, setEndCashInput] = useState('');
  const [previewTransaction, setPreviewTransaction] = useState<Transaction | null>(null);
  const [previewSession, setPreviewSession] = useState<Session | null>(null);
  const [showSuccess, setShowSuccess] = useState(false);

  // Sync to LocalStorage
  useEffect(() => {
    localStorage.setItem('krauker_company', JSON.stringify(company));
  }, [company]);

  useEffect(() => {
    localStorage.setItem('krauker_products', JSON.stringify(products));
  }, [products]);

  useEffect(() => {
    localStorage.setItem('krauker_sessions', JSON.stringify(sessions));
  }, [sessions]);

  // Cart Handlers
  const addToCart = (product: Product) => {
    setCart(prev => {
      const existing = prev.find(item => item.product.id === product.id);
      if (existing) {
        return prev.map(item => 
          item.product.id === product.id 
            ? { ...item, quantity: item.quantity + 1 }
            : item
        );
      }
      return [...prev, { product, quantity: 1 }];
    });
  };

  const updateCartQuantity = (productId: string, delta: number) => {
    setCart(prev => prev.map(item => {
      if (item.product.id === productId) {
        const newQty = item.quantity + delta;
        return newQty > 0 ? { ...item, quantity: newQty } : null;
      }
      return item;
    }).filter(Boolean) as CartItem[]);
  };

  const clearCart = () => setCart([]);

  const totalAmount = cart.reduce((sum, item) => sum + (item.product.price * item.quantity), 0);

  // PIN Authentication Check
  const handlePinSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (pinInput === ADMIN_PIN) {
      setIsPinAuthenticated(true);
      setPinError(false);
      setPinInput('');
    } else {
      setPinError(true);
      setPinInput('');
    }
  };

  // Sync animation
  const triggerManualSync = () => {
    setIsSyncing(true);
    setTimeout(() => {
      setIsSyncing(false);
    }, 800);
  };

  // Payment
  const finalizePayment = (method: PaymentMethod) => {
    if (cart.length === 0) return;

    const newTransaction: Transaction = {
      id: `TX-${Date.now()}`,
      total: totalAmount,
      method,
      timestamp: Date.now(),
      items: [...cart]
    };

    if (currentSession) {
      const updatedSession = {
        ...currentSession,
        transactions: [newTransaction, ...currentSession.transactions]
      };
      setCurrentSession(updatedSession);
      setSessions(prev => prev.map(s => s.id === updatedSession.id ? updatedSession : s));
    }

    setPreviewTransaction(newTransaction);
    clearCart();
    setIsPendingPayment(null);
    setShowSuccess(true);
    setTimeout(() => setShowSuccess(false), 2500);
  };

  // ==========================================
  // MODE 1: LAUNCHER / CHOICE SCREEN (SHOP vs TOUR)
  // ==========================================
  if (appMode === 'SELECT') {
    return (
      <div className="h-screen w-screen bg-slate-900 flex flex-col items-center justify-center p-6 text-white font-sans">
        <div className="max-w-xl w-full space-y-8 text-center">
          <div>
            <div className="w-16 h-16 bg-indigo-600 rounded-3xl flex items-center justify-center text-white font-black text-3xl shadow-2xl mx-auto mb-4">
              K
            </div>
            <h1 className="text-3xl font-black tracking-tight">Krauker Anijs Kassa</h1>
            <p className="text-slate-400 text-sm mt-2">Selecteer de gewenste modus om te starten</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-4">
            <button
              onClick={() => { setAppMode('SHOP'); setActiveTab('POS'); }}
              className="bg-slate-800 border border-slate-700/80 p-8 rounded-3xl hover:border-indigo-500 hover:bg-slate-800/80 transition-all group flex flex-col items-center text-center space-y-4 shadow-xl active:scale-95"
            >
              <div className="w-14 h-14 bg-indigo-600/20 text-indigo-400 rounded-2xl flex items-center justify-center group-hover:scale-110 transition-transform">
                <Store size={28} />
              </div>
              <div>
                <h2 className="font-black text-xl text-white">Krauker Shop</h2>
                <p className="text-xs text-slate-400 mt-1">Directe kassa, voorraad, verkopen & afrekenen</p>
              </div>
            </button>

            <button
              onClick={() => { setAppMode('TOUR'); }}
              className="bg-slate-800 border border-slate-700/80 p-8 rounded-3xl hover:border-amber-500 hover:bg-slate-800/80 transition-all group flex flex-col items-center text-center space-y-4 shadow-xl active:scale-95"
            >
              <div className="w-14 h-14 bg-amber-600/20 text-amber-400 rounded-2xl flex items-center justify-center group-hover:scale-110 transition-transform">
                <Compass size={28} />
              </div>
              <div>
                <h2 className="font-black text-xl text-white">Krauker Tour</h2>
                <p className="text-xs text-slate-400 mt-1">Evenementen, reseller locaties & planning</p>
              </div>
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ==========================================
  // MODE 2: KRAUKER TOUR VIEW
  // ==========================================
  if (appMode === 'TOUR') {
    return (
      <div className="h-screen w-screen bg-slate-900 text-white font-sans flex flex-col">
        <header className="p-6 border-b border-slate-800 flex justify-between items-center">
          <div className="flex items-center gap-3">
            <button 
              onClick={() => setAppMode('SELECT')}
              className="p-2.5 bg-slate-800 hover:bg-slate-700 rounded-xl transition-all text-slate-300"
            >
              <ArrowLeft size={18} />
            </button>
            <h1 className="font-black text-xl tracking-tight">Krauker On Tour</h1>
          </div>
          <span className="px-3 py-1 bg-amber-500/20 text-amber-400 border border-amber-500/30 text-xs font-bold rounded-full">
            Event Modus
          </span>
        </header>

        <main className="flex-1 p-8 overflow-y-auto max-w-4xl mx-auto w-full space-y-6">
          <div className="bg-slate-800/60 border border-slate-700/60 p-6 rounded-3xl space-y-4">
            <h2 className="font-bold text-lg text-slate-200 flex items-center gap-2">
              <Calendar size={20} className="text-amber-400" /> Geplande Evenementen
            </h2>
            <div className="space-y-3">
              <div className="p-4 bg-slate-900/60 rounded-2xl border border-slate-800 flex justify-between items-center">
                <div>
                  <div className="font-bold text-sm text-white">New Orleans Jazz Evening</div>
                  <div className="text-xs text-slate-400 flex items-center gap-1 mt-1">
                    <MapPin size={12} /> Bless Pure Taste, Aalst
                  </div>
                </div>
                <span className="text-xs font-mono font-bold text-amber-400 bg-amber-400/10 px-3 py-1 rounded-lg">
                  22 MEI
                </span>
              </div>
            </div>
          </div>
        </main>
      </div>
    );
  }

  // ==========================================
  // MODE 3: KRAUKER SHOP (KASSA / POS DASHBOARD)
  // ==========================================
  return (
    <div className="flex h-screen bg-slate-100 font-sans text-slate-900 overflow-hidden">
      {/* Sidebar Navigation */}
      <aside className="w-20 bg-slate-900 flex flex-col items-center py-6 justify-between shrink-0 z-20">
        <div className="flex flex-col items-center gap-6 w-full">
          <button 
            onClick={() => setAppMode('SELECT')}
            className="w-12 h-12 bg-indigo-600 hover:bg-indigo-700 rounded-2xl flex items-center justify-center text-white font-black text-xl shadow-lg transition-all"
            title="Wissel van Modus"
          >
            K
          </button>

          <nav className="flex flex-col gap-3 w-full px-3">
            <button 
              onClick={() => setActiveTab('POS')} 
              className={`p-3.5 rounded-2xl flex items-center justify-center transition-all ${
                activeTab === 'POS' ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-400 hover:text-white hover:bg-slate-800'
              }`}
              title="Kassa"
            >
              <ShoppingBag size={20} />
            </button>
            <button 
              onClick={() => setActiveTab('HISTORY')} 
              className={`p-3.5 rounded-2xl flex items-center justify-center transition-all ${
                activeTab === 'HISTORY' ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-400 hover:text-white hover:bg-slate-800'
              }`}
              title="Historiek"
            >
              <History size={20} />
            </button>
            <button 
              onClick={() => setActiveTab('SETTINGS')} 
              className={`p-3.5 rounded-2xl flex items-center justify-center transition-all ${
                activeTab === 'SETTINGS' ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-400 hover:text-white hover:bg-slate-800'
              }`}
              title="Instellingen"
            >
              <Settings size={20} />
            </button>
          </nav>
        </div>

        <div className="flex flex-col gap-3 items-center">
          <button 
            onClick={triggerManualSync}
            className={`p-3 rounded-2xl text-slate-400 hover:text-white hover:bg-slate-800 transition-all ${
              isSyncing ? 'animate-spin text-indigo-400' : ''
            }`}
            title="Handmatige Synchronisatie"
          >
            <RefreshCw size={18} />
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 overflow-hidden relative bg-slate-50 flex">
        {activeTab === 'POS' && (
          <div className="flex-1 flex h-full">
            {/* Products Grid */}
            <div className="flex-1 p-6 overflow-y-auto space-y-6">
              <div className="flex justify-between items-center border-b border-slate-200 pb-4">
                <div>
                  <h1 className="text-2xl font-black tracking-tight text-slate-900">Kassa Dashboard</h1>
                  <p className="text-slate-500 text-xs mt-0.5">
                    Actieve verkoper: <span className="font-bold text-indigo-600">{company.sellerName}</span>
                  </p>
                </div>
                <button 
                  onClick={() => setShowSalesmanSelection(true)}
                  className="px-3 py-2 bg-white border border-slate-200 rounded-xl font-bold text-xs flex items-center gap-2 hover:bg-slate-100 shadow-sm transition-all"
                >
                  <Users size={14} /> Wissel Verkoper
                </button>
              </div>

              <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
                {products.map(p => (
                  <button
                    key={p.id}
                    onClick={() => addToCart(p)}
                    className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm hover:shadow-md hover:border-indigo-300 active:scale-98 transition-all flex flex-col justify-between h-36 text-left"
                  >
                    <div className="flex justify-between items-start w-full">
                      <span className="font-bold text-sm text-slate-800 line-clamp-2">{p.name}</span>
                      <span className={`w-3 h-3 rounded-full shrink-0 ${p.color || 'bg-slate-300'}`} />
                    </div>
                    <div className="flex justify-between items-end w-full">
                      <span className="text-xs text-slate-400 font-mono font-bold">Stock: {p.stock ?? 0}</span>
                      <span className="text-lg font-black text-indigo-600">€{p.price.toFixed(2)}</span>
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {/* Cart Panel */}
            <div className="w-96 bg-white border-l border-slate-200 flex flex-col justify-between h-full shadow-lg">
              <div className="p-6 border-b border-slate-100 flex justify-between items-center">
                <h2 className="font-black text-lg text-slate-900">Bestelling</h2>
                {cart.length > 0 && (
                  <button onClick={clearCart} className="text-slate-400 hover:text-rose-500 text-xs font-bold transition-colors">
                    Wis
                  </button>
                )}
              </div>

              <div className="flex-1 overflow-y-auto p-6 space-y-3">
                {cart.length === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center text-slate-400 space-y-2">
                    <ShoppingBag size={32} className="stroke-1" />
                    <p className="text-xs font-bold">Geen artikelen geselecteerd</p>
                  </div>
                ) : (
                  cart.map((item) => (
                    <div key={item.product.id} className="flex items-center justify-between p-3 bg-slate-50 rounded-xl border border-slate-100">
                      <div className="flex-1 pr-2">
                        <div className="font-bold text-xs text-slate-800">{item.product.name}</div>
                        <div className="text-xs text-indigo-600 font-bold mt-0.5">
                          €{(item.product.price * item.quantity).toFixed(2)}
                        </div>
                      </div>
                      <div className="flex items-center gap-2 bg-white rounded-lg border border-slate-200 p-1">
                        <button 
                          onClick={() => updateCartQuantity(item.product.id, -1)}
                          className="w-6 h-6 flex items-center justify-center rounded text-slate-600 hover:bg-slate-100 font-bold text-xs"
                        >
                          -
                        </button>
                        <span className="text-xs font-black w-4 text-center">{item.quantity}</span>
                        <button 
                          onClick={() => updateCartQuantity(item.product.id, 1)}
                          className="w-6 h-6 flex items-center justify-center rounded text-slate-600 hover:bg-slate-100 font-bold text-xs"
                        >
                          +
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>

              <div className="p-6 border-t border-slate-200 bg-slate-50 space-y-4">
                <div className="flex justify-between items-end">
                  <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Totaal te betalen</span>
                  <span className="text-3xl font-black text-slate-900">€{totalAmount.toFixed(2)}</span>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <button 
                    disabled={cart.length === 0}
                    onClick={() => setIsPendingPayment(PaymentMethod.CASH)}
                    className="py-3.5 bg-slate-800 text-white rounded-xl font-bold text-xs uppercase tracking-wider flex items-center justify-center gap-2 disabled:opacity-50 hover:bg-slate-900 transition-all shadow-sm"
                  >
                    <Banknote size={16} /> Contant
                  </button>
                  <button 
                    disabled={cart.length === 0}
                    onClick={() => setIsPendingPayment(PaymentMethod.CARD)}
                    className="py-3.5 bg-indigo-600 text-white rounded-xl font-bold text-xs uppercase tracking-wider flex items-center justify-center gap-2 disabled:opacity-50 hover:bg-indigo-700 transition-all shadow-md"
                  >
                    <CreditCard size={16} /> Kaart
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'HISTORY' && (
          <div className="h-full overflow-y-auto p-8 max-w-4xl mx-auto space-y-6 w-full pb-24">
            <h1 className="text-3xl font-black tracking-tight text-slate-900">Historiek & Shiften</h1>
            <div className="space-y-4">
              {sessions.map(s => (
                <div key={s.id} className="bg-white p-6 rounded-3xl border border-slate-200/80 shadow-sm space-y-4">
                  <div className="flex justify-between items-center">
                    <div>
                      <div className="font-black text-base text-slate-900">Shift {s.id}</div>
                      <div className="text-xs text-slate-400 font-medium mt-0.5">
                        {new Date(s.startTime).toLocaleString('nl-BE')}
                      </div>
                    </div>
                  </div>

                  <div className="flex justify-end gap-3 pt-4 border-t border-slate-100">
                    <button 
                      onClick={() => setPreviewSession(s)} 
                      className="flex items-center gap-2 px-4 py-2 bg-slate-100 text-slate-700 rounded-xl text-xs font-bold uppercase tracking-wider hover:bg-indigo-50 hover:text-indigo-600 transition-all"
                    >
                      Rapport
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {activeTab === 'SETTINGS' && (
          <div className="h-full overflow-y-auto p-8 max-w-4xl mx-auto space-y-8 w-full pb-24">
            <h1 className="text-3xl font-black tracking-tight text-slate-900">Instellingen</h1>

            {/* PASSWORD / PIN LOCK SCREEN */}
            {!isPinAuthenticated ? (
              <div className="bg-white p-8 rounded-3xl border border-slate-200/80 shadow-sm max-w-md mx-auto text-center space-y-6">
                <div className="w-16 h-16 bg-indigo-50 text-indigo-600 rounded-2xl flex items-center justify-center mx-auto">
                  <Lock size={28} />
                </div>
                <div>
                  <h2 className="font-black text-xl text-slate-900">Beheerder Toegang</h2>
                  <p className="text-slate-400 text-xs font-medium mt-1">Voer PIN in om instellingen te openen</p>
                </div>

                <form onSubmit={handlePinSubmit} className="space-y-4">
                  <input 
                    type="password" 
                    maxLength={4}
                    placeholder="****"
                    value={pinInput}
                    onChange={e => setPinInput(e.target.value)}
                    className="w-full text-center text-2xl tracking-widest font-mono p-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-indigo-600"
                  />
                  {pinError && <p className="text-xs text-rose-500 font-bold">Onjuiste PIN. Probeer opnieuw.</p>}
                  <button 
                    type="submit"
                    className="w-full bg-indigo-600 text-white py-3.5 rounded-xl font-bold uppercase text-xs tracking-wider shadow-md hover:bg-indigo-700 transition-all"
                  >
                    Ontgrendelen
                  </button>
                </form>
              </div>
            ) : (
              /* AUTHENTICATED SETTINGS CONTENT */
              <div className="space-y-8">
                <div className="bg-white p-6 rounded-3xl border border-slate-200/80 shadow-sm space-y-4">
                  <div className="flex justify-between items-center">
                    <h2 className="font-bold text-slate-800 text-sm uppercase tracking-wider">Producten Catalogus</h2>
                    <button 
                      onClick={() => {
                        const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(products, null, 2));
                        const dlAnchor = document.createElement('a');
                        dlAnchor.setAttribute("href", dataStr);
                        dlAnchor.setAttribute("download", `products_export.json`);
                        dlAnchor.click();
                      }} 
                      className="flex items-center gap-1.5 text-xs font-bold text-indigo-600 bg-indigo-50 px-3.5 py-2 rounded-xl hover:bg-indigo-100 transition-colors"
                    >
                      <Download size={14} /> Exporteer JSON
                    </button>
                  </div>

                  <div className="space-y-2">
                    {products.map(p => (
                      <div key={p.id} className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl border border-slate-100">
                        <div className="flex items-center gap-3">
                          <div className={`w-4 h-4 rounded-full ${p.color || 'bg-slate-300'}`} />
                          <div>
                            <div className="font-bold text-sm text-slate-800">{p.name}</div>
                            <div className="text-xs text-slate-400 font-mono">
                              €{p.price.toFixed(2)} | BTW {p.vatRate}% | Stock: {p.stock ?? 0}
                            </div>
                          </div>
                        </div>
                        <button 
                          onClick={() => setEditingProduct(p)} 
                          className="p-2 text-slate-400 hover:text-indigo-600 transition-colors"
                        >
                          <Edit2 size={16} />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="bg-white p-6 rounded-3xl border border-slate-200/80 shadow-sm space-y-4">
                  <h2 className="font-bold text-slate-800 text-sm uppercase tracking-wider">Medewerkers</h2>
                  <div className="flex gap-2">
                    <input 
                      type="text" 
                      placeholder="Naam medewerker..." 
                      value={newStaffName} 
                      onChange={e => setNewStaffName(e.target.value)} 
                      className="flex-1 bg-slate-50 border border-slate-200 p-3 rounded-xl text-sm font-medium outline-none focus:border-indigo-500"
                    />
                    <button 
                      onClick={() => {
                        if (newStaffName.trim()) {
                          setCompany(prev => ({ ...prev, salesmen: [...prev.salesmen, newStaffName.trim()] }));
                          setNewStaffName('');
                        }
                      }} 
                      className="bg-indigo-600 text-white px-5 rounded-xl font-bold text-xs uppercase tracking-wider shadow-sm hover:bg-indigo-700 transition-all flex items-center gap-1"
                    >
                      <Plus size={18} /> Toevoegen
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </main>

      {/* MODALS */}
      {editingProduct && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-sm flex items-center justify-center p-6">
          <div className="bg-white rounded-3xl p-6 max-w-sm w-full space-y-4 shadow-2xl">
            <div className="flex justify-between items-center">
              <h3 className="font-black text-lg text-slate-900">Product Bewerken</h3>
              <button onClick={() => setEditingProduct(null)} className="text-slate-400 hover:text-slate-600"><X size={20} /></button>
            </div>
            <div className="space-y-3">
              <div>
                <label className="text-xs font-bold text-slate-400 uppercase tracking-wider block mb-1">Naam</label>
                <input 
                  type="text" 
                  value={editingProduct.name} 
                  onChange={e => setEditingProduct({ ...editingProduct, name: e.target.value })} 
                  className="w-full bg-slate-50 border border-slate-200 p-3 rounded-xl font-medium text-sm outline-none focus:border-indigo-500"
                />
              </div>
              <div>
                <label className="text-xs font-bold text-slate-400 uppercase tracking-wider block mb-1">Prijs (€)</label>
                <input 
                  type="number" 
                  step="0.01" 
                  value={editingProduct.price} 
                  onChange={e => setEditingProduct({ ...editingProduct, price: parseFloat(e.target.value) || 0 })} 
                  className="w-full bg-slate-50 border border-slate-200 p-3 rounded-xl font-medium text-sm outline-none focus:border-indigo-500"
                />
              </div>
            </div>
            <button 
              onClick={() => {
                setProducts(prev => prev.map(p => p.id === editingProduct.id ? editingProduct : p));
                setEditingProduct(null);
              }} 
              className="w-full bg-indigo-600 text-white py-3.5 rounded-xl font-bold uppercase text-xs tracking-wider shadow-lg hover:bg-indigo-700 transition-all"
            >
              Opslaan
            </button>
          </div>
        </div>
      )}

      {/* Staff Selector Modal */}
      {showSalesmanSelection && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-sm flex items-center justify-center p-6">
          <div className="bg-white rounded-3xl p-6 max-w-xs w-full space-y-4 shadow-2xl text-center">
            <h3 className="font-black text-lg text-slate-900">Kies Verkoper</h3>
            <div className="space-y-2 max-h-60 overflow-y-auto">
              {(company.salesmen || []).map(name => (
                <button 
                  key={name} 
                  onClick={() => {
                    setCompany({ ...company, sellerName: name });
                    setShowSalesmanSelection(false);
                  }} 
                  className="w-full p-3 bg-slate-50 hover:bg-indigo-50 hover:text-indigo-600 rounded-xl font-bold text-xs uppercase tracking-wider transition-all border border-slate-100"
                >
                  {name}
                </button>
              ))}
            </div>
            <button onClick={() => setShowSalesmanSelection(false)} className="text-xs text-slate-400 font-bold uppercase tracking-wider py-2">
              Annuleren
            </button>
          </div>
        </div>
      )}

      {/* Payment Confirmation Modal */}
      {isPendingPayment && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-6">
          <div className="bg-white rounded-3xl p-8 max-w-xs w-full space-y-6 text-center shadow-2xl">
            <div className={`w-16 h-16 rounded-full flex items-center justify-center mx-auto ${
              isPendingPayment === PaymentMethod.CARD ? 'bg-sky-100 text-sky-600' : 'bg-emerald-100 text-emerald-600'
            }`}>
              {isPendingPayment === PaymentMethod.CARD ? <CreditCard size={32} /> : <Banknote size={32} />}
            </div>
            <div>
              <h3 className="font-black text-xl text-slate-900">
                {isPendingPayment === PaymentMethod.CARD ? 'Kaartbetaling' : 'Contant Ontvangen'}
              </h3>
              <p className="text-slate-500 text-xs font-bold mt-1">Ontvang €{totalAmount.toFixed(2)}</p>
            </div>
            <div className="space-y-3">
              <button 
                onClick={() => finalizePayment(isPendingPayment)} 
                className="w-full bg-emerald-600 text-white py-3.5 rounded-xl font-bold uppercase text-xs tracking-wider shadow-lg hover:bg-emerald-700 transition-all"
              >
                Bevestig Betaling
              </button>
              <button 
                onClick={() => setIsPendingPayment(null)} 
                className="w-full bg-slate-100 text-slate-600 py-3 rounded-xl font-bold uppercase text-xs hover:bg-slate-200 transition-colors"
              >
                Annuleren
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Shift / Transaction Preview Modal */}
      {(previewSession || previewTransaction) && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-6">
          <div className="bg-white rounded-3xl p-6 max-w-sm w-full space-y-4 shadow-2xl flex flex-col">
            <div className="flex justify-between items-center">
              <h3 className="font-black text-base text-slate-900">
                {previewSession ? 'Shift Rapport' : 'Kassabon'}
              </h3>
              <button 
                onClick={() => { setPreviewSession(null); setPreviewTransaction(null); }} 
                className="text-slate-400 hover:text-slate-600"
              >
                <X size={20} />
              </button>
            </div>

            <div className="p-2 bg-slate-50 rounded-2xl border border-slate-200">
              <Receipt company={company} session={previewSession} transaction={previewTransaction} />
            </div>

            <button 
              onClick={() => { setPreviewSession(null); setPreviewTransaction(null); }} 
              className="w-full bg-slate-900 text-white py-3.5 rounded-xl font-bold uppercase text-xs tracking-wider shadow-lg hover:bg-slate-800 transition-all"
            >
              Sluiten
            </button>
          </div>
        </div>
      )}

      {/* Success Notification */}
      {showSuccess && (
        <div className="fixed inset-x-6 top-8 z-50 max-w-md mx-auto bg-emerald-600 text-white p-4 rounded-2xl shadow-2xl flex items-center justify-center gap-3">
          <CheckCircle size={20} />
          <span className="font-black text-xs uppercase tracking-wider">Transactie Verwerkt!</span>
        </div>
      )}
    </div>
  );
}
