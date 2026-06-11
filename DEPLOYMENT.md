# 🚀 إرشادات النشر على dent-ix.app

## ⚠️ المتطلبات المسبقة

تأكد من أن:
1. **النطاق يشير إلى الخادم**: تحقق من DNS settings لـ `dent-ix.app` و `www.dent-ix.app` ليشيروا إلى IP الخادم `134.209.224.148`
   - قد يستغرق انتشار DNS من 1-48 ساعة

2. **الملفات المطلوبة موجودة**:
   - `.env.production` ✅ (تم إنشاؤه بالفعل)
   - `deploy.sh` ✅ (تم إنشاؤه بالفعل)

## 📝 الخطوات

### الخطوة 1: تحضير الخادم
```bash
# تسجيل الدخول إلى الخادم
ssh root@134.209.224.148

# أو إذا كنت بالفعل على الخادم
cd /opt/chatzi/app
```

### الخطوة 2: التحقق من .env.production
تأكد من أن القيم الصحيحة موجودة:
```bash
cat .env.production
```

يجب أن تشمل:
- ✅ `NEXTAUTH_URL=https://dent-ix.app`
- ✅ `MONGODB_URI=mongodb://127.0.0.1:27017/chatzi`
- ✅ `REDIS_URL=redis://127.0.0.1:6379`
- ✅ `NEXTAUTH_SECRET=uUoOqw2G7kM+uUoOqw2G7kM+uUoOqw2G7kM=`

### الخطوة 3: تشغيل سكريبت النشر
```bash
sudo bash deploy.sh your-email@example.com
```

استبدل `your-email@example.com` ببريدك الإلكتروني الفعلي (سيُستخدم لتنبيهات تجديد SSL).

### الخطوة 4: الانتظار
- تثبيت المكتبات: ~2-3 دقائق
- بناء التطبيق: ~5-10 دقائق
- إصدار شهادة SSL: ~1 دقيقة

### الخطوة 5: التحقق
بعد انتهاء السكريبت:

```bash
# التحقق من حالة التطبيق
pm2 status

# عرض السجلات
pm2 logs chatzi-web

# اختبار الاتصال
curl https://dent-ix.app
```

## ✅ النتيجة المتوقعة

بعد التنفيذ الناجح، يجب أن يكون:
- ✨ التطبيق متاح على: **https://dent-ix.app**
- 🔐 شهادة SSL صحيحة (من Let's Encrypt)
- 🚀 التطبيق يعمل عبر PM2
- 🔄 Nginx يعمل كـ reverse proxy

## 🔧 استكشاف الأخطاء

### المشكلة: اتصال SSL فاشل
```bash
# تحقق من شهادة SSL
certbot certificates

# جدد الشهادة
sudo certbot renew
```

### المشكلة: التطبيق لا يستجيب
```bash
# تحقق من حالة PM2
pm2 status
pm2 logs chatzi-web

# أعد تشغيل التطبيق
pm2 restart all
```

### المشكلة: Nginx لا يعمل
```bash
# اختبر الإعدادات
nginx -t

# عرض الأخطاء
systemctl status nginx
```

## 📞 للمساعدة
إذا واجهت مشاكل:
1. اعرض السجلات: `pm2 logs`
2. تحقق من إعدادات DNS
3. جرب `curl -v https://dent-ix.app` للتشخيص
