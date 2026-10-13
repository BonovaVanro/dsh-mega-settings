/**
 * mega 优化效果同步（client-only）：把配置中的启用集合 + 自定义 CSS 渲染为
 * <style data-plugin="dsh-mega-settings/optimize" data-mgs-opt-id="..."> 标签，
 * 并按 def.jsEffect 挂载/卸载 JS 效果（幂等，差异增删）。
 *
 * 样式标签独立于静态 styles.css（build-client.mjs 注入的 #mgs-styles），HMR 卸载时
 * 需由持有方清理——每次调用会校正全部 data-mgs-opt-id 标签与激活的 JS 效果，
 * 丢失的自动重建/重挂，多余/失效的自动移除/卸载。
 */
import {
  CV_UNIFY_ID,
  FILL_BUTTON,
  LB_UNIFY_ID,
  OPTIMIZE_DEFS,
  enabledOptimizeIds,
  optimizeEnabled,
  optimizeValue,
} from './optimize.ts'

const TAG_PLUGIN = 'dsh-mega-settings/optimize'

/** 同步决策诊断：记录每次同步里"每个 def 拿到什么值、生成什么样式、标签是否被重建"。
 *  用法：控制台执行 __MGS_SYNC_LOG__() 打印最近一次、__MGS_SYNC_LOG__(3) 打印最近三次。 */
const SYNC_LOG: Array<Record<string, unknown>> = []
function pushSyncLog(entry: Record<string, unknown>): void {
  SYNC_LOG.push(entry)
  if (SYNC_LOG.length > 20) SYNC_LOG.shift()
}
if (typeof window !== 'undefined') {
  ;(window as unknown as Record<string, unknown>).__MGS_SYNC_LOG__ = (n = 1) =>
    SYNC_LOG.slice(-Math.max(1, n)).map((e) => JSON.parse(JSON.stringify(e)) as unknown)
}

/* ================= 本地镜像（刷新首帧生效） ================= */

/**
 * 优化配置本地镜像：宿主 settings 快照要走一次 describe 往返（客户端镜像初始 idle、view 为
 * undefined），若等它到达才注入样式，刷新时会先看到未优化的一帧再跳变。这里把「上次已知的
 * 优化配置」落到 localStorage，模块求值阶段（React 渲染前）先按它注入，快照到达后校正。
 */
const OPT_CACHE_KEY = 'dsh-mega-settings.optimize.v1'

/** syncOptimizeEffects 需要的最小配置面（MegaSettingsConfig 结构兼容）。 */
interface OptimizeConfigLike {
  optToggles?: Record<string, boolean>
  optValues?: Record<string, number>
}

/** 读本地镜像；无缓存 / 坏数据 / localStorage 不可用 → undefined（调用方回退各项默认值）。 */
export function readOptimizeCache(): OptimizeConfigLike | undefined {
  try {
    const raw = localStorage.getItem(OPT_CACHE_KEY)
    if (!raw) return undefined
    const parsed = JSON.parse(raw) as { optToggles?: unknown; optValues?: unknown } | null
    if (parsed === null || typeof parsed !== 'object') return undefined
    const toggles = parsed.optToggles
    const values = parsed.optValues
    return {
      optToggles:
        toggles !== null && typeof toggles === 'object' ? (toggles as Record<string, boolean>) : {},
      optValues: values !== null && typeof values === 'object' ? (values as Record<string, number>) : {},
    }
  } catch {
    return undefined
  }
}

/** 回写本地镜像（只存优化相关字段；失败忽略）。 */
function writeOptimizeCache(config: OptimizeConfigLike): void {
  try {
    localStorage.setItem(
      OPT_CACHE_KEY,
      JSON.stringify({ optToggles: config.optToggles ?? {}, optValues: config.optValues ?? {} }),
    )
  } catch {
    /* 忽略 */
  }
}

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
 *
 * 仅「关闭 → 打开」瞬间触发一次：若未全屏则模拟点击官方「全屏」按钮进入全屏；
 * 用户手动退出全屏后不再强制（尊重用户选择）。
 *
 * 状态判定**不能依赖属性**（双端实测 `[data-rightbar-fullscreen]` 与 `[data-sidebar-right-open]`
 * 均命中 0；`[data-sidebar-right-panel]` 则常驻挂载、无法区分开关）：
 * - 「是否已全屏」→ 看官方同一按钮的文案：非全屏为「全屏」、已全屏为「退出全屏」；
 * - 「是否已打开」→ 看面板的**几何**（宽高 > 0；关闭时占位为 0）。
 * 早期实现用 `[data-rightbar-fullscreen]` 判断"已全屏"，属性消失后逻辑退化为「无脑点按钮」，
 * 配合候选里同时含两种文案 → 每次打开都切换一次全屏（实测现象：打开全屏、再打开退出全屏、横跳）。
 */
function enableRightbarDefaultFullscreen(): () => void {
  const TO_FS_LABELS = ['全屏', 'Fullscreen']
  const IN_FS_LABELS = ['退出全屏', 'Exit fullscreen']
  const findBtn = (labels: readonly string[]): HTMLElement | null => {
    for (const label of labels) {
      const btn = document.querySelector<HTMLElement>('[data-sidebar-right-panel] [aria-label="' + label + '"]')
      if (btn !== null) return btn
    }
    return null
  }
  /** 面板是否可见（打开态）：几何判定，关闭时占位为 0。 */
  const panelVisible = (): boolean => {
    const panel = document.querySelector<HTMLElement>('[data-sidebar-right-panel]')
    if (panel === null) return false
    const r = panel.getBoundingClientRect()
    return r.width > 1 && r.height > 1
  }
  /** 仅在「未全屏」时点击进入全屏；已全屏（按钮为「退出全屏」）绝不点击。 */
  const clickToFullscreen = (): boolean => {
    if (findBtn(IN_FS_LABELS) !== null) return true
    const btn = findBtn(TO_FS_LABELS)
    if (btn === null) return false
    btn.click()
    return true
  }

  /* 状态机（纯逻辑，供单测）：只有「可见」由 false → true 的那一次才尝试进入全屏。 */
  let visible = panelVisible()
  let lastVisible = visible
  const onMutation = (): void => {
    visible = panelVisible()
    if (visible && !lastVisible) tryOpen()
    lastVisible = visible
  }
  let pending: number | undefined
  const tryOpen = (): void => {
    if (clickToFullscreen()) return
    if (pending === undefined) {
      // 面板刚打开时按钮可能尚未渲染，短延迟重试一次
      pending = window.setTimeout(() => {
        pending = undefined
        clickToFullscreen()
      }, 120)
    }
  }

  const mo = new MutationObserver(onMutation)
  mo.observe(document.documentElement, {
    subtree: true,
    attributes: true,
    attributeFilter: ['class', 'style', 'aria-label', 'data-rightbar-fullscreen', 'data-sidebar-right-panel'],
  })
  onMutation()
  return () => {
    mo.disconnect()
    if (pending !== undefined) window.clearTimeout(pending)
  }
}

/**
 * dsh：Ctrl+Shift+S 打开设置页。
 * 模拟点击设置壳的触发器按钮打开弹层；preventDefault 拦截浏览器默认（另存为）。
 */
function enableSettingsShortcut(): () => void {
  const onKey = (e: KeyboardEvent): void => {
    if (e.key !== 's' && e.key !== 'S') return
    if (!e.ctrlKey || !e.shiftKey) return
    e.preventDefault()
    const trigger = document.querySelector<HTMLElement>('.triggerRow .trigger')
    if (trigger !== null) trigger.click()
  }
  document.addEventListener('keydown', onKey, true)
  return () => document.removeEventListener('keydown', onKey, true)
}


/**
 * dsh：原生窗口按钮透明化（「窗口标题背景跟随左侧边栏」的按钮部分）。
 *
 * 官方 preload 往 body append 一个隐藏 span 作**取色探针**，其
 * `background-color: var(--dsw-specific-sidebar-fill)` 的计算值就是原生窗口按钮的底色。
 * 本效果把该探针的取值源**重定向**到我们的变量，再由 body 行内值决定按钮颜色：
 *   probe.background-color = var(--mgs-button-fill, var(--dsw-specific-sidebar-fill))
 *   body.style            = --mgs-button-fill: rgba(0, 0, 0, 0)  (important)
 * **完全不修改主题变量** → 侧栏透明度、标题条、工作区渐隐条都不受影响。
 *
 * 探针被主题切换重建时，MutationObserver 会重新识别并改写；
 * 卸载时把探针还原成官方写法、并清掉我们在 body 上写的变量。
 */
function enableTitlebarFill(): () => void {
  const body = document.body
  const PROBE_HINT = '--dsw-specific-sidebar-fill'

  const findProbe = (): HTMLElement | null => {
    const spans = Array.from(document.querySelectorAll<HTMLElement>('body > span'))
    // 实测指纹：内联样式里含 `background-color: var(--dsw-specific-sidebar-fill)`（冒号后有空格）
    return (
      spans.find((el) => (el.getAttribute('style') ?? '').includes('background-color: var(' + PROBE_HINT + ')')) ??
      spans.find((el) => (el.getAttribute('style') ?? '').includes(PROBE_HINT)) ??
      null
    )
  }

  /** 把探针的取色源改指向我们的变量（幂等）。 */
  const redirectProbe = (): void => {
    const probe = findProbe()
    if (probe === null) return
    if (probe.dataset.mgsProbe === '1') return
    probe.dataset.mgsProbe = '1' // 排查用标记：document.querySelector('[data-mgs-probe]')
    probe.style.setProperty(
      'background-color',
      'var(' + FILL_BUTTON + ',var(' + PROBE_HINT + '))',
      'important',
    )
  }

  const apply = (): void => {
    redirectProbe()
    // 按钮底色 = 透明（rgba(0,0,0,0) 是"计算后"形态，能过主进程那道 #hex / rgb()/rgba() 校验）
    body.style.setProperty(FILL_BUTTON, 'rgba(0, 0, 0, 0)', 'important')
  }

  apply()
  let pending: number | undefined
  const schedule = (): void => {
    if (pending !== undefined) return
    pending = window.setTimeout(() => {
      pending = undefined
      apply()
    }, 80)
  }
  const mo = new MutationObserver(schedule)
  // body 子节点变化 = 探针被（重新）插入；head 变化 = 主题换色；html 属性 = 皮肤切换
  mo.observe(body, { childList: true })
  mo.observe(document.documentElement, { attributes: true, attributeFilter: ['style', 'class', 'lang'] })
  mo.observe(document.head, { childList: true, subtree: true, characterData: true })

  return () => {
    mo.disconnect()
    if (pending !== undefined) window.clearTimeout(pending)
    const probe = findProbe()
    if (probe !== null && probe.dataset.mgsProbe === '1') {
      probe.style.setProperty('background-color', 'var(' + PROBE_HINT + ')', 'important')
      delete probe.dataset.mgsProbe
    }
    body.style.removeProperty(FILL_BUTTON)
  }
}

const JS_EFFECTS: Record<string, (() => () => void) | undefined> = {
  rightbarFullscreenZeroTrack: enableRightbarFullscreenZeroTrack,
  rightbarFullscreenPadding: enableRightbarFullscreenPadding,
  rightbarFullscreenEscapeClose: enableRightbarFullscreenEscapeClose,
  rightbarTabOpen: enableRightbarTabOpen,
  rightbarDefaultFullscreen: enableRightbarDefaultFullscreen,
  settingsShortcut: enableSettingsShortcut,
  titlebarFill: enableTitlebarFill,
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
  // **无条件写入**：`tag.textContent` 读回的是浏览器序列化后的结果（可能已做空白处理），
  // 用它和原串比较会出现"看着相同、其实内容已过时"的情况 —— 一旦误判就会留下旧规则，
  // 表现为"改了设置但样式没变"（实测踩过：两个标签内容互相矛盾）。
  tag.textContent = css
}

function removeTag(id: string): void {
  const tag = document.querySelector<HTMLStyleElement>('style[data-mgs-opt-id="' + id + '"][data-plugin="' + TAG_PLUGIN + '"]')
  tag?.remove()
}

/**
 * 让优化标签**始终位于 <head> 末尾**。
 *
 * 官方与第三方 UI 的 CSS 模块是在各自 bundle 求值时注入的（<style data-plugin-css=…>）；
 * 我们的标签为了首帧生效会插得很早，于是同特异性的官方规则（如 .P3OORG_panel 的
 * background）会因为「更靠后」而覆盖我们的覆盖——透明度一类设置就会失效。这里在每次同步
 * 后把标签移到 head 末尾，并观察 head 的新增样式，保持「我们最后」的层叠顺序
 * （与改动前按 React 挂载时机注入时的顺序一致）。
 */
let headObserver: MutationObserver | undefined

function keepTagsLast(): void {
  if (typeof document === 'undefined') return
  const tags = findTags()
  if (tags.length === 0) return
  const last = tags[tags.length - 1]
  if (last.parentElement === document.head && last.nextElementSibling === null) return // 已在末尾
  for (const tag of tags) document.head.appendChild(tag) // 移动（DOM 顺序即层叠顺序）
}

function observeHead(): void {
  if (headObserver !== undefined || typeof document === 'undefined' || typeof MutationObserver === 'undefined') {
    return
  }
  headObserver = new MutationObserver(() => keepTagsLast())
  headObserver.observe(document.head, { childList: true })
  keepTagsLast()
}

/**
 * 按配置校正全部优化效果（样式标签 + JS 效果；幂等；document 不可用时静默跳过）。
 * @param installed 已安装插件包名集合（可选）：plugin 组 def 的目标插件不在其中时
 *  不注入/不挂载（未安装 → 不生效）。
 */
export function syncOptimizeEffects(
  config: OptimizeConfigLike | undefined,
  installed?: ReadonlySet<string>,
  activeSections?: ReadonlySet<string>,
): void {
  // 真实配置（含传参为镜像时，内容一致）落盘 → 下次刷新首帧即可生效
  if (config !== undefined) writeOptimizeCache(config)
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
        // `follows`：数值跟随另一项（如桌面标题栏跟随左侧栏透明度）；
        // 目标项未设置时回退到目标项的默认值，最后兜底本项默认值。
        let value = optimizeValue(config, def.id)
        if (def.follows !== undefined) {
          const followed = optimizeValue(config, def.follows)
          if (followed !== undefined) value = followed
          else {
            const target = OPTIMIZE_DEFS.find((d) => d.id === def.follows)
            value = target?.defaultValue ?? def.defaultValue
          }
        }
        // ctx：把兄弟项的"值 + 是否启用"从**真实 config**注入（与 follows 同一条通路，不读镜像）
        const ctxValues = {
          [CV_UNIFY_ID]: optimizeValue(config, CV_UNIFY_ID),
          [LB_UNIFY_ID]: optimizeValue(config, LB_UNIFY_ID),
        }
        const ctxEnabled = (id: string): boolean => optimizeEnabled(config, id)
        cssText += def.cssValue(value ?? 0, { values: ctxValues, enabled: ctxEnabled })
        if (def.id === 'dsh.leftbarBgAlpha' || def.id === 'dsh.leftbarBgUnify') {
          pushSyncLog({
            def: def.id,
            本项值: value,
            兄弟值: ctxValues,
            兄弟启用: {
              [CV_UNIFY_ID]: ctxEnabled(CV_UNIFY_ID),
              [LB_UNIFY_ID]: ctxEnabled(LB_UNIFY_ID),
            },
            生成: cssText,
          })
        }
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
    // 层叠顺序：保持我们的标签在 head 末尾（官方/第三方 CSS 后注入时同样适用）
    observeHead()
    keepTagsLast()
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


