/**
 * 同页原地筛选共享逻辑：
 * - 点击筛选按钮 → 过滤 .post-timeline-item、隐藏空月份组、合并同月折叠组、高亮匹配 Tag Badge
 * - 筛选状态写入 URL（?tag= / ?cat=），刷新/分享可恢复
 * - 再次点击当前选中项 → 取消筛选；多个筛选区块（tag / category）互斥联动
 *
 * 供 TimelineFilter.astro（/tags/ /categories/ 页）与 TaxonomyPanel（/posts/ 页）复用。
 * 仅在浏览器端执行（由 Astro <script> 打包），SSR 不运行。
 */

type FilterState = { paramKey: string; value: string } | null

// 已注册的筛选参数集合（tag / cat），用于跨区块互斥清 URL
const knownParams = new Set<string>()
// 当前生效的筛选（跨组件共享单例，保证 tag 与 category 互斥）
let activeFilter: FilterState = null

export type TimelineFilterOptions = {
  /** 包含 [data-filter] 按钮的容器（chips 行或面板区块） */
  filterEl: HTMLElement
  /** URL 查询参数名：tag 或 cat */
  paramKey: string
  /** 文章项匹配用的 data 属性：data-tags 或 data-category */
  dataAttr: string
}

export function initTimelineFilter({
  filterEl,
  paramKey,
  dataAttr,
}: TimelineFilterOptions) {
  knownParams.add(paramKey)
  const buttons = [
    ...filterEl.querySelectorAll<HTMLButtonElement>("[data-filter]"),
  ]

  // 给按钮打上所属参数，便于跨区块联动更新选中态
  buttons.forEach((btn) => btn.setAttribute("data-param", paramKey))

  const items = [
    ...document.querySelectorAll<HTMLElement>(".post-timeline-item"),
  ]
  const groups = [
    ...document.querySelectorAll<HTMLElement>(".post-timeline-month"),
  ]
  const expandBtn = document.querySelector<HTMLElement>("[data-timeline-expand]")
  const remaining = document.querySelector<HTMLElement>(
    "[data-timeline-remaining]"
  )

  function matches(item: HTMLElement, value: string) {
    if (value === "*") return true
    const values = (item.getAttribute(dataAttr) ?? "").split(" ")
    return values.includes(value)
  }

  function mergeDuplicateMonths() {
    const months = new Map<string, HTMLElement>()
    for (const group of groups) {
      if (group.hidden) continue
      const title = group.querySelector(".post-timeline-month-title")
      // 只取月份名 span，避免把计数 span 混进 key
      const monthName = title?.firstElementChild?.textContent?.trim() ?? ""
      const existing = months.get(monthName)
      if (existing && existing !== group) {
        // 把后一个组的可见 items 移到前一个组，再隐藏后组
        group
          .querySelectorAll(".post-timeline-item:not([hidden])")
          .forEach((item) => {
            existing.querySelector(".post-timeline-list")?.appendChild(item)
          })
        // 重算合并后组的计数
        const count = existing.querySelectorAll(
          ".post-timeline-item:not([hidden])"
        ).length
        const countEl = existing.querySelector(
          ".post-timeline-month-title span.opacity-60"
        )
        if (countEl) countEl.textContent = `(${count})`
        group.hidden = true
      } else {
        months.set(monthName, group)
      }
    }
  }

  function apply(value: string) {
    activeFilter = value === "*" ? null : { paramKey, value }

    // 跨区块联动：更新所有已注册筛选按钮的选中态（tag 与 category 互斥）
    document
      .querySelectorAll<HTMLButtonElement>("[data-filter][data-param]")
      .forEach((btn) => {
        btn.setAttribute(
          "aria-pressed",
          String(
            activeFilter !== null &&
              btn.getAttribute("data-param") === paramKey &&
              btn.getAttribute("data-filter") === value
          )
        )
      })

    // URL：清除全部筛选参数后写入当前（保证互斥、URL 干净）
    const url = new URL(location.href)
    knownParams.forEach((p) => url.searchParams.delete(p))
    if (value !== "*") url.searchParams.set(paramKey, value)
    history.replaceState(null, "", url)

    const isAll = value === "*"
    // 筛选时展开折叠区，让全部文章可被过滤
    if (!isAll && remaining) {
      remaining.hidden = false
      if (expandBtn) expandBtn.hidden = true
    }
    if (isAll && remaining) {
      remaining.hidden = true
      if (expandBtn) expandBtn.hidden = false
      expandBtn?.setAttribute("aria-expanded", "false")
    }

    items.forEach((item) => {
      item.hidden = !matches(item, value)
    })

    // 高亮文章卡片里与当前筛选 Tag 对应的 Badge 边框
    // 仅标签筛选时高亮匹配项；其他任何情况（分类筛选/全部）都清空高亮
    const isTagFilter = paramKey === "tag" && !isAll
    document
      .querySelectorAll<HTMLElement>("[data-filter-tag]")
      .forEach((badge) => {
        const on =
          isTagFilter && badge.getAttribute("data-filter-tag") === value
        badge.classList.toggle("is-filter-active", on)
      })

    // 隐藏空月份组，更新组计数
    groups.forEach((group) => {
      const visibleCount = group.querySelectorAll(
        ".post-timeline-item:not([hidden])"
      ).length
      group.hidden = visibleCount === 0
      const countEl = group.querySelector(
        ".post-timeline-month-title span.opacity-60"
      )
      if (countEl) countEl.textContent = `(${visibleCount})`
    })

    // 折叠区与首屏同月会相邻成两组：筛选时合并同名月份组
    if (!isAll) mergeDuplicateMonths()
  }

  buttons.forEach((btn) => {
    btn.addEventListener("click", () => {
      const value = btn.getAttribute("data-filter") ?? "*"
      // 再次点击当前选中项 → 取消筛选（回到全部）
      if (
        value !== "*" &&
        activeFilter &&
        activeFilter.paramKey === paramKey &&
        activeFilter.value === value
      ) {
        apply("*")
      } else {
        apply(value)
      }
    })
  })

  // 首次加载 / 客户端导航后，从 URL 恢复筛选状态
  const initial = new URL(location.href).searchParams.get(paramKey)
  if (
    initial &&
    buttons.some((b) => b.getAttribute("data-filter") === initial)
  ) {
    apply(initial)
  }
}
