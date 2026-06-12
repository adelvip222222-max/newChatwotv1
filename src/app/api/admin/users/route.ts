import bcrypt from "bcryptjs";
import { NextResponse } from "next/server";
import { z } from "zod";
import { requireSuperAdmin } from "@/server/auth/guards";
import { Tenant, User } from "@/lib/models";
import { connectToDatabase } from "@/lib/mongodb";
import { TENANT_USER_LIMITS } from "@/lib/user-admin";
const tenantEditableRoles = ["admin", "manager", "agent", "viewer"] as const;

const schema = z.object({
  name: z.string().min(2).max(120),
  email: z.string().email().max(180),
  password: z.string().min(12).max(128).regex(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).+$/, "Password must include uppercase, lowercase, and a number."),
  role: z.enum(tenantEditableRoles)
});

export async function POST(request: Request) {
  try {
    const session = await requireSuperAdmin();
    const body = schema.parse(await request.json());
    await connectToDatabase();

    const email = body.email.toLowerCase().trim();
    const tenant = await Tenant.findOne({ _id: session.user.tenantId, isActive: true });
    if (!tenant) {
      return NextResponse.json({ error: "Tenant was not found or is inactive." }, { status: 404 });
    }

    const exists = await User.exists({ tenantId: tenant._id, email });
    if (exists) {
      return NextResponse.json({ error: "Email is already used in this tenant." }, { status: 409 });
    }

    const count = await User.countDocuments({
      tenantId: tenant._id,
      role: body.role
    });
    const limit = TENANT_USER_LIMITS[body.role];
    if (count >= limit) {
      return NextResponse.json({ error: "User limit reached for this role." }, { status: 403 });
    }

    const user = await User.create({
      name: body.name,
      email,
      password: await bcrypt.hash(body.password, 12),
      role: body.role,
      tenantId: tenant._id,
      ownerId: tenant.ownerId,
      isActive: true
    });

    return NextResponse.json({ id: user._id.toString() });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to add user.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
