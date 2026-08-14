# Admin REST API Contract

Base URL: `${API_BASE_URL}/api/v1` (backend service, default `http://localhost:4000/api/v1`)

All responses are JSON. Successful responses: `{ "data": ... }` or `{ "data": [...], "meta": { "page", "limit", "total" } }` for paginated lists.
Errors: HTTP 4xx/5xx with `{ "error": { "message": string, "code": string, "details"?: any } }`.

## Auth

- `POST /auth/login` — body `{ email, password }` → `{ data: { token, admin: { id, email, name, role } } }`
- `GET /auth/me` — header `Authorization: Bearer <token>` → `{ data: { id, email, name, role } }`

All routes below require `Authorization: Bearer <token>` unless noted. Roles: `SUPER_ADMIN`, `ADMIN`, `SUPPORT`.

## Users

- `GET /users?query=&page=&limit=&status=` → paginated list of `{ id, telegramId, username, firstName, lastName, balance, isBanned, referralCode, createdAt }`
- `GET /users/:id` → user detail incl. `_count` orders
- `GET /users/:id/orders?page=&limit=`
- `POST /users/:id/balance/add` — `{ amount: number, description?: string }` → updated user + transaction
- `POST /users/:id/balance/deduct` — `{ amount: number, description?: string }`
- `POST /users/:id/ban`
- `POST /users/:id/unban`

## Services

- `GET /services?page=&limit=&status=&category=`
- `POST /services` — `{ name, description?, category?, providerId, providerServiceId, price, minQuantity, maxQuantity, status? }`
- `GET /services/:id`
- `PATCH /services/:id` — partial update of same fields
- `DELETE /services/:id`

Each service object includes computed `costPrice` (from its `providerService`) and `marginPercent`.

## Providers

- `GET /providers` — list, `apiKey` is NEVER returned (masked as `"********"`)
- `POST /providers` — `{ name, apiUrl, apiKey, adapterType?, status? }`
- `GET /providers/:id`
- `PATCH /providers/:id` — same fields, `apiKey` optional (only rotates if provided)
- `DELETE /providers/:id`
- `POST /providers/:id/test-connection` → `{ data: { success: boolean, message: string } }`
- `GET /providers/:id/balance` → `{ data: { balance: number, currency: string } }`
- `GET /providers/:id/remote-services` → live list from provider API `{ data: [{ externalServiceId, name, category, rate, min, max }] }`
- `GET /providers/:id/mapped-services` → `ProviderService[]` already imported
- `POST /providers/:id/mapped-services` — `{ externalServiceId, name, category?, costPrice, minQuantity, maxQuantity }`
- `PATCH /provider-services/:id`
- `DELETE /provider-services/:id`

## Orders

- `GET /orders?query=&status=&userId=&page=&limit=`
- `GET /orders/:id`
- `POST /orders/:id/sync` — force re-fetch status from provider
- `POST /orders/:id/refund` — refunds order price to user balance, sets status CANCELED (only allowed for PENDING/PROCESSING/FAILED/CANCELED-eligible orders)

## Payments

- `GET /payments?status=&page=&limit=`

## Coupons

- `GET /coupons`
- `POST /coupons` — `{ code, type: "PERCENTAGE"|"FIXED", value, maxUses?, minOrderAmount?, expiresAt?, isActive? }`
- `PATCH /coupons/:id`
- `DELETE /coupons/:id`

## Settings

- `GET /settings` → `{ data: { botName, currency, language, supportUsername, minDeposit, referralPercent, ... } }` (key/value map)
- `PATCH /settings` — `{ [key]: value }` merge-update

## Stats

- `GET /stats/dashboard` → `{ data: { totalUsers, totalOrders, completedOrders, pendingOrders, totalSales, totalCost, totalProfit } }`

## Notes for the admin dashboard implementation

- All monetary values are numbers (already converted from Prisma Decimal to `number` by the backend).
- Store the JWT in an httpOnly-safe way for a client app: since this is a pure SPA/Next.js app calling an external API, store the token in memory + localStorage, attach as `Authorization: Bearer` header on every request. A login page guards all other routes.
- The UI language is Arabic with RTL layout (`dir="rtl"`, `lang="ar"`) across the entire admin app.
- Must be responsive (mobile + desktop) — sidebar collapses to a bottom/menu on mobile.
- `NEXT_PUBLIC_API_BASE_URL` env var configures the backend base URL.
