import { Telegraf } from "telegraf";
import { BotContext, WizardState } from "../session";
import { mainMenuKeyboard, MENU_LABELS } from "../keyboards";
import { getSetting, SETTINGS_KEYS } from "../../services/settingsService";
import { getUserByTelegramId } from "../../services/userService";

/** Marker embedded in the message forwarded to the admin so a reply can be routed back. */
const USER_ID_TAG = /معرف تيليجرام: (\d+)/;

export function registerSupportHandlers(bot: Telegraf<BotContext>) {
  bot.hears(MENU_LABELS.SUPPORT, async (ctx) => {
    const adminChatId = await getSetting(SETTINGS_KEYS.ADMIN_NOTIFY_CHAT_ID);
    if (!adminChatId.trim()) {
      const support = await getSetting(SETTINGS_KEYS.SUPPORT_USERNAME);
      await ctx.reply(`📞 للتواصل مع الدعم الفني تواصل معنا عبر: ${support}`);
      return;
    }
    ctx.session.wizard = { type: "support", step: "chatting", data: {} };
    await ctx.reply(
      "📞 أرسل رسالتك الآن (مثلاً استفسار أو رقم مرجع تحويل) وسيتم تحويلها مباشرة لفريق الدعم، وبيوصلك الرد بنفس المحادثة.\n\nاضغط على أي زر من القائمة الرئيسية للخروج من وضع الدعم.",
      mainMenuKeyboard()
    );
  });

  // Admin replies to a forwarded support message (by using Telegram's
  // "Reply" on that exact message) — relay the reply back to the user.
  bot.on("text", async (ctx, next) => {
    const adminChatId = await getSetting(SETTINGS_KEYS.ADMIN_NOTIFY_CHAT_ID);
    const repliedTo = (ctx.message as any).reply_to_message;
    if (!adminChatId.trim() || String(ctx.chat.id) !== adminChatId.trim() || !repliedTo?.text) {
      return next();
    }

    const match = USER_ID_TAG.exec(repliedTo.text as string);
    if (!match) return next();

    const targetTelegramId = match[1];
    try {
      await ctx.telegram.sendMessage(targetTelegramId, `💬 رد الدعم:\n${ctx.message.text}`);
      await ctx.reply("✅ تم إرسال ردك للمستخدم.");
    } catch {
      await ctx.reply("❌ تعذر إرسال الرد — يبدو أن المستخدم حظر البوت أو غير متاح.");
    }
  });
}

export async function handleSupportWizardText(ctx: BotContext, _wizard: WizardState, text: string) {
  const adminChatId = await getSetting(SETTINGS_KEYS.ADMIN_NOTIFY_CHAT_ID);
  if (!adminChatId.trim()) {
    await ctx.reply("عذراً، الدعم غير متاح حالياً، حاول لاحقاً.", mainMenuKeyboard());
    return;
  }

  const user = await getUserByTelegramId(BigInt(ctx.from!.id));
  const who = [ctx.from?.first_name, ctx.from?.last_name].filter(Boolean).join(" ") || "مستخدم";
  const usernamePart = ctx.from?.username ? `@${ctx.from.username}` : "بدون معرف";

  await ctx.telegram.sendMessage(
    adminChatId.trim(),
    `📩 رسالة دعم جديدة\nمن: ${who} (${usernamePart})\nرصيده: ${user ? Number(user.balance) : "—"}\nمعرف تيليجرام: ${ctx.from!.id}\n\n${text}`
  );
  await ctx.reply("✅ تم إرسال رسالتك لفريق الدعم، سيتم الرد عليك قريباً.");
}
