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
  if (process.env.AI_ORCHESTRATOR !== "mastra") return false;
  if (!parseBoolean(process.env.MASTRA_ENABLED, false)) return false;

  const allowlist = parseAllowlist(process.env.MASTRA_TENANT_ALLOWLIST);
  return allowlist.has("*") || allowlist.has(tenantId);
}

export function shouldFallbackToLegacy() {
  return parseBoolean(process.env.MASTRA_FALLBACK_TO_LEGACY, true);
}

export function getMastraMaxToolCalls() {
  const value = Number(process.env.MASTRA_MAX_TOOL_CALLS || 5);
  return Number.isFinite(value) && value > 0 ? Math.floor(value) : 5;
}

