/**
 * WordDetailModal — Word detail popup.
 * Shows word, pronunciation, translation, visual anchor, examples, and progress.
 */
import { useMemo } from 'react';
import { Volume2, BookmarkPlus, Tag } from 'lucide-react';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { tts } from '../../utils/tts';
import { sfx } from '../../utils/sfx';
import { getEmoji, hashColor, affixHint } from '../../utils/visuals';
import { getExamples } from '../../utils/examples';
import { useProgressStore } from '../../store/useProgressStore';
import { relativeTime, daysUntil, formatReactionTime } from '../../utils/format';

interface WordDetailModalProps {
  open: boolean;
  onClose: () => void;
  wordId: string;
  en: string;
  zh: string;
  pos?: string;
  onAddToWordbook?: (wordId: string) => void;
}

export function WordDetailModal({
  open,
  onClose,
  wordId,
  en,
  zh,
  pos,
  onAddToWordbook,
}: WordDetailModalProps) {
  // Use stable selector pattern: select the function + wordProgress map, compute in render
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

  const handleAddToWordbook = () => {
    sfx.add();
    onAddToWordbook?.(wordId);
  };

  const statusLabels: Record<string, { label: string; color: string }> = {
    new: { label: '未学习', color: 'var(--text-tertiary)' },
    learning: { label: '学习中', color: '#f59e0b' },
    reviewing: { label: '复习中', color: '#3b82f6' },
    mastered: { label: '已掌握', color: 'var(--teal-600)' },
  };
  const statusInfo = statusLabels[progress.status] || statusLabels.new;

  return (
    <Modal open={open} onClose={onClose} title="单词详情">
      {/* Word header */}
      <div className="flex items-start gap-4 mb-5">
        {/* Visual anchor */}
        <div className="flex-shrink-0">
          {emoji ? (
            <div
              className="flex items-center justify-center rounded-2xl"
              style={{ width: 72, height: 72, fontSize: 40, background: 'var(--surface-2)' }}
            >
              {emoji}
            </div>
          ) : (
            <div
              className="flex items-center justify-center rounded-2xl text-white font-bold"
              style={{ width: 72, height: 72, fontSize: 32, background: color }}
            >
              {en.charAt(0).toUpperCase()}
            </div>
          )}
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <h2 className="text-2xl font-bold font-display" style={{ color: 'var(--text)' }}>
              {en}
            </h2>
            <button
              onClick={handleSpeak}
              className="flex items-center justify-center w-8 h-8 rounded-full cursor-pointer hover:scale-110"
              style={{ background: 'var(--surface-3)', color: 'var(--teal-600)' }}
            >
              <Volume2 size={18} />
            </button>
          </div>
          <p className="text-base mb-1" style={{ color: 'var(--text-secondary)' }}>
            {zh}
          </p>
          <div className="flex items-center gap-2">
            {pos && (
              <span
                className="text-xs px-2 py-0.5 rounded font-medium"
                style={{ background: 'var(--surface-3)', color: 'var(--text-tertiary)' }}
              >
                {pos}
              </span>
            )}
            <span
              className="text-xs px-2 py-0.5 rounded font-medium"
              style={{
                background: `${statusInfo.color}22`,
                color: statusInfo.color,
              }}
            >
              {statusInfo.label}
            </span>
          </div>
        </div>
      </div>

      {/* Affix hint */}
      {hint && (
        <div
          className="flex items-center gap-2 px-3 py-2 rounded-xl mb-4"
          style={{ background: 'var(--surface-2)' }}
        >
          <Tag size={14} style={{ color: 'var(--violet-500)' }} />
          <span className="text-xs" style={{ color: 'var(--text-secondary)' }}>
            {hint}
          </span>
        </div>
      )}

      {/* Progress info */}
      {progress.review_count > 0 && (
        <div
          className="grid grid-cols-3 gap-3 mb-4"
        >
          <StatBox label="复习次数" value={`${progress.review_count}`} />
          <StatBox label="正确率" value={`${progress.review_count > 0 ? Math.round((progress.correct_count / progress.review_count) * 100) : 0}%`} />
          <StatBox label="下次复习" value={daysUntil(progress.next_review)} />
        </div>
      )}

      {/* Example sentences */}
      {examples.length > 0 && (
        <div className="mb-4">
          <h3 className="text-sm font-bold mb-2" style={{ color: 'var(--text)' }}>
            例句
          </h3>
          <div className="space-y-2">
            {examples.map((ex, i) => (
              <div
                key={i}
                className="p-3 rounded-xl"
                style={{ background: 'var(--surface-2)' }}
              >
                <div className="flex items-center justify-between mb-1">
                  <span
                    className="text-[10px] px-1.5 py-0.5 rounded font-medium"
                    style={{
                      background: ex.tier === 1 ? 'rgba(20,184,166,0.15)' : ex.tier === 2 ? 'rgba(139,92,246,0.15)' : 'rgba(245,158,11,0.15)',
                      color: ex.tier === 1 ? 'var(--teal-600)' : ex.tier === 2 ? 'var(--violet-500)' : 'var(--amber-500)',
                    }}
                  >
                    {ex.label}
                  </span>
                  <span className="text-[10px]" style={{ color: 'var(--text-tertiary)' }}>
                    {ex.tag}
                  </span>
                </div>
                <p className="text-sm font-medium mb-1" style={{ color: 'var(--text)' }}>
                  {ex.en}
                </p>
                <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>
                  {ex.zh}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Last review info */}
      {progress.last_review && (
        <p className="text-xs text-center mb-4" style={{ color: 'var(--text-tertiary)' }}>
          上次复习：{relativeTime(progress.last_review)}
          {progress.rt_avg > 0 && ` · 平均反应 ${formatReactionTime(progress.rt_avg)}`}
        </p>
      )}

      {/* Actions */}
      <div className="flex gap-2">
        <Button variant="secondary" fullWidth onClick={handleSpeak}>
          <Volume2 size={16} />
          发音
        </Button>
        <Button variant="primary" fullWidth onClick={handleAddToWordbook}>
          <BookmarkPlus size={16} />
          加入生词本
        </Button>
      </div>
    </Modal>
  );
}

function StatBox({ label, value }: { label: string; value: string }) {
  return (
    <div
      className="text-center p-2 rounded-xl"
      style={{ background: 'var(--surface-2)' }}
    >
      <p className="text-xs mb-0.5" style={{ color: 'var(--text-tertiary)' }}>
        {label}
      </p>
      <p className="text-sm font-bold" style={{ color: 'var(--text)' }}>
        {value}
      </p>
    </div>
  );
}
