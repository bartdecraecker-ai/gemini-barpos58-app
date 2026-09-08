import React from 'react';
import type { Transaction, CompanyDetails } from '../types';

interface ReceiptProps {
  transaction: Transaction;
  company: CompanyDetails;
}

export const Receipt: React.FC<ReceiptProps> = ({ transaction, company }) => {
  return (
    <div className="bg-white p-4 rounded-xl border border-slate-200 text-left text-xs font-mono text-slate-800 space-y-3">

      {/* KOP: BEDRIJFSGEGEVENS */}
      <div className="text-center space-y-0.5 border-b border-slate-100 pb-2">
        <div className="font-bold text-sm text-slate-900 uppercase tracking-wide">
          {company.name}
        </div>

        {company.address && (
          <div className="text-slate-500">
            {company.address}
          </div>
        )}

        {/* POSTCODE + PLAATS */}
        {company.address2 && (
          <div className="text-slate-500">
            {company.address2}
          </div>
        )}

        {company.vatNumber && (
          <div className="text-slate-500">
            BTW: {company.vatNumber}
          </div>
        )}

        {company.receiptHeader && (
          <div className="text-[10px] text-slate-400 italic mt-1">
            {company.receiptHeader}
          </div>
        )}
      </div>

      {/* METADATA: TICKET-ID & DATUM */}
      <div className="text-[11px] space-y-0.5 bg-slate-50 p-2 rounded-lg border border-slate-100">

        <div className="flex justify-between font-bold text-slate-900">
          <span>Ticket-ID:</span>
          <span>#{transaction.id}</span>
        </div>

        <div className="flex justify-between text-slate-500">
          <span>Datum:</span>
          <span>
            {transaction.dateStr} {transaction.timeStr}
          </span>
        </div>

        {transaction.salesmanName && (
          <div className="flex justify-between text-slate-500">
            <span>Bediende:</span>
            <span>{transaction.salesmanName}</span>
          </div>
        )}
      </div>

      {/* ARTIKELLIJST */}
      <div className="space-y-1.5 py-1">
        {transaction.items.map((item, index) => (
          <div
            key={index}
            className="flex justify-between items-center text-[11px]"
          >
            <span className="truncate pr-2">
              {item.quantity}x {item.name}
            </span>

            <span className="font-semibold whitespace-nowrap">
              €{(item.price * item.quantity).toFixed(2)}
            </span>
          </div>
        ))}
      </div>

      {/* TOTAAL & BETAALMETHODE */}
      <div className="border-t border-slate-200 pt-2 space-y-1">

        <div className="flex justify-between text-sm font-bold text-slate-900">
          <span>TOTAAL</span>
          <span>
            €{transaction.total.toFixed(2)}
          </span>
        </div>

        <div className="flex justify-between text-[10px] text-slate-500">
          <span>Betaalmethode:</span>
          <span className="font-semibold uppercase">
            {transaction.paymentMethod}
          </span>
        </div>

      </div>

      {/* VOET: BEDANKT BERICHT */}
      {company.receiptFooter && (
        <div className="text-center text-[10px] text-slate-400 italic pt-1 border-t border-slate-100">
          {company.receiptFooter}
        </div>
      )}

    </div>
  );
};
