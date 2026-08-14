import { Markup } from "telegraf";

export const MENU_LABELS = {
  SERVICES: "🛒 الخدمات",
  BALANCE: "💰 رصيدي",
  ORDERS: "📦 طلباتي",
  DEPOSIT: "💳 إضافة رصيد",
  REFERRAL: "🎁 الإحالة",
  COUPONS: "🎟️ الكوبونات",
  SUPPORT: "📞 الدعم",
} as const;

export function mainMenuKeyboard() {
  return Markup.keyboard([
    [MENU_LABELS.SERVICES, MENU_LABELS.BALANCE],
    [MENU_LABELS.ORDERS, MENU_LABELS.DEPOSIT],
    [MENU_LABELS.REFERRAL, MENU_LABELS.COUPONS],
    [MENU_LABELS.SUPPORT],
  ])
    .resize()
    .persistent();
}

export function cancelInlineKeyboard() {
  return Markup.inlineKeyboard([Markup.button.callback("❌ إلغاء", "wizard:cancel")]);
}

export function yesNoKeyboard(yesAction: string, noAction: string) {
  return Markup.inlineKeyboard([
    Markup.button.callback("✅ نعم", yesAction),
    Markup.button.callback("➖ لا", noAction),
  ]);
}

export function confirmOrderKeyboard() {
  return Markup.inlineKeyboard([
    [Markup.button.callback("✅ تأكيد الطلب", "order:confirm")],
    [Markup.button.callback("❌ إلغاء", "order:cancel")],
  ]);
}
