import {
  BookHeartIcon,
  BookOpenIcon,
  GitBranchIcon,
  RssIcon,
} from "lucide-react"

import { links, navigation, site } from "@/config"

export type MenuEntry = {
  key: string
  label: string
  href: string
  external?: boolean
  icon?: React.ReactNode
}

/**
 * 导航功能入口（归档 / 友链 / RSS / GitHub）。
 * 桌面端 NavMenu 下拉与移动端抽屉「快捷入口」共用此数据，
 * 改一处两端同步。含 JSX 图标节点，属组件级渲染数据，故放组件目录而非 config.ts。
 */
export const navEntries: MenuEntry[] = [
  {
    key: "posts",
    label: navigation.posts.label,
    href: navigation.posts.href,
    icon: <BookOpenIcon />,
  },
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
    // 指向本仓库（Ad-closeNN/blog-sc），与 SiteFooter「博客代码已开源」同源；
    // links.github.href 是个人主页，留给 index.astro 的 JSON-LD sameAs 用
    href: `https://github.com/${site.githubRepo}`,
    external: true,
    icon: <GitBranchIcon />,
  },
]
