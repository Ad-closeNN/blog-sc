// @ts-check

import { unified } from "@astrojs/markdown-remark"
import react from "@astrojs/react"
import sitemap from "@astrojs/sitemap"
import tailwindcss from "@tailwindcss/vite"
import { defineConfig } from "astro/config"
import remarkDirective from "remark-directive"

import { remarkCallout } from "./src/plugins/remark-callout.mjs"

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

export default defineConfig({
  site: siteUrl,
  output: "static",
  trailingSlash: "always",
  integrations: [
    react(),
    sitemap({
      // /tags/ 与 /categories/ 均为 noindex 筛选页，不进 sitemap
      filter: (page) =>
        !page.endsWith("/tags/") && !page.endsWith("/categories/"),
    }),
  ],
  markdown: {
    processor: unified({
      remarkPlugins: [remarkDirective, remarkCallout],
      rehypePlugins: [externalLinksTargetBlank, demoteMarkdownH1],
    }),
    shikiConfig: {
      theme: "github-dark",
    },
  },
  vite: {
    plugins: [tailwindcss()],
  },
})
