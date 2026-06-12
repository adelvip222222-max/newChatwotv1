"use client";

import { useState, useRef, useEffect } from "react";
import { FileText, Paperclip, Send, User, Bot, AlertCircle, X } from "lucide-react";

type Attachment = {
  id: string;
  type: "image" | "audio" | "file";
  key: string;
  url?: string;
  name: string;
  mimeType: string;
  size: number;
};

type Message = {
  id: string;
  sender: string;
  content: string;
  attachments?: Attachment[];
  createdAt: string;
};

type ConversationViewerProps = {
  conversationId: string;
  initialStatus: string;
  initialMessages: Message[];
  botName: string;
};

export function ConversationViewer({
  conversationId,
  initialStatus,
  initialMessages,
  botName,
}: ConversationViewerProps) {
  const [messages, setMessages] = useState<Message[]>(initialMessages);
  const [status, setStatus] = useState(initialStatus);
  const [input, setInput] = useState("");
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [isSending, setIsSending] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSend = async () => {
    if ((!input.trim() && !attachments.length) || isSending || isUploading) return;
    
    setIsSending(true);
    try {
      const res = await fetch(`/api/conversations/${conversationId}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: input, attachments }),
      });
      const data = await res.json();
      if (data.success) {
        setMessages((prev) => [...prev, data.message]);
        setInput("");
        setAttachments([]);
        if (status === "open") setStatus("human");
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsSending(false);
    }
  };

  const handleFiles = async (files: FileList | null) => {
    if (!files?.length) return;
    setIsUploading(true);
    try {
      const uploaded: Attachment[] = [];
      for (const file of Array.from(files).slice(0, 6 - attachments.length)) {
        if (file.size > 10 * 1024 * 1024) {
          alert("حجم الملف يجب ألا يتجاوز 10MB.");
          continue;
        }

        const formData = new FormData();
        formData.append("file", file);
        const res = await fetch(`/api/conversations/${conversationId}/attachments`, {
          method: "POST",
          body: formData,
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "تعذر رفع الملف.");
        uploaded.push(data.attachment);
      }

      setAttachments((prev) => [...prev, ...uploaded].slice(0, 6));
    } catch (error) {
      alert(error instanceof Error ? error.message : "تعذر رفع الملف.");
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleStatusChange = async (newStatus: string) => {
    try {
      const res = await fetch(`/api/conversations/${conversationId}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });
      const data = await res.json();
      if (data.success) {
        setStatus(data.status);
      }
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div className="flex flex-col h-[600px] border border-slate-200 rounded-lg overflow-hidden bg-slate-50">
      {/* Header / Controls */}
      <div className="flex items-center justify-between bg-white border-b border-slate-200 p-4">
        <div className="flex items-center gap-2">
          <span className="font-semibold text-slate-700 text-sm">حالة المحادثة:</span>
          <span className={`px-2 py-1 rounded text-xs font-medium ${
            status === "open" ? "bg-emerald-100 text-emerald-700" :
            status === "human" ? "bg-blue-100 text-blue-700" :
            "bg-slate-200 text-slate-700"
          }`}>
            {status === "open" ? "بوت (مفتوحة)" : status === "human" ? "موظف" : "مغلقة"}
          </span>
        </div>
        <div className="flex gap-2">
          {status !== "open" && (
            <button onClick={() => handleStatusChange("open")} className="rounded-md border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 px-3 py-1.5 text-sm font-medium transition-colors">
              إرجاع للبوت
            </button>
          )}
          {status !== "human" && (
            <button onClick={() => handleStatusChange("human")} className="rounded-md bg-blue-600 hover:bg-blue-700 text-white px-3 py-1.5 text-sm font-medium transition-colors">
              تحويل لموظف
            </button>
          )}
          {status !== "closed" && (
            <button onClick={() => handleStatusChange("closed")} className="rounded-md border border-red-200 bg-white text-red-600 hover:bg-red-50 px-3 py-1.5 text-sm font-medium transition-colors">
              إغلاق
            </button>
          )}
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4" dir="rtl">
        {messages.map((message) => {
          const isAgentOrBot = message.sender === "assistant" || message.sender === "agent";
          return (
            <div key={message.id} className={`flex ${isAgentOrBot ? "justify-start" : "justify-end"}`}>
              <div className={`max-w-[75%] rounded-2xl p-4 ${
                message.sender === "assistant" ? "bg-white border border-slate-200 text-slate-800" :
                message.sender === "agent" ? "bg-blue-50 border border-blue-100 text-blue-900" :
                "bg-[#9b59d0] text-white"
              }`}>
                <div className="flex items-center gap-2 mb-2 opacity-80 text-xs">
                  {message.sender === "assistant" ? <Bot size={14} /> : message.sender === "agent" ? <User size={14} /> : <User size={14} />}
                  <span>{message.sender === "assistant" ? botName : message.sender === "agent" ? "موظف الدعم" : "المستخدم"}</span>
                </div>
                <p className="whitespace-pre-wrap text-sm leading-relaxed">{message.content}</p>
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
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="bg-white border-t border-slate-200 p-4">
        {attachments.length ? (
          <div className="mb-3 flex flex-wrap gap-2">
            {attachments.map((attachment) => (
              <span key={attachment.id} className="inline-flex items-center gap-2 rounded-full bg-slate-100 px-3 py-1 text-xs text-slate-700">
                <Paperclip size={12} />
                {attachment.name}
                <button
                  onClick={() => setAttachments((items) => items.filter((item) => item.id !== attachment.id))}
                  className="text-slate-400 hover:text-red-500"
                  type="button"
                >
                  <X size={12} />
                </button>
              </span>
            ))}
          </div>
        ) : null}
        <div className="flex gap-3">
          <input
            ref={fileInputRef}
            type="file"
            className="hidden"
            multiple
            accept="image/jpeg,image/png,image/gif,image/webp,audio/*,application/pdf,text/plain,text/csv,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/zip"
            onChange={(event) => handleFiles(event.target.files)}
          />
          <button
            type="button"
            className="flex items-center justify-center rounded-md border border-slate-200 bg-white px-3 py-2 text-slate-600 transition-colors hover:bg-slate-50 disabled:opacity-50"
            onClick={() => fileInputRef.current?.click()}
            disabled={isUploading || isSending || status === "closed" || attachments.length >= 6}
            title="إرفاق ملف"
          >
            <Paperclip size={18} />
          </button>
          <input
            type="text"
            className="flex-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
            placeholder={isUploading ? "جاري رفع الملف..." : "اكتب ردك هنا..."}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSend()}
            disabled={isSending || status === "closed"}
            dir="auto"
          />
          <button 
            className="flex items-center justify-center rounded-md bg-[#9b59d0] hover:bg-[#8a4cc0] px-4 py-2 text-white transition-colors disabled:opacity-50"
            onClick={handleSend}
            disabled={isSending || isUploading || (!input.trim() && !attachments.length) || status === "closed"}
          >
            <Send size={18} className="rtl:-scale-x-100" />
          </button>
        </div>
        {status === "closed" && (
          <p className="text-xs text-red-500 mt-2 flex items-center gap-1">
            <AlertCircle size={12} /> المحادثة مغلقة. يجب تغيير الحالة للرد.
          </p>
        )}
      </div>
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
          className="max-h-64 rounded-lg border border-slate-200 object-contain"
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
