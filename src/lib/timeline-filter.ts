/**
 * 同页原地筛选共享逻辑（纯 tag 单维）：
 * - 点击筛选按钮 → 标记不匹配文章、隐藏空月份组、高亮匹配 Tag
 * - 筛选状态写入 URL（?tag=），刷新/分享可恢复
 *
 * 供首页 TaxonomyPanel 的标签面板使用。
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

// 当前生效的筛选（tag slug；null 表示未选）
let activeTag: string | null = null

export type FilterOptions = {
  /** 包含 [data-filter] 按钮的容器（首页标签面板） */
  filterEl: HTMLElement
}

export function initTimelineFilter({ filterEl }: FilterOptions) {
  const buttons = [...filterEl.querySelectorAll<HTMLButtonElement>("[data-filter]")]

  const items = [
    ...document.querySelectorAll<HTMLElement>(".post-timeline-item"),
  ]
  const groups = [
    ...document.querySelectorAll<HTMLElement>(".post-timeline-month"),
  ]
  const homePagination = document.querySelector<HTMLElement>(
    "[data-home-pagination]"
  )

  function matches(item: HTMLElement) {
    if (!activeTag) return true
    return (item.getAttribute("data-tags") ?? "").split(" ").includes(activeTag)
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
    // "*" 表示「全部」：清空筛选
    activeTag = value === "*" ? null : value

    // 联动更新筛选按钮选中态（未筛选时由 «全部» 按钮高亮）
    const current = activeTag ?? "*"
    document
      .querySelectorAll<HTMLButtonElement>("[data-filter]")
      .forEach((btn) => {
        btn.setAttribute(
          "aria-pressed",
          String(current === btn.getAttribute("data-filter"))
        )
      })

    // URL：写入/删除 tag 参数
    const url = new URL(location.href)
    if (activeTag) url.searchParams.set("tag", activeTag)
    else url.searchParams.delete("tag")
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
    document
      .querySelectorAll<HTMLElement>("[data-filter-tag]")
      .forEach((tag) => {
        tag.classList.toggle(
          "is-filter-active",
          activeTag != null &&
            tag.getAttribute("data-filter-tag") === activeTag
        )
      })

    updateGroups()

    // 首页分页器接手 item.hidden：收到事件后从第 1 页按结果集重新分页。
    if (homePagination) {
      document.dispatchEvent(
        new CustomEvent("timeline-filter:changed", {
          detail: { isAll: activeTag == null },
        })
      )
    }
  }

  buttons.forEach((btn) => {
    btn.addEventListener("click", () => {
      const value = btn.getAttribute("data-filter") ?? "*"
      // 再次点击已选项 → 取消筛选
      if (activeTag === value) {
        apply("*")
      } else {
        apply(value)
      }
      // 首页分页器会平滑回到页面顶部；其它页面保留原先的列表定位行为。
      if (!homePagination) scrollTimelineIntoView()
    })
  })

  // 首次加载 / 客户端导航后，从 URL 恢复筛选状态
  const initial = new URL(location.href).searchParams.get("tag")
  if (initial && buttons.some((b) => b.getAttribute("data-filter") === initial)) {
    apply(initial)
  }
}
