
import React from 'react';
import { Transaction, CompanyDetails, SalesSession } from '../types';

interface ReceiptProps {
  transaction: Transaction | null;
  sessionReport?: SalesSession | null;
  company: CompanyDetails;
  openDrawer?: boolean;
  preview?: boolean;
}

export const Receipt: React.FC<ReceiptProps> = ({ transaction, company, openDrawer, preview = false }) => {
  
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

  const Wrapper = ({ children }: React.PropsWithChildren<{}>) => {
    if (preview) {
      return <div style={containerStyle} className="receipt-preview">{children}</div>;
    }
    return (
      <div id="receipt-print-area" className="hidden print:block">
         {children}
      </div>
    );
  };

  if (openDrawer) {
     const now = new Date();
     const dateStr = now.toLocaleDateString('nl-NL');
     const timeStr = now.toLocaleTimeString('nl-NL', {
       hour: '2-digit',
       minute: '2-digit'
     });

     return (
       <Wrapper>
         <div className="text-center font-bold mb-2 uppercase border-b border-black pb-2">
           {company.name}
         </div>
         <div className="text-center mb-2 text-xs">
           {dateStr} {timeStr}
         </div>
         <div className="text-center font-bold text-lg my-6">
           * LADE OPEN *
         </div>
         <div className="text-center text-[10px]">.</div>
       </Wrapper>
     );
  }

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
        {company.website && (
          <>
            <br />
            {company.website}
          </>
        )}
        {company.sellerName && (
          <>
            <br />
            Verkoper: {company.sellerName}
          </>
        )}
      </div>
      
      <div className="border-b border-dashed border-black pb-1 mb-2 text-[10px]">
        <div className="flex justify-between">
           <span>{transaction.dateStr} {timeStr}</span>
        </div>
        <div className="flex justify-between font-bold">
          <span>Ticket #:</span>
          <span>{transaction.id}</span>
        </div>
      </div>

      <div className="mb-2">
        {transaction.items.map((item, idx) => (
          <div key={idx} className="flex justify-between text-[10px] mb-1">
            <div className="flex flex-col flex-1">
              <span className="font-bold truncate w-32 uppercase">
                {item.quantity}x {item.name}
              </span>
              <span className="text-[9px] opacity-70">
                ({item.price.toFixed(2).replace('.', ',')} / st)
              </span>
            </div>
            <span className="self-center">{(item.price * item.quantity).toFixed(2).replace('.', ',')}</span>
          </div>
        ))}
      </div>

      <div className="border-t border-black pt-2 mb-2">
        <div className="flex justify-between text-[10px] mb-1">
           <span>Totaal excl. BTW</span>
           <span>EUR {(transaction.subtotal).toFixed(2).replace('.', ',')}</span>
        </div>
        <div className="flex justify-between font-bold text-sm">
          <span>TOTAAL</span>
          <span>EUR {transaction.total.toFixed(2).replace('.', ',')}</span>
        </div>
        <div className="flex justify-between text-[10px] mt-1">
          <span>Betaald via {transaction.paymentMethod === 'CASH' ? 'CONTANT' : 'KAART'}</span>
        </div>
      </div>

      <div className="border-t border-dashed border-black pt-1 mb-2 text-[9px]">
        {transaction.vat0 > 0 && (
          <div className="flex justify-between">
            <span>BTW 0% (basis EUR {transaction.vat0.toFixed(2).replace('.', ',')})</span>
            <span>0,00</span>
          </div>
        )}
        {transaction.vat21 > 0 && (
          <div className="flex justify-between">
            <span>BTW 21% (basis EUR {(transaction.subtotal - transaction.vat0).toFixed(2).replace('.', ',')})</span>
            <span>{transaction.vat21.toFixed(2).replace('.', ',')}</span>
          </div>
        )}
      </div>

      <div className="text-center text-[10px] mt-4 italic">
        {company.footerMessage}
      </div>
      <div className="text-center text-[8px] opacity-50 mt-1 uppercase tracking-widest">
        *** EINDE BON ***
      </div>
    </Wrapper>
  );
};
