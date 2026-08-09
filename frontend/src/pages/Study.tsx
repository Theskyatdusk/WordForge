/**
 * Study — Study session with multiple learning modes.
 *
 * Modes: flashcard, quiz, spelling, listening, image, recall, cloze, zhan, confuse, adaptive
 * Features: SM-2 SRS, TTS, memory strength bar, keyboard shortcuts,
 *           interleaved review, multiple correct answers, shadow speech,
 *           weekly review, mistakes review
 */
import { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import {
  Layers,
  CheckSquare,
  Type,
  Headphones,
  ChevronLeft,
  Volume2,
  Check,
  X,
  RotateCw,
  Home,
  Sparkles,
  Image as ImageIcon,
  Brain,
  AlignLeft,
  Zap,
  Shuffle,
  Cpu,
  Mic,
  Calendar,
  AlertCircle,
} from 'lucide-react';
import { useVocab, getAllItems, getChapterWordIds, findItemByWordId } from '../hooks/useVocab';
import { useProgressStore } from '../store/useProgressStore';
import { useSettingsStore } from '../store/useSettingsStore';
import { useUIStore } from '../store/useUIStore';
import { useTTS } from '../hooks/useTTS';
import { tts as ttsUtil } from '../utils/tts';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { sfx } from '../utils/sfx';
import { isDue, getStrength, weakness } from '../utils/srs';
import { getEmoji, affixHint, getChapterIcon } from '../utils/visuals';
import { getExamples } from '../utils/examples';
import { getQuestion } from '../utils/confuse';
import { shadowStart, shadowStop, shadowSupported } from '../utils/shadow';
import { formatDuration } from '../utils/format';
import type { SrsGrade, ExampleSentence, ConfuseQuestion, ShadowResult } from '../types/index';

type StudyMode = 'flashcard' | 'quiz' | 'spelling' | 'listening' | 'image' | 'recall' | 'cloze' | 'zhan' | 'confuse' | 'adaptive';

interface SessionWord {
  wordId: string;
  en: string;
  zh: string;
  pos?: string;
}

interface QuizOption {
  en: string;
  zh: string;
  correct: boolean;
}

const MODES: Array<{
  id: StudyMode;
  label: string;
  desc: string;
  icon: typeof Layers;
  color: string;
  bg: string;
}> = [
  { id: 'flashcard', label: '卡片记忆', desc: '翻转卡片学习', icon: Layers, color: 'var(--teal-600)', bg: 'rgba(20,184,166,0.12)' },
  { id: 'quiz', label: '选择题', desc: '中英双向选择', icon: CheckSquare, color: 'var(--violet-500)', bg: 'rgba(139,92,246,0.12)' },
  { id: 'spelling', label: '拼写练习', desc: '看中文拼英文', icon: Type, color: '#f59e0b', bg: 'rgba(245,158,11,0.12)' },
  { id: 'listening', label: '听力训练', desc: '听音选词义', icon: Headphones, color: '#ec4899', bg: 'rgba(236,72,153,0.12)' },
  { id: 'image', label: '图文模式', desc: '视觉联想记忆', icon: ImageIcon, color: '#06b6d4', bg: 'rgba(6,182,212,0.12)' },
  { id: 'recall', label: '主动回忆', desc: '先回忆再对照', icon: Brain, color: '#8b5cf6', bg: 'rgba(139,92,246,0.12)' },
  { id: 'cloze', label: '例句挖空', desc: '语境填空练习', icon: AlignLeft, color: '#10b981', bg: 'rgba(16,185,129,0.12)' },
  { id: 'zhan', label: '斩模式', desc: '快速过词', icon: Zap, color: '#f97316', bg: 'rgba(249,115,22,0.12)' },
  { id: 'confuse', label: '易混词辨析', desc: '形近词区分', icon: Shuffle, color: '#ef4444', bg: 'rgba(239,68,68,0.12)' },
  { id: 'adaptive', label: '自适应模式', desc: '智能调节难度', icon: Cpu, color: '#6366f1', bg: 'rgba(99,102,241,0.12)' },
];

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/** Interleave words by weakness: alternate weak and strong for spaced reinforcement */
function interleaveByWeakness(
  words: SessionWord[],
  getWeakness: (wordId: string) => number,
): SessionWord[] {
  if (words.length <= 2) return [...words];
  const scored = words.map((w) => ({ w, weakness: getWeakness(w.wordId) }));
  scored.sort((a, b) => b.weakness - a.weakness); // Weakest first
  const result: SessionWord[] = [];
  let lo = 0;
  let hi = scored.length - 1;
  while (lo <= hi) {
    if (lo <= hi) result.push(scored[lo++].w); // Weakest remaining
    if (lo <= hi) result.push(scored[hi--].w); // Strongest remaining
  }
  return result;
}

/** Pick the appropriate sub-mode for adaptive learning based on word progress */
function getAdaptiveMode(status: string | undefined): StudyMode {
  if (!status || status === 'new') return 'flashcard';
  if (status === 'learning') return 'quiz';
  if (status === 'reviewing') return 'confuse';
  return 'recall'; // mastered
}

/** Build cloze data from example sentences */
function getClozeData(
  en: string,
  examples: ExampleSentence[],
): { original: string; blanked: string; translation: string; answer: string } | null {
  const escaped = en.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  for (const ex of examples) {
    if (!ex.en) continue;
    const regex = new RegExp(`\\b${escaped}\\b`, 'i');
    if (regex.test(ex.en)) {
      const blanked = ex.en.replace(regex, '_____');
      return { original: ex.en, blanked, translation: ex.zh, answer: en };
    }
  }
  return null;
}

/** Memory strength bar component */
function MemoryStrengthBar({ strength }: { strength: number }) {
  const color = strength < 40 ? '#ef4444' : strength < 70 ? '#f59e0b' : '#16a34a';
  const label = strength < 40 ? '薄弱' : strength < 70 ? '巩固中' : '扎实';
  return (
    <div className="flex items-center gap-2">
      <span className="text-[10px] font-medium flex-shrink-0" style={{ color: 'var(--text-tertiary)' }}>
        记忆强度
      </span>
      <div
        className="flex-1 rounded-full overflow-hidden"
        style={{ height: 4, background: 'var(--surface-3)' }}
      >
        <div
          className="h-full rounded-full transition-all duration-500"
          style={{ width: `${strength}%`, background: color }}
        />
      </div>
      <span className="text-[10px] font-bold flex-shrink-0" style={{ color }}>
        {strength}% · {label}
      </span>
    </div>
  );
}

export function Study() {
  const navigate = useNavigate();
  const { chapterId: routeChapterId } = useParams();
  const [searchParams, setSearchParams] = useSearchParams();
  const { data, chapters } = useVocab();
  const answerWord = useProgressStore((s) => s.answerWord);
  const wordProgress = useProgressStore((s) => s.wordProgress);
  const studyHistory = useProgressStore((s) => s.studyHistory);
  const setStudyHistory = useProgressStore((s) => s.setStudyHistory);
  const checkin = useProgressStore((s) => s.checkin);
  const mistakes = useProgressStore((s) => s.mistakes);
  const checkAndUnlockAchievements = useProgressStore((s) => s.checkAndUnlockAchievements);
  const settings = useSettingsStore((s) => s.settings);
  const addToast = useUIStore((s) => s.addToast);
  const ttsHook = useTTS();
  // Stable ref to avoid re-triggering auto-play effect on every render
  const ttsRef = useRef(ttsHook);
  ttsRef.current = ttsHook;

  const [phase, setPhase] = useState<'select' | 'studying' | 'result'>('select');
  const [mode, setMode] = useState<StudyMode>('flashcard');
  const [selectedChapterId, setSelectedChapterId] = useState<string | null>(null);
  const [sessionWords, setSessionWords] = useState<SessionWord[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [quizOptions, setQuizOptions] = useState<QuizOption[]>([]);
  const [quizDirection, setQuizDirection] = useState<'zh-to-en' | 'en-to-zh'>('zh-to-en');
  const [selectedOption, setSelectedOption] = useState<number | null>(null);
  const [spellingInput, setSpellingInput] = useState('');
  const [clozeAnswer, setClozeAnswer] = useState('');
  const [answered, setAnswered] = useState(false);
  const [correctCount, setCorrectCount] = useState(0);
  const [wrongCount, setWrongCount] = useState(0);
  const [familiarCount, setFamiliarCount] = useState(0);
  const [startTime, setStartTime] = useState(0);
  const [wordShownAt, setWordShownAt] = useState(0);
  const [attempt, setAttempt] = useState(0);

  // Multiple correct answers tracking
  const [sessionCorrect, setSessionCorrect] = useState<Record<string, number>>({});
  const [completed, setCompleted] = useState<Record<string, boolean>>({});

  // Shadow speech
  const [shadowResult, setShadowResult] = useState<ShadowResult | null>(null);
  const [shadowListening, setShadowListening] = useState(false);

  const allFlatItems = useMemo(() => getAllItems(data), [data]);

  const wordPool = useMemo(
    () => allFlatItems.map((fi) => ({ wordId: fi.wordId, en: fi.item.en, zh: fi.item.zh, pos: fi.item.pos })),
    [allFlatItems],
  );

  // Auto-start if routeChapterId is provided
  useEffect(() => {
    if (routeChapterId && phase === 'select') {
      const chapter = chapters.find((c) => c.id === routeChapterId);
      if (chapter) {
        setSelectedChapterId(routeChapterId);
      }
    }
  }, [routeChapterId, chapters, phase]);

  // Auto-start from search params (weekly review, confuse mode)
  useEffect(() => {
    if (phase !== 'select') return;
    const autoMode = searchParams.get('mode');
    if (!autoMode) return;
    // Defer to next tick to ensure data is ready
    const timer = setTimeout(() => {
      if (autoMode === 'weekly') {
        startSession('adaptive', 'weekly');
      } else if (autoMode === 'confuse') {
        startSession('confuse', null);
      } else if (autoMode === 'mistakes') {
        startSession('adaptive', 'mistakes');
      }
      searchParams.delete('mode');
      setSearchParams(searchParams, { replace: true });
    }, 200);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams, phase]);

  const currentWord = sessionWords[currentIndex] || null;

  // Compute effective mode (for adaptive mode, pick sub-mode per word)
  const effectiveMode = useMemo((): StudyMode => {
    if (mode !== 'adaptive' || !currentWord) return mode;
    const progress = wordProgress[currentWord.wordId];
    return getAdaptiveMode(progress?.status);
  }, [mode, currentWord, wordProgress]);

  // Generate examples for current word
  const examples = useMemo(() => {
    if (!currentWord) return [];
    return settings.examplesOnCard ? getExamples(currentWord.en, currentWord.zh, currentWord.pos, data) : [];
  }, [currentWord, settings.examplesOnCard, data]);

  // Compute cloze data
  const clozeData = useMemo(() => {
    if ((effectiveMode !== 'cloze' && mode !== 'cloze') || !currentWord) return null;
    return getClozeData(currentWord.en, examples);
  }, [effectiveMode, mode, currentWord, examples]);

  // Compute confuse question
  const confuseQuestion = useMemo((): ConfuseQuestion | null => {
    if (effectiveMode !== 'confuse' || !currentWord) return null;
    const targetItem = findItemByWordId(data, currentWord.wordId);
    if (!targetItem) return null;
    const allItems = allFlatItems.map((fi) => fi.item);
    return getQuestion(currentWord.wordId, targetItem, allItems);
  }, [effectiveMode, currentWord, data, allFlatItems]);

  // Final render mode with fallbacks
  const renderMode = useMemo((): StudyMode => {
    if (effectiveMode === 'confuse' && !confuseQuestion) return 'quiz';
    if (effectiveMode === 'cloze' && !clozeData) return 'spelling';
    return effectiveMode;
  }, [effectiveMode, confuseQuestion, clozeData]);

  // Memory strength for current word
  const memoryStrength = useMemo(() => {
    if (!currentWord) return 0;
    return getStrength(wordProgress[currentWord.wordId]);
  }, [currentWord, wordProgress]);

  // Generate quiz options when current word or attempt changes
  useEffect(() => {
    if (phase !== 'studying' || !currentWord) return;
    if (renderMode === 'quiz' || renderMode === 'listening') {
      // Randomly choose direction for mixed quiz mode
      if (renderMode === 'quiz') {
        setQuizDirection(Math.random() < 0.5 ? 'zh-to-en' : 'en-to-zh');
      }
      const correct: QuizOption = { en: currentWord.en, zh: currentWord.zh, correct: true };
      const distractorCount = settings.quizOptionCount - 1;
      const distractors = shuffle(wordPool.filter((w) => w.wordId !== currentWord.wordId))
        .slice(0, distractorCount)
        .map((w) => ({ en: w.en, zh: w.zh, correct: false }));
      setQuizOptions(shuffle([correct, ...distractors]));
    }
    setWordShownAt(Date.now());
  }, [currentIndex, attempt, phase, renderMode, currentWord, wordPool, settings.quizOptionCount]);

  // Auto-play TTS — all study modes, intelligently timed
  // Uses ttsRef (stable ref) instead of ttsHook to prevent re-triggering
  useEffect(() => {
    if (phase !== 'studying' || !currentWord) return;
    if (!settings.ttsAutoPlay) return;

    let shouldPlay = false;

    switch (renderMode) {
      // English always visible → play immediately
      case 'listening':
      case 'image':
      case 'confuse':
      case 'spelling':
        shouldPlay = true;
        break;
      // English on front (not flipped) → play on show
      case 'flashcard':
      case 'zhan':
        shouldPlay = !flipped;
        break;
      // English on back (flipped) → play after flip
      case 'recall':
        shouldPlay = flipped;
        break;
      // Quiz: English visible as question (en-to-zh) or after answered
      case 'quiz':
        shouldPlay = quizDirection === 'en-to-zh' || answered;
        break;
      // Cloze: word is the answer → play after answered
      case 'cloze':
        shouldPlay = answered;
        break;
    }

    if (shouldPlay) {
      const timer = setTimeout(() => ttsRef.current.speakWord(currentWord.en), 300);
      return () => clearTimeout(timer);
    }
  }, [currentIndex, attempt, phase, renderMode, currentWord, settings.ttsAutoPlay, flipped, quizDirection, answered]);

  // Preload current word's audio for instant playback
  useEffect(() => {
    if (currentWord?.en) {
      ttsUtil.preload(currentWord.en);
    }
  }, [currentWord]);

  // Cleanup shadow on unmount
  useEffect(() => {
    return () => shadowStop();
  }, []);

  // Determine if current mode is self-graded (no multiple correct needed)
  // Quiz, listening, confuse: one answer per word, always advance to next
  const isSelfGraded = renderMode === 'flashcard' || renderMode === 'recall' || renderMode === 'image' || renderMode === 'zhan' || renderMode === 'quiz' || renderMode === 'listening' || renderMode === 'confuse';
  const requiredCorrect = isSelfGraded ? 1 : Math.max(1, settings.repeatCorrect);
  const currentCorrect = currentWord ? sessionCorrect[currentWord.wordId] || 0 : 0;
  const wordCompleted = answered && currentCorrect >= requiredCorrect;

  // Auto-advance to next word after correct answer
  useEffect(() => {
    if (!settings.autoAdvance || !wordCompleted) return;
    const timer = setTimeout(() => {
      handleNext();
    }, settings.autoAdvanceDelay * 1000);
    return () => clearTimeout(timer);
  }, [wordCompleted, settings.autoAdvance, settings.autoAdvanceDelay]);

  // Auto-flip card in flashcard mode
  useEffect(() => {
    if (!settings.cardAutoFlip || phase !== 'studying' || !currentWord) return;
    if (renderMode !== 'flashcard' && renderMode !== 'zhan' && renderMode !== 'recall') return;
    if (flipped || answered) return;
    const timer = setTimeout(() => {
      sfx.flip();
      setFlipped(true);
    }, settings.cardAutoFlipDelay * 1000);
    return () => clearTimeout(timer);
  }, [currentIndex, attempt, phase, renderMode, currentWord, flipped, answered, settings.cardAutoFlip, settings.cardAutoFlipDelay]);

  // Keyboard shortcuts
  useEffect(() => {
    if (phase !== 'studying') return;

    const handleKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') {
        // In input fields: Enter submits
        if (e.key === 'Enter') {
          if (renderMode === 'spelling' && !answered) {
            handleSpellingSubmit();
          } else if (renderMode === 'cloze' && !answered) {
            handleClozeSubmit();
          } else if (answered && wordCompleted) {
            handleNext();
          }
        }
        return;
      }

      // Global shortcuts (not in input)
      if (e.key === ' ') {
        e.preventDefault();
        if (renderMode === 'flashcard' && !answered) {
          sfx.flip();
          setFlipped((f) => !f);
        } else if ((renderMode === 'zhan' || renderMode === 'recall') && !answered && !flipped) {
          setFlipped(true);
        } else if (answered && wordCompleted) {
          handleNext();
        }
      } else if (e.key === 'Enter') {
        if (answered && wordCompleted) {
          handleNext();
        } else if (renderMode === 'spelling' && !answered) {
          handleSpellingSubmit();
        } else if (renderMode === 'cloze' && !answered) {
          handleClozeSubmit();
        }
      } else if (e.key === 'r' || e.key === 'R') {
        if (currentWord) ttsHook.speakWord(currentWord.en);
      } else if (e.key === 's' || e.key === 'S') {
        if (shadowSupported() && currentWord && !shadowListening) {
          handleShadow();
        }
      } else if (e.key >= '1' && e.key <= '4') {
        const idx = parseInt(e.key, 10) - 1;
        if ((renderMode === 'quiz' || renderMode === 'listening' || renderMode === 'confuse') && !answered) {
          const opts = renderMode === 'confuse' ? confuseQuestion?.options : quizOptions;
          if (opts && opts[idx]) {
            if (renderMode === 'confuse') {
              handleConfuseAnswer(idx);
            } else {
              handleQuizAnswer(idx);
            }
          }
        }
      } else if (e.key === 'j' || e.key === 'J') {
        if (!answered) {
          if (renderMode === 'flashcard' && flipped) handleAnswer(false);
          else if (renderMode === 'zhan' && flipped) handleAnswer(false);
          else if (renderMode === 'recall' && flipped) handleAnswer(false);
          else if (renderMode === 'image') handleAnswer(false);
        }
      } else if (e.key === 'k' || e.key === 'K') {
        if (!answered) {
          if (renderMode === 'flashcard' && flipped) handleAnswer(true);
          else if (renderMode === 'zhan' && flipped) handleAnswer(true);
          else if (renderMode === 'recall' && flipped) handleAnswer(true);
          else if (renderMode === 'image') handleAnswer(true);
        }
      }
    };

    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, renderMode, answered, flipped, wordCompleted, currentWord, shadowListening, quizOptions, confuseQuestion]);

  const startSession = useCallback(
    (selectedMode: StudyMode, chapterId: string | null) => {
      let words: SessionWord[] = [];
      let effectiveSessionMode = selectedMode;

      if (chapterId === 'weekly') {
        // Weekly review: gather words from last 7 days + learning + mistakes
        const weekAgo = Date.now() - 7 * 86400000;
        const wordIdSet = new Set<string>();
        for (const fi of allFlatItems) {
          const p = wordProgress[fi.wordId];
          if (p && ((p.last_review !== null && p.last_review >= weekAgo) || p.status === 'learning')) {
            wordIdSet.add(fi.wordId);
          }
        }
        for (const mid of mistakes) {
          wordIdSet.add(mid);
        }
        words = allFlatItems
          .filter((fi) => wordIdSet.has(fi.wordId))
          .map((fi) => ({ wordId: fi.wordId, en: fi.item.en, zh: fi.item.zh, pos: fi.item.pos }));
        // Interleave by weakness (don't shuffle — interleaving is intentional)
        words = interleaveByWeakness(words, (wid) => weakness(wordProgress[wid]));
        effectiveSessionMode = 'adaptive';
      } else if (chapterId === 'mistakes') {
        // Mistakes review
        words = allFlatItems
          .filter((fi) => mistakes.includes(fi.wordId))
          .map((fi) => ({ wordId: fi.wordId, en: fi.item.en, zh: fi.item.zh, pos: fi.item.pos }));
        words = interleaveByWeakness(words, (wid) => weakness(wordProgress[wid]));
        effectiveSessionMode = 'adaptive';
      } else if (chapterId) {
        // Normal chapter
        const chapter = chapters.find((c) => c.id === chapterId);
        if (!chapter) return;
        const ids = getChapterWordIds(chapter);
        words = ids.map((id) => {
          const parts = id.split(':');
          const item = chapter.sections[parseInt(parts[1], 10)]?.groups[parseInt(parts[2], 10)]?.items[parseInt(parts[3], 10)];
          return { wordId: id, en: item?.en || '', zh: item?.zh || '', pos: item?.pos };
        });
        words = shuffle(words);
      } else {
        // Due words mode
        const dueIds = allFlatItems
          .filter((fi) => isDue(wordProgress[fi.wordId]))
          .map((fi) => ({ wordId: fi.wordId, en: fi.item.en, zh: fi.item.zh, pos: fi.item.pos }));
        words = shuffle(dueIds);
      }

      // Interleave by weakness for due words mode (not for weekly, already interleaved)
      if (!chapterId || (chapterId !== 'weekly' && chapterId !== 'mistakes')) {
        if (selectedMode === 'adaptive') {
          words = interleaveByWeakness(words, (wid) => weakness(wordProgress[wid]));
        }
      }

      words = words.slice(0, settings.dailyGoal);
      if (words.length === 0) {
        addToast('没有可学习的单词', 'warning');
        return;
      }

      setMode(effectiveSessionMode);
      setSessionWords(words);
      setCurrentIndex(0);
      setFlipped(false);
      setQuizOptions([]);
      setSelectedOption(null);
      setSpellingInput('');
      setClozeAnswer('');
      setAnswered(false);
      setCorrectCount(0);
      setWrongCount(0);
      setFamiliarCount(0);
      setSessionCorrect({});
      setCompleted({});
      setStartTime(Date.now());
      setAttempt(0);
      setShadowResult(null);
      setShadowListening(false);
      setPhase('studying');
    },
    [chapters, allFlatItems, wordProgress, settings.dailyGoal, mistakes, addToast],
  );

  const handleAnswer = useCallback(
    (grade: SrsGrade) => {
      if (!currentWord || answered) return;
      const respondedMs = wordShownAt ? Date.now() - wordShownAt : null;
      answerWord(currentWord.wordId, grade, respondedMs);

      if (grade === true) {
        setCorrectCount((c) => c + 1);
        sfx.correct();
        // Track session correct count
        const newCount = currentCorrect + 1;
        setSessionCorrect((prev) => ({ ...prev, [currentWord.wordId]: newCount }));
        if (newCount >= requiredCorrect) {
          setCompleted((prev) => ({ ...prev, [currentWord.wordId]: true }));
        }
      } else if (grade === 'familiar') {
        setFamiliarCount((c) => c + 1);
        sfx.click();
      } else {
        setWrongCount((c) => c + 1);
        sfx.wrong();
        // Reset correct count on wrong answer
        setSessionCorrect((prev) => ({ ...prev, [currentWord.wordId]: 0 }));
      }
      setAnswered(true);
    },
    [currentWord, answered, wordShownAt, answerWord, currentCorrect, requiredCorrect],
  );

  const handleQuizAnswer = (idx: number) => {
    if (answered || !quizOptions[idx]) return;
    setSelectedOption(idx);
    const isCorrect = quizOptions[idx].correct;
    handleAnswer(isCorrect ? true : false);
  };

  const handleConfuseAnswer = (idx: number) => {
    if (answered || !confuseQuestion?.options[idx]) return;
    setSelectedOption(idx);
    const isCorrect = confuseQuestion.options[idx].correct;
    handleAnswer(isCorrect ? true : false);
  };

  const handleSpellingSubmit = () => {
    if (answered || !currentWord) return;
    const userInput = spellingInput.trim().toLowerCase();
    const correct = currentWord.en.toLowerCase();
    handleAnswer(userInput === correct ? true : false);
  };

  const handleClozeSubmit = () => {
    if (answered || !currentWord || !clozeData) return;
    const userInput = clozeAnswer.trim().toLowerCase();
    const correct = clozeData.answer.toLowerCase();
    handleAnswer(userInput === correct ? true : false);
  };

  const handleShadow = () => {
    if (!currentWord || shadowListening) return;
    setShadowListening(true);
    setShadowResult(null);
    shadowStart(currentWord.en, (result) => {
      setShadowListening(false);
      setShadowResult(result);
      if (result.score !== undefined && result.score >= 80) {
        sfx.correct();
      }
    });
  };

  const handleNext = () => {
    sfx.click();
    shadowStop();
    setShadowResult(null);
    setShadowListening(false);

    if (currentIndex + 1 >= sessionWords.length) {
      // Finish session
      const studied = sessionWords.length;
      const correct = correctCount;
      const wrong = wrongCount;
      const today = new Date().toLocaleDateString('sv-SE');
      const history = studyHistory.map((h) => {
        if (h.date === today) {
          return {
            ...h,
            words_studied: h.words_studied + studied,
            correct: h.correct + correct,
            wrong: h.wrong + wrong,
            sessions: h.sessions + 1,
            modes: { ...h.modes, [mode]: (h.modes[mode] || 0) + 1 },
          };
        }
        return h;
      });
      if (!history.find((h) => h.date === today)) {
        history.push({
          date: today,
          words_studied: studied,
          correct,
          wrong,
          sessions: 1,
          modes: { [mode]: 1 },
        });
      }
      setStudyHistory(history);

      // Auto check-in
      if (studied > 0) {
        checkin();
      }

      // Check achievements
      const newAchievements = checkAndUnlockAchievements();
      newAchievements.forEach((a) => addToast(`🎉 成就解锁：${a.title}`, 'success', 4000));

      sfx.success();
      setPhase('result');
    } else {
      setCurrentIndex((i) => i + 1);
      setFlipped(false);
      setQuizOptions([]);
      setSelectedOption(null);
      setSpellingInput('');
      setClozeAnswer('');
      setAnswered(false);
      setAttempt(0);
      setShadowResult(null);
      setShadowListening(false);
    }
  };

  const handleContinue = () => {
    // Reset UI for same word (multiple correct answers needed)
    sfx.click();
    shadowStop();
    setShadowResult(null);
    setShadowListening(false);
    setFlipped(false);
    setSelectedOption(null);
    setSpellingInput('');
    setClozeAnswer('');
    setAnswered(false);
    setAttempt((a) => a + 1);
  };

  const restartSession = () => {
    sfx.navigate();
    shadowStop();
    setPhase('select');
    setSelectedChapterId(null);
  };

  const progress = sessionWords.length > 0 ? (currentIndex / sessionWords.length) * 100 : 0;
  const duration = startTime ? Date.now() - startTime : 0;
  const accuracy = correctCount + wrongCount > 0 ? Math.round((correctCount / (correctCount + wrongCount)) * 100) : 0;
  const completedCount = Object.values(completed).filter(Boolean).length;

  // ===== Select Phase =====
  if (phase === 'select') {
    return (
      <div className="space-y-5 animate-fade-in">
        <button
          onClick={() => {
            sfx.navigate();
            navigate('/');
          }}
          className="flex items-center gap-1 text-sm"
          style={{ color: 'var(--text-tertiary)' }}
        >
          <ChevronLeft size={16} />
          返回
        </button>

        <div>
          <h1 className="text-2xl font-bold font-display" style={{ color: 'var(--text)' }}>
            学习中心
          </h1>
          <p className="text-sm mt-1" style={{ color: 'var(--text-secondary)' }}>
            选择学习模式和章节开始
          </p>
        </div>

        {/* Mode Selection */}
        <div>
          <h3 className="font-bold text-sm mb-3" style={{ color: 'var(--text)' }}>
            学习模式
          </h3>
          <div className="grid grid-cols-2 gap-3">
            {MODES.map((m) => {
              const Icon = m.icon;
              const active = mode === m.id;
              return (
                <Card
                  key={m.id}
                  hover
                  padding="md"
                  onClick={() => {
                    sfx.click();
                    setMode(m.id);
                  }}
                  className="flex flex-col items-start gap-2"
                  style={active ? { borderColor: m.color, borderWidth: 2 } : undefined}
                >
                  <div
                    className="flex items-center justify-center w-10 h-10 rounded-xl"
                    style={{ background: m.bg, color: m.color }}
                  >
                    <Icon size={20} />
                  </div>
                  <div>
                    <p className="font-semibold text-sm" style={{ color: 'var(--text)' }}>
                      {m.label}
                    </p>
                    <p className="text-xs" style={{ color: 'var(--text-tertiary)' }}>
                      {m.desc}
                    </p>
                  </div>
                </Card>
              );
            })}
          </div>
        </div>

        {/* Chapter Selection */}
        <div>
          <h3 className="font-bold text-sm mb-3" style={{ color: 'var(--text)' }}>
            选择章节
          </h3>
          <div className="space-y-2">
            {/* Due words option */}
            <Card
              hover
              padding="md"
              onClick={() => {
                sfx.click();
                setSelectedChapterId(null);
              }}
              className="flex items-center gap-3"
              style={!selectedChapterId ? { borderColor: 'var(--teal-500)', borderWidth: 2 } : undefined}
            >
              <div
                className="flex items-center justify-center w-10 h-10 rounded-xl flex-shrink-0"
                style={{ background: 'rgba(20,184,166,0.12)', color: 'var(--teal-600)' }}
              >
                <Sparkles size={20} />
              </div>
              <div className="flex-1">
                <p className="font-semibold text-sm" style={{ color: 'var(--text)' }}>
                  复习到期单词
                </p>
                <p className="text-xs" style={{ color: 'var(--text-tertiary)' }}>
                  基于 SM-2 算法的智能复习
                </p>
              </div>
            </Card>

            {/* Weekly review option */}
            <Card
              hover
              padding="md"
              onClick={() => {
                sfx.click();
                setSelectedChapterId('weekly');
              }}
              className="flex items-center gap-3"
              style={selectedChapterId === 'weekly' ? { borderColor: '#6366f1', borderWidth: 2 } : undefined}
            >
              <div
                className="flex items-center justify-center w-10 h-10 rounded-xl flex-shrink-0"
                style={{ background: 'rgba(99,102,241,0.12)', color: '#6366f1' }}
              >
                <Calendar size={20} />
              </div>
              <div className="flex-1">
                <p className="font-semibold text-sm" style={{ color: 'var(--text)' }}>
                  周总复习
                </p>
                <p className="text-xs" style={{ color: 'var(--text-tertiary)' }}>
                  交错巩固 + 易混词穿插
                </p>
              </div>
            </Card>

            {/* Mistakes review option */}
            <Card
              hover
              padding="md"
              onClick={() => {
                sfx.click();
                setSelectedChapterId('mistakes');
              }}
              className="flex items-center gap-3"
              style={selectedChapterId === 'mistakes' ? { borderColor: '#ef4444', borderWidth: 2 } : undefined}
            >
              <div
                className="flex items-center justify-center w-10 h-10 rounded-xl flex-shrink-0"
                style={{ background: 'rgba(239,68,68,0.12)', color: '#ef4444' }}
              >
                <AlertCircle size={20} />
              </div>
              <div className="flex-1">
                <p className="font-semibold text-sm" style={{ color: 'var(--text)' }}>
                  错词本复习
                </p>
                <p className="text-xs" style={{ color: 'var(--text-tertiary)' }}>
                  专攻薄弱词汇 · {mistakes.length} 词
                </p>
              </div>
            </Card>

            {chapters.map((ch) => {
              const active = selectedChapterId === ch.id;
              const wordCount = getChapterWordIds(ch).length;
              return (
                <Card
                  key={ch.id}
                  hover
                  padding="md"
                  onClick={() => {
                    sfx.click();
                    setSelectedChapterId(ch.id);
                  }}
                  className="flex items-center gap-3"
                  style={active ? { borderColor: 'var(--teal-500)', borderWidth: 2 } : undefined}
                >
                  <div
                    className="flex items-center justify-center w-10 h-10 rounded-xl text-xl flex-shrink-0"
                    style={{ background: (ch.color || '#0d9488') + '22' }}
                  >
                    {getChapterIcon(ch.icon)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-sm truncate" style={{ color: 'var(--text)' }}>
                      {ch.title}
                    </p>
                    <p className="text-xs" style={{ color: 'var(--text-tertiary)' }}>
                      {wordCount} 词
                    </p>
                  </div>
                </Card>
              );
            })}
          </div>
        </div>

        {/* Start Button */}
        <Button
          fullWidth
          size="lg"
          variant="primary"
          onClick={() => startSession(mode, selectedChapterId)}
        >
          开始学习
        </Button>
      </div>
    );
  }

  // ===== Result Phase =====
  if (phase === 'result') {
    return (
      <div className="space-y-5 animate-fade-in">
        <Card padding="lg" className="text-center">
          <div
            className="flex items-center justify-center w-16 h-16 rounded-full mx-auto mb-4"
            style={{ background: 'rgba(20,184,166,0.15)', color: 'var(--teal-600)' }}
          >
            <Check size={32} />
          </div>
          <h2 className="text-xl font-bold font-display mb-1" style={{ color: 'var(--text)' }}>
            学习完成！
          </h2>
          <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
            坚持就是胜利
          </p>
        </Card>

        <div className="grid grid-cols-2 gap-3">
          <Card padding="md" className="text-center">
            <p className="text-2xl font-bold" style={{ color: 'var(--teal-600)' }}>
              {sessionWords.length}
            </p>
            <p className="text-xs" style={{ color: 'var(--text-tertiary)' }}>
              总词数
            </p>
          </Card>
          <Card padding="md" className="text-center">
            <p className="text-2xl font-bold" style={{ color: '#16a34a' }}>
              {accuracy}%
            </p>
            <p className="text-xs" style={{ color: 'var(--text-tertiary)' }}>
              正确率
            </p>
          </Card>
          <Card padding="md" className="text-center">
            <p className="text-2xl font-bold" style={{ color: '#16a34a' }}>
              {correctCount}
            </p>
            <p className="text-xs" style={{ color: 'var(--text-tertiary)' }}>
              正确
            </p>
          </Card>
          <Card padding="md" className="text-center">
            <p className="text-2xl font-bold" style={{ color: '#dc2626' }}>
              {wrongCount}
            </p>
            <p className="text-xs" style={{ color: 'var(--text-tertiary)' }}>
              错误
            </p>
          </Card>
        </div>

        <Card padding="md" className="text-center">
          <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
            学习时长：<span className="font-bold" style={{ color: 'var(--text)' }}>{formatDuration(duration)}</span>
          </p>
          {familiarCount > 0 && (
            <p className="text-sm mt-1" style={{ color: 'var(--text-secondary)' }}>
              模糊：<span className="font-bold" style={{ color: 'var(--amber-500)' }}>{familiarCount}</span>
            </p>
          )}
          {completedCount < sessionWords.length && (
            <p className="text-sm mt-1" style={{ color: 'var(--text-secondary)' }}>
              已掌握：<span className="font-bold" style={{ color: 'var(--teal-600)' }}>{completedCount}</span> / {sessionWords.length}
            </p>
          )}
        </Card>

        <div className="flex gap-3">
          <Button variant="secondary" fullWidth onClick={() => navigate('/')}>
            <Home size={18} />
            返回首页
          </Button>
          <Button variant="primary" fullWidth onClick={restartSession}>
            <RotateCw size={18} />
            再学一轮
          </Button>
        </div>
      </div>
    );
  }

  // ===== Studying Phase =====
  if (!currentWord) {
    return (
      <Card padding="lg" className="text-center">
        <p className="text-sm" style={{ color: 'var(--text-tertiary)' }}>
          没有可学习的单词
        </p>
        <Button variant="primary" className="mt-3" onClick={restartSession}>
          返回选择
        </Button>
      </Card>
    );
  }

  const emoji = getEmoji(currentWord.en);
  const hint = affixHint(currentWord.en);

  const modeLabel = mode === 'adaptive'
    ? `自适应 · ${MODES.find((m) => m.id === renderMode)?.label || ''}`
    : MODES.find((m) => m.id === mode)?.label || '';

  return (
    <div className="space-y-4 animate-fade-in">
      {/* Progress Bar + Memory Strength */}
      <div className="flex items-center gap-3">
        <button
          onClick={() => {
            sfx.navigate();
            restartSession();
          }}
          className="flex items-center justify-center w-8 h-8 rounded-full flex-shrink-0"
          style={{ background: 'var(--surface-3)', color: 'var(--text-secondary)' }}
        >
          <ChevronLeft size={18} />
        </button>
        <div className="flex-1 space-y-1.5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium" style={{ color: 'var(--text-tertiary)' }}>
              {currentIndex + 1} / {sessionWords.length}
            </span>
            <span className="text-xs" style={{ color: 'var(--text-tertiary)' }}>
              {modeLabel}
            </span>
          </div>
          <div className="w-full rounded-full overflow-hidden" style={{ height: 6, background: 'var(--surface-3)' }}>
            <div
              className="h-full rounded-full transition-all duration-300"
              style={{
                width: `${progress}%`,
                background: 'linear-gradient(90deg, var(--teal-400), var(--teal-600))',
              }}
            />
          </div>
          <MemoryStrengthBar strength={memoryStrength} />
        </div>
      </div>

      {/* Multiple correct progress indicator */}
      {!isSelfGraded && requiredCorrect > 1 && (
        <div className="flex items-center justify-center gap-2">
          {Array.from({ length: requiredCorrect }).map((_, i) => (
            <div
              key={i}
              className="w-2 h-2 rounded-full"
              style={{
                background: i < currentCorrect ? '#16a34a' : 'var(--surface-3)',
              }}
            />
          ))}
          <span className="text-[10px] ml-1" style={{ color: 'var(--text-tertiary)' }}>
            答对 {requiredCorrect} 次完成
          </span>
        </div>
      )}

      {/* ===== Flashcard Mode ===== */}
      {renderMode === 'flashcard' && (
        <>
          <div style={{ perspective: '1200px' }}>
            <div
              onClick={() => {
                if (!answered) {
                  sfx.flip();
                  setFlipped(!flipped);
                }
              }}
              className="relative w-full cursor-pointer"
              style={{
                minHeight: '320px',
                transformStyle: 'preserve-3d',
                transition: 'transform 0.5s ease',
                transform: flipped ? 'rotateY(180deg)' : 'rotateY(0deg)',
              }}
            >
              {/* Front */}
              <div
                className="absolute inset-0 rounded-2xl flex flex-col items-center justify-center p-6"
                style={{
                  background: 'var(--surface)',
                  border: '1px solid var(--border-light)',
                  boxShadow: 'var(--shadow-md)',
                  backfaceVisibility: 'hidden',
                  WebkitBackfaceVisibility: 'hidden',
                }}
              >
                {emoji && <div className="text-5xl mb-4">{emoji}</div>}
                <h2 className="text-3xl font-bold font-display text-center" style={{ color: 'var(--text)', fontSize: 'var(--word-en-size)' }}>
                  {currentWord.en}
                </h2>
                {currentWord.pos && (
                  <span className="pos-badge mt-2 text-xs px-2 py-0.5 rounded" style={{ background: 'var(--surface-3)', color: 'var(--text-tertiary)' }}>
                    {currentWord.pos}
                  </span>
                )}
                <button
                  onClick={(e) => { e.stopPropagation(); ttsHook.speakWord(currentWord.en); }}
                  className="mt-4 flex items-center justify-center w-10 h-10 rounded-full"
                  style={{ background: 'rgba(20,184,166,0.12)', color: 'var(--teal-600)' }}
                >
                  <Volume2 size={20} />
                </button>
                <p className="mt-4 text-xs" style={{ color: 'var(--text-tertiary)' }}>
                  点击卡片查看释义
                </p>
              </div>

              {/* Back */}
              <div
                className="absolute inset-0 rounded-2xl flex flex-col items-center justify-center p-6"
                style={{
                  background: 'var(--surface)',
                  border: '1px solid var(--border-light)',
                  boxShadow: 'var(--shadow-md)',
                  backfaceVisibility: 'hidden',
                  WebkitBackfaceVisibility: 'hidden',
                  transform: 'rotateY(180deg)',
                }}
              >
                <h2 className="text-2xl font-bold font-display mb-2" style={{ color: 'var(--text)', fontSize: 'var(--word-en-size)' }}>
                  {currentWord.en}
                </h2>
                <p className="text-lg text-center mb-3" style={{ color: 'var(--text-secondary)', fontSize: 'var(--word-zh-size)' }}>
                  {currentWord.zh}
                </p>
                {hint && (
                  <p className="text-xs px-3 py-1.5 rounded-lg mb-2" style={{ background: 'var(--surface-2)', color: 'var(--text-tertiary)' }}>
                    {hint}
                  </p>
                )}
                <button
                  onClick={(e) => { e.stopPropagation(); ttsHook.speakWord(currentWord.en); }}
                  className="flex items-center justify-center w-10 h-10 rounded-full"
                  style={{ background: 'rgba(20,184,166,0.12)', color: 'var(--teal-600)' }}
                >
                  <Volume2 size={20} />
                </button>
                <p className="mt-3 text-xs" style={{ color: 'var(--text-tertiary)' }}>
                  你认识这个词吗？
                </p>
              </div>
            </div>
          </div>

          {/* Answer buttons (visible after flip) */}
          {flipped && (
            <div className="grid grid-cols-3 gap-2 animate-slide-up">
              <Button variant="danger" size="md" onClick={() => handleAnswer(false)} disabled={answered}>
                <X size={16} />
                不认识
              </Button>
              <Button variant="secondary" size="md" onClick={() => handleAnswer('familiar')} disabled={answered}>
                模糊
              </Button>
              <Button variant="success" size="md" onClick={() => handleAnswer(true)} disabled={answered}>
                <Check size={16} />
                认识
              </Button>
            </div>
          )}

          {/* Shadow speech integration */}
          {flipped && shadowSupported() && (
            <div className="flex items-center gap-3">
              <Button
                variant="secondary"
                size="sm"
                onClick={handleShadow}
                disabled={shadowListening || answered}
              >
                <Mic size={14} />
                {shadowListening ? '正在聆听...' : '跟读'}
              </Button>
              {shadowResult && (
                <div className="flex-1 text-xs">
                  {shadowResult.error ? (
                    <span style={{ color: '#dc2626' }}>{shadowResult.error}</span>
                  ) : (
                    <span style={{ color: shadowResult.score && shadowResult.score >= 80 ? '#16a34a' : 'var(--amber-500)' }}>
                      相似度 {shadowResult.score}% · {shadowResult.heard}
                    </span>
                  )}
                </div>
              )}
            </div>
          )}

          {answered && (
            wordCompleted ? (
              <Button fullWidth size="lg" variant="primary" onClick={handleNext}>
                {currentIndex + 1 >= sessionWords.length ? '完成学习' : '下一个'}
              </Button>
            ) : (
              <Button fullWidth size="lg" variant="primary" onClick={handleContinue}>
                继续练习 ({currentCorrect}/{requiredCorrect})
              </Button>
            )
          )}
        </>
      )}

      {/* ===== Quiz Mode (mixed zh→en and en→zh) ===== */}
      {renderMode === 'quiz' && (
        <>
          <Card padding="lg" className="text-center">
            {emoji && <div className="text-4xl mb-3">{emoji}</div>}
            <p className="text-xs mb-2" style={{ color: 'var(--text-tertiary)' }}>
              {quizDirection === 'zh-to-en' ? '选择正确的英文单词' : '选择正确的中文释义'}
            </p>
            <h2 className="text-xl font-bold" style={{ color: 'var(--text)' }}>
              {quizDirection === 'zh-to-en' ? currentWord.zh : currentWord.en}
            </h2>
            {quizDirection === 'en-to-zh' && (
              <button
                onClick={(e) => { e.stopPropagation(); ttsHook.speakWord(currentWord.en); }}
                className="mt-3 flex items-center justify-center w-10 h-10 rounded-full mx-auto"
                style={{ background: 'rgba(20,184,166,0.12)', color: 'var(--teal-600)' }}
              >
                <Volume2 size={20} />
              </button>
            )}
            {currentWord.pos && (
              <span className="pos-badge mt-2 inline-block text-xs px-2 py-0.5 rounded" style={{ background: 'var(--surface-3)', color: 'var(--text-tertiary)' }}>
                {currentWord.pos}
              </span>
            )}
          </Card>

          <div className="space-y-2">
            {quizOptions.map((opt, idx) => {
              const isSelected = selectedOption === idx;
              const showCorrect = answered && opt.correct;
              const showWrong = answered && isSelected && !opt.correct;
              return (
                <button
                  key={idx}
                  onClick={() => handleQuizAnswer(idx)}
                  disabled={answered}
                  className="w-full flex items-center gap-3 p-4 rounded-xl text-left cursor-pointer transition-all"
                  style={{
                    background: showCorrect ? 'rgba(22,163,74,0.1)' : showWrong ? 'rgba(220,38,38,0.1)' : 'var(--surface)',
                    border: `2px solid ${showCorrect ? '#16a34a' : showWrong ? '#dc2626' : 'var(--border)'}`,
                    opacity: answered && !isSelected && !opt.correct ? 0.5 : 1,
                  }}
                >
                  <span
                    className="flex items-center justify-center w-8 h-8 rounded-full text-sm font-bold flex-shrink-0"
                    style={{
                      background: showCorrect ? '#16a34a' : showWrong ? '#dc2626' : 'var(--surface-3)',
                      color: showCorrect || showWrong ? '#fff' : 'var(--text-secondary)',
                    }}
                  >
                    {showCorrect ? <Check size={16} /> : showWrong ? <X size={16} /> : String.fromCharCode(65 + idx)}
                  </span>
                  <span className="font-medium text-sm" style={{ color: 'var(--text)' }}>
                    {quizDirection === 'zh-to-en' ? opt.en : opt.zh}
                  </span>
                </button>
              );
            })}
          </div>

          {answered && (
            wordCompleted ? (
              <Button fullWidth size="lg" variant="primary" onClick={handleNext}>
                {currentIndex + 1 >= sessionWords.length ? '完成学习' : '下一个'}
              </Button>
            ) : (
              <Button fullWidth size="lg" variant="primary" onClick={handleContinue}>
                继续练习 ({currentCorrect}/{requiredCorrect})
              </Button>
            )
          )}
        </>
      )}

      {/* ===== Spelling Mode ===== */}
      {renderMode === 'spelling' && (
        <>
          <Card padding="lg" className="text-center">
            {emoji && <div className="text-4xl mb-3">{emoji}</div>}
            <p className="text-xs mb-2" style={{ color: 'var(--text-tertiary)' }}>
              拼写出正确的英文单词
            </p>
            <h2 className="text-xl font-bold mb-2" style={{ color: 'var(--text)' }}>
              {currentWord.zh}
            </h2>
            {currentWord.pos && (
              <span className="pos-badge inline-block text-xs px-2 py-0.5 rounded" style={{ background: 'var(--surface-3)', color: 'var(--text-tertiary)' }}>
                {currentWord.pos}
              </span>
            )}
            <div className="mt-3 text-xs" style={{ color: 'var(--text-tertiary)' }}>
              {currentWord.en.length} 个字母
            </div>
          </Card>

          <div className="flex gap-2">
            <input
              type="text"
              value={spellingInput}
              onChange={(e) => setSpellingInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter' && !answered) handleSpellingSubmit(); }}
              disabled={answered}
              placeholder="输入英文单词..."
              autoFocus
              className="flex-1 px-4 py-3 rounded-xl text-base outline-none"
              style={{
                background: 'var(--surface)',
                border: `2px solid ${answered ? (spellingInput.trim().toLowerCase() === currentWord.en.toLowerCase() ? '#16a34a' : '#dc2626') : 'var(--border)'}`,
                color: 'var(--text)',
              }}
            />
            {!answered && (
              <Button variant="primary" size="lg" onClick={handleSpellingSubmit}>
                确定
              </Button>
            )}
          </div>

          {answered && (
            <div className="space-y-3">
              {spellingInput.trim().toLowerCase() !== currentWord.en.toLowerCase() && (
                <Card padding="md" className="flex items-center gap-3" style={{ borderColor: '#dc2626', borderWidth: 2 }}>
                  <X size={20} style={{ color: '#dc2626' }} />
                  <div>
                    <p className="text-xs" style={{ color: 'var(--text-tertiary)' }}>正确答案</p>
                    <p className="font-bold text-base" style={{ color: 'var(--text)' }}>{currentWord.en}</p>
                  </div>
                  <button
                    onClick={() => ttsHook.speakWord(currentWord.en)}
                    className="ml-auto flex items-center justify-center w-9 h-9 rounded-full"
                    style={{ background: 'rgba(20,184,166,0.12)', color: 'var(--teal-600)' }}
                  >
                    <Volume2 size={18} />
                  </button>
                </Card>
              )}
              {wordCompleted ? (
                <Button fullWidth size="lg" variant="primary" onClick={handleNext}>
                  {currentIndex + 1 >= sessionWords.length ? '完成学习' : '下一个'}
                </Button>
              ) : (
                <Button fullWidth size="lg" variant="primary" onClick={handleContinue}>
                  继续练习 ({currentCorrect}/{requiredCorrect})
                </Button>
              )}
            </div>
          )}
        </>
      )}

      {/* ===== Listening Mode ===== */}
      {renderMode === 'listening' && (
        <>
          <Card padding="lg" className="text-center">
            <div
              className="flex items-center justify-center w-20 h-20 rounded-full mx-auto mb-4 cursor-pointer"
              style={{ background: 'rgba(236,72,153,0.12)', color: '#ec4899' }}
              onClick={() => ttsHook.speakWord(currentWord.en)}
            >
              <Volume2 size={36} />
            </div>
            <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
              点击图标重新播放，选择正确的词义
            </p>
          </Card>

          <div className="space-y-2">
            {quizOptions.map((opt, idx) => {
              const isSelected = selectedOption === idx;
              const showCorrect = answered && opt.correct;
              const showWrong = answered && isSelected && !opt.correct;
              return (
                <button
                  key={idx}
                  onClick={() => handleQuizAnswer(idx)}
                  disabled={answered}
                  className="w-full flex items-center gap-3 p-4 rounded-xl text-left cursor-pointer transition-all"
                  style={{
                    background: showCorrect ? 'rgba(22,163,74,0.1)' : showWrong ? 'rgba(220,38,38,0.1)' : 'var(--surface)',
                    border: `2px solid ${showCorrect ? '#16a34a' : showWrong ? '#dc2626' : 'var(--border)'}`,
                    opacity: answered && !isSelected && !opt.correct ? 0.5 : 1,
                  }}
                >
                  <span
                    className="flex items-center justify-center w-8 h-8 rounded-full text-sm font-bold flex-shrink-0"
                    style={{
                      background: showCorrect ? '#16a34a' : showWrong ? '#dc2626' : 'var(--surface-3)',
                      color: showCorrect || showWrong ? '#fff' : 'var(--text-secondary)',
                    }}
                  >
                    {showCorrect ? <Check size={16} /> : showWrong ? <X size={16} /> : String.fromCharCode(65 + idx)}
                  </span>
                  <span className="font-medium text-sm" style={{ color: 'var(--text)' }}>
                    {opt.zh}
                  </span>
                </button>
              );
            })}
          </div>

          {answered && (
            <Card padding="md" className="flex items-center gap-3">
              <div className="flex items-center justify-center w-12 h-12 rounded-xl text-2xl flex-shrink-0" style={{ background: 'var(--surface-2)' }}>
                {emoji || currentWord.en.charAt(0).toUpperCase()}
              </div>
              <div className="flex-1">
                <p className="font-bold text-base" style={{ color: 'var(--text)' }}>{currentWord.en}</p>
                <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>{currentWord.zh}</p>
              </div>
              <button
                onClick={() => ttsHook.speakWord(currentWord.en)}
                className="flex items-center justify-center w-9 h-9 rounded-full"
                style={{ background: 'rgba(20,184,166,0.12)', color: 'var(--teal-600)' }}
              >
                <Volume2 size={18} />
              </button>
            </Card>
          )}

          {answered && (
            wordCompleted ? (
              <Button fullWidth size="lg" variant="primary" onClick={handleNext}>
                {currentIndex + 1 >= sessionWords.length ? '完成学习' : '下一个'}
              </Button>
            ) : (
              <Button fullWidth size="lg" variant="primary" onClick={handleContinue}>
                继续练习 ({currentCorrect}/{requiredCorrect})
              </Button>
            )
          )}
        </>
      )}

      {/* ===== Image Mode (图文模式) ===== */}
      {renderMode === 'image' && (
        <>
          <Card padding="lg" className="text-center">
            <div
              className="flex items-center justify-center w-24 h-24 rounded-3xl mx-auto mb-4 text-6xl"
              style={{ background: 'rgba(6,182,212,0.1)' }}
            >
              {emoji || currentWord.en.charAt(0).toUpperCase()}
            </div>
            <h2 className="text-3xl font-bold font-display mb-2" style={{ color: 'var(--text)' }}>
              {currentWord.en}
            </h2>
            <p className="text-lg mb-3" style={{ color: 'var(--text-secondary)' }}>
              {currentWord.zh}
            </p>
            {currentWord.pos && (
              <span className="pos-badge inline-block text-xs px-2 py-0.5 rounded" style={{ background: 'var(--surface-3)', color: 'var(--text-tertiary)' }}>
                {currentWord.pos}
              </span>
            )}
            {hint && (
              <p className="text-xs px-3 py-1.5 rounded-lg mt-3 inline-block" style={{ background: 'var(--surface-2)', color: 'var(--text-tertiary)' }}>
                {hint}
              </p>
            )}
            <button
              onClick={() => ttsHook.speakWord(currentWord.en)}
              className="mt-4 flex items-center justify-center w-10 h-10 rounded-full mx-auto"
              style={{ background: 'rgba(6,182,212,0.12)', color: '#06b6d4' }}
            >
              <Volume2 size={20} />
            </button>
          </Card>

          {/* Example sentences for image mode */}
          {examples.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs font-bold" style={{ color: 'var(--text-tertiary)' }}>例句</p>
              {examples.slice(0, 2).map((ex, i) => (
                <div key={i} className="p-3 rounded-xl" style={{ background: 'var(--surface-2)' }}>
                  <div className="flex items-center gap-2 mb-1">
                    <span
                      className="text-[10px] px-1.5 py-0.5 rounded font-medium"
                      style={{
                        background: ex.tier === 1 ? 'rgba(20,184,166,0.15)' : 'rgba(139,92,246,0.15)',
                        color: ex.tier === 1 ? 'var(--teal-600)' : 'var(--violet-500)',
                      }}
                    >
                      {ex.label}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 mb-1">
                    <p className="text-sm font-medium flex-1" style={{ color: 'var(--text)' }}>{ex.en}</p>
                    <button
                      onClick={() => ttsHook.speakSentence(ex.en)}
                      className="flex items-center justify-center w-7 h-7 rounded-full flex-shrink-0"
                      style={{ background: 'rgba(20,184,166,0.1)', color: 'var(--teal-600)' }}
                    >
                      <Volume2 size={14} />
                    </button>
                  </div>
                  <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>{ex.zh}</p>
                </div>
              ))}
            </div>
          )}

          {/* Shadow speech for image mode */}
          {shadowSupported() && (
            <div className="flex items-center gap-3">
              <Button
                variant="secondary"
                size="sm"
                onClick={handleShadow}
                disabled={shadowListening || answered}
              >
                <Mic size={14} />
                {shadowListening ? '正在聆听...' : '跟读'}
              </Button>
              {shadowResult && (
                <div className="flex-1 text-xs">
                  {shadowResult.error ? (
                    <span style={{ color: '#dc2626' }}>{shadowResult.error}</span>
                  ) : (
                    <span style={{ color: shadowResult.score && shadowResult.score >= 80 ? '#16a34a' : 'var(--amber-500)' }}>
                      相似度 {shadowResult.score}% · {shadowResult.heard}
                    </span>
                  )}
                </div>
              )}
            </div>
          )}

          <div className="grid grid-cols-2 gap-2">
            <Button variant="danger" size="md" onClick={() => handleAnswer(false)} disabled={answered}>
              <X size={16} />
              不认识
            </Button>
            <Button variant="success" size="md" onClick={() => handleAnswer(true)} disabled={answered}>
              <Check size={16} />
              认识
            </Button>
          </div>

          {answered && (
            <Button fullWidth size="lg" variant="primary" onClick={handleNext}>
              {currentIndex + 1 >= sessionWords.length ? '完成学习' : '下一个'}
            </Button>
          )}
        </>
      )}

      {/* ===== Recall Mode (主动回忆) ===== */}
      {renderMode === 'recall' && (
        <>
          {!flipped ? (
            <>
              <Card padding="lg" className="text-center">
                <div
                  className="flex items-center justify-center w-14 h-14 rounded-2xl mx-auto mb-4"
                  style={{ background: 'rgba(139,92,246,0.12)', color: '#8b5cf6' }}
                >
                  <Brain size={28} />
                </div>
                <p className="text-xs mb-2" style={{ color: 'var(--text-tertiary)' }}>
                  想想这个中文对应的英文是什么
                </p>
                <h2 className="text-2xl font-bold mb-2" style={{ color: 'var(--text)' }}>
                  {currentWord.zh}
                </h2>
                {currentWord.pos && (
                  <span className="pos-badge inline-block text-xs px-2 py-0.5 rounded" style={{ background: 'var(--surface-3)', color: 'var(--text-tertiary)' }}>
                    {currentWord.pos}
                  </span>
                )}
                <p className="mt-4 text-xs" style={{ color: 'var(--text-tertiary)' }}>
                  想好了就点击下方按钮查看答案
                </p>
              </Card>
              <Button
                fullWidth
                size="lg"
                variant="primary"
                onClick={() => {
                  sfx.flip();
                  setFlipped(true);
                }}
              >
                显示答案
              </Button>
            </>
          ) : (
            <>
              <Card padding="lg" className="text-center">
                {emoji && <div className="text-4xl mb-3">{emoji}</div>}
                <h2 className="text-3xl font-bold font-display mb-2" style={{ color: 'var(--text)' }}>
                  {currentWord.en}
                </h2>
                <p className="text-lg mb-3" style={{ color: 'var(--text-secondary)' }}>
                  {currentWord.zh}
                </p>
                {hint && (
                  <p className="text-xs px-3 py-1.5 rounded-lg inline-block" style={{ background: 'var(--surface-2)', color: 'var(--text-tertiary)' }}>
                    {hint}
                  </p>
                )}
                <button
                  onClick={() => ttsHook.speakWord(currentWord.en)}
                  className="mt-3 flex items-center justify-center w-10 h-10 rounded-full mx-auto"
                  style={{ background: 'rgba(20,184,166,0.12)', color: 'var(--teal-600)' }}
                >
                  <Volume2 size={20} />
                </button>
              </Card>

              {examples.length > 0 && (
                <div className="p-3 rounded-xl" style={{ background: 'var(--surface-2)' }}>
                  <div className="flex items-center gap-2 mb-1">
                    <p className="text-sm font-medium flex-1" style={{ color: 'var(--text)' }}>
                      {examples[0].en}
                    </p>
                    <button
                      onClick={() => ttsHook.speakSentence(examples[0].en)}
                      className="flex items-center justify-center w-7 h-7 rounded-full flex-shrink-0"
                      style={{ background: 'rgba(20,184,166,0.1)', color: 'var(--teal-600)' }}
                    >
                      <Volume2 size={14} />
                    </button>
                  </div>
                  <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>
                    {examples[0].zh}
                  </p>
                </div>
              )}

              {/* Shadow speech for recall mode */}
              {shadowSupported() && (
                <div className="flex items-center gap-3">
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={handleShadow}
                    disabled={shadowListening || answered}
                  >
                    <Mic size={14} />
                    {shadowListening ? '正在聆听...' : '跟读'}
                  </Button>
                  {shadowResult && (
                    <div className="flex-1 text-xs">
                      {shadowResult.error ? (
                        <span style={{ color: '#dc2626' }}>{shadowResult.error}</span>
                      ) : (
                        <span style={{ color: shadowResult.score && shadowResult.score >= 80 ? '#16a34a' : 'var(--amber-500)' }}>
                          相似度 {shadowResult.score}% · {shadowResult.heard}
                        </span>
                      )}
                    </div>
                  )}
                </div>
              )}

              <div className="grid grid-cols-3 gap-2">
                <Button variant="danger" size="md" onClick={() => handleAnswer(false)} disabled={answered}>
                  <X size={16} />
                  不认识
                </Button>
                <Button variant="secondary" size="md" onClick={() => handleAnswer('familiar')} disabled={answered}>
                  模糊
                </Button>
                <Button variant="success" size="md" onClick={() => handleAnswer(true)} disabled={answered}>
                  <Check size={16} />
                  认识
                </Button>
              </div>

              {answered && (
                <Button fullWidth size="lg" variant="primary" onClick={handleNext}>
                  {currentIndex + 1 >= sessionWords.length ? '完成学习' : '下一个'}
                </Button>
              )}
            </>
          )}
        </>
      )}

      {/* ===== Cloze Mode (例句挖空) ===== */}
      {renderMode === 'cloze' && clozeData && (
        <>
          <Card padding="lg">
            <p className="text-xs mb-3" style={{ color: 'var(--text-tertiary)' }}>
              填入缺失的单词
            </p>
            <p className="text-base font-medium leading-relaxed mb-3" style={{ color: 'var(--text)' }}>
              {clozeData.blanked}
            </p>
            <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
              {clozeData.translation}
            </p>
          </Card>

          <div className="flex gap-2">
            <input
              type="text"
              value={clozeAnswer}
              onChange={(e) => setClozeAnswer(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter' && !answered) handleClozeSubmit(); }}
              disabled={answered}
              placeholder="填入单词..."
              autoFocus
              className="flex-1 px-4 py-3 rounded-xl text-base outline-none"
              style={{
                background: 'var(--surface)',
                border: `2px solid ${answered ? (clozeAnswer.trim().toLowerCase() === clozeData.answer.toLowerCase() ? '#16a34a' : '#dc2626') : 'var(--border)'}`,
                color: 'var(--text)',
              }}
            />
            {!answered && (
              <Button variant="primary" size="lg" onClick={handleClozeSubmit}>
                确定
              </Button>
            )}
          </div>

          {answered && (
            <div className="space-y-3">
              {clozeAnswer.trim().toLowerCase() !== clozeData.answer.toLowerCase() && (
                <Card padding="md" className="flex items-center gap-3" style={{ borderColor: '#dc2626', borderWidth: 2 }}>
                  <X size={20} style={{ color: '#dc2626' }} />
                  <div>
                    <p className="text-xs" style={{ color: 'var(--text-tertiary)' }}>正确答案</p>
                    <p className="font-bold text-base" style={{ color: 'var(--text)' }}>{clozeData.answer}</p>
                  </div>
                  <button
                    onClick={() => ttsHook.speakWord(currentWord.en)}
                    className="ml-auto flex items-center justify-center w-9 h-9 rounded-full"
                    style={{ background: 'rgba(20,184,166,0.12)', color: 'var(--teal-600)' }}
                  >
                    <Volume2 size={18} />
                  </button>
                </Card>
              )}
              {wordCompleted ? (
                <Button fullWidth size="lg" variant="primary" onClick={handleNext}>
                  {currentIndex + 1 >= sessionWords.length ? '完成学习' : '下一个'}
                </Button>
              ) : (
                <Button fullWidth size="lg" variant="primary" onClick={handleContinue}>
                  继续练习 ({currentCorrect}/{requiredCorrect})
                </Button>
              )}
            </div>
          )}
        </>
      )}

      {/* ===== Zhan Mode (斩模式) ===== */}
      {renderMode === 'zhan' && (
        <>
          <Card
            padding="lg"
            className="text-center cursor-pointer"
            onClick={() => { if (!flipped && !answered) { sfx.flip(); setFlipped(true); } }}
          >
            {emoji && <div className="text-5xl mb-4">{emoji}</div>}
            <h2 className="text-3xl font-bold font-display mb-2" style={{ color: 'var(--text)' }}>
              {currentWord.en}
            </h2>
            {currentWord.pos && (
              <span className="pos-badge inline-block text-xs px-2 py-0.5 rounded mb-3" style={{ background: 'var(--surface-3)', color: 'var(--text-tertiary)' }}>
                {currentWord.pos}
              </span>
            )}

            {flipped ? (
              <div className="mt-3 animate-fade-in">
                <p className="text-xl mb-2" style={{ color: 'var(--text-secondary)' }}>
                  {currentWord.zh}
                </p>
                {hint && (
                  <p className="text-xs px-3 py-1.5 rounded-lg inline-block" style={{ background: 'var(--surface-2)', color: 'var(--text-tertiary)' }}>
                    {hint}
                  </p>
                )}
                <button
                  onClick={(e) => { e.stopPropagation(); ttsHook.speakWord(currentWord.en); }}
                  className="mt-3 flex items-center justify-center w-10 h-10 rounded-full mx-auto"
                  style={{ background: 'rgba(249,115,22,0.12)', color: '#f97316' }}
                >
                  <Volume2 size={20} />
                </button>
              </div>
            ) : (
              <p className="mt-4 text-xs" style={{ color: 'var(--text-tertiary)' }}>
                点击卡片查看释义
              </p>
            )}
          </Card>

          {/* Zhan counter */}
          <div className="flex items-center justify-center gap-2 text-xs" style={{ color: 'var(--text-tertiary)' }}>
            <Zap size={14} style={{ color: '#f97316' }} />
            已斩 {completedCount} 词
          </div>

          {flipped && !answered && (
            <div className="grid grid-cols-2 gap-3 animate-slide-up">
              <Button variant="danger" size="lg" onClick={() => handleAnswer(false)}>
                <X size={18} />
                不斩
              </Button>
              <Button variant="success" size="lg" onClick={() => handleAnswer(true)}>
                <Check size={18} />
                斩
              </Button>
            </div>
          )}

          {answered && (
            <Button fullWidth size="lg" variant="primary" onClick={handleNext}>
              {currentIndex + 1 >= sessionWords.length ? '完成学习' : '下一个'}
            </Button>
          )}
        </>
      )}

      {/* ===== Confuse Mode (易混词辨析) ===== */}
      {renderMode === 'confuse' && confuseQuestion && (
        <>
          <Card padding="lg" className="text-center">
            <div
              className="flex items-center justify-center w-12 h-12 rounded-xl mx-auto mb-3"
              style={{ background: 'rgba(239,68,68,0.12)', color: '#ef4444' }}
            >
              <Shuffle size={24} />
            </div>
            <p className="text-xs mb-2" style={{ color: 'var(--text-tertiary)' }}>
              辨析形近词，选择正确答案
            </p>
            <h2 className="text-xl font-bold" style={{ color: 'var(--text)' }}>
              {confuseQuestion.zh}
            </h2>
            {confuseQuestion.pos && (
              <span className="mt-2 inline-block text-xs px-2 py-0.5 rounded" style={{ background: 'var(--surface-3)', color: 'var(--text-tertiary)' }}>
                {confuseQuestion.pos}
              </span>
            )}
            {confuseQuestion.topSim > 0 && (
              <p className="mt-2 text-[10px]" style={{ color: 'var(--text-tertiary)' }}>
                最高相似度 {confuseQuestion.topSim}%
              </p>
            )}
          </Card>

          <div className="space-y-2">
            {confuseQuestion.options.map((opt, idx) => {
              const isSelected = selectedOption === idx;
              const showCorrect = answered && opt.correct;
              const showWrong = answered && isSelected && !opt.correct;
              return (
                <button
                  key={idx}
                  onClick={() => handleConfuseAnswer(idx)}
                  disabled={answered}
                  className="w-full flex items-center gap-3 p-4 rounded-xl text-left cursor-pointer transition-all"
                  style={{
                    background: showCorrect ? 'rgba(22,163,74,0.1)' : showWrong ? 'rgba(220,38,38,0.1)' : 'var(--surface)',
                    border: `2px solid ${showCorrect ? '#16a34a' : showWrong ? '#dc2626' : 'var(--border)'}`,
                    opacity: answered && !isSelected && !opt.correct ? 0.5 : 1,
                  }}
                >
                  <span
                    className="flex items-center justify-center w-8 h-8 rounded-full text-sm font-bold flex-shrink-0"
                    style={{
                      background: showCorrect ? '#16a34a' : showWrong ? '#dc2626' : 'var(--surface-3)',
                      color: showCorrect || showWrong ? '#fff' : 'var(--text-secondary)',
                    }}
                  >
                    {showCorrect ? <Check size={16} /> : showWrong ? <X size={16} /> : String.fromCharCode(65 + idx)}
                  </span>
                  <div className="flex-1">
                    <span className="font-medium text-sm" style={{ color: 'var(--text)' }}>
                      {opt.en}
                    </span>
                    {!opt.correct && answered && (
                      <span className="ml-2 text-[10px]" style={{ color: 'var(--text-tertiary)' }}>
                        {opt.zh} · 相似 {Math.round(opt.sim * 100)}%
                      </span>
                    )}
                  </div>
                </button>
              );
            })}
          </div>

          {answered && (
            wordCompleted ? (
              <Button fullWidth size="lg" variant="primary" onClick={handleNext}>
                {currentIndex + 1 >= sessionWords.length ? '完成学习' : '下一个'}
              </Button>
            ) : (
              <Button fullWidth size="lg" variant="primary" onClick={handleContinue}>
                继续练习 ({currentCorrect}/{requiredCorrect})
              </Button>
            )
          )}
        </>
      )}

      {/* Example sentences (flashcard mode, after flip) */}
      {renderMode === 'flashcard' && flipped && examples.length > 0 && !answered && (
        <div className="space-y-2">
          <p className="text-xs font-bold" style={{ color: 'var(--text-tertiary)' }}>
            例句
          </p>
          {examples.slice(0, 2).map((ex, i) => (
            <div key={i} className="p-3 rounded-xl" style={{ background: 'var(--surface-2)' }}>
              <div className="flex items-center gap-2 mb-1">
                <span
                  className="text-[10px] px-1.5 py-0.5 rounded font-medium"
                  style={{
                    background: ex.tier === 1 ? 'rgba(20,184,166,0.15)' : 'rgba(139,92,246,0.15)',
                    color: ex.tier === 1 ? 'var(--teal-600)' : 'var(--violet-500)',
                  }}
                >
                  {ex.label}
                </span>
              </div>
              <div className="flex items-center gap-2 mb-1">
                <p className="text-sm font-medium flex-1" style={{ color: 'var(--text)' }}>
                  {ex.en}
                </p>
                <button
                  onClick={() => ttsHook.speakSentence(ex.en)}
                  className="flex items-center justify-center w-7 h-7 rounded-full flex-shrink-0"
                  style={{ background: 'rgba(20,184,166,0.1)', color: 'var(--teal-600)' }}
                >
                  <Volume2 size={14} />
                </button>
              </div>
              <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>
                {ex.zh}
              </p>
            </div>
          ))}
        </div>
      )}

      {/* Keyboard shortcuts hint */}
      <div className="text-center text-[10px]" style={{ color: 'var(--text-tertiary)' }}>
        快捷键：空格=翻转/下一个 · 1-4=选项 · J=不认识 · K=认识 · R=朗读 · S=跟读
      </div>
    </div>
  );
}
