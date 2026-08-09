/**
 * Button — Reusable button component with premium variants.
 *
 * Features:
 * - 5 variants: primary (gradient), secondary, ghost, danger, success
 * - 3 sizes: sm, md, lg
 * - Full width option
 * - Auto sound effect on click
 * - Smooth press animation
 */
import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { sfx } from '../../utils/sfx';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'success';
type Size = 'sm' | 'md' | 'lg';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  children: ReactNode;
  fullWidth?: boolean;
  playSound?: boolean;
}

const variantStyles: Record<Variant, string> = {
  primary: 'text-white',
  secondary: 'text-[var(--text)] border border-[var(--border)]',
  ghost: 'text-[var(--text-secondary)]',
  danger: 'text-white',
  success: 'text-white',
};

const variantBg: Record<Variant, string> = {
  primary: 'linear-gradient(135deg, var(--teal-500), var(--teal-700))',
  secondary: 'var(--surface-3)',
  ghost: 'transparent',
  danger: 'linear-gradient(135deg, #ef4444, #dc2626)',
  success: 'linear-gradient(135deg, #22c55e, #16a34a)',
};

const sizeStyles: Record<Size, string> = {
  sm: 'px-3.5 py-1.5 text-sm rounded-lg',
  md: 'px-4 py-2.5 text-sm rounded-xl',
  lg: 'px-6 py-3.5 text-base rounded-xl',
};

export function Button({
  variant = 'primary',
  size = 'md',
  children,
  fullWidth,
  playSound = true,
  className,
  onClick,
  disabled,
  style,
  ...rest
}: ButtonProps) {
  return (
    <button
      className={twMerge(
        clsx(
          'inline-flex items-center justify-center gap-2 font-semibold cursor-pointer select-none',
          'active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed disabled:active:scale-100',
          'hover:brightness-110 disabled:hover:brightness-100',
          variantStyles[variant],
          sizeStyles[size],
          fullWidth && 'w-full',
          className,
        ),
      )}
      style={{
        background: variantBg[variant],
        boxShadow: variant !== 'ghost' ? 'var(--shadow-sm)' : 'none',
        ...style,
      }}
      onClick={(e) => {
        if (playSound) sfx.click();
        onClick?.(e);
      }}
      disabled={disabled}
      {...rest}
    >
      {children}
    </button>
  );
}
