/**
 * 生词本 —— 对齐 web 端 pages/Wordbook.tsx。
 *
 * 迁移差异：
 *   - useNavigate('/library') → Taro.switchTab（生词本/词库/学习都是 tab 页）
 *   - <input onChange> → <Input onInput={e => e.detail.value}>
 *   - useTTS() hook → utils/tts 单例（小程序没有 speechSynthesis，走后端 /tts + InnerAudioContext）
 *   - Tailwind 原子类 → index.scss 语义类
 */
import { useState, useMemo } from 'react';
import { View, Text, Input, ScrollView } from '@tarojs/components';
import Taro from '@tarojs/taro';
import { PageShell } from '../../components/ui/PageShell';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Icon } from '../../components/Icon';
import { useProgressStore } from '../../store/useProgressStore';
import { useUIStore } from '../../store/useUIStore';
import { tts } from '../../utils/tts';
import { sfx } from '../../utils/sfx';
import { getEmoji } from '../../utils/visuals';
import { relativeTime } from '../../utils/format';
import './index.scss';

const STATUS_COLORS: Record<string, string> = {
  new: '#94a3b8',
  learning: '#f59e0b',
  reviewing: '#8b5cf6',
  mastered: '#16a34a',
};

const STATUS_LABELS: Record<string, string> = {
  new: '未学',
  learning: '学习中',
  reviewing: '复习中',
  mastered: '已掌握',
};

const SORT_TABS = [
  { id: 'recent', label: '最近添加' },
  { id: 'alpha', label: '字母排序' },
  { id: 'progress', label: '按进度' },
] as const;

type SortMode = (typeof SORT_TABS)[number]['id'];

export default function WordbookPage() {
  const wordbook = useProgressStore((s) => s.wordbook);
  const removeFromWordbook = useProgressStore((s) => s.removeFromWordbook);
  const wordProgress = useProgressStore((s) => s.wordProgress);
  const addToast = useUIStore((s) => s.addToast);

  const [search, setSearch] = useState('');
  const [sortMode, setSortMode] = useState<SortMode>('recent');

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
      const order: Record<string, number> = { new: 0, learning: 1, reviewing: 2, mastered: 3 };
      sorted.sort((a, b) => {
        const pa = wordProgress[a.word_id]?.status || 'new';
        const pb = wordProgress[b.word_id]?.status || 'new';
        return (order[pb] || 0) - (order[pa] || 0);
      });
    }
    return sorted;
  }, [wordbook, search, sortMode, wordProgress]);

  const goStudy = () => {
    sfx.navigate();
    Taro.switchTab({ url: '/pages/study/index' });
  };

  const goLibrary = () => {
    sfx.navigate();
    Taro.switchTab({ url: '/pages/library/index' });
  };

  const handleRemove = (wordId: string, en: string) => {
    sfx.remove();
    removeFromWordbook(wordId);
    addToast(`已移除 "${en}"`, 'info');
  };

  /* ---------- 空态 ---------- */
  if (wordbook.length === 0) {
    return (
      <PageShell>
        <View className="wf-fade-in">
          <View className="wb__head">
            <Text className="wf-h1">生词本</Text>
            <Text className="wf-sub">收藏需要重点记忆的单词</Text>
          </View>

          <Card padding="lg" className="wb__empty">
            <View className="wb__empty-icon">
              <Icon name="inbox" size={32} color="#f59e0b" />
            </View>
            <Text className="wb__empty-title">生词本是空的</Text>
            <Text className="wb__empty-desc">在词库或学习时点击收藏按钮，将单词加入生词本</Text>
            <Button variant="primary" onClick={goLibrary}>
              <Icon name="bookmark" size={16} color="#fff" />
              <Text className="wb__btn-text">去词库收藏</Text>
            </Button>
          </Card>
        </View>
      </PageShell>
    );
  }

  /* ---------- 列表态 ---------- */
  return (
    <PageShell>
      <View className="wf-fade-in">
        {/* Header */}
        <View className="wf-between wb__head">
          <View>
            <Text className="wf-h1">生词本</Text>
            <Text className="wf-sub">共 {wordbook.length} 个单词</Text>
          </View>
          <Button size="sm" variant="primary" onClick={goStudy}>
            <Icon name="graduation" size={16} color="#fff" />
            <Text className="wb__btn-text">学习生词</Text>
          </Button>
        </View>

        {/* 搜索 */}
        <View className="wb__search">
          <Icon name="search" size={18} color="#94a3b8" className="wb__search-icon" />
          <Input
            className="wb__search-input"
            value={search}
            placeholder="搜索单词或释义..."
            placeholderClass="wb__search-ph"
            confirmType="search"
            onInput={(e) => setSearch(e.detail.value)}
          />
          {!!search && (
            <View className="wb__search-clear" onClick={() => setSearch('')}>
              <Icon name="x" size={16} color="#94a3b8" />
            </View>
          )}
        </View>

        {/* 排序 tabs */}
        <View className="wb__tabs">
          {SORT_TABS.map((tab) => (
            <View
              key={tab.id}
              className={`wb__tab ${sortMode === tab.id ? 'wb__tab--on' : ''}`}
              hoverClass="wb__tab--pressed"
              onClick={() => {
                sfx.click();
                setSortMode(tab.id);
              }}
            >
              <Text className="wb__tab-text">{tab.label}</Text>
            </View>
          ))}
        </View>

        {/* 列表 */}
        {filtered.length > 0 ? (
          <ScrollView scrollY className="wb__list" enhanced showScrollbar={false}>
            {filtered.map((entry) => {
              const emoji = getEmoji(entry.en);
              const status = wordProgress[entry.word_id]?.status || 'new';
              return (
                <Card key={entry.word_id} padding="md" className="wb__item">
                  {/* 图标 / 首字母印章 */}
                  <View className="wb__stamp">
                    <Text className="wb__stamp-text">
                      {emoji || entry.en.charAt(0).toUpperCase()}
                    </Text>
                  </View>

                  {/* 词条信息 */}
                  <View className="wb__info">
                    <View className="wf-row">
                      <Text className="wb__en">{entry.en}</Text>
                      {!!entry.pos && <Text className="wb__pos">{entry.pos}</Text>}
                    </View>
                    <Text className="wb__zh">{entry.zh}</Text>
                    <View className="wf-row wb__meta">
                      <Text
                        className="wb__status"
                        style={{
                          background: `${STATUS_COLORS[status]}22`,
                          color: STATUS_COLORS[status],
                        }}
                      >
                        {STATUS_LABELS[status]}
                      </Text>
                      <Text className="wb__time">{relativeTime(entry.added_at)}</Text>
                    </View>
                  </View>

                  {/* 操作 */}
                  <View className="wb__actions">
                    <View
                      className="wb__act wb__act--speak"
                      hoverClass="wb__act--pressed"
                      onClick={() => tts.speakWord(entry.en)}
                    >
                      <Icon name="volume" size={18} color="#0d9488" />
                    </View>
                    <View
                      className="wb__act wb__act--del"
                      hoverClass="wb__act--pressed"
                      onClick={() => handleRemove(entry.word_id, entry.en)}
                    >
                      <Icon name="trash" size={16} color="#dc2626" />
                    </View>
                  </View>
                </Card>
              );
            })}
          </ScrollView>
        ) : (
          <Card padding="lg" className="wb__nores">
            <Text className="wb__nores-text">未找到匹配的单词</Text>
          </Card>
        )}

        {/* 底部主行动 */}
        {filtered.length > 0 && (
          <Button fullWidth size="lg" variant="primary" onClick={goStudy} className="wb__cta">
            <Icon name="graduation" size={20} color="#fff" />
            <Text className="wb__btn-text">开始学习生词</Text>
          </Button>
        )}
      </View>
    </PageShell>
  );
}
