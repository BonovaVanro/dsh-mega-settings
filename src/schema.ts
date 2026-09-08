import z from '@deepseek-ai/schemastery'

/** 设置入口形态（插件页/导航栏；仅收纳模式生效）。 */
export type SettingsEntryMode = 'plugins' | 'nav'

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
  /** 设置入口（仅收纳模式；插件页 / 导航栏） */
  entry: SettingsEntryMode
  /** 管控模式 */
  mode: ControlMode
  /** 默认展开成员/卡片描述 */
  defaultExpand: boolean
  /** 自定义分组（两模式共用；mega 固组与未分组为派生视图，不落盘） */
  groups: SettingsGroup[]
  /** 子页标题名单：自带 version tag 的管控项（其子页不叠加标题条） */
  noTitlePlugins: string[]
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
}

export const defaultConfig: MegaSettingsConfig = {
  entry: 'plugins',
  mode: 'collect',
  defaultExpand: true,
  groups: [],
  noTitlePlugins: ['dsh-better-sidebar'],
  lastMember: '',
  managedExcluded: [],
  navOrder: [],
  ungroupedOrder: [],
  pluginExists: {},
}

export const MegaSettingsSchema = z.object({
  entry: z.union(['plugins', 'nav']).default('plugins'),
  mode: z.union(['fold', 'collect']).default('collect'),
  defaultExpand: z.boolean().default(true),
  groups: z
    .array(
      z.object({
        id: z.string(),
        name: z.string(),
        itemIds: z.array(z.string()).default([]),
      }),
    )
    .default([]),
  noTitlePlugins: z.array(z.string()).default([]),
  lastMember: z.string().default(''),
  managedExcluded: z.array(z.string()).default([]),
  navOrder: z.array(z.string()).default([]),
  ungroupedOrder: z.array(z.string()).default([]),
  pluginExists: z.dict(z.boolean()).default({}),
})