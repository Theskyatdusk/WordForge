/**
 * Study — 学习中心（Taro / 微信小程序版）。
 * 10 种学习模式：卡片记忆 / 选择题 / 拼写 / 听力 / 图文 / 主动回忆 / 例句挖空 / 斩 / 易混词 / 自适应。
 * 含 SM-2 复习算法、TTS 发音、记忆强度条、交错复习、错词本、周总复习。
 *
 * 与原 web 版差异：
 *  - react-router (useNavigate/useParams/useSearchParams) → 小程序内页选择，去掉路由自动开始；
 *    返回首页用 Taro.switchTab 到 dashboard tab。
 *  - useTTS hook（浏览器 speechSynthesis）→ utils/tts.ts 的 tts（后端 /tts + InnerAudioContext）；去掉 preload。
 *  - 键盘快捷键（window keydown）在移动端无意义，已移除；所有操作均有按钮。
 *  - 跟读／语音评测（Web Speech API）小程序无对应能力，utils/shadow.ts 占位且 shadowSupported()=false，UI 自动隐藏。
 *  - 卡片 3D 翻转（rotateY/backface-visibility）小程序不支持，改为点击切换正反面内容（淡入）。
 *  - <input> → Taro <Input>，Enter 提交用 onConfirm。
 */
import { useState, useMemo, useEffect, useCallback } from 'react';
import { View, Text, Input } from '@tarojs/components';
import Taro from '@tarojs/taro';
import { PageShell } from '../../components/ui/PageShell';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Icon } from '../../components/Icon';
import { useVocab, getAllItems, getChapterWordIds, findItemByWordId } from '../../hooks/useVocab';
import { useProgressStore } from '../../store/useProgressStore';
import { useSettingsStore } from '../../store/useSettingsStore';
import { useUIStore } from '../../store/useUIStore';
import { tts } from '../../utils/tts';
import { sfx } from '../../utils/sfx';
import { isDue, getStrength, weakness } from '../../utils/srs';
import { getEmoji, affixHint, getChapterIcon } from '../../utils/visuals';
import { getExamples } from '../../utils/examples';
import { getQuestion } from '../../utils/confuse';
import { shadowStart, shadowStop, shadowSupported } from '../../utils/shadow';
import { formatDuration } from '../../utils/format';
import type { SrsGrade, ExampleSentence, ConfuseQuestion, ShadowResult } from '../../types/index';
import './index.scss';

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
  icon: string;
  color: string;
  bg: string;
}> = [
  { id: 'flashcard', label: '卡片记忆', desc: '翻转卡片学习', icon: 'layers', color: '#0d9488', bg: 'rgba(20,184,166,0.12)' },
  { id: 'quiz', label: '选择题', desc: '中英双向选择', icon: 'check', color: '#8b5cf6', bg: 'rgba(139,92,246,0.12)' },
  { id: 'spelling', label: '拼写练习', desc: '看中文拼英文', icon: 'type', color: '#f59e0b', bg: 'rgba(245,158,11,0.12)' },
  { id: 'listening', label: '听力训练', desc: '听音选词义', icon: 'headphones', color: '#ec4899', bg: 'rgba(236,72,153,0.12)' },
  { id: 'image', label: '图文模式', desc: '视觉联想记忆', icon: 'image', color: '#06b6d4', bg: 'rgba(6,182,212,0.12)' },
  { id: 'recall', label: '主动回忆', desc: '先回忆再对照', icon: 'brain', color: '#8b5cf6', bg: 'rgba(139,92,246,0.12)' },
  { id: 'cloze', label: '例句挖空', desc: '语境填空练习', icon: 'align-left', color: '#10b981', bg: 'rgba(16,185,129,0.12)' },
  { id: 'zhan', label: '斩模式', desc: '快速过词', icon: 'zap', color: '#f97316', bg: 'rgba(249,115,22,0.12)' },
  { id: 'confuse', label: '易混词辨析', desc: '形近词区分', icon: 'shuffle', color: '#ef4444', bg: 'rgba(239,68,68,0.12)' },
  { id: 'adaptive', label: '自适应模式', desc: '智能调节难度', icon: 'cpu', color: '#6366f1', bg: 'rgba(99,102,241,0.12)' },
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
    <View style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
      <Text style={{ fontSize: 20, fontWeight: 500, flexShrink: 0, color: 'var(--text-tertiary)' }}>
        记忆强度
      </Text>
      <View style={{ flex: 1, borderRadius: 999, overflow: 'hidden', height: 8, background: 'var(--surface-3)' }}>
        <View style={{ height: '100%', borderRadius: 999, transition: 'width 0.5s', width: `${strength}%`, background: color }} />
      </View>
      <Text style={{ fontSize: 20, fontWeight: 700, flexShrink: 0, color }}>{strength}% · {label}</Text>
    </View>
  );
}

export default function StudyPage() {
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

  const goHome = useCallback(() => {
    sfx.navigate();
    Taro.switchTab({ url: '/pages/dashboard/index' });
  }, []);

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
  useEffect(() => {
    if (phase !== 'studying' || !currentWord) return;
    if (!settings.ttsAutoPlay) return;

    let shouldPlay = false;
    switch (renderMode) {
      case 'listening':
      case 'image':
      case 'confuse':
      case 'spelling':
        shouldPlay = true;
        break;
      case 'flashcard':
      case 'zhan':
        shouldPlay = !flipped;
        break;
      case 'recall':
        shouldPlay = flipped;
        break;
      case 'quiz':
        shouldPlay = quizDirection === 'en-to-zh' || answered;
        break;
      case 'cloze':
        shouldPlay = answered;
        break;
    }

    if (shouldPlay) {
      const timer = setTimeout(() => tts.speakWord(currentWord.en), 300);
      return () => clearTimeout(timer);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentIndex, attempt, phase, renderMode, currentWord, settings.ttsAutoPlay, flipped, quizDirection, answered]);

  // Cleanup shadow on unmount
  useEffect(() => {
    return () => shadowStop();
  }, []);

  // Determine if current mode is self-graded (no multiple correct needed)
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentIndex, attempt, phase, renderMode, currentWord, flipped, answered, settings.cardAutoFlip, settings.cardAutoFlipDelay]);

  const startSession = useCallback(
    (selectedMode: StudyMode, chapterId: string | null) => {
      let words: SessionWord[] = [];
      let effectiveSessionMode = selectedMode;

      if (chapterId === 'weekly') {
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
        words = interleaveByWeakness(words, (wid) => weakness(wordProgress[wid]));
        effectiveSessionMode = 'adaptive';
      } else if (chapterId === 'mistakes') {
        words = allFlatItems
          .filter((fi) => mistakes.includes(fi.wordId))
          .map((fi) => ({ wordId: fi.wordId, en: fi.item.en, zh: fi.item.zh, pos: fi.item.pos }));
        words = interleaveByWeakness(words, (wid) => weakness(wordProgress[wid]));
        effectiveSessionMode = 'adaptive';
      } else if (chapterId) {
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
        const dueIds = allFlatItems
          .filter((fi) => isDue(wordProgress[fi.wordId]))
          .map((fi) => ({ wordId: fi.wordId, en: fi.item.en, zh: fi.item.zh, pos: fi.item.pos }));
        words = shuffle(dueIds);
      }

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
      const studied = sessionWords.length;
      const correct = correctCount;
      const wrong = wrongCount;
      const today = new Date().toISOString().slice(0, 10);
      const history = [...studyHistory];
      const todayEntry = history.find((h) => h.date === today);
      if (todayEntry) {
        todayEntry.words_studied += studied;
        todayEntry.correct += correct;
        todayEntry.wrong += wrong;
        todayEntry.sessions += 1;
        todayEntry.modes[mode] = (todayEntry.modes[mode] || 0) + 1;
      } else {
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

      if (studied > 0) {
        checkin();
      }

      const newAchievements = checkAndUnlockAchievements();
      newAchievements.forEach((a) => addToast(`🎉 成就解锁：${a.title}`, 'success'));

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
      <PageShell>
        <View className='wf-fade-in' style={{ display: 'flex', flexDirection: 'column' }}>
          <View
            onClick={goHome}
            style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 24 }}
          >
            <Icon name='chevron-left' size={9} color='var(--text-tertiary)' />
            <Text style={{ fontSize: 26, color: 'var(--text-tertiary)' }}>返回</Text>
          </View>

          <View style={{ marginBottom: 32 }}>
            <Text style={{ fontSize: 44, fontWeight: 700, fontFamily: 'var(--font-display)', color: 'var(--text)' }}>
              学习中心
            </Text>
            <Text style={{ display: 'block', fontSize: 26, marginTop: 8, color: 'var(--text-secondary)' }}>
              选择学习模式和章节开始
            </Text>
          </View>

          {/* Mode Selection */}
          <View style={{ marginBottom: 40 }}>
            <Text style={{ fontSize: 28, fontWeight: 700, color: 'var(--text)' }}>学习模式</Text>
            <View style={{ display: 'flex', flexWrap: 'wrap', gap: 24, marginTop: 24 }}>
              {MODES.map((m) => {
                const active = mode === m.id;
                return (
                  <Card
                    key={m.id}
                    hover
                    padding='md'
                    onClick={() => { sfx.click(); setMode(m.id); }}
                    className='st-mode-item'
                    style={active ? { borderColor: m.color, borderWidth: 2 } : undefined}
                  >
                    <View style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 16 }}>
                      <View
                        style={{
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          width: 80, height: 80, borderRadius: 20, background: m.bg, color: m.color,
                        }}
                      >
                        <Icon name={m.icon} size={10} color={m.color} />
                      </View>
                      <View>
                        <Text style={{ display: 'block', fontSize: 28, fontWeight: 600, color: 'var(--text)' }}>{m.label}</Text>
                        <Text style={{ display: 'block', fontSize: 22, color: 'var(--text-tertiary)' }}>{m.desc}</Text>
                      </View>
                    </View>
                  </Card>
                );
              })}
            </View>
          </View>

          {/* Chapter Selection */}
          <View>
            <Text style={{ fontSize: 28, fontWeight: 700, color: 'var(--text)' }}>选择章节</Text>
            <View style={{ display: 'flex', flexDirection: 'column', gap: 16, marginTop: 24 }}>
              <Card
                hover padding='md' onClick={() => { sfx.click(); setSelectedChapterId(null); }}
                className='st-chapter'
                style={!selectedChapterId ? { borderColor: '#14b8a6', borderWidth: 2 } : undefined}
              >
                <View style={{ display: 'flex', alignItems: 'center', gap: 32 }}>
                  <View style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 80, height: 80, borderRadius: 20, flexShrink: 0, background: 'rgba(20,184,166,0.12)', color: '#0d9488' }}>
                    <Icon name='sparkles' size={10} color='#0d9488' />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={{ display: 'block', fontSize: 28, fontWeight: 600, color: 'var(--text)' }}>复习到期单词</Text>
                    <Text style={{ display: 'block', fontSize: 22, color: 'var(--text-tertiary)' }}>基于 SM-2 算法的智能复习</Text>
                  </View>
                </View>
              </Card>

              <Card
                hover padding='md' onClick={() => { sfx.click(); setSelectedChapterId('weekly'); }}
                className='st-chapter'
                style={selectedChapterId === 'weekly' ? { borderColor: '#6366f1', borderWidth: 2 } : undefined}
              >
                <View style={{ display: 'flex', alignItems: 'center', gap: 32 }}>
                  <View style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 80, height: 80, borderRadius: 20, flexShrink: 0, background: 'rgba(99,102,241,0.12)', color: '#6366f1' }}>
                    <Icon name='calendar' size={10} color='#6366f1' />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={{ display: 'block', fontSize: 28, fontWeight: 600, color: 'var(--text)' }}>周总复习</Text>
                    <Text style={{ display: 'block', fontSize: 22, color: 'var(--text-tertiary)' }}>交错巩固 + 易混词穿插</Text>
                  </View>
                </View>
              </Card>

              <Card
                hover padding='md' onClick={() => { sfx.click(); setSelectedChapterId('mistakes'); }}
                className='st-chapter'
                style={selectedChapterId === 'mistakes' ? { borderColor: '#ef4444', borderWidth: 2 } : undefined}
              >
                <View style={{ display: 'flex', alignItems: 'center', gap: 32 }}>
                  <View style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 80, height: 80, borderRadius: 20, flexShrink: 0, background: 'rgba(239,68,68,0.12)', color: '#ef4444' }}>
                    <Icon name='alert' size={10} color='#ef4444' />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={{ display: 'block', fontSize: 28, fontWeight: 600, color: 'var(--text)' }}>错词本复习</Text>
                    <Text style={{ display: 'block', fontSize: 22, color: 'var(--text-tertiary)' }}>专攻薄弱词汇 · {mistakes.length} 词</Text>
                  </View>
                </View>
              </Card>

              {chapters.map((ch) => {
                const active = selectedChapterId === ch.id;
                const wordCount = getChapterWordIds(ch).length;
                return (
                  <Card
                    key={ch.id}
                    hover padding='md' onClick={() => { sfx.click(); setSelectedChapterId(ch.id); }}
                    className='st-chapter'
                    style={active ? { borderColor: '#14b8a6', borderWidth: 2 } : undefined}
                  >
                    <View style={{ display: 'flex', alignItems: 'center', gap: 32 }}>
                      <View style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 80, height: 80, borderRadius: 20, fontSize: 44, flexShrink: 0, background: (ch.color || '#0d9488') + '22' }}>
                        <Text style={{ fontSize: 44 }}>{getChapterIcon(ch.icon)}</Text>
                      </View>
                      <View style={{ flex: 1, minWidth: 0 }}>
                        <Text style={{ display: 'block', fontSize: 28, fontWeight: 600, color: 'var(--text)' }}>{ch.title}</Text>
                        <Text style={{ display: 'block', fontSize: 22, color: 'var(--text-tertiary)' }}>{wordCount} 词</Text>
                      </View>
                    </View>
                  </Card>
                );
              })}
            </View>
          </View>

          <View style={{ marginTop: 40 }}>
            <Button fullWidth size='lg' variant='primary' onClick={() => startSession(mode, selectedChapterId)}>
              开始学习
            </Button>
          </View>
        </View>
      </PageShell>
    );
  }

  // ===== Result Phase =====
  if (phase === 'result') {
    return (
      <PageShell>
        <View className='wf-fade-in' style={{ display: 'flex', flexDirection: 'column', gap: 40 }}>
          <Card padding='lg'>
            <View style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
              <View style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 128, height: 128, borderRadius: 999, marginBottom: 32, background: 'rgba(20,184,166,0.15)', color: '#0d9488' }}>
                <Icon name='check' size={16} color='#0d9488' />
              </View>
              <Text style={{ fontSize: 40, fontWeight: 700, fontFamily: 'var(--font-display)', color: 'var(--text)', marginBottom: 8 }}>学习完成！</Text>
              <Text style={{ fontSize: 26, color: 'var(--text-secondary)' }}>坚持就是胜利</Text>
            </View>
          </Card>

          <View style={{ display: 'flex', flexWrap: 'wrap', gap: 24 }}>
            <Card padding='md' style={{ width: 'calc(50% - 12rpx)' }}>
              <View style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                <Text style={{ fontSize: 40, fontWeight: 700, color: '#0d9488' }}>{sessionWords.length}</Text>
                <Text style={{ fontSize: 22, color: 'var(--text-tertiary)', marginTop: 4 }}>总词数</Text>
              </View>
            </Card>
            <Card padding='md' style={{ width: 'calc(50% - 12rpx)' }}>
              <View style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                <Text style={{ fontSize: 40, fontWeight: 700, color: '#16a34a' }}>{accuracy}%</Text>
                <Text style={{ fontSize: 22, color: 'var(--text-tertiary)', marginTop: 4 }}>正确率</Text>
              </View>
            </Card>
            <Card padding='md' style={{ width: 'calc(50% - 12rpx)' }}>
              <View style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                <Text style={{ fontSize: 40, fontWeight: 700, color: '#16a34a' }}>{correctCount}</Text>
                <Text style={{ fontSize: 22, color: 'var(--text-tertiary)', marginTop: 4 }}>正确</Text>
              </View>
            </Card>
            <Card padding='md' style={{ width: 'calc(50% - 12rpx)' }}>
              <View style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                <Text style={{ fontSize: 40, fontWeight: 700, color: '#dc2626' }}>{wrongCount}</Text>
                <Text style={{ fontSize: 22, color: 'var(--text-tertiary)', marginTop: 4 }}>错误</Text>
              </View>
            </Card>
          </View>

          <Card padding='md' style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            <Text style={{ fontSize: 26, color: 'var(--text-secondary)' }}>
              学习时长：<Text style={{ fontWeight: 700, color: 'var(--text)' }}>{formatDuration(duration)}</Text>
            </Text>
            {familiarCount > 0 && (
              <Text style={{ fontSize: 26, marginTop: 8, color: 'var(--text-secondary)' }}>
                模糊：<Text style={{ fontWeight: 700, color: '#f59e0b' }}>{familiarCount}</Text>
              </Text>
            )}
            {completedCount < sessionWords.length && (
              <Text style={{ fontSize: 26, marginTop: 8, color: 'var(--text-secondary)' }}>
                已掌握：<Text style={{ fontWeight: 700, color: '#0d9488' }}>{completedCount}</Text> / {sessionWords.length}
              </Text>
            )}
          </Card>

          <View style={{ display: 'flex', gap: 24 }}>
            <Button variant='secondary' fullWidth onClick={goHome}>
              <Icon name='home' size={9} />
              <Text style={{ marginLeft: 8 }}>返回首页</Text>
            </Button>
            <Button variant='primary' fullWidth onClick={restartSession}>
              <Icon name='rotate-ccw' size={9} />
              <Text style={{ marginLeft: 8 }}>再学一轮</Text>
            </Button>
          </View>
        </View>
      </PageShell>
    );
  }

  // ===== Studying Phase =====
  if (!currentWord) {
    return (
      <PageShell>
        <Card padding='lg'>
          <View style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            <Text style={{ fontSize: 26, color: 'var(--text-tertiary)' }}>没有可学习的单词</Text>
            <View style={{ marginTop: 24 }}>
              <Button variant='primary' onClick={restartSession}>返回选择</Button>
            </View>
          </View>
        </Card>
      </PageShell>
    );
  }

  const emoji = getEmoji(currentWord.en);
  const hint = affixHint(currentWord.en);

  const modeLabel = mode === 'adaptive'
    ? `自适应 · ${MODES.find((m) => m.id === renderMode)?.label || ''}`
    : MODES.find((m) => m.id === mode)?.label || '';

  return (
    <PageShell>
      <View className='wf-fade-in' style={{ display: 'flex', flexDirection: 'column', gap: 32 }}>
        {/* Progress Bar + Memory Strength */}
        <View style={{ display: 'flex', alignItems: 'center', gap: 24 }}>
          <View
            onClick={() => { sfx.navigate(); restartSession(); }}
            style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 64, height: 64, borderRadius: 999, flexShrink: 0, background: 'var(--surface-3)', color: 'var(--text-secondary)' }}
          >
            <Icon name='chevron-left' size={9} color='var(--text-secondary)' />
          </View>
          <View style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 12 }}>
            <View style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <Text style={{ fontSize: 22, fontWeight: 500, color: 'var(--text-tertiary)' }}>{currentIndex + 1} / {sessionWords.length}</Text>
              <Text style={{ fontSize: 22, color: 'var(--text-tertiary)' }}>{modeLabel}</Text>
            </View>
            <View style={{ width: '100%', height: 12, borderRadius: 999, overflow: 'hidden', background: 'var(--surface-3)' }}>
              <View style={{ height: '100%', borderRadius: 999, transition: 'width 0.3s', width: `${progress}%`, background: 'linear-gradient(90deg,#2dd4bf,#0d9488)' }} />
            </View>
            <MemoryStrengthBar strength={memoryStrength} />
          </View>
        </View>

        {/* Multiple correct progress indicator */}
        {!isSelfGraded && requiredCorrect > 1 && (
          <View style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 16 }}>
            {Array.from({ length: requiredCorrect }).map((_, i) => (
              <View key={i} style={{ width: 16, height: 16, borderRadius: 999, background: i < currentCorrect ? '#16a34a' : 'var(--surface-3)' }} />
            ))}
            <Text style={{ fontSize: 20, marginLeft: 8, color: 'var(--text-tertiary)' }}>答对 {requiredCorrect} 次完成</Text>
          </View>
        )}

        {/* ===== Flashcard Mode ===== */}
        {renderMode === 'flashcard' && (
          <View style={{ display: 'flex', flexDirection: 'column', gap: 32 }}>
            <Card
              padding='lg'
              onClick={() => { if (!answered && !flipped) { sfx.flip(); setFlipped(true); } }}
              className='st-card-center'
            >
              {!flipped ? (
                <View style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: 40 }}>
                  {emoji && <Text style={{ fontSize: 80, marginBottom: 24 }}>{emoji}</Text>}
                  <Text style={{ fontSize: 56, fontWeight: 700, fontFamily: 'var(--font-display)', textAlign: 'center', color: 'var(--text)' }}>{currentWord.en}</Text>
                  {currentWord.pos && (
                    <Text style={{ display: 'inline-block', fontSize: 22, padding: '4rpx 16rpx', borderRadius: 12, marginTop: 16, background: 'var(--surface-3)', color: 'var(--text-tertiary)' }}>{currentWord.pos}</Text>
                  )}
                  <View style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 80, height: 80, borderRadius: 999, marginTop: 32, background: 'rgba(20,184,166,0.12)', color: '#0d9488' }}
                    onClick={(e) => { e.stopPropagation(); tts.speakWord(currentWord.en); }}
                  >
                    <Icon name='volume' size={10} color='#0d9488' />
                  </View>
                  <Text style={{ fontSize: 22, marginTop: 24, color: 'var(--text-tertiary)' }}>点击卡片查看释义</Text>
                </View>
              ) : (
                <View style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: 40 }}>
                  <Text style={{ fontSize: 48, fontWeight: 700, fontFamily: 'var(--font-display)', color: 'var(--text)' }}>{currentWord.en}</Text>
                  <Text style={{ fontSize: 36, textAlign: 'center', marginTop: 16, color: 'var(--text-secondary)' }}>{currentWord.zh}</Text>
                  {hint && (
                    <Text style={{ fontSize: 22, padding: '12rpx 24rpx', borderRadius: 16, marginTop: 16, background: 'var(--surface-2)', color: 'var(--text-tertiary)' }}>{hint}</Text>
                  )}
                  <View style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 80, height: 80, borderRadius: 999, marginTop: 24, background: 'rgba(20,184,166,0.12)', color: '#0d9488' }}
                    onClick={(e) => { e.stopPropagation(); tts.speakWord(currentWord.en); }}
                  >
                    <Icon name='volume' size={10} color='#0d9488' />
                  </View>
                  <Text style={{ fontSize: 22, marginTop: 24, color: 'var(--text-tertiary)' }}>你认识这个词吗？</Text>
                </View>
              )}
            </Card>

            {flipped && (
              <View style={{ display: 'flex', gap: 16 }}>
                <Button variant='danger' size='md' onClick={() => handleAnswer(false)} disabled={answered}>
                  <Icon name='x' size={8} />
                  <Text style={{ marginLeft: 8 }}>不认识</Text>
                </Button>
                <Button variant='secondary' size='md' onClick={() => handleAnswer('familiar')} disabled={answered}>
                  <Text>模糊</Text>
                </Button>
                <Button variant='success' size='md' onClick={() => handleAnswer(true)} disabled={answered}>
                  <Icon name='check' size={8} />
                  <Text style={{ marginLeft: 8 }}>认识</Text>
                </Button>
              </View>
            )}

            {answered && (
              wordCompleted ? (
                <Button fullWidth size='lg' variant='primary' onClick={handleNext}>
                  {currentIndex + 1 >= sessionWords.length ? '完成学习' : '下一个'}
                </Button>
              ) : (
                <Button fullWidth size='lg' variant='primary' onClick={handleContinue}>
                  继续练习 ({currentCorrect}/{requiredCorrect})
                </Button>
              )
            )}
          </View>
        )}

        {/* ===== Quiz Mode (mixed zh→en and en→zh) ===== */}
        {renderMode === 'quiz' && (
          <View style={{ display: 'flex', flexDirection: 'column', gap: 32 }}>
            <Card padding='lg' className='st-card-center'>
              <View style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                {emoji && <Text style={{ fontSize: 64, marginBottom: 24 }}>{emoji}</Text>}
                <Text style={{ fontSize: 22, marginBottom: 16, color: 'var(--text-tertiary)' }}>
                  {quizDirection === 'zh-to-en' ? '选择正确的英文单词' : '选择正确的中文释义'}
                </Text>
                <Text style={{ fontSize: 36, fontWeight: 700, color: 'var(--text)' }}>
                  {quizDirection === 'zh-to-en' ? currentWord.zh : currentWord.en}
                </Text>
                {quizDirection === 'en-to-zh' && (
                  <View style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 80, height: 80, borderRadius: 999, marginTop: 24, background: 'rgba(20,184,166,0.12)', color: '#0d9488' }}
                    onClick={() => tts.speakWord(currentWord.en)}
                  >
                    <Icon name='volume' size={10} color='#0d9488' />
                  </View>
                )}
                {currentWord.pos && (
                  <Text style={{ display: 'inline-block', fontSize: 22, padding: '4rpx 16rpx', borderRadius: 12, marginTop: 16, background: 'var(--surface-3)', color: 'var(--text-tertiary)' }}>{currentWord.pos}</Text>
                )}
              </View>
            </Card>

            <View style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {quizOptions.map((opt, idx) => {
                const isSelected = selectedOption === idx;
                const showCorrect = answered && opt.correct;
                const showWrong = answered && isSelected && !opt.correct;
                return (
                  <View
                    key={idx}
                    onClick={() => handleQuizAnswer(idx)}
                    style={{
                      width: '100%', display: 'flex', alignItems: 'center', gap: 24, padding: 32, borderRadius: 20,
                      background: showCorrect ? 'rgba(22,163,74,0.1)' : showWrong ? 'rgba(220,38,38,0.1)' : 'var(--surface)',
                      borderWidth: 2, borderStyle: 'solid',
                      borderColor: showCorrect ? '#16a34a' : showWrong ? '#dc2626' : 'var(--border)',
                      opacity: answered && !isSelected && !opt.correct ? 0.5 : 1,
                    }}
                  >
                    <View style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 64, height: 64, borderRadius: 999, fontSize: 26, fontWeight: 700, flexShrink: 0, background: showCorrect ? '#16a34a' : showWrong ? '#dc2626' : 'var(--surface-3)', color: showCorrect || showWrong ? '#fff' : 'var(--text-secondary)' }}>
                      {showCorrect ? <Icon name='check' size={8} color='#fff' /> : showWrong ? <Icon name='x' size={8} color='#fff' /> : <Text style={{ fontSize: 26, fontWeight: 700, color: 'var(--text-secondary)' }}>{String.fromCharCode(65 + idx)}</Text>}
                    </View>
                    <Text style={{ fontSize: 26, fontWeight: 500, color: 'var(--text)' }}>
                      {quizDirection === 'zh-to-en' ? opt.en : opt.zh}
                    </Text>
                  </View>
                );
              })}
            </View>

            {answered && (
              wordCompleted ? (
                <Button fullWidth size='lg' variant='primary' onClick={handleNext}>
                  {currentIndex + 1 >= sessionWords.length ? '完成学习' : '下一个'}
                </Button>
              ) : (
                <Button fullWidth size='lg' variant='primary' onClick={handleContinue}>
                  继续练习 ({currentCorrect}/{requiredCorrect})
                </Button>
              )
            )}
          </View>
        )}

        {/* ===== Spelling Mode ===== */}
        {renderMode === 'spelling' && (
          <View style={{ display: 'flex', flexDirection: 'column', gap: 32 }}>
            <Card padding='lg' className='st-card-center'>
              <View style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                {emoji && <Text style={{ fontSize: 64, marginBottom: 24 }}>{emoji}</Text>}
                <Text style={{ fontSize: 22, marginBottom: 16, color: 'var(--text-tertiary)' }}>拼写出正确的英文单词</Text>
                <Text style={{ fontSize: 36, fontWeight: 700, marginBottom: 16, color: 'var(--text)' }}>{currentWord.zh}</Text>
                {currentWord.pos && (
                  <Text style={{ display: 'inline-block', fontSize: 22, padding: '4rpx 16rpx', borderRadius: 12, background: 'var(--surface-3)', color: 'var(--text-tertiary)' }}>{currentWord.pos}</Text>
                )}
                <Text style={{ fontSize: 22, marginTop: 24, color: 'var(--text-tertiary)' }}>{currentWord.en.length} 个字母</Text>
              </View>
            </Card>

            <View style={{ display: 'flex', gap: 16 }}>
              <Input
                value={spellingInput}
                onInput={(e) => setSpellingInput(e.detail.value)}
                onConfirm={() => { if (!answered) handleSpellingSubmit(); }}
                disabled={answered}
                placeholder='输入英文单词...'
                className='st-input'
                style={{
                  background: 'var(--surface)',
                  borderWidth: 2, borderStyle: 'solid',
                  borderColor: answered ? (spellingInput.trim().toLowerCase() === currentWord.en.toLowerCase() ? '#16a34a' : '#dc2626') : 'var(--border)',
                  color: 'var(--text)',
                }}
              />
              {!answered && (
                <Button variant='primary' size='lg' onClick={handleSpellingSubmit}>确定</Button>
              )}
            </View>

            {answered && (
              <View style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
                {spellingInput.trim().toLowerCase() !== currentWord.en.toLowerCase() && (
                  <Card padding='md' className='st-answer-row' style={{ borderColor: '#dc2626', borderWidth: 2 }}>
                    <View style={{ display: 'flex', alignItems: 'center', gap: 24 }}>
                      <Icon name='x' size={10} color='#dc2626' />
                      <View>
                        <Text style={{ display: 'block', fontSize: 22, color: 'var(--text-tertiary)' }}>正确答案</Text>
                        <Text style={{ display: 'block', fontSize: 28, fontWeight: 700, color: 'var(--text)' }}>{currentWord.en}</Text>
                      </View>
                      <View style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', justifyContent: 'center', width: 72, height: 72, borderRadius: 999, background: 'rgba(20,184,166,0.12)', color: '#0d9488' }}
                        onClick={() => tts.speakWord(currentWord.en)}
                      >
                        <Icon name='volume' size={9} color='#0d9488' />
                      </View>
                    </View>
                  </Card>
                )}
                {wordCompleted ? (
                  <Button fullWidth size='lg' variant='primary' onClick={handleNext}>
                    {currentIndex + 1 >= sessionWords.length ? '完成学习' : '下一个'}
                  </Button>
                ) : (
                  <Button fullWidth size='lg' variant='primary' onClick={handleContinue}>
                    继续练习 ({currentCorrect}/{requiredCorrect})
                  </Button>
                )}
              </View>
            )}
          </View>
        )}

        {/* ===== Listening Mode ===== */}
        {renderMode === 'listening' && (
          <View style={{ display: 'flex', flexDirection: 'column', gap: 32 }}>
            <Card padding='lg' className='st-card-center'>
              <View style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                <View style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 160, height: 160, borderRadius: 999, marginBottom: 32, background: 'rgba(236,72,153,0.12)', color: '#ec4899' }}
                  onClick={() => tts.speakWord(currentWord.en)}
                >
                  <Icon name='volume' size={18} color='#ec4899' />
                </View>
                <Text style={{ fontSize: 26, color: 'var(--text-secondary)' }}>点击图标重新播放，选择正确的词义</Text>
              </View>
            </Card>

            <View style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {quizOptions.map((opt, idx) => {
                const isSelected = selectedOption === idx;
                const showCorrect = answered && opt.correct;
                const showWrong = answered && isSelected && !opt.correct;
                return (
                  <View
                    key={idx}
                    onClick={() => handleQuizAnswer(idx)}
                    style={{
                      width: '100%', display: 'flex', alignItems: 'center', gap: 24, padding: 32, borderRadius: 20,
                      background: showCorrect ? 'rgba(22,163,74,0.1)' : showWrong ? 'rgba(220,38,38,0.1)' : 'var(--surface)',
                      borderWidth: 2, borderStyle: 'solid',
                      borderColor: showCorrect ? '#16a34a' : showWrong ? '#dc2626' : 'var(--border)',
                      opacity: answered && !isSelected && !opt.correct ? 0.5 : 1,
                    }}
                  >
                    <View style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 64, height: 64, borderRadius: 999, fontSize: 26, fontWeight: 700, flexShrink: 0, background: showCorrect ? '#16a34a' : showWrong ? '#dc2626' : 'var(--surface-3)', color: showCorrect || showWrong ? '#fff' : 'var(--text-secondary)' }}>
                      {showCorrect ? <Icon name='check' size={8} color='#fff' /> : showWrong ? <Icon name='x' size={8} color='#fff' /> : <Text style={{ fontSize: 26, fontWeight: 700, color: 'var(--text-secondary)' }}>{String.fromCharCode(65 + idx)}</Text>}
                    </View>
                    <Text style={{ fontSize: 26, fontWeight: 500, color: 'var(--text)' }}>{opt.zh}</Text>
                  </View>
                );
              })}
            </View>

            {answered && (
              <Card padding='md' className='st-answer-row'>
                <View style={{ display: 'flex', alignItems: 'center', gap: 24 }}>
                  <View style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 96, height: 96, borderRadius: 24, fontSize: 44, flexShrink: 0, background: 'var(--surface-2)' }}>
                    <Text style={{ fontSize: 44 }}>{emoji || currentWord.en.charAt(0).toUpperCase()}</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={{ display: 'block', fontSize: 28, fontWeight: 700, color: 'var(--text)' }}>{currentWord.en}</Text>
                    <Text style={{ display: 'block', fontSize: 26, color: 'var(--text-secondary)' }}>{currentWord.zh}</Text>
                  </View>
                  <View style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 72, height: 72, borderRadius: 999, background: 'rgba(20,184,166,0.12)', color: '#0d9488' }}
                    onClick={() => tts.speakWord(currentWord.en)}
                  >
                    <Icon name='volume' size={9} color='#0d9488' />
                  </View>
                </View>
              </Card>
            )}

            {answered && (
              wordCompleted ? (
                <Button fullWidth size='lg' variant='primary' onClick={handleNext}>
                  {currentIndex + 1 >= sessionWords.length ? '完成学习' : '下一个'}
                </Button>
              ) : (
                <Button fullWidth size='lg' variant='primary' onClick={handleContinue}>
                  继续练习 ({currentCorrect}/{requiredCorrect})
                </Button>
              )
            )}
          </View>
        )}

        {/* ===== Image Mode (图文模式) ===== */}
        {renderMode === 'image' && (
          <View style={{ display: 'flex', flexDirection: 'column', gap: 32 }}>
            <Card padding='lg' className='st-card-center'>
              <View style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                <View style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 192, height: 192, borderRadius: 48, marginBottom: 32, fontSize: 96, background: 'rgba(6,182,212,0.1)' }}>
                  <Text style={{ fontSize: 96 }}>{emoji || currentWord.en.charAt(0).toUpperCase()}</Text>
                </View>
                <Text style={{ fontSize: 56, fontWeight: 700, fontFamily: 'var(--font-display)', marginBottom: 16, color: 'var(--text)' }}>{currentWord.en}</Text>
                <Text style={{ fontSize: 36, marginBottom: 16, color: 'var(--text-secondary)' }}>{currentWord.zh}</Text>
                {currentWord.pos && (
                  <Text style={{ display: 'inline-block', fontSize: 22, padding: '4rpx 16rpx', borderRadius: 12, background: 'var(--surface-3)', color: 'var(--text-tertiary)' }}>{currentWord.pos}</Text>
                )}
                {hint && (
                  <Text style={{ display: 'inline-block', fontSize: 22, padding: '12rpx 24rpx', borderRadius: 16, marginTop: 24, background: 'var(--surface-2)', color: 'var(--text-tertiary)' }}>{hint}</Text>
                )}
                <View style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 80, height: 80, borderRadius: 999, marginTop: 32, background: 'rgba(6,182,212,0.12)', color: '#06b6d4' }}
                  onClick={() => tts.speakWord(currentWord.en)}
                >
                  <Icon name='volume' size={10} color='#06b6d4' />
                </View>
              </View>
            </Card>

            {examples.length > 0 && (
              <View style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                <Text style={{ fontSize: 22, fontWeight: 700, color: 'var(--text-tertiary)' }}>例句</Text>
                {examples.slice(0, 2).map((ex, i) => (
                  <View key={i} style={{ padding: 24, borderRadius: 20, background: 'var(--surface-2)' }}>
                    <View style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 8 }}>
                      <Text style={{ fontSize: 20, padding: '4rpx 12rpx', borderRadius: 8, fontWeight: 500, background: ex.tier === 1 ? 'rgba(20,184,166,0.15)' : 'rgba(139,92,246,0.15)', color: ex.tier === 1 ? '#0d9488' : '#8b5cf6' }}>{ex.label}</Text>
                    </View>
                    <View style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 8 }}>
                      <Text style={{ flex: 1, fontSize: 26, fontWeight: 500, color: 'var(--text)' }}>{ex.en}</Text>
                      <View style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 56, height: 56, borderRadius: 999, flexShrink: 0, background: 'rgba(20,184,166,0.1)', color: '#0d9488' }}
                        onClick={() => tts.speakSentence(ex.en)}
                      >
                        <Icon name='volume' size={7} color='#0d9488' />
                      </View>
                    </View>
                    <Text style={{ fontSize: 22, color: 'var(--text-secondary)' }}>{ex.zh}</Text>
                  </View>
                ))}
              </View>
            )}

            {shadowSupported() && (
              <View style={{ display: 'flex', alignItems: 'center', gap: 24 }}>
                <Button variant='secondary' size='sm' onClick={handleShadow} disabled={shadowListening || answered}>
                  <Icon name='mic' size={7} />
                  <Text style={{ marginLeft: 8 }}>{shadowListening ? '正在聆听...' : '跟读'}</Text>
                </Button>
                {shadowResult && (
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 22, color: shadowResult.error ? '#dc2626' : (shadowResult.score && shadowResult.score >= 80 ? '#16a34a' : '#f59e0b') }}>
                      {shadowResult.error ? shadowResult.error : `相似度 ${shadowResult.score}% · ${shadowResult.heard}`}
                    </Text>
                  </View>
                )}
              </View>
            )}

            <View style={{ display: 'flex', gap: 16 }}>
              <Button variant='danger' size='md' onClick={() => handleAnswer(false)} disabled={answered}>
                <Icon name='x' size={8} />
                <Text style={{ marginLeft: 8 }}>不认识</Text>
              </Button>
              <Button variant='success' size='md' onClick={() => handleAnswer(true)} disabled={answered}>
                <Icon name='check' size={8} />
                <Text style={{ marginLeft: 8 }}>认识</Text>
              </Button>
            </View>

            {answered && (
              <Button fullWidth size='lg' variant='primary' onClick={handleNext}>
                {currentIndex + 1 >= sessionWords.length ? '完成学习' : '下一个'}
              </Button>
            )}
          </View>
        )}

        {/* ===== Recall Mode (主动回忆) ===== */}
        {renderMode === 'recall' && (
          <View style={{ display: 'flex', flexDirection: 'column', gap: 32 }}>
            {!flipped ? (
              <View style={{ display: 'flex', flexDirection: 'column', gap: 32 }}>
                <Card padding='lg' className='st-card-center'>
                  <View style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                    <View style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 112, height: 112, borderRadius: 28, marginBottom: 32, background: 'rgba(139,92,246,0.12)', color: '#8b5cf6' }}>
                      <Icon name='brain' size={14} color='#8b5cf6' />
                    </View>
                    <Text style={{ fontSize: 22, marginBottom: 16, color: 'var(--text-tertiary)' }}>想想这个中文对应的英文是什么</Text>
                    <Text style={{ fontSize: 40, fontWeight: 700, marginBottom: 16, color: 'var(--text)' }}>{currentWord.zh}</Text>
                    {currentWord.pos && (
                      <Text style={{ display: 'inline-block', fontSize: 22, padding: '4rpx 16rpx', borderRadius: 12, background: 'var(--surface-3)', color: 'var(--text-tertiary)' }}>{currentWord.pos}</Text>
                    )}
                    <Text style={{ fontSize: 22, marginTop: 32, color: 'var(--text-tertiary)' }}>想好了就点击下方按钮查看答案</Text>
                  </View>
                </Card>
                <Button fullWidth size='lg' variant='primary' onClick={() => { sfx.flip(); setFlipped(true); }}>
                  显示答案
                </Button>
              </View>
            ) : (
              <View style={{ display: 'flex', flexDirection: 'column', gap: 32 }}>
                <Card padding='lg' className='st-card-center'>
                  <View style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                    {emoji && <Text style={{ fontSize: 64, marginBottom: 24 }}>{emoji}</Text>}
                    <Text style={{ fontSize: 56, fontWeight: 700, fontFamily: 'var(--font-display)', marginBottom: 16, color: 'var(--text)' }}>{currentWord.en}</Text>
                    <Text style={{ fontSize: 36, marginBottom: 16, color: 'var(--text-secondary)' }}>{currentWord.zh}</Text>
                    {hint && (
                      <Text style={{ display: 'inline-block', fontSize: 22, padding: '12rpx 24rpx', borderRadius: 16, background: 'var(--surface-2)', color: 'var(--text-tertiary)' }}>{hint}</Text>
                    )}
                    <View style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 80, height: 80, borderRadius: 999, marginTop: 24, background: 'rgba(20,184,166,0.12)', color: '#0d9488' }}
                      onClick={() => tts.speakWord(currentWord.en)}
                    >
                      <Icon name='volume' size={10} color='#0d9488' />
                    </View>
                  </View>
                </Card>

                {examples.length > 0 && (
                  <View style={{ padding: 24, borderRadius: 20, background: 'var(--surface-2)' }}>
                    <View style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 8 }}>
                      <Text style={{ flex: 1, fontSize: 26, fontWeight: 500, color: 'var(--text)' }}>{examples[0].en}</Text>
                      <View style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 56, height: 56, borderRadius: 999, flexShrink: 0, background: 'rgba(20,184,166,0.1)', color: '#0d9488' }}
                        onClick={() => tts.speakSentence(examples[0].en)}
                      >
                        <Icon name='volume' size={7} color='#0d9488' />
                      </View>
                    </View>
                    <Text style={{ fontSize: 22, color: 'var(--text-secondary)' }}>{examples[0].zh}</Text>
                  </View>
                )}

                {shadowSupported() && (
                  <View style={{ display: 'flex', alignItems: 'center', gap: 24 }}>
                    <Button variant='secondary' size='sm' onClick={handleShadow} disabled={shadowListening || answered}>
                      <Icon name='mic' size={7} />
                      <Text style={{ marginLeft: 8 }}>{shadowListening ? '正在聆听...' : '跟读'}</Text>
                    </Button>
                    {shadowResult && (
                      <View style={{ flex: 1 }}>
                        <Text style={{ fontSize: 22, color: shadowResult.error ? '#dc2626' : (shadowResult.score && shadowResult.score >= 80 ? '#16a34a' : '#f59e0b') }}>
                          {shadowResult.error ? shadowResult.error : `相似度 ${shadowResult.score}% · ${shadowResult.heard}`}
                        </Text>
                      </View>
                    )}
                  </View>
                )}

                <View style={{ display: 'flex', gap: 16 }}>
                  <Button variant='danger' size='md' onClick={() => handleAnswer(false)} disabled={answered}>
                    <Icon name='x' size={8} />
                    <Text style={{ marginLeft: 8 }}>不认识</Text>
                  </Button>
                  <Button variant='secondary' size='md' onClick={() => handleAnswer('familiar')} disabled={answered}>
                    <Text>模糊</Text>
                  </Button>
                  <Button variant='success' size='md' onClick={() => handleAnswer(true)} disabled={answered}>
                    <Icon name='check' size={8} />
                    <Text style={{ marginLeft: 8 }}>认识</Text>
                  </Button>
                </View>

                {answered && (
                  <Button fullWidth size='lg' variant='primary' onClick={handleNext}>
                    {currentIndex + 1 >= sessionWords.length ? '完成学习' : '下一个'}
                  </Button>
                )}
              </View>
            )}
          </View>
        )}

        {/* ===== Cloze Mode (例句挖空) ===== */}
        {renderMode === 'cloze' && clozeData && (
          <View style={{ display: 'flex', flexDirection: 'column', gap: 32 }}>
            <Card padding='lg'>
              <View style={{ display: 'flex', flexDirection: 'column' }}>
                <Text style={{ fontSize: 22, marginBottom: 24, color: 'var(--text-tertiary)' }}>填入缺失的单词</Text>
                <Text style={{ fontSize: 32, fontWeight: 500, lineHeight: '48rpx', marginBottom: 24, color: 'var(--text)' }}>{clozeData.blanked}</Text>
                <Text style={{ fontSize: 26, color: 'var(--text-secondary)' }}>{clozeData.translation}</Text>
              </View>
            </Card>

            <View style={{ display: 'flex', gap: 16 }}>
              <Input
                value={clozeAnswer}
                onInput={(e) => setClozeAnswer(e.detail.value)}
                onConfirm={() => { if (!answered) handleClozeSubmit(); }}
                disabled={answered}
                placeholder='填入单词...'
                className='st-input'
                style={{
                  background: 'var(--surface)',
                  borderWidth: 2, borderStyle: 'solid',
                  borderColor: answered ? (clozeAnswer.trim().toLowerCase() === clozeData.answer.toLowerCase() ? '#16a34a' : '#dc2626') : 'var(--border)',
                  color: 'var(--text)',
                }}
              />
              {!answered && (
                <Button variant='primary' size='lg' onClick={handleClozeSubmit}>确定</Button>
              )}
            </View>

            {answered && (
              <View style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
                {clozeAnswer.trim().toLowerCase() !== clozeData.answer.toLowerCase() && (
                  <Card padding='md' className='st-answer-row' style={{ borderColor: '#dc2626', borderWidth: 2 }}>
                    <View style={{ display: 'flex', alignItems: 'center', gap: 24 }}>
                      <Icon name='x' size={10} color='#dc2626' />
                      <View>
                        <Text style={{ display: 'block', fontSize: 22, color: 'var(--text-tertiary)' }}>正确答案</Text>
                        <Text style={{ display: 'block', fontSize: 28, fontWeight: 700, color: 'var(--text)' }}>{clozeData.answer}</Text>
                      </View>
                      <View style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', justifyContent: 'center', width: 72, height: 72, borderRadius: 999, background: 'rgba(20,184,166,0.12)', color: '#0d9488' }}
                        onClick={() => tts.speakWord(currentWord.en)}
                      >
                        <Icon name='volume' size={9} color='#0d9488' />
                      </View>
                    </View>
                  </Card>
                )}
                {wordCompleted ? (
                  <Button fullWidth size='lg' variant='primary' onClick={handleNext}>
                    {currentIndex + 1 >= sessionWords.length ? '完成学习' : '下一个'}
                  </Button>
                ) : (
                  <Button fullWidth size='lg' variant='primary' onClick={handleContinue}>
                    继续练习 ({currentCorrect}/{requiredCorrect})
                  </Button>
                )}
              </View>
            )}
          </View>
        )}

        {/* ===== Zhan Mode (斩模式) ===== */}
        {renderMode === 'zhan' && (
          <View style={{ display: 'flex', flexDirection: 'column', gap: 32 }}>
            <Card
              padding='lg'
              className='st-card-center'
              onClick={() => { if (!flipped && !answered) { sfx.flip(); setFlipped(true); } }}
            >
              <View style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: 40 }}>
                {emoji && <Text style={{ fontSize: 80, marginBottom: 24 }}>{emoji}</Text>}
                <Text style={{ fontSize: 56, fontWeight: 700, fontFamily: 'var(--font-display)', marginBottom: 16, color: 'var(--text)' }}>{currentWord.en}</Text>
                {currentWord.pos && (
                  <Text style={{ display: 'inline-block', fontSize: 22, padding: '4rpx 16rpx', borderRadius: 12, marginBottom: 16, background: 'var(--surface-3)', color: 'var(--text-tertiary)' }}>{currentWord.pos}</Text>
                )}
                {flipped ? (
                  <View style={{ marginTop: 24 }}>
                    <Text style={{ fontSize: 36, marginBottom: 16, color: 'var(--text-secondary)' }}>{currentWord.zh}</Text>
                    {hint && (
                      <Text style={{ display: 'inline-block', fontSize: 22, padding: '12rpx 24rpx', borderRadius: 16, background: 'var(--surface-2)', color: 'var(--text-tertiary)' }}>{hint}</Text>
                    )}
                    <View style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 80, height: 80, borderRadius: 999, marginTop: 24, background: 'rgba(249,115,22,0.12)', color: '#f97316' }}
                      onClick={(e) => { e.stopPropagation(); tts.speakWord(currentWord.en); }}
                    >
                      <Icon name='volume' size={10} color='#f97316' />
                    </View>
                  </View>
                ) : (
                  <Text style={{ fontSize: 22, marginTop: 32, color: 'var(--text-tertiary)' }}>点击卡片查看释义</Text>
                )}
              </View>
            </Card>

            <View style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 16, fontSize: 22, color: 'var(--text-tertiary)' }}>
              <Icon name='zap' size={7} color='#f97316' />
              <Text style={{ fontSize: 22, color: 'var(--text-tertiary)' }}>已斩 {completedCount} 词</Text>
            </View>

            {flipped && !answered && (
              <View style={{ display: 'flex', gap: 24 }}>
                <Button variant='danger' size='lg' onClick={() => handleAnswer(false)}>
                  <Icon name='x' size={9} />
                  <Text style={{ marginLeft: 8 }}>不斩</Text>
                </Button>
                <Button variant='success' size='lg' onClick={() => handleAnswer(true)}>
                  <Icon name='check' size={9} />
                  <Text style={{ marginLeft: 8 }}>斩</Text>
                </Button>
              </View>
            )}

            {answered && (
              <Button fullWidth size='lg' variant='primary' onClick={handleNext}>
                {currentIndex + 1 >= sessionWords.length ? '完成学习' : '下一个'}
              </Button>
            )}
          </View>
        )}

        {/* ===== Confuse Mode (易混词辨析) ===== */}
        {renderMode === 'confuse' && confuseQuestion && (
          <View style={{ display: 'flex', flexDirection: 'column', gap: 32 }}>
            <Card padding='lg' className='st-card-center'>
              <View style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                <View style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 96, height: 96, borderRadius: 24, marginBottom: 24, background: 'rgba(239,68,68,0.12)', color: '#ef4444' }}>
                  <Icon name='shuffle' size={12} color='#ef4444' />
                </View>
                <Text style={{ fontSize: 22, marginBottom: 16, color: 'var(--text-tertiary)' }}>辨析形近词，选择正确答案</Text>
                <Text style={{ fontSize: 36, fontWeight: 700, color: 'var(--text)' }}>{confuseQuestion.zh}</Text>
                {confuseQuestion.pos && (
                  <Text style={{ display: 'inline-block', fontSize: 22, padding: '4rpx 16rpx', borderRadius: 12, marginTop: 16, background: 'var(--surface-3)', color: 'var(--text-tertiary)' }}>{confuseQuestion.pos}</Text>
                )}
                {confuseQuestion.topSim > 0 && (
                  <Text style={{ fontSize: 20, marginTop: 16, color: 'var(--text-tertiary)' }}>最高相似度 {confuseQuestion.topSim}%</Text>
                )}
              </View>
            </Card>

            <View style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {confuseQuestion.options.map((opt, idx) => {
                const isSelected = selectedOption === idx;
                const showCorrect = answered && opt.correct;
                const showWrong = answered && isSelected && !opt.correct;
                return (
                  <View
                    key={idx}
                    onClick={() => handleConfuseAnswer(idx)}
                    style={{
                      width: '100%', display: 'flex', alignItems: 'center', gap: 24, padding: 32, borderRadius: 20,
                      background: showCorrect ? 'rgba(22,163,74,0.1)' : showWrong ? 'rgba(220,38,38,0.1)' : 'var(--surface)',
                      borderWidth: 2, borderStyle: 'solid',
                      borderColor: showCorrect ? '#16a34a' : showWrong ? '#dc2626' : 'var(--border)',
                      opacity: answered && !isSelected && !opt.correct ? 0.5 : 1,
                    }}
                  >
                    <View style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 64, height: 64, borderRadius: 999, fontSize: 26, fontWeight: 700, flexShrink: 0, background: showCorrect ? '#16a34a' : showWrong ? '#dc2626' : 'var(--surface-3)', color: showCorrect || showWrong ? '#fff' : 'var(--text-secondary)' }}>
                      {showCorrect ? <Icon name='check' size={8} color='#fff' /> : showWrong ? <Icon name='x' size={8} color='#fff' /> : <Text style={{ fontSize: 26, fontWeight: 700, color: 'var(--text-secondary)' }}>{String.fromCharCode(65 + idx)}</Text>}
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontSize: 26, fontWeight: 500, color: 'var(--text)' }}>{opt.en}</Text>
                      {!opt.correct && answered && (
                        <Text style={{ fontSize: 20, marginLeft: 16, color: 'var(--text-tertiary)' }}>{opt.zh} · 相似 {Math.round(opt.sim * 100)}%</Text>
                      )}
                    </View>
                  </View>
                );
              })}
            </View>

            {answered && (
              wordCompleted ? (
                <Button fullWidth size='lg' variant='primary' onClick={handleNext}>
                  {currentIndex + 1 >= sessionWords.length ? '完成学习' : '下一个'}
                </Button>
              ) : (
                <Button fullWidth size='lg' variant='primary' onClick={handleContinue}>
                  继续练习 ({currentCorrect}/{requiredCorrect})
                </Button>
              )
            )}
          </View>
        )}

        {/* Example sentences (flashcard mode, after flip) */}
        {renderMode === 'flashcard' && flipped && examples.length > 0 && !answered && (
          <View style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <Text style={{ fontSize: 22, fontWeight: 700, color: 'var(--text-tertiary)' }}>例句</Text>
            {examples.slice(0, 2).map((ex, i) => (
              <View key={i} style={{ padding: 24, borderRadius: 20, background: 'var(--surface-2)' }}>
                <View style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 8 }}>
                  <Text style={{ fontSize: 20, padding: '4rpx 12rpx', borderRadius: 8, fontWeight: 500, background: ex.tier === 1 ? 'rgba(20,184,166,0.15)' : 'rgba(139,92,246,0.15)', color: ex.tier === 1 ? '#0d9488' : '#8b5cf6' }}>{ex.label}</Text>
                </View>
                <View style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 8 }}>
                  <Text style={{ flex: 1, fontSize: 26, fontWeight: 500, color: 'var(--text)' }}>{ex.en}</Text>
                  <View style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 56, height: 56, borderRadius: 999, flexShrink: 0, background: 'rgba(20,184,166,0.1)', color: '#0d9488' }}
                    onClick={() => tts.speakSentence(ex.en)}
                  >
                    <Icon name='volume' size={7} color='#0d9488' />
                  </View>
                </View>
                <Text style={{ fontSize: 22, color: 'var(--text-secondary)' }}>{ex.zh}</Text>
              </View>
            ))}
          </View>
        )}

        {/* Hint */}
        <Text style={{ textAlign: 'center', fontSize: 20, color: 'var(--text-tertiary)' }}>
          点击卡片或按钮完成学习 · 发音按钮可重复朗读
        </Text>
      </View>
    </PageShell>
  );
}
