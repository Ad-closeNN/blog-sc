// @ts-check
/**
 * remark-callout
 * 把两种写法统一转成 callout：
 *   1. remark-directive 的容器指令 `:::type[标题] ... :::`
 *   2. GitHub 块引用式告警 `> [!TYPE]标题 ...`
 *
 * 两种写法的语义差异（与 GitHub 对齐）：
 *   `:::tip[xxx]` + 正文        → 标题 xxx，正文是 :::
 *   `> [!TIP]xxx` + 后续 `>` 行 → 标题 xxx，正文是后续行
 *   `> [!TIP]`   + 后续 `>` 行 → 默认标题，整个块（含首段）都是正文
 * 即 marker 同行有文字就把它当标题（等价 `:::type[xxx]`），没文字就整块当正文。
 * 判定只发生在「块引用首个节点是以 [!TYPE] 开头的文本段落」时，其余引用原样保留。
 *
 * remark-directive 的 text directive（单冒号 `:name`）会误伤正文里的
 * 合法时间格式（如 `6:40` → textDirective name=40）。该插件在转换容器指令的
 * 同时，把所有非容器的 textDirective / leafDirective 还原为原始文本
 * （从 markdown 源经 position 精确切回），避免 `6:40` 被渲染成空 <div>。
 *
 * 支持类型（大小写不敏感）：tip / note / info / warning / caution / important
 * - 方括号标题 [xxx] 作为 callout 标题；省略时用类型默认标题。
 * - 两种写法产出同一套 <aside class="callout callout-{type}">，共用 global.css 样式。
 * - `> [!TIP]` 写法的标题保留行内格式（`**粗体**`、`code` 等）；`:::tip[xxx]`
 *   的标题仍按纯文本取（与原先一致）。两者正文的行内格式均正常渲染。
 */

/** @typedef {'tip'|'note'|'info'|'warning'|'caution'|'important'} CalloutType */

/** @type {Record<CalloutType, { title: string }>} */
const CALLOUT_META = {
  tip: { title: "提示" },
  note: { title: "笔记" },
  info: { title: "信息" },
  warning: { title: "注意" },
  caution: { title: "警告" },
  important: { title: "重要" },
}

/**
 * @param {string} raw
 * @returns {CalloutType | null}
 */
function normalizeType(raw) {
  const key = String(raw || "").toLowerCase()
  return key in CALLOUT_META ? /** @type {CalloutType} */ (key) : null
}

/**
 * GitHub 块引用式告警的 marker token：`[!TYPE]`。
 * 只匹配 token 本身（不含同行标题），标题交给 splitAdmonitionLine 按行拆。
 */
const ADMONITION_RE = /^\[!([A-Za-z]+)\]/

/**
 * 去掉行内节点首尾空白（只处理 text 节点边界，行内格式节点原样保留）。
 * @param {any[]} nodes
 * @returns {any[]}
 */
function trimInline(nodes) {
  const out = nodes.slice()
  while (out.length && out[0].type === "text" && !String(out[0].value).trim()) {
    out.shift()
  }
  if (out.length && out[0].type === "text") {
    out[0] = { type: "text", value: String(out[0].value).replace(/^\s+/, "") }
  }
  while (
    out.length &&
    out[out.length - 1].type === "text" &&
    !String(out[out.length - 1].value).trim()
  ) {
    out.pop()
  }
  if (out.length && out[out.length - 1].type === "text") {
    const last = out.length - 1
    out[last] = {
      type: "text",
      value: String(out[last].value).replace(/\s+$/, ""),
    }
  }
  return out
}

/**
 * 把块引用首段按「marker 所在行」拆成标题行内节点与正文行内节点。
 * 标题 = marker 同一行剩余部分（因此支持 `**粗体**` 等行内格式）；
 * 正文 = 其余内容。以首个含换行的 text 节点为界：换行前归标题、换行后归正文。
 * @param {any} paragraph
 * @param {RegExpMatchArray} matched
 * @returns {{ titleNodes: any[], bodyNodes: any[] }}
 */
function splitAdmonitionLine(paragraph, matched) {
  const children = paragraph.children
  // 切掉首节点开头的 `[!TYPE]` token，剩下的即标题行内容
  children[0].value = String(children[0].value).slice(matched[0].length)

  const titleNodes = []
  const bodyNodes = []
  let inBody = false
  for (const child of children) {
    if (inBody) {
      bodyNodes.push(child)
      continue
    }
    if (child.type === "text") {
      const value = String(child.value ?? "")
      const nl = value.indexOf("\n")
      if (nl === -1) {
        titleNodes.push(child)
        continue
      }
      // 换行即标题行结束：换行前归标题，换行后归正文
      if (nl > 0) titleNodes.push({ type: "text", value: value.slice(0, nl) })
      const tail = value.slice(nl + 1)
      if (tail) bodyNodes.push({ type: "text", value: tail })
      inBody = true
      continue
    }
    titleNodes.push(child)
  }
  return { titleNodes: trimInline(titleNodes), bodyNodes }
}

/**
 * 从块引用里识别 GitHub 式告警 marker。
 * 只认「首个节点是 paragraph、其首个子节点是 text、且 text 以 [!TYPE] 开头」，
 * 且该文本在原文里没有反斜杠转义（`\[!TIP]` 不触发 —— mdast 的 text.value
 * 会吃掉反斜杠，只能拿 position 回查源串）。
 * 匹配基于 text.value 而非源串切片：块引用后续行的 `>` 前缀只存在于源码里，
 * 按 value 匹配才不会把 `> ` 混进正文。
 * @param {any} node - blockquote 节点
 * @param {string} source - 原文
 * @returns {{ type: CalloutType, paragraph: any, matched: RegExpMatchArray } | null}
 */
function matchAdmonition(node, source) {
  const paragraph = Array.isArray(node.children) ? node.children[0] : null
  if (!paragraph || paragraph.type !== "paragraph") return null
  const first = Array.isArray(paragraph.children) ? paragraph.children[0] : null
  if (!first || first.type !== "text") return null
  const value = String(first.value ?? "")
  if (!value.startsWith("[!")) return null

  // 原文该位置是反斜杠 → 转义写法，不识别
  const offset = first.position?.start?.offset
  if (typeof offset === "number" && source[offset] === "\\") return null

  const matched = ADMONITION_RE.exec(value)
  if (!matched) return null
  const type = normalizeType(matched[1])
  if (!type) return null

  return { type, paragraph, matched }
}

/**
 * 构造 callout 标题段（两种写法共用）。
 * @param {any[]} children - 标题行内节点
 * @returns {any}
 */
function titleParagraph(children) {
  return {
    type: "paragraph",
    data: { hProperties: { className: ["callout-title"] } },
    children,
  }
}

/**
 * 由纯文本构造标题段（容器指令写法，标题恒为纯文本）。
 * @param {string} text
 * @returns {any}
 */
function textTitleParagraph(text) {
  return titleParagraph([{ type: "text", value: text }])
}

/**
 * 把节点标记为 callout：用 mdast-util-to-hast 的 data.hName / data.hProperties
 * 钩子让 remark-rehype 输出 <aside class="callout callout-{type}">，
 * children 由默认 handler 正常递归转换。
 * @param {any} node
 * @param {CalloutType} type
 */
function markAsCallout(node, type) {
  node.data = node.data || {}
  node.data.hName = "aside"
  node.data.hProperties = {
    className: ["callout", `callout-${type}`],
  }
}

/**
 * 提取并移除容器指令里的 directiveLabel（标题）子节点。
 * remark-directive 把 `:::type[标题]` 的标题放在 children 首个 paragraph，
 * 并标记 data.directiveLabel = true。
 * @param {any} node
 * @returns {{ title: string, rest: any[] }}
 */
function extractLabel(node) {
  const children = Array.isArray(node.children) ? node.children : []
  let title = ""
  const rest = []
  for (const child of children) {
    if (!title && child && child.data && child.data.directiveLabel) {
      // 拼接标题文本（label 内可能含行内格式，取纯文本即可）
      title = textOf(child)
      continue
    }
    rest.push(child)
  }
  return { title, rest }
}

/**
 * 递归取 mdast 节点纯文本。
 * @param {any} node
 * @returns {string}
 */
function textOf(node) {
  if (!node) return ""
  if (node.type === "text") return String(node.value || "")
  if (Array.isArray(node.children)) return node.children.map(textOf).join("")
  return ""
}

/**
 * 从原 markdown 源精确切出一个带 position 的节点的原始文本。
 * 用于把被 remark-directive 拆解的 textDirective（如 `:40`）还原。
 * @param {string} source
 * @param {any} node
 * @returns {string | null}
 */
function rawSlice(source, node) {
  if (!node || !node.position) return null
  const start = node.position.start.offset
  const end = node.position.end.offset
  if (typeof start !== "number" || typeof end !== "number") return null
  return source.slice(start, end)
}

// 卡片 uuid 计数器（构建期递增，确定性，避免 Math.random 在重建时抖动）
let githubCardSeq = 0

/**
 * 生成 GitHub 仓库卡片的原始 HTML（含前端 fetch 脚本）。
 * @param {string} repo - "owner/repo" 格式仓库名
 * @returns {string}
 */
function githubCardHtml(repo) {
  const uuid = `gc${(githubCardSeq++).toString(36)}${Date.now().toString(36).slice(-4)}`
  const owner = repo.split("/")[0] ?? ""
  const cardHref = `https://github.com/${repo}`
  // GitHub 仓库卡片的结构与内联脚本
  return [
    `<a id="${uuid}-card" class="card-github fetch-waiting" href="${cardHref}" target="_blank" rel="noopener noreferrer">`,
    `  <div class="gc-titlebar">`,
    `    <div class="gc-titlebar-left">`,
    `      <div class="gc-owner"><div id="${uuid}-avatar" class="gc-avatar"></div><span class="gc-user">${owner}</span></div>`,
    `      <div class="gc-slash">/</div>`,
    `      <div class="gc-repo">${repo.split("/")[1] ?? ""}</div>`,
    `    </div>`,
    `    <div class="github-logo"></div>`,
    `  </div>`,
    `  <div id="${uuid}-description" class="gc-description">加载中…</div>`,
    `  <div class="gc-infobar">`,
    `    <div id="${uuid}-stars" class="gc-stars">--</div>`,
    `    <div id="${uuid}-forks" class="gc-forks">--</div>`,
    `    <div id="${uuid}-license" class="gc-license">--</div>`,
    `    <span id="${uuid}-language" class="gc-language">--</span>`,
    `  </div>`,
    `<script type="text/javascript" defer>`,
    `  ;(function(){`,
    `    var el = document;`,
    `    function set(id, txt){ var e = el.getElementById(id); if (e) e.textContent = txt; }`,
    `    fetch('https://api.github.com/repos/${repo}', { referrerPolicy: "no-referrer" })`,
    `      .then(function(r){ return r.json() })`,
    `      .then(function(data){`,
    `        set('${uuid}-description', (data.description || "No description").replace(/:[a-zA-Z0-9_]+:/g, ''));`,
    `        set('${uuid}-language', data.language || "");`,
    `        set('${uuid}-stars', (data.stargazers_count != null) ? format(data.stargazers_count) : "--");`,
    `        set('${uuid}-forks', (data.forks != null) ? format(data.forks) : "--");`,
    `        set('${uuid}-license', data.license ? data.license.spdx_id || "LICENSE" : "No license");`,
    `        var av = el.getElementById('${uuid}-avatar');`,
    `        if (av && data.owner && data.owner.avatar_url) {`,
    `          av.style.backgroundImage = "url(" + data.owner.avatar_url + ")";`,
    `          av.style.backgroundColor = "transparent";`,
    `        }`,
    `        var c = el.getElementById('${uuid}-card');`,
    `        if (c) c.classList.remove("fetch-waiting");`,
    `      })`,
    `      .catch(function(){`,
    `        var c = el.getElementById('${uuid}-card');`,
    `        if (c) c.classList.add("fetch-error");`,
    `        set('${uuid}-description', "加载失败");`,
    `      });`,
    `    function format(n){`,
    `      try { return Intl.NumberFormat('en-US', { notation: "compact", maximumFractionDigits: 1 }).format(n).replace(/\\u202f/g, ''); }`,
    `      catch (e) { return String(n); }`,
    `    }`,
    `  })();`,
    `</script>`,
    `</a>`,
  ].join("\n")
}

export function remarkCallout() {
  /**
   * @param {any} tree
   * @param {any} file
   */
  return (tree, file) => {
    const source = String(file.value ?? "")

    /**
     * @param {any} node
     * @param {number} index
     * @param {any} parent
     */
    const visit = (node, index, parent) => {
      if (!node || typeof node !== "object") return

      if (node.type === "containerDirective") {
        const type = normalizeType(node.name)
        if (type) {
          const { title, rest } = extractLabel(node)
          const meta = CALLOUT_META[type]

          // 标题段放在 callout 正文之前
          node.children = [
            textTitleParagraph(title || meta.title),
            ...rest,
          ]
          markAsCallout(node, type)
        }
      } else if (node.type === "blockquote") {
        // GitHub 式 `> [!TYPE]标题` → 同一套 callout
        const hit = matchAdmonition(node, source)
        if (hit) {
          const { type, paragraph, matched } = hit
          // 按 marker 所在行拆出标题行内节点与正文；标题行内格式（**粗体**等）保留
          const { titleNodes, bodyNodes } = splitAdmonitionLine(paragraph, matched)
          if (bodyNodes.length) {
            paragraph.children = bodyNodes
          } else {
            // 该段没有正文（标题独占一行）→ 移除空段，避免渲染出空 <p>
            node.children.shift()
          }
          node.children.unshift(
            titleParagraph(
              titleNodes.length
                ? titleNodes
                : [{ type: "text", value: CALLOUT_META[type].title }]
            )
          )
          markAsCallout(node, type)
        }
      } else if (
        (node.type === "textDirective" || node.type === "leafDirective") &&
        parent &&
        Array.isArray(parent.children)
      ) {
        // ::github{repo="owner/repo"} → 渲染 GitHub 仓库卡片
        if (node.type === "leafDirective" && node.name === "github") {
          const repo = String(node.attributes?.repo ?? "").trim()
          if (repo && repo.includes("/")) {
            parent.children.splice(index, 1, {
              type: "html",
              value: githubCardHtml(repo),
            })
            return
          }
        }
        // 非容器指令：还原为原始正文文本（如 `6:40` 里的 `:40`），
        // 避免被渲染成空 <div>
        const raw = rawSlice(source, node)
        if (raw !== null) {
          parent.children.splice(index, 1, {
            type: "text",
            value: raw,
          })
        }
        // 注意：替换后不再递归该节点（它已是 text）
        return
      }

      if (Array.isArray(node.children)) {
        node.children.forEach(
          /** @param {any} child @param {number} i */
          (child, i) => visit(child, i, node)
        )
      }
    }

    visit(tree, -1, null)
    return tree
  }
}
