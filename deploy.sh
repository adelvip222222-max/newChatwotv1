#!/bin/bash
set -e

DOMAIN="dent-ix.app"
WWW_DOMAIN="www.dent-ix.app"
APP_DIR="/opt/chatzi/app"
ENV_FILE="${APP_DIR}/.env.production"

# التحقق من الصلاحيات
if [[ "$(id -u)" -ne 0 ]]; then
  echo "❌ هذا السكريبت يجب أن يُشغّل بصلاحيات root"
  echo "استخدم: sudo bash $0 <your-email@example.com>"
  exit 1
fi

if [[ $# -lt 1 ]]; then
  echo "❌ يجب تقديم بريد إلكتروني"
  echo "الاستخدام: sudo bash $0 your-email@example.com"
  exit 1
fi

EMAIL="$1"

echo "🔧 إعداد التطبيق للنشر على $DOMAIN"
echo ""

# 1️⃣ تثبيت البرامج المطلوبة
echo "📦 تثبيت nginx و certbot..."
apt-get update -qq
apt-get install -y -qq nginx certbot python3-certbot-nginx > /dev/null 2>&1

# 2️⃣ بناء التطبيق
echo "🔨 بناء التطبيق..."
cd "$APP_DIR"
npm install --silent > /dev/null 2>&1
npm run build

# 3️⃣ تشغيل التطبيق عبر PM2
echo "🚀 تشغيل التطبيق عبر PM2..."
npm install -g pm2 --silent > /dev/null 2>&1
pm2 stop all 2>/dev/null || true
pm2 delete all 2>/dev/null || true
pm2 start ecosystem.config.js --env production
pm2 save

# ضبط بدء PM2 تلقائياً
if id "$SUDO_USER" &>/dev/null; then
  su - "$SUDO_USER" -c "pm2 startup systemd -u $SUDO_USER --hp $(eval echo ~$SUDO_USER) > /dev/null 2>&1"
else
  pm2 startup systemd > /dev/null 2>&1
fi
pm2 save

# 4️⃣ إعداد Nginx
echo "🌐 إعداد Nginx كـ reverse proxy..."
mkdir -p /etc/nginx/sites-available /etc/nginx/sites-enabled

cat > /etc/nginx/sites-available/$DOMAIN <<'NGINX_EOF'
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
NGINX_EOF

# تفعيل الموقع
ln -sf /etc/nginx/sites-available/$DOMAIN /etc/nginx/sites-enabled/$DOMAIN 2>/dev/null || true
rm -f /etc/nginx/sites-enabled/default 2>/dev/null || true

# اختبار الإعدادات
nginx -t > /dev/null 2>&1 || {
  echo "❌ خطأ في إعدادات Nginx"
  nginx -t
  exit 1
}

# 5️⃣ إصدار شهادة SSL
echo "🔐 إصدار شهادة SSL من Let's Encrypt..."
certbot certonly \
  --nginx \
  -d "$DOMAIN" \
  -d "$WWW_DOMAIN" \
  --email "$EMAIL" \
  --agree-tos \
  --non-interactive \
  --expand \
  2>&1 | grep -E "Successfully|already|Congratulations" || true

# 6️⃣ إعادة تحميل Nginx
echo "🔄 إعادة تحميل Nginx..."
systemctl restart nginx

# 7️⃣ التحقق النهائي
echo ""
echo "✅ تم إعداد التطبيق بنجاح!"
echo ""
echo "📊 حالة التطبيقات:"
pm2 status
echo ""
echo "🌐 التطبيق متاح على:"
echo "   ✨ https://$DOMAIN"
echo ""
echo "📋 أوامر مفيدة:"
echo "   pm2 logs chatzi-web      # عرض سجلات التطبيق"
echo "   pm2 logs worker-ingress  # عرض سجلات العامل"
echo "   pm2 restart all          # إعادة تشغيل جميع العمليات"
echo "   pm2 stop all             # إيقاف جميع العمليات"
echo ""
echo "🔧 لتجديد شهادة SSL يدويا:"
echo "   sudo certbot renew"
