import { useEffect, useRef, useState } from "react"
import { SearchIcon } from "lucide-react"

import { SearchResults } from "@/components/SearchResults"
import { useSearch } from "@/lib/useSearch"
import { cn } from "@/lib/utils"

/**
 * 桌面端站内搜索：navbar 内嵌输入框 + 下拉结果面板。
 * - 输入防抖调 FlexSearch（客户端现场索引）
 * - ArrowDown/Up 高亮、Enter 打开、Esc 关闭
 * - 点击外部 / 客户端导航（astro:page-load）关闭面板
 * - transition:persist 下切页默认保留 island，用 astro:page-load 强关
 */
export default function SearchBox() {
  const { status, search } = useSearch()
  const [query, setQuery] = useState("")
  const [results, setResults] = useState<Awaited<ReturnType<typeof search>>>([])
  const [open, setOpen] = useState(false)
  const [activeIndex, setActiveIndex] = useState(-1)

  const containerRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const panelId = "searchbox-panel"

  // 输入防抖
  const onInput = (value: string) => {
    setQuery(value)
    if (timerRef.current) clearTimeout(timerRef.current)
    const trimmed = value.trim()
    if (!trimmed) {
      setResults([])
      setOpen(false)
      setActiveIndex(-1)
      return
    }
    timerRef.current = setTimeout(async () => {
      const res = await search(value)
      setResults(res)
      setActiveIndex(res.length > 0 ? 0 : -1)
      setOpen(true)
    }, 200)
  }

  // 点击外部关闭
  useEffect(() => {
    const onPointer = (e: PointerEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        setOpen(false)
      }
    }
    document.addEventListener("pointerdown", onPointer, true)
    return () => document.removeEventListener("pointerdown", onPointer, true)
  }, [])

  // 客户端导航后强制关闭（View Transitions 切页 island 持久化）
  useEffect(() => {
    const onPageLoad = () => setOpen(false)
    document.addEventListener("astro:page-load", onPageLoad)
    return () => document.removeEventListener("astro:page-load", onPageLoad)
  }, [])

  useEffect(
    () => () => {
      if (timerRef.current) clearTimeout(timerRef.current)
    },
    []
  )

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") {
      setOpen(false)
      inputRef.current?.blur()
      return
    }
    if (e.key === "ArrowDown") {
      e.preventDefault()
      setActiveIndex((i) => (i + 1) % Math.max(results.length, 1))
    } else if (e.key === "ArrowUp") {
      e.preventDefault()
      setActiveIndex(
        (i) => (i - 1 + Math.max(results.length, 1)) % Math.max(results.length, 1)
      )
    } else if (e.key === "Enter") {
      const target = results[activeIndex >= 0 ? activeIndex : 0]
      if (target) window.location.assign(target.url)
    }
  }

  const showPanel = open && query.trim().length > 0

  return (
    <div ref={containerRef} className="relative">
      <div className="relative">
        <SearchIcon className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <input
          ref={inputRef}
          type="text"
          role="combobox"
          aria-expanded={showPanel}
          aria-controls={panelId}
          aria-label="站内搜索"
          placeholder="搜索…"
          value={query}
          onChange={(e) => onInput(e.target.value)}
          onFocus={() => {
            if (query.trim()) setOpen(true)
          }}
          onKeyDown={onKeyDown}
          className={cn(
            "h-9 w-56 rounded-lg border border-input bg-background pl-9 pr-3 text-sm",
            "text-foreground placeholder:text-muted-foreground outline-none",
            "transition-all focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
          )}
        />
      </div>

      {showPanel && (
        <div
          id={panelId}
          role="listbox"
          aria-label="搜索结果"
          className="absolute right-0 top-full z-20 mt-1 max-h-[60vh] w-[min(24rem,90vw)] overflow-y-auto rounded-lg border border-border bg-popover p-1 text-popover-foreground shadow-lg"
        >
          <SearchResults
            status={status}
            results={results}
            query={query}
            activeIndex={activeIndex}
          />
        </div>
      )}
    </div>
  )
}
