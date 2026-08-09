/**
 * 设置 —— 对齐 web 端 pages/Settings.tsx。
 *
 * 迁移差异：
 *   - <select> → Taro <Picker mode="selector">
 *   - <input type="range"> → Taro <Slider>
 *   - 「朗读声音」原本枚举 speechSynthesis.getVoices()，小程序没有该 API，
 *     改为后端 TTS 支持的音色固定列表
 *   - divide-y → SCSS 的 :not(:last-child) 下边框
 */
import { useState } from 'react';
import { View, Text, Picker, Slider } from '@tarojs/components';
import type { ReactNode } from 'react';
import { PageShell } from '../../components/ui/PageShell';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Toggle } from '../../components/ui/Toggle';
import { Modal } from '../../components/ui/Modal';
import { Icon } from '../../components/Icon';
import { useSettingsStore } from '../../store/useSettingsStore';
import { useUIStore } from '../../store/useUIStore';
import { tts } from '../../utils/tts';
import { sfx } from '../../utils/sfx';
import type { Settings as SettingsType } from '../../types/index';
import './index.scss';

/* ---------- 行 / 分组 ---------- */
interface SettingRowProps {
  icon: string;
  iconBg: string;
  iconColor: string;
  title: string;
  desc?: string;
  children: ReactNode;
}

function SettingRow({ icon, iconBg, iconColor, title, desc, children }: SettingRowProps) {
  return (
    <View className="sg__row">
      <View className="sg__row-icon" style={{ background: iconBg }}>
        <Icon name={icon} size={18} color={iconColor} />
      </View>
      <View className="sg__row-body">
        <Text className="sg__row-title">{title}</Text>
        {!!desc && <Text className="sg__row-desc">{desc}</Text>}
      </View>
      <View className="sg__row-ctrl">{children}</View>
    </View>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <View className="sg__section">
      <Text className="sg__section-title">{title}</Text>
      <Card padding="md">
        <View className="sg__rows">{children}</View>
      </Card>
    </View>
  );
}

/* ---------- 常量 ---------- */
const STUDY_MODES = [
  { id: 'flashcard', label: '卡片记忆' },
  { id: 'quiz', label: '选择题' },
  { id: 'spelling', label: '拼写练习' },
  { id: 'listening', label: '听力训练' },
];

const FEEDBACK_LEVELS: Array<{ id: SettingsType['feedbackLevel']; label: string }> = [
  { id: 'strong', label: '强烈' },
  { id: 'medium', label: '适中' },
  { id: 'weak', label: '柔和' },
];

const FONT_SIZES: Array<{ id: SettingsType['fontSize']; label: string }> = [
  { id: 'small', label: '小' },
  { id: 'medium', label: '中' },
  { id: 'large', label: '大' },
];

const QUIZ_OPTIONS: Array<{ id: 4 | 6; label: string }> = [
  { id: 4, label: '4个' },
  { id: 6, label: '6个' },
];

/** 后端 /tts 支持的音色（小程序没有 speechSynthesis.getVoices()） */
const TTS_VOICES = [
  { id: '', label: '默认' },
  { id: 'en-US-female', label: '美音 · 女声' },
  { id: 'en-US-male', label: '美音 · 男声' },
  { id: 'en-GB-female', label: '英音 · 女声' },
  { id: 'en-GB-male', label: '英音 · 男声' },
];

/* ---------- 小控件 ---------- */
function Stepper({
  value,
  onChange,
  min,
  max,
  step,
  width = 48,
}: {
  value: number;
  onChange: (v: number) => void;
  min: number;
  max: number;
  step: number;
  width?: number;
}) {
  return (
    <View className="sg__stepper">
      <View
        className="sg__step-btn"
        hoverClass="sg__step-btn--pressed"
        onClick={() => {
          sfx.click();
          onChange(Math.max(min, value - step));
        }}
      >
        <Icon name="minus" size={14} color="#64748b" />
      </View>
      <Text className="sg__step-val" style={{ width: `${width}rpx` }}>
        {value}
      </Text>
      <View
        className="sg__step-btn"
        hoverClass="sg__step-btn--pressed"
        onClick={() => {
          sfx.click();
          onChange(Math.min(max, value + step));
        }}
      >
        <Icon name="plus" size={14} color="#64748b" />
      </View>
    </View>
  );
}

function SegTabs<T extends string | number>({
  options,
  value,
  onChange,
}: {
  options: Array<{ id: T; label: string }>;
  value: T;
  onChange: (v: T) => void;
}) {
  return (
    <View className="sg__seg">
      {options.map((o) => (
        <View
          key={String(o.id)}
          className={`sg__seg-item ${value === o.id ? 'sg__seg-item--on' : ''}`}
          hoverClass="sg__seg-item--pressed"
          onClick={() => {
            sfx.click();
            onChange(o.id);
          }}
        >
          <Text className="sg__seg-text">{o.label}</Text>
        </View>
      ))}
    </View>
  );
}

/* ---------- 页面 ---------- */
export default function SettingsPage() {
  const settings = useSettingsStore((s) => s.settings);
  const update = useSettingsStore((s) => s.update);
  const reset = useSettingsStore((s) => s.reset);
  const addToast = useUIStore((s) => s.addToast);
  const toggleTheme = useUIStore((s) => s.toggleTheme);
  const theme = useUIStore((s) => s.theme);

  const [showResetConfirm, setShowResetConfirm] = useState(false);

  const handleReset = () => {
    sfx.click();
    reset();
    addToast('设置已重置', 'success');
    setShowResetConfirm(false);
  };

  const handleThemeToggle = () => {
    toggleTheme();
    update({ darkMode: theme === 'light' });
  };

  const modeIndex = Math.max(
    0,
    STUDY_MODES.findIndex((m) => m.id === settings.studyMode),
  );
  const voiceIndex = Math.max(
    0,
    TTS_VOICES.findIndex((v) => v.id === (settings.ttsVoice || '')),
  );

  return (
    <PageShell>
      <View className="wf-fade-in">
        <View className="sg__head">
          <Text className="wf-h1">设置</Text>
          <Text className="wf-sub">个性化你的学习体验</Text>
        </View>

        {/* ===== 学习设置 ===== */}
        <Section title="学习设置">
          <SettingRow
            icon="target"
            iconBg="rgba(20,184,166,0.12)"
            iconColor="#0d9488"
            title="每日学习目标"
            desc={`每天学习 ${settings.dailyGoal} 个单词`}
          >
            <Stepper
              value={settings.dailyGoal}
              min={5}
              max={100}
              step={5}
              onChange={(v) => update({ dailyGoal: v })}
            />
          </SettingRow>

          <SettingRow
            icon="sparkles"
            iconBg="rgba(139,92,246,0.12)"
            iconColor="#8b5cf6"
            title="每日新词目标"
            desc={`每天学习 ${settings.dailyNewGoal} 个新词`}
          >
            <Stepper
              value={settings.dailyNewGoal}
              min={3}
              max={50}
              step={2}
              onChange={(v) => update({ dailyNewGoal: v })}
            />
          </SettingRow>

          <SettingRow
            icon="graduation"
            iconBg="rgba(20,184,166,0.12)"
            iconColor="#0d9488"
            title="默认学习模式"
            desc="进入学习时默认使用的模式"
          >
            <Picker
              mode="selector"
              range={STUDY_MODES.map((m) => m.label)}
              value={modeIndex}
              onChange={(e) => {
                sfx.click();
                update({ studyMode: STUDY_MODES[Number(e.detail.value)].id });
              }}
            >
              <View className="sg__picker">
                <Text className="sg__picker-text">{STUDY_MODES[modeIndex].label}</Text>
                <Icon name="chevron-down" size={14} color="#94a3b8" />
              </View>
            </Picker>
          </SettingRow>

          <SettingRow
            icon="eye"
            iconBg="rgba(139,92,246,0.12)"
            iconColor="#8b5cf6"
            title="专注模式"
            desc="隐藏不必要的干扰元素"
          >
            <Toggle checked={settings.focusMode} onChange={(v) => update({ focusMode: v })} />
          </SettingRow>

          <SettingRow
            icon="zap"
            iconBg="rgba(245,158,11,0.12)"
            iconColor="#f59e0b"
            title="反馈强度"
            desc="音效和震动的强度"
          >
            <SegTabs
              options={FEEDBACK_LEVELS}
              value={settings.feedbackLevel}
              onChange={(v) => update({ feedbackLevel: v })}
            />
          </SettingRow>

          <SettingRow
            icon="sparkles"
            iconBg="rgba(251,191,36,0.12)"
            iconColor="#f59e0b"
            title="卡片显示例句"
            desc="学习卡片上展示例句"
          >
            <Toggle
              checked={settings.examplesOnCard}
              onChange={(v) => update({ examplesOnCard: v })}
            />
          </SettingRow>

          <SettingRow
            icon="rotate-ccw"
            iconBg="rgba(20,184,166,0.12)"
            iconColor="#0d9488"
            title="答对后重复次数"
            desc={`答对的词重复 ${settings.repeatCorrect} 次`}
          >
            <Stepper
              value={settings.repeatCorrect}
              min={0}
              max={5}
              step={1}
              width={36}
              onChange={(v) => update({ repeatCorrect: v })}
            />
          </SettingRow>

          <SettingRow
            icon="check-plain"
            iconBg="rgba(20,184,166,0.12)"
            iconColor="#0d9488"
            title="选择题选项数"
            desc="选择题中可选答案的数量"
          >
            <SegTabs
              options={QUIZ_OPTIONS}
              value={settings.quizOptionCount}
              onChange={(v) => update({ quizOptionCount: v })}
            />
          </SettingRow>

          <SettingRow
            icon="play"
            iconBg="rgba(139,92,246,0.12)"
            iconColor="#8b5cf6"
            title="答对后自动跳转"
            desc="答对后自动进入下一个单词"
          >
            <Toggle checked={settings.autoAdvance} onChange={(v) => update({ autoAdvance: v })} />
          </SettingRow>

          {settings.autoAdvance && (
            <SettingRow
              icon="clock"
              iconBg="rgba(139,92,246,0.12)"
              iconColor="#8b5cf6"
              title="自动跳转延迟"
              desc={`${settings.autoAdvanceDelay.toFixed(1)} 秒后跳转`}
            >
              <Slider
                className="sg__slider"
                min={5}
                max={50}
                step={5}
                value={settings.autoAdvanceDelay * 10}
                activeColor="#14b8a6"
                blockSize={18}
                onChanging={(e) => update({ autoAdvanceDelay: Number(e.detail.value) / 10 })}
                onChange={(e) => update({ autoAdvanceDelay: Number(e.detail.value) / 10 })}
              />
            </SettingRow>
          )}

          <SettingRow
            icon="refresh"
            iconBg="rgba(20,184,166,0.12)"
            iconColor="#0d9488"
            title="卡片自动翻转"
            desc="卡片模式下自动翻转到背面"
          >
            <Toggle checked={settings.cardAutoFlip} onChange={(v) => update({ cardAutoFlip: v })} />
          </SettingRow>

          {settings.cardAutoFlip && (
            <SettingRow
              icon="clock"
              iconBg="rgba(20,184,166,0.12)"
              iconColor="#0d9488"
              title="自动翻转延迟"
              desc={`${settings.cardAutoFlipDelay.toFixed(1)} 秒后翻转`}
            >
              <Slider
                className="sg__slider"
                min={10}
                max={100}
                step={5}
                value={settings.cardAutoFlipDelay * 10}
                activeColor="#14b8a6"
                blockSize={18}
                onChanging={(e) => update({ cardAutoFlipDelay: Number(e.detail.value) / 10 })}
                onChange={(e) => update({ cardAutoFlipDelay: Number(e.detail.value) / 10 })}
              />
            </SettingRow>
          )}

          <SettingRow
            icon="tag"
            iconBg="rgba(245,158,11,0.12)"
            iconColor="#f59e0b"
            title="显示词性标注"
            desc="在单词卡片上显示词性"
          >
            <Toggle checked={settings.showPOS} onChange={(v) => update({ showPOS: v })} />
          </SettingRow>

          <SettingRow
            icon="file-text"
            iconBg="rgba(139,92,246,0.12)"
            iconColor="#8b5cf6"
            title="字体大小"
            desc="单词卡片的字体大小"
          >
            <SegTabs
              options={FONT_SIZES}
              value={settings.fontSize}
              onChange={(v) => update({ fontSize: v })}
            />
          </SettingRow>
        </Section>

        {/* ===== 外观 ===== */}
        <Section title="外观">
          <SettingRow
            icon={theme === 'dark' ? 'moon' : 'sun'}
            iconBg={theme === 'dark' ? 'rgba(139,92,246,0.12)' : 'rgba(251,191,36,0.12)'}
            iconColor={theme === 'dark' ? '#8b5cf6' : '#f59e0b'}
            title="深色模式"
            desc={theme === 'dark' ? '已启用深色主题' : '使用浅色主题'}
          >
            <Toggle checked={theme === 'dark'} onChange={handleThemeToggle} />
          </SettingRow>

          <SettingRow
            icon="sparkles"
            iconBg="rgba(251,191,36,0.12)"
            iconColor="#f59e0b"
            title="显示奖励动画"
            desc="升级和成就的庆祝动画"
          >
            <Toggle checked={settings.showRewards} onChange={(v) => update({ showRewards: v })} />
          </SettingRow>
        </Section>

        {/* ===== 语音朗读 ===== */}
        <Section title="语音朗读">
          <SettingRow
            icon={settings.ttsEnabled ? 'volume' : 'volume-x'}
            iconBg="rgba(20,184,166,0.12)"
            iconColor="#0d9488"
            title="启用语音朗读"
            desc="调用服务端语音合成朗读单词"
          >
            <Toggle checked={settings.ttsEnabled} onChange={(v) => update({ ttsEnabled: v })} />
          </SettingRow>

          {settings.ttsEnabled && (
            <>
              <SettingRow
                icon="volume"
                iconBg="rgba(20,184,166,0.12)"
                iconColor="#0d9488"
                title="自动朗读"
                desc="显示卡片时自动播放发音"
              >
                <Toggle
                  checked={settings.ttsAutoPlay}
                  onChange={(v) => update({ ttsAutoPlay: v })}
                />
              </SettingRow>

              <SettingRow
                icon="zap"
                iconBg="rgba(245,158,11,0.12)"
                iconColor="#f59e0b"
                title="朗读速度"
                desc={`${settings.ttsRate.toFixed(1)}x 速度`}
              >
                <View className="sg__slider-row">
                  <Slider
                    className="sg__slider"
                    min={5}
                    max={20}
                    step={1}
                    value={settings.ttsRate * 10}
                    activeColor="#14b8a6"
                    blockSize={18}
                    onChange={(e) => update({ ttsRate: Number(e.detail.value) / 10 })}
                  />
                  <View
                    className="sg__try"
                    hoverClass="sg__step-btn--pressed"
                    onClick={() => tts.speakWord('hello')}
                  >
                    <Icon name="volume" size={14} color="#0d9488" />
                  </View>
                </View>
              </SettingRow>

              <SettingRow
                icon="headphones"
                iconBg="rgba(20,184,166,0.12)"
                iconColor="#0d9488"
                title="朗读音量"
                desc={`${Math.round(settings.ttsVolume * 100)}% 音量`}
              >
                <Slider
                  className="sg__slider"
                  min={0}
                  max={10}
                  step={1}
                  value={settings.ttsVolume * 10}
                  activeColor="#14b8a6"
                  blockSize={18}
                  onChange={(e) => update({ ttsVolume: Number(e.detail.value) / 10 })}
                />
              </SettingRow>

              <SettingRow
                icon="volume"
                iconBg="rgba(20,184,166,0.12)"
                iconColor="#0d9488"
                title="朗读声音"
                desc="选择英语发音音色"
              >
                <Picker
                  mode="selector"
                  range={TTS_VOICES.map((v) => v.label)}
                  value={voiceIndex}
                  onChange={(e) => {
                    sfx.click();
                    const picked = TTS_VOICES[Number(e.detail.value)];
                    update({ ttsVoice: picked.id || null });
                  }}
                >
                  <View className="sg__picker">
                    <Text className="sg__picker-text">{TTS_VOICES[voiceIndex].label}</Text>
                    <Icon name="chevron-down" size={14} color="#94a3b8" />
                  </View>
                </Picker>
              </SettingRow>
            </>
          )}
        </Section>

        {/* ===== 音效 ===== */}
        <Section title="音效与震动">
          <SettingRow
            icon={settings.sfxEnabled ? 'zap' : 'volume-x'}
            iconBg="rgba(139,92,246,0.12)"
            iconColor="#8b5cf6"
            title="启用反馈震动"
            desc="按钮点击和答题反馈的触觉反馈"
          >
            <Toggle checked={settings.sfxEnabled} onChange={(v) => update({ sfxEnabled: v })} />
          </SettingRow>
        </Section>

        {/* ===== 学习行为 ===== */}
        <Section title="学习行为">
          <SettingRow
            icon="eye-off"
            iconBg="rgba(139,92,246,0.12)"
            iconColor="#8b5cf6"
            title="先回忆再翻转"
            desc="卡片模式中先尝试回忆再查看答案"
          >
            <Toggle checked={settings.recallFirst} onChange={(v) => update({ recallFirst: v })} />
          </SettingRow>
        </Section>

        {/* ===== 数据管理 ===== */}
        <Section title="数据管理">
          <SettingRow
            icon="rotate-ccw"
            iconBg="rgba(220,38,38,0.1)"
            iconColor="#dc2626"
            title="重置设置"
            desc="恢复所有设置到默认值"
          >
            <Button
              size="sm"
              variant="danger"
              onClick={() => {
                sfx.click();
                setShowResetConfirm(true);
              }}
            >
              重置
            </Button>
          </SettingRow>
        </Section>

        {/* ===== 关于 ===== */}
        <Card padding="md" className="sg__about">
          <View className="sg__about-row">
            <Icon name="settings" size={18} color="#0d9488" />
            <Text className="sg__about-name">WordForge</Text>
          </View>
          <Text className="sg__about-ver">版本 1.0.0 · 基于 SM-2 间隔重复算法</Text>
        </Card>

        {/* 重置确认 */}
        <Modal
          open={showResetConfirm}
          onClose={() => setShowResetConfirm(false)}
          title="确认重置"
          footer={
            <View className="sg__modal-actions">
              <Button variant="secondary" fullWidth onClick={() => setShowResetConfirm(false)}>
                取消
              </Button>
              <Button variant="danger" fullWidth onClick={handleReset}>
                <Icon name="check-plain" size={16} color="#fff" />
                <Text className="sg__modal-btn-text">确认重置</Text>
              </Button>
            </View>
          }
        >
          <Text className="sg__modal-text">
            确定要重置所有设置吗？此操作不会影响你的学习进度和生词本数据。
          </Text>
        </Modal>
      </View>
    </PageShell>
  );
}
