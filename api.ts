import { Product, Transaction, SalesSession, CompanyDetails, CloudConfig } from '../types.ts';

export type AppMode = 'SHOP' | 'TOUR';

// ====== CONFIG ======
const API_BASE_URL = 'https://www.krauker.be/appdata/api/index.php';
const CLOUD_STORAGE_KEY = 'barpos_cloud_data_'; // legacy simulatie (mag blijven)

// Trim helper
const cleanSyncId = (s: string) => (s || '').trim();

// Per-mode keys
const cloudKey = (mode: AppMode) => `barpos_cloud_config_${mode}`;
const sinceKey = (mode: AppMode) => `barpos_server_since_${mode}`;

// Small helpers
const safeJson = <T,>(raw: string | null, fallback: T): T => {
  try { return raw ? (JSON.parse(raw) as T) : fallback; } catch { return fallback; }
};

type PullDelta = {
  ok: boolean;
  mode: AppMode;
  serverTime: number;
  products: Product[];
  transactions: Transaction[];
  sessions: SalesSession[];
  company: CompanyDetails | null;
};

async function fetchJson(url: string, options?: RequestInit) {
  const resp = await fetch(url, options);
  const txt = await resp.text();
  let data: any = null;
  try { data = txt ? JSON.parse(txt) : null; } catch { /* ignore */ }

  if (!resp.ok) {
    const msg = data?.error || resp.statusText || 'Request failed';
    throw new Error(`${resp.status} ${msg}`);
  }
  return data;
}

export const apiService = {
  // ===== Mode =====
  getActiveMode(): AppMode | null {
    return (localStorage.getItem('barpos_active_mode') as AppMode) || null;
  },

  setActiveMode(mode: AppMode | null) {
    if (mode) localStorage.setItem('barpos_active_mode', mode);
    else localStorage.removeItem('barpos_active_mode');
  },

  // ===== CloudConfig (per mode) =====
  // We gebruiken CloudConfig.syncId als "API token" (Bearer)
  getCloudConfig(): CloudConfig {
    const mode = this.getActiveMode();
    if (!mode) return { syncId: '', isAutoSync: false };
    const d = localStorage.getItem(cloudKey(mode));
    return d ? safeJson<CloudConfig>(d, { syncId: '', isAutoSync: false }) : { syncId: '', isAutoSync: false };
  },

  setCloudConfig(config: CloudConfig) {
    const mode = this.getActiveMode();
    if (!mode) return;
    const syncId = cleanSyncId(config.syncId);
    localStorage.setItem(cloudKey(mode), JSON.stringify({ ...config, syncId }));
  },

  // ===== Local storage per mode =====
  async get(key: string): Promise<any> {
    const mode = this.getActiveMode();
    if (!mode) return null;
    const data = localStorage.getItem(`barpos_${mode}_${key}`);
    return data ? JSON.parse(data) : null;
  },

  async save(key: string, data: any): Promise<void> {
    const mode = this.getActiveMode();
    if (!mode) return;
    localStorage.setItem(`barpos_${mode}_${key}`, JSON.stringify(data));
  },

  async getProducts(): Promise<Product[]> { return (await this.get('products')) || []; },
  async saveProducts(p: Product[]) { await this.save('products', p); },

  async getTransactions(): Promise<Transaction[]> { return (await this.get('transactions')) || []; },
  async saveTransactions(t: Transaction[]) { await this.save('transactions', t); },

  async getSessions(): Promise<SalesSession[]> { return (await this.get('sessions')) || []; },
  async saveSessions(s: SalesSession[]) { await this.save('sessions', s); },

  async getCompany(): Promise<CompanyDetails | null> { return await this.get('company'); },
  async saveCompany(c: CompanyDetails) { await this.save('company', c); },

  // ===== Initial hydration (from /data/*.json in your static app) =====
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

      if (pResp.ok && cResp.ok) {
        const products = await pResp.json();
        const company = await cResp.json();

        await this.saveProducts(products);
        await this.saveCompany(company);

        return { products, company };
      }
    } catch (e) {
      console.error('Reset to defaults failed', e);
    }
    return null;
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

  // ===== Legacy "cloud simulation" kept (optional) =====
  async pushToCloud(config: CloudConfig, products: Product[], company: CompanyDetails): Promise<boolean> {
    const syncId = cleanSyncId(config.syncId);
    if (!syncId) return false;
    try {
      const payload = { products, company, timestamp: Date.now() };
      localStorage.setItem(`${CLOUD_STORAGE_KEY}${syncId}`, JSON.stringify(payload));
      this.setCloudConfig({ ...config, syncId, lastSync: Date.now() } as any);
      return true;
    } catch (e) {
      console.error('Push to simulated cloud failed', e);
      return false;
    }
  },

  async pullFromCloud(config: CloudConfig): Promise<{ products: Product[]; company: CompanyDetails } | null> {
    const syncId = cleanSyncId(config.syncId);
    if (!syncId) return null;
    try {
      const raw = localStorage.getItem(`${CLOUD_STORAGE_KEY}${syncId}`);
      if (!raw) return null;
      const data = JSON.parse(raw);
      return { products: data.products, company: data.company };
    } catch (e) {
      console.error('Pull from simulated cloud failed', e);
      return null;
    }
  },

  // ============================================================
  // ✅ SERVER SYNC (krauker.be/appdata/api)
  // CloudConfig.syncId = API_TOKEN
  // ============================================================

  getServerSince(mode: AppMode): number {
    const raw = localStorage.getItem(sinceKey(mode));
    const n = raw ? parseInt(raw, 10) : 0;
    return Number.isFinite(n) ? n : 0;
  },

  setServerSince(mode: AppMode, ts: number) {
    localStorage.setItem(sinceKey(mode), String(ts || 0));
  },

  getApiTokenOrThrow(): string {
    const cfg = this.getCloudConfig();
    const token = cleanSyncId(cfg.syncId);
    if (!token) throw new Error('Geen API token ingevuld (Sync ID veld).');
    return token;
  },

  // Optional: init server from local defaults (products+company)
  async serverInitFromDefaults(products: Product[], company: CompanyDetails): Promise<number> {
    const mode = this.getActiveMode();
    if (!mode) throw new Error('No active mode');
    const token = this.getApiTokenOrThrow();

    const data = await fetchJson(`${API_BASE_URL}?action=init`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify({ mode, products, company }),
    });

    const serverTime = Number(data?.serverTime || 0) || Date.now();
    this.setServerSince(mode, serverTime);
    return serverTime;
  },

  // Push a sale (ticket) => server decrements stock atomically
  async serverPushSale(tx: Transaction): Promise<number> {
    const mode = this.getActiveMode();
    if (!mode) throw new Error('No active mode');
    const token = this.getApiTokenOrThrow();

    const data = await fetchJson(`${API_BASE_URL}?action=sale`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify({ mode, tx }),
    });

    const serverTime = Number(data?.serverTime || 0) || Date.now();
    // move since forward (safe)
    this.setServerSince(mode, Math.max(this.getServerSince(mode), serverTime));
    return serverTime;
  },

  // Push session OPEN/CLOSED
  async serverPushSession(session: SalesSession): Promise<number> {
    const mode = this.getActiveMode();
    if (!mode) throw new Error('No active mode');
    const token = this.getApiTokenOrThrow();

    const data = await fetchJson(`${API_BASE_URL}?action=session`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify({ mode, session }),
    });

    const serverTime = Number(data?.serverTime || 0) || Date.now();
    this.setServerSince(mode, Math.max(this.getServerSince(mode), serverTime));
    return serverTime;
  },

  // Pull deltas since last serverTime
  async serverPullDelta(): Promise<PullDelta> {
    const mode = this.getActiveMode();
    if (!mode) throw new Error('No active mode');

    const since = this.getServerSince(mode);
    const url = `${API_BASE_URL}?action=pull&mode=${encodeURIComponent(mode)}&since=${encodeURIComponent(String(since))}`;

    const data = await fetchJson(url, { method: 'GET' });

    const serverTime = Number(data?.serverTime || 0) || Date.now();
    this.setServerSince(mode, Math.max(since, serverTime));

    return {
      ok: true,
      mode,
      serverTime,
      products: (data?.products || []) as Product[],
      transactions: (data?.transactions || []) as Transaction[],
      sessions: (data?.sessions || []) as SalesSession[],
      company: (data?.company || null) as CompanyDetails | null,
    };
  },
};
