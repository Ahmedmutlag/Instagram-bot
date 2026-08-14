export class AppError extends Error {
  public readonly statusCode: number;
  public readonly code: string;
  public readonly details?: unknown;

  constructor(message: string, statusCode = 400, code = "BAD_REQUEST", details?: unknown) {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
    Object.setPrototypeOf(this, AppError.prototype);
  }

  static notFound(message = "العنصر المطلوب غير موجود") {
    return new AppError(message, 404, "NOT_FOUND");
  }

  static badRequest(message: string, details?: unknown) {
    return new AppError(message, 400, "BAD_REQUEST", details);
  }

  static unauthorized(message = "غير مصرح") {
    return new AppError(message, 401, "UNAUTHORIZED");
  }

  static forbidden(message = "ممنوع الوصول") {
    return new AppError(message, 403, "FORBIDDEN");
  }

  static conflict(message: string) {
    return new AppError(message, 409, "CONFLICT");
  }

  static insufficientBalance(message = "الرصيد غير كافٍ") {
    return new AppError(message, 422, "INSUFFICIENT_BALANCE");
  }

  static providerError(message: string, details?: unknown) {
    return new AppError(message, 502, "PROVIDER_ERROR", details);
  }
}
