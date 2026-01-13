import React from 'react';
import type { Transaction, CompanyDetails, SalesSession } from '../types.ts';

interface ReceiptProps {
  transaction?: Transaction | null;
  session?: SalesSession | null;
  company: CompanyDetails;
  preview?: boolean;
}

// ---- Safe formatting helpers (fixes toFixed on undefined) ----
const num = (v: any): number => {
  const x = typeof v === 'number' ? v : Number(v);
  return Number.isFinite(x) ? x : 0;
};

const euro = (v: any): string => num(v).toFixed(2);

export const Receipt: React.FC<ReceiptProps> = ({
  transaction,
  session,
  company,
  preview = false,
}) => {
  const containerStyle: React.CSSProperties = {
    fontFamily: '"JetBrains Mono", monospace',
    fontSize: '11px',
    lineHeight: '1.4',
    width: '58mm',
    background: 'white',
    color: 'black',
    padding: '6mm 4mm',
    ...(preview
      ? {
          margin: '0 auto',
          boxShadow: '0 10px 25px -5px rgba(0,0,0,0.1)',
          border: '1px solid #e2e8f0',
        }
      : {}),
  };

  if (!transaction && !session) return null;

  const ts = transaction?.timestamp || session?.endTime || Date.now();

  return (
    <div style={containerStyle}>
      <div
        style={{
          textAlign: 'center',
          fontWeight: 'bold',
          textTransform: 'uppercase',
          marginBottom: '2px',
        }}
      >
        {company?.name || ''}
      </div>

      {!!company?.address && (
        <div style={{ textAlign: 'center', fontSize: '9px' }}>{company.address}</div>
      )}
      {!!company?.address2 && (
        <div style={{ textAlign: 'center', fontSize: '9px' }}>{company.address2}</div>
      )}
      {!!company?.website && (
        <div
          style={{
            textAlign: 'center',
            fontSize: '9px',
            textDecoration: 'underline',
          }}
        >
          {company.website}
        </div>
      )}
      {!!company?.vatNumber && (
        <div style={{ textAlign: 'center', fontSize: '9px' }}>{company.vatNumber}</div>
      )}

      <div style={{ textAlign: 'center', fontSize: '9px', marginTop: '4px' }}>
        {new Date(ts).toLocaleString('nl-NL')}
      </div>

      <div style={{ borderBottom: '1px dashed black', margin: '6px 0' }} />

      {/* ---------------- TICKET ---------------- */}
      {transaction && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
          <div style={{ textAlign: 'center', fontWeight: 'bold', marginBottom: '4px' }}>
            TICKET #{String(transaction.id || '').slice(-6)}
          </div>

          {(transaction.items || []).map((item: any, idx: number) => {
            const qty = num(item?.quantity);
            const price = num(item?.price);
            const line = price * qty;

            return (
              <div key={idx} style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ flex: 1 }}>
                  {qty}x {String(item?.name || '')}
                </span>
                <span style={{ marginLeft: '4px' }}>€{euro(line)}</span>
              </div>
            );
          })}

          <div style={{ borderBottom: '1px dashed black', margin: '6px 0' }} />

          <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 'bold' }}>
            <span>TOTAAL (BTW incl.)</span>
            <span>€{euro(transaction.total)}</span>
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '9px', marginTop: '4px' }}>
            <span>BTW 21%</span>
            <span>€{euro(transaction.vatHigh)}</span>
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '9px' }}>
            <span>BTW 0%</span>
            <span>€{euro(transaction.vat0)}</span>
          </div>

          <div style={{ marginTop: '6px', fontSize: '9px' }}>
            Betaalwijze: {String((transaction as any).paymentMethod || '')}
          </div>

          {!!(transaction as any).salesmanName && (
            <div style={{ fontSize: '9px' }}>
              Bediening: {String((transaction as any).salesmanName)}
            </div>
          )}
        </div>
      )}

      {/* ---------------- SHIFT REPORT ---------------- */}
      {session && session.summary && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
          <div style={{ textAlign: 'center', fontWeight: 'bold', marginBottom: '4px' }}>
            SHIFT RAPPORT
          </div>

          <div style={{ fontSize: '9px' }}>Shift ID: {String(session.id || '').slice(-8)}</div>
          <div style={{ fontSize: '9px' }}>
            Start: {new Date(num(session.startTime) || Date.now()).toLocaleTimeString('nl-NL')}
          </div>
          {!!session.endTime && (
            <div style={{ fontSize: '9px' }}>
              Eind: {new Date(num(session.endTime)).toLocaleTimeString('nl-NL')}
            </div>
          )}

          <div style={{ borderBottom: '1px dashed black', margin: '6px 0' }} />

          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span>Tickets:</span>
            <span>{num(session.summary.transactionCount)}</span>
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 'bold' }}>
            <span>OMZET:</span>
            <span>€{euro(session.summary.totalSales)}</span>
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '9px' }}>
            <span>- Contant:</span>
            <span>€{euro(session.summary.cashTotal)}</span>
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '9px' }}>
            <span>- Kaart:</span>
            <span>€{euro(session.summary.cardTotal)}</span>
          </div>

          <div style={{ borderBottom: '1px dashed black', margin: '6px 0' }} />

          <div style={{ fontWeight: 'bold', textAlign: 'center', fontSize: '9px', marginBottom: '2px' }}>
            PRODUCTEN VERKOCHT
          </div>

          {!!session.summary.productSales &&
            Object.entries(session.summary.productSales as Record<string, any>).map(([name, qty]) => (
              <div
                key={name}
                style={{ display: 'flex', justifyContent: 'space-between', fontSize: '9px' }}
              >
                <span style={{ flex: 1, paddingRight: '4px' }}>{name}</span>
                <span style={{ fontWeight: 'bold' }}>x{num(qty)}</span>
              </div>
            ))}

          <div style={{ borderBottom: '1px dashed black', margin: '6px 0' }} />

          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span>Start Kas:</span>
            <span>€{euro(session.startCash)}</span>
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span>Verwacht:</span>
            <span>€{euro(session.expectedCash || 0)}</span>
          </div>

          {session.endCash !== undefined && session.endCash !== null && (
            <>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>Geteld:</span>
                <span>€{euro(session.endCash)}</span>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 'bold' }}>
                <span>VERSCHIL:</span>
                <span>€{euro(num(session.endCash) - num(session.expectedCash || 0))}</span>
              </div>
            </>
          )}
        </div>
      )}

      {/* Footer only on ticket (not on session report) */}
      {!session && (
        <div style={{ textAlign: 'center', marginTop: '10px', fontSize: '9px', fontStyle: 'italic' }}>
          {company?.footerMessage || ''}
        </div>
      )}
    </div>
  );
};
