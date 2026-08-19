/* 审计并按显式命令删除未被文章引用的 public/pic 图片。 */

import fs from "node:fs/promises"
import path from "node:path"
import { fileURLToPath } from "node:url"

const repoRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  ".."
)
const postsDir = path.join(repoRoot, "src", "content", "posts")
const picturesDir = path.join(repoRoot, "public", "pic")
const defaultAllowlistPath = path.join(repoRoot, "scripts", "pic-allowlist.txt")
const picReferencePattern =
  /(?:https?:\/\/blog\.adclosenn\.top)?\/(?:public\/)?pic\/([^\s"'`<>?#)]+)(?:[?#][^\s"'`<>)]*)?/g

function printHelp() {
  console.log(`用法：
  pnpm images:check
  pnpm images:clean
  node scripts/clean-unused-pictures.js [--delete] [--allowlist <路径>]

说明：
  - 默认仅检查 src/content/posts/**/*.md(x) 对 public/pic/ 的引用，不会改动文件。
  - --delete 是唯一会删除候选图片的参数；遇到断裂引用或无效允许名单时会拒绝删除。
  - 允许名单每行填写相对 public/pic/ 的精确路径，也可填写 /pic/ 开头的路径。
  - 图片被其他页面、运行时逻辑或尚未迁入的文章使用时，请先加入允许名单。`)
}

function formatBytes(bytes) {
  if (bytes < 1024) return `${bytes} B`
  const units = ["KB", "MB", "GB"]
  let value = bytes / 1024
  let index = 0

  while (value >= 1024 && index < units.length - 1) {
    value /= 1024
    index += 1
  }

  return `${value.toFixed(value >= 10 ? 0 : 1)} ${units[index]}`
}

function isPathInside(parent, child) {
  const relative = path.relative(parent, child)
  return (
    relative !== "" &&
    !relative.startsWith(`..${path.sep}`) &&
    relative !== ".." &&
    !path.isAbsolute(relative)
  )
}

function normalizePicturePath(rawPath) {
  let value = rawPath.trim().replaceAll("\\", "/")
  value = value.split(/[?#]/, 1)[0]

  if (value.startsWith("/public/pic/")) {
    value = value.slice("/public/pic/".length)
  } else if (value.startsWith("/pic/")) {
    value = value.slice("/pic/".length)
  }

  if (!value || value.startsWith("/") || /^[A-Za-z]:/.test(value)) {
    return { error: "路径必须相对 public/pic/" }
  }

  let decoded
  try {
    decoded = decodeURIComponent(value).replaceAll("\\", "/")
  } catch {
    return { error: "路径包含无效 URL 编码" }
  }

  if (decoded.includes("\0")) {
    return { error: "路径包含无效字符" }
  }

  const segments = decoded.split("/")
  if (segments.includes("..")) {
    return { error: "路径越出了 public/pic/" }
  }

  const normalized = path.posix.normalize(decoded)
  if (
    normalized === "." ||
    normalized === ".." ||
    normalized.startsWith("../") ||
    path.posix.isAbsolute(normalized)
  ) {
    return { error: "路径越出了 public/pic/" }
  }

  return { path: normalized }
}

async function walk(dir, relativeDir = "") {
  const entries = await fs.readdir(dir, { withFileTypes: true })
  const files = []

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name)
    const relativePath = path.posix.join(relativeDir, entry.name)

    if (entry.isDirectory()) {
      files.push(...(await walk(fullPath, relativePath)))
    } else if (entry.isFile()) {
      const stat = await fs.stat(fullPath)
      files.push({ path: relativePath, fullPath, size: stat.size })
    }
  }

  return files
}

async function getPostFiles() {
  const entries = await walk(postsDir)
  return entries
    .filter((entry) => /\.mdx?$/i.test(entry.path))
    .sort((a, b) => a.path.localeCompare(b.path, "en"))
}

function extractReferences(content, postPath) {
  const references = []
  picReferencePattern.lastIndex = 0

  for (const match of content.matchAll(picReferencePattern)) {
    const normalized = normalizePicturePath(match[1])
    if (normalized.path) {
      references.push({ path: normalized.path, postPath })
    } else {
      references.push({ error: normalized.error, raw: match[0], postPath })
    }
  }

  return references
}

async function readAllowlist(allowlistPath) {
  const content = await fs.readFile(allowlistPath, "utf8")
  const paths = []
  const errors = []

  for (const [index, rawLine] of content.split(/\r?\n/).entries()) {
    const line = rawLine.trim()
    if (!line || line.startsWith("#")) continue

    const normalized = normalizePicturePath(line)
    if (normalized.path) {
      paths.push({ path: normalized.path, line: index + 1 })
    } else {
      errors.push({ line: index + 1, value: line, error: normalized.error })
    }
  }

  return { paths, errors }
}

function parseArguments(args) {
  let deleteFiles = false
  let allowlistPath = defaultAllowlistPath

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index]

    if (arg === "--delete") {
      deleteFiles = true
    } else if (arg === "--allowlist") {
      const suppliedPath = args[index + 1]
      if (!suppliedPath || suppliedPath.startsWith("--")) {
        throw new Error("--allowlist 需要一个文件路径")
      }
      allowlistPath = path.resolve(repoRoot, suppliedPath)
      index += 1
    } else if (arg === "--help") {
      return { help: true }
    } else {
      throw new Error(`未知参数：${arg}`)
    }
  }

  return { deleteFiles, allowlistPath }
}

function printList(title, items) {
  if (items.length === 0) return

  console.log(`\n${title}（${items.length}）`)
  for (const item of items) console.log(`  - ${item}`)
}

async function main() {
  const options = parseArguments(process.argv.slice(2))
  if (options.help) {
    printHelp()
    return
  }

  const [posts, pictures, allowlist] = await Promise.all([
    getPostFiles(),
    walk(picturesDir),
    readAllowlist(options.allowlistPath),
  ])
  const pictureMap = new Map(pictures.map((picture) => [picture.path, picture]))
  const references = []

  for (const post of posts) {
    const content = await fs.readFile(post.fullPath, "utf8")
    references.push(...extractReferences(content, post.path))
  }

  const invalidReferences = references.filter((reference) => reference.error)
  const referencedPaths = new Set(
    references
      .filter((reference) => reference.path)
      .map((reference) => reference.path)
  )
  const missingReferences = [...referencedPaths]
    .filter((reference) => !pictureMap.has(reference))
    .sort((a, b) => a.localeCompare(b, "en"))
  const missingAllowlistPaths = allowlist.paths
    .filter(({ path: picturePath }) => !pictureMap.has(picturePath))
    .sort((a, b) => a.path.localeCompare(b.path, "en"))
  const allowedPaths = new Set(
    allowlist.paths
      .filter(({ path: picturePath }) => pictureMap.has(picturePath))
      .map(({ path: picturePath }) => picturePath)
  )
  const candidates = pictures
    .filter(
      (picture) =>
        !referencedPaths.has(picture.path) && !allowedPaths.has(picture.path)
    )
    .sort((a, b) => a.path.localeCompare(b.path, "en"))

  console.log("图片引用审计")
  console.log(`  文章：${posts.length} 篇`)
  console.log(
    `  图片：${pictures.length} 个（${formatBytes(pictures.reduce((sum, picture) => sum + picture.size, 0))}）`
  )
  console.log(`  文章引用：${referencedPaths.size} 个唯一路径`)
  console.log(`  允许名单保留：${allowedPaths.size} 个`)
  console.log(
    `  删除候选：${candidates.length} 个（${formatBytes(candidates.reduce((sum, picture) => sum + picture.size, 0))}）`
  )

  printList(
    "文章中的断裂图片引用",
    missingReferences.map((picturePath) => `/pic/${picturePath}`)
  )
  printList(
    "无效的文章图片引用",
    invalidReferences.map(
      (reference) =>
        `${reference.postPath}: ${reference.raw}（${reference.error}）`
    )
  )
  printList(
    "无效的允许名单条目",
    allowlist.errors.map(
      (entry) =>
        `${options.allowlistPath}:${entry.line}: ${entry.value}（${entry.error}）`
    )
  )
  printList(
    "允许名单中不存在的图片",
    missingAllowlistPaths.map(
      (entry) => `${options.allowlistPath}:${entry.line}: ${entry.path}`
    )
  )
  printList(
    options.deleteFiles ? "将删除的图片" : "待清理候选（默认不会删除）",
    candidates.map((picture) => picture.path)
  )

  const hasDiagnostics =
    missingReferences.length > 0 ||
    invalidReferences.length > 0 ||
    allowlist.errors.length > 0 ||
    missingAllowlistPaths.length > 0

  if (hasDiagnostics) {
    console.error("\n发现引用或允许名单问题，未执行删除。")
    process.exitCode = 1
    return
  }

  if (!options.deleteFiles) {
    console.log("\n检查完成。确认候选无误后，执行 pnpm images:clean 删除。")
    return
  }

  for (const picture of candidates) {
    const resolvedPath = path.resolve(picturesDir, picture.path)
    if (!isPathInside(picturesDir, resolvedPath)) {
      throw new Error(`拒绝删除目录外路径：${picture.path}`)
    }
    await fs.unlink(resolvedPath)
    console.log(`已删除：${picture.path}`)
  }

  console.log(`\n已删除 ${candidates.length} 个图片文件。`)
}

main().catch((error) => {
  console.error(`错误：${error.message}`)
  process.exitCode = 1
})
