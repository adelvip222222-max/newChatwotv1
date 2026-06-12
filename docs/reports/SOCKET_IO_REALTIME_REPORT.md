# Socket.IO Realtime Upgrade Report

## الهدف

إضافة قناة اتصال دائمة لصفحة المحادثات والإشعارات باستخدام Socket.IO/WebSockets، بدون كسر منطق القنوات الحالي أو حذف SSE الموجود.

## ما تم تنفيذه

1. إضافة سيرفر Socket.IO مستقل يعمل بجانب Next.js على بورت داخلي افتراضي `4001`.
2. تشغيل السيرفر الجديد من PM2 باسم `chatzi-socket`.
3. ربط السيرفر بـ Redis Pub/Sub الحالي على نفس قنوات الأحداث الموجودة:
   - `inbox:<tenantId>:events`
4. عند وصول حدث من العمال أو الـ APIs إلى Redis، يقوم Socket.IO بإرساله فورًا لكل مستخدمي نفس الـ tenant المتصلين.
5. الواجهة `RealtimeBridge` أصبحت تبدأ بـ Socket.IO كخيار أول، وتعود تلقائيًا إلى SSE إذا لم يكن Socket.IO متاحًا.
6. تم الحفاظ على `/api/realtime/stream` و `/api/inbox/stream` كـ fallback آمن.
7. تم استخدام NextAuth JWT Cookies للتحقق من هوية مستخدم Socket.IO.
8. تم التحقق من أن المستخدم Active ويملك صلاحية `inbox.read` قبل السماح له بدخول قناة الـ tenant.

## الملفات المعدلة/المضافة

- `package.json`
  - إضافة `socket.io`
  - إضافة `socket.io-client`
  - إضافة script باسم `socket:server`

- `ecosystem.config.js`
  - إضافة PM2 app باسم `chatzi-socket`

- `server/socket-server.ts`
  - سيرفر Socket.IO مستقل
  - مصادقة NextAuth JWT
  - Rooms حسب tenant
  - Redis psubscribe على `inbox:*:events`
  - Health endpoint على `/health`

- `src/components/dashboard/realtime-bridge.tsx`
  - Socket.IO كـ transport أساسي
  - SSE fallback تلقائي
  - استمرار إرسال `chatzi:realtime-event` لباقي مكونات الواجهة بدون تغيير كبير

- `docs/deployment/NGINX_SOCKET_IO_SNIPPET.conf`
  - إعداد Nginx المطلوب لتمرير WebSocket Upgrade

## مسار الرسائل الجديد

```txt
Webhook / API / Worker
↓
MongoDB write
↓
publishRealtimeEvent(...)
↓
Redis channel: inbox:<tenantId>:events
↓
chatzi-socket process
↓
Socket.IO room: tenant:<tenantId>
↓
RealtimeBridge
↓
AIInboxClient updates list/detail immediately
```

## ملاحظات مهمة

- لم يتم حذف SSE. سيظل يعمل عند فشل Socket.IO أو عدم إعداد Nginx بعد.
- يجب إضافة إعداد Nginx الخاص بـ `/socket.io/` وإلا ستعمل الواجهة عبر SSE fallback فقط.
- Socket.IO process يجب أن يكون instance واحد حاليًا. عند التوسع لأكثر من instance يمكن إضافة `@socket.io/redis-adapter`.

## متغيرات اختيارية

يمكن تركها فارغة لأن لها قيم افتراضية، أو إضافتها في `.env.production` عند الحاجة:

```env
SOCKET_IO_PORT=4001
SOCKET_IO_PATH=/socket.io
SOCKET_IO_MAX_CONNECTIONS_PER_TENANT=500
SOCKET_IO_HEARTBEAT_MS=30000
```

## أوامر التشغيل

```bash
npm install --legacy-peer-deps --registry=https://registry.npmjs.org/
npm run build
pm2 reload ecosystem.config.js --update-env
pm2 status
pm2 logs chatzi-socket --lines 80
```

## اختبار داخلي على السيرفر

```bash
curl http://127.0.0.1:4001/health
```

## إعداد Nginx المطلوب

أضف محتوى الملف التالي داخل `server { listen 443 ssl ... }` قبل `location /`:

```txt
docs/deployment/NGINX_SOCKET_IO_SNIPPET.conf
```

ثم:

```bash
nginx -t
systemctl reload nginx
```

## النتيجة المتوقعة

- الرسائل الجديدة تظهر فورًا عبر اتصال دائم.
- تقليل الاعتماد على polling.
- تقليل تأخير ظهور المحادثة داخل Inbox.
- تحسين قابلية إضافة typing indicators وpresence لاحقًا.
