// @ts-check
/**
 * remark-callout
 * 把 remark-directive 解析出的容器指令 `:::type[标题] ... :::` 转成 callout。
 *
 * 支持类型（大小写不敏感）：tip / note / info / warning / caution / important
 * - 方括号标题 [xxx] 作为 callout 标题；省略时用类型默认标题。
 * - 通过 mdast-util-to-hast 的 data.hName / data.hProperties 钩子让 remark-rehype
 *   输出 <aside class="callout callout-{type}">…，children 正常递归转换。
 *
 * 标题节点（data.directiveLabel）会被提到 callout 首部并用 <p class="callout-title"> 包裹。
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

export function remarkCallout() {
  /**
   * @param {any} tree
   */
  return (tree) => {
    /**
     * @param {any} node
     */
    const visit = (node) => {
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
      }

      if (Array.isArray(node.children)) {
        node.children.forEach(
          /** @param {any} child */ (child) => visit(child)
        )
      }
    }

    visit(tree)
  }
}
