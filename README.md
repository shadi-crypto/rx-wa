# وسيلة — منصة أتمتة واتساب متعددة العملاء

منصة مفتوحة المصدر (ملكك 100%) تربط **WhatsApp Cloud API الرسمي من ميتا** —
آمنة تماماً (صفر خطر حظر)، وتدعم عدة عملاء (multi-tenant) كل واحد برقمه الخاص.

## المميزات
- ✅ رسمي ومعتمد من ميتا — بدون خطر حظر
- ✅ multi-tenant: تبيع لعدة عملاء من منصة وحدة
- ✅ كل عميل بأتمتة مخصصة (هالات / عام / مطعم / عيادة...)
- ✅ لوحة إدارة + inbox (ترى المحادثات بدون كود)
- ✅ مجاني — بس تدفع استضافة رخيصة (~$5-7/شهر)

## التشغيل المحلي
```bash
npm install
cp .env.example .env   # عبّي VERIFY_TOKEN (أي نص)
node server.js
# افتح: http://localhost:3000/admin
```

## ربط أول عميل (ميتا)
1. روح https://developers.facebook.com → إنشاء تطبيق → نوع Business
2. من اليسار اختر **WhatsApp** → اضغط **Setup**
3. في صفحة API Setup:
   - انسخ **Temporary access token** (التوكن)
   - انسخ **Phone number ID**
   - تأكد الرقم مضاف (أو أضف رقم واتساب بزنس)
4. شغّل السيرفر وافتح `/admin`، أضف عميل:
   - id: halat
   - name: هالات
   - phoneId: <الـ Phone number ID>
   - waToken: <التوكن>
   - flow: halat
5. فعّل الـ webhook في ميتا:
   - Callback URL: https://<رابطك>/webhook
   - Verify token: نفس اللي في .env
   - اشترك في **messages**

## النشر على Render (24/7)
1. ارفع المشروع على GitHub
2. في Render: New → Blueprint → اختر الريبو (يقرأ render.yaml)
3. بعد النشر، ادخل على /admin وضيف العملاء
4. حدّث الـ webhook بميتا بالرابط الجديد

## ملاحظة الاستمرارية
العملاء والرسائل تُحفظ في مجلد `data/`. على Render المجاني قد يُمسح
عند إعادة النشر — للإنتاج استخدم Disk دائم أو قاعدة بيانات (Postgres/Supabase).
