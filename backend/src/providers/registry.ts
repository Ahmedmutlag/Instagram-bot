import { ProviderAdapter, ProviderAdapterFactory, ProviderCredentials } from "./types";
import { GenericSmmApiAdapter } from "./adapters/genericSmmApiAdapter";
import { AppError } from "../utils/errors";

/**
 * Registry of available provider adapter implementations, keyed by the
 * `adapterType` string stored on the Provider record. Adding support for a
 * provider with a different API shape means writing a new adapter class and
 * adding one line here — the rest of the system (orders, services, admin
 * API) is completely decoupled from any specific provider's wire format.
 */
const adapterFactories: Record<string, ProviderAdapterFactory> = {
  generic_smm_api: (credentials: ProviderCredentials) => new GenericSmmApiAdapter(credentials),
};

export function getAvailableAdapterTypes(): string[] {
  return Object.keys(adapterFactories);
}

export function createProviderAdapter(
  adapterType: string,
  credentials: ProviderCredentials
): ProviderAdapter {
  const factory = adapterFactories[adapterType];
  if (!factory) {
    throw AppError.badRequest(`نوع المزود غير مدعوم: ${adapterType}`);
  }
  return factory(credentials);
}
