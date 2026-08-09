/**
 * WordDetailModal —— 对齐 web 端 components/shared/WordDetailModal.tsx。
 * 展示单词、发音、释义、视觉锚点、词缀提示、例句与 SRS 进度。
 */
import { useMemo } from 'react';
import { View, Text } from '@tarojs/components';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { Icon } from '../Icon';
import { tts } from '../../utils/tts';
import { sfx } from '../../utils/sfx';
import { getEmoji, hashColor, affixHint } from '../../utils/visuals';
import { getExamples } from '../../utils/examples';
import { useProgressStore } from '../../store/useProgressStore';
import { relativeTime, daysUntil, formatReactionTime } from '../../utils/format';
import './shared.scss';

interface WordDetailModalProps {
  open: boolean;
  onClose: () => void;
  wordId: string;
  en: string;
  zh: string;
  pos?: string;
  onAddToWordbook?: (wordId: string) => void;
}

const STATUS_INFO: Record<string, { label: string; color: string }> = {
  new: { label: '未学习', color: '#94a3b8' },
  learning: { label: '学习中', color: '#f59e0b' },
  reviewing: { label: '复习中', color: '#3b82f6' },
  mastered: { label: '已掌握', color: '#0d9488' },
};

const TIER_STYLE: Record<number, { bg: string; color: string }> = {
  1: { bg: 'rgba(20,184,166,0.15)', color: '#0d9488' },
  2: { bg: 'rgba(139,92,246,0.15)', color: '#8b5cf6' },
  3: { bg: 'rgba(245,158,11,0.15)', color: '#f59e0b' },
};

export function WordDetailModal({
  open,
  onClose,
  wordId,
  en,
  zh,
  pos,
  onAddToWordbook,
}: WordDetailModalProps) {
  const getWordProgress = useProgressStore((s) => s.getWordProgress);
  const wordProgressMap = useProgressStore((s) => s.wordProgress);
  const progress = wordProgressMap[wordId] || getWordProgress(wordId);

  const emoji = useMemo(() => getEmoji(en), [en]);
  const color = useMemo(() => hashColor(en), [en]);
  const hint = useMemo(() => affixHint(en), [en]);
  const examples = useMemo(() => getExamples(en, zh, pos), [en, zh, pos]);

  const handleSpeak = () => {
    sfx.click();
    tts.speakWord(en);
  };

  const handleAdd = () => {
    sfx.coin();
    onAddToWordbook?.(wordId);
  };

  const statusInfo = STATUS_INFO[progress.status] || STATUS_INFO.new;
  const accuracy =
    progress.review_count > 0
      ? Math.round((progress.correct_count / progress.review_count) * 100)
      : 0;

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="单词详情"
      footer={
        <View className="wd__actions">
          <Button variant="secondary" fullWidth onClick={handleSpeak}>
            <Icon name="volume" size={16} color="var(--text)" />
            发音
          </Button>
          <Button variant="primary" fullWidth onClick={handleAdd}>
            <Icon name="bookmark-plus" size={16} color="#ffffff" />
            加入生词本
          </Button>
        </View>
      }
    >
      {/* 头部 */}
      <View className="wd__head">
        {emoji ? (
          <View className="wd__anchor wd__anchor--emoji">
            <Text className="wd__anchor-emoji">{emoji}</Text>
          </View>
        ) : (
          <View className="wd__anchor" style={{ background: color }}>
            <Text className="wd__anchor-letter">{en.charAt(0).toUpperCase()}</Text>
          </View>
        )}

        <View className="wd__meta">
          <View className="wd__title-row">
            <Text className="wd__en">{en}</Text>
            <View className="wd__speak" onClick={handleSpeak}>
              <Icon name="volume" size={16} color="var(--teal-600)" />
            </View>
          </View>
          <Text className="wd__zh">{zh}</Text>
          <View className="wd__badges">
            {pos ? <Text className="wd__badge">{pos}</Text> : null}
            <Text
              className="wd__badge"
              style={{ background: `${statusInfo.color}22`, color: statusInfo.color }}
            >
              {statusInfo.label}
            </Text>
          </View>
        </View>
      </View>

      {/* 词缀提示 */}
      {hint ? (
        <View className="wd__hint">
          <Icon name="tag" size={13} color="var(--violet-500)" />
          <Text className="wd__hint-text">{hint}</Text>
        </View>
      ) : null}

      {/* 进度统计 */}
      {progress.review_count > 0 ? (
        <View className="wd__stats">
          <StatBox label="复习次数" value={`${progress.review_count}`} />
          <StatBox label="正确率" value={`${accuracy}%`} />
          <StatBox label="下次复习" value={daysUntil(progress.next_review)} />
        </View>
      ) : null}

      {/* 例句 */}
      {examples.length > 0 ? (
        <View className="wd__section">
          <Text className="wd__section-title">例句</Text>
          {examples.map((ex, i) => {
            const ts = TIER_STYLE[ex.tier] || TIER_STYLE[3];
            return (
              <View key={i} className="wd__example">
                <View className="wd__example-head">
                  <Text className="wd__example-tier" style={{ background: ts.bg, color: ts.color }}>
                    {ex.label}
                  </Text>
                  <Text className="wd__example-tag">{ex.tag}</Text>
                </View>
                <Text className="wd__example-en">{ex.en}</Text>
                <Text className="wd__example-zh">{ex.zh}</Text>
              </View>
            );
          })}
        </View>
      ) : null}

      {/* 上次复习 */}
      {progress.last_review ? (
        <Text className="wd__last">
          上次复习：{relativeTime(progress.last_review)}
          {progress.rt_avg > 0 ? ` · 平均反应 ${formatReactionTime(progress.rt_avg)}` : ''}
        </Text>
      ) : null}
    </Modal>
  );
}

function StatBox({ label, value }: { label: string; value: string }) {
  return (
    <View className="wd__statbox">
      <Text className="wd__statbox-label">{label}</Text>
      <Text className="wd__statbox-value">{value}</Text>
    </View>
  );
}
