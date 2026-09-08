/** 成员元信息条目（mega.settings.member list 槽的注册条目形态；label 位于 options，SlotCore 条目构造）。 */
export interface MemberEntry {
  /** 兼容形态：SlotCore 条目无顶层 id（id 在 options.id）；保留可选顶层以兼容测试/手动构造。 */
  id?: string
  options?: {
    id?: string
    order?: number
    label?: string | (() => string)
    inject?: () => Record<string, unknown>
    [k: string]: unknown
  }
  /** SlotCore 条目构造把 inject 放在顶层（实测：options 仅含 key/id/order/label/priority）。 */
  inject?: () => Record<string, unknown>
  [k: string]: unknown
}

/** 成员唯一 id：SlotCore 条目构造把 id 放进 options（实测无顶层 id）。 */
export function memberId(entry: MemberEntry): string {
  return entry.options?.id ?? entry.id ?? ''
}

/** 成员显示名：label 在条目的 options.label（SlotCore 条目构造；兼容顶层）；缺失回退 id。 */
export function memberLabel(entry: MemberEntry): string {
  const label = entry.options?.label ?? (entry as { label?: string | (() => string) }).label
  if (typeof label === 'function') return label()
  return label ?? memberId(entry)
}

/** 成员版本（经元信息注册的 inject 面提供；防御式：inject 缺失/抛错/非字符串 → undefined）。 */
export function memberVersion(entry: MemberEntry): string | undefined {
  try {
    // SlotCore 条目把 inject 放顶层（实测）；兼容历史 options 形态
    const injected = entry.inject ?? entry.options?.inject
    if (typeof injected !== 'function') return undefined
    const version = injected()?.version
    return typeof version === 'string' && version.length > 0 ? version : undefined
  } catch {
    return undefined
  }
}

/** 成员排序：order 升序（缺省 0），同级按 id 字典序（v0.5 起固定规则，无排序配置）。 */
export function sortMembers(members: readonly MemberEntry[]): readonly MemberEntry[] {
  return [...members].sort(
    (a, b) => (a.options?.order ?? 0) - (b.options?.order ?? 0) || memberId(a).localeCompare(memberId(b)),
  )
}

// ================= v2：管控/分组模型（DESIGN-v2 §3） =================

/** 官方原生设置分区 id（导航中固定开放，不参与管控）。 */
export const NATIVE_SECTION_IDS = ['general', 'models', 'plugins', 'agent-presets'] as const

/** 宿主自身在 settings.section 的 entry id（不参与管控）。 */
export const HOST_SECTION_ID = 'mega-settings'

/** mega 固组内部 id（派生视图，不落盘）。 */
export const MEGA_GROUP_ID = '$mega'

/** 组名保留字（大小写不敏感比较）：未分组（动态派生）与 mega（固组）。 */
export const RESERVED_GROUP_NAMES = ['未分组', 'mega'] as const

/** 自定义分组（落盘形态）。 */
export interface GroupDef {
  id: string
  name: string
  /** 管控项（第三方设置分区）的归一 entry id，顺序即展示顺序 */
  itemIds: string[]
}

/** settings.section 槽原始条目形状（SlotCore 构造：id 在 options）。 */
export interface SectionEntry {
  id?: string
  options?: {
    id?: string
    order?: number
    label?: string | (() => string)
    [k: string]: unknown
  }
  label?: string | (() => string)
  [k: string]: unknown
}

/** 归一后的管控项（保留原条目供渲染期解析 label/locale）。 */
export interface ManagedItem {
  /** 归一 id（options.id 优先，回退顶层） */
  id: string
  order: number
  entry: SectionEntry
}

/** 解析 settings.section 条目归一 id（同 memberId 语义）。 */
export function sectionId(entry: SectionEntry): string {
  return entry.options?.id ?? entry.id ?? ''
}

/** 归一条目集合：过滤官方原生分区、宿主自身、与 mega 成员同 id 的自足分区。 */
export function collectManaged(
  sections: readonly SectionEntry[],
  megaMemberIds: readonly string[],
): ManagedItem[] {
  const mega = new Set(megaMemberIds)
  const out: ManagedItem[] = []
  for (const entry of sections) {
    const id = sectionId(entry)
    if (!id) continue
    if ((NATIVE_SECTION_IDS as readonly string[]).includes(id)) continue
    if (id === HOST_SECTION_ID) continue
    if (mega.has(id)) continue // mega 成员自足入口 → 归 mega 组，不重复管控
    out.push({ id, order: entry.options?.order ?? 0, entry })
  }
  return out.sort((a, b) => a.order - b.order || a.id.localeCompare(b.id))
}

/** 项所在自定义组 id；未分组返回 null。 */
export function groupOf(itemId: string, groups: readonly GroupDef[]): string | null {
  for (const g of groups) if (g.itemIds.includes(itemId)) return g.id
  return null
}

/** 未分组项 id（不在任何自定义组内），保持收集序。 */
export function ungroupedIds(managedIds: readonly string[], groups: readonly GroupDef[]): string[] {
  const covered = new Set<string>()
  for (const g of groups) for (const id of g.itemIds) covered.add(id)
  return managedIds.filter((id) => !covered.has(id))
}

export type GroupNameError = 'empty' | 'duplicate' | 'reserved'

/** 组名校验：非空、组内不重名、非保留名（未分组 / mega，大小写不敏感）。 */
export function validateGroupName(name: string, groups: readonly GroupDef[]): GroupNameError | null {
  const trimmed = name.trim()
  if (!trimmed) return 'empty'
  const lower = trimmed.toLowerCase()
  if ((RESERVED_GROUP_NAMES as readonly string[]).some((r) => r.toLowerCase() === lower)) return 'reserved'
  if (groups.some((g) => g.name.trim().toLowerCase() === lower)) return 'duplicate'
  return null
}

/** 创建分组（id 由调用方注入；校验失败返回错误并保持原数组不变）。 */
export function createGroup(
  groups: readonly GroupDef[],
  id: string,
  name: string,
): { groups: GroupDef[]; error: GroupNameError | null } {
  const error = validateGroupName(name, groups)
  if (error) return { groups: [...groups], error }
  return { groups: [...groups, { id, name: name.trim(), itemIds: [] }], error: null }
}

/** 移除分组：组内项自动回到未分组（不写回任何组）。 */
export function removeGroup(groups: readonly GroupDef[], groupId: string): GroupDef[] {
  return groups.filter((g) => g.id !== groupId)
}

/** 组内排序移动。 */
export function reorderItem(
  groups: readonly GroupDef[],
  groupId: string,
  from: number,
  to: number,
): GroupDef[] {
  const group = groups.find((g) => g.id === groupId)
  if (!group) return [...groups]
  const list = [...group.itemIds]
  if (from < 0 || from >= list.length || to < 0 || to >= list.length) return [...groups]
  const [moved] = list.splice(from, 1)
  list.splice(to, 0, moved)
  return groups.map((g) => (g.id === groupId ? { ...g, itemIds: list } : g))
}

/** 组排序移动。 */
export function reorderGroups(groups: readonly GroupDef[], from: number, to: number): GroupDef[] {
  const list = [...groups]
  if (from < 0 || from >= list.length || to < 0 || to >= list.length) return list
  const [moved] = list.splice(from, 1)
  list.splice(to, 0, moved)
  return list
}

/** 跨组移动/放入某组：itemId 从原组移除（若在），插入 toGroupId 组 index 处（缺省尾）。
 *  toGroupId 为 null 表示移动到未分组（从所有组移除）。返回 null 表示目标组不存在。 */
export function moveItem(
  groups: readonly GroupDef[],
  itemId: string,
  toGroupId: string | null,
  index?: number,
): GroupDef[] | null {
  if (toGroupId !== null && !groups.some((g) => g.id === toGroupId)) return null
  const without = groups.map((g) =>
    g.itemIds.includes(itemId) ? { ...g, itemIds: g.itemIds.filter((i) => i !== itemId) } : g,
  )
  if (toGroupId === null) return without
  return without.map((g) => {
    if (g.id !== toGroupId) return g
    const list = [...g.itemIds]
    const at = index === undefined ? list.length : Math.max(0, Math.min(index, list.length))
    list.splice(at, 0, itemId)
    return { ...g, itemIds: list }
  })
}

/** 随机 id：优先 Web Crypto randomUUID；不可用时自实现（时间 + 随机 36 进制）。 */
export function randomId(): string {
  try {
    const c = globalThis.crypto
    if (c && typeof c.randomUUID === 'function') return c.randomUUID()
  } catch {
    /* 降级 */
  }
  return 'id-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 10)
}
/** 插入排序辅助：同列表 n 个元素之间有 n+1 个插入槽（zone = 槽序号，0..len，末槽 = 末尾）。
 *  返回被拖元素移动后的最终下标（0..len-1）；from 为原下标。 */
export function dropFinalIndex(from: number, zone: number, len: number): number {
  const final = zone - (zone > from ? 1 : 0)
  return Math.max(0, Math.min(final, len - 1))
}

/** 未分组渲染序：order 中仍为未分组的 id 按 order 排列，其余按原收集序追加。 */
export function orderedUngrouped(ids: readonly string[], order: readonly string[]): string[] {
  const set = new Set(ids)
  const seen = new Set<string>()
  const out: string[] = []
  for (const id of order) {
    if (seen.has(id) || !set.has(id)) continue
    seen.add(id)
    out.push(id)
  }
  for (const id of ids) if (!seen.has(id)) out.push(id)
  return out
}

/** 导航一级区数组的入口（收纳配置/折叠设置）保留 id——恒在 navOrder 数组末，不可拖。 */
export const NAV_HUB_ID = 'mega-hub'

/** 接管数组（折叠/收纳共享）中「未分组」条目的保留 gid。 */
export const UNGROUPED_GID = '$ungrouped'

/**
 * 按「可见序槽位」把 itemId 放入数组（维护数组，不维护 index）：
 * - full 为权威数组（含隐藏项，顺序稳定）；hidden 判定该 id 当前是否不在可见列表中（如已释放/已消失分区）；
 * - slot 为可见序列中的插入槽序号（0..可见数，末槽=末尾；同列表可见拖动时槽位含其自身，按下标换算）；
 * - 若 itemId 已在 full 中则先移除旧位（同列表移动语义），再按目标槽插入；
 *   不在 full 中（跨列表移入）时直接按可见槽插入。
 */

/** 未分组条目 items 的「存储全集」：stored（含已不存在插件的墓碑，顺序保留）+
 *  尚未收录的实时项（按实时收集序追加）。写回前用它保证缺失项配置不被意外清除。 */
export function expandUngroupedOrder(stored: readonly string[], liveRaw: readonly string[]): string[] {
  const set = new Set(stored)
  const out = [...stored]
  for (const id of liveRaw) if (!set.has(id)) out.push(id)
  return out
}

export function placeVisible(
  full: readonly string[],
  hidden: (id: string) => boolean,
  itemId: string,
  slot: number,
): string[] {
  const idx = full.indexOf(itemId)
  const visCount = full.reduce((c, id) => c + (hidden(id) ? 0 : 1), 0)
  let rank: number
  if (idx >= 0 && !hidden(itemId)) {
    // 同列表且自身可见：槽位序号含自身 → 换算最终排名
    let fromR = -1
    let seen = 0
    for (let i = 0; i < full.length; i++) {
      if (hidden(full[i])) continue
      if (i === idx) {
        fromR = seen
        break
      }
      seen++
    }
    rank = fromR < 0 ? Math.max(0, Math.min(slot, visCount)) : dropFinalIndex(fromR, slot, visCount)
  } else {
    // 跨列表 / 自身被隐藏（已释放）：按当前可见序列直接定位
    rank = Math.max(0, Math.min(slot, visCount))
  }
  const rest = idx < 0 ? [...full] : full.filter((_, i) => i !== idx)
  // 插入到可见序 rank 处：排在 rank 个可见项之后
  let at = rest.length
  let acc = 0
  for (let i = 0; i < rest.length; i++) {
    if (hidden(rest[i])) continue
    if (acc === rank) {
      at = i
      break
    }
    acc++
  }
  rest.splice(at, 0, itemId)
  return rest
}