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
    .slice(0, 3)
    .map(([key, value]) => `${key}: ${typeof value === "object" ? JSON.stringify(value) : String(value)}`)
    .join(" · ");
}

export function TasksMenu() {
  const { locale } = useI18n();
  const isAr = locale === "ar";
  const [open, setOpen] = useState(false);
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
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className="relative inline-flex h-10 w-10 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-700 shadow-sm transition hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-200 dark:hover:bg-slate-900"
        aria-label={isAr ? "مهام الموظف الافتراضي" : "AI recorded tasks"}
        title={isAr ? "مهام الموظف الافتراضي" : "AI recorded tasks"}
      >
        <ClipboardCheck size={18} />
        {openCount ? (
          <span className="absolute -right-1 -top-1 min-w-5 rounded-full bg-emerald-500 px-1.5 text-[10px] font-bold leading-5 text-white">
            {openCount}
          </span>
        ) : null}
      </button>

      {open ? (
        <div className={`absolute top-12 z-50 w-[390px] max-w-[calc(100vw-2rem)] overflow-hidden rounded-lg border border-slate-200 bg-white shadow-xl dark:border-slate-800 dark:bg-slate-950 ${isAr ? "left-0" : "right-0"}`}>
          <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3 dark:border-slate-800">
            <div>
              <p className="text-sm font-bold text-ink">{isAr ? "مهام سجّلها الموظف الافتراضي" : "AI recorded tasks"}</p>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {isAr ? "تحديث تلقائي كل 12 ثانية" : "Auto refreshes every 12 seconds"}
              </p>
            </div>
            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-1 text-[11px] font-semibold text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300">
              <ListChecks size={12} />
              {openCount}
            </span>
          </div>

          <div className="max-h-[440px] overflow-y-auto">
            {loading ? (
              <div className="p-6 text-center text-sm text-slate-500 dark:text-slate-400">
                {isAr ? "جار تحميل المهام..." : "Loading tasks..."}
              </div>
            ) : tasks.length ? (
              tasks.map((task) => (
                <Link
                  key={task.id}
                  href={task.conversationId ? `/dashboard/conversations?conversationId=${task.conversationId}` : "/dashboard/conversations"}
                  onClick={() => setOpen(false)}
                  className="flex gap-3 border-b border-slate-100 px-4 py-3 transition hover:bg-slate-50 dark:border-slate-800 dark:hover:bg-slate-900"
                >
                  <span className="mt-1 flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300">
                    <ClipboardCheck size={17} />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center justify-between gap-2">
                      <span className="truncate text-sm font-semibold text-ink">{task.title}</span>
                      <span className="shrink-0 text-[11px] text-slate-400">{formatDate(task.createdAt, locale)}</span>
                    </span>
                    <span className="mt-1 block truncate text-xs text-slate-500 dark:text-slate-400">
                      {summarizeDetails(task.details) || (isAr ? "لا توجد تفاصيل إضافية" : "No extra details")}
                    </span>
                    <span className="mt-2 flex items-center justify-between gap-2 text-[11px]">
                      <span className="rounded bg-slate-100 px-2 py-0.5 font-semibold uppercase text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                        {task.type}
                      </span>
                      <span className="inline-flex items-center gap-1 text-emerald-600 dark:text-emerald-300">
                        <Clock3 size={12} />
                        {task.status}
                      </span>
                    </span>
                  </span>
                </Link>
              ))
            ) : (
              <div className="p-6 text-center text-sm text-slate-500 dark:text-slate-400">
                {isAr ? "لا توجد مهام مسجلة بعد." : "No recorded tasks yet."}
              </div>
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}
