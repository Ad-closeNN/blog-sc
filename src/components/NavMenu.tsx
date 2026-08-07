import { links, navigation } from "@/config"
import { BookHeartIcon, GitBranchIcon, MoreVerticalIcon, RssIcon } from "lucide-react"
import { Fragment } from "react"

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

type MenuEntry = {
  key: string
  label: string
  href: string
  external?: boolean
  icon?: React.ReactNode
}

const entries: MenuEntry[] = [
  {
    key: "friends",
    label: navigation.friends.label,
    href: navigation.friends.href,
    icon: <BookHeartIcon />,
  },
  {
    key: "rss",
    label: "RSS 订阅",
    href: links.rss.href,
    external: true,
    icon: <RssIcon />,
  },
  {
    key: "github",
    label: "GitHub",
    href: links.github.href,
    external: true,
    icon: <GitBranchIcon />,
  },
]

/**
 * 导航下拉菜单：友链 / RSS / GitHub。
 * 放在桌面端 SearchBox 与 ThemeToggle 之间。
 */
export default function NavMenu() {
  return (
    <DropdownMenu>
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
        {entries.map((entry, i) => (
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
