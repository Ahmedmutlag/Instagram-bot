import { prisma } from "../src/lib/prisma";
import { encryptSecret } from "../src/lib/crypto";

let counter = 0;
function unique(prefix: string) {
  counter += 1;
  return `${prefix}-${Date.now()}-${counter}`;
}

export async function createTestUser(overrides: Partial<{ balance: number; telegramId: bigint }> = {}) {
  return prisma.user.create({
    data: {
      telegramId: overrides.telegramId ?? BigInt(Math.floor(Math.random() * 1_000_000_000)),
      username: unique("user"),
      firstName: "Test",
      lastName: "User",
      referralCode: unique("REF").slice(0, 20),
      balance: overrides.balance ?? 0,
    },
  });
}

export async function createTestProvider() {
  return prisma.provider.create({
    data: {
      name: unique("Provider"),
      apiUrl: "https://example-provider.test/api",
      apiKeyEncrypted: encryptSecret("test-api-key"),
      adapterType: "generic_smm_api",
      status: "ACTIVE",
    },
  });
}

export async function createTestProviderService(providerId: string, overrides: Partial<{ costPrice: number; min: number; max: number }> = {}) {
  return prisma.providerService.create({
    data: {
      providerId,
      externalServiceId: unique("ext"),
      name: "Test Provider Service",
      costPrice: overrides.costPrice ?? 1,
      minQuantity: overrides.min ?? 100,
      maxQuantity: overrides.max ?? 10000,
    },
  });
}

export async function createTestService(overrides: Partial<{ price: number; min: number; max: number; status: "ACTIVE" | "INACTIVE" }> = {}) {
  const provider = await createTestProvider();
  const providerService = await createTestProviderService(provider.id, {
    costPrice: 1,
    min: overrides.min ?? 100,
    max: overrides.max ?? 10000,
  });
  const service = await prisma.service.create({
    data: {
      name: unique("Service"),
      providerId: provider.id,
      providerServiceId: providerService.id,
      price: overrides.price ?? 3,
      minQuantity: overrides.min ?? 100,
      maxQuantity: overrides.max ?? 10000,
      status: overrides.status ?? "ACTIVE",
    },
  });
  return { service, provider, providerService };
}

export async function createTestAdmin(overrides: Partial<{ email: string; passwordHash: string; role: "SUPER_ADMIN" | "ADMIN" | "SUPPORT" }> = {}) {
  const { hashPassword } = await import("../src/services/adminAuthService");
  const passwordHash = overrides.passwordHash ?? (await hashPassword("Password123!"));
  return prisma.admin.create({
    data: {
      email: overrides.email ?? unique("admin") + "@example.com",
      passwordHash,
      name: "Test Admin",
      role: overrides.role ?? "ADMIN",
    },
  });
}
