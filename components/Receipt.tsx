import React from 'react';
import type { Transaction, CompanyDetails, SalesSession } from '../types.ts';

interface ReceiptProps {
  transaction?: Transaction | null;
  session?: SalesSession | null;
  company: CompanyDetails;
}

export const Receipt: React.FC<ReceiptProps> = ({ transaction, session, company }) => {
  if (!transaction && !session) return null;

  return (
    <div className="bg-white p-6 rounded-2xl shadow-inner border border-slate-200 font-mono text-xs text-slate-800 space-y-4 max-w-xs mx-auto select-text">
      {/* HEADER & FIRMAGEGEVENS */}
      <div className="text-center space-y-1">
        <div className="font-bold text-base text-slate-900">{company.name}</div>
        {company.address && <div className="text-[11px] text-slate-600">{company.address}</div>}
        {company.address2 && <div className="text-[11px] text-slate-600">{company.address2}</div>}
        {company.vatNumber && <div className="text-[10px] text-slate-500">BTW: {company.vatNumber}</div>}
        {company.receiptHeader && (
          <div className="text-[10px] italic text-slate-500 pt-1 border-t border-dashed border-slate-200 mt-2">
            {company.receiptHeader}
          </div>
        )}
      </div>

      <div className="border-b border-dashed border-slate-300 my-2" />

      {/* TICKET DETAILS */}
      {transaction && (
        <>
          <div className="flex justify-between text-[10px] text-slate-500">
            <span>Datum: {transaction.dateStr}</span>
            <span>Bediende: {transaction.salesmanName || 'Kassa'}</span>
          </div>

          <div className="border-b border-dashed border-slate-200 my-2" />

          {/* ARTIKELEN */}
          <div className="space-y-1">
            {transaction.items.map((item, index) => (
              <div key={index} className="flex justify-between items-center text-xs">
                <span>{item.quantity}x {item.name}</span>
                <span className="font-bold">€{(item.price * item.quantity).toFixed(2)}</span>
              </div>
            ))}
          </div>

          <div className="border-b border-dashed border-slate-300 my-2" />

          {/* TOTAAL & BETAALMETHODE */}
          <div className="space-y-1 text-right">
            <div className="flex justify-between font-bold text-sm text-slate-900">
              <span>TOTAAL:</span>
              <span>€{transaction.total.toFixed(2)}</span>
            </div>
            <div className="text-[10px] text-slate-500 uppercase">
              Betaald via: {transaction.paymentMethod}
            </div>
          </div>
        </>
      )}

      {/* FOOTER */}
      {company.receiptFooter && (
        <div className="text-center text-[10px] italic text-slate-500 pt-2 border-t border-dashed border-slate-200">
          {company.receiptFooter}
        </div>
      )}
    </div>
  );
};
