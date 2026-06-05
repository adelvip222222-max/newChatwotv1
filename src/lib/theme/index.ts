/**
 * @file index.ts
 * @description Public barrel export for the Chatzi Theme System.
 *
 * Import all theme utilities from "@/lib/theme" — never from sub-paths.
 * This ensures that future refactors only need to update this file.
 */

export * from "./tokens";
export * from "./css-variables";
// Note: tailwind-tokens.ts is NOT re-exported here — it is consumed
// exclusively by tailwind.config.ts to avoid polluting the runtime bundle.
