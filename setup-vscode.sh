#!/bin/bash
set -euo pipefail

EMAIL="${1:-admin@dent-ix.app}"
DOMAIN="vscode.dent-ix.app"
APP_DIR="/opt/chatzi/app"

if [[ "$(id -u)" -ne 0 ]]; then
  echo "هذا السكربت يجب تشغيله بصلاحيات root: sudo bash $0 your-email@example.com"
  exit 1
fi

echo "1) تثبيت code-server (إذا لم يكن مثبتاً)..."
if ! command -v code-server >/dev/null 2>&1; then
  curl -fsSL https://code-server.dev/install.sh | sh
else
  echo "code-server مثبت بالفعل"
fi

# إنشاء كلمة مرور عشوائية
PASSWORD_FILE="/etc/code-server-password"
if [[ -f "$PASSWORD_FILE" ]]; then
  PASSWORD=$(cat "$PASSWORD_FILE")
  echo "Password loaded from $PASSWORD_FILE"
else
  PASSWORD=$(openssl rand -base64 24)
  echo "$PASSWORD" > "$PASSWORD_FILE"
  chmod 600 "$PASSWORD_FILE"
  echo "Password saved to $PASSWORD_FILE"
fi

# إنشاء خدمة systemd لتشغيل code-server على localhost:8080
SERVICE_FILE="/etc/systemd/system/code-server-vscode.service"
cat > "$SERVICE_FILE" <<EOF
[Unit]
Description=code-server for vscode.dent-ix.app
After=network.target

[Service]
Type=simple
User=root
Environment=PASSWORD=${PASSWORD}
ExecStart=/usr/bin/code-server --bind-addr 127.0.0.1:8080 --auth password --password \${PASSWORD} --disable-telemetry
Restart=on-failure

[Install]
WantedBy=multi-user.target
EOF

systemctl daemon-reload
systemctl enable --now code-server-vscode.service
sleep 2

# إعداد Nginx
echo "2) إنشاء إعداد Nginx لـ $DOMAIN"
NGINX_CONF="/etc/nginx/sites-available/vscode.dent-ix.app"
cat > "$NGINX_CONF" <<'NGINX_EOF'
server {
    listen 80;
    listen [::]:80;
    server_name vscode.dent-ix.app;

    location / {
        return 301 https://$host$request_uri;
    }
}

server {
    listen 443 ssl http2;
    listen [::]:443 ssl http2;
    server_name vscode.dent-ix.app;

    ssl_certificate /etc/letsencrypt/live/vscode.dent-ix.app/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/vscode.dent-ix.app/privkey.pem;

    location / {
        proxy_pass http://127.0.0.1:8080/;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
NGINX_EOF

ln -sf "$NGINX_CONF" /etc/nginx/sites-enabled/vscode.dent-ix.app

# اختبار واصدار شهادة
echo "3) إصدار شهادة Let's Encrypt لـ $DOMAIN"
apt-get update -qq
apt-get install -y -qq certbot python3-certbot-nginx > /dev/null 2>&1 || true

# إذا لم توجد شهادة، نجرب إصدارها
if [[ ! -f "/etc/letsencrypt/live/$DOMAIN/fullchain.pem" ]]; then
  echo "إيقاف Nginx مؤقتاً لإصدار الشهادة (إذا لزم)..."
  systemctl stop nginx || true
  certbot certonly --standalone -d "$DOMAIN" --email "$EMAIL" --agree-tos --non-interactive || true
  systemctl start nginx || true
else
  echo "شهادة موجودة بالفعل لـ $DOMAIN"
fi

# إعادة تحميل Nginx
nginx -t
systemctl reload nginx

# النتيجة
echo ""
echo "--- انتهى الإعداد ---"
echo "URL: https://$DOMAIN"
echo "Password for code-server (also saved at /etc/code-server-password):"
cat /etc/code-server-password

echo "للدخول، افتح https://$DOMAIN واختر Password authentication"
