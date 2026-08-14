import { Router } from "express";
import { z } from "zod";
import { asyncHandler } from "../middleware/errorHandler";
import { validateBody } from "../middleware/validate";
import { AuthedRequest } from "../middleware/auth";
import * as couponService from "../../services/couponService";
import { recordAudit } from "../../services/auditService";
import { serializeCoupon } from "../serializers";

export const couponsRouter = Router();

couponsRouter.get(
  "/",
  asyncHandler(async (_req, res) => {
    const coupons = await couponService.listCoupons();
    res.json({ data: coupons.map(serializeCoupon) });
  })
);

const couponSchema = z.object({
  code: z.string().min(3).max(30),
  type: z.enum(["PERCENTAGE", "FIXED"]),
  value: z.number().positive(),
  maxUses: z.number().int().positive().optional(),
  minOrderAmount: z.number().nonnegative().optional(),
  expiresAt: z.string().datetime().optional(),
  isActive: z.boolean().optional(),
});

couponsRouter.post(
  "/",
  validateBody(couponSchema),
  asyncHandler(async (req: AuthedRequest, res) => {
    const coupon = await couponService.createCoupon(req.body);
    await recordAudit({ adminId: req.admin!.adminId, action: "COUPON_CREATE", entityType: "Coupon", entityId: coupon.id, ipAddress: req.ip });
    res.status(201).json({ data: serializeCoupon(coupon) });
  })
);

couponsRouter.patch(
  "/:id",
  validateBody(couponSchema.partial()),
  asyncHandler(async (req: AuthedRequest, res) => {
    const coupon = await couponService.updateCoupon(req.params.id, req.body);
    await recordAudit({ adminId: req.admin!.adminId, action: "COUPON_UPDATE", entityType: "Coupon", entityId: coupon.id, ipAddress: req.ip });
    res.json({ data: serializeCoupon(coupon) });
  })
);

couponsRouter.delete(
  "/:id",
  asyncHandler(async (req: AuthedRequest, res) => {
    await couponService.deleteCoupon(req.params.id);
    await recordAudit({ adminId: req.admin!.adminId, action: "COUPON_DELETE", entityType: "Coupon", entityId: req.params.id, ipAddress: req.ip });
    res.status(204).send();
  })
);
