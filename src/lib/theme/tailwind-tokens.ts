/**
 * @file tailwind-tokens.ts
 * @description Tailwind theme extensions derived from the design token registry.
 *
 * This file is imported by tailwind.config.ts ONLY.
 * It maps design tokens → Tailwind utility classes WITHOUT touching any
 * upstream / base Tailwind config. All additions are placed inside
 * `theme.extend` to remain fully non-breaking.
 *
 * Consuming pattern:
 *   bg-primary       → colorTokens.primary[600]
 *   text-ink         → colorTokens.neutral[950]
 *   shadow-soft      → shadowTokens.soft
 *   rounded-chatzi   → borderTokens.radius.md
 */

import { colorTokens, typographyTokens, shadowTokens, borderTokens, animationTokens } from "./tokens";

export const tailwindThemeExtension = {
  colors: {
    // Brand
    primary:     colorTokens.primary,
    // Semantic
    success:     colorTokens.success,
    warning:     colorTokens.warning,
    error:       colorTokens.error,
    info:        colorTokens.info,
    coral:       colorTokens.coral,
    // Named shortcuts preserved from legacy (backward-compat)
    ink:         "var(--color-ink)",
    paper:       "var(--color-paper)",
    accent:      "var(--color-accent)",
  },

  fontFamily: {
    sans: typographyTokens.fontFamily.sans.split(", "),
    mono: typographyTokens.fontFamily.mono.split(", "),
  },

  boxShadow: {
    sm:     shadowTokens.sm,
    soft:   shadowTokens.soft,   // kept — used across ~35 components
    md:     shadowTokens.md,
    lg:     shadowTokens.lg,
    focus:  shadowTokens.focus,
  },

  borderRadius: {
    sm:    borderTokens.radius.sm,
    md:    borderTokens.radius.md,
    lg:    borderTokens.radius.lg,
    xl:    borderTokens.radius.xl,
    "2xl": borderTokens.radius["2xl"],
  },

  transitionDuration: {
    fast:   animationTokens.duration.fast,
    normal: animationTokens.duration.normal,
    slow:   animationTokens.duration.slow,
  },

  transitionTimingFunction: {
    spring: animationTokens.easing.spring,
  },
} as const;
