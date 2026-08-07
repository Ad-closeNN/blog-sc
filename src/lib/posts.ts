import { getCollection, type CollectionEntry } from "astro:content"

import {
  aggregateCountByDate,
  buildYearCells,
  currentUtc8Year,
  monthColumnsForYear,
  serializeYear,
  utc8Today,
  type HeatmapPayload,
} from "@/lib/heatmap-core"

export type Post = CollectionEntry<"posts">

export function publicPath(src?: string | null) {
  if (!src) return ""
  return src.startsWith("/public/") ? src.slice("/public".length) : src
}

export async function getPosts() {
  const posts = await getCollection("posts", ({ data }) =>
    import.meta.env.PROD ? data.draft !== true : true
  )

  return posts.sort(
    (a, b) => b.data.published.getTime() - a.data.published.getTime()
  )
}

export function withNeighbors(posts: Post[]) {
  return posts.map((post, index) => ({
    post,
    prev: posts[index + 1] ?? null,
    next: posts[index - 1] ?? null,
  }))
}

export function formatDate(date: Date) {
  return date.toISOString().slice(0, 10)
}

export function formatShortDate(date: Date) {
  const m = String(date.getMonth() + 1).padStart(2, "0")
  const d = String(date.getDate()).padStart(2, "0")
  return `${m}-${d}`
}

export function getPostCover(post: Post) {
  const src =
    post.data.customcover ||
    (post.data.showcover !== false ? post.data.image : "")
  return publicPath(src)
}

export function formatMonthLabel(date: Date) {
  return `${date.getFullYear()}年${date.getMonth() + 1}月`
}

export function monthKey(date: Date) {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, "0")
  return `${y}-${m}`
}

export function groupPostsByMonth(posts: Post[]) {
  const map = new Map<string, { key: string; label: string; posts: Post[] }>()

  for (const post of posts) {
    const key = monthKey(post.data.published)
    const group = map.get(key)
    if (group) {
      group.posts.push(post)
    } else {
      map.set(key, {
        key,
        label: formatMonthLabel(post.data.published),
        posts: [post],
      })
    }
  }

  return [...map.values()]
}

export function postHref(id: string) {
  return `/posts/${id}/`
}

export type HeatmapCell = {
  date: string
  count: number
  isCurrentYear: boolean
}

export type HeatmapWeek = HeatmapCell[]

export type HeatmapData = {
  weeks: HeatmapWeek[]
  monthLabels: ({ label: string } | null)[][]
  maxCount: number
  total: number
  year: number
}

/**
 * 构建某年（默认当年，UTC+8 起算）的发文活跃度热力图数据。
 * 每周以周日为第一天（GitHub 约定），列对齐。
 * 纯函数：不调用 getCollection，直接接收已取好的 posts，避免重复取数。
 * 委托 heatmap-core 统一推导，保证与客户端切换重建逐字节一致。
 */
export function buildHeatmap(posts: Post[], year?: number): HeatmapData {
  const targetYear = year ?? currentUtc8Year()
  const countByDate = aggregateCountByDate(posts)
  const today = utc8Today()
  const cells = buildYearCells(targetYear, countByDate, today)

  // 按周×天拆回二维：weeks[weekIndex][dayIndex]
  const weeks: HeatmapWeek[] = []
  for (let i = 0; i < cells.length; i += 7) {
    weeks.push(
      cells.slice(i, i + 7).map((c) => ({
        date: c.date,
        count: c.count,
        isCurrentYear: c.isTargetYear,
      }))
    )
  }

  // 月份标签（第 0 行），其余行保持 null 兼容原结构
  const monthLabels: ({ label: string } | null)[][] = [
    Array.from({ length: weeks.length }, () => null),
  ]
  for (const m of monthColumnsForYear(targetYear)) {
    monthLabels[0][m.col - 1] = { label: m.label }
  }

  let maxCount = 0
  let total = 0
  for (const cell of cells) {
    // 仅统计目标年份的发文总数（含未来，不含越界），保持原语义
    if (cell.isTargetYear) {
      if (cell.count > maxCount) maxCount = cell.count
      total += cell.count
    }
  }

  return { weeks, monthLabels, maxCount, total, year: targetYear }
}

/** 所有有文章的年份，降序 */
export function availableYears(posts: Post[]): number[] {
  const set = new Set<number>()
  for (const post of posts) {
    set.add(Number(formatDate(post.data.published).slice(0, 4)))
  }
  return [...set].sort((a, b) => b - a)
}

/** 构建热力图切换用的完整 payload：当年 + 所有有文章的年份，降序 */
export function buildHeatmapPayload(posts: Post[]): HeatmapPayload {
  const currentYear = currentUtc8Year()
  const today = utc8Today()
  const countByDate = aggregateCountByDate(posts)

  const years = [currentYear, ...availableYears(posts)]
    .filter((y, i, arr) => arr.indexOf(y) === i)
    .sort((a, b) => b - a)

  return {
    today,
    currentYear,
    years: years.map((y) => serializeYear(y, countByDate, today)),
  }
}

export type Taxonomy = {
  name: string
  slug: string
  count: number
}

/**
 * 将 tag / category 名称转成 URL slug：
 * - 统一小写
 * - 空格 / 下划线 → 连字符
 * - 保留中英文与数字，其余字符去除
 * - 合并连续连字符、去掉首尾连字符
 * 例：`Claude Code` → `claude-code`、`CF Workers` → `cf-workers`、`教程` → `教程`、`GFM` → `gfm`
 */
export function taxonomySlug(name: string) {
  return name
    .trim()
    .toLowerCase()
    .replace(/[\s_]+/g, "-")
    .replace(/[^\p{L}\p{N}-]/gu, "")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "")
}

/** 聚合全部 tag 与 category，统计各篇数并按「篇数降序、名称升序」排序 */
export function getTaxonomies(posts: Post[]) {
  const tagMap = new Map<string, number>()
  const categoryMap = new Map<string, number>()

  for (const post of posts) {
    for (const tag of post.data.tags) {
      tagMap.set(tag, (tagMap.get(tag) ?? 0) + 1)
    }
    const category = post.data.category
    if (category) {
      categoryMap.set(category, (categoryMap.get(category) ?? 0) + 1)
    }
  }

  const toList = (map: Map<string, number>): Taxonomy[] =>
    [...map.entries()]
      .map(([name, count]) => ({ name, slug: taxonomySlug(name), count }))
      .sort(
        (a, b) => b.count - a.count || a.name.localeCompare(b.name, "zh-CN")
      )

  return { tags: toList(tagMap), categories: toList(categoryMap) }
}

/**
 * 全站字数统计。
 * 从 post.body（glob loader 提供的原始 markdown 源）计数，CJK 逐字 + 拉丁逐词。
 * blog-sc 无 remark 字数插件（fuwari 的 remarkPluginFrontmatter.words 不可用），
 * 故从 markdown 源剥离语法后直接数。
 */
export function countWordsInMarkdown(md: string): number {
  const text = md
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/`[^`]*`/g, " ")
    .replace(/^#{1,6}\s.*$/gm, " ")
    .replace(/^>\s.*$/gm, " ")
    .replace(/[*_~]+/g, "")
    .replace(/!\[[^\]]*\]\([^)]*\)/g, " ")
    .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/https?:\/\/\S+/g, " ")
    .replace(/:::\w*\s*$/gm, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim()

  const cjk = (text.match(/[㐀-鿿]/g) ?? []).length
  const latin = (text.match(/[A-Za-z0-9]+(?:['’-][A-Za-z0-9]+)*/g) ?? []).length
  return cjk + latin
}

let totalWordsCache: number | undefined

export async function getTotalWords(): Promise<number> {
  if (totalWordsCache !== undefined) return totalWordsCache
  const posts = await getPosts()
  totalWordsCache = posts.reduce(
    (sum, p) => sum + countWordsInMarkdown(p.body ?? ""),
    0
  )
  return totalWordsCache
}
