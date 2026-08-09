/**
 * TopBar — Header with logo, desktop nav, theme toggle, streak badge.
 *
 * Features:
 * - Glass morphism effect with saturation
 * - Desktop navigation links (hidden on mobile)
 * - Streak badge with flame icon
 * - Theme toggle with sun/moon icon
 * - Library shortcut button
 */
import { useNavigate, useLocation } from 'react-router-dom';
import { Flame, Moon, Sun, BookOpen, Home, GraduationCap, BarChart3, ShoppingBag, Settings as SettingsIcon } from 'lucide-react';
import { useUIStore } from '../../store/useUIStore';
import { useProgressStore } from '../../store/useProgressStore';
import { sfx } from '../../utils/sfx';

const DESKTOP_NAV = [
  { path: '/', label: '首页', icon: Home },
  { path: '/library', label: '词库', icon: BookOpen },
  { path: '/study', label: '学习', icon: GraduationCap },
  { path: '/stats', label: '统计', icon: BarChart3 },
  { path: '/shop', label: '商店', icon: ShoppingBag },
];

export function TopBar() {
  const navigate = useNavigate();
  const location = useLocation();
  const theme = useUIStore((s) => s.theme);
  const toggleTheme = useUIStore((s) => s.toggleTheme);
  const streak = useProgressStore((s) => s.streak);

  const handleThemeToggle = () => {
    sfx.toggle();
    toggleTheme();
  };

  const isActive = (path: string): boolean => {
    if (path === '/') return location.pathname === '/';
    return location.pathname.startsWith(path);
  };

  return (
    <header
      className="glass sticky top-0 z-30 flex items-center justify-between px-4 py-3"
      style={{
        background: 'color-mix(in srgb, var(--surface) 75%, transparent)',
        borderBottom: '1px solid var(--border-light)',
      }}
    >
      {/* Logo */}
      <button
        onClick={() => {
          sfx.navigate();
          navigate('/');
        }}
        className="flex items-center gap-2.5 cursor-pointer group"
      >
        <div
          className="flex items-center justify-center w-9 h-9 rounded-xl text-white font-bold text-lg transition-transform group-hover:scale-110 group-active:scale-95"
          style={{
            background: 'linear-gradient(135deg, var(--teal-500), var(--teal-700))',
            boxShadow: '0 2px 12px rgba(13,148,136,0.35)',
          }}
        >
          W
        </div>
        <span
          className="font-display text-xl font-bold tracking-tight hidden xs:block"
          style={{ color: 'var(--text)' }}
        >
          WordForge
        </span>
      </button>

      {/* Desktop nav links */}
      <nav className="hidden md:flex items-center gap-1">
        {DESKTOP_NAV.map((item) => {
          const active = isActive(item.path);
          const Icon = item.icon;
          return (
            <button
              key={item.path}
              onClick={() => {
                sfx.navigate();
                navigate(item.path);
              }}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-sm font-medium cursor-pointer transition-all"
              style={{
                background: active ? 'rgba(20,184,166,0.1)' : 'transparent',
                color: active ? 'var(--teal-600)' : 'var(--text-secondary)',
              }}
              onMouseEnter={(e) => {
                if (!active) {
                  e.currentTarget.style.background = 'var(--surface-3)';
                  e.currentTarget.style.color = 'var(--text)';
                }
              }}
              onMouseLeave={(e) => {
                if (!active) {
                  e.currentTarget.style.background = 'transparent';
                  e.currentTarget.style.color = 'var(--text-secondary)';
                }
              }}
            >
              <Icon size={16} />
              {item.label}
            </button>
          );
        })}
      </nav>

      {/* Right actions */}
      <div className="flex items-center gap-2">
        {/* Streak badge */}
        <div
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-semibold transition-transform hover:scale-105"
          style={{
            background: streak.current > 0 ? 'rgba(251,191,36,0.12)' : 'var(--surface-3)',
            color: streak.current > 0 ? 'var(--amber-500)' : 'var(--text-tertiary)',
          }}
          title={streak.current > 0 ? `连续打卡 ${streak.current} 天` : '今日未打卡'}
        >
          <Flame size={16} fill={streak.current > 0 ? 'currentColor' : 'none'} />
          <span>{streak.current}</span>
        </div>

        {/* Theme toggle */}
        <button
          onClick={handleThemeToggle}
          className="flex items-center justify-center w-9 h-9 rounded-full cursor-pointer hover:scale-110 active:scale-95 transition-transform"
          style={{ background: 'var(--surface-3)', color: 'var(--text-secondary)' }}
          aria-label="切换主题"
        >
          {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
        </button>

        {/* Settings button — visible on all screen sizes */}
        <button
          onClick={() => {
            sfx.navigate();
            navigate('/settings');
          }}
          className="flex items-center justify-center w-9 h-9 rounded-full cursor-pointer hover:scale-110 active:scale-95 transition-transform"
          style={{
            background: isActive('/settings') ? 'rgba(20,184,166,0.1)' : 'var(--surface-3)',
            color: isActive('/settings') ? 'var(--teal-600)' : 'var(--text-secondary)',
          }}
          aria-label="设置"
        >
          <SettingsIcon size={18} />
        </button>
      </div>
    </header>
  );
}
