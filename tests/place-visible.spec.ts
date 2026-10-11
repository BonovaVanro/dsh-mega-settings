/**
 * placeVisible 的真实数据复算（用用户日志里的确切输入）。
 *
 * 实测现象：顶区把 global-rules（第 1 项）拖到任意非首位槽，结果都被追加到末尾。
 * 日志给出的输入：display/fullTopIds = 6 项、slot = 1。
 */
import { describe, expect, it } from 'vitest'
import { dropFinalIndex, placeVisible } from '../src/client/pure.ts'

const FULL = ['global-rules', 'general', 'models', 'agent-presets', 'account', 'plugins']
const ID = 'global-rules'
const visible = (): boolean => false

describe('placeVisible：真实日志输入复算', () => {
  it('slot=1 应落在第 1 位（rank=0）', () => {
    const out = placeVisible(FULL, visible, ID, 1)
    expect(out).toEqual(['global-rules', 'general', 'models', 'agent-presets', 'account', 'plugins'])
  })

  it('各槽位落点单调且符合语义', () => {
    for (const slot of [0, 1, 2, 3, 4, 5, 6]) {
      const out = placeVisible(FULL, visible, ID, slot)
      const at = out.indexOf(ID)
      const expectAt = slot <= 1 ? 0 : Math.min(slot - 1, FULL.length - 1)
      expect({ slot, at, expectAt }).toEqual({ slot, at, expectAt })
    }
  })

  it('dropFinalIndex 与 placeVisible 的口径一致', () => {
    for (let from = 0; from < FULL.length; from++) {
      for (let zone = 0; zone <= FULL.length; zone++) {
        const full = [...FULL]
        const id = full[from]
        const out = placeVisible(full, visible, id, zone)
        expect(out.indexOf(id)).toBe(dropFinalIndex(from, zone, FULL.length))
      }
    }
  })
})
