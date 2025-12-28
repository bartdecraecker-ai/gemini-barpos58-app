
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { 
  ShoppingBag, 
  Trash2, 
  CreditCard, 
  Banknote, 
  History, 
  BarChart3, 
  Settings, 
  Printer, 
  Sparkles,
  Plus,
  Minus,
  Edit2,
  X,
  RotateCcw,
  Unlock,
  CheckCircle,
  Lock,
  User,
  Users,
  ChevronDown,
  Clock,
  Download,
  Eye,
  Bluetooth,
  AlertTriangle,
  Loader2,
  PlayCircle,
  ArrowRight,
  UserPlus,
  Globe
} from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { jsPDF } from "jspdf";
import { Product, CartItem, Transaction, PaymentMethod, CompanyDetails, DailySummary, CashEntry, SalesSession } from './types';
import { DEFAULT_COMPANY, INITIAL_PRODUCTS, AVAILABLE_COLORS } from './constants';
import { Receipt } from './components/Receipt.tsx';
import { generateDailyInsight } from './services/geminiService';
import { btPrinterService } from './services/bluetoothPrinter';

export default function App() {
  // State
  const [products, setProducts] = useState<Product[]>(INITIAL_PRODUCTS);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [cashEntries, setCashEntries] = useState<CashEntry[]>([]);
  const [sessions, setSessions] = useState<SalesSession[]>([]);
  const [company, setCompany] = useState<CompanyDetails>(DEFAULT_COMPANY);
  
  const [activeTab, setActiveTab] = useState<'POS' | 'REPORTS' | 'SETTINGS'>('POS');
  
  // Transient State
  const [currentSession, setCurrentSession] = useState<SalesSession | null>(null);
  const [lastTransaction, setLastTransaction] = useState<Transaction | null>(null);
  
  const [aiInsight, setAiInsight] = useState<string>('');
  const [isLoadingAi, setIsLoadingAi] = useState(false);
  const [autoPrint, setAutoPrint] = useState<boolean>(true);
  const [isOpeningDrawer, setIsOpeningDrawer] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [pendingCardPayment, setPendingCardPayment] = useState(false);
  const [previewTransaction, setPreviewTransaction] = useState<Transaction | null>(null);
  const [showSalesmanSelection, setShowSalesmanSelection] = useState(false);
  const [showRecentTransactions, setShowRecentTransactions] = useState(false);
  const [viewingSession, setViewingSession] = useState<SalesSession | null>(null);

  // Bluetooth State
  const [btConnected, setBtConnected] = useState(false);
  const [isConnectingBt, setIsConnectingBt] = useState(false);
  const [isPrintingBt, setIsPrintingBt] = useState(false);
  const [btDeviceName, setBtDeviceName] = useState('');
  const [btSupported, setBtSupported] = useState(true);

  // Undo State
  const [prevCart, setPrevCart] = useState<CartItem[] | null>(null);
  const [showUndoToast, setShowUndoToast] = useState(false);
  const undoTimeoutRef = useRef<any>(null);
  
  // Forms State
  const [cashAmount, setCashAmount] = useState<string>('');
  const [cashReason, setCashReason] = useState<string>('');
  const [startFloatAmount, setStartFloatAmount] = useState<string>('0');
  const [endCountAmount, setEndCountAmount] = useState<string>('');
  const [newSalesmanName, setNewSalesmanName] = useState('');

  // Initial load
  useEffect(() => {
    const isSupported = btPrinterService.isSupported();
    console.log('App: Bluetooth Supported:', isSupported);
    setBtSupported(isSupported);
    
    try {
      const savedTx = localStorage.getItem('barpos_transactions');
      const savedProducts = localStorage.getItem('barpos_products');
      const savedCompany = localStorage.getItem('barpos_company');
      const savedAutoPrint = localStorage.getItem('barpos_autoprint');
      const savedCashEntries = localStorage.getItem('barpos_cashentries');
      const savedSessions = localStorage.getItem('barpos_sessions');
      
      if (savedTx) setTransactions(JSON.parse(savedTx));
      if (savedProducts) setProducts(JSON.parse(savedProducts));
      if (savedCompany) setCompany(JSON.parse(savedCompany));
      if (savedAutoPrint !== null) setAutoPrint(JSON.parse(savedAutoPrint));
      if (savedCashEntries) setCashEntries(JSON.parse(savedCashEntries));
      if (savedSessions) {
        const parsedSessions = JSON.parse(savedSessions) as SalesSession[];
        setSessions(parsedSessions);
        const openSession = parsedSessions.find(s => s.status === 'OPEN');
        if (openSession) setCurrentSession(openSession);
      }
    } catch (e) {
      console.error("Error loading data", e);
    }
  }, []);

  // Save changes
  useEffect(() => localStorage.setItem('barpos_transactions', JSON.stringify(transactions)), [transactions]);
  useEffect(() => localStorage.setItem('barpos_products', JSON.stringify(products)), [products]);
  useEffect(() => localStorage.setItem('barpos_autoprint', JSON.stringify(autoPrint)), [autoPrint]);
  useEffect(() => localStorage.setItem('barpos_cashentries', JSON.stringify(cashEntries)), [cashEntries]);
  useEffect(() => localStorage.setItem('barpos_sessions', JSON.stringify(sessions)), [sessions]);
  useEffect(() => localStorage.setItem('barpos_company', JSON.stringify(company)), [company]);

  // Sorting
  const sortedProducts = useMemo(() => {
    return [...products].sort((a, b) => {
      const indexA = AVAILABLE_COLORS.indexOf(a.color || '');
      const indexB = AVAILABLE_COLORS.indexOf(b.color || '');
      if (indexA !== -1 && indexB !== -1 && indexA !== indexB) return indexA - indexB;
      if (indexA !== -1 && indexB === -1) return -1;
      if (indexA === -1 && indexB !== -1) return 1;
      if (a.price !== b.price) return a.price - b.price;
      return a.name.localeCompare(b.name);
    });
  }, [products]);

  // Calculations
  const cartTotals = useMemo(() => {
    let total = 0;
    let basis0 = 0;   
    let basis21 = 0;  
    let vat21Amount = 0; 

    cart.forEach(item => {
      const lineTotal = item.price * item.quantity;
      total += lineTotal;
      if (item.vatRate === 21) {
        const net = lineTotal / 1.21;
        basis21 += net;
        vat21Amount += (lineTotal - net);
      } else {
        basis0 += lineTotal;
      }
    });

    return { total, basis0, basis21, vat21Amount, subtotalExcl: basis0 + basis21 };
  }, [cart]);

  // Create a mock transaction object for previews before they are finalized
  const currentCartAsTransaction = useMemo((): Transaction | null => {
    if (cart.length === 0 || !currentSession) return null;
    return {
      id: "PREVIEW",
      sessionId: currentSession.id,
      timestamp: Date.now(),
      dateStr: new Date().toLocaleDateString('nl-NL'),
      items: [...cart],
      subtotal: cartTotals.subtotalExcl,
      vat0: cartTotals.basis0,
      vat21: cartTotals.vat21Amount,
      total: cartTotals.total,
      paymentMethod: PaymentMethod.CARD // Assumed if used for card confirmation
    };
  }, [cart, currentSession, cartTotals]);

  // --- Bluetooth Connection ---
  const handleBluetoothConnect = async () => {
    console.log('App: Requesting Bluetooth connection...');
    setIsConnectingBt(true);
    try {
      const success = await btPrinterService.connect();
      if (success) {
        setBtConnected(true);
        setBtDeviceName(btPrinterService.getDeviceName());
        console.log('App: Bluetooth connection successful.');
      } else {
        console.log('App: Bluetooth connection cancelled or no device selected.');
      }
    } catch (err: any) {
      console.error('App: Bluetooth connection error handler:', err);
      alert("Bluetooth Fout: " + (err.message || String(err)));
    } finally {
      setIsConnectingBt(false);
    }
  };

  const handleBluetoothDisconnect = () => {
    btPrinterService.disconnect();
    setBtConnected(false);
    setBtDeviceName('');
  };

  const handleBtTestPrint = async () => {
    if (!btConnected || isPrintingBt) return;
    setIsPrintingBt(true);
    try {
      await btPrinterService.testPrint();
    } catch (err: any) {
      alert("Printen mislukt: " + (err.message || "Onbekende fout"));
    } finally {
      setIsPrintingBt(false);
    }
  };

  // --- Cart logic ---
  const snapshotCart = () => {
    setPrevCart([...cart]);
    setShowUndoToast(true);
    if (undoTimeoutRef.current) clearTimeout(undoTimeoutRef.current);
    undoTimeoutRef.current = setTimeout(() => setShowUndoToast(false), 4000);
  };

  const handleUndo = () => {
    if (prevCart) {
      setCart(prevCart);
      setPrevCart(null);
      setShowUndoToast(false);
    }
  };

  const addToCart = (product: Product) => {
    snapshotCart();
    setCart(prev => {
      const existing = prev.find(item => item.id === product.id);
      if (existing) {
        return prev.map(item => 
          item.id === product.id ? { ...item, quantity: item.quantity + 1 } : item
        );
      }
      return [...prev, { ...product, quantity: 1 }];
    });
  };

  const removeFromCart = (id: string) => {
    snapshotCart();
    setCart(prev => prev.filter(item => item.id !== id));
  };

  const updateQuantity = (id: string, delta: number) => {
    snapshotCart();
    setCart(prev => {
      return prev.map(item => {
        if (item.id === id) {
          const newQ = item.quantity + delta;
          return { ...item, quantity: newQ };
        }
        return item;
      });
    });
  };

  const clearCart = () => {
    if (cart.length === 0) return;
    snapshotCart();
    setCart([]);
  };

  // Product Management
  const updateProduct = (id: string, field: keyof Product, value: any) => {
    setProducts(prev => prev.map(p => p.id === id ? { ...p, [field]: value } : p));
  };

  const deleteProduct = (id: string) => {
    setProducts(prev => prev.filter(p => p.id !== id));
  };

  const addProduct = () => {
    if (products.length >= 14) return; 
    const newProduct: Product = {
      id: Date.now().toString(),
      name: 'Nieuw Product',
      price: 0,
      vatRate: 21,
      color: 'bg-gray-200',
      stock: 0
    };
    setProducts(prev => [...prev, newProduct]);
  };

  const addSalesman = () => {
    const trimmed = newSalesmanName.trim();
    if (!trimmed) return;
    if (company.salesmen?.includes(trimmed)) {
      alert("Naam bestaat al.");
      return;
    }
    setCompany(prev => ({
      ...prev,
      salesmen: [...(prev.salesmen || []), trimmed]
    }));
    setNewSalesmanName('');
  };

  const removeSalesman = (name: string) => {
    setCompany(prev => ({
      ...prev,
      salesmen: prev.salesmen?.filter(n => n !== name) || []
    }));
  };

  const selectSalesman = (name: string) => {
    setCompany(prev => ({ ...prev, sellerName: name }));
    setShowSalesmanSelection(false);
  };

  // Session
  const handleOpenSession = () => {
    if (currentSession) return;
    const rawVal = String(startFloatAmount || '').replace(',', '.').trim();
    const startFloat = parseFloat(rawVal);
    
    if (isNaN(startFloat)) {
      alert("Voer een geldig startbedrag in (bijv. 50 of 0).");
      return;
    }
    
    const newSession: SalesSession = {
      id: Date.now().toString(),
      startTime: Date.now(),
      startCash: startFloat,
      status: 'OPEN'
    };
    
    const updatedSessions = [...sessions, newSession];
    setSessions(updatedSessions);
    setCurrentSession(newSession);
    setStartFloatAmount('0');
    setActiveTab('POS');
  };

  const calculateSessionTotals = (sessionId: string, startCash: number) => {
    const sessionTx = transactions.filter(t => t.sessionId === sessionId);
    const sessionEntries = cashEntries.filter(e => e.sessionId === sessionId);
    const summary: DailySummary = sessionTx.reduce((acc, tx) => ({
      totalSales: acc.totalSales + tx.total,
      transactionCount: acc.transactionCount + 1,
      cashTotal: acc.cashTotal + (tx.paymentMethod === PaymentMethod.CASH ? tx.total : 0),
      cardTotal: acc.cardTotal + (tx.paymentMethod === PaymentMethod.CARD ? tx.total : 0),
      vat0Total: acc.vat0Total + tx.vat0,
      vat21Total: acc.vat21Total + tx.vat21,
    }), { totalSales: 0, transactionCount: 0, cashTotal: 0, cardTotal: 0, vat0Total: 0, vat21Total: 0 });
    
    const cashMovementsTotal = sessionEntries.reduce((acc, entry) => acc + (entry.type === 'IN' ? entry.amount : -entry.amount), 0);
    const expectedDrawer = startCash + summary.cashTotal + cashMovementsTotal;
    return { summary, expectedDrawer };
  };

  const currentSessionData = useMemo(() => {
    if (!currentSession) return null;
    return calculateSessionTotals(currentSession.id, currentSession.startCash);
  }, [currentSession, transactions, cashEntries]);

  const handleCloseSession = (e: React.MouseEvent<HTMLButtonElement>) => {
    e.preventDefault();
    if (!currentSession) return;
    const amountStr = String(endCountAmount || '').replace(',', '.').trim();
    const endFloat = amountStr !== '' ? parseFloat(amountStr) : 0;
    
    const { summary, expectedDrawer } = calculateSessionTotals(currentSession.id, currentSession.startCash);
    const closedSession: SalesSession = {
      ...currentSession,
      endTime: Date.now(),
      status: 'CLOSED',
      endCash: endFloat,
      expectedCash: expectedDrawer,
      summary: summary
    };
    setSessions(prev => prev.map(s => s.id === currentSession.id ? closedSession : s));
    setEndCountAmount('');
    setCurrentSession(null);
    setActiveTab('POS');
  };

  const initiatePayment = (method: PaymentMethod) => {
    if (!currentSession) {
      alert("Er is geen kassasessie geopend.");
      return;
    }
    if (method === PaymentMethod.CARD) {
      setPendingCardPayment(true);
    } else {
      processPayment(PaymentMethod.CASH);
    }
  };

  const processPayment = async (method: PaymentMethod) => {
    if (cart.length === 0 || !currentSession) return;
    const now = new Date();
    const year = now.getFullYear();
    const idPrefix = `AM${year}-`;
    const existingSeqs = transactions.filter(t => t.id.startsWith(idPrefix)).map(t => parseInt(t.id.split('-')[1])).filter(n => !isNaN(n));
    const nextSeq = existingSeqs.length > 0 ? Math.max(...existingSeqs) + 1 : 1;
    const newId = `${idPrefix}${String(nextSeq).padStart(4, '0')}`;
    
    const updatedProducts = products.map(product => {
      const cartItem = cart.find(c => c.id === product.id);
      if (cartItem) return { ...product, stock: (product.stock || 0) - cartItem.quantity };
      return product;
    });
    setProducts(updatedProducts);

    const newTx: Transaction = {
      id: newId,
      sessionId: currentSession.id,
      timestamp: now.getTime(),
      dateStr: now.toLocaleDateString('nl-NL'),
      items: [...cart],
      subtotal: cartTotals.subtotalExcl,
      vat0: cartTotals.basis0,
      vat21: cartTotals.vat21Amount,
      total: cartTotals.total,
      paymentMethod: method,
    };
    
    setTransactions(prev => [newTx, ...prev]);
    setLastTransaction(newTx);
    setCart([]);
    setPendingCardPayment(false);
    setShowSuccess(true);
    setTimeout(() => setShowSuccess(false), 2000);

    if (method === PaymentMethod.CASH || autoPrint) {
      if (btConnected) {
        setIsPrintingBt(true);
        try {
          await btPrinterService.printReceipt(newTx, company);
        } catch (e: any) {
          console.error("BT Print failed", e);
          setTimeout(() => setPreviewTransaction(newTx), 500);
        } finally {
          setIsPrintingBt(false);
        }
      } else {
        setTimeout(() => setPreviewTransaction(newTx), 100);
      }
    }
  };

  const editTransaction = (tx: Transaction) => {
    if (currentSession && tx.sessionId && tx.sessionId !== currentSession.id) {
       alert("Kan geen ticket wijzigen van een afgesloten sessie.");
       return;
    }
    if (!currentSession) {
       alert("Open eerst de kassa.");
       return;
    }
    if (window.confirm("Ticket wijzigen? Voorraad wordt hersteld.")) {
      const updatedProducts = products.map(product => {
        const itemInTx = tx.items.find(item => item.id === product.id);
        if (itemInTx) return { ...product, stock: (product.stock || 0) + itemInTx.quantity };
        return product;
      });
      setProducts(updatedProducts);
      setTransactions(prev => prev.filter(t => t.id !== tx.id));
      setCart(JSON.parse(JSON.stringify(tx.items)));
      setActiveTab('POS');
      setShowRecentTransactions(false);
    }
  };

  const handleCashEntry = (type: 'IN' | 'OUT') => {
    if (!currentSession) return;
    const amount = parseFloat(cashAmount.replace(',', '.'));
    if (!amount || amount <= 0 || !cashReason.trim()) return;
    const newEntry: CashEntry = {
      id: Date.now().toString(),
      sessionId: currentSession.id,
      timestamp: Date.now(),
      type,
      amount,
      reason: cashReason
    };
    setCashEntries(prev => [newEntry, ...prev]);
    setCashAmount('');
    setCashReason('');
  };

  const handleOpenDrawer = async () => {
    if (btConnected) {
      try {
        await btPrinterService.openDrawer();
      } catch (err) {
        console.error("Drawer failed", err);
      }
    } else {
      setIsOpeningDrawer(true);
      setTimeout(() => {
        window.print();
        setTimeout(() => setIsOpeningDrawer(false), 500);
      }, 100);
    }
  };

  const handlePrintRequest = async (tx: Transaction) => {
    setLastTransaction(tx);
    if (btConnected && !isPrintingBt) {
      setIsPrintingBt(true);
      try {
        await btPrinterService.printReceipt(tx, company);
      } catch (err: any) {
        alert("Printen mislukt: " + (err.message || "Controleer de printer"));
      } finally {
        setIsPrintingBt(false);
      }
    } else {
      setPreviewTransaction(tx);
    }
  };

  const handleAiInsight = async () => {
    if (!currentSessionData) return;
    setIsLoadingAi(true);
    const sessionTx = transactions.filter(t => t.sessionId === currentSession?.id);
    const insight = await generateDailyInsight(sessionTx, currentSessionData.summary);
    setAiInsight(insight);
    setIsLoadingAi(false);
  };

  const chartData = useMemo(() => {
    if (!currentSession) return [];
    const data: Record<string, number> = {};
    for (let i = 0; i < 24; i++) data[`${i}:00`] = 0;
    transactions.filter(t => t.sessionId === currentSession.id).forEach(tx => {
        const hour = new Date(tx.timestamp).getHours();
        data[`${hour}:00`] += tx.total;
    });
    return Object.entries(data).map(([name, sales]) => ({ name, sales }));
  }, [currentSession, transactions]);

  const CartList = () => (
    <div className="flex-1 overflow-y-auto px-1 py-0 bg-white">
      {cart.length === 0 ? <div className="text-center text-slate-300 py-4 text-xs">Leeg ticket</div> :
        cart.map(item => (
          <div key={item.id} className="flex items-center justify-between py-1 border-b border-slate-50 last:border-0">
             <div className="flex items-center bg-slate-100 rounded shrink-0 h-7">
                <button onClick={() => updateQuantity(item.id, -1)} className="w-7 h-full flex items-center justify-center text-slate-600 hover:bg-slate-200 rounded-l active:bg-slate-300"><Minus size={12} /></button>
                <span className="w-5 text-center font-bold text-sm leading-none">{item.quantity}</span>
                <button onClick={() => updateQuantity(item.id, 1)} className="w-7 h-full flex items-center justify-center text-slate-600 hover:bg-slate-200 rounded-r active:bg-slate-300"><Plus size={12} /></button>
             </div>
             <div className="flex-1 mx-2 min-w-0 font-medium text-sm truncate leading-tight text-slate-700">{item.name}</div>
             <div className="flex items-center gap-2 shrink-0">
                <span className="font-bold text-slate-900 text-sm">€{(item.price * item.quantity).toFixed(2)}</span>
                <button onClick={() => removeFromCart(item.id)} className="w-7 h-7 flex items-center justify-center text-slate-400 hover:text-red-500 hover:bg-red-50 rounded transition-colors"><Trash2 size={14} /></button>
             </div>
          </div>
        ))
      }
    </div>
  );

  return (
    <div className="min-h-screen flex flex-col md:flex-row overflow-hidden relative">
      
      {showSuccess && (
        <div className="fixed top-8 left-1/2 -translate-x-1/2 z-[200] animate-in slide-in-from-bottom-4 duration-300">
          <div className="bg-green-600 text-white px-6 py-3 rounded-2xl shadow-2xl flex items-center gap-3">
             <CheckCircle size={24} />
             <span className="font-bold">Verkoop afgerond!</span>
          </div>
        </div>
      )}

      {pendingCardPayment && currentCartAsTransaction && (
        <div className="fixed inset-0 z-[150] bg-slate-900/60 backdrop-blur-md flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-200 flex flex-col max-h-[90vh]">
             <div className="p-6 bg-slate-50 border-b flex justify-between items-center">
                <div className="flex items-center gap-3">
                   <div className="w-10 h-10 bg-blue-100 rounded-xl flex items-center justify-center text-blue-600">
                      <CreditCard size={24} />
                   </div>
                   <h3 className="font-bold text-xl">Betalingscontrole</h3>
                </div>
                <button onClick={() => setPendingCardPayment(false)} className="p-2 hover:bg-slate-200 rounded-full transition-colors"><X size={24} /></button>
             </div>
             
             <div className="flex-1 overflow-y-auto p-6 flex flex-col md:flex-row gap-6">
                <div className="flex-1">
                   <p className="text-slate-500 text-sm mb-4">Controleer de bestelling en het totaalbedrag op het pinapparaat.</p>
                   <div className="bg-slate-50 p-6 rounded-2xl text-center border-2 border-dashed border-slate-200 mb-6">
                      <span className="text-slate-400 text-xs font-bold uppercase tracking-widest block mb-1">Te Betalen</span>
                      <span className="text-4xl font-black text-slate-900">€{cartTotals.total.toFixed(2)}</span>
                   </div>
                   
                   <div className="space-y-3">
                      <h4 className="font-bold text-sm text-slate-400 uppercase tracking-wider">Actie</h4>
                      <button 
                         onClick={() => processPayment(PaymentMethod.CARD)}
                         className="w-full bg-green-600 hover:bg-green-700 text-white py-4 rounded-2xl font-black text-lg shadow-xl shadow-green-100 transition-all active:scale-95 flex items-center justify-center gap-3"
                      >
                         <CheckCircle size={24} /> JA, BETALING GELUKT
                      </button>
                      <button 
                         onClick={() => setPendingCardPayment(false)}
                         className="w-full bg-white hover:bg-slate-50 text-slate-400 py-3 rounded-2xl font-bold border border-slate-200 transition-all flex items-center justify-center gap-2"
                      >
                         ANULEREN / MISLUKT
                      </button>
                   </div>
                </div>

                <div className="hidden md:block w-56 shrink-0">
                   <div className="sticky top-0 bg-slate-100 p-2 rounded-xl shadow-inner scale-90 origin-top">
                      <Receipt preview transaction={currentCartAsTransaction} company={company} />
                   </div>
                </div>
             </div>
          </div>
        </div>
      )}

      {showSalesmanSelection && (
        <div className="fixed inset-0 z-[160] bg-slate-900/60 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-sm overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="p-6 bg-slate-50 border-b flex justify-between items-center">
              <h3 className="font-bold text-xl flex items-center gap-2"><Users size={24} className="text-amber-500" /> Verkoper Selecteren</h3>
              <button onClick={() => setShowSalesmanSelection(false)} className="p-2 hover:bg-slate-200 rounded-full"><X size={24} /></button>
            </div>
            <div className="p-6 grid grid-cols-1 gap-3">
              {(company.salesmen || []).map(name => (
                <button 
                  key={name} 
                  onClick={() => selectSalesman(name)}
                  className={`flex items-center justify-between p-4 rounded-2xl font-bold transition-all ${company.sellerName === name ? 'bg-amber-500 text-white shadow-lg' : 'bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-200'}`}
                >
                  <div className="flex items-center gap-3">
                    <User size={20} />
                    <span>{name}</span>
                  </div>
                  {company.sellerName === name && <CheckCircle size={20} />}
                </button>
              ))}
              {(company.salesmen || []).length === 0 && <p className="text-center text-slate-400 py-4">Geen verkopers ingesteld.</p>}
            </div>
          </div>
        </div>
      )}

      {showUndoToast && prevCart && !pendingCardPayment && (
        <div className="absolute bottom-24 md:bottom-8 left-0 right-0 flex justify-center z-[100] pointer-events-none">
           <div className="bg-slate-900 text-white px-4 py-3 rounded-xl shadow-xl flex items-center gap-4 pointer-events-auto animate-in fade-in slide-in-from-bottom-4 duration-300">
              <span className="text-sm font-medium">Ticket aangepast</span>
              <button onClick={handleUndo} className="flex items-center gap-1.5 bg-slate-700 hover:bg-slate-600 px-3 py-1.5 rounded-lg text-xs font-bold transition-colors"><RotateCcw size={14} /> Herstel</button>
           </div>
        </div>
      )}

      {viewingSession && (
        <div className="absolute inset-0 z-[85] flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4 animate-in fade-in duration-200">
           <div className="bg-white rounded-3xl shadow-xl w-full max-w-lg max-h-[80vh] flex flex-col overflow-hidden animate-in zoom-in-95">
              <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-slate-50">
                 <h3 className="font-bold text-lg text-slate-800 flex items-center gap-2"><History size={20} className="text-blue-500" /> Details Sessie {viewingSession.id.slice(-6)}</h3>
                 <button onClick={() => setViewingSession(null)} className="p-2 hover:bg-slate-200 rounded-full"><X size={20} /></button>
              </div>
              <div className="flex-1 overflow-y-auto p-4">
                 <div className="grid grid-cols-2 gap-4 text-xs mb-4">
                     <div>Start: <span className="font-bold">{new Date(viewingSession.startTime).toLocaleString('nl-NL')}</span></div>
                     <div>Einde: <span className="font-bold">{viewingSession.endTime ? new Date(viewingSession.endTime).toLocaleString('nl-NL') : 'Actief'}</span></div>
                     <div>Omzet: <span className="font-bold">€{viewingSession.summary?.totalSales.toFixed(2)}</span></div>
                     <div>Kas: <span className="font-bold">€{viewingSession.endCash?.toFixed(2) || '0.00'}</span></div>
                 </div>
                 <table className="w-full text-sm text-left">
                     <thead className="bg-slate-100 text-slate-500">
                       <tr><th className="px-4 py-2">Tijd</th><th className="px-4 py-2">ID</th><th className="px-4 py-2">Bedrag</th></tr>
                     </thead>
                     <tbody className="divide-y divide-slate-100">
                        {transactions.filter(t => t.sessionId === viewingSession.id).length === 0 ? <tr><td colSpan={3} className="p-4 text-center text-slate-400">Geen data</td></tr> :
                           transactions.filter(t => t.sessionId === viewingSession.id).slice().reverse().map(tx => (
                            <tr key={tx.id}>
                              <td className="px-4 py-2">{new Date(tx.timestamp).toLocaleTimeString('nl-NL', {hour: '2-digit', minute:'2-digit'})}</td>
                              <td className="px-4 py-2 font-mono text-xs">{tx.id}</td>
                              <td className="px-4 py-2 font-bold">€{tx.total.toFixed(2)}</td>
                            </tr>
                           ))
                        }
                     </tbody>
                 </table>
              </div>
           </div>
        </div>
      )}

      {showRecentTransactions && (
        <div className="absolute inset-0 z-[85] flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4 animate-in fade-in duration-200">
           <div className="bg-white rounded-3xl shadow-xl w-full max-w-lg max-h-[80vh] flex flex-col overflow-hidden animate-in zoom-in-95">
              <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-slate-50">
                 <h3 className="font-bold text-lg text-slate-800 flex items-center gap-2"><History size={20} className="text-amber-500" /> Recente Transacties</h3>
                 <button onClick={() => setShowRecentTransactions(false)} className="p-2 hover:bg-slate-200 rounded-full"><X size={20}/></button>
              </div>
              <div className="flex-1 overflow-y-auto">
                {!currentSession ? <div className="p-8 text-center">Geen actieve sessie.</div> : transactions.filter(t => t.sessionId === currentSession.id).length === 0 ? <div className="p-8 text-center">Nog geen transacties.</div> : (
                  <table className="w-full text-sm text-left">
                     <thead className="bg-slate-50 text-slate-500 sticky top-0">
                       <tr><th className="px-4 py-3">Tijd</th><th className="px-4 py-3">ID</th><th className="px-4 py-3">Totaal</th><th className="px-4 py-3 text-right">Actie</th></tr>
                     </thead>
                     <tbody className="divide-y divide-slate-100">
                       {transactions.filter(t => t.sessionId === currentSession.id).slice().reverse().map(tx => (
                         <tr key={tx.id} className="hover:bg-slate-50">
                           <td className="px-4 py-3">{new Date(tx.timestamp).toLocaleTimeString('nl-NL', {hour:'2-digit', minute:'2-digit'})}</td>
                           <td className="px-4 py-3 font-mono text-xs">{tx.id}</td>
                           <td className="px-4 py-3 font-bold">€{tx.total.toFixed(2)}</td>
                           <td className="px-4 py-3 flex gap-2 justify-end">
                              <button onClick={() => handlePrintRequest(tx)} className="p-2"><Printer size={16}/></button>
                              <button onClick={() => editTransaction(tx)} className="p-2 text-amber-500"><Edit2 size={16}/></button>
                           </td>
                         </tr>
                       ))}
                     </tbody>
                   </table>
                )}
              </div>
           </div>
        </div>
      )}

      <nav className="bg-slate-900 text-white w-full md:w-20 flex md:flex-col items-center justify-around md:justify-start py-4 no-print shrink-0 z-50">
        <div className="font-bold text-xl mb-0 md:mb-8 text-amber-500 hidden md:block text-center">POS</div>
        <button onClick={() => setActiveTab('POS')} className={`p-3 rounded-xl transition-all ${activeTab === 'POS' ? 'bg-amber-500 text-black shadow-lg shadow-amber-500/20' : 'hover:bg-slate-800'}`}><ShoppingBag size={24} /></button>
        <button onClick={() => setActiveTab('REPORTS')} className={`p-3 rounded-xl mt-0 md:mt-4 transition-all ${activeTab === 'REPORTS' ? 'bg-amber-500 text-black shadow-lg shadow-amber-500/20' : 'hover:bg-slate-800'}`}><BarChart3 size={24} /></button>
        <button onClick={() => setActiveTab('SETTINGS')} className={`p-3 rounded-xl mt-0 md:mt-4 transition-all ${activeTab === 'SETTINGS' ? 'bg-amber-500 text-black shadow-lg shadow-amber-500/20' : 'hover:bg-slate-800'}`}><Settings size={24} /></button>
      </nav>

      <main className="flex-1 bg-slate-100 h-[calc(100vh-64px)] md:h-screen overflow-hidden relative">
        {activeTab === 'POS' && (
          <div className="flex flex-col md:flex-row h-full">
            {!currentSession && (
              <div className="absolute inset-0 z-[60] bg-slate-100/90 backdrop-blur-md flex items-center justify-center p-4">
                <div className="bg-white p-8 rounded-3xl shadow-2xl max-w-sm w-full border border-slate-200 text-center animate-in zoom-in-95 duration-300">
                  <div className="bg-amber-100 w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-6 text-amber-600">
                    <PlayCircle size={32} />
                  </div>
                  <h2 className="text-2xl font-bold text-slate-800 mb-2">Welkom!</h2>
                  <p className="text-slate-500 text-sm mb-8">Open een nieuwe kassasessie om te beginnen met verkopen.</p>
                  
                  <div className="text-left mb-6">
                    <label className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2 block">Startkapitaal (Lade)</label>
                    <div className="relative">
                      <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 font-bold">€</span>
                      <input 
                        type="number" 
                        value={startFloatAmount} 
                        onChange={e => setStartFloatAmount(e.target.value)} 
                        className="w-full bg-slate-50 border-2 border-slate-100 rounded-xl py-3 pl-8 pr-4 font-bold focus:border-amber-500 outline-none transition-all"
                        placeholder="0.00"
                      />
                    </div>
                  </div>

                  <button 
                    onClick={handleOpenSession} 
                    className="w-full bg-amber-500 hover:bg-amber-600 text-white py-4 rounded-xl font-bold shadow-lg shadow-amber-200 transition-all active:scale-95 flex items-center justify-center gap-2"
                  >
                    Kassa Openen
                  </button>
                </div>
              </div>
            )}

            <div className="md:hidden h-[30%] bg-white border-b border-slate-200 flex flex-col shrink-0">
               <div className="px-2 py-1 bg-slate-50 border-b border-slate-200 flex justify-between items-center text-xs">
                  <span className="font-bold">Ticket ({cart.length})</span>
                  <div className="flex items-center gap-2">
                     <button onClick={() => setShowRecentTransactions(true)} className="bg-slate-100 border p-1 rounded"><Clock size={16} /></button>
                     <button onClick={() => setShowSalesmanSelection(true)} className="bg-white border px-2 py-0.5 rounded flex items-center gap-1 font-medium">{company.sellerName}</button>
                     <button onClick={clearCart} className="text-red-500 p-1"><Trash2 size={14}/></button>
                  </div>
               </div>
               <CartList />
            </div>
            <div className="flex-1 p-2 md:p-4 overflow-y-auto bg-slate-100 min-h-0">
              <div className="flex justify-between items-center mb-2 md:mb-4">
                 <h2 className="text-2xl font-bold hidden md:block">Producten</h2>
                 <div className="hidden md:flex items-center gap-2 ml-auto">
                    <button onClick={() => setShowRecentTransactions(true)} className="bg-white border p-2 rounded-lg shadow-sm hover:bg-slate-50 transition-colors"><Clock size={18} /></button>
                    <button onClick={() => setShowSalesmanSelection(true)} className="bg-white border px-3 py-1.5 rounded-lg text-sm font-medium flex items-center gap-2 shadow-sm hover:bg-slate-50 transition-colors">{company.sellerName} <ChevronDown size={14} /></button>
                 </div>
              </div>
              <div className="grid grid-cols-3 min-[350px]:grid-cols-4 min-[500px]:grid-cols-5 md:grid-cols-3 lg:grid-cols-4 gap-1.5 md:gap-4 pb-2">
                {sortedProducts.map(product => (
                  <button key={product.id} onClick={() => addToCart(product)} disabled={!currentSession} className={`${product.color || 'bg-white'} p-0.5 md:p-6 rounded-lg md:rounded-2xl shadow-sm hover:shadow-md active:scale-95 flex flex-col items-center justify-center text-center h-16 min-[350px]:h-20 md:h-40 border border-slate-200 disabled:opacity-50 transition-all`}>
                    <span className="font-bold text-xs md:text-lg leading-tight mb-1">{product.name}</span>
                    <span className="text-slate-900 bg-white/60 px-1 md:px-2 py-0.5 rounded-full text-[10px] md:text-xs font-bold">€{product.price.toFixed(2)}</span>
                    <span className={`text-[9px] md:text-[10px] mt-1 ${(product.stock || 0) < 10 ? 'text-red-600 font-bold' : 'text-slate-500'}`}>Stock: {product.stock || 0}</span>
                  </button>
                ))}
              </div>
            </div>
            <div className="md:w-96 bg-white border-t md:border-t-0 md:border-l flex flex-col shrink-0">
               <div className="hidden md:flex p-4 bg-slate-50 border-b justify-between items-center">
                  <h3 className="font-bold text-lg">Ticket</h3>
                  <button onClick={clearCart} className="text-red-500 p-2 rounded-full hover:bg-red-50 transition-colors"><Trash2 size={20} /></button>
               </div>
               <div className="hidden md:flex flex-col flex-1 min-h-0"><CartList /></div>
               <div className="p-2 md:p-4 bg-slate-50 border-t space-y-2 shrink-0">
                  <div className="flex justify-between items-end pt-1">
                    <span className="text-sm font-medium text-slate-600">Totaal</span>
                    <span className="text-2xl md:text-3xl font-bold">€{cartTotals.total.toFixed(2)}</span>
                  </div>
                  <div className="grid grid-cols-2 gap-2 pt-1">
                    <button disabled={cart.length === 0 || !currentSession || isPrintingBt} onClick={() => initiatePayment(PaymentMethod.CASH)} className="flex items-center justify-center gap-2 bg-green-600 text-white py-3 md:py-4 rounded-xl font-bold active:scale-95 disabled:opacity-50 transition-all shadow-lg shadow-green-100">
                      {isPrintingBt ? <Loader2 size={20} className="animate-spin" /> : <Banknote size={20} />} Cash
                    </button>
                    <button disabled={cart.length === 0 || !currentSession || isPrintingBt} onClick={() => initiatePayment(PaymentMethod.CARD)} className="flex items-center justify-center gap-2 bg-blue-600 text-white py-3 md:py-4 rounded-xl font-bold active:scale-95 disabled:opacity-50 transition-all shadow-lg shadow-blue-100">
                      <CreditCard size={20} /> Kaart
                    </button>
                  </div>
               </div>
            </div>
          </div>
        )}

        {activeTab === 'REPORTS' && (
           <div className="h-full overflow-y-auto p-4 md:p-6">
              {!currentSession && (
                <div className="bg-slate-900 text-white p-8 rounded-3xl shadow-xl mb-8 flex flex-col md:flex-row justify-between items-center gap-6">
                  <div className="flex-1">
                    <h2 className="text-2xl font-bold mb-1">Kassa is gesloten</h2>
                    <p className="text-slate-400 text-sm">Open een nieuwe sessie om de dag te starten.</p>
                  </div>
                  <div className="flex flex-col md:flex-row items-end md:items-center gap-4 w-full md:w-auto">
                    <div className="w-full md:w-32">
                      <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">Startkapitaal</label>
                      <input 
                        type="number" 
                        value={startFloatAmount} 
                        onChange={e => setStartFloatAmount(e.target.value)} 
                        className="w-full bg-slate-800 border border-slate-700 text-white px-3 py-2 rounded-lg text-sm outline-none focus:border-amber-500 transition-colors"
                        placeholder="0.00"
                      />
                    </div>
                    <button 
                      onClick={handleOpenSession} 
                      className="bg-amber-500 hover:bg-amber-600 text-black px-6 py-2.5 rounded-xl font-bold w-full md:w-auto transition-colors flex items-center justify-center gap-2 shadow-lg shadow-amber-500/30"
                    >
                      <PlayCircle size={18} /> Nieuwe Sessie
                    </button>
                  </div>
                </div>
              )}

              {currentSession && (
                <div className="mb-12 border-b pb-8">
                  <div className="flex justify-between items-center mb-6"><h2 className="text-2xl font-bold">Huidige Sessie</h2><div className="text-sm text-slate-500 flex items-center gap-2"><Clock size={14} /> Start: {new Date(currentSession.startTime).toLocaleTimeString('nl-NL')}</div></div>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
                    <div className="bg-white p-4 rounded-2xl border border-slate-200"><div>Omzet</div><div className="text-xl font-bold">€{currentSessionData?.summary.totalSales.toFixed(2)}</div></div>
                    <div className="bg-white p-4 rounded-2xl border border-green-200 ring-2 ring-green-50"><div>Verwachte Kas</div><div className="text-xl font-bold text-green-600">€{currentSessionData?.expectedDrawer.toFixed(2)}</div></div>
                    <div className="bg-white p-4 rounded-2xl border border-slate-200"><div>Transacties</div><div className="text-xl font-bold">{currentSessionData?.summary.transactionCount}</div></div>
                    <div className="bg-white p-4 rounded-2xl border border-slate-200"><div>Kaart</div><div className="text-xl font-bold">€{currentSessionData?.summary.cardTotal.toFixed(2)}</div></div>
                  </div>
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
                      <div className="bg-white p-4 rounded-2xl border shadow-sm"><h3 className="font-bold mb-4 flex items-center gap-2"><BarChart3 size={18} className="text-slate-400" /> Omzetverloop</h3><div className="h-48"><ResponsiveContainer width="100%" height="100%"><BarChart data={chartData}><CartesianGrid strokeDasharray="3 3" vertical={false} /><XAxis dataKey="name" fontSize={10} /><YAxis fontSize={10} /><Tooltip /><Bar dataKey="sales" fill="#f59e0b" radius={[4, 4, 0, 0]} /></BarChart></ResponsiveContainer></div></div>
                      <div className="bg-gradient-to-br from-indigo-600 to-purple-700 text-white p-6 rounded-2xl relative overflow-hidden shadow-lg"><Sparkles className="absolute top-2 right-2 text-yellow-300 opacity-20" size={60} /><h3 className="font-bold mb-4 flex items-center gap-2"><Sparkles size={18}/> Gemini Inzichten</h3>{aiInsight ? <p className="text-sm opacity-90">{aiInsight}</p> : <button onClick={handleAiInsight} disabled={isLoadingAi} className="bg-white text-indigo-600 px-4 py-2 rounded-lg text-sm font-bold hover:bg-slate-50 transition-colors shadow-md">{isLoadingAi ? 'Analyse...' : 'Genereer Analyse'}</button>}</div>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    <div className="bg-white p-4 rounded-2xl border shadow-sm"><h3 className="font-bold mb-4 flex items-center gap-2"><Lock size={18} className="text-slate-400" /> Sessie Sluiten</h3><div className="space-y-4"><div className="bg-slate-50 p-3 rounded-lg flex justify-between"><span>Verwacht in lade:</span><span className="font-bold">€{currentSessionData?.expectedDrawer.toFixed(2)}</span></div><div><label className="text-xs font-bold text-slate-500 block mb-1">Geteld Bedrag</label><input type="text" value={endCountAmount} onChange={e => setEndCountAmount(e.target.value)} className="w-full border p-2 rounded-lg font-bold outline-none focus:border-amber-500 transition-all" placeholder="0.00" /></div><button onClick={handleCloseSession} className="w-full bg-red-600 text-white py-3 rounded-xl font-bold shadow-lg shadow-red-100 hover:bg-red-700 transition-colors">Kassa Afsluiten</button></div></div>
                    <div className="bg-white p-4 rounded-2xl border shadow-sm"><h3 className="font-bold mb-4 flex items-center gap-2"><Banknote size={18} className="text-slate-400" /> Kasbeheer</h3><div className="space-y-2"><div className="flex gap-2"><input type="number" value={cashAmount} onChange={e => setCashAmount(e.target.value)} className="w-24 border p-2 rounded-lg outline-none focus:border-amber-500 transition-all" placeholder="€" /><input type="text" value={cashReason} onChange={e => setCashReason(e.target.value)} className="flex-1 border p-2 rounded-lg outline-none focus:border-amber-500 transition-all" placeholder="Reden" /></div><div className="flex gap-2"><button onClick={() => handleCashEntry('IN')} className="flex-1 bg-green-600 text-white py-2 rounded-lg text-sm font-bold hover:bg-green-700 transition-colors">Storten</button><button onClick={() => handleCashEntry('OUT')} className="flex-1 bg-red-500 text-white py-2 rounded-lg text-sm font-bold hover:bg-red-600 transition-colors">Opnemen</button></div></div></div>
                  </div>
                </div>
              )}
              
              <h3 className="font-bold text-lg mb-4">Historiek</h3>
              <div className="space-y-2">{sessions.filter(s => s.status === 'CLOSED').slice().reverse().map(s => <div key={s.id} className="bg-white p-4 rounded-xl border flex justify-between items-center shadow-sm"><div><div className="font-bold">Sessie {s.id.slice(-6)}</div><div className="text-xs text-slate-500">{new Date(s.startTime).toLocaleDateString()}</div></div><button onClick={() => setViewingSession(s)} className="text-blue-600 text-sm font-bold hover:underline">Details</button></div>)}</div>
           </div>
        )}

        {activeTab === 'SETTINGS' && (
           <div className="h-full overflow-y-auto p-4 md:p-6 max-w-4xl mx-auto">
              <h2 className="text-2xl font-bold mb-6">Instellingen</h2>
              
              <div className="bg-white p-4 md:p-6 rounded-2xl shadow-sm border mb-6">
                 <div className="flex justify-between items-center mb-6">
                   <h3 className="font-bold flex items-center gap-2 text-slate-700"><ShoppingBag size={20} className="text-amber-500"/> Producten</h3>
                   <button onClick={addProduct} disabled={products.length >= 14} className="bg-amber-500 hover:bg-amber-600 text-white px-4 py-2 rounded-lg font-bold text-sm transition-colors shadow-md disabled:opacity-50">+ Nieuw</button>
                 </div>
                 <div className="space-y-4">
                   {sortedProducts.map(p => (
                     <div key={p.id} className="flex flex-col lg:flex-row gap-4 lg:items-center bg-slate-50 p-4 rounded-xl border border-slate-100 hover:border-slate-200 transition-colors">
                        <div className="flex gap-2 items-center"><div className={`w-8 h-8 rounded-full ${p.color} border shadow-inner`}></div><select value={p.color} onChange={e => updateProduct(p.id, 'color', e.target.value)} className="bg-white border text-xs p-1 rounded outline-none focus:border-amber-500">{AVAILABLE_COLORS.map(c => <option key={c} value={c}>{c.replace('bg-', '')}</option>)}</select></div>
                        <div className="flex-1 grid grid-cols-2 lg:grid-cols-4 gap-2">
                           <input type="text" value={p.name} onChange={e => updateProduct(p.id, 'name', e.target.value)} className="border p-2 rounded text-sm outline-none focus:border-amber-500" placeholder="Naam" />
                           <input type="number" value={p.price} onChange={e => updateProduct(p.id, 'price', parseFloat(e.target.value))} className="border p-2 rounded text-sm outline-none focus:border-amber-500" placeholder="€" />
                           <input type="number" value={p.stock} onChange={e => updateProduct(p.id, 'stock', parseInt(e.target.value))} className="border p-2 rounded text-sm outline-none focus:border-amber-500" placeholder="Stock" />
                           <select value={p.vatRate} onChange={e => updateProduct(p.id, 'vatRate', parseInt(e.target.value))} className="border p-2 rounded text-sm outline-none focus:border-amber-500"><option value={0}>0%</option><option value={21}>21%</option></select>
                        </div>
                        <button onClick={() => deleteProduct(p.id)} className="text-red-400 hover:text-red-600 p-2 transition-colors"><Trash2 size={18} /></button>
                     </div>
                   ))}
                 </div>
              </div>

              <div className="bg-white p-4 md:p-6 rounded-2xl shadow-sm border mb-6">
                <div className="flex justify-between items-center mb-6">
                   <h3 className="font-bold flex items-center gap-2 text-slate-700"><Users size={20} className="text-amber-500"/> Verkopers Beheren</h3>
                 </div>
                 <div className="space-y-4">
                    <div className="flex gap-2 bg-slate-50 p-4 rounded-xl border border-dashed border-slate-300">
                      <input 
                        type="text" 
                        value={newSalesmanName} 
                        onChange={e => setNewSalesmanName(e.target.value)}
                        className="flex-1 border p-2 rounded-lg text-sm outline-none focus:border-amber-500" 
                        placeholder="Naam nieuwe verkoper..." 
                        onKeyDown={e => e.key === 'Enter' && addSalesman()}
                      />
                      <button onClick={addSalesman} className="bg-slate-900 text-white px-4 py-2 rounded-lg font-bold text-sm flex items-center gap-2 hover:bg-slate-800 transition-colors">
                        <UserPlus size={16} /> Toevoegen
                      </button>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {(company.salesmen || []).map(name => (
                        <div key={name} className="flex items-center justify-between p-3 bg-white border border-slate-200 rounded-xl hover:shadow-sm transition-all group">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 bg-slate-100 rounded-full flex items-center justify-center text-slate-500"><User size={16} /></div>
                            <span className="font-medium text-slate-700">{name}</span>
                          </div>
                          <button onClick={() => removeSalesman(name)} className="text-slate-400 hover:text-red-500 p-1 opacity-0 group-hover:opacity-100 transition-opacity"><Trash2 size={16} /></button>
                        </div>
                      ))}
                    </div>
                 </div>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pb-20">
                 <div className="bg-white p-6 rounded-2xl shadow-sm border space-y-4">
                   <h3 className="font-bold mb-4 text-slate-700 flex items-center gap-2"><Edit2 size={20} className="text-amber-500" /> Bedrijf</h3>
                   <div className="space-y-3">
                     <div>
                       <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-1">Naam</label>
                       <input type="text" value={company.name} onChange={e => setCompany({...company, name: e.target.value})} className="w-full border p-2 rounded text-sm outline-none focus:border-amber-500 transition-all" />
                     </div>
                     <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div>
                          <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-1">Adres Lijn 1</label>
                          <input type="text" value={company.address} onChange={e => setCompany({...company, address: e.target.value})} className="w-full border p-2 rounded text-sm outline-none focus:border-amber-500 transition-all" />
                        </div>
                        <div>
                          <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-1">Adres Lijn 2</label>
                          <input type="text" value={company.address2 || ''} onChange={e => setCompany({...company, address2: e.target.value})} className="w-full border p-2 rounded text-sm outline-none focus:border-amber-500 transition-all" />
                        </div>
                     </div>
                     <div>
                       <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-1">BTW Nummer</label>
                       <input type="text" value={company.vatNumber} onChange={e => setCompany({...company, vatNumber: e.target.value})} className="w-full border p-2 rounded text-sm outline-none focus:border-amber-500 transition-all" />
                     </div>
                     <div>
                       <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-1">Website</label>
                       <div className="relative">
                         < Globe size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                         <input type="text" value={company.website || ''} onChange={e => setCompany({...company, website: e.target.value})} className="w-full border p-2 pl-10 rounded text-sm outline-none focus:border-amber-500 transition-all" placeholder="www.voorbeeld.be" />
                       </div>
                     </div>
                     <div>
                       <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-1">Voetnoot Ticket</label>
                       <textarea value={company.footerMessage} onChange={e => setCompany({...company, footerMessage: e.target.value})} className="w-full border p-2 rounded text-sm outline-none focus:border-amber-500 transition-all h-20" />
                     </div>
                   </div>
                 </div>

                 <div className="bg-white p-6 rounded-2xl shadow-sm border">
                   <h3 className="font-bold mb-4 flex items-center gap-2 text-slate-700"><Printer size={18} className="text-amber-500"/> Printer</h3>
                   {!btSupported && (
                     <div className="mb-4 p-4 bg-amber-50 border border-amber-200 rounded-xl flex gap-3 text-xs text-amber-700">
                       <AlertTriangle size={24} className="shrink-0" />
                       <div>
                         <p className="font-bold mb-1">Bluetooth niet beschikbaar</p>
                         <p>Deze browser of dit apparaat ondersteunt Web Bluetooth niet. Gebruik de meest recente versie van <strong>Chrome of Edge</strong> op een desktop of Android apparaat.</p>
                       </div>
                     </div>
                   )}
                   <div className="mb-4 p-4 bg-slate-50 border rounded-xl">
                     <div className="flex justify-between items-center mb-2">
                       <span className="text-sm font-medium flex items-center gap-2"><Bluetooth size={16} className="text-blue-500"/> Status</span>
                       {btConnected ? <span className="text-[10px] bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-bold">Verbonden</span> : <span className="text-[10px] bg-slate-200 text-slate-600 px-2 py-0.5 rounded-full font-bold">Losgekoppeld</span>}
                     </div>
                     {btConnected ? (
                       <div className="space-y-3">
                         <p className="text-xs text-slate-500">Device: <strong>{btDeviceName}</strong></p>
                         <div className="flex gap-2">
                            <button onClick={handleBtTestPrint} disabled={isPrintingBt} className="flex-1 bg-white border py-1.5 rounded-lg text-xs font-bold disabled:opacity-50 flex items-center justify-center gap-1 hover:bg-slate-50 transition-colors shadow-sm">{isPrintingBt ? <Loader2 size={12} className="animate-spin" /> : null} Test Pagina</button>
                            <button onClick={handleBluetoothDisconnect} className="flex-1 bg-red-50 text-red-600 py-1.5 rounded-lg text-xs font-bold border border-red-100 hover:bg-red-100 transition-colors">Verbinding verbreken</button>
                         </div>
                       </div>
                     ) : (
                       <button 
                         onClick={handleBluetoothConnect} 
                         disabled={!btSupported || isConnectingBt} 
                         className="w-full bg-blue-600 hover:bg-blue-700 text-white py-2.5 rounded-lg text-sm font-bold disabled:opacity-50 flex items-center justify-center gap-2 transition-colors shadow-lg shadow-blue-100"
                       >
                         {isConnectingBt ? <Loader2 size={18} className="animate-spin" /> : <><Bluetooth size={18} /> Zoek Bluetooth Printer</>}
                       </button>
                     )}
                   </div>
                 </div>
              </div>
           </div>
        )}
      </main>

      <Receipt transaction={lastTransaction} company={company} openDrawer={isOpeningDrawer} />
      {previewTransaction && <div className="fixed inset-0 z-[110] bg-black/80 flex items-center justify-center p-4 backdrop-blur-sm animate-in fade-in duration-200"><div className="bg-white rounded-3xl max-w-xs w-full overflow-hidden shadow-2xl animate-in zoom-in-95 duration-200"><div className="p-4 bg-slate-100 flex justify-between items-center border-b"><strong>Afdrukvoorbeeld</strong><button onClick={() => setPreviewTransaction(null)} className="p-1 hover:bg-slate-200 rounded-full transition-colors"><X size={20}/></button></div><div className="p-4 bg-slate-50 overflow-y-auto max-h-[60vh] flex justify-center"><Receipt preview transaction={previewTransaction} company={company} /></div><div className="p-4 flex gap-2"><button onClick={() => setPreviewTransaction(null)} className="flex-1 border p-2 rounded-xl text-sm font-bold hover:bg-slate-50 transition-colors">Sluiten</button><button onClick={() => window.print()} className="flex-1 bg-amber-500 text-white p-2 rounded-xl font-black text-sm shadow-lg shadow-amber-200 hover:bg-amber-600 transition-colors">Nu Afdrukken</button></div></div></div>}
    </div>
  );
}
