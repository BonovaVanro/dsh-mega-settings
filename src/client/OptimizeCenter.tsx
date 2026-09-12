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
    set(field: string, value: unknown): Promise<void>
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
function SliderRow(props: { label: string; value: number; onChange: (v: number) => void }) {
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
        max={100}
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

/** 优化项区块：开关行 + （可选的）滑块行。 */
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
        <SliderRow label={props.t('opt.value.transparency')} value={props.value} onChange={props.onValue} />
      ) : null}
    </>
  )
}

export function OptimizeCenter(props: OptimizeCenterProps) {
  const tr = props.t ?? ((key: string) => key)
  const config = useScopeValue(props.scope)
  const { versions } = useVersions()
  const installed = new Set(Object.keys(versions))
  const { set: activeSections, sig: sectionsSig } = useActiveSections(props.slots)
  // 效果常驻同步（SettingsShell 亦同步；此处用最新已装 + 已启用集合再校正一次）
  useEffect(() => {
    syncOptimizeEffects(config, installed, activeSections)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [config, versions, sectionsSig])
  const toggles = config?.optToggles ?? {}
  const setToggle = (id: string, on: boolean): void => {
    const next = { ...toggles, [id]: on }
    void props.scope.set('optToggles', next)
  }
  const values = config?.optValues ?? {}
  const setValue = (id: string, v: number): void => {
    const next = { ...values, [id]: v }
    void props.scope.set('optValues', next)
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

  // dsh 界面组（恒显示；空则不渲染）
  const dshDefs = optimizeByGroup('dsh')

  return (
    // 成员页：宿主（SettingsCenter/折叠壳）已在外层渲染徽章头与返回键，这里只渲染内容面板
    <div className="mgs-opt-page" data-mega-settings-root>
      {dshDefs.length > 0 ? (
        <div className="mgs-panel">
          <div className="mgs-panel__head">
            <span className="mgs-panel__title">{tr('opt.group.dsh')}</span>
          </div>
          {dshDefs.map((def) => renderDef(def))}
        </div>
      ) : null}
      {pluginPanels.map((g) => (
        <div className="mgs-panel" key={g.plugin}>
          <div className="mgs-panel__head">
            <span className="mgs-panel__title">{tr(g.titleKey ?? g.plugin)}</span>
            {versions[g.plugin] ? <span className="mgs-opt-target">{versions[g.plugin]}</span> : null}
          </div>
          {g.defs.map((def) => renderDef(def))}
        </div>
      ))}
      <p className="mgs-hint">{tr('opt.restart.hint')}</p>
    </div>
  )
}
