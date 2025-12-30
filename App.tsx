import React, { useState, useEffect } from 'react';
import { 
  ShoppingCart, Receipt, Settings, Package, Users, 
  Plus, Minus, Trash2, Printer, CheckCircle2, 
  Bluetooth, BluetoothConnected, Wallet, Landmark, 
  RefreshCcw, Building2, Store, UserCircle2, X
} from 'lucide-react';
import { btPrinterService } from './services/bluetoothPrinter';
import { Transaction, Product, CompanyDetails, SalesSession, Seller } from './types';

export default function App() {
  // --- 1. STATES ---
  const [activeTab, setActiveTab] = useState<'SHOP' | 'REPORTS' | 'MANAGE' | 'SETTINGS'>('SHOP');
  const [viewMode, setViewMode] = useState<'GRID' | 'TOUR'>('GRID'); // Switch tussen Shop en Tour
  
  // Data States
  const [products, setProducts] = useState<Product[]>([
    { id: '1', name: 'Bier', price: 2.50, vatRate: 21, stock: 100, color: 'bg-amber-100' },
    { id: '2', name: 'Koffie', price: 2.00, vatRate: 21, stock: 50, color: 'bg-orange-100' }
  ]);
  const [sellers, setSellers] = useState<Seller[]>([
    { id: '1', name: 'Beheerder', role: 'ADMIN', active: true }
  ]);
  const [activeSeller, setActiveSeller] = useState<Seller>(sellers[0]);
  const [company, setCompany] = useState<CompanyDetails>({
    name: "GEMINI BAR",
    address: "Kerkstraat 1",
    address2: "9000 Gent",
    vatNumber: "BE 0123.456.789",
    footerMessage: "Bedankt en tot ziens!"
  });

  // Kassa States
  const [cart, setCart] = useState<{product: Product, qty: number}[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [btConnected, setBtConnected] = useState(false);
  const [previewTx, setPreviewTx] = useState<Transaction | null>(null);

  // Sessie State
 const [currentSession, setCurrentSession] = useState<SalesSession>({
  id: 'SESS-' + Date.now(),
  startTime: Date.now(),
  startCash: 50,
  status: 'OPEN',
  cashManagement: { openingBalance: 50, closingBalance: 0, difference: 0 },
  summary: { 
    totalSales: 0, 
    transactionCount: 0, 
    cashTotal: 0, 
    cardTotal: 0, 
    vat0Total: 0, 
    vat21Total: 0 
  },
  updatedAt: Date.now()
});
  const [closedSessions, setClosedSessions] = useState<SalesSession[]>([]);

  // --- 2. BLUETOOTH STATUS CHECK ---
  useEffect(() => {
    const checkBt = setInterval(() => setBtConnected(btPrinterService.isConnected()), 2000);
    return () => clearInterval(checkBt);
  }, []);

  // --- 3. KASSA ACTIES ---
  const addToCart = (p: Product) => {
    setCart(prev => {
      const exists = prev.find(item => item.product.id === p.id);
      if (exists) return prev.map(item => item.product.id === p.id ? { ...item, qty: item.qty + 1 } : item);
      return [...prev, { product: p, qty: 1 }];
    });
  };

  const cartTotal = cart.reduce((sum, item) => sum + (item.product.price * item.qty), 0);

  const handleCheckout = async (method: 'CASH' | 'CARD') => {
    if (cart.length === 0 || !currentSession) return;

    const vat21 = cart.reduce((sum, item) => item.product.vatRate === 21 ? sum + (item.product.price * item.qty * 0.21 / 1.21) : sum, 0);
    
    const newTx: Transaction = {
      id: 'TX-' + Date.now(),
      timestamp: Date.now(),
      dateStr: new Date().toLocaleDateString('nl-NL') + ' ' + new Date().toLocaleTimeString('nl-NL', {hour:'2-digit', minute:'2-digit'}),
      items: cart.map(item => ({ ...item.product, quantity: item.qty })),
      total: cartTotal,
      paymentMethod: method,
      vat21: vat21,
      vat0: 0,
      sessionId: currentSession.id,
      sellerName: activeSeller.name
    };

    // Update Sessie
    setCurrentSession(prev => {
      if (!prev) return null;
      return {
        ...prev,
        summary: {
          totalSales: prev.summary.totalSales + cartTotal,
          cashTotal: method === 'CASH' ? prev.summary.cashTotal + cartTotal : prev.summary.cashTotal,
          cardTotal: method === 'CARD' ? prev.summary.cardTotal + cartTotal : prev.summary.cardTotal,
          vat21Total: prev.summary.vat21Total + vat21,
          vat0Total: prev.summary.vat0Total
        }
      };
    });

    setTransactions([newTx, ...transactions]);
    setPreviewTx(newTx);
    setCart([]);
  };

  const handleCloseSession = () => {
    const input = prompt("Voer de getelde cash in de lade in:");
    if (input === null) return;
    const geteldeKas = parseFloat(input);
    
    if (!currentSession) return;
    const verwachteCash = currentSession.cashManagement.openingBalance + currentSession.summary.cashTotal;
    
    const finalized: SalesSession = {
      ...currentSession,
      status: 'CLOSED',
      endTime: Date.now(),
      cashManagement: {
        ...currentSession.cashManagement,
        closingBalance: geteldeKas,
        difference: geteldeKas - verwachteCash
      }
    };

    setClosedSessions([finalized, ...closedSessions]);
    setCurrentSession(null);
    setActiveTab('REPORTS');
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 pb-24">
      
      {/* HEADER */}
      <header className="bg-white border-b p-4 sticky top-0 z-30 flex justify-between items-center shadow-sm">
        <div onClick={() => setViewMode(viewMode === 'GRID' ? 'TOUR' : 'GRID')} className="cursor-pointer">
          <h1 className="font-black text-xl italic leading-none">GEMINI <span className="text-amber-500 text-xs">POS</span></h1>
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-1">
            {viewMode === 'GRID' ? <Store size={10}/> : <Package size={10}/>} {viewMode} MODE
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="text-right hidden sm:block">
            <p className="text-[10px] font-black uppercase text-slate-400">Verkoper</p>
            <p className="text-xs font-bold">{activeSeller.name}</p>
          </div>
          <div className={`p-2 rounded-xl ${btConnected ? 'bg-emerald-50 text-emerald-500' : 'bg-red-50 text-red-500'}`}>
            <Bluetooth size={20}/>
          </div>
        </div>
      </header>

      <main className="max-w-xl mx-auto p-4">

        {/* --- SHOP / TOUR TAB --- */}
        {activeTab === 'SHOP' && (
          <div className="space-y-6">
            <div className={viewMode === 'GRID' ? "grid grid-cols-3 gap-2" : "grid grid-cols-1 gap-4"}>
              {products.map(p => (
                <button 
                  key={p.id} onClick={() => addToCart(p)}
                  className={`${p.color} ${viewMode === 'TOUR' ? 'h-32 p-6' : 'h-24 p-3'} rounded-[2rem] border-2 border-white shadow-sm active:scale-95 transition-all text-left flex flex-col justify-between`}
                >
                  <span className={`font-black uppercase tracking-tighter ${viewMode === 'TOUR' ? 'text-lg' : 'text-[10px]'} leading-tight`}>{p.name}</span>
                  <span className="font-bold">€{p.price.toFixed(2)}</span>
                </button>
              ))}
            </div>

            {/* Cart Overlay */}
            {cart.length > 0 && (
              <div className="bg-white rounded-[2.5rem] p-6 shadow-2xl border border-slate-100 animate-in slide-in-from-bottom-10">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="font-black text-[10px] uppercase text-slate-400">Huidige Bestelling</h3>
                  <button onClick={() => setCart([])} className="text-slate-300"><X size={16}/></button>
                </div>
                <div className="space-y-2 mb-6 max-h-40 overflow-y-auto">
                  {cart.map(item => (
                    <div key={item.product.id} className="flex justify-between items-center text-sm font-bold">
                      <span>{item.qty}x {item.product.name}</span>
                      <span>€{(item.product.price * item.qty).toFixed(2)}</span>
                    </div>
                  ))}
                </div>
                <div className="flex gap-2">
                  <button onClick={() => handleCheckout('CASH')} className="flex-1 bg-slate-900 text-white p-4 rounded-2xl font-black text-xs flex items-center justify-center gap-2">
                    <Wallet size={16}/> CASH €{cartTotal.toFixed(2)}
                  </button>
                  <button onClick={() => handleCheckout('CARD')} className="flex-1 bg-indigo-600 text-white p-4 rounded-2xl font-black text-xs flex items-center justify-center gap-2">
                    <Landmark size={16}/> KAART
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* --- REPORTS TAB --- */}
        {activeTab === 'REPORTS' && (
          <div className="space-y-4">
            <h2 className="font-black text-xs uppercase text-slate-400 italic">Sessie Historie</h2>
            {closedSessions.map(s => (
              <div key={s.id} className="bg-white p-5 rounded-[2rem] border border-slate-100 flex justify-between items-center">
                <div>
                  <p className="font-black text-sm">{new Date(s.startTime).toLocaleDateString()}</p>
                  <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Omzet: €{s.summary.totalSales.toFixed(2)}</p>
                </div>
                <button 
                  onClick={() => btPrinterService.printReceipt(null, company, s, transactions)}
                  className="w-12 h-12 bg-slate-50 rounded-2xl flex items-center justify-center text-slate-400 active:bg-slate-900 active:text-white transition-all"
                >
                  <Printer size={20}/>
                </button>
              </div>
            ))}
          </div>
        )}

        {/* --- BEHEER TAB (Producten & Verkopers) --- */}
        {activeTab === 'MANAGE' && (
          <div className="space-y-8">
            <section>
              <h2 className="font-black text-xs uppercase text-slate-400 mb-4 px-2">Producten</h2>
              <div className="bg-white rounded-[2rem] p-4 shadow-sm border border-slate-100 space-y-2">
                {products.map(p => (
                  <div key={p.id} className="flex justify-between items-center p-2 border-b last:border-0">
                    <span className="font-bold text-sm">{p.name}</span>
                    <span className="text-sm">€{p.price.toFixed(2)}</span>
                  </div>
                ))}
                <button onClick={() => alert("Gebruik INITIAL_PRODUCTS om items toe te voegen")} className="w-full text-[10px] font-black text-indigo-500 py-2 uppercase tracking-widest">Product toevoegen +</button>
              </div>
            </section>

            <section>
              <h2 className="font-black text-xs uppercase text-slate-400 mb-4 px-2">Verkopers</h2>
              <div className="grid grid-cols-2 gap-2">
                {sellers.map(s => (
                  <button 
                    key={s.id} onClick={() => setActiveSeller(s)}
                    className={`p-4 rounded-2xl border flex items-center gap-3 transition-all ${activeSeller.id === s.id ? 'bg-slate-900 text-white border-slate-900' : 'bg-white text-slate-400 border-slate-100'}`}
                  >
                    <UserCircle2 size={20}/>
                    <span className="font-bold text-xs">{s.name}</span>
                  </button>
                ))}
              </div>
            </section>
          </div>
        )}

        {/* --- SETTINGS TAB --- */}
        {activeTab === 'SETTINGS' && (
          <div className="space-y-6">
            <div className="bg-white p-6 rounded-[2.5rem] shadow-sm border border-slate-100 space-y-4">
              <h2 className="font-black text-[10px] uppercase text-slate-400 mb-2">Bedrijfsgegevens</h2>
              <input className="w-full border-b p-2 text-sm font-bold outline-none" value={company.name} onChange={e=>setCompany({...company, name:e.target.value})} placeholder="Bedrijfsnaam"/>
              <input className="w-full border-b p-2 text-sm outline-none" value={company.vatNumber} onChange={e=>setCompany({...company, vatNumber:e.target.value})} placeholder="BTW Nummer"/>
              <button onClick={() => btPrinterService.connect()} className="w-full bg-slate-100 p-4 rounded-2xl font-black text-[10px] uppercase tracking-widest text-slate-500 flex items-center justify-center gap-2">
                <Bluetooth size={14}/> {btConnected ? 'PRINTER VERBONDEN' : 'PRINTER KOPPELEN'}
              </button>
            </div>

            {currentSession && (
              <button 
                onClick={handleCloseSession}
                className="w-full bg-red-50 text-red-500 p-6 rounded-[2.5rem] font-black text-xs uppercase tracking-tighter flex items-center justify-center gap-2 border border-red-100"
              >
                <RefreshCcw size={16}/> Dagafsluiting (Z-Rapport)
              </button>
            )}
          </div>
        )}
      </main>

      {/* BOTTOM NAVIGATION */}
      <nav className="fixed bottom-0 left-0 right-0 bg-white/80 backdrop-blur-md border-t p-3 flex justify-around items-center px-6 z-40">
        <button onClick={() => setActiveTab('SHOP')} className={`p-4 rounded-2xl transition-all ${activeTab === 'SHOP' ? 'bg-slate-900 text-white' : 'text-slate-400'}`}>
          <ShoppingCart size={24}/>
        </button>
        <button onClick={() => setActiveTab('REPORTS')} className={`p-4 rounded-2xl transition-all ${activeTab === 'REPORTS' ? 'bg-slate-900 text-white' : 'text-slate-400'}`}>
          <Receipt size={24}/>
        </button>
        <button onClick={() => setActiveTab('MANAGE')} className={`p-4 rounded-2xl transition-all ${activeTab === 'MANAGE' ? 'bg-slate-900 text-white' : 'text-slate-400'}`}>
          <Package size={24}/>
        </button>
        <button onClick={() => setActiveTab('SETTINGS')} className={`p-4 rounded-2xl transition-all ${activeTab === 'SETTINGS' ? 'bg-slate-900 text-white' : 'text-slate-400'}`}>
          <Settings size={24}/>
        </button>
      </nav>

      {/* TICKET PREVIEW MODAL */}
      {previewTx && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-end justify-center p-4">
          <div className="bg-white w-full max-w-sm rounded-[3rem] p-8 shadow-2xl animate-in slide-in-from-bottom-10">
            <div className="flex justify-center mb-6">
              <div className="w-16 h-16 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center">
                <CheckCircle2 size={32}/>
              </div>
            </div>
            <h2 className="text-center font-black text-xl mb-1">Betaling geslaagd!</h2>
            <p className="text-center text-slate-400 text-xs font-bold mb-8 uppercase tracking-widest">Totaal: €{previewTx.total.toFixed(2)}</p>
            <div className="space-y-3">
              <button 
                onClick={async () => {
                  await btPrinterService.printReceipt(previewTx, company, null, transactions);
                  setPreviewTx(null);
                }}
                className="w-full bg-slate-900 text-white p-5 rounded-[2rem] font-black flex items-center justify-center gap-3"
              >
                <Printer size={20}/> BON PRINTEN
              </button>
              <button onClick={() => setPreviewTx(null)} className="w-full text-slate-400 font-black p-2 text-[10px] uppercase tracking-widest">
                DOORGAAN ZONDER BON
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
