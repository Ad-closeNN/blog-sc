import { useEffect, useRef, useState } from "react"

import { Spinner } from "@/components/ui/spinner"
import { statusBadge } from "@/config"

type ThemeFrame = "light" | "dark"

type Props = {
  /** desktop: navbar 内联固定宽；mobile: 抽屉内占满一行 */
  variant?: "desktop" | "mobile"
}

/**
 * 服务状态徽章（Better Stack iframe）。
 *
 * 做成 React 岛而非 .astro 组件，是为了能挂 client:idle + transition:persist：
 * transition:persist 只对带 client:* 指令的岛生效，纯 Astro 组件切页时会被
 * View Transitions 整体替换，iframe 随之重载、每次切页都重新请求第三方。
 * 与 ThemeToggle / NavMenu 同一模式。
 *
 * 后加载（首屏后加载）：
 * 初始渲染不挂载 iframe，等待首屏（window load + requestIdleCallback）完成后
 * 再开始注入 iframe 并发起第三方请求，避免首屏资源竞争与阻塞。
 *
 * 主题跟随：徽章是跨域 iframe，拿不到本站的 .dark 也无法注入 CSS，故渲染
 * light / dark 两个 frame（src 各带对应 theme 参数），靠 global.css 的
 * grid-area: 1/1 叠放、按 .dark 切 visibility 显示。本组件只负责「两个
 * frame 都加载完后才淡入」，不参与主题切换。
 */
export default function StatusBadge({ variant = "desktop" }: Props) {
  const loadedFrames = useRef(new Set<ThemeFrame>())
  const [shouldLoad, setShouldLoad] = useState(false)
  const [loaded, setLoaded] = useState(false)

  const markFrameLoaded = (theme: ThemeFrame) => {
    loadedFrames.current.add(theme)
    if (loadedFrames.current.size === 2) setLoaded(true)
  }

  useEffect(() => {
    const trigger = () => {
      const run = () => setShouldLoad(true)
      if ("requestIdleCallback" in window) {
        window.requestIdleCallback(run, { timeout: 2000 })
      } else {
        setTimeout(run, 100)
      }
    }

    if (document.readyState === "complete") {
      trigger()
    } else {
      window.addEventListener("load", trigger, { once: true })
      return () => window.removeEventListener("load", trigger)
    }
  }, [])

  if (!statusBadge.enable) return null

  return (
    <a
      href={statusBadge.href}
      target="_blank"
      rel="noopener noreferrer"
      className={
        variant === "mobile" ? "status-badge is-mobile" : "status-badge"
      }
      data-loading={shouldLoad && !loaded ? "" : undefined}
      data-loaded={loaded || undefined}
      aria-label={`${statusBadge.label}（在新标签页打开）`}
      title={statusBadge.label}
    >
      {shouldLoad && !loaded && (
        <Spinner
          className="status-badge-spinner"
          aria-label="正在加载服务状态"
        />
      )}
      {shouldLoad && (
        <>
          <iframe
            data-theme-frame="light"
            src={withTheme(statusBadge.src, "light")}
            width={statusBadge.width}
            height={statusBadge.height}
            loading="lazy"
            title={statusBadge.label}
            onLoad={() => markFrameLoaded("light")}
            style={{ colorScheme: "normal" }}
          />
          <iframe
            data-theme-frame="dark"
            src={withTheme(statusBadge.src, "dark")}
            width={statusBadge.width}
            height={statusBadge.height}
            loading="lazy"
            title={statusBadge.label}
            onLoad={() => markFrameLoaded("dark")}
            style={{ colorScheme: "normal" }}
          />
        </>
      )}
    </a>
  )
}

/** 把 URL 的 theme 参数设为指定值（无该参数则追加） */
function withTheme(src: string, theme: "dark" | "light") {
  const url = new URL(src)
  url.searchParams.set("theme", theme)
  return url.toString()
}
