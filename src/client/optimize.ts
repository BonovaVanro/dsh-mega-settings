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
import { isDesktopShell } from './platform.ts'

export type OptimizeGroup = 'dsh' | 'plugin'

/** `cssValue` 的第二参数：由同步层注入的**兄弟项状态**读取面（走真实 config，不读镜像）。 */
export interface OptimizeCssContext {
  /** 兄弟项当前值（未设置 / 非数值 → undefined） */
  values: Record<string, number | undefined>
  /** 兄弟项是否启用（config.optToggles → defaultOn） */
  enabled: (id: string) => boolean
}

export interface OptimizeDef {
  /** 稳定 id（持久化键：config.optToggles[id]） */
  id: string
  /** 分组：dsh 界面 / 第三方插件 */
  group: OptimizeGroup
  /** dsh 组子区（'desktop' → 「桌面版」；'rightbar' → 「右侧边栏」；'leftbar' → 「左侧边栏」；
   *  缺省 = dsh 一般区）。面板渲染顺序：一般区 → 桌面版 → 左侧边栏 → 右侧边栏。
   *  标记 `desktopOnly` 的子区在**非桌面壳**中整节不注册（开关不可见、样式也不注入）。 */
  dshSection?: string
  /** 仅桌面壳（官方 DSH 桌面版）可用：web 端不注册、不展示、不注入。
   *  用于依赖桌面专属结构/能力的项（Windows titlebar、内容区 frame、原生窗口按钮）。 */
  desktopOnly?: boolean
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
  /** 值驱动 CSS 生成器：按当前数值生成注入样式（滑块 = 0-100；选项组 = 所选下标）。
   *  第二个参数 `ctx` 由同步层注入，用于读取**兄弟项状态**（与 `follows` 同一条配置通路，
   *  不读本地镜像）：`ctx.values[id]` = 兄弟项当前值，`ctx.enabled(id)` = 兄弟项是否启用。
   *  典型用法：本项的作用范围取决于"另一项是否开启 / 选了哪个"。 */
  cssValue?: (value: number, ctx: OptimizeCssContext) => string
  /** 该数值**跟随**另一项的配置值（如桌面标题栏跟随左侧栏透明度）：
   *  存在时 cssValue 收到的值 = 目标项的当前值（目标项未设置则回退本项 defaultValue），
   *  本项自身的 defaultValue 仅作为回退与面板初始化显示。 */
  follows?: string
}

/** 已知插件的面板标题词条 key（缺省 = 面板直接显示包名）。 */
const PLUGIN_TITLE_KEYS: Record<string, string> = {
  'dsh-better-sidebar': 'opt.plugin.title.betterSidebar',
  'dsh-cost-meter': 'opt.plugin.title.costMeter',
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

/* 左侧边栏两层结构 —— **hash 无关**定位。
 * CSS-module 的 hash 前缀随构建变化（web `pI_x6G_sidebarCol` / `hHd-Xa_root`，
 * 桌面 `BynINW_sidebarCol` / `_2H3hWW_root`），但类名后缀跨构建稳定，故用属性子串选择器
 * `[class*="…"]`（标准 CSS3 Selectors，纯 CSS，无需 JS）。
 * 实测（web 与桌面双端控制台）：
 *   `#root [class*="_sidebarCol"]`              → 两端各 1 个（布局层侧栏列）
 *   `[data-slot="sidebar"] > [class*="_root"]`  → 两端各 1 个（侧栏模块根）
 *   **不可**用裸 `[class*="_root"]`：两端分别命中 542 / 715 个（大量组件类名含 `_root`）。
 * 两者都要求元素在 #root 内（`#root` 在架构上唯一，不会重复）。 */
const LB_LAYOUT = '#root [class*="_sidebarCol"]'
const LB_MODULE = '#root [data-slot="sidebar"] > [class*="_root"]'
/** 侧栏统一化的层选项：**下标 0（默认）= 保留侧栏列**，1 = 保留侧栏根。 */
const LB_LAYER_CHOICES = [
  { value: 'col', labelKey: 'opt.dsh.layerSidebarCol' },
  { value: 'root', labelKey: 'opt.dsh.layerSidebarRoot' },
]
/** 兄弟项 id：侧栏背景透明度据此判断统一化的开关与所选层级（见 cssValue 的 ctx）。 */
export const LB_UNIFY_ID = 'dsh.leftbarBgUnify'
/* 内容区 frame（官方 AppFrame）——**桌面版填充色实际在它上面**：
 *   .<hash>_frame{background:var(--dsw-alias-bg-base);grid-template-rows:100%}
 *   [data-windows-titlebar] .<hash>_frame{…;background:var(--dsw-specific-sidebar-fill);
 *                                          grid-template-rows:minmax(0,1fr)}   ← Windows 桌面
 *   [data-platform=darwin]  .<hash>_frame{background:0 0}                       ← macOS 透明
 * web 侧填充色则在 `_sidebarCol` 上（layout 包：`.pI_x6G_sidebarCol{background:var(--dsw-specific-sidebar-fill)}`）。
 * 两者关系：frame = 正文 + 侧栏的整个内容区，sidebarCol 只是它内部的一列。
 * 所以桌面版必须把填充色改在 frame 上，否则只改 sidebarCol 会出现"侧栏没变、正文先变"的观感。 */
const LB_FRAME = '#root [data-slot="root"] > [class*="_frame"]'
/** 桌面窗口标题栏层：官方用 frame 的 `::before` 画可拖拽标题条（`app-region:drag`）
 *  `[data-windows-titlebar] .<hash>_frame:before{
 *     content:""; height:var(--dsh-windows-titlebar-height);
 *     background:var(--dsw-specific-sidebar-fill); -webkit-app-region:drag;
 *     position:absolute; inset:0 0 auto}` */
const LB_FRAME_TITLEBAR = LB_FRAME + ':before'

/** **原生窗口按钮的颜色变量**：探针的 `background-color` 被本插件改指向它
 *  （`var(--mgs-button-fill, var(--dsw-specific-sidebar-fill))`），再由 `body` 行内的值决定按钮颜色。
 *  这样按钮与主题变量解耦 —— 侧栏/标题条照旧用主题值，互不干扰。 */
export const FILL_BUTTON = '--mgs-button-fill'

/** 桌面版判据：`[data-windows-titlebar]` 仅桌面窗口存在 —— 用它把 frame 规则限定在
 *  填充色真在 frame 上的平台；web 无此属性则该规则天然不生效，改由 LB_LAYOUT 承担。 */
const TITLEBAR_CTX = '[data-windows-titlebar] '

/** 正文中心列：官方打有 data-dsh-surface="conversation"，与 hash 无关的稳定锚点。 */
const CV_CENTER_COL = '[data-dsh-surface="conversation"]'
/** 中心列内部、会话自身那一层：`main.conversation` 槽的直接子模块根（官方 main 槽挂 main.conversation）。
 *  选择器保持简短，只用稳定的 `data-slot` + 后缀类，不写完整层级路径。 */
const CV_INNER_ROOT = '[data-slot="main.conversation"] > [class*="_root"]'
/** 正文「背景颜色统一化」的层级选项：0 = 中心列，1 = 会话根（下标即 cssValue 收到的值）。 */
const CV_LAYER_CHOICES = [
  { value: 'centerCol', labelKey: 'opt.dsh.layerCenterCol' },
  { value: 'convRoot', labelKey: 'opt.dsh.layerConvRoot' },
]
/** cssValue 收到的值 → 侧栏层下标（0 = 侧栏列，1 = 侧栏根）。 */
function lbLayerIndexOf(value: number | undefined): number {
  return value === 1 ? 1 : 0
}
/** cssValue 收到的值 → 层下标（0 = 中心列，1 = 会话根）。 */
function conversationLayerIndexOf(value: number | undefined): number {
  return value === 1 ? 1 : 0
}
/** 兄弟项 id：正文背景透明度据此判断「背景颜色统一化」的开关与所选层级（见 cssValue 的 ctx）。 */
export const CV_UNIFY_ID = 'dsh.conversationBgUnify'

/** 正文（会话）头部：官方 `main` 是 root 作用域的 keyed 槽，会话界面用保留 key `conversation`
 *  （见 ui-layout 文档），其 header 是会话头（带 `data-window-drag` 拖拽区）。 */
const CONVERSATION_HEADER = '#root [data-slot="main.conversation"] header'

/** 官方对话头的 hash 类：全库唯一（仅 dsh-client-ui-conversation 有 `*_headerUtilities`），
 * 故可直接用后缀定位，避免 web/桌面 hash 前缀不同（web `wSkVaW_`）导致失配。
 * 见 rightbarFullscreenHideHeaderUtilities。 */

/** 全量注册表（注册序 = 展示序；dsh 组在前、插件组在后）。
 *  `desktopOnly` 项在非桌面壳中被过滤（见文件尾 OPTIMIZE_DEFS 的导出方式）。 */
const ALL_OPTIMIZE_DEFS: readonly OptimizeDef[] = [
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
    id: 'dsh.desktopTitlebarBgFollow',
    group: 'dsh',
    dshSection: 'desktop',
    desktopOnly: true, // 仅桌面壳：web 端不注册、不展示、不注入
    defaultOn: true, // 默认生效
    nameKey: 'opt.dsh.desktopTitlebarBgFollow',
    descKey: 'opt.dsh.desktopTitlebarBgFollow.desc',
    /* 两项职责，都**不修改主题变量**（按钮走探针重定向，标题条直接复用侧栏同一表达式）：
     *
     * ①「原生窗口按钮」：官方 preload 会往 body 里 append 一个隐藏 span 作取色探针，其
     *    `background-color: var(--dsw-specific-sidebar-fill)` 的**计算值**就是按钮底色。
     *    JS 效果（titlebarFill）定位该探针（`body` 直属 span + 内联含 `background-color: var(…-fill)`，
     *    实测指纹**冒号后有空格**），把它的取值源改指向 `var(--mgs-button-fill, var(--dsw-specific-sidebar-fill))`，
     *    再由 body 行内的 `--mgs-button-fill = rgba(0, 0, 0, 0)` 决定按钮透明。
     *    （透明用"计算后"形态，稳过主进程那道只接受 #hex / rgb()/rgba() 的校验。）
     * ②「标题条」：`frame::before` 的背景 = **与侧栏完全同一个表达式**
     *    `color-mix(in srgb, var(--dsw-specific-sidebar-fill) N%, transparent)`，N 取同一滑块值
     *    → 与侧栏天生同色同透明度。
     * 注：**不再修正工作区尾部渐隐条 `_fade`** —— 那里原本写的是
     * `linear-gradient(to bottom, transparent, var(--dsw-specific-sidebar-fill))`，跟随开启时
     * 该变量已不被我们改动，渐隐条自然与主题一致，无需干预。 */
    defaultValue: 30,
    follows: 'dsh.leftbarBgAlpha',
    jsEffect: 'titlebarFill',
    cssValue: (v) =>
      TITLEBAR_CTX +
      LB_FRAME_TITLEBAR +
      '{background:color-mix(in srgb, var(--dsw-specific-sidebar-fill,rgb(27,27,28)) ' +
      (100 - Math.max(0, Math.min(100, Math.round(v)))) +
      '%, transparent)!important}',
  },
  {
    id: 'dsh.desktopFramePaddingReset',
    group: 'dsh',
    dshSection: 'desktop',
    desktopOnly: true, // 仅桌面壳：web 端不注册、不展示、不注入
    defaultOn: false, // 默认关闭（会让内容上移，与原生按钮同高，按需开启）
    nameKey: 'opt.dsh.desktopFramePaddingReset',
    descKey: 'opt.dsh.desktopFramePaddingReset.desc',
    /* 移除框架上内边距：官方桌面版给内容区 frame 加了 `padding-top: var(--dsh-windows-titlebar-height)`
     * （= 为 Windows 那条可拖拽标题栏让出的 40px）：
     *   [data-windows-titlebar] .<hash>_frame{…;padding-top:var(--dsh-windows-titlebar-height);…}
     * 本项把它强制归零，让内容顶到窗口最上沿。
     * ⚠️ 副作用：内容会与窗口右上角的原生按钮（最小化/最大化/关闭）处在同一行高度，
     *    且拖拽条被内容覆盖 —— 需要自己权衡，故默认关闭。
     * 选择器 hash 无关（后缀 `_frame`），仅桌面生效。 */
    css: TITLEBAR_CTX + LB_FRAME + '{padding-top:0!important}',
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
    // 只作用于全屏面板内的 dock 内容区：收起右侧栏后 dock 区随内容消失，无残留变暗
    // （不直接给 data-sidebar-right-panel="fullscreen" 面板铺背景——该面板常驻挂载、属性可能残留）。
    cssValue: (v) =>
      '[data-sidebar-right-panel="fullscreen"] [data-dockkit-host="dock"] > section{background:rgb(from var(--dsw-alias-bg-base) r g b / ' +
      (100 - Math.max(0, Math.min(100, Math.round(v)))) / 100 +
      ')}',
  },
  {
    id: 'dsh.conversationBgUnify',
    group: 'dsh',
    dshSection: 'content',
    nameKey: 'opt.dsh.conversationBgUnify',
    descKey: 'opt.dsh.conversationBgUnify.desc',
    /* 正文背景颜色统一化：中心列与会话根都铺了 background: var(--dsw-alias-bg-base)，
     * 选中的那一层保留，另一个设为 background:none!important（只清未选中的那层）。 */
    defaultValue: 0,
    choices: CV_LAYER_CHOICES,
    choiceLabelKey: 'opt.value.keepLayer',
    cssValue: (v) =>
      conversationLayerIndexOf(v) === 0
        ? CV_INNER_ROOT + '{background:none!important}' // 保留中心列 → 清会话根
        : CV_CENTER_COL + '{background:none!important}', // 保留会话根 → 清中心列
  },
  {
    id: 'dsh.conversationBgAlpha',
    group: 'dsh',
    dshSection: 'content',
    nameKey: 'opt.dsh.conversationBgAlpha',
    descKey: 'opt.dsh.conversationBgAlpha.desc',
    /* 正文背景透明度：按「背景颜色统一化」的状态决定作用范围 ——
     *   · 统一化**已开启**：只对**选中保留的那一层**生效（另一层已被统一化设为 background:none）；
     *   · 统一化**未开启**：两层都生效（此时没有任何一层被清空，两层都需要透明度）。
     * 数值越大越透明（默认 25 → 75% 不透明）。 */
    defaultValue: 25,
    valueLabelKey: 'opt.value.transparency',
    cssValue: (v, ctx) => {
      const pct = 100 - Math.max(0, Math.min(100, Math.round(v)))
      // 作用范围由「背景颜色统一化」决定：开启 → 只选中层；未开启 → 两层都生效
      const target = ctx.enabled(CV_UNIFY_ID)
        ? ctx.values[CV_UNIFY_ID] === 1
          ? CV_INNER_ROOT
          : CV_CENTER_COL
        : CV_CENTER_COL + ',' + CV_INNER_ROOT
      return (
        target +
        '{background:color-mix(in srgb, var(--dsw-alias-bg-base,rgb(27,27,28)) ' +
        pct +
        '%, transparent)!important}'
      )
    },
  },
  {
    id: 'dsh.filePreviewBgAlpha',
    group: 'dsh',
    dshSection: 'content', // 「正文」分区（位置已上移到「头部背景移除」之前）
    nameKey: 'opt.dsh.filePreviewBgAlpha',
    descKey: 'opt.dsh.filePreviewBgAlpha.desc',
    // 透明度语义：数值越大越透明（0 = 完全不透明，100 = 全透明）；默认 25 → alpha 75%
    defaultValue: 25,
    // 正文编辑「文件预览」卡片背景混合为主题 layer-1 半透明。
    // _preview_178vx_56 为 web shell（dsh-web-frontend）CSS-module hash（同组 card=_card_178vx_13 / copyable / status
    // 的预览态类；无 data-* 稳定面），随 shell 构建可能变化（0.1.7-alpha.1 为 _preview_1nod8_56，rc.1 改 178vx），
    // 升级后需复核（同 rightbarFullscreenHideHeaderUtilities）。
    cssValue: (v) =>
      '._preview_178vx_56{background:rgb(from var(--dsw-alias-bg-layer-1) r g b / ' +
      (100 - Math.max(0, Math.min(100, Math.round(v)))) / 100 +
      ')}',
  },
  {
    id: 'dsh.conversationHeaderBgNone',
    group: 'dsh',
    dshSection: 'content', // 「正文」分区
    nameKey: 'opt.dsh.conversationHeaderBgNone',
    descKey: 'opt.dsh.conversationHeaderBgNone.desc',
    // 正文（会话）头部背景移除：该头部会吃到 frame 铺的填充色，与正文产生色差
    css: CONVERSATION_HEADER + '{background:none!important}',
  },
  {
    id: 'dsh.rightbarFullscreenHideHeaderUtilities',
    group: 'dsh',
    dshSection: 'rightbar',
    nameKey: 'opt.dsh.rightbarFullscreenHideHeaderUtilities',
    descKey: 'opt.dsh.rightbarFullscreenHideHeaderUtilities.desc',
    // 右栏全屏（frame 带 data-rightbar-fullscreen）时隐藏正文头部工具区。
    // 原来写死 hash 类 `.wSkVaW_headerUtilities`（web 侧），桌面版 hash 前缀不同 → 失配；
    // `*_headerUtilities` 在全部内置包里唯一（仅 dsh-client-ui-conversation 有），改用后缀定位。
    css: '[data-rightbar-fullscreen] [class*="_headerUtilities"]{display:none!important}',
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
    /* 背景颜色统一化：侧栏列（`_sidebarCol`）与侧栏根（`_root`）都铺了底色，两层同时保留会叠出多层；
     * 本项对**选中的那一层**设 background:none!important（只留另一层作为唯一控制源）。
     * 与「背景透明度」的分工：统一化只负责清层，透明度只负责把可见层混透（见该项的 ctx 逻辑）。 */
    defaultValue: 0, // 下标 0 = 侧栏列（见 LB_LAYER_CHOICES 顺序）
    choices: LB_LAYER_CHOICES,
    choiceLabelKey: 'opt.value.keepLayer',
    cssValue: (v) =>
      lbLayerIndexOf(v) === 0
        ? LB_MODULE + '{background:none!important}' // 保留侧栏列 → 清侧栏根
        : LB_LAYOUT + '{background:none!important}', // 保留侧栏根 → 清侧栏列
  },
  {
    id: 'dsh.leftbarBgAlpha',
    group: 'dsh',
    dshSection: 'leftbar',
    nameKey: 'opt.dsh.leftbarBgAlpha',
    descKey: 'opt.dsh.leftbarBgAlpha.desc',
    /* 背景透明度：把填充色按比例混向透明（数值越大越透明）。
     * 颜色源 = 直读官方变量 `--dsw-specific-sidebar-fill`（+ 内置兜底色；缺兜底时 color-mix 无输入
     * 会让整条声明作废）。按钮走探针重定向，本插件不改这个变量，两端解耦。
     *
     * **作用范围按「背景颜色统一化」的状态决定**（ctx 由同步层从真实 config 注入）：
     *   · 统一化**已开启**：只让**保留层**显色混透，并在同一标签里兜底把另一层清空 ——
     *     否则非保留层的不透明底色会把保留层盖住；
     *   · 统一化**未开启**：两层都混透。 */
    defaultValue: 30,
    valueLabelKey: 'opt.value.transparency',
    cssValue: (v, ctx) => {
      const pct = 100 - Math.max(0, Math.min(100, Math.round(v)))
      const decl =
        '{background:color-mix(in srgb, var(--dsw-specific-sidebar-fill,rgb(27,27,28)) ' +
        pct +
        '%, transparent)!important}'
      if (!ctx.enabled(LB_UNIFY_ID)) {
        return LB_LAYOUT + ',' + LB_MODULE + decl // 统一化未开启 → 两层都混透
      }
      // 方向必须与「背景颜色统一化」的 lbLayerIndexOf 完全一致：
      //   值 0 = 保留侧栏列 → 列混透、清根；值 1 = 保留侧栏根 → 根混透、清列。
      return ctx.values[LB_UNIFY_ID] === 1
        ? LB_MODULE + decl + LB_LAYOUT + '{background:none!important}' // 保留侧栏根 → 清侧栏列
        : LB_LAYOUT + decl + LB_MODULE + '{background:none!important}' // 保留侧栏列 → 清侧栏根
    },
  },
  {
    id: 'dsh.leftbarFooterActionsLayout',
    group: 'dsh',
    dshSection: 'leftbar',
    nameKey: 'opt.dsh.leftbarFooterActionsLayout',
    descKey: 'opt.dsh.leftbarFooterActionsLayout.desc',
    /* 侧栏底部动作区纵向排列（官方 footerActions 原本为横向 flex），折叠时按钮撑满宽度、
     * 动作区内 div（含嵌套，如 cost-meter 的 .cm-footer-stack 及其行）文本居中。
     * 定位同样 hash 无关：`[class*="_footerActions"]`（实测两端各 1 个）。
     * **不再依赖折叠态类名**：官方的 `[data-sidebar-collapsed]` 与 `.hHd-Xa_collapsed`
     * 在 web 与桌面实测均为 0 个（折叠态标记不在侧栏根上），故折叠相关的两条改为
     * 无条件生效 —— 展开态下按钮/条目本就受容器宽度与自身对齐约束，无副作用。 */
    css: [
      '[class*="_footerActions"]{display:flex;flex-direction:column;gap:8px}',
      '[class*="_footerActions"] button,[class*="_footerActions"] [role="button"]{width:100%!important}',
      '[class*="_footerActions"] div{text-align:center}',
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
    /* 正文 Markdown 表格限制最大宽度 100%，横向滚动常驻（便于发现可滚动）。
     * 官方表格容器类随构建变化（web `.md-table-wide`、桌面 `_tableScroll_*`——实测桌面
     * `.md-table-wide` 命中 0、`[class*="_tableScroll"]` 命中 1），故两个锚点都覆盖；
     * 关键属性用 !important 覆盖官方 max-width:none / 负 margin / padding 撑宽。 */
    css: [
      '.md-table-wide,[class*="_tableScroll"]{max-width:100%!important;margin-left:0!important;padding-left:0!important;overflow:scroll}',
    ].join(''),
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
    id: 'dsh.frameBgAlpha',
    group: 'dsh',
    nameKey: 'opt.dsh.frameBgAlpha',
    descKey: 'opt.dsh.frameBgAlpha.desc',
    /* 框架背景透明度：把内容区 frame（正文 + 侧栏整个内容区）的背景按比例混向透明
     * （数值越大越透明；默认 30 → 70% 不透明）。桌面版官方在该处铺的是侧栏填充色。
     * 与「左侧边栏 · 背景透明度」的区别：那条只作用于侧栏模块根，这条作用于整个内容区 frame。
     * 选择器 hash 无关（后缀 `_frame`），与「框架上内边距移除」同源。 */
    defaultValue: 30,
    valueLabelKey: 'opt.value.transparency',
    cssValue: (v) =>
      LB_FRAME +
      '{background:color-mix(in srgb, var(--dsw-specific-sidebar-fill,rgb(27,27,28)) ' +
      (100 - Math.max(0, Math.min(100, Math.round(v)))) +
      '%, transparent)!important}',
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
    id: 'costMeter.footerBgAlpha',
    group: 'plugin',
    target: 'dsh-cost-meter',
    sectionId: 'cost-meter',
    nameKey: 'opt.plugin.costMeter.footerBgAlpha',
    descKey: 'opt.plugin.costMeter.footerBgAlpha.desc',
    /* 底部计费条背景透明度（混合策略，替代早先的「背景移除」）：
     * 官方底色来自 cost-meter 自己的样式表，且用的是**主题变量**：
     *   .cm-footer-stack.simple{background:var(--dsw-alias-bg-layer-1)；border:1px solid var(--dsw-alias-border-l1)}
     *   .cm-footer-stack.simple .cm-bbox{background:transparent}
     * 故直接在**同一变量**上做 color-mix 即可，数值越大越透明（0 = 原样，100 = 全透明）。
     * 选择器同时覆盖 `.simple>div`（历史上曾用它清背景），保持两条一致。 */
    defaultValue: 25,
    valueLabelKey: 'opt.value.transparency',
    cssValue: (v) =>
      '.cm-footer-stack.simple,.cm-footer-stack.simple>div{background:color-mix(in srgb, var(--dsw-alias-bg-layer-1) ' +
      (100 - Math.max(0, Math.min(100, Math.round(v)))) +
      '%, transparent)!important}',
  },
  {
    id: 'costMeter.footerBorderNone',
    group: 'plugin',
    target: 'dsh-cost-meter',
    sectionId: 'cost-meter',
    nameKey: 'opt.plugin.costMeter.footerBorderNone',
    descKey: 'opt.plugin.costMeter.footerBorderNone.desc',
    // 底部计费条（simple 形态及其内部行）边框移除
    css: '.cm-footer-stack.simple,.cm-footer-stack.simple>div{border:none!important}',
  },
  /* 注：`@linxin666/dsh-client-ui-skill-explorer` 的主题适配项已移除 ——
   * 该插件自身已完善主题/皮肤适配，无需本插件再用 hash 类（`cBrkua_*`）覆盖其样式。 */
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

/* ================= 平台过滤 =================
 * 桌面专属项（`desktopOnly`）只在官方桌面壳里注册：web 端既看不到开关、也不注入样式。
 * 过滤结果**每次调用时现算**（而不是模块求值期定死）—— 桌面壳的 `data-platform` 由 preload
 * 写入，时序上可能晚于本模块求值；现算可避免"首次渲染时误判为 web"。按平台结果做一层缓存，
 * 避免遍历类调用反复过滤（平台在页面生命周期内不会变）。 */
let defsCache: { desktop: boolean; list: readonly OptimizeDef[] } | undefined
function visibleDefs(): readonly OptimizeDef[] {
  const desktop = isDesktopShell()
  if (defsCache === undefined || defsCache.desktop !== desktop) {
    defsCache = { desktop, list: desktop ? ALL_OPTIMIZE_DEFS : ALL_OPTIMIZE_DEFS.filter((d) => d.desktopOnly !== true) }
  }
  return defsCache.list
}

export const OPTIMIZE_DEFS: readonly OptimizeDef[] = new Proxy([] as OptimizeDef[], {
  get(_t, prop) {
    const list = visibleDefs()
    const value = Reflect.get(list, prop)
    return typeof value === 'function' ? (value as (...a: unknown[]) => unknown).bind(list) : value
  },
  has(_t, prop) {
    return Reflect.has(visibleDefs(), prop)
  },
}) as readonly OptimizeDef[]
