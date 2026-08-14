import { Telegraf } from "telegraf";
import { BotContext, WizardState, clearWizard } from "../session";
import { cancelInlineKeyboard, mainMenuKeyboard, MENU_LABELS } from "../keyboards";
import { prisma } from "../../lib/prisma";
import { formatMoney } from "../format";

export function registerCouponHandlers(bot: Telegraf<BotContext>) {
  bot.hears(MENU_LABELS.COUPONS, async (ctx) => {
    ctx.session.wizard = { type: "coupon_check", step: "awaiting_code", data: {} };
    await ctx.reply(
      "🎟️ أرسل كود الخصم للتحقق من صلاحيته. سيتم تطبيق الكود فعلياً عند تأكيد أي طلب جديد.",
      cancelInlineKeyboard()
    );
  });
}

export async function handleCouponWizardText(ctx: BotContext, wizard: WizardState, text: string) {
  if (wizard.step !== "awaiting_code") return;

  const coupon = await prisma.coupon.findUnique({ where: { code: text.trim().toUpperCase() } });
  clearWizard(ctx);

  if (!coupon || !coupon.isActive || (coupon.expiresAt && coupon.expiresAt < new Date())) {
    await ctx.reply("❌ كود الخصم غير صالح أو منتهي الصلاحية.", mainMenuKeyboard());
    return;
  }
  if (coupon.maxUses !== null && coupon.usedCount >= coupon.maxUses) {
    await ctx.reply("❌ تم الوصول للحد الأقصى لاستخدام هذا الكوبون.", mainMenuKeyboard());
    return;
  }

  const valueText =
    coupon.type === "PERCENTAGE" ? `${Number(coupon.value)}%` : formatMoney(Number(coupon.value));
  await ctx.reply(
    `✅ الكوبون "${coupon.code}" صالح!\nنوع الخصم: ${coupon.type === "PERCENTAGE" ? "نسبة مئوية" : "مبلغ ثابت"}\nالقيمة: ${valueText}\n\nيمكنك إدخاله عند تأكيد أي طلب جديد.`,
    mainMenuKeyboard()
  );
}
