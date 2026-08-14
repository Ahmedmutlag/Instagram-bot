// Unified payment gateway contract. New payment methods (real gateways) can
// be added by implementing this interface and registering it in registry.ts
// — no core code changes required. During development only the mock
// provider is registered.

export interface CreatePaymentParams {
  userId: string;
  amount: number;
  currency: string;
  metadata?: Record<string, unknown>;
}

export interface CreatePaymentResult {
  paymentId: string;
  /** URL or instructions the user should be sent to complete payment. */
  redirectUrl?: string;
  providerRef: string;
}

export interface VerifyPaymentParams {
  providerRef: string;
  payload?: Record<string, unknown>;
}

export interface VerifyPaymentResult {
  success: boolean;
  status: PaymentGatewayStatus;
}

export type PaymentGatewayStatus = "PENDING" | "SUCCESS" | "FAILED" | "CANCELED";

export interface PaymentGateway {
  readonly name: string;
  createPayment(params: CreatePaymentParams): Promise<CreatePaymentResult>;
  verifyPayment(params: VerifyPaymentParams): Promise<VerifyPaymentResult>;
  getPaymentStatus(providerRef: string): Promise<PaymentGatewayStatus>;
}
