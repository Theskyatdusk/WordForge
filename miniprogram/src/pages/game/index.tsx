/**
 * Game — 词汇小游戏（Taro / 微信小程序版）。
 * 包含：单词消消乐（EN↔ZH 配对）、极速问答（限时选择）、单词跑酷（答题跳跃避障）。
 *
 * 与原 web 版差异：
 *  - react-router useNavigate → Taro.navigateBack / switchTab
 *  - lucide-react 图标 → <Icon name="...">（Timer 用 clock 代替）
 *  - 跑酷游戏原用 requestAnimationFrame + DOM ref；小程序无 rAF，改为 setTimeout 递归循环，
 *    障碍坐标用百分比定位（left: x/360*100%），通过 setRunnerDistance 触发重渲染读取 ref。
 */
import { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import { View, Text } from '@tarojs/components';
import Taro from '@tarojs/taro';
import { PageShell } from '../../components/ui/PageShell';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Icon } from '../../components/Icon';
import { useVocab, getAllItems } from '../../hooks/useVocab';
import { useProgressStore } from '../../store/useProgressStore';
import { useUIStore } from '../../store/useUIStore';
import { sfx } from '../../utils/sfx';
import { getEmoji } from '../../utils/visuals';
import type { Item } from '../../types/index';
import './index.scss';

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
// 逻辑坐标空间宽度（与渲染宽度无关，位置用百分比表达）
const RUNNER_STAGE_W = 360;
const RUNNER_GROUND_HEIGHT = 112; // rpx（原 56px ×2）
const RUNNER_JUMP_BOTTOM = 260; // rpx（原 130px ×2）
const RUNNER_QUIZ_TRIGGER_X = 250;
const RUNNER_PLAYER_LEFT = 120;
const RUNNER_QUIZ_TIME = 5;
const RUNNER_INITIAL_SPEED = 4;
const RUNNER_MAX_SPEED = 10;
const RUNNER_SPAWN_GAP = 380;
const RUNNER_MAX_HP = 3;

export default function GamePage() {
  const addCoins = useProgressStore((s) => s.addCoins);
  const addToast = useUIStore((s) => s.addToast);
  const { data } = useVocab();

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
  const loopTimerRef = useRef<number | null>(null);
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

  // 返回首页（Game 为非 tab 页，优先 navigateBack，无栈则切到首页 tab）
  const goHome = useCallback(() => {
    sfx.navigate();
    Taro.navigateBack({
      fail: () => Taro.switchTab({ url: '/pages/dashboard/index' }),
    });
  }, []);

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
    if (matchPairs.some((p) => p.wrong)) return;

    if (side === 'en') {
      setSelectedEn(index);
      sfx.click();
    } else {
      setSelectedZh(index);
      sfx.click();
    }

    if (selectedEn !== null && side === 'zh') {
      if (selectedEn === index) {
        const newPairs = matchPairs.map((p, i) =>
          i === index ? { ...p, matched: true } : p,
        );
        setMatchPairs(newPairs);
        setSelectedEn(null);
        setSelectedZh(null);
        setMatchScore((s) => s + 1);
        sfx.correct();

        if (newPairs.every((p) => p.matched)) {
          setTimeout(() => {
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
        const wrongEn = selectedEn;
        setMatchPairs((prev) => prev.map((p, i) =>
          i === wrongEn || i === index ? { ...p, wrong: true } : p,
        ));
        setSelectedEn(null);
        setSelectedZh(null);
        setTimeout(() => {
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
          setTimeout(() => {
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
        setTimeout(() => {
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

    setTimeout(() => {
      if (speedIndex + 1 >= SPEED_ROUND_SIZE) {
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
      const ob = obstaclesRef.current.find((o) => o.id === obstacleId);
      if (ob) ob.cleared = true;
      setRunnerJumping(true);
      setTimeout(() => setRunnerJumping(false), 700);
      setCurrentQuiz(null);
      setRunnerState('playing');
    } else {
      sfx.wrong();
      setRunnerHit(true);
      setTimeout(() => setRunnerHit(false), 500);
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

  // Runner game loop（小程序无 requestAnimationFrame，用 setTimeout 递归）
  useEffect(() => {
    if (mode !== 'runner' || runnerState !== 'playing') return;
    let cancelled = false;

    const tick = () => {
      if (cancelled) return;
      const speed = speedRef.current;

      for (const ob of obstaclesRef.current) {
        ob.x -= speed;
      }
      obstaclesRef.current = obstaclesRef.current.filter((ob) => ob.x > -80);

      distanceRef.current += speed;
      setRunnerDistance(Math.floor(distanceRef.current));

      speedRef.current = Math.min(
        RUNNER_INITIAL_SPEED + distanceRef.current / 800,
        RUNNER_MAX_SPEED,
      );

      if (distanceRef.current - lastSpawnDistanceRef.current >= RUNNER_SPAWN_GAP) {
        lastSpawnDistanceRef.current = distanceRef.current;
        obstacleIdRef.current += 1;
        const type: RunnerObstacle['type'] = Math.random() < 0.5 ? 'cactus' : 'rock';
        obstaclesRef.current.push({
          id: obstacleIdRef.current,
          x: RUNNER_STAGE_W + 20,
          type,
          cleared: false,
          answered: false,
        });
      }

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
        return; // 暂停循环，等答题结束
      }

      loopTimerRef.current = setTimeout(tick, 40) as unknown as number;
    };

    loopTimerRef.current = setTimeout(tick, 40) as unknown as number;
    return () => {
      cancelled = true;
      if (loopTimerRef.current) clearTimeout(loopTimerRef.current);
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
        icon: 'shuffle',
        color: '#0d9488',
        bg: 'rgba(20,184,166,0.12)',
        onStart: startMatch,
      },
      {
        id: 'speed' as const,
        title: '极速问答',
        desc: '限时 15 秒内选择正确词义',
        icon: 'zap',
        color: '#f59e0b',
        bg: 'rgba(245,158,11,0.12)',
        onStart: startSpeed,
      },
      {
        id: 'runner' as const,
        title: '单词跑酷',
        desc: '答题跳跃躲避障碍',
        icon: 'gamepad',
        color: '#8b5cf6',
        bg: 'rgba(139,92,246,0.12)',
        onStart: startRunner,
      },
    ];

    return (
      <PageShell>
        <View className='wf-fade-in'>
          <View
            onClick={goHome}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 4,
              fontSize: 26,
              color: 'var(--text-tertiary)',
              marginBottom: 24,
            }}
          >
            <Icon name='chevron-left' size={9} color='var(--text-tertiary)' />
            <Text style={{ fontSize: 26, color: 'var(--text-tertiary)' }}>返回首页</Text>
          </View>

          <View style={{ marginBottom: 28 }}>
            <Text
              style={{
                fontSize: 44,
                fontWeight: 700,
                fontFamily: 'var(--font-display)',
                color: 'var(--text)',
              }}
            >
              趣味游戏
            </Text>
            <Text
              style={{
                display: 'block',
                fontSize: 26,
                marginTop: 8,
                color: 'var(--text-secondary)',
              }}
            >
              边玩边学，巩固词汇记忆
            </Text>
          </View>

          <View style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
            {games.map((game) => (
              <Card key={game.id} hover padding='lg' onClick={game.onStart}>
                <View style={{ display: 'flex', alignItems: 'center', gap: 32 }}>
                  <View
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      width: 112,
                      height: 112,
                      borderRadius: 28,
                      flexShrink: 0,
                      background: game.bg,
                      color: game.color,
                    }}
                  >
                    <Icon name={game.icon} size={14} color={game.color} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text
                      style={{
                        display: 'block',
                        fontSize: 32,
                        fontWeight: 700,
                        color: 'var(--text)',
                        marginBottom: 8,
                      }}
                    >
                      {game.title}
                    </Text>
                    <Text style={{ display: 'block', fontSize: 26, color: 'var(--text-tertiary)' }}>
                      {game.desc}
                    </Text>
                  </View>
                  <Icon name='chevron-left' size={10} color='var(--text-tertiary)' className='gm-rot-180' />
                </View>
              </Card>
            ))}
          </View>

          <Card padding='md'>
            <View style={{ display: 'flex', alignItems: 'flex-start', gap: 24 }}>
              <View
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  width: 72,
                  height: 72,
                  borderRadius: 16,
                  flexShrink: 0,
                  background: 'rgba(251,191,36,0.12)',
                  color: '#f59e0b',
                }}
              >
                <Icon name='trophy' size={9} color='#f59e0b' />
              </View>
              <View>
                <Text
                  style={{
                    display: 'block',
                    fontSize: 28,
                    fontWeight: 600,
                    color: 'var(--text)',
                    marginBottom: 8,
                  }}
                >
                  游戏奖励
                </Text>
                <Text style={{ display: 'block', fontSize: 24, color: 'var(--text-tertiary)' }}>
                  完成游戏可获得金币奖励，答对越多奖励越丰富
                </Text>
              </View>
            </View>
          </Card>
        </View>
      </PageShell>
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
    const coins = isRunner
      ? runnerScore * 4 + Math.floor(runnerDistance / 100) + 10
      : Math.round(score * 3.5) + 10;

    return (
      <PageShell>
        <View className='wf-fade-in' style={{ display: 'flex', flexDirection: 'column', gap: 40 }}>
          <Card padding='lg'>
            <View style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
              <View
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  width: 128,
                  height: 128,
                  borderRadius: 999,
                  marginBottom: 32,
                  background: 'rgba(20,184,166,0.15)',
                  color: '#0d9488',
                }}
              >
                <Icon name='award' size={16} color='#0d9488' />
              </View>
              <Text
                style={{
                  fontSize: 40,
                  fontWeight: 700,
                  fontFamily: 'var(--font-display)',
                  color: 'var(--text)',
                  marginBottom: 8,
                }}
              >
                游戏结束！
              </Text>
              <Text style={{ fontSize: 26, color: 'var(--text-secondary)' }}>
                表现不错，继续加油
              </Text>
            </View>
          </Card>

          <View style={{ display: 'flex', gap: 24 }}>
            <Card padding='md' style={{ flex: 1 }}>
              <View style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                <Text style={{ fontSize: 40, fontWeight: 700, color: '#0d9488' }}>{score}</Text>
                <Text style={{ fontSize: 22, color: 'var(--text-tertiary)', marginTop: 4 }}>正确数</Text>
              </View>
            </Card>
            <Card padding='md' style={{ flex: 1 }}>
              <View style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                <Text style={{ fontSize: 40, fontWeight: 700, color: '#16a34a' }}>{percent}%</Text>
                <Text style={{ fontSize: 22, color: 'var(--text-tertiary)', marginTop: 4 }}>正确率</Text>
              </View>
            </Card>
            <Card padding='md' style={{ flex: 1 }}>
              <View style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                <Text style={{ fontSize: 40, fontWeight: 700, color: '#f59e0b' }}>{coins}</Text>
                <Text style={{ fontSize: 22, color: 'var(--text-tertiary)', marginTop: 4 }}>获得金币</Text>
              </View>
            </Card>
          </View>

          <View style={{ display: 'flex', gap: 24 }}>
            <Button variant='secondary' fullWidth onClick={goHome}>
              <Icon name='chevron-left' size={9} />
              <Text style={{ marginLeft: 8 }}>返回首页</Text>
            </Button>
            <Button variant='primary' fullWidth onClick={() => setMode('select')}>
              <Icon name='rotate-ccw' size={9} />
              <Text style={{ marginLeft: 8 }}>再玩一次</Text>
            </Button>
          </View>
        </View>
      </PageShell>
    );
  }

  // ===== Match Game =====
  if (mode === 'match') {
    const enList = matchPairs;
    const zhList = shuffle([...matchPairs]);
    const allMatched = matchPairs.every((p) => p.matched);

    return (
      <PageShell>
        <View className='wf-fade-in' style={{ display: 'flex', flexDirection: 'column', gap: 32 }}>
          {/* Progress */}
          <View style={{ display: 'flex', alignItems: 'center', gap: 24 }}>
            <View
              onClick={() => {
                sfx.navigate();
                setMode('select');
              }}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: 64,
                height: 64,
                borderRadius: 999,
                flexShrink: 0,
                background: 'var(--surface-3)',
                color: 'var(--text-secondary)',
              }}
            >
              <Icon name='chevron-left' size={9} color='var(--text-secondary)' />
            </View>
            <View style={{ flex: 1 }}>
              <View
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  marginBottom: 8,
                }}
              >
                <Text style={{ fontSize: 22, fontWeight: 500, color: 'var(--text-tertiary)' }}>
                  第 {matchRound} / 3 轮
                </Text>
                <Text style={{ fontSize: 22, fontWeight: 700, color: '#0d9488' }}>
                  已配对 {matchScore} / {MATCH_ROUND_SIZE}
                </Text>
              </View>
              <View
                style={{
                  width: '100%',
                  height: 12,
                  borderRadius: 999,
                  overflow: 'hidden',
                  background: 'var(--surface-3)',
                }}
              >
                <View
                  style={{
                    height: '100%',
                    borderRadius: 999,
                    transition: 'width 0.3s',
                    width: `${(matchScore / MATCH_ROUND_SIZE) * 100}%`,
                    background: 'linear-gradient(90deg,#2dd4bf,#0d9488)',
                  }}
                />
              </View>
            </View>
          </View>

          {/* Game title */}
          <View style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            <Text style={{ fontSize: 32, fontWeight: 700, color: 'var(--text)' }}>单词消消乐</Text>
            <Text style={{ fontSize: 22, color: 'var(--text-tertiary)', marginTop: 8 }}>
              点击英文和中文进行配对
            </Text>
          </View>

          {/* Game board */}
          {!allMatched && (
            <View style={{ display: 'flex', gap: 24 }}>
              {/* English column */}
              <View style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 16 }}>
                <Text
                  style={{
                    fontSize: 22,
                    fontWeight: 700,
                    textAlign: 'center',
                    marginBottom: 8,
                    color: 'var(--text-tertiary)',
                  }}
                >
                  English
                </Text>
                {enList.map((pair, idx) => {
                  const isSelected = selectedEn === idx;
                  return (
                    <View
                      key={`en-${idx}`}
                      onClick={() => !pair.matched && handleMatchClick(idx, 'en')}
                      style={{
                        width: '100%',
                        padding: 24,
                        borderRadius: 20,
                        fontSize: 26,
                        fontWeight: 500,
                        textAlign: 'center',
                        background: pair.matched
                          ? 'rgba(22,163,74,0.08)'
                          : pair.wrong
                            ? 'rgba(220,38,38,0.1)'
                            : isSelected
                              ? 'rgba(20,184,166,0.15)'
                              : 'var(--surface)',
                        borderWidth: 2,
                        borderStyle: 'solid',
                        borderColor: pair.matched
                          ? 'rgba(22,163,74,0.3)'
                          : pair.wrong
                            ? '#dc2626'
                            : isSelected
                              ? '#14b8a6'
                              : 'var(--border)',
                        color: pair.matched ? 'var(--text-tertiary)' : 'var(--text)',
                        opacity: pair.matched ? 0.4 : 1,
                        textDecoration: pair.matched ? 'line-through' : 'none',
                      }}
                    >
                      <Text
                        style={{
                          fontSize: 26,
                          fontWeight: 500,
                          color: pair.matched ? 'var(--text-tertiary)' : 'var(--text)',
                          textDecoration: pair.matched ? 'line-through' : 'none',
                        }}
                      >
                        {pair.item.en}
                      </Text>
                    </View>
                  );
                })}
              </View>

              {/* Chinese column */}
              <View style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 16 }}>
                <Text
                  style={{
                    fontSize: 22,
                    fontWeight: 700,
                    textAlign: 'center',
                    marginBottom: 8,
                    color: 'var(--text-tertiary)',
                  }}
                >
                  中文
                </Text>
                {zhList.map((pair, idx) => {
                  const enIdx = enList.findIndex((p) => p.item.en === pair.item.en);
                  const isSelected = selectedZh === enIdx;
                  return (
                    <View
                      key={`zh-${idx}`}
                      onClick={() => !pair.matched && handleMatchClick(enIdx, 'zh')}
                      style={{
                        width: '100%',
                        padding: 24,
                        borderRadius: 20,
                        fontSize: 26,
                        textAlign: 'center',
                        background: pair.matched
                          ? 'rgba(22,163,74,0.08)'
                          : pair.wrong
                            ? 'rgba(220,38,38,0.1)'
                            : isSelected
                              ? 'rgba(20,184,166,0.15)'
                              : 'var(--surface)',
                        borderWidth: 2,
                        borderStyle: 'solid',
                        borderColor: pair.matched
                          ? 'rgba(22,163,74,0.3)'
                          : pair.wrong
                            ? '#dc2626'
                            : isSelected
                              ? '#14b8a6'
                              : 'var(--border)',
                        color: pair.matched ? 'var(--text-tertiary)' : 'var(--text)',
                        opacity: pair.matched ? 0.4 : 1,
                        textDecoration: pair.matched ? 'line-through' : 'none',
                      }}
                    >
                      <Text
                        style={{
                          fontSize: 26,
                          color: pair.matched ? 'var(--text-tertiary)' : 'var(--text)',
                          textDecoration: pair.matched ? 'line-through' : 'none',
                        }}
                      >
                        {pair.item.zh}
                      </Text>
                    </View>
                  );
                })}
              </View>
            </View>
          )}
        </View>
      </PageShell>
    );
  }

  // ===== Speed Quiz Game =====
  if (mode === 'speed') {
    const current = speedQuestions[speedIndex];
    if (!current) {
      return (
        <PageShell>
          <Card padding='lg'>
            <View style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
              <Text style={{ fontSize: 26, color: 'var(--text-tertiary)' }}>游戏数据异常</Text>
              <View style={{ marginTop: 24 }}>
                <Button variant='primary' onClick={() => setMode('select')}>
                  返回选择
                </Button>
              </View>
            </View>
          </Card>
        </PageShell>
      );
    }

    const progress = ((speedIndex + 1) / SPEED_ROUND_SIZE) * 100;
    const timerColor = speedTimer <= 5 ? '#dc2626' : speedTimer <= 10 ? '#f59e0b' : '#0d9488';

    return (
      <PageShell>
        <View className='wf-fade-in' style={{ display: 'flex', flexDirection: 'column', gap: 32 }}>
          {/* Progress + Timer */}
          <View style={{ display: 'flex', alignItems: 'center', gap: 24 }}>
            <View
              onClick={() => {
                sfx.navigate();
                setMode('select');
              }}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: 64,
                height: 64,
                borderRadius: 999,
                flexShrink: 0,
                background: 'var(--surface-3)',
                color: 'var(--text-secondary)',
              }}
            >
              <Icon name='chevron-left' size={9} color='var(--text-secondary)' />
            </View>
            <View style={{ flex: 1 }}>
              <View
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  marginBottom: 8,
                }}
              >
                <Text style={{ fontSize: 22, fontWeight: 500, color: 'var(--text-tertiary)' }}>
                  {speedIndex + 1} / {SPEED_ROUND_SIZE}
                </Text>
                <View style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                  <Icon name='clock' size={7} color={timerColor} />
                  <Text style={{ fontSize: 22, fontWeight: 700, color: timerColor }}>
                    {speedTimer}s
                  </Text>
                </View>
              </View>
              <View
                style={{
                  width: '100%',
                  height: 12,
                  borderRadius: 999,
                  overflow: 'hidden',
                  background: 'var(--surface-3)',
                }}
              >
                <View
                  style={{
                    height: '100%',
                    borderRadius: 999,
                    transition: 'width 0.3s',
                    width: `${progress}%`,
                    background: 'linear-gradient(90deg,#fbbf24,#f59e0b)',
                  }}
                />
              </View>
            </View>
          </View>

          {/* Score */}
          <View style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 16 }}>
            <View style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <Icon name='star' size={8} color='#f59e0b' />
              <Text style={{ fontSize: 28, fontWeight: 700, color: 'var(--text)' }}>{speedScore}</Text>
            </View>
            <Text style={{ fontSize: 22, color: 'var(--text-tertiary)' }}>正确数</Text>
          </View>

          {/* Question */}
          <Card padding='lg'>
            <View style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
              {(() => {
                const emoji = getEmoji(current.item.en);
                return emoji ? (
                  <Text style={{ fontSize: 64, marginBottom: 24 }}>{emoji}</Text>
                ) : null;
              })()}
              <Text style={{ fontSize: 22, marginBottom: 16, color: 'var(--text-tertiary)' }}>
                选择正确的中文释义
              </Text>
              <Text
                style={{
                  fontSize: 40,
                  fontWeight: 700,
                  fontFamily: 'var(--font-display)',
                  marginBottom: 16,
                  color: 'var(--text)',
                }}
              >
                {current.item.en}
              </Text>
              {current.item.pos && (
                <Text
                  style={{
                    display: 'inline-block',
                    fontSize: 22,
                    padding: '4rpx 16rpx',
                    borderRadius: 12,
                    background: 'var(--surface-3)',
                    color: 'var(--text-tertiary)',
                  }}
                >
                  {current.item.pos}
                </Text>
              )}
            </View>
          </Card>

          {/* Options */}
          <View style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {current.options.map((opt, idx) => {
              const showCorrect = current.answered && idx === current.correctIndex;
              const showWrong = current.answered && idx === current.selectedIndex && idx !== current.correctIndex;
              return (
                <View
                  key={idx}
                  onClick={() => handleSpeedAnswer(idx)}
                  style={{
                    width: '100%',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 24,
                    padding: 32,
                    borderRadius: 20,
                    background: showCorrect
                      ? 'rgba(22,163,74,0.1)'
                      : showWrong
                        ? 'rgba(220,38,38,0.1)'
                        : 'var(--surface)',
                    borderWidth: 2,
                    borderStyle: 'solid',
                    borderColor: showCorrect ? '#16a34a' : showWrong ? '#dc2626' : 'var(--border)',
                    opacity: current.answered && !showCorrect && !showWrong ? 0.5 : 1,
                  }}
                >
                  <View
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      width: 64,
                      height: 64,
                      borderRadius: 999,
                      fontSize: 26,
                      fontWeight: 700,
                      flexShrink: 0,
                      background: showCorrect ? '#16a34a' : showWrong ? '#dc2626' : 'var(--surface-3)',
                      color: showCorrect || showWrong ? '#fff' : 'var(--text-secondary)',
                    }}
                  >
                    {showCorrect ? (
                      <Icon name='check' size={8} color='#fff' />
                    ) : showWrong ? (
                      <Icon name='x' size={8} color='#fff' />
                    ) : (
                      <Text style={{ fontSize: 26, fontWeight: 700, color: 'var(--text-secondary)' }}>
                        {String.fromCharCode(65 + idx)}
                      </Text>
                    )}
                  </View>
                  <Text style={{ fontSize: 26, fontWeight: 500, color: 'var(--text)' }}>{opt.zh}</Text>
                </View>
              );
            })}
          </View>
        </View>
      </PageShell>
    );
  }

  // ===== Runner Game (单词跑酷) =====
  if (mode === 'runner') {
    const obstacles = obstaclesRef.current;
    const distanceM = Math.floor(runnerDistance);

    return (
      <PageShell>
        <View className='wf-fade-in' style={{ display: 'flex', flexDirection: 'column', gap: 32 }}>
          {/* Header */}
          <View style={{ display: 'flex', alignItems: 'center', gap: 24 }}>
            <View
              onClick={() => {
                sfx.navigate();
                setRunnerState('idle');
                setMode('select');
              }}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: 64,
                height: 64,
                borderRadius: 999,
                flexShrink: 0,
                background: 'var(--surface-3)',
                color: 'var(--text-secondary)',
              }}
            >
              <Icon name='chevron-left' size={9} color='var(--text-secondary)' />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 22, fontWeight: 500, color: 'var(--text-tertiary)' }}>
                单词跑酷
              </Text>
            </View>
            <View style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <Icon name='star' size={7} color='#f59e0b' />
              <Text style={{ fontSize: 22, fontWeight: 700, color: 'var(--text)' }}>{runnerScore}</Text>
            </View>
          </View>

          {runnerState === 'over' ? (
            <>
              <Card padding='lg'>
                <View style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                  <View
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      width: 128,
                      height: 128,
                      borderRadius: 999,
                      marginBottom: 32,
                      background: 'rgba(139,92,246,0.15)',
                      color: '#8b5cf6',
                    }}
                  >
                    <Icon name='award' size={16} color='#8b5cf6' />
                  </View>
                  <Text
                    style={{
                      fontSize: 40,
                      fontWeight: 700,
                      fontFamily: 'var(--font-display)',
                      color: 'var(--text)',
                      marginBottom: 8,
                    }}
                  >
                    跑酷结束！
                  </Text>
                  <Text style={{ fontSize: 26, color: 'var(--text-secondary)' }}>
                    坚持跑了 {distanceM} 米，跳过 {runnerScore} 个障碍
                  </Text>
                </View>
              </Card>

              <View style={{ display: 'flex', gap: 24 }}>
                <Card padding='md' style={{ flex: 1 }}>
                  <View style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                    <Text style={{ fontSize: 40, fontWeight: 700, color: '#8b5cf6' }}>{distanceM}</Text>
                    <Text style={{ fontSize: 22, color: 'var(--text-tertiary)', marginTop: 4 }}>距离(米)</Text>
                  </View>
                </Card>
                <Card padding='md' style={{ flex: 1 }}>
                  <View style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                    <Text style={{ fontSize: 40, fontWeight: 700, color: '#0d9488' }}>{runnerScore}</Text>
                    <Text style={{ fontSize: 22, color: 'var(--text-tertiary)', marginTop: 4 }}>跳过障碍</Text>
                  </View>
                </Card>
                <Card padding='md' style={{ flex: 1 }}>
                  <View style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                    <Text style={{ fontSize: 40, fontWeight: 700, color: '#f59e0b' }}>
                      {runnerScore * 4 + Math.floor(distanceM / 100) + 10}
                    </Text>
                    <Text style={{ fontSize: 22, color: 'var(--text-tertiary)', marginTop: 4 }}>获得金币</Text>
                  </View>
                </Card>
              </View>

              <View style={{ display: 'flex', gap: 24 }}>
                <Button variant='secondary' fullWidth onClick={() => setMode('select')}>
                  <Icon name='chevron-left' size={9} />
                  <Text style={{ marginLeft: 8 }}>返回选择</Text>
                </Button>
                <Button variant='primary' fullWidth onClick={startRunner}>
                  <Icon name='rotate-ccw' size={9} />
                  <Text style={{ marginLeft: 8 }}>再玩一次</Text>
                </Button>
              </View>
            </>
          ) : (
            <>
              {/* Game stage */}
              <View
                style={{
                  position: 'relative',
                  overflow: 'hidden',
                  borderRadius: 28,
                  height: 680,
                  background:
                    'linear-gradient(180deg, #1e3a8a 0%, #3b82f6 45%, #93c5fd 80%, #bae6fd 100%)',
                }}
              >
                {/* Decorative clouds */}
                <View
                  style={{
                    position: 'absolute',
                    top: 60,
                    left: '10%',
                    width: 108,
                    height: 36,
                    background: 'rgba(255,255,255,0.75)',
                    borderRadius: 999,
                  }}
                />
                <View
                  style={{
                    position: 'absolute',
                    top: 130,
                    left: '60%',
                    width: 84,
                    height: 30,
                    background: 'rgba(255,255,255,0.6)',
                    borderRadius: 999,
                  }}
                />

                {/* Ground */}
                <View
                  style={{
                    position: 'absolute',
                    bottom: 0,
                    left: 0,
                    right: 0,
                    height: RUNNER_GROUND_HEIGHT,
                    background: 'linear-gradient(180deg, #84cc16 0%, #65a30d 60%, #4d7c0f 100%)',
                    borderTopWidth: 3,
                    borderTopStyle: 'solid',
                    borderTopColor: '#3f6212',
                  }}
                />

                {/* Obstacles */}
                {obstacles.map((ob) => {
                  const isCactus = ob.type === 'cactus';
                  return (
                    <View
                      key={ob.id}
                      style={{
                        position: 'absolute',
                        left: `${(ob.x / RUNNER_STAGE_W) * 100}%`,
                        bottom: RUNNER_GROUND_HEIGHT,
                        width: isCactus ? 44 : 64,
                        height: isCactus ? 100 : 72,
                        background: isCactus
                          ? 'linear-gradient(180deg, #22c55e, #15803d)'
                          : 'linear-gradient(180deg, #9ca3af, #4b5563)',
                        borderRadius: isCactus ? '12rpx' : '16rpx 16rpx 8rpx 8rpx',
                        borderWidth: 2,
                        borderStyle: 'solid',
                        borderColor: isCactus ? '#166534' : '#374151',
                        boxShadow: '0 2px 6px rgba(0,0,0,0.25)',
                      }}
                    />
                  );
                })}

                {/* Player character */}
                <View
                  style={{
                    position: 'absolute',
                    left: '33.3%',
                    bottom: runnerJumping ? RUNNER_JUMP_BOTTOM : RUNNER_GROUND_HEIGHT,
                    width: 80,
                    height: 96,
                    transition: 'bottom 0.35s cubic-bezier(0.3, 0.8, 0.5, 1)',
                    background: runnerHit
                      ? 'linear-gradient(180deg, #fca5a5, #dc2626)'
                      : 'linear-gradient(180deg, #a78bfa, #7c3aed)',
                    borderRadius: '24rpx 24rpx 12rpx 12rpx',
                    borderWidth: 2,
                    borderStyle: 'solid',
                    borderColor: '#5b21b6',
                    boxShadow: '0 3px 8px rgba(0,0,0,0.3)',
                  }}
                >
                  <View
                    style={{
                      position: 'absolute',
                      top: 24,
                      left: 18,
                      width: 14,
                      height: 14,
                      background: '#fff',
                      borderRadius: 999,
                    }}
                  />
                  <View
                    style={{
                      position: 'absolute',
                      top: 24,
                      right: 18,
                      width: 14,
                      height: 14,
                      background: '#fff',
                      borderRadius: 999,
                    }}
                  />
                  <View
                    style={{
                      position: 'absolute',
                      top: 28,
                      left: 20,
                      width: 6,
                      height: 6,
                      background: '#1f2937',
                      borderRadius: 999,
                    }}
                  />
                  <View
                    style={{
                      position: 'absolute',
                      top: 28,
                      right: 20,
                      width: 6,
                      height: 6,
                      background: '#1f2937',
                      borderRadius: 999,
                    }}
                  />
                </View>

                {/* HP (top-left) */}
                <View
                  style={{
                    position: 'absolute',
                    top: 20,
                    left: 24,
                    display: 'flex',
                    flexDirection: 'row',
                    gap: 8,
                    alignItems: 'center',
                  }}
                >
                  {Array.from({ length: RUNNER_MAX_HP }).map((_, i) => (
                    <Icon
                      key={i}
                      name='heart'
                      size={9}
                      color={i < runnerHp ? '#ef4444' : 'rgba(255,255,255,0.45)'}
                    />
                  ))}
                </View>

                {/* Distance / score (top-right) */}
                <View
                  style={{
                    position: 'absolute',
                    top: 24,
                    right: 24,
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'flex-end',
                    gap: 4,
                  }}
                >
                  <Text
                    style={{
                      color: '#fff',
                      fontSize: 26,
                      fontWeight: 700,
                      textShadow: '0 1px 2px rgba(0,0,0,0.4)',
                    }}
                  >
                    {distanceM} m
                  </Text>
                  <Text
                    style={{
                      color: 'rgba(255,255,255,0.85)',
                      fontSize: 22,
                      textShadow: '0 1px 2px rgba(0,0,0,0.4)',
                    }}
                  >
                    跳过 {runnerScore}
                  </Text>
                </View>
              </View>

              {/* Quiz panel (below the stage) */}
              {runnerState === 'quiz' && currentQuiz ? (
                <Card padding='md'>
                  <View style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
                    <View
                      style={{
                        height: 12,
                        background: 'var(--surface-3)',
                        borderRadius: 999,
                        overflow: 'hidden',
                      }}
                    >
                      <View
                        style={{
                          height: '100%',
                          width: `${(quizTimer / RUNNER_QUIZ_TIME) * 100}%`,
                          background:
                            quizTimer <= 2
                              ? '#dc2626'
                              : 'linear-gradient(90deg, #fbbf24, #f59e0b)',
                          transition: 'width 1s linear',
                        }}
                      />
                    </View>
                    <View style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                      <Text style={{ fontSize: 22, marginBottom: 8, color: 'var(--text-tertiary)' }}>
                        选择正确释义，答对即可跳跃躲避
                      </Text>
                      <Text
                        style={{
                          fontSize: 36,
                          fontWeight: 700,
                          fontFamily: 'var(--font-display)',
                          color: 'var(--text)',
                        }}
                      >
                        {currentQuiz.item.en}
                      </Text>
                      {currentQuiz.item.pos && (
                        <Text
                          style={{
                            display: 'inline-block',
                            fontSize: 22,
                            padding: '4rpx 16rpx',
                            borderRadius: 12,
                            marginTop: 8,
                            background: 'var(--surface-3)',
                            color: 'var(--text-tertiary)',
                          }}
                        >
                          {currentQuiz.item.pos}
                        </Text>
                      )}
                    </View>
                    <View style={{ display: 'flex', flexWrap: 'wrap', gap: 16 }}>
                      {currentQuiz.options.map((opt, idx) => (
                        <View
                          key={idx}
                          onClick={() => handleRunnerAnswer(idx)}
                          style={{
                            width: 'calc(50% - 8rpx)',
                            padding: 24,
                            borderRadius: 20,
                            fontSize: 26,
                            fontWeight: 500,
                            textAlign: 'center',
                            background: 'var(--surface)',
                            borderWidth: 2,
                            borderStyle: 'solid',
                            borderColor: 'var(--border)',
                            color: 'var(--text)',
                          }}
                        >
                          <Text
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              width: 48,
                              height: 48,
                              borderRadius: 999,
                              fontSize: 22,
                              fontWeight: 700,
                              marginRight: 16,
                              background: 'var(--surface-3)',
                              color: 'var(--text-secondary)',
                            }}
                          >
                            {String.fromCharCode(65 + idx)}
                          </Text>
                          {opt.zh}
                        </View>
                      ))}
                    </View>
                  </View>
                </Card>
              ) : (
                <Text
                  style={{
                    display: 'block',
                    textAlign: 'center',
                    fontSize: 22,
                    color: 'var(--text-tertiary)',
                  }}
                >
                  障碍靠近时自动弹出题目，答对即可跳跃躲避
                </Text>
              )}
            </>
          )}
        </View>
      </PageShell>
    );
  }

  return null;
}
