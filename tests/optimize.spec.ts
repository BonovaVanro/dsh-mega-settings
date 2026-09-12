import { describe, it, expect } from 'vitest'
import {
  OPTIMIZE_DEFS,
  optimizeById,
  optimizeByGroup,
  optimizeEnabled,
  optimizeValue,
  enabledOptimizeIds,
  optimizePluginGroups,
  optimizeSectionEnabled,
  validateOptimizeRegistry,
} from '../src/client/optimize.ts'
import { syncOptimizeEffects, fullscreenZeroTrackValue, splitGridTracks } from '../src/client/optimize-effects.ts'
import type { MegaSettingsConfig } from '../src/schema.ts'

// 注册表中的插件 def（稳定存在）供开关解析用例引用
const BOTTOM_TOGGLE_ID = 'betterSidebar.hideBottomToggle'

describe('optimize: 注册表完整性', () => {
  it('校验通过（id 唯一 / css 非空 / plugin 组有 target / 词条 key 齐全）', () => {
    expect(validateOptimizeRegistry()).toEqual([])
  })

  it('id 唯一', () => {
    const ids = OPTIMIZE_DEFS.map((d) => d.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('dsh 组 + plugin 组并存（dsh 组当前 3 项）', () => {
    const dsh = optimizeByGroup('dsh')
    const plugin = optimizeByGroup('plugin')
    expect(dsh.length).toBe(3)
    expect(plugin.length).toBeGreaterThan(0)
    expect(OPTIMIZE_DEFS.map((d) => d.group)).toEqual([
      ...dsh.map(() => 'dsh' as const),
      ...plugin.map(() => 'plugin' as const),
    ])
  })

  it('dsh 全屏背景透明度修正 def：值驱动 css + 默认 25（数值越大越透明）', () => {
    const def = optimizeById('dsh.rightbarFullscreenBgAlpha')
    expect(def).toBeDefined()
    expect(def!.group).toBe('dsh')
    expect(def!.defaultValue).toBe(25)
    expect(typeof def!.cssValue).toBe('function')
    const css = def!.cssValue!(25)
    expect(css).toContain('[data-sidebar-right-panel="fullscreen"]')
    expect(css).toContain('rgb(from var(--dsw-alias-bg-base) r g b / 0.75)')
    expect(def!.cssValue!(0)).toContain('/ 1)') // 0 = 完全不透明
    expect(def!.cssValue!(100)).toContain('/ 0)') // 100 = 全透明
  })

  it('旧静态背景 def 已移除', () => {
    expect(optimizeById('dsh.rightbarFullscreenBg')).toBeUndefined()
  })

  it('dsh 全屏隐藏正文工具栏 def：css 作用于全屏帧下的 headerUtilities', () => {
    const def = optimizeById('dsh.rightbarFullscreenHideHeaderUtilities')
    expect(def).toBeDefined()
    expect(def!.group).toBe('dsh')
    expect(def!.css).toContain('[data-rightbar-fullscreen] .wSkVaW_headerUtilities')
    expect(def!.css).toContain('display:none')
  })

  it('dsh 全屏零占位 def：jsEffect 生效、无 css（validator 接受）', () => {
    const def = optimizeById('dsh.rightbarFullscreenZeroTrack')
    expect(def).toBeDefined()
    expect(def!.group).toBe('dsh')
    expect(def!.jsEffect).toBe('rightbarFullscreenZeroTrack')
    expect(def!.css).toBeUndefined()
    expect(validateOptimizeRegistry()).toEqual([])
  })

  it('plugin 组条目 target 为真实包名（不含空格）', () => {
    for (const d of optimizeByGroup('plugin')) {
      expect(d.target, d.id).toBeTruthy()
      expect(d.target, d.id).not.toContain(' ')
    }
  })

  it('已移除桌宠与 Markdown 目录配置', () => {
    expect(optimizeById('pet.hide')).toBeUndefined()
    expect(optimizeById('betterSidebar.hideMdToc')).toBeUndefined()
    expect(OPTIMIZE_DEFS.some((d) => (d.css ?? '').includes('data-dsh-pet-root'))).toBe(false)
    expect(OPTIMIZE_DEFS.some((d) => (d.css ?? '').includes('data-dsh-md-toc-panel'))).toBe(false)
  })
})

describe('optimize: 按插件分组（每插件一个面板）', () => {
  it('分组 = 注册序；同一插件的 def 归并到一个组', () => {
    const groups = optimizePluginGroups()
    expect(groups.length).toBeGreaterThan(0)
    const expectedOrder: string[] = []
    for (const d of OPTIMIZE_DEFS) {
      if (d.target && !expectedOrder.includes(d.target)) expectedOrder.push(d.target)
    }
    expect(groups.map((g) => g.plugin)).toEqual(expectedOrder)
    for (const g of groups) {
      expect(g.defs.length).toBeGreaterThan(0)
      for (const d of g.defs) expect(d.target).toBe(g.plugin)
    }
  })

  it('dsh-better-sidebar 面板只剩底部面板切换钮', () => {
    const g = optimizePluginGroups().find((x) => x.plugin === 'dsh-better-sidebar')
    expect(g).toBeDefined()
    expect(g!.defs.map((d) => d.id)).toEqual(['betterSidebar.hideBottomToggle'])
  })

  it('插件启用检测：sectionId 存在 = 已启用；缺失/未声明 → 按已装判定', () => {
    const def = optimizeById('betterSidebar.hideBottomToggle')
    expect(def!.sectionId).toBe('better-sidebar')
    expect(optimizeSectionEnabled(new Set(['better-sidebar']), def!)).toBe(true)
    expect(optimizeSectionEnabled(new Set([]), def!)).toBe(false)
    expect(optimizeSectionEnabled(undefined, def!)).toBe(false)
    // 未声明 sectionId 的 def（dsh 组）恒视为启用
    const dshDef = optimizeById('dsh.rightbarFullscreenZeroTrack')!
    expect(optimizeSectionEnabled(new Set(), dshDef)).toBe(true)
    expect(optimizeSectionEnabled(undefined, dshDef)).toBe(true)
  })

  it('已知插件带标题词条 key（缺省 = 显示包名）', () => {
    const titles = new Map(optimizePluginGroups().map((g) => [g.plugin, g.titleKey]))
    expect(titles.get('dsh-better-sidebar')).toBe('opt.plugin.title.betterSidebar')
  })
})

describe('optimize: 开关解析', () => {
  it('缺省 = defaultOn（未收录 key 时）', () => {
    expect(optimizeById(BOTTOM_TOGGLE_ID)?.defaultOn ?? false).toBe(false)
    expect(optimizeEnabled(undefined, BOTTOM_TOGGLE_ID)).toBe(false)
    expect(optimizeEnabled({}, BOTTOM_TOGGLE_ID)).toBe(false)
  })

  it('config.optToggles 显式 true/false 覆盖 defaultOn', () => {
    expect(optimizeEnabled({ optToggles: { [BOTTOM_TOGGLE_ID]: false } }, BOTTOM_TOGGLE_ID)).toBe(false)
    expect(optimizeEnabled({ optToggles: { [BOTTOM_TOGGLE_ID]: true } }, BOTTOM_TOGGLE_ID)).toBe(true)
  })

  it('非布尔/未知 id 安全回落', () => {
    expect(optimizeEnabled({ optToggles: { [BOTTOM_TOGGLE_ID]: 1 as unknown as boolean } }, BOTTOM_TOGGLE_ID)).toBe(false)
    expect(optimizeEnabled({ optToggles: {} }, 'no.such.id')).toBe(false)
    expect(optimizeEnabled({ optToggles: { 'no.such.id': true } }, 'no.such.id')).toBe(false)
  })

  it('enabledOptimizeIds 汇总启用集合（不含未收录 key）', () => {
    const ids = enabledOptimizeIds({ optToggles: { [BOTTOM_TOGGLE_ID]: true } })
    expect(ids.has(BOTTOM_TOGGLE_ID)).toBe(true)
    expect(ids.has('no.such.id')).toBe(false)
    expect(enabledOptimizeIds(undefined).size).toBe(0)
  })

  it('不修改入参', () => {
    const config = { optToggles: { [BOTTOM_TOGGLE_ID]: true } }
    enabledOptimizeIds(config)
    expect(config.optToggles).toEqual({ [BOTTOM_TOGGLE_ID]: true })
  })
})

describe('optimize: 滑块数值解析', () => {
  const BG = 'dsh.rightbarFullscreenBgAlpha'
  it('缺省 = defaultValue（未收录 key 时）', () => {
    expect(optimizeValue(undefined, BG)).toBe(25)
    expect(optimizeValue({}, BG)).toBe(25)
    expect(optimizeValue({ optValues: {} }, BG)).toBe(25)
  })

  it('optValues 显式值生效（越界钳制 0-100）', () => {
    expect(optimizeValue({ optValues: { [BG]: 35 } }, BG)).toBe(35)
    expect(optimizeValue({ optValues: { [BG]: -10 } }, BG)).toBe(0)
    expect(optimizeValue({ optValues: { [BG]: 150 } }, BG)).toBe(100)
    expect(optimizeValue({ optValues: { [BG]: 1.6 } }, BG)).toBe(1.6)
  })

  it('无滑块能力 / 未知 id → undefined', () => {
    expect(optimizeValue({}, 'dsh.rightbarFullscreenZeroTrack')).toBeUndefined()
    expect(optimizeValue({ optValues: { x: 50 } }, 'no.such.id')).toBeUndefined()
  })

  it('不修改入参', () => {
    const config = { optValues: { [BG]: 42 } }
    optimizeValue(config, BG)
    expect(config.optValues).toEqual({ [BG]: 42 })
  })
})

describe('optimize-effects: 同步边界（node 无 document → 静默跳过）', () => {
  it('node 环境调用不抛错（含 installed 过滤入参与 JS 效果 def）', () => {
    expect(() => syncOptimizeEffects(undefined)).not.toThrow()
    const config: MegaSettingsConfig = {
      optToggles: { [BOTTOM_TOGGLE_ID]: true, 'dsh.rightbarFullscreenZeroTrack': true },
    } as MegaSettingsConfig
    expect(() => syncOptimizeEffects(config)).not.toThrow()
    expect(() => syncOptimizeEffects(config, new Set(['dsh-better-sidebar']))).not.toThrow()
    expect(() => syncOptimizeEffects(config, new Set())).not.toThrow()
  })
})

describe('optimize-effects: 全屏零占位轨道解析', () => {
  it('splitGridTracks 括号感知切分（minmax(0, 1fr) 内含空格不被切碎）', () => {
    expect(splitGridTracks('280px minmax(0, 1fr) 320px')).toEqual(['280px', 'minmax(0, 1fr)', '320px'])
    expect(splitGridTracks('280px 640px 320px')).toEqual(['280px', '640px', '320px'])
    expect(splitGridTracks('')).toEqual([])
    expect(splitGridTracks('minmax(0, 1fr)')).toEqual(['minmax(0, 1fr)'])
  })

  it('fullscreenZeroTrackValue：第三轨置 0，前两轨原样保留', () => {
    expect(fullscreenZeroTrackValue('280px minmax(0, 1fr) 320px')).toBe('280px minmax(0, 1fr) 0px')
    expect(fullscreenZeroTrackValue('280px 640px 320px')).toBe('280px 640px 0px')
  })

  it('fullscreenZeroTrackValue：不足三轨/空值返回 null（不改写）', () => {
    expect(fullscreenZeroTrackValue('')).toBeNull()
    expect(fullscreenZeroTrackValue('minmax(0, 1fr)')).toBeNull()
    expect(fullscreenZeroTrackValue('280px 640px')).toBeNull()
  })
})

describe('optimize: def 形状（渲染字段）', () => {
  it('词条 key 均为非空字符串', () => {
    for (const d of OPTIMIZE_DEFS) {
      expect(typeof d.nameKey, d.id).toBe('string')
      expect(typeof d.descKey, d.id).toBe('string')
      expect(d.nameKey.length, d.id).toBeGreaterThan(0)
      expect(d.descKey.length, d.id).toBeGreaterThan(0)
    }
  })

  it('plugin 组 css 只引用各插件自身 data-dsh-* 稳定标记', () => {
    for (const d of optimizeByGroup('plugin')) {
      expect(d.css, d.id).toContain('data-dsh-')
    }
  })
})
