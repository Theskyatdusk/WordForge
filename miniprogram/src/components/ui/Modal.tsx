/**
 * Modal —— 对齐 web 端 components/ui/Modal.tsx。
 * 差异：
 *   - 没有 document.body.style.overflow，改用 catchMove 阻止背景滚动穿透
 *   - 没有 Escape 键，靠遮罩点击 / 右上角关闭按钮
 */
import { View, Text } from '@tarojs/components';
import type { ReactNode } from 'react';
import { Icon } from '../Icon';
import { sfx } from '../../utils/sfx';
import './ui.scss';

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: ReactNode;
  /** 底部固定操作区 */
  footer?: ReactNode;
}

export function Modal({ open, onClose, title, children, footer }: ModalProps) {
  if (!open) return null;

  const handleClose = () => {
    sfx.click();
    onClose();
  };

  return (
    <View className="wf-modal" catchMove onClick={handleClose}>
      <View
        className="wf-modal__panel"
        onClick={(e) => {
          // 阻止冒泡到遮罩，避免点内容区就关闭
          e.stopPropagation();
        }}
      >
        <View className="wf-modal__head">
          <Text className="wf-modal__title">{title || ''}</Text>
          <View className="wf-modal__close" onClick={handleClose}>
            <Icon name="x" size={18} color="var(--text-tertiary)" />
          </View>
        </View>

        <View className="wf-modal__body">{children}</View>

        {footer ? <View className="wf-modal__foot">{footer}</View> : null}
      </View>
    </View>
  );
}
