import { ProviderStatus } from "@prisma/client";
import { prisma } from "../lib/prisma";
import { decryptSecret, encryptSecret, maskSecret } from "../lib/crypto";
import { createProviderAdapter, getAvailableAdapterTypes } from "../providers/registry";
import { AppError } from "../utils/errors";
import { toNumber } from "../utils/money";

export interface CreateProviderInput {
  name: string;
  apiUrl: string;
  apiKey: string;
  adapterType?: string;
  status?: ProviderStatus;
  notes?: string;
}

export interface UpdateProviderInput {
  name?: string;
  apiUrl?: string;
  apiKey?: string;
  adapterType?: string;
  status?: ProviderStatus;
  notes?: string;
}

function serializeProvider(provider: {
  id: string;
  name: string;
  apiUrl: string;
  adapterType: string;
  status: ProviderStatus;
  notes: string | null;
  createdAt: Date;
  updatedAt: Date;
}) {
  return { ...provider, apiKey: maskSecret() };
}

export async function listProviders() {
  const providers = await prisma.provider.findMany({ orderBy: { createdAt: "desc" } });
  return providers.map(serializeProvider);
}

export async function getProviderRaw(id: string) {
  const provider = await prisma.provider.findUnique({ where: { id } });
  if (!provider) throw AppError.notFound("مزود الخدمة غير موجود");
  return provider;
}

export async function getProvider(id: string) {
  return serializeProvider(await getProviderRaw(id));
}

export async function createProvider(input: CreateProviderInput) {
  const adapterType = input.adapterType ?? "generic_smm_api";
  if (!getAvailableAdapterTypes().includes(adapterType)) {
    throw AppError.badRequest(`نوع المزود غير مدعوم: ${adapterType}`);
  }
  const provider = await prisma.provider.create({
    data: {
      name: input.name,
      apiUrl: input.apiUrl,
      apiKeyEncrypted: encryptSecret(input.apiKey),
      adapterType,
      status: input.status ?? "ACTIVE",
      notes: input.notes,
    },
  });
  return serializeProvider(provider);
}

export async function updateProvider(id: string, input: UpdateProviderInput) {
  await getProviderRaw(id);
  const provider = await prisma.provider.update({
    where: { id },
    data: {
      name: input.name,
      apiUrl: input.apiUrl,
      apiKeyEncrypted: input.apiKey ? encryptSecret(input.apiKey) : undefined,
      adapterType: input.adapterType,
      status: input.status,
      notes: input.notes,
    },
  });
  return serializeProvider(provider);
}

export async function deleteProvider(id: string) {
  await getProviderRaw(id);
  const servicesCount = await prisma.service.count({ where: { providerId: id } });
  if (servicesCount > 0) {
    throw AppError.conflict("لا يمكن حذف المزود لوجود خدمات مرتبطة به. قم بإيقافه بدلاً من ذلك");
  }
  await prisma.provider.delete({ where: { id } });
}

export async function getAdapterForProvider(id: string) {
  const provider = await getProviderRaw(id);
  const apiKey = decryptSecret(provider.apiKeyEncrypted);
  return { provider, adapter: createProviderAdapter(provider.adapterType, { apiUrl: provider.apiUrl, apiKey }) };
}

export async function testProviderConnection(id: string) {
  try {
    const { adapter } = await getAdapterForProvider(id);
    const balance = await adapter.getBalance();
    return { success: true, message: `تم الاتصال بنجاح. الرصيد الحالي: ${balance.balance} ${balance.currency}` };
  } catch (error) {
    return { success: false, message: error instanceof Error ? error.message : "فشل الاتصال بالمزود" };
  }
}

export async function getProviderBalance(id: string) {
  const { adapter } = await getAdapterForProvider(id);
  return adapter.getBalance();
}

export async function getRemoteServices(id: string) {
  const { adapter } = await getAdapterForProvider(id);
  return adapter.getServices();
}

export async function listMappedServices(providerId: string) {
  await getProviderRaw(providerId);
  return prisma.providerService.findMany({ where: { providerId }, orderBy: { createdAt: "desc" } });
}

export interface CreateProviderServiceInput {
  externalServiceId: string;
  name: string;
  category?: string;
  costPrice: number;
  minQuantity: number;
  maxQuantity: number;
}

export async function createMappedService(providerId: string, input: CreateProviderServiceInput) {
  await getProviderRaw(providerId);
  if (input.minQuantity <= 0 || input.maxQuantity < input.minQuantity) {
    throw AppError.badRequest("الحد الأدنى والحد الأقصى غير صالحين");
  }
  const existing = await prisma.providerService.findUnique({
    where: { providerId_externalServiceId: { providerId, externalServiceId: input.externalServiceId } },
  });
  if (existing) throw AppError.conflict("هذه الخدمة مستوردة بالفعل من هذا المزود");

  return prisma.providerService.create({
    data: {
      providerId,
      externalServiceId: input.externalServiceId,
      name: input.name,
      category: input.category,
      costPrice: input.costPrice,
      minQuantity: input.minQuantity,
      maxQuantity: input.maxQuantity,
    },
  });
}

/**
 * Imports every remote service the provider offers that hasn't already been
 * mapped, in one shot. Re-fetches the live service list itself (does not
 * trust a client-supplied list) so the admin can't spoof cost prices.
 */
export async function bulkImportProviderServices(providerId: string) {
  await getProviderRaw(providerId);
  const { adapter } = await getAdapterForProvider(providerId);
  const remoteServices = await adapter.getServices();

  const existing = await prisma.providerService.findMany({
    where: { providerId },
    select: { externalServiceId: true },
  });
  const existingIds = new Set(existing.map((e) => e.externalServiceId));

  const candidates = remoteServices.filter(
    (rs) =>
      !existingIds.has(rs.externalServiceId) &&
      Number.isFinite(rs.min) &&
      Number.isFinite(rs.max) &&
      rs.min > 0 &&
      rs.max >= rs.min &&
      Number.isFinite(rs.rate) &&
      rs.rate >= 0
  );

  if (candidates.length === 0) {
    return { imported: 0, skipped: remoteServices.length };
  }

  const result = await prisma.providerService.createMany({
    data: candidates.map((rs) => ({
      providerId,
      externalServiceId: rs.externalServiceId,
      name: rs.name,
      category: rs.category,
      costPrice: rs.rate,
      minQuantity: rs.min,
      maxQuantity: rs.max,
    })),
    skipDuplicates: true,
  });

  return { imported: result.count, skipped: remoteServices.length - result.count };
}

export async function updateMappedService(id: string, input: Partial<CreateProviderServiceInput> & { isActive?: boolean }) {
  const existing = await prisma.providerService.findUnique({ where: { id } });
  if (!existing) throw AppError.notFound("خدمة المزود غير موجودة");
  return prisma.providerService.update({
    where: { id },
    data: {
      name: input.name,
      category: input.category,
      costPrice: input.costPrice,
      minQuantity: input.minQuantity,
      maxQuantity: input.maxQuantity,
      isActive: input.isActive,
    },
  });
}

export async function deleteMappedService(id: string) {
  const existing = await prisma.providerService.findUnique({ where: { id } });
  if (!existing) throw AppError.notFound("خدمة المزود غير موجودة");
  const linkedServices = await prisma.service.count({ where: { providerServiceId: id } });
  if (linkedServices > 0) {
    throw AppError.conflict("لا يمكن حذف هذه الخدمة لارتباطها بخدمة معروضة للبيع");
  }
  await prisma.providerService.delete({ where: { id } });
}

export function serializeProviderServiceNumbers<T extends { costPrice: unknown }>(ps: T) {
  return { ...ps, costPrice: toNumber(ps.costPrice as any) };
}
