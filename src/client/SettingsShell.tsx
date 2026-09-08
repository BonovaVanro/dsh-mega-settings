/**
 * SettingsShell（DESIGN-v2 修订）：单一设置壳 shadow sidebar.settings（priority -100），
 * 视觉按官方 SettingsRoot 复刻（官方几何/token 参数，见下 CSS；不自创风格）。
 *
 * 导航行模型（0.7，数组即顺序，不维护 index）：
 * - 官方四项固定在前；其后为「释放接管」一级行（顺序 = config.navOrder 自定义段）；
 * - navOrder 恒以保留 id（NAV_HUB_ID，即收纳配置/折叠设置入口）结尾，入口行不可拖、恒在最后；
 * - 一级行数组内出现 ⇒ 该插件已释放（折叠体隐藏其行，收纳页卡片保留）；
 * - 接管数组 = 自定义组 itemIds + 未分组条目（UNGROUPED_GID，items 落 ungroupedOrder），折叠/收纳共享；
 *   释放/接管不破坏接管数组中的归属（释放不删、接管=移到目标槽）。
 *
 * 折叠模式拖拽：
 * - 折叠体内第三方行可拖出到一级区（释放：写 navOrder 落点槽，接管数组不动）；
 * - 一级行可拖入折叠体（接管：接管数组旧位先移除 → 目标组/未分组槽插入，状态 true）；
 * - mega 固组（mega-settings 行与成员行）不可拖、不可作为落点；
 * - 拖拽进行中（一级行拖入时）空未分组保持显示为接收槽。
 */
import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import type { ControlMode, MegaSettingsConfig, SettingsGroup } from '../schema.ts'
import {
  NATIVE_SECTION_IDS,
  NAV_HUB_ID,
  UNGROUPED_GID,
  expandUngroupedOrder,
  groupOf,
  memberId,
  memberLabel,
  orderedUngrouped,
  placeVisible,
  randomId,
  removeGroup,
  sortMembers,
  ungroupedIds,
  validateGroupName,
  type MemberEntry,
  type SectionEntry,
} from './pure.ts'
import { MEMBER_PAGE_SEAT } from './seats.ts'
import { MiniSectionContent } from './mini.tsx'
import {
  IconAgentPresetOutline16,
  IconCloseOutline16,
  IconDataOutline16,
  IconPersonalizationOutline16,
  IconSettingsOutline14,
  IconSettingsOutline16,
} from '@deepseek-ai/dsh-client-ui-primitives'
import { SettingsCenter, type SettingsCenterInjected } from './SettingsCenter.tsx'

declare const MGS_VERSION: string

export interface ShellInjected {
  scope: SettingsCenterInjected['scope']
  slots: SettingsCenterInjected['slots']
}
interface ShellProps {
  scope: SettingsCenterInjected['scope']
  slots: SettingsCenterInjected['slots']
  renderSlot?: (key: string, owner?: unknown, opts?: { entryKey?: string; fallback?: ReactNode }) => ReactNode
  t?: (key: string, params?: Record<string, string>) => string
  wide?: boolean
  /** 官方渲染器经 inject hooks 注入的 sections selector（行数据已解析 label） */
  useSections?: (selector: (rows: { id: string; order: number; label: string }[]) => unknown) => unknown
}

type NavTarget = { kind: 'section'; id: string } | { kind: 'member'; id: string } | { kind: 'mega' } | null
type NavRowLike = { id: string; order: number; label: string }

/** 拖拽源：top = 一级行（释放/重排/接管）；body = 折叠体第三方行（释放） */
type ShellDrag = { kind: 'top' | 'body'; id: string } | null
/** 悬停落点：nav = 一级区槽（o = 可见槽序号）；body = 折叠体某列表（lid = 组 gid / UNGROUPED_GID）；
 *  head = 折叠设置入口行（拖入 = 收回原位，不指定槽） */
type OverTarget = { k: 'nav'; o: number } | { k: 'body'; lid: string; o: number } | null

/* 官方 SettingsRoot.module.css 类名（0.1.2 线官方源码模块名；dsh-client-ui-settings-general 注入。
 * 类名经 CSS-Module 在官方构建中 hash，宿主 bundle 并不给本壳兜底——本壳自注入同名样式
 * （OFFICIAL_CSS）自保持一致，观感跟随 0.1.2 线官方设计（triggerRow 包裹、elevation-prominent、r32）。 */
const C = {
  triggerRow: 'triggerRow',
  railRow: 'railRow',
  trigger: 'trigger',
  rail: 'rail',
  triggerLabel: 'triggerLabel',
  overlay: 'overlay',
  mask: 'mask',
  panel: 'panel',
  nav: 'nav',
  navTitle: 'navTitle',
  navList: 'navList',
  navCell: 'navCell',
  active: 'active',
  navIcon: 'navIcon',
  navLabel: 'navLabel',
  content: 'content',
  header: 'header',
  actions: 'actions',
  close: 'close',
  hiddenLabel: 'hiddenLabel',
  options: 'options',
}

function cls(...names: Array<string | false | undefined>): string {
  return names.filter(Boolean).join(' ')
}

function arrEq(a: readonly string[], b: readonly string[]): boolean {
  return a.length === b.length && a.every((x, i) => x === b[i])
}

/** position:fixed 包含块原点（transform/filter 等祖先使 fixed 相对其定位；clientX 是视口坐标需扣除） */
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

/* 官方 SettingsRoot.module.css 同文本兜底：官方 bundle 注入缺失/官方 hash 升级失联时，
 * 本副本保证壳仍具官方观感（选择器与官方一致，值逐字相同）。 */
const OFFICIAL_CSS = [
  '.triggerRow{flex:none;display:flex;align-items:center;gap:8px;width:calc(100% + 4px);margin:4px -2px}',
  '.triggerRow.railRow{width:36px;margin:8px 0 10px}',
  '.trigger{flex:1;min-width:0;display:flex;align-items:center;gap:8px;width:auto;height:42px;margin:0;padding:0 10px 0 8px;box-sizing:border-box;border:none;border-radius:12px;background:transparent;cursor:pointer;overflow:hidden;color:var(--dsw-alias-label-primary);font-family:inherit;font-size:14px;line-height:22px}',
  '.trigger:hover{background:var(--dsw-alias-interactive-bg-hover)}',
  '.trigger.rail{flex:none;width:36px;height:36px;margin:0;justify-content:center;gap:0;padding:0;border-radius:50%;corner-shape:round}',
  '.triggerLabel{overflow:hidden;white-space:nowrap}',
  '.overlay{position:fixed;inset:0;z-index:1000;display:flex;align-items:center;justify-content:center}',
  '.mask{position:absolute;inset:0;background:var(--dsw-alias-bg-mask-1);backdrop-filter:var(--dsw-mask-blur)}',
  '.panel{position:relative;z-index:1;display:flex;width:800px;height:min(800px,calc(100vh - 48px));max-width:calc(100vw - 48px);border-radius:32px;overflow:hidden;background:var(--dsw-alias-bg-layer-2);box-shadow:var(--dsw-elevation-prominent);--dsh-scrollbar-thumb:var(--dsw-alias-scrollbar-bg-l2);--dsh-scrollbar-thumb-hover:var(--dsw-alias-scrollbar-hover-l2)}',
  '.nav{flex:none;display:flex;flex-direction:column;gap:18px;width:188px;padding:22px 12px 0;box-sizing:border-box}',
  '.navTitle{padding:0 12px;font-size:16px;line-height:24px;font-weight:500;color:var(--dsw-alias-label-primary)}',
  '.navList{display:flex;flex-direction:column;gap:4px}',
  '.navCell{display:flex;align-items:center;gap:8px;height:40px;padding:9px 16px 9px 12px;box-sizing:border-box;border:none;border-radius:12px;background:transparent;cursor:pointer;font-family:inherit;font-size:14px;line-height:22px;font-weight:400;color:var(--dsw-alias-label-primary);text-align:left}',
  '.navCell:hover{background:var(--dsw-specific-sidebar-nav-item-hover)}',
  '.navCell.active{background:var(--dsw-specific-sidebar-nav-item-active)}',
  '.navIcon{flex:none}',
  '.navLabel{flex:1;min-width:0;overflow:hidden;white-space:nowrap;text-overflow:ellipsis}',
  '.content{flex:1;min-width:0;display:flex;flex-direction:column}',
  '.header{flex:none;display:flex;align-items:flex-start;justify-content:space-between;gap:8px;height:54px;padding:20px 14px 8px 10px;box-sizing:border-box}',
  '.actions{min-width:0;display:flex;align-items:center;justify-content:flex-end;gap:8px;margin-left:auto}',
  '.close{display:inline-flex;align-items:center;justify-content:center;width:28px;height:28px;padding:0;border:none;border-radius:28px;background:transparent;cursor:pointer;color:var(--dsw-alias-label-primary)}',
  '.close:hover{background:var(--dsw-alias-interactive-bg-hover)}',
  '.options{flex:1;min-height:0;padding:0 24px 24px;overflow-y:auto}',
  '.hiddenLabel{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap}',
].join('\n') + '\n/* mega-settings 覆写（沿用官方类名）：nav 强制顶对齐；条目列可滚动 */\n.nav{justify-content:flex-start!important}\n.navList{flex:1;min-height:0;overflow-y:auto}\n/* mega-settings 折叠子区 */\n.mgs-fold-body{display:flex;flex-direction:column}\n.mgs-fold-sep{display:flex;align-items:center;height:26px;padding:4px 12px 2px 20px;font-size:11px;font-weight:600;color:var(--dsw-alias-label-tertiary);box-sizing:border-box}\n.mgs-fold-item{margin-left:20px;width:calc(100% - 20px);padding-left:10px;height:34px;font-size:13px;line-height:20px;padding-top:6px;padding-bottom:6px;box-sizing:border-box}\n/* 隐藏 nav 列滚动条（保留滚动） */\n.navList{scrollbar-width:none;-ms-overflow-style:none}\n.navList::-webkit-scrollbar{display:none;width:0;height:0}'

/* mega-settings 补充规则：激活导航行去阴影 + matrix 主题适配 */
const EXTRA_CSS = [
  '[role="dialog"] > nav button[aria-current="true"],',
  '[role="dialog"] > nav button[aria-current="true"] * {',
  '  box-shadow: unset !important;',
  '}',
  '/* matrix 主题适配（用户 css 原样加载） */',
  'html[data-dsh-skin="matrix"] [role="dialog"]  nav > div:first-child {',
  '  background: none !important;',
  '  box-shadow: none !important;',
  '}',
  'html[data-dsh-skin="matrix"] [role="dialog"]  .options {',
  '  padding-top: 24px !important;',
  '}',
].join('\n')

function ensureOfficialCss(): void {
  if (typeof document === 'undefined') return
  if (document.querySelector("style[data-plugin='dsh-mega-settings/settings-shell']")) return
  const tag = document.createElement('style')
  tag.dataset.plugin = 'dsh-mega-settings/settings-shell'
  tag.textContent = OFFICIAL_CSS + '\n' + EXTRA_CSS
  document.head.appendChild(tag)
}

ensureOfficialCss()

/* ============ 导航图标（官方 primitives） ============ */
function navIconOf(id: string): ReactNode {
  switch (id) {
    case 'models':
      return <IconDataOutline16 size={16} />
    case 'agent-presets':
      return <IconAgentPresetOutline16 size={16} />
    case 'plugins':
      return <IconPersonalizationOutline16 size={16} />
    default:
      return <IconSettingsOutline16 size={16} />
  }
}
/** 折叠设置行的收纳图标（自绘 folder；新元素才允许自命名/自绘）。 */
function FoldHeadIcon() {
  return (
    <svg
      className="mgs-fold-head-icon"
      width="16"
      height="16"
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.3"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M1.5 4.6c0-.6.5-1.1 1.1-1.1h2.8c.3 0 .5.1.7.3l1 1.1h6.3c.6 0 1.1.5 1.1 1.1v5.4c0 .6-.5 1.1-1.1 1.1H2.6c-.6 0-1.1-.5-1.1-1.1z" />
    </svg>
  )
}
/* ============ hooks ============ */
function useConfig(scope: SettingsCenterInjected['scope']): MegaSettingsConfig {
  const [, force] = useState(0)
  useEffect(() => scope.subscribe(() => force((n) => n + 1)), [scope])
  return scope.getSnapshot().value ?? ({} as MegaSettingsConfig)
}
function useMembers(slots: SettingsCenterInjected['slots']): readonly MemberEntry[] {
  const [, force] = useState(0)
  useEffect(() => {
    const a = slots.subscribeMembers(() => force((n) => n + 1))
    const b = slots.onSlotsChanged((key) => {
      if (key === 'mega.settings.member') force((n) => n + 1)
    })
    // locale 切换（thunk label 需重解析）→ 重渲染
    const face = slots.mini.hostFace().locale
    const c = face ? face.subscribe(() => force((n) => n + 1)) : undefined
    return () => {
      a()
      b()
      c?.()
    }
  }, [slots])
  return slots.members()
}
/** fallback：无官方 useSections 注入时直接读槽（label 在此解析）。 */
function localSections(slots: SettingsCenterInjected['slots']): { id: string; order: number; label: string }[] {
  return (slots.sections() as SectionEntry[])
    .map((e) => ({ id: (e.options?.id ?? e.id ?? '') as string, order: e.options?.order ?? 0, label: memberLabel(e as MemberEntry) }))
    .sort((a, b) => a.order - b.order)
}
/* ============ 导航行 ============ */
function NavCell(props: {
  label: string
  active: boolean
  icon?: ReactNode
  className?: string
  onClick: () => void
  dataNavI?: number
  dataLid?: string
  dataRidx?: number
}) {
  return (
    <button
      type="button"
      className={cls(C.navCell, props.active && C.active, props.className)}
      aria-current={props.active ? 'true' : undefined}
      data-nav-i={props.dataNavI !== undefined ? props.dataNavI : undefined}
      data-lid={props.dataLid}
      data-ridx={props.dataRidx !== undefined ? props.dataRidx : undefined}
      onClick={props.onClick}
    >
      {props.icon}
      <span className={C.navLabel}>{props.label}</span>
    </button>
  )
}
/** 分组分隔标签（2 级；hub 风格：非交互、小字、色弱）。 */
function GroupSeparator(props: { label: string }) {
  return <div className="mgs-fold-sep">{props.label}</div>
}
/** 重命名铅笔（mgs 自绘小图标；新元素允许自命名）。 */
function IconEditMini() {
  return (
    <svg
      className="mgs-icon"
      width="12"
      height="12"
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.4"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M11.3 2.3l2.4 2.4L5.5 12.9l-3.2.8.8-3.2 8.2-8.2z" />
    </svg>
  )
}
/** 新建分组加号（mgs 自绘小图标）。 */
function IconAddMini() {
  return (
    <svg
      className="mgs-icon"
      width="12"
      height="12"
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      aria-hidden="true"
    >
      <path d="M8 3v10M3 8h10" />
    </svg>
  )
}
/** 删除分组（垃圾桶，mgs 自绘小图标）。 */
function IconTrashMini() {
  return (
    <svg
      className="mgs-icon"
      width="12"
      height="12"
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.4"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M2.5 4h11M6.5 4V2.5h3V4M4 4l.6 9.5h6.8L12 4M6.6 6.8v4M9.4 6.8v4" />
    </svg>
  )
}

/** 分组标题行（折叠体）：hover 显示重命名铅笔；editing = 行内输入框（Enter 提交 / Esc 取消 / 失焦提交） */
function GroupTitleRow(props: {
  g: SettingsGroup
  editing: boolean
  tip: string
  removeTip: string
  onStartEdit: () => void
  onDelete?: () => void
  onCommit: (name: string) => void
  onCancel: () => void
}) {
  const [draft, setDraft] = useState(props.g.name)
  const doneRef = useRef(false)
  useEffect(() => {
    if (!props.editing) {
      setDraft(props.g.name)
      doneRef.current = false
    }
  }, [props.editing, props.g.name])
  const finish = (fn: () => void): void => {
    if (doneRef.current) return
    doneRef.current = true
    fn()
  }
  if (!props.editing) {
    return (
      <div className="mgs-fold-sep mgs-fold-title">
        <span className="mgs-fold-title-label" title={props.g.name}>
          {props.g.name}
        </span>
        <span className="mgs-fold-title-ops">
          <button
            type="button"
            className="mgs-fold-title-btn"
            title={props.tip}
            aria-label={props.tip}
            onClick={props.onStartEdit}
          >
            <IconEditMini />
          </button>
          {props.onDelete ? (
            <button
              type="button"
              className="mgs-fold-title-btn"
              title={props.removeTip}
              aria-label={props.removeTip}
              onClick={props.onDelete}
            >
              <IconTrashMini />
            </button>
          ) : null}
        </span>
      </div>
    )
  }
  return (
    <div className="mgs-fold-sep mgs-fold-title">
      <input
        className="mgs-fold-title-input"
        value={draft}
        autoFocus
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') finish(() => props.onCommit(draft))
          else if (e.key === 'Escape') finish(props.onCancel)
        }}
        onBlur={() => finish(() => props.onCommit(draft))}
      />
    </div>
  )
}

/** 折叠设置行：左侧收纳图标 + 名称，右侧展开标识；默认收起由 Shell 初始 closed 决定。 */
function GroupHead(props: { label: string; open: boolean; onToggle: () => void }) {
  return (
    <button
      type="button"
      data-foldhead="1"
      className={C.navCell}
      onClick={props.onToggle}
      aria-expanded={props.open}
    >
      <FoldHeadIcon />
      <span className={C.navLabel}>{props.label}</span>
      <span className="mgs-fold-chevron" aria-hidden="true">
        {props.open ? '▾' : '▸'}
      </span>
    </button>
  )
}

/** 可拖拽导航按钮：指针拖拽直接作用于 button（原元素 fixed 跟手，原槽塌陷），
 *  无浏览器拖影/克隆；单击不误拖。 */
function DragNavCell(props: {
  kind: 'top' | 'body'
  id: string
  label: string
  icon?: ReactNode
  active: boolean
  onClick: () => void
  className?: string
  dataNavI?: number
  dataLid?: string
  dataRidx?: number
  dataRowId?: string
  onStart: (kind: 'top' | 'body', id: string) => void
  onHover: (x: number, y: number) => void
  onEnd: () => void
}) {
  const dragRef = useRef<{
    armed: boolean
    moved: boolean
    sx: number
    sy: number
    grabX: number
    grabY: number
    width: number
    /** 拖起时缓存的 fixed 包含块原点（拖拽过程恒定，避免每帧 getComputedStyle 链） */
    ox: number
    oy: number
    /** 最新指针坐标 + 待执行 rAF（pointermove 高频 → 每帧合并为一次更新） */
    px: number
    py: number
    /** 已应用的飞位（渲染期 style 读此，避免与直接 DOM 写入冲突） */
    fx: number
    fy: number
    raf: number
    moveFn: ((e: PointerEvent) => void) | null
    upFn: (() => void) | null
  }>({ armed: false, moved: false, sx: 0, sy: 0, grabX: 0, grabY: 0, width: 0, ox: 0, oy: 0, px: 0, py: 0, fx: 0, fy: 0, raf: 0, moveFn: null, upFn: null })
  const nodeRef = useRef<HTMLButtonElement | null>(null)
  const [fly, setFly] = useState(false)
  /** 直接改 DOM transform 跟随光标（绕过 React 状态，最短延迟；fx/fy 供渲染期读当前位） */
  const applyFly = (left: number, top: number): void => {
    const d = dragRef.current
    d.fx = left
    d.fy = top
    const node = nodeRef.current
    if (node) node.style.transform = 'translate(' + left + 'px,' + top + 'px)'
  }
  const detach = (): void => {
    const d = dragRef.current
    if (d.raf !== 0) {
      cancelAnimationFrame(d.raf)
      d.raf = 0
    }
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
      // 跟随光标：直接改 DOM transform（不走 React 状态，最短延迟）
      applyFly(e.clientX - d.ox - d.grabX, e.clientY - d.oy - d.grabY)
      // 悬停判定较重，仍每帧合并一次
      d.px = e.clientX
      d.py = e.clientY
      if (d.raf !== 0) return
      d.raf = requestAnimationFrame(() => {
        d.raf = 0
        props.onHover(d.px, d.py)
      })
    }
    const up = (): void => {
      detach()
      d.armed = false
      setFly(false)
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
    <button
      ref={nodeRef}
      type="button"
      className={cls(C.navCell, props.active && C.active, props.className)}
      aria-current={props.active ? 'true' : undefined}
      data-nav-i={props.dataNavI !== undefined ? props.dataNavI : undefined}
      data-lid={props.dataLid}
      data-ridx={props.dataRidx !== undefined ? props.dataRidx : undefined}
      data-row-id={props.dataRowId}
      style={
        fly
          ? {
              position: 'fixed',
              left: 0,
              top: 0,
              // transform 走合成器；位置由 applyFly 直接写 DOM，渲染期仅按 ref 兜底
              transform: 'translate(' + dragRef.current.fx + 'px,' + dragRef.current.fy + 'px)',
              willChange: 'transform',
              width: dragRef.current.width + 'px',
              zIndex: 60,
              pointerEvents: 'none',
            }
          : undefined
      }
      onPointerDown={(e) => {
        if (e.button !== 0) return
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
        props.onStart(props.kind, props.id)
        attach()
        const o0 = fixedOriginOf(nodeRef.current)
        d.ox = o0.x
        d.oy = o0.y
        applyFly(e.clientX - o0.x - d.grabX, e.clientY - o0.y - d.grabY)
        setFly(true)
        props.onHover(e.clientX, e.clientY)
      }}
      onClickCapture={(e) => {
        if (dragRef.current.moved) {
          dragRef.current.moved = false
          e.preventDefault()
          e.stopPropagation()
        }
      }}
      onClick={props.onClick}
    >
      {props.icon}
      <span className={C.navLabel}>{props.label}</span>
    </button>
  )
}

/* ============ Shell 主体 ============ */
export function SettingsShell(props: ShellProps) {
  const { scope, slots, renderSlot, t, useSections } = props
  const config = useConfig(scope)
  const members = useMembers(slots)
  // 导航行经官方注入的 useSections 读取（hub 模式）；回退本地订阅（无注入时）
  const navRows = (useSections
    ? (useSections((r: unknown) => r) as { id: string; order: number; label: string }[])
    : localSections(slots)
  ).filter((r) => r.id.length > 0)
  const [open, setOpen] = useState(false)
  const [target, setTarget] = useState<NavTarget>(null)
  // 折叠设置默认收起（$fold: true）；每次打开弹层恢复收起
  const [closed, setClosed] = useState<Record<string, boolean>>({ $fold: true })
  const closedRef = useRef(closed)
  useEffect(() => {
    closedRef.current = closed
  }, [closed])
  /** 折叠体分组重命名中的分组 id（null = 无） */
  const [editingGid, setEditingGid] = useState<string | null>(null)
  const [drag, setDrag] = useState<ShellDrag>(null)
  const [over, setOver] = useState<OverTarget>(null)
  /** 指针拖拽：源与落点的 ref 镜像（window 事件闭包读取，避免陈旧状态） */
  const rowDragRef = useRef<{ kind: 'top' | 'body'; id: string } | null>(null)
  const overRef = useRef<OverTarget>(null)
  const navListRef = useRef<HTMLDivElement>(null)
  /** FLIP 让位：行位置基线 / 动画元素 / 启动时刻 / 判定锁 */
  const navPosRef = useRef<Map<string, DOMRect>>(new Map())
  const navAnimElsRef = useRef<HTMLElement[]>([])
  const navBornAtRef = useRef(0)
  const flipLockRef = useRef(0)
  /** 上次 FLIP 采样时折叠体是否展开（展开/收起切换瞬间重建基线，不做让位动画） */
  const foldOpenRef = useRef(false)
  /** 导航列边缘自动滚动 */
  const navScrollRef = useRef<{ raf: number; dir: number; str: number }>({ raf: 0, dir: 0, str: 0 })
  const navXYRef = useRef<{ x: number; y: number } | null>(null)
  const setOverState = (t: OverTarget): void => {
    const prev = overRef.current
    if (prev === t) return
    if (
      prev !== null &&
      t !== null &&
      ((prev.k === 'nav' && t.k === 'nav' && prev.o === t.o) ||
        (prev.k === 'body' && t.k === 'body' && prev.lid === t.lid && prev.o === t.o))
    ) {
      return
    }
    overRef.current = t
    setOver(t)
  }
  const mode: ControlMode = config.mode ?? 'collect'
  const groups = config.groups ?? []

  /* ---------- FLIP：落点框插入/移除与提交重排时，其余导航行平滑让位（跟手源行不参与） ---------- */
  useLayoutEffect(() => {
    if (typeof document === 'undefined') return
    for (const el of navAnimElsRef.current) {
      el.style.transition = 'none'
      el.style.transform = ''
    }
    navAnimElsRef.current = []
    const root = navListRef.current
    if (root === null) {
      // 行不在 DOM（弹层关闭）：清基线，避免下次打开用陈旧坐标凭空动画
      navPosRef.current = new Map()
      foldOpenRef.current = false
      return
    }
    const foldOpen = !closed['$fold']
    if (foldOpenRef.current !== foldOpen) {
      // 折叠体开/关切换瞬间：本次仅重建基线（行进入/离开），不做让位动画
      foldOpenRef.current = foldOpen
      navPosRef.current = new Map()
    }
    const prev = navPosRef.current
    const next = new Map<string, DOMRect>()
    const samples: { el: HTMLElement; key: string }[] = []
    root.querySelectorAll<HTMLElement>('[data-row-id]').forEach((el) => {
      if (el.style.position === 'fixed') return
      const key = el.getAttribute('data-row-id') ?? ''
      if (key === '') return
      samples.push({ el, key })
      next.set(key, el.getBoundingClientRect())
    })
    for (const k of Array.from(prev.keys())) {
      if (!next.has(k)) prev.delete(k)
    }
    navPosRef.current = next
    if (!navBornAtRef.current) navBornAtRef.current = performance.now()
    // 打开初期（600ms 内）布局仍在稳定：只更新基线不做让位动画
    if (performance.now() - navBornAtRef.current < 600) return
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
    // 行开始让位：短暂锁定落点判定，避免动画期间抖动误判
    flipLockRef.current = (typeof performance !== 'undefined' ? performance.now() : Date.now()) + 120
    for (const m of moves) {
      m.el.style.transition = 'none'
      m.el.style.transform = 'translate(' + m.dx + 'px,' + m.dy + 'px)'
    }
    void document.body.offsetHeight
    requestAnimationFrame(() => {
      for (const m of moves) {
        m.el.style.transition = 'transform 200ms cubic-bezier(.2,.7,.3,1)'
        m.el.style.transform = ''
        navAnimElsRef.current.push(m.el)
      }
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [drag, over, closed, config])
  // 弹层关闭：终止进行中的让位动画并清基线（下次打开/展开不再 FLIP）
  useEffect(() => {
    if (open) return
    for (const el of navAnimElsRef.current) {
      el.style.transition = 'none'
      el.style.transform = ''
    }
    navAnimElsRef.current = []
    navPosRef.current = new Map()
  }, [open])

  // 旧配置迁移（幂等）：managedExcluded → navOrder（含入口保留 id）；等真实配置出现后执行
  useEffect(() => {
    const raw = scope.getSnapshot().value
    if (raw === undefined || Object.prototype.hasOwnProperty.call(raw, 'navOrder')) return
    const legacy = Array.isArray(raw.managedExcluded) ? raw.managedExcluded : []
    void scope.set('navOrder', [...legacy, NAV_HUB_ID])
  }, [scope, config])

  // 插件存在性快照：启动/配置/槽位变动时检查并更新 pluginExists（不存在 → false；其余配置保留）
  useEffect(() => {
    const raw = scope.getSnapshot().value
    if (raw === undefined) return
    if (navRows.length === 0) return // 槽位未就绪时跳过，避免误标
    const live = new Set(managedRows.map((r) => r.id))
    const refs = new Set<string>()
    for (const g of groups) for (const id of g.itemIds) refs.add(id)
    for (const id of config.ungroupedOrder ?? []) refs.add(id)
    for (const id of navArrayIds) if (!nativeSet.has(id)) refs.add(id) // 原生行恒在，不记录存在性
    const prev = config.pluginExists ?? {}
    const next: Record<string, boolean> = {}
    let changed = false
    for (const id of live) {
      if (prev[id] !== true) changed = true
      next[id] = true
    }
    for (const id of refs) {
      const v = live.has(id)
      if (prev[id] !== v) changed = true
      next[id] = v
    }
    if (changed) void scope.set('pluginExists', next)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scope, config, navRows, members, groups])

  const memberSorted = sortMembers(members)
  const memberIds = memberSorted.map((m) => memberId(m))
  const nativeSet = new Set<string>(NATIVE_SECTION_IDS)
  /** navOrder 数组段（不含入口保留 id）：释放的管控行 + 被拖入的原生行（原生默认在外，拖入后纳管） */
  const cfgHasNav = Object.prototype.hasOwnProperty.call(config, 'navOrder')
  const navArrayIds = (cfgHasNav ? config.navOrder ?? [] : config.managedExcluded ?? []).filter(
    (id) => id !== NAV_HUB_ID,
  )
  /** released = 数组段中的第三方管控 id（原生 id 不在其列） */
  const releasedArr = navArrayIds.filter((id) => !nativeSet.has(id))
  const releasedSet = new Set(releasedArr)
  const managedRows = navRows.filter(
    (r) => !nativeSet.has(r.id) && r.id !== 'mega-settings' && !memberIds.includes(r.id),
  )
  const managedById = new Map(managedRows.map((r) => [r.id, r]))
  /** navOrder 中的原生行（已纳管） */
  const arrayNatives = new Set(navArrayIds.filter((id) => nativeSet.has(id)))
  /** 顶区显示序 = 未纳管原生（规范序，默认在外） + navOrder 行 */
  const nativePresent: NavRowLike[] = NATIVE_SECTION_IDS.map((id) => navRows.find((r) => r.id === id)).filter(
    (x): x is NavRowLike => x !== undefined,
  )
  const topDisplayRows: NavRowLike[] = [
    ...nativePresent.filter((r) => !arrayNatives.has(r.id)),
    ...navArrayIds
      .map((id) => (nativeSet.has(id) ? navRows.find((r) => r.id === id) : managedById.get(id)))
      .filter((x): x is NavRowLike => x !== undefined),
  ]
  const visibleCustomCount = topDisplayRows.length
  /** 完整持久序（写回用）：未纳管原生 + navOrder（含缺失墓碑与已存原生）；hidden = 当前无行 */
  const fullTopIds: string[] = [
    ...nativePresent.filter((r) => !arrayNatives.has(r.id)).map((r) => r.id),
    ...navArrayIds,
  ]
  const topRowExists = (id: string): boolean =>
    nativeSet.has(id) ? nativePresent.some((r) => r.id === id) : managedById.has(id)

  /** 接管数组（折叠/收纳共享）——未分组条目：全部未分组（含 released，供收纳页用） */
  const ungroupedRawAll = ungroupedIds(managedRows.map((r) => r.id), groups)
  const ungroupedFull = orderedUngrouped(ungroupedRawAll, config.ungroupedOrder ?? [])
  const ungroupedVisible = ungroupedFull.filter((id) => !releasedSet.has(id))
  /** 折叠体可见列表（released 行隐藏，但保留在接管数组中） */
  const visibleOf = (ids: readonly string[]): NavRowLike[] =>
    ids
      .map((id) => managedById.get(id))
      .filter((x): x is NavRowLike => x !== undefined && !releasedSet.has(x.id))
  // 折叠体列出全部自定义组（含空组：标题行可新建后命名/被拖入）；mega/未分组仍按需派生
  const hasFoldContent = memberIds.length > 0 || groups.length > 0 || ungroupedVisible.length > 0

  useEffect(() => {
    if (open && target === null) {
      setTarget(mode === 'fold' ? { kind: 'section', id: NATIVE_SECTION_IDS[0] } : { kind: 'mega' })
    }
  }, [open, target, mode])
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open])
  // 弹层关闭时退出分组命名（避免下次打开残留编辑态）
  useEffect(() => {
    if (!open) setEditingGid(null)
  }, [open])

  const close = () => setOpen(false)

  /* ---------- 拖拽落点几何 ---------- */
  /** 指针坐标下的落点：插入条 data → 区号；行元素 → 上下半区；head → 收回原位 */

  const targetAt = (x: number, y: number, hit?: Element | null): OverTarget => {
    const root = navListRef.current
    const el = (hit ?? document.elementFromPoint(x, y)) as HTMLElement | null
    if (!root || !el || typeof el.closest !== 'function' || !root.contains(el)) return null
    const ztop = el.closest('.mgs-nav-zone')
    if (ztop) {
      const raw = Number(ztop.getAttribute('data-nav-o'))
      return Number.isFinite(raw) ? { k: 'nav', o: raw } : null
    }
    const zfold = el.closest('.mgs-fold-zone')
    if (zfold) {
      const lid = zfold.getAttribute('data-lid') ?? ''
      const raw = Number(zfold.getAttribute('data-o'))
      return lid && Number.isFinite(raw) ? { k: 'body', lid, o: raw } : null
    }
    if (el.closest('[data-foldhead]')) return null
    const rtop = el.closest('.mgs-nav-row')
    if (rtop) {
      const raw = Number(rtop.getAttribute('data-nav-i'))
      if (Number.isFinite(raw) && raw >= 0 && raw < visibleCustomCount) {
        const rect = rtop.getBoundingClientRect()
        return { k: 'nav', o: y >= rect.top + rect.height / 2 ? raw + 1 : raw }
      }
      return null
    }
    const rbody = el.closest('.mgs-fold-item[data-lid]')
    if (rbody) {
      const lid = rbody.getAttribute('data-lid') ?? ''
      const raw = Number(rbody.getAttribute('data-ridx'))
      if (!lid || !Number.isFinite(raw) || raw < 0) return null
      const rect = rbody.getBoundingClientRect()
      return { k: 'body', lid, o: y >= rect.top + rect.height / 2 ? raw + 1 : raw }
    }
    // 顶区行带兜底：拖拽中指针落在顶区行带内（行间间隙/行尾空隙，未直接命中行按钮）时，
    // 按最近行上/下半区给出单个落点，保证 navlist 任何位置都有虚线框反馈
    if (rowDragRef.current !== null) {
      const topEls = Array.from(root.querySelectorAll<HTMLElement>('.mgs-nav-row')).filter((rr) => {
        // 排除跟手的 fixed 源行（其矩形随指针移动，会伪造行带/最近行）
        if (rr.style.position === 'fixed') return false
        const raw = Number(rr.getAttribute('data-nav-i'))
        return Number.isFinite(raw) && raw >= 0 && raw < visibleCustomCount
      })
      if (topEls.length === 0) {
        // 顶区为空：指针在 nav 列内且不在折叠体/入口元素上 → 首位接收槽
        const rr = root.getBoundingClientRect()
        if (x >= rr.left && x <= rr.right && y >= rr.top && y <= rr.bottom) {
          const foreign = el.closest('.mgs-fold-item, [data-foldhead], .mgs-fold-sep')
          if (!foreign) return { k: 'nav', o: 0 }
        }
        return null
      }
      const first = topEls[0].getBoundingClientRect()
      const last = topEls[topEls.length - 1].getBoundingClientRect()
      // 兜底仅限行自身区间（含行间间隙）；行外（如折叠设置按钮上方）不出落点
      if (y < first.top || y > last.bottom) return null
      let bestEl: HTMLElement | null = null
      let bestD = Infinity
      for (const rr of topEls) {
        const rc = rr.getBoundingClientRect()
        const d = Math.abs(y - (rc.top + rc.height / 2))
        if (d < bestD) {
          bestD = d
          bestEl = rr
        }
      }
      if (bestEl === null) return null
      const raw = Number(bestEl.getAttribute('data-nav-i'))
      const rc = bestEl.getBoundingClientRect()
      return { k: 'nav', o: y >= rc.top + rc.height / 2 ? raw + 1 : raw }
    }
    return null
  }

  /* ---------- 提交 ---------- */
  const writeNavOrder = (custom: string[]): void => {
    void scope.set('navOrder', [...custom, NAV_HUB_ID])
  }
  const sameList = (a: readonly string[], b: readonly string[]): boolean =>
    a.length === b.length && a.every((x, i) => x === b[i])

  /** 顶区落点（释放 body→nav / 原生纳管 / 顶区重排统一）：
   *  按可见顶序槽位写入「完整持久序」（未纳管原生 + navOrder，缺失墓碑保留），
   *  释放只动顺序数组；接管数组不动。 */
  const commitTopDrop = (id: string, slot: number): void => {
    const rest = fullTopIds.filter((x) => x !== id)
    const next = placeVisible(rest, (x) => !topRowExists(x), id, slot)
    if (!sameList(next, fullTopIds)) writeNavOrder(next)
  }
  /** 接管（top → 折叠体 lid 槽）：接管数组旧位移除 → 目标槽插入；navOrder 移除（状态 true）。 */
  /** 折叠体行移动（body → body 槽）：同组排序/跨组移动/入未分组——仅改接管数组，状态与 navOrder 不动 */
  const commitBodyMove = (lid: string, id: string, slot: number): void => {
    const isU = lid === UNGROUPED_GID
    const targetGroup = isU ? undefined : groups.find((g) => g.id === lid)
    if (!isU && !targetGroup) return
    // 从原归属移除（组内重排时先去掉自身旧位；跨组时去掉源组旧位）
    const groupsNext = groups.map((g) =>
      g.itemIds.includes(id) ? { ...g, itemIds: g.itemIds.filter((x) => x !== id) } : g,
    )
    const orderBase = (config.ungroupedOrder ?? []).filter((x) => x !== id)
    let orderNext: string[] | null = null
    if (isU) {
      const raw = ungroupedIds(managedRows.map((r) => r.id), groupsNext)
      const fullU = expandUngroupedOrder(orderBase, raw)
      const hiddenU = (x: string): boolean =>
        releasedSet.has(x) || !managedById.has(x) || groupOf(x, groupsNext) !== null
      orderNext = placeVisible(fullU, hiddenU, id, slot)
    } else {
      const g2 = groupsNext.find((x) => x.id === lid)
      if (!g2) return
      const res = placeVisible(g2.itemIds, (x) => releasedSet.has(x) || !managedById.has(x), id, slot)
      groupsNext.splice(groupsNext.findIndex((x) => x.id === lid), 1, { ...g2, itemIds: res })
      if (!arrEq(orderBase, config.ungroupedOrder ?? [])) orderNext = orderBase
    }
    void scope.set('groups', groupsNext)
    if (orderNext !== null) void scope.set('ungroupedOrder', orderNext)
  }
  const commitTakeover = (lid: string, id: string, slot: number): void => {
    const isU = lid === UNGROUPED_GID
    const targetGroup = isU ? undefined : groups.find((g) => g.id === lid)
    if (!isU && !targetGroup) return
    const navNext = navArrayIds.filter((x) => x !== id)
    // 1) 接管数组旧位移除（groups / 未分组顺序）
    const groupsNext = groups.map((g) =>
      g.itemIds.includes(id) ? { ...g, itemIds: g.itemIds.filter((x) => x !== id) } : g,
    )
    const orderBase = (config.ungroupedOrder ?? []).filter((x) => x !== id)
    let orderNext: string[] | null = null
    if (isU) {
      const raw = ungroupedIds(managedRows.map((r) => r.id), groupsNext)
      // 存储全集（含缺失项墓碑）→ 按折叠可见槽落点；缺失/已释放/在组条目不入可见计数
      const fullU = expandUngroupedOrder(orderBase, raw)
      const hiddenU = (x: string): boolean =>
        releasedSet.has(x) || !managedById.has(x) || groupOf(x, groupsNext) !== null
      orderNext = placeVisible(fullU, hiddenU, id, slot)
    } else {
      const g2 = groupsNext.find((x) => x.id === lid)
      if (!g2) return
      const res = placeVisible(g2.itemIds, (x) => releasedSet.has(x) || !managedById.has(x), id, slot)
      groupsNext.splice(groupsNext.findIndex((x) => x.id === lid), 1, { ...g2, itemIds: res })
      if (!arrEq(orderBase, config.ungroupedOrder ?? [])) orderNext = orderBase
    }
    // 2) 状态 true：navOrder 移除
    writeNavOrder(navNext)
    // 3) 接管数组写回
    void scope.set('groups', groupsNext)
    if (orderNext !== null) void scope.set('ungroupedOrder', orderNext)
  }
  const commitDrop = (d: NonNullable<ShellDrag>, t: NonNullable<OverTarget>): void => {
    // 原生行只能参与顶区数组排序；不可拖入折叠体（非管控对象）
    if (nativeSet.has(d.id) && t.k !== 'nav') return
    if (t.k === 'nav') {
      const o = Math.max(0, Math.min(t.o, visibleCustomCount))
      commitTopDrop(d.id, o)
      return
    }
    if (d.kind === 'top') commitTakeover(t.lid, d.id, t.o)
    else commitBodyMove(t.lid, d.id, t.o)
  }

  /* ---------- 指针拖拽手势（原元素跟手；释放/接管提交在 endRowDrag） ---------- */
  const startRowDrag = (kind: 'top' | 'body', id: string): void => {
    rowDragRef.current = { kind, id }
    overRef.current = null
    setDrag({ kind, id })
    setOver(null)
  }
  /** 单次悬停判定（判定锁期间跳过；被 tickNavScroll 滚动后重算复用） */
  const hoverAt = (x: number, y: number): void => {
    if (flipLockRef.current > (typeof performance !== 'undefined' ? performance.now() : Date.now())) return
    const root = navListRef.current
    // 只做一次 elementFromPoint，结果同时供头行展开判定与落点判定（targetAt 复用）
    const el = document.elementFromPoint(x, y) as HTMLElement | null
    // 悬停「折叠设置」头行：不产生落点；若未展开则自动展开（随后即可继续落入折叠体）
    if (closedRef.current['$fold'] && root && el && typeof el.closest === 'function' && root.contains(el) && el.closest('[data-foldhead]')) {
      setClosed((c) => ({ ...c, $fold: false }))
      setOverState(null)
      return
    }
    const tg = targetAt(x, y, el)
    setOverState(tg)
  }
  const hoverRow = (x: number, y: number): void => {
    if (rowDragRef.current === null) return
    updateNavAutoScroll(x, y)
    hoverAt(x, y)
  }
  /** 导航列边缘自动滚动（拖拽靠近 navList 顶/底 48px 内；滚动后重算落点） */
  const stopNavScroll = (): void => {
    const s = navScrollRef.current
    if (s.raf !== 0) {
      cancelAnimationFrame(s.raf)
      s.raf = 0
    }
    s.dir = 0
    s.str = 0
  }
  const tickNavScroll = (): void => {
    const s = navScrollRef.current
    const xy = navXYRef.current
    const root = navListRef.current
    if (s.raf === 0 || xy === null || root === null) {
      stopNavScroll()
      return
    }
    const rect = root.getBoundingClientRect()
    const edge = 48
    let dir = 0
    let str = 0
    if (xy.y < rect.top + edge) {
      dir = -1
      str = Math.max(0, Math.min(1, (rect.top + edge - xy.y) / edge))
    } else if (xy.y > rect.bottom - edge) {
      dir = 1
      str = Math.max(0, Math.min(1, (xy.y - (rect.bottom - edge)) / edge))
    }
    if (dir === 0 || root.scrollHeight <= root.clientHeight + 2) {
      stopNavScroll()
      return
    }
    s.dir = dir
    s.str = str
    root.scrollTop += dir * Math.round(3 + 10 * str)
    hoverAt(xy.x, xy.y) // 内容已滚动 → 重算落点
    s.raf = requestAnimationFrame(tickNavScroll)
  }
  const updateNavAutoScroll = (x: number, y: number): void => {
    navXYRef.current = { x, y }
    const s = navScrollRef.current
    if (s.raf === 0) s.raf = requestAnimationFrame(tickNavScroll)
  }
  const endRowDrag = (): void => {
    stopNavScroll()
    navXYRef.current = null
    const d = rowDragRef.current
    const tg = overRef.current
    rowDragRef.current = null
    overRef.current = null
    setDrag(null)
    setOver(null)
    if (d !== null && tg !== null) commitDrop(d, tg)
  }

  /* ---------- 折叠体分组管理：新建 / 重命名（命名校验失败则静默取消，保持原样） ---------- */
  const commitGroupRename = (gid: string, raw: string): void => {
    setEditingGid(null)
    const name = raw.trim()
    if (!name || validateGroupName(name, groups.filter((g) => g.id !== gid))) return
    const next = groups.map((g) => (g.id === gid ? { ...g, name } : g))
    if (JSON.stringify(next) !== JSON.stringify(groups)) void scope.set('groups', next)
  }
  const addGroupInFold = (): void => {
    const gid = randomId()
    void scope.set('groups', [...groups, { id: gid, name: t ? t('group.unnamed') : '未命名', itemIds: [] }])
    setEditingGid(gid) // 创建后立即进入命名
  }
  /** 删除分组：组内项自动回到未分组（沿用收纳页语义，无确认） */
  const removeGroupInFold = (gid: string): void => {
    setEditingGid(null)
    void scope.set('groups', removeGroup(groups, gid))
  }

  const renderNav = (): ReactNode[] => {
    const rows: ReactNode[] = []
    /* —— 顶区（未纳管原生 + navOrder 行；悬停时单槽落点，悬停高亮） —— */
    const navStrip = (o: number, key: string): ReactNode => (
      <div
        key={key}
        data-nav-o={o}
        className={
          over !== null && over.k === 'nav' && over.o === o
            ? 'mgs-nav-zone mgs-nav-zone--over ' + C.navCell
            : 'mgs-nav-zone ' + C.navCell
        }
      />
    )
    if (visibleCustomCount === 0) {
      // 顶区为空：悬停顶区时显示默认接收框
      if (drag !== null && over !== null && over.k === 'nav') rows.push(navStrip(0, 'nz-slot'))
    } else {
      const srcTop =
        drag !== null && drag.kind === 'top' ? topDisplayRows.findIndex((x) => x.id === drag.id) : -1
      // 展示序：源行（fixed）置末；其余保持序
      const topItems: { it: NavRowLike; rank: number }[] = []
      if (srcTop >= 0) {
        let rank = 0
        topDisplayRows.forEach((x, i) => {
          if (i === srcTop) return
          topItems.push({ it: x, rank })
          rank += 1
        })
        topItems.push({ it: topDisplayRows[srcTop], rank })
      } else {
        topDisplayRows.forEach((x, i) => topItems.push({ it: x, rank: i }))
      }
      // 落点：仅悬停其他 button（over=nav）时，在其上/下半区对应的单个槽显示虚线框
      const overNav = drag !== null && over !== null && over.k === 'nav'
      const N = topItems.length - (srcTop >= 0 ? 1 : 0)
      const slotO = overNav ? Math.max(0, Math.min((over as { k: 'nav'; o: number }).o, N)) : -1
      topItems.forEach(({ it, rank }, pos) => {
        if (slotO === pos && pos <= N) rows.push(navStrip(slotO, 'nz-slot'))
        rows.push(
          <DragNavCell
            key={'x' + it.id}
            kind="top"
            id={it.id}
            label={it.label}
            icon={navIconOf(it.id)}
            active={target !== null && target.kind === 'section' && target.id === it.id}
            onClick={() => setTarget({ kind: 'section', id: it.id })}
            className="mgs-nav-row"
            dataNavI={rank}
            dataRowId={it.id}
            onStart={startRowDrag}
            onHover={hoverRow}
            onEnd={endRowDrag}
          />,
        )
      })
      if (slotO === N && slotO >= topItems.length) rows.push(navStrip(slotO, 'nz-slot'))
    }
    /* —— 入口行（fold = 折叠设置 + 折叠体；collect = 收纳配置） —— */
    if (mode === 'fold' && hasFoldContent) {
      rows.push(
        <GroupHead
          key="fold"
          label={t ? t('shell.foldGroup') : '折叠设置'}
          open={!closed['$fold']}
          onToggle={() => setClosed((c) => ({ ...c, $fold: !c.$fold }))}
        />,
      )
      if (!closed['$fold']) {
        const sub: ReactNode[] = []
        const foldStrip = (lid: string, o: number, key: string): ReactNode => (
          <div
            key={key}
            data-lid={lid}
            data-o={o}
            className={
              over !== null && over.k === 'body' && over.lid === lid && over.o === o
                ? 'mgs-fold-zone mgs-fold-zone--over'
                : 'mgs-fold-zone'
            }
          />
        )
        // mega 固组（分隔条 + 常显行：管控 + 成员；不可拖、不可作落点）
        sub.push(<GroupSeparator key="sep-mega" label={t ? t('group.mega') : 'mega'} />)
        sub.push(
          <NavCell
            key="mega-admin"
            className="mgs-fold-item"
            icon={<IconSettingsOutline16 size={16} />}
            label={t ? t('settings.center') : 'mega 设置'}
            active={target !== null && target.kind === 'mega'}
            onClick={() => setTarget({ kind: 'mega' })}
          />,
        )
        for (const m of memberSorted) {
          const id = memberId(m)
          sub.push(
            <NavCell
              key={'m' + id}
              className="mgs-fold-item"
              icon={<IconSettingsOutline16 size={16} />}
              label={memberLabel(m)}
              active={target !== null && target.kind === 'member' && target.id === id}
              onClick={() => setTarget({ kind: 'member', id })}
            />,
          )
        }
        // 自定义组（标题行 hover 显示改名；组内行可拖出释放；一级行拖入 = 接管落点槽；空组也可接收拖入）
        for (const g of groups) {
          const items = visibleOf(g.itemIds)
          sub.push(
            <GroupTitleRow
              key={'sep-' + g.id}
              g={g}
              editing={editingGid === g.id}
              tip={t ? t('group.rename') : '重命名分组'}
              removeTip={t ? t('group.remove') : '删除分组'}
              onStartEdit={() => setEditingGid(g.id)}
              onDelete={() => removeGroupInFold(g.id)}
              onCommit={(name) => commitGroupRename(g.id, name)}
              onCancel={() => setEditingGid(null)}
            />,
          )
          if (items.length === 0) {
            // 空分组：拖拽进行中常显整行宽接收槽（可接管/移入首位）
            if (drag !== null) {
              sub.push(
                <div
                  key={'bg-empty-' + g.id}
                  data-lid={g.id}
                  data-o={0}
                  className={
                    over !== null && over.k === 'body' && over.lid === g.id && over.o === 0
                      ? 'mgs-fold-zone mgs-fold-zone--over mgs-fold-zone-wide'
                      : 'mgs-fold-zone mgs-fold-zone-wide'
                  }
                />,
              )
            }
            continue
          }
          const srcI =
            drag !== null && drag.kind === 'body' ? items.findIndex((x) => x.id === drag.id) : -1
          // 组内仅剩被拖行 → 视作空组：整行宽接收槽（可移回首位）+ 被拖行仍挂载（fixed 跟手）
          const effEmpty = srcI >= 0 && items.length === 1
          if (effEmpty && drag !== null) {
            sub.push(
              <div
                key={'bg-eff-empty-' + g.id}
                data-lid={g.id}
                data-o={0}
                className={
                  over !== null && over.k === 'body' && over.lid === g.id && over.o === 0
                    ? 'mgs-fold-zone mgs-fold-zone--over mgs-fold-zone-wide'
                    : 'mgs-fold-zone mgs-fold-zone-wide'
                }
              />,
            )
          }
          const overBody =
            drag !== null && over !== null && over.k === 'body' && over.lid === g.id
          const N = items.length - (srcI >= 0 ? 1 : 0)
          const slotO = effEmpty
            ? -1
            : overBody
              ? Math.max(0, Math.min((over as { k: 'body'; lid: string; o: number }).o, N))
              : -1
          // 展示序：源行（fixed）置末
          const rowsNow: { it: NavRowLike; rank: number }[] = []
          let rank = 0
          items.forEach((it, ri) => {
            if (ri === srcI) return
            rowsNow.push({ it, rank })
            rank += 1
          })
          if (srcI >= 0) rowsNow.push({ it: items[srcI], rank })
          rowsNow.forEach(({ it, rank }, pos) => {
            if (!effEmpty && slotO === pos && pos <= N) sub.push(foldStrip(g.id, slotO, 'gz-slot'))
            sub.push(
              <DragNavCell
                key={'s' + it.id}
                kind="body"
                id={it.id}
                label={it.label}
                icon={<IconSettingsOutline16 size={16} />}
                active={target !== null && target.kind === 'section' && target.id === it.id}
                onClick={() => setTarget({ kind: 'section', id: it.id })}
                className="mgs-fold-item"
                dataLid={g.id}
                dataRidx={rank}
                dataRowId={it.id}
                onStart={startRowDrag}
                onHover={hoverRow}
                onEnd={endRowDrag}
              />,
            )
          })
          if (!effEmpty && slotO === N && slotO >= rowsNow.length) sub.push(foldStrip(g.id, slotO, 'gz-slot'))
        }
        // 未分组存在 → 其行尾 + 图标新建（新建组出现在其上方）；未分组不存在 → 「新建分组 ✎」伪标题行兜底
        if (ungroupedVisible.length === 0) {
          sub.push(
            <div
              key="fold-add-group"
              className="mgs-fold-sep mgs-fold-addrow"
              role="button"
              tabIndex={0}
              onClick={addGroupInFold}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault()
                  addGroupInFold()
                }
              }}
            >
              <span className="mgs-fold-addrow-label">{t ? t('group.add') : '新建分组'}</span>
              <IconEditMini />
            </div>,
          )
        }
        // 未分组（拖拽进行中即使为空也保持显示为接收槽）
        if (ungroupedVisible.length > 0) {
          const uRows = ungroupedVisible
            .map((id) => managedById.get(id))
            .filter((x): x is NavRowLike => x !== undefined)
          // 未分组标题行：文字后紧跟 +（点击在上方新建分组并进入命名）
          sub.push(
            <div key="sep-u" className="mgs-fold-sep mgs-fold-sep-u">
              <span>{t ? t('group.ungrouped') : '未分组'}</span>
              <button
                type="button"
                className="mgs-fold-addplus"
                title={t ? t('group.add') : '新建分组'}
                aria-label={t ? t('group.add') : '新建分组'}
                onClick={addGroupInFold}
              >
                <IconAddMini />
              </button>
            </div>,
          )
          const srcI =
            drag !== null && drag.kind === 'body' ? uRows.findIndex((x) => x.id === drag.id) : -1
          const overBody =
            drag !== null && over !== null && over.k === 'body' && over.lid === UNGROUPED_GID
          const N = uRows.length - (srcI >= 0 ? 1 : 0)
          const slotO = overBody ? Math.max(0, Math.min((over as { k: 'body'; lid: string; o: number }).o, N)) : -1
          const rowsNow: { it: NavRowLike; rank: number }[] = []
          let rank = 0
          uRows.forEach((it, ri) => {
            if (ri === srcI) return
            rowsNow.push({ it, rank })
            rank += 1
          })
          if (srcI >= 0) rowsNow.push({ it: uRows[srcI], rank })
          rowsNow.forEach(({ it, rank }, pos) => {
            if (slotO === pos && pos <= N) sub.push(foldStrip(UNGROUPED_GID, slotO, 'uz-slot'))
            sub.push(
              <DragNavCell
                key={'u' + it.id}
                kind="body"
                id={it.id}
                label={it.label}
                icon={<IconSettingsOutline16 size={16} />}
                active={target !== null && target.kind === 'section' && target.id === it.id}
                onClick={() => setTarget({ kind: 'section', id: it.id })}
                className="mgs-fold-item"
                dataLid={UNGROUPED_GID}
                dataRidx={rank}
                dataRowId={it.id}
                onStart={startRowDrag}
                onHover={hoverRow}
                onEnd={endRowDrag}
              />,
            )
          })
          if (slotO === N && slotO >= rowsNow.length) sub.push(foldStrip(UNGROUPED_GID, slotO, 'uz-slot'))
        } else if (drag !== null) {
          // 空未分组：拖拽中常显「未分组」接收槽（整行宽；可释放也可移入）
          sub.push(<GroupSeparator key="sep-u" label={t ? t('group.ungrouped') : '未分组'} />)
          sub.push(
            <div
              key="bzu-empty"
              data-lid={UNGROUPED_GID}
              data-o={0}
              className={
                over !== null && over.k === 'body' && over.lid === UNGROUPED_GID && over.o === 0
                  ? 'mgs-fold-zone mgs-fold-zone--over mgs-fold-zone-wide'
                  : 'mgs-fold-zone mgs-fold-zone-wide'
              }
            />,
          )
        }
        rows.push(
          <div key="fold-body" className="mgs-fold-body">
            {sub}
          </div>,
        )
      }
    } else {
      rows.push(
        <NavCell
          key="mega"
          icon={<IconSettingsOutline16 size={16} />}
          label={mode === 'collect' ? (t ? t('shell.navCollect') : '收纳配置') : t ? t('settings.center') : 'mega 设置'}
          active={target !== null && target.kind === 'mega'}
          onClick={() => setTarget({ kind: 'mega' })}
        />,
      )
    }
    return rows
  }

  const renderContent = (): ReactNode => {
    if (target === null) return null
    if (target.kind === 'mega') {
      return <SettingsCenter scope={scope} slots={slots} renderSlot={renderSlot} t={t} />
    }
    if (target.kind === 'member') {
      // options 内容区不叠加插件标题（官方成员页自带页头）
      const page = renderSlot?.(MEMBER_PAGE_SEAT, undefined, { entryKey: target.id })
      return (
        <>
          {page ?? (
            <p className="mgs-placeholder">{t ? t('settings.pageMissing') : '该成员尚未提供配置页'}</p>
          )}
        </>
      )
    }
    // section：原生或第三方分区（MiniRenderer 原样渲染；不叠加标题行）
    return <MiniSectionContent slots={slots.mini} sectionId={target.id} ownerProps={{ close }} />
  }
  /* ============ 弹层（官方 SettingsPanel 结构复刻） ============ */
  return (
    <>
      <div className={cls(C.triggerRow, !props.wide && C.railRow)}>
        <button
          type="button"
          className={cls(C.trigger, !props.wide && C.rail)}
          aria-haspopup="dialog"
          aria-expanded={open}
          onClick={() => {
            // 每次打开恢复折叠设置默认收起
            setClosed({ $fold: true })
            setOpen(true)
          }}
        >
          {props.wide ? <IconSettingsOutline16 size={16} /> : <IconSettingsOutline14 size={18} />}
          {props.wide ? <span className={C.triggerLabel}>{t ? t('shell.trigger') : '设置'}</span> : null}
        </button>
      </div>
      {open ? (
        <div className={C.overlay} role="presentation">
          <div className={C.mask} aria-hidden="true" onClick={close} />
          <div className={C.panel} role="dialog" aria-modal="true">
            <nav className={C.nav}>
              <div className={C.navTitle}>{t ? t('shell.trigger') : '设置'}</div>
              <div className={C.navList} ref={navListRef}>
                {renderNav()}
              </div>
            </nav>
            <div className={C.content}>
              <div className={C.header}>
                <div className={C.actions} />
                <button type="button" className={C.close} onClick={close}>
                  <IconCloseOutline16 size={14} />
                  <span className={C.hiddenLabel}>{t ? t('shell.close') : '关闭'}</span>
                </button>
              </div>
              <div className={cls(C.options, target !== null && target.kind === 'mega' && 'mgs-options-mega')}>
                {renderContent()}
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </>
  )
}