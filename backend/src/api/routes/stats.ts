import { Router } from "express";
import { asyncHandler } from "../middleware/errorHandler";
import { getDashboardStats } from "../../services/statsService";

export const statsRouter = Router();

statsRouter.get(
  "/dashboard",
  asyncHandler(async (_req, res) => {
    res.json({ data: await getDashboardStats() });
  })
);
