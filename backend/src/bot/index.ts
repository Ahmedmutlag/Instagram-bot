import { Telegraf } from "telegraf";
import { env } from "../config/env";
import { logger } from "../lib/logger";
import { BotContext, sessionMiddleware } from "./session";
import { mainMenuKeyboard } from "./keyboards";
import { registerMenuHandlers } from "./handlers/menu";
import { registerOrderHandlers, handleOrderWizardText } from "./handlers/orderFlow";
import { registerDepositHandlers, handleDepositWizardText } from "./handlers/depositFlow";
import { registerCouponHandlers, handleCouponWizardText } from "./handlers/couponFlow";
import { requireActiveUser } from "../services/userService";
import { AppError } from "../utils/errors";

export function createBot() {
  const bot = new Telegraf<BotContext>(env.TELEGRAM_BOT_TOKEN);

  bot.use(sessionMiddleware());

  bot.use(async (ctx, next) => {
    if (!ctx.from || ctx.from.is_bot) return;
    // /start is allowed even for brand-new (not yet created) users.
    if ("text" in (ctx.message ?? {}) && (ctx.message as any).text?.startsWith("/start")) {
      return next();
    }
    try {
      await requireActiveUser(BigInt(ctx.from.id));
    } catch (error) {
      if (error instanceof AppError && error.code === "FORBIDDEN") {
        await ctx.reply("🚫 تم حظر حسابك من استخدام هذا البوت.");
        return;
      }
      // Unknown user yet (hasn't pressed /start) — nudge them.
      await ctx.reply("الرجاء إرسال /start للبدء.");
      return;
    }
    return next();
  });

  registerMenuHandlers(bot);
  registerOrderHandlers(bot);
  registerDepositHandlers(bot);
  registerCouponHandlers(bot);

  bot.on("text", async (ctx) => {
    const wizard = ctx.session.wizard;
    if (!wizard) {
      await ctx.reply("اختر أحد الخيارات من القائمة:", mainMenuKeyboard());
      return;
    }
    const text = ctx.message.text;
    if (wizard.type === "order") return handleOrderWizardText(ctx, wizard, text);
    if (wizard.type === "deposit") return handleDepositWizardText(ctx, wizard, text);
    if (wizard.type === "coupon_check") return handleCouponWizardText(ctx, wizard, text);
  });

  bot.catch((err, ctx) => {
    logger.error({ err, update: ctx.update }, "Unhandled bot error");
    ctx.reply("حدث خطأ غير متوقع، الرجاء المحاولة مرة أخرى.").catch(() => undefined);
  });

  return bot;
}

if (require.main === module) {
  const bot = createBot();
  bot
    .launch()
    .then(() => logger.info("Telegram bot started (long polling)"));

  process.once("SIGINT", () => bot.stop("SIGINT"));
  process.once("SIGTERM", () => bot.stop("SIGTERM"));
}
