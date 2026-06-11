"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Save } from "lucide-react";
import { useI18n } from "@/components/i18n-provider";

type BotFormProps = {
  bot?: {
    id: string;
    name: string;
    avatar?: string;
    description?: string;
    isActive: boolean;
  };
};

const copy = {
  ar: {
    saveError: "تعذر حفظ البوت.",
    name: "اسم البوت",
    avatar: "رابط الصورة",
    description: "الوصف",
    active: "مفعّل",
    saving: "جاري الحفظ...",
    save: "حفظ"
  },
  en: {
    saveError: "Unable to save bot.",
    name: "Bot name",
    avatar: "Avatar URL",
    description: "Description",
    active: "Active",
    saving: "Saving...",
    save: "Save"
  }
} as const;

export function BotForm({ bot }: BotFormProps) {
  const router = useRouter();
  const { locale } = useI18n();
  const labels = copy[locale];
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError("");
    const form = new FormData(event.currentTarget);
    const payload = {
      name: String(form.get("name") || ""),
      avatar: String(form.get("avatar") || ""),
      description: String(form.get("description") || ""),
      isActive: form.get("isActive") === "on"
    };

    const response = await fetch(bot ? `/api/bots/${bot.id}` : "/api/bots", {
      method: bot ? "PATCH" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });

    setLoading(false);
    if (!response.ok) {
      const data = await response.json();
      setError(data.error || labels.saveError);
      return;
    }

    router.push("/dashboard/bots");
    router.refresh();
  }

  return (
    <form onSubmit={onSubmit} className="panel max-w-3xl p-5">
      {error ? <p className="callout-error mb-4">{error}</p> : null}
      <div className="grid gap-4 md:grid-cols-2">
        <div>
          <label className="label" htmlFor="name">{labels.name}</label>
          <input className="field" id="name" name="name" defaultValue={bot?.name} required />
        </div>
        <div>
          <label className="label" htmlFor="avatar">{labels.avatar}</label>
          <input className="field" id="avatar" name="avatar" defaultValue={bot?.avatar} />
        </div>
      </div>
      <label className="label mt-4" htmlFor="description">{labels.description}</label>
      <textarea className="field min-h-28" id="description" name="description" defaultValue={bot?.description} />
      <label className="mt-4 flex items-center gap-2 text-sm font-medium text-slate-700 dark:text-slate-300">
        <input name="isActive" type="checkbox" defaultChecked={bot?.isActive ?? true} />
        {labels.active}
      </label>
      <button className="btn-primary mt-5" disabled={loading}>
        <Save size={18} />
        {loading ? labels.saving : labels.save}
      </button>
    </form>
  );
}
