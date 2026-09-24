/**
 * mega 家族公共配置（$DSH_HOME/mega.json）——「一处关闭、全体 mega 插件静音」。
 *
 * 为什么需要它：0.1.7 的配置按 profile 条目分开承载（ui-mega-chat-nav、ui-mega-settings …），
 * 单插件设置界面只在装了 mega-settings 时才存在——未装时用户没有任何关闭入口。
 * 故约定一个家族公共文件，每个成员插件在自身配置未显式设置 compatCheck 时读它。
 *
 * 契约细节与各成员接入方式见 mega-plugin-guide references/09-version-check.md。
 */
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

/** 家族公共开关字段名（与各成员自身配置里的同名字段同义）。 */
export const FAMILY_COMPAT_FIELD = 'compatCheck'

/**
 * 家族公共配置文件路径：`$DSH_HOME/mega.json`（无 DSH_HOME 时 `~/.dsh/mega.json`）。
 * 与官方 `resolveDshHome` 同源解析，避免两处指向不同目录。
 */
export function megaFamilyConfigPath(): string {
  const home = process.env.DSH_HOME?.trim()
  const base = home !== undefined && home.length > 0
    ? home
    : join(process.env.USERPROFILE ?? process.env.HOME ?? '', '.dsh')
  return join(base, 'mega.json')
}

/**
 * 读家族公共配置里的 `compatCheck`。
 *
 * @param path - 配置文件路径（测试注入用）；省略时按 {@link megaFamilyConfigPath}
 * @returns 显式写下的布尔值；文件缺失 / JSON 损坏 / 字段非布尔 一律 undefined（交回缺省）
 */
export function readFamilyCompatCheck(path?: string): boolean | undefined {
  try {
    const file = path ?? megaFamilyConfigPath()
    if (!existsSync(file)) return undefined
    const parsed: unknown = JSON.parse(readFileSync(file, 'utf8'))
    if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) return undefined
    const value = (parsed as Record<string, unknown>)[FAMILY_COMPAT_FIELD]
    return typeof value === 'boolean' ? value : undefined
  } catch {
    return undefined
  }
}

/**
 * 是否执行 dsh 版本兼容校验。按优先级取第一个布尔值：
 * 1. 自身配置 `config.compatCheck`（用户在设置界面或 profile patch 里显式设置）；
 * 2. 家族公共配置 `$DSH_HOME/mega.json` 的 `compatCheck`（一处关闭、全体静音）；
 * 3. 都读不到 → 缺省 true（宁可多提醒，也不漏掉不兼容警示）。
 *
 * @param config - 本插件自身配置（apply 第二参）
 * @param familyPath - 家族公共配置文件路径（测试注入用）
 */
/** 解包配置引用：整对象 volatile 的 schema（如 mega-settings）解析出的 config 是带 `.get()` 的引用包装，
 *  直接读字段是 undefined——必须先 `.get()`（见 mega-plugin-guide 09-version-check）。 */
function unwrapVolatile(config: unknown): Record<string, unknown> | undefined {
  if (config === null || typeof config !== 'object') return undefined
  const get = (config as { get?: () => unknown }).get
  const base = typeof get === 'function' ? get() : config
  return base !== null && typeof base === 'object' && !Array.isArray(base)
    ? (base as Record<string, unknown>)
    : undefined
}

export function compatCheckEnabled(config?: unknown, familyPath?: string): boolean {
  const own = unwrapVolatile(config)?.[FAMILY_COMPAT_FIELD]
  if (typeof own === 'boolean') return own
  return readFamilyCompatCheck(familyPath) ?? true
}
