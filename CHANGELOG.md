# Changelog

## 0.1.5-rc.1（适配 dsh v0.1.5-rc.* · 0.1.5 rc 线）

[中文](#cn-v0.1.5-rc.1) | [English](#en-v0.1.5-rc.1)

作为 `0.1.5` 系列的首个候选版本，本版本汇总了自 `v0.1.2-rc.1` 以来的主要用户和开发者相关变更。

<h3 id="cn-v0.1.5-rc.1">其他变更</h3>

- **适配目标**：dsh v0.1.2-rc.1 → **v0.1.5-rc.\***（0.1.5 rc 线），兼容策略锁定 `= 0.1.5-rc.*`（匹配 0.1.5 基线任意 rc 预发布：rc.1 / rc.2 …；不含 alpha 线与正式版）。
- **无需业务代码迁移**：0.1.5 rc 线对本插件依赖的 settings / slots / locale 契约无破坏性变更；该线的破坏性变更（会话格式 V3、移除 `ctx.agent`、Inbox 接口化）均不影响本插件。
- **依赖基线**：lockstep 依赖整体升级 `0.1.2-rc.1` → `0.1.5-rc.1`；peer 声明 rc 线（`>=0.1.5-rc.1 <0.1.5`），dev 构建基线固定 `0.1.5-rc.1`。
- **版本号规范**：`0.1.5.alpha`（非法 semver 预发布写法）→ `0.1.5-rc.1`。
- **npm 元数据**：补 `license: Apache-2.0`、`repository` / `homepage` / `bugs` 链接，`files` 含 `CHANGELOG.md`，`publishConfig` 固定官方 registry，补 `prepack` 脚本。
- **依赖清理**：移除未使用的 `@deepseek-ai/dsh-invariants` / `@deepseek-ai/dsh-tools`（src 零引用；`dsh.client.inject` 运行契约不变）。
- dsh 0.1.1-* 请使用 0.1.1 分支版本，dsh 0.1.2-rc.1 请使用 0.1.2 分支版本。

<h3 id="en-v0.1.5-rc.1">Other changes</h3>

- **Target**: dsh v0.1.2-rc.1 → **v0.1.5-rc.\*** (the 0.1.5 rc line), compatibility policy locked to `= 0.1.5-rc.*` (any rc prerelease of the 0.1.5 baseline: rc.1 / rc.2 …; excluding the alpha line and the final release).
- **No business-code migration needed**: the 0.1.5 rc line brings no breaking change to the settings / slots / locale contracts this plugin depends on, and that line's breaking changes (session format V3, `ctx.agent` removal, Inbox interface) do not affect this plugin.
- **Dependency baseline**: lockstep dependencies raised from `0.1.2-rc.1` to `0.1.5-rc.1`; peer declares the rc line (`>=0.1.5-rc.1 <0.1.5`), dev baseline pinned to `0.1.5-rc.1`.
- **Version normalized**: `0.1.5.alpha` (an invalid semver prerelease form) → `0.1.5-rc.1`.
- **npm metadata**: added `license: Apache-2.0`, `repository` / `homepage` / `bugs` links, `CHANGELOG.md` in `files`, `publishConfig` pinned to the official registry, and a `prepack` script.
- **Dependency cleanup**: removed the unused `@deepseek-ai/dsh-invariants` / `@deepseek-ai/dsh-tools` (zero references in src; the `dsh.client.inject` runtime contract is unchanged).
- For dsh 0.1.1-* use the 0.1.1 branch release; for dsh 0.1.2-rc.1 use the 0.1.2 branch release.

## 0.1.5.alpha（适配 dsh 0.1.5-alpha.1）

### 适配
- 适配 dsh 0.1.5-alpha.1（0.1.5 线；lockstep 依赖整体升级 0.1.2-rc.1 → 0.1.5-alpha.1）；
- 兼容策略切换为 `= 0.1.5-*`（接受 0.1.5 整条预发布线）；dsh 0.1.1-* / 0.1.2-rc.1 请分别使用 0.1.1 / 0.1.2 分支版本；
- 0.1.5 线对插件所依赖的 settings / slots / locale 契约无破坏性变更（dsh-settings、dsh-client-ui-settings、dsh-client-ui-renderer、dsh-client-locale、dsh-invariants、dsh-client-modules、dsh-client-ui-primitives 与 0.1.2-rc.1 逐字节一致），故无需业务代码迁移；
- 0.1.5 线的破坏性变更（会话格式 V3、移除 ctx.agent、Inbox 接口化）不影响本插件。

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