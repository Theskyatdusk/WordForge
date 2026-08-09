/**
 * ChapterCard —— 对齐 web 端 components/shared/ChapterCard.tsx。
 * 小程序适配：
 *   - <table>/<tr>/<td> 不被支持 → 改为 View 网格行
 *   - hover 事件不存在 → 用 hoverClass 做按压反馈
 *   - 展开区不再 sticky 表头（小程序 position:sticky 在 ScrollView 内表现不稳），改为固定列宽的行列表
 */
import { useState, useMemo } from 'react';
import { View, Text, ScrollView } from '@tarojs/components';
import type { Chapter, Section } from '../../types/index';
import { useProgressStore } from '../../store/useProgressStore';
import { ProgressRing } from '../ui/ProgressRing';
import { Icon } from '../Icon';
import { sfx } from '../../utils/sfx';
import { getEmoji, hashColor, getChapterIcon } from '../../utils/visuals';
import './shared.scss';

interface ChapterCardProps {
  chapter: Chapter;
  onWordClick?: (wordId: string, en: string, zh: string) => void;
}

export function ChapterCard({ chapter, onWordClick }: ChapterCardProps) {
  const [expanded, setExpanded] = useState(false);
  const getMasteryStats = useProgressStore((s) => s.getMasteryStats);

  const wordIds = useMemo(() => {
    const ids: string[] = [];
    chapter.sections.forEach((sec, si) => {
      sec.groups.forEach((grp, gi) => {
        grp.items.forEach((_, ii) => {
          ids.push(`${chapter.id}:${si}:${gi}:${ii}`);
        });
      });
    });
    return ids;
  }, [chapter]);

  const stats = useMemo(() => getMasteryStats(wordIds), [wordIds, getMasteryStats]);
  const masteryPercent = Math.round(stats.masteryRate * 100);
  const chapterIcon = getChapterIcon(chapter.icon);

  const toggleExpand = () => {
    sfx.flip();
    setExpanded(!expanded);
  };

  return (
    <View className={`chapter-card ${expanded ? 'chapter-card--open' : ''}`}>
      <View className="chapter-card__head" hoverClass="chapter-card__head--hover" onClick={toggleExpand}>
        <View
          className="chapter-card__icon"
          style={{ background: chapter.color ? `${chapter.color}1a` : 'var(--surface-3)' }}
        >
          <Text className="chapter-card__emoji">{chapterIcon}</Text>
        </View>

        <View className="chapter-card__meta">
          <Text className="chapter-card__title">{chapter.title}</Text>
          {chapter.subtitle ? (
            <Text className="chapter-card__subtitle">{chapter.subtitle}</Text>
          ) : null}
          <View className="chapter-card__tags">
            <Text className="chapter-card__tag">{stats.total} 词</Text>
            {stats.mastered > 0 ? (
              <Text className="chapter-card__tag chapter-card__tag--teal">已掌握 {stats.mastered}</Text>
            ) : null}
            {stats.learning > 0 ? (
              <Text className="chapter-card__tag chapter-card__tag--amber">学习中 {stats.learning}</Text>
            ) : null}
          </View>
        </View>

        <ProgressRing value={masteryPercent} max={100} size={44} strokeWidth={4} showText />

        <View className={`chapter-card__chevron ${expanded ? 'is-open' : ''}`}>
          <Icon name="chevron-down" size={18} color="var(--text-tertiary)" />
        </View>
      </View>

      {expanded ? (
        <View className="chapter-card__body">
          <View className="chapter-card__thead">
            <Text className="col col--word">单词/短语</Text>
            <Text className="col col--zh">释义</Text>
            <Text className="col col--status">状态</Text>
          </View>
          <ScrollView scrollY className="chapter-card__scroll">
            {chapter.sections.map((sec, si) => (
              <SectionRows
                key={`${chapter.id}-${si}`}
                chapterId={chapter.id}
                section={sec}
                si={si}
                onWordClick={onWordClick}
              />
            ))}
          </ScrollView>
        </View>
      ) : null}
    </View>
  );
}

const STATUS_COLORS: Record<string, string> = {
  new: '#94a3b8',
  learning: '#f59e0b',
  reviewing: '#3b82f6',
  mastered: '#0d9488',
};

const STATUS_LABELS: Record<string, string> = {
  new: '新',
  learning: '学',
  reviewing: '复',
  mastered: '握',
};

function SectionRows({
  chapterId,
  section,
  si,
  onWordClick,
}: {
  chapterId: string;
  section: Section;
  si: number;
  onWordClick?: (wordId: string, en: string, zh: string) => void;
}) {
  const getWordProgress = useProgressStore((s) => s.getWordProgress);

  return (
    <View>
      <View className="chapter-card__divider">
        <Text className="chapter-card__divider-text">{section.title}</Text>
      </View>

      {section.groups.map((grp, gi) =>
        grp.items.map((item, ii) => {
          const wordId = `${chapterId}:${si}:${gi}:${ii}`;
          const progress = getWordProgress(wordId);
          const emoji = getEmoji(item.en);
          const color = hashColor(item.en);
          const statusColor = STATUS_COLORS[progress.status];

          return (
            <View
              key={wordId}
              className="chapter-card__row"
              hoverClass="chapter-card__row--hover"
              onClick={() => onWordClick?.(wordId, item.en, item.zh)}
            >
              <View className="col col--word">
                {emoji ? (
                  <Text className="row-emoji">{emoji}</Text>
                ) : (
                  <View className="row-stamp" style={{ background: color }}>
                    <Text className="row-stamp__text">{item.en.charAt(0).toUpperCase()}</Text>
                  </View>
                )}
                <Text className="row-en">{item.en}</Text>
                {item.pos ? <Text className="row-pos">{item.pos}</Text> : null}
              </View>

              <Text className="col col--zh row-zh">{item.zh}</Text>

              <View className="col col--status">
                <View className="row-badge" style={{ background: `${statusColor}22` }}>
                  <Text className="row-badge__text" style={{ color: statusColor }}>
                    {STATUS_LABELS[progress.status]}
                  </Text>
                </View>
              </View>
            </View>
          );
        }),
      )}
    </View>
  );
}
