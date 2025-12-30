import React, { useState, useEffect } from 'react';
import { 
  ShoppingCart, Receipt, Settings, Package, 
  Trash2, Printer, CheckCircle2, 
  Bluetooth, Wallet, Landmark, 
  RefreshCcw, Store, UserCircle2, X, Download
} from 'lucide-react';
import { btPrinterService } from './services/bluetoothPrinter';
import { Transaction, Product, CompanyDetails, SalesSession, Seller, PaymentMethod } from './types';

export default function App() {
  // --- 1. STATES ---
  const [activeTab, setActiveTab] = useState<'SHOP' | 'REPORTS' | 'MANAGE' | 'SETTINGS'>('SHOP');
  const [viewMode, setViewMode] = useState<'GRID' | 'TOUR'>('GRID');
  
  const [products, setProducts] = useState<Product[]>([
    { id: '1', name: 'Bier', price: 2.50, vatRate: 21, color: 'bg-amber-100', updatedAt: Date.now() },
    { id: '2', name: 'Koffie', price: 2.00, vatRate: 21, color: 'bg-orange-100', updatedAt: Date.now() },
    { id: '3', name: 'Krauker Anijs', price: 12.50, vatRate: 21, color: 'bg-emerald-100', updatedAt: Date.now() }
  ]);

  const [company, setCompany] = useState<CompanyDetails>({
    name: "GEMINI BAR",
    address: "Kerkstraat 1",
    vatNumber: "BE 0123.456.789",
    footerMessage: "Bedankt en tot ziens!",
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

  // --- 2. BLUETOOTH STATUS ---
  useEffect(() => {
    const check = setInterval(() => setBtConnected(btPrinterService.isConnected()), 2000);
    return () => clearInterval(check);
  }, []);

  // --- 3. ACTIES (NU MET DIRECTE CONTROLE) ---
  const addToCart = (p: Product) => {
    setCart(prev => {
      const exists = prev.find(item => item.product.id === p.id);
      if (exists) return prev.map(item => item.product.id === p.id ? { ...item, qty: item.qty + 1 } : item);
      return [...prev, { product: p, qty: 1 }];
    });
  };

  const cartTotal = cart.reduce((sum, item) => sum + (item.product.price * item.qty), 0);

  const handleCheckout = async (method: PaymentMethod) => {
    if (cart.length === 0) return;

    const total = cartTotal;
    const v21 = cart.reduce((sum, item) => item.product.vatRate === 21 ? sum + (item.product.price * item.qty * 0.21 / 1.21) : sum, 0);

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

    // Update sessie direct
    setCurrentSession(prev => ({
      ...prev,
      summary: {
        ...prev.summary,
        totalSales: prev.summary.totalSales + total,
        transactionCount: prev.summary.transactionCount + 1,
        cashTotal: method === PaymentMethod.CASH ? prev.summary.cashTotal + total : prev.summary.cashTotal,
        cardTotal: method === PaymentMethod.CARD ? prev.summary.cardTotal + total : prev.summary.cardTotal,
        vat21Total: prev.summary.vat21Total + v21
      }
    }));

    setTransactions(prev => [newTx, ...prev]);
    setPreviewTx(newTx);
    setCart([]);
  };

  const handleCloseSession = () => {
    const geteldeKas = parseFloat(prompt("Wat zit er nu CASH in de lade?") || "-1");
    if (geteldeKas === -1) return;

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

    setClosedSessions(prev => [finalized, ...prev]);
    alert("Sessie gesloten. Rapport beschikbaar bij 'Historiek'.");
    setActiveTab('REPORTS');
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 pb-24 font-sans">
      
      {/* HEADER */}
      <header className="bg-white border-b p-4 flex justify-between items-center sticky top-0 z-50">
        <div onClick={() => setViewMode(viewMode === 'GRID' ? 'TOUR' : 'GRID')} className="cursor-pointer">
          <h1 className="font-black text-xl italic leading-none">GEMINI BAR</h1>
          <p className="text-[10px] font-bold text-amber-500 uppercase tracking-widest">{viewMode} MODE</p>
        </div>
        <button 
          onClick={() => btPrinterService.connect()}
          className={`p-2 rounded-xl transition-colors ${btConnected ? 'bg-emerald-100 text-emerald-600' : 'bg-red-100 text-red-600'}`}
        >
          <Bluetooth size={20}/>
        </button>
      </header>

      <main className="max-w-md mx-auto p-4">

        {/* SHOP TAB */}
        {activeTab === 'SHOP' && (
          <div className="space-y-4">
            <div className={viewMode === 'GRID' ? "grid grid-cols-3 gap-2" : "grid grid-cols-1 gap-3"}>
              {products.map(p => (
                <button 
                  key={p.id} onClick={() => addToCart(p)}
                  className={`${p.color} ${viewMode === 'TOUR' ? 'h-24 px-6' : 'h-20 px-3'} rounded-3xl border-2 border-white shadow-sm active:scale-95 flex flex-col justify-center text-left transition-transform`}
                >
                  <span className="font-black text-xs uppercase truncate w-full">{p.name}</span>
                  <span className="font-bold text-sm">€{p.price.toFixed(2)}</span>
                </button>
              ))}
            </div>

            {cart.length > 0 && (
              <div className="bg-white rounded-[2.5rem] p-6 shadow-2xl border border-slate-200 fixed bottom-24 left-4 right-4 z-40 max-w-md mx-auto">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="font-black text-xs uppercase text-slate-400 tracking-widest">Winkelmand</h3>
                  <button onClick={() => setCart([])} className="text-slate-300"><X size={18}/></button>
                </div>
                <div className="max-h-32 overflow-y-auto mb-4 space-y-2">
                  {cart.map(item => (
                    <div key={item.product.id} className="flex justify-between font-bold text-sm">
                      <span>{item.qty}x {item.product.name}</span>
                      <span>€{(item.product.price * item.qty).toFixed(2)}</span>
                    </div>
                  ))}
                </div>
                <div className="flex gap-2">
                  <button onClick={() => handleCheckout(PaymentMethod.CASH)} className="flex-1 bg-slate-900 text-white p-4 rounded-2xl font-black text-xs flex items-center justify-center gap-2">
                    <Wallet size={16}/> CASH €{cartTotal.toFixed(2)}
                  </button>
                  <button onClick={() => handleCheckout(PaymentMethod.CARD)} className="flex-1 bg-indigo-600 text-white p-4 rounded-2xl font-black text-xs flex items-center justify-center gap-2">
                    <Landmark size={16}/> KAART
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* REPORTS TAB */}
        {activeTab === 'REPORTS' && (
          <div className="space-y-3">
            <h2 className="font-black text-xs text-slate-400 uppercase italic px-2">Sessie Historiek</h2>
            {closedSessions.length === 0 && <p className="text-center text-slate-400 py-10 text-sm">Nog geen gesloten sessies.</p>}
            {closedSessions.map(s => (
              <div key={s.id} className="bg-white p-4 rounded-3xl border border-slate-200 flex justify-between items-center">
                <div>
                  <p className="font-black text-sm">{new Date(s.startTime).toLocaleDateString()}</p>
                  <p className="text-[10px] font-bold text-slate-400 uppercase">Omzet: €{s.summary.totalSales.toFixed(2)}</p>
                </div>
                <button 
                  onClick={() => btPrinterService.printReceipt(null, company, s, transactions)}
                  className="p-3 bg-slate-900 text-white rounded-2xl"
                >
                  <Printer size={18}/>
                </button>
              </div>
            ))}
          </div>
        )}

        {/* SETTINGS TAB */}
        {activeTab === 'SETTINGS' && (
          <div className="space-y-4">
            <div className="bg-white p-6 rounded-[2.5rem] border border-slate-200 space-y-4">
              <h2 className="font-black text-[10px] uppercase text-slate-400 tracking-widest">Bedrijfsgegevens</h2>
              <input className="w-full border-b p-2 font-bold outline-none" value={company.name} onChange={e=>setCompany({...company, name:e.target.value})} placeholder="Naam"/>
              <input className="w-full border-b p-2 outline-none text-sm" value={company.vatNumber} onChange={e=>setCompany({...company, vatNumber:e.target.value})} placeholder="BTW Nr"/>
              <input className="w-full border-b p-2 outline-none text-sm" value={company.footerMessage} onChange={e=>setCompany({...company, footerMessage:e.target.value})} placeholder="Footer bericht"/>
            </div>
            
            <button 
              onClick={handleCloseSession}
              className="w-full bg-red-50 text-red-500 p-5 rounded-[2.5rem] font-black text-xs uppercase flex items-center justify-center gap-2 border border-red-100"
            >
              <RefreshCcw size={16}/> Dagafsluiting (Z-Rapport)
            </button>
          </div>
        )}

      </main>

      {/* NAVIGATIE */}
      <nav className="fixed bottom-0 left-0 right-0 bg-white border-t p-3 flex justify-around items-center z-50">
        <button onClick={() => setActiveTab('SHOP')} className={`p-3 rounded-2xl ${activeTab === 'SHOP' ? 'bg-slate-900 text-white' : 'text-slate-400'}`}>
          <ShoppingCart size={24}/>
        </button>
        <button onClick={() => setActiveTab('REPORTS')} className={`p-3 rounded-2xl ${activeTab === 'REPORTS' ? 'bg-slate-900 text-white' : 'text-slate-400'}`}>
          <Receipt size={24}/>
        </button>
        <button onClick={() => setActiveTab('SETTINGS')} className={`p-3 rounded-2xl ${activeTab === 'SETTINGS' ? 'bg-slate-900 text-white' : 'text-slate-400'}`}>
          <Settings size={24}/>
        </button>
      </nav>

      {/* KASSABON POPUP */}
      {previewTx && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-[60] flex items-end justify-center p-4">
          <div className="bg-white w-full max-w-sm rounded-[3rem] p-8 shadow-2xl">
            <div className="flex justify-center mb-4 text-emerald-500"><CheckCircle2 size={48}/></div>
            <h2 className="text-center font-black text-xl mb-6">Verkocht! €{previewTx.total.toFixed(2)}</h2>
            <button 
              onClick={async () => {
                await btPrinterService.printReceipt(previewTx, company, null, transactions);
                setPreviewTx(null);
              }}
              className="w-full bg-slate-900 text-white p-5 rounded-[2rem] font-black flex items-center justify-center gap-3 mb-3"
            >
              <Printer size={20}/> BON PRINTEN
            </button>
            <button onClick={() => setPreviewTx(null)} className="w-full text-slate-400 font-black text-[10px] uppercase">Sluiten</button>
          </div>
        </div>
      )}
    </div>
  );
}
