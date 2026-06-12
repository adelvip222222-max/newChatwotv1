import { NextResponse } from "next/server";
import { z } from "zod";
import { requireSuperAdmin } from "@/server/auth/guards";
import { User } from "@/lib/models";
import { connectToDatabase } from "@/lib/mongodb";
import { TENANT_USER_LIMITS } from "@/lib/user-admin";
const tenantEditableRoles = ["admin", "manager", "agent", "viewer"] as const;

const schema = z.object({
  isActive: z.boolean().optional(),
  role: z.enum(tenantEditableRoles).optional()
});

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireSuperAdmin();
    const { id } = await params;
    const body = schema.parse(await request.json());
    await connectToDatabase();

    const target = await User.findOne({ _id: id, tenantId: session.user.tenantId });
    if (!target) {
      return NextResponse.json({ error: "User was not found." }, { status: 404 });
    }

    if (target.role === "owner") {
      return NextResponse.json({ error: "Owner users cannot be modified here." }, { status: 403 });
    }

    if (body.role && body.role !== target.role) {
      const count = await User.countDocuments({
        tenantId: session.user.tenantId,
        role: body.role
      });
      const limit = TENANT_USER_LIMITS[body.role];
      if (count >= limit) {
        return NextResponse.json({ error: "User limit reached for this role." }, { status: 403 });
      }
      target.role = body.role;
    }

    if (typeof body.isActive === "boolean") {
      target.isActive = body.isActive;
    }

    await target.save();
    return NextResponse.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to update user.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
