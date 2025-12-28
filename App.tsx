import React, { useState, useEffect, useMemo, useRef } from 'react';
import { 
  ShoppingBag, Trash2, CreditCard, Banknote, History, BarChart3, 
  Settings, Printer, Sparkles, Plus, Minus, Edit2, X, RotateCcw, 
  Unlock, CheckCircle, Lock, User, Users, ChevronDown, Clock, 
  Download, Eye, Bluetooth, AlertTriangle, Loader2, PlayCircle, 
  ArrowRight, UserPlus, Globe, FileText 
} from 'lucide-react';
import { Product, CartItem, Transaction, PaymentMethod, CompanyDetails, SalesSession } from './types';
import { DEFAULT_COMPANY, INITIAL_PRODUCTS } from './constants';
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
  const [isConnectingBt, setIsConnectingBt] = useState(false);
  const [newSalesmanName, setNewSalesmanName] = useState('');
  const [startFloatAmount, setStartFloatAmount] = useState<string>('0');

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
      setCurrentSession(parsed.find(s => s.status === 'OPEN') || null);
    }
  }, []);

  useEffect(() => {
    localStorage.setItem('barpos_transactions', JSON.stringify(transactions));
    localStorage.setItem('barpos_products', JSON.stringify(products));
    localStorage.setItem('barpos_sessions', JSON.stringify(sessions));
    localStorage.setItem('barpos_company', JSON.stringify(company));
  }, [transactions, products, sessions, company]);

  // --- POS Logica ---
  const addToCart = (product: Product) => {
    setCart(prev => {
      const existing = prev.find(item => item.id === product.id);
      if (existing) return prev.map(item => item.id === product.id ? { ...item, quantity: item.quantity + 1 } : item);
      return [...prev, { ...product, quantity: 1 }];
    });
  };

  const updateQuantity = (id: string, delta: number) => {
    setCart(prev => prev.map(item => item.id === id ? { ...item, quantity: item.quantity + delta } : item));
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

  // --- Sessie Beheer ---
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

  const handlePrintSession = async (session: SalesSession) => {
    const fullSession = session.status === 'OPEN' 
      ? { ...session, summary: calculateSessionTotals(session.id, session.startCash).summary } 
      : session;
    
    if (btConnected) {
      await btPrinterService.printSessionReport(fullSession, company);
    } else {
      setViewingSession(fullSession);
    }
  };

  const processPayment = async (method: PaymentMethod) => {
    if (cart.length === 0 || !currentSession) return;
    const shouldPrint = window.confirm("Ticket afdrukken?");
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
    setTransactions(prev => [newTx, ...prev]);
    setCart([]);
    if (shouldPrint) {
      if (btConnected) await btPrinterService.printReceipt(newTx, company);
      else setPreviewTransaction(newTx);
    }
  };

  return (
    <div className="min-h-screen flex flex-col md:flex-row bg-slate-50">
      <nav className="bg-slate-900 text-white w-full md:w-20 flex md:flex-col items-center py-4 z-50">
        <button onClick={() => setActiveTab('POS')} className={`p-3 rounded-xl mb-4 ${activeTab === 'POS' ? 'bg-amber-500' : ''}`}><ShoppingBag /></button>
        <button onClick={() => setActiveTab('REPORTS')} className={`p-3 rounded-xl mb-4 ${activeTab === 'REPORTS' ? 'bg-amber-500' : ''}`}><BarChart3 /></button>
        <button onClick={() => setActiveTab('SETTINGS')} className={`p-3 rounded-xl ${activeTab === 'SETTINGS' ? 'bg-amber-500' : ''}`}><Settings /></button>
      </nav>

      <main className="flex-1 flex flex-col overflow-hidden">
        {activeTab === 'POS' && (
          <div className="flex-1 flex flex-col md:flex-row overflow-hidden">
            <div className="flex-1 p-4 grid grid-cols-2 sm:grid-cols-4 gap-3 overflow-y-auto">
              {products.map(p => (
                <button key={p.id} onClick={() => addToCart(p)} className={`${p.color} p-4 rounded-2xl font-bold shadow-sm active:scale-95 transition-all`}>
                  {p.name}<br/>€{p.price.toFixed(2)}
                </button>
              ))}
            </div>
            <div className="w-full md:w-96 bg-white border-l flex flex-col shadow-xl">
              <div className="p-4 border-b font-black flex justify-between items-center">WINKELWAGEN</div>
              <div className="flex-1 overflow-y-auto p-2">
                {cart.map(item => (
                  <div key={item.id} className="flex items-center justify-between p-2 border-b">
                    <div className="flex items-center gap-2">
                      <button onClick={() => updateQuantity(item.id, -1)} className="p-1 bg-slate-100 rounded"><Minus size={14}/></button>
                      <span className="font-bold w-4 text-center">{item.quantity}</span>
                      <button onClick={() => updateQuantity(item.id, 1)} className="p-1 bg-slate-100 rounded"><Plus size={14}/></button>
                    </div>
                    <span className="flex-1 px-3 text-sm">{item.name}</span>
                    <span className="font-bold">€{(item.price * item.quantity).toFixed(2)}</span>
                  </div>
                ))}
              </div>
              <div className="p-4 bg-slate-900 text-white rounded-t-3xl">
                <div className="flex justify-between text-2xl font-black mb-4"><span>TOTAAL</span><span>€{cartTotals.total.toFixed(2)}</span></div>
                <div className="grid grid-cols-2 gap-3">
                  <button onClick={() => processPayment(PaymentMethod.CASH)} className="bg-green-600 p-4 rounded-2xl font-bold flex items-center justify-center gap-2"><Banknote size={20}/> CASH</button>
                  <button onClick={() => processPayment(PaymentMethod.CARD)} className="bg-blue-600 p-4 rounded-2xl font-bold flex items-center justify-center gap-2"><CreditCard size={20}/> CARD</button>
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'REPORTS' && (
          <div className="p-6 overflow-y-auto h-full">
            <h2 className="text-2xl font-black mb-6">Sessie Rapporten</h2>
            <div className="space-y-4">
              {sessions.slice().reverse().map(s => (
                <div key={s.id} className="bg-white p-5 rounded-2xl border shadow-sm flex items-center justify-between">
                  <div>
                    <div className="font-bold">{new Date(s.startTime).toLocaleDateString()} - {s.status === 'OPEN' ? 'Huidige Sessie' : 'Gesloten'}</div>
                    <div className="text-sm text-slate-500">ID: {s.id.slice(-6)} | Start: {new Date(s.startTime).toLocaleTimeString()}</div>
                  </div>
                  <div className="flex gap-2">
                    <button onClick={() => handlePrintSession(s)} className="p-3 bg-slate-100 rounded-xl hover:bg-slate-200 text-slate-700 flex items-center gap-2 font-bold">
                      <Printer size={18}/> Rapport
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {activeTab === 'SETTINGS' && (
          <div className="p-6 overflow-y-auto h-full space-y-8">
            <div className="bg-white p-6 rounded-3xl border shadow-sm">
              <h3 className="font-bold mb-4 flex items-center gap-2"><Bluetooth className="text-blue-500"/> Printer Verbinding</h3>
              <button onClick={async () => { setIsConnectingBt(true); setBtConnected(await btPrinterService.connect()); setIsConnectingBt(false); }}
                className={`px-6 py-3 rounded-xl font-bold ${btConnected ? 'bg-green-100 text-green-700' : 'bg-blue-600 text-white'}`}>
                {isConnectingBt ? 'Verbinden...' : btConnected ? 'Printer Verbonden' : 'Verbind Bluetooth Printer'}
              </button>
            </div>
            <div className="bg-white p-6 rounded-3xl border shadow-sm">
              <h3 className="font-bold mb-4">Sessie Beheer</h3>
              {!currentSession ? (
                <div className="flex gap-3">
                  <input type="number" value={startFloatAmount} onChange={e => setStartFloatAmount(e.target.value)} className="border p-3 rounded-xl w-32" placeholder="Startkas" />
                  <button onClick={() => {
                    const s: SalesSession = { id: Date.now().toString(), startTime: Date.now(), startCash: parseFloat(startFloatAmount) || 0, status: 'OPEN' };
                    setSessions([...sessions, s]); setCurrentSession(s);
                  }} className="bg-amber-500 px-6 py-3 rounded-xl font-bold text-white">Open Kassa</button>
                </div>
              ) : (
                <button onClick={() => {
                  if(window.confirm("Sessie definitief sluiten?")) {
                    const {summary, expectedDrawer} = calculateSessionTotals(currentSession.id, currentSession.startCash);
                    const closed = {...currentSession, status: 'CLOSED' as const, summary, endTime: Date.now(), expectedCash: expectedDrawer};
                    setSessions(sessions.map(s => s.id === currentSession.id ? closed : s)); setCurrentSession(null);
                  }
                }} className="bg-red-500 text-white px-6 py-3 rounded-xl font-bold">Sessie Sluiten & Opslaan</button>
              )}
            </div>
          </div>
        )}
      </main>

      {previewTransaction && (
        <div className="fixed inset-0 z-[200] bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white p-6 rounded-3xl max-w-sm w-full shadow-2xl overflow-y-auto max-h-[90vh]">
            <Receipt transaction={previewTransaction} company={company} />
            <button onClick={() => setPreviewTransaction(null)} className="w-full mt-4 bg-slate-900 text-white py-3 rounded-xl font-bold uppercase tracking-wider">Sluiten</button>
          </div>
        </div>
      )}

      {viewingSession && (
        <div className="fixed inset-0 z-[200] bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white p-6 rounded-3xl max-w-sm w-full shadow-2xl overflow-y-auto max-h-[90vh]">
            <Receipt sessionSummary={viewingSession} company={company} />
            <button onClick={() => setViewingSession(null)} className="w-full mt-4 bg-slate-900 text-white py-3 rounded-xl font-bold uppercase tracking-wider">Sluiten</button>
          </div>
        </div>
      )}
    </div>
  );
}
