/**
 * @file css-variables.ts
 * @description Generates the CSS custom-property block from design tokens.
 *
 * Usage: This module is imported by a server component (RootLayout) and
 * renders a <style> tag with all CSS variables on :root.
 *
 * Why CSS variables instead of only Tailwind utilities?
 * ────────────────────────────────────────────────────
 * 1. Runtime theming: per-tenant brand colors can be injected server-side
 *    by overriding only the CSS variable values — no re-compile needed.
 * 2. Third-party widgets (the chat widget.js) can read the same variables.
 * 3. Gradients and complex CSS expressions require native CSS variables.
 *
 * Tenant theming hook (Phase 3):
 *   Server component reads tenant.brandColor from DB and calls
 *   buildTenantCssOverride(tenant.brandColor) to inject a per-tenant block.
 */

import { colorTokens, typographyTokens, shadowTokens, borderTokens, animationTokens } from "./tokens";

/**
 * Build the full :root CSS variable block from design tokens.
 * Called once per server render — zero runtime cost on client.
 */
export function buildRootCssVariables(): string {
  return `
    /* ── Colors ─────────────────────────────────── */
    --color-primary-50:  ${colorTokens.primary[50]};
    --color-primary-100: ${colorTokens.primary[100]};
    --color-primary-200: ${colorTokens.primary[200]};
    --color-primary-300: ${colorTokens.primary[300]};
    --color-primary-400: ${colorTokens.primary[400]};
    --color-primary-500: ${colorTokens.primary[500]};
    --color-primary-600: ${colorTokens.primary[600]};
    --color-primary-700: ${colorTokens.primary[700]};
    --color-primary-800: ${colorTokens.primary[800]};
    --color-primary-900: ${colorTokens.primary[900]};

    --color-accent:  ${colorTokens.primary[600]};
    --color-ink:     ${colorTokens.neutral[950]};
    --color-paper:   ${colorTokens.neutral[50]};

    --color-success: ${colorTokens.success.base};
    --color-warning: ${colorTokens.warning.base};
    --color-error:   ${colorTokens.error.base};
    --color-info:    ${colorTokens.info.base};

    /* ── Typography ─────────────────────────────── */
    --font-sans: ${typographyTokens.fontFamily.sans};
    --font-mono: ${typographyTokens.fontFamily.mono};

    /* ── Shadows ────────────────────────────────── */
    --shadow-sm:    ${shadowTokens.sm};
    --shadow-soft:  ${shadowTokens.soft};
    --shadow-md:    ${shadowTokens.md};
    --shadow-lg:    ${shadowTokens.lg};
    --shadow-focus: ${shadowTokens.focus};

    /* ── Radius ─────────────────────────────────── */
    --radius-sm:  ${borderTokens.radius.sm};
    --radius-md:  ${borderTokens.radius.md};
    --radius-lg:  ${borderTokens.radius.lg};
    --radius-xl:  ${borderTokens.radius.xl};
    --radius-full:${borderTokens.radius.full};

    /* ── Motion ─────────────────────────────────── */
    --duration-fast:   ${animationTokens.duration.fast};
    --duration-normal: ${animationTokens.duration.normal};
    --duration-slow:   ${animationTokens.duration.slow};
  `.trim();
}

/**
 * Build per-tenant CSS override block.
 * Inject this as a scoped <style> in the dashboard layout when a tenant
 * has custom branding configured (Phase 3 hook).
 *
 * @param primaryHex - e.g. "#6d28d9" for a purple-branded tenant
 */
export function buildTenantCssOverride(primaryHex: string): string {
  // Minimal override: just the accent color. All components use var(--color-accent).
  return `
    :root {
      --color-accent:        ${primaryHex};
      --color-primary-600:   ${primaryHex};
    }
  `.trim();
}
