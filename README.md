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
- **版本自检**：宿主启动校验当前 dsh 版本线，不合规时控制台警示，不阻断使用。

<!-- TODO(截图): 图片就绪后填入各 src（建议放 assets/ 目录，宽度 ≤1280px），可增删条目 -->
## 界面预览
### 收纳模式
<div align="center">
  <img width="1200" height="1200" alt="收纳模式：分组卡片总览" src="https://github.com/user-attachments/assets/46b2b7b2-fab6-4195-a847-cc6fc0463e83" />
  <br />
  <sub>图 1 · 收纳模式（collect）——分组卡片总览</sub>
</div>
<br />

<div align="center">
  <img width="1200" height="1200" alt="收纳模式：分组卡片总览" src="https://github.com/user-attachments/assets/c5223c23-c231-4ba7-80a1-05663d0c53a9" />
  <br />
  <sub>图 2 · 收纳模式（collect）——子页面预览</sub>
</div>
<br />

### 折叠模式
<div align="center">
  <img width="1200" height="1200" alt="折叠模式：接管官方设置弹层" src="https://github.com/user-attachments/assets/fc126319-42a8-4ecc-883a-5870f5db4a14" />
  <br />
  <sub>图 3 · 折叠模式（fold）——接管官方设置弹层</sub>
</div>
<br />

<div align="center">
  <img width="1200" height="1200" alt="折叠模式：接管官方设置弹层" src="https://github.com/user-attachments/assets/50d801e0-63a1-4706-bf2e-be853403d646" />
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

需要 dsh v0.1.1-* 。提供 GitHub tag / 本地包 / npm 三种安装方式。

**GitHub tag**

```
dsh plugin --profile web add github:BonovaVanro/dsh-mega-settings#v0.1.1
```

**本地包**

```
dsh plugin --profile web add dsh-mega-settings-0.1.1.tgz
```

**npm**

```
dsh plugin --profile web add dsh-mega-settings@0.1.1
```

## 快速上手

1. 在设置中找到 mega-settings，切换**收纳 / 折叠**模式（两模式数据互通，随时可换）；
2. **收纳模式**：进入「收纳配置」——卡片即第三方设置入口；拖到某分组或未分组松手即归位；悬停分组标题可改名/删除；拖分组标题整体排序；
3. **折叠模式**：打开官方设置弹层，展开「折叠设置」——拖动行重排；拖到上方导航区＝释放（成为独立入口）；从顶部拖回折叠体＝重新接管；
4. 释放/接管只改变入口归属，不会删除任何配置。

## 适用 dsh 版本与兼容性

- **适用 dsh 版本：0.1.1-rc.1、0.1.1-rc.2**；
- 宿主启动会按版本策略自检（默认 `= 0.1.1-*`，即 dsh 0.1.1 全预发布线）；其他版本控制台会打印
  `dsh-mega-settings 可能不适配 dsh <版本> 版本，请慎重使用`，插件仍可加载使用；
- 维护者可自行调整 `src/index.ts` 的 `DSCH_COMPAT_POLICY`（支持 > / < / = 与通配、数组）。

## 许可

Apache-2.0