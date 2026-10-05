// @ts-check

import { unified } from "@astrojs/markdown-remark"
import react from "@astrojs/react"
import sitemap from "@astrojs/sitemap"
import tailwindcss from "@tailwindcss/vite"
import { pluginCollapsibleSections } from "@expressive-code/plugin-collapsible-sections"
import { pluginFramesTexts } from "@expressive-code/plugin-frames"
import { pluginLineNumbers } from "@expressive-code/plugin-line-numbers"
import expressiveCode from "astro-expressive-code"
import { defineConfig } from "astro/config"
import rehypeExpressiveCode from "rehype-expressive-code"
import rehypeRaw from "rehype-raw"
import remarkDirective from "remark-directive"

import { remarkCallout } from "./src/plugins/remark-callout.mjs"

// 复制按钮等 UI 文案中文化
pluginFramesTexts.addLocale("zh-CN", {
  terminalWindowFallbackTitle: "终端窗口",
  copyButtonTooltip: "点击复制",
  copyButtonCopied: "复制成功!",
})

const siteUrl = "https://blog.adclosenn.top"

/**
 * @param {string} href
 */
function isExternalHref(href) {
  return /^https?:\/\//i.test(href)
}

function externalLinksTargetBlank() {
  /**
   * @param {any} tree
   */
  return (tree) => {
    /**
     * @param {any} node
     */
    const visit = (node) => {
      if (!node || typeof node !== "object") return

      if (
        node.type === "element" &&
        node.tagName === "a" &&
        typeof node.properties?.href === "string" &&
        isExternalHref(node.properties.href)
      ) {
        node.properties.target = "_blank"
        node.properties.rel = "noopener noreferrer"
      }

      if (Array.isArray(node.children)) {
        node.children.forEach(visit)
      }
    }

    visit(tree)
  }
}

function demoteMarkdownH1() {
  /**
   * @param {any} tree
   */
  return (tree) => {
    /**
     * @param {any} node
     */
    const visit = (node) => {
      if (!node || typeof node !== "object") return

      if (node.type === "element" && node.tagName === "h1") {
        node.tagName = "h2"
      }

      if (Array.isArray(node.children)) {
        node.children.forEach(visit)
      }
    }

    visit(tree)
  }
}

/**
 * 剥离正文里 /public/ 前缀的资源 URL。
 *
 * Obsidian 的 fix-public-links 插件会把 `public/xxx` 改写成 `/public/xxx`，
 * 但 Astro 把 public/ 目录内容复制到站点根，正确 URL 是不带 /public 的
 * （`public/pic/x.png` → `/pic/x.png`）。多出的 /public 会 404，故构建时剥离。
 *
 * 只处理 <img src> 与 <a href> 两个属性，不碰 <code> 等文本节点里的字面量
 * （如 umami.md 里讲静态资源路径的 `` `/public/datamaps.world.json` ``）。
 */
function normalizePublicAssetPaths() {
  /**
   * @param {unknown} value
   */
  const strip = (value) =>
    typeof value === "string" && value.startsWith("/public/")
      ? value.slice("/public".length)
      : value

  /**
   * @param {any} tree
   */
  return (tree) => {
    /**
     * @param {any} node
     */
    const visit = (node) => {
      if (!node || typeof node !== "object") return

      if (node.type === "element" && node.properties) {
        if (node.tagName === "img" && node.properties.src) {
          node.properties.src = strip(node.properties.src)
        } else if (node.tagName === "a" && node.properties.href) {
          node.properties.href = strip(node.properties.href)
        }
      }

      if (Array.isArray(node.children)) {
        node.children.forEach(visit)
      }
    }

    visit(tree)
  }
}

export default defineConfig({
  site: siteUrl,
  output: "static",
  trailingSlash: "always",
  integrations: [
    expressiveCode({
      // github-dark 与站点深色代码块配色一致
      themes: ["github-dark"],
      defaultLocale: "zh-CN",
      plugins: [pluginCollapsibleSections(), pluginLineNumbers()],
      defaultProps: {
        wrap: true,
        overridesByLang: {
          shellsession: { showLineNumbers: false },
        },
      },
      styleOverrides: {
        // 统一用站点 --font-mono（Cascadia Mono），不用 EC 默认系统等宽
        codeFontFamily: "var(--font-mono)",
        frames: {
          // 去掉 frame 右下阴影
          frameBoxShadowCssValue: "none",
          // 橙色指示线从 tab 顶部移到底部（文字下面），与 fuwari 一致
          editorActiveTabBackground: "none",
          editorActiveTabIndicatorBottomColor: "#f9826c",
          editorActiveTabIndicatorTopColor: "none",
        },
      },
    }),
    react(),
    // 站内已无 noindex 页面，无需 sitemap filter（曾用于排除 /tags/ 筛选页）
    sitemap(),
  ],
  markdown: {
    processor: unified({
      remarkPlugins: [remarkDirective, remarkCallout],
      rehypePlugins: [
        // EC 必须在 rehype-raw 之前运行：rehype-raw 会重解析 <pre>/<code>
        // 并剥离 code 节点的 metastring，导致 EC 的 title/高亮/折叠 meta 丢失。
        // 手动放首位保证 EC 先读 meta 并渲染，rehype-raw 后跑不影响。
        // （integration 也会在末尾 push 一份，遇到已渲染的 frame 会跳过）
        [rehypeExpressiveCode, {
          themes: ["github-dark"],
          defaultLocale: "zh-CN",
          plugins: [pluginCollapsibleSections(), pluginLineNumbers()],
          defaultProps: {
            wrap: true,
            overridesByLang: { shellsession: { showLineNumbers: false } },
          },
          styleOverrides: {
            codeFontFamily: "var(--font-mono)",
            frames: {
              frameBoxShadowCssValue: "none",
              editorActiveTabBackground: "none",
              editorActiveTabIndicatorBottomColor: "#f9826c",
              editorActiveTabIndicatorTopColor: "none",
            },
          },
        }],
        rehypeRaw,
        normalizePublicAssetPaths,
        externalLinksTargetBlank,
        demoteMarkdownH1,
      ],
    }),
  },
  vite: {
    plugins: [tailwindcss()],
    server: {
      // 允许通过任意外部预览域名访问 dev server
      allowedHosts: true,
    },
  },
})
