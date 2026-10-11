/**
 * 可用性排查日志（前缀 [mgs]；不改变任何行为，可在控制台按 [mgs] 过滤）。
 *
 * 构建戳由 scripts/build-client.mjs 在打包时注入（MGS_BUILD，形如 0.2.0-rc.1+<short sha>），
 * 用于确认「线上跑的是不是最新代码」——这是本项目反复排查的第一问题。
 */
declare const MGS_BUILD: string

export function trace(...args: unknown[]): void {
  try {
    // eslint-disable-next-line no-console
    console.info('[mgs]', MGS_BUILD, ...args)
  } catch {
    /* 忽略 */
  }
}
