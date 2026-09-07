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
  Banknote
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
  updatedAt?: number;
}

export interface Company {
  name: string;
  sellerName: string;
  salesmen: string[];
  updatedAt?: number;
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
        <div className="text-[9px] text-slate-400 text-center pt-2">
          {new Date(transaction.timestamp).toLocaleString('nl-BE')}
        </div>
      </div>
    )}

    {session && (
      <div className="space-y-1.5 pt-1">
        <div className="font-bold border-b border-slate-200 pb-1 text-center uppercase tracking-wider text-[11px]">
          Shift Rapport ({session.id})
        </div>
        <div className="flex justify-between">
          <span>Start:</span>
          <span>{new Date(session.startTime).toLocaleTimeString('nl-BE', { hour: '2-digit', minute: '2-digit' })}</span>
        </div>
        {session.endTime && (
          <div className="flex justify-between">
            <span>Einde:</span>
            <span>{new Date(session.endTime).toLocaleTimeString('nl-BE', { hour: '2-digit', minute: '2-digit' })}</span>
          </div>
        )}
        <div className="flex justify-between"><span>Start contant:</span><span>€{session.startCash.toFixed(2)}</span></div>
        {session.endCash !== undefined && (
          <div className="flex justify-between"><span>Eind contant:</span><span>€{session.endCash.toFixed(2)}</span></div>
        )}
        <div className="flex justify-between font-bold pt-1 border-t border-slate-100">
          <span>Aantal verkopen:</span>
          <span>{session.transactions.length}</span>
        </div>
        <div className="flex justify-between font-bold text-indigo-600">
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
  const [activeTab, setActiveTab] = useState<'POS' | 'HISTORY' | 'SETTINGS'>('POS');
  const [isSyncing, setIsSyncing] = useState(false);

  // Persistent State
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
    return saved ? JSON.parse(saved) : [
      {
        id: 'SESS-101',
        startTime: Date.now() - 14400000,
        endTime: Date.now() - 3600000,
        startCash: 100.00,
        endCash: 175.00,
        transactions: [
          { 
            id: 'TX-1', 
            total: 5.00, 
            method: PaymentMethod.CASH, 
            timestamp: Date.now() - 10800000,
            items: [{ product: { id: '1', name: 'Krauker Anijs 33cl', price: 2.50, vatRate: 21 }, quantity: 2 }]
          }
        ]
      }
    ];
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

  // Sync animation
  const triggerManualSync = () => {
    setIsSyncing(true);
    setTimeout(() => {
      setIsSyncing(false);
    }, 800);
  };

  // Export
  const exportData = (type: string) => {
    const data = type === 'PRODUCTS' ? products : sessions;
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(data, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute("href", dataStr);
    downloadAnchor.setAttribute("download", `${type.toLowerCase()}_export.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  // Staff Management
  const addStaff = () => {
    if (!newStaffName.trim()) return;
    setCompany(prev => ({ ...prev, salesmen: [...prev.salesmen, newStaffName.trim()] }));
    setNewStaffName('');
  };

  const removeStaff = (name: string) => {
    setCompany(prev => ({ ...prev, salesmen: prev.salesmen.filter(s => s !== name) }));
  };

  // Session & Payment Management
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

    // Update stock locally
    setProducts(prev => prev.map(p => {
      const cartItem = cart.find(ci => ci.product.id === p.id);
      if (cartItem && p.stock !== undefined) {
        return { ...p, stock: Math.max(0, p.stock - cartItem.quantity) };
      }
      return p;
    }));

    setPreviewTransaction(newTransaction);
    clearCart();
    setIsPendingPayment(null);
    setShowSuccess(true);
    setTimeout(() => setShowSuccess(false), 2500);
  };

  const closeSession = () => {
    const cashVal = parseFloat(endCashInput);
    if (isNaN(cashVal)) return;

    if (currentSession) {
      const updated = { 
        ...currentSession, 
        endTime: Date.now(), 
        endCash: cashVal 
      };
      setSessions(prev => prev.map(s => s.id === updated.id ? updated : s));
      setCurrentSession(null);
    }
    setIsClosingSession(false);
    setEndCashInput('');
  };

  return (
    <div className="flex h-screen bg-slate-100 font-sans text-slate-900 overflow-hidden">
      {/* Sidebar Navigation */}
      <aside className="w-20 bg-slate-900 flex flex-col items-center py-6 justify-between shrink-0 z-20">
        <div className="flex flex-col items-center gap-6 w-full">
          <div className="w-12 h-12 bg-indigo-600 rounded-2xl flex items-center justify-center text-white font-black text-xl shadow-lg">
            K
          </div>
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

        <button 
          onClick={triggerManualSync}
          className={`p-3 rounded-2xl text-slate-400 hover:text-white hover:bg-slate-800 transition-all ${
            isSyncing ? 'animate-spin text-indigo-400' : ''
          }`}
          title="Handmatige Synchronisatie"
        >
          <RefreshCw size={18} />
        </button>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 overflow-hidden relative bg-slate-50 flex">
        {activeTab === 'POS' && (
          <div className="flex-1 flex h-full">
            {/* Products Grid Section */}
            <div className="flex-1 p-6 overflow-y-auto space-y-6">
              <div className="flex justify-between items-center border-b border-slate-200 pb-4">
                <div>
                  <h1 className="text-2xl font-black tracking-tight text-slate-900">Kassa Dashboard</h1>
                  <p className="text-slate-500 text-xs mt-0.5">
                    Actieve verkoper: <span className="font-bold text-indigo-600">{company.sellerName}</span>
                  </p>
                </div>
                <div className="flex gap-2">
                  <button 
                    onClick={() => setShowSalesmanSelection(true)}
                    className="px-3 py-2 bg-white border border-slate-200 rounded-xl font-bold text-xs flex items-center gap-2 hover:bg-slate-100 shadow-sm transition-all"
                  >
                    <Users size={14} /> Wissel Verkoper
                  </button>
                  {currentSession && (
                    <button 
                      onClick={() => setIsClosingSession(true)}
                      className="px-3 py-2 bg-rose-50 text-rose-600 border border-rose-100 rounded-xl font-bold text-xs flex items-center gap-2 hover:bg-rose-100 transition-all"
                    >
                      <LogOut size={14} /> Shift Sluiten
                    </button>
                  )}
                </div>
              </div>

              {/* Product Grid */}
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

              {/* Items List */}
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

              {/* Checkout Controls */}
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
                    <span className={`px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider border ${
                      s.endTime 
                        ? 'bg-emerald-50 text-emerald-600 border-emerald-100' 
                        : 'bg-amber-50 text-amber-600 border-amber-100'
                    }`}>
                      {s.endTime ? 'Voltooid' : 'Actief'}
                    </span>
                  </div>

                  <div className="flex justify-end gap-3 pt-4 border-t border-slate-100">
                    <button 
                      onClick={() => setPreviewSession(s)} 
                      className="flex items-center gap-2 px-4 py-2 bg-slate-100 text-slate-700 rounded-xl text-xs font-bold uppercase tracking-wider hover:bg-indigo-50 hover:text-indigo-600 transition-all"
                    >
                      Rapport
                    </button>
                    <button 
                      onClick={() => setSessions(prev => prev.filter(item => item.id !== s.id))} 
                      className="flex items-center gap-2 px-4 py-2 bg-rose-50 text-rose-600 rounded-xl text-xs font-bold uppercase tracking-wider hover:bg-rose-100 transition-all"
                    >
                      <Trash2 size={14} /> Verwijderen
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {activeTab === 'SETTINGS' && (
          <div className="h-full overflow-y-auto p-8 max-w-4xl mx-auto space-y-8 w-full pb-24">
            <h1 className="text-3xl font-black tracking-tight text-slate-900">Instellingen & Beheer</h1>

            {/* Product Management */}
            <div className="bg-white p-6 rounded-3xl border border-slate-200/80 shadow-sm space-y-4">
              <div className="flex justify-between items-center">
                <h2 className="font-bold text-slate-800 text-sm uppercase tracking-wider">Producten Catalogus</h2>
                <button 
                  onClick={() => exportData('PRODUCTS')} 
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

            {/* Staff Management */}
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
                  onClick={addStaff} 
                  className="bg-indigo-600 text-white px-5 rounded-xl font-bold text-xs uppercase tracking-wider shadow-sm hover:bg-indigo-700 transition-all flex items-center gap-1"
                >
                  <Plus size={18} /> Toevoegen
                </button>
              </div>

              <div className="flex flex-wrap gap-2 pt-2">
                {(company.salesmen || []).map(name => (
                  <div key={name} className="flex items-center gap-2 bg-slate-100 px-3.5 py-1.5 rounded-full text-xs font-bold text-slate-700 border border-slate-200">
                    <span>{name}</span>
                    <button onClick={() => removeStaff(name)} className="text-slate-400 hover:text-rose-500 transition-colors">
                      <X size={14} />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </main>

      {/* ========================================== */}
      {/* MODALS                                     */}
      {/* ========================================== */}

      {/* Edit Product Modal */}
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
              <div>
                <label className="text-xs font-bold text-slate-400 uppercase tracking-wider block mb-1">Voorraad</label>
                <input 
                  type="number" 
                  value={editingProduct.stock ?? 0} 
                  onChange={e => setEditingProduct({ ...editingProduct, stock: parseInt(e.target.value) || 0 })} 
                  className="w-full bg-slate-50 border border-slate-200 p-3 rounded-xl font-medium text-sm outline-none focus:border-indigo-500"
                />
              </div>
            </div>
            <button 
              onClick={() => {
                setProducts(prev => prev.map(p => p.id === editingProduct.id ? { ...editingProduct, updatedAt: Date.now() } : p));
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
                    setCompany({ ...company, sellerName: name, updatedAt: Date.now() });
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

      {/* Close Shift Modal */}
      {isClosingSession && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-6">
          <div className="bg-white rounded-3xl p-6 max-w-xs w-full space-y-4 shadow-2xl text-center">
            <h3 className="font-black text-lg text-slate-900">Shift Sluiten</h3>
            <p className="text-xs text-slate-500 font-medium">Voer de getelde kassa-inhoud (contant) in:</p>
            <input 
              type="number" 
              step="0.01" 
              placeholder="0.00"
              value={endCashInput} 
              onChange={e => setEndCashInput(e.target.value)} 
              className="w-full bg-slate-50 border border-slate-200 p-3 rounded-xl font-mono text-center font-bold text-lg outline-none focus:border-indigo-500"
            />
            <div className="space-y-2 pt-2">
              <button 
                onClick={closeSession} 
                className="w-full bg-rose-600 text-white py-3 rounded-xl font-bold uppercase text-xs tracking-wider shadow-md hover:bg-rose-700 transition-all"
              >
                Shift Beëindigen
              </button>
              <button 
                onClick={() => setIsClosingSession(false)} 
                className="w-full bg-slate-100 text-slate-600 py-2.5 rounded-xl font-bold uppercase text-xs hover:bg-slate-200 transition-colors"
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
