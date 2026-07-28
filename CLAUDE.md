# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

`blog-sc` is a **personal blog** (个人博客) built with Astro 7 and the shadcn/ui component library. Interactive pieces use React 19 islands; styling is TypeScript (strict) + Tailwind CSS 4. shadcn style is `base-nova` on `@base-ui/react`. Package manager is **pnpm**. Node `>=22.12.0`.

Product intent for future work in this repo:

- Primary deliverable is a personal blogging site, not a generic app template.
- Prefer Astro for pages, layouts, content rendering, and static output; use React only where UI needs client interactivity (theme toggle, menus, search, etc.).
- Prefer shadcn/ui primitives under `src/components/ui` for UI building blocks; add new ones via the shadcn CLI so they stay on `base-nova`.
- Keep the site content-first: readable typography, clear post navigation, and a thin chrome around articles.
- Default UI copy may be Simplified Chinese unless a page/feature is explicitly bilingual or English-only.

Current state: scaffold only (layout + home placeholder + `Button`). Blog routes, content source, and post rendering are not implemented yet — introduce them when building features, do not assume a CMS.

There is no test runner or test suite yet. Do not invent test commands.

## Commands

```bash
pnpm install          # install deps
pnpm dev              # Astro dev server
pnpm build            # production build → dist/
pnpm preview          # serve dist/ locally
pnpm lint             # ESLint on **/*.{ts,tsx} (not .astro)
pnpm format           # Prettier write for **/*.{ts,tsx,astro}
pnpm typecheck        # astro check (Astro + TS)
pnpm astro ...        # pass-through to Astro CLI
```

Add shadcn components (land in `src/components/ui`):

```bash
pnpm dlx shadcn@latest add <component>
# or: npx shadcn@latest add <component>
```

ESLint only covers `.ts`/`.tsx`. Type-check Astro pages/layouts with `pnpm typecheck`. Format covers Astro via `prettier-plugin-astro`.

## Architecture

### Stack wiring

- **Astro** owns routing and static HTML. Config: `astro.config.mjs` — `@astrojs/react` + Tailwind via `@tailwindcss/vite` (no separate `tailwind.config`).
- **React** is used for interactive UI islands only. Components from `src/components/ui` (and any custom React components) must be hydrated in `.astro` with a client directive, e.g. `client:load` (see `src/pages/index.astro`).
- **shadcn/ui** is configured in `components.json`: style `base-nova`, `rsc: false`, aliases under `@/`, CSS entry `src/styles/global.css`, icons `lucide`. Generated UI primitives live in `src/components/ui` and depend on `@base-ui/react` + `cva` + `cn`.
- **Path alias**: `@/*` → `./src/*` (`tsconfig.json`).

### Directory map (src)

| Path | Role |
|------|------|
| `src/pages/` | File-based routes (`.astro`) |
| `src/layouts/` | Shared document shell (`main.astro` imports global CSS, provides `<slot />`) |
| `src/components/` | App components; `ui/` = shadcn primitives |
| `src/lib/utils.ts` | `cn()` — `clsx` + `tailwind-merge` |
| `src/styles/global.css` | Tailwind 4 entry, shadcn theme tokens (oklch CSS variables), light/dark, fonts |
| `public/` | Static assets (e.g. `favicon.svg`) |

Typical page pattern: frontmatter imports `Layout` + React components → `<Layout>` wraps markup → React children use `client:*`.

### Styling

- Design tokens and dark mode (`.dark`) are CSS variables in `global.css`, mapped into Tailwind via `@theme inline`.
- Fonts: Inter Variable (`font-sans`), Geist Variable (`font-heading`).
- Prefer `cn()` / `cva` for class composition; Prettier sorts Tailwind classes (`prettier-plugin-tailwindcss`, functions `cn`/`cva`).
- No semicolons; double quotes; 2-space indent; LF; print width 80 (`.prettierrc`).

### Conventions to keep

- Import UI from `@/components/ui/...` and utils from `@/lib/utils`.
- New shadcn pieces go through the CLI so they match `components.json` aliases and `base-nova`.
- Keep layouts thin (HTML shell + global CSS); put page content in `pages/` and interactive pieces in React components.
- `pnpm-workspace.yaml` exists with empty `packages`; treat this as a single-package app unless a workspace package is added later.
