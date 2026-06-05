import bcrypt from "bcryptjs";
import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/lib/authz";
import { Tenant, User } from "@/lib/models";
import { connectToDatabase } from "@/lib/mongodb";
import { TENANT_USER_LIMITS } from "@/lib/user-admin";

const schema = z.object({
  name: z.string().min(2),
  email: z.string().email(),
  password: z.string().min(8),
  role: z.enum(["admin", "agent"])
});

export async function POST(request: Request) {
  try {
    const session = await requireAdmin();
    const body = schema.parse(await request.json());
    await connectToDatabase();

    const email = body.email.toLowerCase().trim();
    const exists = await User.exists({ email });
    if (exists) {
      return NextResponse.json({ error: "البريد الإلكتروني مستخدم بالفعل." }, { status: 409 });
    }

    const count = await User.countDocuments({
      tenantId: session.user.tenantId,
      role: body.role
    });
    const limit = body.role === "admin" ? TENANT_USER_LIMITS.admin : TENANT_USER_LIMITS.agent;
    if (count >= limit) {
      return NextResponse.json(
        { error: body.role === "admin" ? "تم الوصول إلى حد 2 مدير." : "تم الوصول إلى حد 2 موظف." },
        { status: 403 }
      );
    }

    const tenant = await Tenant.findOne({ _id: session.user.tenantId, isActive: true });
    if (!tenant) return NextResponse.json({ error: "المستأجر غير موجود أو غير مفعل." }, { status: 404 });

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
    const message = error instanceof Error ? error.message : "تعذر إضافة المستخدم.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
