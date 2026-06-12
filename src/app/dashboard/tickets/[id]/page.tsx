import { notFound } from "next/navigation";
import { requireSession } from "@/lib/auth";
import { getTicketDetail } from "@/lib/dashboard-data";
import { PageHeader } from "@/components/dashboard/page-header";
import { TicketDetailClient } from "@/components/dashboard/ticket-detail-client";

export default async function TicketPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await requireSession();
  const { id } = await params;
  const ticket = await getTicketDetail(session.user.tenantId, id);
  if (!ticket) notFound();

  return (
    <>
      <PageHeader
        title={`تذكرة #${ticket.number}`}
        description={`${ticket.subject} · ${ticket.requesterExternalId}`}
      />
      <TicketDetailClient ticket={ticket} />
    </>
  );
}

