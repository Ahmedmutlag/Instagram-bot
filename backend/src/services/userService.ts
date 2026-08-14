import { customAlphabet } from "nanoid";
import { prisma } from "../lib/prisma";
import { AppError } from "../utils/errors";

const referralCodeGen = customAlphabet("ABCDEFGHJKLMNPQRSTUVWXYZ23456789", 8);

interface TelegramProfile {
  telegramId: bigint;
  username?: string | null;
  firstName?: string | null;
  lastName?: string | null;
  languageCode?: string | null;
}

export async function findOrCreateUser(profile: TelegramProfile, referralCode?: string) {
  const existing = await prisma.user.findUnique({ where: { telegramId: profile.telegramId } });
  if (existing) {
    return prisma.user.update({
      where: { id: existing.id },
      data: {
        username: profile.username ?? existing.username,
        firstName: profile.firstName ?? existing.firstName,
        lastName: profile.lastName ?? existing.lastName,
      },
    });
  }

  let referredById: string | undefined;
  if (referralCode) {
    const referrer = await prisma.user.findUnique({ where: { referralCode } });
    if (referrer) referredById = referrer.id;
  }

  return prisma.user.create({
    data: {
      telegramId: profile.telegramId,
      username: profile.username,
      firstName: profile.firstName,
      lastName: profile.lastName,
      languageCode: profile.languageCode ?? "ar",
      referralCode: referralCodeGen(),
      referredById,
    },
  });
}

export async function getUserByTelegramId(telegramId: bigint) {
  return prisma.user.findUnique({ where: { telegramId } });
}

export async function requireActiveUser(telegramId: bigint) {
  const user = await getUserByTelegramId(telegramId);
  if (!user) throw AppError.notFound("المستخدم غير موجود");
  if (user.isBanned) throw AppError.forbidden("تم حظر هذا الحساب من استخدام البوت");
  return user;
}

export async function listUsers(params: { query?: string; page: number; limit: number }) {
  const { query, page, limit } = params;
  const where = query
    ? {
        OR: [
          { username: { contains: query, mode: "insensitive" as const } },
          { firstName: { contains: query, mode: "insensitive" as const } },
          { lastName: { contains: query, mode: "insensitive" as const } },
          { referralCode: { contains: query, mode: "insensitive" as const } },
        ],
      }
    : {};

  const [items, total] = await Promise.all([
    prisma.user.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.user.count({ where }),
  ]);

  return { items, total };
}

export async function getUserById(id: string) {
  const user = await prisma.user.findUnique({
    where: { id },
    include: { _count: { select: { orders: true, referrals: true } } },
  });
  if (!user) throw AppError.notFound("المستخدم غير موجود");
  return user;
}

export async function setUserBanned(id: string, isBanned: boolean) {
  await getUserById(id);
  return prisma.user.update({ where: { id }, data: { isBanned } });
}
