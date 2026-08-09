/**
 * Theme color schemes for purchased shop themes.
 * Each theme overrides the primary brand color (teal) with a different hue.
 * Applied by setting CSS custom properties on document.documentElement.
 */

export interface ThemeScheme {
  id: string;
  name: string;
  emoji: string;
  vars: Record<string, string>;
}

export const THEME_SCHEMES: Record<string, ThemeScheme> = {
  theme_ocean: {
    id: 'theme_ocean',
    name: '深海蓝',
    emoji: '🌊',
    vars: {
      '--teal-300': '#93c5fd',
      '--teal-400': '#60a5fa',
      '--teal-500': '#3b82f6',
      '--teal-600': '#2563eb',
      '--teal-700': '#1d4ed8',
      '--teal-800': '#1e40af',
      '--teal-900': '#1e3a8a',
      '--shadow-glow': '0 0 24px rgba(59,130,246,0.15)',
    },
  },
  theme_forest: {
    id: 'theme_forest',
    name: '森林绿',
    emoji: '🌲',
    vars: {
      '--teal-300': '#6ee7b7',
      '--teal-400': '#34d399',
      '--teal-500': '#10b981',
      '--teal-600': '#059669',
      '--teal-700': '#047857',
      '--teal-800': '#065f46',
      '--teal-900': '#064e3b',
      '--shadow-glow': '0 0 24px rgba(16,185,129,0.15)',
    },
  },
  theme_sunset: {
    id: 'theme_sunset',
    name: '日落橙',
    emoji: '🌅',
    vars: {
      '--teal-300': '#fcd34d',
      '--teal-400': '#fbbf24',
      '--teal-500': '#f59e0b',
      '--teal-600': '#d97706',
      '--teal-700': '#b45309',
      '--teal-800': '#92400e',
      '--teal-900': '#78350f',
      '--shadow-glow': '0 0 24px rgba(245,158,11,0.15)',
    },
  },
  theme_aurora: {
    id: 'theme_aurora',
    name: '极光紫',
    emoji: '🌌',
    vars: {
      '--teal-300': '#c4b5fd',
      '--teal-400': '#a78bfa',
      '--teal-500': '#8b5cf6',
      '--teal-600': '#7c3aed',
      '--teal-700': '#6d28d9',
      '--teal-800': '#5b21b6',
      '--teal-900': '#4c1d95',
      '--shadow-glow': '0 0 24px rgba(139,92,246,0.15)',
    },
  },
  theme_sakura: {
    id: 'theme_sakura',
    name: '樱花粉',
    emoji: '🌸',
    vars: {
      '--teal-300': '#f9a8d4',
      '--teal-400': '#f472b6',
      '--teal-500': '#ec4899',
      '--teal-600': '#db2777',
      '--teal-700': '#be185d',
      '--teal-800': '#9d174d',
      '--teal-900': '#831843',
      '--shadow-glow': '0 0 24px rgba(236,72,153,0.15)',
    },
  },
  theme_midnight: {
    id: 'theme_midnight',
    name: '午夜黑',
    emoji: '🌃',
    vars: {
      '--teal-300': '#cbd5e1',
      '--teal-400': '#94a3b8',
      '--teal-500': '#64748b',
      '--teal-600': '#475569',
      '--teal-700': '#334155',
      '--teal-800': '#1e293b',
      '--teal-900': '#0f172a',
      '--shadow-glow': '0 0 24px rgba(100,116,139,0.15)',
    },
  },
};

/** CSS variable keys that themes override (used for cleanup) */
const THEME_VAR_KEYS = [
  '--teal-300', '--teal-400', '--teal-500', '--teal-600',
  '--teal-700', '--teal-800', '--teal-900', '--shadow-glow',
];

/**
 * 小程序适配：无法像 web 那样在 documentElement 上动态 setProperty，
 * 改为生成一段行内 style 字符串，由页面根 View 的 style 属性消费。
 *
 * 用法：<View className="wf-page" style={themeVarsStyle(equippedTheme)}>
 *
 * 传 null 返回空串（回落到 theme.scss 中的默认 teal 令牌）。
 */
export function themeVarsStyle(themeId: string | null): string {
  if (!themeId) return '';
  const scheme = THEME_SCHEMES[themeId];
  if (!scheme) return '';
  return Object.entries(scheme.vars)
    .map(([key, value]) => `${key}:${value}`)
    .join(';');
}

/** 主题会覆盖的变量名（调试/清理用） */
export function themeVarKeys(): string[] {
  return [...THEME_VAR_KEYS];
}
