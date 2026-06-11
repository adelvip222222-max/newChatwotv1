const mongoose = require("mongoose");
const uri = process.env.MONGODB_URI;

async function updateUser() {
  try {
    if (!uri) {
      throw new Error("MONGODB_URI is required.");
    }

    await mongoose.connect(uri);
    console.log("✅ Connected to database.");
    
    const db = mongoose.connection.db;

    const result = await db.collection("users").updateOne(
      { _id: new mongoose.Types.ObjectId("6a2587e497a2f9e19f1f1b80") },
      { $set: { role: "admin" } }
    );

    if (result.matchedCount > 0) {
      console.log(`✅ User role updated to admin successfully. Modified: ${result.modifiedCount}`);
    } else {
      console.log("❌ User not found.");
    }

  } catch (error) {
    console.error("Error updating user:", error);
  } finally {
    await mongoose.disconnect();
    process.exit(0);
  }
}

updateUser();
