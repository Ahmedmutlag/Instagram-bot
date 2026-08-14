import { Router } from "express";
import { z } from "zod";
import { asyncHandler } from "../middleware/errorHandler";
import { validateQuery } from "../middleware/validate";
import { paginationSchema, paginationMeta } from "../pagination";
import * as paymentService from "../../services/paymentService";
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
