import { Tenant, User } from "@/lib/models";
import { connectToDatabase } from "@/lib/mongodb";

export const TENANT_USER_LIMITS = {
  admin: 2,
  agent: 2
} as const;

export async function getAdminUsersData(tenantId: string) {
  await connectToDatabase();
  const [tenant, users] = await Promise.all([
    Tenant.findById(tenantId).lean(),
    User.find({ tenantId }).sort({ role: 1, createdAt: 1 }).lean()
  ]);
  const admins = users.filter((user) => user.role === "admin").length;
  const agents = users.filter((user) => user.role === "agent").length;

  return {
    ownerId: tenant?.ownerId?.toString() || "",
    limits: {
      admin: TENANT_USER_LIMITS.admin,
      agent: TENANT_USER_LIMITS.agent
    },
    usage: { admin: admins, agent: agents },
    users: users.map((user) => ({
      id: user._id.toString(),
      name: user.name,
      email: user.email,
      role: user.role,
      ownerId: user.ownerId?.toString() || tenant?.ownerId?.toString() || "",
      isActive: user.isActive !== false,
      createdAt: user.createdAt?.toISOString() || ""
    }))
  };
}

