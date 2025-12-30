import React, { useState, useEffect } from 'react';
import { 
  ShoppingCart, Receipt, Settings, Package, Trash2, Printer, 
  CheckCircle2, Bluetooth, Wallet, Landmark, RefreshCcw, 
  Store, UserCircle2, X, Plus, Save, Lock, Eye, Edit3
} from 'lucide-react';
import { btPrinterService } from './services/bluetoothPrinter';
import { Transaction, Product, CompanyDetails, SalesSession, PaymentMethod } from './types';

export default function App() {
  // --- 1. AUTHENTICATIE & NAVIGATIE ---
  const [isUnlocked, setIsUnlocked] = useState(false);
  const [pinInput, setPinInput] = useState("");
  const [activeTab, setActiveTab] = useState<'SHOP' | 'REPORTS' | 'MANAGE' | 'SETTINGS'>('SHOP');
  const [viewMode, setViewMode] = useState<'GRID' | 'TOUR'>('GRID');
  
  // --- 2. DATA STATES ---
  const [products, setProducts] = useState<Product[]>([
    { id: '1', name: 'Bier', price: 2.50, vatRate: 21, color: 'bg-amber-100', stock: 50, updatedAt: Date.now() },
    { id: '2', name: 'Fris', price: 2.20, vatRate: 21, color: 'bg-blue-100', stock: 40, updatedAt: Date.now() }
  ]);

  const [company, setCompany] = useState<CompanyDetails>({
    name: "GEMINI BAR",
    address: "Kerkstraat 1",
    address2: "9000 Gent",
    vatNumber: "BE 0123.456.789",
    website: "www.geminibar.be",
    footerMessage: "Bedankt en tot ziens!",
    managerPin: "1984",
    updatedAt: Date.now()
  });

  // --- 3. KASSA & SESSIE ---
  const [cart, setCart] = useState<{product: Product, qty: number}[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [currentSession, setCurrentSession] = useState<SalesSession>({
    id: 'SESS-' + Date.now(), startTime: Date.now(), startCash: 50, status: 'OPEN',
    cashManagement: { openingBalance: 50, closingBalance: 0, difference: 0 },
    summary: { totalSales: 0, transactionCount: 0, cashTotal: 0, cardTotal: 0, vat0Total: 0, vat21Total: 0 },
    updatedAt: Date.now()
  });
  const [closedSessions, setClosedSessions] = useState<SalesSession[]>([]);
  const [btConnected, setBtConnected] = useState(false);
  const [previewTx, setPreviewTx] = useState<Transaction | null>(null);

  // Form states voor beheer
  const [editingProd, setEditingProd] = useState<Product | null>(null);

  useEffect(() => {
    const check = setInterval(() => setBtConnected(btPrinterService.isConnected()), 2000);
    return () => clearInterval(check);
  }, []);

  // --- 4. FUNCTIES ---
  const handleLogin = () => {
    if (pinInput === company.managerPin) setIsUnlocked(true);
    else { alert("Foute PIN!"); setPinInput(""); }
  };

  const updateProduct = (updated: Product) => {
    setProducts(products.map(p => p.id === updated.id ? updated : p));
    setEditingProd(null);
  };

  const handleCheckout = async (method: PaymentMethod) => {
    if (cart.length === 0) return;
    const total = cart.reduce((sum, item) => sum + (item.product.price * item.qty), 0);
    const v21 = cart.reduce((sum, item) => item.product.vatRate === 21 ? sum + (item.product.price * item.qty * 0.21 / 1.21) : sum, 0);

    // Stock afboeken
    setProducts(prev => prev.map(p => {
      const item = cart.find(c => c.product.id === p.id);
      return item ? { ...p, stock: (p.stock || 0) - item.qty } : p;
    }));

    const newTx: Transaction = {
      id: 'TX-' + Date.now(), sessionId: currentSession.id, timestamp: Date.now(),
      dateStr: new Date().toLocaleString('nl-NL'), items: cart.map(i => ({ ...i.product, quantity: i.qty })),
      subtotal: total - v21, vat0: 0, vat21: v21, total: total, paymentMethod: method, updatedAt: Date.now()
    };

    setCurrentSession(prev => ({
      ...prev,
      summary: { ...prev.summary, totalSales: prev.summary.totalSales + total, transactionCount: prev.summary.transactionCount + 1, cashTotal: method === PaymentMethod.CASH ? prev.summary.cashTotal + total : prev.summary.cashTotal, cardTotal: method === PaymentMethod.CARD ? prev.summary.cardTotal + total : prev.summary.cardTotal, vat21Total: prev.summary.vat21Total + v21 }
    }));

    setTransactions([newTx, ...transactions]);
    setPreviewTx(newTx);
    setCart([]);
  };

  // --- LOCK SCREEN ---
  if (!isUnlocked) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center p-6">
        <div className="bg-white rounded-[3rem] p-10 w-full max-w-xs shadow-2xl text-center">
          <div className="bg-amber-100 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-6 text-amber-600"><Lock size={32}/></div>
          <h2 className="font-black text-xl mb-6">Voer PIN in</h2>
          <input type="password" value={pinInput} onChange={e => setPinInput(e.target.value)} className="w-full text-center text-3xl tracking-[1rem] border-b-2 border-slate-200 pb-2 mb-8 outline-none focus:border-amber-500" maxLength={4} autoFocus />
          <button onClick={handleLogin} className="w-full bg-slate-900 text-white p-5 rounded-2xl font-black uppercase tracking-widest active:scale-95 transition-all">Open Kassa</button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 pb-24">
      
      {/* HEADER */}
      <header className="bg-white border-b p-4 flex justify-between items-center sticky top-0 z-50">
        <div onClick={() => setViewMode(viewMode === 'GRID' ? 'TOUR' : 'GRID')} className="cursor-pointer">
          <h1 className="font-black text-xl italic leading-none">GEMINI BAR</h1>
          <p className="text-[10px] font-bold text-amber-500 uppercase tracking-widest">{viewMode} MODE (Tik om te wisselen)</p>
        </div>
        <button onClick={() => btPrinterService.connect()} className={`p-2 rounded-xl ${btConnected ? 'bg-emerald-100 text-emerald-600' : 'bg-red-100 text-red-600'}`}><Bluetooth size={20}/></button>
      </header>

      <main className="max-w-md mx-auto p-4">

        {/* SHOP TAB */}
        {activeTab === 'SHOP' && (
          <div className="space-y-4">
            <div className={viewMode === 'GRID' ? "grid grid-cols-3 gap-2" : "grid grid-cols-1 gap-3"}>
              {products.map(p => (
                <button key={p.id} onClick={() => { if(p.stock! > 0) setCart([...cart, {product: p, qty: 1}]) }} className={`${p.color} ${viewMode === 'TOUR' ? 'h-28 px-6 text-lg' : 'h-20 px-3 text-xs'} rounded-3xl border-2 border-white shadow-sm active:scale-95 flex flex-col justify-center text-left relative`}>
                  <span className="font-black uppercase truncate w-full">{p.name}</span>
                  <span className="font-bold">€{p.price.toFixed(2)}</span>
                  <span className={`absolute top-2 right-3 text-[9px] font-bold ${p.stock! < 5 ? 'text-red-600 animate-pulse' : 'text-slate-500'}`}>ST: {p.stock}</span>
                </button>
              ))}
            </div>
            {cart.length > 0 && (
              <div className="bg-white rounded-[2.5rem] p-6 shadow-2xl border border-slate-200 fixed bottom-24 left-4 right-4 z-40 max-w-md mx-auto">
                <div className="flex justify-between items-center mb-4"><h3 className="font-black text-xs uppercase text-slate-400">Mand</h3><button onClick={() => setCart([])}><X size={18}/></button></div>
                <div className="max-h-32 overflow-y-auto mb-4 space-y-2">
                  {cart.map((item, i) => (
                    <div key={i} className="flex justify-between font-bold text-sm"><span>{item.qty}x {item.product.name}</span><span>€{(item.product.price * item.qty).toFixed(2)}</span></div>
                  ))}
                </div>
                <div className="flex gap-2"><button onClick={() => handleCheckout(PaymentMethod.CASH)} className="flex-1 bg-slate-900 text-white p-4 rounded-2xl font-black text-xs">CASH €{cart.reduce((s,i)=>s+(i.product.price*i.qty),0).toFixed(2)}</button><button onClick={() => handleCheckout(PaymentMethod.CARD)} className="flex-1 bg-indigo-600 text-white p-4 rounded-2xl font-black text-xs">KAART</button></div>
              </div>
            )}
          </div>
        )}

        {/* REPORTS TAB - MET DETAILS */}
        {activeTab === 'REPORTS' && (
          <div className="space-y-4">
            <h2 className="font-black text-xs text-slate-400 uppercase italic">Rapportage Details</h2>
            <div className="bg-white p-6 rounded-[2rem] border border-slate-200 shadow-sm space-y-3">
              <div className="flex justify-between text-sm"><span>Totaal Omzet</span><span className="font-black text-emerald-600">€{currentSession.summary.totalSales.toFixed(2)}</span></div>
              <div className="flex justify-between text-xs text-slate-500"><span>Cash Ontvangen</span><span>€{currentSession.summary.cashTotal.toFixed(2)}</span></div>
              <div className="flex justify-between text-xs text-slate-500"><span>Kaart Ontvangen</span><span>€{currentSession.summary.cardTotal.toFixed(2)}</span></div>
              <div className="flex justify-between text-xs text-slate-500 border-t pt-2"><span>Aantal Tickets</span><span>{currentSession.summary.transactionCount}</span></div>
            </div>
            <h2 className="font-black text-[10px] text-slate-400 uppercase mt-6">Historie</h2>
            {closedSessions.map(s => (
              <div key={s.id} className="bg-white p-4 rounded-3xl border flex justify-between items-center">
                <div className="text-xs font-bold">{new Date(s.startTime).toLocaleDateString()} - €{s.summary.totalSales.toFixed(2)}</div>
                <button onClick={() => btPrinterService.printReceipt(null, company, s, transactions)} className="p-2 bg-slate-100 rounded-lg"><Printer size={16}/></button>
              </div>
            ))}
          </div>
        )}

        {/* MANAGE TAB - WIJZIGEN & STOCK */}
        {activeTab === 'MANAGE' && (
          <div className="space-y-6">
            <div className="bg-white p-6 rounded-[2rem] border border-slate-200 shadow-sm">
              <h3 className="font-black text-xs uppercase text-slate-400 mb-4 flex items-center justify-between">
                <span>Productbeheer ({products.length}/10)</span>
                <button onClick={() => setEditingProd({id: Date.now().toString(), name: '', price: 0, vatRate: 21, color: 'bg-slate-100', stock: 0, updatedAt: Date.now()})} className="bg-slate-900 text-white p-2 rounded-full"><Plus size={16}/></button>
              </h3>
              <div className="space-y-2">
                {products.map(p => (
                  <div key={p.id} className="flex justify-between items-center p-3 bg-slate-50 rounded-2xl border border-slate-100">
                    <div><p className="font-black text-sm uppercase">{p.name}</p><p className="text-[10px] text-slate-400">€{p.price.toFixed(2)} • {p.vatRate}% BTW • Stock: {p.stock}</p></div>
                    <div className="flex gap-2">
                      <button onClick={() => setEditingProd(p)} className="p-2 text-indigo-500"><Edit3 size={16}/></button>
                      <button onClick={() => setProducts(products.filter(x => x.id !== p.id))} className="p-2 text-red-400"><Trash2 size={16}/></button>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* EDIT MODAL OVERLAY */}
            {editingProd && (
              <div className="fixed inset-0 bg-slate-900/80 z-[60] flex items-center justify-center p-6">
                <div className="bg-white rounded-[2.5rem] p-8 w-full max-w-sm">
                  <h3 className="font-black mb-4 uppercase">Product Aanpassen</h3>
                  <div className="space-y-4">
                    <input className="w-full border-b p-2 font-bold" value={editingProd.name} onChange={e => setEditingProd({...editingProd, name: e.target.value})} placeholder="Naam"/>
                    <input className="w-full border-b p-2" type="number" value={editingProd.price} onChange={e => setEditingProd({...editingProd, price: parseFloat(e.target.value)})} placeholder="Prijs"/>
                    <input className="w-full border-b p-2" type="number" value={editingProd.stock} onChange={e => setEditingProd({...editingProd, stock: parseInt(e.target.value)})} placeholder="Stock"/>
                    <div className="flex gap-2">
                      {[0, 21].map(v => (
                        <button key={v} onClick={() => setEditingProd({...editingProd, vatRate: v as (0|21)})} className={`flex-1 p-2 rounded-xl text-xs font-black ${editingProd.vatRate === v ? 'bg-slate-900 text-white' : 'bg-slate-100'}`}>BTW {v}%</button>
                      ))}
                    </div>
                    <button onClick={() => { if(products.find(x => x.id === editingProd.id)) updateProduct(editingProd); else setProducts([...products, editingProd]); setEditingProd(null); }} className="w-full bg-emerald-500 text-white p-4 rounded-2xl font-black">OPSLAAN</button>
                    <button onClick={() => setEditingProd(null)} className="w-full text-slate-400 text-[10px] font-black uppercase">Annuleren</button>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* SETTINGS TAB - VOLLEDIGE COMPANY DATA */}
        {activeTab === 'SETTINGS' && (
          <div className="space-y-4">
            <div className="bg-white p-6 rounded-[2.5rem] border border-slate-200 space-y-4 shadow-sm">
              <h2 className="font-black text-[10px] uppercase text-slate-400 tracking-widest">Bedrijfsgegevens & Facturatie</h2>
              <input className="w-full border-b p-2 text-sm font-bold outline-none" value={company.name} onChange={e=>setCompany({...company, name:e.target.value})} placeholder="Bedrijfsnaam"/>
              <input className="w-full border-b p-2 text-sm outline-none" value={company.address} onChange={e=>setCompany({...company, address:e.target.value})} placeholder="Adres"/>
              <input className="w-full border-b p-2 text-sm outline-none" value={company.address2} onChange={e=>setCompany({...company, address2:e.target.value})} placeholder="Postcode / Stad"/>
              <input className="w-full border-b p-2 text-sm outline-none" value={company.vatNumber} onChange={e=>setCompany({...company, vatNumber:e.target.value})} placeholder="BTW Nummer"/>
              <input className="w-full border-b p-2 text-sm outline-none" value={company.website} onChange={e=>setCompany({...company, website:e.target.value})} placeholder="Website"/>
              <input className="w-full border-b p-2 text-sm outline-none" value={company.managerPin} onChange={e=>setCompany({...company, managerPin:e.target.value})} placeholder="Manager PIN"/>
            </div>
            
            <button onClick={() => {
              const k = parseFloat(prompt("Getelde CASH in lade?") || "-1");
              if(k === -1) return;
              const v = currentSession.cashManagement.openingBalance + currentSession.summary.cashTotal;
              const finalized = {...currentSession, status:'CLOSED' as 'CLOSED', endTime:Date.now(), cashManagement:{...currentSession.cashManagement, closingBalance:k, difference:k-v}};
              setClosedSessions([finalized, ...closedSessions]);
              btPrinterService.printReceipt(null, company, finalized, transactions);
              alert("Sessie gesloten!");
            }} className="w-full bg-red-600 text-white p-5 rounded-[2.5rem] font-black text-xs uppercase flex items-center justify-center gap-2 shadow-xl shadow-red-100"><RefreshCcw size={16}/> Dagafsluiting & Print Z-Rapport</button>
          </div>
        )}

      </main>

      {/* NAVIGATIE */}
      <nav className="fixed bottom-0 left-0 right-0 bg-white border-t p-3 flex justify-around items-center z-50">
        <button onClick={() => setActiveTab('SHOP')} className={`p-4 rounded-2xl ${activeTab === 'SHOP' ? 'bg-slate-900 text-white' : 'text-slate-400'}`}><ShoppingCart size={24}/></button>
        <button onClick={() => setActiveTab('REPORTS')} className={`p-4 rounded-2xl ${activeTab === 'REPORTS' ? 'bg-slate-900 text-white' : 'text-slate-400'}`}><Receipt size={24}/></button>
        <button onClick={() => setActiveTab('MANAGE')} className={`p-4 rounded-2xl ${activeTab === 'MANAGE' ? 'bg-slate-900 text-white' : 'text-slate-400'}`}><Package size={24}/></button>
        <button onClick={() => setActiveTab('SETTINGS')} className={`p-4 rounded-2xl ${activeTab === 'SETTINGS' ? 'bg-slate-900 text-white' : 'text-slate-400'}`}><Settings size={24}/></button>
      </nav>

      {/* POPUP BIJ VERKOOP */}
      {previewTx && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[100] flex items-end justify-center p-4">
          <div className="bg-white w-full max-w-sm rounded-[3rem] p-8 shadow-2xl animate-in slide-in-from-bottom-10">
            <h2 className="text-center font-black text-xl mb-6">BETAALD €{previewTx.total.toFixed(2)}</h2>
            <button onClick={async () => { await btPrinterService.printReceipt(previewTx, company, null, transactions); setPreviewTx(null); }} className="w-full bg-slate-900 text-white p-5 rounded-[2rem] font-black flex items-center justify-center gap-3 mb-3"><Printer size={20}/> PRINT BON</button>
            <button onClick={() => setPreviewTx(null)} className="w-full text-slate-400 font-black text-[10px] uppercase text-center block">Sluiten</button>
          </div>
        </div>
      )}
    </div>
  );
}
