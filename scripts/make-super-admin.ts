#!/usr/bin/env ts-node
/**
 * Promote a user to Super Admin.
 *
 * Usage:
 *   npx ts-node -r tsconfig-paths/register scripts/make-super-admin.ts email@example.com
 *   OR uses SUPER_ADMIN_EMAIL env var if no argument provided.
 *
 * Requirements:
 *   - DATABASE_URL or MONGODB_URI must be set.
 *   - Run only from a trusted server environment. Never expose this script publicly.
 */

import { connectToDatabase } from "../src/lib/mongodb";
import { User } from "../src/lib/models/user";

async function main() {
  const email = process.argv[2] || process.env.SUPER_ADMIN_EMAIL;

  if (!email) {
    console.error("Error: Provide email as argument or set SUPER_ADMIN_EMAIL env var.");
    console.error("Usage: ts-node scripts/make-super-admin.ts email@example.com");
    process.exit(1);
  }

  const normalizedEmail = email.toLowerCase().trim();
  console.log(`Connecting to database…`);
  await connectToDatabase();

  const user = await User.findOne({ email: normalizedEmail });

  if (!user) {
    console.error(`Error: No user found with email: ${normalizedEmail}`);
    process.exit(1);
  }

  if ((user as any).isSuperAdmin === true) {
    console.log(`User ${normalizedEmail} is already a super admin. No changes made.`);
    process.exit(0);
  }

  await User.updateOne({ _id: user._id }, { $set: { isSuperAdmin: true } });

  console.log(`✅ User ${normalizedEmail} (id: ${user._id}) has been promoted to super admin.`);
  console.log("Note: The user must log out and log back in for the change to take effect.");
  process.exit(0);
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
