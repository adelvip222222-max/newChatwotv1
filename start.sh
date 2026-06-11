#!/bin/bash
set -e

cd /opt/chatzi/app

echo "📦 تثبيت المكتبات..."
npm install

echo "🔨 بناء التطبيق..."
npm run build

echo "🚀 تشغيل التطبيق عبر PM2..."
pm2 start ecosystem.config.js --env production
pm2 save

echo "✅ تم! التطبيق يعمل على http://134.209.224.148:3000"
echo ""
echo "📊 حالة التطبيق:"
pm2 status
echo ""
echo "📋 لعرض السجلات:"
echo "  pm2 logs chatzi-web"
echo "  pm2 logs worker-ingress"
