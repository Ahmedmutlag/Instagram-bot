import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { prisma } from "../lib/prisma";
import { env } from "../config/env";
import { AppError } from "../utils/errors";

export interface AdminTokenPayload {
  adminId: string;
  role: string;
}

export async function loginAdmin(email: string, password: string) {
  // Case-insensitive lookup: admins may have been seeded/created with any
  // casing in their email (e.g. via SEED_ADMIN_EMAIL), so a plain
  // findUnique on a lowercased value would silently never match.
  const admin = await prisma.admin.findFirst({ where: { email: { equals: email, mode: "insensitive" } } });
  if (!admin || !admin.isActive) {
    throw AppError.unauthorized("بيانات الدخول غير صحيحة");
  }
  const valid = await bcrypt.compare(password, admin.passwordHash);
  if (!valid) {
    throw AppError.unauthorized("بيانات الدخول غير صحيحة");
  }

  const token = jwt.sign({ adminId: admin.id, role: admin.role } satisfies AdminTokenPayload, env.JWT_SECRET, {
    expiresIn: env.JWT_EXPIRES_IN as jwt.SignOptions["expiresIn"],
  });

  return { token, admin: { id: admin.id, email: admin.email, name: admin.name, role: admin.role } };
}

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 12);
}

export function verifyToken(token: string): AdminTokenPayload {
  try {
    return jwt.verify(token, env.JWT_SECRET) as AdminTokenPayload;
  } catch {
    throw AppError.unauthorized("الجلسة غير صالحة أو منتهية");
  }
}

export async function getAdminById(id: string) {
  const admin = await prisma.admin.findUnique({ where: { id } });
  if (!admin || !admin.isActive) throw AppError.unauthorized("الحساب غير موجود أو معطل");
  return admin;
}

export async function changeOwnPassword(adminId: string, currentPassword: string, newPassword: string) {
  const admin = await getAdminById(adminId);
  const valid = await bcrypt.compare(currentPassword, admin.passwordHash);
  if (!valid) {
    throw AppError.unauthorized("كلمة المرور الحالية غير صحيحة");
  }
  const passwordHash = await hashPassword(newPassword);
  await prisma.admin.update({ where: { id: adminId }, data: { passwordHash } });
}
