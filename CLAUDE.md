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
| `scripts/` | 维护脚本（AI 摘要 `summary.js` / 未引用图片清理 `clean-unused-pictures.js`），独立 Node 脚本不参与构建 |
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

- `src/config.ts` 里 `umamiConfig` / `gaConfig` 的 `measurementId`（`G-YRCGFG45C1`）/ `websiteId` 是**公开标识符**（嵌在网页 `<script>` 里访客可见），非密钥，无需保密。但 `umamiConfig.shareId` 是 Umami 公开分享令牌——持有者可读你的站点访问统计，属设计选择非泄露。
- `window.__blogUmami` store 注入在 `BaseLayout.astro`（`is:inline define:vars`），必须用 `define:vars` 传 `umamiConfig`——`is:inline` 不做插值，直接写 `umamiConfig.xxx` 会运行时 `ReferenceError`。
- 移除过 store 的结果值缓存：`window.__blogUmami` 跨 View Transitions 存活，若缓存结果值切页回来会显示旧浏览量。
- View Transitions 下 GA 用 `send_page_view: false` + `astro:page-load` 手动上报，切页不漏报。

### Giscus 评论（`src/components/Comments.astro`）

- **不能照搬 blog-fuwari 的裸 `<script src=client.js>`**：blog-sc 启用了 `ClientRouter`（View Transitions），裸 script 仅首屏执行，客户端切页不重载，评论区会停在旧文章 / 残留旧 iframe。Comments.astro 用 **installKey + `astro:page-load`** 模式：每次切页清空 `.giscus-container`（`innerHTML=""`）后重建 client.js，避免 iframe 堆积。模式同 `BaseLayout.astro` 的 navbar 脚本。
- 配置注入必须用 `define:vars` 传 `giscusConfig`（`is:inline` 不插值，同 umami）。
- **主题跟随是踩过的坑**：`theme.ts` 的 `setDark` 用 `document.dispatchEvent` 派发 `blog:theme-change`，但 `CustomEvent` 默认 `bubbles:false`——监听器**必须在 `document` 上**，写 `window.addEventListener` 收不到 document 上的非冒泡事件（实测探针 `false`）。
- 主题用 GitHub 色盲友好版 `dark_protanopia` / `light_protanopia`（红绿色盲 Protanopia & Deuteranopia），初始读 `<html>.dark`，切换经 `postMessage({ giscus: { setConfig: { theme } } }, "https://giscus.app")` 实时切，无需重载评论。
- **Giscus 字体无法跟随站点 MiSans**：Giscus 跑在跨域 iframe（giscus.app），网站 CSS 够不到内部；其 `setConfig` API 也无 font 字段。唯一途径是自定义主题 CSS（`data-theme` 填 CSS URL）+ 字体文件配 CORS，但 blog-sc 的 MiSans 是分片 woff2、需跨域加载，代价大——已放弃，评论用 Giscus 默认字体。
- 评论仓库复用 blog-fuwari 的专用仓 `Ad-closeNN/blog-friends`，`mapping="title"`（同名文章会共享 discussion）。

### 内容维护脚本（`scripts/`）

- `summary.js`：为文章生成 AI 摘要，迁移自 blog-fuwari。调 **opencode.ai/zen 免费端点**（`https://opencode.ai/zen/v1/responses`）+ 模型 `deepseek-v4-flash-free`，**无认证 / 无凭据**。结果回写文章 frontmatter 的 `aiSummary` / `aiSummaryModel`。`pnpm summary` 交互选文、`summary:all` 仅补缺、`summary:force` 全量重写。
- `clean-unused-pictures.js`：审计 `src/content/posts` 对 `public/pic/` 的引用。**只读 `images:check`** 输出未引用候选；**`images:clean`（`--delete`）才删除**。`pic-allowlist.txt` 是保留名单（每行一个相对 `public/pic/` 路径，支持 `/pic/` 前缀，`#` 注释），写入名单的图片即使未被文章引用也不删。
- 这两个是独立 Node 脚本，不参与 Astro 构建 / typecheck。

### 首页 JS 分页 / 归档

- 首页文章列表是**客户端 JS 分页**（`src/components/HomePagination.astro`），窗口算法同 Fuwari：当前页 ±2 共 5 个页码，两端收缩为 `1 … n … N`。frontmatter 与切换时的客户端重渲染用**同一份**窗口算法（注释标注「与组件 frontmatter 同源」），改算法两处同步。
- **筛选与分页的职责分离（易踩坑）**：筛选器（`src/lib/timeline-filter.ts`）**只写 `data-filter-hidden` 标记，不碰 `item.hidden`**；`HomePagination.astro` 是**唯一**负责 `item.hidden` 的地方，基于未被筛选标记的文章重新切片。改任一方都不能破坏这个分工。
- 筛选 / Tag / 分类变化后**从第 1 页重新分页**（`cf6a239`），不能留在原第 N 页容器。
- 第 2 页起 navbar 面包屑切到「首页 / N/总页」，回第 1 页恢复品牌名。
- `/posts/` 是按年归档（`src/components/PostArchive.astro` + `groupPostsByYear` from `src/lib/posts.ts`），不是列表。

### 其他

- 搜索代码用 `rg` 而非 `grep`。
- 配置集中在 `src/config.ts` 单文件（site/navigation/links/footer/profile/friends/ga/umami/giscus），不要拆成目录。
- 热力图模块已删除（`PostHeatmap.astro` / `heatmap-core.ts` 均移除），不要再引用。
- 侧栏「信息」卡（`SidebarStats.tsx`）：一言 API / Umami 全站访问量 / 构建期 commit。commit 由 Workers Builds 自动注入的环境变量 `WORKERS_CI_COMMIT_SHA` / `WORKERS_CI_BRANCH` 在构建时读取（`src/lib/build-commit.ts`），本地 dev / 未注入时显示 dev——**不要再改回运行时调 GitHub API**。
