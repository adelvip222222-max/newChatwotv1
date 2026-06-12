"use client";

import { useEffect, useMemo, useState, useTransition, type ComponentType } from "react";
import { SystemLogs } from "./system-logs";
import {
  Activity,
  AlertTriangle,
  Archive,
  CloudDownload,
  Cpu,
  Database,
  HardDrive,
  RefreshCw,
  RotateCcw,
  Server,
  ShieldCheck,
  Wifi
} from "lucide-react";

type BackupSummary = {
  name: string;
  sizeBytes: number;
  createdAt: string;
};

type DeveloperMetrics = {
  generatedAt: string;
  node: {
    version: string;
    env: string;
    pid: number;
    uptimeSeconds: number;
    memory: {
      rss: number;
      heapTotal: number;
      heapUsed: number;
      external: number;
      arrayBuffers: number;
    };
  };
  host: {
    platform: string;
    arch: string;
    hostname: string;
    uptimeSeconds: number;
    cpuCount: number;
    loadAverage: number[];
    memoryTotalBytes: number;
    memoryFreeBytes: number;
    memoryUsedPercent: number;
  };
  disk: {
    ok: boolean;
    filesystem?: string;
    sizeBytes?: number;
    usedBytes?: number;
    availableBytes?: number;
    usedPercent?: number;
    mount?: string;
    error?: string;
  };
  mongo: {
    ok: boolean;
    database?: string;
    collections?: number;
    objects?: number;
    dataSizeBytes?: number;
    storageSizeBytes?: number;
    indexSizeBytes?: number;
    error?: string;
  };
  redis: {
    ok: boolean;
    latencyMs?: number;
    error?: string;
  };
  pm2: {
    ok: boolean;
    processes: Array<{
      name: string;
      status: string;
      cpu?: number;
      memoryBytes?: number;
      restarts?: number;
      uptime?: number;
    }>;
    error?: string;
  };
  backups: BackupSummary[];
  controls: {
    restartEnabled: boolean;
    backupDir: string;
  };
};

function formatBytes(value?: number) {
  if (!Number.isFinite(value || NaN)) return "—";
  const units = ["B", "KB", "MB", "GB", "TB"];
  let size = Number(value);
  let unit = 0;
  while (size >= 1024 && unit < units.length - 1) {
    size /= 1024;
    unit += 1;
  }
  return `${size >= 10 || unit === 0 ? size.toFixed(0) : size.toFixed(1)} ${units[unit]}`;
}

function formatDuration(seconds?: number) {
  if (!Number.isFinite(seconds || NaN)) return "—";
  const total = Math.max(0, Math.floor(Number(seconds)));
  const days = Math.floor(total / 86400);
  const hours = Math.floor((total % 86400) / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  if (days) return `${days}d ${hours}h`;
  if (hours) return `${hours}h ${minutes}m`;
  return `${minutes}m`;
}

function statusTone(ok: boolean) {
  return ok
    ? "border-emerald-100 bg-emerald-50 text-emerald-700 dark:border-emerald-900/50 dark:bg-emerald-950/30 dark:text-emerald-300"
    : "border-rose-100 bg-rose-50 text-rose-700 dark:border-rose-900/50 dark:bg-rose-950/30 dark:text-rose-300";
}

function StatCard({
  title,
  value,
  hint,
  icon: Icon
}: {
  title: string;
  value: string | number;
  hint?: string;
  icon: ComponentType<{ size?: number; className?: string }>;
}) {
  return (
    <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-950">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-slate-400">{title}</p>
          <p className="mt-3 text-2xl font-black text-ink dark:text-white">{value}</p>
          {hint ? <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">{hint}</p> : null}
        </div>
        <span className="rounded-2xl bg-slate-100 p-3 text-slate-700 dark:bg-slate-900 dark:text-slate-200">
          <Icon size={20} />
        </span>
      </div>
    </div>
  );
}

function HealthPill({ ok, label }: { ok: boolean; label: string }) {
  return (
    <span className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-bold ${statusTone(ok)}`}>
      <span className={`h-2 w-2 rounded-full ${ok ? "bg-emerald-500" : "bg-rose-500"}`} />
      {label}
    </span>
  );
}

export function DeveloperPanel() {
  const [metrics, setMetrics] = useState<DeveloperMetrics | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [actionMessage, setActionMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const loadMetrics = async () => {
    setError(null);
    const response = await fetch("/api/developer/metrics", { cache: "no-store" });
    const data = await response.json();
    if (!response.ok) {
      throw new Error(data?.error || "Unable to load developer metrics.");
    }
    setMetrics(data);
  };

  useEffect(() => {
    loadMetrics().catch((loadError) => {
      setError(loadError instanceof Error ? loadError.message : "Unable to load developer metrics.");
    });
  }, []);

  const nodeHeapPercent = useMemo(() => {
    if (!metrics?.node.memory.heapTotal) return 0;
    return Math.round((metrics.node.memory.heapUsed / metrics.node.memory.heapTotal) * 1000) / 10;
  }, [metrics]);

  const createBackup = () => {
    startTransition(async () => {
      setActionMessage(null);
      try {
        const response = await fetch("/api/developer/backup", { method: "POST" });
        const data = await response.json();
        if (!response.ok) throw new Error(data?.error || "Backup failed.");
        setActionMessage(`تم إنشاء النسخة الاحتياطية: ${data.name} (${formatBytes(data.sizeBytes)})`);
        await loadMetrics();
      } catch (backupError) {
        setActionMessage(backupError instanceof Error ? backupError.message : "Backup failed.");
      }
    });
  };

  const restart = (target: "web" | "workers" | "all") => {
    const label = target === "web" ? "تطبيق الويب" : target === "workers" ? "الـ workers" : "كل الخدمات";
    if (!window.confirm(`تأكيد إعادة تشغيل ${label}؟`)) return;

    startTransition(async () => {
      setActionMessage(null);
      try {
        const response = await fetch("/api/developer/restart", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ target, confirmation: "RESTART" })
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data?.message || data?.error || "Restart failed.");
        setActionMessage(data?.message || `تم تنفيذ إعادة التشغيل لـ ${label}.`);
      } catch (restartError) {
        setActionMessage(restartError instanceof Error ? restartError.message : "Restart failed.");
      }
    });
  };

  if (error) {
    return (
      <div className="rounded-3xl border border-rose-200 bg-rose-50 p-6 text-rose-700 dark:border-rose-900/50 dark:bg-rose-950/30 dark:text-rose-300">
        <p className="font-bold">تعذر تحميل Developer Panel</p>
        <p className="mt-2 text-sm">{error}</p>
      </div>
    );
  }

  if (!metrics) {
    return (
      <div className="rounded-3xl border border-slate-200 bg-white p-8 text-center text-slate-500 shadow-sm dark:border-slate-800 dark:bg-slate-950 dark:text-slate-400">
        <RefreshCw className="mx-auto mb-3 animate-spin" size={24} />
        جاري تحميل معلومات الخادم...
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <section className="rounded-[2rem] border border-slate-200 bg-gradient-to-br from-slate-950 to-slate-800 p-6 text-white shadow-sm dark:border-slate-800">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.24em] text-violet-200">Developer Panel</p>
            <h1 className="mt-3 text-3xl font-black">لوحة المطور والتحكم التشغيلي</h1>
            <p className="mt-2 max-w-3xl text-sm text-slate-300">
              مراقبة استهلاك الخادم، قاعدة البيانات، Redis، PM2، النسخ الاحتياطي، وإعادة التشغيل الآمنة. هذه الصفحة متاحة لـ super-admin فقط.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => loadMetrics().catch((loadError) => setError(loadError instanceof Error ? loadError.message : "Unable to refresh."))}
              className="inline-flex items-center gap-2 rounded-2xl bg-white/10 px-4 py-2 text-sm font-bold hover:bg-white/20"
            >
              <RefreshCw size={16} /> تحديث
            </button>
            <HealthPill ok={metrics.mongo.ok} label="MongoDB" />
            <HealthPill ok={metrics.redis.ok} label="Redis" />
            <HealthPill ok={metrics.pm2.ok} label="PM2" />
          </div>
        </div>
      </section>

      {actionMessage ? (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm font-semibold text-amber-800 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-300">
          {actionMessage}
        </div>
      ) : null}

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard title="CPU" value={`${metrics.host.cpuCount} cores`} hint={`Load: ${metrics.host.loadAverage.map((v) => v.toFixed(2)).join(" / ")}`} icon={Cpu} />
        <StatCard title="RAM" value={`${metrics.host.memoryUsedPercent}%`} hint={`${formatBytes(metrics.host.memoryFreeBytes)} free of ${formatBytes(metrics.host.memoryTotalBytes)}`} icon={Server} />
        <StatCard title="Node Heap" value={`${nodeHeapPercent}%`} hint={`${formatBytes(metrics.node.memory.heapUsed)} used / PID ${metrics.node.pid}`} icon={Activity} />
        <StatCard title="Uptime" value={formatDuration(metrics.host.uptimeSeconds)} hint={`Node: ${formatDuration(metrics.node.uptimeSeconds)} · ${metrics.node.env}`} icon={Wifi} />
      </section>

      <section className="grid gap-4 xl:grid-cols-3">
        <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-950">
          <div className="flex items-center justify-between gap-3">
            <h2 className="flex items-center gap-2 text-lg font-black text-ink dark:text-white"><Database size={19} /> MongoDB</h2>
            <HealthPill ok={metrics.mongo.ok} label={metrics.mongo.ok ? "Healthy" : "Error"} />
          </div>
          <dl className="mt-5 space-y-3 text-sm">
            <InfoRow label="Database" value={metrics.mongo.database || "—"} />
            <InfoRow label="Collections" value={metrics.mongo.collections ?? "—"} />
            <InfoRow label="Documents" value={metrics.mongo.objects ?? "—"} />
            <InfoRow label="Data Size" value={formatBytes(metrics.mongo.dataSizeBytes)} />
            <InfoRow label="Storage" value={formatBytes(metrics.mongo.storageSizeBytes)} />
            <InfoRow label="Indexes" value={formatBytes(metrics.mongo.indexSizeBytes)} />
          </dl>
          {metrics.mongo.error ? <p className="mt-4 text-xs text-rose-500">{metrics.mongo.error}</p> : null}
        </div>

        <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-950">
          <div className="flex items-center justify-between gap-3">
            <h2 className="flex items-center gap-2 text-lg font-black text-ink dark:text-white"><HardDrive size={19} /> Disk</h2>
            <HealthPill ok={metrics.disk.ok} label={metrics.disk.ok ? "Readable" : "Error"} />
          </div>
          <dl className="mt-5 space-y-3 text-sm">
            <InfoRow label="Used" value={`${metrics.disk.usedPercent ?? "—"}%`} />
            <InfoRow label="Available" value={formatBytes(metrics.disk.availableBytes)} />
            <InfoRow label="Size" value={formatBytes(metrics.disk.sizeBytes)} />
            <InfoRow label="Mount" value={metrics.disk.mount || "—"} />
          </dl>
          {metrics.disk.error ? <p className="mt-4 text-xs text-rose-500">{metrics.disk.error}</p> : null}
        </div>

        <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-950">
          <div className="flex items-center justify-between gap-3">
            <h2 className="flex items-center gap-2 text-lg font-black text-ink dark:text-white"><ShieldCheck size={19} /> Controls</h2>
            <HealthPill ok={metrics.controls.restartEnabled} label={metrics.controls.restartEnabled ? "Restart On" : "Restart Off"} />
          </div>
          <p className="mt-4 text-xs leading-6 text-slate-500 dark:text-slate-400">
            إعادة التشغيل مقفولة افتراضيًا لحماية الخادم. للتفعيل اضبط DEVELOPER_PANEL_ALLOW_RESTART=true على السيرفر.
          </p>
          <div className="mt-4 grid gap-2">
            <button
              disabled={isPending}
              onClick={createBackup}
              className="inline-flex items-center justify-center gap-2 rounded-2xl bg-violet-600 px-4 py-2.5 text-sm font-bold text-white hover:bg-violet-700 disabled:opacity-60"
            >
              <Archive size={16} /> إنشاء نسخة احتياطية
            </button>
            <div className="grid grid-cols-3 gap-2">
              {(["web", "workers", "all"] as const).map((target) => (
                <button
                  key={target}
                  disabled={isPending || !metrics.controls.restartEnabled}
                  onClick={() => restart(target)}
                  className="inline-flex items-center justify-center gap-1 rounded-2xl border border-slate-200 px-3 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-800 dark:text-slate-200 dark:hover:bg-slate-900"
                >
                  <RotateCcw size={13} /> {target}
                </button>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="mt-4">
        <SystemLogs />
      </section>

      <section className="grid gap-4 xl:grid-cols-2 mt-4">
        <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-950">
          <h2 className="flex items-center gap-2 text-lg font-black text-ink dark:text-white"><Server size={19} /> PM2 Processes</h2>
          {metrics.pm2.processes.length ? (
            <div className="mt-4 overflow-hidden rounded-2xl border border-slate-100 dark:border-slate-800">
              {metrics.pm2.processes.map((processItem) => (
                <div key={processItem.name} className="grid grid-cols-[1fr_auto] gap-3 border-b border-slate-100 p-3 text-sm last:border-0 dark:border-slate-800">
                  <div className="min-w-0">
                    <p className="truncate font-bold text-ink dark:text-white">{processItem.name}</p>
                    <p className="text-xs text-slate-500">CPU {processItem.cpu ?? 0}% · RAM {formatBytes(processItem.memoryBytes)} · restarts {processItem.restarts ?? 0}</p>
                  </div>
                  <HealthPill ok={processItem.status === "online"} label={processItem.status} />
                </div>
              ))}
            </div>
          ) : (
            <p className="mt-4 rounded-2xl bg-slate-50 p-4 text-sm text-slate-500 dark:bg-slate-900 dark:text-slate-400">لا توجد بيانات PM2. {metrics.pm2.error}</p>
          )}
        </div>

        <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-950">
          <h2 className="flex items-center gap-2 text-lg font-black text-ink dark:text-white"><Archive size={19} /> Database Backups</h2>
          <p className="mt-2 truncate text-xs text-slate-500">{metrics.controls.backupDir}</p>
          {metrics.backups.length ? (
            <div className="mt-4 space-y-2">
              {metrics.backups.map((backup) => (
                <div key={backup.name} className="flex items-center justify-between gap-3 rounded-2xl border border-slate-100 p-3 text-sm dark:border-slate-800">
                  <div className="min-w-0">
                    <p className="truncate font-bold text-ink dark:text-white">{backup.name}</p>
                    <p className="text-xs text-slate-500">{formatBytes(backup.sizeBytes)} · {new Date(backup.createdAt).toLocaleString()}</p>
                  </div>
                  <a
                    href={`/api/developer/backups/${encodeURIComponent(backup.name)}`}
                    className="inline-flex shrink-0 items-center gap-1 rounded-xl bg-slate-100 px-3 py-2 text-xs font-bold text-slate-700 hover:bg-slate-200 dark:bg-slate-900 dark:text-slate-200"
                  >
                    <CloudDownload size={14} /> تحميل
                  </a>
                </div>
              ))}
            </div>
          ) : (
            <p className="mt-4 rounded-2xl bg-slate-50 p-4 text-sm text-slate-500 dark:bg-slate-900 dark:text-slate-400">لا توجد نسخ احتياطية بعد.</p>
          )}
        </div>
      </section>

      <div className="rounded-3xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-300">
        <div className="flex gap-2">
          <AlertTriangle size={18} className="mt-0.5 shrink-0" />
          <p>
            هذه اللوحة تعرض معلومات تشغيلية فقط ولا تعرض أسرار البيئة أو مفاتيح API. النسخ الاحتياطية تحفظ على السيرفر، ويجب نقلها لمخزن خارجي آمن بشكل دوري.
          </p>
        </div>
      </div>
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-slate-100 pb-2 last:border-0 dark:border-slate-800">
      <dt className="text-slate-500 dark:text-slate-400">{label}</dt>
      <dd className="min-w-0 truncate font-bold text-ink dark:text-white">{value}</dd>
    </div>
  );
}
