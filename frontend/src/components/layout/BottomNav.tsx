/**
 * BottomNav — Mobile bottom navigation bar.
 *
 * Features:
 * - 5 primary navigation destinations
 * - Active indicator with top accent bar
 * - Glass morphism background
 * - Safe area inset support
 */
import { useNavigate, useLocation } from 'react-router-dom';
import {
  Home,
  Library,
  GraduationCap,
  BarChart3,
  ShoppingBag,
  Settings,
} from 'lucide-react';
import { sfx } from '../../utils/sfx';

interface NavItem {
  path: string;
  label: string;
  icon: typeof Home;
}

const NAV_ITEMS: NavItem[] = [
  { path: '/', label: '首页', icon: Home },
  { path: '/library', label: '词库', icon: Library },
  { path: '/study', label: '学习', icon: GraduationCap },
  { path: '/stats', label: '统计', icon: BarChart3 },
  { path: '/shop', label: '商店', icon: ShoppingBag },
  { path: '/settings', label: '设置', icon: Settings },
];

export function BottomNav() {
  const navigate = useNavigate();
  const location = useLocation();

  const isActive = (path: string): boolean => {
    if (path === '/') return location.pathname === '/';
    return location.pathname.startsWith(path);
  };

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-30 flex items-center justify-around px-2 py-2 glass sm:hidden"
      style={{
        background: 'color-mix(in srgb, var(--surface) 85%, transparent)',
        borderTop: '1px solid var(--border-light)',
        paddingBottom: 'env(safe-area-inset-bottom, 0px)',
      }}
    >
      {NAV_ITEMS.map((item) => {
        const active = isActive(item.path);
        const Icon = item.icon;
        return (
          <button
            key={item.path}
            onClick={() => {
              sfx.navigate();
              navigate(item.path);
            }}
            className="relative flex flex-col items-center justify-center gap-0.5 px-3 py-1.5 rounded-xl cursor-pointer min-w-[56px] transition-all"
            style={{
              color: active ? 'var(--teal-600)' : 'var(--text-tertiary)',
            }}
          >
            {/* Active top indicator */}
            {active && (
              <div
                className="absolute top-0 left-1/2 -translate-x-1/2 rounded-full"
                style={{
                  width: 24,
                  height: 3,
                  background: 'var(--teal-500)',
                  animation: 'fadeIn 0.3s ease',
                }}
              />
            )}
            <Icon
              size={22}
              strokeWidth={active ? 2.5 : 2}
              style={{
                transform: active ? 'translateY(-1px)' : 'none',
                transition: 'transform 0.2s ease',
              }}
            />
            <span
              className="text-[11px] font-medium"
              style={{ opacity: active ? 1 : 0.7 }}
            >
              {item.label}
            </span>
          </button>
        );
      })}
    </nav>
  );
}
