// Unified provider adapter contract.
//
// Every external SMM API provider must be represented behind this interface.
// New providers are added purely through admin-panel configuration (name,
// API URL, API key, adapter type) — never by touching core order/service
// logic. To support a provider whose API shape differs from the built-in
// generic adapter, implement this interface in a new file under
// src/providers/adapters/ and register it in src/providers/registry.ts.

export type NormalizedOrderStatus =
  | "PENDING"
  | "PROCESSING"
  | "COMPLETED"
  | "PARTIAL"
  | "CANCELED"
  | "FAILED";

export interface RemoteService {
  externalServiceId: string;
  name: string;
  category?: string;
  /** Provider's cost, per 1000 units, in the provider's billing currency. */
  rate: number;
  min: number;
  max: number;
}

export interface CreateOrderParams {
  externalServiceId: string;
  link: string;
  quantity: number;
}

export interface CreateOrderResult {
  providerOrderId: string;
}

export interface OrderStatusResult {
  status: NormalizedOrderStatus;
  startCount?: number;
  remains?: number;
}

export interface ProviderBalanceResult {
  balance: number;
  currency: string;
}

export interface ProviderCredentials {
  apiUrl: string;
  apiKey: string;
}

/**
 * The unified interface every provider integration must implement.
 * Core services (order creation, status sync, balance display) depend only
 * on this interface, never on a specific provider's wire format.
 */
export interface ProviderAdapter {
  getServices(): Promise<RemoteService[]>;
  createOrder(params: CreateOrderParams): Promise<CreateOrderResult>;
  getOrderStatus(providerOrderId: string): Promise<OrderStatusResult>;
  getBalance(): Promise<ProviderBalanceResult>;
}

export type ProviderAdapterFactory = (credentials: ProviderCredentials) => ProviderAdapter;
