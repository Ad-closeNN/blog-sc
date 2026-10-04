/* 为文章生成 AI 摘要。迁移并适配自同级 blog-fuwari 的维护脚本。 */

import fs from "node:fs/promises"
import http from "node:http"
import https from "node:https"
import path from "node:path"
import readline from "node:readline"
import { fileURLToPath } from "node:url"

const repoRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  ".."
)
const postsDir = path.join(repoRoot, "src", "content", "posts")
// 不内置服务商与模型：全部由 --api_url / --api_key / --model 或交互式表单提供，
// 避免服务下线、模型受限或凭据写死导致脚本静默失效。
const batchDelayMs = 1500
const frontmatterRegex = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?/
// 环境变量里的 API Key 兜底（优先级低于 --api_key，高于交互提问）
const envApiKey =
  process.env.SUMMARY_API_KEY || process.env.OPENAI_API_KEY || ""

function printHelp() {
  console.log(`用法：
  pnpm summary                                          交互式填写配置并选文章
  pnpm summary --api_url <URL> [--api_key <KEY>] --model <模型> [-- <文章>]
  pnpm summary:all   --api_url <URL> [--api_key <KEY>] --model <模型>
  pnpm summary:force --api_url <URL> [--api_key <KEY>] --model <模型>

选项：
  --api_url <URL>    OpenAI 兼容服务的地址。填基地址即可，脚本自动补 /chat/completions，
                     例如 https://api.openai.com/v1、https://api.deepseek.com/v1。
                     若你填的已含 /chat/completions 则原样使用。
  --api_key <KEY>    API 密钥。省略时依次回退到环境变量（SUMMARY_API_KEY、OPENAI_API_KEY）、
                     再不行则交互式隐藏输入提问。
  --model <模型名>     模型名，如 gpt-4o-mini、deepseek-chat。
  --all              为缺少摘要的文章批量生成（跳过已有摘要的）。
  --force            与 --all 同用时强制重写全部文章摘要。
  --help             显示本帮助。

说明：
  - 三个配置项（api_url / api_key / model）任一缺失时会就地交互提问，已有参数则跳过。
  - 文章路径相对于 src/content/posts，可省略 .md / .mdx 扩展名。
  - 生成时会将所选文章的正文发送至你指定的第三方服务。
  - 单篇和交互模式会覆盖已有摘要；--all 默认跳过已有摘要的文章。

请求格式（OpenAI 兼容 /chat/completions）：
  { model, messages: [{ role: "user", content }], max_tokens, stream: false }
  响应取 choices[0].message.content。`)
}

function escapeRegex(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
}

/**
 * 把用户给的地址规范成完整的 chat/completions 端点。
 * 填基地址（https://api.openai.com/v1）→ 自动补 /chat/completions；
 * 已含 /chat/completions 则原样使用。
 * @param {string} input
 * @returns {URL}
 */
function resolveApiEndpoint(input) {
  const raw = String(input || "").trim()
  if (!raw) throw new Error("API 地址不能为空")

  let url
  try {
    url = new URL(raw)
  } catch {
    throw new Error(`API 地址格式不正确：${raw}`)
  }
  if (!/^https?:$/.test(url.protocol)) {
    throw new Error(`API 地址必须是 http/https：${raw}`)
  }

  // 去掉末尾斜杠后再判断，避免 /v1/ 这种写法漏判
  const path = url.pathname.replace(/\/+$/, "")
  if (!path.endsWith("/chat/completions")) {
    url.pathname = `${path}/chat/completions`
  } else {
    url.pathname = path
  }
  return url
}

function parseAiSummaryValue(value) {
  const trimmed = value.trim()
  if (!trimmed) return null

  if (trimmed.startsWith('"')) {
    try {
      return JSON.parse(trimmed)
    } catch {
      return trimmed
    }
  }

  return trimmed
}

function extractAiSummary(frontmatter) {
  const summaryMatch = frontmatter.match(/^aiSummary:[ \t]*(.*)$/m)
  if (!summaryMatch) return null

  const inlineValue = summaryMatch[1].trim()
  if (inlineValue !== ">" && inlineValue !== "|") {
    return parseAiSummaryValue(inlineValue)
  }

  const afterSummary = frontmatter.slice(
    summaryMatch.index + summaryMatch[0].length
  )
  const blockLines = []

  for (const line of afterSummary.split(/\r?\n/)) {
    if (!line.startsWith(" ") && line.trim()) break
    blockLines.push(line.replace(/^ {1,2}/, ""))
  }

  return blockLines.join("\n").trim() || null
}

function formatFrontmatterField(key, value) {
  return `${key}: ${JSON.stringify(value.replace(/\r?\n/g, " "))}`
}

function upsertFrontmatterField(frontmatter, key, value, eol = "\n") {
  const fieldPattern = new RegExp(
    `^${escapeRegex(key)}:[ \\t]*(?:[^\\r\\n]*(?:\\r?\\n[ \\t]+[^\\r\\n]*)*)?`,
    "m"
  )
  const formattedField = formatFrontmatterField(key, value)

  return fieldPattern.test(frontmatter)
    ? frontmatter.replace(fieldPattern, formattedField)
    : `${frontmatter.trimEnd()}${eol}${formattedField}`
}

function stripAdmonitionMarkers(text) {
  return text
    .replace(
      /^:::(note|tip|important|caution|warning)(?:\[[^\]]*\])?\s*$/gim,
      ""
    )
    .replace(/^:::\s*$/gm, "")
    .replace(/^>\s*\[!(note|tip|important|caution|warning)\]\s*$/gim, "")
    .replace(/^\s*\[!(note|tip|important|caution|warning)\]\s*/gim, "")
}

function cleanGeneratedSummary(summary) {
  return stripAdmonitionMarkers(summary)
    .replace(
      /^(note|tip|important|caution|warning|警告|注意|提示)[：:\s-]+/i,
      ""
    )
    .replace(/\s+/g, " ")
    .trim()
}

async function walkPosts(dir, relativeDir = "") {
  const entries = await fs.readdir(dir, { withFileTypes: true })
  const files = []

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name)
    const relativePath = path.posix.join(relativeDir, entry.name)

    if (entry.isDirectory()) {
      files.push(...(await walkPosts(fullPath, relativePath)))
    } else if (entry.isFile() && /\.mdx?$/i.test(entry.name)) {
      files.push(relativePath)
    }
  }

  return files.sort((a, b) => a.localeCompare(b, "en"))
}

function resolvePostPath(postPath) {
  const normalized = postPath.replaceAll("\\", "/")
  const resolved = path.resolve(postsDir, normalized)
  const relative = path.relative(postsDir, resolved)

  if (
    !relative ||
    path.isAbsolute(relative) ||
    relative === ".." ||
    relative.startsWith(`..${path.sep}`)
  ) {
    return null
  }

  return resolved
}

async function readPost(fileName) {
  const fullPath = resolvePostPath(fileName)
  if (!fullPath) {
    throw new Error(`文章路径无效：${fileName}`)
  }

  const content = await fs.readFile(fullPath, "utf8")
  return { fullPath, content }
}

async function getCurrentAiSummary(fileName) {
  const { content } = await readPost(fileName)
  const match = content.match(frontmatterRegex)
  return match ? extractAiSummary(match[1]) : null
}

function createInterface() {
  return readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  })
}

/**
 * 交互式询问一行输入（正常回显）。
 * @param {string} question
 * @returns {Promise<string>}
 */
function askLine(question) {
  return new Promise((resolve) => {
    const rl = createInterface()
    rl.question(`${question}: `, (answer) => {
      rl.close()
      resolve(answer.trim())
    })
  })
}

/**
 * 交互式询问密钥：raw 模式逐字符读取，只回显星号，避免密钥出现在屏幕上。
 * 不用 rl.question + 覆写 _writeToOutput —— Node 24 的 readline 回显不再走
 * 那个私有方法，覆写无效（实测密钥会原样回显）。
 * @param {string} question
 * @returns {Promise<string>}
 */
function askSecret(question) {
  return new Promise((resolve, reject) => {
    // 与 selectFile 同源的两个坑：raw 状态必须在改动前读；onKey 用函数声明
    // 以便 cleanup 能在同一作用域引用到它。
    const wasRaw = process.stdin.isRaw
    const wasPaused = process.stdin.isPaused()
    process.stdout.write(`${question}: `)

    readline.emitKeypressEvents(process.stdin)
    process.stdin.setRawMode(true)
    process.stdin.resume()

    let value = ""

    const cleanup = () => {
      process.stdin.removeListener("keypress", onKey)
      process.stdin.setRawMode(Boolean(wasRaw))
      if (wasPaused) process.stdin.pause()
      else process.stdin.resume()
    }

    function onKey(str, key = {}) {
      if (key.ctrl && (key.name === "c" || key.name === "d")) {
        cleanup()
        process.stdout.write("\n")
        reject(new Error("已取消"))
        return
      }
      if (key.name === "return" || key.name === "enter") {
        cleanup()
        process.stdout.write("\n")
        resolve(value.trim())
        return
      }
      if (key.name === "backspace") {
        if (value) {
          value = value.slice(0, -1)
          process.stdout.write("\b \b")
        }
        return
      }
      if (key.name === "escape" || key.ctrl || key.meta) return
      if (str) {
        value += str
        process.stdout.write("*")
      }
    }

    process.stdin.on("keypress", onKey)
  })
}

/**
 * 补齐缺失的 api_url / api_key / model（已有参数则跳过，不重复提问）。
 * 非交互终端下缺项直接报错，避免管道里静默挂起。
 * @param {{ apiUrl?: string, apiKey?: string, model?: string }} input
 * @returns {Promise<{ endpoint: URL, apiKey: string, model: string }>}
 */
async function resolveConfig(input) {
  let apiUrl = input.apiUrl?.trim() || ""
  let apiKey = input.apiKey?.trim() || envApiKey
  let model = input.model?.trim() || ""

  const missing = []
  if (!apiUrl) missing.push("--api_url")
  if (!apiKey) missing.push("--api_key")
  if (!model) missing.push("--model")
  if (missing.length === 0) {
    return { endpoint: resolveApiEndpoint(apiUrl), apiKey, model }
  }

  if (!process.stdin.isTTY || !process.stdout.isTTY) {
    throw new Error(
      `非交互终端缺少配置：${missing.join(", ")}\n请补全参数，或改用交互终端运行；API Key 也可用环境变量 SUMMARY_API_KEY / OPENAI_API_KEY 提供。`
    )
  }

  console.log("填写生成摘要所需的配置（已有参数的项目会跳过）：\n")
  if (!apiUrl) {
    apiUrl = await askLine(
      "API URL（OpenAI 兼容基地址，如 https://api.openai.com/v1）"
    )
  }
  if (!apiKey) apiKey = await askSecret("API Key（输入不回显）")
  if (!model) model = await askLine("模型名（如 gpt-4o-mini）")

  const endpoint = resolveApiEndpoint(apiUrl)
  if (!apiKey) throw new Error("API Key 不能为空")
  if (!model) throw new Error("模型名不能为空")
  console.log(`\n✔ 配置完成：${endpoint.href} · ${model}\n`)
  return { endpoint, apiKey, model }
}

async function selectFile(files) {
  if (!process.stdin.isTTY || !process.stdout.isTTY) {
    throw new Error("非交互终端请指定文章，例如：pnpm summary -- folo_verify")
  }

  // 必须在 createInterface() 之前读：readline 构造函数会立刻把 stdin 设为 raw，
  // 之后再读 isRaw 拿到的是 true，cleanup 就恢复不回用户终端原本的状态。
  const wasRaw = process.stdin.isRaw
  const wasPaused = process.stdin.isPaused()
  const rl = createInterface()
  const summaries = new Map(
    await Promise.all(
      files.map(async (file) => [file, await getCurrentAiSummary(file)])
    )
  )
  let selectedIndex = 0
  let closed = false
  // 由下方 Promise executor 赋值，供 onKey / cancel 使用
  let resolveSelection
  let rejectSelection

  readline.emitKeypressEvents(process.stdin, rl)
  process.stdin.setRawMode(true)

  const cleanup = () => {
    if (closed) return
    closed = true
    process.stdin.removeListener("keypress", onKey)
    process.stdout.write("\x1b[?25h")
    // rl.close() 会把 stdin 恢复为「创建 rl 前」的 raw 状态并可能暂停它；
    // 先把它关掉，再按进入前的真实状态还原。
    rl.close()
    process.stdin.setRawMode(Boolean(wasRaw))
    if (wasPaused) process.stdin.pause()
    else process.stdin.resume()
  }

  const draw = () => {
    const rows = process.stdout.rows || 24
    const listHeight = Math.max(5, rows - 8)
    const start = Math.min(
      Math.max(0, selectedIndex - Math.floor(listHeight / 2)),
      Math.max(0, files.length - listHeight)
    )
    const visibleFiles = files.slice(start, start + listHeight)
    let output = "\x1b[?25l\x1b[2J\x1b[H"
    output += "选择文章（↑/↓ 或 j/k 移动，Enter 确认，q/Esc 取消）\n\n"

    visibleFiles.forEach((file, offset) => {
      const index = start + offset
      const currentSummary = summaries.get(file)
      const prefix = index === selectedIndex ? "❯" : " "
      const hasSummary = currentSummary ? "  已有摘要" : ""
      output += `${prefix} ${file}${hasSummary}\n`
    })

    const currentFile = files[selectedIndex]
    const currentSummary = summaries.get(currentFile)
    output += `\n${selectedIndex + 1}/${files.length} ${currentFile}\n`
    if (currentSummary) output += `当前摘要：${currentSummary}\n`

    process.stdout.write(output)
  }

  const cancel = () => {
    cleanup()
    rejectSelection(new Error("已取消"))
  }

  // 函数声明（非 const）以便 cleanup 能在同一作用域引用到它
  function onKey(_str, key = {}) {
    if (key.ctrl && key.name === "c") return cancel()

    if (key.name === "up" || key.name === "k") {
      selectedIndex = Math.max(0, selectedIndex - 1)
      draw()
      return
    }

    if (key.name === "down" || key.name === "j") {
      selectedIndex = Math.min(files.length - 1, selectedIndex + 1)
      draw()
      return
    }

    if (key.name === "return") {
      const selectedFile = files[selectedIndex]
      cleanup()
      resolveSelection(selectedFile)
      return
    }

    if (key.name === "escape" || key.name === "q") cancel()
  }

  return new Promise((resolve, reject) => {
    resolveSelection = resolve
    rejectSelection = reject
    process.stdin.on("keypress", onKey)
    draw()
  })
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function getRetryAfterMs(value) {
  if (!value) return null

  const seconds = Number(value)
  if (Number.isFinite(seconds)) return Math.max(0, seconds * 1000)

  const timestamp = Date.parse(value)
  return Number.isFinite(timestamp) ? Math.max(0, timestamp - Date.now()) : null
}

function getRetryDelayMs(error, attempt) {
  const retryAfterMs = getRetryAfterMs(error.retryAfter)
  if (retryAfterMs !== null) return Math.min(retryAfterMs, 120000)

  const exponentialDelay = 3000 * 2 ** (attempt - 1)
  const jitter = Math.floor(Math.random() * 1000)
  return Math.min(exponentialDelay + jitter, 120000)
}

function shouldRetry(error) {
  return (
    !error.statusCode || error.statusCode === 429 || error.statusCode >= 500
  )
}

/**
 * @param {string} requestBody
 * @param {URL} endpoint
 * @param {string} apiKey
 */
function requestSummary(requestBody, endpoint, apiKey) {
  // http/https 各用对应模块，否则 http:// 的地址会握手失败
  const transport = endpoint.protocol === "http:" ? http : https
  return new Promise((resolve, reject) => {
    const request = transport.request(
      {
        hostname: endpoint.hostname,
        port: endpoint.port || undefined,
        path: `${endpoint.pathname}${endpoint.search}`,
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
      },
      (response) => {
        let data = ""

        response.on("data", (chunk) => {
          data += chunk
        })

        response.on("end", () => {
          if (response.statusCode !== 200) {
            const error = new Error(`HTTP ${response.statusCode}`)
            error.statusCode = response.statusCode
            error.retryAfter = response.headers["retry-after"]
            error.responseBody = data.slice(0, 500)
            reject(error)
            return
          }

          try {
            const text = JSON.parse(data).choices?.[0]?.message?.content

            if (!text?.trim()) throw new Error("响应中没有可用的摘要文本")
            resolve(text.trim())
          } catch (error) {
            reject(error)
          }
        })
      }
    )

    request.on("error", reject)
    request.write(requestBody)
    request.end()
  })
}

/**
 * @param {string} fileName
 * @param {{ endpoint: URL, apiKey: string, model: string }} config
 */
async function generateSummary(fileName, config) {
  const { endpoint, apiKey, model } = config
  const { fullPath, content } = await readPost(fileName)
  const frontmatterMatch = content.match(frontmatterRegex)
  if (!frontmatterMatch) {
    throw new Error("文章缺少 frontmatter，已跳过以避免生成无效内容")
  }

  const bodyOriginal = content.slice(frontmatterMatch[0].length)
  const bodyForAI = stripAdmonitionMarkers(bodyOriginal).trim()
  if (!bodyForAI) throw new Error("文章正文为空，无法生成摘要")

  const prompt = `请为以下博客文章生成一个不超过100字的中文摘要。

输出要求：
- 只输出摘要正文，不要解释，不要加标题。
- 摘要必须以“本文介绍了”开头。
- 使用一句话概括文章主题、关键内容和用途。
- 不要输出 Markdown 语法、admonition 标记或提示框类型，例如 :::warning、:::caution、[!warning]、警告、注意。

文章内容：
${bodyForAI}`
  const requestBody = JSON.stringify({
    model,
    messages: [{ role: "user", content: prompt }],
    max_tokens: 500,
    stream: false,
    reasoning: { effort: "minimal" },
  })

  console.log("\n生成 AI 摘要中…\n")

  const maxAttempts = 6
  let summary = ""
  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      summary = cleanGeneratedSummary(
        await requestSummary(requestBody, endpoint, apiKey)
      )
      if (!summary) throw new Error("清理后的摘要为空")
      break
    } catch (error) {
      if (!shouldRetry(error) || attempt === maxAttempts) {
        if (error.responseBody) console.error("服务响应：", error.responseBody)
        throw error
      }

      const delayMs = getRetryDelayMs(error, attempt)
      console.warn(
        `请求失败：${error.message}；${Math.ceil(delayMs / 1000)} 秒后重试（${attempt}/${maxAttempts - 1}）`
      )
      await sleep(delayMs)
    }
  }

  const eol = content.includes("\r\n") ? "\r\n" : "\n"
  const bodySeparator = frontmatterMatch[0].endsWith("\r\n")
    ? "\r\n"
    : frontmatterMatch[0].endsWith("\n")
      ? "\n"
      : ""
  const frontmatter = frontmatterMatch[1]
  const newFrontmatter = upsertFrontmatterField(
    upsertFrontmatterField(frontmatter, "aiSummary", summary, eol),
    "aiSummaryModel",
    model,
    eol
  )
  const newContent = `---${eol}${newFrontmatter}${eol}---${bodySeparator}${bodyOriginal}`

  await fs.writeFile(fullPath, newContent, "utf8")
  return summary
}

/**
 * @param {string[]} files
 * @param {{ force?: boolean, endpoint: URL, apiKey: string, model: string }} options
 */
async function generateMissingSummaries(
  files,
  { force = false, endpoint, apiKey, model } = {}
) {
  const currentSummaries = new Map(
    await Promise.all(
      files.map(async (file) => [file, await getCurrentAiSummary(file)])
    )
  )
  const pendingFiles = force
    ? files
    : files.filter((file) => !currentSummaries.get(file))

  if (pendingFiles.length === 0) {
    console.log("所有文章都已有 AI 摘要")
    return
  }

  if (force) {
    console.log(`将强制为 ${pendingFiles.length} 篇文章重新生成 AI 摘要。\n`)
  } else {
    console.log(
      `将为 ${pendingFiles.length} 篇文章生成 AI 摘要，跳过 ${files.length - pendingFiles.length} 篇已有摘要的文章。\n`
    )
  }

  const failedFiles = []
  for (const [index, file] of pendingFiles.entries()) {
    console.log(`[${index + 1}/${pendingFiles.length}] ${file}`)

    try {
      const summary = await generateSummary(file, { endpoint, apiKey, model })
      console.log(`完成：${summary}\n`)
      if (index < pendingFiles.length - 1) await sleep(batchDelayMs)
    } catch (error) {
      failedFiles.push({ file, message: error.message })
      console.error(`失败：${file} - ${error.message}\n`)
    }
  }

  if (failedFiles.length > 0) {
    console.error("以下文章生成失败：")
    for (const { file, message } of failedFiles) {
      console.error(`- ${file}: ${message}`)
    }
    process.exitCode = 1
  }
}

function parseArguments(args) {
  const flags = new Set()
  const values = new Map()
  const positional = []
  const valueFlags = new Set(["--model", "--api_url", "--api_key"])

  for (let i = 0; i < args.length; i += 1) {
    const arg = args[i]
    if (arg === "--") continue
    if (valueFlags.has(arg)) {
      const value = args[i + 1]
      if (value === undefined || value.startsWith("--")) {
        throw new Error(`${arg} 需要一个值`)
      }
      values.set(arg, value)
      i += 1
      continue
    }
    if (arg.startsWith("--")) flags.add(arg)
    else positional.push(arg)
  }

  const allowedFlags = new Set(["--all", "--force", "--help"])
  const unknownFlags = [...flags].filter((flag) => !allowedFlags.has(flag))
  if (unknownFlags.length > 0) {
    throw new Error(`未知参数：${unknownFlags.join(", ")}`)
  }
  if (flags.has("--help")) return { help: true }
  if (positional.length > 1) throw new Error("一次只能指定一篇文章")
  if (flags.has("--all") && positional.length > 0) {
    throw new Error("--all 不能与指定文章同时使用")
  }

  return {
    all: flags.has("--all"),
    force: flags.has("--force"),
    target: positional[0],
    apiUrl: values.get("--api_url"),
    apiKey: values.get("--api_key"),
    model: values.get("--model"),
  }
}

async function resolveTargetFile(input, files) {
  const raw = input.replaceAll("\\", "/")
  const candidates = /\.mdx?$/i.test(raw) ? [raw] : [`${raw}.md`, `${raw}.mdx`]
  const target = candidates.find((candidate) => files.includes(candidate))

  if (!target) throw new Error(`文章不存在：${input}`)
  return target
}

async function main() {
  const options = parseArguments(process.argv.slice(2))
  if (options.help) {
    printHelp()
    return
  }

  const config = await resolveConfig({
    apiUrl: options.apiUrl,
    apiKey: options.apiKey,
    model: options.model,
  })

  const files = await walkPosts(postsDir)
  if (files.length === 0) throw new Error("没有找到任何文章文件")

  if (options.all) {
    await generateMissingSummaries(files, { force: options.force, ...config })
    return
  }

  const target = options.target
    ? await resolveTargetFile(options.target, files)
    : await selectFile(files)
  const summary = await generateSummary(target, config)
  console.log(`AI 摘要已生成：\n${summary}`)
}

main().catch((error) => {
  if (error.message === "已取消") {
    console.log("已取消")
  } else {
    console.error(`错误：${error.message}`)
    process.exitCode = 1
  }
})
