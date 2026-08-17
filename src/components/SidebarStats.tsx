import { useEffect, useState } from "react"
import {
  GitCommitHorizontalIcon,
  LineChartIcon,
  QuoteIcon,
} from "lucide-react"

import type { BuildCommit } from "@/lib/build-commit"

type SiteStatsData = { pageviews?: { value?: number } }

type BlogUmamiStore = {
  baseUrl: string
  timezone: string
  getStats: (
    key: string,
    createUrl: (websiteId: string) => string
  ) => Promise<SiteStatsData | null | undefined>
}

type Props = {
  /** 构建期注入的 commit（Workers Builds 环境变量），未注入为 null → 显示 dev */
  commit?: BuildCommit | null
}

/**
 * 侧栏动态卡片：一言 / Umami 全站访问量 / 构建期 commit。
 * React + client:load（与 TableOfContents 惯例一致），
 * 一言与访问量 SSR 渲染占位、水合后 fetch；commit 由构建期 env 静态注入，无运行时请求。
 */
export default function SidebarStats({ commit = null }: Props) {
  const [hitokoto, setHitokoto] = useState("正在加载一言…")
  const [views, setViews] = useState("加载中…")

  useEffect(() => {
    let cancelled = false

    // 一言
    fetch("https://v1.hitokoto.cn")
      .then((r) => r.json())
      .then((d: { hitokoto?: string }) => {
        if (!cancelled && d.hitokoto) setHitokoto(d.hitokoto)
      })
      .catch(() => {
        if (!cancelled) setHitokoto("再热情的心也经不起冷漠，再爱你的人也经不起冷落。")
      })

    // Umami 全站访问量（依赖 BaseLayout 注入的 window.__blogUmami；enable=false 时显示不可用）
    ;(async () => {
      try {
        const store = (window as Window & { __blogUmami?: BlogUmamiStore })
          .__blogUmami
        const data = await store?.getStats("site:all", (websiteId) => {
          const baseUrl = store!.baseUrl
          const timezone = store!.timezone
          return `${baseUrl}/api/websites/${websiteId}/stats?startAt=0&endAt=${Date.now()}&unit=hour&timezone=${encodeURIComponent(timezone)}&compare=false`
        })
        if (cancelled) return
        setViews(data ? `浏览量 ${data.pageviews?.value ?? 0}` : "统计不可用")
      } catch {
        if (!cancelled) setViews("统计不可用")
      }
    })()

    return () => {
      cancelled = true
    }
  }, [])

  return (
    <section className="rounded-xl border border-border bg-card p-4">
      <h2 className="mb-3 flex items-center gap-2 font-mono text-[0.7rem] font-semibold tracking-[0.06em] text-muted-foreground uppercase">
        信息 Info
      </h2>
      <ul className="m-0 flex list-none flex-col gap-3 p-0">
        <li className="flex items-start gap-2 text-xs text-muted-foreground">
          <QuoteIcon className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
          <span>{hitokoto}</span>
        </li>
        <li className="flex items-center gap-2 border-t border-border pt-3 text-xs text-muted-foreground">
          <LineChartIcon className="size-3.5 shrink-0" aria-hidden="true" />
          <span>{views}</span>
        </li>
        <li className="flex items-center gap-2 border-t border-border pt-3 text-xs text-muted-foreground">
          <GitCommitHorizontalIcon
            className="size-3.5 shrink-0"
            aria-hidden="true"
          />
          {commit ? (
            <a
              href={commit.url}
              target="_blank"
              rel="noopener noreferrer"
              title={commit.branch ? `${commit.branch}@${commit.sha}` : commit.sha}
              className="truncate transition-colors hover:text-foreground"
            >
              当前提交：{commit.shortSha}
            </a>
          ) : (
            <span>当前提交：dev</span>
          )}
        </li>
      </ul>
    </section>
  )
}
