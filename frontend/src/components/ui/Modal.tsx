/**
 * Modal — Modal dialog component.
 * Renders as a fixed overlay with a centered card.
 */
import type { ReactNode } from 'react';
import { useEffect } from 'react';
import { X } from 'lucide-react';
import { sfx } from '../../utils/sfx';

interface ModalProps {
  open: boolean;
  onClose: () => void;
  children: ReactNode;
  title?: string;
  maxWidth?: string;
  closeOnBackdrop?: boolean;
}

export function Modal({
  open,
  onClose,
  children,
  title,
  maxWidth = '480px',
  closeOnBackdrop = true,
}: ModalProps) {
  useEffect(() => {
    if (open) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        sfx.click();
        onClose();
      }
    };
    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 animate-fade-in"
      style={{ background: 'rgba(0,0,0,0.5)' }}
      onClick={(e) => {
        if (closeOnBackdrop && e.target === e.currentTarget) {
          sfx.click();
          onClose();
        }
      }}
    >
      <div
        className="relative w-full rounded-2xl animate-scale-in"
        style={{
          maxWidth,
          background: 'var(--surface)',
          boxShadow: 'var(--shadow-lg)',
          maxHeight: '90vh',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        {title && (
          <div
            className="flex items-center justify-between px-5 py-4 flex-shrink-0"
            style={{ borderBottom: '1px solid var(--border-light)' }}
          >
            <h2 className="text-lg font-bold" style={{ color: 'var(--text)' }}>
              {title}
            </h2>
            <button
              onClick={() => {
                sfx.click();
                onClose();
              }}
              className="flex items-center justify-center w-8 h-8 rounded-full cursor-pointer hover:scale-110"
              style={{ background: 'var(--surface-3)', color: 'var(--text-secondary)' }}
            >
              <X size={18} />
            </button>
          </div>
        )}
        {!title && (
          <button
            onClick={() => {
              sfx.click();
              onClose();
            }}
            className="absolute top-3 right-3 z-10 flex items-center justify-center w-8 h-8 rounded-full cursor-pointer hover:scale-110"
            style={{ background: 'var(--surface-3)', color: 'var(--text-secondary)' }}
          >
            <X size={18} />
          </button>
        )}
        <div className="overflow-y-auto p-5">{children}</div>
      </div>
    </div>
  );
}
