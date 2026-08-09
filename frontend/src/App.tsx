import { createBrowserRouter, Outlet } from 'react-router-dom';
import { useEffect } from 'react';
import { TopBar } from './components/layout/TopBar';
import { BottomNav } from './components/layout/BottomNav';
import { Aurora } from './components/layout/Aurora';
import { ToastContainer } from './components/ui/Toast';
import { Dashboard } from './pages/Dashboard';
import { Library } from './pages/Library';
import { Study } from './pages/Study';
import { Wordbook } from './pages/Wordbook';
import { Stats } from './pages/Stats';
import { Settings } from './pages/Settings';
import { Shop } from './pages/Shop';
import { ImportPage } from './pages/ImportPage';
import { Game } from './pages/Game';
import { useProgressStore } from './store/useProgressStore';
import { useSettingsStore } from './store/useSettingsStore';
import { applyTheme } from './utils/themeSchemes';
import { ErrorBoundary } from './components/ErrorBoundary';

function Layout() {
  const loadProgress = useProgressStore((s) => s.loadFromStorage);
  const loadSettings = useSettingsStore((s) => s.loadFromStorage);
  const equippedTheme = useProgressStore((s) => s.equippedTheme);
  const syncFromBackend = useProgressStore((s) => s.syncFromBackend);

  useEffect(() => {
    loadProgress();
    loadSettings();
    syncFromBackend().then((restored) => {
      if (restored) {
        const t = useProgressStore.getState().equippedTheme;
        applyTheme(t);
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Apply purchased color theme whenever it changes
  useEffect(() => {
    applyTheme(equippedTheme);
  }, [equippedTheme]);

  return (
    <>
      <Aurora />
      <TopBar />
      <main
        className="relative z-10 mx-auto w-full max-w-4xl px-4 py-6 pb-24 sm:pb-8"
        style={{ minHeight: 'calc(100vh - 60px)' }}
      >
        <ErrorBoundary>
          <Outlet />
        </ErrorBoundary>
      </main>
      <BottomNav />
      <ToastContainer />
    </>
  );
}

export const router = createBrowserRouter([
  {
    element: <Layout />,
    children: [
      { path: '/', element: <Dashboard /> },
      { path: '/library', element: <Library /> },
      { path: '/study', element: <Study /> },
      { path: '/study/:chapterId', element: <Study /> },
      { path: '/wordbook', element: <Wordbook /> },
      { path: '/stats', element: <Stats /> },
      { path: '/settings', element: <Settings /> },
      { path: '/shop', element: <Shop /> },
      { path: '/import', element: <ImportPage /> },
      { path: '/game', element: <Game /> },
      { path: '*', element: <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4"><p className="text-2xl font-bold" style={{color:'var(--text)'}}>页面不存在</p><p className="text-sm" style={{color:'var(--text-tertiary)'}}>找不到对应的页面</p></div> },
    ],
  },
]);

export default router;
