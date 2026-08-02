import { getCollection, type CollectionEntry } from "astro:content"

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
 * 构建当年（当年 1 月 1 日 UTC+8 起算）的发文活跃度热力图数据。
 * 每周以周日为第一天（GitHub 约定），列对齐。
 * 纯函数：不调用 getCollection，直接接收已取好的 posts，避免重复取数。
 */
export function buildHeatmap(posts: Post[]): HeatmapData {
  // 计算当前 UTC+8 时间与当年年份
  const now = new Date()
  const utc8Date = new Date(now.getTime() + 8 * 3600 * 1000)
  const currentYear = utc8Date.getUTCFullYear()

  // 聚合每日发文计数，key 为 YYYY-MM-DD
  const countByDate = new Map<string, number>()
  for (const post of posts) {
    const key = formatDate(post.data.published)
    countByDate.set(key, (countByDate.get(key) ?? 0) + 1)
  }

  // 起点 = 当年 1 月 1 日所在的周日
  const jan1 = new Date(Date.UTC(currentYear, 0, 1))
  const start = new Date(jan1)
  start.setUTCDate(jan1.getUTCDate() - jan1.getUTCDay())

  // 终点 = 当年 12 月 31 日所在的周六
  const dec31 = new Date(Date.UTC(currentYear, 11, 31))
  const end = new Date(dec31)
  end.setUTCDate(dec31.getUTCDate() + (6 - dec31.getUTCDay()))

  const totalDays =
    Math.round((end.getTime() - start.getTime()) / (24 * 3600 * 1000)) + 1
  const WEEKS = Math.ceil(totalDays / 7)

  // 按周×天构建网格：weeks[weekIndex][dayIndex]
  const weeks: HeatmapWeek[] = []
  for (let w = 0; w < WEEKS; w++) {
    const week: HeatmapCell[] = []
    for (let d = 0; d < 7; d++) {
      const cellDate = new Date(start)
      cellDate.setUTCDate(start.getUTCDate() + w * 7 + d)
      const year = cellDate.getUTCFullYear()
      const month = String(cellDate.getUTCMonth() + 1).padStart(2, "0")
      const day = String(cellDate.getUTCDate()).padStart(2, "0")
      const key = `${year}-${month}-${day}`
      const isCurrentYear = year === currentYear
      week.push({
        date: key,
        count: countByDate.get(key) ?? 0,
        isCurrentYear,
      })
    }
    weeks.push(week)
  }

  // 月份标签：周第一天属于当年的新月份时显示
  const monthLabels: ({ label: string } | null)[][] = Array.from(
    { length: 7 },
    () => Array.from({ length: WEEKS }, () => null)
  )
  let lastMonth = -1
  for (let w = 0; w < WEEKS; w++) {
    const cellDate = new Date(start)
    cellDate.setUTCDate(start.getUTCDate() + w * 7)
    let effectiveDate = cellDate
    if (cellDate.getUTCFullYear() < currentYear) {
      effectiveDate = new Date(Date.UTC(currentYear, 0, 1))
    }
    const month = effectiveDate.getUTCMonth()
    if (month !== lastMonth && effectiveDate.getUTCFullYear() === currentYear) {
      const label = `${month + 1}月`
      monthLabels[0][w] = { label }
      lastMonth = month
    }
  }

  let maxCount = 0
  let total = 0
  for (const week of weeks) {
    for (const cell of week) {
      // 仅统计当年的发文总数
      if (cell.isCurrentYear) {
        if (cell.count > maxCount) maxCount = cell.count
        total += cell.count
      }
    }
  }

  return { weeks, monthLabels, maxCount, total, year: currentYear }
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
