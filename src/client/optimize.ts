/**
 * mega 优化（OptimizeCenter）注册表：纯数据 + 纯函数，零 DOM/零依赖。
 *
 * 每条优化 = 一个 OptimizeDef：开关持久化于自身配置 optToggles（key = def.id；
 * 缺省 = defaultOn）；启用时注入效果，关闭即移除。效果二选一或并存：
 * - css：注入 style[data-mgs-opt-id] 标签（开关即插拔）；
 * - jsEffect：挂载 optimize-effects.ts 中的 JS 效果（返回清理函数，如需要
 *   保留/恢复宿主内联样式的场景）。新增优化 = 追加一条 def（+ 词条 + 效果），
 *   不改页面代码。
 *
 * 当前形态：dsh 界面组与第三方插件组并存——第三方插件按 target 独立一个
 * mgs-panel，未安装的插件不显示、效果不注入（syncOptimizeEffects 传入 installed
 * 集合过滤）；dsh 组恒显示。
 *
 * 目标选择器约定：只使用官方/插件自身的稳定面（data-* 属性 / --dsh-* 变量 /
 * 各插件 data-dsh-* 标记，均已按 0.1.5-rc 线产物核实），绝不依赖 CSS-Module hash。
 */
export type OptimizeGroup = 'dsh' | 'plugin'

export interface OptimizeDef {
  /** 稳定 id（持久化键：config.optToggles[id]） */
  id: string
  /** 分组：dsh 界面 / 第三方插件 */
  group: OptimizeGroup
  /** 目标插件包名（plugin 组必填）：按此分组 + 已装检测 */
  target?: string
  /** 启用检测：该插件的 settings.section entry id（存在 = 插件已启用；缺省仅按已装判定） */
  sectionId?: string
  /** 默认开启（缺省 false） */
  defaultOn?: boolean
  /** 词条 key：名称 */
  nameKey: string
  /** 词条 key：描述 */
  descKey: string
  /** 启用时注入的 CSS（自持 data-* 标记；开关即插拔） */
  css?: string
  /** 启用时挂载的 JS 效果键（optimize-effects.ts 的 JS_EFFECTS 注册表） */
  jsEffect?: string
  /** 滑块数值默认值（存在即表示该项带滑块配置；值存 config.optValues[id]） */
  defaultValue?: number
  /** 值驱动 CSS 生成器（与 css 二选一）：按当前数值生成注入样式，滑块拖动即时生效 */
  cssValue?: (value: number) => string
}

/** 已知插件的面板标题词条 key（缺省 = 面板直接显示包名）。 */
const PLUGIN_TITLE_KEYS: Record<string, string> = {
  'dsh-better-sidebar': 'opt.plugin.title.betterSidebar',
}

/** 插件组 CSS（只引用各插件自身的 data-dsh-* 稳定标记） */
const CSS = {
  betterSidebarHideBottomToggle: [
    // dsh-better-sidebar 底部面板的展开/收起切换钮
    '[data-dsh-bottom-toggle]{display:none!important}',
  ].join(''),
}

/** 全量注册表（注册序 = 展示序；dsh 组在前、插件组在后）。 */
export const OPTIMIZE_DEFS: readonly OptimizeDef[] = [
  {
    id: 'dsh.rightbarFullscreenZeroTrack',
    group: 'dsh',
    nameKey: 'opt.dsh.rightbarFullscreenZeroTrack',
    descKey: 'opt.dsh.rightbarFullscreenZeroTrack.desc',
    jsEffect: 'rightbarFullscreenZeroTrack',
  },
  {
    id: 'dsh.rightbarFullscreenBgAlpha',
    group: 'dsh',
    nameKey: 'opt.dsh.rightbarFullscreenBgAlpha',
    descKey: 'opt.dsh.rightbarFullscreenBgAlpha.desc',
    // 透明度语义：数值越大越透明（0 = 完全不透明，100 = 全透明）；默认 25 → alpha 75%
    defaultValue: 25,
    cssValue: (v) =>
      '[data-sidebar-right-panel="fullscreen"]{background:rgb(from var(--dsw-alias-bg-base) r g b / ' +
      (100 - Math.max(0, Math.min(100, Math.round(v)))) / 100 +
      ')}',
  },
  {
    id: 'dsh.rightbarFullscreenHideHeaderUtilities',
    group: 'dsh',
    nameKey: 'opt.dsh.rightbarFullscreenHideHeaderUtilities',
    descKey: 'opt.dsh.rightbarFullscreenHideHeaderUtilities.desc',
    // 右栏全屏（frame 带 data-rightbar-fullscreen）时隐藏正文头部工具区；
    // wSkVaW_headerUtilities 为官方对话头 hash 类名（随 dsh 版本可能变化，按需求指定）
    css: '[data-rightbar-fullscreen] .wSkVaW_headerUtilities{display:none!important}',
  },
  {
    id: 'betterSidebar.hideBottomToggle',
    group: 'plugin',
    target: 'dsh-better-sidebar',
    // 启用信号：插件启用时注册 settings.section 条目 id 'better-sidebar'
    sectionId: 'better-sidebar',
    nameKey: 'opt.plugin.betterSidebar.hideBottomToggle',
    descKey: 'opt.plugin.betterSidebar.hideBottomToggle.desc',
    css: CSS.betterSidebarHideBottomToggle,
  },
]

/** 按 id 查注册项。 */
export function optimizeById(id: string): OptimizeDef | undefined {
  return OPTIMIZE_DEFS.find((d) => d.id === id)
}

/** 分组内注册项（保持注册序）。 */
export function optimizeByGroup(group: OptimizeGroup): readonly OptimizeDef[] {
  return OPTIMIZE_DEFS.filter((d) => d.group === group)
}

/** 一个第三方插件 = 一个独立面板（含标题词条 + 该插件的全部优化项）。 */
interface OptimizePluginGroup {
  /** 插件包名（已装检测键 / 面板 key） */
  plugin: string
  /** 面板标题词条 key（缺省 = 直接显示包名） */
  titleKey?: string
  defs: readonly OptimizeDef[]
}

/** 按目标插件分组（保持注册序；无 target 的 def 不计入）。 */
export function optimizePluginGroups(): readonly OptimizePluginGroup[] {
  const map = new Map<string, OptimizeDef[]>()
  const order: string[] = []
  for (const def of OPTIMIZE_DEFS) {
    if (!def.target) continue
    let list = map.get(def.target)
    if (list === undefined) {
      list = []
      map.set(def.target, list)
      order.push(def.target)
    }
    list.push(def)
  }
  return order.map((plugin) => ({
    plugin,
    titleKey: PLUGIN_TITLE_KEYS[plugin],
    defs: map.get(plugin) ?? [],
  }))
}

/** 插件启用判定：def 声明 sectionId 时要求该 section 存在（否则仅按已装判定）。 */
export function optimizeSectionEnabled(activeSections: ReadonlySet<string> | undefined, def: OptimizeDef): boolean {
  if (!def.sectionId) return true
  return activeSections !== undefined && activeSections.has(def.sectionId)
}

/** 开关解析：config.optToggles[id] 优先，缺省 = 该项 defaultOn。 */
export function optimizeEnabled(
  config: { optToggles?: Record<string, boolean> } | undefined,
  id: string,
): boolean {
  // 未注册的 id 一律关闭（即使 optToggles 显式 true 也无效，避免脏键生效）
  const def = optimizeById(id)
  if (!def) return false
  const toggles = config?.optToggles
  if (toggles && typeof toggles === 'object' && id in toggles) return toggles[id] === true
  return def.defaultOn === true
}

/** 当前应启用的优化项 id 集合。 */
export function enabledOptimizeIds(config: { optToggles?: Record<string, boolean> } | undefined): Set<string> {
  const ids = new Set<string>()
  for (const def of OPTIMIZE_DEFS) {
    if (optimizeEnabled(config, def.id)) ids.add(def.id)
  }
  return ids
}

/**
 * 滑块数值解析：config.optValues[id] 优先（越界钳制到 0-100），缺省 = 该项 defaultValue；
 * 无滑块能力（无 defaultValue）返回 undefined。
 */
export function optimizeValue(
  config: { optValues?: Record<string, number> } | undefined,
  id: string,
): number | undefined {
  const def = optimizeById(id)
  if (!def || def.defaultValue === undefined) return undefined
  const values = config?.optValues
  const raw = values && typeof values === 'object' && id in values ? values[id] : undefined
  if (typeof raw === 'number' && Number.isFinite(raw)) return Math.max(0, Math.min(100, raw))
  return def.defaultValue
}

/** 校验注册表完整性（供单测/启动自检）：id 唯一、css 非空、plugin 组有 target。 */
export function validateOptimizeRegistry(defs: readonly OptimizeDef[] = OPTIMIZE_DEFS): string[] {
  const errors: string[] = []
  const seen = new Set<string>()
  for (const def of defs) {
    if (!def.id || seen.has(def.id)) errors.push('duplicate/empty id: ' + def.id)
    seen.add(def.id)
    const hasCss = (def.css !== undefined && def.css.trim().length > 0) || typeof def.cssValue === 'function'
    if (!hasCss && !def.jsEffect) errors.push('empty css/cssValue/jsEffect: ' + def.id)
    if (typeof def.cssValue === 'function' && def.defaultValue === undefined) {
      errors.push('cssValue without defaultValue: ' + def.id)
    }
    if (def.group === 'plugin' && !def.target) errors.push('plugin def without target: ' + def.id)
    if (def.group !== 'dsh' && def.group !== 'plugin') errors.push('bad group: ' + def.id)
    if (!def.nameKey || !def.descKey) errors.push('missing locale keys: ' + def.id)
  }
  return errors
}
