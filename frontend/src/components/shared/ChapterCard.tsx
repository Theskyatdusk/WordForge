/**
 * ChapterCard — Chapter card with expand/collapse + chevron indicator.
 *
 * Features:
 * - Progress ring showing mastery percentage
 * - Click header to expand/collapse with smooth animation
 * - Uses getChapterIcon to map backend icon names to emojis
 * - Expanded view shows sections → groups → items in a scrollable table
 * - Staggered row animations on expand
 */
import { useState, useMemo } from 'react';
import { ChevronDown } from 'lucide-react';
import type { Chapter } from '../../types/index';
import { useProgressStore } from '../../store/useProgressStore';
import { ProgressRing } from '../ui/ProgressRing';
import { sfx } from '../../utils/sfx';
import { getEmoji, hashColor, getChapterIcon } from '../../utils/visuals';

interface ChapterCardProps {
  chapter: Chapter;
  onWordClick?: (wordId: string, en: string, zh: string) => void;
}

export function ChapterCard({ chapter, onWordClick }: ChapterCardProps) {
  const [expanded, setExpanded] = useState(false);
  const getMasteryStats = useProgressStore((s) => s.getMasteryStats);

  // Collect all word IDs in this chapter
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
    <div
      className="rounded-2xl overflow-hidden card-hover"
      style={{
        background: 'var(--surface)',
        border: `1px solid ${expanded ? 'var(--border)' : 'var(--border-light)'}`,
        boxShadow: expanded ? 'var(--shadow-md)' : 'var(--shadow-sm)',
      }}
    >
      {/* Header (clickable) */}
      <button
        onClick={toggleExpand}
        className="w-full flex items-center gap-4 p-4 cursor-pointer text-left"
        style={{ transition: 'background-color 0.2s ease' }}
        onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--surface-hover)'; }}
        onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
      >
        {/* Icon / emoji */}
        <div
          className="flex items-center justify-center w-12 h-12 rounded-xl text-2xl flex-shrink-0"
          style={{
            background: chapter.color ? `${chapter.color}1a` : 'var(--surface-3)',
            transition: 'transform 0.3s var(--ease-spring)',
          }}
        >
          {chapterIcon}
        </div>

        {/* Title + subtitle */}
        <div className="flex-1 min-w-0">
          <h3
            className="font-bold text-base truncate"
            style={{ color: 'var(--text)' }}
          >
            {chapter.title}
          </h3>
          {chapter.subtitle && (
            <p
              className="text-xs mt-0.5 truncate"
              style={{ color: 'var(--text-tertiary)' }}
            >
              {chapter.subtitle}
            </p>
          )}
          <div className="flex items-center gap-3 mt-1">
            <span className="text-xs" style={{ color: 'var(--text-tertiary)' }}>
              {stats.total} 词
            </span>
            {stats.mastered > 0 && (
              <span className="text-xs font-medium" style={{ color: 'var(--teal-600)' }}>
                已掌握 {stats.mastered}
              </span>
            )}
            {stats.learning > 0 && (
              <span className="text-xs font-medium" style={{ color: 'var(--amber-500)' }}>
                学习中 {stats.learning}
              </span>
            )}
          </div>
        </div>

        {/* Progress ring */}
        <ProgressRing
          value={masteryPercent}
          max={100}
          size={48}
          strokeWidth={4}
          showText
        />

        {/* Chevron indicator */}
        <ChevronDown
          size={20}
          className="flex-shrink-0"
          style={{
            color: 'var(--text-tertiary)',
            transform: expanded ? 'rotate(180deg)' : 'rotate(0deg)',
            transition: 'transform 0.3s var(--ease-out)',
          }}
        />
      </button>

      {/* Expanded content */}
      {expanded && (
        <div
          className="animate-slide-up"
          style={{ borderTop: '1px solid var(--border-light)' }}
        >
          <div
            style={{
              maxHeight: '420px',
              overflowY: 'auto',
            }}
          >
            <table className="w-full" style={{ borderCollapse: 'collapse' }}>
              <thead
                className="sticky top-0 z-10"
                style={{ background: 'var(--surface-2)' }}
              >
                <tr>
                  <th
                    className="text-left px-4 py-2.5 text-xs font-semibold"
                    style={{ color: 'var(--text-tertiary)' }}
                  >
                    单词/短语
                  </th>
                  <th
                    className="text-left px-4 py-2.5 text-xs font-semibold"
                    style={{ color: 'var(--text-tertiary)' }}
                  >
                    释义
                  </th>
                  <th
                    className="text-center px-4 py-2.5 text-xs font-semibold"
                    style={{ color: 'var(--text-tertiary)' }}
                  >
                    状态
                  </th>
                </tr>
              </thead>
              <tbody>
                {chapter.sections.map((sec, si) => (
                  <SectionRows
                    key={`${chapter.id}-${si}`}
                    chapterId={chapter.id}
                    section={sec}
                    si={si}
                    onWordClick={onWordClick}
                  />
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

function SectionRows({
  chapterId,
  section,
  si,
  onWordClick,
}: {
  chapterId: string;
  section: import('../../types/index').Section;
  si: number;
  onWordClick?: (wordId: string, en: string, zh: string) => void;
}) {
  const getWordProgress = useProgressStore((s) => s.getWordProgress);

  const statusColors: Record<string, string> = {
    new: 'var(--text-tertiary)',
    learning: '#f59e0b',
    reviewing: '#3b82f6',
    mastered: 'var(--teal-600)',
  };

  const statusLabels: Record<string, string> = {
    new: '新',
    learning: '学',
    reviewing: '复',
    mastered: '握',
  };

  return (
    <>
      {/* Section divider */}
      <tr>
        <td
          colSpan={3}
          className="px-4 py-2 text-xs font-bold uppercase tracking-wide"
          style={{
            color: 'var(--text-secondary)',
            background: 'var(--surface-3)',
          }}
        >
          {section.title}
        </td>
      </tr>
      {section.groups.map((grp, gi) =>
        grp.items.map((item, ii) => {
          const wordId = `${chapterId}:${si}:${gi}:${ii}`;
          const progress = getWordProgress(wordId);
          const emoji = getEmoji(item.en);
          const color = hashColor(item.en);

          return (
            <tr
              key={wordId}
              onClick={() => onWordClick?.(wordId, item.en, item.zh)}
              className="cursor-pointer"
              style={{
                borderBottom: '1px solid var(--border-light)',
                transition: 'background-color 0.15s ease',
              }}
              onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--surface-2)'; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
            >
              <td className="px-4 py-2.5">
                <div className="flex items-center gap-2">
                  {emoji ? (
                    <span className="text-lg flex-shrink-0">{emoji}</span>
                  ) : (
                    <span
                      className="flex items-center justify-center w-5 h-5 rounded text-[10px] font-bold text-white flex-shrink-0"
                      style={{ background: color }}
                    >
                      {item.en.charAt(0).toUpperCase()}
                    </span>
                  )}
                  <span
                    className="text-sm font-medium"
                    style={{ color: 'var(--text)' }}
                  >
                    {item.en}
                  </span>
                  {item.pos && (
                    <span
                      className="text-[10px] px-1.5 py-0.5 rounded"
                      style={{
                        background: 'var(--surface-3)',
                        color: 'var(--text-tertiary)',
                      }}
                    >
                      {item.pos}
                    </span>
                  )}
                </div>
              </td>
              <td
                className="px-4 py-2.5 text-sm"
                style={{ color: 'var(--text-secondary)' }}
              >
                {item.zh}
              </td>
              <td className="px-4 py-2.5 text-center">
                <span
                  className="inline-flex items-center justify-center w-6 h-6 rounded-full text-[10px] font-bold"
                  style={{
                    background: `${statusColors[progress.status]}22`,
                    color: statusColors[progress.status],
                  }}
                >
                  {statusLabels[progress.status]}
                </span>
              </td>
            </tr>
          );
        }),
      )}
    </>
  );
}
