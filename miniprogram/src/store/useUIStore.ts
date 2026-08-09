/**
 * UI Store —— 对齐 web 端 frontend/src/store/useUIStore.ts。
 * 差异：
 *   - 主题不再写 document.documentElement，改为暴露 theme 字段，
 *     由页面根 View 通过 usePageTheme() 拼出 className。
 *   - Modal 不再锁 body 滚动（小程序用 catchMove 阻止穿透）。
 */
import { create } from 'zustand';
import Taro from '@tarojs/taro';
import { storage } from '../utils/storage';

const THEME_KEY = 'wordforge_theme';

export type Theme = 'light' | 'dark';
export type ToastType = 'success' | 'error' | 'info' | 'warning';

export interface Toast {
  id: number;
  message: string;
  type: ToastType;
}

interface UIState {
  theme: Theme;
  toasts: Toast[];
  modalOpen: boolean;
  loading: boolean;

  setTheme: (theme: Theme) => void;
  toggleTheme: () => void;
  addToast: (message: string, type?: ToastType) => void;
  removeToast: (id: number) => void;
  openModal: () => void;
  closeModal: () => void;
  setLoading: (loading: boolean) => void;
}

function getInitialTheme(): Theme {
  const saved = storage.get<Theme>(THEME_KEY, undefined);
  if (saved === 'light' || saved === 'dark') return saved;
  // 跟随微信客户端的深色模式
  try {
    const info = Taro.getSystemInfoSync() as { theme?: string };
    if (info && info.theme === 'dark') return 'dark';
  } catch {
    /* 低版本基础库无 theme 字段 */
  }
  return 'light';
}

let toastId = 0;

export const useUIStore = create<UIState>((set, get) => ({
  theme: getInitialTheme(),
  toasts: [],
  modalOpen: false,
  loading: false,

  setTheme: (theme: Theme) => {
    storage.set(THEME_KEY, theme);
    set({ theme });
  },

  toggleTheme: () => {
    const next: Theme = get().theme === 'dark' ? 'light' : 'dark';
    get().setTheme(next);
  },

  addToast: (message: string, type: ToastType = 'info') => {
    const id = ++toastId;
    set({ toasts: [...get().toasts, { id, message, type }] });
    setTimeout(() => get().removeToast(id), 2600);
  },

  removeToast: (id: number) => {
    set({ toasts: get().toasts.filter((t) => t.id !== id) });
  },

  openModal: () => set({ modalOpen: true }),
  closeModal: () => set({ modalOpen: false }),
  setLoading: (loading: boolean) => set({ loading }),
}));

/**
 * 页面根 View 的主题类名。
 * 用法：const themeClass = usePageTheme();
 *      <View className={`wf-page ${themeClass}`}>
 */
export function usePageTheme(): string {
  const theme = useUIStore((s) => s.theme);
  return theme === 'dark' ? 'theme-dark' : '';
}
