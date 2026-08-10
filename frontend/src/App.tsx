import { createBrowserRouter, Outlet } from 'react-router-dom';
import { useEffect, lazy, Suspense } from 'react';
import { TopBar } from './components/layout/TopBar';
import { BottomNav } from './components/layout/BottomNav';
import { Aurora } from './components/layout/Aurora';
import { ToastContainer } from './components/ui/Toast';
import { useProgressStore } from './store/useProgressStore';
import { useSettingsStore } from './store/useSettingsStore';
import { applyTheme } from './utils/themeSchemes';
import { ErrorBoundary } from './components/ErrorBoundary';

// Lazy-load page components for code splitting — reduces initial bundle size
const Dashboard = lazy(() => import('./pages/Dashboard').then(m => ({ default: m.Dashboard })));
const Library = lazy(() => import('./pages/Library').then(m => ({ default: m.Library })));
const Study = lazy(() => import('./pages/Study').then(m => ({ default: m.Study })));
const Wordbook = lazy(() => import('./pages/Wordbook').then(m => ({ default: m.Wordbook })));
const Stats = lazy(() => import('./pages/Stats').then(m => ({ default: m.Stats })));
const Settings = lazy(() => import('./pages/Settings').then(m => ({ default: m.Settings })));
const Shop = lazy(() => import('./pages/Shop').then(m => ({ default: m.Shop })));
const ImportPage = lazy(() => import('./pages/ImportPage').then(m => ({ default: m.ImportPage })));
const Game = lazy(() => import('./pages/Game').then(m => ({ default: m.Game })));

function PageLoader() {
  return (
    <div className="flex items-center justify-center min-h-[40vh]">
      <div className="animate-pulse text-sm" style={{ color: 'var(--text-tertiary)' }}>
        加载中...
      </div>
    </div>
  );
}

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
    }).catch(() => {
      // 后端不可用时静默失败，本地数据仍然可用
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
          <Suspense fallback={<PageLoader />}>
            <Outlet />
          </Suspense>
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
      { path: '*', element: <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4"><p className="text-2xl font-bold" style={{color:'var(--text)'}}>页面不存在</p><p className="text-sm" style={{color:'var(--text-tertiary)'}}>找不到对应的页面</p><a href="/" className="mt-4 px-6 py-2 rounded-xl text-white font-medium no-underline" style={{background:'var(--teal-600)'}}>返回首页</a></div> },
    ],
  },
]);

export default router;
