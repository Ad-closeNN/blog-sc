/**
 * 热力图核心纯函数模块。
 *
 * 服务端（Astro frontmatter）与客户端（PostHeatmap bundled script）
 * 共用同一套「聚合 → 推演 → 序列化 → 反序列化 → 统计」逻辑，
 * 保证服务端默认渲染与客户端切换重建逐字节一致。
 *
 * 只依赖 Date / Intl / Map，无 Node / astro 依赖，可被客户端 bundle。
 */

const HOUR_MS = 3600 * 1000
const DAY_MS = 24 * 3600 * 1000

/** 网格内单个格子的完整推导结果 */
export type HeatmapCellDerived = {
  date: string // YYYY-MM-DD
  count: number
  level: number // 0..4（越界=0）
  isTargetYear: boolean // date 属于目标年份
  future: boolean // date > today
  outOfBounds: boolean // date < YYYY-01-01 || date > YYYY-12-31（跨年补齐格）
  today: boolean // date === today
  label: string // 完整 tooltip 文案
}

export type HeatmapStats = {
  activeDays: number
  total: number
  longestStreak: number
  busiestCount: number
}

/** 单个年份的紧凑序列化数据（注入页面供客户端重建） */
export type HeatmapYearData = {
  year: number
  weeks: number // 列数（--heatmap-columns）
  counts: number[] // 扁平数组，长度 = weeks*7，周主序（周日..周六）
  months: { col: number; label: string }[] // 1 基列号
  stats: HeatmapStats
}

export type HeatmapPayload = {
  today: string // YYYY-MM-DD，UTC+8，服务端算好冻结
  currentYear: number // UTC+8 当年
  years: HeatmapYearData[] // 降序，含当年（即使当年无文章）
}

/** 明细表按月汇总的一行 */
export type HeatmapMonthSummary = {
  key: string // YYYY-MM
  total: number // 当月发文总篇数
}

const weekdayFormatter = new Intl.DateTimeFormat("zh-CN", {
  weekday: "long",
  timeZone: "UTC",
})

/** 当前 UTC+8 年份 */
export function currentUtc8Year(): number {
  return new Date(Date.now() + 8 * HOUR_MS).getUTCFullYear()
}

/** 当前 UTC+8 当天，YYYY-MM-DD */
export function utc8Today(): string {
  return new Date(Date.now() + 8 * HOUR_MS).toISOString().slice(0, 10)
}

/**
 * 聚合每日计数，key 为 YYYY-MM-DD（UTC 日期串）。
 * 与 posts.ts 的 formatDate 语义一致，保证「某年序列化数据
 * 恰好覆盖归入该年的文章」，避免午夜附近跨年不一致。
 * 接收 Astro 内容集合条目结构 { data: { published: Date } }。
 */
export function aggregateCountByDate(
  items: { data: { published: Date } }[]
): Map<string, number> {
  const countByDate = new Map<string, number>()
  for (const item of items) {
    const key = item.data.published.toISOString().slice(0, 10)
    countByDate.set(key, (countByDate.get(key) ?? 0) + 1)
  }
  return countByDate
}

/** 目标年 1/1 所在的周日（网格起点，GitHub 约定周日起始） */
export function weekStartOfYear(year: number): Date {
  const jan1 = new Date(Date.UTC(year, 0, 1))
  const start = new Date(jan1)
  start.setUTCDate(jan1.getUTCDate() - jan1.getUTCDay())
  return start
}

/** 目标年 12/31 所在的周六（网格终点） */
export function weekEndOfYear(year: number): Date {
  const dec31 = new Date(Date.UTC(year, 11, 31))
  const end = new Date(dec31)
  end.setUTCDate(dec31.getUTCDate() + (6 - dec31.getUTCDay()))
  return end
}

/** 目标年的网格列数（53 或 52） */
export function weekCountForYear(year: number): number {
  const start = weekStartOfYear(year)
  const end = weekEndOfYear(year)
  const totalDays = Math.round((end.getTime() - start.getTime()) / DAY_MS) + 1
  return Math.ceil(totalDays / 7)
}

/** 单格 tooltip / aria 文案：`2026年8月6日 星期四，3 篇文章` */
export function formatCellLabel(date: string, count: number): string {
  const [y, month, day] = date.split("-").map(Number)
  const weekday = weekdayFormatter.format(new Date(Date.UTC(y, month - 1, day)))
  return `${y}年${month}月${day}日 ${weekday}，${count} 篇文章`
}

/**
 * 核心推导函数：由扁平 counts（周主序、日次 0..6）推演整年格子。
 * 客户端重建与服务端默认渲染都走这里，保证一致。
 */
export function deriveCells(
  year: number,
  counts: number[],
  today: string
): HeatmapCellDerived[] {
  const start = weekStartOfYear(year)
  const yearStart = `${year}-01-01`
  const yearEnd = `${year}-12-31`

  const cells: HeatmapCellDerived[] = []
  for (let i = 0; i < counts.length; i++) {
    const d = new Date(start)
    d.setUTCDate(start.getUTCDate() + i)
    const date = d.toISOString().slice(0, 10)
    const count = counts[i] ?? 0
    const outOfBounds = date < yearStart || date > yearEnd
    cells.push({
      date,
      count,
      level: outOfBounds ? 0 : Math.min(4, count),
      isTargetYear: date.startsWith(`${year}-`),
      future: date > today,
      outOfBounds,
      today: date === today,
      label: formatCellLabel(date, count),
    })
  }
  return cells
}

/** 服务端：由 countByDate 构建整年格子（拼扁平 counts 后委托 deriveCells） */
export function buildYearCells(
  year: number,
  countByDate: Map<string, number>,
  today: string
): HeatmapCellDerived[] {
  const start = weekStartOfYear(year)
  const weeks = weekCountForYear(year)
  const counts: number[] = []
  for (let i = 0; i < weeks * 7; i++) {
    const d = new Date(start)
    d.setUTCDate(start.getUTCDate() + i)
    counts.push(countByDate.get(d.toISOString().slice(0, 10)) ?? 0)
  }
  return deriveCells(year, counts, today)
}

/** 月份列标：每周第一天跨入新月份时标记该列（与现状 monthLabels[0] 逐行一致） */
export function monthColumnsForYear(
  year: number
): { col: number; label: string }[] {
  const start = weekStartOfYear(year)
  const weeks = weekCountForYear(year)
  const columns: { col: number; label: string }[] = []
  let lastMonth = -1
  for (let w = 0; w < weeks; w++) {
    const cellDate = new Date(start)
    cellDate.setUTCDate(start.getUTCDate() + w * 7)
    let effectiveDate = cellDate
    if (cellDate.getUTCFullYear() < year) {
      effectiveDate = new Date(Date.UTC(year, 0, 1))
    }
    const month = effectiveDate.getUTCMonth()
    if (month !== lastMonth && effectiveDate.getUTCFullYear() === year) {
      columns.push({ col: w + 1, label: `${month + 1}月` })
      lastMonth = month
    }
  }
  return columns
}

/** UI 统计：排除越界与未来格子 */
export function statsOfCells(cells: HeatmapCellDerived[]): HeatmapStats {
  const current = cells.filter((c) => !c.outOfBounds && !c.future)
  const active = current.filter((c) => c.count > 0)
  const total = active.reduce((sum, c) => sum + c.count, 0)
  const busiestCount = active.reduce(
    (highest, c) => Math.max(highest, c.count),
    0
  )

  let longestStreak = 0
  let runningStreak = 0
  for (const c of current) {
    runningStreak = c.count > 0 ? runningStreak + 1 : 0
    longestStreak = Math.max(longestStreak, runningStreak)
  }

  return { activeDays: active.length, total, longestStreak, busiestCount }
}

/** 序列化单个年份为紧凑 payload */
export function serializeYear(
  year: number,
  countByDate: Map<string, number>,
  today: string
): HeatmapYearData {
  const cells = buildYearCells(year, countByDate, today)
  return {
    year,
    weeks: cells.length / 7,
    counts: cells.map((c) => c.count),
    months: monthColumnsForYear(year),
    stats: statsOfCells(cells),
  }
}

/** 明细表按月汇总：过滤越界/未来/无发文，月份倒序 */
export function summarizeByMonth(
  cells: HeatmapCellDerived[]
): HeatmapMonthSummary[] {
  const map = new Map<string, number>()
  for (const cell of cells) {
    if (cell.outOfBounds || cell.future || cell.count <= 0) continue
    const key = cell.date.slice(0, 7)
    map.set(key, (map.get(key) ?? 0) + cell.count)
  }
  return [...map.entries()]
    .map(([key, total]) => ({ key, total }))
    .sort((a, b) => (a.key < b.key ? 1 : -1))
}
