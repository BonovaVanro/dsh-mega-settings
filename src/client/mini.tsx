/**
 * Mini slot renderer（DESIGN-v2 §2）：在宿主自绘 UI 中原样复用官方设置组件。
 *
 * 宿主（fold 壳 / collect 卡页）渲染 settings.section 的第三方 entry 时，该 seat 不在
 * 宿主 entry 的 children 声明内（且已被官方 SettingsRoot 声明），无法走官方
 * renderSlot/outlet —— 自研同构 props 组装（0.1.2 线官方组合序）：
 * kit（root 标准 kit + t + useStore/actions + renderSlot）+ entry inject 面
 * （hooks/keyedHooks 包装 use<Name>）+ ownerProps。
 *
 * dsh 0.1.2 线变化（对比 0.1.1-rc.2）：
 * - 标准 kit 不再来自 hostFace().sessions/workspaces，而是 hostFace().root
 *   （root 标准源绑定 StandardSourceBinding：hooks/keyedHooks/props → use<Name>）；
 * - storeOf(entry, scopeBinding)：root 作用域传 undefined（0.1.1 传 'root' 字符串）；
 * - 注入面新增 keyedHooks 通道（use<Name>(key, selector)）。
 */
import { Component, createElement, useMemo, useSyncExternalStore, type ReactNode } from 'react'
import type { SectionEntry } from './pure.ts'

/* runtime slots 数据面（runtime = ctx.slots 公开方法；类型本地收窄，
 * 对齐 @deepseek-ai/dsh-client-ui-slots 的 HostObservable / StandardSourceBinding）。 */
export interface ObservableSource<T> {
  getSnapshot(): T
  subscribe(fn: () => void): () => void
}
/** root 标准源绑定（StandardSourceBinding 的本地收窄）。 */
export interface MiniStandardBinding {
  hooks?: Record<string, ObservableSource<unknown>>
  keyedHooks?: Record<string, (key: string) => ObservableSource<unknown> | undefined>
  props?: Record<string, unknown>
}
export interface MiniSlots {
  entriesOfSlot(key: string): readonly SectionEntry[]
  subscribe(key: string, fn: () => void): () => void
  getVersion(key: string): number
  hostFace(): {
    /** root 标准源绑定（0.1.2 线取代 sessions/workspaces） */
    root?: ObservableSource<MiniStandardBinding>
    locale?: {
      bind(ns: string): (key: string) => string
      getSnapshot(): { revision: number }
      subscribe(fn: () => void): () => void
    }
    /** store 实例解析（entry 声明 store 时注入 useStore/actions）；root 作用域传 undefined */
    storeOf?(entry: unknown, scopeBinding: unknown): {
      getSnapshot(): unknown
      subscribe(fn: () => void): () => void
      actions?: unknown
    } | undefined
  }
}
interface ChildSpec {
  kind?: string
  scope?: string
  [k: string]: unknown
}
/** 渲染用归一 entry（含运行时注入面/children/component）。 */
export interface RenderableEntry extends SectionEntry {
  component?: (props: Record<string, unknown>) => ReactNode
  locale?: string
  /** 官方语义：注入面可接收 store actions（如语言行用 actions.sync 回填选项） */
  inject?: (actions?: unknown) => Record<string, unknown>
  children?: Record<string, ChildSpec>
  store?: unknown
}

/* uSES + selector（镜像官方 observable hook 语义：raw 相同则跳过 selector） */
const hookCache = new WeakMap<object, unknown>()
export function observableHookOf<T, R>(
  source: ObservableSource<T>,
): (selector: (raw: T) => R, equal?: (a: R, b: R) => boolean) => R {
  let hook = hookCache.get(source as object) as
    | ((selector: (raw: T) => R, equal?: (a: R, b: R) => boolean) => R)
    | undefined
  if (!hook) {
    hook = (selector: (raw: T) => R, equal?: (a: R, b: R) => boolean): R => {
      const [subscribe, getSnapshot] = useMemo(() => {
        let lastRaw: T | undefined
        let lastSelected: R | undefined
        let has = false
        const sameSelected = equal ?? Object.is
        return [
          (onChange: () => void) => source.subscribe(onChange),
          () => {
            const raw = source.getSnapshot()
            if (!has || !Object.is(lastRaw, raw)) {
              const next = selector(raw)
              if (!has || !sameSelected(lastSelected as R, next)) {
                lastRaw = raw
                lastSelected = next
              }
              has = true
            }
            return lastSelected as R
          },
        ] as const
      }, [source, selector, equal])
      return useSyncExternalStore(subscribe, getSnapshot, getSnapshot)
    }
    hookCache.set(source as object, hook as unknown)
  }
  return hook as (selector: (raw: T) => R, equal?: (a: R, b: R) => boolean) => R
}

/* 空源（可选标准 hook 缺席时保持调用点稳定；对齐官方 absentSource） */
const absentSource: ObservableSource<undefined> = {
  getSnapshot: () => undefined,
  subscribe: () => () => {},
}

/* open-key 标准 hook 家族：use<Name>(key, selector?, equal?)（对齐官方 keyedObservableHook） */
const keyedHookCache = new WeakMap<object, unknown>()
const identity = (value: unknown): unknown => value
export function keyedObservableHookOf(
  source: (key: string) => ObservableSource<unknown> | undefined,
): (key: string, selector?: (value: unknown) => unknown, equal?: (a: unknown, b: unknown) => boolean) => unknown {
  let hook = keyedHookCache.get(source as object) as
    | ((key: string, selector?: (value: unknown) => unknown, equal?: (a: unknown, b: unknown) => boolean) => unknown)
    | undefined
  if (!hook) {
    hook = (key, selector, equal) => {
      const useValue = observableHookOf(source(key) ?? absentSource)
      return useValue(selector ?? identity, equal)
    }
    keyedHookCache.set(source as object, hook as unknown)
  }
  return hook
}

/* 标准 hook 属性名：name → use<Name> */
function standardHookName(name: string): string {
  return 'use' + (name[0]?.toUpperCase() ?? '') + name.slice(1)
}

/* root 标准 kit 物化（对齐官方 materializeStandardBinding(root, false)：
 * props 原样展开、hooks → use<Name>、keyedHooks → use<Name>(key,…)）。
 * 物化结果按 binding 对象缓存——binding 稳定引用时 use<Name> 身份稳定。 */
const rootStandardCache = new WeakMap<object, Record<string, unknown>>()
function materializeRootBinding(binding: MiniStandardBinding): Record<string, unknown> {
  let standard = rootStandardCache.get(binding as object)
  if (standard !== undefined) return standard
  standard = { ...(binding.props ?? {}) }
  for (const [name, source] of Object.entries(binding.hooks ?? {})) {
    if (source !== undefined) standard[standardHookName(name)] = observableHookOf(source)
  }
  for (const [name, source] of Object.entries(binding.keyedHooks ?? {})) {
    if (source !== undefined) standard[standardHookName(name)] = keyedObservableHookOf(source)
  }
  rootStandardCache.set(binding as object, standard)
  return standard
}

/* 子槽版本订阅（账本变更 → 重渲染）。
 * 0.1.2 线：settings.section 条目 label 多为 thunk（() => t('…')），locale 切换不 bump 账本——
 * 需同时订阅 locale revision，否则 mini 渲染内容（子页 t / 行文案）不随语言刷新。 */
function useSlotVersion(slots: MiniSlots, key: string): number {
  const [subscribe, getSnapshot] = useMemo(() => {
    const face = slots.hostFace().locale
    return [
      () => {
        const offs: (() => void)[] = [slots.subscribe(key, () => undefined)]
        if (face) offs.push(face.subscribe(() => undefined))
        return () => {
          for (const off of offs) off()
        }
      },
      () => slots.getVersion(key) * 1000 + (face?.getSnapshot().revision ?? 0),
    ] as const
  }, [slots, key])
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot)
}

/* locale seat：revision 变化换绑（对齐官方 localeSeat） */
const localeSeatCache = new WeakMap<object, Map<string, { rev: number; t: (key: string) => string }>>()
function localeSeat(
  face: { bind(ns: string): (key: string) => string; getSnapshot(): { revision: number } },
  ns: string,
): (key: string) => string {
  let perNs = localeSeatCache.get(face as object)
  if (!perNs) {
    perNs = new Map()
    localeSeatCache.set(face as object, perNs)
  }
  const rev = face.getSnapshot().revision
  const hit = perNs.get(ns)
  if (hit && hit.rev === rev) return hit.t
  const t = face.bind(ns)
  perNs.set(ns, { rev, t })
  return t
}

/* 条目错误边界 */
export class MiniEntryBoundary extends Component<
  { slotKey: string; children: ReactNode },
  { failed: boolean }
> {
  state = { failed: false }
  static getDerivedStateFromError(): { failed: boolean } {
    return { failed: true }
  }
  componentDidCatch(error: unknown): void {
    console.error('[mega-settings] managed entry crashed in', this.props.slotKey, error)
  }
  render(): ReactNode {
    if (this.state.failed) {
      return <div className="mgs-mini-failed" data-slot-error={this.props.slotKey} />
    }
    return this.props.children
  }
}
/* 渲染一个归一 entry（0.1.2 官方组合序：root 标准 kit + t + store + renderSlot + inject 面 + ownerProps） */
export interface RenderEntryOptions {
  ownerProps?: Record<string, unknown>
  renderChild?: (key: string, owner?: unknown, opts?: { entryKey?: string; only?: string }) => ReactNode
}
export function renderMiniEntry(
  slots: MiniSlots,
  slotKey: string,
  entry: RenderableEntry,
  options: RenderEntryOptions = {},
): ReactNode {
  const Comp = entry.component
  if (typeof Comp !== 'function') return null
  const host = slots.hostFace()
  const kit: Record<string, unknown> = {}
  // root 标准 kit（0.1.2 线：hostFace().root，取代 0.1.1 的 sessions/workspaces）
  if (host.root) {
    const binding = host.root.getSnapshot()
    if (binding) Object.assign(kit, materializeRootBinding(binding))
  }
  if (entry.locale && host.locale) kit.t = localeSeat(host.locale, entry.locale)
  // 官方语义：entry.store → resolveStore 实例；actions 需**传入注入函数**。
  // 注入面（如语言行的 inject(actions)）靠 actions.sync 回填 store（locales/options），
  // 不传则 store 恒空 → 下拉无选项。actions 同时以 kit.actions 交给组件。
  // 0.1.2 线：storeOf 第二参为 scopeBinding，root 作用域传 undefined（0.1.1 传 'root'）。
  let actionsOfStore: unknown
  if (entry.store !== undefined && host.storeOf) {
    const store = host.storeOf(entry, undefined)
    if (store) {
      actionsOfStore = store.actions
      kit.useStore = observableHookOf(store)
      kit.actions = store.actions
    }
  }
  if (entry.children && Object.keys(entry.children).length > 0) {
    kit.renderSlot = options.renderChild
      ? options.renderChild
      : (key: string, owner?: unknown, opts?: { entryKey?: string; only?: string }) =>
          createElement(MiniSlotRenderer, { slots, parent: entry, slotKey: key, owner, opts })
  }
  const injected: Record<string, unknown> = {}
  if (typeof entry.inject === 'function') {
    const raw = entry.inject(actionsOfStore) ?? {}
    const { hooks, keyedHooks, ...rest } = raw as {
      hooks?: Record<string, ObservableSource<unknown>>
      keyedHooks?: Record<string, (key: string) => ObservableSource<unknown> | undefined>
      [k: string]: unknown
    }
    Object.assign(injected, rest)
    for (const [name, source] of Object.entries(hooks ?? {})) {
      if (source !== undefined) injected[standardHookName(name)] = observableHookOf(source)
    }
    for (const [name, source] of Object.entries(keyedHooks ?? {})) {
      if (source !== undefined) injected[standardHookName(name)] = keyedObservableHookOf(source)
    }
  }
  const props = { ...kit, ...injected, ...options.ownerProps } as Record<string, unknown>
  const CompTyped = Comp as (p: Record<string, unknown>) => ReactNode
  return (
    <MiniEntryBoundary slotKey={slotKey}>
      {createElement(CompTyped, props)}
    </MiniEntryBoundary>
  )
}

/* 子槽投影组件（list/keyed；scope root 设置页无 session 面）。
 * 组件式实现：官方页面在 render 期间调用 renderSlot 时，内部 Hook 归属稳定，
 * 不会违反 Rules of Hooks（否则插件页等嵌套子槽页面渲染为空/出错）。 */
function MiniSlotRenderer(props: {
  slots: MiniSlots
  parent: RenderableEntry
  slotKey: string
  owner?: unknown
  opts?: { entryKey?: string; only?: string }
}): ReactNode {
  const { slots, parent, slotKey, owner, opts } = props
  if (!parent.children || !parent.children[slotKey]) {
    throw new Error('SlotOwnershipError: ' + slotKey + " is not declared by this entry's children")
  }
  const version = useSlotVersion(slots, slotKey)
  void version
  const winners = slots
    .entriesOfSlot(slotKey)
    .filter((e) => {
      if (opts && opts.only !== undefined && (e.options?.id ?? e.id) !== opts.only) return false
      if (opts && opts.entryKey !== undefined && e.options?.key !== opts.entryKey) return false
      return true
    })
    .sort((a, b) => (a.options?.order ?? 0) - (b.options?.order ?? 0))
  if (winners.length === 0) return null
  return (
    <>
      {winners.map((e) =>
        renderMiniEntry(slots, slotKey, e as RenderableEntry, {
          ownerProps: (owner ?? {}) as Record<string, unknown>,
          renderChild: (k, o, op) =>
            createElement(MiniSlotRenderer, { slots, parent: e as RenderableEntry, slotKey: k, owner: o, opts: op }),
        }),
      )}
    </>
  )
}

/* settings.section 指定 id 的内容渲染（宿主子页用；版本订阅驱动刷新） */
export function MiniSectionContent(props: {
  slots: MiniSlots
  sectionId: string
  ownerProps?: Record<string, unknown>
}): ReactNode {
  const { slots, sectionId, ownerProps } = props
  const version = useSlotVersion(slots, 'settings.section')
  void version
  const winner = slots
    .entriesOfSlot('settings.section')
    .find((e) => (e.options?.id ?? e.id) === sectionId) as RenderableEntry | undefined
  if (!winner) return null
  return renderMiniEntry(slots, 'settings.section', winner, { ownerProps })
}
