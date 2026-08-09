/**
 * ProgressRing — Circular progress SVG component.
 */
interface ProgressRingProps {
  /** Progress value 0-1 (or 0-100 if max=100) */
  value: number;
  /** Maximum value (default 1) */
  max?: number;
  /** Size in pixels */
  size?: number;
  /** Stroke width in pixels */
  strokeWidth?: number;
  /** Ring color (default teal-500) */
  color?: string;
  /** Track color (default border) */
  trackColor?: string;
  /** Show percentage text in center */
  showText?: boolean;
  /** Custom children in center */
  children?: React.ReactNode;
}

export function ProgressRing({
  value,
  max = 1,
  size = 60,
  strokeWidth = 5,
  color = 'var(--teal-500)',
  trackColor = 'var(--border)',
  showText = false,
  children,
}: ProgressRingProps) {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const normalizedValue = Math.max(0, Math.min(max, value));
  const progress = max > 0 ? normalizedValue / max : 0;
  const offset = circumference - progress * circumference;
  const percent = Math.round(progress * 100);

  return (
    <div
      className="relative inline-flex items-center justify-center"
      style={{ width: size, height: size }}
    >
      <svg
        width={size}
        height={size}
        className="transform -rotate-90"
        style={{ display: 'block' }}
      >
        {/* Track */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={trackColor}
          strokeWidth={strokeWidth}
        />
        {/* Progress */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          style={{ transition: 'stroke-dashoffset 0.5s ease' }}
        />
      </svg>
      {/* Center content */}
      <div className="absolute inset-0 flex items-center justify-center">
        {children ?? (showText && (
          <span
            className="font-bold"
            style={{
              fontSize: size * 0.28,
              color: 'var(--text)',
            }}
          >
            {percent}%
          </span>
        ))}
      </div>
    </div>
  );
}
