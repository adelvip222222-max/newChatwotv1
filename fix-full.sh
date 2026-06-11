#!/bin/bash
set -e

echo "🔧 إصلاح شامل لـ dent-ix.app"
echo "===================================="
echo ""

# 1️⃣ إيقاف التطبيق الحالي
echo "1️⃣  إيقاف التطبيق الحالي..."
pm2 stop all 2>/dev/null || true
pm2 delete all 2>/dev/null || true

# 2️⃣ إعادة بناء التطبيق
echo "2️⃣  إعادة بناء التطبيق..."
cd /opt/chatzi/app
npm install --force
npm run build

# 3️⃣ بدء التطبيق
echo "3️⃣  بدء التطبيق..."
pm2 start ecosystem.config.js --env production
pm2 logs chatzi-web --nostream --lines 10 | tail -5 || true
sleep 3

# 4️⃣ اختبر الاتصال بـ port 3000
echo ""
echo "4️⃣  اختبار localhost:3000..."
if curl -s http://127.0.0.1:3000 > /dev/null 2>&1; then
  echo "✅ التطبيق يستجيب على localhost:3000"
else
  echo "⚠️  قد لا يكون التطبيق جاهزاً بعد، جاري الانتظار..."
  sleep 5
fi

# 5️⃣ تعطيل الموقع الافتراضي
echo ""
echo "5️⃣  تعطيل الموقع الافتراضي..."
rm -f /etc/nginx/sites-enabled/default

# 6️⃣ إعادة إنشاء ملفات Nginx بالاسم الصحيح
echo "6️⃣  إعادة إنشاء إعدادات Nginx..."
rm -f /etc/nginx/sites-available/dent-ix.app.conf
rm -f /etc/nginx/sites-enabled/dent-ix.app.conf

cat > /etc/nginx/sites-available/dent-ix.app <<'NGINX_EOF'
upstream nextjs_app {
    server 127.0.0.1:3000 max_fails=3 fail_timeout=30s;
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

    # Gzip compression
    gzip on;
    gzip_vary on;
    gzip_types text/plain text/css text/xml text/javascript application/x-javascript application/xml+rss application/javascript;

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
        
        # Timeouts
        proxy_connect_timeout 60s;
        proxy_send_timeout 60s;
        proxy_read_timeout 60s;
    }
}
NGINX_EOF

# 7️⃣ تفعيل الموقع الجديد
echo "7️⃣  تفعيل الموقع..."
ln -sf /etc/nginx/sites-available/dent-ix.app /etc/nginx/sites-enabled/dent-ix.app

# 8️⃣ اختبار إعدادات Nginx
echo "8️⃣  اختبار إعدادات Nginx..."
if nginx -t 2>&1 | grep -q "successful"; then
  echo "✅ إعدادات Nginx صحيحة"
else
  echo "❌ خطأ في إعدادات Nginx!"
  nginx -t
  exit 1
fi

# 9️⃣ إعادة تحميل Nginx
echo "9️⃣  إعادة تحميل Nginx..."
systemctl reload nginx

echo ""
echo "✅ تم الإصلاح بنجاح!"
echo ""
echo "📊 حالة النظام:"
echo ""
echo "PM2 Status:"
pm2 status
echo ""
echo "Nginx Sites:"
ls -la /etc/nginx/sites-enabled/
echo ""
echo "🧪 اختبارات:"
echo "  HTTP:  curl -I http://dent-ix.app"
echo "  HTTPS: curl -I https://dent-ix.app"
echo "  Local: curl -I http://127.0.0.1:3000"
