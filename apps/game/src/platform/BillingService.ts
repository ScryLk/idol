/**
 * Costura de IAP (FORA DE ESCOPO no MVP — mapeada sem integrar).
 * Quando entrar, a implementação nativa usa um plugin de billing do
 * Capacitor; a web mantém o stub. NENHUMA regra de economia depende disto.
 */

export interface Product {
  id: string;
  title: string;
  priceLabel: string;
}

export interface BillingService {
  readonly available: boolean;
  listProducts(): Promise<Product[]>;
  purchase(productId: string): Promise<{ ok: boolean; reason?: 'cancelled' | 'unavailable' }>;
}

class StubBilling implements BillingService {
  readonly available = false;

  listProducts(): Promise<Product[]> {
    return Promise.resolve([]);
  }

  purchase(): Promise<{ ok: boolean; reason?: 'cancelled' | 'unavailable' }> {
    return Promise.resolve({ ok: false, reason: 'unavailable' });
  }
}

export const billing: BillingService = new StubBilling();
