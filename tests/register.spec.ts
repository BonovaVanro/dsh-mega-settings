import { describe, it, expect } from 'vitest'
import * as host from '../src/index.ts'
import { MegaSettingsSchema, defaultConfig } from '../src/schema.ts'
import { zh, en } from '../src/client/locales.ts'

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

  it('默认配置完整（v2：entry/mode/defaultExpand/groups/noTitlePlugins/lastMember）', () => {
    expect(defaultConfig.entry).toBe('plugins')
    expect(defaultConfig.mode).toBe('collect')
    expect(defaultConfig.defaultExpand).toBe(true)
    expect(defaultConfig.groups).toEqual([])
    expect(defaultConfig.noTitlePlugins).toContain('dsh-better-sidebar')
    expect(defaultConfig.lastMember).toBe('')
    expect(defaultConfig.ungroupedOrder).toEqual([])
    expect(defaultConfig.navOrder).toEqual([])
    expect(defaultConfig.pluginExists).toEqual({})
  })

  it('词条双语键集一致（§8 公约）', () => {
    expect(Object.keys(zh).sort()).toEqual(Object.keys(en).sort())
    expect(Object.keys(zh).length).toBeGreaterThan(0)
  })
})