import rateLimit from "express-rate-limit";

export const generalRateLimiter = rateLimit({
  windowMs: 60_000,
  limit: 300,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: { message: "عدد كبير جداً من الطلبات، حاول لاحقاً", code: "RATE_LIMITED" } },
});

export const loginRateLimiter = rateLimit({
  windowMs: 15 * 60_000,
  limit: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: { message: "محاولات تسجيل دخول كثيرة، حاول بعد 15 دقيقة", code: "RATE_LIMITED" } },
});
