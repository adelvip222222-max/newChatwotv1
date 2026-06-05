/**
 * @file tokens.ts
 * @description Design Token Registry for Chatzi Theme System.
 *
 * Architecture Decision: All visual constants are defined ONCE here
 * and consumed by:
 *   1. tailwind.config.ts  → Tailwind utilities (bg-primary, text-primary, etc.)
 *   2. globals.css         → CSS custom properties (var(--color-primary))
 *   3. Theme components    → Direct JS/TS access for dynamic theming
 *
 * This is the SINGLE SOURCE OF TRUTH for the design system.
 * No color, font, or spacing value should be hardcoded in any component.
 * This approach is "Additive" — it extends the system without mutating
 * any base framework files, preserving future upgrade compatibility.
 */

// ---------------------------------------------------------------------------
// COLOR PALETTE
// ---------------------------------------------------------------------------
export const colorTokens = {
  /** Brand / Primary — Violet/Purple family */
  primary: {
    50:  "#faf5ff",
    100: "#f3e8ff",
    200: "#e9d5ff",
    300: "#d8b4fe",
    400: "#c084fc",
    500: "#9b59d0", // ← default accent base (#9b59d0)
    600: "#843db0",
    700: "#6c2e93",
    800: "#562276",
    900: "#44185c",
  },

  /** Neutrals — Slate family (UI backgrounds, borders, text) */
  neutral: {
    0:   "#ffffff",
    50:  "#f8fafc",
    100: "#f1f5f9",
    200: "#e2e8f0",
    300: "#cbd5e1",
    400: "#94a3b8",
    500: "#64748b",
    600: "#475569",
    700: "#334155",
    800: "#1e293b",
    900: "#0f172a",
    950: "#17202a", // ← "ink" (sidebar, headings)
  },

  /** Semantic — Success / Warning / Error / Info */
  success: { light: "#f0fdf4", border: "#86efac", text: "#15803d", base: "#22c55e" },
  warning: { light: "#fffbeb", border: "#fcd34d", text: "#92400e", base: "#f59e0b" },
  error:   { light: "#fef2f2", border: "#fca5a5", text: "#b91c1c", base: "#ef4444" },
  info:    { light: "#eff6ff", border: "#93c5fd", text: "#1d4ed8", base: "#3b82f6" },

  /** Accent override — Coral (CTAs / badges) */
  coral: "#dc6b4d",
} as const;

// ---------------------------------------------------------------------------
// TYPOGRAPHY
// ---------------------------------------------------------------------------
export const typographyTokens = {
  /**
   * Font stack for Arabic + Latin.
   * Tajawal is an Arabic-optimised typeface from Google Fonts.
   * Inter is the companion Latin face — both share similar optical metrics.
   * Falls back gracefully to system fonts when fonts fail to load.
   */
  fontFamily: {
    sans: ["Tajawal", "Inter", "Segoe UI", "system-ui", "sans-serif"].join(", "),
    mono: ["JetBrains Mono", "Fira Code", "Courier New", "monospace"].join(", "),
  },

  /** Modular type scale (rem, base = 16px) */
  fontSize: {
    "2xs": "0.625rem",  // 10px
    xs:   "0.75rem",   // 12px
    sm:   "0.875rem",  // 14px
    base: "1rem",      // 16px
    lg:   "1.125rem",  // 18px
    xl:   "1.25rem",   // 20px
    "2xl":"1.5rem",    // 24px
    "3xl":"1.875rem",  // 30px
    "4xl":"2.25rem",   // 36px
  },

  fontWeight: {
    regular:   "400",
    medium:    "500",
    semibold:  "600",
    bold:      "700",
    extrabold: "800",
  },

  lineHeight: {
    tight:  "1.3",
    normal: "1.6",
    loose:  "1.9",
  },
} as const;

// ---------------------------------------------------------------------------
// SPACING & LAYOUT
// ---------------------------------------------------------------------------
export const spacingTokens = {
  /** 4px base unit — all spacing is a multiple of 4 */
  unit: 4,

  /** Named spacing slots */
  1: "0.25rem",  //  4px
  2: "0.5rem",   //  8px
  3: "0.75rem",  // 12px
  4: "1rem",     // 16px
  5: "1.25rem",  // 20px
  6: "1.5rem",   // 24px
  8: "2rem",     // 32px
  10: "2.5rem",  // 40px
  12: "3rem",    // 48px
  16: "4rem",    // 64px
  20: "5rem",    // 80px
  24: "6rem",    // 96px
} as const;

// ---------------------------------------------------------------------------
// BORDER & RADIUS
// ---------------------------------------------------------------------------
export const borderTokens = {
  radius: {
    sm:   "0.25rem",   //  4px
    md:   "0.5rem",    //  8px  ← default
    lg:   "0.75rem",   // 12px
    xl:   "1rem",      // 16px
    "2xl":"1.5rem",    // 24px
    full: "9999px",
  },
  width: {
    DEFAULT: "1px",
    2:       "2px",
  },
} as const;

// ---------------------------------------------------------------------------
// SHADOWS
// ---------------------------------------------------------------------------
export const shadowTokens = {
  sm:     "0 1px 3px rgba(15, 23, 42, 0.07)",
  soft:   "0 14px 38px rgba(23, 32, 42, 0.08)",  // kept from legacy
  md:     "0 4px 16px rgba(15, 23, 42, 0.10)",
  lg:     "0 12px 40px rgba(15, 23, 42, 0.14)",
  focus:  "0 0 0 3px rgba(132, 61, 176, 0.25)", // primary/600 ring
} as const;

// ---------------------------------------------------------------------------
// ANIMATION
// ---------------------------------------------------------------------------
export const animationTokens = {
  duration: {
    fast:   "100ms",
    normal: "200ms",
    slow:   "350ms",
  },
  easing: {
    ease:    "cubic-bezier(0.25, 0.1, 0.25, 1)",
    easeOut: "cubic-bezier(0, 0, 0.2, 1)",
    spring:  "cubic-bezier(0.34, 1.56, 0.64, 1)",
  },
} as const;

// ---------------------------------------------------------------------------
// BREAKPOINTS (mirrors Tailwind defaults — do NOT change values)
// ---------------------------------------------------------------------------
export const breakpointTokens = {
  sm:  "640px",
  md:  "768px",
  lg:  "1024px",
  xl:  "1280px",
  "2xl": "1536px",
} as const;
