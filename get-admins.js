const mongoose = require('mongoose');

const uri = process.env.MONGODB_URI;

const userSchema = new mongoose.Schema({}, { strict: false });
const User = mongoose.model('User', userSchema, 'users');

async function getAdmins() {
  try {
    if (!uri) {
      throw new Error("MONGODB_URI is required.");
    }

    await mongoose.connect(uri);
    const admins = await User.find({ role: { $in: ['admin', 'owner'] } }).lean();
    console.log("Admins and Owners in the database:");
    admins.forEach((admin, index) => {
      console.log(`\n${index + 1}. Name: ${admin.name}`);
      console.log(`   Email: ${admin.email}`);
      console.log(`   Role: ${admin.role}`);
      console.log(`   Active: ${admin.isActive}`);
      console.log(`   Tenant ID: ${admin.tenantId}`);
    });
    if (admins.length === 0) {
      console.log("No admins found in the database.");
    }
  } catch (error) {
    console.error("Error connecting to database:", error);
  } finally {
    await mongoose.disconnect();
  }
}

getAdmins();
