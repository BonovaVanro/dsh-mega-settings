/**
 * 运行环境判定：是否运行在官方 DSH 桌面版外壳里。
 *
 * 依据（均由**桌面壳自己的 preload** 写入，web 端不会有）：
 *  - `<html data-platform="…">`：官方 layout 明确说明「仅由桌面 preload 设置」
 *    （见 ui-layout 文档 `window-chrome-seat`：`html[data-platform='darwin']`，set only by the desktop preload）；
 *  - `<html data-windows-titlebar>`：Windows 桌面壳写入（标题栏高度变量同时发布）；
 *  - `location.protocol === 'dsh-app:'`：桌面应用文档的私有协议（SCHEME = "dsh-app"）。
 *
 * 用途：桌面专属的优化项（依赖 Windows titlebar / frame / 原生窗口按钮）**只在桌面版**
 * 注册与展示 —— web 端既看不到这些开关，也不会注入相关样式。
 */

/** 判定当前是否在桌面壳内。只读，不做任何写入。 */
function inDesktopShell(): boolean {
  if (typeof document === 'undefined') return false
  try {
    const root = document.documentElement
    if (root !== null && (root.hasAttribute('data-platform') || root.hasAttribute('data-windows-titlebar'))) {
      return true
    }
    if (typeof location !== 'undefined' && location.protocol === 'dsh-app:') return true
  } catch {
    /* 判定失败按 web 处理（保守：不展示桌面专属项） */
  }
  return false
}

/** 测试注入点：undefined = 用真实判定；否则用注入值覆盖。 */
let override: boolean | undefined

/** 仅供测试：强制平台判定结果（传 undefined 恢复真实判定）。 */
export function __setDesktopShellForTest(value: boolean | undefined): void {
  override = value
}

export function isDesktopShell(): boolean {
  return override ?? inDesktopShell()
}
