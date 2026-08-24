import { Telegraf } from "telegraf";
import { BotContext, WizardState, clearWizard } from "../session";
import { cancelInlineKeyboard, confirmOrderKeyboard, mainMenuKeyboard, yesNoKeyboard, MENU_LABELS } from "../keyboards";
import { listActiveServicesForBot } from "../../services/serviceCatalogService";
import { prisma } from "../../lib/prisma";
import { isValidTargetLink } from "../../utils/validateLink";
import { validateCoupon } from "../../services/couponService";
import { createOrder } from "../../services/orderService";
import { getUserByTelegramId } from "../../services/userService";
import { getSetting, SETTINGS_KEYS } from "../../services/settingsService";
import { formatMoney, formatOrderStatus } from "../format";
import { AppError } from "../../utils/errors";
import { Markup } from "telegraf";

const SERVICES_PAGE_SIZE = 8;
const UNCATEGORIZED_LABEL = "أخرى";

async function getServicesGroupedByCategory() {
  const services = await listActiveServicesForBot();
  const groups = new Map<string, typeof services>();
  for (const service of services) {
    const key = service.category?.trim() || UNCATEGORIZED_LABEL;
    const list = groups.get(key);
    if (list) list.push(service);
    else groups.set(key, [service]);
  }
  return groups;
}

async function buildServicePage(ctx: BotContext, catIndex: number, page: number) {
  const groups = await getServicesGroupedByCategory();
  const categories = ctx.session.serviceBrowse?.categories ?? Array.from(groups.keys());
  const category = categories[catIndex];
  const items = category ? groups.get(category) ?? [] : [];

  if (!category || items.length === 0) {
    return { text: "هذه الفئة لم تعد متوفرة.", markup: undefined };
  }

  const currency = await getSetting(SETTINGS_KEYS.CURRENCY);
  const totalPages = Math.max(1, Math.ceil(items.length / SERVICES_PAGE_SIZE));
  const safePage = Math.min(Math.max(page, 0), totalPages - 1);
  const slice = items.slice(safePage * SERVICES_PAGE_SIZE, safePage * SERVICES_PAGE_SIZE + SERVICES_PAGE_SIZE);

  const rows = slice.map((s) => [
    Markup.button.callback(`${s.name} — ${formatMoney(s.price, currency)} / 1000`, `svc:${s.id}`),
  ]);

  const navRow = [];
  if (safePage > 0) navRow.push(Markup.button.callback("◀️ السابق", `svcpg:${catIndex}:${safePage - 1}`));
  if (safePage < totalPages - 1) navRow.push(Markup.button.callback("التالي ▶️", `svcpg:${catIndex}:${safePage + 1}`));
  if (navRow.length > 0) rows.push(navRow);

  if (categories.length > 1) {
    rows.push([Markup.button.callback("🔙 رجوع للفئات", "svc:categories")]);
  }

  return {
    text: `📂 ${category} — صفحة ${safePage + 1}/${totalPages}\nاختر الخدمة المطلوبة:`,
    markup: Markup.inlineKeyboard(rows),
  };
}

export function registerOrderHandlers(bot: Telegraf<BotContext>) {
  bot.hears(MENU_LABELS.SERVICES, async (ctx) => {
    clearWizard(ctx);
    const groups = await getServicesGroupedByCategory();
    if (groups.size === 0) {
      await ctx.reply("لا توجد خدمات متاحة حالياً، الرجاء المحاولة لاحقاً.");
      return;
    }

    const categories = Array.from(groups.keys());
    ctx.session.serviceBrowse = { categories };

    if (categories.length === 1) {
      const { text, markup } = await buildServicePage(ctx, 0, 0);
      await ctx.reply(text, markup);
      return;
    }

    const rows = categories.map((cat, i) => [
      Markup.button.callback(`${cat} (${groups.get(cat)!.length})`, `catidx:${i}`),
    ]);
    await ctx.reply("🛒 اختر فئة الخدمة:", Markup.inlineKeyboard(rows));
  });

  bot.action(/^catidx:(\d+)$/, async (ctx) => {
    await ctx.answerCbQuery();
    const catIndex = Number(ctx.match[1]);
    const { text, markup } = await buildServicePage(ctx, catIndex, 0);
    await ctx.editMessageText(text, markup);
  });

  bot.action(/^svcpg:(\d+):(\d+)$/, async (ctx) => {
    await ctx.answerCbQuery();
    const catIndex = Number(ctx.match[1]);
    const page = Number(ctx.match[2]);
    const { text, markup } = await buildServicePage(ctx, catIndex, page);
    await ctx.editMessageText(text, markup);
  });

  bot.action("svc:categories", async (ctx) => {
    await ctx.answerCbQuery();
    const groups = await getServicesGroupedByCategory();
    const categories = Array.from(groups.keys());
    ctx.session.serviceBrowse = { categories };
    const rows = categories.map((cat, i) => [
      Markup.button.callback(`${cat} (${groups.get(cat)!.length})`, `catidx:${i}`),
    ]);
    await ctx.editMessageText("🛒 اختر فئة الخدمة:", Markup.inlineKeyboard(rows));
  });

  bot.action(/^svc:(.+)$/, async (ctx) => {
    const serviceId = ctx.match[1];
    const service = await prisma.service.findUnique({ where: { id: serviceId }, include: { provider: true } });
    if (!service || service.status !== "ACTIVE" || service.provider.status !== "ACTIVE") {
      await ctx.answerCbQuery("هذه الخدمة غير متوفرة حالياً", { show_alert: true });
      return;
    }
    ctx.session.wizard = { type: "order", step: "awaiting_link", data: { serviceId } };
    await ctx.answerCbQuery();
    await ctx.reply(
      `أرسل الآن رابط الحساب / المنشور المطلوب للخدمة "${service.name}".\n\nملاحظة: الرابط يُستخدم كنص فقط ولا نطلب أي كلمات مرور.`,
      cancelInlineKeyboard()
    );
  });

  bot.action("wizard:cancel", async (ctx) => {
    clearWizard(ctx);
    await ctx.answerCbQuery("تم الإلغاء");
    await ctx.reply("تم إلغاء العملية.", mainMenuKeyboard());
  });

  bot.action(/^coupon:(yes|no)$/, async (ctx) => {
    const wizard = ctx.session.wizard;
    if (!wizard || wizard.type !== "order") return ctx.answerCbQuery();
    await ctx.answerCbQuery();
    if (ctx.match[1] === "yes") {
      wizard.step = "awaiting_coupon_code";
      await ctx.reply("أرسل كود الخصم:", cancelInlineKeyboard());
    } else {
      await presentOrderConfirmation(ctx, wizard);
    }
  });

  bot.action("order:cancel", async (ctx) => {
    clearWizard(ctx);
    await ctx.answerCbQuery("تم إلغاء الطلب");
    await ctx.reply("تم إلغاء الطلب.", mainMenuKeyboard());
  });

  bot.action("order:confirm", async (ctx) => {
    const wizard = ctx.session.wizard;
    if (!wizard || wizard.type !== "order" || wizard.step !== "confirm") {
      await ctx.answerCbQuery();
      return;
    }
    await ctx.answerCbQuery();

    const user = await getUserByTelegramId(BigInt(ctx.from!.id));
    if (!user) return ctx.reply("الرجاء إرسال /start أولاً");

    try {
      const order = await createOrder({
        userId: user.id,
        serviceId: wizard.data.serviceId!,
        link: wizard.data.link!,
        quantity: wizard.data.quantity!,
        couponCode: wizard.data.couponCode,
      });
      clearWizard(ctx);
      await ctx.reply(
        `✅ تم إنشاء طلبك بنجاح!\n\nرقم الطلب: #${order.orderNumber}\nالكمية: ${order.quantity}\nالسعر: ${formatMoney(Number(order.price))}\nالحالة: ${formatOrderStatus(order.status)}\n\nسنقوم بإعلامك تلقائياً عند تغيّر حالة الطلب.`,
        mainMenuKeyboard()
      );
    } catch (error) {
      if (error instanceof AppError && error.code === "INSUFFICIENT_BALANCE") {
        await ctx.reply(
          `❌ رصيدك غير كافٍ لإتمام هذا الطلب.\nرصيدك الحالي: ${formatMoney(Number(user.balance))}\n\nيمكنك إضافة رصيد من القائمة الرئيسية (${MENU_LABELS.DEPOSIT}).`,
          mainMenuKeyboard()
        );
        clearWizard(ctx);
        return;
      }
      const message = error instanceof AppError ? error.message : "حدث خطأ غير متوقع، حاول مرة أخرى";
      await ctx.reply(`❌ ${message}`, mainMenuKeyboard());
      clearWizard(ctx);
    }
  });
}

export async function handleOrderWizardText(ctx: BotContext, wizard: WizardState, text: string) {
  const service = await prisma.service.findUnique({
    where: { id: wizard.data.serviceId },
    include: { providerService: true },
  });
  if (!service) {
    clearWizard(ctx);
    await ctx.reply("عذراً، هذه الخدمة لم تعد متوفرة.", mainMenuKeyboard());
    return;
  }

  if (wizard.step === "awaiting_link") {
    if (!isValidTargetLink(text)) {
      await ctx.reply("الرابط غير صالح. الرجاء إرسال رابط صحيح يبدأ بـ http:// أو https://", cancelInlineKeyboard());
      return;
    }
    wizard.data.link = text.trim();
    wizard.step = "awaiting_quantity";
    await ctx.reply(
      `أدخل الكمية المطلوبة (بين ${service.minQuantity} و ${service.maxQuantity}):`,
      cancelInlineKeyboard()
    );
    return;
  }

  if (wizard.step === "awaiting_quantity") {
    const quantity = Number(text.trim());
    if (!Number.isInteger(quantity) || quantity < service.minQuantity || quantity > service.maxQuantity) {
      await ctx.reply(
        `كمية غير صالحة. الرجاء إدخال رقم بين ${service.minQuantity} و ${service.maxQuantity}`,
        cancelInlineKeyboard()
      );
      return;
    }
    wizard.data.quantity = quantity;
    wizard.step = "awaiting_coupon_choice";
    await ctx.reply("هل تملك كود خصم تريد استخدامه؟", yesNoKeyboard("coupon:yes", "coupon:no"));
    return;
  }

  if (wizard.step === "awaiting_coupon_code") {
    const grossPrice = (Number(service.price) / 1000) * (wizard.data.quantity ?? 0);
    try {
      const { discountAmount } = await validateCoupon(text.trim(), grossPrice);
      wizard.data.couponCode = text.trim().toUpperCase();
      wizard.data.discountAmount = discountAmount;
      await presentOrderConfirmation(ctx, wizard);
    } catch (error) {
      const message = error instanceof AppError ? error.message : "كود الخصم غير صالح";
      await ctx.reply(`❌ ${message}\nأرسل كود آخر أو اضغط إلغاء:`, cancelInlineKeyboard());
    }
    return;
  }
}

async function presentOrderConfirmation(ctx: BotContext, wizard: WizardState) {
  const service = await prisma.service.findUnique({ where: { id: wizard.data.serviceId } });
  if (!service) return;
  const currency = await getSetting(SETTINGS_KEYS.CURRENCY);
  const grossPrice = (Number(service.price) / 1000) * (wizard.data.quantity ?? 0);
  const discount = wizard.data.discountAmount ?? 0;
  const finalPrice = Number((grossPrice - discount).toFixed(4));
  wizard.data.finalPrice = finalPrice;
  wizard.step = "confirm";

  const lines = [
    `📋 تأكيد الطلب`,
    ``,
    `الخدمة: ${service.name}`,
    `الرابط: ${wizard.data.link}`,
    `الكمية: ${wizard.data.quantity}`,
    `السعر: ${formatMoney(grossPrice, currency)}`,
  ];
  if (discount > 0) {
    lines.push(`الخصم: -${formatMoney(discount, currency)} (${wizard.data.couponCode})`);
  }
  lines.push(`الإجمالي: ${formatMoney(finalPrice, currency)}`);

  await ctx.reply(lines.join("\n"), confirmOrderKeyboard());
}
