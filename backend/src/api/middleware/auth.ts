import { NextFunction, Request, Response } from "express";
import { verifyToken } from "../../services/adminAuthService";
import { AppError } from "../../utils/errors";

export interface AuthedRequest extends Request {
  admin?: { adminId: string; role: string };
}

export function requireAdminAuth(req: AuthedRequest, _res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer ")) {
    return next(AppError.unauthorized("مطلوب تسجيل الدخول"));
  }
  const token = header.slice("Bearer ".length);
  const payload = verifyToken(token);
  req.admin = payload;
  next();
}

export function requireRole(...roles: string[]) {
  return (req: AuthedRequest, _res: Response, next: NextFunction) => {
    if (!req.admin || !roles.includes(req.admin.role)) {
      return next(AppError.forbidden("لا تملك صلاحية القيام بهذا الإجراء"));
    }
    next();
  };
}
