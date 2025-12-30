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
  stock?: number;
  updatedAt: number;
}

export interface CartItem extends Product {
  quantity: number;
}

export interface Transaction {
  id: string;
  sessionId: string;
  timestamp: number;
  dateStr: string;
  items: CartItem[];
  subtotal: number;
  vat0: number;
  vat21: number;
  total: number;
  paymentMethod: PaymentMethod;
  sellerName?: string;
  updatedAt: number;
}

export interface CashEntry {
  id: string;
  sessionId: string;
  timestamp: number;
  type: 'IN' | 'OUT';
  amount: number;
  reason: string;
  updatedAt: number;
}

export interface Seller {
  id: string;
  name: string;
  role: 'ADMIN' | 'USER';
  active: boolean;
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

export interface SalesSession {
  id: string;
  startTime: number;
  endTime?: number;
  startCash: number;      // Je originele veld
  endCash?: number;       // Je originele veld
  expectedCash?: number;  // Je originele veld
  status: 'OPEN' | 'CLOSED';
  // Extra object voor de printer-compatibiliteit
  cashManagement: {
    openingBalance: number;
    closingBalance: number;
    difference: number;
  };
  summary: DailySummary;
  updatedAt: number;
}

export interface CompanyDetails {
  name: string;
  address: string;
  address2?: string;
  vatNumber: string;
  website?: string;
  sellerName?: string;
  salesmen?: string[];
  footerMessage: string;
  managerPin?: string;
  masterPassword?: string;
  updatedAt: number;
}
