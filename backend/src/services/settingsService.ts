import { prisma } from "../lib/prisma";

export const SETTINGS_KEYS = {
  BOT_NAME: "botName",
  CURRENCY: "currency",
  LANGUAGE: "language",
  SUPPORT_USERNAME: "supportUsername",
  MIN_DEPOSIT: "minDeposit",
  REFERRAL_PERCENT: "referralPercent",
  BOT_TOKEN: "botToken",
  DEPOSIT_INSTRUCTIONS: "depositInstructions",
  ADMIN_NOTIFY_CHAT_ID: "adminNotifyChatId",
} as const;

export type SettingsKey = (typeof SETTINGS_KEYS)[keyof typeof SETTINGS_KEYS];

const DEFAULTS: Record<SettingsKey, string> = {
  [SETTINGS_KEYS.BOT_NAME]: "SMM Reseller Bot",
  [SETTINGS_KEYS.CURRENCY]: "USD",
  [SETTINGS_KEYS.LANGUAGE]: "ar",
  [SETTINGS_KEYS.SUPPORT_USERNAME]: "@support",
  [SETTINGS_KEYS.MIN_DEPOSIT]: "5",
  [SETTINGS_KEYS.REFERRAL_PERCENT]: "5",
  // Informational only — the running bot process always uses the
  // TELEGRAM_BOT_TOKEN environment variable, since rotating it requires a
  // process restart. This setting exists so admins can view/record it.
  [SETTINGS_KEYS.BOT_TOKEN]: "",
  // Shown to users in the bot when they request a deposit — bank account /
  // mobile wallet details, etc. Admin fills this in from the settings page.
  [SETTINGS_KEYS.DEPOSIT_INSTRUCTIONS]: "يرجى التواصل مع الدعم لمعرفة طريقة الإيداع.",
  // Telegram numeric chat ID to notify whenever a new manual deposit is
  // submitted, so the admin doesn't have to keep checking the dashboard.
  // Empty means notifications are off. Admin can get their own ID by
  // sending /myid to the bot.
  [SETTINGS_KEYS.ADMIN_NOTIFY_CHAT_ID]: "",
};

let cache: Record<string, string> | null = null;
let cacheExpiresAt = 0;
const CACHE_TTL_MS = 15_000;

async function loadAll(): Promise<Record<string, string>> {
  const rows = await prisma.setting.findMany();
  const map: Record<string, string> = { ...DEFAULTS };
  for (const row of rows) map[row.key] = row.value;
  return map;
}

export async function getAllSettings(): Promise<Record<string, string>> {
  const now = Date.now();
  if (!cache || now > cacheExpiresAt) {
    cache = await loadAll();
    cacheExpiresAt = now + CACHE_TTL_MS;
  }
  return cache;
}

export async function getSetting(key: SettingsKey): Promise<string> {
  const all = await getAllSettings();
  return all[key] ?? DEFAULTS[key];
}

export async function getNumericSetting(key: SettingsKey): Promise<number> {
  const value = await getSetting(key);
  const num = Number(value);
  return Number.isFinite(num) ? num : Number(DEFAULTS[key]);
}

export async function updateSettings(patch: Record<string, string>): Promise<Record<string, string>> {
  await prisma.$transaction(
    Object.entries(patch).map(([key, value]) =>
      prisma.setting.upsert({
        where: { key },
        update: { value: String(value) },
        create: { key, value: String(value) },
      })
    )
  );
  cache = null;
  return getAllSettings();
}

export function invalidateSettingsCache(): void {
  cache = null;
}
