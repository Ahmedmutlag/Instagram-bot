# منصة إعادة بيع خدمات SMM عبر بوت تيليجرام

منصة كاملة لإعادة بيع خدمات السوشيال ميديا (SMM) عبر بوت تيليجرام، تستقبل الطلبات من المستخدمين وترسلها إلى مزودي خدمات خارجيين عبر API، مع لوحة تحكم إدارية كاملة.

## إخلاء مسؤولية مهم

- **لا** ينشئ هذا المشروع حسابات إنستغرام وهمية، **ولا** يدخل إلى حسابات إنستغرام، **ولا** يطلب أو يخزّن كلمات مرور من أي نوع.
- الرابط الذي يُدخله المستخدم عند الطلب يُعامل كنص عادي فقط، ولا يتم فتحه أو تسجيل الدخول من خلاله.
- المشروع لا يتجاوز أي أنظمة حماية أو CAPTCHA أو حدود طلبات لدى أي منصة خارجية.
- المنصة تعمل فقط كوسيط: تستقبل الطلب من المستخدم وترسله إلى **مزود خدمة خارجي موثق** عبر API يقوم المشرف بإضافته بنفسه من لوحة التحكم.
- لا توجد أي بيانات اعتماد أو مفاتيح API حقيقية داخل هذا المستودع — كل مزود يُضاف لاحقاً من لوحة الإدارة.

## البنية التقنية

| الطبقة | التقنية |
|---|---|
| Backend API | Node.js + TypeScript + Express |
| بوت تيليجرام | Telegraf |
| قاعدة البيانات | PostgreSQL + Prisma ORM |
| المهام الخلفية | Redis + BullMQ |
| لوحة التحكم | Next.js 14 (App Router) + TypeScript + Tailwind، واجهة عربية RTL بالكامل |
| التحقق من المدخلات | Zod |
| الحاويات | Docker + Docker Compose |

```
.
├── backend/           # Express API + بوت تيليجرام + Background Workers (نفس الكود، عمليات منفصلة)
│   ├── prisma/         # schema.prisma + migrations + seed.ts
│   ├── src/
│   │   ├── api/         # REST API للوحة الإدارة (routes, middleware)
│   │   ├── bot/          # منطق بوت تيليجرام (قوائم، تدفقات الطلب/الإيداع)
│   │   ├── workers/     # BullMQ workers (مزامنة الطلبات، التحقق من الدفع، الإشعارات)
│   │   ├── providers/    # Interface موحّد لمزودي SMM + Adapter عام + Registry
│   │   ├── payments/     # Interface موحّد لبوابات الدفع + Mock Provider
│   │   └── services/     # منطق الأعمال (رصيد، طلبات، خدمات، كوبونات، إحالة...)
│   └── tests/          # اختبارات Jest
├── admin/             # لوحة تحكم Next.js (RTL / عربي)
├── docs/API_CONTRACT.md
├── docker-compose.yml
└── .env.example
```

## نظام مزودي الخدمات (Provider Adapters)

كل مزود خدمة خارجي يُمثَّل خلف واجهة موحدة في `backend/src/providers/types.ts`:

```ts
interface ProviderAdapter {
  getServices(): Promise<RemoteService[]>;
  createOrder(params: CreateOrderParams): Promise<CreateOrderResult>;
  getOrderStatus(providerOrderId: string): Promise<OrderStatusResult>;
  getBalance(): Promise<ProviderBalanceResult>;
}
```

يأتي المشروع مع تطبيق واحد جاهز (`generic_smm_api` في `backend/src/providers/adapters/genericSmmApiAdapter.ts`) لنمط الـ API الشائع القائم على `action` (services / add / status / balance) والذي تعتمده أغلب مزودي لوحات SMM. **لا يوجد أي مزود محدد مكتوب داخل الكود** — من لوحة الإدارة تقوم بإضافة أي مزود بإدخال اسمه ورابط الـ API ومفتاحه فقط.

لإضافة نوع API مختلف تماماً لاحقاً: أنشئ كلاساً جديداً يطبّق `ProviderAdapter` تحت `src/providers/adapters/`، وسجّله بسطر واحد في `src/providers/registry.ts`. باقي النظام (الطلبات، المزامنة، لوحة التحكم) لا يعرف شيئاً عن شكل أي مزود بعينه.

مفاتيح API تُشفَّر بـ AES-256-GCM قبل حفظها (`src/lib/crypto.ts`) ولا تُعرض للمستخدم بعد حفظها (تظهر كـ `********` في الـ API وفي لوحة الإدارة).

## نظام الدفع (Payment Gateway)

نفس الفكرة عبر `backend/src/payments/types.ts`:

```ts
interface PaymentGateway {
  createPayment(params): Promise<CreatePaymentResult>;
  verifyPayment(params): Promise<VerifyPaymentResult>;
  getPaymentStatus(providerRef): Promise<PaymentGatewayStatus>;
}
```

في وضع التطوير يُستخدم `MockPaymentGateway` فقط (`src/payments/mockPaymentGateway.ts`) — لا يوجد ربط بأي بوابة دفع حقيقية داخل الكود. لإضافة بوابة حقيقية لاحقاً: نفّذ الواجهة وسجّلها في `src/payments/registry.ts`.

## المهام الخلفية (BullMQ)

| الطابور | الوظيفة |
|---|---|
| `order-submit` | إرسال الطلب لمزود الخدمة، بإعادة محاولة تلقائية (Exponential Backoff، حتى 5 محاولات) ثم استرجاع المبلغ تلقائياً عند الفشل النهائي |
| `order-sync` | مهمة متكررة كل 60 ثانية تفحص كل الطلبات قيد التنفيذ وتحدّث حالتها من المزود |
| `payment-verify` | التحقق الدوري من حالة عمليات الإيداع المعلقة (حتى 10 محاولات) |
| `notification` | إرسال إشعارات تيليجرام للمستخدم عند تغيّر حالة الطلب أو الدفع |

## التشغيل من الجوال بدون كمبيوتر (GitHub Codespaces)

إذا ما عندك كمبيوتر أو Docker مثبت، تقدر تشغّل المشروع بالكامل من متصفح الجوال مجاناً عبر **GitHub Codespaces**:

1. افتح المستودع على GitHub من متصفح الجوال.
2. اضغط على الزر الأخضر **Code** ← تبويب **Codespaces** ← **Create codespace on main**.
3. انتظر حتى تفتح بيئة تطوير كاملة داخل المتصفح (فيها Docker جاهز تلقائياً).
4. من الطرفية (Terminal) بالأسفل، عدّل ملف `.env` (تم إنشاؤه تلقائياً من `.env.example`) وحط فيه `TELEGRAM_BOT_TOKEN` الخاص بك و`JWT_SECRET` و`ENCRYPTION_KEY` (نفّذ `openssl rand -hex 32` لتوليد الأخير).
5. نفّذ:
   ```bash
   docker compose up --build
   ```
6. البوت راح يشتغل فوراً على تيليجرام. ولوحة الإدارة تفتح تلقائياً بنافذة منبثقة (Codespaces يعمل Port Forwarding للمنفذ 3000 تلقائياً).

## التشغيل السريع عبر Docker

1. انسخ ملف البيئة وعدّل القيم (خصوصاً `TELEGRAM_BOT_TOKEN` و `JWT_SECRET` و `ENCRYPTION_KEY`):

   ```bash
   cp .env.example .env
   # ولّد قيمة عشوائية آمنة لـ ENCRYPTION_KEY:
   openssl rand -hex 32
   ```

2. شغّل كل شيء:

   ```bash
   docker compose up --build
   ```

   هذا يقوم تلقائياً بـ:
   - تشغيل PostgreSQL و Redis
   - تطبيق الـ migrations وزرع (seed) حساب مشرف افتراضي وإعدادات النظام الأساسية
   - تشغيل: `api` (المنفذ 4000)، `bot` (بوت تيليجرام)، `worker` (المهام الخلفية)، `admin` (لوحة التحكم، المنفذ 3000)

3. افتح لوحة التحكم على `http://localhost:3000` وسجّل الدخول ببيانات الأدمن الافتراضية:
   - البريد: قيمة `SEED_ADMIN_EMAIL` في `.env` (افتراضياً `admin@example.com`)
   - كلمة المرور: قيمة `SEED_ADMIN_PASSWORD` (افتراضياً `ChangeMe123!`) — **غيّرها فوراً بعد أول دخول.**

4. من لوحة التحكم: أضف أول مزود خدمة (اسم، رابط API، مفتاح API)، ثم استورد خدماته وأنشئ خدمات للبيع منها. البوت سيعرض تلقائياً كل خدمة بحالة "مفعّلة".

## التشغيل محلياً بدون Docker (تطوير)

يتطلب: Node.js 20+، PostgreSQL 16+، Redis 7+.

```bash
cd backend
cp .env.example .env    # عدّل DATABASE_URL/REDIS_URL/المفاتيح
npm install
npx prisma migrate dev
npx prisma db seed

npm run dev:api      # طرفية 1: REST API على :4000
npm run dev:bot       # طرفية 2: بوت تيليجرام (long polling)
npm run dev:worker    # طرفية 3: المهام الخلفية
```

ولوحة التحكم:

```bash
cd admin
cp .env.example .env.local
npm install
npm run dev   # على :3000
```

## الاختبارات

اختبارات Jest تعمل ضد قاعدة بيانات PostgreSQL و Redis حقيقيين (وليست Mocks لقاعدة البيانات)، لذا يلزم تشغيلهما أولاً:

```bash
# عبر Docker (أسهل طريقة لتوفير قاعدة اختبار معزولة):
docker run -d --rm -p 5432:5432 -e POSTGRES_PASSWORD=postgres -e POSTGRES_DB=smm_bot_test postgres:16-alpine
docker run -d --rm -p 6379:6379 redis:7-alpine

cd backend
cp .env.example .env.test
# عدّل .env.test بحيث DATABASE_URL يشير إلى smm_bot_test و REDIS_URL يشير لنفس Redis أعلاه

npx prisma migrate deploy   # (باستخدام DATABASE_URL الخاص بقاعدة الاختبار)
npm test
```

تغطي الاختبارات: إنشاء المستخدم وربط الإحالة، إضافة/خصم الرصيد وسجل الحركات، منع إنشاء الطلب عند نقص الرصيد، إنشاء الطلب وحساب السعر/التكلفة/الربح، فشل API المزود وإعادة المحاولة والاسترجاع التلقائي، مزامنة حالة الطلب والإشعار، الاسترجاع اليدوي، الكوبونات (نسبة/مبلغ ثابت/انتهاء الصلاحية/الحد الأقصى للاستخدام)، عمولة الإحالة، والدفع (Mock Gateway) بما فيه عدم تكرار الإضافة (idempotency)، وتسجيل دخول الإدارة والصلاحيات عبر REST API.

## أدلة إضافية

- **عقد REST API الكامل** الذي تستهلكه لوحة التحكم: [`docs/API_CONTRACT.md`](docs/API_CONTRACT.md)
- قاعدة البيانات: `backend/prisma/schema.prisma` (User, Admin, Service, Provider, ProviderService, Order, Payment, BalanceTransaction, Coupon, CouponUsage, ReferralEarning, AuditLog, Setting)

## الأمان

- كلمات مرور المشرفين مشفّرة بـ bcrypt، والجلسات عبر JWT.
- صلاحيات متعددة للمشرفين (`SUPER_ADMIN` / `ADMIN` / `SUPPORT`) عبر حقل `role` في جدول `Admin`.
- Rate Limiting عام على كل الـ API، وأشد صرامة على `/auth/login`.
- تحقق من جميع المدخلات عبر Zod على مستوى كل Route.
- سجل تدقيق (`AuditLog`) لكل إجراء إداري حساس (تعديل رصيد، حظر، تعديل خدمة/مزود/كوبون...).
- مفاتيح API لمزودي الخدمة مشفّرة AES-256-GCM في قاعدة البيانات ولا تُعرض بعد الحفظ.
- لا يتم تخزين أي كلمة مرور خاصة بإنستغرام أو أي منصة خارجية؛ الروابط تُعامل كنص فقط.
