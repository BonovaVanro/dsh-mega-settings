import type { Context } from '@deepseek-ai/cordis'
import type {} from '@deepseek-ai/dsh-settings'
import { readFileSync, readdirSync, existsSync, writeFileSync, mkdirSync, rmSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { createRequire } from 'node:module'
import os from 'node:os'
import { MegaSettingsSchema } from './schema.ts'
import type { MegaSettingsConfig } from './schema.ts'
import { checkDshPolicy, dshCompatMessage, type DshCompatPolicy } from './compat.ts'
import { compatCheckEnabled, megaFamilyConfigPath, readFamilyCompatCheck } from './mega-family.ts'

export const name = 'dsh-mega-settings'
export const inject = ['webServer']

/**
 * 插件 Config schema（0.1.7 起）：settings 命名空间/表单由插件导出的 Config 派生，
 * 不再经 ctx.settings.register 注册。加载器会据此校验 settings 里对应命名空间的配置。
 */
export const Config = MegaSettingsSchema

/**
 * dsh 版本兼容策略：0.1.7 分支锁定 dsh-v0.1.7 rc 线（'= 0.1.7-rc.*'）。
 * - 0.1.7-alpha 统一不声明兼容（alpha 线仍会打印「可能不适配」提示，属设计）；
 * - 其余版本（含 0.1.5/0.1.6 线，因设置模型已重构）控制台警示，不阻断加载；
 * - 维护旧线请用对应分支（0.1.1/0.1.2/0.1.5-rc.2 的发布版本）；
 * - 也可改用数组或范围，如 { op: '=', target: ['0.1.7-rc.*'] } 或 { op: '>=', target: '0.1.7-rc.1' }。
 */
const DSCH_COMPAT_POLICY: DshCompatPolicy = { op: '=', target: '0.1.7-rc.*' }

const dshRequire = createRequire(import.meta.url)

/** 探测当前 dsh 版本：优先 @deepseek-ai/dsh 本体，回退 lockstep 的 0.1.5 线包
 *  （dsh-client-store / dsh-client-ui-renderer，取代已停发的 dsh-client-runtime）。 */
function detectDshVersion(): string | null {
  for (const pkg of ['@deepseek-ai/dsh', 'dsh', '@deepseek-ai/dsh-client-store', '@deepseek-ai/dsh-client-ui-renderer']) {
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

export function apply(ctx: Context, config?: MegaSettingsConfig): void {
  // 0.1.7 起：自身配置由插件 Config 派生，经 apply 第二参注入（不是 ctx.config——那需要 inject 守卫且会等 service）

  // dsh 版本兼容校验（mega 系契约：compatCheck 关闭时各 mega 插件跳过校验与提醒；本插件自行读取）。
  // 优先级：自身 config.compatCheck → 家族公共配置 $DSH_HOME/mega.json → 缺省 true。
  // 注：不能用 `config?.compatCheck !== false` —— schema 有 .default(true)，
  // 未设置时该式恒为 true，会让家族公共开关永远失效。
  try {
    if (compatCheckEnabled(config)) {
      const dshVer = detectDshVersion()
      if (dshVer !== null && !checkDshPolicy(dshVer, DSCH_COMPAT_POLICY)) {
        console.warn(dshCompatMessage(name, dshVer))
      }
    }
  } catch {
    /* 校验器自身异常不应影响插件 */
  }

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

    // 家族公共开关（$DSH_HOME/mega.json）：mega-settings 作为家长直接读写家族开关。
    // GET → { compatCheck: boolean | null }（null = 未配置 → 缺省开启校验）；
    // POST { compatCheck: boolean } → 写家族文件；POST { compatCheck: null } → 删除文件（回默认）。
    const familyRoute = ws.register({
      kind: 'exact',
      path: '/api/dsh-mega-settings/family-compat',
      handler: (req: { method?: string; on?: (ev: string, cb: (c: Buffer) => void) => unknown }, res: {
        writeHead(code: number, headers?: Record<string, string>): void
        end(body?: string): void
      }) => {
        if (req.method === 'GET') {
          const compat = readFamilyCompatCheck()
          res.writeHead(200, {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
            'Cache-Control': 'no-cache',
          })
          res.end(JSON.stringify({ compatCheck: compat ?? null }))
          return
        }
        if (req.method === 'POST') {
          const chunks: Buffer[] = []
          req.on?.('data', (c) => chunks.push(c))
          req.on?.('end', () => {
            let value: unknown = null
            try {
              value = (JSON.parse(Buffer.concat(chunks).toString('utf8')) as Record<string, unknown>).compatCheck ?? null
            } catch {
              value = null
            }
            try {
              const file = megaFamilyConfigPath()
              if (value === null) {
                if (existsSync(file)) rmSync(file, { force: true })
              } else {
                mkdirSync(dirname(file), { recursive: true })
                writeFileSync(file, JSON.stringify({ compatCheck: Boolean(value) }, null, 2), 'utf8')
              }
              res.writeHead(200, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*', 'Cache-Control': 'no-cache' })
              res.end(JSON.stringify({ ok: true, compatCheck: value === null ? null : Boolean(value) }))
            } catch (error) {
              res.writeHead(500, { 'Content-Type': 'application/json' })
              res.end(JSON.stringify({ ok: false, error: String(error) }))
            }
          })
          return
        }
        res.writeHead(405)
        res.end('method not allowed')
      },
    })
    scoped.effect(() => () => {
      const dispose = (familyRoute as { dispose?: () => void } | undefined)?.dispose
      if (typeof dispose === 'function') dispose()
    }, 'dsh-mega-settings: family-compat api')
  })
}
