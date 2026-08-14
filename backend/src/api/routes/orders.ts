import { Router } from "express";
import { z } from "zod";
import { asyncHandler } from "../middleware/errorHandler";
import { validateQuery } from "../middleware/validate";
import { AuthedRequest } from "../middleware/auth";
import { paginationSchema, paginationMeta } from "../pagination";
import * as orderService from "../../services/orderService";
import { recordAudit } from "../../services/auditService";
import { serializeOrder } from "../serializers";

export const ordersRouter = Router();

const listQuerySchema = paginationSchema.extend({
  status: z.enum(["PENDING", "PROCESSING", "COMPLETED", "PARTIAL", "CANCELED", "FAILED"]).optional(),
  userId: z.string().optional(),
  query: z.string().optional(),
});

ordersRouter.get(
  "/",
  validateQuery(listQuerySchema),
  asyncHandler(async (req, res) => {
    const { page, limit, status, userId, query } = req.query as unknown as z.infer<typeof listQuerySchema>;
    const { items, total } = await orderService.listOrders({ page, limit, status, userId, query });
    res.json({ data: items.map(serializeOrder), meta: paginationMeta(page, limit, total) });
  })
);

ordersRouter.get(
  "/:id",
  asyncHandler(async (req, res) => {
    res.json({ data: serializeOrder(await orderService.getOrderById(req.params.id)) });
  })
);

ordersRouter.post(
  "/:id/sync",
  asyncHandler(async (req: AuthedRequest, res) => {
    const order = await orderService.syncOrderStatus(req.params.id);
    await recordAudit({ adminId: req.admin!.adminId, action: "ORDER_SYNC", entityType: "Order", entityId: req.params.id, ipAddress: req.ip });
    res.json({ data: order ? serializeOrder(order) : null });
  })
);

ordersRouter.post(
  "/:id/refund",
  asyncHandler(async (req: AuthedRequest, res) => {
    const order = await orderService.refundOrder(req.params.id);
    await recordAudit({ adminId: req.admin!.adminId, action: "ORDER_REFUND", entityType: "Order", entityId: req.params.id, ipAddress: req.ip });
    res.json({ data: serializeOrder(order) });
  })
);
