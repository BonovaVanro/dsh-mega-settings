import type { Context } from '@deepseek-ai/cordis'
// 类型增强：slots（runtime）、settingsScope（ui-settings）、locale（locale）
import type {} from '@deepseek-ai/dsh-client-runtime/client'
import type {} from '@deepseek-ai/dsh-client-ui-settings/client'
import type {} from '@deepseek-ai/dsh-client-locale/client'
import { SettingsCenter, type SettingsCenterInjected } from './SettingsCenter.tsx'
import { SettingsShell } from './SettingsShell.tsx'
import { memberLabel, type MemberEntry, type SectionEntry } from './pure.ts'
import { zh, en } from './locales.ts'
import type { ControlMode, SettingsEntryMode, MegaSettingsConfig } from '../schema.ts'
import { MEMBER_META_SEAT, MEMBER_PAGE_SEAT } from './seats.ts'
import type { MiniSlots } from './mini.tsx'
export { MEMBER_META_SEAT, MEMBER_PAGE_SEAT }

export const name = 'dsh-mega-settings'
export const inject = ['slots', 'settingsScope', 'locale']

const ENTRY_ORDER = 900

/**
 * slots 服务的最小类型面（dsh-client-ui-slots 为虚拟包无 .d.ts 落盘；在一处适配，
 * 业务代码不再散布 as never）。运行时即 ctx.slots（SlotRegistry）。
 */
interface SlotsLike {
  register(options: unknown, component: unknown): unknown
  inject(key: string, callback: () => unknown): () => void
  entries(key: string): readonly {
    id: string
    options?: {
      id?: string
      order?: number
      label?: string | (() => string)
      inject?: () => Record<string, unknown>
      [k: string]: unknown
    }
    [k: string]: unknown
  }[]
  entriesOfSlot(key: string): readonly {
    id: string
    options?: {
      id?: string
      key?: string
      order?: number
      label?: string | (() => string)
      [k: string]: unknown
    }
    [k: string]: unknown
  }[]
  subscribe(key: string, fn: () => void): () => void
  getVersion(key: string): number
  hostFace(): unknown
}

/** context 的最小事件面（rc 阶段 Events 增强不全；边界一次性收窄）。 */
function on(ctx: Context, event: string, fn: (...args: never[]) => void) {
  return (ctx.on as unknown as (event: string, fn: (...args: never[]) => void) => () => void)(event, fn)
}

/** 注入组件的 slots 业务面（列表读取/订阅；组件无 ctx，包装后传入）。 */
/** ctx.slots 的 mini 渲染数据面（runtime 公开方法；类型收窄于 mini.tsx）。 */
function miniFace(ctx: Context): MiniSlots {
  const slots = ctx.slots as unknown as SlotsLike
  const host = slots.hostFace() as {
    sessions?: { list: unknown }
    workspaces?: { list: unknown }
    locale?: {
      bind(ns: string): (key: string) => string
      getSnapshot(): { revision: number }
      subscribe(fn: () => void): () => void
    }
    storeOf?: (entry: unknown, scopeKey: string) => unknown
  }
  return {
    entriesOfSlot: (key) => slots.entriesOfSlot(key) as MiniSlots['entriesOfSlot'] extends (k: string) => infer R ? R : never,
    subscribe: (key, fn) => slots.subscribe(key, fn),
    getVersion: (key) => slots.getVersion(key),
    hostFace: () => ({
      sessions: host.sessions?.list as never,
      workspaces: host.workspaces?.list as never,
      locale: host.locale
        ? {
            bind: (ns) => (key) => host.locale?.bind(ns)(key) ?? key,
            getSnapshot: () => host.locale?.getSnapshot() ?? { revision: 0 },
            subscribe: (fn) => host.locale?.subscribe(fn) ?? (() => undefined),
          }
        : undefined,
    storeOf: (entry, scopeKey) => {
      const s = host.storeOf?.(entry, scopeKey) as
        | { getSnapshot(): unknown; subscribe(fn: () => void): () => void; actions?: unknown }
        | undefined
      return s
    },
    }),
  }
}

function slotsFace(ctx: Context): SettingsCenterInjected['slots'] {
  const slots = ctx.slots as unknown as SlotsLike
  return {
    members: () => slots.entries(MEMBER_META_SEAT) as readonly MemberEntry[],
    subscribeMembers: (fn) => slots.subscribe(MEMBER_META_SEAT, fn),
    onSlotsChanged: (fn) => on(ctx, 'slots/changed', fn),
    onConnectionReset: (fn) => on(ctx, 'connection/reset', fn),
    sections: () => slots.entriesOfSlot('settings.section') as never,
    mini: miniFace(ctx),
  }
}

/** 设置壳：shadow sidebar.settings（priority -100 → 最低优先级渲染接管官方设置弹层）。
 *  数据流同 dsh-settings-hub：注册 inject face 提供 hooks.sections（getSnapshot 缓存版本，
 *  label 已在数据源解析），组件经官方渲染器注入 useSections；children 声明 mega seats
 *  （成员页走官方 renderSlot）。 */
function mountShell(
  ctx: Context,
  scope: SettingsCenterInjected['scope'],
  label: () => string,
): (() => void) | null {
  const slots = ctx.slots as unknown as SlotsLike
  const hostFace = slots.hostFace() as {
    locale?: { getSnapshot(): { revision: number }; subscribe(fn: () => void): () => void }
  }
  let rowsVersion = -1
  let localeVersion = -1
  let rows: { id: string; order: number; label: string }[] = []
  const shellInjected = () => ({
    scope,
    slots: slotsFace(ctx),
    hooks: {
      sections: {
        // 标签缓存同时感知 locale revision：官方条目 label 是活函数（切换语言后返回值变化），
        // 但官方条目并不在 locale/change 时重注册（settings.section 账本不 bump），
        // 仅订阅账本会拿到旧文案。订阅并比对 locale 版本后强制重解析。
        getSnapshot: () => {
          const version = slots.getVersion('settings.section')
          const lver = hostFace.locale?.getSnapshot().revision ?? 0
          if (version !== rowsVersion || lver !== localeVersion) {
            rowsVersion = version
            localeVersion = lver
            rows = (slots.entriesOfSlot('settings.section') as SectionEntry[])
              .map((e) => ({
                id: (e.options?.id ?? e.id ?? '') as string,
                order: e.options?.order ?? 0,
                label: memberLabel(e as MemberEntry),
              }))
              .sort((a, b) => a.order - b.order)
          }
          return rows
        },
        subscribe: (fn: () => void) => {
          const a = slots.subscribe('settings.section', fn)
          const b = hostFace.locale?.subscribe ? hostFace.locale.subscribe(fn) : (() => undefined)
          return () => {
            a()
            b()
          }
        },
      },
    },
  })
  const options = {
    name: 'sidebar.settings',
    priority: -100,
    label,
    locale: 'mega-settings',
    inject: shellInjected,
    children: {
      [MEMBER_META_SEAT]: { kind: 'list' as const, scope: 'root' as const },
      [MEMBER_PAGE_SEAT]: { kind: 'keyed' as const, scope: 'root' as const },
    },
  }
  return slots.inject('sidebar.settings', () => slots.register(options, SettingsShell))
}

export function apply(ctx: Context): void {
  // 词条（§8：zh/en 全量登记；M4 起改类型化 register + LocaleNamespaceMap 合并）
  ctx.locale.register('mega-settings', 'zh', zh)
  ctx.locale.register('mega-settings', 'en', en)
  const t = ctx.locale.bind('mega-settings')

  // 自身配置 scope（组件渲染用；mode/entry 驱动挂载迁移）
  const scope = ctx.settingsScope.bind<MegaSettingsConfig>({ namespace: 'mega-settings' })

  // 设置壳恒驻（shadow sidebar.settings）；mode/entry 在壳与设置中心内读取，挂载不迁移
  mountShell(ctx, scope, () => t('settings.center'))
}