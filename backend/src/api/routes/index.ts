import { Router } from "express";
import { authRouter } from "./auth";
import { usersRouter } from "./users";
import { servicesRouter } from "./services";
import { providersRouter, providerServicesRouter } from "./providers";
import { ordersRouter } from "./orders";
import { paymentsRouter } from "./payments";
import { couponsRouter } from "./coupons";
import { settingsRouter } from "./settings";
import { statsRouter } from "./stats";
import { requireAdminAuth } from "../middleware/auth";

export const apiRouter = Router();

apiRouter.use("/auth", authRouter);

// Everything below requires a valid admin session.
apiRouter.use(requireAdminAuth);
apiRouter.use("/users", usersRouter);
apiRouter.use("/services", servicesRouter);
apiRouter.use("/providers", providersRouter);
apiRouter.use("/provider-services", providerServicesRouter);
apiRouter.use("/orders", ordersRouter);
apiRouter.use("/payments", paymentsRouter);
apiRouter.use("/coupons", couponsRouter);
apiRouter.use("/settings", settingsRouter);
apiRouter.use("/stats", statsRouter);
