/**
 * Library — Vocabulary library with chapter cards, search, and word details.
 *
 * Features:
 * - Searchable chapter list with live filtering
 * - Chapter cards with expand/collapse
 * - Word detail modal on click
 * - Empty state for no results
 * - Loading skeleton
 */
import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, X, GraduationCap, BookOpen } from 'lucide-react';
import { useVocab, findItemByWordId } from '../hooks/useVocab';
import { ChapterCard } from '../components/shared/ChapterCard';
import { WordDetailModal } from '../components/shared/WordDetailModal';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { sfx } from '../utils/sfx';
import { useProgressStore } from '../store/useProgressStore';
import { useUIStore } from '../store/useUIStore';

interface SelectedWord {
  wordId: string;
  en: string;
  zh: string;
  pos?: string;
  chapterId: string;
}

export function Library() {
  const navigate = useNavigate();
  const { data, chapters, loading } = useVocab();
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<SelectedWord | null>(null);
  const addToWordbook = useProgressStore((s) => s.addToWordbook);
  const addToast = useUIStore((s) => s.addToast);

  const filteredChapters = useMemo(() => {
    if (!search.trim()) return chapters;
    const q = search.toLowerCase().trim();
    return chapters
      .map((ch) => ({
        ...ch,
        sections: ch.sections
          .map((sec) => ({
            ...sec,
            groups: sec.groups
              .map((grp) => ({
                ...grp,
                items: grp.items.filter(
                  (item) =>
                    item.en.toLowerCase().includes(q) ||
                    item.zh.toLowerCase().includes(q),
                ),
              }))
              .filter((grp) => grp.items.length > 0),
          }))
          .filter((sec) => sec.groups.length > 0),
      }))
      .filter((ch) => ch.sections.length > 0);
  }, [chapters, search]);

  const totalWords = useMemo(
    () =>
      chapters.reduce(
        (sum, ch) =>
          sum +
          ch.sections.reduce(
            (s, sec) => s + sec.groups.reduce((g, grp) => g + grp.items.length, 0),
            0,
          ),
        0,
      ),
    [chapters],
  );

  const handleWordClick = (wordId: string, en: string, zh: string) => {
    sfx.click();
    const parts = wordId.split(':');
    const item = findItemByWordId(data, wordId);
    setSelected({ wordId, en, zh, pos: item?.pos, chapterId: parts[0] });
  };

  const handleAddToWordbook = (wordId: string) => {
    if (!selected) return;
    addToWordbook({
      word_id: wordId,
      en: selected.en,
      zh: selected.zh,
      pos: selected.pos,
      chapter_id: selected.chapterId,
    });
    addToast('已添加到生词本', 'success');
  };

  return (
    <div className="space-y-4 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between animate-slide-up">
        <div>
          <h1 className="text-2xl font-bold font-display" style={{ color: 'var(--text)' }}>
            词库
          </h1>
          <p className="text-sm mt-1" style={{ color: 'var(--text-secondary)' }}>
            共 {chapters.length} 章 · {totalWords} 个词汇
          </p>
        </div>
        <Button
          size="sm"
          variant="secondary"
          onClick={() => {
            sfx.navigate();
            navigate('/import');
          }}
        >
          导入词库
        </Button>
      </div>

      {/* Search */}
      <div className="relative animate-slide-up stagger-1">
        <Search
          size={18}
          className="absolute left-3.5 top-1/2 -translate-y-1/2"
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
            transition: 'border-color 0.2s ease, box-shadow 0.2s ease',
          }}
          onFocus={(e) => {
            e.target.style.borderColor = 'var(--teal-500)';
            e.target.style.boxShadow = '0 0 0 3px rgba(20,184,166,0.1)';
          }}
          onBlur={(e) => {
            e.target.style.borderColor = 'var(--border)';
            e.target.style.boxShadow = 'none';
          }}
        />
        {search && (
          <button
            onClick={() => setSearch('')}
            className="absolute right-3.5 top-1/2 -translate-y-1/2 cursor-pointer"
            style={{ color: 'var(--text-tertiary)' }}
          >
            <X size={16} />
          </button>
        )}
      </div>

      {/* Chapter List */}
      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3, 4].map((i) => (
            <div
              key={i}
              className="rounded-2xl p-4 skeleton"
              style={{ background: 'var(--surface)', border: '1px solid var(--border-light)', height: 80 }}
            />
          ))}
        </div>
      ) : filteredChapters.length > 0 ? (
        <div className="space-y-3">
          {filteredChapters.map((ch, i) => (
            <div key={ch.id} className={`animate-slide-up stagger-${Math.min(i + 2, 8)}`}>
              <ChapterCard chapter={ch} onWordClick={handleWordClick} />
            </div>
          ))}
        </div>
      ) : (
        <Card padding="lg" className="text-center">
          <div
            className="flex items-center justify-center w-16 h-16 rounded-full mx-auto mb-3"
            style={{ background: 'var(--surface-3)' }}
          >
            <BookOpen size={28} style={{ color: 'var(--text-tertiary)' }} />
          </div>
          <p className="text-sm font-medium mb-1" style={{ color: 'var(--text)' }}>
            {search ? '未找到匹配的词汇' : '暂无词汇数据'}
          </p>
          <p className="text-xs" style={{ color: 'var(--text-tertiary)' }}>
            {search ? '试试其他关键词' : '请导入词库或检查后端连接'}
          </p>
        </Card>
      )}

      {/* Study All Button */}
      {filteredChapters.length > 0 && (
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
          开始学习
        </Button>
      )}

      {/* Word Detail Modal */}
      {selected && (
        <WordDetailModal
          open={!!selected}
          onClose={() => setSelected(null)}
          wordId={selected.wordId}
          en={selected.en}
          zh={selected.zh}
          pos={selected.pos}
          onAddToWordbook={handleAddToWordbook}
        />
      )}
    </div>
  );
}
