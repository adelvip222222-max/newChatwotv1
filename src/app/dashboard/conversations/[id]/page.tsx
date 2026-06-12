import { notFound } from "next/navigation";
import Link from "next/link";
import { requireSession } from "@/lib/auth";
import { getConversationDetail } from "@/lib/dashboard-data";
import { PageHeader } from "@/components/dashboard/page-header";
import { ConversationViewer } from "@/components/dashboard/conversation-viewer";

export default async function ConversationPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await requireSession();
  const { id } = await params;
  const conversation = await getConversationDetail(session.user.tenantId, id);
  if (!conversation) notFound();

  return (
    <>
      <PageHeader
        title={`محادثة ${conversation.externalUserId}`}
        description={`${conversation.botName} · ${conversation.channel}`}
        action={
          conversation.ticket ? (
            <Link className="btn-secondary" href={`/dashboard/tickets/${conversation.ticket.id}`}>
              تذكرة #{conversation.ticket.number}
            </Link>
          ) : null
        }
      />
      <section className="max-w-4xl pt-4">
        <ConversationViewer
          conversationId={conversation.id}
          initialStatus={conversation.status}
          initialMessages={conversation.messages}
          botName={conversation.botName}
        />
      </section>
    </>
  );
}
