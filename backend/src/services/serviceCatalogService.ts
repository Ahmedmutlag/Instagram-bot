import { ServiceStatus } from "@prisma/client";
import { prisma } from "../lib/prisma";
import { AppError } from "../utils/errors";
import { toNumber } from "../utils/money";
import { translateServiceName } from "../utils/serviceNameTranslator";

export interface CreateServiceInput {
  name: string;
  description?: string;
  category?: string;
  providerId: string;
  providerServiceId: string;
  price: number;
  minQuantity: number;
  maxQuantity: number;
  status?: ServiceStatus;
}

export type UpdateServiceInput = Partial<CreateServiceInput>;

function withComputedFields<T extends { price: unknown; providerService?: { costPrice: unknown } | null }>(
  service: T
) {
  const price = toNumber(service.price as any);
  const cost = service.providerService ? toNumber(service.providerService.costPrice as any) : 0;
  const marginPercent = cost > 0 ? Number((((price - cost) / cost) * 100).toFixed(2)) : null;
  return { ...service, price, costPrice: cost, marginPercent };
}

const includeProviderService = {
  providerService: true,
  provider: { select: { id: true, name: true, status: true } },
} as const;

export async function listServices(params: { page: number; limit: number; status?: ServiceStatus; category?: string }) {
  const { page, limit, status, category } = params;
  const where = {
    ...(status ? { status } : {}),
    ...(category ? { category } : {}),
  };
  const [items, total] = await Promise.all([
    prisma.service.findMany({
      where,
      include: includeProviderService,
      orderBy: [{ sortOrder: "asc" }, { createdAt: "desc" }],
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.service.count({ where }),
  ]);
  return { items: items.map(withComputedFields), total };
}

export async function listActiveServicesForBot() {
  const items = await prisma.service.findMany({
    where: { status: "ACTIVE", provider: { status: "ACTIVE" } },
    include: includeProviderService,
    orderBy: [{ category: "asc" }, { sortOrder: "asc" }],
  });
  return items.map(withComputedFields);
}

export async function getServiceById(id: string) {
  const service = await prisma.service.findUnique({ where: { id }, include: includeProviderService });
  if (!service) throw AppError.notFound("الخدمة غير موجودة");
  return withComputedFields(service);
}

async function assertProviderServiceBelongsToProvider(providerId: string, providerServiceId: string) {
  const providerService = await prisma.providerService.findUnique({ where: { id: providerServiceId } });
  if (!providerService || providerService.providerId !== providerId) {
    throw AppError.badRequest("خدمة المزود المحددة غير صالحة");
  }
  return providerService;
}

export async function createService(input: CreateServiceInput) {
  await assertProviderServiceBelongsToProvider(input.providerId, input.providerServiceId);
  if (input.minQuantity <= 0 || input.maxQuantity < input.minQuantity) {
    throw AppError.badRequest("الحد الأدنى والحد الأقصى غير صالحين");
  }
  if (input.price <= 0) throw AppError.badRequest("السعر يجب أن يكون أكبر من صفر");

  const service = await prisma.service.create({
    data: {
      name: input.name,
      description: input.description,
      category: input.category,
      providerId: input.providerId,
      providerServiceId: input.providerServiceId,
      price: input.price,
      minQuantity: input.minQuantity,
      maxQuantity: input.maxQuantity,
      status: input.status ?? "ACTIVE",
    },
    include: includeProviderService,
  });
  return withComputedFields(service);
}

export async function updateService(id: string, input: UpdateServiceInput) {
  const existing = await prisma.service.findUnique({ where: { id } });
  if (!existing) throw AppError.notFound("الخدمة غير موجودة");

  if (input.providerId && input.providerServiceId) {
    await assertProviderServiceBelongsToProvider(input.providerId, input.providerServiceId);
  }

  const service = await prisma.service.update({
    where: { id },
    data: {
      name: input.name,
      description: input.description,
      category: input.category,
      providerId: input.providerId,
      providerServiceId: input.providerServiceId,
      price: input.price,
      minQuantity: input.minQuantity,
      maxQuantity: input.maxQuantity,
      status: input.status,
    },
    include: includeProviderService,
  });
  return withComputedFields(service);
}

/**
 * Auto-generates a sellable Service for every ACTIVE ProviderService under
 * the given provider that doesn't already have one, pricing each at
 * costPrice * (1 + markupPercent / 100). Admin can edit names/prices/status
 * individually afterward — this is a fast starting point, not a permanent
 * pricing decision.
 */
export async function bulkGenerateServicesFromProvider(providerId: string, markupPercent: number) {
  if (!Number.isFinite(markupPercent) || markupPercent <= 0) {
    throw AppError.badRequest("هامش الربح يجب أن يكون رقماً أكبر من صفر");
  }

  const provider = await prisma.provider.findUnique({ where: { id: providerId } });
  if (!provider) throw AppError.notFound("مزود الخدمة غير موجود");

  const mappedServices = await prisma.providerService.findMany({
    where: { providerId, isActive: true },
  });

  const alreadyListed = await prisma.service.findMany({
    where: { providerServiceId: { in: mappedServices.map((m) => m.id) } },
    select: { providerServiceId: true },
  });
  const listedIds = new Set(alreadyListed.map((s) => s.providerServiceId));

  const candidates = mappedServices.filter((m) => !listedIds.has(m.id));
  if (candidates.length === 0) {
    return { created: 0, skipped: mappedServices.length };
  }

  const result = await prisma.service.createMany({
    data: candidates.map((m) => ({
      name: translateServiceName(m.name),
      category: m.category ? translateServiceName(m.category) : m.category,
      providerId,
      providerServiceId: m.id,
      price: Number((toNumber(m.costPrice) * (1 + markupPercent / 100)).toFixed(4)),
      minQuantity: m.minQuantity,
      maxQuantity: m.maxQuantity,
      status: "ACTIVE",
    })),
  });

  return { created: result.count, skipped: mappedServices.length - result.count };
}

/**
 * Re-translates every sellable Service's name/category into Arabic from its
 * source ProviderService (the original remote provider text), so re-running
 * this is always idempotent even if it's called more than once.
 */
export async function bulkTranslateServiceNames() {
  const services = await prisma.service.findMany({
    select: { id: true, providerService: { select: { name: true, category: true } } },
  });

  const updates = services
    .map((s) => ({
      id: s.id,
      name: translateServiceName(s.providerService.name),
      category: s.providerService.category ? translateServiceName(s.providerService.category) : null,
    }))
    .filter((u) => u.name.trim().length > 0);

  await prisma.$transaction(
    updates.map((u) =>
      prisma.service.update({
        where: { id: u.id },
        data: { name: u.name, ...(u.category ? { category: u.category } : {}) },
      })
    )
  );

  return { translated: updates.length };
}

/**
 * Deletes every Service whose name/category does NOT contain any of the
 * given keywords (case-insensitive substring match) — e.g. keep only
 * Instagram/TikTok/Twitter listings and remove the rest of a bulk-generated
 * catalog. Services with existing orders are left alone (deleting them
 * would orphan order history) and counted separately.
 */
export async function bulkDeleteServicesExcludingKeywords(keepKeywords: string[]) {
  const keywords = keepKeywords.map((k) => k.trim().toLowerCase()).filter(Boolean);
  if (keywords.length === 0) {
    throw AppError.badRequest("يجب تحديد كلمة واحدة على الأقل للاحتفاظ بها");
  }

  const services = await prisma.service.findMany({ select: { id: true, name: true, category: true } });

  const toDelete = services.filter((s) => {
    const haystack = `${s.name} ${s.category ?? ""}`.toLowerCase();
    return !keywords.some((k) => haystack.includes(k));
  });

  if (toDelete.length === 0) {
    return { deleted: 0, kept: services.length, skippedHasOrders: 0 };
  }

  const ordersByService = await prisma.order.groupBy({
    by: ["serviceId"],
    where: { serviceId: { in: toDelete.map((s) => s.id) } },
    _count: true,
  });
  const hasOrders = new Set(ordersByService.map((o) => o.serviceId));

  const deletable = toDelete.filter((s) => !hasOrders.has(s.id));
  const skippedHasOrders = toDelete.length - deletable.length;

  const result = await prisma.service.deleteMany({ where: { id: { in: deletable.map((s) => s.id) } } });

  return {
    deleted: result.count,
    kept: services.length - toDelete.length,
    skippedHasOrders,
  };
}

export async function deleteService(id: string) {
  const existing = await prisma.service.findUnique({ where: { id } });
  if (!existing) throw AppError.notFound("الخدمة غير موجودة");
  const ordersCount = await prisma.order.count({ where: { serviceId: id } });
  if (ordersCount > 0) {
    throw AppError.conflict("لا يمكن حذف الخدمة لوجود طلبات مرتبطة بها. قم بإيقافها بدلاً من ذلك");
  }
  await prisma.service.delete({ where: { id } });
}
