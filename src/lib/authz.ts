import { connectToDatabase } from "@/lib/mongodb";
import { User } from "@/lib/models";
import { requireSession } from "@/lib/auth";

export function isAdminRole(role?: string | null) {
  return role === "super-admin" || role === "admin" || role === "owner";
}

export async function requireAdmin() {
  const session = await requireSession();
  if (!isAdminRole(session.user.role)) {
    throw new Error("Admin access is required.");
  }
  return session;
}

export async function requirePlatformAdmin() {
  const session = await requireSession();
  if (session.user.isSuperAdmin === true) {
    return session;
  }
  await connectToDatabase();
  const user = await User.findOne({ _id: session.user.id, isActive: true }).lean();
  if (!((user as any)?.isSuperAdmin === true || (user as any)?.role === "super-admin")) {
    throw new Error("Platform super-admin access is required.");
  }
  return session;
}
