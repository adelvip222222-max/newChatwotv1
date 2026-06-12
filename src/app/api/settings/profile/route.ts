import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import bcrypt from "bcryptjs";
import { requireSession } from "@/lib/auth";
import { connectToDatabase } from "@/lib/mongodb";
import { User } from "@/lib/models/user";

const profileSchema = z.object({
  name: z.string().min(2, "الاسم قصير جداً"),
  email: z.string().email("البريد الإلكتروني غير صالح"),
  currentPassword: z.string().optional(),
  newPassword: z.string().optional(),
});

export async function PUT(request: NextRequest) {
  try {
    const session = await requireSession();
    const body = await request.json();
    const parsed = profileSchema.parse(body);

    await connectToDatabase();

    const user = await User.findById(session.user.id).select("+password");
    if (!user) {
      return NextResponse.json({ error: "المستخدم غير موجود" }, { status: 404 });
    }

    // Check if email changed and is available
    if (parsed.email !== user.email) {
      const existingUser = await User.findOne({ email: parsed.email.toLowerCase() });
      if (existingUser) {
        return NextResponse.json({ error: "البريد الإلكتروني مستخدم بالفعل" }, { status: 400 });
      }
      user.email = parsed.email.toLowerCase();
    }

    user.name = parsed.name;

    // Handle password change
    if (parsed.newPassword) {
      if (!parsed.currentPassword) {
        return NextResponse.json({ error: "يجب إدخال كلمة المرور الحالية لتغييرها" }, { status: 400 });
      }
      if (!user.password) {
        return NextResponse.json({ error: "لا يمكنك تغيير كلمة المرور لأنك سجلت الدخول باستخدام حساب خارجي (Google)." }, { status: 400 });
      }

      const isValidPassword = await bcrypt.compare(parsed.currentPassword, user.password);
      if (!isValidPassword) {
        return NextResponse.json({ error: "كلمة المرور الحالية غير صحيحة" }, { status: 400 });
      }

      if (parsed.newPassword.length < 8) {
        return NextResponse.json({ error: "يجب أن تتكون كلمة المرور الجديدة من 8 أحرف على الأقل" }, { status: 400 });
      }

      user.password = await bcrypt.hash(parsed.newPassword, 12);
    }

    await user.save();

    return NextResponse.json({ success: true, message: "تم تحديث البيانات بنجاح" });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.errors[0].message }, { status: 400 });
    }
    const message = error instanceof Error ? error.message : "حدث خطأ أثناء التحديث";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
