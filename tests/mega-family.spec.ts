/**
 * mega 家族公共配置（$DSH_HOME/mega.json）——「一处关闭、全体 mega 插件静音」。
 *
 * 优先级：自身 config.compatCheck（显式）→ 家族公共文件 → 缺省 true。
 * 只认布尔：JSON 里手写引号得到的 "false" 字符串不能真的关掉校验。
 */
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { compatCheckEnabled, megaFamilyConfigPath, readFamilyCompatCheck } from '../src/mega-family.ts'
import { MegaSettingsSchema } from '../src/schema.ts'

let dir = ''
const file = (): string => join(dir, 'mega.json')
const write = (text: string): void => { writeFileSync(file(), text, 'utf8') }

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'mgs-mega-'))
})
afterEach(() => {
  rmSync(dir, { recursive: true, force: true })
})

describe('mega-family: readFamilyCompatCheck', () => {
  it('文件缺失 → undefined', () => {
    expect(readFamilyCompatCheck(file())).toBeUndefined()
  })

  it('显式 false / true → 原样返回', () => {
    write('{"compatCheck": false}')
    expect(readFamilyCompatCheck(file())).toBe(false)
    write('{"compatCheck": true}')
    expect(readFamilyCompatCheck(file())).toBe(true)
  })

  it('字段非布尔 → undefined', () => {
    write('{"compatCheck": "false"}')
    expect(readFamilyCompatCheck(file())).toBeUndefined()
    write('{"compatCheck": 0}')
    expect(readFamilyCompatCheck(file())).toBeUndefined()
  })

  it('JSON 损坏 / 顶层非对象 → undefined，不抛错', () => {
    write('{ oops')
    expect(readFamilyCompatCheck(file())).toBeUndefined()
    write('[1]')
    expect(readFamilyCompatCheck(file())).toBeUndefined()
    write('null')
    expect(readFamilyCompatCheck(file())).toBeUndefined()
  })

  it('路径解析：DSH_HOME 优先，否则 ~/.dsh', () => {
    const saved = process.env.DSH_HOME
    try {
      process.env.DSH_HOME = 'D:\\x\\dsh-home'
      expect(megaFamilyConfigPath()).toBe(join('D:\\x\\dsh-home', 'mega.json'))
      delete process.env.DSH_HOME
      expect(megaFamilyConfigPath().endsWith(join('.dsh', 'mega.json'))).toBe(true)
    } finally {
      if (saved === undefined) delete process.env.DSH_HOME
      else process.env.DSH_HOME = saved
    }
  })
})

describe('mega-family: compatCheckEnabled 优先级', () => {
  it('自身显式值优先于公共文件', () => {
    write('{"compatCheck": false}')
    expect(compatCheckEnabled({ compatCheck: true }, file())).toBe(true)
    write('{"compatCheck": true}')
    expect(compatCheckEnabled({ compatCheck: false }, file())).toBe(false)
  })

  it('自身未设置时跟随公共文件 → 一处关闭、全体静音', () => {
    write('{"compatCheck": false}')
    expect(compatCheckEnabled({}, file())).toBe(false)
    expect(compatCheckEnabled(undefined, file())).toBe(false)
  })

  it('回归：schema 默认 true 不得压制公共开关（旧写法 compat !== false 的坑）', () => {
    // 旧实现是 `config?.compatCheck !== false`：config 永远带默认值 true，
    // 于是家族公共开关永远不会生效——这条用例专门钉住该回归。
    write('{"compatCheck": false}')
    expect(compatCheckEnabled({ compatCheck: true }, file())).toBe(true)   // 显式 true 是可压制公共文件的
    expect(compatCheckEnabled({ other: 1 }, file())).toBe(false)           // 仅"未设置"才跟随公共文件
  })

  it('回归（命门）：schema 解析未设的配置后，compatCheck 不得被默认成 true', () => {
    // 旧实现给 schema 加 .default(true)：空配置解析后恒有 compatCheck=true，
    // compatCheckEnabled 就永远读不到家族公共文件——这条用例必须走真实 schema 解析。
    write('{"compatCheck": false}')
    const std = (MegaSettingsSchema as unknown as {
      '~standard': { validate(v: unknown): { value: unknown; issues?: unknown[] } }
    })['~standard']
    // 整对象 volatile：解析结果是带 .get() 的引用包装（apply(ctx, config) 收到的就是它）
    const wrapped = std.validate({}).value
    const resolved = (typeof (wrapped as { get?: () => unknown }).get === 'function'
      ? (wrapped as { get(): unknown }).get()
      : wrapped) as Record<string, unknown>
    expect(resolved.compatCheck).toBeUndefined() // 未设 = 解包后无该键（旧 .default(true) 会让它恒为 true）
    expect(compatCheckEnabled(wrapped, file())).toBe(false) // compatCheckEnabled 内部解包 → 跟随家族 false → 静音
  })

  it('两处都没有 → 缺省 true', () => {
    expect(compatCheckEnabled({}, file())).toBe(true)
    // 走默认路径时也必须无文件才算"都没配置"：开发机上可能真有 ~/.dsh/mega.json，
    // 故显式指向不存在的位置，避免套件依赖运行环境
    expect(compatCheckEnabled(undefined, join(dir, 'nonexistent', 'mega.json'))).toBe(true)
  })
})
