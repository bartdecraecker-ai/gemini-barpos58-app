import { Product, Transaction, SalesSession, CompanyDetails, CloudConfig } from '../types.ts';

export type AppMode = 'SHOP' | 'TOUR';

// Generic storage key for the cloud simulation
const CLOUD_STORAGE_KEY = 'barpos_cloud_data_';

// Trim helper (prevents "syncId " vs "syncId" issues)
const cleanSyncId = (s: string) => (s || '').trim();

// Cloud keys per mode
const cloudKey = (mode: AppMode, syncId: string) => `${CLOUD_STORAGE_KEY}${mode}_${syncId}`;
const cloudConfigKey = (mode: AppMode) => `barpos_cloud_config_${mode}`;

// Debug / validation helpers
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

  // Cloud config is stored per mode
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
    if (!mode) {
      warn('get(): no active mode', { key });
      return null;
    }

    const storageKey = `barpos_${mode}_${key}`;
    const raw = localStorage.getItem(storageKey);
    if (!raw) {
      log('get(): missing', storageKey);
      return null;
    }

    try {
      return JSON.parse(raw);
    } catch (e) {
      console.error('[api] get(): JSON parse failed', { storageKey, e });
      return null;
    }
  },

  async save(key: string, data: any): Promise<void> {
    const mode = this.getActiveMode();
    if (!mode) {
      warn('save(): no active mode', { key });
      return;
    }

    const storageKey = `barpos_${mode}_${key}`;
    localStorage.setItem(storageKey, JSON.stringify(data));
    log('save(): ok', storageKey, { bytes: JSON.stringify(data).length });
  },

  // Cloud Sync Logic (Simulated) - stored per mode + syncId
  async pushToCloud(config: CloudConfig, products: Product[], company: CompanyDetails): Promise<boolean> {
    const mode = this.getActiveMode();
    if (!mode) {
      warn('pushToCloud(): no active mode');
      return false;
    }

    const syncId = cleanSyncId(config.syncId);
    if (!syncId) {
      warn('pushToCloud(): missing syncId');
      return false;
    }

    try {
      const payload = { products, company, timestamp: Date.now(), mode };
      const key = cloudKey(mode, syncId);

      localStorage.setItem(key, JSON.stringify(payload));
      this.setCloudConfig({ ...config, syncId, lastSync: Date.now() });

      log('pushToCloud(): ok', { mode, key, products: products.length, company: company?.name });
      return true;
    } catch (e) {
      console.error('[api] Push to cloud failed', e);
      return false;
    }
  },

  async pullFromCloud(config: CloudConfig): Promise<{ products: Product[]; company: CompanyDetails } | null> {
    const mode = this.getActiveMode();
    if (!mode) {
      warn('pullFromCloud(): no active mode');
      return null;
    }

    const syncId = cleanSyncId(config.syncId);
    if (!syncId) {
      warn('pullFromCloud(): missing syncId');
      return null;
    }

    const key = cloudKey(mode, syncId);

    try {
      const raw = localStorage.getItem(key);
      if (!raw) {
        warn('pullFromCloud(): no data for key', { mode, key });
        return null;
      }

      const data = JSON.parse(raw);

      if (!isProductArray(data.products) || !isCompany(data.company)) {
        console.error('[api] pullFromCloud(): invalid payload', { mode, key, data });
        return null;
      }

      log('pullFromCloud(): ok', { mode, key, products: data.products.length, company: data.company.name });
      return { products: data.products, company: data.company };
    } catch (e) {
      console.error('[api] Pull from cloud failed', { mode, key, e });
      return null;
    }
  },

  async resetToDefaults(): Promise<{ products: Product[]; company: CompanyDetails } | null> {
    const mode = this.getActiveMode();
    if (!mode) {
      warn('resetToDefaults(): no active mode');
      return null;
    }

    try {
      const prodFile = mode === 'TOUR' ? '/data/products_tour.json' : '/data/products_shop.json';
      const compFile = mode === 'TOUR' ? '/data/company_tour.json' : '/data/company_shop.json';

      log('resetToDefaults(): fetching', { mode, prodFile, compFile });

      const [pResp, cResp] = await Promise.all([
        fetch(prodFile, { cache: 'no-store' }),
        fetch(compFile, { cache: 'no-store' }),
      ]);

      if (!pResp.ok || !cResp.ok) {
        warn('resetToDefaults(): fetch failed', {
          mode,
          prodFile,
          compFile,
          productsStatus: pResp.status,
          companyStatus: cResp.status,
        });
        return null;
      }

      const products = await pResp.json();
      const company = await cResp.json();

      if (!isProductArray(products)) {
        console.error('[api] resetToDefaults(): invalid products JSON shape', {
          mode,
          prodFile,
          sample: products?.[0],
        });
        return null;
      }

      if (!isCompany(company)) {
        console.error('[api] resetToDefaults(): invalid company JSON shape', { mode, compFile, company });
        return null;
      }

      await this.saveProducts(products);
      await this.saveCompany(company);

      log('resetToDefaults(): applied', {
        mode,
        products: products.length,
        company: company.name,
      });

      return { products, company };
    } catch (e) {
      console.error('[api] Reset to defaults failed', e);
      return null;
    }
  },

  async hydrateInitialData() {
    const mode = this.getActiveMode();
    if (!mode) {
      warn('hydrateInitialData(): no active mode');
      return;
    }

    const existingProducts = localStorage.getItem(`barpos_${mode}_products`);
    const existingCompany = localStorage.getItem(`barpos_${mode}_company`);

    log('hydrateInitialData()', {
      mode,
      hasProducts: !!existingProducts,
      hasCompany: !!existingCompany,
    });

    if (!existingProducts || !existingCompany) {
      log('hydrateInitialData(): performing initial hydration', { mode });
      await this.resetToDefaults();
    } else {
      log('hydrateInitialData(): skipping, local data exists', { mode });
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
