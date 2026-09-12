import type { Context } from '@deepseek-ai/cordis'
// 类型增强：slots（runtime）、settingsScope（ui-settings）、locale（locale）
import type {} from '@deepseek-ai/dsh-client-ui-renderer/client'
import type {} from '@deepseek-ai/dsh-client-ui-settings/client'
import type {} from '@deepseek-ai/dsh-client-locale/client'
import type { SettingsCenterInjected } from './SettingsCenter.tsx'
import { SettingsShell } from './SettingsShell.tsx'
import { memberLabel, type MemberEntry, type SectionEntry } from './pure.ts'
import { zh, en } from './locales.ts'
import type { MegaSettingsConfig } from '../schema.ts'
import { MEMBER_META_SEAT, MEMBER_PAGE_SEAT, MEMBER_OPTIMIZE_ID } from './seats.ts'
import type { MiniSlots } from './mini.tsx'
import { OptimizeCenter } from './OptimizeCenter.tsx'
export { MEMBER_META_SEAT, MEMBER_PAGE_SEAT, MEMBER_OPTIMIZE_ID }

/** 构建期注入的包版本（scripts/build-client.mjs；成员徽章/优化页徽章用）。 */
declare const MGS_VERSION: string

export const name = 'dsh-mega-settings'
export const inject = ['slots', 'settingsScope', 'locale']

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
/** ctx.slots 的 mini 渲染数据面（0.1.2 线：hostFace().root 标准 kit + storeOf 传 scopeBinding）。 */
function miniFace(ctx: Context): MiniSlots {
  const slots = ctx.slots as unknown as SlotsLike
  const host = slots.hostFace() as {
    root?: {
      getSnapshot(): {
        hooks?: Record<string, unknown>
        keyedHooks?: Record<string, unknown>
        props?: Record<string, unknown>
      }
      subscribe(fn: () => void): () => void
    }
    locale?: {
      bind(ns: string): (key: string) => string
      getSnapshot(): { revision: number }
      subscribe(fn: () => void): () => void
    }
    storeOf?: (entry: unknown, scopeBinding: unknown) => unknown
  }
  // 稳定的 locale 面包装（host.locale 为 live getter，方法每次委托取当前面；
  // 包装对象身份稳定，mini 可安全订阅 locale revision 以驱动 thunk label/t 重解析）。
  const localeFace = host.locale
    ? {
        bind: (ns: string) => (key: string) => (host.locale ? host.locale.bind(ns)(key) : key),
        getSnapshot: () => host.locale?.getSnapshot() ?? { revision: 0 },
        subscribe: (fn: () => void) => host.locale?.subscribe(fn) ?? (() => {}),
      }
    : undefined
  return {
    entriesOfSlot: (key) => slots.entriesOfSlot(key) as MiniSlots['entriesOfSlot'] extends (k: string) => infer R ? R : never,
    subscribe: (key, fn) => slots.subscribe(key, fn),
    getVersion: (key) => slots.getVersion(key),
    hostFace: () => ({
      root: host.root
        ? {
            getSnapshot: () => host.root?.getSnapshot() as never,
            subscribe: (fn) => host.root?.subscribe(fn) ?? (() => {}),
          }
        : undefined,
      locale: localeFace,
    storeOf: (entry, scopeBinding) => {
      const s = host.storeOf?.(entry, scopeBinding) as
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
  // locale 面（revision 驱动 thunk label 重投影；官方壳同款用法：ctx.locale.getSnapshot().revision）
  const locale = ctx.locale as unknown as {
    getSnapshot(): { revision: number }
    subscribe(fn: () => void): () => void
  }
  let rowsVersion = -1
  let rowsRevision = -1
  let rows: { id: string; order: number; label: string }[] = []
  const shellInjected = () => ({
    scope,
    slots: slotsFace(ctx),
    hooks: {
      sections: {
        getSnapshot: () => {
          const version = slots.getVersion('settings.section')
          // 官方语义：settings.section 条目 label 多为 thunk（() => t('…')），locale 切换
          // 不 bump 账本 version——缓存键须含 locale revision，否则导航行文案不随语言刷新。
          const revision = locale?.getSnapshot()?.revision ?? 0
          if (version !== rowsVersion || revision !== rowsRevision) {
            rowsVersion = version
            rowsRevision = revision
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
          const offLedger = slots.subscribe('settings.section', fn)
          const offLocale = locale?.subscribe(fn)
          return () => {
            offLedger()
            offLocale?.()
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

  // 自身作为 mega 成员：mega 优化页（元信息 seat + 页面 seat，与成员契约一致——
  // 收纳模式出现在「mega」组卡片、折叠模式出现在 mega 固组行；宿主自足场景同款呈现）
  const slots = ctx.slots as unknown as SlotsLike
  slots.inject(MEMBER_META_SEAT, () =>
    slots.register(
      {
        name: MEMBER_META_SEAT,
        id: MEMBER_OPTIMIZE_ID,
        order: 0,
        label: () => t('opt.title'),
        inject: () => ({ description: () => t('opt.title'), version: MGS_VERSION }),
      },
      MemberRowPlaceholder,
    ),
  )
  slots.inject(MEMBER_PAGE_SEAT, () =>
    slots.register(
      {
        name: MEMBER_PAGE_SEAT,
        key: MEMBER_OPTIMIZE_ID,
        order: 0,
        label: () => t('opt.title'),
        locale: 'mega-settings',
        inject: () => ({ scope, slots: slotsFace(ctx) }),
      },
      OptimizeCenter,
    ),
  )
}

/** 元信息 seat 占位组件（宿主自绘成员列表，组件不被渲染；与成员契约一致）。 */
function MemberRowPlaceholder(): null {
  return null
}