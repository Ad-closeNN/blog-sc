/**
 * 站内搜索客户端桥接层（FlexSearch + jieba 预分词索引）。
 *
 * - 索引由 src/pages/search-index.json.ts 在构建/dev 时生成：
 *   每篇正文经 jieba 分词拼成空格串，客户端只需按空格切 token。
 * - 客户端 fetch 索引后用 FlexSearch Document 现场建索引（17 篇 <50ms），
 *   模块级单例 + ready promise 缓存，桌面/移动 island 共用。
 * - excerpt 高亮自做：在分词后空格串里定位 query 词截窗 + <mark> 包裹。
 *
 * 仿 src/lib/theme.ts 的 useSyncExternalStore 单例模式。
 */

import { Document } from "flexsearch"

export type SearchDoc = {
  id: string
  url: string
  title: string
  description: string
  content: string
  text: string
}

export type SearchResult = {
  url: string
  title: string
  excerpt: string
}

export type SearchStatus = "loading" | "ready" | "error"

type SearchHit = { doc: SearchDoc }

let index: Document | null = null
let ready: Promise<Document> | null = null

const listeners = new Set<() => void>()
let status: SearchStatus = "loading"
let statusInited = false

function setStatus(next: SearchStatus) {
  if (status === next) return
  status = next
  listeners.forEach((l) => l())
}

/** 懒加载索引：fetch JSON → 现场建 FlexSearch Document */
function load(): Promise<Document> {
  if (ready) return ready
  ready = (async () => {
    try {
      const res = await fetch("/search-index.json")
      if (!res.ok) throw new Error(`search-index ${res.status}`)
      const docs: SearchDoc[] = await res.json()
      const idx = new Document({
        document: {
          id: "id",
          index: [
            { field: "title", tokenize: "forward" },
            {
              field: "content",
              tokenize: "forward",
              encode: (s: string) => String(s).split(/\s+/).filter(Boolean),
            },
          ],
          store: ["url", "title", "description", "content", "text"],
        },
      })
      for (const d of docs) idx.add(d)
      index = idx
      setStatus("ready")
      return idx
    } catch {
      setStatus("error")
      throw new Error("search index load failed")
    }
  })()
  return ready
}

function subscribe(onStoreChange: () => void) {
  listeners.add(onStoreChange)
  if (typeof window !== "undefined" && !statusInited) {
    statusInited = true
    load().catch(() => {})
  }
  return () => {
    listeners.delete(onStoreChange)
  }
}

function getSnapshot(): SearchStatus {
  return status
}

function getServerSnapshot(): SearchStatus {
  return "loading"
}

/**
 * 把查询字符串编码成 FlexSearch token。
 * 索引端做了 CJK 2-gram 合并（见 search-index.json.ts），
 * 对 2+ 字中文查询，额外把 query 自身作为一个整体 token 加入，
 * 保证「酷狗」能命中索引里的「酷狗」2-gram，而不只是按内部切词。
 */
/**
 * 从保留标点的纯文本里定位 query，截取可读片段并 <mark> 包裹命中词。
 * 支持多关键词（query 按空格拆开分别匹配）。按句子断点对齐，比按词截更自然。
 */
function makeExcerpt(text: string, query: string, radius = 60): string {
  const ql = query.toLowerCase().split(/\s+/).filter(Boolean)
  if (ql.length === 0) return ""

  const lower = text.toLowerCase()
  const idx = ql.findIndex((q) => lower.includes(q))
  if (idx < 0) return text.slice(0, 60) + "…"

  const q = ql[idx]
  const pos = lower.indexOf(q)
  // 以命中点为中心，前后各取 radius 字符，再往句子断点对齐
  const lo = Math.max(0, pos - radius)
  const hi = Math.min(text.length, pos + q.length + radius)
  // 向左找最近的句子断点
  const segStart = Math.max(
    lo,
    [..."。，！？；,.!?;\n"].reduce((acc, ch) => {
      const p = text.lastIndexOf(ch, pos - 1)
      return p > acc && p >= lo - 1 ? p + 1 : acc
    }, lo)
  )
  // 向右找最近的句子断点
  const segEnd = Math.min(
    hi,
    [..."。，！？；,.!?;\n"].reduce((acc, ch) => {
      const p = text.indexOf(ch, pos + q.length)
      return p < acc && p > 0 && p <= hi + 1 ? p : acc
    }, hi)
  )

  const raw = text.slice(segStart, segEnd)
  // 在片段里高亮所有命中词
  let out = escapeHtml(raw)
  for (const w of ql) {
    const re = new RegExp(`(${w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")})`, "gi")
    out = out.replace(re, "<mark>$1</mark>")
  }
  return (segStart > 0 ? "…" : "") + out + (segEnd < text.length ? "…" : "")
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
}

/** 执行搜索 */
async function search(term: string, limit = 10): Promise<SearchResult[]> {
  const q = term.trim()
  if (!q) return []
  if (!index) {
    try {
      await load()
    } catch {
      return []
    }
  }
  if (!index) return []

  try {
    const res = await index.search({
      query: q,
      limit,
      enrich: true,
      merge: true,
    })
    // 不同小版本返回结构差异：可能是数组套数组，flat 兜底
    const flat = (Array.isArray(res) ? res.flat() : []) as Array<{
      doc?: Record<string, unknown>
    }>
    const hits = flat.filter((h) => h && h.doc) as unknown as SearchHit[]

    return hits.map((h) => ({
      url: h.doc.url,
      title: h.doc.title,
      excerpt: makeExcerpt(h.doc.text, q),
    }))
  } catch {
    return []
  }
}

export const searchStore = {
  subscribe,
  getSnapshot,
  getServerSnapshot,
  search,
}
