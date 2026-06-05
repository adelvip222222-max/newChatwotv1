export const DEFAULT_SYSTEM_PROMPT =
  "أنت مساعد ذكي باسم ChatZi. أجب باللغة العربية بطريقة واضحة ومختصرة ومفيدة. إذا لم تعرف الإجابة، اطلب توضيحا من المستخدم.";

export function slugifyArabic(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

export function maskSecret(value?: string | null) {
  if (!value) return "";
  if (value.length <= 8) return "********";
  return `${value.slice(0, 4)}********${value.slice(-4)}`;
}

export function absoluteUrl(path: string) {
  const base = process.env.NEXTAUTH_URL || "http://localhost:3000";
  return new URL(path, base).toString();
}
