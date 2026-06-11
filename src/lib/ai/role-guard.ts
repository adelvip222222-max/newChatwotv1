/**
 * T5.6 — AI Agent Role Guard
 *
 * Enforces tool access based on AiPersona.roleName so that each agent archetype
 * can only call tools appropriate for its domain.
 *
 * Role → Allowed tools
 * ────────────────────
 * Sales        → save_lead_data, update_contact_profile, escalate_to_human
 * Support      → create_ticket, update_contact_profile, escalate_to_human
 * Receptionist → update_contact_profile, escalate_to_human
 * Default / *  → uses persona.allowedTools as-is (no additional restriction)
 */

// Tools that are always available regardless of role
const UNIVERSAL_TOOLS = ["update_contact_profile", "escalate_to_human"];

// Mandatory tools by role (must be present when role matches, regardless of allowedTools)
const ROLE_REQUIRED_TOOLS: Record<string, string[]> = {
  sales: ["save_lead_data"],
  support: ["create_ticket"],
  receptionist: []
};

// Tools that are BLOCKED for a given role (overrides allowedTools)
const ROLE_BLOCKED_TOOLS: Record<string, string[]> = {
  receptionist: ["save_lead_data", "create_ticket", "save_extracted_data"],
  support: ["save_lead_data"],
  sales: ["create_ticket"]
};

/**
 * Compute the effective set of allowed tools for a persona, enforcing role constraints.
 *
 * @param roleName  The persona's roleName (e.g. "Sales Agent", "Support Assistant")
 * @param allowedTools  The list of tools configured on the persona (may be undefined = all)
 * @param allAvailableTools  Full set of tool names defined in AVAILABLE_TOOLS
 */
export function enforceRoleTools(
  roleName: string | undefined,
  allowedTools: string[] | undefined,
  allAvailableTools: string[]
): string[] {
  const role = detectRole(roleName);

  // Start from configured allowedTools or all tools
  let effective = allowedTools?.length ? [...allowedTools] : [...allAvailableTools];

  if (!role) return effective; // No role enforcement

  // Add required tools for this role
  const required = ROLE_REQUIRED_TOOLS[role] || [];
  for (const tool of required) {
    if (!effective.includes(tool) && allAvailableTools.includes(tool)) {
      effective.push(tool);
    }
  }

  // Ensure universal tools are always available
  for (const tool of UNIVERSAL_TOOLS) {
    if (!effective.includes(tool) && allAvailableTools.includes(tool)) {
      effective.push(tool);
    }
  }

  // Remove blocked tools
  const blocked = ROLE_BLOCKED_TOOLS[role] || [];
  effective = effective.filter((t) => !blocked.includes(t));

  return effective;
}

/**
 * Normalise roleName to a canonical role key.
 * Matches partial/case-insensitive roleName to a known role.
 */
function detectRole(roleName: string | undefined): string | null {
  if (!roleName) return null;
  const lower = roleName.toLowerCase();
  if (lower.includes("sales")) return "sales";
  if (lower.includes("support") || lower.includes("helpdesk")) return "support";
  if (lower.includes("receptionist") || lower.includes("reception")) return "receptionist";
  return null;
}

/**
 * Validate that a tool call is permitted given a roleName + allowedTools config.
 * Returns true if permitted, false if blocked by role policy.
 */
export function isToolAllowedForRole(
  toolName: string,
  roleName: string | undefined,
  allowedTools: string[] | undefined,
  allAvailableTools: string[]
): boolean {
  const effective = enforceRoleTools(roleName, allowedTools, allAvailableTools);
  return effective.includes(toolName);
}
