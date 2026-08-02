import { useEffect, useRef, useState } from "react"
import { ListTree } from "lucide-react"

import {
  clickScrollLockMs,
  scrollToHeading,
} from "@/lib/scroll-to-heading"

export type Heading = {
  depth: number
  slug: string
  text: string
}

type Props = {
  headings: Heading[]
}

export default function TableOfContents({ headings }: Props) {
  const filteredHeadings = headings.filter((h) => h.depth >= 2 && h.depth <= 4)
  const [activeId, setActiveId] = useState<string>("")
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
