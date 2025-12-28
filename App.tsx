import React, { useState, useEffect, useMemo, useRef } from 'react';
import { 
  ShoppingBag, Trash2, CreditCard, Banknote, History, BarChart3, 
  Settings, Printer, Plus, Minus, Edit2, X, RotateCcw, CheckCircle, 
  Users, User, Bluetooth, Loader2, Download, PlayCircle, Lock, Unlock,
  ChevronDown, Clock, ArrowRight, UserPlus
} from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { Product, CartItem, Transaction, PaymentMethod, CompanyDetails, DailySummary, CashEntry, SalesSession } from './types';
import { DEFAULT_COMPANY, INITIAL_PRODUCTS, AVAILABLE_COLORS } from './constants';
import { Receipt } from './components/Receipt.tsx';
import { generateDailyInsight } from './services/geminiService';
import { btPrinterService } from './services/bluetoothPrinter';

export default function App() {
  // --- State ---
  const [products, setProducts] = useState<Product[]>(INITIAL_PRODUCTS);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [cashEntries, setCashEntries] = useState<CashEntry[]>([]);
  const [sessions, setSessions] = useState<SalesSession[]>([]);
  const [company, setCompany] = useState<CompanyDetails>(DEFAULT_COMPANY);
  const [activeTab, setActiveTab] = useState<'POS' | 'REPORTS' | 'SETTINGS'>('POS');

  // --- Transient State ---
  const [currentSession, setCurrentSession] = useState<SalesSession | null>(null);
  const [lastTransaction, setLastTransaction] = useState<Transaction | null>(null);
  const [aiInsight, setAiInsight] = useState<string>('');
  const [isLoadingAi, setIsLoadingAi] = useState(false);
  const [autoPrint, setAutoPrint] = useState<boolean>(true);
  const [showSuccess, setShowSuccess] = useState(false);
  const [pendingCardPayment, setPendingCardPayment] = useState(false);
  const [previewTransaction, setPreviewTransaction] = useState<Transaction | null>(null);
  const [showSalesmanSelection, setShowSalesmanSelection] = useState(false);
  const [showRecentTransactions, setShowRecentTransactions] = useState(false);
  const [viewingSession, setViewingSession] = useState<SalesSession | null>(null);

  // --- Bluetooth State ---
  const [btConnected, setBtConnected] = useState(false);
  const [isConnectingBt, setIsConnectingBt] = useState(false);
  const [isPrintingBt, setIsPrintingBt] = useState(false);

  // --- Forms State ---
  const [cashAmount, setCashAmount] = useState<string>('');
  const [cashReason, setCashReason] = useState<string>('');
  const [startFloatAmount, setStartFloatAmount] = useState<string>('0');
  const [endCountAmount, setEndCountAmount] = useState<string>('');
  const [newSalesmanName, setNewSalesmanName] = useState('');

  // --- Logic: Session & Totals ---
  const calculateSessionTotals = (sessionId: string, startCash: number) => {
    const sessionTx = transactions.filter(t => t.sessionId === sessionId);
    const productSales: Record<string, number> = {};
    
    const summary = sessionTx.reduce((acc, tx) => {
      tx.items.forEach(item => {
        productSales[item.name] = (productSales[item.name] || 0) + item.quantity;
      });
      return {
        totalSales: acc.totalSales + tx.total,
        transactionCount: acc.transactionCount + 1,
        cashTotal: acc.cashTotal + (tx.paymentMethod === PaymentMethod.CASH ? tx.total : 0),
        cardTotal: acc.cardTotal + (tx.paymentMethod === PaymentMethod.CARD ? tx.total : 0),
        vat0Total: acc.vat0Total + tx.vat0,
        vat21Total: acc.vat21Total + tx.vat21,
      };
    }, { totalSales: 0, transactionCount: 0, cashTotal: 0, cardTotal: 0, vat0Total: 0, vat21Total: 0 });

    const movements = cashEntries.filter(e => e.sessionId === sessionId)
      .reduce((acc, e) => acc + (e.type === 'IN' ? e.amount : -e.amount), 0);

    return { summary: { ...summary, productSales }, expectedDrawer: startCash + summary.cashTotal + movements };
  };

  // --- Persistence ---
  useEffect(() => {
    const savedTx = localStorage.getItem('barpos_transactions');
    const savedProducts = localStorage.getItem('barpos_products');
    const savedSessions = localStorage.getItem('barpos_sessions');
    if (savedTx) setTransactions(JSON.parse(savedTx));
    if (savedProducts) setProducts(JSON.parse(savedProducts));
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
  }, [transactions, products, sessions]);

  // --- POS Actions ---
  const addToCart = (product: Product) => {
    setCart(prev => {
      const existing = prev.find(item => item.id === product.id);
      if (existing) return prev.map(item => item.id === product.id ? { ...item, quantity: item.quantity + 1 } : item);
      return [...prev, { ...product, quantity: 1 }];
    });
  };

  const updateQuantity = (id: string, delta: number) => {
    setCart(prev => prev.map(item => 
      item.id === id ? { ...item, quantity: item.quantity + delta } : item
    ));
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

  const processPayment = async (method: PaymentMethod) => {
    if (cart.length === 0 || !currentSession) return;
    const shouldPrint = window.confirm("Verkoop registreren. Ticket afdrukken?");

    const newTx: Transaction = {
      id: `AM${new Date().getFullYear()}-${Date.now().toString().slice(-4)}`,
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
    setShowSuccess(true);
    setTimeout(() => setShowSuccess(false), 2000);

    if (shouldPrint) {
      if (btConnected) {
        setIsPrintingBt(true);
        try { await btPrinterService.printReceipt(newTx, company); }
        catch (e) { setPreviewTransaction(newTx); }
        finally { setIsPrintingBt(false); }
      } else {
        setPreviewTransaction(newTx);
      }
    }
  };

  return (
    <div className="min-h-screen flex flex-col md:flex-row bg-slate-50">
      {/* Sidebar Nav */}
      <nav className="bg-slate-900 text-white w-full md:w-20 flex md:flex-col items-center py-4 z-50">
        <button onClick={() => setActiveTab('POS')} className={`p-3 rounded-xl mb-4 ${activeTab === 'POS' ? 'bg-amber-500' : ''}`}><ShoppingBag /></button>
        <button onClick={() => setActiveTab('REPORTS')} className={`p-3 rounded-xl mb-4 ${activeTab === 'REPORTS' ? 'bg-amber-500' : ''}`}><BarChart3 /></button>
        <button onClick={() => setActiveTab('SETTINGS')} className={`p-3 rounded-xl ${activeTab === 'SETTINGS' ? 'bg-amber-500' : ''}`}><Settings /></button>
      </nav>

      <main className="flex-1 flex flex-col overflow-hidden">
        {/* POS TAB */}
        {activeTab === 'POS' && (
          <div className="flex-1 flex flex-col md:flex-row overflow-hidden">
            <div className="flex-1 p-4 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 overflow-y-auto">
              {products.map(p => (
                <button key={p.id} onClick={() => addToCart(p)} className={`${p.color} p-4 rounded-2xl shadow-sm hover:shadow-md transition-all active:scale-95 flex flex-col items-center justify-center min-h-[100px]`}>
                  <span className="font-bold text-slate-800 text-center">{p.name}</span>
                  <span className="text-sm font-black mt-1">€{p.price.toFixed(2)}</span>
                </button>
              ))}
            </div>
            <div className="w-full md:w-96 bg-white border-l flex flex-col shadow-xl">
               <div className="p-4 border-b flex justify-between items-center bg-slate-50 font-black">TICKET</div>
               <div className="flex-1 overflow-y-auto p-2">
                 {cart.map(item => (
                   <div key={item.id} className="flex items-center justify-between p-2 border-b">
                     <div className="flex items-center gap-2">
                       <button onClick={() => updateQuantity(item.id, -1)} className="p-1 bg-slate-100 rounded"><Minus size={14}/></button>
                       <span className="font-bold">{item.quantity}</span>
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
                   <button onClick={() => processPayment(PaymentMethod.CASH)} className="bg-green-600 p-4 rounded-2xl font-bold">CASH</button>
                   <button onClick={() => processPayment(PaymentMethod.CARD)} className="bg-blue-600 p-4 rounded-2xl font-bold">CARD</button>
                 </div>
               </div>
            </div>
          </div>
        )}

        {/* REPORTS TAB */}
        {activeTab === 'REPORTS' && (
          <div className="p-6 overflow-y-auto h-full">
            <h2 className="text-2xl font-black mb-6">Rapporten & Sessies</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
              <div className="bg-white p-6 rounded-3xl shadow-sm border">
                <h3 className="font-bold mb-4">Huidige Sessie</h3>
                {currentSession ? (
                  <div>
                    <p className="text-sm text-slate-500">Gestart om: {new Date(currentSession.startTime).toLocaleString()}</p>
                    <button onClick={() => {
                       const {summary} = calculateSessionTotals(currentSession.id, currentSession.startCash);
                       setViewingSession({...currentSession, summary});
                    }} className="mt-4 w-full bg-slate-100 py-3 rounded-xl font-bold">Bekijk Tussentijds Rapport</button>
                  </div>
                ) : <p>Geen actieve sessie. Open de kassa in instellingen.</p>}
              </div>
            </div>
            <div className="bg-white rounded-3xl border overflow-hidden">
               <table className="w-full text-left">
                 <thead className="bg-slate-50 font-bold">
                   <tr><th className="p-4">Datum</th><th className="p-4">Omzet</th><th className="p-4">Status</th></tr>
                 </thead>
                 <tbody>
                   {sessions.slice().reverse().map(s => (
                     <tr key={s.id} className="border-t">
                       <td className="p-4">{new Date(s.startTime).toLocaleDateString()}</td>
                       <td className="p-4">€{s.summary?.totalSales.toFixed(2) || '0.00'}</td>
                       <td className="p-4">{s.status}</td>
                     </tr>
                   ))}
                 </tbody>
               </table>
            </div>
          </div>
        )}

        {/* SETTINGS TAB */}
        {activeTab === 'SETTINGS' && (
          <div className="p-6 overflow-y-auto h-full">
            <h2 className="text-2xl font-black mb-6">Instellingen</h2>
            <div className="space-y-6">
              <div className="bg-white p-6 rounded-3xl border">
                <h3 className="font-bold mb-4 flex items-center gap-2"><Bluetooth className="text-blue-500"/> Printer</h3>
                <button 
                  onClick={async () => {
                    setIsConnectingBt(true);
                    const success = await btPrinterService.connect();
                    setBtConnected(success);
                    setIsConnectingBt(false);
                  }}
                  className={`px-6 py-3 rounded-xl font-bold ${btConnected ? 'bg-green-100 text-green-700' : 'bg-blue-600 text-white'}`}
                >
                  {isConnectingBt ? 'Verbinden...' : btConnected ? 'Printer Verbonden' : 'Verbind Bluetooth Printer'}
                </button>
              </div>
              <div className="bg-white p-6 rounded-3xl border">
                <h3 className="font-bold mb-4">Kassa Sessie</h3>
                {!currentSession ? (
                   <button onClick={() => {
                     const s: SalesSession = { id: Date.now().toString(), startTime: Date.now(), startCash: 0, status: 'OPEN' };
                     setSessions([...sessions, s]);
                     setCurrentSession(s);
                   }} className="bg-amber-500 px-6 py-3 rounded-xl font-bold">Open Nieuwe Sessie</button>
                ) : (
                  <button onClick={() => {
                    if(window.confirm("Sessie afsluiten?")) {
                      const {summary, expectedDrawer} = calculateSessionTotals(currentSession.id, currentSession.startCash);
                      const closed = {...currentSession, status: 'CLOSED' as const, summary, endTime: Date.now(), expectedCash: expectedDrawer};
                      setSessions(sessions.map(s => s.id === currentSession.id ? closed : s));
                      setCurrentSession(null);
                    }
                  }} className="bg-red-500 text-white px-6 py-3 rounded-xl font-bold">Sluit Sessie</button>
                )}
              </div>
            </div>
          </div>
        )}
      </main>

      {/* Preview Overlay */}
      {previewTransaction && (
        <div className="fixed inset-0 z-[200] bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white p-6 rounded-3xl max-w-sm w-full shadow-2xl overflow-y-auto max-h-[90vh]">
            <Receipt transaction={previewTransaction} company={company} />
            <button onClick={() => setPreviewTransaction(null)} className="w-full mt-4 bg-slate-900 text-white py-3 rounded-xl font-bold">SLUITEN</button>
          </div>
        </div>
      )}

      {/* Viewing Session Overlay */}
      {viewingSession && (
        <div className="fixed inset-0 z-[200] bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white p-6 rounded-3xl max-w-sm w-full shadow-2xl overflow-y-auto max-h-[90vh]">
            <Receipt sessionSummary={viewingSession} company={company} />
            <button onClick={() => setViewingSession(null)} className="w-full mt-4 bg-slate-900 text-white py-3 rounded-xl font-bold">SLUITEN</button>
          </div>
        </div>
      )}
    </div>
  );
}
