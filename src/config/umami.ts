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
