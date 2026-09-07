import React, { useState, useEffect, useMemo } from 'react';
import { 
  CreditCard, Banknote, Trash2, Printer, Settings as SettingsIcon, 
  BarChart2, RefreshCw, Check, Lock, Store, Truck, LogOut, Plus, Edit, Bluetooth, HardDrive
} from 'lucide-react';
import type { 
  Product, CartItem, Transaction, CompanyDetails, SalesSession, PaymentMethod 
} from './types';
import { Receipt } from './components/Receipt';

export default function App() {
  // --- STATES & CONFIGURATIE ---
  const [mode, setMode] = useState<'shop' | 'tour' | null>(null);
  
  // Producten & Categorieën Initialisatie
  const [products, setProducts] = useState<Product[]>(() => {
    const saved = localStorage.getItem('krauker_products');
    return saved ? JSON.parse(saved) : [
      { id: '1', name: 'Krauker Anijs 33cl', price: 2.50, stock: 500, category: 'Bier' },
      { id: '2', name: 'Krauker Tripel 33cl', price: 2.80, stock: 300, category: 'Bier' },
      { id: '3', name: 'Krauker Crate (24 flessen)', price: 55.00, stock: 40, category: 'Crates' }
    ];
  });

  const [cart, setCart] = useState<CartItem[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>(() => {
    const saved = localStorage.getItem('krauker_transactions');
    return saved ? JSON.parse(saved) : [];
  });

  const [company, setCompany] = useState<CompanyDetails>(() => {
    const saved = localStorage.getItem('krauker_company');
    return saved ? JSON.parse(saved) : {
      name: 'Kraukerbier',
      address: 'Grote Markt 1',
      address2: '9300 Aalst',
      vatNumber: 'BE 0123.456.789',
      sellerName: 'Kassa 1',
      receiptHeader: 'Kruidig, Krachtig, Krauker',
      receiptFooter: 'Bedankt voor uw bezoek!'
    };
  });

  const [currentSession, setCurrentSession] = useState<SalesSession | null>(null);

  // Modals & Navigatie
  const [isPendingCardConfirmation, setIsPendingCardConfirmation] = useState<boolean>(false);
  const [showSuccess, setShowSuccess] = useState<boolean>(false);
  const [activeTab, setActiveTab] = useState<'kassa' | 'rapport' | 'producten' | 'instellingen'>('kassa');
  const [selectedCategory, setSelectedCategory] = useState<string>('Alles');

  // Product Form State (Instellingen/Productbeheer)
  const [newProductName, setNewProductName] = useState('');
  const [newProductPrice, setNewProductPrice] = useState('');
  const [newProductCategory, setNewProductCategory] = useState('Bier');
  const [newProductStock, setNewProductStock] = useState('');

  // PIN Beveiliging
  const [pinInput, setPinInput] = useState<string>('');
  const [isPinAuthenticated, setIsPinAuthenticated] = useState<boolean>(false);
  const PIN_CODE = '1234';

  // Bluetooth / Printer status
  const [printerStatus, setPrinterStatus] = useState<'disconnected' | 'connecting' | 'connected'>('disconnected');

  // LocalStorage Persistence
  useEffect(() => {
    localStorage.setItem('krauker_products', JSON.stringify(products));
  }, [products]);

  useEffect(() => {
    localStorage.setItem('krauker_transactions', JSON.stringify(transactions));
  }, [transactions]);

  useEffect(() => {
    localStorage.setItem('krauker_company', JSON.stringify(company));
  }, [company]);

  // --- HELPER: 8-CIJFERIG REFERENTIE ID ---
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

  const categories = useMemo(() => {
    const cats = Array.from(new Set(products.map(p => p.category || 'Algemeen')));
    return ['Alles', ...cats];
  }, [products]);

  const filteredProducts = useMemo(() => {
    if (selectedCategory === 'Alles') return products;
    return products.filter(p => (p.category || 'Algemeen') === selectedCategory);
  }, [products, selectedCategory]);

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

    // GENERATIE VAN DE 8-CIJFERIGE ID
    const random8Id = generate8DigitId();

    const tx: Transaction = {
      id: random8Id,
      sessionId: currentSession?.id || `SESSION_${mode?.toUpperCase()}`,
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

  // --- PRODUCT BEHEER ---
  const handleAddProduct = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newProductName || !newProductPrice) return;

    const newProd: Product = {
      id: Date.now().toString(),
      name: newProductName,
      price: parseFloat(newProductPrice),
      category: newProductCategory,
      stock: newProductStock ? parseInt(newProductStock, 10) : 0
    };

    setProducts(prev => [...prev, newProd]);
    setNewProductName('');
    setNewProductPrice('');
    setNewProductStock('');
  };

  const handleDeleteProduct = (id: string) => {
    setProducts(prev => prev.filter(p => p.id !== id));
  };

  // --- AFDRUKKEN (BROWSER TICKET) ---
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

  // PIN BEVESTIGING
  const handlePinSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (pinInput === PIN_CODE) {
      setIsPinAuthenticated(true);
      setPinInput('');
    } else {
      alert('Onjuiste PIN-code');
      setPinInput('');
    }
  };

  // 1. STARTSCHERM: MODUS KEUZE (SHOP / TOUR)
  if (!mode) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center p-6 text-white font-sans">
        <div className="max-w-md w-full text-center space-y-8">
          <div>
            <h1 className="text-4xl font-extrabold tracking-tight text-white mb-2">{company.name}</h1>
            <p className="text-slate-400 text-sm">Selecteer de gewenste kassa-modus om te starten</p>
          </div>

          <div className="grid grid-cols-1 gap-4">
            <button
              onClick={() => setMode('shop')}
              className="bg-slate-800 hover:bg-slate-700 border-2 border-slate-700 hover:border-sky-500 p-6 rounded-3xl transition-all flex items-center gap-5 text-left shadow-xl group"
            >
              <div className="w-14 h-14 bg-sky-500/10 text-sky-400 rounded-2xl flex items-center justify-center group-hover:bg-sky-500 group-hover:text-white transition-all">
                <Store size={28} />
              </div>
              <div>
                <div className="text-lg font-bold text-white">Vaste Shop</div>
                <div className="text-xs text-slate-400 mt-0.5">Standaard assortiment & voorraad</div>
              </div>
            </button>

            <button
              onClick={() => setMode('tour')}
              className="bg-slate-800 hover:bg-slate-700 border-2 border-slate-700 hover:border-amber-500 p-6 rounded-3xl transition-all flex items-center gap-5 text-left shadow-xl group"
            >
              <div className="w-14 h-14 bg-amber-500/10 text-amber-400 rounded-2xl flex items-center justify-center group-hover:bg-amber-500 group-hover:text-white transition-all">
                <Truck size={28} />
              </div>
              <div>
                <div className="text-lg font-bold text-white">On Tour / Event</div>
                <div className="text-xs text-slate-400 mt-0.5">Mobiele verkoop & evenementen</div>
              </div>
            </button>
          </div>
        </div>
      </div>
    );
  }

  // 2. HOOFD KASSA INTERFACE
  return (
    <div className="flex h-screen bg-slate-100 text-slate-800 font-sans overflow-hidden">
      
      {/* SIDEBAR NAVIGATIE */}
      <div className="w-20 bg-slate-900 flex flex-col items-center py-6 gap-6 text-white shadow-xl justify-between">
        <div className="flex flex-col gap-6 items-center w-full">
          <button 
            onClick={() => setActiveTab('kassa')} 
            className={`p-3 rounded-xl transition-all ${activeTab === 'kassa' ? 'bg-sky-600 text-white' : 'text-slate-400 hover:text-white'}`}
            title="Kassa"
          >
            <CreditCard size={24} />
          </button>
          <button 
            onClick={() => setActiveTab('rapport')} 
            className={`p-3 rounded-xl transition-all ${activeTab === 'rapport' ? 'bg-sky-600 text-white' : 'text-slate-400 hover:text-white'}`}
            title="Rapportage"
          >
            <BarChart2 size={24} />
          </button>
          <button 
            onClick={() => {
              setActiveTab('instellingen');
              setIsPinAuthenticated(false);
            }} 
            className={`p-3 rounded-xl transition-all ${activeTab === 'instellingen' ? 'bg-sky-600 text-white' : 'text-slate-400 hover:text-white'}`}
            title="Instellingen"
          >
            <SettingsIcon size={24} />
          </button>
        </div>

        <button
          onClick={() => setMode(null)}
          className="p-3 text-slate-500 hover:text-rose-400 transition-all"
          title="Wissel van Modus"
        >
          <LogOut size={22} />
        </button>
      </div>

      {/* TAB 1: KASSA */}
      {activeTab === 'kassa' && (
        <div className="flex flex-1 overflow-hidden">
          {/* PRODUCTEN OVERZICHT (LINKS) */}
          <div className="flex-1 p-6 overflow-y-auto flex flex-col">
            <div className="flex justify-between items-center mb-4">
              <h1 className="text-2xl font-bold text-slate-900">
                Producten <span className="text-xs bg-slate-200 text-slate-600 uppercase px-2 py-1 rounded-md ml-2">{mode}</span>
              </h1>
            </div>

            {/* CATEGORIE FILTER */}
            <div className="flex gap-2 mb-6 overflow-x-auto pb-2">
              {categories.map(cat => (
                <button
                  key={cat}
                  onClick={() => setSelectedCategory(cat)}
                  className={`px-4 py-2 rounded-xl text-sm font-semibold transition-all whitespace-nowrap ${
                    selectedCategory === cat 
                      ? 'bg-slate-900 text-white shadow-md' 
                      : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>

            {/* PRODUCT GRID */}
            <div className="grid grid-cols-4 gap-4 flex-1 align-content-start">
              {filteredProducts.length === 0 ? (
                <div className="col-span-4 text-center py-12 text-slate-400 bg-white rounded-2xl border border-dashed border-slate-300">
                  Geen producten in deze categorie.
                </div>
              ) : (
                filteredProducts.map(product => (
                  <button
                    key={product.id}
                    onClick={() => addToCart(product)}
                    className="bg-white p-4 rounded-2xl shadow-sm border border-slate-200 hover:border-sky-500 hover:shadow-md transition-all flex flex-col justify-between h-32 text-left group"
                  >
                    <div>
                      <span className="font-bold text-slate-800 line-clamp-2 group-hover:text-sky-600 transition-colors">{product.name}</span>
                      {product.stock !== undefined && (
                        <span className="text-[10px] text-slate-400 block mt-1">Voorraad: {product.stock}</span>
                      )}
                    </div>
                    <span className="text-lg font-black text-sky-600">€{product.price.toFixed(2)}</span>
                  </button>
                ))
              )}
            </div>
          </div>

          {/* WINKELMAND & BETAALKNOPPEN (RECHTS) */}
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
                    <button onClick={() => removeFromCart(item.id)} className="text-slate-400 hover:text-rose-500 font-bold px-1">
                      ×
                    </button>
                  </div>
                </div>
              ))}
            </div>

            {/* BETAALMETHODEN */}
            <div className="p-4 bg-slate-50 border-t border-slate-200 space-y-4">
              <div className="flex justify-between text-xl font-black text-slate-900">
                <span>Totaal</span>
                <span>€{totals.total.toFixed(2)}</span>
              </div>

              <div className="grid grid-cols-2 gap-3">
                {/* CONTANT */}
                <button
                  onClick={() => finalizePayment('Cash')}
                  disabled={cart.length === 0}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white h-16 rounded-2xl font-bold uppercase text-sm flex items-center justify-center gap-2 shadow-md disabled:opacity-40 transition-all"
                >
                  <Banknote size={20} /> Contant
                </button>

                {/* KAART (OPENT BEVESTIGINGSMODAL) */}
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

      {/* TAB 2: RAPPORTEN */}
      {activeTab === 'rapport' && (
        <div className="flex-1 p-8 overflow-y-auto">
          <h1 className="text-2xl font-bold mb-6">Dagrapportage</h1>
          <div className="grid grid-cols-3 gap-6 max-w-4xl mb-8">
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
              <h2 className="font-bold text-slate-500 text-xs uppercase mb-2">Totale Omzet</h2>
              <div className="text-3xl font-black text-emerald-600">
                €{transactions.reduce((acc, t) => acc + t.total, 0).toFixed(2)}
              </div>
            </div>
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
              <h2 className="font-bold text-slate-500 text-xs uppercase mb-2">Aantal Transacties</h2>
              <div className="text-3xl font-black text-slate-800">
                {transactions.length}
              </div>
            </div>
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
              <h2 className="font-bold text-slate-500 text-xs uppercase mb-2">Gemiddelde Bon</h2>
              <div className="text-3xl font-black text-sky-600">
                €{transactions.length > 0 ? (transactions.reduce((acc, t) => acc + t.total, 0) / transactions.length).toFixed(2) : '0.00'}
              </div>
            </div>
          </div>

          {/* HISTORIEK */}
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 max-w-4xl overflow-hidden">
            <div className="p-4 border-b font-bold text-slate-800">Laatste Transacties</div>
            <div className="divide-y">
              {transactions.slice(0, 10).map(tx => (
                <div key={tx.id} className="p-4 flex justify-between items-center hover:bg-slate-50">
                  <div>
                    <div className="font-bold text-slate-800">Ref: #{tx.id}</div>
                    <div className="text-xs text-slate-400">{tx.dateStr} {tx.timeStr} • {tx.paymentMethod}</div>
                  </div>
                  <div className="flex items-center gap-4">
                    <span className="font-bold text-slate-900">€{tx.total.toFixed(2)}</span>
                    <button 
                      onClick={() => handlePrintBrowserTicket(tx)}
                      className="p-2 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-100"
                    >
                      <Printer size={16} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: INSTELLINGEN (BEVEILIGD MET PIN) */}
      {activeTab === 'instellingen' && (
        <div className="flex-1 p-8 overflow-y-auto">
          {!isPinAuthenticated ? (
            <div className="max-w-sm mx-auto mt-12 bg-white p-6 rounded-3xl shadow-md text-center space-y-4">
              <Lock className="mx-auto text-slate-400" size={32} />
              <h2 className="font-bold text-lg">Voer PIN in voor Instellingen</h2>
              <form onSubmit={handlePinSubmit} className="space-y-4">
                <input
                  type="password"
                  value={pinInput}
                  onChange={e => setPinInput(e.target.value)}
                  placeholder="PIN-code"
                  className="w-full text-center border p-3 rounded-xl text-lg tracking-widest"
                  maxLength={4}
                />
                <button type="submit" className="w-full bg-slate-900 text-white py-3 rounded-xl font-bold">
                  Ontgrendelen
                </button>
              </form>
            </div>
          ) : (
            <div className="max-w-4xl space-y-8">
              {/* BEDRIJFSGEGEVENS */}
              <div className="bg-white p-6 rounded-3xl shadow-sm border space-y-6">
                <h1 className="text-xl font-bold border-b pb-3">Bedrijfsgegevens & Ticket Footer</h1>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs font-bold text-slate-500">Zaaknaam</label>
                    <input
                      type="text"
                      value={company.name}
                      onChange={e => setCompany({ ...company, name: e.target.value })}
                      className="w-full border p-2 rounded-xl mt-1 text-sm"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-bold text-slate-500">BTW-nummer</label>
                    <input
                      type="text"
                      value={company.vatNumber}
                      onChange={e => setCompany({ ...company, vatNumber: e.target.value })}
                      className="w-full border p-2 rounded-xl mt-1 text-sm"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-bold text-slate-500">Adresregel 1</label>
                    <input
                      type="text"
                      value={company.address}
                      onChange={e => setCompany({ ...company, address: e.target.value })}
                      className="w-full border p-2 rounded-xl mt-1 text-sm"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-bold text-slate-500">Adresregel 2 (Postcode / Stad)</label>
                    <input
                      type="text"
                      value={company.address2 || ''}
                      onChange={e => setCompany({ ...company, address2: e.target.value })}
                      className="w-full border p-2 rounded-xl mt-1 text-sm"
                    />
                  </div>
                </div>
              </div>

              {/* PRODUCTBEHEER */}
              <div className="bg-white p-6 rounded-3xl shadow-sm border space-y-6">
                <h2 className="text-xl font-bold border-b pb-3">Producten Beheren</h2>
                
                <form onSubmit={handleAddProduct} className="grid grid-cols-5 gap-3">
                  <input
                    type="text"
                    placeholder="Productnaam"
                    value={newProductName}
                    onChange={e => setNewProductName(e.target.value)}
                    className="border p-2 rounded-xl text-sm col-span-2"
                  />
                  <input
                    type="number"
                    step="0.01"
                    placeholder="Prijs (€)"
                    value={newProductPrice}
                    onChange={e => setNewProductPrice(e.target.value)}
                    className="border p-2 rounded-xl text-sm"
                  />
                  <input
                    type="text"
                    placeholder="Categorie"
                    value={newProductCategory}
                    onChange={e => setNewProductCategory(e.target.value)}
                    className="border p-2 rounded-xl text-sm"
                  />
                  <button type="submit" className="bg-sky-600 text-white rounded-xl font-bold text-sm flex items-center justify-center gap-1">
                    <Plus size={16} /> Toevoegen
                  </button>
                </form>

                <div className="divide-y border-t mt-4">
                  {products.map(p => (
                    <div key={p.id} className="py-3 flex justify-between items-center text-sm">
                      <div>
                        <span className="font-bold">{p.name}</span>
                        <span className="text-xs text-slate-400 ml-2">({p.category})</span>
                      </div>
                      <div className="flex items-center gap-4">
                        <span className="font-bold">€{p.price.toFixed(2)}</span>
                        <button onClick={() => handleDeleteProduct(p.id)} className="text-rose-500 hover:text-rose-700">
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* POPUP: BEVESTIGING KAARTBETALING */}
      {isPendingCardConfirmation && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-3xl p-6 max-w-sm w-full text-center space-y-6 shadow-2xl">
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

      {/* POPUP: SUCCES & TICKET AFDRUKKEN */}
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
