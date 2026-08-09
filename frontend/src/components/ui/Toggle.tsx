/**
 * Toggle — Switch toggle component.
 */
import { sfx } from '../../utils/sfx';

interface ToggleProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
  size?: 'sm' | 'md';
  label?: string;
}

export function Toggle({
  checked,
  onChange,
  disabled = false,
  size = 'md',
  label,
}: ToggleProps) {
  const dimensions = {
    sm: { width: 36, height: 20, knob: 14, translate: 16 },
    md: { width: 44, height: 24, knob: 18, translate: 20 },
  };
  const d = dimensions[size];

  const handleToggle = () => {
    if (disabled) return;
    sfx.toggle();
    onChange(!checked);
  };

  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={label}
        onClick={handleToggle}
        disabled={disabled}
        className="relative inline-flex items-center cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
        style={{
          width: d.width,
          height: d.height,
          borderRadius: d.height,
          background: checked ? 'var(--teal-500)' : 'var(--surface-3)',
          border: '1px solid var(--border)',
          transition: 'background 0.2s ease',
        }}
      >
        <span
          className="absolute rounded-full bg-white"
          style={{
            width: d.knob,
            height: d.knob,
            left: checked ? d.translate : 2,
            top: 1,
            boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
            transition: 'left 0.2s ease',
          }}
        />
      </button>
      {label && (
        <span
          className="text-sm font-medium"
          style={{ color: 'var(--text-secondary)' }}
        >
          {label}
        </span>
      )}
    </div>
  );
}
