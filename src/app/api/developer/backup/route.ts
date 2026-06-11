import { NextResponse } from "next/server";
import { requireSuperAdmin } from "@/server/auth/guards";
import { createDatabaseBackup } from "@/lib/developer/operations";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST() {
  try {
    await requireSuperAdmin();
    const result = await createDatabaseBackup();
    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to create database backup.";
    const status = message.toLowerCase().includes("super-admin") || message.toLowerCase().includes("authentication") ? 403 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
