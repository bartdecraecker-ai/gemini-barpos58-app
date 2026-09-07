import { Product, Transaction, SalesSession, CompanyDetails, CloudConfig } from '../types.ts';

export type AppMode = 'SHOP' | 'TOUR';

// URL naar de centrale PHP backend op je server
const SERVER_URL = 'https://www.krauker.be/api.php';

// Trim helper
const cleanSyncId = (s: string) => (s || '').trim();

// Local storage key per modus
const cloudConfigKey = (mode: AppMode) => `barpos_cloud_config_${mode}`;

const DEBUG = true;

function log(...args: any[]) {
  if (DEBUG) console.debug('[api]', ...args);
}

function warn(...args: any[]) {
  console.warn('[api]', ...args);
}

function isProductArray(x: any): x is Product[] {
  return Array.isArray(x) && x.every((p) => p && typeof p === 'object' && typeof p.name === 'string');
}

function isCompany(x: any): x is CompanyDetails {
  return !!x && typeof x === 'object' && typeof (x as any).name === 'string';
}

export const apiService = {
  getActiveMode(): AppMode | null {
    return (localStorage.getItem('barpos_active_mode') as AppMode) || null;
  },

  setActiveMode(mode: AppMode | null) {
    if (mode) localStorage.setItem('barpos_active_mode', mode);
    else localStorage.removeItem('barpos_active_mode');
  },

  getCloudConfig(): CloudConfig {
    const mode = this.getActiveMode();
    if (!mode) return { syncId: '', isAutoSync: false };

    const raw = localStorage.getItem(cloudConfigKey(mode));
    return raw ? JSON.parse(raw) : { syncId: '', isAutoSync: false };
  },

  setCloudConfig(config: CloudConfig) {
    const mode = this.getActiveMode();
    if (!mode) {
      warn('setCloudConfig(): no active mode');
      return;
    }

    const syncId = cleanSyncId(config.syncId);
    localStorage.setItem(cloudConfigKey(mode), JSON.stringify({ ...config, syncId }));
  },

  async get(key: string): Promise<any> {
    const mode = this.getActiveMode();
    if (!mode) return null;

    const storageKey = `barpos_${mode}_${key}`;
    const raw = localStorage.getItem(storageKey);
    if (!raw) return null;

    try {
      return JSON.parse(raw);
    } catch (e) {
      console.error('[api] get(): JSON parse failed', { storageKey, e });
      return null;
    }
  },

  async save(key: string, data: any): Promise<void> {
    const mode = this.getActiveMode();
    if (!mode) return;

    const storageKey = `barpos_${mode}_${key}`;
    localStorage.setItem(storageKey, JSON.stringify(data));
  },

  // ----------------------------------------------------
  // SERVER SYNCHRONISATIE (HTTP POST / GET naar api.php)
  // ----------------------------------------------------

  async serverPullDelta(): Promise<{ active_session?: SalesSession; transactions?: Transaction[]; products?: Product[]; company?: CompanyDetails } | null> {
    try {
      const res = await fetch(`${SERVER_URL}?action=get_delta`, { cache: 'no-store' });
      if (!res.ok) return null;
      return await res.json();
    } catch (e) {
      warn('serverPullDelta failed:', e);
      return null;
    }
  },

  async serverPushSale(transaction: Transaction): Promise<boolean> {
    try {
      const res = await fetch(`${SERVER_URL}?action=push_sale`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(transaction),
      });
      return res.ok;
    } catch (e) {
      warn('serverPushSale failed:', e);
      return false;
    }
  },

async serverPushSession(session: SalesSession | null): Promise<boolean> {
    try {
      const res = await fetch(`${SERVER_URL}?action=push_session`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(session),
      });
      return res.ok;
    } catch (e) {
      warn('serverPushSession failed:', e);
      return false;
    }
  },
  
  // Handmatige Push/Pull knoppen in de UI
  async pushToCloud(config: CloudConfig, products: Product[], company: CompanyDetails): Promise<boolean> {
    const mode = this.getActiveMode();
    if (!mode) return false;

    try {
      const payload = { products, company, timestamp: Date.now(), mode };
      const res = await fetch(`${SERVER_URL}?action=push_config`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        this.setCloudConfig({ ...config, lastSync: Date.now() });
        return true;
      }
      return false;
    } catch (e) {
      console.error('[api] Push to cloud failed', e);
      return false;
    }
  },

  async pullFromCloud(config: CloudConfig): Promise<{ products: Product[]; company: CompanyDetails } | null> {
    const delta = await this.serverPullDelta();
    if (delta && delta.products && delta.company) {
      return { products: delta.products, company: delta.company };
    }
    return null;
  },

  // ----------------------------------------------------
  // STANDAARD DATA & LOCAL STORAGE
  // ----------------------------------------------------

  async resetToDefaults(): Promise<{ products: Product[]; company: CompanyDetails } | null> {
    const mode = this.getActiveMode();
    if (!mode) return null;

    try {
      const prodFile = mode === 'TOUR' ? '/data/products_tour.json' : '/data/products_shop.json';
      const compFile = mode === 'TOUR' ? '/data/company_tour.json' : '/data/company_shop.json';

      const [pResp, cResp] = await Promise.all([
        fetch(prodFile, { cache: 'no-store' }),
        fetch(compFile, { cache: 'no-store' }),
      ]);

      if (!pResp.ok || !cResp.ok) return null;

      const products = await pResp.json();
      const company = await cResp.json();

      if (!isProductArray(products) || !isCompany(company)) return null;

      await this.saveProducts(products);
      await this.saveCompany(company);

      return { products, company };
    } catch (e) {
      console.error('[api] Reset to defaults failed', e);
      return null;
    }
  },

  async hydrateInitialData() {
    const mode = this.getActiveMode();
    if (!mode) return;

    const existingProducts = localStorage.getItem(`barpos_${mode}_products`);
    const existingCompany = localStorage.getItem(`barpos_${mode}_company`);

    if (!existingProducts || !existingCompany) {
      await this.resetToDefaults();
    }
  },

  async getProducts(): Promise<Product[]> {
    return (await this.get('products')) || [];
  },
  async saveProducts(p: Product[]) {
    await this.save('products', p);
  },

  async getTransactions(): Promise<Transaction[]> {
    return (await this.get('transactions')) || [];
  },
  async saveTransactions(t: Transaction[]) {
    await this.save('transactions', t);
  },

  async getSessions(): Promise<SalesSession[]> {
    return (await this.get('sessions')) || [];
  },
  async saveSessions(s: SalesSession[]) {
    await this.save('sessions', s);
  },

  async getCompany(): Promise<CompanyDetails | null> {
    return await this.get('company');
  },
  async saveCompany(c: CompanyDetails) {
    await this.save('company', c);
  },
};
