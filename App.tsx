import React, { useState, useEffect, useMemo } from 'react';
import { 
  ShoppingBag, Trash2, CreditCard, Banknote, BarChart3, 
  Settings, Printer, Plus, Minus, Bluetooth, AlertTriangle, 
  X, User, Building, Tag, Package, Users, PlusCircle
} from 'lucide-react';
import { Product, CartItem, Transaction, PaymentMethod, CompanyDetails, SalesSession } from './types';
import { DEFAULT_COMPANY, INITIAL_PRODUCTS, AVAILABLE_COLORS } from './constants';
import { Receipt } from './components/Receipt.tsx';
import { btPrinterService } from './services/bluetoothPrinter';

export default function App() {
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
  const [startFloatAmount, setStartFloatAmount] = useState<string>('0');
  const [newSellerName, setNewSellerName] = useState('');

  // --- Persistence ---
  useEffect(() => {
    const savedTx = localStorage.getItem('barpos_transactions');
    const savedProducts = localStorage.getItem('barpos_products');
    const savedSessions = localStorage.getItem('barpos_sessions');
    const savedCompany = localStorage.getItem('barpos_company');
    if (savedTx) setTransactions(JSON.parse(savedTx));
    if (savedProducts) setProducts(JSON.parse(savedProducts));
    if (savedCompany) setCompany(JSON.parse(savedCompany));
    if (savedSessions) {
      const parsed = JSON.parse(savedSessions) as SalesSession[];
      setSessions(parsed);
      const active = parsed.find(s => s.status === 'OPEN');
      if (active) setCurrentSession(active);
    }
  }, []);

  useEffect(() => {
    localStorage.setItem('barpos_transactions', JSON.stringify(transactions));
    localStorage.setItem('barpos_products', JSON.stringify(products));
    localStorage.setItem('barpos_sessions', JSON.stringify(sessions));
    localStorage.setItem('barpos_company', JSON.stringify(company));
  }, [transactions, products, sessions, company]);

  // --- Functies ---
  const addToCart = (product: Product) => {
    if (!currentSession) {
      alert("⚠️ KASSA IS GESLOTEN. Ga naar Instellingen om een nieuwe sessie te openen.");
      setActiveTab('SETTINGS');
      return;
    }
    setCart(prev => {
      const existing = prev.find(item => item.id === product.id);
      if (existing) return prev.map(item => item.id === product.id ? { ...item, quantity: item.quantity + 1 } : item);
      return [...prev, { ...product, quantity: 1 }];
    });
  };

  const updateQuantity = (id: string, delta: number) => {
    setCart(prev => prev.map(item => item.id === id ? { ...item, quantity: item.quantity + delta } : item).filter(i => i.quantity > 0));
  };

  const calculateSessionTotals = (sessionId: string, startCash: number) => {
    const sessionTx = transactions.filter(t => t.sessionId === sessionId);
    const productSales: Record<string, number> = {};
    const summary = sessionTx.reduce((acc, tx) => {
      tx.items.forEach(item => { productSales[item.name] = (productSales[item.name] || 0) + item.quantity; });
      return {
        totalSales: acc.totalSales + tx.total,
        transactionCount: acc.transactionCount + 1,
        cashTotal: acc.cashTotal + (tx.paymentMethod === PaymentMethod.CASH ? tx.total : 0),
        cardTotal: acc.cardTotal + (tx.paymentMethod === PaymentMethod.CARD ? tx.total : 0),
        vat0Total: acc.vat0Total + tx.vat0,
        vat21Total: acc.vat21Total + tx.vat21,
      };
    }, { totalSales: 0, transactionCount: 0, cashTotal: 0, cardTotal: 0, vat0Total: 0, vat21Total: 0 });
    return { summary: { ...summary, productSales }, expectedDrawer: startCash + summary.cashTotal };
  };

  const finalizePayment = async (method: PaymentMethod) => {
    const total = cart.reduce((a, b) => a + (b.price * b.quantity), 0);
    const vat21 = cart.reduce((a, b) => b.vatRate === 21 ? a + (b.price * b.quantity - (b.price * b.quantity / 1.21)) : a, 0);
    
    const newTx: Transaction = {
      id: `TR-${Date.now().toString().slice(-4)}`,
      sessionId: currentSession!.id,
      timestamp: Date.now(),
      dateStr: new Date().toLocaleDateString('nl-NL'),
      items: [...cart],
      total,
      vat0: total - vat21,
      vat21: vat21,
      paymentMethod: method,
      subtotal: total - vat21
    };

    setProducts(prev => prev.map(p => {
      const ci = cart.find(i => i.id === p.id);
      return ci ? { ...p, stock: p.stock - ci.quantity } : p;
    }));

    setTransactions([newTx, ...transactions]);
    setCart([]);
    setPendingCardPayment(false);
    if (window.confirm("Betaling geslaagd. Ticket afdrukken?")) {
      if (btConnected) await btPrinterService.printReceipt(newTx, company);
      else setPreviewTransaction(newTx);
    }
  };

  return (
    <div className="min-h-screen flex flex-col md:flex-row bg-slate-50 font-sans">
      {/* NAVIGATIE */}
      <nav className="bg-slate-900 text-white w-full md:w-20 flex md:flex-col items-center py-6 z-50 shadow-2xl">
        <button onClick={() => setActiveTab('POS')} className={`p-4 rounded-2xl mb-6 transition-all ${activeTab === 'POS' ? 'bg-amber-500 shadow-lg scale-110' : 'text-slate-400 hover:text-white'}`}><ShoppingBag /></button>
        <button onClick={() => setActiveTab('REPORTS')} className={`p-4 rounded-2xl mb-6 transition-all ${activeTab === 'REPORTS' ? 'bg-amber-500 shadow-lg scale-110' : 'text-slate-400 hover:text-white'}`}><BarChart3 /></button>
        <button onClick={() => setActiveTab('SETTINGS')} className={`p-4 rounded-2xl transition-all ${activeTab === 'SETTINGS' ? 'bg-amber-500 shadow-lg scale-110' : 'text-slate-400 hover:text-white'}`}><Settings /></button>
      </nav>

      <main className="flex-1 flex flex-col overflow-hidden">
        {activeTab === 'POS' && (
          <div className="flex-1 flex flex-col md:flex-row overflow-hidden">
            {/* GRID - 4 KOLOMMEN */}
            <div className="flex-1 p-4 grid grid-cols-4 gap-3 overflow-y-auto content-start">
              {products.map(p => (
                <button key={p.id} onClick={() => addToCart(p)} className={`${p.color} p-4 rounded-3xl font-black shadow-sm active:scale-95 transition-all text-center flex flex-col items-center justify-center min-h-[110px] border-b-4 border-black/10`}>
                  <span className="text-sm uppercase leading-tight text-slate-800">{p.name}</span>
                  <span className="text-xs mt-1 bg-white/30 px-2 rounded-full font-bold text-slate-700">€{p.price.toFixed(2)}</span>
                  <span className="text-[10px] mt-1 text-slate-500 italic">Voorraad: {p.stock}</span>
                </button>
              ))}
            </div>

            {/* ZIJBALK - PRODUCTEN BOVENAAN */}
            <div className="w-full md:w-96 bg-white border-l shadow-2xl flex flex-col">
              <div className="p-5 border-b font-black text-slate-800 bg-slate-50 flex justify-between items-center">
                <span className="tracking-widest text-xs">WINKELMAND</span>
                <span className="text-amber-500"><ShoppingBag size={18}/></span>
              </div>
              
              <div className="flex-1 overflow-y-auto p-2">
                {cart.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-40 text-slate-200 uppercase font-black">Mandje is leeg</div>
                ) : (
                  cart.map(item => (
                    <div key={item.id} className="flex items-center justify-between p-3 border-b hover:bg-slate-50 transition-colors">
                      <div className="flex items-center gap-2">
                        <button onClick={() => updateQuantity(item.id, -1)} className="p-1.5 bg-slate-100 rounded-lg text-red-500 hover:bg-white shadow-sm"><Minus size={14}/></button>
                        <span className="font-black w-5 text-center">{item.quantity}</span>
                        <button onClick={() => updateQuantity(item.id, 1)} className="p-1.5 bg-slate-100 rounded-lg text-green-500 hover:bg-white shadow-sm"><Plus size={14}/></button>
                      </div>
                      <span className="flex-1 px-3 text-xs font-black uppercase truncate text-slate-700">{item.name}</span>
                      <span className="font-black text-slate-900">€{(item.price * item.quantity).toFixed(2)}</span>
                    </div>
                  ))
                )}
              </div>

              {/* BETALEN ALTIJD ONDERAAN */}
              <div className="p-8 bg-slate-900 text-white rounded-t-[40px] shadow-2xl">
                <div className="flex justify-between text-3xl font-black mb-8 px-2 tracking-tighter italic">
                  <span>TOTAAL</span>
                  <span className="text-amber-500">€{cart.reduce((a,b) => a + (b.price*b.quantity), 0).toFixed(2)}</span>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <button onClick={() => finalizePayment(PaymentMethod.CASH)} className="bg-green-600 hover:bg-green-500 p-5 rounded-3xl font-black text-lg shadow-lg active:translate-y-1 transition-all">CASH</button>
                  <button onClick={() => setPendingCardPayment(true)} className="bg-blue-600 hover:bg-blue-500 p-5 rounded-3xl font-black text-lg shadow-lg active:translate-y-1 transition-all">CARD</button>
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'REPORTS' && (
          <div className="p-8 overflow-y-auto h-full max-w-4xl mx-auto w-full">
            <h2 className="text-3xl font-black mb-8 tracking-tighter text-slate-800">DAGRAPPORTEN</h2>
            <div className="space-y-4">
              {sessions.slice().reverse().map(s => (
                <div key={s.id} className="bg-white p-6 rounded-[32px] border shadow-sm flex items-center justify-between hover:border-amber-400 transition-all">
                  <div className="flex items-center gap-6">
                    <div className={`p-4 rounded-2xl ${s.status === 'OPEN' ? 'bg-green-100 text-green-600' : 'bg-slate-100 text-slate-400'}`}><Clock size={28}/></div>
                    <div>
                      <div className="font-black text-xl text-slate-800">{new Date(s.startTime).toLocaleDateString('nl-NL')}</div>
                      <div className="text-xs font-bold text-slate-400 uppercase tracking-widest">{s.status === 'OPEN' ? '🟢 Actieve Sessie' : '🔴 Gesloten'} | ID: {s.id.slice(-4)}</div>
                    </div>
                  </div>
                  <button onClick={() => {
                    const res = s.status === 'OPEN' ? calculateSessionTotals(s.id, s.startCash) : s;
                    setViewingSession({ ...s, summary: res.summary });
                  }} className="bg-slate-900 text-white px-8 py-4 rounded-2xl font-black flex items-center gap-2 hover:bg-amber-500 transition-all shadow-lg">
                    <Printer size={20}/> PRINT RAPPORT
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {activeTab === 'SETTINGS' && (
          <div className="p-8 overflow-y-auto h-full max-w-5xl mx-auto w-full space-y-8">
            {/* BEDRIJF & VERKOPER - ORIGINELE LAYOUT */}
            <div className="bg-white p-8 rounded-[40px] border shadow-sm">
              <h3 className="text-xl font-black mb-6 uppercase tracking-widest flex items-center gap-3 text-slate-800"><Building size={20}/> Bedrijfsgegevens</h3>
              <div className="grid grid-cols-2 gap-4 mb-8">
                <input className="p-4 bg-slate-50 border-none rounded-2xl font-bold" placeholder="Bedrijfsnaam" value={company.name} onChange={e => setCompany({...company, name: e.target.value})} />
                <input className="p-4 bg-slate-50 border-none rounded-2xl font-bold" placeholder="Adres" value={company.address} onChange={e => setCompany({...company, address: e.target.value})} />
                <input className="p-4 bg-slate-50 border-none rounded-2xl font-bold" placeholder="BTW Nummer" value={company.vatNumber} onChange={e => setCompany({...company, vatNumber: e.target.value})} />
                <input className="p-4 bg-slate-50 border-none rounded-2xl font-bold text-amber-600" placeholder="Huidige Verkoper" value={company.sellerName || ''} onChange={e => setCompany({...company, sellerName: e.target.value})} />
              </div>
            </div>

            {/* PRODUCTBEHEER - ÉÉN LIJN - BTW 0/21 */}
            <div className="bg-white p-8 rounded-[40px] border shadow-sm">
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-xl font-black uppercase tracking-widest flex items-center gap-3 text-slate-800"><Tag size={20}/> Producten</h3>
                <button onClick={() => setProducts([...products, { id: Date.now().toString(), name: 'NIEUW PRODUCT', price: 0, vatRate: 21, color: 'bg-slate-200', stock: 100 }])} className="bg-amber-500 text-white px-6 py-2 rounded-xl font-black hover:bg-amber-600 transition-all shadow-lg">+ PRODUCT</button>
              </div>
              <div className="space-y-2">
                {products.map(p => (
                  <div key={p.id} className="flex gap-2 items-center bg-slate-50 p-2 rounded-2xl border border-slate-100 hover:border-amber-200 transition-all group">
                    <input className="flex-1 p-3 bg-white rounded-xl font-black text-sm" value={p.name} onChange={e => setProducts(products.map(x => x.id === p.id ? {...x, name: e.target.value.toUpperCase()} : x))} />
                    <input type="number" className="w-24 p-3 bg-white rounded-xl font-black text-center" value={p.price} onChange={e => setProducts(products.map(x => x.id === p.id ? {...x, price: parseFloat(e.target.value)} : x))} />
                    <select className="w-24 p-3 bg-white rounded-xl font-black text-center text-sm" value={p.vatRate} onChange={e => setProducts(products.map(x => x.id === p.id ? {...x, vatRate: parseInt(e.target.value) as 0|21} : x))}>
                      <option value={21}>21%</option>
                      <option value={0}>0%</option>
                    </select>
                    <div className="flex items-center gap-1 bg-white p-2 px-3 rounded-xl border border-slate-100">
                      <span className="text-[10px] font-black text-slate-400">STOCK:</span>
                      <input type="number" className="w-16 font-black text-center" value={p.stock} onChange={e => setProducts(products.map(x => x.id === p.id ? {...x, stock: parseInt(e.target.value)} : x))} />
                    </div>
                    <button onClick={() => setProducts(products.filter(x => x.id !== p.id))} className="text-slate-300 hover:text-red-500 p-2 transition-colors"><Trash2 size={20}/></button>
                  </div>
                ))}
              </div>
            </div>

            {/* KASSA SESSIE BEHEER */}
            <div className="bg-white p-8 rounded-[40px] border shadow-sm">
              <h3 className="text-xl font-black mb-6 uppercase tracking-widest text-slate-800">Kassa Sessie</h3>
              {!currentSession ? (
                <div className="flex gap-4 items-end">
                  <div className="flex-1">
                    <label className="block text-[10px] font-black text-slate-400 mb-2 ml-1 uppercase">Startbedrag Cash</label>
                    <input type="number" value={startFloatAmount} onChange={e => setStartFloatAmount(e.target.value)} className="w-full p-4 bg-slate-50 rounded-2xl font-black text-xl" placeholder="0.00" />
                  </div>
                  <button onClick={() => {
                    const s = { id: Date.now().toString(), startTime: Date.now(), startCash: parseFloat(startFloatAmount) || 0, status: 'OPEN' as const };
                    setSessions([...sessions, s]); setCurrentSession(s); setActiveTab('POS');
                  }} className="bg-green-600 text-white px-10 py-5 rounded-3xl font-black shadow-lg shadow-green-100 hover:bg-green-500 transition-all uppercase tracking-widest">OPEN KASSA</button>
                </div>
              ) : (
                <button onClick={() => {
                  if(window.confirm("Wil je de kassa definitief sluiten? Dagrapport wordt gegenereerd.")) {
                    const {summary, expectedDrawer} = calculateSessionTotals(currentSession.id, currentSession.startCash);
                    setSessions(sessions.map(s => s.id === currentSession.id ? {...s, status: 'CLOSED' as const, summary, endTime: Date.now(), expectedCash: expectedDrawer} : s));
                    setCurrentSession(null);
                  }
                }} className="w-full bg-red-500 text-white p-6 rounded-[32px] font-black text-lg shadow-lg shadow-red-100 hover:bg-red-600 transition-all uppercase tracking-widest">SLUIT SESSIE & PRINT DAGRAPPORT</button>
              )}
            </div>
            
            {/* RESET KNOP */}
            <div className="bg-red-50 p-8 rounded-[40px] border border-red-100">
               <h3 className="text-red-800 font-black mb-2 flex items-center gap-2 uppercase tracking-widest"><AlertTriangle /> Gevarenzone</h3>
               <p className="text-red-600 text-sm mb-6 font-bold">Wist alle test-transacties en rapporten. Producten blijven behouden.</p>
               <button onClick={() => { if(window.confirm("Alle transacties definitief wissen?")) { setTransactions([]); setSessions([]); localStorage.removeItem('barpos_transactions'); localStorage.removeItem('barpos_sessions'); window.location.reload(); } }} className="bg-red-600 text-white px-8 py-4 rounded-2xl font-black shadow-xl shadow-red-200">WIS ALLE DATA</button>
            </div>
          </div>
        )}
      </main>

      {/* OVERLAYS */}
      {pendingCardPayment && (
        <div className="fixed inset-0 z-[300] bg-slate-900/95 flex items-center justify-center p-4 backdrop-blur-md">
          <div className="bg-white p-12 rounded-[50px] text-center max-w-sm w-full shadow-2xl">
            <div className="w-24 h-24 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center mx-auto mb-6 animate-pulse shadow-inner"><CreditCard size={48}/></div>
            <h2 className="text-5xl font-black mb-10 tracking-tighter text-slate-900">€{cart.reduce((a,b) => a + (b.price*b.quantity), 0).toFixed(2)}</h2>
            <button onClick={() => finalizePayment(PaymentMethod.CARD)} className="w-full bg-blue-600 text-white py-6 rounded-3xl font-black text-2xl shadow-xl active:scale-95 transition-all">CONTROLE KAART OK</button>
            <button onClick={() => setPendingCardPayment(false)} className="mt-4 text-slate-400 font-black uppercase text-xs tracking-widest">Annuleren</button>
          </div>
        </div>
      )}

      {(previewTransaction || viewingSession) && (
        <div className="fixed inset-0 z-[200] bg-black/80 flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-white p-10 rounded-[50px] max-w-sm w-full shadow-2xl overflow-y-auto max-h-[90vh] relative border-8 border-slate-100">
            <button onClick={() => {setPreviewTransaction(null); setViewingSession(null);}} className="absolute top-4 right-4 bg-slate-50 p-2 rounded-full text-slate-300"><X size={20}/></button>
            <Receipt transaction={previewTransaction} sessionSummary={viewingSession} company={company} />
            <button onClick={() => {setPreviewTransaction(null); setViewingSession(null);}} className="w-full mt-10 bg-slate-900 text-white py-5 rounded-3xl font-black uppercase tracking-widest">SLUITEN</button>
          </div>
        </div>
      )}
    </div>
  );
}
