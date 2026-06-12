const mongoose = require('mongoose');

const uri = process.env.MONGODB_URI;

async function testConnection() {
  try {
    if (!uri) {
      throw new Error('MONGODB_URI is required.');
    }

    console.log('جاري محاولة الاتصال بـ MongoDB...');
    await mongoose.connect(uri);
    console.log('✅ تم الاتصال بقاعدة البيانات بنجاح!');
    process.exit(0);
  } catch (error) {
    console.error('❌ فشل الاتصال:', error.message);
    process.exit(1);
  }
}

testConnection();
