import type { Context } from '@deepseek-ai/cordis'
// 类型增强：slots（runtime）、configForms（ui-settings）、locale（locale）
import type {} from '@deepseek-ai/dsh-client-ui-renderer/client'
import type {} from '@deepseek-ai/dsh-client-ui-settings/client'
import type {} from '@deepseek-ai/dsh-client-locale/client'
import type { SettingsCenterInjected } from './SettingsCenter.tsx'
import { SettingsShell } from './SettingsShell.tsx'
import { memberLabel, type MemberEntry, type SectionEntry } from './pure.ts'
import { zh, en } from './locales.ts'
import type { MegaSettingsConfig, SettingsPathOpView } from '../schema.ts'
import { MEMBER_META_SEAT, MEMBER_PAGE_SEAT, MEMBER_OPTIMIZE_ID } from './seats.ts'
import { forwardTranslate, type MiniSlots } from './mini.tsx'
import { OptimizeCenter } from './OptimizeCenter.tsx'
import { readOptimizeCache, syncOptimizeEffects } from './optimize-effects.ts'
import { readVersionsCache, subscribeVersions } from './versions.ts'
export { MEMBER_META_SEAT, MEMBER_PAGE_SEAT, MEMBER_OPTIMIZE_ID }

/** 构建期注入的包版本（scripts/build-client.mjs；成员徽章/优化页徽章用）。 */
declare const MGS_VERSION: string

export const name = 'dsh-mega-settings'
export const inject = ['slots', 'configForms', 'locale', 'sessions']

/* 刷新首帧即生效（FOUC 修复）：模块求值阶段（React 渲染前、官方 settings 快照到达前）
 * 先按本地镜像注入优化效果，避免「先看到未优化的一帧、再跳变成优化后」；
 * 宿主快照 / settings.section / 已装版本到达后由 apply 的订阅校正。 */
if (typeof document !== 'undefined') {
  syncOptimizeEffects(readOptimizeCache(), new Set(Object.keys(readVersionsCache())))
}

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
      bind(ns: string): (key: string, params?: Record<string, unknown>) => string
      getSnapshot(): { revision: number }
      subscribe(fn: () => void): () => void
    }
    storeOf?: (entry: unknown, scopeBinding: unknown) => unknown
  }
  // 稳定的 locale 面包装（host.locale 为 live getter，方法每次委托取当前面；
  // 包装对象身份稳定，mini 可安全订阅 locale revision 以驱动 thunk label/t 重解析）。
  const localeFace = host.locale
    ? {
        // 透传 params：官方 translate 在 params 为空时返回模板原文（{n}/{name} 不插值）
        bind: (ns: string) => forwardTranslate(() => host.locale?.bind(ns)),
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
  // 连接状态/重连（官方 SettingsRootInjected 同款：connection 服务 observable + reconnect 回调）
  // 官方 settings.trigger/header/action/close 等子槽由 mini 同构渲染器直接消费（不经 renderSlot）
  const connection = ctx.get('connection') as unknown as
    | { state: { getSnapshot(): unknown; subscribe(fn: () => void): () => void }; reconnect(): void }
    | undefined
  // onboarding 判定源（官方 SettingsRoot 同款：sessions 服务 observable 的 list；缺省则永不展示引导步）
  const sessions = ctx.get('sessions') as unknown as
    | { list?: { getSnapshot(): unknown; subscribe(fn: () => void): () => void } }
    | undefined
  const shellInjected = () => ({
    scope,
    slots: slotsFace(ctx),
    reconnect: connection === undefined ? undefined : (): void => connection.reconnect(),
    hooks: {
      connectionState: connection?.state,
      sessions: sessions?.list,
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
      // 注意：不能在此声明官方 settings.header/action/close 等子槽——
      // 官方 sidebar.settings 条目已声明它们，再声明会报 "slot already declared"；
      // 影子壳因此无法经 renderSlot 渲染官方 settings.* 内容（操作列保持为空）。
    },
  }
  return slots.inject('sidebar.settings', () => slots.register(options, SettingsShell))
}

/**
 * 乐观写 scope：宿主 configEditor 写入 = 写盘 + 全量 reconcile（约 1.5s），直接等回折会让
 * UI 明显卡顿。这里先本地覆盖 pending 字段即时生效，宿主确认（form 快照该字段等于 pending）
 * 后摘下。所有 scope 消费方均为 force-update 风格，快照身份不敏感。
 */
interface ScopeFormLike {
  getSnapshot(): { value?: MegaSettingsConfig | undefined }
  subscribe(fn: () => void): () => void
  set(field: string, value: unknown): Promise<boolean>
  unset(field: string): Promise<boolean>
  mutate(ops: readonly SettingsPathOpView[], expectedRevision?: number): Promise<boolean>
}

/** 乐观写穿缓存：宿主写盘有 ~1.5s reconcile 延迟，快速刷新会打断写入而丢失。
 *  把「尚未被宿主确认」的乐观意图写进 localStorage，刷新后先从缓存恢复（秒显），
 *  并自动重提交宿主（最终落盘），宿主确认后摘下。 */
const OPTIMISTIC_CACHE_KEY = 'dsh-mega-settings.optimistic.v1'

function readOptimisticCache(): Record<string, unknown> {
  try {
    const raw = localStorage.getItem(OPTIMISTIC_CACHE_KEY)
    if (!raw) return {}
    const parsed = JSON.parse(raw)
    return parsed !== null && typeof parsed === 'object' && !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)
      : {}
  } catch {
    return {}
  }
}

function writeOptimisticCache(pending: Record<string, unknown>): void {
  try {
    if (Object.keys(pending).length === 0) localStorage.removeItem(OPTIMISTIC_CACHE_KEY)
    else localStorage.setItem(OPTIMISTIC_CACHE_KEY, JSON.stringify(pending))
  } catch {
    /* localStorage 不可用时忽略（写穿仅增强，不影响功能） */
  }
}

function optimisticScope(form: ScopeFormLike): SettingsCenterInjected['scope'] {
  let pending: Record<string, unknown> = readOptimisticCache()
  const listeners = new Set<() => void>()
  /** 每个顶层字段的「未落定写入」代次计数：>0 表示该字段还有防抖等待或请求在途的宿主写入。
   *  reconcile 不摘这类字段的覆盖——否则快速连点期间宿主逐个确认中间值会把覆盖过早摘下，
   *  造成 UI 在 true/false 之间缓慢翻转。 */
  const dirtyGen = new Map<string, number>()
  /** 每字段防抖定时器：快速连点合并为一次宿主写入（避免宿主逐个处理整串 T→F→T→F）。 */
  const timers = new Map<string, ReturnType<typeof setTimeout>>()
  const writeP = new Map<string, Promise<unknown>>()
  const DEBOUNCE_MS = 400

  const notify = (): void => {
    for (const fn of Array.from(listeners)) {
      try {
        fn()
      } catch {
        /* 单个订阅者异常不影响 */
      }
    }
  }
  const eq = (a: unknown, b: unknown): boolean => (a === b) || JSON.stringify(a) === JSON.stringify(b)
  const persist = (): void => writeOptimisticCache(pending)
  const reconcile = (): void => {
    const base = form.getSnapshot().value
    if (!base) return
    let changed = false
    for (const k of Object.keys(pending)) {
      if ((dirtyGen.get(k) ?? 0) > 0) continue // 该字段写入未落定：保留覆盖
      if (eq((base as unknown as Record<string, unknown>)[k], pending[k])) {
        delete pending[k]
        changed = true
      }
    }
    if (changed) {
      persist()
      notify()
    }
  }

  /** 落盘一个字段的最新意图：防抖合并快速连点；触发时读 pending 里该字段的最新值写宿主。 */
  const scheduleWrite = (field: string): Promise<unknown> => {
    dirtyGen.set(field, (dirtyGen.get(field) ?? 0) + 1)
    const old = timers.get(field)
    if (old !== undefined) clearTimeout(old)
    const p = new Promise<unknown>((resolve) => {
      const timer = setTimeout(() => {
        timers.delete(field)
        const has = field in pending
        const w = has ? form.set(field, pending[field]) : form.unset(field)
        w.then((ok) => {
          const n = dirtyGen.get(field) ?? 0
          if (n <= 1) dirtyGen.delete(field)
          else dirtyGen.set(field, n - 1)
          reconcile()
          resolve(ok)
          return ok
        })
      }, DEBOUNCE_MS)
      timers.set(field, timer)
    })
    writeP.set(field, p)
    return p
  }

  // 初始化重放：上次未确认的写入（可能被快速刷新打断）重新提交宿主，确认后由 reconcile 摘下
  for (const field of Object.keys(pending)) scheduleWrite(field)

  return {
    getSnapshot: () => {
      const base = form.getSnapshot().value
      if (!base) return { value: undefined }
      const keys = Object.keys(pending)
      if (keys.length === 0) return { value: base }
      const merged = { ...base } as unknown as Record<string, unknown>
      for (const k of keys) merged[k] = pending[k]
      return { value: merged as unknown as MegaSettingsConfig }
    },
    subscribe: (fn: () => void): (() => void) => {
      listeners.add(fn)
      const off = form.subscribe(() => {
        reconcile()
        notify()
      })
      return () => {
        listeners.delete(fn)
        off()
      }
    },
    set: (field: string, value: unknown): Promise<unknown> => {
      pending[field] = value
      persist()
      notify()
      return scheduleWrite(field)
    },
    unset: (field: string): Promise<unknown> => {
      delete pending[field]
      persist()
      notify()
      return scheduleWrite(field)
    },
    // 路径级写入：先按路径合并到 pending 顶层字段（即时生效），再按字段防抖合并落盘。
    // 逐个字段 merge，避免整对象读-改-写竞争（连点两个开关互相覆盖）。
    mutate: (ops: readonly SettingsPathOpView[], _expectedRevision?: number): Promise<unknown> => {
      const base = form.getSnapshot().value
      const touched = new Set<string>()
      for (const op of ops) {
        if (op.path.length === 0) continue
        const [field, ...rest] = op.path
        touched.add(field)
        const current = field in pending ? pending[field] : (base as unknown as Record<string, unknown> | undefined)?.[field]
        if (op.op === 'set') pending[field] = rest.length === 0 ? op.value : applyPath(current, rest, op.value)
        else if (op.op === 'unset') pending[field] = removePath(current, rest)
      }
      persist()
      notify()
      const ps: Promise<unknown>[] = []
      for (const f of touched) ps.push(scheduleWrite(f))
      return ps.length > 0 ? Promise.all(ps).then(() => true) : Promise.resolve(true)
    },
  }
}

/** 在 obj 上按 path 设值（浅克隆，创建中间对象）；path 空 = 直接返回 value。 */
function applyPath(obj: unknown, path: string[], value: unknown): unknown {
  if (path.length === 0) return value
  const [head, ...rest] = path
  const source = obj !== null && typeof obj === 'object' && !Array.isArray(obj) ? (obj as Record<string, unknown>) : {}
  const copy: Record<string, unknown> = { ...source }
  copy[head] = applyPath(source[head], rest, value)
  return copy
}

/** 在 obj 上按 path 删除键（浅克隆）；path 空 = 返回 undefined。 */
function removePath(obj: unknown, path: string[]): unknown {
  if (path.length === 0) return undefined
  const [head, ...rest] = path
  const source = obj !== null && typeof obj === 'object' && !Array.isArray(obj) ? (obj as Record<string, unknown>) : {}
  const copy: Record<string, unknown> = { ...source }
  if (rest.length === 0) delete copy[head]
  else copy[head] = removePath(source[head], rest)
  return copy
}

export function apply(ctx: Context): void {
  // 词条（§8：zh/en 全量登记；M4 起改类型化 register + LocaleNamespaceMap 合并）
  ctx.locale.register('mega-settings', 'zh', zh)
  ctx.locale.register('mega-settings', 'en', en)
  const t = ctx.locale.bind('mega-settings')

  // 0.1.7：自身配置经 ConfigForm 读取/写入（ns = profile entry id）；scope 面与旧 settingsScope 兼容。
  // 用乐观包装消除宿主写延迟（写盘 + 全量 reconcile 约 1.5s）：点击先本地生效，宿主确认后摘下。
  const scope = optimisticScope(ctx.configForms.get<MegaSettingsConfig>('ui-mega-settings'))

  // 优化效果常驻同步（不依赖 React 挂载时机）：配置 / settings.section / 已装版本变化即校正。
  // 宿主快照未就绪（client 镜像 idle）时沿用本地镜像而非默认值——否则会把首帧注入的
  // 用户配置又退回默认，造成二次跳变。
  const effectSlots = ctx.slots as unknown as SlotsLike
  const syncEffects = (): void => {
    const value = (scope.getSnapshot() as { value?: MegaSettingsConfig }).value
    syncOptimizeEffects(
      value ?? readOptimizeCache(),
      new Set(Object.keys(readVersionsCache())),
      new Set(
        effectSlots
          .entriesOfSlot('settings.section')
          .map((e) => (e.options?.id ?? e.id ?? '') as string)
          .filter((id) => id.length > 0),
      ),
    )
  }
  const disposeEffects = (): void => {
    offScope()
    offSections()
    offVersions()
  }
  const offScope = scope.subscribe(syncEffects)
  const offSections = effectSlots.subscribe('settings.section', syncEffects)
  const offVersions = subscribeVersions(syncEffects)
  ctx.effect(() => disposeEffects)
  syncEffects()

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