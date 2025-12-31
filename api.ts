
import { Product, Transaction, SalesSession, CashEntry, CompanyDetails } from '../types';

export type AppMode = 'SHOP' | 'TOUR';

export const apiService = {
  // Global Mode Storage
  getActiveMode(): AppMode | null {
    return (localStorage.getItem('barpos_active_mode') as AppMode) || null;
  },

  setActiveMode(mode: AppMode) {
    localStorage.setItem('barpos_active_mode', mode);
  },

  async get(key: string): Promise<any> {
    const mode = this.getActiveMode();
    if (!mode) return null; // No mode selected yet
    
    const storageKey = `barpos_${mode}_${key}`;
    const data = localStorage.getItem(storageKey);
    
    if (!data) {
      // Seed data from JSON if not in storage
      try {
        if (key === 'products') {
          const fileName = mode === 'TOUR' ? '/products_tour.json' : '/products_shop.json';
          const res = await fetch(fileName);
          if (res.ok) return await res.json();
        }
        if (key === 'company') {
          const res = await fetch('/company.json');
          if (res.ok) {
            const company = await res.json();
            return { ...company, name: `${company.name} - ${mode}` };
          }
        }
      } catch (e) {
        console.error("Failed to seed from JSON file", e);
      }
      return null;
    }
    return JSON.parse(data);
  },

  async save(key: string, data: any): Promise<void> {
    const mode = this.getActiveMode();
    if (!mode) return;
    const storageKey = `barpos_${mode}_${key}`;
    localStorage.setItem(storageKey, JSON.stringify(data));
  },

  async getProducts(): Promise<Product[]> {
    return (await this.get('products')) || [];
  },

  async saveProducts(products: Product[]): Promise<void> {
    await this.save('products', products);
  },

  async getTransactions(): Promise<Transaction[]> {
    return (await this.get('transactions')) || [];
  },

  async saveTransactions(transactions: Transaction[]): Promise<void> {
    await this.save('transactions', transactions);
  },

  async getSessions(): Promise<SalesSession[]> {
    return (await this.get('sessions')) || [];
  },

  async saveSessions(sessions: SalesSession[]): Promise<void> {
    await this.save('sessions', sessions);
  },

  async getCompany(): Promise<CompanyDetails | null> {
    return await this.get('company');
  },

  async saveCompany(company: CompanyDetails): Promise<void> {
    await this.save('company', company);
  }
};
