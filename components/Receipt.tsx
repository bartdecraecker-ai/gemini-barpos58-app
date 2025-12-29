import React from 'react';
import { Transaction, CompanyDetails, SalesSession } from '../types';

interface ReceiptProps {
  transaction: Transaction | null;
  sessionReport?: SalesSession | null; // Nieuw: voor dagrapporten
  company: CompanyDetails;
  openDrawer?: boolean;
  preview?: boolean;
}

export const Receipt: React.FC<ReceiptProps> = ({ transaction, sessionReport, company, openDrawer, preview = false }) => {
  
  const containerStyle: React.CSSProperties = {
    fontFamily: '"Space Mono", monospace',
    fontSize: '12px',
    lineHeight: '1.2',
    width: '58mm',
    background: 'white',
    color: 'black',
    padding: '2mm',
    ...(preview ? { margin: '0 auto', boxShadow: '0 0 10px rgba(0,0,0,0.1)' } : {})
  };

  const Wrapper = ({ children }: React.PropsWithChildren<{}>) => {
    if (preview) {
      return <div style={containerStyle} className="receipt-preview">{children}</div>;
    }
    return (
      <div id="receipt-print-area" className="hidden print:block">
         <div style={containerStyle}>{children}</div>
      </div>
    );
  };

  // --- LOGICA VOOR LADE OPENEN ---
  if (openDrawer) {
     const now = new Date();
     return (
       <Wrapper>
         <div className="text-center font-bold mb-2 uppercase border-b border-black pb-2">{company.name}</div>
         <div className="text-center mb-2 text-xs">{now.toLocaleDateString('nl-NL')} {now.toLocaleTimeString('nl-NL')}</div>
         <div className="text-center font-bold text-lg my-6">* LADE OPEN *</div>
       </Wrapper>
     );
  }

  // --- NIEUW: LOGICA VOOR DAGRAPPORT (Z-RAPPORT) ---
  if (sessionReport) {
    return (
      <Wrapper>
        <div className="text-center font-bold mb-2 uppercase border-b border-black pb-2">*** DAGRAPPORT ***<br/>{company.name}</div>
        <div className="text-xs mb-4">
          Datum: {new Date().toLocaleDateString('nl-NL')}<br/>
          Sessie: {sessionReport.id}
        </div>
        
        <div className="border-b border-black pb-1 mb-2 font-bold">OMZET PER METHODE</div>
        <div className="flex justify-between text-xs">
          <span>CONTANT:</span>
          <span>EUR {sessionReport.totalCash?.toFixed(2).replace('.', ',')}</span>
        </div>
        <div className="flex justify-between text-xs mb-2">
          <span>KAART:</span>
          <span>EUR {sessionReport.totalCard?.toFixed(2).replace('.', ',')}</span>
        </div>

        <div className="border-t border-black pt-1 flex justify-between font-bold">
          <span>TOTAAL OMZET:</span>
          <span>EUR {sessionReport.totalRevenue?.toFixed(2).replace('.', ',')}</span>
        </div>

        <div className="text-center text-[10px] mt-8 border-t border-dashed pt-4">
          Einde rapportage
        </div>
      </Wrapper>
    );
  }

  // --- STANDAARD KASSABON ---
  if (!transaction) return null;

  const timeStr = new Date(transaction.timestamp).toLocaleTimeString('nl-NL', {
    hour: '2-digit',
    minute: '2-digit'
  });

  return (
    <Wrapper>
      <div className="text-center font-bold mb-2 uppercase border-b border-black pb-2">
        {company.name}
      </div>
      <div className="text-center mb-2 text-[10px]">
        {company.address}
        {company.address2 && <><br />{company.address2}</>}
        <br />
        BTW: {company.vatNumber}
        {company.sellerName && <><br />Verkoper: {company.sellerName}</>}
      </div>
      
      <div className="border-b border-dashed border-black pb-1 mb-2 text-[11px]">
        <div className="flex justify-between">
           <span>{transaction.dateStr} {timeStr}</span>
        </div>
        <div className="flex justify-between font-bold">
          <span>Ticket #: {transaction.id}</span>
        </div>
      </div>

      <div className="mb-2">
        {transaction.items.map((item, idx) => (
          <div key={idx} className="flex justify-between text-[11px] mb-1">
            <span className="truncate pr-2 flex-1">
              {item.quantity}x {item.name}
            </span>
            <span>{(item.price * item.quantity).toFixed(2).replace('.', ',')}</span>
          </div>
        ))}
      </div>

      <div className="border-t border-black pt-2 mb-2">
        <div className="flex justify-between font-bold text-sm">
          <span>TOTAAL</span>
          <span>EUR {transaction.total.toFixed(2).replace('.', ',')}</span>
        </div>
        <div className="text-[10px] mt-1 italic">
          Betaald: {transaction.paymentMethod === 'CASH' ? 'CONTANT' : 'KAART'}
        </div>
      </div>

      <div className="border-t border-dashed border-black pt-1 text-[9px]">
        {transaction.vat21 > 0 && (
          <div className="flex justify-between">
            <span>BTW 21% over EUR {transaction.subtotal?.toFixed(2).replace('.', ',')}</span>
            <span>{transaction.vat21.toFixed(2).replace('.', ',')}</span>
          </div>
        )}
      </div>

      <div className="text-center text-[10px] mt-4 italic">
        {company.footerMessage || 'Bedankt voor je bezoek!'}
      </div>
    </Wrapper>
  );
};
