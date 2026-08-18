import { EyeIcon } from "lucide-react"
import { useEffect, useState } from "react"

type Props = {
  /** 文章路径，如 /posts/giscus/ */
  path: string
}

type SiteStatsData = { pageviews?: { value?: number } }

type BlogUmamiStore = {
  baseUrl: string
  timezone: string
  getStats: (
    key: string,
    createUrl: (websiteId: string) => string
  ) => Promise<SiteStatsData | null | undefined>
}

/**
 * 单篇文章浏览量（Umami）。
 * 显示于文章页 meta 行，前置 EyeIcon 由 PostMeta.astro 提供，故此处不带分隔符。
 * umami 未启用 / 请求失败 / 无数据 → 返回 null 不显示任何内容。
 * 与 SidebarStats 共用 BaseLayout 注入的 window.__blogUmami store。
 */
/** 累计动画时长（ms） */
const COUNT_UP_MS = 1100

export default function PostViews({ path }: Props) {
  // target：拿到的最终浏览量；display：累计动画当前值
  const [target, setTarget] = useState<number | null>(null)
  const [display, setDisplay] = useState(0)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const store = (window as Window & { __blogUmami?: BlogUmamiStore })
          .__blogUmami
        const data = await store?.getStats(`post:${path}`, (websiteId) => {
          const baseUrl = store!.baseUrl
          const timezone = store!.timezone
          const url = `${baseUrl}/api/websites/${websiteId}/stats?startAt=0&endAt=${Date.now()}&unit=hour&timezone=${encodeURIComponent(timezone)}&compare=false&url=${encodeURIComponent(path)}`
          return url
        })
        if (cancelled) return
        const v = data?.pageviews?.value
        setTarget(v && v > 0 ? v : null)
      } catch {
        if (!cancelled) setTarget(null)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [path])

  // 数字累计：ease-out（先快后慢）。reduced-motion 下直接落终值。
  useEffect(() => {
    if (target === null) return

    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches
    if (reduced) {
      setDisplay(target)
      return
    }

    let raf = 0
    let start: number | null = null
    const tick = (now: number) => {
      if (start === null) start = now
      const p = Math.min(1, (now - start) / COUNT_UP_MS)
      // easeOutCubic
      const eased = 1 - Math.pow(1 - p, 3)
      setDisplay(Math.round(target * eased))
      if (p < 1) raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [target])

  if (target === null) return null

  return (
    <span className="post-views post-meta-item">
      <EyeIcon className="post-meta-icon" aria-hidden="true" />
      <span className="tabular-nums">{display.toLocaleString("zh-CN")}</span>{" "}
      浏览量
    </span>
  )
}
