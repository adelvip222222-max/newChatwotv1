"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Save, UserPlus } from "lucide-react";

type ManagedUser = {
  id: string;
  name: string;
  email: string;
  role: "owner" | "admin" | "agent";
  ownerId: string;
  isActive: boolean;
};

export function UsersAdmin({
  users,
  usage,
  limits
}: {
  users: ManagedUser[];
  usage: { admin: number; agent: number };
  limits: { admin: number; agent: number };
}) {
  const router = useRouter();
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setSuccess("");
    const form = new FormData(event.currentTarget);
    const payload = {
      name: String(form.get("name") || ""),
      email: String(form.get("email") || ""),
      password: String(form.get("password") || ""),
      role: String(form.get("role") || "agent")
    };

    const response = await fetch("/api/admin/users", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
    const body = await response.json();
    if (!response.ok) {
      setError(body.error || "تعذر إضافة المستخدم.");
      return;
    }
    event.currentTarget.reset();
    setSuccess("تمت إضافة المستخدم إلى نفس بروفايل الشركة.");
    router.refresh();
  }

  async function updateUser(id: string, payload: Record<string, unknown>) {
    setError("");
    const response = await fetch(`/api/admin/users/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
    const body = await response.json();
    if (!response.ok) {
      setError(body.error || "تعذر تحديث المستخدم.");
      return;
    }
    router.refresh();
  }

  return (
    <div className="space-y-5">
      <section className="grid gap-4 md:grid-cols-2">
        <Quota title="المديرون" used={usage.admin} limit={limits.admin} />
        <Quota title="الموظفون" used={usage.agent} limit={limits.agent} />
      </section>

      <form onSubmit={onSubmit} className="panel p-5">
        <div className="mb-5 flex items-center gap-2">
          <UserPlus size={18} className="text-accent" />
          <h2 className="text-lg font-bold text-ink">إضافة مستخدم لنفس البروفايل</h2>
        </div>
        {error ? <p className="mb-4 rounded-md bg-red-50 p-3 text-sm text-red-700">{error}</p> : null}
        {success ? <p className="mb-4 rounded-md bg-emerald-50 p-3 text-sm text-emerald-700">{success}</p> : null}
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <Field name="name" label="الاسم" required />
          <Field name="email" label="البريد الإلكتروني" type="email" required />
          <Field name="password" label="كلمة المرور" type="password" minLength={8} required />
          <div>
            <label className="label">الصلاحية</label>
            <select className="field" name="role" defaultValue="agent">
              <option value="admin">مدير</option>
              <option value="agent">موظف</option>
            </select>
          </div>
        </div>
        <button className="btn-primary mt-5">
          <Save size={18} />
          حفظ المستخدم
        </button>
      </form>

      <section className="panel overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-slate-500">
            <tr>
              <th className="p-3 text-right">الاسم</th>
              <th className="p-3 text-right">البريد</th>
              <th className="p-3 text-right">الصلاحية</th>
              <th className="p-3 text-right">Owner ID</th>
              <th className="p-3 text-right">الحالة</th>
              <th className="p-3 text-right">إجراء</th>
            </tr>
          </thead>
          <tbody>
            {users.map((user) => (
              <tr key={user.id} className="border-t border-slate-100">
                <td className="p-3 font-semibold text-ink">{user.name}</td>
                <td className="p-3">{user.email}</td>
                <td className="p-3">{roleLabel(user.role)}</td>
                <td className="p-3 font-mono text-xs" dir="ltr">{user.ownerId}</td>
                <td className="p-3">{user.isActive ? "مفعل" : "معطل"}</td>
                <td className="p-3">
                  {user.role === "owner" ? (
                    <span className="text-slate-400">المالك الرئيسي</span>
                  ) : (
                    <button className="btn-secondary px-3 py-1.5" onClick={() => updateUser(user.id, { isActive: !user.isActive })}>
                      {user.isActive ? "تعطيل" : "تفعيل"}
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </div>
  );
}

function Field(props: React.InputHTMLAttributes<HTMLInputElement> & { label: string; name: string }) {
  const { label, ...rest } = props;
  return (
    <div>
      <label className="label">{label}</label>
      <input className="field" {...rest} />
    </div>
  );
}

function Quota({ title, used, limit }: { title: string; used: number; limit: number }) {
  return (
    <div className="panel p-5">
      <p className="text-sm text-slate-500">{title}</p>
      <p className="mt-2 text-2xl font-bold text-ink">{used} / {limit}</p>
    </div>
  );
}

function roleLabel(role: string) {
  if (role === "owner") return "مشترك رئيسي";
  if (role === "admin") return "مدير";
  return "موظف";
}

