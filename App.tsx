import React, { useState, useEffect, useMemo } from 'react';
import { 
  ShoppingBag, Trash2, CreditCard, Banknote, BarChart3, 
  Settings, Printer, Plus, Minus, X, Building, Tag, User, Phone, Mail, Landmark, Palette
} from 'lucide-react';
import { Product, CartItem, Transaction, PaymentMethod, CompanyDetails, SalesSession } from './types';
import { DEFAULT_COMPANY, INITIAL_PRODUCTS } from './constants';
import { Receipt } from './components/Receipt.tsx';

const COLOR_OPTIONS = [
  { name: 'Amber', class: 'bg-amber-100 border-amber-200 text-amber-900' },
  { name: 'Blauw', class: 'bg-blue-100 border-blue-200 text-blue-900' },
  { name: 'Groen', class: 'bg-emerald-100 border-emerald-200 text-emerald-900' },
  { name: 'Rose', class: 'bg-rose-100 border-rose-200 text-rose-900' },
  { name: 'Indigo', class: 'bg-indigo-100 border-indigo-200 text-indigo-900' },
  { name: 'Slate', class: 'bg-slate-100 border-slate-200 text-slate-900' },
];

export default function App() {
  const [products, setProducts] = useState<Product[]>(INITIAL_PRODUCTS);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [sessions, setSessions] = useState<SalesSession[]>([]);
  const [company, setCompany] = useState<CompanyDetails>({
    ...DEFAULT_COMPANY,
    addressLine2: '',
    phone: '',
    email: '',
    iban: '',
    sellers: ['Beheerder']
  });
  const [selectedSeller, setSelectedSeller] = useState('Beheerder');
  const [activeTab, setActiveTab] = useState<'POS' | 'REPORTS' | 'SETTINGS'>('POS');
  const [currentSession, setCurrentSession] = useState<SalesSession | null>(null);
  const [previewTransaction, setPreviewTransaction] = useState<Transaction | null>(null);
  const [viewingSession, setViewingSession] = useState<SalesSession | null>(null);
  const [pendingCardPayment, setPendingCardPayment] = useState(false);
  const [startFloatAmount, setStartFloatAmount] = useState<string>('0');

  // --- Persistence ---
  useEffect(() => {
    const saved = localStorage.getItem('barpos_v3_data');
    if (saved) {
      const d = JSON.parse(saved);
      setProducts(d.products);
      setTransactions(d.transactions);
      setSessions(d.sessions);
      setCompany(d.company);
    }
  }, []);

  useEffect(() => {
    localStorage.setItem('barpos_v3_data', JSON.stringify({ products, transactions, sessions, company }));
  }, [products, transactions, sessions, company]);

  const cartTotal = useMemo(() => cart.reduce((a, b) => a + (b.price * b.quantity), 0), [cart]);

  const addToCart = (product: Product) => {
    if (!currentSession) { alert("⚠️ Open eerst de kassa!"); setActiveTab('SETTINGS'); return; }
    setCart(prev => {
      const ex = prev.find(i => i.id === product.id);
      if (ex) return prev.map(i => i.id === product.id ? { ...i, quantity: i.quantity + 1 } : i);
      return [...prev, { ...product, quantity: 1 }];
    });
  };

  const finalizePayment = (method: PaymentMethod) => {
    const newTx: Transaction = {
      id: `TR-${Date.now().toString().slice(-4)}`,
      sessionId: currentSession!.id,
      timestamp: Date.now(),
      dateStr: new Date().toLocaleDateString('nl-NL'),
      items: [...cart],
      total: cartTotal,
      paymentMethod: method,
      seller: selectedSeller,
      vat21: cartTotal * 0.21 // Vereenvoudigde berekening
    };
    setTransactions([newTx, ...transactions]);
    setCart([]);
    setPendingCardPayment(false);
    setPreviewTransaction(newTx);
  };

  return (
    <div className="fixed inset-0 flex flex-col bg-slate-50 text-slate-900 font-sans overflow-hidden">
      
      {/* MENU BOVENAAN */}
      <header className="h-16 bg-white border-b flex items-center justify-between px-4 z-[100] shrink-0">
        <div className="flex items-center gap-2">
          <div className="bg-slate-900 text-white p-1.5 rounded-lg"><ShoppingBag size={18}/></div>
          <span className="font-black text-sm tracking-tighter">BAR POS</span>
        </div>
        <nav className="flex bg-slate-100 p-1 rounded-xl">
          <button onClick={() => setActiveTab('POS')} className={`px-4 py-1.5 rounded-lg font-black text-[10px] uppercase transition-all ${activeTab === 'POS' ? 'bg-white shadow-sm text-amber-500' : 'text-slate-400'}`}>Kassa</button>
          <button onClick={() => setActiveTab('REPORTS')} className={`px-4 py-1.5 rounded-lg font-black text-[10px] uppercase transition-all ${activeTab === 'REPORTS' ? 'bg-white shadow-sm text-amber-500' : 'text-slate-400'}`}>Rapport</button>
          <button onClick={() => setActiveTab('SETTINGS')} className={`px-4 py-1.5 rounded-lg font-black text-[10px] uppercase transition-all ${activeTab === 'SETTINGS' ? 'bg-white shadow-sm text-amber-500' : 'text-slate-400'}`}>Instellingen</button>
        </nav>
      </header>

      <main className="flex-1 relative overflow-hidden">
        
        {/* KASSA SCHERM */}
        {activeTab === 'POS' && (
          <div className="flex flex-col md:flex-row h-full">
            <div className="flex-1 p-3 grid grid-cols-2 sm:grid-cols-4 gap-2 overflow-y-auto content-start pb-20">
              {products.map(p => (
                <button key={p.id} onClick={() => addToCart(p)} className={`${p.color} p-4 rounded-[1.5rem] font-black shadow-sm flex flex-col items-center justify-center min-h-[100px] border-b-4 border-black/5 active:scale-95 transition-all`}>
                  <span className="text-[10px] uppercase text-center leading-tight mb-1">{p.name}</span>
                  <span className="text-xs bg-white/40 px-2 py-0.5 rounded-full">€{p.price.toFixed(2)}</span>
                </button>
              ))}
            </div>
            
            <div className="w-full md:w-[360px] bg-white border-t md:border-l flex flex-col h-[40%] md:h-full z-10 shadow-2xl">
              <div className="p-3 bg-slate-50 border-b flex justify-between items-center">
                <select value={selectedSeller} onChange={(e) => setSelectedSeller(e.target.value)} className="bg-transparent font-black text-[10px] uppercase text-amber-600 outline-none">
                  {company.sellers?.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
                <span className="font-black text-[10px] text-slate-300 uppercase italic">Kassa {currentSession ? 'Open' : 'Dicht'}</span>
              </div>
              <div className="flex-1 overflow-y-auto p-3 space-y-2">
                {cart.map(item => (
                  <div key={item.id} className="flex justify-between items-center p-2 bg-slate-50 rounded-xl">
                    <span className="font-black text-[10px] uppercase truncate flex-1 pr-2">{item.name}</span>
                    <div className="flex items-center gap-2">
                      <button onClick={() => {
                        setCart(cart.map(i => i.id === item.id ? {...i, quantity: i.quantity - 1} : i).filter(i => i.quantity > 0))
                      }} className="w-6 h-6 flex items-center justify-center bg-white rounded shadow text-red-500 font-bold">-</button>
                      <span className="font-black text-xs min-w-[15px] text-center">{item.quantity}</span>
                      <button onClick={() => {
                        setCart(cart.map(i => i.id === item.id ? {...i, quantity: i.quantity + 1} : i))
                      }} className="w-6 h-6 flex items-center justify-center bg-white rounded shadow text-green-500 font-bold">+</button>
                    </div>
                    <span className="font-black text-xs ml-3 w-16 text-right">€{(item.price * item.quantity).toFixed(2)}</span>
                  </div>
                ))}
              </div>
              <div className="p-4 bg-slate-900 text-white">
                <div className="flex justify-between text-2xl font-black mb-4 italic tracking-tighter">
                  <span className="text-slate-500 text-xs self-center uppercase tracking-widest">Totaal</span>
                  <span className="text-amber-500">€{cartTotal.toFixed(2)}</span>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <button onClick={() => finalizePayment(PaymentMethod.CASH)} className="bg-green-600 p-4 rounded-xl font-black text-xs flex flex-col items-center gap-1 uppercase tracking-widest"><Banknote size={18}/> Cash</button>
                  <button onClick={() => setPendingCardPayment(true)} className="bg-blue-600 p-4 rounded-xl font-black text-xs flex flex-col items-center gap-1 uppercase tracking-widest"><CreditCard size={18}/> Kaart</button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* INSTELLINGEN SCHERM */}
        {activeTab === 'SETTINGS' && (
          <div className="absolute inset-0 bg-slate-50 overflow-y-auto p-4 space-y-6 pb-24">
            
            {/* BEDRIJF */}
            <div className="bg-white p-6 rounded-[2rem] shadow-sm border space-y-4">
              <h3 className="font-black text-[10px] text-slate-400 uppercase tracking-widest flex items-center gap-2 mb-2"><Building size={14}/> Bedrijfsgegevens</h3>
              <div className="grid grid-cols-1 gap-4">
                <div className="border-b focus-within:border-amber-500 transition-all">
                  <label className="text-[9px] font-black text-slate-400 uppercase">Naam Zaak</label>
                  <input className="w-full py-1 bg-transparent font-bold outline-none" value={company.name} onChange={e => setCompany({...company, name: e.target.value})} />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="border-b">
                    <label className="text-[9px] font-black text-slate-400 uppercase">Straat + Nr</label>
                    <input className="w-full py-1 bg-transparent font-bold outline-none" value={company.address} onChange={e => setCompany({...company, address: e.target.value})} />
                  </div>
                  <div className="border-b">
                    <label className="text-[9px] font-black text-slate-400 uppercase">Stad + Postcode</label>
                    <input className="w-full py-1 bg-transparent font-bold outline-none" value={company.addressLine2} onChange={e => setCompany({...company, addressLine2: e.target.value})} />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="border-b">
                    <label className="text-[9px] font-black text-slate-400 uppercase">BTW Nummer</label>
                    <input className="w-full py-1 bg-transparent font-bold outline-none" value={company.vatNumber} onChange={e => setCompany({...company, vatNumber: e.target.value})} />
                  </div>
                  <div className="border-b">
                    <label className="text-[9px] font-black text-slate-400 uppercase">Telefoon</label>
                    <input className="w-full py-1 bg-transparent font-bold outline-none" value={company.phone} onChange={e => setCompany({...company, phone: e.target.value})} />
                  </div>
                </div>
                <div className="border-b">
                  <label className="text-[9px] font-black text-slate-400 uppercase">IBAN / Bankrekening</label>
                  <input className="w-full py-1 bg-transparent font-bold outline-none text-xs" value={company.iban} onChange={e => setCompany({...company, iban: e.target.value})} />
                </div>
              </div>
            </div>

            {/* VERKOPERS BEHEER */}
            <div className="bg-white p-6 rounded-[2rem] shadow-sm border">
               <h3 className="font-black text-[10px] text-slate-400 uppercase tracking-widest flex items-center gap-2 mb-4"><User size={14}/> Verkopers</h3>
               <div className="flex flex-wrap gap-2 mb-4">
                 {company.sellers?.map(s => (
                   <span key={s} className="bg-slate-100 text-[10px] font-black px-3 py-1.5 rounded-full flex items-center gap-2">
                     {s} <button onClick={() => setCompany({...company, sellers: company.sellers?.filter(x => x !== s)})} className="text-red-500"><X size={12}/></button>
                   </span>
                 ))}
               </div>
               <div className="flex gap-2">
                 <input id="seller-in" className="flex-1 bg-slate-50 p-3 rounded-xl font-bold text-xs outline-none" placeholder="Nieuwe naam..." />
                 <button onClick={() => {
                   const el = document.getElementById('seller-in') as HTMLInputElement;
                   if(el.value) { setCompany({...company, sellers: [...(company.sellers || []), el.value]}); el.value = ''; }
                 }} className="bg-slate-900 text-white px-4 rounded-xl font-black text-[10px]">VOEG TOE</button>
               </div>
            </div>

            {/* PRODUCTEN BEHEER */}
            <div className="bg-white p-6 rounded-[2rem] shadow-sm border space-y-4">
               <div className="flex justify-between items-center">
                 <h3 className="font-black text-[10px] text-slate-400 uppercase tracking-widest flex items-center gap-2"><Tag size={14}/> Producten</h3>
                 <button onClick={() => setProducts([...products, { id: Date.now().toString(), name: 'NIEUW PRODUCT', price: 0, vatRate: 21, color: 'bg-slate-100', stock: 100 }])} className="text-[9px] bg-slate-900 text-white px-3 py-1 rounded-lg font-black">+ PRODUCT</button>
               </div>
               <div className="space-y-3">
                 {products.map(p => (
                   <div key={p.id} className="p-4 bg-slate-50 rounded-2xl border border-slate-100 space-y-3">
                      <div className="flex gap-2">
                        <input className="flex-1 bg-transparent font-black uppercase text-xs outline-none border-b border-slate-200" value={p.name} onChange={e => setProducts(products.map(x => x.id === p.id ? {...x, name: e.target.value} : x))} />
                        <button onClick={() => setProducts(products.filter(x => x.id !== p.id))} className="text-red-300"><Trash2 size={16}/></button>
                      </div>
                      <div className="flex flex-wrap items-center gap-3">
                        {/* Prijs */}
                        <div className="flex items-center gap-1 bg-white px-2 py-1 rounded-lg border">
                          <span className="text-[10px] font-black text-slate-300">€</span>
                          <input type="number" className="w-14 font-black text-xs outline-none" value={p.price} onChange={e => setProducts(products.map(x => x.id === p.id ? {...x, price: parseFloat(e.target.value)} : x))} />
                        </div>
                        {/* BTW */}
                        <div className="flex gap-1 bg-white p-1 rounded-lg border">
                          {[0, 6, 12, 21].map(v => (
                            <button key={v} onClick={() => setProducts(products.map(x => x.id === p.id ? {...x, vatRate: v} : x))} className={`px-2 py-1 rounded text-[9px] font-black transition-all ${p.vatRate === v ? 'bg-amber-500 text-white' : 'text-slate-300'}`}>{v}%</button>
                          ))}
                        </div>
                        {/* Kleur */}
                        <div className="flex gap-1">
                          {COLOR_OPTIONS.map(c => (
                            <button key={c.name} onClick={() => setProducts(products.map(x => x.id === p.id ? {...x, color: c.class} : x))} className={`w-5 h-5 rounded-full border-2 ${c.class} ${p.color === c.class ? 'ring-2 ring-slate-900' : ''}`}></button>
                          ))}
                        </div>
                      </div>
                   </div>
                 ))}
               </div>
            </div>

            {/* KASSA SESSIE */}
            <div className="bg-slate-900 p-8 rounded-[2.5rem] text-white text-center shadow-xl">
               {!currentSession ? (
                 <div className="space-y-4">
                   <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Kassa Startbedrag</p>
                   <input type="number" value={startFloatAmount} onChange={e => setStartFloatAmount(e.target.value)} className="w-full bg-white/10 p-4 rounded-2xl font-black text-3xl text-center outline-none" placeholder="0.00" />
                   <button onClick={() => {
                     const s = { id: Date.now().toString(), startTime: Date.now(), startCash: parseFloat(startFloatAmount) || 0, status: 'OPEN' as const };
                     setSessions([...sessions, s]); setCurrentSession(s); setActiveTab('POS');
                   }} className="w-full bg-amber-500 py-4 rounded-2xl font-black text-sm uppercase tracking-widest">Open Kassa</button>
                 </div>
               ) : (
                 <button onClick={() => {
                   if(window.confirm("Kassa afsluiten en dagrapport genereren?")) {
                     const res = sessions.map(s => s.id === currentSession.id ? {...s, status: 'CLOSED' as const, endTime: Date.now()} : s);
                     setSessions(res as SalesSession[]); setCurrentSession(null);
                   }
                 }} className="w-full bg-red-500 py-4 rounded-2xl font-black text-sm uppercase tracking-widest">Sluit Kassa & Rapport</button>
               )}
            </div>
          </div>
        )}

        {/* RAPPORTEN SCHERM */}
        {activeTab === 'REPORTS' && (
          <div className="absolute inset-0 bg-slate-50 overflow-y-auto p-4 space-y-3">
            <h2 className="font-black text-xl mb-4 italic">Dagrapporten</h2>
            {sessions.slice().reverse().map(s => (
              <div key={s.id} className="bg-white p-5 rounded-[1.5rem] border flex items-center justify-between shadow-sm">
                 <div>
                   <div className="font-black text-sm">{new Date(s.startTime).toLocaleDateString('nl-NL')}</div>
                   <div className="text-[9px] font-black text-slate-300 uppercase">{s.status === 'OPEN' ? '🟢 Actief' : '🔴 Gesloten'}</div>
                 </div>
                 <button onClick={() => setViewingSession(s)} className="bg-slate-900 text-white px-4 py-2 rounded-xl text-[10px] font-black uppercase">Bekijk</button>
              </div>
            ))}
          </div>
        )}
      </main>

      {/* MODALS */}
      {(previewTransaction || viewingSession) && (
        <div className="fixed inset-0 z-[200] bg-black/80 flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-white p-6 rounded-[2.5rem] w-full max-w-sm max-h-[85vh] overflow-y-auto">
            <Receipt transaction={previewTransaction} sessionSummary={viewingSession} company={company} />
            <div className="mt-6 space-y-2">
              <button onClick={() => window.print()} className="w-full bg-slate-900 text-white py-4 rounded-xl font-black uppercase text-xs flex items-center justify-center gap-2"><Printer size={16}/> Printen</button>
              <button onClick={() => {setPreviewTransaction(null); setViewingSession(null);}} className="w-full bg-slate-100 text-slate-400 py-4 rounded-xl font-black uppercase text-[10px]">Sluiten</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
