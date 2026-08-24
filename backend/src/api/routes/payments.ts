import { Router } from "express";
import { z } from "zod";
import { asyncHandler } from "../middleware/errorHandler";
import { validateBody, validateQuery } from "../middleware/validate";
import { AuthedRequest } from "../middleware/auth";
import { paginationSchema, paginationMeta } from "../pagination";
import * as paymentService from "../../services/paymentService";
import { recordAudit } from "../../services/auditService";
import { serializePayment } from "../serializers";

export const paymentsRouter = Router();

const listQuerySchema = paginationSchema.extend({
  status: z.enum(["PENDING", "SUCCESS", "FAILED", "CANCELED"]).optional(),
});

paymentsRouter.get(
  "/",
  validateQuery(listQuerySchema),
  asyncHandler(async (req, res) => {
    const { page, limit, status } = req.query as unknown as z.infer<typeof listQuerySchema>;
    const { items, total } = await paymentService.listPayments({ page, limit, status });
    res.json({ data: items.map(serializePayment), meta: paginationMeta(page, limit, total) });
  })
);

paymentsRouter.post(
  "/:id/confirm",
  asyncHandler(async (req: AuthedRequest, res) => {
    const payment = await paymentService.confirmManualPayment(req.params.id);
    await recordAudit({
      adminId: req.admin!.adminId,
      action: "PAYMENT_MANUAL_CONFIRM",
      entityType: "Payment",
      entityId: req.params.id,
      ipAddress: req.ip,
    });
    res.json({ data: payment ? serializePayment(payment) : null });
  })
);

const rejectSchema = z.object({ reason: z.string().max(500).optional() });

paymentsRouter.post(
  "/:id/reject",
  validateBody(rejectSchema),
  asyncHandler(async (req: AuthedRequest, res) => {
    const payment = await paymentService.rejectManualPayment(req.params.id, req.body.reason);
    await recordAudit({
      adminId: req.admin!.adminId,
      action: "PAYMENT_MANUAL_REJECT",
      entityType: "Payment",
      entityId: req.params.id,
      newValue: { reason: req.body.reason },
      ipAddress: req.ip,
    });
    res.json({ data: payment ? serializePayment(payment) : null });
  })
);
