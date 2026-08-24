import { Router } from "express";
import { z } from "zod";
import { asyncHandler } from "../middleware/errorHandler";
import { validateBody } from "../middleware/validate";
import { AuthedRequest } from "../middleware/auth";
import * as providerService from "../../services/providerService";
import { recordAudit } from "../../services/auditService";

export const providersRouter = Router();

providersRouter.get(
  "/",
  asyncHandler(async (_req, res) => {
    res.json({ data: await providerService.listProviders() });
  })
);

providersRouter.get(
  "/:id",
  asyncHandler(async (req, res) => {
    res.json({ data: await providerService.getProvider(req.params.id) });
  })
);

const createProviderSchema = z.object({
  name: z.string().min(1),
  apiUrl: z.string().url(),
  apiKey: z.string().min(1),
  adapterType: z.string().optional(),
  status: z.enum(["ACTIVE", "INACTIVE"]).optional(),
  notes: z.string().optional(),
});

providersRouter.post(
  "/",
  validateBody(createProviderSchema),
  asyncHandler(async (req: AuthedRequest, res) => {
    const provider = await providerService.createProvider(req.body);
    await recordAudit({ adminId: req.admin!.adminId, action: "PROVIDER_CREATE", entityType: "Provider", entityId: provider.id, ipAddress: req.ip });
    res.status(201).json({ data: provider });
  })
);

providersRouter.patch(
  "/:id",
  validateBody(createProviderSchema.partial()),
  asyncHandler(async (req: AuthedRequest, res) => {
    const provider = await providerService.updateProvider(req.params.id, req.body);
    await recordAudit({ adminId: req.admin!.adminId, action: "PROVIDER_UPDATE", entityType: "Provider", entityId: provider.id, ipAddress: req.ip });
    res.json({ data: provider });
  })
);

providersRouter.delete(
  "/:id",
  asyncHandler(async (req: AuthedRequest, res) => {
    await providerService.deleteProvider(req.params.id);
    await recordAudit({ adminId: req.admin!.adminId, action: "PROVIDER_DELETE", entityType: "Provider", entityId: req.params.id, ipAddress: req.ip });
    res.status(204).send();
  })
);

providersRouter.post(
  "/:id/test-connection",
  asyncHandler(async (req, res) => {
    res.json({ data: await providerService.testProviderConnection(req.params.id) });
  })
);

providersRouter.get(
  "/:id/balance",
  asyncHandler(async (req, res) => {
    res.json({ data: await providerService.getProviderBalance(req.params.id) });
  })
);

providersRouter.get(
  "/:id/remote-services",
  asyncHandler(async (req, res) => {
    res.json({ data: await providerService.getRemoteServices(req.params.id) });
  })
);

providersRouter.get(
  "/:id/mapped-services",
  asyncHandler(async (req, res) => {
    const items = await providerService.listMappedServices(req.params.id);
    res.json({ data: items.map(providerService.serializeProviderServiceNumbers) });
  })
);

providersRouter.post(
  "/:id/mapped-services/bulk-import",
  asyncHandler(async (req: AuthedRequest, res) => {
    const result = await providerService.bulkImportProviderServices(req.params.id);
    await recordAudit({
      adminId: req.admin!.adminId,
      action: "PROVIDER_SERVICE_BULK_IMPORT",
      entityType: "Provider",
      entityId: req.params.id,
      newValue: result,
      ipAddress: req.ip,
    });
    res.json({ data: result });
  })
);

const mappedServiceSchema = z.object({
  externalServiceId: z.string().min(1),
  name: z.string().min(1),
  category: z.string().optional(),
  costPrice: z.number().positive(),
  minQuantity: z.number().int().positive(),
  maxQuantity: z.number().int().positive(),
});

providersRouter.post(
  "/:id/mapped-services",
  validateBody(mappedServiceSchema),
  asyncHandler(async (req: AuthedRequest, res) => {
    const mapped = await providerService.createMappedService(req.params.id, req.body);
    await recordAudit({ adminId: req.admin!.adminId, action: "PROVIDER_SERVICE_CREATE", entityType: "ProviderService", entityId: mapped.id, ipAddress: req.ip });
    res.status(201).json({ data: providerService.serializeProviderServiceNumbers(mapped) });
  })
);

export const providerServicesRouter = Router();

providerServicesRouter.patch(
  "/:id",
  validateBody(mappedServiceSchema.partial().extend({ isActive: z.boolean().optional() })),
  asyncHandler(async (req: AuthedRequest, res) => {
    const mapped = await providerService.updateMappedService(req.params.id, req.body);
    await recordAudit({ adminId: req.admin!.adminId, action: "PROVIDER_SERVICE_UPDATE", entityType: "ProviderService", entityId: mapped.id, ipAddress: req.ip });
    res.json({ data: providerService.serializeProviderServiceNumbers(mapped) });
  })
);

providerServicesRouter.delete(
  "/:id",
  asyncHandler(async (req: AuthedRequest, res) => {
    await providerService.deleteMappedService(req.params.id);
    await recordAudit({ adminId: req.admin!.adminId, action: "PROVIDER_SERVICE_DELETE", entityType: "ProviderService", entityId: req.params.id, ipAddress: req.ip });
    res.status(204).send();
  })
);
