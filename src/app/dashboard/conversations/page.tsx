export const dynamic = "force-dynamic";

import { requirePermission } from "@/server/auth/guards";
import { permissions } from "@/server/permissions/permissions";
import { getConversationDetail, getInboxConversations } from "@/lib/inbox/service";
import { AIInboxClient } from "@/components/inbox/ai-inbox-client";

export default async function InboxPage({
  searchParams
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const session = await requirePermission(permissions.inboxRead);
  const params = await searchParams;

  const value = (key: string) => {
    const raw = params[key];
    return Array.isArray(raw) ? raw[0] || "" : raw || "";
  };

  const initialData = await getInboxConversations({
    tenantId: session.user.tenantId,
    userId: session.user.id,
    filters: {
      view: value("view") || "inbox",
      q: value("q"),
      channel: value("channel"),
      agent: value("agent"),
      team: value("team"),
      status: value("status"),
      priority: value("priority"),
      tags: value("tags"),
      limit: 45
    }
  });

  const activeConversationId = value("conversationId") || initialData.conversations[0]?.id || "";
  const initialDetail = activeConversationId
    ? await getConversationDetail({
        tenantId: session.user.tenantId,
        conversationId: activeConversationId
      }).catch(() => null)
    : null;

  return (
    <AIInboxClient
      initialData={initialData}
      initialDetail={initialDetail}
      activeConversationId={activeConversationId}
      currentUserId={session.user.id}
    />
  );
}
