/**
 * Stats — Learning statistics with charts, streak info, and mastery breakdown.
 */
import { useMemo, useState } from 'react';
import {
  BarChart3,
  Flame,
  TrendingUp,
  Target,
  Clock,
  CheckCircle2,
  XCircle,
  Award,
  Calendar,
} from 'lucide-react';
import { useProgressStore } from '../store/useProgressStore';
import { useVocab, getAllItems } from '../hooks/useVocab';
import { Card } from '../components/ui/Card';
import { ProgressRing } from '../components/ui/ProgressRing';
import { sfx } from '../utils/sfx';
import {
  formatPercent,
  formatReactionTime,
  lastNDays,
  formatNumber,
} from '../utils/format';
import { isDue } from '../utils/srs';

type RangeMode = '7' | '30';

export function Stats() {
  const { data } = useVocab();
  const wordProgress = useProgressStore((s) => s.wordProgress);
  const studyHistory = useProgressStore((s) => s.studyHistory);
  const streak = useProgressStore((s) => s.streak);
  const level = useProgressStore((s) => s.level);
  const mistakes = useProgressStore((s) => s.mistakes);

  const [range, setRange] = useState<RangeMode>('7');

  const allItems = useMemo(() => getAllItems(data), [data]);

  // Overall mastery stats
  const masteryStats = useMemo(() => {
    let total = 0;
    let mastered = 0;
    let learning = 0;
    let reviewing = 0;
    let newCount = 0;
    let due = 0;
    let totalCorrect = 0;
    let totalWrong = 0;
    let totalRt = 0;
    let rtCount = 0;

    for (const fi of allItems) {
      total++;
      const p = wordProgress[fi.wordId];
      if (!p || p.status === 'new') {
        newCount++;
        continue;
      }
      if (p.status === 'learning') learning++;
      else if (p.status === 'reviewing') reviewing++;
      else if (p.status === 'mastered') mastered++;
      if (isDue(p)) due++;
      totalCorrect += p.correct_count;
      totalWrong += p.wrong_count;
      if (p.rt_avg > 0) {
        totalRt += p.rt_avg;
        rtCount++;
      }
    }

    return {
      total,
      mastered,
      learning,
      reviewing,
      newCount,
      due,
      totalCorrect,
      totalWrong,
      avgRt: rtCount > 0 ? totalRt / rtCount : 0,
      accuracy: totalCorrect + totalWrong > 0 ? totalCorrect / (totalCorrect + totalWrong) : 0,
    };
  }, [allItems, wordProgress]);

  // Study history for chart
  const chartData = useMemo(() => {
    const days = range === '7' ? 7 : 30;
    const dateStrings = lastNDays(days);
    return dateStrings.map((date) => {
      const entry = studyHistory.find((s) => s.date === date);
      return {
        date,
        words: entry?.words_studied || 0,
        correct: entry?.correct || 0,
        wrong: entry?.wrong || 0,
        sessions: entry?.sessions || 0,
      };
    });
  }, [studyHistory, range]);

  // Aggregate stats for the selected range
  const rangeStats = useMemo(() => {
    let totalWords = 0;
    let totalCorrect = 0;
    let totalWrong = 0;
    let totalSessions = 0;
    let activeDays = 0;
    for (const d of chartData) {
      totalWords += d.words;
      totalCorrect += d.correct;
      totalWrong += d.wrong;
      totalSessions += d.sessions;
      if (d.sessions > 0) activeDays++;
    }
    return {
      totalWords,
      totalCorrect,
      totalWrong,
      totalSessions,
      activeDays,
      accuracy: totalCorrect + totalWrong > 0 ? totalCorrect / (totalCorrect + totalWrong) : 0,
    };
  }, [chartData]);

  const maxWords = Math.max(...chartData.map((d) => d.words), 1);

  // Mode distribution (filtered by selected date range)
  const modeStats = useMemo(() => {
    const days = range === '7' ? 7 : 30;
    const dateSet = new Set(lastNDays(days));
    const modes: Record<string, number> = {};
    for (const entry of studyHistory) {
      if (!dateSet.has(entry.date)) continue;
      for (const [mode, count] of Object.entries(entry.modes)) {
        modes[mode] = (modes[mode] || 0) + count;
      }
    }
    const total = Object.values(modes).reduce((a, b) => a + b, 0);
    const modeLabels: Record<string, string> = {
      flashcard: '卡片记忆',
      quiz: '选择题',
      spelling: '拼写练习',
      listening: '听力训练',
    };
    const modeColors: Record<string, string> = {
      flashcard: 'var(--teal-500)',
      quiz: 'var(--violet-500)',
      spelling: 'var(--amber-500)',
      listening: '#ec4899',
    };
    return Object.entries(modes)
      .map(([mode, count]) => ({
        mode,
        label: modeLabels[mode] || mode,
        count,
        percent: total > 0 ? count / total : 0,
        color: modeColors[mode] || 'var(--teal-500)',
      }))
      .sort((a, b) => b.count - a.count);
  }, [studyHistory, range]);

  return (
    <div className="space-y-5 animate-fade-in">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold font-display" style={{ color: 'var(--text)' }}>
          学习统计
        </h1>
        <p className="text-sm mt-1" style={{ color: 'var(--text-secondary)' }}>
          追踪你的学习进度和成果
        </p>
      </div>

      {/* Overview Cards */}
      <div className="grid grid-cols-2 gap-3">
        <Card padding="md" className="flex items-center gap-3">
          <div
            className="flex items-center justify-center w-11 h-11 rounded-xl flex-shrink-0"
            style={{ background: 'rgba(251,191,36,0.15)', color: 'var(--amber-500)' }}
          >
            <Flame size={22} fill="currentColor" />
          </div>
          <div>
            <p className="text-xl font-bold" style={{ color: 'var(--text)' }}>
              {streak.current}
            </p>
            <p className="text-[11px]" style={{ color: 'var(--text-tertiary)' }}>
              连续打卡 / 最长 {streak.longest}
            </p>
          </div>
        </Card>

        <Card padding="md" className="flex items-center gap-3">
          <div
            className="flex items-center justify-center w-11 h-11 rounded-xl flex-shrink-0"
            style={{ background: 'rgba(20,184,166,0.15)', color: 'var(--teal-600)' }}
          >
            <Award size={22} />
          </div>
          <div>
            <p className="text-xl font-bold" style={{ color: 'var(--text)' }}>
              Lv.{level.level}
            </p>
            <p className="text-[11px]" style={{ color: 'var(--text-tertiary)' }}>
              {level.mastered} 词已掌握
            </p>
          </div>
        </Card>

        <Card padding="md" className="flex items-center gap-3">
          <div
            className="flex items-center justify-center w-11 h-11 rounded-xl flex-shrink-0"
            style={{ background: 'rgba(22,163,74,0.12)', color: '#16a34a' }}
          >
            <CheckCircle2 size={22} />
          </div>
          <div>
            <p className="text-xl font-bold" style={{ color: 'var(--text)' }}>
              {formatPercent(masteryStats.mastered, masteryStats.total)}
            </p>
            <p className="text-[11px]" style={{ color: 'var(--text-tertiary)' }}>
              掌握率
            </p>
          </div>
        </Card>

        <Card padding="md" className="flex items-center gap-3">
          <div
            className="flex items-center justify-center w-11 h-11 rounded-xl flex-shrink-0"
            style={{ background: 'rgba(139,92,246,0.12)', color: 'var(--violet-500)' }}
          >
            <Clock size={22} />
          </div>
          <div>
            <p className="text-xl font-bold" style={{ color: 'var(--text)' }}>
              {formatReactionTime(masteryStats.avgRt)}
            </p>
            <p className="text-[11px]" style={{ color: 'var(--text-tertiary)' }}>
              平均反应时间
            </p>
          </div>
        </Card>
      </div>

      {/* Mastery Distribution */}
      <Card padding="md">
        <div className="flex items-center gap-2 mb-3">
          <Target size={18} style={{ color: 'var(--teal-600)' }} />
          <h3 className="font-bold text-base" style={{ color: 'var(--text)' }}>
            掌握分布
          </h3>
        </div>
        <div className="flex items-center gap-4">
          <ProgressRing
            value={masteryStats.mastered}
            max={masteryStats.total}
            size={90}
            strokeWidth={8}
            color="var(--teal-500)"
            showText
          />
          <div className="flex-1 space-y-2">
            {[
              { label: '已掌握', count: masteryStats.mastered, color: '#16a34a' },
              { label: '复习中', count: masteryStats.reviewing, color: 'var(--violet-500)' },
              { label: '学习中', count: masteryStats.learning, color: 'var(--amber-500)' },
              { label: '未学习', count: masteryStats.newCount, color: 'var(--text-tertiary)' },
            ].map((item) => (
              <div key={item.label} className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span
                    className="w-2.5 h-2.5 rounded-full"
                    style={{ background: item.color }}
                  />
                  <span className="text-xs" style={{ color: 'var(--text-secondary)' }}>
                    {item.label}
                  </span>
                </div>
                <span className="text-xs font-bold" style={{ color: 'var(--text)' }}>
                  {item.count}
                </span>
              </div>
            ))}
          </div>
        </div>
      </Card>

      {/* Range Selector */}
      <div className="flex gap-2">
        {(
          [
            { id: '7' as const, label: '近 7 天' },
            { id: '30' as const, label: '近 30 天' },
          ]
        ).map((tab) => (
          <button
            key={tab.id}
            onClick={() => {
              sfx.click();
              setRange(tab.id);
            }}
            className="px-4 py-2 rounded-lg text-sm font-medium transition-all"
            style={{
              background: range === tab.id ? 'var(--teal-600)' : 'var(--surface)',
              color: range === tab.id ? '#fff' : 'var(--text-secondary)',
              border: `1px solid ${range === tab.id ? 'var(--teal-600)' : 'var(--border)'}`,
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Study Chart */}
      <Card padding="md">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <BarChart3 size={18} style={{ color: 'var(--teal-600)' }} />
            <h3 className="font-bold text-base" style={{ color: 'var(--text)' }}>
              学习量趋势
            </h3>
          </div>
          <span className="text-xs" style={{ color: 'var(--text-tertiary)' }}>
            活跃 {rangeStats.activeDays} 天
          </span>
        </div>

        {/* Bar chart */}
        <div
          className="flex items-end gap-1"
          style={{ height: range === '7' ? 120 : 80 }}
        >
          {chartData.map((d, i) => {
            const heightPct = maxWords > 0 ? (d.words / maxWords) * 100 : 0;
            const isToday = i === chartData.length - 1;
            return (
              <div
                key={d.date}
                className="flex-1 flex flex-col items-center justify-end gap-1 group relative"
                style={{ height: '100%' }}
              >
                {/* Tooltip */}
                <div
                  className="absolute -top-8 left-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10"
                  style={{
                    background: 'var(--text)',
                    color: 'var(--surface)',
                    padding: '2px 6px',
                    borderRadius: '4px',
                    fontSize: '10px',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {d.words} 词
                </div>
                <div
                  className="w-full rounded-t transition-all duration-300"
                  style={{
                    height: `${Math.max(heightPct, d.words > 0 ? 4 : 0)}%`,
                    background: isToday
                      ? 'linear-gradient(180deg, var(--teal-400), var(--teal-600))'
                      : d.words > 0
                        ? 'var(--teal-400)'
                        : 'var(--surface-3)',
                    minHeight: d.words > 0 ? '3px' : '1px',
                  }}
                />
                {range === '7' && (
                  <span className="text-[9px]" style={{ color: 'var(--text-tertiary)' }}>
                    {d.date.slice(5)}
                  </span>
                )}
              </div>
            );
          })}
        </div>
        {range === '30' && (
          <div className="flex justify-between mt-2">
            <span className="text-[9px]" style={{ color: 'var(--text-tertiary)' }}>
              {chartData[0]?.date.slice(5)}
            </span>
            <span className="text-[9px]" style={{ color: 'var(--text-tertiary)' }}>
              {chartData[chartData.length - 1]?.date.slice(5)}
            </span>
          </div>
        )}
      </Card>

      {/* Range Summary */}
      <div className="grid grid-cols-3 gap-3">
        <Card padding="sm" className="text-center">
          <p className="text-lg font-bold" style={{ color: 'var(--teal-600)' }}>
            {formatNumber(rangeStats.totalWords)}
          </p>
          <p className="text-[11px]" style={{ color: 'var(--text-tertiary)' }}>
            总学习词数
          </p>
        </Card>
        <Card padding="sm" className="text-center">
          <p className="text-lg font-bold" style={{ color: '#16a34a' }}>
            {Math.round(rangeStats.accuracy * 100)}%
          </p>
          <p className="text-[11px]" style={{ color: 'var(--text-tertiary)' }}>
            正确率
          </p>
        </Card>
        <Card padding="sm" className="text-center">
          <p className="text-lg font-bold" style={{ color: 'var(--violet-500)' }}>
            {rangeStats.totalSessions}
          </p>
          <p className="text-[11px]" style={{ color: 'var(--text-tertiary)' }}>
            学习场次
          </p>
        </Card>
      </div>

      {/* Mode Distribution */}
      {modeStats.length > 0 && (
        <Card padding="md">
          <div className="flex items-center gap-2 mb-3">
            <TrendingUp size={18} style={{ color: 'var(--teal-600)' }} />
            <h3 className="font-bold text-base" style={{ color: 'var(--text)' }}>
              学习模式分布
            </h3>
          </div>
          <div className="space-y-3">
            {modeStats.map((m) => (
              <div key={m.mode}>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-medium" style={{ color: 'var(--text-secondary)' }}>
                    {m.label}
                  </span>
                  <span className="text-xs font-bold" style={{ color: 'var(--text)' }}>
                    {m.count} 次 ({Math.round(m.percent * 100)}%)
                  </span>
                </div>
                <div
                  className="w-full rounded-full overflow-hidden"
                  style={{ height: 8, background: 'var(--surface-3)' }}
                >
                  <div
                    className="h-full rounded-full transition-all duration-500"
                    style={{
                      width: `${m.percent * 100}%`,
                      background: m.color,
                    }}
                  />
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Correct/Wrong Summary */}
      <Card padding="md">
        <div className="flex items-center gap-2 mb-3">
          <Calendar size={18} style={{ color: 'var(--teal-600)' }} />
          <h3 className="font-bold text-base" style={{ color: 'var(--text)' }}>
            答题统计
          </h3>
        </div>
        <div className="grid grid-cols-3 gap-3">
          <div className="text-center">
            <div
              className="flex items-center justify-center w-10 h-10 rounded-xl mx-auto mb-2"
              style={{ background: 'rgba(22,163,74,0.12)', color: '#16a34a' }}
            >
              <CheckCircle2 size={20} />
            </div>
            <p className="text-lg font-bold" style={{ color: '#16a34a' }}>
              {formatNumber(masteryStats.totalCorrect)}
            </p>
            <p className="text-[11px]" style={{ color: 'var(--text-tertiary)' }}>
              总正确
            </p>
          </div>
          <div className="text-center">
            <div
              className="flex items-center justify-center w-10 h-10 rounded-xl mx-auto mb-2"
              style={{ background: 'rgba(220,38,38,0.12)', color: '#dc2626' }}
            >
              <XCircle size={20} />
            </div>
            <p className="text-lg font-bold" style={{ color: '#dc2626' }}>
              {formatNumber(masteryStats.totalWrong)}
            </p>
            <p className="text-[11px]" style={{ color: 'var(--text-tertiary)' }}>
              总错误
            </p>
          </div>
          <div className="text-center">
            <div
              className="flex items-center justify-center w-10 h-10 rounded-xl mx-auto mb-2"
              style={{ background: 'rgba(245,158,11,0.12)', color: 'var(--amber-500)' }}
            >
              <Target size={20} />
            </div>
            <p className="text-lg font-bold" style={{ color: 'var(--amber-500)' }}>
              {mistakes.length}
            </p>
            <p className="text-[11px]" style={{ color: 'var(--text-tertiary)' }}>
              错题本
            </p>
          </div>
        </div>
      </Card>
    </div>
  );
}
