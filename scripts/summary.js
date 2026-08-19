/* 为文章生成 AI 摘要。迁移并适配自同级 blog-fuwari 的维护脚本。 */

import fs from "node:fs/promises"
import https from "node:https"
import path from "node:path"
import readline from "node:readline"
import { fileURLToPath } from "node:url"

const repoRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  ".."
)
const postsDir = path.join(repoRoot, "src", "content", "posts")
const summaryModel = "deepseek-v4-flash-free"
const apiUrl = new URL("https://opencode.ai/zen/v1/responses")
const batchDelayMs = 1500
const frontmatterRegex = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?/

function printHelp() {
  console.log(`用法：
  pnpm summary                         交互选择一篇文章并重新生成摘要
  pnpm summary -- <文章路径或名称>       为指定文章重新生成摘要
  pnpm summary:all                     为缺少摘要的全部文章生成摘要
  pnpm summary:force                   强制重写全部文章摘要

说明：
  - 文章路径相对于 src/content/posts，可省略 .md / .mdx 扩展名。
  - 生成时会将所选文章的正文发送至 OpenCode Zen 第三方服务。
  - 单篇和交互模式会覆盖已有摘要；--all 默认跳过已有摘要的文章。`)
}

function escapeRegex(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
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

async function selectFile(files) {
  if (!process.stdin.isTTY || !process.stdout.isTTY) {
    throw new Error("非交互终端请指定文章，例如：pnpm summary -- folo_verify")
  }

  const rl = createInterface()
  const summaries = new Map(
    await Promise.all(
      files.map(async (file) => [file, await getCurrentAiSummary(file)])
    )
  )
  const wasRaw = process.stdin.isRaw
  let selectedIndex = 0
  let closed = false

  readline.emitKeypressEvents(process.stdin, rl)
  process.stdin.setRawMode(true)

  const cleanup = () => {
    if (closed) return
    closed = true
    process.stdin.removeListener("keypress", onKey)
    process.stdin.setRawMode(Boolean(wasRaw))
    process.stdout.write("\x1b[?25h")
    rl.close()
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

  return new Promise((resolve, reject) => {
    const cancel = () => {
      cleanup()
      reject(new Error("已取消"))
    }

    const onKey = (_str, key = {}) => {
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
        resolve(selectedFile)
        return
      }

      if (key.name === "escape" || key.name === "q") cancel()
    }

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

function requestSummary(requestBody) {
  return new Promise((resolve, reject) => {
    const request = https.request(
      {
        hostname: apiUrl.hostname,
        path: `${apiUrl.pathname}${apiUrl.search}`,
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: "Bearer public",
          "anthropic-version": "2023-06-01",
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
            const output = JSON.parse(data).output
            const message = output?.find((item) => item.type === "message")
            const text = message?.content?.find(
              (item) => item.type === "output_text"
            )?.text

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

async function generateSummary(fileName) {
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
    model: summaryModel,
    input: [
      {
        role: "user",
        content: [{ type: "input_text", text: prompt }],
      },
    ],
    max_output_tokens: 500,
    stream: false,
    reasoning: { effort: "minimal" },
  })

  console.log("\n生成 AI 摘要中…\n")

  const maxAttempts = 6
  let summary = ""
  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      summary = cleanGeneratedSummary(await requestSummary(requestBody))
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
    summaryModel,
    eol
  )
  const newContent = `---${eol}${newFrontmatter}${eol}---${bodySeparator}${bodyOriginal}`

  await fs.writeFile(fullPath, newContent, "utf8")
  return summary
}

async function generateMissingSummaries(files, { force = false } = {}) {
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
      const summary = await generateSummary(file)
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
  const positional = []

  for (const arg of args) {
    if (arg === "--") continue
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

  const files = await walkPosts(postsDir)
  if (files.length === 0) throw new Error("没有找到任何文章文件")

  if (options.all) {
    await generateMissingSummaries(files, { force: options.force })
    return
  }

  const target = options.target
    ? await resolveTargetFile(options.target, files)
    : await selectFile(files)
  const summary = await generateSummary(target)
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
