
export enum PaymentMethod {
  CASH = 'CASH',
  CARD = 'CARD',
}

export interface Product {
  id: string;
  name: string;
  price: number;
  vatRate: 0 | 21;
  color?: string;
  stock?: number; // Quantity available
}

export interface CartItem extends Product {
  quantity: number;
}

export interface Transaction {
  id: string;
  sessionId: string; // Link to specific sales period
  timestamp: number;
  dateStr: string; // DD/MM/YYYY
  items: CartItem[];
  subtotal: number;
  vat0: number;
  vat21: number;
  total: number;
  paymentMethod: PaymentMethod;
}

export interface CashEntry {
  id: string;
  sessionId: string; // Link to specific sales period
  timestamp: number;
  type: 'IN' | 'OUT';
  amount: number;
  reason: string;
}

export interface SalesSession {
  id: string;
  startTime: number;
  endTime?: number;
  startCash: number; // Opening float
  endCash?: number; // Actual counted cash at close
  expectedCash?: number; // Calculated cash at close
  status: 'OPEN' | 'CLOSED';
  summary?: DailySummary; // Snapshot of totals when closed
}

export interface CompanyDetails {
  name: string;
  address: string;
  address2?: string; // Second line of address
  vatNumber: string;
  website?: string;
  sellerName?: string; // Currently active seller
  salesmen?: string[]; // List of available sellers
  footerMessage: string;
}

export interface DailySummary {
  totalSales: number;
  transactionCount: number;
  cashTotal: number;
  cardTotal: number;
  vat0Total: number;
  vat21Total: number;
  firstTicketId?: string;
  lastTicketId?: string;
}
