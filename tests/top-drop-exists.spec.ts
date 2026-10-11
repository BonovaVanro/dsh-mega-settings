/**
 * 「原生行是否可显示」的判定回归（真实 bug 的输入形状）。
 *
 * 实测 bug：顶区拖拽时，除首位以外的任意槽都会把项追加到末尾。
 * 日志证据：
 *   hiddenSelf: true                        ← 被拖的 agent-presets 被判「不存在」
 *   nativeIds:  [account, general, models, plugins, agent-presets]
 *   navArrayIds:[general, models, agent-presets, plugins, global-rules, account]
 *   restVisible:["global-rules"]            ← 6 项只余 1 项可见
 * 根因：原生行一旦进入 navOrder 数组（arrayNatives），旧判定只查 nativePresent（已排除
 * arrayNatives）→ 判为不存在 → placeVisible 的可见项数被压到 1 → 落点被推到末尾。
 *
 * 本用例把两套判定并列，钉住「必须算存在」。
 */
import { describe, expect, it } from 'vitest'
import { dropFinalIndex, placeVisible } from '../src/client/pure.ts'

const NATIVE = ['account', 'general', 'models', 'plugins', 'agent-presets']
const navRows = [
  { id: 'account', order: -10 },
  { id: 'general', order: 0 },
  { id: 'models', order: 10 },
  { id: 'plugins', order: 15 },
  { id: 'agent-presets', order: 20 },
  { id: 'global-rules', order: 30 },
]
const navArrayIds = ['general', 'models', 'agent-presets', 'plugins', 'global-rules', 'account']
const nativeSet = new Set(NATIVE)
const arrayNatives = new Set(navArrayIds.filter((id) => nativeSet.has(id)))
const managedIds = ['global-rules']

/** 旧判定：只查 nativePresent（已排除 arrayNatives）—— 就是出 bug 的那版 */
const existsOld = (id: string): boolean =>
  nativeSet.has(id)
    ? navRows.filter((r) => nativeSet.has(r.id) && !arrayNatives.has(r.id)).some((r) => r.id === id)
    : managedIds.includes(id)

/** 新判定：原生行只要在 navRows 里就算存在（含已纳管进数组的） */
const existsNew = (id: string): boolean =>
  nativeSet.has(id) ? navRows.some((r) => r.id === id) : managedIds.includes(id)

const fullTopIds = ['general', 'models', 'agent-presets', 'plugins', 'global-rules', 'account']

/**
 * 独立 oracle（口语化定义，不复用实现）：把 id 从列表中取出，再插到「移除后第 rank 个
 * 可见项之后」（rank 由调用方按同一语义给出）。用于与 placeVisible 互为对照。
 */
function oracleInsert(full: readonly string[], hidden: (x: string) => boolean, id: string, rank: number): string[] {
  const rest = full.filter((x) => x !== id)
  const vis = rest.filter((x) => !hidden(x))
  const anchor = rank <= 0 ? -1 : rest.indexOf(vis[rank - 1])
  return [...rest.slice(0, anchor + 1), id, ...rest.slice(anchor + 1)]
}

describe('顶区落点：原生行存在性判定', () => {
  it('旧判定确实把已纳管的原生行判成不存在（复现 bug）', () => {
    expect(existsOld('agent-presets')).toBe(false)
    expect(fullTopIds.filter((x) => !existsOld(x))).toEqual(['general', 'models', 'agent-presets', 'plugins', 'account'])
  })

  it('新判定认为所有原生行都存在', () => {
    for (const id of fullTopIds) expect(existsNew(id)).toBe(true)
  })

  it('用旧判定 → 落点被追加到末尾（现象）；用新判定 → 落到正确位置（修复）', () => {
    const hiddenOld = (x: string): boolean => !existsOld(x)
    const hiddenNew = (x: string): boolean => !existsNew(x)
    const rest = fullTopIds.filter((x) => x !== 'agent-presets')
    const oldOut = placeVisible(rest, hiddenOld, 'agent-presets', 3)
    const newOut = placeVisible(rest, hiddenNew, 'agent-presets', 3)
    expect(oldOut[oldOut.length - 1]).toBe('agent-presets') // 旧：一律末尾
    expect(newOut[newOut.length - 1]).not.toBe('agent-presets') // 新：按槽位落位
  })

  it('新判定与独立 oracle 完全一致（全部项 × 全部槽位）', () => {
    const hidden = (x: string): boolean => !existsNew(x)
    for (const id of fullTopIds) {
      const fromR = fullTopIds.indexOf(id)
      for (let slot = 0; slot <= fullTopIds.length; slot++) {
        // 同列表拖动：zone 含自身 → 目标 rank 用 dropFinalIndex 的口径
        const rank = dropFinalIndex(fromR, slot, fullTopIds.length)
        const actual = placeVisible(fullTopIds, hidden, id, slot)
        const expected = oracleInsert(fullTopIds, hidden, id, rank)
        expect({ id, slot, actual }).toEqual({ id, slot, actual: expected })
      }
    }
  })

  it('新判定：只有「拖到末槽」才会落到可见末尾', () => {
    const hidden = (x: string): boolean => !existsNew(x)
    for (const id of ['global-rules', 'agent-presets', 'account']) {
      for (const slot of [0, 1, 2, 3, 4]) {
        const vis = placeVisible(fullTopIds, hidden, id, slot).filter((x) => !hidden(x))
        expect({ id, slot, isLast: vis[vis.length - 1] === id }).toEqual({ id, slot, isLast: false })
      }
      const visLast = placeVisible(fullTopIds, hidden, id, 6).filter((x) => !hidden(x))
      expect({ id, visLast: visLast[visLast.length - 1] }).toEqual({ id, visLast: id })
    }
  })
})
