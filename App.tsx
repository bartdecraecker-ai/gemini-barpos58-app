import React, { useState, useEffect } from 'react';
import { 
  ShoppingCart, Receipt, Settings, Package, Trash2, Printer, 
  CheckCircle2, Bluetooth, Wallet, Landmark, RefreshCcw, 
  Store, UserCircle2, X, Plus, Save
} from 'lucide-react';
import { btPrinterService } from './services/bluetoothPrinter';
import { Transaction, Product, CompanyDetails, SalesSession, Seller, PaymentMethod } from './types';

export default function App() {
  // --- STATES ---
  const [activeTab, setActiveTab] = useState<'SHOP' | 'REPORTS' | 'MANAGE' | 'SETTINGS'>('SHOP');
  const [viewMode, setViewMode] = useState<'GRID' | 'TOUR'>('GRID');
  
  // Producten met Stock
  const [products, setProducts] = useState<Product[]>([
    { id: '1', name: 'Bier', price: 2.50, vatRate: 21, color: 'bg-amber-100', stock: 50, updatedAt: Date.now() },
    { id: '2', name: 'Frisdrank', price: 2.20, vatRate: 21, color: 'bg-blue-100', stock: 40, updatedAt: Date.now() }
  ]);

  // Nieuw product formulier state
  const [newProd, setNewProd] = useState({ name: '', price: '', vat: 21 as (0|21), stock: '' });

  const [company, setCompany] = useState<CompanyDetails>({
    name: "GEMINI BAR",
    address: "Kerkstraat 1",
    vatNumber: "BE 0123.456.789",
    footerMessage: "Bedankt en tot ziens!",
    managerPin: "1234",
    updatedAt: Date.now()
  });

  const [cart, setCart] = useState<{product: Product, qty: number}[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [btConnected, setBtConnected] = useState(false);
  const [previewTx, setPreviewTx] = useState<Transaction | null>(null);

  const [currentSession, setCurrentSession] = useState<SalesSession>({
    id: 'SESS-' + Date.now(),
    startTime: Date.now(),
    startCash: 50,
    status: 'OPEN',
    cashManagement: { openingBalance: 50, closingBalance: 0, difference: 0 },
    summary: { totalSales: 0, transactionCount: 0, cashTotal: 0, cardTotal: 0, vat0Total: 0, vat21Total: 0 },
    updatedAt: Date.now()
  });
  const [closedSessions, setClosedSessions] = useState<SalesSession[]>([]);

  useEffect(() => {
    const check = setInterval(() => setBtConnected(btPrinterService.isConnected()), 2000);
    return () => clearInterval(check);
  }, []);

  // --- ACTIES ---
  const addToCart = (p: Product) => {
    if (p.stock !== undefined && p.stock <= 0) {
      alert("Product uit verkocht!");
      return;
    }
    setCart(prev => {
      const exists = prev.find(item => item.product.id === p.id);
      if (exists) return prev.map(item => item.product.id === p.id ? { ...item, qty: item.qty + 1 } : item);
      return [...prev, { product: p, qty: 1 }];
    });
  };

  const handleCheckout = async (method: PaymentMethod) => {
    if (cart.length === 0) return;
    const total = cart.reduce((sum, item) => sum + (item.product.price * item.qty), 0);
    const v21 = cart.reduce((sum, item) => item.product.vatRate === 21 ? sum + (item.product.price * item.qty * 0.21 / 1.21) : sum, 0);

    // Update Stock
    setProducts(prev => prev.map(p => {
      const cartItem = cart.find(c => c.product.id === p.id);
      return cartItem ? { ...p, stock: (p.stock || 0) - cartItem.qty } : p;
    }));

    const newTx: Transaction = {
      id: 'TX-' + Date.now(),
      sessionId: currentSession.id,
      timestamp: Date.now(),
      dateStr: new Date().toLocaleString('nl-NL'),
      items: cart.map(item => ({ ...item, quantity: item.qty })),
      subtotal: total - v21,
      vat0: 0,
      vat21: v21,
      total: total,
      paymentMethod: method,
      updatedAt: Date.now()
    };

    setCurrentSession(prev => ({
      ...prev,
      summary: { ...prev.summary, totalSales: prev.summary.totalSales + total, cashTotal: method === PaymentMethod.CASH ? prev.summary.cashTotal + total : prev.summary.cashTotal, cardTotal: method === PaymentMethod.CARD ? prev.summary.cardTotal + total : prev.summary.cardTotal, vat21Total: prev.summary.vat21Total + v21 }
    }));

    setTransactions(prev => [newTx, ...prev]);
    setPreviewTx(newTx);
    setCart([]);
  };

  const addProduct = () => {
    if (products.length >= 10) return alert("Maximum 10 producten bereikt.");
    if (!newProd.name || !newProd.price) return alert("Vul naam en prijs in.");
    
    const colors = ['bg-amber-100', 'bg-blue-100', 'bg-emerald-100', 'bg-rose-100', 'bg-purple-100', 'bg-orange-100'];
    const p: Product = {
      id: Date.now().toString(),
      name: newProd.name,
      price: parseFloat(newProd.price),
      vatRate: newProd.vat,
      stock: parseInt(newProd.stock) || 0,
      color: colors[products.length % colors.length],
      updatedAt: Date.now()
    };
    setProducts([...products, p]);
    setNewProd({ name: '', price: '', vat: 21, stock: '' });
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 pb-24 font-sans">
      
      {/* HEADER */}
      <header className="bg-white border-b p-4 flex justify-between items-center sticky top-0 z-50">
        <div onClick={() => setViewMode(viewMode === 'GRID' ? 'TOUR' : 'GRID')} className="cursor-pointer">
          <h1 className="font-black text-xl italic leading-none">GEMINI BAR</h1>
          <p className="text-[10px] font-bold text-amber-500 uppercase tracking-widest">{viewMode} MODE</p>
        </div>
        <button onClick={() => btPrinterService.connect()} className={`p-2 rounded-xl ${btConnected ? 'bg-emerald-100 text-emerald-600' : 'bg-red-100 text-red-600'}`}>
          <Bluetooth size={20}/>
        </button>
      </header>

      <main className="max-w-md mx-auto p-4">

        {/* --- SHOP --- */}
        {activeTab === 'SHOP' && (
          <div className="space-y-4">
            <div className={viewMode === 'GRID' ? "grid grid-cols-3 gap-2" : "grid grid-cols-1 gap-3"}>
              {products.map(p => (
                <button key={p.id} onClick={() => addToCart(p)} className={`${p.color} ${viewMode === 'TOUR' ? 'h-24 px-6' : 'h-20 px-3'} rounded-3xl border-2 border-white shadow-sm active:scale-95 flex flex-col justify-center text-left relative overflow-hidden`}>
                  <span className="font-black text-[11px] uppercase truncate w-full">{p.name}</span>
                  <span className="font-bold text-sm">€{p.price.toFixed(2)}</span>
                  <span className="absolute bottom-1 right-3 text-[8px] font-bold opacity-50">ST: {p.stock}</span>
                </button>
              ))}
            </div>

            {cart.length > 0 && (
              <div className="bg-white rounded-[2.5rem] p-6 shadow-2xl border border-slate-200 fixed bottom-24 left-4 right-4 z-40 max-w-md mx-auto">
                <div className="max-h-32 overflow-y-auto mb-4 space-y-1">
                  {cart.map(item => (
                    <div key={item.product.id} className="flex justify-between font-bold text-xs">
                      <span>{item.qty}x {item.product.name}</span>
                      <span>€{(item.product.price * item.qty).toFixed(2)}</span>
                    </div>
                  ))}
                </div>
                <div className="flex gap-2">
                  <button onClick={() => handleCheckout(PaymentMethod.CASH)} className="flex-1 bg-slate-900 text-white p-4 rounded-2xl font-black text-xs">CASH €{cartTotal.toFixed(2)}</button>
                  <button onClick={() => handleCheckout(PaymentMethod.CARD)} className="flex-1 bg-indigo-600 text-white p-4 rounded-2xl font-black text-xs">KAART</button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* --- MANAGE (PRODUCTEN TOEVOEGEN) --- */}
        {activeTab === 'MANAGE' && (
          <div className="space-y-6">
            <div className="bg-white p-6 rounded-[2rem] border border-slate-200 shadow-sm">
              <h3 className="font-black text-xs uppercase text-slate-400 mb-4 flex items-center gap-2"><Plus size={14}/> Nieuw Product ({products.length}/10)</h3>
              <div className="space-y-3">
                <input className="w-full border-b p-2 text-sm outline-none" placeholder="Naam (bijv. Cola)" value={newProd.name} onChange={e=>setNewProd({...newProd, name: e.target.value})}/>
                <div className="flex gap-2">
                  <input className="flex-1 border-b p-2 text-sm outline-none" type="number" placeholder="Prijs" value={newProd.price} onChange={e=>setNewProd({...newProd, price: e.target.value})}/>
                  <input className="w-20 border-b p-2 text-sm outline-none" type="number" placeholder="Stock" value={newProd.stock} onChange={e=>setNewProd({...newProd, stock: e.target.value})}/>
                </div>
                <div className="flex gap-2">
                  <button onClick={()=>setNewProd({...newProd, vat: 21})} className={`flex-1 p-2 rounded-xl text-[10px] font-black ${newProd.vat === 21 ? 'bg-slate-900 text-white' : 'bg-slate-100'}`}>BTW 21%</button>
                  <button onClick={()=>setNewProd({...newProd, vat: 0})} className={`flex-1 p-2 rounded-xl text-[10px] font-black ${newProd.vat === 0 ? 'bg-slate-900 text-white' : 'bg-slate-100'}`}>BTW 0%</button>
                </div>
                <button onClick={addProduct} className="w-full bg-emerald-500 text-white p-4 rounded-2xl font-black text-xs flex items-center justify-center gap-2 mt-2 shadow-lg shadow-emerald-100">
                  <Save size={16}/> PRODUCT OPSLAAN
                </button>
              </div>
            </div>

            <div className="bg-white p-6 rounded-[2rem] border border-slate-200 shadow-sm">
              <h3 className="font-black text-xs uppercase text-slate-400 mb-4">Huidige Voorraad</h3>
              <div className="space-y-3">
                {products.map(p => (
                  <div key={p.id} className="flex justify-between items-center text-sm font-bold border-b pb-2">
                    <span>{p.name}</span>
                    <div className="flex items-center gap-4">
                      <span className="text-[10px] text-slate-400">{p.vatRate}% BTW</span>
                      <span className={`px-2 py-1 rounded-lg ${p.stock && p.stock < 10 ? 'bg-red-100 text-red-500' : 'bg-slate-100'}`}>S: {p.stock}</span>
                      <button onClick={()=>setProducts(products.filter(i=>i.id !== p.id))} className="text-red-300"><Trash2 size={14}/></button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* --- OVERIGE TABS --- */}
        {activeTab === 'REPORTS' && (
           <div className="space-y-3">
             <h2 className="font-black text-xs text-slate-400 uppercase italic px-2">Rapporten</h2>
             {closedSessions.map(s => (
               <div key={s.id} className="bg-white p-4 rounded-3xl border border-slate-200 flex justify-between items-center shadow-sm">
                 <div><p className="font-black text-sm">{new Date(s.startTime).toLocaleDateString()}</p><p className="text-[10px] font-bold text-slate-400">TOTAAL: €{s.summary.totalSales.toFixed(2)}</p></div>
                 <button onClick={() => btPrinterService.printReceipt(null, company, s, transactions)} className="p-3 bg-slate-900 text-white rounded-2xl"><Printer size={18}/></button>
               </div>
             ))}
           </div>
        )}

        {activeTab === 'SETTINGS' && (
          <div className="space-y-4">
            <div className="bg-white p-6 rounded-[2.5rem] border border-slate-200 shadow-sm space-y-4">
              <input className="w-full border-b p-2 font-bold outline-none" value={company.name} onChange={e=>setCompany({...company, name:e.target.value})} placeholder="Naam"/>
              <input className="w-full border-b p-2 outline-none text-sm" value={company.managerPin} onChange={e=>setCompany({...company, managerPin:e.target.value})} placeholder="Manager PIN"/>
            </div>
            <button onClick={() => {if(prompt("PIN?")===company.managerPin) { 
              const k = parseFloat(prompt("Cash in lade?") || "0");
              const v = currentSession.cashManagement.openingBalance + currentSession.summary.cashTotal;
              setClosedSessions([{...currentSession, status:'CLOSED', endTime:Date.now(), cashManagement:{...currentSession.cashManagement, closingBalance:k, difference:k-v}}, ...closedSessions]);
              alert("Sessie gesloten"); setActiveTab('REPORTS');
            }}} className="w-full bg-red-50 text-red-500 p-5 rounded-[2.5rem] font-black text-xs uppercase flex items-center justify-center gap-2">
              <RefreshCcw size={16}/> DAGAFSLUITING
            </button>
          </div>
        )}

      </main>

      {/* NAVIGATIE */}
      <nav className="fixed bottom-0 left-0 right-0 bg-white border-t p-3 flex justify-around items-center z-50">
        <button onClick={() => setActiveTab('SHOP')} className={`p-3 rounded-2xl ${activeTab === 'SHOP' ? 'bg-slate-900 text-white' : 'text-slate-400'}`}><ShoppingCart size={24}/></button>
        <button onClick={() => setActiveTab('REPORTS')} className={`p-3 rounded-2xl ${activeTab === 'REPORTS' ? 'bg-slate-900 text-white' : 'text-slate-400'}`}><Receipt size={24}/></button>
        <button onClick={() => setActiveTab('MANAGE')} className={`p-3 rounded-2xl ${activeTab === 'MANAGE' ? 'bg-slate-900 text-white' : 'text-slate-400'}`}><Package size={24}/></button>
        <button onClick={() => setActiveTab('SETTINGS')} className={`p-3 rounded-2xl ${activeTab === 'SETTINGS' ? 'bg-slate-900 text-white' : 'text-slate-400'}`}><Settings size={24}/></button>
      </nav>

      {/* POPUP */}
      {previewTx && (
        <div className="fixed inset-0 bg-slate-900/60 z-[100] flex items-end justify-center p-4">
          <div className="bg-white w-full max-w-sm rounded-[3rem] p-8 shadow-2xl animate-in slide-in-from-bottom-10">
            <h2 className="text-center font-black text-xl mb-6 italic">BETAALD €{previewTx.total.toFixed(2)}</h2>
            <button onClick={async () => { await btPrinterService.printReceipt(previewTx, company, null, transactions); setPreviewTx(null); }} className="w-full bg-slate-900 text-white p-5 rounded-[2rem] font-black flex items-center justify-center gap-3 mb-3"><Printer size={20}/> PRINT BON</button>
            <button onClick={() => setPreviewTx(null)} className="w-full text-slate-400 font-black text-[10px] uppercase">Sluiten</button>
          </div>
        </div>
      )}
    </div>
  );
}
