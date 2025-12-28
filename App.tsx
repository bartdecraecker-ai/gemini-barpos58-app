import React, { useState, useMemo } from 'react';
import { ShoppingBag, Trash2, CreditCard, Banknote, Printer } from 'lucide-react';

// --- ALLES IN ÉÉN BESTAND VOOR STABILITEIT ---

const INITIAL_PRODUCTS = [
  { id: '1', name: 'Pils / Bier', price: 2.50, color: 'bg-amber-100', vatRate: 21 },
  { id: '2', name: 'Frisdrank', price: 2.20, color: 'bg-blue-100', vatRate: 21 },
  { id: '3', name: 'Wijn Rood/Wit', price: 3.50, color: 'bg-red-100', vatRate: 21 },
  { id: '4', name: 'Koffie / Thee', price: 2.00, color: 'bg-orange-100', vatRate: 21 },
  { id: '5', name: 'Chips / Snack', price: 1.50, color: 'bg-yellow-100', vatRate: 21 },
  { id: '6', name: 'Zware Bieren', price: 4.00, color: 'bg-orange-200', vatRate: 21 },
  { id: '7', name: 'Water', price: 2.00, color: 'bg-cyan-50', vatRate: 21 },
  { id: '8', name: 'Specialty', price: 5.00, color: 'bg-purple-100', vatRate: 21 },
];

export default function App() {
  const [cart, setCart] = useState([]);
  const [transactions, setTransactions] = useState([]);
  const [activeTab, setActiveTab] = useState('POS');
  const [showReceipt, setShowReceipt] = useState(null);
  const [isPayingCard, setIsPayingCard] = useState(false);

  const cartTotal = useMemo(() => cart.reduce((a, b) => a + (b.price * b.quantity), 0), [cart]);

  const addToCart = (product) => {
    setCart(prev => {
      const existing = prev.find(i => i.id === product.id);
      if (existing) return prev.map(i => i.id === product.id ? { ...i, quantity: i.quantity + 1 } : i);
      return [...prev, { ...product, quantity: 1 }];
    });
  };

  const finalize = (method) => {
    const newTx = {
      id: Math.random().toString(36).substr(2, 5).toUpperCase(),
      date: new Date().toLocaleTimeString(),
      items: [...cart],
      total: cartTotal,
      method
    };
    setTransactions([newTx, ...transactions]);
    setCart([]);
    setIsPayingCard(false);
    setShowReceipt(newTx);
  };

  return (
    <div className="flex flex-col h-screen bg-gray-100 font-sans text-gray-900 overflow-hidden">
      
      {/* HEADER */}
      <header className="bg-white border-b p-4 flex justify-between items-center shadow-sm">
        <div className="flex items-center gap-2 font-black text-xl italic">
          <div className="bg-black text-white p-1 rounded-lg"><ShoppingBag size={20}/></div>
          BAR POS
        </div>
        <div className="flex gap-2 bg-gray-100 p-1 rounded-xl">
          <button onClick={() => setActiveTab('POS')} className={`px-4 py-2 rounded-lg font-bold text-xs ${activeTab === 'POS' ? 'bg-white shadow text-black' : 'text-gray-500'}`}>KASSA</button>
          <button onClick={() => setActiveTab('REP')} className={`px-4 py-2 rounded-lg font-bold text-xs ${activeTab === 'REP' ? 'bg-white shadow text-black' : 'text-gray-500'}`}>HISTORIEK</button>
        </div>
      </header>

      <main className="flex-1 flex overflow-hidden">
        {activeTab === 'POS' ? (
          <>
            {/* GRID 4 OP EEN RIJ */}
            <div className="flex-1 p-4 grid grid-cols-2 lg:grid-cols-4 gap-4 overflow-y-auto content-start">
              {INITIAL_PRODUCTS.map(p => (
                <button key={p.id} onClick={() => addToCart(p)} className={`${p.color} p-8 rounded-[2rem] font-black shadow-sm flex flex-col items-center justify-center min-h-[130px] active:scale-95 transition-all border-b-4 border-black/10`}>
                  <span className="text-[11px] uppercase mb-1">{p.name}</span>
                  <span className="text-sm bg-white/50 px-3 py-0.5 rounded-full">€{p.price.toFixed(2)}</span>
                </button>
              ))}
            </div>

            {/* MANDJE */}
            <div className="w-80 bg-white border-l flex flex-col shadow-xl">
              <div className="p-6 font-black text-xs uppercase text-gray-400 tracking-widest text-center border-b">Bestelling</div>
              <div className="flex-1 overflow-y-auto p-4 space-y-3">
                {cart.map(item => (
                  <div key={item.id} className="flex justify-between items-center bg-gray-50 p-3 rounded-2xl">
                    <span className="font-bold text-[10px] uppercase truncate flex-1">{item.name}</span>
                    <div className="flex items-center gap-2">
                      <button onClick={() => setCart(cart.map(i => i.id === item.id ? {...i, quantity: i.quantity - 1} : i).filter(i => i.quantity > 0))} className="w-7 h-7 bg-white shadow-sm rounded-lg text-red-500 font-bold">-</button>
                      <span className="font-bold text-xs">{item.quantity}</span>
                      <button onClick={() => setCart(cart.map(i => i.id === item.id ? {...i, quantity: i.quantity + 1} : i))} className="w-7 h-7 bg-white shadow-sm rounded-lg text-green-500 font-bold">+</button>
                    </div>
                  </div>
                ))}
              </div>
              <div className="p-6 bg-black text-white rounded-t-[2.5rem]">
                <div className="flex justify-between text-2xl font-black mb-6 italic">
                  <span className="text-gray-500 text-xs self-center">TOTAAL</span>
                  <span className="text-yellow-400">€{cartTotal.toFixed(2)}</span>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <button onClick={() => finalize('CASH')} className="bg-green-600 p-4 rounded-xl font-black flex flex-col items-center text-[10px] uppercase"><Banknote size={20}/> Cash</button>
                  <button onClick={() => setIsPayingCard(true)} className="bg-blue-600 p-4 rounded-xl font-black flex flex-col items-center text-[10px] uppercase"><CreditCard size={20}/> Kaart</button>
                </div>
              </div>
            </div>
          </>
        ) : (
          /* HISTORIEK */
          <div className="flex-1 p-8 overflow-y-auto space-y-3 max-w-xl mx-auto">
            <h2 className="font-black text-2xl mb-6 italic">Laatste verkopen</h2>
            {transactions.map(tx => (
              <div key={tx.id} className="bg-white p-4 rounded-2xl border flex justify-between items-center shadow-sm">
                <div className="text-[10px] font-bold uppercase text-gray-400">{tx.date} - {tx.method}</div>
                <div className="font-black">€{tx.total.toFixed(2)}</div>
                <button onClick={() => setShowReceipt(tx)} className="text-yellow-600"><Printer size={18}/></button>
              </div>
            ))}
          </div>
        )}
      </main>

      {/* BON MODAL */}
      {showReceipt && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center p-4 z-[100] backdrop-blur-sm">
          <div className="bg-white p-8 rounded-[2rem] w-full max-w-xs shadow-2xl">
            <div className="text-center border-b border-dashed pb-4 mb-4">
              <h2 className="font-black text-xl italic">BAR POS</h2>
              <p className="text-[10px] text-gray-400 uppercase">Bedankt voor je bezoek!</p>
            </div>
            <div className="space-y-1 mb-4">
              {showReceipt.items.map(i => (
                <div key={i.id} className="flex justify-between text-xs font-bold uppercase">
                  <span>{i.quantity}x {i.name}</span>
                  <span>€{(i.price * i.quantity).toFixed(2)}</span>
                </div>
              ))}
            </div>
            <div className="border-t border-dashed pt-4 flex justify-between font-black text-lg">
              <span>TOTAAL</span>
              <span>€{showReceipt.total.toFixed(2)}</span>
            </div>
            <p className="text-[9px] text-center mt-6 text-gray-400">BON: #{showReceipt.id} | {showReceipt.method}</p>
            <button onClick={() => setShowReceipt(null)} className="w-full mt-6 bg-black text-white py-3 rounded-xl font-black text-xs uppercase tracking-widest">SLUITEN</button>
          </div>
        </div>
      )}

      {/* KAART BETALING */}
      {isPayingCard && (
        <div className="fixed inset-0 bg-blue-900 flex items-center justify-center z-[200] text-white">
          <div className="text-center">
            <CreditCard size={60} className="mx-auto mb-6 animate-pulse" />
            <h2 className="text-5xl font-black mb-10 italic">€{cartTotal.toFixed(2)}</h2>
            <button onClick={() => finalize('KAART')} className="bg-white text-blue-900 px-12 py-4 rounded-2xl font-black text-xl uppercase shadow-xl active:scale-95 transition-all">BETAALD</button>
            <button onClick={() => setIsPayingCard(false)} className="block mx-auto mt-8 text-blue-300 font-bold text-xs uppercase underline tracking-widest">Annuleren</button>
          </div>
        </div>
      )}
    </div>
  );
}
