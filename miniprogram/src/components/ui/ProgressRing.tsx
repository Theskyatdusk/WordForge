/**
 * ProgressRing —— 对齐 web 端 components/ui/ProgressRing.tsx。
 *
 * 小程序适配说明：
 * 微信小程序不支持内联 <svg> 标签，所以这里把 SVG 序列化成 data-URI，
 * 交给 <Image> 渲染。CSS 变量在 data-URI 里不生效，因此颜色必须传具体色值
 * （默认取 teal-500 / border 的字面量）。
 */
import { View, Image } from '@tarojs/components';
import type { ReactNode } from 'react';
import './ui.scss';

interface ProgressRingProps {
  /** 进度值 0-1（max=100 时传 0-100） */
  value: number;
  max?: number;
  /** 尺寸，单位 px（会换算成 rpx 展示） */
  size?: number;
  strokeWidth?: number;
  /** 环颜色，必须是具体色值，不能用 var() */
  color?: string;
  trackColor?: string;
  showText?: boolean;
  children?: ReactNode;
}

export function ProgressRing({
  value,
  max = 1,
  size = 60,
  strokeWidth = 5,
  color = '#14b8a6',
  trackColor = '#e2e8f0',
  showText = false,
  children,
}: ProgressRingProps) {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const normalized = Math.max(0, Math.min(max, value));
  const progress = max > 0 ? normalized / max : 0;
  const offset = circumference - progress * circumference;
  const percent = Math.round(progress * 100);
  const c = size / 2;

  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">` +
    `<g transform="rotate(-90 ${c} ${c})">` +
    `<circle cx="${c}" cy="${c}" r="${radius}" fill="none" stroke="${trackColor}" stroke-width="${strokeWidth}"/>` +
    `<circle cx="${c}" cy="${c}" r="${radius}" fill="none" stroke="${color}" stroke-width="${strokeWidth}" ` +
    `stroke-linecap="round" stroke-dasharray="${circumference}" stroke-dashoffset="${offset}"/>` +
    `</g></svg>`;

  const src = `data:image/svg+xml,${encodeURIComponent(svg)}`;
  const px = `${size * 2}rpx`;

  return (
    <View className="wf-ring" style={{ width: px, height: px }}>
      <Image className="wf-ring__svg" src={src} style={{ width: px, height: px }} />
      <View className="wf-ring__center">
        {children ??
          (showText ? (
            <View className="wf-ring__text" style={{ fontSize: `${size * 0.56}rpx` }}>
              {percent}%
            </View>
          ) : null)}
      </View>
    </View>
  );
}
