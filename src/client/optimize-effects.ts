/**
 * mega 优化效果同步（client-only）：把配置中的启用集合 + 自定义 CSS 渲染为
 * <style data-plugin="dsh-mega-settings/optimize" data-mgs-opt-id="..."> 标签，
 * 并按 def.jsEffect 挂载/卸载 JS 效果（幂等，差异增删）。
 *
 * 样式标签独立于静态 styles.css（build-client.mjs 注入的 #mgs-styles），HMR 卸载时
 * 需由持有方清理——每次调用会校正全部 data-mgs-opt-id 标签与激活的 JS 效果，
 * 丢失的自动重建/重挂，多余/失效的自动移除/卸载。
 */
import type { MegaSettingsConfig } from '../schema.ts'
import { OPTIMIZE_DEFS, enabledOptimizeIds, optimizeValue } from './optimize.ts'

const TAG_PLUGIN = 'dsh-mega-settings/optimize'

/* ================= JS 效果注册表 ================= */

/**
 * 按「括号外空格」切分 grid-template-columns 的轨道。
 * 不能用 split(/\s+/)：minmax(0, 1fr) 内部含空格会被切碎，导致拼出坏值。
 */
export function splitGridTracks(value: string): string[] {
  const parts: string[] = []
  let depth = 0
  let cur = ''
  for (const ch of value) {
    if (ch === '(') depth += 1
    else if (ch === ')') depth = Math.max(0, depth - 1)
    if (ch === ' ' && depth === 0) {
      if (cur.length > 0) parts.push(cur)
      cur = ''
      continue
    }
    cur += ch
  }
  if (cur.length > 0) parts.push(cur)
  return parts
}

/**
 * 全屏零占位改写：把 grid-template-columns 的第三轨置 0（前两轨原样保留）。
 * 无法解析出三轨（如空/仅两轨）时返回 null（不改写）。
 */
export function fullscreenZeroTrackValue(inline: string): string | null {
  const parts = splitGridTracks(inline)
  if (parts.length < 3) return null
  return parts[0] + ' ' + parts[1] + ' 0px'
}

/**
 * dsh：右侧边栏全屏时，其网格占位轨强制为 0。
 *
 * 背景：布局（dsh-client-ui-layout）在全屏时仅切换帧的 data-rightbar-fullscreen，
 * grid-template-columns 的第三轨（rightbar 占位宽度）仍保留常规值 → 中心列被挤压。
 * 纯 CSS 无法只改第三轨（须同时给出前两轨的动态值），故用轻量 MutationObserver：
 * - 进入全屏（attr 出现）：把内联 grid-template-columns 改写为「前两轨原样 + 0px」；
 * - 退出全屏（attr 移除）/ 关闭效果：恢复原值（React 在状态不变时不会重写该内联属性，必须自行恢复）。
 * 恢复判定不依赖 matches('[data-rightbar-fullscreen]')（属性移除后不再匹配），
 * 而是「当前在全屏 → 改写；被我们改写过的帧 → 恢复」。
 */
function enableRightbarFullscreenZeroTrack(): () => void {
  const FRAME_SEL = '[data-rightbar-fullscreen]'
  /** 帧 → React（布局）最近写入的原值（不是我们改写过的值）。 */
  const baseline = new Map<HTMLElement, string>()
  /** 帧 → 我们最近写入的改写值（无 = 当前未被我们改写）。 */
  const override = new Map<HTMLElement, string>()

  /** 对单个帧：按「属性状态 + 当前内联值」决策。仅由 MutationObserver 在属性变化时驱动，无 rAF 循环。 */
  const handle = (el: HTMLElement): void => {
    const current = el.style.gridTemplateColumns
    const myOverride = override.get(el)
    if (el.hasAttribute('data-rightbar-fullscreen')) {
      // 全屏（无论左侧栏开合）：以当前（React 最近）值为基线，第三轨强制 0
      const next = fullscreenZeroTrackValue(current)
      if (next !== null && next !== current) {
        baseline.set(el, current)
        el.style.gridTemplateColumns = next
        override.set(el, next)
      }
    } else if (myOverride !== undefined) {
      if (myOverride === current) {
        // 仍是我们改写过的值 → 交还官方：恢复基线（带 data-rightbar-collapsed 保护）
        restore(el, el.hasAttribute('data-rightbar-collapsed'))
      } else {
        // React 已重写新值（如左侧栏折叠/右栏关闭）→ 以其为基线，放弃改写
        baseline.set(el, current)
        override.delete(el)
      }
    }
  }
  const restore = (el: HTMLElement, rightbarCollapsed: boolean): void => {
    const current = el.style.gridTemplateColumns
    // 官方已应用「右栏轨道为 0」（面板关闭/自动全屏）→ 交还官方，不覆盖陈旧基线
    if (!rightbarCollapsed) {
      const base = baseline.get(el)
      if (base !== undefined && base.length > 0 && base !== current) el.style.gridTemplateColumns = base
    }
    baseline.delete(el)
    override.delete(el)
  }
  const mo = new MutationObserver((records) => {
    const seen = new Set<HTMLElement>()
    for (const rec of records) {
      const el = rec.target as HTMLElement | null
      if (el === null || typeof el.hasAttribute !== 'function') continue
      if (seen.has(el)) continue
      seen.add(el)
      handle(el)
    }
  })
  mo.observe(document.documentElement, {
    subtree: true,
    attributes: true,
    attributeFilter: ['data-rightbar-fullscreen', 'data-sidebar-collapsed', 'data-rightbar-collapsed'],
  })
  // 效果后开且已处于全屏 → 立即按当前状态处理
  document.querySelectorAll<HTMLElement>(FRAME_SEL).forEach((el) => handle(el))
  return () => {
    mo.disconnect()
    for (const el of Array.from(baseline.keys())) {
      restore(el, el.hasAttribute('data-rightbar-collapsed'))
    }
  }
}
/**
 * dsh：右侧边栏全屏下内边距优化。
 * 全屏面板 padding 继承 #root 的 padding（不叠加头部 padding-top）。
 * 仅「变化触发」：观察 #root 的 style/class 与文档子节点（面板挂载），不做常驻轮询。
 */
function enableRightbarFullscreenPadding(): () => void {
  const PANEL_SEL = '[data-sidebar-right-panel]'
  const observed = new Set<HTMLElement>()
  const apply = (): void => {
    const root = document.getElementById('root')
    const panel = document.querySelector<HTMLElement>(PANEL_SEL)
    if (root === null || panel === null) return
    // 面板常驻挂载（全屏 ↔ push 只切属性）：首次命中即开始观察其属性，退出全屏时恢复
    if (!observed.has(panel)) {
      observed.add(panel)
      mo.observe(panel, { attributes: true, attributeFilter: ['data-sidebar-right-panel'] })
    }
    if (panel.getAttribute('data-sidebar-right-panel') !== 'fullscreen') {
      // 非全屏：恢复官方（移除我们写的内联 padding）
      panel.style.removeProperty('padding')
      panel.style.removeProperty('padding-top')
      return
    }
    const rp = getComputedStyle(root)
    panel.style.setProperty('padding', rp.paddingTop + ' ' + rp.paddingRight + ' ' + rp.paddingBottom + ' ' + rp.paddingLeft)
  }
  const mo = new MutationObserver(apply)
  const root = document.getElementById('root')
  if (root !== null) mo.observe(root, { attributes: true, attributeFilter: ['style', 'class'] })
  // 面板挂载/结构变化（childList 变化触发，非轮询）
  mo.observe(document.documentElement, { subtree: true, childList: true })
  apply()
  return () => {
    mo.disconnect()
    const panel = document.querySelector<HTMLElement>(PANEL_SEL)
    if (panel !== null) {
      panel.style.removeProperty('padding')
      panel.style.removeProperty('padding-top')
    }
  }
}

/**
 * dsh：右侧边栏全屏下 ESC 关闭侧边栏。
 * 全屏（frame 带 data-rightbar-fullscreen）时按 ESC → 模拟点击官方「收起右侧边栏」按钮。
 */
function enableRightbarFullscreenEscapeClose(): () => void {
  const COLLAPSE_LABELS = ['收起右侧边栏', 'Collapse right sidebar']
  const onKey = (e: KeyboardEvent): void => {
    if (e.key !== 'Escape') return
    const frame = document.querySelector<HTMLElement>('[data-rightbar-fullscreen]')
    if (frame === null) return
    for (const label of COLLAPSE_LABELS) {
      const btn = document.querySelector<HTMLElement>('[aria-label="' + label + '"]')
      if (btn !== null) {
        e.preventDefault()
        btn.click()
        return
      }
    }
  }
  document.addEventListener('keydown', onKey, true)
  return () => document.removeEventListener('keydown', onKey, true)
}

/**
 * dsh：右侧边栏 TAB 打开。
 * 仅「关闭状态」下挂 TAB 监听；打开/全屏/设置页弹层打开后立即移除监听（TAB 恢复焦点导航），关闭后再挂上。
 * 状态变化由 MutationObserver 观察 data-sidebar-right-open / data-rightbar-fullscreen / 弹层增删 触发（非轮询）。
 */
function enableRightbarTabOpen(): () => void {
  const EXPAND_LABELS = ['打开右侧边栏', 'Open right sidebar']
  let listening = false

  const onKey = (e: KeyboardEvent): void => {
    if (e.key !== 'Tab') return
    for (const label of EXPAND_LABELS) {
      const btn = document.querySelector<HTMLElement>('[aria-label="' + label + '"]')
      if (btn !== null) {
        e.preventDefault()
        btn.click()
        return
      }
    }
  }

  const setListening = (on: boolean): void => {
    if (on && !listening) {
      document.addEventListener('keydown', onKey, true)
      listening = true
    } else if (!on && listening) {
      document.removeEventListener('keydown', onKey, true)
      listening = false
    }
  }

  const sync = (): void => {
    const open = document.querySelector('[data-sidebar-right-open]') !== null
    const fullscreen = document.querySelector('[data-rightbar-fullscreen]') !== null
    const dialog = document.querySelector('[role="dialog"]') !== null // 设置页等弹层打开时也不拦截 TAB
    setListening(!open && !fullscreen && !dialog)
  }

  const mo = new MutationObserver(sync)
  // open/全屏 状态属性变化 + 弹层增删（childList）才触发（非轮询）
  mo.observe(document.documentElement, {
    subtree: true,
    attributes: true,
    attributeFilter: ['data-sidebar-right-open', 'data-rightbar-fullscreen'],
    childList: true,
  })
  sync()
  return () => {
    setListening(false)
    mo.disconnect()
  }
}

/**
 * dsh：右侧边栏默认全屏。
 * 仅「关闭 → 打开」瞬间触发一次：若未全屏则模拟点击官方「全屏」按钮进入全屏；
 * 手动退出全屏后不再强制（用户已自主选择）。状态变化观察 data-sidebar-right-open / data-rightbar-fullscreen。
 */
function enableRightbarDefaultFullscreen(): () => void {
  const TO_FS_LABELS = ['全屏', 'Fullscreen']
  const clickToFullscreen = (): boolean => {
    for (const label of TO_FS_LABELS) {
      const btn = document.querySelector<HTMLElement>('[data-sidebar-right-panel] [aria-label="' + label + '"]')
      if (btn !== null) {
        btn.click()
        return true
      }
    }
    return false
  }
  let pending: number | undefined
  const tryOpenFullscreen = (): void => {
    if (clickToFullscreen()) return
    if (pending === undefined) {
      pending = window.setTimeout(() => {
        pending = undefined
        clickToFullscreen()
      }, 80)
    }
  }
  const initialOpen = document.querySelector('[data-sidebar-right-open]') !== null
  let wasOpen = initialOpen // 初始已打开不强制，仅对之后的打开动作生效
  const sync = (): void => {
    const open = document.querySelector('[data-sidebar-right-open]') !== null
    const fullscreen = document.querySelector('[data-rightbar-fullscreen]') !== null
    if (open && !wasOpen && !fullscreen) tryOpenFullscreen()
    wasOpen = open
  }
  const mo = new MutationObserver(sync)
  mo.observe(document.documentElement, {
    subtree: true,
    attributes: true,
    attributeFilter: ['data-sidebar-right-open', 'data-rightbar-fullscreen'],
  })
  sync()
  return () => {
    mo.disconnect()
    if (pending !== undefined) window.clearTimeout(pending)
  }
}

const JS_EFFECTS: Record<string, (() => () => void) | undefined> = {
  rightbarFullscreenZeroTrack: enableRightbarFullscreenZeroTrack,
  rightbarFullscreenPadding: enableRightbarFullscreenPadding,
  rightbarFullscreenEscapeClose: enableRightbarFullscreenEscapeClose,
  rightbarTabOpen: enableRightbarTabOpen,
  rightbarDefaultFullscreen: enableRightbarDefaultFullscreen,
}

/** 当前挂载中的 JS 效果（key → disposer）。 */
const activeJs = new Map<string, () => void>()

/* ================= 样式标签 ================= */

function findTags(): HTMLStyleElement[] {
  const tags = document.querySelectorAll<HTMLStyleElement>('style[data-mgs-opt-id]')
  const out: HTMLStyleElement[] = []
  for (const tag of Array.from(tags)) {
    if (tag.dataset.plugin === TAG_PLUGIN) out.push(tag)
  }
  return out
}

function upsertTag(id: string, css: string): void {
  if (!css) {
    removeTag(id)
    return
  }
  let tag = document.querySelector<HTMLStyleElement>('style[data-mgs-opt-id="' + id + '"][data-plugin="' + TAG_PLUGIN + '"]')
  if (tag === null) {
    tag = document.createElement('style')
    tag.dataset.plugin = TAG_PLUGIN
    tag.dataset.mgsOptId = id
    document.head.appendChild(tag)
  }
  if (tag.textContent !== css) tag.textContent = css
}

function removeTag(id: string): void {
  const tag = document.querySelector<HTMLStyleElement>('style[data-mgs-opt-id="' + id + '"][data-plugin="' + TAG_PLUGIN + '"]')
  tag?.remove()
}

/**
 * 按配置校正全部优化效果（样式标签 + JS 效果；幂等；document 不可用时静默跳过）。
 * @param installed 已安装插件包名集合（可选）：plugin 组 def 的目标插件不在其中时
 *  不注入/不挂载（未安装 → 不生效）。
 */
export function syncOptimizeEffects(
  config: MegaSettingsConfig | undefined,
  installed?: ReadonlySet<string>,
  activeSections?: ReadonlySet<string>,
): void {
  if (typeof document === 'undefined') return
  try {
    const enabled = enabledOptimizeIds(config)
    // 样式标签（静态 css / 值驱动 cssValue）
    const wanted = new Map<string, string>()
    // JS 效果（按 jsEffect 键去重挂载）
    const wantedJs = new Set<string>()
    for (const def of OPTIMIZE_DEFS) {
      if (!enabled.has(def.id)) continue
      if (installed !== undefined && def.target !== undefined && !installed.has(def.target)) continue
      // 插件未启用（其 settings.section 条目不存在）→ 不注入
      if (activeSections !== undefined && def.sectionId && !activeSections.has(def.sectionId)) continue
      // 静态 css 与值驱动 cssValue 合并为同一标签（同一 def.id）
      let cssText = ''
      if (def.css) cssText += def.css
      if (typeof def.cssValue === 'function') {
        cssText += def.cssValue(optimizeValue(config, def.id) ?? 0)
      }
      if (cssText) wanted.set(def.id, cssText)
      if (def.jsEffect && JS_EFFECTS[def.jsEffect]) wantedJs.add(def.jsEffect)
    }
    // 增/改样式标签
    for (const [id, css] of wanted) upsertTag(id, css)
    // 删：不再需要的标签
    for (const tag of findTags()) {
      const id = tag.dataset.mgsOptId ?? ''
      if (!wanted.has(id)) tag.remove()
    }
    // JS 效果：卸载不再需要的
    for (const [key, dispose] of activeJs) {
      if (!wantedJs.has(key)) {
        dispose()
        activeJs.delete(key)
      }
    }
    // 挂载新需要的
    for (const key of wantedJs) {
      if (!activeJs.has(key)) {
        const start = JS_EFFECTS[key]
        if (start) activeJs.set(key, start())
      }
    }
  } catch {
    /* 效果同步失败不影响逻辑 */
  }
}


