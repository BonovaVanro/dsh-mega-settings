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
import { zh, en } from '../src/client/locales.ts'
import { __setDesktopShellForTest } from '../src/client/platform.ts'
import { readFileSync } from 'node:fs'
import type { MegaSettingsConfig } from '../src/schema.ts'

/** 在指定平台上下文里跑一段断言（Node 测试环境无桌面属性 → 默认按 web 处理）。 */
function withPlatform<T>(desktop: boolean, fn: () => T): T {
  __setDesktopShellForTest(desktop)
  try {
    return fn()
  } finally {
    __setDesktopShellForTest(undefined)
  }
}

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

  it('dsh 组 + plugin 组并存（web 20 项 / 桌面 22 项，差值 = 两项 desktopOnly）', () => {
    // web：桌面专属项不注册
    withPlatform(false, () => {
      const dsh = optimizeByGroup('dsh')
      expect(dsh.length).toBe(20)
      expect(optimizeById('dsh.desktopTitlebarBgFollow')).toBeUndefined()
      // 桌面项不出现在任何分组
      expect(dsh.some((d) => d.desktopOnly === true)).toBe(false)
    })
    // 桌面：两项都在
    withPlatform(true, () => {
      const dsh = optimizeByGroup('dsh')
      const plugin = optimizeByGroup('plugin')
      expect(dsh.length).toBe(22)
      expect(plugin.length).toBeGreaterThan(0)
      expect(OPTIMIZE_DEFS.map((d) => d.group)).toEqual([
        ...dsh.map(() => 'dsh' as const),
        ...plugin.map(() => 'plugin' as const),
      ])
    })
  })

  it('桌面版分类：仅桌面壳可见，含两项，且排在左侧边栏之前', () => {
    withPlatform(false, () => {
      expect(OPTIMIZE_DEFS.filter((d) => d.dshSection === 'desktop')).toEqual([])
    })
    withPlatform(true, () => {
      const desktopIds = OPTIMIZE_DEFS.filter((d) => d.dshSection === 'desktop').map((d) => d.id)
      expect(desktopIds).toEqual(['dsh.desktopTitlebarBgFollow', 'dsh.desktopFramePaddingReset'])
      for (const id of desktopIds) {
        expect(optimizeById(id)!.desktopOnly).toBe(true)
      }
    })
    expect((zh as Record<string, string>)['opt.group.dshDesktop']).toBe('桌面版')
    expect((en as Record<string, string>)['opt.group.dshDesktop']).toBe('Desktop app')
    const src = readFileSync(new URL('../src/client/OptimizeCenter.tsx', import.meta.url), 'utf8')
    expect(src.indexOf("tr('opt.group.dshDesktop')")).toBeGreaterThan(-1)
    expect(src.indexOf("tr('opt.group.dshDesktop')")).toBeLessThan(src.indexOf("tr('opt.group.dshLeftbar')"))
  })

  it('正文背景透明度：按统一化状态决定作用范围（开=只选中层 / 关=两层都生效）', () => {
    const alpha = optimizeById('dsh.conversationBgAlpha')!
    const innerSel = '[data-slot="main.conversation"] > [class*="_root"]'
    const colSel = '[data-dsh-surface="conversation"]'
    const inner = '{background:color-mix(in srgb, var(--dsw-alias-bg-base,rgb(27,27,28)) 75%, transparent)!important}'
    const UNIFY = 'dsh.conversationBgUnify'
    // ctx 由同步层注入（真实 config），用例直接构造
    const ctx = (on: boolean, layer?: number) => ({
      values: { [UNIFY]: layer } as Record<string, number | undefined>,
      enabled: (id: string) => on && id === UNIFY,
    })
    // ① 统一化未开启 → 两层都生成
    expect(alpha.cssValue!(25, ctx(false))).toBe(colSel + ',' + innerSel + inner)
    // ② 统一化开启 + 保留中心列（0）→ 只中心列
    expect(alpha.cssValue!(25, ctx(true, 0))).toBe(colSel + inner)
    // ③ 统一化开启 + 保留会话根（1）→ 只会话根
    expect(alpha.cssValue!(25, ctx(true, 1))).toBe(innerSel + inner)
  })

  it('新增「正文」两项：背景颜色统一化（选层）+ 背景透明度（对选中层混色）', () => {
    // ① 背景颜色统一化：选项组 = 中心列 / 会话根；未选中的那层 background:none
    const unify = optimizeById('dsh.conversationBgUnify')
    expect(unify).toBeDefined()
    expect(unify!.dshSection).toBe('content')
    expect(unify!.desktopOnly).toBeUndefined()
    expect(unify!.choiceLabelKey).toBe('opt.value.keepLayer')
    expect(unify!.choices).toEqual([
      { value: 'centerCol', labelKey: 'opt.dsh.layerCenterCol' },
      { value: 'convRoot', labelKey: 'opt.dsh.layerConvRoot' },
    ])
    // 会话根选择器保持简短：只用稳定的 data-slot + 后缀类
    const innerSel = '[data-slot="main.conversation"] > [class*="_root"]'
    // 保留中心列（下标 0）→ 清会话根；保留会话根（下标 1）→ 清中心列
    expect(unify!.cssValue!(0)).toBe(innerSel + '{background:none!important}')
    expect(unify!.cssValue!(1)).toBe('[data-dsh-surface="conversation"]{background:none!important}')
    // ② 背景透明度：对**统一化选中的那一层**混色（读配置决定目标）
    const alpha = optimizeById('dsh.conversationBgAlpha')
    expect(alpha).toBeDefined()
    expect(alpha!.dshSection).toBe('content')
    expect(alpha!.defaultValue).toBe(25)
    const alphaCtx = { values: {}, enabled: () => false } // 统一化未开启 → 两层都生效
    const alphaCss = alpha!.cssValue!(25, alphaCtx)
    expect(alphaCss).toMatch(/^\[data-dsh-surface="conversation"\]/)
    expect(alphaCss).toContain(
      '{background:color-mix(in srgb, var(--dsw-alias-bg-base,rgb(27,27,28)) 75%, transparent)!important}',
    )
    expect(alpha!.cssValue!(0, alphaCtx)).toContain('100%, transparent')
    expect(alpha!.cssValue!(100, alphaCtx)).toContain('0%, transparent')
    // ③ 头部背景移除：静态 css
    const header = optimizeById('dsh.conversationHeaderBgNone')
    expect(header).toBeDefined()
    expect(header!.desktopOnly).toBeUndefined()
    expect(header!.dshSection).toBe('content')
    expect(header!.css).toBe('#root [data-slot="main.conversation"] header{background:none!important}')
    // ④ 「正文」分区成员与注册序（框架背景透明度已移出该分区；文件预览项上移到头部之前）
    const contentIds = OPTIMIZE_DEFS.filter((d) => d.dshSection === 'content').map((d) => d.id)
    expect(contentIds).toEqual([
      'dsh.conversationBgUnify',
      'dsh.conversationBgAlpha',
      'dsh.filePreviewBgAlpha',
      'dsh.conversationHeaderBgNone',
    ])
    // ⑤ 位置要求：框架背景透明度紧跟「Ctrl+Shift+S 打开设置页」；
    //    文件预览背景透明度排在「头部背景移除」之前
    const allIds = OPTIMIZE_DEFS.map((d) => d.id)
    expect(allIds.indexOf('dsh.frameBgAlpha')).toBe(allIds.indexOf('dsh.settingsShortcut') + 1)
    expect(allIds.indexOf('dsh.filePreviewBgAlpha')).toBeLessThan(allIds.indexOf('dsh.conversationHeaderBgNone'))
    // ⑥ 旧的桌面版「框架背景复位」已拆除
    expect(optimizeById('dsh.desktopFrameBgReset')).toBeUndefined()
  })

  it('设置中心：未记录 lastMember 时默认选中「通用设置」页', () => {
    const src = readFileSync(new URL('../src/client/SettingsCenter.tsx', import.meta.url), 'utf8')
    expect(src).toContain('NATIVE_SECTION_IDS')
    expect(src).toMatch(/if \(lm\) return \{ kind: 'member', id: lm \}/)
    expect(src).toMatch(/kind: 'section', id: general/)
    // 默认值只影响选中，不得顺手写入配置（否则会覆盖用户的 lastMember）
    const init = src.slice(src.indexOf('const [open, setOpen] = useState<OpenTarget>'), src.indexOf('const openTarget ='))
    expect(init).not.toContain("scope.set('lastMember'")
  })

  it('「正文」分区排在左侧边栏之前，且分区标题词条齐全（zh/en）', () => {
    expect((zh as Record<string, string>)['opt.group.dshContent']).toBe('正文')
    expect((en as Record<string, string>)['opt.group.dshContent']).toBe('Content')
    const src = readFileSync(new URL('../src/client/OptimizeCenter.tsx', import.meta.url), 'utf8')
    const content = src.indexOf("tr('opt.group.dshContent')")
    const leftbar = src.indexOf("tr('opt.group.dshLeftbar')")
    expect(content).toBeGreaterThan(-1)
    expect(leftbar).toBeGreaterThan(-1)
    expect(content).toBeLessThan(leftbar)
  })

  it('「正文」分区内的项名不再带「正文」二字；文件预览项已改名', () => {
    expect((zh as Record<string, string>)['opt.dsh.filePreviewBgAlpha']).toBe('文件预览背景透明度')
    expect((en as Record<string, string>)['opt.dsh.filePreviewBgAlpha']).toBeDefined()
    expect(optimizeById('dsh.editorFilePreviewBgAlpha')).toBeUndefined()
    for (const key of [
      'opt.dsh.filePreviewBgAlpha',
      'opt.dsh.conversationHeaderBgNone',
      'opt.dsh.mdTableMaxWidth',
    ]) {
      expect((zh as Record<string, string>)[key]).toBeDefined()
      expect((zh as Record<string, string>)[key]!.startsWith('正文')).toBe(false)
    }
  })

  it('「窗口标题背景跟随左侧边栏」def：标题条用与侧栏同一表达式 + JS 重定向探针', () => {
    withPlatform(true, () => {
      const def = optimizeById('dsh.desktopTitlebarBgFollow')
      expect(def).toBeDefined()
      expect(def!.desktopOnly).toBe(true)
      expect(def!.follows).toBe('dsh.leftbarBgAlpha')
      // 按钮部分：JS 把官方探针的取值源重定向到 --mgs-button-fill（不改主题变量）
      expect(def!.jsEffect).toBe('titlebarFill')
      // 标题条部分：与侧栏**同一个表达式**（test.13 的写法）
      const css = def!.cssValue!(30)
      expect(css).toContain('[data-windows-titlebar] #root [data-slot="root"] > [class*="_frame"]:before{background:color-mix(in srgb, var(--dsw-specific-sidebar-fill,rgb(27,27,28)) 70%, transparent)!important}')
      expect(def!.cssValue!(80)).toContain('20%, transparent')
      // 不再修正 `_fade`（跟随开启时主题变量已不被我们改动，渐隐条自然与主题一致）
      expect(def!.css).toBeUndefined()
      expect(css).not.toContain('_fade')
      for (const hash of ['pI_x6G', 'hHd-Xa', 'BynINW', '_2H3hWW']) expect(css).not.toContain(hash)
    })
  })

  it('左侧栏背景透明度不得作用于 frame（框架背景由独立项负责）', () => {
    const def = optimizeById('dsh.leftbarBgAlpha')
    expect(def).toBeDefined()
    const css = def!.cssValue!(30, { values: {}, enabled: () => false })
    expect(css).toContain('#root [data-slot="sidebar"] > [class*="_root"]')
    expect(css).not.toContain('_frame')
    expect(css).not.toContain('data-windows-titlebar')
  })

  it('follows 引用的目标项必须存在（防止配置键名写错后静默失效）', () => {
    for (const def of OPTIMIZE_DEFS) {
      if (def.follows === undefined) continue
      expect(def.follows, def.id).not.toBe(def.id)
      expect(optimizeById(def.follows), def.id + ' → ' + def.follows).toBeDefined()
    }
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

  it('每个 jsEffect 都必须在 JS_EFFECTS 注册表里有实现（防键名写错后静默不生效）', async () => {
    const mod = await import('../src/client/optimize-effects.ts')
    // 通过模块导出间接验证：syncOptimizeEffects 对带 jsEffect 的 def 会挂载效果，
    // 这里只做静态一致性检查 —— 源码里 JS_EFFECTS 必须包含每个 def 用到的键。
    const src = readFileSync(new URL('../src/client/optimize-effects.ts', import.meta.url), 'utf8')
    const keys = new Set(
      Array.from(src.matchAll(/^\s{2}([A-Za-z][A-Za-z0-9]*):\s*enable/gm)).map((m) => m[1]),
    )
    for (const def of OPTIMIZE_DEFS) {
      if (def.jsEffect === undefined) continue
      expect(keys.has(def.jsEffect), def.id + ' → ' + def.jsEffect).toBe(true)
    }
    expect(typeof mod.syncOptimizeEffects).toBe('function')
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

  it('左侧边栏底部动作区布局 def：hash 无关定位 + 纵向 flex + 按钮撑满/条目居中（不依赖折叠标记）', () => {
    const def = optimizeById('dsh.leftbarFooterActionsLayout')
    expect(def).toBeDefined()
    expect(def!.dshSection).toBe('leftbar')
    // 必须用类名后缀定位（CSS-module hash 随构建变化：web hHd-Xa_* / 桌面 _2H3hWW_*）
    expect(def!.css).toContain('[class*="_footerActions"]{display:flex;flex-direction:column;gap:8px}')
    expect(def!.css).toContain('[class*="_footerActions"] button,[class*="_footerActions"] [role="button"]{width:100%!important}')
    expect(def!.css).toContain('[class*="_footerActions"] div{text-align:center}')
    expect(def!.css).not.toContain('hHd-Xa_')
    // 实测 web 与桌面都没有这个属性/类，故不得依赖
    expect(def!.css).not.toContain('[data-sidebar-collapsed]')
    expect(def!.css).not.toContain('_collapsed')
  })

  it('左侧边栏背景颜色统一化 def：下标 0=保留侧栏列（默认），只清另一层', () => {
    const def = optimizeById('dsh.leftbarBgUnify')
    expect(def).toBeDefined()
    expect(def!.dshSection).toBe('leftbar')
    expect(def!.choiceLabelKey).toBe('opt.value.keepLayer')
    // 顺序即下标：第 1 项 = 侧栏列（默认 0），第 2 项 = 侧栏根（1）
    expect(def!.choices).toEqual([
      { value: 'col', labelKey: 'opt.dsh.layerSidebarCol' },
      { value: 'root', labelKey: 'opt.dsh.layerSidebarRoot' },
    ])
    expect(def!.defaultValue).toBe(0)
    const colSel = '#root [class*="_sidebarCol"]'
    const rootSel = '#root [data-slot="sidebar"] > [class*="_root"]'
    // 保留侧栏列 → 清侧栏根；保留侧栏根 → 清侧栏列
    expect(def!.cssValue!(0)).toBe(rootSel + '{background:none!important}')
    expect(def!.cssValue!(1)).toBe(colSel + '{background:none!important}')
    for (const v of [0, 1]) {
      const css = def!.cssValue!(v)
      expect(css).not.toContain('_frame')
      for (const hash of ['pI_x6G', 'hHd-Xa', 'BynINW', '_2H3hWW']) expect(css).not.toContain(hash)
    }
  })

  it('左侧边栏背景透明度 def：与统一化同方向（值 0=保留列 / 1=保留根）', () => {
    const def = optimizeById('dsh.leftbarBgAlpha')
    const unify = optimizeById('dsh.leftbarBgUnify')!
    expect(def).toBeDefined()
    expect(def!.defaultValue).toBe(30)
    const decl =
      '{background:color-mix(in srgb, var(--dsw-specific-sidebar-fill,rgb(27,27,28)) 70%, transparent)!important}'
    const colSel = '#root [class*="_sidebarCol"]'
    const rootSel = '#root [data-slot="sidebar"] > [class*="_root"]'
    const none = '{background:none!important}'
    const ctxOff = { values: {}, enabled: () => false }
    const ctxCol = { values: { 'dsh.leftbarBgUnify': 0 }, enabled: (id: string) => id === 'dsh.leftbarBgUnify' }
    const ctxRoot = { values: { 'dsh.leftbarBgUnify': 1 }, enabled: (id: string) => id === 'dsh.leftbarBgUnify' }
    // 统一化未开启 → 两层都混透
    expect(def!.cssValue!(30, ctxOff)).toBe(colSel + ',' + rootSel + decl)
    // 值 0 = 保留侧栏列 → 透明度的混合必须画在**列**上、并清根
    expect(def!.cssValue!(30, ctxCol)).toBe(colSel + decl + rootSel + none)
    // 值 1 = 保留侧栏根 → 混合画在**根**上、并清列
    expect(def!.cssValue!(30, ctxRoot)).toBe(rootSel + decl + colSel + none)
    // 方向一致性：统一化清掉的那一层，透明度必须正好把混合画在另一层（镜像关系）
    expect(unify.cssValue!(0).startsWith(rootSel)).toBe(true)
    expect(def!.cssValue!(30, ctxCol).startsWith(colSel)).toBe(true)
    expect(unify.cssValue!(1).startsWith(colSel)).toBe(true)
    expect(def!.cssValue!(30, ctxRoot).startsWith(rootSel)).toBe(true)
  })

  it('左侧边栏相关 def 全部不得依赖 CSS-module hash 类，也不得用裸 `_root` 后缀', () => {
    const ids = ['dsh.leftbarBgUnify', 'dsh.leftbarBgAlpha', 'dsh.leftbarFooterActionsLayout']
    for (const id of ids) {
      const def = optimizeById(id)
      expect(def, id).toBeDefined()
      let text = def!.css ?? ''
      if (typeof def!.cssValue === 'function') {
        const c = { values: {}, enabled: () => false }
        text += def!.cssValue!(0, c) + def!.cssValue!(1, c) + def!.cssValue!(25, c)
      }
      expect(text, id).not.toContain('pI_x6G')
      expect(text, id).not.toContain('hHd-Xa')
      expect(text, id).not.toContain('BynINW')
      expect(text, id).not.toContain('_2H3hWW')
      // `[class*="_root"]` 不带 `[data-slot="sidebar"] >` 前缀就是误伤写法（实测命中 542/715 个元素）
      const withoutScoped = text.split('[data-slot="sidebar"] > [class*="_root"]').join('')
      expect(withoutScoped, id).not.toMatch(/\[class\*="_root"\]/)
    }
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

  it('dsh 正文 Markdown 表格限宽 def：max-width 100% + 横向滚动（双锚点覆盖）', () => {
    const def = optimizeById('dsh.mdTableMaxWidth')
    expect(def).toBeDefined()
    expect(def!.group).toBe('dsh')
    // 官方容器类随构建变化：web `.md-table-wide`、桌面 `_tableScroll_*`（实测桌面 .md-table-wide 为 0）
    expect(def!.css).toContain('.md-table-wide,[class*="_tableScroll"]{max-width:100%!important')
    expect(def!.css).toContain('margin-left:0!important')
    expect(def!.css).toContain('padding-left:0!important')
    expect(def!.css).toContain('overflow:scroll')
  })

  it('dsh 全屏隐藏正文工具栏 def：css 作用于全屏帧下的 headerUtilities（hash 无关定位）', () => {
    const def = optimizeById('dsh.rightbarFullscreenHideHeaderUtilities')
    expect(def).toBeDefined()
    expect(def!.group).toBe('dsh')
    // `*_headerUtilities` 在全部内置包里唯一，故用后缀定位（避免 web/桌面 hash 前缀不同而失配）
    expect(def!.css).toContain('[data-rightbar-fullscreen] [class*="_headerUtilities"]')
    expect(def!.css).toContain('display:none')
    expect(def!.css).not.toContain('wSkVaW')
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

  it('dsh-better-sidebar 面板：隐藏底部面板按钮 + 隐藏上下文诊断按钮', () => {
    const g = optimizePluginGroups().find((x) => x.plugin === 'dsh-better-sidebar')
    expect(g).toBeDefined()
    expect(g!.defs.map((d) => d.id)).toEqual([
      'betterSidebar.hideBottomToggle',
      'betterSidebar.hideContextDiagnostics',
    ])
    // 底部面板按钮：沿用插件自带的稳定标记
    const bottom = optimizeById('betterSidebar.hideBottomToggle')!
    expect(bottom.css).toBe('[data-dsh-bottom-toggle]{display:none!important}')
    // 上下文诊断入口：better-sidebar 的 DIAGNOSTICS_ENTRY_ATTR（frame 级告警 data-dsh-ctx-alert 不动）
    const ctx = optimizeById('betterSidebar.hideContextDiagnostics')!
    expect(ctx.target).toBe('dsh-better-sidebar')
    expect(ctx.sectionId).toBe('better-sidebar')
    expect(ctx.css).toBe('[data-dsh-ctx-entry]{display:none!important}')
    expect(ctx.css).not.toContain('data-dsh-ctx-alert')
    // 两项都不得依赖 hash 类
    for (const css of [bottom.css, ctx.css]) {
      for (const hash of ['pI_x6G', 'hHd-Xa', 'BynINW', '_2H3hWW']) expect(css).not.toContain(hash)
    }
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

  it('技能中心优化项已移除（该插件自身已完善主题适配，不再由本插件覆盖其样式）', () => {
    expect(optimizeById('skillExplorer.themeAdapt')).toBeUndefined()
    // 插件组里不应再出现该包（面板不再为其生成分组）
    const plugins = optimizePluginGroups().map((g) => g.plugin)
    expect(plugins).not.toContain('@linxin666/dsh-client-ui-skill-explorer')
    // 产物中不得再有它的 hash 类覆盖规则
    for (const def of OPTIMIZE_DEFS) {
      expect(def.css ?? '', def.id).not.toContain('cBrkua')
      expect(def.target ?? '', def.id).not.toContain('skill-explorer')
    }
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
