import React, { useState } from 'react';
import { X, Cloud, Save, Key, RefreshCcw } from 'lucide-react';
import type { CloudConfig } from '../types.ts';

interface SyncModalProps {
  config: CloudConfig;
  onSave: (config: CloudConfig) => void;
  onClose: () => void;
}

export const SyncModal: React.FC<SyncModalProps> = ({ config, onSave, onClose }) => {
  const [syncId, setSyncId] = useState(config.syncId || '');
  const [isAutoSync, setIsAutoSync] = useState(config.isAutoSync || false);

  const handleSave = () => {
    onSave({
      syncId,
      isAutoSync,
    });
  };

  return (
    <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md z-[600] flex items-center justify-center p-6">
      <div className="bg-white rounded-[2.5rem] p-8 max-w-sm w-full space-y-6 animate-in zoom-in-95">
        <div className="flex justify-between items-center border-b pb-4">
          <div className="flex items-center gap-2 text-indigo-600 font-extrabold text-lg">
            <Cloud size={24} />
            <span>Cloud Sync</span>
          </div>
          <button onClick={onClose} className="p-1 text-slate-400 hover:text-slate-600">
            <X size={20} />
          </button>
        </div>

        <div className="space-y-4">
          <div>
            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-1">
              Sync ID / Koppelsleutel
            </label>
            <div className="relative">
              <Key size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="bv. krauker-bar-pos"
                value={syncId}
                onChange={(e) => setSyncId(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 pl-11 pr-4 py-3.5 rounded-2xl font-bold text-sm outline-none focus:border-indigo-500"
              />
            </div>
          </div>

          <div className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl border border-slate-100">
            <span className="text-xs font-bold text-slate-700">Automatische Sync</span>
            <input
              type="checkbox"
              checked={isAutoSync}
              onChange={(e) => setIsAutoSync(e.target.checked)}
              className="w-5 h-5 accent-indigo-600 rounded cursor-pointer"
            />
          </div>
        </div>

        <div className="flex gap-3 pt-2">
          <button
            onClick={onClose}
            className="flex-1 py-4 bg-slate-100 text-slate-600 rounded-2xl font-bold text-xs uppercase hover:bg-slate-200 active:scale-95 transition-all"
          >
            Annuleren
          </button>
          <button
            onClick={handleSave}
            className="flex-1 py-4 bg-indigo-600 text-white rounded-2xl font-bold text-xs uppercase shadow-lg hover:bg-indigo-700 active:scale-95 transition-all flex items-center justify-center gap-2"
          >
            <Save size={16} /> Opslaan
          </button>
        </div>
      </div>
    </div>
  );
};
