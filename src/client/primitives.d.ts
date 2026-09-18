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
  /** 官方 Button（settings.action「打开配置文件」用；outline + sm） */
  export const Button: (props: {
    variant?: 'primary' | 'outline' | 'ghost'
    size?: 'sm' | 'md'
    disabled?: boolean
    onClick?: () => void
    children?: ReactNode
    className?: string
  }) => ReactNode
  /** 官方连接指示器（trigger 旁：connecting / disconnected / recovered + 重连） */
  export const ConnectionIndicator: (props: {
    state?: 'connecting' | 'disconnected' | 'recovered'
    disconnectedLabel?: string
    /** 连接指示器的悬停/聚焦动作文案（0.1.5-rc 线必填；多传无害） */
    reconnectLabel?: string
    connectingLabel?: string
    recoveredLabel?: string
    reconnectActionLabel?: string
    restartActionLabel?: string
    onReconnect?: () => void
  }) => ReactNode
}
