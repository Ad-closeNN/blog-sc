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
