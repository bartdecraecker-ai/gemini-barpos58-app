import React from 'react';
import { Transaction, CompanyDetails, SalesSession } from '../types';

interface ReceiptProps {
  transaction: Transaction | null;
  sessionReport?: SalesSession | null;
  company: CompanyDetails;
  openDrawer?: boolean;
  preview?: boolean;
}

export const Receipt: React.FC<ReceiptProps> = ({ transaction, sessionReport, company, openDrawer, preview = false }) => {
  const containerStyle: React.CSSProperties = {
    fontFamily: '"Space Mono", monospace',
    fontSize: '11px',
    lineHeight: '1.3',
    width: '58mm',
    background: 'white',
    color: 'black',
    padding: '4mm 2mm',
    ...(preview ? { margin: '0 auto', boxShadow: '0 0 10px rgba(0,0,0,0.1)' } : {})
  };

  const Wrapper = ({ children }: React.PropsWithChildren<{}>) => (
    preview ? <div style={containerStyle}>{children}</div> : <div id="receipt-print-area" className="hidden print:block">{children}</div>
  );

  // --- DRAWER OPEN COMMAND ---
  if (openDrawer) {
    return (
      <Wrapper>
        <div className="text-center font-bold mb-2 border-b border-black pb-2">{company.name}</div>
        <div className="text-center font-bold text-lg my-6">* LADE OPEN *</div>
      </Wrapper>
    );
  }

  // --- SESSION REPORT (Z-RAPPORT) ---
  if (sessionReport) {
    return (
      <Wrapper>
        <div className="text-center font-bold mb-2 border-b border-black pb-2">{company.name}</div>
        <div className="text-center font-black text-sm mb-2">DAGRAPPORT (Z)</div>
        <div className="text-[9px] mb-4 text-center italic">
          {new Date(sessionReport.startTime).toLocaleString('nl-NL')} - <br/>
          {new Date(sessionReport.endTime || Date.now()).toLocaleString('nl-NL')}
        </div>
        
        <div className="border-b border-black mb-1 font-bold text-[10px]">FINANCIEEL</div>
        <div className="flex justify-between text-[10px]"><span>Omzet Bruto:</span><span>€{sessionReport.summary?.totalSales.toFixed(2)}</span></div>
        <div className="flex justify-between text-[10px]"><span>Contant:</span><span>€{sessionReport.summary?.cashTotal.toFixed(2)}</span></div>
        <div className="flex justify-between text-[10px] mb-3"><span>Kaart:</span><span>€{sessionReport.summary?.cardTotal.toFixed(2)}</span></div>

        <div className="border-b border-black mb-1 font-bold text-[10px]">BTW OVERZICHT</div>
        <div className="flex justify-between text-[10px]"><span>BTW 21%:</span><span>€{sessionReport.summary?.vat21Total.toFixed(2)}</span></div>
        <div className="flex justify-between text-[10px] mb-3"><span>BTW 0%:</span><span>€{sessionReport.summary?.vat0Total.toFixed(2)}</span></div>

        <div className="border-b border-black mb-1 font-bold text-[10px]">CASH CONTROLE</div>
        <div className="flex justify-between text-[10px]"><span>Wisselgeld:</span><span>€{sessionReport.startCash.toFixed(2)}</span></div>
        <div className="flex justify-between text-[10px]"><span>Verwacht:</span><span>€{sessionReport.expectedCash?.toFixed(2)}</span></div>
        <div className="flex justify-between text-[10px] font-bold"><span>Geteld:</span><span>€{sessionReport.endCash?.toFixed(2)}</span></div>
        <div className="flex justify-between text-[10px] border-t border-dotted mt-1">
          <span>Verschil:</span>
          <span>€{((sessionReport.endCash || 0) - (sessionReport.expectedCash || 0)).toFixed(2)}</span>
        </div>

        <div className="text-center text-[8px] mt-6 tracking-widest border-t pt-2">*** EINDE RAPPORT ***</div>
      </Wrapper>
    );
  }

  // --- REGULAR TRANSACTION RECEIPT ---
  if (!transaction) return null;
  return (
    <Wrapper>
      <div className="text-center font-bold mb-1 border-b border-black pb-1">{company.name}</div>
      <div className="text-center mb-2 text-[9px]">
        {company.address} <br/> {company.address2} <br/>
        BTW: {company.vatNumber} <br/>
        Verkoper: {company.sellerName}
      </div>
      
      <div className="border-b border-dashed border-black pb-1 mb-2 text-[9px]">
        <div className="flex justify-between"><span>{transaction.dateStr}</span><span>{new Date(transaction.timestamp).toLocaleTimeString('nl-NL', {hour:'2-digit', minute:'2-digit'})}</span></div>
        <div className="font-bold">Ticket: {transaction.id}</div>
      </div>

      <div className="mb-2">
        {transaction.items.map((item, idx) => (
          <div key={idx} className="flex justify-between text-[10px] mb-1">
            <div className="flex flex-col flex-1">
              <span className="font-bold">{item.quantity}x {item.name}</span>
              <span className="text-[8px] opacity-70">({item.price.toFixed(2).replace('.', ',')} /st)</span>
            </div>
            <span className="self-center">{(item.price * item.quantity).toFixed(2).replace('.', ',')}</span>
          </div>
        ))}
      </div>

      <div className="border-t border-black pt-1 mb-2">
        <div className="flex justify-between font-bold text-sm"><span>TOTAAL</span><span>EUR {transaction.total.toFixed(2).replace('.', ',')}</span></div>
        <div className="text-[9px] mt-1 italic text-right">Betaald via {transaction.paymentMethod === 'CASH' ? 'Contant' : 'Kaart'}</div>
      </div>

      <div className="border-t border-dashed border-black pt-1 text-[8px]">
        {transaction.vat21 > 0 && <div className="flex justify-between"><span>BTW 21% over €{(transaction.total / 1.21).toFixed(2)}</span><span>{transaction.vat21.toFixed(2)}</span></div>}
      </div>

      <div className="text-center text-[9px] mt-4 italic">{company.footerMessage}</div>
      <div className="text-center text-[8px] opacity-50 mt-1 tracking-widest">*** Einde bon ***</div>
    </Wrapper>
  );
};
