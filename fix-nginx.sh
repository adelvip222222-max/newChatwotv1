#!/bin/bash
set -e

echo "🔧 إصلاح مشكلة dent-ix.app"
echo "================================"
echo ""

# 1️⃣ التأكد من أن التطبيق يعمل
echo "1️⃣  التحقق من حالة التطبيق..."
pm2 status

# اذا لم يكن التطبيق يعمل، ابدأه
if ! pm2 list | grep -q "chatzi-web"; then
  echo "⚠️  التطبيق لم يكن يعمل، جاري البدء..."
  cd /opt/chatzi/app
  pm2 start ecosystem.config.js --env production
fi

# 2️⃣ اختبر الاتصال بـ port 3000
echo ""
echo "2️⃣  اختبار localhost:3000..."
if curl -s -I http://127.0.0.1:3000 | grep -q "HTTP"; then
  echo "✅ التطبيق يستجيب على localhost:3000"
else
  echo "❌ التطبيق لا يستجيب على localhost:3000"
  echo "السجلات:"
  pm2 logs chatzi-web --nostream --lines 20
  exit 1
fi

# 3️⃣ تعطيل الصفحة الافتراضية
echo ""
echo "3️⃣  تعطيل الموقع الافتراضي..."
rm -f /etc/nginx/sites-enabled/default

# 4️⃣ التأكد من وجود إعدادات Nginx
echo "4️⃣  إعادة إنشاء إعدادات Nginx..."
mkdir -p /etc/nginx/sites-available

cat > /etc/nginx/sites-available/dent-ix.app <<'NGINX_CONFIG'
upstream nextjs_app {
    server 127.0.0.1:3000;
}

server {
    listen 80;
    listen [::]:80;
    server_name dent-ix.app www.dent-ix.app;
    
    location / {
        return 301 https://$host$request_uri;
    }
}

server {
    listen 443 ssl http2;
    listen [::]:443 ssl http2;
    server_name dent-ix.app www.dent-ix.app;

    ssl_certificate /etc/letsencrypt/live/dent-ix.app/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/dent-ix.app/privkey.pem;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;
    ssl_prefer_server_ciphers on;

    location / {
        proxy_pass http://nextjs_app;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}
NGINX_CONFIG

# 5️⃣ تفعيل الموقع
echo "5️⃣  تفعيل إعدادات dent-ix.app..."
ln -sf /etc/nginx/sites-available/dent-ix.app /etc/nginx/sites-enabled/dent-ix.app

# 6️⃣ اختبار إعدادات Nginx
echo "6️⃣  اختبار إعدادات Nginx..."
nginx -t || {
  echo "❌ خطأ في إعدادات Nginx!"
  exit 1
}

# 7️⃣ إعادة تحميل Nginx
echo "7️⃣  إعادة تحميل Nginx..."
systemctl reload nginx

echo ""
echo "✅ تم الإصلاح بنجاح!"
echo ""
echo "الآن اختبر:"
echo "  curl -I http://dent-ix.app"
echo "  curl -I https://dent-ix.app"
