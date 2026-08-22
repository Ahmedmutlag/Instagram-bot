import { Router } from "express";
import { z } from "zod";
import { asyncHandler } from "../middleware/errorHandler";
import { validateBody } from "../middleware/validate";
import { loginRateLimiter } from "../middleware/rateLimit";
import { requireAdminAuth, AuthedRequest } from "../middleware/auth";
import { loginAdmin, getAdminById, changeOwnPassword } from "../../services/adminAuthService";
import { recordAudit } from "../../services/auditService";

export const authRouter = Router();

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

authRouter.post(
  "/login",
  loginRateLimiter,
  validateBody(loginSchema),
  asyncHandler(async (req, res) => {
    const { email, password } = req.body;
    const result = await loginAdmin(email, password);
    await recordAudit({
      adminId: result.admin.id,
      action: "ADMIN_LOGIN",
      entityType: "Admin",
      entityId: result.admin.id,
      ipAddress: req.ip,
    });
    res.json({ data: result });
  })
);

authRouter.get(
  "/me",
  requireAdminAuth,
  asyncHandler(async (req: AuthedRequest, res) => {
    const admin = await getAdminById(req.admin!.adminId);
    res.json({ data: { id: admin.id, email: admin.email, name: admin.name, role: admin.role } });
  })
);

const changePasswordSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(8, "كلمة المرور الجديدة يجب أن تكون 8 أحرف على الأقل"),
});

authRouter.post(
  "/change-password",
  requireAdminAuth,
  validateBody(changePasswordSchema),
  asyncHandler(async (req: AuthedRequest, res) => {
    const { currentPassword, newPassword } = req.body;
    await changeOwnPassword(req.admin!.adminId, currentPassword, newPassword);
    await recordAudit({
      adminId: req.admin!.adminId,
      action: "ADMIN_CHANGE_PASSWORD",
      entityType: "Admin",
      entityId: req.admin!.adminId,
      ipAddress: req.ip,
    });
    res.json({ data: { success: true } });
  })
);
