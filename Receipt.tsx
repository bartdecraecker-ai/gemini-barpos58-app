
import React from 'react';
import { Transaction, CompanyDetails, SalesSession, PaymentMethod } from '../types';

interface ReceiptProps {
  transaction?: Transaction | null;
  session?: SalesSession | null;
  company: CompanyDetails;
  openDrawer?: boolean;
  preview?: boolean;
}

export const Receipt: React.FC<ReceiptProps> = ({ transaction, session, company, openDrawer, preview = false }) => {
  
  const containerStyle: React.CSSProperties = {
    fontFamily: '"JetBrains Mono", monospace',
    fontSize: '11px',
    lineHeight: '1.3',
    width: '58mm',
    background: 'white',
    color: 'black',
    padding: '6mm 3mm',
    ...(preview ? { margin: '0 auto', border: '1px solid #f1f5f9' } : {})
  };

  const Wrapper = ({ children }: React.PropsWithChildren<{}>) => {
    if (preview) {
      return <div style={containerStyle} className="receipt-content">{children}</div>;
    }
    return (
      <div id="receipt-print-area" className="hidden print:block">
         {children}
      </div>
    );
  };

  if (openDrawer) {
     const now = new Date();
     return (
       <Wrapper>
         <div className="text-center font-bold mb-2 border-b border-black pb-2 uppercase">{company.name}</div>
         <div className="text-center mb-2 text-[9px]">{now.toLocaleString('nl-NL')}</div>
         <div className="text-center font-bold text-lg my-6">* LADE OPEN *</div>
       </Wrapper>
     );
  }

  // --- SESSION REPORT VIEW ---
  if (session) {
    const summary = session.summary;
    const startTime = new Date(session.startTime).toLocaleString('nl-NL', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit' });
    const endTime = session.endTime ? new Date(session.endTime).toLocaleString('nl-NL', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit' }) : 'SESSION OPEN';
    
    return (
      <Wrapper>
        <div className="text-center font-bold mb-1 uppercase text-xs">{company.name}</div>
        <div className="text-center font-bold mb-2 border-b border-black pb-2">SESSIE RAPPORT</div>
        
        <div className="text-[9px] mb-3">
          <div className="flex justify-between"><span>ID:</span><span>{String(session.id).slice(-8)}</span></div>
          <div className="flex justify-between"><span>Start:</span><span>{startTime}</span></div>
          <div className="flex justify-between"><span>Einde:</span><span>{endTime}</span></div>
        </div>

        <div className="border-b border-dashed border-black mb-2 pb-1">
          <div className="font-bold mb-1">FINANCIEEL</div>
          <div className="flex justify-between"><span>Omzet:</span><span>€{(summary?.totalSales || 0).toFixed(2)}</span></div>
          <div className="flex justify-between"><span>Kaart:</span><span>€{(summary?.cardTotal || 0).toFixed(2)}</span></div>
          <div className="flex justify-between"><span>Contant:</span><span>€{(summary?.cashTotal || 0).toFixed(2)}</span></div>
          <div className="flex justify-between"><span>Tickets:</span><span>{summary?.transactionCount || 0}</span></div>
        </div>

        <div className="border-b border-dashed border-black mb-2 pb-1">
          <div className="font-bold mb-1">KAS CONTROLE</div>
          <div className="flex justify-between"><span>Begin:</span><span>€{(session.startCash || 0).toFixed(2)}</span></div>
          <div className="flex justify-between"><span>Verwacht:</span><span>€{(session.expectedCash || (session.startCash + (summary?.cashTotal || 0))).toFixed(2)}</span></div>
          <div className="flex justify-between"><span>Geteld:</span><span>€{(session.endCash || 0).toFixed(2)}</span></div>
          <div className={`flex justify-between font-bold ${((session.endCash || 0) - (session.expectedCash || 0)) < 0 ? 'text-rose-600' : 'text-emerald-600'}`}>
            <span>Verschil:</span><span>€{((session.endCash || 0) - (session.expectedCash || (session.startCash + (summary?.cashTotal || 0)))).toFixed(2)}</span>
          </div>
        </div>

        <div className="border-b border-dashed border-black mb-2 pb-1">
          <div className="font-bold mb-1">BTW OVERZICHT</div>
          <div className="flex justify-between"><span>0% Basis:</span><span>€{(summary?.vat0Total || 0).toFixed(2)}</span></div>
          <div className="flex justify-between"><span>Hoog BTW:</span><span>€{(summary?.vatHighTotal || 0).toFixed(2)}</span></div>
        </div>

        <div className="text-center text-[8px] mt-4 italic">*** EINDE RAPPORT ***</div>
      </Wrapper>
    );
  }

  // --- TRANSACTION RECEIPT VIEW ---
  if (!transaction) return null;

  return (
    <Wrapper>
      <div className="text-center font-bold mb-1 uppercase text-xs">{company.name}</div>
      <div className="text-center mb-2 text-[9px] leading-tight">
        {company.address}<br/>
        {company.address2 && <>{company.address2}<br/></>}
        {company.vatNumber}<br/>
        {company.website}
      </div>
      
      <div className="border-b border-dashed border-black pb-1 mb-2 text-[9px]">
        <div className="flex justify-between">
          <span>{transaction.dateStr}</span>
          <span>{new Date(transaction.timestamp).toLocaleTimeString('nl-NL', {hour:'2-digit', minute:'2-digit'})}</span>
        </div>
        <div className="font-bold">Ticket #: {transaction.id}</div>
        {transaction.salesmanName && <div className="text-[8px]">Verkoper: {transaction.salesmanName}</div>}
      </div>

      <div className="mb-2">
        {transaction.items.map((item, idx) => (
          <div key={idx} className="flex justify-between text-[9px] mb-1">
            <div className="flex flex-col flex-1 text-left">
              <span className="font-bold">{item.quantity}x {item.name}</span>
              <span className="text-[8px] opacity-70">({item.price.toFixed(2)} / st)</span>
            </div>
            <span className="self-center">{(item.price * item.quantity).toFixed(2)}</span>
          </div>
        ))}
      </div>

      <div className="border-t border-black pt-2 mb-2">
        <div className="flex justify-between font-bold text-xs">
          <span>TOTAAL</span>
          <span>EUR {transaction.total.toFixed(2).replace('.', ',')}</span>
        </div>
        <div className="text-[8px] mt-1 text-left">Betaald via {transaction.paymentMethod === PaymentMethod.CASH ? 'CONTANT' : 'KAART'}</div>
      </div>

      <div className="text-center text-[9px] mt-4 italic">{company.footerMessage}</div>
      <div className="text-center text-[8px] opacity-30 mt-2 uppercase">*** BEDANKT ***</div>
    </Wrapper>
  );
};
