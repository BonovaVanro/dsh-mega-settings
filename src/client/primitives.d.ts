/**
 * @deepseek-ai/dsh-client-ui-primitives 官方图标模块（虚拟包，运行时由官方 bundle 注册；
 * 类型面本地收窄——仅声明本工程用到的图标）。
 */
declare module '@deepseek-ai/dsh-client-ui-primitives' {
  import type { ReactNode } from 'react'
  interface IconProps {
    size?: number
    className?: string
  }
  export const IconSettingsOutline14: (props: IconProps) => ReactNode
  export const IconSettingsOutline16: (props: IconProps) => ReactNode
  export const IconCloseOutline16: (props: IconProps) => ReactNode
  export const IconDataOutline16: (props: IconProps) => ReactNode
  export const IconAgentPresetOutline16: (props: IconProps) => ReactNode
  export const IconPersonalizationOutline16: (props: IconProps) => ReactNode
}
