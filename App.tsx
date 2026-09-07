import React, { useState, useEffect } from 'react';
import { 
  Trash2, 
  Edit2, 
  Plus, 
  X, 
  Download, 
  RotateCcw, 
  CreditCard, 
  CheckCircle,
  ShoppingBag,
  History,
  Settings,
  Users
} from 'lucide-react';

// Mock data en types
export enum PaymentMethod {
  CASH = 'CASH',
  CARD = 'CARD'
}

export interface Product {
  id: string;
  name: string;
  price: number;
  vatRate: number;
  stock?: number;
  color?: string;
  updatedAt?: number;
}

export interface Company {
  name: string;
  sellerName: string;
  salesmen: string[];
  updatedAt?: number;
}

export interface Transaction {
  id: string;
  total: number;
  method: PaymentMethod;
  timestamp: number;
}

export interface Session {
  id: string;
  startTime: number;
  endTime?: number;
  startCash: number;
  endCash?: number;
  transactions: Transaction[];
}

// Dummy Receipt Component
const Receipt = ({ company, transaction, session }: { company: Company; transaction?: Transaction | null; session?: Session | null }) => (
  <div className="p-4 bg-white rounded-lg text-slate-800 font-mono text-xs space-y-2">
    <div className="text-center font-bold text-sm uppercase">{company.name}</div>
    <div className="text-center text-[10px] text-slate-500">Bediend door: {company.sellerName}</div>
    <hr className="my-2 border-dashed" />
    {transaction && (
      <div>
        <div className="flex justify-between font-bold">
          <span>Totaal</span>
          <span>€{transaction.total.toFixed(2)}</span>
        </div>
        <div className="text-[10px] text-slate-500">Betaalmethode: {transaction.method}</div>
      </div>
    )}
    {session && (
      <div>
        <div className="font-bold border-b pb-1 mb-1">Shift Samenvatting</div>
        <div>Start contant: €{session.startCash.toFixed(2)}</div>
        {session.endCash !== undefined && <div>Eind contant: €{session.endCash.toFixed(2)}</div>}
        <div>Aantal transacties: {session.transactions.length}</div>
      </div>
    )}
  </div>
);

export default function App() {
  const [activeTab, setActiveTab] = useState<'POS' | 'HISTORY' | 'SETTINGS'>('POS');
  const [activeMode, setActiveMode] = useState<'DEFAULT' | 'CUSTOM'>('DEFAULT');

  // State
  const [company, setCompany] = useState<Company>({
    name: 'Krauker Anijs',
    sellerName: 'Beheerder',
    salesmen: ['Beheerder', 'Medewerker 1']
  });

  const [products, setProducts] = useState<Product[]>([
    { id: '1', name: 'Krauker Anijs 33cl', price: 2.50, vatRate: 21, stock: 120, color: 'bg-amber-400' },
    { id: '2', name: 'Krauker Glas', price: 3.00, vatRate: 21, stock: 45, color: 'bg-sky-400' }
  ]);

  const [sessions, setSessions] = useState<Session[]>([
    {
      id: 'sess-1',
      startTime: Date.now() - 3600000 * 4,
      endTime: Date.now() - 3600000,
      startCash: 100.00,
      endCash: 175.00,
      transactions: [
        { id: 'tx-1', total: 25.00, method: PaymentMethod.CASH, timestamp: Date.now() - 3600000 * 3 },
        { id: 'tx-2', total: 50.00, method: PaymentMethod.CARD, timestamp: Date.now() - 3600000 * 2 }
      ]
    }
  ]);

  const [currentSession, setCurrentSession] = useState<Session | null>(sessions[0]);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [newStaffName, setNewStaffName] = useState('');
  const [showSalesmanSelection, setShowSalesmanSelection] = useState(false);
  const [isPendingCardConfirmation, setIsPendingCardConfirmation] = useState(false);
  const [isClosingSession, setIsClosingSession] = useState(false);
  const [endCashInput, setEndCashInput] = useState('');
  const [previewTransaction, setPreviewTransaction] = useState<Transaction | null>(null);
  const [previewSession, setPreviewSession] = useState<Session | null>(null);
  const [showSuccess, setShowSuccess] = useState(false);

  const totals = { total: 12.50 };

  // Handlers
  const exportData = (type: string) => {
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(products, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute("href", dataStr);
    downloadAnchor.setAttribute("download", `${type.toLowerCase()}_export.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  const addStaff = () => {
    if (!newStaffName.trim()) return;
    setCompany(prev => ({ ...prev, salesmen: [...prev.salesmen, newStaffName.trim()] }));
    setNewStaffName('');
  };

  const removeStaff = (name: string) => {
    setCompany(prev => ({ ...prev, salesmen: prev.salesmen.filter(s => s !== name) }));
  };

  const handleResetToDefaults = () => {
    if (confirm('Weet je zeker dat je alle gegevens wilt herstellen naar de standaardwaarden?')) {
      setActiveMode('DEFAULT');
    }
  };

  const setPreviewSessionHandler = (session: Session) => {
    setPreviewSession(session);
  };

  const deleteSessionFromHistory = (id: string) => {
    setSessions(prev => prev.filter(s => s.id !== id));
  };

  const finalizePayment = (method: PaymentMethod) => {
    setIsPendingCardConfirmation(false);
    setShowSuccess(true);
    setTimeout(() => setShowSuccess(false), 3000);
  };

  const closeSession = (cash: number) => {
    if (currentSession) {
      const updated = { ...currentSession, endTime: Date.now(), endCash: cash };
      setSessions(prev => prev.map(s => s.id === updated.id ? updated : s));
      setCurrentSession(null);
    }
    setIsClosingSession(false);
  };

  return (
    <div className="flex h-screen bg-slate-100 font-sans text-slate-900 overflow-hidden">
      {/* Sidebar Navigation */}
      <aside className="w-20 bg-slate-900 flex flex-col items-center py-6 gap-6 shrink-0">
        <div className="w-10 h-10 bg-indigo-500 rounded-2xl flex items-center justify-center text-white font-black text-xl">
          K
        </div>
        <nav className="flex flex-col gap-4 w-full px-3">
          <button 
            onClick={() => setActiveTab('POS')} 
            className={`p-3 rounded-2xl flex items-center justify-center transition-colors ${activeTab === 'POS' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-white hover:bg-slate-800'}`}
            title="Kassa"
          >
            <ShoppingBag size={20} />
          </button>
          <button 
            onClick={() => setActiveTab('HISTORY')} 
            className={`p-3 rounded-2xl flex items-center justify-center transition-colors ${activeTab === 'HISTORY' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-white hover:bg-slate-800'}`}
            title="Historiek"
          >
            <History size={20} />
          </button>
          <button 
            onClick={() => setActiveTab('SETTINGS')} 
            className={`p-3 rounded-2xl flex items-center justify-center transition-colors ${activeTab === 'SETTINGS' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-white hover:bg-slate-800'}`}
            title="Instellingen"
          >
            <Settings size={20} />
          </button>
        </nav>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 overflow-hidden relative">
        {activeTab === 'POS' && (
          <div className="p-6 h-full flex flex-col justify-between">
            <div>
              <h2 className="text-2xl font-black tracking-tight">Kassa Dashboard</h2>
              <p className="text-slate-500 text-sm mt-1">Actieve medewerker: <span className="font-bold text-indigo-600">{company.sellerName}</span></p>
            </div>
            <div className="flex gap-3">
              <button 
                onClick={() => setShowSalesmanSelection(true)}
                className="px-4 py-3 bg-white border rounded-2xl font-bold text-xs flex items-center gap-2 hover:bg-slate-50"
              >
                <Users size={16} /> Wissel Medewerker
              </button>
              <button 
                onClick={() => setIsPendingCardConfirmation(true)}
                className="px-6 py-3 bg-indigo-600 text-white rounded-2xl font-bold text-xs uppercase tracking-wider shadow-lg hover:bg-indigo-700"
              >
                Afrekenen (€{totals.total.toFixed(2)})
              </button>
            </div>
          </div>
        )}

        {activeTab === 'HISTORY' && (
          <div className="h-full overflow-y-auto p-6 space-y-6 pb-24 custom-scrollbar">
            <h2 className="text-2xl font-black tracking-tighter">Historiek & Shiften</h2>
            <div className="space-y-4">
              {sessions.map(s => (
                <div key={s.id} className="bg-white p-5 rounded-[2rem] border border-slate-100 shadow-sm space-y-3">
                  <div className="flex justify-between items-center">
                    <div>
                      <div className="font-bold text-sm">Shift {s.id}</div>
                      <div className="text-[10px] text-slate-400 font-bold">
                        {new Date(s.startTime).toLocaleString('nl-BE')}
                      </div>
                    </div>
                    <span className="px-3 py-1 bg-emerald-50 text-emerald-600 rounded-full text-[10px] font-bold uppercase">
                      Voltooid
                    </span>
                  </div>

                  {/* Action row for session item */}
                  <div className="flex justify-end gap-3 mt-5 pt-4 border-t border-slate-50">
                    <button 
                      onClick={() => setPreviewSessionHandler(s)} 
                      className="flex items-center gap-2 px-4 py-2 bg-slate-50 text-slate-600 rounded-xl text-[10px] uppercase hover:bg-indigo-50 hover:text-indigo-600 transition-all font-bold"
                    >
                      Rapport
                    </button>
                    <button 
                      onClick={() => deleteSessionFromHistory(s.id)} 
                      className="flex items-center gap-2 px-4 py-2 bg-rose-50 text-rose-600 rounded-xl text-[10px] uppercase hover:bg-rose-100 transition-all font-bold"
                      title="Shift en bijhorende tickets verwijderen"
                    >
                      <Trash2 size={14} /> Verwijderen
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {activeTab === 'SETTINGS' && (
          <div className="h-full overflow-y-auto p-6 space-y-6 pb-24 custom-scrollbar">
            <h2 className="text-2xl font-black tracking-tighter">Instellingen & Beheer</h2>

            {/* Product Management */}
            <div className="bg-white p-6 rounded-[2rem] shadow-sm border border-slate-100 space-y-4">
              <div className="flex justify-between items-center">
                <h3 className="font-bold text-slate-800 text-sm uppercase tracking-wider">Producten (Max 10)</h3>
                <button 
                  onClick={() => exportData('PRODUCTS')} 
                  className="flex items-center gap-1.5 text-[10px] font-bold text-indigo-500 bg-indigo-50 px-3 py-1.5 rounded-full hover:bg-indigo-100 transition-colors"
                >
                  <Download size={12} /> Exporteer JSON
                </button>
              </div>

              <div className="space-y-2">
                {products.map(p => (
                  <div key={p.id} className="flex items-center justify-between p-3 bg-slate-50 rounded-2xl border border-slate-100">
                    <div className="flex items-center gap-3">
                      <div className={`w-4 h-4 rounded-full ${p.color || 'bg-white'} border border-black/10`} />
                      <div>
                        <div className="font-bold text-xs text-slate-800">{p.name}</div>
                        <div className="text-[9px] text-slate-400 font-mono font-bold">
                          €{p.price.toFixed(2)} | BTW {p.vatRate}% | Stock: {p.stock ?? 0}
                        </div>
                      </div>
                    </div>
                    <button 
                      onClick={() => setEditingProduct(p)} 
                      className="p-2 text-slate-400 hover:text-indigo-500 transition-colors"
                    >
                      <Edit2 size={16} />
                    </button>
                  </div>
                ))}
              </div>
            </div>

            {/* Staff Management */}
            <div className="bg-white p-6 rounded-[2rem] shadow-sm border border-slate-100 space-y-4">
              <h3 className="font-bold text-slate-800 text-sm uppercase tracking-wider">Medewerkers</h3>
              <div className="flex gap-2">
                <input 
                  type="text" 
                  placeholder="Naam medewerker..." 
                  value={newStaffName} 
                  onChange={e => setNewStaffName(e.target.value)} 
                  className="flex-1 bg-slate-50 border p-3 rounded-xl text-xs font-bold outline-none focus:border-indigo-400"
                />
                <button 
                  onClick={addStaff} 
                  className="bg-indigo-500 text-white px-4 rounded-xl font-bold text-xs uppercase shadow-sm active:scale-95 transition-all"
                >
                  <Plus size={16} />
                </button>
              </div>

              <div className="flex flex-wrap gap-2 pt-2">
                {(company.salesmen || []).map(name => (
                  <div key={name} className="flex items-center gap-2 bg-slate-100 px-3 py-1.5 rounded-full text-xs font-bold text-slate-700">
                    <span>{name}</span>
                    <button onClick={() => removeStaff(name)} className="text-slate-400 hover:text-rose-500 transition-colors">
                      <X size={14} />
                    </button>
                  </div>
                ))}
              </div>
            </div>

            {/* Cloud Config & Reset */}
            <div className="bg-white p-6 rounded-[2rem] shadow-sm border border-slate-100 space-y-4">
              <h3 className="font-bold text-slate-800 text-sm uppercase tracking-wider">Systeem & Synchronisatie</h3>
              <div className="space-y-3">
                <button 
                  onClick={handleResetToDefaults} 
                  className="w-full bg-amber-50 text-amber-700 py-3.5 rounded-2xl font-bold text-xs uppercase border border-amber-200 hover:bg-amber-100 transition-colors flex items-center justify-center gap-2"
                >
                  <RotateCcw size={16} /> Reset naar standaardgegevens ({activeMode})
                </button>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* MODALS */}

      {/* Edit Product Modal */}
      {editingProduct && (
        <div className="fixed inset-0 z-[600] bg-slate-950/60 backdrop-blur-sm flex items-center justify-center p-6">
          <div className="bg-white rounded-[2.5rem] p-6 max-w-sm w-full space-y-4 shadow-2xl animate-in zoom-in-95">
            <div className="flex justify-between items-center">
              <h3 className="font-black text-lg tracking-tight">Product Bewerken</h3>
              <button onClick={() => setEditingProduct(null)} className="text-slate-400 hover:text-slate-600"><X size={20} /></button>
            </div>
            <div className="space-y-3">
              <div>
                <label className="text-[9px] font-bold text-slate-400 uppercase tracking-widest block">Naam</label>
                <input 
                  type="text" 
                  value={editingProduct.name} 
                  onChange={e => setEditingProduct({ ...editingProduct, name: e.target.value })} 
                  className="w-full bg-slate-50 border p-3 rounded-xl font-bold text-xs outline-none focus:border-indigo-400"
                />
              </div>
              <div>
                <label className="text-[9px] font-bold text-slate-400 uppercase tracking-widest block">Prijs (€)</label>
                <input 
                  type="number" 
                  step="0.01" 
                  value={editingProduct.price} 
                  onChange={e => setEditingProduct({ ...editingProduct, price: parseFloat(e.target.value) || 0 })} 
                  className="w-full bg-slate-50 border p-3 rounded-xl font-bold text-xs outline-none focus:border-indigo-400"
                />
              </div>
              <div>
                <label className="text-[9px] font-bold text-slate-400 uppercase tracking-widest block">Stock</label>
                <input 
                  type="number" 
                  value={editingProduct.stock ?? 0} 
                  onChange={e => setEditingProduct({ ...editingProduct, stock: parseInt(e.target.value, 10) || 0 })} 
                  className="w-full bg-slate-50 border p-3 rounded-xl font-bold text-xs outline-none focus:border-indigo-400"
                />
              </div>
            </div>
            <button 
              onClick={() => {
                setProducts(prev => prev.map(p => p.id === editingProduct.id ? { ...editingProduct, updatedAt: Date.now() } : p));
                setEditingProduct(null);
              }} 
              className="w-full bg-indigo-500 text-white py-3.5 rounded-xl font-bold uppercase text-xs shadow-lg active:scale-95 transition-all"
            >
              Opslaan
            </button>
          </div>
        </div>
      )}

      {/* Staff Selector Modal */}
      {showSalesmanSelection && (
        <div className="fixed inset-0 z-[600] bg-slate-950/60 backdrop-blur-sm flex items-center justify-center p-6">
          <div className="bg-white rounded-[2.5rem] p-6 max-w-xs w-full space-y-4 shadow-2xl text-center animate-in zoom-in-95">
            <h3 className="font-black text-lg tracking-tight">Kies Medewerker</h3>
            <div className="space-y-2 max-h-60 overflow-y-auto">
              {(company.salesmen || []).map(name => (
                <button 
                  key={name} 
                  onClick={() => {
                    setCompany({ ...company, sellerName: name, updatedAt: Date.now() });
                    setShowSalesmanSelection(false);
                  }} 
                  className="w-full p-3 bg-slate-50 hover:bg-indigo-50 hover:text-indigo-600 rounded-xl font-bold text-xs uppercase transition-all"
                >
                  {name}
                </button>
              ))}
            </div>
            <button onClick={() => setShowSalesmanSelection(false)} className="text-xs text-slate-400 font-bold uppercase tracking-widest py-2">
              Annuleren
            </button>
          </div>
        </div>
      )}

      {/* Card Payment Confirmation Modal */}
      {isPendingCardConfirmation && (
        <div className="fixed inset-0 z-[600] bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-6">
          <div className="bg-white rounded-[2.5rem] p-8 max-w-xs w-full space-y-6 text-center shadow-2xl animate-in zoom-in-95">
            <div className="w-16 h-16 bg-sky-100 text-sky-600 rounded-full flex items-center justify-center mx-auto">
              <CreditCard size={32} />
            </div>
            <div>
              <h3 className="font-black text-xl tracking-tight">Kaartbetaling</h3>
              <p className="text-slate-400 text-xs font-bold mt-1">Ontvang €{totals.total.toFixed(2)} op de terminal</p>
            </div>
            <div className="space-y-3">
              <button 
                onClick={() => finalizePayment(PaymentMethod.CARD)} 
                className="w-full bg-emerald-500 text-white py-4 rounded-2xl font-bold uppercase text-xs shadow-lg active:scale-95 transition-all"
              >
                Betaling Geslaagd
              </button>
              <button 
                onClick={() => setIsPendingCardConfirmation(false)} 
                className="w-full bg-slate-100 text-slate-500 py-3 rounded-2xl font-bold uppercase text-xs hover:bg-slate-200 transition-colors"
              >
                Annuleren
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Shift Close Modal */}
      {isClosingSession && currentSession && (
        <div className="fixed inset-0 z-[600] bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-6">
          <div className="bg-white rounded-[2.5rem] p-7 max-w-xs w-full space-y-6 text-center shadow-2xl animate-in zoom-in-95">
            <h3 className="font-black text-xl tracking-tight">Shift Sluiten</h3>
            <div className="text-left space-y-2">
              <label className="text-[9px] font-bold text-slate-400 uppercase tracking-widest block">Geteld Contant in Kassa (€)</label>
              <input 
                type="number" 
                step="0.01" 
                placeholder="0.00" 
                value={endCashInput} 
                onChange={e => setEndCashInput(e.target.value)} 
                className="w-full bg-slate-50 border-2 p-4 rounded-2xl font-bold text-2xl outline-none focus:border-rose-400 text-center"
              />
            </div>
            <div className="space-y-2">
              <button 
                onClick={() => closeSession(parseFloat(endCashInput) || 0)} 
                className="w-full bg-rose-500 text-white py-4 rounded-2xl font-bold uppercase text-xs shadow-lg active:scale-95 transition-all"
              >
                Bevestig Sluiting
              </button>
              <button 
                onClick={() => setIsClosingSession(false)} 
                className="w-full text-xs text-slate-400 font-bold uppercase tracking-widest py-2"
              >
                Annuleren
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Ticket / Session Preview Modal */}
      {(previewTransaction || previewSession) && (
        <div className="fixed inset-0 z-[650] bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-6">
          <div className="bg-white rounded-[2.5rem] p-6 max-w-sm w-full space-y-6 shadow-2xl max-h-[85vh] flex flex-col animate-in zoom-in-95">
            <div className="flex justify-between items-center shrink-0">
              <h3 className="font-black text-base tracking-tight">
                {previewTransaction ? 'Kassaticket' : 'Shift Rapport'}
              </h3>
              <button 
                onClick={() => { setPreviewTransaction(null); setPreviewSession(null); }} 
                className="text-slate-400 hover:text-slate-600"
              >
                <X size={20} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto custom-scrollbar p-2 bg-slate-50 rounded-2xl border">
              <Receipt 
                company={company} 
                transaction={previewTransaction} 
                session={previewSession} 
              />
            </div>

            <button 
              onClick={() => { setPreviewTransaction(null); setPreviewSession(null); }} 
              className="w-full bg-slate-950 text-white py-4 rounded-2xl font-bold uppercase text-xs shadow-lg active:scale-95 transition-all shrink-0"
            >
              Sluiten
            </button>
          </div>
        </div>
      )}

      {/* Success Banner */}
      {showSuccess && (
        <div className="fixed inset-x-6 top-20 z-[700] bg-emerald-500 text-white p-4 rounded-2xl shadow-2xl flex items-center justify-center gap-3 animate-in slide-in-from-top duration-300">
          <CheckCircle size={20} />
          <span className="font-black text-sm uppercase tracking-wider">Transactie Voltooid!</span>
        </div>
      )}
    </div>
  );
}
