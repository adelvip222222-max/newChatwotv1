"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Save, UserPlus } from "lucide-react";
import type { Role } from "@/server/permissions/roles";

type LimitedRole = Exclude<Role, "owner" | "super-admin">;

type ManagedUser = {
  id: string;
  name: string;
  email: string;
  role: Role;
  ownerId: string;
  isActive: boolean;
};

const editableRoles: Array<{ value: LimitedRole; label: string }> = [
  { value: "admin", label: "Admin" },
  { value: "manager", label: "Manager" },
  { value: "agent", label: "Agent" },
  { value: "viewer", label: "Viewer" }
];

export function UsersAdmin({
  users,
  usage,
  limits
}: {
  users: ManagedUser[];
  usage: Record<LimitedRole, number>;
  limits: Record<LimitedRole, number>;
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
      setError(body.error || "Unable to add user.");
      return;
    }

    event.currentTarget.reset();
    setSuccess("User added to this tenant.");
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
      setError(body.error || "Unable to update user.");
      return;
    }
    router.refresh();
  }

  return (
    <div className="space-y-5">
      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {editableRoles.map((role) => (
          <Quota key={role.value} title={role.label} used={usage[role.value]} limit={limits[role.value]} />
        ))}
      </section>

      <form onSubmit={onSubmit} className="panel p-5">
        <div className="mb-5 flex items-center gap-2">
          <UserPlus size={18} className="text-accent" aria-hidden="true" />
          <h2 className="text-lg font-bold text-ink">Add tenant user</h2>
        </div>
        {error ? <p className="mb-4 rounded-md bg-red-50 p-3 text-sm text-red-700 dark:bg-red-950/30 dark:text-red-300">{error}</p> : null}
        {success ? <p className="mb-4 rounded-md bg-emerald-50 p-3 text-sm text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-300">{success}</p> : null}
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <Field name="name" label="Name" required />
          <Field name="email" label="Email" type="email" required />
          <Field name="password" label="Password" type="password" minLength={12} required />
          <div>
            <label className="label">Role</label>
            <select className="field" name="role" defaultValue="agent">
              {editableRoles.map((role) => (
                <option key={role.value} value={role.value}>
                  {role.label}
                </option>
              ))}
            </select>
          </div>
        </div>
        <button className="btn-primary mt-5">
          <Save size={18} aria-hidden="true" />
          Save user
        </button>
      </form>

      <section className="panel overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-slate-500 dark:bg-slate-900 dark:text-slate-400">
            <tr>
              <th className="p-3 text-right">Name</th>
              <th className="p-3 text-right">Email</th>
              <th className="p-3 text-right">Role</th>
              <th className="p-3 text-right">Owner ID</th>
              <th className="p-3 text-right">Status</th>
              <th className="p-3 text-right">Action</th>
            </tr>
          </thead>
          <tbody>
            {users.map((user) => (
              <tr key={user.id} className="border-t border-slate-100 dark:border-slate-800">
                <td className="p-3 font-semibold text-ink">{user.name}</td>
                <td className="p-3">{user.email}</td>
                <td className="p-3">{roleLabel(user.role)}</td>
                <td className="p-3 font-mono text-xs" dir="ltr">{user.ownerId}</td>
                <td className="p-3">{user.isActive ? "Active" : "Inactive"}</td>
                <td className="p-3">
                  {user.role === "owner" ? (
                    <span className="text-slate-400">Primary owner</span>
                  ) : (
                    <button className="btn-secondary px-3 py-1.5" onClick={() => updateUser(user.id, { isActive: !user.isActive })}>
                      {user.isActive ? "Deactivate" : "Activate"}
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
      <p className="text-sm text-slate-500 dark:text-slate-400">{title}</p>
      <p className="mt-2 text-2xl font-bold text-ink">
        {used} / {limit}
      </p>
    </div>
  );
}

function roleLabel(role: Role) {
  if (role === "super-admin") return "Platform Super Admin";
  if (role === "owner") return "Primary owner";
  return editableRoles.find((item) => item.value === role)?.label ?? role;
}
