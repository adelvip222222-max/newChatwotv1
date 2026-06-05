import { connectToDatabase } from "@/lib/mongodb";
import { Tenant, User, Bot, Conversation, Message } from "@/lib/models";

export type GlobalStats = {
  totalTenants: number;
  totalUsers: number;
  totalBots: number;
  totalConversations: number;
  totalMessages: number;
};

export type EmployeeData = {
  id: string;
  name: string;
  email: string;
  role: string;
};

export type TenantWithEmployees = {
  id: string;
  name: string;
  slug: string;
  plan: string;
  isActive: boolean;
  employees: EmployeeData[];
};

export async function getGlobalAnalytics(): Promise<GlobalStats> {
  await connectToDatabase();

  const [totalTenants, totalUsers, totalBots, totalConversations, totalMessages] = await Promise.all([
    Tenant.countDocuments(),
    User.countDocuments(),
    Bot.countDocuments(),
    Conversation.countDocuments(),
    Message.countDocuments()
  ]);

  return {
    totalTenants,
    totalUsers,
    totalBots,
    totalConversations,
    totalMessages
  };
}

export async function getTenantsWithEmployees(): Promise<TenantWithEmployees[]> {
  await connectToDatabase();

  const tenants = await Tenant.find().sort({ createdAt: -1 }).lean();
  const tenantIds = tenants.map((t) => t._id);

  // Find all users belonging to these tenants
  const users = await User.find({ tenantId: { $in: tenantIds } }).lean();

  const tenantsWithEmployees: TenantWithEmployees[] = tenants.map((tenant) => {
    // Filter users for this tenant
    const tenantUsers = users.filter((u) => u.tenantId?.toString() === tenant._id.toString());
    
    return {
      id: tenant._id.toString(),
      name: tenant.name,
      slug: tenant.slug,
      plan: tenant.plan,
      isActive: tenant.isActive,
      employees: tenantUsers.map((u) => ({
        id: u._id.toString(),
        name: u.name,
        email: u.email,
        role: u.role
      }))
    };
  });

  return tenantsWithEmployees;
}
