import { useCallback, useSyncExternalStore } from "react"

import { searchStore, type SearchResult } from "@/lib/search"

/**
 * 站内搜索逻辑 hook：桌面下拉与移动抽屉共用。
 * 返回搜索状态（status）与搜索函数（search）。
 * 不持有 query / results——具体输入态由各调用组件自管。
 */
export function useSearch() {
  const status = useSyncExternalStore(
    searchStore.subscribe,
    searchStore.getSnapshot,
    searchStore.getServerSnapshot
  )

  const search = useCallback(
    async (term: string): Promise<SearchResult[]> => searchStore.search(term),
    []
  )

  return { status, search }
}
