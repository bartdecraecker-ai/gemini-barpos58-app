import React, { useState, useEffect } from 'react';
import { 
  ShoppingCart, Receipt, Settings, Package, Trash2, Printer, 
  Bluetooth, X, Plus, Save, Lock, Edit3, Users, 
  CheckCircle2, AlertCircle, Home, MapPin, LogOut
} from 'lucide-react';
import { btPrinterService } from './services/bluetoothPrinter';
import { Transaction, Product, CompanyDetails, SalesSession, PaymentMethod, Staff } from './types';

export default function App() {
  // --- STATES & AUTH ---
  const [isUnlocked, setIsUnlocked] = useState(false);
  const [pinInput, setPinInput] = useState("");
  const [activeTab, setActiveTab] = useState<'DASHBOARD' | 'SHOP' | 'REPORTS' | 'MANAGE' | 'SETTINGS'>('DASHBOARD');
  const [viewMode, setViewMode] = useState<'GRID' | 'TOUR'>('GRID');
  
  // --- DATA ---
  const [products, setProducts] = useState<Product[]>([]);
  const [staff, setStaff] = useState<Staff[]>([
    { id: '1', name: 'Beheerder', pin: '1984', role: 'ADMIN' }
  ]);
  const [company, setCompany] = useState<CompanyDetails>({
    name: "KRAUKERBIER", address: "", address2: "", vatNumber: "", website: "",
    footerMessage: "Bedankt!", managerPin: "1984", updatedAt: Date.now()
  });

  // --- KASSA ---
  const [cart, setCart] = useState<{product: Product, qty: number}[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [currentSession, setCurrentSession] = useState<SalesSession | null>(null);
  const [btConnected, setBtConnected] = useState(false);
  const [previewTx, setPreviewTx] = useState<Transaction | null>(null);
  const [editingProd, setEditingProd] = useState<Product | null>(null);

  useEffect(() => {
    const check = setInterval(() => setBtConnected(btPrinterService.isConnected()), 2000);
    return () => clearInterval(check);
  }, []);

  // --- PIN LOGICA (TILES) ---
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

  const handleCheckout = async (method: PaymentMethod) => {
    if (method === PaymentMethod.CARD && !window.confirm("Kaartbetaling geslaagd?")) return;
    
    const total = cart.reduce((sum, item) => sum + (item.product.price * item.qty), 0);
    const newTx: Transaction = {
      id: 'TX-' + Date.now(), sessionId: currentSession?.id || 'S1', timestamp: Date.now(),
      dateStr: new Date().toLocaleString(), items: cart.map(i => ({ ...i.product, quantity: i.qty })),
      subtotal: total / 1.21, vat0: 0, vat21: total - (total / 1.21), total, paymentMethod: method, updatedAt: Date.now()
    };

    // Printen via de service
    const success = await btPrinterService.printReceipt(newTx, company, null, transactions);
    if (!success) alert("Printen mislukt. Controleer bluetooth.");

    setTransactions([newTx, ...transactions]);
    setCart([]);
    setPreviewTx(newTx);
  };

  // --- LOCK SCREEN (Pincode via Tiles) ---
  if (!isUnlocked) {
    return (
      <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center p-6 text-white">
        <h1 className="text-2xl font-black mb-8 italic">KRAUKERBIER</h1>
        <div className="flex gap-4 mb-8">
          {[1,2,3,4].map(i => (
            <div key={i} className={`w-4 h-4 rounded-full border-2 ${pinInput.length >= i ? 'bg-amber-500 border-amber-500' : 'border-slate-700'}`} />
          ))}
        </div>
        <div className="grid grid-cols-3 gap-4 w-full max-w-xs">
          {[1,2,3,4,5,6,7,8,9].map(n => (
            <button key={n} onClick={() => handlePinClick(n.toString())} className="h-20 bg-slate-800 rounded-2xl text-2xl font-bold active:bg-amber-500 transition-colors">{n}</button>
          ))}
          <div />
          <button onClick={() => handlePinClick("0")} className="h-20 bg-slate-800 rounded-2xl text-2xl font-bold active:bg-amber-500">0</button>
          <button onClick={() => setPinInput("")} className="h-20 text-slate-500 font-bold uppercase text-xs">Clear</button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 pb-24">
      {/* STATUS BAR TOP */}
      <div className="bg-slate-900 text-[10px] text-white px-4 py-1 flex justify-between font-bold uppercase tracking-widest">
        <div className="flex items-center gap-2">
          {btConnected ? <><Bluetooth size={10} className="text-emerald-400"/> Printer OK</> : <><AlertCircle size={10} className="text-red-400"/> Printer Offline</>}
        </div>
        <div>MODUS: {viewMode === 'GRID' ? 'SHOP (THUIS)' : 'TOUR (EVENT)'}</div>
      </div>

      <header className="bg-white border-b p-4 flex justify-between items-center shadow-sm">
        <h1 className="font-black text-xl italic leading-none">KRAUKERBIER</h1>
        <button onClick={() => setIsUnlocked(false)} className="text-slate-400"><LogOut size={20}/></button>
      </header>

      <main className="p-4 max-w-md mx-auto">
        
        {/* DASHBOARD (Startpunt na login) */}
        {activeTab === 'DASHBOARD' && (
          <div className="grid grid-cols-1 gap-4 py-10">
            <button onClick={() => setActiveTab('SHOP')} className="bg-amber-500 text-white p-8 rounded-[2.5rem] font-black text-xl flex items-center justify-between shadow-xl shadow-amber-100 italic">
              START VERKOOP <ShoppingCart size={32}/>
            </button>
            <div className="grid grid-cols-2 gap-4">
              <button onClick={() => setActiveTab('REPORTS')} className="bg-white p-6 rounded-[2rem] border font-bold text-slate-600">Rapporten</button>
              <button onClick={() => setActiveTab('MANAGE')} className="bg-white p-6 rounded-[2rem] border font-bold text-slate-600">Beheer</button>
            </div>
          </div>
        )}

        {/* SHOP TAB (MET TOUR/GRID MODUS) */}
        {activeTab === 'SHOP' && (
          <div className={viewMode === 'GRID' ? "grid grid-cols-3 gap-2" : "grid grid-cols-1 gap-3"}>
            {products.map(p => (
              <button key={p.id} onClick={() => setCart([...cart, {product: p, qty: 1}])} className={`${p.color} ${viewMode === 'TOUR' ? 'h-32' : 'h-20'} rounded-3xl border-2 border-white shadow-sm flex flex-col items-center justify-center text-center p-2`}>
                <span className="font-black uppercase text-[10px] leading-tight mb-1">{p.name}</span>
                <span className="font-bold text-sm">€{p.price.toFixed(2)}</span>
              </button>
            ))}
          </div>
        )}

        {/* STAFF/VERKOPER MANAGEMENT (Hervat) */}
        {activeTab === 'MANAGE' && (
          <div className="space-y-6">
            <div className="bg-white p-6 rounded-[2rem] border">
              <h3 className="font-black text-xs uppercase text-slate-400 mb-4 flex justify-between items-center">
                <span>Verkopers (Staff)</span>
                <Users size={16}/>
              </h3>
              {staff.map(s => (
                <div key={s.id} className="flex justify-between p-3 bg-slate-50 rounded-xl mb-2">
                  <span className="font-bold">{s.name}</span>
                  <span className="text-slate-400 text-xs tracking-widest">PIN: {s.pin}</span>
                </div>
              ))}
              <button className="w-full mt-2 p-2 border-2 border-dashed rounded-xl text-xs font-bold text-slate-400">+ Verkoper toevoegen</button>
            </div>
          </div>
        )}

        {/* SETTINGS (MET WISSEL OPTIE) */}
        {activeTab === 'SETTINGS' && (
          <div className="space-y-4">
            <div className="bg-white p-6 rounded-[2rem] border space-y-4">
              <h3 className="font-black text-xs uppercase text-slate-400">Weergave Instellingen</h3>
              <div className="flex bg-slate-100 p-1 rounded-2xl">
                <button onClick={() => setViewMode('GRID')} className={`flex-1 p-3 rounded-xl font-bold text-xs ${viewMode === 'GRID' ? 'bg-white shadow-sm' : ''}`}>SHOP (THUIS)</button>
                <button onClick={() => setViewMode('TOUR')} className={`flex-1 p-3 rounded-xl font-bold text-xs ${viewMode === 'TOUR' ? 'bg-white shadow-sm' : ''}`}>TOUR (EVENT)</button>
              </div>
            </div>

            <div className="bg-white p-6 rounded-[2rem] border space-y-2">
              <h3 className="font-black text-xs uppercase text-slate-400">Printer Connectie</h3>
              <button onClick={() => btPrinterService.connect()} className="w-full bg-slate-900 text-white p-4 rounded-2xl font-black text-xs">CONNECTEER PRINTER</button>
            </div>
          </div>
        )}

      </main>

      {/* NAVIGATIE BALK */}
      <nav className="fixed bottom-0 left-0 right-0 bg-white border-t p-3 flex justify-around z-50">
        <button onClick={() => setActiveTab('DASHBOARD')} className={`p-4 rounded-2xl ${activeTab === 'DASHBOARD' ? 'bg-slate-900 text-white' : 'text-slate-400'}`}><Home size={24}/></button>
        <button onClick={() => setActiveTab('SHOP')} className={`p-4 rounded-2xl ${activeTab === 'SHOP' ? 'bg-slate-900 text-white' : 'text-slate-400'}`}><ShoppingCart size={24}/></button>
        <button onClick={() => setActiveTab('REPORTS')} className={`p-4 rounded-2xl ${activeTab === 'REPORTS' ? 'bg-slate-900 text-white' : 'text-slate-400'}`}><Receipt size={24}/></button>
        <button onClick={() => setActiveTab('MANAGE')} className={`p-4 rounded-2xl ${activeTab === 'MANAGE' ? 'bg-slate-900 text-white' : 'text-slate-400'}`}><Package size={24}/></button>
        <button onClick={() => setActiveTab('SETTINGS')} className={`p-4 rounded-2xl ${activeTab === 'SETTINGS' ? 'bg-slate-900 text-white' : 'text-slate-400'}`}><Settings size={24}/></button>
      </nav>

      {/* AFREKEN OVERLAY */}
      {cart.length > 0 && activeTab === 'SHOP' && (
        <div className="fixed bottom-24 left-4 right-4 bg-white p-6 rounded-[2.5rem] shadow-2xl border border-slate-200 z-[60]">
          <div className="flex gap-2">
            <button onClick={() => handleCheckout(PaymentMethod.CASH)} className="flex-1 bg-slate-900 text-white p-5 rounded-2xl font-black italic">CASH €{cart.reduce((s,i)=>s+(i.product.price*i.qty),0).toFixed(2)}</button>
            <button onClick={() => handleCheckout(PaymentMethod.CARD)} className="flex-1 bg-indigo-600 text-white p-5 rounded-2xl font-black italic">KAART</button>
          </div>
        </div>
      )}
    </div>
  );
}
