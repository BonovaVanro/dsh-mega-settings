import z from '@deepseek-ai/schemastery'

/** 0.1.7 ConfigForm 路径级写入（对齐 dsh-api-remotes 的 SettingsPathOpView，本地收窄免外部依赖）。 */
export type SettingsPathOpView =
  | { op: 'set'; path: string[]; value: unknown }
  | { op: 'unset'; path: string[] }

/** 管控模式：fold = 折叠（接管原生设置弹层）；collect = 收纳（mega 设置页收卡片）。 */
export type ControlMode = 'fold' | 'collect'

/** 自定义分组（顺序 = 展示顺序；item = 管控项（第三方设置分区）的 entry id）。 */
export interface SettingsGroup {
  id: string
  name: string
  itemIds: string[]
}

/** mega-settings 自身配置（v2 管控中心）。 */
export interface MegaSettingsConfig {
  /** 管控模式 */
  mode: ControlMode
  /** 自定义分组（两模式共用；mega 固组与未分组为派生视图，不落盘） */
  groups: SettingsGroup[]
  /** 最近访问成员（设置写入触发重建后恢复现场；空串 = 无） */
  lastMember: string
  /** 关闭接管的第三方分区 id（旧版状态/顺序；0.7 起仅作迁移源，导航权威顺序见 navOrder） */
  managedExcluded: string[]
  /** 导航一级区顺序数组（0.7 权威）：官方四项之外的导航行 id 顺序，含入口保留 id（NAV_HUB_ID）恒在末。
   *  数组内出现即代表「已释放接管」；折叠设置 body 依此隐藏、收纳页不隐藏。 */
  navOrder: string[]
  /** 未分组项的持久展示序（接管数组中「未分组」条目的 items，其余按收集序追加） */
  ungroupedOrder: string[]
  /** 插件存在性快照（启动/槽位变动时刷新）：key = 已知管控项 id；false = 当前不存在（不显示但保留其配置） */
  pluginExists: Record<string, boolean>
  /** 优化开关（mega 优化页）：key = 优化项 id；true = 启用（缺省 = 该项默认值） */
  optToggles: Record<string, boolean>
  /** 优化项数值（mega 优化页）：key = 优化项 id；如右侧边栏全屏背景透明度 0-100（数值越大越透明，缺省 = 该项 defaultValue） */
  optValues: Record<string, number>
  /** mega 系插件兼容性校验（mega 家族契约）：false = 各 mega 插件启动时不再校验 dsh 版本兼容并提醒（各插件自行读取本值）。
   *  可选（三态）：显式 true/false 用户优先；未设时跟随家族公共文件 $DSH_HOME/mega.json，缺省 true。
   *  注意 schema 上不得加 .default(true)——否则未设会被解析成显式 true，家族公共开关永远失效。 */
  compatCheck?: boolean
  /** 设置搜索功能（设置页导航顶部搜索框；false = 不显示） */
  searchEnabled: boolean
  /** 已读提示 id 列表（mega 设置页提示面板；点击「懂你意思」后写入） */
  dismissedTips: string[]
}

export const defaultConfig: MegaSettingsConfig = {
  mode: 'collect',
  groups: [],
  lastMember: '',
  managedExcluded: [],
  navOrder: [],
  ungroupedOrder: [],
  pluginExists: {},
  optToggles: {},
  optValues: {},
  compatCheck: true,
  searchEnabled: true,
  dismissedTips: [],
}

/**
 * 0.1.7 schemastery 输出类型含 Volatile 包装，推断类型又引用 cosmokit/schemastery 私有路径
 * （TS2742）——先以 raw 定义，再显式收窄为自身接口（运行时 schema 不变）。
 */
const MegaSettingsSchemaRaw = z.object({
  mode: z.union(['fold', 'collect']).default('collect'),
  groups: z
    .array(
      z.object({
        id: z.string(),
        name: z.string(),
        itemIds: z.array(z.string()).default([]),
      }),
    )
    .default([]),
  lastMember: z.string().default(''),
  managedExcluded: z.array(z.string()).default([]),
  navOrder: z.array(z.string()).default([]),
  ungroupedOrder: z.array(z.string()).default([]),
  pluginExists: z.dict(z.boolean()).default({}),
  optToggles: z.dict(z.boolean()).default({}),
  optValues: z.dict(z.number()).default({}),
  // 无 default（命门）：未设 = 不解析出该键，compatCheckEnabled 才能读到家族公共文件层
  compatCheck: z.boolean(),
  searchEnabled: z.boolean().default(true),
  dismissedTips: z.array(z.string()).default([]),
  // 0.1.7：整个配置标为 volatile —— 非 volatile 字段禁止实时写入（mode/groups/optToggles 等都要即时生效）
}).volatile()

/** 导出为自身接口类型（可移植声明；运行时即上述 schemastery schema）。 */
export const MegaSettingsSchema = MegaSettingsSchemaRaw as unknown as z<MegaSettingsConfig>