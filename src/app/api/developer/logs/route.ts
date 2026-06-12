import { NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/mongodb";
import { SystemLog } from "@/lib/models/system-log";
import { requirePlatformAdmin } from "@/lib/authz";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const session = await requirePlatformAdmin();
    if (!session?.user?.isSuperAdmin) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get("limit") || "100", 10);
    const type = searchParams.get("type");

    await connectToDatabase();

    const query: any = {};
    if (type && type !== "all") {
      query.eventType = type;
    }

    const logs = await SystemLog.find(query)
      .sort({ createdAt: -1 })
      .limit(limit)
      .lean();

    return NextResponse.json({ logs });
  } catch (error: any) {
    console.error("[SystemLogsAPI]", error);
    return NextResponse.json({ error: error.message || "Failed to load logs" }, { status: 500 });
  }
}
