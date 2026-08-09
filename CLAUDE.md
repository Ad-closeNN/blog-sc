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

## Gotchas & Notes

### Expressive Code（代码块）

- 代码块用 **`astro-expressive-code`**（替代 Astro 内置 shiki），`astro.config.mjs` 里配置了 line-numbers / collapsible-sections 插件、zh-CN locale、github-dark 主题。
- **`rehype-expressive-code` 必须放在 `markdown.processor` 的 `rehypePlugins` 首位**：`rehype-raw` 会重解析 `<pre>/<code>` 并剥离 code 节点的 `metastring`，导致行高亮（`{1-3}`）、新增/删除行（`ins=`/`del=`）、折叠（`collapse=`）、标题（`title=`）全部失效。EC 的 integration 会再 push 一份到末尾，遇到已渲染的 frame 会幂等跳过，无需担心重复。
- `astro.config.mjs` 里有两处 EC 配置（integration + 手动 rehype 那份），**改 styleOverrides / 插件 / locale 必须两处同步**。
- 代码字体统一 `var(--font-mono)`（Cascadia Mono），frame 无阴影，激活 tab 橙色指示线在底部（`editorActiveTabIndicatorBottomColor: "#f9826c"`，顶部禁用）。
- 文章里已有大量 EC 语法代码块，改动代码块渲染务必实机抽查 `custom-frontmatter.md` / `giscus.md` / `kugou-music-download.md`（含行高亮 / ins / collapse）。

### 图片灯箱（`src/components/ImageLightbox.astro`）

- 点击图片区域也关闭灯箱（与遮罩一致），带 `dragMoved` 阈值（3px）区分「拖拽平移」与「点击关闭」。
- 手机端双指捏合缩放用**精确锚点**算法（捏合起点中点下的图像点全程保持在新中点下），不走滚轮的 `runZoomLoop`（要即时跟手）。
- `.lightbox` 和 `.lightbox-img` 必须有 `touch-action: none`，否则手机浏览器默认整页缩放会劫持双指捏合。**不要加 `user-scalable=no`**（iOS 强制忽略且伤害无障碍）。

### 统计（umami / GA）

- `src/config.ts` 里 `umamiConfig` / `gaConfig` 的 id（`7610548d-...`、`G-YRCGFG45C1`）**待用户为 blog-sc 新建站点后替换**。
- `window.__blogUmami` store 注入在 `BaseLayout.astro`（`is:inline define:vars`），必须用 `define:vars` 传 `umamiConfig`——`is:inline` 不做插值，直接写 `umamiConfig.xxx` 会运行时 `ReferenceError`。
- 移除过 store 的结果值缓存：`window.__blogUmami` 跨 View Transitions 存活，若缓存结果值切页回来会显示旧浏览量。
- View Transitions 下 GA 用 `send_page_view: false` + `astro:page-load` 手动上报，切页不漏报。

### 其他

- 搜索代码用 `rg` 而非 `grep`。
- 配置集中在 `src/config.ts` 单文件（site/navigation/links/footer/profile/friends/ga/umami），不要拆成目录。
- 热力图模块已删除（`PostHeatmap.astro` / `heatmap-core.ts` 均移除），不要再引用。
- 侧栏「信息」卡（`SidebarStats.tsx`）：一言 API / Umami 全站访问量 / GitHub 最新 commit（`site.githubRepo` 是私有仓库时 commit 显示「提交信息不可用」，属正常降级）。
