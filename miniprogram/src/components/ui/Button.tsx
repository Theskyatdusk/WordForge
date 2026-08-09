/**
 * Button —— 对齐 web 端 components/ui/Button.tsx（5 变体 / 3 尺寸 / 全宽 / 点击反馈）。
 * 差异：<button> → <View>（小程序 Button 组件自带样式包袱，且会拦截 flex 布局）。
 */
import { View } from '@tarojs/components';
import type { ReactNode, CSSProperties } from 'react';
import { sfx } from '../../utils/sfx';
import './ui.scss';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'success';
type Size = 'sm' | 'md' | 'lg';

interface ButtonProps {
  variant?: Variant;
  size?: Size;
  children: ReactNode;
  fullWidth?: boolean;
  playSound?: boolean;
  disabled?: boolean;
  className?: string;
  style?: CSSProperties;
  onClick?: () => void;
}

export function Button({
  variant = 'primary',
  size = 'md',
  children,
  fullWidth,
  playSound = true,
  disabled,
  className = '',
  style,
  onClick,
}: ButtonProps) {
  const handle = () => {
    if (disabled) return;
    if (playSound) sfx.click();
    onClick?.();
  };

  return (
    <View
      className={[
        'wf-btn',
        `wf-btn--${variant}`,
        `wf-btn--${size}`,
        fullWidth ? 'wf-btn--full' : '',
        disabled ? 'wf-btn--disabled' : '',
        className,
      ]
        .filter(Boolean)
        .join(' ')}
      style={style}
      hoverClass={disabled ? 'none' : 'wf-btn--pressed'}
      hoverStayTime={80}
      onClick={handle}
    >
      {children}
    </View>
  );
}
