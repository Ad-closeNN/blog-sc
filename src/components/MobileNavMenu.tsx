import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react"
import {
  BookOpenIcon,
  HomeIcon,
  ListTreeIcon,
  MenuIcon,
  MoonIcon,
  SearchIcon,
  SunIcon,
} from "lucide-react"

import { navEntries } from "@/components/nav-entries"
import { SearchResults } from "@/components/SearchResults"
import type { Heading } from "@/components/TableOfContents"
import { Button, buttonVariants } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import { navigation } from "@/config"
import {
  clickScrollLockMs,
  scrollToHeading,
  SHEET_CLOSE_MS,
} from "@/lib/scroll-to-heading"
import { themeStore } from "@/lib/theme"
import { useSearch } from "@/lib/useSearch"
import { cn } from "@/lib/utils"

type Props = {
  pathname: string
  headings?: Heading[]
}

export default function MobileNavMenu({ pathname, headings = [] }: Props) {
  const filteredHeadings = useMemo(
    () => headings.filter((h) => h.depth >= 2 && h.depth <= 4),
    [headings],
  )
  const headingKey = useMemo(
    () => filteredHeadings.map((h) => h.slug).join("|"),
    [filteredHeadings],
  )

  const [open, setOpen] = useState(false)
  const [prevPathname, setPrevPathname] = useState(pathname)
  const [activeId, setActiveId] = useState("")
  const sheetActionsRef = useRef<{ close: () => void; unmount: () => void }>(
    null,
  )
  const isClickScrollingRef = useRef(false)
  const lockTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const scrollAfterCloseTimerRef = useRef<ReturnType<typeof setTimeout> | null>(
    null,
  )
  const resetTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const scrollRafRef = useRef<number | null>(null)
  // 缓存各 heading 的绝对 offset，滚动时纯数字比较，避免每帧 offsetTop reflow
  const offsetsRef = useRef<{ id: string; top: number }[]>([])

  // 路由变化时关闭抽屉（渲染期同步，避免 effect 内 setState）
  if (pathname !== prevPathname) {
    setPrevPathname(pathname)
    setOpen(false)
  }

  /*
   * transition:persist 下切页时 island 被保留，但 base-ui Dialog 的 portal 容器
   * 只解析一次、切页后仍可能指向被 View Transitions 换掉的旧 body，open/mounted
   * 状态机失步后会留下透明但仍可交互的 overlay，故切页后需强制卸载 portal 复位。
   *
   * 绑 astro:page-load（swap 之后）而非 astro:before-swap：unmount() 只应在关闭
   * 动画结束后调用（base-ui 文档明示）。before-swap 时若用户正同时点头像导航 +
   * 点抽屉按钮，unmount 会打断正在进行的 portal mount，把 mounted 写死 false，
   * 导致之后抽屉再也打不开。page-load 在 swap 完成后触发，操作新页面上下文，无此
   * 竞态。切页瞬间抽屉的可见关闭由渲染期 pathname 变化时的 setOpen(false) 兜底。
   */
  useEffect(() => {
    // 等 Sheet 关闭动画结束再 unmount（base-ui 文档要求），
    // 避免切页瞬间与用户点击竞争，把 mounted 写死导致抽屉再也打不开。
    const reset = () => {
      setOpen(false)
      sheetActionsRef.current?.close()
      if (resetTimerRef.current) clearTimeout(resetTimerRef.current)
      resetTimerRef.current = setTimeout(() => {
        resetTimerRef.current = null
        sheetActionsRef.current?.unmount()
      }, SHEET_CLOSE_MS)
    }
    document.addEventListener("astro:page-load", reset)
    return () => {
      document.removeEventListener("astro:page-load", reset)
      if (resetTimerRef.current) clearTimeout(resetTimerRef.current)
    }
  }, [])

  const isDark = useSyncExternalStore(
    themeStore.subscribe,
    themeStore.getSnapshot,
    themeStore.getServerSnapshot,
  )

  const isHome = pathname === "/"
  const isPosts = pathname === "/posts/" || pathname.startsWith("/posts/")

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

    const onScroll = () => {
      if (isClickScrollingRef.current) return
      if (scrollRafRef.current !== null) return

      scrollRafRef.current = requestAnimationFrame(() => {
        scrollRafRef.current = null
        if (isClickScrollingRef.current) return

        const offsets = offsetsRef.current
        if (offsets.length === 0) return

        const scrollPos = window.scrollY + 85
        let current = ""
        for (const item of offsets) {
          if (item.top <= scrollPos) current = item.id
          else break
        }
        const nextId = current || offsets[0].id
        setActiveId((prev) => (prev === nextId ? prev : nextId))
      })
    }

    window.addEventListener("scroll", onScroll, { passive: true })
    window.addEventListener("resize", measureOffsets)

    // 返回键（popstate）时按 URL hash 同步目录高亮并滚到对应标题
    const onPop = () => {
      const slug = decodeURIComponent(location.hash.replace(/^#/, ""))
      const el = slug ? document.getElementById(slug) : null
      if (el) {
        setActiveId(slug)
        el.scrollIntoView({ behavior: "auto", block: "start"   headings?: Heading[]
}

export default function MobileNavMenu({ pathname, headings = [] }: Props) {
  const filteredHeadings = useMemo(
    () => headings.filter((h) => h.depth >= 2 && h.depth <= 4),
    [headings],
  )
  const headingKey = useMemo(
    () => filteredHeadings.map((h) => h.slug).join("|"),
    [filteredHeadings],
  )

  const [open, setOpen] = useState(false)
  const [prevPathname, setPrevPathname] = useState(pathname)
  const [activeId, setActiveId] = useState("")
  const sheetActionsRef = useRef<{ close: () => void; unmount: () => void }>(
    null,
  )
  const isClickScrollingRef = useRef(false)
  const lockTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const scrollAfterCloseTimerRef = useRef<ReturnType<typeof setTimeout> | null>(
    null,
  )
  const scrollRafRef = useRef<number | null>(null)
  // 缓存各 heading 的绝对 offset，滚动时纯数字比较，避免每帧 offsetTop reflow
  const offsetsRef = useRef<{ id: string; top: number }[]>([])

  // 路由变化时关闭抽屉（渲染期同步，避免 effect 内 setState）
  if (pathname !== prevPathname) {
    setPrevPathname(pathname)
    setOpen(false)
  }

  /*
   * transition:persist 下切页时 island 被保留，但 base-ui Dialog 的 portal 容器
   * 只解析一次、切页后仍可能指向被 View Transitions 换掉的旧 body，open/mounted
   * 状态机失步后会留下透明但仍可交互的 overlay，故切页后需强制卸载 portal 复位。
   *
   * 绑 astro:page-load（swap 之后）而非 astro:before-swap：unmount() 只应在关闭
   * 动画结束后调用（base-ui 文档明示）。before-swap 时若用户正同时点头像导航 +
   * 点抽屉按钮，unmount 会打断正在进行的 portal mount，把 mounted 写死 false，
   * 导致之后抽屉再也打不开。page-load 在 swap 完成后触发，操作新页面上下文，无此
   * 竞态。切页瞬间抽屉的可见关闭由渲染期 pathname 变化时的 setOpen(false) 兜底。
   */
  useEffect(() => {
    const reset = () => {
      setOpen(false)
      sheetActionsRef.current?.close()
      sheetActionsRef.current?.unmount()
    }
    document.addEventListener("astro:page-load", reset)
    return () => document.removeEventListener("astro:page-load", reset)
  }, [])

  const isDark = useSyncExternalStore(
    themeStore.subscribe,
    themeStore.getSnapshot,
    themeStore.getServerSnapshot,
  )

  const isHome = pathname === "/"
  const isPosts = pathname === "/posts/" || pathname.startsWith("/posts/")

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

    const onScroll = () => {
      if (isClickScrollingRef.current) return
      if (scrollRafRef.current !== null) return

      scrollRafRef.current = requestAnimationFrame(() => {
        scrollRafRef.current = null
        if (isClickScrollingRef.current) return

        const offsets = offsetsRef.current
        if (offsets.length === 0) return

        const scrollPos = window.scrollY + 85
        let current = ""
        for (const item of offsets) {
          if (item.top <= scrollPos) current = item.id
          else break
        }
        const nextId = current || offsets[0].id
        setActiveId((prev) => (prev === nextId ? prev : nextId))
      })
    }

    window.addEventListener("scroll", onScroll, { passive: true })
    window.addEventListener("resize", measureOffsets)
    onScroll()

    return () => {
      window.removeEventListener("scroll", onScroll)
      window.removeEventListener("resize", measureOffsets)
      if (lockTimerRef.current) clearTimeout(lockTimerRef.current)
      if (scrollAfterCloseTimerRef.current) {
        clearTimeout(scrollAfterCloseTimerRef.current)
      }
      if (scrollRafRef.current !== null) {
        cancelAnimationFrame(scrollRafRef.current)
        scrollRafRef.current = null
      }
    }
  }, [filteredHeadings, headingKey])

  const handleHeadingClick = (slug: string) => {
    if (!document.getElementById(slug)) return

    setActiveId(slug)
    isClickScrollingRef.current = true
    setOpen(false)

    if (lockTimerRef.current) clearTimeout(lockTimerRef.current)
    if (scrollAfterCloseTimerRef.current) {
      clearTimeout(scrollAfterCloseTimerRef.current)
    }

    // 等 Sheet 关闭动画结束后再滚，避免与 backdrop-blur / transform 同帧争抢
    scrollAfterCloseTimerRef.current = setTimeout(() => {
      scrollAfterCloseTimerRef.current = null
      scrollToHeading(slug)
    }, SHEET_CLOSE_MS)

    lockTimerRef.current = setTimeout(() => {
      isClickScrollingRef.current = false
      lockTimerRef.current = null
    }, clickScrollLockMs({ afterSheetClose: true }))
  }

  const navLinkClass = (active: boolean) =>
    cn(
      buttonVariants({
        variant: active ? "secondary" : "ghost",
        className: "h-9 w-full justify-start gap-3 font-medium",
      }),
    )

  return (
    <div className="md:hidden">
      {/* 独立 Button 打开，避免 SheetTrigger + Button 双层 base-ui 组合失效 */}
      <Button
        type="button"
        variant="outline"
        size="icon-sm"
        aria-label="打开导航菜单"
        title="菜单"
        aria-expanded={open}
        aria-haspopup="dialog"
        onClick={() => setOpen(true)}
      >
        <MenuIcon />
      </Button>

      <Sheet
        key={pathname}
        open={open}
        onOpenChange={setOpen}
        actionsRef={sheetActionsRef}
      >
        <SheetContent
          side="right"
          className="flex w-80 max-w-[85vw] flex-col gap-0 p-0"
        >
          <SheetHeader className="border-b border-border px-5 py-4 text-left">
            <SheetTitle>功能菜单</SheetTitle>
            <SheetDescription>导航、外观与文章目录</SheetDescription>
          </SheetHeader>

          <div className="flex-1 space-y-5 overflow-y-auto px-5 py-4">
            <section className="space-y-2">
              <p className="text-[0.7rem] font-semibold tracking-widest text-muted-foreground uppercase">
                快捷导航
              </p>
              <nav className="flex flex-col gap-0.5" aria-label="移动端导航">
                <SheetClose
                  render={(props) => (
                    <a href={navigation.home.href} {...props} />
                  )}
                  nativeButton={false}
                  className={navLinkClass(isHome)}
                  aria-current={isHome ? "page" : undefined}
                >
                  <HomeIcon className="size-4" />
                  {navigation.home.label}
                </SheetClose>
                <SheetClose
                  render={(props) => (
                    <a href={navigation.posts.href} {...props} />
                  )}
                  nativeButton={false}
                  className={navLinkClass(isPosts && !isHome)}
                  aria-current={isPosts && !isHome ? "page" : undefined}
                >
                  <BookOpenIcon className="size-4" />
                  {navigation.posts.label}
                </SheetClose>
              </nav>
            </section>

            {/* 快捷入口：与桌面 navbar NavMenu 同源（navEntries），
                去掉 posts 以免与上方「快捷导航」的「文章」重复 */}
            <section className="space-y-2">
              <p className="text-[0.7rem] font-semibold tracking-widest text-muted-foreground uppercase">
                快捷入口
              </p>
              <nav className="flex flex-col gap-0.5" aria-label="功能入口">
                {navEntries
                  .filter((entry) => entry.key !== "posts")
                  .map((entry) => (
                    <SheetClose
                      key={entry.key}
                      render={(props) => (
                        <a
                          href={entry.href}
                          target={entry.external ? "_blank" : undefined}
                          rel={
                            entry.external
                              ? "noopener noreferrer"
                              : undefined
                          }
                          {...props}
                        />
                      )}
                      nativeButton={false}
                      className={navLinkClass(false)}
                    >
                      <span className="flex size-4 items-center justify-center text-muted-foreground">
                        {entry.icon}
                      </span>
                      {entry.label}
                    </SheetClose>
                  ))}
              </nav>
            </section>

            <Separator />

            <MobileSearchSection />

            <Separator />

            <section className="space-y-2">
              <p className="text-[0.7rem] font-semibold tracking-widest text-muted-foreground uppercase">
                外观
              </p>
              <Button
                type="button"
                variant="outline"
                className="h-9 w-full justify-between"
                onClick={() =>
                  themeStore.toggleDark({ viewTransition: false })
                }
                aria-label={isDark ? "切换到浅色模式" : "切换到深色模式"}
              >
                <span className="flex items-center gap-3">
                  {isDark ? (
                    <MoonIcon className="size-4 text-primary" />
                  ) : (
                    <SunIcon className="size-4 text-amber-500" />
                  )}
                  {isDark ? "深色模式" : "浅色模式"}
                </span>
              </Button>
            </section>

            {filteredHeadings.length > 0 && (
              <>
                <Separator />
                <section className="space-y-3">
                  <p className="flex items-center gap-2 text-[0.7rem] font-semibold tracking-widest text-muted-foreground uppercase">
                    <ListTreeIcon className="size-3.5 text-primary" />
                    文章目录
                  </p>
                  <ul className="flex flex-col gap-0.5 border-l border-border pl-3">
                    {filteredHeadings.map((h) => {
                      const active = activeId === h.slug
                      const indent =
                        h.depth === 3 ? "pl-3" : h.depth === 4 ? "pl-5" : ""

                      return (
                        <li key={h.slug} className={indent}>
                          <a
                            href={`#${h.slug}`}
                            onClick={(e) => {
                              e.preventDefault()
                              handleHeadingClick(h.slug)
                            }}
                            className={cn(
                              "block truncate py-1.5 pl-2 text-sm transition-colors",
                              active
                                ? "-ml-px border-l-2 border-primary pl-[calc(0.5rem-1px)] font-semibold text-primary"
                                : "text-muted-foreground hover:text-foreground",
                            )}
                            aria-current={active ? "location" : undefined}
                          >
                            {h.text}
                          </a>
                        </li>
                      )
                    })}
                  </ul>
                </section>
              </>
            )}
          </div>
        </SheetContent>
      </Sheet>
    </div>
  )
}

/** 移动端抽屉内的站内搜索：输入框 + 内联结果列表 */
function MobileSearchSection() {
  const { status, search } = useSearch()
  const [query, setQuery] = useState("")
  const [results, setResults] = useState<Awaited<ReturnType<typeof search>>>([])
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const onInput = (value: string) => {
    setQuery(value)
    if (timerRef.current) clearTimeout(timerRef.current)
    const trimmed = value.trim()
    if (!trimmed) {
      setResults([])
      return
    }
    timerRef.current = setTimeout(async () => {
      setResults(await search(value))
    }, 200)
  }

  useEffect(
    () => () => {
      if (timerRef.current) clearTimeout(timerRef.current)
    },
    []
  )

  return (
    <section className="space-y-2">
      <p className="text-[0.7rem] font-semibold tracking-widest text-muted-foreground uppercase">
        搜索文章
      </p>
      <div className="relative">
        <SearchIcon className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <input
          type="text"
          role="combobox"
          aria-label="站内搜索"
          placeholder="搜索文章…"
          value={query}
          onChange={(e) => onInput(e.target.value)}
          className="h-9 w-full rounded-lg border border-input bg-background pl-8 pr-3 text-sm text-foreground outline-none placeholder:text-muted-foreground transition-all focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
        />
      </div>
      {query.trim().length > 0 && (
        <div className="max-h-64 overflow-y-auto rounded-lg border border-border bg-card">
          <SearchResults status={status} results={results} query={query} />
        </div>
      )}
    </section>
  )
}
