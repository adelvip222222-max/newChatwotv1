import { NextResponse } from "next/server";
import { z } from "zod";
import { assertObjectIdLike, checkRateLimit, getClientIp, parseJsonBody, safeJsonError } from "@/lib/api-security";
import { connectToDatabase } from "@/lib/mongodb";
import { Task } from "@/lib/models/task";

const bookingSchema = z.object({
  firstName: z.string().trim().min(1).max(80),
  lastName: z.string().trim().max(80).optional().default(""),
  email: z.string().trim().email().max(180),
  company: z.string().trim().max(160).optional().default(""),
  notes: z.string().trim().max(2000).optional().default("")
});

export async function POST(req: Request) {
  try {
    checkRateLimit(`book:${getClientIp(req)}`, { limit: 8, windowMs: 60_000 });
    const body = await parseJsonBody(req, bookingSchema, { maxBytes: 8 * 1024 });
    const tenantId =
      process.env.BOOKING_TENANT_ID ||
      process.env.DEFAULT_TENANT_ID ||
      "";

    assertObjectIdLike(tenantId, "BOOKING_TENANT_ID");

    await connectToDatabase();

    const newTask = await Task.create({
      tenantId,
      type: "booking",
      title: `New booking: ${body.firstName} ${body.lastName || ""}`.trim(),
      details: {
        firstName: body.firstName,
        lastName: body.lastName,
        email: body.email.toLowerCase(),
        company: body.company,
        notes: body.notes,
        source: "Website Booking"
      },
      status: "open"
    });

    return NextResponse.json({ success: true, taskId: newTask._id });
  } catch (error) {
    console.error("Error creating booking task:", error);
    return safeJsonError(error, "Unable to create booking request.", 400);
  }
}
