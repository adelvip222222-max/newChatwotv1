import { requireSession } from "@/lib/auth";

export function isAdminRole(role?: string | null) {
  return role === "owner" || role === "admin";
}

export async function requireAdmin() {
  const session = await requireSession();
  if (!isAdminRole(session.user.role)) {
    throw new Error("Admin access is required.");
  }
  return session;
}

