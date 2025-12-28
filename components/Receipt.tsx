import React from 'react';
import { Transaction, CompanyDetails, SalesSession } from '../types';

interface ReceiptProps {
  transaction?: Transaction | null;
  company: CompanyDetails;
  preview?: boolean;
  sessionSummary?: SalesSession | null;
}

export const Receipt: React.FC<ReceiptProps> = ({ transaction, company, preview, sessionSummary }) => {
  const isSessionReport = !!sessionSummary;
  const data = isSessionReport ? sessionSummary?.summary : null;

  // Inline styling voor thermische print optimalisatie
  const style: Record<string, React.CSSProperties> = {
    container: {
      width: '100%',
      maxWidth: '300px',
      margin: '0 auto',
      padding: '5px',
      backgroundColor: '#fff',
      color: '#000',
      fontFamily: '"Courier New", Courier, monospace',
      fontSize: '12px',
      lineHeight: '1.2'
    },
    header: { textAlign: 'center', marginBottom: '10px' },
    divider: { borderBottom: '1px dashed #000', margin: '8px 0' },
    row: { display: 'flex', justifyContent: 'space-between', marginBottom: '2px' },
    bold: { fontWeight: 'bold' },
    footer: { textAlign: 'center', marginTop: '15px', fontSize: '10px' }
  };

  return (
    <div style={style.container} className={preview ? 'receipt-preview' : ''}>
      {/* Bedrijfsgegevens */}
      <div style={style.header}>
        <div style={{ ...style.bold, fontSize: '16px' }}>{company.name}</div>
        <div>{company.address}</div>
        <div>{company.vatNumber}</div>
        {company.phone && <div>Tel: {company.phone}</div>}
      </div>

      <div style={style.divider}></div>

      {isSessionReport ? (
        /* --- DAGRAPPORT LAYOUT --- */
        <div style={{ fontSize: '11px' }}>
          <div style={{ ...style.bold, textAlign: 'center', marginBottom: '5px' }}>*** DAGRAPPORT (Z-REPORT) ***</div>
          <div style={style.row}><span>Sessie ID:</span><span>{sessionSummary?.id.slice(-6)}</span></div>
          <div style={style.row}><span>Start:</span><span>{new Date(sessionSummary?.startTime || 0).toLocaleString('nl-NL')}</span></div>
          {sessionSummary?.endTime && (
            <div style={style.row}><span>Einde:</span><span>{new Date(sessionSummary.endTime).toLocaleString('nl-NL')}</span></div>
          )}
          
          <div style={style.divider}></div>
          
          {/* PRODUCT TOTALEN (Dit is wat je wilde zien) */}
          <div style={{ ...style.bold, textAlign: 'center', margin: '5px 0' }}>PRODUCT VERKOOP OVERZICHT</div>
          {data?.productSales && Object.entries(data.productSales).length > 0 ? (
            Object.entries(data.productSales).map(([name, qty]) => (
              <div key={name} style={style.row}>
                <span>{name}</span>
                <span style={style.bold}>{qty as number}x</span>
              </div>
            ))
          ) : (
            <div style={{ textAlign: 'center' }}>Geen producten verkocht</div>
          )}

          <div style={style.divider}></div>

          {/* FINANCIEEL OVERZICHT */}
          <div style={style.row}><span>Aantal transacties:</span><span>{data?.transactionCount}</span></div>
          <div style={style.row}><span>Cash Omzet:</span><span>€{data?.cashTotal.toFixed(2)}</span></div>
          <div style={style.row}><span>Card Omzet:</span><span>€{data?.cardTotal.toFixed(2)}</span></div>
          <div style={{ ...style.row, ...style.bold, fontSize: '14px', marginTop: '5px' }}>
            <span>TOTAAL OMZET</span>
            <span>€{data?.totalSales.toFixed(2)}</span>
          </div>
        </div>
      ) : (
        /* --- KLANT TICKET LAYOUT --- */
        <>
          <div style={{ marginBottom: '8px' }}>
            <div style={style.row}><span>Bon nr: {transaction?.id}</span><span>{transaction?.dateStr}</span></div>
            <div style={style.row}><span>Tijd:</span><span>{new Date(transaction?.timestamp || 0).toLocaleTimeString('nl-NL')}</span></div>
            <div style={style.row}><span>Verkoper:</span><span>{company.sellerName || 'Algemeen'}</span></div>
          </div>

          <div style={style.divider}></div>

          {/* Artikelen */}
          <div style={{ minHeight: '50px' }}>
            {transaction?.items.map((item, idx) => (
              <div key={idx} style={style.row}>
                <span>{item.quantity}x {item.name}</span>
                <span>€{(item.price * item.quantity).toFixed(2)}</span>
              </div>
            ))}
          </div>

          <div style={style.divider}></div>

          {/* Totalen */}
          <div style={{ ...style.row, ...style.bold, fontSize: '14px' }}>
            <span>TOTAAL</span>
            <span>€{transaction?.total.toFixed(2)}</span>
          </div>
          
          <div style={{ ...style.row, fontSize: '10px', marginTop: '4px' }}>
            <span>Betaalwijze:</span>
            <span>{transaction?.paymentMethod}</span>
          </div>

          {/* BTW Specificatie */}
          <div style={{ fontSize: '9px', marginTop: '8px' }}>
            <div style={style.row}><span>BTW 21%:</span><span>€{transaction?.vat21.toFixed(2)}</span></div>
            <div style={style.row}><span>BTW 0%:</span><span>€{transaction?.vat0.toFixed(2)}</span></div>
          </div>
        </>
      )}

      {/* Footer */}
      <div style={style.footer}>
        <p style={{ margin: '0' }}>Bedankt voor uw bezoek!</p>
        <p style={{ margin: '0' }}>{new Date().getFullYear()} - {company.name}</p>
        {!isSessionReport && <p style={{ marginTop: '5px' }}>Heeft u vragen? Contacteer ons.</p>}
      </div>
    </div>
  );
};
