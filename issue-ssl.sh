#!/bin/bash
set -e

EMAIL="${1:-admin@dent-ix.app}"
DOMAIN="dent-ix.app"
WWW_DOMAIN="www.dent-ix.app"

echo "🔐 إصدار شهادة SSL من Let's Encrypt"
echo "===================================="
echo ""

# 1️⃣ اختبر أن النطاق يشير إلى الخادم
echo "1️⃣  اختبار الاتصال بالنطاق..."
if curl -s -I http://$DOMAIN 2>/dev/null | grep -q "nginx"; then
  echo "✅ الدومين يشير إلى الخادم بشكل صحيح"
else
  echo "⚠️  تحذير: قد لا يكون الدومين مشيراً للخادم بعد"
fi

# 2️⃣ تثبيت certbot
echo ""
echo "2️⃣  تثبيت certbot..."
apt-get update -qq
apt-get install -y -qq certbot python3-certbot-nginx > /dev/null 2>&1
echo "✅ تم التثبيت"

# 3️⃣ إصدار شهادة
echo ""
echo "3️⃣  إصدار شهادة SSL..."
echo "البريد الإلكتروني: $EMAIL"
echo "الدومين: $DOMAIN, $WWW_DOMAIN"
echo ""

certbot certonly \
  --standalone \
  -d "$DOMAIN" \
  -d "$WWW_DOMAIN" \
  --email "$EMAIL" \
  --agree-tos \
  --non-interactive \
  --force-renewal 2>&1 | grep -E "Successfully|Congratulations|Certificate" || echo "تم معالجة الطلب"

# 4️⃣ التحقق من وجود الشهادة
echo ""
echo "4️⃣  التحقق من الشهادة..."
if [ -f "/etc/letsencrypt/live/$DOMAIN/fullchain.pem" ]; then
  echo "✅ شهادة SSL موجودة"
  ls -la /etc/letsencrypt/live/$DOMAIN/
else
  echo "❌ فشل إصدار الشهادة"
  exit 1
fi

echo ""
echo "✅ تم إصدار الشهادة بنجاح!"
