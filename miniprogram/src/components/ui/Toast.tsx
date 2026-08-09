/**
 * ToastContainer —— 对齐 web 端 components/ui/Toast.tsx。
 * 用 useUIStore 里的 toasts 队列渲染；页面根部挂一次即可。
 * 相比 Taro.showToast 的优势：可堆叠、可自定义类型配色、不遮挡 loading。
 */
import { View, Text } from '@tarojs/components';
import { useUIStore } from '../../store/useUIStore';
import type { ToastType } from '../../store/useUIStore';
import { Icon } from '../Icon';
import './ui.scss';

const ICONS: Record<ToastType, string> = {
  success: 'check',
  error: 'x',
  info: 'info',
  warning: 'alert',
};

const COLORS: Record<ToastType, string> = {
  success: '#16a34a',
  error: '#dc2626',
  info: '#0d9488',
  warning: '#d97706',
};

export function ToastContainer() {
  const toasts = useUIStore((s) => s.toasts);
  const removeToast = useUIStore((s) => s.removeToast);

  if (toasts.length === 0) return null;

  return (
    <View className="wf-toasts">
      {toasts.map((t) => (
        <View
          key={t.id}
          className="wf-toast"
          style={{ borderLeft: `6rpx solid ${COLORS[t.type]}` }}
          onClick={() => removeToast(t.id)}
        >
          <Icon name={ICONS[t.type]} size={16} color={COLORS[t.type]} />
          <Text className="wf-toast__msg">{t.message}</Text>
        </View>
      ))}
    </View>
  );
}
