/**
 * 官方原生分区清单护栏。
 *
 * 背景（两次真实回归）：
 * 1. 官方 0.2.0 新增 account（账号与余额）后，硬编码清单没同步 → 该项被当作第三方
 *    管控项收纳进分组，导航栏里消失；
 * 2. 曾改用「接管时快照账本里已存在的分区」来免维护，但 profile bundles 里**第三方插件
 *    排在 dsh-mega-settings 之前**（skin-center / pet / cost-meter 等），快照把它们也当成
 *    原生 → 从折叠组里跑出来，分组被打散。
 *
 * 因此判定只认这份静态清单：本用例钉住「官方项都在 + 第三方项都不在」。
 */
import { describe, expect, it } from 'vitest'
import { NATIVE_SECTION_IDS } from '../src/client/pure.ts'

describe('NATIVE_SECTION_IDS：官方原生分区清单', () => {
  it('包含 0.2.0 起官方的全部设置分区（account 排在最前）', () => {
    for (const id of ['account', 'general', 'models', 'plugins', 'agent-presets', 'archived-sessions']) {
      expect(NATIVE_SECTION_IDS).toContain(id)
    }
    expect(NATIVE_SECTION_IDS[0]).toBe('account')
  })

  it('不得混入第三方分区（否则会从折叠分组里跑出来）', () => {
    const thirdParty = [
      'cost-meter',
      'skin-center',
      'pet',
      'market',
      'better-sidebar',
      'global-rules',
      'skill-explorer',
      'dsh-workshop',
      'sidebar-cards',
    ]
    for (const id of thirdParty) expect(NATIVE_SECTION_IDS).not.toContain(id)
  })

  it('无重复 id', () => {
    expect(new Set(NATIVE_SECTION_IDS).size).toBe(NATIVE_SECTION_IDS.length)
  })
})
