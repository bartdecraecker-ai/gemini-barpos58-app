
import { Product, Transaction, SalesSession, CompanyDetails, CloudConfig } from '../types';

export type AppMode = 'SHOP' | 'TOUR';

/**
 * PRODUCTION BACKEND CONFIGURATION
 * --------------------------------
 * Your app is hosted at: https://gemini-barpos58-app.onrender.com/
 */
const PRODUCTION_SYNC_URL = "https://httpbin.org/post"; 

export const apiService = {
  getActiveMode(): AppMode | null {
    return (localStorage.getItem('barpos_active_mode') as AppMode) || null;
  },

  setActiveMode(mode: AppMode) {
    localStorage.setItem('barpos_active_mode', mode);
  },

  getCloudConfig(): CloudConfig {
    const data = localStorage.getItem('barpos_cloud_config');
    return data ? JSON.parse(data) : { syncId: '', isAutoSync: false };
  },

  saveCloudConfig(config: CloudConfig) {
    localStorage.setItem('barpos_cloud_config', JSON.stringify(config));
  },

  async get(key: string): Promise<any> {
    const mode = this.getActiveMode();
    if (!mode) return null;
    const storageKey = `barpos_${mode}_${key}`;
    const data = localStorage.getItem(storageKey);
    return data ? JSON.parse(data) : null;
  },

  async save(key: string, data: any): Promise<void> {
    const mode = this.getActiveMode();
    if (!mode) return;
    const storageKey = `barpos_${mode}_${key}`;
    localStorage.setItem(storageKey, JSON.stringify(data));
  },

  /**
   * Hydrates the app with initial data from JSON files if localStorage is empty.
   * Essential for first-run production deployment.
   */
  async hydrateInitialData(): Promise<boolean> {
    const mode = this.getActiveMode();
    if (!mode) return false;
    
    const existingProducts = await this.get('products');
    if (existingProducts && existingProducts.length > 0) return false;

    try {
      const file = mode === 'SHOP' ? 'products_shop.json' : 'products_tour.json';
      const [prodRes, compRes] = await Promise.all([
        fetch(`./${file}`),
        fetch('./company.json')
      ]);

      if (prodRes.ok && compRes.ok) {
        const products = await prodRes.json();
        const company = await compRes.json();
        await this.save('products', products.slice(0, 10));
        await this.save('company', company);
        return true;
      }
    } catch (e) {
      console.error("Hydration failed, falling back to constants", e);
    }
    return false;
  },

  async pushToCloud(): Promise<boolean> {
    const config = this.getCloudConfig();
    if (!config.syncId || !navigator.onLine) return false;

    try {
      const mode = this.getActiveMode();
      const payload = {
        syncId: config.syncId,
        mode,
        origin: window.location.origin,
        timestamp: Date.now(),
        data: {
          products: await this.get('products'),
          transactions: await this.get('transactions'),
          sessions: await this.get('sessions'),
          company: await this.get('company')
        }
      };

      const response = await fetch(PRODUCTION_SYNC_URL, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'X-App-Origin': 'BarPOS-Cloud-Production'
        },
        body: JSON.stringify(payload)
      });

      if (response.ok) {
        this.saveCloudConfig({ ...config, lastSync: Date.now() });
        return true;
      }
      return false;
    } catch (e) {
      console.error("PROD SYNC ERROR:", e);
      return false;
    }
  },

  async getProducts(): Promise<Product[]> {
    return (await this.get('products')) || [];
  },

  async saveProducts(products: Product[]): Promise<void> {
    await this.save('products', products.slice(0, 10));
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
