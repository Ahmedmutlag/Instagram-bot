import { Telegraf } from "telegraf";
import { BotContext, WizardState, clearWizard } from "../session";
import { cancelInlineKeyboard, mainMenuKeyboard, MENU_LABELS } from "../keyboards";
import { getUserByTelegramId } from "../../services/userService";
import { createDepositPayment } from "../../services/paymentService";
import { getSetting, SETTINGS_KEYS } from "../../services/settingsService";
import { formatMoney } from "../format";
import { AppError } from "../../utils/errors";

export function registerDepositHandlers(bot: Telegraf<BotContext>) {
  bot.hears(MENU_LABELS.DEPOSIT, async (ctx) => {
    const minDeposit = await getSetting(SETTINGS_KEYS.MIN_DEPOSIT);
    const currency = await getSetting(SETTINGS_KEYS.CURRENCY);
    ctx.session.wizard = { type: "deposit", step: "awaiting_amount", data: {} };
    await ctx.reply(
      `💳 أدخل المبلغ الذي تريد إيداعه (الحد الأدنى ${formatMoney(Number(minDeposit), currency)}):`,
      cancelInlineKeyboard()
    );
  });
}

export async function handleDepositWizardText(ctx: BotContext, wizard: WizardState, text: string) {
  if (wizard.step !== "awaiting_amount") return;

  const amount = Number(text.trim());
  if (!Number.isFinite(amount) || amount <= 0) {
    await ctx.reply("مبلغ غير صالح، الرجاء إدخال رقم صحيح أكبر من صفر.", cancelInlineKeyboard());
    return;
  }

  const user = await getUserByTelegramId(BigInt(ctx.from!.id));
  if (!user) return ctx.reply("الرجاء إرسال /start أولاً");

  try {
    const { payment } = await createDepositPayment(user.id, amount);
    clearWizard(ctx);
    await ctx.reply(
      `✅ تم استلام طلب الإيداع بقيمة ${formatMoney(amount)}.\nرقم العملية: ${payment.id}\n\nسيتم تأكيد الدفع تلقائياً خلال لحظات وستصلك رسالة عند إضافة الرصيد.`,
      mainMenuKeyboard()
    );
  } catch (error) {
    const message = error instanceof AppError ? error.message : "تعذر إنشاء عملية الإيداع، حاول لاحقاً";
    await ctx.reply(`❌ ${message}`, cancelInlineKeyboard());
  }
}
