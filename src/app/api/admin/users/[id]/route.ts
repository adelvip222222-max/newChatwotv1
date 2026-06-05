import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/lib/authz";
import { User } from "@/lib/models";
import { connectToDatabase } from "@/lib/mongodb";
import { TENANT_USER_LIMITS } from "@/lib/user-admin";

const schema = z.object({
  isActive: z.boolean().optional(),
  role: z.enum(["admin", "agent"]).optional()
});

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireAdmin();
    const { id } = await params;
    const body = schema.parse(await request.json());
    await connectToDatabase();

    const target = await User.findOne({ _id: id, tenantId: session.user.tenantId });
    if (!target) return NextResponse.json({ error: "المستخدم غير موجود." }, { status: 404 });
    if (target.role === "owner") {
      return NextResponse.json({ error: "لا يمكن تعديل المشترك الرئيسي من هذه الصفحة." }, { status: 403 });
    }

    if (body.role && body.role !== target.role) {
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
      target.role = body.role;
    }

    if (typeof body.isActive === "boolean") {
      target.isActive = body.isActive;
    }

    await target.save();
    return NextResponse.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "تعذر تحديث المستخدم.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
