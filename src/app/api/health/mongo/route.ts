import { NextResponse } from "next/server";
import mongoose from "mongoose";
import { connectToDatabase } from "@/lib/mongodb";
import { requireAdmin } from "@/lib/authz";
import { safeJsonError, verifyBearerSecret } from "@/lib/api-security";

async function authorizeHealthCheck(request: Request) {
  if (process.env.HEALTHCHECK_SECRET && verifyBearerSecret(request, process.env.HEALTHCHECK_SECRET)) return;
  await requireAdmin();
}

export async function GET(request: Request) {
  try {
    await authorizeHealthCheck(request);
    await connectToDatabase();

    const admin = mongoose.connection.db?.admin();
    const ping = await admin?.ping();

    return NextResponse.json({
      status: ping?.ok === 1 ? "ok" : "degraded",
      mongo: {
        readyState: mongoose.connection.readyState,
        host: mongoose.connection.host,
        name: mongoose.connection.name
      }
    });
  } catch (error) {
    return safeJsonError(error, "Mongo health check unavailable.", 503);
  }
}
