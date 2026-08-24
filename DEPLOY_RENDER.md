# النشر على Render

هذا الدليل يشرح نشر المشروع كاملاً على Render باستخدام ملف `render.yaml` الموجود بجذر المستودع — يُنشئ كل الخدمات الستة (قاعدة البيانات، Redis، الـ API، البوت، الـ Worker، لوحة الإدارة) تلقائياً بضغطة واحدة، بدل إعدادها يدوياً وحدة وحدة.

## قبل البدء، جهّز هذي القيم

1. **Telegram Bot Token** — من @BotFather.
2. **ENCRYPTION_KEY** — نص من 64 حرف hex. ولّده بأي طريقة:
   - على جهاز فيه `openssl`: `openssl rand -hex 32`
   - أو بـ PowerShell (ويندوز):
     ```powershell
     $b = New-Object byte[] 32
     (New-Object System.Security.Cryptography.RNGCryptoServiceProvider).GetBytes($b)
     -join ($b | ForEach-Object { $_.ToString('x2') })
     ```
   **احفظ هذي القيمة** — بتحتاجها 3 مرات (بالخطوة أدناه).
3. بريد وكلمة مرور تختارهم لحساب الأدمن الأول (`SEED_ADMIN_EMAIL` / `SEED_ADMIN_PASSWORD`).

## خطوات النشر

1. سجّل دخول على **dashboard.render.com**.
2. اضغط **New +** ← **Blueprint**.
3. اربط حساب GitHub واختر مستودع `Ahmedmutlag/Instagram-bot`.
4. Render بيقرأ `render.yaml` تلقائياً ويعرض لك الخدمات الست اللي راح ينشئها.
5. بيطلب منك تعبّي القيم اللي علّمناها `sync: false` — عبّيها كذا:

   | الخدمة | المتغير | القيمة |
   |---|---|---|
   | smm-api | `TELEGRAM_BOT_TOKEN` | التوكن حقك |
   | smm-api | `ENCRYPTION_KEY` | نفس المفتاح اللي ولّدته |
   | smm-api | `SEED_ADMIN_EMAIL` | بريدك |
   | smm-api | `SEED_ADMIN_PASSWORD` | كلمة مرور قوية |
   | smm-bot | `TELEGRAM_BOT_TOKEN` | **نفس** التوكن أعلاه |
   | smm-bot | `ENCRYPTION_KEY` | **نفس** المفتاح أعلاه بالضبط |
   | smm-worker | `TELEGRAM_BOT_TOKEN` | **نفس** التوكن أعلاه |
   | smm-worker | `ENCRYPTION_KEY` | **نفس** المفتاح أعلاه بالضبط |

6. اضغط **Apply** / **Create New Resources**. Render بيبني وينشر الخدمات الست (ياخذ عدة دقائق).

## بعد أول نشر — خطوة تصحيح مهمة

الملف يحط قيمة مبدئية مبنية على تخمين اسم الخدمة لـ:
- `ADMIN_CORS_ORIGIN` بخدمات (`smm-api`, `smm-bot`, `smm-worker`)
- `NEXT_PUBLIC_API_BASE_URL` بخدمة `smm-admin`

بعد ما تخلص كل الخدمات النشر، تأكد من الروابط الفعلية:

1. افتح خدمة **smm-admin** بلوحة Render، انسخ رابطها الحقيقي (مثلاً `https://smm-admin-xxxx.onrender.com`).
2. افتح خدمة **smm-api**، انسخ رابطها الحقيقي.
3. لو الروابط الفعلية تختلف عن التخمين (`smm-admin.onrender.com` / `smm-api.onrender.com`):
   - عدّل `ADMIN_CORS_ORIGIN` بخدمات smm-api/smm-bot/smm-worker للرابط الحقيقي لـ smm-admin.
   - عدّل `NEXT_PUBLIC_API_BASE_URL` بخدمة smm-admin للرابط الحقيقي لـ smm-api + `/api/v1`.
   - بعد أي تعديل بـ `NEXT_PUBLIC_API_BASE_URL` تحديداً، لازم تعمل **Manual Deploy** لخدمة smm-admin من جديد (لأنه يُبنى داخل الكود وقت البناء، مو وقت التشغيل).

## التحقق

- افتح رابط smm-admin وسجّل دخول بالبريد وكلمة المرور اللي حطيتهم بـ `SEED_ADMIN_EMAIL`/`SEED_ADMIN_PASSWORD`.
- افتح تيليجرام وأرسل `/start` للبوت — يفترض يرد فوراً.
- من صفحة **Logs** لأي خدمة بلوحة Render تقدر تتابع أي خطأ لحظياً، بنفس طريقة `docker compose logs` اللي استخدمناها محلياً.

إذا طلعت أي رسالة خطأ أثناء النشر، انسخها أو أرسل لقطة شاشة وأكمل معك تصحيحها فوراً.
