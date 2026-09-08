/**
 * v2 设置管控中心（DESIGN-v2）：collect 模式（收纳卡片页）+ 分组管理 + 管控子页。
 * fold 模式的壳导航由 SettingsShell 实现；mode 切换即时生效。
 *
 * 拖拽体系（0.7.3 重建）：指针拖拽原元素跟手（无浏览器虚影/克隆）+ 虚拟落点框 +
 * FLIP 平滑让位 + 判定锁 + 边缘自动滚动；卡片在组/未分组网格间移动，分组面板可拖排序。
 * 数据契约：groups 顺序、navOrder（释放接管）、ungroupedOrder 为权威持久化字段。
 */
import { Component, useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import type { ControlMode, MegaSettingsConfig, SettingsGroup } from '../schema.ts'
import {
  collectManaged,
  expandUngroupedOrder,
  memberId,
  memberLabel,
  memberVersion,
  orderedUngrouped,
  placeVisible,
  randomId,
  removeGroup,
  reorderGroups,
  ungroupedIds,
  validateGroupName,
  sortMembers,
  type ManagedItem,
  type MemberEntry,
  type SectionEntry,
} from './pure.ts'
import { NAV_HUB_ID } from './pure.ts'
import { MEMBER_PAGE_SEAT } from './seats.ts'
import { MiniSectionContent, type MiniSlots } from './mini.tsx'

/** 构建期注入的包版本（scripts/build-client.mjs）。 */
declare const MGS_VERSION: string

/** 注入面：自身配置 scope + slots 业务面（含 mini 渲染数据面）。 */
export interface SettingsCenterInjected {
  scope: {
    getSnapshot(): { value?: MegaSettingsConfig }
    subscribe(listener: () => void): () => void
    set(field: string, value: unknown): Promise<void>
    unset(field: string): Promise<void>
  }
  slots: {
    members(): readonly MemberEntry[]
    subscribeMembers(fn: () => void): () => void
    onSlotsChanged(fn: (key: string) => void): () => void
    onConnectionReset(fn: () => void): () => void
    /** settings.section 槽 winners（原生+第三方） */
    sections(): readonly SectionEntry[]
    /** mini 渲染数据面 */
    mini: MiniSlots
  }
}

interface SettingsCenterProps {
  scope: SettingsCenterInjected['scope']
  slots: SettingsCenterInjected['slots']
  renderSlot?: (key: string, owner?: unknown, opts?: { entryKey?: string; fallback?: ReactNode }) => ReactNode
  t?: (key: string, params?: Record<string, string>) => string
}

/** 子页打开对象：mega 成员 或 管控项（第三方设置分区）。 */
type OpenTarget = { kind: 'member'; id: string } | { kind: 'section'; id: string } | null

function Badge(props: { name: string; tag: string; testId?: string }) {
  return (
    <span className="mgs-badge" data-testid={props.testId}>
      <span className="mgs-badge-name">{props.name}</span>
      <span className="mgs-badge-tag">{props.tag}</span>
    </span>
  )
}
function HostBadge(props: { label: string }) {
  return <Badge name={props.label} tag={MGS_VERSION} testId="mgs-version" />
}
function MemberBadge(props: { entry: MemberEntry; t: (key: string) => string }) {
  return <Badge name={memberLabel(props.entry)} tag={memberVersion(props.entry) ?? props.t('settings.unknown')} />
}

function Segmented<T extends string>(props: {
  value: T
  options: { value: T; label: string }[]
  onChange: (next: T) => void
}) {
  return (
    <div className="mgs-seg" role="radiogroup">
      {props.options.map((o) => (
        <button
          key={o.value}
          type="button"
          role="radio"
          aria-checked={props.value === o.value}
          className={props.value === o.value ? 'mgs-seg-item mgs-seg-active' : 'mgs-seg-item'}
          onClick={() => props.onChange(o.value)}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}

function FieldRow(props: { label: string; children: ReactNode }) {
  return (
    <div className="mgs-row">
      <span className="mgs-row-label">{props.label}</span>
      {props.children}
    </div>
  )
}

/* ---------- hooks ---------- */
function useScopeValue(scope: SettingsCenterInjected['scope']): MegaSettingsConfig | undefined {
  const [, force] = useState(0)
  useEffect(() => scope.subscribe(() => force((n) => n + 1)), [scope])
  return scope.getSnapshot().value
}
function useMembers(slots: SettingsCenterInjected['slots']): readonly MemberEntry[] {
  const [, force] = useState(0)
  useEffect(() => {
    const a = slots.subscribeMembers(() => force((n) => n + 1))
    const b = slots.onSlotsChanged((key) => {
      if (key === 'mega.settings.member') force((n) => n + 1)
    })
    return () => {
      a()
      b()
    }
  }, [slots])
  return slots.members()
}
function useSections(slots: SettingsCenterInjected['slots']): readonly SectionEntry[] {
  const [, force] = useState(0)
  useEffect(() => {
    const a = slots.mini.subscribe('settings.section', () => force((n) => n + 1))
    const b = slots.onSlotsChanged((key) => {
      if (key === 'settings.section') force((n) => n + 1)
    })
    // 语言切换：官方分区/第三方 label 为活函数但条目不重注册，需订阅 locale 触发重解析
    const c = slots.mini.hostFace().locale?.subscribe(() => force((n) => n + 1))
    return () => {
      a()
      b()
      c?.()
    }
  }, [slots])
  return slots.sections()
}
function useOpenTarget(
  value: MegaSettingsConfig | undefined,
  scope: SettingsCenterInjected['scope'],
): [OpenTarget, (t: OpenTarget) => void] {
  const [open, setOpen] = useState<OpenTarget>(() => {
    const lm = value?.lastMember
    return lm ? { kind: 'member', id: lm } : null
  })
  const openTarget = (t: OpenTarget): void => {
    setOpen(t)
    if (t === null) {
      void scope.set('lastMember', '')
    } else if (t.kind === 'member') {
      void scope.set('lastMember', t.id)
    }
  }
  return [open, openTarget]
}
/** 已安装包版本映射（host /api/dsh-mega-settings/versions；fetch 失败静默 → 版本徽章显示未知）。 */
function useVersions(): Record<string, string> {
  const [map, setMap] = useState<Record<string, string>>({})
  useEffect(() => {
    let alive = true
    fetch('/api/dsh-mega-settings/versions')
      .then((r) => (r.ok ? r.json() : null))
      .then((d: { versions?: Record<string, string> } | null) => {
        if (alive && d && d.versions) setMap(d.versions)
      })
      .catch(() => {})
    return () => {
      alive = false
    }
  }, [])
  return map
}

/* ================= 静态卡片 ================= */
function IconEdit() { return (<svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M11.3 2.3l2.4 2.4L5.5 12.9l-3.2.8.8-3.2 8.2-8.2z"/></svg>) }
function IconTrash() { return (<svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M2.5 4h11M6.5 4V2.5h3V4M4 4l.6 9.5h6.8L12 4M6.6 6.8v4M9.4 6.8v4"/></svg>) }
function IconAdd() { return (<svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" aria-hidden="true"><path d="M8 3v10M3 8h10"/></svg>) }

function arrEq(a: readonly string[], b: readonly string[]): boolean {
  return a.length === b.length && a.every((x, i) => x === b[i])
}

/** position:fixed 的包含块原点：若存在 transform/perspective/filter 等祖先，fixed 相对它定位；
 *  clientX/Y 是视口坐标 → 换算 left/top 需扣除该原点，否则固定错位。 */
function fixedOriginOf(el: HTMLElement | null): { x: number; y: number } {
  if (el === null) return { x: 0, y: 0 }
  let node: HTMLElement | null = el.parentElement
  while (node !== null && node !== document.body && node !== document.documentElement) {
    const cs = getComputedStyle(node)
    if (
      cs.transform !== 'none' ||
      cs.perspective !== 'none' ||
      cs.filter !== 'none' ||
      cs.willChange.includes('transform') ||
      cs.willChange.includes('perspective') ||
      cs.willChange.includes('filter')
    ) {
      const r = node.getBoundingClientRect()
      return { x: r.left, y: r.top }
    }
    node = node.parentElement
  }
  return { x: 0, y: 0 }
}

/** 开关（接管语义；样式复用 mgs-switch 体系；sm = 卡片操作区小开关）。 */
function Switch(props: { checked: boolean; onChange: (v: boolean) => void; title?: string; sm?: boolean }) {
  return (
    <label className={props.sm ? 'mgs-switch mgs-switch--sm' : 'mgs-switch'} title={props.title}>
      <input type="checkbox" checked={props.checked} onChange={(e) => props.onChange(e.target.checked)} />
      <span className="mgs-switch-track">
        <span className="mgs-switch-thumb" />
      </span>
    </label>
  )
}

/** 卡片（点击打开子页；操作区接管开关；draggable = 可拖）。
 *  拖拽：指针按下、移动过 5px 阈值后进入拖拽——原卡片元素 position:fixed 脱离文档流跟随光标
 *  （原格不占位，网格自动塌陷回填），无浏览器拖影、不新建克隆元素；
 *  移动期间经 onDragHover 上报坐标（上层用 elementFromPoint 计算虚拟落点框）；
 *  拖拽后的 click 被吞掉（避免误开页/误开关）。 */
function CardShell(props: {
  it: ManagedItem
  t: (key: string) => string
  onOpen: (id: string) => void
  excluded: (id: string) => boolean
  onToggleTake: (id: string) => void
  versionOf?: (entry: SectionEntry) => string | undefined
  testId?: string
  ops?: boolean
  draggable?: boolean
  /** 所在网格内序号（作为落点判定目标时需要） */
  dataMgsI?: number
  onDragStart?: (id: string) => void
  onDragHover?: (x: number, y: number) => void
  onDragEnd?: () => void
}) {
  const { t: tr } = props
  const label = memberLabel(props.it.entry as MemberEntry) || props.it.id
  const dragRef = useRef<{
    armed: boolean
    moved: boolean
    sx: number
    sy: number
    grabX: number
    grabY: number
    width: number
    moveFn: ((e: PointerEvent) => void) | null
    upFn: (() => void) | null
  }>({ armed: false, moved: false, sx: 0, sy: 0, grabX: 0, grabY: 0, width: 0, moveFn: null, upFn: null })
  const nodeRef = useRef<HTMLDivElement | null>(null)
  /** fly 非空 = 拖拽中：fixed 定位跟随光标；pointer-events none 让下方元素可被命中判定 */
  const [fly, setFly] = useState<{ left: number; top: number } | null>(null)

  const detach = (): void => {
    const d = dragRef.current
    if (d.moveFn) window.removeEventListener('pointermove', d.moveFn)
    if (d.upFn) {
      window.removeEventListener('pointerup', d.upFn)
      window.removeEventListener('pointercancel', d.upFn)
    }
    d.moveFn = null
    d.upFn = null
  }
  const attach = (): void => {
    const d = dragRef.current
    detach()
    const move = (e: PointerEvent): void => {
      e.preventDefault()
      const o = fixedOriginOf(nodeRef.current)
      setFly({ left: e.clientX - o.x - d.grabX, top: e.clientY - o.y - d.grabY })
      props.onDragHover?.(e.clientX, e.clientY)
    }
    const up = (): void => {
      detach()
      d.armed = false
      setFly(null)
      props.onDragEnd?.()
      window.setTimeout(() => {
        dragRef.current.moved = false
      }, 0)
    }
    d.moveFn = move
    d.upFn = up
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', up)
    window.addEventListener('pointercancel', up)
  }
  return (
    <div
      ref={nodeRef}
      className="mgs-card"
      data-testid={props.testId ?? 'mgs-card-' + props.it.id}
      data-mgs-i={props.dataMgsI !== undefined ? props.dataMgsI : undefined}
      style={
        fly
          ? {
              position: 'fixed',
              left: fly.left + 'px',
              top: fly.top + 'px',
              width: dragRef.current.width + 'px',
              zIndex: 30,
              boxSizing: 'border-box',
              margin: 0,
              pointerEvents: 'none',
            }
          : undefined
      }
      onPointerDown={(e) => {
        if (!props.draggable || e.button !== 0) return
        const d = dragRef.current
        const rect = e.currentTarget.getBoundingClientRect()
        d.armed = true
        d.moved = false
        d.sx = e.clientX
        d.sy = e.clientY
        d.grabX = e.clientX - rect.left
        d.grabY = e.clientY - rect.top
        d.width = rect.width
        // 单击（未过阈值即松开）也要取消武装，避免之后纯悬停误触发拖拽
        const cancel = (): void => {
          window.removeEventListener('pointerup', cancel)
          window.removeEventListener('pointercancel', cancel)
          dragRef.current.armed = false
        }
        window.addEventListener('pointerup', cancel)
        window.addEventListener('pointercancel', cancel)
      }}
      onPointerMove={(e) => {
        const d = dragRef.current
        if (!d.armed || d.moveFn) return
        if (e.buttons === 0) {
          // 未按住按键（纯悬停移动）：不进入拖拽
          d.armed = false
          return
        }
        const dx = e.clientX - d.sx
        const dy = e.clientY - d.sy
        if (Math.abs(dx) < 5 && Math.abs(dy) < 5) return
        d.moved = true
        props.onDragStart?.(props.it.id)
        attach()
        const o0 = fixedOriginOf(nodeRef.current)
        setFly({ left: e.clientX - o0.x - d.grabX, top: e.clientY - o0.y - d.grabY })
        props.onDragHover?.(e.clientX, e.clientY)
      }}
      onClickCapture={(e) => {
        if (dragRef.current.moved) {
          dragRef.current.moved = false
          e.preventDefault()
          e.stopPropagation()
        }
      }}
    >
      <div
        className="mgs-card-main"
        role="button"
        tabIndex={0}
        onClick={() => props.onOpen(props.it.id)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault()
            props.onOpen(props.it.id)
          }
        }}
      >
        <span className="mgs-card-name">{label}</span>
        <span className="mgs-card-tag">{props.versionOf?.(props.it.entry) ?? tr('settings.unknown')}</span>
      </div>
      <div className="mgs-card-ops">
        {props.ops ? (
          <Switch
            sm
            checked={!props.excluded(props.it.id)}
            title={tr('card.takeover')}
            onChange={() => props.onToggleTake(props.it.id)}
          />
        ) : null}
      </div>
    </div>
  )
}

/** 分组区块：头部（改名/删除）+ 卡片网格。
 *  gridKey = 网格身份（落点判定目标）；frameP = 该网格内虚拟卡片框的插入位（无则 null）。 */
function GroupSection(props: {
  title: string
  items: ManagedItem[]
  t: (key: string) => string
  editing?: boolean
  onStartEdit?: () => void
  onCommitEdit?: (name: string) => void
  onDelete?: () => void
  onOpen: (id: string) => void
  excluded: (id: string) => boolean
  onToggleTake: (id: string) => void
  emptyHint?: string
  versionOf?: (entry: SectionEntry) => string | undefined
  draggable?: boolean
  gridKey?: string
  frameP?: number | null
  /** 空组在拖拽中常显接收槽（true）；recOn = 该槽命中高亮 */
  emptyRec?: boolean
  recOn?: boolean
  onDragStart?: (id: string) => void
  onDragHover?: (x: number, y: number) => void
  onDragEnd?: () => void
}) {
  const { t: tr } = props
  const [draft, setDraft] = useState(props.title)
  useEffect(() => setDraft(props.title), [props.title])
  const head = (): ReactNode => {
    if (props.editing) {
      return (
        <input
          className="mgs-input mgs-group-edit"
          autoFocus
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') props.onCommitEdit?.(draft)
            if (e.key === 'Escape') props.onCommitEdit?.(props.title)
          }}
        />
      )
    }
    return (
      <>
        <span className="mgs-panel__title">{props.title}</span>
        {props.onStartEdit && props.onDelete ? (
          <span className="mgs-panel__ops mgs-panel__ops-hover">
            <button type="button" className="mgs-icon-btn" title={tr('group.rename')} onClick={props.onStartEdit}>
              <IconEdit />
            </button>
            <button type="button" className="mgs-icon-btn" title={tr('group.remove')} onClick={props.onDelete}>
              <IconTrash />
            </button>
          </span>
        ) : null}
      </>
    )
  }
  const cells: ReactNode[] = []
  if (props.items.length === 0) {
    if (props.emptyRec) {
      cells.push(
        <div
          key="rec-empty"
          className={
            props.recOn ? 'mgs-frame mgs-frame-wide mgs-rec-on' : 'mgs-frame mgs-frame-wide mgs-rec-idle'
          }
          data-mgs-rec="1"
        />,
      )
    } else if (props.emptyHint) {
      cells.push(<p key="empty" className="mgs-empty">{props.emptyHint}</p>)
    }
  } else {
    props.items.forEach((it, idx) => {
      if (props.frameP !== null && props.frameP !== undefined && props.frameP === idx) {
        cells.push(<div key={'frame-' + idx} className="mgs-frame" data-mgs-frame="1" />)
      }
      cells.push(
        <CardShell
          key={it.id}
          it={it}
          t={tr}
          onOpen={props.onOpen}
          excluded={props.excluded}
          onToggleTake={props.onToggleTake}
          versionOf={props.versionOf}
          ops
          draggable={props.draggable}
          dataMgsI={props.draggable ? idx : undefined}
          onDragStart={props.onDragStart}
          onDragHover={props.onDragHover}
          onDragEnd={props.onDragEnd}
        />,
      )
    })
    if (props.frameP !== null && props.frameP !== undefined && props.frameP >= props.items.length) {
      cells.push(<div key="frame-tail" className="mgs-frame" data-mgs-frame="1" />)
    }
  }
  return (
    <div className="mgs-panel mgs-group">
      <div className="mgs-panel__head">{head()}</div>
      <div className="mgs-grid" data-mgs-grid={props.gridKey}>
        {cells}
      </div>
    </div>
  )
}

/** 分组面板拖拽容器：指针拖起后「原面板元素」fixed 跟随（原位置塌陷），
 *  拖拽源仅限非交互区（卡片/按钮/输入等自身交互不触发）。 */
function GroupDragPane(props: {
  gi: number
  gid: string
  onStart: (id: string) => void
  onHover: (x: number, y: number) => void
  onEnd: () => void
  children: ReactNode
}) {
  const dragRef = useRef<{
    armed: boolean
    moved: boolean
    sx: number
    sy: number
    grabX: number
    grabY: number
    width: number
    moveFn: ((e: PointerEvent) => void) | null
    upFn: (() => void) | null
  }>({ armed: false, moved: false, sx: 0, sy: 0, grabX: 0, grabY: 0, width: 0, moveFn: null, upFn: null })
  const nodeRef = useRef<HTMLDivElement | null>(null)
  const [fly, setFly] = useState<{ left: number; top: number } | null>(null)
  const detach = (): void => {
    const d = dragRef.current
    if (d.moveFn) window.removeEventListener('pointermove', d.moveFn)
    if (d.upFn) {
      window.removeEventListener('pointerup', d.upFn)
      window.removeEventListener('pointercancel', d.upFn)
    }
    d.moveFn = null
    d.upFn = null
  }
  const attach = (): void => {
    const d = dragRef.current
    detach()
    const move = (e: PointerEvent): void => {
      e.preventDefault()
      const o = fixedOriginOf(nodeRef.current)
      const w = typeof window !== 'undefined' ? window.innerWidth : 1200
      const left = Math.max(8, Math.min(e.clientX - d.grabX, w - d.width - 8)) - o.x
      const top = Math.max(8, e.clientY - d.grabY) - o.y
      setFly({ left, top })
      props.onHover(e.clientX, e.clientY)
    }
    const up = (): void => {
      detach()
      d.armed = false
      setFly(null)
      props.onEnd()
      window.setTimeout(() => {
        dragRef.current.moved = false
      }, 0)
    }
    d.moveFn = move
    d.upFn = up
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', up)
    window.addEventListener('pointercancel', up)
  }
  return (
    <div
      ref={nodeRef}
      data-mgs-group
      data-mgs-group-id={props.gid}
      data-mgs-i={props.gi}
      className="mgs-group-drag"
      style={
        fly
          ? {
              position: 'fixed',
              left: fly.left + 'px',
              top: fly.top + 'px',
              width: dragRef.current.width + 'px',
              zIndex: 40,
              pointerEvents: 'none',
            }
          : undefined
      }
      onPointerDown={(e) => {
        if (e.button !== 0) return
        const tgt = e.target as HTMLElement | null
        if (tgt && typeof tgt.closest === 'function' && tgt.closest('.mgs-card, button, input, label, textarea, select, a')) return
        const d = dragRef.current
        const rect = e.currentTarget.getBoundingClientRect()
        d.armed = true
        d.moved = false
        d.sx = e.clientX
        d.sy = e.clientY
        d.grabX = e.clientX - rect.left
        d.grabY = e.clientY - rect.top
        d.width = rect.width
        const cancel = (): void => {
          window.removeEventListener('pointerup', cancel)
          window.removeEventListener('pointercancel', cancel)
          dragRef.current.armed = false
        }
        window.addEventListener('pointerup', cancel)
        window.addEventListener('pointercancel', cancel)
      }}
      onPointerMove={(e) => {
        const d = dragRef.current
        if (!d.armed || d.moveFn) return
        if (e.buttons === 0) {
          d.armed = false
          return
        }
        const dx = e.clientX - d.sx
        const dy = e.clientY - d.sy
        if (Math.abs(dx) < 5 && Math.abs(dy) < 5) return
        d.moved = true
        props.onStart(props.gid)
        attach()
        const o0 = fixedOriginOf(nodeRef.current)
        const w = typeof window !== 'undefined' ? window.innerWidth : 1200
        setFly({
          left: Math.max(8, Math.min(e.clientX - d.grabX, w - d.width - 8)) - o0.x,
          top: Math.max(8, e.clientY - d.grabY) - o0.y,
        })
        props.onHover(e.clientX, e.clientY)
      }}
    >
      {props.children}
    </div>
  )
}

/** 成员页错误边界（成员渲染走官方 renderSlot keyed） */
class MemberBoundary extends Component<{ children: ReactNode; failedText: string }, { failed: boolean }> {
  state = { failed: false }
  static getDerivedStateFromError() {
    return { failed: true }
  }
  render() {
    if (this.state.failed) return <p className="mgs-member-failed">{this.props.failedText}</p>
    return this.props.children
  }
}

export function SettingsCenter(props: SettingsCenterProps) {
  const { scope, slots, renderSlot, t } = props
  const tr = t ?? ((key: string) => key)
  const value = useScopeValue(scope)
  const members = useMembers(slots)
  const sections = useSections(slots)
  const [open, openTarget] = useOpenTarget(value, scope)
  const config: MegaSettingsConfig = value ?? ({} as MegaSettingsConfig)
  const groups: SettingsGroup[] = config.groups ?? []
  /** released 状态：navOrder 自定义段（含入口保留 id 恒在末）；旧配置无 navOrder 时回退 managedExcluded */
  const hasNavOrder = Object.prototype.hasOwnProperty.call(config, 'navOrder')
  const releasedList = (hasNavOrder ? config.navOrder ?? [] : config.managedExcluded ?? []).filter(
    (x) => x !== NAV_HUB_ID,
  )
  const excludedIds = new Set(releasedList)
  const ungroupedOrder = config.ungroupedOrder ?? []

  const memberSorted = sortMembers(members)
  const memberIds = memberSorted.map((m) => memberId(m))
  const managed = collectManaged(sections, memberIds)
  const managedById = new Map(managed.map((m) => [m.id, m]))
  // 收纳页展示全部管理项（含已释放；释放仅影响导航归属）
  const managedIds = managed.map((m) => m.id)
  const ungroupedRaw = ungroupedIds(managedIds, groups)
  const ungroupedList = orderedUngrouped(ungroupedRaw, ungroupedOrder)
  const [editTarget, setEditTarget] = useState<{ id: string | null; name: string } | null>(null)

  const versions = useVersions()
  const versionIndex = ((): Record<string, string> => {
    const idx: Record<string, string> = {}
    for (const [name, ver] of Object.entries(versions)) {
      const base = name.slice(name.lastIndexOf('/') + 1)
      const short = base.startsWith('dsh-') ? base.slice(4) : base
      idx[base] = ver
      if (short !== base) idx[short] = ver
    }
    return idx
  })()
  const normId = (id: string): string => (id.startsWith('dsh-') ? id.slice(4) : id)
  const matchIn = (name: string): string | undefined => {
    if (versions[name]) return versions[name]
    const short = normId(name)
    if (versionIndex[short]) return versionIndex[short]
    for (const [key, ver] of Object.entries(versionIndex)) {
      if (key.endsWith(short) && key !== short) return ver
    }
    return undefined
  }
  const versionOf = (entry: SectionEntry): string | undefined => {
    const reg = (entry as SectionEntry & { registrant?: string }).registrant
    if (reg) {
      const v = matchIn(reg)
      if (v) return v
    }
    const id = ((entry.options?.id ?? entry.id) as string) || ''
    if (!id) return undefined
    return matchIn(id)
  }

  const writeGroups = (next: SettingsGroup[]): void => {
    void scope.set('groups', next)
  }
  const commitName = (targetId: string | null, raw: string): void => {
    const name = raw.trim()
    if (!name || validateGroupName(name, groups.filter((g) => g.id !== targetId))) {
      setEditTarget(null)
      return
    }
    const next =
      targetId === null ? [...groups, { id: randomId(), name, itemIds: [] }] : groups.map((g) => (g.id === targetId ? { ...g, name } : g))
    writeGroups(next)
    setEditTarget(null)
  }
  const handleAddGroup = (): void => {
    const id = randomId()
    writeGroups([...groups, { id, name: tr('group.unnamed'), itemIds: [] }])
    setEditTarget({ id, name: tr('group.unnamed') })
  }
  const handleRemoveGroup = (gid: string): void => writeGroups(removeGroup(groups, gid))
  /** 释放/接管开关：接管数组（groups/未分组）永不移除；释放 = 插入 navOrder（hub 之前），接管 = 从 navOrder 移除 */
  const toggleTake = (id: string): void => {
    const base = releasedList.filter((x) => x !== id)
    const custom = excludedIds.has(id) ? base : [...base, id]
    void scope.set('navOrder', [...custom, NAV_HUB_ID])
  }
  const itemsOf = (ids: string[]): ManagedItem[] =>
    ids.map((id) => managedById.get(id)).filter((x): x is ManagedItem => x !== undefined)

  /* ---------- 卡片拖拽：拖起状态 + 虚拟落点框 + 落地提交 ---------- */
  const U_KEY = '$u'
  const dragIdRef = useRef<string | null>(null)
  /** 让位动画锁：卡片刚移动后 0.5s 内暂停落点判定（避免动画期间抖动误判） */
  const flipLockRef = useRef<number>(0)
  const dropPRef = useRef<{ key: string; v: number } | null>(null)
  const [dragId, setDragId] = useState<string | null>(null)
  /** dropP：当前落点（key = 网格；v = 目标可见序位，0..网格可见项数；null = 无有效落点） */
  const [dropP, setDropP] = useState<{ key: string; v: number } | null>(null)
  /** 空未分组在拖拽结束后的短暂保留（0.5s 延迟隐藏；落入未分组则取消） */
  const ungTimerRef = useRef<number>(0)
  const [ungKeep, setUngKeep] = useState(false)
  const cancelUngKeep = (): void => {
    if (ungTimerRef.current !== 0) {
      window.clearTimeout(ungTimerRef.current)
      ungTimerRef.current = 0
    }
    setUngKeep(false)
  }
  const scheduleUngHide = (): void => {
    if (ungTimerRef.current !== 0) window.clearTimeout(ungTimerRef.current)
    ungTimerRef.current = window.setTimeout(() => {
      ungTimerRef.current = 0
      setUngKeep(false)
    }, 500)
    setUngKeep(true)
  }
  const setDrop = (t: { key: string; v: number } | null): void => {
    const prev = dropPRef.current
    if (t === null) {
      if (prev === null) return
      dropPRef.current = null
      setDropP(null)
      return
    }
    if (prev !== null && prev.key === t.key && prev.v === t.v) return
    dropPRef.current = t
    setDropP(t)
  }
  /** 网格可见项 id 序（与 data-mgs-i 对应；同组含被拖卡自身位） */
  const gridIdsOf = (key: string): string[] => {
    if (key === U_KEY) return ungroupedList
    const g = groups.find((x) => x.id === key)
    return g ? itemsOf(g.itemIds).map((x) => x.id) : []
  }
  /** 网格内虚拟卡片框的子元素数组插入位（同网格被拖卡仍占 DOM 位 → 偏置 1） */
  const cardFrameP = (key: string): number | null => {
    if (dropP === null || dropP.key !== key || dragId === null) return null
    const ids = gridIdsOf(key)
    const v = Math.max(0, Math.min(dropP.v, ids.length))
    const i = ids.indexOf(dragId)
    return i >= 0 && i <= v ? v + 1 : v
  }
  /** 落地提交：把拖拽卡放入目标网格的可见序位 v（同网格 = 重排；跨网格 = 移入；保留缺失墓碑） */
  const commitCardDrop = (id: string, key: string, v: number): void => {
    if (key === U_KEY) {
      // —— 目标：未分组 ——
      const srcGid = groups.find((g) => g.itemIds.includes(id))?.id ?? null
      const stored = expandUngroupedOrder(config.ungroupedOrder ?? [], ungroupedIds(managedIds, groups))
      const rendered = ungroupedList
      const rest = stored.filter((x) => x !== id)
      const next = placeVisible(rest, (x) => !rendered.includes(x), id, v)
      if (!arrEq(next, stored)) void scope.set('ungroupedOrder', next)
      if (srcGid !== null) {
        void scope.set(
          'groups',
          groups.map((g) => (g.id === srcGid ? { ...g, itemIds: g.itemIds.filter((x) => x !== id) } : g)),
        )
      }
      return
    }
    // —— 目标：自定义组 ——
    const g = groups.find((x) => x.id === key)
    if (!g) return
    // 1) 先移除原归属（源组/同组），保证唯一归属
    const groupsMinus = groups.map((x) =>
      x.itemIds.includes(id) ? { ...x, itemIds: x.itemIds.filter((y) => y !== id) } : x,
    )
    // 2) 目标组按可见序 v 插入（渲染序含被拖卡旧位的换算同前）
    const rendered = itemsOf(g.itemIds).map((x) => x.id)
    const g2 = groupsMinus.find((x) => x.id === key)
    if (!g2) return
    const next = placeVisible(g2.itemIds, (x) => !rendered.includes(x), id, v)
    const groupsNext = groupsMinus.map((x) => (x.id === key ? { ...x, itemIds: next } : x))
    if (JSON.stringify(groupsNext) === JSON.stringify(groups)) return
    void scope.set('groups', groupsNext)
    // 3) 来自未分组 → 从未分组顺序清理
    const orderStored = config.ungroupedOrder ?? []
    if (orderStored.includes(id)) void scope.set('ungroupedOrder', orderStored.filter((x) => x !== id))
  }
  const handleCardStart = (id: string): void => {
    cancelUngKeep()
    dragIdRef.current = id
    setDragId(id)
    setDrop(null)
  }
  const handleCardHover = (x: number, y: number): void => {
    const id = dragIdRef.current
    if (id === null) return
    if (flipLockRef.current > (typeof performance !== 'undefined' ? performance.now() : 0)) return
    updateAutoScroll(x, y)
    const el = document.elementFromPoint(x, y)
    if (!el || !(el instanceof Element) || typeof (el as HTMLElement).closest !== 'function') {
      setDrop(null)
      return
    }
    const node = el as HTMLElement
    const gridEl = node.closest('[data-mgs-grid]')
    // 空未分组接收槽优先于「虚拟框保持」判定：首次悬停即可设落点
    if (node.closest('[data-mgs-rec]')) {
      const key = gridEl ? gridEl.getAttribute('data-mgs-grid') ?? '' : ''
      if (gridEl !== null && key) setDrop({ key, v: 0 })
      return
    }
    if (node.closest('.mgs-frame')) return // 悬停在虚拟框上：维持当前落点
    const card = node.closest('.mgs-card')
    if (!gridEl) {
      setDrop(null)
      return
    }
    if (!card) {
      const key = gridEl.getAttribute('data-mgs-grid') ?? ''
      const ids2 = gridIdsOf(key)
      // 空分组/空网格：容器任意位置 = 首位落点（接收槽之外也命中）
      if (ids2.length === 0) {
        if (key) setDrop({ key, v: 0 })
        return
      }
      // 网格内空白/卡片间隙 → 就近卡片左右落位（拖进未分组/组空隙也可命中）
      const cards = Array.from(gridEl.querySelectorAll<HTMLElement>('.mgs-card[data-mgs-i]'))
      let best: HTMLElement | null = null
      let bd = Infinity
      for (const c of cards) {
        const rc = c.getBoundingClientRect()
        const dx = x - (rc.left + rc.width / 2)
        const dy = y - (rc.top + rc.height / 2)
        const d = dx * dx + dy * dy
        if (d < bd) {
          bd = d
          best = c
        }
      }
      if (best === null || !key || ids2.length === 0) {
        setDrop(null)
        return
      }
      const m = Number(best.getAttribute('data-mgs-i'))
      const rc = best.getBoundingClientRect()
      const right = x >= rc.left + rc.width / 2
      const i = ids2.indexOf(id)
      const k = i >= 0 && m > i ? m - 1 : m
      const v = Math.max(0, Math.min(right ? k + 1 : k, ids2.length))
      setDrop({ key, v })
      return
    }
    const key = gridEl.getAttribute('data-mgs-grid') ?? ''
    const m = Number(card.getAttribute('data-mgs-i'))
    const ids = gridIdsOf(key)
    if (!key || !Number.isFinite(m) || m < 0 || m >= ids.length) {
      setDrop(null)
      return
    }
    const rect = card.getBoundingClientRect()
    const right = x >= rect.left + rect.width / 2
    const i = ids.indexOf(id)
    // 目标卡可见下标（同网格且目标在被拖卡之后时 -1）；右半区 = 其后
    const k = i >= 0 && m > i ? m - 1 : m
    const v = Math.max(0, Math.min(right ? k + 1 : k, ids.length))
    setDrop({ key, v })
  }
    /* ---------- 拖拽边缘自动滚动（靠近滚动容器顶/底时） ---------- */
  const lastXYRef = useRef<{ x: number; y: number } | null>(null)
  const scrollRef = useRef<{ el: HTMLElement | null; dir: number; raf: number }>({ el: null, dir: 0, raf: 0 })
  const stopAutoScroll = (): void => {
    const s = scrollRef.current
    if (s.raf !== 0) {
      cancelAnimationFrame(s.raf)
      s.raf = 0
    }
    s.el = null
    s.dir = 0
  }
  const tickAutoScroll = (): void => {
    const s = scrollRef.current
    const xy = lastXYRef.current
    if (s.el === null || xy === null) {
      stopAutoScroll()
      return
    }
    const rect = s.el.getBoundingClientRect()
    const edge = 56
    let dir = 0
    let str = 0
    if (xy.y < rect.top + edge) {
      dir = -1
      str = Math.max(0, Math.min(1, (edge - (rect.top + edge - xy.y)) / edge))
    } else if (xy.y > rect.bottom - edge) {
      dir = 1
      str = Math.max(0, Math.min(1, (edge - (xy.y - (rect.bottom - edge))) / edge))
    }
    if (dir === 0 || s.el.scrollHeight <= s.el.clientHeight + 2) {
      stopAutoScroll()
      return
    }
    s.el.scrollTop += dir * Math.round(3 + 10 * str)
    // 内容已滚动 → 重算悬停落点（卡片/分组按当前拖拽类型分发）
    if (groupDragRef.current !== null && typeof groupHover === 'function') groupHover(xy.x, xy.y)
    else handleCardHover(xy.x, xy.y)
    s.raf = requestAnimationFrame(tickAutoScroll)
  }
  /** 依指针位置定位最近可滚动容器并进入/退出边缘滚动 */
  const updateAutoScroll = (x: number, y: number): void => {
    lastXYRef.current = { x, y }
    const s = scrollRef.current
    const el = document.elementFromPoint(x, y) as HTMLElement | null
    let scroller: HTMLElement | null = null
    let walk: HTMLElement | null = el
    while (walk && walk !== document.body) {
      if (walk.scrollHeight > walk.clientHeight + 2) {
        const ov = getComputedStyle(walk).overflowY
        if (ov === 'auto' || ov === 'scroll') {
          scroller = walk
          break
        }
      }
      walk = walk.parentElement
    }
    s.el = scroller
    if (s.el !== null && s.raf === 0) {
      s.raf = requestAnimationFrame(tickAutoScroll)
    }
  }
  const handleCardEnd = (): void => {
    const id = dragIdRef.current
    const target = dropPRef.current
    const landedU = target !== null && target.key === U_KEY
    stopAutoScroll()
    lastXYRef.current = null
    dragIdRef.current = null
    dropPRef.current = null
    setDragId(null)
    setDropP(null)
    if (id !== null && target !== null) commitCardDrop(id, target.key, target.v)
    if (landedU) {
      cancelUngKeep() // 已加入未分组：不隐藏
    } else {
      scheduleUngHide() // 空未分组延迟 0.5s 再消失
    }
  }
  /** 管控卡拖拽总线（mega 成员卡不参与） */
  const cardBus = {
    draggable: true,
    onDragStart: handleCardStart,
    onDragHover: handleCardHover,
    onDragEnd: handleCardEnd,
  }

  /* ---------- 分组拖拽排序：组间插入条（o=0..groups.length） ---------- */
  const groupDragRef = useRef<string | null>(null)
  const gOverRef = useRef<number | null>(null)
  const [gDragOn, setGDragOn] = useState(false)
  const [gOver, setGOver] = useState<number | null>(null)
  const setGOverN = (o: number | null): void => {
    if (o !== null && o !== undefined) o = Math.max(0, Math.min(o, groups.length))
    if (gOverRef.current === o) return
    gOverRef.current = o
    setGOver(o)
  }
  const startGroupDrag = (id: string): void => {
    groupDragRef.current = id
    gOverRef.current = null
    setGOver(null)
    setGDragOn(true)
  }
  /** 分组拖拽悬停：组间插入条 data-o / 其他分组面板上下半区 → 槽位 */
  const groupHover = (x: number, y: number): void => {
    if (groupDragRef.current === null) return
    updateAutoScroll(x, y)
    const el = document.elementFromPoint(x, y) as HTMLElement | null
    if (!el || typeof el.closest !== 'function') {
      setGOverN(null)
      return
    }
    const strip = el.closest('[data-mgs-strip]')
    if (strip) {
      const o = Number(strip.getAttribute('data-o'))
      setGOverN(Number.isFinite(o) ? o : null)
      return
    }
    const pane = el.closest('[data-mgs-group]')
    if (pane && pane.getAttribute('data-mgs-group-id') !== groupDragRef.current) {
      const gi = Number(pane.getAttribute('data-mgs-i'))
      const dragFrom = groups.findIndex((g) => g.id === groupDragRef.current)
      if (Number.isFinite(gi) && dragFrom >= 0) {
        // 剩余序 rank（去掉被拖分组）
        const rank = gi > dragFrom ? gi - 1 : gi
        const rc = pane.getBoundingClientRect()
        setGOverN(y < rc.top + rc.height / 2 ? rank : rank + 1)
        return
      }
    }
    setGOverN(null)
  }
  const endGroupDrag = (): void => {
    const id = groupDragRef.current
    const o = gOverRef.current
    groupDragRef.current = null
    gOverRef.current = null
    setGDragOn(false)
    setGOver(null)
    if (id === null || o === null) return
    const from = groups.findIndex((g) => g.id === id)
    if (from < 0) return
    // 落点区号 = 相对「剩余分组」的插入序 → 即最终下标（0..n-1）
    const fin = Math.max(0, Math.min(o, groups.length - 1))
    if (fin !== from) writeGroups(reorderGroups(groups, from, fin))
  }

  /* ---------- FLIP：落点虚框插入/移除/提交重排时，其余卡片平滑移动 ---------- */
  const posRef = useRef<Map<string, DOMRect>>(new Map())
  const animElsRef = useRef<HTMLElement[]>([])
  const bornAtRef = useRef<number>(0)
  useLayoutEffect(() => {
    if (typeof document === 'undefined') return
    // 结束上一轮动画态（避免测量到过渡中间值）
    for (const el of animElsRef.current) {
      el.style.transition = 'none'
      el.style.transform = ''
    }
    animElsRef.current = []
    const prev = posRef.current
    const next = new Map<string, DOMRect>()
    const samples: { el: HTMLElement; key: string }[] = []
    const dragging = dragIdRef.current
    const draggingGroup = groupDragRef.current
    document.querySelectorAll<HTMLElement>('[data-mgs-grid] .mgs-card').forEach((el) => {
      const key = el.getAttribute('data-testid') ?? ''
      if (key === '') return
      if (dragging !== null && key === 'mgs-card-' + dragging) return // 被拖卡自身（fixed 跟手）不参与
      samples.push({ el, key })
      next.set(key, el.getBoundingClientRect())
    })
    document.querySelectorAll<HTMLElement>('[data-mgs-group]').forEach((el) => {
      const gid = el.getAttribute('data-mgs-group-id') ?? ''
      if (gid === '') return
      if (draggingGroup !== null && gid === draggingGroup) return // 被拖分组自身不参与
      const key = 'g:' + gid
      samples.push({ el, key })
      next.set(key, el.getBoundingClientRect())
    })
    for (const k of Array.from(prev.keys())) {
      if (!next.has(k)) prev.delete(k)
    }
    posRef.current = next
    if (!bornAtRef.current) bornAtRef.current = performance.now()
    // 打开初期（600ms 内）布局仍在稳定：只更新基线，不做让位动画（避免每次打开闪动）
    if (performance.now() - bornAtRef.current < 600) return
    const moves: { el: HTMLElement; dx: number; dy: number }[] = []
    for (const s of samples) {
      const old = prev.get(s.key)
      const rect = next.get(s.key)
      if (!old || !rect) continue
      const dx = old.left - rect.left
      const dy = old.top - rect.top
      if (Math.abs(dx) > 0.5 || Math.abs(dy) > 0.5) moves.push({ el: s.el, dx, dy })
    }
    if (moves.length === 0) return
    // 卡片开始让位移动：0.1s 内不再触发落点判定
    flipLockRef.current = (typeof performance !== 'undefined' ? performance.now() : Date.now()) + 100
    for (const m of moves) {
      m.el.style.transition = 'none'
      m.el.style.transform = 'translate(' + m.dx + 'px,' + m.dy + 'px)'
    }
    void document.body.offsetHeight
    requestAnimationFrame(() => {
      for (const m of moves) {
        m.el.style.transition = 'transform 200ms cubic-bezier(.2,.7,.3,1)'
        m.el.style.transform = ''
        animElsRef.current.push(m.el)
      }
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dropP, dragId, config, gDragOn])

  /* ---------- 子页 ---------- */
  if (open) {
    const back = () => openTarget(null)
    if (open.kind === 'member') {
      const entry = members.find((m) => memberId(m) === open.id)
      const page = renderSlot?.(MEMBER_PAGE_SEAT, undefined, { entryKey: open.id })
      return (
        <section className="mgs-root" data-mega-settings-root>
          <header className="mgs-header">
            <div className="mgs-header-left">
              <HostBadge label={tr('settings.center')} />
              <span className="mgs-header-divider">&gt;</span>
              {entry ? <MemberBadge entry={entry} t={tr} /> : <Badge name={open.id} tag={tr('settings.unknown')} />}
            </div>
            <button className="mgs-back" type="button" onClick={back}>← {tr('settings.back')}</button>
          </header>
          <div className="mgs-body">
            <MemberBoundary failedText={tr('settings.failed')}>
              {page ?? <p className="mgs-placeholder">{tr('settings.pageMissing')}</p>}
            </MemberBoundary>
          </div>
        </section>
      )
    }
    // 管控子页：header 带真实版本；内容区不套 mgs-panel 样式、无标题行
    const item = managedById.get(open.id)
    const label = item ? memberLabel(item.entry as MemberEntry) || open.id : open.id
    const ver = item ? versionOf(item.entry) : undefined
    return (
      <section className="mgs-root" data-mega-settings-root>
        <header className="mgs-header">
          <div className="mgs-header-left">
            <HostBadge label={tr('settings.center')} />
            <span className="mgs-header-divider">&gt;</span>
            <Badge name={label} tag={ver ?? tr('settings.managed')} />
          </div>
          <button className="mgs-back" type="button" onClick={back}>← {tr('settings.back')}</button>
        </header>
        <div className="mgs-body mgs-managed-page">
          <MiniSectionContent slots={slots.mini} sectionId={open.id} ownerProps={{ close: back }} />
        </div>
      </section>
    )
  }

  /* ---------- 首页 ---------- */
  const mode = config.mode ?? 'collect'
  const cardViewProps = {
    t: tr,
    onOpen: (id: string) => openTarget({ kind: 'section', id }),
    excluded: (id: string) => excludedIds.has(id),
    onToggleTake: toggleTake,
    versionOf,
  }
  const renderPanels = (): ReactNode => (
    <>
      {memberIds.length > 0 ? (
        <div className="mgs-panel mgs-group" key="members">
          <div className="mgs-panel__head">
            <span className="mgs-panel__title">{tr('group.mega')}</span>
          </div>
          <div className="mgs-grid">
            {memberSorted.map((entry) => (
              <CardShell
                key={memberId(entry)}
                it={{ id: memberId(entry), order: entry.options?.order ?? 0, entry: entry as SectionEntry }}
                testId={'mgs-member-' + memberId(entry)}
                {...cardViewProps}
                // 成员不是 settings.section 条目：必须走 member 子页（折叠模式同路径），否则静默空白
                onOpen={() => openTarget({ kind: 'member', id: memberId(entry) })}
              />
            ))}
          </div>
        </div>
      ) : null}
      {(() => {
        const groupNodes: ReactNode[] = []
        const stripCls = (o: number): string =>
          gOver === o ? 'mgs-group-strip mgs-group-strip--over' : 'mgs-group-strip'
        const groupDragId = gDragOn ? groupDragRef.current : null
        const dragPane = (g: SettingsGroup, gi: number): ReactNode => {
          const gItems = itemsOf(g.itemIds)
          const isEmpty = gItems.length === 0
          return (
            <GroupDragPane
              key={'gp-' + g.id}
              gi={gi}
              gid={g.id}
              onStart={startGroupDrag}
              onHover={groupHover}
              onEnd={endGroupDrag}
            >
              <GroupSection
                title={g.name}
                items={gItems}
                editing={editTarget !== null && editTarget.id === g.id}
                onStartEdit={() => setEditTarget({ id: g.id, name: g.name })}
                onCommitEdit={(name) => commitName(g.id, name)}
                onDelete={() => handleRemoveGroup(g.id)}
                emptyHint={tr('group.empty')}
                emptyRec={dragId !== null && isEmpty}
                recOn={dropP !== null && dropP.key === g.id && isEmpty}
                {...cardViewProps}
                gridKey={g.id}
                frameP={cardFrameP(g.id)}
                {...cardBus}
              />
            </GroupDragPane>
          )
        }
        if (groupDragId === null) {
          groups.forEach((g, gi) => groupNodes.push(dragPane(g, gi)))
          return groupNodes
        }
        // 拖拽中：插入条只围绕仍在流的剩余分组（区号 0..n-1 即最终下标）；被拖组末位追加（fixed 不占流）
        let rank = 0
        groups.forEach((g, gi) => {
          if (g.id === groupDragId) return
          groupNodes.push(
            <div key={'gs-' + rank} data-mgs-strip data-o={rank} className={stripCls(rank)} />,
          )
          groupNodes.push(dragPane(g, gi))
          rank += 1
        })
        const giDrag = groups.findIndex((g) => g.id === groupDragId)
        if (rank > 0) {
          const tailO = rank // 剩余分组后 = 末尾（n-1）
          groupNodes.push(<div key="gs-tail" data-mgs-strip data-o={tailO} className={stripCls(tailO)} />)
        }
        if (giDrag >= 0) groupNodes.push(dragPane(groups[giDrag], giDrag))
        return groupNodes
      })()}
      {ungroupedList.length === 0 && dragId === null && !ungKeep ? (
        // 静态「新建分组」：无外层 div，直接渲染；下方 110px 留白占住空面板高度（切换零跳动）
        <button
          type="button"
          key="add-group-bar"
          className="mgs-add-group"
          onClick={handleAddGroup}
        >
          <IconAdd />
          <span>{tr('group.add')}</span>
        </button>
      ) : null}
      {ungroupedList.length === 0 && (dragId !== null || ungKeep) ? (
        // 空未分组面板（拖拽/延迟保留期显示；接收区整行宽）
        <div className="mgs-panel mgs-group" key="ungrouped">
          <div className="mgs-panel__head">
            <span className="mgs-panel__title">{tr('group.ungrouped')}</span>
            <span className="mgs-panel__ops">
              <button type="button" className="mgs-icon-btn" title={tr('group.add')} onClick={handleAddGroup}>
                <IconAdd />
              </button>
            </span>
          </div>
          <div className="mgs-grid" data-mgs-grid={U_KEY}>
            <div
              className={
                dropP !== null && dropP.key === U_KEY
                  ? 'mgs-frame mgs-frame-wide mgs-rec-on'
                  : 'mgs-frame mgs-frame-wide mgs-rec-idle'
              }
              data-mgs-rec="1"
            />
          </div>
        </div>
      ) : null}
      {ungroupedList.length > 0 ? (
        <div className="mgs-panel mgs-group" key="ungrouped">
          <div className="mgs-panel__head">
            <span className="mgs-panel__title">{tr('group.ungrouped')}</span>
            <span className="mgs-panel__ops">
              <button type="button" className="mgs-icon-btn" title={tr('group.add')} onClick={handleAddGroup}>
                <IconAdd />
              </button>
            </span>
          </div>
          <div className="mgs-grid" data-mgs-grid={U_KEY}>
            {(() => {
              const items = itemsOf(ungroupedList)
              const cells: ReactNode[] = []
              const fp = cardFrameP(U_KEY)
              if (items.length === 0) {
                // 空未分组：拖拽中常显整行宽接收槽（未命中弱化，悬停命中才呈落点样式）
                if (dragId !== null) {
                  const on = dropP !== null && dropP.key === U_KEY
                  cells.push(
                    <div
                      key="rec-empty"
                      className={on ? 'mgs-frame mgs-frame-wide mgs-rec-on' : 'mgs-frame mgs-frame-wide mgs-rec-idle'}
                      data-mgs-rec="1"
                    />,
                  )
                }
                return cells
              }
              items.forEach((it, idx) => {
                if (fp !== null && fp === idx) cells.push(<div key={'uf-' + idx} className="mgs-frame" data-mgs-frame="1" />)
                cells.push(<CardShell key={it.id} it={it} {...cardViewProps} ops dataMgsI={idx} {...cardBus} />)
              })
              if (fp !== null && fp >= items.length) cells.push(<div key="uf-tail" className="mgs-frame" data-mgs-frame="1" />)
              return cells
            })()}
          </div>
        </div>
      ) : null}
    </>
  )

  return (
    <section className="mgs-root" data-mega-settings-root>
      <header className="mgs-header">
        <div className="mgs-header-left"><HostBadge label={tr('settings.center')} /></div>
      </header>
      <div className="mgs-body">
        <div className="mgs-panel">
          <FieldRow label={tr('mode.label')}>
            <Segmented<ControlMode>
              value={mode}
              options={[
                { value: 'collect', label: tr('mode.collect') },
                { value: 'fold', label: tr('mode.fold') },
              ]}
              onChange={(next) => void scope.set('mode', next)}
            />
          </FieldRow>
          {mode === 'fold' ? <p className="mgs-hint">{tr('mode.fold.hint')}</p> : null}
        </div>
        {mode === 'collect' ? renderPanels() : null}
      </div>
    </section>
  )
}