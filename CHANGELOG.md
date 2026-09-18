# Changelog

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