// ==================== site / navigation / links ====================

export const site = {
  name: "Ad_closeNN 的小站",
  shortName: "Ad_closeNN",
  description: "Ad_closeNN 的小站，专注于技术分享和记录生活",
  url: "https://blog.adclosenn.top",
  locale: "zh_CN",
  language: "zh-CN",
  avatarSrc: "/images/avatar.jpg",
  copyright: "© 2025-present Ad_closeNN.",
  // owner/repo 格式，非完整 URL；使用处拼 https://github.com/${githubRepo}
  githubRepo: "Ad-closeNN/blog-sc",
} as const

export const navigation = {
  home: { label: "首页", href: "/" },
  posts: { label: "文章", href: "/posts/" },
  friends: { label: "友链", href: "/friends/" },
} as const

export const navigationItems = Object.values(navigation)

export const links = {
  me: {
    label: "个人站",
    value: "me.adclosenn.top",
    href: "https://me.adclosenn.top",
    external: true,
  },
  github: {
    label: "GitHub",
    value: "Ad-closeNN",
    href: "https://github.com/Ad-closeNN",
    external: true,
  },
  x: {
    label: "X",
    value: "Ad_closeNN",
    href: "https://x.com/Ad_closeNN",
    external: true,
  },
  email: {
    label: "电子邮箱",
    value: "adclosenn@qq.com",
    href: "mailto:adclosenn@qq.com",
    external: false,
  },
  rss: {
    label: "RSS 订阅",
    value: "/rss.xml",
    href: "/rss.xml",
    external: false,
  },
} as const

// ==================== footer ====================

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

// ==================== profile ====================

/** 作者信息：侧栏迷你头像卡与友链页「本站友链信息」共用 */
export const profile = {
  avatar: "/images/avatar.jpg",
  name: "Ad_closeNN",
  bio: "永远相信美好的事情即将发生",
  links: [
    { name: "GitHub", href: "https://github.com/Ad-closeNN" },
    { name: "X", href: "https://x.com/Ad_closeNN" },
    { name: "Email", href: "mailto:adclosenn@qq.com" },
    { name: "RSS", href: "/rss.xml" },
  ],
} as const

// ==================== friends ====================

export type Friend = {
  name: string
  url: string
  avatar: string
  description: string
  group?: string
}

/**
 * 友链数据（迁移自旧 blog-fuwari 站 friends.astro）。
 * fuwari 里失效的本地头像 /assets/... 已替换为对应站点 favicon 或 GitHub favicon。
 */
export const friends: Friend[] = [
  // —— 站点伙伴 ——
  {
    name: "Cloudflare",
    url: "https://www.cloudflare.com",
    avatar: "https://www.cloudflare-cn.com/favicon.ico",
    description: "本站使用的托管平台 | CDN&赛博菩萨",
    group: "站点伙伴",
  },
  {
    name: "OpenAI ChatGPT",
    url: "https://chatgpt.com",
    avatar: "https://cdn.oaistatic.com/assets/favicon-l4nq08hd.svg",
    description: "这玩意难道有时候不比脑子好使",
    group: "站点伙伴",
  },
  {
    name: "Google Gemini",
    url: "https://gemini.google.com",
    avatar: "https://www.gstatic.com/lamda/images/gemini_sparkle_aurora_33f86dc0c0257da337c63.svg",
    description: "这是真好用",
    group: "站点伙伴",
  },
  {
    name: "Visual Studio Code",
    url: "https://code.visualstudio.com",
    avatar: "https://code.visualstudio.com/assets/favicon.ico",
    description: "轻量编辑器中的真神",
    group: "站点伙伴",
  },
  {
    name: "GitHub",
    url: "https://github.com",
    avatar: "https://github.com/favicon.ico",
    description: "在单一协作平台上构建和交付软件",
    group: "站点伙伴",
  },
  {
    name: "一言",
    url: "https://hitokoto.cn",
    avatar: "https://hitokoto.cn/favicon.ico",
    description: "把一些句子汇聚起来，形成一言网络，以传递更多的感动",
    group: "站点伙伴",
  },
  {
    name: "茶备案",
    url: "https://icp.redcha.cn",
    avatar: "https://icp.redcha.cn/favicon.ico",
    description:
      "茶备案致力于打造一个经典的互联网同盟会，希望可以和站长朋友们一起学习交流",
    group: "站点伙伴",
  },
  {
    name: "萌国ICP备案",
    url: "https://icp.gov.moe",
    avatar: "https://icp.gov.moe/images/ico64.png",
    description:
      "嗯，你没看错，这是萌国的ICP备案。萌国在哪呢，听某萌主说，好像是个异次元上的国度。萌主就爱给人组cp,俗称icp我们说的是萌国ICP备案，号称萌ICP备，简称萌备",
    group: "站点伙伴",
  },
  // —— 朋友博客 ——
  {
    name: "《二叉树树》官方网站",
    url: "https://2x.nz",
    avatar: "https://q2.qlogo.cn/headimg_dl?dst_uin=2726730791&spec=0",
    description: "爱你所爱~ ❤",
    group: "朋友博客",
  },
  {
    name: "Anson 主页",
    url: "https://ansonq.com",
    avatar: "https://ansonq.com/src/tx.png",
    description: "Anson 的国际导航页",
    group: "朋友博客",
  },
  {
    name: "五道口宇宙中心",
    url: "https://bbos.me",
    avatar: "https://bbos.me/favicon.ico",
    description: "什么都想了解一点",
    group: "朋友博客",
  },
  {
    name: "MC_Kero 的 blog",
    url: "https://blog.mckero.com",
    avatar:
      "https://i0.hdslb.com/bfs/face/96a6399dffe9e203d3afcc83fe5af3377830fa19.png",
    description: "依稀当年泪目干！",
    group: "朋友博客",
  },
  {
    name: "wyf9's Blog",
    url: "https://wyf9.top",
    avatar: "https://wyf9.top/favicon.png",
    description: "什么都有的个人 blog?",
    group: "朋友博客",
  },
  {
    name: "AUNyaの小窝",
    url: "https://tbmiao.dpdns.org",
    avatar: "https://tbmiao.dpdns.org/favicon.ico",
    description: "一个热爱二次元的小萌新~",
    group: "朋友博客",
  },
  {
    name: "lenmei233's blog",
    url: "https://blog.lenmei233.top",
    avatar: "https://blog.lenmei233.top/images/avatar.png",
    description: "A person who loves coding, Welcome to my blog!",
    group: "朋友博客",
  },
  {
    name: "天码行空的小破站",
    url: "https://cs.gt.tc",
    avatar:
      "https://weavatar.com/avatar/75f9692805b439a703cabc302b85a47d07a9c67a0879c346aa70342fd5ccc596?s=96&r=g",
    description: "To be bright~",
    group: "朋友博客",
  },
  {
    name: "YaoBlog",
    url: "https://blog.yaooa.cn",
    avatar: "https://blog.yaooa.cn/_astro/avatar.CKWOOGoY_ZSc86z.webp",
    description: "不知道干什么就只有摆烂了",
    group: "朋友博客",
  },
  {
    name: "Clina's Blog",
    url: "https://blog.150191.xyz",
    avatar:
      "https://i0.hdslb.com/bfs/im_new/a5d3aa9f94ce663d9c2530d9f568ced61059364724.webp",
    description: "¡El pueblo unido jamás será vencido!",
    group: "朋友博客",
  },
  {
    name: "xhc861's Blog",
    url: "https://xhc861.top",
    avatar: "https://xhc861.top/favicon.ico",
    description: "博客，远不止于博客~",
    group: "朋友博客",
  },
  {
    name: "Horean's Blog",
    url: "https://blog.hxrch.top",
    avatar: "https://img.hxrch.top/bfav256.webp",
    description: "Spread the knowledge wisely & widely.",
    group: "朋友博客",
  },
  {
    name: "RATING3PRO Today",
    url: "https://www.xie.today",
    avatar: "https://www.xie.today/images/avatar.jpg",
    description: "潜水",
    group: "朋友博客",
  },
  {
    name: "MeowCata 小站",
    url: "https://meowcata.top",
    avatar: "https://meowcata.top/assets/avatar.jpg",
    description: "化学 × 随手记 × 心得 × 随缘更",
    group: "朋友博客",
  },
  {
    name: "AkiNard Blog",
    url: "https://blog.578113.xyz",
    avatar: "https://image.578113.xyz/img/skyceria.jpg",
    description: "艾拉酱世界第一可爱！",
    group: "朋友博客",
  },
  {
    name: "雪诺的小博客",
    url: "https://blog.4365754.xyz",
    avatar: "https://photos.4365754.xyz/ac0cf34feb992487db7e63382418382dba213210.jpg",
    description: "分享关于网络的众多有趣的小知识",
    group: "朋友博客",
  },
]

export const friendsApply = {
  title: "将您的网站加入本站友链板块",
  description: "请自行提交 GitHub Issue",
  issueUrl: "https://github.com/Ad-closeNN/form/issues/new?template=friends-link.yml",
} as const

// ==================== ga ====================

/**
 * Google Analytics (GA4) 配置。
 * 沿用旧 blog-fuwari 站的衡量 ID；enable:false 时不注入任何脚本。
 */
export const gaConfig = {
  enable: true,
  measurementId: "G-YRCGFG45C1",
} as const

// ==================== umami ====================

/**
 * Umami 站点统计配置。
 * 当前沿用旧 blog-fuwari 站的 id（websiteId 埋点 / shareId 读统计），
 * 因此统计到的是 fuwari 站的数据；待为 blog-sc 新建站点后替换这两个值。
 */
export const umamiConfig = {
  enable: true,
  baseUrl: "https://umami.adclosenn.top",
  websiteId: "7610548d-677b-40cb-9ebd-31dc14e16be7",
  shareId: "jME4HFb9JmfJM5zs",
  timezone: "Asia/Shanghai",
} as const
