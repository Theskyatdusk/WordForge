/**
 * PageShell —— 每个页面的统一外壳。
 *
 * 承担 web 端 App.tsx + Layout 的职责：
 *   - 应用主题类名（.theme-dark）与已购主题色变量
 *   - 应用字号档位
 *   - 首次进入时从本地存储恢复 store
 *   - 挂载 Toast 容器
 *
 * 用法：
 *   <PageShell>
 *     ...页面内容...
 *   </PageShell>
 */
import { View } from '@tarojs/components';
import { useEffect, useRef } from 'react';
import type { ReactNode } from 'react';
import { useUIStore } from '../../store/useUIStore';
import { useSettingsStore, fontSizeClass } from '../../store/useSettingsStore';
import { useProgressStore } from '../../store/useProgressStore';
import { themeVarsStyle } from '../../utils/themeSchemes';
import { ToastContainer } from './Toast';
import './ui.scss';

let _hydrated = false;

interface PageShellProps {
  children: ReactNode;
  /** 关闭底部 tabBar 占位（非 tab 页可设 false 以少留白） */
  tabBarSpace?: boolean;
  className?: string;
}

export function PageShell({ children, tabBarSpace = true, className = '' }: PageShellProps) {
  const theme = useUIStore((s) => s.theme);
  const settings = useSettingsStore((s) => s.settings);
  const loadSettings = useSettingsStore((s) => s.loadFromStorage);
  const loadProgress = useProgressStore((s) => s.loadFromStorage);
  const equippedTheme = useProgressStore((s) => s.equippedTheme);
  const mounted = useRef(false);

  useEffect(() => {
    if (mounted.current) return;
    mounted.current = true;
    // 全局只需水合一次，避免每个页面重复读存储
    if (!_hydrated) {
      _hydrated = true;
      loadSettings();
      loadProgress();
    }
  }, [loadSettings, loadProgress]);

  return (
    <View
      className={[
        'wf-page',
        theme === 'dark' ? 'theme-dark' : '',
        fontSizeClass(settings.fontSize),
        tabBarSpace ? '' : 'wf-page--no-tabbar',
        className,
      ]
        .filter(Boolean)
        .join(' ')}
      style={themeVarsStyle(equippedTheme)}
    >
      {children}
      <ToastContainer />
    </View>
  );
}
