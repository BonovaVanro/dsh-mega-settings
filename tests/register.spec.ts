import { describe, it, expect } from 'vitest'
import * as host from '../src/index.ts'
import { MegaSettingsSchema, defaultConfig } from '../src/schema.ts'
import { zh, en } from '../src/client/locales.ts'
import { forwardTranslate } from '../src/client/mini.tsx'

describe('dsh-mega-settings 注册契约', () => {
  it('入口三件套：name/inject/apply', () => {
    expect(host.name).toBe('dsh-mega-settings')
    expect(typeof host.apply).toBe('function')
    expect(Array.isArray(host.inject)).toBe(true)
    expect(host.inject).toContain('settings')
  })

  it('无 default export（Loader 红线：default 会丢弃 inject/name）', async () => {
    const mod = await import('../src/index.ts')
    expect((mod as Record<string, unknown>).default).toBeUndefined()
  })

  it('inject 为纯字符串数组（对象形态会卡 pending）', () => {
    expect(host.inject.every((item: string) => typeof item === 'string')).toBe(true)
  })

  it('配置 schema 可序列化（toJSON：descriptor.schema 官方形态，§12 核实项 8）', () => {
    const json = MegaSettingsSchema.toJSON() as Record<string, unknown>
    expect(json).toHaveProperty('uid')
    expect(json).toHaveProperty('refs')
    expect(typeof json.uid).toBe('number')
  })

  it('默认配置完整（v2：mode/groups/lastMember 等）', () => {
    expect(defaultConfig.mode).toBe('collect')
    expect(defaultConfig.groups).toEqual([])
    expect(defaultConfig.lastMember).toBe('')
    expect(defaultConfig.ungroupedOrder).toEqual([])
    expect(defaultConfig.navOrder).toEqual([])
    expect(defaultConfig.pluginExists).toEqual({})
    expect(defaultConfig.optToggles).toEqual({})
    expect(defaultConfig.optValues).toEqual({})
  })

  it('词条双语键集一致（§8 公约）', () => {
    expect(Object.keys(zh).sort()).toEqual(Object.keys(en).sort())
    expect(Object.keys(zh).length).toBeGreaterThan(0)
  })
})

describe('mini 渲染器：locale 转发', () => {
  /** 复刻官方 translate：params 为空 → 返回模板原文；否则替换 {name} 占位符。 */
  const official = (key: string, params?: Record<string, unknown>): string => {
    const template = key === 'time.days' ? '{n}天' : key
    if (!params) return template
    return template.replace(/\{(\w+)\}/g, (match, name: string) =>
      name in params ? String(params[name]) : match,
    )
  }

  it('透传 params（否则 {n} 等占位符原样输出）', () => {
    const t = forwardTranslate(() => official)
    expect(t('time.days', { n: 8 })).toBe('8天')
    expect(t('time.days')).toBe('{n}天') // 官方语义：无 params = 原文
  })

  it('locale 面缺席时退回 key，不抛错', () => {
    const t = forwardTranslate(() => undefined)
    expect(t('time.days', { n: 8 })).toBe('time.days')
  })

  it('惰性解析：每次调用取当前绑定（revision 换绑后即生效）', () => {
    let current = official
    const t = forwardTranslate(() => current)
    expect(t('time.days', { n: 1 })).toBe('1天')
    current = (key: string, params?: Record<string, unknown>) => (params ? 'switched' : key)
    expect(t('time.days', { n: 1 })).toBe('switched')
  })
})