import { Router } from "express";
import { z } from "zod";
import { asyncHandler } from "../middleware/errorHandler";
import { validateBody } from "../middleware/validate";
import { AuthedRequest } from "../middleware/auth";
import { getAllSettings, updateSettings } from "../../services/settingsService";
import { recordAudit } from "../../services/auditService";

export const settingsRouter = Router();

settingsRouter.get(
  "/",
  asyncHandler(async (_req, res) => {
    res.json({ data: await getAllSettings() });
  })
);

const settingsSchema = z.record(z.string(), z.string());

settingsRouter.patch(
  "/",
  validateBody(settingsSchema),
  asyncHandler(async (req: AuthedRequest, res) => {
    const updated = await updateSettings(req.body);
    await recordAudit({ adminId: req.admin!.adminId, action: "SETTINGS_UPDATE", entityType: "Setting", newValue: req.body, ipAddress: req.ip });
    res.json({ data: updated });
  })
);
