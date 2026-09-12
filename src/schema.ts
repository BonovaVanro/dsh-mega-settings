import z from '@deepseek-ai/schemastery'

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
}

export const MegaSettingsSchema = z.object({
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
})