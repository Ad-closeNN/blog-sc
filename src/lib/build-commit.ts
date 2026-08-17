import { site } from "@/config"

export type BuildCommit = {
  sha: string
  shortSha: string
  branch?: string
  url: string
}

/**
 * 构建期注入的当前 commit。
 * Workers Builds 自动注入 WORKERS_CI_COMMIT_SHA / WORKERS_CI_BRANCH，
 * 本地 dev / 未注入时返回 null，前端显示 dev。
 */
export function getBuildCommit(): BuildCommit | null {
  const env = import.meta.env as Record<string, string | undefined>
  const sha = env.WORKERS_CI_COMMIT_SHA
  if (!sha) return null
  return {
    sha,
    shortSha: sha.slice(0, 7),
    branch: env.WORKERS_CI_BRANCH,
    url: `https://github.com/${site.githubRepo}/commit/${sha}`,
  }
}
