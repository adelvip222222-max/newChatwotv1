#!/usr/bin/env bash
set -euo pipefail

if [[ "$(id -u)" -ne 0 ]]; then
  echo "هذا السكربت يجب أن يُشغّل بصلاحيات الجذر (root)."
  echo "استخدم: sudo bash $0 <email-for-certbot>"
  exit 1
fi

if [[ $# -lt 1 ]]; then
  echo "Usage: sudo bash $0 <email-for-certbot>"
  exit 1
fi

EMAIL="$1"
APP_DIR="/opt/chatzi/app"
DOMAIN="dent-ix.app"
WWW_DOMAIN="www.dent-ix.app"
ENV_FILE="${APP_DIR}/.env.production"
NGINX_CONF="/etc/nginx/sites-available/${DOMAIN}.conf"
NGINX_ENABLED="/etc/nginx/sites-enabled/${DOMAIN}.conf"

if [[ ! -f "$ENV_FILE" ]]; then
  echo "ملف البيئة $ENV_FILE غير موجود."
  echo "انسخ .env.example إلى .env.production ثم اضف القيم اللازمة، بما في ذلك NEXTAUTH_URL=https://$DOMAIN"
  exit 1
fi

# تأكد من إعداد المتغير الخاص بـ NEXTAUTH_URL
if ! grep -q '^NEXTAUTH_URL=https://$DOMAIN' "$ENV_FILE"; then
  echo "NEXTAUTH_URL=https://$DOMAIN" >> "$ENV_FILE"
  echo "أضفت NEXTAUTH_URL=https://$DOMAIN إلى $ENV_FILE"
fi

apt update
apt install -y nginx certbot python3-certbot-nginx

cd "$APP_DIR"
npm install
npm run build

# تشغيل PM2
pm2 start ecosystem.config.js --env production || true
pm2 reload ecosystem.config.js --env production || true
pm2 save

# ضبط بدء PM2 تلقائياً بعد إعادة التشغيل
if [[ -n "${SUDO_USER:-}" ]]; then
  su - "$SUDO_USER" -c 'pm2 startup systemd -u "$SUDO_USER" --hp "$(eval echo ~$SUDO_USER)" && pm2 save' || true
else
  pm2 startup systemd || true
  pm2 save
fi

# إعداد Nginx
cat > "$NGINX_CONF" <<'EOF'
upstream nextjs_app {
    server 127.0.0.1:3000;
}

server {
    listen 80;
    listen [::]:80;
    server_name ${DOMAIN} ${WWW_DOMAIN};

    location / {
        return 301 https://$host$request_uri;
    }
}

server {
    listen 443 ssl http2;
    listen [::]:443 ssl http2;
    server_name ${DOMAIN} ${WWW_DOMAIN};

    ssl_certificate /etc/letsencrypt/live/${DOMAIN}/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/${DOMAIN}/privkey.pem;
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
EOF

ln -sf "$NGINX_CONF" "$NGINX_ENABLED"
nginx -t
systemctl restart nginx

# إصدار شهادة SSL
certbot --nginx -d "$DOMAIN" -d "$WWW_DOMAIN" --email "$EMAIL" --agree-tos --redirect --non-interactive

systemctl reload nginx

echo "تم إعداد التطبيق على https://$DOMAIN"
