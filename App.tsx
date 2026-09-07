import React, { useState, useMemo } from 'react';
import { 
  CreditCard, Banknote, Trash2, Printer, Settings as SettingsIcon, 
  BarChart2, Check 
} from 'lucide-react';
import type { 
  Product, CartItem, Transaction, CompanyDetails, SalesSession, PaymentMethod 
} from './types';
import { Receipt } from './components/Receipt';

export default function App() {
  // --- STATES ---
  const [products, setProducts] = useState<Product[]>([]);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [company, setCompany] = useState<CompanyDetails>({
    name: 'Mijn Zaak',
    address: 'Straatnaam 123',
    address2: '9000 Gent',
    vatNumber: 'BE 0123.456.789',
    sellerName: 'Kassa 1',
    receiptHeader: 'Welkom!',
    receiptFooter: 'Bedankt en tot ziens!'
  });
  const [currentSession, setCurrentSession] = useState<SalesSession | null>(null);

  // Modals & UI States
  const [isPendingCardConfirmation, setIsPendingCardConfirmation] = useState<boolean>(false);
  const [showSuccess, setShowSuccess] = useState<boolean>(false);
  const [activeTab, setActiveTab] = useState<'kassa' | 'rapport' | 'instellingen'>('kassa');

  // Helper voor 8-cijferige random ID (bijv. "48291039")
  const generate8DigitId = (): string => {
    return Math.floor(10000000 + Math.random() * 90000000).toString();
  };

  // --- BEREKENINGEN ---
  const totals = useMemo(() => {
    const total = cart.reduce((acc, item) => acc + item.price * item.quantity, 0);
    const sub = total / 1.21;
    const vHigh = total - sub;
    return { total, sub, v0: 0, vHigh };
  }, [cart]);

  // --- KASSA ACTIES ---
  const addToCart = (product: Product) => {
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

  const removeFromCart = (productId: string) => {
    setCart(prev => prev.filter(item => item.id !== productId));
  };

  const clearCart = () => setCart([]);

  const applyStockReduction = (items: CartItem[]) => {
    setProducts(prevProducts =>
      prevProducts.map(p => {
        const cartItem = items.find(ci => ci.id === p.id);
        if (cartItem && p.stock !== undefined) {
          return { ...p, stock: Math.max(0, p.stock - cartItem.quantity) };
        }
        return p;
      })
    );
  };

  // --- TRANSACTIE AFHANDELING ---
  const finalizePayment = async (method: PaymentMethod) => {
    setIsPendingCardConfirmation(false);

    if (cart.length === 0) return;

    const now = Date.now();
    const dateObj = new Date(now);
    const formattedDate = dateObj.toLocaleDateString('nl-BE');
    const formattedTime = dateObj.toLocaleTimeString('nl-BE', { hour: '2-digit', minute: '2-digit' });

    // RANDOM 8-DIGIT REFERENTIE ID
    const random8Id = generate8DigitId();

    const tx: Transaction = {
      id: random8Id, // 8-digit random id (bijv. 83920147)
      sessionId: currentSession?.id || 'DEFAULT_SESSION',
      timestamp: now,
      dateStr: formattedDate,
      timeStr: formattedTime,
      items: [...cart],
      subtotal: totals.sub,
      vat0: totals.v0,
      vatHigh: totals.vHigh,
      total: totals.total,
      paymentMethod: method,
      salesmanName: company.sellerName,
      updatedAt: now
    };

    applyStockReduction(cart);
    setTransactions(prev => [tx, ...prev]);
    setCart([]);
    setShowSuccess(true);

    setTimeout(() => {
      setShowSuccess(false);
    }, 2500);
  };

  // --- AFDRUKKEN (BROWSER) ---
  const handlePrintBrowserTicket = (tx: Transaction) => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    printWindow.document.write(`
      <html>
        <head>
          <title>Kassaticket #${tx.id}</title>
          <style>
            body { font-family: monospace; padding: 15px; width: 260px; margin: 0 auto; text-align: center; color: #000; }
            .header { font-weight: bold; font-size: 14px; margin-bottom: 2px; }
            .address { font-size: 11px; margin-bottom: 2px; }
            .info { font-size: 10px; margin-top: 8px; margin-bottom: 8px; border-bottom: 1px dashed #000; padding-bottom: 5px; text-align: left; }
            .item { display: flex; justify-content: space-between; font-size: 11px; margin: 3px 0; }
            .totals { border-top: 1px dashed #000; margin-top: 8px; padding-top: 5px; text-align: right; font-size: 12px; font-weight: bold; }
            .footer { margin-top: 12px; font-size: 10px; border-top: 1px dashed #000; padding-top: 5px; font-style: italic; }
          </style>
        </head>
        <body>
          <div class="header">${company.name}</div>
          ${company.address ? `<div class="address">${company.address}</div>` : ''}
          ${company.address2 ? `<div class="address">${company.address2}</div>` : ''}
          ${company.vatNumber ? `<div class="address">BTW: ${company.vatNumber}</div>` : ''}
          ${company.receiptHeader ? `<div class="footer">${company.receiptHeader}</div>` : ''}
          
          <div class="info">
            <div style="font-weight: bold;">Ref: #${tx.id}</div>
            <div>Datum: ${tx.dateStr} ${tx.timeStr || ''}</div>
            <div>Bediende: ${tx.salesmanName || 'Kassa'}</div>
          </div>

          ${tx.items.map(i => `
            <div class="item">
              <span>${i.quantity}x ${i.name}</span>
              <span>€${(i.price * i.quantity).toFixed(2)}</span>
            </div>
          `).join('')}

          <div class="totals">
            <div>TOTAAL: €${tx.total.toFixed(2)}</div>
            <div style="font-size: 10px; font-weight: normal; margin-top: 2px;">Betaald via: ${tx.paymentMethod}</div>
          </div>

          <div class="footer">${company.receiptFooter || 'Bedankt voor uw bezoek!'}</div>
        </body>
      </html>
    `);
    printWindow.document.close();
    printWindow.focus();
    printWindow.print();
    printWindow.close();
  };

  return (
    <div className="flex h-screen bg-slate-100 text-slate-800 font-sans overflow-hidden">
      
      {/* SIDEBAR NAVIGATION */}
      <div className="w-20 bg-slate-900 flex flex-col items-center py-6 gap-6 text-white shadow-xl">
        <button 
          onClick={() => setActiveTab('kassa')} 
          className={`p-3 rounded-xl transition-all ${activeTab === 'kassa' ? 'bg-sky-600 text-white' : 'text-slate-400 hover:text-white'}`}
        >
          <CreditCard size={24} />
        </button>
        <button 
          onClick={() => setActiveTab('rapport')} 
          className={`p-3 rounded-xl transition-all ${activeTab === 'rapport' ? 'bg-sky-600 text-white' : 'text-slate-400 hover:text-white'}`}
        >
          <BarChart2 size={24} />
        </button>
        <button 
          onClick={() => setActiveTab('instellingen')} 
          className={`p-3 rounded-xl transition-all ${activeTab === 'instellingen' ? 'bg-sky-600 text-white' : 'text-slate-400 hover:text-white'}`}
        >
          <SettingsIcon size={24} />
        </button>
      </div>

      {/* MAIN LAYOUT */}
      {activeTab === 'kassa' && (
        <div className="flex flex-1 overflow-hidden">
          {/* PRODUCT GRID (LINKS) */}
          <div className="flex-1 p-6 overflow-y-auto">
            <h1 className="text-2xl font-bold mb-4 text-slate-900">Producten</h1>
            <div className="grid grid-cols-4 gap-4">
              {products.map(product => (
                <button
                  key={product.id}
                  onClick={() => addToCart(product)}
                  className="bg-white p-4 rounded-2xl shadow-sm border border-slate-200 hover:border-sky-500 hover:shadow-md transition-all flex flex-col justify-between h-32 text-left"
                >
                  <span className="font-bold text-slate-800 line-clamp-2">{product.name}</span>
                  <span className="text-lg font-black text-sky-600">€{product.price.toFixed(2)}</span>
                </button>
              ))}
            </div>
          </div>

          {/* WINKELMAND & BETALING (RECHTS) */}
          <div className="w-96 bg-white border-l border-slate-200 flex flex-col h-full shadow-lg">
            <div className="p-4 border-b border-slate-100 flex justify-between items-center">
              <h2 className="font-bold text-lg text-slate-800">Bestelling</h2>
              {cart.length > 0 && (
                <button onClick={clearCart} className="text-rose-500 hover:text-rose-700 p-1">
                  <Trash2 size={18} />
                </button>
              )}
            </div>

            {/* ARTIKELLIJST */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {cart.map(item => (
                <div key={item.id} className="flex justify-between items-center bg-slate-50 p-3 rounded-xl border border-slate-100">
                  <div>
                    <div className="font-semibold text-sm">{item.name}</div>
                    <div className="text-xs text-slate-500">{item.quantity}x €{item.price.toFixed(2)}</div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="font-bold text-sm">€{(item.price * item.quantity).toFixed(2)}</span>
                    <button onClick={() => removeFromCart(item.id)} className="text-slate-400 hover:text-rose-500">
                      ×
                    </button>
                  </div>
                </div>
              ))}
            </div>

            {/* ACTIES & BETAALKNOPPEN */}
            <div className="p-4 bg-slate-50 border-t border-slate-200 space-y-4">
              <div className="flex justify-between text-xl font-black text-slate-900">
                <span>Totaal</span>
                <span>€{totals.total.toFixed(2)}</span>
              </div>

              <div className="grid grid-cols-2 gap-3">
                {/* CONTANT BETALEN */}
                <button
                  onClick={() => finalizePayment('Cash')}
                  disabled={cart.length === 0}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white h-16 rounded-2xl font-bold uppercase text-sm flex items-center justify-center gap-2 shadow-md disabled:opacity-40 transition-all"
                >
                  <Banknote size={20} /> Contant
                </button>

                {/* KAARTBETALING (TRIGGERT BEVESTIGINGSMODAL) */}
                <button
                  onClick={() => setIsPendingCardConfirmation(true)}
                  disabled={cart.length === 0}
                  className="bg-sky-600 hover:bg-sky-700 text-white h-16 rounded-2xl font-bold uppercase text-sm flex items-center justify-center gap-2 shadow-md disabled:opacity-40 transition-all"
                >
                  <CreditCard size={20} /> Kaart
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* BEVESTIGINGSMODAL VOOR KAARTBETALING */}
      {isPendingCardConfirmation && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-3xl p-6 max-w-sm w-full text-center space-y-6 shadow-2xl animate-in fade-in zoom-in-95 duration-150">
            <div className="w-16 h-16 bg-sky-100 text-sky-600 rounded-full flex items-center justify-center mx-auto">
              <CreditCard size={32} />
            </div>

            <div>
              <h3 className="text-xl font-bold text-slate-900">Kaartbetaling</h3>
              <p className="text-slate-500 text-sm mt-1">
                Ontvang <span className="font-bold text-slate-800">€{totals.total.toFixed(2)}</span> op de betaalterminal. Is de betaling geslaagd?
              </p>
            </div>

            <div className="flex flex-col gap-3">
              <button
                onClick={() => finalizePayment('Bancontact')}
                className="w-full bg-emerald-600 hover:bg-emerald-700 text-white py-3.5 rounded-xl font-bold text-sm shadow-lg transition-all flex items-center justify-center gap-2"
              >
                <Check size={18} /> Betaling Bevestigen
              </button>
              <button
                onClick={() => setIsPendingCardConfirmation(false)}
                className="w-full bg-slate-100 hover:bg-slate-200 text-slate-600 py-3.5 rounded-xl font-semibold text-sm transition-all"
              >
                Annuleren
              </button>
            </div>
          </div>
        </div>
      )}

      {/* SUCCES MODAL MET TICKET PREVIEW */}
      {showSuccess && transactions.length > 0 && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-3xl p-6 max-w-xs w-full text-center space-y-4 shadow-2xl">
            <div className="w-12 h-12 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto">
              <Check size={24} />
            </div>
            <h3 className="font-bold text-lg">Betaling Geslaagd!</h3>
            
            <Receipt transaction={transactions[0]} company={company} />

            <button
              onClick={() => handlePrintBrowserTicket(transactions[0])}
              className="w-full bg-slate-900 hover:bg-slate-800 text-white py-3 rounded-xl font-semibold text-xs flex items-center justify-center gap-2"
            >
              <Printer size={16} /> Ticket Afdrukken
            </button>
          </div>
        </div>
      )}

    </div>
  );
}
