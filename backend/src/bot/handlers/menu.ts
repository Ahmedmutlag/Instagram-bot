import { Telegraf } from "telegraf";
import { BotContext, clearWizard } from "../session";
import { mainMenuKeyboard, MENU_LABELS } from "../keyboards";
import { findOrCreateUser, getUserByTelegramId } from "../../services/userService";
import { getUserTransactions } from "../../services/balanceService";
import { listOrdersForUser } from "../../services/orderService";
import { getReferralStats } from "../../services/referralService";
import { getSetting, SETTINGS_KEYS } from "../../services/settingsService";
import { formatMoney, formatOrderStatus } from "../format";

export function registerMenuHandlers(bot: Telegraf<BotContext>) {
  bot.command("myid", async (ctx) => {
    await ctx.reply(
      `🆔 معرّفك الرقمي بتيليجرام: \`${ctx.from.id}\`\n\nإذا كنت المشرف، انسخ هذا الرقم وضعه بحقل "معرف إشعارات الأدمن" بصفحة الإعدادات بلوحة الإدارة عشان تستلم إشعار فوري عند أي طلب إيداع جديد.`,
      { parse_mode: "Markdown" }
    );
  });

  bot.start(async (ctx) => {
    clearWizard(ctx);
    const referralCode = ctx.startPayload?.trim();
    const user = await findOrCreateUser(
      {
        telegramId: BigInt(ctx.from.id),
        username: ctx.from.username,
        firstName: ctx.from.first_name,
        lastName: ctx.from.last_name,
        languageCode: ctx.from.language_code,
      },
      referralCode
    );

    if (user.isBanned) {
      await ctx.reply("عذراً، تم حظر حسابك من استخدام هذا البوت.");
      return;
    }

    const botName = await getSetting(SETTINGS_KEYS.BOT_NAME);
    await ctx.reply(
      `أهلاً بك في ${botName} 👋\n\nمنصتك لطلب خدمات السوشيال ميديا بسهولة وأمان.\nاختر من القائمة أدناه للبدء:`,
      mainMenuKeyboard()
    );
  });

  bot.hears(MENU_LABELS.BALANCE, async (ctx) => {
    const user = await getUserByTelegramId(BigInt(ctx.from.id));
    if (!user) return ctx.reply("الرجاء إرسال /start أولاً");
    const currency = await getSetting(SETTINGS_KEYS.CURRENCY);
    const { items } = await getUserTransactions(user.id, 1, 5);

    const historyLines = items.length
      ? items
          .map((t) => `${t.type === "ORDER_PAYMENT" || Number(t.amount) < 0 ? "🔻" : "🔺"} ${formatMoney(Math.abs(Number(t.amount)), currency)} — ${t.description ?? ""}`)
          .join("\n")
      : "لا توجد حركات مالية بعد.";

    await ctx.reply(
      `💰 رصيدك الحالي: ${formatMoney(Number(user.balance), currency)}\n\nآخر الحركات:\n${historyLines}`
    );
  });

  bot.hears(MENU_LABELS.ORDERS, async (ctx) => {
    const user = await getUserByTelegramId(BigInt(ctx.from.id));
    if (!user) return ctx.reply("الرجاء إرسال /start أولاً");
    const { items, total } = await listOrdersForUser(user.id, 1, 10);
    if (items.length === 0) {
      await ctx.reply("📦 لا توجد لديك طلبات بعد. اختر (🛒 الخدمات) لإنشاء طلبك الأول.");
      return;
    }
    const lines = items.map(
      (o) =>
        `#${o.orderNumber} — ${o.service.name}\nالكمية: ${o.quantity} | السعر: ${formatMoney(Number(o.price))}\nالحالة: ${formatOrderStatus(o.status)}\n`
    );
    await ctx.reply(`📦 آخر طلباتك (${total} إجمالاً):\n\n${lines.join("\n")}`);
  });

  bot.hears(MENU_LABELS.REFERRAL, async (ctx) => {
    const user = await getUserByTelegramId(BigInt(ctx.from.id));
    if (!user) return ctx.reply("الرجاء إرسال /start أولاً");
    const botInfo = await ctx.telegram.getMe();
    const link = `https://t.me/${botInfo.username}?start=${user.referralCode}`;
    const stats = await getReferralStats(user.id);
    const referralPercent = await getSetting(SETTINGS_KEYS.REFERRAL_PERCENT);
    const currency = await getSetting(SETTINGS_KEYS.CURRENCY);

    await ctx.reply(
      `🎁 برنامج الإحالة\n\nشارك رابطك واربح ${referralPercent}% من قيمة كل طلب يقوم به من تدعوهم:\n${link}\n\nعدد المُحالين: ${stats.referralsCount}\nإجمالي أرباحك من الإحالة: ${formatMoney(stats.totalEarnings, currency)}`
    );
  });

  // "الدعم" is now handled by supportFlow.ts (relays messages to the admin
  // via the bot itself instead of pointing users at a separate account).
}
