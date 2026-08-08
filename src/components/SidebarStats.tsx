import { useEffect, useState } from "react"
import {
  GitCommitHorizontalIcon,
  LineChartIcon,
  QuoteIcon,
} from "lucide-react"

import { site } from "@/config"

type Commit = { shortSha: string; url: string; message: string }

type GithubCommit = {
  sha: string
  html_url: string
  commit: { message: string }
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
 * 侧栏动态卡片：一言 / Umami 全站访问量 / GitHub 最新 commit。
 * React + client:load（与 TableOfContents 惯例一致），SSR 渲染占位，水合后 fetch。
 * 三路各自 try/catch 降级，互不阻塞。
 */
export default function SidebarStats() {
  const [hitokoto, setHitokoto] = useState("正在加载一言…")
  const [views, setViews] = useState("加载中…")
  const [commit, setCommit] = useState<Commit | null>(null)
  const [commitText, setCommitText] = useState("加载中…")

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

    // GitHub 最新 commit
    const repo = site.githubRepo
    fetch(`https://api.github.com/repos/${repo}/commits?per_page=1`)
      .then((r) => {
        if (!r.ok) throw new Error("获取信息失败")
        return r.json() as Promise<GithubCommit[]>
      })
      .then((data) => {
        if (cancelled || !data[0]) return
        const c = data[0]
        setCommit({
          shortSha: c.sha.slice(0, 7),
          url: c.html_url,
          message: c.commit.message,
        })
      })
      .catch(() => {
        if (!cancelled) setCommitText("提交信息不可用")
      })

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
              title={commit.message}
              className="truncate transition-colors hover:text-foreground"
            >
              当前提交：{commit.shortSha}
            </a>
          ) : (
            <span>{commitText}</span>
          )}
        </li>
      </ul>
    </section>
  )
}
