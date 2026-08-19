# blog-sc

个人博客，基于 **Astro** + **React** + **TypeScript** + **shadcn/ui**。

## 技术栈

- Astro 7（页面与静态路由）
- React 19（交互岛屿）
- TypeScript（strict）
- Tailwind CSS 4
- shadcn/ui（`base-nova`，基于 `@base-ui/react`）
- pnpm（Node `>=22.12.0`）

## 开发

```bash
pnpm install
pnpm dev
```

其他常用命令：

```bash
pnpm build       # 构建 → dist/
pnpm preview     # 预览构建产物
pnpm lint        # ESLint（.ts / .tsx）
pnpm format      # Prettier
pnpm typecheck   # Astro + TS 检查
```

## 内容维护

### AI 摘要

AI 摘要脚本会将所选文章正文发送到 OpenCode Zen 第三方服务，并回写文章 frontmatter 的 `aiSummary` 与 `aiSummaryModel`。不要对包含敏感信息的草稿执行该脚本。

```bash
pnpm summary                    # 交互选择一篇文章并生成/覆盖摘要
pnpm summary -- folo_verify     # 指定文章；可省略 .md / .mdx 后缀
pnpm summary:all                # 仅为缺少摘要的文章生成
pnpm summary:force              # 强制重新生成全部文章摘要
```

### 清理未使用图片

图片清理只审计 `src/content/posts/**/*.md(x)` 对 `public/pic/` 的引用。先检查候选；确认需要由其他页面、动态逻辑或未来文章保留的图片后，将其相对路径写入 `scripts/pic-allowlist.txt`，再执行删除命令。

```bash
pnpm images:check  # 仅输出未引用图片候选，不会删除文件
pnpm images:clean  # 删除候选图片；遇到断裂引用或无效允许名单会拒绝执行
```

允许名单每行一个精确的相对 `public/pic/` 路径，也支持 `/pic/` 前缀；空行和 `#` 注释会被忽略。

## 添加 shadcn 组件

```bash
pnpm dlx shadcn@latest add button
```

组件会生成到 `src/components/ui`。在 `.astro` 页面中引入时，交互组件需要 hydration 指令，例如：

```astro
---
import Layout from "@/layouts/main.astro"
import { Button } from "@/components/ui/button"
---

<Layout>
  <Button client:load>Button</Button>
</Layout>
```
