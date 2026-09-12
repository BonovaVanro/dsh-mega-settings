# mega-settings

[English](https://github.com/BonovaVanro/dsh-mega-settings/blob/main/README.en.md) · **中文**

DSH（DeepSeek Harness）的**统一设置中心**：把散落插件的设置入口收进一处，按你的习惯分组管理。
属于 mega 系列家族宿主——收纳（collect）与折叠（fold）两种模式共用同一份分组数据。

## 功能一览

- **收纳模式**：卡片式集中页收纳第三方设置入口；拖拽进出自定义分组与未分组，分组可整体排序；
- **折叠模式**：接管官方设置弹层导航；第三方设置折叠进分组，拖行到顶部＝释放为一级入口，拖回＝重新折叠；
- **分组管理**：新建分组（创建后直接输入名称回车确认）、hover 分组标题改名/删除、未分组行尾 ＋ 即点即建；
- **拖拽体验**（两模式统一）：指针跟手拖拽（原元素随光标、无浏览器拖影）、悬停行上/下半区出单个虚线落点、FLIP 平滑让位与判定锁、列表边缘自动滚动；
- **自适应观感**：全部使用 dsh 语义令牌与官方视觉，不写主题分支；
- **mega 优化**：集中收纳对 dsh 与第三方插件的优化开关——右侧边栏全屏零占位 / 全屏背景透明度（滑块可调，数值越大越透明）/ 全屏下隐藏正文工具栏；第三方插件按插件独立面板，未安装或未启用不显示、效果不注入；新增优化只需在注册表追加 def；
- **版本自检**：宿主启动校验当前 dsh 版本线，不合规时控制台警示，不阻断使用。

## mega 优化

「mega 优化」是本插件的 mega 成员页（收纳模式「mega」组卡片 / 折叠模式 mega 固组行），集中收纳对 dsh 与第三方插件的优化开关，全部**即时生效、可逆**。

### dsh 界面

- **右侧边栏全屏零占位**：右侧边栏全屏时网格占位轨强制为 0，中心内容宽度不变（退出全屏/关闭右栏正确恢复）；
- **右侧边栏全屏背景透明度**：滑块 0–100、数值越大越透明（默认 25），全屏面板背景按当前主题色重新混合；
- **右侧边栏全屏下隐藏正文工具栏**：全屏时隐藏对话正文顶部工具栏。

### 第三方插件

每个插件一个独立面板（面板头显示插件名 + 版本）；**未安装或未启用的插件不显示、效果不注入**。当前包含：

- **dsh-better-sidebar**：隐藏底部面板切换钮。

### 扩展

优化采用注册表机制：`src/client/optimize.ts` 中每条优化 = 一个 def（id / 分组 / 目标插件 / 词条 / 效果），开关落 `optToggles`、数值落 `optValues`；效果支持静态 CSS、滑块值驱动 CSS、JS 效果三种。新增优化只需追加一条 def（+ 词条），页面自动归入 dsh 组或对应插件面板。
<!-- TODO(截图): 图片就绪后填入各 src（建议放 assets/ 目录，宽度 ≤1280px），可增删条目 -->
## 界面预览
### 收纳模式
<div align="center">
  <img width="600" height="600" alt="收纳模式：分组卡片总览" src="https://github.com/user-attachments/assets/46b2b7b2-fab6-4195-a847-cc6fc0463e83" />
  <br />
  <sub>图 1 · 收纳模式（collect）——分组卡片总览</sub>
</div>
<br />

<div align="center">
  <img width="600" height="600" alt="收纳模式：分组卡片总览" src="https://github.com/user-attachments/assets/c5223c23-c231-4ba7-80a1-05663d0c53a9" />
  <br />
  <sub>图 2 · 收纳模式（collect）——子页面预览</sub>
</div>
<br />

### 折叠模式
<div align="center">
  <img width="600" height="600" alt="折叠模式：接管官方设置弹层" src="https://github.com/user-attachments/assets/fc126319-42a8-4ecc-883a-5870f5db4a14" />
  <br />
  <sub>图 3 · 折叠模式（fold）——接管官方设置弹层</sub>
</div>
<br />

<div align="center">
  <img width="600" height="600" alt="折叠模式：接管官方设置弹层" src="https://github.com/user-attachments/assets/50d801e0-63a1-4706-bf2e-be853403d646" />
  <br />
  <sub>图 4 · 折叠模式（fold）——子页面预览</sub>
</div>
<br />

## 操作教程
### 收纳模式
<div align="center">
  <video autoplay loop muted playsinline src="https://github.com/user-attachments/assets/a27461b1-2056-47fa-abbb-cb10efb8a1dd"/>
  <br />
  <sub>视频 1 · 收纳模式——操作教程</sub>
</div>
<br />

### 折叠模式
<div align="center">
  <video autoplay loop muted playsinline src="https://github.com/user-attachments/assets/48821b38-de39-41f0-b1a3-052c16dbd2f8"/>
  <br />
  <sub>视频 2 · 折叠模式——操作教程</sub>
</div>

## 安装

已适配 dsh v0.1.5-rc.\*（0.1.5 rc 线：rc.1 / rc.2 …）。dsh v0.1.1-* 请使用 0.1.1 分支版本，dsh v0.1.2-rc.1 请使用 0.1.2 分支版本。
提供 npm / GitHub tag / 本地包 三种安装方式。

**npm**

```
dsh plugin --profile web add dsh-mega-settings@0.1.5-rc.2
```

**GitHub tag**

```
dsh plugin --profile web add github:BonovaVanro/dsh-mega-settings#v0.1.5-rc.2
```

**本地包**

```
dsh plugin --profile web add dsh-mega-settings-0.1.5-rc.2.tgz
```

## 快速上手

1. 在设置中找到 mega-settings，切换**收纳 / 折叠**模式（两模式数据互通，随时可换）；
2. **收纳模式**：进入「收纳配置」——卡片即第三方设置入口；拖到某分组或未分组松手即归位；悬停分组标题可改名/删除；拖分组标题整体排序；
3. **折叠模式**：打开官方设置弹层，展开「折叠设置」——拖动行重排；拖到上方导航区＝释放（成为独立入口）；从顶部拖回折叠体＝重新接管；
4. 释放/接管只改变入口归属，不会删除任何配置；
5. 在「mega 优化」开启需要的优化（右侧边栏全屏相关等）；第三方插件面板仅在插件已安装且启用时出现。

## 适用 dsh 版本与兼容性

- **适配 dsh 版本：0.1.5-rc.\***（0.1.5 rc 线通配：rc.1 / rc.2 …；基于 dsh v0.1.2-rc.1 → v0.1.5-rc.1 的差异适配）；
- dsh 0.1.1-* 维护线归 0.1.1 分支版本，0.1.2 线归 0.1.2 分支版本；
- 宿主启动会按版本策略自检（默认 `= 0.1.5-rc.*`）；其他版本控制台会打印
  `dsh-mega-settings 可能不适配 dsh <版本> 版本，请慎重使用`，插件仍可加载使用；
- 维护者可自行调整 `src/index.ts` 的 `DSCH_COMPAT_POLICY`（支持 > / < / = 与通配、数组）。

## 常见问题

**mega 优化里看不到某个第三方插件（如 dsh-better-sidebar）的面板？**

第三方插件面板只在**已安装且已启用**时显示——未安装、或已安装但插件被禁用，面板不显示、效果也不注入。请确认插件已安装并启用（启用后插件会注册其设置分区）。

**优化开关打开了但没看到效果？**

所有开关即时生效；个别界面调整（如右侧边栏全屏零占位）在刷新页面后完全生效。若仍无效果，先确认目标插件已启用，或 Ctrl+F5 硬刷新。

**切换收纳 / 折叠模式后分组会丢吗？**

不会。两模式共用同一份分组数据（groups / navOrder），随时切换、随时还原。

**mega 优化会改动第三方插件的数据吗？**

不会。优化只注入界面样式/行为（CSS/JS），不读写任何第三方插件的配置；开关与数值仅存于本插件自身配置（optToggles / optValues）。

**为什么 mega 优化不作为一个单独的插件发布？**

不想多维护一条发布线。mega 优化是 mega-settings 的一个 mega 成员页，随宿主一起发布，共用一个版本号与发布流程；新增优化只改注册表（追加 def），单独发包只会增加维护负担。

## 许可

Apache-2.0