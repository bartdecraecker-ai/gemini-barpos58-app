import React, { useState, useEffect, useMemo } from 'react';
import { 
  ShoppingBag, Trash2, CreditCard, Banknote, BarChart3, 
  Settings, Printer, Plus, Minus, Bluetooth, AlertTriangle, 
  X, User, Building, Tag, Package, Users
} from 'lucide-react';
import { Product, CartItem, Transaction, PaymentMethod, CompanyDetails, SalesSession } from './types';
import { DEFAULT_COMPANY, INITIAL_PRODUCTS, AVAILABLE_COLORS } from './constants';
import { Receipt } from './components/Receipt.tsx';
import { btPrinterService } from './services/bluetoothPrinter';

export default function App() {
  // --- State ---
  const [products, setProducts] = useState<Product[]>(INITIAL_PRODUCTS);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [sessions, setSessions] = useState<SalesSession[]>([]);
  const [company, setCompany] = useState<CompanyDetails>(DEFAULT_COMPANY);
  const [activeTab, setActiveTab] = useState<'POS' | 'REPORTS' | 'SETTINGS'>('POS');
  const [currentSession, setCurrentSession] = useState<SalesSession | null>(null);
  const [previewTransaction, setPreviewTransaction] = useState<Transaction | null>(null);
  const [viewingSession, setViewingSession] = useState<SalesSession | null>(null);
  const [btConnected, setBtConnected] = useState(false);
  const [pendingCardPayment, setPendingCardPayment] = useState(false);
  const [availableSellers, setAvailableSellers] = useState<string[]>(['Verkoper 1', 'Verkoper 2']);

  // --- Persistence ---
  useEffect(() => {
    const savedTx = localStorage.getItem('barpos_transactions');
    const savedProducts = localStorage.getItem('barpos_products');
    const savedSessions = localStorage.getItem('barpos_sessions');
    const savedCompany = localStorage.getItem('barpos_company');
    const savedSellers = localStorage.getItem('barpos_sellers');
    if (savedTx) setTransactions(JSON.parse(savedTx));
    if (savedProducts) setProducts(JSON.parse(savedProducts));
    if (savedCompany) setCompany(JSON.parse(savedCompany));
    if (savedSellers) setAvailableSellers(JSON.parse(savedSellers));
    if (savedSessions) {
      const parsed = JSON.parse(savedSessions) as SalesSession[];
      setSessions(parsed);
      setCurrentSession(parsed.find(s => s.status === 'OPEN') || null);
    }
  }, []);

  useEffect(() => {
    localStorage.setItem('barpos_transactions', JSON.stringify(transactions));
    localStorage.setItem('barpos_products', JSON.stringify(products));
    localStorage.setItem('barpos_sessions', JSON.stringify(sessions));
    localStorage.setItem('barpos_company', JSON.stringify(company));
    localStorage.setItem('barpos_sellers', JSON.stringify(availableSellers));
  }, [transactions, products, sessions, company, availableSellers]);

  // --- POS Logica ---
  const addToCart = (product: Product) => {
    setCart(prev => {
      const existing = prev.find(item => item.id === product.id);
      if (existing) return prev.map(item => item.id === product.id ? { ...item, quantity: item.quantity + 1 } : item);
      return [...prev, { ...product, quantity: 1 }];
    });
  };

  const updateQuantity = (id: string, delta: number) => {
    setCart(prev => prev.map(item => item.id === id ? { ...item, quantity: item.quantity + delta } : item).filter(i => i.quantity > 0));
  };

  const cartTotals = useMemo(() => {
    let total = 0, vat21 = 0, vat0 = 0;
    cart.forEach(item => {
      const line = item.price * item.quantity;
      total += line;
      if (item.vatRate === 21) vat21 += (line - (line / 1.21));
      else vat0 += line;
    });
    return { total, vat21, vat0 };
  }, [cart]);

  const finalizePayment = async (method: PaymentMethod) => {
    if (!currentSession) return alert("Open eerst een kassa sessie!");
    const newTx: Transaction = {
      id: `TR-${Date.now().toString().slice(-4)}`,
      sessionId: currentSession.id,
      timestamp: Date.now(),
      dateStr: new Date().toLocaleDateString('nl-NL'),
      items: [...cart],
      total: cartTotals.total,
      vat0: cartTotals.vat0,
      vat21: cartTotals.vat21,
      paymentMethod: method,
      subtotal: cartTotals.total - cartTotals.vat21
    };
    // Voorraad update
    setProducts(prev => prev.map(p => {
      const ci = cart.find(i => i.id === p.id);
      return ci ? { ...p, stock: p.stock - ci.quantity } : p;
    }));
    setTransactions([newTx, ...transactions]);
    setCart([]);
    setPendingCardPayment(false);
    if (window.confirm("Ticket afdrukken?")) {
      if (btConnected) await btPrinterService.printReceipt(newTx, company);
      else setPreviewTransaction(newTx);
    }
  };

  return (
    <div className="min-h-screen flex flex-col md:flex-row bg-slate-100">
      <nav className="bg-slate-900 text-white w-full md:w-20 flex md:flex-col items-center py-4 z-50">
        <button onClick={() => setActiveTab('POS')} className={`p-4 rounded-xl mb-4 ${activeTab === 'POS' ? 'bg-amber-500' : ''}`}><ShoppingBag /></button>
        <button onClick={() => setActiveTab('REPORTS')} className={`p-4 rounded-xl mb-4 ${activeTab === 'REPORTS' ? 'bg-amber-500' : ''}`}><BarChart3 /></button>
        <button onClick={() => setActiveTab('SETTINGS')} className={`p-4 rounded-xl ${activeTab === 'SETTINGS' ? 'bg-amber-500' : ''}`}><Settings /></button>
      </nav>

      <main className="flex-1 flex flex-col overflow-hidden">
        {activeTab === 'POS' && (
          <div className="flex-1 flex flex-col md:flex-row overflow-hidden">
            {/* GRID 4 OP EEN RIJ */}
            <div className="flex-1 p-4 grid grid-cols-4 gap-3 overflow-y-auto content-start">
              {products.map(p => (
                <button key={p.id} onClick={() => addToCart(p)} className={`${p.color} p-4 rounded-2xl font-bold shadow text-center flex flex-col min-h-[100px] justify-center active:scale-95`}>
                  <span className="text-sm uppercase">{p.name}</span>
                  <span className="text-xs opacity-70">€{p.price.toFixed(2)}</span>
                  <span className="text-[10px] opacity-50 italic">Stock: {p.stock}</span>
                </button>
              ))}
            </div>

            {/* ZIJBALK: MANDJE BOVENAAN, BETALEN ONDERAAN */}
            <div className="w-full md:w-96 bg-white border-l shadow-2xl flex flex-col overflow-hidden">
              <div className="p-4 border-b font-black text-slate-700 bg-slate-50 uppercase text-xs">Winkelmand</div>
              
              {/* PRODUCTEN BOVENAAN */}
              <div className="flex-1 overflow-y-auto p-2">
                {cart.map(item => (
                  <div key={item.id} className="flex items-center justify-between p-2 border-b">
                    <div className="flex items-center gap-2">
                      <button onClick={() => updateQuantity(item.id, -1)} className="p-1 bg-slate-100 rounded text-red-500"><Minus size={14}/></button>
                      <span className="font-bold w-4 text-center">{item.quantity}</span>
                      <button onClick={() => updateQuantity(item.id, 1)} className="p-1 bg-slate-100 rounded text-green-500"><Plus size={14}/></button>
                    </div>
                    <span className="flex-1 px-3 text-sm font-bold uppercase truncate">{item.name}</span>
                    <span className="font-black">€{(item.price * item.quantity).toFixed(2)}</span>
                  </div>
                ))}
              </div>

              {/* BETALEN ALTIJD ONDERAAN */}
              <div className="p-6 bg-slate-900 text-white">
                <div className="flex justify-between text-2xl font-black mb-4"><span>TOTAAL</span><span>€{cartTotals.total.toFixed(2)}</span></div>
                <div className="grid grid-cols-2 gap-3">
                  <button onClick={() => finalizePayment(PaymentMethod.CASH)} className="bg-green-600 p-4 rounded-xl font-black uppercase">Cash</button>
                  <button onClick={() => setPendingCardPayment(true)} className="bg-blue-600 p-4 rounded-xl font-black uppercase">Card</button>
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'REPORTS' && (
          <div className="p-8 overflow-y-auto h-full">
            <h2 className="text-2xl font-black mb-6 uppercase">Dagrapporten</h2>
            <div className="space-y-4">
              {sessions.slice().reverse().map(s => (
                <div key={s.id} className="bg-white p-6 rounded-2xl border flex items-center justify-between shadow-sm">
                  <div>
                    <div className="font-black text-lg">{new Date(s.startTime).toLocaleDateString()}</div>
                    <div className="text-xs font-bold text-slate-400 uppercase">{s.status === 'OPEN' ? '🟢 Actief' : '🔴 Gesloten'}</div>
                  </div>
                  <button onClick={() => {
                    const res = s.status === 'OPEN' ? calculateSessionTotals(s.id, s.startCash) : s;
                    setViewingSession({ ...s, summary: res.summary });
                  }} className="bg-slate-900 text-white px-6 py-3 rounded-xl font-black flex items-center gap-2">
                    <Printer size={18}/> PRINT RAPPORT
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {activeTab === 'SETTINGS' && (
          <div className="p-8 overflow-y-auto h-full space-y-8 max-w-5xl mx-auto w-full">
            {/* BEDRIJF & VERKOPERS */}
            <div className="bg-white p-8 rounded-3xl border shadow-sm">
              <h3 className="font-black mb-6 uppercase flex items-center gap-2"><Building size={20}/> Bedrijfsgegevens & Verkopers</h3>
              <div className="grid grid-cols-2 gap-6 mb-6">
                <input className="p-3 border rounded-xl" placeholder="Bedrijfsnaam" value={company.name} onChange={e => setCompany({...company, name: e.target.value})} />
                <input className="p-3 border rounded-xl" placeholder="Adres" value={company.address} onChange={e => setCompany({...company, address: e.target.value})} />
                <input className="p-3 border rounded-xl" placeholder="BTW Nummer" value={company.vatNumber} onChange={e => setCompany({...company, vatNumber: e.target.value})} />
                <select className="p-3 border rounded-xl font-bold" value={company.sellerName} onChange={e => setCompany({...company, sellerName: e.target.value})}>
                  <option value="">Kies Verkoper...</option>
                  {availableSellers.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
              <div className="flex gap-2">
                <input id="new-seller" className="p-3 border rounded-xl flex-1" placeholder="Nieuwe verkoper naam..." />
                <button onClick={() => {
                  const el = document.getElementById('new-seller') as HTMLInputElement;
                  if(el.value) { setAvailableSellers([...availableSellers, el.value]); el.value = ''; }
                }} className="bg-slate-800 text-white px-6 rounded-xl font-bold">VOEG VERKOPER TOE</button>
              </div>
            </div>

            {/* PRODUCTBEHEER - ÉÉN LIJN PER PRODUCT */}
            <div className="bg-white p-8 rounded-3xl border shadow-sm">
              <div className="flex justify-between items-center mb-6">
                <h3 className="font-black uppercase flex items-center gap-2"><Tag size={20}/> Productbeheer</h3>
                <button onClick={() => setProducts([...products, { id: Date.now().toString(), name: 'NIEUW', price: 0, vatRate: 21, color: 'bg-slate-200', stock: 100 }])} className="bg-amber-500 text-white px-6 py-2 rounded-xl font-bold">+ PRODUCT</button>
              </div>
              <div className="space-y-2">
                {products.map(p => (
                  <div key={p.id} className="flex gap-2 items-center bg-slate-50 p-2 rounded-xl">
                    <input className="flex-1 p-2 border rounded-lg font-bold" value={p.name} onChange={e => setProducts(products.map(x => x.id === p.id ? {...x, name: e.target.value.toUpperCase()} : x))} />
                    <input type="number" className="w-24 p-2 border rounded-lg font-black text-center" value={p.price} onChange={e => setProducts(products.map(x => x.id === p.id ? {...x, price: parseFloat(e.target.value)} : x))} />
                    <select className="w-24 p-2 border rounded-lg font-bold" value={p.vatRate} onChange={e => setProducts(products.map(x => x.id === p.id ? {...x, vatRate: parseInt(e.target.value) as 0|21} : x))}>
                      <option value={21}>21%</option>
                      <option value={0}>0%</option>
                    </select>
                    <div className="flex items-center gap-1 bg-white px-2 border rounded-lg">
                      <span className="text-[10px] text-slate-400">STOCK:</span>
                      <input type="number" className="w-16 p-2 font-bold text-center" value={p.stock} onChange={e => setProducts(products.map(x => x.id === p.id ? {...x, stock: parseInt(e.target.value)} : x))} />
                    </div>
                    <button onClick={() => setProducts(products.filter(x => x.id !== p.id))} className="text-red-500 p-2"><Trash2 size={18}/></button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </main>

      {/* CARD PAYMENT MODAL */}
      {pendingCardPayment && (
        <div className="fixed inset-0 z-[300] bg-slate-900/95 flex items-center justify-center p-4">
          <div className="bg-white p-10 rounded-[40px] text-center max-w-sm w-full">
            <CreditCard size={64} className="mx-auto mb-6 text-blue-600" />
            <h2 className="text-4xl font-black mb-10 tracking-tighter">€{cartTotals.total.toFixed(2)}</h2>
            <button onClick={() => finalizePayment(PaymentMethod.CARD)} className="w-full bg-blue-600 text-white py-5 rounded-3xl font-black text-xl mb-4">CONTROLE KAART OK</button>
            <button onClick={() => setPendingCardPayment(false)} className="text-slate-400 font-bold uppercase text-xs">Annuleren</button>
          </div>
        </div>
      )}

      {/* RECEIPT PREVIEW */}
      {(previewTransaction || viewingSession) && (
        <div className="fixed inset-0 z-[200] bg-black/80 flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-white p-10 rounded-[40px] max-w-sm w-full shadow-2xl overflow-y-auto max-h-[90vh]">
            <Receipt transaction={previewTransaction} sessionSummary={viewingSession} company={company} />
            <button onClick={() => {setPreviewTransaction(null); setViewingSession(null);}} className="w-full mt-10 bg-slate-900 text-white py-5 rounded-3xl font-black uppercase">Sluiten</button>
          </div>
        </div>
      )}
    </div>
  );
}
