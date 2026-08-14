import { NextFunction, Request, Response } from "express";
import { ZodError } from "zod";
import { AppError } from "../../utils/errors";
import { logger } from "../../lib/logger";

export function errorHandler(err: unknown, req: Request, res: Response, _next: NextFunction) {
  if (err instanceof ZodError) {
    return res.status(400).json({
      error: { message: "بيانات غير صالحة", code: "VALIDATION_ERROR", details: err.flatten() },
    });
  }

  if (err instanceof AppError) {
    if (err.statusCode >= 500) logger.error({ err, path: req.path }, "AppError");
    return res.status(err.statusCode).json({ error: { message: err.message, code: err.code, details: err.details } });
  }

  logger.error({ err, path: req.path }, "Unhandled error");
  return res.status(500).json({ error: { message: "حدث خطأ غير متوقع في الخادم", code: "INTERNAL_ERROR" } });
}

export function notFoundHandler(req: Request, res: Response) {
  res.status(404).json({ error: { message: "المسار غير موجود", code: "NOT_FOUND" } });
}

export function asyncHandler<T extends (...args: any[]) => Promise<any>>(fn: T) {
  return (req: Request, res: Response, next: NextFunction) => {
    fn(req, res, next).catch(next);
  };
}
