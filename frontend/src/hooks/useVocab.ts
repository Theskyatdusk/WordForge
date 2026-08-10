/**
 * useVocab — Hook for loading vocabulary data.
 * Uses embedded mock data as the PRIMARY source for instant rendering,
 * then optionally syncs with the backend API if available.
 */
import { useState, useEffect, useRef } from 'react';
import type { VocabData, Chapter, Item } from '../types/index';
import { vocabApi } from '../api/client';
import { mockVocabData } from '../data/mockVocab';

export interface FlatItem {
  item: Item;
  wordId: string;
  chapterId: string;
  chapter: Chapter;
}

/** Flatten the vocabulary tree into a list of items with word IDs */
export function getAllItems(vocab: VocabData): FlatItem[] {
  const result: FlatItem[] = [];
  for (const ch of vocab.chapters) {
    ch.sections.forEach((sec, si) => {
      sec.groups.forEach((grp, gi) => {
        grp.items.forEach((item, ii) => {
          result.push({
            item,
            wordId: `${ch.id}:${si}:${gi}:${ii}`,
            chapterId: ch.id,
            chapter: ch,
          });
        });
      });
    });
  }
  return result;
}

/** Get all word IDs for a specific chapter */
export function getChapterWordIds(chapter: Chapter): string[] {
  const ids: string[] = [];
  chapter.sections.forEach((sec, si) => {
    sec.groups.forEach((grp, gi) => {
      grp.items.forEach((_, ii) => {
        ids.push(`${chapter.id}:${si}:${gi}:${ii}`);
      });
    });
  });
  return ids;
}

/** Find an item by its word ID (format: chapterId:sectionIdx:groupIdx:itemIdx) */
export function findItemByWordId(vocab: VocabData, wordId: string): Item | null {
  const parts = wordId.split(':');
  if (parts.length !== 4) return null;
  const [chapterId, si, gi, ii] = parts;
  const chapter = vocab.chapters.find((c) => c.id === chapterId);
  if (!chapter) return null;
  const section = chapter.sections[parseInt(si, 10)];
  if (!section) return null;
  const group = section.groups[parseInt(gi, 10)];
  if (!group) return null;
  return group.items[parseInt(ii, 10)] || null;
}

/** Count total items in a chapter */
export function countChapterItems(chapter: Chapter): number {
  let count = 0;
  chapter.sections.forEach((sec) => {
    sec.groups.forEach((grp) => {
      count += grp.items.length;
    });
  });
  return count;
}

// Shared cache — mock data is always available immediately
let cachedData: VocabData = mockVocabData;
let apiSynced = false;

const CUSTOM_VOCAB_KEY = 'wordforge_custom_vocab';

/**
 * Load custom vocabulary from localStorage and merge into cachedData.
 * Custom chapters are appended after existing chapters; chapters with the
 * same id replace the original. This makes imported vocab immediately
 * available across the app.
 */
export function loadCustomVocab(): void {
  try {
    const raw = localStorage.getItem(CUSTOM_VOCAB_KEY);
    if (!raw) return;
    const custom = JSON.parse(raw) as VocabData;
    if (!custom.chapters || !Array.isArray(custom.chapters)) return;

    const baseChapters = [...mockVocabData.chapters];
    for (const customCh of custom.chapters) {
      const idx = baseChapters.findIndex((c) => c.id === customCh.id);
      if (idx >= 0) {
        baseChapters[idx] = customCh;
      } else {
        baseChapters.push(customCh);
      }
    }
    cachedData = { ...mockVocabData, chapters: baseChapters };
  } catch {
    // ignore parse errors
  }
}

// Load custom vocab on module init
loadCustomVocab();

export function useVocab() {
  const [data, setData] = useState<VocabData>(cachedData);
  const [loading, setLoading] = useState(false);
  // 后端不可用时使用 mock 数据作为后备，error 始终为 false，不显示错误
  const [error] = useState(false);
  const fetchedRef = useRef(false);

  useEffect(() => {
    if (fetchedRef.current) return;
    fetchedRef.current = true;

    // Data is already available from mock — no loading state needed
    setData(cachedData);
    setLoading(false);

    // Try to sync with backend API in the background (non-blocking)
    if (!apiSynced) {
      apiSynced = true;
      vocabApi
        .get()
        .then((res) => {
          if (res.success && res.data && res.data.chapters.length > 0) {
            // Merge custom vocab chapters with backend data to avoid losing imports
            try {
              const raw = localStorage.getItem(CUSTOM_VOCAB_KEY);
              if (raw) {
                const custom = JSON.parse(raw) as VocabData;
                const baseChapters = [...res.data.chapters];
                for (const customCh of custom.chapters || []) {
                  const idx = baseChapters.findIndex((c) => c.id === customCh.id);
                  if (idx >= 0) {
                    baseChapters[idx] = customCh;
                  } else {
                    baseChapters.push(customCh);
                  }
                }
                cachedData = { ...res.data, chapters: baseChapters };
              } else {
                cachedData = res.data;
              }
            } catch {
              cachedData = res.data;
            }
            setData(cachedData);
          }
        })
        .catch(() => {
          // 后端不可用时使用 mock 数据，不显示错误
        });
    }
  }, []);

  return { data, chapters: data.chapters, loading, error };
}
