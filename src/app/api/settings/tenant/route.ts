import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requirePermission } from "@/server/auth/guards";
import { permissions } from "@/server/permissions/permissions";
import { connectToDatabase } from "@/lib/mongodb";
import { Tenant } from "@/lib/models/tenant";

const tenantSchema = z.object({
  name: z.string().min(2, "اسم الشركة قصير جداً"),
});

export async function PUT(request: NextRequest) {
  try {
    const session = await requirePermission(permissions.settingsManage);

    const body = await request.json();
    const parsed = tenantSchema.parse(body);

    await connectToDatabase();

    const tenant = await Tenant.findById(session.user.tenantId);
    if (!tenant) {
      return NextResponse.json({ error: "الشركة غير موجودة" }, { status: 404 });
    }

    tenant.name = parsed.name;
    await tenant.save();

    return NextResponse.json({ success: true, message: "تم تحديث بيانات الشركة بنجاح" });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.errors[0].message }, { status: 400 });
    }
    const message = error instanceof Error ? error.message : "حدث خطأ أثناء التحديث";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
