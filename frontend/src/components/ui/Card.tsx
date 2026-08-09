/**
 * Card — Reusable card component with premium depth.
 *
 * Features:
 * - Configurable padding (none/sm/md/lg)
 * - Optional hover lift effect
 * - Consistent border, shadow, and background
 * - Smooth transitions
 */
import type { HTMLAttributes, ReactNode } from 'react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode;
  hover?: boolean;
  padding?: 'none' | 'sm' | 'md' | 'lg';
}

const paddingStyles = {
  none: '',
  sm: 'p-3',
  md: 'p-4',
  lg: 'p-6',
};

export function Card({
  children,
  hover = false,
  padding = 'md',
  className,
  style,
  onClick,
  ...rest
}: CardProps) {
  return (
    <div
      className={twMerge(
        clsx(
          'rounded-2xl',
          paddingStyles[padding],
          hover && 'cursor-pointer hover:shadow-lg hover:-translate-y-0.5 active:translate-y-0 active:scale-[0.99]',
          className,
        ),
      )}
      style={{
        background: 'var(--surface)',
        border: '1px solid var(--border-light)',
        boxShadow: 'var(--shadow-sm)',
        transition: 'transform 0.2s var(--ease-out), box-shadow 0.2s var(--ease-out), border-color 0.2s var(--ease-out)',
        ...style,
      }}
      onClick={onClick}
      {...rest}
    >
      {children}
    </div>
  );
}
