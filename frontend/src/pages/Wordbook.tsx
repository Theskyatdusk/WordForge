/**
 * Wordbook — Saved words collection with search, TTS, and removal.
 */
import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Bookmark,
  Search,
  X,
  Volume2,
  Trash2,
  GraduationCap,
  Inbox,
} from 'lucide-react';
import { useProgressStore } from '../store/useProgressStore';
import { useUIStore } from '../store/useUIStore';
import { useTTS } from '../hooks/useTTS';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { sfx } from '../utils/sfx';
import { getEmoji } from '../utils/visuals';
import { relativeTime } from '../utils/format';

export function Wordbook() {
  const navigate = useNavigate();
  const wordbook = useProgressStore((s) => s.wordbook);
  const removeFromWordbook = useProgressStore((s) => s.removeFromWordbook);
  const wordProgress = useProgressStore((s) => s.wordProgress);
  const addToast = useUIStore((s) => s.addToast);
  const ttsHook = useTTS();

  const [search, setSearch] = useState('');
  const [sortMode, setSortMode] = useState<'recent' | 'alpha' | 'progress'>('recent');
  const [pendingDelete, setPendingDelete] = useState<string | null>(null);

  const filtered = useMemo(() => {
    let list = wordbook;
    if (search.trim()) {
      const q = search.toLowerCase().trim();
      list = list.filter(
        (w) => w.en.toLowerCase().includes(q) || w.zh.toLowerCase().includes(q),
      );
    }
    const sorted = [...list];
    if (sortMode === 'recent') {
      sorted.sort((a, b) => b.added_at - a.added_at);
    } else if (sortMode === 'alpha') {
      sorted.sort((a, b) => a.en.localeCompare(b.en));
    } else if (sortMode === 'progress') {
      sorted.sort((a, b) => {
        const pa = wordProgress[a.word_id]?.status || 'new';
        const pb = wordProgress[b.word_id]?.status || 'new';
        const order: Record<string, number> = { new: 0, learning: 1, reviewing: 2, mastered: 3 };
        return (order[pb] || 0) - (order[pa] || 0);
      });
    }
    return sorted;
  }, [wordbook, search, sortMode, wordProgress]);

  const handleRemove = (wordId: string, en: string) => {
    // Two-step deletion: first click sets pending state, second click confirms
    if (pendingDelete === wordId) {
      sfx.remove();
      removeFromWordbook(wordId);
      setPendingDelete(null);
      addToast(`已移除 "${en}"`, 'info');
    } else {
      setPendingDelete(wordId);
      sfx.click();
    }
  };

  const statusColors: Record<string, string> = {
    new: 'var(--text-tertiary)',
    learning: 'var(--amber-500)',
    reviewing: 'var(--violet-500)',
    mastered: '#16a34a',
  };

  const statusLabels: Record<string, string> = {
    new: '未学',
    learning: '学习中',
    reviewing: '复习中',
    mastered: '已掌握',
  };

  if (wordbook.length === 0) {
    return (
      <div className="space-y-5 animate-fade-in">
        <div>
          <h1 className="text-2xl font-bold font-display" style={{ color: 'var(--text)' }}>
            生词本
          </h1>
          <p className="text-sm mt-1" style={{ color: 'var(--text-secondary)' }}>
            收藏需要重点记忆的单词
          </p>
        </div>

        <Card padding="lg" className="flex flex-col items-center text-center py-12">
          <div
            className="flex items-center justify-center w-16 h-16 rounded-2xl mb-4"
            style={{ background: 'rgba(245,158,11,0.12)', color: 'var(--amber-500)' }}
          >
            <Inbox size={32} />
          </div>
          <h3 className="font-bold text-base mb-1" style={{ color: 'var(--text)' }}>
            生词本是空的
          </h3>
          <p className="text-sm mb-4" style={{ color: 'var(--text-tertiary)' }}>
            在词库或学习时点击收藏按钮，将单词加入生词本
          </p>
          <Button
            variant="primary"
            onClick={() => {
              sfx.navigate();
              navigate('/library');
            }}
          >
            <Bookmark size={16} />
            去词库收藏
          </Button>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-4 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold font-display" style={{ color: 'var(--text)' }}>
            生词本
          </h1>
          <p className="text-sm mt-1" style={{ color: 'var(--text-secondary)' }}>
            共 {wordbook.length} 个单词
          </p>
        </div>
        <Button
          size="sm"
          variant="primary"
          onClick={() => {
            sfx.navigate();
            navigate('/study');
          }}
        >
          <GraduationCap size={16} />
          学习生词
        </Button>
      </div>

      {/* Search + Sort */}
      <div className="space-y-2">
        <div className="relative">
          <Search
            size={18}
            className="absolute left-3 top-1/2 -translate-y-1/2"
            style={{ color: 'var(--text-tertiary)' }}
          />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="搜索单词或释义..."
            className="w-full pl-10 pr-10 py-2.5 rounded-xl text-sm outline-none"
            style={{
              background: 'var(--surface)',
              border: '1px solid var(--border)',
              color: 'var(--text)',
            }}
          />
          {search && (
            <button
              onClick={() => setSearch('')}
              className="absolute right-3 top-1/2 -translate-y-1/2"
              style={{ color: 'var(--text-tertiary)' }}
            >
              <X size={16} />
            </button>
          )}
        </div>

        {/* Sort tabs */}
        <div className="flex gap-2">
          {(
            [
              { id: 'recent', label: '最近添加' },
              { id: 'alpha', label: '字母排序' },
              { id: 'progress', label: '按进度' },
            ] as const
          ).map((tab) => (
            <button
              key={tab.id}
              onClick={() => {
                sfx.click();
                setSortMode(tab.id);
              }}
              className="px-3 py-1.5 rounded-lg text-xs font-medium transition-all"
              style={{
                background: sortMode === tab.id ? 'var(--teal-600)' : 'var(--surface-3)',
                color: sortMode === tab.id ? '#fff' : 'var(--text-secondary)',
              }}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Word List */}
      {filtered.length > 0 ? (
        <div className="space-y-2">
          {filtered.map((entry) => {
            const emoji = getEmoji(entry.en);
            const progress = wordProgress[entry.word_id];
            const status = progress?.status || 'new';
            return (
              <Card key={entry.word_id} padding="md" className="flex items-center gap-3">
                {/* Emoji / Letter stamp */}
                <div
                  className="flex items-center justify-center w-12 h-12 rounded-xl text-2xl flex-shrink-0"
                  style={{ background: 'var(--surface-2)' }}
                >
                  {emoji || entry.en.charAt(0).toUpperCase()}
                </div>

                {/* Word info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="font-bold text-sm truncate" style={{ color: 'var(--text)' }}>
                      {entry.en}
                    </p>
                    {entry.pos && (
                      <span
                        className="text-[10px] px-1.5 py-0.5 rounded flex-shrink-0"
                        style={{ background: 'var(--surface-3)', color: 'var(--text-tertiary)' }}
                      >
                        {entry.pos}
                      </span>
                    )}
                  </div>
                  <p className="text-xs truncate" style={{ color: 'var(--text-secondary)' }}>
                    {entry.zh}
                  </p>
                  <div className="flex items-center gap-2 mt-1">
                    <span
                      className="text-[10px] px-1.5 py-0.5 rounded font-medium"
                      style={{
                        background: `${statusColors[status]}22`,
                        color: statusColors[status],
                      }}
                    >
                      {statusLabels[status]}
                    </span>
                    <span className="text-[10px]" style={{ color: 'var(--text-tertiary)' }}>
                      {relativeTime(entry.added_at)}
                    </span>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-1 flex-shrink-0">
                  <button
                    onClick={() => ttsHook.speakWord(entry.en)}
                    className="flex items-center justify-center w-9 h-9 rounded-full cursor-pointer transition-transform hover:scale-110"
                    style={{ background: 'rgba(20,184,166,0.12)', color: 'var(--teal-600)' }}
                    aria-label="发音"
                  >
                    <Volume2 size={18} />
                  </button>
                  {pendingDelete === entry.word_id ? (
                    <>
                      <button
                        onClick={() => setPendingDelete(null)}
                        className="flex items-center justify-center px-2 h-9 rounded-full cursor-pointer text-xs font-medium transition-all"
                        style={{ background: 'var(--surface-3)', color: 'var(--text-secondary)' }}
                      >
                        取消
                      </button>
                      <button
                        onClick={() => handleRemove(entry.word_id, entry.en)}
                        className="flex items-center justify-center px-2 h-9 rounded-full cursor-pointer text-xs font-bold transition-all"
                        style={{ background: '#dc2626', color: '#fff' }}
                      >
                        确认删除
                      </button>
                    </>
                  ) : (
                    <button
                      onClick={() => handleRemove(entry.word_id, entry.en)}
                      className="flex items-center justify-center w-9 h-9 rounded-full cursor-pointer transition-transform hover:scale-110"
                      style={{ background: 'rgba(220,38,38,0.1)', color: '#dc2626' }}
                      aria-label="移除"
                    >
                      <Trash2 size={16} />
                    </button>
                  )}
                </div>
              </Card>
            );
          })}
        </div>
      ) : (
        <Card padding="lg" className="text-center">
          <p className="text-sm" style={{ color: 'var(--text-tertiary)' }}>
            未找到匹配的单词
          </p>
        </Card>
      )}

      {/* Bottom action */}
      {filtered.length > 0 && (
        <Button
          fullWidth
          size="lg"
          variant="primary"
          onClick={() => {
            sfx.navigate();
            navigate('/study');
          }}
        >
          <GraduationCap size={20} />
          开始学习生词
        </Button>
      )}
    </div>
  );
}
