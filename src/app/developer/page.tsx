import { redirect } from "next/navigation";
import { requirePlatformAdmin } from "@/lib/authz";
import { DeveloperPanel } from "@/components/developer/developer-panel";

export const dynamic = "force-dynamic";

export default async function DeveloperPage() {
  const session = await requirePlatformAdmin().catch(() => null);
  if (!session?.user?.isSuperAdmin) redirect("/dashboard");

  return <DeveloperPanel />;
}
