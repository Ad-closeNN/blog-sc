import { useEffect, useRef, useState } from "react"
import { ChevronUp, ListTree } from "lucide-react"

import {
  clickScrollLockMs,
  scrollToHeading,
} from "@/lib/scroll-to-heading"
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"

export type Heading = {
  depth: number
  slug: string
  text: string
}

type Props = {
  headings: Heading[]
  isMobile?: boolean
}

export default function TableOfContents({ headings, isMobile }: Props) {
  const filteredHeadings = headings.filter((h) => h.depth >= 2 && h.depth <= 4)
  const [activeId, setActiveId] = useState<string>("")
  const [isOpen, setIsOpen] = useState(false)
  const isClickScrollingRef = useRef<boolean>(false)
  const lockTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const scrollRafRef = useRef<number | null>(null)
  // 缓存各 heading 的绝对 offset（getBoundingClientRect + scrollY），
  // 滚动时纯数字比较，避免每帧 offsetTop 触发的强制 layout(reflow)。
  const offsetsRef = useRef<{ id: string; top: number }[]>([])

  useEffect(() => {
    if (filteredHeadings.length === 0) return

    const measureOffsets = () => {
      offsetsRef.current = filteredHeadings
        .map((h) => document.getElementById(h.slug))
        .filter((el): el is HTMLElement => el !== null)
        .map((el) => ({ id: el.id, top: el.getBoundingClientRect().top + window.scrollY }))
    }

    measureOffsets()
    if (offsetsRef.current.length === 0) return

    const handleScroll = () => {
      // 点击 TOC 跳转平滑滚动期间，禁用 scrollSpy，防止高亮穿梭闪烁
      if (isClickScrollingRef.current) return
      if (scrollRafRef.current !== null) return

      scrollRafRef.current = requestAnimationFrame(() => {
        scrollRafRef.current = null
        if (isClickScrollingRef.current) return

        const offsets = offsetsRef.current
        if (offsets.length === 0) return

        const scrollPos = window.scrollY + 85
        let currentId = ""
        for (const item of offsets) {
          if (item.top <= scrollPos) {
            currentId = item.id
          } else {
            break
          }
        }
        const nextId = currentId || offsets[0].id
        setActiveId((prev) => (prev === nextId ? prev : nextId))
      })
    }

    window.addEventListener("scroll", handleScroll, { passive: true })
    // 字体/图片加载或窗口缩放会改变 heading 位置，重新测量缓存
    window.addEventListener("resize", measureOffsets)
    handleScroll()

    return () => {
      window.removeEventListener("scroll", handleScroll)
      window.removeEventListener("resize", measureOffsets)
      if (lockTimeoutRef.current) clearTimeout(lockTimeoutRef.current)
      if (scrollRafRef.current !== null) {
        cancelAnimationFrame(scrollRafRef.current)
        scrollRafRef.current = null
      }
    }
  }, [headings])

  if (filteredHeadings.length === 0) return null

  // 移动端/平板竖屏（< 1024px / lg:hidden）：屏幕底部悬浮条 + 抽屉
  if (isMobile) {
    const activeHeading = filteredHeadings.find((h) => h.slug === activeId) || filteredHeadings[0]
    const activeIndex = filteredHeadings.findIndex((h) => h.slug === activeId)

    return (
      <>
        {/* 屏幕底部悬浮长条 Bar */}
        <div className="fixed bottom-5 inset-x-0 z-[90] lg:hidden px-4 flex justify-center pointer-events-none">
          <button
            type="button"
            onClick={() => setIsOpen(true)}
            className="pointer-events-auto flex items-center justify-between gap-3 w-full max-w-md h-12 px-4 rounded-full border border-border/80 bg-background/90 dark:bg-card/90 backdrop-blur-xl shadow-lg hover:shadow-xl active:scale-[0.98] transition-all duration-200 text-left group"
            aria-label="打开文章目录"
          >
            {/* 左侧：图标 + 目录标签 + 动态当前章节标题 */}
            <div className="flex items-center gap-2 min-w-0 flex-1">
              <span className="flex items-center justify-center size-7 rounded-full bg-primary/10 text-primary group-hover:bg-primary group-hover:text-primary-foreground transition-colors duration-200 shrink-0">
                <ListTree className="size-3.5" />
              </span>
              <span className="text-xs font-semibold tracking-wider text-muted-foreground uppercase shrink-0">
                目录
              </span>
              <span className="text-muted-foreground/30 shrink-0 select-none">/</span>
              <span className="text-xs font-medium text-foreground truncate min-w-0">
                {activeHeading?.text || "快速导航"}
              </span>
            </div>

            {/* 右侧：章节进度 + 展开箭头 */}
            <div className="flex items-center gap-1.5 shrink-0 text-muted-foreground">
              {activeIndex >= 0 && (
                <span className="text-[11px] font-mono text-muted-foreground/80 bg-muted/70 px-1.5 py-0.5 rounded-md">
                  {activeIndex + 1}/{filteredHeadings.length}
                </span>
              )}
              <ChevronUp className="size-4 group-hover:-translate-y-0.5 transition-transform duration-200" />
            </div>
          </button>
        </div>

        {/* 抽屉弹窗 */}
        <Sheet open={isOpen} onOpenChange={setIsOpen}>
          <SheetContent
            side="bottom"
            className="max-h-[75vh] rounded-t-3xl border-t border-border/80 bg-background/95 backdrop-blur-2xl px-4 pb-8 pt-2 shadow-2xl lg:hidden flex flex-col gap-0"
          >
            {/* 抽屉顶部小横条 */}
            <div className="mx-auto my-2 h-1.5 w-12 rounded-full bg-muted-foreground/30" />

            <SheetHeader className="p-2 pb-3 border-b border-border/50 flex flex-row items-center justify-between text-left">
              <div className="flex items-center gap-2">
                <ListTree className="size-4 text-primary" />
                <SheetTitle className="text-base font-semibold">文章目录</SheetTitle>
                <span className="text-xs text-muted-foreground font-mono bg-muted/70 px-2 py-0.5 rounded-full">
                  共 {filteredHeadings.length} 节
                </span>
              </div>
            </SheetHeader>

            {/* 目录列表 */}
            <div className="flex-1 overflow-y-auto mt-2 py-1 pr-1 overscroll-contain">
              <ul className="m-0 list-none p-0 space-y-1">
                {filteredHeadings.map((h) => {
                  const isActive = activeId === h.slug
                  const indentClass =
                    h.depth === 3 ? "pl-5 text-[13px]" : h.depth === 4 ? "pl-9 text-xs" : "text-sm font-medium"

                  return (
                    <li key={h.slug} className="relative">
                      <a
                        href={`#${h.slug}`}
                        className={`flex items-center justify-between py-2.5 px-3 rounded-xl transition-all duration-150 ${indentClass} ${
                          isActive
                            ? "bg-primary/10 text-primary font-medium"
                            : "text-muted-foreground hover:bg-muted/50 hover:text-foreground active:bg-muted"
                        }`}
                        onClick={(e) => {
                          e.preventDefault()
                          if (!document.getElementById(h.slug)) return

                          setIsOpen(false)

                          setActiveId(h.slug)
                          isClickScrollingRef.current = true

                          if (lockTimeoutRef.current) {
                            clearTimeout(lockTimeoutRef.current)
                          }

                          lockTimeoutRef.current = setTimeout(() => {
                            isClickScrollingRef.current = false
                            lockTimeoutRef.current = null
                          }, clickScrollLockMs())

                          scrollToHeading(h.slug)
                        }}
                      >
                        <span className="truncate pr-2">{h.text}</span>
                        {isActive && (
                          <span className="size-1.5 rounded-full bg-primary shrink-0 animate-pulse" />
                        )}
                      </a>
                    </li>
                  )
                })}
              </ul>
            </div>
          </SheetContent>
        </Sheet>
      </>
    )
  }

  // 桌面端目录
  return (
    <nav className="toc-container" aria-label="文章目录">
      <div className="toc-header">
        <ListTree className="size-3.5 text-muted-foreground" />
        <span className="font-mono text-xs font-semibold tracking-wider text-muted-foreground uppercase">
          目录
        </span>
      </div>
      <ul className="toc-list">
        {filteredHeadings.map((h) => {
          const isActive = activeId === h.slug
          return (
            <li key={h.slug} className={`toc-item depth-${h.depth}`}>
              <a
                href={`#${h.slug}`}
                className={`toc-link ${isActive ? "is-active" : ""}`}
                onClick={(e) => {
                  e.preventDefault()
                  if (!document.getElementById(h.slug)) return

                  // 1. 立即锁定高亮至目标项
                  setActiveId(h.slug)
                  isClickScrollingRef.current = true

                  if (lockTimeoutRef.current) {
                    clearTimeout(lockTimeoutRef.current)
                  }

                  // 2. 平滑动画结束后解除锁定，恢复自然滚动监听
                  lockTimeoutRef.current = setTimeout(() => {
                    isClickScrollingRef.current = false
                    lockTimeoutRef.current = null
                  }, clickScrollLockMs())

                  scrollToHeading(h.slug)
                }}
              >
                {h.text}
              </a>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}
