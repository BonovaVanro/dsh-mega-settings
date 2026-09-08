import type { Context } from '@deepseek-ai/cordis'
import { settingsNamespace } from '@deepseek-ai/dsh-settings'
import { readFileSync, readdirSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import { createRequire } from 'node:module'
import os from 'node:os'
import { MegaSettingsSchema, defaultConfig } from './schema.ts'
import { checkDshPolicy, dshCompatMessage, type DshCompatPolicy } from './compat.ts'

export const name = 'dsh-mega-settings'
export const inject = ['settings', 'webServer']

/**
 * dsh 版本兼容策略（按需修改）：
 * - '= 0.1.1-*' 表示支持 dsh-v0.1.1 整条预发布线（0.1.1-rc.1 / 0.1.1-rc.2 等）；
 * - 也可写 >= / < / <= 数值比较，如 { op: '>=', target: '0.1.1-rc.2' }。
 */
const DSCH_COMPAT_POLICY: DshCompatPolicy = { op: '=', target: '0.1.1-*' }

const dshRequire = createRequire(import.meta.url)

/** 探测当前 dsh 版本：优先 @deepseek-ai/dsh 本体，回退 lockstep 的 dsh-client-runtime。 */
function detectDshVersion(): string | null {
  for (const pkg of ['@deepseek-ai/dsh', 'dsh', '@deepseek-ai/dsh-client-runtime']) {
    try {
      const pkgJson = dshRequire.resolve(pkg + '/package.json')
      const parsed = JSON.parse(readFileSync(pkgJson, 'utf8')) as { version?: string }
      if (typeof parsed.version === 'string' && parsed.version.length > 0) return parsed.version
    } catch {
      /* 尝试下一候选 */
    }
  }
  return null
}

/** 收集 profile node_modules 已安装包版本（顶层 + @scope/*），供客户端卡片版本徽章。 */
function collectPackageVersions(profileDir: string): Record<string, string> {
  const versions: Record<string, string> = {}
  const nm = join(profileDir, 'node_modules')
  if (!existsSync(nm)) return versions
  const read = (dir: string, pkgName: string): void => {
    const p = join(dir, 'package.json')
    if (!existsSync(p)) return
    try {
      const json = JSON.parse(readFileSync(p, 'utf8')) as { name?: string; version?: string }
      if (json.name && json.version) versions[json.name] = json.version
    } catch {
      /* 忽略坏包 */
    }
    void pkgName
  }
  for (const entry of readdirSync(nm, { withFileTypes: true })) {
    if (entry.name.startsWith('.')) continue
    if (entry.name.startsWith('@')) {
      const scopeDir = join(nm, entry.name)
      if (!existsSync(scopeDir)) continue
      for (const sub of readdirSync(scopeDir, { withFileTypes: true })) {
        if (sub.isDirectory()) read(join(scopeDir, sub.name), entry.name + '/' + sub.name)
      }
      continue
    }
    if (entry.isDirectory()) read(join(nm, entry.name), entry.name)
  }
  return versions
}

function resolveProfileDir(): string {
  return join(os.homedir(), '.dsh', 'profiles', 'web')
}

export function apply(ctx: Context): void {
  // dsh 版本兼容校验：检测失败或不合规只打印警示，不阻断插件加载
  try {
    const dshVer = detectDshVersion()
    if (dshVer !== null && !checkDshPolicy(dshVer, DSCH_COMPAT_POLICY)) {
      console.warn(dshCompatMessage(name, dshVer))
    }
  } catch {
    /* 校验器自身异常不应影响插件 */
  }

  // 自身配置 namespace（浏览器卡片经 settings 槽注册配对，§12 核实项 4/6）
  ctx.settings.register(settingsNamespace('mega-settings'), MegaSettingsSchema, {
    base: defaultConfig,
    applies: 'live',
  })

  // 包版本 API（卡片版本徽章；webServer 缺席时静默跳过）
  ctx.inject(['webServer'], (scopedCtx) => {
    const ws = (scopedCtx as unknown as { webServer: { register(opts: unknown): unknown } }).webServer
    const scoped = scopedCtx as unknown as { effect(fn: () => unknown, label?: string): unknown }
    scoped.effect(() => {
      const route = ws.register({
        kind: 'exact',
        path: '/api/dsh-mega-settings/versions',
        handler: (req: { method?: string }, res: {
          writeHead(code: number, headers?: Record<string, string>): void
          end(body?: string): void
        }) => {
          if (req.method !== 'GET') {
            res.writeHead(405)
            res.end('method not allowed')
            return
          }
          const versions = collectPackageVersions(resolveProfileDir())
          res.writeHead(200, {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
            'Cache-Control': 'no-cache',
          })
          res.end(JSON.stringify({ versions }))
        },
      })
      return () => (route as { dispose?: () => void } | undefined)?.dispose?.() ?? (route as () => void | undefined)?.()
    }, 'dsh-mega-settings: versions api')
  })
}
