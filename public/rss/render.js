/**
 * RSS feed 可读页面。
 *
 * /rss.xml 在根元素后注入了带 XHTML 命名空间的 <script src="/rss/render.js">，
 * 浏览器直接打开 feed 时执行本脚本，把 XML 改写成可读列表页。RSS 阅读器在
 * 服务端抓取、不执行脚本，feed 语义不受影响。
 *
 * 这套做法替代已废弃的 XSLT（Chrome 158 / 2026-11-17 起 Stable 关闭）。
 *
 * 实机验证过的两个关键结论（headless Chromium，XML 文档下）：
 *   1. document.open() 会抛 InvalidStateError: Only HTML documents support
 *      open() —— XML 文档不支持，不能用。
 *   2. documentElement.replaceWith() 可行，且替换后 <style> 正常生效
 *      （计算样式实测：font-size / color / letter-spacing / oklch / min() 全部应用）。
 *
 * 全程用 createElementNS + textContent 构建 DOM，不做字符串拼接 ——
 * 文本自动转义，无 XSS 风险。
 */
;(function () {
  var XHTML = "http://www.w3.org/1999/xhtml"

  /** 建 XHTML 元素；传 text 时用 textContent 赋值（自动转义） */
  function el(tag, text) {
    var node = document.createElementNS(XHTML, tag)
    if (text != null && text !== "") node.textContent = text
    return node
  }

  /**
   * 取直接子元素的文本。
   * 只认无命名空间的子节点：RSS 的 <link> 命名空间为 null，而 <atom:link>
   * 的 localName 同样是 "link"，靠 namespaceURI 区分才不会取错。
   */
  function childText(parent, name) {
    var kids = parent.childNodes
    for (var i = 0; i < kids.length; i++) {
      var node = kids[i]
      if (node.nodeType === 1 && node.localName === name && !node.namespaceURI) {
        return (node.textContent || "").trim()
      }
    }
    return ""
  }

  /** 取直接子元素中同名节点的文本列表（如多个 <category>） */
  function childTexts(parent, name) {
    var out = []
    var kids = parent.childNodes
    for (var i = 0; i < kids.length; i++) {
      var node = kids[i]
      if (node.nodeType === 1 && node.localName === name && !node.namespaceURI) {
        var text = (node.textContent || "").trim()
        if (text) out.push(text)
      }
    }
    return out
  }

  /** RFC 822（Sat, 30 May 2026 00:00:00 GMT）→ 2026-05-30；解析失败原样返回 */
  function formatDate(value) {
    if (!value) return ""
    var date = new Date(value)
    if (isNaN(date.getTime())) return value
    var month = String(date.getUTCMonth() + 1).padStart(2, "0")
    var day = String(date.getUTCDate()).padStart(2, "0")
    return date.getUTCFullYear() + "-" + month + "-" + day
  }

  // 配色直接抄 src/styles/global.css 的 oklch token（无彩度 neutral 灰）。
  // feed 页面读不到站点的 localStorage 主题，深色只能跟随系统。
  var CSS = [
    ":root{",
    "--bg:oklch(1 0 0);--fg:oklch(0.145 0 0);--card:oklch(1 0 0);",
    "--muted:oklch(0.97 0 0);--muted-fg:oklch(0.556 0 0);",
    "--border:oklch(0.922 0 0);--primary:oklch(0.205 0 0);",
    "}",
    "@media(prefers-color-scheme:dark){:root{",
    "--bg:oklch(0.145 0 0);--fg:oklch(0.985 0 0);--card:oklch(0.205 0 0);",
    "--muted:oklch(0.269 0 0);--muted-fg:oklch(0.708 0 0);",
    "--border:oklch(1 0 0 / 10%);--primary:oklch(0.922 0 0);",
    "}}",
    "*,*::before,*::after{box-sizing:border-box;margin:0;padding:0}",
    "body{background:var(--bg);color:var(--fg);line-height:1.7;",
    'font-family:"Inter Variable","misans-web-vf-font","PingFang SC",',
    '"Microsoft YaHei",sans-serif}',
    ".wrap{max-width:min(760px,calc(100% - 32px));margin:0 auto;",
    "padding:2.5rem 0 4rem}",
    ".head{display:flex;align-items:center;gap:1rem;margin-bottom:1.5rem}",
    ".avatar{width:56px;height:56px;border-radius:50%;",
    "border:1px solid var(--border);flex-shrink:0}",
    '.name{font-family:"Geist Variable","Inter Variable",sans-serif;',
    "font-size:1.375rem;font-weight:600;line-height:1.25;",
    "letter-spacing:-0.01em}",
    ".tagline{color:var(--muted-fg);font-size:0.9rem;margin-top:0.25rem}",
    ".hint{background:var(--muted);border:1px solid var(--border);",
    "border-radius:12px;padding:0.875rem 1rem;margin-bottom:1.25rem;",
    "font-size:0.875rem;color:var(--muted-fg)}",
    ".hint strong{color:var(--fg);font-weight:600}",
    '.hint code{font-family:"Cascadia Mono",ui-monospace,SFMono-Regular,',
    'Menlo,Monaco,Consolas,monospace;font-size:0.8125rem;',
    "background:var(--card);border:1px solid var(--border);",
    "border-radius:6px;padding:0.15em 0.4em;word-break:break-all;",
    "display:inline-block;margin-top:0.5rem}",
    ".back{display:inline-block;margin-bottom:2rem;font-size:0.875rem;",
    "color:var(--muted-fg);text-decoration:none}",
    ".back:hover{color:var(--fg)}",
    ".post{padding:1.375rem 0;border-bottom:1px solid var(--border)}",
    ".post:last-child{border-bottom:none}",
    '.post-title{font-family:"Geist Variable","Inter Variable",sans-serif;',
    "font-size:1.0625rem;font-weight:600;line-height:1.4;",
    "margin-bottom:0.5rem}",
    ".post-title a{color:var(--fg);text-decoration:none}",
    ".post-title a:hover{text-decoration:underline;",
    "text-underline-offset:3px}",
    ".meta{display:flex;align-items:center;flex-wrap:wrap;gap:0.5rem;",
    "margin-bottom:0.5rem}",
    // 与站点 .eyebrow 一致的小字样式
    ".date{font-size:0.75rem;letter-spacing:0.08em;text-transform:uppercase;",
    "color:var(--muted-fg)}",
    ".chip{font-size:0.75rem;color:var(--muted-fg);background:var(--muted);",
    "border:1px solid var(--border);border-radius:6px;",
    "padding:0.1em 0.5em;line-height:1.6}",
    ".excerpt{font-size:0.9rem;color:var(--muted-fg);line-height:1.65}",
    ".count{font-size:0.75rem;letter-spacing:0.08em;",
    "text-transform:uppercase;color:var(--muted-fg);",
    "padding-bottom:0.75rem;border-bottom:1px solid var(--border)}",
  ].join("")

  function render() {
    var channel = document.querySelector("channel")
    if (!channel) return // 不是标准 RSS，静默退出，保留原始 XML 视图

    var siteTitle = childText(channel, "title") || "RSS Feed"
    var siteDesc = childText(channel, "description")

    var html = el("html")
    html.setAttribute("lang", "zh-CN")

    var head = el("head")
    var meta = el("meta")
    meta.setAttribute("charset", "UTF-8")
    head.appendChild(meta)
    var viewport = el("meta")
    viewport.setAttribute("name", "viewport")
    viewport.setAttribute("content", "width=device-width, initial-scale=1")
    head.appendChild(viewport)
    head.appendChild(el("title", siteTitle + " · RSS 订阅"))
    head.appendChild(el("style", CSS))
    html.appendChild(head)

    var body = el("body")
    var wrap = el("div")
    wrap.setAttribute("class", "wrap")

    // ── 头部：头像 + 站点名 + 简介 ──
    var header = el("header")
    header.setAttribute("class", "head")
    var avatar = el("img")
    avatar.setAttribute("class", "avatar")
    avatar.setAttribute("src", "/images/avatar.jpg")
    avatar.setAttribute("alt", siteTitle + " 的头像")
    header.appendChild(avatar)
    var titleBox = el("div")
    var name = el("div", siteTitle)
    name.setAttribute("class", "name")
    titleBox.appendChild(name)
    if (siteDesc) {
      var tagline = el("div", siteDesc)
      tagline.setAttribute("class", "tagline")
      titleBox.appendChild(tagline)
    }
    header.appendChild(titleBox)
    wrap.appendChild(header)

    // ── 订阅提示 ──
    var hint = el("div")
    hint.setAttribute("class", "hint")
    hint.appendChild(document.createTextNode("这是 "))
    hint.appendChild(el("strong", "RSS 全文订阅源"))
    hint.appendChild(
      document.createTextNode("，把下面这个地址粘进阅读器即可订阅：")
    )
    hint.appendChild(el("br"))
    hint.appendChild(el("code", location.href))
    wrap.appendChild(hint)

    // ── 回站点首页 ──
    // 用相对路径 "/" 而不是 channel <link> 的绝对地址：feed 里那个是
    // 生产域名，本地 preview 时点它会跳去线上站。相对路径始终留在当前源。
    var back = el("a", "← 返回站点首页")
    back.setAttribute("class", "back")
    back.setAttribute("href", "/")
    wrap.appendChild(back)

    // ── 条目列表：只用 description 摘要，不渲染 content:encoded（全文太长）──
    var items = channel.getElementsByTagName("item")
    var list = el("main")

    var count = el("div", "共 " + items.length + " 篇")
    count.setAttribute("class", "count")
    list.appendChild(count)

    for (var i = 0; i < items.length; i++) {
      var item = items[i]
      var post = el("article")
      post.setAttribute("class", "post")

      var itemTitle = childText(item, "title")
      var itemLink = childText(item, "link")
      var heading = el("h2")
      heading.setAttribute("class", "post-title")
      if (itemLink) {
        var link = el("a", itemTitle)
        link.setAttribute("href", itemLink)
        heading.appendChild(link)
      } else {
        heading.textContent = itemTitle
      }
      post.appendChild(heading)

      var meta2 = el("div")
      meta2.setAttribute("class", "meta")
      var pubDate = formatDate(childText(item, "pubDate"))
      if (pubDate) {
        var time = el("time", pubDate)
        time.setAttribute("class", "date")
        meta2.appendChild(time)
      }
      var cats = childTexts(item, "category")
      for (var c = 0; c < cats.length; c++) {
        var chip = el("span", cats[c])
        chip.setAttribute("class", "chip")
        meta2.appendChild(chip)
      }
      if (meta2.childNodes.length > 0) post.appendChild(meta2)

      var excerpt = childText(item, "description")
      if (excerpt) {
        var para = el("p", excerpt)
        para.setAttribute("class", "excerpt")
        post.appendChild(para)
      }

      list.appendChild(post)
    }

    wrap.appendChild(list)
    body.appendChild(wrap)
    html.appendChild(body)

    // 替换整个文档根元素。实测 <style> 在此之后仍正常生效。
    document.documentElement.replaceWith(html)
  }

  // 脚本在 XML 解析中途执行时 <channel> 可能还没就绪，等 DOM 完成再跑
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", render)
  } else {
    render()
  }
})()
