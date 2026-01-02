
export enum PaymentMethod {
  CASH = 'CASH',
  CARD = 'CARD'
}

export interface Product {
  id: string;
  name: string;
  price: number;
  vatRate: number; 
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
  vatHigh: number; 
  total: number;
  paymentMethod: PaymentMethod;
  salesmanName?: string;
  updatedAt: number;
}

export interface SalesSession {
  id: string;
  startTime: number;
  endTime?: number;
  startCash: number;
  endCash?: number;
  expectedCash?: number;
  status: 'OPEN' | 'CLOSED';
  summary?: DailySummary;
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

export interface DailySummary {
  totalSales: number;
  transactionCount: number;
  cashTotal: number;
  cardTotal: number;
  vat0Total: number;
  vatHighTotal: number;
  productSales?: Record<string, number>;
  firstTicketId?: string;
  lastTicketId?: string;
}

export interface CloudConfig {
  syncId: string;
  lastSync?: number;
  isAutoSync: boolean;
  endpoint?: string;
}
