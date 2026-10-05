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

### Callout（`src/plugins/remark-callout.mjs`）

支持两种写法，产出**同一套** `<aside class="callout callout-{type}">`，共用 `global.css` 的 `.callout*` 样式（改样式只需一处）：

| 写法 | 标题 | 正文 |
|---|---|---|
| `:::tip[xxx]` + 正文 + `:::` | `xxx` | `:::` 内后续内容 |
| `> [!TIP]xxx` + 后续 `>` 行 | `xxx`（marker 同一行剩余部分） | 后续 `>` 行 |
| `> [!TIP]` + 后续 `>` 行 | 默认标题（提示/笔记/…） | **整个块**（含首段） |

即 marker 同行有文字就当标题，没文字就整块当正文。类型大小写不敏感：tip / note / info / warning / caution / important。

- **只认「块引用首个节点是以 `[!TYPE]` 开头的文本段落」**：`> 正文 [!TIP]`（不在开头）、`> [!BOGUS]x`（未知类型）、普通引用一律原样渲染成 `<blockquote>`，不会误伤。
- **转义写法 `\[!TIP]x` 不触发**：mdast 的 `text.value` 会吃掉反斜杠，只能拿 `position.start.offset` 回查源串判断首字符是否为 `\`。
- 标题按 **`text.value` 而非源串切片**处理：块引用后续行的 `>` 前缀只存在于源码里，按 value 匹配才不会把 `> ` 混进正文（`rawSlice` 的返回值不能直接当正文用）。
- 标题按「首个含换行的 text 节点」为界切分，所以 `> [!TIP]**粗体**标题` 的**行内格式会保留**（`<strong>` 进 `callout-title`）。而 `:::tip[xxx]` 走 `extractLabel` + `textOf`，标题恒为**纯文本**，`:::tip[**粗体**]` 会显示字面量 —— 两者行为差异是刻意的。
- 改这个插件务必**两套语法都实机抽查**：`:::tip` 现有用例见 `custom-frontmatter.md` / `giscus.md` / `newtab_link.md`（含 `::github{repo=...}`）。

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

- `summary.js`：为文章生成 AI 摘要，迁移自 blog-fuwari。**不绑定任何服务商**，用任意 OpenAI 兼容的 `/chat/completions` 端点。结果回写文章 frontmatter 的 `aiSummary` / `aiSummaryModel`。`pnpm summary` 交互选文、`summary:all` 仅补缺、`summary:force` 全量重写。
  - **三个配置项都不内置**：`--api_url` / `--api_key` / `--model`。任一缺失时**就地交互提问**（已有参数则跳过，不重复问）；非交互终端（管道/CI）下直接报错而不是静默挂起。刻意不写默认值 —— 服务下线、模型受限、凭据硬编码都会让脚本静默失效（曾内置的 OpenCode Zen 免费模型就是这么废的）。
  - **`--api_url` 填基地址即可**，脚本自动补 `/chat/completions`（`resolveApiEndpoint`）；已含该路径则原样使用；末尾斜杠、`http://` 都能正确处理，非 http/https 会报错。别在文档里写死某个服务商的完整端点。
  - **API Key 来源优先级**：`--api_key` > 环境变量（`SUMMARY_API_KEY`，回退 `OPENAI_API_KEY`）> 交互式隐藏输入。环境变量在**模块顶层求值**（`envApiKey`），运行时改 `process.env` 不生效。
  - 交互输入密钥用 `askSecret`（raw 模式逐字符读、只回显 `*`）。**不要改回 `rl.question` + 覆写 `_writeToOutput`** —— Node 24 的 readline 回显不再走那个私有方法，覆写无效，密钥会原样显示在屏幕上（实测踩过）。
  - 请求用 `node:http` / `node:https`，**按 URL 协议二选一**（`endpoint.protocol === "http:" ? http : https`），否则 `http://` 地址（如本地 ollama）会握手失败。请求体 `messages: [{ role, content }]` + `max_tokens` + `stream: false`；响应取 `choices[0].message.content`（**响应里可能另有 `reasoning_content`，别取错**）。**不要加 `anthropic-version`** 之类的非 OpenAI 头。
  - 配置以 `{ endpoint: URL, apiKey, model }` 结构在 `resolveConfig` 里组装后逐层透传（`generateSummary` / `generateMissingSummaries`）。
  - 参数解析（`parseArguments`）区分**布尔 flag**（`--all`/`--force`/`--help`，收进 Set）与**带值参数**（`--model`/`--api_url`/`--api_key`，模式是 `valueFlags` 集合 + 取下一个 argv，缺值时报错）。**新增带值参数必须同时加进 `valueFlags`**，否则会被当作位置参数（文章名）。
  - 交互选文（`selectFile`）与 `askSecret` 同用 readline raw 模式，两个必须遵守的坑：`wasRaw` / `wasPaused` 要在 `createInterface()` / `setRawMode(true)` **之前**读（readline 构造函数会立刻把 stdin 设为 raw，之后再读就恢复不回用户终端原本状态）；键盘处理函数（`onKey`）要写成**同一作用域的函数声明**，否则 `cleanup` 引用不到（曾定义在 Promise executor 内部，导致 `ReferenceError: onKey is not defined`）。
- `clean-unused-pictures.js`：审计 `src/content/posts` 对 `public/pic/` 的引用。**只读 `images:check`** 输出未引用候选；**`images:clean`（`--delete`）才删除**。`pic-allowlist.txt` 是保留名单（每行一个相对 `public/pic/` 路径，支持 `/pic/` 前缀，`#` 注释），写入名单的图片即使未被文章引用也不删。
- 这两个是独立 Node 脚本，不参与 Astro 构建 / typecheck。

### 站点公告横幅（`src/components/SiteNotice.astro`）

- 文案 / 开关 / 链接都在 `src/config.ts` 的 `noticeConfig`。关闭状态按 **`noticeConfig.id`** 存 `localStorage["blog:notice-dismissed"]`——**改文案必须同时递增 id**，否则关过的老访客永远看不到新公告。
- 组件模板**刻意不包 `{noticeConfig.enable && ...}`**：`is:inline` 脚本放进 JSX 表达式会让 `prettier-plugin-astro` 解析失败（`Comments.astro` 就因此在 `pnpm format` 里长期报 SyntaxError）。`enable` 判断放在调用处（`BaseLayout.astro` / `index.astro`）。
- **两处渲染点**：非首页由 `BaseLayout.astro` 插在 `<main>` 顶部；首页 `main.is-home-feed` 是全宽（横幅要出血），公告改由 `index.astro` 放进 `.home-feed-panel` 内，宽度全靠父级，组件自身不设宽度。加新布局时注意别落进全宽容器。
- 默认渲染为可见、脚本按需 `hidden`：无 JS 时公告照常显示（只是关不掉）。已关过的访客靠**同步执行**的 inline 脚本 + `astro:before-swap`（给 `event.newDocument` 打 hidden）两条路径避免闪现。
- 收起动画：先把 `offsetHeight` 写成具体 px、强制回流、再降到 0（`auto → 0` 不产生过渡）。`transitionend` 必须按 `event.target === slot && propertyName === "height"` 过滤——子元素的 opacity/transform 过渡会冒泡上来提前判定完成；另有 700ms `setTimeout` 兜底（过渡被打断 / 标签页切后台）。

### 首页 JS 分页 / 归档

- 首页文章列表是**客户端 JS 分页**（`src/components/HomePagination.astro`），窗口算法同 Fuwari：当前页 ±2 共 5 个页码，两端收缩为 `1 … n … N`。frontmatter 与切换时的客户端重渲染用**同一份**窗口算法（注释标注「与组件 frontmatter 同源」），改算法两处同步。
- **筛选与分页的职责分离（易踩坑）**：筛选器（`src/lib/timeline-filter.ts`）**只写 `data-filter-hidden` 标记，不碰 `item.hidden`**；`HomePagination.astro` 是**唯一**负责 `item.hidden` 的地方，基于未被筛选标记的文章重新切片。改任一方都不能破坏这个分工。
- Tag 筛选变化后**从第 1 页重新分页**（`cf6a239`），不能留在原第 N 页容器。
- 第 2 页起 navbar 面包屑切到「首页 / N/总页」，回第 1 页恢复品牌名。
- `/posts/` 是按年归档（`src/components/PostArchive.astro` + `groupPostsByYear` from `src/lib/posts.ts`），不是列表。

### robots.txt（`src/pages/robots.txt.ts`）

- 是**端点不是静态文件**，`public/robots.txt` 已删（同路径静态文件会和页面路由冲突）。Sitemap 行从 `site.url` 派生，换域名只改 `config.ts` 一处。
- 首页参数变体（`timeline-filter.ts` 的 `replaceState` 写的 `?tag=`）用**根锚定**规则 `Disallow: /?tag=`，**不要写成 `/*?tag=`**——通配版会拦住任何路径下的 `?tag=`（例如将来某个页面自己用同名参数），根锚定只作用于首页。
- **若将来再加带 `noindex` 的页面：绝不能在 robots.txt 里 `Disallow` 它。** Google 要求「noindex 生效的前提是页面未被 robots.txt 拦住」——拦了爬虫就读不到 noindex，加上站内有内链指过去，反而会被 URL-only 收录（标题位显示裸 URL）。这是踩过的坑（原 `/tags/`、`/categories/` 两个筛选页，均已删除），别重演。
- `sitemap()` 目前不带 filter：站内已无 noindex 页。将来若加回 noindex 页，需同步在 `astro.config.mjs` 加 filter 排除，两者保持一致。

### 头像双份：`avatarSrc` 与 `iconSrc`（`src/config.ts`）

`public/images/` 下两张头像**不是重复文件，不要合并或删任一张**：

| 文件 | config key | 形态 | 用途 |
|---|---|---|---|
| `avatar.png` 140KB | `site.avatarSrc` | 600×600 圆形，调色板透明（PLTE+tRNS，约 21% 像素透明） | 站内 UI（`SiteNavbar`、`friends.astro` 给别人抄的友链素材）+ **favicon / `apple-touch-icon`** |
| `avatar.jpg` 44KB | `site.iconSrc` | 600×600 方形不透明（即 png 压白底的展平版） | **只给各页 `ogImage`** |

- **favicon 用透明的 `avatarSrc`，OG 图用方形的 `iconSrc`，分工别搞反。** 曾按「Google 不支持透明 favicon」把 favicon 切到方形版，那个判断是**错的**，已回退：
  - cloudflare.com 的 s2 图标实测就是**带透明角的 PNG**，Google 完全能保留透明。
  - GitHub 的源 `favicon.ico` 有 **46.5% 透明像素**，s2 输出却是填白底的方图 —— 搜索结果里的圆形是 **Google UI 的圆形裁切**，跟图片形状无关。GitHub 的头像文件本身也是方形 JPEG，圆是 CSS `border-radius` 画的。
  - 所以透明与否既不影响收录，也不影响显示成圆。透明版反而在浏览器 tab 里能跟随明暗背景。
- OG 图**不要**跟着换成透明版：各社交平台对透明 PNG 的合成底色不一致（白/黑/跟随主题），透明角会在深色卡片上露出突兀边缘。favicon 没这问题。
- 反向也别搞错：navbar 那个圆形头像**要**用 `avatarSrc`，四角透明是它需要的。
- `public/favicon.ico`（9.2KB，RGBA，含 16/32/48 三档）由 **`avatar.png`** 生成，本仓库**从来没有过 ico**（`--diff-filter=A` 全历史确认），线上 `/favicon.ico` 长期 404，是新加的。头像换图时**记得重新生成**（没有任何检查会报不一致）：
  ```bash
  python -c "from PIL import Image; Image.open('public/images/avatar.png').convert('RGBA').save('public/favicon.ico', sizes=[(16,16),(32,32),(48,48)])"
  ```
- **`.ico` 不是给 Google 的**：官方文档只说 Google 读首页 `<link>`，对根路径 `/favicon.ico` 的探测**没有任何说明**，也**没规定多个 icon 声明的优先级**。`.ico` 的价值在浏览器地址栏与会直连根路径的第三方服务。
- 因此 `BaseLayout.astro` 里三条 icon 声明**顺序有意义**：600×600 PNG 放首位（对齐官方「建议大于 48×48」），`.ico` 次之。`.ico` 的 `sizes` 要列全 `16x16 32x32 48x48` —— 曾错写成 `32x32`，那会谎报它的内容、并在挑大图时与首位声明自相矛盾。
- `<link rel="icon">` 的 `type` 必须与实际文件匹配（现在是 `image/png`）—— 换源图时最容易漏掉这个属性，写错格式部分客户端会拒绝解析。
- `public/favicon.svg` 是 `pnpm create astro` 脚手架留下的 **Astro logo**，从 `22f843a init` 起就在、从未被引用，已删。别当成站点图标又加回来。
- Google 的 favicon **按 hostname 缓存**、只读该 host 首页的 `<link>`，子域各自独立（官方原话：one favicon per site, where a site is defined by the hostname），文档对 301 如何归并 favicon **没有说明**。
- **「搜索结果看不到头像」的实际根因是 host 不是图片**：用 s2 图标与头像做相关系数比对（1.0=同图），`blog.adclosenn.top` 是 **0.999**（Google 早就抓到了你的头像），而搜索结果标题行显示的 `adclosenn.top` 是 **0.380**（apex 自己的旧图标）。apex 已 301 到 blog 子域，等 Google 重抓收敛。诊断这类问题**先按 host 分别查 s2**，别一上来就改图片。
- 改 favicon 后要等 Google 重抓首页（官方说法几天到几周），可在 Search Console 用 URL 检查请求编入索引加速。

### 其他

- 搜索代码用 `rg` 而非 `grep`。
- 配置集中在 `src/config.ts` 单文件（site/navigation/links/footer/profile/friends/ga/umami/giscus），不要拆成目录。
- 热力图模块已删除（`PostHeatmap.astro` / `heatmap-core.ts` 均移除），不要再引用。
- 侧栏「信息」卡（`SidebarStats.tsx`）：一言 API / Umami 全站访问量 / 构建期 commit。commit 由 Workers Builds 自动注入的环境变量 `WORKERS_CI_COMMIT_SHA` / `WORKERS_CI_BRANCH` 在构建时读取（`src/lib/build-commit.ts`），本地 dev / 未注入时显示 dev——**不要再改回运行时调 GitHub API**。
