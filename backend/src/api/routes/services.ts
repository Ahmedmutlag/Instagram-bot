import { Router } from "express";
import { z } from "zod";
import { asyncHandler } from "../middleware/errorHandler";
import { validateBody, validateQuery } from "../middleware/validate";
import { AuthedRequest } from "../middleware/auth";
import { paginationSchema, paginationMeta } from "../pagination";
import * as serviceCatalog from "../../services/serviceCatalogService";
import { recordAudit } from "../../services/auditService";

export const servicesRouter = Router();

const listQuerySchema = paginationSchema.extend({
  status: z.enum(["ACTIVE", "INACTIVE"]).optional(),
  category: z.string().optional(),
});

servicesRouter.get(
  "/",
  validateQuery(listQuerySchema),
  asyncHandler(async (req, res) => {
    const { page, limit, status, category } = req.query as unknown as z.infer<typeof listQuerySchema>;
    const { items, total } = await serviceCatalog.listServices({ page, limit, status, category });
    res.json({ data: items, meta: paginationMeta(page, limit, total) });
  })
);

servicesRouter.get(
  "/:id",
  asyncHandler(async (req, res) => {
    res.json({ data: await serviceCatalog.getServiceById(req.params.id) });
  })
);

const serviceSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  category: z.string().optional(),
  providerId: z.string().min(1),
  providerServiceId: z.string().min(1),
  price: z.number().positive(),
  minQuantity: z.number().int().positive(),
  maxQuantity: z.number().int().positive(),
  status: z.enum(["ACTIVE", "INACTIVE"]).optional(),
});

servicesRouter.post(
  "/",
  validateBody(serviceSchema),
  asyncHandler(async (req: AuthedRequest, res) => {
    const service = await serviceCatalog.createService(req.body);
    await recordAudit({ adminId: req.admin!.adminId, action: "SERVICE_CREATE", entityType: "Service", entityId: service.id, newValue: req.body, ipAddress: req.ip });
    res.status(201).json({ data: service });
  })
);

const bulkGenerateSchema = z.object({
  providerId: z.string().min(1),
  markupPercent: z.number().positive(),
});

servicesRouter.post(
  "/bulk-generate",
  validateBody(bulkGenerateSchema),
  asyncHandler(async (req: AuthedRequest, res) => {
    const { providerId, markupPercent } = req.body;
    const result = await serviceCatalog.bulkGenerateServicesFromProvider(providerId, markupPercent);
    await recordAudit({
      adminId: req.admin!.adminId,
      action: "SERVICE_BULK_GENERATE",
      entityType: "Provider",
      entityId: providerId,
      newValue: { markupPercent, ...result },
      ipAddress: req.ip,
    });
    res.json({ data: result });
  })
);

const bulkDeleteExceptSchema = z.object({
  keepKeywords: z.array(z.string().min(1)).min(1),
});

servicesRouter.post(
  "/bulk-delete-except",
  validateBody(bulkDeleteExceptSchema),
  asyncHandler(async (req: AuthedRequest, res) => {
    const result = await serviceCatalog.bulkDeleteServicesExcludingKeywords(req.body.keepKeywords);
    await recordAudit({
      adminId: req.admin!.adminId,
      action: "SERVICE_BULK_DELETE_EXCEPT",
      entityType: "Service",
      newValue: { keepKeywords: req.body.keepKeywords, ...result },
      ipAddress: req.ip,
    });
    res.json({ data: result });
  })
);

servicesRouter.patch(
  "/:id",
  validateBody(serviceSchema.partial()),
  asyncHandler(async (req: AuthedRequest, res) => {
    const service = await serviceCatalog.updateService(req.params.id, req.body);
    await recordAudit({ adminId: req.admin!.adminId, action: "SERVICE_UPDATE", entityType: "Service", entityId: service.id, newValue: req.body, ipAddress: req.ip });
    res.json({ data: service });
  })
);

servicesRouter.delete(
  "/:id",
  asyncHandler(async (req: AuthedRequest, res) => {
    await serviceCatalog.deleteService(req.params.id);
    await recordAudit({ adminId: req.admin!.adminId, action: "SERVICE_DELETE", entityType: "Service", entityId: req.params.id, ipAddress: req.ip });
    res.status(204).send();
  })
);
