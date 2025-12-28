import React from 'react';
import { Transaction, CompanyDetails, SalesSession } from '../types';

interface ReceiptProps {
  transaction?: Transaction | null;
  company: CompanyDetails;
  preview?: boolean;
  sessionSummary?: SalesSession | null; // Nieuw: om sessie-data te ontvangen
}

export const Receipt: React.FC<ReceiptProps> = ({ transaction, company, preview, sessionSummary }) => {
  const isSessionReport = !!sessionSummary;
  const data = isSessionReport ? sessionSummary?.summary : null;

  return (
    <div className={`receipt-container ${preview ? 'preview-mode' : ''}`} style={{ 
      width: '100%', 
      maxWidth: '300px', 
      margin: '0 auto', 
      padding: '10px', 
      backgroundColor: '#fff', 
      color: '#000', 
      fontFamily: 'monospace',
      fontSize: '12px',
      lineHeight: '1.4'
    }}>
      {/* Header */}
      <div style={{ textAlign: 'center', marginBottom: '10px' }}>
        <h2 style={{ margin: '0', fontSize: '16px', fontWeight: 'bold' }}>{company.name}</h2>
        <p style={{ margin: '0' }}>{company.address}</p>
        <p style={{ margin: '0' }}>BTW: {company.vatNumber}</p>
        <p style={{ margin: '0' }}>Tel: {company.phone}</p>
      </div>

      <div style={{ borderBottom: '1px dashed #000', margin: '10px 0' }}></div>

      {/* Content: Transactie OF Sessie Rapport */}
      {!isSessionReport && transaction ? (
        <>
          <div style={{ marginBottom: '10px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span>Ticket: {transaction.id}</span>
              <span>{new Date(transaction.timestamp).toLocaleTimeString('nl-NL')}</span>
            </div>
            <span>Datum: {transaction.dateStr}</span>
          </div>

          <div style={{ marginBottom: '10px' }}>
            {transaction.items.map((item, index) => (
              <div key={index} style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>{item.quantity}x {item.name}</span>
                <span>€{(item.price * item.quantity).toFixed(2)}</span>
              </div>
            ))}
          </div>
        </>
      ) : (
        <>
          {/* Sessie Samenvatting Header */}
          <div style={{ textAlign: 'center', fontWeight: 'bold', marginBottom: '10px' }}>
            *** DAGRAPPORT ***
          </div>
          <div style={{ marginBottom: '10px' }}>
             Sessie: {sessionSummary?.id.slice(-6)}<br />
             Start: {new Date(sessionSummary?.startTime || 0).toLocaleString('nl-NL')}<br />
             Einde: {new Date().toLocaleString('nl-NL')}
          </div>

          {/* PRODUCT OVERZICHT: Hier komen de getelde aantallen */}
          {data?.productSales && (
            <div style={{ borderTop: '1px solid #000', paddingTop: '5px', marginBottom: '10px' }}>
              <div style={{ textAlign: 'center', fontWeight: 'bold', marginBottom: '5px' }}>PRODUCT VERKOOP</div>
              {Object.entries(data.productSales).map(([name, qty]) => (
                <div key={name} style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span>{name}</span>
                  <span style={{ fontWeight: 'bold' }}>{qty as number}x</span>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      <div style={{ borderBottom: '1px dashed #000', margin: '10px 0' }}></div>

      {/* Totals Section */}
      <div style={{ fontWeight: 'bold', fontSize: '14px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <span>TOTAAL</span>
          <span>€{(isSessionReport ? data?.totalSales : transaction?.total || 0).toFixed(2)}</span>
        </div>
      </div>

      {!isSessionReport && (
        <div style={{ marginTop: '5px', fontSize: '10px' }}>
          <span>Betaalmethode: {transaction?.paymentMethod}</span>
        </div>
      )}

      {/* Footer */}
      <div style={{ textAlign: 'center', marginTop: '20px', fontSize: '10px' }}>
        <p>Bedankt voor uw bezoek!</p>
        <p>BarPOS58 - {new Date().getFullYear()}</p>
      </div>
    </div>
  );
};
