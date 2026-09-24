/**
 * mega 优化页（OptimizeCenter）：收纳「对第三方插件的优化」开关。
 *
 * 数据流：开关落自身配置 optToggles（key = optimize.ts 注册表 id），数值落 optValues；
 * 效果由 optimize-effects.syncOptimizeEffects 同步（样式标签 + JS 效果，SettingsShell
 * 常驻同步 + 本页变更即写）。**dsh 界面组**恒显示；**每个第三方插件独立一个 mgs-panel**，
 * 目标插件未安装 → 面板不显示、其效果也不注入（installed 过滤）。
 *
 * 新增优化 = 在 optimize.ts 追加一条 def（+ 词条 + 效果），页面自动归入 dsh 组或对应插件面板。
 */
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import type { MegaSettingsConfig } from '../schema.ts'
import type { SettingsPathOpView } from '../schema.ts'
import {
  optimizeByGroup,
  optimizeEnabled,
  optimizePluginGroups,
  optimizeSectionEnabled,
  optimizeValue,
  type OptimizeDef,
} from './optimize.ts'
import { syncOptimizeEffects } from './optimize-effects.ts'
import { useVersions } from './versions.ts'

/** 页面注入面：自身配置 scope + slots 业务面（插件启用检测用）。 */
interface OptimizeCenterInjected {
  scope: {
    getSnapshot(): { value?: MegaSettingsConfig }
    subscribe(listener: () => void): () => void
    set(field: string, value: unknown): Promise<unknown>
    /** 0.1.7 路径级写入：按 path 合并，避免整对象读-改-写竞争（连点两个开关互相覆盖） */
    mutate(ops: readonly SettingsPathOpView[], expectedRevision?: number): Promise<unknown>
  }
  slots?: {
    sections(): readonly { id?: string; options?: { id?: string } }[]
    mini: { subscribe(key: string, fn: () => void): () => void }
    onSlotsChanged(fn: (key: string) => void): () => void
  }
}

interface OptimizeCenterProps extends OptimizeCenterInjected {
  t?: (key: string, params?: Record<string, string>) => string
}

function useScopeValue(scope: OptimizeCenterInjected['scope']): MegaSettingsConfig | undefined {
  const [, force] = useState(0)
  useEffect(() => scope.subscribe(() => force((n) => n + 1)), [scope])
  return scope.getSnapshot().value
}

/** 已启用插件的 settings.section id 集合（订阅 settings.section 槽，插件装卸实时刷新）。 */
function useActiveSections(slots: OptimizeCenterInjected['slots']): { set: Set<string>; sig: string } {
  const [, force] = useState(0)
  useEffect(() => {
    if (!slots) return
    const a = slots.mini.subscribe('settings.section', () => force((n) => n + 1))
    const b = slots.onSlotsChanged((key) => {
      if (key === 'settings.section') force((n) => n + 1)
    })
    return () => {
      a()
      b()
    }
  }, [slots])
  const ids: string[] = []
  for (const e of slots?.sections() ?? []) {
    const id = e.options?.id ?? e.id ?? ''
    if (id && !ids.includes(id)) ids.push(id)
  }
  const sig = ids.join('|')
  const set = useMemo(() => new Set(ids), [sig])
  return { set, sig }
}

/** 开关（复用 mgs-switch 体系；sm = 行内小开关）。 */
function Switch(props: { checked: boolean; onChange: (v: boolean) => void; title?: string }) {
  return (
    <label className="mgs-switch mgs-switch--sm" title={props.title}>
      <input type="checkbox" checked={props.checked} onChange={(e) => props.onChange(e.target.checked)} />
      <span className="mgs-switch-track">
        <span className="mgs-switch-thumb" />
      </span>
    </label>
  )
}

/** 单条优化行：名称 + 描述 + 开关（面板只对已安装插件显示，行内无需安装态）。 */
function OptimizeRow(props: {
  def: OptimizeDef
  enabled: boolean
  t: (key: string) => string
  onToggle: (on: boolean) => void
}) {
  const { def, t } = props
  return (
    <div className="mgs-opt-row">
      <div className="mgs-opt-info">
        <span className="mgs-opt-name">{t(def.nameKey)}</span>
        <span className="mgs-opt-desc">{t(def.descKey)}</span>
      </div>
      <Switch checked={props.enabled} onChange={props.onToggle} />
    </div>
  )
}

/**
 * 滑块行（0-100；带 defaultValue 的优化项在开关行下渲染）。
 * 用本地乐观草稿值避免「受控值 → 设置 RPC 往返」把滑块回拉（跟手慢）；
 * 写入防抖 120ms，松手/失焦立即提交（背景等效果即时生效）。
 */
function SliderRow(props: { label: string; value: number; max?: number; onChange: (v: number) => void }) {
  const [draft, setDraft] = useState(props.value)
  const draggingRef = useRef(false)
  const latestRef = useRef(props.value)
  const timerRef = useRef(0)

  // 外部值变化（如提交后回写）且未在拖动 → 同步草稿；拖动中不回拉
  useEffect(() => {
    if (!draggingRef.current) setDraft(props.value)
  }, [props.value])

  const flush = (): void => {
    window.clearTimeout(timerRef.current)
    timerRef.current = 0
    props.onChange(latestRef.current)
  }
  const schedule = (v: number): void => {
    latestRef.current = v
    window.clearTimeout(timerRef.current)
    timerRef.current = window.setTimeout(flush, 120)
  }

  return (
    <div className="mgs-opt-slider">
      <span className="mgs-opt-slider-label">{props.label}</span>
      <input
        type="range"
        min={0}
        max={props.max ?? 100}
        step={1}
        value={draft}
        onChange={(e) => {
          const v = Number(e.target.value)
          setDraft(v)
          schedule(v)
        }}
        onPointerDown={() => {
          draggingRef.current = true
        }}
        onPointerUp={() => {
          draggingRef.current = false
          flush()
        }}
        onBlur={() => {
          draggingRef.current = false
          flush()
        }}
      />
      <span className="mgs-opt-slider-value">{draft}%</span>
    </div>
  )
}

/** 数字输入框行（无上限数值如层级；本地草稿防回拉，防抖 200ms + 失焦/Enter 提交）。 */
function NumberInputRow(props: { label: string; value: number; onChange: (v: number) => void }) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [draft, setDraft] = useState(String(props.value))
  const draftRef = useRef(String(props.value))
  const timerRef = useRef(0)

  useEffect(() => {
    if (inputRef.current !== document.activeElement) setDraft(String(props.value))
  }, [props.value])

  const flush = (): void => {
    window.clearTimeout(timerRef.current)
    timerRef.current = 0
    const n = Math.max(0, Math.round(Number(draftRef.current)))
    if (Number.isFinite(n) && draftRef.current.trim() !== '') props.onChange(n)
    else setDraft(String(props.value))
  }
  const schedule = (v: string): void => {
    draftRef.current = v
    setDraft(v)
    window.clearTimeout(timerRef.current)
    timerRef.current = window.setTimeout(flush, 200)
  }

  return (
    <div className="mgs-opt-slider">
      <span className="mgs-opt-slider-label">{props.label}</span>
      <input
        ref={inputRef}
        type="number"
        min={0}
        step={1}
        className="mgs-opt-number"
        value={draft}
        onChange={(e) => schedule(e.target.value)}
        onBlur={flush}
        onKeyDown={(e) => {
          if (e.key === 'Enter') flush()
        }}
      />
    </div>
  )
}

/** 选项组行（分段选择，如峰值时段颜色 warn/danger/error）。 */
function ChoiceRow(props: {
  label: string
  choices: readonly { value: string; labelKey: string }[]
  value: number
  t: (key: string) => string
  onChange: (v: number) => void
}) {
  return (
    <div className="mgs-opt-slider">
      <span className="mgs-opt-slider-label">{props.label}</span>
      <div className="mgs-seg" role="radiogroup">
        {props.choices.map((c, i) => (
          <button
            key={c.value}
            type="button"
            role="radio"
            aria-checked={i === props.value}
            className={i === props.value ? 'mgs-seg-item mgs-seg-active' : 'mgs-seg-item'}
            onClick={() => props.onChange(i)}
          >
            {props.t(c.labelKey)}
          </button>
        ))}
      </div>
    </div>
  )
}

/** 优化项区块：开关行 + （可选的）滑块行 / 选项组行。 */
function DefBlock(props: {
  def: OptimizeDef
  enabled: boolean
  value: number | undefined
  t: (key: string) => string
  onToggle: (on: boolean) => void
  onValue: (v: number) => void
}) {
  const { def } = props
  return (
    <>
      <OptimizeRow def={def} enabled={props.enabled} t={props.t} onToggle={props.onToggle} />
      {props.value !== undefined ? (
        def.choices && def.choices.length > 0 ? (
          <ChoiceRow
            label={props.t(def.choiceLabelKey ?? 'opt.value.transparency')}
            choices={def.choices}
            value={props.value}
            t={props.t}
            onChange={props.onValue}
          />
        ) : def.numberInput ? (
          <NumberInputRow
            label={props.t(def.valueLabelKey ?? 'opt.value.transparency')}
            value={props.value}
            onChange={props.onValue}
          />
        ) : (
          <SliderRow
            label={props.t(def.valueLabelKey ?? 'opt.value.transparency')}
            value={props.value}
            max={def.maxValue}
            onChange={props.onValue}
          />
        )
      ) : null}
    </>
  )
}

/** 可折叠面板：默认折叠；点击头部展开/收起（头部为 role=button，内部可容纳跳转按钮）。 */
function CollapsiblePanel(props: { title: ReactNode; extra?: ReactNode; children: ReactNode }) {
  const [open, setOpen] = useState(false)
  return (
    <div className="mgs-panel">
      <div
        role="button"
        tabIndex={0}
        className="mgs-opt-panel-head"
        onClick={() => setOpen((o) => !o)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault()
            setOpen((o) => !o)
          }
        }}
        aria-expanded={open}
      >
        <span className="mgs-panel__title">{props.title}</span>
        {props.extra}
        <span className={'mgs-opt-chevron' + (open ? ' mgs-opt-chevron--open' : '')} aria-hidden="true">
          ›
        </span>
      </div>
      {open ? <div className="mgs-panel__body">{props.children}</div> : null}
    </div>
  )
}

/** 仓库跳转按钮（点击才跳转；不触发展开/收起）。 */
function LinkButton(props: { url: string }) {
  return (
    <button
      type="button"
      className="mgs-opt-link-btn"
      title="GitHub"
      aria-label="GitHub"
      onClick={(e) => {
        e.stopPropagation()
        window.open(props.url, '_blank', 'noreferrer')
      }}
    >
      <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M6.5 3.5H3.5v9h9V9.5" />
        <path d="M8.5 7.5L13 3" />
        <path d="M9.5 3h3.5v3.5" />
      </svg>
    </button>
  )
}

export function OptimizeCenter(props: OptimizeCenterProps) {
  const tr = props.t ?? ((key: string) => key)
  const config = useScopeValue(props.scope)
  const { versions } = useVersions()
  const installed = new Set(Object.keys(versions))
  const { set: activeSections, sig: sectionsSig } = useActiveSections(props.slots)
  // 效果常驻同步（client/index.ts 的 apply 常驻同步；此处用最新已装 + 已启用集合再校正一次）
  useEffect(() => {
    syncOptimizeEffects(config, installed, activeSections)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [config, versions, sectionsSig])
  // 路径级写入（0.1.7 官方同款）：逐个字段 merge，避免整对象读-改-写竞争（连点两个开关互相覆盖）
  const setToggle = (id: string, on: boolean): void => {
    void props.scope.mutate([{ op: 'set', path: ['optToggles', id], value: on }])
  }
  const setValue = (id: string, v: number): void => {
    void props.scope.mutate([{ op: 'set', path: ['optValues', id], value: v }])
  }
  const renderDef = (def: OptimizeDef): ReactNode => (
    <DefBlock
      key={def.id}
      def={def}
      enabled={optimizeEnabled(config, def.id)}
      value={optimizeValue(config, def.id)}
      t={tr}
      onToggle={(on) => setToggle(def.id, on)}
      onValue={(v) => setValue(def.id, v)}
    />
  )

  // 每个已安装且已启用的插件 = 一个独立面板（未安装 / 未启用不显示）
  const pluginPanels = optimizePluginGroups().filter(
    (g) => versions[g.plugin] !== undefined && g.defs.every((d) => optimizeSectionEnabled(activeSections, d)),
  )

  // 布局：无控件的开关项排前，带控件（滑块/数字框/选项组）的排后，视觉更整齐
  const hasControl = (d: OptimizeDef): boolean => d.defaultValue !== undefined
  const sortDefs = (defs: readonly OptimizeDef[]): OptimizeDef[] =>
    [...defs].sort((a, b) => Number(hasControl(a)) - Number(hasControl(b)))

  // dsh 界面组（恒显示；空则不渲染）：一般区 + 左侧边栏 + 右侧边栏子区
  const dshDefs = optimizeByGroup('dsh')
  const dshGeneral = sortDefs(dshDefs.filter((d) => !d.dshSection))
  const dshLeftbar = sortDefs(dshDefs.filter((d) => d.dshSection === 'leftbar'))
  const dshRightbar = sortDefs(dshDefs.filter((d) => d.dshSection === 'rightbar'))

  return (
    // 成员页：宿主（SettingsCenter/折叠壳）已在外层渲染徽章头与返回键，这里只渲染内容面板
    <div className="mgs-opt-page" data-mega-settings-root>
      {dshDefs.length > 0 ? (
        <CollapsiblePanel title={tr('opt.group.dsh')}>
          {dshGeneral.map((def) => renderDef(def))}
          {dshLeftbar.length > 0 ? (
            <>
              <div className="mgs-opt-subhead">{tr('opt.group.dshLeftbar')}</div>
              {dshLeftbar.map((def) => renderDef(def))}
            </>
          ) : null}
          {dshRightbar.length > 0 ? (
            <>
              <div className="mgs-opt-subhead">{tr('opt.group.dshRightbar')}</div>
              {dshRightbar.map((def) => renderDef(def))}
            </>
          ) : null}
        </CollapsiblePanel>
      ) : null}
      {pluginPanels.map((g) => (
        <CollapsiblePanel
          key={g.plugin}
          title={tr(g.titleKey ?? g.plugin)}
          extra={
            <>
              {versions[g.plugin] ? <span className="mgs-opt-target">{versions[g.plugin]}</span> : null}
              {g.url ? <LinkButton url={g.url} /> : null}
            </>
          }
        >
          {sortDefs(g.defs).map((def) => renderDef(def))}
        </CollapsiblePanel>
      ))}
      <p className="mgs-hint">{tr('opt.restart.hint')}</p>
    </div>
  )
}
