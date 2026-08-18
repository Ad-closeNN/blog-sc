/**
 * 同页原地筛选共享逻辑：
 * - 点击筛选按钮 → 标记不匹配文章、隐藏空月份组、高亮匹配 Tag
 * - 筛选状态写入 URL（?tag= / ?cat=），刷新/分享可恢复
 * - 支持 tag 与分类「同时选中」做 AND 交集：每类参数各自独立一值，
 *   选出同时满足所有已选维度的文章；再次点击某维度已选项 → 仅取消该维度
 *
 * 供 TimelineFilter.astro（/tags/ /categories/ 页）与 TaxonomyPanel（首页）复用。
 * 首页存在 HomePagination 时，筛选器只写 data-filter-hidden，分页器监听事件后
 * 从第 1 页按筛选结果重新切片；其它页面仍由本模块直接控制 item.hidden。
 */

import { prefersReducedMotion } from "@/lib/scroll-to-heading"

/** navbar 高度 + 呼吸间距，与 global.css 的 scroll-margin-top: calc(48px + 0.75rem) 对齐 */
const NAVBAR_OFFSET = 48 + 12

/**
 * 筛选后把结果列表顶部滚进视口。
 *
 * 筛选会让列表变短：若用户此前滚在中下部，筛完当前视口可能已越过全部结果，
 * 看起来「没有跳到第一个 / 没划到顶」。仅在列表顶部已滚出视口上方时才回滚，
 * 已经能看到列表头部时保持不动，避免每次点筛选都无谓跳动。
 */
function scrollTimelineIntoView() {
  const list =
    document.querySelector<HTMLElement>(".post-timeline") ??
    document.querySelector<HTMLElement>(".posts-layout-main")
  if (!list) return

  const top = list.getBoundingClientRect().top
  if (top >= NAVBAR_OFFSET) return

  window.scrollTo({
    top: window.scrollY + top - NAVBAR_OFFSET,
    behavior: prefersReducedMotion() ? "auto" : "smooth",
  })
}

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
  const homePagination = document.querySelector<HTMLElement>(
    "[data-home-pagination]"
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

  function updateGroups() {
    groups.forEach((group) => {
      // 只看筛选状态，不把首页分页暂时隐藏的文章误算为筛选结果不存在。
      const visibleCount = group.querySelectorAll(
        ".post-timeline-item:not([data-filter-hidden])"
      ).length
      group.hidden = visibleCount === 0
      const countEl = group.querySelector(
        ".post-timeline-month-title span.opacity-60"
      )
      if (countEl) countEl.textContent = `(${visibleCount})`
    })
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
    // 保留 history.state（Astro View Transitions 存导航恢复信息于此）。
    // 若传 null：在文章页加载窗口内点筛选会把该记录的 state 破坏为 null，
    // 返回时 Astro 无法恢复过渡状态 → URL 是列表页但渲染的是文章页内容。
    history.replaceState(history.state, "", url)

    items.forEach((item) => {
      const hidden = !matches(item)
      item.toggleAttribute("data-filter-hidden", hidden)
      // 非首页分页页没有分页控制器，直接更新原有 hidden 状态。
      if (!homePagination) item.hidden = hidden
    })

    // 高亮文章卡片里与当前筛选 Tag 对应的标签。
    // 仅标签筛选维度生效时高亮匹配项；否则清空。
    const activeTag = activeFilters.get("tag")
    document
      .querySelectorAll<HTMLElement>("[data-filter-tag]")
      .forEach((tag) => {
        const on =
          activeTag != null &&
          tag.getAttribute("data-filter-tag") === activeTag
        tag.classList.toggle("is-filter-active", on)
      })

    updateGroups()

    // 首页分页器接手 item.hidden：收到事件后从第 1 页按结果集重新分页。
    if (homePagination) {
      document.dispatchEvent(
        new CustomEvent("timeline-filter:changed", {
          detail: { isAll: activeFilters.size === 0 },
        })
      )
    }
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
      // 首页分页器会平滑回到页面顶部；其它页面保留原先的列表定位行为。
      if (!homePagination) scrollTimelineIntoView()
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
