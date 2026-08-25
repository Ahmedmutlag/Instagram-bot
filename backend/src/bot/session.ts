import { Context, MiddlewareFn } from "telegraf";
import { redisConnection } from "../lib/redis";

export interface OrderWizardData {
  serviceId?: string;
  link?: string;
  quantity?: number;
  couponCode?: string;
  discountAmount?: number;
  finalPrice?: number;
}

export interface DepositWizardData {
  amount?: number;
}

export interface WizardState {
  type: "order" | "deposit" | "coupon_check" | "support";
  step: string;
  data: OrderWizardData & DepositWizardData;
}

export interface SessionData {
  wizard?: WizardState;
  /** Transient state for browsing the services catalog (categories + pagination). */
  serviceBrowse?: { categories: string[] };
}

export interface BotContext extends Context {
  session: SessionData;
}

const SESSION_TTL_SECONDS = 60 * 60 * 6;

function sessionKey(chatId: number | string): string {
  return `bot:session:${chatId}`;
}

export function sessionMiddleware(): MiddlewareFn<BotContext> {
  return async (ctx, next) => {
    const chatId = ctx.chat?.id ?? ctx.from?.id;
    if (!chatId) {
      ctx.session = {};
      return next();
    }
    const raw = await redisConnection.get(sessionKey(chatId));
    ctx.session = raw ? JSON.parse(raw) : {};

    await next();

    if (Object.keys(ctx.session).length === 0) {
      await redisConnection.del(sessionKey(chatId));
    } else {
      await redisConnection.set(sessionKey(chatId), JSON.stringify(ctx.session), "EX", SESSION_TTL_SECONDS);
    }
  };
}

export function clearWizard(ctx: BotContext) {
  delete ctx.session.wizard;
}
