# Changelog

## 0.2.0-rc.2-update.2（dsh-better-sidebar：新增「隐藏上下文诊断按钮」）

[中文](#cn-v0.2.0-rc.2-update.2) | [English](#en-v0.2.0-rc.2-update.2)

<h3 id="cn-v0.2.0-rc.2-update.2">适配与变更</h3>

- **dsh-better-sidebar 新增「隐藏上下文诊断按钮」**：对应插件里可选的「上下文诊断」入口（`contextDiagnostics: '上下文诊断'`），稳定标记为 `data-dsh-ctx-entry`（插件自带的 `DIAGNOSTICS_ENTRY_ATTR`，入口不可用时该属性不出现）→ `[data-dsh-ctx-entry]{display:none!important}`。frame 级诊断告警（`data-dsh-ctx-alert`）不受影响。仅在 better-sidebar ≥0.26 存在该入口（更早版本规则自然空转）。
- **「隐藏底部面板切换钮」改名为「隐藏底部面板按钮」**（行为不变，仍是 `[data-dsh-bottom-toggle]`）。

<h3 id="en-v0.2.0-rc.2-update.2">Adaptation &amp; changes</h3>

- **New "Hide context diagnostics button" for dsh-better-sidebar**: targets the optional "Context diagnostics" entry (`contextDiagnostics`), whose stable marker is `data-dsh-ctx-entry` (the plugin's own `DIAGNOSTICS_ENTRY_ATTR`; absent when the entry is not offered) → `[data-dsh-ctx-entry]{display:none!important}`. The frame-wide diagnostics alert (`data-dsh-ctx-alert`) is unaffected. The entry only exists in better-sidebar ≥0.26, so on older versions the rule is simply inert.
- **Renamed "Hide bottom-panel toggle" to "Hide bottom-panel button"** (behaviour unchanged; still `[data-dsh-bottom-toggle]`).

## 0.2.0-rc.2-update.1（桌面版适配补全 · 「正文」分区 · 原生窗口按钮）

[中文](#cn-v0.2.0-rc.2-update.1) | [English](#en-v0.2.0-rc.2-update.1)

<h3 id="cn-v0.2.0-rc.2-update.1">适配与变更</h3>

- **新增「桌面版」分类，仅桌面壳可见**：桌面专属项带 `desktopOnly` —— 在 web 端**不注册、不展示、不注入**（不是隐藏，而是根本不进注册表）。平台判据由 `src/client/platform.ts` 提供：`<html data-platform>`、`<html data-windows-titlebar>`、`location.protocol === 'dsh-app:'` 任一成立即为桌面壳。
- **原生窗口按钮透明（「窗口标题背景跟随左侧边栏」）**：官方 preload 会往 body 追加一个隐藏 span 作**取色探针**，其 `background-color: var(--dsw-specific-sidebar-fill)` 的计算值就是最小化/最大化/关闭三个按钮的底色。本插件把该探针的取值源**重定向**到自有变量 `--mgs-button-fill`（带兜底），再由 body 行内的 `rgba(0, 0, 0, 0)` 决定按钮透明；**主题变量全程不被修改**，因此按钮与侧栏、标题条互不干扰。透明用"计算后"形态，可过主进程「只接受 `#hex` / `rgb()`/`rgba()`」的校验；探针被主题切换重建时会自动重新接管。
- **新增「框架上内边距移除」**（桌面版，默认关闭）：`[data-windows-titlebar] …_frame{padding-top:0!important}`，去掉官方为 Windows 拖拽条预留的 40px。
- **新增「正文」分区**（两端可见，排在「左侧边栏」之前）：
  - **背景颜色统一化**：中心列 `[data-dsh-surface="conversation"]` 与会话根 `[data-slot="main.conversation"] > [class*="_root"]` 都铺了主题底色，此开关**只保留所选的那一层**（另一层 `background:none!important`）；
  - **背景透明度**：把所选层背景按比例混向透明；若统一化未开启则两层同时生效，开启则只作用于保留层并兜底清空另一层；
  - **文件预览背景透明度**：原「正文编辑文件预览背景透明度」改名并上移；
  - **头部背景移除**：`#root [data-slot="main.conversation"] header{background:none!important}`，消除头部与正文的色差。
- **新增「框架背景透明度」**：内容区框架 `#root [data-slot="root"] > [class*="_frame"]` 背景按比例混向透明，两端可见。
- **左侧边栏两项升级**：「背景颜色统一化」改为**保留层可选**（侧栏列 / 侧栏根），「背景透明度」作用范围随统一化的开关与所选层自动切换；颜色源改用 `color-mix`，默认值 25 → 30（≈ 官方 `…/0.25` 观感），语义不变：数值越大越透明。
- **选择器全面 hash 无关化**（桌面版构建的 CSS-module hash 前缀与 web 不同，硬编码类名在桌面端命中 0）：
  - 侧栏列 `#root [class*="_sidebarCol"]`；侧栏模块根 `#root [data-slot="sidebar"] > [class*="_root"]`（裸 `[class*="_root"]` 会命中数百个元素，已避免）；
  - 底部动作区 `[class*="_footerActions"]`；全屏隐藏正文工具栏 `[class*="_headerUtilities"]`；
  - Markdown 表格限宽改用 `.md-table-wide,[class*="_tableScroll"]` 两点覆盖。
- **「打开右侧栏默认全屏」不再来回横跳**：不再依赖 `[data-rightbar-fullscreen]`（两端实测命中 0），改为**看按钮文案**（「全屏」/「退出全屏」）+ **面板几何**判断，避免每次打开都切换一次。
- **底部动作区布局不再依赖折叠态标记**：两端都没有 `[data-sidebar-collapsed]`，改为无条件生效。
- **设置弹层默认页**：打开时若尚未选中任何页，默认停在**「通用设置」**（若该分区当前不在导航里，则退到第一个可见分区），只影响默认选中、不写配置。
- **cost-meter 新增两项**（面板内按需开启，默认关闭）：**背景透明度**（`.cm-footer-stack.simple` 及其内部行，混合主题 layer-1）；**边框移除**（同选择器 `border:none`）。
- **可诊断性**：`window.__MGS_DEBUG__()` 输出**优化锚点自检**（逐项列出选择器与 JS 效果锚点的当前命中数，用于换版后判断"锚点没匹配"还是"被官方样式压过"）；另挂 `window.__MGS_SYNC_LOG__(n)` 记录同步决策（本项值 / 兄弟值 / 生成样式）。

<h3 id="cn-v0.2.0-rc.2-update.1-removed">移除</h3>

- **「技能中心」主题适配项**（`@linxin666/dsh-client-ui-skill-explorer`）：该插件自身已完善主题/皮肤适配，不再需要本插件用 hash 类覆盖其样式；其面板不再出现，相关词条一并删除。

<h3 id="en-v0.2.0-rc.2-update.1">Adaptation &amp; changes</h3>

- **New "Desktop app" section, visible only in the desktop shell**: desktop-only items carry `desktopOnly` — on web they are **not registered, not listed and not injected** (not merely hidden). The platform check lives in `src/client/platform.ts`: any of `<html data-platform>`, `<html data-windows-titlebar>` or `location.protocol === 'dsh-app:'` marks the desktop shell.
- **Native window buttons become transparent ("Titlebar background follows the left sidebar")**: the official preload appends a hidden span to `body` as its **colour probe**; the computed value of its `background-color: var(--dsw-specific-sidebar-fill)` is exactly the button background. This plugin **redirects** the probe to its own variable `--mgs-button-fill` (with fallback) and drives transparency from an inline `rgba(0, 0, 0, 0)` on `body`; **the theme variable is never modified**, so buttons, sidebar and titlebar stay independent. The transparent value is emitted in computed form so it passes the main process check (it only accepts `#hex` / `rgb()`/`rgba()`), and the probe is re-adopted whenever a theme switch recreates it.
- **New "Remove frame top padding"** (desktop only, off by default): `[data-windows-titlebar] …_frame{padding-top:0!important}`, dropping the 40px the app reserves for the Windows drag strip.
- **New "Content" section** (both platforms, placed above "Left sidebar"):
  - **Unify background color**: both the centre column `[data-dsh-surface="conversation"]` and the conversation root `[data-slot="main.conversation"] > [class*="_root"]` paint the theme background; this keeps **only the selected layer** (`background:none!important` on the other);
  - **Background transparency**: blends the kept layer's background toward transparent; with unification off both layers are blended, with it on only the kept layer is (and the other is cleared as a fallback);
  - **File preview background transparency**: the former "Editor file preview background transparency", renamed and moved up;
  - **Remove conversation header background**: `#root [data-slot="main.conversation"] header{background:none!important}`, removing the colour difference between header and body.
- **New "Frame background transparency"**: blends the content frame `#root [data-slot="root"] > [class*="_frame"]` background toward transparent, available on both platforms.
- **Left sidebar upgrades**: "Unify background color" now lets you **choose which layer to keep** (sidebar column / sidebar root), and "Background transparency" follows that choice and the unification switch; the colour source uses `color-mix` and the default moved 25 → 30 (≈ the official `…/0.25` look). Semantics unchanged: higher = more transparent.
- **All selectors are now hash-agnostic** (the desktop build uses different CSS-module hash prefixes, so hard-coded class names matched nothing there):
  - sidebar column `#root [class*="_sidebarCol"]`; sidebar module root `#root [data-slot="sidebar"] > [class*="_root"]` (a bare `[class*="_root"]` matches hundreds of elements and is avoided);
  - footer actions `[class*="_footerActions"]`; hide body header utilities in fullscreen `[class*="_headerUtilities"]`;
  - markdown table max-width now covers both `.md-table-wide,[class*="_tableScroll"]`.
- **"Open the right sidebar in fullscreen by default" no longer oscillates**: it no longer relies on `[data-rightbar-fullscreen]` (measured 0 on both platforms) but reads the **button label** ("全屏" / "退出全屏") plus **panel geometry**, so opening no longer toggles fullscreen every time.
- **Bottom actions layout no longer depends on a collapsed marker**: neither platform exposes `[data-sidebar-collapsed]`, so the rules apply unconditionally.
- **Settings dialog default page**: when opened with nothing selected it lands on **General** (or the first visible section if General is not currently in the nav); this only affects the initial selection and writes no config.
- **Two new cost-meter options** (opt-in, off by default): **Background transparency** (`.cm-footer-stack.simple` and its inner rows, blended with the theme layer-1 colour) and **Remove border** (`border:none` on the same selector).
- **Diagnostics**: `window.__MGS_DEBUG__()` prints an **optimization anchor self-check** (per-item match counts for injected selectors and JS-effect anchors, to tell "anchor not found" from "overridden by upstream CSS" after an upgrade); `window.__MGS_SYNC_LOG__(n)` records sync decisions (own value / sibling values / generated CSS).

<h3 id="en-v0.2.0-rc.2-update.1-removed">Removed</h3>

- **The "Skill explorer" theme adaptation** (`@linxin666/dsh-client-ui-skill-explorer`): that plugin now handles theme/skin adaptation itself, so this plugin no longer overrides its styles through hashed classes; its panel no longer appears and the related locale entries are gone.

## 0.2.0-rc.2（适配官方 DSH 桌面版：设置入口在用户菜单里 · 一份包同时适配桌面与 web）

[中文](#cn-v0.2.0-rc.2) | [English](#en-v0.2.0-rc.2)

<h3 id="cn-v0.2.0-rc.2">适配与变更</h3>

- **适配官方 DSH 桌面版**：桌面版把官方设置入口挪进了左侧边栏底部的「用户按钮 + 菜单」（`sidebar.settings` 由官方 `dsh-client-ui-settings-general` 占住，用户按钮/菜单由 `dsh-client-ui-settings-account` 注册进 `settings.launcher`）。本插件的设置壳现在：
  - **原样渲染该槽内容**（官方 `AccountMenu`）→ 用户按钮与其全部菜单项保留，功能仍走官方实现；
  - 把菜单里的「设置」接到本插件的 mega 设置弹层；
  - 该槽有内容（桌面）时不再并排插件自己的齿轮按钮；为空（web）时保留插件自己的设置入口 —— 判据是**运行时槽位**而非平台，因此**同一份包、同一个构建**同时适配桌面版与 web 版。
- **适配 dsh 0.2.0 新增的官方分区**：`账号与余额`（`account`，order -10）此前不在原生分区清单里，会被当作第三方设置收纳进分组、导航栏里看不到；现已归入原生分区，导航栏顺序与官方一致（官方后续新增分区仍可能需要在 `src/client/pure.ts` 的清单里同步）。
- **修复顶区拖拽排序落点**：导航顶部行的拖拽落点曾被判定为「末尾」——除首位外，拖到任意槽都会被追加到最后。现已按落点正确插入。
- **可诊断性**：加载时打印构建戳 `[mgs-build] <版本>+<short sha>`（并挂 `window.__MGS_BUILD__`），便于确认当前运行的是哪个构建。
- **兼容底线抬到 `>= 0.2.0-rc.1`**：宿主版本自检策略与 `peerDependencies` 同步收紧（`dsh-settings` / `dsh-client-ui-settings` / `dsh-client-ui-renderer` / `dsh-client-locale` 均为 `>=0.2.0-rc.1`）；更旧的版本线（0.1.x / 0.2.0-alpha）请使用对应分支的发布版本。

<h3 id="en-v0.2.0-rc.2">Adaptation & changes</h3>

- **Adapted to the official DSH desktop app**: the desktop app moved the official settings entry into a "user button + menu" at the bottom of the left sidebar (`sidebar.settings` is claimed by the official `dsh-client-ui-settings-general`, while the user button/menu is registered into `settings.launcher` by `dsh-client-ui-settings-account`). This plugin's settings shell now:
  - **renders that slot verbatim** (the official `AccountMenu`) → the user button and every menu item stay, still implemented by the official plugin;
  - routes the menu's "Settings" item to this plugin's mega settings dialog;
  - hides its own gear button when that slot has content (desktop) and keeps its own trigger when the slot is empty (web) — the criterion is a **runtime slot**, not the platform, so **one package and one build serve both the desktop app and web**.
- **Adapted to dsh 0.2.0's new official section**: "Account" (`account`, order -10) was missing from the native-section list, so it was treated as a third-party section, folded into a group and never shown in the nav; it is now native and the nav matches the official order (future official sections may still need to be added to the list in `src/client/pure.ts`).
- **Fixed top-area drag ordering**: a drop in the nav's top area used to land at the end — every slot except the first appended the row to the end. The row now lands at the dropped position.
- **Diagnostics**: a build stamp is logged on load (`[mgs-build] <version>+<short sha>`, also `window.__MGS_BUILD__`) so the running build can be identified.
- **Compatibility floor raised to `>= 0.2.0-rc.1`**: both the host version self-check policy and `peerDependencies` were tightened (`dsh-settings` / `dsh-client-ui-settings` / `dsh-client-ui-renderer` / `dsh-client-locale` are all `>=0.2.0-rc.1`); for older lines (0.1.x / 0.2.0-alpha) use the corresponding branch release.

## 0.2.0-rc.1（适配 dsh v0.2.0-rc.* · 依赖线跨 0.1.7/0.2.0）

[中文](#cn-v0.2.0-rc.1) | [English](#en-v0.2.0-rc.1)

<h3 id="cn-v0.2.0-rc.1">适配与变更</h3>

- **适配 dsh v0.2.0-rc.1**：0.1 → 0.2 **无 API 破坏**（typecheck 零错误），代码直接兼容；依赖升 0.2.0-rc.1（dsh-settings / dsh-client-ui-settings / dsh-client-locale / dsh-client-ui-renderer）。
- **peerDependencies 去掉 `<` 上限**：改为 `>=0.1.7-rc.1`（无上界），跨 0.1.7 / 0.2.0 两条运行时线均可安装——修复 0.2.0 上因旧 `<0.1.8` 上界被判不兼容而拒绝加载的问题。
- **自带兼容策略改为双线数组声明**：`{ op: '=', target: ['0.1.7-rc.*', '0.2.0-rc.*'] }`，在 0.1.7 与 0.2.0 rc 运行时都不误报「可能不适配」。

<h3 id="en-v0.2.0-rc.1">Adaptation & changes</h3>

- **Adapted to dsh v0.2.0-rc.1**: no API break from 0.1 to 0.2 (typecheck clean), code is directly compatible; dependencies bumped to 0.2.0-rc.1 (dsh-settings / dsh-client-ui-settings / dsh-client-locale / dsh-client-ui-renderer).
- **peerDependencies no longer cap below a version**: now `>=0.1.7-rc.1` (no upper bound), installable across both the 0.1.7 and 0.2.0 runtime lines — fixes the load rejection on 0.2.0 caused by the old `<0.1.8` upper bound.
- **Own compat policy widened to a two-line array**: `{ op: '=', target: ['0.1.7-rc.*', '0.2.0-rc.*'] }`, so no false "may not be compatible" warning on either the 0.1.7 or 0.2.0 rc runtimes.
## 0.1.7-rc.1（适配 dsh v0.1.7-rc.* · 设置模型重构）

[中文](#cn-v0.1.7-rc.1) | [English](#en-v0.1.7-rc.1)

<h3 id="cn-v0.1.7-rc.1">适配与变更</h3>

- **适配 dsh v0.1.7（设置/配置模型破坏性变更）**：
  - 设置由插件导出的 `Config` schema 派生（不再 `ctx.settings.register`）；宿主 `apply(ctx, config)` 第二参读自身配置；命名空间 = profile entry id（配置承载于 patch entry config 段）；
  - 客户端读写改用 `ctx.configForms.get(entryId)`（替代 `settingsScope`）；仅 **volatile** 字段可实时写入（schema 整对象 `.volatile()`，schemastery ^3.18.3）；
  - 写入统一走 `mutate` 路径级（`{op:'set', path:[...], value}`），避免整对象读-改-写竞争（快速连点开关不再互相覆盖）；
  - **乐观写 + localStorage 写穿 + 初始化重放**：宿主 reconcile 约 1.5s，快速刷新也能保住改动并自动重提交落盘；
  - primitives 图标改名适配（`IconXxxOutline16/14` → `OutlineMedium/Regular`，否则渲染 undefined 崩溃）；
  - 声明文件可移植性（TS2742）：schema 推断类型收窄为自身接口；
  - 依赖/运行时 **0.1.7-rc.1** 正式化（alpha.2 → rc.1 无 API 破坏）；兼容策略 `0.1.7-rc.*` 命中，启动不再打印「可能不适配」；
  - 快速连点配置翻转适配：乐观写按顶层字段**防抖合并**（~400ms，一次只发最终值）+ **dirty 代次门控**（字段仍有未落定写入时保留覆盖），杜绝中间值回显造成的 true/false 缓慢翻转；
  - 全屏收起残留变暗适配：「全屏背景透明度」改为只作用于全屏面板内的 dock 内容区（`[data-sidebar-right-panel="fullscreen"] [data-dockkit-host="dock"] > section`），收起后 dock 区随之消失、无残留遮罩；
  - **mega 家族公共兼容开关（mega.json）**：mega-settings 作为家长直接读写 `$DSH_HOME/mega.json` 的 `compatCheck`（一处关闭、全体 mega 插件静音，经 host API 桥）；读取契约「自身显式 → 家族公共 → 缺省 true」；`compatCheck` 字段**无默认值**（三态命门，未设才能读到家族层）+ 整对象 volatile 的 config 需解包 `.get()`。
  - **落点位置粘性**：拖拽时指针仍在导航列内，落点不消失（行上/下半区槽位可稳定落位）；
  - **乐观顺序 + FLIP 首帧播种**：放置不再「先复位再滑到目标槽」闪烁，源行从光标直接滑入槽位、其余行平滑让位；
  - 开关/滑块改路径级写入，连点不再互相覆盖。
- **新增优化**：正文编辑文件预览背景透明度（`dsh.editorFilePreviewBgAlpha`，dsh 一般区）——文件预览卡片背景混合为主题 layer-1 半透明（`._preview_178vx_56`，web-shell hash 类，升级 dsh 后需复核；0.1.7-alpha.1 曾为 `_preview_1nod8_56`）。

<h3 id="en-v0.1.7-rc.1">Adaptation & changes</h3>

- **Adapted to dsh v0.1.7 (breaking settings/config model)**:
  - Settings are now derived from the plugin's exported `Config` schema (no more `ctx.settings.register`); the host reads its config from the `apply(ctx, config)` second argument; the namespace is the profile entry id (config lives in the patch entry's config section);
  - Client read/write now uses `ctx.configForms.get(entryId)` (replaces `settingsScope`); only **volatile** fields can be written live (whole-object `.volatile()`, schemastery ^3.18.3);
  - Writes go through `mutate` path ops (`{op:'set', path:[...], value}`) to avoid whole-object read-modify-write races (rapid consecutive toggles no longer overwrite each other);
  - **Optimistic writes + localStorage write-through + replay on init**: survives a quick refresh even though the host reconcile takes ~1.5s, and re-submits pending writes automatically;
  - Primitives icon rename adapted (`IconXxxOutline16/14` → `OutlineMedium/Regular`, otherwise React #130);
  - Declaration portability (TS2742): the schema's inferred type is narrowed to the plugin's own interface;
  - Dependencies/runtime formalized at **0.1.7-rc.1** (no API break from alpha.2); the compat policy `0.1.7-rc.*` now matches, so no more "may not be compatible" warning at startup;
  - **Rapid-toggle adaptation**: optimistic writes are now debounced per top-level field (~400ms, only the final value is sent) plus a dirty-generation gate (the optimistic overlay is kept while the field still has unsettled writes), eliminating the slow true/false cycling caused by intermediate values being echoed back;
  - **Fullscreen-collapse adaptation**: "Fullscreen background transparency" now targets only the dock content section inside the fullscreen panel (`[data-sidebar-right-panel="fullscreen"] [data-dockkit-host="dock"] > section`), so collapsing removes the dock and no residual mask remains;
  - **mega-family shared compat switch (mega.json)**: mega-settings, as the family host, reads/writes `compatCheck` in `$DSH_HOME/mega.json` directly (one switch mutes the whole mega family; bridged via a host API). Read contract: own config → family file → default true. The `compatCheck` field has **no default** (the three-state crux, so "unset" can reach the family layer) and whole-object-volatile configs must be unwrapped via `.get()`. (Contract documented in mega-plugin-guide 09-version-check.)
- **Drag & drop / drop-target optimizations**:
  - **Sticky drop targets**: while dragging, the target stays visible as long as the pointer is inside the nav column, so you can reliably land on a row's upper/lower slot;
  - **Optimistic ordering + FLIP first-frame seeding**: dropping no longer flashes "snap back then slide" — the dragged row slides from the cursor into its slot while the others ease aside;
  - Toggles/sliders now use path-based writes so rapid consecutive clicks no longer clobber each other.
- **New optimization**: file preview background transparency in the main editor (`dsh.editorFilePreviewBgAlpha`, general dsh group) — the preview card background blends the theme layer-1 color (`._preview_178vx_56`, web-shell hash class, re-check on dsh upgrades; was `_preview_1nod8_56` in 0.1.7-alpha.1).

## 0.1.5-rc.2-update.2（设置壳对齐官方 · 优化项扩展）

[中文](#cn-v0.1.5-rc.2-update.2) | [English](#en-v0.1.5-rc.2-update.2)

<h3 id="cn-v0.1.5-rc.2-update.2">新增</h3>

- **设置壳对齐官方**：操作列、标题、触发器内容与关闭按钮改为渲染官方 `settings.action` / `settings.header` / `settings.trigger` / `settings.close` 插槽内容——官方内置动作（如「打开配置文件」）与第三方注册者一并生效（此前折叠 / 收纳模式的操作列为空）；
- **连接状态与首启引导**：触发按钮旁显示官方连接指示器（连接中 / 连接断开 / 已恢复），点击即可立即重连；按官方语义渲染首启引导舞台（`settings.onboarding`），在无会话的新会话首屏逐个展示未读引导步（欢迎须知 / 官方凭据引导），完成即不再重复；
- **设置搜索**：导航顶部搜索框，按名称实时过滤导航行（可在 mega 设置页关闭）；
- **兼容性校验开关**：mega 系插件兼容性校验，关闭后各 mega 插件启动时不再校验 dsh 版本并提醒（mega 家族契约，各插件自行读取本值）；
- **提示面板**：mega 设置页展示未读提示，右下角「懂你意思」一键标记已读（落 `dismissedTips`）；
- **mega 优化新增**：
  - **左侧边栏底部动作区布局**：动作区纵向排列；侧栏折叠时动作按钮撑满宽度、动作条目（div）文本居中；
  - **设置快捷键**：`Ctrl+Shift+S` 打开设置页（拦截浏览器「另存为」）；
  - **技能中心主题适配**（`@linxin666/dsh-client-ui-skill-explorer`）：面板硬编码色改主题语义色，跟随皮肤；
- **修复**：官方原生设置分区识别补全——「已归档会话」等官方设置页不再被当作第三方管控项；声明文件可移植性修复（生成的 `.d.ts` 不再引用依赖树私有路径）；**优化效果刷新首帧即生效**（此前会先闪一帧未优化的界面，且宿主配置到达前会先按默认值渲染）；**优化样式标签常驻 `<head>` 末尾**（官方 UI 的 CSS 模块在各自 bundle 求值时注入、位置更靠后，此前会压过我们同特异性的覆盖——全屏透明度、左栏背景透明度、底部动作区等一并受影响）；**接管页的官方组件词条插值失效**（locale 转发丢失 `params`，官方 `translate` 在无参数时直接返回模板原文，导致内置插件页的 `{name}（默认）`、已归档会话的相对时间 `{n}天` 等原样显示）。

**适配说明**：本版同时适配 dsh v0.1.6-alpha.2；alpha 版不纳入兼容声明（在 alpha 版上启动仍会打印版本提示，不影响使用）。

<h3 id="en-v0.1.5-rc.2-update.2">New features</h3>

- **Settings shell aligned with the official one**: the action row, title, trigger content and close button now render the official `settings.action` / `settings.header` / `settings.trigger` / `settings.close` entries — official built-ins (such as "open settings document") and third-party registrants both take effect (the action row used to be empty in Fold / Collect mode);
- **Connection state & first-run onboarding**: the official connection indicator (connecting / disconnected / recovered) sits next to the trigger and reconnects on click; the onboarding stage (`settings.onboarding`) renders per the official semantics, showing unread first-run steps (welcome notice / official credential) on the new-session screen;
- **Settings search**: a search box at the top of the nav filters nav rows by name in real time (can be disabled on the mega settings page);
- **Compatibility self-check toggle**: when off, the mega family plugins stop checking the dsh version and warning on startup (mega family contract; every plugin reads the flag itself);
- **Tips panel**: the mega settings page lists unread tips and marks them all as read with one click (`dismissedTips`);
- **New mega Optimize entries**:
  - **Left sidebar footer actions layout**: stacks the footer actions vertically; while the sidebar is collapsed the buttons go full width and the action entries (div) center their text;
  - **Settings shortcut**: `Ctrl+Shift+S` opens the settings dialog (intercepts the browser "Save as");
  - **Skill explorer theme adaptation** (`@linxin666/dsh-client-ui-skill-explorer`): hardcoded panel colors become theme tokens so the panel follows skins;
- **Fixes**: official native settings sections are now fully recognized — official pages such as "Archived sessions" are no longer treated as third-party managed entries; declaration portability fix (the generated `.d.ts` no longer references a private path in the dependency tree); **optimizations now apply on the first painted frame** (previously an un-optimized frame flashed first, and defaults were rendered before the host settings arrived); **optimize style tags now stay last in `<head>`** (official UI CSS modules are injected later during their own bundle evaluation and used to beat our overrides of equal specificity — fullscreen background transparency, left sidebar background transparency and the footer actions layout were all affected); **locale interpolation broke on taken-over pages** (the locale forwarding dropped `params`, and the official `translate` returns the raw template when no params are given — so `{name}（default）` on the built-in plugins page and relative times such as `{n}天` on the archived sessions page rendered verbatim).

**Compatibility note**: this release also works on dsh v0.1.6-alpha.2; alpha releases are not declared compatible (the startup version notice still prints there and never blocks loading).
## 0.1.5-rc.2-update.1（mega 优化扩展）

[中文](#cn-v0.1.5-rc.2-update.1) | [English](#en-v0.1.5-rc.2-update.1)

<h3 id="cn-v0.1.5-rc.2-update.1">新增</h3>

- **优化页结构**：dsh 面板划分为一般 / 左侧边栏 / 右侧边栏子区；各面板默认折叠（点击标题展开，折叠图标右对齐）；带控件的设置项自动排到面板下方；
- **dsh 新增设置**：
  - 主题根元素设置为边框盒（默认开启）；
  - 正文 Markdown 表格限制最大宽度（横向滚动条常驻，!important 覆盖官方规则）；
  - 右侧边栏全屏层级修正（数字输入框、无上限、默认 41）；
  - 全屏下内边距优化（面板内边距继承 #root，变化触发、退出全屏即恢复）；
  - 全屏下 ESC 关闭侧边栏、TAB 打开侧边栏（设置页打开时不拦截 TAB）、默认全屏；
  - 左侧边栏背景颜色统一化（布局层/模块层单一控制源，选中其一另一层强制 none）、背景透明度（去除填充色原有 alpha 并混合设置透明度）；
  - 工作区悬浮卡主题适配（硬编码背景/文字色改主题语义色，状态点排除）；
- **dsh-cost-meter 峰谷计价主题色适配**：周末/经典标记与标签改用主题语义色；峰值时段颜色可配置（警告/危险/错误，默认错误），作用于 :after 三角、峰段背景、rail-classic 分段与 .peak 态 chip/label；tooltip 文案/背景主题化；标记去原生边框与阴影；
- **插件面板**：面板名称旁新增 GitHub 跳转按钮（点击才跳转，不触发展开）；版本徽章紧跟名称；
- **细节打磨**：设置名加粗（700）、字号与颜色调整；折叠图标/版本徽章垂直居中。

<h3 id="en-v0.1.5-rc.2-update.1">New features</h3>

- **Optimize page structure**: the dsh panel is split into general / left sidebar / right sidebar sections; panels collapse by default (click the header to expand; chevron right-aligned); settings with controls sort below plain toggles;
- **New dsh settings**: root border-box (on by default); markdown table max-width with a persistent horizontal scrollbar (!important overrides the official rule); fullscreen z-index (number input, unlimited, default 41); fullscreen padding inheriting #root (change-triggered, restored on exit); ESC to close / TAB to open the rightbar (TAB not intercepted while the settings dialog is open) / default to fullscreen; left sidebar background unification (single control source: layout/module layer, the other forced to none) and background transparency (drop the fill's built-in alpha and blend with the configured transparency); workspace hover card theme adaptation (hardcoded colors to theme tokens, status dot excluded);
- **dsh-cost-meter peak/valley theme adaptation**: weekend/classic markers and labels use theme semantic colors; the peak-hour color is configurable (warning/danger/error, default error) applied to the :after arrow, peak backgrounds, rail-classic segments and .peak chip/labels; tooltips themed; markers lose their native border and shadow;
- **Plugin panels**: a GitHub link button next to the panel name (navigates only on click, does not toggle the panel); the version badge sits right after the name;
- **Polish**: setting names bolded (700) with adjusted sizes/colors; collapse icons and version badges vertically centered.

## 0.1.5-rc.2（新增 mega 优化页）

[中文](#cn-v0.1.5-rc.2) | [English](#en-v0.1.5-rc.2)

<h3 id="cn-v0.1.5-rc.2">新增</h3>

- **mega 优化页**：按 **mega 成员契约**注册为成员（收纳模式「mega」组卡片 / 折叠模式 mega 固组行），集中收纳对 dsh 与第三方插件的优化开关：
  - **注册表机制**：每条优化 = optimize.ts 一条 def（id/分组/目标/词条/效果），开关落 `optToggles`、数值落 `optValues`；效果支持静态 css、滑块值驱动 cssValue、JS 效果（jsEffect）三种，新增优化只需追加 def（+ 词条 + 效果），页面自动归入 dsh 组或对应插件面板；
  - **dsh 界面组**：右侧边栏全屏零占位（全屏时网格占位轨强制 0，退出全屏/关闭右栏正确恢复，含侧栏折叠状态）；右侧边栏全屏背景透明度（滑块 0-100、数值越大越透明、默认 25，`rgb(from …)` 相对颜色取主题色）；右侧边栏全屏下隐藏正文工具栏；
  - **第三方插件组**：按插件独立面板（面板头显示插件名 + 版本）；**未安装 / 未启用不显示、效果不注入**——已装检测走包版本 API，启用检测走插件 `settings.section` 运行时信号；首例：dsh-better-sidebar 隐藏底部面板切换钮；

<h3 id="en-v0.1.5-rc.2">New features</h3>

- **mega Optimize page**: registered as a mega member (card in the mega group in Collect mode / row in the mega section in Fold mode), hosting optimization toggles for dsh and third-party plugins:
  - **Registry mechanism**: each optimization is one def in optimize.ts (id/group/target/locale keys/effect); toggles live in `optToggles`, numeric values in `optValues`; effects support static css, slider-driven cssValue, and JS effects (jsEffect) — adding an optimization is just appending a def, and the page places it into the dsh group or the matching plugin panel automatically;
  - **dsh group**: rightbar fullscreen zero track (grid placeholder track forced to 0 while fullscreen, restored correctly on exit/close, including when the left sidebar is collapsed); rightbar fullscreen background transparency (slider 0-100, larger = more transparent, default 25, using `rgb(from …)` relative color over the theme color); hide the conversation toolbar while the right sidebar is fullscreen;
  - **Third-party group**: one panel per plugin (plugin name + version in the header); **hidden and not injected when not installed or not enabled** — installed detection via the package-version API, enabled detection via the plugin's `settings.section` runtime signal; first entry: dsh-better-sidebar hide bottom-panel toggle;

## 0.1.5-rc.1（适配 dsh v0.1.5-rc.* · 0.1.5 rc 线）

[中文](#cn-v0.1.5-rc.1) | [English](#en-v0.1.5-rc.1)

作为 `0.1.5` 系列的首个候选版本，本版本汇总了自 `v0.1.2-rc.1` 以来的主要用户和开发者相关变更。

<h3 id="cn-v0.1.5-rc.1">其他变更</h3>

- **适配目标**：dsh v0.1.2-rc.1 → **v0.1.5-rc.\***（0.1.5 rc 线），兼容策略锁定 `= 0.1.5-rc.*`（匹配 0.1.5 基线任意 rc 预发布：rc.1 / rc.2 …；不含 alpha 线与正式版）。
- **无需业务代码迁移**：0.1.5 rc 线对本插件依赖的 settings / slots / locale 契约无破坏性变更；该线的破坏性变更（会话格式 V3、移除 `ctx.agent`、Inbox 接口化）均不影响本插件。
- **依赖基线**：lockstep 依赖整体升级 `0.1.2-rc.1` → `0.1.5-rc.1`；peer 声明 rc 线（`>=0.1.5-rc.1 <0.1.5`），dev 构建基线固定 `0.1.5-rc.1`。
- **版本号规范**：rc 线版本统一为合法 semver 预发布格式（`0.1.5-rc.*`）。
- **npm 元数据**：补 `license: Apache-2.0`、`repository` / `homepage` / `bugs` 链接，`files` 含 `CHANGELOG.md`，`publishConfig` 固定官方 registry，补 `prepack` 脚本。
- **依赖清理**：移除未使用的 `@deepseek-ai/dsh-invariants` / `@deepseek-ai/dsh-tools`（src 零引用；`dsh.client.inject` 运行契约不变）。
- dsh 0.1.1-* 请使用 0.1.1 分支版本，dsh 0.1.2-rc.1 请使用 0.1.2 分支版本。

<h3 id="en-v0.1.5-rc.1">Other changes</h3>

- **Target**: dsh v0.1.2-rc.1 → **v0.1.5-rc.\*** (the 0.1.5 rc line), compatibility policy locked to `= 0.1.5-rc.*` (any rc prerelease of the 0.1.5 baseline: rc.1 / rc.2 …; excluding the alpha line and the final release).
- **No business-code migration needed**: the 0.1.5 rc line brings no breaking change to the settings / slots / locale contracts this plugin depends on, and that line's breaking changes (session format V3, `ctx.agent` removal, Inbox interface) do not affect this plugin.
- **Dependency baseline**: lockstep dependencies raised from `0.1.2-rc.1` to `0.1.5-rc.1`; peer declares the rc line (`>=0.1.5-rc.1 <0.1.5`), dev baseline pinned to `0.1.5-rc.1`.
- **Version normalized**: the rc line uses a valid semver prerelease format (`0.1.5-rc.*`).
- **npm metadata**: added `license: Apache-2.0`, `repository` / `homepage` / `bugs` links, `CHANGELOG.md` in `files`, `publishConfig` pinned to the official registry, and a `prepack` script.
- **Dependency cleanup**: removed the unused `@deepseek-ai/dsh-invariants` / `@deepseek-ai/dsh-tools` (zero references in src; the `dsh.client.inject` runtime contract is unchanged).
- For dsh 0.1.1-* use the 0.1.1 branch release; for dsh 0.1.2-rc.1 use the 0.1.2 branch release.

## 0.1.2（适配 dsh 0.1.2-rc.1）

### 适配
- 适配 dsh 0.1.2-rc.1（0.1.2 线），兼容 dsh 0.1.1 之后的版本线；dsh 0.1.1-* 请使用 0.1.1 分支版本。

### 修复
- 切换语言后，设置导航中的官方分区与第三方设置行标签即时刷新，不再停留旧语言；
- 收纳模式卡片版本徽章直接显示版本号：进入设置先显示上次记录，再后台静默更新，不再先闪「未知」；
- 分组内仅剩一项被拖出再拖回时，空分组正确显示落点提示。

### 性能
- 拖拽更跟手、更流畅（折叠与收纳两模式）；
- 插件包体积减小约 40%。

## 0.1.1（2026-09）

全新用户向初始发布（仓库历史重置；0.1.1-rc2 预发布线更名整合）。

### 功能
- 双模式设置中心：收纳（collect 卡片 hub）与折叠（fold 接管官方设置弹层），分组数据共享；
- 分组管理：新建即命名、hover 改名/删除、未分组行尾 + 新建、空组可接收拖入；
- 拖拽体系重建：指针跟手（无浏览器拖影）、行上/下半区单虚线落点、FLIP 平滑让位 + 判定锁、边缘自动滚动、折叠设置头行拖悬自动展开；
- dsh 版本兼容校验器：语义化比较（> / < / =，alpha/rc 排序）、通配（0.1.1-*）与 target 数组，宿主启动控制台警示；
- 国际化：折叠 mega 行、导航回退、分隔条、收纳页头徽章等全部 locale 化（zh/en 37 词条同键）；
- 样式：开关 checked 滑块背景使用语义令牌 label-primary-inverted（替换硬编码 #fff）；
- 语义令牌化样式与中英双语文案。