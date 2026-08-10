/**
 * UI Store — Zustand store for UI state.
 * Manages current route, theme, toasts, modals, and sidebar visibility.
 */
import { create } from 'zustand';

export interface ToastMessage {
  id: string;
  message: string;
  type: 'success' | 'error' | 'info' | 'warning';
  duration?: number;
}

interface UIState {
  // Navigation
  currentPath: string;
  setCurrentPath: (path: string) => void;

  // Theme
  theme: 'light' | 'dark';
  toggleTheme: () => void;
  setTheme: (theme: 'light' | 'dark') => void;

  // Toasts
  toasts: ToastMessage[];
  addToast: (message: string, type?: ToastMessage['type'], duration?: number) => void;
  removeToast: (id: string) => void;

  // Modal
  modalOpen: boolean;
  modalContent: React.ReactNode | null;
  openModal: (content: React.ReactNode) => void;
  closeModal: () => void;

  // Sidebar (mobile)
  sidebarOpen: boolean;
  toggleSidebar: () => void;
  setSidebarOpen: (open: boolean) => void;

  // Loading states
  loading: boolean;
  setLoading: (loading: boolean) => void;
}

function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

function getInitialTheme(): 'light' | 'dark' {
  if (typeof window === 'undefined') return 'light';
  try {
    const stored = localStorage.getItem('wordforge_theme');
    if (stored === 'dark' || stored === 'light') return stored;
  } catch {
    // storage unavailable
  }
  // Default to light theme (user prefers white background)
  return 'light';
}

export const useUIStore = create<UIState>((set, get) => ({
  currentPath: '/',
  setCurrentPath: (path) => set({ currentPath: path }),

  theme: getInitialTheme(),
  toggleTheme: () => {
    const newTheme = get().theme === 'light' ? 'dark' : 'light';
    set({ theme: newTheme });
    if (typeof document !== 'undefined') {
      document.documentElement.setAttribute('data-theme', newTheme);
    }
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem('wordforge_theme', newTheme);
      } catch {
        // storage unavailable
      }
    }
  },
  setTheme: (theme) => {
    set({ theme });
    if (typeof document !== 'undefined') {
      document.documentElement.setAttribute('data-theme', theme);
    }
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem('wordforge_theme', theme);
      } catch {
        // storage unavailable
      }
    }
  },

  toasts: [],
  addToast: (message, type = 'info', duration = 3000) => {
    const id = generateId();
    set((state) => {
      // Cap concurrent toasts to prevent timer accumulation
      const MAX_TOASTS = 5;
      const newToasts = [...state.toasts, { id, message, type, duration }];
      // FIFO eviction: remove oldest if over limit
      if (newToasts.length > MAX_TOASTS) {
        newToasts.splice(0, newToasts.length - MAX_TOASTS);
      }
      return { toasts: newToasts };
    });
    if (duration > 0) {
      setTimeout(() => {
        get().removeToast(id);
      }, duration);
    }
  },
  removeToast: (id) =>
    set((state) => ({
      toasts: state.toasts.filter((t) => t.id !== id),
    })),

  modalOpen: false,
  modalContent: null,
  openModal: (content) => set({ modalOpen: true, modalContent: content }),
  closeModal: () => set({ modalOpen: false, modalContent: null }),

  sidebarOpen: false,
  toggleSidebar: () => set((state) => ({ sidebarOpen: !state.sidebarOpen })),
  setSidebarOpen: (open) => set({ sidebarOpen: open }),

  loading: false,
  setLoading: (loading) => set({ loading }),
}));
