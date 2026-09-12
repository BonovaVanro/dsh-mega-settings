# Changelog

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
