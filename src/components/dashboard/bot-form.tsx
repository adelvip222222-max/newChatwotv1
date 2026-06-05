"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Save } from "lucide-react";

type BotFormProps = {
  bot?: {
    id: string;
    name: string;
    avatar?: string;
    description?: string;
    isActive: boolean;
  };
};

export function BotForm({ bot }: BotFormProps) {
  const router = useRouter();
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
      setError(data.error || "تعذر حفظ البوت.");
      return;
    }

    router.push("/dashboard/bots");
    router.refresh();
  }

  return (
    <form onSubmit={onSubmit} className="panel max-w-3xl p-5">
      {error ? <p className="mb-4 rounded-md bg-red-50 p-3 text-sm text-red-700">{error}</p> : null}
      <div className="grid gap-4 md:grid-cols-2">
        <div>
          <label className="label" htmlFor="name">اسم البوت</label>
          <input className="field" id="name" name="name" defaultValue={bot?.name} required />
        </div>
        <div>
          <label className="label" htmlFor="avatar">رابط الصورة</label>
          <input className="field" id="avatar" name="avatar" defaultValue={bot?.avatar} />
        </div>
      </div>
      <label className="label mt-4" htmlFor="description">الوصف</label>
      <textarea className="field min-h-28" id="description" name="description" defaultValue={bot?.description} />
      <label className="mt-4 flex items-center gap-2 text-sm font-medium text-slate-700">
        <input name="isActive" type="checkbox" defaultChecked={bot?.isActive ?? true} />
        مفعل
      </label>
      <button className="btn-primary mt-5" disabled={loading}>
        <Save size={18} />
        {loading ? "جاري الحفظ..." : "حفظ"}
      </button>
    </form>
  );
}
