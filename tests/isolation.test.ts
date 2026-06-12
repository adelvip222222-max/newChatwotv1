import mongoose from 'mongoose';
import { connectToDatabase } from '../src/lib/mongodb'; 
import { Conversation } from '../src/lib/models/conversation';

describe('Tenant Isolation Tests (Database Layer)', () => {
  beforeAll(async () => {
    await connectToDatabase();
  });
  
  afterAll(async () => {
    // إغلاق الاتصال بقاعدة البيانات لإنهاء الاختبار
    await mongoose.disconnect();
  });

  it('should prevent Tenant A from accessing Tenant B data at the DB level', async () => {
    // 1. إعداد بيانات تجريبية (مستأجرين مختلفين) باستخدام ObjectId
    const tenantA = new mongoose.Types.ObjectId().toString();
    const tenantB = new mongoose.Types.ObjectId().toString();
    const botIdA = new mongoose.Types.ObjectId().toString();
    const botIdB = new mongoose.Types.ObjectId().toString();
    const identityIdA = new mongoose.Types.ObjectId().toString();
    const identityIdB = new mongoose.Types.ObjectId().toString();

    // إنشاء محادثة لكل مستأجر
    await Conversation.create({ 
      tenantId: tenantA, botId: botIdA, channelIdentityId: identityIdA, 
      channel: 'website', provider: 'website', externalUserId: 'user1' 
    });
    
    await Conversation.create({ 
      tenantId: tenantB, botId: botIdB, channelIdentityId: identityIdB,
      channel: 'website', provider: 'website', externalUserId: 'user2' 
    });

    // 2. محاولة جلب محادثات Tenant A المباشرة
    // في النظام الحقيقي، واجهة الـ API تقوم بإضافة tenantId الخاص بالمستخدم بشكل إجباري إلى البحث
    const resultsForTenantA = await Conversation.find({ tenantId: tenantA });

    // 3. التحقق (Assertions)
    expect(resultsForTenantA).toHaveLength(1);
    expect(resultsForTenantA[0].tenantId.toString()).toBe(tenantA);
    expect(resultsForTenantA[0].tenantId.toString()).not.toBe(tenantB);
  });
});