/** Sheet 关闭过渡时长，与 sheet.tsx 的 duration-200 对齐 */
export const SHEET_CLOSE_MS = 200

/** 平滑滚动大致时长，用于 scrollSpy 锁定 */
export const SMOOTH_SCROLL_MS = 700

export function prefersReducedMotion(): boolean {
  if (typeof window === "undefined") return false
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches
}

/**
 * 滚到指定 heading。依赖 global.css 中
 * `.prose h*, .prose [id] { scroll-margin-top: calc(48px + 0.75rem) }`。
 */
export function scrollToHeading(
  slug: string,
  options?: { updateHash?: boolean },
): boolean {
  const target = document.getElementById(slug)
  if (!target) return false

  const reduceMotion = prefersReducedMotion()
  target.scrollIntoView({
    behavior: reduceMotion ? "auto" : "smooth",
    block: "start",
  })

  if (options?.updateHash !== false) {
    history.pushState(null, "", `#${slug}`)
  }

  return true
}

/** 点击跳转期间锁定 scrollSpy 的建议时长（含可选 Sheet 关闭等待） */
export function clickScrollLockMs(options?: { afterSheetClose?: boolean }): number {
  const reduceMotion = prefersReducedMotion()
  const closeMs = options?.afterSheetClose ? SHEET_CLOSE_MS : 0
  return closeMs + (reduceMotion ? 0 : SMOOTH_SCROLL_MS)
}
