import type { SearchResult, SearchStatus } from "@/lib/search"
import { cn } from "@/lib/utils"

type Props = {
  status: SearchStatus
  results: SearchResult[]
  query: string
  onNavigate?: (url: string) => void
  /** 高亮项索引（桌面下拉键盘导航用） */
  activeIndex?: number
}

/**
 * 搜索结果展示列表（桌面下拉 / 移动抽屉共用）。
 * 分支：error 不可用 / 空态 / 结果行。
 * 通过 dangerouslySetInnerHTML 渲染 excerpt 以保留 <mark> 高亮。
 */
export function SearchResults({
  status,
  results,
  query,
  onNavigate,
  activeIndex = -1,
}: Props) {
  const hasQuery = query.trim().length > 0

  if (status === "error") {
    return (
      <p className="px-2.5 py-2 text-sm text-muted-foreground">
        搜索服务暂不可用
      </p>
    )
  }

  if (!hasQuery) return null

  if (results.length === 0) {
    return (
      <p className="px-2.5 py-2 text-sm text-muted-foreground">
        没有找到相关结果
      </p>
    )
  }

  return (
    <div className="search-results">
      {results.map((r, i) => (
        <a
          key={`${r.url}-${i}`}
          href={r.url}
          onClick={() => onNavigate?.(r.url)}
          className={cn(
            "block rounded-md px-2.5 py-2 transition-colors hover:bg-muted",
            i === activeIndex && "bg-muted"
          )}
        >
          <p className="mb-0.5 flex items-center gap-1 truncate text-sm font-medium text-foreground">
            <span
              className="truncate"
              dangerouslySetInnerHTML={{ __html: highlightTitle(r.title, query) }}
            />
          </p>
          <p
            className="pagefind-excerpt line-clamp-2 text-sm leading-relaxed text-muted-foreground"
            dangerouslySetInnerHTML={{ __html: r.excerpt }}
          />
        </a>
      ))}
    </div>
  )
}

/** 标题里命中 query 的子串用 <mark> 包裹 */
function highlightTitle(title: string, query: string): string {
  const q = query.trim()
  if (!q) return escapeHtml(title)
  const ql = q.toLowerCase()
  const lower = title.toLowerCase()
  const idx = lower.indexOf(ql)
  if (idx < 0) return escapeHtml(title)
  return (
    escapeHtml(title.slice(0, idx)) +
    `<mark>${escapeHtml(title.slice(idx, idx + q.length))}</mark>` +
    escapeHtml(title.slice(idx + q.length))
  )
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
}
