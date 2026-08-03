// @ts-check
/**
 * remark-callout
 * 把 remark-directive 解析出的容器指令 `:::type[标题] ... :::` 转成 callout。
 *
 * remark-directive 的 text directive（单冒号 `:name`）会误伤正文里的
 * 合法时间格式（如 `6:40` → textDirective name=40）。该插件在转换容器指令的
 * 同时，把所有非容器的 textDirective / leafDirective 还原为原始文本
 * （从 markdown 源经 position 精确切回），避免 `6:40` 被渲染成空 <div>。
 *
 * 支持类型（大小写不敏感）：tip / note / info / warning / caution / important
 * - 方括号标题 [xxx] 作为 callout 标题；省略时用类型默认标题。
 * - 通过 mdast-util-to-hast 的 data.hName / data.hProperties 钩子让 remark-rehype
 *   输出 <aside class="callout callout-{type}">…，children 正常递归转换。
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
 * 生成 fuwari 同款 GitHub 仓库卡片的原始 HTML（含前端 fetch 脚本）。
 * @param {string} repo - "owner/repo" 格式仓库名
 * @returns {string}
 */
function githubCardHtml(repo) {
  const uuid = `gc${(githubCardSeq++).toString(36)}${Date.now().toString(36).slice(-4)}`
  const owner = repo.split("/")[0] ?? ""
  const cardHref = `https://github.com/${repo}`
  // 来自 fuwari rehype-component-github-card.mjs 的结构与内联脚本
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
          const titleText = title || meta.title

          // 标题段：放在 callout 正文之前，作为 callout-title
          const titleParagraph = {
            type: "paragraph",
            data: { hProperties: { className: ["callout-title"] } },
            children: [{ type: "text", value: titleText }],
          }

          // 用 data.hName / data.hProperties 让 remark-rehype 输出 <aside>
          node.data = node.data || {}
          node.data.hName = "aside"
          node.data.hProperties = {
            className: ["callout", `callout-${type}`],
          }
          node.children = [titleParagraph, ...rest]
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
