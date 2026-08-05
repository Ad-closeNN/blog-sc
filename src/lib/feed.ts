/**
 * feed.ts — RSS feed 内容净化工具
 *
 * 把 Astro 内容层渲染好的文章 HTML 净化成可安全放进
 * RSS <content:encoded> 的形态，并把站内相对 URL 绝对化。
 *
 * 输入是 post.rendered.html（已经过 remarkCallout / rehypeRaw /
 * 外链 _blank / h1 降级 / shiki 的结果），不需要也不应再解析 markdown。
 *
 * 注意：直接使用 rendered.html 绕过了 Astro renderEntry() 里的
 * updateImageReferencesInBody()。当前仓库所有文章图片均写成
 * /pic/xxx.png（public 绝对路径），imagePaths 全为空数组，安全。
 * 若日后改用相对路径图片（走 Astro 图片优化管线），rendered.html
 * 中会含 __ASTRO_IMAGE_="…" 占位符，导致 feed 图片损坏，
 * 届时需重新评估此处逻辑。
 */

import sanitizeHtml from "sanitize-html"
import type { IOptions } from "sanitize-html"
import { site } from "@/config"

/** 把相对/协议相对 URL 绝对化；解析失败时原样返回 */
function toAbsoluteUrl(u: string, base: string): string {
  try {
    return new URL(u, base).toString()
  } catch {
    return u
  }
}

/** 从 GitHub href 提取 owner/repo，用于仓库卡片降级展示 */
function extractOwnerRepo(href: string): string {
  return href.replace(/^https?:\/\/github\.com\//, "").replace(/\/$/, "")
}

/**
 * 把 `::github{repo=}` 渲染出的仓库卡片整块换成纯文字链。
 *
 * 卡片依赖前端 fetch GitHub API 填充内容，在阅读器里永远是空壳
 * （「加载中…」「--」占位符 + 十几个 gc-* 空 div）。
 *
 * 必须在 sanitize 之前整块替换：sanitize-html 的 Transformer.text 只改
 * 文本内容、**不删子元素**，且会在标签内每个文本位置各注入一次，
 * 结果是文字链和卡片残骸交替出现。
 */
function stripGithubCards(html: string): string {
  // 卡片外层是 <a class="card-github" href="https://github.com/owner/repo">…</a>，
  // 内部无嵌套 <a>，用非贪婪匹配到最近的 </a> 即可。
  return html.replace(
    /<a\b[^>]*class="[^"]*card-github[^"]*"[^>]*>[\s\S]*?<\/a>/g,
    (card) => {
      const href = /href="([^"]*)"/.exec(card)?.[1] ?? ""
      if (!href) return ""
      return `<p><a href="${href}">GitHub: ${extractOwnerRepo(href)}</a></p>`
    }
  )
}

/**
 * 构建 sanitize-html 配置。
 * 因 a 标签需以文章 URL 为 base 绝对化，每次调用单独构建。
 */
function buildOptions(articleUrl: string): IOptions {
  return {
    allowedTags: [
      ...sanitizeHtml.defaults.allowedTags,
      "img",
      "del",
      "details",
      "summary",
      "input",
    ],
    allowedAttributes: {
      // id 必须放行：116 个标题 id 被剥后，正文 #锚点 在阅读器里失效
      "*": ["class", "id"],
      a: ["href", "target", "rel"],
      img: ["src", "alt", "title", "width", "height", "loading"],
      // pre/code/span 的 style 必须放行：shiki 靠内联 style 着色
      pre: ["class", "style", "tabindex", "data-language"],
      code: ["class", "style"],
      span: ["class", "style"],
      // GFM 任务列表渲染为 <input type="checkbox" checked disabled>
      // 若不放行，任务列表会变成空白项
      input: ["type", "checked", "disabled"],
      ol: ["start"],
      td: ["colspan", "rowspan"],
      th: ["colspan", "rowspan", "scope"],
    },
    transformTags: {
      // href 以文章 URL 为 base 绝对化（含 # 锚点）。
      // GitHub 卡片已在 stripGithubCards() 里处理过，这里不必再管。
      a: (tagName, attribs) => ({
        tagName,
        attribs: {
          ...attribs,
          ...(attribs.href
            ? { href: toAbsoluteUrl(attribs.href, articleUrl) }
            : {}),
        },
      }),
      // 图片以站点根为 base 绝对化，/pic/xxx.png → 完整 HTTPS URL
      img: (tagName, attribs) => ({
        tagName,
        attribs: {
          ...attribs,
          ...(attribs.src ? { src: toAbsoluteUrl(attribs.src, site.url) } : {}),
        },
      }),
    },
    // 丢弃无文字内容且无媒体子节点的空 div，避免阅读器渲染冗余空节点
    exclusiveFilter: (frame) =>
      frame.tag === "div" &&
      frame.text.trim() === "" &&
      frame.mediaChildren.length === 0,
  }
}

/**
 * 净化渲染好的文章 HTML，使其可安全嵌入 RSS <content:encoded>。
 * 剔除 script/iframe 等危险标签，绝对化站内相对链接与图片路径。
 */
export function sanitizeFeedHtml(html: string, articleUrl: string): string {
  return sanitizeHtml(stripGithubCards(html), buildOptions(articleUrl))
}
