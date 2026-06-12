import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/authz";
import { connectToDatabase } from "@/lib/mongodb";
import { User } from "@/lib/models/user";
import { safeJsonError } from "@/lib/api-security";

export async function GET() {
  try {
    const session = await requireAdmin();
    await connectToDatabase();

    const users = await User.find({ tenantId: session.user.tenantId })
      .select("_id name email role isActive lastLoginAt createdAt updatedAt")
      .sort({ createdAt: -1 })
      .lean();
    
    return NextResponse.json({ 
      success: true, 
      count: users.length, 
      data: users 
    });
  } catch (error) {
    console.error("Error fetching users:", error);
    return safeJsonError(error, "Unable to fetch users.", 500);
  }
}
