
import { Product, Transaction, SalesSession, CashEntry, CompanyDetails } from '../types';

/**
 * CLOUD-READY API SERVICE
 * Interacts with localStorage for persistence and seeds from local JSON files if empty.
 */

const CLOUD_DELAY = 300; 

const wait = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

export const apiService = {
  async get(key: string): Promise<any> {
    await wait(CLOUD_DELAY);
    const data = localStorage.getItem(`barpos_cloud_${key}`);
    
    if (!data) {
      // Seed from JSON files if it's the first time
      try {
        if (key === 'products') {
          const res = await fetch('/products.json');
          if (res.ok) return await res.json();
        }
        if (key === 'company') {
          const res = await fetch('/company.json');
          if (res.ok) return await res.json();
        }
      } catch (e) {
        console.error("Failed to seed from JSON file", e);
      }
      return null;
    }
    
    return JSON.parse(data);
  },

  async save(key: string, data: any): Promise<void> {
    await wait(100);
    localStorage.setItem(`barpos_cloud_${key}`, JSON.stringify(data));
  },

  async getProducts(): Promise<Product[]> {
    const data = await this.get('products');
    return data || [];
  },

  async saveProducts(products: Product[]): Promise<void> {
    await this.save('products', products);
  },

  async getTransactions(): Promise<Transaction[]> {
    const data = await this.get('transactions');
    return data || [];
  },

  async saveTransactions(transactions: Transaction[]): Promise<void> {
    await this.save('transactions', transactions);
  },

  async getSessions(): Promise<SalesSession[]> {
    const data = await this.get('sessions');
    return data || [];
  },

  async saveSessions(sessions: SalesSession[]): Promise<void> {
    await this.save('sessions', sessions);
  },

  async getCashEntries(): Promise<CashEntry[]> {
    const data = await this.get('cashentries');
    return data || [];
  },

  async saveCashEntries(entries: CashEntry[]): Promise<void> {
    await this.save('cashentries', entries);
  },

  async getCompany(): Promise<CompanyDetails | null> {
    return await this.get('company');
  },

  async saveCompany(company: CompanyDetails): Promise<void> {
    await this.save('company', company);
  }
};
