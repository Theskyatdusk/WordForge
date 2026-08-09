/**
 * 学习统计 —— 对齐 web 端 pages/Stats.tsx。
 *
 * 迁移差异：
 *   - CSS :hover tooltip 不存在 → 柱子改为可点击，弹 Toast 显示当日词数
 *   - grid-cols-N → flex + 百分比宽度（小程序对 grid 支持不稳）
 *   - ProgressRing 颜色必须字面量（data-URI 里 var() 不生效）
 */
import { useMemo, useState } from 'react';
import { View, Text } from '@tarojs/components';
import { PageShell } from '../../components/ui/PageShell';
import { Card } from '../../components/ui/Card';
import { ProgressRing } from '../../components/ui/ProgressRing';
import { Icon } from '../../components/Icon';
import { useProgressStore } from '../../store/useProgressStore';
import { useUIStore } from '../../store/useUIStore';
import { useVocab, getAllItems } from '../../hooks/useVocab';
import { sfx } from '../../utils/sfx';
import {
  formatPercent,
  formatReactionTime,
  lastNDays,
  formatNumber,
} from '../../utils/format';
import { isDue } from '../../utils/srs';
import './index.scss';

type RangeMode = '7' | '30';

const MODE_LABELS: Record<string, string> = {
  flashcard: '卡片记忆',
  quiz: '选择题',
  spelling: '拼写练习',
  listening: '听力训练',
};

const MODE_COLORS: Record<string, string> = {
  flashcard: '#14b8a6',
  quiz: '#8b5cf6',
  spelling: '#f59e0b',
  listening: '#ec4899',
};

export default function StatsPage() {
  const { data } = useVocab();
  const wordProgress = useProgressStore((s) => s.wordProgress);
  const studyHistory = useProgressStore((s) => s.studyHistory);
  const streak = useProgressStore((s) => s.streak);
  const level = useProgressStore((s) => s.level);
  const mistakes = useProgressStore((s) => s.mistakes);
  const addToast = useUIStore((s) => s.addToast);

  const [range, setRange] = useState<RangeMode>('7');

  const allItems = useMemo(() => getAllItems(data), [data]);

  /* 总体掌握统计 */
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

  /* 趋势图数据 */
  const chartData = useMemo(() => {
    const days = range === '7' ? 7 : 30;
    return lastNDays(days).map((date) => {
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

  /* 学习模式分布 */
  const modeStats = useMemo(() => {
    const modes: Record<string, number> = {};
    for (const entry of studyHistory) {
      for (const [mode, count] of Object.entries(entry.modes || {})) {
        modes[mode] = (modes[mode] || 0) + (count as number);
      }
    }
    const total = Object.values(modes).reduce((a, b) => a + b, 0);
    return Object.entries(modes)
      .map(([mode, count]) => ({
        mode,
        label: MODE_LABELS[mode] || mode,
        count,
        percent: total > 0 ? count / total : 0,
        color: MODE_COLORS[mode] || '#14b8a6',
      }))
      .sort((a, b) => b.count - a.count);
  }, [studyHistory]);

  const masteryLegend = [
    { label: '已掌握', count: masteryStats.mastered, color: '#16a34a' },
    { label: '复习中', count: masteryStats.reviewing, color: '#8b5cf6' },
    { label: '学习中', count: masteryStats.learning, color: '#f59e0b' },
    { label: '未学习', count: masteryStats.newCount, color: '#94a3b8' },
  ];

  return (
    <PageShell>
      <View className="wf-fade-in">
        {/* Header */}
        <View className="st__head">
          <Text className="wf-h1">学习统计</Text>
          <Text className="wf-sub">追踪你的学习进度和成果</Text>
        </View>

        {/* 概览四宫格 */}
        <View className="st__grid2">
          <Card padding="md" className="st__ov">
            <View className="st__ov-icon" style={{ background: 'rgba(251,191,36,0.15)' }}>
              <Icon name="flame" size={22} color="#f59e0b" />
            </View>
            <View className="st__ov-body">
              <Text className="st__ov-num">{streak.current}</Text>
              <Text className="st__ov-label">连续打卡 / 最长 {streak.longest}</Text>
            </View>
          </Card>

          <Card padding="md" className="st__ov">
            <View className="st__ov-icon" style={{ background: 'rgba(20,184,166,0.15)' }}>
              <Icon name="award" size={22} color="#0d9488" />
            </View>
            <View className="st__ov-body">
              <Text className="st__ov-num">Lv.{level.level}</Text>
              <Text className="st__ov-label">{level.mastered} 词已掌握</Text>
            </View>
          </Card>

          <Card padding="md" className="st__ov">
            <View className="st__ov-icon" style={{ background: 'rgba(22,163,74,0.12)' }}>
              <Icon name="check" size={22} color="#16a34a" />
            </View>
            <View className="st__ov-body">
              <Text className="st__ov-num">
                {formatPercent(masteryStats.mastered, masteryStats.total)}
              </Text>
              <Text className="st__ov-label">掌握率</Text>
            </View>
          </Card>

          <Card padding="md" className="st__ov">
            <View className="st__ov-icon" style={{ background: 'rgba(139,92,246,0.12)' }}>
              <Icon name="clock" size={22} color="#8b5cf6" />
            </View>
            <View className="st__ov-body">
              <Text className="st__ov-num">{formatReactionTime(masteryStats.avgRt)}</Text>
              <Text className="st__ov-label">平均反应时间</Text>
            </View>
          </Card>
        </View>

        {/* 掌握分布 */}
        <Card padding="md" className="st__block">
          <View className="wf-row st__title">
            <Icon name="target" size={18} color="#0d9488" />
            <Text className="st__title-text">掌握分布</Text>
          </View>
          <View className="st__mastery">
            <ProgressRing
              value={masteryStats.mastered}
              max={masteryStats.total || 1}
              size={90}
              strokeWidth={8}
              color="#14b8a6"
              showText
            />
            <View className="st__legend">
              {masteryLegend.map((item) => (
                <View key={item.label} className="wf-between st__legend-row">
                  <View className="wf-row">
                    <View className="st__dot" style={{ background: item.color }} />
                    <Text className="st__legend-label">{item.label}</Text>
                  </View>
                  <Text className="st__legend-num">{item.count}</Text>
                </View>
              ))}
            </View>
          </View>
        </Card>

        {/* 时间范围切换 */}
        <View className="st__ranges">
          {(['7', '30'] as RangeMode[]).map((id) => (
            <View
              key={id}
              className={`st__range ${range === id ? 'st__range--on' : ''}`}
              hoverClass="st__range--pressed"
              onClick={() => {
                sfx.click();
                setRange(id);
              }}
            >
              <Text className="st__range-text">近 {id} 天</Text>
            </View>
          ))}
        </View>

        {/* 趋势柱状图 */}
        <Card padding="md" className="st__block">
          <View className="wf-between st__chart-head">
            <View className="wf-row">
              <Icon name="chart" size={18} color="#0d9488" />
              <Text className="st__title-text">学习量趋势</Text>
            </View>
            <Text className="st__chart-sub">活跃 {rangeStats.activeDays} 天</Text>
          </View>

          <View className={`st__bars ${range === '30' ? 'st__bars--dense' : ''}`}>
            {chartData.map((d, i) => {
              const heightPct = maxWords > 0 ? (d.words / maxWords) * 100 : 0;
              const isToday = i === chartData.length - 1;
              return (
                <View
                  key={d.date}
                  className="st__bar-col"
                  onClick={() => {
                    sfx.click();
                    addToast(`${d.date.slice(5)} · ${d.words} 词`, 'info');
                  }}
                >
                  <View className="st__bar-slot">
                    <View
                      className={`st__bar ${isToday ? 'st__bar--today' : ''}`}
                      style={{
                        height: `${Math.max(heightPct, d.words > 0 ? 4 : 1)}%`,
                        background: isToday
                          ? 'linear-gradient(180deg, #2dd4bf, #0d9488)'
                          : d.words > 0
                            ? '#2dd4bf'
                            : 'var(--surface-3)',
                      }}
                    />
                  </View>
                  {range === '7' && <Text className="st__bar-label">{d.date.slice(5)}</Text>}
                </View>
              );
            })}
          </View>

          {range === '30' && (
            <View className="wf-between st__axis">
              <Text className="st__bar-label">{chartData[0]?.date.slice(5)}</Text>
              <Text className="st__bar-label">
                {chartData[chartData.length - 1]?.date.slice(5)}
              </Text>
            </View>
          )}
        </Card>

        {/* 区间汇总 */}
        <View className="st__grid3">
          <Card padding="sm" className="st__mini">
            <Text className="st__mini-num" style={{ color: '#0d9488' }}>
              {formatNumber(rangeStats.totalWords)}
            </Text>
            <Text className="st__mini-label">总学习词数</Text>
          </Card>
          <Card padding="sm" className="st__mini">
            <Text className="st__mini-num" style={{ color: '#16a34a' }}>
              {Math.round(rangeStats.accuracy * 100)}%
            </Text>
            <Text className="st__mini-label">正确率</Text>
          </Card>
          <Card padding="sm" className="st__mini">
            <Text className="st__mini-num" style={{ color: '#8b5cf6' }}>
              {rangeStats.totalSessions}
            </Text>
            <Text className="st__mini-label">学习场次</Text>
          </Card>
        </View>

        {/* 学习模式分布 */}
        {modeStats.length > 0 && (
          <Card padding="md" className="st__block">
            <View className="wf-row st__title">
              <Icon name="trending-up" size={18} color="#0d9488" />
              <Text className="st__title-text">学习模式分布</Text>
            </View>
            {modeStats.map((m) => (
              <View key={m.mode} className="st__mode">
                <View className="wf-between st__mode-head">
                  <Text className="st__mode-label">{m.label}</Text>
                  <Text className="st__mode-num">
                    {m.count} 次 ({Math.round(m.percent * 100)}%)
                  </Text>
                </View>
                <View className="st__track">
                  <View
                    className="st__fill"
                    style={{ width: `${m.percent * 100}%`, background: m.color }}
                  />
                </View>
              </View>
            ))}
          </Card>
        )}

        {/* 答题统计 */}
        <Card padding="md" className="st__block">
          <View className="wf-row st__title">
            <Icon name="calendar" size={18} color="#0d9488" />
            <Text className="st__title-text">答题统计</Text>
          </View>
          <View className="st__grid3 st__grid3--flat">
            <View className="st__qa">
              <View className="st__qa-icon" style={{ background: 'rgba(22,163,74,0.12)' }}>
                <Icon name="check" size={20} color="#16a34a" />
              </View>
              <Text className="st__qa-num" style={{ color: '#16a34a' }}>
                {formatNumber(masteryStats.totalCorrect)}
              </Text>
              <Text className="st__mini-label">总正确</Text>
            </View>
            <View className="st__qa">
              <View className="st__qa-icon" style={{ background: 'rgba(220,38,38,0.12)' }}>
                <Icon name="x-circle" size={20} color="#dc2626" />
              </View>
              <Text className="st__qa-num" style={{ color: '#dc2626' }}>
                {formatNumber(masteryStats.totalWrong)}
              </Text>
              <Text className="st__mini-label">总错误</Text>
            </View>
            <View className="st__qa">
              <View className="st__qa-icon" style={{ background: 'rgba(245,158,11,0.12)' }}>
                <Icon name="target" size={20} color="#f59e0b" />
              </View>
              <Text className="st__qa-num" style={{ color: '#f59e0b' }}>
                {mistakes.length}
              </Text>
              <Text className="st__mini-label">错题本</Text>
            </View>
          </View>
        </Card>
      </View>
    </PageShell>
  );
}
