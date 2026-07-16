# 🚀 دليل النشر على Render (خطوة بخطوة — بدون كود)

هذا الدليل يوصّلك من "مشروع على جهازك" إلى "منصة شغّالة 24/7 على النت".
الاستضافة على **Render** مجانية (أو $7/شهر لو تبي بدون نوم).

---

## الخطوة 1: GitHub (خزّن المشروع)
1. روح https://github.com وادخل (أو سجّل).
2. اضغط **New** (زر أخضر فوق يسار) → اسم الريبو: `wasilah-wa`
3. خليه **Public** ← اضغط **Create repository**.
4. في الصفحة الجديدة، تحت "…or push an existing repository"، انسخ السطرين اللي فيهم `git remote add origin ...` (بتحتاجهم تحت).

## الخطوة 2: ارفع المشروع من جهازك
افتح الطرفية (Terminal) عندك واكتب بالترتيب:
```bash
cd C:/Users/shadi/wa-selfhost
git init
git add .
git commit -m "وسيلة v1 - منصة واتساب multi-tenant"
git branch -M main
git remote add origin https://github.com/<اسمك>/wasilah-wa.git
git push -u origin main
```
(استبدل `<اسمك>` بيوزرنام حسابك في GitHub)

## الخطوة 3: Render (الاستضافة)
1. روح https://render.com واضغط **Sign Up** وادخل بحساب GitHub.
2. بعد الدخول اضغط **New** ← **Blueprint**.
3. اختر ريبو `wasilah-wa` ← اضغط **Connect**.
4. Render بيقرأ ملف `render.yaml` تلقائياً ويجهز الخدمة.
5. اضغط **Deploy** وانتظر 1–2 دقيقة.
6. راح يعطيك رابط مثل: `https://wasilah-wa.onrender.com`

## الخطوة 4: ميتا (ربط الواتساب)
1. روح https://developers.facebook.com ← تطبيق جديد ← نوع **Business**.
2. من القائمة اليسار اختر **WhatsApp** ← اضغط **Setup**.
3. في صفحة API Setup انسخ:
   - **Temporary access token** = هذا الـ WA_TOKEN
   - **Phone number ID** = هذا الـ PHONE_ID
   - تأكد إن الرقم (ازرار واتساب بزنس) مضاف.
4. شغّل السيرفر (على Render الرابط صار جاهز) وادخل على:
   `https://<رابطك>.onrender.com/admin`
5. أضف عميل:
   - id: halat
   - name: هالات
   - phoneId: <الـ PHONE_ID>
   - waToken: <التوكن>
   - flow: halat
6. رجع لميتا ← في نفس صفحة WhatsApp ← قسم **Configuration**:
   - Callback URL: `https://<رابطك>.onrender.com/webhook`
   - Verify token: اكتب أي نص (نفس اللي بتحطه في VERIFY_TOKEN)
   - اضغط **Verify** ← اشترك في **messages**

## الخطوة 5: جرّب
من جوالك ابعث رسالة للرقم البزنس ← لازم ترد أتمتة هالات.
روح `https://<رابطك>.onrender.com/admin` ← تشوف المحادثة في الـ inbox.

---

## 💡 ملاحظة مهمة (البيانات)
العملاء والرسائل تتحفظ في `data/` على السيرفر. على Render المجاني
القرص يتصفّر عند إعادة النشر. للإنتاج:
- إما تستخدم **Render Disk** (مدفوع بسيط)،
- أو ننقل الحفظ لـ **Supabase** (مجاني) لاحقاً.

## 🔧 تعديل VERIFY_TOKEN
الافتراضي `wasilah_verify_123`. تقدر تغيره من إعدادات Environment في Render
(متغير `VERIFY_TOKEN`) قبل ما تفعل الويب هوك.
