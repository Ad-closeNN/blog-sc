import { MoreVerticalIcon } from "lucide-react"
import { Fragment, useEffect, useRef } from "react"

import { navEntries } from "@/components/nav-entries"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

/**
 * 导航下拉菜单：归档 / 友链 / RSS / GitHub。
 * 放在桌面端 SearchBox 与 ThemeToggle 之间。
 *
 * transition:persist 下切页（如点友链跳到 /friends/）island 保留 React 状态，
 * 但 base-ui Menu 的 portal 容器只解析一次、切页后仍指向旧 body，
 * open/mounted 状态机失步 → 需连点 3 次才重建。故在 astro:page-load
 * 时用 actionsRef.close()+unmount() 强制复位（与 SearchBox 的强关范式一致）。
 */
export default function NavMenu() {
  const menuActionsRef = useRef<{ close: () => void; unmount: () => void }>(
    null
  )
  const resetTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const menuGenRef = useRef(0)

  useEffect(() => {
    // 等菜单关闭过渡结束后再 unmount；用代际号兜底，
    // 期间用户重新打开菜单时，过期的 unmount 自动作废。
    const reset = () => {
      menuActionsRef.current?.close()
      menuGenRef.current++
      if (resetTimerRef.current) clearTimeout(resetTimerRef.current)
      const gen = menuGenRef.current
      resetTimerRef.current = setTimeout(() => {
        resetTimerRef.current = null
        if (gen === menuGenRef.current) {
          menuActionsRef.current?.unmount()
        }
      }, 150)
    }
    document.addEventListener("astro:page-load", reset)
    return () => {
      document.removeEventListener("astro:page-load", reset)
      if (resetTimerRef.current) clearTimeout(resetTimerRef.current)
    }
  }, [])

  return (
    <DropdownMenu actionsRef={menuActionsRef}>
      <DropdownMenuTrigger
        render={
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            aria-label="更多菜单"
          />
        }
      >
        <MoreVerticalIcon />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" sideOffset={4} className="min-w-40">
        {navEntries.map((entry, i) => (
          <Fragment key={entry.key}>
            {i > 0 && <DropdownMenuSeparator />}
            <DropdownMenuItem
              render={
                <a
                  href={entry.href}
                  target={entry.external ? "_blank" : undefined}
                  rel={entry.external ? "noopener noreferrer" : undefined}
                  className="flex w-full items-center"
                >
                  {entry.icon && (
                    <span className="flex size-4 items-center justify-center text-muted-foreground">
                      {entry.icon}
                    </span>
                  )}
                  <span className={cn("flex-1")}>{entry.label}</span>
                </a>
              }
            />
          </Fragment>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
