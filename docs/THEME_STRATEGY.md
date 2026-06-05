/**
 * @file THEME_STRATEGY.md
 * @location docs/THEME_STRATEGY.md
 *
 * Chatzi Theme System — Architecture & Strategy Document
 * ═══════════════════════════════════════════════════════
 * Phase 1 Deliverable | Version 1.0.0
 */

# Chatzi Theme System — Architecture & Strategy

## 1. Overview

The Chatzi theme system is built as a **layered, additive architecture**.
No core framework file is mutated. All customisations are injected on top of
Tailwind CSS's `theme.extend`, preserving full upgrade compatibility.

---

## 2. Layer Architecture

```
┌─────────────────────────────────────────────────────┐
│  Layer 4 — Components (globals.css @layer components)│
│  .field  .btn-primary  .panel  .badge-*  .callout-* │
├─────────────────────────────────────────────────────┤
│  Layer 3 — CSS Custom Properties (:root in globals) │
│  --color-accent  --font-sans  --shadow-md  --radius  │
├─────────────────────────────────────────────────────┤
│  Layer 2 — Tailwind Extension (tailwind.config.ts)  │
│  bg-primary  text-ink  shadow-soft  rounded-lg      │
├─────────────────────────────────────────────────────┤
│  Layer 1 — Design Token Registry (tokens.ts)        │
│  colorTokens  typographyTokens  shadowTokens  …     │
└─────────────────────────────────────────────────────┘
```

**Data flow:** `tokens.ts` → `tailwind-tokens.ts` → `tailwind.config.ts`
                          └→ `css-variables.ts`  → `globals.css` / runtime

---

## 3. File Structure

```
src/lib/theme/
├── tokens.ts           ← Single Source of Truth for all design values
├── tailwind-tokens.ts  ← Maps tokens to Tailwind theme.extend (build-time)
├── css-variables.ts    ← Generates :root CSS variables (runtime & SSR)
└── index.ts            ← Public barrel export
```

---

## 4. Tenant Theming Strategy

Tenants can override the brand accent colour **at runtime** without recompilation:

```tsx
// In dashboard layout (Phase 3 implementation):
const tenant = await Tenant.findById(tenantId);
const override = tenant.brandColor
  ? buildTenantCssOverride(tenant.brandColor)
  : "";

return (
  <div>
    {override && <style dangerouslySetInnerHTML={{ __html: `:root { ${override} }` }} />}
    {children}
  </div>
);
```

All components reference `var(--color-accent)` — so the entire UI re-themes
with a single CSS variable change. No React state or re-render required.

---

## 5. Typography Strategy

| Face        | Use case                       | Weights loaded |
|-------------|--------------------------------|----------------|
| **Tajawal** | Primary — Arabic UI text       | 400, 500, 600, 700, 800 |
| **Inter**   | Secondary — Latin/numeric text | 400, 500, 600, 700 |

Both loaded via Google Fonts `@import` in `globals.css` with `display=swap`
to prevent FOUT (Flash of Unstyled Text). Preconnect links added to root layout.

---

## 6. i18n Compliance

All user-facing strings must be sourced from `src/lib/i18n.ts`.

| Namespace     | Coverage |
|---------------|----------|
| `t.common`    | ✅ Shared UI strings |
| `t.auth`      | ✅ Login / register |
| `t.nav`       | ✅ Sidebar navigation |
| `t.bots`      | ✅ Bot management |
| `t.channels`  | ✅ All channel types |
| `t.conversations` | ✅ Inbox / messages |
| `t.billing`   | ✅ Plans / packs |
| `t.aiSettings`| ✅ AI configuration |
| `t.admin`     | ✅ Super admin |
| `t.errors`    | ✅ API error messages |

**Migration:** Components still using inline Arabic strings must be updated
in Phase 3 to import from `t.*`. The registry is complete — no new strings
should be added to components directly.

---

## 7. Component Naming Convention

| Class           | Purpose                    |
|-----------------|----------------------------|
| `.field`        | `<input>`, `<select>`, `<textarea>` |
| `.label`        | `<label>` element |
| `.btn-primary`  | Primary CTA (accent color) |
| `.btn-secondary`| Secondary / outline button |
| `.btn-danger`   | Destructive action |
| `.panel`        | Card container |
| `.badge`        | Base badge |
| `.badge-success/warning/error/info/neutral` | Semantic badges |
| `.callout-info/success/error/warning`       | Alert blocks |
| `.data-table`   | Styled `<table>` |
| `.skeleton`     | Loading placeholder |
| `.divider`      | `<hr>` separator |

---

## 8. Upgrade Compatibility Guarantees

1. **No `theme` overrides** — only `theme.extend`. Tailwind upgrades are safe.
2. **No component file mutations** beyond what's explicitly listed.
3. **CSS variable names are stable** — adding new variables never breaks existing ones.
4. **i18n keys are stable** — existing keys are never renamed, only added to.
5. **Legacy class names preserved** — `.ink`, `.paper`, `.accent`, `.shadow-soft`
   all still work via backward-compatible aliases in `tailwind-tokens.ts`.
