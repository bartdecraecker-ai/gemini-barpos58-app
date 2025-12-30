import React, { useState, useEffect } from 'react';
import { 
  ShoppingCart, Receipt, Settings, Package, Trash2, Printer, 
  Bluetooth, X, Plus, Save, Lock, Edit3, Users, 
  CheckCircle2, AlertCircle, Home, MapPin, LogOut, Wallet, CreditCard
} from 'lucide-react';
import { btPrinterService } from './services/bluetoothPrinter';
import { Transaction, Product, CompanyDetails, SalesSession, PaymentMethod } from './types';

export default function App() {
  // --- CORE STATES ---
  const [isUnlocked, setIsUnlocked] = useState(false);
  const [pinInput, setPinInput] = useState("");
  const [activeTab, setActiveTab] = useState<'DASHBOARD' | 'SHOP' | 'REPORTS' | 'MANAGE' | 'SETTINGS'>('DASHBOARD');
  const [viewMode, setViewMode] = useState<'GRID' | 'TOUR'>('GRID');
  
  // --- DATA ---
  const [products, setProducts] = useState<Product[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [currentSession, setCurrentSession] = useState<SalesSession | null>(null);
  
  // --- UI STATES ---
  const [showSessionStart, setShowSessionStart] = useState(false);
  const [showCardConfirm, setShowCardConfirm] = useState(false);
  const [openingCash, setOpeningCash] = useState("50");
  const [editingProd, setEditingProd] = useState<Product | null>(null);
  const [cart, setCart] = useState<{product: Product, qty: number}[]>([]);
  const [btConnected, setBtConnected] = useState(false);

  // --- PRINTER STATUS POLLING ---
  useEffect(() => {
    const checkBt = () => setBtConnected(btPrinterService.isConnected());
    const interval = setInterval(checkBt, 1000);
    return () => clearInterval(interval);
  }, []);

  // --- PIN LOGICA ---
  const handlePinClick = (num: string) => {
    if (pinInput.length < 4) {
      const nextPin = pinInput + num;
      setPinInput(nextPin);
      if (nextPin === "1984") { // Hardcoded voor test, koppel aan company.managerPin later
        setIsUnlocked(true);
        setPinInput("");
      } else if (nextPin.length === 4) {
        setPinInput("");
      }
    }
  };

  // --- AFREKENEN LOGICA ---
  const processSale = async (method: PaymentMethod) => {
    if (!currentSession) return;
    
    const total = cart.reduce((sum, item) => sum + (item.product.price * item.qty), 0);
    const v21 = total * 0.21 / 1.21;

    const newTx: Transaction = {
      id: 'TX-' + Date.now(),
      sessionId: currentSession.id,
      timestamp: Date.now(),
      dateStr: new Date().toLocaleString('nl-BE'),
      items: cart.map(i => ({ ...i.product, quantity: i.qty })),
      subtotal: total - v21,
      vat0: 0,
      vat21: v21,
      total: total,
      paymentMethod: method,
      updatedAt: Date.now()
    };

    // 1. Update Stock
    setProducts(prev => prev.map(p => {
      const item = cart.find(c => c.product.id === p.id);
      return item ? { ...p, stock: Math.max(0, (p.stock || 0) - item.qty) } : p;
    }));

    // 2. Update Sessie & Rapporten
    setCurrentSession(prev => prev ? {
      ...prev,
      summary: {
        ...prev.summary,
        totalSales: prev.summary.totalSales + total,
        transactionCount: prev.summary.transactionCount + 1,
        cashTotal: method === PaymentMethod.CASH ? prev.summary.cashTotal + total : prev.summary.cashTotal,
        cardTotal: method === PaymentMethod.CARD ? prev.summary.cardTotal + total : prev.summary.cardTotal,
      }
    } : null);

    // 3. Opslaan in lijst voor Rapporten-tab
    setTransactions(prev => [newTx, ...prev]);

    // 4. PRINTEN
    try {
      await btPrinterService.printReceipt(newTx, {name: "KRAUKERBIER", address: "Kerkstraat", vatNumber: "BE000", website: "www.krauker.be", managerPin: "1984", updatedAt: 0, footerMessage: "Bedankt!"}, null, []);
    } catch (e) {
      console.error("Printen mislukt");
    }

    setCart([]);
    setShowCardConfirm(false);
    setActiveTab('DASHBOARD');
  };

  if (!isUnlocked) {
    return (
      <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center p-6 text-white">
        <h1 className="text-3xl font-black mb-8 italic text-amber-500">KRAUKERBIER</h1>
        <div className="flex gap-4 mb-10">
          {[1,2,3,4].map(i => (
            <div key={i} className={`w-5 h-5 rounded-full border-2 ${pinInput.length >= i ? 'bg-amber-500 border-amber-500' : 'border-slate-700'}`} />
          ))}
        </div>
        <div className="grid grid-cols-3 gap-4 w-full max-w-xs">
          {[1,2,3,4,5,6,7,8,9].map(n => (
            <button key={n} onClick={() => handlePinClick(n.toString())} className="h-20 bg-slate-800 rounded-3xl text-2xl font-black active:bg-amber-500 border border-slate-700">{n}</button>
          ))}
          <div />
          <button onClick={() => handlePinClick("0")} className="h-20 bg-slate-800 rounded-3xl text-2xl font-black border border-slate-700">0</button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 pb-24 font-sans">
      {/* STATUS BAR - NU CORRECT GEKOPPELD AAN BT STATUS */}
      <div className={`px-4 py-2 flex justify-between text-[10px] font-black uppercase tracking-widest transition-colors ${btConnected ? 'bg-emerald-600 text-white' : 'bg-red-600 text-white'}`}>
        <div className="flex items-center gap-2">
          {btConnected ? <CheckCircle2 size={12}/> : <AlertCircle size={12}/>}
          {btConnected ? 'Printer Online' : 'Printer Offline (Check Settings)'}
        </div>
        <div>{viewMode} MODE</div>
      </div>

      <header className="bg-white border-b p-4 flex justify-between items-center shadow-sm">
        <div className="italic font-black text-xl text-slate-900 tracking-tighter">KRAUKERBIER</div>
        <button onClick={() => setIsUnlocked(false)} className="text-slate-300 hover:text-red-500"><LogOut size={20}/></button>
      </header>

      <main className="p-4 max-w-md mx-auto">
        {/* DASHBOARD */}
        {activeTab === 'DASHBOARD' && (
          <div className="space-y-4 pt-4">
            <button onClick={() => currentSession ? setActiveTab('SHOP') : setShowSessionStart(true)} className="w-full bg-amber-500 text-white p-12 rounded-[3rem] font-black text-2xl shadow-xl shadow-amber-200 flex items-center justify-between italic">
              {currentSession ? 'GA NAAR KASSA' : 'START SESSIE'}
              <ShoppingCart size={32} />
            </button>
            <div className="grid grid-cols-2 gap-4">
              <button onClick={() => setActiveTab('REPORTS')} className="bg-white p-8 rounded-[2.5rem] border-2 border-slate-100 font-black text-slate-500 shadow-sm">RAPPORTEN</button>
              <button onClick={() => setActiveTab('MANAGE')} className="bg-white p-8 rounded-[2.5rem] border-2 border-slate-100 font-black text-slate-500 shadow-sm">BEHEER</button>
            </div>
          </div>
        )}

        {/* SHOP */}
        {activeTab === 'SHOP' && currentSession && (
          <div className={viewMode === 'GRID' ? "grid grid-cols-3 gap-2" : "grid grid-cols-1 gap-3"}>
            {products.map(p => (
              <button key={p.id} onClick={() => setCart([...cart, {product: p, qty: 1}])} className={`${p.color} ${viewMode === 'TOUR' ? 'h-32' : 'h-24'} rounded-[2rem] border-2 border-white shadow-sm flex flex-col items-center justify-center relative active:scale-95 transition-transform`}>
                <span className="font-black uppercase text-[10px] mb-1">{p.name}</span>
                <span className="font-black italic">€{p.price.toFixed(2)}</span>
                <div className="absolute bottom-2 right-4 text-[8px] font-black opacity-30">ST: {p.stock}</div>
              </button>
            ))}
          </div>
        )}

        {/* REPORTS - NU GEVULD MET TRANSACTIES */}
        {activeTab === 'REPORTS' && (
          <div className="space-y-4">
             <div className="bg-slate-900 text-white p-6 rounded-[2.5rem] shadow-lg">
               <h3 className="text-[10px] font-black opacity-50 uppercase mb-4 tracking-widest">Huidige Omzet</h3>
               <div className="text-3xl font-black italic">€{currentSession?.summary.totalSales.toFixed(2) || "0.00"}</div>
               <div className="flex justify-between mt-4 text-[10px] font-bold">
                 <span>CASH: €{currentSession?.summary.cashTotal.toFixed(2)}</span>
                 <span>KAART: €{currentSession?.summary.cardTotal.toFixed(2)}</span>
               </div>
             </div>
             <div className="space-y-2">
               {transactions.map(t => (
                 <div key={t.id} className="bg-white p-4 rounded-3xl border flex justify-between items-center text-xs font-bold">
                   <span>{t.dateStr.split(' ')[1]} - {t.paymentMethod}</span>
                   <span className="text-amber-600">€{t.total.toFixed(2)}</span>
                 </div>
               ))}
             </div>
          </div>
        )}

        {/* MANAGE (HERSTELD PRODUCTBEHEER) */}
        {activeTab === 'MANAGE' && (
          <div className="space-y-3">
             <button onClick={() => setEditingProd({id: Date.now().toString(), name: '', price: 0, vatRate: 21, color: 'bg-slate-200', stock: 10, updatedAt: 0})} className="w-full bg-slate-900 text-white p-4 rounded-2xl font-black text-xs flex items-center justify-center gap-2">
               <Plus size={16}/> NIEUW PRODUCT
             </button>
             {products.map(p => (
               <div key={p.id} className="bg-white p-4 rounded-3xl border flex justify-between items-center">
                 <div className="font-black italic uppercase text-sm">{p.name} <span className="text-[10px] text-slate-300 not-italic ml-2">ST:{p.stock}</span></div>
                 <div className="flex gap-2">
                   <button onClick={() => setEditingProd(p)} className="p-2 bg-slate-100 rounded-xl text-slate-400"><Edit3 size={16}/></button>
                   <button onClick={() => setProducts(products.filter(x => x.id !== p.id))} className="p-2 bg-red-50 rounded-xl text-red-400"><Trash2 size={16}/></button>
                 </div>
               </div>
             ))}
          </div>
        )}
      </main>

      {/* KAART BETALING BEVESTIGING (GEEN RENDER POPUP) */}
      {showCardConfirm && (
        <div className="fixed inset-0 bg-indigo-600 z-[200] flex flex-col items-center justify-center p-8 text-white text-center">
          <div className="bg-white/20 p-6 rounded-full mb-6 animate-pulse"><CreditCard size={64}/></div>
          <h2 className="text-3xl font-black italic mb-2 uppercase">Kaartbetaling</h2>
          <p className="text-indigo-100 mb-10 font-bold uppercase text-xs tracking-widest">Wacht op de terminal...</p>
          <div className="space-y-4 w-full max-w-xs">
            <button onClick={() => processSale(PaymentMethod.CARD)} className="w-full bg-white text-indigo-600 p-6 rounded-[2.5rem] font-black text-xl shadow-2xl uppercase tracking-widest">BETALING GELUKT</button>
            <button onClick={() => setShowCardConfirm(false)} className="w-full text-indigo-200 font-black text-xs uppercase pt-4">ANNULEREN</button>
          </div>
        </div>
      )}

      {/* START SESSIE MODAL */}
      {showSessionStart && (
        <div className="fixed inset-0 bg-slate-900 z-[150] flex flex-col items-center justify-center p-8 text-white">
          <h2 className="text-3xl font-black italic mb-6">OPEN KASSA</h2>
          <input type="number" value={openingCash} onChange={e => setOpeningCash(e.target.value)} className="bg-transparent border-b-4 border-amber-500 text-5xl font-black text-center w-full mb-12 outline-none" autoFocus />
          <button onClick={() => {
            setCurrentSession({id: 'S'+Date.now(), startTime: Date.now(), startCash: parseFloat(openingCash), status: 'OPEN', cashManagement: {openingBalance: parseFloat(openingCash), closingBalance: 0, difference: 0}, summary: {totalSales: 0, transactionCount: 0, cashTotal: 0, cardTotal: 0, vat0Total: 0, vat21Total: 0}, updatedAt: Date.now()});
            setShowSessionStart(false);
            setActiveTab('SHOP');
          }} className="w-full bg-amber-500 p-6 rounded-[2.5rem] font-black text-xl uppercase italic">START VERKOOP</button>
        </div>
      )}

      {/* PRODUCT MODAL */}
      {editingProd && (
        <div className="fixed inset-0 bg-white z-[120] p-6">
          <div className="max-w-xs mx-auto space-y-6">
            <h2 className="text-2xl font-black italic uppercase">Product Info</h2>
            <input className="w-full bg-slate-100 p-4 rounded-2xl font-bold outline-none" placeholder="Naam" value={editingProd.name} onChange={e => setEditingProd({...editingProd, name: e.target.value})}/>
            <input type="number" className="w-full bg-slate-100 p-4 rounded-2xl font-bold outline-none" placeholder="Prijs" value={editingProd.price} onChange={e => setEditingProd({...editingProd, price: parseFloat(e.target.value)})}/>
            <input type="number" className="w-full bg-slate-100 p-4 rounded-2xl font-bold outline-none" placeholder="Stock" value={editingProd.stock} onChange={e => setEditingProd({...editingProd, stock: parseInt(e.target.value)})}/>
            <button onClick={() => {
              if (products.find(x => x.id === editingProd.id)) setProducts(products.map(p => p.id === editingProd.id ? editingProd : p));
              else setProducts([...products, editingProd]);
              setEditingProd(null);
            }} className="w-full bg-emerald-500 text-white p-5 rounded-3xl font-black uppercase italic">OPSLAAN</button>
            <button onClick={() => setEditingProd(null)} className="w-full text-slate-300 font-bold uppercase text-[10px] text-center">Annuleren</button>
          </div>
        </div>
      )}

      {/* NAVIGATIE */}
      <nav className="fixed bottom-0 left-0 right-0 bg-white/90 backdrop-blur-md border-t p-3 flex justify-around z-50">
        <button onClick={() => setActiveTab('DASHBOARD')} className={`p-4 rounded-2xl ${activeTab === 'DASHBOARD' ? 'bg-slate-900 text-white' : 'text-slate-300'}`}><Home size={22}/></button>
        <button onClick={() => setActiveTab('SHOP')} className={`p-4 rounded-2xl ${activeTab === 'SHOP' ? 'bg-slate-900 text-white' : 'text-slate-300'}`}><ShoppingCart size={22}/></button>
        <button onClick={() => setActiveTab('REPORTS')} className={`p-4 rounded-2xl ${activeTab === 'REPORTS' ? 'bg-slate-900 text-white' : 'text-slate-300'}`}><Receipt size={22}/></button>
        <button onClick={() => setActiveTab('MANAGE')} className={`p-4 rounded-2xl ${activeTab === 'MANAGE' ? 'bg-slate-900 text-white' : 'text-slate-300'}`}><Package size={22}/></button>
        <button onClick={() => setActiveTab('SETTINGS')} className={`p-4 rounded-2xl ${activeTab === 'SETTINGS' ? 'bg-slate-900 text-white' : 'text-slate-300'}`}><Settings size={22}/></button>
      </nav>

      {/* SHOPPING CART OVERLAY */}
      {cart.length > 0 && activeTab === 'SHOP' && (
        <div className="fixed bottom-24 left-4 right-4 bg-white p-6 rounded-[2.5rem] shadow-2xl border-2 border-slate-100 z-[60]">
           <div className="flex justify-between items-center mb-4 px-2 italic font-black text-sm">
             <span className="text-slate-300 uppercase text-[10px]">Totaal</span>
             <span className="text-amber-500 text-xl font-black">€{cart.reduce((s,i)=>s+(i.product.price*i.qty),0).toFixed(2)}</span>
           </div>
           <div className="flex gap-2">
            <button onClick={() => processSale(PaymentMethod.CASH)} className="flex-1 bg-slate-900 text-white p-5 rounded-2xl font-black italic uppercase text-xs">CASH</button>
            <button onClick={() => setShowCardConfirm(true)} className="flex-1 bg-indigo-600 text-white p-5 rounded-2xl font-black italic uppercase text-xs">KAART</button>
            <button onClick={() => setCart([])} className="p-5 bg-slate-50 rounded-2xl text-slate-300"><X size={18}/></button>
          </div>
        </div>
      )}
    </div>
  );
}
