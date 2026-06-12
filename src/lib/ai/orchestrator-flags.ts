function parseBoolean(value: string | undefined, defaultValue: boolean) {
  if (value === undefined || value === "") return defaultValue;
  return ["1", "true", "yes", "on"].includes(value.toLowerCase());
}

function parseAllowlist(value: string | undefined) {
  return new Set(
    (value || "")
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean)
  );
}

export function isMastraAllowed(tenantId: string) {
  if (process.env.AI_ORCHESTRATOR === "legacy") return false;
  if (!parseBoolean(process.env.MASTRA_ENABLED, true)) return false;

  const allowlist = parseAllowlist(process.env.MASTRA_TENANT_ALLOWLIST);
  return allowlist.size === 0 || allowlist.has("*") || allowlist.has(tenantId);
}

export function shouldFallbackToLegacy() {
  return parseBoolean(process.env.MASTRA_FALLBACK_TO_LEGACY, false);
}

export function getMastraMaxToolCalls() {
  const value = Number(process.env.MASTRA_MAX_TOOL_CALLS || 5);
  return Number.isFinite(value) && value > 0 ? Math.floor(value) : 5;
}

