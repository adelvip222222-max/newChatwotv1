/**
 * tailwind.config.ts
 *
 * Architecture: All design values live in src/lib/theme/tokens.ts.
 * This file only orchestrates: it imports the pre-computed extension
 * object and spreads it into `theme.extend`.
 *
 * Rule: NEVER add raw hex values here. Add to tokens.ts first.
 */

import type { Config } from "tailwindcss";
import { tailwindThemeExtension } from "./src/lib/theme/tailwind-tokens";

const config: Config = {
  darkMode: "class",
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: tailwindThemeExtension,
  },
  plugins: [],
};

export default config;
