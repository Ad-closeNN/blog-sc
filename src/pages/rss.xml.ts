import type { APIRoute } from "astro"
import { getRssString } from "@astrojs/rss"

import { site } from "@/config"
import { sanitizeFeedHtml } from "@/lib/feed"
import { getPostCover, getPosts, postHref } from "@/lib/posts"

/**
 * RSS 全文订阅源端点，输出 /rss.xml。
 *
 * 构建时（SSG）与 dev（live SSR）都会执行。URL 路径保持稳定，
 * guid 逐条对齐，订阅者迁移后不会看到重复条目。
 *
 * 正文直接复用 post.rendered.html —— 内容层已跑完项目的完整 markdown 管线
 * （remarkCallout / rehypeRaw / 外链 _blank / h1 降级 / shiki），feed 正文
 * 与网页正文同源，不重新解析 markdown。净化与 URL 绝对化见 src/lib/feed.ts。
 */

/**
 * 条数上限。当前 17 篇全量输出（约 340 KB，gzip 后 50-70 KB），
 * 主流阅读器无压力。文章涨到 50 篇左右时再改成 20-30 并启用切片。
 */
const FEED_LIMIT = Infinity

/** Folo 订阅源认证：feedId 绑定 feed URL，/rss.xml 路径不变则认证延续。 */
const FOLO_FEED_ID = "250504037866558464"
const FOLO_USER_ID = "83370505718413312"

const FEED_PATH = "rss.xml"

/** 站内路径转绝对 URL；失败时原样返回，避免单条坏数据毁掉整个 feed。 */
function absolute(path: string, base: string) {
  try {
    return new URL(path, base).toString()
  } catch {
    return path
  }
}

export const GET: APIRoute = async (context) => {
  const siteUrl = context.site?.toString() ?? site.url
  const posts = (await getPosts()).slice(0, FEED_LIMIT)
  const feedUrl = absolute(FEED_PATH, siteUrl)

  const items = posts.map((post) => {
    const articleUrl = absolute(postHref(post.id), siteUrl)
    const cover = getPostCover(post)
    // 封面前置于正文：alt 留空，标题紧随其后，避免读屏重复念一遍标题。
    // 无封面的文章直接跳过，不兜底站点头像（那是社交分享用的，feed 里重复无意义）。
    const coverHtml = cover
      ? `<p><img src="${absolute(cover, siteUrl)}" alt="" /></p>`
      : ""
    const body = post.rendered?.html
      ? sanitizeFeedHtml(post.rendered.html, articleUrl)
      : ""

    return {
      title: post.data.title,
      link: postHref(post.id),
      description: post.data.description || post.data.title,
      pubDate: post.data.published,
      // 先 trim 再去重，避免「教程」与「教程 」被当成两个分类
      categories: [
        ...new Set(
          [...post.data.tags, post.data.category ?? ""]
            .map((name) => name.trim())
            .filter(Boolean)
        ),
      ],
      content: `${coverHtml}${body}`,
    }
  })

  // customData 里禁止出现 title / description / link —— @astrojs/rss 内部用
  // Object.assign 后写覆盖，会静默顶掉上面传的主参数。
  // follow_challenge 保持无命名空间前缀，Folo 服务端只识别这个形态。
  const customData = [
    `<language>${site.language}</language>`,
    `<lastBuildDate>${new Date().toUTCString()}</lastBuildDate>`,
    `<atom:link href="${feedUrl}" rel="self" type="application/rss+xml"/>`,
    "<follow_challenge>",
    `<feedId>${FOLO_FEED_ID}</feedId>`,
    `<userId>${FOLO_USER_ID}</userId>`,
    "</follow_challenge>",
  ].join("")

  const xml = await getRssString({
    title: site.name,
    description: site.description,
    site: siteUrl,
    trailingSlash: true,
    xmlns: { atom: "http://www.w3.org/2005/Atom" },
    customData,
    items,
  })

  // 在根元素后注入带 XHTML 命名空间的 script：浏览器直接打开 /rss.xml 时由它
  // 改写成可读页面（见 public/rss/render.js）。阅读器在服务端抓取、不执行脚本，
  // feed 语义不受影响。这替代了已废弃的 XSLT 方案（Chrome 158 起 Stable 关闭）。
  const rootTag = xml.match(/<rss\b[^>]*>/)?.[0]
  const injected = rootTag
    ? xml.replace(
        rootTag,
        `${rootTag}<script src="/rss/render.js" xmlns="http://www.w3.org/1999/xhtml"/>`
      )
    : xml

  // Content-Type 必须是 application/xml 或 text/xml：application/rss+xml 下
  // Blink 不执行文档内脚本，可读页面会失效。SSG 产物的实际 header 由静态托管
  // 按 .xml 扩展名决定，多数平台默认给 application/xml，符合要求。
  return new Response(injected, {
    headers: {
      "Content-Type": "application/xml; charset=utf-8",
    },
  })
}
