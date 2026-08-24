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
 * "Gateway" for manual bank/wallet transfers: the user is shown transfer
 * instructions (admin-configured account details) by the bot and sends the
 * money outside the platform; an admin then confirms or rejects the
 * deposit from the dashboard once they see it land. There is nothing to
 * poll automatically, so verifyPayment/getPaymentStatus always report
 * PENDING — settlement only happens via the explicit admin
 * confirm/reject actions in paymentService.
 */
export class ManualPaymentGateway implements PaymentGateway {
  readonly name = "manual";

  async createPayment(_params: CreatePaymentParams): Promise<CreatePaymentResult> {
    const providerRef = `manual_${randomUUID()}`;
    return { paymentId: providerRef, providerRef, redirectUrl: undefined };
  }

  async verifyPayment(_params: VerifyPaymentParams): Promise<VerifyPaymentResult> {
    return { success: false, status: "PENDING" };
  }

  async getPaymentStatus(_providerRef: string): Promise<PaymentGatewayStatus> {
    return "PENDING";
  }
}
