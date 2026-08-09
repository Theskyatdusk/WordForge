/**
 * Toggle —— 对齐 web 端 components/ui/Toggle.tsx。
 *
 * 迁移差异：不用小程序原生 <Switch>（样式无法完全定制、深色模式下轨道色跟不上主题），
 * 改为 View 手绘轨道 + 滑块，尺寸换算成 rpx。
 */
import { View, Text } from '@tarojs/components';
import { sfx } from '../../utils/sfx';
import './ui.scss';

interface ToggleProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
  size?: 'sm' | 'md';
  label?: string;
}

const DIMENSIONS = {
  sm: { width: 72, height: 40, knob: 28, translate: 32 },
  md: { width: 88, height: 48, knob: 36, translate: 40 },
} as const;

export function Toggle({
  checked,
  onChange,
  disabled = false,
  size = 'md',
  label,
}: ToggleProps) {
  const d = DIMENSIONS[size];

  const handleToggle = () => {
    if (disabled) return;
    sfx.toggle();
    onChange(!checked);
  };

  return (
    <View className="wf-toggle-wrap">
      <View
        className={`wf-toggle ${checked ? 'wf-toggle--on' : ''} ${disabled ? 'wf-toggle--disabled' : ''}`}
        style={{
          width: `${d.width}rpx`,
          height: `${d.height}rpx`,
          borderRadius: `${d.height}rpx`,
        }}
        onClick={handleToggle}
      >
        <View
          className="wf-toggle__knob"
          style={{
            width: `${d.knob}rpx`,
            height: `${d.knob}rpx`,
            left: `${checked ? d.translate : 4}rpx`,
            top: `${(d.height - d.knob) / 2 - 1}rpx`,
          }}
        />
      </View>
      {!!label && <Text className="wf-toggle__label">{label}</Text>}
    </View>
  );
}
