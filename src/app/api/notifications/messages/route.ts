import { NextResponse } from "next/server";
import { requireSession } from "@/lib/auth";
import { connectToDatabase } from "@/lib/mongodb";
import { Message } from "@/lib/models";
import { isAdminRole } from "@/lib/authz";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const session = await requireSession();
    await connectToDatabase();

    const query: any = { tenantId: session.user.tenantId };
    
    // Restrict main website notifications to 'admin' role ONLY (excluding owner/others)
    if (
      process.env.DEFAULT_TENANT_ID && 
      session.user.tenantId === process.env.DEFAULT_TENANT_ID && 
      session.user.role !== "admin"
    ) {
      query.provider = { $ne: "website" };
    }

    const messages = await Message.find(query)
      .sort({ createdAt: -1 })
      .limit(12)
      .populate("contactId", "name email phone")
      .lean();

    return NextResponse.json({
      messages: messages.map((message: any) => ({
        id: message._id.toString(),
        conversationId: message.conversationId?.toString() || "",
        provider: message.provider || "website",
        contact: {
          name: message.contactId?.name || message.contactId?.email || message.contactId?.phone || "Website Visitor",
          email: message.contactId?.email || "",
          phone: message.contactId?.phone || ""
        },
        content: message.content,
        direction: message.direction,
        sender: message.sender,
        status: message.deliveryStatus || "sent",
        createdAt: message.createdAt?.toISOString() || new Date().toISOString()
      }))
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to load notifications";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
