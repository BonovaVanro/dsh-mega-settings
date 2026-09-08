import { describe, it, expect } from 'vitest'
import { memberId, memberLabel, memberVersion, sortMembers, collectManaged, sectionId, groupOf, ungroupedIds, validateGroupName, removeGroup, reorderGroups, dropFinalIndex, orderedUngrouped, placeVisible, expandUngroupedOrder, NAV_HUB_ID, UNGROUPED_GID, NATIVE_SECTION_IDS, HOST_SECTION_ID, type MemberEntry, type GroupDef } from '../src/client/pure.ts'

describe('pure: memberLabel', () => {
  it('label 位于 options（SlotCore 条目构造）', () => {
    const entry: MemberEntry = { id: 'x', options: { label: '显示名' } }
    expect(memberLabel(entry)).toBe('显示名')
  })

  it('label 为函数时求值', () => {
    const entry: MemberEntry = { id: 'x', options: { label: () => '函数名' } }
    expect(memberLabel(entry)).toBe('函数名')
  })

  it('兼容顶层 label', () => {
    const entry = { id: 'x', label: '顶层名' } as MemberEntry
    expect(memberLabel(entry)).toBe('顶层名')
  })

  it('缺失时回退 id', () => {
    expect(memberLabel({ id: 'x' })).toBe('x')
  })

  it('SlotCore 条目形态：id 位于 options（无顶层 id）', () => {
    // 实测：SlotCore 条目构造 { component, options: { id, order, label } }，无顶层 id
    expect(memberId({ options: { id: 'mega-chat-nav' } })).toBe('mega-chat-nav')
    expect(memberId({ options: { id: 'mega-chat-nav' }, id: undefined })).toBe('mega-chat-nav')
    expect(memberId({ options: {} })).toBe('')
    expect(memberLabel({ options: { id: 'mega-chat-nav' } })).toBe('mega-chat-nav')
    expect(sortMembers([{ options: { id: 'b' } }, { options: { id: 'a' } }]).map((e) => memberId(e))).toEqual(['a', 'b'])
  })
})

describe('pure: memberVersion', () => {
  it('经 inject 面读取版本', () => {
    const entry: MemberEntry = { id: 'x', options: { inject: () => ({ version: '0.2.0' }) } }
    expect(memberVersion(entry)).toBe('0.2.0')
  })

  it('SlotCore 条目形态：inject 位于顶层（不在 options）', () => {
    const entry: MemberEntry = { options: { id: 'mega-chat-nav' }, inject: () => ({ version: '0.1.0' }) }
    expect(memberVersion(entry)).toBe('0.1.0')
    // 顶层优先
    expect(memberVersion({ options: { inject: () => ({ version: 'old' }) }, inject: () => ({ version: 'new' }) })).toBe('new')
  })

  it('无 inject → undefined（UI 显示「未知」）', () => {
    expect(memberVersion({ id: 'x' })).toBeUndefined()
  })

  it('inject 缺失 version / 非字符串 / 抛错 → undefined（防御式）', () => {
    expect(memberVersion({ id: 'x', options: { inject: () => ({}) } })).toBeUndefined()
    expect(memberVersion({ id: 'x', options: { inject: () => ({ version: 123 }) } })).toBeUndefined()
    expect(memberVersion({ id: 'x', options: { inject: () => { throw new Error('boom') } } })).toBeUndefined()
  })
})

describe('pure: sortMembers', () => {
  const mk = (id: string, order?: number): MemberEntry => ({ id, options: order !== undefined ? { order } : {} })

  it('order 升序，缺省视为 0', () => {
    const sorted = sortMembers([mk('b', 10), mk('a'), mk('c', 5)])
    expect(sorted.map((m) => m.id)).toEqual(['a', 'c', 'b'])
  })

  it('同级按 id 字典序', () => {
    const sorted = sortMembers([mk('z', 1), mk('a', 1)])
    expect(sorted.map((m) => m.id)).toEqual(['a', 'z'])
  })

  it('空列表', () => {
    expect(sortMembers([])).toEqual([])
  })

  it('不修改入参（返回新数组）', () => {
    const input = [mk('b'), mk('a')]
    const output = sortMembers(input)
    expect(input.map((m) => m.id)).toEqual(['b', 'a'])
    expect(output.map((m) => m.id)).toEqual(['a', 'b'])
  })
})
describe('v2: collectManaged（管控项收集）', () => {
  const sec = (id: string, order = 0) => ({ options: { id, order } })
  it('过滤原生分区/自身/mega 成员同 id', () => {
    const sections = [sec('general'), sec('plugins'), sec('mega-settings'), sec('mega-chat-nav'), sec('dsh-better-sidebar', 5), sec('foo-plugin', 2)]
    const items = collectManaged(sections, ['mega-chat-nav'])
    expect(items.map((i) => i.id)).toEqual(['foo-plugin', 'dsh-better-sidebar'])
  })
  it('无顶层 id 的条目跳过；按 order 排序', () => {
    const sections = [{ options: { label: 'x' } }, sec('b', 10), sec('a', 1)]
    const items = collectManaged(sections, [])
    expect(items.map((i) => i.id)).toEqual(['a', 'b'])
  })
  it('sectionId 归一（options 优先）', () => {
    expect(sectionId({ options: { id: 'x' } })).toBe('x')
    expect(sectionId({ id: 'y' })).toBe('y')
    expect(sectionId({})).toBe('')
  })
})

describe('v2: 分组运算', () => {
  const g = (id: string, name: string, itemIds: string[] = []): GroupDef => ({ id, name, itemIds })
  it('validateGroupName：空/保留名/重名', () => {
    expect(validateGroupName('  ', [])).toBe('empty')
    expect(validateGroupName('未分组', [])).toBe('reserved')
    expect(validateGroupName('MEGA', [])).toBe('reserved')
    expect(validateGroupName('未分组 ', [])).toBe('reserved')
    expect(validateGroupName('导航', [g('a', '导航')])).toBe('duplicate')
    expect(validateGroupName('导航', [g('a', '其他')])).toBeNull()
  })
  it('removeGroup：组内项回未分组', () => {
    const groups = [g('a', 'A', ['x', 'y']), g('b', 'B', ['z'])]
    const after = removeGroup(groups, 'a')
    expect(after).toEqual([g('b', 'B', ['z'])])
    expect(groupOf('x', after)).toBeNull()
    expect(ungroupedIds(['x', 'y', 'z'], after)).toEqual(['x', 'y'])
  })
  it('ungroupedIds：仅未被组覆盖的', () => {
    const groups = [g('a', 'A', ['x'])]
    expect(ungroupedIds(['x', 'y'], groups)).toEqual(['y'])
  })
  it('reorderGroups：组排序移动（越界保持）', () => {
    const groups = [g('a', 'A', ['x', 'y', 'z']), g('b', 'B')]
    expect(reorderGroups(groups, 0, 1).map((x) => x.id)).toEqual(['b', 'a'])
    expect(reorderGroups(groups, 0, 9)).toEqual(groups)
  })
})

describe('v2.1: 插入排序辅助（拖拽槽位）', () => {
  // [A,B,C]：槽 0=最前, 1=A后/B前, 2=B后/C前, 3=末尾
  const list = (): string[] => ['A', 'B', 'C']
  const apply = (from: number, zone: number): string[] => {
    const arr = list()
    const to = dropFinalIndex(from, zone, arr.length)
    const [m] = arr.splice(from, 1)
    arr.splice(to, 0, m)
    return arr
  }
  it('A(0) 拖到各槽', () => {
    expect(apply(0, 0)).toEqual(['A', 'B', 'C'])
    expect(apply(0, 1)).toEqual(['A', 'B', 'C']) // 原槽
    expect(apply(0, 2)).toEqual(['B', 'A', 'C'])
    expect(apply(0, 3)).toEqual(['B', 'C', 'A'])
  })
  it('B(1) 拖到各槽', () => {
    expect(apply(1, 0)).toEqual(['B', 'A', 'C'])
    expect(apply(1, 1)).toEqual(['A', 'B', 'C'])
    expect(apply(1, 2)).toEqual(['A', 'B', 'C']) // 原槽
    expect(apply(1, 3)).toEqual(['A', 'C', 'B'])
  })
  it('C(2) 拖到各槽', () => {
    expect(apply(2, 0)).toEqual(['C', 'A', 'B'])
    expect(apply(2, 1)).toEqual(['A', 'C', 'B'])
    expect(apply(2, 2)).toEqual(['A', 'B', 'C'])
    expect(apply(2, 3)).toEqual(['A', 'B', 'C']) // 原槽
  })
  it('越界容错（dropFinalIndex 自钳制）', () => {
    expect(dropFinalIndex(0, 99, 3)).toBe(2)
    expect(dropFinalIndex(2, 0, 3)).toBe(0)
  })
})

describe('v2.1: orderedUngrouped（未分组渲染序）', () => {
  it('order 命中项按 order 排，其余追加', () => {
    expect(orderedUngrouped(['a', 'b', 'c', 'd'], ['c', 'a'])).toEqual(['c', 'a', 'b', 'd'])
  })
  it('order 中的失效 id（已分组/不存在）跳过', () => {
    expect(orderedUngrouped(['a', 'b'], ['z', 'b', 'y'])).toEqual(['b', 'a'])
    expect(orderedUngrouped(['a', 'b'], ['a', 'a'])).toEqual(['a', 'b'])
  })
  it('空 order = 原序', () => {
    expect(orderedUngrouped(['a', 'b'], [])).toEqual(['a', 'b'])
  })
})


describe('v2.2: placeVisible（接管/nav 数组的可见槽落点，维护数组不维护 index）', () => {
  const none = (): boolean => false
  it('同列表可见拖动（槽含自身按下标换算）', () => {
    expect(placeVisible(['A', 'B', 'C'], none, 'A', 0)).toEqual(['A', 'B', 'C'])
    expect(placeVisible(['A', 'B', 'C'], none, 'A', 1)).toEqual(['A', 'B', 'C']) // 原槽
    expect(placeVisible(['A', 'B', 'C'], none, 'A', 2)).toEqual(['B', 'A', 'C'])
    expect(placeVisible(['A', 'B', 'C'], none, 'A', 3)).toEqual(['B', 'C', 'A'])
    expect(placeVisible(['A', 'B', 'C'], none, 'B', 0)).toEqual(['B', 'A', 'C'])
    expect(placeVisible(['A', 'B', 'C'], none, 'B', 3)).toEqual(['A', 'C', 'B'])
    expect(placeVisible(['A', 'B', 'C'], none, 'A', 99)).toEqual(['B', 'C', 'A']) // 越界→末
  })
  it('跨列表插入（目标列表不含该 id，slot = 可见槽序号）', () => {
    expect(placeVisible(['A', 'B', 'C'], none, 'X', 0)).toEqual(['X', 'A', 'B', 'C'])
    expect(placeVisible(['A', 'B', 'C'], none, 'X', 1)).toEqual(['A', 'X', 'B', 'C'])
    expect(placeVisible(['A', 'B', 'C'], none, 'X', 3)).toEqual(['A', 'B', 'C', 'X'])
    expect(placeVisible([], none, 'X', 0)).toEqual(['X'])
  })
  it('隐藏项（已释放/已消失）在数组中保持槽位，只按可见项定位', () => {
    const hidden = (id: string): boolean => id === 'X'
    // X 隐藏但位于数组中：移动可见 A 到末尾（可见序 2 → 追加到可见末）
    expect(placeVisible(['X', 'A', 'B'], hidden, 'A', 2)).toEqual(['X', 'B', 'A'])
    // X 隐藏且为目标（接管回原列表）：先移除旧位再按可见槽插入
    expect(placeVisible(['A', 'X', 'B'], hidden, 'X', 0)).toEqual(['X', 'A', 'B'])
    expect(placeVisible(['A', 'X', 'B'], hidden, 'X', 1)).toEqual(['A', 'X', 'B'])
    expect(placeVisible(['X', 'A', 'B'], hidden, 'X', 0)).toEqual(['X', 'A', 'B'])
  })
  it('不修改入参', () => {
    const full = ['A', 'B', 'C']
    placeVisible(full, none, 'A', 2)
    expect(full).toEqual(['A', 'B', 'C'])
  })
})

describe('v2.2: 保留 id 常量', () => {
  it('navOrder 入口与未分组专属 gid 不与真实分区 id 冲突', () => {
    expect(NAV_HUB_ID).toBe('mega-hub')
    expect(UNGROUPED_GID).toBe('$ungrouped')
    expect(NAV_HUB_ID).not.toBe(UNGROUPED_GID)
  })
})

describe('v2.2: expandUngroupedOrder（未分组存储全集：缺失项墓碑保留）', () => {
  it('stored 顺序保留并追加未收录的实时项', () => {
    expect(expandUngroupedOrder(['a', 'm'], ['a', 'b', 'c'])).toEqual(['a', 'm', 'b', 'c'])
    expect(expandUngroupedOrder([], ['b', 'a'])).toEqual(['b', 'a'])
    expect(expandUngroupedOrder(['x'], [])).toEqual(['x'])
  })
  it('不修改入参', () => {
    const stored = ['a']
    expandUngroupedOrder(stored, ['b'])
    expect(stored).toEqual(['a'])
  })
})
