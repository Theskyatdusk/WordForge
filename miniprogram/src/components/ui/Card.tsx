/**
 * Card —— 对齐 web 端 components/ui/Card.tsx。
 * 差异：div → View；Tailwind class → SCSS class（见 ui.scss）。
 */
import { View } from '@tarojs/components';
import type { ReactNode, CSSProperties } from 'react';
import './ui.scss';

interface CardProps {
  children: ReactNode;
  hover?: boolean;
  padding?: 'none' | 'sm' | 'md' | 'lg';
  className?: string;
  style?: CSSProperties;
  onClick?: () => void;
}

export function Card({
  children,
  hover = false,
  padding = 'md',
  className = '',
  style,
  onClick,
}: CardProps) {
  return (
    <View
      className={`wf-card wf-card--p-${padding} ${hover ? 'wf-card--hover' : ''} ${className}`}
      style={style}
      onClick={onClick}
    >
      {children}
    </View>
  );
}
