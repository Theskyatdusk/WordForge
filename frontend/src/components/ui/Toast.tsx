/**
 * Toast — Toast notification component.
 * Renders all toasts from the UI store as a stack at the top of the screen.
 */
import { CheckCircle2, XCircle, Info, AlertTriangle, X } from 'lucide-react';
import { useUIStore } from '../../store/useUIStore';
import type { ToastMessage } from '../../store/useUIStore';

const ICONS = {
  success: CheckCircle2,
  error: XCircle,
  info: Info,
  warning: AlertTriangle,
};

const COLORS = {
  success: { bg: 'rgba(22,163,74,0.12)', fg: '#16a34a', border: 'rgba(22,163,74,0.25)' },
  error: { bg: 'rgba(220,38,38,0.12)', fg: '#dc2626', border: 'rgba(220,38,38,0.25)' },
  info: { bg: 'rgba(20,184,166,0.12)', fg: 'var(--teal-600)', border: 'rgba(20,184,166,0.25)' },
  warning: { bg: 'rgba(245,158,11,0.12)', fg: 'var(--amber-500)', border: 'rgba(245,158,11,0.25)' },
};

function ToastItem({ toast }: { toast: ToastMessage }) {
  const removeToast = useUIStore((s) => s.removeToast);
  const Icon = ICONS[toast.type];
  const colors = COLORS[toast.type];

  return (
    <div
      className="flex items-start gap-3 px-4 py-3 rounded-xl animate-slide-down"
      style={{
        background: 'var(--surface)',
        boxShadow: 'var(--shadow-lg)',
        border: `1px solid ${colors.border}`,
        minWidth: '280px',
        maxWidth: '400px',
      }}
    >
      <div
        className="flex items-center justify-center w-8 h-8 rounded-full flex-shrink-0"
        style={{ background: colors.bg, color: colors.fg }}
      >
        <Icon size={18} />
      </div>
      <p
        className="flex-1 text-sm font-medium leading-snug"
        style={{ color: 'var(--text)' }}
      >
        {toast.message}
      </p>
      <button
        onClick={() => removeToast(toast.id)}
        className="flex items-center justify-center w-6 h-6 rounded-full cursor-pointer flex-shrink-0"
        style={{ color: 'var(--text-tertiary)' }}
      >
        <X size={14} />
      </button>
    </div>
  );
}

export function ToastContainer() {
  const toasts = useUIStore((s) => s.toasts);

  if (toasts.length === 0) return null;

  return (
    <div
      className="fixed top-4 left-1/2 -translate-x-1/2 z-[60] flex flex-col gap-2 pointer-events-none"
      style={{ paddingTop: 'env(safe-area-inset-top, 0px)' }}
    >
      {toasts.map((toast) => (
        <div key={toast.id} className="pointer-events-auto">
          <ToastItem toast={toast} />
        </div>
      ))}
    </div>
  );
}
