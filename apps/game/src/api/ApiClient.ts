/**
 * Cliente HTTP do meta-jogo. Em dev usa a sessão do usuário seed
 * (teste@idol.dev). Sem VITE_API_URL configurada, o meta fica offline e o
 * gameplay continua funcionando (offline-tolerant desde já).
 */

export interface MeView {
  displayName: string;
  fans: number;
  tier: { id: string; name: string; multiplier: number };
  wallet: number;
  lives: { current: number; max: number; nextLifeAtMs: number | null };
  contracts: Array<{
    id: string;
    sponsorName: string;
    archetype: string;
    matchesRemaining: number;
    fansPerMatch: number;
    payoutPerMatchNow: number;
  }>;
  slots: { used: number; total: number };
}

export interface SponsorView {
  id: string;
  name: string;
  archetype: string;
  minTier: string;
  fansPerMatch: number;
  payoutPerMatchNow: number;
  canSign: boolean;
  reason: string | null;
}

const DEV_EMAIL = 'teste@idol.dev';
const DEV_PASSWORD = 'idol-dev-123';
const TOKEN_KEY = 'idol:token';

export class ApiClient {
  private token: string | null;

  constructor(private readonly baseUrl: string | undefined) {
    this.token = window.localStorage.getItem(TOKEN_KEY);
  }

  get available(): boolean {
    return Boolean(this.baseUrl);
  }

  /** Garante uma sessão dev (login do usuário seed; registra se preciso). */
  async ensureSession(): Promise<boolean> {
    if (!this.baseUrl) return false;
    if (this.token && (await this.me()) !== null) return true;
    try {
      const login = await fetch(`${this.baseUrl}/auth/login`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ email: DEV_EMAIL, password: DEV_PASSWORD }),
      });
      if (login.ok) {
        this.setToken((await login.json()).token as string);
        return true;
      }
      const register = await fetch(`${this.baseUrl}/auth/register`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ email: DEV_EMAIL, password: DEV_PASSWORD, displayName: 'Craque' }),
      });
      if (register.ok) {
        this.setToken((await register.json()).token as string);
        return true;
      }
    } catch {
      // API fora do ar — segue offline
    }
    return false;
  }

  private setToken(token: string): void {
    this.token = token;
    window.localStorage.setItem(TOKEN_KEY, token);
  }

  private async get<T>(path: string): Promise<T | null> {
    if (!this.baseUrl || !this.token) return null;
    try {
      const res = await fetch(`${this.baseUrl}${path}`, {
        headers: { authorization: `Bearer ${this.token}` },
      });
      return res.ok ? ((await res.json()) as T) : null;
    } catch {
      return null;
    }
  }

  private async post<T>(path: string, body: unknown): Promise<T | null> {
    if (!this.baseUrl || !this.token) return null;
    try {
      const res = await fetch(`${this.baseUrl}${path}`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', authorization: `Bearer ${this.token}` },
        body: JSON.stringify(body),
      });
      return res.ok ? ((await res.json()) as T) : null;
    } catch {
      return null;
    }
  }

  me(): Promise<MeView | null> {
    return this.get<MeView>('/me');
  }

  sponsors(): Promise<SponsorView[] | null> {
    return this.get<SponsorView[]>('/sponsors');
  }

  signContract(sponsorId: string): Promise<{ contractId: string } | null> {
    return this.post<{ contractId: string }>('/contracts', { sponsorId });
  }

  completeMatch(rating: number, levelId?: string): Promise<unknown | null> {
    return this.post('/gameplay/match', { rating, ...(levelId ? { levelId } : {}) });
  }
}

export const apiClient = new ApiClient(import.meta.env['VITE_API_URL'] as string | undefined);
