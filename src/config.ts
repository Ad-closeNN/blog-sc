export const site = {
  name: "Ad_closeNN 的小站",
  shortName: "Ad_closeNN",
  description: "Ad_closeNN の 小站，时不时会刷新一些野生东西",
  url: "https://blog.adclosenn.top",
  locale: "zh_CN",
  language: "zh-CN",
  avatarSrc: "/images/avatar.jpg",
  copyright: "© 2025-present Ad_closeNN.",
} as const

export const navigation = {
  home: { label: "首页", href: "/" },
  posts: { label: "博文", href: "/posts/" },
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
} as const
