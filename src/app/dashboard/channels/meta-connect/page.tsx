"use client";

import { useEffect, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { AlertTriangle, CheckCircle, Loader2, MessageCircle, Image as ImageIcon, ArrowRight, ShieldAlert, Info } from "lucide-react";

const REQUIRED_FB_PERMISSIONS = ["pages_messaging", "pages_show_list", "pages_manage_metadata"];
const REQUIRED_IG_PERMISSIONS = ["instagram_manage_messages", "instagram_basic", "pages_show_list"];

type InstagramAccount = {
  instagramBusinessId: string;
  username: string;
  name: string;
};

type Page = {
  pageId: string;
  name: string;
  category: string;
  tasks: string[];
  instagramAccounts: InstagramAccount[];
};

type ConnectResult = {
  channelId: string;
  type: string;
  webhookStatus: string;
  message: string;
};

type Step = "loading" | "select" | "connecting" | "done" | "error";

function getMissingPermissions(tasks: string[], required: string[]): string[] {
  const taskSet = new Set(tasks.map((t) => t.toLowerCase()));
  return required.filter((p) => !taskSet.has(p.toLowerCase()));
}

function PermissionBadge({ missing }: { missing: string[] }) {
  if (missing.length === 0) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">
        <CheckCircle size={10} />
        Permissions OK
      </span>
    );
  }
  return (
    <span
      title={`Missing: ${missing.join(", ")}`}
      className="inline-flex cursor-help items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700 dark:bg-amber-950 dark:text-amber-300"
    >
      <ShieldAlert size={10} />
      {missing.length} permission{missing.length > 1 ? "s" : ""} missing
    </span>
  );
}

function WebhookBadge({ status }: { status: string }) {
  const ok = status === "subscribed";
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${
        ok
          ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300"
          : "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300"
      }`}
    >
      {ok ? <CheckCircle size={11} /> : <AlertTriangle size={11} />}
      {ok ? "Webhook active" : "Webhook needs review"}
    </span>
  );
}

export default function MetaConnectPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const sessionKey = searchParams?.get("session") ?? "";
  const oauthError = searchParams?.get("oauth_error");

  const [step, setStep] = useState<Step>(oauthError ? "error" : "loading");
  const [errorMessage, setErrorMessage] = useState(oauthError ?? "");
  const [pages, setPages] = useState<Page[]>([]);
  const [results, setResults] = useState<ConnectResult[]>([]);
  const [connecting, setConnecting] = useState<string | null>(null);

  useEffect(() => {
    if (oauthError || !sessionKey) return;
    fetch(`/api/oauth/meta/pages?session=${sessionKey}`)
      .then((r) => r.json())
      .then((data) => {
        if (data.error) {
          setErrorMessage(data.error);
          setStep("error");
        } else {
          setPages(data.pages ?? []);
          setStep("select");
        }
      })
      .catch(() => {
        setErrorMessage("Failed to load pages. Please try reconnecting.");
        setStep("error");
      });
  }, [sessionKey, oauthError]);

  async function connectChannel(
    pageId: string,
    type: "facebook" | "instagram",
    instagramBusinessId?: string
  ) {
    const key = `${type}:${pageId}:${instagramBusinessId ?? ""}`;
    setConnecting(key);
    setStep("connecting");
    try {
      const resp = await fetch("/api/oauth/meta/connect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ session: sessionKey, pageId, type, instagramBusinessId }),
      });
      const data = (await resp.json()) as ConnectResult & { error?: string };
      if (data.error) {
        setErrorMessage(data.error);
        setStep("error");
      } else {
        setResults((prev) => [...prev, data]);
        setStep("done");
      }
    } catch {
      setErrorMessage("Network error. Please try again.");
      setStep("error");
    } finally {
      setConnecting(null);
    }
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-10">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">Connect Meta Channel</h1>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
          Select which Facebook Page or Instagram account to connect.
        </p>
      </div>

      {step === "loading" && (
        <div className="flex items-center gap-3 text-slate-500">
          <Loader2 className="animate-spin" size={20} />
          <span>Loading your pages...</span>
        </div>
      )}

      {step === "error" && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 dark:border-red-900 dark:bg-red-950/30">
          <div className="flex items-start gap-3">
            <AlertTriangle className="mt-0.5 shrink-0 text-red-600" size={18} />
            <div>
              <p className="font-semibold text-red-800 dark:text-red-300">Connection Failed</p>
              <p className="mt-1 text-sm text-red-700 dark:text-red-400">{errorMessage}</p>
            </div>
          </div>
          <button
            onClick={() => router.push("/dashboard/channels")}
            className="mt-4 inline-flex items-center gap-1.5 rounded-md bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700"
          >
            Back to Channels
          </button>
        </div>
      )}

      {step === "done" && (
        <div className="space-y-4">
          {results.map((r) => (
            <div
              key={r.channelId}
              className="rounded-lg border border-emerald-200 bg-emerald-50 p-4 dark:border-emerald-900 dark:bg-emerald-950/30"
            >
              <div className="flex items-start gap-3">
                <CheckCircle className="mt-0.5 shrink-0 text-emerald-600" size={18} />
                <div className="flex-1">
                  <p className="font-semibold capitalize text-emerald-800 dark:text-emerald-300">
                    {r.type} Connected
                  </p>
                  <p className="mt-1 text-sm text-emerald-700 dark:text-emerald-400">{r.message}</p>
                  <div className="mt-2">
                    <WebhookBadge status={r.webhookStatus} />
                  </div>
                  {r.webhookStatus !== "subscribed" && (
                    <p className="mt-2 text-xs text-amber-700 dark:text-amber-400">
                      Webhook subscription failed. This usually means the app needs additional
                      permissions from Meta App Review. Check{" "}
                      <span className="font-mono">docs/operations/META_CHANNELS_SETUP.md</span>.
                    </p>
                  )}
                </div>
              </div>
            </div>
          ))}
          <button
            onClick={() => router.push("/dashboard/channels")}
            className="inline-flex items-center gap-1.5 rounded-md bg-slate-800 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700 dark:bg-slate-200 dark:text-slate-900 dark:hover:bg-slate-300"
          >
            Back to Channels <ArrowRight size={14} />
          </button>
        </div>
      )}

      {(step === "select" || step === "connecting") && pages.length === 0 && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 dark:border-amber-900 dark:bg-amber-950/30">
          <div className="flex items-start gap-3">
            <AlertTriangle className="mt-0.5 shrink-0 text-amber-600" size={18} />
            <div>
              <p className="font-semibold text-amber-800 dark:text-amber-300">No Pages Found</p>
              <p className="mt-1 text-sm text-amber-700 dark:text-amber-400">
                No Facebook Pages were found for your account. Make sure you have a Business Page and
                granted the required permissions.
              </p>
            </div>
          </div>
        </div>
      )}

      {(step === "select" || step === "connecting") && pages.length > 0 && (
        <div className="space-y-4">
          {pages.map((page) => {
            const fbMissing = getMissingPermissions(page.tasks, REQUIRED_FB_PERMISSIONS);
            const igAccounts = page.instagramAccounts ?? [];

            return (
              <div
                key={page.pageId}
                className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900"
              >
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="font-semibold text-slate-900 dark:text-slate-100">{page.name}</p>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      {page.category} · ID: {page.pageId}
                    </p>
                  </div>
                  <PermissionBadge missing={fbMissing} />
                </div>

                {fbMissing.length > 0 && (
                  <div className="mt-2 flex items-start gap-2 rounded-md bg-amber-50 px-3 py-2 text-xs text-amber-800 dark:bg-amber-950/30 dark:text-amber-300">
                    <Info size={13} className="mt-0.5 shrink-0" />
                    <span>
                      Facebook Messenger requires: <span className="font-mono">{fbMissing.join(", ")}</span>.
                      These may need Meta App Review for production access.
                    </span>
                  </div>
                )}

                <div className="mt-3 flex flex-wrap gap-2">
                  <button
                    disabled={connecting !== null}
                    onClick={() => connectChannel(page.pageId, "facebook")}
                    className="inline-flex items-center gap-1.5 rounded-md bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
                  >
                    {connecting === `facebook:${page.pageId}:` ? (
                      <Loader2 className="animate-spin" size={14} />
                    ) : (
                      <MessageCircle size={14} />
                    )}
                    Connect Messenger
                  </button>

                  {igAccounts.length === 0 && (
                    <span className="inline-flex items-center gap-1 rounded-md bg-slate-100 px-3 py-1.5 text-sm text-slate-500 dark:bg-slate-800 dark:text-slate-400">
                      <ImageIcon size={14} />
                      No Instagram account linked
                    </span>
                  )}

                  {igAccounts.map((ig) => {
                    const igMissing = getMissingPermissions(page.tasks, REQUIRED_IG_PERMISSIONS);
                    return (
                      <div key={ig.instagramBusinessId} className="flex flex-col gap-1">
                        <button
                          disabled={connecting !== null}
                          onClick={() => connectChannel(page.pageId, "instagram", ig.instagramBusinessId)}
                          className="inline-flex items-center gap-1.5 rounded-md bg-pink-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-pink-700 disabled:opacity-50"
                        >
                          {connecting === `instagram:${page.pageId}:${ig.instagramBusinessId}` ? (
                            <Loader2 className="animate-spin" size={14} />
                          ) : (
                            <ImageIcon size={14} />
                          )}
                          Connect @{ig.username || ig.name}
                        </button>
                        {igMissing.length > 0 && (
                          <p className="px-1 text-xs text-amber-600 dark:text-amber-400">
                            ⚠ Missing: {igMissing.join(", ")}
                          </p>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}

          <button
            onClick={() => router.push("/dashboard/channels")}
            className="text-sm text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200"
          >
            Cancel
          </button>
        </div>
      )}
    </div>
  );
}
