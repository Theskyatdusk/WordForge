/**
 * Library —— 对齐 web 端 pages/Library.tsx。
 * 章节卡片 + 实时搜索 + 单词详情弹窗 + 空态/骨架屏。
 */
import { useState, useMemo } from 'react';
import { View, Text, Input } from '@tarojs/components';
import Taro from '@tarojs/taro';
import { PageShell } from '../../components/ui/PageShell';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Icon } from '../../components/Icon';
import { ChapterCard } from '../../components/shared/ChapterCard';
import { WordDetailModal } from '../../components/shared/WordDetailModal';
import { useVocab, findItemByWordId } from '../../hooks/useVocab';
import { useProgressStore } from '../../store/useProgressStore';
import { useUIStore } from '../../store/useUIStore';
import { sfx } from '../../utils/sfx';
import './index.scss';

interface SelectedWord {
  wordId: string;
  en: string;
  zh: string;
  pos?: string;
  chapterId: string;
}

export default function Library() {
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
                    item.en.toLowerCase().includes(q) || item.zh.toLowerCase().includes(q),
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

  const goStudy = () => {
    sfx.navigate();
    Taro.switchTab({ url: '/pages/study/index' });
  };

  return (
    <PageShell>
      <View className="lib wf-fade-in">
        {/* 头部 */}
        <View className="wf-between lib__header">
          <View>
            <Text className="wf-h1">词库</Text>
            <Text className="wf-sub">
              共 {chapters.length} 章 · {totalWords} 个词汇
            </Text>
          </View>
          <Button
            size="sm"
            variant="secondary"
            onClick={() => {
              sfx.navigate();
              Taro.navigateTo({ url: '/pages/import/index' });
            }}
          >
            导入词库
          </Button>
        </View>

        {/* 搜索 */}
        <View className="lib__search">
          <Icon name="search" size={16} color="var(--text-tertiary)" />
          <Input
            className="lib__search-input"
            value={search}
            placeholder="搜索单词或释义..."
            placeholderClass="lib__search-ph"
            onInput={(e) => setSearch(e.detail.value)}
            confirmType="search"
          />
          {search ? (
            <Icon name="x" size={15} color="var(--text-tertiary)" onClick={() => setSearch('')} />
          ) : null}
        </View>

        {/* 章节列表 */}
        {loading ? (
          <View className="lib__list">
            {[1, 2, 3, 4].map((i) => (
              <View key={i} className="wf-skeleton lib__skeleton" />
            ))}
          </View>
        ) : filteredChapters.length > 0 ? (
          <View className="lib__list">
            {filteredChapters.map((ch) => (
              <ChapterCard key={ch.id} chapter={ch} onWordClick={handleWordClick} />
            ))}
          </View>
        ) : (
          <Card padding="lg">
            <View className="wf-state">
              <View className="wf-state__icon" style={{ background: 'var(--surface-3)' }}>
                <Icon name="book" size={26} color="var(--text-tertiary)" />
              </View>
              <Text className="wf-state__title">
                {search ? '未找到匹配的词汇' : '暂无词汇数据'}
              </Text>
              <Text className="wf-state__desc">
                {search ? '试试其他关键词' : '请导入词库或检查后端连接'}
              </Text>
            </View>
          </Card>
        )}

        {/* 底部主行动 */}
        {filteredChapters.length > 0 ? (
          <Button fullWidth size="lg" variant="primary" onClick={goStudy}>
            <Icon name="graduation" size={19} color="#ffffff" />
            开始学习
          </Button>
        ) : null}

        {/* 单词详情 */}
        {selected ? (
          <WordDetailModal
            open={!!selected}
            onClose={() => setSelected(null)}
            wordId={selected.wordId}
            en={selected.en}
            zh={selected.zh}
            pos={selected.pos}
            onAddToWordbook={handleAddToWordbook}
          />
        ) : null}
      </View>
    </PageShell>
  );
}
