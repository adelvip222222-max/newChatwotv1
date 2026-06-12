"use client";

import Link from "next/link";
import { useState } from "react";
import { FileText, Save } from "lucide-react";

type Attachment = {
  id: string;
  type: "image" | "audio" | "file";
  key: string;
  url?: string;
  name: string;
  mimeType: string;
  size: number;
};

type TicketMessage = {
  id: string;
  sender: string;
  content: string;
  attachments?: Attachment[];
  createdAt: string;
};

type TicketDetail = {
  id: string;
  number: number;
  subject: string;
  description: string;
  status: string;
  priority: string;
  category: string;
  requesterExternalId: string;
  channel: string;
  botName: string;
  conversationId: string;
  conversationStatus: string;
  triggerReason: string;
  aiSummary: string;
  createdAt: string;
  updatedAt: string;
  messages: TicketMessage[];
};

const statusLabels: Record<string, string> = {
  open: "مفتوحة",
  pending: "قيد المتابعة",
  resolved: "تم الحل",
  closed: "مغلقة",
};

const priorityLabels: Record<string, string> = {
  low: "منخفضة",
  medium: "متوسطة",
  high: "عالية",
  urgent: "عاجلة",
};

const categoryLabels: Record<string, string> = {
  technical_support: "دعم فني",
  complaint: "شكوى",
  human_request: "طلب موظف",
  ai_failed: "فشل AI",
  general: "عام",
};

export function TicketDetailClient({ ticket }: { ticket: TicketDetail }) {
  const [form, setForm] = useState({
    subject: ticket.subject,
    description: ticket.description,
    aiSummary: ticket.aiSummary,
    status: ticket.status,
    priority: ticket.priority,
    category: ticket.category,
  });
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  async function saveTicket() {
    setSaving(true);
    setSaved(false);
    try {
      const res = await fetch(`/api/tickets/${ticket.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (data.success) setSaved(true);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_420px]">
      <section className="space-y-5">
        <div className="panel p-5">
          <div className="grid gap-4 md:grid-cols-3">
            <label className="space-y-1 text-sm">
              <span className="font-semibold text-slate-700">الحالة</span>
              <select
                className="field"
                value={form.status}
                onChange={(event) => setForm((value) => ({ ...value, status: event.target.value }))}
              >
                {Object.entries(statusLabels).map(([value, label]) => (
                  <option key={value} value={value}>{label}</option>
                ))}
              </select>
            </label>
            <label className="space-y-1 text-sm">
              <span className="font-semibold text-slate-700">الأولوية</span>
              <select
                className="field"
                value={form.priority}
                onChange={(event) => setForm((value) => ({ ...value, priority: event.target.value }))}
              >
                {Object.entries(priorityLabels).map(([value, label]) => (
                  <option key={value} value={value}>{label}</option>
                ))}
              </select>
            </label>
            <label className="space-y-1 text-sm">
              <span className="font-semibold text-slate-700">النوع</span>
              <select
                className="field"
                value={form.category}
                onChange={(event) => setForm((value) => ({ ...value, category: event.target.value }))}
              >
                {Object.entries(categoryLabels).map(([value, label]) => (
                  <option key={value} value={value}>{label}</option>
                ))}
              </select>
            </label>
          </div>

          <label className="mt-4 block space-y-1 text-sm">
            <span className="font-semibold text-slate-700">الموضوع</span>
            <input
              className="field"
              value={form.subject}
              onChange={(event) => setForm((value) => ({ ...value, subject: event.target.value }))}
            />
          </label>

          <label className="mt-4 block space-y-1 text-sm">
            <span className="font-semibold text-slate-700">الوصف الداخلي</span>
            <textarea
              className="field min-h-32"
              value={form.description}
              onChange={(event) => setForm((value) => ({ ...value, description: event.target.value }))}
            />
          </label>

          <label className="mt-4 block space-y-1 text-sm">
            <span className="font-semibold text-slate-700">ملخص AI / سبب التصعيد</span>
            <textarea
              className="field min-h-32"
              value={form.aiSummary}
              onChange={(event) => setForm((value) => ({ ...value, aiSummary: event.target.value }))}
            />
          </label>

          <div className="mt-5 flex items-center gap-3">
            <button className="btn-primary" onClick={saveTicket} disabled={saving}>
              <Save size={16} />
              حفظ التذكرة
            </button>
            {saved ? <span className="text-sm font-medium text-emerald-600">تم الحفظ</span> : null}
          </div>
        </div>

        <div className="panel overflow-hidden">
          <div className="border-b border-slate-100 bg-slate-50 p-4">
            <h2 className="font-bold text-ink">محادثة العميل</h2>
            <p className="text-xs text-slate-500">
              {ticket.channel} · {ticket.requesterExternalId}
            </p>
          </div>
          <div className="max-h-[560px] space-y-4 overflow-y-auto p-4">
            {ticket.messages.map((message) => {
              const isAssistant = message.sender === "assistant" || message.sender === "agent";
              return (
                <div key={message.id} className={`flex ${isAssistant ? "justify-start" : "justify-end"}`}>
                  <div className={`max-w-[78%] rounded-2xl p-4 text-sm ${
                    isAssistant
                      ? "border border-slate-200 bg-white text-slate-800"
                      : "bg-[#9b59d0] text-white"
                  }`}>
                    <p className="mb-2 text-xs opacity-70">
                      {message.sender === "assistant" ? ticket.botName : message.sender === "agent" ? "موظف الدعم" : "العميل"}
                    </p>
                    <p className="whitespace-pre-wrap leading-relaxed">{message.content}</p>
                    {message.attachments?.length ? (
                      <div className="mt-3 space-y-2">
                        {message.attachments.map((attachment) => (
                          <AttachmentPreview key={attachment.id} attachment={attachment} />
                        ))}
                      </div>
                    ) : null}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      <aside className="space-y-5">
        <div className="panel p-5">
          <h2 className="mb-4 font-bold text-ink">بيانات التذكرة</h2>
          <dl className="space-y-3 text-sm">
            <div>
              <dt className="text-slate-500">رقم التذكرة</dt>
              <dd className="font-semibold text-ink">#{ticket.number}</dd>
            </div>
            <div>
              <dt className="text-slate-500">العميل</dt>
              <dd className="font-semibold text-ink">{ticket.requesterExternalId}</dd>
            </div>
            <div>
              <dt className="text-slate-500">البوت</dt>
              <dd className="font-semibold text-ink">{ticket.botName}</dd>
            </div>
            <div>
              <dt className="text-slate-500">سبب الإنشاء</dt>
              <dd className="font-semibold text-ink">{ticket.triggerReason || "-"}</dd>
            </div>
            <div>
              <dt className="text-slate-500">تاريخ الإنشاء</dt>
              <dd>{ticket.createdAt ? new Date(ticket.createdAt).toLocaleString("ar") : "-"}</dd>
            </div>
            <div>
              <dt className="text-slate-500">آخر تحديث</dt>
              <dd>{ticket.updatedAt ? new Date(ticket.updatedAt).toLocaleString("ar") : "-"}</dd>
            </div>
          </dl>
        </div>

        <div className="panel p-5">
          <h2 className="mb-3 font-bold text-ink">روابط سريعة</h2>
          <div className="flex flex-col gap-2">
            <Link className="btn-secondary justify-center" href={`/dashboard/conversations/${ticket.conversationId}`}>
              فتح المحادثة
            </Link>
            <Link className="btn-secondary justify-center" href="/dashboard/tickets">
              العودة للتذاكر
            </Link>
          </div>
        </div>
      </aside>
    </div>
  );
}

function AttachmentPreview({ attachment }: { attachment: Attachment }) {
  const url = attachment.url || "";
  const sizeKb = Math.round(attachment.size / 1024);

  if (attachment.type === "image" && url) {
    return (
      <a href={url} target="_blank" rel="noopener noreferrer" className="block">
        <img
          src={url}
          alt={attachment.name}
          className="max-h-56 rounded-lg border border-slate-200 object-contain"
        />
      </a>
    );
  }

  if (attachment.type === "audio" && url) {
    return (
      <div className="rounded-lg border border-slate-200 bg-white/80 p-2">
        <audio controls src={url} className="w-full" />
        <p className="mt-1 text-xs opacity-70">{attachment.name} · {sizeKb}KB</p>
      </div>
    );
  }

  return (
    <a
      href={url || "#"}
      target="_blank"
      rel="noopener noreferrer"
      className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white/80 p-3 text-sm hover:bg-slate-50"
    >
      <FileText size={18} />
      <span className="truncate">{attachment.name}</span>
      <span className="text-xs opacity-60">{sizeKb}KB</span>
    </a>
  );
}

