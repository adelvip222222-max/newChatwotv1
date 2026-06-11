"use client";

import Link from "next/link";
import { ClipboardCheck, Clock3, ListChecks } from "lucide-react";
import { useEffect, useState } from "react";
import { useI18n } from "@/components/i18n-provider";

type RecordedTask = {
  id: string;
  conversationId: string;
  type: string;
  title: string;
  details: Record<string, unknown>;
  status: string;
  createdAt: string;
};

function formatDate(value: string, locale: "en" | "ar") {
  return new Date(value).toLocaleString(locale === "ar" ? "ar-EG" : "en-US", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit"
  });
}

function summarizeDetails(details: Record<string, unknown>) {
  const entries = Object.entries(details).filter(([, value]) => value !== null && value !== undefined && String(value).trim() !== "");
  if (!entries.length) return "";
  return entries
    .map(([key, value]) => `${key}: ${typeof value === "object" ? JSON.stringify(value) : String(value)}`)
    .join(" · ");
}

export default function TasksPage() {
  const { locale } = useI18n();
  const isAr = locale === "ar";
  const [tasks, setTasks] = useState<RecordedTask[]>([]);
  const [openCount, setOpenCount] = useState(0);
  const [loading, setLoading] = useState(true);

  async function loadTasks() {
    try {
      const response = await fetch("/api/notifications/tasks", { cache: "no-store" });
      if (!response.ok) return;
      const data = await response.json();
      setTasks(data.tasks || []);
      setOpenCount(data.openCount || 0);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadTasks();
    const interval = window.setInterval(loadTasks, 12000);
    return () => window.clearInterval(interval);
  }, []);

  return (
    <div className="mx-auto max-w-2xl">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold text-ink">
            <ClipboardCheck className="text-emerald-600" />
            {isAr ? "مهام الموظف الافتراضي" : "AI recorded tasks"}
            {openCount > 0 && (
              <span className="rounded-full bg-emerald-500 px-2.5 py-0.5 text-xs font-bold text-white">
                {openCount}
              </span>
            )}
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            {isAr ? "تحديث تلقائي كل 12 ثانية" : "Auto refreshes every 12 seconds"}
          </p>
        </div>
        <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300">
          <ListChecks size={14} />
          {openCount}
        </span>
      </div>

      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-950">
        {loading ? (
          <div className="p-8 text-center text-sm text-slate-500">
            {isAr ? "جار تحميل المهام..." : "Loading tasks..."}
          </div>
        ) : tasks.length ? (
          <div className="divide-y divide-slate-100 dark:divide-slate-800">
            {tasks.map((task) => (
              <Link
                key={task.id}
                href={task.conversationId ? `/dashboard/conversations?conversationId=${task.conversationId}` : "/dashboard/conversations"}
                className="flex gap-4 p-4 transition hover:bg-slate-50 dark:hover:bg-slate-900/50"
              >
                <span className="mt-1 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300">
                  <ClipboardCheck size={18} />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <span className="truncate text-sm font-semibold text-ink">{task.title}</span>
                    <span className="shrink-0 text-xs text-slate-400">{formatDate(task.createdAt, locale)}</span>
                  </div>
                  <p className="mt-1.5 line-clamp-3 text-sm text-slate-600 dark:text-slate-400">
                    {summarizeDetails(task.details) || (isAr ? "لا توجد تفاصيل إضافية" : "No extra details")}
                  </p>
                  <div className="mt-3 flex items-center justify-between gap-2 text-xs">
                    <span className="rounded-lg bg-slate-100 px-2.5 py-1 font-semibold uppercase tracking-wider text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                      {task.type}
                    </span>
                    <span className="inline-flex items-center gap-1.5 font-medium text-emerald-600 dark:text-emerald-300">
                      <Clock3 size={14} />
                      {task.status}
                    </span>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        ) : (
          <div className="p-12 text-center text-sm text-slate-500">
            {isAr ? "لا توجد مهام مسجلة بعد." : "No recorded tasks yet."}
          </div>
        )}
      </div>
    </div>
  );
}
