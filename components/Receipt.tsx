
import React from 'react';
import { Transaction, CompanyDetails, SalesSession } from '../types.ts';

interface ReceiptProps {
  transaction?: Transaction | null;
  session?: SalesSession | null;
  company: CompanyDetails;
  preview?: boolean;
}

export const Receipt: React.FC<ReceiptProps> = ({ transaction, session, company, preview = false }) => {
  const containerStyle: React.CSSProperties = {
    fontFamily: '"JetBrains Mono", monospace',
    fontSize: '11px',
    lineHeight: '1.4',
    width: '58mm',
    background: 'white',
    color: 'black',
    padding: '6mm 4mm',
    ...(preview ? { margin: '0 auto', boxShadow: '0 10px 25px -5px rgba(0,0,0,0.1)', border: '1px solid #e2e8f0' } : {})
  };

  if (!transaction && !session) return null;

  return (
    <div style={containerStyle}>
      <div style={{ textAlign: 'center', fontWeight: 'bold', textTransform: 'uppercase', marginBottom: '2px' }}>{company.name}</div>
      {company.address && <div style={{ textAlign: 'center', fontSize: '9px' }}>{company.address}</div>}
      {company.address2 && <div style={{ textAlign: 'center', fontSize: '9px' }}>{company.address2}</div>}
      {company.website && <div style={{ textAlign: 'center', fontSize: '9px', textDecoration: 'underline' }}>{company.website}</div>}
      {company.vatNumber && <div style={{ textAlign: 'center', fontSize: '9px' }}>{company.vatNumber}</div>}
      
      <div style={{ textAlign: 'center', fontSize: '9px', marginTop: '4px' }}>
        {new Date(transaction?.timestamp || session?.endTime || Date.now()).toLocaleString('nl-NL')}
      </div>
      
      <div style={{ borderBottom: '1px dashed black', margin: '6px 0' }}></div>

      {transaction && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
          <div style={{ textAlign: 'center', fontWeight: 'bold', marginBottom: '4px' }}>TICKET #{transaction.id.slice(-6)}</div>
          {transaction.items.map((item, idx) => (
            <div key={idx} style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ flex: 1 }}>{item.quantity}x {item.name}</span>
              <span style={{ marginLeft: '4px' }}>{(item.price * item.quantity).toFixed(2)}</span>
            </div>
          ))}
          <div style={{ borderBottom: '1px dashed black', margin: '6px 0' }}></div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 'bold' }}>
            <span>TOTAAL (BTW incl.)</span>
            <span>€{transaction.total.toFixed(2)}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '9px', marginTop: '4px' }}>
            <span>BTW 21%</span>
            <span>€{transaction.vatHigh.toFixed(2)}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '9px' }}>
            <span>BTW 0%</span>
            <span>€{transaction.vat0.toFixed(2)}</span>
          </div>
          <div style={{ marginTop: '6px', fontSize: '9px' }}>Betaalwijze: {transaction.paymentMethod}</div>
          {transaction.salesmanName && <div style={{ fontSize: '9px' }}>Bediening: {transaction.salesmanName}</div>}
        </div>
      )}

      {session && session.summary && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
          <div style={{ textAlign: 'center', fontWeight: 'bold', marginBottom: '4px' }}>SHIFT RAPPORT</div>
          <div style={{ fontSize: '9px' }}>Shift ID: {session.id.slice(-8)}</div>
          <div style={{ fontSize: '9px' }}>Start: {new Date(session.startTime).toLocaleTimeString('nl-NL')}</div>
          {session.endTime && <div style={{ fontSize: '9px' }}>Eind:  {new Date(session.endTime).toLocaleTimeString('nl-NL')}</div>}
          
          <div style={{ borderBottom: '1px dashed black', margin: '6px 0' }}></div>
          
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span>Tickets:</span>
            <span>{session.summary.transactionCount}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 'bold' }}>
            <span>OMZET:</span>
            <span>€{session.summary.totalSales.toFixed(2)}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '9px' }}>
            <span>- Contant:</span>
            <span>€{session.summary.cashTotal.toFixed(2)}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '9px' }}>
            <span>- Kaart:</span>
            <span>€{session.summary.cardTotal.toFixed(2)}</span>
          </div>

          <div style={{ borderBottom: '1px dashed black', margin: '6px 0' }}></div>

          <div style={{ fontWeight: 'bold', textAlign: 'center', fontSize: '9px', marginBottom: '2px' }}>PRODUCTEN VERKOCHT</div>
          {session.summary.productSales && Object.entries(session.summary.productSales).map(([name, qty]) => (
            <div key={name} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '9px' }}>
              <span style={{ flex: 1, paddingRight: '4px' }}>{name}</span>
              <span style={{ fontWeight: 'bold' }}>x{qty}</span>
            </div>
          ))}

          <div style={{ borderBottom: '1px dashed black', margin: '6px 0' }}></div>

          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span>Start Kas:</span>
            <span>€{session.startCash.toFixed(2)}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span>Verwacht:</span>
            <span>€{(session.expectedCash || 0).toFixed(2)}</span>
          </div>
          {session.endCash !== undefined && (
            <>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>Geteld:</span>
                <span>€{session.endCash.toFixed(2)}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 'bold' }}>
                <span>VERSCHIL:</span>
                <span>€{(session.endCash - (session.expectedCash || 0)).toFixed(2)}</span>
              </div>
            </>
          )}
        </div>
      )}

      {!session && <div style={{ textAlign: 'center', marginTop: '10px', fontSize: '9px', fontStyle: 'italic' }}>{company.footerMessage}</div>}
    </div>
  );
};
