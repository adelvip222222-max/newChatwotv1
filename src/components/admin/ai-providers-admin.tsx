"use client";

import { useState } from "react";
import { CheckCircle2, XCircle, Key, Server, Settings2, Loader2, Sparkles, AlertCircle } from "lucide-react";

type ProviderId = "openai" | "anthropic" | "gemini" | "openrouter" | "deepseek" | "xai" | "groq" | "ollama";

export type AiProviderRow = {
  id: string;
  providerId: ProviderId;
  name: string;
  isConfigured: boolean;
  isActive: boolean;
  isDefault: boolean;
  baseUrl: string;
  priority: number;
};

const PROVIDERS_META: Record<ProviderId, { name: string; description: string; color: string; logoUrl?: string; modelCount: number }> = {
  openai: {
    name: "OpenAI",
    description: "The most capable models including GPT-4o and GPT-4 Turbo. Highly reliable and versatile.",
    color: "bg-[#10a37f]",
    modelCount: 4
  },
  anthropic: {
    name: "Anthropic",
    description: "Claude 3.5 Sonnet & Opus. Excellent at coding, long context windows, and nuanced writing.",
    color: "bg-[#d97757]",
    modelCount: 3
  },
  gemini: {
    name: "Google Gemini",
    description: "Gemini 1.5 Pro with a massive 1M token context window. Great for document analysis.",
    color: "bg-[#1a73e8]",
    modelCount: 2
  },
  openrouter: {
    name: "OpenRouter",
    description: "Unified API for 100+ models. Automatically routes to the cheapest or best endpoints.",
    color: "bg-[#4f46e5]",
    modelCount: 120
  },
  deepseek: {
    name: "DeepSeek",
    description: "Highly efficient open-weight models offering exceptional coding performance at low costs.",
    color: "bg-[#2563eb]",
    modelCount: 2
  },
  xai: {
    name: "xAI (Grok)",
    description: "Grok models with real-time knowledge and unfiltered intelligence.",
    color: "bg-[#000000]",
    modelCount: 2
  },
  groq: {
    name: "Groq",
    description: "LPU inference engine delivering lightning-fast generation for open source models like LLaMA 3.",
    color: "bg-[#f97316]",
    modelCount: 5
  },
  ollama: {
    name: "Ollama",
    description: "Run Llama 3, Mistral, and other open-source models locally on your own hardware.",
    color: "bg-[#52525b]",
    modelCount: 10
  }
};

export function AiProvidersAdmin({ providers }: { providers: AiProviderRow[] }) {
  const [loading, setLoading] = useState<string | null>(null);
  const [editingProvider, setEditingProvider] = useState<ProviderId | null>(null);
  const [formData, setFormData] = useState({ apiKey: "", baseUrl: "", isActive: true, isDefault: false });
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const allProviderIds: ProviderId[] = ["openai", "anthropic", "gemini", "openrouter", "deepseek", "xai", "groq", "ollama"];

  async function handleSave(providerId: ProviderId) {
    setLoading(providerId);
    setError("");
    setSuccess("");

    try {
      const response = await fetch("/api/admin/ai-providers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          providerId,
          apiKey: formData.apiKey,
          baseUrl: formData.baseUrl,
          isActive: formData.isActive,
          isDefault: formData.isDefault
        })
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.error);

      setSuccess(`تم تحديث إعدادات ${PROVIDERS_META[providerId].name} بنجاح.`);
      setTimeout(() => window.location.reload(), 1500);
    } catch (e: any) {
      setError(e.message);
      setLoading(null);
    }
  }

  function openEdit(pId: ProviderId, existing?: AiProviderRow) {
    setError("");
    setSuccess("");
    setFormData({
      apiKey: "",
      baseUrl: existing?.baseUrl || "",
      isActive: existing?.isActive ?? true,
      isDefault: existing?.isDefault ?? false
    });
    setEditingProvider(pId);
  }

  return (
    <div className="space-y-6">
      {error && (
        <div className="callout-error flex items-center gap-2">
          <AlertCircle size={18} /> {error}
        </div>
      )}
      {success && (
        <div className="callout-success flex items-center gap-2">
          <CheckCircle2 size={18} /> {success}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
        {allProviderIds.map((pId) => {
          const meta = PROVIDERS_META[pId];
          const existing = providers.find((p) => p.providerId === pId);
          const isConfigured = existing?.isConfigured;
          const isEditing = editingProvider === pId;

          return (
            <div 
              key={pId} 
              className={`relative overflow-hidden rounded-2xl border transition-all duration-300 shadow-sm hover:shadow-lg
                ${isConfigured ? 'border-emerald-200 dark:border-emerald-900/30 bg-white dark:bg-slate-900/40' : 'border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/20'}`}
            >
              {/* Card Header & Decorative Background */}
              <div className={`h-2 w-full ${meta.color} opacity-80`}></div>
              
              <div className="p-5">
                <div className="flex justify-between items-start mb-4">
                  <div className="flex items-center gap-3">
                    <div className={`flex items-center justify-center w-12 h-12 rounded-xl text-white shadow-sm ${meta.color}`}>
                      <Sparkles size={24} />
                    </div>
                    <div>
                      <h3 className="font-bold text-lg text-slate-900 dark:text-white leading-tight">{meta.name}</h3>
                      <div className="flex items-center gap-1.5 mt-1">
                        {isConfigured ? (
                          <span className="inline-flex items-center gap-1 text-[11px] font-medium text-emerald-600 bg-emerald-50 dark:bg-emerald-500/10 dark:text-emerald-400 px-2 py-0.5 rounded-full">
                            <CheckCircle2 size={12} /> Connected
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-[11px] font-medium text-slate-500 bg-slate-100 dark:bg-slate-800 dark:text-slate-400 px-2 py-0.5 rounded-full">
                            <XCircle size={12} /> Not Configured
                          </span>
                        )}
                        {existing?.isDefault && (
                          <span className="inline-flex items-center gap-1 text-[11px] font-medium text-blue-600 bg-blue-50 dark:bg-blue-500/10 dark:text-blue-400 px-2 py-0.5 rounded-full">
                            Default
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                <p className="text-sm text-slate-600 dark:text-slate-400 mb-6 min-h-[40px] leading-relaxed">
                  {meta.description}
                </p>

                {isEditing ? (
                  <div className="space-y-4 pt-4 border-t border-slate-100 dark:border-slate-800 animate-in fade-in slide-in-from-top-2">
                    <div>
                      <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5 block flex items-center gap-1.5">
                        <Key size={14} /> API Key
                      </label>
                      <input
                        type="password"
                        placeholder={isConfigured ? "••••••••••••••••" : "sk-..."}
                        value={formData.apiKey}
                        onChange={(e) => setFormData({ ...formData, apiKey: e.target.value })}
                        className="w-full text-sm rounded-lg border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2 text-slate-900 dark:text-slate-100 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none transition-all"
                        dir="ltr"
                      />
                    </div>
                    
                    {(pId === "ollama" || pId === "openai") && (
                      <div>
                        <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5 block flex items-center gap-1.5">
                          <Server size={14} /> Base URL (Optional)
                        </label>
                        <input
                          type="text"
                          placeholder="http://localhost:11434"
                          value={formData.baseUrl}
                          onChange={(e) => setFormData({ ...formData, baseUrl: e.target.value })}
                          className="w-full text-sm rounded-lg border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2 text-slate-900 dark:text-slate-100 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none transition-all"
                          dir="ltr"
                        />
                      </div>
                    )}

                    <div className="flex items-center justify-between">
                      <label className="flex items-center gap-2 text-sm cursor-pointer">
                        <input 
                          type="checkbox" 
                          checked={formData.isActive}
                          onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
                          className="rounded border-slate-300 text-blue-600 focus:ring-blue-500" 
                        />
                        <span className="text-slate-700 dark:text-slate-300">Active</span>
                      </label>
                      <label className="flex items-center gap-2 text-sm cursor-pointer">
                        <input 
                          type="checkbox" 
                          checked={formData.isDefault}
                          onChange={(e) => setFormData({ ...formData, isDefault: e.target.checked })}
                          className="rounded border-slate-300 text-emerald-600 focus:ring-emerald-500" 
                        />
                        <span className="text-slate-700 dark:text-slate-300">Default</span>
                      </label>
                    </div>

                    <div className="flex gap-2 pt-2">
                      <button 
                        onClick={() => handleSave(pId)}
                        disabled={loading === pId}
                        className="flex-1 bg-slate-900 dark:bg-white text-white dark:text-slate-900 text-sm font-medium py-2 rounded-lg hover:bg-slate-800 dark:hover:bg-slate-100 transition-colors flex items-center justify-center gap-2 disabled:opacity-70"
                      >
                        {loading === pId ? <Loader2 size={16} className="animate-spin" /> : "Save"}
                      </button>
                      <button 
                        onClick={() => setEditingProvider(null)}
                        className="flex-1 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-sm font-medium py-2 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <button 
                    onClick={() => openEdit(pId, existing)}
                    className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-sm font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
                  >
                    <Settings2 size={16} /> 
                    {isConfigured ? "Configure" : "Connect"}
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
