import { PaymentGateway } from "./types";
import { MockPaymentGateway } from "./mockPaymentGateway";

/**
 * Registry of available payment gateways, keyed by method name (stored on
 * Payment.method). Add a real gateway by implementing PaymentGateway and
 * registering it here; the rest of the app only depends on the interface.
 */
const gateways: Record<string, PaymentGateway> = {
  mock: new MockPaymentGateway(),
};

export const DEFAULT_PAYMENT_METHOD = "mock";

export function getPaymentGateway(method: string = DEFAULT_PAYMENT_METHOD): PaymentGateway {
  const gateway = gateways[method];
  if (!gateway) {
    throw new Error(`Unknown payment method: ${method}`);
  }
  return gateway;
}
