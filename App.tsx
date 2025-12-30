import React, { useState, useEffect } from 'react';
import { 
  ShoppingCart, Receipt, Settings, Package, Trash2, Printer, 
  Bluetooth, X, Plus, Save, Lock, Edit3, LogOut, Wallet, CheckCircle2, AlertCircle, Home
} from 'lucide-react';
// We importeren de types, maar simuleren de printer service hieronder
import { Transaction, Product, CompanyDetails, SalesSession, PaymentMethod } from './types';

export default function App() {
  // --- STATES ---
  const [isUnlocked, setIsUnlocked] = useState(false);
  const [pinInput, setPinInput] = useState("");
  const [activeTab, setActiveTab] = useState<'DASHBOARD' | 'SHOP' | 'REPORTS' | 'MANAGE' | 'SETTINGS'>('DASHBOARD');
  const [viewMode, setViewMode] = useState<'GRID' | 'TOUR'>('GRID');
  
  // --- DATA (Hersteld) ---
  const [products, setProducts] = useState<Product[]>([
    { id: '1', name: 'Kraukerbier', price: 2.50, vatRate: 21, color: 'bg-amber-100', stock: 50, updatedAt: Date.now() }
  ]);
  const [company, setCompany] = useState<CompanyDetails>({
    name: "KRAUKERBIER", address: "Kerkstraat 1", address2: "9000 Gent",
    vatNumber: "BE 0123.456.789", website: "www.kraukerbier.be", footerMessage: "Bedankt en tot ziens!",
    managerPin: "1984", updatedAt: Date.now()
  });

  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [currentSession, setCurrentSession] = useState<SalesSession | null>(null);
  const [showSessionStart, setShowSessionStart] = useState(false);
  const [openingCash, setOpeningCash] = useState("50");
  const [cart, setCart] = useState<{product: Product, qty: number}[]>([]);
  const [editingProd, setEditingProd] = useState<Product | null>(null);
  
  // --- SIMULATIE STATES ---
  const [virtualReceipt, setVirtualReceipt] = useState<string | null>(null);

  // --- AFREKEN LOGICA (Bevroren & Stabiel) ---
  const handleCheckout = (method: PaymentMethod) => {
    if (!currentSession) return;
    if (method === PaymentMethod.CARD && !window.confirm("Is de kaartbetaling gelukt?")) return;

    const total = cart.reduce((sum, item) => sum + (item.product.price * item.qty), 0);
    const vat21 = cart.reduce((sum, item) => item.product.vatRate === 21 ? sum + (item.product.price * item.qty * 0.21 / 1.21) : sum, 0);

    const newTx: Transaction = {
      id: 'TX-' + Date.now(),
      sessionId: currentSession.id,
      timestamp: Date.now(),
      dateStr: new Date().toLocaleString('nl-BE'),
      items: cart.map(i => ({ ...i.product, quantity: i.qty })),
      subtotal: total - vat21,
      vat0: 0,
      vat21: vat21,
      total: total,
      paymentMethod: method,
      updatedAt: Date.now()
    };

    // Stock & Sessie updates
    setProducts(prev => prev.map(p => {
      const item = cart.find(c => c.product.id === p.id);
      return item ? { ...p, stock: Math.max(0, (p.stock || 0) - item.qty) } : p;
    }));

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

    setTransactions(prev => [newTx, ...prev]);
    
    // --- SIMULATIE: Genereer virtuele bon ---
    const receiptText = `
      ${company.name}
      ${company.address}
      ${company.address2}
      ${company.vatNumber}
      ${company.website}
      --------------------------------
      TICKET: ${newTx.id.slice(-6)}
      DATUM: ${newTx.dateStr}
      --------------------------------
      ${newTx.items.map(i => `${i.quantity}x ${i.name.padEnd(15)} €${(i.price * i.quantity).toFixed(2)}`).join('\n')}
      --------------------------------
      TOTAAL: €${newTx.total.toFixed(2)}
      BETAALD VIA: ${method}
      --------------------------------
      ${company.footerMessage}
    `;
    setVirtualReceipt(receiptText);
    setCart([]);
  };

  // --- UI COMPONENTS ---
  if (!isUnlocked) {
    return (
      <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center p-6 text-white font-sans">
        <h1 className="text-3xl font-black mb-8 italic text-amber-500 tracking-tighter">KRAUKERBIER</h1>
        <div className="grid grid-cols-3 gap-4 w-full max-w-xs">
          {[1,2,3,4,5,6,7,8,9].map(n => (
            <button key={n} onClick={() => { setPinInput(p => p + n); if(pinInput + n === company.managerPin) setIsUnlocked(true); }} className="h-20 bg-slate-800 rounded-3xl text-2xl font-black border border-slate-700 active:bg-amber-500">{n}</button>
          ))}
          <button onClick={() => setPinInput("")} className="text-xs font-bold text-slate-500">CLEAR</button>
          <button onClick={() => { setPinInput(p => p + "0"); if(pinInput + "0" === company.managerPin) setIsUnlocked(true); }} className="h-20 bg-slate-800 rounded-3xl text-2xl font-black border border-slate-700">0</button>
        </div>
        <div className="mt-8 flex gap-2">
          {[1,2,3,4].map(i => <div key={i} className={`w-3 h-3 rounded-full ${pinInput.length >= i ? 'bg-amber-500' : 'bg-slate-700'}`} />)}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 pb-24 font-sans select-none">
      {/* HEADER */}
      <header className="bg-white border-b p-4 flex justify-between items-center sticky top-0 z-50">
        <div className="font-black italic text-xl tracking-tighter">KRAUKERBIER</div>
        <div className="flex items-center gap-3">
            <span className="text-[10px] font-black bg-slate-100 px-2 py-1 rounded text-slate-500">{viewMode}</span>
            <button onClick={() => setIsUnlocked(false)} className="text-slate-300"><LogOut size={20}/></button>
        </div>
      </header>

      <main className="p-4 max-w-md mx-auto">
        {activeTab === 'DASHBOARD' && (
          <div className="space-y-4 pt-6 text-center">
            <button onClick={() => currentSession ? setActiveTab('SHOP') : setShowSessionStart(true)} className="w-full bg-amber-500 text-white p-12 rounded-[3rem] font-black text-2xl shadow-xl shadow-amber-200 flex items-center justify-between italic active:scale-95 transition-transform">
              {currentSession ? 'KASSA' : 'START SESSIE'}
              <ShoppingCart size={32} />
            </button>
            <div className="grid grid-cols-2 gap-4">
              <button onClick={() => setActiveTab('REPORTS')} className="bg-white p-8 rounded-[2.5rem] border font-black text-slate-400">RAPPORTEN</button>
              <button onClick={() => setActiveTab('MANAGE')} className="bg-white p-8 rounded-[2.5rem] border font-black text-slate-400">BEHEER</button>
            </div>
          </div>
        )}

        {/* PRODUCT BEHEER (BTW & STOCK) */}
        {activeTab === 'MANAGE' && (
          <div className="space-y-4">
            <div className="flex justify-between items-center">
                <h2 className="font-black uppercase text-xs text-slate-400 italic">Voorraadbeheer</h2>
                <button onClick={() => setEditingProd({id: Date.now().toString(), name: '', price: 0, vatRate: 21, color: 'bg-amber-50', stock: 0, updatedAt: 0})} className="bg-slate-900 text-white p-2 rounded-full"><Plus/></button>
            </div>
            {products.map(p => (
              <div key={p.id} className="bg-white p-4 rounded-3xl border flex justify-between items-center">
                <div>
                    <div className="font-black uppercase text-sm italic">{p.name}</div>
                    <div className="text-[10px] font-bold text-slate-400">€{p.price.toFixed(2)} • {p.vatRate}% BTW • ST:{p.stock}</div>
                </div>
                <button onClick={() => setEditingProd(p)} className="p-2 bg-slate-50 rounded-xl text-slate-400"><Edit3 size={16}/></button>
              </div>
            ))}
          </div>
        )}

        {/* SHOP TAB */}
        {activeTab === 'SHOP' && currentSession && (
          <div className={viewMode === 'GRID' ? "grid grid-cols-3 gap-2" : "grid grid-cols-1 gap-3"}>
            {products.map(p => (
              <button key={p.id} onClick={() => setCart([...cart, {product: p, qty: 1}])} className={`${p.color} ${viewMode === 'TOUR' ? 'h-32 text-xl' : 'h-24 text-[10px]'} rounded-[2rem] border-2 border-white shadow-sm flex flex-col items-center justify-center relative font-black uppercase italic active:scale-95`}>
                {p.name}
                <div className="text-xs opacity-50 not-italic">€{p.price.toFixed(2)}</div>
                <div className="absolute bottom-2 right-4 text-[8px] opacity-30">ST: {p.stock}</div>
              </button>
            ))}
          </div>
        )}
      </main>

      {/* NAVIGATIE */}
      <nav className="fixed bottom-0 left-0 right-0 bg-white border-t p-4 flex justify-around z-50">
        <button onClick={() => setActiveTab('DASHBOARD')} className={activeTab === 'DASHBOARD' ? 'text-amber-500' : 'text-slate-300'}><Home/></button>
        <button onClick={() => setActiveTab('SHOP')} className={activeTab === 'SHOP' ? 'text-amber-500' : 'text-slate-300'}><ShoppingCart/></button>
        <button onClick={() => setActiveTab('REPORTS')} className={activeTab === 'REPORTS' ? 'text-amber-500' : 'text-slate-300'}><Receipt/></button>
        <button onClick={() => setActiveTab('MANAGE')} className={activeTab === 'MANAGE' ? 'text-amber-500' : 'text-slate-300'}><Package/></button>
        <button onClick={() => setActiveTab('SETTINGS')} className={activeTab === 'SETTINGS' ? 'text-amber-500' : 'text-slate-300'}><Settings/></button>
      </nav>

      {/* VIRTUEEL TICKET (TEST VENSTER) */}
      {virtualReceipt && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[100] flex items-center justify-center p-6">
          <div className="bg-white w-full max-w-xs p-8 rounded-xl font-mono text-[10px] shadow-2xl relative">
            <button onClick={() => setVirtualReceipt(null)} className="absolute -top-12 right-0 text-white font-black">SLUITEN X</button>
            <pre className="whitespace-pre-wrap leading-tight">{virtualReceipt}</pre>
            <div className="mt-6 p-4 bg-emerald-50 text-emerald-700 rounded-lg text-center font-bold font-sans uppercase">
                Simulatie geslaagd!
            </div>
          </div>
        </div>
      )}

      {/* MODALS VOOR SESSIE & PRODUCT (Hetzelfde als voorheen) */}
      {showSessionStart && (
        <div className="fixed inset-0 bg-slate-900 z-[150] flex flex-col items-center justify-center p-8 text-white">
          <h2 className="text-3xl font-black italic mb-6">OPEN KASSA</h2>
          <input type="number" value={openingCash} onChange={e => setOpeningCash(e.target.value)} className="bg-transparent border-b-4 border-amber-500 text-5xl font-black text-center w-full mb-12 outline-none" autoFocus />
          <button onClick={() => {
            setCurrentSession({id: 'S'+Date.now(), startTime: Date.now(), startCash: parseFloat(openingCash), status: 'OPEN', cashManagement: {openingBalance: parseFloat(openingCash), closingBalance: 0, difference: 0}, summary: {totalSales: 0, transactionCount: 0, cashTotal: 0, cardTotal: 0, vat0Total: 0, vat21Total: 0}, updatedAt: Date.now()});
            setShowSessionStart(false);
            setActiveTab('SHOP');
          }} className="w-full bg-amber-500 p-6 rounded-[2.5rem] font-black text-xl">START VERKOOP</button>
        </div>
      )}

      {/* CART OVERLAY */}
      {cart.length > 0 && activeTab === 'SHOP' && (
        <div className="fixed bottom-24 left-4 right-4 bg-white p-6 rounded-[2.5rem] shadow-2xl border-2 border-slate-100 z-[60]">
           <div className="flex justify-between items-center mb-4 px-2 italic font-black text-sm">
             <span className="text-slate-300 uppercase text-[10px]">Totaal</span>
             <span className="text-amber-500 text-xl font-black">€{cart.reduce((s,i)=>s+(i.product.price*i.qty),0).toFixed(2)}</span>
           </div>
           <div className="flex gap-2">
            <button onClick={() => handleCheckout(PaymentMethod.CASH)} className="flex-1 bg-slate-900 text-white p-5 rounded-2xl font-black italic uppercase text-xs">CASH</button>
            <button onClick={() => handleCheckout(PaymentMethod.CARD)} className="flex-1 bg-indigo-600 text-white p-5 rounded-2xl font-black italic uppercase text-xs">KAART</button>
            <button onClick={() => setCart([])} className="p-5 bg-slate-100 rounded-2xl text-slate-300"><X size={18}/></button>
          </div>
        </div>
      )}
    </div>
  );
}
