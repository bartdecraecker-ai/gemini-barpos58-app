{/* Action row for session item */}
                  <div className="flex justify-end gap-3 mt-5 pt-4 border-t border-slate-50">
                    <button 
                      onClick={() => setPreviewSession(s)} 
                      className="flex items-center gap-2 px-4 py-2 bg-slate-50 text-slate-600 rounded-xl font-bold text-[10px] uppercase hover:bg-indigo-50 hover:text-indigo-600 transition-all"
                    >
                      Rapport
                    </button>
                    <button 
                      onClick={() => deleteSessionFromHistory(s.id)} 
                      className="flex items-center gap-2 px-4 py-2 bg-rose-50 text-rose-600 rounded-xl font-bold text-[10px] uppercase hover:bg-rose-100 transition-all"
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
