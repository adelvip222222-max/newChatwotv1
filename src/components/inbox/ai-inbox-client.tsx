"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import useSWR, { mutate } from "swr";
import {
  Archive,
  AtSign,
  Brain,
  Check,
  CheckCircle,
  Clock,
  FileText,
  Filter,
  Globe,
  Inbox,
  Info,
  Loader2,
  Mail,
  Menu,
  Mic,
  MessageCircle,
  MessageSquare,
  MoreHorizontal,
  Paperclip,
  Phone,
  RefreshCcw,
  Search,
  SendHorizonal,
  Sparkles,
  StickyNote,
  Tag,
  Timer,
  Trash2,
  User,
  UserPlus,
  Users,
  Wand2,
  X,
  Zap
} from "lucide-react";
import { useI18n } from "@/components/i18n-provider";

type InboxAnalytics = {
  openCount: number;
  responseTimeMinutes: number;
  aiResolutionRate: number;
  humanResolutionRate: number;
  escalationRate: number;
};

type ConversationItem = {
  id: string;
  contactName: string;
  avatarUrl: string;
  contactInitials: string;
  channel: string;
  lastMessage: string;
  lastMessageAt: string;
  unreadCount: number;
  status: string;
  priority: string;
  aiStatus: string;
  agentStatus: string;
  assigneeName: string;
  teamName: string;
  sentiment: string;
  intent: string;
  aiConfidence: number | null;
  slaStatus: string;
  labels: string[];
  badges: string[];
  customerValue: number;
  needsHuman: boolean;
};

type TimelineItem = {
  id: string;
  type: string;
  direction?: string;
  sender?: string;
  senderType?: string;
  title?: string;
  content: string;
  visibility?: string;
  deliveryStatus?: string;
  createdAt: string;
  attachments?: AttachmentDraft[];
  metadata?: Record<string, unknown>;
};

type AttachmentDraft = {
  id: string;
  name: string;
  size: number;
  mimeType: string;
  type: "image" | "audio" | "pdf" | "file";
  url: string;
};

type SuggestedReply = {
  id: string;
  label: string;
  text: string;
  tone: string;
  confidence: number;
  source: string;
};

type ConversationDetail = {
  conversation: {
    id: string;
    contact: {
      id: string;
      name: string;
      email: string;
      phone: string;
      avatarUrl: string;
      country: string;
      company: string;
      lastSeenAt: string;
      totalOrders: number;
      customerValue: number;
      lifecycleStage: string;
      tags: string[];
      notes: string;
    };
    channel: string;
    status: string;
    priority: string;
    mode: string;
    aiPaused: boolean;
    assigneeId: string;
    assigneeName: string;
    teamId: string;
    teamName: string;
    firstResponseDueAt: string;
    resolutionDueAt: string;
    firstResponseMs: number;
    resolutionMs: number;
    slaStatus: string;
    labels: string[];
    lastMessageAt: string;
  };
  timeline: TimelineItem[];
  insight: {
    summary: string;
    sentiment: string;
    sentimentScore: number;
    intent: string;
    confidence: number | null;
    needsHuman: boolean;
    escalationReason: string;
    suggestedReplies: SuggestedReply[];
    bestReply: string;
    customerFacts: string[];
    recommendedActions: string[];
    knowledgeSources: Array<{ title: string; url: string; score: number; documentId: string }>;
  };
  agents: Array<{ id: string; name: string; email: string; role: string }>;
  teams: Array<{ id: string; name: string; color: string }>;
  savedReplies: Array<{ id: string; title: string; body: string; category: string; tags: string[] }>;
};

type InboxPayload = {
  conversations: ConversationItem[];
  nextCursor: string;
  analytics: InboxAnalytics;
};

type Props = {
  initialData: InboxPayload;
  initialDetail: ConversationDetail | null;
  activeConversationId: string;
  currentUserId: string;
};

type RealtimeMessageCreatedPayload = {
  message?: {
    id?: string;
    conversationId?: string;
    content?: string;
    direction?: string;
    sender?: string;
    senderType?: string;
    provider?: string;
    deliveryStatus?: string;
    createdAt?: string;
    attachments?: AttachmentDraft[];
  };
  conversation?: {
    id?: string;
    status?: string;
    priority?: string;
    lastMessage?: string;
    lastMessageAt?: string;
    unreadCount?: number;
    channel?: string;
    provider?: string;
  };
  contact?: {
    name?: string;
    email?: string;
    phone?: string;
    avatarUrl?: string;
  };
  conversationId?: string;
  messageId?: string;
  content?: string;
  direction?: string;
  provider?: string;
  sender?: string;
};


const rowHeight = 132;

const copy = {
  ar: {
    inbox: "Inbox",
    assignedToMe: "Assigned To Me",
    unassigned: "Unassigned",
    aiInbox: "AI Inbox",
    mentioned: "Mentioned",
    snoozed: "Snoozed",
    resolved: "Resolved",
    archived: "Archived",
    channels: "Channels",
    teams: "Teams",
    savedViews: "Saved Views",
    search: "بحث في الرسائل، العملاء، الهاتف، البريد، التذاكر، الوسوم",
    filters: "Filters",
    priority: "Priority",
    status: "Status",
    agent: "Agent",
    team: "Team",
    all: "All",
    reply: "اكتب ردك هنا...",
    send: "إرسال",
    sending: "جار الإرسال...",
    attach: "مرفقات",
    removeAttachment: "حذف المرفق",
    openList: "قائمة المحادثات",
    openDetails: "معلومات العميل",
    close: "إغلاق",
    internalNote: "Internal Notes",
    teamNote: "Team Notes",
    addNote: "إضافة",
    aiReplies: "AI Suggested Replies",
    copilot: "Agent Copilot",
    customer: "Customer Context",
    sla: "SLA",
    summary: "AI Summary",
    sentiment: "Sentiment",
    intent: "Intent",
    assign: "Assign",
    noConversation: "اختر محادثة",
    noConversationHint: "افتح قائمة المحادثات واختر عميلًا لبدء الرد.",
    noTimeline: "لا توجد رسائل بعد",
    refreshAi: "تحديث AI",
    resumeAi: "تفعيل الرد الآلي",
    aiPaused: "الرد الآلي متوقف",
    aiPausedHint: "المحادثة في وضع الموظف. فعّل الرد الآلي أو أرسل ردًا يدويًا.",
    openInbox: "فتح المحادثة",
    deliveryFailed: "فشل الإرسال",
    bulkResolve: "Resolve",
    loadMore: "Load more",
    savedReplies: "Saved Replies",
    insert: "إدراج",
    sendSuggestion: "إرسال",
    workspace: "Workspace",
    loaded: "loaded",
    open: "open",
    archive: "أرشيف",
    delete: "حذف",
    confirmDelete: "هل تريد حذف هذه المحادثة نهائيًا؟",
    startRecording: "تسجيل صوت",
    stopRecording: "إيقاف التسجيل"
  },
  en: {
    inbox: "Inbox",
    assignedToMe: "Assigned To Me",
    unassigned: "Unassigned",
    aiInbox: "AI Inbox",
    mentioned: "Mentioned",
    snoozed: "Snoozed",
    resolved: "Resolved",
    archived: "Archived",
    channels: "Channels",
    teams: "Teams",
    savedViews: "Saved Views",
    search: "Search messages, customers, phone, email, tickets, tags",
    filters: "Filters",
    priority: "Priority",
    status: "Status",
    agent: "Agent",
    team: "Team",
    all: "All",
    reply: "Write your reply here...",
    send: "Send",
    sending: "Sending...",
    attach: "Attachments",
    removeAttachment: "Remove attachment",
    openList: "Conversation list",
    openDetails: "Customer details",
    close: "Close",
    internalNote: "Internal Notes",
    teamNote: "Team Notes",
    addNote: "Add",
    aiReplies: "AI Suggested Replies",
    copilot: "Agent Copilot",
    customer: "Customer Context",
    sla: "SLA",
    summary: "AI Summary",
    sentiment: "Sentiment",
    intent: "Intent",
    assign: "Assign",
    noConversation: "Select a conversation",
    noConversationHint: "Open the conversation list and choose a customer to start replying.",
    noTimeline: "No timeline yet",
    refreshAi: "Refresh AI",
    resumeAi: "Enable auto-reply",
    aiPaused: "Auto-reply paused",
    aiPausedHint: "This conversation is in human mode. Enable auto-reply or send a manual reply.",
    openInbox: "Open conversation",
    deliveryFailed: "Delivery failed",
    bulkResolve: "Resolve",
    loadMore: "Load more",
    savedReplies: "Saved Replies",
    insert: "Insert",
    sendSuggestion: "Send",
    workspace: "Workspace",
    loaded: "loaded",
    open: "open",
    archive: "Archive",
    delete: "Delete",
    confirmDelete: "Delete this conversation permanently?",
    startRecording: "Record audio",
    stopRecording: "Stop recording"
  }
} as const;

const viewItems = [
  { id: "inbox", icon: Inbox, key: "inbox" },
  { id: "assigned_to_me", icon: User, key: "assignedToMe" },
  { id: "unassigned", icon: UserPlus, key: "unassigned" },
  { id: "ai_inbox", icon: Sparkles, key: "aiInbox" },
  { id: "mentioned", icon: AtSign, key: "mentioned" },
  { id: "snoozed", icon: Clock, key: "snoozed" },
  { id: "resolved", icon: CheckCircle, key: "resolved" },
  { id: "archived", icon: Archive, key: "archived" }
] as const;

const channels = ["whatsapp", "facebook", "instagram", "telegram", "website"];
const smartActions = [
  ["formal", "رد رسمي"],
  ["short", "رد مختصر"],
  ["friendly", "رد ودي"],
  ["professional", "رد احترافي"],
  ["sales", "رد مبيعات"],
  ["support", "رد دعم فني"]
] as const;

const rewriteActions = [
  ["improve", "تحسين"],
  ["professional", "احترافية"],
  ["shorten", "تقصير"],
  ["expand", "إطالة"],
  ["translate", "ترجمة"]
] as const;

export function AIInboxClient({
  initialData,
  initialDetail,
  activeConversationId,
  currentUserId
}: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { locale } = useI18n();
  const labels = copy[locale];

  const [conversations, setConversations] = useState(initialData.conversations);
  const [nextCursor, setNextCursor] = useState(initialData.nextCursor);
  const [analytics, setAnalytics] = useState(initialData.analytics);
  const [selectedId, setSelectedId] = useState(activeConversationId);
  const [view, setView] = useState("inbox");
  const [query, setQuery] = useState("");
  const [channel, setChannel] = useState("");
  const [status, setStatus] = useState("");
  const [priority, setPriority] = useState("");
  const [agent, setAgent] = useState("");
  const [team, setTeam] = useState("");
  const [tagFilter, setTagFilter] = useState("");
  const [composer, setComposer] = useState("");
  const [note, setNote] = useState("");
  const [noteVisibility, setNoteVisibility] = useState<"internal" | "team">("internal");
  const [draftAttachments, setDraftAttachments] = useState<AttachmentDraft[]>([]);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [scrollTop, setScrollTop] = useState(0);
  const [loadingList, setLoadingList] = useState(false);
  const [sendingReply, setSendingReply] = useState(false);
  const [aiBusy, setAiBusy] = useState(false);
  const [error, setError] = useState("");

  const { data: detailData, isValidating: isDetailValidating } = useSWR<ConversationDetail | null>(
    selectedId ? `/api/inbox/conversations/${selectedId}` : null,
    (url: string) => fetch(url, { cache: "no-store" }).then(readJson),
    {
      fallbackData: initialDetail?.conversation?.id === selectedId ? initialDetail : undefined,
      revalidateOnFocus: false
    }
  );
  
  const detail = detailData || null;
  const loadingDetail = isDetailValidating && !detailData;
  const [listDrawerOpen, setListDrawerOpen] = useState(false);
  const [detailsDrawerOpen, setDetailsDrawerOpen] = useState(false);
  const [savedRepliesOpen, setSavedRepliesOpen] = useState(false);
  const [recordingAudio, setRecordingAudio] = useState(false);

  const audioChunksRef = useRef<Blob[]>([]);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);

  const searchRef = useRef<HTMLInputElement | null>(null);
  const composerRef = useRef<HTMLTextAreaElement | null>(null);
  const noteRef = useRef<HTMLTextAreaElement | null>(null);
  const timelineRef = useRef<HTMLDivElement | null>(null);
  const attachmentInputRef = useRef<HTMLInputElement | null>(null);
  void currentUserId;

  const listParams = useMemo(() => {
    const params = new URLSearchParams();
    params.set("view", view);
    if (query.trim()) params.set("q", query.trim());
    if (channel) params.set("channel", channel);
    if (status) params.set("status", status);
    if (priority) params.set("priority", priority);
    if (agent) params.set("agent", agent);
    if (team) params.set("team", team);
    if (tagFilter) params.set("tags", tagFilter);
    params.set("limit", "45");
    return params;
  }, [agent, channel, priority, query, status, tagFilter, team, view]);

  const visibleRows = useMemo(() => {
    const start = Math.max(Math.floor(scrollTop / rowHeight) - 4, 0);
    const end = Math.min(start + 18, conversations.length);
    return { start, end, rows: conversations.slice(start, end) };
  }, [conversations, scrollTop]);

  const activeConversation = useMemo(
    () => conversations.find((conversation) => conversation.id === selectedId),
    [conversations, selectedId]
  );

  const fetchList = useCallback(async (append = false) => {
    setLoadingList(true);
    setError("");
    try {
      const params = new URLSearchParams(listParams);
      if (append && nextCursor) params.set("cursor", nextCursor);
      const response = await fetch(`/api/inbox/conversations?${params.toString()}`, { cache: "no-store" });
      const payload = await readJson<InboxPayload>(response);
      setConversations((current) => (append ? dedupeConversations([...current, ...payload.conversations]) : payload.conversations));
      setNextCursor(payload.nextCursor || "");
      setAnalytics(payload.analytics);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to load inbox.");
    } finally {
      setLoadingList(false);
    }
  }, [listParams, nextCursor]);

  const fetchDetail = useCallback(async (id: string, forceAi = false) => {
    if (!id) return;
    if (forceAi) {
      const response = await fetch(`/api/inbox/conversations/${id}?forceAi=1`, { cache: "no-store" });
      const payload = await readJson<ConversationDetail>(response);
      await mutate(`/api/inbox/conversations/${id}`, payload, { revalidate: false });
    } else {
      await mutate(`/api/inbox/conversations/${id}`);
    }
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      void fetchList(false);
    }, 250);
    return () => clearTimeout(timer);
  }, [fetchList]);

  useEffect(() => {
    const urlConversationId = searchParams?.get("conversationId") || "";
    if (urlConversationId && urlConversationId !== selectedId) {
      setSelectedId(urlConversationId);
      return;
    }
    if (!selectedId && conversations[0]?.id) {
      setSelectedId(conversations[0].id);
    }
  }, [conversations, searchParams, selectedId]);

  const fetchListRef = useRef(fetchList);
  const selectedIdRef = useRef(selectedId);
  
  useEffect(() => {
    fetchListRef.current = fetchList;
    selectedIdRef.current = selectedId;
  }, [fetchList, selectedId]);

  useEffect(() => {
    let fallbackSyncInFlight = false;

    const refresh = () => {
      void fetchListRef.current(false);
      if (selectedIdRef.current) {
        void mutate(`/api/inbox/conversations/${selectedIdRef.current}`);
      }
    };

    const handleMessageCreated = (payload: RealtimeMessageCreatedPayload) => {
      const normalized = normalizeRealtimeMessagePayload(payload);
      if (!normalized.conversationId) {
        refresh();
        return;
      }

      let conversationExists = false;
      setConversations((current) => {
        const patched = patchConversationsWithRealtimeMessage(current, normalized);
        conversationExists = patched.exists;
        return patched.items;
      });

      if (!conversationExists) {
        void fetchListRef.current(false);
      }

      if (selectedIdRef.current === normalized.conversationId) {
        void mutate<ConversationDetail | null>(
          `/api/inbox/conversations/${normalized.conversationId}`,
          (current) => appendRealtimeMessageToDetail(current, normalized),
          { revalidate: false }
        );
      }
    };

    const handleConversationChange = () => {
      void fetchListRef.current(false);
      if (selectedIdRef.current) {
        void mutate(`/api/inbox/conversations/${selectedIdRef.current}`);
      }
    };

    const handleConversationDeleted = (payload: any) => {
      const deletedId = payload?.conversationId || payload?.conversation?.id || "";
      if (!deletedId) return handleConversationChange();
      setConversations((current) => current.filter((conversation) => conversation.id !== deletedId));
      if (selectedIdRef.current === deletedId) {
        setSelectedId("");
        router.replace("/dashboard/conversations", { scroll: false });
      }
    };

    const handleSyncRequired = () => {
      if (fallbackSyncInFlight) return;
      fallbackSyncInFlight = true;
      void Promise.resolve(refresh()).finally(() => {
        fallbackSyncInFlight = false;
      });
    };

    const handleRealtimeEvent = (event: Event) => {
      const detail = (event as CustomEvent<{ type?: string; payload?: unknown }>).detail;
      if (!detail?.type) return;
      if (detail.type === "message.created") handleMessageCreated((detail.payload || {}) as RealtimeMessageCreatedPayload);
      else if (detail.type === "conversation.deleted") handleConversationDeleted(detail.payload || {});
      else if (["message.updated", "conversation.updated", "conversation.assigned", "delivery.updated"].includes(detail.type)) handleConversationChange();
      else if (["inbox.snapshot", "sync.required"].includes(detail.type)) handleSyncRequired();
    };

    window.addEventListener("chatzi:realtime-event", handleRealtimeEvent);
    const fallbackSync = window.setInterval(handleSyncRequired, 60_000);

    return () => {
      window.clearInterval(fallbackSync);
      window.removeEventListener("chatzi:realtime-event", handleRealtimeEvent);
    };
  }, []);

  useEffect(() => {
    const handleKeydown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      const inField = target?.tagName === "INPUT" || target?.tagName === "TEXTAREA" || target?.isContentEditable;
      if (event.key === "/" && !inField) {
        event.preventDefault();
        searchRef.current?.focus();
      }
      if (event.key === "r" && !inField) composerRef.current?.focus();
      if (event.key === "n" && !inField) noteRef.current?.focus();
      if (event.key === "e" && !inField && selectedId) void changeStatus("resolved");
      if ((event.key === "j" || event.key === "k") && !inField) {
        event.preventDefault();
        moveSelection(event.key === "j" ? 1 : -1);
      }
    };
    window.addEventListener("keydown", handleKeydown);
    return () => window.removeEventListener("keydown", handleKeydown);
  });

  useEffect(() => {
    const node = composerRef.current;
    if (!node) return;
    node.style.height = "auto";
    node.style.height = `${Math.min(node.scrollHeight, 160)}px`;
  }, [composer]);

  useEffect(() => {
    const node = timelineRef.current;
    if (!node) return;
    node.scrollTo({ top: node.scrollHeight, behavior: "smooth" });
  }, [detail?.timeline.length, selectedId]);

  useEffect(() => {
    const node = composerRef.current;
    if (!node) return;
    node.style.height = "auto";
    node.style.height = `${Math.min(node.scrollHeight, 160)}px`;
  }, [composer]);

  const selectConversation = (id: string) => {
    setSelectedId(id);
    setListDrawerOpen(false);
    router.replace(`/dashboard/conversations?conversationId=${id}`, { scroll: false });
  };

  const moveSelection = (direction: number) => {
    if (!conversations.length) return;
    const index = Math.max(0, conversations.findIndex((conversation) => conversation.id === selectedId));
    const next = conversations[Math.max(0, Math.min(conversations.length - 1, index + direction))];
    if (next) selectConversation(next.id);
  };

  const prepareAttachments = async (files: FileList | null) => {
    if (!files?.length) return;
    const attachments = await Promise.all(
      Array.from(files).slice(0, 4).map(async (file) => ({
        id: `${file.name}-${file.lastModified}-${file.size}`,
        name: file.name,
        size: file.size,
        mimeType: file.type,
        type: attachmentType(file),
        url: await fileToDataUrl(file)
      }))
    );
    setDraftAttachments((current) => [...current, ...attachments]);
    if (attachmentInputRef.current) attachmentInputRef.current.value = "";
  };

  const startAudioRecording = async () => {
    if (recordingAudio || sendingReply) return;
    if (typeof navigator === "undefined" || !navigator.mediaDevices?.getUserMedia) {
      setError(locale === "ar" ? "المتصفح لا يدعم تسجيل الصوت." : "Audio recording is not supported by this browser.");
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      audioChunksRef.current = [];
      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) audioChunksRef.current.push(event.data);
      };
      recorder.onstop = async () => {
        stream.getTracks().forEach((track) => track.stop());
        const mimeType = recorder.mimeType || "audio/webm";
        const blob = new Blob(audioChunksRef.current, { type: mimeType });
        audioChunksRef.current = [];
        const name = `voice-${Date.now()}.${mimeType.includes("mpeg") ? "mp3" : "webm"}`;
        const url = await blobToDataUrl(blob);
        setDraftAttachments((current) => [
          ...current,
          {
            id: `${name}-${blob.size}`,
            name,
            size: blob.size,
            mimeType,
            type: "audio",
            url
          }
        ]);
        setRecordingAudio(false);
      };
      mediaRecorderRef.current = recorder;
      recorder.start();
      setRecordingAudio(true);
    } catch {
      setError(locale === "ar" ? "تعذر فتح الميكروفون." : "Could not open microphone.");
      setRecordingAudio(false);
    }
  };

  const stopAudioRecording = () => {
    const recorder = mediaRecorderRef.current;
    if (recorder && recorder.state !== "inactive") recorder.stop();
    else setRecordingAudio(false);
  };

  const sendReply = async (text = composer, includeAttachments = true) => {
    const attachments = includeAttachments ? draftAttachments : [];
    const content = text.trim() || (attachments.length ? (locale === "ar" ? "مرفق" : "Attachment") : "");
    if (!selectedId || !content || sendingReply) return;

    setSendingReply(true);
    setError("");
    try {
      const response = await fetch(`/api/inbox/conversations/${selectedId}/reply`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content, attachments })
      });
      await readJson(response);
      setComposer("");
      setDraftAttachments([]);
      await Promise.all([fetchDetail(selectedId), fetchList(false)]);
      requestAnimationFrame(() => {
        const node = timelineRef.current;
        node?.scrollTo({ top: node.scrollHeight, behavior: "smooth" });
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to send reply.");
    } finally {
      setSendingReply(false);
    }
  };

  const addNote = async () => {
    if (!selectedId || !note.trim()) return;
    const response = await fetch(`/api/inbox/conversations/${selectedId}/notes`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content: note, visibility: noteVisibility })
    });
    await readJson(response);
    setNote("");
    await fetchDetail(selectedId);
  };

  const changeStatus = async (nextStatus: string, id = selectedId) => {
    if (!id) return;
    const response = await fetch(`/api/inbox/conversations/${id}/status`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: nextStatus })
    });
    await readJson(response);
    await Promise.all([fetchList(false), selectedId ? fetchDetail(selectedId) : Promise.resolve()]);
  };

  const deleteConversation = async () => {
    if (!selectedId) return;
    if (!window.confirm(labels.confirmDelete)) return;
    const deletingId = selectedId;
    const response = await fetch(`/api/inbox/conversations/${deletingId}`, { method: "DELETE" });
    await readJson(response);
    setConversations((current) => current.filter((item) => item.id !== deletingId));
    const next = conversations.find((item) => item.id !== deletingId)?.id || "";
    setSelectedId(next);
    router.replace(next ? `/dashboard/conversations?conversationId=${next}` : "/dashboard/conversations", { scroll: false });
    await fetchList(false);
  };

  const updateAssignment = async (nextAgent = detail?.conversation.assigneeId || "", nextTeam = detail?.conversation.teamId || "") => {
    if (!selectedId) return;
    const response = await fetch(`/api/inbox/conversations/${selectedId}/assignment`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ agentId: nextAgent, teamId: nextTeam })
    });
    await readJson(response);
    await Promise.all([fetchDetail(selectedId), fetchList(false)]);
  };

  const requestSmartReply = async (action: string) => {
    if (!selectedId) return;
    setAiBusy(true);
    try {
      const response = await fetch(`/api/inbox/conversations/${selectedId}/ai/suggest`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action })
      });
      const payload = await readJson<{ reply?: string }>(response);
      if (payload.reply) setComposer(payload.reply);
      else await fetchDetail(selectedId, true);
    } finally {
      setAiBusy(false);
    }
  };

  const rewriteComposer = async (mode: string) => {
    if (!selectedId || !composer.trim()) return;
    setAiBusy(true);
    try {
      const response = await fetch(`/api/inbox/conversations/${selectedId}/ai/rewrite`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ draft: composer, mode })
      });
      const payload = await readJson<{ text: string }>(response);
      setComposer(payload.text);
    } finally {
      setAiBusy(false);
    }
  };

  const bulkResolve = async () => {
    await Promise.all(selectedIds.map((id) => changeStatus("resolved", id)));
    setSelectedIds([]);
  };

  const resumeAi = async () => {
    if (!selectedId) return;
    setError("");
    try {
      const response = await fetch(`/api/conversations/${selectedId}/resume-ai`, { method: "POST" });
      await readJson(response);
      await Promise.all([fetchDetail(selectedId), fetchList(false)]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to resume AI.");
    }
  };

  const agents = detail?.agents || [];
  const teams = detail?.teams || [];
  const savedReplies = detail?.savedReplies || [];

  const listPane = (
    <section className="flex h-full min-h-0 flex-col bg-white dark:bg-slate-950">
      <div className="shrink-0 border-b border-slate-200 p-3 dark:border-slate-800">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2 text-sm font-bold">
              <Inbox size={18} />
              <span className="truncate">AI Powered Inbox</span>
            </div>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
              {analytics.openCount} {labels.open} · {conversations.length} {labels.loaded}
            </p>
          </div>
          <button
            type="button"
            className="touch-target rounded-md border border-slate-200 text-slate-500 dark:border-slate-800 dark:text-slate-300 lg:hidden"
            onClick={() => setListDrawerOpen(false)}
            aria-label={labels.close}
          >
            <X size={17} className="mx-auto" />
          </button>
        </div>

        <div className="mt-2 flex items-center gap-2 text-[11px] font-bold text-slate-500 dark:text-slate-400">
          <span className="rounded-md border border-blue-200 bg-blue-50 px-2 py-1 text-blue-700 dark:border-blue-900 dark:bg-blue-950/30 dark:text-blue-300">AI {analytics.aiResolutionRate}%</span>
          <span className="rounded-md border border-amber-200 bg-amber-50 px-2 py-1 text-amber-700 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-300">ESC {analytics.escalationRate}%</span>
        </div>

        <div className="mt-2 flex gap-1 overflow-x-auto pb-1 no-scrollbar">
          {viewItems.map((item) => {
            const Icon = item.icon;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setView(item.id)}
                className={`inline-flex h-9 shrink-0 items-center gap-2 rounded-md px-2.5 text-xs font-semibold transition ${
                  view === item.id
                    ? "bg-slate-900 text-white dark:bg-white dark:text-slate-950"
                    : "bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800"
                }`}
              >
                <Icon size={15} />
                <span>{labels[item.key]}</span>
              </button>
            );
          })}
        </div>

        <div className="mt-2 relative">
          <Search className="pointer-events-none absolute left-3 top-2.5 text-slate-400 rtl:left-auto rtl:right-3" size={16} />
          <input
            ref={searchRef}
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            className="field h-10 rounded-md pl-9 pr-3 text-sm rtl:pl-3 rtl:pr-9"
            placeholder={labels.search}
          />
        </div>

        <div className="mt-2 grid grid-cols-[1fr_1fr_auto] gap-2">
          <Select label={labels.status} value={status} onChange={setStatus} options={["open", "pending", "resolved", "closed", "snoozed", "archived"]} />
          <Select label={labels.priority} value={priority} onChange={setPriority} options={["low", "medium", "high", "urgent"]} />
          <button type="button" className="btn-secondary h-10 px-2 text-xs" onClick={() => void fetchList(false)}>
            <Filter size={15} />
            <span className="hidden sm:inline lg:hidden xl:inline">{labels.filters}</span>
          </button>
        </div>

        <div className="mt-2 flex gap-1 overflow-x-auto pb-1 no-scrollbar">
          <button
            type="button"
            onClick={() => setChannel("")}
            className={`inline-flex h-8 shrink-0 items-center rounded-md px-2 text-xs font-semibold ${
              !channel ? "bg-blue-600 text-white" : "bg-slate-100 text-slate-600 dark:bg-slate-900 dark:text-slate-300"
            }`}
          >
            {labels.all}
          </button>
          {channels.map((item) => (
            <button
              key={item}
              type="button"
              onClick={() => setChannel(channel === item ? "" : item)}
              className={`inline-flex h-8 shrink-0 items-center gap-1.5 rounded-md px-2 text-xs font-semibold capitalize transition ${
                channel === item ? "bg-blue-50 text-blue-700 ring-1 ring-blue-200 dark:bg-blue-950/40 dark:text-blue-300 dark:ring-blue-900" : "bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800"
              }`}
            >
              <ChannelGlyph channel={item} />
              <span>{channelLabel(item)}</span>
            </button>
          ))}
        </div>

        <div className="mt-2 flex gap-1 overflow-x-auto pb-1 no-scrollbar">
          {["VIP Customers", "Urgent", "AI Escalations"].map((item) => (
            <button
              key={item}
              type="button"
              onClick={() => setTagFilter(tagFilter === item ? "" : item)}
              className={`inline-flex h-8 shrink-0 items-center gap-1.5 rounded-md px-2 text-xs font-semibold ${
                tagFilter === item ? "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200 dark:bg-emerald-950/30 dark:text-emerald-300 dark:ring-emerald-900" : "bg-slate-100 text-slate-600 dark:bg-slate-900 dark:text-slate-300"
              }`}
            >
              <Tag size={13} />
              {item}
            </button>
          ))}
        </div>

      <div className="mt-2 flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
          {selectedIds.length ? (
            <button type="button" onClick={() => void bulkResolve()} className="font-semibold text-emerald-700 dark:text-emerald-300">
              {labels.bulkResolve} {selectedIds.length}
            </button>
          ) : (
            <span>{loadingList ? "..." : `${conversations.length} ${labels.loaded}`}</span>
          )}
          <span>{loadingDetail ? "..." : activeConversation?.assigneeName || activeConversation?.agentStatus || ""}</span>
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto" onScroll={(event) => setScrollTop(event.currentTarget.scrollTop)}>
        {conversations.length ? (
          <div className="relative" style={{ height: conversations.length * rowHeight }}>
            {visibleRows.rows.map((conversation, index) => (
              <ConversationRow
                key={conversation.id}
                conversation={conversation}
                active={conversation.id === selectedId}
                selected={selectedIds.includes(conversation.id)}
                top={(visibleRows.start + index) * rowHeight}
                onSelect={() => selectConversation(conversation.id)}
                onToggle={() =>
                  setSelectedIds((current) =>
                    current.includes(conversation.id)
                      ? current.filter((id) => id !== conversation.id)
                      : [...current, conversation.id]
                  )
                }
              />
            ))}
          </div>
        ) : (
          <div className="p-6 text-center text-sm text-slate-500 dark:text-slate-400">
            {loadingList ? "..." : labels.noConversation}
          </div>
        )}
        {nextCursor ? (
          <div className="p-3">
            <button type="button" className="btn-secondary w-full" onClick={() => void fetchList(true)}>
              {labels.loadMore}
            </button>
          </div>
        ) : null}
      </div>
    </section>
  );

  const detailsPane = detail ? (
    <aside className="flex h-full min-h-0 flex-col overflow-y-auto bg-white dark:bg-slate-950">
      <div className="sticky top-0 z-10 flex items-center justify-between border-b border-slate-200 bg-white/95 p-3 backdrop-blur dark:border-slate-800 dark:bg-slate-950/95">
        <div className="min-w-0">
          <h2 className="truncate text-sm font-bold">{labels.openDetails}</h2>
          <p className="truncate text-xs text-slate-500 dark:text-slate-400">{detail.conversation.contact.name}</p>
        </div>
        <button
          type="button"
          className="touch-target rounded-md border border-slate-200 text-slate-500 dark:border-slate-800 dark:text-slate-300 xl:hidden"
          onClick={() => setDetailsDrawerOpen(false)}
          aria-label={labels.close}
        >
          <X size={17} className="mx-auto" />
        </button>
      </div>

      <Panel title={labels.copilot} icon={<Brain size={16} />}>
        <div className="space-y-3 text-sm">
          <InfoBlock label={labels.summary} value={detail.insight.summary} />
          <div className="grid grid-cols-3 gap-2">
            <MiniStat label={labels.sentiment} value={detail.insight.sentiment} tone={sentimentTone(detail.insight.sentiment)} />
            <MiniStat label={labels.intent} value={detail.insight.intent} tone="blue" />
            <MiniStat label="Confidence" value={detail.insight.confidence == null ? "-" : `${detail.insight.confidence}%`} tone={detail.insight.needsHuman ? "red" : "emerald"} />
          </div>
          {detail.insight.needsHuman ? (
            <div className="rounded-md border border-red-200 bg-red-50 p-2 text-xs font-semibold text-red-700 dark:border-red-900/60 dark:bg-red-950/30 dark:text-red-300">
              {detail.insight.escalationReason || "AI escalation"}
            </div>
          ) : null}
          {detail.insight.recommendedActions.map((action) => (
            <div key={action} className="flex gap-2 rounded-md bg-slate-50 p-2 text-xs dark:bg-slate-900">
              <Zap size={14} className="mt-0.5 shrink-0 text-amber-500" />
              <span>{action}</span>
            </div>
          ))}
        </div>
      </Panel>

      <Panel title={labels.customer} icon={<User size={16} />}>
        <div className="space-y-2 text-sm">
          <ContactLine icon={<Mail size={14} />} value={detail.conversation.contact.email || "-"} />
          <ContactLine icon={<Phone size={14} />} value={detail.conversation.contact.phone || "-"} />
          <ContactLine icon={<Globe size={14} />} value={detail.conversation.contact.country || "-"} />
          <div className="grid grid-cols-2 gap-2 pt-2">
            <MiniStat label="Conversations" value="1" tone="slate" />
            <MiniStat label="Orders" value={String(detail.conversation.contact.totalOrders || 0)} tone="emerald" />
            <MiniStat label="Value" value={formatMoney(detail.conversation.contact.customerValue)} tone="amber" />
            <MiniStat label="Stage" value={detail.conversation.contact.lifecycleStage} tone="blue" />
          </div>
        </div>
      </Panel>

      <Panel title={labels.assign} icon={<Users size={16} />}>
        <div className="space-y-2">
          <select className="field" value={detail.conversation.assigneeId} onChange={(event) => void updateAssignment(event.target.value, detail.conversation.teamId)}>
            <option value="">Unassigned</option>
            {agents.map((item) => (
              <option key={item.id} value={item.id}>{item.name}</option>
            ))}
          </select>
          <select className="field" value={detail.conversation.teamId} onChange={(event) => void updateAssignment(detail.conversation.assigneeId, event.target.value)}>
            <option value="">No team</option>
            {teams.map((item) => (
              <option key={item.id} value={item.id}>{item.name}</option>
            ))}
          </select>
        </div>
      </Panel>

      <Panel title={labels.sla} icon={<Timer size={16} />}>
        <div className="grid grid-cols-2 gap-2 text-xs">
          <MiniStat label="First response" value={formatDuration(detail.conversation.firstResponseMs)} tone={slaTone(detail.conversation.slaStatus)} />
          <MiniStat label="Resolution" value={formatDuration(detail.conversation.resolutionMs)} tone="slate" />
          <MiniStat label="SLA" value={detail.conversation.slaStatus} tone={slaTone(detail.conversation.slaStatus)} />
          <MiniStat label="Priority" value={detail.conversation.priority} tone={priorityTone(detail.conversation.priority)} />
        </div>
      </Panel>

      <Panel title={labels.internalNote} icon={<StickyNote size={16} />}>
        <div className="space-y-2">
          <div className="flex gap-2">
            <button type="button" onClick={() => setNoteVisibility("internal")} className={`flex-1 rounded-md px-2 py-1 text-xs font-bold ${noteVisibility === "internal" ? "bg-slate-900 text-white dark:bg-white dark:text-slate-950" : "bg-slate-100 dark:bg-slate-900"}`}>
              {labels.internalNote}
            </button>
            <button type="button" onClick={() => setNoteVisibility("team")} className={`flex-1 rounded-md px-2 py-1 text-xs font-bold ${noteVisibility === "team" ? "bg-slate-900 text-white dark:bg-white dark:text-slate-950" : "bg-slate-100 dark:bg-slate-900"}`}>
              {labels.teamNote}
            </button>
          </div>
          <textarea ref={noteRef} className="field min-h-24 resize-none" value={note} onChange={(event) => setNote(event.target.value)} />
          <button type="button" className="btn-secondary w-full" disabled={!note.trim()} onClick={() => void addNote()}>
            {labels.addNote}
          </button>
        </div>
      </Panel>
    </aside>
  ) : (
    <div className="flex h-full items-center justify-center p-6 text-center text-sm text-slate-500 dark:text-slate-400">
      {labels.noConversation}
    </div>
  );

  return (
    <div className="-mt-5 -mx-4 -mb-mobile-nav grid grid-rows-1 h-[calc(100dvh-64px)] min-h-[400px] grid-cols-1 overflow-hidden border-t border-slate-200 bg-slate-100 text-slate-950 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-100 lg:-mt-6 lg:-mx-8 lg:-mb-6 lg:min-h-[400px] lg:grid-cols-[minmax(18rem,23rem)_minmax(0,1fr)] xl:grid-cols-[minmax(18rem,23rem)_minmax(0,1fr)_20rem]">
      <aside className="hidden min-w-0 min-h-0 border-r border-slate-200 dark:border-slate-800 lg:block">
        {listPane}
      </aside>

      <main className="relative flex min-h-0 min-w-0 flex-col bg-slate-50 dark:bg-slate-900/40">
        {detail ? (
          <section className="flex min-h-0 min-w-0 flex-1 flex-col">
            <header className="shrink-0 border-b border-slate-200 bg-white px-3 py-3 dark:border-slate-800 dark:bg-slate-950 sm:px-4">
              <div className="flex min-w-0 items-center justify-between gap-2">
                <div className="flex min-w-0 items-center gap-2">
                  <button
                    type="button"
                    className="touch-target rounded-md border border-slate-200 text-slate-600 dark:border-slate-800 dark:text-slate-300 lg:hidden"
                    onClick={() => setListDrawerOpen(true)}
                    aria-label={labels.openList}
                  >
                    <Menu size={18} className="mx-auto" />
                  </button>
                  <Avatar name={detail.conversation.contact.name} src={detail.conversation.contact.avatarUrl} />
                  <div className="min-w-0">
                    <h1 className="truncate text-base font-bold">{detail.conversation.contact.name}</h1>
                    <div className="mt-1 flex min-w-0 items-center gap-2 overflow-x-auto text-xs text-slate-500 no-scrollbar dark:text-slate-400">
                      <span className="inline-flex shrink-0 items-center gap-1 capitalize">
                        <ChannelGlyph channel={detail.conversation.channel} />
                        {channelLabel(detail.conversation.channel)}
                      </span>
                      <Badge tone={priorityTone(detail.conversation.priority)}>{detail.conversation.priority}</Badge>
                      <Badge tone={slaTone(detail.conversation.slaStatus)}>{detail.conversation.slaStatus}</Badge>
                      <span className="shrink-0">{detail.conversation.assigneeName || "Unassigned"}</span>
                    </div>
                  </div>
                </div>

                <div className="flex shrink-0 items-center gap-2">
                  {detail.conversation.aiPaused || detail.conversation.mode === "human" ? (
                    <button type="button" className="btn-secondary px-3 text-xs sm:text-sm" onClick={() => void resumeAi()}>
                      <Sparkles size={15} />
                      {labels.resumeAi}
                    </button>
                  ) : null}
                  <button
                    type="button"
                    className="touch-target rounded-md border border-slate-200 text-slate-600 dark:border-slate-800 dark:text-slate-300 xl:hidden"
                    onClick={() => setDetailsDrawerOpen(true)}
                    aria-label={labels.openDetails}
                  >
                    <Info size={18} className="mx-auto" />
                  </button>
                  <button type="button" className="btn-secondary hidden px-3 sm:inline-flex" onClick={() => void fetchDetail(detail.conversation.id, true)} disabled={loadingDetail}>
                    <RefreshCcw size={15} />
                    {labels.refreshAi}
                  </button>
                  <button type="button" className="btn-secondary hidden px-3 sm:inline-flex" onClick={() => void changeStatus("archived")}>
                    <Archive size={15} />
                    {labels.archive}
                  </button>
                  <button type="button" className="btn-secondary hidden px-3 text-red-600 hover:bg-red-50 sm:inline-flex dark:text-red-300 dark:hover:bg-red-950/30" onClick={() => void deleteConversation()}>
                    <Trash2 size={15} />
                    {labels.delete}
                  </button>
                  <button type="button" className="btn-primary hidden px-3 sm:inline-flex" onClick={() => void changeStatus("resolved")}>
                    <Check size={15} />
                    Resolve
                  </button>
                </div>
              </div>
            </header>

            {detail.conversation.aiPaused || detail.conversation.mode === "human" ? (
              <div className="shrink-0 border-b border-amber-200 bg-amber-50 px-4 py-2.5 text-sm text-amber-900 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-200">
                <div className="mx-auto flex max-w-4xl flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="font-bold">{labels.aiPaused}</p>
                    <p className="text-xs opacity-90">{labels.aiPausedHint}</p>
                  </div>
                  <button type="button" className="rounded-md bg-amber-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-amber-700" onClick={() => void resumeAi()}>
                    {labels.resumeAi}
                  </button>
                </div>
              </div>
            ) : null}

            <section ref={timelineRef} className="min-h-0 flex-1 overflow-y-auto px-3 py-4 sm:px-5">
              <div className="mx-auto max-w-4xl space-y-3">
                {detail.timeline.map((item) => (
                  <TimelineEntry key={`${item.type}-${item.id}`} item={item} />
                ))}
                {!detail.timeline.length ? (
                  <div className="rounded-md border border-dashed border-slate-300 p-6 text-center text-sm text-slate-500 dark:border-slate-700">
                    {labels.noTimeline}
                  </div>
                ) : null}
              </div>
            </section>

            <footer className="safe-bottom shrink-0 border-t border-slate-200 bg-white p-3 max-lg:pb-[calc(5.5rem+env(safe-area-inset-bottom))] shadow-[0_-12px_32px_rgba(15,23,42,0.08)] dark:border-slate-800 dark:bg-slate-950 sm:px-4">
              <div className="mx-auto max-w-4xl flex flex-col gap-2">
                {savedRepliesOpen ? (
                  <div className="flex gap-1 overflow-x-auto pb-1 no-scrollbar">
                    {savedReplies.length ? savedReplies.slice(0, 8).map((reply) => (
                      <button key={reply.id} type="button" className="inline-flex h-8 shrink-0 items-center rounded-md border border-slate-200 px-2 text-xs font-semibold hover:bg-slate-50 dark:border-slate-800 dark:hover:bg-slate-900" onClick={() => setComposer(reply.body)}>
                        {reply.title}
                      </button>
                    )) : (
                      <span className="text-xs text-slate-400">-</span>
                    )}
                  </div>
                ) : null}

                {draftAttachments.length ? (
                  <div className="flex gap-2 overflow-x-auto pb-1 no-scrollbar">
                    {draftAttachments.map((attachment) => (
                      <div key={attachment.id} className="relative flex min-w-40 max-w-56 items-center gap-2 rounded-md border border-slate-200 bg-slate-50 p-2 dark:border-slate-800 dark:bg-slate-900">
                        <AttachmentIcon attachment={attachment} />
                        <span className="min-w-0 flex-1 truncate text-xs font-semibold">{attachment.name}</span>
                        <button
                          type="button"
                          className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-slate-200 text-slate-600 dark:bg-slate-800 dark:text-slate-300"
                          onClick={() => setDraftAttachments((current) => current.filter((item) => item.id !== attachment.id))}
                          aria-label={labels.removeAttachment}
                        >
                          <X size={12} />
                        </button>
                      </div>
                    ))}
                  </div>
                ) : null}

                <div className="flex items-end gap-2">
                  <input ref={attachmentInputRef} type="file" className="hidden" multiple accept="image/*,audio/*,.pdf,.doc,.docx,.txt,.csv" onChange={(event) => void prepareAttachments(event.target.files)} />
                  <button
                    type="button"
                    className="touch-target shrink-0 rounded-md border border-slate-200 text-slate-600 hover:bg-slate-50 dark:border-slate-800 dark:text-slate-300 dark:hover:bg-slate-900"
                    onClick={() => attachmentInputRef.current?.click()}
                    aria-label={labels.attach}
                    disabled={sendingReply}
                  >
                    <Paperclip size={18} className="mx-auto" />
                  </button>
                  <button
                    type="button"
                    className={`touch-target shrink-0 rounded-md border ${recordingAudio ? "border-red-300 bg-red-50 text-red-600 dark:border-red-900 dark:bg-red-950/30 dark:text-red-300" : "border-slate-200 text-slate-600 hover:bg-slate-50 dark:border-slate-800 dark:text-slate-300 dark:hover:bg-slate-900"}`}
                    onClick={() => (recordingAudio ? stopAudioRecording() : void startAudioRecording())}
                    aria-label={recordingAudio ? labels.stopRecording : labels.startRecording}
                    disabled={sendingReply}
                    title={recordingAudio ? labels.stopRecording : labels.startRecording}
                  >
                    <Mic size={18} className="mx-auto" />
                  </button>
                  <textarea
                    ref={composerRef}
                    value={composer}
                    onChange={(event) => setComposer(event.target.value)}
                    placeholder={labels.reply}
                    className="field max-h-40 min-h-16 resize-none rounded-md text-base leading-6 sm:min-h-20 sm:text-sm"
                    rows={2}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" && !event.shiftKey) {
                        event.preventDefault();
                        void sendReply();
                      }
                    }}
                  />
                  <button
                    type="button"
                    className="btn-primary h-12 min-w-[5.75rem] shrink-0 px-3"
                    disabled={sendingReply || (!composer.trim() && !draftAttachments.length)}
                    onClick={() => void sendReply()}
                  >
                    {sendingReply ? <Loader2 size={17} className="animate-spin" /> : <SendHorizonal size={17} className="rtl:rotate-180" />}
                    <span>{sendingReply ? labels.sending : labels.send}</span>
                  </button>
                </div>

                <div className="flex gap-1 overflow-x-auto pb-1 no-scrollbar">
                  <button type="button" className="inline-flex h-8 shrink-0 items-center gap-1 rounded-md border border-slate-200 px-2 text-xs font-semibold hover:bg-slate-50 dark:border-slate-800 dark:hover:bg-slate-900" onClick={() => setSavedRepliesOpen((value) => !value)}>
                    <MoreHorizontal size={13} />
                    {labels.savedReplies}
                  </button>
                  {smartActions.map(([id, label]) => (
                    <button key={id} type="button" className="inline-flex h-8 shrink-0 items-center gap-1 rounded-md border border-blue-200 bg-blue-50 px-2 text-xs font-semibold text-blue-700 hover:bg-blue-100 disabled:opacity-50 dark:border-blue-900 dark:bg-blue-950/30 dark:text-blue-300" disabled={aiBusy} onClick={() => void requestSmartReply(id)}>
                      <Sparkles size={13} />
                      {label}
                    </button>
                  ))}
                  {rewriteActions.map(([id, label]) => (
                    <button key={id} type="button" className="inline-flex h-8 shrink-0 items-center gap-1 rounded-md border border-slate-200 px-2 text-xs font-semibold hover:bg-slate-50 disabled:opacity-50 dark:border-slate-800 dark:hover:bg-slate-900" disabled={aiBusy || !composer.trim()} onClick={() => void rewriteComposer(id)}>
                      <Wand2 size={13} />
                      {label}
                    </button>
                  ))}
                </div>
              </div>
            </footer>
          </section>
        ) : (
          <div className="flex flex-1 items-center justify-center p-6 text-center text-sm text-slate-500">
            <div className="max-w-sm">
              <MessageSquare className="mx-auto mb-3 text-slate-400" size={32} />
              <h1 className="text-base font-bold text-slate-900 dark:text-slate-100">{labels.noConversation}</h1>
              <p className="mt-2 leading-6">{labels.noConversationHint}</p>
              <button type="button" className="btn-primary mt-4 lg:hidden" onClick={() => setListDrawerOpen(true)}>
                <Menu size={17} />
                {labels.openList}
              </button>
            </div>
          </div>
        )}
        {error ? (
          <div className="absolute bottom-4 left-1/2 z-30 -translate-x-1/2 rounded-md bg-red-600 px-4 py-2 text-sm font-semibold text-white shadow-lg">
            {error}
          </div>
        ) : null}
      </main>

      <aside className="hidden min-w-0 min-h-0 border-l border-slate-200 dark:border-slate-800 xl:block">
        {detailsPane}
      </aside>

      {listDrawerOpen ? (
        <div className="fixed inset-0 z-50 bg-slate-950/40 lg:hidden">
          <div className="safe-top safe-bottom h-full w-[min(92vw,24rem)] max-w-full shadow-2xl rtl:mr-auto ltr:ml-auto">
            {listPane}
          </div>
        </div>
      ) : null}

      {detailsDrawerOpen ? (
        <div className="fixed inset-0 z-50 bg-slate-950/40 xl:hidden">
          <div className="safe-top safe-bottom ms-auto h-full w-[min(92vw,24rem)] max-w-full shadow-2xl">
            {detailsPane}
          </div>
        </div>
      ) : null}
    </div>
  );
}

function ConversationRow({
  conversation,
  active,
  selected,
  top,
  onSelect,
  onToggle
}: {
  conversation: ConversationItem;
  active: boolean;
  selected: boolean;
  top: number;
  onSelect: () => void;
  onToggle: () => void;
}) {
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onSelect}
      onKeyDown={(event) => {
        if (event.key === "Enter") onSelect();
      }}
      className={`absolute left-0 right-0 h-[132px] cursor-pointer border-b border-slate-100 p-3 transition dark:border-slate-900 ${
        active
          ? "border-s-4 border-s-blue-600 bg-blue-50/90 ring-1 ring-inset ring-blue-300 dark:border-s-blue-500 dark:bg-blue-950/40 dark:ring-blue-800"
          : "bg-white hover:bg-slate-50 dark:bg-slate-950 dark:hover:bg-slate-900"
      }`}
      style={{ transform: `translateY(${top}px)` }}
    >
      <div className="flex items-start gap-3">
        <input
          type="checkbox"
          checked={selected}
          onChange={(event) => {
            event.stopPropagation();
            onToggle();
          }}
          onClick={(event) => event.stopPropagation()}
          className="mt-2 h-4 w-4 rounded border-slate-300"
        />
        <Avatar name={conversation.contactName} src={conversation.avatarUrl} fallback={conversation.contactInitials} />
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <h3 className="truncate text-sm font-bold">{conversation.contactName}</h3>
            <time className="shrink-0 text-[11px] text-slate-500">{relativeTime(conversation.lastMessageAt)}</time>
          </div>
          <p className="mt-1 line-clamp-2 text-xs leading-5 text-slate-500 dark:text-slate-400">{conversation.lastMessage}</p>
          <div className="mt-2 flex flex-wrap items-center gap-1.5">
            <Badge tone="slate">{channelLabel(conversation.channel)}</Badge>
            <Badge tone={conversation.aiStatus === "escalated" ? "red" : conversation.aiStatus === "needs_review" ? "amber" : "blue"}>{conversation.aiStatus}</Badge>
            <Badge tone={conversation.agentStatus === "assigned" ? "emerald" : "slate"}>{conversation.agentStatus}</Badge>
            {conversation.badges.slice(0, 3).map((badge) => (
              <Badge key={badge} tone={badgeTone(badge)}>{badge}</Badge>
            ))}
          </div>
        </div>
        {conversation.unreadCount > 0 ? (
          <span className="flex h-6 min-w-6 items-center justify-center rounded-full bg-blue-600 px-1.5 text-xs font-bold text-white">
            {conversation.unreadCount}
          </span>
        ) : null}
      </div>
    </div>
  );
}

function TimelineEntry({ item }: { item: TimelineItem }) {
  if (item.type === "message") {
    const outgoing = item.direction === "outgoing";
    return (
      <div className={`flex ${outgoing ? "justify-end" : "justify-start"}`}>
        <div className={`max-w-[76%] rounded-md border px-3 py-2 shadow-sm ${
          outgoing
            ? "border-blue-600 bg-blue-600 text-white"
            : "border-slate-200 bg-white text-slate-900 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-100"
        }`}>
          <p className="whitespace-pre-wrap text-sm leading-6">{item.content}</p>
          {item.attachments?.length ? (
            <div className="mt-2 space-y-1.5">
              {item.attachments.map((attachment) => {
                const isAudio = attachment.type === "audio" || attachment.mimeType?.startsWith("audio/");
                return (
                  <div
                    key={attachment.id || attachment.url || attachment.name}
                    className={`flex max-w-full items-center gap-2 rounded-md px-2 py-1.5 text-xs ${
                      outgoing ? "bg-white/10 text-white" : "bg-slate-50 text-slate-700 dark:bg-slate-900 dark:text-slate-200"
                    }`}
                  >
                    <AttachmentIcon attachment={attachment} />
                    {isAudio && attachment.url ? (
                      <audio controls src={attachment.url} className="h-8 max-w-[220px]" />
                    ) : (
                      <span className="min-w-0 truncate">{attachment.name || attachment.mimeType || "Attachment"}</span>
                    )}
                  </div>
                );
              })}
            </div>
          ) : null}
          <div className={`mt-1 flex flex-wrap items-center gap-1.5 text-[11px] ${outgoing ? "text-blue-100" : "text-slate-400"}`}>
            <span>{item.sender} · {formatTime(item.createdAt)}</span>
            {outgoing ? (
              <span className={`rounded px-1.5 py-0.5 font-semibold ${
                item.deliveryStatus === "failed"
                  ? "bg-red-500/20 text-red-100"
                  : item.deliveryStatus === "queued" || item.deliveryStatus === "sending"
                    ? "bg-white/15 text-white/90"
                    : "bg-white/10 text-white/80"
              }`}>
                {item.deliveryStatus || "sent"}
              </span>
            ) : null}
          </div>
        </div>
      </div>
    );
  }

  if (item.type === "note") {
    return (
      <div className="mx-auto max-w-2xl rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-200">
        <div className="mb-1 flex items-center gap-2 text-xs font-bold">
          <StickyNote size={14} />
          {item.visibility === "team" ? "Team Note" : "Internal Note"} · {formatTime(item.createdAt)}
        </div>
        <p className="whitespace-pre-wrap leading-6">{item.content}</p>
      </div>
    );
  }

  return (
    <div className="mx-auto flex max-w-2xl items-start gap-2 rounded-md border border-slate-200 bg-white p-2 text-xs text-slate-600 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-300">
      {item.type === "ai_event" ? <Sparkles size={15} className="mt-0.5 text-blue-500" /> : <MessageSquare size={15} className="mt-0.5" />}
      <div>
        <div className="font-bold">{item.title || item.type} · {formatTime(item.createdAt)}</div>
        {item.content ? <p className="mt-1 leading-5">{item.content}</p> : null}
      </div>
    </div>
  );
}

function Panel({ title, icon, children }: { title: string; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className="border-b border-slate-100 p-4 dark:border-slate-900">
      <h2 className="mb-3 flex items-center gap-2 text-sm font-bold">
        {icon}
        {title}
      </h2>
      {children}
    </section>
  );
}

function Select({ label, value, onChange, options }: { label: string; value: string; onChange: (value: string) => void; options: string[] }) {
  return (
    <label className="block">
      <span className="sr-only">{label}</span>
      <select value={value} onChange={(event) => onChange(event.target.value)} className="field h-10 rounded-md text-xs capitalize">
        <option value="">{label}</option>
        {options.map((option) => (
          <option key={option} value={option}>{option}</option>
        ))}
      </select>
    </label>
  );
}

function Metric({ label, value, tone = "blue" }: { label: string; value: string; tone?: "blue" | "amber" }) {
  return (
    <div className={`rounded-md border p-2 ${tone === "amber" ? "border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-300" : "border-blue-200 bg-blue-50 text-blue-800 dark:border-blue-900 dark:bg-blue-950/30 dark:text-blue-300"}`}>
      <div className="text-[10px] font-bold uppercase">{label}</div>
      <div className="text-sm font-extrabold">{value}</div>
    </div>
  );
}

function MiniStat({ label, value, tone }: { label: string; value: string; tone: string }) {
  return (
    <div className={`rounded-md border p-2 ${toneClass(tone)}`}>
      <div className="truncate text-[10px] font-bold uppercase opacity-70">{label}</div>
      <div className="truncate text-xs font-extrabold capitalize">{value}</div>
    </div>
  );
}

function InfoBlock({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="mb-1 text-[11px] font-bold uppercase text-slate-400">{label}</div>
      <p className="rounded-md bg-slate-50 p-2 text-sm leading-6 dark:bg-slate-900">{value}</p>
    </div>
  );
}

function ContactLine({ icon, value }: { icon: React.ReactNode; value: string }) {
  return (
    <div className="flex items-center gap-2 rounded-md bg-slate-50 px-2 py-1.5 text-xs dark:bg-slate-900">
      <span className="text-slate-400">{icon}</span>
      <span className="min-w-0 truncate">{value}</span>
    </div>
  );
}

function Avatar({ name, src, fallback }: { name: string; src?: string; fallback?: string }) {
  if (src) {
    return <img src={src} alt="" className="h-10 w-10 shrink-0 rounded-md object-cover" />;
  }
  return (
    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-slate-900 text-sm font-extrabold text-white dark:bg-slate-100 dark:text-slate-950">
      {fallback || name.slice(0, 2).toUpperCase()}
    </div>
  );
}

function Badge({ children, tone }: { children: React.ReactNode; tone: string }) {
  return (
    <span className={`inline-flex h-5 max-w-full items-center rounded px-1.5 text-[11px] font-bold capitalize ${badgeClass(tone)}`}>
      <span className="truncate">{children}</span>
    </span>
  );
}

function ChannelGlyph({ channel }: { channel: string }) {
  const normalized = channel.toLowerCase();
  if (normalized.includes("whatsapp")) return <MessageCircle size={15} className="text-emerald-500" />;
  if (normalized.includes("facebook") || normalized.includes("messenger")) return <MessageCircle size={15} className="text-blue-500" />;
  if (normalized.includes("instagram")) return <MessageCircle size={15} className="text-pink-500" />;
  if (normalized.includes("telegram")) return <SendHorizonal size={15} className="text-sky-500" />;
  if (normalized.includes("email")) return <Mail size={15} className="text-amber-500" />;
  return <Globe size={15} className="text-slate-500" />;
}

function AttachmentIcon({ attachment }: { attachment: Pick<AttachmentDraft, "type" | "url" | "name" | "mimeType"> }) {
  if (attachment.type === "image" || attachment.mimeType?.startsWith("image/")) {
    return <img src={attachment.url} alt={attachment.name || ""} className="h-7 w-7 shrink-0 rounded object-cover" />;
  }
  if (attachment.type === "audio" || attachment.mimeType?.startsWith("audio/")) {
    return <Mic size={16} className="shrink-0" />;
  }
  if (attachment.type === "pdf" || attachment.mimeType === "application/pdf") {
    return <FileText size={16} className="shrink-0" />;
  }
  return <Paperclip size={16} className="shrink-0" />;
}

function attachmentType(file: File): AttachmentDraft["type"] {
  if (file.type.startsWith("image/")) return "image";
  if (file.type.startsWith("audio/")) return "audio";
  if (file.type === "application/pdf") return "pdf";
  return "file";
}

function fileToDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}
function blobToDataUrl(blob: Blob) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

async function readJson<T = any>(response: Response): Promise<T> {
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload?.error || "Request failed.");
  return payload as T;
}

function dedupeConversations(items: ConversationItem[]) {
  const map = new Map<string, ConversationItem>();
  for (const item of items) map.set(item.id, item);
  return [...map.values()];
}

function parseRealtimePayload<T>(raw: string): T | null {
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

function normalizeRealtimeMessagePayload(payload: RealtimeMessageCreatedPayload) {
  const message = payload.message || {};
  const conversation = payload.conversation || {};
  const conversationId = message.conversationId || conversation.id || payload.conversationId || "";
  const createdAt = message.createdAt || conversation.lastMessageAt || new Date().toISOString();

  return {
    id: message.id || payload.messageId || `${conversationId}-${createdAt}`,
    conversationId,
    content: message.content || payload.content || conversation.lastMessage || "",
    direction: message.direction || payload.direction || "incoming",
    sender: message.sender || payload.sender || (message.direction === "outgoing" ? "agent" : "user"),
    senderType: message.senderType || (message.direction === "outgoing" ? "agent" : "customer"),
    provider: message.provider || payload.provider || conversation.provider || conversation.channel || "website",
    deliveryStatus: message.deliveryStatus || "sent",
    createdAt,
    attachments: message.attachments || [],
    conversation,
    contact: payload.contact || {},
  };
}

function patchConversationsWithRealtimeMessage(
  conversations: ConversationItem[],
  realtime: ReturnType<typeof normalizeRealtimeMessagePayload>
) {
  let exists = false;
  const items = conversations.map((conversation) => {
    if (conversation.id !== realtime.conversationId) return conversation;
    exists = true;
    const incomingUnread = realtime.direction === "incoming" ? 1 : 0;
    return {
      ...conversation,
      channel: realtime.provider || conversation.channel,
      lastMessage: realtime.content || conversation.lastMessage,
      lastMessageAt: realtime.createdAt || conversation.lastMessageAt,
      unreadCount: typeof realtime.conversation.unreadCount === "number"
        ? realtime.conversation.unreadCount
        : conversation.unreadCount + incomingUnread,
      status: realtime.conversation.status || conversation.status,
      priority: realtime.conversation.priority || conversation.priority,
      contactName: realtime.contact.name || conversation.contactName,
      avatarUrl: realtime.contact.avatarUrl || conversation.avatarUrl,
    };
  });

  return {
    exists,
    items: dedupeConversations(items).sort(
      (a, b) => new Date(b.lastMessageAt).getTime() - new Date(a.lastMessageAt).getTime()
    ),
  };
}

function appendRealtimeMessageToDetail(
  current: ConversationDetail | null | undefined,
  realtime: ReturnType<typeof normalizeRealtimeMessagePayload>
) {
  if (!current) return current || null;
  if (current.timeline.some((item) => item.id === realtime.id)) return current;

  const nextTimelineItem: TimelineItem = {
    id: realtime.id,
    type: "message",
    direction: realtime.direction,
    sender: realtime.sender,
    senderType: realtime.senderType,
    content: realtime.content,
    deliveryStatus: realtime.deliveryStatus,
    createdAt: realtime.createdAt,
    attachments: realtime.attachments,
  };

  return {
    ...current,
    conversation: {
      ...current.conversation,
      channel: realtime.provider || current.conversation.channel,
      status: realtime.conversation.status || current.conversation.status,
      priority: realtime.conversation.priority || current.conversation.priority,
      lastMessageAt: realtime.createdAt || current.conversation.lastMessageAt,
    },
    timeline: [...current.timeline, nextTimelineItem].sort(
      (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
    ),
  };
}


function channelLabel(channel: string) {
  const map: Record<string, string> = {
    facebook: "Messenger",
    website: "Website",
    whatsapp: "WhatsApp",
    instagram: "Instagram",
    telegram: "Telegram",
    email: "Email"
  };
  return map[channel] || channel || "Website";
}

function relativeTime(value: string) {
  if (!value) return "";
  const diff = Date.now() - new Date(value).getTime();
  if (diff < 60_000) return "now";
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h`;
  return `${Math.floor(diff / 86_400_000)}d`;
}

function formatTime(value: string) {
  return value ? new Date(value).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "";
}

function formatDuration(ms: number) {
  if (!ms) return "-";
  const minutes = Math.round(ms / 60_000);
  if (minutes < 60) return `${minutes}m`;
  return `${Math.round((minutes / 60) * 10) / 10}h`;
}

function formatMoney(value: number) {
  if (!value) return "$0";
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(value);
}

function badgeTone(badge: string) {
  if (/urgent|escalated/i.test(badge)) return "red";
  if (/vip/i.test(badge)) return "amber";
  if (/new lead/i.test(badge)) return "emerald";
  if (/human/i.test(badge)) return "slate";
  return "blue";
}

function priorityTone(priority: string) {
  if (priority === "urgent") return "red";
  if (priority === "high") return "amber";
  if (priority === "low") return "slate";
  return "blue";
}

function sentimentTone(sentiment: string) {
  if (sentiment === "negative") return "red";
  if (sentiment === "positive") return "emerald";
  return "slate";
}

function slaTone(status: string) {
  if (status === "breached") return "red";
  if (status === "at_risk") return "amber";
  if (status === "met") return "emerald";
  return "blue";
}

function badgeClass(tone: string) {
  const classes: Record<string, string> = {
    red: "bg-red-50 text-red-700 ring-1 ring-red-200 dark:bg-red-950/30 dark:text-red-300 dark:ring-red-900/60",
    amber: "bg-amber-50 text-amber-700 ring-1 ring-amber-200 dark:bg-amber-950/30 dark:text-amber-300 dark:ring-amber-900/60",
    emerald: "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200 dark:bg-emerald-950/30 dark:text-emerald-300 dark:ring-emerald-900/60",
    blue: "bg-blue-50 text-blue-700 ring-1 ring-blue-200 dark:bg-blue-950/30 dark:text-blue-300 dark:ring-blue-900/60",
    slate: "bg-slate-100 text-slate-700 ring-1 ring-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:ring-slate-700"
  };
  return classes[tone] || classes.slate;
}

function toneClass(tone: string) {
  return badgeClass(tone).replace("ring-1", "");
}
