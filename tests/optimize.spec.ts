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
import { readOptimizeCache, syncOptimizeEffects, fullscreenZeroTrackValue, splitGridTracks } from '../src/client/optimize-effects.ts'
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

  it('dsh 组 + plugin 组并存（dsh 组当前 15 项）', () => {
    const dsh = optimizeByGroup('dsh')
    const plugin = optimizeByGroup('plugin')
    expect(dsh.length).toBe(15)
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

  it('dsh 主题根元素边框盒 def：置于 dsh 组最前', () => {
    const def = optimizeById('dsh.rootBorderBox')
    expect(def).toBeDefined()
    expect(def!.group).toBe('dsh')
    expect(def!.defaultOn).toBe(true) // 默认生效
    expect(optimizeByGroup('dsh')[0].id).toBe('dsh.rootBorderBox')
    expect(def!.css).toBe('#root{box-sizing:border-box!important}')
    expect(optimizeEnabled(undefined, 'dsh.rootBorderBox')).toBe(true)
  })

  it('右侧边栏相关 dsh def 带 dshSection=rightbar（子区归组）', () => {
    for (const id of ['dsh.rightbarFullscreenZeroTrack', 'dsh.rightbarFullscreenBgAlpha', 'dsh.rightbarFullscreenHideHeaderUtilities', 'dsh.rightbarFullscreenZIndex', 'dsh.rightbarFullscreenPadding']) {
      expect(optimizeById(id)!.dshSection, id).toBe('rightbar')
    }
    expect(optimizeById('dsh.rootBorderBox')!.dshSection).toBeUndefined()
  })

  it('dsh 全屏下 ESC 关闭侧边栏 def：jsEffect + rightbar 分块', () => {
    const def = optimizeById('dsh.rightbarFullscreenEscapeClose')
    expect(def).toBeDefined()
    expect(def!.dshSection).toBe('rightbar')
    expect(def!.jsEffect).toBe('rightbarFullscreenEscapeClose')
  })

  it('dsh TAB 打开侧边栏 def：jsEffect + rightbar 分块', () => {
    const def = optimizeById('dsh.rightbarTabOpen')
    expect(def).toBeDefined()
    expect(def!.dshSection).toBe('rightbar')
    expect(def!.jsEffect).toBe('rightbarTabOpen')
  })

  it('dsh 默认全屏 def：jsEffect + rightbar 分块', () => {
    const def = optimizeById('dsh.rightbarDefaultFullscreen')
    expect(def).toBeDefined()
    expect(def!.dshSection).toBe('rightbar')
    expect(def!.jsEffect).toBe('rightbarDefaultFullscreen')
  })

  it('dsh Ctrl+Shift+S 打开设置页 def：jsEffect + 一般区', () => {
    const def = optimizeById('dsh.settingsShortcut')
    expect(def).toBeDefined()
    expect(def!.group).toBe('dsh')
    expect(def!.dshSection).toBeUndefined()
    expect(def!.jsEffect).toBe('settingsShortcut')
  })

  it('左侧边栏相关 dsh def 带 dshSection=leftbar（背景统一化 / 透明度 / 底部动作区 / 悬浮卡）', () => {
    for (const id of ['dsh.leftbarBgUnify', 'dsh.leftbarBgAlpha', 'dsh.leftbarFooterActionsLayout', 'dsh.hoverCardTheme']) {
      expect(optimizeById(id)!.dshSection, id).toBe('leftbar')
    }
  })

  it('左侧边栏底部动作区布局 def：纵向 flex + 8px gap + 折叠时按钮撑满/条目居中', () => {
    const def = optimizeById('dsh.leftbarFooterActionsLayout')
    expect(def).toBeDefined()
    expect(def!.dshSection).toBe('leftbar')
    expect(def!.css).toContain('.hHd-Xa_footerActions{display:flex;flex-direction:column;gap:8px}')
    expect(def!.css).toContain('.hHd-Xa_collapsed .hHd-Xa_footerActions button,')
    expect(def!.css).toContain('.hHd-Xa_collapsed .hHd-Xa_footerActions [role="button"],')
    expect(def!.css).toContain('[data-sidebar-collapsed] .hHd-Xa_footerActions button,')
    expect(def!.css).toContain('[data-sidebar-collapsed] .hHd-Xa_footerActions [role="button"]{width:100%!important}')
    expect(def!.css).toContain('.hHd-Xa_collapsed .hHd-Xa_footerActions div,')
    expect(def!.css).toContain('[data-sidebar-collapsed] .hHd-Xa_footerActions div{text-align:center}')
  })

  it('左侧边栏背景颜色统一化 def：选中其一 → 另一层 background none', () => {
    const def = optimizeById('dsh.leftbarBgUnify')
    expect(def).toBeDefined()
    expect(def!.defaultValue).toBe(0)
    expect(def!.choices?.map((c) => c.value)).toEqual(['layout', 'module'])
    // 布局层(0) → 模块层 hHd-Xa_root none；模块层(1) → 布局层 pI_x6G_sidebarCol none
    expect(def!.cssValue!(0)).toBe('.hHd-Xa_root{background:none!important}')
    expect(def!.cssValue!(1)).toBe('.pI_x6G_sidebarCol{background:none!important}')
  })

  it('左侧边栏背景透明度 def：rgb(from fill …) 混合透明度', () => {
    const def = optimizeById('dsh.leftbarBgAlpha')
    expect(def).toBeDefined()
    expect(def!.defaultValue).toBe(25)
    expect(def!.cssValue!(25)).toContain('.pI_x6G_sidebarCol,.hHd-Xa_root{background:rgb(from var(--dsw-specific-sidebar-fill) r g b / 0.75)}')
  })

  it('dsh 全屏下内边距优化 def：jsEffect 生效', () => {
    const def = optimizeById('dsh.rightbarFullscreenPadding')
    expect(def).toBeDefined()
    expect(def!.dshSection).toBe('rightbar')
    expect(def!.jsEffect).toBe('rightbarFullscreenPadding')
  })

  it('dsh 右侧边栏全屏层级 def：默认 41、数字输入框（无上限）、z-index 注入', () => {
    const def = optimizeById('dsh.rightbarFullscreenZIndex')
    expect(def).toBeDefined()
    expect(def!.defaultValue).toBe(41)
    expect(def!.numberInput).toBe(true)
    expect(def!.maxValue).toBeUndefined()
    expect(def!.cssValue!(40)).toContain('[data-sidebar-right-panel="fullscreen"]{z-index:40!important}')
    expect(optimizeValue({ optValues: { 'dsh.rightbarFullscreenZIndex': 15000 } }, 'dsh.rightbarFullscreenZIndex')).toBe(15000)
  })

  it('dsh 会话悬停卡主题适配 def：背景与文字全改主题 token、状态点排除', () => {
    const def = optimizeById('dsh.hoverCardTheme')
    expect(def).toBeDefined()
    expect(def!.group).toBe('dsh')
    expect(def!.dshSection).toBe('leftbar') // 左侧边栏分块
    expect(def!.css).toContain('--dsw-hovercard-bg:var(--dsw-alias-bg-layer-2)!important')
    expect(def!.css).toContain('color:var(--dsw-alias-label-primary)!important')
    expect(def!.css).toContain('color:var(--dsw-alias-label-secondary)!important')
    expect(def!.css).toContain('span:not([data-state])')
  })

  it('dsh 正文 Markdown 表格限宽 def：max-width 100% + 横向滚动', () => {
    const def = optimizeById('dsh.mdTableMaxWidth')
    expect(def).toBeDefined()
    expect(def!.group).toBe('dsh')
    expect(def!.css).toContain('.md-table-wide{max-width:100%!important')
    expect(def!.css).toContain('margin-left:0!important')
    expect(def!.css).toContain('padding-left:0!important')
    expect(def!.css).toContain('overflow:scroll')
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

  it('dsh-cost-meter 峰谷计价主题色适配：周末/经典标记 + 可配置峰值时段颜色', () => {
    const def = optimizeById('costMeter.peakValleyTheme')
    expect(def).toBeDefined()
    expect(def!.group).toBe('plugin')
    expect(def!.target).toBe('dsh-cost-meter')
    expect(def!.sectionId).toBe('cost-meter')
    expect(def!.defaultValue).toBe(2) // 默认 error
    expect(def!.choices?.map((c) => c.value)).toEqual(['warn', 'danger', 'error'])
    expect(def!.css).toContain('.cm-peak-strip.weekend')
    expect(def!.css).toContain('--dsw-alias-state-business-primary')
    expect(def!.css).toContain('.cm-peak-classic-marker{background:none;border:none;box-shadow:none}')
    expect(def!.css).toContain('.cm-peak-rail-classic-marker{background:none;border:none;box-shadow:none}')
    expect(def!.css).toContain('.cm-peak-marker,.cm-peak-rail-marker{background:none;box-shadow:none}')
    expect(def!.css).toContain('.cm-peak-classic.weekend .cm-peak-classic-marker{border-color:none}')
    expect(def!.css).toContain('.cm-peak-classic.weekend .cm-peak-classic-marker:after{border-top-color:var(--dsw-alias-state-business-primary)}')
    expect(def!.css).toContain('.cm-footer-stack span[role="tooltip"]{color:var(--dsw-alias-label-primary)}')
    expect(def!.css).toContain('.cm-footer-stack span[role="tooltip"]{background:var(--dsw-specific-sidebar-fill)}')
    expect(def!.cssValue!(0)).toContain('.cm-peak-classic-marker:after{border-top:6px solid var(--dsw-alias-state-warn-primary)}')
    expect(def!.cssValue!(0)).toContain('.cm-peak-high{background:var(--dsw-alias-state-warn-primary)}')
    expect(def!.cssValue!(0)).toContain('.cm-peak-rail-high{background:var(--dsw-alias-state-warn-primary)}')
    expect(def!.cssValue!(0)).toContain('.cm-peak-rail-classic-segment.peak{background:var(--dsw-alias-state-warn-primary)}')
    expect(def!.cssValue!(0)).toContain('.cm-peak-classic.peak .cm-peak-classic-chip,')
    expect(def!.cssValue!(0)).toContain('.cm-peak-rail-classic.peak .cm-peak-rail-classic-label{color:var(--dsw-alias-state-warn-primary)}')
    expect(def!.cssValue!(1)).toContain('--dsw-alias-state-danger-primary')
    expect(def!.cssValue!(1)).toContain('.cm-peak-high{background:var(--dsw-alias-state-danger-primary)}')
    expect(def!.cssValue!(2)).toContain('--dsw-alias-state-error-primary')
    expect(validateOptimizeRegistry()).toEqual([])
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

  it('技能中心主题适配 def：plugin 组、缺省 sectionId、全硬编码色映射', () => {
    const def = optimizeById('skillExplorer.themeAdapt')
    expect(def).toBeDefined()
    expect(def!.group).toBe('plugin')
    expect(def!.target).toBe('@linxin666/dsh-client-ui-skill-explorer')
    expect(def!.sectionId).toBeUndefined()
    expect(def!.css).toContain('.cBrkua_overlay .cBrkua_card')
    expect(def!.css).toContain('var(--dsw-alias-bg-layer-2)')
    expect(def!.css).toContain('.cBrkua_head{background:var(--dsw-alias-bg-base)')
    expect(def!.css).toContain('.cBrkua_headButton{background:var(--dsw-alias-interactive-bg-hover)')
    expect(def!.jsEffect).toBeUndefined()
    expect(def!.css).toContain('var(--dsw-alias-label-primary)')
    expect(def!.css).toContain('.cBrkua_badgeIsolated')
    expect(def!.css).toContain('var(--dsw-alias-state-warn-primary)')
    expect(def!.css).toContain('.cBrkua_deleteButton')
    expect(def!.css).toContain('var(--dsw-alias-state-danger-primary)')
  })

  it('已知插件带仓库主页（面板名称可跳转）', () => {
    const urls = new Map(optimizePluginGroups().map((g) => [g.plugin, g.url]))
    expect(urls.get('dsh-better-sidebar')).toBe('https://github.com/omdsh-dev/DSH-better-sidebar')
    expect(urls.get('dsh-cost-meter')).toBe('https://github.com/Han-1413141/dsh-cost-meter')
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
    // rootBorderBox 默认开启：无配置时也在启用集合
    expect(enabledOptimizeIds(undefined).has('dsh.rootBorderBox')).toBe(true)
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

describe('optimize-effects: 刷新首帧本地镜像', () => {
  it('真实配置回写镜像并可读回；无缓存 / 坏数据 → undefined', () => {
    const store = new Map<string, string>()
    const g = globalThis as unknown as { localStorage?: unknown }
    const previous = g.localStorage
    g.localStorage = {
      getItem: (k: string) => store.get(k) ?? null,
      setItem: (k: string, v: string) => void store.set(k, v),
    }
    try {
      expect(readOptimizeCache()).toBeUndefined()
      const config: MegaSettingsConfig = {
        optToggles: { 'dsh.rootBorderBox': false },
        optValues: { 'dsh.leftbarBgAlpha': 40 },
      } as MegaSettingsConfig
      syncOptimizeEffects(config) // node 无 document：写镜像后静默返回
      expect(readOptimizeCache()).toEqual({
        optToggles: { 'dsh.rootBorderBox': false },
        optValues: { 'dsh.leftbarBgAlpha': 40 },
      })
      store.set('dsh-mega-settings.optimize.v1', '{broken')
      expect(readOptimizeCache()).toBeUndefined()
    } finally {
      if (previous === undefined) delete g.localStorage
      else g.localStorage = previous
    }
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

  it('plugin 组每个 def 至少有一种效果（css / cssValue / jsEffect）', () => {
    for (const d of optimizeByGroup('plugin')) {
      const hasCss = d.css !== undefined && d.css.trim().length > 0
      expect(hasCss || typeof d.cssValue === 'function' || d.jsEffect !== undefined, d.id).toBe(true)
    }
  })
})
