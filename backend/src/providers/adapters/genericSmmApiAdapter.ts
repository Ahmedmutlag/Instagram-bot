import axios, { AxiosInstance } from "axios";
import {
  CreateOrderParams,
  CreateOrderResult,
  NormalizedOrderStatus,
  OrderStatusResult,
  ProviderAdapter,
  ProviderBalanceResult,
  ProviderCredentials,
  RemoteService,
} from "../types";
import { AppError } from "../../utils/errors";

/**
 * Adapter for the widely-used "action based" SMM reseller panel API format,
 * implemented by many independent SMM API providers. Requests are sent as
 * POST x-www-form-urlencoded with a `key` (API key) and `action` field:
 *
 *   action=services -> list of { service, name, category, rate, min, max }
 *   action=add       -> params: service, link, quantity  -> { order }
 *   action=status     -> params: order                    -> { status, start_count, remains, charge }
 *   action=balance    -> { balance, currency }
 *
 * This is a generic, provider-agnostic implementation: any provider whose
 * API follows this common shape can be onboarded from the admin panel by
 * simply entering its URL + API key, with adapterType="generic_smm_api".
 * Providers with a different wire format can be supported later by adding
 * a new adapter file and registering it — no changes to order/service logic.
 */
export class GenericSmmApiAdapter implements ProviderAdapter {
  private readonly http: AxiosInstance;
  private readonly apiKey: string;

  constructor(credentials: ProviderCredentials) {
    this.apiKey = credentials.apiKey;
    this.http = axios.create({
      baseURL: credentials.apiUrl,
      timeout: 15_000,
    });
  }

  private async post<T>(params: Record<string, string | number>): Promise<T> {
    try {
      const body = new URLSearchParams({ key: this.apiKey, ...toStringMap(params) });
      const { data } = await this.http.post<T>("", body.toString(), {
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
      });
      if (data && typeof data === "object" && "error" in (data as Record<string, unknown>)) {
        throw AppError.providerError(String((data as Record<string, unknown>).error));
      }
      return data;
    } catch (error) {
      if (error instanceof AppError) throw error;
      const message = axios.isAxiosError(error) ? error.message : "خطأ غير متوقع من مزود الخدمة";
      throw AppError.providerError(`فشل الاتصال بمزود الخدمة: ${message}`);
    }
  }

  async getServices(): Promise<RemoteService[]> {
    const data = await this.post<RawService[]>({ action: "services" });
    if (!Array.isArray(data)) {
      throw AppError.providerError("استجابة غير متوقعة من مزود الخدمة عند جلب الخدمات");
    }
    return data.map((s) => ({
      externalServiceId: String(s.service),
      name: s.name,
      category: s.category,
      rate: Number(s.rate),
      min: Number(s.min),
      max: Number(s.max),
    }));
  }

  async createOrder(params: CreateOrderParams): Promise<CreateOrderResult> {
    const data = await this.post<{ order?: string | number; orderId?: string | number }>({
      action: "add",
      service: params.externalServiceId,
      link: params.link,
      quantity: params.quantity,
    });
    const providerOrderId = data.order ?? data.orderId;
    if (providerOrderId === undefined) {
      throw AppError.providerError("لم يتم استلام رقم الطلب من مزود الخدمة");
    }
    return { providerOrderId: String(providerOrderId) };
  }

  async getOrderStatus(providerOrderId: string): Promise<OrderStatusResult> {
    const data = await this.post<RawStatus>({ action: "status", order: providerOrderId });
    return {
      status: normalizeStatus(data.status),
      startCount: data.start_count !== undefined ? Number(data.start_count) : undefined,
      remains: data.remains !== undefined ? Number(data.remains) : undefined,
    };
  }

  async getBalance(): Promise<ProviderBalanceResult> {
    const data = await this.post<{ balance: string | number; currency?: string }>({ action: "balance" });
    return { balance: Number(data.balance), currency: data.currency ?? "USD" };
  }
}

interface RawService {
  service: string | number;
  name: string;
  category?: string;
  rate: string | number;
  min: string | number;
  max: string | number;
}

interface RawStatus {
  status: string;
  start_count?: string | number;
  remains?: string | number;
  charge?: string | number;
}

function normalizeStatus(raw: string): NormalizedOrderStatus {
  const value = (raw || "").trim().toLowerCase();
  if (["pending", "awaiting"].includes(value)) return "PENDING";
  if (["in progress", "processing", "inprogress"].includes(value)) return "PROCESSING";
  if (["completed", "complete", "done"].includes(value)) return "COMPLETED";
  if (["partial"].includes(value)) return "PARTIAL";
  if (["canceled", "cancelled"].includes(value)) return "CANCELED";
  return "FAILED";
}

function toStringMap(params: Record<string, string | number>): Record<string, string> {
  const result: Record<string, string> = {};
  for (const [k, v] of Object.entries(params)) result[k] = String(v);
  return result;
}
