"use client";

import { useEffect, useState } from "react";
import { AlertTriangle, CheckCircle, Clock, Info, ShieldAlert, XCircle } from "lucide-react";

type LogEvent = {
  _id: string;
  eventType: string;
  ipAddress: string;
  email?: string;
  userId?: string;
  details?: any;
  severity: "info" | "warning" | "critical";
  createdAt: string;
};

function SeverityBadge({ severity }: { severity: string }) {
  switch (severity) {
    case "critical":
      return <span className="inline-flex items-center gap-1 rounded-full bg-rose-100 px-2 py-0.5 text-xs font-medium text-rose-700 dark:bg-rose-950 dark:text-rose-300"><ShieldAlert size={10} /> Critical</span>;
    case "warning":
      return <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700 dark:bg-amber-950 dark:text-amber-300"><AlertTriangle size={10} /> Warning</span>;
    default:
      return <span className="inline-flex items-center gap-1 rounded-full bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-700 dark:bg-blue-950 dark:text-blue-300"><Info size={10} /> Info</span>;
  }
}

function EventTypeIcon({ type }: { type: string }) {
  switch (type) {
    case "login_success":
      return <CheckCircle size={16} className="text-emerald-500" />;
    case "login_failed":
      return <XCircle size={16} className="text-rose-500" />;
    case "suspicious_activity":
    case "rate_limit_exceeded":
      return <ShieldAlert size={16} className="text-amber-500" />;
    default:
      return <Info size={16} className="text-blue-500" />;
  }
}

export function SystemLogs() {
  const [logs, setLogs] = useState<LogEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState("all");

  useEffect(() => {
    fetchLogs(filter);
  }, [filter]);

  const fetchLogs = async (type: string) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/developer/logs?type=${type}&limit=50`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to load logs");
      setLogs(data.logs || []);
      setError(null);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-950">
      <div className="mb-4 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <h2 className="flex items-center gap-2 text-lg font-black text-ink dark:text-white">
          <ShieldAlert size={19} /> سجلات النظام والأمان
        </h2>
        <select
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-1.5 text-sm dark:border-slate-800 dark:bg-slate-900 dark:text-white"
        >
          <option value="all">جميع السجلات</option>
          <option value="login_success">تسجيل دخول ناجح</option>
          <option value="login_failed">دخول فاشل</option>
          <option value="rate_limit_exceeded">تخطي حدود الطلبات (Rate Limit)</option>
          <option value="suspicious_activity">سلوك مريب</option>
        </select>
      </div>

      {error ? (
        <div className="rounded-2xl bg-rose-50 p-4 text-sm text-rose-600 dark:bg-rose-950/30 dark:text-rose-400">
          {error}
        </div>
      ) : loading ? (
        <div className="flex animate-pulse flex-col gap-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-16 rounded-2xl bg-slate-100 dark:bg-slate-900"></div>
          ))}
        </div>
      ) : logs.length === 0 ? (
        <div className="rounded-2xl bg-slate-50 p-6 text-center text-sm text-slate-500 dark:bg-slate-900/50 dark:text-slate-400">
          لا توجد سجلات مطابقة للفلتر الحالي.
        </div>
      ) : (
        <div className="space-y-3 overflow-y-auto max-h-[500px] pr-2">
          {logs.map((log) => (
            <div
              key={log._id}
              className="flex flex-col gap-2 rounded-2xl border border-slate-100 p-4 dark:border-slate-800"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-center gap-3">
                  <EventTypeIcon type={log.eventType} />
                  <div>
                    <p className="font-bold text-slate-900 dark:text-slate-100">{log.eventType}</p>
                    <p className="text-xs text-slate-500 dark:text-slate-400">{log.email || log.ipAddress || "System"}</p>
                  </div>
                </div>
                <div className="flex flex-col items-end gap-1">
                  <SeverityBadge severity={log.severity} />
                  <span className="flex items-center gap-1 text-[10px] text-slate-400">
                    <Clock size={10} /> {new Date(log.createdAt).toLocaleString()}
                  </span>
                </div>
              </div>
              {log.details && (
                <div className="mt-2 rounded-xl bg-slate-50 p-3 text-xs font-mono text-slate-600 dark:bg-slate-900 dark:text-slate-300 overflow-x-auto">
                  {JSON.stringify(log.details, null, 2)}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
