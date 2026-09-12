/**
 * 已安装包版本映射（mega 徽章 / mega 优化「插件是否安装」判定共用）：
 * 初始同步取 localStorage 缓存（首帧即有旧版本），后台 fetch host
 * /api/dsh-mega-settings/versions 刷新并回写缓存。
 * done = fetch 已结束（成功或失败）——仅当无缓存且 fetch 未结束时徽章留空，
 * 避免首帧闪「未知」再跳具体版本的抖动。
 */
import { useEffect, useState } from 'react'

const VERSIONS_CACHE_KEY = 'dsh-mega-settings.versions.v1'

export function readVersionsCache(): Record<string, string> {
  try {
    const raw = localStorage.getItem(VERSIONS_CACHE_KEY)
    if (!raw) return {}
    const parsed: unknown = JSON.parse(raw)
    if (parsed !== null && typeof parsed === 'object' && !Array.isArray(parsed)) {
      return parsed as Record<string, string>
    }
  } catch {
    /* 坏缓存/不可用环境忽略 */
  }
  return {}
}

function writeVersionsCache(versions: Record<string, string>): void {
  try {
    localStorage.setItem(VERSIONS_CACHE_KEY, JSON.stringify(versions))
  } catch {
    /* 写入失败忽略 */
  }
}

/** fetch 版本并校验形状（失败返回 null，调用方静默降级）。 */
async function fetchVersions(): Promise<Record<string, string> | null> {
  try {
    const res = await fetch('/api/dsh-mega-settings/versions')
    if (!res.ok) return null
    const data = (await res.json()) as { versions?: Record<string, string> }
    if (data && data.versions && typeof data.versions === 'object') return data.versions
  } catch {
    /* 网络/解析失败 */
  }
  return null
}

export function useVersions(): { versions: Record<string, string>; done: boolean } {
  const [map, setMap] = useState<Record<string, string>>(readVersionsCache)
  const [done, setDone] = useState(false)
  useEffect(() => {
    let alive = true
    fetchVersions()
      .then((d) => {
        if (alive && d) {
          setMap(d)
          writeVersionsCache(d)
        }
      })
      .catch(() => {})
      .finally(() => {
        if (alive) setDone(true)
      })
    return () => {
      alive = false
    }
  }, [])
  return { versions: map, done }
}
