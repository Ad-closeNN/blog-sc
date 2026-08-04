import type { APIRoute } from "astro"
import { Jieba } from "@node-rs/jieba"
import { dict } from "@node-rs/jieba/dict"

import { getPosts } from "@/lib/posts"

/**
 * 搜索索引 JSON 端点。
 *
 * 构建时（SSG）与 dev（live SSR）都会执行：遍历全部文章，
 * 用 jieba 对正文分词后拼成空格串，输出供客户端 FlexSearch 现场建索引。
 *
 * 复用 src/lib/posts.ts 的 getPosts()（已含 prod draft 过滤）。
 * post.body 是 glob loader 给的原始 markdown 字符串，直接喂分词器；
 * markdown 语法符号是非 CJK，会被标点过滤正则滤掉。
 *
 * jieba 需先 loadDict 加载默认词典，否则 cut 退化为按字切（无词表）。
 */

// 单例：复用 jieba 实例避免每篇都重新加载词典
const jieba = new Jieba()
jieba.loadDict(dict)

/** 仅保留有意义 token：过滤纯标点 / 空白 / markdown 语法符号 */
const NOISE_RE = /^[\s#$>*_`~[\]()!|"'.,;:?=+-]+$/

/** 单个 CJK 字（用于识别被 jieba 拆开的专有名词，如「酷狗」→「酷」「狗」） */
const CJK_CHAR_RE = /^[一-鿿]$/

/**
 * 分词 + 2-gram 合并：
 * jieba 不认得的专有名词（酷狗、Giscus 等不在词典的中文词）会被切成单字，
 * 额外把相邻 CJK 单字两两合并成 2-gram 加入索引，
 * 这样搜「酷狗」能命中「酷狗」（同时保留单字「酷」「狗」供单字搜索）。
 * 返回分词后空格串，供 FlexSearch 索引。
 */
function tokenize(text: string): string {
  const words = jieba
    .cut(text)
    .map((w) => w.trim())
    .filter((w) => w && !NOISE_RE.test(w))

  const out = [...words]
  for (let i = 0; i < words.length - 1; i++) {
    if (CJK_CHAR_RE.test(words[i]) && CJK_CHAR_RE.test(words[i + 1])) {
      out.push(words[i] + words[i + 1])
    }
  }
  return out.join(" ")
}

/**
 * 把 markdown 正文转成保留标点的纯文本，作为摘要源。
 * 去掉代码块/语法符号/图片/链接 URL，保留中文标点与自然断句，
 * 使 makeExcerpt 能截出可读的句子（而非分词后丢标点的空格串）。
 */
function toPlainText(md: string): string {
  return md
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/`[^`]*`/g, " ")
    .replace(/^#{1,6}\s+/gm, "")
    .replace(/^>\s+/gm, "")
    .replace(/[*_~]+/g, "")
    .replace(/!\[[^\]]*\]\([^)]*\)/g, " ")
    .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/https?:\/\/\S+/g, " ")
    .replace(/:::[^\n]*/g, " ")
    .replace(/\n+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
}

export const GET: APIRoute = async () => {
  const posts = await getPosts()

  const docs = posts.map((p) => {
    const body = p.body ?? ""
    return {
      id: p.id,
      url: `/posts/${p.id}/`,
      title: p.data.title,
      description: p.data.description ?? "",
      // content: 分词后空格串，供 FlexSearch 索引
      content: tokenize(body),
      // text: 保留标点的纯文本，供摘要截取可读句子
      text: toPlainText(body),
    }
  })

  return new Response(JSON.stringify(docs), {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-cache",
    },
  })
}
