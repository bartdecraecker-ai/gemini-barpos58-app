import { Product, Transaction, SalesSession, CompanyDetails, CloudConfig } from '../types.ts';

export type AppMode = 'SHOP' | 'TOUR';

// Centrale PHP backend.
// api.php staat in /pos-data/ op www.krauker.be.
const SERVER_URL = 'https://www.krauker.be/pos-data/api.php';

const cleanSyncId = (s: string) => (s || '').trim();
const cloudConfigKey = (mode: AppMode) => `barpos_cloud_config_${mode}`;
const pendingSalesKey = (mode: AppMode) => `barpos_pending_sales_${mode}`;

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

function getPendingSales(mode: AppMode): Transaction[] {
  try {
    const raw = localStorage.getItem(pendingSalesKey(mode));
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function savePendingSales(mode: AppMode, sales: Transaction[]) {
  if (sales.length === 0) localStorage.removeItem(pendingSalesKey(mode));
  else localStorage.setItem(pendingSalesKey(mode), JSON.stringify(sales));
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

    try {
      const raw = localStorage.getItem(cloudConfigKey(mode));
      return raw ? JSON.parse(raw) : { syncId: '', isAutoSync: false };
    } catch {
      return { syncId: '', isAutoSync: false };
    }
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
  // CENTRALE SERVER SYNCHRONISATIE
  // ----------------------------------------------------

  async serverPullDelta(): Promise<{ active_session?: SalesSession | null; transactions?: Transaction[]; sessions?: SalesSession[]; products?: Product[]; company?: CompanyDetails } | null> {
    const mode = this.getActiveMode();
    if (!mode) return null;
    const config = this.getCloudConfig();
    const params = new URLSearchParams({ action: 'get_delta', mode });
    if (config.syncId) params.set('syncId', cleanSyncId(config.syncId));
    try {
      const res = await fetch(`${SERVER_URL}?${params.toString()}`, { cache: 'no-store' });
      const data = await res.json().catch(() => null);
      if (!res.ok || !data || data.status === 'error') {
        warn('serverPullDelta failed:', data?.message || `HTTP ${res.status}`);
        return null;
      }
      return data;
    } catch (e) {
      warn('serverPullDelta failed:', e);
      return null;
    }
  },

  async serverPushSale(transaction: Transaction): Promise<boolean> {
    const mode = this.getActiveMode();
    if (!mode) return false;
    const config = this.getCloudConfig();
    try {
      const res = await fetch(`${SERVER_URL}?action=push_sale`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...transaction, mode, syncId: cleanSyncId(config.syncId) }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok || !data || data.status !== 'success') {
        warn('serverPushSale failed:', data?.message || `HTTP ${res.status}`);
        return false;
      }
      return true;
    } catch (e) {
      warn('serverPushSale failed:', e);
      return false;
    }
  },

  async serverPushSession(session: SalesSession | null): Promise<boolean> {
    const mode = this.getActiveMode();
    if (!mode || !session) return false;
    const config = this.getCloudConfig();
    try {
      const res = await fetch(`${SERVER_URL}?action=push_session`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...session, mode, syncId: cleanSyncId(config.syncId) }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok || !data || data.status !== 'success') {
        warn('serverPushSession failed:', data?.message || `HTTP ${res.status}`);
        return false;
      }
      return true;
    } catch (e) {
      warn('serverPushSession failed:', e);
      return false;
    }
  },

  async pushToCloud(config: CloudConfig, products: Product[], company: CompanyDetails): Promise<boolean> {
    const mode = this.getActiveMode();
    if (!mode || !config.syncId) return false;

    try {
      const payload = { products, company, timestamp: Date.now(), mode, syncId: cleanSyncId(config.syncId) };
      const res = await fetch(`${SERVER_URL}?action=push_config`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json().catch(() => null);
      if (res.ok && data?.status === 'success') {
        this.setCloudConfig({ ...config, lastSync: Date.now() });
        return true;
      }
      warn('pushToCloud rejected:', data || res.status);
      return false;
    } catch (e) {
      console.error('[api] Push to cloud failed', e);
      return false;
    }
  },

  async pullFromCloud(config: CloudConfig): Promise<{ products: Product[]; company: CompanyDetails } | null> {
    const mode = this.getActiveMode();
    if (!mode || !config.syncId) return null;

    const delta = await this.serverPullDelta();
    if (delta && delta.products && delta.company) {
      this.setCloudConfig({ ...config, lastSync: Date.now() });
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
