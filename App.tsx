import React, { useState, useEffect } from 'react';
import { 
  ShoppingCart, Receipt, Settings, Package, Trash2, Printer, 
  Bluetooth, X, Plus, Save, Lock, Edit3, Users, 
  CheckCircle2, AlertCircle, Home, MapPin, LogOut, Wallet
} from 'lucide-react';
import { btPrinterService } from './services/bluetoothPrinter';
import { Transaction, Product, CompanyDetails, SalesSession, PaymentMethod, Staff } from './types';

export default function App() {
  // --- AUTH & NAV ---
  const [isUnlocked, setIsUnlocked] = useState(false);
  const [pinInput, setPinInput] = useState("");
  const [activeTab, setActiveTab] = useState<'DASHBOARD' | 'SHOP' | 'REPORTS' | 'MANAGE' | 'SETTINGS'>('DASHBOARD');
  const [viewMode, setViewMode] = useState<'GRID' | 'TOUR'>('GRID');
  
  // --- PRODUCT DATA ---
  const [products, setProducts] = useState<Product[]>([
    { id: '1', name: 'Kraukerbier', price: 2.50, vatRate: 21, color: 'bg-amber-100', stock: 50, updatedAt: Date.now() }
  ]);
  const [editingProd, setEditingProd] = useState<Product | null>(null);

  // --- SESSIE & KASSA ---
  const [currentSession, setCurrentSession] = useState<SalesSession | null>(null);
  const [showSessionStart, setShowSessionStart] = useState(false);
  const [openingCash, setOpeningCash] = useState("50");

  const [cart, setCart] = useState<{product: Product, qty: number}[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [btConnected, setBtConnected] = useState(false);
  const [company, setCompany] = useState<CompanyDetails>({
    name: "KRAUKERBIER", address: "Adres 1", address2: "9000 Gent", vatNumber: "BE000", website: "www.krauker.be",
    footerMessage: "Bedankt!", managerPin: "1984", updatedAt: Date.now()
  });

  useEffect(() => {
    const check = setInterval(() => setBtConnected(btPrinterService.isConnected()), 2000);
    return () => clearInterval(check);
  }, []);

  // --- PIN TILES LOGICA ---
  const handlePinClick = (num: string) => {
    if (pinInput.length < 4) {
      const newPin = pinInput + num;
      setPinInput(newPin);
      if (newPin === company.managerPin) {
        setIsUnlocked(true);
        setPinInput("");
      } else if (newPin.length === 4) {
        alert("Foutieve code");
        setPinInput("");
      }
    }
  };

  // --- SESSIE STARTEN ---
  const startNewSession = () => {
    const newSession: SalesSession = {
      id: 'SESS-' + Date.now(),
      startTime: Date.now(),
      startCash: parseFloat(openingCash),
      status: 'OPEN',
      cashManagement: { openingBalance: parseFloat(openingCash), closingBalance: 0, difference: 0 },
      summary: { totalSales: 0, transactionCount: 0, cashTotal: 0, cardTotal: 0, vat0Total: 0, vat21Total: 0 },
      updatedAt: Date.now()
    };
    setCurrentSession(newSession);
    setShowSessionStart(false);
    setActiveTab('SHOP');
  };

  // --- AFREKENEN ---
  const handleCheckout = async (method: PaymentMethod) => {
    if (!currentSession) return;
    if (method === PaymentMethod.CARD && !window.confirm("Kaartbetaling geslaagd?")) return;
    
    const total = cart.reduce((sum, item) => sum + (item.product.price * item.qty), 0);
    
    // Voorraad bijwerken
    setProducts(prev => prev.map(p => {
      const cartItem = cart.find(c => c.product.id === p.id);
      return cartItem ? { ...p, stock: Math.max(0, (p.stock || 0) - cartItem.qty) } : p;
    }));

    const newTx: Transaction = {
      id: 'TX-' + Date.now(), sessionId: currentSession.id, timestamp: Date.now(),
      dateStr: new Date().toLocaleString(), items: cart.map(i => ({ ...i.product, quantity: i.qty })),
      subtotal: total / 1.21, vat0: 0, vat21: total - (total / 1.21), total, paymentMethod: method, updatedAt: Date.now()
    };

    // Printen
    await btPrinterService.printReceipt(newTx, company, null, transactions);

    // Sessie totalen updaten
    setCurrentSession({
      ...currentSession,
      summary: {
        ...currentSession.summary,
        totalSales: currentSession.summary.totalSales + total,
        transactionCount: currentSession.summary.transactionCount + 1,
        cashTotal: method === PaymentMethod.CASH ? currentSession.summary.cashTotal + total : currentSession.summary.cashTotal,
        cardTotal: method === PaymentMethod.CARD ? currentSession.summary.cardTotal + total : currentSession.summary.cardTotal,
      }
    });

    setTransactions([newTx, ...transactions]);
    setCart([]);
  };

  // --- LOCK SCREEN (Tiles) ---
  if (!isUnlocked) {
    return (
      <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center p-6 text-white">
        <h1 className="text-3xl font-black mb-4 italic text-amber-500">KRAUKERBIER</h1>
        <p className="mb-8 text-slate-400 font-bold tracking-widest uppercase text-xs">Beveiligde Toegang</p>
        <div className="flex gap-4 mb-10">
          {[1,2,3,4].map(i => (
            <div key={i} className={`w-5 h-5 rounded-full border-2 transition-all ${pinInput.length >= i ? 'bg-amber-500 border-amber-500 scale-125' : 'border-slate-700'}`} />
          ))}
        </div>
        <div className="grid grid-cols-3 gap-4 w-full max-w-xs">
          {[1,2,3,4,5,6,7,8,9].map(n => (
            <button key={n} onClick={() => handlePinClick(n.toString())} className="h-20 bg-slate-800 rounded-[2rem] text-2xl font-black active:bg-amber-500 transition-all border border-slate-700">{n}</button>
          ))}
          <div />
          <button onClick={() => handlePinClick("0")} className="h-20 bg-slate-800 rounded-[2rem] text-2xl font-black active:bg-amber-500 border border-slate-700">0</button>
          <button onClick={() => setPinInput("")} className="h-20 text-slate-500 font-black uppercase text-xs">Reset</button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 pb-24">
      {/* STATUS BAR */}
      <div className="bg-slate-900 text-[10px] text-white px-4 py-2 flex justify-between font-black uppercase tracking-[0.1em]">
        <div className="flex items-center gap-2">
          <div className={`w-2 h-2 rounded-full ${btConnected ? 'bg-emerald-500' : 'bg-red-500'}`} />
          {btConnected ? 'Printer Verbonden' : 'Geen Printer'}
        </div>
        <div className="text-amber-500">{viewMode === 'GRID' ? 'Shop Modus (Thuis)' : 'Tour Modus (Event)'}</div>
      </div>

      <header className="bg-white border-b p-4 flex justify-between items-center">
        <div className="italic font-black text-xl">KRAUKERBIER</div>
        <button onClick={() => setIsUnlocked(false)} className="p-2 bg-slate-100 rounded-xl"><LogOut size={18}/></button>
      </header>

      <main className="p-4 max-w-md mx-auto">
        
        {/* DASHBOARD */}
        {activeTab === 'DASHBOARD' && (
          <div className="space-y-4 pt-4">
            <button onClick={() => currentSession ? setActiveTab('SHOP') : setShowSessionStart(true)} 
              className="w-full bg-amber-500 text-white p-10 rounded-[3rem] font-black text-2xl shadow-xl shadow-amber-200 flex items-center justify-between italic overflow-hidden relative group">
              <div className="relative z-10">{currentSession ? 'VERKOOP HERVAT' : 'START VERKOOP'}</div>
              <ShoppingCart size={40} className="relative z-10 opacity-50"/>
              <div className="absolute inset-0 bg-white/10 group-active:bg-transparent" />
            </button>
            <div className="grid grid-cols-2 gap-4">
              <div onClick={() => setActiveTab('REPORTS')} className="bg-white p-6 rounded-[2.5rem] border-2 border-slate-100 font-black text-center text-slate-600">RAPPORTEN</div>
              <div onClick={() => setActiveTab('MANAGE')} className="bg-white p-6 rounded-[2.5rem] border-2 border-slate-100 font-black text-center text-slate-600">BEHEER</div>
            </div>
          </div>
        )}

        {/* SHOP TAB */}
        {activeTab === 'SHOP' && currentSession && (
          <div className={viewMode === 'GRID' ? "grid grid-cols-3 gap-2" : "grid grid-cols-1 gap-3"}>
            {products.map(p => (
              <button key={p.id} onClick={() => setCart([...cart, {product: p, qty: 1}])} 
                className={`${p.color} ${viewMode === 'TOUR' ? 'h-32 px-6' : 'h-24 px-2'} rounded-[2rem] border-2 border-white shadow-sm flex flex-col items-center justify-center relative overflow-hidden active:scale-95 transition-all`}>
                <span className="font-black uppercase text-[10px] mb-1">{p.name}</span>
                <span className="font-black text-sm italic">€{p.price.toFixed(2)}</span>
                <span className="absolute bottom-2 right-3 text-[8px] font-black opacity-40">ST: {p.stock}</span>
              </button>
            ))}
          </div>
        )}

        {/* PRODUCT BEHEER (HERSTELD) */}
        {activeTab === 'MANAGE' && (
          <div className="space-y-4">
            <div className="flex justify-between items-center mb-2">
              <h2 className="font-black uppercase text-xs text-slate-400 italic">Producten Lijst</h2>
              <button onClick={() => setEditingProd({id: Date.now().toString(), name: '', price: 0, vatRate: 21, color: 'bg-slate-200', stock: 0, updatedAt: Date.now()})} className="bg-slate-900 text-white p-2 rounded-full"><Plus size={18}/></button>
            </div>
            {products.map(p => (
              <div key={p.id} className="bg-white p-4 rounded-3xl border-2 border-slate-100 flex justify-between items-center">
                <div>
                  <div className="font-black uppercase text-sm italic">{p.name}</div>
                  <div className="text-[10px] font-bold text-slate-400">€{p.price.toFixed(2)} • Stock: {p.stock}</div>
                </div>
                <div className="flex gap-2">
                  <button onClick={() => setEditingProd(p)} className="p-2 text-indigo-500 bg-indigo-50 rounded-xl"><Edit3 size={16}/></button>
                  <button onClick={() => setProducts(products.filter(x => x.id !== p.id))} className="p-2 text-red-500 bg-red-50 rounded-xl"><Trash2 size={16}/></button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* SETTINGS (MET WISSEL) */}
        {activeTab === 'SETTINGS' && (
          <div className="space-y-6">
            <div className="bg-white p-6 rounded-[2.5rem] border-2 border-slate-100">
              <h3 className="font-black text-xs uppercase text-slate-400 mb-4 tracking-widest">App Modus</h3>
              <div className="flex bg-slate-100 p-1 rounded-2xl">
                <button onClick={() => setViewMode('GRID')} className={`flex-1 p-3 rounded-xl font-black text-[10px] ${viewMode === 'GRID' ? 'bg-white shadow-md text-amber-500' : 'text-slate-400'}`}>SHOP (THUIS)</button>
                <button onClick={() => setViewMode('TOUR')} className={`flex-1 p-3 rounded-xl font-black text-[10px] ${viewMode === 'TOUR' ? 'bg-white shadow-md text-amber-500' : 'text-slate-400'}`}>TOUR (EVENT)</button>
              </div>
            </div>
            <button onClick={() => btPrinterService.connect()} className="w-full bg-slate-900 text-white p-5 rounded-3xl font-black italic shadow-lg">CONNECTEER PRINTER</button>
          </div>
        )}

      </main>

      {/* START SESSIE MODAL */}
      {showSessionStart && (
        <div className="fixed inset-0 bg-slate-900/90 backdrop-blur-md z-[100] flex items-center justify-center p-6 text-white">
          <div className="w-full max-w-xs text-center">
            <div className="bg-amber-500 w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-6 shadow-2xl shadow-amber-500/20"><Wallet size={32}/></div>
            <h2 className="text-2xl font-black mb-2 italic">START SESSIE</h2>
            <p className="text-slate-400 text-xs mb-8 uppercase font-bold tracking-widest">Voer startbedrag cash in</p>
            <input type="number" value={openingCash} onChange={e => setOpeningCash(e.target.value)} 
              className="bg-transparent border-b-2 border-amber-500 text-4xl font-black text-center w-full mb-10 outline-none" autoFocus />
            <button onClick={startNewSession} className="w-full bg-white text-slate-900 p-5 rounded-[2rem] font-black uppercase tracking-widest">Open Kassa</button>
            <button onClick={() => setShowSessionStart(false)} className="mt-4 text-slate-500 text-[10px] font-black uppercase">Annuleren</button>
          </div>
        </div>
      )}

      {/* PRODUCT EDIT MODAL */}
      {editingProd && (
        <div className="fixed inset-0 bg-white z-[110] p-6 overflow-y-auto">
          <div className="max-w-xs mx-auto space-y-6">
            <h2 className="text-2xl font-black italic uppercase">Product Info</h2>
            <div className="space-y-4">
              <div className="space-y-1">
                <label className="text-[10px] font-black uppercase text-slate-400 ml-2">Naam</label>
                <input className="w-full bg-slate-100 p-4 rounded-2xl font-bold outline-none" value={editingProd.name} onChange={e => setEditingProd({...editingProd, name: e.target.value})}/>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-[10px] font-black uppercase text-slate-400 ml-2">Prijs (€)</label>
                  <input type="number" className="w-full bg-slate-100 p-4 rounded-2xl font-bold outline-none" value={editingProd.price} onChange={e => setEditingProd({...editingProd, price: parseFloat(e.target.value)})}/>
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-black uppercase text-slate-400 ml-2">Stock</label>
                  <input type="number" className="w-full bg-slate-100 p-4 rounded-2xl font-bold outline-none" value={editingProd.stock} onChange={e => setEditingProd({...editingProd, stock: parseInt(e.target.value)})}/>
                </div>
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-black uppercase text-slate-400 ml-2">Kleur Klasse</label>
                <select className="w-full bg-slate-100 p-4 rounded-2xl font-bold outline-none" value={editingProd.color} onChange={e => setEditingProd({...editingProd, color: e.target.value})}>
                  <option value="bg-amber-100">Amber (Bier)</option>
                  <option value="bg-blue-100">Blauw (Fris)</option>
                  <option value="bg-emerald-100">Groen (Wijn)</option>
                  <option value="bg-red-100">Rood (Sterk)</option>
                  <option value="bg-slate-100">Grijs</option>
                </select>
              </div>
            </div>
            <div className="flex gap-2 pt-4">
              <button onClick={() => {
                if (products.find(x => x.id === editingProd.id)) {
                  setProducts(products.map(p => p.id === editingProd.id ? editingProd : p));
                } else {
                  setProducts([...products, editingProd]);
                }
                setEditingProd(null);
              }} className="flex-1 bg-emerald-500 text-white p-5 rounded-3xl font-black italic uppercase">Opslaan</button>
              <button onClick={() => setEditingProd(null)} className="flex-1 bg-slate-100 text-slate-400 p-5 rounded-3xl font-black italic uppercase text-xs">Annuleren</button>
            </div>
          </div>
        </div>
      )}

      {/* NAVIGATIE */}
      <nav className="fixed bottom-0 left-0 right-0 bg-white/80 backdrop-blur-lg border-t p-3 flex justify-around items-center z-50">
        <button onClick={() => setActiveTab('DASHBOARD')} className={`p-4 rounded-2xl transition-all ${activeTab === 'DASHBOARD' ? 'bg-slate-900 text-white scale-110 shadow-lg shadow-slate-200' : 'text-slate-400'}`}><Home size={22}/></button>
        <button onClick={() => setActiveTab('SHOP')} className={`p-4 rounded-2xl transition-all ${activeTab === 'SHOP' ? 'bg-slate-900 text-white scale-110 shadow-lg shadow-slate-200' : 'text-slate-400'}`}><ShoppingCart size={22}/></button>
        <button onClick={() => setActiveTab('REPORTS')} className={`p-4 rounded-2xl transition-all ${activeTab === 'REPORTS' ? 'bg-slate-900 text-white scale-110 shadow-lg shadow-slate-200' : 'text-slate-400'}`}><Receipt size={22}/></button>
        <button onClick={() => setActiveTab('MANAGE')} className={`p-4 rounded-2xl transition-all ${activeTab === 'MANAGE' ? 'bg-slate-900 text-white scale-110 shadow-lg shadow-slate-200' : 'text-slate-400'}`}><Package size={22}/></button>
        <button onClick={() => setActiveTab('SETTINGS')} className={`p-4 rounded-2xl transition-all ${activeTab === 'SETTINGS' ? 'bg-slate-900 text-white scale-110 shadow-lg shadow-slate-200' : 'text-slate-400'}`}><Settings size={22}/></button>
      </nav>

      {/* TOTAAL OVERLAY IN SHOP */}
      {cart.length > 0 && activeTab === 'SHOP' && (
        <div className="fixed bottom-24 left-4 right-4 bg-white p-6 rounded-[2.5rem] shadow-2xl border-2 border-slate-100 z-[60] animate-in slide-in-from-bottom-5">
           <div className="flex justify-between items-center mb-4 px-2 italic font-black text-sm">
             <span className="text-slate-400 uppercase text-xs">Bestelling</span>
             <span className="text-amber-500">€{cart.reduce((s,i)=>s+(i.product.price*i.qty),0).toFixed(2)}</span>
           </div>
           <div className="flex gap-2">
            <button onClick={() => handleCheckout(PaymentMethod.CASH)} className="flex-1 bg-slate-900 text-white p-5 rounded-2xl font-black italic uppercase text-xs">CASH</button>
            <button onClick={() => handleCheckout(PaymentMethod.CARD)} className="flex-1 bg-indigo-600 text-white p-5 rounded-2xl font-black italic uppercase text-xs">KAART</button>
            <button onClick={() => setCart([])} className="p-5 bg-slate-100 rounded-2xl text-slate-400"><X size={18}/></button>
          </div>
        </div>
      )}
    </div>
  );
}
