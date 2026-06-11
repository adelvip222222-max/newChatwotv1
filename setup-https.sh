#!/bin/bash
set -e

EMAIL="${1:-admin@dent-ix.app}"
DOMAIN="dent-ix.app"
WWW_DOMAIN="www.dent-ix.app"

echo "🚀 إعداد شامل لـ dent-ix.app على HTTPS"
echo "========================================"
echo ""

# 1️⃣ إيقاف Nginx مؤقتاً
echo "1️⃣  إيقاف Nginx مؤقتاً (لإصدار شهادة SSL)..."
systemctl stop nginx 2>/dev/null || true
sleep 2

# 2️⃣ تثبيت Certbot
echo "2️⃣  تثبيت Certbot..."
apt-get update -qq
apt-get install -y -qq certbot python3-certbot-nginx > /dev/null 2>&1

# 3️⃣ إصدار شهادة SSL
echo "3️⃣  إصدار شهادة SSL من Let's Encrypt..."
echo "  البريد: $EMAIL"
echo "  النطاق: $DOMAIN, $WWW_DOMAIN"
echo ""

certbot certonly \
  --standalone \
  -d "$DOMAIN" \
  -d "$WWW_DOMAIN" \
  --email "$EMAIL" \
  --agree-tos \
  --non-interactive \
  --expand 2>&1 | tail -5

# 4️⃣ التحقق من الشهادة
echo ""
echo "4️⃣  التحقق من الشهادة..."
if [ -f "/etc/letsencrypt/live/$DOMAIN/fullchain.pem" ]; then
  echo "✅ شهادة SSL موجودة"
else
  echo "❌ فشل إصدار الشهادة!"
  exit 1
fi

# 5️⃣ إعادة إنشاء إعدادات Nginx
echo ""
echo "5️⃣  إنشاء إعدادات Nginx..."
mkdir -p /etc/nginx/sites-available
rm -f /etc/nginx/sites-available/dent-ix.app
rm -f /etc/nginx/sites-enabled/default

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

ln -sf /etc/nginx/sites-available/dent-ix.app /etc/nginx/sites-enabled/dent-ix.app

# 6️⃣ اختبار إعدادات Nginx
echo "6️⃣  اختبار إعدادات Nginx..."
if nginx -t 2>&1 | grep -q "successful"; then
  echo "✅ إعدادات Nginx صحيحة"
else
  echo "❌ خطأ في إعدادات Nginx!"
  nginx -t
  exit 1
fi

# 7️⃣ تشغيل Nginx
echo "7️⃣  تشغيل Nginx..."
systemctl start nginx
systemctl enable nginx
sleep 2

# 8️⃣ اختبار الاتصالات
echo ""
echo "8️⃣  اختبار الاتصالات..."
echo ""

echo "📊 HTTP (يجب أن ينقل إلى HTTPS):"
curl -I -L http://dent-ix.app 2>/dev/null | head -1

echo ""
echo "🔐 HTTPS (يجب أن يعمل):"
curl -I https://dent-ix.app 2>/dev/null | head -1

echo ""
echo "✅ تم الإعداد بنجاح!"
echo ""
echo "🔗 الرابط: https://dent-ix.app"
echo ""
echo "📋 أوامر مفيدة:"
echo "  pm2 status                 # حالة التطبيق"
echo "  pm2 logs chatzi-web        # السجلات"
echo "  curl https://dent-ix.app   # اختبار"
