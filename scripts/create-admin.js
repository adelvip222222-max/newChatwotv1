const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");

const uri = process.env.MONGODB_URI;

async function createAdmin() {
  try {
    if (!uri) {
      throw new Error("MONGODB_URI is required.");
    }

    await mongoose.connect(uri);
    console.log("✅ Connected to database.");

    const db = mongoose.connection.db;

    // Find first tenant
    const tenant = await db.collection("tenants").findOne({});
    if (!tenant) {
      console.error("❌ No Tenant found in the database. Please register an owner first.");
      process.exit(1);
    }

    const args = process.argv.slice(2);
    const email = args[0] || "manager@chatzi.local";
    const password = args[1] || "Manager123!";
    const role = args[2] || "admin"; // owner, admin, manager, agent, viewer

    const existingUser = await db.collection("users").findOne({ email });
    if (existingUser) {
      console.log(`ℹ️ User already exists with email: ${email}`);
      process.exit(0);
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const result = await db.collection("users").insertOne({
      name: `New ${role} User`,
      email: email,
      password: hashedPassword,
      role: role,
      tenantId: tenant._id,
      ownerId: tenant.ownerId,
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date()
    });

    console.log(`✅ User created successfully! ID: ${result.insertedId}`);
    console.log(`📧 Email: ${email}`);
    console.log(`🔑 Password: ${password}`);
    console.log(`🛡️ Role: ${role}`);

    process.exit(0);
  } catch (error) {
    console.error("❌ Error creating user:", error);
    process.exit(1);
  }
}

createAdmin();
