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

export function useVocab() {
  const [data, setData] = useState<VocabData>(cachedData);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
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
            cachedData = res.data;
            setData(res.data);
          }
        })
        .catch(() => {
          // Silent failure — mock data is sufficient
          setError(false);
        });
    }
  }, []);

  return { data, chapters: data.chapters, loading, error };
}
