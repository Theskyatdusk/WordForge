/**
 * Dashboard — Home page with overview stats, daily progress, and quick actions.
 *
 * Features:
 * - Time-based greeting with check-in button
 * - Stats cards (streak, level, coins) with staggered entrance
 * - Daily goal progress ring
 * - Mastery overview with animated progress bar
 * - Quick action grid with hover effects
 * - Level progress bar
 */
import { useMemo, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Flame,
  Trophy,
  Target,
  GraduationCap,
  Bookmark,
  Gamepad2,
  Coins,
  TrendingUp,
  Library as LibraryIcon,
  CheckCircle2,
  Award,
  Calendar,
} from 'lucide-react';
import { useProgressStore } from '../store/useProgressStore';
import { useSettingsStore } from '../store/useSettingsStore';
import { useUIStore } from '../store/useUIStore';
import { useVocab, getAllItems } from '../hooks/useVocab';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { ProgressRing } from '../components/ui/ProgressRing';
import { isDue } from '../utils/srs';
import { formatPercent } from '../utils/format';
import { sfx } from '../utils/sfx';
import { ACHIEVEMENTS, BADGES } from '../utils/achievements';

export function Dashboard() {
  const navigate = useNavigate();
  const { data } = useVocab();
  const streak = useProgressStore((s) => s.streak);
  const level = useProgressStore((s) => s.level);
  const coins = useProgressStore((s) => s.coins);
  const wordProgress = useProgressStore((s) => s.wordProgress);
  const studyHistory = useProgressStore((s) => s.studyHistory);
  const settings = useSettingsStore((s) => s.settings);
  const checkin = useProgressStore((s) => s.checkin);
  const achievements = useProgressStore((s) => s.achievements);
  const equippedBadge = useProgressStore((s) => s.equippedBadge);
  const checkAndUnlockAchievements = useProgressStore((s) => s.checkAndUnlockAchievements);
  const addToast = useUIStore((s) => s.addToast);
  const theme = useUIStore((s) => s.theme);
  const setTheme = useUIStore((s) => s.setTheme);

  // Apply theme on mount
  useEffect(() => {
    setTheme(theme);
  }, [theme, setTheme]);

  // Check and unlock achievements on mount
  useEffect(() => {
    const newOnes = checkAndUnlockAchievements();
    newOnes.forEach((a) => addToast(`🎉 成就解锁：${a.title}`, 'success', 4000));
  }, [checkAndUnlockAchievements, addToast]);

  const allItems = useMemo(() => getAllItems(data), [data]);

  const stats = useMemo(() => {
    let total = 0;
    let mastered = 0;
    let due = 0;
    for (const fi of allItems) {
      total++;
      const p = wordProgress[fi.wordId];
      if (p?.status === 'mastered') mastered++;
      if (isDue(p)) due++;
    }
    return { total, mastered, due };
  }, [allItems, wordProgress]);

  const todayStudy = useMemo(() => {
    // 使用本地日期，避免 toISOString() 返回 UTC 日期导致 UTC+8 晚 8 点后变成第二天
    const today = new Date().toLocaleDateString('sv-SE');
    return (
      studyHistory.find((s) => s.date === today) || {
        date: today,
        words_studied: 0,
        correct: 0,
        wrong: 0,
        sessions: 0,
        modes: {} as Record<string, number>,
      }
    );
  }, [studyHistory]);

  const dailyProgress = settings.dailyGoal > 0
    ? Math.min(100, Math.round((todayStudy.words_studied / settings.dailyGoal) * 100))
    : 0;

  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 60000);
    return () => clearInterval(timer);
  }, []);

  const greeting = useMemo(() => {
    const h = new Date().getHours();
    if (h < 6) return '夜深了';
    if (h < 11) return '早上好';
    if (h < 13) return '中午好';
    if (h < 18) return '下午好';
    return '晚上好';
  }, [now]);

  // 使用本地日期判断是否已打卡，避免 toISOString() 的 UTC 偏移问题
  const isCheckedIn = streak.last_check_in === new Date().toLocaleDateString('sv-SE');

  const equippedBadgeEmoji = useMemo(
    () => (equippedBadge ? BADGES.find((b) => b.id === equippedBadge)?.emoji : null),
    [equippedBadge],
  );

  const unlockedCount = achievements.length;
  const totalAchievements = ACHIEVEMENTS.length;

  const handleCheckin = () => {
    const success = checkin();
    if (success) {
      sfx.checkin();
    }
  };

  const quickActions = [
    {
      label: '开始学习',
      desc: stats.due > 0 ? `${stats.due} 词待复习` : '学习新词',
      icon: GraduationCap,
      color: 'var(--teal-600)',
      bg: 'rgba(20,184,166,0.12)',
      onClick: () => {
        sfx.navigate();
        navigate('/study');
      },
    },
    {
      label: '浏览词库',
      desc: `${stats.total} 个词汇`,
      icon: LibraryIcon,
      color: 'var(--violet-500)',
      bg: 'rgba(139,92,246,0.12)',
      onClick: () => {
        sfx.navigate();
        navigate('/library');
      },
    },
    {
      label: '生词本',
      desc: '收藏的单词',
      icon: Bookmark,
      color: '#f59e0b',
      bg: 'rgba(245,158,11,0.12)',
      onClick: () => {
        sfx.navigate();
        navigate('/wordbook');
      },
    },
    {
      label: '趣味游戏',
      desc: '边玩边学',
      icon: Gamepad2,
      color: '#ec4899',
      bg: 'rgba(236,72,153,0.12)',
      onClick: () => {
        sfx.navigate();
        navigate('/game');
      },
    },
  ];

  return (
    <div className="space-y-5 animate-fade-in">
      {/* Greeting + Check-in */}
      <div className="flex items-center justify-between animate-slide-up">
        <div>
          <h1 className="text-2xl font-bold font-display" style={{ color: 'var(--text)' }}>
            {greeting}
            {equippedBadgeEmoji && <span className="ml-2 text-xl">{equippedBadgeEmoji}</span>}
          </h1>
          <p className="text-sm mt-1" style={{ color: 'var(--text-secondary)' }}>
            {isCheckedIn ? '今日已打卡，继续保持' : '今天还没打卡哦'}
          </p>
        </div>
        {!isCheckedIn && (
          <Button size="sm" variant="primary" onClick={handleCheckin}>
            <Flame size={16} />
            打卡
          </Button>
        )}
      </div>

      {/* Stats Row */}
      <div className="grid grid-cols-3 gap-3">
        <Card padding="sm" className="flex flex-col items-center animate-slide-up stagger-1">
          <div
            className="flex items-center justify-center w-10 h-10 rounded-xl mb-2"
            style={{ background: 'rgba(251,191,36,0.15)', color: 'var(--amber-500)' }}
          >
            <Flame size={20} fill="currentColor" />
          </div>
          <span className="text-xl font-bold" style={{ color: 'var(--text)' }}>
            {streak.current}
          </span>
          <span className="text-[11px]" style={{ color: 'var(--text-tertiary)' }}>
            连续打卡
          </span>
        </Card>

        <Card padding="sm" className="flex flex-col items-center animate-slide-up stagger-2">
          <div
            className="flex items-center justify-center w-10 h-10 rounded-xl mb-2"
            style={{ background: 'rgba(20,184,166,0.15)', color: 'var(--teal-600)' }}
          >
            <Trophy size={20} />
          </div>
          <span className="text-xl font-bold" style={{ color: 'var(--text)' }}>
            Lv.{level.level}
          </span>
          <span className="text-[11px]" style={{ color: 'var(--text-tertiary)' }}>
            {level.title}
          </span>
        </Card>

        <Card padding="sm" className="flex flex-col items-center animate-slide-up stagger-3 cursor-pointer" onClick={() => { sfx.navigate(); navigate('/shop'); }}>
          <div
            className="flex items-center justify-center w-10 h-10 rounded-xl mb-2"
            style={{ background: 'rgba(245,158,11,0.15)', color: 'var(--amber-500)' }}
          >
            <Coins size={20} />
          </div>
          <span className="text-xl font-bold" style={{ color: 'var(--text)' }}>
            {coins}
          </span>
          <span className="text-[11px]" style={{ color: 'var(--text-tertiary)' }}>
            金币 · 商店
          </span>
        </Card>
      </div>

      {/* Daily Goal Progress */}
      <Card padding="lg" className="animate-slide-up stagger-4">
        <div className="flex items-center gap-5">
          <ProgressRing
            value={dailyProgress}
            max={100}
            size={80}
            strokeWidth={7}
            color="var(--teal-500)"
            showText
          />
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-1">
              <Target size={16} style={{ color: 'var(--teal-600)' }} />
              <h3 className="font-bold text-base" style={{ color: 'var(--text)' }}>
                今日目标
              </h3>
            </div>
            <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
              已学 <span className="font-bold" style={{ color: 'var(--teal-600)' }}>{todayStudy.words_studied}</span> / {settings.dailyGoal} 词
            </p>
            <div className="flex items-center gap-3 mt-2 text-xs" style={{ color: 'var(--text-tertiary)' }}>
              <span className="flex items-center gap-1">
                <CheckCircle2 size={12} style={{ color: '#16a34a' }} />
                正确 {todayStudy.correct}
              </span>
              <span>错误 {todayStudy.wrong}</span>
              <span>场次 {todayStudy.sessions}</span>
            </div>
          </div>
        </div>
      </Card>

      {/* Mastery Overview */}
      <Card padding="md" className="animate-slide-up stagger-5">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <TrendingUp size={18} style={{ color: 'var(--teal-600)' }} />
            <h3 className="font-bold text-base" style={{ color: 'var(--text)' }}>
              掌握进度
            </h3>
          </div>
          <span className="text-sm font-bold gradient-text">
            {formatPercent(stats.mastered, stats.total)}
          </span>
        </div>
        <div
          className="w-full rounded-full overflow-hidden"
          style={{ height: 10, background: 'var(--surface-3)' }}
        >
          <div
            className="h-full rounded-full"
            style={{
              width: `${stats.total > 0 ? (stats.mastered / stats.total) * 100 : 0}%`,
              background: 'linear-gradient(90deg, var(--teal-400), var(--teal-600))',
              transition: 'width 0.8s var(--ease-out)',
            }}
          />
        </div>
        <div className="flex items-center justify-between mt-2 text-xs" style={{ color: 'var(--text-tertiary)' }}>
          <span>已掌握 {stats.mastered} 词</span>
          <span>总计 {stats.total} 词</span>
          {stats.due > 0 && (
            <span style={{ color: 'var(--amber-500)' }}>待复习 {stats.due} 词</span>
          )}
        </div>
      </Card>

      {/* Quick Actions */}
      <div className="animate-slide-up stagger-6">
        <h3 className="font-bold text-base mb-3" style={{ color: 'var(--text)' }}>
          快捷操作
        </h3>
        <div className="grid grid-cols-2 gap-3">
          {quickActions.map((action) => {
            const Icon = action.icon;
            return (
              <Card
                key={action.label}
                hover
                padding="md"
                onClick={action.onClick}
                className="flex flex-col items-start gap-2"
              >
                <div
                  className="flex items-center justify-center w-10 h-10 rounded-xl"
                  style={{ background: action.bg, color: action.color }}
                >
                  <Icon size={20} />
                </div>
                <div>
                  <p className="font-semibold text-sm" style={{ color: 'var(--text)' }}>
                    {action.label}
                  </p>
                  <p className="text-xs" style={{ color: 'var(--text-tertiary)' }}>
                    {action.desc}
                  </p>
                </div>
              </Card>
            );
          })}
        </div>
      </div>

      {/* Weekly Review & Special Modes */}
      <Card padding="md" className="animate-slide-up stagger-7">
        <div className="flex items-center gap-2 mb-3">
          <Calendar size={16} style={{ color: 'var(--violet-500)' }} />
          <h3 className="font-bold text-sm" style={{ color: 'var(--text)' }}>
            专项复习
          </h3>
        </div>
        <div className="grid grid-cols-3 gap-2">
          <Button variant="secondary" size="sm" onClick={() => { sfx.navigate(); navigate('/study?mode=weekly'); }}>
            周总复习
          </Button>
          <Button variant="secondary" size="sm" onClick={() => { sfx.navigate(); navigate('/study?mode=confuse'); }}>
            易混词辨析
          </Button>
          <Button variant="secondary" size="sm" onClick={() => { sfx.navigate(); navigate('/study?mode=mistakes'); }}>
            错词本
          </Button>
        </div>
      </Card>

      {/* Level Progress */}
      <Card padding="md" className="animate-slide-up stagger-8">
        <div className="flex items-center justify-between mb-2">
          <h3 className="font-bold text-sm" style={{ color: 'var(--text)' }}>
            等级进度
          </h3>
          <span className="text-xs" style={{ color: 'var(--text-tertiary)' }}>
            {level.xp} / {level.nextLevelXp} XP
          </span>
        </div>
        <div
          className="w-full rounded-full overflow-hidden"
          style={{ height: 8, background: 'var(--surface-3)' }}
        >
          <div
            className="h-full rounded-full"
            style={{
              width: `${level.progress * 100}%`,
              background: 'linear-gradient(90deg, var(--violet-500), var(--teal-500))',
              transition: 'width 0.8s var(--ease-out)',
            }}
          />
        </div>
        <p className="text-xs mt-2" style={{ color: 'var(--text-tertiary)' }}>
          距离下一级还需 {level.nextLevelXp - level.xp} XP
        </p>
      </Card>

      {/* Achievements */}
      <Card padding="md" className="animate-slide-up stagger-9">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Award size={18} style={{ color: 'var(--amber-500)' }} />
            <h3 className="font-bold text-base" style={{ color: 'var(--text)' }}>
              成就
            </h3>
          </div>
          <span className="text-xs font-bold" style={{ color: 'var(--text-secondary)' }}>
            已解锁 {unlockedCount} / {totalAchievements} 个成就
          </span>
        </div>
        <div className="grid grid-cols-5 gap-2">
          {ACHIEVEMENTS.map((a) => {
            const unlocked = achievements.includes(a.id);
            return (
              <div
                key={a.id}
                className="flex flex-col items-center gap-1 p-2 rounded-xl"
                style={{
                  background: unlocked ? 'rgba(245,158,11,0.1)' : 'var(--surface-2)',
                  opacity: unlocked ? 1 : 0.4,
                }}
                title={`${a.title} — ${a.desc}`}
              >
                <span className="text-2xl">{a.icon}</span>
                <span
                  className="text-[10px] text-center leading-tight"
                  style={{ color: 'var(--text-tertiary)' }}
                >
                  {a.title}
                </span>
              </div>
            );
          })}
        </div>
      </Card>
    </div>
  );
}
