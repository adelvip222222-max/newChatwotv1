#!/bin/bash

echo "🔍 تشخيص مشكلة dent-ix.app"
echo "================================"
echo ""

# 1️⃣ فحص حالة PM2
echo "1️⃣  حالة PM2:"
pm2 status
echo ""

# 2️⃣ فحص الاتصال بـ port 3000 محلياً
echo "2️⃣  اختبار localhost:3000:"
curl -I http://127.0.0.1:3000 2>/dev/null | head -5 || echo "❌ لا يوجد رد من localhost:3000"
echo ""

# 3️⃣ عرض إعدادات Nginx المفعلة
echo "3️⃣  الموقع المفعل في Nginx:"
ls -la /etc/nginx/sites-enabled/ | grep -v total
echo ""

# 4️⃣ فحص إعدادات Nginx لـ dent-ix.app
echo "4️⃣  محتوى إعدادات Nginx:"
if [ -f /etc/nginx/sites-available/dent-ix.app ]; then
  echo "✅ الملف موجود: /etc/nginx/sites-available/dent-ix.app"
  grep -A 5 "upstream\|proxy_pass\|server_name" /etc/nginx/sites-available/dent-ix.app | head -20
else
  echo "❌ الملف غير موجود: /etc/nginx/sites-available/dent-ix.app"
fi
echo ""

# 5️⃣ التحقق من صفحة Nginx الافتراضية
echo "5️⃣  الملفات الافتراضية المرسلة:"
ls -la /var/www/html/ 2>/dev/null | head -10 || echo "❌ /var/www/html غير موجود"
echo ""

# 6️⃣ فحص سجلات الأخطاء
echo "6️⃣  سجلات Nginx الأخيرة:"
tail -10 /var/log/nginx/error.log 2>/dev/null || echo "❌ لا توجد أخطاء مسجلة"
echo ""

# 7️⃣ حالة Nginx
echo "7️⃣  حالة Nginx:"
systemctl status nginx --no-pager 2>/dev/null | head -10
echo ""

# 8️⃣ سجلات PM2
echo "8️⃣  سجلات التطبيق (آخر 5 أسطر):"
pm2 logs --nostream --lines 5 2>/dev/null | tail -10
