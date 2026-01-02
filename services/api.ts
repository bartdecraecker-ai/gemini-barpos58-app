
import { Product, Transaction, SalesSession, CompanyDetails, CloudConfig } from '../types.ts';

export type AppMode = 'SHOP' | 'TOUR';

// Generic storage key for the cloud simulation
const CLOUD_STORAGE_KEY = 'barpos_cloud_data_';

export const apiService = {
  getActiveMode(): AppMode | null {
    return (localStorage.getItem('barpos_active_mode') as AppMode) || null;
  },
  setActiveMode(mode: AppMode) {
    if (mode) localStorage.setItem('barpos_active_mode', mode);
    else localStorage.removeItem('barpos_active_mode');
  },
  getCloudConfig(): CloudConfig {
    const d = localStorage.getItem('barpos_cloud_config');
    return d ? JSON.parse(d) : { syncId: '', isAutoSync: false };
  },
  setCloudConfig(config: CloudConfig) {
    localStorage.setItem('barpos_cloud_config', JSON.stringify(config));
  },
  async get(key: string): Promise<any> {
    const mode = this.getActiveMode();
    if (!mode) return null;
    const data = localStorage.getItem(`barpos_${mode}_${key}`);
    return data ? JSON.parse(data) : null;
  },
  async save(key: string, data: any): Promise<void> {
    const mode = this.getActiveMode();
    if (!mode) return;
    console.debug(`[Debug] Saving ${key} to local storage for mode ${mode}`);
    localStorage.setItem(`barpos_${mode}_${key}`, JSON.stringify(data));
  },
  
  // Cloud Sync Logic (Simulated)
  async pushToCloud(config: CloudConfig, products: Product[], company: CompanyDetails): Promise<boolean> {
    if (!config.syncId) return false;
    try {
      const payload = { products, company, timestamp: Date.now() };
      localStorage.setItem(`${CLOUD_STORAGE_KEY}${config.syncId}`, JSON.stringify(payload));
      this.setCloudConfig({ ...config, lastSync: Date.now() });
      return true;
    } catch (e) {
      return false;
    }
  },

  async pullFromCloud(config: CloudConfig): Promise<{products: Product[], company: CompanyDetails} | null> {
    if (!config.syncId) return null;
    try {
      const raw = localStorage.getItem(`${CLOUD_STORAGE_KEY}${config.syncId}`);
      if (!raw) return null;
      const data = JSON.parse(raw);
      return { products: data.products, company: data.company };
    } catch (e) {
      return null;
    }
  },

  async resetToDefaults(): Promise<{products: Product[], company: CompanyDetails} | null> {
    const mode = this.getActiveMode();
    if (!mode) return null;

    try {
      const prodFile = mode === 'TOUR' ? 'products_tour.json' : 'products_shop.json';
      const compFile = mode === 'TOUR' ? 'company_tour.json' : 'company_shop.json';

      console.debug(`[Debug] Fetching defaults from ${prodFile} and ${compFile}`);
      
      const [pResp, cResp] = await Promise.all([
        fetch(prodFile),
        fetch(compFile)
      ]);

      if (pResp.ok && cResp.ok) {
        const products = await pResp.json();
        const company = await cResp.json();
        
        await this.saveProducts(products);
        await this.saveCompany(company);
        
        return { products, company };
      }
    } catch (e) {
      console.error("Reset to defaults failed", e);
    }
    return null;
  },

  async hydrateInitialData() {
    const mode = this.getActiveMode();
    if (!mode) return;
    
    const existingProducts = localStorage.getItem(`barpos_${mode}_products`);
    const existingCompany = localStorage.getItem(`barpos_${mode}_company`);

    // Only hydrate if we have absolutely no local data for this mode
    if (!existingProducts || !existingCompany) {
      console.debug(`[Debug] No local data found for ${mode}, performing initial hydration.`);
      await this.resetToDefaults();
    } else {
      console.debug(`[Debug] Local data found for ${mode}, skipping initial hydration.`);
    }
  },

  async getProducts(): Promise<Product[]> { return (await this.get('products')) || []; },
  async saveProducts(p: Product[]) { await this.save('products', p); },
  async getTransactions(): Promise<Transaction[]> { return (await this.get('transactions')) || []; },
  async saveTransactions(t: Transaction[]) { await this.save('transactions', t); },
  async getSessions(): Promise<SalesSession[]> { return (await this.get('sessions')) || []; },
  async saveSessions(s: SalesSession[]) { await this.save('sessions', s); },
  async getCompany(): Promise<CompanyDetails | null> { return await this.get('company'); },
  async saveCompany(c: CompanyDetails) { await this.save('company', c); }
};
