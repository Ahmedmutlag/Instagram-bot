import { Router } from "express";
import { z } from "zod";
import { asyncHandler } from "../middleware/errorHandler";
import { validateBody, validateQuery } from "../middleware/validate";
import { AuthedRequest } from "../middleware/auth";
import { paginationSchema, paginationMeta } from "../pagination";
import * as userService from "../../services/userService";
import * as balanceService from "../../services/balanceService";
import { recordAudit } from "../../services/auditService";
import { serializeUser, serializeOrder } from "../serializers";

export const usersRouter = Router();

const listQuerySchema = paginationSchema.extend({ query: z.string().optional() });

usersRouter.get(
  "/",
  validateQuery(listQuerySchema),
  asyncHandler(async (req, res) => {
    const { page, limit, query } = req.query as unknown as z.infer<typeof listQuerySchema>;
    const { items, total } = await userService.listUsers({ query, page, limit });
    res.json({ data: items.map(serializeUser), meta: paginationMeta(page, limit, total) });
  })
);

usersRouter.get(
  "/:id",
  asyncHandler(async (req, res) => {
    const user = await userService.getUserById(req.params.id);
    res.json({ data: serializeUser(user) });
  })
);

usersRouter.get(
  "/:id/orders",
  validateQuery(paginationSchema),
  asyncHandler(async (req, res) => {
    const { page, limit } = req.query as unknown as z.infer<typeof paginationSchema>;
    const orderService = await import("../../services/orderService");
    const { items, total } = await orderService.listOrdersForUser(req.params.id, page, limit);
    res.json({ data: items.map(serializeOrder), meta: paginationMeta(page, limit, total) });
  })
);

const balanceAdjustSchema = z.object({
  amount: z.number().positive(),
  description: z.string().max(500).optional(),
});

usersRouter.post(
  "/:id/balance/add",
  validateBody(balanceAdjustSchema),
  asyncHandler(async (req: AuthedRequest, res) => {
    const { amount, description } = req.body;
    const { user, transaction } = await balanceService.creditBalance({
      userId: req.params.id,
      amount,
      type: "ADMIN_ADJUSTMENT",
      description: description ?? "إضافة رصيد من الإدارة",
    });
    await recordAudit({
      adminId: req.admin!.adminId,
      action: "BALANCE_ADD",
      entityType: "User",
      entityId: user.id,
      newValue: { amount, balanceAfter: transaction.balanceAfter },
      ipAddress: req.ip,
    });
    res.json({ data: serializeUser(user) });
  })
);

usersRouter.post(
  "/:id/balance/deduct",
  validateBody(balanceAdjustSchema),
  asyncHandler(async (req: AuthedRequest, res) => {
    const { amount, description } = req.body;
    const { user, transaction } = await balanceService.debitBalance({
      userId: req.params.id,
      amount,
      type: "ADMIN_ADJUSTMENT",
      description: description ?? "خصم رصيد من الإدارة",
    });
    await recordAudit({
      adminId: req.admin!.adminId,
      action: "BALANCE_DEDUCT",
      entityType: "User",
      entityId: user.id,
      newValue: { amount, balanceAfter: transaction.balanceAfter },
      ipAddress: req.ip,
    });
    res.json({ data: serializeUser(user) });
  })
);

usersRouter.post(
  "/:id/ban",
  asyncHandler(async (req: AuthedRequest, res) => {
    const user = await userService.setUserBanned(req.params.id, true);
    await recordAudit({ adminId: req.admin!.adminId, action: "USER_BAN", entityType: "User", entityId: user.id, ipAddress: req.ip });
    res.json({ data: serializeUser(user) });
  })
);

usersRouter.post(
  "/:id/unban",
  asyncHandler(async (req: AuthedRequest, res) => {
    const user = await userService.setUserBanned(req.params.id, false);
    await recordAudit({ adminId: req.admin!.adminId, action: "USER_UNBAN", entityType: "User", entityId: user.id, ipAddress: req.ip });
    res.json({ data: serializeUser(user) });
  })
);
