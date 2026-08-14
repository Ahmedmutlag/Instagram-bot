import { randomUUID } from "crypto";
import {
  CreatePaymentParams,
  CreatePaymentResult,
  PaymentGateway,
  PaymentGatewayStatus,
  VerifyPaymentParams,
  VerifyPaymentResult,
} from "./types";

/**
 * Development/testing payment gateway. Simulates an external payment
 * provider without any real money movement. It is intentionally stateless
 * (no in-memory bookkeeping) because the API, bot and worker run as
 * separate processes in production-like deployments — the Payment row in
 * the database is the single source of truth for a payment's status, and
 * this gateway simply reports "SUCCESS" whenever asked, mirroring an
 * instant-settlement test gateway. The PaymentVerification worker still
 * does real work: it polls PENDING payments and reconciles them against
 * this gateway exactly as it would against a real one.
 *
 * Swap in a real gateway later by implementing PaymentGateway and
 * registering it in registry.ts — nothing else in the app depends on this
 * class directly.
 */
export class MockPaymentGateway implements PaymentGateway {
  readonly name = "mock";

  async createPayment(params: CreatePaymentParams): Promise<CreatePaymentResult> {
    const providerRef = `mock_${randomUUID()}`;
    return {
      paymentId: providerRef,
      providerRef,
      redirectUrl: undefined,
    };
  }

  async verifyPayment(params: VerifyPaymentParams): Promise<VerifyPaymentResult> {
    const status = await this.getPaymentStatus(params.providerRef);
    return { success: status === "SUCCESS", status };
  }

  async getPaymentStatus(_providerRef: string): Promise<PaymentGatewayStatus> {
    return "SUCCESS";
  }
}
