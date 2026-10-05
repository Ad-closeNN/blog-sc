import { useEffect, useRef, useState } from "react"

import { statusBadge } from "@/config"

type Props = {
  /** desktop: navbar 内联固定宽；mobile: 抽屉内占满一行 */
  variant?: "desktop" | "mobile"
}

/**
 * 服务状态徽章（Better Stack iframe）。
 *
 * 做成 React 岛而非 .astro 组件，是为了能挂 client:load + transition:persist：
 * transition:persist 只对带 client:* 指令的岛生效，纯 Astro 组件切页时会被
 * View Transitions 整体替换，iframe 随之重载、每次切页都重新请求第三方。
 * 与 ThemeToggle / NavMenu 同一模式。
 *
 * 主题跟随：徽章是跨域 iframe，拿不到本站的 .dark 也无法注入 CSS，故渲染
 * light / dark 两个 frame（src 各带对应 theme 参数），靠 global.css 的
 * grid-area: 1/1 叠放、按 .dark 切 visibility 显示。本组件只负责「两个
 * frame 都加载完后才淡入」，不参与主题切换。
 */
export default function StatusBadge({ variant = "desktop" }: Props) {
  const ref = useRef<HTMLAnchorElement>(null)
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    const anchor = ref.current
    if (!anchor) return
    const frames = [...anchor.querySelectorAll("iframe")]

    // 跨域 iframe 也能在父页监听 load 事件；全部加载完才展示。
    // 兜底：若监听挂上时 frame 已加载完（load 在 attach 前已触发），
    // once 监听不会再触发 —— 用 contentWindow?.length 探测（跨域可读，
    // 加载完的 iframe 才有 window 且值为数字）。
    Promise.all(
      frames.map(
        (frame) =>
          new Promise<void>((resolve) => {
            if (typeof frame.contentWindow?.length === "number") {
              resolve()
              return
            }
            frame.addEventListener("load", () => resolve(), { once: true })
          }),
      ),
    ).then(() => setLoaded(true))
  }, [])

  if (!statusBadge.enable) return null

  return (
    <a
      ref={ref}
      href={statusBadge.href}
      target="_blank"
      rel="noopener noreferrer"
      className={
        variant === "mobile" ? "status-badge is-mobile" : "status-badge"
      }
      data-loaded={loaded || undefined}
      aria-label={`${statusBadge.label}（在新标签页打开）`}
      title={statusBadge.label}
    >
      <iframe
        data-theme-frame="light"
        src={withTheme(statusBadge.src, "light")}
        width={statusBadge.width}
        height={statusBadge.height}
        loading="lazy"
        title={statusBadge.label}
        style={{ colorScheme: "normal" }}
      />
      <iframe
        data-theme-frame="dark"
        src={withTheme(statusBadge.src, "dark")}
        width={statusBadge.width}
        height={statusBadge.height}
        loading="lazy"
        title={statusBadge.label}
        style={{ colorScheme: "normal" }}
      />
    </a>
  )
}

/** 把 URL 的 theme 参数设为指定值（无该参数则追加） */
function withTheme(src: string, theme: "dark" | "light") {
  const url = new URL(src)
  url.searchParams.set("theme", theme)
  return url.toString()
}
