"use client";

import { signOut } from "next-auth/react";
import { LogOut } from "lucide-react";
import { useI18n } from "@/components/i18n-provider";

export function SignOutButton() {
  const { t } = useI18n();
  return (
    <button className="btn-secondary" onClick={() => signOut({ callbackUrl: "/login" })}>
      <LogOut size={17} />
      <span className="hidden sm:inline">{t.common.signOut}</span>
    </button>
  );
}
