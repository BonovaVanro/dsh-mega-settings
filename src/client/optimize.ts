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
  /** dsh 组子区（如 'rightbar' → 「dsh 界面-右侧边栏」；缺省 = dsh 一般区） */
  dshSection?: string
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
  /** 数值默认值（存在即表示该项带数值配置；滑块或选项组，值存 config.optValues[id]） */
  defaultValue?: number
  /** 滑块上限（缺省 100） */
  maxValue?: number
  /** 数字输入框（无上限数值如层级；缺省为滑块） */
  numberInput?: boolean
  /** 数值行左侧标签词条 key（缺省 opt.value.transparency） */
  valueLabelKey?: string
  /** 选项组（如峰值时段颜色 warn/danger/error）：存在时该项渲染为分段选择而非滑块 */
  choices?: { value: string; labelKey: string }[]
  /** 选项组左侧标签词条 key（choices 存在时） */
  choiceLabelKey?: string
  /** 值驱动 CSS 生成器：按当前数值生成注入样式（滑块 = 0-100；选项组 = 所选下标） */
  cssValue?: (value: number) => string
}

/** 已知插件的面板标题词条 key（缺省 = 面板直接显示包名）。 */
const PLUGIN_TITLE_KEYS: Record<string, string> = {
  'dsh-better-sidebar': 'opt.plugin.title.betterSidebar',
  'dsh-cost-meter': 'opt.plugin.title.costMeter',
  'dsh-client-ui-skill-explorer': 'opt.plugin.title.skillExplorer',
}

/** 已知插件的仓库主页（面板名称可点击跳转）。 */
const PLUGIN_URLS: Record<string, string> = {
  'dsh-better-sidebar': 'https://github.com/omdsh-dev/DSH-better-sidebar',
  'dsh-cost-meter': 'https://github.com/Han-1413141/dsh-cost-meter',
}

/** 插件组 CSS（只引用各插件自身的稳定标记） */
const CSS = {
  betterSidebarHideBottomToggle: [
    // dsh-better-sidebar 底部面板的展开/收起切换钮
    '[data-dsh-bottom-toggle]{display:none!important}',
  ].join(''),
  costMeterPeakValley: [
    // 峰谷计价：周末标记/标签 → business 语义色
    '.cm-peak-strip.weekend .cm-peak-chip,.cm-peak-classic.weekend .cm-peak-classic-chip,.cm-peak-rail.weekend .cm-peak-rail-label,.cm-peak-rail-classic.weekend .cm-peak-rail-classic-label{color:var(--dsw-alias-state-business-primary)}',
    // 标记：无背景无边框无阴影（classic / rail-classic / peak / rail）；经典标记周末 border-color 归 none
    '.cm-peak-classic-marker{background:none;border:none;box-shadow:none}',
    '.cm-peak-rail-classic-marker{background:none;border:none;box-shadow:none}',
    '.cm-peak-marker,.cm-peak-rail-marker{background:none;box-shadow:none}',
    '.cm-peak-classic.weekend .cm-peak-classic-marker{border-color:none}',
    // 周末标记 :after 三角 → business；tooltip 文案 → label-primary；classic tooltip 背景 → 侧栏填充色
    '.cm-peak-classic.weekend .cm-peak-classic-marker:after{border-top-color:var(--dsw-alias-state-business-primary)}',
    '.cm-footer-stack span[role="tooltip"]{color:var(--dsw-alias-label-primary)}',
    '.cm-footer-stack span[role="tooltip"]{background:var(--dsw-specific-sidebar-fill)}',
  ].join(''),
}
/** 峰值时段颜色选项（可配置：warn / danger / error）→ 各峰段元素 */
const PEAK_HIGH_TOKENS = ['warn', 'danger', 'error'] as const
function costMeterPeakHighCss(v: number): string {
  const token = PEAK_HIGH_TOKENS[Math.max(0, Math.min(2, Math.round(v)))] ?? 'error'
  const color = 'var(--dsw-alias-state-' + token + '-primary)'
  return (
    '.cm-peak-classic-marker:after{border-top:6px solid ' + color + '}' +
    '.cm-peak-high{background:' + color + '}' +
    '.cm-peak-rail-high{background:' + color + '}' +
    '.cm-peak-rail-classic-segment.peak{background:' + color + '}' +
    '.cm-peak-strip.peak .cm-peak-chip,.cm-peak-classic.peak .cm-peak-classic-chip,.cm-peak-rail.peak .cm-peak-rail-label,.cm-peak-rail-classic.peak .cm-peak-rail-classic-label{color:' + color + '}'
  )
}

/** 全量注册表（注册序 = 展示序；dsh 组在前、插件组在后）。 */
export const OPTIMIZE_DEFS: readonly OptimizeDef[] = [
  {
    id: 'dsh.rootBorderBox',
    group: 'dsh',
    defaultOn: true, // 默认生效
    nameKey: 'opt.dsh.rootBorderBox',
    descKey: 'opt.dsh.rootBorderBox.desc',
    // 主题根元素设为 border-box（置于 dsh 组最前）
    css: '#root{box-sizing:border-box!important}',
  },
  {
    id: 'dsh.rightbarFullscreenZeroTrack',
    group: 'dsh',
    dshSection: 'rightbar',
    nameKey: 'opt.dsh.rightbarFullscreenZeroTrack',
    descKey: 'opt.dsh.rightbarFullscreenZeroTrack.desc',
    jsEffect: 'rightbarFullscreenZeroTrack',
  },
  {
    id: 'dsh.rightbarFullscreenBgAlpha',
    group: 'dsh',
    dshSection: 'rightbar',
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
    dshSection: 'rightbar',
    nameKey: 'opt.dsh.rightbarFullscreenHideHeaderUtilities',
    descKey: 'opt.dsh.rightbarFullscreenHideHeaderUtilities.desc',
    // 右栏全屏（frame 带 data-rightbar-fullscreen）时隐藏正文头部工具区；
    // wSkVaW_headerUtilities 为官方对话头 hash 类名（随 dsh 版本可能变化，按需求指定）
    css: '[data-rightbar-fullscreen] .wSkVaW_headerUtilities{display:none!important}',
  },
  {
    id: 'dsh.rightbarFullscreenZIndex',
    group: 'dsh',
    dshSection: 'rightbar',
    nameKey: 'opt.dsh.rightbarFullscreenZIndex',
    descKey: 'opt.dsh.rightbarFullscreenZIndex.desc',
    // 右侧边栏全屏面板层级：数字输入框（无上限），默认 41
    defaultValue: 41,
    numberInput: true,
    valueLabelKey: 'opt.value.zIndex',
    cssValue: (v) => '[data-sidebar-right-panel="fullscreen"]{z-index:' + Math.round(v) + '!important}',
  },
  {
    id: 'dsh.rightbarFullscreenPadding',
    group: 'dsh',
    dshSection: 'rightbar',
    nameKey: 'opt.dsh.rightbarFullscreenPadding',
    descKey: 'opt.dsh.rightbarFullscreenPadding.desc',
    // 全屏面板内边距继承 #root + 叠加正文头部 padding-top（变化触发，不常驻监听）
    jsEffect: 'rightbarFullscreenPadding',
  },
  {
    id: 'dsh.rightbarFullscreenEscapeClose',
    group: 'dsh',
    dshSection: 'rightbar',
    nameKey: 'opt.dsh.rightbarFullscreenEscapeClose',
    descKey: 'opt.dsh.rightbarFullscreenEscapeClose.desc',
    // 右侧边栏全屏时按 ESC 收起侧边栏（模拟点击官方「收起右侧边栏」按钮）
    jsEffect: 'rightbarFullscreenEscapeClose',
  },
  {
    id: 'dsh.rightbarTabOpen',
    group: 'dsh',
    dshSection: 'rightbar',
    nameKey: 'opt.dsh.rightbarTabOpen',
    descKey: 'opt.dsh.rightbarTabOpen.desc',
    // 右侧边栏未打开时按 TAB 打开（模拟点击官方「打开右侧边栏」按钮）
    jsEffect: 'rightbarTabOpen',
  },
  {
    id: 'dsh.rightbarDefaultFullscreen',
    group: 'dsh',
    dshSection: 'rightbar',
    nameKey: 'opt.dsh.rightbarDefaultFullscreen',
    descKey: 'opt.dsh.rightbarDefaultFullscreen.desc',
    // 打开右侧边栏时默认进入全屏（仅打开瞬间触发一次；手动退出全屏后不强制）
    jsEffect: 'rightbarDefaultFullscreen',
  },
  {
    id: 'dsh.leftbarBgUnify',
    group: 'dsh',
    dshSection: 'leftbar',
    nameKey: 'opt.dsh.leftbarBgUnify',
    descKey: 'opt.dsh.leftbarBgUnify.desc',
    // 背景颜色统一化：单一控制源（布局层 pI_x6G_sidebarCol / 模块层 hHd-Xa_root）。
    // 选中其一 → 另一层 background 强制 none！important
    defaultValue: 0, // 布局层
    choices: [
      { value: 'layout', labelKey: 'opt.dsh.leftbarBgUnify.option.layout' },
      { value: 'module', labelKey: 'opt.dsh.leftbarBgUnify.option.module' },
    ],
    choiceLabelKey: 'opt.dsh.leftbarBgUnify.target',
    cssValue: (v) =>
      v === 1 ? '.pI_x6G_sidebarCol{background:none!important}' : '.hHd-Xa_root{background:none!important}',
  },
  {
    id: 'dsh.leftbarBgAlpha',
    group: 'dsh',
    dshSection: 'leftbar',
    nameKey: 'opt.dsh.leftbarBgAlpha',
    descKey: 'opt.dsh.leftbarBgAlpha.desc',
    // 背景透明度：侧栏填充色去除原有 alpha，并按设置混合（透明度数值越大越透明；默认 25 → alpha 75%）
    defaultValue: 25,
    valueLabelKey: 'opt.value.transparency',
    cssValue: (v) =>
      '.pI_x6G_sidebarCol,.hHd-Xa_root{background:rgb(from var(--dsw-specific-sidebar-fill) r g b / ' +
      (100 - Math.max(0, Math.min(100, Math.round(v)))) / 100 +
      ')}',
  },
  {
    id: 'dsh.leftbarFooterActionsLayout',
    group: 'dsh',
    dshSection: 'leftbar',
    nameKey: 'opt.dsh.leftbarFooterActionsLayout',
    descKey: 'opt.dsh.leftbarFooterActionsLayout.desc',
    // 侧栏底部动作区纵向排列（官方 .hHd-Xa_footerActions 原本为横向 flex）
    // 折叠时（.hHd-Xa_collapsed / [data-sidebar-collapsed]）：按钮撑满宽度，动作区内的 div（含嵌套，如 cost-meter 的 .cm-footer-stack 及其行）文本居中
    css: [
      '.hHd-Xa_footerActions{display:flex;flex-direction:column;gap:8px}',
      '.hHd-Xa_collapsed .hHd-Xa_footerActions button,.hHd-Xa_collapsed .hHd-Xa_footerActions [role="button"],[data-sidebar-collapsed] .hHd-Xa_footerActions button,[data-sidebar-collapsed] .hHd-Xa_footerActions [role="button"]{width:100%!important}',
      '.hHd-Xa_collapsed .hHd-Xa_footerActions div,[data-sidebar-collapsed] .hHd-Xa_footerActions div{text-align:center}',
    ].join(''),
  },
  {
    id: 'dsh.hoverCardTheme',
    group: 'dsh',
    dshSection: 'leftbar',
    nameKey: 'opt.dsh.hoverCardTheme',
    descKey: 'opt.dsh.hoverCardTheme.desc',
    // 会话悬停卡（复制卡，dsh-client-ui-workspace）：官方硬编码 #2C2C2E 背景 + #fff/#cfd3d6/#adb2b8 文字
    // 全部改为主题语义色，可被皮肤控制。选择器用稳定信号 role=button + aria-label^=「复制:/Copy:」
    // （hash 类 YDXeBa_*/_card_1b2ny_* 不稳定）；状态点用 data-state + currentColor（已主题化），用 :not([data-state]) 排除。
    css: [
      '[role="button"][aria-label^="复制:"],[role="button"][aria-label^="Copy:"]{--dsw-hovercard-bg:var(--dsw-alias-bg-layer-2)!important}',
      '[role="button"][aria-label^="复制:"]>div>div:first-child,[role="button"][aria-label^="Copy:"]>div>div:first-child{color:var(--dsw-alias-label-primary)!important}',
      '[role="button"][aria-label^="复制:"] div,[role="button"][aria-label^="Copy:"] div,[role="button"][aria-label^="复制:"] span:not([data-state]),[role="button"][aria-label^="Copy:"] span:not([data-state]){color:var(--dsw-alias-label-secondary)!important}',
    ].join(''),
  },
  {
    id: 'dsh.mdTableMaxWidth',
    group: 'dsh',
    nameKey: 'opt.dsh.mdTableMaxWidth',
    descKey: 'opt.dsh.mdTableMaxWidth.desc',
    // 正文 Markdown 表格限制最大宽度 100%，横向滚动条常驻（便于发现可滚动）。
    // 官方规则为 .hWmORq_body .md-table-wide（双类，特异性更高且 hash 类名不可依赖），
    // 关键属性用 !important 覆盖官方 max-width:none / 负 margin / padding 撑宽
    // 正文 Markdown 表格限制最大宽度 100%，滚动条常驻。
    // 必须的修正：!important 压过官方 .hWmORq_body .md-table-wide / ._tableScroll_kcgor_190.md-table-wide
    // （官方 max-width:none / 负 margin / padding-bottom:var(--dsh-scrollbar-width,8px) 预留）
    css: '.md-table-wide{max-width:100%!important;margin-left:0!important;padding-left:0!important;overflow:scroll}',
  },
  {
    id: 'dsh.settingsShortcut',
    group: 'dsh',
    nameKey: 'opt.dsh.settingsShortcut',
    descKey: 'opt.dsh.settingsShortcut.desc',
    // Ctrl+Shift+S 打开设置页（模拟点击壳的触发器；preventDefault 拦截浏览器“另存为”）
    jsEffect: 'settingsShortcut',
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
  {
    id: 'costMeter.peakValleyTheme',
    group: 'plugin',
    target: 'dsh-cost-meter',
    // 启用信号：插件启用时注册 settings.section 条目 id 'cost-meter'
    sectionId: 'cost-meter',
    nameKey: 'opt.plugin.costMeter.peakValleyTheme',
    descKey: 'opt.plugin.costMeter.peakValleyTheme.desc',
    // 峰值时段颜色选项（0=warn 1=danger 2=error）；默认 error
    defaultValue: 2,
    choices: [
      { value: 'warn', labelKey: 'opt.plugin.costMeter.peakValleyTheme.peak.warn' },
      { value: 'danger', labelKey: 'opt.plugin.costMeter.peakValleyTheme.peak.danger' },
      { value: 'error', labelKey: 'opt.plugin.costMeter.peakValleyTheme.peak.error' },
    ],
    choiceLabelKey: 'opt.plugin.costMeter.peakValleyTheme.peak',
    css: CSS.costMeterPeakValley,
    cssValue: costMeterPeakHighCss,
  },
  {
    id: 'skillExplorer.themeAdapt',
    group: 'plugin',
    target: '@linxin666/dsh-client-ui-skill-explorer',
    // 技能中心未注册 settings.section：缺省 sectionId → 仅按已装检测
    nameKey: 'opt.plugin.skillExplorer.themeAdapt',
    descKey: 'opt.plugin.skillExplorer.themeAdapt.desc',
    // 主题适配：技能中心面板（根 = .cBrkua_overlay，hash 类；无 data-dsh-skill-explorer-view 属性）硬编码色改主题语义色，
    // 使其受皮肤控制（无皮肤时深色回退规则不生效，面板显示浅色硬编码色，正是此适配要修的）。
    // 徽章/删除/反馈用语义色 + rgb(from …) 透明度；cBrkua_* 为插件 hash 类（^0.3.22 稳定）。
    css: [
      '.cBrkua_overlay .cBrkua_card{background:var(--dsw-alias-bg-layer-2)!important;border-color:var(--dsw-alias-border-l2)!important;color:var(--dsw-alias-label-primary)!important}',
      '.cBrkua_overlay .cBrkua_head{background:var(--dsw-alias-bg-base)!important;color:var(--dsw-alias-label-primary)!important}',
      '.cBrkua_overlay .cBrkua_headTitle{color:var(--dsw-alias-label-primary)!important}',
      '.cBrkua_overlay .cBrkua_headButton{background:var(--dsw-alias-interactive-bg-hover)!important;color:var(--dsw-alias-label-secondary)!important}',
      '.cBrkua_overlay .cBrkua_headButton:hover{background:var(--dsw-alias-interactive-bg-hover)!important}',
      '.cBrkua_overlay .cBrkua_tabs,.cBrkua_overlay .cBrkua_filterBar{background:var(--dsw-alias-bg-layer-2)!important}',
      '.cBrkua_overlay .cBrkua_groupTitle,.cBrkua_overlay .cBrkua_skillName{color:var(--dsw-alias-label-primary)!important}',
      '.cBrkua_overlay .cBrkua_status,.cBrkua_overlay .cBrkua_filterLabel,.cBrkua_overlay .cBrkua_skillDesc,.cBrkua_overlay .cBrkua_formLabel,.cBrkua_overlay .cBrkua_filterClear{color:var(--dsw-alias-label-secondary)!important}',
      '.cBrkua_overlay .cBrkua_groupHint,.cBrkua_overlay .cBrkua_count,.cBrkua_overlay .cBrkua_skillWhen,.cBrkua_overlay .cBrkua_skillPath,.cBrkua_overlay .cBrkua_note,.cBrkua_overlay .cBrkua_filterEmpty{color:var(--dsw-alias-label-tertiary)!important}',
      '.cBrkua_overlay .cBrkua_skill{background:var(--dsw-alias-bg-layer-1)!important;border-color:var(--dsw-alias-border-l2)!important}',
      '.cBrkua_overlay .cBrkua_tab{color:var(--dsw-alias-label-tertiary)!important;border-color:var(--dsw-alias-border-l2)!important}',
      '.cBrkua_overlay .cBrkua_tabActive{background:var(--dsw-alias-bg-layer-2)!important;color:var(--dsw-alias-label-primary)!important;border-color:var(--dsw-alias-border-l1)!important}',
      '.cBrkua_overlay .cBrkua_filterInput,.cBrkua_overlay .cBrkua_filterSelect{background:var(--dsw-alias-bg-layer-1)!important;color:var(--dsw-alias-label-primary)!important;border-color:var(--dsw-alias-border-l2)!important}',
      '.cBrkua_overlay .cBrkua_filterInput:focus,.cBrkua_overlay .cBrkua_filterSelect:focus{border-color:var(--dsw-alias-border-l1)!important}',
      '.cBrkua_overlay .cBrkua_filterClear:hover{color:var(--dsw-alias-label-primary)!important}',
      '.cBrkua_overlay .cBrkua_switchTrack{background:var(--dsw-alias-bg-layer-3)!important;border-color:var(--dsw-alias-border-l2)!important}',
      '.cBrkua_overlay .cBrkua_switchThumb{background:var(--dsw-alias-bg-base)!important}',
      '.cBrkua_overlay .cBrkua_switch[aria-checked=true] .cBrkua_switchTrack{background:var(--dsw-alias-state-success-primary)!important}',
      '.cBrkua_overlay .cBrkua_badge{background:rgb(from var(--dsw-alias-state-business-primary) r g b / 0.1)!important;color:var(--dsw-alias-state-business-primary)!important;border-color:rgb(from var(--dsw-alias-state-business-primary) r g b / 0.2)!important}',
      '.cBrkua_overlay .cBrkua_badgeInvokable{background:rgb(from var(--dsw-alias-state-success-primary) r g b / 0.1)!important;color:var(--dsw-alias-state-success-primary)!important;border-color:rgb(from var(--dsw-alias-state-success-primary) r g b / 0.2)!important}',
      '.cBrkua_overlay .cBrkua_badgeWorkspace{background:var(--dsw-alias-bg-layer-2)!important;color:var(--dsw-alias-label-secondary)!important;border-color:var(--dsw-alias-border-l2)!important}',
      '.cBrkua_overlay .cBrkua_badgeIsolated{background:rgb(from var(--dsw-alias-state-warn-primary) r g b / 0.1)!important;color:var(--dsw-alias-state-warn-primary)!important;border-color:rgb(from var(--dsw-alias-state-warn-primary) r g b / 0.2)!important}',
      '.cBrkua_overlay .cBrkua_deleteButton{background:rgb(from var(--dsw-alias-state-danger-primary) r g b / 0.1)!important;color:var(--dsw-alias-state-danger-primary)!important}',
      '.cBrkua_overlay .cBrkua_feedback{color:var(--dsw-alias-state-danger-primary)!important}',
      '.cBrkua_overlay .cBrkua_feedbackOk{color:var(--dsw-alias-state-success-primary)!important}',
      '.cBrkua_overlay .cBrkua_formInput{background:var(--dsw-alias-bg-layer-2)!important;color:var(--dsw-alias-label-primary)!important}',
      '.cBrkua_overlay .cBrkua_formButton{background:var(--dsw-alias-bg-layer-2)!important;color:var(--dsw-alias-label-primary)!important}',
      '.cBrkua_overlay .cBrkua_formButton:hover{background:var(--dsw-alias-interactive-bg-hover)!important}',
    ].join(''),
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
  /** 插件仓库主页（面板名称可点击跳转；缺省无链接） */
  url?: string
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
    url: PLUGIN_URLS[plugin],
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
  // 数字输入框无上限；滑块按 maxValue（缺省 100）钳制
  const max = def.numberInput ? Number.MAX_SAFE_INTEGER : def.maxValue ?? 100
  if (typeof raw === 'number' && Number.isFinite(raw)) return Math.max(0, Math.min(max, raw))
  return def.defaultValue
}

/** 校验注册表完整性（供单测/启动自检）：id 唯一、css 非空、plugin 组有 target。 */
export function validateOptimizeRegistry(defs: readonly OptimizeDef[] = OPTIMIZE_DEFS): string[] {
  const errors: string[] = []
  const seen = new Set<string>()
  for (const def of defs) {
    if (!def.id || seen.has(def.id)) errors.push('duplicate/empty id: ' + def.id)
    seen.add(def.id)
    // 允许「待实现」def：无 css/cssValue/jsEffect 的占位设置项（开关已持久化，效果后续补齐）
    if (typeof def.cssValue === 'function' && def.defaultValue === undefined) {
      errors.push('cssValue without defaultValue: ' + def.id)
    }
    if (def.group === 'plugin' && !def.target) errors.push('plugin def without target: ' + def.id)
    if (def.group !== 'dsh' && def.group !== 'plugin') errors.push('bad group: ' + def.id)
    if (!def.nameKey || !def.descKey) errors.push('missing locale keys: ' + def.id)
  }
  return errors
}
