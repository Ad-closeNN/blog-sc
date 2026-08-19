const listeners = new Set<() => void>()

function subscribe(onStoreChange: () => void) {
  listeners.add(onStoreChange)
  const onStorage = (event: StorageEvent) => {
    if (event.key === "theme") onStoreChange()
  }
  window.addEventListener("storage", onStorage)
  return () => {
    listeners.delete(onStoreChange)
    window.removeEventListener("storage", onStorage)
  }
}

function getSnapshot() {
  return document.documentElement.classList.contains("dark")
}

function getServerSnapshot() {
  return false
}

/**
 * 切换主题。
 *
 * 策略：用 document.startViewTransition 包裹 .dark 切换，整页 root 截图
 * crossfade（160ms ease-out，对标 ProjectK-Web）。
 *
 * - callback 内先挂 .no-theme-transition 禁用全站非 body transition 再切 .dark：
 *   截图 new 捕获到的是最终态而非过渡中间帧，crossfade 干净。
 *   （blog-sc 有标签/筛选 chip + shadcn 基础件等常驻 color/border
 *   transition，不禁用则截图 new 会捕获中间帧，淡入后显色错乱。）
 * - .no-theme-transition 的移除时机：等 View Transition 的 finished Promise
 *   resolve（crossfade 完全结束）后才移除。若用双帧 rAF 提前移除，非 body
 *   元素的常驻 transition 会在 crossfade 途中恢复，与 VT 截图层合成叠加，
 *   每帧额外 recalc+paint，crossfade 期间持续掉帧。
 *   finished 后真实 DOM 已完全显露、颜色已到位，移除 class 不触发新过渡，
 *   hover 动画随即恢复。
 * - token 守卫：连续快速切换时，前一次清理可能在新一次切换开始后执行；
 *   用递增 token 比对，仅最新一次主题变更才允许移除 class。
 *
 * 降级：显式禁用 View Transition、不支持 startViewTransition 或
 * prefers-reduced-motion 时，直接 apply() 瞬时切换（apply 内仍禁用 + 用
 * finished-less 的双帧 rAF 恢复，避免常驻 transition 产生半截动画）。
 */
type ThemeChangeOptions = {
  viewTransition?: boolean
}

let themeChangeToken = 0

function setDark(next: boolean, options: ThemeChangeOptions = {}) {
  const root = document.documentElement
  const token = ++themeChangeToken
  const apply = () => {
    root.classList.add("no-theme-transition")
    root.classList.toggle("dark", next)
    localStorage.setItem("theme", next ? "dark" : "light")
    listeners.forEach((listener) => listener())
    // 通知非 React 监听方（如 Comments.astro 的 Giscus postMessage）
    // 跟随主题切换，避免重新加载评论。
    document.dispatchEvent(
      new CustomEvent("blog:theme-change", { detail: { dark: next } })
    )
  }
  const cleanup = () => {
    if (token === themeChangeToken) {
      root.classList.remove("no-theme-transition")
    }
  }

  if (
    options.viewTransition === false ||
    !document.startViewTransition ||
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  ) {
    apply()
    requestAnimationFrame(() => {
      requestAnimationFrame(cleanup)
    })
    return
  }

  const vt = document.startViewTransition(apply)
  vt.finished.finally(cleanup)
}

function toggleDark(options?: ThemeChangeOptions) {
  setDark(!getSnapshot(), options)
}

export const themeStore = {
  subscribe,
  getSnapshot,
  getServerSnapshot,
  setDark,
  toggleDark,
}
