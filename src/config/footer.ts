/** Footer 底部 meta 块配置（备案号 / RSS / Sitemap / 开源 / 驱动 / Cloudflare） */
export const footer = {
  beian: {
    tea: {
      text: "茶ICP备2025080144号",
      href: "https://icp.redcha.cn/beian/ICP-2025080144.html",
    },
    moe: {
      text: "萌ICP备20256087号",
      href: "https://icp.gov.moe/?keyword=20256087",
    },
  },
  rssHref: "/rss.xml",
  sitemapHref: "/sitemap-index.xml",
  openSource: { text: "已开源" },
  driver: {
    astro: { text: "Astro", href: "https://astro.build" },
  },
  cloudflare: {
    text: "经 Cloudflare 构建并部署至全球 Cloudflare CDN 节点",
    href: "https://www.cloudflare.com",
  },
} as const
