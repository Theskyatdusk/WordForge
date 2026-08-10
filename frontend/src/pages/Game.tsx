/**
 * Game — Mini-games for vocabulary practice.
 * Includes Word Match (match EN to ZH) and Speed Quiz (timed multiple choice).
 */
import { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Shuffle,
  Zap,
  Trophy,
  Check,
  X,
  ChevronLeft,
  RotateCw,
  Star,
  Timer,
  Award,
  Gamepad2,
  Heart,
} from 'lucide-react';
import { useVocab, getAllItems } from '../hooks/useVocab';
import { useProgressStore } from '../store/useProgressStore';
import { useUIStore } from '../store/useUIStore';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { sfx } from '../utils/sfx';
import { getEmoji } from '../utils/visuals';
import type { Item } from '../types/index';

type GameMode = 'select' | 'match' | 'speed' | 'runner' | 'result';
type GameType = 'match' | 'speed' | 'runner';

interface MatchPair {
  item: Item;
  matched: boolean;
  wrong: boolean;
}

interface SpeedQuestion {
  item: Item;
  options: Item[];
  answered: boolean;
  correctIndex: number;
  selectedIndex: number | null;
}

interface RunnerObstacle {
  id: number;
  x: number;
  type: 'cactus' | 'rock';
  cleared: boolean;
  answered: boolean;
}

interface RunnerQuiz {
  item: Item;
  options: Item[];
  correctIndex: number;
  obstacleId: number;
}

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

const MATCH_ROUND_SIZE = 6;
const SPEED_ROUND_SIZE = 10;
const SPEED_TIME_LIMIT = 15;

// ===== Runner Game (单词跑酷) constants =====
const RUNNER_STAGE_HEIGHT = 340;
const RUNNER_PLAYER_LEFT = 120;
const RUNNER_GROUND_HEIGHT = 56;
const RUNNER_JUMP_BOTTOM = 130;
const RUNNER_QUIZ_TRIGGER_X = 250;
const RUNNER_QUIZ_TIME = 5;
const RUNNER_INITIAL_SPEED = 4;
const RUNNER_MAX_SPEED = 10;
const RUNNER_SPAWN_GAP = 380;
const RUNNER_MAX_HP = 3;

export function Game() {
  const navigate = useNavigate();
  const { data } = useVocab();
  const addCoins = useProgressStore((s) => s.addCoins);
  const addToast = useUIStore((s) => s.addToast);

  const [mode, setMode] = useState<GameMode>('select');
  const [lastGameType, setLastGameType] = useState<GameType>('match');
  const [matchPairs, setMatchPairs] = useState<MatchPair[]>([]);
  const [selectedEn, setSelectedEn] = useState<number | null>(null);
  const [selectedZh, setSelectedZh] = useState<number | null>(null);
  const [matchScore, setMatchScore] = useState(0);
  const [matchRound, setMatchRound] = useState(1);

  const [speedQuestions, setSpeedQuestions] = useState<SpeedQuestion[]>([]);
  const [speedIndex, setSpeedIndex] = useState(0);
  const [speedScore, setSpeedScore] = useState(0);
  const [speedTimer, setSpeedTimer] = useState(SPEED_TIME_LIMIT);

  // Ref to track speedIndex for use in timeout callbacks (avoids stale closure)
  const speedIndexRef = useRef(0);
  useEffect(() => {
    speedIndexRef.current = speedIndex;
  }, [speedIndex]);

  const allItems = useMemo(() => getAllItems(data), [data]);
  const wordPool = useMemo(
    () => allItems.map((fi) => fi.item).filter((i) => i.en && i.zh),
    [allItems],
  );

  // ===== Runner Game (单词跑酷) state =====
  const [runnerState, setRunnerState] = useState<'idle' | 'playing' | 'quiz' | 'over'>('idle');
  const [runnerScore, setRunnerScore] = useState(0);
  const [runnerHp, setRunnerHp] = useState(RUNNER_MAX_HP);
  const [runnerDistance, setRunnerDistance] = useState(0);
  const [runnerTotal, setRunnerTotal] = useState(0);
  const [currentQuiz, setCurrentQuiz] = useState<RunnerQuiz | null>(null);
  const [quizTimer, setQuizTimer] = useState(RUNNER_QUIZ_TIME);
  const [runnerJumping, setRunnerJumping] = useState(false);
  const [runnerHit, setRunnerHit] = useState(false);

  // Refs for the animation loop (avoid stale closures)
  const stageRef = useRef<HTMLDivElement>(null);
  const rafRef = useRef<number | null>(null);
  const distanceRef = useRef(0);
  const speedRef = useRef(RUNNER_INITIAL_SPEED);
  const obstaclesRef = useRef<RunnerObstacle[]>([]);
  const obstacleIdRef = useRef(0);
  const lastSpawnDistanceRef = useRef(0);
  const hpRef = useRef(RUNNER_MAX_HP);
  const runnerScoreRef = useRef(0);
  const quizAnsweredRef = useRef(false);
  const wordPoolRef = useRef(wordPool);
  useEffect(() => {
    wordPoolRef.current = wordPool;
  }, [wordPool]);

  // Track all setTimeout calls for cleanup on unmount — prevents memory leaks
  const timeoutsRef = useRef<number[]>([]);
  const safeTimeout = useCallback((fn: () => void, ms: number) => {
    const id = window.setTimeout(() => {
      fn();
      // Remove the id from the tracking array
      timeoutsRef.current = timeoutsRef.current.filter((t) => t !== id);
    }, ms);
    timeoutsRef.current.push(id);
  }, []);

  // Clear all pending timeouts on unmount
  useEffect(() => {
    return () => {
      timeoutsRef.current.forEach(clearTimeout);
      timeoutsRef.current = [];
    };
  }, []);

  // Stable Chinese-column permutation for the current match round.
  // Recomputed only when the set of match items changes (new round), NOT on
  // every render or when matched/wrong flags update — otherwise the Chinese
  // column would reshuffle each render (and on each correct/wrong match),
  // making the game unplayable. The indices are applied to the current
  // matchPairs so matched/wrong flags always stay in sync.
  const matchItemsKey = matchPairs.map((p) => p.item.en).join('|');
  const zhOrder = useMemo(
    () => shuffle(matchPairs.map((_, i) => i)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [matchItemsKey],
  );

  // ===== Match Game =====
  const startMatch = useCallback(() => {
    if (wordPool.length < MATCH_ROUND_SIZE) {
      addToast('词库词汇不足，无法开始游戏', 'warning');
      return;
    }
    const picked = shuffle(wordPool).slice(0, MATCH_ROUND_SIZE);
    setMatchPairs(picked.map((item) => ({ item, matched: false, wrong: false })));
    setSelectedEn(null);
    setSelectedZh(null);
    setMatchScore(0);
    setMatchRound(1);
    setLastGameType('match');
    setMode('match');
    sfx.navigate();
  }, [wordPool, addToast]);

  const handleMatchClick = (index: number, side: 'en' | 'zh') => {
    // Prevent clicks during wrong-match animation
    if (matchPairs.some((p) => p.wrong)) return;

    if (side === 'en') {
      setSelectedEn(index);
      sfx.click();
    } else {
      setSelectedZh(index);
      sfx.click();
    }

    if (selectedEn !== null && side === 'zh') {
      // Check match
      if (selectedEn === index) {
        // Correct match
        const newPairs = matchPairs.map((p, i) =>
          i === index ? { ...p, matched: true } : p,
        );
        setMatchPairs(newPairs);
        setSelectedEn(null);
        setSelectedZh(null);
        setMatchScore((s) => s + 1);
        sfx.correct();

        // Check if round complete
        if (newPairs.every((p) => p.matched)) {
          safeTimeout(() => {
            if (matchRound >= 3) {
              // Game complete — use functional update to get latest matchScore
              setMatchScore((latestScore) => {
                const coins = latestScore * 5 + 20;
                addCoins(coins);
                sfx.success();
                addToast(`游戏完成！获得 ${coins} 金币`, 'success');
                return latestScore;
              });
              setMode('result');
            } else {
              // Next round
              const picked = shuffle(wordPool).slice(0, MATCH_ROUND_SIZE);
              setMatchPairs(picked.map((item) => ({ item, matched: false, wrong: false })));
              setSelectedEn(null);
              setSelectedZh(null);
              setMatchRound((r) => r + 1);
              sfx.flip();
            }
          }, 500);
        }
      } else {
        // Wrong match — clear selections immediately to prevent stale clicks
        sfx.wrong();
        const wrongEn = selectedEn;
        setMatchPairs((prev) => prev.map((p, i) =>
          i === wrongEn || i === index ? { ...p, wrong: true } : p,
        ));
        setSelectedEn(null);
        setSelectedZh(null);
        safeTimeout(() => {
          setMatchPairs((prev) => prev.map((p) => ({ ...p, wrong: false })));
        }, 600);
      }
    } else if (selectedZh !== null && side === 'en') {
      if (selectedZh === index) {
        const newPairs = matchPairs.map((p, i) =>
          i === index ? { ...p, matched: true } : p,
        );
        setMatchPairs(newPairs);
        setSelectedEn(null);
        setSelectedZh(null);
        setMatchScore((s) => s + 1);
        sfx.correct();

        if (newPairs.every((p) => p.matched)) {
          safeTimeout(() => {
            if (matchRound >= 3) {
              setMatchScore((latestScore) => {
                const coins = latestScore * 5 + 20;
                addCoins(coins);
                sfx.success();
                addToast(`游戏完成！获得 ${coins} 金币`, 'success');
                return latestScore;
              });
              setMode('result');
            } else {
              const picked = shuffle(wordPool).slice(0, MATCH_ROUND_SIZE);
              setMatchPairs(picked.map((item) => ({ item, matched: false, wrong: false })));
              setSelectedEn(null);
              setSelectedZh(null);
              setMatchRound((r) => r + 1);
              sfx.flip();
            }
          }, 500);
        }
      } else {
        sfx.wrong();
        const wrongZh = selectedZh;
        setMatchPairs((prev) => prev.map((p, i) =>
          i === wrongZh || i === index ? { ...p, wrong: true } : p,
        ));
        setSelectedEn(null);
        setSelectedZh(null);
        safeTimeout(() => {
          setMatchPairs((prev) => prev.map((p) => ({ ...p, wrong: false })));
        }, 600);
      }
    }
  };

  // ===== Speed Quiz Game =====
  const startSpeed = useCallback(() => {
    if (wordPool.length < 4) {
      addToast('词库词汇不足，无法开始游戏', 'warning');
      return;
    }
    const questions: SpeedQuestion[] = [];
    for (let i = 0; i < SPEED_ROUND_SIZE; i++) {
      const correct = wordPool[Math.floor(Math.random() * wordPool.length)];
      const distractors = shuffle(wordPool.filter((w) => w.en !== correct.en)).slice(0, 3);
      const options = shuffle([correct, ...distractors]);
      questions.push({
        item: correct,
        options,
        answered: false,
        correctIndex: options.findIndex((o) => o.en === correct.en),
        selectedIndex: null,
      });
    }
    setSpeedQuestions(questions);
    setSpeedIndex(0);
    setSpeedScore(0);
    setSpeedTimer(SPEED_TIME_LIMIT);
    // Reset match game state so result page shows correct stats
    setMatchScore(0);
    setMatchRound(1);
    setLastGameType('speed');
    setMode('speed');
    sfx.navigate();
  }, [wordPool, addToast]);

  // Speed quiz timer
  useEffect(() => {
    if (mode !== 'speed') return;
    if (speedTimer <= 0) {
      // Time's up for this question, move to next
      handleSpeedAnswer(-1);
      return;
    }
    const timer = setTimeout(() => {
      setSpeedTimer((t) => t - 1);
    }, 1000);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, speedTimer]);

  const handleSpeedAnswer = (index: number) => {
    if (speedIndex >= speedQuestions.length) return;
    const current = speedQuestions[speedIndex];
    if (current.answered) return;

    const isCorrect = index === current.correctIndex;
    const newQuestions = [...speedQuestions];
    newQuestions[speedIndex] = {
      ...current,
      answered: true,
      selectedIndex: index,
    };
    setSpeedQuestions(newQuestions);

    if (isCorrect) {
      setSpeedScore((s) => s + 1);
      sfx.correct();
    } else {
      sfx.wrong();
    }

    // Move to next after delay
    safeTimeout(() => {
      if (speedIndexRef.current + 1 >= SPEED_ROUND_SIZE) {
        // Game complete — use functional update to get latest speedScore
        setSpeedScore((latestScore) => {
          const coins = latestScore * 3 + 10;
          addCoins(coins);
          sfx.success();
          addToast(`游戏完成！获得 ${coins} 金币`, 'success');
          return latestScore;
        });
        setMode('result');
      } else {
        setSpeedIndex((i) => i + 1);
        setSpeedTimer(SPEED_TIME_LIMIT);
      }
    }, 800);
  };

  // ===== Runner Game (单词跑酷) =====
  const startRunner = useCallback(() => {
    if (wordPool.length < 4) {
      addToast('词库词汇不足，无法开始游戏', 'warning');
      return;
    }
    distanceRef.current = 0;
    speedRef.current = RUNNER_INITIAL_SPEED;
    obstaclesRef.current = [];
    obstacleIdRef.current = 0;
    lastSpawnDistanceRef.current = -(RUNNER_SPAWN_GAP - 200);
    hpRef.current = RUNNER_MAX_HP;
    runnerScoreRef.current = 0;
    quizAnsweredRef.current = false;
    setRunnerScore(0);
    setRunnerHp(RUNNER_MAX_HP);
    setRunnerDistance(0);
    setRunnerTotal(0);
    setCurrentQuiz(null);
    setQuizTimer(RUNNER_QUIZ_TIME);
    setRunnerJumping(false);
    setRunnerHit(false);
    setLastGameType('runner');
    setRunnerState('playing');
    setMode('runner');
    sfx.navigate();
  }, [wordPool, addToast]);

  const handleRunnerAnswer = (index: number) => {
    if (!currentQuiz || quizAnsweredRef.current) return;
    quizAnsweredRef.current = true;
    const isCorrect = index === currentQuiz.correctIndex;
    const obstacleId = currentQuiz.obstacleId;

    if (isCorrect) {
      runnerScoreRef.current += 1;
      setRunnerScore(runnerScoreRef.current);
      sfx.correct();
      // Mark obstacle cleared so the character can jump over it
      const ob = obstaclesRef.current.find((o) => o.id === obstacleId);
      if (ob) ob.cleared = true;
      setRunnerJumping(true);
      safeTimeout(() => setRunnerJumping(false), 700);
      setCurrentQuiz(null);
      setRunnerState('playing');
    } else {
      sfx.wrong();
      setRunnerHit(true);
      safeTimeout(() => setRunnerHit(false), 500);
      // Character hits the obstacle — remove it and lose 1 HP
      obstaclesRef.current = obstaclesRef.current.filter((o) => o.id !== obstacleId);
      const newHp = hpRef.current - 1;
      hpRef.current = newHp;
      setRunnerHp(newHp);
      setCurrentQuiz(null);
      if (newHp <= 0) {
        const coins =
          runnerScoreRef.current * 4 + Math.floor(distanceRef.current / 100) + 10;
        addCoins(coins);
        addToast(`游戏结束！获得 ${coins} 金币`, 'success');
        setRunnerState('over');
      } else {
        setRunnerState('playing');
      }
    }
  };

  // Runner game loop (requestAnimationFrame, DOM-based)
  useEffect(() => {
    if (mode !== 'runner' || runnerState !== 'playing') return;

    const loop = () => {
      const stageWidth = stageRef.current?.clientWidth ?? 360;
      const speed = speedRef.current;

      // Move obstacles left
      for (const ob of obstaclesRef.current) {
        ob.x -= speed;
      }
      // Remove off-screen obstacles
      obstaclesRef.current = obstaclesRef.current.filter((ob) => ob.x > -80);

      // Increase distance
      distanceRef.current += speed;
      setRunnerDistance(Math.floor(distanceRef.current));

      // Scale speed with distance
      speedRef.current = Math.min(
        RUNNER_INITIAL_SPEED + distanceRef.current / 800,
        RUNNER_MAX_SPEED,
      );

      // Spawn a new obstacle when enough distance has passed
      if (distanceRef.current - lastSpawnDistanceRef.current >= RUNNER_SPAWN_GAP) {
        lastSpawnDistanceRef.current = distanceRef.current;
        obstacleIdRef.current += 1;
        const type: RunnerObstacle['type'] = Math.random() < 0.5 ? 'cactus' : 'rock';
        obstaclesRef.current.push({
          id: obstacleIdRef.current,
          x: stageWidth + 20,
          type,
          cleared: false,
          answered: false,
        });
      }

      // Trigger a quiz when an unanswered obstacle enters the trigger zone
      const trigger = obstaclesRef.current.find(
        (ob) =>
          !ob.answered &&
          !ob.cleared &&
          ob.x <= RUNNER_QUIZ_TRIGGER_X &&
          ob.x > RUNNER_PLAYER_LEFT - 30,
      );

      if (trigger) {
        trigger.answered = true;
        quizAnsweredRef.current = false;
        const pool = wordPoolRef.current;
        const correct = pool[Math.floor(Math.random() * pool.length)];
        const distractors = shuffle(pool.filter((w) => w.en !== correct.en)).slice(0, 3);
        const options = shuffle([correct, ...distractors]);
        setCurrentQuiz({
          item: correct,
          options,
          correctIndex: options.findIndex((o) => o.en === correct.en),
          obstacleId: trigger.id,
        });
        setRunnerTotal((t) => t + 1);
        setQuizTimer(RUNNER_QUIZ_TIME);
        setRunnerState('quiz');
        return; // pause the loop until the quiz is resolved
      }

      rafRef.current = requestAnimationFrame(loop);
    };

    rafRef.current = requestAnimationFrame(loop);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, runnerState]);

  // Runner quiz countdown
  useEffect(() => {
    if (mode !== 'runner' || runnerState !== 'quiz') return;
    if (quizTimer <= 0) {
      handleRunnerAnswer(-1);
      return;
    }
    const t = setTimeout(() => setQuizTimer((q) => q - 1), 1000);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, runnerState, quizTimer]);

  // ===== Select Phase =====
  if (mode === 'select') {
    const games = [
      {
        id: 'match' as const,
        title: '单词消消乐',
        desc: '将英文与中文释义配对消除',
        icon: Shuffle,
        color: 'var(--teal-600)',
        bg: 'rgba(20,184,166,0.12)',
        onStart: startMatch,
      },
      {
        id: 'speed' as const,
        title: '极速问答',
        desc: '限时 15 秒内选择正确词义',
        icon: Zap,
        color: 'var(--amber-500)',
        bg: 'rgba(245,158,11,0.12)',
        onStart: startSpeed,
      },
      {
        id: 'runner' as const,
        title: '单词跑酷',
        desc: '答题跳跃躲避障碍',
        icon: Gamepad2,
        color: '#8b5cf6',
        bg: 'rgba(139,92,246,0.12)',
        onStart: startRunner,
      },
    ];

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
          返回首页
        </button>

        <div>
          <h1 className="text-2xl font-bold font-display" style={{ color: 'var(--text)' }}>
            趣味游戏
          </h1>
          <p className="text-sm mt-1" style={{ color: 'var(--text-secondary)' }}>
            边玩边学，巩固词汇记忆
          </p>
        </div>

        <div className="space-y-3">
          {games.map((game) => {
            const Icon = game.icon;
            return (
              <Card
                key={game.id}
                hover
                padding="lg"
                onClick={game.onStart}
                className="flex items-center gap-4"
              >
                <div
                  className="flex items-center justify-center w-14 h-14 rounded-2xl flex-shrink-0"
                  style={{ background: game.bg, color: game.color }}
                >
                  <Icon size={28} />
                </div>
                <div className="flex-1">
                  <h3 className="font-bold text-base mb-1" style={{ color: 'var(--text)' }}>
                    {game.title}
                  </h3>
                  <p className="text-sm" style={{ color: 'var(--text-tertiary)' }}>
                    {game.desc}
                  </p>
                </div>
                <ChevronLeft
                  size={20}
                  className="rotate-180"
                  style={{ color: 'var(--text-tertiary)' }}
                />
              </Card>
            );
          })}
        </div>

        {/* Info card */}
        <Card padding="md" className="flex items-start gap-3">
          <div
            className="flex items-center justify-center w-9 h-9 rounded-lg flex-shrink-0"
            style={{ background: 'rgba(251,191,36,0.12)', color: 'var(--amber-500)' }}
          >
            <Trophy size={18} />
          </div>
          <div>
            <p className="font-semibold text-sm mb-1" style={{ color: 'var(--text)' }}>
              游戏奖励
            </p>
            <p className="text-xs" style={{ color: 'var(--text-tertiary)' }}>
              完成游戏可获得金币奖励，答对越多奖励越丰富
            </p>
          </div>
        </Card>
      </div>
    );
  }

  // ===== Result Phase =====
  if (mode === 'result') {
    const isMatch = lastGameType === 'match';
    const isRunner = lastGameType === 'runner';
    const score = isMatch ? matchScore : isRunner ? runnerScore : speedScore;
    const total = isMatch
      ? MATCH_ROUND_SIZE * 3
      : isRunner
        ? Math.max(runnerTotal, 1)
        : SPEED_ROUND_SIZE;
    const percent = total > 0 ? Math.round((score / total) * 100) : 0;
    // Match actual reward: score * 5 + 20
    // Speed actual reward: score * 3 + 10
    // Runner actual reward: score * 4 + floor(distance / 100) + 10
    const coins = isRunner
      ? runnerScore * 4 + Math.floor(runnerDistance / 100) + 10
      : isMatch
        ? score * 5 + 20
        : score * 3 + 10;

    return (
      <div className="space-y-5 animate-fade-in">
        <Card padding="lg" className="text-center">
          <div
            className="flex items-center justify-center w-16 h-16 rounded-full mx-auto mb-4"
            style={{ background: 'rgba(20,184,166,0.15)', color: 'var(--teal-600)' }}
          >
            <Award size={32} />
          </div>
          <h2 className="text-xl font-bold font-display mb-1" style={{ color: 'var(--text)' }}>
            游戏结束！
          </h2>
          <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
            表现不错，继续加油
          </p>
        </Card>

        <div className="grid grid-cols-3 gap-3">
          <Card padding="md" className="text-center">
            <p className="text-2xl font-bold" style={{ color: 'var(--teal-600)' }}>
              {score}
            </p>
            <p className="text-xs" style={{ color: 'var(--text-tertiary)' }}>
              正确数
            </p>
          </Card>
          <Card padding="md" className="text-center">
            <p className="text-2xl font-bold" style={{ color: '#16a34a' }}>
              {percent}%
            </p>
            <p className="text-xs" style={{ color: 'var(--text-tertiary)' }}>
              正确率
            </p>
          </Card>
          <Card padding="md" className="text-center">
            <p className="text-2xl font-bold" style={{ color: 'var(--amber-500)' }}>
              {coins}
            </p>
            <p className="text-xs" style={{ color: 'var(--text-tertiary)' }}>
              获得金币
            </p>
          </Card>
        </div>

        <div className="flex gap-3">
          <Button variant="secondary" fullWidth onClick={() => navigate('/')}>
            <ChevronLeft size={18} />
            返回首页
          </Button>
          <Button variant="primary" fullWidth onClick={() => setMode('select')}>
            <RotateCw size={18} />
            再玩一次
          </Button>
        </div>
      </div>
    );
  }

  // ===== Match Game =====
  if (mode === 'match') {
    const enList = matchPairs;
    const zhList = zhOrder.map((i) => matchPairs[i]);
    const allMatched = matchPairs.every((p) => p.matched);

    return (
      <div className="space-y-4 animate-fade-in">
        {/* Progress */}
        <div className="flex items-center gap-3">
          <button
            onClick={() => {
              sfx.navigate();
              setMode('select');
            }}
            className="flex items-center justify-center w-8 h-8 rounded-full flex-shrink-0"
            style={{ background: 'var(--surface-3)', color: 'var(--text-secondary)' }}
          >
            <ChevronLeft size={18} />
          </button>
          <div className="flex-1">
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs font-medium" style={{ color: 'var(--text-tertiary)' }}>
                第 {matchRound} / 3 轮
              </span>
              <span className="text-xs font-bold" style={{ color: 'var(--teal-600)' }}>
                已配对 {matchScore} / {MATCH_ROUND_SIZE}
              </span>
            </div>
            <div
              className="w-full rounded-full overflow-hidden"
              style={{ height: 6, background: 'var(--surface-3)' }}
            >
              <div
                className="h-full rounded-full transition-all duration-300"
                style={{
                  width: `${(matchScore / MATCH_ROUND_SIZE) * 100}%`,
                  background: 'linear-gradient(90deg, var(--teal-400), var(--teal-600))',
                }}
              />
            </div>
          </div>
        </div>

        {/* Game title */}
        <div className="text-center">
          <h2 className="font-bold text-base" style={{ color: 'var(--text)' }}>
            单词消消乐
          </h2>
          <p className="text-xs mt-1" style={{ color: 'var(--text-tertiary)' }}>
            点击英文和中文进行配对
          </p>
        </div>

        {/* Game board */}
        {!allMatched && (
          <div className="grid grid-cols-2 gap-3">
            {/* English column */}
            <div className="space-y-2">
              <p className="text-xs font-bold text-center mb-2" style={{ color: 'var(--text-tertiary)' }}>
                English
              </p>
              {enList.map((pair, idx) => {
                const isSelected = selectedEn === idx;
                return (
                  <button
                    key={`en-${idx}`}
                    onClick={() => !pair.matched && handleMatchClick(idx, 'en')}
                    disabled={pair.matched}
                    className="w-full p-3 rounded-xl text-sm font-medium text-center transition-all"
                    style={{
                      background: pair.matched
                        ? 'rgba(22,163,74,0.08)'
                        : pair.wrong
                          ? 'rgba(220,38,38,0.1)'
                          : isSelected
                            ? 'rgba(20,184,166,0.15)'
                            : 'var(--surface)',
                      border: `2px solid ${
                        pair.matched
                          ? 'rgba(22,163,74,0.3)'
                          : pair.wrong
                            ? '#dc2626'
                            : isSelected
                              ? 'var(--teal-500)'
                              : 'var(--border)'
                      }`,
                      color: pair.matched ? 'var(--text-tertiary)' : 'var(--text)',
                      opacity: pair.matched ? 0.4 : 1,
                      textDecoration: pair.matched ? 'line-through' : 'none',
                    }}
                  >
                    {pair.item.en}
                  </button>
                );
              })}
            </div>

            {/* Chinese column */}
            <div className="space-y-2">
              <p className="text-xs font-bold text-center mb-2" style={{ color: 'var(--text-tertiary)' }}>
                中文
              </p>
              {zhList.map((pair, idx) => {
                const enIdx = enList.findIndex((p) => p.item.en === pair.item.en);
                const isSelected = selectedZh === enIdx;
                return (
                  <button
                    key={`zh-${idx}`}
                    onClick={() => !pair.matched && handleMatchClick(enIdx, 'zh')}
                    disabled={pair.matched}
                    className="w-full p-3 rounded-xl text-sm text-center transition-all"
                    style={{
                      background: pair.matched
                        ? 'rgba(22,163,74,0.08)'
                        : pair.wrong
                          ? 'rgba(220,38,38,0.1)'
                          : isSelected
                            ? 'rgba(20,184,166,0.15)'
                            : 'var(--surface)',
                      border: `2px solid ${
                        pair.matched
                          ? 'rgba(22,163,74,0.3)'
                          : pair.wrong
                            ? '#dc2626'
                            : isSelected
                              ? 'var(--teal-500)'
                              : 'var(--border)'
                      }`,
                      color: pair.matched ? 'var(--text-tertiary)' : 'var(--text)',
                      opacity: pair.matched ? 0.4 : 1,
                      textDecoration: pair.matched ? 'line-through' : 'none',
                    }}
                  >
                    {pair.item.zh}
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>
    );
  }

  // ===== Speed Quiz Game =====
  if (mode === 'speed') {
    const current = speedQuestions[speedIndex];
    if (!current) {
      return (
        <Card padding="lg" className="text-center">
          <p className="text-sm" style={{ color: 'var(--text-tertiary)' }}>
            游戏数据异常
          </p>
          <Button variant="primary" className="mt-3" onClick={() => setMode('select')}>
            返回选择
          </Button>
        </Card>
      );
    }

    const progress = ((speedIndex + 1) / SPEED_ROUND_SIZE) * 100;
    const timerColor = speedTimer <= 5 ? '#dc2626' : speedTimer <= 10 ? 'var(--amber-500)' : 'var(--teal-600)';

    return (
      <div className="space-y-4 animate-fade-in">
        {/* Progress + Timer */}
        <div className="flex items-center gap-3">
          <button
            onClick={() => {
              sfx.navigate();
              setMode('select');
            }}
            className="flex items-center justify-center w-8 h-8 rounded-full flex-shrink-0"
            style={{ background: 'var(--surface-3)', color: 'var(--text-secondary)' }}
          >
            <ChevronLeft size={18} />
          </button>
          <div className="flex-1">
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs font-medium" style={{ color: 'var(--text-tertiary)' }}>
                {speedIndex + 1} / {SPEED_ROUND_SIZE}
              </span>
              <div className="flex items-center gap-1">
                <Timer size={14} style={{ color: timerColor }} />
                <span className="text-xs font-bold" style={{ color: timerColor }}>
                  {speedTimer}s
                </span>
              </div>
            </div>
            <div
              className="w-full rounded-full overflow-hidden"
              style={{ height: 6, background: 'var(--surface-3)' }}
            >
              <div
                className="h-full rounded-full transition-all duration-300"
                style={{
                  width: `${progress}%`,
                  background: 'linear-gradient(90deg, var(--amber-400), var(--amber-500))',
                }}
              />
            </div>
          </div>
        </div>

        {/* Score */}
        <div className="flex items-center justify-center gap-4">
          <div className="flex items-center gap-1">
            <Star size={16} style={{ color: 'var(--amber-500)' }} fill="currentColor" />
            <span className="font-bold text-sm" style={{ color: 'var(--text)' }}>
              {speedScore}
            </span>
          </div>
          <span className="text-xs" style={{ color: 'var(--text-tertiary)' }}>
            正确数
          </span>
        </div>

        {/* Question */}
        <Card padding="lg" className="text-center">
          {(() => {
            const emoji = getEmoji(current.item.en);
            return emoji ? <div className="text-4xl mb-3">{emoji}</div> : null;
          })()}
          <p className="text-xs mb-2" style={{ color: 'var(--text-tertiary)' }}>
            选择正确的中文释义
          </p>
          <h2 className="text-2xl font-bold font-display mb-2" style={{ color: 'var(--text)' }}>
            {current.item.en}
          </h2>
          {current.item.pos && (
            <span
              className="inline-block text-xs px-2 py-0.5 rounded"
              style={{ background: 'var(--surface-3)', color: 'var(--text-tertiary)' }}
            >
              {current.item.pos}
            </span>
          )}
        </Card>

        {/* Options */}
        <div className="space-y-2">
          {current.options.map((opt, idx) => {
            const showCorrect = current.answered && idx === current.correctIndex;
            const showWrong = current.answered && idx === current.selectedIndex && idx !== current.correctIndex;
            return (
              <button
                key={idx}
                onClick={() => handleSpeedAnswer(idx)}
                disabled={current.answered}
                className="w-full flex items-center gap-3 p-4 rounded-xl text-left cursor-pointer transition-all"
                style={{
                  background: showCorrect
                    ? 'rgba(22,163,74,0.1)'
                    : showWrong
                      ? 'rgba(220,38,38,0.1)'
                      : 'var(--surface)',
                  border: `2px solid ${showCorrect ? '#16a34a' : showWrong ? '#dc2626' : 'var(--border)'}`,
                  opacity: current.answered && !showCorrect && !showWrong ? 0.5 : 1,
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
      </div>
    );
  }

  // ===== Runner Game (单词跑酷) =====
  if (mode === 'runner') {
    const obstacles = obstaclesRef.current;
    const distanceM = Math.floor(runnerDistance);

    return (
      <div className="space-y-4 animate-fade-in">
        {/* Header */}
        <div className="flex items-center gap-3">
          <button
            onClick={() => {
              sfx.navigate();
              setRunnerState('idle');
              setMode('select');
            }}
            className="flex items-center justify-center w-8 h-8 rounded-full flex-shrink-0"
            style={{ background: 'var(--surface-3)', color: 'var(--text-secondary)' }}
          >
            <ChevronLeft size={18} />
          </button>
          <div className="flex-1">
            <span className="text-xs font-medium" style={{ color: 'var(--text-tertiary)' }}>
              单词跑酷
            </span>
          </div>
          <div className="flex items-center gap-1">
            <Star size={14} style={{ color: 'var(--amber-500)' }} fill="currentColor" />
            <span className="text-xs font-bold" style={{ color: 'var(--text)' }}>
              {runnerScore}
            </span>
          </div>
        </div>

        {runnerState === 'over' ? (
          <>
            {/* Game over card */}
            <Card padding="lg" className="text-center">
              <div
                className="flex items-center justify-center w-16 h-16 rounded-full mx-auto mb-4"
                style={{ background: 'rgba(139,92,246,0.15)', color: '#8b5cf6' }}
              >
                <Award size={32} />
              </div>
              <h2 className="text-xl font-bold font-display mb-1" style={{ color: 'var(--text)' }}>
                跑酷结束！
              </h2>
              <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                坚持跑了 {distanceM} 米，跳过 {runnerScore} 个障碍
              </p>
            </Card>

            <div className="grid grid-cols-3 gap-3">
              <Card padding="md" className="text-center">
                <p className="text-2xl font-bold" style={{ color: '#8b5cf6' }}>
                  {distanceM}
                </p>
                <p className="text-xs" style={{ color: 'var(--text-tertiary)' }}>
                  距离(米)
                </p>
              </Card>
              <Card padding="md" className="text-center">
                <p className="text-2xl font-bold" style={{ color: 'var(--teal-600)' }}>
                  {runnerScore}
                </p>
                <p className="text-xs" style={{ color: 'var(--text-tertiary)' }}>
                  跳过障碍
                </p>
              </Card>
              <Card padding="md" className="text-center">
                <p className="text-2xl font-bold" style={{ color: 'var(--amber-500)' }}>
                  {runnerScore * 4 + Math.floor(distanceM / 100) + 10}
                </p>
                <p className="text-xs" style={{ color: 'var(--text-tertiary)' }}>
                  获得金币
                </p>
              </Card>
            </div>

            <div className="flex gap-3">
              <Button variant="secondary" fullWidth onClick={() => setMode('select')}>
                <ChevronLeft size={18} />
                返回选择
              </Button>
              <Button variant="primary" fullWidth onClick={startRunner}>
                <RotateCw size={18} />
                再玩一次
              </Button>
            </div>
          </>
        ) : (
          <>
            {/* Game stage */}
            <div
              ref={stageRef}
              className="relative overflow-hidden rounded-2xl"
              style={{
                height: RUNNER_STAGE_HEIGHT,
                background:
                  'linear-gradient(180deg, #1e3a8a 0%, #3b82f6 45%, #93c5fd 80%, #bae6fd 100%)',
              }}
            >
              {/* Decorative clouds */}
              <div
                style={{
                  position: 'absolute',
                  top: 34,
                  left: '12%',
                  width: 54,
                  height: 18,
                  background: 'rgba(255,255,255,0.75)',
                  borderRadius: 999,
                }}
              />
              <div
                style={{
                  position: 'absolute',
                  top: 66,
                  left: '62%',
                  width: 42,
                  height: 15,
                  background: 'rgba(255,255,255,0.6)',
                  borderRadius: 999,
                }}
              />

              {/* Ground */}
              <div
                style={{
                  position: 'absolute',
                  bottom: 0,
                  left: 0,
                  right: 0,
                  height: RUNNER_GROUND_HEIGHT,
                  background: 'linear-gradient(180deg, #84cc16 0%, #65a30d 60%, #4d7c0f 100%)',
                  borderTop: '3px solid #3f6212',
                }}
              />
              {/* Ground motion dashes */}
              <div
                style={{
                  position: 'absolute',
                  bottom: RUNNER_GROUND_HEIGHT - 6,
                  left: 0,
                  right: 0,
                  height: 4,
                  backgroundImage:
                    'repeating-linear-gradient(90deg, rgba(255,255,255,0.5) 0 16px, transparent 16px 40px)',
                  backgroundPositionX: `${-((distanceM % 56))}px`,
                }}
              />

              {/* Obstacles */}
              {obstacles.map((ob) => {
                const isCactus = ob.type === 'cactus';
                return (
                  <div
                    key={ob.id}
                    style={{
                      position: 'absolute',
                      left: ob.x,
                      bottom: RUNNER_GROUND_HEIGHT,
                      width: isCactus ? 22 : 32,
                      height: isCactus ? 50 : 36,
                      background: isCactus
                        ? 'linear-gradient(180deg, #22c55e, #15803d)'
                        : 'linear-gradient(180deg, #9ca3af, #4b5563)',
                      borderRadius: isCactus ? '6px' : '8px 8px 4px 4px',
                      border: `2px solid ${isCactus ? '#166534' : '#374151'}`,
                      boxShadow: '0 2px 6px rgba(0,0,0,0.25)',
                    }}
                  />
                );
              })}

              {/* Player character */}
              <div
                style={{
                  position: 'absolute',
                  left: RUNNER_PLAYER_LEFT,
                  bottom: runnerJumping ? RUNNER_JUMP_BOTTOM : RUNNER_GROUND_HEIGHT,
                  width: 40,
                  height: 48,
                  transition: 'bottom 0.35s cubic-bezier(0.3, 0.8, 0.5, 1)',
                  background: runnerHit
                    ? 'linear-gradient(180deg, #fca5a5, #dc2626)'
                    : 'linear-gradient(180deg, #a78bfa, #7c3aed)',
                  borderRadius: '12px 12px 6px 6px',
                  border: '2px solid #5b21b6',
                  boxShadow: '0 3px 8px rgba(0,0,0,0.3)',
                }}
              >
                {/* eyes */}
                <div
                  style={{
                    position: 'absolute',
                    top: 12,
                    left: 9,
                    width: 7,
                    height: 7,
                    background: '#fff',
                    borderRadius: '50%',
                  }}
                />
                <div
                  style={{
                    position: 'absolute',
                    top: 12,
                    right: 9,
                    width: 7,
                    height: 7,
                    background: '#fff',
                    borderRadius: '50%',
                  }}
                />
                <div
                  style={{
                    position: 'absolute',
                    top: 14,
                    left: 11,
                    width: 3,
                    height: 3,
                    background: '#1f2937',
                    borderRadius: '50%',
                  }}
                />
                <div
                  style={{
                    position: 'absolute',
                    top: 14,
                    right: 11,
                    width: 3,
                    height: 3,
                    background: '#1f2937',
                    borderRadius: '50%',
                  }}
                />
              </div>

              {/* HP (top-left) */}
              <div
                style={{
                  position: 'absolute',
                  top: 10,
                  left: 12,
                  display: 'flex',
                  gap: 4,
                  alignItems: 'center',
                }}
              >
                {Array.from({ length: RUNNER_MAX_HP }).map((_, i) => (
                  <Heart
                    key={i}
                    size={18}
                    fill={i < runnerHp ? '#ef4444' : 'none'}
                    color={i < runnerHp ? '#ef4444' : 'rgba(255,255,255,0.45)'}
                  />
                ))}
              </div>

              {/* Distance / score (top-right) */}
              <div
                style={{
                  position: 'absolute',
                  top: 12,
                  right: 12,
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'flex-end',
                  gap: 2,
                }}
              >
                <span
                  style={{
                    color: '#fff',
                    fontSize: 13,
                    fontWeight: 700,
                    textShadow: '0 1px 2px rgba(0,0,0,0.4)',
                  }}
                >
                  {distanceM} m
                </span>
                <span
                  style={{
                    color: 'rgba(255,255,255,0.85)',
                    fontSize: 11,
                    textShadow: '0 1px 2px rgba(0,0,0,0.4)',
                  }}
                >
                  跳过 {runnerScore}
                </span>
              </div>
            </div>

            {/* Quiz panel (below the stage, not overlapping) */}
            {runnerState === 'quiz' && currentQuiz ? (
              <Card padding="md" className="space-y-3">
                {/* Timer bar */}
                <div
                  style={{
                    height: 6,
                    background: 'var(--surface-3)',
                    borderRadius: 999,
                    overflow: 'hidden',
                  }}
                >
                  <div
                    style={{
                      height: '100%',
                      width: `${(quizTimer / RUNNER_QUIZ_TIME) * 100}%`,
                      background:
                        quizTimer <= 2
                          ? '#dc2626'
                          : 'linear-gradient(90deg, var(--amber-400), var(--amber-500))',
                      transition: 'width 1s linear',
                    }}
                  />
                </div>
                <div className="text-center">
                  <p className="text-xs mb-1" style={{ color: 'var(--text-tertiary)' }}>
                    选择正确释义，答对即可跳跃躲避
                  </p>
                  <h3
                    className="text-xl font-bold font-display"
                    style={{ color: 'var(--text)' }}
                  >
                    {currentQuiz.item.en}
                  </h3>
                  {currentQuiz.item.pos && (
                    <span
                      className="inline-block text-xs px-2 py-0.5 rounded mt-1"
                      style={{ background: 'var(--surface-3)', color: 'var(--text-tertiary)' }}
                    >
                      {currentQuiz.item.pos}
                    </span>
                  )}
                </div>
                <div className="grid grid-cols-2 gap-2">
                  {currentQuiz.options.map((opt, idx) => (
                    <button
                      key={idx}
                      onClick={() => handleRunnerAnswer(idx)}
                      className="p-3 rounded-xl text-sm font-medium text-center transition-all"
                      style={{
                        background: 'var(--surface)',
                        border: '2px solid var(--border)',
                        color: 'var(--text)',
                      }}
                    >
                      <span
                        className="inline-flex items-center justify-center w-6 h-6 rounded-full text-xs font-bold mr-2"
                        style={{ background: 'var(--surface-3)', color: 'var(--text-secondary)' }}
                      >
                        {String.fromCharCode(65 + idx)}
                      </span>
                      {opt.zh}
                    </button>
                  ))}
                </div>
              </Card>
            ) : (
              <p className="text-center text-xs" style={{ color: 'var(--text-tertiary)' }}>
                障碍靠近时自动弹出题目，答对即可跳跃躲避
              </p>
            )}
          </>
        )}
      </div>
    );
  }

  return null;
}
