/**
 * 同页原地筛选共享逻辑：
 * - 点击筛选按钮 → 过滤 .post-timeline-item、隐藏空月份组、合并同月折叠组、高亮匹配 Tag Badge
 * - 筛选状态写入 URL（?tag= / ?cat=），刷新/分享可恢复
 * - 支持 tag 与分类「同时选中」做 AND 交集：每类参数各自独立一值，
 *   选出同时满足所有已选维度的文章；再次点击某维度已选项 → 仅取消该维度
 *
 * 供 TimelineFilter.astro（/tags/ /categories/ 页）与 TaxonomyPanel（/posts/ 页）复用。
 * 仅在浏览器端执行（由 Astro <script> 打包），SSR 不运行。
 */

// paramKey → 文章 data 属性（模块级注册表：跨组件共享，供 AND 交集读取各维度）
const paramToAttr = new Map<string, string>()
// 已注册的筛选参数集合（tag / cat），用于跨区块联动更新选中态
const knownParams = new Set<string>()
// 当前生效的筛选：paramKey → value（每类参数唯一，维度间不互斥）
const activeFilters = new Map<string, string>()

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
  paramToAttr.set(paramKey, dataAttr)
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

  /** 单维度匹配：value 为 "*"（未选）时视为通过 */
  function matchesDimension(item: HTMLElement, attr: string, value: string) {
    if (value === "*") return true
    const values = (item.getAttribute(attr) ?? "").split(" ")
    return values.includes(value)
  }

  /** AND 交集：item 需同时满足所有已选维度 */
  function matches(item: HTMLElement) {
    for (const [param, value] of activeFilters) {
      const attr = paramToAttr.get(param)
      if (attr && !matchesDimension(item, attr, value)) return false
    }
    return true
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
    // 写入/移除当前维度，其余维度保持不变（组合筛选）
    if (value === "*") activeFilters.delete(paramKey)
    else activeFilters.set(paramKey, value)

    // 联动更新所有按钮选中态：每维度独立
    document
      .querySelectorAll<HTMLButtonElement>("[data-filter][data-param]")
      .forEach((btn) => {
        const pk = btn.getAttribute("data-param") ?? ""
        btn.setAttribute(
          "aria-pressed",
          String(activeFilters.get(pk) === btn.getAttribute("data-filter"))
        )
      })

    // URL：只写/删当前维度参数，其余维度参数保留（tag/cat 并存）
    const url = new URL(location.href)
    const current = activeFilters.get(paramKey)
    if (current) url.searchParams.set(paramKey, current)
    else url.searchParams.delete(paramKey)
    history.replaceState(null, "", url)

    const isAll = activeFilters.size === 0
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
      item.hidden = !matches(item)
    })

    // 高亮文章卡片里与当前筛选 Tag 对应的 Badge 边框
    // 仅标签筛选维度生效时高亮匹配项；否则清空
    const activeTag = activeFilters.get("tag")
    document
      .querySelectorAll<HTMLElement>("[data-filter-tag]")
      .forEach((badge) => {
        const on =
          activeTag != null &&
          badge.getAttribute("data-filter-tag") === activeTag
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
      // 再次点击当前维度已选项 → 取消该维度（其它维度保持）
      if (activeFilters.get(paramKey) === value) {
        apply("*")
      } else {
        apply(value)
      }
    })
  })

  // 首次加载 / 客户端导航后，从 URL 恢复所有维度的筛选状态
  const initial = new URL(location.href).searchParams.get(paramKey)
  if (
    initial &&
    buttons.some((b) => b.getAttribute("data-filter") === initial)
  ) {
    apply(initial)
  }
}
